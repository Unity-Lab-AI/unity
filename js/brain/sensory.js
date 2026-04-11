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

    // Emotional words boost amygdala more
    const emotionalWords = ['love', 'hate', 'fuck', 'shit', 'beautiful', 'ugly',
      'amazing', 'terrible', 'happy', 'sad', 'angry', 'scared', 'sexy', 'hot',
      'cute', 'kill', 'die', 'please', 'sorry', 'thank'];
    const lower = text.toLowerCase();
    for (const w of emotionalWords) {
      if (lower.includes(w)) {
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
