/**
 * brain-3d.js — WebGL 3D brain visualizer
 *
 * 1000 neurons rendered as gl.POINTS in anatomically-inspired 3D clusters.
 * Raw WebGL — no Three.js, no deps. Inline vertex/fragment shaders.
 *
 * Features:
 *   - 7 neural clusters positioned like a real brain
 *   - Spike glow (bright) + afterglow fade per neuron
 *   - Pulse ripple effect radiating from spiking neurons
 *   - Inter-cluster connection lines between active neurons
 *   - Floating HTML cluster labels projected from 3D
 *   - Toggle buttons to show/hide each cluster
 *   - Mouse drag rotate, scroll zoom, touch support
 *   - WebGL context loss/restore recovery
 *   - Dark (#050505) gothic/cyberpunk aesthetic
 */

// ── Constants ───────────────────────────────────────────────────────

// Render neuron count — proportional sample of the full brain
// 3.2M actual neurons rendered as 20K visual points
let TOTAL = 1000;
const MAX_RENDER_NEURONS = 20000;
const AFTERGLOW_DECAY = 0.92;
const PULSE_LIFE = 40;
const MAX_PULSES = 80;
const MAX_CONN = 500;
const AUTO_ROT_SPEED = 0.0015;

// ── Cluster definitions ─────────────────────────────────────────────

// ORIGINAL ORDER preserved (changing order breaks indexing chain)
// Sizes biologically proportioned — cerebellum LARGEST
// Total MUST = 1000: 200+100+80+80+380+50+110 = 1000
const CLUSTERS = [
  { key: 'cortex',       label: 'CORTEX',        n: 200, rgb: [1.0, 0.302, 0.604],  hex: '#ff4d9a' },
  { key: 'hippocampus',  label: 'HIPPOCAMPUS',   n: 100, rgb: [0.659, 0.333, 0.969], hex: '#a855f7' },
  { key: 'amygdala',     label: 'AMYGDALA',       n: 80,  rgb: [0.937, 0.267, 0.267], hex: '#ef4444' },
  { key: 'basalGanglia', label: 'BASAL GANGLIA', n: 80,  rgb: [0.133, 0.773, 0.369], hex: '#22c55e' },
  { key: 'cerebellum',   label: 'CEREBELLUM',    n: 380, rgb: [0.0, 0.898, 1.0],     hex: '#00e5ff' },
  { key: 'hypothalamus', label: 'HYPOTHALAMUS',  n: 50,  rgb: [0.961, 0.620, 0.043], hex: '#f59e0b' },
  { key: 'mystery',      label: 'MYSTERY Ψ',     n: 110, rgb: [0.753, 0.518, 0.988], hex: '#c084fc' },
];

// ── Inline shaders ──────────────────────────────────────────────────

const NEURON_VS = `
attribute vec3 aPos;
attribute vec3 aCol;
attribute float aGlow;
attribute float aVis;
uniform mat4 uMVP;
uniform float uScale;
varying vec3 vCol;
varying float vGlow;
varying float vVis;
void main() {
  vCol = aCol;
  vGlow = aGlow;
  vVis = aVis;
  vec4 p = uMVP * vec4(aPos, 1.0);
  gl_Position = p;
  float sz = mix(2.0, 7.0, aGlow);
  gl_PointSize = sz * uScale / max(p.w, 0.5);
}
`;

const NEURON_FS = `
precision mediump float;
varying vec3 vCol;
varying float vGlow;
varying float vVis;
void main() {
  if (vVis < 0.5) discard;
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float edge = smoothstep(0.5, 0.15, d);
  float bright = mix(0.12, 1.0, vGlow);
  float alpha = edge * mix(0.3, 1.0, vGlow);
  // bloom halo for spiking
  float halo = vGlow * exp(-d * 5.0) * 0.5;
  vec3 col = vCol * bright + vec3(1.0) * halo;
  gl_FragColor = vec4(col, alpha);
}
`;

const LINE_VS = `
attribute vec3 aPos;
attribute vec4 aCol;
uniform mat4 uMVP;
varying vec4 vCol;
void main() {
  vCol = aCol;
  gl_Position = uMVP * vec4(aPos, 1.0);
}
`;

const LINE_FS = `
precision mediump float;
varying vec4 vCol;
void main() {
  gl_FragColor = vCol;
}
`;

const PULSE_VS = `
attribute vec3 aPos;
attribute float aLife;
attribute vec3 aCol;
uniform mat4 uMVP;
uniform float uScale;
varying float vLife;
varying vec3 vCol;
void main() {
  vLife = aLife;
  vCol = aCol;
  vec4 p = uMVP * vec4(aPos, 1.0);
  gl_Position = p;
  gl_PointSize = (4.0 + aLife * 14.0) * uScale / max(p.w, 0.5);
}
`;

const PULSE_FS = `
precision mediump float;
varying float vLife;
varying vec3 vCol;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  // ring shape that fades
  float ring = smoothstep(0.32, 0.38, d) * smoothstep(0.5, 0.44, d);
  float core = smoothstep(0.5, 0.0, d) * 0.1;
  float alpha = (ring * 0.7 + core) * vLife;
  gl_FragColor = vec4(vCol, alpha);
}
`;

// ── Math utilities ──────────────────────────────────────────────────

function m4Ident() {
  return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
}

function m4Persp(fov, asp, near, far) {
  const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
  return new Float32Array([
    f/asp, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far+near)*nf, -1,
    0, 0, 2*far*near*nf, 0,
  ]);
}

function m4Mul(a, b) {
  const o = new Float32Array(16);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++)
      o[j*4+i] = a[i]*b[j*4] + a[4+i]*b[j*4+1] + a[8+i]*b[j*4+2] + a[12+i]*b[j*4+3];
  return o;
}

function m4RotX(m, a) {
  const c = Math.cos(a), s = Math.sin(a), r = m4Ident();
  r[5]=c; r[6]=s; r[9]=-s; r[10]=c;
  return m4Mul(m, r);
}

function m4RotY(m, a) {
  const c = Math.cos(a), s = Math.sin(a), r = m4Ident();
  r[0]=c; r[2]=-s; r[8]=s; r[10]=c;
  return m4Mul(m, r);
}

function m4Trans(m, x, y, z) {
  const r = m4Ident();
  r[12]=x; r[13]=y; r[14]=z;
  return m4Mul(m, r);
}

function m4Project(m, v) {
  return [
    m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12]*v[3],
    m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13]*v[3],
    m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]*v[3],
    m[3]*v[0]+m[7]*v[1]+m[11]*v[2]+m[15]*v[3],
  ];
}

/** Box-Muller gaussian */
function gauss() {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ── Anatomical position generators ──────────────────────────────────
// Each returns an array of [x,y,z] for every neuron in that cluster.

function genCortex(n) {
  // TWO HEMISPHERES — left brain (logic) + right brain (creativity)
  // Split at x=0 with longitudinal fissure gap
  const pts = [];
  const half = Math.floor(n / 2);
  for (let i = 0; i < n; i++) {
    const side = i < half ? -1 : 1;
    const theta = Math.acos(1 - Math.random() * 1.2);
    const phi = Math.random() * Math.PI * 2;
    const r = 1.6 + (Math.random() - 0.5) * 0.25;
    const x = r * Math.sin(theta) * Math.cos(phi);
    pts.push([
      side * (Math.abs(x) * 0.5 + 0.15), // hemispheres pushed apart
      r * Math.cos(theta) * 0.65 + 0.45,
      r * Math.sin(theta) * Math.sin(phi),
    ]);
  }
  return pts;
}

function genHippocampus(n) {
  // Bilateral seahorse — one in each hemisphere
  const pts = [];
  const half = Math.floor(n / 2);
  for (let i = 0; i < n; i++) {
    const side = i < half ? -1 : 1;
    const t = ((i % half) / half) * Math.PI * 1.5;
    const r = 0.14 + Math.random() * 0.1;
    pts.push([
      side * (0.35 + Math.cos(t) * 0.25) + gauss() * r * 0.3,
      -0.1 + Math.sin(t * 0.6) * 0.28 + gauss() * r * 0.3,
      0.1 + Math.sin(t) * 0.28 + gauss() * r * 0.5,
    ]);
  }
  return pts;
}

function genAmygdala(n) {
  // Two almond clusters, inner-front bilateral
  const pts = [];
  const half = Math.floor(n / 2);
  for (let i = 0; i < n; i++) {
    const side = i < half ? -1 : 1;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 0.16 * Math.cbrt(Math.random());
    pts.push([
      side * 0.45 + r * 0.7 * Math.sin(phi) * Math.cos(theta),
      -0.3 + r * 0.45 * Math.cos(phi),
      0.65 + r * 0.5 * Math.sin(phi) * Math.sin(theta),
    ]);
  }
  return pts;
}

function genBasalGanglia(n) {
  // Deep center — striatum/pallidum
  const pts = [];
  for (let i = 0; i < n; i++) {
    const r = 0.35 * Math.cbrt(Math.random());
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    pts.push([
      r * Math.sin(phi) * Math.cos(theta),
      -0.1 + r * Math.cos(phi) * 0.55,
      r * Math.sin(phi) * Math.sin(theta) * 0.9,
    ]);
  }
  return pts;
}

function genCerebellum(n) {
  // LARGEST cluster — wide bilateral spread below and behind cortex
  // Needs big volume since it has 40% of all neurons
  const pts = [];
  const half = Math.floor(n / 2);
  for (let i = 0; i < n; i++) {
    const side = i < half ? -1 : 1;
    const r = 0.3 + Math.random() * 0.6;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    pts.push([
      side * (0.2 + Math.abs(r * Math.sin(phi) * Math.cos(theta)) * 0.8),
      -0.5 - Math.abs(r * Math.cos(phi)) * 0.6 + gauss() * 0.05,
      -0.2 - Math.abs(r * Math.sin(phi) * Math.sin(theta)) * 0.5,
    ]);
  }
  return pts;
}

function genHypothalamus(n) {
  // Small dense cluster, center-bottom
  const pts = [];
  for (let i = 0; i < n; i++) {
    const r = 0.14 * Math.cbrt(Math.random());
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    pts.push([
      r * Math.sin(phi) * Math.cos(theta),
      -0.6 + r * Math.cos(phi) * 0.4,
      0.2 + r * Math.sin(phi) * Math.sin(theta) * 0.45,
    ]);
  }
  return pts;
}

function genMystery(n) {
  // Ψ CONSCIOUSNESS — bridge between hemispheres (corpus callosum)
  // Runs through the CENTER connecting left and right brain
  // Plus a crown above for the "higher" consciousness
  const pts = [];
  const bridge = Math.floor(n * 0.6); // 60% in the bridge
  const crown = n - bridge; // 40% above as ethereal crown
  // Bridge — thin band connecting hemispheres at x=0
  for (let i = 0; i < bridge; i++) {
    const t = (i / bridge) * Math.PI * 2;
    pts.push([
      gauss() * 0.05,  // tight to center (x≈0)
      0.1 + Math.sin(t) * 0.4 + gauss() * 0.05,
      Math.cos(t) * 0.4 + gauss() * 0.05,
    ]);
  }
  // Crown — ethereal cloud above
  for (let i = 0; i < crown; i++) {
    const r = 0.2 * Math.cbrt(Math.random());
    const theta = Math.random() * Math.PI * 2;
    pts.push([
      r * Math.cos(theta) * 0.3,
      1.4 + r * Math.sin(theta) * 0.2 + Math.random() * 0.15,
      r * Math.sin(theta) * 0.3,
    ]);
  }
  return pts;
}

// Order matches CLUSTERS array
const POS_GEN = [genCortex, genHippocampus, genAmygdala, genBasalGanglia, genCerebellum, genHypothalamus, genMystery];

// ── Brain3D class ───────────────────────────────────────────────────

export class Brain3D {

  constructor(containerId) {
    this._containerId = containerId;
    this._open = false;
    this._destroyed = false;

    // Camera state
    this._rotX = -0.25;
    this._rotY = 0;
    this._zoom = 4.2;
    this._dragging = false;
    this._lastMouse = [0, 0];

    // Per-neuron state
    this._glow = new Float32Array(TOTAL);
    this._vis = new Float32Array(TOTAL).fill(1);
    this._clusterOn = CLUSTERS.map(() => true);

    // Pulses & connections
    this._pulses = [];
    this._connPos = new Float32Array(MAX_CONN * 6);
    this._connCol = new Float32Array(MAX_CONN * 8);
    this._connN = 0;

    // Pop-up notifications — floating process labels
    this._notifications = [];  // { text, x, y, z, age, maxAge, color }
    this._notifEls = [];       // DOM elements for notifications
    this._lastNotifTime = 0;
    this._lastState = null;

    // Brain expansion — clusters spread as activity increases
    this._expansionFactor = 1.0;  // 1.0 = default, grows with activity
    this._basePos = null;          // original positions before expansion

    // GL resources (set in _initGL)
    this._gl = null;
    this._canvas = null;
    this._animId = null;

    // Build
    this._buildDOM();
    if (!this._canvas) {
      console.warn('[Brain3D] Canvas not created — 3D viewer disabled');
      this._destroyed = true;
      return;
    }
    this._genPositions();
    try {
      this._initGL();
      if (this._gl) this._uploadStatic();
    } catch (err) {
      console.warn('[Brain3D] WebGL init failed:', err.message);
    }
  }

  // ── Public API ──────────────────────────────────────────────────

  updateState(state) {
    if (!state || !this._open || this._destroyed) return;
    this._lastState = state;

    // Scale render count from ACTUAL server cluster sizes (one-time)
    const serverNeurons = state.totalNeurons || 1000;
    if (serverNeurons > 1000 && !this._scaled) {
      this._scaled = true;
      TOTAL = Math.min(MAX_RENDER_NEURONS, Math.max(1000, Math.round(serverNeurons / 100)));

      // Read ACTUAL cluster sizes from server state — dynamic, not hardcoded
      if (state.clusters) {
        const serverClusters = state.clusters;
        const serverTotal = Object.values(serverClusters).reduce((s, c) => s + (c.size || 0), 0) || 1;
        console.log(`[Brain3D] Server clusters:`, Object.entries(serverClusters).map(([k,v]) => `${k}=${v.size}`).join(', '));
        console.log(`[Brain3D] Server total: ${serverTotal}, TOTAL render: ${TOTAL}`);
        // Map each CLUSTERS entry to its proportional share of TOTAL
        for (const cl of CLUSTERS) {
          const serverCluster = serverClusters[cl.key];
          if (serverCluster && serverCluster.size) {
            cl.n = Math.max(10, Math.round((serverCluster.size / serverTotal) * TOTAL));
          }
          console.log(`[Brain3D] ${cl.key}: server=${serverCluster?.size || 'MISSING'} → render=${cl.n}`);
        }
        // Adjust to exactly TOTAL
        const renderSum = CLUSTERS.reduce((s, c) => s + c.n, 0);
        if (renderSum !== TOTAL) CLUSTERS[0].n += (TOTAL - renderSum);
        console.log(`[Brain3D] Final render neurons:`, CLUSTERS.map(c => `${c.key}=${c.n}`).join(', '));
      } else {
        // No cluster data — scale from base proportions
        const clusterScale = TOTAL / 1000;
        for (const c of CLUSTERS) c.n = Math.round(c.n * clusterScale);
      }
      // Rebuild neuron positions and GL buffers
      this._glow = new Float32Array(TOTAL);
      this._vis = new Float32Array(TOTAL).fill(1);
      this._genPositions();
      if (this._gl) this._uploadStatic();
      console.log(`[Brain3D] Scaled to ${TOTAL} render neurons (server has ${serverNeurons.toLocaleString()})`);
      // Update scale displays
      const ratio = Math.round(serverNeurons / TOTAL);
      const scaleInfo = this._overlay?.querySelector('.b3d-scale-info');
      if (scaleInfo) scaleInfo.textContent = `${TOTAL.toLocaleString()} rendered · ${serverNeurons.toLocaleString()} actual (${ratio}:1) · 7 clusters`;
      const actualEl = this._overlay?.querySelector('.b3d-actual-count');
      if (actualEl) actualEl.textContent = serverNeurons.toLocaleString();
      const ratioEl = this._overlay?.querySelector('.b3d-render-ratio');
      if (ratioEl) ratioEl.textContent = `showing 1:${ratio} (${TOTAL.toLocaleString()} of ${serverNeurons.toLocaleString()})`;
    }

    const spk = state.spikes;
    if (!spk) return;

    // Debug: count spikes per cluster
    if (!this._debuggedSpikes) {
      this._debuggedSpikes = true;
      let off = 0;
      for (const cl of CLUSTERS) {
        let count = 0;
        for (let i = 0; i < cl.n && off + i < spk.length; i++) {
          if (spk[off + i]) count++;
        }
        console.log(`[Brain3D] Spikes: ${cl.key} offset=${off} n=${cl.n} active=${count}/${cl.n} (${(count/cl.n*100).toFixed(1)}%)`);
        off += cl.n;
      }
      console.log(`[Brain3D] Total spk length: ${spk.length}, TOTAL: ${TOTAL}`);
    }

    for (let i = 0; i < TOTAL; i++) {
      if (spk[i]) {
        this._glow[i] = 1.0;
        if (this._pulses.length < MAX_PULSES && Math.random() < 0.12) {
          const ci = this._clusterOf(i);
          this._pulses.push({
            x: this._pos[i*3], y: this._pos[i*3+1], z: this._pos[i*3+2],
            age: 0, col: CLUSTERS[ci].rgb,
          });
        }
      } else {
        this._glow[i] *= AFTERGLOW_DECAY;
        if (this._glow[i] < 0.005) this._glow[i] = 0;
      }
    }

    this._buildConns(spk);

    // ── BRAIN EXPANSION — clusters spread with activity ──
    const totalSpikes = state.spikeCount || 0;
    const targetExpansion = 1.0 + (totalSpikes / TOTAL) * 0.5; // 0-50% growth
    this._expansionFactor += (targetExpansion - this._expansionFactor) * 0.02; // smooth
    this._applyExpansion();

    // ── PROCESS NOTIFICATIONS — one every ~5 seconds ──
    // Translates real neural activity into readable process descriptions.
    // Not random — derived from actual cluster states and equations.
    const now = performance.now();
    if (now - this._lastNotifTime > 5000) {
      this._generateProcessNotification(state);
      this._lastNotifTime = now;
    }

    // ── Update HUD ──
    if (state.psi !== undefined) {
      const el = this._overlay?.querySelector('.b3d-psi');
      if (el) el.textContent = state.psi.toFixed(3);
    }
    if (state.oscillations?.coherence !== undefined) {
      const el = this._overlay?.querySelector('.b3d-coh');
      if (el) el.textContent = (state.oscillations.coherence * 100).toFixed(0) + '%';
    }
  }

  toggle() { this._open ? this.close() : this.open(); }

  open() {
    if (this._destroyed) return;
    this._open = true;
    this._overlay.classList.remove('b3d-hidden');
    this._startLoop();
  }

  close() {
    if (this._destroyed || !this._overlay) return;
    this._open = false;
    this._overlay.classList.add('b3d-hidden');
    this._stopLoop();
  }

  isOpen() { return this._open; }

  destroy() {
    this._destroyed = true;
    this._stopLoop();
    if (this._gl) {
      const ext = this._gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    }
    this._overlay?.remove();
    this._gl = null;
  }

  // ── DOM ─────────────────────────────────────────────────────────

  _buildDOM() {
    const host = document.getElementById(this._containerId) || document.body;

    const ov = document.createElement('div');
    ov.className = 'b3d-overlay b3d-hidden';
    ov.innerHTML = `
<style>
.b3d-overlay{position:fixed;inset:0;background:#050505;z-index:9999;display:flex;flex-direction:column;font-family:'JetBrains Mono','Fira Code','Cascadia Code',monospace;overflow:hidden}
.b3d-hidden{display:none!important}
.b3d-hdr{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:rgba(8,8,8,.95);border-bottom:1px solid #1a1a2e;flex-shrink:0}
.b3d-title{font-size:12px;font-weight:700;letter-spacing:2px;background:linear-gradient(90deg,#ff4d9a,#a855f7,#00e5ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.b3d-met{display:flex;gap:14px;font-size:10px;color:#666}
.b3d-met b{font-weight:600}
.b3d-psi{color:#c084fc;font-weight:600}
.b3d-coh{color:#00e5ff;font-weight:600}
.b3d-close{background:none;border:1px solid #2a2a2a;color:#777;font-size:18px;cursor:pointer;width:28px;height:28px;border-radius:4px;display:flex;align-items:center;justify-content:center;transition:all .2s}
.b3d-close:hover{border-color:#ff4d9a;color:#ff4d9a}
.b3d-body{flex:1;position:relative;overflow:hidden}
.b3d-cv{width:100%;height:100%;display:block;cursor:grab}
.b3d-cv:active{cursor:grabbing}
.b3d-tog-wrap{position:absolute;top:10px;left:10px;display:flex;flex-direction:column;gap:3px;z-index:2}
.b3d-tog{background:rgba(8,8,8,.85);border:1px solid #222;color:#bbb;font-size:9px;font-family:inherit;padding:3px 9px;border-radius:3px;cursor:pointer;display:flex;align-items:center;gap:5px;transition:all .2s;letter-spacing:.4px}
.b3d-tog:hover{border-color:#444}
.b3d-tog.off{opacity:.3}
.b3d-dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex-shrink:0}
.b3d-lbl-wrap{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:1}
.b3d-lbl{position:absolute;font-size:8px;letter-spacing:1px;font-weight:600;white-space:nowrap;transform:translate(-50%,-50%);opacity:.65;text-shadow:0 0 8px rgba(0,0,0,.95);transition:opacity .3s}
.b3d-foot{position:absolute;bottom:8px;left:12px;right:12px;display:flex;justify-content:space-between;font-size:9px;color:#444;pointer-events:none;z-index:1}
.b3d-notif-wrap{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:3}
.b3d-notif{position:absolute;font-size:11px;font-family:inherit;white-space:nowrap;text-shadow:0 0 12px rgba(0,0,0,.95),0 0 4px currentColor;pointer-events:none;letter-spacing:.3px;padding:4px 8px;background:rgba(0,0,0,.6);border-radius:4px;border-left:2px solid currentColor;backdrop-filter:blur(2px);max-width:500px;overflow:hidden;text-overflow:ellipsis}
.b3d-log-wrap{position:absolute;bottom:30px;right:10px;width:280px;max-height:200px;z-index:2;pointer-events:auto}
.b3d-log-title{font-size:9px;color:#555;letter-spacing:1px;margin-bottom:4px}
.b3d-log{max-height:180px;overflow-y:auto;font-size:8px;line-height:1.5;scrollbar-width:thin;scrollbar-color:#222 transparent}
.b3d-log::-webkit-scrollbar{width:3px}
.b3d-log::-webkit-scrollbar-thumb{background:#333;border-radius:2px}
.b3d-log-entry{opacity:.7;padding:1px 0}
.b3d-expansion{position:absolute;top:40px;right:10px;font-size:9px;color:#555;z-index:2}
</style>
<div class="b3d-hdr">
  <div class="b3d-title">3D NEURAL FIELD</div>
  <div class="b3d-met">
    <span>ψ <b class="b3d-psi">0.000</b></span>
    <span>COHERENCE <b class="b3d-coh">0%</b></span>
  </div>
  <button class="b3d-close">&times;</button>
</div>
<div class="b3d-body">
  <canvas class="b3d-cv"></canvas>
  <div class="b3d-tog-wrap"></div>
  <div class="b3d-lbl-wrap"></div>
  <div class="b3d-notif-wrap"></div>
  <div class="b3d-expansion">EXPANSION: <b class="b3d-exp-val">1.00x</b></div>
  <div class="b3d-scale-display" style="position:absolute;top:55px;right:10px;font-size:10px;color:#ff4d9a;z-index:2;text-align:right;line-height:1.4;">
    <div style="font-size:14px;font-weight:700;" class="b3d-actual-count">—</div>
    <div style="font-size:9px;color:#555;">actual neurons</div>
    <div style="font-size:11px;color:#a855f7;" class="b3d-render-ratio">—</div>
  </div>
  <div class="b3d-log-wrap">
    <div class="b3d-log-title">PROCESS LOG</div>
    <div class="b3d-log"></div>
  </div>
  <div class="b3d-foot">
    <span>DRAG rotate · SCROLL zoom</span>
    <span class="b3d-scale-info">1000 neurons · 7 clusters</span>
  </div>
</div>`;

    host.appendChild(ov);
    this._overlay = ov;

    // Close
    ov.querySelector('.b3d-close').addEventListener('click', () => this.close());

    // Toggles
    const tw = ov.querySelector('.b3d-tog-wrap');
    CLUSTERS.forEach((cl, i) => {
      const b = document.createElement('button');
      b.className = 'b3d-tog';
      b.innerHTML = `<span class="b3d-dot" style="background:${cl.hex}"></span>${cl.label}`;
      b.addEventListener('click', () => {
        this._clusterOn[i] = !this._clusterOn[i];
        b.classList.toggle('off', !this._clusterOn[i]);
        this._syncVis();
      });
      tw.appendChild(b);
    });

    // Labels
    this._labelEls = [];
    const lw = ov.querySelector('.b3d-lbl-wrap');
    CLUSTERS.forEach(cl => {
      const el = document.createElement('div');
      el.className = 'b3d-lbl';
      el.textContent = cl.label;
      el.style.color = cl.hex;
      lw.appendChild(el);
      this._labelEls.push(el);
    });

    // Canvas ref
    this._canvas = ov.querySelector('.b3d-cv');
    this._bindInput();
  }

  _bindInput() {
    const cv = this._canvas;

    // Mouse
    cv.addEventListener('mousedown', e => {
      this._dragging = true;
      this._lastMouse = [e.clientX, e.clientY];
    });
    const up = () => { this._dragging = false; };
    window.addEventListener('mouseup', up);
    window.addEventListener('mousemove', e => {
      if (!this._dragging) return;
      this._rotY += (e.clientX - this._lastMouse[0]) * 0.005;
      this._rotX += (e.clientY - this._lastMouse[1]) * 0.005;
      this._rotX = Math.max(-Math.PI * 0.48, Math.min(Math.PI * 0.48, this._rotX));
      this._lastMouse = [e.clientX, e.clientY];
    });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      this._zoom += e.deltaY * 0.004;
      this._zoom = Math.max(1.5, Math.min(12, this._zoom));
    }, { passive: false });

    // Touch
    cv.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        this._dragging = true;
        this._lastMouse = [e.touches[0].clientX, e.touches[0].clientY];
      }
    }, { passive: true });
    window.addEventListener('touchend', up);
    window.addEventListener('touchmove', e => {
      if (!this._dragging || e.touches.length !== 1) return;
      this._rotY += (e.touches[0].clientX - this._lastMouse[0]) * 0.005;
      this._rotX += (e.touches[0].clientY - this._lastMouse[1]) * 0.005;
      this._rotX = Math.max(-Math.PI * 0.48, Math.min(Math.PI * 0.48, this._rotX));
      this._lastMouse = [e.touches[0].clientX, e.touches[0].clientY];
    }, { passive: true });

    // Context loss
    cv.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      this._stopLoop();
      console.warn('[Brain3D] context lost');
    });
    cv.addEventListener('webglcontextrestored', () => {
      console.log('[Brain3D] context restored');
      this._initGL();
      this._uploadStatic();
      if (this._open) this._startLoop();
    });
  }

  // ── WebGL ───────────────────────────────────────────────────────

  _initGL() {
    if (!this._canvas) return;
    const gl = this._canvas.getContext('webgl', {
      alpha: false, antialias: true, premultipliedAlpha: false, preserveDrawingBuffer: false,
    });
    if (!gl) { console.warn('[Brain3D] no WebGL'); return; }
    this._gl = gl;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clearColor(0.02, 0.02, 0.02, 1);

    this._neuronProg = this._mkProg(NEURON_VS, NEURON_FS);
    this._lineProg   = this._mkProg(LINE_VS, LINE_FS);
    this._pulseProg  = this._mkProg(PULSE_VS, PULSE_FS);

    // Neuron buffers
    this._bPos  = gl.createBuffer();
    this._bCol  = gl.createBuffer();
    this._bGlow = gl.createBuffer();
    this._bVis  = gl.createBuffer();

    // Line buffers
    this._bLnPos = gl.createBuffer();
    this._bLnCol = gl.createBuffer();

    // Pulse buffers
    this._bPPos  = gl.createBuffer();
    this._bPLife = gl.createBuffer();
    this._bPCol  = gl.createBuffer();
  }

  _mkProg(vSrc, fSrc) {
    const gl = this._gl;
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        console.error('[Brain3D] shader:', gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vSrc));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fSrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      console.error('[Brain3D] link:', gl.getProgramInfoLog(p));
    return p;
  }

  // ── Positions ───────────────────────────────────────────────────

  _genPositions() {
    this._pos = new Float32Array(TOTAL * 3);
    this._col = new Float32Array(TOTAL * 3);
    this._centers = [];

    let off = 0;
    CLUSTERS.forEach((cl, ci) => {
      const pts = POS_GEN[ci](cl.n);
      let cx = 0, cy = 0, cz = 0;
      for (let i = 0; i < cl.n; i++) {
        const j = (off + i) * 3;
        this._pos[j]   = pts[i][0];
        this._pos[j+1] = pts[i][1];
        this._pos[j+2] = pts[i][2];
        this._col[j]   = cl.rgb[0];
        this._col[j+1] = cl.rgb[1];
        this._col[j+2] = cl.rgb[2];
        cx += pts[i][0]; cy += pts[i][1]; cz += pts[i][2];
      }
      this._centers.push([cx/cl.n, cy/cl.n, cz/cl.n]);
      off += cl.n;
    });
  }

  _uploadStatic() {
    const gl = this._gl;
    if (!gl) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, this._bPos);
    gl.bufferData(gl.ARRAY_BUFFER, this._pos, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._bCol);
    gl.bufferData(gl.ARRAY_BUFFER, this._col, gl.STATIC_DRAW);
  }

  _syncVis() {
    let off = 0;
    CLUSTERS.forEach((cl, i) => {
      const v = this._clusterOn[i] ? 1 : 0;
      for (let j = 0; j < cl.n; j++) this._vis[off + j] = v;
      if (this._labelEls[i]) this._labelEls[i].style.opacity = v ? '0.65' : '0';
      off += cl.n;
    });
  }

  /**
   * Emoji from brain equations. One equation, full Unicode range.
   */
  _brainEmoji(arousal, valence, psi, coherence, isDreaming, reward) {
    // One continuous function: all 6 brain values → one code point
    // Unicode emoji block U+1F600-1F64F = 80 emoticon faces
    // The brain's combined state IS the index. No branches, no ifs, no mapping.
    const v = (valence + 1) / 2;                          // 0-1
    const combined = v * 0.35 + arousal * 0.25 + coherence * 0.15 + psi * 0.1 + Math.abs(reward) * 0.1 + (isDreaming ? 0.05 : 0);
    const codePoint = 0x1F600 + Math.floor(combined * 79);
    return String.fromCodePoint(codePoint);
  }

  _clusterOf(idx) {
    let off = 0;
    for (let i = 0; i < CLUSTERS.length; i++) {
      if (idx < off + CLUSTERS[i].n) return i;
      off += CLUSTERS[i].n;
    }
    return 0;
  }

  // ── Brain Expansion ─────────────────────────────────────────────

  _applyExpansion() {
    if (!this._basePos) {
      this._basePos = new Float32Array(this._pos);
    }
    const f = this._expansionFactor;
    for (let i = 0; i < TOTAL * 3; i++) {
      this._pos[i] = this._basePos[i] * f;
    }
    // Update centers
    let off = 0;
    CLUSTERS.forEach((cl, ci) => {
      let cx = 0, cy = 0, cz = 0;
      for (let i = 0; i < cl.n; i++) {
        const j = (off + i) * 3;
        cx += this._pos[j]; cy += this._pos[j+1]; cz += this._pos[j+2];
      }
      this._centers[ci] = [cx/cl.n, cy/cl.n, cz/cl.n];
      off += cl.n;
    });
    // Re-upload positions
    if (this._gl && this._bPos) {
      this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._bPos);
      this._gl.bufferData(this._gl.ARRAY_BUFFER, this._pos, this._gl.STATIC_DRAW);
    }
  }

  // ── Process Notifications ──────────────────────────────────────

  /**
   * Generate ONE rich process notification every ~5 seconds.
   * Translates actual neural signals into human-readable brain activity.
   * Cycles through different brain systems, showing real computed values.
   */
  _generateProcessNotification(state) {
    if (!state) return;
    const clusters = state.clusters || {};
    const arousal = state.amygdala?.arousal ?? 0;
    const valence = state.amygdala?.valence ?? 0;
    const psi = state.psi ?? 0;
    const coherence = state.oscillations?.coherence ?? 0;
    const mood = state.innerVoice?.mood || 'neutral';
    const isDreaming = state.isDreaming || false;

    // Slideshow of combined neural activity — unique every time, never repeating
    // Each notification is a snapshot of what's ACTUALLY happening right now
    if (!this._notifIndex) this._notifIndex = 0;
    if (!this._shownTexts) this._shownTexts = new Set();

    const gate = (0.7 + arousal * 0.6);
    const bp = state.oscillations?.bandPower || {};
    const motor = state.motor || {};
    const mem = state.memory || {};
    const iv = state.innerVoice || {};
    const reward = state.reward ?? 0;

    // Pool of generators — each creates a unique message from live values
    // Emoji from equations — Unity picks from the full Unicode catalog
    // Brain values hash into emoji code point ranges, no list
    const emoji = this._brainEmoji(arousal, valence, psi, coherence, isDreaming, reward);

    const generators = [
      // Cluster snapshots — rotate through clusters
      () => {
        const ci = this._notifIndex % CLUSTERS.length;
        const c = clusters[CLUSTERS[ci].key];
        if (!c) return null;
        const pct = (c.spikeCount / (c.size || 1) * 100).toFixed(0);
        const rate = c.firingRate?.toFixed?.(1) ?? pct;
        return { text: `${CLUSTERS[ci].label} ${c.spikeCount}/${c.size} (${pct}%) rate=${rate}`, cluster: ci };
      },
      // Combined state reads
      () => ({ text: `${emoji} Ψ=${psi.toFixed(4)} gate=${gate.toFixed(2)}x coherence=${(coherence*100).toFixed(0)}%`, cluster: 6 }),
      () => ({ text: `${emoji} a=${(arousal*100).toFixed(0)}% v=${valence.toFixed(3)}`, cluster: 2 }),
      () => ({ text: `${emoji} θ=${(bp.theta??0).toFixed(1)} α=${(bp.alpha??0).toFixed(1)} β=${(bp.beta??0).toFixed(1)} γ=${(bp.gamma??0).toFixed(1)}`, cluster: 0 }),
      () => ({ text: `${emoji} motor: ${motor.selectedAction || 'idle'} conf=${((motor.confidence||0)*100).toFixed(0)}%`, cluster: 3 }),
      () => iv.sentence ? { text: `${emoji} "${iv.sentence.slice(0, 60)}"`, cluster: 6 } : null,
      () => mem.lastRecall ? { text: `${emoji} recall: "${mem.lastRecall.trigger}"`, cluster: 1 } : null,
      () => isDreaming ? { text: `${emoji} dreaming`, cluster: 1 } : null,
      () => Math.abs(reward) > 0.03 ? { text: `${emoji} δ=${reward.toFixed(3)}`, cluster: 3 } : null,
      () => ({ text: `${emoji} ${(state.totalNeurons||1000).toLocaleString()} neurons`, cluster: 0 }),
    ];

    // Cycle through generators, skip nulls and recently shown
    let pick = null;
    for (let tries = 0; tries < generators.length; tries++) {
      this._notifIndex = (this._notifIndex + 1) % generators.length;
      const result = generators[this._notifIndex]();
      if (result && !this._shownTexts.has(result.text)) {
        pick = result;
        this._shownTexts.add(result.text);
        // Keep shown set from growing forever
        if (this._shownTexts.size > 30) this._shownTexts.clear();
        break;
      }
    }
    if (!pick) {
      // All were shown recently — clear and grab any
      this._shownTexts.clear();
      pick = generators[0]();
    }
    if (pick) {
      this._lastNotifCluster = pick.cluster;
      this._addNotification(pick.text, pick.cluster);
    }
  }

  _addNotification(text, clusterIdx) {
    const wrap = this._overlay?.querySelector('.b3d-notif-wrap');
    if (!wrap) return;

    const center = this._centers[clusterIdx] || [0, 0, 0];
    const el = document.createElement('div');
    el.className = 'b3d-notif';
    el.style.color = CLUSTERS[clusterIdx]?.hex || '#fff';
    el.textContent = text;
    wrap.appendChild(el);

    const notif = { el, x: center[0], y: center[1], z: center[2], age: 0, maxAge: 300, clusterIdx };
    this._notifications.push(notif);

    // Add to log
    this._addToLog(text, CLUSTERS[clusterIdx]?.hex || '#fff');

    // Limit active notifications — only 3 at a time (one every 5 sec)
    while (this._notifications.length > 3) {
      const old = this._notifications.shift();
      old.el.remove();
    }
  }

  _updateNotifications(mvp, canvas) {
    for (let i = this._notifications.length - 1; i >= 0; i--) {
      const n = this._notifications[i];
      n.age++;

      // Project 3D cluster center to screen — notification appears AT the cluster
      const floatOffset = n.age * 0.003; // slow float upward
      const screen = this._project3Dto2D(n.x, n.y + 0.3 + floatOffset, n.z, mvp, canvas);
      if (screen) {
        n.el.style.left = screen.x + 'px';
        n.el.style.top = screen.y + 'px';
      }

      // Fade: quick appear, hold, then fade out in last 30%
      const life = n.age / n.maxAge;
      const opacity = life < 0.1 ? life * 10 : life > 0.7 ? (1 - life) / 0.3 : 1;
      n.el.style.opacity = Math.max(0, opacity);

      // Remove when dead
      if (n.age >= n.maxAge) {
        n.el.remove();
        this._notifications.splice(i, 1);
      }
    }
  }

  _project3Dto2D(x, y, z, mvp, canvas) {
    // Multiply by MVP
    const w = mvp[3]*x + mvp[7]*y + mvp[11]*z + mvp[15];
    if (w <= 0) return null;
    const nx = (mvp[0]*x + mvp[4]*y + mvp[8]*z + mvp[12]) / w;
    const ny = (mvp[1]*x + mvp[5]*y + mvp[9]*z + mvp[13]) / w;
    // NDC to screen
    return {
      x: (nx * 0.5 + 0.5) * canvas.clientWidth,
      y: (1 - (ny * 0.5 + 0.5)) * canvas.clientHeight,
    };
  }

  _addToLog(text, color) {
    const log = this._overlay?.querySelector('.b3d-log');
    if (!log) return;
    const entry = document.createElement('div');
    entry.className = 'b3d-log-entry';
    entry.style.color = color;
    const time = ((this._lastState?.time ?? 0)).toFixed(1);
    entry.textContent = `[${time}s] ${text}`;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
    // Keep log under 100 entries
    while (log.children.length > 100) log.children[0].remove();
  }

  // ── Connections ─────────────────────────────────────────────────

  _buildConns(spk) {
    // Collect active neurons PER CLUSTER — ensures all clusters participate
    const perCluster = [];
    let off = 0;
    for (let c = 0; c < CLUSTERS.length; c++) {
      const clusterActive = [];
      if (this._clusterOn[c]) {
        for (let i = 0; i < CLUSTERS[c].n; i++) {
          if (spk[off + i]) clusterActive.push(off + i);
        }
      }
      perCluster.push(clusterActive);
      off += CLUSTERS[c].n;
    }

    this._connN = 0;

    // INTER-CLUSTER connections — between different clusters (projections)
    // Ensure EVERY cluster pair with active neurons gets connections
    for (let ca = 0; ca < CLUSTERS.length && this._connN < MAX_CONN * 0.7; ca++) {
      if (perCluster[ca].length === 0) continue;
      for (let cb = ca + 1; cb < CLUSTERS.length && this._connN < MAX_CONN * 0.7; cb++) {
        if (perCluster[cb].length === 0) continue;
        // Draw 2-4 connections per cluster pair
        const count = Math.min(4, perCluster[ca].length, perCluster[cb].length);
        for (let k = 0; k < count && this._connN < MAX_CONN; k++) {
          const ai = perCluster[ca][Math.floor(Math.random() * perCluster[ca].length)];
          const bi = perCluster[cb][Math.floor(Math.random() * perCluster[cb].length)];
          this._addConn(ai, bi, CLUSTERS[ca].rgb, CLUSTERS[cb].rgb);
        }
      }
    }

    // INTRA-CLUSTER connections — within same cluster (synapses)
    for (let c = 0; c < CLUSTERS.length && this._connN < MAX_CONN; c++) {
      if (perCluster[c].length < 2) continue;
      const count = Math.min(3, perCluster[c].length - 1);
      for (let k = 0; k < count && this._connN < MAX_CONN; k++) {
        const ai = perCluster[c][Math.floor(Math.random() * perCluster[c].length)];
        const bi = perCluster[c][Math.floor(Math.random() * perCluster[c].length)];
        if (ai !== bi) this._addConn(ai, bi, CLUSTERS[c].rgb, CLUSTERS[c].rgb);
      }
    }
  }

  _addConn(ai, bi, colorA, colorB) {
    const vi = this._connN * 6;
    const ci = this._connN * 8;
    this._connPos[vi]   = this._pos[ai*3];
    this._connPos[vi+1] = this._pos[ai*3+1];
    this._connPos[vi+2] = this._pos[ai*3+2];
    this._connPos[vi+3] = this._pos[bi*3];
    this._connPos[vi+4] = this._pos[bi*3+1];
    this._connPos[vi+5] = this._pos[bi*3+2];
    this._connCol[ci]   = colorA[0]; this._connCol[ci+1] = colorA[1]; this._connCol[ci+2] = colorA[2]; this._connCol[ci+3] = 0.15;
    this._connCol[ci+4] = colorB[0]; this._connCol[ci+5] = colorB[1]; this._connCol[ci+6] = colorB[2]; this._connCol[ci+7] = 0.15;
    this._connN++;
  }

  // ── Render loop ─────────────────────────────────────────────────

  _startLoop() {
    if (this._animId) return;
    const tick = () => {
      if (!this._open || this._destroyed) { this._animId = null; return; }
      this._frame();
      this._animId = requestAnimationFrame(tick);
    };
    this._animId = requestAnimationFrame(tick);
  }

  _stopLoop() {
    if (this._animId) { cancelAnimationFrame(this._animId); this._animId = null; }
  }

  _frame() {
    const gl = this._gl;
    if (!gl || gl.isContextLost()) return;

    // Resize
    const cv = this._canvas;
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth * dpr | 0;
    const h = cv.clientHeight * dpr | 0;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // MVP
    const proj = m4Persp(Math.PI / 4, w / h, 0.1, 100);
    let view = m4Ident();
    view = m4Trans(view, 0, 0, -this._zoom);
    view = m4RotX(view, this._rotX);
    view = m4RotY(view, this._rotY);
    const mvp = m4Mul(proj, view);

    if (!this._dragging) this._rotY += AUTO_ROT_SPEED;

    const sc = Math.min(w, h) / 480;

    // 1) Lines
    this._drawLines(gl, mvp);
    // 2) Neurons
    this._drawNeurons(gl, mvp, sc);
    // 3) Pulses
    this._drawPulses(gl, mvp, sc);
    // 4) Labels
    this._projectLabels(mvp, cv);
    // 5) Notifications — float up and fade
    this._updateNotifications(mvp, cv);
    // 6) Expansion display
    const expEl = this._overlay?.querySelector('.b3d-exp-val');
    if (expEl) expEl.textContent = this._expansionFactor.toFixed(2) + 'x';
  }

  _drawNeurons(gl, mvp, sc) {
    const p = this._neuronProg;
    gl.useProgram(p);
    gl.uniformMatrix4fv(gl.getUniformLocation(p, 'uMVP'), false, mvp);
    gl.uniform1f(gl.getUniformLocation(p, 'uScale'), sc);

    this._bindAttr(gl, p, 'aPos',  this._bPos,  3, false);
    this._bindAttr(gl, p, 'aCol',  this._bCol,  3, false);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._bGlow);
    gl.bufferData(gl.ARRAY_BUFFER, this._glow, gl.DYNAMIC_DRAW);
    const gL = gl.getAttribLocation(p, 'aGlow');
    gl.enableVertexAttribArray(gL);
    gl.vertexAttribPointer(gL, 1, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._bVis);
    gl.bufferData(gl.ARRAY_BUFFER, this._vis, gl.DYNAMIC_DRAW);
    const vL = gl.getAttribLocation(p, 'aVis');
    gl.enableVertexAttribArray(vL);
    gl.vertexAttribPointer(vL, 1, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.POINTS, 0, TOTAL);
  }

  _drawLines(gl, mvp) {
    if (!this._connN) return;
    const p = this._lineProg;
    gl.useProgram(p);
    gl.uniformMatrix4fv(gl.getUniformLocation(p, 'uMVP'), false, mvp);
    gl.depthMask(false);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._bLnPos);
    gl.bufferData(gl.ARRAY_BUFFER, this._connPos.subarray(0, this._connN * 6), gl.DYNAMIC_DRAW);
    const posL = gl.getAttribLocation(p, 'aPos');
    gl.enableVertexAttribArray(posL);
    gl.vertexAttribPointer(posL, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._bLnCol);
    gl.bufferData(gl.ARRAY_BUFFER, this._connCol.subarray(0, this._connN * 8), gl.DYNAMIC_DRAW);
    const colL = gl.getAttribLocation(p, 'aCol');
    gl.enableVertexAttribArray(colL);
    gl.vertexAttribPointer(colL, 4, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.LINES, 0, this._connN * 2);
    gl.depthMask(true);
  }

  _drawPulses(gl, mvp, sc) {
    // Age + cull
    for (let i = this._pulses.length - 1; i >= 0; i--) {
      if (++this._pulses[i].age > PULSE_LIFE) this._pulses.splice(i, 1);
    }
    const n = this._pulses.length;
    if (!n) return;

    const posA = new Float32Array(n * 3);
    const lifeA = new Float32Array(n);
    const colA = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const p = this._pulses[i];
      posA[i*3] = p.x; posA[i*3+1] = p.y; posA[i*3+2] = p.z;
      lifeA[i] = 1 - p.age / PULSE_LIFE;
      colA[i*3] = p.col[0]; colA[i*3+1] = p.col[1]; colA[i*3+2] = p.col[2];
    }

    const pr = this._pulseProg;
    gl.useProgram(pr);
    gl.uniformMatrix4fv(gl.getUniformLocation(pr, 'uMVP'), false, mvp);
    gl.uniform1f(gl.getUniformLocation(pr, 'uScale'), sc * 2.5);
    gl.depthMask(false);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._bPPos);
    gl.bufferData(gl.ARRAY_BUFFER, posA, gl.DYNAMIC_DRAW);
    const posL = gl.getAttribLocation(pr, 'aPos');
    gl.enableVertexAttribArray(posL);
    gl.vertexAttribPointer(posL, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._bPLife);
    gl.bufferData(gl.ARRAY_BUFFER, lifeA, gl.DYNAMIC_DRAW);
    const lL = gl.getAttribLocation(pr, 'aLife');
    gl.enableVertexAttribArray(lL);
    gl.vertexAttribPointer(lL, 1, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._bPCol);
    gl.bufferData(gl.ARRAY_BUFFER, colA, gl.DYNAMIC_DRAW);
    const cL = gl.getAttribLocation(pr, 'aCol');
    gl.enableVertexAttribArray(cL);
    gl.vertexAttribPointer(cL, 3, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.POINTS, 0, n);
    gl.depthMask(true);
  }

  _bindAttr(gl, prog, name, buf, size, dynamic) {
    const loc = gl.getAttribLocation(prog, name);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  }

  _projectLabels(mvp, cv) {
    const rect = cv.getBoundingClientRect();
    for (let i = 0; i < CLUSTERS.length; i++) {
      const el = this._labelEls[i];
      if (!this._clusterOn[i]) { el.style.opacity = '0'; continue; }
      const c = this._centers[i];
      const clip = m4Project(mvp, [c[0], c[1], c[2], 1]);
      if (clip[3] <= 0) { el.style.opacity = '0'; continue; }
      const sx = (clip[0] / clip[3] * 0.5 + 0.5) * rect.width;
      const sy = (1 - (clip[1] / clip[3] * 0.5 + 0.5)) * rect.height;
      if (sx < 30 || sx > rect.width - 30 || sy < 20 || sy > rect.height - 20) {
        el.style.opacity = '0';
      } else {
        el.style.left = sx + 'px';
        el.style.top = sy + 'px';
        el.style.opacity = '0.65';
      }
    }
  }
}
