/**
 * ocli-brocas.js — Broca's Area adapter for OCLI/Claude Code CLI
 *
 * Wraps OcliBridge to match the Broca's area interface expected by
 * the brain engine: generate(state, text) → Promise<string>
 *
 * Usage in app.js:
 *   import { OcliBrocas } from './ai/ocli-brocas.js';
 *   const brocas = new OcliBrocas('127.0.0.1', 9889);
 *   if (await brocas.connect()) brain.connectLanguage(brocas);
 */

import { OcliBridge } from './ocli-bridge.js';

export class OcliBrocas {

  constructor(host = '127.0.0.1', port = 9889) {
    this._bridge = new OcliBridge(host, port);
    this._aborted = false;
  }

  async connect() {
    return this._bridge.connect();
  }

  isConnected() {
    return this._bridge.isConnected();
  }

  getName() {
    return this._bridge.getName();
  }

  /**
   * Generate a response — called by the brain engine when
   * the response pool and inner voice can't produce enough text.
   *
   * @param {object} state - full brain state
   * @param {string} text - user input
   * @returns {Promise<string|null>}
   */
  async generate(state, text) {
    if (this._aborted) return null;

    // Send to the local OCLI instance
    const response = await this._bridge.chat(text, {
      arousal: state.amygdala?.arousal,
      valence: state.amygdala?.valence,
      coherence: state.oscillations?.coherence,
      predictionError: state.cortex?.predictionError,
    });

    if (this._aborted) return null;
    return response;
  }

  abort() {
    this._aborted = true;
    // Reset after a tick so next call works
    setTimeout(() => { this._aborted = false; }, 100);
  }
}
