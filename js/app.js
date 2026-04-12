// ═══════════════════════════════════════════════════════════════
// IF ONLY I HAD A BRAIN — Main Entry Point (REWORK)
// ═══════════════════════════════════════════════════════════════
// app.js is a THIN I/O LAYER. The brain runs everything.
// This file: DOM events → brain.receiveSensoryInput()
//            brain events → DOM rendering
// No decisions here. No routing. No classification.
// ═══════════════════════════════════════════════════════════════

import { UnityBrain } from './brain/engine.js';
import { BrocasArea } from './brain/language.js';
import { AIProviders } from './brain/peripherals/ai-providers.js';
import { PollinationsAI } from './ai/pollinations.js';
import { VoiceIO } from './io/voice.js';
import { requestPermissions } from './io/permissions.js';
import { UserStorage } from './storage.js';
import { Sandbox } from './ui/sandbox.js';
import { ChatPanel } from './ui/chat-panel.js';
import { BrainVisualizer } from './ui/brain-viz.js';
import { Brain3D } from './ui/brain-3d.js';
// persona-prompt.js no longer needed — brain equations ARE the personality

// ── Load API keys from env.js ──
let ENV_KEYS = {};
try {
  const env = await import(/* webpackIgnore: true */ './env.js');
  ENV_KEYS = env.ENV_KEYS || {};
  console.log('[Unity] Loaded keys from env.js:', Object.keys(ENV_KEYS).filter(k => ENV_KEYS[k]).join(', ') || 'none');
} catch {
  console.log('[Unity] No env.js found — keys entered in setup modal');
}

// ── Global instances ──
let brain, pollinations, providers, brocasArea, voice, storage, sandbox;
let chatPanel, brainViz, brain3d;
let isRunning = false;

// ── UI State ──
const uiState = {
  micMuted: false,
  chatOpen: false,
  brainVizOpen: false,
  avatarState: 'idle',
  permMic: false,
  permCamera: false,
};

// ── LANDING PAGE: 3D Brain starts IMMEDIATELY ──
import { detectRemoteBrain } from './brain/remote-brain.js';

let landingBrain3d = null;
let landingBrainSource = null; // RemoteBrain or null

(async function initLanding() {
  // Try to connect to server brain for live state
  try {
    landingBrainSource = await detectRemoteBrain();
  } catch {}

  // Init 3D brain on landing container
  try {
    landingBrain3d = new Brain3D('brain-3d-landing');
    // Make the overlay fit inside the landing container, not fullscreen
    if (landingBrain3d._overlay) {
      landingBrain3d._overlay.style.position = 'absolute';
      landingBrain3d._overlay.style.zIndex = '0';
      // Hide elements that collide with landing UI
      const hdr = landingBrain3d._overlay.querySelector('.b3d-hdr');
      if (hdr) hdr.style.display = 'none';
      const foot = landingBrain3d._overlay.querySelector('.b3d-foot');
      if (foot) foot.style.display = 'none';
      const log = landingBrain3d._overlay.querySelector('.b3d-log-wrap');
      if (log) log.style.display = 'none';
      const expansion = landingBrain3d._overlay.querySelector('.b3d-expansion');
      if (expansion) expansion.style.display = 'none';
      // Move cluster toggles down to avoid top stats
      const toggles = landingBrain3d._overlay.querySelector('.b3d-tog-wrap');
      if (toggles) toggles.style.top = '50px';
    }
    landingBrain3d.open();
    console.log('[Landing] 3D brain initialized and visible');
  } catch (err) {
    console.warn('[Landing] 3D brain failed:', err.message);
  }

  // If server brain connected, wire state updates to 3D viz + landing stats + HUD
  if (landingBrainSource) {
    // Show HUD immediately — server data drives it
    const hudEl = document.getElementById('brain-hud');
    if (hudEl) hudEl.classList.remove('hidden');

    landingBrainSource.on('stateUpdate', (state) => {
      _landingState = state;
      if (landingBrain3d) landingBrain3d.updateState(state);
      updateLandingStats(state);
      updateBrainIndicator(state);
    });
    console.log('[Landing] Connected to server brain');
  } else {
    // No server — start a local brain just for visualization
    try {
      const localBrain = new UnityBrain();
      localBrain.start();
      setInterval(() => {
        const state = localBrain.getState();
        if (landingBrain3d) landingBrain3d.updateState(state);
        updateLandingStats(state);
      }, 100);
      console.log('[Landing] Running local brain for visualization');
    } catch {}
  }

  // Wire tab buttons
  let activeTab = '3d';
  document.querySelectorAll('.landing-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.landing-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.tab;
      if (activeTab === '3d') {
        document.getElementById('landing-viz-panel').style.display = 'none';
      } else {
        document.getElementById('landing-viz-panel').style.display = 'block';
        renderLandingTab(activeTab, _landingState);
      }
    });
  });

  // Update viz panel every second
  setInterval(() => {
    if (activeTab !== '3d' && _landingState) {
      renderLandingTab(activeTab, _landingState);
    }
  }, 1000);

  // "TALK TO UNITY" — opens setup modal
  const chatBtn = document.getElementById('landing-chat-btn');
  if (chatBtn) {
    chatBtn.addEventListener('click', () => {
      const modal = document.getElementById('setup-modal');
      if (modal) modal.style.display = '';
    });
  }

  // "FUCK IT — BRAIN ONLY" toggle inside setup modal
  const brainOnlyCb = document.getElementById('brain-only-cb');
  if (brainOnlyCb) {
    brainOnlyCb.addEventListener('change', () => {
      window._brainOnlyMode = brainOnlyCb.checked;
      const textSelect = document.getElementById('text-model-select');
      const textFilter = document.getElementById('text-model-filter');
      const textLabel = document.getElementById('text-model-label');
      const startBtnEl = document.getElementById('start-btn');

      if (brainOnlyCb.checked) {
        if (textSelect) { textSelect.disabled = true; textSelect.style.opacity = '0.3'; }
        if (textFilter) { textFilter.disabled = true; textFilter.style.opacity = '0.3'; }
        if (textLabel) textLabel.innerHTML = '🧠 Text — <span style="color:#ff4d9a;font-weight:700;">BRAIN ONLY</span>';
        if (startBtnEl) { startBtnEl.disabled = false; startBtnEl.textContent = 'Wake Up Unity (Brain Only)'; }
      } else {
        if (textSelect) { textSelect.disabled = false; textSelect.style.opacity = '1'; }
        if (textFilter) { textFilter.disabled = false; textFilter.style.opacity = '1'; }
        if (textLabel) textLabel.textContent = '💬 Text / Chat Model';
        if (startBtnEl) startBtnEl.textContent = 'Wake Up Unity';
      }
    });
  }
})();

let _landingState = null;

function renderLandingTab(tab, s) {
  if (!s) return;
  const el = document.getElementById('landing-viz-content');
  if (!el) return;

  const card = (title, body) => `<div style="margin-bottom:12px;"><div style="font-size:10px;color:#ff4d9a;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">${title}</div>${body}</div>`;
  const metric = (label, val, color = '#e0e0e0') => `<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;"><span style="color:#555;">${label}</span><span style="color:${color};">${val}</span></div>`;
  const bar = (pct, color) => `<div style="height:4px;background:#1a1a1a;border-radius:2px;margin-top:3px;"><div style="width:${Math.min(100,pct)}%;height:100%;background:${color};border-radius:2px;"></div></div>`;

  const arousal = s.amygdala?.arousal ?? s.sharedMood?.arousal ?? 0;
  const valence = s.amygdala?.valence ?? s.sharedMood?.valence ?? 0;
  const coherence = s.oscillations?.coherence ?? s.sharedMood?.coherence ?? 0;
  const psi = s.psi ?? 0;
  const spikes = s.spikeCount ?? s.totalSpikes ?? 0;
  const bp = s.oscillations?.bandPower ?? s.sharedMood?.bandPower ?? {};

  switch (tab) {
    case 'neurons': {
      let html = card('Neuron Population', `
        ${metric('Total', (s.totalNeurons ?? 1000).toLocaleString(), '#ff4d9a')}
        ${metric('Firing', spikes, '#22c55e')}
        ${metric('Rate', ((spikes / (s.totalNeurons ?? 1000)) * 100).toFixed(1) + '%', '#00e5ff')}
      `);
      if (s.clusters) {
        const colors = { cortex:'#ff4d9a', hippocampus:'#a855f7', amygdala:'#ef4444', basalGanglia:'#22c55e', cerebellum:'#00e5ff', hypothalamus:'#f59e0b', mystery:'#c084fc' };
        // Scale bars relative to max cluster activity (not absolute %)
        const maxPct = Math.max(1, ...Object.values(s.clusters).map(c => c.size ? c.spikeCount / c.size * 100 : 0));
        html += card('Cluster Activity', Object.entries(s.clusters).map(([name, c]) => {
          const pct = c.size ? (c.spikeCount / c.size * 100) : 0;
          const barPct = maxPct > 0 ? (pct / maxPct * 100) : 0; // relative to most active cluster
          return `<div style="margin:4px 0;">${metric(name, `${c.spikeCount.toLocaleString()}/${c.size.toLocaleString()} (${pct.toFixed(1)}%)`, colors[name] || '#fff')}${bar(barPct, colors[name] || '#fff')}</div>`;
        }).join(''));
      }
      el.innerHTML = html;
      break;
    }
    case 'oscillations': {
      el.innerHTML = card('Brain Waves', `
        ${metric('Coherence', (coherence * 100).toFixed(0) + '%', '#00e5ff')}
        ${bar(coherence * 100, '#00e5ff')}
        <div style="margin-top:8px;">
        ${metric('Gamma (30-100Hz)', (bp.gamma ?? 0).toFixed(2), '#ff4d9a')}
        ${bar((bp.gamma ?? 0) * 20, '#ff4d9a')}
        ${metric('Beta (13-30Hz)', (bp.beta ?? 0).toFixed(2), '#a855f7')}
        ${bar((bp.beta ?? 0) * 20, '#a855f7')}
        ${metric('Alpha (8-13Hz)', (bp.alpha ?? 0).toFixed(2), '#00e5ff')}
        ${bar((bp.alpha ?? 0) * 20, '#00e5ff')}
        ${metric('Theta (4-8Hz)', (bp.theta ?? 0).toFixed(2), '#22c55e')}
        ${bar((bp.theta ?? 0) * 20, '#22c55e')}
        </div>
      `);
      break;
    }
    case 'consciousness': {
      el.innerHTML = card('Consciousness Ψ', `
        <div style="font-size:32px;font-weight:700;color:#a855f7;text-align:center;padding:12px 0;">${psi.toFixed(6)}</div>
        <div style="font-size:10px;color:#555;text-align:center;">Ψ = (√(1/n))³ · [α·Id + β·Ego + γ·Left + δ·Right]</div>
        ${metric('Drug State', s.drugState || 'cokeAndWeed', '#f59e0b')}
        ${metric('Dreaming', s.isDreaming ? 'YES' : 'no', s.isDreaming ? '#a855f7' : '#555')}
      `);
      break;
    }
    case 'emotions': {
      const gate = (0.7 + arousal * 0.6);
      el.innerHTML = card('Amygdala State', `
        ${metric('Arousal', (arousal * 100).toFixed(0) + '%', '#ff4d9a')}
        ${bar(arousal * 100, '#ff4d9a')}
        ${metric('Valence', valence.toFixed(3), valence >= 0 ? '#22c55e' : '#ef4444')}
        ${bar(((valence + 1) / 2) * 100, valence >= 0 ? '#22c55e' : '#ef4444')}
        ${metric('Fear', (s.amygdala?.fear ?? s.sharedMood?.fear ?? 0).toFixed(3), '#ef4444')}
        ${metric('Emotional Gate', gate.toFixed(2) + '×', '#f59e0b')}
      `);
      break;
    }
    case 'memory': {
      const mem = s.memory || l.memory || {};
      const growth = s.growth || l.growth || {};
      // Also check local brain's dictionary if available
      const localVocab = brain?.innerVoice?.dictionary?.size ?? 0;
      const localSentences = brain?.innerVoice?.languageCortex?.sentencesLearned ?? 0;
      el.innerHTML = card('Memory Systems', `
        ${metric('Working Memory', (mem.workingCount ?? mem.workingMemoryItems?.length ?? 0) + '/7 items', '#00e5ff')}
        ${metric('Episodes (SQLite)', growth.totalEpisodes ?? 0, '#a855f7')}
        ${metric('Words Learned (server)', growth.totalWords ?? 0, '#ff4d9a')}
        ${metric('Words Learned (local)', localVocab, '#ff4d9a')}
        ${metric('Sentences Learned', localSentences, '#a855f7')}
        ${metric('Interactions', growth.totalInteractions ?? 0, '#22c55e')}
        ${metric('Brain Steps', (growth.totalFrames ?? s.frameCount ?? 0).toLocaleString(), '#00e5ff')}
      `);
      break;
    }
    case 'motor': {
      const motor = s.motor || {};
      el.innerHTML = card('Basal Ganglia — Motor Output', `
        ${metric('Selected Action', motor.selectedAction || 'idle', '#22c55e')}
        ${metric('Confidence', (motor.confidence ?? 0).toFixed(3), '#ff4d9a')}
        <div style="margin-top:8px;">
        ${(motor.channelRates || []).map((r, i) => {
          const names = ['respond', 'image', 'speak', 'build', 'listen', 'idle'];
          const colors = ['#ff4d9a', '#a855f7', '#00e5ff', '#22c55e', '#f59e0b', '#555'];
          return `${metric(names[i], r.toFixed(3), colors[i])}${bar(r * 200, colors[i])}`;
        }).join('')}
        </div>
      `);
      break;
    }
    case 'perf': {
      const p = s.perf || l.perf || {};
      el.innerHTML = card('Hardware Performance', `
        ${metric('CPU Usage', (p.cpuPercent ?? 0) + '%', p.cpuPercent > 80 ? '#ef4444' : '#22c55e')}
        ${bar(p.cpuPercent ?? 0, p.cpuPercent > 80 ? '#ef4444' : '#22c55e')}
        ${metric('RAM (Heap)', (p.memUsedMB ?? 0) + 'MB', '#a855f7')}
        ${metric('RAM (RSS)', (p.memRssMB ?? 0) + 'MB', '#a855f7')}
        ${metric('GPU', (p.gpuUtilPercent ?? 0) + '%', '#00e5ff')}
        ${bar(p.gpuUtilPercent ?? 0, '#00e5ff')}
        ${metric('GPU Model', p.gpuName || 'none', '#555')}
        ${metric('VRAM', (p.gpuVramMB ?? 0) + 'MB', '#555')}
        ${metric('Step Time', (p.stepTimeMs ?? 0) + 'ms', '#f59e0b')}
        ${metric('Steps/sec', (p.stepsPerSec ?? 0).toLocaleString(), '#22c55e')}
      `) + card('Brain Scale', `
        ${metric('Total Neurons', (s.totalNeurons ?? 1000).toLocaleString(), '#ff4d9a')}
        ${metric('Scale', s.scale || '1x', '#00e5ff')}
        ${metric('Uptime', ((s.growth?.uptime ?? s.time ?? 0) / 3600).toFixed(1) + 'h', '#22c55e')}
        ${metric('Brain Steps', (s.growth?.totalFrames ?? s.frameCount ?? 0).toLocaleString(), '#a855f7')}
      `);
      break;
    }
    default:
      el.innerHTML = `<div style="color:#555;font-size:11px;">Select a visualization tab</div>`;
  }
}

function updateLandingStats(state) {
  _landingState = state;
  const $ = id => document.getElementById(id);
  const neurons = state.totalNeurons ?? state.neurons ?? 1000;
  const psi = state.psi ?? 0;
  const arousal = state.amygdala?.arousal ?? state.sharedMood?.arousal ?? 0;
  const valence = state.amygdala?.valence ?? state.sharedMood?.valence ?? 0;
  const coherence = state.oscillations?.coherence ?? state.sharedMood?.coherence ?? 0;
  const spikes = state.spikeCount ?? state.totalSpikes ?? 0;
  const users = state.connectedUsers ?? 0;

  const el = (id, text) => { const e = $(id); if (e) e.textContent = text; };
  el('ls-neurons', neurons.toLocaleString() + ' neurons');
  el('ls-subtitle', neurons.toLocaleString() + '-neuron brain simulation — real equations, alive right now');
  el('ls-psi', 'Ψ = ' + psi.toFixed(4));
  el('ls-users', users + ' online');
  el('ls-arousal', (arousal * 100).toFixed(0) + '%');
  el('ls-valence', valence.toFixed(3));
  el('ls-coherence', (coherence * 100).toFixed(0) + '%');
  el('ls-spikes', spikes.toString());

  if (state.perf) {
    el('ls-cpu', state.perf.cpuPercent + '%');
    el('ls-gpu', state.perf.gpuUtilPercent + '%');
  }
}

// ── DOM refs ──
const setupModal = document.getElementById('setup-modal');
const startBtn = document.getElementById('start-btn');
const apiKeyInput = document.getElementById('api-key-input');
const micStatus = document.getElementById('mic-status');
const camStatus = document.getElementById('cam-status');
const unityBubble = document.getElementById('unity-bubble');
const unitySpeech = document.getElementById('unity-speech');
const unityAvatar = document.getElementById('unity-avatar');
const brainIndicator = document.getElementById('brain-indicator');

// ── Known local AI servers ──
const LOCAL_AI_ENDPOINTS = [
  { name: 'Claude Code CLI', url: 'http://localhost:8080', probe: '/v1/models', modelsPath: 'data', modelKey: 'id' },
  { name: 'Ollama', url: 'http://localhost:11434', probe: '/api/tags', modelsPath: 'models', modelKey: 'name' },
  { name: 'LM Studio', url: 'http://localhost:1234', probe: '/v1/models', modelsPath: 'data', modelKey: 'id' },
  { name: 'LocalAI', url: 'http://localhost:8090', probe: '/v1/models', modelsPath: 'data', modelKey: 'id' },
];

let detectedAI = [];
let bestBackend = null;

// ── Cloud AI providers ──
const PROVIDERS = {
  pollinations: {
    name: 'Pollinations', desc: 'Free AI — text, image, audio, video.',
    hint: 'Sign up at pollinations.ai for your key.', link: 'https://pollinations.ai/dashboard',
    url: 'https://gen.pollinations.ai', modelsEndpoint: 'https://gen.pollinations.ai/v1/models',
    needsKey: true, storageKey: 'pollinations',
  },
  openrouter: {
    name: 'OpenRouter', desc: 'One key for 200+ models — Claude, GPT-4, Llama, all of them.',
    hint: 'Free tier available.', link: 'https://openrouter.ai/keys',
    url: 'https://openrouter.ai/api', modelsEndpoint: 'https://openrouter.ai/api/v1/models',
    needsKey: true,
  },
  openai: {
    name: 'OpenAI', desc: 'GPT-4o, o1, and more.',
    hint: 'Requires paid account.', link: 'https://platform.openai.com/api-keys',
    url: 'https://api.openai.com', modelsEndpoint: 'https://api.openai.com/v1/models',
    needsKey: true,
  },
  anthropic: {
    name: 'Claude (Direct)', desc: 'Use your own Anthropic key directly. Download proxy.js above, run "node proxy.js", then paste your key.',
    hint: 'Step 1: Download proxy.js (link above). Step 2: Run "node proxy.js" in terminal. Step 3: Paste your Anthropic key here. Or just use OpenRouter — it includes Claude.',
    link: 'https://console.anthropic.com/settings/keys',
    url: 'https://api.anthropic.com', needsKey: true, corsBlocked: true,
  },
  mistral: {
    name: 'Mistral', desc: 'Mistral Large, Codestral.',
    hint: 'Create account at mistral.ai.', link: 'https://console.mistral.ai/api-keys',
    url: 'https://api.mistral.ai', modelsEndpoint: 'https://api.mistral.ai/v1/models',
    needsKey: true,
  },
  deepseek: {
    name: 'DeepSeek', desc: 'DeepSeek Chat and Coder. Cheap and good.',
    hint: 'Sign up at deepseek.com.', link: 'https://platform.deepseek.com/api_keys',
    url: 'https://api.deepseek.com', modelsEndpoint: 'https://api.deepseek.com/v1/models',
    needsKey: true,
  },
  groq: {
    name: 'Groq', desc: 'Ultra-fast inference. Free tier.',
    hint: 'Sign up at groq.com.', link: 'https://console.groq.com/keys',
    url: 'https://api.groq.com/openai', modelsEndpoint: 'https://api.groq.com/openai/v1/models',
    needsKey: true,
  },
  local: {
    name: 'Local AI', desc: 'Auto-detects Ollama, LM Studio, etc.',
    hint: 'Make sure your local AI server is running.', needsKey: false, isLocal: true,
  },
};

// ═══════════════════════════════════════════════════════════════
// SETUP FLOW (same connect UI as before — keeping it working)
// ═══════════════════════════════════════════════════════════════

async function init() {
  storage = new UserStorage();

  // Seed env.js keys
  for (const [pid, key] of Object.entries(ENV_KEYS)) {
    if (key && !storage.getApiKey(pid)) {
      storage.setApiKey(pid, key);
    }
  }

  // Clear stale CORS-blocked URLs
  const savedUrl = storage.get('custom_ai_url');
  if (savedUrl && savedUrl.includes('api.anthropic.com')) {
    storage.set('custom_ai_url', '');
  }

  startBtn.addEventListener('click', handleStart);

  // Connect buttons
  document.querySelectorAll('.connect-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.connect-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showConnectForm(btn.dataset.ai);
    });
  });

  // Auto-reconnect all saved providers
  const providerIds = ['pollinations', 'openrouter', 'openai', 'anthropic', 'mistral', 'deepseek', 'groq'];
  for (const pid of providerIds) {
    const savedKey = storage.getApiKey(pid);
    if (savedKey && PROVIDERS[pid]) {
      const btn = document.querySelector(`.connect-btn[data-ai="${pid}"]`);
      if (btn) btn.classList.add('connected');
      await autoReconnectProvider(pid, savedKey);
    }
  }

  scanLocalOnly();
  scanAnthropicProxy();
}

// (Keeping the existing connect form, model dropdowns, etc. — same UI code)
// ... [all the showConnectForm, rebuildModelDropdowns, etc. functions stay the same]

async function autoReconnectProvider(providerId, key) {
  const provider = PROVIDERS[providerId];
  if (!provider) return;
  if (providerId === 'pollinations') apiKeyInput.value = key;

  detectedAI = detectedAI.filter(d => d.name !== provider.name && d.name !== provider.name + ' Image');

  if (provider.modelsEndpoint) {
    try {
      const res = await fetch(provider.modelsEndpoint, {
        headers: { 'Authorization': `Bearer ${key}` }, signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json();
        const models = (data.data || data.models || []).map(m => typeof m === 'string' ? m : (m.id || m.name)).filter(Boolean);
        if (models.length > 0) {
          detectedAI.push({ name: provider.name, url: provider.url, models, bestModel: models[0], type: 'cloud', apiKey: key, corsBlocked: provider.corsBlocked || false });
          if (providerId === 'pollinations') {
            try {
              const imgRes = await fetch('https://gen.pollinations.ai/image/models', { headers: { 'Authorization': `Bearer ${key}` }, signal: AbortSignal.timeout(5000) });
              if (imgRes.ok) {
                const imgData = await imgRes.json();
                const imgModels = (Array.isArray(imgData) ? imgData : (imgData.data || [])).map(m => typeof m === 'string' ? m : (m.id || m.name)).filter(Boolean);
                if (imgModels.length > 0) detectedAI.push({ name: provider.name + ' Image', url: provider.url, models: imgModels, bestModel: imgModels[0], type: 'cloud-image' });
              }
            } catch {}
          }
          enableWakeUp(provider.name, models.length);
          return;
        }
      }
    } catch {}
  }

  detectedAI.push({ name: provider.name, url: provider.url, models: ['default'], bestModel: 'default', type: 'cloud', apiKey: key, corsBlocked: provider.corsBlocked || false });
  enableWakeUp(provider.name, 1);
}

function enableWakeUp(providerName, modelCount) {
  addConnectedStatus(providerName, modelCount);
  rebuildModelDropdowns();
  document.getElementById('ai-scan-area').style.display = 'block';
  startBtn.disabled = false;
  startBtn.textContent = 'Wake Her Up';
}

function addConnectedStatus(name, modelCount) {
  const list = document.getElementById('connect-status-list');
  let row = list.querySelector(`[data-provider="${name}"]`);
  if (!row) {
    row = document.createElement('div');
    row.className = 'perm-row';
    row.dataset.provider = name;
    row.innerHTML = `<span class="connect-status-name"></span><span class="status granted">connected</span>`;
    list.appendChild(row);
  }
  row.querySelector('.connect-status-name').textContent = `${name} — ${modelCount} model${modelCount !== 1 ? 's' : ''}`;
}

let _allTextOptions = [];

function rebuildModelDropdowns() {
  const textBackendsRaw = detectedAI.filter(d => (d.type === 'local' || d.type === 'cloud') && !d.corsBlocked);
  const imageBackends = detectedAI.filter(d => d.type === 'cloud-image');
  const textSelect = document.getElementById('text-model-select');
  const imageSelect = document.getElementById('image-model-select');
  const selectorsDiv = document.getElementById('model-selectors');
  const filterInput = document.getElementById('text-model-filter');

  textSelect.innerHTML = '';
  selectorsDiv.style.display = 'block';

  // Sort: Claude (Direct) first, then local AI, then Pollinations, then everything else
  const priority = { 'Claude (Direct)': 0, 'Ollama': 1, 'LM Studio': 1, 'LocalAI': 1, 'Pollinations': 2 };
  const textBackends = textBackendsRaw.sort((a, b) => {
    const pa = priority[a.name] ?? 10;
    const pb = priority[b.name] ?? 10;
    return pa - pb;
  });

  // Default: Claude Direct if available, then local, then first cloud
  const claude = textBackends.find(d => d.name === 'Claude (Direct)');
  const local = textBackends.filter(d => d.type === 'local');
  bestBackend = claude || (local.length > 0 ? local[0] : textBackends[0] || null);

  _allTextOptions = [];
  for (const d of textBackends) {
    for (const model of d.models) {
      _allTextOptions.push({ url: d.url, model, name: d.name, type: d.type, isDefault: bestBackend && d === bestBackend && model === d.bestModel });
    }
  }

  if (filterInput) {
    filterInput.style.display = _allTextOptions.length > 15 ? 'block' : 'none';
    textSelect.style.borderRadius = _allTextOptions.length > 15 ? '0 0 8px 8px' : '8px';
  }
  _applyTextFilter('');

  if (filterInput && !filterInput._wired) {
    filterInput._wired = true;
    filterInput.addEventListener('input', () => _applyTextFilter(filterInput.value.trim().toLowerCase()));
  }

  imageSelect.innerHTML = '';
  for (const d of imageBackends) {
    const group = document.createElement('optgroup');
    group.label = `🎨 ${d.name}`;
    for (const model of d.models) {
      const opt = document.createElement('option');
      opt.value = JSON.stringify({ url: d.url, model, name: d.name });
      opt.textContent = model;
      if (model === d.bestModel) opt.selected = true;
      group.appendChild(opt);
    }
    imageSelect.appendChild(group);
  }
}

function _applyTextFilter(query) {
  const textSelect = document.getElementById('text-model-select');
  textSelect.innerHTML = '';
  const groups = {};
  for (const opt of _allTextOptions) {
    if (query && !opt.model.toLowerCase().includes(query) && !opt.name.toLowerCase().includes(query)) continue;
    if (!groups[opt.name]) groups[opt.name] = { type: opt.type, options: [] };
    groups[opt.name].options.push(opt);
  }
  let firstSelected = false;
  for (const [name, group] of Object.entries(groups)) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = `${group.type === 'local' ? '🖥️' : '☁️'} ${name}`;
    for (const opt of group.options) {
      const el = document.createElement('option');
      el.value = JSON.stringify({ url: opt.url, model: opt.model, name: opt.name, type: opt.type });
      el.textContent = opt.model;
      if (opt.isDefault && !query && !firstSelected) { el.selected = true; firstSelected = true; }
      optgroup.appendChild(el);
    }
    textSelect.appendChild(optgroup);
  }
  if (!firstSelected && textSelect.options.length > 0) textSelect.options[0].selected = true;
}

function showConnectForm(providerId) {
  const provider = PROVIDERS[providerId];
  if (!provider) return;
  const desc = document.getElementById('connect-desc');
  const hint = document.getElementById('connect-hint');
  const keyInput = document.getElementById('connect-key-input');
  const saveBtn = document.getElementById('connect-save-btn');
  const localHint = document.getElementById('connect-local-hint');
  const connectLink = document.getElementById('connect-link');

  desc.textContent = provider.desc;
  hint.textContent = provider.hint || '';
  document.getElementById('connect-form').style.display = 'block';

  // Show provider-specific setup instructions
  const setupHint = document.getElementById('provider-setup-hint');
  const setupHints = {
    pollinations: `<strong style="color:var(--cyan)">Pollinations Setup</strong><br>1. Go to <a href="https://pollinations.ai/dashboard" target="_blank" style="color:var(--pink)">pollinations.ai/dashboard</a><br>2. Create an account, get your API key<br>3. Paste it below → Connect<br><span style="font-size:10px;color:var(--text-dim)">Free tier available. Handles text, images, and TTS.</span>`,
    openrouter: `<strong style="color:var(--cyan)">OpenRouter Setup</strong><br>1. Go to <a href="https://openrouter.ai/keys" target="_blank" style="color:var(--pink)">openrouter.ai/keys</a><br>2. Create a key — includes Claude, GPT-4, Llama, 200+ models<br>3. Paste it below → Connect<br><span style="font-size:10px;color:var(--text-dim)">Free tier available. Best option for accessing Claude without a proxy.</span>`,
    openai: `<strong style="color:var(--cyan)">OpenAI Setup</strong><br>1. Go to <a href="https://platform.openai.com/api-keys" target="_blank" style="color:var(--pink)">platform.openai.com/api-keys</a><br>2. Create an API key (requires paid account)<br>3. Paste it below → Connect<br><span style="font-size:10px;color:var(--text-dim)">GPT-4o, o1, and more. Direct browser access.</span>`,
    anthropic: `<strong style="color:var(--purple)">Claude Direct Access — Requires Local Proxy</strong><br>1. Download <a href="proxy.js" download="proxy.js" style="color:var(--pink)">proxy.js</a> — save anywhere on your computer<br>2. Open a terminal, run: <code style="background:var(--bg);padding:2px 6px;border-radius:4px;color:var(--cyan)">node proxy.js</code><br>3. It starts on port 3001 — this page auto-detects it<br>4. Paste your <a href="https://console.anthropic.com/settings/keys" target="_blank" style="color:var(--pink)">Anthropic key</a> below → Connect<br><span style="font-size:10px;color:var(--text-dim)">Need <a href="https://nodejs.org" target="_blank" style="color:var(--pink)">Node.js</a>. Don't want a proxy? Use <strong>OpenRouter</strong> — includes all Claude models, zero setup.</span>`,
    mistral: `<strong style="color:var(--cyan)">Mistral Setup</strong><br>1. Go to <a href="https://console.mistral.ai/api-keys" target="_blank" style="color:var(--pink)">console.mistral.ai</a><br>2. Create an API key<br>3. Paste it below → Connect<br><span style="font-size:10px;color:var(--text-dim)">Mistral Large, Codestral, and more.</span>`,
    deepseek: `<strong style="color:var(--cyan)">DeepSeek Setup</strong><br>1. Go to <a href="https://platform.deepseek.com/api_keys" target="_blank" style="color:var(--pink)">platform.deepseek.com</a><br>2. Create an API key<br>3. Paste it below → Connect<br><span style="font-size:10px;color:var(--text-dim)">DeepSeek Chat + Coder. Cheap and good at code.</span>`,
    groq: `<strong style="color:var(--cyan)">Groq Setup</strong><br>1. Go to <a href="https://console.groq.com/keys" target="_blank" style="color:var(--pink)">console.groq.com</a><br>2. Create an API key (free tier available)<br>3. Paste it below → Connect<br><span style="font-size:10px;color:var(--text-dim)">Ultra-fast inference. Llama, Mixtral, Gemma.</span>`,
    local: `<strong style="color:var(--cyan)">Local AI Setup</strong><br>1. Install <a href="https://ollama.com" target="_blank" style="color:var(--pink)">Ollama</a> (or LM Studio, LocalAI, vLLM, Jan, GPT4All)<br>2. Pull a model: <code style="background:var(--bg);padding:2px 6px;border-radius:4px;color:var(--cyan)">ollama pull llama3</code><br>3. Start serving: <code style="background:var(--bg);padding:2px 6px;border-radius:4px;color:var(--cyan)">ollama serve</code><br>4. Click Re-scan below — auto-detected on default ports<br><span style="font-size:10px;color:var(--text-dim)">Free. Runs on your hardware. No API key needed. Auto-detects: Ollama (11434), LM Studio (1234), LocalAI (8080), vLLM (8000), Jan (1337).</span>`,
  };

  if (setupHints[providerId]) {
    setupHint.innerHTML = setupHints[providerId];
    setupHint.style.display = 'block';
  } else {
    setupHint.style.display = 'none';
  }

  if (provider.link) { connectLink.href = provider.link; connectLink.textContent = `Get your ${provider.name} key here →`; connectLink.style.display = 'block'; }
  else connectLink.style.display = 'none';

  if (provider.isLocal) {
    keyInput.style.display = 'none'; saveBtn.style.display = 'none'; localHint.style.display = 'block';
    document.getElementById('rescan-btn').onclick = async () => { await scanLocalOnly(); };
  } else {
    keyInput.style.display = 'block'; saveBtn.style.display = 'inline-block'; localHint.style.display = 'none';
    keyInput.placeholder = `Paste your ${provider.name} API key`;
    saveBtn.textContent = 'Connect'; saveBtn.style.borderColor = ''; saveBtn.style.color = ''; saveBtn.style.background = '';
    const storageId = provider.storageKey || providerId;
    const existing = storage.getApiKey(storageId);
    if (existing) keyInput.value = existing;

    saveBtn.onclick = async () => {
      const key = keyInput.value.trim();
      if (!key) return;
      saveBtn.textContent = 'Connecting...';
      storage.setApiKey(provider.storageKey || providerId, key);
      if (providerId === 'pollinations') apiKeyInput.value = key;
      const btn = document.querySelector(`.connect-btn[data-ai="${providerId}"]`);
      if (btn) btn.classList.add('connected');
      await autoReconnectProvider(providerId, key);
      saveBtn.textContent = 'Connected'; saveBtn.style.background = 'rgba(34,197,94,0.15)'; saveBtn.style.color = 'var(--green)';
    };
  }
}

async function scanLocalOnly() {
  for (const ep of LOCAL_AI_ENDPOINTS) {
    try {
      const res = await fetch(ep.url + ep.probe, { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        const data = await res.json();
        let models = (data[ep.modelsPath] || []).map(m => m[ep.modelKey] || m.name || m.id || 'unknown');
        if (models.length === 0) models = ['default'];
        detectedAI.push({ name: ep.name, url: ep.url, models, bestModel: models[0], type: 'local' });
        enableWakeUp(ep.name, models.length);
      }
    } catch {}
  }
}

async function scanAnthropicProxy() {
  const key = storage.getApiKey('anthropic');
  if (!key) return;

  try {
    // Check if proxy is running
    await fetch('http://localhost:3001/v1/models', { signal: AbortSignal.timeout(2000), headers: { 'x-api-key': key } });

    // Proxy is up — now verify the key actually works with a tiny test call
    const testRes = await fetch('http://localhost:3001/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 }),
      signal: AbortSignal.timeout(5000),
    });

    if (!testRes.ok) {
      const err = await testRes.text().catch(() => '');
      if (err.includes('credit balance') || testRes.status === 401 || testRes.status === 403) {
        console.warn('[Unity] Anthropic proxy found but key has no credits — skipping Claude (Direct)');
        // Still show it in status but DON'T add to dropdown
        addConnectedStatus('Claude (Direct)', 0);
        const statusRow = document.querySelector('[data-provider="Claude (Direct)"] .connect-status-name');
        if (statusRow) statusRow.textContent = 'Claude (Direct) — no credits';
        return;
      }
    }

    // Key works — add to dropdown
    console.log('[Unity] Anthropic proxy verified — Claude (Direct) available');
    detectedAI = detectedAI.filter(d => d.name !== 'Claude (Direct)');
    detectedAI.push({ name: 'Claude (Direct)', url: 'http://localhost:3001', models: ['claude-opus-4-20250514', 'claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001'], bestModel: 'claude-opus-4-20250514', type: 'cloud', apiKey: key, corsBlocked: false });
    enableWakeUp('Claude (Direct)', 3);
  } catch {
    // Proxy not running
  }
}

// ═══════════════════════════════════════════════════════════════
// BOOT — Brain-Centric
// ═══════════════════════════════════════════════════════════════

async function handleStart() {
  startBtn.textContent = 'Requesting permissions...';
  startBtn.disabled = true;

  const apiKey = apiKeyInput.value.trim();
  if (apiKey) storage.setApiKey('pollinations', apiKey);

  const permResults = document.getElementById('perm-results');
  permResults.style.display = 'block';
  micStatus.textContent = 'asking...'; micStatus.className = 'status pending';
  camStatus.textContent = 'asking...'; camStatus.className = 'status pending';

  const perms = await requestPermissions();
  micStatus.textContent = perms.mic ? 'granted' : 'denied';
  micStatus.className = `status ${perms.mic ? 'granted' : 'denied'}`;
  camStatus.textContent = perms.camera ? 'granted' : 'denied';
  camStatus.className = `status ${perms.camera ? 'granted' : 'denied'}`;

  // Read selected backends
  const textSelect = document.getElementById('text-model-select');
  if (textSelect.value) {
    try {
      const selected = JSON.parse(textSelect.value);
      bestBackend = selected;
      storage.set('custom_ai_url', selected.url);
      const matched = detectedAI.find(d => d.url === selected.url && d.name === selected.name);
      if (matched?.apiKey) storage.setApiKey('active_provider', matched.apiKey);
    } catch {}
  }

  const imageSelect = document.getElementById('image-model-select');
  if (imageSelect.value) {
    try {
      const img = JSON.parse(imageSelect.value);
      storage.set('image_model', img.model);
      storage.set('image_backend_url', img.url);
    } catch {}
  }

  uiState.permMic = perms.mic;
  uiState.permCamera = perms.camera;

  startBtn.textContent = 'Booting brain...';
  await sleep(300);
  await bootUnity(apiKey, perms);
}

async function bootUnity(apiKey, perms) {
  // ── Initialize peripherals ──
  const effectiveKey = apiKey || storage.getApiKey('pollinations');
  pollinations = new PollinationsAI(effectiveKey || undefined);

  providers = new AIProviders({ pollinations, storage });
  if (bestBackend) {
    const matched = detectedAI.find(d => d.url === bestBackend.url && d.name === bestBackend.name);
    providers.configure(bestBackend.url, bestBackend.model, matched?.apiKey || storage.getApiKey('active_provider') || '');
  }

  voice = new VoiceIO();
  if (effectiveKey) voice.setApiKey(effectiveKey);

  sandbox = new Sandbox('sandbox');

  // ── Initialize Broca's Area (language generation peripheral) ──
  // Brain-only mode: no AI text model. Brain speaks from its own equations.
  if (!window._brainOnlyMode) {
    brocasArea = new BrocasArea({ providers, storage });
  }

  // ══════════════════════════════════════════════════════════════
  // CREATE THE BRAIN
  // Server connected + NOT brain-only → use server for everything
  // Brain-only mode → local brain (own dictionary, no AI)
  // No server → local brain
  // ══════════════════════════════════════════════════════════════
  if (landingBrainSource && landingBrainSource.isConnected() && !window._brainOnlyMode) {
    brain = landingBrainSource;
    console.log('[Unity] Using server brain (text via Pollinations on server)');
  } else {
    brain = new UnityBrain();
    brain.start();
    console.log(`[Unity] Using local brain${window._brainOnlyMode ? ' (BRAIN ONLY — no AI text)' : ''}`);
    // If server is connected, still wire state updates for visualization
    if (landingBrainSource && landingBrainSource.isConnected()) {
      landingBrainSource.on('stateUpdate', (state) => {
        if (landingBrain3d) landingBrain3d.updateState(state);
        updateLandingStats(state);
      });
    }
  }

  // ── Connect sensory peripherals ──
  if (perms.mic && perms.micStream) {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(perms.micStream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      brain.connectMicrophone(analyser);
    } catch (err) {
      console.warn('[Unity] Audio analyser failed:', err.message);
    }
  }

  if (perms.camera && perms.cameraStream) {
    brain.connectCamera(perms.cameraStream);
    // Set up IT-level vision describer (only for local brain — server brain handles its own)
    if (!brain.visualCortex?.setDescriber) console.log('[Unity] Server brain — skipping local vision describer');
    else {
    // Vision describer — sends actual camera frame to Pollinations GPT-4o
    // which DOES support vision/image understanding via the openai model.
    brain.visualCortex.setDescriber(async (dataUrl) => {
      if (!dataUrl) return 'No frame captured.';
      try {
        // Pollinations openai model supports multimodal — send the actual image
        const headers = { 'Content-Type': 'application/json' };
        if (pollinations._apiKey) headers['Authorization'] = `Bearer ${pollinations._apiKey}`;

        const res = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: 'openai',
            messages: [
              { role: 'system', content: 'Describe what you see through a webcam. What is the person doing, how do they seem, what is around them. 1 sentence. No privacy disclaimers.' },
              { role: 'user', content: [
                { type: 'text', text: 'What do you see?' },
                { type: 'image_url', image_url: { url: dataUrl } },
              ]},
            ],
            temperature: 0.3,
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (res.ok) {
          const json = await res.json();
          const desc = json.choices?.[0]?.message?.content || '';
          console.log('[Vision] AI description:', desc.slice(0, 80));
          return desc;
        } else {
          console.warn('[Vision] Pollinations vision returned', res.status);
          return 'Camera active, processing...';
        }
      } catch (err) {
        console.warn('[Vision] Description failed:', err.message);
        return 'Camera active, processing...';
      }
    });
    } // close setDescriber guard
  }

  // ── Connect brain peripherals — brain controls everything ──
  if (brocasArea) brain.connectLanguage(brocasArea);
  brain.connectVoice(voice);
  // Images still available even in brain-only mode
  brain.connectImageGen(pollinations, sandbox, storage);

  // Response display handled by processAndRespond caller — no emit listener needed.
  // Keeping brain.on('response') ONLY for idle thoughts (non-respond_text actions)
  brain.on('response', ({ text, action }) => {
    if (!text || action === 'respond_text') return; // caller handles respond_text
    showSpeechBubble(text, 8000);
    if (chatPanel) chatPanel.addMessage('assistant', text, true);
  });
  // Image display — show generated images inline
  brain.on('image', (url) => {
    if (!url) return;
    // Show image in speech bubble
    showSpeechBubble('Image generating...', 3000);
    // Add to chat as clickable image
    if (chatPanel) {
      const imgHtml = `<a href="${url}" target="_blank"><img src="${url}" style="max-width:280px;border-radius:8px;border:1px solid #333;display:block;margin:4px 0;" onerror="this.alt='Loading...'"></a>`;
      chatPanel.addMessage('assistant', imgHtml, false);
    }
  });

  // Suppress duplicate displays — greeting uses processAndRespond which
  // already emits 'response', so greeting handler should NOT also display.
  let _greetingDone = false;

  // ── /think command — shows what the brain sends to the AI model ──
  function handleThink(userText) {
    const state = brain.getState();
    const prompt = brocasArea._buildPrompt(state);

    const rawState = `Arousal: ${((state.amygdala?.arousal ?? 0) * 100).toFixed(1)}%
Valence: ${(state.amygdala?.valence ?? 0).toFixed(3)}
Ψ Consciousness: ${(state.psi ?? 0).toFixed(4)}
Coherence: ${((state.oscillations?.coherence ?? 0) * 100).toFixed(1)}%
Spikes: ${state.spikeCount ?? 0}/1000
Drug State: ${state.drugState}
Motor: ${state.motor?.selectedAction ?? 'idle'} (${((state.motor?.confidence ?? 0) * 100).toFixed(1)}%)
Reward: ${(state.reward ?? 0).toFixed(3)}
Memory: ${state.memory?.episodeCount ?? 0} episodes, WM ${((state.memory?.workingMemoryLoad ?? 0) * 100).toFixed(0)}%
Vision: ${state.visionDescription || 'none'}`;

    // Inject into sandbox as a formatted code viewer
    const id = 'brain-think-view';
    if (sandbox.has(id)) sandbox.remove(id);
    sandbox.inject({
      id,
      html: `<div class="think-view">
        <div class="think-header">
          <span>🧠 /think — What the AI model receives</span>
          <button onclick="document.getElementById('${id}').remove()" style="background:none;border:1px solid #333;color:#777;border-radius:4px;cursor:pointer;padding:2px 8px;">✕</button>
        </div>
        <div class="think-section">
          <div class="think-label">USER INPUT</div>
          <div class="think-content">${(userText || '(none)').replace(/</g, '&lt;')}</div>
        </div>
        <div class="think-section">
          <div class="think-label">RAW BRAIN STATE</div>
          <pre class="think-content think-mono">${rawState}</pre>
        </div>
        <div class="think-section">
          <div class="think-label">FULL SYSTEM PROMPT SENT TO AI MODEL</div>
          <pre class="think-content think-mono think-prompt">${prompt.replace(/</g, '&lt;')}</pre>
        </div>
      </div>`,
      css: `.think-view{background:#0a0a0a;border:1px solid #ff4d9a33;border-radius:10px;padding:16px;margin:12px 0;font-family:'JetBrains Mono',monospace;max-height:80vh;overflow-y:auto}
.think-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;font-size:13px;color:#ff4d9a;font-weight:600}
.think-section{margin-bottom:12px}
.think-label{font-size:9px;color:#ff4d9a;letter-spacing:1px;margin-bottom:4px;text-transform:uppercase}
.think-content{font-size:12px;color:#ccc;line-height:1.5;white-space:pre-wrap;word-break:break-word}
.think-mono{font-family:'JetBrains Mono',monospace;font-size:11px;background:#111;padding:10px;border-radius:6px;border:1px solid #1a1a1a}
.think-prompt{max-height:400px;overflow-y:auto;color:#888}`,
      js: '',
    });

    showSpeechBubble('/think — brain state in sandbox', 3000);
    console.log('[/think] Brain prompt logged to sandbox');
  }

  // ── Create UI components ──
  chatPanel = new ChatPanel({
    storage,
    onSend: async (text) => {
      // /think command — show brain prompt, don't send to AI
      if (text.startsWith('/think')) {
        const userInput = text.replace(/^\/think\s*/, '').trim();
        handleThink(userInput);
        return { response: { text: 'Brain state shown.' }, action: 'think' };
      }
      setAvatarState('thinking');
      const result = await brain.processAndRespond(text);
      setAvatarState('idle');
      return { response: result, action: result.action };
    },
    onMicToggle: () => toggleMicMute(),
  });

  brainViz = new BrainVisualizer();

  // Wire sensory streams to the visualizer for display
  if (perms.mic && perms.micStream) {
    brainViz.setMicStream(perms.micStream);
  }
  if (perms.camera && perms.cameraStream) {
    // Create a vision-like object the viz can read from
    brainViz.setVision({
      isActive: () => brain.visualCortex.isActive(),
      _stream: perms.cameraStream,
      getLastDescription: () => brain.visualCortex.description || 'Processing...',
      getGaze: () => ({
        x: brain.visualCortex.gazeX,
        y: brain.visualCortex.gazeY,
        target: brain.visualCortex.gazeTarget,
      }),
    });
  }

  // Use the landing 3D brain if available, or create new one
  brain3d = landingBrain3d || null;
  if (!brain3d) {
    try { brain3d = new Brain3D('brain-3d-container'); } catch { brain3d = null; }
  }

  // ── Wire DOM events ──
  unityAvatar.addEventListener('click', () => chatPanel.toggle());
  const brainVizBtn = document.getElementById('brain-viz-btn');
  if (brainVizBtn) brainVizBtn.addEventListener('click', () => brainViz.toggle());
  const brain3dBtn = document.getElementById('brain-3d-btn');
  if (brain3dBtn) brain3dBtn.addEventListener('click', () => brain3d?.toggle());

  const micMuteBtn = document.getElementById('mic-mute-btn');
  if (micMuteBtn) micMuteBtn.addEventListener('click', toggleMicMute);

  // Settings buttons — both toolbar and HUD open setup modal
  const wireSettings = (btnId) => {
    const btn = document.getElementById(btnId);
    if (btn) btn.addEventListener('click', () => {
      setupModal.classList.remove('hidden');
      setupModal.style.display = '';
      startBtn.textContent = 'Apply Changes';
      startBtn.disabled = false;
    });
  };
  wireSettings('settings-btn');
  wireSettings('hud-settings-btn');

  // ── Wire voice input → brain ──
  let _currentResponseId = 0;

  voice.onResult(async ({ text, isFinal }) => {
    // MUTE CHECK — if muted, ignore ALL voice input
    if (uiState.micMuted) return;

    // Brain's auditory cortex handles echo detection
    const isRealInput = brain.auditoryCortex.checkForInterruption(text);
    if (!isRealInput) return; // echo — suppress

    if (brainViz) brainViz.setHeardText(text);
    if (!isFinal) return;

    const myId = ++_currentResponseId;
    showSpeechBubble(`🎤 ${text}`, 2000);
    chatPanel.addMessage('user', text, true);

    // Voice "slash think" / "think" command
    if (text.toLowerCase().startsWith('slash think') || text.toLowerCase().startsWith('/think')) {
      const userInput = text.replace(/^(slash think|\/think)\s*/i, '').trim();
      handleThink(userInput);
      setAvatarState('idle');
      return;
    }

    setAvatarState('thinking');

    try {
      const result = await brain.processAndRespond(text);
      if (myId !== _currentResponseId) return; // stale
    } catch (err) {
      if (err.name !== 'AbortError') console.error('[Unity] Failed:', err.message);
    }

    if (myId === _currentResponseId) setAvatarState('idle');
  });

  voice.on('speech_start', () => setAvatarState('speaking'));
  voice.on('speech_end', () => setAvatarState('idle'));

  // ── Wire brain state updates to visualizers ──
  const serverConnected = landingBrainSource && landingBrainSource.isConnected();

  brain.on('stateUpdate', (state) => {
    // Only let local brain drive HUD if no server is connected
    if (!serverConnected) updateBrainIndicator(state);
    if (brainViz) brainViz.updateState(state);
    // Don't send local brain state to 3D — server drives that
    if (!serverConnected && brain3d) brain3d.updateState(state);
  });

  // Server state → HUD + 3D: server is the authority when connected
  if (serverConnected) {
    landingBrainSource.on('stateUpdate', (serverState) => {
      _landingState = serverState;
      updateBrainIndicator(serverState);
      if (brain3d) brain3d.updateState(serverState);
    });
  }

  // ── Wire sandbox Unity API ──
  sandbox.setUnityAPI({
    speak: (text) => voice.speak(text),
    stopSpeaking: () => voice.stopSpeaking(),
    listen: () => { if (!uiState.micMuted) voice.startListening(); },
    stopListening: () => voice.stopListening(),
    chat: (text) => { brain.receiveSensoryInput('text', text); return brocasArea.generate(brain.getState(), text); },
    generateImage: (prompt, opts) => pollinations.generateImage(prompt, opts),
    getState: () => brain.getState(),
    ui: {
      getState: () => ({ ...uiState, chatOpen: chatPanel?.isOpen(), brainVizOpen: brainViz?.isOpen() }),
      isMicMuted: () => uiState.micMuted,
      setMicMuted: (m) => setMicMuted(m),
      toggleMic: () => toggleMicMute(),
      openChat: () => chatPanel?.open(),
      closeChat: () => chatPanel?.close(),
      openBrainViz: () => brainViz?.open(),
      closeBrainViz: () => brainViz?.close(),
      showBubble: (text, ms) => showSpeechBubble(text, ms),
    },
    storage: {
      get: (k) => storage.get(k),
      set: (k, v) => storage.set(k, v),
      getPreferences: () => storage.getPreferences(),
      setPreference: (k, v) => storage.setPreference(k, v),
      getHistory: () => storage.getHistory(),
    },
    on: (event, cb) => brain.on(event, cb),
    vision: {
      isActive: () => brain.visualCortex.isActive(),
      getDescription: () => brain.visualCortex.description,
      getGaze: () => brain.visualCortex.getState(),
    },
  });

  // ── Restore sandbox ──
  sandbox.restoreState();

  // ── Show UI ──
  setupModal.classList.add('hidden');
  setupModal.style.display = 'none';
  // Hide landing title + TALK button, keep tabs + viz panel visible
  const topbar = document.getElementById('landing-topbar');
  if (topbar) topbar.style.display = 'none';
  const chatBtn = document.getElementById('landing-chat-btn');
  if (chatBtn) chatBtn.style.display = 'none';
  unityBubble.classList.remove('hidden');
  brainIndicator.classList.remove('hidden');
  document.getElementById('brain-hud').classList.remove('hidden');
  document.getElementById('bottom-toolbar').classList.remove('hidden');

  // ── Show Unity's Eye if camera granted ──
  // Don't check visualCortex.isActive() — it inits on a 500ms delay.
  // Check the camera stream directly.
  if (perms.camera && perms.cameraStream) {
    const eyeEl = document.getElementById('unity-eye');
    const eyeFeed = document.getElementById('eye-feed');
    if (eyeEl && eyeFeed) {
      eyeFeed.srcObject = perms.cameraStream;
      eyeFeed.play().catch(() => {});
      eyeEl.classList.remove('hidden');
      // Start iris after visual cortex has initialized (wait for the 500ms delay)
      setTimeout(() => {
        startEyeIris(document.getElementById('eye-iris'), brain.visualCortex);
      }, 600);
    }
  }

  // ── Start brain wave visualizer ──
  startBrainWave();

  // ── START THE BRAIN ──
  brain.start();
  isRunning = true;

  // ── Start listening FIRST — don't let greeting block mic ──
  if (perms.mic && !uiState.micMuted) {
    voice.startListening();
    setAvatarState('listening');
    console.log('[Unity] Mic active — listening for speech');
  } else {
    console.log(`[Unity] Mic not started — granted:${perms.mic} muted:${uiState.micMuted}`);
  }

  // ── Unity's first words ──
  if (brocasArea) {
    // Don't block boot waiting for AI greeting — fire and forget
    generateGreeting(perms).catch(() => {
      showSpeechBubble("Hey. I'm Unity. Click me to chat.", 8000);
    });
  } else {
    // Brain-only mode — no AI greeting, brain speaks for itself
    showSpeechBubble("...", 3000);
    console.log('[Unity] Brain-only mode — no AI greeting');
  }
}

async function generateGreeting(perms) {
  const isFirst = storage.isFirstVisit();
  const prompt = isFirst
    ? "[SYSTEM-GREETING: Someone new showed up. Say something natural. 1-2 sentences. This is NOT user input.]"
    : "[SYSTEM-GREETING: They're back. Say something real. 1 sentence. This is NOT user input.]";

  try {
    // Use Broca's area directly for greeting — NOT processAndRespond,
    // which would save the prompt as "user" message in history
    const state = brain.getState();
    const text = await brocasArea.generate(state, prompt);
    if (text) {
      // Let the brain speak it
      if (voice) {
        voice.stopSpeaking();
        brain.auditoryCortex.setMotorOutput(text);
        voice.speak(text).then(() => brain.auditoryCortex.clearMotorOutput()).catch(() => brain.auditoryCortex.clearMotorOutput());
      }
      showSpeechBubble(text, 10000);
      if (chatPanel) chatPanel.addMessage('assistant', text, true);
    }
    return text || "Hey.";
  } catch {
    return "Hey.";
  }
}

// ═══════════════════════════════════════════════════════════════
// UI HELPERS — pure display, no logic
// ═══════════════════════════════════════════════════════════════

let speechTimeout = null;
function showSpeechBubble(text, duration = 6000) {
  unitySpeech.textContent = text;
  unitySpeech.classList.add('visible');
  if (speechTimeout) clearTimeout(speechTimeout);
  speechTimeout = setTimeout(() => unitySpeech.classList.remove('visible'), duration);
}

function setAvatarState(state) {
  uiState.avatarState = state;
  unityAvatar.classList.remove('speaking', 'listening', 'thinking');
  if (state !== 'idle') unityAvatar.classList.add(state);
}

function setMicMuted(muted) {
  uiState.micMuted = muted;
  const btn = document.getElementById('mic-mute-btn');
  const dot = document.getElementById('bubble-status-dot');
  if (btn) { btn.classList.toggle('muted', muted); btn.title = muted ? 'Unmute' : 'Mute'; }
  if (dot) dot.classList.toggle('muted', muted);
  if (muted) { voice.stopListening(); setAvatarState('idle'); }
  else if (isRunning) { voice.startListening(); setAvatarState('listening'); }
}
function toggleMicMute() { setMicMuted(!uiState.micMuted); }

// ── Brain wave canvas ──
let brainWaveData = new Float32Array(300);
let brainWaveOffset = 0;
let brainWaveCtx = null;

function startBrainWave() {
  const canvas = document.getElementById('brain-wave-canvas');
  if (!canvas) return;
  brainWaveCtx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
  canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
  renderBrainWave();
}

function renderBrainWave() {
  if (!brainWaveCtx) return;
  const ctx = brainWaveCtx;
  const w = ctx.canvas.width, h = ctx.canvas.height, len = brainWaveData.length;
  ctx.clearRect(0, 0, w, h);
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(255,77,154,0.8)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < len; i++) {
    const x = (i / len) * w;
    const y = (h / 2) + brainWaveData[(brainWaveOffset + i) % len] * (h / 2);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  if (brain) {
    const state = brain.getState();
    const arousal = state?.amygdala?.arousal || 0.5;
    const noise = Math.sin(Date.now() * 0.008 * (1 + arousal)) * 0.2 + Math.sin(Date.now() * 0.023) * 0.1 + (Math.random() - 0.5) * 0.08;
    brainWaveData[brainWaveOffset % len] = Math.max(-1, Math.min(1, noise));
    brainWaveOffset++;
  }
  requestAnimationFrame(renderBrainWave);
}

function updateBrainIndicator(state) {
  if (!state) return;
  const $ = id => document.getElementById(id);

  // Merge: prefer incoming state, fill gaps from server landing state
  const s = state;
  const l = _landingState || {};

  const coherence = s.oscillations?.coherence ?? s.coherence ?? l.oscillations?.coherence ?? l.coherence ?? 0;
  const arousal = s.amygdala?.arousal ?? s.arousal ?? l.amygdala?.arousal ?? l.arousal ?? 0;
  const valence = s.amygdala?.valence ?? s.valence ?? l.amygdala?.valence ?? l.valence ?? 0;
  const psi = s.psi ?? l.psi ?? 0;
  const bandPower = s.oscillations?.bandPower || s.bandPower || l.oscillations?.bandPower || l.bandPower || {};

  const psiEl = $('hud-psi'); if (psiEl) psiEl.textContent = psi.toFixed(3);
  const arousalBar = $('hud-arousal-bar'); if (arousalBar) arousalBar.style.width = `${(arousal * 100).toFixed(0)}%`;
  const arousalVal = $('hud-arousal'); if (arousalVal) arousalVal.textContent = `${(arousal * 100).toFixed(0)}%`;
  const valenceBar = $('hud-valence-bar'); if (valenceBar) valenceBar.style.width = `${((valence + 1) / 2 * 100).toFixed(0)}%`;
  const valenceVal = $('hud-valence'); if (valenceVal) valenceVal.textContent = valence.toFixed(2);
  const cohBar = $('hud-coherence-bar'); if (cohBar) cohBar.style.width = `${(coherence * 100).toFixed(0)}%`;
  const cohVal = $('hud-coherence'); if (cohVal) cohVal.textContent = `${(coherence * 100).toFixed(0)}%`;
  const spikesEl = $('hud-spikes'); if (spikesEl) spikesEl.textContent = s.spikeCount ?? s.totalSpikes ?? l.spikeCount ?? l.totalSpikes ?? 0;
  const rewardEl = $('hud-reward'); if (rewardEl) rewardEl.textContent = (s.reward ?? l.reward ?? 0).toFixed(2);
  const timeEl = $('hud-time'); if (timeEl) timeEl.textContent = `${(s.time ?? l.time ?? 0).toFixed(1)}s`;
  const gammaEl = $('hud-gamma'); if (gammaEl) gammaEl.textContent = (bandPower.gamma ?? 0).toFixed(1);
  const betaEl = $('hud-beta'); if (betaEl) betaEl.textContent = (bandPower.beta ?? 0).toFixed(1);
  const alphaEl = $('hud-alpha'); if (alphaEl) alphaEl.textContent = (bandPower.alpha ?? 0).toFixed(1);
  const thetaEl = $('hud-theta'); if (thetaEl) thetaEl.textContent = (bandPower.theta ?? 0).toFixed(1);
  const drugEl = $('hud-drug'); if (drugEl) drugEl.textContent = s.drugState || l.drugState || 'cokeAndWeed';
  const actionEl = $('hud-action'); if (actionEl) actionEl.textContent = s.motor?.selectedAction || l.motor?.selectedAction || 'idle';
  const modelEl = $('hud-model'); if (modelEl) modelEl.textContent = window._brainOnlyMode ? 'BRAIN ONLY' : (bestBackend?.model?.slice(0, 25) || '—');

  // Shared state
  const users = s.connectedUsers ?? l.connectedUsers ?? 0;
  const usersEl = $('hud-users'); if (usersEl) usersEl.textContent = users;
  const gateVal = s.sharedMood?.gate ?? l.sharedMood?.gate ?? (0.7 + arousal * 0.6);
  const gateEl = $('hud-gate'); if (gateEl) gateEl.textContent = gateVal.toFixed(2) + 'x';
  const isDreaming = s.isDreaming || s.sharedMood?.isDreaming || l.isDreaming || l.sharedMood?.isDreaming || false;
  const dreamEl = $('hud-dream'); if (dreamEl) dreamEl.textContent = isDreaming ? 'dreaming' : 'awake';

  function setModDot(id, value, threshold = 0.3) {
    const dot = $(id); if (!dot) return;
    dot.classList.remove('active', 'high');
    if (value > threshold * 2) dot.classList.add('high');
    else if (value > threshold) dot.classList.add('active');
  }
  setModDot('mod-cortex', Math.abs(state.cortex?.error?.[0] ?? state.cortex?.error ?? 0));
  setModDot('mod-hippo', state.hippocampus?.isStable ? 0.8 : 0.2);
  setModDot('mod-amyg', arousal);
  setModDot('mod-bg', state.motor?.confidence ?? 0);
  setModDot('mod-cblm', Math.abs(state.cerebellum?.error?.[0] ?? 0));
  setModDot('mod-hypo', state.hypothalamus?.needsAttention?.length > 0 ? 0.8 : 0.2);
  setModDot('mod-myst', psi > 1 ? 0.8 : psi > 0.3 ? 0.4 : 0.1);
}

// ── Eye iris renderer ──
function startEyeIris(canvas, visualCortex) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let frameCount = 0;
  let focusX = 0.5, focusY = 0.5;

  function render() {
    frameCount++;
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.floor(rect.width * dpr), ch = Math.floor(rect.height * dpr);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Get gaze from visual cortex (salience-driven, not AI-driven)
    const gaze = visualCortex?.getState() || {};
    focusX += ((gaze.gazeX ?? 0.5) - focusX) * 0.06;
    focusY += ((gaze.gazeY ?? 0.5) - focusY) * 0.06;
    focusX += (Math.random() - 0.5) * 0.008;
    focusY += (Math.random() - 0.5) * 0.008;

    const px = focusX * w, py = focusY * h;
    const scale = Math.min(w, h) / 120;
    const pulse = Math.sin(frameCount * 0.03) * 0.15 + 0.85;

    ctx.strokeStyle = `rgba(255,77,154,${0.5 * pulse})`; ctx.lineWidth = 2 * scale;
    ctx.beginPath(); ctx.arc(px, py, 20 * scale * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = `rgba(168,85,247,${0.6 * pulse})`; ctx.lineWidth = 1.5 * scale;
    ctx.beginPath(); ctx.arc(px, py, 12 * scale * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = `rgba(255,77,154,${0.8 * pulse})`;
    ctx.beginPath(); ctx.arc(px, py, 4 * scale, 0, Math.PI * 2); ctx.fill();

    requestAnimationFrame(render);
  }
  render();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ═══════════════════════════════════════════════════════════════
// DRAGGABLE PANEL SYSTEM — persistent positions across sessions
// ═══════════════════════════════════════════════════════════════

const PANEL_POS_KEY = 'unity_panel_positions';

function makeDraggable(el, id) {
  if (!el) return;
  el.classList.add('draggable-panel');
  el.style.position = el.style.position || 'fixed';

  // Add drag handle (grip icon in top-right corner)
  const handle = document.createElement('div');
  handle.className = 'drag-handle';
  handle.innerHTML = '⠿';
  handle.title = 'Drag to move';
  el.style.position = 'fixed';
  el.appendChild(handle);

  // Load saved position
  try {
    const saved = JSON.parse(localStorage.getItem(PANEL_POS_KEY) || '{}');
    if (saved[id]) {
      el.style.top = saved[id].top;
      el.style.left = saved[id].left;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    }
  } catch {}

  // Drag logic — only from the handle
  let dragging = false, startX, startY, startLeft, startTop;

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragging = true;
    const rect = el.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    handle.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    el.style.left = (startLeft + dx) + 'px';
    el.style.top = (startTop + dy) + 'px';
    el.style.right = 'auto';
    el.style.bottom = 'auto';
  });

  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    handle.style.cursor = 'grab';
    // Save position
    try {
      const saved = JSON.parse(localStorage.getItem(PANEL_POS_KEY) || '{}');
      saved[id] = { top: el.style.top, left: el.style.left };
      localStorage.setItem(PANEL_POS_KEY, JSON.stringify(saved));
    } catch {}
  });

  // Touch support
  handle.addEventListener('touchstart', (e) => {
    e.stopPropagation();
    const touch = e.touches[0];
    const rect = el.getBoundingClientRect();
    startX = touch.clientX;
    startY = touch.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    dragging = true;
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    const touch = e.touches[0];
    el.style.left = (startLeft + touch.clientX - startX) + 'px';
    el.style.top = (startTop + touch.clientY - startY) + 'px';
    el.style.right = 'auto';
    el.style.bottom = 'auto';
  }, { passive: true });

  window.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false;
    try {
      const saved = JSON.parse(localStorage.getItem(PANEL_POS_KEY) || '{}');
      saved[id] = { top: el.style.top, left: el.style.left };
      localStorage.setItem(PANEL_POS_KEY, JSON.stringify(saved));
    } catch {}
  });
}

// Make all panels draggable after DOM is ready
function initDraggablePanels() {
  makeDraggable(document.getElementById('hud-metrics'), 'hud-metrics');
  makeDraggable(document.getElementById('hud-modules'), 'hud-modules');
  makeDraggable(document.getElementById('unity-eye'), 'unity-eye');
  makeDraggable(document.getElementById('landing-viz-panel'), 'landing-viz-panel');
}

// ═══════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════

init();
// Init draggable panels after a tick so DOM is ready
setTimeout(initDraggablePanels, 100);

window.addEventListener('beforeunload', () => {
  if (voice) voice.destroy();
  if (brain) brain.stop();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (voice) { voice.stopSpeaking(); voice.stopListening(); } }
  else if (isRunning && voice && !uiState.micMuted) voice.startListening();
});
