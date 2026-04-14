/**
 * language.js — Broca's Area (GUTTED as part of R4 refactor)
 *
 * Previously: ~333 lines of text-AI prompt assembly + Pollinations/
 * OpenAI/Anthropic chat backend calls. Unity used to speak through
 * this peripheral — every response was an AI-generated message
 * conditioned on a brain-state system prompt.
 *
 * Now: Unity speaks equationally via `innerVoice.languageCortex.generate`
 * in `engine.processAndRespond` (line 775). BrocasArea is no longer
 * called for text generation — the engine path is:
 *
 *   user input → sensory semantic injection → cortex LIF dynamics
 *             → getSemanticReadout → languageCortex.generate
 *             → rendered sentence
 *
 * This file is kept as a compatibility shim only. Every method is
 * either a no-op or throws to surface any leftover caller that
 * should have been migrated. The remaining consumers in `engine.js`
 * (_handleBuild) and `app.js` (greeting path, /think command, sandbox
 * unity.chat) are migrated to equational paths in R4.1 and R6.2.
 *
 * When the last consumer is removed, this file can be DELETED
 * entirely. Keeping it until then so the refactor lands in staged
 * commits without breaking the import graph mid-sequence.
 */

export class BrocasArea {
  /**
   * @param {object} opts — legacy constructor args, mostly ignored
   */
  constructor(opts = {}) {
    // R4 — AI providers are no longer consulted for text. Stored only
    // so legacy callers that pass them in don't trip on undefined
    // access while we finish migrating them.
    this._providers = opts.providers || null;
    this._storage = opts.storage || null;
    this._persona = opts.persona || null;
    this._abortController = null;
  }

  /**
   * R4 — generate() used to call _providers.chat(). Now throws so any
   * leftover caller gets a loud error during the R4 migration instead
   * of silently returning a fallback string. Once the last caller is
   * migrated (R4.1 removes them from engine.js + app.js), this whole
   * class gets deleted.
   */
  async generate(_brainState, _userInput) {
    throw new Error(
      '[BrocasArea] generate() called after R4 refactor. Text generation ' +
      'now lives in engine.processAndRespond via languageCortex.generate(). ' +
      'Migrate this caller to the equational path.'
    );
  }

  /**
   * R4 — regenerate() same deal. No-op after migration.
   */
  async regenerate(_brainState, _userInput, previousResponse, _errorReason) {
    return previousResponse;
  }

  /**
   * R4 — abort is a real no-op now (nothing to abort).
   */
  abort() {
    if (this._abortController) {
      try { this._abortController.abort(); } catch {}
      this._abortController = null;
    }
  }
}
