/**
 * cluster.js — Neural Cluster
 *
 * A self-contained neuron population with its own synapse matrix,
 * tonic drive, noise parameters, and regulation. Each brain module
 * gets its own cluster, creating a modular brain architecture where
 * each system has dedicated neural resources.
 *
 * Hierarchy:
 *   Cortex (300) → top-down predictions to all
 *   Hippocampus (200) → memory patterns, Hopfield attractors
 *   Amygdala (150) → emotional gating, amplifies/suppresses others
 *   Basal Ganglia (150) → action selection, reward gating
 *   Cerebellum (100) → error correction on inter-cluster signals
 *   Hypothalamus (50) → homeostatic baseline drive for all clusters
 *   Mystery (50) → consciousness modulation of coupling strength
 *
 * Total: 1000 neurons, each cluster with internal NxN synapses
 */

import { LIFPopulation } from './neurons.js';
import { SynapseMatrix } from './synapses.js';

export class NeuronCluster {
  /**
   * @param {string} name — cluster name (e.g., 'cortex')
   * @param {number} size — number of neurons
   * @param {object} opts
   * @param {number} [opts.tonicDrive=15] — baseline current
   * @param {number} [opts.noiseAmplitude=8] — noise range
   * @param {number} [opts.connectivity=0.12] — internal connection density
   * @param {number} [opts.excitatoryRatio=0.8] — fraction of excitatory connections
   * @param {number} [opts.learningRate=0.001] — plasticity rate
   * @param {object} [opts.lifParams] — LIF neuron parameters override
   */
  constructor(name, size, opts = {}) {
    this.name = name;
    this.size = size;

    // Regulation parameters — each cluster has its own
    this.tonicDrive = opts.tonicDrive ?? 15;
    this.noiseAmplitude = opts.noiseAmplitude ?? 8;
    this.connectivity = opts.connectivity ?? 0.12;
    this.excitatoryRatio = opts.excitatoryRatio ?? 0.8;
    this.learningRate = opts.learningRate ?? 0.001;

    // Modulation factors (set by hierarchy controllers)
    this.gainMultiplier = 1.0;   // from Mystery module (consciousness)
    this.emotionalGate = 1.0;    // from Amygdala
    this.driveBaseline = 1.0;    // from Hypothalamus
    this.actionGate = 1.0;       // from Basal Ganglia
    this.errorCorrection = 0.0;  // from Cerebellum

    // Neural population
    this.neurons = new LIFPopulation(size, opts.lifParams || {
      tau: 20.0,
      Vrest: -65.0,
      Vreset: -70.0,
      Vthresh: -50.0,
      R: 1.0,
      tRefrac: 2.0,
    });

    // Internal synapse matrix
    this.synapses = new SynapseMatrix(size, { wMin: -2.0, wMax: 2.0 });

    // External current buffer (from other clusters + sensory input)
    this.externalCurrent = new Float64Array(size);

    // Inter-cluster projection buffers
    this._incomingProjections = new Float64Array(size); // sum of all incoming

    // Initialize internal connectivity
    this._initSynapses();

    // State tracking
    this.lastSpikes = new Uint8Array(size);
    this.lastSpikeCount = 0;
    this.lastMeanVoltage = -65;
    this.firingRate = 0; // EMA of spike count
  }

  _initSynapses() {
    const { size, connectivity, excitatoryRatio } = this;
    const W = this.synapses.W;
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        if (i === j) continue;
        if (Math.random() < connectivity) {
          const sign = Math.random() < excitatoryRatio ? 1 : -1;
          W[i * size + j] = sign * (0.1 + Math.random() * 0.4);
        }
      }
    }
  }

  /**
   * One simulation step for this cluster.
   * @param {number} dt — timestep in seconds
   * @returns {{ spikes: Uint8Array, spikeCount: number, voltages: Float64Array }}
   */
  step(dt) {
    const { size, neurons, synapses } = this;

    // Build input currents
    const currents = new Float64Array(size);
    const synapticCurrents = synapses.propagate(neurons.getSpikes());

    // Effective tonic drive with all modulation applied
    const effectiveDrive = this.tonicDrive
      * this.driveBaseline      // hypothalamus homeostasis
      * this.emotionalGate      // amygdala emotional amplification
      * this.actionGate          // basal ganglia action gating
      * this.gainMultiplier;     // mystery consciousness modulation

    for (let i = 0; i < size; i++) {
      currents[i] = synapticCurrents[i]
        + this.externalCurrent[i]
        + this._incomingProjections[i]
        + effectiveDrive
        + (Math.random() - 0.5) * this.noiseAmplitude
        + this.errorCorrection;  // cerebellum correction signal
    }

    // Step neurons
    const spikes = neurons.step(dt * 1000, currents);
    const voltages = neurons.getVoltages();

    // Count spikes
    let spikeCount = 0;
    for (let i = 0; i < size; i++) if (spikes[i]) spikeCount++;

    // Update state
    this.lastSpikes = Uint8Array.from(spikes);
    this.lastSpikeCount = spikeCount;
    this.firingRate = this.firingRate * 0.95 + spikeCount * 0.05;

    // Mean voltage for monitoring
    let vSum = 0;
    for (let i = 0; i < size; i++) vSum += voltages[i];
    this.lastMeanVoltage = vSum / size;

    // Decay external currents
    for (let i = 0; i < size; i++) {
      this.externalCurrent[i] *= 0.9;
      this._incomingProjections[i] = 0; // reset for next step
    }

    return { spikes: this.lastSpikes, spikeCount, voltages };
  }

  /**
   * Apply plasticity rules on this cluster's internal synapses.
   */
  learn(rewardSignal) {
    const pre = new Float64Array(this.lastSpikes);
    const post = new Float64Array(this.lastSpikes);
    this.synapses.rewardModulatedUpdate(pre, post, rewardSignal, this.learningRate);
  }

  /**
   * Receive projected spikes from another cluster.
   * @param {Uint8Array} sourceSpikes — spike array from source cluster
   * @param {Float64Array} projectionWeights — weight vector (source.size → this.size mapping)
   */
  receiveProjection(sourceSpikes, projectionWeights) {
    const srcSize = sourceSpikes.length;
    const tgtSize = this.size;
    for (let i = 0; i < tgtSize; i++) {
      let sum = 0;
      for (let j = 0; j < srcSize; j++) {
        if (sourceSpikes[j]) {
          sum += projectionWeights[i * srcSize + j] || 0;
        }
      }
      this._incomingProjections[i] += sum;
    }
  }

  /**
   * Inject external input current into specific neurons.
   */
  injectCurrent(currents) {
    const len = Math.min(currents.length, this.size);
    for (let i = 0; i < len; i++) {
      this.externalCurrent[i] += currents[i];
    }
  }

  /**
   * Get a summary output vector (downsampled for module processing).
   * Returns a Float64Array of length `outputSize` by averaging neuron groups.
   */
  getOutput(outputSize = 32) {
    const voltages = this.neurons.getVoltages();
    const output = new Float64Array(outputSize);
    const groupSize = Math.floor(this.size / outputSize);
    for (let i = 0; i < outputSize; i++) {
      let sum = 0;
      for (let j = 0; j < groupSize; j++) {
        const idx = i * groupSize + j;
        if (idx < this.size) {
          sum += this.lastSpikes[idx] ? 1.0 : (voltages[idx] + 70) / 20; // normalize
        }
      }
      output[i] = sum / groupSize;
    }
    return output;
  }

  getState() {
    return {
      name: this.name,
      size: this.size,
      spikeCount: this.lastSpikeCount,
      firingRate: this.firingRate,
      meanVoltage: this.lastMeanVoltage,
      spikes: this.lastSpikes,
      voltages: this.neurons.getVoltages(),
      drive: this.tonicDrive * this.driveBaseline * this.emotionalGate * this.actionGate * this.gainMultiplier,
      modulation: {
        gain: this.gainMultiplier,
        emotional: this.emotionalGate,
        drive: this.driveBaseline,
        action: this.actionGate,
        error: this.errorCorrection,
      },
    };
  }
}

/**
 * Inter-cluster projection — sparse weight matrix connecting two clusters.
 */
export class ClusterProjection {
  /**
   * @param {NeuronCluster} source
   * @param {NeuronCluster} target
   * @param {number} density — connection probability (0-1)
   * @param {number} strength — initial weight magnitude
   */
  constructor(source, target, density = 0.03, strength = 0.3) {
    this.source = source;
    this.target = target;
    this.weights = new Float64Array(target.size * source.size);

    // Sparse random initialization
    for (let i = 0; i < target.size; i++) {
      for (let j = 0; j < source.size; j++) {
        if (Math.random() < density) {
          this.weights[i * source.size + j] = (Math.random() - 0.3) * strength;
        }
      }
    }
  }

  /**
   * Propagate spikes from source to target.
   */
  propagate() {
    this.target.receiveProjection(this.source.lastSpikes, this.weights);
  }

  /**
   * Reward-modulated Hebbian learning on projection weights.
   * ΔW_proj = η · δ · source_spikes · target_spikes
   *
   * When source fires AND target fires AND reward is positive,
   * the connection strengthens. This is how the brain learns
   * which cortex patterns (language) lead to which BG actions.
   *
   * @param {number} reward — positive = strengthen, negative = weaken
   * @param {number} lr — learning rate
   */
  learn(reward, lr = 0.001) {
    if (Math.abs(reward) < 0.01) return; // no learning without reward signal
    const srcSpikes = this.source.lastSpikes;
    const tgtSpikes = this.target.lastSpikes;
    const srcSize = this.source.size;
    const tgtSize = this.target.size;

    for (let i = 0; i < tgtSize; i++) {
      if (!tgtSpikes[i]) continue; // target not firing — skip
      for (let j = 0; j < srcSize; j++) {
        if (!srcSpikes[j]) continue; // source not firing — skip
        // Both fired — update weight based on reward
        const idx = i * srcSize + j;
        this.weights[idx] += lr * reward;
        // Clamp weights
        if (this.weights[idx] > 1.0) this.weights[idx] = 1.0;
        if (this.weights[idx] < -0.5) this.weights[idx] = -0.5;
      }
    }
  }
}
