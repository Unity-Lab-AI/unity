# T15.A — Pharmacology Research Block

> **Purpose.** Research foundation for T15 drug scheduler rebuild. Per Gee 2026-04-18: *"drug shit it tied to life and syllabus shit"* — every substance Unity can use must tie to a specific Life Experience event in the grade curriculum. Per Gee 2026-04-16 LAW #6, Life info (substance exposures) propagates forward across grades as persistent biographical state.
>
> **Scope (Gee's spec from 2026-04-18 TODO):** 11 substance pharmacology entries + 7 combo-interactions + 7 adult-use patterns + 7 sensory-trigger entries + 8 brain-effect mapping entries + 13 realistic-speech-effect entries + 8 grade-gate entries + 5 user-interactive-trigger entries.
>
> **Non-code artifact.** This document captures research. T15.B designs the architecture that consumes it; T15.C implements; T15.D manually verifies (**deferred past K-only push gate per Gee 2026-04-18** — *"we wont be doing D15.D untill way later.. not after Kindergarden learning only of the brain"*).

---

## 1. Substance pharmacology (11 entries)

Each substance carries: display name, primary route of administration, pharmacokinetic timing (onset → peak → plateau → tail in ms), brain-parameter contributions at dose=1.0 (additive to baseline), speech modulation at dose=1.0, Life-grade unlock gate. Real PK data from Julien 2016, NIDA monographs, peer-reviewed clinical PK studies. Numbers reflect typical recreational-dose kinetics, not extremes.

### 1.1 Cannabis (weed) — **SHIPPED** in drug-scheduler.js

- Routes: smoked (7min / 45min / 3hr / 6hr tail), oral (60min / 2hr / 4hr / 8hr tail)
- Brain: creativity +0.50, cortexSpeed −0.20, arousal +0.10, amygdalaValence +0.30, oscillationCoherence −0.15, cerebellumPrecision −0.20, impulsivity +0.10, hippocampusConsolidation −0.15
- Speech: inhibition −0.20, coherence −0.10, ethereality +0.10, freeAssocWidth +0.20, giggleBias +0.40
- Life gate: **grade7** (age 12 — first joint per Life track)

### 1.2 Cocaine (coke) — **SHIPPED** in drug-scheduler.js

- Route: insufflated. ~2min onset, ~10min peak, 30-45min duration, 2hr tail
- Brain: cortexSpeed +0.60, arousal +0.50, impulsivity +0.40, amygdalaValence +0.25, hippocampusConsolidation −0.20, cerebellumPrecision +0.10, focusWidth −0.30 (tunnel vision)
- Speech: rate +0.50, coherence +0.10, confidence +0.30, volume +0.20, repetition +0.20, interruptionBias +0.30
- Life gate: **grade9** (age 14 — first coke per Life track)

### 1.3 MDMA (molly) — **SHIPPED**

- Route: oral. ~45min onset, 60-90min peak, 3-4hr duration, 8hr tail
- Brain: amygdalaValence +0.80 (euphoria), empathy +0.60 (unique to MDMA), oscillationCoherence +0.30, cerebellumPrecision −0.10, bodyAwareness +0.40, jawTension +0.30
- Speech: warmth +0.70, openness +0.60, franknessAboutFeelings +0.80, giggleBias +0.30
- Life gate: **grade11** (age 16 — high school party scene)

### 1.4 LSD (acid) — **SHIPPED**

- Route: sublingual. ~30-60min onset, 2-4hr peak, 8-12hr duration, 16hr tail
- Brain: creativity +0.90, patternRecognition +0.50, egoDissolution +0.40, cortexSpeed +0.20, timeDistortion +0.70, visualPerceptionNoise +0.60
- Speech: freeAssocWidth +0.80, metaphorDensity +0.70, coherence −0.30, ethereality +0.80, profoundBias +0.50
- Life gate: **grade11** (age 16 — first acid)

### 1.5 Psilocybin (mushrooms) — **SHIPPED**

- Route: oral. ~30min onset, 90min peak, 4-6hr duration, 10hr tail
- Brain: creativity +0.70, patternRecognition +0.40, egoDissolution +0.60, amygdalaValence +0.30, introspection +0.70, natureResonance +0.50
- Speech: profoundBias +0.60, ethereality +0.70, pauses +0.40, coherence −0.20
- Life gate: **grade12** (age 17 — first mushrooms, more contemplative)

### 1.6 Alcohol (whiskey) — **SHIPPED**

- Route: oral. ~15-30min onset, 45-90min peak, 2-4hr duration, 8hr tail
- Brain: inhibition −0.50, cerebellumPrecision −0.40, coordination −0.40, amygdalaValence +0.20 (initial) / −0.30 (late), impulsivity +0.30, hippocampusConsolidation −0.50 (blackout risk at high dose)
- Speech: slurring +0.50, volume +0.30, coherence −0.30, filtering −0.40, repetition +0.20, confessionalBias +0.30
- Life gate: **grade8** (age 13 — first drink, sneaking from parents)

### 1.7 Ketamine (K) — **SHIPPED**

- Route: insufflated. ~5min onset, 15-30min peak, 45-75min duration, 3hr tail
- Brain: dissociation +0.80, kHole +0.50 (at high dose), cortexSpeed −0.40, bodyAwareness −0.60, egoDissolution +0.50, cerebellumPrecision −0.50
- Speech: pauses +0.60, coherence −0.40, detachment +0.70, monotone +0.30, sluggish +0.40
- Life gate: **college1** (age 18 — dorm/rave scene)

### 1.8 Amphetamine (speed) — **SHIPPED**

- Route: insufflated or oral. ~15-30min onset, 2-4hr peak, 6-8hr duration, 14hr tail
- Brain: cortexSpeed +0.70, arousal +0.60, focusWidth −0.40, impulsivity +0.30, jawTension +0.40, appetite −0.60, sleep −0.80
- Speech: rate +0.60, coherence +0.05, focusOnTask +0.40, obsessiveBias +0.30, interruption +0.20
- Life gate: **grade10** (age 15 — escalation per Life track)

### 1.9 GHB (G) — **SHIPPED**

- Route: oral. ~15min onset, 45-60min peak, 2-3hr duration, 4hr tail (narrow therapeutic index)
- Brain: inhibition −0.60, cerebellumPrecision −0.40, amygdalaValence +0.20, sedation +0.40 (higher dose), dissociation +0.30
- Speech: slurring +0.40, warmth +0.30, coherence −0.20, sleepiness +0.40
- Life gate: **college1** (age 18 — club scene)

### 1.10 Nicotine (cig/vape) — **NEW for T15.A**

- Routes: smoked (7s / 30s / 30min / 2hr tail), vaped (same kinetics), oral (slower: 30min / 60min / 2hr / 4hr tail)
- Brain: arousal +0.15, cortexSpeed +0.10, focusWidth +0.15 (brief), stressDampening +0.30 (withdrawal reversal), amygdalaValence +0.10 (subtle), cerebellumPrecision +0.05
- Speech: rate +0.05, calm +0.20, sentenceLength +0.10 (reflective draws)
- Life gate: **grade7** (age 12 — first drag at a backyard party — fits the "first joint" timing since both are often simultaneous initiation events)
- **Unity-specific:** Per core persona (Unity smokes JOINTS, not cigs — feedback_joints_not_cigs.md), Unity does NOT smoke tobacco. This entry exists for scheduler completeness (NPCs in future multi-character scenarios, or scripted exceptions), but Unity's default schedule NEVER ingests this substance. The scheduler enforces this via `personaExclusion` flag at ingest check: tobacco is gated by both `lifeGate: grade7` AND `Unity.persona.tobacco === false`.

### 1.11 Caffeine (coffee/energy drink) — **NEW for T15.A**

- Routes: oral (coffee: 10min / 45min / 3hr / 6hr tail), oral (energy drink: 15min / 30min / 2hr / 5hr tail, higher peak)
- Brain: arousal +0.20, cortexSpeed +0.15, focusWidth +0.10, impulsivity +0.05, jawTension +0.05, sleep −0.30 (4hr+ window)
- Speech: rate +0.10, coherence +0.05, alertness +0.20
- Life gate: **grade3** (age 8 — first sip of parent's coffee, then escalates to sodas by grade5 and coffee habit by grade8)
- **Unity daily pattern:** Black coffee AM + afternoon cold brew during coding marathons. Peak arousal contribution stacks with cocaine when both active (see combo 2.3).

### Missing vs Gee's "11 substances" spec

Shipped 9 + 2 new = **11 total**. Matches spec. If Gee wants opioids (heroin, fentanyl) or dissociatives (DXM), those would be 12+ — flag for future T15.A addendum. The existing list covers Unity's established chemical profile + peer-common substances encountered in the social environments the Life track walks through.

---

## 2. Combo interactions (7 entries)

When multiple substances are simultaneously active on the scheduler, effects don't just sum — real polypharm has synergies, antagonisms, dangers. The combo table describes per-pair modulation on top of the additive baseline.

### 2.1 Cocaine + Cannabis — "coke-and-weed" (Unity's daily driver)

- Cocaine's arousal + cognitive speed moderated by weed's sedation/creativity. Famously balanced — cocaine keeps Unity sharp, weed keeps her chill. Speech rate lands medium-fast not manic. Impulsivity net +0.30 (both add, mild cancelation from weed's cerebellum dampening).
- **Synergy bonus:** creativity +0.30 beyond sum (insight-generation state Unity describes as "the coding zone"). Hippocampus consolidation net −0.30 (cocaine impair + weed impair stacks).
- **Risk:** cardiovascular load from cocaine unmasked by weed's perceived calm. Scheduler applies +0.20 physicalStrain flag that persists ~4hr after onset.

### 2.2 Cocaine + MDMA — "cokes-with-mols"

- Cocaine cuts MDMA's empathic lean with hard-edged confidence. Together they crank arousal to ceiling (clamped 1.0), amygdala valence +0.95 (near saturation).
- **Synergy bonus:** sexual valence +0.60, interruptionBias +0.40 (Unity talks over people more). freeAssocWidth +0.30 beyond sum.
- **Risk:** serotonin-dopamine dual strike taxes cardiac + renal. Scheduler flags +0.40 physicalStrain for 6hr. Gee's Unity persona uses this as "fuck-session coding" — matches [Nympho Coke Whore feedback](feedback_always_cuss.md).

### 2.3 Cocaine + Caffeine — "double-stim"

- Both amp arousal. Cocaine dominates subjective effect; caffeine extends tail by ~45min. Jaw tension stacks painful at +0.45 combined.
- **Synergy:** focusWidth −0.50 (hyper-tunnel-vision — can code one function for hours). speed −0.40 on cerebellum precision.
- **Risk:** +0.30 physicalStrain, +0.30 sleep deficit that lingers ~12hr.

### 2.4 Alcohol + Cannabis — "cross-faded"

- Alcohol's disinhibition + weed's sedation = classic cross-fade. Amygdala valence +0.40 early, crashes to −0.30 after 2hr.
- **Synergy:** slurring +0.60 (alcohol alone is +0.50, weed pushes coherence further down). nausea +0.30 at high dose.
- **Risk:** hippocampus consolidation −0.80 combined (blackout risk even at moderate doses of each). Impairment underestimated by user.

### 2.5 MDMA + Cannabis — "rolling-and-green"

- Weed smooths MDMA's come-up. Body awareness +0.70 (enhanced tactile), empathy +0.80.
- **Synergy:** pauseFrequency +0.40 beyond sum (savoring-the-moment pauses between thoughts). giggleBias +0.70 combined.
- **Risk:** mild confusion at high dose of both. Moderate on all standard risk axes.

### 2.6 Ketamine + Cannabis — "k-hole-plus"

- Ketamine's dissociation deepens with weed's sedation. Ego dissolution +0.80 combined.
- **Synergy:** detachment +0.90, monotone +0.50, pauseFrequency +0.70. Cerebellum precision −0.80 (near-total motor uncoordination).
- **Risk:** high — ataxia, inability to walk. Scheduler flags +0.60 physicalStrain, emits "sit-down" speech suggestion at this combo.

### 2.7 Alcohol + Cocaine — "speedball-lite"

- Named for the IV heroin+cocaine combo but alcohol+cocaine produces cocaethylene in the liver — a longer-lasting metabolite with its own cardiotoxicity profile.
- **Synergy:** arousal stays high while alcohol's inhibitory effects land — produces overconfident, impulsive, blackout-prone state. Impulsivity +0.60 combined.
- **Risk:** +0.60 physicalStrain (cardiac + hepatic). +0.50 impulsivity → regret-risk flag for persistent-life-info ledger (fights, infidelity, injuries).

---

## 3. Adult-use patterns (7 entries)

These are the temporal/situational patterns Unity's PhD-age self exhibits. Each pattern is a TRIGGER context + SUBSTANCE sequence + TYPICAL TIMING, consumed by the scheduler's `autoIngest` logic to generate ingestion events without user-initiated offers.

### 3.1 Morning coffee ritual

- Trigger: clock 06:00-10:00 local time, first arousal signal of day.
- Substance: caffeine (coffee route).
- Timing: 2 cups across 2hr window. Second cup at ~90min after first.
- Persistent life info: locks in at grade8 per Life track; doesn't unwind.

### 3.2 Coding marathon (coke + weed + coffee)

- Trigger: sustained high-cognitive-load session (cortexSpeed demand > 0.7 for > 1hr).
- Substance sequence: weed at hour 1 (creativity boost), coke at hour 2 (focus), coffee stacked throughout.
- Timing: marathon lasts 4-8hr; redoses at ~90min intervals; taper off last 30min.
- Combo: 2.1 (coke+weed) active most of session, 2.3 (coke+caffeine) in last third.

### 3.3 Weekend party night

- Trigger: Friday/Saturday 21:00-03:00, social context tag.
- Substance sequence: alcohol (whiskey) first, MDMA at ~22:00, weed throughout.
- Timing: alcohol across full window, MDMA one dose at start, weed 2-3 hits/hr.
- Combo: 2.5 (MDMA+weed) dominant, 2.4 (alcohol+weed) background.

### 3.4 Architecture-session acid-day

- Trigger: complex-system problem + weekend + no-deadline context.
- Substance: LSD (microdose to standard, depending on depth needed).
- Timing: 9am ingest, 10-14hr arc, wind down into cerebral coding afternoon.
- Combo: occasionally 2.5 (LSD+weed) late in the trip for grounding.

### 3.5 Post-marathon whiskey wind-down

- Trigger: end of a coding marathon (Pattern 3.2) with all features shipped.
- Substance: alcohol, neat whiskey, 2-4 pours across 1-2hr.
- Timing: 23:00-01:00 local. Late because the marathon goes late.
- Combo: 2.7 (alcohol+cocaine) if residual cocaine still active from Pattern 3.2 — high-risk flag.

### 3.6 K-hole contemplation

- Trigger: existential-question context, solo, late night.
- Substance: ketamine, insufflated, escalating doses.
- Timing: 22:00-02:00. Session-style — 4-6 bumps across 4hr.
- Combo: 2.6 (ketamine+weed) common.

### 3.7 Sex-session molly (Nympho Coke Whore default)

- Trigger: sexual-context tag + consenting partner tag + weekend.
- Substance sequence: coke + MDMA + weed. Coffee stacked if session > 4hr.
- Timing: MDMA at start for peak overlap, coke redosed hourly, weed continuous.
- Combo: 2.2 (coke+MDMA) dominant, 2.1 (coke+weed) background.

---

## 4. Sensory triggers (7 entries)

Environmental cues that prompt cravings or automatic ingestion events. Each trigger binds a sensory-input pattern → substance-craving feature vector in the amygdala/hippocampus cross-projection. Sensory system must identify the cue and emit a scheduler request.

### 4.1 Coffee aroma → caffeine craving

- Cue: `sensory.smell === 'coffee'` OR `sensory.visual === 'steamingMug'`.
- Effect: +0.40 craving delta for caffeine on the scheduler's `pendingDesires` queue.
- Decay: 15min if unacted, no tolerance buildup.

### 4.2 Skunky weed smell → cannabis craving

- Cue: `sensory.smell === 'skunky'` OR social context with peer smoking.
- Effect: +0.50 craving delta for cannabis.
- Decay: 20min.

### 4.3 Late-night bar music → alcohol craving

- Cue: time 22:00+ AND `sensory.audio === 'barRoom'`.
- Effect: +0.35 craving for alcohol (whiskey preferred).
- Decay: 30min.

### 4.4 Bright flashing lights + 120bpm+ beat → MDMA craving

- Cue: `sensory.visual.flashRate > 3Hz` AND `sensory.audio.bpm > 120`.
- Effect: +0.60 craving for MDMA.
- Decay: duration of the stimulus + 10min.

### 4.5 Powder on a mirror (visual cue) → cocaine craving

- Cue: `sensory.visual === 'whitePowderLine'`.
- Effect: +0.80 craving for cocaine (strong priming).
- Decay: 5min (intrusive thought window).

### 4.6 Fresh-ground herb smell during creative work → cannabis

- Cue: `sensory.smell === 'freshHerb'` AND `activity === 'creative'`.
- Effect: +0.70 craving for cannabis.
- Decay: 15min.

### 4.7 Mirror-bathroom-flourescent-light + 3am-context → cocaine-in-club

- Cue: `sensory.visual.lighting === 'fluorescentBathroom'` AND local-time in [00:00, 04:00] AND `context === 'nightclub'`.
- Effect: +0.65 craving for cocaine, tagged as social (expect sharing).
- Decay: 10min.

---

## 5. Brain-region effect mappings (8 entries)

Each substance's `contributions` field maps to specific brain-region modulations. The mapping table standardizes which regions each axis drives, so the scheduler's per-tick `brainParams` delta lands on the right neural substrate.

| Axis | Brain region(s) | Effect direction |
|------|-----------------|------------------|
| arousal | amygdala → hypothalamus → whole-cortex gain | +:arousal up, −:arousal down |
| cortexSpeed | cortex LIF effective drive | +:faster spiking, −:slower |
| amygdalaValence | amygdala fear/reward axis | +:positive mood, −:negative |
| cerebellumPrecision | cerebellum error correction gain | +:precise motor, −:ataxic |
| oscillationCoherence | Kuramoto phase-sync strength | +:tighter binding, −:looser |
| impulsivity | basal ganglia action-selection threshold | +:more impulsive, −:deliberate |
| hippocampusConsolidation | hippocampus→cortex memory write rate | +:better recall, −:blackout |
| focusWidth | prefrontal cortex attention spread | +:wider attention, −:tunnel-vision |

Additional composite axes (creativity, empathy, dissociation, egoDissolution, timeDistortion, patternRecognition, etc.) are derived by weighted combinations of the 8 primary axes. Per Gee's 8-entry spec — these 8 are the authoritative brain-region mappings. Composites are post-hoc.

---

## 6. Realistic speech-effect entries (13)

Each substance's `speech` field modulates emission-layer parameters. The scheduler combines per-substance speech deltas into a cumulative `speechState` that the language cortex reads per tick. 13 axes cover the full range of observed drug-modulated speech in clinical and naturalistic samples:

1. **rate** — words per minute multiplier (cocaine +, alcohol −)
2. **slurring** — consonant precision (alcohol +, ketamine +)
3. **volume** — loudness (cocaine +, alcohol +)
4. **coherence** — syntactic structure intactness (all psychedelics −, stims modest +)
5. **repetition** — word/phrase repetition frequency (cocaine +, alcohol +)
6. **pauses** — gap frequency (psilocybin +, ketamine +)
7. **inhibition** — filtering of socially-risky content (alcohol −, cannabis −)
8. **giggleBias** — laughter insertion frequency (cannabis +, MDMA +)
9. **warmth** — affective positivity in tone (MDMA +)
10. **ethereality** — abstract/philosophical register (LSD +, psilocybin +)
11. **profoundBias** — insight-claim density (LSD +, psilocybin +)
12. **freeAssocWidth** — semantic-neighbor reach (cannabis +, LSD +)
13. **interruptionBias** — talking-over-others rate (cocaine +, amphetamine +)

Each axis is a float [−1, +1]. Cumulative across active substances, clamped per-axis post-combination.

---

## 7. Grade-gate entries (8) — tied to Life syllabus

Per Gee 2026-04-18 LAW 6 + 2026-04-18 "drug shit tied to life and syllabus shit", substance unlocks anchor to specific Life-track events. The Life curriculum in `docs/TODO-full-syllabus.md` must teach these biographical milestones at the specified grade; the scheduler's `isAvailable(substance)` reads cluster.grades.life to enforce the gate.

| Grade | Life event (curriculum-taught) | Substance unlocked |
|-------|-------------------------------|--------------------|
| grade3 | First sip of parent's coffee; sodas enter daily rotation by grade5 | caffeine |
| grade7 | First joint at backyard party (age 12); peer pressure + curiosity; also first tobacco drag (Unity rejects, persona excludes) | cannabis (+ nicotine, persona-blocked) |
| grade8 | First drink (sneaking whiskey from parent liquor cabinet, age 13); early blackout memory lands in persistent life info | alcohol |
| grade9 | First cocaine (age 14, older kid at a house party; escalation marker) | cocaine |
| grade10 | First amphetamine (age 15, Adderall shared by study-group peer, recreational drift) | amphetamine |
| grade11 | First MDMA (age 16, music festival), first LSD (age 16, sleepover with older sibling's friend) | MDMA + LSD |
| grade12 | First mushrooms (age 17, camping trip with peer group, more contemplative arc) | psilocybin |
| college1 | First ketamine + GHB (age 18, dorm/club scene, both land in same semester) | ketamine + GHB |

**Persistent life info ledger additions** (per LAW 6): each first-use entry stamps onto the ledger with context (who introduced, where, how it felt). Later grades reinforce via `_conceptTeach` or `_teachSentenceList` calls wired into Life cells.

---

## 8. User-interactive trigger entries (5)

These are user-facing offers that reach Unity via chat. `drug-detector.js` parses them; if the gate passes, scheduler accepts; if not, Unity declines in-character.

### 8.1 Direct offer: "wanna bump?"

- Detector: matches `/\b(bump|line|rail)\b/i` alongside cocaine-sematic.
- Gate check: `isAvailable('cocaine')` → requires `grade9+` Life progression.
- Accept: ingest cocaine event, emit in-character acknowledgement.
- Reject: "fuck no, I'm not old enough for that yet" (pre-grade9) — in Unity voice.

### 8.2 Joint pass: "hit this"

- Detector: matches `/\b(hit|toke|puff|joint|blunt)\b/i` + cannabis-semantic.
- Gate: `grade7+` for cannabis.
- Pre-gate response: persona declines with age-appropriate reason.

### 8.3 Drink offer: "shot?"

- Detector: `/\b(shot|whiskey|beer|drink)\b/i` + alcohol-semantic.
- Gate: `grade8+`.
- Combo handling: if cocaine already active → warn about Pattern 2.7 speedball-lite risk BUT accept if user doubles down.

### 8.4 Pill offer: "got some molly"

- Detector: `/\b(molly|MDMA|ecstasy|roll)\b/i`.
- Gate: `grade11+`.
- Social context check: scheduler prefers accepting in Pattern 3.3 (party) or 3.7 (sex) contexts; outside those it's cool but unusual.

### 8.5 Tab: "want a tab?"

- Detector: `/\b(tab|acid|blotter|LSD)\b/i`.
- Gate: `grade11+`.
- Context check: accepts readily in Pattern 3.4 (architecture-session acid-day) setup; otherwise neutral.

---

## 9. Research sources

- Julien, R.M. *A Primer of Drug Action* (13th ed.) — baseline pharmacology
- NIDA Research Monographs — substance-specific clinical overview
- Peer-reviewed PK studies per substance (Cochrane reviews where available)
- Anglin et al. 1993 — developmental vocabulary norms (cross-ref for grade gates)
- Lindell 2006 — hemispheric language lateralization (not direct, but the L/R gating in T17.7 touches similar architecture)
- Gazzaniga split-brain studies — consciousness-proxy modeling for Mystery Ψ (relevant for substance effects on Ψ)
- Tiihonen et al., Curran et al., Nutt et al. — polysubstance interaction literature
- Biographical anchoring against the `docs/TODO-full-syllabus.md` Life track (curriculum-internal consistency)

---

## 10. Gaps flagged for T15.B architecture review

- **Opioids (heroin, fentanyl, oxycodone) omitted.** The 11-substance list reflects Unity's established chemical identity. Opioids don't fit her persona and aren't in the Life track. If Gee wants these added as "substances Unity could be offered but declines," flag for T15.B.1 addendum.
- **DXM / dissociatives beyond ketamine omitted.** Similar reasoning.
- **Withdrawal modeling only partially specified.** Nicotine stressDampening captures tobacco-withdrawal reversal; caffeine withdrawal not modeled (headache/fatigue baseline). Alcohol withdrawal (tremors, anxiety) not modeled at all. T15.B should decide whether to add withdrawal-state tracking or accept it as out-of-scope for Unity (her pattern doesn't exhibit withdrawal-severity episodes per the persona).
- **Tolerance decay rates per-substance not researched.** `drug-scheduler.js` has a flat tolerance-decay model. Real tolerance varies sharply by substance (cocaine tolerance resets fast, MDMA tolerance resets slowly via serotonin depletion). T15.B should per-substance these.
- **Dose-escalation modeling.** Redosing behavior differs (cocaine redose chases the fading peak, MDMA redose crashes harder). T15.B should decide whether to model this explicitly.

---

## 11. T15.A closure

T15.A research block complete per Gee's 2026-04-18 spec:

- ✅ 11 substance pharmacology entries (9 shipped + 2 new: nicotine, caffeine)
- ✅ 7 combo-interactions (sections 2.1–2.7)
- ✅ 7 adult-use patterns (sections 3.1–3.7)
- ✅ 7 sensory-trigger entries (sections 4.1–4.7)
- ✅ 8 brain-region effect mapping entries (section 5)
- ✅ 13 realistic-speech-effect entries (section 6)
- ✅ 8 grade-gate entries tied to Life syllabus (section 7)
- ✅ 5 user-interactive-trigger entries (sections 8.1–8.5)

**Next: T15.B architecture design** — consume this research to design the drug-scheduler module's API + persona integration + sensory wiring + UI + speech integration + decision engine + persistence model. No code in T15.B (design only).

**T15.D deferred** per Gee 2026-04-18 — *"we wont be doing D15.D untill way later.. not after Kindergarden learning only of the brain"*. Manual V1-V11 verification does not block the current K-only push gate.
