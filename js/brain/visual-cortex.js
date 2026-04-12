/**
 * visual-cortex.js — V1→V2→V4→IT visual processing pipeline
 *
 * Processes webcam frames through a neural hierarchy:
 *   V1: Edge detection via oriented receptive fields (Hubel & Wiesel)
 *   V2: Texture/pattern — groups V1 responses
 *   V4: Color — extracts dominant colors
 *   IT: Object recognition — calls AI for high-level description (LAST step)
 *
 * The salience map drives saccade generation — gaze goes where edges are strongest.
 * AI is only called for IT-level recognition, not for basic vision.
 */

const FRAME_W = 20;
const FRAME_H = 15;
const V1_ORIENTATIONS = 4; // 0°, 45°, 90°, 135°
const V1_COUNT = FRAME_W * FRAME_H; // 300 V1 neurons (one per pixel)

// Gabor-like kernels for oriented edge detection (3x3)
const EDGE_KERNELS = [
  // 0° horizontal
  [-1, -1, -1, 0, 0, 0, 1, 1, 1],
  // 45° diagonal
  [-1, -1, 0, -1, 0, 1, 0, 1, 1],
  // 90° vertical
  [-1, 0, 1, -1, 0, 1, -1, 0, 1],
  // 135° diagonal
  [0, -1, -1, 1, 0, -1, 1, 1, 0],
];

export class VisualCortex {
  constructor() {
    // Frame buffers
    this._prevFrame = new Float32Array(FRAME_W * FRAME_H);
    this._currentFrame = new Float32Array(FRAME_W * FRAME_H);

    // V1: edge responses per orientation per pixel
    this.v1Responses = new Float32Array(V1_COUNT * V1_ORIENTATIONS);

    // Salience map — combined edge strength per pixel
    this.salienceMap = new Float32Array(V1_COUNT);

    // V4: dominant colors (RGB averages for quadrants)
    this.colors = { tl: [0, 0, 0], tr: [0, 0, 0], bl: [0, 0, 0], br: [0, 0, 0] };

    // IT: high-level description (from AI, updated periodically)
    this.description = '';
    this._lastDescribeTime = 0;
    this._describeInterval = 30000; // AI description every 30s — saves credits
    this._describer = null; // function(frameCanvas) => Promise<string>
    this._describing = false;

    // Gaze — determined by salience map peak
    this.gazeX = 0.5;
    this.gazeY = 0.5;
    this.gazeTarget = '';

    // Canvas for frame capture
    this._canvas = null;
    this._ctx = null;
    this._video = null;
    this._active = false;

    // Motion energy — how much the scene is changing
    this.motionEnergy = 0;
  }

  /**
   * Initialize with camera stream.
   */
  init(videoElement) {
    this._video = videoElement;
    this._canvas = document.createElement('canvas');
    this._canvas.width = FRAME_W;
    this._canvas.height = FRAME_H;
    this._ctx = this._canvas.getContext('2d', { willReadFrequently: true });
    this._active = true;
  }

  /**
   * Set the IT-level describer function (calls AI model).
   */
  setDescriber(fn) {
    this._describer = fn;
  }

  /**
   * Process one frame through V1→V2→V4→IT pipeline.
   * Returns neural currents for the cortex visual region.
   *
   * @returns {{ currents: Float32Array, salience: number, gaze: {x,y}, colors: object }}
   */
  processFrame() {
    if (!this._active || !this._video || !this._ctx) {
      return { currents: new Float32Array(100), salience: 0, gaze: { x: 0.5, y: 0.5 }, colors: this.colors };
    }

    // Capture frame
    this._ctx.drawImage(this._video, 0, 0, FRAME_W, FRAME_H);
    const imageData = this._ctx.getImageData(0, 0, FRAME_W, FRAME_H);
    const pixels = imageData.data;

    // Convert to grayscale brightness
    this._prevFrame.set(this._currentFrame);
    for (let i = 0; i < FRAME_W * FRAME_H; i++) {
      const pi = i * 4;
      this._currentFrame[i] = (pixels[pi] + pixels[pi + 1] + pixels[pi + 2]) / (3 * 255);
    }

    // ── V1: Edge Detection ──
    this._computeV1();

    // ── V2: Texture grouping (simplified — sum V1 in local regions) ──
    // Implicit in the salience map

    // ── V4: Color extraction ──
    this._extractColors(pixels);

    // ── Motion detection ──
    this._computeMotion();

    // ── Salience → Gaze ──
    this._computeGaze();

    // ── IT: Object recognition (periodic AI call) ──
    this._maybeDescribe();

    // Generate neural currents for cortex visual area (neurons 50-149)
    // Map salience + motion to current values
    const currents = new Float32Array(100); // 100 visual cortex neurons
    for (let i = 0; i < 100; i++) {
      const mapIdx = Math.floor(i / 100 * V1_COUNT);
      currents[i] = this.salienceMap[mapIdx] * 15 + // edge strength
                     (this._currentFrame[mapIdx] || 0) * 5; // brightness
    }

    return {
      currents,
      salience: this.motionEnergy + this._maxSalience(),
      gaze: { x: this.gazeX, y: this.gazeY },
      colors: this.colors,
      description: this.description,
    };
  }

  // ── V1: Oriented edge detection ──────────────────────────────

  _computeV1() {
    for (let y = 1; y < FRAME_H - 1; y++) {
      for (let x = 1; x < FRAME_W - 1; x++) {
        const pixIdx = y * FRAME_W + x;

        for (let ori = 0; ori < V1_ORIENTATIONS; ori++) {
          const kernel = EDGE_KERNELS[ori];
          let response = 0;

          // Convolve 3x3 kernel
          let ki = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const ni = (y + ky) * FRAME_W + (x + kx);
              response += this._currentFrame[ni] * kernel[ki];
              ki++;
            }
          }

          this.v1Responses[pixIdx * V1_ORIENTATIONS + ori] = Math.abs(response);
        }

        // Salience = max edge response across orientations
        let maxResp = 0;
        for (let ori = 0; ori < V1_ORIENTATIONS; ori++) {
          maxResp = Math.max(maxResp, this.v1Responses[pixIdx * V1_ORIENTATIONS + ori]);
        }
        this.salienceMap[pixIdx] = maxResp;
      }
    }
  }

  // ── V4: Color extraction ─────────────────────────────────────

  _extractColors(pixels) {
    const qw = Math.floor(FRAME_W / 2);
    const qh = Math.floor(FRAME_H / 2);
    const quads = [
      { key: 'tl', x0: 0, y0: 0, x1: qw, y1: qh },
      { key: 'tr', x0: qw, y0: 0, x1: FRAME_W, y1: qh },
      { key: 'bl', x0: 0, y0: qh, x1: qw, y1: FRAME_H },
      { key: 'br', x0: qw, y0: qh, x1: FRAME_W, y1: FRAME_H },
    ];

    for (const q of quads) {
      let r = 0, g = 0, b = 0, count = 0;
      for (let y = q.y0; y < q.y1; y++) {
        for (let x = q.x0; x < q.x1; x++) {
          const pi = (y * FRAME_W + x) * 4;
          r += pixels[pi]; g += pixels[pi + 1]; b += pixels[pi + 2];
          count++;
        }
      }
      this.colors[q.key] = [
        Math.floor(r / count),
        Math.floor(g / count),
        Math.floor(b / count),
      ];
    }
  }

  // ── Motion detection ─────────────────────────────────────────

  _computeMotion() {
    let totalDiff = 0;
    for (let i = 0; i < V1_COUNT; i++) {
      totalDiff += Math.abs(this._currentFrame[i] - this._prevFrame[i]);
    }
    this.motionEnergy = totalDiff / V1_COUNT;
  }

  // ── Saccade generation from salience ─────────────────────────

  _computeGaze() {
    // Find peak of salience map — that's where we look
    let maxSal = 0, maxX = FRAME_W / 2, maxY = FRAME_H / 2;
    for (let y = 0; y < FRAME_H; y++) {
      for (let x = 0; x < FRAME_W; x++) {
        const sal = this.salienceMap[y * FRAME_W + x];
        if (sal > maxSal) {
          maxSal = sal;
          maxX = x;
          maxY = y;
        }
      }
    }

    // Smooth pursuit toward peak (don't snap instantly)
    const targetX = maxX / FRAME_W;
    const targetY = maxY / FRAME_H;
    this.gazeX += (targetX - this.gazeX) * 0.1;
    this.gazeY += (targetY - this.gazeY) * 0.1;

    // Micro-saccades
    this.gazeX += (Math.random() - 0.5) * 0.01;
    this.gazeY += (Math.random() - 0.5) * 0.01;
    this.gazeX = Math.max(0, Math.min(1, this.gazeX));
    this.gazeY = Math.max(0, Math.min(1, this.gazeY));
  }

  _maxSalience() {
    let max = 0;
    for (let i = 0; i < V1_COUNT; i++) {
      if (this.salienceMap[i] > max) max = this.salienceMap[i];
    }
    return max;
  }

  // ── IT: Object recognition (AI call — LAST step) ─────────────

  _maybeDescribe() {
    if (!this._describer || this._describing) return;
    const now = performance.now();
    if (now - this._lastDescribeTime < this._describeInterval) return;

    this._describing = true;
    this._lastDescribeTime = now;

    // Get a higher-res frame for AI description
    const descCanvas = document.createElement('canvas');
    descCanvas.width = 320;
    descCanvas.height = 240;
    const dCtx = descCanvas.getContext('2d');
    dCtx.drawImage(this._video, 0, 0, 320, 240);
    const dataUrl = descCanvas.toDataURL('image/jpeg', 0.6);

    this._describer(dataUrl).then(desc => {
      this.description = desc || '';
      this._describing = false;
    }).catch(() => {
      this._describing = false;
    });
  }

  isActive() { return this._active; }

  getState() {
    return {
      gazeX: this.gazeX,
      gazeY: this.gazeY,
      gazeTarget: this.gazeTarget,
      description: this.description,
      motionEnergy: this.motionEnergy,
      colors: this.colors,
      maxSalience: this._maxSalience(),
    };
  }
}
