/**
 * engine.js — Main brain simulation loop.
 *
 * Ties together all brain modules into a single UnityBrain that runs
 * at 60fps in the browser. ~200 LIF neurons, 8 oscillators, 6 brain
 * regions, mystery module, full synaptic plasticity.
 *
 * No external dependencies. Pure ES modules.
 */

import { LIFPopulation } from './neurons.js';
import { SynapseMatrix } from './synapses.js';
import { Cortex, Hippocampus, Amygdala, BasalGanglia, Cerebellum, Hypothalamus } from './modules.js';
import { MysteryModule } from './mystery.js';
import { OscillatorNetwork } from './oscillations.js';
import { UNITY_PERSONA, loadPersona, getBrainParams } from './persona.js';

// ── Simple EventEmitter ─────────────────────────────────────────────

class EventEmitter {
  constructor() {
    this._listeners = {};
  }

  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
    return this;
  }

  off(event, fn) {
    const arr = this._listeners[event];
    if (!arr) return this;
    this._listeners[event] = arr.filter(f => f !== fn);
    return this;
  }

  emit(event, data) {
    const arr = this._listeners[event];
    if (!arr) return;
    for (let i = 0; i < arr.length; i++) arr[i](data);
  }
}

// ── Constants ────────────────────────────────────────────────────────

const NEURON_COUNT = 200;
const OSCILLATOR_COUNT = 8;
const MODULE_SIZE = 32;          // state vector size for brain region modules
const STEPS_PER_FRAME = 10;      // brain steps per requestAnimationFrame tick
const DT = 0.001;                // 1ms timestep (seconds)
const THOUGHT_INTERVAL = 3000;   // ms between idle thoughts
const COUPLING_BASE = 0.5;       // base oscillator coupling strength

// ── UnityBrain ───────────────────────────────────────────────────────

export class UnityBrain extends EventEmitter {
  constructor(personaOverrides = {}) {
    super();

    // Load persona and derive brain parameters
    this.persona = loadPersona(personaOverrides);
    this.drugState = 'cokeAndWeed'; // daily driver
    this.brainParams = getBrainParams(this.persona, this.drugState);

    // ── Neurons: 200 LIF neurons ──
    this.neurons = new LIFPopulation(NEURON_COUNT, {
      tau: 20.0,
      Vrest: -65.0,
      Vreset: -70.0,
      Vthresh: -50.0,
      R: 1.0,
      tRefrac: 2.0,
    });

    // ── Synapses: NxN weight matrix ──
    this.synapses = new SynapseMatrix(NEURON_COUNT, {
      wMin: -2.0,
      wMax: 2.0,
    });
    // Sparse random initialization — ~10% connectivity
    this._initSynapses();

    // ── Brain region modules ──
    this.cortex = new Cortex(MODULE_SIZE);
    this.hippocampus = new Hippocampus(MODULE_SIZE);
    this.amygdala = new Amygdala(MODULE_SIZE, 'unity');
    this.basalGanglia = new BasalGanglia(MODULE_SIZE, 'unity');
    this.cerebellum = new Cerebellum(MODULE_SIZE);
    this.hypothalamus = new Hypothalamus('unity');

    // ── Mystery module ──
    this.mystery = new MysteryModule(this.brainParams.mysteryWeights);

    // ── Oscillators: 8 Kuramoto oscillators spanning theta–gamma ──
    this.oscillators = new OscillatorNetwork(OSCILLATOR_COUNT, {
      freqMin: 4,
      freqMax: 80,
    });
    // Coupling matrix for oscillators (all-to-all with base strength)
    this.oscCoupling = new Float64Array(OSCILLATOR_COUNT * OSCILLATOR_COUNT);
    this._initOscCoupling();

    // ── State tracking ──
    this.time = 0;                          // simulation time (seconds)
    this.frameCount = 0;
    this.lastThoughtTime = 0;
    this.externalCurrent = new Float64Array(NEURON_COUNT); // injected input
    this.reward = 0;                        // global reward signal
    this.lastAction = null;
    this.running = false;
    this._rafId = null;

    // ── Module state cache (updated each step) ──
    this.state = {
      spikes: null,
      voltages: null,
      cortex: null,
      hippocampus: null,
      amygdala: null,
      basalGanglia: null,
      cerebellum: null,
      hypothalamus: null,
      mystery: null,
      oscillations: null,
      bandPower: null,
      psi: 0,
      time: 0,
      reward: 0,
    };
  }

  // ── Initialization helpers ──────────────────────────────────────────

  _initSynapses() {
    const n = NEURON_COUNT;
    const W = this.synapses.W;
    const connectivity = 0.1; // 10% connection probability
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue; // no self-connections
        if (Math.random() < connectivity) {
          // 80% excitatory, 20% inhibitory
          const sign = Math.random() < 0.8 ? 1 : -1;
          W[i * n + j] = sign * (0.1 + Math.random() * 0.3);
        }
      }
    }
  }

  _initOscCoupling() {
    const n = OSCILLATOR_COUNT;
    const K = this.oscCoupling;
    const base = COUPLING_BASE * (this.brainParams.oscillationCoherence || 1.0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          K[i * n + j] = base / n; // normalized coupling
        }
      }
    }
  }

  // ── Core simulation step ────────────────────────────────────────────

  /**
   * One full brain tick.
   *
   * @param {Float64Array|null} input — external sensory current (length NEURON_COUNT), or null
   * @param {number} dt — time step in seconds
   * @returns {object} full brain state
   */
  step(input, dt = DT) {
    // ── 1. Build input currents ──
    const currents = new Float64Array(NEURON_COUNT);
    const synapticCurrents = this.synapses.propagate(
      this.neurons.getSpikes()
    );

    for (let i = 0; i < NEURON_COUNT; i++) {
      currents[i] = synapticCurrents[i] + this.externalCurrent[i];
      if (input) currents[i] += input[i];
    }

    // Apply mystery module global gain (Ψ modulation)
    const psiGain = this.state.psi ? Math.max(0.1, Math.min(3.0, this.state.psi * 0.001)) : 1.0;
    for (let i = 0; i < NEURON_COUNT; i++) {
      currents[i] *= psiGain;
    }

    // ── 2. Neuron dynamics ──
    const spikes = this.neurons.step(dt * 1000, currents); // neurons expect dt in ms
    const voltages = this.neurons.getVoltages();

    // Count active neurons for module inputs
    let spikeCount = 0;
    for (let i = 0; i < NEURON_COUNT; i++) if (spikes[i]) spikeCount++;

    // ── 3. Extract module-sized input from neuron activity ──
    // Downsample neuron population to MODULE_SIZE for brain region modules
    const moduleInput = this._downsampleToModule(voltages);

    // ── 4. Brain state object for module consumption ──
    const brainState = {
      reward: this.reward,
      prediction: this.state.cortex?.prediction || null,
      target: moduleInput,
      cortex: {
        predictionAccuracy: this.state.cortex
          ? 1.0 - this._meanAbs(this.state.cortex.error)
          : 0.5,
        activeNeurons: spikeCount,
      },
      amygdala: this.state.amygdala || {},
      hypothalamus: this.state.hypothalamus?.drives || {},
      memory: {
        stability: this.state.hippocampus?.isStable ? 1.0 : 0.5,
      },
      cerebellum: {
        errorRate: this.state.cerebellum
          ? this._meanAbs(this.state.cerebellum.error)
          : 0.5,
        activeNeurons: Math.floor(spikeCount * 0.2),
      },
      hippocampus: { activeNeurons: Math.floor(spikeCount * 0.15) },
      basalGanglia: { activeNeurons: Math.floor(spikeCount * 0.1) },
      brainstem: { activeNeurons: Math.floor(spikeCount * 0.05) },
      oscillation: {
        coherence: this.state.oscillations?.coherence || 0,
      },
    };

    // ── 5. Cortex: prediction + error ──
    const cortexOut = this.cortex.step(moduleInput, brainState, dt);

    // ── 6. Hippocampus: memory check ──
    const hippoOut = this.hippocampus.step(moduleInput, brainState, dt);

    // ── 7. Amygdala: emotional weighting ──
    const amygdalaOut = this.amygdala.step(moduleInput, brainState, dt);

    // ── 8. Hypothalamus: homeostasis ──
    const hypoInput = new Float64Array(5); // 5 drives
    hypoInput[0] = amygdalaOut.arousal;    // arousal drive from amygdala
    const hypoOut = this.hypothalamus.step(hypoInput, brainState, dt);

    // ── 9. Cerebellum: error correction ──
    const cerebOut = this.cerebellum.step(moduleInput, brainState, dt);

    // ── 10. Basal Ganglia: action selection ──
    const bgOut = this.basalGanglia.step(moduleInput, brainState, dt);

    // ── 11. Mystery module: global Ψ modulation ──
    // Update brain state with fresh module outputs before computing Ψ
    brainState.amygdala = amygdalaOut;
    brainState.cortex.predictionAccuracy = 1.0 - this._meanAbs(cortexOut.error);
    brainState.memory.stability = hippoOut.isStable ? 1.0 : 0.5;
    brainState.cerebellum.errorRate = this._meanAbs(cerebOut.error);
    brainState.oscillation.coherence = this.oscillators.getCoherence();

    const mysteryOut = this.mystery.step(brainState, dt);

    // ── 12. Oscillation update ──
    this.oscillators.step(dt, this.oscCoupling);
    const coherence = this.oscillators.getCoherence();
    const bandPower = this.oscillators.getBandPower();

    // ── 13. Synaptic plasticity (reward-modulated) ──
    const preSpikes = new Float64Array(spikes);  // convert Uint8 to Float64
    const postSpikes = new Float64Array(spikes);
    this.synapses.rewardModulatedUpdate(
      preSpikes,
      postSpikes,
      this.reward + amygdalaOut.valence * 0.1, // emotional valence contributes to reward
      0.001 // conservative learning rate
    );

    // Decay external current
    for (let i = 0; i < NEURON_COUNT; i++) {
      this.externalCurrent[i] *= 0.95;
    }

    // Decay reward signal
    this.reward *= 0.99;

    // ── 14. Update cached state ──
    this.time += dt;
    this.state = {
      spikes: Uint8Array.from(spikes),
      voltages: Float64Array.from(voltages),
      spikeCount,
      cortex: cortexOut,
      hippocampus: hippoOut,
      amygdala: amygdalaOut,
      basalGanglia: bgOut,
      cerebellum: cerebOut,
      hypothalamus: hypoOut,
      mystery: mysteryOut,
      oscillations: { coherence, bandPower, phases: this.oscillators.getPhases() },
      bandPower,
      psi: mysteryOut.psi,
      time: this.time,
      reward: this.reward,
    };

    // ── 15. Emit events ──
    if (bgOut.selectedAction !== this.lastAction) {
      this.lastAction = bgOut.selectedAction;
      this.emit('action', {
        action: bgOut.selectedAction,
        confidence: bgOut.confidence,
        time: this.time,
      });
    }

    if (hypoOut.needsAttention.length > 0) {
      this.emit('needsAttention', {
        drives: hypoOut.needsAttention,
        time: this.time,
      });
    }

    this.emit('stateUpdate', this.state);

    return this.state;
  }

  // ── Think loop (requestAnimationFrame) ──────────────────────────────

  /**
   * Called in requestAnimationFrame. Runs multiple brain steps per frame.
   * This is the "always thinking" part — the brain never stops.
   */
  think() {
    if (!this.running) return;

    for (let i = 0; i < STEPS_PER_FRAME; i++) {
      this.step(null, DT);
    }

    this.frameCount++;

    // Periodic idle thoughts
    const now = performance.now();
    if (now - this.lastThoughtTime > THOUGHT_INTERVAL) {
      this.lastThoughtTime = now;
      this._generateIdleThought();
    }

    this._rafId = requestAnimationFrame(() => this.think());
  }

  /**
   * Start the brain. Begins the think loop.
   */
  start() {
    if (this.running) return;
    this.running = true;
    this.lastThoughtTime = performance.now();
    this._rafId = requestAnimationFrame(() => this.think());
  }

  /**
   * Stop the brain. Halts the think loop.
   */
  stop() {
    this.running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  // ── External input ──────────────────────────────────────────────────

  /**
   * Inject external input (e.g., user message) as sensory current.
   * Text is hashed into a current pattern distributed across the neuron population.
   *
   * @param {string} text — input text
   */
  processInput(text) {
    const current = new Float64Array(NEURON_COUNT);

    // Hash text into neuron activation pattern
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      const idx = (code * 31 + i * 7) % NEURON_COUNT;
      current[idx] += 5.0; // strong enough to trigger spikes
    }

    // Spread activation to neighbors (lateral excitation)
    for (let i = 1; i < NEURON_COUNT - 1; i++) {
      if (current[i] > 0) {
        current[i - 1] += current[i] * 0.3;
        current[i + 1] += current[i] * 0.3;
      }
    }

    // Inject as sustained external current (decays over time in step())
    for (let i = 0; i < NEURON_COUNT; i++) {
      this.externalCurrent[i] += current[i];
    }

    // Store in hippocampus as a memory pattern
    const memPattern = this._downsampleToModule(current);
    // Convert to bipolar for Hopfield
    for (let i = 0; i < memPattern.length; i++) {
      memPattern[i] = memPattern[i] > 0 ? 1 : -1;
    }
    this.hippocampus.store(memPattern);

    // Small reward for receiving input (social need satisfied)
    this.reward += 0.2;
  }

  // ── State access ────────────────────────────────────────────────────

  /**
   * Full brain state snapshot.
   * @returns {object} all module outputs, spikes, oscillations, Ψ
   */
  getState() {
    return this.state;
  }

  /**
   * What the basal ganglia decided to do.
   * @returns {{ action: string, confidence: number }|null}
   */
  getSelectedAction() {
    if (!this.state.basalGanglia) return null;
    return {
      action: this.state.basalGanglia.selectedAction,
      confidence: this.state.basalGanglia.confidence,
    };
  }

  /**
   * Switch drug combo, re-derive brain parameters.
   * @param {string} name — key from persona.drugStates
   */
  setDrugState(name) {
    if (!this.persona.drugStates[name]) {
      console.warn(`unknown drug state: "${name}"`);
      return;
    }
    this.drugState = name;
    this.brainParams = getBrainParams(this.persona, name);

    // Re-apply mystery weights
    this.mystery.setWeights(this.brainParams.mysteryWeights);

    // Re-init oscillator coupling with new coherence multiplier
    this._initOscCoupling();

    // Adjust basal ganglia temperature based on chaos flag
    if (this.brainParams.chaos) {
      this.basalGanglia.tau = 3.0; // more random action selection
    } else {
      this.basalGanglia.tau = this.persona.traits.impulsivity > 0.7 ? 2.0 : 0.5;
    }
  }

  // ── Internal helpers ────────────────────────────────────────────────

  /**
   * Downsample NEURON_COUNT values to MODULE_SIZE by averaging bins.
   * @param {Float64Array|Uint8Array} data — length NEURON_COUNT
   * @returns {Float64Array} — length MODULE_SIZE
   */
  _downsampleToModule(data) {
    const out = new Float64Array(MODULE_SIZE);
    const binSize = Math.floor(NEURON_COUNT / MODULE_SIZE);

    for (let i = 0; i < MODULE_SIZE; i++) {
      let sum = 0;
      const start = i * binSize;
      const end = Math.min(start + binSize, NEURON_COUNT);
      for (let j = start; j < end; j++) {
        sum += data[j];
      }
      out[i] = sum / (end - start);
    }
    return out;
  }

  /**
   * Mean absolute value of a Float64Array.
   * @param {Float64Array} arr
   * @returns {number}
   */
  _meanAbs(arr) {
    if (!arr || arr.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < arr.length; i++) sum += Math.abs(arr[i]);
    return sum / arr.length;
  }

  /**
   * Generate an idle thought based on current brain state.
   * Emits 'thought' event with context derived from active modules.
   */
  _generateIdleThought() {
    const { amygdala, basalGanglia, hypothalamus, psi, spikeCount } = this.state;
    if (!amygdala) return;

    const thought = {
      valence: amygdala.valence,
      arousal: amygdala.arousal,
      psi,
      spikeRate: (spikeCount || 0) / NEURON_COUNT,
      suggestedAction: basalGanglia?.selectedAction || 'idle_thought',
      unsatisfied: hypothalamus?.needsAttention || [],
      time: this.time,
    };

    this.emit('thought', thought);
  }
}

export default UnityBrain;
