/**
 * memory.js — Hippocampal Memory System
 *
 * Three memory types:
 *   1. Episodic memory — snapshots of brain state at meaningful moments
 *   2. Working memory — prefrontal cortex sustained activation (~7 items)
 *   3. Consolidation — repeated hippocampal patterns strengthen cortex synapses
 *
 * Recall mechanism:
 *   When cortex prediction error is high (surprising input), hippocampus
 *   searches stored episodes for similar patterns. Match triggers recall
 *   by re-injecting stored state as current into clusters.
 */

const MAX_EPISODES = 100;      // max stored episodic memories
const WORKING_MEMORY_SIZE = 7; // Miller's magic number
const WM_DECAY_RATE = 0.98;    // working memory decays without reinforcement
const CONSOLIDATION_THRESHOLD = 3; // activations before consolidating to long-term
const SIMILARITY_THRESHOLD = 0.6;  // cosine similarity for recall trigger

export class MemorySystem {
  constructor(hippoCluster) {
    this._hippoCluster = hippoCluster;

    // Episodic memory — snapshots of meaningful moments
    this._episodes = [];

    // Working memory — sustained representations (limited capacity)
    this._workingMemory = []; // { pattern: Float64Array, strength: number, label: string }

    // Consolidation tracking — how many times each episode was activated
    this._activationCounts = new Map(); // episode index → count

    // State
    this.lastRecall = null;
    this.lastRecallSimilarity = 0;
    this.workingMemoryLoad = 0;
  }

  /**
   * Store an episodic memory — snapshot of brain state at a meaningful moment.
   * Called when salience is high (emotional event, user input, reward spike).
   *
   * @param {object} snapshot — { clusterStates, amygdala, psi, time, trigger }
   */
  storeEpisode(snapshot) {
    // Create a compact state vector from cluster firing rates
    const pattern = this._extractPattern(snapshot);

    this._episodes.push({
      pattern,
      timestamp: snapshot.time || performance.now(),
      trigger: snapshot.trigger || 'unknown',
      arousal: snapshot.amygdala?.arousal ?? 0,
      valence: snapshot.amygdala?.valence ?? 0,
      psi: snapshot.psi ?? 0,
    });

    // Trim oldest if over capacity
    if (this._episodes.length > MAX_EPISODES) {
      // Remove least activated episodes (not just oldest)
      let minAct = Infinity, minIdx = 0;
      for (let i = 0; i < this._episodes.length; i++) {
        const act = this._activationCounts.get(i) || 0;
        if (act < minAct) { minAct = act; minIdx = i; }
      }
      this._episodes.splice(minIdx, 1);
    }
  }

  /**
   * Try to recall a similar episode based on current state.
   * Triggered when cortex prediction error is high.
   *
   * @param {object} currentSnapshot — current brain state
   * @returns {{ episode, similarity, currents }|null} — recalled episode or null
   */
  recall(currentSnapshot) {
    if (this._episodes.length === 0) return null;

    const currentPattern = this._extractPattern(currentSnapshot);

    // Find most similar episode
    let bestSim = 0, bestIdx = -1;
    for (let i = 0; i < this._episodes.length; i++) {
      const sim = this._cosineSimilarity(currentPattern, this._episodes[i].pattern);
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = i;
      }
    }

    if (bestSim < SIMILARITY_THRESHOLD || bestIdx < 0) return null;

    const episode = this._episodes[bestIdx];
    this.lastRecall = episode;
    this.lastRecallSimilarity = bestSim;

    // Track activation for consolidation
    const count = (this._activationCounts.get(bestIdx) || 0) + 1;
    this._activationCounts.set(bestIdx, count);

    // Generate recall currents — re-inject the stored pattern as neural current
    // This literally re-activates the past experience
    const currents = new Float64Array(this._hippoCluster?.size || 200);
    for (let i = 0; i < currents.length && i < episode.pattern.length; i++) {
      currents[i] = episode.pattern[i] * 8; // strong re-activation
    }

    return { episode, similarity: bestSim, currents };
  }

  /**
   * Update working memory. Maintains up to 7 active representations.
   * Called each brain step.
   *
   * @param {Float64Array} cortexOutput — current cortex cluster output
   */
  updateWorkingMemory(cortexOutput) {
    // Decay existing items
    for (let i = this._workingMemory.length - 1; i >= 0; i--) {
      this._workingMemory[i].strength *= WM_DECAY_RATE;
      if (this._workingMemory[i].strength < 0.1) {
        this._workingMemory.splice(i, 1); // forgotten
      }
    }

    this.workingMemoryLoad = this._workingMemory.length / WORKING_MEMORY_SIZE;
  }

  /**
   * Add an item to working memory (e.g., from text input or recall).
   */
  addToWorkingMemory(pattern, label = '') {
    // Check if similar item already exists — refresh instead of adding
    for (const wm of this._workingMemory) {
      if (this._cosineSimilarity(pattern, wm.pattern) > 0.8) {
        wm.strength = 1.0; // refresh
        return;
      }
    }

    // At capacity — evict weakest
    if (this._workingMemory.length >= WORKING_MEMORY_SIZE) {
      let minStr = Infinity, minIdx = 0;
      for (let i = 0; i < this._workingMemory.length; i++) {
        if (this._workingMemory[i].strength < minStr) {
          minStr = this._workingMemory[i].strength;
          minIdx = i;
        }
      }
      this._workingMemory.splice(minIdx, 1);
    }

    this._workingMemory.push({
      pattern: Float64Array.from(pattern),
      strength: 1.0,
      label,
    });
  }

  /**
   * Check if any episodes should be consolidated to long-term.
   * Consolidated memories get stronger cortex representation.
   *
   * @returns {Array} — list of consolidated episode patterns
   */
  checkConsolidation() {
    const consolidated = [];
    for (const [idx, count] of this._activationCounts.entries()) {
      if (count >= CONSOLIDATION_THRESHOLD) {
        if (idx < this._episodes.length) {
          consolidated.push(this._episodes[idx].pattern);
        }
        // Don't remove — just note it's been consolidated
      }
    }
    return consolidated;
  }

  // ── Helpers ────────────────────────────────────────────────────

  _extractPattern(snapshot) {
    // Build a fixed-length pattern from cluster firing rates
    const clusters = snapshot.clusters || snapshot.clusterStates || {};
    const vec = new Float64Array(14); // 2 features per cluster
    let i = 0;
    for (const name of ['cortex', 'hippocampus', 'amygdala', 'basalGanglia', 'cerebellum', 'hypothalamus', 'mystery']) {
      const c = clusters[name];
      vec[i++] = (c?.spikeCount ?? 0) / (c?.size ?? 100);
      vec[i++] = c?.firingRate ?? 0;
    }
    return vec;
  }

  _cosineSimilarity(a, b) {
    const len = Math.min(a.length, b.length);
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dot / denom : 0;
  }

  getState() {
    return {
      episodeCount: this._episodes.length,
      workingMemoryLoad: this.workingMemoryLoad,
      workingMemoryItems: this._workingMemory.map(wm => ({ label: wm.label, strength: wm.strength })),
      lastRecall: this.lastRecall ? {
        trigger: this.lastRecall.trigger,
        similarity: this.lastRecallSimilarity,
        arousal: this.lastRecall.arousal,
      } : null,
    };
  }
}
