/**
 * brain-event-detectors.js — T5 2026-04-13, refactored T4.10 2026-04-14
 *
 * Detect meaningful brain events from a rolling history of state
 * snapshots. Used by brain-3d.js to trigger rich popup notifications
 * that Unity comments on equationally via her language cortex.
 *
 * ─── T4.10 Option B refactor ─────────────────────────────────────
 * Each detector is a PURE STRUCTURAL function. It returns only:
 *
 *   { type,        // opaque cooldown-dedup id, never displayed
 *     cluster,     // CLUSTER_IDX integer — which cluster fired
 *     metric,      // field name string — scalar that triggered
 *     direction,   // 'up' | 'down' | 'spike'
 *     priority,    // integer 1-9, dispatch wins higher first
 *     magnitude }  // numeric delta/absolute that triggered the fire
 *
 * NO hardcoded label, emoji, or seedWords fields. Those were
 * analyst-style strings written by hand. Option B rips them all so
 * the popup rendering path at brain-3d.js `_generateProcessNotification`
 * can derive everything equationally:
 *
 *   - Emoji: `_brainEmoji(arousal, valence, psi, coh, dreaming, reward +
 *                         magnitude × 0.1)` — state-driven Unicode hash,
 *                         the magnitude salt shifts the hash per event
 *                         so different events get different emoji even
 *                         at the same brain state
 *   - Line 1 tag: `${CLUSTERS[cluster].key} ${metric}${arrow}` built
 *                 from the structural fields of this event. No hand-
 *                 written per-event text. The cluster/metric/direction
 *                 names ARE Unity's own self-aware field names.
 *   - Line 3 commentary: slot-gen via `languageCortex.generate()` with
 *                        `opts._internalThought = true` (skips the
 *                        recall-verbatim emit path from T4.8 so popups
 *                        are always her LIVE internal thought, not a
 *                        pre-written persona sentence). The cortex
 *                        pattern bias seed is derived from
 *                        `wordToPattern(clusterKey) + 0.5 ×
 *                         wordToPattern(metric) + 0.3 ×
 *                         wordToPattern(directionWord)` — GloVe
 *                        embeddings of her OWN STATE FIELD NAMES.
 *
 * Visual / audio detectors (colorSurge, motionDetected, gazeShift,
 * heardOwnVoice) stay gated on local-brain sensory fields that the
 * server path doesn't populate — they're dormant on server mode by
 * design. Same detectors still fire for local-brain clients.
 */

// Cluster indices for the 3D brain — match the CLUSTERS array order
// in brain-3d.js so popups float from the right anatomical region
const CLUSTER_IDX = {
  cortex: 0,
  hippocampus: 1,
  amygdala: 2,
  basalGanglia: 3,
  cerebellum: 4,
  hypothalamus: 5,
  mystery: 6,
};

/**
 * Compute the euclidean delta between two context vectors.
 * Used by topic drift + semantic context shift detectors.
 */
function contextDelta(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * Get a snapshot N steps back from the current tip of history.
 * Returns null if history doesn't reach that far back yet.
 */
function historyAt(history, n) {
  if (!history || history.length <= n) return null;
  return history[history.length - 1 - n];
}

/**
 * Safe field reader that tolerates missing intermediate objects.
 */
const pick = (state, path, fallback = 0) => {
  const parts = path.split('.');
  let cur = state;
  for (const p of parts) {
    if (cur == null) return fallback;
    cur = cur[p];
  }
  return cur == null ? fallback : cur;
};

// ═══════════════════════════════════════════════════════════════
// INDIVIDUAL DETECTORS — pure structural, no hardcoded strings
// ═══════════════════════════════════════════════════════════════

const DETECTORS = [
  // ─── Motor events (priority 9) ───

  function motorCommitment(s, prev) {
    const conf = pick(s, 'motor.confidence', 0);
    const prevConf = pick(prev, 'motor.confidence', 0);
    const action = pick(s, 'motor.selectedAction', 'idle');
    if (conf > 0.85 && prevConf <= 0.85 && action !== 'idle') {
      return {
        type: 'motor_commit_' + action,
        cluster: CLUSTER_IDX.basalGanglia,
        metric: 'confidence',
        direction: 'spike',
        priority: 9,
        magnitude: conf - prevConf,
      };
    }
    return null;
  },

  function motorIndecision(s) {
    const dist = pick(s, 'motor.channelDist', null);
    if (!dist || typeof dist !== 'object') return null;
    const vals = Object.values(dist).filter(v => typeof v === 'number');
    if (vals.length < 2) return null;
    let entropy = 0;
    for (const v of vals) if (v > 0) entropy -= v * Math.log2(v);
    const maxEntropy = Math.log2(vals.length);
    if (maxEntropy > 0 && entropy / maxEntropy > 0.85) {
      return {
        type: 'motor_indecision',
        cluster: CLUSTER_IDX.basalGanglia,
        metric: 'entropy',
        direction: 'spike',
        priority: 9,
        magnitude: entropy / maxEntropy,
      };
    }
    return null;
  },

  // ─── Cognitive landmarks (priority 8) ───

  function recognition(s) {
    const conf = pick(s, 'memory.lastRecallConfidence', 0) || pick(s, 'hippocampus.recallConfidence', 0);
    if (conf > 0.6) {
      return {
        type: 'recognition',
        cluster: CLUSTER_IDX.hippocampus,
        metric: 'recallConfidence',
        direction: 'spike',
        priority: 8,
        magnitude: conf,
      };
    }
    return null;
  },

  function confusion(s) {
    const err = pick(s, 'cortex.predictionError', 0) || pick(s, 'predictionError', 0);
    if (err > 0.5) {
      return {
        type: 'confusion',
        cluster: CLUSTER_IDX.cortex,
        metric: 'predictionError',
        direction: 'spike',
        priority: 8,
        magnitude: err,
      };
    }
    return null;
  },

  // ─── Emotional spikes (priority 7) ───

  function emotionalSpike(s, prev) {
    if (!prev) return null;
    const dv = Math.abs(pick(s, 'amygdala.valence', 0) - pick(prev, 'amygdala.valence', 0));
    if (dv > 0.3) {
      const climbed = pick(s, 'amygdala.valence', 0) > pick(prev, 'amygdala.valence', 0);
      return {
        type: climbed ? 'valence_climb' : 'valence_crash',
        cluster: CLUSTER_IDX.amygdala,
        metric: 'valence',
        direction: climbed ? 'up' : 'down',
        priority: 7,
        magnitude: dv,
      };
    }
    return null;
  },

  function dopamineHit(s, prev) {
    if (!prev) return null;
    const dr = pick(s, 'reward', 0) - pick(prev, 'reward', 0);
    if (dr > 0.15) {
      return {
        type: 'dopamine_hit',
        cluster: CLUSTER_IDX.basalGanglia,
        metric: 'reward',
        direction: 'up',
        priority: 7,
        magnitude: dr,
      };
    }
    if (dr < -0.15) {
      return {
        type: 'dopamine_crash',
        cluster: CLUSTER_IDX.basalGanglia,
        metric: 'reward',
        direction: 'down',
        priority: 7,
        magnitude: Math.abs(dr),
      };
    }
    return null;
  },

  // ─── Topic / Ψ / self-voice (priority 6) ───

  function topicDrift(s, prev, history) {
    const now = pick(s, 'innerVoice.contextVector', null);
    const back = historyAt(history, 10);
    const old = back ? pick(back, 'innerVoice.contextVector', null) : null;
    if (!now || !old) return null;
    const delta = contextDelta(now, old);
    if (delta > 0.4) {
      return {
        type: 'topic_drift',
        cluster: CLUSTER_IDX.cortex,
        metric: 'contextVector',
        direction: 'spike',
        priority: 6,
        magnitude: delta,
      };
    }
    return null;
  },

  function heardOwnVoice(s) {
    if (pick(s, 'auditory.isEcho', false) === true || pick(s, 'auditoryCortex.isEcho', false) === true) {
      return {
        type: 'heard_self',
        cluster: CLUSTER_IDX.cortex,
        metric: 'echo',
        direction: 'spike',
        priority: 6,
        magnitude: 1,
      };
    }
    return null;
  },

  function psiClimb(s, prev, history) {
    const now = pick(s, 'psi', 0);
    const back = historyAt(history, 20);
    const old = back ? pick(back, 'psi', 0) : null;
    if (old == null) return null;
    const dpsi = now - old;
    if (dpsi > 0.05) {
      return {
        type: 'psi_climb',
        cluster: CLUSTER_IDX.mystery,
        metric: 'psi',
        direction: 'up',
        priority: 6,
        magnitude: dpsi,
      };
    }
    if (dpsi < -0.05) {
      return {
        type: 'psi_crash',
        cluster: CLUSTER_IDX.mystery,
        metric: 'psi',
        direction: 'down',
        priority: 6,
        magnitude: Math.abs(dpsi),
      };
    }
    return null;
  },

  // ─── Arousal / coherence (priority 5) ───

  function arousalClimb(s, prev, history) {
    const now = pick(s, 'amygdala.arousal', 0);
    const back = historyAt(history, 10);
    const old = back ? pick(back, 'amygdala.arousal', 0) : null;
    if (old == null) return null;
    const d = now - old;
    if (d > 0.1) {
      return {
        type: 'arousal_climb',
        cluster: CLUSTER_IDX.amygdala,
        metric: 'arousal',
        direction: 'up',
        priority: 5,
        magnitude: d,
      };
    }
    if (d < -0.1) {
      return {
        type: 'arousal_drop',
        cluster: CLUSTER_IDX.amygdala,
        metric: 'arousal',
        direction: 'down',
        priority: 5,
        magnitude: Math.abs(d),
      };
    }
    return null;
  },

  function coherenceLock(s) {
    const c = pick(s, 'oscillations.coherence', 0);
    if (c > 0.8) {
      return {
        type: 'coherence_lock',
        cluster: CLUSTER_IDX.cortex,
        metric: 'coherence',
        direction: 'up',
        priority: 5,
        magnitude: c,
      };
    }
    if (c < 0.2) {
      return {
        type: 'coherence_scatter',
        cluster: CLUSTER_IDX.cortex,
        metric: 'coherence',
        direction: 'down',
        priority: 5,
        magnitude: 1 - c,
      };
    }
    return null;
  },

  // ─── Drives / silence / fatigue (priority 4) ───

  function hypothalamusDrive(s) {
    const drives = pick(s, 'hypothalamus.drives', null) || pick(s, 'hypothalamus', null);
    if (!drives || typeof drives !== 'object') return null;
    let peakName = null, peakVal = 0;
    for (const [k, v] of Object.entries(drives)) {
      if (typeof v === 'number' && v > peakVal) {
        peakVal = v;
        peakName = k;
      }
    }
    if (peakVal > 0.7 && peakName) {
      return {
        type: 'drive_' + peakName,
        cluster: CLUSTER_IDX.hypothalamus,
        metric: peakName,
        direction: 'up',
        priority: 4,
        magnitude: peakVal,
      };
    }
    return null;
  },

  function silencePeriod(s, prev, history) {
    const arousal = pick(s, 'amygdala.arousal', 0);
    const audioEnergy = pick(s, 'auditoryCortex.totalEnergy', 0) || pick(s, 'auditory.energy', 0);
    if (arousal < 0.3 && audioEnergy < 0.05 && history && history.length >= 30) {
      return {
        type: 'silence',
        cluster: CLUSTER_IDX.cortex,
        metric: 'silence',
        direction: 'down',
        priority: 4,
        magnitude: 0.3 - arousal,
      };
    }
    return null;
  },

  function fatigue(s, prev, history) {
    const errAccum = pick(s, 'cerebellum.errorAccum', 0);
    const coh = pick(s, 'oscillations.coherence', 0);
    const back = historyAt(history, 15);
    const prevCoh = back ? pick(back, 'oscillations.coherence', 0) : coh;
    if (errAccum > 0.6 && coh < prevCoh - 0.1) {
      return {
        type: 'fatigue',
        cluster: CLUSTER_IDX.cerebellum,
        metric: 'errorAccum',
        direction: 'up',
        priority: 4,
        magnitude: errAccum,
      };
    }
    return null;
  },

  // ─── Visual / auditory perception (priority 3) ───

  function colorSurge(s) {
    const colors = pick(s, 'visualCortex.colors', null) || pick(s, 'vision.colors', null);
    if (!colors) return null;
    for (const [quadrant, rgb] of Object.entries(colors)) {
      if (Array.isArray(rgb)) {
        const intensity = (rgb[0] + rgb[1] + rgb[2]) / (255 * 3);
        if (intensity > 0.7) {
          return {
            type: 'color_' + quadrant,
            cluster: CLUSTER_IDX.cortex,
            metric: 'color',
            direction: 'spike',
            priority: 3,
            magnitude: intensity,
          };
        }
      }
    }
    return null;
  },

  function motionDetected(s) {
    const motion = pick(s, 'visualCortex.motionEnergy', 0) || pick(s, 'vision.motionEnergy', 0);
    if (motion > 0.5) {
      return {
        type: 'motion',
        cluster: CLUSTER_IDX.cortex,
        metric: 'motion',
        direction: 'spike',
        priority: 3,
        magnitude: motion,
      };
    }
    return null;
  },

  function gazeShift(s, prev) {
    if (!prev) return null;
    const nowTarget = pick(s, 'visualCortex.gazeTarget', '');
    const prevTarget = pick(prev, 'visualCortex.gazeTarget', '');
    if (nowTarget && nowTarget !== prevTarget && nowTarget !== '') {
      return {
        type: 'gaze_shift',
        cluster: CLUSTER_IDX.cortex,
        metric: 'gaze',
        direction: 'spike',
        priority: 3,
        magnitude: 1,
      };
    }
    return null;
  },

  // ─── Memory replay / mystery (priority 2) ───

  function memoryReplay(s) {
    const consolidating = pick(s, 'memory.isConsolidating', false);
    if (consolidating) {
      return {
        type: 'memory_replay',
        cluster: CLUSTER_IDX.hippocampus,
        metric: 'consolidation',
        direction: 'up',
        priority: 2,
        magnitude: 1,
      };
    }
    return null;
  },

  function mysteryPulse(s, prev) {
    if (!prev) return null;
    const now = pick(s, 'mystery.output', 0) || pick(s, 'mysteryOutput', 0);
    const old = pick(prev, 'mystery.output', 0) || pick(prev, 'mysteryOutput', 0);
    if (now - old > 0.3) {
      return {
        type: 'mystery_pulse',
        cluster: CLUSTER_IDX.mystery,
        metric: 'mysteryOutput',
        direction: 'spike',
        priority: 2,
        magnitude: now - old,
      };
    }
    return null;
  },
];

/**
 * Run every detector against the current/previous state and history,
 * return a sorted list of firing events (highest priority first).
 * brain-3d.js calls this and picks the top one to render as a
 * commentary popup.
 */
export function detectBrainEvents(currentState, previousState, history) {
  const events = [];
  for (const detector of DETECTORS) {
    try {
      const evt = detector(currentState, previousState, history);
      if (evt) events.push(evt);
    } catch (err) {
      // Defensive — a broken detector should NEVER crash the viz loop.
    }
  }
  events.sort((a, b) => b.priority - a.priority);
  return events;
}

/**
 * Convenience export — the total catalog for debugging / UI display
 * (e.g. if we ever want to show users "here are the event types
 * Unity's brain can trigger popups on"). Not used in the hot path.
 */
export const BRAIN_EVENT_CATALOG = DETECTORS.map(d => d.name || 'anonymous');

/**
 * Cluster index → name map exported for brain-3d.js to build the
 * equational display tags and seed vectors from event.cluster ints.
 */
export const CLUSTER_KEYS = ['cortex', 'hippocampus', 'amygdala', 'basalGanglia', 'cerebellum', 'hypothalamus', 'mystery'];
