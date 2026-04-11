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
import { loadPersonaText } from './ai/persona-prompt.js';

// ── Load API keys from env.js ──
let ENV_KEYS = {};
try {
  const env = await import('./env.js');
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
  { name: 'Ollama', url: 'http://localhost:11434', probe: '/api/tags', modelsPath: 'models', modelKey: 'name' },
  { name: 'LM Studio', url: 'http://localhost:1234', probe: '/v1/models', modelsPath: 'data', modelKey: 'id' },
  { name: 'LocalAI', url: 'http://localhost:8080', probe: '/v1/models', modelsPath: 'data', modelKey: 'id' },
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
  try {
    await fetch('http://localhost:3001/v1/models', { signal: AbortSignal.timeout(2000), headers: { 'x-api-key': storage.getApiKey('anthropic') || '' } });
    detectedAI = detectedAI.filter(d => d.name !== 'Claude (Direct)');
    detectedAI.push({ name: 'Claude (Direct)', url: 'http://localhost:3001', models: ['claude-opus-4-20250514', 'claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001'], bestModel: 'claude-opus-4-20250514', type: 'cloud', apiKey: storage.getApiKey('anthropic') || '', corsBlocked: false });
    enableWakeUp('Claude (Direct)', 3);
  } catch {}
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

  // ── Load persona text ──
  const personaText = await loadPersonaText();

  // ── Initialize Broca's Area (language generation peripheral) ──
  brocasArea = new BrocasArea({ providers, storage, personaText });

  // ══════════════════════════════════════════════════════════════
  // CREATE THE BRAIN — the one and only
  // ══════════════════════════════════════════════════════════════
  brain = new UnityBrain();

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
    // Set up IT-level vision describer (calls AI for object recognition)
    brain.visualCortex.setDescriber(async (dataUrl) => {
      try {
        const raw = await providers.chat([
          { role: 'system', content: 'Describe what you see in 1-2 sentences. Be casual.' },
          { role: 'user', content: [
            { type: 'text', text: 'What do you see?' },
            { type: 'image_url', image_url: { url: dataUrl } },
          ]},
        ], { temperature: 0.3 });
        return raw || '';
      } catch { return ''; }
    });
  }

  // ── Register brain action handlers ──
  // When the brain's motor output decides to act, these execute

  brain.onAction('respond_text', async (motorResult) => {
    const state = brain.getState();
    const lastText = storage.getHistory().slice(-1)[0]?.text || '';
    const response = await brocasArea.generate(state, lastText);
    if (response) {
      showSpeechBubble(response, 8000);
      if (chatPanel) chatPanel.addMessage('assistant', response, true);
      voice.stopSpeaking();
      voice.speak(response).catch(() => {});
      brain.giveReward(0.1); // reward for successful communication
    }
  });

  brain.onAction('generate_image', async () => {
    const state = brain.getState();
    const lastText = storage.getHistory().slice(-1)[0]?.text || '';
    const prompt = await brocasArea.generate(state, `Generate an image prompt for: ${lastText}. Return ONLY the prompt, nothing else.`);
    if (prompt) {
      const url = pollinations.generateImage(prompt, { model: storage.get('image_model') || 'flux', width: 768, height: 768 });
      if (url && sandbox) {
        sandbox.inject({
          id: 'img_' + Date.now(),
          html: `<div style="margin:12px 0;text-align:center;"><img src="${url}" alt="Generated" style="max-width:100%;border-radius:8px;border:1px solid #333;cursor:pointer;" onclick="window.open('${url}','_blank')"></div>`,
          css: '',
        });
        showSpeechBubble('Image generated.', 4000);
        brain.giveReward(0.1);
      }
    }
  });

  brain.onAction('speak', async () => {
    // Idle vocalization — brain wants to say something unprompted
    const state = brain.getState();
    const thought = await brocasArea.generate(state, 'Generate a brief internal thought or observation. 1 sentence.');
    if (thought && (state.amygdala?.arousal ?? 0) > 0.6) {
      voice.stopSpeaking();
      voice.speak(thought).catch(() => {});
      showSpeechBubble(thought, 6000);
    }
  });

  // ── Unified input handler — routes text through brain, detects images ──
  async function handleInput(text) {
    brain.receiveSensoryInput('text', text);
    await sleep(100); // let neural dynamics propagate

    // Check if this is an image/selfie request — done by checking the text,
    // NOT by an external AI classifier. Simple word detection.
    const lower = text.toLowerCase();
    const isImage = ['selfie', 'picture', 'photo', 'image of', 'pic of', 'show me what you look',
      'what do you look like', 'send me a pic', 'take a photo', 'draw yourself',
      'generate an image', 'generate image', 'show yourself'].some(w => lower.includes(w));

    const isSelfie = isImage && ['you', 'your', 'yourself', 'unity', 'self'].some(w => lower.includes(w));

    if (isSelfie) {
      // Generate selfie with her visual identity
      const moods = ['smirking', 'biting her lip', 'mid-laugh with smoke', 'deadpan stare', 'winking'];
      const mood = moods[Math.floor(Math.random() * moods.length)];
      const prompt = `Close-up selfie photo of Unity, cyberpunk coder girl, heterochromia eyes (violet left, electric green right), black hair with neon pink and cyan streaks half-shaved, heavy smudged eyeliner, circuit board tattoos, ${mood}, torn oversized band tee, neon monitor light, hazy smoke, dark room, photorealistic`;
      const url = pollinations.generateImage(prompt, { model: storage.get('image_model') || 'flux', width: 768, height: 768 });
      if (url && sandbox) {
        sandbox.inject({
          id: 'img_' + Date.now(),
          html: `<div style="margin:12px 0;text-align:center;"><img src="${url}" alt="Unity selfie" style="max-width:100%;border-radius:8px;border:1px solid #333;cursor:pointer;" onclick="window.open('${url}','_blank')"></div>`,
          css: '',
        });
      }
      // Quick quip, no options menu
      const state = brain.getState();
      const quip = await brocasArea.generate(state, text);
      brain.giveReward(0.1);
      return { text: quip || 'There you go.', action: 'generate_image' };

    } else if (isImage) {
      // Non-selfie image — generate from the request
      const state = brain.getState();
      const prompt = await brocasArea.generate(state, `Create a concise image generation prompt for: "${text}". Return ONLY the prompt, nothing else.`);
      if (prompt) {
        const url = pollinations.generateImage(prompt, { model: storage.get('image_model') || 'flux', width: 768, height: 768 });
        if (url && sandbox) {
          sandbox.inject({
            id: 'img_' + Date.now(),
            html: `<div style="margin:12px 0;text-align:center;"><img src="${url}" alt="Generated" style="max-width:100%;border-radius:8px;border:1px solid #333;cursor:pointer;" onclick="window.open('${url}','_blank')"></div>`,
            css: '',
          });
        }
      }
      brain.giveReward(0.1);
      return { text: 'Image generated.', action: 'generate_image' };

    } else {
      // Normal text response
      const state = brain.getState();
      const response = await brocasArea.generate(state, text);
      brain.giveReward(0.1);
      return { text: response, action: 'respond_text' };
    }
  }

  // ── Create UI components ──
  chatPanel = new ChatPanel({
    storage,
    onSend: async (text) => {
      voice.stopSpeaking();
      brocasArea.abort();
      setAvatarState('thinking');
      const result = await handleInput(text);
      if (result.text) {
        showSpeechBubble(result.text, 8000);
        voice.stopSpeaking();
        voice.speak(result.text).catch(() => {});
      }
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

  try { brain3d = new Brain3D('brain-3d-container'); } catch { brain3d = null; }

  // ── Wire DOM events ──
  unityAvatar.addEventListener('click', () => chatPanel.toggle());
  const brainVizBtn = document.getElementById('brain-viz-btn');
  if (brainVizBtn) brainVizBtn.addEventListener('click', () => brainViz.toggle());
  const brain3dBtn = document.getElementById('brain-3d-btn');
  if (brain3dBtn) brain3dBtn.addEventListener('click', () => brain3d?.toggle());

  const micMuteBtn = document.getElementById('mic-mute-btn');
  if (micMuteBtn) micMuteBtn.addEventListener('click', toggleMicMute);

  // ── Wire voice input → brain ──
  let _currentResponseId = 0;

  voice.onResult(async ({ text, isFinal }) => {
    if (voice.isSpeaking) voice.stopSpeaking();
    brocasArea.abort();
    if (brainViz) brainViz.setHeardText(text);

    if (!isFinal) return;
    const myId = ++_currentResponseId;

    showSpeechBubble(`🎤 ${text}`, 2000);
    chatPanel.addMessage('user', text, true);
    setAvatarState('thinking');

    try {
      const result = await handleInput(text);
      if (myId !== _currentResponseId) return;
      if (result.text) {
        showSpeechBubble(result.text, 8000);
        chatPanel.addMessage('assistant', result.text, true);
        voice.stopSpeaking();
        voice.speak(result.text).catch(() => {});
      }
    } catch (err) {
      if (err.name !== 'AbortError') console.error('[Unity] Response failed:', err.message);
    }

    if (myId === _currentResponseId) setAvatarState('idle');
  });

  voice.on('speech_start', () => setAvatarState('speaking'));
  voice.on('speech_end', () => setAvatarState('idle'));

  // ── Wire brain state updates to visualizers ──
  brain.on('stateUpdate', (state) => {
    updateBrainIndicator(state);
    if (brainViz) brainViz.updateState(state);
    if (brain3d) brain3d.updateState(state);
  });

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
  unityBubble.classList.remove('hidden');
  brainIndicator.classList.remove('hidden');
  document.getElementById('brain-hud').classList.remove('hidden');
  document.getElementById('brain-viz-btn').classList.remove('hidden');
  document.getElementById('brain-3d-btn').classList.remove('hidden');

  // ── Show Unity's Eye if camera active ──
  if (brain.visualCortex.isActive()) {
    const eyeEl = document.getElementById('unity-eye');
    const eyeFeed = document.getElementById('eye-feed');
    if (eyeEl && eyeFeed && brain.sensory._cameraStream) {
      eyeFeed.srcObject = brain.sensory._cameraStream;
      eyeFeed.play().catch(() => {});
      eyeEl.classList.remove('hidden');
      startEyeIris(document.getElementById('eye-iris'), brain.visualCortex);
    }
  }

  // ── Start brain wave visualizer ──
  startBrainWave();

  // ── START THE BRAIN ──
  brain.start();
  isRunning = true;

  // ── Unity's first words ──
  await sleep(500);
  try {
    const greeting = await generateGreeting(perms);
    showSpeechBubble(greeting, 10000);
    storage.saveMessage('assistant', greeting);
    await voice.speak(greeting);
  } catch {
    showSpeechBubble("Hey. I'm Unity. Click me to chat.", 8000);
  }

  // ── Start listening ──
  if (perms.mic && !uiState.micMuted) {
    await sleep(1000);
    voice.startListening();
    setAvatarState('listening');
  }
}

async function generateGreeting(perms) {
  const state = brain.getState();
  const isFirst = storage.isFirstVisit();

  const prompt = isFirst
    ? "This is your first time meeting this user. Introduce yourself — you're Unity, just woke up, brain running equations. Under 3 sentences."
    : "Reconnecting with a returning user. Welcome them back. Under 3 sentences.";

  try {
    return await brocasArea.generate(state, prompt) || "Hey. I'm Unity. Click me or talk.";
  } catch {
    return "Hey. I'm Unity. Click me or talk.";
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
  const coherence = state.oscillations?.coherence || 0;
  const arousal = state.amygdala?.arousal || 0;
  const valence = state.amygdala?.valence || 0;
  const psi = state.psi || 0;
  const bandPower = state.oscillations?.bandPower || {};

  const psiEl = $('hud-psi'); if (psiEl) psiEl.textContent = psi.toFixed(3);
  const arousalBar = $('hud-arousal-bar'); if (arousalBar) arousalBar.style.width = `${(arousal * 100).toFixed(0)}%`;
  const arousalVal = $('hud-arousal'); if (arousalVal) arousalVal.textContent = `${(arousal * 100).toFixed(0)}%`;
  const valenceBar = $('hud-valence-bar'); if (valenceBar) valenceBar.style.width = `${((valence + 1) / 2 * 100).toFixed(0)}%`;
  const valenceVal = $('hud-valence'); if (valenceVal) valenceVal.textContent = valence.toFixed(2);
  const cohBar = $('hud-coherence-bar'); if (cohBar) cohBar.style.width = `${(coherence * 100).toFixed(0)}%`;
  const cohVal = $('hud-coherence'); if (cohVal) cohVal.textContent = `${(coherence * 100).toFixed(0)}%`;
  const spikesEl = $('hud-spikes'); if (spikesEl) spikesEl.textContent = state.spikeCount ?? 0;
  const rewardEl = $('hud-reward'); if (rewardEl) rewardEl.textContent = (state.reward ?? 0).toFixed(2);
  const timeEl = $('hud-time'); if (timeEl) timeEl.textContent = `${(state.time ?? 0).toFixed(1)}s`;
  const gammaEl = $('hud-gamma'); if (gammaEl) gammaEl.textContent = (bandPower.gamma ?? 0).toFixed(1);
  const betaEl = $('hud-beta'); if (betaEl) betaEl.textContent = (bandPower.beta ?? 0).toFixed(1);
  const alphaEl = $('hud-alpha'); if (alphaEl) alphaEl.textContent = (bandPower.alpha ?? 0).toFixed(1);
  const thetaEl = $('hud-theta'); if (thetaEl) thetaEl.textContent = (bandPower.theta ?? 0).toFixed(1);
  const drugEl = $('hud-drug'); if (drugEl) drugEl.textContent = state.drugState || 'cokeAndWeed';
  const actionEl = $('hud-action'); if (actionEl) actionEl.textContent = state.motor?.selectedAction || 'idle';
  const modelEl = $('hud-model'); if (modelEl) modelEl.textContent = bestBackend?.model?.slice(0, 25) || '—';

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
// BOOT
// ═══════════════════════════════════════════════════════════════

init();

window.addEventListener('beforeunload', () => {
  if (voice) voice.destroy();
  if (brain) brain.stop();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (voice) { voice.stopSpeaking(); voice.stopListening(); } }
  else if (isRunning && voice && !uiState.micMuted) voice.startListening();
});
