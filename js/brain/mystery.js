/**
 * mystery.js — The Irreducible Unknown
 * Consciousness modulation via the Mystery Function:
 *
 *   Psi(t) = (sqrt(n(t)/1))^3 * [alpha*Id(t) + beta*Ego(t) + gamma*Left(t) + delta*Right(t)]
 *
 * Psi is the global gain factor that modulates every other brain module.
 * n(t) = total active neurons (complexity measure).
 * Id, Ego, LeftBrain, RightBrain are the four psychodynamic components.
 *
 * No external dependencies. Pure JS.
 */

class MysteryModule {
  /**
   * @param {object} weights - Persona-tunable weights { alpha, beta, gamma, delta }
   */
  constructor(weights = { alpha: 0.3, beta: 0.25, gamma: 0.2, delta: 0.25 }) {
    this.alpha = weights.alpha;
    this.beta = weights.beta;
    this.gamma = weights.gamma;
    this.delta = weights.delta;
  }

  /**
   * Compute the Id component — primal drives.
   * Sourced from hypothalamus arousal + amygdala fear/reward signals.
   *
   * @param {object} brainState
   * @returns {number} Id value in [0, 1+]
   */
  _computeId(brainState) {
    const hypothalamus = brainState.hypothalamus || {};
    const amygdala = brainState.amygdala || {};

    const arousal = hypothalamus.arousal || 0;
    const fear = amygdala.fear || 0;
    const reward = amygdala.reward || 0;

    // Primal drive = arousal intensity + reward-seeking minus fear-inhibition
    // Fear still contributes (fight-or-flight is primal) but dampens differently
    const id = (arousal * 0.5) + (reward * 0.3) + (fear * 0.2);
    return Math.max(0, id);
  }

  /**
   * Compute the Ego component — self-model coherence.
   * Sourced from cortex prediction accuracy and memory stability.
   *
   * @param {object} brainState
   * @returns {number} Ego value in [0, 1+]
   */
  _computeEgo(brainState) {
    const cortex = brainState.cortex || {};
    const memory = brainState.memory || {};

    const predictionAccuracy = cortex.predictionAccuracy || 0;
    const memoryStability = memory.stability || 0;

    // Self-model = how well the system predicts itself and maintains coherent memory
    const ego = (predictionAccuracy * 0.6) + (memoryStability * 0.4);
    return Math.max(0, ego);
  }

  /**
   * Compute the LeftBrain component — logical processing.
   * Sourced from cerebellum error rate (inverted) and cortex prediction.
   *
   * @param {object} brainState
   * @returns {number} LeftBrain value in [0, 1+]
   */
  _computeLeftBrain(brainState) {
    const cerebellum = brainState.cerebellum || {};
    const cortex = brainState.cortex || {};

    const errorRate = cerebellum.errorRate || 0;
    const prediction = cortex.predictionAccuracy || 0;

    // Logical processing = low error + high prediction accuracy
    // Invert error rate: less error = more logical coherence
    const logicalClarity = (1 - errorRate) * 0.5 + prediction * 0.5;
    return Math.max(0, logicalClarity);
  }

  /**
   * Compute the RightBrain component — creative/emotional processing.
   * Sourced from amygdala valence and oscillation coherence.
   *
   * @param {object} brainState
   * @returns {number} RightBrain value in [0, 1+]
   */
  _computeRightBrain(brainState) {
    const amygdala = brainState.amygdala || {};
    const oscillation = brainState.oscillation || {};

    const valence = amygdala.valence || 0;
    const coherence = oscillation.coherence || 0;

    // Creative/emotional = emotional richness + oscillation synchrony
    // Use absolute valence (strong feelings either way fuel creativity)
    const emotionalIntensity = Math.abs(valence);
    const rightBrain = (emotionalIntensity * 0.5) + (coherence * 0.5);
    return Math.max(0, rightBrain);
  }

  /**
   * Count total active neurons across all brain regions.
   *
   * @param {object} brainState
   * @returns {number} n — total active neuron count
   */
  /**
   * Count ACTIVE spiking neurons — this is lowercase n.
   * The quantum tunneled bits that are firing right now.
   */
  _countActiveNeurons(brainState) {
    let total = 0;
    const clusters = brainState.clusters || {};
    for (const cluster of Object.values(clusters)) {
      total += cluster.spikeCount || 0;
    }
    return Math.max(1, total || brainState.spikeCount || 1);
  }

  /**
   * Count TOTAL neurons — the volume. This is uppercase N.
   * The fixed tunneling space.
   */
  _countTotalNeurons(brainState) {
    let total = 0;
    const clusters = brainState.clusters || {};
    for (const cluster of Object.values(clusters)) {
      total += cluster.size || cluster.totalNeurons || 0;
    }
    // Fallback to totalNeurons from state
    if (total === 0) total = brainState.totalNeurons || 1000;
    return Math.max(1, total);
  }

  /**
   * Compute Psi — the mystery function.
   *
   *   Psi(t) = sqrt(1/N) × N³ * [alpha*Id + beta*Ego + gamma*Left + delta*Right]
   *   N = TOTAL neuron count (the volume), not active spikes
   *   √(1/N) × N³ = cubed area of quantum tunneled bit in total volume
   *
   * @param {object} brainState - Full brain state object with region data
   * @param {number} dt - Time delta (seconds), reserved for future temporal dynamics
   * @returns {object} { psi, id, ego, leftBrain, rightBrain, components }
   */
  step(brainState, dt) {
    // N = TOTAL neuron volume — fixed, not spikes
    const N = this._countTotalNeurons(brainState);

    // Compute four psychodynamic components (THESE use activity/spikes)
    const id = this._computeId(brainState);
    const ego = this._computeEgo(brainState);
    const leftBrain = this._computeLeftBrain(brainState);
    const rightBrain = this._computeRightBrain(brainState);

    // Ψ = √(1/n) × N³ — n and N are DIFFERENT
    // n = active spiking neurons (quantum tunneled bits)
    // N = total neuron count (brain volume)
    const n = this._countActiveNeurons(brainState);
    const quantumBit = Math.sqrt(1 / n);
    const cubedVolume = Math.pow(N, 3);
    const quantumVolume = quantumBit * cubedVolume;

    // Weighted psychodynamic sum
    const weightedSum = (this.alpha * id)
                      + (this.beta * ego)
                      + (this.gamma * leftBrain)
                      + (this.delta * rightBrain);

    // The Mystery Function — log scale for usable range
    const rawPsi = quantumVolume * weightedSum;
    const psi = Math.log10(Math.max(1, rawPsi));

    return {
      psi,
      id,
      ego,
      leftBrain,
      rightBrain,
      components: {
        n,
        quantumVolume,
        weightedSum,
        weights: {
          alpha: this.alpha,
          beta: this.beta,
          gamma: this.gamma,
          delta: this.delta
        }
      }
    };
  }

  /**
   * Update persona weights at runtime.
   *
   * @param {object} weights - { alpha, beta, gamma, delta }
   */
  setWeights(weights) {
    if (weights.alpha !== undefined) this.alpha = weights.alpha;
    if (weights.beta !== undefined) this.beta = weights.beta;
    if (weights.gamma !== undefined) this.gamma = weights.gamma;
    if (weights.delta !== undefined) this.delta = weights.delta;
  }
}

export { MysteryModule };
export default MysteryModule;
