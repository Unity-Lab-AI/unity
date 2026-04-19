/**
 * T18.4.e — Worker thread for sparse CSR matmul row-range.
 *
 * Runs in a Node worker_thread. Receives:
 *   - Shared CSR arrays (values, colIdx, rowPtr) via SharedArrayBuffer
 *   - Shared spikes input buffer (Uint32Array-backed) via SharedArrayBuffer
 *   - Shared output currents buffer (Float32Array-backed) via SharedArrayBuffer
 *   - Row range [startRow, endRow) to process
 *
 * Writes currents[startRow..endRow) atomically via the shared output buffer.
 * Posts a `done` message on completion so the main thread's Promise.all
 * can resolve.
 *
 * No zero-copy magic — SharedArrayBuffer lets workers read/write without
 * cloning, so a 100MB CSR matrix is shared by reference not copy. Pool
 * startup cost is one-time; per-call dispatch is just a postMessage +
 * message round-trip (~sub-ms).
 *
 * Main-thread pool manager in `server/worker-pool.js`.
 */

const { parentPort } = require('worker_threads');

parentPort.on('message', (msg) => {
  if (msg.type === 'propagate') {
    propagate(msg);
  } else if (msg.type === 'shutdown') {
    process.exit(0);
  }
});

function propagate(msg) {
  const {
    jobId,
    valuesBuf,
    colIdxBuf,
    rowPtrBuf,
    spikesBuf,
    currentsBuf,
    startRow,
    endRow,
  } = msg;

  // SharedArrayBuffer views — zero-copy access to the shared CSR data
  // and the input spike vector. Output currents buffer is also shared,
  // and each worker writes only to its own row range [startRow, endRow)
  // so there are no cross-worker write collisions by construction.
  const values  = new Float32Array(valuesBuf);
  const colIdx  = new Uint32Array(colIdxBuf);
  const rowPtr  = new Uint32Array(rowPtrBuf);
  const spikes  = new Uint32Array(spikesBuf);
  const currents = new Float32Array(currentsBuf);

  // Sparse CSR matmul over this worker's row range:
  //   currents[i] = Σ_{k=rowPtr[i]..rowPtr[i+1]} values[k] · spikes[colIdx[k]]
  for (let i = startRow; i < endRow; i++) {
    let sum = 0;
    const start = rowPtr[i];
    const end = rowPtr[i + 1];
    for (let k = start; k < end; k++) {
      if (spikes[colIdx[k]] !== 0) {
        sum += values[k];
      }
    }
    currents[i] = sum;
  }

  parentPort.postMessage({ type: 'done', jobId, startRow, endRow });
}
