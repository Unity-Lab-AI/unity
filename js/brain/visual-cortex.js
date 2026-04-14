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

// Frame resolution bumped from 20×15 (300 px) to 60×45 (2700 px).
// The old grid was so coarse that a face at webcam distance was only
// ~4-8 pixels wide, smaller than most background edges (window frames,
// door lines, posters, keyboards). Edge detection consistently picked
// high-contrast background junk over the user's face, so the gaze
// pointer bugged out off to the side.
// 60×45 gives face-level detail (~15-25px wide for a typical webcam
// framing) while staying cheap: 9× the V1 ops still runs <1ms per frame.
const FRAME_W = 60;
const FRAME_H = 45;
const V1_ORIENTATIONS = 4; // 0°, 45°, 90°, 135°
const V1_COUNT = FRAME_W * FRAME_H; // 2700 V1 neurons (one per pixel)

// Center Gaussian prior — σ controls how tightly gaze favors the
// frame center. σ = frame_width / 3 means edges at the center are
// weighted ~2-3× more strongly than edges at the corners. Webcam
// users are almost always center-framed, so this cheap prior makes
// the attention system land on them unless a background edge is
// DRAMATICALLY stronger than anything near center.
const CENTER_PRIOR_SIGMA_X = FRAME_W / 3;
const CENTER_PRIOR_SIGMA_Y = FRAME_H / 3;

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
    this._describeInterval = Infinity; // Don't auto-describe — only on demand or first frame
    this._hasDescribedOnce = false; // first look on boot
    this._describer = null; // function(frameCanvas) => Promise<string>
    this._describing = false;
    // T7.2 — subscribers notified whenever a fresh description
    // lands. Language cortex uses this to feed the text into its
    // social schema (gender inference via closed-class token match).
    this._describeSubscribers = [];

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

    // Per-pixel motion map (frame-to-frame absolute brightness delta).
    // Feeds into the effective-salience computation so moving regions
    // dominate over static background edges. Whoever is actually talking
    // to Unity is the thing that's moving — she should look at them.
    this._motionMap = new Float32Array(V1_COUNT);

    // Top-down attention gate driven by brain state (set from the engine
    // via setAttentionState). When arousal is high AND the user recently
    // spoke, Unity's gaze clamps toward the center of the frame where the
    // user is most likely to be. When idle (low arousal, no recent input),
    // gaze free-roams the salience map.
    this._attentionLock = 0.0; // 0 = free-roam, 1 = center-locked
  }

  /**
   * Called by the engine each step with current brain state so the
   * visual cortex can apply top-down attention to gaze.
   *
   * @param {object} state
   * @param {number} state.arousal — amygdala arousal (0-1)
   * @param {number} state.secondsSinceInput — wall-clock seconds since
   *    the last user input arrived. Under 10s = user is actively
   *    talking to Unity; above = idle.
   */
  setAttentionState({ arousal = 0.5, secondsSinceInput = 9999 } = {}) {
    // Center-lock scales with arousal × recency. Unity pays attention to
    // whoever is talking to her. If nobody's around she wanders.
    const recency = Math.max(0, Math.min(1, 1 - secondsSinceInput / 10));
    this._attentionLock = Math.max(0, Math.min(1, arousal * 0.8 + recency * 0.6 - 0.3));
  }

  /**
   * R7 — unified sensory peripheral interface.
   *
   * All sensory peripherals expose the same contract:
   *   init(stream, opts)  — attach to raw input stream
   *   step(dt) / process(dt) / processFrame()
   *                        — one tick of processing, returns
   *                          { currents, metadata } for cortex injection
   *   destroy()           — clean shutdown, free resources
   *
   * Visual cortex takes a video element (from getUserMedia stream
   * already attached to an HTMLVideoElement). It allocates a small
   * backing canvas for frame capture and sets _active=true so
   * processFrame() starts producing real readings instead of zeros.
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
   * R7 — unified destroy hook. Releases the canvas context and
   * drops the video ref so the backing resources can be GC'd.
   * Safe to call multiple times.
   */
  destroy() {
    this._active = false;
    this._video = null;
    this._ctx = null;
    this._canvas = null;
    this._describer = null;
    this._describing = false;
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
  //
  // Per-pixel motion map + scalar total motion energy. The per-pixel
  // map feeds _computeGaze so the attention peak is pulled toward
  // moving regions (the user talking) instead of static background
  // edges (window frames, posters, the wall behind you).

  _computeMotion() {
    let totalDiff = 0;
    for (let i = 0; i < V1_COUNT; i++) {
      const delta = Math.abs(this._currentFrame[i] - this._prevFrame[i]);
      this._motionMap[i] = delta;
      totalDiff += delta;
    }
    this.motionEnergy = totalDiff / V1_COUNT;
  }

  // ── Saccade generation from salience ─────────────────────────
  //
  // Gaze lands on the peak of an EFFECTIVE salience map computed as:
  //
  //   eff[x,y] = (edge[x,y] × 0.30 + motion[x,y] × 0.70 × motionGain)
  //              × centerPrior(x, y)
  //              × attentionLockMask(x, y)
  //
  // - Motion dominates static edges when ANY motion is present, so
  //   the user talking beats static background clutter every time.
  // - Center Gaussian prior weights frame middle ~2-3× higher, because
  //   webcam users are almost always center-framed.
  // - Top-down attention lock (set from engine via setAttentionState)
  //   tightens the center window when Unity's arousal is high AND the
  //   user recently spoke. When idle, the lock loosens and gaze
  //   free-roams the salience map.

  _computeGaze() {
    const cx = FRAME_W / 2;
    const cy = FRAME_H / 2;
    const sigX2 = CENTER_PRIOR_SIGMA_X * CENTER_PRIOR_SIGMA_X;
    const sigY2 = CENTER_PRIOR_SIGMA_Y * CENTER_PRIOR_SIGMA_Y;

    // Motion gain scales with total motion energy so static scenes
    // don't amplify noise, but active scenes heavily favor movement.
    // At motionEnergy=0: gain ~0 (pure edge salience).
    // At motionEnergy=0.05 (noticeable movement): gain ~5.
    // At motionEnergy=0.2 (lots of movement): gain ~20.
    const motionGain = Math.min(25, this.motionEnergy * 100);

    // Attention-lock amplifies the center prior when active. At lock=0,
    // the center prior is the vanilla Gaussian. At lock=1, the prior
    // steepens so off-center peaks need ~4× more strength to win.
    const lockSharpness = 1 + this._attentionLock * 3;

    // Find peak of effective salience
    let maxSal = 0, maxX = cx, maxY = cy;
    for (let y = 0; y < FRAME_H; y++) {
      for (let x = 0; x < FRAME_W; x++) {
        const idx = y * FRAME_W + x;
        const edge = this.salienceMap[idx] || 0;
        const motion = this._motionMap[idx] || 0;

        // Combine: motion is the primary driver when present
        let combined = edge * 0.30 + motion * 0.70 * motionGain;

        // Center Gaussian prior (amplified by attention lock)
        const dx = x - cx;
        const dy = y - cy;
        const centerWeight = Math.exp(
          -((dx * dx) / (2 * sigX2) + (dy * dy) / (2 * sigY2)) * lockSharpness
        );
        combined *= centerWeight;

        if (combined > maxSal) {
          maxSal = combined;
          maxX = x;
          maxY = y;
        }
      }
    }

    // Target in 0-1 normalized coords
    const targetX = maxX / FRAME_W;
    const targetY = maxY / FRAME_H;

    // Smooth pursuit — faster when attention is locked (engaged),
    // slower when free-roaming (idle wandering).
    const pursuitRate = 0.12 + this._attentionLock * 0.15;
    this.gazeX += (targetX - this.gazeX) * pursuitRate;
    this.gazeY += (targetY - this.gazeY) * pursuitRate;

    // Micro-saccades — smaller when locked (fixation), larger when idle.
    const saccadeAmp = 0.015 * (1 - this._attentionLock * 0.6);
    this.gazeX += (Math.random() - 0.5) * saccadeAmp;
    this.gazeY += (Math.random() - 0.5) * saccadeAmp;

    // When attention is strongly locked, clamp gaze to a tighter
    // center window so Unity doesn't wander to a random corner
    // during active conversation.
    if (this._attentionLock > 0.5) {
      const window = 0.3 - (this._attentionLock - 0.5) * 0.2; // 0.3 → 0.2
      const min = 0.5 - window;
      const max = 0.5 + window;
      this.gazeX = Math.max(min, Math.min(max, this.gazeX));
      this.gazeY = Math.max(min, Math.min(max, this.gazeY));
    } else {
      this.gazeX = Math.max(0, Math.min(1, this.gazeX));
      this.gazeY = Math.max(0, Math.min(1, this.gazeY));
    }
  }

  _maxSalience() {
    let max = 0;
    for (let i = 0; i < V1_COUNT; i++) {
      if (this.salienceMap[i] > max) max = this.salienceMap[i];
    }
    return max;
  }

  // ── IT: Object recognition (AI call — LAST step) ─────────────

  /**
   * Force a vision description NOW. Called by handleInput on visual questions
   * or by the brain when it decides it needs to look.
   */
  forceDescribe() {
    // User-requested look — bypass the 5 min auto limit
    // but still rate limit to 10 seconds between forced looks
    const now = performance.now();
    if (this._hasDescribedOnce && now - this._lastDescribeTime < 10000) return;
    this._lastDescribeTime = 0; // reset to allow _maybeDescribe through
    this._maybeDescribe();
  }

  _maybeDescribe() {
    if (!this._describer || this._describing) return;

    // Only auto-describe ONCE on boot (first look). After that, only on demand.
    if (this._hasDescribedOnce) {
      // Rate limit: 5 minutes between auto descriptions.
      // forceDescribe from user request bypasses this.
      const now = performance.now();
      if (now - this._lastDescribeTime < 300000) return; // 5 minutes
    }

    this._describing = true;
    this._hasDescribedOnce = true;
    this._lastDescribeTime = performance.now();

    // Get a higher-res frame for AI description
    const descCanvas = document.createElement('canvas');
    descCanvas.width = 320;
    descCanvas.height = 240;
    const dCtx = descCanvas.getContext('2d');
    dCtx.drawImage(this._video, 0, 0, 320, 240);
    const dataUrl = descCanvas.toDataURL('image/jpeg', 0.6);

    this._describer(dataUrl).then(desc => {
      // null = describer failed (backend dead / paused / bad response).
      // Keep _hasDescribedOnce=true so the 5-min rate limit engages and
      // we don't retry every frame against a dead backend.
      if (desc) {
        this.description = desc;
        // T7.2 — notify subscribers so downstream consumers (the
        // language cortex social schema, specifically) can extract
        // gender / scene context from the describer output.
        for (const cb of this._describeSubscribers) {
          try { cb(desc); } catch (err) { console.warn('[VisualCortex] describe subscriber error:', err.message); }
        }
      }
      this._describing = false;
    }).catch(() => {
      this._describing = false;
    });
  }

  /**
   * T7.2 — subscribe to fresh description events. Callback receives
   * the raw description string every time the describer completes
   * with a non-null result. Used by the language cortex to pull
   * gender tokens out of the scene description.
   */
  onDescribe(cb) {
    if (typeof cb === 'function') this._describeSubscribers.push(cb);
    return () => {
      const i = this._describeSubscribers.indexOf(cb);
      if (i >= 0) this._describeSubscribers.splice(i, 1);
    };
  }

  isActive() { return this._active; }

  /**
   * T1 2026-04-13 — return the video element this cortex is attached
   * to, so viz panels can render the live feed without keeping a
   * separate handle to the raw MediaStream. Single source of truth:
   * whoever wants to display the camera reads through VisualCortex,
   * and VisualCortex owns the video element lifecycle.
   */
  getVideoElement() { return this._video || null; }

  /**
   * T1 2026-04-13 — return the raw MediaStream if callers need it
   * for something the video element doesn't expose (e.g. stopping
   * individual tracks for mute). Only returns non-null when cortex
   * is actually attached to a stream.
   */
  getStream() { return this._video?.srcObject || null; }

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
