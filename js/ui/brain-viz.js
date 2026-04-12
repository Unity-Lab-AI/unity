/**
 * brain-viz.js — Real-time brain equation visualizer
 *
 * Full-screen overlay showing the brain simulation running live:
 * - Neuron firing grid with spike afterglow (persists visually)
 * - Synapse activity heatmap
 * - Module activity bars with live values
 * - Oscillation waveforms (theta/alpha/beta/gamma)
 * - Consciousness Ψ readout
 * - Live equations with current values plugged in
 * - Spike counter and firing rate
 */

// Cluster layout for visualization
const CLUSTER_LAYOUT = [
  { name: 'cortex',       size: 300, cols: 20, color: '#ff4d9a', label: 'CORTEX (300)' },
  { name: 'hippocampus',  size: 200, cols: 20, color: '#a855f7', label: 'HIPPOCAMPUS (200)' },
  { name: 'amygdala',     size: 150, cols: 15, color: '#ef4444', label: 'AMYGDALA (150)' },
  { name: 'basalGanglia', size: 150, cols: 15, color: '#22c55e', label: 'BASAL GANGLIA (150)' },
  { name: 'cerebellum',   size: 100, cols: 10, color: '#00e5ff', label: 'CEREBELLUM (100)' },
  { name: 'hypothalamus', size: 50,  cols: 10, color: '#f59e0b', label: 'HYPOTHALAMUS (50)' },
  { name: 'mystery',      size: 50,  cols: 10, color: '#c084fc', label: 'MYSTERY Ψ (50)' },
];
const TOTAL_NEURONS = 1000;
const AFTERGLOW_FRAMES = 30;

export class BrainVisualizer {
  constructor() {
    this._open = false;
    this._el = null;
    this._animId = null;
    this._lastState = null;
    this._bandHistory = [];         // rolling buffer for band power over time
    this._maxBandHistory = 300;     // ~5 seconds at 60fps
    this._coherenceHistory = [];
    this._spikeGlow = new Float32Array(TOTAL_NEURONS);  // per-neuron afterglow
    this._spikeHistory = [];        // rolling spike count for rate display
    this._maxSpikeHistory = 60;
    this._spikeRateHistory = [];    // longer-term spike rate for the neuron canvas
    this._maxSpikeRateHistory = 300;
    this._frameCount = 0;
    // Smoothed band power (exponential moving average)
    this._smoothBands = { theta: 0, alpha: 0, beta: 0, gamma: 0 };

    // Rolling history for motor, modules, consciousness — shows trends not just instants
    this._motorHistory = []; // array of { channels: [], action: string, confidence: number }
    this._moduleHistory = []; // array of { cortex, hippo, amyg, bg, cereb, hypo }
    this._psiHistory = [];
    this._maxHistory = 200; // ~3 seconds at 60fps/6

    this._build();
  }

  _build() {
    this._el = document.createElement('div');
    this._el.id = 'brain-viz';
    this._el.className = 'brain-viz hidden';
    this._activeTab = 'neurons';
    this._el.innerHTML = `
      <div class="bv-header">
        <span class="bv-title">BRAIN VISUALIZER</span>
        <div class="bv-tabs" id="bv-tabs">
          <button class="bv-tab active" data-tab="neurons">Neurons</button>
          <button class="bv-tab" data-tab="synapses">Synapses</button>
          <button class="bv-tab" data-tab="oscillations">Oscillations</button>
          <button class="bv-tab" data-tab="modules">Modules</button>
          <button class="bv-tab" data-tab="senses">Senses</button>
          <button class="bv-tab" data-tab="consciousness">Ψ Consciousness</button>
          <button class="bv-tab" data-tab="memory">Memory</button>
          <button class="bv-tab" data-tab="motor">Motor</button>
          <button class="bv-tab" data-tab="innervoice">Inner Voice</button>
        </div>
        <span class="bv-stats" id="bv-stats">spikes: 0</span>
        <button class="bv-close-btn">&times;</button>
      </div>
      <!-- ═══ TAB PANELS ═══ -->
      <div class="bv-panel" data-panel="neurons">
        <div class="bv-grid-wrap">
          <div class="bv-section bv-wide">
            <div class="bv-section-title">NEURAL CLUSTERS — 1000 LIF neurons across 7 brain regions</div>
            <div class="bv-equation">τ·dV/dt = -(V - V<sub>rest</sub>) + R·I &nbsp;|&nbsp; <span id="bv-spike-count">0</span>/1000 active</div>
            <canvas id="bv-neuron-canvas" width="800" height="500"></canvas>
          </div>
        </div>
      </div>

      <div class="bv-panel bv-hidden" data-panel="synapses">
        <div class="bv-grid-wrap">
          <div class="bv-section bv-wide">
            <div class="bv-section-title">SYNAPSE ACTIVITY — Hebbian + STDP + Reward</div>
            <div class="bv-equation">ΔW = η·pre·post &nbsp;|&nbsp; STDP: Δt = t<sub>post</sub> - t<sub>pre</sub> &nbsp;|&nbsp; Reward: ΔW = η·δ·s<sub>i</sub>·s<sub>j</sub></div>
            <canvas id="bv-synapse-canvas" width="600" height="600"></canvas>
          </div>
        </div>
      </div>

      <div class="bv-panel bv-hidden" data-panel="oscillations">
        <div class="bv-grid-wrap">
          <div class="bv-section bv-wide">
            <div class="bv-section-title">BAND POWER — Kuramoto oscillators (θ→γ) &nbsp;|&nbsp; coherence: <span id="bv-coherence">0.000</span></div>
            <div class="bv-equation">dθ<sub>i</sub>/dt = ω<sub>i</sub> + Σ K<sub>ij</sub>·sin(θ<sub>j</sub> - θ<sub>i</sub>)</div>
            <canvas id="bv-osc-canvas" width="800" height="400"></canvas>
          </div>
        </div>
      </div>

      <div class="bv-panel bv-hidden" data-panel="modules">
        <div class="bv-grid-wrap">
          <div class="bv-section bv-wide">
            <div class="bv-section-title">BRAIN MODULES — real-time state</div>
            <div class="bv-modules" id="bv-modules"></div>
          </div>
        </div>
      </div>

      <div class="bv-panel bv-hidden" data-panel="senses">
        <div class="bv-grid-wrap">
          <div class="bv-section">
            <div class="bv-section-title">👁 UNITY'S EYES — visual cortex input</div>
            <div class="bv-equation">V1 edge detection → salience map → saccade → IT recognition (on demand)</div>
          <div class="bv-eyes-wrap" id="bv-eyes-wrap">
            <video id="bv-eye-video" autoplay playsinline muted></video>
            <canvas id="bv-eye-overlay" width="320" height="240"></canvas>
            <div class="bv-eye-scan"></div>
            <div class="bv-eye-desc" id="bv-eye-desc">No camera feed</div>
          </div>
        </div>
        <div class="bv-section">
          <div class="bv-section-title">👂 UNITY'S EARS — auditory cortex input</div>
          <div class="bv-equation">Web Speech API → text transcription → neuron current injection (hash distributed)</div>
          <canvas id="bv-audio-canvas" width="320" height="60" style="width:100%;height:60px;background:#0a0a0a;border-radius:6px;display:block;margin-top:8px;"></canvas>
          <div style="font-family:var(--mono);font-size:10px;color:var(--text-dim);margin-top:4px;" id="bv-hear-text">Listening...</div>
        </div>
      </div>
        <div class="bv-grid-wrap">
          <div class="bv-section bv-wide">
            <div class="bv-section-title">🧬 SIMULATED SENSES — derived from sight + sound</div>
            <div class="bv-equation">Touch, smell, taste inferred from brain state via hypothalamus</div>
            <div class="bv-senses" id="bv-senses"></div>
          </div>
        </div>
      </div>

      <div class="bv-panel bv-hidden" data-panel="consciousness">
        <div class="bv-grid-wrap">
          <div class="bv-section bv-wide">
            <div class="bv-section-title">CONSCIOUSNESS — The Mystery Module Ψ</div>
            <div class="bv-equation">Ψ = (√(1/n))³ · [α·Id + β·Ego + γ·Left + δ·Right]</div>
            <div class="bv-psi" id="bv-psi">Ψ = 0.000</div>
            <div class="bv-psi-components" id="bv-psi-parts"></div>
          </div>
        </div>
      </div>

      <div class="bv-panel bv-hidden" data-panel="memory">
        <div class="bv-grid-wrap">
          <div class="bv-section bv-wide">
            <div class="bv-section-title">MEMORY SYSTEM — Episodic + Working + Consolidation</div>
            <div class="bv-equation">Episodic: cosine recall | Working: 7 items, 0.98 decay | Consolidation: 3+ activations</div>
            <div class="bv-memory" id="bv-memory"></div>
          </div>
        </div>
      </div>

      <div class="bv-panel bv-hidden" data-panel="innervoice">
        <div class="bv-grid-wrap">
          <div class="bv-section bv-wide">
            <div class="bv-section-title">INNER VOICE — Brain's Own Language</div>
            <div class="bv-equation">Dictionary + bigrams + cortex prediction → self-generated speech</div>
            <div class="bv-innervoice" id="bv-innervoice"></div>
          </div>
        </div>
      </div>

      <div class="bv-panel bv-hidden" data-panel="motor">
        <div class="bv-grid-wrap">
          <div class="bv-section bv-wide">
            <div class="bv-section-title">MOTOR OUTPUT — Basal Ganglia Action Selection</div>
            <div class="bv-equation">6 channels × 25 neurons | Winner-take-all | Confidence threshold 0.15</div>
            <div class="bv-motor" id="bv-motor"></div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(this._el);

    this._el.querySelector('.bv-close-btn').addEventListener('click', () => this.close());
    this._el.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); });

    // Tab switching
    this._el.querySelectorAll('.bv-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this._activeTab = tab.dataset.tab;
        this._el.querySelectorAll('.bv-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this._el.querySelectorAll('.bv-panel').forEach(p => {
          p.classList.toggle('bv-hidden', p.dataset.panel !== this._activeTab);
        });
      });
    });

    // Canvas contexts
    this._neuronCtx = this._el.querySelector('#bv-neuron-canvas').getContext('2d');
    this._synapseCtx = this._el.querySelector('#bv-synapse-canvas').getContext('2d');
    this._oscCtx = this._el.querySelector('#bv-osc-canvas').getContext('2d');
    this._eyeOverlayCtx = this._el.querySelector('#bv-eye-overlay').getContext('2d');
    this._eyeVideo = this._el.querySelector('#bv-eye-video');
    this._audioCtx = this._el.querySelector('#bv-audio-canvas').getContext('2d');
    this._eyeScanY = 0;
    this._visionRef = null;
    this._audioAnalyser = null;
    this._audioData = null;
    this._lastHeardText = '';
  }

  /**
   * Connect a Vision instance so we can show the camera feed and descriptions.
   */
  setVision(visionInstance) {
    this._visionRef = visionInstance;
    if (visionInstance?.isActive() && visionInstance._stream) {
      this._eyeVideo.srcObject = visionInstance._stream;
      this._eyeVideo.play().catch(() => {});
    }
  }

  /**
   * Connect a microphone stream for audio waveform visualization.
   */
  setMicStream(micStream) {
    if (!micStream) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(micStream);
      this._audioAnalyser = audioCtx.createAnalyser();
      this._audioAnalyser.fftSize = 256;
      source.connect(this._audioAnalyser);
      this._audioData = new Uint8Array(this._audioAnalyser.frequencyBinCount);
      console.log('[BrainViz] Audio analyser connected');
    } catch (err) {
      console.warn('[BrainViz] Audio analyser failed:', err.message);
    }
  }

  /**
   * Update the last heard text for display.
   */
  setHeardText(text) {
    this._lastHeardText = text;
  }

  updateState(state) {
    this._lastState = state;

    // Track band power over time (smoothed) — this is what makes the oscillation
    // plot show meaningful slow changes instead of raw fast-cycling sine waves
    const bp = state.oscillations?.bandPower || state.bandPower || {};
    const smooth = 0.15; // EMA smoothing factor — lower = smoother
    for (const band of ['theta', 'alpha', 'beta', 'gamma']) {
      const raw = bp[band] ?? 0;
      this._smoothBands[band] = this._smoothBands[band] * (1 - smooth) + raw * smooth;
    }
    this._bandHistory.push({ ...this._smoothBands });
    if (this._bandHistory.length > this._maxBandHistory) this._bandHistory.shift();

    // Track coherence
    const coh = state.oscillations?.coherence ?? 0;
    this._coherenceHistory.push(coh);
    if (this._coherenceHistory.length > this._maxBandHistory) this._coherenceHistory.shift();

    // Always track spike afterglow
    if (state.spikes) {
      const len = Math.min(state.spikes.length, this._spikeGlow.length);
      for (let i = 0; i < len; i++) {
        if (state.spikes[i]) {
          this._spikeGlow[i] = 1.0;
        } else {
          this._spikeGlow[i] *= 0.92;
        }
      }
    }

    // Track spike counts for rate display
    const spikeCount = state.spikeCount ?? (state.spikes ? Array.from(state.spikes).filter(s => s).length : 0);
    this._spikeHistory.push(spikeCount);
    if (this._spikeHistory.length > this._maxSpikeHistory) this._spikeHistory.shift();
    this._spikeRateHistory.push(spikeCount);
    if (this._spikeRateHistory.length > this._maxSpikeRateHistory) this._spikeRateHistory.shift();
  }

  _render() {
    if (!this._open || !this._lastState) return;
    const s = this._lastState;
    this._frameCount++;

    // Only render the ACTIVE tab — saves performance, reduces visual noise
    switch (this._activeTab) {
      case 'neurons': this._renderNeurons(s); break;
      case 'synapses': this._renderSynapses(s); break;
      case 'oscillations': this._renderOscillations(s); break;
      case 'senses':
        this._renderEyes(s);
        this._renderAudio();
        break;
    }

    // DOM updates at 10fps regardless of tab
    if (this._frameCount % 6 === 0) {
      this._renderStats(s);
      switch (this._activeTab) {
        case 'modules': this._renderModules(s); break;
        case 'senses': this._renderSenses(s); break;
        case 'consciousness': this._renderPsi(s); break;
        case 'memory': this._renderMemory(s); break;
        case 'motor': this._renderMotor(s); break;
        case 'innervoice': this._renderInnerVoice(s); break;
      }
    }

    this._animId = requestAnimationFrame(() => this._render());
  }

  _renderStats(s) {
    const statsEl = this._el.querySelector('#bv-stats');
    const countEl = this._el.querySelector('#bv-spike-count');
    const spikeCount = s.spikeCount ?? 0;
    const avgRate = this._spikeHistory.length > 0
      ? (this._spikeHistory.reduce((a, b) => a + b, 0) / this._spikeHistory.length).toFixed(1)
      : '0';
    if (statsEl) statsEl.textContent = `spikes: ${spikeCount}/200 | avg rate: ${avgRate}/frame | t=${(s.time ?? 0).toFixed(1)}s`;
    if (countEl) countEl.textContent = spikeCount;
  }

  _renderNeurons(s) {
    const ctx = this._neuronCtx;
    const canvas = ctx.canvas;
    const w = canvas.width;
    const h = canvas.height;

    // Gentle fade — slower trails, less seizure-inducing
    ctx.fillStyle = 'rgba(10,10,10,0.6)';
    ctx.fillRect(0, 0, w, h);

    const spikes = s.spikes;
    const voltages = s.voltages;
    if (!voltages || voltages.length < TOTAL_NEURONS) return;

    // Render each cluster as a labeled block
    let globalIdx = 0;
    const padding = 6;
    const labelH = 14;
    let cursorY = 4;

    for (const layout of CLUSTER_LAYOUT) {
      const { name, size, cols, color, label } = layout;
      const rows = Math.ceil(size / cols);
      const cellW = Math.min((w - padding * 2) / cols, 12);
      const cellH = cellW;
      const blockW = cols * cellW;
      const blockH = rows * cellH + labelH;

      // Cluster label
      ctx.fillStyle = color;
      ctx.font = '9px monospace';
      ctx.fillText(label, padding, cursorY + 10);

      // Cluster firing rate
      const clusterState = s.clusters?.[name];
      if (clusterState) {
        const rateText = `${clusterState.spikeCount}/${size} firing  rate:${clusterState.firingRate?.toFixed(1) || '0'}`;
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillText(rateText, padding + blockW - ctx.measureText(rateText).width - 4, cursorY + 10);
      }

      cursorY += labelH;

      // Cluster border
      ctx.strokeStyle = color.replace(')', ',0.2)').replace('rgb', 'rgba').replace('#', '');
      // Use hex to rgba conversion
      ctx.strokeStyle = `${color}33`;
      ctx.lineWidth = 1;
      ctx.strokeRect(padding - 1, cursorY - 1, blockW + 2, rows * cellH + 2);

      // Render neurons
      for (let n = 0; n < size; n++) {
        const i = globalIdx + n;
        const col = n % cols;
        const row = Math.floor(n / cols);
        const x = padding + col * cellW;
        const y = cursorY + row * cellH;
        const glow = this._spikeGlow[i] || 0;

        if (glow > 0.5) {
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 8 * glow;
        } else if (glow > 0.05) {
          const g = glow;
          ctx.fillStyle = `rgba(${parseInt(color.slice(1,3),16)},${parseInt(color.slice(3,5),16)},${parseInt(color.slice(5,7),16)},${g})`;
          ctx.shadowBlur = 0;
        } else {
          const v = voltages[i];
          const norm = Math.max(0, Math.min(1, (v + 70) / 20));
          ctx.fillStyle = `rgba(255,255,255,${0.03 + norm * 0.12})`;
          ctx.shadowBlur = 0;
        }

        ctx.fillRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);
      }
      ctx.shadowBlur = 0;

      globalIdx += size;
      cursorY += rows * cellH + padding;
    }
  }

  _renderSynapses(s) {
    const ctx = this._synapseCtx;
    const canvas = ctx.canvas;
    const size = canvas.width;

    // Slow fade for persistence
    ctx.fillStyle = 'rgba(10,10,10,0.15)';
    ctx.fillRect(0, 0, size, size);

    if (!s.spikes) return;

    // Sample 50x50 of the 200x200 matrix
    const sample = 50;
    const step = Math.floor(200 / sample);
    const cellSize = size / sample;

    for (let i = 0; i < sample; i++) {
      for (let j = 0; j < sample; j++) {
        const si = i * step;
        const sj = j * step;
        const preGlow = this._spikeGlow[si];
        const postGlow = this._spikeGlow[sj];

        // Only draw if there's activity (skip dead cells for performance)
        if (preGlow < 0.02 && postGlow < 0.02) continue;

        const combined = preGlow * postGlow;

        if (combined > 0.1) {
          // Both active — Hebbian strengthening (bright gold)
          const brightness = Math.min(1, combined * 3);
          ctx.fillStyle = `rgba(255,200,50,${brightness})`;
        } else if (preGlow > postGlow) {
          // Pre more active — LTP potential (cyan)
          ctx.fillStyle = `rgba(0,229,255,${preGlow * 0.6})`;
        } else {
          // Post more active — LTD potential (purple)
          ctx.fillStyle = `rgba(168,85,247,${postGlow * 0.6})`;
        }

        ctx.fillRect(i * cellSize, j * cellSize, cellSize - 0.3, cellSize - 0.3);
      }
    }
  }

  _renderOscillations(s) {
    const ctx = this._oscCtx;
    const canvas = ctx.canvas;
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);

    const len = this._bandHistory.length;
    if (len < 2) return;

    // Plot 4 band power envelopes + coherence — smooth, slow-moving traces
    // These show CHANGES in brain activity over time, not raw fast oscillations
    const bands = [
      { key: 'theta', label: 'θ THETA (4-8Hz) — memory, navigation',     color: '#64b4ff', glow: 'rgba(100,180,255,0.2)' },
      { key: 'alpha', label: 'α ALPHA (8-13Hz) — relaxed attention',      color: '#64ffb4', glow: 'rgba(100,255,180,0.2)' },
      { key: 'beta',  label: 'β BETA (13-30Hz) — active thinking',        color: '#ffb464', glow: 'rgba(255,180,100,0.2)' },
      { key: 'gamma', label: 'γ GAMMA (30-100Hz) — consciousness, binding', color: '#ff4d9a', glow: 'rgba(255,77,154,0.2)' },
    ];
    const bandCount = bands.length;
    const bandH = (h - 30) / (bandCount + 1); // +1 for coherence

    for (let b = 0; b < bandCount; b++) {
      const band = bands[b];
      const yTop = b * bandH + 2;
      const yCenter = yTop + bandH / 2;

      // Grid line
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, yTop);
      ctx.lineTo(w, yTop);
      ctx.stroke();

      // Filled area (envelope)
      ctx.beginPath();
      ctx.fillStyle = band.glow;
      for (let t = 0; t < len; t++) {
        const x = (t / this._maxBandHistory) * w;
        const val = this._bandHistory[t][band.key] ?? 0;
        const y = yCenter - val * bandH * 0.8;
        if (t === 0) { ctx.moveTo(x, yCenter); ctx.lineTo(x, y); }
        else ctx.lineTo(x, y);
      }
      // Close back along center
      ctx.lineTo((len / this._maxBandHistory) * w, yCenter);
      ctx.closePath();
      ctx.fill();

      // Line trace
      ctx.beginPath();
      ctx.strokeStyle = band.color;
      ctx.lineWidth = 1.5;
      for (let t = 0; t < len; t++) {
        const x = (t / this._maxBandHistory) * w;
        const val = this._bandHistory[t][band.key] ?? 0;
        const y = yCenter - val * bandH * 0.8;
        if (t === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Current value + label
      const currentVal = this._bandHistory[len - 1]?.[band.key] ?? 0;
      ctx.fillStyle = band.color;
      ctx.font = '10px monospace';
      ctx.fillText(`${band.label}  ${currentVal.toFixed(3)}`, 6, yTop + 12);
    }

    // Coherence trace at the bottom
    const cohTop = bandCount * bandH + 2;
    const cohCenter = cohTop + bandH / 2;
    const cohLen = this._coherenceHistory.length;

    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, cohTop);
    ctx.lineTo(w, cohTop);
    ctx.stroke();

    if (cohLen > 1) {
      // Filled
      ctx.beginPath();
      ctx.fillStyle = 'rgba(0,229,255,0.15)';
      for (let t = 0; t < cohLen; t++) {
        const x = (t / this._maxBandHistory) * w;
        const val = this._coherenceHistory[t];
        const y = cohCenter - val * bandH * 0.8;
        if (t === 0) { ctx.moveTo(x, cohCenter); ctx.lineTo(x, y); }
        else ctx.lineTo(x, y);
      }
      ctx.lineTo((cohLen / this._maxBandHistory) * w, cohCenter);
      ctx.closePath();
      ctx.fill();

      // Line
      ctx.beginPath();
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2;
      for (let t = 0; t < cohLen; t++) {
        const x = (t / this._maxBandHistory) * w;
        const val = this._coherenceHistory[t];
        const y = cohCenter - val * bandH * 0.8;
        if (t === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    const cohVal = this._coherenceHistory[cohLen - 1] ?? 0;
    ctx.fillStyle = '#00e5ff';
    ctx.font = '10px monospace';
    ctx.fillText(`R COHERENCE — global sync  ${cohVal.toFixed(3)}`, 6, cohTop + 12);

    const cohEl = this._el.querySelector('#bv-coherence');
    if (cohEl) cohEl.textContent = cohVal.toFixed(3);
  }

  _renderAudio() {
    const ctx = this._audioCtx;
    const canvas = ctx.canvas;
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = 'rgba(10,10,10,0.4)';
    ctx.fillRect(0, 0, w, h);

    if (this._audioAnalyser && this._audioData) {
      this._audioAnalyser.getByteFrequencyData(this._audioData);
      const len = this._audioData.length;
      const barWidth = w / len;

      for (let i = 0; i < len; i++) {
        const val = this._audioData[i] / 255;
        const barH = val * h;
        // Color: quiet=dim purple, loud=hot pink
        const r = Math.floor(100 + val * 155);
        const g = Math.floor(30 + val * 47);
        const b = Math.floor(120 + val * 34);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(i * barWidth, h - barH, barWidth - 0.5, barH);
      }
    } else {
      // No mic — draw flatline
      ctx.strokeStyle = 'rgba(255,77,154,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
    }

    // Update heard text
    const hearEl = this._el.querySelector('#bv-hear-text');
    if (hearEl && this._lastHeardText) {
      hearEl.textContent = `Last heard: "${this._lastHeardText}"`;
    }
  }

  _renderSenses(s) {
    const el = this._el.querySelector('#bv-senses');
    if (!el) return;

    // Derive simulated senses from brain state:
    // - Touch: arousal level maps to skin sensation (tingling, warmth, pressure)
    // - Smell: drug state + environment description → inferred scents
    // - Taste: intoxication + reward signal → taste sensations
    const arousal = s.amygdala?.arousal ?? 0;
    const valence = s.amygdala?.valence ?? 0;
    const reward = s.reward ?? 0;
    const drugState = s.drugState || 'cokeAndWeed';
    const coherence = s.oscillations?.coherence ?? 0;

    // Touch — computed from arousal × valence (equation output, not description)
    const touchVal = arousal * (0.5 + Math.abs(valence) * 0.5);
    const touchDesc = `a=${arousal.toFixed(2)} × v=${valence.toFixed(2)} = ${touchVal.toFixed(3)}`;

    // Smell — computed from drug state modulation + coherence
    const smellVal = coherence * 0.6 + arousal * 0.3;
    const smellDesc = `R=${coherence.toFixed(2)} drug=${drugState} = ${smellVal.toFixed(3)}`;

    // Taste — computed from reward signal + arousal
    const tasteVal = Math.abs(reward) * 0.5 + arousal * 0.3;
    const tasteDesc = `δ=${reward.toFixed(3)} × a=${arousal.toFixed(2)} = ${tasteVal.toFixed(3)}`;

    el.innerHTML = `
      <div class="bv-mod-row">
        <span class="bv-mod-name" style="color:#ff6b9d">🤚 TOUCH</span>
        <div class="bv-mod-bar-wrap"><div class="bv-mod-bar" style="width:${touchVal*100}%;background:#ff6b9d"></div></div>
        <span class="bv-mod-detail">${touchDesc}</span>
      </div>
      <div class="bv-mod-row">
        <span class="bv-mod-name" style="color:#b4ff64">👃 SMELL</span>
        <div class="bv-mod-bar-wrap"><div class="bv-mod-bar" style="width:${smellVal*100}%;background:#b4ff64"></div></div>
        <span class="bv-mod-detail">${smellDesc}</span>
      </div>
      <div class="bv-mod-row">
        <span class="bv-mod-name" style="color:#ffb464">👅 TASTE</span>
        <div class="bv-mod-bar-wrap"><div class="bv-mod-bar" style="width:${tasteVal*100}%;background:#ffb464"></div></div>
        <span class="bv-mod-detail">${tasteDesc}</span>
      </div>
    `;
  }

  _renderEyes(s) {
    const ctx = this._eyeOverlayCtx;
    const canvas = ctx.canvas;
    const w = canvas.width;
    const h = canvas.height;

    // Clear overlay
    ctx.clearRect(0, 0, w, h);

    // Scan line effect — sweeps down continuously
    this._eyeScanY = (this._eyeScanY + 1.5) % h;
    const grad = ctx.createLinearGradient(0, this._eyeScanY - 15, 0, this._eyeScanY + 15);
    grad.addColorStop(0, 'rgba(255,77,154,0)');
    grad.addColorStop(0.5, 'rgba(255,77,154,0.25)');
    grad.addColorStop(1, 'rgba(255,77,154,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, this._eyeScanY - 15, w, 30);

    // Corner brackets — "targeting" frame
    const bLen = 30;
    const bOff = 12;
    ctx.strokeStyle = 'rgba(255,77,154,0.6)';
    ctx.lineWidth = 2;
    // Top-left
    ctx.beginPath();
    ctx.moveTo(bOff, bOff + bLen); ctx.lineTo(bOff, bOff); ctx.lineTo(bOff + bLen, bOff);
    ctx.stroke();
    // Top-right
    ctx.beginPath();
    ctx.moveTo(w - bOff - bLen, bOff); ctx.lineTo(w - bOff, bOff); ctx.lineTo(w - bOff, bOff + bLen);
    ctx.stroke();
    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(bOff, h - bOff - bLen); ctx.lineTo(bOff, h - bOff); ctx.lineTo(bOff + bLen, h - bOff);
    ctx.stroke();
    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(w - bOff - bLen, h - bOff); ctx.lineTo(w - bOff, h - bOff); ctx.lineTo(w - bOff, h - bOff - bLen);
    ctx.stroke();

    // Center crosshair (subtle)
    ctx.strokeStyle = 'rgba(0,229,255,0.3)';
    ctx.lineWidth = 1;
    const cx = w / 2, cy = h / 2;
    ctx.beginPath();
    ctx.moveTo(cx - 15, cy); ctx.lineTo(cx + 15, cy);
    ctx.moveTo(cx, cy - 15); ctx.lineTo(cx, cy + 15);
    ctx.stroke();

    // Pulsing focus ring
    const pulse = Math.sin(this._frameCount * 0.05) * 0.3 + 0.5;
    ctx.strokeStyle = `rgba(255,77,154,${pulse * 0.4})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 40 + pulse * 10, 0, Math.PI * 2);
    ctx.stroke();

    // Update description text
    if (this._frameCount % 60 === 0) {
      const descEl = this._el.querySelector('#bv-eye-desc');
      if (descEl && this._visionRef) {
        const desc = this._visionRef.getLastDescription();
        descEl.textContent = desc || 'Analyzing...';
      }
    }
  }

  _renderModules(s) {
    const el = this._el.querySelector('#bv-modules');
    const modules = [
      { name: 'CORTEX', key: 'cortex', eq: 'ŝ=f(x), err=actual-predicted', color: '#ff4d9a' },
      { name: 'HIPPOCAMPUS', key: 'hippocampus', eq: 'E=-½Σw·x·x (Hopfield)', color: '#a855f7' },
      { name: 'AMYGDALA', key: 'amygdala', eq: 'V(s)=Σw·x (valence)', color: '#ef4444' },
      { name: 'BASAL GANGLIA', key: 'basalGanglia', eq: 'P(a)=softmax(Q/τ)', color: '#22c55e' },
      { name: 'CEREBELLUM', key: 'cerebellum', eq: 'ΔW∝(target-actual)', color: '#00e5ff' },
      { name: 'HYPOTHALAMUS', key: 'hypothalamus', eq: 'dH/dt=-α(H-H_set)+in', color: '#f59e0b' },
    ];

    let html = '';
    for (const mod of modules) {
      const data = s[mod.key];
      let value = 0;
      let detail = '';

      if (mod.key === 'cortex') {
        const err = data?.error;
        value = err ? (err.length ? Math.abs(err[0]) : Math.abs(err)) : 0;
        value = Math.min(1, value * 5); // scale up for visibility
        detail = `prediction_error=${(err?.length ? Math.abs(err[0]) : Math.abs(err ?? 0)).toFixed(4)}`;
      } else if (mod.key === 'hippocampus') {
        const energy = Math.abs(data?.energy ?? 0);
        value = Math.min(1, energy / 10);
        detail = `energy=${(data?.energy ?? 0).toFixed(3)} stable=${data?.isStable ?? '?'}`;
      } else if (mod.key === 'amygdala') {
        value = data?.arousal ?? 0;
        detail = `arousal=${(data?.arousal ?? 0).toFixed(3)} valence=${(data?.valence ?? 0).toFixed(3)} fear=${(data?.fear ?? 0).toFixed(3)}`;
      } else if (mod.key === 'basalGanglia') {
        value = data?.confidence ?? 0;
        detail = `→ ${data?.selectedAction ?? 'idle'} (conf=${(data?.confidence ?? 0).toFixed(3)})`;
      } else if (mod.key === 'cerebellum') {
        const err = data?.error;
        value = err ? (err.length ? Math.abs(err[0]) : Math.abs(err)) : 0;
        value = Math.min(1, value * 5);
        detail = `correction=${(err?.length ? Math.abs(err[0]) : Math.abs(err ?? 0)).toFixed(4)}`;
      } else if (mod.key === 'hypothalamus') {
        const drives = data?.drives || {};
        const needs = data?.needsAttention || [];
        value = needs.length > 0 ? 0.8 : 0.3;
        const driveStrs = Object.entries(drives).map(([k, v]) => `${k}=${v?.toFixed?.(2) ?? v}`).join(' ');
        detail = needs.length > 0 ? `NEEDS: ${needs.join(', ')} | ${driveStrs}` : `OK | ${driveStrs}`;
      }

      const barWidth = Math.min(100, value * 100);

      // Cluster firing rate from state
      const cluster = s.clusters?.[mod.key];
      const spikeInfo = cluster ? `${cluster.spikeCount}/${cluster.size || '?'} firing, rate=${(cluster.firingRate ?? 0).toFixed(1)}` : '';

      html += `
        <div class="bv-mod-row">
          <span class="bv-mod-name" style="color:${mod.color}">${mod.name}</span>
          <div class="bv-mod-bar-wrap">
            <div class="bv-mod-bar" style="width:${barWidth}%;background:${mod.color};box-shadow:0 0 ${barWidth > 50 ? 8 : 0}px ${mod.color}"></div>
          </div>
          <span class="bv-mod-detail">${detail}</span>
        </div>
        <div style="font-family:var(--mono);font-size:8px;color:${mod.color}55;margin:-2px 0 4px 108px;">${spikeInfo} | ${mod.eq}</div>
      `;
    }

    // Track Ψ history for consciousness tab
    this._psiHistory.push(s.psi ?? 0);
    if (this._psiHistory.length > this._maxHistory) this._psiHistory.shift();

    el.innerHTML = html;
  }

  _renderPsi(s) {
    const psiEl = this._el.querySelector('#bv-psi');
    const partsEl = this._el.querySelector('#bv-psi-parts');
    const psi = s.psi ?? 0;
    const mystery = s.mystery || {};

    psiEl.textContent = `Ψ = ${psi.toFixed(6)}`;
    if (psi > 2) {
      psiEl.style.color = '#fff';
      psiEl.style.textShadow = '0 0 20px #ff4d9a, 0 0 40px #a855f7';
    } else if (psi > 0.5) {
      psiEl.style.color = '#ff4d9a';
      psiEl.style.textShadow = '0 0 10px rgba(255,77,154,0.5)';
    } else {
      psiEl.style.color = '#a855f7';
      psiEl.style.textShadow = 'none';
    }

    const parts = [];
    if (mystery.id !== undefined) parts.push(`Id=${(typeof mystery.id === 'number' ? mystery.id.toFixed(3) : mystery.id)}`);
    if (mystery.ego !== undefined) parts.push(`Ego=${(typeof mystery.ego === 'number' ? mystery.ego.toFixed(3) : mystery.ego)}`);
    if (mystery.leftBrain !== undefined) parts.push(`Left=${(typeof mystery.leftBrain === 'number' ? mystery.leftBrain.toFixed(3) : mystery.leftBrain)}`);
    if (mystery.rightBrain !== undefined) parts.push(`Right=${(typeof mystery.rightBrain === 'number' ? mystery.rightBrain.toFixed(3) : mystery.rightBrain)}`);
    if (mystery.n !== undefined) parts.push(`n=${mystery.n}`);
    if (s.reward !== undefined) parts.push(`reward=${s.reward.toFixed(3)}`);
    partsEl.textContent = parts.join('  |  ') || 'waiting for brain state...';

    // Ψ history sparkline
    if (this._psiHistory.length > 1) {
      let sparkHtml = '<div style="margin-top:12px;font-family:var(--mono);font-size:9px;color:var(--text-dim);">Ψ HISTORY</div>';
      sparkHtml += '<div style="display:flex;gap:1px;margin-top:4px;height:30px;align-items:flex-end;">';
      const maxPsi = Math.max(0.1, ...this._psiHistory);
      const recent = this._psiHistory.slice(-100);
      for (const val of recent) {
        const h = Math.max(1, (val / maxPsi) * 30);
        const color = val > 1 ? '#ff4d9a' : val > 0.3 ? '#a855f7' : '#333';
        sparkHtml += `<div style="flex:1;height:${h}px;background:${color};border-radius:1px;"></div>`;
      }
      sparkHtml += '</div>';
      partsEl.insertAdjacentHTML('afterend', sparkHtml);
    }
  }

  _renderMemory(s) {
    const el = this._el.querySelector('#bv-memory');
    if (!el) return;
    const mem = s.memory || {};
    const wm = mem.workingMemoryItems || [];
    const recall = mem.lastRecall;

    let html = `
      <div class="bv-mod-row">
        <span class="bv-mod-name" style="color:#a855f7">EPISODES</span>
        <div class="bv-mod-bar-wrap"><div class="bv-mod-bar" style="width:${Math.min(100, (mem.episodeCount || 0))}%;background:#a855f7"></div></div>
        <span class="bv-mod-detail">${mem.episodeCount || 0}/100 stored</span>
      </div>
      <div class="bv-mod-row">
        <span class="bv-mod-name" style="color:#00e5ff">WORKING MEM</span>
        <div class="bv-mod-bar-wrap"><div class="bv-mod-bar" style="width:${(mem.workingMemoryLoad || 0) * 100}%;background:#00e5ff"></div></div>
        <span class="bv-mod-detail">${wm.length}/7 items (${((mem.workingMemoryLoad || 0) * 100).toFixed(0)}% full)</span>
      </div>
    `;
    if (wm.length > 0) {
      html += '<div style="margin-top:8px;font-family:var(--mono);font-size:10px;color:var(--text-dim);">';
      for (const item of wm) {
        const bar = Math.floor(item.strength * 100);
        html += `<div style="margin:2px 0;">WM: ${item.label || '?'} <span style="color:var(--cyan)">${bar}%</span></div>`;
      }
      html += '</div>';
    }
    if (recall) {
      html += `<div style="margin-top:8px;font-family:var(--mono);font-size:10px;color:var(--pink);">Last recall: "${recall.trigger}" (sim=${recall.similarity?.toFixed(2)}, arousal=${recall.arousal?.toFixed(2)})</div>`;
    }
    el.innerHTML = html;
  }

  _renderMotor(s) {
    const el = this._el.querySelector('#bv-motor');
    if (!el) return;
    const motor = s.motor || {};
    const channels = motor.channelRates || [];
    const names = ['respond_text', 'generate_image', 'speak', 'build_ui', 'listen', 'idle'];
    const colors = ['#ff4d9a', '#a855f7', '#f59e0b', '#22c55e', '#00e5ff', '#555'];

    // Track history
    this._motorHistory.push({ channels: [...channels], action: motor.selectedAction, confidence: motor.confidence || 0 });
    if (this._motorHistory.length > this._maxHistory) this._motorHistory.shift();

    let html = '';
    for (let i = 0; i < names.length; i++) {
      const rate = channels[i] || 0;
      const isWinner = names[i] === motor.selectedAction;
      const barWidth = Math.min(100, rate * 100 * 3);

      // Peak value from history (highest this channel ever reached recently)
      let peak = 0;
      for (const h of this._motorHistory) { if ((h.channels[i] || 0) > peak) peak = h.channels[i]; }

      html += `
        <div class="bv-mod-row" style="${isWinner ? 'background:rgba(255,255,255,0.03);border-radius:4px;' : ''}">
          <span class="bv-mod-name" style="color:${colors[i]}">${isWinner ? '► ' : ''}${names[i]}</span>
          <div class="bv-mod-bar-wrap">
            <div class="bv-mod-bar" style="width:${Math.min(100, peak * 100 * 3)}%;background:${colors[i]}33;position:absolute;height:100%;border-radius:3px;"></div>
            <div class="bv-mod-bar" style="width:${barWidth}%;background:${colors[i]}${isWinner ? '' : '88'}"></div>
          </div>
          <span class="bv-mod-detail">${(rate * 100).toFixed(1)}% (peak ${(peak * 100).toFixed(1)}%)${isWinner ? ' ★' : ''}</span>
        </div>
      `;
    }

    // Action history timeline — last 50 decisions
    const recentActions = this._motorHistory.slice(-50);
    html += '<div style="margin-top:10px;font-family:var(--mono);font-size:9px;color:var(--text-dim);">DECISION HISTORY</div>';
    html += '<div style="display:flex;gap:1px;margin-top:4px;height:12px;">';
    for (const h of recentActions) {
      const ci = names.indexOf(h.action);
      const c = ci >= 0 ? colors[ci] : '#333';
      html += `<div style="flex:1;background:${c};border-radius:1px;opacity:${0.3 + (h.confidence || 0) * 0.7}" title="${h.action} ${((h.confidence||0)*100).toFixed(0)}%"></div>`;
    }
    html += '</div>';

    html += `<div style="margin-top:8px;font-family:var(--mono);font-size:10px;color:var(--text-dim);">
      Confidence: ${(motor.confidence || 0).toFixed(3)} | ${motor.speechGated ? '<span style="color:var(--red)">GATED: ' + motor.gateReason + '</span>' : '<span style="color:var(--green)">speech OK</span>'}
      | Cooldown: ${motor.cooldown || 0}
    </div>`;
    el.innerHTML = html;
  }

  _renderInnerVoice(s) {
    const el = this._el.querySelector('#bv-innervoice');
    if (!el) return;
    const iv = s.innerVoice || {};
    const mood = iv.mood || '0/0/0';
    // Color from equations: hue from valence, saturation from arousal, lightness from coherence
    const moodHue = (ivValence >= 0 ? 330 : 240) + ivValence * 30;
    const moodSat = 50 + ivArousal * 50;
    const moodLight = 40 + (iv.coherence ?? 0.5) * 20;
    const moodColor = `hsl(${moodHue},${moodSat}%,${moodLight}%)`;
    const color = moodColor || '#555';

    let html = `
      <div style="text-align:center;margin:12px 0;">
        <div style="font-size:24px;color:${color};font-weight:700;font-family:var(--mono);">${mood.toUpperCase()}</div>
        <div style="font-size:11px;color:var(--text-dim);margin-top:4px;">intensity: ${(iv.moodIntensity ?? 0).toFixed(2)} | vocab: ${iv.vocabSize ?? 0} words | bigrams: ${iv.bigramCount ?? 0}</div>
      </div>
    `;

    if (iv.sentence) {
      html += `<div style="background:#111;border:1px solid ${color}33;border-radius:8px;padding:12px;margin:8px 0;font-family:var(--mono);font-size:13px;color:${color};line-height:1.5;">"${iv.sentence}"</div>`;
      html += `<div style="font-size:9px;color:var(--text-dim);">↑ Self-generated from dictionary (no AI model)</div>`;
    } else {
      html += `<div style="font-size:11px;color:var(--text-dim);margin:8px 0;">${iv.vocabSize < 100 ? `Learning vocabulary... (${iv.vocabSize}/100 words needed for self-speech)` : 'Thought below speech threshold'}</div>`;
    }

    if (iv.words && iv.words.length > 0) {
      html += `<div style="margin-top:12px;font-size:9px;color:var(--text-dim);">MOOD-MATCHING WORDS</div>`;
      html += `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">`;
      for (const w of iv.words) {
        html += `<span style="background:${color}22;border:1px solid ${color}44;border-radius:4px;padding:2px 6px;font-family:var(--mono);font-size:10px;color:${color}">${w}</span>`;
      }
      html += `</div>`;
    }

    if (iv.history && iv.history.length > 0) {
      html += `<div style="margin-top:12px;font-size:9px;color:var(--text-dim);">MOOD HISTORY</div>`;
      html += `<div style="display:flex;gap:2px;margin-top:4px;height:20px;align-items:flex-end;">`;
      for (const h of iv.history) {
        const hHue = ((h.valence ?? 0) >= 0 ? 330 : 240) + (h.valence ?? 0) * 30;
        const c = `hsl(${hHue},${50 + (h.arousal ?? 0.5) * 50}%,${50}%)`;
        const height = Math.max(3, h.arousal * 20);
        html += `<div style="flex:1;height:${height}px;background:${c};border-radius:1px;" title="${h.mood} a=${h.arousal?.toFixed(2)}"></div>`;
      }
      html += `</div>`;
    }

    el.innerHTML = html;
  }

  toggle() {
    if (this._open) this.close();
    else this.open();
  }

  open() {
    this._open = true;
    this._el.classList.remove('hidden');
    // Don't clear history — we've been accumulating while closed
    // so the plots already have data when the user opens the visualizer
    this._render();
  }

  close() {
    this._open = false;
    this._el.classList.add('hidden');
    if (this._animId) {
      cancelAnimationFrame(this._animId);
      this._animId = null;
    }
  }

  isOpen() {
    return this._open;
  }
}
