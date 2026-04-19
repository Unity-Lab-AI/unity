/**
 * T18.4.e — Worker pool manager for CPU sparse-matmul parallelization.
 *
 * Gee 2026-04-18 runtime report showed `Mode: Single Thread` +
 * `Parallel Workers: 0` on a 16-core 5800X. Curriculum teach's sparse
 * matmul loops run on one core while 15 sit idle. This pool fixes that:
 * partition the row range of a sparse matmul across N workers, each
 * running in its own thread, reading shared CSR arrays + writing
 * disjoint row-range slices of a shared output buffer.
 *
 * Usage:
 *   const pool = new SparseMatmulPool();  // sized to os.cpus().length - 1
 *   const out = await pool.propagate(sparseMatrix, spikesU32);
 *   // out is a Float32Array of length matrix.rows
 *
 * Falls back to synchronous CPU matmul if worker_threads is unavailable.
 */

const os = require('os');

let workerThreadsAvailable = true;
let WorkerClass = null;
try {
  WorkerClass = require('worker_threads').Worker;
} catch {
  workerThreadsAvailable = false;
}

class SparseMatmulPool {
  constructor(opts = {}) {
    // One worker per physical core minus one, capped at 16. Leaves a
    // core free for the Node main thread + GPU dispatch + WebSocket
    // + HTTP handling.
    const cpuCount = os.cpus()?.length || 4;
    this._poolSize = Math.max(1, Math.min(opts.size ?? (cpuCount - 1), 16));
    this._workers = [];
    this._ready = false;
    this._jobSeq = 0;
    this._pending = new Map(); // jobId → { resolve, expected, received }

    this._init();
  }

  _init() {
    if (!workerThreadsAvailable) {
      console.warn('[WorkerPool] worker_threads unavailable — CPU sparse matmul stays single-threaded.');
      return;
    }
    const path = require('path');
    const workerPath = path.join(__dirname, 'sparse-worker.js');
    try {
      for (let i = 0; i < this._poolSize; i++) {
        const w = new WorkerClass(workerPath);
        w.on('message', (msg) => this._handleMessage(msg));
        w.on('error', (err) => console.warn(`[WorkerPool] worker ${i} error:`, err.message));
        this._workers.push(w);
      }
      this._ready = true;
      console.log(`[WorkerPool] Started ${this._poolSize} sparse-matmul workers (${os.cpus()?.length} cores available).`);
    } catch (err) {
      console.warn('[WorkerPool] Worker init failed:', err.message);
      this._ready = false;
    }
  }

  _handleMessage(msg) {
    if (msg.type !== 'done') return;
    const entry = this._pending.get(msg.jobId);
    if (!entry) return;
    entry.received++;
    if (entry.received >= entry.expected) {
      this._pending.delete(msg.jobId);
      entry.resolve();
    }
  }

  /**
   * Propagate a sparse CSR matrix against a spike vector across the
   * worker pool. Returns a Float32Array of post-synaptic currents.
   *
   * Uses SharedArrayBuffer so workers read/write the same memory
   * regions the caller sees — zero copy for the CSR data + input
   * spikes + output currents.
   *
   * If the pool isn't available, runs the matmul synchronously on the
   * main thread as a fallback. Same result, just no parallelism.
   */
  async propagate(matrix, spikesU32) {
    const rows = matrix.rows;

    // Materialize shared buffers. Ideally the caller already hands us
    // SharedArrayBuffer-backed views; if not (regular ArrayBuffer),
    // copy into shared memory so workers can access them. This copy
    // is O(nnz) one-time per call — cheap relative to the matmul.
    const shared = (arr, SharedCtor) => {
      if (arr.buffer instanceof SharedArrayBuffer) return arr;
      const sab = new SharedArrayBuffer(arr.byteLength);
      const view = new SharedCtor(sab);
      view.set(arr);
      return view;
    };

    // Single-thread fallback — just do it here, synchronously.
    if (!this._ready || this._workers.length === 0) {
      const out = new Float32Array(rows);
      const vals = matrix.values instanceof Float32Array ? matrix.values : new Float32Array(matrix.values);
      const cols = matrix.colIdx;
      const rowP = matrix.rowPtr;
      for (let i = 0; i < rows; i++) {
        let sum = 0;
        const s = rowP[i];
        const e = rowP[i + 1];
        for (let k = s; k < e; k++) {
          if (spikesU32[cols[k]] !== 0) sum += vals[k];
        }
        out[i] = sum;
      }
      return out;
    }

    const valsShared = shared(matrix.values instanceof Float32Array ? matrix.values : new Float32Array(matrix.values), Float32Array);
    const colsShared = shared(matrix.colIdx instanceof Uint32Array ? matrix.colIdx : new Uint32Array(matrix.colIdx), Uint32Array);
    const rowPShared = shared(matrix.rowPtr instanceof Uint32Array ? matrix.rowPtr : new Uint32Array(matrix.rowPtr), Uint32Array);
    const spikesShared = shared(spikesU32, Uint32Array);
    const outSab = new SharedArrayBuffer(rows * 4);
    const outView = new Float32Array(outSab);

    const jobId = ++this._jobSeq;
    const N = this._workers.length;
    const rowsPerWorker = Math.ceil(rows / N);

    return new Promise((resolve) => {
      this._pending.set(jobId, { resolve: () => resolve(outView), expected: N, received: 0 });

      for (let i = 0; i < N; i++) {
        const startRow = i * rowsPerWorker;
        const endRow = Math.min(startRow + rowsPerWorker, rows);
        if (startRow >= rows) {
          // This worker has no rows to do; counts as already done.
          const entry = this._pending.get(jobId);
          if (entry) {
            entry.received++;
            if (entry.received >= entry.expected) {
              this._pending.delete(jobId);
              resolve(outView);
            }
          }
          continue;
        }
        this._workers[i].postMessage({
          type: 'propagate',
          jobId,
          valuesBuf: valsShared.buffer,
          colIdxBuf: colsShared.buffer,
          rowPtrBuf: rowPShared.buffer,
          spikesBuf: spikesShared.buffer,
          currentsBuf: outSab,
          startRow,
          endRow,
        });
      }
    });
  }

  get ready() { return this._ready; }
  get size() { return this._workers.length; }

  shutdown() {
    for (const w of this._workers) {
      try { w.postMessage({ type: 'shutdown' }); } catch {}
      try { w.terminate(); } catch {}
    }
    this._workers = [];
    this._ready = false;
  }
}

module.exports = { SparseMatmulPool };
