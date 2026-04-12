/**
 * brain-3d.js — WebGL 3D brain visualizer
 *
 * 3.2M neurons (20K rendered) as gl.POINTS in MNI-coordinate 3D clusters.
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
const MAX_PULSES = 200; // enough for all 7 clusters to have visible pulses
const MAX_CONN = 1200;
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
  float sz = mix(4.0, 10.0, aGlow);
  gl_PointSize = max(2.0, sz * uScale / max(p.w, 0.3));
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
  float bright = mix(0.25, 1.0, vGlow);
  float alpha = edge * mix(0.5, 1.0, vGlow);
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
// MNI-coordinate-based positions scaled to render space.
// Real brain: X = lateral (±90mm), Y = anterior-posterior (±126mm), Z = superior-inferior (±72mm)
// Render space: normalized to ~±2 units. Scale factor: 1 unit ≈ 45mm.
//
// Sources: Lead-DBS atlas, ICBM 152, Herculano-Houzel 2009, PMC stereological studies
// Each returns an array of [x,y,z] for every neuron in that cluster.

function genCortex(n) {
  // CEREBRAL CORTEX — bilateral hemispheres, outer shell of the brain
  // MNI: surface spans ±90mm lateral, -126 to +90mm A-P, -72 to +72mm S-I
  // 16 billion neurons. Two hemispheres separated by longitudinal fissure.
  // Folded surface (gyri/sulci) — use hemisphere shell with sulcal variation
  const pts = [];
  const half = Math.floor(n / 2);
  for (let i = 0; i < n; i++) {
    const side = i < half ? -1 : 1;
    // Hemisphere shell — upper dome with folding noise
    const theta = Math.acos(1 - Math.random() * 1.3);
    const phi = Math.random() * Math.PI * 2;
    const r = 1.1 + gauss() * 0.1; // cortical thickness variation — tighter shell
    const x = r * Math.sin(theta) * Math.cos(phi);
    const sulcalFold = Math.sin(phi * 5) * 0.03 + Math.sin(theta * 7) * 0.02; // gyri/sulci texture
    pts.push([
      side * (Math.abs(x) * 0.45 + 0.12),           // hemispheric split at midline
      r * Math.cos(theta) * 0.55 + 0.35 + sulcalFold, // dorsal dome
      r * Math.sin(theta) * Math.sin(phi) * 0.75,     // anterior-posterior spread
    ]);
  }
  return pts;
}

function genHippocampus(n) {
  // HIPPOCAMPUS — medial temporal lobe, POSTERIOR to amygdala
  // MNI: approximately (-20, -26, -10) to (-30, -10, -20) bilateral
  // Curved seahorse shape (CA1-CA4 + dentate gyrus). 90% pyramidal cells.
  // Each pyramidal cell receives ~30,000 excitatory inputs (most connected structure)
  const pts = [];
  const half = Math.floor(n / 2);
  for (let i = 0; i < n; i++) {
    const side = i < half ? -1 : 1;
    // Seahorse curve — C-shaped along anterior-posterior axis
    const t = ((i % half) / half) * Math.PI * 1.8;
    const r = 0.1 + Math.random() * 0.07;
    pts.push([
      side * (0.3 + Math.cos(t) * 0.12) + gauss() * r * 0.2,   // medial temporal
      -0.2 + Math.sin(t * 0.5) * 0.15 + gauss() * r * 0.2,     // below cortex center
      -0.1 + Math.sin(t) * 0.22 + gauss() * r * 0.25,           // POSTERIOR — behind amygdala
    ]);
  }
  return pts;
}

function genAmygdala(n) {
  // AMYGDALA — medial temporal lobe, ANTERIOR to hippocampus
  // MNI: (-27, -4, -20) bilateral. Almond-shaped. 12.21 million neurons.
  // 13 nuclei: lateral (4M), basal (3.24M), accessory basal (1.28M), central (0.36M)
  // Major outputs: stria terminalis, ventral amygdalofugal pathway
  const pts = [];
  const half = Math.floor(n / 2);
  for (let i = 0; i < n; i++) {
    const side = i < half ? -1 : 1;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    // Almond shape — elongated along one axis
    const r = 0.12 * Math.cbrt(Math.random());
    pts.push([
      side * 0.38 + r * 0.4 * Math.sin(phi) * Math.cos(theta),  // medial temporal
      -0.3 + r * 0.3 * Math.cos(phi),                             // inferior to BG
      0.4 + r * 0.35 * Math.sin(phi) * Math.sin(theta),           // ANTERIOR — in front of hippo
    ]);
  }
  return pts;
}

function genBasalGanglia(n) {
  // BASAL GANGLIA — deep nuclei BILATERAL (caudate + putamen + globus pallidus)
  // MNI: caudate head ~(±12, 12, 10), putamen ~(±28, 4, 2), GP ~(±18, 0, 0)
  // 90-95% medium spiny projection neurons (GABAergic)
  // Receives STRONGEST projection in brain (corticostriatal)
  const pts = [];
  const half = Math.floor(n / 2);
  for (let i = 0; i < n; i++) {
    const side = i < half ? -1 : 1;
    // Three nuclei merged: caudate (elongated), putamen (lateral), GP (medial)
    const subtype = Math.random();
    let x, y, z;
    if (subtype < 0.4) {
      // Caudate — C-shaped, dorsomedial
      const t = Math.random() * Math.PI;
      x = side * (0.15 + Math.cos(t) * 0.06) + gauss() * 0.03;
      y = 0.03 + Math.sin(t) * 0.12 + gauss() * 0.03;
      z = 0.1 + t * 0.08 + gauss() * 0.03;
    } else if (subtype < 0.75) {
      // Putamen — lateral lens-shaped
      const r = 0.1 * Math.cbrt(Math.random());
      const theta = Math.random() * Math.PI * 2;
      x = side * (0.38 + r * Math.cos(theta) * 0.4) + gauss() * 0.02;
      y = -0.04 + r * Math.sin(theta) * 0.3 + gauss() * 0.02;
      z = 0.08 + gauss() * 0.06;
    } else {
      // Globus pallidus — medial, compact
      const r = 0.07 * Math.cbrt(Math.random());
      const theta = Math.random() * Math.PI * 2;
      x = side * 0.22 + r * Math.cos(theta) * 0.25 + gauss() * 0.02;
      y = -0.04 + r * Math.sin(theta) * 0.25 + gauss() * 0.02;
      z = 0.04 + gauss() * 0.04;
    }
    pts.push([x, y, z]);
  }
  return pts;
}

function genCerebellum(n) {
  // CEREBELLUM — posterior-inferior, behind and below cortex
  // ~69 billion neurons (80% of brain), 50B granule cells
  // MNI: center ~(0, -60, -35). Bilateral with vermis at midline.
  // Folia (leaf-like folds) create layered parallel structure
  const pts = [];
  const half = Math.floor(n / 2);
  for (let i = 0; i < n; i++) {
    const side = i < half ? -1 : 1;
    // Foliated structure — layered sheets with slight separation
    const layer = Math.floor(Math.random() * 5); // 5 folia layers
    const layerOffset = layer * 0.06;
    const r = 0.2 + Math.random() * 0.35;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    // Folia texture — wavy layers
    const foliaWave = Math.sin(theta * 4 + layer) * 0.02;
    pts.push([
      side * (0.12 + Math.abs(r * Math.sin(phi) * Math.cos(theta)) * 0.55), // bilateral spread
      -0.5 - Math.abs(r * Math.cos(phi)) * 0.4 + foliaWave,                 // inferior to cortex
      -0.3 - layerOffset - Math.abs(r * Math.sin(phi) * Math.sin(theta)) * 0.28, // POSTERIOR
    ]);
  }
  return pts;
}

function genHypothalamus(n) {
  // HYPOTHALAMUS — ventral diencephalon, midline, above pituitary
  // MNI: approximately (0, -2, -12). 11 nuclei. ~few million neurons.
  // BELOW basal ganglia, ABOVE brainstem. Small but critical.
  // Controls homeostasis, hormones, autonomic nervous system.
  const pts = [];
  for (let i = 0; i < n; i++) {
    const r = 0.08 * Math.cbrt(Math.random());
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    pts.push([
      r * Math.sin(phi) * Math.cos(theta) * 0.5 + gauss() * 0.02,  // tight to midline
      -0.38 + r * Math.cos(phi) * 0.25,                              // below BG, above cerebellum
      0.18 + r * Math.sin(phi) * Math.sin(theta) * 0.25,             // slightly anterior
    ]);
  }
  return pts;
}

function genMystery(n) {
  // Ψ CONSCIOUSNESS — mapped to corpus callosum + cingulate
  // Corpus callosum: midline, ~(0, 0, 15), largest white matter tract
  // 200-300 million axons connecting hemispheres
  // Plus cingulate cortex above (seat of self-awareness, error monitoring)
  const pts = [];
  const callosum = Math.floor(n * 0.6);  // 60% corpus callosum fibers
  const cingulate = n - callosum;          // 40% cingulate crown

  // Corpus callosum — flat arched band connecting hemispheres at midline
  // Shaped like a flattened C: genu (front), body (middle), splenium (back)
  for (let i = 0; i < callosum; i++) {
    const t = (i / callosum) * Math.PI; // front to back arc
    const genuToSplenium = -0.2 + t * 0.45; // Z sweep from anterior to posterior
    pts.push([
      gauss() * 0.03,                                    // tight to midline (x≈0)
      0.2 + Math.sin(t) * 0.22 + gauss() * 0.02,        // arched above BG
      genuToSplenium + gauss() * 0.03,                   // anterior → posterior sweep
    ]);
  }

  // Cingulate cortex — curved band above corpus callosum
  // Anterior cingulate (ACC) for error monitoring, posterior for self-reference
  for (let i = 0; i < cingulate; i++) {
    const t = (i / cingulate) * Math.PI;
    const r = 0.1 * Math.cbrt(Math.random());
    pts.push([
      gauss() * 0.05,                                    // near midline
      0.45 + Math.sin(t) * 0.25 + r * Math.random() * 0.08, // above callosum
      -0.15 + t * 0.28 + gauss() * 0.04,                // anterior → posterior
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
    this._zoom = 3.5;
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
        // Map each CLUSTERS entry to its proportional share of TOTAL
        for (const cl of CLUSTERS) {
          const serverCluster = serverClusters[cl.key];
          if (serverCluster && serverCluster.size) {
            cl.n = Math.max(10, Math.round((serverCluster.size / serverTotal) * TOTAL));
          }
        }
        // Adjust to exactly TOTAL
        const renderSum = CLUSTERS.reduce((s, c) => s + c.n, 0);
        if (renderSum !== TOTAL) CLUSTERS[0].n += (TOTAL - renderSum);
        console.log(`[Brain3D] Scaled: ${CLUSTERS.map(c => `${c.key}=${c.n}`).join(', ')} = ${TOTAL}`);
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

    // Glow update + pulses distributed EQUALLY across ALL clusters
    const pulsesPerCluster = Math.floor(MAX_PULSES / CLUSTERS.length);
    const clusterPulseCount = new Array(CLUSTERS.length).fill(0);

    // Count spikes per cluster FIRST — needed for adaptive pulse probability
    let off = 0;
    const clusterSpikeCount = new Array(CLUSTERS.length).fill(0);
    for (let ci = 0; ci < CLUSTERS.length; ci++) {
      const cn = CLUSTERS[ci].n;
      for (let j = 0; j < cn; j++) {
        const i = off + j;
        if (i < TOTAL && spk[i]) clusterSpikeCount[ci]++;
      }
      off += cn;
    }

    off = 0;
    for (let ci = 0; ci < CLUSTERS.length; ci++) {
      const cn = CLUSTERS[ci].n;
      // Adaptive pulse probability — fewer spikes = higher chance per spike
      // Every cluster gets roughly the same NUMBER of pulses regardless of spike rate
      // target ~4 pulses per cluster per frame, probability = target / spikeCount
      const spikeN = clusterSpikeCount[ci] || 1;
      const pulseProb = Math.min(0.6, Math.max(0.05, 4 / spikeN));

      for (let j = 0; j < cn; j++) {
        const i = off + j;
        if (i >= TOTAL) break;
        if (spk[i]) {
          this._glow[i] = 1.0;
          // Each cluster gets its OWN pulse budget with ADAPTIVE probability
          if (clusterPulseCount[ci] < pulsesPerCluster && this._pulses.length < MAX_PULSES && Math.random() < pulseProb) {
            clusterPulseCount[ci]++;
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
      off += cn;
    }

    this._buildConnsFromEquations(state.clusters || {});

    // ── BRAIN EXPANSION — clusters spread with activity ──
    // Clamp spike ratio so expansion stays sane (max 15% growth)
    const totalSpikes = state.spikeCount || 0;
    const spikeRatio = Math.min(1, totalSpikes / Math.max(TOTAL, state.totalNeurons || TOTAL));
    const targetExpansion = 1.0 + spikeRatio * 0.15; // 0-15% growth max
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
      this._zoom += e.deltaY * 0.005;
      this._zoom = Math.max(1.0, Math.min(20, this._zoom));
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
    // Full Unicode emoji range — brain equations select from ALL emoji
    // Multiple blocks spanning faces, nature, objects, symbols, activities
    // Each brain value shifts into a different Unicode region
    //
    // Unicode emoji blocks:
    //   0x1F600-0x1F64F  Emoticons (faces)         80
    //   0x1F300-0x1F3FF  Misc symbols (weather/nature) 256
    //   0x1F400-0x1F4FF  Animals + objects         256
    //   0x1F500-0x1F5FF  Symbols + UI              256
    //   0x1F680-0x1F6FF  Transport + maps          128
    //   0x1F900-0x1F9FF  Supplemental (gestures/faces) 256
    //   0x2600-0x26FF    Misc symbols              256
    //   0x2700-0x27BF    Dingbats                  192
    //   Total: ~1680 emoji accessible
    //
    // Brain state → which block + position within block

    // Block selection from dominant brain signal
    const v = (valence + 1) / 2; // 0-1
    const blockSignal = (v * 0.3 + coherence * 0.3 + arousal * 0.2 + (isDreaming ? 0.15 : 0) + Math.abs(reward) * 0.05);

    // 8 blocks, blockSignal selects which one
    const blocks = [
      [0x1F600, 80],   // faces
      [0x1F300, 256],   // nature/weather
      [0x1F400, 256],   // animals/objects
      [0x1F500, 256],   // symbols
      [0x1F680, 128],   // transport
      [0x1F900, 256],   // supplemental faces/gestures
      [0x2600, 256],    // misc symbols
      [0x2700, 192],    // dingbats
    ];
    const blockIdx = Math.floor(blockSignal * blocks.length) % blocks.length;
    const [base, range] = blocks[blockIdx];

    // Position within block from remaining brain values
    const posSignal = arousal * 0.3 + v * 0.25 + psi * 0.2 + Math.abs(reward) * 0.15 + coherence * 0.1;
    const pos = Math.floor(posSignal * (range - 1)) % range;

    try {
      return String.fromCodePoint(base + pos);
    } catch {
      return String.fromCodePoint(0x1F600); // fallback
    }
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

    // Each notification gets its OWN context-specific emoji from brain values
    const e = (a, v, p, c, d, r) => this._brainEmoji(a, v, p, c, d, r);

    const generators = [
      // Cluster snapshots — each cluster's OWN emoji from its activity
      () => {
        const ci = this._notifIndex % CLUSTERS.length;
        const c = clusters[CLUSTERS[ci].key];
        if (!c) return null;
        const rate = (c.spikeCount || 0) / (c.size || 1);
        const clusterEmoji = e(rate * 10, valence, psi, coherence, isDreaming, reward);
        return { text: `${clusterEmoji} ${CLUSTERS[ci].label} ${(rate*100).toFixed(1)}%`, cluster: ci };
      },
      // Consciousness — emoji from Ψ specifically
      () => ({ text: `${e(arousal, valence, psi * 100, coherence, false, 0)} Ψ=${psi.toFixed(4)} gate=${gate.toFixed(2)}x`, cluster: 6 }),
      // Emotion — emoji from arousal+valence
      () => ({ text: `${e(arousal, valence, 0, 0, false, 0)} a=${(arousal*100).toFixed(0)}% v=${valence.toFixed(3)}`, cluster: 2 }),
      // Oscillations — emoji from coherence
      () => ({ text: `${e(0.5, 0.5, 0, coherence, false, 0)} θ=${(bp.theta??0).toFixed(1)} α=${(bp.alpha??0).toFixed(1)} β=${(bp.beta??0).toFixed(1)} γ=${(bp.gamma??0).toFixed(1)}`, cluster: 0 }),
      // Motor — emoji from motor confidence
      () => ({ text: `${e(arousal, 0.3, 0, 0, false, motor.confidence||0)} motor: ${motor.selectedAction || 'idle'}`, cluster: 3 }),
      // Inner voice — emoji from speech content
      () => iv.sentence ? { text: `${e(0.7, 0.5, psi, coherence, false, 0)} "${iv.sentence.slice(0, 50)}"`, cluster: 6 } : null,
      // Memory — emoji from recall
      () => mem.lastRecall ? { text: `${e(0.5, 0.2, 0, 0.8, false, 0.5)} recall: "${mem.lastRecall.trigger}"`, cluster: 1 } : null,
      // Dreaming — emoji from dream state
      () => isDreaming ? { text: `${e(0.2, 0, 0, 0.3, true, 0)} dreaming`, cluster: 1 } : null,
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

  /**
   * Build connections from ACTUAL equation outputs — server-reported cluster activity.
   * Not from the synthesized spike array. From the real spikeCount per cluster.
   */
  _buildConnsFromEquations(serverClusters) {
    this._connN = 0;

    // ── CLUSTER INDEX MAP ──
    // key → index for fast lookup
    const keyToIdx = {};
    CLUSTERS.forEach((cl, i) => { keyToIdx[cl.key] = i; });

    // ── CLUSTER ACTIVITY + OFFSETS ──
    const act = [];
    let off = 0;
    for (let c = 0; c < CLUSTERS.length; c++) {
      const sc = serverClusters[CLUSTERS[c].key];
      const rate = sc ? (sc.spikeCount || 0) / (sc.size || 1) : 0;
      act.push({ rate, offset: off, n: CLUSTERS[c].n });
      off += CLUSTERS[c].n;
    }

    // ── THE 20 PROJECTION PATHWAYS ──
    // Mirrors engine.js projections exactly — real white matter tracts
    // Each entry: [sourceClusterIdx, targetClusterIdx, density, strength]
    // Densities from neuroscience: corticostriatal STRONGEST (10× others)
    // Sources: Herculano-Houzel 2009, PMC white matter taxonomy, Lead-DBS
    const PROJECTIONS = [
      // Cortical output (4)
      [keyToIdx.cortex, keyToIdx.hippocampus, 0.04, 0.4],      // Perforant path
      [keyToIdx.cortex, keyToIdx.amygdala, 0.03, 0.3],         // Ventral visual stream
      [keyToIdx.cortex, keyToIdx.basalGanglia, 0.08, 0.5],     // Corticostriatal — STRONGEST
      [keyToIdx.cortex, keyToIdx.cerebellum, 0.05, 0.3],       // Corticopontocerebellar
      // Hippocampal output (3)
      [keyToIdx.hippocampus, keyToIdx.cortex, 0.04, 0.4],      // Memory consolidation
      [keyToIdx.hippocampus, keyToIdx.amygdala, 0.03, 0.3],    // Recall → emotion
      [keyToIdx.hippocampus, keyToIdx.hypothalamus, 0.03, 0.3], // Fimbria-fornix
      // Amygdala output (4)
      [keyToIdx.amygdala, keyToIdx.cortex, 0.03, 0.3],         // Emotional modulation
      [keyToIdx.amygdala, keyToIdx.hippocampus, 0.04, 0.5],    // Emotional memory encoding
      [keyToIdx.amygdala, keyToIdx.hypothalamus, 0.05, 0.4],   // Stria terminalis
      [keyToIdx.amygdala, keyToIdx.basalGanglia, 0.03, 0.3],   // Ventral amygdalofugal
      // Basal ganglia output (2)
      [keyToIdx.basalGanglia, keyToIdx.cortex, 0.02, 0.2],     // Thalamocortical loop
      [keyToIdx.basalGanglia, keyToIdx.cerebellum, 0.02, 0.2], // Subthalamic → cerebellar
      // Cerebellar output (2)
      [keyToIdx.cerebellum, keyToIdx.cortex, 0.03, 0.2],       // Cerebellothalamocortical
      [keyToIdx.cerebellum, keyToIdx.basalGanglia, 0.03, 0.2], // Cerebellar → BG
      // Hypothalamic output (2)
      [keyToIdx.hypothalamus, keyToIdx.amygdala, 0.05, 0.4],   // Drive → emotion
      [keyToIdx.hypothalamus, keyToIdx.basalGanglia, 0.04, 0.3], // Drive → action
      // Consciousness / corpus callosum (3)
      [keyToIdx.mystery, keyToIdx.cortex, 0.05, 0.3],          // Callosal interhemispheric
      [keyToIdx.mystery, keyToIdx.amygdala, 0.04, 0.3],        // Commissural emotional
      [keyToIdx.mystery, keyToIdx.hippocampus, 0.03, 0.2],     // Hippocampal commissure
    ];

    // ── BUILD OUTGOING MAP ──
    // For each cluster, which clusters does it project TO?
    // Used for fractal branching — after landing in a target, follow its outgoing projections
    const outgoing = CLUSTERS.map(() => []);
    for (const [src, tgt] of PROJECTIONS) {
      outgoing[src].push(tgt);
    }

    // Pick a random neuron index within a cluster
    const randNeuron = (ci) => act[ci].offset + Math.floor(Math.random() * act[ci].n);

    // ── FRACTAL TREE BUILDER ──
    // For each active projection pathway:
    //   1. Pick seed neuron in source cluster (proportional to activity)
    //   2. Connect seed → target neuron (inter-cluster projection)
    //   3. From target neuron, branch WITHIN target cluster (intra-cluster synapses)
    //   4. From those endpoints, follow outgoing projections (depth 2-3)
    //   Each level = deeper branching = fractal tree

    for (const [srcCI, tgtCI, density, strength] of PROJECTIONS) {
      if (this._connN >= MAX_CONN) break;

      const srcRate = act[srcCI].rate;
      const tgtRate = act[tgtCI].rate;
      if (srcRate === 0 && tgtRate === 0) continue;

      // Seeds proportional to activity × projection strength
      // More active pathways get more fractal roots
      const activity = (srcRate + tgtRate) * 0.5;
      const seeds = Math.max(1, Math.round(activity * density * strength * 200));

      for (let s = 0; s < seeds && this._connN < MAX_CONN; s++) {
        // ── DEPTH 0: Source → Target (inter-cluster projection) ──
        const srcNeuron = randNeuron(srcCI);
        const tgtNeuron = randNeuron(tgtCI);
        this._addConn(srcNeuron, tgtNeuron, CLUSTERS[srcCI].rgb, CLUSTERS[tgtCI].rgb);

        // ── DEPTH 1: Branch within target cluster (intra-cluster synapses) ──
        // Each landing neuron activates 1-3 neighbors via internal synapses
        const branchCount = 1 + Math.floor(Math.random() * Math.min(3, 1 + tgtRate * 10));
        const depth1Neurons = [];

        for (let b = 0; b < branchCount && this._connN < MAX_CONN; b++) {
          const neighbor = randNeuron(tgtCI);
          if (neighbor !== tgtNeuron) {
            this._addConn(tgtNeuron, neighbor, CLUSTERS[tgtCI].rgb, CLUSTERS[tgtCI].rgb);
            depth1Neurons.push(neighbor);
          }
        }

        // ── DEPTH 2: Follow outgoing projections from target cluster ──
        // The signal that landed in target now propagates OUT through its own projections
        // This creates the fractal web — signal chains across the whole brain
        const tgtOutgoing = outgoing[tgtCI];
        if (tgtOutgoing.length === 0 || depth1Neurons.length === 0) continue;

        for (const d1Neuron of depth1Neurons) {
          if (this._connN >= MAX_CONN) break;
          // Pick one of the target's outgoing projections to follow
          if (Math.random() > 0.4) continue; // 40% chance to branch further
          const nextCI = tgtOutgoing[Math.floor(Math.random() * tgtOutgoing.length)];
          if (act[nextCI].rate === 0 && Math.random() > 0.2) continue;

          const nextNeuron = randNeuron(nextCI);
          this._addConn(d1Neuron, nextNeuron, CLUSTERS[tgtCI].rgb, CLUSTERS[nextCI].rgb);

          // ── DEPTH 3: One more intra-cluster branch at the terminus ──
          if (this._connN < MAX_CONN && Math.random() < 0.3) {
            const termNeuron = randNeuron(nextCI);
            if (termNeuron !== nextNeuron) {
              this._addConn(nextNeuron, termNeuron, CLUSTERS[nextCI].rgb, CLUSTERS[nextCI].rgb);
            }
          }
        }
      }
    }

    // ── CONSCIOUSNESS BRIDGES ──
    // Mystery Ψ connects to everything — the corpus callosum binding
    // Extra connections from mystery to ALL clusters, strength modulated by Ψ
    const mysteryIdx = keyToIdx.mystery;
    const mysteryRate = act[mysteryIdx].rate;
    if (mysteryRate > 0) {
      for (let ci = 0; ci < CLUSTERS.length && this._connN < MAX_CONN; ci++) {
        if (ci === mysteryIdx) continue;
        // Ψ-modulated bridge density — consciousness binds more when active
        const bridges = Math.max(1, Math.round(mysteryRate * 30));
        for (let b = 0; b < bridges && this._connN < MAX_CONN; b++) {
          const mNeuron = randNeuron(mysteryIdx);
          const tNeuron = randNeuron(ci);
          this._addConn(mNeuron, tNeuron, CLUSTERS[mysteryIdx].rgb, CLUSTERS[ci].rgb);
        }
      }
    }
  }

  _addConn(ai, bi, colorA, colorB) {
    if (this._connN >= MAX_CONN) return;
    if (ai < 0 || bi < 0 || ai >= TOTAL || bi >= TOTAL) return;
    const vi = this._connN * 6;
    const ci = this._connN * 8;
    this._connPos[vi]   = this._pos[ai*3];
    this._connPos[vi+1] = this._pos[ai*3+1];
    this._connPos[vi+2] = this._pos[ai*3+2];
    this._connPos[vi+3] = this._pos[bi*3];
    this._connPos[vi+4] = this._pos[bi*3+1];
    this._connPos[vi+5] = this._pos[bi*3+2];
    // Alpha fades with depth — deeper branches dimmer (fractal falloff)
    const alpha = 0.12 + Math.random() * 0.08;
    this._connCol[ci]   = colorA[0]; this._connCol[ci+1] = colorA[1]; this._connCol[ci+2] = colorA[2]; this._connCol[ci+3] = alpha;
    this._connCol[ci+4] = colorB[0]; this._connCol[ci+5] = colorB[1]; this._connCol[ci+6] = colorB[2]; this._connCol[ci+7] = alpha;
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
