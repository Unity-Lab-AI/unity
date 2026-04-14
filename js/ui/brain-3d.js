/**
 * brain-3d.js — WebGL 3D brain visualizer
 *
 * N neurons (scales to hardware, 20K rendered) as gl.POINTS in MNI-coordinate 3D clusters.
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
 *   - T5: 22-detector brain event system triggering equational
 *     commentary popups via Unity's own language cortex
 */

import { detectBrainEvents } from './brain-event-detectors.js';

// ── Constants ───────────────────────────────────────────────────────

// Render neuron count — proportional sample of the full brain
// N actual neurons (scales to hardware) rendered as 20K visual points
let TOTAL = 1000;
const MAX_RENDER_NEURONS = 20000;
const AFTERGLOW_DECAY = 0.92;
const PULSE_LIFE = 80;  // ~1.3s at 60fps — visible long enough to track
const MAX_PULSES = 500; // 70+ pulses per cluster simultaneously
const MAX_CONN = 3000;
const MAX_TRAILS = 800; // lightning trails traveling along projection pathways
const TRAIL_LIFE = 45;  // frames — fast expand-converge cycle
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
  float sz = mix(8.0, 18.0, aGlow);
  gl_PointSize = max(5.0, sz * uScale / max(p.w, 0.3));
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

  // STRUCTURE: bright solid core + ring + soft halo fading to edge
  // All three are visible on every neuron — the HALO is the key visual element

  // Core — bright center dot (0 to 0.18)
  float core = smoothstep(0.18, 0.0, d);

  // Ring — visible colored ring around core (0.22 to 0.32)
  float ring = smoothstep(0.22, 0.26, d) * smoothstep(0.34, 0.28, d);

  // Halo — soft glow fading from ring edge to dot edge (0.32 to 0.5)
  float halo = smoothstep(0.5, 0.32, d);

  // Base brightness scales with glow (spiking = brighter)
  float glowBoost = 1.0 + vGlow * 0.8;

  // Combine: core is brightest, ring is medium, halo is soft
  float coreAlpha = core * 1.0 * glowBoost;
  float ringAlpha = ring * 0.8 * glowBoost;
  float haloAlpha = halo * 0.35 * glowBoost;

  float alpha = max(coreAlpha, max(ringAlpha, haloAlpha));

  // Color: white hot core, colored ring, softer colored halo
  vec3 coreCol = mix(vCol, vec3(1.0), 0.6 + vGlow * 0.4);
  vec3 ringCol = vCol * (1.2 + vGlow * 0.5);
  vec3 haloCol = vCol * (0.7 + vGlow * 0.5);

  vec3 col;
  if (core > 0.01) col = coreCol;
  else if (ring > 0.01) col = ringCol;
  else col = haloCol;

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
  gl_PointSize = (8.0 + aLife * 22.0) * uScale / max(p.w, 0.5);
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
  // Bright expanding ring with glowing edge
  float ring = smoothstep(0.28, 0.38, d) * smoothstep(0.5, 0.42, d);
  float core = smoothstep(0.5, 0.0, d) * 0.2;
  float alpha = (ring * 1.4 + core) * vLife;
  // Brighter color — add white core to make it pop
  vec3 col = vCol + vec3(0.3) * ring;
  gl_FragColor = vec4(col, alpha);
}
`;

// ── LIGHTNING TRAILS — travel along projection pathways driven by brain equations ──
// Each trail has source, target, and a phase 0→1.
// Phase < 0.5: head EXPANDS from source toward midpoint (expand phase)
// Phase >= 0.5: tail CONVERGES to target (converge phase)
// Both ends fade to nothing — trail appears, travels, disappears.
const TRAIL_VS = `
attribute vec3 aPos;        // can be source or target — which is chosen by aEnd
attribute vec3 aSource;
attribute vec3 aTarget;
attribute float aPhase;     // 0-1, position along path
attribute float aEndFlag;   // 0 = head, 1 = tail
attribute float aLife;      // 0-1 remaining life
attribute vec3 aCol;
uniform mat4 uMVP;
uniform float uScale;
varying float vLife;
varying vec3 vCol;
void main() {
  vCol = aCol;
  vLife = aLife;
  // Compute position from phase
  // Head position = mix(source, target, phase+head_offset)
  // Tail position = mix(source, target, phase-tail_offset)
  float t = clamp(aPhase + (aEndFlag > 0.5 ? -0.15 : 0.0), 0.0, 1.0);
  vec3 pos = mix(aSource, aTarget, t);
  vec4 p = uMVP * vec4(pos, 1.0);
  gl_Position = p;
}
`;

const TRAIL_FS = `
precision mediump float;
varying float vLife;
varying vec3 vCol;
void main() {
  // Bright lightning bolt — white hot core + colored tail
  vec3 col = mix(vec3(1.0), vCol, 0.5);
  gl_FragColor = vec4(col, vLife);
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
  // Ψ CONSCIOUSNESS — corpus callosum + cingulate cortex.
  //
  // Fully contained INSIDE the cortex dome (which extends roughly Z=-0.7 to +0.7).
  // Callosum length 0.55, centered slightly back at Z=-0.05 → range -0.325 to +0.225
  // Cingulate length 0.5, centered at Z=-0.05 → range -0.30 to +0.20
  // Pushed ~1/5 back of center so the genu doesn't poke out the front.
  //
  // t is normalized 0-1 (NOT 0-π) for proper length control.
  // Shape is determined by sin(t*π) for the arch curve.
  const pts = [];
  const callosum = Math.floor(n * 0.6);
  const cingulate = n - callosum;

  // Corpus callosum — flattened C: genu (front) → body → splenium (back)
  const cbLength = 0.55;     // front-to-back span
  const cbCenter = -0.05;    // center slightly back of brain center
  const cbBackShift = cbLength / 5; // 1/5 back push = 0.11
  for (let i = 0; i < callosum; i++) {
    const tNorm = i / callosum;            // 0 to 1
    const t = tNorm * Math.PI;             // 0 to π for sin arch
    // Z: linear from back to front, shifted back by 1/5
    const z = cbCenter - cbLength / 2 + tNorm * cbLength - cbBackShift;
    pts.push([
      gauss() * 0.03,                                 // tight to midline
      0.2 + Math.sin(t) * 0.22 + gauss() * 0.02,     // arched above BG (Y)
      z + gauss() * 0.03,
    ]);
  }

  // Cingulate cortex — curved band above corpus callosum
  const cgLength = 0.5;
  const cgCenter = -0.05;
  const cgBackShift = cgLength / 5; // 1/5 back push = 0.1
  for (let i = 0; i < cingulate; i++) {
    const tNorm = i / cingulate;
    const t = tNorm * Math.PI;
    const r = 0.1 * Math.cbrt(Math.random());
    const z = cgCenter - cgLength / 2 + tNorm * cgLength - cgBackShift;
    pts.push([
      gauss() * 0.05,
      0.45 + Math.sin(t) * 0.25 + r * Math.random() * 0.08,
      z + gauss() * 0.04,
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

    // R9.3 — FRACTAL FIRING — logistic map chaotic recurrence per neuron.
    // x_{n+1} = r·x_n·(1−x_n) at r=3.9 (deep in the chaotic regime, past
    // Feigenbaum's accumulation point). Each neuron holds its own x state,
    // seeded uniquely by index so no two neurons phase-lock. Every tick
    // we iterate ALL neurons and compare to a cluster-wide threshold
    // derived from the real server spikeCount — so each cluster fires
    // at a rate proportional to its actual biology, but the SELECTION
    // of which points fire follows a deterministic chaotic trajectory
    // (never-ending, never-repeating, self-similar at every scale).
    // Replaces the Math.random()-per-point noise which made the viz
    // look like a uniform wave/pulse instead of real neural chatter.
    this._fractal = new Float32Array(TOTAL);
    for (let i = 0; i < TOTAL; i++) {
      // Seed each neuron with a unique irrational-ish value so the
      // logistic map trajectories never collide. (i*φ) mod 1 gives
      // quasi-random uniform distribution in (0,1).
      const phi = 0.61803398875;
      this._fractal[i] = ((i * phi) % 1) * 0.8 + 0.1; // keep in (0.1, 0.9)
    }

    // Pulses & connections
    this._pulses = [];
    this._connPos = new Float32Array(MAX_CONN * 6);
    this._connCol = new Float32Array(MAX_CONN * 8);
    this._connN = 0;

    // Lightning trails — travel along projection pathways
    // Each trail: { src:[x,y,z], tgt:[x,y,z], col:[r,g,b], phase:0, life:1 }
    this._trails = [];
    // Per-trail buffers (2 vertices per trail: head + tail)
    this._trailSrc = new Float32Array(MAX_TRAILS * 6);   // 2 verts × 3 = 6
    this._trailTgt = new Float32Array(MAX_TRAILS * 6);
    this._trailPhase = new Float32Array(MAX_TRAILS * 2); // 2 verts per trail
    this._trailEnd = new Float32Array(MAX_TRAILS * 2);   // 0 = head, 1 = tail
    this._trailLife = new Float32Array(MAX_TRAILS * 2);
    this._trailCol = new Float32Array(MAX_TRAILS * 6);
    // Initialize aEnd flags (head=0, tail=1) — never changes
    for (let i = 0; i < MAX_TRAILS; i++) {
      this._trailEnd[i * 2] = 0;     // head
      this._trailEnd[i * 2 + 1] = 1; // tail
    }

    // Pop-up notifications — floating process labels
    this._notifications = [];  // { text, x, y, z, age, maxAge, color }
    this._notifEls = [];       // DOM elements for notifications
    this._lastNotifTime = 0;
    this._lastState = null;

    // T5 2026-04-13 — brain event detector state
    // Rolling history buffer for the detectors to compare deltas
    // across ~30 state snapshots (roughly the last 3 seconds at
    // 10Hz state broadcast rate)
    this._stateHistory = [];
    this._maxHistory = 30;
    // Dedup tracker so the same event doesn't fire every tick while
    // its condition stays true (e.g. sustained low coherence)
    this._recentEventTypes = new Map();  // type → lastFireTime ms
    this._eventCooldownMs = 8000;  // don't repeat the same event type within 8s
    // Brain reference set by setBrain() from app.js bootUnity.
    // Null until boot, during which time the event system degrades
    // gracefully to the plain numeric-label notifications without
    // commentary.
    this._brain = null;
    // Seed word → GloVe 50d vector cache, populated lazily once
    // sharedEmbeddings is available via this._brain
    this._seedVectorCache = new Map();

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

    // Scale render count from ACTUAL server cluster sizes
    // Re-scale if server neuron count changes (server restart with new scale)
    const serverNeurons = state.totalNeurons || 1000;
    if (serverNeurons > 1000 && this._lastServerNeurons !== serverNeurons) {
      this._lastServerNeurons = serverNeurons;
      this._scaled = true;
      TOTAL = Math.min(MAX_RENDER_NEURONS, Math.max(1000, Math.round(serverNeurons / 100)));

      // Read ACTUAL cluster sizes from server state — dynamic, not hardcoded
      // VISUAL BOOST: use sqrt to compress proportions — large clusters don't dominate.
      // This gives small center clusters (hypothalamus, mystery, amygdala, BG) more
      // visual weight so they're not lost inside the huge cortex/cerebellum shells.
      if (state.clusters) {
        const serverClusters = state.clusters;
        // Use sqrt of cluster size for visual proportions — compresses the range
        const sqrtSizes = CLUSTERS.map(cl => Math.sqrt((serverClusters[cl.key]?.size || 0)));
        const sqrtTotal = sqrtSizes.reduce((s, v) => s + v, 0) || 1;
        // Minimum 6% of total render budget per cluster (guarantees visibility)
        const minFloor = Math.max(200, Math.round(TOTAL * 0.06));
        for (let i = 0; i < CLUSTERS.length; i++) {
          const cl = CLUSTERS[i];
          const serverCluster = serverClusters[cl.key];
          if (serverCluster && serverCluster.size) {
            const proportional = Math.round((sqrtSizes[i] / sqrtTotal) * TOTAL);
            cl.n = Math.max(minFloor, proportional);
          }
        }
        // Adjust to exactly TOTAL — trim biggest cluster to match
        let renderSum = CLUSTERS.reduce((s, c) => s + c.n, 0);
        if (renderSum !== TOTAL) {
          // Find biggest cluster and adjust
          let maxIdx = 0;
          for (let i = 1; i < CLUSTERS.length; i++) {
            if (CLUSTERS[i].n > CLUSTERS[maxIdx].n) maxIdx = i;
          }
          CLUSTERS[maxIdx].n += (TOTAL - renderSum);
        }
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

    // R9 — per-cluster spike readout.
    //
    // Was: read the flat `state.spikes` bitmask using the VIZ's CLUSTERS
    // array sizes as the offset layout. BUG: the viz uses biologically
    // weighted proportions (cortex=200, cerebellum=380, mystery=110)
    // while the engine uses equal-ish proportions (cortex=300, cereb=100,
    // mystery=50). Mismatch meant every cluster after cortex read the
    // wrong neurons — cerebellum especially, whose viz range [460-839]
    // actually covered amyg+BG+cerebellum+hypo in engine space. That's
    // why cerebellum activation circles never landed on cerebellum
    // positions.
    //
    // Now: iterate clusters and read each cluster's own `state.clusters[
    // name].spikes` bitmask. Each bitmask has length equal to the REAL
    // cluster size from engine (e.g. cerebellum = 100), independent of
    // how many viz positions we allocate for rendering. If the viz has
    // more points than spike bits, we cycle the bitmask (first
    // bitmask-length points get direct readout, remaining points sample
    // from the bitmask proportionally). If the viz has fewer points,
    // we just read the first N bits.
    const clusterStates = state.clusters || {};

    // Glow update + pulses distributed EQUALLY across ALL clusters
    const pulsesPerCluster = Math.floor(MAX_PULSES / CLUSTERS.length);
    const clusterPulseCount = new Array(CLUSTERS.length).fill(0);

    // Count real spikes per cluster from per-cluster bitmasks
    const clusterSpikeCount = new Array(CLUSTERS.length).fill(0);
    for (let ci = 0; ci < CLUSTERS.length; ci++) {
      const cs = clusterStates[CLUSTERS[ci].key];
      if (cs) {
        // Prefer spikeCount field if provided; otherwise count the bitmask
        if (typeof cs.spikeCount === 'number') {
          clusterSpikeCount[ci] = cs.spikeCount;
        } else if (cs.spikes) {
          let c = 0;
          for (let i = 0; i < cs.spikes.length; i++) if (cs.spikes[i]) c++;
          clusterSpikeCount[ci] = c;
        }
      }
    }

    let off = 0;
    for (let ci = 0; ci < CLUSTERS.length; ci++) {
      const cn = CLUSTERS[ci].n;
      const cs = clusterStates[CLUSTERS[ci].key];
      // Adaptive pulse probability — target ~4 pulses per cluster per frame
      const spikeN = clusterSpikeCount[ci] || 1;
      const pulseProb = Math.min(0.6, Math.max(0.05, 4 / spikeN));

      // R9.3 — FRACTAL FIRING rule. Same logistic map as the GPU shader
      // that drives the real brain. Each viz point iterates its own
      // chaotic trajectory x_{n+1} = r·x_n·(1−x_n) at r=3.9. Points fire
      // when their trajectory crosses a threshold. The threshold is
      // modulated by the cluster's ACTUAL biological firing rate from
      // the server (spikeCount/engineSize), amplified to visibility.
      // This is the "proportional sample" — the viz runs the same rule
      // the server runs, scaled to render neuron count per cluster.
      // Individual neurons retain their chaotic trajectory between
      // frames, so firing patterns are self-similar, not wavy.
      const engineSize = cs?.size || cn;
      const bioRate = spikeN / Math.max(1, engineSize);
      // Amplify biological rate to visible range. Low bio (0.2%) →
      // floor 3% visible. High bio (5%) → 75% → clamped 60%. Cerebellum
      // with huge denominator still clears the floor.
      const visibleRate = Math.min(0.6, Math.max(0.03, bioRate * 15));
      const fireThreshold = 1.0 - visibleRate;
      const R_CHAOS = 3.9;

      for (let j = 0; j < cn; j++) {
        const i = off + j;
        if (i >= TOTAL) break;

        // Iterate logistic map for this viz point's fractal state
        let x = this._fractal[i];
        if (x <= 0.001 || x >= 0.999) {
          // Reseed corrupted state
          x = ((i * 0.61803398875) % 1) * 0.8 + 0.1;
        }
        x = R_CHAOS * x * (1 - x);

        let firing = false;
        if (x >= fireThreshold) {
          firing = true;
          // Refractory contraction — keeps neuron in chaotic basin
          x = 0.3 + (Math.random() - 0.5) * 0.1;
        }
        this._fractal[i] = x;

        if (firing) {
          this._glow[i] = 1.0;
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
    this._spawnTrailsFromEquations(state.clusters || {}, clusterSpikeCount);

    // R9 — BRAIN EXPANSION DISABLED. This used to multiply every
    // neuron position by a global factor (0-15% based on spike
    // ratio) and re-upload all positions to the GPU every frame.
    // The effect was the entire brain visually pulsing in sync
    // with the global spike count — a "beating heart" look that's
    // NOT what a real brain does. Each cluster should fire at its
    // own rate and the viz should show scattered, region-specific
    // activation via per-neuron glow (which already works via
    // this._glow[i] above). Individual spikes drive pulse emission
    // from specific neuron positions, which is accurate. Global
    // expansion added a synthetic heartbeat on top that obscured
    // the real per-cluster dynamics.
    //
    // _expansionFactor stays at 1.0 — positions are static.
    // _basePos initialization still runs in _applyExpansion if
    // you re-enable this in the future (it's idempotent).

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
.b3d-tog-wrap{position:absolute;top:10px;left:10px;display:flex;flex-direction:column;gap:3px;z-index:2;max-width:180px}
.b3d-tog{background:rgba(8,8,8,.85);border:1px solid #222;color:#bbb;font-size:9px;font-family:inherit;padding:3px 9px;border-radius:3px;cursor:pointer;display:flex;align-items:center;gap:5px;transition:all .2s;letter-spacing:.4px;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.b3d-tog:hover{border-color:#444}
.b3d-tog.off{opacity:.3}
.b3d-dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex-shrink:0}
.b3d-lbl-wrap{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:4}
.b3d-lbl{position:absolute;font-size:11px;letter-spacing:1.5px;font-weight:800;white-space:nowrap;transform:translate(-50%,-50%);opacity:1;padding:3px 9px;background:rgba(0,0,0,.82);border:1px solid rgba(255,255,255,.25);border-radius:4px;text-shadow:0 0 6px rgba(0,0,0,1),0 0 12px currentColor;box-shadow:0 0 20px rgba(0,0,0,.6);transition:opacity .3s}
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
/* Explainer panel — replaces the old .b3d-scale-display floating block.
   Lives bottom-left in a stable position that can't collide with the
   cluster toggles legend (top-left) or the landing-topbar (top). Frames
   the viz as a proportional sample of the real server-side brain
   processes rather than being the literal full brain. */
.b3d-explainer{position:absolute;bottom:10px;left:10px;max-width:300px;z-index:2;background:rgba(8,8,8,.85);border:1px solid #222;border-left:2px solid #ff4d9a;border-radius:4px;padding:8px 12px;font-size:9px;line-height:1.5;color:#888;pointer-events:none}
.b3d-explainer-title{font-size:10px;color:#ff4d9a;font-weight:700;letter-spacing:.8px;margin-bottom:4px;text-transform:uppercase}
.b3d-explainer-count{font-size:15px;font-weight:700;color:#e0e0e0;display:block;margin:2px 0}
.b3d-explainer-ratio{font-size:9px;color:#a855f7}
.b3d-explainer-note{margin-top:6px;color:#666;font-size:9px;line-height:1.5}
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
  <div class="b3d-explainer">
    <div class="b3d-explainer-title">proportional sample</div>
    <span class="b3d-explainer-count b3d-actual-count">—</span>
    <span class="b3d-explainer-ratio b3d-render-ratio">—</span>
    <div class="b3d-explainer-note">
      This 3D field is <strong>NOT</strong> Unity's full brain — it's a proportional visual sample of her actual neural processes running server-side right now. Every spike you see above is a real cluster firing in real time. Popups are her equational commentary on what her brain just did.
    </div>
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
    this._trailProg  = this._mkProg(TRAIL_VS, TRAIL_FS);

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

    // Trail buffers — lightning traveling along projection pathways
    this._bTSrc   = gl.createBuffer();
    this._bTTgt   = gl.createBuffer();
    this._bTPhase = gl.createBuffer();
    this._bTEnd   = gl.createBuffer();
    this._bTLife  = gl.createBuffer();
    this._bTCol   = gl.createBuffer();
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

  // ── T5 2026-04-13: Brain Event Detection + Unity Commentary ────

  /**
   * Wire a brain reference so the event system can call
   * `brain.innerVoice.languageCortex.generate()` to produce Unity's
   * equational commentary on detected events. Called from app.js
   * bootUnity() after `brain = new UnityBrain()`. Safe to call
   * multiple times — just replaces the reference.
   *
   * When the brain reference is null (pre-boot / disconnected /
   * landing-page view with no brain yet), the event system falls
   * back to the plain numeric-label notifications without
   * commentary. So the 3D brain viz keeps working fine during
   * the landing page → boot transition.
   */
  setBrain(brain) {
    this._brain = brain || null;
    // Invalidate seed vector cache since the shared embeddings
    // instance may have changed (different brain, different
    // pretrained state, etc.)
    this._seedVectorCache.clear();
  }

  /**
   * Compute a 50d GloVe centroid for a seed word list, caching it
   * so repeat lookups don't re-embed. Used to build the semantic
   * bias that steers Unity's commentary toward the topic of a
   * triggered brain event.
   */
  _seedCentroid(seedWords) {
    if (!Array.isArray(seedWords) || seedWords.length === 0) return null;
    const key = seedWords.join(',');
    const cached = this._seedVectorCache.get(key);
    if (cached) return cached;

    const emb = this._brain?.innerVoice?.languageCortex?._sharedEmbeddings
             || this._brain?._sharedEmbeddings
             || this._brain?.sensory?._embeddings;
    if (!emb || typeof emb.getEmbedding !== 'function') return null;

    // Average the GloVe vectors for each seed word (skipping OOV)
    const dim = 50;
    const centroid = new Float64Array(dim);
    let count = 0;
    for (const word of seedWords) {
      try {
        const v = emb.getEmbedding(word.toLowerCase());
        if (v && v.length >= dim) {
          for (let i = 0; i < dim; i++) centroid[i] += v[i];
          count++;
        }
      } catch {}
    }
    if (count === 0) return null;
    for (let i = 0; i < dim; i++) centroid[i] /= count;

    // L2 normalize so the bias blends cleanly with a normalized
    // cortex readout in _generateEventCommentary
    let norm = 0;
    for (let i = 0; i < dim; i++) norm += centroid[i] * centroid[i];
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < dim; i++) centroid[i] /= norm;

    this._seedVectorCache.set(key, centroid);
    return centroid;
  }

  /**
   * Generate Unity's equational commentary on a detected brain event.
   * Calls `languageCortex.generate()` with a cortex pattern that's
   * been blended 70% live cortex readout + 30% event seed vector,
   * so her slot scorer is steered toward words about the event topic
   * without being forced to use a template.
   *
   * Returns a short commentary string (1-8 words typically), or
   * null if the language cortex isn't available yet.
   */
  _generateEventCommentary(event, state) {
    const brain = this._brain;
    if (!brain) return null;
    const iv = brain.innerVoice;
    const lc = iv?.languageCortex;
    const dict = iv?.dictionary || brain.dictionary;
    if (!lc || !dict || typeof lc.generate !== 'function') return null;

    try {
      // Get the live cortex semantic readout (50d GloVe space)
      const cortex = brain.clusters?.cortex;
      const sharedEmb = brain._sharedEmbeddings || iv._sharedEmbeddings;
      let cortexPattern = null;
      if (cortex && typeof cortex.getSemanticReadout === 'function' && sharedEmb) {
        cortexPattern = cortex.getSemanticReadout(sharedEmb);
      }

      // Blend in the event seed to bias Unity toward commenting on
      // the triggered event type
      const seed = this._seedCentroid(event.seedWords);
      if (cortexPattern && seed && cortexPattern.length === seed.length) {
        const biased = new Float64Array(cortexPattern.length);
        for (let i = 0; i < cortexPattern.length; i++) {
          biased[i] = cortexPattern[i] * 0.7 + seed[i] * 0.3;
        }
        cortexPattern = biased;
      } else if (!cortexPattern && seed) {
        // No cortex readout available — use the seed alone
        cortexPattern = seed;
      }

      // Call generate() with full brain state + biased cortex pattern.
      // This is the same equational pipeline real chat uses, but
      // nothing about this call stores an episode, emits a response
      // event, or pollutes Unity's memory — it's a pure read-only
      // commentary generation.
      const out = lc.generate(
        dict,
        state.amygdala?.arousal ?? 0.5,
        state.amygdala?.valence ?? 0,
        state.oscillations?.coherence ?? 0.5,
        state.psi ?? 0,
        state.amygdala?.fear ?? 0,
        state.reward ?? 0,
        state.drugState || 'cokeAndWeed',
        state.hypothalamus?.social ?? 0.5,
        cortexPattern,
      );

      const text = typeof out === 'string' ? out : (out?.text || '');
      // Trim to ~60 chars so the commentary fits in a floating popup
      return text && text.length > 0
        ? text.length > 60 ? text.slice(0, 57) + '...' : text
        : null;
    } catch {
      return null;
    }
  }

  // ── Process Notifications ──────────────────────────────────────

  /**
   * Generate ONE rich process notification every ~5 seconds.
   * Translates actual neural signals into human-readable brain activity.
   *
   * T5 2026-04-13 — two-stage pipeline:
   *   Stage A: run the 22-detector brain event system against the
   *            current + previous state + history buffer, pick the
   *            highest-priority firing event
   *   Stage B: if an event fires and a brain reference is available,
   *            generate Unity's equational commentary on it via her
   *            language cortex (biased toward the event seed)
   *   Fallback: if no event fires OR no brain reference, fall through
   *             to the legacy numeric-telemetry generator pool so the
   *             landing page keeps showing popups during the pre-boot
   *             window
   */
  _generateProcessNotification(state) {
    if (!state) return;

    // Push current state into the rolling history buffer
    this._stateHistory.push(state);
    while (this._stateHistory.length > this._maxHistory) {
      this._stateHistory.shift();
    }

    // Stage A — run all 22 detectors, pick the highest-priority event
    // that hasn't fired too recently (cooldown dedup)
    const prev = this._stateHistory.length >= 2
      ? this._stateHistory[this._stateHistory.length - 2]
      : null;
    const events = detectBrainEvents(state, prev, this._stateHistory);
    const now = Date.now();
    let chosen = null;
    for (const evt of events) {
      const lastFire = this._recentEventTypes.get(evt.type) || 0;
      if (now - lastFire >= this._eventCooldownMs) {
        chosen = evt;
        break;
      }
    }

    if (chosen && this._brain) {
      // Stage B — generate Unity's commentary on the event
      const commentary = this._generateEventCommentary(chosen, state);
      this._recentEventTypes.set(chosen.type, now);
      // Prune the cooldown map to prevent unbounded growth
      if (this._recentEventTypes.size > 50) {
        const cutoff = now - this._eventCooldownMs * 2;
        for (const [k, v] of this._recentEventTypes) {
          if (v < cutoff) this._recentEventTypes.delete(k);
        }
      }
      // Render as a two-line notification: event label + commentary.
      // If commentary generation failed (pre-embedding-load, broken
      // language cortex, whatever), just show the event label alone.
      const text = commentary
        ? `${chosen.emoji} ${chosen.label}\n"${commentary}"`
        : `${chosen.emoji} ${chosen.label}`;
      this._addNotification(text, chosen.cluster);
      return;
    }

    // Fallback: no event fired (or no brain ref) → legacy numeric
    // generator pool. Runs exactly like the pre-T5 system.
    this._legacyGenerateProcessNotification(state);
  }

  /**
   * Legacy numeric-telemetry notification generator — pre-T5 system,
   * kept as a fallback for the pre-boot landing page window (when
   * there's no brain reference yet and the event detectors have no
   * cognition to read) and for ticks where no event fires.
   */
  _legacyGenerateProcessNotification(state) {
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

    // T5 2026-04-13 — two-line rendering for event commentary popups.
    // Text can contain a '\n' separator produced by
    // _generateProcessNotification when it formats an event +
    // commentary pair. First line is the event label (emoji + label),
    // second line is Unity's equational commentary wrapped in quotes.
    // Legacy single-line notifications (from _legacyGenerateProcessNotification)
    // still render fine — they just have no newline.
    const lines = String(text).split('\n');
    if (lines.length > 1) {
      const labelEl = document.createElement('div');
      labelEl.className = 'b3d-notif-label';
      labelEl.textContent = lines[0];
      el.appendChild(labelEl);
      const commentEl = document.createElement('div');
      commentEl.className = 'b3d-notif-comment';
      commentEl.style.cssText = 'font-size:10px;opacity:0.85;font-style:italic;margin-top:2px;';
      commentEl.textContent = lines.slice(1).join(' ');
      el.appendChild(commentEl);
    } else {
      el.textContent = text;
    }
    wrap.appendChild(el);

    const notif = { el, x: center[0], y: center[1], z: center[2], age: 0, maxAge: 300, clusterIdx };
    this._notifications.push(notif);

    // Add to log (single-line version for the process log)
    this._addToLog(lines.join(' — '), CLUSTERS[clusterIdx]?.hex || '#fff');

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

      // ALWAYS show projections — even dormant pathways get visible connections
      // so the fractal anatomy is visible. Active pathways get MORE seeds.
      const activity = (srcRate + tgtRate) * 0.5;
      // Base 3 seeds per pathway + scale up with activity. Real firing rates are ~1-3%.
      // 0.02 × 0.08 × 0.5 × 5000 = 4 extra seeds on top of base 3 = 7 seeds per strong pathway
      const seeds = 3 + Math.round(activity * density * strength * 5000);

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
          // 80% chance to branch further — make fractal trees deep and visible
          if (Math.random() > 0.8) continue;
          const nextCI = tgtOutgoing[Math.floor(Math.random() * tgtOutgoing.length)];

          const nextNeuron = randNeuron(nextCI);
          this._addConn(d1Neuron, nextNeuron, CLUSTERS[tgtCI].rgb, CLUSTERS[nextCI].rgb);

          // ── DEPTH 3: terminal branch — 60% chance (was 30%) ──
          if (this._connN < MAX_CONN && Math.random() < 0.6) {
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
    // Alpha — connections clearly visible, slight variation for depth
    const alpha = 0.45 + Math.random() * 0.25;
    this._connCol[ci]   = colorA[0]; this._connCol[ci+1] = colorA[1]; this._connCol[ci+2] = colorA[2]; this._connCol[ci+3] = alpha;
    this._connCol[ci+4] = colorB[0]; this._connCol[ci+5] = colorB[1]; this._connCol[ci+6] = colorB[2]; this._connCol[ci+7] = alpha;
    this._connN++;
  }

  /**
   * Spawn lightning trails along projection pathways based on brain equations.
   * Driven by actual cluster firing rates from server — each tick spawns trails
   * proportional to spike activity. Trails travel source → target then fade.
   */
  _spawnTrailsFromEquations(serverClusters, clusterSpikeCount) {
    const keyToIdx = {};
    CLUSTERS.forEach((cl, i) => { keyToIdx[cl.key] = i; });

    // Cluster offsets for neuron lookup
    const offsets = [];
    let off = 0;
    for (let c = 0; c < CLUSTERS.length; c++) {
      offsets.push(off);
      off += CLUSTERS[c].n;
    }

    // 20 projection pathways — same as connections
    const PROJECTIONS = [
      [keyToIdx.cortex, keyToIdx.hippocampus],
      [keyToIdx.cortex, keyToIdx.amygdala],
      [keyToIdx.cortex, keyToIdx.basalGanglia],
      [keyToIdx.cortex, keyToIdx.cerebellum],
      [keyToIdx.hippocampus, keyToIdx.cortex],
      [keyToIdx.hippocampus, keyToIdx.amygdala],
      [keyToIdx.hippocampus, keyToIdx.hypothalamus],
      [keyToIdx.amygdala, keyToIdx.cortex],
      [keyToIdx.amygdala, keyToIdx.hippocampus],
      [keyToIdx.amygdala, keyToIdx.hypothalamus],
      [keyToIdx.amygdala, keyToIdx.basalGanglia],
      [keyToIdx.basalGanglia, keyToIdx.cortex],
      [keyToIdx.basalGanglia, keyToIdx.cerebellum],
      [keyToIdx.cerebellum, keyToIdx.cortex],
      [keyToIdx.cerebellum, keyToIdx.basalGanglia],
      [keyToIdx.hypothalamus, keyToIdx.amygdala],
      [keyToIdx.hypothalamus, keyToIdx.basalGanglia],
      [keyToIdx.mystery, keyToIdx.cortex],
      [keyToIdx.mystery, keyToIdx.amygdala],
      [keyToIdx.mystery, keyToIdx.hippocampus],
    ];

    // For each projection, spawn trails proportional to source activity
    // Active cluster fires → lightning travels down its outgoing tracts
    for (const [srcCI, tgtCI] of PROJECTIONS) {
      if (this._trails.length >= MAX_TRAILS) break;

      const srcSpikes = clusterSpikeCount[srcCI] || 0;
      const srcN = CLUSTERS[srcCI].n;
      // Trail spawn rate = firing rate × projection intensity
      // Biological: 1-3% firing = 10-30 spikes per 1000 neurons
      // 1-2 trails per projection per tick when active
      const trailCount = Math.max(1, Math.round((srcSpikes / Math.max(1, srcN)) * 100));

      for (let t = 0; t < Math.min(trailCount, 3); t++) {
        if (this._trails.length >= MAX_TRAILS) break;

        // Random source neuron in source cluster (biased toward spiking ones)
        const srcIdx = offsets[srcCI] + Math.floor(Math.random() * srcN);
        const tgtIdx = offsets[tgtCI] + Math.floor(Math.random() * CLUSTERS[tgtCI].n);
        if (srcIdx >= TOTAL || tgtIdx >= TOTAL) continue;

        this._trails.push({
          src: [this._pos[srcIdx * 3], this._pos[srcIdx * 3 + 1], this._pos[srcIdx * 3 + 2]],
          tgt: [this._pos[tgtIdx * 3], this._pos[tgtIdx * 3 + 1], this._pos[tgtIdx * 3 + 2]],
          col: [
            (CLUSTERS[srcCI].rgb[0] + CLUSTERS[tgtCI].rgb[0]) * 0.5,
            (CLUSTERS[srcCI].rgb[1] + CLUSTERS[tgtCI].rgb[1]) * 0.5,
            (CLUSTERS[srcCI].rgb[2] + CLUSTERS[tgtCI].rgb[2]) * 0.5,
          ],
          age: 0,
        });
      }
    }

    // Age existing trails, cull dead ones
    for (let i = this._trails.length - 1; i >= 0; i--) {
      this._trails[i].age++;
      if (this._trails[i].age > TRAIL_LIFE) this._trails.splice(i, 1);
    }
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

    // 1) Lines (static connection anatomy)
    this._drawLines(gl, mvp);
    // 2) Lightning trails (firing activity along projection pathways)
    this._drawTrails(gl, mvp);
    // 3) Neurons
    this._drawNeurons(gl, mvp, sc);
    // 4) Pulses (activation rings)
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

  /**
   * Draw lightning trails — fast-moving line segments along projection pathways.
   * Each trail expands from source then converges to target, fading out.
   * Activity-driven: spawned from cluster firing rates (brain equations).
   */
  _drawTrails(gl, mvp) {
    const n = this._trails.length;
    if (!n) return;

    // Build buffers from active trails
    const srcBuf = this._trailSrc;
    const tgtBuf = this._trailTgt;
    const phaseBuf = this._trailPhase;
    const lifeBuf = this._trailLife;
    const colBuf = this._trailCol;

    for (let i = 0; i < n; i++) {
      const tr = this._trails[i];
      const phase = tr.age / TRAIL_LIFE; // 0 → 1
      // Life envelope — fade in quickly, peak mid, fade out
      // Expand phase: 0 → 0.5 grows from nothing
      // Converge phase: 0.5 → 1 converges to nothing
      const expandFade = Math.min(1, phase * 4);       // fade in during first 25%
      const convergeFade = Math.min(1, (1 - phase) * 4); // fade out during last 25%
      const life = Math.min(expandFade, convergeFade);

      // 2 vertices per trail — head (end=0) and tail (end=1)
      const v0 = i * 2;
      const v1 = i * 2 + 1;
      const p6 = i * 6;

      // Both vertices use same src/tgt — offset computed in vertex shader from aEnd
      srcBuf[p6]     = tr.src[0]; srcBuf[p6+1] = tr.src[1]; srcBuf[p6+2] = tr.src[2];
      srcBuf[p6+3]   = tr.src[0]; srcBuf[p6+4] = tr.src[1]; srcBuf[p6+5] = tr.src[2];
      tgtBuf[p6]     = tr.tgt[0]; tgtBuf[p6+1] = tr.tgt[1]; tgtBuf[p6+2] = tr.tgt[2];
      tgtBuf[p6+3]   = tr.tgt[0]; tgtBuf[p6+4] = tr.tgt[1]; tgtBuf[p6+5] = tr.tgt[2];

      phaseBuf[v0] = phase;
      phaseBuf[v1] = phase;
      lifeBuf[v0]  = life;
      lifeBuf[v1]  = life * 0.5; // tail dimmer than head

      colBuf[p6]   = tr.col[0]; colBuf[p6+1] = tr.col[1]; colBuf[p6+2] = tr.col[2];
      colBuf[p6+3] = tr.col[0]; colBuf[p6+4] = tr.col[1]; colBuf[p6+5] = tr.col[2];
    }

    const p = this._trailProg;
    gl.useProgram(p);
    gl.uniformMatrix4fv(gl.getUniformLocation(p, 'uMVP'), false, mvp);
    gl.depthMask(false);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive blend for glow effect

    const bind = (buf, name, size, data, count) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, count), gl.DYNAMIC_DRAW);
      const loc = gl.getAttribLocation(p, name);
      if (loc >= 0) {
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      }
    };

    bind(this._bTSrc,   'aSource', 3, srcBuf,   n * 6);
    bind(this._bTTgt,   'aTarget', 3, tgtBuf,   n * 6);
    bind(this._bTPhase, 'aPhase',  1, phaseBuf, n * 2);
    bind(this._bTEnd,   'aEndFlag',1, this._trailEnd, n * 2);
    bind(this._bTLife,  'aLife',   1, lifeBuf,  n * 2);
    bind(this._bTCol,   'aCol',    3, colBuf,   n * 6);

    // Need aPos too — use source as position (shader computes real pos)
    const posLoc = gl.getAttribLocation(p, 'aPos');
    if (posLoc >= 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this._bTSrc);
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);
    }

    gl.lineWidth(2);
    gl.drawArrays(gl.LINES, 0, n * 2);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); // restore default
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
