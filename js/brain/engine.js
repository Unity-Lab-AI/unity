/**
 * engine.js — THE BRAIN. The only brain. Runs everything.
 *
 * ARCHITECTURE:
 *   Sensory input → Neural clusters → Module processing → Motor output
 *   The brain DECIDES. Peripherals EXECUTE. index.html DISPLAYS.
 *
 *   1000 neurons in 7 clusters with 16 inter-cluster projections.
 *   Sensory processor converts raw input to neural currents.
 *   Motor output reads basal ganglia spikes to select actions.
 *   Broca's area (language peripheral) generates text when asked.
 *   Visual cortex processes camera frames through V1→V4→IT pipeline.
 *   Auditory cortex processes mic spectrum continuously.
 *   Memory system stores/recalls episodic memories.
 *
 * No external dependencies. Pure ES modules. 60fps.
 */

import { NeuronCluster, ClusterProjection } from './cluster.js';
import { Cortex, Hippocampus, Amygdala, BasalGanglia, Cerebellum, Hypothalamus } from './modules.js';
import { MysteryModule } from './mystery.js';
import { OscillatorNetwork } from './oscillations.js';
import { UNITY_PERSONA, loadPersona, getBrainParams } from './persona.js';
import { SensoryProcessor } from './sensory.js';
import { MotorOutput } from './motor.js';
import { MemorySystem } from './memory.js';
import { AuditoryCortex } from './auditory-cortex.js';
import { VisualCortex } from './visual-cortex.js';

// ── EventEmitter ────────────────────────────────────────────────────

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
const MEMORY_SALIENCE_THRESHOLD = 0.6; // salience above this stores episodic memory
const RECALL_ERROR_THRESHOLD = 0.4;    // cortex error above this triggers recall

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

    // ══════════════════════════════════════════════════════════════
    // NEURAL CLUSTERS — 7 dedicated regions
    // ══════════════════════════════════════════════════════════════

    this.clusters = {
      cortex: new NeuronCluster('cortex', CLUSTER_SIZES.cortex, {
        tonicDrive: 14 + arousal * 6, noiseAmplitude: 7,
        connectivity: 0.15, excitatoryRatio: 0.85, learningRate: 0.002,
      }),
      hippocampus: new NeuronCluster('hippocampus', CLUSTER_SIZES.hippocampus, {
        tonicDrive: 12 + arousal * 4, noiseAmplitude: 5,
        connectivity: 0.20, excitatoryRatio: 0.75, learningRate: 0.003,
      }),
      amygdala: new NeuronCluster('amygdala', CLUSTER_SIZES.amygdala, {
        tonicDrive: 15 + arousal * 8, noiseAmplitude: 10,
        connectivity: 0.12, excitatoryRatio: 0.7, learningRate: 0.001,
      }),
      basalGanglia: new NeuronCluster('basalGanglia', CLUSTER_SIZES.basalGanglia, {
        tonicDrive: 10 + arousal * 5, noiseAmplitude: 8,
        connectivity: 0.10, excitatoryRatio: 0.6, learningRate: 0.005,
      }),
      cerebellum: new NeuronCluster('cerebellum', CLUSTER_SIZES.cerebellum, {
        tonicDrive: 12 + arousal * 3, noiseAmplitude: 4,
        connectivity: 0.18, excitatoryRatio: 0.9, learningRate: 0.004,
      }),
      hypothalamus: new NeuronCluster('hypothalamus', CLUSTER_SIZES.hypothalamus, {
        tonicDrive: 16, noiseAmplitude: 3,
        connectivity: 0.25, excitatoryRatio: 0.8, learningRate: 0.0005,
      }),
      mystery: new NeuronCluster('mystery', CLUSTER_SIZES.mystery, {
        tonicDrive: 13 + arousal * 5, noiseAmplitude: 12,
        connectivity: 0.30, excitatoryRatio: 0.7, learningRate: 0.001,
      }),
    };

    // ══════════════════════════════════════════════════════════════
    // INTER-CLUSTER PROJECTIONS — 16 pathways
    // ══════════════════════════════════════════════════════════════

    const c = this.clusters;
    this.projections = [
      new ClusterProjection(c.cortex, c.hippocampus, 0.04, 0.4),
      new ClusterProjection(c.cortex, c.amygdala, 0.03, 0.3),
      new ClusterProjection(c.cortex, c.basalGanglia, 0.03, 0.3),
      new ClusterProjection(c.cortex, c.cerebellum, 0.05, 0.3),
      new ClusterProjection(c.hippocampus, c.cortex, 0.04, 0.4),
      new ClusterProjection(c.amygdala, c.cortex, 0.03, 0.3),
      new ClusterProjection(c.amygdala, c.hippocampus, 0.04, 0.5),
      new ClusterProjection(c.basalGanglia, c.cortex, 0.02, 0.2),
      new ClusterProjection(c.cerebellum, c.cortex, 0.03, 0.2),
      new ClusterProjection(c.cerebellum, c.basalGanglia, 0.03, 0.2),
      new ClusterProjection(c.hypothalamus, c.amygdala, 0.05, 0.4),
      new ClusterProjection(c.hypothalamus, c.basalGanglia, 0.04, 0.3),
      new ClusterProjection(c.mystery, c.cortex, 0.05, 0.3),
      new ClusterProjection(c.mystery, c.amygdala, 0.05, 0.3),
      new ClusterProjection(c.mystery, c.hippocampus, 0.03, 0.2),
      new ClusterProjection(c.mystery, c.basalGanglia, 0.03, 0.2),
    ];

    // ══════════════════════════════════════════════════════════════
    // EQUATION MODULES — run on downsampled cluster output
    // ══════════════════════════════════════════════════════════════

    this.cortexMod = new Cortex(MODULE_SIZE);
    this.hippocampusMod = new Hippocampus(MODULE_SIZE);
    this.amygdalaMod = new Amygdala(MODULE_SIZE, { arousalBaseline: arousal });
    this.basalGangliaMod = new BasalGanglia(MODULE_SIZE);
    this.cerebellumMod = new Cerebellum(MODULE_SIZE);
    this.hypothalamusMod = new Hypothalamus(5);
    this.mystery = new MysteryModule(this.brainParams.mysteryWeights);
    this.oscillators = new OscillatorNetwork(OSCILLATOR_COUNT);
    this.oscCoupling = new Float64Array(OSCILLATOR_COUNT * OSCILLATOR_COUNT);
    this._initOscCoupling();

    // ══════════════════════════════════════════════════════════════
    // BRAIN SUBSYSTEMS — sensory, motor, memory, visual, auditory
    // ══════════════════════════════════════════════════════════════

    this.sensory = new SensoryProcessor();
    this.motor = new MotorOutput();
    this.memorySystem = new MemorySystem(this.clusters.hippocampus);
    this.auditoryCortex = new AuditoryCortex();
    this.visualCortex = new VisualCortex();

    // ══════════════════════════════════════════════════════════════
    // STATE
    // ══════════════════════════════════════════════════════════════

    this.time = 0;
    this.reward = 0;
    this.frameCount = 0;
    this.running = false;
    this._rafId = null;
    this.lastThoughtTime = 0;
    this.lastAction = 'idle';

    this.state = {
      spikes: null, voltages: null, spikeCount: 0,
      clusters: {}, cortex: null, hippocampus: null,
      amygdala: null, basalGanglia: null, cerebellum: null,
      hypothalamus: null, mystery: null, oscillations: null,
      psi: 0, time: 0, reward: 0, drugState: this.drugState,
      totalNeurons: TOTAL_NEURONS,
      motor: null, memory: null, sensory: null,
      visualCortex: null, auditoryCortex: null,
    };
  }

  _initOscCoupling() {
    const n = OSCILLATOR_COUNT;
    const base = COUPLING_BASE * (this.brainParams.oscillationCoherence || 1.0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        this.oscCoupling[i * n + j] = base * Math.exp(-Math.abs(i - j) * 0.3);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════
  // CORE SIMULATION STEP — the heartbeat
  // ══════════════════════════════════════════════════════════════

  step(dt = DT) {
    // ── 1. SENSORY INPUT — process all pending input into neural currents ──
    const sensoryOutput = this.sensory.process();

    // ── 2. AUDITORY CORTEX — continuous audio processing ──
    if (this.auditoryCortex.isActive()) {
      this.auditoryCortex.setGain(this.state.amygdala?.arousal ?? 0.5);
      const audioCurrents = this.auditoryCortex.process();
      // Inject into cortex auditory region (neurons 0-49)
      this.clusters.cortex.injectCurrent(audioCurrents);
    }

    // ── 3. VISUAL CORTEX — process camera frames through V1→V4→IT ──
    if (this.visualCortex.isActive() && this.frameCount % 3 === 0) {
      const visOutput = this.visualCortex.processFrame();
      // Inject V1 edge responses into cortex visual region (neurons 50-149)
      const visCurrent = new Float64Array(CLUSTER_SIZES.cortex);
      for (let i = 0; i < visOutput.currents.length && i < 100; i++) {
        visCurrent[50 + i] = visOutput.currents[i];
      }
      this.clusters.cortex.injectCurrent(visCurrent);
    }

    // ── 4. INJECT SENSORY CURRENTS into clusters ──
    this.clusters.cortex.injectCurrent(sensoryOutput.cortex);
    this.clusters.hippocampus.injectCurrent(sensoryOutput.hippocampus);
    this.clusters.amygdala.injectCurrent(sensoryOutput.amygdala);

    // ── 5. INTER-CLUSTER PROJECTIONS ──
    for (const proj of this.projections) proj.propagate();

    // ── 6. STEP ALL CLUSTERS ──
    const clusterResults = {};
    let totalSpikes = 0;
    for (const [name, cluster] of Object.entries(this.clusters)) {
      const result = cluster.step(dt);
      clusterResults[name] = result;
      totalSpikes += result.spikeCount;
    }

    // ── 7. MODULE EQUATION PROCESSING ──
    const cortexInput = this.clusters.cortex.getOutput(MODULE_SIZE);
    const hippoInput = this.clusters.hippocampus.getOutput(MODULE_SIZE);
    const amygInput = this.clusters.amygdala.getOutput(MODULE_SIZE);
    const bgInput = this.clusters.basalGanglia.getOutput(MODULE_SIZE);
    const cerebInput = this.clusters.cerebellum.getOutput(MODULE_SIZE);

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

    const cortexOut = this.cortexMod.step(cortexInput, brainState, dt);
    const hippoOut = this.hippocampusMod.step(hippoInput, brainState, dt);
    const amygdalaOut = this.amygdalaMod.step(amygInput, brainState, dt);
    const hypoInput = new Float64Array(5);
    hypoInput[0] = amygdalaOut.arousal;
    const hypoOut = this.hypothalamusMod.step(hypoInput, brainState, dt);
    const cerebOut = this.cerebellumMod.step(cerebInput, brainState, dt);
    const bgOut = this.basalGangliaMod.step(bgInput, brainState, dt);

    // ── 8. MYSTERY MODULE — consciousness ──
    brainState.amygdala = amygdalaOut;
    brainState.cortex.predictionAccuracy = 1.0 - this._meanAbs(cortexOut.error);
    brainState.memory.stability = hippoOut.isStable ? 1.0 : 0.5;
    brainState.cerebellum.errorRate = this._meanAbs(cerebOut.error);
    brainState.oscillation.coherence = this.oscillators.getCoherence();
    const mysteryOut = this.mystery.step(brainState, dt);

    // ── 9. HIERARCHICAL MODULATION ──
    const emotionalGate = 0.7 + amygdalaOut.arousal * 0.6;
    const driveFactor = 0.8 + (hypoOut.needsAttention?.length > 0 ? 0.4 : 0.0);
    const psiGain = Math.max(0.8, Math.min(1.5, 0.9 + mysteryOut.psi * 0.05));
    const errorSignal = this._meanAbs(cerebOut.error) * 2;

    for (const cluster of Object.values(this.clusters)) {
      cluster.emotionalGate = emotionalGate;
      cluster.driveBaseline = driveFactor;
      cluster.gainMultiplier = psiGain;
    }
    this.clusters.amygdala.emotionalGate = 1.0;
    this.clusters.cortex.errorCorrection = -errorSignal;
    this.clusters.basalGanglia.errorCorrection = -errorSignal * 0.5;

    // Action gating from basal ganglia
    const selectedAction = bgOut.selectedAction;
    for (const cluster of Object.values(this.clusters)) cluster.actionGate = 0.9;
    if (selectedAction === 'respond_text') this.clusters.cortex.actionGate = 1.3;
    else if (selectedAction === 'generate_image') this.clusters.cortex.actionGate = 1.2;
    else if (selectedAction === 'search_web') this.clusters.hippocampus.actionGate = 1.3;
    else if (selectedAction === 'build_ui') this.clusters.cortex.actionGate = 1.4;

    // ── 10. PLASTICITY — each cluster learns ──
    const globalReward = this.reward + amygdalaOut.valence * 0.1;
    for (const cluster of Object.values(this.clusters)) cluster.learn(globalReward);

    // ── 11. MEMORY — store/recall ──
    if (sensoryOutput.salience > MEMORY_SALIENCE_THRESHOLD) {
      this.memorySystem.storeEpisode({
        clusters: this._getClusterStates(),
        amygdala: amygdalaOut,
        psi: mysteryOut.psi,
        time: this.time,
        trigger: 'high_salience',
      });
    }

    const cortexError = this._meanAbs(cortexOut.error);
    if (cortexError > RECALL_ERROR_THRESHOLD) {
      const recall = this.memorySystem.recall({
        clusters: this._getClusterStates(),
        amygdala: amygdalaOut,
        psi: mysteryOut.psi,
      });
      if (recall) {
        this.clusters.hippocampus.injectCurrent(recall.currents);
        this.emit('recall', recall.episode);
      }
    }

    this.memorySystem.updateWorkingMemory(cortexInput);

    // ── 11.5. VISUAL ATTENTION ──
    // Look ONCE on boot. After that, ONLY when forceDescribe() is called
    // explicitly by processAndRespond (user asked something visual).
    // No automatic triggers. No salience checks. Just boot + on demand.
    if (this.visualCortex.isActive() && !this.visualCortex._hasDescribedOnce) {
      this.visualCortex.forceDescribe();
    }

    // ── 12. MOTOR OUTPUT — read BG spikes for action ──
    const motorResult = this.motor.readOutput(
      clusterResults.basalGanglia.spikes,
      { amygdala: amygdalaOut, hypothalamus: hypoOut }
    );

    // ── 13. OSCILLATIONS ──
    this.oscillators.step(dt, this.oscCoupling);
    const coherence = this.oscillators.getCoherence();
    const bandPower = this.oscillators.getBandPower();

    // ── 14. DECAY ──
    this.reward *= 0.99;
    this.time += dt;

    // ── 15. BUILD COMBINED STATE ──
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
      motor: motorResult,
      memory: this.memorySystem.getState(),
      sensory: { salience: sensoryOutput.salience },
      visualCortex: this.visualCortex.getState(),
      auditoryCortex: this.auditoryCortex.getState(),
      visionDescription: this.visualCortex.description,
    };

    // ── 16. EMIT EVENTS ──
    if (motorResult.shouldExecute && motorResult.action !== 'idle' && motorResult.action !== 'listen') {
      this.emit('action', motorResult);
    }
    if (bgOut.selectedAction !== this.lastAction) {
      this.lastAction = bgOut.selectedAction;
    }
    if (hypoOut.needsAttention?.length > 0) {
      this.emit('needsAttention', { drives: hypoOut.needsAttention, time: this.time });
    }
    this.emit('stateUpdate', this.state);

    return this.state;
  }

  // ══════════════════════════════════════════════════════════════
  // THINK LOOP — 60fps, never stops
  // ══════════════════════════════════════════════════════════════

  think() {
    if (!this.running) return;
    for (let i = 0; i < STEPS_PER_FRAME; i++) this.step(DT);
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

  // ══════════════════════════════════════════════════════════════
  // PUBLIC API — for app.js (thin I/O layer)
  // ══════════════════════════════════════════════════════════════

  /**
   * Receive sensory input. This is the ONLY way to feed data into the brain.
   * app.js calls this — nothing else.
   */
  receiveSensoryInput(type, data) {
    switch (type) {
      case 'text':
        // Just queue the text for sensory processing.
        // Motor interrupt + amygdala surprise handled by processAndRespond().
        this.sensory.receiveText(data);
        break;
      case 'audio':
        // Audio is continuous — handled by auditoryCortex.process() each step
        break;
      case 'video':
        // Video is continuous — handled by visualCortex.processFrame() each step
        break;
      default:
        console.warn(`[Brain] Unknown sensory type: ${type}`);
    }
  }

  /** Connect Broca's area (language generation peripheral). */
  connectLanguage(brocasArea) {
    this._brocasArea = brocasArea;
  }

  /** Connect voice output peripheral. */
  connectVoice(voiceIO) {
    this._voice = voiceIO;
  }

  /** Connect image generation peripheral. */
  connectImageGen(pollinationsAI, sandboxRef, storageRef) {
    this._imageGen = pollinationsAI;
    this._sandbox = sandboxRef;
    this._storage = storageRef;
  }

  /**
   * Process text input AND generate a response — the brain does EVERYTHING.
   * Called by app.js. Returns the response for display purposes only.
   * Speech is handled internally by the brain.
   */
  async processAndRespond(text) {
    // 1. Motor cortex interrupt — stop any ongoing speech
    this.motor.interrupt();
    if (this._voice) this._voice.stopSpeaking();
    if (this._brocasArea) this._brocasArea.abort();

    // 2. Feed sensory input
    this.sensory.receiveText(text);

    // Amygdala surprise
    if (this.clusters.amygdala) {
      const surprise = new Float64Array(this.clusters.amygdala.size);
      for (let i = 0; i < 30; i++) surprise[i] = 5.0;
      this.clusters.amygdala.injectCurrent(surprise);
    }

    // Clear our own interrupt flag
    this.motor._interruptFlag = false;

    // 3. Check if user asked something visual — trigger a look ON DEMAND
    const visualQ = ['see', 'look', 'color', 'wearing', 'holding', 'hat',
      'shirt', 'background', 'behind', 'room', 'face', 'hair', 'what am',
      'what is', 'glasses', 'describe', 'can you see'].some(w => text.toLowerCase().includes(w));
    if (visualQ && this.visualCortex.isActive()) {
      this.visualCortex.forceDescribe();
    }

    // 4. Let neural dynamics propagate
    await this._sleep(100);

    // 5. Wait for visual cortex if it's describing
    if (this.visualCortex.isActive() && this.visualCortex._describing) {
      const start = Date.now();
      while (this.visualCortex._describing && Date.now() - start < 5000) {
        await this._sleep(200);
      }
    }

    // 5. Check for BUILD request first (UI components, apps, tools)
    const lower = text.toLowerCase();
    const buildWords = ['build', 'create a', 'make a', 'make me', 'give me a',
      'add a', 'put a', 'app', 'tool', 'widget', 'component', 'editor',
      'game', 'calculator', 'timer', 'clock', 'player', 'chat box',
      'drawing app', 'paint', 'canvas app', 'code editor'];
    const isBuild = buildWords.some(w => lower.includes(w));

    // 6. Check for image/selfie request (only if NOT a build request)
    // Image detection — ONLY explicit image requests, not "show me how" or "send me info"
    const imageWords = ['selfie', 'take a picture', 'take a photo', 'take a pic',
      'send a pic', 'send a photo', 'send a selfie', 'send me a pic',
      'generate an image', 'generate image', 'draw me a', 'draw a picture',
      'full body shot', 'headshot', 'head shot', 'portrait of'];
    const isImage = !isBuild && imageWords.some(w => lower.includes(w));
    // Selfie = image request specifically of Unity (not "draw me a sunset")
    const selfWords = ['yourself', 'of you', 'your face', 'your body', 'unity',
      'of yourself', 'you look like', 'selfie'];
    const isSelfie = isImage && selfWords.some(w => lower.includes(w));

    if (isBuild && this._brocasArea && this._sandbox) {
      return this._handleBuild(text);
    } else if ((isImage || isSelfie) && this._imageGen) {
      return this._handleImage(text, isSelfie);
    }

    // 6. Normal response — Broca's area generates language from brain state
    if (!this._brocasArea) return { text: null, action: 'idle' };
    const state = this.getState();
    let response = await this._brocasArea.generate(state, text);

    if (!response) {
      await this._sleep(1000);
      response = await this._brocasArea.generate(state, text);
    }

    if (!response) return { text: "Shit — brain glitched. Say that again?", action: 'respond_text' };

    // Strip fake URLs
    response = response.replace(/https?:\/\/[^\s)]+\.(jpg|png|gif|webp)/gi, '')
                       .replace(/https?:\/\/pollinations\.ai[^\s)"]*/gi, '')
                       .replace(/```[^`]*```/g, '').trim();

    if (this.motor.wasInterrupted()) return { text: null, action: 'interrupted' };

    // 7. SPEAK — the brain controls speech output
    if (this._voice) {
      this._voice.stopSpeaking();
      this.auditoryCortex.setMotorOutput(response);
      this._voice.speak(response).then(() => {
        this.auditoryCortex.clearMotorOutput();
      }).catch(() => { this.auditoryCortex.clearMotorOutput(); });
    }

    this.reward += 0.1;
    this.emit('response', { text: response, action: 'respond_text' });
    return { text: response, action: 'respond_text' };
  }

  async _handleBuild(text) {
    const buildPrompt = [
      '[SYSTEM: Generate a JSON response (ONLY valid JSON, no markdown fences) with these keys:',
      '  { "html": "...", "css": "...", "js": "...", "id": "..." }',
      'The response creates a self-contained UI component for what the user asked.',
      'Rules:',
      '- "id" is a short unique kebab-case identifier.',
      '- "html" is raw HTML (no <script> or <style> tags).',
      '- "css" is CSS rules.',
      '- "js" is JavaScript that runs after injection. It has access to a `unity` API:',
      '    unity.speak(text), unity.chat(prompt), unity.generateImage(prompt),',
      '    unity.getState(), unity.storage.get(k), unity.storage.set(k,v)',
      '- Use dark styling: #0a0a0a backgrounds, #e0e0e0 text, neon accents (#ff00ff, #00ffcc).',
      '- Wrap inputs in labels or use for/id pairs for accessibility.',
      '- Be creative. Make it functional. All strings properly escaped.',
      '- Return ONLY the JSON object. No text before or after. No markdown fences.]',
    ].join('\n');

    let raw = await this._brocasArea.generate(this.getState(), buildPrompt + '\n\nUser request: ' + text);
    if (!raw) {
      this.emit('response', { text: "Shit — couldn't build that. Try again?", action: 'build_ui' });
      return { text: "Shit — couldn't build that. Try again?", action: 'build_ui' };
    }

    console.log('[Brain] Build raw response length:', raw.length);

    // Parse JSON — try multiple extraction strategies
    let component;

    // Strategy 1: strip markdown fences and parse
    try {
      const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      component = JSON.parse(cleaned);
    } catch {}

    // Strategy 2: find the outermost { } block
    if (!component) {
      const firstBrace = raw.indexOf('{');
      const lastBrace = raw.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        try { component = JSON.parse(raw.slice(firstBrace, lastBrace + 1)); } catch {}
      }
    }

    // Strategy 3: the AI returned conversational text, not JSON — ask again more forcefully
    if (!component) {
      console.warn('[Brain] Build: first attempt wasn\'t JSON, retrying...');
      raw = await this._brocasArea.generate(this.getState(),
        '[SYSTEM: You MUST return ONLY a JSON object. No text before or after. No markdown. Just: {"html":"...","css":"...","js":"...","id":"..."}\n\nBuild: ' + text
      );
      if (raw) {
        const firstBrace = raw.indexOf('{');
        const lastBrace = raw.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          try { component = JSON.parse(raw.slice(firstBrace, lastBrace + 1)); } catch {}
        }
      }
    }

    if (!component || (!component.html && !component.js)) {
      console.error('[Brain] Build: all parse strategies failed');
      this.emit('response', { text: "Brain couldn't format that right. Say it differently?", action: 'build_ui' });
      return { text: "Brain couldn't format that right. Say it differently?", action: 'build_ui' };
    }

    const { html, css, js, id } = component;
    const componentId = id || ('unity-' + Date.now());
    this._sandbox.inject({ id: componentId, html: html || '', css: css || '', js: js || '' });

    const quip = `Built it — "${componentId}". Check the sandbox.`;
    if (this._voice) {
      this._voice.stopSpeaking();
      this._voice.speak(quip).catch(() => {});
    }

    this.reward += 0.2;
    this.emit('response', { text: quip, action: 'build_ui' });
    return { text: quip, action: 'build_ui' };
  }

  async _handleImage(text, includesSelf) {
    // ONE image handler. If she's in the image (includesSelf), she adds her appearance.
    // Uses Pollinations text API directly for prompt generation — NOT Broca's area,
    // because Broca's full persona prompt makes the AI roleplay instead of outputting clean prompts.

    let prompt;
    const selfDesc = includesSelf
      ? '25 year old woman, heterochromia eyes one violet one electric green, dark hair with neon streaks, smudged eyeliner, adult, '
      : '';

    try {
      // Call Pollinations DIRECTLY for prompt generation — no persona, no roleplay
      const raw = await this._imageGen.chat?.([
        { role: 'user', content: `Generate ONLY an image prompt for: "${text}". ${includesSelf ? 'The subject is a 25 year old woman with heterochromia eyes (violet and green), dark hair with neon streaks, smudged eyeliner. Include her in the scene.' : ''} Return ONLY the visual description. No explanation. No URLs. No markdown. Just the prompt.` },
      ], { temperature: 0.8 }) || null;

      if (raw) {
        prompt = raw.replace(/https?:\/\/[^\s)]+/g, '').replace(/```/g, '').replace(/\n/g, ', ').trim();
      }
    } catch {}

    // Fallback — build prompt from the text directly
    if (!prompt || prompt.length < 15) {
      prompt = `${selfDesc}${text.replace(/selfie|send|show|picture|photo|of you|yourself/gi, '').trim() || 'striking candid shot'}, photorealistic, cinematic lighting`;
    }

    // Ensure self-description is in there if it's a selfie
    if (includesSelf && !prompt.includes('25 year old')) {
      prompt = selfDesc + prompt;
    }

    console.log('[Brain] Image prompt:', prompt.slice(0, 100));
    const url = this._imageGen.generateImage(prompt, { model: this._storage?.get('image_model') || 'flux', width: 768, height: 768 });

    if (url) {
      window.open(url, '_blank');
      if (this._sandbox) {
        const imgId = 'img_' + Date.now();
        this._sandbox.inject({ id: imgId, html: `<div style="margin:12px 0;text-align:center;"><div id="${imgId}-loading" style="color:#777;font-size:12px;font-family:monospace;padding:20px;">Generating...</div><img src="${url}" alt="" style="max-width:100%;border-radius:8px;border:1px solid #333;cursor:pointer;display:none;" onload="this.style.display='block';if(document.getElementById('${imgId}-loading'))document.getElementById('${imgId}-loading').style.display='none';" onerror="if(document.getElementById('${imgId}-loading'))document.getElementById('${imgId}-loading').textContent='Loading in new tab...';" onclick="window.open('${url}','_blank')"></div>`, css: '' });
      }
    }

    this.reward += 0.1;
    // Single response emission — no separate quip, no extra speech
    this.emit('response', { text: 'Image generating.', action: 'generate_image' });
    return { text: 'Image generating.', action: 'generate_image' };
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  /** Connect microphone for continuous auditory processing. */
  connectMicrophone(analyser) {
    this.sensory.setAudioAnalyser(analyser);
    this.auditoryCortex.init(analyser);
  }

  /** Connect camera for continuous visual processing. */
  connectCamera(stream, videoElement) {
    this.sensory.setCameraStream(stream);
    // Wait a tick for sensory to create its video element, then init visual cortex
    setTimeout(() => {
      const vid = videoElement || this.sensory._videoElement;
      if (vid) {
        this.visualCortex.init(vid);
        console.log('[Brain] Visual cortex connected to camera');
      } else {
        console.warn('[Brain] No video element available for visual cortex');
      }
    }, 500);
  }

  /** Register action handlers on the motor output. */
  onAction(action, handler) {
    this.motor.onAction(action, handler);
  }

  /** Inject reward signal (positive = good, negative = bad). */
  giveReward(amount) {
    this.reward += amount;
    this.motor.reinforceAction(this.clusters.basalGanglia, amount);
  }

  getState() { return this.state; }

  getSelectedAction() {
    return this.motor.getState();
  }

  setDrugState(name) {
    if (!this.persona.drugStates[name]) return;
    this.drugState = name;
    this.brainParams = getBrainParams(this.persona, name);
    this.mystery.setWeights(this.brainParams.mysteryWeights);
    const arousal = this.brainParams.arousalBaseline || 0.9;
    this.clusters.cortex.tonicDrive = 14 + arousal * 6;
    this.clusters.amygdala.tonicDrive = 15 + arousal * 8;
    this.clusters.mystery.noiseAmplitude = 12 * (this.brainParams.chaos ? 1.5 : 1.0);
  }

  // ══════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════

  _meanAbs(arr) {
    if (!arr) return 0;
    if (typeof arr === 'number') return Math.abs(arr);
    if (arr.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < arr.length; i++) sum += Math.abs(arr[i]);
    return sum / arr.length;
  }

  _getClusterStates() {
    const states = {};
    for (const [name, cluster] of Object.entries(this.clusters)) {
      states[name] = cluster.getState();
    }
    return states;
  }

  _generateIdleThought() {
    this.emit('thought', {
      arousal: this.state.amygdala?.arousal || 0.5,
      coherence: this.state.oscillations?.coherence || 0,
      psi: this.state.psi,
      action: this.motor.selectedAction,
      time: this.time,
    });
  }
}

export default UnityBrain;
