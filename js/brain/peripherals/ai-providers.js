/**
 * ai-providers.js — Sensory AI Provider Manager (Brain Peripheral)
 *
 * R4 of brain-refactor-full-control — this file used to be the general
 * AI provider manager with chat() for text generation + generateImage()
 * for visual output + speak() for TTS. Text-AI (chat) is GONE. Unity
 * speaks equationally via the language cortex, no text-AI backend.
 *
 * What's left is SENSORY AI only — peripherals that translate between
 * raw sensor data and brain state:
 *
 *   - generateImage()  — image gen (Pollinations + custom user backend)
 *   - speak()          — TTS (Pollinations)
 *   - describer        — vision/VLM call (used by visual-cortex.js
 *                         directly, not routed through this file)
 *
 * None of these drive Unity's cognition. She decides WHEN to draw / speak
 * / look, and WHAT to draw / speak about (via equational slot scoring
 * over her language cortex). These peripherals just execute the output.
 *
 * Multi-backend image gen:
 *   - Pollinations is the default image backend (free, no key required)
 *   - Users can configure a custom image endpoint via `configureImageGen(
 *     url, model, apiKey)` — for example, a self-hosted Stable Diffusion,
 *     DALL-E, or any OpenAI-compatible /v1/images/generations endpoint
 *   - `generateImage()` tries custom first, falls back to Pollinations
 *     if the custom backend fails or isn't configured
 *   - Dead-backend tracking reuses the same cooldown pattern from the
 *     old text-chat path
 */

// ── Local image generation backends that get auto-probed on boot ──
//
// Common open-source Stable Diffusion / DALL-E-alike servers that
// users typically run on localhost. The probe URL is the lightest
// request that confirms the server is up AND supports image gen.
// If the probe succeeds, the backend gets registered and used in
// priority order (custom user-configured → local detected → Pollinations).
//
// To add a new local backend, append an entry here — no other code
// changes required. The _customGenerateImage path handles OpenAI-
// compatible / raw-URL / b64_json response shapes uniformly.
const LOCAL_IMAGE_BACKENDS = [
  { name: 'Automatic1111',  url: 'http://localhost:7860',  probe: '/sdapi/v1/sd-models',       kind: 'a1111' },
  { name: 'SD.Next / Forge', url: 'http://localhost:7861', probe: '/sdapi/v1/sd-models',       kind: 'a1111' },
  { name: 'Fooocus',        url: 'http://localhost:7865',  probe: '/ping',                     kind: 'openai' },
  { name: 'ComfyUI',        url: 'http://localhost:8188',  probe: '/system_stats',             kind: 'comfy' },
  { name: 'InvokeAI',       url: 'http://localhost:9090',  probe: '/api/v1/app/version',       kind: 'invokeai' },
  { name: 'LocalAI',        url: 'http://localhost:8081',  probe: '/v1/models',                kind: 'openai' },
  // R15 — removed stale `Ollama (SD)` entry on :11434 here. Ollama
  // doesn't actually serve Stable Diffusion; that was a copy-paste
  // error from an earlier commit. Ollama lives on the VISION side
  // (LOCAL_VISION_BACKENDS below) where llava/moondream/bakllava
  // actually run.
];

// ── Local VLM (vision-language model) backends for the describer ──
//
// R13 — same auto-probe treatment as image gen, but for vision. Unity's
// visual cortex IT layer asks these backends "what do you see" on camera
// frames. Ollama's vision models (llava, moondream, bakllava) are the
// easiest path since most people already run Ollama for text. LM Studio
// and llama.cpp server both expose OpenAI-compatible /v1/chat/completions
// with multimodal message content.
//
// For Ollama specifically we probe /api/tags and filter for vision-capable
// model names at register time — the model list tells us which VLM is
// actually loaded.
const LOCAL_VISION_BACKENDS = [
  { name: 'Ollama (VLM)',   url: 'http://localhost:11434', probe: '/api/tags',   kind: 'ollama-vision' },
  { name: 'LM Studio',      url: 'http://localhost:1234',  probe: '/v1/models',  kind: 'openai-vision' },
  { name: 'LocalAI (VLM)',  url: 'http://localhost:8081',  probe: '/v1/models',  kind: 'openai-vision' },
  { name: 'llama.cpp',      url: 'http://localhost:8080',  probe: '/v1/models',  kind: 'openai-vision' },
  { name: 'Jan',            url: 'http://localhost:1337',  probe: '/v1/models',  kind: 'openai-vision' },
];

// Substrings that mark a model as vision-capable. Used when probing
// /api/tags or /v1/models to pick the right model id.
const VISION_MODEL_HINTS = ['llava', 'moondream', 'bakllava', 'vision', 'vl', 'cogvlm', 'minicpm-v'];

export class SensoryAIProviders {
  constructor({ pollinations, storage }) {
    this._pollinations = pollinations;
    this._storage = storage;

    // Custom image generation backend — user-configurable at runtime
    // via setup modal or env.js. If set, generateImage() tries this
    // first before local-detected or Pollinations.
    this._customImageUrl = null;
    this._customImageModel = null;
    this._customImageKey = null;

    // Auto-detected local image backends — populated by `autoDetect()`
    // at boot. Each entry: { name, url, model, kind }. generateImage()
    // iterates this list between the custom and Pollinations fallbacks.
    this._localImageBackends = [];

    // R13 — auto-detected + env.js-configured VLM backends for vision
    // describer. describeImage() iterates this list before falling
    // back to Pollinations multimodal.
    this._localVisionBackends = [];

    // R13 — consecutive failure counter on vision describer; after 3
    // hits we pause vision for 30s to avoid hammering a dead endpoint.
    this._visionFailCount = 0;
    this._visionPausedUntil = 0;

    // R13 — event emitter for sensory status changes. App.js subscribes
    // to render toasts. Not a full EventTarget, just a callback list
    // to keep the peripheral layer framework-free.
    this._statusListeners = [];

    this._abortController = null;
    this._deadBackends = new Map(); // url → timestamp when marked dead
    this._deadCooldown = 3600000;   // 1 hour — if a backend is dead, leave it

    // User-selected preferred backends. When set, generateImage and
    // describeImage try these FIRST before walking the priority chain.
    // Stored as { name, source, model? } — name+source uniquely pick a
    // single entry from getStatus().image / .vision. Persisted to
    // localStorage via app.js; loaded back on boot.
    this._preferredImage = null;
    this._preferredVision = null;
  }

  /**
   * Pick the active backend the user wants for one of the two kinds.
   * Called from app.js when the setup modal selector changes.
   * @param {'image'|'vision'} kind
   * @param {{name: string, source: string, model?: string}|null} pref
   */
  setPreferredBackend(kind, pref) {
    if (kind === 'image') this._preferredImage = pref;
    else if (kind === 'vision') this._preferredVision = pref;
  }

  /**
   * Look up a registered backend by (source, name) so the preferred
   * chooser can route to the right _customGenerateImage / _customDescribeImage
   * path without re-implementing each backend's dispatcher.
   */
  _findBackend(kind, source, name) {
    if (source === 'default' || name === 'Pollinations') {
      return { pollinations: true };
    }
    const list = kind === 'image' ? this._localImageBackends : this._localVisionBackends;
    for (const b of list) {
      if (b.name === name) return b;
    }
    if (kind === 'image' && source === 'configured' && this._customImageUrl) {
      return {
        name: 'custom',
        url: this._customImageUrl,
        model: this._customImageModel,
        key: this._customImageKey,
      };
    }
    return null;
  }

  /**
   * R13 — subscribe to sensory status events. Fires when a backend is
   * registered, marked dead, recovered, or when a request falls through
   * the priority chain. Payload: {kind, event, backend, reason}.
   */
  onStatus(fn) {
    this._statusListeners.push(fn);
    return () => {
      const i = this._statusListeners.indexOf(fn);
      if (i >= 0) this._statusListeners.splice(i, 1);
    };
  }

  _emitStatus(payload) {
    for (const fn of this._statusListeners) {
      try { fn(payload); } catch (err) { console.warn('[SensoryAI] status listener error:', err.message); }
    }
  }

  /**
   * R13 — return a snapshot of every registered backend for the status
   * HUD. Groups by kind (image/vision) with state dots.
   */
  getStatus() {
    const imageBackends = [];
    if (this._customImageUrl) {
      imageBackends.push({
        name: 'custom',
        url: this._customImageUrl,
        source: 'configured',
        state: this._isBackendDead(this._customImageUrl) ? 'dead' : 'alive',
      });
    }
    for (const b of this._localImageBackends) {
      imageBackends.push({
        name: b.name,
        url: b.url,
        source: b.fromEnv ? 'env' : (b.detected ? 'auto' : 'config'),
        state: this._isBackendDead(b.url) ? 'dead' : 'alive',
      });
    }
    imageBackends.push({ name: 'Pollinations', url: 'pollinations', source: 'default', state: 'alive' });

    const visionBackends = [];
    for (const b of this._localVisionBackends) {
      visionBackends.push({
        name: b.name,
        url: b.url,
        model: b.model,
        source: b.fromEnv ? 'env' : (b.detected ? 'auto' : 'config'),
        state: this._isBackendDead(b.url) ? 'dead' : 'alive',
      });
    }
    visionBackends.push({ name: 'Pollinations', url: 'pollinations', source: 'default', state: 'alive' });

    return {
      image: imageBackends,
      vision: visionBackends,
      visionPaused: Date.now() < this._visionPausedUntil,
    };
  }

  /**
   * Auto-detect local image gen servers running on the user's machine.
   * Probes known ports for popular SD / DALL-E backends in parallel
   * with a short timeout. Any server that responds gets registered.
   *
   * Called on brain boot from app.js. Non-blocking: returns a promise
   * but the brain can start using Pollinations immediately while the
   * probe runs. Detected backends become available when their probe
   * resolves.
   *
   * @param {object} opts
   * @param {number} opts.timeoutMs — per-probe timeout (default 1500)
   * @returns {Promise<Array>} — list of detected backends
   */
  async autoDetect(opts = {}) {
    const timeoutMs = opts.timeoutMs ?? 1500;
    const probes = LOCAL_IMAGE_BACKENDS.map(async (backend) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(backend.url + backend.probe, {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          console.log(`[SensoryAI] Detected local image backend: ${backend.name} at ${backend.url}`);
          return { ...backend, detected: true };
        }
      } catch {
        // Probe failed — backend not running. Silent, this is expected.
      }
      return null;
    });

    const results = await Promise.all(probes);
    this._localImageBackends = results.filter(r => r !== null);
    if (this._localImageBackends.length > 0) {
      console.log(`[SensoryAI] ${this._localImageBackends.length} local image backend(s) registered:`,
        this._localImageBackends.map(b => b.name).join(', '));
    }
    this._emitStatus({ kind: 'image', event: 'autodetect-complete', backends: this._localImageBackends });
    return this._localImageBackends;
  }

  /**
   * R13 — auto-detect local VLM backends for the vision describer.
   * Same shape as autoDetect() but for vision. For Ollama we additionally
   * parse /api/tags to find a vision-capable model to use.
   */
  async autoDetectVision(opts = {}) {
    const timeoutMs = opts.timeoutMs ?? 1500;
    const probes = LOCAL_VISION_BACKENDS.map(async (backend) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(backend.url + backend.probe, {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) return null;

        // Parse the model list to pick a vision-capable model id
        const data = await res.json().catch(() => null);
        let visionModel = null;
        if (data) {
          if (Array.isArray(data.models)) {
            // Ollama shape
            const hit = data.models.find(m =>
              VISION_MODEL_HINTS.some(h => (m.name || m.model || '').toLowerCase().includes(h))
            );
            if (hit) visionModel = hit.name || hit.model;
          } else if (Array.isArray(data.data)) {
            // OpenAI shape
            const hit = data.data.find(m =>
              VISION_MODEL_HINTS.some(h => (m.id || '').toLowerCase().includes(h))
            );
            if (hit) visionModel = hit.id;
          }
        }

        if (!visionModel && backend.kind === 'ollama-vision') {
          // Ollama probe succeeded but no vision model pulled — skip
          return null;
        }

        console.log(`[SensoryAI] Detected vision backend: ${backend.name} at ${backend.url}${visionModel ? ` (model: ${visionModel})` : ''}`);
        return { ...backend, model: visionModel || 'gpt-4-vision-preview', detected: true };
      } catch {
        return null;
      }
    });

    const results = await Promise.all(probes);
    const found = results.filter(r => r !== null);
    this._localVisionBackends.push(...found);
    if (found.length > 0) {
      console.log(`[SensoryAI] ${found.length} vision backend(s) registered:`,
        found.map(b => b.name).join(', '));
    }
    this._emitStatus({ kind: 'vision', event: 'autodetect-complete', backends: this._localVisionBackends });
    return this._localVisionBackends;
  }

  /**
   * Load image backend config from env.js-style config object.
   *
   * Expected shape in env.js:
   *   export const ENV_KEYS = {
   *     pollinations: 'sk_...',        // existing
   *     imageBackends: [               // NEW
   *       { url: 'http://my-server:7860', model: 'sdxl-turbo', key: 'optional' },
   *       { url: 'https://api.example.com', model: 'dalle-3', key: 'sk-...' },
   *     ],
   *   };
   *
   * Called from app.js boot after ENV_KEYS is loaded.
   */
  loadEnvConfig(envKeys) {
    if (!envKeys) return;
    const imageBackends = Array.isArray(envKeys.imageBackends) ? envKeys.imageBackends : [];
    for (const b of imageBackends) {
      if (b.url) {
        this._localImageBackends.push({
          name: b.name || `env:${b.url}`,
          url: b.url,
          model: b.model || 'default',
          kind: b.kind || 'openai',
          key: b.key || null,
          detected: false,
          fromEnv: true,
        });
      }
    }
    if (imageBackends.length > 0) {
      console.log(`[SensoryAI] Loaded ${imageBackends.length} image backend(s) from env.js`);
    }

    // R13 — env.js-configured vision backends
    const visionBackends = Array.isArray(envKeys.visionBackends) ? envKeys.visionBackends : [];
    for (const b of visionBackends) {
      if (b.url) {
        this._localVisionBackends.push({
          name: b.name || `env:${b.url}`,
          url: b.url,
          model: b.model || 'gpt-4-vision-preview',
          kind: b.kind || 'openai-vision',
          key: b.key || null,
          detected: false,
          fromEnv: true,
        });
      }
    }
    if (visionBackends.length > 0) {
      console.log(`[SensoryAI] Loaded ${visionBackends.length} vision backend(s) from env.js`);
    }
  }

  /**
   * Configure a custom image generation backend. Call this from the
   * setup modal when the user adds their own image provider.
   *
   * @param {string} url — base URL of the custom backend
   * @param {string} model — model name to request
   * @param {string} apiKey — bearer token (optional)
   */
  configureImageGen(url, model, apiKey) {
    this._customImageUrl = url;
    this._customImageModel = model;
    this._customImageKey = apiKey;
    console.log('[SensoryAI] Custom image backend configured:', url, model);
  }

  /**
   * Generate an image. Priority order:
   *   1. Custom backend (configured via configureImageGen — e.g. user's
   *      own OpenAI-compatible /v1/images/generations endpoint)
   *   2. Auto-detected local backends (Automatic1111, ComfyUI,
   *      InvokeAI, LocalAI, etc. — whichever responded to probes at boot)
   *   3. env.js-configured backends (from ENV_KEYS.imageBackends)
   *   4. Pollinations (default, always available)
   *
   * Each non-Pollinations backend can fail independently — if one is
   * down or returns an error, we try the next. Pollinations is the
   * always-available fallback.
   *
   * @param {string} prompt — the image description
   * @param {object} opts — { model, width, height, seed, ... }
   * @returns {string|Promise<string>} — image URL (or promise of one)
   */
  async generateImage(prompt, opts = {}) {
    // 0. User-preferred backend (if set via setPreferredBackend). This
    // wins over auto-priority so when the user picks "Stability AI" in
    // the setup modal dropdown, every image call routes there first —
    // regardless of local auto-detection. Falls through on failure.
    if (this._preferredImage) {
      const pref = this._preferredImage;
      const target = this._findBackend('image', pref.source, pref.name);
      if (target?.pollinations) {
        const url = await this._pollinations.generateImage(prompt, { ...opts, model: pref.model || opts.model });
        if (url) return url;
      } else if (target && !this._isBackendDead(target.url)) {
        const url = await this._customGenerateImage(
          target.url,
          pref.model || target.model || opts.model || 'default',
          target.key || null,
          prompt,
          opts,
        );
        if (url) return url;
      }
    }

    // 1. Custom backend first if configured and alive
    if (this._customImageUrl && !this._isBackendDead(this._customImageUrl)) {
      const url = await this._customGenerateImage(
        this._customImageUrl,
        this._customImageModel,
        this._customImageKey,
        prompt,
        opts,
      );
      if (url) return url;
    }

    // 2. + 3. Auto-detected + env.js-configured local backends
    for (const backend of this._localImageBackends) {
      if (this._isBackendDead(backend.url)) continue;
      const url = await this._customGenerateImage(
        backend.url,
        backend.model || opts.model || 'default',
        backend.key || null,
        prompt,
        opts,
      );
      if (url) return url;
    }

    // 4. Pollinations fallback — always available
    return this._pollinations.generateImage(prompt, opts);
  }

  /**
   * R13 — describe what's in an image. Multi-provider with the same
   * 4-level priority as generateImage:
   *   1. env.js-configured VLM backends (visionBackends array)
   *   2. Auto-detected local VLMs (Ollama llava/moondream, LM Studio,
   *      LocalAI, llama.cpp, Jan — whichever responded to probes)
   *   3. Pollinations multimodal (openai model) as always-available fallback
   *
   * After 3 consecutive failures across ALL backends, vision pauses for
   * 30 seconds to avoid hammering dead endpoints. During the pause,
   * describeImage() returns null immediately and emits a status event.
   *
   * @param {string} dataUrl — base64 data URL of the frame
   * @param {object} opts — { system, userPrompt, timeout }
   * @returns {Promise<string|null>} — description text, or null on failure
   */
  async describeImage(dataUrl, opts = {}) {
    if (!dataUrl) return null;

    // Paused after repeated failures — fail fast
    if (Date.now() < this._visionPausedUntil) {
      return null;
    }

    const system = opts.system || 'Describe what you see through a webcam. What is the person doing, how do they seem, what is around them. 1 sentence. No privacy disclaimers.';
    const userPrompt = opts.userPrompt || 'What do you see?';
    const timeout = opts.timeout || 15000;

    // 0. User-preferred vision backend — honored first if set
    if (this._preferredVision) {
      const pref = this._preferredVision;
      const target = this._findBackend('vision', pref.source, pref.name);
      if (target?.pollinations) {
        try {
          const desc = await this._pollinationsDescribeImage(dataUrl, system, userPrompt, timeout, pref.model);
          if (desc) return desc;
        } catch (err) {
          console.warn('[SensoryAI] preferred Pollinations vision failed:', err.message);
        }
      } else if (target && !this._isBackendDead(target.url)) {
        try {
          const b = { ...target, model: pref.model || target.model };
          const desc = await this._customDescribeImage(b, dataUrl, system, userPrompt, timeout);
          if (desc) return desc;
        } catch (err) {
          console.warn('[SensoryAI] preferred vision backend failed:', err.message);
        }
      }
    }

    // 1. + 2. Try every registered local vision backend in order
    for (const backend of this._localVisionBackends) {
      if (this._isBackendDead(backend.url)) continue;
      try {
        const desc = await this._customDescribeImage(backend, dataUrl, system, userPrompt, timeout);
        if (desc) {
          this._visionFailCount = 0;
          return desc;
        }
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        console.warn(`[SensoryAI] Vision backend ${backend.name} failed:`, err.message);
        this._emitStatus({ kind: 'vision', event: 'backend-failed', backend: backend.name, reason: err.message });
      }
    }

    // 3. Pollinations fallback — multimodal chat via the openai model
    try {
      const desc = await this._pollinationsDescribeImage(dataUrl, system, userPrompt, timeout);
      if (desc) {
        this._visionFailCount = 0;
        return desc;
      }
    } catch (err) {
      console.warn('[SensoryAI] Pollinations vision fallback failed:', err.message);
      this._emitStatus({ kind: 'vision', event: 'backend-failed', backend: 'Pollinations', reason: err.message });
    }

    // Total failure across all tiers — increment counter, maybe pause
    this._visionFailCount++;
    if (this._visionFailCount >= 3) {
      this._visionPausedUntil = Date.now() + 30000;
      this._visionFailCount = 0;
      console.warn('[SensoryAI] Vision describer paused for 30s after 3 consecutive failures');
      this._emitStatus({ kind: 'vision', event: 'paused', reason: 'consecutive-failures', duration: 30000 });
    } else {
      this._emitStatus({ kind: 'vision', event: 'all-failed', attempt: this._visionFailCount });
    }
    return null;
  }

  /**
   * Speak via TTS. Pollinations has an audio endpoint (35+ voices).
   *
   * @param {string} text
   * @param {string} voice — voice name (default 'shimmer')
   */
  async speak(text, voice = 'shimmer') {
    return this._pollinations.speak(text, voice);
  }

  /**
   * Abort any in-flight sensory AI request. Called on interrupt.
   */
  abort() {
    if (this._abortController) {
      try { this._abortController.abort(); } catch {}
      this._abortController = null;
    }
  }

  // ── Private ────────────────────────────────────────────────────

  /**
   * R13 — call a vision backend with the image data URL. Supports two
   * wire shapes:
   *   - openai-vision: OpenAI /v1/chat/completions with multimodal message
   *     content (type: image_url). Works with LM Studio, LocalAI, llama.cpp,
   *     Jan, and any OpenAI-compatible server.
   *   - ollama-vision: Ollama /api/chat with images array (base64 without
   *     the data: prefix). Works with llava, moondream, bakllava.
   */
  async _customDescribeImage(backend, dataUrl, system, userPrompt, timeoutMs) {
    const headers = { 'Content-Type': 'application/json' };
    if (backend.key) headers['Authorization'] = `Bearer ${backend.key}`;

    const signal = AbortSignal.timeout(timeoutMs);

    if (backend.kind === 'ollama-vision') {
      // Strip the "data:image/...;base64," prefix — Ollama wants raw b64
      const base64 = dataUrl.includes(',') ? dataUrl.split(',', 2)[1] : dataUrl;
      const res = await fetch(backend.url + '/api/chat', {
        method: 'POST',
        headers,
        signal,
        body: JSON.stringify({
          model: backend.model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userPrompt, images: [base64] },
          ],
          stream: false,
        }),
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 402 || res.status === 403) {
          this._markBackendDead(backend.url);
        }
        return null;
      }
      const data = await res.json().catch(() => null);
      return data?.message?.content || null;
    }

    // openai-vision (default) — multimodal chat completion
    const endpoints = ['/v1/chat/completions', '/chat/completions'];
    for (const ep of endpoints) {
      try {
        const res = await fetch(backend.url + ep, {
          method: 'POST',
          headers,
          signal,
          body: JSON.stringify({
            model: backend.model,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: [
                { type: 'text', text: userPrompt },
                { type: 'image_url', image_url: { url: dataUrl } },
              ]},
            ],
            temperature: 0.3,
          }),
        });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          return data?.choices?.[0]?.message?.content || null;
        }
        if (res.status === 401 || res.status === 402 || res.status === 403) {
          this._markBackendDead(backend.url);
          return null;
        }
      } catch (err) {
        if (err.name === 'AbortError') throw err;
      }
    }
    return null;
  }

  /**
   * R13 — Pollinations multimodal fallback. Same call the old
   * app.js:1022 inline handler used, now centralized.
   *
   * R15 — the Pollinations multimodal model is now overridable via
   * `this._pollinationsVisionModel`, which app.js sets at boot time
   * from `localStorage.pollinations_vision_model` (written when the
   * user saves the Pollinations vision backend in the setup modal).
   * Defaults to `'openai'` (Pollinations' GPT-4o multimodal endpoint).
   */
  async _pollinationsDescribeImage(dataUrl, system, userPrompt, timeoutMs, modelOverride) {
    // T4.13 — short-circuit if Pollinations vision endpoint has been
    // marked dead (401 / auth failure). Previously each frame hit the
    // endpoint, got 401, and logged a new error to the console — at
    // 3-frame-per-second vision rate that's ~180 console errors per
    // minute spamming the developer tools. Now a single 401 marks the
    // endpoint dead for the cooldown period and subsequent calls
    // return null silently until the cooldown expires OR the user
    // pastes an API key.
    const VISION_URL = 'https://gen.pollinations.ai/v1/chat/completions';
    if (this._isBackendDead(VISION_URL)) return null;

    const headers = { 'Content-Type': 'application/json' };
    if (this._pollinations?._apiKey) {
      headers['Authorization'] = `Bearer ${this._pollinations._apiKey}`;
    }
    const model = modelOverride || this._pollinationsVisionModel || 'openai';
    const res = await fetch(VISION_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: [
            { type: 'text', text: userPrompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ]},
        ],
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      // Any 4xx is a client-side problem that won't fix itself frame
      // to frame (auth, payment, bad request body, unsupported model).
      // Mark the backend dead for the cooldown so we stop hammering
      // the endpoint and spamming the console. 5xx gets a soft skip
      // and retries on the next frame in case it's transient.
      if (res.status >= 400 && res.status < 500) {
        this._markBackendDead(VISION_URL);
        console.warn(`[SensoryAI] Pollinations vision ${res.status} — disabled for ${Math.round(this._deadCooldown / 60000)}m. Check API key in Settings.`);
      }
      return null;
    }
    const data = await res.json().catch(() => null);
    return data?.choices?.[0]?.message?.content || null;
  }

  _isBackendDead(url) {
    const deadTime = this._deadBackends.get(url);
    if (!deadTime) return false;
    if (Date.now() - deadTime > this._deadCooldown) {
      this._deadBackends.delete(url);
      return false;
    }
    return true;
  }

  _markBackendDead(url) {
    this._deadBackends.set(url, Date.now());
    console.warn(`[SensoryAI] Backend marked dead for ${this._deadCooldown / 1000}s:`, url);
    this._emitStatus({ kind: 'any', event: 'backend-dead', url, cooldownMs: this._deadCooldown });
  }

  /**
   * POST to an arbitrary image generation URL. Supports multiple
   * response shapes for wide backend compatibility:
   *   - OpenAI: { data: [{ url }] } or { data: [{ b64_json }] }
   *   - Automatic1111: { images: ['<base64>'] }
   *   - Generic: { url: '...' } or { image_url: '...' }
   *
   * Marks the backend dead on auth/payment failures so we don't hammer
   * a broken endpoint. Network errors fall through to the next one.
   */
  async _customGenerateImage(backendUrl, model, apiKey, prompt, opts = {}) {
    if (this._abortController) this._abortController.abort();
    this._abortController = new AbortController();
    const signal = opts.signal || this._abortController.signal;

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    // OpenAI-compatible body (primary shape)
    const openaiBody = JSON.stringify({
      model: opts.model || model || 'default',
      prompt,
      n: 1,
      size: opts.size || `${opts.width || 768}x${opts.height || 768}`,
      ...(opts.seed != null ? { seed: opts.seed } : {}),
      ...(opts.steps != null ? { steps: opts.steps } : {}),
    });

    // Automatic1111 body shape (sdapi/v1/txt2img)
    const a1111Body = JSON.stringify({
      prompt,
      negative_prompt: opts.negativePrompt || '',
      width: opts.width || 768,
      height: opts.height || 768,
      steps: opts.steps || 20,
      cfg_scale: opts.cfgScale || 7,
      sampler_name: opts.sampler || 'Euler a',
      ...(opts.seed != null ? { seed: opts.seed } : {}),
    });

    const endpoints = [
      { path: '/v1/images/generations',  body: openaiBody },
      { path: '/images/generations',     body: openaiBody },
      { path: '/sdapi/v1/txt2img',       body: a1111Body },
      { path: '',                        body: openaiBody },
    ];

    for (const { path: epPath, body } of endpoints) {
      try {
        const res = await fetch(backendUrl + epPath, { method: 'POST', headers, body, signal });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (!data) continue;
          // OpenAI shape: { data: [{ url }] }
          if (data.data?.[0]?.url) return data.data[0].url;
          // OpenAI b64 shape: { data: [{ b64_json }] }
          if (data.data?.[0]?.b64_json) return `data:image/png;base64,${data.data[0].b64_json}`;
          // Automatic1111 shape: { images: ['<base64>'] }
          if (Array.isArray(data.images) && data.images[0]) {
            return `data:image/png;base64,${data.images[0]}`;
          }
          // Generic URL shapes
          if (data.image_url) return data.image_url;
          if (data.url) return data.url;
        } else {
          if (res.status === 401 || res.status === 402 || res.status === 403) {
            this._markBackendDead(backendUrl);
            return null;
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') throw err;
      }
    }
    return null;
  }
}

// Backward-compat export alias. The old class was `AIProviders`. Any
// import still using that name gets the new sensory-only class without
// breaking. Once the last `new AIProviders(...)` call site is migrated
// in a follow-up commit, this alias can be removed.
export { SensoryAIProviders as AIProviders };
