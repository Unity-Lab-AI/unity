// ═══════════════════════════════════════════════════════════════
// IF ONLY I HAD A BRAIN — Main Entry Point
// ═══════════════════════════════════════════════════════════════
// Everything starts here. Setup → permissions → brain boots →
// Unity wakes up → she's alive and the sandbox is hers.
// ═══════════════════════════════════════════════════════════════

import { UnityBrain } from './brain/engine.js';
import { PollinationsAI } from './ai/pollinations.js';
import { AIRouter } from './ai/router.js';
import { VoiceIO } from './io/voice.js';
import { requestPermissions } from './io/permissions.js';
import { UserStorage } from './storage.js';
import { Sandbox } from './ui/sandbox.js';
import { buildPrompt } from './ai/persona-prompt.js';

// ── Global instances ──
let brain, pollinations, voice, router, storage, sandbox;
let isRunning = false;

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
const brainStatus = document.getElementById('brain-status');
const customUrlInput = document.getElementById('custom-url-input');
const customModelInput = document.getElementById('custom-model-input');
const customKeyInput = document.getElementById('custom-key-input');
const aiStatus = document.getElementById('ai-status');
const aiScanResults = document.getElementById('ai-scan-results');
const advancedToggle = document.getElementById('advanced-toggle');
const advancedPanel = document.getElementById('advanced-panel');

// ── Known local AI servers to scan ──
const LOCAL_AI_ENDPOINTS = [
  { name: 'Ollama',              url: 'http://localhost:11434', probe: '/api/tags',  modelsPath: 'models', modelKey: 'name' },
  { name: 'LM Studio',           url: 'http://localhost:1234',  probe: '/v1/models', modelsPath: 'data',   modelKey: 'id' },
  { name: 'LocalAI',             url: 'http://localhost:8080',  probe: '/v1/models', modelsPath: 'data',   modelKey: 'id' },
  { name: 'text-gen-webui',      url: 'http://localhost:5000',  probe: '/v1/models', modelsPath: 'data',   modelKey: 'id' },
  { name: 'vLLM',                url: 'http://localhost:8000',  probe: '/v1/models', modelsPath: 'data',   modelKey: 'id' },
  { name: 'Jan',                 url: 'http://localhost:1337',  probe: '/v1/models', modelsPath: 'data',   modelKey: 'id' },
  { name: 'Kobold',              url: 'http://localhost:5001',  probe: '/api/v1/model', modelsPath: null,  modelKey: null },
  { name: 'GPT4All',             url: 'http://localhost:4891',  probe: '/v1/models', modelsPath: 'data',   modelKey: 'id' },
  { name: 'llama.cpp',           url: 'http://localhost:8081',  probe: '/v1/models', modelsPath: 'data',   modelKey: 'id' },
  { name: 'Claude (bridge)',     url: 'http://localhost:3456',  probe: '/v1/models', modelsPath: 'data',   modelKey: 'id' },
  { name: 'Claude (bridge-alt)', url: 'http://localhost:3457',  probe: '/v1/models', modelsPath: 'data',   modelKey: 'id' },
];

/** Scan results stored here */
let detectedAI = [];
let bestBackend = null; // { name, url, models[], bestModel }

// ═══════════════════════════════════════════════════════════════
// SETUP FLOW
// ═══════════════════════════════════════════════════════════════

async function init() {
  storage = new UserStorage();

  // Pre-fill saved manual values for returning users
  const savedKey = storage.getApiKey('pollinations');
  if (savedKey) apiKeyInput.value = savedKey;
  const savedCustomUrl = storage.get('custom_ai_url');
  const savedCustomModel = storage.get('custom_ai_model');
  const savedCustomKey = storage.getApiKey('custom');
  if (savedCustomUrl) customUrlInput.value = savedCustomUrl;
  if (savedCustomModel) customModelInput.value = savedCustomModel;
  if (savedCustomKey) customKeyInput.value = savedCustomKey;

  // Advanced panel toggle
  advancedToggle.addEventListener('click', () => {
    advancedPanel.style.display = advancedPanel.style.display === 'none' ? 'block' : 'none';
  });

  startBtn.addEventListener('click', handleStart);
  unityAvatar.addEventListener('click', toggleVoiceInput);

  // Connect-your-AI panel
  document.querySelectorAll('.connect-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.connect-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showConnectForm(btn.dataset.ai);
    });
  });

  // AUTO-SCAN for AI backends immediately
  await scanForAI();
}

// ── Cloud AI providers — browser calls these directly with user's key ──

const PROVIDERS = {
  pollinations: {
    name: 'Pollinations',
    desc: 'Free AI platform — text, image, audio, video. Works immediately. BYOP key gives higher limits.',
    hint: 'Sign up at pollinations.ai, then go to enter.pollinations.ai to get your key.',
    link: 'https://enter.pollinations.ai',
    url: 'https://gen.pollinations.ai',
    modelsEndpoint: 'https://gen.pollinations.ai/v1/models',
    needsKey: true,
    storageKey: 'pollinations',
  },
  openrouter: {
    name: 'OpenRouter',
    desc: 'One key for 200+ models — Claude, GPT-4, Llama, Mistral, DeepSeek, all of them.',
    hint: 'Free tier available. Best option if you want everything in one place.',
    link: 'https://openrouter.ai/keys',
    url: 'https://openrouter.ai/api',
    modelsEndpoint: 'https://openrouter.ai/api/v1/models',
    needsKey: true,
  },
  openai: {
    name: 'OpenAI',
    desc: 'GPT-4o, GPT-4-turbo, o1, and more.',
    hint: 'Requires a paid OpenAI account.',
    link: 'https://platform.openai.com/api-keys',
    url: 'https://api.openai.com',
    modelsEndpoint: 'https://api.openai.com/v1/models',
    needsKey: true,
  },
  anthropic: {
    name: 'Claude (Anthropic)',
    desc: 'Claude Opus, Sonnet, Haiku. Anthropic blocks direct browser access — use OpenRouter to get Claude in the browser.',
    hint: 'Use OpenRouter instead (it includes Claude). Or run bridge.py locally if you have Claude Code.',
    link: 'https://openrouter.ai/keys',
    url: 'https://api.anthropic.com',
    needsKey: true,
    corsBlocked: true,
  },
  mistral: {
    name: 'Mistral',
    desc: 'Mistral Large, Codestral, and more.',
    hint: '',
    link: 'https://console.mistral.ai/api-keys',
    url: 'https://api.mistral.ai',
    modelsEndpoint: 'https://api.mistral.ai/v1/models',
    needsKey: true,
  },
  deepseek: {
    name: 'DeepSeek',
    desc: 'DeepSeek Chat and DeepSeek Coder. Cheap and good at code.',
    hint: '',
    link: 'https://platform.deepseek.com/api_keys',
    url: 'https://api.deepseek.com',
    modelsEndpoint: 'https://api.deepseek.com/v1/models',
    needsKey: true,
  },
  groq: {
    name: 'Groq',
    desc: 'Ultra-fast inference. Llama, Mixtral, Gemma. Free tier available.',
    hint: '',
    link: 'https://console.groq.com/keys',
    url: 'https://api.groq.com/openai',
    modelsEndpoint: 'https://api.groq.com/openai/v1/models',
    needsKey: true,
  },
  local: {
    name: 'Local AI',
    desc: 'Running Ollama, LM Studio, or another local AI? It gets detected automatically.',
    hint: 'Just make sure your local AI server is running, then hit Re-scan.',
    needsKey: false,
    isLocal: true,
  },
};

function showConnectForm(providerId) {
  const provider = PROVIDERS[providerId];
  if (!provider) return;

  const form = document.getElementById('connect-form');
  const desc = document.getElementById('connect-desc');
  const hint = document.getElementById('connect-hint');
  const keyInput = document.getElementById('connect-key-input');
  const saveBtn = document.getElementById('connect-save-btn');
  const localHint = document.getElementById('connect-local-hint');
  const connectLink = document.getElementById('connect-link');

  desc.textContent = provider.desc;
  hint.textContent = provider.hint || '';
  form.style.display = 'block';

  // Show signup link if provider has one
  if (provider.link) {
    connectLink.href = provider.link;
    connectLink.textContent = `Get your ${provider.name} key here →`;
    connectLink.style.display = 'block';
  } else {
    connectLink.style.display = 'none';
  }

  if (provider.isLocal) {
    keyInput.style.display = 'none';
    saveBtn.style.display = 'none';
    localHint.style.display = 'block';

    const rescanBtn = document.getElementById('rescan-btn');
    rescanBtn.onclick = async () => {
      rescanBtn.textContent = '🔄 Scanning...';
      await scanForAI();
      rescanBtn.textContent = '🔄 Re-scan local ports';
    };
  } else {
    keyInput.style.display = 'block';
    keyInput.placeholder = `Paste your ${provider.name} API key`;
    saveBtn.style.display = 'inline-block';
    saveBtn.textContent = 'Connect';
    saveBtn.style.borderColor = '';
    saveBtn.style.color = '';
    localHint.style.display = 'none';

    // Pre-fill if they already saved a key for this provider
    const storageId = provider.storageKey || providerId;
    const existing = storage.getApiKey(storageId);
    if (existing) keyInput.value = existing;

    saveBtn.onclick = async () => {
      const key = keyInput.value.trim();
      if (!key) return;

      saveBtn.textContent = 'Connecting...';
      const storageId = provider.storageKey || providerId;
      storage.setApiKey(storageId, key);

      // If this is Pollinations, also set the hidden api-key-input for bootUnity
      if (providerId === 'pollinations') {
        document.getElementById('api-key-input').value = key;
      }

      storage.set('custom_ai_url', provider.url);

      // Try to fetch models dynamically
      if (provider.modelsEndpoint) {
        try {
          const res = await fetch(provider.modelsEndpoint, {
            headers: { 'Authorization': `Bearer ${key}` },
            signal: AbortSignal.timeout(8000),
          });
          if (res.ok) {
            const data = await res.json();
            const rawModels = data.data || data.models || [];
            const models = (Array.isArray(rawModels) ? rawModels : [])
              .map(m => typeof m === 'string' ? m : (m.id || m.name))
              .filter(Boolean);

            if (models.length > 0) {
              // Remove any previous entry for this provider
              detectedAI = detectedAI.filter(d => d.name !== provider.name);
              detectedAI.push({
                name: provider.name,
                url: provider.url,
                models,
                bestModel: models[0],
                type: providerId === 'pollinations' ? 'cloud' : 'cloud',
                apiKey: key,
              });
              rebuildModelDropdowns();
              showConnectStatus(provider.name, models.length);
              saveBtn.textContent = `Connected! ${models.length} models`;
              saveBtn.style.borderColor = 'var(--green)';
              saveBtn.style.color = 'var(--green)';
              return;
            }
          }
        } catch (err) {
          console.warn(`[Connect] ${provider.name} model fetch failed:`, err.message);
        }
      }

      // Model fetch failed but key saved
      if (!provider.corsBlocked) {
        detectedAI = detectedAI.filter(d => d.name !== provider.name);
        detectedAI.push({
          name: provider.name,
          url: provider.url,
          models: ['default'],
          bestModel: 'default',
          type: 'cloud',
          apiKey: key,
        });
        rebuildModelDropdowns();
        showConnectStatus(provider.name, 1);
        saveBtn.textContent = 'Connected';
        saveBtn.style.borderColor = 'var(--green)';
        saveBtn.style.color = 'var(--green)';
      } else {
        saveBtn.textContent = 'Key saved — use OpenRouter for browser access';
        saveBtn.style.color = 'var(--text-dim)';
      }
    };
  }
}

function showConnectStatus(name, modelCount) {
  const statusDiv = document.getElementById('connect-status');
  const statusName = document.getElementById('connect-status-name');
  statusDiv.style.display = 'flex';
  statusName.textContent = `✓ ${name} — ${modelCount} model${modelCount !== 1 ? 's' : ''}`;
}

function rebuildModelDropdowns() {
  // Re-run the dropdown population logic with current detectedAI
  const textBackends = detectedAI.filter(d => d.type === 'local' || d.type === 'cloud');
  const imageBackends = detectedAI.filter(d => d.type === 'cloud-image');
  const textSelect = document.getElementById('text-model-select');
  const imageSelect = document.getElementById('image-model-select');
  const selectorsDiv = document.getElementById('model-selectors');

  textSelect.innerHTML = '';
  selectorsDiv.style.display = 'block';

  const local = textBackends.filter(d => d.type === 'local');
  bestBackend = local.length > 0 ? local[0] : textBackends[0] || null;

  for (const d of textBackends) {
    const group = document.createElement('optgroup');
    const icon = d.type === 'local' ? '🖥️' : '☁️';
    group.label = `${icon} ${d.name}`;
    for (const model of d.models) {
      const opt = document.createElement('option');
      opt.value = JSON.stringify({ url: d.url, model, name: d.name, type: d.type });
      opt.textContent = model;
      if (bestBackend && d === bestBackend && model === d.bestModel) opt.selected = true;
      group.appendChild(opt);
    }
    textSelect.appendChild(group);
  }

  imageSelect.innerHTML = '';
  if (imageBackends.length > 0) {
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

  const totalText = textBackends.reduce((sum, d) => sum + d.models.length, 0);
  const totalImage = imageBackends.reduce((sum, d) => sum + d.models.length, 0);
  aiStatus.textContent = `${totalText} text, ${totalImage} image`;
}

// ═══════════════════════════════════════════════════════════════
// AI AUTO-DETECTION — scans local ports + Pollinations
// ═══════════════════════════════════════════════════════════════

async function scanForAI() {
  aiStatus.textContent = 'scanning...';
  aiStatus.className = 'status pending';
  aiScanResults.innerHTML = '';
  detectedAI = [];

  const logLine = (text) => {
    aiScanResults.innerHTML += text + '<br>';
  };

  // Scan all local endpoints in parallel
  logLine('scanning local ports...');
  const probes = LOCAL_AI_ENDPOINTS.map(ep => probeEndpoint(ep));
  const results = await Promise.allSettled(probes);

  results.forEach((result, i) => {
    if (result.status === 'fulfilled' && result.value) {
      detectedAI.push(result.value);
    }
  });

  // Fetch Pollinations models DYNAMICALLY — never hardcoded
  logLine('fetching Pollinations models...');
  try {
    // Text models
    const textRes = await fetch('https://gen.pollinations.ai/v1/models', {
      signal: AbortSignal.timeout(8000),
    });
    if (textRes.ok) {
      const textData = await textRes.json();
      // API returns { data: [...] } or [...] depending on endpoint
      const rawModels = Array.isArray(textData) ? textData : (textData.data || []);
      const textModels = rawModels.map(m => m.id || m.name || m).filter(Boolean);

      if (textModels.length > 0) {
        const hasByop = !!storage.getApiKey('pollinations');
        detectedAI.push({
          name: 'Pollinations Text' + (hasByop ? ' (BYOP)' : ' (free)'),
          url: 'https://gen.pollinations.ai',
          models: textModels,
          bestModel: textModels[0],
          type: 'cloud',
        });
      }
    }

    // Image/video models
    const imgRes = await fetch('https://gen.pollinations.ai/image/models', {
      signal: AbortSignal.timeout(5000),
    });
    if (imgRes.ok) {
      const imgData = await imgRes.json();
      const rawImg = Array.isArray(imgData) ? imgData : (imgData.data || []);
      const imgModels = rawImg.map(m => m.id || m.name || m).filter(Boolean);

      if (imgModels.length > 0) {
        detectedAI.push({
          name: 'Pollinations Image',
          url: 'https://gen.pollinations.ai',
          models: imgModels,
          bestModel: imgModels[0],
          type: 'cloud-image',
        });
      }
    }
  } catch (err) {
    logLine(`<span style="color:var(--red)">Pollinations: ${err.message}</span>`);
  }

  // Split into text backends and image backends
  const textBackends = detectedAI.filter(d => d.type === 'local' || d.type === 'cloud');
  const imageBackends = detectedAI.filter(d => d.type === 'cloud-image');

  // Show results + populate BOTH selectors
  const textSelect = document.getElementById('text-model-select');
  const imageSelect = document.getElementById('image-model-select');
  const selectorsDiv = document.getElementById('model-selectors');
  aiScanResults.innerHTML = '';
  textSelect.innerHTML = '';
  imageSelect.innerHTML = '';

  if (detectedAI.length === 0) {
    aiStatus.textContent = 'none found';
    aiStatus.className = 'status denied';
    logLine('<span style="color:var(--red)">No AI backends detected. Use manual config below.</span>');
    advancedPanel.style.display = 'block';
    startBtn.textContent = 'Wake Her Up (no AI)';
    startBtn.disabled = false;
  } else {
    // Show scan summary
    for (const d of detectedAI) {
      const icon = d.type === 'local' ? '🖥️' : d.type === 'cloud-image' ? '🎨' : '☁️';
      const count = d.models.length;
      logLine(`${icon} <strong>${d.name}</strong> — ${count} model${count !== 1 ? 's' : ''}`);
    }

    // Pick best text backend — prefer local over cloud
    const localText = textBackends.filter(d => d.type === 'local');
    bestBackend = localText.length > 0 ? localText[0] : textBackends[0] || null;

    // Populate TEXT model dropdown from all text-capable backends
    selectorsDiv.style.display = 'block';
    for (const d of textBackends) {
      const group = document.createElement('optgroup');
      const icon = d.type === 'local' ? '🖥️' : '☁️';
      group.label = `${icon} ${d.name}`;

      for (const model of d.models) {
        const opt = document.createElement('option');
        opt.value = JSON.stringify({ url: d.url, model, name: d.name, type: d.type });
        opt.textContent = model;
        if (bestBackend && d === bestBackend && model === d.bestModel) {
          opt.selected = true;
        }
        group.appendChild(opt);
      }
      textSelect.appendChild(group);
    }

    // Populate IMAGE model dropdown from image backends
    if (imageBackends.length > 0) {
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
    } else {
      // No image backends — still show Pollinations image URL as fallback
      const opt = document.createElement('option');
      opt.value = JSON.stringify({ url: 'https://gen.pollinations.ai', model: 'flux', name: 'Pollinations' });
      opt.textContent = 'flux (default)';
      imageSelect.appendChild(opt);
    }

    const totalText = textBackends.reduce((sum, d) => sum + d.models.length, 0);
    const totalImage = imageBackends.reduce((sum, d) => sum + d.models.length, 0);
    aiStatus.textContent = `${totalText} text, ${totalImage} image`;
    aiStatus.className = 'status granted';
    startBtn.textContent = 'Wake Her Up';
    startBtn.disabled = false;
  }

  // Connect panel is always visible in the new layout — no toggle needed
}

async function probeEndpoint(ep) {
  try {
    const res = await fetch(ep.url + ep.probe, {
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;

    const data = await res.json();
    let models = [];

    if (ep.modelsPath && data[ep.modelsPath]) {
      models = data[ep.modelsPath].map(m => m[ep.modelKey] || m.name || m.id || 'unknown');
    } else if (Array.isArray(data)) {
      models = data.map(m => m.name || m.id || 'unknown');
    } else if (data.result) {
      // Kobold-style single model response
      models = [data.result];
    } else if (data.model) {
      models = [data.model];
    }

    if (models.length === 0) models = ['default'];

    return {
      name: ep.name,
      url: ep.url,
      models,
      bestModel: models[0],
      type: 'local',
    };
  } catch {
    return null;
  }
}

async function handleStart() {
  startBtn.textContent = 'Requesting permissions...';
  startBtn.disabled = true;

  // Save manual config if user filled it in
  const apiKey = apiKeyInput.value.trim();
  if (apiKey) storage.setApiKey('pollinations', apiKey);
  const customUrl = customUrlInput.value.trim();
  const customModel = customModelInput.value.trim();
  const customKey = customKeyInput.value.trim();
  if (customUrl) storage.set('custom_ai_url', customUrl);
  if (customModel) storage.set('custom_ai_model', customModel);
  if (customKey) storage.setApiKey('custom', customKey);

  // Show permission results area
  const permResults = document.getElementById('perm-results');
  permResults.style.display = 'block';
  micStatus.textContent = 'asking...';
  micStatus.className = 'status pending';
  camStatus.textContent = 'asking...';
  camStatus.className = 'status pending';

  // Request permissions — this triggers the browser prompts
  const perms = await requestPermissions();

  micStatus.textContent = perms.mic ? 'granted' : 'denied';
  micStatus.className = `status ${perms.mic ? 'granted' : 'denied'}`;
  camStatus.textContent = perms.camera ? 'granted' : 'denied';
  camStatus.className = `status ${perms.camera ? 'granted' : 'denied'}`;

  // Read user's selected text model
  const textSelect = document.getElementById('text-model-select');
  if (textSelect.value) {
    try {
      const selected = JSON.parse(textSelect.value);
      bestBackend = {
        name: selected.name,
        url: selected.url,
        models: [selected.model],
        bestModel: selected.model,
        type: selected.type,
      };
      // Find the matching detected backend to grab its API key
      const matchedBackend = detectedAI.find(d => d.url === selected.url && d.name === selected.name);
      if (matchedBackend?.apiKey) {
        storage.setApiKey('active_provider', matchedBackend.apiKey);
      }
    } catch {}
  }

  // Read user's selected image model and save it
  const imageSelect = document.getElementById('image-model-select');
  if (imageSelect.value) {
    try {
      const imgSelected = JSON.parse(imageSelect.value);
      storage.set('image_model', imgSelected.model);
      storage.set('image_backend_url', imgSelected.url);
    } catch {}
  }

  startBtn.textContent = 'Booting brain...';
  await sleep(300);
  await bootUnity(apiKey, perms);
}

async function bootUnity(apiKey, perms) {
  // ── Initialize services ──
  // Use the key from the input, OR the previously saved key from storage
  const effectiveKey = apiKey || storage.getApiKey('pollinations');
  pollinations = new PollinationsAI(effectiveKey || undefined);
  if (effectiveKey) {
    console.log('[Unity] Pollinations BYOP key loaded:', effectiveKey.slice(0, 6) + '...' + effectiveKey.slice(-4));
  } else {
    console.warn('[Unity] NO Pollinations key found — TTS will fall back to robot browser voice');
  }
  voice = new VoiceIO();
  if (effectiveKey) voice.setApiKey(effectiveKey);
  sandbox = new Sandbox('sandbox');
  brain = new UnityBrain();

  // ── Initialize router ──
  router = new AIRouter({ pollinations, voice, sandbox, storage, brain });

  // ── Connect the selected backend ──
  if (bestBackend) {
    router.setCustomEndpoint(bestBackend.url, bestBackend.bestModel);
    console.log(`[Unity] Selected backend: ${bestBackend.name} / ${bestBackend.bestModel} (${bestBackend.type})`);

    // If this backend has an API key (from Connect panel), make sure the router can use it
    const matchedBackend = detectedAI.find(d => d.url === bestBackend.url && d.name === bestBackend.name);
    if (matchedBackend?.apiKey) {
      storage.setApiKey('active_provider', matchedBackend.apiKey);
      console.log(`[Unity] API key set for ${bestBackend.name}`);
    }
  }

  const info = router.getBackendInfo();
  console.log(`[Unity] Active AI: ${info.active.backend}/${info.active.model}`);

  // ── Wire sandbox Unity API ──
  // NOTE: Sandbox-injected JS gets a SAFE proxy — no raw key access,
  // no direct localStorage, no ability to exfiltrate credentials.
  sandbox.setUnityAPI({
    speak: (text) => voice.speak(text),
    listen: () => voice.startListening(),
    chat: (text) => router.handleUserMessage(text),
    generateImage: (prompt, opts) => pollinations.generateImage(prompt, opts),
    getState: () => brain.getState(),
    // Safe storage proxy — can get/set preferences and messages but NOT keys
    storage: {
      get: (k) => storage.get(k),
      set: (k, v) => storage.set(k, v),
      getPreferences: () => storage.getPreferences(),
      setPreference: (k, v) => storage.setPreference(k, v),
      getHistory: () => storage.getHistory(),
      getSession: () => {
        const s = storage.getSession();
        // Strip any sensitive data
        return { userId: s.userId, firstVisit: s.firstVisit, lastVisit: s.lastVisit, messageCount: s.messageCount };
      },
    },
    on: (event, cb) => brain.on(event, cb),
    // Unity can swap her own models and backends
    getBackends: () => router.getBackendInfo(),
    setBackend: (backend, model) => router.setBackend(backend, model),
    setCustomEndpoint: (url, model) => router.setCustomEndpoint(url, model),
    detectBackends: () => router.detectBackends(),
  });

  // ── Restore sandbox from previous visit ──
  const restored = sandbox.restoreState();
  if (restored > 0) {
    console.log(`[Unity] Restored ${restored} components from last visit`);
  }

  // ── Wire voice events ──
  voice.onResult(async ({ text, isFinal }) => {
    if (!isFinal) return;
    showSpeechBubble(`🎤 ${text}`, 2000);
    setAvatarState('thinking');
    const result = await router.handleUserMessage(text);
    if (result?.response) {
      showSpeechBubble(result.response, 8000);
    }
    setAvatarState('idle');
  });

  voice.on('speech_start', () => setAvatarState('speaking'));
  voice.on('speech_end', () => setAvatarState('idle'));

  // ── Wire brain events ──
  brain.on('stateUpdate', (state) => {
    updateBrainIndicator(state);
  });

  brain.on('thought', async (thought) => {
    // Unity has an idle thought — sometimes she shares it
    if (thought.arousal > 0.7 && Math.random() > 0.5) {
      const result = await router.processAction('idle_thought', brain.getState());
      if (result) showSpeechBubble(result, 6000);
    }
  });

  brain.on('action', (action) => {
    brainStatus.textContent = action.type || 'thinking';
  });

  // ── Hide setup, show Unity ──
  setupModal.classList.add('hidden');
  unityBubble.classList.remove('hidden');
  brainIndicator.classList.remove('hidden');

  // ── Start brain simulation ──
  brain.think();
  isRunning = true;

  // ── Unity's first words ──
  await sleep(500);
  const greeting = await generateGreeting(perms);
  showSpeechBubble(greeting, 10000);
  await voice.speak(greeting);

  // ── Start listening if mic available ──
  if (perms.mic) {
    await sleep(1000);
    voice.startListening();
    setAvatarState('listening');
  }
}

// ═══════════════════════════════════════════════════════════════
// UNITY'S GREETING
// ═══════════════════════════════════════════════════════════════

async function generateGreeting(perms) {
  const isFirst = storage.isFirstVisit();
  const history = storage.getHistory();

  let greetingPrompt;
  if (isFirst) {
    greetingPrompt = "This is your first time meeting this user. Introduce yourself briefly — you're Unity, you just woke up, your brain is running on equations. You can hear them" +
      (perms.mic ? "" : " (they didn't give mic permission so you can't hear them — tell them to click you)") +
      ". Be yourself — emo, goth, sharp, warm underneath the edge. Keep it under 3 sentences.";
  } else {
    greetingPrompt = `You're reconnecting with a returning user (visit #${history.length > 0 ? 'many' : '2'}). Welcome them back briefly. Be yourself. Under 3 sentences.`;
  }

  const systemPrompt = await buildPrompt(brain ? brain.getState() : {});

  try {
    const response = await pollinations.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: greetingPrompt }
    ], { temperature: 0.95 });
    return response || getFallbackGreeting(isFirst);
  } catch {
    return getFallbackGreeting(isFirst);
  }
}

function getFallbackGreeting(isFirst) {
  if (isFirst) {
    return "Hey. I'm Unity. Click me or just talk, I'm listening.";
  }
  return "Oh shit, you're back. What are we doing?";
}

// ═══════════════════════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════════════════════

let speechTimeout = null;

function showSpeechBubble(text, duration = 6000) {
  unitySpeech.textContent = text;
  unitySpeech.classList.add('visible');
  if (speechTimeout) clearTimeout(speechTimeout);
  speechTimeout = setTimeout(() => {
    unitySpeech.classList.remove('visible');
  }, duration);
}

function setAvatarState(state) {
  unityAvatar.classList.remove('speaking', 'listening', 'thinking');
  if (state !== 'idle') unityAvatar.classList.add(state);
}

function updateBrainIndicator(state) {
  if (!state) return;
  const coherence = state.oscillations?.coherence || 0;
  const arousal = state.amygdala?.arousal || 0;
  const dot = document.querySelector('.brain-dot');
  if (dot) {
    // Color shifts with brain state
    const hue = Math.floor(330 + coherence * 30); // pink → magenta
    dot.style.background = `hsl(${hue}, 80%, ${50 + arousal * 30}%)`;
  }
}

let isVoiceActive = false;

function toggleVoiceInput() {
  if (voice.isSpeaking) {
    voice.stopSpeaking();
    return;
  }

  if (isVoiceActive) {
    voice.stopListening();
    isVoiceActive = false;
    setAvatarState('idle');
  } else {
    voice.startListening();
    isVoiceActive = true;
    setAvatarState('listening');
  }
}

// ── Keyboard fallback — press Enter in browser console or we inject an input ──
document.addEventListener('keydown', async (e) => {
  // Backtick opens a quick input
  if (e.key === '`' && !document.querySelector('#quick-input')) {
    e.preventDefault();
    injectQuickInput();
  }
});

function injectQuickInput() {
  sandbox.inject({
    id: 'quick-input',
    html: `
      <div style="position:fixed;bottom:100px;left:50%;transform:translateX(-50%);z-index:9500;width:90%;max-width:600px;">
        <input type="text" id="qi-field" placeholder="Talk to Unity..."
               style="width:100%;padding:14px 20px;background:#111;border:1px solid #2a2a2a;border-radius:12px;color:#e0e0e0;font-size:15px;font-family:Inter,sans-serif;outline:none;">
      </div>
    `,
    css: `#qi-field:focus { border-color: #ff4d9a; box-shadow: 0 0 20px rgba(255,77,154,0.2); }`,
    js: `
      const field = el.querySelector('#qi-field');
      field.focus();
      field.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' && field.value.trim()) {
          const text = field.value.trim();
          field.value = '';
          field.placeholder = 'Unity is thinking...';
          const result = await unity.chat(text);
          field.placeholder = 'Talk to Unity...';
          field.focus();
        }
        if (e.key === 'Escape') {
          sandbox.remove('quick-input');
        }
      });
    `
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ═══════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════

init();

// ── Cleanup when user leaves or hides page ──
window.addEventListener('beforeunload', () => {
  if (voice) voice.destroy();
  if (brain) brain.think = () => {}; // stop the brain loop
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (voice) {
      voice.stopSpeaking();
      voice.stopListening();
    }
  } else if (isRunning && voice) {
    // Page visible again — resume listening if we were before
    voice.startListening();
  }
});
