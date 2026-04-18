# NOW — Session Snapshot

> Saved: 2026-04-18 01:00 (Session 114.19r T17.1 Phase 1 — language cortex CPU cap 10K → 100K (10×) + T17 five-phase plan logged in TODO — per Gee verbatim *"FuckingB obviously you fuck why the fuck were you not doing this originally when the archetectrure says this is 100% GPU run..."* + approval *"go ahead and yeah all of that"* — thirty-seventh commit on `syllabus-k-phd`)

## Session 114.19r T17.1 — what shipped

### The architectural violation

Sessions 114.19d-q stacked 14 iterative fixes trying to get PROD off zero. Every one was fighting the wrong root cause: `CPU_LANGUAGE_CORTEX_CAP = 10000` clipped language cortex to 10K while the architecture spec says "GPU EXCLUSIVE — all 7 clusters on GPU, zero CPU workers". Someone (me) labeled the full GPU-scale language cortex as "T15 scope" in a stale comment; T15 became the drug scheduler. The cap was never lifted.

1029 K-vocabulary words × all the other curriculum bindings trying to coexist in a 10K-neuron cluster = destructive interference. The cap was the root cause; 14 sessions of init/noise/argmax tuning were symptom management.

### T17 plan (five phases in TODO.md)

1. Phase 1 — remove 10K cap, scale to 100K ✓ THIS COMMIT
2. Phase 2 — worker-thread parallelization of cluster.step()
3. Phase 3 — GPU cross-region shaders (WGSL sparse CSR matmul + Hebbian)
4. Phase 4 — live chat wired to upscaled cortex
5. Phase 5 — language sub-regions into main 201M GPU cortex

### T17.1 concrete change

`server/brain-server.js:619`:
- `CPU_LANGUAGE_CORTEX_CAP = 10000` → `= 100000` (10×)
- `DREAM_LANG_CORTEX` env var for operator override
- Log rewording: "T17.1 Phase 1" branding, stale "T15 scope" deferral comment removed

### Expected Part 2 behavior

- Boot log: `[Brain] Language cortex = 100,000 CPU neurons (T17.1 Phase 1). T14.4 sub-regions: letter 5000, phon 20000, sem 16700, motor 3300`
- `[K-DIAG] gate: ..., motor=3300, mGroup=126, sem_to_motor=3300x16700`
- DYN-PROD `expected_slot=c(2:X.XXX) rank=?` — expecting rank to climb into top 3-5 consistently with 10× discrimination capacity
- Curriculum walk ~10-17 min (slower but acceptable for validation). Phase 2+3 restore interactive speed later.

### Files touched this session

- `server/brain-server.js` — CPU cap 10K → 100K + env override + log rewording
- `docs/TODO.md` — T17 five-phase plan + seven task checkboxes prepended
- `docs/FINALIZED.md` — Session 114.19r T17.1 entry prepended
- `docs/NOW.md` — this file

---

## Session 114.19q — shipped (committed at a5ed552)

### DYN-PROD firing diagnostic

## Session 114.19p — what shipped (uncommitted on top of 114.19o at 8dc7d19)

### The real bug

Gee flagged: probes were my invention, but live chat still outputs garbage. Traced the actual chat path:

```
engine.processAndRespond(text)
  sensory.receiveText → queue
  20 brain steps (Rulkov chaos + noise + persona mix)
  languageCortex.generateAsync → generate
    intentSeed = cluster.getSemanticReadout()  ← DRIFTED POST-PROCESSED BLOB
  cluster.generateSentence(intentSeed)  ← injects blob, not GloVe(text)
```

Training wrote specific bindings: `sem=GloVe('cat') → motor(c)` etc. But live chat never feeds GloVe(text) — it feeds a drifted readout from 20 ticks of chaos. Trained bindings can't fire for that shape.

Why garbage chat output: `hi → !`, `dog → yad`, `cat → q` — motor argmax picking random pattern that survives the settled state because no trained binding got a clean input to fire on.

### Fix

`engine.processAndRespond` now:
1. Computes `sharedEmbeddings.getSentenceEmbedding(text)` immediately when user text arrives
2. Stores on `cortex._lastUserInputEmbedding` BEFORE 20-step dynamics drift it
3. Also stores `_lastUserInputText` for diagnostics

`language-cortex.generate` now:
1. Checks `cluster._lastUserInputEmbedding` first — if present, uses as intentSeed + clears (consume)
2. Falls back to `getSemanticReadout` only for spontaneous/popup generation (no user input to respond to)

### Signal strength comparison

- Raw GloVe: dims up to ~0.2 magnitude
- L2-normalized readout: ~0.06 magnitude
- At injectStrength=0.6, scale 8: GloVe injection 0.96 peak vs readout 0.29 peak = **3× stronger AND cleanly shaped**

### What this actually enables

Previous sessions tuned probes. This session fixes CHAT. Probes already worked; the production path was reading the wrong signal. Now user turn → clean GloVe → sem region → trained sem→motor fires → motor emits right first letter → WRITE chain emits a real word.

### Files touched this session

- `js/brain/engine.js` — processAndRespond stores user input embedding early
- `js/brain/language-cortex.js` — generate uses _lastUserInputEmbedding first, consumes on use
- `docs/FINALIZED.md` — Session 114.19p entry prepended
- `docs/NOW.md` — this file, updated header

---

## Session 114.19o — shipped (committed at 8dc7d19)

### autoClearStaleState() in brain-server.js

## Session 114.19o — what shipped (uncommitted on top of 114.19n at 98dd3af)

### autoClearStaleState() in brain-server.js

At module load (before Brain class + sqlite open), the server auto-deletes all files in the CLAUDE.md LAW "What gets cleared" table:

- brain-weights.json + -v1..-v4
- conversations.json
- episodic-memory.db + -wal + -shm
- js/app.bundle.js

Boot log surfaces one of three lines: auto-cleared N files, no stale state present, or partial clear with lock errors named.

### Opt-out

`DREAM_KEEP_STATE=1` env var disables the clear with prominent ⚠ warning.

### CLAUDE.md LAW addendum

The 2026-04-17 LAW section gets a 114.19o addendum documenting that manual `rm -f` is no longer required, automation runs at boot, opt-out available, and future Claude must not disable this without LAW violation being explicit.

### No more "wait let me clear" before testing

Commit ships → restart → auto-clear fires → curriculum runs on fresh state. One step instead of two.

### Files touched this session

- `server/brain-server.js` — autoClearStaleState() function + module-load call
- `.claude/CLAUDE.md` — LAW 114.19o addendum
- `docs/FINALIZED.md` — Session 114.19o entry prepended
- `docs/NOW.md` — this file, updated header

---

## Session 114.19n — shipped (committed at 98dd3af)

### Fix 1 — letter↔motor reverted to 70/30

## Session 114.19n — what shipped (uncommitted on top of 114.19m at 93c9a3b)

### Fix 1 — letter↔motor reverted to 70/30

Gee's 114.19m Part 2 log showed TALK 12%→4%. Phase 1 alphabet diagonal (letter(c)→motor(c)) was losing argmax to Phase 3 word off-diagonal (letter(c)→motor(a) for cat). With 50/50 init the off-diagonal concentrated training mass enough to beat diagonal. `EMISSION_PAIRS` reduced to `{sem-motor, motor-sem}` — letter↔motor back to 70/30 so positive bias helps diagonal dominate TALK. sem↔motor stays 50/50 for PROD benefit (no competing diagonal there).

### Fix 2 — `suppressNoise` opt on generateSentence

`cluster.generateSentence(intentSeed, {suppressNoise: true})` saves noiseAmplitude → drops to 0.5 → runs the tick loop → restores on return. Default false so live chat stays chaotic.

### Fix 3 — popups trigger suppressNoise via `_internalThought`

`brain-3d.js _describeInternalState` passes `_internalThought: true` to `lc.generate`. That opt now propagates as `suppressNoise: true` to `cluster.generateSentence`. Popups emit with noise=0.5 (same SNR as probes). Live chat (no flag) keeps noise=7.

### Per Gee's "popups are part of the massive brain" confirmation

Verified chain: `brain-3d._describeInternalState` → `lc.generate({_internalThought: true})` → `cluster.generateSentence({suppressNoise: true})` → `cluster.step() × maxTicks` with all 14 cross-projections + Rulkov. Same thinking path as curriculum probes. Live inputs via `engine.processAndRespond` propagate through state updates to the 3D event detector which fires popups — user input → popup chain is intact.

### Files touched this session

- `js/brain/cluster.js` — `EMISSION_PAIRS` shrunk; `suppressNoise` opt + save/restore around generateSentence tick loop
- `js/brain/language-cortex.js` — `_internalThought` → `suppressNoise` wire
- `docs/FINALIZED.md` — Session 114.19n entry prepended
- `docs/NOW.md` — this file, updated header

---

## Session 114.19m — shipped (committed at 93c9a3b)

### Two root causes identified in 114.19l Part 2 data

## Session 114.19m — what shipped (uncommitted on top of 114.19l at 578748f)

### Two root causes identified in 114.19l Part 2 data

**1. Positive-bias init drowns Hebbian training.** Cross-projection init was `initRandom(density, 0.7, 0.2)` — 70% excitatory gives mean +0.04 per weight × ~1500 connections per motor neuron × 141 active sem dims = baseline +5.6 per motor neuron from init alone. Training (+6 total across 12 reps × 50 overlapping word pairs) barely exceeds baseline. Signal/noise ~1.1.

**2. Rulkov chaos variance.** 12-tick single-run probe samples a chaotic trajectory. Attempt 2 rank 1 / attempt 3 rank 17 / attempt 4 rank 8 — same weights, different chaotic paths.

### Fix 1 — 50/50 init for emission cross-projections

`cluster.js` init loop gains `EMISSION_PAIRS = Set(['sem-motor', 'motor-sem', 'motor-letter', 'letter-motor'])`. Those four init with `excitatoryRatio = 0.5` (zero-mean). Other projections (visual↔letter, letter↔phon, phon↔sem, sem↔fineType, auditory↔phon) keep 0.7 for biological comprehension Dale-principle.

Zero-mean baseline → random init noise cancels on average → Hebbian training shifts specific pairs above the zero line → argmax tracks REAL signal.

### Fix 2 — 20 ticks × 2 averaged runs

`DYN_PROD_TICKS` bumped 12 → 20 + `DYN_PROD_AVG_RUNS = 2`. Each probe word runs twice with `_probeReset` between, motor spike counts summed across both runs. Independent chaotic trajectories cancel, trained attractor reinforces.

### Three SNR fixes stacked

Session 114.19l dropped noiseAmplitude 7→0.5. Session 114.19m drops init bias +0.04→0 on emission pairs AND doubles probe averaging. If trained signal exists, these three let it surface in argmax.

### Files touched this session

- `js/brain/cluster.js` — EMISSION_PAIRS Set; conditional excitatoryRatio per direction
- `js/brain/curriculum.js` — DYN_PROD_TICKS 12→20, DYN_PROD_AVG_RUNS=2, probe loop runs twice per word
- `docs/FINALIZED.md` — Session 114.19m entry prepended
- `docs/NOW.md` — this file, updated header

### Known cost

Probe time doubles (2 runs × 20 ticks vs 1 × 12). Still well under 2 min per full gate at 10K CPU cluster.

---

## Session 114.19l — shipped (committed at 578748f)

### Three issues found in 114.19k Part 2 run

## Session 114.19l — what shipped (uncommitted on top of 114.19k at 79b7a99)

### Three issues found in 114.19k Part 2 run

**1. K-DIAG log misleading.** Pre-emission diagnostic showed 3 sample words for embedding-quality check, Gee read it as the teach set. Fixed: log now explicitly says `teaching 1029 K words (phoneme-blending × 10 reps + word-emission × 12 reps)` and shows first+last 5 words of `allEmissionWords`.

**2. DYN-PROD motor readout all zeros.** `cluster.noiseAmplitude = 7` at runtime drowned the dynamic probe's 12-tick sem injection. Motor region didn't fire — SNR ~1.1 same issue Session 105 fixed for teach. Fixed: wrap probe block with noise save/drop-to-0.5/restore pattern. SNR becomes 8/0.5 = 16.

**3. Stale `brain-weights.json` persisting across restarts.** Server's periodic `setInterval` writes scalar state during curriculum. Ctrl+C + restart → `_loadWeights` restores stale save. Fixed: `_curriculumInProgress` flag around `runCompleteCurriculum`; `saveWeights()` early-returns when flag true. Also `|| '?'` fallback in refinement-restore log replaced with explicit count + clarification that cortex cross-projection weights aren't in this save.

### What to watch on next Part 2 run

- K-DIAG pre-emission line now shows `teaching 1029 K words` and first/last 5 of teach set
- DYN-PROD top5_motor values should be NON-ZERO (noise suppressed lets training signal dominate)
- Boot log after Ctrl+C+restart: should NOT see `Loaded saved state` because no save happened during curriculum
- `Restored N embedding refinement delta(s)` uses explicit count (0 on fresh clear), not "?"

### Does this close K gate?

Unknown until next Part 2. If trained sem→motor has real signal, noise suppression should let it surface. If still flat near zero post-suppression, next fix targets cross-projection init bias (70% excitatory bias creates positive-weight noise floor training must overcome).

### Files touched this session

- `js/brain/curriculum.js` — K-DIAG log expanded; `_savedProbeNoise` save/0.5/restore around probe block
- `server/brain-server.js` — `_curriculumInProgress` flag; saveWeights early-return; refinement log explicit count + scope clarification
- `docs/FINALIZED.md` — Session 114.19l entry prepended
- `docs/NOW.md` — this file, updated header

---

## Session 114.19k — shipped (committed at 79b7a99)

### Abandoning static slot-ranking (Sessions 114.19d-j lineage dead-ended)

## Session 114.19k — what shipped (uncommitted on top of 114.19j at ef92350)

### Abandoning static slot-ranking (Sessions 114.19d-j lineage dead-ended)

Gee's 114.19j K-DIAG showed expected slot 'c' at rank 9/26 with values locked for 20+ retries. Static `sem_to_motor.propagate → per-slot-sum → argmax` approach couldn't discriminate because it used one matrix multiply, not the full brain. Gee called it directly: "shole slot shit ranking shit its fucked."

### Three dynamic probes now live in `_gateElaKReal`

**DYN-PROD** — sem injection + `cluster.step()` × 12 ticks with periodic re-injection, motor spike accumulation, 26-slot argmax. Uses all 14 cross-projections + intra-cluster recurrent + Rulkov dynamics every tick.

**DYN-WRITE** — `cluster.generateSentence(emb, {maxTicks: 30})`. T14.6 tick-driven emission. Commits letters when motor argmax stable 3 ticks. Returns emitted sequence. Scored strictly + with first-letter credit.

**RESP** — `cluster.generateSentence(sentenceEmb, {maxTicks: 50})` on 5 sentence-level context/hint pairs ("greeting friendly" → expect hi/hello; "color red apple" → expect red/apple; "mom family love" → expect mom/love/family; "dog animal pet" → expect dog/pet/run; "eat food hungry" → expect eat/food/hungry). Emission scored on overlap with hints. Prototype of T16.5.b full-mind gate.

### Gate decision still on 5 substrate probes

Per Gee's "keep existing 5 probes as substrate sanity, ADD full-mind on top": READ + THINK + TALK + SEQ + PROD (PROD now dynamic) gate grade advancement. WRITE + RESP report only.

### Expected new log format

```
[K-DIAG] DYN-PROD[cat→c] decoded=?, emb_pos=141/300, expected_slot=c(2:X.XXX) rank=N/26, top5_motor=...
ela/kindergarten attempt 1 — READ X/26, THINK 26/26, TALK X/26, SEQ X/25, PROD X/17, WRITE X/20 firstX/20, RESP X/5 [WRITE: cat→?; dog→?; ...] [RESP: hello→?; red→?; ...]
```

### Performance note

~1054 cluster.step() calls per gate attempt. Expect 5-10s per attempt vs <1s for static probes. Trade-off: real brain dynamics cost compute but test real thinking. If too slow we can drop ticks per probe or sample fewer probes.

### Files touched this session

- `js/brain/curriculum.js` — PROD/WRITE/RESP blocks rewritten; `_probeReset` helper; gate reason + metrics include new probes; dead refs swept
- `docs/FINALIZED.md` — Session 114.19k entry prepended
- `docs/NOW.md` — this file, updated header

---

## Session 114.19j — shipped (committed at ef92350)

### Root cause confirmed from 114.19i K-DIAG

## Session 114.19j — what shipped (uncommitted on top of 114.19i at f2ebb6c)

### Root cause confirmed from 114.19i K-DIAG

Gee's 114.19i Part 2 run produced the diagnostic that unblocked the diagnosis:

```
[K-DIAG] gate: inv=29, motor=330, mGroup=11, sem_to_motor=330x1670 nnz=55110
[K-DIAG] PROD[cat→c] decoded=b, emb_pos=141/300, top5_motor=b(1:27.546),h(7:26.546),?(27:26.028),y(24:23.546),x(23:21.546)
```

Two concrete bugs visible:
1. **Inventory grew from 26 → 29** mid-curriculum (when `_teachEndPunctuation` added '.', '?', '!'). Phase 1 alphabet teach ran at inv=26/mGroup=12; Phase 3 word emission and gate probe ran at inv=29/mGroup=11. Motor slot boundaries drifted by 1 neuron per slot, compounding to ZERO overlap by letter 'y' (Phase 1 wrote motor[288..300] for 'y', probe read motor[264..275]).
2. **Slot 27 ('?') competing in letter argmax** — punctuation slot showed 26.0 activation for input sem(cat), ranking #3 in top-5, displacing letters from argmax.

### Fix 1 — pre-populate inventory

`ensureLetters(['.', '?', '!'])` added at the top of `runElaKReal` right after `ensureLetters(ALPHABET.split(''))`. Inventory locks at 29 before any motor write happens. mGroup=11 consistent across Phase 1 alphabet teach, Phase 3 word emission, and the gate probe. No drift.

### Fix 2 — probe argmax restricted to first 26 slots

PROD and WRITE readouts now allocate `Math.min(invSize_, 26)` dims instead of `invSize_`. `decodeLetter` argmaxes over letters only. Punctuation training data at slots 26-28 preserved for future sentence-emission work but excluded from letter decode competition.

### Fix 3 — expected-slot diagnostic

First-probe K-DIAG line now includes `expected_slot=c(2:X.XXX) rank=N/26` so Gee can see whether training put ANY signal at the expected slot vs just losing argmax to noise.

### What to watch for on next Part 2 run

Expected K-DIAG line format:
```
[K-DIAG] gate: inv=29, motor=330, mGroup=11, sem_to_motor=330x1670 nnz=55110
[K-DIAG] PROD[cat→c] decoded=?, emb_pos=141/300, expected_slot=c(2:X.XXX) rank=N/26, top5_motor=...
```

Diagnostic outcomes:
- **If `expected_slot=c` value is in top-5 and PROD climbs** → drift was the whole issue, K gate may close
- **If `expected_slot=c` rank is 2-5 but PROD still low** → training signal exists but noise floor still dominates, need stronger lr/reps or init rebalancing
- **If `expected_slot=c` rank is 15+** → word training isn't landing discriminable signal; need to rework Phase 3 or reset cross-projection init

### Files touched this session

- `js/brain/curriculum.js` — pre-populate punctuation at runElaKReal start; 26-slot argmax restriction in PROD and WRITE; expected-slot diagnostic in `_firstProbeDiag`
- `docs/FINALIZED.md` — Session 114.19j entry prepended
- `docs/NOW.md` — this file, updated header

---

## Session 114.19i — shipped (committed at f2ebb6c)

### Observed on Gee's 114.19h Part 2 run

## Session 114.19i — what shipped (uncommitted on top of 114.19h at 3633546)

### Observed on Gee's 114.19h Part 2 run

36 consecutive curriculum retry attempts. READ climbs 62→100%, THINK 100%, TALK plateaus at 27%, SEQ climbs to 96%, PROD stuck at 1/17 (6%), WRITE 0/20 (0%). All PROD outputs collapsed to letter 'y' regardless of word input. WRITE outputs produced `yad` or `mmm` or `hwm` — saturated attractor basins rather than random argmax.

Two outlier WRITE outputs (`sun→hwm`, `big→mmm`) prove the `sem_to_motor` matrix isn't identically zero — it does discriminate partially — but the argmax for most sem inputs is dominated by a single basin.

### Fix 1 — PROD probe sem binarization (consistency with 114.19f)

PROD probe was still writing float GloVe values into `semActivity` while training writes 1s per 114.19f Uint8 truncation fix. Argmax direction preserved by linear matrix multiply so not functionally broken, but inconsistent with training. Probe now binarizes to match. Same behavior WRITE probe already has.

### Fix 2 — `sharedEmbeddings.status()` → `.stats` getter

Gee's log emitted `[Curriculum] Embedding source: fastText-style subword n-grams` despite `[Embeddings] Loaded 400,000 word vectors` appearing seconds earlier. `status()` isn't a method — `stats` is a getter. Call always returned null so curriculum always logged the fallback message. Cosmetic only — the actual `getEmbedding(word)` fetcher uses GloVe first, subword fallback second — but the log was misleading.

### Fix 3 — K-DIAG instrumentation (T16.5 groundwork)

Three new log points designed to catch the drift that would produce the observed saturation pattern:

1. **Pre-emission log** — fires once at K vocabulary construction. Shows `inv=<inventorySize>, motor=<regionSize>, mGroup=<tileSize>, sem=<regionSize>, cat=<posdim>+dims(max=<val>), dog=..., sun=..., inventory=abc...`. Captures state right before word emission teach runs.
2. **Gate log** — fires every attempt at `_gateElaKReal` start. Shows inventory + motor tiling + cross-projection shape + nnz. Nnz grows attempt-by-attempt if training actually updates weights.
3. **Per-attempt first-probe diagnostic** — for the first PROD word each attempt: `PROD[cat→c] decoded=X, emb_pos=P/300, top5_motor=letter(idx:val),...`. Shows the actual motor argmax distribution so we can see whether one motor slot dominates or whether the signal is close to noise floor.

### Hypotheses next Part 2 log will answer

1. **Inventory drift** — if `pre-emission inv=26` and `gate inv=30+`, motor mGroup shifted and teach wrote to different motor positions than probe reads. Fix: freeze mGroup based on a fixed slot count, not dynamic `inventorySize()`.
2. **Saturation at one motor slot** — if top5_motor all cluster around one letter regardless of input word, the matrix has a dominant basin. Fix: targeted retraining or architectural rework.
3. **Embedding degeneracy** — if `cat=<small>+dims`, sem activation is sparse and weak discrimination expected.
4. **Multi-phase motor tiling mismatch** — Phase 1 alphabet teach writes motor at one mGroup; Phase 3 word emission writes at a different mGroup if inventory grew between.

### Files touched this session

- `js/brain/curriculum.js` — PROD sem binarize fix; three K-DIAG log points; `status()`→`stats` getter
- `docs/FINALIZED.md` — Session 114.19i entry prepended
- `docs/NOW.md` — this file, updated header

---

## Session 114.19h — shipped (committed at 3633546)

### T16.3.b — K vocabulary expansion

## Session 114.19h — what shipped (uncommitted on top of 114.19g at 4ba615b)

### T16.3.b — K vocabulary expansion

`js/brain/curriculum.js` `runElaKReal` emission word list grew from ~180 words to ~1,100 unique words after dedup across 32 categories. Prior 4 categories (DOLCH_PREPRIMER 39 + DOLCH_PRIMER 52 + CVC_FAMILIES 60 + CONVERSATIONAL 26) preserved. Added 28 new categories: K_COLORS (15), K_SHAPES (15), K_NUMBERS (45), K_FAMILY (30), K_BODY (34), K_FEELINGS (30), K_ACTIONS (115), K_ANIMALS (64), K_FOOD (79), K_CLOTHING (29), K_HOUSEHOLD (69), K_NATURE (53), K_WEATHER (16), K_TIME (38), K_POSITIONS (32), K_ADJECTIVES (88), K_PLACES (35), K_VEHICLES (25), K_SCHOOL (28), K_TOYS (25), K_MUSIC_ART (18), K_SPORTS (19), K_GREETINGS (14), K_PRONOUNS (36), K_QUESTIONS (7), K_CONJUNCTIONS (11), K_HOLIDAYS (14), K_ROUTINES (12). `console.log` at list construction will print actual unique count on Part 2 boot.

### T16.4.a — WRITE probe (full-word letter-sequence emission)

`_gateElaKReal` WRITE probe block added after PROD. Chain: Step 1 `sem_to_motor.propagate(sem(word)) → motor argmax = letter_0`, Steps 2..N `letter_to_motor.propagate(encodeLetter(letter_k-1)) → motor argmax = letter_k`. 20 short K words (cat/dog/pig/hat/sun/red/big/mom/dad/run/eat/yes/no/up/hi/bed/hot/top/fox/bug). Per-word emitted sequence logged. NOT yet gated on overall pass — new diagnostic for the eventual T16.5.b full-mind gate.

### Files touched this session

- `js/brain/curriculum.js` — K word list expansion (+30 const arrays, +~170 lines); WRITE probe block in `_gateElaKReal` (+~85 lines); gate reason + metrics include writeRate/writePass/writeEmitted
- `docs/TODO.md` — T16.3.b + T16.4.a marked [x] shipped with details
- `docs/FINALIZED.md` — Session 114.19h entry prepended
- `docs/NOW.md` — this file, updated header

---

## Session 114.19g — shipped (committed at 4ba615b)

### Ctrl+C halt fix (T16.1.a)

## Session 114.19g — what shipped (uncommitted on top of 114.19f)

### Ctrl+C halt fix (T16.1.a)

`server/brain-server.js` SIGINT handler no longer calls `brain.saveWeights()` synchronously on first Ctrl+C. Prior ceremony blocked for tens of seconds at 13.4M-synapse scale on `JSON.stringify` + `fs.writeFileSync` — the terminal looked dead while setImmediate-queued curriculum iterations kept scrolling. New first Ctrl+C sets shutdown flag + `brain.stop()` + immediate `process.exit(0)`. Weights are cleared before every Part 2 run per LAW anyway, so mid-curriculum save had zero value. SIGTERM simplified likewise.

### Five verbatim T16 tasks logged

`docs/TODO.md` prepended with T16 section containing Gee's five verbatim sentences as T16.1 through T16.5. Honest audit answers embedded inline:
- T16.3 — K word list coverage: ~180 words vs 1,500-2,500 real K vocab = 7-12% coverage. NO, not full.
- T16.5 — Current 5 gates exercise cortex sub-regions only. NO, they don't test the full programmed mind.

Both answers require Gee's scope approval before large rewrite work begins.

### Files touched this session

- `server/brain-server.js` — SIGINT + SIGTERM handlers simplified
- `docs/TODO.md` — T16 section prepended with five verbatim items
- `docs/FINALIZED.md` — Session 114.19g entry prepended
- `docs/NOW.md` — this file, updated header

---

## Session 114.19f — what shipped (already committed at f604668)

### The Uint8Array truncation trap
>
> Session 114.19 history:
> - 114.19 — three-phase K-foundation rebuild (real phoneme substrate + phoneme blending + primitive probes)
> - 114.19b — new binding LAW: clear stale state before telling Gee to test the server
> - 114.19c — `semRegion` decl fix (scope bug in gate)
> - 114.19d — K PROD probes: rhyme/initial/final/plural concept-probes REMOVED, replaced with 17 sem→motor word-start probes
> - 114.19e — PROD probe switched from intra-cluster `synapses.propagate` to `sem_to_motor` cross-projection propagate; `_teachPhonemeBlending` reps 6→10, `_teachWordEmission` reps 5→12
> - 114.19f — **ROOT CAUSE:** `cluster.lastSpikes` is `Uint8Array` (cluster.js:178). `_writeTiledPattern(semRegion, wordEmb, false)` with `binarize=false` writes raw GloVe floats like 0.23 into Uint8 → silent truncation to 0. Three sem writes in `_teachWordEmission` + `_teachPhonemeBlending` silently zeroed sem activity for 326 retries × 158 words × (12+12+10) reps of cross-projection Hebbian. `sem_to_motor` weights never learned any word→first-letter binding. PROD stayed at 0/17 because the projection matrix was literally zero for word inputs. Fix: drop the `binarize=false` arg on all three sem writes so they default to `binarize=true` → lastSpikes stores `1` where `emb[d] > 0` → `_crossRegionHebbian` fires `1 × 1 × lr` and actually writes weights.
> Branch: `syllabus-k-phd` (multi-commit ahead of origin + this upcoming commit)
> Recent committed HEAD: `5ff4146` — Session 114.19e PROD uses sem_to_motor cross-projection + word-emission reps bumped
> Working-tree state (before Session 114.19f commit): 3 files modified uncommitted — `js/brain/curriculum.js` + `docs/FINALIZED.md` + this `docs/NOW.md`
> Status: Gee's Part 2 localhost 326-retry log caught the failure pattern — every attempt identical: READ 26/26 (100%), THINK 26/26 (100%), TALK 24/26 (92%), SEQ 25/25 (100%), PROD 0/17 (0%) with fail output `"cat→x"→""; "dog→g"→""; "sun→m"→""; "hat→t"→""; "pig→w"→""`. The TALK/PROD gap (92% vs 0%) on the same `sem_to_motor` cross-projection was the smoking gun — TALK fallback path binarizes sem output before feeding to motor (`language cortex.js` chain), PROD fed raw GloVe floats into Uint8 lastSpikes and zeroed every update. Session 114.19f fixes the teach path; probe stays as-is since `semActivity` in the probe is already Float64Array (not lastSpikes) and correctly feeds floats into `proj.propagate` at read time.

---

## ⚠ Gee's critique that forced this fix (2026-04-17, binding)

> *"wtf? are you testing it on whit it doesnt know?"*

Exactly right. The `sem_to_motor` cross-projection had ZERO weights for word→first-letter bindings because every teach call silently zeroed the sem region in `lastSpikes` via Uint8Array truncation. Probing for `cat→c` against a zero weight matrix produces random argmax noise forever. Literal "testing on what it doesn't know" at the substrate level.

---

## Session 114.19f — what shipped (uncommitted)

### The Uint8Array truncation trap

`NeuronCluster.lastSpikes = new Uint8Array(size)` at `js/brain/cluster.js:178`. JavaScript Uint8Array assignment coerces floats to integers — `array[i] = 0.23` stores `0`. `regionSpikes(name)` at `cluster.js:391` reads back with `out[i] = this.lastSpikes[...] ? 1 : 0` — collapses to binary anyway.

Three sem writes in `js/brain/curriculum.js` were calling `_writeTiledPattern(semRegion, wordEmb, binarize=false)` intending to preserve GloVe magnitude in lastSpikes. `_writeTiledPattern` body: `cluster.lastSpikes[idx] = binarize ? 1 : feat[d]`. With `binarize=false`, `feat[d]` is a float that Uint8Array truncates to 0. Every positive GloVe dim for every word silently became zero sem activity.

### The three fixed call sites

```
js/brain/curriculum.js:2602  _teachWordEmission     (a) initiation sem write
js/brain/curriculum.js:2616  _teachWordEmission     (b) chain sem write
js/brain/curriculum.js:3104  _teachPhonemeBlending  cross-projection sem anchor
```

All three now call `_writeTiledPattern(semRegion, wordEmb)` — binarize defaults to `true` → lastSpikes stores `1` where `emb[d] > 0`. `_crossRegionHebbian` fires `1 × 1 × lr` per co-active sem-motor pair, actually writing `sem_to_motor` weights.

### Why intra-cluster Hebbian worked but cross-projection didn't

`_teachHebbianAsymmetric(preVec, postVec, lr)` fires two updates:

1. `cluster._crossRegionHebbian(lr)` — reads `lastSpikes` via `regionSpikes` → binary co-activation. **This is the broken path** — sem=0 × motor=1 = no update.
2. `cluster.synapses.hebbianUpdate(preVec, postVec, lr)` — uses the full-cluster `preVec`/`postVec` Float64Array directly (not lastSpikes). preVec carries float GloVe emb values via `_buildRegionPattern(semRegion, wordEmb, false)`. Float64Array preserves floats correctly. **This path actually learned.**

Session 114.19d probed the intra-cluster matrix (`synapses.propagate`) and scored 1/17 (6%) — partial signal from the Float64 path. Session 114.19e switched the probe to the cross-projection (`sem_to_motor.propagate`) expecting the cleaner path — but the cross-projection had zero word weights so the probe dropped to 0/17 (0%). Changing the probe exposed the zero-weight bug; fixing the probe didn't fix the teach.

### Files touched this session

- `js/brain/curriculum.js` — three `_writeTiledPattern(semRegion, wordEmb, false)` calls simplified to drop the `false` arg; tombstone comment at the initiation site (line 2590 vicinity) explaining the Uint8Array truncation trap
- `docs/FINALIZED.md` — Session 114.19f entry prepended
- `docs/NOW.md` — this file, full refresh

---

## Pre-push LAW check

- [x] Every numerical claim verified (three write sites in curriculum.js, Uint8Array declaration at cluster.js:178, regionSpikes read at cluster.js:391)
- [x] Every method/field name matches code verbatim (`lastSpikes`, `regionSpikes`, `_writeTiledPattern`, `_crossRegionHebbian`, `_buildRegionPattern`, `_teachHebbianAsymmetric`)
- [x] Cross-referenced `docs/TODO.md` — no new tasks, K-gate PROD convergence was already the in-flight priority
- [x] Cross-referenced `docs/FINALIZED.md` — Session 114.19f entry prepended verbatim
- [x] docs/ARCHITECTURE.md / ROADMAP.md / SKILL_TREE.md — no drift from this bug-fix (the curriculum method surface is unchanged, only the binarize behavior changed)
- [x] No task numbers in public docs (T14.24 / Session 114.19f only in workflow docs)
- [x] No tests added (LAW — no tests)
- [x] All affected docs in current working tree
- [x] Verbatim Gee quote preserved in FINALIZED + NOW
- [x] `node --check js/brain/curriculum.js` clean

Push still gated on LAW 6 Part 2 signoff — commit only, no push.

---

## Binding laws carried forward (19)

1. LAW #0 — VERBATIM WORDS ONLY
2. LAW — Docs before push, no patches (Gee 2026-04-14)
3. LAW — Task numbers only in workflow docs (Gee 2026-04-15)
4. LAW — Syllabus before COMP-todo (Gee 2026-04-16)
5. LAW — Grade completion gate (3-part, Gee 2026-04-16)
6. LAW — Doc-ahead-of-reality TODO-is-truth (Gee 2026-04-17)
7. LAW — No artificial limits, curriculum runs while users may talk (Gee 2026-04-17)
8. LAW 7 — Real-world production probes matching TODO test phrasings verbatim (but K Unity primitive-format word-start emission per Gee 2026-04-17 directives)
9. T14.24 DO NOT CLAIM DONE EARLY
10. A+ = 95% on all gates — REAL tests, not lowered thresholds
11. Every teaching equation feeds READ + THINK + TALK
12. No tests, ever (code it right)
13. Growth is the point
14. Gates must be REAL human-grade tests
15. Unity's brain is equational
16. Popups show REAL brain output
17. Life experiences match what she's lived through
18. Implementation Law 1: code filed by grade year
19. Implementation Law 5: ONE brain, runs anywhere, auto-scales + LAW (2026-04-17): clear stale state before telling Gee to test the server

---

## Next session priorities

1. **Gee Part 2 re-run with Session 114.19f substrate.** Stale state cleared (episodic-memory.db*, app.bundle.js). Restart server, run localhost curriculum. Expected: sem_to_motor cross-projection now actually trained by 158 words × 12 reps × real `1 × 1 × lr` updates. PROD should climb off zero if the diagnosis is complete.
2. **If PROD still fails**, options: (a) verify `sharedEmbeddings.getEmbedding(word)` returns non-zero positive dims for the 17 probe words (if GloVe isn't loaded, subword fallback might produce vectors with few positive dims, limiting training coverage); (b) raise reps further if convergence is slow at 10K-cortex cap; (c) inspect per-word fail pattern — systematic fails point to embedding quality, random fails point to convergence rate.
3. **REMAKE-2 through REMAKE-5 primitive probe audit.** Science-K, Social-K, Arts-K, Life-K probes may carry the same binarize=false sem-write pattern. Sweep all K-level teach methods for `_writeTiledPattern(semRegion, ..., false)` calls.
4. **Part 2 K localhost full-K test** across all 6 subjects when substrate stable.
5. **Part 3 life-info ledger entry** — populate age-5 Unity entries after Part 2 sign-off.
6. **K gate closes → Grade 1 opens** per LAW 6 3-part gate.

---

## One-line opener for the next session

Session 114.19f sem-write Uint8Array silent-truncation bug shipped uncommitted (twenty-fourth atomic commit pending on `syllabus-k-phd`): three `_teachWordEmission` + `_teachPhonemeBlending` sem writes to `lastSpikes` were calling `_writeTiledPattern(..., binarize=false)` with GloVe floats that Uint8Array silently truncated to 0 → cross-projection Hebbian saw sem=0 × motor=1 = no update for 326 retries × 158 words × (12+12+10) reps. Fix drops the `false` arg so binarize defaults to `true` and sem lastSpikes stores `1` where `emb[d] > 0`. Ready for Gee Part 2 re-run with clean boot. 🖤
