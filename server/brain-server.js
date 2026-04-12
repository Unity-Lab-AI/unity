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

const os = require('os');
const { execSync } = require('child_process');

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
const BRAIN_TICK_MS = 16;          // ~60fps brain loop
const STATE_BROADCAST_MS = 100;    // send state to clients 10fps
const WEIGHT_SAVE_MS = 300000;     // save weights every 5 minutes
const WEIGHTS_FILE = path.join(__dirname, 'brain-weights.json');
const MAX_TEXT_PER_SEC = 2;        // rate limit per client

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

    // Update Ψ
    const n = Math.max(1, this.totalSpikes);
    this.psi = Math.pow(Math.sqrt(n), 3) * 0.001;

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

    return {
      time: this.time,
      frameCount: this.frameCount,
      totalSpikes: this.totalSpikes,
      arousal: this.arousal,
      valence: this.valence,
      fear: this.fear,
      psi: this.psi,
      coherence: this.coherence,
      reward: this.reward,
      drugState: this.drugState,
      clusters: clusterStates,
      motor: {
        selectedAction: this.motorAction,
        confidence: this.motorConfidence,
        channelRates: Array.from(this.motorChannels),
      },
      connectedUsers: this.clients.size,
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
    this._tickInterval = setInterval(() => {
      for (let i = 0; i < 10; i++) this.step(); // 10 steps per tick
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

  // ── Persistence ──────────────────────────────────────────────

  saveWeights() {
    try {
      const data = {
        arousal: this.arousal,
        valence: this.valence,
        psi: this.psi,
        coherence: this.coherence,
        drugState: this.drugState,
        time: this.time,
        frameCount: this.frameCount,
        savedAt: new Date().toISOString(),
      };
      fs.writeFileSync(WEIGHTS_FILE, JSON.stringify(data, null, 2));
      console.log(`[Brain] Weights saved at t=${this.time.toFixed(1)}s`);
    } catch (err) {
      console.warn('[Brain] Save failed:', err.message);
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

// Periodic weight save
setInterval(() => brain.saveWeights(), WEIGHT_SAVE_MS);

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
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Unity Brain Server — connect via WebSocket on this port');
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, req) => {
  const id = 'user_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  const client = { id, lastInput: 0, inputCount: 0, name: null };
  brain.clients.set(ws, client);
  console.log(`[Server] Client connected: ${id} (${brain.clients.size} total)`);

  // Send initial state
  ws.send(JSON.stringify({ type: 'welcome', id, state: brain.getState() }));

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
          // Inject text into brain
          brain.injectText(msg.text || '');
          console.log(`[${id}] Text: "${(msg.text || '').slice(0, 50)}"`);
          // TODO: route through processAndRespond for actual responses
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
  WebSocket:  ws://localhost:${PORT}
  Health:     http://localhost:${PORT}/health

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
  console.log('\n[Brain] Shutting down — saving weights...');
  brain.saveWeights();
  brain.stop();
  process.exit(0);
});
process.on('SIGTERM', () => {
  brain.saveWeights();
  brain.stop();
  process.exit(0);
});
