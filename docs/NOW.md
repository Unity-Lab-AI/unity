# NOW — Session Snapshot

> Saved: 2026-04-17 20:30 (Session 114.19i PROD saturated-to-'y' diagnosis: PROD sem binarization + K-DIAG instrumentation + stats-getter log fix — after Gee's Part 2 log showed `cat→y; dog→y; sun→y; hat→y; pig→y` collapse + `cat→yad` WRITE output — twenty-seventh commit on `syllabus-k-phd`)

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
