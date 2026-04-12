/**
 * sensory.js — Sensory Input Pipeline
 *
 * ALL input to the brain enters here. Text, audio, video frames.
 * Each input type maps to a specific cortex region with biologically
 * inspired organization:
 *
 * Cortex layout (300 neurons):
 *   0-49:    Auditory cortex (tonotopic — low freq→low neuron)
 *   50-149:  Visual cortex (retinotopic — 10x10 grid)
 *   150-299: Language area / Wernicke's (text comprehension)
 *
 * No external dependencies. Pure neural current generation.
 */

const CORTEX_SIZE = 300;
const AUDITORY_START = 0;
const AUDITORY_END = 50;
const VISUAL_START = 50;
const VISUAL_END = 150;
const LANGUAGE_START = 150;
const LANGUAGE_END = 300;

// Visual grid dimensions within visual cortex region
const VIS_COLS = 10;
const VIS_ROWS = 10;

export class SensoryProcessor {
  constructor() {
    // Pending inputs — brain reads and clears each step
    this._textQueue = [];
    this._audioSpectrum = null;    // Uint8Array from Web Audio analyser
    this._videoFrame = null;       // ImageData or brightness grid
    this._videoCanvas = null;
    this._videoCtx = null;
    this._videoElement = null;

    // Processed current buffers (injected into clusters each brain step)
    this.cortexCurrent = new Float64Array(CORTEX_SIZE);
    this.hippoCurrent = new Float64Array(200);  // hippocampus size
    this.amygdalaCurrent = new Float64Array(150); // amygdala size
    this.bgCurrent = new Float64Array(150);     // basal ganglia — 6 channels × 25 neurons

    // Semantic → motor mapping weights (LEARNABLE via reward)
    // These weights determine how strongly each semantic category excites each BG channel.
    // They start with reasonable priors and get shaped by reward signals over time.
    // BG channels: 0-24=respond_text, 25-49=generate_image, 50-74=speak, 75-99=build_ui, 100-124=listen, 125-149=idle
    this._semanticWeights = {
      respond:  new Float64Array(150), // text response channel weights
      image:    new Float64Array(150), // image generation channel weights
      speak:    new Float64Array(150), // vocalization channel weights
      build:    new Float64Array(150), // UI building channel weights
      listen:   new Float64Array(150), // listen/wait channel weights
      idle:     new Float64Array(150), // idle channel weights
    };
    this._initSemanticWeights();

    // Audio analyser reference
    this._analyser = null;
    this._audioData = null;

    // Vision state
    this._lastFrameTime = 0;
    this._frameInterval = 200; // capture every 200ms (5fps for vision)
    this._cameraStream = null;

    // Salience tracking — how "important" current input is
    this.salience = 0;
    this._prevSalience = 0;
  }

  _initSemanticWeights() {
    // Initialize with biological priors — the brain starts knowing roughly
    // what kinds of input should lead to what kinds of action.
    // These get refined through reward-modulated learning.
    const w = this._semanticWeights;

    // respond_text channel (0-24) — default for most conversational input
    for (let i = 0; i < 25; i++) w.respond[i] = 0.6 + Math.random() * 0.2;

    // generate_image channel (25-49) — visual/creative content
    for (let i = 25; i < 50; i++) w.image[i] = 0.5 + Math.random() * 0.2;

    // speak channel (50-74) — idle vocalization
    for (let i = 50; i < 75; i++) w.speak[i] = 0.2 + Math.random() * 0.1;

    // build_ui channel (75-99) — construction/tool requests
    for (let i = 75; i < 100; i++) w.build[i] = 0.5 + Math.random() * 0.2;

    // listen channel (100-124) — questions directed at user
    for (let i = 100; i < 125; i++) w.listen[i] = 0.3 + Math.random() * 0.1;

    // idle channel (125-149) — low arousal, nothing happening
    for (let i = 125; i < 150; i++) w.idle[i] = 0.4 + Math.random() * 0.1;
  }

  /**
   * Reinforce semantic→motor mapping based on reward.
   * Called by the brain engine when an action succeeds or fails.
   * This is how the BG LEARNS which input patterns lead to which actions.
   *
   * @param {string} action — which action succeeded/failed
   * @param {number} reward — positive = reinforce, negative = weaken
   */
  reinforceSemanticMapping(action, reward) {
    const channelMap = { respond_text: 'respond', generate_image: 'image', speak: 'speak', build_ui: 'build', listen: 'listen', idle: 'idle' };
    const key = channelMap[action];
    if (!key || !this._semanticWeights[key]) return;
    const w = this._semanticWeights[key];
    const lr = 0.01; // learning rate
    for (let i = 0; i < 150; i++) {
      w[i] = Math.max(0, Math.min(2, w[i] + lr * reward * (this.bgCurrent[i] > 0 ? 1 : 0)));
    }
  }

  // ── Setup ──────────────────────────────────────────────────────

  /**
   * Connect microphone audio analyser for continuous auditory input.
   */
  setAudioAnalyser(analyser) {
    this._analyser = analyser;
    this._audioData = new Uint8Array(analyser.frequencyBinCount);
  }

  /**
   * Connect camera stream for visual input.
   */
  setCameraStream(stream) {
    this._cameraStream = stream;
    this._videoElement = document.createElement('video');
    this._videoElement.srcObject = stream;
    this._videoElement.setAttribute('playsinline', '');
    this._videoElement.muted = true;
    this._videoElement.style.display = 'none';
    document.body.appendChild(this._videoElement);
    this._videoElement.play();

    this._videoCanvas = document.createElement('canvas');
    this._videoCanvas.width = VIS_COLS;
    this._videoCanvas.height = VIS_ROWS;
    this._videoCtx = this._videoCanvas.getContext('2d', { willReadFrequently: true });
  }

  // ── Input Methods (called by app.js / voice handler) ──────────

  /**
   * Receive text input (from voice transcription or typed).
   * Queued and processed on next brain step.
   */
  receiveText(text) {
    this._textQueue.push(text);
  }

  // ── Processing (called by brain engine each step) ─────────────

  /**
   * Process all pending sensory input and generate neural currents.
   * Called once per brain step by engine.js.
   * Returns current buffers for injection into clusters.
   */
  process() {
    // Decay previous currents (sensory adaptation)
    for (let i = 0; i < CORTEX_SIZE; i++) this.cortexCurrent[i] *= 0.85;
    for (let i = 0; i < 200; i++) this.hippoCurrent[i] *= 0.9;
    for (let i = 0; i < 150; i++) this.amygdalaCurrent[i] *= 0.9;
    for (let i = 0; i < 150; i++) this.bgCurrent[i] *= 0.85;

    this._prevSalience = this.salience;
    this.salience = 0;

    // Process each modality
    this._processAudio();
    this._processVision();
    this._processText();

    return {
      cortex: this.cortexCurrent,
      hippocampus: this.hippoCurrent,
      amygdala: this.amygdalaCurrent,
      basalGanglia: this.bgCurrent,
      salience: this.salience,
      salienceChange: this.salience - this._prevSalience,
    };
  }

  // ── Auditory Cortex ───────────────────────────────────────────
  // Tonotopic organization: low frequencies → low neuron indices
  // Speech frequencies (300-3000Hz) get cortical magnification

  _processAudio() {
    if (!this._analyser || !this._audioData) return;

    this._analyser.getByteFrequencyData(this._audioData);
    const specLen = this._audioData.length;
    const neuronCount = AUDITORY_END - AUDITORY_START; // 50 neurons

    // Map frequency bins to auditory cortex neurons
    // More bins per neuron for speech frequencies (cortical magnification)
    let totalEnergy = 0;
    for (let n = 0; n < neuronCount; n++) {
      // Non-linear mapping: more resolution in speech range (bins 5-40 out of 128)
      const t = n / neuronCount;
      // Emphasize 300-3000Hz region (roughly bins 5-40 for 44.1kHz sample rate)
      const binStart = Math.floor(t * t * specLen * 0.8); // quadratic = more low-freq bins
      const binEnd = Math.min(specLen, binStart + Math.max(1, Math.floor(specLen / neuronCount)));

      let sum = 0;
      for (let b = binStart; b < binEnd; b++) {
        sum += this._audioData[b];
      }
      const avg = sum / (binEnd - binStart) / 255; // normalize 0-1

      // Convert to neural current (need ~15+ to reach LIF threshold)
      const current = avg * 20; // loud sounds = strong current
      this.cortexCurrent[AUDITORY_START + n] += current;
      totalEnergy += avg;
    }

    // Salience from audio — sudden loud sounds are salient
    this.salience += totalEnergy / neuronCount;

    // Loud audio also excites amygdala (startle response)
    const avgEnergy = totalEnergy / neuronCount;
    if (avgEnergy > 0.3) {
      for (let i = 0; i < 20; i++) {
        this.amygdalaCurrent[i] += avgEnergy * 8;
      }
    }
  }

  // ── Visual Cortex ─────────────────────────────────────────────
  // Retinotopic organization: pixel grid → neuron grid
  // V1 responds to brightness changes (edge-like)

  _processVision() {
    if (!this._videoElement || !this._videoCtx) return;

    const now = performance.now();
    if (now - this._lastFrameTime < this._frameInterval) return;
    this._lastFrameTime = now;

    // Capture frame at low resolution (10x10)
    this._videoCtx.drawImage(this._videoElement, 0, 0, VIS_COLS, VIS_ROWS);
    const imageData = this._videoCtx.getImageData(0, 0, VIS_COLS, VIS_ROWS);
    const pixels = imageData.data;

    let totalBrightness = 0;
    let totalChange = 0;

    for (let y = 0; y < VIS_ROWS; y++) {
      for (let x = 0; x < VIS_COLS; x++) {
        const pixIdx = (y * VIS_COLS + x) * 4;
        const r = pixels[pixIdx];
        const g = pixels[pixIdx + 1];
        const b = pixels[pixIdx + 2];
        const brightness = (r + g + b) / (3 * 255); // 0-1

        const neuronIdx = VISUAL_START + y * VIS_COLS + x;

        // V1-like response: responds to brightness AND changes
        const prevCurrent = this.cortexCurrent[neuronIdx];
        const newCurrent = brightness * 12; // scale to neural current
        const change = Math.abs(newCurrent - prevCurrent);

        // Edge detection: neurons fire more for brightness changes (temporal contrast)
        this.cortexCurrent[neuronIdx] = newCurrent + change * 5;

        totalBrightness += brightness;
        totalChange += change;
      }
    }

    // Visual salience — high contrast / movement is salient
    this.salience += totalChange / (VIS_COLS * VIS_ROWS) * 2;
  }

  // ── Language Processing (Wernicke's Area) ─────────────────────
  // Text hashed into language cortex region with semantic structure

  _processText() {
    if (this._textQueue.length === 0) return;

    // Process all queued text
    while (this._textQueue.length > 0) {
      const text = this._textQueue.shift();
      this._processTextInput(text);
    }
  }

  _processTextInput(text) {
    const languageSize = LANGUAGE_END - LANGUAGE_START; // 150 neurons

    // Hash text into language area — each character activates specific neurons
    // with lateral excitation for nearby neurons (spreading activation)
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      const neuronIdx = LANGUAGE_START + ((code * 31 + i * 7) % languageSize);
      this.cortexCurrent[neuronIdx] += 8.0;

      // Lateral excitation
      if (neuronIdx > LANGUAGE_START) this.cortexCurrent[neuronIdx - 1] += 3.0;
      if (neuronIdx < LANGUAGE_END - 1) this.cortexCurrent[neuronIdx + 1] += 3.0;
    }

    // Text also goes to hippocampus for memory formation
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      const hippoIdx = (code * 13 + i * 11) % 200;
      this.hippoCurrent[hippoIdx] += 5.0;
    }

    // Social input excites amygdala (someone is talking to us)
    for (let i = 0; i < 30; i++) {
      this.amygdalaCurrent[i] += 4.0;
    }

    // Text input is always salient
    this.salience += 0.5 + text.length * 0.01;

    // ── SEMANTIC → BASAL GANGLIA ROUTING ──
    // Map text meaning to BG action channels through neural current.
    // This is the prefrontal cortex → BG pathway.
    //
    // Instead of character hashing (which is meaningless), we use a
    // semantic vocabulary — words that MEAN specific actions get routed
    // to specific channels. The base activation from vocabulary is then
    // scaled by learnable weights that get shaped through reward.
    //
    // BG channels: 0-24=respond, 25-49=image, 50-74=speak, 75-99=build, 100-124=listen, 125-149=idle
    const lower = text.toLowerCase();

    // Semantic vocabulary — maps word MEANING to channel activation
    // This IS the brain's learned language→action mapping
    const semanticMap = {
      // respond_text (channel 0): conversational words
      respond: ['what', 'who', 'how', 'why', 'when', 'where', 'tell', 'explain', 'think',
        'feel', 'know', 'mean', 'say', 'talk', 'chat', 'opinion', 'believe', 'want',
        'need', 'like', 'love', 'hate', 'remember', 'name', 'age', 'doing', 'been',
        'hello', 'hey', 'hi', 'yo', 'sup', 'thanks', 'sorry', 'please', 'yes', 'no',
        'yeah', 'nah', 'okay', 'cool', 'nice', 'fuck', 'shit', 'damn', 'babe', 'baby'],

      // generate_image (channel 1): visual/image words
      image: ['image', 'picture', 'photo', 'selfie', 'pic', 'draw', 'painting',
        'portrait', 'render', 'generate', 'visual', 'illustration', 'artwork',
        'sketch', 'headshot', 'snapshot', 'capture', 'shot', 'scene'],

      // speak (channel 2): vocalization
      speak: ['sing', 'scream', 'shout', 'whisper', 'hum', 'rap', 'voice'],

      // build_ui (channel 3): construction/tool words
      build: ['build', 'create', 'make', 'code', 'program', 'app', 'tool', 'widget',
        'calculator', 'editor', 'game', 'player', 'timer', 'clock', 'chart',
        'component', 'interface', 'button', 'slider', 'form', 'input', 'output',
        'sandbox', 'canvas', 'display', 'panel', 'window', 'menu', 'dashboard',
        'counter', 'list', 'table', 'grid', 'layout', 'design', 'ui', 'ux'],

      // listen (channel 4): pause/wait
      listen: ['wait', 'hold', 'stop', 'pause', 'listen', 'quiet', 'shh', 'shut'],

      // idle (channel 5): nothing
      idle: ['nothing', 'nevermind', 'nvm', 'forget', 'chill', 'relax', 'idle'],
    };

    // Score each channel based on word presence
    const scores = { respond: 0.3, image: 0, speak: 0, build: 0, listen: 0, idle: 0 }; // respond gets base activation (default action)
    for (const [channel, vocab] of Object.entries(semanticMap)) {
      for (const word of vocab) {
        if (lower.includes(word)) {
          scores[channel] += 1.0;
        }
      }
    }

    // Inject scores into BG channels through learnable weights
    const w = this._semanticWeights;
    for (let i = 0; i < 25; i++)   this.bgCurrent[i]   += scores.respond * w.respond[i] * 12;
    for (let i = 25; i < 50; i++)  this.bgCurrent[i]    += scores.image * w.image[i] * 12;
    for (let i = 50; i < 75; i++)  this.bgCurrent[i]    += scores.speak * w.speak[i] * 12;
    for (let i = 75; i < 100; i++) this.bgCurrent[i]    += scores.build * w.build[i] * 12;
    for (let i = 100; i < 125; i++) this.bgCurrent[i]   += scores.listen * w.listen[i] * 12;
    for (let i = 125; i < 150; i++) this.bgCurrent[i]   += scores.idle * w.idle[i] * 12;

    // Emotional words boost amygdala
    const emotionalWords = ['love', 'hate', 'fuck', 'shit', 'beautiful', 'ugly',
      'amazing', 'terrible', 'happy', 'sad', 'angry', 'scared', 'sexy', 'hot',
      'cute', 'kill', 'die', 'please', 'sorry', 'thank'];
    for (const ew of emotionalWords) {
      if (lower.includes(ew)) {
        for (let i = 30; i < 60; i++) this.amygdalaCurrent[i] += 6.0;
        this.salience += 0.3;
        break;
      }
    }
  }

  // ── Accessors ─────────────────────────────────────────────────

  hasCamera() { return this._cameraStream !== null; }
  hasAudio() { return this._analyser !== null; }

  destroy() {
    if (this._videoElement) this._videoElement.remove();
    if (this._cameraStream) this._cameraStream.getTracks().forEach(t => t.stop());
  }
}
