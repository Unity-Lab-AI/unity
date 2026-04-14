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
  { name: 'Ollama (SD)',    url: 'http://localhost:11434', probe: '/api/tags',                 kind: 'openai' },
];

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

    this._abortController = null;
    this._deadBackends = new Map(); // url → timestamp when marked dead
    this._deadCooldown = 3600000;   // 1 hour — if a backend is dead, leave it
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
    return this._localImageBackends;
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
    const backends = Array.isArray(envKeys.imageBackends) ? envKeys.imageBackends : [];
    for (const b of backends) {
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
    if (backends.length > 0) {
      console.log(`[SensoryAI] Loaded ${backends.length} image backend(s) from env.js`);
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
    console.warn(`[SensoryAI] Image backend marked dead for ${this._deadCooldown / 1000}s:`, url);
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
