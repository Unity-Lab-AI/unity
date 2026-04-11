/**
 * engine.js — Main brain simulation loop.
 *
 * ARCHITECTURE: 7 dedicated neural clusters, each with its own
 * LIF neuron population, synapse matrix, and regulation parameters.
 * Inter-cluster projections create a hierarchical brain.
 *
 * Cluster sizes (1000 neurons total):
 *   Cortex:       300 neurons — prediction, top-down control
 *   Hippocampus:  200 neurons — memory patterns, Hopfield attractors
 *   Amygdala:     150 neurons — emotional gating
 *   Basal Ganglia: 150 neurons — action selection, reward
 *   Cerebellum:   100 neurons — error correction
 *   Hypothalamus:  50 neurons — homeostatic drive
 *   Mystery:       50 neurons — consciousness modulation
 *
 * Hierarchy:
 *   Cortex → top-down predictions to all clusters
 *   Amygdala → emotional gain on all clusters
 *   Basal Ganglia → action gating on all clusters
 *   Hypothalamus → baseline drive for all clusters
 *   Mystery → coupling strength modulation (consciousness)
 *   Cerebellum → error correction signals
 *
 * No external dependencies. Pure ES modules.
 */

import { NeuronCluster, ClusterProjection } from './cluster.js';
import { Cortex, Hippocampus, Amygdala, BasalGanglia, Cerebellum, Hypothalamus } from './modules.js';
import { MysteryModule } from './mystery.js';
import { OscillatorNetwork } from './oscillations.js';
import { UNITY_PERSONA, loadPersona, getBrainParams } from './persona.js';

// ── Simple EventEmitter ─────────────────────────────────────────────

class EventEmitter {
  constructor() { this._listeners = {}; }
  on(event, fn) { if (!this._listeners[event]) this._listeners[event] = []; this._listeners[event].push(fn); return this; }
  off(event, fn) { const a = this._listeners[event]; if (a) this._listeners[event] = a.filter(f => f !== fn); return this; }
  emit(event, data) { const a = this._listeners[event]; if (a) for (let i = 0; i < a.length; i++) a[i](data); }
}

// ── Constants ────────────────────────────────────────────────────────

const TOTAL_NEURONS = 1000;
const OSCILLATOR_COUNT = 8;
const MODULE_SIZE = 32;
const STEPS_PER_FRAME = 10;
const DT = 0.001;
const THOUGHT_INTERVAL = 3000;
const COUPLING_BASE = 0.5;

// Cluster sizes
const CLUSTER_SIZES = {
  cortex: 300,
  hippocampus: 200,
  amygdala: 150,
  basalGanglia: 150,
  cerebellum: 100,
  hypothalamus: 50,
  mystery: 50,
};

// ── UnityBrain ───────────────────────────────────────────────────────

export class UnityBrain extends EventEmitter {
  constructor(personaOverrides = {}) {
    super();

    this.persona = loadPersona(personaOverrides);
    this.drugState = 'cokeAndWeed';
    this.brainParams = getBrainParams(this.persona, this.drugState);

    const arousal = this.brainParams.arousalBaseline || 0.9;

    // ── Neural Clusters — each brain region gets its own neurons ──
    this.clusters = {
      cortex: new NeuronCluster('cortex', CLUSTER_SIZES.cortex, {
        tonicDrive: 14 + arousal * 6,
        noiseAmplitude: 7,
        connectivity: 0.15,
        excitatoryRatio: 0.85,
        learningRate: 0.002,
      }),
      hippocampus: new NeuronCluster('hippocampus', CLUSTER_SIZES.hippocampus, {
        tonicDrive: 12 + arousal * 4,
        noiseAmplitude: 5,
        connectivity: 0.20, // dense recurrent — Hopfield-like
        excitatoryRatio: 0.75,
        learningRate: 0.003,
      }),
      amygdala: new NeuronCluster('amygdala', CLUSTER_SIZES.amygdala, {
        tonicDrive: 15 + arousal * 8, // hot baseline — Unity runs emotional
        noiseAmplitude: 10,
        connectivity: 0.12,
        excitatoryRatio: 0.7,
        learningRate: 0.001,
      }),
      basalGanglia: new NeuronCluster('basalGanglia', CLUSTER_SIZES.basalGanglia, {
        tonicDrive: 10 + arousal * 5,
        noiseAmplitude: 8,
        connectivity: 0.10,
        excitatoryRatio: 0.6, // more inhibitory — selection by inhibition
        learningRate: 0.005, // fast RL learning
      }),
      cerebellum: new NeuronCluster('cerebellum', CLUSTER_SIZES.cerebellum, {
        tonicDrive: 12 + arousal * 3,
        noiseAmplitude: 4, // low noise — precision system
        connectivity: 0.18,
        excitatoryRatio: 0.9,
        learningRate: 0.004,
      }),
      hypothalamus: new NeuronCluster('hypothalamus', CLUSTER_SIZES.hypothalamus, {
        tonicDrive: 16, // steady — homeostatic setpoint
        noiseAmplitude: 3, // very stable
        connectivity: 0.25, // densely interconnected
        excitatoryRatio: 0.8,
        learningRate: 0.0005, // slow — homeostasis doesn't change fast
      }),
      mystery: new NeuronCluster('mystery', CLUSTER_SIZES.mystery, {
        tonicDrive: 13 + arousal * 5,
        noiseAmplitude: 12, // high chaos — consciousness is noisy
        connectivity: 0.30, // very dense — integrated information
        excitatoryRatio: 0.7,
        learningRate: 0.001,
      }),
    };

    // ── Inter-cluster Projections (hierarchical connections) ──
    this.projections = [];
    const c = this.clusters;

    // Cortex → all (top-down predictions)
    this.projections.push(new ClusterProjection(c.cortex, c.hippocampus, 0.04, 0.4));
    this.projections.push(new ClusterProjection(c.cortex, c.amygdala, 0.03, 0.3));
    this.projections.push(new ClusterProjection(c.cortex, c.basalGanglia, 0.03, 0.3));
    this.projections.push(new ClusterProjection(c.cortex, c.cerebellum, 0.05, 0.3));

    // Hippocampus → Cortex (memory recall drives predictions)
    this.projections.push(new ClusterProjection(c.hippocampus, c.cortex, 0.04, 0.4));

    // Amygdala → Cortex, Hippocampus (emotional modulation)
    this.projections.push(new ClusterProjection(c.amygdala, c.cortex, 0.03, 0.3));
    this.projections.push(new ClusterProjection(c.amygdala, c.hippocampus, 0.04, 0.5)); // emotion boosts memory

    // Basal Ganglia → Cortex (action selection feeds back)
    this.projections.push(new ClusterProjection(c.basalGanglia, c.cortex, 0.02, 0.2));

    // Cerebellum → Cortex, Basal Ganglia (error correction)
    this.projections.push(new ClusterProjection(c.cerebellum, c.cortex, 0.03, 0.2));
    this.projections.push(new ClusterProjection(c.cerebellum, c.basalGanglia, 0.03, 0.2));

    // Hypothalamus → all (baseline drive modulation — done via gainMultiplier, not direct projection)
    this.projections.push(new ClusterProjection(c.hypothalamus, c.amygdala, 0.05, 0.4));
    this.projections.push(new ClusterProjection(c.hypothalamus, c.basalGanglia, 0.04, 0.3));

    // Mystery → all (consciousness coupling — done via gainMultiplier, not direct projection)
    this.projections.push(new ClusterProjection(c.mystery, c.cortex, 0.05, 0.3));
    this.projections.push(new ClusterProjection(c.mystery, c.amygdala, 0.05, 0.3));

    // ── Brain Region Modules (equation processors) ──
    this.cortexMod = new Cortex(MODULE_SIZE);
    this.hippocampusMod = new Hippocampus(MODULE_SIZE);
    this.amygdalaMod = new Amygdala(MODULE_SIZE, { arousalBaseline: arousal });
    this.basalGangliaMod = new BasalGanglia(MODULE_SIZE);
    this.cerebellumMod = new Cerebellum(MODULE_SIZE);
    this.hypothalamusMod = new Hypothalamus(5);
    this.mystery = new MysteryModule(this.brainParams.mysteryWeights);

    // ── Oscillators ──
    this.oscillators = new OscillatorNetwork(OSCILLATOR_COUNT);
    this.oscCoupling = new Float64Array(OSCILLATOR_COUNT * OSCILLATOR_COUNT);
    this._initOscCoupling();

    // ── State ──
    this.time = 0;
    this.reward = 0;
    this.frameCount = 0;
    this.running = false;
    this._rafId = null;
    this.lastThoughtTime = 0;
    this.lastAction = 'idle';

    this.state = {
      spikes: null,
      voltages: null,
      spikeCount: 0,
      clusters: {},
      cortex: null,
      hippocampus: null,
      amygdala: null,
      basalGanglia: null,
      cerebellum: null,
      hypothalamus: null,
      mystery: null,
      oscillations: null,
      psi: 0,
      time: 0,
      reward: 0,
      totalNeurons: TOTAL_NEURONS,
    };
  }

  _initOscCoupling() {
    const n = OSCILLATOR_COUNT;
    const base = COUPLING_BASE * (this.brainParams.oscillationCoherence || 1.0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const freqDist = Math.abs(i - j);
        this.oscCoupling[i * n + j] = base * Math.exp(-freqDist * 0.3);
      }
    }
  }

  // ── Core simulation step ──────────────────────────────────────────

  step(input, dt = DT) {
    // ── 1. Propagate inter-cluster projections ──
    for (const proj of this.projections) {
      proj.propagate();
    }

    // ── 2. Step all clusters ──
    const clusterResults = {};
    let totalSpikes = 0;
    for (const [name, cluster] of Object.entries(this.clusters)) {
      const result = cluster.step(dt);
      clusterResults[name] = result;
      totalSpikes += result.spikeCount;
    }

    // ── 3. Get module-sized outputs from each cluster ──
    const cortexInput = this.clusters.cortex.getOutput(MODULE_SIZE);
    const hippoInput = this.clusters.hippocampus.getOutput(MODULE_SIZE);
    const amygInput = this.clusters.amygdala.getOutput(MODULE_SIZE);
    const bgInput = this.clusters.basalGanglia.getOutput(MODULE_SIZE);
    const cerebInput = this.clusters.cerebellum.getOutput(MODULE_SIZE);

    // ── 4. Build brain state for module processing ──
    const brainState = {
      reward: this.reward,
      prediction: this.state.cortex?.prediction || null,
      target: cortexInput,
      cortex: { predictionAccuracy: this.state.cortex ? 1.0 - this._meanAbs(this.state.cortex.error) : 0.5, activeNeurons: clusterResults.cortex.spikeCount },
      amygdala: this.state.amygdala || {},
      hypothalamus: this.state.hypothalamus?.drives || {},
      memory: { stability: this.state.hippocampus?.isStable ? 1.0 : 0.5 },
      cerebellum: { errorRate: this.state.cerebellum ? this._meanAbs(this.state.cerebellum.error) : 0.5, activeNeurons: clusterResults.cerebellum.spikeCount },
      hippocampus: { activeNeurons: clusterResults.hippocampus.spikeCount },
      basalGanglia: { activeNeurons: clusterResults.basalGanglia.spikeCount },
      oscillation: { coherence: this.state.oscillations?.coherence || 0 },
    };

    // ── 5. Run equation modules ──
    const cortexOut = this.cortexMod.step(cortexInput, brainState, dt);
    const hippoOut = this.hippocampusMod.step(hippoInput, brainState, dt);
    const amygdalaOut = this.amygdalaMod.step(amygInput, brainState, dt);
    const hypoInput = new Float64Array(5);
    hypoInput[0] = amygdalaOut.arousal;
    const hypoOut = this.hypothalamusMod.step(hypoInput, brainState, dt);
    const cerebOut = this.cerebellumMod.step(cerebInput, brainState, dt);
    const bgOut = this.basalGangliaMod.step(bgInput, brainState, dt);

    // ── 6. Mystery module ──
    brainState.amygdala = amygdalaOut;
    brainState.cortex.predictionAccuracy = 1.0 - this._meanAbs(cortexOut.error);
    brainState.memory.stability = hippoOut.isStable ? 1.0 : 0.5;
    brainState.cerebellum.errorRate = this._meanAbs(cerebOut.error);
    brainState.oscillation.coherence = this.oscillators.getCoherence();
    const mysteryOut = this.mystery.step(brainState, dt);

    // ── 7. Hierarchy modulation — modules regulate clusters ──

    // Amygdala emotional gating — arousal amplifies all clusters
    const emotionalGate = 0.7 + amygdalaOut.arousal * 0.6;
    for (const cluster of Object.values(this.clusters)) {
      cluster.emotionalGate = emotionalGate;
    }
    this.clusters.amygdala.emotionalGate = 1.0; // amygdala doesn't gate itself

    // Hypothalamus baseline drive
    const driveFactor = 0.8 + (hypoOut.needsAttention?.length > 0 ? 0.4 : 0.0);
    for (const cluster of Object.values(this.clusters)) {
      cluster.driveBaseline = driveFactor;
    }

    // Basal Ganglia action gating — selected action boosts relevant cluster
    const selectedAction = bgOut.selectedAction;
    for (const cluster of Object.values(this.clusters)) {
      cluster.actionGate = 0.9; // slight suppression by default
    }
    // Boost the cluster most relevant to the selected action
    if (selectedAction === 'respond_text') this.clusters.cortex.actionGate = 1.3;
    else if (selectedAction === 'generate_image') this.clusters.cortex.actionGate = 1.2;
    else if (selectedAction === 'search_web') this.clusters.hippocampus.actionGate = 1.3;
    else if (selectedAction === 'build_ui') this.clusters.cortex.actionGate = 1.4;

    // Mystery consciousness modulation — Ψ scales coupling strength
    const psiGain = Math.max(0.8, Math.min(1.5, 0.9 + mysteryOut.psi * 0.05));
    for (const cluster of Object.values(this.clusters)) {
      cluster.gainMultiplier = psiGain;
    }

    // Cerebellum error correction
    const errorSignal = this._meanAbs(cerebOut.error) * 2;
    this.clusters.cortex.errorCorrection = -errorSignal; // negative feedback
    this.clusters.basalGanglia.errorCorrection = -errorSignal * 0.5;

    // ── 8. Plasticity — each cluster learns with reward modulation ──
    const globalReward = this.reward + amygdalaOut.valence * 0.1;
    for (const cluster of Object.values(this.clusters)) {
      cluster.learn(globalReward);
    }

    // ── 9. Oscillation update ──
    this.oscillators.step(dt, this.oscCoupling);
    const coherence = this.oscillators.getCoherence();
    const bandPower = this.oscillators.getBandPower();

    // ── 10. Decay reward ──
    this.reward *= 0.99;
    this.time += dt;

    // ── 11. Build combined spike/voltage arrays for visualization ──
    const allSpikes = new Uint8Array(TOTAL_NEURONS);
    const allVoltages = new Float64Array(TOTAL_NEURONS);
    let offset = 0;
    const clusterStates = {};
    for (const [name, cluster] of Object.entries(this.clusters)) {
      const cState = cluster.getState();
      clusterStates[name] = cState;
      allSpikes.set(cState.spikes, offset);
      allVoltages.set(cState.voltages, offset);
      offset += cluster.size;
    }

    // ── 12. Update state ──
    this.state = {
      spikes: allSpikes,
      voltages: allVoltages,
      spikeCount: totalSpikes,
      clusters: clusterStates,
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
      drugState: this.drugState,
      totalNeurons: TOTAL_NEURONS,
    };

    // ── 13. Emit events ──
    if (bgOut.selectedAction !== this.lastAction) {
      this.lastAction = bgOut.selectedAction;
      this.emit('action', { action: bgOut.selectedAction, confidence: bgOut.confidence, time: this.time });
    }
    if (hypoOut.needsAttention?.length > 0) {
      this.emit('needsAttention', { drives: hypoOut.needsAttention, time: this.time });
    }
    this.emit('stateUpdate', this.state);
    return this.state;
  }

  // ── Think loop ──────────────────────────────────────────────────

  think() {
    if (!this.running) return;
    for (let i = 0; i < STEPS_PER_FRAME; i++) {
      this.step(null, DT);
    }
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastThoughtTime > THOUGHT_INTERVAL) {
      this.lastThoughtTime = now;
      this._generateIdleThought();
    }
    this._rafId = requestAnimationFrame(() => this.think());
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastThoughtTime = performance.now();
    this._rafId = requestAnimationFrame(() => this.think());
  }

  stop() {
    this.running = false;
    if (this._rafId !== null) { cancelAnimationFrame(this._rafId); this._rafId = null; }
  }

  // ── External input ──────────────────────────────────────────────

  processInput(text) {
    // Hash text into cortex cluster (language processing)
    const cortexCurrent = new Float64Array(CLUSTER_SIZES.cortex);
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      const idx = (code * 31 + i * 7) % CLUSTER_SIZES.cortex;
      cortexCurrent[idx] += 6.0;
    }
    // Lateral excitation
    for (let i = 1; i < CLUSTER_SIZES.cortex - 1; i++) {
      if (cortexCurrent[i] > 0) {
        cortexCurrent[i - 1] += cortexCurrent[i] * 0.3;
        cortexCurrent[i + 1] += cortexCurrent[i] * 0.3;
      }
    }
    this.clusters.cortex.injectCurrent(cortexCurrent);

    // Also inject into hippocampus for memory formation
    const hippoCurrent = new Float64Array(CLUSTER_SIZES.hippocampus);
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      const idx = (code * 13 + i * 11) % CLUSTER_SIZES.hippocampus;
      hippoCurrent[idx] += 5.0;
    }
    this.clusters.hippocampus.injectCurrent(hippoCurrent);

    // Store in Hopfield memory
    const memPattern = this.clusters.hippocampus.getOutput(MODULE_SIZE);
    for (let i = 0; i < memPattern.length; i++) memPattern[i] = memPattern[i] > 0.5 ? 1 : -1;
    this.hippocampusMod.store(memPattern);

    // Amygdala gets a social-input arousal bump
    const amygCurrent = new Float64Array(CLUSTER_SIZES.amygdala);
    for (let i = 0; i < CLUSTER_SIZES.amygdala; i++) amygCurrent[i] = 3.0;
    this.clusters.amygdala.injectCurrent(amygCurrent);

    this.reward += 0.2;
  }

  processVisualInput(gazeX, gazeY, target = '') {
    // Visual input goes to cortex (visual processing area = first 100 neurons)
    const cortexCurrent = new Float64Array(CLUSTER_SIZES.cortex);
    const gCol = Math.floor(gazeX * 15); // map to first 150 cortex neurons (visual)
    const gRow = Math.floor(gazeY * 10);
    for (let i = 0; i < 150; i++) {
      const col = i % 15;
      const row = Math.floor(i / 15);
      const dist = Math.sqrt((col - gCol) ** 2 + (row - gRow) ** 2);
      cortexCurrent[i] = Math.max(0, 8.0 - dist * 1.5);
    }
    this.clusters.cortex.injectCurrent(cortexCurrent);

    // Target name goes to hippocampus (semantic association)
    if (target) {
      const hippoCurrent = new Float64Array(CLUSTER_SIZES.hippocampus);
      for (let i = 0; i < target.length; i++) {
        const code = target.charCodeAt(i);
        const idx = (code * 17 + i * 13) % CLUSTER_SIZES.hippocampus;
        hippoCurrent[idx] += 4.0;
      }
      this.clusters.hippocampus.injectCurrent(hippoCurrent);
    }

    this.reward += 0.05;
  }

  // ── Accessors ──────────────────────────────────────────────────

  getState() { return this.state; }

  getSelectedAction() {
    if (!this.state.basalGanglia) return null;
    return { action: this.state.basalGanglia.selectedAction, confidence: this.state.basalGanglia.confidence };
  }

  setDrugState(name) {
    if (!this.persona.drugStates[name]) { console.warn(`unknown drug state: "${name}"`); return; }
    this.drugState = name;
    this.brainParams = getBrainParams(this.persona, name);
    this.mystery.setWeights(this.brainParams.mysteryWeights);
    // Update cluster tonic drives based on new drug state
    const arousal = this.brainParams.arousalBaseline || 0.9;
    this.clusters.cortex.tonicDrive = 14 + arousal * 6;
    this.clusters.amygdala.tonicDrive = 15 + arousal * 8;
    this.clusters.mystery.noiseAmplitude = 12 * (this.brainParams.chaos ? 1.5 : 1.0);
  }

  // ── Helpers ──────────────────────────────────────────────────────

  _meanAbs(arr) {
    if (!arr) return 0;
    if (typeof arr === 'number') return Math.abs(arr);
    if (arr.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < arr.length; i++) sum += Math.abs(arr[i]);
    return sum / arr.length;
  }

  _generateIdleThought() {
    const state = this.state;
    const arousal = state.amygdala?.arousal || 0.5;
    const coherence = state.oscillations?.coherence || 0;
    this.emit('thought', {
      arousal,
      coherence,
      psi: state.psi,
      action: state.basalGanglia?.selectedAction || 'idle',
      time: this.time,
    });
  }
}

export default UnityBrain;
