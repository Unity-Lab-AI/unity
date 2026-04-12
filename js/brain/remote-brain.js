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
 */

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
    this.innerVoice = { save() {}, getState() { return {}; }, learn() {} };
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
