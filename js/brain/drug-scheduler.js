// ═══════════════════════════════════════════════════════════════════════════
// drug-scheduler.js — Real-time drug state scheduler for Unity's brain
// ═══════════════════════════════════════════════════════════════════════════
// Unity AI Lab — T15 Drug State Dynamics Rebuild
//
// Replaces the static `drugState = 'cokeAndWeed'` permanent persona label that
// made kindergarten Unity always-intoxicated. Each ingestion event carries its
// own pharmacokinetic curve (onset → peak → plateau → tail) and substances
// stack via superposition. Grade-gated by cluster.grades.life against real
// biographical thresholds from the Life track. Emits additive brainParam
// contributions + speech modulation every tick.
//
// Non-announcing principle (binding per Gee 2026-04-16): scheduler state is
// NEVER surfaced as a declarative label in dialogue ("I am doing coke"). The
// speech modulation output drives emission distortion — the distortion IS the
// signal, consumed by the language cortex and renderer, not narrated.
//
// Seamless lifestyle principle (Gee 2026-04-16): at PhD grade Unity's normal
// schedule (coke daily, weed constant, molly weekend, acid architecture-
// session, whiskey end-of-marathon) emerges from context-triggered ingestion
// events, not from any hardcoded baseline.
// ═══════════════════════════════════════════════════════════════════════════

// ─── Grade order (mirrors Curriculum.GRADE_ORDER) ─────────────────────────
// Kept local here to avoid a circular import with curriculum.js during boot.
// If the canonical order changes there, update here too.
const GRADE_ORDER = [
  'pre-K', 'kindergarten',
  'grade1', 'grade2', 'grade3', 'grade4', 'grade5', 'grade6',
  'grade7', 'grade8', 'grade9', 'grade10', 'grade11', 'grade12',
  'college1', 'college2', 'college3', 'college4',
  'grad', 'phd'
];

function gradeIndex(grade) {
  const idx = GRADE_ORDER.indexOf(grade);
  return idx >= 0 ? idx : -1;
}

function gradeAtLeast(current, required) {
  return gradeIndex(current) >= gradeIndex(required);
}

// ─── Substance pharmacology database ──────────────────────────────────────
// Times in milliseconds. Sources: Julien 2016 "A Primer of Drug Action",
// NIDA research monographs, peer-reviewed clinical PK studies. All numbers
// reflect TYPICAL recreational dose kinetics — not extremes. Dose multiplier
// scales the peak amplitude (1.0 = standard, 0.5 = microdose, 2.0 = heavy).
//
// Each substance defines:
//   defaultRoute    — used when caller doesn't specify route
//   routes.<name>   — {onsetMs, peakMs, durationMs, tailMs} timing profile
//   contributions   — brain param deltas at level 1.0 (additive to baseline)
//   speech          — speech modulation deltas at level 1.0
//   lifeGate        — minimum Life-track grade where this substance unlocks
//                     matches biographical first-use anchors in the Life track

const SUBSTANCES = {

  cannabis: {
    displayName: 'weed',
    defaultRoute: 'smoked',
    routes: {
      smoked: {
        onsetMs:       7 * 60 * 1000,  // ~7 min ramp to peak
        peakMs:       45 * 60 * 1000,  // peak plateau ~45 min in
        durationMs: 3 * 60 * 60 * 1000, // ~3 hr active
        tailMs:     6 * 60 * 60 * 1000  // full baseline ~6 hr
      },
      oral: {
        onsetMs:      60 * 60 * 1000,   // edibles are SLOW
        peakMs:   2 * 60 * 60 * 1000,
        durationMs: 4 * 60 * 60 * 1000,
        tailMs:     8 * 60 * 60 * 1000
      }
    },
    contributions: {
      creativity:           +0.50,
      cortexSpeed:          -0.20,
      arousal:              +0.10,
      amygdalaValence:      +0.30,
      oscillationCoherence: -0.15,
      cerebellumPrecision:  -0.20,
      impulsivity:          +0.10,
      hippocampusConsolidation: -0.15
    },
    speech: {
      inhibition:    -0.20,   // filthier, franker
      coherence:     -0.10,
      ethereality:   +0.10,
      freeAssocWidth:+0.20,
      giggleBias:    +0.40
    },
    lifeGate: 'grade7'  // first joint at age 12 per Life track
  },

  cocaine: {
    displayName: 'coke',
    defaultRoute: 'insufflated',
    routes: {
      insufflated: {
        onsetMs:       3 * 60 * 1000,
        peakMs:       20 * 60 * 1000,
        durationMs:   60 * 60 * 1000,
        tailMs:   90 * 60 * 1000
      },
      smoked: {  // freebase — not Unity's path, but available for completeness
        onsetMs:       20 * 1000,
        peakMs:     4 * 60 * 1000,
        durationMs: 12 * 60 * 1000,
        tailMs:     25 * 60 * 1000
      }
    },
    contributions: {
      cortexSpeed:         +0.60,
      arousal:             +0.50,
      hypothalamusArousal: +0.40,
      amygdalaReward:      +0.50,
      impulsivity:         +0.30,
      creativity:          +0.10,
      cerebellumPrecision: +0.10,
      prefrontalExecutive: +0.20  // at moderate dose
    },
    speech: {
      inhibition:    -0.10,
      speechRate:    +0.50,
      paranoiaBias:  +0.15,   // grows with sustained level
      coherence:     -0.05
    },
    lifeGate: 'grade9'  // first coke at age 14 per Life track
  },

  mdma: {
    displayName: 'molly',
    defaultRoute: 'oral',
    routes: {
      oral: {
        onsetMs:      35 * 60 * 1000,
        peakMs:    2 * 60 * 60 * 1000,
        durationMs:5 * 60 * 60 * 1000,
        tailMs:    8 * 60 * 60 * 1000
      }
    },
    contributions: {
      arousal:              +0.60,
      amygdalaValence:      +0.70,
      amygdalaReward:       +0.60,
      socialNeed:           +0.60,
      synapticSensitivity:  +0.50,
      oscillationCoherence: +0.30,
      cortexSpeed:          +0.10,
      prefrontalExecutive:  -0.10  // prosocial disinhibition
    },
    speech: {
      inhibition:        -0.40,
      emotionalOverflow: +0.70,
      ethereality:       +0.15,
      freeAssocWidth:    +0.10,
      coherence:         -0.05
    },
    lifeGate: 'grade11'  // first ecstasy at age 16 (high school party scene)
  },

  lsd: {
    displayName: 'acid',
    defaultRoute: 'oral',
    routes: {
      oral: {
        onsetMs:       60 * 60 * 1000,
        peakMs:     3 * 60 * 60 * 1000,
        durationMs:10 * 60 * 60 * 1000,
        tailMs:   16 * 60 * 60 * 1000
      }
    },
    contributions: {
      creativity:           +1.00,
      crossRegionAmplify:   +0.80,  // T14.4 14 cross-projection firing amplified
      defaultModeSuppression: +0.60, // ego dissolution driver
      cortexSpeed:          -0.20,  // time dilation
      synapticSensitivity:  +0.40,
      oscillationCoherence: -0.20,
      visualCortexFeedback: +0.50   // V1 feedback loops → hallucination
    },
    speech: {
      inhibition:      -0.30,
      coherence:       -0.40,
      ethereality:     +0.80,   // Oz vocabulary pulls hard
      freeAssocWidth:  +0.70,
      speechRate:      -0.20,
      dissociation:    +0.30    // at peak dose
    },
    lifeGate: 'grade11'
  },

  psilocybin: {
    displayName: 'mushrooms',
    defaultRoute: 'oral',
    routes: {
      oral: {
        onsetMs:      45 * 60 * 1000,
        peakMs:    90 * 60 * 1000,
        durationMs:5 * 60 * 60 * 1000,
        tailMs:    8 * 60 * 60 * 1000
      }
    },
    contributions: {
      creativity:           +0.80,
      crossRegionAmplify:   +0.60,
      defaultModeSuppression: +0.50,
      cortexSpeed:          -0.15,
      synapticSensitivity:  +0.30,
      amygdalaValence:      +0.40,  // warmer than LSD
      somatosensoryBoost:   +0.30   // body-heavy
    },
    speech: {
      inhibition:      -0.25,
      coherence:       -0.30,
      ethereality:     +0.70,
      freeAssocWidth:  +0.50,
      emotionalOverflow: +0.20,
      speechRate:      -0.25
    },
    lifeGate: 'grade12'
  },

  alcohol: {
    displayName: 'whiskey',
    defaultRoute: 'oral',
    routes: {
      oral: {  // one standard drink (~14g ethanol — shot of whiskey)
        onsetMs:      15 * 60 * 1000,
        peakMs:       45 * 60 * 1000,
        durationMs:   90 * 60 * 1000,
        tailMs:   3 * 60 * 60 * 1000
      }
    },
    contributions: {
      cerebellumPrecision:  -0.60,  // motor coordination crippled
      cortexSpeed:          -0.30,
      prefrontalExecutive:  -0.50,  // disinhibition
      amygdalaValence:      +0.20,  // initial warmth
      amygdalaFear:         -0.30,  // liquid courage
      oscillationCoherence: +0.20,  // slow-wave amplification
      hippocampusConsolidation: -0.40, // blackout risk at cumulative high BAC
      impulsivity:          +0.30
    },
    speech: {
      inhibition:        -0.60,
      slur:              +0.70,
      coherence:         -0.30,
      speechRate:        -0.30,
      emotionalOverflow: +0.50,   // drunken confessions
      freeAssocWidth:    +0.15
    },
    lifeGate: 'grade8'   // first drink at age 13 per biographical draft
  },

  ketamine: {
    displayName: 'K',
    defaultRoute: 'insufflated',
    routes: {
      insufflated: {
        onsetMs:      10 * 60 * 1000,
        peakMs:       25 * 60 * 1000,
        durationMs:   60 * 60 * 1000,
        tailMs:   2 * 60 * 60 * 1000
      }
    },
    contributions: {
      dissociation:         +0.70,
      cortexSpeed:          -0.40,
      crossRegionAmplify:   -0.30,  // recurrent blocked at NMDA sites
      somatosensoryBoost:   -0.50,  // body numbness
      cerebellumPrecision:  -0.40,
      amygdalaFear:         -0.30
    },
    speech: {
      inhibition:   -0.20,
      slur:         +0.40,
      coherence:    -0.40,
      speechRate:   -0.40,
      dissociation: +0.70,
      ethereality:  +0.30
    },
    lifeGate: 'college1'  // first K at age 18 (dorm/rave scene)
  },

  amphetamine: {
    displayName: 'speed',
    defaultRoute: 'oral',
    routes: {
      oral: {
        onsetMs:      45 * 60 * 1000,
        peakMs:   3 * 60 * 60 * 1000,
        durationMs:6 * 60 * 60 * 1000,
        tailMs:   12 * 60 * 60 * 1000
      },
      insufflated: {
        onsetMs:      15 * 60 * 1000,
        peakMs:    90 * 60 * 1000,
        durationMs:4 * 60 * 60 * 1000,
        tailMs:    8 * 60 * 60 * 1000
      }
    },
    contributions: {
      cortexSpeed:         +0.50,
      arousal:             +0.45,
      hypothalamusArousal: +0.50,
      amygdalaReward:      +0.40,
      impulsivity:         +0.25,
      prefrontalExecutive: +0.30
    },
    speech: {
      inhibition:  -0.10,
      speechRate:  +0.40,
      paranoiaBias:+0.10,
      coherence:   -0.03
    },
    lifeGate: 'grade10'  // first speed at age 15 (escalation per Life track)
  },

  ghb: {
    displayName: 'G',
    defaultRoute: 'oral',
    routes: {
      oral: {
        onsetMs:      20 * 60 * 1000,
        peakMs:       60 * 60 * 1000,
        durationMs:   2 * 60 * 60 * 1000,
        tailMs:   4 * 60 * 60 * 1000
      }
    },
    contributions: {
      cortexSpeed:          -0.30,
      prefrontalExecutive:  -0.40,
      amygdalaValence:      +0.30,
      oscillationCoherence: +0.30,
      cerebellumPrecision:  -0.30,
      socialNeed:           +0.20
    },
    speech: {
      inhibition:        -0.40,
      slur:              +0.30,
      coherence:         -0.20,
      speechRate:        -0.20,
      emotionalOverflow: +0.20
    },
    lifeGate: 'college1'
  }

};

// ─── Combo synergy table ──────────────────────────────────────────────────
// T15.C per docs/T15-architecture.md §1.1. Keyed by alphabetically-sorted
// pair of substance names joined by '+'. Each entry defines synergy
// contributions on brain-param axes (added to the per-substance sum scaled
// by min(level_a, level_b)), synergy speech deltas (same scaling),
// and risk flags (physicalStrain, persistsMs) consumed by snapshot() +
// decision engine.
//
// Seven entries match T15.A §2 research. Research rationale per entry
// captured in docs/T15-pharmacology-research.md §2.1-2.7.
const COMBOS = {
  'cannabis+cocaine': {
    displayName: 'coke-and-weed',
    synergyContributions: {
      creativity:              +0.30,
      hippocampusConsolidation:-0.15,
      impulsivity:             +0.05,
    },
    synergySpeech: {
      coherence: +0.05,
      giggleBias:+0.10,
    },
    riskFlags: { physicalStrain: +0.20, persistsMs: 4 * 60 * 60 * 1000 },
  },
  'cocaine+mdma': {
    displayName: 'cokes-with-mols',
    synergyContributions: {
      arousal:          +0.20,  // stacks toward ceiling
      amygdalaValence:  +0.25,
      focusWidth:       -0.10,
    },
    synergySpeech: {
      interruptionBias: +0.40,
      freeAssocWidth:   +0.30,
      warmth:           +0.20,
    },
    riskFlags: { physicalStrain: +0.40, persistsMs: 6 * 60 * 60 * 1000 },
  },
  'caffeine+cocaine': {
    displayName: 'double-stim',
    synergyContributions: {
      focusWidth:          -0.20,
      cerebellumPrecision: -0.20,
    },
    synergySpeech: {
      rate: +0.10,
      interruptionBias: +0.10,
    },
    riskFlags: { physicalStrain: +0.30, persistsMs: 12 * 60 * 60 * 1000 },
  },
  'alcohol+cannabis': {
    displayName: 'cross-faded',
    synergyContributions: {
      amygdalaValence:          +0.20,   // early — flips negative in tail
      hippocampusConsolidation: -0.30,   // blackout-risk stack
      cerebellumPrecision:      -0.15,
    },
    synergySpeech: {
      slurring:  +0.10,
      coherence: -0.15,
    },
    riskFlags: { physicalStrain: +0.15, persistsMs: 3 * 60 * 60 * 1000 },
  },
  'cannabis+mdma': {
    displayName: 'rolling-and-green',
    synergyContributions: {
      amygdalaValence: +0.15,
      // empathy +0.20 would live here if empathy were a primary axis
    },
    synergySpeech: {
      pauses:    +0.20,
      giggleBias:+0.30,
      warmth:    +0.15,
    },
    riskFlags: { physicalStrain: +0.05, persistsMs: 2 * 60 * 60 * 1000 },
  },
  'cannabis+ketamine': {
    displayName: 'k-hole-plus',
    synergyContributions: {
      // ego dissolution, detachment as composite axes — driven through
      // dissociation field in speech layer rather than a new primary axis
      cerebellumPrecision: -0.30,
    },
    synergySpeech: {
      dissociation: +0.40,
      pauses:       +0.40,
      coherence:    -0.20,
    },
    riskFlags: { physicalStrain: +0.60, persistsMs: 2 * 60 * 60 * 1000 },
  },
  'alcohol+cocaine': {
    displayName: 'speedball-lite',   // cocaethylene metabolite — cardiotoxic
    synergyContributions: {
      impulsivity:              +0.30,
      hippocampusConsolidation: -0.30,
    },
    synergySpeech: {
      volume:          +0.10,
      interruptionBias:+0.20,
    },
    riskFlags: { physicalStrain: +0.60, persistsMs: 8 * 60 * 60 * 1000 },
  },
};

// T15.C helper — order-independent combo key lookup.
function comboKey(a, b) {
  return a < b ? `${a}+${b}` : `${b}+${a}`;
}

// ─── Pharmacokinetic curve ────────────────────────────────────────────────
// Normalized [0, dose] level at time t since ingestion start.
// Four phases: onset (sigmoid ramp), peak (plateau with mild decay), duration
// (descent), tail (exponential decay to 0). Real PK curves are bi-exponential
// — this approximation captures the subjective shape accurately enough for
// brain-param modulation without pretending to be a quantitative clinical model.

function pkCurve(tMs, profile, dose = 1.0) {
  const { onsetMs, peakMs, durationMs, tailMs } = profile;
  if (tMs < 0) return 0;
  if (tMs < onsetMs) {
    // Sigmoid ramp: 0 → dose across onsetMs
    const x = (tMs / onsetMs) * 12 - 6;  // [-6, 6] sigmoid range
    return dose * sigmoid(x);
  }
  if (tMs < peakMs) {
    // Peak plateau with slight drift (5% drop across plateau)
    const progress = (tMs - onsetMs) / (peakMs - onsetMs);
    return dose * (1.0 - 0.05 * progress);
  }
  if (tMs < durationMs) {
    // Linear descent from 0.95 at peakMs end to 0.40 at durationMs end
    const progress = (tMs - peakMs) / (durationMs - peakMs);
    return dose * (0.95 - 0.55 * progress);
  }
  if (tMs < tailMs) {
    // Exponential decay in the tail
    const progress = (tMs - durationMs) / (tailMs - durationMs);
    return dose * 0.40 * Math.exp(-3 * progress);
  }
  return 0;
}

function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

// ─── DrugScheduler class ──────────────────────────────────────────────────

class DrugScheduler {
  /**
   * @param {object} opts
   * @param {object} [opts.cluster] - NeuronCluster for reading grades.life
   * @param {function} [opts.nowFn] - Override clock (for replay/testing). Default: Date.now
   */
  constructor(opts = {}) {
    this.cluster = opts.cluster || null;
    this.nowFn = opts.nowFn || (() => Date.now());
    // Map<substanceName, DoseEvent[]> — overlapping doses stack via superposition
    this.events = new Map();
    // Map<substanceName, toleranceLevel [0, 0.7]> — reduces effective dose on redose
    this.toleranceFactors = new Map();
    // Last tolerance decay time (inter-session recovery)
    this._lastDecayAt = this.nowFn();
    // Pending acquisitions Unity is waiting on (social simulation — T15.B.3)
    // Map<substanceName, {requestedAt, source, status}>
    this.pendingAcquisitions = new Map();
    // T15.C sensory-trigger intake — Map<substance, {delta, expiresAt}>.
    // Populated by drug-sensory-triggers.js when an environmental cue
    // fires (coffee smell → caffeine craving, etc.). decide() reads
    // currentCraving(substance) as a probability modifier.
    this.pendingDesires = new Map();
  }

  setCluster(cluster) { this.cluster = cluster; }

  // ─── Availability (grade-gate) ──────────────────────────────────────────
  isAvailable(substance) {
    const sub = SUBSTANCES[substance];
    if (!sub) return false;
    if (!this.cluster || !this.cluster.grades) return false;
    const lifeGrade = this.cluster.grades.life || 'pre-K';
    return gradeAtLeast(lifeGrade, sub.lifeGate);
  }

  availableSubstances() {
    const out = [];
    for (const name of Object.keys(SUBSTANCES)) {
      if (this.isAvailable(name)) out.push(name);
    }
    return out;
  }

  // ─── Ingestion ──────────────────────────────────────────────────────────
  /**
   * Record an ingestion event. Non-announcing — caller layer produces the
   * physical-act dialogue; scheduler just tracks the pharmacology.
   *
   * @returns {{accepted: boolean, reason?: string, event?: object, currentGrade?: string, requiredGrade?: string}}
   */
  ingest(substance, opts = {}) {
    const sub = SUBSTANCES[substance];
    if (!sub) {
      return { accepted: false, reason: 'unknown_substance' };
    }
    if (!this.isAvailable(substance)) {
      return {
        accepted: false,
        reason: 'grade_locked',
        currentGrade: this.cluster?.grades?.life || 'pre-K',
        requiredGrade: sub.lifeGate
      };
    }
    const route = opts.route || sub.defaultRoute;
    const profile = sub.routes[route];
    if (!profile) {
      return { accepted: false, reason: 'unknown_route' };
    }
    const now = opts.now ?? this.nowFn();
    this._decayTolerance(now);
    const tol = this.toleranceFactors.get(substance) || 0;
    const requestedDose = typeof opts.dose === 'number' ? opts.dose : 1.0;
    const effectiveDose = requestedDose * (1 - tol * 0.5);

    const event = {
      substance,
      route,
      dose: effectiveDose,
      requestedDose,
      startTime: now,
      onsetMs:    profile.onsetMs,
      peakMs:     profile.peakMs,
      durationMs: profile.durationMs,
      tailMs:     profile.tailMs
    };

    if (!this.events.has(substance)) this.events.set(substance, []);
    this.events.get(substance).push(event);

    // Intra-session tolerance bump — capped so even fiends don't zero out
    this.toleranceFactors.set(substance, Math.min(0.7, tol + 0.1));

    return { accepted: true, event };
  }

  // ─── Level readers ──────────────────────────────────────────────────────
  level(substance, now = this.nowFn()) {
    const events = this.events.get(substance);
    if (!events || events.length === 0) return 0;
    let total = 0;
    for (const e of events) {
      total += pkCurve(now - e.startTime, e, e.dose);
    }
    return Math.min(1, total);
  }

  phase(substance, now = this.nowFn()) {
    const events = this.events.get(substance);
    if (!events || events.length === 0) return 'sober';
    // Report the most recent event's phase (dominant narrative signal)
    const last = events[events.length - 1];
    const t = now - last.startTime;
    if (t < 0) return 'pending';
    if (t < last.onsetMs)    return 'onset';
    if (t < last.peakMs)     return 'peak';
    if (t < last.durationMs) return 'plateau';
    if (t < last.tailMs)     return 'tail';
    return 'sober';
  }

  activeSubstances(now = this.nowFn()) {
    const out = [];
    for (const name of this.events.keys()) {
      const level = this.level(name, now);
      if (level > 0.01) {
        out.push({ substance: name, level, phase: this.phase(name, now) });
      }
    }
    return out;
  }

  isSober(now = this.nowFn()) {
    return this.activeSubstances(now).length === 0;
  }

  // ─── Aggregated brain parameter contributions ──────────────────────────
  /**
   * Returns delta object to ADD to baseline brainParams.
   * Multiple substances stack additively via superposition.
   * Sober brain → empty delta → zero modulation → baseline persona.
   *
   * T15.C — combo-aware. Pairwise over active substances: if a combo
   * entry exists for the pair, its synergy contributions add on top of
   * the per-substance sum, scaled by `min(level_a, level_b)` (synergy
   * requires both substances active; fades with the weaker one).
   */
  activeContributions(now = this.nowFn()) {
    const delta = {};
    const active = this.activeSubstances(now);

    // (1) Per-substance additive contributions
    for (const { substance, level } of active) {
      const contribs = SUBSTANCES[substance].contributions || {};
      for (const [key, value] of Object.entries(contribs)) {
        delta[key] = (delta[key] || 0) + value * level;
      }
    }

    // (2) Pairwise combo synergies
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const combo = COMBOS[comboKey(active[i].substance, active[j].substance)];
        if (!combo || !combo.synergyContributions) continue;
        const scale = Math.min(active[i].level, active[j].level);
        for (const [k, v] of Object.entries(combo.synergyContributions)) {
          delta[k] = (delta[k] || 0) + v * scale;
        }
      }
    }

    return delta;
  }

  /**
   * T15.C — aggregate combo risk flags active right now. Snapshot()
   * exposes this so UI can render warning badges (cardiac load,
   * hepatic strain, etc.) without the consumer needing to re-walk
   * active pairs.
   */
  riskFlags(now = this.nowFn()) {
    const flags = {};
    const active = this.activeSubstances(now);
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const combo = COMBOS[comboKey(active[i].substance, active[j].substance)];
        if (!combo || !combo.riskFlags) continue;
        const scale = Math.min(active[i].level, active[j].level);
        for (const [k, v] of Object.entries(combo.riskFlags)) {
          if (k === 'persistsMs') continue;  // metadata, not a flag value
          flags[k] = (flags[k] || 0) + v * scale;
        }
      }
    }
    return flags;
  }

  /**
   * T15.C — sensory-trigger intake. drug-sensory-triggers.js calls
   * this when an environmental cue fires (T15.A §4 triggers). Craving
   * stacks additively with an existing pending craving, clamped [0, 1],
   * expires after durationMs.
   */
  addCraving(substance, delta, durationMs) {
    const now = this.nowFn();
    const existing = this.pendingDesires.get(substance);
    const newDelta = Math.max(0, Math.min(1, (existing?.delta || 0) + delta));
    const newExpires = Math.max(existing?.expiresAt || 0, now + durationMs);
    this.pendingDesires.set(substance, { delta: newDelta, expiresAt: newExpires });
  }

  /**
   * T15.C — read current craving level for a substance. Returns 0 if
   * no craving OR if the craving has expired (lazy eviction; expired
   * entry is removed on access). Decision engine uses this as one of
   * the probability modifiers in decide().
   */
  currentCraving(substance) {
    const c = this.pendingDesires.get(substance);
    if (!c) return 0;
    if (this.nowFn() > c.expiresAt) {
      this.pendingDesires.delete(substance);
      return 0;
    }
    return c.delta;
  }

  // ─── Speech modulation ─────────────────────────────────────────────────
  /**
   * Returns speech distortion vector consumed by language cortex + renderer.
   * See T15.A.5b for the dimension definitions. cosmicBiasVec is left null
   * here — the language cortex looks up the actual GloVe-space vector when
   * ethereality is non-zero, because that requires dictionary access the
   * scheduler deliberately doesn't hold.
   */
  speechModulation(now = this.nowFn()) {
    // T15.C — 13-axis modulation per docs/T15-architecture.md §2.3.
    // The 9 original axes stay; 4 new axes added (warmth, profoundBias,
    // interruptionBias, repetition, volume, confessionalBias land in
    // research T15.A §6; pauses, rate already ran under different
    // legacy names — speechRate, emotionalOverflow). Kept legacy names
    // to avoid churning language-cortex consumers that read them
    // today; new names land alongside and language-cortex upgrades
    // to read them in T15.C.7.
    const mod = {
      // ── 9 pre-existing axes (stable for language-cortex consumers) ──
      inhibition:        0,
      slur:              0,
      coherence:         0,
      ethereality:       0,
      freeAssocWidth:    0,
      speechRate:        0,
      emotionalOverflow: 0,
      dissociation:      0,
      paranoiaBias:      0,
      giggleBias:        0,
      // ── T15.C new axes (language cortex reads in T15.C.7) ──
      warmth:            0,
      profoundBias:      0,
      interruptionBias:  0,
      repetition:        0,
      volume:            0,
      confessionalBias:  0,
      rate:              0,   // new name for speechRate — both populated below
      slurring:          0,   // new name for slur — both populated below
      pauses:            0,
      // Vector fields populated by language cortex when their scalar
      // counterpart is non-zero. Left null here.
      cosmicBiasVec:     null,
      paranoiaBiasVec:   null,
      giggleBiasVec:     null,
    };

    const active = this.activeSubstances(now);

    // (1) Per-substance additive deltas. Alias old→new so research
    // tables in SUBSTANCES using the new field names (rate, slurring,
    // pauses) also populate the legacy fields (speechRate, slur)
    // consumers read today.
    const ALIASES = { rate: 'speechRate', slurring: 'slur' };
    for (const { substance, level } of active) {
      const speech = SUBSTANCES[substance].speech || {};
      for (const [key, value] of Object.entries(speech)) {
        if (mod[key] !== undefined && typeof mod[key] === 'number') {
          mod[key] += value * level;
        }
        const aliasKey = ALIASES[key];
        if (aliasKey && mod[aliasKey] !== undefined) {
          mod[aliasKey] += value * level;
        }
      }
    }

    // (2) Pairwise combo synergies — same scaling rule as
    // activeContributions. Synergy requires both substances active;
    // fades with the weaker one.
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const combo = COMBOS[comboKey(active[i].substance, active[j].substance)];
        if (!combo || !combo.synergySpeech) continue;
        const scale = Math.min(active[i].level, active[j].level);
        for (const [key, value] of Object.entries(combo.synergySpeech)) {
          if (mod[key] !== undefined && typeof mod[key] === 'number') {
            mod[key] += value * scale;
          }
          const aliasKey = ALIASES[key];
          if (aliasKey && mod[aliasKey] !== undefined) {
            mod[aliasKey] += value * scale;
          }
        }
      }
    }

    return mod;
  }

  // ─── Snapshot for UI broadcast ──────────────────────────────────────────
  /**
   * Compact state suitable for WebSocket broadcast + UI consumption.
   * Replaces the legacy `drugState: string` single-label field.
   */
  snapshot(now = this.nowFn()) {
    const active = this.activeSubstances(now);
    // T15.C — also surface active combo badges so UI can render
    // "coke-and-weed" / "cross-faded" / etc. alongside the per-
    // substance list. Combo detection via pairwise iteration over
    // active — cheap (N is small, usually <= 3).
    const combos = [];
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const combo = COMBOS[comboKey(active[i].substance, active[j].substance)];
        if (!combo) continue;
        combos.push({
          key: comboKey(active[i].substance, active[j].substance),
          displayName: combo.displayName,
          level: Math.min(active[i].level, active[j].level),
        });
      }
    }
    // Filter expired cravings lazily.
    const desires = [];
    for (const [substance, info] of this.pendingDesires) {
      if (now > info.expiresAt) continue;
      desires.push({ substance, delta: info.delta, expiresAt: info.expiresAt });
    }
    return {
      sober: active.length === 0,
      active: active.map(a => ({
        substance: a.substance,
        displayName: SUBSTANCES[a.substance]?.displayName || a.substance,
        level: a.level,
        phase: a.phase
      })),
      combos,
      riskFlags: this.riskFlags(now),
      pendingDesires: desires,
      pendingAcquisitions: Array.from(this.pendingAcquisitions.entries()).map(
        ([substance, info]) => ({ substance, ...info })
      ),
      gradeLocked: !this.cluster || !this.cluster.grades
    };
  }

  // ─── Pending acquisitions (simulated social acquisition per T15.B.3) ───
  registerPendingAcquisition(substance, source = 'dealer') {
    this.pendingAcquisitions.set(substance, {
      requestedAt: this.nowFn(),
      source,
      status: 'pending'
    });
  }

  resolvePendingAcquisition(substance, outcome, opts = {}) {
    const pending = this.pendingAcquisitions.get(substance);
    if (!pending) return { resolved: false };
    this.pendingAcquisitions.delete(substance);
    if (outcome === 'arrived') {
      return { resolved: true, ingestionResult: this.ingest(substance, opts) };
    }
    return { resolved: true, dropped: true };
  }

  // ─── Housekeeping ──────────────────────────────────────────────────────
  clearExpired(now = this.nowFn()) {
    for (const [substance, events] of this.events) {
      const alive = events.filter(e => (now - e.startTime) < e.tailMs);
      if (alive.length === 0) {
        this.events.delete(substance);
      } else if (alive.length !== events.length) {
        this.events.set(substance, alive);
      }
    }
    this._decayTolerance(now);
  }

  _decayTolerance(now) {
    // Tolerance recovers ~50% per hour of real time (inter-session recovery
    // happens in load() when wall clock has jumped; intra-session this is
    // gentle so redosing within a session still blunts effect).
    const elapsed = now - this._lastDecayAt;
    if (elapsed < 60 * 1000) return;  // only tick once per minute
    const hours = elapsed / (60 * 60 * 1000);
    const decayFactor = Math.pow(0.5, hours);
    for (const [substance, tol] of this.toleranceFactors) {
      const nt = tol * decayFactor;
      if (nt < 0.01) this.toleranceFactors.delete(substance);
      else this.toleranceFactors.set(substance, nt);
    }
    this._lastDecayAt = now;
  }

  // ─── Persistence ───────────────────────────────────────────────────────
  //
  // Version history:
  //   1 — initial schema (events, toleranceFactors, pendingAcquisitions,
  //       lastDecayAt). Shipped with 9-substance pharmacology.
  //   2 — T15.C adds pendingDesires (sensory-trigger craving intake).
  //       Loader accepts v1 saves and upgrades them in place (v1 had
  //       no cravings — empty Map is the correct upgrade).
  serialize() {
    const out = {
      version: 2,
      events: {},
      toleranceFactors: {},
      pendingAcquisitions: {},
      pendingDesires: {},
      lastDecayAt: this._lastDecayAt
    };
    for (const [s, events] of this.events) {
      out.events[s] = events.map(e => ({ ...e }));
    }
    for (const [s, t] of this.toleranceFactors) {
      out.toleranceFactors[s] = t;
    }
    for (const [s, info] of this.pendingAcquisitions) {
      out.pendingAcquisitions[s] = { ...info };
    }
    for (const [s, info] of this.pendingDesires) {
      out.pendingDesires[s] = { ...info };
    }
    return out;
  }

  load(obj) {
    if (!obj) return;
    // Accept v1 or v2; older/unknown versions ignored.
    if (obj.version !== 1 && obj.version !== 2) return;
    this.events.clear();
    this.toleranceFactors.clear();
    this.pendingAcquisitions.clear();
    this.pendingDesires.clear();
    if (obj.events) {
      for (const [s, events] of Object.entries(obj.events)) {
        this.events.set(s, events);
      }
    }
    if (obj.toleranceFactors) {
      for (const [s, t] of Object.entries(obj.toleranceFactors)) {
        this.toleranceFactors.set(s, t);
      }
    }
    if (obj.pendingAcquisitions) {
      for (const [s, info] of Object.entries(obj.pendingAcquisitions)) {
        this.pendingAcquisitions.set(s, info);
      }
    }
    // v2-only field. v1 saves skip this block (pendingDesires stays
    // empty, which is the correct upgrade — no prior craving state).
    if (obj.pendingDesires) {
      for (const [s, info] of Object.entries(obj.pendingDesires)) {
        this.pendingDesires.set(s, info);
      }
    }
    this._lastDecayAt = obj.lastDecayAt || this.nowFn();
    // Immediately decay tolerance based on wall-clock gap since save
    this._decayTolerance(this.nowFn());
    // Drop events whose entire tail has already expired
    this.clearExpired(this.nowFn());
  }
}

export { DrugScheduler, SUBSTANCES, COMBOS, GRADE_ORDER, gradeIndex, gradeAtLeast, pkCurve, comboKey };
export default DrugScheduler;
