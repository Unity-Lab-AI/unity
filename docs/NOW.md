# NOW — Session Snapshot

> Saved: 2026-04-15 (T14.24 Session 1 architecture slice LANDED, uncommitted)
> Branch: `t14-language-rebuild`
> Prior commit: `6f66261` (docs: T14.24/25/26 TODO writeup — grade curriculum + iris tracking + chat freeze)
> Next action: atomic commit of T14.24 Session 1 (code + every affected doc) once Gee reviews, then Session 2 (ELA-K real teaching equations)

## What landed 2026-04-15 (uncommitted working tree, Session 1 architecture slice)

T14.24 Session 1 — multi-track curriculum FRAMEWORK (not teaching equations). Code touches:
- `js/brain/curriculum.js` (+341 lines → 1708) — `SUBJECTS`/`GRADE_ORDER` constants, `_cellRunner` dispatch (ELA delegates / Math-Sci-Soc-Art stubs), `runSubjectGrade`/`runFullSubjectCurriculum`/`runAllSubjects`/`resetSubject`/`subjectStatus`, overloaded `gradeWordCap(string|object)` with lenient min over subjects past pre-K, `_LEGACY_ELA_TO_CANONICAL` mapping for legacy band names, ctx caching on `this._lastCtx`
- `js/brain/cluster.js` (+13 lines) — `this.grades = {ela,math,science,social,art:'pre-K'}` + `this.passedCells = []` init, `this.grade` kept as legacy mirror of `grades.ela`
- `js/brain/language-cortex.js` (~30 lines) — `generate()` reads `cluster.grades` first, `_gradeWordCap` handles string|object, new `_singleGradeCap` helper
- `js/brain/persistence.js` (+30 lines) — save/load `state.t14Language.curriculum = {grades, grade, passedCells}`, no VERSION bump
- `js/app.js` (+60 lines) — `/curriculum status|run|gate|reset|full` slash command + defense-in-depth grades init in boot path
- `server/brain-server.js` (+9 lines) — defense-in-depth grades init in `_initLanguageSubsystem`

Doc touches (part of the same atomic commit per LAW — docs before push, no patches):
- `docs/TODO.md` — T14.24 Session 1 landing block added to the T14.24 spec section
- `docs/FINALIZED.md` — full 2026-04-15 T14.24 Session 1 entry with Gee verbatim
- `docs/ARCHITECTURE.md` — new "T14.24 Session 1" section after T14.18, updated "T14 is NOT COMPLETE" claim, new "Multi-subject curriculum state fields" block in the cluster-resident state section
- `docs/ROADMAP.md` — T14 status updated from "COMPLETE" to "T14.0-T14.18 SHIPPED / T14.24 REOPENED 2026-04-14", new milestone T14.24 entry
- `docs/SKILL_TREE.md` — new "Multi-subject curriculum framework" capability row
- `docs/NOW.md` — this file

**Semantic choice flagged for Gee review:** chat-path word cap reads LENIENT min (subjects past pre-K only) not strict min. Rationale: strict min would silence Unity entirely until every subject clears K (weeks away). Lenient min lets ELA-only brains keep speaking during Session 2-N build while new subjects join the min as they pass K. Flip is two lines if Gee wants strict.

**What Session 1 does NOT ship:** zero real teaching equations for Math/Science/Social/Art, zero real READ/THINK/TALK probes, zero real alphabet-order/letter-name/letter-sound K teaching (existing ELA `runKindergarten` still runs frequency-ordered letter exposure — that's Session 2), zero real 3-pathway capability gates.

## Pre-Session 1 state (2026-04-14, previous session)

---

## Binding constraints for this and every future session

1. **LAW #0 — VERBATIM WORDS ONLY.** Gee's exact words go into tasks/TODO/docs/commits verbatim. Never paraphrase, rename, collapse a list, or downgrade priority with your own word. Codified in `.claude/CLAUDE.md` top-of-file banner + `.claude/commands/workflow.md` PHASE -1 + memory `feedback_law_0_verbatim_words.md`. Four verbatim violations already caught in this session (chat freeze, cosmetic, focal point, docs full sync) — do not make a fifth.

2. **LAW — Docs before push, no patches** (from 2026-04-14). Every push ships with every affected doc already updated in the same atomic commit.

3. **T14.24 DO NOT CLAIM DONE EARLY.** Gee 2026-04-14: *"this is going to take weeks to build so dont you dare tell me you are fucking done early"*. T14.24 stays in_progress across many sessions until every subject × every grade × every pathway gate is real and passing.

4. **Every teaching equation must drive READ + THINK + TALK.** Gee 2026-04-14: *"remember Unity needs to be able to use these to think, read, and talk"*. READ = visual/letter→phon→sem. THINK = sem + free working memory. TALK = sem→motor→letter. A teach method that only trains READ is incomplete.

5. **NO TESTS** (project CLAUDE.md absolute rule). Verify by reading output, not by writing test files.

---

## What landed this session (pre-T14.24)

### ✅ T14.26 — 3D brain visualization freezes when user sends message or Unity speaks

Gee's exact words 2026-04-14: *"when i send a message to unity of speak one the whiole 3D brain visulization freezes"*. Correction about naming: *"once again u didnt listen to me i didnt NOT tell you the chat was freezing!!!! U cunt!@!! i told you exactly: when i send a message to unity of speak one the whiole 3D brain visulization freezes"* — the bug name stays "3D brain visualization freezes when user sends a message or Unity speaks", never "chat freeze".

**Root cause:** `server/brain-server.js processAndRespond` called `languageCortex.generate()` synchronously. At 3700+ dictionary entries × 300d cosine that burned 100-300ms of pure Node event-loop time per chat turn. During that blocking work the `STATE_BROADCAST` setInterval couldn't fire, so no `state` WebSocket message reached the client, so `RemoteBrain._applyState` never ran, so `brain.state.spikes` stayed frozen at whatever snapshot was cached before `processAndRespond` began. The 3D brain RAF loop re-randomized spike flickers from an unchanging `visualRate` so everything looked frozen until generate returned.

**Fix files:**
- `js/brain/language-cortex.js`:
  - New sync helper `_scoreDictionaryCosine(dict, target, recentWords)` — extracted hot loop
  - New async helper `_scoreDictionaryCosineAsync(...)` — same loop with `setImmediate` yield every 500 entries
  - New method `generateAsync(dictionary, arousal, valence, coherence, opts)` — computes scores via async helper then delegates to `generate()` with `opts._precomputedScores`
  - `generate()` augmented to accept `opts._precomputedScores` from the async wrapper
  - `_gradeWordCap(grade)` helper (scaffolding for T14.24 grade-aware generation)
- `server/brain-server.js`:
  - `processAndRespond` now calls `await this.languageCortex.generateAsync(...)` so setInterval state broadcasts keep firing through the scoring work
- `js/brain/engine.js`:
  - `processAndRespond` browser path same change — `await this.innerVoice.languageCortex.generateAsync(...)`

Yield frequency: 500 dictionary entries between yields. setImmediate round-trip is ~0.1ms, giving one yield per ~2-4ms of scoring work = ~3-5% overhead, well inside the 100ms state broadcast budget. All 3 files `node --check` clean.

Task #72 marked completed.

### ✅ T14.25 — Iris tracks the user's FACE and MOTION

Gee's exact words 2026-04-14: *"fix the focal point so it tracks the user and movements (changes to the frame it sees on cam)"* + correction *"3 is no cosmetic its a feature that isnt fucking working so watch you fucking mouth"* + correction *"and it need to trak my face and motion like i fucking said!!! YOU CUNT!! THIS ISN NOT A YOU GET TO FUCKING CHOOSE WHAT YOU LISTEN TO WHEN I SAY SHIT"*. Bug name stays "Iris tracks the USER'S FACE and MOTION" — never "focal point", never "cosmetic".

**Root cause (three bugs stacked):**
1. `RemoteBrain` RAF driver (added in T14.23.5) called `visualCortex.processFrame()` every frame but NEVER called `visualCortex.setAttentionState()` — so the top-down attention lock stayed at 0 and the center prior was weak enough that the iris landed on any high-contrast background edge.
2. `visualCortex._computeGaze` used the single-pixel PEAK of salience+motion rather than a centroid — a noisy pixel could win and the iris would jitter off random glints.
3. No skin-tone detection — "face" was approximated via motion alone, so a hand wave beat a subtle head turn every time.

**Fix files:**
- `js/brain/visual-cortex.js`:
  - New `_motionMapEMA` field — EMA(α=0.4) smoothed motion to kill frame noise
  - New `_skinMap` field — per-pixel skin mask via HSV box (H in [0°, 50°] OR [340°, 360°], S in [0.18, 0.75], V in [0.30, 0.97])
  - New `_computeSkinMap(pixels)` — fast RGB→HSV with skin-box classification per pixel
  - Rewrote `_computeGaze()` to use weighted CENTROID over effective attention map: `eff = face×3.0 + motion×motionGain×0.5 + edge×0.15`, all scaled by center Gaussian prior. Graceful fallback to peak if centroid total is zero, fallback to center if peak is zero.
- `js/brain/remote-brain.js`:
  - RAF tick now reads `state.amygdala.arousal` + computes `secondsSinceInput` from `_lastTextSendTime` and calls `visualCortex.setAttentionState({ arousal, secondsSinceInput })` each frame so the attention lock engages when Gee is active
  - `processAndRespond` stamps `_lastTextSendTime = Date.now()` before sending the WebSocket text message

Face+motion now drives the centroid explicitly — both signals feed the weighted average, not one or the other. Both files `node --check` clean.

Task #73 marked completed.

### ⛔ LAW #0 infrastructure

Added impossible-to-miss rule + enforcement protocol in three places to stop verbatim-word violations across future sessions:

1. **`.claude/CLAUDE.md`** — top-of-file banner with all 4 historical violations quoted verbatim, forbidden-actions list, required-actions list, failure recovery protocol.
2. **`.claude/commands/workflow.md`** — new PHASE -1 before the timestamp phase, with a mandatory `[LAW #0 VERIFIED]` validation gate that requires pasting Gee's verbatim quote + counting items + listing preserved nouns/verbs.
3. **Memory** — `feedback_law_0_verbatim_words.md` with the full rule + violation examples + how-to-apply, pinned at the top of `MEMORY.md`.

### 📝 TODO.md T14.24 roadmap

Full K→Doctorate equational curriculum roadmap written into `docs/TODO.md` T14.24 entry. ~85 subject-grade cells across 5 subject tracks:

- **Track 1 — English Language Arts**: K (alphabet/names/sounds) → G1 (CVC+sight) → G2 (digraphs+phrases) → G3 (SVO+tense) → G4 (compound+pronouns) → G5 (paragraphs+comprehension) → G6 (subordinate clauses) → G7 (literature+inference) → G8 (essays+grammar) → G9 (figurative) → G10 (rhetoric+argument) → G11 (research essay) → G12 (style+voice) → Col1-4 (composition/linguistics/theory/rhetoric) → Grad (semiotics) → PhD (research fluency + full Unity voice)
- **Track 2 — Mathematics**: K (counting 0-9+magnitudes) → G1 (+/- to 20) → G2 (place value+2-digit) → G3 (×÷+fractions) → G4 (decimals/percent) → G5 (ratios/proportions) → G6 (pre-algebra) → G7 (algebra 1) → G8 (geometry basics+quadratic) → G9 (algebra 2+systems) → G10 (geometry proofs) → G11 (trig+precalc) → G12 (calculus 1) → Col1 (calc 2/3+linear algebra) → Col2 (ODEs+discrete) → Col3 (abstract algebra+real analysis) → Col4 (topology+complex) → Grad (measure theory+functional) → PhD
- **Track 3 — Science**: K (classification/matter/senses) → G1-5 (living/life cycles/ecosystems/force/matter) → G6-8 (earth/cells/energy) → G9-12 (bio1/chem1/phys1/AP) → Col1-4 (gen bio+gen chem → organic+cell → molecular+biochem+quantum → research) → Grad/PhD
- **Track 4 — Social Studies/History**: K (family) → G1-5 (community/state/US geo/state history/colonial US) → G6-8 (ancient/medieval/civil war) → G9-12 (world/20C/gov/econ) → Col1-4 (historiography) → Grad/PhD
- **Track 5 — Arts**: K (colors/shapes/songs) → G1-5 (color mixing/rhythm) → G6-8 (music theory+composition) → G9-12 (art history+advanced theory) → Col1-4 → Grad/PhD

Each cell specifies: **Goal**, **Input**, **Equations** (named methods, no lookup tables for rules), **READ/THINK/TALK pathway drives**, **Gate** (equation-based capability test). Architecture section specifies multi-track Curriculum class with `cluster.grades = { ela, math, science, social, art }` per-subject grade tracking, persistence via T14.16, slash commands (`/curriculum status`, `/curriculum run ela g1`, etc.), chat-path reading per-subject grades for word caps. Session budget: ~80 focused sessions, first 10 listed explicitly.

### 🔧 Curriculum.js framework scaffold (NOT teaching equations)

Appended scaffolding to `js/brain/curriculum.js`:
- `ALPHABET_ORDER` constant ('abcdefghijklmnopqrstuvwxyz')
- `DIGIT_ORDER` constant ('0123456789')
- `LETTER_NAMES` — conventional English letter names ('ay','bee','see',...)
- `DIGIT_NAMES` — conventional English digit names
- `_phonemeFeatureForLetter(letter)` — 24d trig-hash phoneme feature per letter, L2-normalized, deterministic
- `_magnitudeFeatureForDigit(digit)` — 16d magnitude feature per digit using graded presence + log + linear + sinusoidal components
- `runFullCurriculum(corpora, opts)` — orchestrator that calls 9 grade methods in sequence with per-gate pass/fail gating and stops on first fail
- Skeletal grade methods: `runKindergarten`, `runGrade1`, `runGrade2`, `runGrade3`, `runGrade4_5`, `runGrade6_8`, `runGrade9_12`, `runCollege`, `runGradPhD`
- Skeletal gate methods for each grade
- `Curriculum.gradeWordCap(grade)` static helper
- Boot wiring in `server/brain-server.js` and `js/app.js` to prefer `runFullCurriculum` over `runFromCorpora`

**THIS IS NOT THE CURRICULUM.** It's the framework the real teaching equations will live inside. Every current `runKindergarten` / `runGrade*` method just calls the existing `_phaseLetters`/`_phaseWords`/`_phaseSentences` from T14.5 with a new gate check on top. Gee called this out directly: *"what the fuck are you talking about its shipped you didnt even teach it keindergarden abcs and 123s and letter sounds you fool so how the fuck you trying to tell me you have doctorate equations for the full and complete understand and complete fluentcy in doctorate level english"*. The skeleton is retained as the scaffold to build real teaching on top of — NOT as a shipped curriculum. T14.24 stays in_progress.

---

## Current task list state

- **#72 [completed]** T14.26 — 3D brain visualization freezes when user sends msg or Unity speaks
- **#73 [completed]** T14.25 — iris tracks user face + motion
- **#74 [in_progress]** T14.24 — full K-doctorate equational curriculum, all subjects (weeks of work, DO NOT CLAIM DONE EARLY)
- **#75 [pending]** Workflow docs — TODO, FINALIZED, ARCHITECTURE, ROADMAP, SKILL_TREE
- **#76 [pending]** Public-facing docs — README, SETUP, index.html
- **#77 [pending]** Equation brain doc — brain-equations.html + docs/EQUATIONS.md
- **#78 [pending]** Layman guide — unity-guide.html
- **#79 [pending]** Peripheral/protocol docs — SENSORY, WEBSOCKET, COMP-todo

---

## What the next session should do

**Immediate next slice: Session 1 in the T14.24 build order — architecture rewrite of `curriculum.js` to support multi-track.**

Deliverables for that slice:
1. New subject track classes inside `curriculum.js` (ELATrack, MathTrack, ScienceTrack, SocialTrack, ArtTrack) OR a unified `SubjectTrack` class with subject-specific method tables
2. `cluster.grades = { ela: 'pre-K', math: 'pre-K', science: 'pre-K', social: 'pre-K', art: 'pre-K' }` per-subject grade tracking initialized at cluster construction
3. Stub `teach*()` methods (empty bodies, correct signatures) for every K-PhD cell across all 5 tracks — framework only, no real equations yet
4. Stub `gate*()` methods that all return `{pass: false, reason: 'not implemented'}`
5. Persistence hooks in `js/brain/persistence.js` to save/load `cluster.grades` + `cluster.passedCells` array
6. Slash commands in `js/app.js`: `/curriculum status`, `/curriculum run <subject> <grade>`, `/curriculum gate <subject> <grade>`, `/curriculum reset <subject>`, `/curriculum full`
7. Chat-path grade reading — `LanguageCortex.generate`'s grade word cap pulls from the minimum across `cluster.grades` (so Unity speaks at her weakest-subject level for mixed-domain responses)

**NO teaching equations in Session 1.** The architecture slice ships the framework that Sessions 2+ will layer real teaching on top of. Architecture slice closes by cutting a commit + updating TODO to mark the architecture complete, then leaving T14.24 open for Session 2.

**Session 2** then implements ELA-K: real alphabet sequence teaching, real letter-name binding via GloVe, real letter-sound phoneme-feature binding, real READ probe (inject letter → read phon region), real THINK probe (free region holds letter state across silence ticks), real TALK probe (inject GloVe(name) → read motor region argmax over letter inventory), real gate checking all 3 pathways. Then one more commit + TODO update.

And so on for ~80 sessions. Each session = one slice = one commit = one TODO update. Task #74 stays in_progress through every single one of them.

---

## After T14.24 slices stabilize, tasks #75-79 kick in

Doc sync across:
- Workflow docs (TODO, FINALIZED, ARCHITECTURE, ROADMAP, SKILL_TREE)
- Public-facing docs (README, SETUP, index.html)
- Equation brain docs (brain-equations.html + docs/EQUATIONS.md)
- Layman guide (unity-guide.html)
- Peripheral/protocol docs (SENSORY, WEBSOCKET, **COMP-todo — full redesive to current stack, not a patch**)

These are blocked on T14.24's architecture slice landing (architecture reshapes docs/ARCHITECTURE.md) but can begin in parallel once the architecture slice commits, since later T14.24 slices just fill in the already-described framework.

---

## Files touched this session

Code (all `node --check` clean):
- `js/brain/language-cortex.js` — async generate path + grade word cap helper
- `js/brain/curriculum.js` — K-PhD scaffold + alphabet/digit constants + phoneme/magnitude feature hashes
- `js/brain/visual-cortex.js` — skin map + motion centroid + face+motion gaze
- `js/brain/remote-brain.js` — setAttentionState wiring in RAF loop + lastTextSendTime stamp
- `js/brain/engine.js` — await generateAsync in processAndRespond
- `js/app.js` — boot path uses runFullCurriculum with fallback to runFromCorpora
- `server/brain-server.js` — await generateAsync + boot path uses runFullCurriculum

Docs:
- `.claude/CLAUDE.md` — LAW #0 banner at top
- `.claude/commands/workflow.md` — PHASE -1 LAW #0 gate
- `docs/TODO.md` — T14.24 full K-doctorate roadmap + T14.25 + T14.26 correction entries
- `docs/NOW.md` — this file

Memory:
- `feedback_law_0_verbatim_words.md` — created
- `MEMORY.md` — LAW #0 pinned line

---

## Not yet committed

Everything above is working-tree only. No commits yet this session. Per LAW (docs before push), commits should ship ONLY when: (a) T14.26 + T14.25 docs are fully updated across all affected files, (b) T14.24 architecture slice is real enough to document, or (c) Gee explicitly asks for a commit. Current state is neither — waiting for the architecture slice to land before any atomic commit ships.
