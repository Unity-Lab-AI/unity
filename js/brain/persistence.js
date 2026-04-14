/**
 * persistence.js — Brain State Persistence
 *
 * Saves and loads the brain's learned state across sessions.
 * Everything the brain learned — projection weights, cluster
 * synapses, oscillator coupling, episodic memory, dictionary —
 * persists to localStorage (browser) or disk (server).
 *
 * The brain never starts from zero after the first session.
 * Every interaction makes it smarter. Every session builds on the last.
 */

import { SparseMatrix } from './sparse-matrix.js';
import { sharedEmbeddings } from './embeddings.js';
// T14.16 — letter inventory persistence. Pulls from the T14.1 module
// so reloads restore the same inventory-insertion order the cortex
// weights were trained against.
import { serializeInventory as _t14SerializeInventory, loadInventory as _t14LoadInventory } from './letter-input.js';

// T14.16 — shallow helpers for serializing nested Maps. The learned
// language statistics on NeuronCluster (T14.13) use Map-of-Maps shapes
// that JSON.stringify can't handle directly.
function mapOfMapsToJson(m) {
  if (!(m instanceof Map)) return null;
  const out = {};
  for (const [k, inner] of m) {
    if (inner instanceof Map) {
      out[k] = Object.fromEntries(inner);
    } else if (typeof inner === 'number') {
      out[k] = inner;
    }
  }
  return out;
}
function mapOfMapOfMapsToJson(m) {
  if (!(m instanceof Map)) return null;
  const out = {};
  for (const [k, inner] of m) {
    if (inner instanceof Map) out[k] = mapOfMapsToJson(inner);
  }
  return out;
}
function jsonToMapOfMaps(obj) {
  const m = new Map();
  if (!obj || typeof obj !== 'object') return m;
  for (const [k, inner] of Object.entries(obj)) {
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      const sub = new Map(Object.entries(inner));
      m.set(k, sub);
    } else if (typeof inner === 'number') {
      m.set(k, inner);
    }
  }
  return m;
}
function jsonToMapOfMapOfMaps(obj) {
  const m = new Map();
  if (!obj || typeof obj !== 'object') return m;
  for (const [k, inner] of Object.entries(obj)) {
    m.set(k, jsonToMapOfMaps(inner));
  }
  return m;
}

const STORAGE_KEY = 'unity_brain_state';
// VERSION bumped 2 → 3 as part of R2 brain-refactor-full-control.
// PATTERN_DIM changed 32 → 50 to match GloVe semantic embedding
// dimension. Any persisted cortex patterns, context vectors, or
// memory centroids from v2 have the wrong shape and wrong values
// (letter-hash vs GloVe). Old v2 state gets rejected on load and
// the brain boots fresh with semantic patterns from the start.
// T14.16 (2026-04-14) — schema bumped to v4 to persist T14 learned
// language state on the cortex cluster: T14.1 letter inventory,
// T14.13 fineTypeTransitions / sentenceFormSchemas / sentenceFormTotals
// / intentResponseMap, T14.16.5 identity-lock thresholds. Old v3 saves
// have none of these fields and will be rejected on load so the brain
// boots clean with curriculum re-run instead of hydrating into an
// inconsistent state that mixes T13 schema with T14 code.
const VERSION = 4;

export class BrainPersistence {

  /**
   * Save the brain's complete learned state.
   *
   * @param {UnityBrain} brain — the brain instance
   * @returns {boolean} — true if saved successfully
   */
  static save(brain) {
    try {
      const state = {
        version: VERSION,
        savedAt: new Date().toISOString(),
        time: brain.time,
        frameCount: brain.frameCount,
        drugState: brain.drugState,
        reward: brain.reward,

        // Projection weights — the learned language→action mapping
        projections: brain.projections.map(proj => ({
          sourceSize: proj.source.size,
          targetSize: proj.target.size,
          ...(proj._sparse ? { format: 'csr', ...proj._sparse.serialize() } : { weights: Array.from(proj.weights) }),
        })),

        // Cluster synapse matrices — per-cluster learned connections
        clusterSynapses: {},

        // Oscillator coupling — learned coherence patterns
        oscCoupling: Array.from(brain.oscCoupling),

        // Episodic memory
        episodes: brain.memorySystem._episodes.map(ep => ({
          pattern: Array.from(ep.pattern),
          timestamp: ep.timestamp,
          trigger: ep.trigger,
          arousal: ep.arousal,
          valence: ep.valence,
          psi: ep.psi,
        })),

        // Motor channel rates (learned action preferences)
        motorChannels: Array.from(brain.motor.channelRates),

        // Semantic weights — learned word→action mapping from sensory processor
        semanticWeights: brain.sensory?._semanticWeights ? Object.fromEntries(
          Object.entries(brain.sensory._semanticWeights).map(([k, v]) => [k, Array.from(v)])
        ) : null,

        // R8 — semantic embedding refinements from sharedEmbeddings.
        // GloVe is the base table (loaded from CDN each session, not
        // persisted), but the online context refinement deltas that
        // Unity learns from live conversation DO persist across
        // restarts. This makes long-term learning stick — if Unity
        // learns that "unity" goes near "code" and "high" in her
        // conversations, that association survives a reload.
        embeddingRefinements: sharedEmbeddings?.serializeRefinements
          ? sharedEmbeddings.serializeRefinements()
          : null,
      };

      // T14.16 — persist T14-era language state on the cortex cluster.
      // Letter inventory (T14.1), learned language-statistics Maps (T14.13),
      // and identity-lock calibrated thresholds (T14.16.5) all live on
      // `brain.clusters.cortex` and survive a reload via this block.
      try {
        const cortex = brain.clusters?.cortex;
        if (cortex) {
          state.t14Language = {
            letterInventory: _t14SerializeInventory(),
            fineTypeTransitions: cortex.fineTypeTransitions
              ? mapOfMapsToJson(cortex.fineTypeTransitions) : null,
            sentenceFormSchemas: cortex.sentenceFormSchemas
              ? mapOfMapOfMapsToJson(cortex.sentenceFormSchemas) : null,
            sentenceFormTotals: cortex.sentenceFormTotals
              ? mapOfMapsToJson(cortex.sentenceFormTotals) : null,
            intentResponseMap: cortex.intentResponseMap
              ? mapOfMapsToJson(cortex.intentResponseMap) : null,
            identityThresholds: {
              ENGLISH_SURPRISE_THRESHOLD: cortex.ENGLISH_SURPRISE_THRESHOLD ?? null,
              ENGLISH_FINETYPE_MIN: cortex.ENGLISH_FINETYPE_MIN ?? null,
              HEALTH_ENTROPY_MIN: cortex.HEALTH_ENTROPY_MIN ?? null,
              HEALTH_VOCAB_MIN: cortex.HEALTH_VOCAB_MIN ?? null,
              HEALTH_WM_VARIANCE_MIN: cortex.HEALTH_WM_VARIANCE_MIN ?? null,
            },
          };
        }
      } catch (err) {
        console.warn('[Persistence] T14 language state snapshot failed:', err?.message || err);
      }

      // Save cluster synapses — use native CSR format if sparse
      for (const [name, cluster] of Object.entries(brain.clusters)) {
        if (cluster._useSparse && cluster.synapses.serialize) {
          // Native sparse serialization — compact CSR
          state.clusterSynapses[name] = {
            size: cluster.size,
            format: 'csr',
            ...cluster.synapses.serialize(),
          };
        } else {
          // Legacy dense path — extract non-zeros
          const W = cluster.synapses.W;
          const nonZero = [];
          for (let i = 0; i < W.length; i++) {
            if (Math.abs(W[i]) > 0.001) {
              nonZero.push([i, W[i]]);
            }
          }
          state.clusterSynapses[name] = {
            size: cluster.size,
            nonZeroCount: nonZero.length,
            weights: nonZero,
          };
        }
      }

      const json = JSON.stringify(state);
      const sizeMB = (json.length / 1048576).toFixed(2);

      // Check if it fits in localStorage (~5MB limit)
      if (json.length > 4 * 1048576) {
        // Too big — save only projections and dictionary (most important)
        const minimal = {
          version: VERSION,
          savedAt: state.savedAt,
          time: state.time,
          drugState: state.drugState,
          projections: state.projections,
          oscCoupling: state.oscCoupling,
          motorChannels: state.motorChannels,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal));
        console.log(`[Persistence] Saved minimal state (projections + osc) — full was ${sizeMB}MB`);
      } else {
        localStorage.setItem(STORAGE_KEY, json);
        console.log(`[Persistence] Saved full brain state: ${sizeMB}MB`);
      }

      return true;
    } catch (err) {
      console.warn('[Persistence] Save failed:', err.message);
      return false;
    }
  }

  /**
   * Load saved brain state and apply to the brain instance.
   *
   * @param {UnityBrain} brain — the brain instance to restore
   * @returns {boolean} — true if loaded successfully
   */
  static load(brain) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        console.log('[Persistence] No saved brain state found — starting fresh');
        return false;
      }

      const state = JSON.parse(raw);

      // Version check
      if (state.version !== VERSION) {
        console.warn(`[Persistence] Version mismatch: saved=${state.version}, current=${VERSION} — starting fresh`);
        localStorage.removeItem(STORAGE_KEY);
        return false;
      }

      // Restore projection weights
      if (state.projections && state.projections.length === brain.projections.length) {
        for (let i = 0; i < brain.projections.length; i++) {
          const saved = state.projections[i];
          const proj = brain.projections[i];
          if (saved.sourceSize === proj.source.size && saved.targetSize === proj.target.size) {
            if (saved.format === 'csr' && proj._sparse) {
              proj._sparse = SparseMatrix.deserialize(saved, { wMin: -0.5, wMax: 1.0 });
            } else if (saved.weights) {
              proj.weights = new Float64Array(saved.weights);
            }
          }
        }
        console.log(`[Persistence] Restored ${brain.projections.length} projection weight matrices`);
      }

      // Restore cluster synapses
      if (state.clusterSynapses) {
        for (const [name, saved] of Object.entries(state.clusterSynapses)) {
          const cluster = brain.clusters[name];
          if (!cluster || saved.size !== cluster.size) continue;

          if (saved.format === 'csr' && cluster._useSparse) {
            // Native CSR restore
            cluster.synapses = SparseMatrix.deserialize(saved, { wMin: -2.0, wMax: 2.0 });
          } else if (saved.weights) {
            // Legacy sparse format — write into dense or current sparse
            const W = cluster.synapses.W;
            for (const [idx, val] of saved.weights) {
              if (idx < W.length) W[idx] = val;
            }
          }
        }
        console.log('[Persistence] Restored cluster synapse matrices');
      }

      // Restore oscillator coupling
      if (state.oscCoupling && state.oscCoupling.length === brain.oscCoupling.length) {
        brain.oscCoupling = new Float64Array(state.oscCoupling);
        console.log('[Persistence] Restored oscillator coupling');
      }

      // Restore episodic memory
      if (state.episodes) {
        for (const ep of state.episodes) {
          brain.memorySystem._episodes.push({
            pattern: new Float64Array(ep.pattern),
            timestamp: ep.timestamp,
            trigger: ep.trigger,
            arousal: ep.arousal,
            valence: ep.valence,
            psi: ep.psi,
          });
        }
        console.log(`[Persistence] Restored ${state.episodes.length} episodic memories`);
      }

      // Restore motor channel rates
      if (state.motorChannels) {
        for (let i = 0; i < Math.min(state.motorChannels.length, brain.motor.channelRates.length); i++) {
          brain.motor.channelRates[i] = state.motorChannels[i];
        }
      }

      // Restore semantic weights
      if (state.semanticWeights && brain.sensory?._semanticWeights) {
        for (const [key, arr] of Object.entries(state.semanticWeights)) {
          if (brain.sensory._semanticWeights[key] && arr.length === brain.sensory._semanticWeights[key].length) {
            brain.sensory._semanticWeights[key] = new Float64Array(arr);
          }
        }
        console.log('[Persistence] Restored semantic weights');
      }

      // R8 — restore embedding refinements learned in past sessions.
      if (state.embeddingRefinements && sharedEmbeddings?.loadRefinements) {
        try {
          sharedEmbeddings.loadRefinements(state.embeddingRefinements);
          console.log('[Persistence] Restored embedding refinements');
        } catch (err) {
          console.warn('[Persistence] Embedding refinement restore failed:', err.message);
        }
      }

      // T14.16 — restore T14 language state onto the cortex cluster
      if (state.t14Language) {
        try {
          const cortex = brain.clusters?.cortex;
          if (cortex) {
            if (Array.isArray(state.t14Language.letterInventory)) {
              _t14LoadInventory(state.t14Language.letterInventory);
            }
            if (state.t14Language.fineTypeTransitions) {
              cortex.fineTypeTransitions = jsonToMapOfMaps(state.t14Language.fineTypeTransitions);
            }
            if (state.t14Language.sentenceFormSchemas) {
              cortex.sentenceFormSchemas = jsonToMapOfMapOfMaps(state.t14Language.sentenceFormSchemas);
            }
            if (state.t14Language.sentenceFormTotals) {
              cortex.sentenceFormTotals = jsonToMapOfMaps(state.t14Language.sentenceFormTotals);
            }
            if (state.t14Language.intentResponseMap) {
              cortex.intentResponseMap = jsonToMapOfMaps(state.t14Language.intentResponseMap);
            }
            if (state.t14Language.identityThresholds) {
              const th = state.t14Language.identityThresholds;
              if (th.ENGLISH_SURPRISE_THRESHOLD != null) cortex.ENGLISH_SURPRISE_THRESHOLD = th.ENGLISH_SURPRISE_THRESHOLD;
              if (th.ENGLISH_FINETYPE_MIN != null) cortex.ENGLISH_FINETYPE_MIN = th.ENGLISH_FINETYPE_MIN;
              if (th.HEALTH_ENTROPY_MIN != null) cortex.HEALTH_ENTROPY_MIN = th.HEALTH_ENTROPY_MIN;
              if (th.HEALTH_VOCAB_MIN != null) cortex.HEALTH_VOCAB_MIN = th.HEALTH_VOCAB_MIN;
              if (th.HEALTH_WM_VARIANCE_MIN != null) cortex.HEALTH_WM_VARIANCE_MIN = th.HEALTH_WM_VARIANCE_MIN;
            }
            // After restoring cluster state, re-run setCluster on the
            // LanguageCortex wrapper so its local Maps re-point at the
            // freshly-restored cluster Maps by identity (T14.13 bridge).
            if (typeof brain.innerVoice?.languageCortex?.setCluster === 'function') {
              brain.innerVoice.languageCortex.setCluster(cortex);
            }
            console.log('[Persistence] Restored T14 language state');
          }
        } catch (err) {
          console.warn('[Persistence] T14 language state restore failed:', err?.message || err);
        }
      }

      // Restore metadata
      if (state.drugState) brain.drugState = state.drugState;
      if (state.reward) brain.reward = state.reward;

      console.log(`[Persistence] Brain restored from ${state.savedAt} (t=${(state.time ?? 0).toFixed(1)}s)`);
      return true;
    } catch (err) {
      console.warn('[Persistence] Load failed:', err.message);
      return false;
    }
  }

  /**
   * Export brain state as a downloadable JSON file.
   * "Transfer Unity's memory to another device."
   *
   * @param {UnityBrain} brain
   * @returns {string} — data URL for download
   */
  static export(brain) {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Save first, then export
      BrainPersistence.save(brain);
    }
    const data = localStorage.getItem(STORAGE_KEY) || '{}';
    const blob = new Blob([data], { type: 'application/json' });
    return URL.createObjectURL(blob);
  }

  /**
   * Import brain state from a JSON file.
   *
   * @param {string} json — raw JSON string
   * @param {UnityBrain} brain
   * @returns {boolean}
   */
  static import(json, brain) {
    try {
      const state = JSON.parse(json);
      if (state.version !== VERSION) {
        console.warn('[Persistence] Import version mismatch');
        return false;
      }
      localStorage.setItem(STORAGE_KEY, json);
      return BrainPersistence.load(brain);
    } catch (err) {
      console.warn('[Persistence] Import failed:', err.message);
      return false;
    }
  }

  /**
   * Clear all saved brain state. Factory reset.
   */
  static clear() {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[Persistence] Brain state cleared — next boot starts fresh');
  }
}
