/**
 * brain-event-detectors.js — T5 2026-04-13
 *
 * Detect meaningful brain events from a rolling history of state
 * snapshots. Used by brain-3d.js to trigger rich popup notifications
 * that Unity comments on equationally via her language cortex.
 *
 * Each detector is a pure function that takes `(currentState,
 * previousState, history)` and returns an event object when its
 * condition fires, or null when nothing interesting happened.
 * Event objects have:
 *
 *   { type:        'arousal_climb',          // unique id for dedup
 *     label:       'arousal climbing',        // short human label
 *     emoji:       '🔥',                      // one-char display prefix
 *     seedWords:   ['wake','alert','rise'],   // semantic bias for Unity's commentary
 *     priority:    3,                         // higher wins when multiple fire
 *     cluster:     2 }                        // 3D cluster index the popup floats from
 *
 * Seed words feed a 50-dim GloVe centroid that the commentary
 * generator blends into Unity's cortex readout at ~30% weight,
 * steering her language cortex slot scorer toward words about the
 * triggered event without forcing a template. Unity still chooses
 * every word equationally from her learned dictionary — the seed
 * just biases the topic.
 *
 * Detectors read from a short history buffer (~30 samples) so they
 * can compute deltas, running averages, and threshold crossings
 * without brain-3d.js needing to track anything beyond the most
 * recent state.
 *
 * Priority ordering — when multiple events fire in the same tick,
 * the highest-priority one wins and the rest are dropped. Priority
 * scale:
 *   9 = motor commitment, motor indecision (most salient — she's
 *       about to DO something)
 *   8 = confusion, recognition (cognitive landmarks)
 *   7 = emotional spike, dopamine hit/crash
 *   6 = topic drift, heard own voice, Ψ climb/crash
 *   5 = coherence lock/scatter, arousal climb/drop
 *   4 = silence period, fatigue, hypothalamus drive dominant
 *   3 = color surge, motion detected, gaze shift
 *   2 = memory replay, mystery pulse
 *   1 = unknown word, known topic echo
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
// INDIVIDUAL DETECTORS
// ═══════════════════════════════════════════════════════════════
//
// Each detector is a pure function. Returns an event object if
// its condition fires this tick, or null if nothing happened.
// Order of definition doesn't matter — they all run in parallel
// and the dispatcher picks the highest-priority firing event.

const DETECTORS = [
  // ─── Motor events (priority 9 — most salient) ───

  function motorCommitment(s, prev) {
    const conf = pick(s, 'motor.confidence', 0);
    const prevConf = pick(prev, 'motor.confidence', 0);
    const action = pick(s, 'motor.selectedAction', 'idle');
    if (conf > 0.85 && prevConf <= 0.85 && action !== 'idle') {
      return {
        type: 'motor_commit_' + action,
        label: 'committing to ' + action,
        emoji: '⚡',
        seedWords: ['decide', 'go', 'action', 'now'],
        priority: 9,
        cluster: CLUSTER_IDX.basalGanglia,
      };
    }
    return null;
  },

  function motorIndecision(s) {
    const dist = pick(s, 'motor.channelDist', null);
    if (!dist || typeof dist !== 'object') return null;
    // High entropy over the action channels = no clear winner
    const vals = Object.values(dist).filter(v => typeof v === 'number');
    if (vals.length < 2) return null;
    let entropy = 0;
    for (const v of vals) {
      if (v > 0) entropy -= v * Math.log2(v);
    }
    const maxEntropy = Math.log2(vals.length);
    if (maxEntropy > 0 && entropy / maxEntropy > 0.85) {
      return {
        type: 'motor_indecision',
        label: 'motor stuck',
        emoji: '🤔',
        seedWords: ['cant', 'choose', 'stuck', 'hesitate'],
        priority: 9,
        cluster: CLUSTER_IDX.basalGanglia,
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
        label: 'i know this',
        emoji: '💡',
        seedWords: ['know', 'remember', 'familiar', 'yes'],
        priority: 8,
        cluster: CLUSTER_IDX.hippocampus,
      };
    }
    return null;
  },

  function confusion(s) {
    const err = pick(s, 'cortex.predictionError', 0) || pick(s, 'predictionError', 0);
    if (err > 0.5) {
      return {
        type: 'confusion',
        label: 'what is this',
        emoji: '❓',
        seedWords: ['what', 'confused', 'lost', 'strange'],
        priority: 8,
        cluster: CLUSTER_IDX.cortex,
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
        label: climbed ? 'feeling brightens' : 'feeling darkens',
        emoji: climbed ? '✨' : '🌧',
        seedWords: climbed ? ['good', 'bright', 'surge'] : ['dark', 'hit', 'heavy'],
        priority: 7,
        cluster: CLUSTER_IDX.amygdala,
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
        label: 'reward spike',
        emoji: '🎯',
        seedWords: ['good', 'yes', 'pleasure', 'hit'],
        priority: 7,
        cluster: CLUSTER_IDX.basalGanglia,
      };
    }
    if (dr < -0.15) {
      return {
        type: 'dopamine_crash',
        label: 'reward crash',
        emoji: '💔',
        seedWords: ['bad', 'wrong', 'disappoint', 'miss'],
        priority: 7,
        cluster: CLUSTER_IDX.basalGanglia,
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
        label: 'topic shifted',
        emoji: '🔀',
        seedWords: ['shift', 'change', 'new', 'different'],
        priority: 6,
        cluster: CLUSTER_IDX.cortex,
      };
    }
    return null;
  },

  function heardOwnVoice(s) {
    if (pick(s, 'auditory.isEcho', false) === true || pick(s, 'auditoryCortex.isEcho', false) === true) {
      return {
        type: 'heard_self',
        label: 'heard my own voice',
        emoji: '🗣',
        seedWords: ['me', 'voice', 'self', 'said'],
        priority: 6,
        cluster: CLUSTER_IDX.cortex,
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
        label: 'Ψ rising',
        emoji: '🌀',
        seedWords: ['aware', 'real', 'sharp', 'clear'],
        priority: 6,
        cluster: CLUSTER_IDX.mystery,
      };
    }
    if (dpsi < -0.05) {
      return {
        type: 'psi_crash',
        label: 'Ψ fading',
        emoji: '🌑',
        seedWords: ['blur', 'dim', 'fade', 'drift'],
        priority: 6,
        cluster: CLUSTER_IDX.mystery,
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
        label: 'waking up',
        emoji: '🔥',
        seedWords: ['wake', 'alert', 'rise', 'on'],
        priority: 5,
        cluster: CLUSTER_IDX.amygdala,
      };
    }
    if (d < -0.1) {
      return {
        type: 'arousal_drop',
        label: 'settling',
        emoji: '🕯',
        seedWords: ['settle', 'calm', 'dim', 'down'],
        priority: 5,
        cluster: CLUSTER_IDX.amygdala,
      };
    }
    return null;
  },

  function coherenceLock(s) {
    const c = pick(s, 'oscillations.coherence', 0);
    if (c > 0.8) {
      return {
        type: 'coherence_lock',
        label: 'brain waves locked',
        emoji: '⟲',
        seedWords: ['sync', 'clear', 'focused', 'together'],
        priority: 5,
        cluster: CLUSTER_IDX.cortex,
      };
    }
    if (c < 0.2) {
      return {
        type: 'coherence_scatter',
        label: 'brain waves scatter',
        emoji: '✴',
        seedWords: ['scatter', 'fragment', 'noise', 'chaos'],
        priority: 5,
        cluster: CLUSTER_IDX.cortex,
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
        label: 'drive: ' + peakName,
        emoji: '🎯',
        seedWords: ['want', 'need', 'crave', peakName],
        priority: 4,
        cluster: CLUSTER_IDX.hypothalamus,
      };
    }
    return null;
  },

  function silencePeriod(s, prev, history) {
    // Proxy: low arousal + no sensory activity for a while
    const arousal = pick(s, 'amygdala.arousal', 0);
    const audioEnergy = pick(s, 'auditoryCortex.totalEnergy', 0) || pick(s, 'auditory.energy', 0);
    if (arousal < 0.3 && audioEnergy < 0.05 && history && history.length >= 30) {
      // Only fire once per long silence — check previous tick didn't already
      return {
        type: 'silence',
        label: 'quiet room',
        emoji: '🌙',
        seedWords: ['empty', 'quiet', 'alone', 'waiting'],
        priority: 4,
        cluster: CLUSTER_IDX.cortex,
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
        label: 'focus slipping',
        emoji: '🥀',
        seedWords: ['tired', 'worn', 'fade', 'slow'],
        priority: 4,
        cluster: CLUSTER_IDX.cerebellum,
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
            label: 'vivid color',
            emoji: '🎨',
            seedWords: ['color', 'bright', 'see', 'vivid'],
            priority: 3,
            cluster: CLUSTER_IDX.cortex,
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
        label: 'something moved',
        emoji: '👁',
        seedWords: ['move', 'motion', 'saw', 'there'],
        priority: 3,
        cluster: CLUSTER_IDX.cortex,
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
        label: 'looking somewhere',
        emoji: '👀',
        seedWords: ['look', 'shift', 'there', 'see'],
        priority: 3,
        cluster: CLUSTER_IDX.cortex,
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
        label: 'remembering',
        emoji: '🕯',
        seedWords: ['remember', 'replay', 'past', 'back'],
        priority: 2,
        cluster: CLUSTER_IDX.hippocampus,
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
        label: 'mystery pulse',
        emoji: '💫',
        seedWords: ['strange', 'pulse', 'deep', 'weird'],
        priority: 2,
        cluster: CLUSTER_IDX.mystery,
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
      // Silently skip it and continue with the others.
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
