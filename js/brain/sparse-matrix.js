/**
 * sparse-matrix.js — Compressed Sparse Row (CSR) Matrix
 *
 * Biologically realistic: real neurons have ~1000-10000 connections
 * out of millions of possible targets. Dense NxN wastes 90%+ memory
 * on zeros and 90%+ compute iterating over them.
 *
 * CSR stores only non-zero entries:
 *   values[]    — the weight of each connection
 *   colIdx[]    — which neuron each connection comes FROM (pre-synaptic)
 *   rowPtr[]    — where each neuron's connections start in values/colIdx
 *
 * Memory: O(connections) instead of O(N²)
 * Propagate: O(connections) instead of O(N²)
 * At 12% connectivity, 1000 neurons: 120K ops vs 1M ops
 * At 3% connectivity, 10K neurons: 3M ops vs 100M ops
 *
 * Drop-in replacement for SynapseMatrix. Same API, different guts.
 */

export class SparseMatrix {
  /**
   * @param {number} rows — number of post-synaptic neurons
   * @param {number} cols — number of pre-synaptic neurons (defaults to rows)
   * @param {object} [opts]
   * @param {number} [opts.wMin=-Infinity]
   * @param {number} [opts.wMax=Infinity]
   */
  constructor(rows, cols, opts = {}) {
    this.rows = rows;
    this.cols = cols ?? rows;
    this.wMin = opts.wMin ?? -Infinity;
    this.wMax = opts.wMax ?? Infinity;

    // CSR arrays — start empty, populated by init methods
    this.values = new Float64Array(0);   // non-zero weights
    this.colIdx = new Uint32Array(0);    // column indices (pre-synaptic neuron)
    this.rowPtr = new Uint32Array(rows + 1); // row start pointers
    this.nnz = 0; // number of non-zero entries
  }

  // ── Initialization ─────────────────────────────────────────────

  /**
   * Initialize with random sparse connectivity.
   * @param {number} density — connection probability (0-1)
   * @param {number} excitatoryRatio — fraction of positive weights
   * @param {number} strength — initial weight magnitude
   */
  initRandom(density, excitatoryRatio = 0.8, strength = 0.3) {
    const { rows, cols } = this;
    const noSelfConnect = (rows === cols);

    // T14.21 (2026-04-14) — rewritten to sample in O(nnz) instead of
    // O(rows * cols). The old algorithm walked a nested loop over every
    // matrix cell and ran Math.random() per cell to decide inclusion:
    //
    //   for i in 0..rows:
    //     for j in 0..cols:
    //       if random() < density: include (i, j)
    //
    // At 10K * 10K that's 100M iterations per cluster. At 100K * 100K
    // it's 10B iterations — won't finish in human timescales. Biological
    // scale (1M+ neurons) is completely unreachable via the nested scan.
    //
    // New algorithm: for each row, compute target k = round(cols * density),
    // then sample k unique column indices via rejection (Set-dedup). At
    // sparse densities (d < 0.1) rejection is efficient because the
    // probability of picking a repeat column stays small. Total work
    // is O(nnz) with a small constant — at 10K * 300 fanout that's 3M
    // ops (~60ms) instead of 100M ops (~2-5s). 50-100x faster, exact
    // same output shape.
    // Rewrite — allocate directly into typed arrays, no transient
    // {j, w} objects per entry. At 100K-neuron cortex, the prior
    // version created ~30M { j, w } objects (~1.2GB of V8 heap) just
    // for intra-cluster + cross-projection init, which GC-thrashed
    // Node into an apparent hang. Direct typed-array fills cut that
    // to the final ~360MB footprint plus a per-row Uint32 scratch for
    // sorting column indices.
    //
    // Per row: sample kPerRow unique column indices into a scratch
    // Uint32Array, in-place radix-ish sort (actually plain Array sort
    // on a sliced typed-array view), then fill values + colIdx
    // slots directly.

    // Pre-compute total entries so we can allocate final typed arrays
    // up front (no temp row arrays accumulated).
    let totalPre = 0;
    const perRowK = new Uint32Array(rows);
    for (let i = 0; i < rows; i++) {
      const kPerRow = Math.min(Math.round(cols * density), Math.max(0, cols - (noSelfConnect ? 1 : 0)));
      perRowK[i] = kPerRow;
      totalPre += kPerRow;
    }

    this.values = new Float64Array(totalPre);
    this.colIdx = new Uint32Array(totalPre);
    this.rowPtr = new Uint32Array(rows + 1);
    this.nnz = totalPre;

    // Scratch column buffer, reused across rows to avoid per-row
    // allocation. Sized to the largest kPerRow on this matrix.
    let maxK = 0;
    for (let i = 0; i < rows; i++) if (perRowK[i] > maxK) maxK = perRowK[i];
    const scratchCols = new Uint32Array(maxK);
    const seen = new Set();

    let idx = 0;
    this.rowPtr[0] = 0;
    for (let i = 0; i < rows; i++) {
      const kPerRow = perRowK[i];
      if (kPerRow <= 0) {
        this.rowPtr[i + 1] = idx;
        continue;
      }
      // Reset Set for this row. Clearing is faster than reconstructing.
      seen.clear();
      let count = 0;
      while (count < kPerRow) {
        const j = Math.floor(Math.random() * cols);
        if (noSelfConnect && i === j) continue;
        if (seen.has(j)) continue;
        seen.add(j);
        scratchCols[count++] = j;
      }
      // Sort the kPerRow filled slice of scratchCols. Use subarray +
      // Array.from sort because typed-array sort is numeric ascending
      // by default, which is what we need.
      const sortedCols = scratchCols.subarray(0, kPerRow).slice().sort();
      // Fill final typed arrays for this row.
      for (let k = 0; k < kPerRow; k++) {
        this.colIdx[idx] = sortedCols[k];
        const sign = Math.random() < excitatoryRatio ? 1 : -1;
        this.values[idx] = sign * (0.1 + Math.random() * 0.4) * strength;
        idx++;
      }
      this.rowPtr[i + 1] = idx;
    }
  }

  /**
   * Build from an existing dense matrix (for migration).
   * @param {Float64Array} W — dense row-major matrix (rows × cols)
   * @param {number} threshold — minimum |weight| to keep
   */
  static fromDense(W, rows, cols, threshold = 0.001, opts = {}) {
    const sparse = new SparseMatrix(rows, cols, opts);

    // Count non-zeros
    let nnz = 0;
    for (let i = 0; i < W.length; i++) {
      if (Math.abs(W[i]) > threshold) nnz++;
    }

    sparse.values = new Float64Array(nnz);
    sparse.colIdx = new Uint32Array(nnz);
    sparse.rowPtr = new Uint32Array(rows + 1);
    sparse.nnz = nnz;

    let idx = 0;
    sparse.rowPtr[0] = 0;
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const w = W[i * cols + j];
        if (Math.abs(w) > threshold) {
          sparse.values[idx] = w;
          sparse.colIdx[idx] = j;
          idx++;
        }
      }
      sparse.rowPtr[i + 1] = idx;
    }

    return sparse;
  }

  // ── Propagation ─────────────────────────────────────────────────

  /**
   * Compute post-synaptic currents: I_i = Σ_j W_ij * s_j
   * Only iterates over actual connections — O(nnz) not O(N²).
   *
   * @param {Uint8Array|Float64Array} spikes — pre-synaptic activity
   * @returns {Float64Array} currents — post-synaptic currents
   */
  propagate(spikes) {
    const { rows, values, colIdx, rowPtr } = this;
    // Defensive null-CSR guard. At biological scale some matrices get
    // their CPU CSR arrays freed to save external memory once GPU-bound
    // — calling propagate on such a matrix used to crash with "Cannot
    // read properties of null". Now returns a zero-filled current
    // vector of the correct size. One-shot warn during probe windows
    // (flag set by curriculum gate blocks) so silent GPU-bound falls
    // are visible in the probe log without spamming the main tick.
    if (!values || !colIdx || !rowPtr) {
      if (typeof globalThis !== 'undefined' && globalThis._probeWindowPropagate && !this._nullCsrWarned) {
        this._nullCsrWarned = true;
        const nm = this._name || this.name || '(unnamed)';
        console.warn(`[SparseMatrix] propagate called with null CPU CSR on ${nm} (values=${!!values} colIdx=${!!colIdx} rowPtr=${!!rowPtr}) — returning zeros. Matrix is likely GPU-bound with CPU arrays freed.`);
      }
      return new Float64Array(rows || 0);
    }
    const I = new Float64Array(rows);

    for (let i = 0; i < rows; i++) {
      let sum = 0;
      const start = rowPtr[i];
      const end = rowPtr[i + 1];
      for (let k = start; k < end; k++) {
        sum += values[k] * spikes[colIdx[k]];
      }
      I[i] = sum;
    }
    return I;
  }

  // ── Learning Rules ──────────────────────────────────────────────

  /**
   * Reward-modulated Hebbian: ΔW = η · δ · post · pre
   * Only updates existing connections — O(nnz).
   */
  rewardModulatedUpdate(preSpikes, postSpikes, reward, lr) {
    const factor = lr * reward;
    if (factor === 0) return;

    const { rows, values, colIdx, rowPtr, wMin, wMax } = this;

    for (let i = 0; i < rows; i++) {
      if (!postSpikes[i]) continue;
      const scaled = factor * postSpikes[i];
      const start = rowPtr[i];
      const end = rowPtr[i + 1];
      for (let k = start; k < end; k++) {
        values[k] += scaled * preSpikes[colIdx[k]];
        if (values[k] > wMax) values[k] = wMax;
        else if (values[k] < wMin) values[k] = wMin;
      }
    }
  }

  /**
   * Hebbian: ΔW = η · post · pre
   */
  hebbianUpdate(preSpikes, postSpikes, lr) {
    const { rows, values, colIdx, rowPtr, wMin, wMax } = this;
    // Null-CSR guard — post CPU CSR free this call would crash at
    // `rowPtr[i]` / `values[k]`. Silent no-op keeps teach paths safe
    // when the GPU-fast path owns the weights and a stale CPU write
    // accidentally fires. Same shape as the `normalizeRows` null guard.
    if (!values || !rowPtr || !colIdx) return;

    for (let i = 0; i < rows; i++) {
      if (!postSpikes[i]) continue;
      const scaled = lr * postSpikes[i];
      const start = rowPtr[i];
      const end = rowPtr[i + 1];
      for (let k = start; k < end; k++) {
        values[k] += scaled * preSpikes[colIdx[k]];
        if (values[k] > wMax) values[k] = wMax;
        else if (values[k] < wMin) values[k] = wMin;
      }
    }
  }

  /**
   * Per-row L2 normalization — rescales each row's values so its
   * Euclidean norm hits `targetNorm`. Prevents weight runaway /
   * saturation when many teach phases accumulate Hebbian updates
   * into the same projection without any decay step. Empty rows
   * (nnz=0) and zero-norm rows are left untouched.
   *
   * In-place. Preserves sparsity pattern (rowPtr + colIdx
   * unchanged). Only `values[]` is rewritten.
   *
   * Skipped when the CSR arrays are null (post-T24.a selective
   * CPU CSR free — normalization on those projections happens GPU-
   * side via the shader pipeline, not here).
   */
  normalizeRows(targetNorm = 1.0) {
    const { rows, rowPtr, wMin, wMax } = this;
    const values = this.values;
    if (!values || values.length === 0) return 0;
    const tn = Number.isFinite(targetNorm) && targetNorm > 0 ? targetNorm : 1.0;
    let rowsNormalized = 0;
    for (let i = 0; i < rows; i++) {
      const start = rowPtr[i];
      const end = rowPtr[i + 1];
      if (end <= start) continue;
      let sumSq = 0;
      for (let k = start; k < end; k++) sumSq += values[k] * values[k];
      if (sumSq <= 0) continue;
      const scale = tn / Math.sqrt(sumSq);
      if (scale === 1) continue;
      for (let k = start; k < end; k++) {
        let v = values[k] * scale;
        if (v > wMax) v = wMax;
        else if (v < wMin) v = wMin;
        values[k] = v;
      }
      rowsNormalized += 1;
    }
    return rowsNormalized;
  }

  /**
   * STDP: timing-dependent update on existing connections.
   */
  stdpUpdate(preSpikes, postSpikes, preTimes, postTimes, params) {
    const { aPlus, aMinus, tauPlus, tauMinus } = params;
    const { rows, values, colIdx, rowPtr, wMin, wMax } = this;

    for (let i = 0; i < rows; i++) {
      if (!postSpikes[i]) continue;
      const tPost = postTimes[i];
      const start = rowPtr[i];
      const end = rowPtr[i + 1];

      for (let k = start; k < end; k++) {
        const j = colIdx[k];
        if (!preSpikes[j]) continue;
        const dt = tPost - preTimes[j];
        if (dt > 0) {
          values[k] += aPlus * Math.exp(-dt / tauPlus);
        } else if (dt < 0) {
          values[k] -= aMinus * Math.exp(dt / tauMinus);
        }
        if (values[k] > wMax) values[k] = wMax;
        else if (values[k] < wMin) values[k] = wMin;
      }
    }
  }

  // ── Synaptogenesis & Pruning ────────────────────────────────────

  /**
   * Prune weak connections (|w| < threshold).
   * Rebuilds CSR arrays without the pruned entries.
   *
   * @param {number} threshold — minimum |weight| to keep
   * @returns {number} — number of connections removed
   */
  prune(threshold = 0.01) {
    const { rows, values, colIdx, rowPtr } = this;
    const oldNnz = this.nnz;

    // Count survivors
    let newNnz = 0;
    for (let k = 0; k < this.nnz; k++) {
      if (Math.abs(values[k]) >= threshold) newNnz++;
    }

    if (newNnz === oldNnz) return 0; // nothing to prune

    const newValues = new Float64Array(newNnz);
    const newColIdx = new Uint32Array(newNnz);
    const newRowPtr = new Uint32Array(rows + 1);

    let idx = 0;
    newRowPtr[0] = 0;
    for (let i = 0; i < rows; i++) {
      const start = rowPtr[i];
      const end = rowPtr[i + 1];
      for (let k = start; k < end; k++) {
        if (Math.abs(values[k]) >= threshold) {
          newValues[idx] = values[k];
          newColIdx[idx] = colIdx[k];
          idx++;
        }
      }
      newRowPtr[i + 1] = idx;
    }

    this.values = newValues;
    this.colIdx = newColIdx;
    this.rowPtr = newRowPtr;
    this.nnz = newNnz;

    return oldNnz - newNnz;
  }

  /**
   * Synaptogenesis — grow new connections where pre and post fire together.
   * New connections form probabilistically when co-active neurons lack a synapse.
   *
   * @param {Uint8Array} preSpikes
   * @param {Uint8Array} postSpikes
   * @param {number} probability — chance of forming new synapse per co-active pair
   * @param {number} initialWeight — weight of new synapse
   * @param {number} maxNnz — cap total connections (prevent runaway growth)
   * @returns {number} — number of new connections formed
   */
  grow(preSpikes, postSpikes, probability = 0.001, initialWeight = 0.1, maxNnz = Infinity) {
    if (this.nnz >= maxNnz) return 0;

    const { rows, cols } = this;
    const noSelfConnect = (rows === cols);

    // Find co-active pairs that don't have a connection
    const newEntries = []; // [row, col, weight]

    for (let i = 0; i < rows; i++) {
      if (!postSpikes[i]) continue;
      // Build set of existing connections for this row
      const existing = new Set();
      const start = this.rowPtr[i];
      const end = this.rowPtr[i + 1];
      for (let k = start; k < end; k++) {
        existing.add(this.colIdx[k]);
      }

      for (let j = 0; j < cols; j++) {
        if (noSelfConnect && i === j) continue;
        if (!preSpikes[j]) continue;
        if (existing.has(j)) continue; // already connected
        if (Math.random() < probability) {
          newEntries.push([i, j, initialWeight]);
          if (this.nnz + newEntries.length >= maxNnz) break;
        }
      }
      if (this.nnz + newEntries.length >= maxNnz) break;
    }

    if (newEntries.length === 0) return 0;

    // Rebuild CSR with new entries merged in
    const totalNnz = this.nnz + newEntries.length;
    const newValues = new Float64Array(totalNnz);
    const newColIdx = new Uint32Array(totalNnz);
    const newRowPtr = new Uint32Array(rows + 1);

    // Sort new entries by row
    newEntries.sort((a, b) => a[0] - b[0]);

    let idx = 0;
    let newIdx = 0;
    newRowPtr[0] = 0;

    for (let i = 0; i < rows; i++) {
      // Copy existing entries for this row
      const start = this.rowPtr[i];
      const end = this.rowPtr[i + 1];
      for (let k = start; k < end; k++) {
        newValues[idx] = this.values[k];
        newColIdx[idx] = this.colIdx[k];
        idx++;
      }
      // Add new entries for this row
      while (newIdx < newEntries.length && newEntries[newIdx][0] === i) {
        newValues[idx] = newEntries[newIdx][2];
        newColIdx[idx] = newEntries[newIdx][1];
        idx++;
        newIdx++;
      }
      newRowPtr[i + 1] = idx;
    }

    this.values = newValues;
    this.colIdx = newColIdx;
    this.rowPtr = newRowPtr;
    this.nnz = totalNnz;

    return newEntries.length;
  }

  // ── Serialization ───────────────────────────────────────────────

  /**
   * Serialize to a compact format for persistence.
   * @returns {object} — { rows, cols, nnz, values, colIdx, rowPtr }
   */
  serialize() {
    return {
      rows: this.rows,
      cols: this.cols,
      nnz: this.nnz,
      values: Array.from(this.values),
      colIdx: Array.from(this.colIdx),
      rowPtr: Array.from(this.rowPtr),
    };
  }

  /**
   * Deserialize from saved format.
   * @param {object} data
   * @returns {SparseMatrix}
   */
  static deserialize(data, opts = {}) {
    const m = new SparseMatrix(data.rows, data.cols, opts);
    m.values = new Float64Array(data.values);
    m.colIdx = new Uint32Array(data.colIdx);
    m.rowPtr = new Uint32Array(data.rowPtr);
    m.nnz = data.nnz;
    return m;
  }

  // ── Compatibility ───────────────────────────────────────────────

  /**
   * Get the dense weight matrix (for visualization/debugging).
   * WARNING: O(N²) memory — only use for small matrices or debugging.
   */
  toDense() {
    const { rows, cols, values, colIdx, rowPtr } = this;
    const W = new Float64Array(rows * cols);
    for (let i = 0; i < rows; i++) {
      const start = rowPtr[i];
      const end = rowPtr[i + 1];
      for (let k = start; k < end; k++) {
        W[i * cols + colIdx[k]] = values[k];
      }
    }
    return W;
  }

  /**
   * Get memory usage in bytes.
   */
  get memoryBytes() {
    return this.values.byteLength + this.colIdx.byteLength + this.rowPtr.byteLength;
  }

  /**
   * Get density (fraction of non-zero entries).
   */
  get density() {
    return this.nnz / (this.rows * this.cols);
  }

  /**
   * Get stats string for logging.
   */
  stats() {
    const dense = this.rows * this.cols * 8; // Float64Array bytes
    const sparse = this.memoryBytes;
    const ratio = dense / sparse;
    return `${this.rows}×${this.cols} | ${this.nnz} connections (${(this.density*100).toFixed(1)}%) | ${(sparse/1024).toFixed(1)}KB sparse vs ${(dense/1024).toFixed(1)}KB dense (${ratio.toFixed(1)}× reduction)`;
  }
}
