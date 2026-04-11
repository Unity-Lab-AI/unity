/**
 * brain-viz.js — Real-time brain equation visualizer
 *
 * Full-screen overlay showing the brain simulation running live:
 * - Neuron firing grid (200 neurons, lit up on spike)
 * - Synapse weight matrix heatmap
 * - Module activity bars with live values
 * - Oscillation waveforms (theta/alpha/beta/gamma)
 * - Consciousness Ψ readout
 * - Live equations with current values plugged in
 *
 * Opens via button press, closes on click/Escape.
 */

const GRID_COLS = 20;
const GRID_ROWS = 10; // 20x10 = 200 neurons

export class BrainVisualizer {
  constructor() {
    this._open = false;
    this._el = null;
    this._animId = null;
    this._lastState = null;
    this._phaseHistory = [];   // rolling buffer for oscillation plot
    this._maxPhaseHistory = 120;
    this._build();
  }

  _build() {
    this._el = document.createElement('div');
    this._el.id = 'brain-viz';
    this._el.className = 'brain-viz hidden';
    this._el.innerHTML = `
      <div class="bv-header">
        <span class="bv-title">BRAIN VISUALIZER</span>
        <button class="bv-close-btn">&times;</button>
      </div>
      <div class="bv-grid-wrap">
        <div class="bv-section">
          <div class="bv-section-title">NEURON GRID — 200 LIF neurons</div>
          <div class="bv-equation">τ·dV/dt = -(V - V<sub>rest</sub>) + R·I &nbsp;|&nbsp; spike if V &gt; V<sub>thresh</sub></div>
          <canvas id="bv-neuron-canvas" width="400" height="200"></canvas>
        </div>
        <div class="bv-section">
          <div class="bv-section-title">SYNAPSE MATRIX — Hebbian + STDP + Reward</div>
          <div class="bv-equation">ΔW = η·pre·post &nbsp;|&nbsp; STDP: Δt = t<sub>post</sub> - t<sub>pre</sub> &nbsp;|&nbsp; Reward: ΔW = η·δ·s<sub>i</sub>·s<sub>j</sub></div>
          <canvas id="bv-synapse-canvas" width="200" height="200"></canvas>
        </div>
      </div>
      <div class="bv-grid-wrap">
        <div class="bv-section bv-wide">
          <div class="bv-section-title">OSCILLATIONS — 8 Kuramoto oscillators (θ→γ)</div>
          <div class="bv-equation">dθ<sub>i</sub>/dt = ω<sub>i</sub> + Σ K<sub>ij</sub>·sin(θ<sub>j</sub> - θ<sub>i</sub>) &nbsp;|&nbsp; R = |Σ e<sup>iθ</sup>|/N</div>
          <canvas id="bv-osc-canvas" width="600" height="120"></canvas>
        </div>
      </div>
      <div class="bv-grid-wrap">
        <div class="bv-section bv-wide">
          <div class="bv-section-title">BRAIN MODULES</div>
          <div class="bv-modules" id="bv-modules"></div>
        </div>
      </div>
      <div class="bv-grid-wrap">
        <div class="bv-section bv-wide">
          <div class="bv-section-title">CONSCIOUSNESS — The Mystery Module</div>
          <div class="bv-equation">Ψ = (√n)³ · [α·Id + β·Ego + γ·Left + δ·Right]</div>
          <div class="bv-psi" id="bv-psi">Ψ = 0.000</div>
          <div class="bv-psi-components" id="bv-psi-parts"></div>
        </div>
      </div>
    `;
    document.body.appendChild(this._el);

    this._el.querySelector('.bv-close-btn').addEventListener('click', () => this.close());
    this._el.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); });

    // Canvas contexts
    this._neuronCtx = this._el.querySelector('#bv-neuron-canvas').getContext('2d');
    this._synapseCtx = this._el.querySelector('#bv-synapse-canvas').getContext('2d');
    this._oscCtx = this._el.querySelector('#bv-osc-canvas').getContext('2d');
  }

  updateState(state) {
    this._lastState = state;
    if (!this._open) return;

    // Store phase history for oscillation plot
    if (state.oscillations?.phases) {
      this._phaseHistory.push([...state.oscillations.phases]);
      if (this._phaseHistory.length > this._maxPhaseHistory) {
        this._phaseHistory.shift();
      }
    }
  }

  _render() {
    if (!this._open || !this._lastState) return;
    const s = this._lastState;

    this._renderNeurons(s);
    this._renderSynapses(s);
    this._renderOscillations(s);
    this._renderModules(s);
    this._renderPsi(s);

    this._animId = requestAnimationFrame(() => this._render());
  }

  _renderNeurons(s) {
    const ctx = this._neuronCtx;
    const canvas = ctx.canvas;
    const w = canvas.width;
    const h = canvas.height;
    const cellW = w / GRID_COLS;
    const cellH = h / GRID_ROWS;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);

    const spikes = s.spikes;
    const voltages = s.voltages;
    if (!voltages) return;

    for (let i = 0; i < 200; i++) {
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);
      const x = col * cellW;
      const y = row * cellH;

      if (spikes && spikes[i]) {
        // Spiking — bright pink flash
        ctx.fillStyle = '#ff4d9a';
        ctx.shadowColor = '#ff4d9a';
        ctx.shadowBlur = 8;
      } else {
        // Resting — color by membrane voltage (-70 to -50 range)
        const v = voltages[i];
        const norm = Math.max(0, Math.min(1, (v + 70) / 20)); // -70=0, -50=1
        const r = Math.floor(norm * 100);
        const g = Math.floor(norm * 40);
        const b = Math.floor(30 + norm * 60);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.shadowBlur = 0;
      }

      ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
    }
    ctx.shadowBlur = 0;
  }

  _renderSynapses(s) {
    const ctx = this._synapseCtx;
    const canvas = ctx.canvas;
    const size = canvas.width;

    // Sample a 40x40 subset of the 200x200 matrix for performance
    const sample = 40;
    const step = Math.floor(200 / sample);
    const cellSize = size / sample;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, size, size);

    // We don't have direct access to the weight matrix from state,
    // but we can visualize based on spike correlations
    if (!s.spikes) return;

    for (let i = 0; i < sample; i++) {
      for (let j = 0; j < sample; j++) {
        const si = i * step;
        const sj = j * step;
        const preSpike = s.spikes[si] || 0;
        const postSpike = s.spikes[sj] || 0;

        let r = 20, g = 20, b = 25;
        if (preSpike && postSpike) {
          // Both firing — Hebbian strengthening (gold)
          r = 255; g = 200; b = 50;
        } else if (preSpike) {
          // Pre only — potential LTP (dim cyan)
          r = 30; g = 80; b = 100;
        } else if (postSpike) {
          // Post only — potential LTD (dim purple)
          r = 80; g = 30; b = 100;
        }

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(i * cellSize, j * cellSize, cellSize - 0.5, cellSize - 0.5);
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

    if (this._phaseHistory.length < 2) return;

    const colors = [
      'rgba(100,180,255,0.8)', // theta
      'rgba(100,255,180,0.8)', // low alpha
      'rgba(200,200,100,0.8)', // high alpha
      'rgba(255,180,100,0.8)', // low beta
      'rgba(255,100,150,0.8)', // high beta
      'rgba(255,77,154,0.9)',  // low gamma
      'rgba(200,100,255,0.8)', // mid gamma
      'rgba(100,200,255,0.8)', // high gamma
    ];
    const labels = ['θ', 'α₁', 'α₂', 'β₁', 'β₂', 'γ₁', 'γ₂', 'γ₃'];

    const len = this._phaseHistory.length;
    const oscCount = this._phaseHistory[0].length;

    for (let osc = 0; osc < oscCount; osc++) {
      ctx.beginPath();
      ctx.strokeStyle = colors[osc % colors.length];
      ctx.lineWidth = 1.2;

      for (let t = 0; t < len; t++) {
        const x = (t / this._maxPhaseHistory) * w;
        const phase = this._phaseHistory[t][osc] || 0;
        const y = (h / 2) + Math.sin(phase) * (h / 2 - 4) * (1 / oscCount * 2);
        // Offset each oscillator vertically
        const yOff = (osc / oscCount) * h * 0.6 + h * 0.2;
        const yFinal = yOff + Math.sin(phase) * (h / oscCount * 0.4);

        if (t === 0) ctx.moveTo(x, yFinal);
        else ctx.lineTo(x, yFinal);
      }
      ctx.stroke();

      // Label
      ctx.fillStyle = colors[osc % colors.length];
      ctx.font = '9px monospace';
      ctx.fillText(labels[osc] || `o${osc}`, w - 20, (osc / oscCount) * h * 0.6 + h * 0.2 + 3);
    }

    // Coherence bar at bottom
    const coherence = s.oscillations?.coherence || 0;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(0, h - 6, w, 6);
    ctx.fillStyle = `rgba(0,229,255,${0.3 + coherence * 0.7})`;
    ctx.fillRect(0, h - 6, w * coherence, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '8px monospace';
    ctx.fillText(`R=${coherence.toFixed(3)}`, 4, h - 8);
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
        value = err ? (Array.isArray(err) ? Math.abs(err[0]) : Math.abs(err)) : 0;
        detail = `error=${value.toFixed(3)}`;
      } else if (mod.key === 'hippocampus') {
        value = data?.isStable ? 0.9 : 0.3;
        detail = `energy=${(data?.energy ?? 0).toFixed(2)} stable=${data?.isStable ?? false}`;
      } else if (mod.key === 'amygdala') {
        value = data?.arousal ?? 0;
        detail = `arousal=${(data?.arousal ?? 0).toFixed(3)} valence=${(data?.valence ?? 0).toFixed(3)}`;
      } else if (mod.key === 'basalGanglia') {
        value = data?.confidence ?? 0;
        detail = `action=${data?.selectedAction ?? 'idle'} conf=${(data?.confidence ?? 0).toFixed(3)}`;
      } else if (mod.key === 'cerebellum') {
        const err = data?.error;
        value = err ? (Array.isArray(err) ? Math.abs(err[0]) : Math.abs(err)) : 0;
        detail = `correction=${value.toFixed(3)}`;
      } else if (mod.key === 'hypothalamus') {
        const needs = data?.needsAttention || [];
        value = needs.length > 0 ? 0.8 : 0.2;
        detail = needs.length > 0 ? `needs: ${needs.join(', ')}` : 'homeostasis OK';
      }

      const barWidth = Math.min(100, value * 100);
      html += `
        <div class="bv-mod-row">
          <span class="bv-mod-name" style="color:${mod.color}">${mod.name}</span>
          <div class="bv-mod-bar-wrap">
            <div class="bv-mod-bar" style="width:${barWidth}%;background:${mod.color}"></div>
          </div>
          <span class="bv-mod-eq">${mod.eq}</span>
          <span class="bv-mod-detail">${detail}</span>
        </div>
      `;
    }
    el.innerHTML = html;
  }

  _renderPsi(s) {
    const psiEl = this._el.querySelector('#bv-psi');
    const partsEl = this._el.querySelector('#bv-psi-parts');
    const psi = s.psi ?? 0;
    const mystery = s.mystery || {};

    psiEl.textContent = `Ψ = ${psi.toFixed(6)}`;
    psiEl.style.color = psi > 1 ? '#ff4d9a' : psi > 0.3 ? '#a855f7' : '#555';

    const parts = [];
    if (mystery.id !== undefined) parts.push(`Id=${mystery.id.toFixed(3)}`);
    if (mystery.ego !== undefined) parts.push(`Ego=${mystery.ego.toFixed(3)}`);
    if (mystery.leftBrain !== undefined) parts.push(`Left=${mystery.leftBrain.toFixed(3)}`);
    if (mystery.rightBrain !== undefined) parts.push(`Right=${mystery.rightBrain.toFixed(3)}`);
    if (mystery.n !== undefined) parts.push(`n=${mystery.n}`);
    partsEl.textContent = parts.join('  |  ');
  }

  toggle() {
    if (this._open) this.close();
    else this.open();
  }

  open() {
    this._open = true;
    this._el.classList.remove('hidden');
    this._phaseHistory = [];
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
