/**
 * motor.js — Motor Output Pipeline
 *
 * Reads basal ganglia spike patterns and maps them to actions.
 * The BG cluster has 150 neurons organized into 6 action channels
 * (25 neurons each). The channel with the highest firing rate wins.
 *
 * Action channels (BG neurons 0-149):
 *   0-24:   RESPOND_TEXT — generate language response
 *   25-49:  GENERATE_IMAGE — create visual output
 *   50-74:  SPEAK — vocalize (TTS)
 *   75-99:  BUILD_UI — create interface element
 *   100-124: LISTEN — stay quiet, pay attention
 *   125-149: IDLE — internal processing, no output
 *
 * Speech gating:
 *   The motor system checks hypothalamus social_need + amygdala arousal
 *   to decide IF the action should actually execute. High social_need
 *   = more likely to vocalize. Low arousal = more likely to stay quiet.
 *
 * No external dependencies. Pure neural readout.
 */

const BG_SIZE = 150;
const CHANNELS = 6;
const NEURONS_PER_CHANNEL = 25;

const ACTION_NAMES = [
  'respond_text',
  'generate_image',
  'speak',
  'build_ui',
  'listen',
  'idle',
];

// Minimum firing rate to trigger an action (prevents random noise from acting)
const CONFIDENCE_THRESHOLD = 0.15;

// Cooldown between actions (brain steps) — prevents rapid-fire outputs
const ACTION_COOLDOWN = 50;

export class MotorOutput {
  constructor() {
    this.selectedAction = 'idle';
    this.confidence = 0;
    this.channelRates = new Float64Array(CHANNELS);
    this._cooldown = 0;
    this._lastAction = 'idle';

    // Callbacks for each action type — set by the brain
    this._handlers = {};

    // Speech gate state
    this.speechGated = false; // true = suppress vocalization
    this.gateReason = '';
  }

  /**
   * Register a handler for an action type.
   * @param {string} action — one of ACTION_NAMES
   * @param {Function} handler — async (brainState) => result
   */
  onAction(action, handler) {
    this._handlers[action] = handler;
  }

  /**
   * Read BG cluster spikes and determine the winning action.
   * Called each brain step.
   *
   * @param {Uint8Array} bgSpikes — spike array from BG cluster (150 neurons)
   * @param {object} brainState — current brain state for gating decisions
   * @returns {{ action: string, confidence: number, shouldExecute: boolean }}
   */
  readOutput(bgSpikes, brainState) {
    // Count firing rate per action channel
    for (let ch = 0; ch < CHANNELS; ch++) {
      let count = 0;
      const start = ch * NEURONS_PER_CHANNEL;
      for (let n = 0; n < NEURONS_PER_CHANNEL; n++) {
        if (bgSpikes[start + n]) count++;
      }
      // Exponential moving average of channel rate
      const rate = count / NEURONS_PER_CHANNEL;
      this.channelRates[ch] = this.channelRates[ch] * 0.7 + rate * 0.3;
    }

    // Find winning channel
    let maxRate = 0;
    let maxCh = 5; // default to idle
    for (let ch = 0; ch < CHANNELS; ch++) {
      if (this.channelRates[ch] > maxRate) {
        maxRate = this.channelRates[ch];
        maxCh = ch;
      }
    }

    this.selectedAction = ACTION_NAMES[maxCh];
    this.confidence = maxRate;

    // Cooldown check
    if (this._cooldown > 0) {
      this._cooldown--;
      return { action: this.selectedAction, confidence: this.confidence, shouldExecute: false };
    }

    // Confidence threshold — don't act on noise
    if (maxRate < CONFIDENCE_THRESHOLD) {
      return { action: 'idle', confidence: maxRate, shouldExecute: false };
    }

    // Speech gating — check if vocalization should be suppressed
    this.speechGated = false;
    this.gateReason = '';
    if (this.selectedAction === 'respond_text' || this.selectedAction === 'speak') {
      const arousal = brainState.amygdala?.arousal ?? 0.5;
      const socialNeed = brainState.hypothalamus?.drives?.social_need ?? 0.5;

      // Low arousal + low social need = don't bother speaking
      if (arousal < 0.3 && socialNeed < 0.3) {
        this.speechGated = true;
        this.gateReason = 'low arousal + low social need';
      }
    }

    // Determine if this is a new action worth executing
    const isNewAction = this.selectedAction !== this._lastAction;
    const shouldExecute = isNewAction || this.selectedAction === 'respond_text';

    if (shouldExecute) {
      this._lastAction = this.selectedAction;
      this._cooldown = ACTION_COOLDOWN;
    }

    return {
      action: this.selectedAction,
      confidence: this.confidence,
      shouldExecute,
      gated: this.speechGated,
      gateReason: this.gateReason,
    };
  }

  /**
   * Execute the selected action by calling its registered handler.
   * Only called when shouldExecute is true.
   */
  async execute(action, brainState) {
    const handler = this._handlers[action];
    if (!handler) return null;

    try {
      return await handler(brainState);
    } catch (err) {
      console.warn(`[Motor] Action "${action}" failed:`, err.message);
      return null;
    }
  }

  /**
   * Inject reward into BG cluster to reinforce the current action.
   * @param {NeuronCluster} bgCluster — the basal ganglia cluster
   * @param {number} reward — positive = reinforce, negative = suppress
   */
  reinforceAction(bgCluster, reward) {
    if (!bgCluster) return;
    const ch = ACTION_NAMES.indexOf(this.selectedAction);
    if (ch < 0) return;

    const start = ch * NEURONS_PER_CHANNEL;
    const current = new Float64Array(BG_SIZE);
    for (let n = 0; n < NEURONS_PER_CHANNEL; n++) {
      current[start + n] = reward * 5; // strong reward signal
    }
    bgCluster.injectCurrent(current);
  }

  getState() {
    return {
      selectedAction: this.selectedAction,
      confidence: this.confidence,
      channelRates: Array.from(this.channelRates),
      speechGated: this.speechGated,
      gateReason: this.gateReason,
      cooldown: this._cooldown,
    };
  }
}
