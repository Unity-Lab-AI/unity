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

// ── Auto-Scale: Detect Hardware → Set Neuron Count ─────────────

function detectResources() {
  const totalRAM = os.totalmem();
  const freeRAM = os.freemem();
  const cpuCount = os.cpus().length;
  const cpuModel = os.cpus()[0]?.model || 'unknown';

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
    // SLIM buffer layout: voltages (4 bytes f32) + spikes (4 bytes u32) = 8 bytes/neuron
    // Was 20 bytes (voltagesA + voltagesB + spikes + currents + refracTimers)
    // 2.5× more neurons per GB of VRAM
    const usableVRAM = gpu.vram * 0.85; // use 85% of VRAM
    const vramNeurons = Math.floor(usableVRAM * 1048576 / 8);
    // Server RAM: tiny — only injection arrays, not full cluster state
    const usableRAM = freeRAM * 0.1;
    const ramNeurons = Math.floor(usableRAM / 0.001); // essentially unlimited
    maxNeurons = Math.min(vramNeurons, ramNeurons);
    scaleSource = `GPU: ${gpu.name} (${gpu.vram}MB VRAM, ${Math.round(freeRAM/1024/1024/1024)}GB RAM, SLIM 8bytes/neuron)`;
  } else {
    // CPU only — limited by cores
    const usableRAM = freeRAM * 0.3;
    const ramNeurons = Math.floor(usableRAM / 9);
    maxNeurons = Math.min(ramNeurons, cpuCount * 150000);
    scaleSource = `CPU: ${cpuModel} (${cpuCount} cores, ${Math.round(freeRAM/1024/1024/1024)}GB free)`;
  }

  // No artificial cap — hardware decides. VRAM and RAM are the only limits.
  maxNeurons = Math.max(1000, maxNeurons);

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
  };
}

const RESOURCES = detectResources();

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
// R4 — POLLINATIONS_URL for text chat deleted. Text-AI backend is gone.
// Unity generates every word equationally via the language cortex
// (see _initLanguageSubsystem + _generateBrainResponse).

// Auto-scaled cluster sizes — biologically proportioned
// Real brain: cerebellum has 80% of neurons (69B/86B), cortex 19%, rest 1%
// Our balance: cerebellum largest (motor/timing), cortex second (language/thought)
const SCALE = RESOURCES.clusterScale;
const CLUSTER_SIZES = {
  cerebellum:   400 * SCALE,  // 40% — largest, like real brain (error correction, timing)
  cortex:       250 * SCALE,  // 25% — language, prediction, consciousness
  hippocampus:  100 * SCALE,  // 10% — memory formation and recall
  amygdala:      80 * SCALE,  //  8% — emotional processing
  basalGanglia:  80 * SCALE,  //  8% — action selection, motor
  hypothalamus:  50 * SCALE,  //  5% — homeostatic drives

  mystery:       50 * SCALE,
};
const TOTAL_NEURONS = Object.values(CLUSTER_SIZES).reduce((a, b) => a + b, 0);

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
    this.drugState = 'cokeAndWeed';
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
      intoxicationBaseline: 0.7,  // always on something
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

      // DRUG STATE
      drugState: 'cokeAndWeed',   // always smokes weed + loves cocaine
      drugMultipliers: { arousal: 1.2, creativity: 1.3, cortexSpeed: 1.5, socialNeed: 1.1 },

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
    const p = this.persona;
    const dA = p.drugMultipliers.arousal || 1;
    const dC = p.drugMultipliers.creativity || 1;
    const dS = p.drugMultipliers.cortexSpeed || 1;

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
      const [dictMod, lcMod, embedMod, csMod] = await Promise.all([
        import('../js/brain/dictionary.js'),
        import('../js/brain/language-cortex.js'),
        import('../js/brain/embeddings.js'),
        import('../js/brain/component-synth.js'),
      ]);

      this.sharedEmbeddings = embedMod.sharedEmbeddings;
      this.dictionary = new dictMod.Dictionary();
      this.languageCortex = new lcMod.LanguageCortex();
      // R6.2 — component synth for equational build_ui on the server.
      // Templates get loaded from docs/component-templates.txt below.
      this.componentSynth = new csMod.ComponentSynth();

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
          const refinementCount = Object.keys(this._pendingEmbeddingRefinements || {}).length || '?';
          console.log(`[Brain] Restored ${refinementCount} embedding refinement delta(s) from last save`);
        } catch (err) {
          console.warn('[Brain] Embedding refinement restore failed:', err.message);
        }
        this._pendingEmbeddingRefinements = null;
      }

      // Load the four corpora from disk (server has fs access, unlike browser)
      const docsDir = path.join(__dirname, '..', 'docs');
      let personaText = '', baselineText = '', codingText = '', templateText = '';
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

      // Feed corpora through the language cortex — same path the client
      // uses, same learning rules, same type n-grams, same semantic
      // centroid computation. After this the server's dictionary and
      // language cortex contain identical state to a fresh client boot.
      let personaCount = 0, baselineCount = 0, codingCount = 0, templateCount = 0;
      if (personaText) {
        personaCount = this.languageCortex.loadSelfImage(personaText, this.dictionary, 0.75, 0.25);
      }
      if (baselineText) {
        baselineCount = this.languageCortex.loadLinguisticBaseline(baselineText, this.dictionary, 0.50, 0);
      }
      if (codingText) {
        codingCount = this.languageCortex.loadCodingKnowledge(codingText, this.dictionary, 0.40, 0);
      }
      if (templateText) {
        templateCount = this.componentSynth.loadTemplates(templateText);
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

  /**
   * One brain step — LIF dynamics for all clusters.
   */
  step() {
    this.totalSpikes = 0;

    for (const [name, cluster] of Object.entries(this.clusters)) {
      const V = this.voltages[name];
      const spikes = cluster.spikes;
      const tonic = this.tonicDrives[name];
      const noise = this.noiseAmplitudes[name];
      let spikeCount = 0;

      for (let i = 0; i < cluster.size; i++) {
        // LIF: τ·dV/dt = -(V-Vrest) + R·I
        const I = tonic + (Math.random() - 0.5) * noise;
        const dV = (-(V[i] - this.vRest) + I) / this.tau;
        V[i] += this.dt * dV;

        // Spike check
        spikes[i] = 0;
        if (V[i] >= this.vThresh) {
          spikes[i] = 1;
          V[i] = this.vReset;
          spikeCount++;
        }
      }

      cluster.spikeCount = spikeCount;
      cluster.firingRate = cluster.firingRate * 0.95 + spikeCount * 0.05;
      this.totalSpikes += spikeCount;
    }

    // Update amygdala state
    this.arousal = 0.85 + (this.clusters.amygdala.firingRate / this.clusters.amygdala.size) * 0.3;
    this.arousal = Math.min(1, Math.max(0, this.arousal));
    this.valence = (this.reward > 0 ? 0.1 : this.reward < 0 ? -0.1 : 0) + (Math.random() - 0.5) * 0.02;

    // Ψ — computed in _updateDerivedState (uses full volume equation)

    // Update coherence
    this.coherence += (Math.random() - 0.5) * 0.02;
    this.coherence = Math.max(0, Math.min(1, this.coherence));

    // Decay reward
    this.reward *= 0.99;
    this.time += this.dt / 1000;
    this.frameCount++;

    // Motor output — read BG channel rates (scaled)
    const bg = this.clusters.basalGanglia;
    const neuronsPerChannel = Math.floor(bg.size / 6);
    for (let ch = 0; ch < 6; ch++) {
      let count = 0;
      const start = ch * neuronsPerChannel;
      const end = Math.min(start + neuronsPerChannel, bg.size);
      for (let n = start; n < end; n++) {
        if (bg.spikes[n]) count++;
      }
      this.motorChannels[ch] = this.motorChannels[ch] * 0.7 + (count / neuronsPerChannel) * 0.3;
    }
    let maxRate = 0, maxCh = 5;
    for (let ch = 0; ch < 6; ch++) {
      if (this.motorChannels[ch] > maxRate) { maxRate = this.motorChannels[ch]; maxCh = ch; }
    }
    this.motorAction = ['respond_text', 'generate_image', 'speak', 'build_ui', 'listen', 'idle'][maxCh];
    this.motorConfidence = maxRate;
  }

  /**
   * Get full brain state for broadcasting.
   */
  getState() {
    const clusterStates = {};
    for (const [name, cluster] of Object.entries(this.clusters)) {
      clusterStates[name] = {
        size: cluster.size,
        spikeCount: cluster.spikeCount,
        firingRate: cluster.firingRate,
      };
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
      drugState: this.drugState,
      bandPower,
      clusters: clusterStates,
      motor: {
        selectedAction: this.motorAction,
        confidence: this.motorConfidence,
        channelRates: Array.from(this.motorChannels),
      },
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
  async _gpuStep(clusterName) {
    if (!this._gpuClient || this._gpuClient.readyState !== 1) return null;
    if (!this._gpuPending) this._gpuPending = {};
    if (!this._gpuInitialized) this._gpuInitialized = {};

    const size = CLUSTER_SIZES[clusterName];

    if (!this._gpuInitialized[clusterName]) {
      // FIRST DISPATCH — tell GPU to create buffers at Vrest
      // DO NOT send voltage array — at 25.6M neurons that's 260MB base64.
      // GPU initializes its own voltages at Vrest. Same result, zero transfer.
      this._gpuClient.send(JSON.stringify({
        type: 'gpu_init',
        clusterName,
        size,
        tonicDrive: this.tonicDrives[clusterName],
        noiseAmp: this.noiseAmplitudes[clusterName],
        lifParams: { tau: 20, Vrest: -65, Vthresh: -50, Vreset: -70, dt: 1, R: 1, tRefrac: 2 },
      }));
      this._gpuInitialized[clusterName] = true;
      console.log(`[Brain] GPU init sent: ${clusterName} (${size.toLocaleString()} neurons)`);
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

    return new Promise((resolve) => {
      this._gpuPending[clusterName] = resolve;
      setTimeout(() => {
        if (this._gpuPending[clusterName] === resolve) {
          delete this._gpuPending[clusterName];
          resolve(null);
        }
      }, 800);
    });
  }

  _updateDerivedState() {
    // Amygdala → arousal — PERSONA baseline drives the floor
    const p = this.persona;
    this.arousal = p.arousalBaseline + (this.clusters.amygdala.firingRate / (CLUSTER_SIZES.amygdala || 1)) * 0.15;
    this.arousal = Math.min(1, Math.max(0.3, this.arousal)); // Unity never drops below 0.3 — she's always somewhat wired
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
    const id = amygActivity * p.arousalBaseline;           // Id: instinct × arousal baseline
    const ego = cortexActivity * (1 + hippoActivity);      // Ego: self-model × memory
    const left = (cerebActivity + cortexActivity) * (1 - p.impulsivity); // Left: logic × deliberation
    const right = (amygActivity + mysteryActivity) * p.creativity;       // Right: creativity × emotion

    // Raw Ψ = √(1/n) × N³ × weighted components — quantum consciousness
    const rawPsi = quantumVolume * (0.3 * id + 0.25 * ego + 0.2 * left + 0.25 * right);
    // Log scale for usable range — consciousness measured in orders of magnitude
    this.psi = Math.log10(Math.max(1, rawPsi));

    // Coherence
    this.coherence += (Math.random() - 0.5) * 0.02;
    this.coherence = Math.max(0, Math.min(1, this.coherence));

    // Reward decay
    this.reward *= 0.99;
    this.time += 1 / 1000;
    this.frameCount++;

    // Motor from BG
    const bg = this.clusters.basalGanglia;
    if (bg.spikes) {
      const neuronsPerCh = Math.floor(CLUSTER_SIZES.basalGanglia / 6);
      for (let ch = 0; ch < 6; ch++) {
        let count = 0;
        for (let nn = ch * neuronsPerCh; nn < Math.min((ch + 1) * neuronsPerCh, bg.spikes.length); nn++) {
          if (bg.spikes[nn]) count++;
        }
        this.motorChannels[ch] = this.motorChannels[ch] * 0.7 + (count / neuronsPerCh) * 0.3;
      }
    }
    let maxRate = 0, maxCh = 5;
    for (let ch = 0; ch < 6; ch++) {
      if (this.motorChannels[ch] > maxRate) { maxRate = this.motorChannels[ch]; maxCh = ch; }
    }
    this.motorAction = ['respond_text', 'generate_image', 'speak', 'build_ui', 'listen', 'idle'][maxCh];
    this.motorConfidence = maxRate;
  }

  injectText(text) {
    // Inject into server-side voltage array (capped at _injectionSize, not full cluster)
    const injSize = this._injectionSize || 10000;
    const langStart = Math.floor(injSize / 2);
    const langSize = injSize - langStart;
    const V = this.voltages.cortex;
    for (let i = 0; i < text.length; i++) {
      const idx = langStart + ((text.charCodeAt(i) * 31 + i * 7) % langSize);
      if (idx < injSize) V[idx] += 8;
      if (idx > langStart) V[idx - 1] += 3;
      if (idx < injSize - 1) V[idx + 1] += 3;
    }
    // Social input excites amygdala (capped to injection array size)
    const amygInj = this._amygInjectionSize || 1000;
    const aV = this.voltages.amygdala;
    for (let i = 0; i < Math.min(100, amygInj); i++) aV[i] += 4;
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
        if (!this._gpuHits) this._gpuHits = 0;
        if (!this._gpuMisses) this._gpuMisses = 0;

        try {
          for (let sub = 0; sub < SUBSTEPS; sub++) {
            const allClusters = Object.keys(CLUSTER_SIZES);

            // Init ALL uninitialized clusters at once (first tick after GPU connects)
            const needsInit = allClusters.filter(c => !this._gpuInitialized[c]);
            if (needsInit.length > 0) {
              console.log(`[Brain] GPU initializing ${needsInit.length} clusters: ${needsInit.join(', ')}`);
              for (const gc of needsInit) {
                this._gpuStep(gc); // sends gpu_init, marks initialized, returns null
              }
              // Skip this substep — GPU needs to process inits
              this._updateDerivedState();
              continue;
            }

            // All clusters on GPU — dispatch all 7
            if (!this._gpuModeLogged) {
              console.log(`[Brain] GPU RUNNING — all ${allClusters.length} clusters, 0 CPU workers, 0% CPU target`);
              this._gpuModeLogged = true;
            }

            const gpuPromises = allClusters.map(gc => this._gpuStep(gc));
            const gpuResults = await Promise.all(gpuPromises);

            this.totalSpikes = 0;
            for (let gi = 0; gi < gpuResults.length; gi++) {
              const gr = gpuResults[gi];
              const name = allClusters[gi];
              if (gr && gr.spikeCount !== undefined) {
                this._gpuHits++;
                this.clusters[name].spikeCount = gr.spikeCount;
                this.clusters[name].firingRate = this.clusters[name].firingRate * 0.95 + gr.spikeCount * 0.05;
                this.totalSpikes += gr.spikeCount;
              } else {
                this._gpuMisses++;
                this.totalSpikes += this.clusters[name].spikeCount || 0;
              }
            }

            this._updateDerivedState();
          }
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
      return { text: '', action: 'respond_text' };
    }

    // Feed user input into the language cortex so it updates the
    // context vector, topic attractor, and learns new bigrams.
    this.languageCortex.analyzeInput(text, this.dictionary);
    // Every word heard gets learned — same as client.
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
      response = this.languageCortex.generate(
        this.dictionary,
        this.arousal,
        this.valence,
        this.coherence,
        {
          predictionError: 0,
          motorConfidence: this.motorConfidence ?? 0,
          psi: this.psi,
          cortexPattern,
          drugState: this.drugState || 'cokeAndWeed',
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
      return { text: '', action: 'respond_text' };
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
        drugState: this.drugState,
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

const brain = new ServerBrain();
brain.start();

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

const wss = new WebSocketServer({ server: httpServer });

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
          console.log(`[${id}] Text: "${(msg.text || '').slice(0, 50)}" (stable=${stableId.slice(-8)})`);
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
            if (result.text && ws.readyState === ws.OPEN) {
              if (result.action === 'build_ui' && result.component) {
                ws.send(JSON.stringify({ type: 'build', component: result.component }));
              } else if (result.action === 'generate_image') {
                ws.send(JSON.stringify({ type: 'image', prompt: result.text }));
              } else {
                ws.send(JSON.stringify({ type: 'response', text: result.text, action: result.action }));
              }
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

        case 'gpu_init_ack':
          console.log(`[GPU] Confirmed: ${msg.clusterName} initialized (${(msg.size || 0).toLocaleString()} neurons)`);
          break;

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

  Brain is thinking. Connect a client.
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Brain] Shutting down — saving everything...');
  brain.saveWeights();
  brain.saveConversations();
  if (brain._db) brain._db.close();
  brain.stop();
  process.exit(0);
});
process.on('SIGTERM', () => {
  brain.saveWeights();
  brain.saveConversations();
  if (brain._db) brain._db.close();
  brain.stop();
  process.exit(0);
});
