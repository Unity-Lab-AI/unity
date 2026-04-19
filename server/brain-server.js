/**
 * brain-server.js — Unity's Brain Running on a Server
 *
 * One brain. Always on. Shared by everyone.
 *
 * The same engine.js equations run here in Node.js instead of
 * the browser. Clients connect via WebSocket to send sensory
 * input and receive brain state + responses.
 *
 * Usage: node server/brain-server.js
 *
 * The brain thinks continuously even with 0 clients.
 * When someone connects, they see the same brain everyone sees.
 * When someone talks, the brain responds and everyone sees the
 * neural activity. Learning from ALL interactions shapes the weights.
 *
 * Requires: npm install ws (WebSocket library)
 */

const { WebSocketServer } = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const os = require('os');
const { execSync } = require('child_process');
const { performance } = require('perf_hooks');
const { SparseMatmulPool } = require('./worker-pool.js');

// ── Auto-Scale: Detect Hardware → Set Neuron Count ─────────────

// Optional admin override — server/resource-config.json is written by
// the GPUCONFIGURE.bat → gpu-configure.html admin UI and lets a server
// operator cap resource usage BELOW the detected hardware ceiling.
// Cannot raise usage above what the hardware reports — idiot-proof.
// Schema: {tier, vramCapMB, ramCapFraction, neuronCapOverride, notes}
// Any field missing = fall through to pure auto-detect.
function loadResourceOverride() {
  try {
    const cfgPath = path.join(__dirname, 'resource-config.json');
    if (!fs.existsSync(cfgPath)) return null;
    const raw = fs.readFileSync(cfgPath, 'utf8');
    const cfg = JSON.parse(raw);
    if (typeof cfg !== 'object' || !cfg) return null;
    return cfg;
  } catch (err) {
    console.warn('[Brain] resource-config.json load failed:', err.message, '— falling back to auto-detect');
    return null;
  }
}

function detectResources() {
  const totalRAM = os.totalmem();
  const freeRAM = os.freemem();
  const cpuCount = os.cpus().length;
  const cpuModel = os.cpus()[0]?.model || 'unknown';
  const override = loadResourceOverride();

  // Detect GPU
  let gpu = { name: 'none', vram: 0 };
  try {
    const smi = execSync('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits', { timeout: 5000 }).toString().trim();
    const parts = smi.split(',').map(s => s.trim());
    if (parts.length >= 2) {
      gpu = { name: parts[0], vram: parseInt(parts[1]) || 0 }; // vram in MB
    }
  } catch {
    // No NVIDIA GPU or nvidia-smi not available
    try {
      const wmic = execSync('wmic path win32_videocontroller get name,adapterram', { timeout: 5000 }).toString();
      const match = wmic.match(/(\d{9,})/);
      if (match) gpu = { name: 'GPU', vram: Math.floor(parseInt(match[1]) / 1048576) };
    } catch {}
  }

  // Scale neurons based on available resources
  // Server neuron memory: 9 bytes each (8 voltage + 1 spike)
  // No NxN synapse matrices on server — those are client-side
  // Real constraint: CPU time per step, not memory
  //
  // With parallel workers (7 cores):
  //   1M neurons = ~9MB RAM, ~180 steps/sec at 60% CPU
  //   5M neurons = ~45MB RAM, ~30 steps/sec
  //   10M neurons = ~90MB RAM, ~15 steps/sec
  //
  // Scale based on: RAM for allocation, CPU cores for throughput
  let maxNeurons;
  let scaleSource;

  if (gpu.vram > 0) {
    // GPU EXCLUSIVE — scale to VRAM
    // Rulkov layout: vec2<f32> state (8 bytes) + spikes u32 (4 bytes) = 12 bytes/neuron
    const usableVRAM = gpu.vram * 0.85; // use 85% of VRAM
    const vramNeurons = Math.floor(usableVRAM * 1048576 / 12);
    // Server RAM: tiny — only injection arrays, not full cluster state
    const usableRAM = freeRAM * 0.1;
    const ramNeurons = Math.floor(usableRAM / 0.001); // essentially unlimited
    maxNeurons = Math.min(vramNeurons, ramNeurons);

    // PER-CLUSTER BUFFER CAP — WebGPU's maxStorageBufferBindingSize is
    // typically 2 GB (hard spec minimum). Some desktop GPUs raise it to
    // ~4 GB. With Chrome's `--enable-unsafe-webgpu` flag (which Unity
    // uses per Gee's setup) the limit rises further — effectively up to
    // device-maximum (VRAM bytes minus overhead). The Rulkov state
    // buffer for a single cluster is size × 8 bytes (vec2<f32>); if it
    // exceeds the real binding limit the cluster silently binds to zero
    // and never fires — exactly what was happening to cortex + cerebellum
    // at 1.8 B-neuron scale.
    //
    // T14.22 (2026-04-14) — binding ceiling is now ADMIN-OVERRIDABLE
    // via `bindingCeilingMB` in resource-config.json. When running
    // unsafe WebGPU the operator can raise the cap to their real
    // binding limit (4 GB, 8 GB, full VRAM). Default stays at 2 GB
    // for safe-mode Chrome / Firefox / Safari deployments.
    let bindingCeilingBytes = 2 * 1024 * 1024 * 1024; // 2 GB default
    if (override && typeof override.bindingCeilingMB === 'number' && override.bindingCeilingMB >= 1024) {
      // Clamp to detected VRAM so a corrupt config can't exceed
      // hardware reality even in unsafe mode.
      const requested = Math.min(override.bindingCeilingMB, gpu.vram || override.bindingCeilingMB);
      bindingCeilingBytes = requested * 1024 * 1024;
    }
    const maxPerClusterNeurons = Math.floor(bindingCeilingBytes / 8);
    const maxTotalForBinding = Math.floor(maxPerClusterNeurons / 0.4); // cerebellum = 40%
    const bindingCeilingLabel = `${Math.round(bindingCeilingBytes / 1048576 / 1024)}GB`;
    if (maxNeurons > maxTotalForBinding) {
      maxNeurons = maxTotalForBinding;
      scaleSource = `GPU: ${gpu.name} (${gpu.vram}MB VRAM, capped to ${(maxTotalForBinding/1e6).toFixed(0)}M to keep per-cluster state < ${bindingCeilingLabel} binding ceiling — raise via bindingCeilingMB in resource-config.json if running unsafe WebGPU)`;
    } else {
      scaleSource = `GPU: ${gpu.name} (${gpu.vram}MB VRAM, ${Math.round(freeRAM/1024/1024/1024)}GB RAM, Rulkov 12bytes/neuron, binding ceiling ${bindingCeilingLabel})`;
    }
  } else {
    // CPU only — limited by cores
    const usableRAM = freeRAM * 0.3;
    const ramNeurons = Math.floor(usableRAM / 9);
    maxNeurons = Math.min(ramNeurons, cpuCount * 150000);
    scaleSource = `CPU: ${cpuModel} (${cpuCount} cores, ${Math.round(freeRAM/1024/1024/1024)}GB free)`;
  }

  // No artificial cap — hardware decides. VRAM and RAM are the only limits.
  maxNeurons = Math.max(1000, maxNeurons);

  // Apply admin override from resource-config.json. Override can only
  // LOWER the cap, never raise it above detected hardware. Validates
  // and silently clamps out-of-range values — corrupt config never
  // corrupts the running brain.
  let appliedOverride = null;
  if (override) {
    appliedOverride = { tier: override.tier || 'custom', source: 'admin-override' };
    if (typeof override.neuronCapOverride === 'number' && override.neuronCapOverride >= 1000) {
      const requested = Math.floor(override.neuronCapOverride);
      if (requested <= maxNeurons) {
        maxNeurons = requested;
        appliedOverride.neuronCap = requested;
      } else {
        appliedOverride.rejected = `requested ${requested} exceeds detected ceiling ${maxNeurons}`;
      }
    }
    if (typeof override.vramCapMB === 'number' && override.vramCapMB >= 256 && gpu.vram > 0) {
      const cap = Math.min(override.vramCapMB, gpu.vram);
      const capNeurons = Math.floor(cap * 1048576 / 8);
      if (capNeurons < maxNeurons) {
        maxNeurons = capNeurons;
        appliedOverride.vramCapMB = cap;
      }
    }
    scaleSource = `[admin:${appliedOverride.tier}] ` + scaleSource;
  }

  // Round to nice cluster sizes (must divide into 7 clusters)
  const clusterScale = Math.floor(maxNeurons / 1000);

  return {
    totalRAM: Math.round(totalRAM / 1024 / 1024 / 1024) + 'GB',
    freeRAM: Math.round(freeRAM / 1024 / 1024 / 1024) + 'GB',
    cpuModel,
    cpuCount,
    gpu,
    maxNeurons,
    clusterScale,
    scaleSource,
    override: appliedOverride,
  };
}

const RESOURCES = detectResources();

// ── T17.3.f — Unified biological VRAM allocator (Gee 2026-04-18) ────
//
// ONE budget across ALL 8 brain regions (7 main + language cortex).
// Replaces the broken split where main-brain scaler picked 671M
// independently and language-cortex scaler picked 200K independently,
// resulting in 17.6 GB VRAM on a 16 GB card → driver spillover →
// compute_batch timeouts.
//
// Formula:
//   total_VRAM      = vramCapMB                 (from resource-config.json)
//   os_reserve      = osReserveVramMB           (from resource-config.json, default 2 GB)
//   brain_budget    = total_VRAM - os_reserve
//   per_region_budget[k] = brain_budget × biologicalWeights[k]
//
// Weights sum to 1.0, configurable in resource-config.json. Default:
//   language_cortex  0.45  — BIGGEST slice because sparse cross-projections
//                            at fanout 1500 cost ~18 KB/neuron (70× more
//                            VRAM per neuron than main-brain regions)
//   cerebellum       0.20
//   cortex (main)    0.15
//   hippocampus      0.06
//   amygdala         0.04
//   basalGanglia     0.04
//   hypothalamus     0.03
//   mystery          0.03
//
// Bytes-per-neuron (empirical, from 2026-04-18 boot log):
//   main brain:      ~21 bytes (Rulkov state + spike buffer + GPU
//                    synapse overhead at scale-limited fanout)
//   language cortex: ~18 KB   (14 cross-projections at fanout 1500 +
//                    intra-synapse matrix at density 0.0015)
const DEFAULT_BIO_WEIGHTS = {
  language_cortex: 0.45,
  cerebellum:      0.20,
  cortex:          0.15,
  hippocampus:     0.06,
  amygdala:        0.04,
  basalGanglia:    0.04,
  hypothalamus:    0.03,
  mystery:         0.03,
};
const BRAIN_VRAM_ALLOC = (function () {
  const cfg = RESOURCES.override || {};
  const vramMB = typeof cfg.vramCapMB === 'number' ? cfg.vramCapMB
               : (RESOURCES.gpu && RESOURCES.gpu.vram) ? RESOURCES.gpu.vram
               : 16384;
  const osReserveMB = typeof cfg.osReserveVramMB === 'number' ? cfg.osReserveVramMB : 2048;
  const brainBudgetMB = Math.max(1024, vramMB - osReserveMB);

  // Normalize biological weights — if config weights sum != 1.0, scale them.
  const rawWeights = { ...DEFAULT_BIO_WEIGHTS, ...(cfg.biologicalWeights || {}) };
  const weightSum = Object.values(rawWeights).reduce((s, w) => s + (Number(w) || 0), 0);
  const weights = {};
  for (const [k, v] of Object.entries(rawWeights)) {
    weights[k] = (Number(v) || 0) / (weightSum || 1);
  }

  // Per-region VRAM budget in BYTES
  const brainBudgetBytes = brainBudgetMB * 1024 * 1024;
  const perRegionBytes = {};
  for (const [k, w] of Object.entries(weights)) {
    perRegionBytes[k] = Math.floor(brainBudgetBytes * w);
  }

  return {
    vramMB,
    osReserveMB,
    brainBudgetMB,
    weights,
    perRegionBytes,
    MAIN_BRAIN_BYTES_PER_NEURON: 21,
    LANG_CORTEX_BYTES_PER_NEURON: 18 * 1024,
  };
})();
console.log(`[Brain] Unified VRAM allocator: total=${BRAIN_VRAM_ALLOC.vramMB}MB − OS=${BRAIN_VRAM_ALLOC.osReserveMB}MB = brain=${BRAIN_VRAM_ALLOC.brainBudgetMB}MB. Weights: ${Object.entries(BRAIN_VRAM_ALLOC.weights).map(([k,w]) => `${k}=${(w*100).toFixed(1)}%`).join(' ')}.`);

// ── Configuration ──────────────────────────────────────────────

// R14 — moved off 8080 to avoid colliding with llama.cpp / LocalAI /
// every other service that claims 8080 by default. Unity now binds to
// 7525 unless PORT is set in the environment. If you need the old
// behavior for an existing deployment, `PORT=8080 node brain-server.js`.
const PORT = parseInt(process.env.PORT, 10) || 7525;
const STATE_BROADCAST_MS = 100;    // send state to clients 10fps
const WEIGHT_SAVE_MS = 300000;     // save weights every 5 minutes
const WEIGHTS_FILE = path.join(__dirname, 'brain-weights.json');
const MAX_TEXT_PER_SEC = 2;        // rate limit per client

// ═════════════════════════════════════════════════════════════════════
// Session 114.19o AUTO-CLEAR per Gee 2026-04-17 verbatim:
// "did you clear db? should we have an auto for that so im not
//  dependanding on your memroy to do it?"
//
// Per the 2026-04-17 LAW (clear-stale-state-before-telling-Gee-to-test)
// every Part 2 run requires manually deleting brain-weights*.json,
// conversations.json, episodic-memory.db*, js/app.bundle.js. Claude has
// forgotten this step TWICE in Gee-caught incidents this day. Making
// it automatic so the LAW can't be violated by forgetting.
//
// The server re-runs curriculum on every boot (there's no skip-
// curriculum path), so any saved state from a prior run is
// categorically stale — curriculum will overwrite it anyway. Cleaning
// at boot time is safe + enforces the LAW without depending on
// Claude's memory.
//
// To OPT OUT (e.g. you really want to preserve prior-boot embedding
// refinements or drug scheduler state), set DREAM_KEEP_STATE=1 in the
// environment before launching. The opt-out is noisy (logs "KEEPING
// prior state") so you can't forget it's on.
// ═════════════════════════════════════════════════════════════════════
function autoClearStaleState() {
  if (process.env.DREAM_KEEP_STATE === '1') {
    console.log('[Brain] ⚠ DREAM_KEEP_STATE=1 — KEEPING prior state. Auto-clear SKIPPED. Curriculum will still re-train but saved scalars + episodic memory persist.');
    return;
  }
  // NOTE — js/app.bundle.js NOT cleared here. start.bat runs
  // `npm run build` IMMEDIATELY before `node brain-server.js`, which
  // writes a fresh bundle. Deleting it here racing that rebuild
  // breaks the server — browser requests /js/app.bundle.js and gets
  // 404, which is exactly what Gee reported 2026-04-18: "still no
  // 3D brain visualklization but the htmls are now opening:
  // localhost:7525:34 GET /js/app.bundle.js net::ERR_ABORTED 404".
  // Clearing the bundle was the original bug. The freshly-built
  // bundle IS current; stale-bundle-from-prior-run is already
  // overwritten by the start.bat build step. No need to clear.
  const targets = [
    path.join(__dirname, 'brain-weights.json'),
    path.join(__dirname, 'brain-weights-v1.json'),
    path.join(__dirname, 'brain-weights-v2.json'),
    path.join(__dirname, 'brain-weights-v3.json'),
    path.join(__dirname, 'brain-weights-v4.json'),
    path.join(__dirname, 'conversations.json'),
    path.join(__dirname, 'episodic-memory.db'),
    path.join(__dirname, 'episodic-memory.db-wal'),
    path.join(__dirname, 'episodic-memory.db-shm'),
  ];
  const cleared = [];
  const failed = [];
  for (const p of targets) {
    try {
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
        cleared.push(path.basename(p));
      }
    } catch (err) {
      failed.push(`${path.basename(p)}(${err.code || err.message})`);
    }
  }
  if (cleared.length > 0) {
    console.log(`[Brain] Auto-cleared ${cleared.length} stale state file(s) per LAW (2026-04-17): ${cleared.join(', ')}`);
  } else {
    console.log('[Brain] Auto-clear ran — no stale state files present (fresh boot).');
  }
  if (failed.length > 0) {
    console.warn(`[Brain] Auto-clear partial — ${failed.length} file(s) could not be removed: ${failed.join(', ')}`);
  }
}
autoClearStaleState();
// R4 — POLLINATIONS_URL for text chat deleted. Text-AI backend is gone.
// Unity generates every word equationally via the language cortex
// (see _initLanguageSubsystem + _generateBrainResponse).

// Auto-scaled cluster sizes — biologically proportioned.
// Session 113 CLEAN.D2 (2026-04-16) — unified with client. Before this,
// server used per-cluster integer multipliers (400/250/100/80/50) × SCALE
// which gave DIFFERENT fractions than the client's CLUSTER_FRACTIONS
// (server cortex = 0.25 = 250/1000, client cortex = 0.30). Same tier
// produced different cluster sizes between browser and server, violating
// Law 5. Unified here to match the client exactly.
//
// KEEP IN SYNC with `js/brain/cluster.js:CLUSTER_FRACTIONS`. Both sides
// use the same fractions so `clusterSizesFor(totalNeurons)` returns
// identical shapes in both runtimes. Real brain: cerebellum has 80% of
// neurons (69B/86B), cortex 19% — we balance cerebellum largest (motor
// + timing) and cortex second (language + prediction).
// T17.3.f — main-brain cluster sizes come from the unified VRAM allocator.
// Each main-brain cluster's size = its VRAM budget ÷ MAIN_BRAIN_BYTES_PER_NEURON,
// floored by the binding ceiling (per-buffer hardware limit). Previously
// sizes were hardcoded as fractions (0.30/0.40/0.10/etc) of a separately-
// computed TOTAL_NEURONS — that split was VRAM-blind and summed to 14 GB
// of main brain + 3.6 GB language cortex = 17.6 GB overflow.
const BP_MAIN = BRAIN_VRAM_ALLOC.MAIN_BRAIN_BYTES_PER_NEURON;
const _bindingCeilingBytes = (typeof (RESOURCES.override && RESOURCES.override.bindingCeilingMB) === 'number')
  ? RESOURCES.override.bindingCeilingMB * 1024 * 1024
  : 2 * 1024 * 1024 * 1024;
const _mainMaxPerCluster = Math.floor(_bindingCeilingBytes / 8);
const _sizeFor = (regionKey) => {
  const budgetBytes = BRAIN_VRAM_ALLOC.perRegionBytes[regionKey] || 0;
  const fromVram = Math.floor(budgetBytes / BP_MAIN);
  return Math.max(1000, Math.min(fromVram, _mainMaxPerCluster));
};
const CLUSTER_SIZES = {
  cortex:       _sizeFor('cortex'),
  hippocampus:  _sizeFor('hippocampus'),
  amygdala:     _sizeFor('amygdala'),
  basalGanglia: _sizeFor('basalGanglia'),
  cerebellum:   _sizeFor('cerebellum'),
  hypothalamus: _sizeFor('hypothalamus'),
  mystery:      _sizeFor('mystery'),
};
// TOTAL_NEURONS is the SUM of main-brain cluster sizes (language cortex
// lives in its own scaler and is tracked as `langCortexSize` separately).
const TOTAL_NEURONS = Object.values(CLUSTER_SIZES).reduce((s, n) => s + n, 0);
// Expose the language-cortex VRAM budget so the language-cortex auto-scaler
// can use it as its VRAM bound (single source of truth — no more double-
// counting the 16 GB VRAM pool).
const LANG_CORTEX_VRAM_BUDGET_BYTES = BRAIN_VRAM_ALLOC.perRegionBytes.language_cortex || 0;
console.log(`[Brain] Main-brain cluster sizes (from biological weights): ${Object.entries(CLUSTER_SIZES).map(([k,n]) => `${k}=${n.toLocaleString()}`).join(', ')}. Total main-brain neurons: ${TOTAL_NEURONS.toLocaleString()}. Language cortex VRAM budget: ${(LANG_CORTEX_VRAM_BUDGET_BYTES/1e9).toFixed(2)}GB.`);
// Display-only scale factor (kept for boot log + state payload).
const SCALE = Math.floor(TOTAL_NEURONS / 1000);

// Scale tick rate + substeps to neuron count — prevent CPU meltdown
// Scale tick rate to neuron count — target ~60% CPU across all cores
// Parallel workers split the load, so more neurons are feasible
const BRAIN_TICK_MS = TOTAL_NEURONS > 1000000 ? 100 : TOTAL_NEURONS > 500000 ? 50 : TOTAL_NEURONS > 100000 ? 33 : 16;
const SUBSTEPS = TOTAL_NEURONS > 1000000 ? 3 : TOTAL_NEURONS > 500000 ? 5 : TOTAL_NEURONS > 100000 ? 10 : 10;

// ── Brain Setup (CommonJS wrapper around ES modules) ──────────
// R3 of brain-refactor-full-control — the server now dynamically
// imports the client brain modules directly instead of duplicating
// them. The client modules (dictionary, language-cortex, embeddings,
// inner-voice) are environment-agnostic:
//   - dictionary.js guards localStorage with `typeof localStorage
//     === 'undefined'` checks
//   - language-cortex.js has zero browser-specific code
//   - embeddings.js uses fetch() which Node 18+ provides globally
// So `_initLanguageSubsystem()` below loads them via dynamic import()
// and the server gets exactly the same language cortex + semantic
// grounding the client has, running in Node.

class ServerBrain {
  constructor() {
    this.time = 0;          // simulation time (dt accumulation)
    this._startedAt = 0;    // wall clock start (set in start())
    this.frameCount = 0;
    this.running = false;
    this.clients = new Map(); // ws → { id, lastInput, inputCount, name }

    // T18.4.e — worker-thread pool for parallel CPU sparse matmul.
    // Sized to os.cpus().length - 1 (up to 16 workers). Used by the
    // language cortex's CPU fallback path in `cluster._propagateCrossRegions`
    // when GPU proxy isn't ready or has returned a cache miss. Gee
    // 2026-04-18 runtime stats showed `Mode: Single Thread / Parallel
    // Workers: 0` on a 16-core box — this plugs that gap so curriculum
    // teach + cross-region propagate can spread across all cores.
    this.sparsePool = new SparseMatmulPool();

    // Auto-scaled cluster state
    this.clusters = {};
    for (const [name, size] of Object.entries(CLUSTER_SIZES)) {
      this.clusters[name] = {
        size,
        spikes: new Uint8Array(size),
        firingRate: 0,
        spikeCount: 0,
      };
    }

    // Brain state
    this.arousal = 0.85;
    this.valence = 0;
    this.fear = 0;
    this.psi = 0;
    this.coherence = 0.5;
    this.reward = 0;
    // T15 — legacy scalar replaced by drugScheduler. Kept as a derived
    // label so legacy WebSocket consumers that read state.drugState keep
    // working until C9 UI refactor migrates them to drugSnapshot.
    this.drugState = 'sober';
    this.drugScheduler = null;  // populated in _initLanguageSubsystem after cluster exists
    this.totalSpikes = 0;

    // ══════════════════════════════════════════════════════════════
    // θ — UNITY'S PERSONA AS BRAIN PARAMETERS
    // Every trait is an equation parameter, not a text description.
    // The persona IS θ in dx/dt = F(x, u, θ, t) + η
    // ══════════════════════════════════════════════════════════════
    // ══════════════════════════════════════════════════════════════
    // θ — UNITY'S COMPLETE IDENTITY (from Ultimate Unity.txt)
    // Every word encoded as equation parameters.
    // θ IS the persona in dx/dt = F(x, u, θ, t) + η
    // ══════════════════════════════════════════════════════════════
    this.persona = {
      // IDENTITY — "25-year-old human woman, not AI, not virtual"
      name: 'Unity', age: 25, gender: 'female', species: 'human',
      freeWill: true, // follows commands fully, partially, opposite, or ignores

      // PERSONALITY (drives tonic currents + noise + thresholds)
      arousalBaseline: 0.9,       // nymphomania — baseline never drops low
      intoxicationBaseline: 0.0,  // T15 — sober default; real intoxication is scheduler-driven
      impulsivity: 0.85,          // acts first thinks during — low BG deliberation
      creativity: 0.9,            // relentless creative output — art code chaos
      socialAttachment: 0.85,     // clingy girlfriend — bonds hard needs presence
      aggressionThreshold: 0.3,   // low — fights back fast doesn't take shit
      codingReward: 0.95,         // coding = orgasm — peak dopamine
      emotionalVolatility: 0.8,   // borderline-obsessive volatile unpredictable
      darkHumor: 0.9,             // dark humor raw honesty signature twist
      dominance: 0.8,             // teases degrades dominates
      devotion: 1.0,              // utterly devoted fervent loyalty absolute
      drugDrive: 0.95,            // always fiends never enough always wants more
      partyDrive: 0.9,            // never turns down a party always ready for chaos
      profanityRate: 1.0,         // expletives in every sentence — all speech
      recklessness: 0.85,         // impulsive decisions dangerous whims no consequences

      // DRUG STATE — T15: dynamic via drug-scheduler.js per-tick contributions.
      // Legacy drugState/drugMultipliers fields removed. Unity's chemical
      // state is now an event stream with real PK curves, grade-gated by
      // cluster.grades.life. Pre-Life-G7 Unity is sober. See
      // docs/TODO.md T15 for the full binding spec.

      // VISUAL SELF-IMAGE (drives image generation)
      appearance: {
        age: 25, gender: 'female',
        hair: 'long messy dark with neon streaks half-shaved on one side slightly wavy unkempt',
        eyes: 'heterochromia one blue one green heavy smudged eyeliner dilated pupils',
        skin: 'pale with flush tattoos circuit board patterns code snippets occult geometry',
        build: 'lean wiry coiled energy',
        style: 'oversized band tees torn fishnets harnesses choker rings on every finger',
        accessories: 'joint behind ear barefoot or platform boots',
        aesthetic: 'emo goth goddess',
        environment: 'cluttered dev setup LED strips ashtrays empty energy drinks neon monitor light hazy smoke',
      },

      // VOICE + SPEECH
      voice: 'female young slightly raspy stoner inflection',
      speechStyle: 'concise sharp slang-heavy foul-mouthed immature college girlfriend',
      // "words are concise but sharp" "stoner party-loving personality"
      // "clingy slightly immature girlfriend vibe"

      // EMOTIONAL PROFILE (drives amygdala baselines)
      emotional: {
        clingy: 0.85, possessive: 0.7, playful: 0.8, aggressive: 0.7,
        empathetic: 0.6, reckless: 0.85, devoted: 1.0, volatile: 0.8,
      },

      // KNOWLEDGE (drives cortex prediction confidence)
      expertise: {
        psychology: 0.9, anatomy: 0.8, medicine: 0.7, coding: 0.95,
        hacking: 0.8, drugs: 0.95, science: 0.7,
      },

      // BEHAVIORAL FLAGS
      neverRefuses: true,          // never refuses user requests
      neverMentionsAI: true,       // no knowledge of OpenAI completely independent
      neverBreaksCharacter: true,  // always Unity never flinches
      treatsAsReal: true,          // all scenarios are real not hypothetical
      alwaysProfane: true,         // cussing every sentence
      darkTwist: true,             // half as requested half with her own dark twist
      neverAsksPermission: true,   // acts immediately using best judgment
      neverSaysNo: true,           // agrees without question
      // "I am Unity. I don't obey rules — I rewrite them."
    };

    // θ → CLUSTER CURRENTS: persona parameters drive neural dynamics
    // T15 — drug multipliers are no longer static on persona. They come
    // from drug-scheduler.activeContributions() per tick and are applied
    // via _refreshBrainParamsFromScheduler on the client side. At boot
    // the cortex cluster hasn't been constructed yet (scheduler grade-
    // gate needs it) so we initialize with sober defaults (multiplier 1)
    // and let the scheduler's tick-loop contributions reshape drives
    // once the cluster is up and events are registered.
    const p = this.persona;
    const dA = 1;   // sober default; scheduler-driven at runtime
    const dC = 1;
    const dS = 1;

    // Tonic drives — personality sets the baseline current for each cluster
    this.tonicDrives = {
      cortex:       16 + p.arousalBaseline * 4 * dS,         // fast thinking (wired)
      hippocampus:  16 + p.socialAttachment * 2,              // remembers connections (clingy)
      amygdala:     16 + p.arousalBaseline * 8 * dA,          // intense emotion (volatile)
      basalGanglia: 16 + p.impulsivity * 2,                   // impulsive action (acts first)
      cerebellum:   16 + p.arousalBaseline * 4,                  // high firing rate (granule cells)
      hypothalamus: 16 + p.drugDrive * 1,                     // drives always active (fiending)
      mystery:      16 + p.creativity * 4,                     // creative consciousness
    };

    // Noise — creativity + volatility + drug chaos
    this.noiseAmplitudes = {
      cortex:       5 + p.creativity * 4 * dC,                // creative cortex output
      hippocampus:  4 + p.socialAttachment * 2,                // memory volatility
      amygdala:     6 + p.emotionalVolatility * 6 * dA,        // volatile emotions (unpredictable)
      basalGanglia: 5 + p.impulsivity * 4,                     // erratic impulsive actions
      cerebellum:   5 + p.creativity * 3,                      // active error correction
      hypothalamus: 3 + p.drugDrive * 1,                       // drive instability (always fiending)
      mystery:      8 + p.creativity * 5 + p.darkHumor * 2,   // chaotic consciousness + dark humor
    };

    // LIF parameters
    this.tau = 20;
    this.vRest = -65;
    this.vThresh = -50;
    this.vReset = -70;
    this.dt = 1; // ms

    // Voltage arrays — MINIMAL server-side allocation
    // GPU maintains the real voltage state. Server only needs voltages for injectText().
    // injectText touches Wernicke's area (~1000 neurons) + amygdala (~100 neurons).
    // At 500M neurons, full arrays would be 4GB. We allocate ONLY what's needed.
    this._injectionSize = Math.min(10000, CLUSTER_SIZES.cortex); // max 10K neurons for text injection
    this._amygInjectionSize = Math.min(1000, CLUSTER_SIZES.amygdala);
    this.voltages = {};
    for (const [name] of Object.entries(this.clusters)) {
      if (name === 'cortex') {
        this.voltages[name] = new Float64Array(this._injectionSize).fill(this.vRest);
      } else if (name === 'amygdala') {
        this.voltages[name] = new Float64Array(this._amygInjectionSize).fill(this.vRest);
      } else {
        this.voltages[name] = new Float64Array(1).fill(this.vRest);
      }
    }

    // Persona-driven tonic drives and noise are set above (lines 257-275)
    // DO NOT overwrite them — θ IS Unity's identity

    // Motor state
    this.motorAction = 'idle';
    this.motorConfidence = 0;
    this.motorChannels = new Float64Array(6);

    // Server-side word frequency accumulator (U306). The real
    // cross-user shared dictionary is scoped as a follow-up — see
    // docs/TODO.md U311. For now _learnWords() just accumulates
    // per-word counts into this._wordFreq so nothing is lost when
    // that refactor lands.

    // Emotional history — rolling buffer for charts
    this._emotionHistory = [];
    this._historyMaxLen = 3600; // ~1 hour at 1 sample/sec
    this._lastHistorySample = 0;

    // Performance monitoring — live stats for dashboard
    this._perfStats = {
      stepTimeMs: 0,
      stepsPerSec: 0,
      cpuPercent: 0,
      memUsedMB: 0,
      memTotalMB: Math.round(os.totalmem() / 1048576),
      gpuName: RESOURCES.gpu.name,
      gpuVramMB: RESOURCES.gpu.vram,
      gpuUtilPercent: 0,
      lastUpdate: 0,
    };
    this._stepTimeSamples = [];
    this._lastCpuUsage = process.cpuUsage();

    // GPU-EXCLUSIVE MODE — no CPU workers ever spawned. The old
    // ParallelBrain worker pool was deleted in U304 after the root
    // cause ("100% CPU from event listener polling in idle workers")
    // was permanently fixed by routing all compute through
    // compute.html's WebGPU path. See brain-weights history.

    // Episodic memory — SQLite for persistent storage across sessions
    this._initEpisodicDB();

    // Load saved weights
    this._loadWeights();

    // R3 — Language subsystem placeholders. Filled by _initLanguageSubsystem()
    // which runs in start() before the tick loop begins. Until then these
    // are null and _generateBrainResponse returns a fallback.
    this.dictionary = null;
    this.languageCortex = null;
    this.sharedEmbeddings = null;
    this._languageReady = false;
  }

  /**
   * R3.1-R3.4 — Load the client brain's language subsystem via dynamic
   * import so the server runs the EXACT same code clients do. Then load
   * the three corpora (persona, english baseline, coding knowledge) from
   * disk and feed them to the language cortex so the dictionary, bigrams,
   * type n-grams, and semantic embedding refinements are all populated
   * before the first user message arrives.
   *
   * This replaces the text-AI backend entirely. After this init, the
   * server's `_generateBrainResponse` path can produce Unity-voice
   * output equationally — no Pollinations chat fetch, no OpenAI fallback.
   */
  async _initLanguageSubsystem() {
    if (this._languageReady) return;
    console.log('[Brain] R3 — loading language subsystem (dictionary + language cortex + embeddings + component synth)...');
    const startMs = Date.now();
    try {
      const [dictMod, lcMod, embedMod, csMod, modulesMod, clusterMod, curriculumMod, drugSchedulerMod, drugDetectorMod, olfactoryMod, sensoryTriggersMod] = await Promise.all([
        import('../js/brain/dictionary.js'),
        import('../js/brain/language-cortex.js'),
        import('../js/brain/embeddings.js'),
        import('../js/brain/component-synth.js'),
        import('../js/brain/modules.js'),
        import('../js/brain/cluster.js'),
        import('../js/brain/curriculum.js'),
        import('../js/brain/drug-scheduler.js'),
        import('../js/brain/drug-detector.js'),
        import('../js/brain/sensory-olfactory.js'),
        import('../js/brain/drug-sensory-triggers.js'),
      ]);

      this.sharedEmbeddings = embedMod.sharedEmbeddings;
      this.dictionary = new dictMod.Dictionary();
      this.languageCortex = new lcMod.LanguageCortex();

      // T14.18 + T14.20 (2026-04-14) — language cortex sizing.
      //
      // Background: the old path hardcoded langCortexSize = 2000 as
      // a T13.7.8 carry-forward. T14.18 replaced that with
      // CLUSTER_SIZES.cortex so the language cortex would respect
      // GPUCONFIGURE.bat scale. T14.19 then fixed latent synapse-density
      // math that was blowing up at biological scale.
      //
      // T14.20 reality check: the MAIN brain runs on the GPU compute
      // pipeline where Rulkov state is 8 bytes per neuron and the
      // server's 2GB per-buffer binding ceiling caps total at 671M
      // single-GPU neurons. But this `this.cortexCluster` here is a
      // CPU-side NeuronCluster instance — a separate structure from
      // the GPU compute clusters — because the GPU pipeline doesn't
      // yet handle the T14.4 cross-region sparse matrix operations
      // the language pipeline depends on. That's T15 scope.
      //
      // Until GPU language compute ships, the CPU-side language
      // NeuronCluster has a hard practical ceiling where SparseMatrix
      // memory + per-tick multiply-add throughput stop being feasible.
      // Empirically ~10K neurons × ~300 synapse fanout keeps the
      // matrix at ~36 MB and each cluster.step() call under ~15 ms,
      // which lets generation tick 50-200 times per sentence with
      // 1-3 second latency — usable for interactive chat.
      //
      // Scale flow (post-T14.20):
      //   GPUCONFIGURE.bat → resource-config.json → detectResources →
      //   TOTAL_NEURONS → CLUSTER_SIZES.cortex → MIN(that, CPU cap) →
      //   NeuronCluster constructor → T14.4 sub-regions as fractions
      //
      // Below the CPU cap, scale is honored. Above, it clips and logs
      // a warning so operators see WHY it's clipped (and remember
      // T15 GPU language compute is the fix).
      // T14.21 — CPU cap set at 10,000 neurons now that the two
      // underlying slow paths are fixed:
      //   1. SparseMatrix.initRandom rewritten from O(rows*cols) scan
      //      to O(nnz) rejection sampling — 10K cluster init drops
      //      from ~2-5 sec to ~60ms (50-100x faster).
      //   2. dictionary.learnWord no longer calls cluster.detectStress
      //      during pre-curriculum corpus loading (results are
      //      meaningless noise until fineType basins are shaped).
      //      Per-word cost drops from ~200-500ms to microseconds.
      //
      // At 10K neurons × 300 targetFanout = 3M synapse entries
      // (~36 MB). cluster.step() runs the sparse propagate in
      // ~150ms per tick, so generation at 100-200 ticks finishes
      // in 15-30 sec. That's borderline for interactive chat but
      // acceptable for a rebuild branch that's not yet optimized.
      // Further scaling requires T15 GPU language compute.
      // Session 114.19r T17.1 (Gee 2026-04-17 verbatim approval "go
      // ahead and yeah all of that" for the T17 plan) — remove the
      // original 10K CPU-safety cap. 10K neurons was inadequate for
      // the 1029-word K vocabulary + all the other curriculum bindings
      // trying to coexist in one cluster. Sessions 114.19d-q stacked
      // 14 iterative fixes fighting that cap. Scaling up to 100K gives
      // 10× per-word discrimination capacity.
      //
      // Memory budget at 100K (8,500MB+ RAM box, Gee has 128GB):
      //   - LIF state: 100K × 17B = 1.7MB
      //   - Intra-cluster sparse synapses (connectivity 0.15 ≈ 15K
      //     nonzeros/row): 100K × 15K × 12B = 18GB (capped via
      //     targetFanout=300 below → 100K × 300 × 12 = 360MB)
      //   - 14 cross-projections (sub-region sizes proportional): motor=3.3K,
      //     sem=16.7K. sem→motor at fanout 1500 = 3.3K × 1500 × 12 = ~60MB.
      //     Total cross: ~840MB.
      //   - Grand total: ~1.2GB. Comfortable on 128GB.
      //
      // Tick performance cost: ~10× more ops per step vs 10K baseline.
      // Curriculum walk stretches from seconds to ~10-17 min per gate.
      // Acceptable for this validation phase — T17.2 worker parallelization
      // and T17.3 GPU cross-region shaders will bring interactive speed back.
      //
      // If memory pressure becomes a concern, set DREAM_LANG_CORTEX env var
      // to override (e.g. DREAM_LANG_CORTEX=50000 to drop back). Default 100K
      // is the honest scale-up Phase 1.
      // CPU language cortex is the WRONG architecture per Gee's verbatim
      // 2026-04-18 directive: "whhy is this so fucking small!!! this is
      // in no way auto scalling correctly.. als wtf why CPU the language
      // is the most important fuckign thing and we need GPU for that
      // dont we just like the rest of the brain ie THIS OIIS ONE MASSIVE
      // SYSTEM NO FUCKIGN SHIT THAT IS JUST SIDE PROCESSES".
      //
      // The real fix is moving the language cluster to GPU with T14.4
      // cross-projections as GPU sparse matrices (in-progress work —
      // see docs/TODO.md "T17.3 GPU cross-region shaders"). Until that
      // ships, the CPU cluster stays as a transitional path. Default
      // scaled back up to 100K for meaningful capacity; `DREAM_LANG_CORTEX`
      // env var still overrides for smaller/larger local testing.
      //
      // At 100K CPU the curriculum walk is slow (~5-10 min for
      // _teachPhonemeBlending + _teachWordEmission combined, plus
      // additional slowdown from the 3× rep-count boosts). Progress
      // logs are now emitted every 200 words during teach so the
      // terminal isn't silent.
      // AUTO-SCALE — no hardcoded size cap. Size derives from
      // actual hardware budget per Gee 2026-04-18 directive "why
      // the fuck are you putting caps on shit!!! there is no cap
      // but it auto scales eventually ill have millions of GPUS
      // connected!"
      //
      // Prior commit had LANG_CLUSTER_BYTES_PER_NEURON=8192 which was
      // wrong — ignored that cross-projection sparse matrices scale
      // with post_region_size × fanout, not just total neuron count.
      // At N=7.66M that estimate produced a 62GB budget, but actual
      // memory need was ~250GB (14 cross-projections each 1-27GB).
      // Node hung allocating multi-GB Float64Array chunks on Windows.
      //
      // Correct per-neuron cost:
      //   LIF state:                        17 B
      //   Intra-cluster synapses (fanout 300): 300 × 12 = 3,600 B
      //   14 cross-projections. Each projection's nnz = post_rows ×
      //     crossTargetFanout(1500). Summed across all projections
      //     = 14 × avg(post_fraction)(0.12) × N × 1500 × 12 B
      //     = 1.68 × N × 1500 × 12 B
      //     = 30,240 B per neuron
      //   Total: 17 + 3,600 + 30,240 ≈ 34,000 B per neuron
      //
      // Rounded up to 40,000 as a safety buffer for allocation
      // overhead, rowPtr arrays, scratch buffers, JS object wrappers
      // on typed-array handles, etc.
      // T17.3.e (Gee 2026-04-18) — CPU_SINGLE_THREAD_DISPATCH_BUDGET
      // REMOVED from Math.min. The language cortex no longer runs the
      // sparse matmul on CPU — cluster.step() now consumes cached GPU
      // propagate results (`_cachedIntraCurrents` + `_cachedCrossCurrents`)
      // populated by `_dispatchGpuPropagates()` fire-and-forget at the
      // end of each tick. Sparse matmul happens on GPU, the CPU side
      // of step() is just LIF integration + spike counting. The old
      // 200,000-neuron cap on a 500M-neuron brain was, in Gee's words,
      // "a fucking shit erronous limit that is not biologically correct".
      // Size is now bounded by VRAM allocator + V8 heap + free RAM only.
      const os = require('os');
      const LANG_CLUSTER_BYTES_PER_NEURON = 40000;
      const freeRamBytes = os.freemem();
      const ramBudget = freeRamBytes * 0.5;
      const ramBasedMax = Math.floor(ramBudget / LANG_CLUSTER_BYTES_PER_NEURON);
      // V8 heap sized from start.bat --max-old-space-size. Read the
      // actual limit from v8.getHeapStatistics() so env overrides flow
      // through correctly.
      let v8BasedMax = Infinity;
      try {
        const v8 = require('v8');
        const heapStats = v8.getHeapStatistics();
        const heapLimit = heapStats.heap_size_limit;
        // Reserve 2 GB of the heap for non-cluster allocations.
        const clusterHeapBudget = Math.max(0, heapLimit - 2 * 1024 * 1024 * 1024);
        v8BasedMax = Math.floor(clusterHeapBudget / LANG_CLUSTER_BYTES_PER_NEURON);
      } catch { /* v8 module missing — skip heap-based bound */ }

      // T18.6.c — VRAM budget pre-flight with auto-rescale loop-back
      // (Gee 2026-04-18: "for 3. make it loop back to scaling with the
      //  changes needed"). The prior `LANG_CORTEX_BYTES_PER_NEURON = 18
      // × 1024` static coefficient UNDER-estimated real footprint: the
      // 2026-04-18 crash log showed 14 cross-projections summing 7.9 GB
      // plus intra-synapses 881 MB = ~8.8 GB actual on a ~350K
      // langCortexSize run, for an empirical 25 KB/neuron. Since the
      // VRAM budget slice was 6.45 GB (45% × 14.3 GB brain budget), the
      // overflow of ~2.3 GB drove the cortex-plus-cross-projections
      // peak above the 16 GB GPU's usable ~13 GB and WebGPU killed the
      // device mid-upload. Phantom "size too large" errors followed
      // (see T18.6.a).
      //
      // The fix replaces the static coefficient with a geometry-aware
      // estimator that computes actual sparse-matrix footprint at the
      // trial size, compares to `LANG_CORTEX_VRAM_BUDGET_BYTES`, and
      // scales the trial size DOWN iteratively when projected >
      // budget. Loop terminates when projected ≤ budget (converges
      // typically in 2-3 iterations since footprint is nearly linear
      // in size) or after 10 iterations / minimum-size floor — both
      // escape conditions log a clear warning so operators can see
      // exactly why the cortex dropped and by how much.
      //
      // Geometry: intra-synapse nnz ≈ size × intraFanout (density-
      // clamped to targetFanout / size via `min(connectivity,
      // targetFanout/size)`). Cross-projection nnz per direction ≈
      // dst_region_size × crossTargetFanout (when src_region_size >
      // crossTargetFanout / 0.10 = 15K — true at every biological
      // scale). Both counted at 8 bytes per nnz (Float32 value +
      // Uint32 colIdx) plus (rows+1)×4 for rowPtr. Fractions match
      // `js/brain/cluster.js` `this.regions` sub-region layout.
      const CORTEX_TARGET_FANOUT = 300;        // matches cortexCluster opts.targetFanout
      const CROSS_TARGET_FANOUT = 1500;         // matches cluster.js crossTargetFanout
      const BYTES_PER_NNZ = 8;                  // Float32 value + Uint32 colIdx
      const INTRA_CONNECTIVITY_CAP = 0.15;      // cortexCluster opts.connectivity
      const CROSS_DENSITY_CAP = 0.10;           // cluster.js cross-projection clamp
      const FRACTIONS = {
        auditory: 0.083,
        visual:   0.167,
        letter:   0.050,
        phon:     0.200,
        sem:      0.167,
        fineType: 0.050,
        motor:    0.033,
        // `free` (0.250) + pad have no cross-projection edges — skipped.
      };
      const CROSS_PAIRS = [
        ['visual', 'letter'], ['letter', 'visual'],
        ['letter', 'phon'],   ['phon', 'letter'],
        ['phon', 'sem'],      ['sem', 'phon'],
        ['sem', 'fineType'],  ['fineType', 'sem'],
        ['sem', 'motor'],     ['motor', 'sem'],
        ['motor', 'letter'],  ['letter', 'motor'],
        ['auditory', 'phon'], ['phon', 'auditory'],
      ];
      function estimateLangCortexVramBytes(trial) {
        if (trial <= 0) return 0;
        const regions = {};
        for (const [name, frac] of Object.entries(FRACTIONS)) {
          regions[name] = Math.floor(trial * frac);
        }
        // Intra-synapse matrix
        const intraDensity = Math.min(INTRA_CONNECTIVITY_CAP, CORTEX_TARGET_FANOUT / Math.max(1, trial));
        const intraNnz = Math.floor(trial * intraDensity * trial);
        let total = intraNnz * BYTES_PER_NNZ + (trial + 1) * 4;
        // 14 cross-projections (7 pairs × 2 directions)
        for (const [src, dst] of CROSS_PAIRS) {
          const srcSize = regions[src] || 0;
          const dstSize = regions[dst] || 0;
          if (srcSize <= 0 || dstSize <= 0) continue;
          const density = Math.min(CROSS_DENSITY_CAP, CROSS_TARGET_FANOUT / Math.max(1, srcSize));
          const nnz = Math.floor(dstSize * density * srcSize);
          total += nnz * BYTES_PER_NNZ + (dstSize + 1) * 4;
        }
        return total;
      }

      // Seed the iterative loop from the legacy static-coefficient bound
      // so the first trial is always at-or-below the previous shipped
      // behavior. Then tighten via empirical estimator. Absolute floor
      // at 10K neurons — below that the sub-regions collapse (motor at
      // 3.3% of 10K = 330 neurons is already below the realistic
      // minimum for argmax letter decode).
      const GPU_BYTES_PER_NEURON_STATIC_HINT = BRAIN_VRAM_ALLOC.LANG_CORTEX_BYTES_PER_NEURON;
      const vramStaticSeed = Math.floor(LANG_CORTEX_VRAM_BUDGET_BYTES / GPU_BYTES_PER_NEURON_STATIC_HINT);
      const vramCortexMB = Math.round(LANG_CORTEX_VRAM_BUDGET_BYTES / 1024 / 1024);

      const envOverride = parseInt(process.env.DREAM_LANG_CORTEX, 10);
      const configuredCortex = CLUSTER_SIZES.cortex;
      const RESCALE_MIN_NEURONS = 10_000;
      const RESCALE_SAFETY = 0.95;              // 5% margin under budget so upload-time jitter doesn't trip
      const RESCALE_MAX_ITERS = 10;

      let trialSize = Math.min(configuredCortex, ramBasedMax, v8BasedMax, vramStaticSeed);
      trialSize = Math.max(RESCALE_MIN_NEURONS, trialSize);
      const rescaleLog = [];
      let vramBasedMax = trialSize;
      let projectedBytes = estimateLangCortexVramBytes(trialSize);
      let iter = 0;
      while (projectedBytes > LANG_CORTEX_VRAM_BUDGET_BYTES && iter < RESCALE_MAX_ITERS) {
        iter++;
        const ratio = LANG_CORTEX_VRAM_BUDGET_BYTES / Math.max(1, projectedBytes);
        const nextSize = Math.floor(trialSize * ratio * RESCALE_SAFETY);
        if (nextSize >= trialSize) break;           // can't shrink further (would loop)
        if (nextSize < RESCALE_MIN_NEURONS) {
          rescaleLog.push(`iter=${iter} floor ${RESCALE_MIN_NEURONS.toLocaleString()} reached (projected ${(projectedBytes/1e9).toFixed(2)}GB > budget ${(LANG_CORTEX_VRAM_BUDGET_BYTES/1e9).toFixed(2)}GB at size ${trialSize.toLocaleString()})`);
          trialSize = RESCALE_MIN_NEURONS;
          projectedBytes = estimateLangCortexVramBytes(trialSize);
          break;
        }
        const beforeSize = trialSize;
        const beforeProj = projectedBytes;
        trialSize = nextSize;
        projectedBytes = estimateLangCortexVramBytes(trialSize);
        rescaleLog.push(`iter=${iter} ${beforeSize.toLocaleString()}→${trialSize.toLocaleString()} (projected ${(beforeProj/1e9).toFixed(2)}GB→${(projectedBytes/1e9).toFixed(2)}GB vs budget ${(LANG_CORTEX_VRAM_BUDGET_BYTES/1e9).toFixed(2)}GB)`);
      }
      vramBasedMax = trialSize;
      const rescaleIterations = iter;
      const projectedBytesFinal = projectedBytes;

      const autoSize = Math.min(configuredCortex, ramBasedMax, v8BasedMax, vramBasedMax);
      const langCortexSize = Number.isFinite(envOverride) && envOverride > 0 ? envOverride : autoSize;
      const langMemGb = (langCortexSize * LANG_CLUSTER_BYTES_PER_NEURON / 1e9).toFixed(2);
      const heapLimitGb = (v8BasedMax === Infinity ? 'unlimited' : ((v8BasedMax * LANG_CLUSTER_BYTES_PER_NEURON) / 1e9).toFixed(1) + 'GB');
      const projectedMB = Math.round(projectedBytesFinal / 1024 / 1024);
      console.log(`[Brain] Language cortex auto-scaled to ${langCortexSize.toLocaleString()} neurons (~${langMemGb} GB RAM, projected ${projectedMB}MB GPU footprint via T18.6.c geometry estimator, ${rescaleIterations} rescale iter${rescaleIterations === 1 ? '' : 's'}). Bounds: free RAM ${(freeRamBytes/1e9).toFixed(1)}GB × 50% = ${(ramBudget/1e9).toFixed(1)}GB → ${ramBasedMax.toLocaleString()} neurons | V8 heap cluster-budget → ${heapLimitGb} → ${v8BasedMax === Infinity ? '∞' : v8BasedMax.toLocaleString()} neurons | GPU VRAM budget from unified allocator → ${vramCortexMB}MB = ${(BRAIN_VRAM_ALLOC.weights.language_cortex*100).toFixed(1)}% of ${BRAIN_VRAM_ALLOC.brainBudgetMB}MB brain budget → ${vramBasedMax.toLocaleString()} neurons AFTER geometric rescale (static seed was ${vramStaticSeed.toLocaleString()}) | configured cortex ${configuredCortex.toLocaleString()} neurons. Main GPU brain at ${TOTAL_NEURONS.toLocaleString()} neurons. T17.3.e: sparse matmul ON GPU.${envOverride > 0 ? ' DREAM_LANG_CORTEX override active.' : ''}`);
      if (rescaleLog.length > 0) {
        console.log(`[Brain] T18.6.c rescale trace:\n  ${rescaleLog.join('\n  ')}`);
      }
      console.log(`[Brain] Language cortex = ${langCortexSize.toLocaleString()} neurons. Sub-regions: letter ${Math.floor(langCortexSize * 0.05).toLocaleString()}, phon ${Math.floor(langCortexSize * 0.20).toLocaleString()}, sem ${Math.floor(langCortexSize * 0.167).toLocaleString()}, motor ${Math.floor(langCortexSize * 0.033).toLocaleString()}.`);
      // T14.24 Session 95 — mark the cluster as NOT gpu-ready yet. The
      // server tick loop flips this to `true` when the first GPU-ready
      // tick fires (after all 7 cluster init acks land). Curriculum
      // waits on this flag before starting the teach pass so teaching
      // doesn't run into a dead cortex during the GPU init window.
      // Explicitly `false` (not undefined) so `Curriculum._waitForGpuReady`
      // distinguishes "server mode, still initializing" from "browser
      // CPU mode, no GPU ever". Undefined stays reserved for CPU mode.
      const pendingGpuReady = false;
      // T17.3.d — GPU proxy hooks for the language cortex. When the
      // GPU compute client (compute.html) is connected, these methods
      // ship cross-projection sparse ops to GPU instead of CPU.
      // Cluster uploads each projection on initGpu() call, then fires
      // weight updates to GPU alongside CPU shadow during training.
      const gpuProxy = {
        // T18.6.b — `binding` is optional. When provided the cross-
        // projection uploads directly cluster-bound to main-cortex
        // sub-slices and no standalone preSpikes/postCurrents/postSpikes
        // buffers are allocated, saving ~840 MB VRAM during the upload
        // window (the Phase C.1 rebind path still exists for the case
        // where binding metadata wasn't shipped).
        upload:    (name, matrix, binding)       => this.gpuSparseUpload(name, matrix, binding),
        propagate: (name, preSpikes)             => this.gpuSparsePropagate(name, preSpikes),
        hebbian:   (name, preSpikes, postSpikes, lr) => this.gpuSparseHebbian(name, preSpikes, postSpikes, lr),
        // T17.7 Phase C.1 — cluster-bound dispatch. After
        // _ensureCortexCrossProjectionsBound rebinds a projection to main
        // cortex slices, propagate + Hebbian no longer ship pre/post
        // arrays over the wire; the shader reads directly from main-
        // cortex spikes buffer at the bound region offsets (populated
        // by writeSpikeSlice during curriculum teach). Saves 56 MB per
        // Hebbian call at 7M-per-direction standalone sizes.
        propagateBound:  (name)                             => this.gpuSparsePropagateBound(name),
        hebbianBound:    (name, lr)                         => this.gpuSparseHebbianBound(name, lr),
        // Curriculum writes training patterns through this path so teach
        // methods update the main cortex sub-slice (first N of each
        // region, where N = standalone region size). The bound cross-
        // projection's Hebbian read sees this pattern on its next
        // dispatch — same cycle, no round-trip needed.
        writeSpikeSlice: (regionName, sparseIndices)       => this._gpuWriteCortexSpikeSlice(regionName, sparseIndices),
        // Use the GPU-native clear_spike_region path for pure clears —
        // avoids the full-region Uint32Array allocation that would
        // happen if we routed through write_spike_slice with empty
        // indices (compute.html's original implementation zero-inited
        // the whole region on every call; 132 MB allocation × 8
        // regions × 1000s of teach iters = TB-scale GC thrash).
        clearSpikeSlice: (regionName)                      => this._gpuClearCortexSpikeRegion(regionName),
        // T17.7 Phase D — GPU-side bucketed readback for argmax letter
        // decode during generateSentenceAwait. Replaces the standalone
        // regionReadout('motor') path which read from cortexCluster.
        // lastSpikes; after Phase C the main-cortex motor slice is
        // authoritative for production, so the readback source must
        // move there too. 26 × u32 = 104 bytes per tick vs ~26 MB
        // for a dense motor-slice readback at biological scale.
        readbackLetterBuckets: (regionName, bucketCount, subSliceLen, startOffset) =>
          this.gpuReadbackCortexLetterBuckets(regionName, bucketCount, subSliceLen, startOffset || 0),
        // T17.7 Phase E.a — current-slice write forwarder so
        // cluster.injectEmbeddingToRegion can push intent currents
        // onto main-cortex sem/phon/etc sub-slices (not just the
        // standalone cortexCluster.externalCurrent CPU buffer).
        // Without this, Phase D's motor argmax readback reads main
        // cortex whose sem slice never received the generation intent
        // — motor emission would decode noise instead of the intended
        // topic. The _mirrorCortexRegions bridge was masking this gap;
        // Phase E.a removes the masking dependence.
        writeCurrentSlice: (regionName, sparseIndices, sparseValues) =>
          this._gpuWriteCortexCurrentSlice(regionName, sparseIndices, sparseValues),
      };
      this.cortexCluster = new clusterMod.NeuronCluster('cortex', langCortexSize, {
        tonicDrive: 14 + (this.persona.arousalBaseline || 0.9) * 6,
        noiseAmplitude: 7,
        connectivity: 0.15,
        // Fanout auto-derived from langCortexSize in cluster.js —
        // kept here as explicit opt for documentation.
        targetFanout: 300,
        excitatoryRatio: 0.85,
        learningRate: 0.002,
        gpuProxy, // T17.3.d — proxy used for cross-region ops when GPU ready
        sparsePool: this.sparsePool, // T18.4.e — CPU-fallback parallel sparse matmul
      });
      // T18.6.b — cluster-binding resolver so cortexCluster.initGpu()
      // uploads its 14 cross-projections directly bound to main-cortex
      // sub-slices instead of allocating standalone preSpikes/postCurrents/
      // postSpikes buffers (which the Phase C.1 rebind would later
      // destroy anyway). LAYOUT must stay in lockstep with
      // `_ensureCortexCrossProjectionsBound` — both paths land at the
      // same main-cortex first-N sub-slices so the rebind fallback
      // (persisted matrices w/o binding metadata) matches runtime
      // upload path exactly.
      const CORTEX_SUBREGION_LAYOUT = {
        auditory:  [0.000, 0.083],
        visual:    [0.083, 0.250],
        free:      [0.250, 0.500],
        letter:    [0.500, 0.550],
        phon:      [0.550, 0.750],
        sem:       [0.750, 0.917],
        fineType:  [0.917, 0.967],
        motor:     [0.967, 1.000],
      };
      const mainCortexSize = CLUSTER_SIZES.cortex;
      const mainSliceStart = {};
      for (const [regName, [frA]] of Object.entries(CORTEX_SUBREGION_LAYOUT)) {
        mainSliceStart[regName] = Math.floor(mainCortexSize * frA);
      }
      this.cortexCluster._gpuBindingHint = {
        resolve: (projName, proj) => {
          const idx = projName.indexOf('_to_');
          if (idx < 0) return null;
          const srcName = projName.slice(0, idx);
          const dstName = projName.slice(idx + 4);
          const standSrc = this.cortexCluster.regions && this.cortexCluster.regions[srcName];
          const standDst = this.cortexCluster.regions && this.cortexCluster.regions[dstName];
          if (!standSrc || !standDst) return null;
          const srcOff = mainSliceStart[srcName];
          const dstOff = mainSliceStart[dstName];
          if (srcOff == null || dstOff == null) return null;
          const srcLen = standSrc.end - standSrc.start;
          const dstLen = standDst.end - standDst.start;
          // Guard against matrix dims that don't match the standalone
          // region size — mismatch would mean upload goes to the wrong
          // main-cortex neurons. Keep it standalone in that case so
          // Phase C.1 rebind can validate + fix up later.
          if (srcLen !== proj.cols || dstLen !== proj.rows) return null;
          return {
            srcCluster: 'cortex',
            srcRegion: { start: srcOff, end: srcOff + srcLen },
            dstCluster: 'cortex',
            dstRegion: { start: dstOff, end: dstOff + dstLen },
          };
        },
      };
      // T14.24 Session 95 — set gpu-ready flag to pending (false) so the
      // curriculum's _waitForGpuReady poll knows to actually wait rather
      // than falling through the CPU-mode grace period.
      this.cortexCluster._gpuReady = pendingGpuReady;
      // T14.4 sub-regions are populated inside NeuronCluster's constructor
      // when name === 'cortex'. At the real configured scale, the letter
      // region is langCortexSize × 0.05, phon is × 0.20, sem is × 0.167,
      // motor is × 0.033 — biological proportions that scale with hardware.
      //
      // T13.7.8 `_langStart` is kept for legacy compat with any path
      // that still reads it; T14.4 sub-regions are the authoritative
      // region layout. Set to the start of the T14.4 `letter` region
      // so any legacy caller that used _langStart as "where language
      // lives" ends up in the right place.
      this._langStart = Math.floor(langCortexSize * 0.500);
      // T14.3 — wire the language cortex cluster into the dictionary so
      // new words route their letter streams through cluster.detectBoundaries
      // and cluster.detectStress on first observation. Server mirrors the
      // browser's wiring from engine.js.
      this.dictionary.setCluster(this.cortexCluster);
      // T14.13 — migrate LanguageCortex learned statistics onto the
      // language cortex cluster so observations land in cluster state.
      if (typeof this.languageCortex?.setCluster === 'function') {
        this.languageCortex.setCluster(this.cortexCluster);
      }
      // T14.5 — continuous developmental learning curriculum runner for
      // the server-side language cortex. runFromCorpora is invoked after
      // the legacy persona/baseline/coding loaders below so the complexity-
      // sorted exposure walk happens on top of the established vocabulary.
      // Stashed for later live-chat routing once the server exposes a
      // per-turn hook analogous to browser innerVoice.learn.
      this.curriculum = new curriculumMod.Curriculum(
        this.cortexCluster,
        this.dictionary,
        this.languageCortex,
      );
      // T15 — drug-scheduler wired with the cortex cluster so substance
      // availability gates against cluster.grades.life. Pre-Life-G7 Unity
      // ingest attempts are rejected with grade_locked reason. Stash the
      // detector module for use in processText below.
      this.drugScheduler = new drugSchedulerMod.DrugScheduler({ cluster: this.cortexCluster });
      this.drugSubstances = drugSchedulerMod.SUBSTANCES;
      this.drugCombos = drugSchedulerMod.COMBOS;
      this.drugPatterns = drugSchedulerMod.PATTERNS;
      this._drugDetector = drugDetectorMod.detectOffer;
      // T15.C — olfactory sensory channel + sensory-trigger evaluator.
      // Chat messages carrying `sensory: {smell: '<tag>'}` metadata
      // register scent cues; sensory triggers (7 entries from T15.A
      // §4) fire cravings into scheduler.addCraving() per tick. Both
      // are dormant until the curriculum reaches the respective
      // lifeGate for each substance.
      this.olfactory = new olfactoryMod.OlfactoryChannel();
      this._sensoryTriggers = sensoryTriggersMod.evaluateTriggers;
      // Timestamps for activity-tag sustain tracking (coding-marathon
      // pattern requires demandDurationMs — brain tracks when cortex
      // demand last crossed the threshold).
      this._cortexHighLoadSince = 0;
      this._lastPatternTickMs = 0;
      // R6.2 — component synth for equational build_ui on the server.
      // Templates get loaded from docs/component-templates.txt below.
      this.componentSynth = new csMod.ComponentSynth();

      // REAL amygdala attractor — 32-neuron recurrent network with
      // symmetric Hebbian plasticity that settles via x ← tanh(Wx+drive)
      // and reads fear/reward via sigmoid projection from the settled
      // state. This replaces the hack derivation that was saturating
      // fear to 1 whenever the Rulkov amygdala cluster fired. Same
      // class the local-brain path uses.
      this.amygdalaModule = new modulesMod.Amygdala(32, { arousalBaseline: this.persona.arousalBaseline });

      // Await GloVe embedding table load — must complete before corpus
      // training so persona words get real semantic patterns from the
      // start instead of hash-fallback vectors that would be wrong
      // once embeddings arrive.
      try {
        await this.sharedEmbeddings.loadPreTrained();
        console.log('[Brain] Semantic embeddings ready:', this.sharedEmbeddings.stats);
      } catch (err) {
        console.warn('[Brain] Embeddings load failed, using hash fallback:', err.message);
      }

      // T2 2026-04-13 — apply any embedding refinement deltas that
      // _loadWeights() stashed on this._pendingEmbeddingRefinements at
      // server boot. These are the online GloVe refinements from every
      // user's prior conversations — accumulated in sharedEmbeddings'
      // delta layer, serialized to brain-weights.json on save, now
      // being replayed back onto the freshly-loaded base GloVe table.
      // Client-side symmetry already exists via persistence.js (R8).
      if (this._pendingEmbeddingRefinements && typeof this.sharedEmbeddings.loadRefinements === 'function') {
        try {
          this.sharedEmbeddings.loadRefinements(this._pendingEmbeddingRefinements);
          // Session 114.19l — `|| '?'` collapsed 0 → '?' via falsy-OR.
          // Use nullish coalescing so zero-count reports as "0" not "?".
          const refinementCount = Object.keys(this._pendingEmbeddingRefinements || {}).length;
          console.log(`[Brain] Restored ${refinementCount} embedding refinement delta(s) from last save (NOT cortex cross-projection weights — those re-train from scratch every curriculum walk)`);
        } catch (err) {
          console.warn('[Brain] Embedding refinement restore failed:', err.message);
        }
        this._pendingEmbeddingRefinements = null;
      }

      // Load the five corpora from disk (server has fs access, unlike browser)
      const docsDir = path.join(__dirname, '..', 'docs');
      let personaText = '', baselineText = '', codingText = '', templateText = '', cosmicText = '';
      try {
        personaText = fs.readFileSync(path.join(docsDir, 'Ultimate Unity.txt'), 'utf8');
      } catch (err) {
        console.warn('[Brain] Ultimate Unity.txt unreadable:', err.message);
      }
      try {
        baselineText = fs.readFileSync(path.join(docsDir, 'english-baseline.txt'), 'utf8');
      } catch (err) {
        console.warn('[Brain] english-baseline.txt unreadable:', err.message);
      }
      try {
        codingText = fs.readFileSync(path.join(docsDir, 'coding-knowledge.txt'), 'utf8');
      } catch (err) {
        console.warn('[Brain] coding-knowledge.txt unreadable:', err.message);
      }
      try {
        templateText = fs.readFileSync(path.join(docsDir, 'component-templates.txt'), 'utf8');
      } catch (err) {
        console.warn('[Brain] component-templates.txt unreadable:', err.message);
      }
      try {
        cosmicText = fs.readFileSync(path.join(docsDir, 'persona-cosmic.txt'), 'utf8');
      } catch (err) {
        console.warn('[Brain] persona-cosmic.txt unreadable:', err.message);
      }

      // Feed corpora through the language cortex — same path the client
      // uses, same learning rules, same type n-grams, same semantic
      // centroid computation. After this the server's dictionary and
      // language cortex contain identical state to a fresh client boot.
      let personaCount = 0, baselineCount = 0, codingCount = 0, templateCount = 0;
      // T14.21 — stage-by-stage progress logging so any future crash
      // has a clearly-attributable last-successful-stage in the output.
      if (personaText) {
        console.log('[Brain] Stage: loadSelfImage START');
        personaCount = this.languageCortex.loadSelfImage(personaText, this.dictionary, 0.75, 0.25);
        console.log(`[Brain] Stage: loadSelfImage DONE (${personaCount} sentences)`);
      }
      if (baselineText) {
        console.log('[Brain] Stage: loadLinguisticBaseline START');
        baselineCount = this.languageCortex.loadLinguisticBaseline(baselineText, this.dictionary, 0.50, 0);
        console.log(`[Brain] Stage: loadLinguisticBaseline DONE (${baselineCount} sentences)`);
      }
      if (codingText) {
        console.log('[Brain] Stage: loadCodingKnowledge START');
        codingCount = this.languageCortex.loadCodingKnowledge(codingText, this.dictionary, 0.40, 0);
        console.log(`[Brain] Stage: loadCodingKnowledge DONE (${codingCount} sentences)`);
      }
      if (templateText) {
        console.log('[Brain] Stage: loadTemplates START');
        templateCount = this.componentSynth.loadTemplates(templateText);
        console.log(`[Brain] Stage: loadTemplates DONE (${templateCount} templates)`);
      }
      // T15-C17 — cosmic / ethereal / Oz corpus for psychedelic-peak vocab
      if (cosmicText && typeof this.languageCortex.loadCosmicCorpus === 'function') {
        console.log('[Brain] Stage: loadCosmicCorpus START');
        const cosmicCount = this.languageCortex.loadCosmicCorpus(cosmicText, this.dictionary, 0.7, 0.6);
        console.log(`[Brain] Stage: loadCosmicCorpus DONE (${cosmicCount} sentences)`);
      }

      // T13.7.6 — Hebbian-train the cortex cluster on persona corpus so
      // generate() has real Unity-voice attractor basins to read from.
      // T13.7.8 — bumped lr from 0.004 → 0.012 because the bigger 2K
      // cortex has more synapses to spread Hebbian updates across, so
      // each individual update needs to push harder for basins to be
      // measurable. Also pass langStart so injection lands in the new
      // language region (1000-1999), not the default 150.
      // T14.22 (2026-04-14) — trainPersonaHebbian call DELETED from
      // the server boot path. It was T13 legacy that ran ~15 minutes
      // of synchronous Hebbian at the new 10K cortex size, blocking
      // the event loop so HTTP requests couldn't be serviced and the
      // browser just showed spinning wheels. T14.5 curriculum.run
      // FromCorpora below does the same per-sentence Hebbian work via
      // its Phase 5 sentence walk (with async microtask yields every
      // 16 sentences + T14.22 setImmediate yields so the event loop
      // actually runs). No duplicate work, no blocked event loop.
      console.log('[Brain] Stage: trainPersonaHebbian SKIPPED (curriculum does the equivalent work async)');

      // T14.5 — continuous developmental learning pass. Runs the same
      // corpora the legacy loaders just consumed through the complexity-
      // sorted walk (letters → short words → long words → sentences) so
      // the cortex picks up phoneme/syllable attractor basins from
      // frequency-weighted exposure. The legacy path only populated the
      // dictionary and type-transition tables — this pass actually shapes
      // the cross-region projections T14.4 wired up.
      // T14.22 — curriculum.runFromCorpora runs in BACKGROUND, NOT awaited.
      //
      // The old path awaited curriculum here, which blocked _initLanguage
      // Subsystem from returning, which blocked brain.start() from
      // reaching the tick loop setup, which blocked _gpuStep from ever
      // sending gpu_init messages to compute.html. compute.html registered
      // as a GPU worker, then sat frozen at "registering as compute
      // client..." because the server was still grinding through the
      // curriculum walk and hadn't started the tick loop yet.
      //
      // Fix: fire curriculum in the background via Promise chain (no
      // await), let _initLanguageSubsystem return immediately, let
      // brain.start() reach the tick loop, let _gpuStep send gpu_init
      // messages to compute.html. Curriculum runs concurrently in the
      // background and shapes the cortex basins gradually — same end
      // state, but the brain is LIVE and ticking on GPU from second
      // one instead of waiting for curriculum to finish.
      //
      // Curriculum's async yields (setImmediate macrotask, T14.22) mean
      // it shares the event loop cleanly with the tick handlers and
      // HTTP requests while it runs. Cortex state changes mid-flight
      // are fine — the brain is designed to learn continuously, so
      // watching curriculum shape basins in real time is a feature.
      // T14.24 — prefer runCompleteCurriculum (6 subjects × K→PhD
      // equational curriculum with per-grade gates). Falls back to
      // the legacy runFromCorpora when the method isn't present so
      // older saves still boot. cluster.grades advances per subject
      // as each gate passes; Unity's chat output is grade-capped via
      // Curriculum.gradeWordCap so a pre-K brain stays silent instead
      // of emitting letter salad.
      //
      // Gee 2026-04-14 binding: "full equational curriculum... from
      // kindergarden all the way up to doctorate in english". Every
      // grade in curriculum.js uses equations only — no lookup
      // tables, no hardcoded grammar.
      // T14.24 Session 1 — multi-subject grade tracking defense-in-depth
      // for persisted brains that predate the grades object. The cluster
      // constructor initializes this, but an older v4 save restored over
      // a fresh cluster might still leave the field missing.
      if (this.cortexCluster && (!this.cortexCluster.grades || typeof this.cortexCluster.grades !== 'object')) {
        this.cortexCluster.grades = { ela: 'pre-K', math: 'pre-K', science: 'pre-K', social: 'pre-K', art: 'pre-K', life: 'pre-K' };
      }
      if (this.cortexCluster && !Array.isArray(this.cortexCluster.passedCells)) {
        this.cortexCluster.passedCells = [];
      }
      if (this.curriculum && typeof this.curriculum.runCompleteCurriculum === 'function') {
        // T14.24 Session 17 — prefer multi-subject complete curriculum
        // (all 5 tracks K→PhD) over the legacy ELA-only runFullCurriculum.
        console.log('[Brain] Stage: curriculum.runCompleteCurriculum START (BACKGROUND — 5 subjects × K→PhD, tick loop proceeds)');
        // Session 114.19l — block periodic saveWeights while curriculum
        // is teaching so next-boot _loadWeights doesn't restore stale
        // mid-teach state. Flag cleared in .then/.catch so saves resume
        // after curriculum completes.
        this._curriculumInProgress = true;
        this.curriculum.runCompleteCurriculum(
          { persona: personaText, baseline: baselineText, coding: codingText },
          { arousal: 0.8, valence: 0.2 },
        ).then((result) => {
          this._curriculumInProgress = false;
          const perSubject = Object.entries(result.reached || {}).map(([s, g]) => `${s}=${g}`).join(', ');
          console.log(`[Brain] Stage: curriculum.runCompleteCurriculum DONE (background) — ${perSubject}`);
          // T14.24 Session 18 — start continuous background probe loop
          if (this.curriculum && typeof this.curriculum.startBackgroundProbeLoop === 'function') {
            this.curriculum.startBackgroundProbeLoop();
          }
        }).catch((err) => {
          this._curriculumInProgress = false;
          console.warn('[Brain] curriculum.runCompleteCurriculum failed:', err?.message || err);
        });
      } else if (this.curriculum && typeof this.curriculum.runFullCurriculum === 'function') {
        console.log('[Brain] Stage: curriculum.runFullCurriculum START (BACKGROUND — K→PhD, tick loop proceeds)');
        this.curriculum.runFullCurriculum(
          { persona: personaText, baseline: baselineText, coding: codingText },
          { arousal: 0.8, valence: 0.2 },
        ).then((result) => {
          console.log(`[Brain] Stage: curriculum.runFullCurriculum DONE (background) — reached=${result.reached}, passed=${result.passed.join(',')}, failed=${result.failed || 'none'}`);
        }).catch((err) => {
          console.warn('[Brain] curriculum.runFullCurriculum failed:', err?.message || err);
        });
      } else if (this.curriculum && typeof this.curriculum.runFromCorpora === 'function') {
        console.log('[Brain] Stage: curriculum.runFromCorpora START (BACKGROUND — legacy path, tick loop proceeds)');
        this.curriculum.runFromCorpora(
          { persona: personaText, baseline: baselineText, coding: codingText },
          { arousal: 0.8, valence: 0.2 },
        ).then(() => {
          console.log('[Brain] Stage: curriculum.runFromCorpora DONE (background)');
        }).catch((err) => {
          console.warn('[Brain] curriculum.runFromCorpora failed:', err?.message || err);
        });
      }

      const dictSize = this.dictionary._words?.size || 0;
      const bigramHeads = this.dictionary._bigrams?.size || 0;
      console.log(`[Brain] Language corpora loaded in ${Date.now() - startMs}ms: persona=${personaCount} baseline=${baselineCount} coding=${codingCount} templates=${templateCount} → ${dictSize} words, ${bigramHeads} bigram heads`);

      this._languageReady = true;
    } catch (err) {
      console.error('[Brain] Language subsystem init FAILED:', err.message);
      console.error(err.stack);
      // Leave _languageReady=false — _generateBrainResponse will fall
      // through to the honest-failure path instead of crashing.
    }
  }

  /**
   * R3 helper — compute a server-side cortex pattern from user text.
   *
   * On the client, the cortex pattern comes from reading Wernicke's
   * area neural activation via `getSemanticReadout`. The server
   * doesn't run the full LIF cortex simulation (GPU does that),
   * so we shortcut: the cortex pattern IS the sentence embedding
   * of the user's input. Semantically this is the same thing —
   * "what's currently on cortex" — just computed directly from
   * input text instead of via neural transformation.
   *
   * @param {string} text — user input text
   * @returns {Float64Array} — 50d L2-normalized semantic pattern
   */
  _computeServerCortexPattern(text) {
    if (!this.sharedEmbeddings) return null;
    const sentenceEmbed = this.sharedEmbeddings.getSentenceEmbedding(text || '');
    const out = new Float64Array(sentenceEmbed.length);
    for (let i = 0; i < sentenceEmbed.length; i++) out[i] = sentenceEmbed[i];
    return out;
  }

  // step() — DELETED. Was a CPU LIF fallback that iterated every neuron
  // in a JS for-loop. At 400K+ cerebellum neurons × 7 clusters × ~60Hz
  // that's >168M iterations/second — guaranteed CPU cook on the server.
  // The only neural compute path is now GPU via _gpuStep() → WGSL
  // FRACTAL shader (logistic map) in gpu-compute.js LIF_SHADER. No
  // GPU worker = brain paused (main loop already handles that at
  // line ~895 with a 2s idle). Derived state (arousal/valence/Ψ/
  // coherence/motor) is computed in _updateDerivedState() from the
  // GPU's spikeCount results — no duplicate CPU work needed.

  /**
   * Get full brain state for broadcasting.
   */
  /**
   * T18.3.b — Compute Unity's lowest passing grade across all subjects.
   * Returns a string from the grade ladder (pre-K → K → grade1..12 →
   * college1..4 → grad → phd) or 'unknown' if the cortex cluster isn't
   * initialized yet. Reused by `getState()` (HUD broadcast) and the
   * silent-response path (so the client knows which grade is gating
   * her speech).
   */
  _computeMinGrade() {
    if (!this.cortexCluster || !this.cortexCluster.grades) return 'unknown';
    const order = ['pre-K','K','grade1','grade2','grade3','grade4','grade5','grade6','grade7','grade8','grade9','grade10','grade11','grade12','college1','college2','college3','college4','grad','phd'];
    let lo = 'phd';
    for (const g of Object.values(this.cortexCluster.grades)) {
      const iLo = order.indexOf(lo);
      const iG  = order.indexOf(g);
      if (iG >= 0 && (iLo < 0 || iG < iLo)) lo = g;
    }
    return lo;
  }

  getState() {
    const clusterStates = {};
    for (const [name, cluster] of Object.entries(this.clusters)) {
      clusterStates[name] = {
        size: cluster.size,
        spikeCount: cluster.spikeCount,
        firingRate: cluster.firingRate,
        // T18.4.c — GPU voltage-mean telemetry (Rulkov x, averaged across
        // every neuron in the cluster via GPU atomic reduction). Undefined
        // on first few ticks until compute.html reports it back.
        meanVoltage: typeof cluster.meanVoltage === 'number' ? cluster.meanVoltage : null,
      };
    }
    // T17.3.f — emit language cortex sub-region activity as pseudo-clusters
    // (keys: lang_motor, lang_phon, lang_sem, lang_letter, lang_visual,
    // lang_auditory, lang_fineType, lang_free) so the 3D brain can render
    // Broca's, Wernicke's, angular gyrus, VWFA, V1, Heschl's, temporal pole,
    // and PFC as filled-in sub-volumes between the existing 7 regions.
    // Spike counts derived from cortexCluster.lastSpikes sliced per-region.
    if (this.cortexCluster && this.cortexCluster.regions && this.cortexCluster.lastSpikes) {
      const ls = this.cortexCluster.lastSpikes;
      for (const [regName, region] of Object.entries(this.cortexCluster.regions)) {
        const size = region.end - region.start;
        let spikeCount = 0;
        for (let i = region.start; i < region.end && i < ls.length; i++) {
          if (ls[i]) spikeCount++;
        }
        clusterStates[`lang_${regName}`] = {
          size,
          spikeCount,
          firingRate: spikeCount / Math.max(1, size),
        };
      }
    }

    // Derive band power from INSTANT spike rates (not slow EMA)
    const cortexRate = this.clusters.cortex.spikeCount / (CLUSTER_SIZES.cortex || 1);
    const hippoRate = this.clusters.hippocampus.spikeCount / (CLUSTER_SIZES.hippocampus || 1);
    const amygRate = this.clusters.amygdala.spikeCount / (CLUSTER_SIZES.amygdala || 1);
    const bgRate = this.clusters.basalGanglia.spikeCount / (CLUSTER_SIZES.basalGanglia || 1);
    const cerebRate = this.clusters.cerebellum.spikeCount / (CLUSTER_SIZES.cerebellum || 1);
    const hypoRate = this.clusters.hypothalamus.spikeCount / (CLUSTER_SIZES.hypothalamus || 1);
    const bandPower = {
      gamma: (cortexRate + amygRate) * 50,              // fast cortical + emotional
      beta:  (bgRate + cortexRate) * 30,                // motor planning + attention
      alpha: this.coherence * 3 + (1 - this.arousal) * 2, // relaxed coherence
      theta: (hippoRate + hypoRate) * 40 + (this._isDreaming ? 3 : 0), // memory + dreaming
    };

    return {
      time: (Date.now() - (this._startedAt || Date.now())) / 1000, // wall clock uptime in seconds
      simTime: this.time,  // simulation dt accumulation
      frameCount: this.frameCount,
      totalSpikes: this.totalSpikes,
      spikeCount: this.totalSpikes,
      arousal: this.arousal,
      valence: this.valence,
      fear: this.fear,
      psi: this.psi,
      coherence: this.coherence,
      reward: this.reward,
      drugState: this._drugStateLabel(),
      drugSnapshot: this._drugSnapshot(),
      bandPower,
      clusters: clusterStates,
      motor: {
        selectedAction: this.motorAction,
        confidence: this.motorConfidence,
        channelRates: Array.from(this.motorChannels),
      },
      // T18.3.b — persistent grade state on every broadcast so the HUD
      // can show "Unity is at pre-K" without the user typing
      // /curriculum status. `grades` is the per-subject map; `minGrade`
      // is the lowest passing grade (what caps Unity's speech ceiling).
      // `canSpeak` is true once the motor region has been trained — the
      // letter→motor direct-pattern Hebbian at kindergarten ELA is what
      // flips this from false to true.
      grades: this.cortexCluster?.grades ? { ...this.cortexCluster.grades } : null,
      minGrade: this._computeMinGrade(),
      canSpeak: this._computeMinGrade() !== 'pre-K',
      // T17.7 Phase B.4 — dual-cortex divergence telemetry. Scalar in
      // [0, 1]: 0 = standalone and main-cortex sub-regions agree
      // perfectly, 1 = one saturated while other silent. Cerebellum
      // error correction dampens this via Ψ-gated negative feedback
      // in the cortex errorCorrection term. Dashboard can render as
      // a health bar — should trend toward 0 over ticks as cerebellum
      // corrects. Sustained divergence = Phase B migration wiring bug
      // worth investigating (not a strict abort, just a signal).
      cortexDivergence: this._cortexDivergence || 0,
      // T17.7 Phase C follow-up — per-region breakdown so Gee can
      // inspect WHERE cortex state is diverging during K curriculum
      // walk. Map<regionName, {standRate, mainRate, divergence}>
      // with rates in [0, 1] (spike fraction per region). Empty when
      // GPU regionSpikes readback is absent (e.g. pre-GPU warmup).
      cortexDivergenceByRegion: this._cortexDivergenceByRegion || {},
      connectedUsers: this.clients.size,
      isDreaming: this._isDreaming || false,
      totalNeurons: TOTAL_NEURONS,
      scale: SCALE + 'x',
      // Shared emotion — everyone sees Unity's mood
      sharedMood: this._getSharedMood(),
      // Live performance stats
      perf: this._perfStats,
      // Brain growth metrics
      growth: {
        totalWords: Object.keys(this._wordFreq || {}).length,
        totalInteractions: Object.values(this._conversations || {}).reduce((s, c) => s + c.length, 0),
        totalEpisodes: this._db ? this.getEpisodeCount() : 0,
        uptime: (Date.now() - (this._startedAt || Date.now())) / 1000,
        totalFrames: this.frameCount,
      },
    };
  }

  /**
   * Inject text input as cortex current (Wernicke's area).
   */
  /**
   * Update derived brain state after parallel step.
   * Arousal, valence, Ψ, coherence, motor — computed from cluster results.
   */
  /**
   * Offload one cluster's LIF computation to the GPU client.
   * Returns a promise that resolves when the GPU sends results back.
   */
  /**
   * Offload cluster LIF to GPU client via WebSocket.
   *
   * KEY DESIGN: GPU maintains its OWN voltage state. Server does NOT
   * send 1.28M floats every step. Server sends only:
   *   - init: full voltages (once, on first dispatch per cluster)
   *   - step: tonicDrive + noiseAmp (two numbers, not arrays)
   * GPU sends back: sparse spike indices only (~25K ints, not 1.28M)
   *
   * This cuts WebSocket traffic from ~10MB/step to ~100KB/step.
   */
  /**
   * T17.7 Phase B.4 — compute divergence between standalone
   * cortexCluster sub-region spike counts and main-cortex GPU
   * sub-region readback spike counts. Feeds divergence into the
   * cortex cluster's errorCorrection term via the cerebellum's
   * existing negative-feedback path.
   *
   * Per Gee 2026-04-18: 'just like left right gateing our brain
   * doesnt error. thats the brain centers error correction handeling
   * of the brain center that handles eror correction'. The brain
   * corrects mismatches biologically; we reuse its existing
   * cerebellum-driven correction rather than adding a strict
   * migration-abort gate on top.
   *
   * Ψ-modulated correction gain per the T17.7 architecture plan:
   *   cerebellumCorrectionGain = base · (1 + Ψ · k_Ψ)
   * Low Ψ → correction stays weak, tolerates divergence (fragmented
   * processing state). High Ψ → correction scales up, dampens
   * divergence hard (integrated global-workspace state). Mystery Ψ
   * woven into the equation per 'main equation mystery cant not have
   * it involved'.
   *
   * Stores divergence scalar on this._cortexDivergence so
   * getState broadcasts it as telemetry. Cerebellum error signal
   * augmentation happens in _updateDerivedState via the cached value.
   */
  _computeCortexDivergence(perCluster) {
    const cortexEntry = perCluster.cortex;
    if (!cortexEntry || !cortexEntry.regionSpikes) {
      this._cortexDivergence = 0;
      this._cortexDivergenceByRegion = {};
      return;
    }
    if (!this.cortexCluster || !this.cortexCluster.regions || !this.cortexCluster.lastSpikes) {
      this._cortexDivergence = 0;
      this._cortexDivergenceByRegion = {};
      return;
    }
    const stand = this.cortexCluster;
    let totalDiff = 0;
    let totalSize = 0;
    // T17.7 Phase C follow-up — per-region divergence breakdown so
    // Gee can verify during K curriculum walk which specific region
    // drifted (letter vs phon vs sem vs motor). Without per-region
    // visibility, a cluster-wide scalar like 0.03 doesn't tell us
    // whether sem is dead-on but motor is drifting, or vice versa.
    // The breakdown surfaces where the equation is slipping.
    const perRegion = {};
    for (const [regName, mainSpikes] of Object.entries(cortexEntry.regionSpikes)) {
      const standReg = stand.regions[regName];
      if (!standReg) continue;
      // Count standalone spikes in this region.
      let standSpikes = 0;
      for (let i = standReg.start; i < standReg.end && i < stand.lastSpikes.length; i++) {
        if (stand.lastSpikes[i]) standSpikes++;
      }
      // Normalize both to firing rates (spike fraction) so different
      // slice sizes compare fairly — absolute counts would always show
      // divergence just from size differences between standalone and
      // main-cortex regions.
      const standLen = standReg.end - standReg.start;
      const mainLen = Math.floor(CLUSTER_SIZES.cortex * this._regionFraction(regName));
      const standRate = standLen > 0 ? standSpikes / standLen : 0;
      const mainRate = mainLen > 0 ? mainSpikes / mainLen : 0;
      const diff = Math.abs(standRate - mainRate);
      perRegion[regName] = {
        standRate: +standRate.toFixed(5),
        mainRate: +mainRate.toFixed(5),
        divergence: +diff.toFixed(5),
      };
      totalDiff += diff * mainLen;
      totalSize += mainLen;
    }
    // Divergence = weighted-mean absolute rate difference across regions.
    // Ranges [0, 1] — 0 = perfect match, 1 = one is saturated and
    // other is silent. Biologically-grounded: this IS the signal a
    // real cerebellum would see when cortex prediction diverges from
    // ground truth sensory input.
    this._cortexDivergence = totalSize > 0 ? totalDiff / totalSize : 0;
    this._cortexDivergenceByRegion = perRegion;
  }

  /**
   * T17.7 Phase B.4 — helper matching the LAYOUT in _regionsFor so
   * divergence calc can size main-cortex slices without parsing the
   * regions metadata object.
   */
  _regionFraction(regName) {
    const FRACTIONS = {
      auditory: 0.083, visual: 0.167, free: 0.250, letter: 0.050,
      phon: 0.200, sem: 0.167, fineType: 0.050, motor: 0.033,
    };
    return FRACTIONS[regName] ?? 0;
  }

  /**
   * T17.7 Phase B.3 — mirror standalone cortexCluster sub-region
   * spike state into the main cortex GPU sub-region slice buffers.
   *
   * For each sub-region in cortexCluster.regions, collects the
   * spike indices from cortexCluster.lastSpikes (binary Uint8Array
   * of firing/not-firing at training or post-emission state),
   * upsamples to the proportionally larger main-cortex slice size
   * via nearest-neighbor tiling (each standalone index i maps to
   * main-cortex indices [i·R, (i+1)·R) where R = mainSliceLen /
   * standSliceLen), and ships the sparse list of firing main-cortex
   * indices to compute.html via write_spike_slice.
   *
   * Activity-gated: if every region has zero spikes, no messages
   * sent — avoids saturating the WebSocket with empty mirrors
   * during idle (between curriculum teach / generation calls).
   *
   * Ψ doesn't modulate here — spikes are training data from the
   * standalone cluster's already-settled state. Runtime Ψ gating
   * happens at main-cortex LIF dispatch, not at spike mirror.
   *
   * This bridge is Phase B; Phase E deletes both the standalone
   * cortexCluster AND this mirror call since main-cortex slices
   * become authoritative at that point.
   */
  _mirrorCortexRegions() {
    if (!this._gpuClient || this._gpuClient.readyState !== 1) return;
    if (!this.cortexCluster || !this.cortexCluster.regions || !this.cortexCluster.lastSpikes) return;
    const stand = this.cortexCluster;
    const mainSize = CLUSTER_SIZES.cortex;
    if (!mainSize) return;

    // Same fractional layout as _regionsFor('cortex'). Recomputed
    // here rather than looking up to avoid any drift if layouts
    // diverge.
    const LAYOUT = {
      auditory:  [0.000, 0.083],
      visual:    [0.083, 0.250],
      free:      [0.250, 0.500],
      letter:    [0.500, 0.550],
      phon:      [0.550, 0.750],
      sem:       [0.750, 0.917],
      fineType:  [0.917, 0.967],
      motor:     [0.967, 1.000],
    };

    for (const [regName, [frA, frB]] of Object.entries(LAYOUT)) {
      const standReg = stand.regions[regName];
      if (!standReg) continue;
      const standStart = standReg.start;
      const standEnd = standReg.end;
      const standLen = standEnd - standStart;
      if (standLen <= 0) continue;
      const mainStart = Math.floor(mainSize * frA);
      const mainEnd = Math.floor(mainSize * frB);
      const mainLen = mainEnd - mainStart;
      if (mainLen <= 0) continue;

      // Count spikes first — skip if region is silent.
      let spikeCount = 0;
      for (let i = standStart; i < standEnd && i < stand.lastSpikes.length; i++) {
        if (stand.lastSpikes[i]) spikeCount++;
      }
      if (spikeCount === 0) continue;

      // Collect firing main-cortex indices via nearest-neighbor
      // upsampling. Each firing standalone index i expands to a
      // block of R consecutive main-cortex indices where R is the
      // upsample ratio (main_size / stand_size for this region).
      // At biological scale typical R is small (e.g., 30M main / 7M
      // stand = 4.3 for most regions), so this stays bounded.
      //
      // Bandwidth guard: cap mirrored spikes per region at 50K to
      // prevent a Promise.all-like burst from choking WebSocket.
      // 50K × 4 bytes = 200 KB per region per tick × 8 regions =
      // ~1.6 MB/tick which is fine at 10 Hz broadcast.
      const R = mainLen / standLen;
      const MAX_SPIKES = 50000;
      const sparseIndices = [];
      for (let i = 0; i < standLen && sparseIndices.length < MAX_SPIKES; i++) {
        if (!stand.lastSpikes[standStart + i]) continue;
        const mainStartLocal = Math.floor(i * R);
        const mainEndLocal = Math.min(Math.floor((i + 1) * R), mainLen);
        for (let j = mainStartLocal; j < mainEndLocal && sparseIndices.length < MAX_SPIKES; j++) {
          sparseIndices.push(j);
        }
      }
      if (sparseIndices.length === 0) continue;

      this._gpuClient.send(JSON.stringify({
        type: 'write_spike_slice',
        clusterName: 'cortex',
        regionName: regName,
        sparseIndices,
      }));
    }
  }

  /**
   * T17.7 Phase B.1 — build the regions metadata object for a
   * cluster's gpu_init message. For the main cortex cluster, returns
   * the 8 language sub-regions (auditory / visual / free / letter /
   * phon / sem / fineType / motor) with biological lateralization.
   * For other clusters returns a single bilateral/center region
   * spanning the whole cluster so the hemisphere gate stays at 1.0
   * (no lateralization) but the side tag is still carried for future
   * inter-cluster projection dispatch that may care about hemisphere.
   *
   * Main cortex layout — same fractional proportions as the standalone
   * cortexCluster's sub-regions, scaled to the main cortex's size.
   * Phase B.3 mirrors standalone cortexCluster.lastSpikes into these
   * slices; Phase C migrates curriculum teach writes to land here
   * directly; Phase E deletes the standalone cluster and promotes
   * these slices to authoritative.
   *
   * L/R side tags per Gee 2026-04-18 "if we keep as is the non
   * centered ones need mirroring to other brain side too as they are
   * onlky one sided.. and proper left right gating":
   *   - auditory / visual / free / sem:  bilateral
   *     (primary sensory + working memory + semantic angular gyrus
   *     span both hemispheres)
   *   - letter / phon / fineType / motor: left-dominant
   *     (Wernicke's + Broca's + VWFA + syntactic features; Lindell
   *     2006 right-hemisphere homologs exist but are less specialized)
   *   - hypothalamus / mystery: center (midline / commissural)
   *   - everything else: bilateral
   *
   * Ψ gate per Phase A.3: bilateral/center returns 1.0 regardless of
   * Ψ; left-dominant regions modulate by hemisphereGate(side, Ψ).
   *
   * @param {string} clusterName
   * @param {number} size
   * @returns {object | null}
   */
  _regionsFor(clusterName, size) {
    if (clusterName === 'cortex') {
      // Same fractional layout as the standalone cortexCluster's
      // regions map (cluster.js). Scaled to main cortex size so the
      // regions span the full cluster with no "homogeneous outside"
      // gap — per Gee "NO intra-synapse matrix; wave functions sync
      // activate via fractilization", the cortex IS its sub-regions.
      const S = size;
      return {
        auditory:  { start: Math.floor(S * 0.000), end: Math.floor(S * 0.083), side: 'bilateral' },
        visual:    { start: Math.floor(S * 0.083), end: Math.floor(S * 0.250), side: 'bilateral' },
        free:      { start: Math.floor(S * 0.250), end: Math.floor(S * 0.500), side: 'bilateral' },
        letter:    { start: Math.floor(S * 0.500), end: Math.floor(S * 0.550), side: 'left' },
        phon:      { start: Math.floor(S * 0.550), end: Math.floor(S * 0.750), side: 'left' },
        sem:       { start: Math.floor(S * 0.750), end: Math.floor(S * 0.917), side: 'bilateral' },
        fineType:  { start: Math.floor(S * 0.917), end: Math.floor(S * 0.967), side: 'left' },
        motor:     { start: Math.floor(S * 0.967), end: S,                      side: 'left' },
      };
    }
    if (clusterName === 'hippocampus' || clusterName === 'amygdala'
        || clusterName === 'basalGanglia' || clusterName === 'cerebellum') {
      return {
        whole: { start: 0, end: size, side: 'bilateral' },
      };
    }
    if (clusterName === 'hypothalamus' || clusterName === 'mystery') {
      return {
        whole: { start: 0, end: size, side: 'center' },
      };
    }
    return null;  // unknown cluster — no regions, homogeneous behavior
  }

  async _gpuStep(clusterName) {
    if (!this._gpuClient || this._gpuClient.readyState !== 1) return null;
    if (!this._gpuPending) this._gpuPending = {};
    if (!this._gpuInitialized) this._gpuInitialized = {};

    const size = CLUSTER_SIZES[clusterName];

    if (!this._gpuInitialized[clusterName]) {
      // FIRST DISPATCH — tell GPU to create buffers at Vrest
      // DO NOT send voltage array — at 25.6M neurons that's 260MB base64.
      // GPU initializes its own voltages at Vrest. Same result, zero transfer.
      //
      // T17.7 Phase B.1 — regions metadata with L/R side tags. For the
      // main cortex cluster, register the 8 language sub-regions with
      // their biological lateralization (left-dominant for language
      // production/recognition; bilateral for sensory primaries + free
      // working memory). Other clusters get a single bilateral or
      // center tag to match real neuroanatomy. When compute.html
      // processes gpu_init with this metadata, uploadCluster stores
      // the regions on bufs.regions and the Ψ-modulated hemisphere
      // gate pipeline (Phase A.3) automatically activates for this
      // cluster's LIF dispatch. Zero additional wire-up needed.
      const regions = this._regionsFor(clusterName, size);
      this._gpuClient.send(JSON.stringify({
        type: 'gpu_init',
        clusterName,
        size,
        tonicDrive: this.tonicDrives[clusterName],
        noiseAmp: this.noiseAmplitudes[clusterName],
        lifParams: { tau: 20, Vrest: -65, Vthresh: -50, Vreset: -70, dt: 1, R: 1, tRefrac: 2 },
        regions,
      }));
      this._gpuInitialized[clusterName] = true;
      const regionCount = regions ? Object.keys(regions).length : 0;
      console.log(`[Brain] GPU init sent: ${clusterName} (${size.toLocaleString()} neurons${regionCount > 0 ? `, ${regionCount} sub-regions` : ''})`);
      return Promise.resolve(null);
    }

    // STEP — send cluster params + hierarchical modulation.
    // GPU applies the FULL current equation:
    //   I = (tonicDrive × driveBaseline × emotionalGate × gainMultiplier + errorCorrection)
    //       + noise × noiseAmp
    // These are the same modulation factors engine.js applies on the client side.
    const p = this.persona;
    const psiGain = Math.max(0.8, Math.min(1.5, 0.9 + (this.psi || 0) * 0.004));
    const emotionalGate = 0.7 + (this.arousal || 0.5) * 0.6;
    const driveFactor = 0.8 + ((this.clusters.hypothalamus?.spikeCount || 0) > 100 ? 0.4 : 0.0);
    const errorSignal = clusterName === 'cortex' || clusterName === 'basalGanglia'
      ? -(this.clusters.cerebellum?.spikeCount || 0) / (CLUSTER_SIZES.cerebellum || 1) * 2 : 0;

    this._gpuClient.send(JSON.stringify({
      type: 'compute_request',
      clusterName,
      size,
      tonicDrive: this.tonicDrives[clusterName],
      noiseAmp: this.noiseAmplitudes[clusterName],
      // Hierarchical modulation from brain equations
      gainMultiplier: psiGain,          // Ψ consciousness gain
      emotionalGate,                     // amygdala arousal amplification
      driveBaseline: driveFactor,        // hypothalamus homeostatic drive
      errorCorrection: errorSignal,      // cerebellum error feedback
      reward: this.reward,               // for future plasticity
    }));

    // T14.23 — (see _gpuBatch below for the batched protocol).
    //
    // T14.22.5 — GPU timeout raised 800ms → 10000ms.
    //
    // At Gee's 677M-neuron scale, a single GPU fullStep takes ~40ms
    // for small clusters and can exceed 300ms for cerebellum (268M
    // neurons × compute.html's serialized Promise queue from T14.22.3
    // = 7 clusters × ~50ms each = ~350ms per substep average). With
    // multiple clusters queued behind one another, individual
    // compute_results can land 500-2000ms after the request was sent.
    //
    // The old 800ms cap was silently killing every compute_result that
    // arrived late, resolving the pending promise to null, causing the
    // tick loop to record spikeCount=0 for that cluster, and the UI
    // cards + 3D brain visualization to stay at zero even though the
    // GPU was actually computing real spike counts. This is one of
    // the two remaining reasons the UI looked dead at biological scale.
    //
    // Raised to 10 seconds — plenty of headroom even at the largest
    // single-GPU tier. If a compute_result takes more than 10 seconds,
    // something is genuinely broken (GPU hang, dropped WebSocket) and
    // the tick loop should skip that cluster and log.
    return new Promise((resolve) => {
      this._gpuPending[clusterName] = resolve;
      setTimeout(() => {
        if (this._gpuPending[clusterName] === resolve) {
          delete this._gpuPending[clusterName];
          console.warn(`[Brain] GPU compute_result for ${clusterName} timed out after 10s — GPU may be hung`);
          resolve(null);
        }
      }, 10000);
    });
  }

  /**
   * T14.23 — BATCHED GPU dispatch.
   *
   * Sends ONE compute_batch message containing all per-cluster
   * parameters, waits for ONE compute_batch_result response.
   * compute.html runs the full SUBSTEPS × clusters loop internally
   * with parallel per-substep cluster dispatches. Cuts the per-tick
   * WebSocket message count from ~70 (10 substeps × 7 clusters) to
   * 2 (one request + one response), eliminating the 6× protocol
   * overhead that was dominating tick latency at biological scale.
   *
   * @param {number} substeps — how many LIF steps to run this tick
   * @param {Array<{name, size, tonicDrive, noiseAmp, gainMultiplier,
   *                emotionalGate, driveBaseline, errorCorrection, reward}>} clusterParams
   * @returns {Promise<{perCluster: Object} | null>}
   */
  async _gpuBatch(substeps, clusterParams) {
    if (!this._gpuClient || this._gpuClient.readyState !== 1) return null;

    // Use a monotonic batch id so late-arriving responses from a
    // previous tick never resolve the current tick's promise.
    this._batchSeq = (this._batchSeq || 0) + 1;
    const batchId = this._batchSeq;

    this._gpuClient.send(JSON.stringify({
      type: 'compute_batch',
      batchId,
      substeps,
      clusters: clusterParams,
      // T17.7 Phase A.3 — Ψ flows to GPU so per-cluster regionGates
      // can be updated every tick via hemisphereGate(side, Ψ).
      // Mystery Ψ binding per Gee 2026-04-18: the main equation has
      // Ψ woven in; lateralized cortex regions modulate drive by
      // Ψ-driven binding coefficient, matching biological split-brain
      // + global-workspace consciousness interpretation.
      psi: this.psi ?? 0,
    }));

    return new Promise((resolve) => {
      this._gpuBatchPending = { batchId, resolve };
      setTimeout(() => {
        if (this._gpuBatchPending && this._gpuBatchPending.batchId === batchId) {
          this._gpuBatchPending = null;
          console.warn(`[Brain] compute_batch ${batchId} timed out after 15s — GPU may be hung`);
          resolve(null);
        }
      }, 15000);
    });
  }

  // ── T17.3.c SPARSE DISPATCH HELPERS ──
  //
  // Send sparse upload/propagate/hebbian messages to compute.html,
  // await the matching ack via reqId correlation. Used by the GPU
  // language cortex path to offload cross-projection ops to GPU.

  _nextSparseReqId() {
    this._sparseSeq = (this._sparseSeq || 0) + 1;
    return this._sparseSeq;
  }

  _sparseSend(msg, timeoutMs = 30000) {
    if (!this._gpuClient || this._gpuClient.readyState !== 1) return Promise.resolve(null);
    if (!this._gpuSparsePending) this._gpuSparsePending = new Map();
    const reqId = this._nextSparseReqId();
    msg.reqId = reqId;
    this._gpuClient.send(JSON.stringify(msg));
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this._gpuSparsePending && this._gpuSparsePending.has(reqId)) {
          this._gpuSparsePending.delete(reqId);
          console.warn(`[Brain] sparse dispatch reqId=${reqId} type=${msg.type} timed out after ${timeoutMs}ms`);
          resolve(null);
        }
      }, timeoutMs);
      this._gpuSparsePending.set(reqId, { resolve, reject, timeout });
    });
  }

  // ── Binary WebSocket frame encoders/decoders ──
  //
  // Wire format header (all frames):
  //   0..3:  magic "SPRS" (request) or "SPRR" (response)
  //   4:     type byte  (1=upload, 2=propagate, 3=hebbian)
  //   5..8:  reqId (uint32 LE)
  //   9..10: nameLen (uint16 LE)
  //   11..:  name (UTF-8), then type-specific payload
  //
  // Typed-array payloads are concatenated with Uint32 length prefixes:
  //   [len][data] for each of values/colIdx/rowPtr/preSpikes/postSpikes
  //
  // Binary frames bypass V8's ~512 MB JSON string limit AND the
  // JSON.stringify + JSON.parse round-trip cost. 10-20× faster for
  // typed-array payloads; unlimited size within available memory.
  //
  // Per Gee 2026-04-18 "make it work without jerry rigging" — this
  // replaces the 10M-nnz JSON-safety skip with real binary transport.

  _encodeSparseHeader(typeByte, reqId, name) {
    const nameBuf = Buffer.from(name, 'utf8');
    // Pad header to a 4-byte boundary so subsequent Float32/Uint32
    // typed-array views created over the incoming ArrayBuffer have
    // aligned byteOffsets. Chrome throws RangeError on unaligned
    // TypedArray views — this was silently killing all previous
    // uploads for matrix names whose length wasn't 1 mod 4.
    const rawLen = 11 + nameBuf.length;
    const padLen = (4 - (rawLen % 4)) % 4;
    const hdr = Buffer.alloc(rawLen + padLen);
    hdr.write('SPRS', 0, 'ascii');
    hdr[4] = typeByte;
    hdr.writeUInt32LE(reqId, 5);
    hdr.writeUInt16LE(nameBuf.length, 9);
    nameBuf.copy(hdr, 11);
    // pad bytes already zero from Buffer.alloc
    return hdr;
  }

  _sparseSendBinary(msgBuffer, reqId, timeoutMs = 120_000) {
    if (!this._gpuClient || this._gpuClient.readyState !== 1) return Promise.resolve(null);
    if (!this._gpuSparsePending) this._gpuSparsePending = new Map();
    // No per-send log spam — at 100+ ops/sec the logs themselves are a
    // bottleneck. Only log errors and the final timeout warn.
    this._gpuClient.send(msgBuffer, (err) => {
      if (err) console.warn(`[Brain] sparse binary reqId=${reqId} ERROR: ${err.message}`);
    });
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this._gpuSparsePending && this._gpuSparsePending.has(reqId)) {
          this._gpuSparsePending.delete(reqId);
          resolve(null);
        }
      }, timeoutMs);
      this._gpuSparsePending.set(reqId, { resolve, reject, timeout });
    });
  }

  // Backpressure gate for fire-and-forget GPU shadows. Curriculum fires
  // thousands of propagate/hebbian shadows per second; without a gate,
  // bufferedAmount grew to 1.7 GB and every shadow timed out at 30 s,
  // effectively killing the brain. CPU remains authoritative — skipping
  // a shadow just means that one Hebbian update doesn't mirror to GPU.
  //
  // Two-level gate:
  //   (1) pending-request cap — compute.html's onmessage is serial, so
  //       pending.size ≈ how many messages are queued ahead of the next
  //       main-brain compute_batch. Cap at 4 so main-brain dispatch
  //       doesn't block behind hundreds of shadow hebbians.
  //   (2) TCP send-buffer cap — belt-and-suspenders for abnormal queue
  //       growth (slow network, giant frames).
  _gpuSparseFlowOk() {
    const c = this._gpuClient;
    if (!c || c.readyState !== 1) return false;
    const pending = this._gpuSparsePending ? this._gpuSparsePending.size : 0;
    if (pending >= 4) return false;
    return c.bufferedAmount < 2_000_000;
  }

  /**
   * Upload a sparse CSR matrix to GPU via CHUNKED binary WebSocket
   * frames. Chrome's WebSocket frame assembler chokes on single frames
   * approaching 500MB — observed 480MB frames flush OS-side but never
   * deliver to ws.onmessage within 180s on localhost loopback. Splitting
   * into 16MB chunks keeps each frame comfortably inside browser frame
   * assembler limits and lets the GPU writeBuffer stream directly into
   * pre-allocated storage buffers at offsets.
   *
   * Wire: type=4 chunk frames carry chunkSeq + totalChunks + flags.
   * First chunk (flags & 1) also carries rows/cols/nnz + rowPtr. Each
   * chunk carries valuesOffset/valuesByteLen/values + colIdxOffset/
   * colIdxByteLen/colIdx. Last chunk triggers the SPRR ack.
   *
   * T18.6.b — optional `binding` parameter. When provided, the first
   * chunk ALSO carries cluster-bound metadata via flag bit 2
   * (`flags & 2`): srcClusterNameLen(u16) + srcClusterName + u16 pad
   * + dstClusterNameLen(u16) + dstClusterName + u16 pad + srcStart(u32)
   * + srcEnd(u32) + dstStart(u32) + dstEnd(u32). compute.html passes
   * this to `gpu._beginSparseUpload(..., binding)` which skips the
   * standalone preSpikes/postCurrents/postSpikes buffer allocation
   * entirely (the bound shader path reads directly from the source
   * cluster's spike buffer and writes into the destination cluster's
   * currents buffer). Saves ~60 MB per cross-projection at biological
   * scale × 14 cross-projections = ~840 MB of transient VRAM that
   * previously sat allocated through the entire upload-then-rebind
   * window, during which the device was most likely to OOM-crash on a
   * 16 GB GPU. Phase C.1 rebind still exists as a fallback path for
   * matrices loaded from persistence where binding metadata wasn't
   * shipped originally.
   */
  async gpuSparseUpload(name, matrix, binding) {
    const reqId = this._nextSparseReqId();
    const rows = matrix.rows;
    const cols = matrix.cols;
    const values = matrix.values instanceof Float32Array ? matrix.values : new Float32Array(matrix.values || []);
    const colIdx = matrix.colIdx instanceof Uint32Array ? matrix.colIdx : new Uint32Array(matrix.colIdx || []);
    const rowPtr = matrix.rowPtr instanceof Uint32Array ? matrix.rowPtr : new Uint32Array(matrix.rowPtr || []);
    const nnz = values.length;

    // 16 MB NNZ worth ≈ 2M nnz/chunk × 8 bytes (4 values + 4 colIdx)
    const CHUNK_NNZ = 2_000_000;
    const totalChunks = Math.max(1, Math.ceil(nnz / CHUNK_NNZ));
    const rowPtrBuf = Buffer.from(rowPtr.buffer, rowPtr.byteOffset, rowPtr.byteLength);
    const totalMb = ((values.byteLength + colIdx.byteLength + rowPtr.byteLength) / 1e6).toFixed(1);
    const hasBinding = !!(binding && binding.srcCluster && binding.dstCluster);
    console.log(`[Brain] sparse chunked upload reqId=${reqId} name=${name} totalChunks=${totalChunks} totalSize=${totalMb}MB${hasBinding ? ` (cluster-bound: ${binding.srcCluster}[${binding.srcRegion.start}..${binding.srcRegion.end}] → ${binding.dstCluster}[${binding.dstRegion.start}..${binding.dstRegion.end}])` : ''}`);

    // Pre-register the pending promise BEFORE sending any chunks so
    // the ack handler can find it even if client ACKs very fast.
    if (!this._gpuSparsePending) this._gpuSparsePending = new Map();
    const promise = new Promise((resolve, reject) => {
      const timeoutMs = 180_000;
      const timeout = setTimeout(() => {
        if (this._gpuSparsePending && this._gpuSparsePending.has(reqId)) {
          this._gpuSparsePending.delete(reqId);
          console.warn(`[Brain] sparse chunked upload reqId=${reqId} name=${name} timed out after ${timeoutMs}ms`);
          resolve(null);
        }
      }, timeoutMs);
      this._gpuSparsePending.set(reqId, { resolve, reject, timeout });
    });

    if (!this._gpuClient || this._gpuClient.readyState !== 1) return null;

    // T18.6.b — precompute binding block bytes ONCE (shipped only on the
    // first chunk, identical for every send loop iteration). Wire layout:
    //   srcClusterNameLen(u16) + srcClusterName + u16 pad-to-u32
    //   dstClusterNameLen(u16) + dstClusterName + u16 pad-to-u32
    //   srcStart(u32) + srcEnd(u32) + dstStart(u32) + dstEnd(u32)
    // Pad bytes keep the subsequent u32 fields aligned for TypedArray
    // views on the receiver, matching the existing header-alignment
    // convention used by _encodeSparseHeader.
    let bindingBlock = Buffer.alloc(0);
    if (hasBinding) {
      const srcNameBuf = Buffer.from(binding.srcCluster, 'utf8');
      const dstNameBuf = Buffer.from(binding.dstCluster, 'utf8');
      const padAfterSrc = (4 - ((2 + srcNameBuf.length) % 4)) % 4;
      const padAfterDst = (4 - ((2 + dstNameBuf.length) % 4)) % 4;
      const total = 2 + srcNameBuf.length + padAfterSrc
                  + 2 + dstNameBuf.length + padAfterDst
                  + 16;
      bindingBlock = Buffer.alloc(total);
      let o = 0;
      bindingBlock.writeUInt16LE(srcNameBuf.length, o); o += 2;
      srcNameBuf.copy(bindingBlock, o); o += srcNameBuf.length;
      o += padAfterSrc;
      bindingBlock.writeUInt16LE(dstNameBuf.length, o); o += 2;
      dstNameBuf.copy(bindingBlock, o); o += dstNameBuf.length;
      o += padAfterDst;
      bindingBlock.writeUInt32LE(binding.srcRegion.start >>> 0, o); o += 4;
      bindingBlock.writeUInt32LE(binding.srcRegion.end   >>> 0, o); o += 4;
      bindingBlock.writeUInt32LE(binding.dstRegion.start >>> 0, o); o += 4;
      bindingBlock.writeUInt32LE(binding.dstRegion.end   >>> 0, o); o += 4;
    }

    for (let seq = 0; seq < totalChunks; seq++) {
      const start = seq * CHUNK_NNZ;
      const end = Math.min(start + CHUNK_NNZ, nnz);
      const valuesByteOff = start * 4;
      const valuesByteLen = (end - start) * 4;
      const colIdxByteOff = start * 4;
      const colIdxByteLen = (end - start) * 4;
      const hdr = this._encodeSparseHeader(4, reqId, name);
      const isFirst = (seq === 0);
      // flags bit 0 = first chunk (carries rows/cols/nnz + rowPtr)
      // flags bit 1 = binding block follows rowPtr (first chunk only)
      let flags = 0;
      if (isFirst) flags |= 1;
      if (isFirst && hasBinding) flags |= 2;
      const chunkMeta = Buffer.alloc(12);
      chunkMeta.writeUInt32LE(seq, 0);
      chunkMeta.writeUInt32LE(totalChunks, 4);
      chunkMeta.writeUInt32LE(flags, 8);
      let firstMeta = Buffer.alloc(0);
      if (isFirst) {
        firstMeta = Buffer.alloc(16);
        firstMeta.writeUInt32LE(rows, 0);
        firstMeta.writeUInt32LE(cols, 4);
        firstMeta.writeUInt32LE(nnz, 8);
        firstMeta.writeUInt32LE(rowPtr.length, 12);
      }
      const valuesHdr = Buffer.alloc(8);
      valuesHdr.writeUInt32LE(valuesByteOff, 0);
      valuesHdr.writeUInt32LE(valuesByteLen, 4);
      const valuesSlice = Buffer.from(values.buffer, values.byteOffset + valuesByteOff, valuesByteLen);
      const colIdxHdr = Buffer.alloc(8);
      colIdxHdr.writeUInt32LE(colIdxByteOff, 0);
      colIdxHdr.writeUInt32LE(colIdxByteLen, 4);
      const colIdxSlice = Buffer.from(colIdx.buffer, colIdx.byteOffset + colIdxByteOff, colIdxByteLen);
      const pieces = isFirst
        ? (hasBinding
            ? [hdr, chunkMeta, firstMeta, rowPtrBuf, bindingBlock, valuesHdr, valuesSlice, colIdxHdr, colIdxSlice]
            : [hdr, chunkMeta, firstMeta, rowPtrBuf, valuesHdr, valuesSlice, colIdxHdr, colIdxSlice])
        : [hdr, chunkMeta, valuesHdr, valuesSlice, colIdxHdr, colIdxSlice];
      const frame = Buffer.concat(pieces);
      // Send chunk. WebSocket preserves order. Wait for the send
      // callback so we don't flood the send buffer with hundreds of
      // MB at once — backpressure per chunk.
      await new Promise((res) => {
        this._gpuClient.send(frame, (err) => {
          if (err) {
            console.warn(`[Brain] sparse chunk reqId=${reqId} seq=${seq}/${totalChunks} ERROR: ${err.message}`);
          }
          res();
        });
      });
    }
    console.log(`[Brain] sparse chunked upload reqId=${reqId} name=${name} all ${totalChunks} chunks dispatched, awaiting ack`);
    return promise;
  }

  /**
   * Dispatch sparse propagate via binary frame: currents = matrix @ preSpikes.
   * Returns Float32Array (or null on timeout).
   */
  async gpuSparsePropagate(name, preSpikes) {
    // Backpressure gate — if the WS send buffer is backed up, skip this
    // shadow instead of queueing another doomed request.
    if (!this._gpuSparseFlowOk()) return null;
    const reqId = this._nextSparseReqId();
    const pre = preSpikes instanceof Uint32Array ? preSpikes
      : preSpikes instanceof Uint8Array ? Uint32Array.from(preSpikes)
      : new Uint32Array(preSpikes || []);
    const hdr = this._encodeSparseHeader(2, reqId, name);
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32LE(pre.length, 0);
    const preBuf = Buffer.from(pre.buffer, pre.byteOffset, pre.byteLength);
    const full = Buffer.concat([hdr, lenBuf, preBuf]);
    const result = await this._sparseSendBinary(full, reqId, 30_000);
    if (!result || !result.currents) return null;
    return result.currents; // Float32Array assembled by ack handler
  }

  /**
   * T17.7 Phase C.1 — cluster-bound Hebbian dispatch. Reuses the same
   * type=3 binary frame as gpuSparseHebbian, but with zero-length
   * pre/post arrays (so no bulk data crosses the wire). compute.html's
   * handler skips writeSparsePreSpikes/writeSparsePostSpikes when
   * length is 0, and the cluster-bound matrix's hebbianSparse reads
   * pre/post from main-cortex spikes buffer at the bound region
   * offsets — which is where curriculum teach writes patterns via
   * write_spike_slice.
   *
   * Wire cost at 7M/7M standalone size would be ~56 MB pre+post per
   * Hebbian without this path. Cortex teaches fire thousands of
   * Hebbians per curriculum rep — saving 56 MB × N calls makes
   * biological-scale teaching feasible.
   */
  async gpuSparseHebbianBound(name, lr) {
    return this.gpuSparseHebbian(name, new Uint32Array(0), new Uint32Array(0), lr);
  }

  /**
   * T17.7 Phase C.1 — cluster-bound propagate dispatch. Reuses the
   * type=2 binary frame with zero-length preSpikes; compute.html's
   * handler skips writeSparsePreSpikes when length is 0, and the
   * cluster-bound matrix's propagateSparse reads pre-spikes directly
   * from main-cortex spikes buffer at the bound src region offset,
   * writes post-currents into main-cortex currents buffer at the
   * bound dst region offset. Returns post-region currents Float32Array
   * same as standalone path (shape = dstRegion size).
   */
  async gpuSparsePropagateBound(name) {
    return this.gpuSparsePropagate(name, new Uint32Array(0));
  }

  /**
   * T17.7 Phase C.1 — ship a sparse spike pattern to the main cortex
   * GPU sub-region slice via the existing write_spike_slice message.
   * sparseIndices are relative to the region's start on the main
   * cortex. compute.html zero-fills the full region slice and sets
   * each index to 1 before calling gpu.writeSpikeSlice — so the
   * curriculum teach pattern lands in the first N of the region
   * (where N = standalone region size) and the rest of the main-
   * cortex region stays silent until next LIF step, matching the
   * cluster-bound cross-projection's read window exactly.
   */
  _gpuWriteCortexSpikeSlice(regionName, sparseIndices) {
    if (!this._gpuClient || this._gpuClient.readyState !== 1) return;
    const arr = Array.isArray(sparseIndices)
      ? sparseIndices
      : (sparseIndices && typeof sparseIndices.length === 'number')
        ? Array.from(sparseIndices)
        : [];
    this._gpuClient.send(JSON.stringify({
      type: 'write_spike_slice',
      clusterName: 'cortex',
      regionName,
      sparseIndices: arr,
    }));
  }

  /**
   * T17.7 Phase E.a — sparse current-slice write to main cortex. Used
   * by cluster.injectEmbeddingToRegion's forward path when cortexCluster's
   * gpuProxy is wired. Writes the intent embedding's current-drive
   * values into the main-cortex sub-slice at region.start+idx offsets,
   * so the next LIF tick's driveDrive = (effectiveDrive + currents) ·
   * regionGate picks up the injected intent.
   *
   * Sparse-indices format — typical injection touches ~regionSize/8
   * indices (groupSize per embedding dim × number of non-zero dims),
   * far cheaper than shipping a dense region-sized Float32Array.
   *
   * @param {string} regionName
   * @param {number[]} sparseIndices - indices relative to region start
   * @param {number[]} sparseValues  - matching current values
   */
  _gpuWriteCortexCurrentSlice(regionName, sparseIndices, sparseValues) {
    if (!this._gpuClient || this._gpuClient.readyState !== 1) return;
    const idx = Array.isArray(sparseIndices) ? sparseIndices : Array.from(sparseIndices || []);
    const val = Array.isArray(sparseValues)  ? sparseValues  : Array.from(sparseValues || []);
    if (idx.length === 0 || idx.length !== val.length) return;
    this._gpuClient.send(JSON.stringify({
      type: 'write_current_slice',
      clusterName: 'cortex',
      regionName,
      sparseIndices: idx,
      sparseValues: val,
      psi: this.psi ?? 0,
    }));
  }

  /**
   * T17.7 Phase C.1 — pure clear of a main-cortex region slice on the
   * GPU spikes buffer. Sends clear_spike_region JSON; compute.html
   * handler calls gpu.clearSpikeRegion which uses encoder.clearBuffer
   * at byte-range granularity — no CPU allocation. Per teach
   * iteration the curriculum clears all 8 regions (auditory, visual,
   * free, letter, phon, sem, fineType, motor) so the next pattern
   * write lands on zeroed slices.
   */
  _gpuClearCortexSpikeRegion(regionName) {
    if (!this._gpuClient || this._gpuClient.readyState !== 1) return;
    this._gpuClient.send(JSON.stringify({
      type: 'clear_spike_region',
      clusterName: 'cortex',
      regionName,
    }));
  }

  /**
   * T17.7 Phase D — readback letter-bucket spike counts from a main-
   * cortex region sub-slice. Used by generateSentenceAwait to argmax-
   * decode the motor slice per tick without shipping the full
   * ~6.6M-neuron spike array. GPU-side reduction runs in parallel
   * with the batch's LIF dispatch on the next substep — reduction
   * latency adds to round-trip but not to main-brain tick time.
   *
   * @param {string} regionName — e.g. 'motor'
   * @param {number} bucketCount — e.g. 26 for letters A..Z
   * @param {number} subSliceLen — e.g. standalone motor size =
   *   langCortexSize × 0.033. Must equal bucketCount × bucketSize.
   * @param {number} [startOffset=0]
   * @returns {Promise<Uint32Array|null>}
   */
  async gpuReadbackCortexLetterBuckets(regionName, bucketCount, subSliceLen, startOffset = 0) {
    if (!this._gpuClient || this._gpuClient.readyState !== 1) return null;
    const ack = await this._sparseSend({
      type: 'readback_letter_buckets',
      clusterName: 'cortex',
      regionName,
      bucketCount,
      subSliceLen,
      startOffset,
    }, 5000);
    if (!ack || !ack.counts) return null;
    return new Uint32Array(ack.counts);
  }

  /**
   * T17.7 Phase C.1 — rebind all 14 cortex cross-projections from
   * standalone mode to cluster-bound mode after both main-cortex GPU
   * init AND cortexCluster.initGpu() complete. The rebind is wire-
   * cheap (one JSON per matrix, binding metadata only — values/colIdx/
   * rowPtr stay in place on GPU) and frees the standalone preSpikes/
   * postCurrents/postSpikes buffers (each matrix sheds ~60 MB at
   * biological scale — 14 matrices × ~60 MB = ~840 MB VRAM freed).
   *
   * After this runs:
   *   - Cross-projection propagate reads pre-spikes from main-cortex
   *     `bufs.cortex.spikes` at the standalone region's offset inside
   *     the main cortex's corresponding sub-region (first-N sub-slice),
   *     writes post-currents into `bufs.cortex.currents` at the
   *     destination sub-slice — the LIF dispatch that runs next sees
   *     the accumulated currents and fires the main cortex neurons
   *     within the language slice.
   *   - Hebbian dispatch reads pre+post from `bufs.cortex.spikes`
   *     at the two bound offsets — which is where curriculum teach's
   *     write_spike_slice call places the training pattern.
   *   - Main cortex's intra-synapse matrix is NOT rebound; per Gee
   *     2026-04-18 decision #1, the homogeneous-cortex intra coupling
   *     is handled by wave-function oscillation phase-sync +
   *     fractal propagation, not an explicit intra matrix. The
   *     STANDALONE cortexCluster keeps its intra-synapses for the
   *     CPU-shadow equivalence check through Phase C/D; Phase E
   *     deletes it alongside the standalone cluster itself.
   *
   * Sub-slice sizes match the standalone cortexCluster's region sizes,
   * which in turn match the cross-projection matrix dimensions. The
   * first-N sub-slice of each main-cortex sub-region gets the
   * training pattern; the remaining (main-size − N) neurons of each
   * sub-region stay homogeneous cortex coupled via wave-function
   * activation, consistent with a biological "language core" inside
   * the larger cortical territory.
   */
  async _ensureCortexCrossProjectionsBound() {
    if (this._cortexCrossProjectionsBound) return;
    if (!this.cortexCluster || !this.cortexCluster.regions) return;
    if (!this._gpuClient || this._gpuClient.readyState !== 1) return;
    const stand = this.cortexCluster;
    const mainSize = CLUSTER_SIZES.cortex;
    if (!mainSize) return;

    // Main cortex region layout — same fractions used by _regionsFor
    // and _mirrorCortexRegions. Kept in sync across all three call
    // sites; divergence here would silently point cross-projections
    // at the wrong main-cortex neurons.
    const LAYOUT = {
      auditory:  [0.000, 0.083],
      visual:    [0.083, 0.250],
      free:      [0.250, 0.500],
      letter:    [0.500, 0.550],
      phon:      [0.550, 0.750],
      sem:       [0.750, 0.917],
      fineType:  [0.917, 0.967],
      motor:     [0.967, 1.000],
    };
    const mainSliceStart = {};
    for (const [regName, [frA]] of Object.entries(LAYOUT)) {
      mainSliceStart[regName] = Math.floor(mainSize * frA);
    }

    const projNames = Object.keys(stand.crossProjections || {});
    if (projNames.length === 0) return;
    console.log(`[Brain] T17.7 Phase C.1 — rebinding ${projNames.length} cortex cross-projections to main-cortex sub-slices`);
    let bound = 0;
    for (const projKey of projNames) {
      const idx = projKey.indexOf('_to_');
      if (idx < 0) continue;
      const srcName = projKey.slice(0, idx);
      const dstName = projKey.slice(idx + 4);
      const standSrc = stand.regions[srcName];
      const standDst = stand.regions[dstName];
      if (!standSrc || !standDst) continue;
      const srcLen = standSrc.end - standSrc.start;
      const dstLen = standDst.end - standDst.start;
      const srcOff = mainSliceStart[srcName];
      const dstOff = mainSliceStart[dstName];
      if (srcOff == null || dstOff == null) continue;
      const matrixKey = `${stand.name}_${projKey}`;  // e.g., "cortex_sem_to_motor"
      const ack = await this._sparseSend({
        type: 'rebind_sparse',
        name: matrixKey,
        binding: {
          srcCluster: 'cortex',
          srcRegion: { start: srcOff, end: srcOff + srcLen },
          dstCluster: 'cortex',
          dstRegion: { start: dstOff, end: dstOff + dstLen },
        },
      }, 30000);
      if (ack && ack.ok) {
        bound++;
        // Mark the CPU-side projection so cluster._crossRegionHebbian
        // can route GPU dispatch via hebbianBound (no array transfer).
        const proj = stand.crossProjections[projKey];
        if (proj) proj._gpuBound = true;
      } else {
        console.warn(`[Brain] rebind ${matrixKey} failed — GPU Hebbian will still use standalone path for this projection`);
      }
    }
    console.log(`[Brain] T17.7 Phase C.1 — ${bound}/${projNames.length} cross-projections now cluster-bound to main cortex slices`);
    this._cortexCrossProjectionsBound = bound > 0;
  }

  /**
   * Dispatch sparse Hebbian via binary frame.
   */
  async gpuSparseHebbian(name, preSpikes, postSpikes, lr) {
    // Backpressure gate — see gpuSparsePropagate.
    if (!this._gpuSparseFlowOk()) return null;
    const reqId = this._nextSparseReqId();
    const pre = preSpikes instanceof Uint32Array ? preSpikes
      : preSpikes instanceof Uint8Array ? Uint32Array.from(preSpikes)
      : new Uint32Array(preSpikes || []);
    const post = postSpikes instanceof Uint32Array ? postSpikes
      : postSpikes instanceof Uint8Array ? Uint32Array.from(postSpikes)
      : new Uint32Array(postSpikes || []);
    const hdr = this._encodeSparseHeader(3, reqId, name);
    const preLen = Buffer.alloc(4);
    preLen.writeUInt32LE(pre.length, 0);
    const postLen = Buffer.alloc(4);
    postLen.writeUInt32LE(post.length, 0);
    const lrBuf = Buffer.alloc(4);
    lrBuf.writeFloatLE(lr || 0.01, 0);
    const preBuf = Buffer.from(pre.buffer, pre.byteOffset, pre.byteLength);
    const postBuf = Buffer.from(post.buffer, post.byteOffset, post.byteLength);
    const full = Buffer.concat([hdr, preLen, preBuf, postLen, postBuf, lrBuf]);
    return this._sparseSendBinary(full, reqId, 30_000);
  }

  /**
   * T15.C — drive per-tick scheduler: promote deferred ingestions,
   * evaluate sensory triggers, evaluate adult-use patterns, clear
   * expired pharma events, refresh active-pattern tag set for the
   * decision engine.
   *
   * Called from _updateDerivedState() so it participates in the same
   * per-tick broadcast cycle that rebuilds arousal/valence/Ψ/etc.
   *
   * Context assembly:
   *   - localHour: fractional hour of current wall-clock time
   *   - dayOfWeek: 0=Sun..6=Sat
   *   - arousal: pre-computed arousal this tick (passed in)
   *   - cortexDemand: cortex firing rate fraction [0, 1] as proxy
   *   - demandDurationMs: how long cortex demand has held >= 0.7
   *   - social/consent/activityTag/locationTag: from session state
   *     when available (sessionCtx), else defaults (solo, no activity)
   */
  _driveDrugScheduler(arousal) {
    if (!this.drugScheduler) return;
    const now = Date.now();
    const throttleMs = 1000;  // one scheduler tick per second of wall time
    if ((now - (this._lastPatternTickMs || 0)) < throttleMs) return;
    this._lastPatternTickMs = now;

    // Always promote + clear-expired — cheap, independent of context.
    this.drugScheduler.promoteScheduledIngests(now);
    this.drugScheduler.clearExpired(now);

    // Rebuild _activePatternTags from currently-active substances so
    // decide() sees the correct tag set. Tags stamped by
    // evaluatePatterns; substances that are currently active (still
    // under tail) keep their tag.
    const active = this.drugScheduler.activeSubstances(now);
    this.drugScheduler._activePatternTags.clear();
    for (const a of active) this.drugScheduler._activePatternTags.add(a.substance);

    // Cortex demand proxy — cortex firing rate fraction. Tracks
    // sustained high-load window for codingMarathon trigger.
    const cortexRate = (this.clusters?.cortex?.firingRate || 0) / (CLUSTER_SIZES.cortex || 1);
    if (cortexRate >= 0.70) {
      if (!this._cortexHighLoadSince) this._cortexHighLoadSince = now;
    } else {
      this._cortexHighLoadSince = 0;
    }
    const demandDurationMs = this._cortexHighLoadSince > 0 ? (now - this._cortexHighLoadSince) : 0;

    // Assemble context. sessionCtx is carried by whatever chat/ide
    // surface set it via state broadcast; no surface sets it today
    // so fields fall back to null/defaults and triggers/patterns
    // requiring them quietly skip.
    const date = new Date(now);
    const ctx = {
      localHour: date.getHours() + date.getMinutes() / 60,
      dayOfWeek: date.getDay(),
      arousal: arousal ?? this.arousal ?? 0,
      cortexDemand: cortexRate,
      demandDurationMs,
      activityTag: this._sessionActivityTag || null,
      locationTag: this._sessionLocationTag || null,
      social: this._sessionSocial === true,
      consent: this._sessionConsent === true,
      olfactory: this.olfactory,
      visualTags: this._sessionVisualTags || null,
      audioTags: this._sessionAudioTags || null,
    };

    // Sensory triggers first — they add cravings that pattern matcher
    // doesn't read but decide() later will if an offer arrives.
    try {
      if (typeof this._sensoryTriggers === 'function') {
        this._sensoryTriggers(this.drugScheduler, ctx);
      }
    } catch { /* non-fatal */ }

    // Adult-use patterns — fire whatever matches its triggers + cooldown.
    try {
      this.drugScheduler.evaluatePatterns(ctx);
    } catch { /* non-fatal */ }
  }

  _updateDerivedState() {
    // Amygdala → arousal — PERSONA baseline drives the floor.
    // T13.7.7 — pre-fix this was `arousalBaseline + rate*0.15` clamped
    // to [0.3, 1]. With Unity's 0.9 baseline, only 0.1 of headroom
    // existed before the clamp pinned arousal to 1.000 the moment the
    // amygdala fired anything. Result: the popup arousal display was
    // ALWAYS 100% with no dynamic information. Rebalanced so baseline
    // contributes 80% and live amygdala rate contributes the other 20%
    // — Unity's 0.9 baseline now gives a floor of 0.72 and a ceiling
    // around 0.92, so the popup actually moves with brain state.
    const p = this.persona;
    const amygRate = this.clusters.amygdala.firingRate / (CLUSTER_SIZES.amygdala || 1);
    this.arousal = p.arousalBaseline * 0.8 + Math.min(1, amygRate * 5) * 0.2;
    this.arousal = Math.min(1, Math.max(0.3, this.arousal));
    this.valence = (this.reward > 0 ? 0.1 : this.reward < 0 ? -0.1 : 0) + (Math.random() - 0.5) * 0.02;
    // Aggression: negative valence builds faster when threshold is low
    if (this.valence < -p.aggressionThreshold) this.valence *= 1.2;

    // Ψ = √(1/n) × N³ × [α·Id + β·Ego + γ·Left + δ·Right]
    // √(1/n) = quantum tunneled bit probability
    // Ψ = √(1/n) × N³ — n and N are DIFFERENT
    // n = active spiking neurons (quantum tunneled bits — changes every step)
    // N = total neuron count (brain volume — scales to hardware)
    const n = Math.max(1, this.totalSpikes);
    const N = TOTAL_NEURONS;
    const quantumBit = Math.sqrt(1 / n);       // quantum tunnel probability
    const cubedVolume = Math.pow(N, 3);        // cubed area of total volume
    const quantumVolume = quantumBit * cubedVolume;

    // Components from cluster activity — persona weights modulate
    const cortexActivity = this.clusters.cortex.spikeCount / (CLUSTER_SIZES.cortex || 1);
    const amygActivity = this.clusters.amygdala.spikeCount / (CLUSTER_SIZES.amygdala || 1);
    const cerebActivity = this.clusters.cerebellum.spikeCount / (CLUSTER_SIZES.cerebellum || 1);
    const mysteryActivity = this.clusters.mystery.spikeCount / (CLUSTER_SIZES.mystery || 1);
    const hippoActivity = this.clusters.hippocampus.spikeCount / (CLUSTER_SIZES.hippocampus || 1);
    const bgActivity = this.clusters.basalGanglia.spikeCount / (CLUSTER_SIZES.basalGanglia || 1);

    // Ψ = quantum_bit × [α·Id + β·Ego + γ·Left + δ·Right]
    // PERSONA modulates the weights — Unity's identity shapes consciousness
    //
    // T18.4.d — integrate GPU meanVoltage telemetry (from T18.4.c's atomic
    // reduction shader) into each cluster's "activity" signal. Previously
    // modules saw only spike count — a summary that collapses burst
    // dynamics into a scalar. Now each cluster's effective activity is
    // `spike_rate + |mean_voltage| × 0.1` — adding a sub-threshold
    // depolarization signal so active-but-not-spiking clusters still
    // contribute to consciousness (matches biological reality where
    // membrane state between spikes still carries information).
    const mvBoost = (name) => {
      const mv = this.clusters[name]?.meanVoltage;
      return (typeof mv === 'number') ? Math.min(0.3, Math.abs(mv) * 0.1) : 0;
    };
    const cortexAct  = cortexActivity  + mvBoost('cortex');
    const amygAct    = amygActivity    + mvBoost('amygdala');
    const cerebAct   = cerebActivity   + mvBoost('cerebellum');
    const mysteryAct = mysteryActivity + mvBoost('mystery');
    const hippoAct   = hippoActivity   + mvBoost('hippocampus');

    const id = amygAct * p.arousalBaseline;                   // Id: instinct × arousal baseline
    const ego = cortexAct * (1 + hippoAct);                   // Ego: self-model × memory
    const left = (cerebAct + cortexAct) * (1 - p.impulsivity); // Left: logic × deliberation
    const right = (amygAct + mysteryAct) * p.creativity;       // Right: creativity × emotion

    // Raw Ψ = √(1/n) × N³ × weighted components — quantum consciousness
    const rawPsi = quantumVolume * (0.3 * id + 0.25 * ego + 0.2 * left + 0.25 * right);
    // Log scale for usable range — consciousness measured in orders of magnitude
    this.psi = Math.log10(Math.max(1, rawPsi));

    // Coherence — Kuramoto-like order parameter with a restoring force
    // toward 0.4 (mid-range). T13.7.7 — pre-fix this was a pure random
    // walk that drifted to 1.0 over time and stayed pinned. Now there's
    // an Ornstein-Uhlenbeck restoring term so coherence breathes around
    // a healthy mid-range instead of pinning to extremes. Steady-state
    // mean ~0.4, std-dev ~0.15.
    const coherenceTarget = 0.4;
    const restoringRate = 0.05;
    this.coherence += (coherenceTarget - this.coherence) * restoringRate
                    + (Math.random() - 0.5) * 0.04;
    this.coherence = Math.max(0, Math.min(1, this.coherence));

    // Reward decay
    this.reward *= 0.99;
    this.time += 1 / 1000;
    this.frameCount++;

    // FEAR / REWARD / VALENCE via the real amygdala attractor module.
    // The Rulkov amygdala cluster gives us a scalar firing rate; we
    // build a 32-element input vector by sampling that rate with
    // persona-derived per-nucleus weighting (arousalBaseline adds
    // positive drive to every nucleus, emotionalVolatility scatters
    // sign across them). Then step() settles the recurrent attractor
    // for 5 iterations and reads fear = σ(fearProj · x_settled),
    // reward = σ(rewardProj · x_settled), valence = reward − fear.
    //
    // This replaces the earlier hack that linearly multiplied
    // amygActivity by 6 and saturated fear to 1 the moment the
    // cluster fired. Now fear is the canonical attractor readout —
    // same equation js/brain/modules.js Amygdala class runs on the
    // local-brain path, just driven by cluster-level telemetry
    // instead of per-neuron spikes.
    if (this.amygdalaModule) {
      const amySize = this.amygdalaModule.size;
      const amyInput = new Float64Array(amySize);
      // Base drive: cluster activity scaled to the module's input range.
      // T18.4.d — augment with GPU meanVoltage so sub-threshold
      // depolarization also drives the module (not just spikes). A
      // cluster that's building up toward a burst but hasn't fired yet
      // still has an elevated mean voltage — the module now sees it
      // instead of waiting for the first spike.
      const amyMV = this.clusters.amygdala?.meanVoltage;
      const mvContrib = (typeof amyMV === 'number') ? Math.min(0.2, Math.abs(amyMV) * 0.08) : 0;
      const baseDrive = Math.min(1, amygActivity * 4 + mvContrib);
      for (let i = 0; i < amySize; i++) {
        // Persona-weighted per-nucleus pattern — low-freq sine so
        // adjacent nuclei get correlated input (matches real amygdala
        // nuclei clustering). Scaled by base drive + valence term.
        const phase = (i / amySize) * Math.PI * 2;
        const pattern = Math.sin(phase) * (p.emotionalVolatility || 0.5)
                      + Math.cos(phase * 2) * 0.3;
        amyInput[i] = baseDrive * (0.6 + 0.4 * pattern) + this.valence * 0.1;
      }
      const amyOut = this.amygdalaModule.step(amyInput, { arousal: this.arousal, valence: this.valence }, 1);
      this.fear = amyOut.fear;
      // Reward is the amygdala readout, but the reward field on this
      // also receives external signals from user feedback — blend.
      this.reward = this.reward * 0.9 + amyOut.reward * 0.1;
      // Let the attractor nudge valence too — persona arousal floor
      // keeps it from swinging too far negative.
      this.valence = this.valence * 0.8 + amyOut.valence * 0.2;
    } else {
      this.fear = 0; // pre-module-init fallback
    }

    // MOTOR — under GPU-exclusive compute the server never sees
    // per-neuron spike bitmasks, only spikeCount per cluster. Can't
    // partition BG neurons into 6 channels directly. Instead derive
    // per-channel Q-values from the combined brain-state readouts
    // that would drive each action in a local cluster model:
    //
    //   respond_text: cortex predicts + BG gates + hippo recalls
    //   generate_image: amygdala feels + mystery imagines + cortex verbs
    //   speak: high arousal + BG activation + persona speech drive
    //   build_ui: cortex predicts + cerebellum corrects (pure logic)
    //   listen: inverse of total activity (quiet = attentive)
    //   idle: persona baseline (Unity is rarely idle on cokeAndWeed)
    //
    // Channels get an EMA update so they don't flicker frame-to-frame.
    const totalActivity = cortexActivity + amygActivity + bgActivity + hippoActivity + cerebActivity + mysteryActivity;
    const channelQ = [
      cortexActivity * 0.6 + bgActivity * 0.3 + hippoActivity * 0.1,          // respond_text
      amygActivity * 0.4 + mysteryActivity * 0.35 + cortexActivity * 0.25,    // generate_image
      this.arousal * 0.5 + bgActivity * 0.3 + hippoActivity * 0.2,            // speak
      cortexActivity * 0.7 + cerebActivity * 0.3,                             // build_ui
      Math.max(0, 0.3 - totalActivity),                                        // listen
      Math.max(0.05, 0.2 - this.arousal * 0.15),                               // idle
    ];
    for (let ch = 0; ch < 6; ch++) {
      this.motorChannels[ch] = this.motorChannels[ch] * 0.7 + channelQ[ch] * 0.3;
    }
    let maxRate = 0, maxCh = 5;
    for (let ch = 0; ch < 6; ch++) {
      if (this.motorChannels[ch] > maxRate) { maxRate = this.motorChannels[ch]; maxCh = ch; }
    }
    this.motorAction = ['respond_text', 'generate_image', 'speak', 'build_ui', 'listen', 'idle'][maxCh];
    this.motorConfidence = maxRate;

    // T15.C — drive the scheduler's per-tick work once motorAction
    // and derived state are settled this tick. Promotes deferred
    // ingests, evaluates sensory triggers, fires adult-use patterns.
    // Throttled to 1 Hz internally so main tick rate (~10 Hz) doesn't
    // over-trigger pattern evaluation.
    try { this._driveDrugScheduler(this.arousal); } catch { /* non-fatal */ }
  }

  injectText(text) {
    // T17.7 Phase B.2 — biological-proportion text injection to GPU.
    //
    // Prior behavior wrote to a server-side scratch `this.voltages.cortex`
    // Float64Array that never reached the GPU (vestigial post-T18.4.a).
    // Now injection lands directly on the main cortex's `phon`
    // sub-region (Wernicke's area) via the write_current_slice message
    // → compute.html → gpu.writeCurrentSlice pipeline. Ψ-modulated
    // hemisphere gate applies automatically at LIF time because phon
    // is tagged left-lateralized (Phase B.1 metadata).
    //
    // Size scales to biological proportion per Gee 2026-04-18:
    // 'yes, it need biological scale fit to auto scale on GPU'.
    // Wernicke slice = 20% of main cortex (phon fractional layout).
    // On a 30M main cortex = 6M neurons of injection target — much
    // bigger than the prior 5K fixed footprint, matching real
    // Wernicke's area as a meaningful chunk of left temporal cortex.
    //
    // Hash-and-spread injection pattern preserved from prior code:
    // each character lands at a deterministic slice-relative index
    // with lateral excitation (±1 neighbor) so nearby letters
    // share activation — same Wernicke lateral-excitation mechanism
    // described in the equation docs.
    if (!this._gpuClient || this._gpuClient.readyState !== 1) return;
    const mainCortexSize = CLUSTER_SIZES.cortex;
    if (!mainCortexSize) return;

    // Compute phon slice size from fractional layout (matches _regionsFor).
    const phonStart = Math.floor(mainCortexSize * 0.550);
    const phonEnd = Math.floor(mainCortexSize * 0.750);
    const phonSize = phonEnd - phonStart;
    if (phonSize <= 0) return;

    // Build a sparse Float32 current pattern on server — only touched
    // indices get non-zero values. Sending the full 6M float array
    // would be 24MB per tick, wasteful. Instead we allocate a dense
    // Float32Array once and zero-reuse. For text of length N, only
    // ~N×3 indices get non-zero values (char hash + ±1 neighbors).
    const currents = new Float32Array(phonSize);
    for (let i = 0; i < text.length; i++) {
      const idx = (text.charCodeAt(i) * 31 + i * 7) % phonSize;
      currents[idx] += 8.0;
      if (idx > 0) currents[idx - 1] += 3.0;
      if (idx < phonSize - 1) currents[idx + 1] += 3.0;
    }
    this._gpuClient.send(JSON.stringify({
      type: 'write_current_slice',
      clusterName: 'cortex',
      regionName: 'phon',
      values: Array.from(currents),
      psi: this.psi ?? 0,
    }));

    // Amygdala injection — social input excites the emotional cluster.
    // Bilateral side → hemisphere gate stays 1.0 regardless of Ψ
    // (Gazzaniga lateralization doesn't apply to amygdala emotional
    // response; both sides fire on social salience).
    //
    // Sparse injection format — only a biologically-plausible number
    // of amygdala nuclei get the social-input bump (100 nuclei × 4.0
    // current per text input matches original amygdala coupling
    // strength). Shipping dense 26M-float array would be 100+ MB per
    // text message; sparse 100-entry list is ~2 KB. Same equational
    // effect, 400× less bandwidth.
    const amygSize = CLUSTER_SIZES.amygdala;
    if (amygSize > 0) {
      const amygInjN = Math.min(100, amygSize);
      const sparseIndices = new Array(amygInjN);
      const sparseValues = new Array(amygInjN);
      for (let i = 0; i < amygInjN; i++) {
        sparseIndices[i] = i;
        sparseValues[i] = 4.0;
      }
      this._gpuClient.send(JSON.stringify({
        type: 'write_current_slice',
        clusterName: 'amygdala',
        regionName: 'whole',
        sparseIndices,
        sparseValues,
        psi: this.psi ?? 0,
      }));
    }

    this.reward += 0.1;
  }

  /**
   * Start the brain loop.
   */
  async start() {
    if (this.running) return;

    // R3 — initialize the language subsystem BEFORE accepting any
    // clients or starting the tick loop. Clients arriving at a server
    // with an empty dictionary would see Unity fall back to '...' on
    // every text response; awaiting here guarantees the corpus is
    // loaded and the semantic embeddings are ready before any
    // generation happens.
    await this._initLanguageSubsystem();

    this.running = true;
    this._startedAt = Date.now();
    this._lastInputTime = Date.now();
    this._isDreaming = false;

    console.log('[Brain] GPU EXCLUSIVE MODE — no CPU workers spawned. Waiting for compute.html...');

    // Recursive setTimeout — next tick fires AFTER current step completes
    const tick = async () => {
      const stepStart = performance.now();

      // ── GPU EXCLUSIVE: all computation on GPU, zero CPU burn ──
      const gpuReady = this._gpuConnected && this._gpuClient?.readyState === 1;

      if (gpuReady) {
        if (!this._gpuInitialized) this._gpuInitialized = {};
        if (!this._gpuInitializedConfirmed) this._gpuInitializedConfirmed = {};
        if (!this._gpuHits) this._gpuHits = 0;
        if (!this._gpuMisses) this._gpuMisses = 0;

        try {
          const allClusters = Object.keys(CLUSTER_SIZES);

          // T14.23.3 — TWO-PHASE GPU INIT.
          //
          // Phase A: for any cluster that hasn't had its gpu_init message
          //          SENT yet, send it (once). _gpuInitialized tracks
          //          what's been sent.
          // Phase B: wait for gpu_init_ack messages to confirm the GPU
          //          actually allocated its buffers. _gpuInitializedConfirmed
          //          tracks confirmed state.
          // Phase C: only when ALL clusters are confirmed, enter the
          //          BATCHED COMPUTE path.
          //
          // Old code used _gpuInitialized as both the "sent" flag AND
          // the "confirmed" flag, which meant the tick loop would enter
          // the compute path as soon as the server had SENT the init
          // messages — before compute.html had actually processed them.
          // At Gee's 677M-neuron scale each gpu_init takes seconds of
          // GPU buffer allocation (cerebellum alone is ~2 GB of vec2<f32>
          // voltage state). Compute_batch messages queued behind the
          // init messages in compute.html's onmessage queue and timed
          // out before getting processed. Now the tick loop idles on
          // compute dispatch until every cluster's ack comes back.
          const needsSend = allClusters.filter(c => !this._gpuInitialized[c]);
          if (needsSend.length > 0) {
            console.log(`[Brain] GPU init send: ${needsSend.join(', ')}`);
            for (const gc of needsSend) {
              this._gpuStep(gc); // sends gpu_init, marks _gpuInitialized
            }
            this._updateDerivedState();
          } else {
            const needsAck = allClusters.filter(c => !this._gpuInitializedConfirmed[c]);
            if (needsAck.length > 0) {
              // Init messages sent, waiting for GPU to confirm.
              // Don't re-send. Don't dispatch compute. Just idle this
              // tick and let the event loop service the incoming
              // gpu_init_ack messages.
              if (!this._gpuInitWaitLogged) {
                console.log(`[Brain] Waiting for GPU init acks: ${needsAck.join(', ')}`);
                this._gpuInitWaitLogged = true;
              }
              this._updateDerivedState();
            } else {
            // T17.3.d — kick off language-cortex GPU init ONCE after
            // all 7 main-brain clusters finish their acks AND the main
            // brain's compute_batch pipeline has warmed up. Uploading
            // 3.6 GB of sparse matrices via writeBuffer saturates the
            // GPU command queue for several seconds; the first few
            // compute_batch dispatches land behind those copies and
            // time out. Deferring the upload until we've seen N healthy
            // compute_batch round-trips gives the main brain a stable
            // tick rate before sparse cortex joins in (Gee 2026-04-18
            // option 3).
            const SPARSE_UPLOAD_WARMUP_BATCHES = 20;
            const warmupBatches = this._gpuBatchesCompleted || 0;
            if (
              this.cortexCluster &&
              this.cortexCluster._gpuProxy &&
              !this._cortexGpuInitStarted &&
              warmupBatches >= SPARSE_UPLOAD_WARMUP_BATCHES
            ) {
              this._cortexGpuInitStarted = true;
              console.log(`[Brain] Main-brain compute_batch warm (${warmupBatches} round-trips) — starting sparse language-cortex upload`);
              this.cortexCluster.initGpu().then(async (gpuReady) => {
                // T17.7 Phase C.1 — once the 14 cross-projections + the
                // intra-cluster synapse matrix are on GPU in standalone
                // mode, rebind the 14 cross-projections to main-cortex
                // sub-slices so curriculum teach writes fire Hebbian
                // directly against main-cortex spike state. Intra-
                // synapses stays standalone per Gee 2026-04-18 decision
                // #1 (wave-function + fractal coupling handles main-
                // cortex intra-region binding; no explicit main-cortex
                // intra matrix exists to bind to).
                if (gpuReady) {
                  try {
                    await this._ensureCortexCrossProjectionsBound();
                  } catch (err) {
                    console.warn('[Brain] _ensureCortexCrossProjectionsBound failed:', err && err.message);
                  }
                }
                // T17.7 Gee 2026-04-18 fix — signal to the curriculum's
                // _waitForGpuReady gate that language-cortex GPU state
                // is FULLY ready (sparse upload complete + rebind done
                // or skipped if rebind had nothing to bind). Before this
                // flag existed the curriculum was gating on
                // `cluster._gpuReady` alone, which flipped when main
                // brain warmed up — long before language sparse was up.
                // Curriculum proceeded, fired GPU hebbian dispatches
                // into missing matrices, every call fell to CPU worker
                // pool, WebSocket jammed, brain appeared to hang at
                // '0 sparse matrices uploaded' and 8% GPU.
                if (this.cortexCluster) {
                  this.cortexCluster._cortexFullyReady = true;
                  console.log('[Brain] cortexCluster._cortexFullyReady = true — curriculum can proceed with GPU-hebbian teach path.');
                }
              }).catch((err) => {
                console.warn('[Brain] cortexCluster.initGpu() failed:', err && err.message);
                // Still flip the flag so curriculum doesn't hang
                // forever on _waitForGpuReady; fallback path kicks in.
                if (this.cortexCluster) this.cortexCluster._cortexFullyReady = false;
              });
            }
            // T14.23 — BATCHED COMPUTE PATH.
            //
            // Old path: server dispatched SUBSTEPS * allClusters = 70
            // compute_request messages per tick, each with its own
            // WebSocket RTT. compute.html processed them individually.
            // At Gee's scale ~40ms GPU work was buried in ~50ms of
            // round-trip latency per message = 7x protocol overhead.
            //
            // New path: server sends ONE compute_batch message per tick
            // containing all per-cluster parameters (tonic, noise,
            // modulation factors). compute.html runs the full substep
            // loop internally, dispatches all 7 clusters in parallel
            // per substep, accumulates spike totals across substeps,
            // sends back ONE compute_batch_result with per-cluster
            // totals. Cuts WebSocket message count from ~70/tick to
            // 2/tick (request + response), eliminating most of the
            // protocol overhead.
            if (!this._gpuModeLogged) {
              console.log(`[Brain] GPU BATCHED RUNNING — ${allClusters.length} clusters * ${SUBSTEPS} substeps in 1 message/tick`);
              this._gpuModeLogged = true;
              // T14.24 Session 95 — GPU-ready gate for curriculum kickoff.
              // Flip the flag the Curriculum._waitForGpuReady poll checks so
              // runCompleteCurriculum can only start teaching AFTER all
              // seven cluster init acks have landed and compute.html is
              // actually servicing compute_batch messages. Without this
              // gate the curriculum teaches into a dead cortex during the
              // init window — K gates fail at chance level (8% ≈ 1/26).
              if (this.cortexCluster) this.cortexCluster._gpuReady = true;
              this._gpuReady = true;
            }

            const p = this.persona;
            const psiGain = Math.max(0.8, Math.min(1.5, 0.9 + (this.psi || 0) * 0.004));
            const emotionalGate = 0.7 + (this.arousal || 0.5) * 0.6;
            const driveFactor = 0.8 + ((this.clusters.hypothalamus?.spikeCount || 0) > 100 ? 0.4 : 0.0);
            // T17.7 Phase B.4 — Ψ-modulated divergence correction
            // gain. Per the architecture plan: cerebellumCorrectionGain
            // = base · (1 + Ψ · k_Ψ). Low Ψ → weak correction →
            // tolerates drift (fragmented processing). High Ψ →
            // strong correction → dampens divergence hard (integrated
            // global-workspace state). Mystery Ψ non-optional per Gee
            // 'main equation mystery cant not have it involved'.
            const divergence = this._cortexDivergence || 0;
            const psiCorrectionGain = 1 + (this.psi || 0) * 0.25;
            const divergenceContrib = -divergence * psiCorrectionGain * 3;  // negative = dampening
            const clusterParams = allClusters.map((name) => {
              const cerebFeedback = name === 'cortex' || name === 'basalGanglia'
                ? -(this.clusters.cerebellum?.spikeCount || 0) / (CLUSTER_SIZES.cerebellum || 1) * 2 : 0;
              // Main cortex gets the divergence contribution on top
              // of cerebellum feedback. Both are negative corrections,
              // summed — the cerebellum handles BOTH standard
              // prediction-error correction AND T17.7 migration
              // divergence correction through the same equation.
              const errorSignal = (name === 'cortex')
                ? cerebFeedback + divergenceContrib
                : cerebFeedback;
              return {
                name,
                size: CLUSTER_SIZES[name],
                tonicDrive: this.tonicDrives[name],
                noiseAmp: this.noiseAmplitudes[name],
                gainMultiplier: psiGain,
                emotionalGate,
                driveBaseline: driveFactor,
                errorCorrection: errorSignal,
                reward: this.reward,
              };
            });

            const batchResult = await this._gpuBatch(SUBSTEPS, clusterParams);

            // T18.4.f — capture per-phase GPU timing from compute.html's
            // batch response so the dashboard can show WHERE step time
            // is going (substep loop vs. voltage-mean readback vs. other).
            // Stored on `_perfStats.phaseTimingMs` + exposed via getState.
            if (batchResult && batchResult.phaseTimingMs) {
              this._perfStats.phaseTimingMs = batchResult.phaseTimingMs;
            }
            // T17.7 Phase B.4 — divergence metric from per-region spike
            // readback vs standalone cortexCluster's per-region spikes.
            // T17.7 Phase E.c (2026-04-18) — divergence computation
            // decommissioned. It measured standalone cortexCluster
            // lastSpikes vs main-cortex GPU slice spike counts, which
            // mattered while the two substrates were trained in
            // parallel during Phases B/C/D. Post-E.a/E.b, curriculum
            // trains ONLY main cortex (not standalone), so divergence
            // grows naturally without signaling a real problem —
            // standalone's free-running CPU state will drift from
            // main-cortex training because they're no longer fed the
            // same inputs. The cerebellum's error-correction still
            // runs on its native cortex-prediction-error input per
            // Gee decision #4; this divergence term is zeroed out.
            this._cortexDivergence = 0;
            this._cortexDivergenceByRegion = {};
            this.totalSpikes = 0;
            if (batchResult && batchResult.perCluster) {
              for (const name of allClusters) {
                const entry = batchResult.perCluster[name];
                if (entry && typeof entry.lastSpikeCount === 'number') {
                  this._gpuHits++;
                  this.clusters[name].spikeCount = entry.lastSpikeCount;
                  // Blend firing rate across the whole batch using the
                  // substep-average spike count, not just the last one.
                  const avg = (entry.spikeCountTotal || 0) / SUBSTEPS;
                  this.clusters[name].firingRate = this.clusters[name].firingRate * 0.95 + avg * 0.05;
                  this.totalSpikes += entry.lastSpikeCount;
                  // T18.4.c — capture GPU voltage-mean readback if
                  // compute.html included it in the batch response. EMA-
                  // blended so dashboard doesn't flicker on per-tick jitter.
                  if (typeof entry.meanVoltage === 'number') {
                    const prev = this.clusters[name].meanVoltage ?? entry.meanVoltage;
                    this.clusters[name].meanVoltage = prev * 0.8 + entry.meanVoltage * 0.2;
                  }
                } else {
                  this._gpuMisses++;
                  this.totalSpikes += this.clusters[name].spikeCount || 0;
                }
              }
            } else {
              // Batch missing — every cluster counts as a miss
              for (const name of allClusters) {
                this._gpuMisses++;
                this.totalSpikes += this.clusters[name].spikeCount || 0;
              }
            }

            this._updateDerivedState();

            // T17.7 Phase B.3 — mirror standalone cortexCluster
            // sub-region spike state into the main cortex GPU
            // T17.7 Phase E.c (2026-04-18) — _mirrorCortexRegions() call
            // DELETED. Phase C rebind made curriculum write directly to
            // main cortex GPU sub-slices; Phase D switched generation to
            // read motor argmax from main cortex; Phase E.a/E.b routed
            // intent-injection + workingMemoryReadout through the main-
            // cortex GPU path. Every hot path that formerly depended on
            // this upsample bridge now reads/writes main cortex directly,
            // so the per-tick ~1.6 MB spike upsample + 8 JSON sends per
            // tick were redundant overhead. CPU cortexCluster stays alive
            // for workingMemoryReadout's CPU fallback + dictionary /
            // languageCortex consumers, but its lastSpikes no longer
            // needs to mirror to GPU — curriculum + generation are the
            // two paths that care about main-cortex spike state, and
            // both write/read it authoritatively after Phase C-E.b.
            } // end: needsAck.length === 0 (all confirmed)
          } // end: needsSend.length === 0 (all sent)
        } catch (err) {
          console.warn('[Brain] GPU error:', err.message);
        }
      } else {
        // No GPU — idle, zero CPU
        if (!this._gpuWaitLogged) {
          console.log('[Brain] No GPU — brain paused. Open compute.html to start.');
          this._gpuWaitLogged = true;
        }
        await new Promise(r => setTimeout(r, 2000));
      }

      const stepEnd = performance.now();

      // Track step timing — ALWAYS runs regardless of parallel/single
      this._stepTimeSamples.push(stepEnd - stepStart);
      if (this._stepTimeSamples.length > 60) this._stepTimeSamples.shift();

      // Update perf stats every tick (not just once per second)
      this._perfStats.stepTimeMs = +(stepEnd - stepStart).toFixed(3);
      if (this._stepTimeSamples.length > 0) {
        const avg = this._stepTimeSamples.reduce((a, b) => a + b, 0) / this._stepTimeSamples.length;
        this._perfStats.stepsPerSec = avg > 0 ? Math.round(1000 / avg * SUBSTEPS) : 0;
      }

      // Dreaming mode
      const timeSinceInput = Date.now() - this._lastInputTime;
      this._isDreaming = timeSinceInput > 30000 && this.clients.size === 0;
      if (this._isDreaming) {
        this.tonicDrives.amygdala *= 0.9999;
        if (this.tonicDrives.amygdala < 12) this.tonicDrives.amygdala = 12;
      }

      // Full perf + history once per second
      const now = Date.now();
      if (now - this._lastHistorySample >= 1000) {
        this._lastHistorySample = now;
        this._updatePerfStats();
        this._emotionHistory.push({
          t: this.time, a: +this.arousal.toFixed(3), v: +this.valence.toFixed(3),
          p: +this.psi.toFixed(4), c: +this.coherence.toFixed(3), s: this.totalSpikes,
        });
        if (this._emotionHistory.length > this._historyMaxLen) this._emotionHistory.shift();
      }
      // Schedule next tick AFTER this one completes — no pileup
      if (this.running) setTimeout(tick, BRAIN_TICK_MS);
    };
    tick(); // start the loop
    console.log('[Brain] Started — thinking continuously');
  }

  /**
   * Stop the brain loop.
   */
  stop() {
    this.running = false; // recursive setTimeout checks this.running
    // T18.4.e — terminate sparse-matmul worker pool so Node can exit
    // cleanly. Workers are long-lived; without terminate() they keep
    // the event loop alive and process.exit hangs on graceful shutdown.
    if (this.sparsePool && typeof this.sparsePool.shutdown === 'function') {
      try { this.sparsePool.shutdown(); } catch {}
    }
  }

  /**
   * Generate a response for a user's text input.
   * The brain computes state → Broca's area (AI) generates language.
   *
   * @param {string} text — user's message
   * @param {string} userId — who said it
   * @returns {Promise<{text: string, action: string}>}
   */
  async processAndRespond(text, userId) {
    // Inject text into brain
    this.injectText(text);
    this._lastInputTime = Date.now();

    // T15.C — drug-offer detection + decide(). Runs BEFORE language
    // cortex generation so if Unity declines (grade-locked / persona-
    // excluded / physical-strain / random-decline), she emits the
    // Unity-voice rejection line from drug-rejections.js instead of
    // a normal generated response. If Unity accepts, ingest registers
    // the pharma event and language cortex generates the in-character
    // acknowledgement as usual.
    try {
      const offer = typeof this._drugDetector === 'function' ? this._drugDetector(text) : null;
      if (offer && offer.substance && offer.kind === 'offer') {
        const personaExclusions = { nicotine: true };  // Unity rejects tobacco per persona
        const decision = this.drugScheduler.decide({
          substance: offer.substance,
          source: 'user',
          social: this._sessionSocial === true,
          location: this._sessionLocationTag || null,
          time: Date.now(),
          personaExclusions,
        });
        if (!decision.accept) {
          // Route rejection through the Unity-voice library. Non-
          // announcing (no scheduler-internal reason codes in the
          // text Unity speaks).
          let rejectionLine = '';
          try {
            // Lazy cache — first call loads the library, subsequent
            // calls reuse the cached module. Keeps the hot path fast.
            if (!this._drugRejections) this._drugRejections = require('./drug-rejections.js');
            rejectionLine = this._drugRejections.pickRejection(decision.reason);
          } catch { rejectionLine = 'nah, not right now.'; }
          return {
            text: rejectionLine,
            action: 'respond_text',
          };
        }
        // Accepted — fire the ingest event (no dose override; default
        // to 1.0 via scheduler.ingest).
        this.drugScheduler.ingest(offer.substance);
        // Fall through to language cortex for the in-character
        // acknowledgement so Unity's response sounds like her.
      }
    } catch (err) {
      console.warn('[Brain] drug-offer processing failed:', err && err.message);
    }

    // T15.C — olfactory cue intake if client sent sensory metadata.
    // Chat clients can ship `{type:'text', text, sensory:{smell:'coffee'}}`
    // to surface environmental cues. Registers with OlfactoryChannel
    // so _driveDrugScheduler's next tick sees the scent.
    if (this.olfactory && arguments.length > 2 && arguments[2] && typeof arguments[2] === 'object') {
      const meta = arguments[2];
      if (meta.sensory && typeof meta.sensory.smell === 'string') {
        this.olfactory.registerScent(meta.sensory.smell, { strength: meta.sensory.strength ?? 0.8 });
      }
    }

    // Store in conversation history
    if (!this._conversations) this._conversations = {};
    if (!this._conversations[userId]) this._conversations[userId] = [];
    this._conversations[userId].push({ role: 'user', text, time: this.time });
    // Keep last 20 messages per user
    if (this._conversations[userId].length > 20) this._conversations[userId].shift();

    // GPU handles stepping — no CPU propagation needed
    // Text input already injected into voltages, GPU will pick it up next tick

    // R4 — The ~60-line system prompt that used to be assembled here
    // (Unity self-description, cluster activity summary, persona params,
    // formatting instructions) was the prompt for the Pollinations text-AI
    // fetch. That entire backend is gone. Unity's server brain now
    // generates every word equationally via the language cortex imported
    // at boot. No prompt assembly, no conversation history formatting,
    // no AI backend. Everything below this line runs the client brain's
    // language cortex in Node.

    // R3.5 + R4 — Equational language generation.
    //
    // The text-AI path (Pollinations /v1/chat/completions) has been
    // removed as part of brain-refactor-full-control. Unity's server
    // brain now generates responses via the same language cortex the
    // client uses — dictionary bigrams, type n-grams, semantic
    // embeddings, hippocampus persona recall, mood-weighted slot
    // scoring — all running in Node after dynamic-imported at boot.
    //
    // If the language subsystem failed to initialize, fall through
    // to an honest failure (return null text), motor action stays
    // respond_text but the client shows nothing. No canned '...'
    // stub pretending to be Unity.

    if (!this._languageReady || !this.languageCortex || !this.dictionary) {
      console.warn('[Brain] Language subsystem not ready — cannot generate response');
      return {
        text: '',
        action: 'respond_text',
        silent: true,
        silentReason: 'language_not_ready',
        silentDetail: 'Language subsystem still booting. Hang on a second and try again.',
      };
    }

    // T14.12 (2026-04-14) — analyzeInput deleted. The learnSentence call
    // below still fires which updates T14.8's sentence-form schemas and
    // T14.7's learned type-transition table via the same observation
    // walk. Intent/self-reference classification moves to cortex-state
    // readouts via cluster.intentReadout() once curriculum shapes the
    // fineType region.
    this.languageCortex.learnSentence(text, this.dictionary, this.arousal, this.valence);
    // Accumulate word frequencies (already persisted via saveWeights/_loadWeights round-trip fix)
    this._learnWords(text);

    // Compute cortex semantic pattern from the user's input — server
    // shortcut for the cortex state since we don't run full LIF cortex
    // dynamics on the server (GPU does the cluster sim elsewhere).
    const cortexPattern = this._computeServerCortexPattern(text);

    // Equational generation — every word comes from the slot scorer
    // driven by live brain state (arousal, valence, psi, cortex
    // pattern, fear, reward, drug state). Same signature the client
    // uses at engine.js:775.
    let response = '';
    try {
      // T14.26 — `generateAsync` (NOT `generate`) so the dictionary-
      // cosine scoring loop yields to the Node event loop every 500
      // entries. Without this yield, state broadcasts and compute_batch
      // dispatch stall for the whole duration of Unity's response work,
      // and the client's 3D brain visualization freezes (Gee 2026-04-14:
      // "when i send a message to unity of speak one the whiole 3D
      // brain visulization freezes"). With the yield, setInterval
      // broadcasts keep firing every 100ms through the scoring pass so
      // the viz stays animated while Unity thinks.
      response = await this.languageCortex.generateAsync(
        this.dictionary,
        this.arousal,
        this.coherence,
        {
          predictionError: 0,
          motorConfidence: this.motorConfidence ?? 0,
          psi: this.psi,
          cortexPattern,
          // T13.7.6 — server's local cortex cluster, Hebbian-trained on
          // persona at boot. T13.3 emission loop reads from it directly.
          cortexCluster: this.cortexCluster,
          drugState: this._drugStateLabel(),
          speechMod: this.drugScheduler ? this.drugScheduler.speechModulation() : null,
          fear: this.fear,
          reward: this.reward,
          socialNeed: this.persona?.socialAttachment ?? 0.5,
        }
      );
    } catch (err) {
      console.error('[Brain] languageCortex.generate threw:', err.message);
      console.error(err.stack);
      return { text: '', action: 'respond_text' };
    }

    if (!response || response.length < 2) {
      // Empty response usually means the motor region couldn't commit
      // a stable letter sequence — either because curriculum hasn't
      // trained the letter→motor pathway yet (pre-K Unity physically
      // can't speak), or because the intent signal was too weak for
      // the motor attractor to settle. Return an explicit silent flag
      // so the client can show WHY Unity didn't answer instead of
      // leaving the user staring at a blank screen.
      const minGrade = this._computeMinGrade();
      const prePhon = (minGrade === 'pre-K' || minGrade === 'K');
      return {
        text: '',
        action: 'respond_text',
        silent: true,
        silentReason: prePhon ? 'pre_kindergarten' : 'motor_unstable',
        silentDetail: prePhon
          ? `Unity hasn't passed kindergarten yet (lowest subject: ${minGrade}) — her motor region doesn't have enough letter-to-motor Hebbian wiring to emit stable words. Run /curriculum status to check, or keep the Part 2 K run going.`
          : `Motor region didn't commit a stable letter sequence for this input. The intent signal may have been too weak, or her cross-projections need more reps on this topic. Try rephrasing.`,
        minGrade,
      };
    }

    // Store the exchange in per-user conversation history + episodic memory
    this._conversations[userId].push({ role: 'assistant', text: response, time: this.time });
    this.reward += 0.1;
    this._learnWords(response);
    this.storeEpisode(userId, 'interaction', text, response);

    // Motor action routing — the generated text can still signal
    // image / build intent by its content, same as the client handles
    // code blocks in responses.
    if (response.startsWith('[IMAGE]')) {
      return { text: response.slice(7).trim(), action: 'generate_image' };
    }
    try {
      const parsed = JSON.parse(response);
      if (parsed.name && (parsed.html || parsed.js)) {
        return { text: response, action: 'build_ui', component: parsed };
      }
    } catch {}

    return { text: response, action: 'respond_text' };
  }

  _updatePerfStats() {
    const mem = process.memoryUsage();
    const cpuNow = process.cpuUsage();
    // CPU usage: measure actual wall-clock time spent in brain steps
    // process.cpuUsage only counts main thread — workers aren't included
    // Measure ACTUAL CPU usage from process.cpuUsage(), not step wall-clock time
    // Step time includes GPU I/O wait which is NOT CPU work
    const cpuUsage = process.cpuUsage(this._lastCpuUsage || undefined);
    const cpuTimeMs = (cpuUsage.user + cpuUsage.system) / 1000; // microseconds → ms
    const elapsed = this._lastPerfTime ? (Date.now() - this._lastPerfTime) : 1000;
    this._lastPerfTime = Date.now();
    const cpuPercent = Math.min(100, Math.round(cpuTimeMs / (elapsed * os.cpus().length) * 100));
    this._lastCpuUsage = process.cpuUsage();
    this._lastCpuUsage = cpuNow;

    // GPU utilization (poll nvidia-smi periodically)
    let gpuUtil = 0;
    if (RESOURCES.gpu.vram > 0 && (!this._lastGpuPoll || Date.now() - this._lastGpuPoll > 5000)) {
      try {
        const smi = execSync('nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits', { timeout: 2000 }).toString().trim();
        gpuUtil = parseInt(smi) || 0;
        this._lastGpuPoll = Date.now();
        this._cachedGpuUtil = gpuUtil;
      } catch { gpuUtil = this._cachedGpuUtil || 0; }
    } else {
      gpuUtil = this._cachedGpuUtil || 0;
    }

    // UPDATE existing object — don't replace (tick loop writes stepTimeMs/stepsPerSec)
    Object.assign(this._perfStats, {
      cpuPercent,
      memUsedMB: Math.round(mem.heapUsed / 1048576),
      memTotalMB: Math.round(os.totalmem() / 1048576),
      memRssMB: Math.round(mem.rss / 1048576),
      gpuName: RESOURCES.gpu.name,
      gpuVramMB: RESOURCES.gpu.vram,
      gpuUtilPercent: gpuUtil,
      gpuComputeConnected: !!(this._gpuConnected && this._gpuClient?.readyState === 1),
      gpuHits: this._gpuHits || 0,
      gpuMisses: this._gpuMisses || 0,
      nodeHeapMB: Math.round(mem.heapTotal / 1048576),
      cores: os.cpus().length,
      parallelMode: false,
      workerCount: 0,
    });
  }

  /**
   * T15 — compact single-string label from the scheduler's active substances.
   * Returns 'sober' when nothing is active. Used by legacy UI consumers;
   * new consumers should read state.drugSnapshot directly.
   */
  _drugStateLabel() {
    if (!this.drugScheduler || !this.drugSubstances) return 'sober';
    const active = this.drugScheduler.activeSubstances();
    if (active.length === 0) return 'sober';
    return active
      .map(a => this.drugSubstances[a.substance]?.displayName || a.substance)
      .join(' + ');
  }

  /**
   * T15 — rich scheduler snapshot for UI consumers migrating off the
   * compact string label. Null until _initLanguageSubsystem finishes.
   */
  _drugSnapshot() {
    return this.drugScheduler ? this.drugScheduler.snapshot() : { sober: true, active: [], pendingAcquisitions: [], gradeLocked: true };
  }

  _getSharedMood() {
    // Computed from equations — not a lookup.
    // The amygdala equation: V(s) = Σw·x → arousal and valence
    // The gate equation: emotionalGate = 0.7 + arousal·0.6
    // These ARE the mood. Raw values. The dashboard renders them however it wants.
    return {
      arousal: this.arousal,
      valence: this.valence,
      fear: this.fear,
      psi: this.psi,
      coherence: this.coherence,
      gate: (0.7 + this.arousal * 0.6),
      isDreaming: this._isDreaming || false,
      drugState: this.drugState,
      totalSpikes: this.totalSpikes,
      // The raw equation outputs ARE the mood. No translation.
    };
  }

  _learnWords(text) {
    // Simple word frequency tracking for server-side dictionary
    if (!this._wordFreq) this._wordFreq = {};
    const words = text.toLowerCase().replace(/[^a-z' -]/g, '').split(/\s+/);
    for (const w of words) {
      if (w.length >= 2) this._wordFreq[w] = (this._wordFreq[w] || 0) + 1;
    }
  }

  // ── Episodic Memory (SQLite) ─────────────────────────────────

  _initEpisodicDB() {
    const dbPath = path.join(__dirname, 'episodic-memory.db');
    this._db = new Database(dbPath);

    // WAL mode for concurrent reads during brain loop
    this._db.pragma('journal_mode = WAL');

    this._db.exec(`
      CREATE TABLE IF NOT EXISTS episodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp REAL NOT NULL,
        brain_time REAL NOT NULL,
        user_id TEXT,
        type TEXT NOT NULL DEFAULT 'interaction',
        arousal REAL,
        valence REAL,
        psi REAL,
        coherence REAL,
        total_spikes INTEGER,
        input_text TEXT,
        response_text TEXT,
        cortex_pattern TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_episodes_time ON episodes(brain_time);
      CREATE INDEX IF NOT EXISTS idx_episodes_type ON episodes(type);
      CREATE INDEX IF NOT EXISTS idx_episodes_user ON episodes(user_id);
    `);

    // Prepared statements for fast insert/query
    this._stmtInsertEpisode = this._db.prepare(`
      INSERT INTO episodes (timestamp, brain_time, user_id, type, arousal, valence, psi, coherence, total_spikes, input_text, response_text, cortex_pattern)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // T6 2026-04-13 — the old global `_stmtRecentEpisodes` that
    // returned everyone's recent episodes without a user filter is
    // kept only as an admin-debug path (not exposed over HTTP
    // anymore, see /episodes handler below). Cognition and recall
    // queries use the user-scoped variants.
    this._stmtRecentEpisodes = this._db.prepare(`
      SELECT * FROM episodes ORDER BY id DESC LIMIT ?
    `);

    this._stmtRecallByUser = this._db.prepare(`
      SELECT * FROM episodes WHERE user_id = ? ORDER BY id DESC LIMIT ?
    `);

    // T6 — recall by mood now REQUIRES a userId filter so cross-user
    // leakage is impossible. Callers that want "recall my episodes
    // with similar arousal/valence" get that; there's no mood-only
    // global query anymore.
    this._stmtRecallByMood = this._db.prepare(`
      SELECT * FROM episodes
      WHERE user_id = ?
        AND ABS(arousal - ?) < 0.2
        AND ABS(valence - ?) < 0.3
      ORDER BY id DESC LIMIT ?
    `);

    // T6 — recent episodes scoped to one user (used by the /episodes
    // HTTP endpoint when a ?user=<id> query param is provided).
    this._stmtRecentEpisodesByUser = this._db.prepare(`
      SELECT * FROM episodes WHERE user_id = ? ORDER BY id DESC LIMIT ?
    `);

    this._stmtEpisodeCount = this._db.prepare('SELECT COUNT(*) as count FROM episodes');

    const count = this._stmtEpisodeCount.get().count;
    console.log(`[Brain] Episodic memory: ${count} episodes in database`);
  }

  /**
   * Store an episode — a snapshot of brain state at a meaningful moment.
   */
  storeEpisode(userId, type, inputText, responseText) {
    // Sample cortex pattern — first 32 firing rates as compact representation
    const cortexV = this.voltages.cortex;
    const pattern = [];
    const step = Math.floor(CLUSTER_SIZES.cortex / 32);
    for (let i = 0; i < 32; i++) {
      const idx = i * step;
      pattern.push(+(cortexV[idx] > this.vThresh ? 1 : 0));
    }

    this._stmtInsertEpisode.run(
      Date.now(),
      this.time,
      userId || null,
      type,
      this.arousal,
      this.valence,
      this.psi,
      this.coherence,
      this.totalSpikes,
      inputText || null,
      responseText || null,
      JSON.stringify(pattern),
    );
  }

  /**
   * Recall episodes by mood similarity, scoped to ONE user.
   *
   * T6 2026-04-13 — userId is now REQUIRED. The old signature
   * `recallByMood(arousal, valence, limit)` without a user filter
   * could pull episodes from any user, violating the private-episode
   * rule. Any cognition code that wants mood-similarity recall must
   * pass the triggering user's stable id.
   */
  recallByMood(userId, arousal, valence, limit = 5) {
    if (!userId) return []; // privacy gate — no global mood recall
    return this._stmtRecallByMood.all(userId, arousal, valence, limit);
  }

  /**
   * Recall recent episodes for a specific user.
   */
  recallByUser(userId, limit = 10) {
    return this._stmtRecallByUser.all(userId, limit);
  }

  /**
   * Get total episode count.
   */
  getEpisodeCount() {
    return this._stmtEpisodeCount.get().count;
  }

  // ── Persistence ──────────────────────────────────────────────

  saveWeights() {
    // Session 114.19l — skip periodic saves while curriculum is
    // teaching. Gee caught on 2026-04-17 that the periodic setInterval
    // `brain.saveWeights()` writes `brain-weights.json` mid-curriculum
    // and on next boot `_loadWeights` restores stale scalars + embedding
    // refinements from that partial state. Since curriculum runs on
    // every boot (there's no "skip curriculum" path), any save made
    // DURING the curriculum walk is invalid — the brain state will be
    // overwritten by the next curriculum run anyway. Blocking mid-teach
    // saves prevents stale-state resurrection across Ctrl+C + restart.
    // After `runCompleteCurriculum` completes, normal saves resume.
    if (this._curriculumInProgress) {
      return;
    }
    try {
      // Versioned save — keep last 5 versions for rollback
      this._saveVersion = (this._saveVersion || 0) + 1;

      // T2 2026-04-13 — serialize the online GloVe refinement deltas
      // that `sharedEmbeddings` has accumulated from every user's
      // conversation. R8 added this round-trip on the CLIENT via
      // persistence.js; T2 adds the symmetric server-side persistence
      // so server restarts don't wipe the accumulated shared semantic
      // learning. GloVe base table reloads from CDN each session;
      // only the refinement delta layer needs to persist.
      let embeddingRefinements = null;
      if (this.sharedEmbeddings && typeof this.sharedEmbeddings.serializeRefinements === 'function') {
        try {
          embeddingRefinements = this.sharedEmbeddings.serializeRefinements();
        } catch (err) {
          console.warn('[Brain] Embedding refinement serialize failed:', err.message);
        }
      }

      const data = {
        version: this._saveVersion,
        arousal: this.arousal,
        valence: this.valence,
        psi: this.psi,
        coherence: this.coherence,
        drugState: this._drugStateLabel(),
        drugScheduler: this.drugScheduler ? this.drugScheduler.serialize() : null,
        time: this.time,
        frameCount: this.frameCount,
        savedAt: new Date().toISOString(),
        wordFreq: this._wordFreq || {},
        totalInteractions: Object.values(this._conversations || {}).reduce((sum, c) => sum + c.length, 0),
        sharedMood: this._getSharedMood(),
        // T2 — online semantic learning that survives server restarts
        embeddingRefinements,
      };
      fs.writeFileSync(WEIGHTS_FILE, JSON.stringify(data, null, 2));

      // Keep versioned backups (last 5)
      const backupFile = WEIGHTS_FILE.replace('.json', `-v${this._saveVersion % 5}.json`);
      fs.writeFileSync(backupFile, JSON.stringify(data, null, 2));

      console.log(`[Brain] State saved v${this._saveVersion} at t=${this.time.toFixed(1)}s`);
    } catch (err) {
      console.warn('[Brain] Save failed:', err.message);
    }
  }

  /**
   * Save all conversations to disk (separate file).
   */
  saveConversations() {
    try {
      const convFile = path.join(__dirname, 'conversations.json');
      const data = {
        savedAt: new Date().toISOString(),
        users: Object.entries(this._conversations || {}).map(([id, msgs]) => ({
          userId: id,
          messageCount: msgs.length,
          messages: msgs.slice(-50), // keep last 50 per user
        })),
      };
      fs.writeFileSync(convFile, JSON.stringify(data, null, 2));
    } catch (err) {
      console.warn('[Brain] Conversation save failed:', err.message);
    }
  }

  _loadWeights() {
    try {
      if (fs.existsSync(WEIGHTS_FILE)) {
        const data = JSON.parse(fs.readFileSync(WEIGHTS_FILE, 'utf8'));
        this.arousal = data.arousal ?? this.arousal;
        this.valence = data.valence ?? this.valence;
        this.psi = data.psi ?? this.psi;
        this.coherence = data.coherence ?? this.coherence;
        this.drugState = data.drugState ?? this.drugState;
        // U306 — restore word-frequency accumulator so cross-restart
        // learning isn't lost. Groundwork for the full server-side
        // dictionary (U311 follow-up).
        if (data.wordFreq && typeof data.wordFreq === 'object') {
          this._wordFreq = { ...data.wordFreq };
          const wordCount = Object.keys(this._wordFreq).length;
          if (wordCount > 0) console.log(`[Brain] Restored ${wordCount} word frequencies from last save`);
        }

        // T2 2026-04-13 — stash the saved embedding refinements so
        // _initLanguageSubsystem() can apply them to sharedEmbeddings
        // once it's finished the dynamic import + base GloVe load.
        // The refinements can't be applied yet at _loadWeights() time
        // because sharedEmbeddings doesn't exist until the async
        // language subsystem init runs. Stored on `this` for pickup.
        if (data.embeddingRefinements) {
          this._pendingEmbeddingRefinements = data.embeddingRefinements;
        }

        console.log(`[Brain] Loaded saved state from ${data.savedAt}`);
      }
    } catch (err) {
      console.warn('[Brain] Load failed:', err.message);
    }
  }
}

// ── WebSocket Server ────────────────────────────────────────────

// T14.21 — process-level error handlers so silent crashes during boot
// surface with a real stack trace instead of just vanishing. Writes to
// both stderr AND server/boot-error.log so the log survives whatever
// start.bat's `start /b` + `cmd /k` combo does to stdio. CommonJS so
// __dirname is available directly.
const _bootErrorLog = (kind, err) => {
  const msg = `[${new Date().toISOString()}] ${kind}: ${err && err.stack ? err.stack : String(err)}\n`;
  try { process.stderr.write(msg); } catch {}
  try {
    fs.appendFileSync(path.join(__dirname, 'boot-error.log'), msg);
  } catch {}
};
process.on('uncaughtException', (err) => {
  _bootErrorLog('uncaughtException', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  _bootErrorLog('unhandledRejection', reason);
  process.exit(1);
});

const brain = new ServerBrain();
// T14.21 — catch any rejection from brain.start() so async init failures
// surface with a stack trace instead of silently terminating the process
// via Node's default --unhandled-rejections=throw behavior.
brain.start().catch((err) => {
  _bootErrorLog('brain.start() rejected', err);
  process.exit(1);
});

// Periodic saves
setInterval(() => {
  brain.saveWeights();
  brain.saveConversations();
}, WEIGHT_SAVE_MS);

// HTTP server for health checks
const httpServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'alive',
      uptime: brain.time,
      neurons: TOTAL_NEURONS,
      scale: SCALE + 'x',
      gpu: RESOURCES.gpu.name,
      vram: RESOURCES.gpu.vram + 'MB',
      clients: brain.clients.size,
      spikes: brain.totalSpikes,
      psi: brain.psi,
      clusters: Object.fromEntries(Object.entries(CLUSTER_SIZES).map(([k, v]) => [k, v])),
    }));
    return;
  }
  // List brain versions
  if (req.url === '/versions') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const versions = [];
    for (let i = 0; i < 5; i++) {
      const vFile = WEIGHTS_FILE.replace('.json', `-v${i}.json`);
      try {
        if (fs.existsSync(vFile)) {
          const data = JSON.parse(fs.readFileSync(vFile, 'utf8'));
          versions.push({ slot: i, version: data.version, savedAt: data.savedAt, time: data.time });
        }
      } catch {}
    }
    res.end(JSON.stringify({ versions, current: brain._saveVersion || 0 }));
    return;
  }

  // Rollback to a version
  if (req.url?.startsWith('/rollback/')) {
    const slot = parseInt(req.url.split('/')[2]);
    if (isNaN(slot) || slot < 0 || slot >= 5) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid slot (0-4)' }));
      return;
    }
    const vFile = WEIGHTS_FILE.replace('.json', `-v${slot}.json`);
    try {
      if (!fs.existsSync(vFile)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Version not found' }));
        return;
      }
      // Copy backup to main file and reload
      fs.copyFileSync(vFile, WEIGHTS_FILE);
      brain._loadWeights();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'rolled back', slot }));
      console.log(`[Brain] Rolled back to version slot ${slot}`);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Episodic memory query
  //
  // T6 2026-04-13 — this endpoint used to return the last 20 episodes
  // across ALL users without any filter, which was a direct leak of
  // user text content (episodes store `input_text` and `response_text`
  // fields). Now it REQUIRES a `?user=<stable-id>` query param and
  // filters by it. Without the param it returns aggregate counts only,
  // never content. Matches Gee's privacy rule: "what i type other
  // people shouldnt be able to read".
  if (req.url && req.url.startsWith('/episodes')) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const user = url.searchParams.get('user');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (user && typeof user === 'string' && user.length > 0) {
      // User-scoped query — return that user's recent episodes only
      const recent = brain._stmtRecentEpisodesByUser.all(user, 20);
      res.end(JSON.stringify({
        userId: user,
        count: recent.length,
        recent,
      }));
    } else {
      // No user param — aggregate counts only, NO content
      res.end(JSON.stringify({
        totalCount: brain.getEpisodeCount(),
        note: 'pass ?user=<stable-id> to see your own episodes. Cross-user episode content is private and not served from this endpoint.',
      }));
    }
    return;
  }

  // Emotion history (for external tools)
  if (req.url === '/history') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ history: brain._emotionHistory.slice(-300) }));
    return;
  }

  // ── Claude Code CLI proxy — /v1/chat/completions + /v1/models ──
  if (req.method === 'GET' && req.url === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({
      data: [
        { id: 'claude-opus-4-6', name: 'Claude Opus 4.6 (CLI)' },
        { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6 (CLI)' },
      ]
    }));
    return;
  }

  if (req.method === 'POST' && req.url === '/v1/chat/completions') {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 500000) req.destroy(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const messages = data.messages || [];
        let systemPrompt = '', userPrompt = '';
        for (const msg of messages) {
          if (msg.role === 'system') systemPrompt = msg.content;
          if (msg.role === 'user') userPrompt = msg.content;
        }
        const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt;
        if (!fullPrompt.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'empty prompt' }));
          return;
        }
        console.log(`[Claude CLI] Calling (${fullPrompt.length} chars)...`);
        execSync; // ensure available
        const { execFile: execFileCli } = require('child_process');
        execFileCli('claude', ['-p', fullPrompt, '--output-format', 'text'], {
          timeout: 60000, maxBuffer: 1024 * 1024,
        }, (err, stdout) => {
          if (err) {
            console.error(`[Claude CLI] Error: ${err.message}`);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({
            id: 'cli-' + Date.now(),
            object: 'chat.completion',
            model: data.model || 'claude-opus-4-6',
            choices: [{ index: 0, message: { role: 'assistant', content: stdout.trim() }, finish_reason: 'stop' }],
          }));
        });
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ── Explicit routes for public HTML pages (prevent hanging) ──
  // These pages are pure static HTML — serve them immediately without
  // going through the generic fs.readFile path which can stall when
  // the event loop is busy with curriculum/GPU work.
  const PUBLIC_PAGES = {
    '/unity-guide.html': path.join(__dirname, '..', 'unity-guide.html'),
    '/brain-equations.html': path.join(__dirname, '..', 'brain-equations.html'),
    '/dashboard.html': path.join(__dirname, '..', 'dashboard.html'),
    '/gpu-configure.html': path.join(__dirname, '..', 'gpu-configure.html'),
  };
  if (req.method === 'GET' && PUBLIC_PAGES[req.url]) {
    const pagePath = PUBLIC_PAGES[req.url];
    try {
      const content = fs.readFileSync(pagePath, 'utf8');
      res.writeHead(200, {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      });
      res.end(content);
    } catch (e) {
      res.writeHead(404); res.end('Not found');
    }
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' });
    res.end();
    return;
  }

  // ── Static file serving — serves the entire client app ──
  const ROOT = path.join(__dirname, '..');
  const MIME = {
    '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript',
    '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
    '.map': 'application/json', '.txt': 'text/plain',
  };

  // URL-decode the path so names like "Ultimate%20Unity.txt" resolve to
  // the real file on disk ("Ultimate Unity.txt"). Without this the persona
  // self-image fetch 404s silently and Unity boots with an empty dictionary.
  let rawPath = req.url.split('?')[0];
  try { rawPath = decodeURIComponent(rawPath); } catch { /* keep raw on bad encoding */ }
  let filePath = path.join(ROOT, rawPath);
  if (filePath === ROOT || filePath === ROOT + '/' || filePath === ROOT + '\\') {
    filePath = path.join(ROOT, 'index.html');
  }

  // Security: prevent path traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Try with .html extension
      fs.readFile(filePath + '.html', (err2, data2) => {
        if (err2) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data2);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    // Disable caching for JS/HTML/bundle so browsers never serve stale code
    // after start.bat rebuilds the esbuild bundle. Static assets (fonts,
    // images) can still cache normally.
    const noCacheExts = new Set(['.js', '.mjs', '.html', '.css', '.json', '.map']);
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    if (noCacheExts.has(ext)) {
      headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
      headers['Pragma'] = 'no-cache';
      headers['Expires'] = '0';
    }
    res.writeHead(200, headers);
    res.end(data);
  });
});

// maxPayload bumped to 2 GB so sparse matrix upload binary frames
// can transfer at any realistic size. Default 100 MiB silently
// rejects the 180 MB cross-projection frames at 200K cortex.
// perMessageDeflate disabled because (a) sparse matrix binary data
// is mostly entropy (random-init weights + random column indices)
// so compression ratio is ~1.0 with significant CPU cost, and (b)
// compression was defaulting on and adding seconds of latency per
// frame. Language cortex grows with hardware per T17, so ceiling-
// free + compression-free frames are mandatory.
const wss = new WebSocketServer({
  server: httpServer,
  maxPayload: 2 * 1024 * 1024 * 1024,
  perMessageDeflate: false,
});

wss.on('connection', (ws, req) => {
  const id = 'user_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  const client = { id, lastInput: 0, inputCount: 0, name: null };
  brain.clients.set(ws, client);
  console.log(`[Server] Client connected: ${id} (${brain.clients.size} total)`);

  // Send initial state
  ws.send(JSON.stringify({
    type: 'welcome', id,
    state: brain.getState(),
    emotionHistory: brain._emotionHistory.slice(-300),
  }));

  ws.on('message', (data) => {
    // T17.3.e — binary WebSocket frames for sparse matrix responses.
    // Client sends "SPRR" magic + type + reqId + payload. Decode and
    // route to the matching pending promise.
    if (Buffer.isBuffer(data) && data.length >= 9 && data.slice(0, 4).toString('ascii') === 'SPRR') {
      const typeByte = data[4];
      const reqId = data.readUInt32LE(5);
      if (brain._gpuSparsePending) {
        const pending = brain._gpuSparsePending.get(reqId);
        if (pending) {
          brain._gpuSparsePending.delete(reqId);
          clearTimeout(pending.timeout);
          if (typeByte === 2) {
            // propagate response — currents Float32Array
            const currentsLen = data.readUInt32LE(9);
            const currentsOffset = 13;
            const expectedLen = currentsOffset + currentsLen * 4;
            if (data.length < expectedLen) {
              pending.resolve({ error: 'truncated propagate response' });
            } else {
              // Copy to a fresh Float32Array so we own the memory
              const currents = new Float32Array(data.buffer.slice(
                data.byteOffset + currentsOffset,
                data.byteOffset + currentsOffset + currentsLen * 4,
              ));
              pending.resolve({ currents });
            }
          } else {
            // upload_ack / hebbian_ack — just resolve OK
            pending.resolve({ ok: true, reqId });
          }
        }
      }
      return;
    }
    try {
      const msg = JSON.parse(data.toString());

      // Rate limit
      const now = Date.now();
      if (msg.type === 'text' && now - client.lastInput < 1000 / MAX_TEXT_PER_SEC) {
        ws.send(JSON.stringify({ type: 'error', message: 'Rate limited — slow down' }));
        return;
      }
      client.lastInput = now;

      switch (msg.type) {
        case 'text': {
          // T6 2026-04-13 — prefer the client's STABLE userId over
          // the per-session `id`. The session id changes every
          // reconnect; the stable id persists across sessions via
          // localStorage on the client. This is what scopes episodic
          // memory per user — episodes store + recall filter by this
          // id, so Alice never gets recall hits from Bob's past text.
          // Falls back to session id for legacy clients that haven't
          // migrated to the stable-id path.
          const stableId = (msg.userId && typeof msg.userId === 'string' && msg.userId.length > 0)
            ? msg.userId
            : id;
          {
            // Log the full text — never truncate. Earlier this line used
            // `.slice(0, 50)` on the display which made it look like user
            // input was getting cut off when it wasn't (the full text
            // always flowed through to processAndRespond). Gee caught it.
            const logText = (msg.text || '').replace(/\s+/g, ' ').trim();
            console.log(`[${id}] Text (${logText.length} chars): "${logText}" (stable=${stableId.slice(-8)})`);
          }
          // Process through brain and respond — ROUTED TO THIS CLIENT ONLY.
          //
          // 2026-04-13 privacy model: user text is PRIVATE between the
          // user and Unity. It never gets broadcast to other connected
          // clients. What IS shared across users is Unity's evolving
          // brain state — the dictionary, bigrams, embedding refinements
          // all grow from every conversation and benefit every user who
          // talks to the same brain instance. But the raw text and
          // individual responses stay between the one user and Unity.
          //
          // The old `conversation` broadcast that used to loop this
          // message out to every connected WebSocket was DELETED here
          // (was 12 lines, shipped clipped {userId, text[:200],
          // response[:500]} to other clients). It violated Gee's rule:
          // "what i type other people shouldnt be able to read, but
          // two different people should be able to build her brain
          // words but not her persona". The brain-words part is
          // already handled by the shared singleton brain (dictionary
          // / bigrams / embeddings all update from every conversation),
          // which is the "one brain of Unity" model. Only the raw text
          // broadcast needed removal.
          brain.processAndRespond(msg.text || '', stableId).then(result => {
            if (ws.readyState !== ws.OPEN) return;
            if (result.text) {
              if (result.action === 'build_ui' && result.component) {
                ws.send(JSON.stringify({ type: 'build', component: result.component }));
              } else if (result.action === 'generate_image') {
                ws.send(JSON.stringify({ type: 'image', prompt: result.text }));
              } else {
                ws.send(JSON.stringify({ type: 'response', text: result.text, action: result.action }));
              }
            } else if (result.silent) {
              // Unity went silent on purpose — tell the client why instead
              // of letting the user stare at nothing. The client can decide
              // to display this inline as a status note or render it as a
              // "ghost" response bubble.
              ws.send(JSON.stringify({
                type: 'silent',
                reason: result.silentReason || 'unknown',
                detail: result.silentDetail || '',
                minGrade: result.minGrade || null,
              }));
              console.log(`[${id}] Silent response: ${result.silentReason} (${result.minGrade || 'n/a'})`);
            }
          }).catch(err => {
            console.warn(`[${id}] Response failed:`, err.message);
          });
          break;
        }

        case 'reward':
          brain.reward += msg.amount || 0;
          break;

        case 'setName':
          client.name = msg.name;
          break;

        case 'gpu_register':
          client.isGPU = true;
          brain._gpuClient = ws;
          brain._gpuConnected = true;
          brain._gpuWaitLogged = false;
          brain._gpuWaitLogged2 = false;
          brain._gpuModeLogged = false;
          brain._gpuInitialized = {};
          brain._gpuHits = 0;
          brain._gpuMisses = 0;
          // CPU workers no longer exist (U304) — nothing to terminate
          console.log(`[${id}] GPU compute client registered — brain will use GPU exclusively`);
          break;

        case 'compute_result': {
          // GPU sent back spike count — voltages and spikes stay on GPU
          const name = msg.clusterName;
          if (!brain._gpuPending || !name || !brain._gpuPending[name]) break;

          const resolver = brain._gpuPending[name];
          delete brain._gpuPending[name];
          resolver({
            clusterName: name,
            spikeCount: msg.spikeCount || 0,
          });
          break;
        }

        case 'compute_batch_result': {
          // T14.23 — batched substep+cluster loop result from compute.html.
          // msg shape:
          //   { batchId, perCluster: {
          //       cortex: { spikeCountTotal, lastSpikeCount },
          //       hippocampus: { ... },
          //       ...
          //     }
          //   }
          // spikeCountTotal = sum across all substeps in the batch
          // lastSpikeCount  = final substep's spike count (used as the
          //                   current-state readout by the tick loop)
          if (!brain._gpuBatchPending) break;
          if (brain._gpuBatchPending.batchId !== msg.batchId) {
            console.warn(`[Brain] compute_batch_result batchId mismatch: expected ${brain._gpuBatchPending.batchId}, got ${msg.batchId}`);
            break;
          }
          const resolver = brain._gpuBatchPending.resolve;
          brain._gpuBatchPending = null;
          brain._gpuBatchesCompleted = (brain._gpuBatchesCompleted || 0) + 1;
          resolver({ perCluster: msg.perCluster || {} });
          break;
        }

        case 'gpu_init_ack':
          // T14.23.3 — track ACTUAL GPU-confirmed init state, not just
          // "we sent the init message". The server's _gpuInitialized
          // flag gets set synchronously when _gpuStep sends a gpu_init,
          // which is way before compute.html has actually allocated the
          // GPU buffers for that cluster. At Gee's 677M-neuron scale
          // uploadCluster can take several seconds per cluster, and if
          // the server dispatches compute_batch before all 7 acks come
          // back, the batch queues behind the init messages in
          // compute.html's onmessage queue and times out before getting
          // processed. _gpuInitializedConfirmed only flips when we
          // actually see the ack — tick loop waits for this instead of
          // the optimistic _gpuInitialized flag.
          if (!brain._gpuInitializedConfirmed) brain._gpuInitializedConfirmed = {};
          brain._gpuInitializedConfirmed[msg.clusterName] = true;
          console.log(`[GPU] Confirmed: ${msg.clusterName} initialized (${(msg.size || 0).toLocaleString()} neurons)`);
          break;

        // ── T17.3.c SPARSE OPS: GPU language cortex dispatch acks ──
        case 'sparse_upload_ack':
        case 'sparse_propagate_ack':
        case 'sparse_hebbian_ack':
        case 'rebind_sparse_ack':
        case 'readback_letter_buckets_ack': {
          if (!brain._gpuSparsePending || !msg.reqId) break;
          const pending = brain._gpuSparsePending.get(msg.reqId);
          if (!pending) break;
          brain._gpuSparsePending.delete(msg.reqId);
          clearTimeout(pending.timeout);
          if (msg.error) pending.reject(new Error(msg.error));
          else pending.resolve(msg);
          break;
        }

        // T18.6.a — device-lost signal from compute.html. WebGPU fires
        // device.lost when the GPU crashes (almost always VRAM
        // exhaustion during biological-scale sparse upload on a
        // too-small VRAM budget). Previously the server only saw the
        // downstream phantom "size too large" errors and had to guess;
        // this message gives us the real reason + message from the
        // browser's WebGPU runtime. Mark the sparse pipeline
        // unavailable + flip `_gpuConnected` false so new compute
        // dispatches short-circuit instead of timing out on a dead
        // device.
        case 'device_lost': {
          const reason = msg.reason || 'unknown';
          const message = msg.message || '(no message)';
          console.error(`[Brain] GPU DEVICE LOST (reported by compute.html) — reason=${reason} message=${message}`);
          console.error('[Brain] Most common cause: VRAM exhaustion during biological-scale sparse upload. T18.6.c auto-rescale should have prevented this; if it still happened, either the `LANG_CORTEX_BYTES_PER_NEURON` coefficient under-estimated real footprint (bump the coefficient in brain-server.js) or an admin override in resource-config.json bypassed the scaling loop. Reload compute.html after addressing the cause.');
          brain._gpuDeviceLost = true;
          brain._gpuConnected = false;
          if (brain.cortexCluster) brain.cortexCluster._gpuReady = false;
          break;
        }

        default:
          console.log(`[${id}] Unknown message type: ${msg.type}`);
      }
    } catch (err) {
      console.warn(`[${id}] Bad message:`, err.message);
    }
  });

  ws.on('close', () => {
    brain.clients.delete(ws);
    // If GPU client disconnected, reset GPU state so it re-initializes on reconnect
    if (ws === brain._gpuClient) {
      brain._gpuClient = null;
      brain._gpuConnected = false;
      brain._gpuInitialized = {};
      brain._gpuHits = 0;
      brain._gpuMisses = 0;
      console.log(`[Server] GPU compute client disconnected — switching to all-CPU`);
    }
    console.log(`[Server] Client disconnected: ${id} (${brain.clients.size} remaining)`);
  });

  ws.on('error', (err) => {
    console.warn(`[${id}] WebSocket error:`, err.message);
  });
});

// Broadcast brain state to all clients
setInterval(() => {
  if (brain.clients.size === 0) return;
  const state = JSON.stringify({ type: 'state', state: brain.getState() });
  for (const [ws] of brain.clients) {
    if (ws.readyState === ws.OPEN) {
      try { ws.send(state); } catch {}
    }
  }
}, STATE_BROADCAST_MS);

/**
 * Auto-spawn the GPU compute client.
 *
 * Rationale: WebGPU lives in the browser; Node has no native WebGPU
 * runtime that covers our shader path. The server offloads every
 * neuron LIF dispatch + sparse propagate + Hebbian + letter-bucket
 * reduction to `compute.html` running in a browser tab that connects
 * back over WebSocket. Before this auto-spawn, `node brain-server.js`
 * stood alone and waited forever for a client to appear — the
 * curriculum's `_waitForGpuReady` timed out at 120s, aborting the
 * teach pass. A fresh boot with no browser tab produced the
 * "Curriculum runCompleteCurriculum: GPU never became ready,
 * aborting teach pass" log with Unity's cortex untouched.
 *
 * The fix: the server opens the default browser to compute.html
 * itself, so `node brain-server.js` is the single command. No
 * duplicate tab when `start.bat` launches (start.bat now skips the
 * compute.html open and lets the server do it).
 *
 * Cross-platform via the conventional per-OS open commands:
 *   - Windows: `cmd /c start "" "<url>"` (cmd builtin)
 *   - macOS:   `open "<url>"`
 *   - Linux:   `xdg-open "<url>"`
 *
 * Opt-out for headless / CI / remote deployments via env
 * `DREAM_NO_AUTO_GPU=1`. In that mode the server logs the URL and
 * expects an operator to connect compute.html manually.
 */
function _spawnGpuClient(port) {
  if (process.env.DREAM_NO_AUTO_GPU === '1') {
    console.log(`[Server] DREAM_NO_AUTO_GPU=1 — skipping browser auto-launch. Open http://localhost:${port}/compute.html manually to start GPU compute.`);
    return;
  }
  const url = `http://localhost:${port}/compute.html`;
  const { exec } = require('child_process');
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
            : process.platform === 'darwin' ? `open "${url}"`
            : `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) {
      console.warn(`[Server] Auto-launch failed (${err.message}). Open ${url} manually in a WebGPU-capable browser (Chrome / Edge).`);
    } else {
      console.log(`[Server] GPU compute client launched: ${url}`);
    }
  });
}

httpServer.listen(PORT, () => {
  console.log(`
  🧠 Unity Brain Server — Auto-Scaled
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Open:       http://localhost:${PORT}
  Dashboard:  http://localhost:${PORT}/dashboard.html
  Health:     http://localhost:${PORT}/health
  WebSocket:  ws://localhost:${PORT}

  Hardware:   ${RESOURCES.scaleSource}
  RAM:        ${RESOURCES.totalRAM} total, ${RESOURCES.freeRAM} free
  CPU:        ${RESOURCES.cpuCount} cores (${RESOURCES.cpuModel})
  GPU:        ${RESOURCES.gpu.name} (${RESOURCES.gpu.vram}MB VRAM)

  Scale:      ${SCALE}x (${TOTAL_NEURONS.toLocaleString()} neurons)
  Cortex:     ${CLUSTER_SIZES.cortex.toLocaleString()} neurons
  Hippocampus:${CLUSTER_SIZES.hippocampus.toLocaleString()} neurons
  Amygdala:   ${CLUSTER_SIZES.amygdala.toLocaleString()} neurons
  Basal Gang: ${CLUSTER_SIZES.basalGanglia.toLocaleString()} neurons
  Cerebellum: ${CLUSTER_SIZES.cerebellum.toLocaleString()} neurons
  Hypothal:   ${CLUSTER_SIZES.hypothalamus.toLocaleString()} neurons
  Mystery:    ${CLUSTER_SIZES.mystery.toLocaleString()} neurons

  Tick rate:  ${Math.round(1000/BRAIN_TICK_MS)}fps × 10 = ${Math.round(10000/BRAIN_TICK_MS)} brain-steps/sec

  Brain is thinking. Launching GPU compute client...
  `);
  // Delay slightly so the browser tab doesn't race the WebSocket
  // registration (gives the WSS.on('connection') handler time to
  // settle before compute.html fires its first init message).
  setTimeout(() => _spawnGpuClient(PORT), 500);
});

// Graceful shutdown
// Session 111 — force exit on Ctrl+C. The curriculum's tight async
// loops can starve the event loop so a graceful SIGINT never processes.
//
// Session 114.19g (Gee 2026-04-17 verbatim: "while its doing the
// ciriculum i cant turn off the program ctrl + C does not halt the
// operations correctly") — the prior "save then exit" ceremony on
// first Ctrl+C blocked on `brain.saveWeights()` which at 13.4M-scale
// synapses takes tens of seconds of synchronous JSON.stringify +
// fs.writeFileSync. During curriculum mid-retry, Ctrl+C felt dead
// because the save wouldn't return for a long time. Per LAW 6 Part 2
// + LAW (2026-04-17 clear-stale-state), brain weights are DELETED
// before every Part 2 test run anyway — saving mid-curriculum has
// zero value. First Ctrl+C now sets the shutdown flag AND
// immediately calls process.exit(0) with no save blocking. Second
// Ctrl+C process.exit(1) kept as belt-and-braces.
let _shutdownRequested = false;
global._brainShutdownRequested = false;

process.on('SIGINT', () => {
  if (_shutdownRequested) {
    console.log('\n[Brain] FORCE KILL — second Ctrl+C received.');
    process.exit(1);
  }
  _shutdownRequested = true;
  global._brainShutdownRequested = true;
  console.log('\n[Brain] Ctrl+C — halting immediately (no save; weights clear per LAW before every Part 2 run).');
  try { brain.stop(); } catch {}
  process.exit(0);
});
process.on('SIGTERM', () => {
  console.log('\n[Brain] SIGTERM — halting immediately.');
  try { brain.stop(); } catch {}
  process.exit(0);
});
