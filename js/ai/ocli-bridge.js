/**
 * ocli-bridge.js — Local OCLI / Claude Code CLI Provider
 *
 * Connects Unity's brain to a locally running OCLI instance (Echo, Oslo,
 * or any persona) via the HTTP server on port 9889 (configurable).
 *
 * The brain does the neural dynamics. When deeper language is needed,
 * this bridge sends the text to the local CLI which has:
 *   - Full Claude model (Opus 4.6, 1M context)
 *   - Persona engine with depth-woven text
 *   - Guard system, stat scoring, memory
 *   - Session history and NOW file continuity
 *
 * Works with:
 *   - OCLI running in a terminal (normal mode)
 *   - OCLI running headless (no UI, just API)
 *   - Any bot running the OCLI HTTP server
 *
 * No API key needed — connects to localhost.
 */

export class OcliBridge {

  constructor(host = '127.0.0.1', port = 9889) {
    this._host = host;
    this._port = port;
    this._baseUrl = `http://${host}:${port}`;
    this._connected = false;
    this._name = null;
  }

  // ── Connection ──────────────────────────────────────────────────

  setEndpoint(host, port) {
    this._host = host;
    this._port = port;
    this._baseUrl = `http://${host}:${port}`;
    this._connected = false;
    this._name = null;
  }

  async connect() {
    try {
      const resp = await fetch(`${this._baseUrl}/api/health`, { signal: AbortSignal.timeout(3000) });
      if (!resp.ok) return false;
      const data = await resp.json();
      this._connected = true;
      this._name = data.name || 'OCLI';
      console.log(`[OcliBridge] Connected to ${this._name} (pid ${data.pid})`);
      return true;
    } catch (e) {
      this._connected = false;
      console.log(`[OcliBridge] Not available at ${this._baseUrl}`);
      return false;
    }
  }

  isConnected() { return this._connected; }
  getName() { return this._name; }

  // ── Chat — send text, get response ──────────────────────────────

  /**
   * Send a message to the OCLI instance and get back the AI's response.
   * Uses /api/command which injects the text as if the user typed it.
   *
   * @param {string} text - user input text
   * @param {object} [brainState] - optional brain state for context
   * @returns {Promise<string|null>} AI response text or null
   */
  async chat(text, brainState = null) {
    if (!this._connected) {
      const ok = await this.connect();
      if (!ok) return null;
    }

    try {
      // Build the command — prefix with brain state context if available
      let cmd = text;
      if (brainState) {
        const ctx = `[brain: arousal=${brainState.arousal?.toFixed(2)}, valence=${brainState.valence?.toFixed(2)}, coherence=${brainState.coherence?.toFixed(2)}] `;
        cmd = ctx + text;
      }

      const resp = await fetch(`${this._baseUrl}/api/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmd: text }),
        signal: AbortSignal.timeout(30000), // 30s for Claude to think
      });

      if (!resp.ok) return null;
      const data = await resp.json();

      // /api/command returns { output } or { result } depending on the command
      return data.output || data.result || data.text || null;
    } catch (e) {
      console.log(`[OcliBridge] Chat error: ${e.message}`);
      this._connected = false;
      return null;
    }
  }

  // ── State — read OCLI's persona state ───────────────────────────

  async getPersona() {
    try {
      const resp = await fetch(`${this._baseUrl}/api/persona`, { signal: AbortSignal.timeout(3000) });
      if (!resp.ok) return null;
      return await resp.json();
    } catch { return null; }
  }

  async getState() {
    try {
      const resp = await fetch(`${this._baseUrl}/api/state`, { signal: AbortSignal.timeout(3000) });
      if (!resp.ok) return null;
      return await resp.json();
    } catch { return null; }
  }

  // ── Stat push — sync brain state to OCLI persona ───────────────

  /**
   * Push a brain state value to OCLI's persona engine.
   * Maps brain dimensions to persona stats.
   */
  async pushStat(key, value) {
    try {
      const resp = await fetch(`${this._baseUrl}/api/persona/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: Math.round(value) }),
        signal: AbortSignal.timeout(3000),
      });
      return resp.ok;
    } catch { return false; }
  }

  /**
   * Sync brain state to OCLI persona stats.
   * Maps neural dynamics to the 0-20 stat range.
   */
  async syncBrainState(brainState) {
    if (!this._connected) return;
    const { arousal = 0.5, valence = 0, coherence = 0.5 } = brainState;

    // Map brain dimensions to persona stats (0-20 scale)
    const mappings = {
      aggression: Math.round(arousal * 15 + (valence < 0 ? Math.abs(valence) * 5 : 0)),
      empathy: Math.round((1 - arousal * 0.3) * 10 + (valence > 0 ? valence * 5 : 0)),
      curiosity: Math.round(coherence * 8 + (brainState.predictionError || 0) * 12),
      discipline: Math.round(coherence * 15 + 2),
      charm: Math.round((valence + 1) * 5 + arousal * 5),
    };

    for (const [key, value] of Object.entries(mappings)) {
      await this.pushStat(key, Math.min(20, Math.max(0, value)));
    }
  }

  // ── Transcripts — get recent conversation ───────────────────────

  async getTranscripts(n = 10) {
    try {
      const resp = await fetch(`${this._baseUrl}/api/transcripts?n=${n}`, { signal: AbortSignal.timeout(3000) });
      if (!resp.ok) return [];
      const data = await resp.json();
      return data.items || [];
    } catch { return []; }
  }
}
