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

// ── Load API keys from env.js (gitignored, user's local keys) ──
let ENV_KEYS = {};
try {
  const env = await import('./env.js');
  ENV_KEYS = env.ENV_KEYS || {};
  console.log('[Unity] Loaded keys from env.js:', Object.keys(ENV_KEYS).filter(k => ENV_KEYS[k]).join(', ') || 'none');
} catch {
  console.log('[Unity] No env.js found — keys will be entered in setup modal');
}

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
const aiScanResults = document.getElementById('ai-scan-results');

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

  startBtn.addEventListener('click', handleStart);
  unityAvatar.addEventListener('click', toggleVoiceInput);

  // Connect buttons — clicking shows that provider's form, doesn't disconnect others
  document.querySelectorAll('.connect-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove 'active' (currently-editing) from all, but keep 'connected' on already-connected ones
      document.querySelectorAll('.connect-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showConnectForm(btn.dataset.ai);
    });
  });

  // Seed any keys from env.js into storage (won't overwrite if user already saved a different key)
  for (const [pid, key] of Object.entries(ENV_KEYS)) {
    if (key && !storage.getApiKey(pid)) {
      storage.setApiKey(pid, key);
      console.log(`[Unity] Seeded ${pid} key from env.js`);
    }
  }

  // Check if returning user already has saved keys — auto-reconnect ALL of them
  const providerIds = ['pollinations', 'openrouter', 'openai', 'anthropic', 'mistral', 'deepseek', 'groq'];
  for (const pid of providerIds) {
    const savedKey = storage.getApiKey(pid);
    if (savedKey && PROVIDERS[pid]) {
      console.log(`[Unity] Found saved ${pid} key — auto-reconnecting...`);
      const btn = document.querySelector(`.connect-btn[data-ai="${pid}"]`);
      if (btn) btn.classList.add('connected');
      await autoReconnectProvider(pid, savedKey);
    }
  }

  // Also scan for local AI in background
  scanLocalOnly();
}

/** Auto-reconnect a returning user's saved provider */
async function autoReconnectProvider(providerId, key) {
  const provider = PROVIDERS[providerId];
  if (!provider) return;

  // Set the hidden field for Pollinations specifically
  if (providerId === 'pollinations') {
    document.getElementById('api-key-input').value = key;
  }

  // Remove stale entries for this provider
  detectedAI = detectedAI.filter(d => d.name !== provider.name && d.name !== provider.name + ' Image');

  // Fetch models
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
          detectedAI.push({
            name: provider.name,
            url: provider.url,
            models,
            bestModel: models[0],
            type: 'cloud',
            apiKey: key,
          });

          // If Pollinations, also fetch image models
          if (providerId === 'pollinations') {
            try {
              const imgRes = await fetch('https://gen.pollinations.ai/image/models', {
                headers: { 'Authorization': `Bearer ${key}` },
                signal: AbortSignal.timeout(5000),
              });
              if (imgRes.ok) {
                const imgData = await imgRes.json();
                const rawImg = Array.isArray(imgData) ? imgData : (imgData.data || []);
                const imgModels = rawImg.map(m => typeof m === 'string' ? m : (m.id || m.name)).filter(Boolean);
                if (imgModels.length > 0) {
                  detectedAI.push({
                    name: provider.name + ' Image',
                    url: provider.url,
                    models: imgModels,
                    bestModel: imgModels[0],
                    type: 'cloud-image',
                  });
                }
              }
            } catch {}
          }

          enableWakeUp(provider.name, models.length);
          return;
        }
      }
    } catch (err) {
      console.warn(`[Unity] Auto-reconnect ${providerId} failed:`, err.message);
    }
  }

  // Model fetch failed but key exists — still enable with default
  detectedAI.push({
    name: provider.name,
    url: provider.url,
    models: ['default'],
    bestModel: 'default',
    type: 'cloud',
    apiKey: key,
  });
  enableWakeUp(provider.name, 1);
}

/** Scan only local ports — doesn't block setup, just adds options */
async function scanLocalOnly() {
  const probes = LOCAL_AI_ENDPOINTS.map(ep => probeEndpoint(ep));
  const results = await Promise.allSettled(probes);
  let found = 0;
  results.forEach(result => {
    if (result.status === 'fulfilled' && result.value) {
      detectedAI.push(result.value);
      found++;
    }
  });
  if (found > 0) {
    rebuildModelDropdowns();
    console.log(`[Unity] Found ${found} local AI backend(s)`);
    // If no cloud key was connected but local AI exists, enable wake up
    if (startBtn.disabled) {
      enableWakeUp('Local AI', found);
    }
  }
}

/** Show models section and enable the Wake Her Up button */
function enableWakeUp(providerName, modelCount) {
  addConnectedStatus(providerName, modelCount);
  rebuildModelDropdowns();
  document.getElementById('ai-scan-area').style.display = 'block';
  startBtn.disabled = false;
  startBtn.textContent = 'Wake Her Up';
}

// ── Cloud AI providers — browser calls these directly with user's key ──

const PROVIDERS = {
  pollinations: {
    name: 'Pollinations',
    desc: 'Free AI platform — text, image, audio, video. Works immediately. BYOP key gives higher limits.',
    hint: 'Sign up at pollinations.ai, go to your dashboard and grab your API key.',
    link: 'https://pollinations.ai/dashboard',
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
    desc: 'Claude Opus, Sonnet, Haiku. Note: Anthropic blocks direct browser calls — needs a local proxy or use OpenRouter.',
    hint: 'Get your key from Anthropic\'s console. Browser CORS limits apply — OpenRouter is the easiest workaround.',
    link: 'https://console.anthropic.com/settings/keys',
    url: 'https://api.anthropic.com',
    needsKey: true,
    corsBlocked: true,
  },
  mistral: {
    name: 'Mistral',
    desc: 'Mistral Large, Codestral, and more.',
    hint: 'Create an account at mistral.ai, then generate an API key in their console.',
    link: 'https://console.mistral.ai/api-keys',
    url: 'https://api.mistral.ai',
    modelsEndpoint: 'https://api.mistral.ai/v1/models',
    needsKey: true,
  },
  deepseek: {
    name: 'DeepSeek',
    desc: 'DeepSeek Chat and DeepSeek Coder. Cheap and good at code.',
    hint: 'Sign up at deepseek.com, then grab your key from their platform.',
    link: 'https://platform.deepseek.com/api_keys',
    url: 'https://api.deepseek.com',
    modelsEndpoint: 'https://api.deepseek.com/v1/models',
    needsKey: true,
  },
  groq: {
    name: 'Groq',
    desc: 'Ultra-fast inference. Llama, Mixtral, Gemma. Free tier available.',
    hint: 'Sign up at groq.com, then create an API key in their console.',
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
      await scanLocalOnly();
      rescanBtn.textContent = '🔄 Re-scan local ports';
    };
  } else {
    keyInput.style.display = 'block';
    keyInput.placeholder = `Paste your ${provider.name} API key`;
    saveBtn.style.display = 'inline-block';
    saveBtn.textContent = 'Connect';
    saveBtn.style.borderColor = '';
    saveBtn.style.color = '';
    saveBtn.style.background = '';
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

      // Mark this button as connected
      const thisBtn = document.querySelector(`.connect-btn[data-ai="${providerId}"]`);
      if (thisBtn) thisBtn.classList.add('connected');

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
              // Remove any previous entry for this provider only
              detectedAI = detectedAI.filter(d => d.name !== provider.name && d.name !== provider.name + ' Image');
              detectedAI.push({
                name: provider.name,
                url: provider.url,
                models,
                bestModel: models[0],
                type: 'cloud',
                apiKey: key,
              });

              // If Pollinations, also fetch image models
              if (providerId === 'pollinations') {
                try {
                  const imgRes = await fetch('https://gen.pollinations.ai/image/models', {
                    headers: { 'Authorization': `Bearer ${key}` },
                    signal: AbortSignal.timeout(5000),
                  });
                  if (imgRes.ok) {
                    const imgData = await imgRes.json();
                    const rawImg = Array.isArray(imgData) ? imgData : (imgData.data || []);
                    const imgModels = rawImg.map(m => typeof m === 'string' ? m : (m.id || m.name)).filter(Boolean);
                    if (imgModels.length > 0) {
                      detectedAI.push({
                        name: provider.name + ' Image',
                        url: provider.url,
                        models: imgModels,
                        bestModel: imgModels[0],
                        type: 'cloud-image',
                      });
                    }
                  }
                } catch {}
              }

              enableWakeUp(provider.name, models.length);
              saveBtn.textContent = `Connected! ${models.length} models`;
              saveBtn.style.background = 'rgba(34,197,94,0.15)';
              saveBtn.style.color = 'var(--green)';
              saveBtn.style.borderColor = 'var(--green)';
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
        enableWakeUp(provider.name, 1);
        saveBtn.textContent = 'Connected';
        saveBtn.style.background = 'rgba(34,197,94,0.15)';
        saveBtn.style.color = 'var(--green)';
      } else {
        saveBtn.textContent = 'Key saved — use OpenRouter for browser access';
        saveBtn.style.color = 'var(--text-dim)';
      }
    };
  }
}

function addConnectedStatus(name, modelCount) {
  const list = document.getElementById('connect-status-list');
  // Update existing row if provider already listed, otherwise add new
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

  const aiStatusEl = document.getElementById('ai-status');
  if (aiStatusEl) {
    const totalText = textBackends.reduce((sum, d) => sum + d.models.length, 0);
    const totalImage = imageBackends.reduce((sum, d) => sum + d.models.length, 0);
    aiStatusEl.textContent = `${totalText} text, ${totalImage} image`;
  }
}

// ═══════════════════════════════════════════════════════════════
// AI AUTO-DETECTION — scans local ports + Pollinations
// ═══════════════════════════════════════════════════════════════

// scanForAI removed — replaced by per-provider connect flow + scanLocalOnly

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

  // Save Pollinations key if present
  const apiKey = apiKeyInput.value.trim();
  if (apiKey) storage.setApiKey('pollinations', apiKey);

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

  // Read user's selected text model — wire to correct provider's URL and key
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
      // Set the custom URL to the selected provider's URL
      storage.set('custom_ai_url', selected.url);
      // Find the matching detected backend to grab its API key
      const matchedBackend = detectedAI.find(d => d.url === selected.url && d.name === selected.name);
      if (matchedBackend?.apiKey) {
        storage.setApiKey('active_provider', matchedBackend.apiKey);
      }
    } catch {}
  }

  // Read user's selected image model and set it on the router separately
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

  // ── Set image backend separately from text backend ──
  const savedImageModel = storage.get('image_model');
  const savedImageUrl = storage.get('image_backend_url');
  if (savedImageModel) {
    router.setImageBackend(savedImageUrl || 'pollinations', savedImageModel);
  }

  const info = router.getBackendInfo();
  console.log(`[Unity] Text: ${info.text.backend}/${info.text.model} | Image: ${info.image.backend}/${info.image.model}`);

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
    setImageBackend: (backend, model) => router.setImageBackend(backend, model),
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
    // Stop any current speech before responding
    voice.stopSpeaking();
    showSpeechBubble(`🎤 ${text}`, 2000);
    setAvatarState('thinking');
    const result = await router.handleUserMessage(text);
    // result.response is { text: "...", action: "..." } — extract the string
    const responseText = result?.response?.text || result?.response?.thought || '';
    if (responseText) {
      showSpeechBubble(responseText, 8000);
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
    // Thinking is SILENT — it's equations running, not speech.
    // Thoughts only get spoken if Unity DECIDES to speak (very rare idle vocalization).
    // Most thoughts are just brain state updates that affect her next response.
  });

  brain.on('action', (action) => {
    brainStatus.textContent = action.type || 'thinking';
  });

  // ── Hide setup, show Unity ──
  setupModal.classList.add('hidden');
  unityBubble.classList.remove('hidden');
  brainIndicator.classList.remove('hidden');
  document.getElementById('brain-hud').classList.remove('hidden');

  // ── Start brain wave visualizer — runs forever ──
  startBrainWave();

  // ── Start brain simulation ──
  brain.start();
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

// ═══════════════════════════════════════════════════════════════
// BRAIN WAVE VISUALIZER — always running, never stops
// ═══════════════════════════════════════════════════════════════

let brainWaveData = new Float32Array(300); // rolling buffer
let brainWaveOffset = 0;
let brainWaveCtx = null;
let brainWaveRunning = false;

function startBrainWave() {
  const canvas = document.getElementById('brain-wave-canvas');
  if (!canvas) return;
  brainWaveCtx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
  canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
  brainWaveRunning = true;
  renderBrainWave();
}

function renderBrainWave() {
  if (!brainWaveRunning || !brainWaveCtx) return;

  const ctx = brainWaveCtx;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const len = brainWaveData.length;

  ctx.clearRect(0, 0, w, h);

  // Draw the wave
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(255, 77, 154, 0.8)';
  ctx.lineWidth = 1.5;

  for (let i = 0; i < len; i++) {
    const x = (i / len) * w;
    const val = brainWaveData[(brainWaveOffset + i) % len];
    const y = (h / 2) + val * (h / 2);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Faint glow line underneath
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.3)';
  ctx.lineWidth = 3;
  for (let i = 0; i < len; i++) {
    const x = (i / len) * w;
    const val = brainWaveData[(brainWaveOffset + i) % len];
    const y = (h / 2) + val * (h / 2);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // If brain isn't pushing samples fast enough, generate ambient neural noise
  // Humans never flatline while alive — there's always activity
  if (brain) {
    const state = brain.getState();
    const arousal = state?.amygdala?.arousal || 0.5;
    const noise = Math.sin(Date.now() * 0.008 * (1 + arousal)) * 0.2
                + Math.sin(Date.now() * 0.023) * 0.1
                + Math.sin(Date.now() * 0.067) * 0.05
                + (Math.random() - 0.5) * 0.08;
    pushBrainSample(Math.max(-1, Math.min(1, noise)));
  }

  requestAnimationFrame(renderBrainWave);
}

function pushBrainSample(value) {
  brainWaveData[brainWaveOffset % brainWaveData.length] = value;
  brainWaveOffset++;
}

function updateBrainIndicator(state) {
  if (!state) return;

  const coherence = state.oscillations?.coherence || 0;
  const arousal = state.amygdala?.arousal || 0;
  const psi = state.psi || 0;
  const bandPower = state.oscillations?.bandPower || {};

  // Push a sample into the wave — mix of oscillation phases + noise + arousal
  const phases = state.oscillations?.phases;
  let sample = 0;
  if (phases && phases.length > 0) {
    // Sum a few oscillator phases to create an EEG-like signal
    for (let i = 0; i < Math.min(phases.length, 4); i++) {
      sample += Math.sin(phases[i]) * (0.3 - i * 0.05);
    }
  } else {
    // Fallback — generate from arousal + noise
    sample = Math.sin(Date.now() * 0.01 * (1 + arousal)) * 0.3
           + Math.sin(Date.now() * 0.037) * 0.15
           + (Math.random() - 0.5) * 0.1;
  }
  sample = Math.max(-1, Math.min(1, sample + (Math.random() - 0.5) * 0.05));
  pushBrainSample(sample);

  // ── Update HUD with real simulation data ──
  const $ = id => document.getElementById(id);

  // Core metrics
  const psiEl = $('hud-psi');
  if (psiEl) psiEl.textContent = psi.toFixed(3);

  const arousalBar = $('hud-arousal-bar');
  const arousalVal = $('hud-arousal');
  if (arousalBar) arousalBar.style.width = `${(arousal * 100).toFixed(0)}%`;
  if (arousalVal) arousalVal.textContent = `${(arousal * 100).toFixed(0)}%`;

  const valenceBar = $('hud-valence-bar');
  const valenceVal = $('hud-valence');
  if (valenceBar) valenceBar.style.width = `${((valence + 1) / 2 * 100).toFixed(0)}%`;
  if (valenceVal) valenceVal.textContent = valence.toFixed(2);

  const cohBar = $('hud-coherence-bar');
  const cohVal = $('hud-coherence');
  if (cohBar) cohBar.style.width = `${(coherence * 100).toFixed(0)}%`;
  if (cohVal) cohVal.textContent = `${(coherence * 100).toFixed(0)}%`;

  // Spikes
  const spikeCount = state.spikes ? Array.from(state.spikes).filter(s => s).length : 0;
  const spikesEl = $('hud-spikes');
  if (spikesEl) spikesEl.textContent = spikeCount;

  // Reward & time
  const rewardEl = $('hud-reward');
  if (rewardEl) rewardEl.textContent = (state.reward ?? 0).toFixed(2);
  const timeEl = $('hud-time');
  if (timeEl) timeEl.textContent = `${(state.time ?? 0).toFixed(1)}s`;

  // Band power
  const gammaEl = $('hud-gamma');
  const betaEl = $('hud-beta');
  const alphaEl = $('hud-alpha');
  const thetaEl = $('hud-theta');
  if (gammaEl) gammaEl.textContent = (bandPower.gamma ?? 0).toFixed(1);
  if (betaEl) betaEl.textContent = (bandPower.beta ?? 0).toFixed(1);
  if (alphaEl) alphaEl.textContent = (bandPower.alpha ?? 0).toFixed(1);
  if (thetaEl) thetaEl.textContent = (bandPower.theta ?? 0).toFixed(1);

  // Drug state & action
  const drugEl = $('hud-drug');
  if (drugEl) drugEl.textContent = state.drugState || 'cokeAndWeed';
  const actionEl = $('hud-action');
  if (actionEl) actionEl.textContent = state.basalGanglia?.selectedAction || state.lastAction || 'idle';

  // Module activity dots — light up based on real output magnitude
  function setModDot(id, value, threshold = 0.3) {
    const dot = $(id);
    if (!dot) return;
    dot.classList.remove('active', 'high');
    if (value > threshold * 2) dot.classList.add('high');
    else if (value > threshold) dot.classList.add('active');
  }

  setModDot('mod-cortex', Math.abs(state.cortex?.error?.[0] ?? state.cortex?.error ?? 0));
  setModDot('mod-hippo', state.hippocampus?.isStable ? 0.8 : 0.2);
  setModDot('mod-amyg', arousal);
  setModDot('mod-bg', state.basalGanglia?.confidence ?? 0);
  setModDot('mod-cblm', Math.abs(state.cerebellum?.error?.[0] ?? 0));
  setModDot('mod-hypo', state.hypothalamus?.needsAttention?.length > 0 ? 0.8 : 0.2);
  setModDot('mod-myst', psi > 1 ? 0.8 : psi > 0.3 ? 0.4 : 0.1);
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
