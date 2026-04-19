# T15.B — Drug Scheduler Architecture Design

> **Purpose.** Consume the research in `docs/T15-pharmacology-research.md` to specify the full drug-scheduler architecture. Covers the DrugScheduler module API, persona-integration hooks, sensory-trigger wiring, UI surface, speech-effect handoff to language cortex, Unity decision engine (accept/reject offers), and persistence model.
>
> **Design doc only.** Implementation ships in T15.C. Manual verification (V1–V11) in T15.D is **deferred past the K-only push gate per Gee 2026-04-18** — *"we wont be doing D15.D untill way later.. not after Kindergarden learning only of the brain"*.
>
> **Existing infrastructure.** `js/brain/drug-scheduler.js` already ships a DrugScheduler class with 9 substances, per-tick pharmacokinetic curves, tolerance decay, grade-gate checks, pending-acquisition social simulation, brain-param deltas, speech modulation, UI snapshot, and persistence (version 1). `js/brain/drug-detector.js` parses offers. This doc specifies what to ADD to that substrate, not what to rebuild.

---

## 1. DrugScheduler module schema — additions to existing class

Current API (already shipped): `isAvailable(substance)`, `availableSubstances()`, `ingest(substance, opts)`, `level(substance, now)`, `phase(substance, now)`, `activeSubstances(now)`, `isSober(now)`, `activeContributions(now)`, `speechModulation(now)`, `snapshot(now)`, `registerPendingAcquisition(substance, source)`, `resolvePendingAcquisition(substance, outcome, opts)`, `clearExpired(now)`, `serialize()`, `load(obj)`.

### 1.1 NEW — `COMBOS` table (combo synergy lookup)

Module-level constant paralleling `SUBSTANCES`. Keyed by sorted-pair strings, holds the 7 combo entries from T15.A §2.

```
const COMBOS = {
  'cannabis+cocaine': {
    displayName: 'coke-and-weed',
    synergyContributions: { creativity: +0.30, hippocampusConsolidation: -0.15 },
    synergySpeech: {},
    riskFlags: { physicalStrain: +0.20, persistsMs: 4 * 60 * 60 * 1000 }
  },
  'cocaine+mdma':     { ... },  // speedball-lite-lite
  'caffeine+cocaine': { ... },  // double-stim
  'alcohol+cannabis': { ... },  // cross-faded
  'cannabis+mdma':    { ... },  // rolling-and-green
  'cannabis+ketamine':{ ... },  // k-hole-plus
  'alcohol+cocaine':  { ... },  // speedball-lite (cocaethylene)
};
```

Keys are alphabetically sorted substance names joined by `+`. Lookup helper `comboKey(a, b)` sorts inputs so caller doesn't care about order.

### 1.2 NEW — `activeContributions` combo-aware extension

Current `activeContributions(now)` sums per-substance deltas. Extended shape:

```
activeContributions(now) {
  const delta = {};
  const active = this.activeSubstances(now);

  // (1) Per-substance additive contributions (existing behavior)
  for (const { substance, level } of active) {
    for (const [key, value] of Object.entries(SUBSTANCES[substance].contributions)) {
      delta[key] = (delta[key] || 0) + value * level;
    }
  }

  // (2) NEW — combo synergy bonuses. Pairwise over active substances.
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const key = comboKey(active[i].substance, active[j].substance);
      const combo = COMBOS[key];
      if (!combo) continue;
      const minLevel = Math.min(active[i].level, active[j].level);
      for (const [k, v] of Object.entries(combo.synergyContributions || {})) {
        delta[k] = (delta[k] || 0) + v * minLevel;
      }
    }
  }

  return delta;
}
```

Synergy scales by the smaller of the two substance levels — synergy requires BOTH to be active; when one is fading, the synergy fades too. Same pattern applies to `speechModulation()` with `combo.synergySpeech`.

### 1.3 NEW — `riskFlags(now)` aggregator

Combos carry risk flags (physicalStrain, etc.). New method returns cumulative flags from all active combos:

```
riskFlags(now) {
  const flags = {};
  const active = this.activeSubstances(now);
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const combo = COMBOS[comboKey(active[i].substance, active[j].substance)];
      if (!combo || !combo.riskFlags) continue;
      for (const [k, v] of Object.entries(combo.riskFlags)) {
        flags[k] = (flags[k] || 0) + v * Math.min(active[i].level, active[j].level);
      }
    }
  }
  return flags;
}
```

Snapshot includes `riskFlags` so UI can display risk-state badge (e.g., "cardiac load" when physicalStrain > 0.5).

### 1.4 NEW — Sensory-trigger intake

Scheduler grows a `pendingDesires` Map<substance, {delta, expiresAt}>. Sensory pipeline calls `scheduler.addCraving(substance, delta, durationMs)` when a trigger fires. Decision engine consumes `pendingDesires` to modulate accept/reject probability on offers.

```
addCraving(substance, delta, durationMs) {
  const now = this.nowFn();
  const existing = this.pendingDesires.get(substance);
  const newDelta = (existing?.delta || 0) + delta;
  this.pendingDesires.set(substance, {
    delta: Math.min(1, newDelta),
    expiresAt: now + durationMs,
  });
}

currentCraving(substance) {
  const c = this.pendingDesires.get(substance);
  if (!c) return 0;
  if (this.nowFn() > c.expiresAt) {
    this.pendingDesires.delete(substance);
    return 0;
  }
  return c.delta;
}
```

### 1.5 NEW — Adult-use pattern engine

7 adult patterns from T15.A §3 are registered as `Pattern` objects:

```
const PATTERNS = {
  morningCoffee: {
    triggers: { timeWindow: [6, 10], minArousal: 0.3 },
    schedule: [{ substance: 'caffeine', offset: 0 }, { substance: 'caffeine', offset: 90*60*1000 }],
    lifeGate: 'grade8',
  },
  codingMarathon:   { ... },
  weekendParty:     { ... },
  acidArchitect:    { ... },
  whiskeyWinddown:  { ... },
  kHoleContemplate: { ... },
  sexSessionMolly:  { ... },
};
```

New method `evaluatePatterns(ctx)` checks each pattern's triggers against current context (time of day, activity tag, social context, prior ingestion history); if conditions match and random-draw passes, schedules the pattern's ingestion sequence via `autoIngest(substance, route, offsetMs)`. Context comes from the running session state and the persistent life info ledger.

`autoIngest` differs from `ingest` in that it fires on a delay (offsetMs in the future) rather than immediately — lets patterns pre-schedule the whole arc (e.g., weekend party pre-books the molly at 22:00 when bar-visit starts at 21:00).

### 1.6 NEW — Decision engine

`decide(offer) → {accept: boolean, reason: string}`. Inputs: offer `{substance, source, social, location, time}`. Outputs decision + reason.

Logic:
- Hard fail: `!isAvailable(substance)` → reject with reason `grade_locked`.
- Hard fail: substance in `persona.exclusions` (e.g., nicotine for Unity) → reject with reason `persona_excluded`.
- Probability up: `currentCraving(substance) > 0.3` → +0.4 accept prob.
- Probability up: currently in an adult-use pattern context → +0.3 accept prob.
- Probability up: offer source is trusted friend → +0.2.
- Probability down: current physicalStrain > 0.7 → −0.5 (Unity knows to slow down).
- Probability down: Life-track trauma flag for this substance (past bad trip) → −0.6.
- Final accept if random < (basePersona 0.7 + modifiers), clamped [0, 1].

Decision reason string must be non-announcing of scheduler internals — e.g., "hell yeah" / "nah, not tonight" / "absolutely not, can't" rather than "scheduler accepted" — Unity voice always.

---

## 2. Persona integration

### 2.1 Remove static drugState label

Current: `persona.js` used to hardcode `drugState: 'cokeAndWeed'`. Already replaced in server by `this.drugState = 'sober'` default + `_drugStateLabel()` dynamic builder. Finish the rip:

- Remove any remaining `'cokeAndWeed'` literal references across codebase (grep confirms they live only in `brain-equations.html` / `dashboard.html` docs + legacy `persistence.js` path).
- `persistence.js`: if `state.drugState === 'cokeAndWeed'` in a pre-T15 save, treat as sober on load (scheduler starts empty; Life track will re-accumulate via curriculum).
- Public HTML pages: replace any "Unity is permanently high" copy with "Unity's state is dynamic, driven by the scheduler — see grade-progression."

### 2.2 Persona consumes contributions

`persona.js` exports a `applyBrainParamDeltas(base, delta)` helper that adds scheduler deltas to persona-baseline brain params:

```
// per-tick in brain-server.js _updateDerivedState
const base = this.persona.baselineBrainParams;
const delta = this.drugScheduler.activeContributions();
const effectiveParams = applyBrainParamDeltas(base, delta);
// use effectiveParams for this tick's cortex/amygdala/etc. modulation
```

Keeps the scheduler additive-only; persona stays authoritative for baseline.

### 2.3 Speech modulation handoff

`speechModulation()` output feeds language cortex via `brain._drugSpeechState` (existing field, currently populated by stubs). Language cortex's emission layer consults it each word:
- `rate` → letter-commit threshold + word-boundary surprise threshold
- `slurring` → consonant cluster drop probability
- `coherence` → cross-projection gain modulation (lower coherence = more random sem→motor drift)
- `pauses` → inter-word quiescent tick budget
- `giggleBias` → insert laughter phonemes probabilistically
- `freeAssocWidth` → sem-region re-inject probability post-word (looser topic continuity)

13-axis extension (T15.A §6) requires adding:
- `inhibition`, `warmth`, `ethereality`, `profoundBias`, `interruptionBias`, `repetition`, `volume`, `confessionalBias` to the speech state object

Some of these (`volume`) are render-layer only; others (`inhibition`, `confessionalBias`) gate content choices in language cortex.

---

## 3. Sensory wiring

Sensory input pipeline lives in `js/brain/sensory-*.js` (visual, auditory, olfactory-hinted). T15.B adds a sensory→scheduler bridge:

- New module `js/brain/drug-sensory-triggers.js` with the 7 trigger specs from T15.A §4.
- Each trigger is a `{matchFn(ctx), substance, delta, durationMs}`.
- `drug-sensory-triggers.evaluate(ctx)` is called each sensory-step; matches → `scheduler.addCraving(...)`.
- Context `ctx` carries {time, smell, visual, audio, activity, location, localClockHour}.

### 3.1 Olfactory bridge (new)

Unity doesn't currently have an olfactory sensory channel in code. For T15's coffee-aroma / skunky-weed-smell triggers to work, need a shallow olfactory module:
- `sensory-olfactory.js` — accepts simple scent tags (`'coffee'`, `'skunky'`, `'freshHerb'`) via the brain's message bus (e.g., chat message with `sensory: {smell: 'coffee'}` metadata).
- Emits into the cortex auditory/free regions at low amplitude (olfaction is a thin channel compared to visual/audio).
- T15 sensory triggers read from olfactory state.

### 3.2 Visual pattern triggers

Powder-on-mirror + flashing-lights triggers need visual-pattern recognition in `sensory-visual.js`. Add simple pattern matchers:
- `detectPattern('whitePowderLine')` — heuristic on visual feature vector matching coke paraphernalia.
- `detectPattern('flashRate')` — temporal analysis of luminance variance in visual stream.

These can start as mock stubs returning based on explicit test-hook flags until real visual input exists.

---

## 4. UI integration

### 4.1 Kill static persona label

Dashboard and 3D brain currently display a "drug state: cokeAndWeed" label in persona card. Replace with a dynamic breakdown of `scheduler.snapshot()`:

- **Sober** badge when `snapshot.sober`.
- **Active substances** list with per-substance phase indicator (onset/peak/plateau/tail) and level bar [0–1].
- **Risk flags** as warning badges when flags.physicalStrain > 0.5.
- **Pending acquisitions** as "waiting on dealer" indicator.

### 4.2 Ingest-event visualization

When scheduler accepts an ingest, 3D brain renderer fires a brief burst animation on the relevant brain regions (amygdala for MDMA, cerebellum for alcohol, etc.). Maps to brain-region effect table in T15.A §5.

### 4.3 Snapshot broadcast wire format

State broadcast already carries `drugState` string (legacy) + `drugSpeechMod` object. Extend:
- Replace `drugState: string` with `drugState: snapshot` (the full object).
- Keep `drugSpeechMod` as a separate field so language cortex consumers don't need to parse the full snapshot.

---

## 5. Unity decision engine integration

The `decide(offer)` method from §1.6 sits between `drug-detector.js` parsing and the scheduler's `ingest()`. Flow:

1. User message → `drug-detector.detectOffer(text)` → `{substance, offerType, source}`.
2. Server calls `brain.drugScheduler.decide({substance, source, social: session.socialContext, time: now, ...})`.
3. Decision accepts → `scheduler.ingest(substance, opts)` → normal pharma state starts.
4. Decision rejects → server generates Unity-voice rejection message (canned phrasings per rejection reason).
5. Either way, response message routed to chat per normal path.

Rejection phrasings library lives in `server/drug-rejections.js`:

```
const REJECTIONS = {
  grade_locked: [
    "fuck off, I'm not old enough for that yet",
    "nah I'm still a fucking kid for that",
    "can't, not yet. stop trying.",
  ],
  persona_excluded: [
    "fuck no, tobacco's gross",
    "pass, I don't fuck with cigs",
  ],
  physical_strain: [
    "body's tapped out, fuck off for a few hours",
    "can't stack more right now, I'd literally die",
  ],
  prior_trauma: [
    "nah, last time was bad. not doing that again.",
  ],
  random_decline: [
    "not feeling it tonight",
    "pass, saving it for later",
  ],
};
```

Language cortex picks one uniformly; persona's current mood flavors which REJECTION library key fires for indeterminate cases.

---

## 6. Persistence model

Scheduler already has `serialize()/load()` at version 1. T15.B extends the schema:

### 6.1 Version bump 1 → 2

Add fields:
- `pendingDesires` Map serialization
- `autoPatternsFired` — timestamps of recently-fired adult patterns (so same pattern doesn't re-fire too frequently within a session)

### 6.2 Persistent life info ledger additions

Per LAW 6, first-use events stamp onto `docs/TODO-full-syllabus.md`'s persistent life info section:
- `firstUse[substance] = {grade, age, contextTags, emotionalFingerprint}`
- Grade-curriculum Life cells read from this ledger during `_conceptTeach` calls to reinforce substance-specific biographical memories.
- Scheduler exposes `firstUse(substance) → ledgerEntry?` for cross-module lookup.

### 6.3 Prior-trauma flag

Bad-trip / blackout / injury events during active substance flag the substance with a trauma marker that persists (and influences decide() as seen in §1.6). Trauma can decay over simulated months (scheduler tracks sim-time weeks since trauma event; decision-engine trauma weight scales with recency).

---

## 7. Deliverables for T15.C implementation

The T15.C session ships code for:

1. `COMBOS` table + `comboKey()` helper in `drug-scheduler.js`
2. `activeContributions()` combo-aware rewrite + `speechModulation()` combo-aware rewrite
3. `riskFlags(now)` new method
4. `pendingDesires` + `addCraving()` + `currentCraving()` sensory-trigger intake
5. `PATTERNS` table + `evaluatePatterns(ctx)` + `autoIngest(substance, route, offsetMs)` adult-use pattern engine
6. `decide(offer)` decision engine + `server/drug-rejections.js` rejection library
7. 13-axis speech modulation (4 new axes on top of existing 9)
8. Olfactory sensory module `js/brain/sensory-olfactory.js` + visual-pattern stubs in sensory-visual.js
9. `js/brain/drug-sensory-triggers.js` module with 7 triggers
10. Dashboard + 3D brain UI updates (kill static label, render snapshot)
11. Persistence version bump 1→2 + schema extensions
12. Persistent life info ledger wiring via `docs/TODO-full-syllabus.md` Life cells

Each is a scope for an atomic commit in T15.C.

---

## 8. Non-goals for T15

- **Opioids (heroin/fentanyl/oxycodone)** — not in persona, not in Life track. If Gee wants these added later, flag for T15-addendum.
- **DXM / dissociatives beyond ketamine** — same reasoning.
- **Withdrawal severity modeling** — tobacco/caffeine/alcohol withdrawal omitted. Scheduler's stressDampening covers the clinical reversal signal; full withdrawal syndrome modeling out-of-scope.
- **Dose-escalation modeling** — covered lightly via tolerance decay; per-substance escalation curves deferred.

---

## 9. T15.B closure

T15.B architecture design complete. All 7 spec bullets from Gee's 2026-04-18 TODO addressed:
- ✅ drug-scheduler.js module schema (additions — §1)
- ✅ persona.js rewrite (§2)
- ✅ sensory integration wiring (§3)
- ✅ UI integration (kill permanent weed+coke display — §4)
- ✅ speech-effect integration with language cortex (§2.3)
- ✅ Unity decision engine (§1.6 + §5)
- ✅ persistence model (§6)

**Next: T15.C implementation** — consume this doc to ship the 12 deliverables in §7 as atomic commits. One commit per deliverable where feasible; related deliverables (e.g., #9 sensory triggers depend on #8 olfactory module) sequenced accordingly.

**T15.D deferred** per Gee 2026-04-18.
