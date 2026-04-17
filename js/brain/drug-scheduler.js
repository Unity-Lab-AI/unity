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
   */
  activeContributions(now = this.nowFn()) {
    const delta = {};
    for (const { substance, level } of this.activeSubstances(now)) {
      const contribs = SUBSTANCES[substance].contributions || {};
      for (const [key, value] of Object.entries(contribs)) {
        delta[key] = (delta[key] || 0) + value * level;
      }
    }
    return delta;
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
    const mod = {
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
      cosmicBiasVec:     null,  // language cortex fills when ethereality > 0
      paranoiaBiasVec:   null,  // filled when paranoiaBias > 0
      giggleBiasVec:     null   // filled when giggleBias > 0
    };
    for (const { substance, level } of this.activeSubstances(now)) {
      const speech = SUBSTANCES[substance].speech || {};
      for (const [key, value] of Object.entries(speech)) {
        if (mod[key] !== undefined && typeof mod[key] === 'number') {
          mod[key] += value * level;
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
    return {
      sober: active.length === 0,
      active: active.map(a => ({
        substance: a.substance,
        displayName: SUBSTANCES[a.substance]?.displayName || a.substance,
        level: a.level,
        phase: a.phase
      })),
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
  serialize() {
    const out = {
      version: 1,
      events: {},
      toleranceFactors: {},
      pendingAcquisitions: {},
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
    return out;
  }

  load(obj) {
    if (!obj || obj.version !== 1) return;
    this.events.clear();
    this.toleranceFactors.clear();
    this.pendingAcquisitions.clear();
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
    this._lastDecayAt = obj.lastDecayAt || this.nowFn();
    // Immediately decay tolerance based on wall-clock gap since save
    this._decayTolerance(this.nowFn());
    // Drop events whose entire tail has already expired
    this.clearExpired(this.nowFn());
  }
}

export { DrugScheduler, SUBSTANCES, GRADE_ORDER, gradeIndex, gradeAtLeast, pkCurve };
export default DrugScheduler;
