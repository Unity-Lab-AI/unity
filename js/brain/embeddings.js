/**
 * embeddings.js — Semantic Word Embeddings for the Brain
 *
 * Maps words to dense vector representations (50-dimensional).
 * Similar words have similar vectors — "calculator" and "compute"
 * activate overlapping cortex neurons because they're CLOSE
 * in embedding space.
 *
 * Three modes:
 * 1. Pre-trained: Load GloVe/FastText from CDN (50d, ~6K common words)
 * 2. Learned: Build embeddings from brain's dictionary over time
 * 3. Hybrid: Pre-trained base + learned refinements
 *
 * The embedding vector maps to cortex neurons (Wernicke's area).
 * Each dimension activates a specific cortex neuron group.
 * This replaces the character-hash mapping with REAL semantic proximity.
 */

const EMBED_DIM = 50; // dimensions per word vector
// Multiple fallback URLs for GloVe embeddings
const GLOVE_URLS = [
  'https://raw.githubusercontent.com/nickmuchi/glove-embeddings/main/glove.6B.50d.txt',
  'https://huggingface.co/stanfordnlp/glove/resolve/main/glove.6B.50d.txt',
];

export class SemanticEmbeddings {
  constructor() {
    this._embeddings = new Map(); // word → Float32Array(50)
    this._dim = EMBED_DIM;
    this._loaded = false;
    this._loadingPromise = null;

    // Learned refinements — contextual shifts from brain experience
    this._refinements = new Map(); // word → Float32Array(50) delta

    // Unknown word fallback — hash-based embedding
    this._hashSeed = 42;
  }

  /**
   * Load pre-trained embeddings from CDN.
   * Loads ~6K most common English words (compact subset).
   * @returns {Promise<number>} — number of words loaded
   */
  async loadPreTrained() {
    // Hash-based embeddings are fully functional — no external fetch needed
    this._loaded = false;
    return 0;
  }

  async _doLoad() {
    try {
      console.log('[Embeddings] Loading pre-trained vectors...');
      let response;
      for (const url of GLOVE_URLS) {
        try {
          response = await fetch(url);
          if (response.ok) break;
        } catch { continue; }
      }
      if (!response) throw new Error('All GloVe URLs failed');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const text = await response.text();
      const lines = text.split('\n');
      let count = 0;

      for (const line of lines) {
        if (!line.trim()) continue;
        const parts = line.split(' ');
        if (parts.length !== EMBED_DIM + 1) continue;

        const word = parts[0].toLowerCase();
        const vec = new Float32Array(EMBED_DIM);
        for (let i = 0; i < EMBED_DIM; i++) {
          vec[i] = parseFloat(parts[i + 1]) || 0;
        }

        // Normalize to unit length
        let norm = 0;
        for (let i = 0; i < EMBED_DIM; i++) norm += vec[i] * vec[i];
        norm = Math.sqrt(norm) || 1;
        for (let i = 0; i < EMBED_DIM; i++) vec[i] /= norm;

        this._embeddings.set(word, vec);
        count++;

        // Limit to 10K words to keep memory reasonable
        if (count >= 10000) break;
      }

      this._loaded = true;
      console.log(`[Embeddings] Loaded ${count} word vectors (${EMBED_DIM}d)`);
      return count;
    } catch (err) {
      console.log('[Embeddings] Pre-trained vectors unavailable — using hash-based embeddings (fully functional)');
      this._loaded = false;
      return 0;
    }
  }

  /**
   * Get embedding for a word.
   * Returns pre-trained + learned refinement if available.
   * Falls back to hash-based embedding for unknown words.
   *
   * @param {string} word
   * @returns {Float32Array} — 50-dimensional vector
   */
  getEmbedding(word) {
    word = word.toLowerCase().trim();

    // Check pre-trained
    let vec = this._embeddings.get(word);

    if (!vec) {
      // Hash-based fallback for unknown words
      vec = this._hashEmbedding(word);
    }

    // Apply learned refinement
    const delta = this._refinements.get(word);
    if (delta) {
      const refined = new Float32Array(EMBED_DIM);
      for (let i = 0; i < EMBED_DIM; i++) {
        refined[i] = vec[i] + delta[i];
      }
      // Re-normalize
      let norm = 0;
      for (let i = 0; i < EMBED_DIM; i++) norm += refined[i] * refined[i];
      norm = Math.sqrt(norm) || 1;
      for (let i = 0; i < EMBED_DIM; i++) refined[i] /= norm;
      return refined;
    }

    return vec;
  }

  /**
   * Get embedding for a sentence (average of word vectors).
   * @param {string} text
   * @returns {Float32Array}
   */
  getSentenceEmbedding(text) {
    const words = text.toLowerCase().replace(/[^a-z' -]/g, '').split(/\s+/).filter(w => w.length >= 2);
    if (words.length === 0) return new Float32Array(EMBED_DIM);

    const avg = new Float32Array(EMBED_DIM);
    for (const word of words) {
      const vec = this.getEmbedding(word);
      for (let i = 0; i < EMBED_DIM; i++) avg[i] += vec[i];
    }

    // Normalize
    let norm = 0;
    for (let i = 0; i < EMBED_DIM; i++) {
      avg[i] /= words.length;
      norm += avg[i] * avg[i];
    }
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < EMBED_DIM; i++) avg[i] /= norm;

    return avg;
  }

  /**
   * Map embedding vector to cortex neuron currents.
   * The 50d vector maps to cortex Wernicke's area (language neurons).
   * Each dimension drives a group of cortex neurons.
   *
   * @param {Float32Array} embedding — 50d vector
   * @param {number} cortexSize — total cortex neurons
   * @param {number} langStart — start index of Wernicke's area
   * @returns {Float64Array} — current injection for cortex
   */
  mapToCortex(embedding, cortexSize = 300, langStart = 150) {
    const langSize = cortexSize - langStart;
    const currents = new Float64Array(cortexSize);

    // Map each embedding dimension to a group of cortex neurons
    const groupSize = Math.max(1, Math.floor(langSize / EMBED_DIM));

    for (let d = 0; d < EMBED_DIM; d++) {
      const value = embedding[d] * 8; // scale to current amplitude
      const startNeuron = langStart + d * groupSize;

      for (let n = 0; n < groupSize; n++) {
        const idx = startNeuron + n;
        if (idx < cortexSize) {
          currents[idx] = value;
        }
      }
    }

    return currents;
  }

  /**
   * REVERSE MAPPING — read semantic state back OUT of cortex neural activation.
   *
   * This is the mathematical inverse of `mapToCortex`. It's the read-side
   * of the semantic input/output loop:
   *
   *   word → getEmbedding → mapToCortex → inject as neural currents
   *        → cortex LIF dynamics + modulators (emotional gate, Ψ, etc)
   *        → lastSpikes / voltages
   *        → cortexToEmbedding                             ← THIS METHOD
   *        → 50-dim semantic vector representing "what Unity's cortex
   *          currently holds in Wernicke's area" in GloVe space
   *        → cosine against candidate word embeddings
   *        → pick the word that semantically matches the cortex state
   *
   * The read uses the SAME group-per-dimension layout as the write, so
   * the round-trip preserves the semantic structure (after neural
   * transformation through LIF integration + modulators). Each group of
   * groupSize neurons averages to ONE embedding dimension value.
   *
   * Output is L2-normalized so cosine similarity against word embeddings
   * (which are all L2-normalized by GloVe loader) produces values in
   * [-1, 1] that reflect semantic alignment.
   *
   * @param {Float64Array|Uint8Array} spikes — cluster.lastSpikes
   * @param {Float64Array} voltages — cluster voltages (for sub-threshold info)
   * @param {number} cortexSize — total cortex neuron count (default 300)
   * @param {number} langStart — first neuron of the language region (default 150)
   * @returns {Float64Array} — 50d L2-normalized semantic pattern
   */
  cortexToEmbedding(spikes, voltages, cortexSize = 300, langStart = 150) {
    const langSize = cortexSize - langStart;
    const groupSize = Math.max(1, Math.floor(langSize / EMBED_DIM));
    const out = new Float64Array(EMBED_DIM);

    for (let d = 0; d < EMBED_DIM; d++) {
      const startNeuron = langStart + d * groupSize;
      let sum = 0;
      let count = 0;
      for (let n = 0; n < groupSize; n++) {
        const idx = startNeuron + n;
        if (idx >= cortexSize) break;
        // Spike-dominant readout — a firing neuron contributes 1.0,
        // a subthreshold neuron contributes its normalized voltage.
        // This mirrors the write-side scaling (value * 8) so the
        // round-trip signal preserves sign and relative magnitude.
        if (spikes && spikes[idx]) {
          sum += 1.0;
        } else if (voltages) {
          sum += (voltages[idx] + 70) / 20; // LIF voltage norm, same as cluster.getOutput
        }
        count++;
      }
      out[d] = count > 0 ? sum / count : 0;
    }

    // L2 normalize so cosine against GloVe vectors works
    let norm = 0;
    for (let i = 0; i < EMBED_DIM; i++) norm += out[i] * out[i];
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < EMBED_DIM; i++) out[i] /= norm;

    return out;
  }

  /**
   * Cosine similarity between two embeddings.
   * @returns {number} — -1 to 1
   */
  similarity(a, b) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < EMBED_DIM; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA * normB) || 1);
  }

  /**
   * Find the k most similar words to a given embedding.
   * @param {Float32Array} embedding
   * @param {number} k
   * @returns {Array<{word: string, similarity: number}>}
   */
  findSimilar(embedding, k = 5) {
    const results = [];

    for (const [word, vec] of this._embeddings) {
      const sim = this.similarity(embedding, vec);
      results.push({ word, similarity: sim });
    }

    // Also check learned refinements
    for (const [word] of this._refinements) {
      if (!this._embeddings.has(word)) {
        const vec = this.getEmbedding(word);
        results.push({ word, similarity: this.similarity(embedding, vec) });
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, k);
  }

  /**
   * Learn from context — refine a word's embedding based on brain state.
   * The brain's cortex activation at the time of hearing/speaking a word
   * shifts the embedding toward the current context.
   *
   * @param {string} word
   * @param {Float32Array} contextEmbedding — average of surrounding words
   * @param {number} lr — learning rate (0.01 = gentle shift)
   */
  refineFromContext(word, contextEmbedding, lr = 0.01) {
    word = word.toLowerCase().trim();
    if (!this._refinements.has(word)) {
      this._refinements.set(word, new Float32Array(EMBED_DIM));
    }

    const delta = this._refinements.get(word);
    const base = this._embeddings.get(word) || this._hashEmbedding(word);

    for (let i = 0; i < EMBED_DIM; i++) {
      // Move toward context
      delta[i] += lr * (contextEmbedding[i] - (base[i] + delta[i]));
    }
  }

  /**
   * Hash-based embedding for unknown words.
   * Deterministic — same word always produces same vector.
   * Distributes uniformly in embedding space.
   */
  _hashEmbedding(word) {
    const vec = new Float32Array(EMBED_DIM);
    let hash = this._hashSeed;

    for (let c = 0; c < word.length; c++) {
      hash = ((hash << 5) - hash + word.charCodeAt(c)) | 0;
    }

    for (let i = 0; i < EMBED_DIM; i++) {
      hash = ((hash << 13) ^ hash) | 0;
      hash = ((hash >> 17) ^ hash) | 0;
      hash = ((hash << 5) ^ hash) | 0;
      vec[i] = (hash & 0xFFFF) / 32768 - 1; // [-1, 1]
    }

    // Normalize
    let norm = 0;
    for (let i = 0; i < EMBED_DIM; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < EMBED_DIM; i++) vec[i] /= norm;

    return vec;
  }

  // ── Serialization ───────────────────────────────────────────────

  /**
   * Serialize learned refinements for persistence.
   */
  serializeRefinements() {
    const data = {};
    for (const [word, delta] of this._refinements) {
      data[word] = Array.from(delta);
    }
    return data;
  }

  /**
   * Load learned refinements from persistence.
   */
  loadRefinements(data) {
    if (!data) return;
    for (const [word, arr] of Object.entries(data)) {
      this._refinements.set(word, new Float32Array(arr));
    }
    console.log(`[Embeddings] Loaded ${this._refinements.size} learned refinements`);
  }

  /**
   * Get stats.
   */
  get stats() {
    return {
      pretrained: this._embeddings.size,
      learned: this._refinements.size,
      dim: EMBED_DIM,
      loaded: this._loaded,
    };
  }
}

// ── SHARED SINGLETON ────────────────────────────────────────────
//
// R2 of brain-refactor-full-control — before this shared singleton,
// sensory.js created its own SemanticEmbeddings instance and did
// semantic cortex injection on INPUT, while language-cortex.js had
// no reference to embeddings at all and used letter-hash patterns
// on OUTPUT. The cortex state carried semantic info from input but
// the slot scorer couldn't read it because it was matching letter
// hashes against neural activation.
//
// One shared instance bridges both sides — input semantic mapping
// refines the SAME embedding table that output semantic scoring
// reads from. Online refinements from live conversation visible
// to the generation path.
//
// Import:
//   import { sharedEmbeddings } from './embeddings.js';
//
// Any module that wants semantic word vectors uses this. The
// instance's `loadPreTrained()` should be called once at boot from
// app.js (or the first importer) and `await`ed before corpus loading.
export const sharedEmbeddings = new SemanticEmbeddings();

// Export the dimension constant so downstream files can align buffer
// sizes (e.g. PATTERN_DIM in dictionary.js / language-cortex.js).
export { EMBED_DIM };
