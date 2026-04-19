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

  /**
   * T17.2 — Hebbian update across the worker pool. Each worker
   * processes a disjoint row-range of the matrix's values buffer, so
   * there are no write collisions. Mutates the matrix in place (just
   * like `SparseMatrix.hebbianUpdate`) — after the promise resolves
   * every weight has been updated with `ΔW = η · post · pre` clamped
   * to [wMin, wMax].
   *
   * Falls through to synchronous single-thread matmul if the pool
   * isn't available. Same result, just no parallelism.
   */
  async hebbianUpdate(matrix, preSpikes, postSpikes, lr) {
    const rows = matrix.rows;
    const wMin = matrix.wMin ?? -2.0;
    const wMax = matrix.wMax ?? 2.0;

    // Convert to Float32 (typed array) so the shared buffer is a
    // well-defined binary layout across workers. Single-thread
    // fallback below accepts whatever the caller passed.
    if (!this._ready || this._workers.length === 0) {
      // Synchronous fallback — identical semantics to
      // SparseMatrix.hebbianUpdate so behavior is indistinguishable.
      const values = matrix.values;
      const colIdx = matrix.colIdx;
      const rowP = matrix.rowPtr;
      for (let i = 0; i < rows; i++) {
        if (!postSpikes[i]) continue;
        const scaled = lr * postSpikes[i];
        const start = rowP[i];
        const end = rowP[i + 1];
        for (let k = start; k < end; k++) {
          let v = values[k] + scaled * preSpikes[colIdx[k]];
          if (v > wMax) v = wMax;
          else if (v < wMin) v = wMin;
          values[k] = v;
        }
      }
      return true;
    }

    const shared = (arr, SharedCtor) => {
      if (arr.buffer instanceof SharedArrayBuffer) return arr;
      const sab = new SharedArrayBuffer(arr.byteLength);
      const view = new SharedCtor(sab);
      view.set(arr);
      return view;
    };

    // values MUST be shared (we mutate it). If the caller's values
    // array isn't already SharedArrayBuffer-backed, upgrade it in
    // place so subsequent calls benefit too.
    if (!(matrix.values.buffer instanceof SharedArrayBuffer)) {
      const sab = new SharedArrayBuffer(matrix.values.byteLength);
      const shView = matrix.values instanceof Float32Array
        ? new Float32Array(sab)
        : new Float64Array(sab);
      shView.set(matrix.values);
      matrix.values = shView;
    }
    const valsShared = matrix.values instanceof Float32Array
      ? matrix.values
      : (() => {
          // Hebbian worker expects Float32 — one-time conversion if
          // matrix is stored as Float64 (SparseMatrix default).
          const sab = new SharedArrayBuffer(matrix.rows === 0 ? 4 : matrix.values.length * 4);
          const v = new Float32Array(sab);
          for (let i = 0; i < matrix.values.length; i++) v[i] = matrix.values[i];
          return v;
        })();
    const colsShared = shared(matrix.colIdx instanceof Uint32Array ? matrix.colIdx : new Uint32Array(matrix.colIdx), Uint32Array);
    const rowPShared = shared(matrix.rowPtr instanceof Uint32Array ? matrix.rowPtr : new Uint32Array(matrix.rowPtr), Uint32Array);
    const preF32  = preSpikes  instanceof Float32Array ? preSpikes  : Float32Array.from(preSpikes);
    const postF32 = postSpikes instanceof Float32Array ? postSpikes : Float32Array.from(postSpikes);
    const preShared  = shared(preF32, Float32Array);
    const postShared = shared(postF32, Float32Array);

    const jobId = ++this._jobSeq;
    const N = this._workers.length;
    const rowsPerWorker = Math.ceil(rows / N);

    await new Promise((resolve) => {
      this._pending.set(jobId, { resolve, expected: N, received: 0 });
      for (let i = 0; i < N; i++) {
        const startRow = i * rowsPerWorker;
        const endRow = Math.min(startRow + rowsPerWorker, rows);
        if (startRow >= rows) {
          const entry = this._pending.get(jobId);
          if (entry) {
            entry.received++;
            if (entry.received >= entry.expected) {
              this._pending.delete(jobId);
              resolve();
            }
          }
          continue;
        }
        this._workers[i].postMessage({
          type: 'hebbian',
          jobId,
          valuesBuf: valsShared.buffer,
          colIdxBuf: colsShared.buffer,
          rowPtrBuf: rowPShared.buffer,
          preSpikesBuf: preShared.buffer,
          postSpikesBuf: postShared.buffer,
          startRow,
          endRow,
          lr,
          wMin,
          wMax,
        });
      }
    });

    // If we up-converted values to Float32 for workers but matrix
    // stored Float64, copy back so subsequent CPU single-thread reads
    // see the updated weights. (This only fires when the SparseMatrix
    // was constructed with Float64 values, which is the default.)
    if (valsShared !== matrix.values) {
      for (let i = 0; i < valsShared.length; i++) matrix.values[i] = valsShared[i];
    }
    return true;
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
