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

const LIF_SHADER = /* wgsl */`
  struct Params {
    n: u32,          // number of neurons
    tau: f32,        // membrane time constant
    vRest: f32,      // resting potential
    vThresh: f32,    // spike threshold
    vReset: f32,     // reset potential
    dt: f32,         // timestep (ms)
    R: f32,          // membrane resistance
    tRefrac: f32,    // refractory period (ms)
  };

  @group(0) @binding(0) var<uniform> params: Params;
  @group(0) @binding(1) var<storage, read> voltagesIn: array<f32>;
  @group(0) @binding(2) var<storage, read_write> voltagesOut: array<f32>;
  @group(0) @binding(3) var<storage, read_write> spikes: array<u32>;
  @group(0) @binding(4) var<storage, read> currents: array<f32>;
  @group(0) @binding(5) var<storage, read_write> refracTimers: array<f32>;

  @compute @workgroup_size(256)
  fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let i = id.x;
    if (i >= params.n) { return; }

    var v = voltagesIn[i];
    let I = currents[i];
    var refrac = refracTimers[i];

    // Refractory check
    if (refrac > 0.0) {
      refrac -= params.dt;
      refracTimers[i] = refrac;
      voltagesOut[i] = params.vReset;
      spikes[i] = 0u;
      return;
    }

    // LIF dynamics: τ·dV/dt = -(V - Vrest) + R·I
    let dV = (-(v - params.vRest) + params.R * I) / params.tau;
    v += params.dt * dV;

    // Spike check
    if (v >= params.vThresh) {
      spikes[i] = 1u;
      v = params.vReset;
      refracTimers[i] = params.tRefrac;
    } else {
      spikes[i] = 0u;
    }

    voltagesOut[i] = v;
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

// ── GPU Compute Manager ─────────────────────────────────────────

export class GPUCompute {
  constructor() {
    this._device = null;
    this._available = false;
    this._pipelines = {};
    this._buffers = {};
    this._ping = 0; // double-buffer index
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

    // Convert Float64 to Float32 (GPU uses f32)
    const v32 = new Float32Array(size);
    for (let i = 0; i < size; i++) v32[i] = voltages[i];

    // Params uniform
    const params = new ArrayBuffer(32);
    const view = new DataView(params);
    view.setUint32(0, size, true);
    view.setFloat32(4, lifParams.tau || 20, true);
    view.setFloat32(8, lifParams.Vrest || -65, true);
    view.setFloat32(12, lifParams.Vthresh || -50, true);
    view.setFloat32(16, lifParams.Vreset || -70, true);
    view.setFloat32(20, lifParams.dt || 1, true);
    view.setFloat32(24, lifParams.R || 1, true);
    view.setFloat32(28, lifParams.tRefrac || 2, true);

    const buffers = {
      params: this._createBuffer(params, GPUBufferUsage.UNIFORM),
      voltagesA: this._createBuffer(v32, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC),
      voltagesB: this._createBuffer(new Float32Array(size), GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC),
      spikes: this._createBuffer(new Uint32Array(size), GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC),
      currents: this._createBuffer(new Float32Array(size), GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST),
      refracTimers: this._createBuffer(new Float32Array(size), GPUBufferUsage.STORAGE),
      // Readback buffer (MAP_READ)
      readbackSpikes: device.createBuffer({ size: size * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }),
      readbackVoltages: device.createBuffer({ size: size * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }),
      size,
    };

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
   * Run one LIF step on GPU for a cluster.
   * @param {string} name — cluster name
   * @param {Float32Array} inputCurrents — external currents to inject
   */
  stepNeurons(name, inputCurrents) {
    if (!this._available) return;
    const bufs = this._buffers[name];
    if (!bufs) return;
    const device = this._device;

    // Upload input currents
    device.queue.writeBuffer(bufs.currents, 0, inputCurrents);

    // Select ping-pong buffers
    const vIn = this._ping === 0 ? bufs.voltagesA : bufs.voltagesB;
    const vOut = this._ping === 0 ? bufs.voltagesB : bufs.voltagesA;

    // Create bind group for LIF shader
    const bindGroup = device.createBindGroup({
      layout: this._pipelines.lif.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: bufs.params } },
        { binding: 1, resource: { buffer: vIn } },
        { binding: 2, resource: { buffer: vOut } },
        { binding: 3, resource: { buffer: bufs.spikes } },
        { binding: 4, resource: { buffer: bufs.currents } },
        { binding: 5, resource: { buffer: bufs.refracTimers } },
      ],
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(this._pipelines.lif);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(bufs.size / 256));
    pass.end();

    device.queue.submit([encoder.finish()]);
    this._ping = 1 - this._ping; // swap buffers
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
    pass.dispatchWorkgroups(Math.ceil(bufs.size / 256));
    pass.end();

    device.queue.submit([encoder.finish()]);
  }

  /**
   * Read spike data back from GPU.
   * @param {string} name — cluster name
   * @returns {Promise<Uint32Array>}
   */
  async readbackSpikes(name) {
    const bufs = this._buffers[name];
    if (!bufs) return new Uint32Array(0);
    const device = this._device;

    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(bufs.spikes, 0, bufs.readbackSpikes, 0, bufs.size * 4);
    device.queue.submit([encoder.finish()]);

    await bufs.readbackSpikes.mapAsync(GPUMapMode.READ);
    const data = new Uint32Array(bufs.readbackSpikes.getMappedRange().slice(0));
    bufs.readbackSpikes.unmap();
    return data;
  }

  /**
   * Read voltage data back from GPU.
   * @param {string} name
   * @returns {Promise<Float32Array>}
   */
  async readbackVoltages(name) {
    const bufs = this._buffers[name];
    if (!bufs) return new Float32Array(0);
    const device = this._device;

    const vBuf = this._ping === 0 ? bufs.voltagesA : bufs.voltagesB;
    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(vBuf, 0, bufs.readbackVoltages, 0, bufs.size * 4);
    device.queue.submit([encoder.finish()]);

    await bufs.readbackVoltages.mapAsync(GPUMapMode.READ);
    const data = new Float32Array(bufs.readbackVoltages.getMappedRange().slice(0));
    bufs.readbackVoltages.unmap();
    return data;
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
