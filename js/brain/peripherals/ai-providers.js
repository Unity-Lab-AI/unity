/**
 * ai-providers.js — AI Provider Manager (Brain Peripheral)
 *
 * The brain calls this when it needs language generation (Broca's area),
 * image generation (visual output), or speech (TTS).
 *
 * This is dumb muscle — it doesn't decide anything.
 * It just sends requests and returns results.
 */

export class AIProviders {
  constructor({ pollinations, storage }) {
    this._pollinations = pollinations;
    this._storage = storage;
    this._customUrl = null;
    this._customModel = null;
    this._activeKey = null;
    this._abortController = null;
    this._deadBackends = new Map(); // url → timestamp when marked dead
    this._deadCooldown = 60000; // 60 seconds before retrying dead backend
  }

  configure(url, model, apiKey) {
    this._customUrl = url;
    this._customModel = model;
    this._activeKey = apiKey;
  }

  /**
   * Chat completion — tries custom backend first, falls back to Pollinations.
   */
  async chat(messages, options = {}) {
    if (this._abortController) this._abortController.abort();
    this._abortController = new AbortController();
    const signal = options.signal || this._abortController.signal;
    const temp = options.temperature ?? 0.9;

    // Try custom backend (if configured and not dead)
    if (this._customUrl && !this._isBackendDead(this._customUrl)) {
      const result = await this._customChat(messages, this._customModel || 'default', temp, signal);
      if (result) return result;
    }

    // Pollinations fallback
    const trimmed = messages.map(m => {
      if (m.role === 'system' && m.content.length > 12000) {
        return { ...m, content: m.content.slice(0, 12000) + '\n[...truncated...]' };
      }
      return m;
    });

    try {
      return await this._pollinations.chat(trimmed, { model: 'openai', temperature: temp });
    } catch {
      return null;
    }
  }

  abort() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
  }

  async generateImage(prompt, opts = {}) {
    return this._pollinations.generateImage(prompt, opts);
  }

  async speak(text, voice = 'shimmer') {
    return this._pollinations.speak(text, voice);
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
    console.warn(`[AIProviders] Backend marked dead for ${this._deadCooldown / 1000}s:`, url);
  }

  async _customChat(messages, model, temperature, signal) {
    const headers = { 'Content-Type': 'application/json' };
    if (this._activeKey) headers['Authorization'] = `Bearer ${this._activeKey}`;
    const body = JSON.stringify({ model, messages, temperature });

    const endpoints = [
      `${this._customUrl}/v1/chat/completions`,
      `${this._customUrl}/chat/completions`,
    ];

    let failCount = 0;
    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST', headers, body, signal,
        });
        if (res.ok) {
          const data = await res.json();
          if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
          if (data.message?.content) return data.message.content;
        } else {
          failCount++;
          const errText = await res.text().catch(() => '');
          // Detect credit/auth failures — mark backend dead
          if (res.status === 400 && errText.includes('credit balance')) {
            this._markBackendDead(this._customUrl);
            return null;
          }
          if (res.status === 401 || res.status === 403) {
            this._markBackendDead(this._customUrl);
            return null;
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        failCount++;
      }
    }

    if (failCount >= endpoints.length) {
      this._markBackendDead(this._customUrl);
    }
    return null;
  }
}
