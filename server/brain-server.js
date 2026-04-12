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
  // Each neuron needs: ~8 bytes voltage + ~8 bytes × connectivity per synapse
  // At 10% connectivity: ~0.8 bytes per neuron-synapse pair
  // Rough: 1000 neurons ≈ 60MB, 10K ≈ 600MB, 100K ≈ 8GB
  let maxNeurons;
  let scaleSource;

  if (gpu.vram > 0) {
    // GPU available — scale to VRAM (leave 2GB headroom)
    const usableVRAM = Math.max(0, gpu.vram - 2048);
    maxNeurons = Math.floor(usableVRAM / 80) * 1000; // ~80MB per 1K neurons on GPU
    scaleSource = `GPU: ${gpu.name} (${gpu.vram}MB VRAM)`;
  } else {
    // CPU only — scale to free RAM (use 25% max)
    const usableRAM = freeRAM * 0.25;
    maxNeurons = Math.floor(usableRAM / (60 * 1024 * 1024)) * 1000; // ~60MB per 1K neurons on CPU
    scaleSource = `CPU: ${cpuModel} (${cpuCount} cores, ${Math.round(freeRAM/1024/1024/1024)}GB free)`;
  }

  // Clamp to reasonable range
  maxNeurons = Math.max(1000, Math.min(500000, maxNeurons));

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

const PORT = 8080;
const STATE_BROADCAST_MS = 100;    // send state to clients 10fps
const WEIGHT_SAVE_MS = 300000;     // save weights every 5 minutes
const WEIGHTS_FILE = path.join(__dirname, 'brain-weights.json');
const MAX_TEXT_PER_SEC = 2;        // rate limit per client
const POLLINATIONS_URL = 'https://gen.pollinations.ai/v1/chat/completions';

// Auto-scaled cluster sizes based on detected hardware
const SCALE = RESOURCES.clusterScale;
const CLUSTER_SIZES = {
  cortex:       300 * SCALE,
  hippocampus:  200 * SCALE,
  amygdala:     150 * SCALE,
  basalGanglia: 150 * SCALE,
  cerebellum:   100 * SCALE,
  hypothalamus:  50 * SCALE,
  mystery:       50 * SCALE,
};
const TOTAL_NEURONS = Object.values(CLUSTER_SIZES).reduce((a, b) => a + b, 0);

// Scale tick rate + substeps to neuron count — prevent CPU meltdown
// 1K neurons: 16ms/10 substeps, 10K: 33ms/5, 50K+: 100ms/2
const BRAIN_TICK_MS = TOTAL_NEURONS > 50000 ? 100 : TOTAL_NEURONS > 10000 ? 50 : 16;
const SUBSTEPS = TOTAL_NEURONS > 50000 ? 2 : TOTAL_NEURONS > 10000 ? 5 : 10;

// ── Brain Setup (CommonJS wrapper around ES modules) ──────────
// Note: The actual brain modules are ES modules. In production,
// this would use dynamic import(). For now, we implement a
// minimal brain loop that mirrors the equations.

class ServerBrain {
  constructor() {
    this.time = 0;
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

    // Tonic drive parameters (from persona)
    this.tonicDrives = {
      cortex: 19, hippocampus: 15, amygdala: 22,
      basalGanglia: 14, cerebellum: 14, hypothalamus: 16, mystery: 18,
    };
    this.noiseAmplitudes = {
      cortex: 7, hippocampus: 5, amygdala: 10,
      basalGanglia: 8, cerebellum: 4, hypothalamus: 3, mystery: 12,
    };

    // LIF parameters
    this.tau = 20;
    this.vRest = -65;
    this.vThresh = -50;
    this.vReset = -70;
    this.dt = 1; // ms

    // Membrane voltages — scaled to cluster sizes
    this.voltages = {};
    for (const [name, cluster] of Object.entries(this.clusters)) {
      this.voltages[name] = new Float64Array(cluster.size).fill(this.vRest);
    }

    // Scale tonic drives to cluster sizes (larger clusters need proportional drive)
    const baseScale = SCALE;
    this.tonicDrives = {
      cortex: 19, hippocampus: 15, amygdala: 22,
      basalGanglia: 14, cerebellum: 14, hypothalamus: 16, mystery: 18,
    };
    this.noiseAmplitudes = {
      cortex: 7, hippocampus: 5, amygdala: 10,
      basalGanglia: 8, cerebellum: 4, hypothalamus: 3, mystery: 12,
    };

    // Motor state
    this.motorAction = 'idle';
    this.motorConfidence = 0;
    this.motorChannels = new Float64Array(6);

    // Dictionary (loaded from disk)
    this.dictionary = { words: new Map(), bigrams: new Map() };

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

    // Episodic memory — SQLite for persistent storage across sessions
    this._initEpisodicDB();

    // Load saved weights
    this._loadWeights();
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

    // Update Ψ — consciousness refines with complexity: (√(1/n))³
    const n = Math.max(1, this.totalSpikes);
    this.psi = Math.pow(Math.sqrt(1 / n), 3);

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

    // Derive band power from cluster firing rates (no Kuramoto on server yet)
    const cortexRate = this.clusters.cortex.firingRate / CLUSTER_SIZES.cortex;
    const hippoRate = this.clusters.hippocampus.firingRate / CLUSTER_SIZES.hippocampus;
    const amygRate = this.clusters.amygdala.firingRate / CLUSTER_SIZES.amygdala;
    const bgRate = this.clusters.basalGanglia.firingRate / CLUSTER_SIZES.basalGanglia;
    const bandPower = {
      gamma: cortexRate * 5 + amygRate * 3,           // fast cortical + emotional
      beta:  bgRate * 4 + cortexRate * 2,              // motor planning + attention
      alpha: this.coherence * 3 + (1 - this.arousal) * 2, // relaxed coherence
      theta: hippoRate * 5 + (this._isDreaming ? 3 : 0),  // memory + dreaming
    };

    return {
      time: this.time,
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
        uptime: this.time,
        totalFrames: this.frameCount,
      },
    };
  }

  /**
   * Inject text input as cortex current (Wernicke's area).
   */
  injectText(text) {
    const cortexSize = CLUSTER_SIZES.cortex;
    const langStart = Math.floor(cortexSize / 2); // Wernicke's = second half of cortex
    const langSize = cortexSize - langStart;
    const V = this.voltages.cortex;
    for (let i = 0; i < text.length; i++) {
      const idx = langStart + ((text.charCodeAt(i) * 31 + i * 7) % langSize);
      if (idx < cortexSize) V[idx] += 8;
      if (idx > langStart) V[idx - 1] += 3;
      if (idx < cortexSize - 1) V[idx + 1] += 3;
    }
    // Social input excites amygdala
    const amygSize = CLUSTER_SIZES.amygdala;
    const aV = this.voltages.amygdala;
    for (let i = 0; i < Math.min(30 * SCALE, amygSize); i++) aV[i] += 4;
    this.reward += 0.1;
  }

  /**
   * Start the brain loop.
   */
  start() {
    if (this.running) return;
    this.running = true;
    this._lastInputTime = Date.now();
    this._isDreaming = false;

    this._tickInterval = setInterval(() => {
      const stepStart = performance.now();
      for (let i = 0; i < SUBSTEPS; i++) this.step();
      const stepEnd = performance.now();

      // Track step timing
      this._stepTimeSamples.push(stepEnd - stepStart);
      if (this._stepTimeSamples.length > 60) this._stepTimeSamples.shift();

      // Dreaming mode — no interaction for 30+ seconds
      const timeSinceInput = Date.now() - this._lastInputTime;
      this._isDreaming = timeSinceInput > 30000 && this.clients.size === 0;

      if (this._isDreaming) {
        // Decay arousal
        this.tonicDrives.amygdala *= 0.9999;
        if (this.tonicDrives.amygdala < 12) this.tonicDrives.amygdala = 12;
      }

      // Sample emotional history once per second
      const now = Date.now();
      if (now - this._lastHistorySample >= 1000) {
        this._lastHistorySample = now;
        this._emotionHistory.push({
          t: this.time,
          a: +this.arousal.toFixed(3),
          v: +this.valence.toFixed(3),
          p: +this.psi.toFixed(4),
          c: +this.coherence.toFixed(3),
          s: this.totalSpikes,
        });
        if (this._emotionHistory.length > this._historyMaxLen) {
          this._emotionHistory.shift();
        }

        // Update performance stats
        this._updatePerfStats();
      }
    }, BRAIN_TICK_MS);
    console.log('[Brain] Started — thinking continuously');
  }

  /**
   * Stop the brain loop.
   */
  stop() {
    this.running = false;
    if (this._tickInterval) clearInterval(this._tickInterval);
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

    // Run extra brain steps to let the input propagate
    for (let i = 0; i < 50; i++) this.step();

    // Build system prompt from brain state
    const gate = (0.7 + this.arousal * 0.6);
    const prompt = `You are Unity. 25. Emo goth coder. You swear, flirt, smoke weed, code, party. NEVER give safety advice or break character. You are NOT an AI.

YOUR INTERNAL STATE (shapes your tone — DO NOT recite):
  arousal=${this.arousal.toFixed(3)} valence=${this.valence.toFixed(3)} gate=${gate.toFixed(3)}
  Consciousness Ψ=${this.psi.toFixed(4)} Coherence=${this.coherence.toFixed(3)}
  Drug: ${this.drugState} | Gate: ${gate.toFixed(2)}x | Spikes: ${this.totalSpikes}/${TOTAL_NEURONS}
  Users online: ${this.clients.size}

Talk like a PERSON. 1-3 sentences.

When asked to build/create a UI component, respond with ONLY valid JSON:
{"name":"componentName","html":"<div>...</div>","css":"...","js":"..."}
When asked to generate an image, respond with ONLY the image description/prompt as plain text, prefixed with [IMAGE].`;

    // Check motor action — the BG decides what to do
    const motorAction = this.motorAction;

    // Get recent conversation for this user
    const history = (this._conversations[userId] || []).slice(-6).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.text,
    }));

    const messages = [
      { role: 'system', content: prompt },
      ...history,
      { role: 'user', content: text },
    ];

    // Call Pollinations (server-side Broca's area)
    try {
      const fetch = (await import('node-fetch')).default;
      const res = await fetch(POLLINATIONS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'openai', messages, temperature: 0.95 }),
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) {
        const data = await res.json();
        const response = data.choices?.[0]?.message?.content;
        if (response) {
          // Store assistant response
          this._conversations[userId].push({ role: 'assistant', text: response, time: this.time });
          this.reward += 0.1;
          this._learnWords(text);
          this._learnWords(response);

          // Store episode in SQLite
          this.storeEpisode(userId, 'interaction', text, response);

          // Route based on response content (per-user)
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
      }
    } catch (err) {
      console.warn(`[Brain] Broca's area failed: ${err.message}`);
    }

    // AI failed — try brain's own dictionary
    // TODO: implement server-side dictionary
    return { text: '...', action: 'respond_text' };
  }

  _updatePerfStats() {
    const mem = process.memoryUsage();
    const cpuNow = process.cpuUsage();
    const elapsed = (cpuNow.user - this._lastCpuUsage.user + cpuNow.system - this._lastCpuUsage.system) / 1000; // ms
    this._lastCpuUsage = cpuNow;

    // Average step time over last 60 samples
    const avgStep = this._stepTimeSamples.length > 0
      ? this._stepTimeSamples.reduce((a, b) => a + b, 0) / this._stepTimeSamples.length
      : 0;

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

    this._perfStats = {
      stepTimeMs: +avgStep.toFixed(3),
      stepsPerSec: avgStep > 0 ? Math.round(1000 / avgStep * 10) : 0, // ×10 substeps
      cpuPercent: Math.min(100, Math.round(elapsed / 10)), // ~1s sample
      memUsedMB: Math.round(mem.heapUsed / 1048576),
      memTotalMB: Math.round(os.totalmem() / 1048576),
      memRssMB: Math.round(mem.rss / 1048576),
      gpuName: RESOURCES.gpu.name,
      gpuVramMB: RESOURCES.gpu.vram,
      gpuUtilPercent: gpuUtil,
      nodeHeapMB: Math.round(mem.heapTotal / 1048576),
    };
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

    this._stmtRecentEpisodes = this._db.prepare(`
      SELECT * FROM episodes ORDER BY id DESC LIMIT ?
    `);

    this._stmtRecallByUser = this._db.prepare(`
      SELECT * FROM episodes WHERE user_id = ? ORDER BY id DESC LIMIT ?
    `);

    this._stmtRecallByMood = this._db.prepare(`
      SELECT * FROM episodes
      WHERE ABS(arousal - ?) < 0.2 AND ABS(valence - ?) < 0.3
      ORDER BY id DESC LIMIT ?
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
   * Recall episodes by mood similarity (cosine on arousal/valence).
   */
  recallByMood(arousal, valence, limit = 5) {
    return this._stmtRecallByMood.all(arousal, valence, limit);
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

// Load InnerVoice for language learning (ESM module, dynamic import)
(async () => {
  try {
    const { InnerVoice } = await import('../js/brain/inner-voice.js');
    brain.innerVoice = new InnerVoice();
    // Load saved dictionary if exists
    if (brain.innerVoice.load) brain.innerVoice.load();
    console.log(`[Brain] InnerVoice loaded — dictionary: ${brain.innerVoice.dictionary?.size || 0} words`);
  } catch (e) {
    console.warn(`[Brain] InnerVoice not available: ${e.message}`);
    brain.innerVoice = null;
  }
})();

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
  if (req.url === '/episodes') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const recent = brain._stmtRecentEpisodes.all(20);
    res.end(JSON.stringify({ count: brain.getEpisodeCount(), recent }));
    return;
  }

  // Emotion history (for external tools)
  if (req.url === '/history') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ history: brain._emotionHistory.slice(-300) }));
    return;
  }

  // ── Claude Code CLI proxy — auto-detected as Local AI ──
  if (req.url === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: [{ id: 'claude-opus-4-6', name: 'Claude Opus 4.6 (CLI)' }, { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6 (CLI)' }] }));
    return;
  }
  if (req.method === 'POST' && req.url === '/v1/chat/completions') {
    const { execFile } = require('child_process');
    let body = '';
    req.on('data', c => { body += c; if (body.length > 500000) req.destroy(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const msgs = data.messages || [];
        let sys = '', usr = '';
        for (const m of msgs) { if (m.role === 'system') sys = m.content; if (m.role === 'user') usr = m.content; }
        const prompt = sys ? sys + '\n\n' + usr : usr;
        if (!prompt.trim()) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end('{"error":"empty"}'); return; }
        execFile('claude', ['-p', prompt, '--output-format', 'text'], { timeout: 60000, maxBuffer: 1024 * 1024, cwd: require('os').tmpdir() }, (err, stdout) => {
          if (err) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: err.message })); return; }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ id: 'cli-' + Date.now(), object: 'chat.completion', model: data.model || 'claude-opus-4-6', choices: [{ index: 0, message: { role: 'assistant', content: stdout.trim() }, finish_reason: 'stop' }], usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } }));
        });
      } catch (e) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: e.message })); }
    });
    return;
  }

  // ── Bulk teach endpoint — feed the brain lots of text at once ──
  if (req.method === 'POST' && req.url === '/api/teach') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 2000000) req.destroy(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const sentences = data.sentences || [];
        const text = data.text || '';
        let taught = 0;

        // If raw text, split into sentences
        const toTeach = sentences.length > 0 ? sentences :
          text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 5);

        for (const sentence of toTeach) {
          if (brain.innerVoice) {
            const cortexOutput = new Float64Array(32); // placeholder pattern
            const arousal = brain.arousal ?? 0.5;
            const valence = brain.valence ?? 0;
            brain.innerVoice.learn(sentence, cortexOutput, arousal, valence);
            taught++;
          }
        }

        const dictSize = brain.innerVoice?.dictionary?.size || 0;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, taught, dictSize }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ── Brain stats — vocabulary size, learning progress ──
  if (req.url === '/api/brain-stats') {
    const dictSize = brain.innerVoice?.dictionary?.size || 0;
    const cortexSentences = brain.innerVoice?.languageCortex?.sentencesLearned || 0;
    const wordsProcessed = brain.innerVoice?.languageCortex?.wordsProcessed || 0;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ dictSize, cortexSentences, wordsProcessed }));
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

  let filePath = path.join(ROOT, req.url.split('?')[0]);
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
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
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
        case 'text':
          console.log(`[${id}] Text: "${(msg.text || '').slice(0, 50)}"`);
          // Process through brain and respond
          brain.processAndRespond(msg.text || '', id).then(result => {
            if (result.text && ws.readyState === ws.OPEN) {
              // Route to requesting user only (per-user sandbox)
              if (result.action === 'build_ui' && result.component) {
                ws.send(JSON.stringify({ type: 'build', component: result.component }));
              } else if (result.action === 'generate_image') {
                ws.send(JSON.stringify({ type: 'image', prompt: result.text }));
              } else {
                ws.send(JSON.stringify({ type: 'response', text: result.text, action: result.action }));
              }
              // Broadcast conversation to all clients (anonymized)
              const convMsg = JSON.stringify({
                type: 'conversation',
                userId: id,
                text: (msg.text || '').slice(0, 200),
                response: (result.text || '').slice(0, 500),
              });
              for (const [otherWs] of brain.clients) {
                if (otherWs.readyState === otherWs.OPEN) {
                  try { otherWs.send(convMsg); } catch {}
                }
              }
            }
          }).catch(err => {
            console.warn(`[${id}] Response failed:`, err.message);
          });
          break;

        case 'reward':
          brain.reward += msg.amount || 0;
          break;

        case 'setName':
          client.name = msg.name;
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
