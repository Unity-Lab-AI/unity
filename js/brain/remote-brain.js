/**
 * remote-brain.js — WebSocket Client for Server-Side Brain
 *
 * Drop-in replacement for UnityBrain. Instead of running the
 * equations locally, connects to a brain server via WebSocket
 * and relays state + sensory input.
 *
 * app.js auto-detects: if server is available → RemoteBrain.
 * If not → local UnityBrain. Same API, different source.
 *
 * The visualizers, sandbox, voice, chat — all work the same.
 * They just receive state from the server instead of local math.
 *
 * NOTE: even on the server-brain path, we still instantiate a REAL
 * local InnerVoice. The server handles the N-neuron simulation but
 * the language cortex runs client-side so Unity's persona self-image
 * (docs/Ultimate Unity.txt) is loaded into the browser dictionary via
 * the same pure-equation learnSentence() pipeline used by local brain.
 */

import { InnerVoice } from './inner-voice.js';

class EventEmitter {
  constructor() { this._listeners = {}; }
  on(event, fn) { if (!this._listeners[event]) this._listeners[event] = []; this._listeners[event].push(fn); return this; }
  off(event, fn) { const a = this._listeners[event]; if (a) this._listeners[event] = a.filter(f => f !== fn); return this; }
  emit(event, data) { const a = this._listeners[event]; if (a) for (let i = 0; i < a.length; i++) a[i](data); }
}

export class RemoteBrain extends EventEmitter {
  /**
   * @param {string} serverUrl — WebSocket URL (e.g., 'ws://localhost:8080')
   */
  constructor(serverUrl) {
    super();
    this._serverUrl = serverUrl;
    this._ws = null;
    this._connected = false;
    this._userId = null;
    this.running = false;

    // Mirror state from server
    this.state = {
      spikes: null, voltages: null, spikeCount: 0,
      clusters: {}, cortex: null, hippocampus: null,
      amygdala: null, basalGanglia: null, cerebellum: null,
      hypothalamus: null, mystery: null, oscillations: null,
      psi: 0, time: 0, reward: 0, drugState: 'cokeAndWeed',
      totalNeurons: 1000, motor: null, memory: null,
      innerVoice: null, connectedUsers: 0,
    };

    // Dummy subsystems for API compatibility
    this.motor = { selectedAction: 'idle', confidence: 0, isSpeaking: false, _interruptFlag: false,
      interrupt() { this._interruptFlag = true; },
      wasInterrupted() { return this._interruptFlag; },
      getState() { return { selectedAction: this.selectedAction, confidence: this.confidence }; },
    };
    this.auditoryCortex = {
      isActive() { return false; },
      setMotorOutput() {},
      clearMotorOutput() {},
      checkForInterruption() { return true; },
      getState() { return {}; },
    };
    this.visualCortex = {
      isActive() { return false; },
      description: '',
      gazeX: 0.5, gazeY: 0.5, gazeTarget: '',
      getState() { return {}; },
      forceDescribe() {},
      _hasDescribedOnce: true,
      _describing: false,
    };
    this.sensory = { _cameraStream: null };
    // REAL local InnerVoice so loadPersona works and the memory tab shows
    // dictionary / bigram / usage-type stats from the actual persona file.
    // app.js fetches docs/Ultimate Unity.txt and calls loadPersona() on this.
    this.innerVoice = new InnerVoice();
    this.clusters = {};

    this._connect();
  }

  _connect() {
    try {
      this._ws = new WebSocket(this._serverUrl);

      this._ws.onopen = () => {
        this._connected = true;
        console.log(`[RemoteBrain] Connected to ${this._serverUrl}`);
      };

      this._ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this._handleMessage(msg);
        } catch {}
      };

      this._ws.onclose = () => {
        this._connected = false;
        console.log('[RemoteBrain] Disconnected — reconnecting in 3s...');
        setTimeout(() => this._connect(), 3000);
      };

      this._ws.onerror = () => {
        // Will trigger onclose
      };
    } catch {
      console.warn('[RemoteBrain] Connection failed');
      setTimeout(() => this._connect(), 5000);
    }
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case 'welcome':
        this._userId = msg.id;
        if (msg.state) this._applyState(msg.state);
        console.log(`[RemoteBrain] Welcome — user ${this._userId}, ${msg.state?.connectedUsers ?? '?'} users online`);
        break;

      case 'state':
        this._applyState(msg.state);
        this.emit('stateUpdate', this.state);
        break;

      case 'response':
        this.emit('response', { text: msg.text, action: msg.action });
        break;

      case 'build':
        // Server wants to inject a component
        this.emit('build', msg.component);
        break;

      case 'speak':
        this.emit('speak', msg.text);
        break;

      case 'image':
        this.emit('image', msg.url);
        break;

      case 'error':
        console.warn('[RemoteBrain] Server error:', msg.message);
        break;
    }
  }

  _applyState(serverState) {
    if (!serverState) return;
    // Map server state to local state format
    this.state.psi = serverState.psi ?? this.state.psi;
    this.state.time = serverState.time ?? this.state.time;
    this.state.reward = serverState.reward ?? this.state.reward;
    this.state.drugState = serverState.drugState ?? this.state.drugState;
    this.state.spikeCount = serverState.totalSpikes ?? this.state.spikeCount;
    this.state.totalNeurons = serverState.totalNeurons ?? this.state.totalNeurons;
    if (serverState.scale) this.state.scale = serverState.scale;
    if (serverState.totalSpikes !== undefined) this.state.totalSpikes = serverState.totalSpikes;
    if (serverState.time !== undefined) this.state.time = serverState.time;
    if (serverState.frameCount !== undefined) this.state.frameCount = serverState.frameCount;
    this.state.connectedUsers = serverState.connectedUsers ?? 0;

    if (serverState.clusters) this.state.clusters = serverState.clusters;
    if (serverState.motor) {
      this.state.motor = serverState.motor;
      this.motor.selectedAction = serverState.motor.selectedAction;
      this.motor.confidence = serverState.motor.confidence;
    }

    // Derive amygdala from server state
    this.state.amygdala = {
      arousal: serverState.arousal ?? 0.5,
      valence: serverState.valence ?? 0,
      fear: serverState.fear ?? 0,
    };

    this.state.oscillations = {
      coherence: serverState.coherence ?? 0.5,
      bandPower: serverState.bandPower || {},
    };

    if (serverState.innerVoice) this.state.innerVoice = serverState.innerVoice;
    if (serverState.memory) this.state.memory = serverState.memory;
    if (serverState.sharedMood) this.state.sharedMood = serverState.sharedMood;
    if (serverState.perf) this.state.perf = serverState.perf;
    if (serverState.growth) this.state.growth = serverState.growth;

    // Synthesize spike array for 3D visualization.
    // Server runs millions of neurons — render shows proportional sample.
    // AMPLIFY firing rates for visual impact (2% biological rate → 15-30% visual rate).
    if (serverState.clusters) {
      // Dynamic ratios from ACTUAL server cluster sizes — not hardcoded
      const names = ['cortex', 'hippocampus', 'amygdala', 'basalGanglia', 'cerebellum', 'hypothalamus', 'mystery'];
      const totalSize = names.reduce((s, n) => s + (serverState.clusters[n]?.size || 0), 0) || 1;
      const ratios = names.map(n => (serverState.clusters[n]?.size || 0) / totalSize);
      const renderTotal = this.state.spikes?.length || 20000;
      const spikes = new Uint8Array(renderTotal);
      let offset = 0;

      for (let c = 0; c < names.length; c++) {
        const clusterRenderSize = Math.round(ratios[c] * renderTotal);
        const cluster = serverState.clusters[names[c]];

        // Firing rate normalized — all clusters render at equal visual intensity
        const rawRate = cluster ? (cluster.spikeCount || 0) / (cluster.size || 1) : 0;
        const emaRate = cluster ? (cluster.firingRate || 0) / (cluster.size || 1) : 0;
        // Scale multiplier by cluster size ratio so big clusters aren't dimmer
        const sizeRatio = (cluster?.size || 1) / (totalSize / names.length); // >1 for big clusters
        const amplify = 15 + sizeRatio * 5; // bigger cluster → bigger multiplier
        const visualRate = Math.min(0.5, rawRate * amplify + emaRate * amplify * 0.7);

        for (let i = 0; i < clusterRenderSize && offset + i < renderTotal; i++) {
          spikes[offset + i] = Math.random() < visualRate ? 1 : 0;
        }
        offset += clusterRenderSize;
      }
      this.state.spikes = spikes;
    }
  }

  // ── Public API (same as UnityBrain) ──────────────────────────

  getState() { return this.state; }

  start() { this.running = true; }
  stop() { this.running = false; }

  receiveSensoryInput(type, data) {
    if (!this._connected || !this._ws) return;
    this._ws.send(JSON.stringify({ type, [type]: data }));
  }

  async processAndRespond(text) {
    if (!this._connected || !this._ws) {
      return { text: 'Brain server disconnected.', action: 'respond_text' };
    }

    this._ws.send(JSON.stringify({ type: 'text', text }));

    // Wait for response from server
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ text: 'Brain is thinking...', action: 'respond_text' });
      }, 30000);

      const handler = ({ text, action }) => {
        clearTimeout(timeout);
        this.off('response', handler);
        resolve({ text, action });
      };
      this.on('response', handler);
    });
  }

  connectLanguage() {} // handled by server
  connectVoice(v) { this._voice = v; }
  connectImageGen() {} // handled by server
  connectMicrophone() {}
  connectCamera() {}

  giveReward(amount) {
    if (this._connected && this._ws) {
      this._ws.send(JSON.stringify({ type: 'reward', amount }));
    }
  }

  saveBrainState() {} // server handles persistence
  loadSavedState() { return false; }
  exportBrain() { return null; }

  isConnected() { return this._connected; }
  isRemote() { return true; }
}

/**
 * Auto-detect whether a brain server is running.
 * Returns the RemoteBrain if connected, null if not.
 *
 * @param {string} url — WebSocket URL to probe
 * @param {number} timeout — ms to wait
 * @returns {Promise<RemoteBrain|null>}
 */
export async function detectRemoteBrain(url = 'ws://localhost:8080') {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(url);
      const timer = setTimeout(() => {
        ws.close();
        resolve(null);
      }, 3000);

      ws.onopen = () => {
        clearTimeout(timer);
        ws.close();
        console.log(`[RemoteBrain] Server detected at ${url}`);
        resolve(new RemoteBrain(url));
      };

      ws.onerror = () => {
        clearTimeout(timer);
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}
