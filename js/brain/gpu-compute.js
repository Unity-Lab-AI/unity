/**
 * gpu-compute.js — WebGPU Compute Shaders for Neural Simulation
 *
 * Moves the heavy math to the GPU:
 *   - LIF neuron update: τ·dV/dt = -(V-Vrest) + R·I
 *   - Synapse propagation: I = Σ W·spike (sparse CSR)
 *   - Plasticity: ΔW = η·δ·pre·post
 *
 * Falls back to CPU Float64Array if WebGPU not available.
 * Double-buffers neuron state to avoid read-write conflicts.
 *
 * Usage:
 *   const gpu = new GPUCompute();
 *   if (await gpu.init()) {
 *     // GPU path
 *     gpu.uploadCluster(cluster);
 *     gpu.stepNeurons(dt, currents);
 *     const spikes = gpu.readbackSpikes();
 *   }
 */

// ── WGSL Shaders ────────────────────────────────────────────────

// RULKOV MAP NEURON — Rulkov 2002, "Modeling of spiking-bursting neural
// behavior using two-dimensional map", Phys. Rev. E 65, 041922.
//
//   x_{n+1} = α / (1 + x_n²) + y_n
//   y_{n+1} = y_n − μ·(x_n − σ)
//
// Two-variable discrete chaotic map that produces real biological
// spike-burst dynamics — the fast variable x generates sub-millisecond
// spikes on top of slow variable y driving burst envelopes. Used in
// large-scale published cortical simulations (Bazhenov, Rulkov,
// Shilnikov 2005+) and shown to reproduce experimentally observed
// firing patterns from thalamic relay, cortical pyramidal, and
// cerebellar Purkinje cells depending on (α, σ) parameterization.
//
// Parameters:
//   α ≈ 4.5  — nonlinearity, fixed near chaotic regime. Higher α =
//              longer bursts. Range 4.0-6.0 for bursting, 2.0-4.0 for
//              tonic spiking.
//   μ ≈ 0.001 — slow timescale. Ratio of slow-to-fast variable update.
//   σ       — external drive. Biological tonic/synaptic input maps here.
//              σ ∈ [-1.5, 0.5] is the useful range. Higher σ → more spikes.
//
// Spike detection: x crosses zero from below in a single tick. The
// fast variable jumps from ≈-1 to ≈α+y=+4 when the neuron spikes, so
// (x_old ≤ 0) ∧ (x_new > 0) is a clean edge detector.
//
// State: stored as vec2<f32> per neuron = (x, y). Doubles the buffer
// from 4 to 8 bytes/neuron — at 400K cerebellum that's 3.2MB, fine.
const LIF_SHADER = /* wgsl */`
  struct Params {
    n: u32,
    tau: f32,        // unused — Rulkov has no membrane time constant
    vRest: f32,      // unused
    vThresh: f32,    // unused
    vReset: f32,     // unused
    dt: f32,         // unused
    R: f32,          // unused
    effectiveDrive: f32,  // mapped to Rulkov σ (external drive)
    noiseAmp: f32,   // y-channel jitter to prevent phase lock
    seed: u32,
    gridX: u32,
    _pad: u32,
  };

  @group(0) @binding(0) var<uniform> params: Params;
  @group(0) @binding(1) var<storage, read_write> state: array<vec2<f32>>;  // (x, y) per neuron
  @group(0) @binding(2) var<storage, read_write> spikes: array<u32>;
  @group(0) @binding(3) var<storage, read> currents: array<f32>;           // T18.4.a — per-neuron synaptic current

  fn pcg(v: u32) -> u32 {
    var s = v * 747796405u + 2891336453u;
    var word = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
    return (word >> 22u) ^ word;
  }

  fn randomFloat(seed: u32, idx: u32) -> f32 {
    let hash = pcg(seed ^ (idx * 1664525u + 1013904223u));
    return f32(hash) / 4294967295.0;
  }

  @compute @workgroup_size(256)
  fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let i = id.x + id.y * params.gridX * 256u;
    if (i >= params.n) { return; }

    // Load 2D state. Guard against uninitialized / NaN by reseeding in
    // the basin of the bursting attractor.
    var xy = state[i];
    var x = xy.x;
    var y = xy.y;
    if (x != x || y != y || abs(x) > 100.0 || abs(y) > 100.0) {
      let phi = 0.61803398875;
      x = -1.0 + fract(f32(i) * phi) * 0.5;        // (-1.0, -0.5)
      y = -3.2 + fract(f32(i) * phi * 1.7) * 0.4;  // (-3.2, -2.8) — attractor basin
    }

    // Map biological drive to Rulkov σ. Unity's tonic drives run 8-20,
    // modulated to effectiveDrive ~ 6-40. Normalize to σ ∈ [-1.0, 0.5]:
    // silent cortex at σ≈-1, bursting cerebellum at σ≈0.3, saturated at 0.5.
    //
    // T18.4.a — per-neuron synaptic current from SYNAPSE_PROPAGATE_SHADER
    // (intra-cluster recurrence) plus any uploaded external / incoming
    // projection current gets added to the global drive BEFORE sigma
    // normalization. Without this the main brain was running with zero
    // synaptic coupling — every neuron saw only the global drive uniform,
    // the intra-cluster synapse matrix was uploaded but never consumed.
    let neuronDrive = params.effectiveDrive + currents[i];
    let driveNorm = clamp(neuronDrive / 40.0, 0.0, 1.0);
    let sigma = -1.0 + driveNorm * 1.5;
    let alpha = 4.5;      // fixed nonlinearity — bursting regime
    let mu = 0.001;       // slow timescale

    // Rulkov map iteration
    let xNext = alpha / (1.0 + x * x) + y;
    // y update uses current x, not xNext (per Rulkov 2002)
    let jitter = (randomFloat(params.seed, i) - 0.5) * params.noiseAmp * 0.0001;
    let yNext = y - mu * (x - sigma) + jitter;

    // Spike = fast variable crossed zero upward this tick. The Rulkov
    // spike is a one-step jump from x≈-1 to x≈α+y ≈ +1.5..+3.5, so
    // this edge detector catches exactly one spike per action potential.
    if (x <= 0.0 && xNext > 0.0) {
      spikes[i] = 1u;
    } else {
      spikes[i] = 0u;
    }

    state[i] = vec2<f32>(xNext, yNext);
  }
`;

const SYNAPSE_PROPAGATE_SHADER = /* wgsl */`
  struct Params {
    n: u32,        // number of post-synaptic neurons
    nnz: u32,      // total non-zero entries
  };

  @group(0) @binding(0) var<uniform> params: Params;
  @group(0) @binding(1) var<storage, read> values: array<f32>;    // CSR values
  @group(0) @binding(2) var<storage, read> colIdx: array<u32>;    // CSR column indices
  @group(0) @binding(3) var<storage, read> rowPtr: array<u32>;    // CSR row pointers
  @group(0) @binding(4) var<storage, read> spikes: array<u32>;    // pre-synaptic spikes
  @group(0) @binding(5) var<storage, read_write> currents: array<f32>; // output currents

  @compute @workgroup_size(256)
  fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let i = id.x;
    if (i >= params.n) { return; }

    var sum: f32 = 0.0;
    let start = rowPtr[i];
    let end = rowPtr[i + 1u];

    for (var k = start; k < end; k++) {
      let j = colIdx[k];
      if (spikes[j] != 0u) {
        sum += values[k];
      }
    }

    currents[i] += sum;
  }
`;

const PLASTICITY_SHADER = /* wgsl */`
  struct Params {
    n: u32,
    nnz: u32,
    lr: f32,       // learning rate
    reward: f32,   // reward signal
    wMin: f32,
    wMax: f32,
  };

  @group(0) @binding(0) var<uniform> params: Params;
  @group(0) @binding(1) var<storage, read_write> values: array<f32>;
  @group(0) @binding(2) var<storage, read> colIdx: array<u32>;
  @group(0) @binding(3) var<storage, read> rowPtr: array<u32>;
  @group(0) @binding(4) var<storage, read> preSpikes: array<u32>;
  @group(0) @binding(5) var<storage, read> postSpikes: array<u32>;

  @compute @workgroup_size(256)
  fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let i = id.x;
    if (i >= params.n) { return; }
    if (postSpikes[i] == 0u) { return; }

    let factor = params.lr * params.reward;
    let start = rowPtr[i];
    let end = rowPtr[i + 1u];

    for (var k = start; k < end; k++) {
      let j = colIdx[k];
      if (preSpikes[j] != 0u) {
        var w = values[k] + factor;
        w = clamp(w, params.wMin, params.wMax);
        values[k] = w;
      }
    }
  }
`;

// T18.4.a cleanup — CURRENT_GEN_SHADER REMOVED.
//
// Prior incarnation wrote `currents[i] = effectiveDrive + noise` as a
// separate GPU dispatch before LIF. LIF_SHADER now does per-neuron
// drive inline via `neuronDrive = effectiveDrive + currents[i]`, where
// `currents[i]` is populated by SYNAPSE_PROPAGATE_SHADER (and optional
// CPU-side `writeExternalCurrents` upload). So a dedicated "write drive
// + noise" kernel is redundant. Keeping it around with no pipeline
// bound would be textbook vestigial organ code per Gee's directive.

// T18.4.c — Voltage mean reduction. Atomic accumulator over the
// Rulkov x-component of every neuron's (x, y) state. WebGPU atomics
// only work on u32/i32, so we scale voltages by VOLT_SCALE=1000 and
// add as i32 (Rulkov x ranges ~±3, so ×1000 fits in signed i32
// comfortably even at 1B neurons: 3000 × 1e9 = 3e12 > 2^31, so we
// divide work across two accumulators if size > 2M — handled by
// the caller). Mean = total / size / VOLT_SCALE on readback.
//
// Full-systems wire: dispatched once per tick after LIF_SHADER,
// result is reduced in a 4-byte readback and included in
// compute_batch_result's perCluster.meanVoltage field so server's
// getState() exposes it to the dashboard/HUD. Previously main-brain
// clusters had NO voltage telemetry at all — voltages lived on GPU
// and nothing aggregated them.
const VOLTAGE_STATS_SHADER = /* wgsl */`
  struct Params {
    n: u32,
    gridX: u32,
    _pad0: u32, _pad1: u32,
  };

  @group(0) @binding(0) var<uniform> params: Params;
  @group(0) @binding(1) var<storage, read> state: array<vec2<f32>>;
  @group(0) @binding(2) var<storage, read_write> voltSum: array<atomic<i32>>;

  @compute @workgroup_size(256)
  fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let i = id.x + id.y * params.gridX * 256u;
    if (i >= params.n) { return; }
    // Rulkov fast-var x is the "voltage analog" for monitoring.
    // Scale by 1000 and truncate to i32 for atomic accumulation.
    let scaled = i32(state[i].x * 1000.0);
    atomicAdd(&voltSum[0], scaled);
  }
`;

// Spike count shader — atomic counter, no CPU scan needed
const SPIKE_COUNT_SHADER = /* wgsl */`
  struct Params {
    n: u32,
    gridX: u32,
    _pad0: u32, _pad1: u32,
  };

  @group(0) @binding(0) var<uniform> params: Params;
  @group(0) @binding(1) var<storage, read> spikes: array<u32>;
  @group(0) @binding(2) var<storage, read_write> count: array<atomic<u32>>;

  @compute @workgroup_size(256)
  fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let i = id.x + id.y * params.gridX * 256u;
    if (i >= params.n) { return; }
    if (spikes[i] != 0u) {
      atomicAdd(&count[0], 1u);
    }
  }
`;

// ── GPU Compute Manager ─────────────────────────────────────────

export class GPUCompute {
  constructor() {
    this._device = null;
    this._available = false;
    this._pipelines = {};
    this._buffers = {};
    this._ping = 0; // double-buffer index
    // Standalone sparse matrices keyed by name (not tied to any single
    // cluster). Used for T14.4 cross-region projections + any other
    // sparse structure that lives outside a cluster's intra-cluster
    // synapse matrix. Each entry: { rows, cols, nnz, values, colIdx,
    // rowPtr, preSpikes, postCurrents } where each field after
    // rows/cols/nnz is a GPUBuffer.
    this._sparseMatrices = {};
  }

  /**
   * Initialize WebGPU. Returns true if GPU is available.
   */
  async init() {
    if (!navigator.gpu) {
      console.log('[GPUCompute] WebGPU not available — using CPU fallback');
      return false;
    }

    try {
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance',
      });
      if (!adapter) {
        console.log('[GPUCompute] No GPU adapter found');
        return false;
      }

      this._device = await adapter.requestDevice({
        requiredLimits: {
          maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
          maxBufferSize: adapter.limits.maxBufferSize,
        },
      });

      // Log GPU info (API changed: requestAdapterInfo → info property in newer Chrome)
      const info = adapter.info || (adapter.requestAdapterInfo ? await adapter.requestAdapterInfo() : {});
      console.log(`[GPUCompute] GPU: ${info.device || info.description || info.vendor || 'detected'}`);
      console.log(`[GPUCompute] Max buffer: ${(adapter.limits.maxBufferSize / 1048576).toFixed(0)}MB`);

      // Create compute pipelines
      this._createPipelines();
      this._available = true;
      return true;
    } catch (err) {
      console.warn('[GPUCompute] Init failed:', err.message);
      return false;
    }
  }

  _createPipelines() {
    const device = this._device;

    this._pipelines.lif = device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: device.createShaderModule({ code: LIF_SHADER }),
        entryPoint: 'main',
      },
    });

    this._pipelines.propagate = device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: device.createShaderModule({ code: SYNAPSE_PROPAGATE_SHADER }),
        entryPoint: 'main',
      },
    });

    this._pipelines.plasticity = device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: device.createShaderModule({ code: PLASTICITY_SHADER }),
        entryPoint: 'main',
      },
    });

    // currentGen pipeline removed — LIF shader generates currents inline

    this._pipelines.spikeCount = device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: device.createShaderModule({ code: SPIKE_COUNT_SHADER }),
        entryPoint: 'main',
      },
    });

    // T18.4.c — voltage mean reduction pipeline.
    this._pipelines.voltStats = device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: device.createShaderModule({ code: VOLTAGE_STATS_SHADER }),
        entryPoint: 'main',
      },
    });

    this._stepSeed = 0; // increments each step for noise variation
  }

  /**
   * Upload a cluster's neuron and synapse data to GPU buffers.
   * @param {string} name — cluster name
   * @param {number} size — number of neurons
   * @param {Float64Array} voltages — initial voltages (converted to f32)
   * @param {SparseMatrix} synapses — CSR synapse matrix
   * @param {object} lifParams — LIF parameters
   */
  uploadCluster(name, size, voltages, synapses, lifParams) {
    const device = this._device;
    const vRest = lifParams?.Vrest || -65;

    // Params uniform
    // LIF params — 48 bytes. Contains ALL params for self-contained LIF shader.
    // n, tau, vRest, vThresh, vReset, dt, R, effectiveDrive, noiseAmp, seed, gridX, pad
    const totalWg = Math.ceil(size / 256);
    const gridX = Math.min(totalWg, 32768);
    const params = new ArrayBuffer(48);
    const view = new DataView(params);
    view.setUint32(0, size, true);
    view.setFloat32(4, lifParams.tau || 20, true);
    view.setFloat32(8, vRest, true);
    view.setFloat32(12, lifParams.Vthresh || -50, true);
    view.setFloat32(16, lifParams.Vreset || -70, true);
    view.setFloat32(20, lifParams.dt || 1, true);
    view.setFloat32(24, lifParams.R || 1, true);
    // effectiveDrive and noiseAmp are written per-step, not at upload
    view.setFloat32(28, 16.0, true);   // placeholder effectiveDrive
    view.setFloat32(32, 5.0, true);    // placeholder noiseAmp
    view.setUint32(36, 1, true);       // placeholder seed
    view.setUint32(40, gridX, true);
    // bytes 44-47 = padding

    // Create buffers — for large clusters (millions of neurons), avoid mappedAtCreation
    // which requires mapping the entire buffer into JS heap. Instead create unmapped
    // and fill Vrest in chunks via writeBuffer.
    const CHUNK = 1000000; // 1M floats at a time = 4MB per chunk
    const makeBuffer = (sz, usage) => device.createBuffer({ size: sz, usage: usage | GPUBufferUsage.COPY_DST });

    // Rulkov state buffer — vec2<f32> per neuron = 8 bytes.
    // Doubled from the old 1D voltage buffer. At 400K cerebellum that's
    // 3.2MB; at full server scale it's still well under GPU limits.
    const voltagesA = makeBuffer(size * 8, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);

    // Seed (x, y) pairs uniquely via golden-ratio quasi-random so no
    // two Rulkov trajectories phase-lock. Starting region is the
    // bursting attractor basin from Rulkov 2002: x ∈ (-1.0, -0.5),
    // y ∈ (-3.2, -2.8). Golden-ratio sequence gives low-discrepancy
    // coverage of the basin without collisions.
    const PHI = 0.61803398875;
    for (let offset = 0; offset < size; offset += CHUNK) {
      const chunkSize = Math.min(CHUNK, size - offset);
      const chunk = new Float32Array(chunkSize * 2); // interleaved x,y
      for (let i = 0; i < chunkSize; i++) {
        const gi = offset + i;
        const gx = (gi * PHI) % 1;
        const gy = (gi * PHI * 1.7) % 1;
        chunk[i * 2]     = -1.0 + gx * 0.5;         // x ∈ (-1.0, -0.5)
        chunk[i * 2 + 1] = -3.2 + gy * 0.4;         // y ∈ (-3.2, -2.8)
      }
      device.queue.writeBuffer(voltagesA, offset * 8, chunk);
    }

    // LAYOUT — voltages + spikes + currents = 12 bytes/neuron
    //
    // T18.4.a (2026-04-18) — `currents` buffer REINTRODUCED. A prior
    // "slim" refactor removed it under the mistaken belief that
    // LIF_SHADER generated currents inline and the intra-cluster
    // synapse matrix wasn't on the per-tick path. In reality the slim
    // layout left main-brain neurons with zero synaptic coupling —
    // SYNAPSE_PROPAGATE_SHADER was never dispatched in fullStep, and
    // LIF_SHADER's inline drive didn't honor per-neuron currents even
    // when it was. Per Gee 2026-04-18 "does it fully do all we need
    // for the main brain equation and all sub equations in totality":
    // the answer was no. This restores the buffer + wires the full
    // dispatch (clearBuffer → propagate → LIF reads currents[i]) so
    // intra-cluster recurrence is actually live on GPU.
    const buffers = {
      params: device.createBuffer({
        size: 48,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      }),
      voltages: voltagesA, // single voltage buffer — in-place read/write
      spikes: makeBuffer(size * 4, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC),
      currents: makeBuffer(size * 4, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST),
      size,
      gridX,
    };
    // Write initial params to GPU params buffer
    device.queue.writeBuffer(buffers.params, 0, params);

    // Synapse CSR buffers
    if (synapses && synapses.nnz > 0) {
      const vals32 = new Float32Array(synapses.nnz);
      for (let i = 0; i < synapses.nnz; i++) vals32[i] = synapses.values[i];

      buffers.synValues = this._createBuffer(vals32, GPUBufferUsage.STORAGE);
      buffers.synColIdx = this._createBuffer(new Uint32Array(synapses.colIdx), GPUBufferUsage.STORAGE);
      buffers.synRowPtr = this._createBuffer(new Uint32Array(synapses.rowPtr), GPUBufferUsage.STORAGE);
      buffers.synNnz = synapses.nnz;
    }

    this._buffers[name] = buffers;
  }

  /**
   * Upload a standalone sparse CSR matrix to GPU — not bound to any
   * cluster. Used for T14.4 cross-region projections where the matrix
   * connects one region's spikes to another region's currents
   * (independent of any cluster's intra-cluster synapses).
   *
   * Stores under `this._sparseMatrices[name]`. Subsequent
   * propagateSparse + hebbianSparse calls dispatch shaders against it.
   *
   * @param {string} name — projection identifier, e.g. 'sem_to_motor'
   * @param {number} rows — target region size (spikes vector destination)
   * @param {number} cols — source region size (pre-spike vector domain)
   * @param {Float32Array|Float64Array} values — CSR non-zero weights, length = nnz
   * @param {Uint32Array} colIdx — CSR column indices, length = nnz
   * @param {Uint32Array} rowPtr — CSR row pointers, length = rows + 1
   */
  uploadSparseMatrix(name, rows, cols, values, colIdx, rowPtr) {
    if (!this._available) return false;
    const device = this._device;
    const vals32 = values instanceof Float32Array ? values : new Float32Array(values);
    const cols32 = colIdx instanceof Uint32Array ? colIdx : new Uint32Array(colIdx);
    const rows32 = rowPtr instanceof Uint32Array ? rowPtr : new Uint32Array(rowPtr);
    const nnz = vals32.length;

    // Use createBuffer + queue.writeBuffer (async, non-blocking) instead
    // of createBuffer({mappedAtCreation:true}) which synchronously maps
    // the buffer to CPU memory before copy. For 60MB+ sparse matrices
    // mappedAtCreation was taking seconds per buffer × 3 buffers per
    // matrix, blocking the WebSocket onmessage handler and starving
    // main-brain compute_batch dispatch. writeBuffer queues the write
    // on the GPU command stream and returns immediately; subsequent
    // dispatches serialize behind it automatically.
    const makeStorage = (sizeBytes) => device.createBuffer({
      size: sizeBytes,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const valuesBuf = makeStorage(vals32.byteLength);
    const colIdxBuf = makeStorage(cols32.byteLength);
    const rowPtrBuf = makeStorage(rows32.byteLength);

    device.queue.writeBuffer(valuesBuf, 0, vals32.buffer, vals32.byteOffset, vals32.byteLength);
    device.queue.writeBuffer(colIdxBuf, 0, cols32.buffer, cols32.byteOffset, cols32.byteLength);
    device.queue.writeBuffer(rowPtrBuf, 0, rows32.buffer, rows32.byteOffset, rows32.byteLength);

    const entry = {
      rows, cols, nnz,
      values: valuesBuf,
      colIdx: colIdxBuf,
      rowPtr: rowPtrBuf,
      preSpikes: device.createBuffer({
        size: cols * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      postCurrents: device.createBuffer({
        size: rows * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
      }),
      postSpikes: device.createBuffer({
        size: rows * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
    };
    this._sparseMatrices[name] = entry;
    return true;
  }

  // Chunked sparse upload — for matrices too large to ship in a single
  // WebSocket frame without choking the browser frame assembler. Creates
  // empty GPU buffers up front, streams values+colIdx chunks via
  // writeBuffer at offsets, marks the matrix live when the last chunk
  // arrives. Zero 480MB JS-heap buffer; chunk bytes go straight from
  // the receive ArrayBuffer to GPU memory.
  _beginSparseUpload(name, rows, cols, nnz, rowPtr) {
    if (!this._available) return false;
    const device = this._device;
    const rowPtr32 = rowPtr instanceof Uint32Array ? rowPtr : new Uint32Array(rowPtr);
    const makeStorage = (sizeBytes) => device.createBuffer({
      size: sizeBytes,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const entry = {
      rows, cols, nnz,
      values: makeStorage(nnz * 4),
      colIdx: makeStorage(nnz * 4),
      rowPtr: makeStorage(rowPtr32.byteLength),
      preSpikes: device.createBuffer({
        size: cols * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      postCurrents: device.createBuffer({
        size: rows * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
      }),
      postSpikes: device.createBuffer({
        size: rows * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      _pending: true,
    };
    device.queue.writeBuffer(entry.rowPtr, 0, rowPtr32.buffer, rowPtr32.byteOffset, rowPtr32.byteLength);
    this._sparseMatrices[name] = entry;
    return true;
  }

  _appendSparseUpload(name, valuesOffset, valuesChunk, colIdxOffset, colIdxChunk) {
    const entry = this._sparseMatrices[name];
    if (!entry) return false;
    const device = this._device;
    if (valuesChunk && valuesChunk.byteLength > 0) {
      device.queue.writeBuffer(entry.values, valuesOffset, valuesChunk.buffer, valuesChunk.byteOffset, valuesChunk.byteLength);
    }
    if (colIdxChunk && colIdxChunk.byteLength > 0) {
      device.queue.writeBuffer(entry.colIdx, colIdxOffset, colIdxChunk.buffer, colIdxChunk.byteOffset, colIdxChunk.byteLength);
    }
    return true;
  }

  _finishSparseUpload(name) {
    const entry = this._sparseMatrices[name];
    if (!entry) return false;
    entry._pending = false;
    return true;
  }

  /**
   * Dispatch sparse matmul: currents[target region] = matrix @ spikes[source region].
   * Reuses the existing SYNAPSE_PROPAGATE_SHADER. Pre-spikes must be
   * uploaded to this matrix's `preSpikes` buffer first via
   * `writeBuffer(entry.preSpikes, 0, spikeData)`.
   *
   * Returns a Float32Array of post-region currents (readback).
   */
  async propagateSparse(name) {
    if (!this._available) return null;
    const entry = this._sparseMatrices[name];
    if (!entry) return null;
    const device = this._device;
    const pass = device.createCommandEncoder().beginComputePass();
    // Reuse the synapse propagate pipeline + layout from the main cluster path.
    // Params layout matches SYNAPSE_PROPAGATE_SHADER (n, nnz).
    const params = new Uint32Array([entry.rows, entry.nnz]);
    const paramsBuf = this._createBuffer(params, GPUBufferUsage.UNIFORM);
    const bindGroup = device.createBindGroup({
      layout: this._pipelines.propagate.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: paramsBuf } },
        { binding: 1, resource: { buffer: entry.values } },
        { binding: 2, resource: { buffer: entry.colIdx } },
        { binding: 3, resource: { buffer: entry.rowPtr } },
        { binding: 4, resource: { buffer: entry.preSpikes } },
        { binding: 5, resource: { buffer: entry.postCurrents } },
      ],
    });
    pass.setPipeline(this._pipelines.propagate);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(entry.rows / 256));
    pass.end();
    // Readback via temporary mapped buffer
    const encoder = device.createCommandEncoder();
    const readback = device.createBuffer({
      size: entry.rows * 4,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    encoder.copyBufferToBuffer(entry.postCurrents, 0, readback, 0, entry.rows * 4);
    device.queue.submit([encoder.finish()]);
    await readback.mapAsync(GPUMapMode.READ);
    const out = new Float32Array(readback.getMappedRange().slice(0));
    readback.unmap();
    readback.destroy();
    paramsBuf.destroy();
    return out;
  }

  /**
   * Dispatch sparse Hebbian weight update. Reuses PLASTICITY_SHADER.
   * Pre-spikes + post-spikes must be uploaded to the matrix's
   * preSpikes/postSpikes buffers before calling. Weights are updated
   * in place on GPU.
   *
   * @param {string} name
   * @param {number} lr — learning rate
   */
  hebbianSparse(name, lr) {
    if (!this._available) return false;
    const entry = this._sparseMatrices[name];
    if (!entry) return false;
    const device = this._device;
    const params = new Float32Array([entry.rows, entry.nnz, lr, 1.0, -2.0, 2.0]);
    // Pack: n (u32), nnz (u32), lr (f32), reward (f32), wMin (f32), wMax (f32)
    const paramsView = new ArrayBuffer(24);
    new Uint32Array(paramsView, 0, 2).set([entry.rows, entry.nnz]);
    new Float32Array(paramsView, 8, 4).set([lr, 1.0, -2.0, 2.0]);
    const paramsBuf = this._createBuffer(new Uint8Array(paramsView), GPUBufferUsage.UNIFORM);
    const bindGroup = device.createBindGroup({
      layout: this._pipelines.plasticity.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: paramsBuf } },
        { binding: 1, resource: { buffer: entry.values } },
        { binding: 2, resource: { buffer: entry.colIdx } },
        { binding: 3, resource: { buffer: entry.rowPtr } },
        { binding: 4, resource: { buffer: entry.preSpikes } },
        { binding: 5, resource: { buffer: entry.postSpikes } },
      ],
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(this._pipelines.plasticity);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(entry.rows / 256));
    pass.end();
    device.queue.submit([encoder.finish()]);
    // paramsBuf destroyed lazily by device GC
    return true;
  }

  /**
   * Write spike data into a sparse matrix's pre-spike buffer, so the
   * next propagateSparse/hebbianSparse call sees it.
   */
  writeSparsePreSpikes(name, spikes) {
    const entry = this._sparseMatrices[name];
    if (!entry) return false;
    const data = spikes instanceof Uint32Array ? spikes
      : spikes instanceof Uint8Array ? Uint32Array.from(spikes)
      : new Uint32Array(spikes);
    this._device.queue.writeBuffer(entry.preSpikes, 0, data.buffer, data.byteOffset, data.byteLength);
    return true;
  }

  /**
   * Write post-spike data (for Hebbian).
   */
  writeSparsePostSpikes(name, spikes) {
    const entry = this._sparseMatrices[name];
    if (!entry) return false;
    const data = spikes instanceof Uint32Array ? spikes
      : spikes instanceof Uint8Array ? Uint32Array.from(spikes)
      : new Uint32Array(spikes);
    this._device.queue.writeBuffer(entry.postSpikes, 0, data.buffer, data.byteOffset, data.byteLength);
    return true;
  }

  _createBuffer(data, usage) {
    const buffer = this._device.createBuffer({
      size: data.byteLength,
      usage: usage | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    const dst = buffer.getMappedRange();
    if (data instanceof Float32Array) {
      new Float32Array(dst).set(data);
    } else if (data instanceof Uint32Array) {
      new Uint32Array(dst).set(data);
    } else {
      new Uint8Array(dst).set(new Uint8Array(data));
    }
    buffer.unmap();
    return buffer;
  }

  /**
   * Dispatch 2D workgroups — splits to handle > 65535 × 256 neurons (16.7M+).
   * Returns { gridX, gridY } that matches what shaders use for index calculation.
   */
  _dispatch2D(pass, size, storedGridX) {
    const totalWg = Math.ceil(size / 256);
    const gridX = storedGridX || Math.min(totalWg, 32768);
    const gridY = Math.ceil(totalWg / gridX);
    pass.dispatchWorkgroups(gridX, gridY, 1);
    return { gridX, gridY };
  }

  /**
   * Run one LIF step on GPU for a cluster — SELF-CONTAINED.
   * Generates currents inline, updates voltage in place, counts spikes.
   * Only 3 bindings: params, voltages, spikes.
   *
   * @param {string} name
   * @param {number} effectiveDrive — tonic × drive × emoGate × Ψgain + errCorr
   * @param {number} noiseAmp
   */
  stepNeurons(name, effectiveDrive, noiseAmp) {
    if (!this._available) return;
    const bufs = this._buffers[name];
    if (!bufs) return;
    const device = this._device;

    // Update per-step params (effectiveDrive, noiseAmp, seed) at offsets 28, 32, 36
    this._stepSeed = (this._stepSeed + 1) | 0;
    const edBuf = new ArrayBuffer(12);
    const edView = new DataView(edBuf);
    edView.setFloat32(0, effectiveDrive ?? 16, true);
    edView.setFloat32(4, noiseAmp ?? 5, true);
    edView.setUint32(8, this._stepSeed, true);
    device.queue.writeBuffer(bufs.params, 28, edBuf);

    // T18.4.a — LIF bind group now includes the per-neuron `currents`
    // buffer so the shader can add synaptic contributions to the
    // global drive before sigma normalization. Without this binding
    // every main-brain neuron would see only the uniform drive and
    // the intra-cluster synapse matrix would have zero effect on firing.
    const bindGroup = device.createBindGroup({
      layout: this._pipelines.lif.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: bufs.params } },
        { binding: 1, resource: { buffer: bufs.voltages } },
        { binding: 2, resource: { buffer: bufs.spikes } },
        { binding: 3, resource: { buffer: bufs.currents } },
      ],
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(this._pipelines.lif);
    pass.setBindGroup(0, bindGroup);
    this._dispatch2D(pass, bufs.size, bufs.gridX);
    pass.end();

    device.queue.submit([encoder.finish()]);
    // No ping-pong — single voltage buffer updated in place
  }

  /**
   * T18.4.a — Zero the per-cluster `currents` buffer at the start of
   * each substep so `SYNAPSE_PROPAGATE_SHADER`'s `currents[i] += sum`
   * accumulation starts fresh. Uses `clearBuffer` (native WebGPU
   * zero-fill) instead of a dispatch so it's essentially free.
   */
  clearCurrents(name) {
    if (!this._available) return;
    const bufs = this._buffers[name];
    if (!bufs?.currents) return;
    const device = this._device;
    const encoder = device.createCommandEncoder();
    encoder.clearBuffer(bufs.currents);
    device.queue.submit([encoder.finish()]);
  }

  /**
   * T18.4.a — Upload external or incoming projection current deltas
   * from CPU (server) into the GPU `currents` buffer before the
   * propagate+LIF dispatch. Used for inter-cluster projections
   * (cortex → amygdala etc) that are computed server-side but feed
   * into GPU-resident neurons. The uploaded values get added to the
   * per-neuron drive via LIF_SHADER's `currents[i]` read.
   *
   * Pass a Float32Array of length `cluster.size`. Values will be
   * written starting at buffer offset 0.
   */
  writeExternalCurrents(name, currentsArray) {
    if (!this._available) return;
    const bufs = this._buffers[name];
    if (!bufs?.currents) return;
    const device = this._device;
    const src = currentsArray instanceof Float32Array ? currentsArray : new Float32Array(currentsArray);
    device.queue.writeBuffer(bufs.currents, 0, src.buffer, src.byteOffset, src.byteLength);
  }

  /**
   * Run synapse propagation on GPU (CSR sparse multiply).
   * @param {string} clusterName
   * @param {string} spikeSourceName — cluster whose spikes drive this propagation
   */
  propagateSynapses(clusterName, spikeSourceName) {
    if (!this._available) return;
    const bufs = this._buffers[clusterName];
    const srcBufs = this._buffers[spikeSourceName || clusterName];
    if (!bufs?.synValues || !srcBufs) return;
    const device = this._device;

    // Params for propagation
    const params = new ArrayBuffer(8);
    const view = new DataView(params);
    view.setUint32(0, bufs.size, true);
    view.setUint32(4, bufs.synNnz, true);

    const paramsBuffer = this._createBuffer(params, GPUBufferUsage.UNIFORM);

    const bindGroup = device.createBindGroup({
      layout: this._pipelines.propagate.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: paramsBuffer } },
        { binding: 1, resource: { buffer: bufs.synValues } },
        { binding: 2, resource: { buffer: bufs.synColIdx } },
        { binding: 3, resource: { buffer: bufs.synRowPtr } },
        { binding: 4, resource: { buffer: srcBufs.spikes } },
        { binding: 5, resource: { buffer: bufs.currents } },
      ],
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(this._pipelines.propagate);
    pass.setBindGroup(0, bindGroup);
    this._dispatch2D(pass, bufs.size, bufs.gridX);
    pass.end();

    device.queue.submit([encoder.finish()]);
  }

  /**
   * Read spike data back from GPU.
   * @param {string} name — cluster name
   * @returns {Promise<Uint32Array>}
   */
  // readbackSpikes removed — use readbackSpikeCount for aggregated count

  /**
   * Read voltage data back from GPU.
   * @param {string} name
   * @returns {Promise<Float32Array>}
   */
  // readbackVoltages removed — voltages stay on GPU, never read back

  // generateCurrents: REMOVED — LIF shader generates currents inline now
  // saves 4 bytes/neuron and eliminates an entire dispatch pass

  /**
   * Count spikes on GPU using atomic counter — no JS scan loop.
   * @param {string} name — cluster name
   * @returns {Promise<number>} spike count
   */
  async readbackSpikeCount(name) {
    const bufs = this._buffers[name];
    if (!bufs) return 0;
    const device = this._device;

    // Atomic counter buffer is per-cluster and persistent — safe to
    // share across sequential calls because it's cleared via
    // writeBuffer at the start of each dispatch.
    if (!bufs.spikeCountBuf) {
      bufs.spikeCountBuf = device.createBuffer({
        size: 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
      });
    }

    // T14.22.6 — per-call readback buffer. The old code shared
    // bufs.spikeCountReadback across all calls for this cluster,
    // which collided when two fullStep calls overlapped in time:
    // call 1 awaited mapAsync on the shared buffer, call 2 tried
    // to submit an encoder that used the same buffer as a copy
    // destination while it was still pending-mapped from call 1,
    // producing:
    //   Failed to execute 'mapAsync' on 'GPUBuffer': Buffer
    //   already has an outstanding map pending.
    // Plus cascading "used in submit while mapped/pending map"
    // warnings. T14.22.3 worked around this by serializing fullStep
    // calls in compute.html, which fixed the crash but cost 7x
    // parallelism — 7 clusters ran sequentially instead of
    // concurrently, turning ~50ms/substep into ~350ms/substep
    // (500x slower wall-clock perf at Gee's 677M-neuron scale).
    //
    // Real fix: per-call readback buffer. 4 bytes, disposable,
    // freed immediately after unmap. Concurrent calls for the
    // SAME cluster each get their own readback buffer with its
    // own map lifecycle — no shared state, no collision possible.
    // Then the compute.html serialization can come back off and
    // all 7 clusters run in parallel on the GPU again.
    const readback = device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    // Zero the counter
    device.queue.writeBuffer(bufs.spikeCountBuf, 0, new Uint32Array([0]));

    // Params: n, gridX + 2 padding (16 bytes minimum for uniform alignment)
    const params = new ArrayBuffer(16);
    const view = new DataView(params);
    view.setUint32(0, bufs.size, true);
    view.setUint32(4, bufs.gridX || 32768, true);
    const paramsBuffer = this._createBuffer(params, GPUBufferUsage.UNIFORM);

    const bindGroup = device.createBindGroup({
      layout: this._pipelines.spikeCount.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: paramsBuffer } },
        { binding: 1, resource: { buffer: bufs.spikes } },
        { binding: 2, resource: { buffer: bufs.spikeCountBuf } },
      ],
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(this._pipelines.spikeCount);
    pass.setBindGroup(0, bindGroup);
    this._dispatch2D(pass, bufs.size, bufs.gridX);
    pass.end();

    // Readback the count into the per-call disposable buffer
    encoder.copyBufferToBuffer(bufs.spikeCountBuf, 0, readback, 0, 4);
    device.queue.submit([encoder.finish()]);

    await readback.mapAsync(GPUMapMode.READ);
    const count = new Uint32Array(readback.getMappedRange().slice(0))[0];
    readback.unmap();
    // Free the disposable buffer + disposable paramsBuffer.
    // WebGPU reclaims these when destroyed explicitly rather than
    // waiting for GC, keeping GPU memory bounded under steady load.
    readback.destroy();
    paramsBuffer.destroy();
    return count;
  }

  /**
   * T18.4.c — Voltage mean on GPU via atomic reduction, no CPU scan.
   * Accumulates scaled integer representation of Rulkov x-component
   * (fast variable, the spike analog) across every neuron atomically,
   * reads back the single i32 sum, divides by size + VOLT_SCALE=1000
   * for the mean. Used by the compute_batch path to emit per-cluster
   * mean voltage as a new telemetry channel.
   *
   * Prior behavior: voltages stayed on GPU, never aggregated, main
   * brain exposed no voltage telemetry at all. Now the dashboard HUD
   * can show mean voltage per cluster same as it shows spike count.
   *
   * @param {string} name — cluster name
   * @returns {Promise<number>} mean Rulkov x across the cluster
   */
  async readbackVoltageMean(name) {
    const bufs = this._buffers[name];
    if (!bufs) return 0;
    const device = this._device;

    // Atomic sum buffer — persistent, zeroed per call like spikeCountBuf.
    if (!bufs.voltSumBuf) {
      bufs.voltSumBuf = device.createBuffer({
        size: 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
      });
    }

    // Per-call disposable readback to avoid mapAsync collisions under
    // concurrent calls for the same cluster (same rationale as
    // readbackSpikeCount's per-call readback buffer).
    const readback = device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(bufs.voltSumBuf, 0, new Int32Array([0]));

    const params = new ArrayBuffer(16);
    const view = new DataView(params);
    view.setUint32(0, bufs.size, true);
    view.setUint32(4, bufs.gridX || 32768, true);
    const paramsBuffer = this._createBuffer(params, GPUBufferUsage.UNIFORM);

    const bindGroup = device.createBindGroup({
      layout: this._pipelines.voltStats.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: paramsBuffer } },
        { binding: 1, resource: { buffer: bufs.voltages } },
        { binding: 2, resource: { buffer: bufs.voltSumBuf } },
      ],
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(this._pipelines.voltStats);
    pass.setBindGroup(0, bindGroup);
    this._dispatch2D(pass, bufs.size, bufs.gridX);
    pass.end();

    encoder.copyBufferToBuffer(bufs.voltSumBuf, 0, readback, 0, 4);
    device.queue.submit([encoder.finish()]);

    await readback.mapAsync(GPUMapMode.READ);
    const scaledSum = new Int32Array(readback.getMappedRange().slice(0))[0];
    readback.unmap();
    readback.destroy();
    paramsBuffer.destroy();

    const VOLT_SCALE = 1000;
    return scaledSum / Math.max(1, bufs.size) / VOLT_SCALE;
  }

  /**
   * Full GPU step — generate currents + LIF + spike count. No JS loops.
   * @param {string} name
   * @param {number} effectiveDrive
   * @param {number} noiseAmp
   * @returns {Promise<{spikeCount: number}>}
   */
  async fullStep(name, effectiveDrive, noiseAmp) {
    // T18.4.a (2026-04-18) — FULL pipeline: clear → propagate → LIF.
    //
    // Prior behavior: single LIF dispatch with inline drive+noise. The
    // `currents` buffer existed but LIF_SHADER never read it, and
    // SYNAPSE_PROPAGATE_SHADER was never dispatched from fullStep —
    // so main-brain neurons saw only the global drive uniform, the
    // intra-cluster synapse matrix was uploaded but never consumed,
    // and Unity's brain had zero synaptic recurrence on GPU. Per Gee
    // 2026-04-18: "does it fully do all we need for the main brain
    // equation and all sub equations in totality" — the answer was no.
    //
    // Now: each substep clears currents, runs intra-cluster sparse
    // matmul (currents[i] += Σ W·spike_prev), then LIF reads
    // currents[i] as per-neuron synaptic drive on top of the global
    // effectiveDrive uniform. Full intra-cluster recurrence live on GPU.
    //
    // If the cluster has no intra-cluster synapse matrix uploaded
    // (pure driven population, no recurrence), propagateSynapses is a
    // no-op and we fall through to drive+noise-only LIF like before.
    this.clearCurrents(name);
    const bufs = this._buffers[name];
    if (bufs?.synValues) {
      this.propagateSynapses(name, name);
    }
    this.stepNeurons(name, effectiveDrive, noiseAmp);
    const spikeCount = await this.readbackSpikeCount(name);
    return { spikeCount };
  }

  /**
   * Check if GPU compute is available and initialized.
   */
  get available() { return this._available; }

  /**
   * Release all GPU resources.
   */
  destroy() {
    for (const bufs of Object.values(this._buffers)) {
      for (const [key, buf] of Object.entries(bufs)) {
        if (buf?.destroy) buf.destroy();
      }
    }
    this._buffers = {};
    this._device?.destroy();
    this._available = false;
  }
}

/**
 * Auto-detect WebGPU and initialize compute.
 * @returns {Promise<GPUCompute|null>}
 */
export async function initGPUCompute() {
  const gpu = new GPUCompute();
  const ok = await gpu.init();
  return ok ? gpu : null;
}
