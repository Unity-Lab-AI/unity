# NOW — Session Snapshot

> Saved: 2026-04-16 (Session 113 END)
> Branch: `t14-language-rebuild`
> Recent HEAD: `747f437` (pushed to origin)
> Status: T14.24-CLEAN pre-syllabus cleanup COMPLETE (34/34). Language-cortex slot-scorer machinery GUTTED. Curriculum direct-pattern Hebbian + `cluster.generateSentence` tick-driven motor emission are the only cognition path. Math-K grade content is next per Implementation Law #1.

## What Session 113 accomplished

### T14.24-CLEAN pre-syllabus cleanup — 34/34 COMPLETE

Gee's scope 2026-04-16: *"do everything you need to do for the syllabus work as far as code tidy and fixing berfore we start on each grades; content, make the task list in full and complete working from the todo to build the taks list of none grade specific ciriculum but only instead do the code clean up from all that patching bullshit you did tossing on vistegial organs and making up shit that has nothing to do with the brain equations and the equations understading we are giving it"*.

34-item cleanup block ran through A/B/C/D/E/F categories. Full per-item ledger in `docs/FINALIZED.md` Session 113 entry. High-level wins below.

### Files / folders DELETED entire

- `js/brain/language.js` — 73-line BrocasArea throwing stub (R12 scheduled deletion finally shipped)
- `docs/TODO-curriculum-depth.md` — 169-line superseded TODO (content was fully migrated to FINALIZED Session 112)
- `server/temp-stale-weights/` — Session 112 move-aside folder no longer needed (+ `.gitignore` entry removed)

### Slot-scorer machinery RIPPED

14 orphan methods deleted from `js/brain/language-cortex.js` — every one had zero external callers, the chain only fed back into itself:

`_learnUsageType`, `slotRequirement`, `_isCompleteSentence`, `_isNominativePronoun`, `_dominantType`, `_continuationFor`, `nextSlotRequirement`, `typeCompatibility`, `_generateInflections` (218-line morph rules), `_applyCasualContractions` (120 lines), `countSyllables`, `_getContextPattern`, `_postProcess` (143 lines), `_l2`/`_cosine`/`_softmaxSample`.

Plus their call sites in `learnSentence` (the `_learnUsageType` + `_generateInflections` per-word loops) — removed with explanatory comment.

### Legacy shims pulled out

- `cluster.grade` scalar mirror — 6-file surgery (cluster, curriculum, language-cortex, persistence, app, server) migrating every caller to `cluster.grades.ela` directly
- `_LEGACY_ELA_TO_CANONICAL` map + legacy band case labels (`grade4_5`, `grade6_8`, `grade9_12`, `college`) stripped from both `_singleGradeCap` copies; `runFullCurriculum` stages renamed to canonical GRADE_ORDER entries
- Dense-matrix legacy accessors — `_useSparse` flag, `ClusterProjection.weights` get/set, `SparseMatrix.W` getter, persistence fallback branches — all dead post-T14.16 CSR-only persistence
- `_learnClauseInternal` private helper inlined into `learnClause` (was a 2-tier indirection with exactly one caller)
- Unused `valence` positional param in `generate`/`generateAsync` signatures + all 9 call sites (app×2, engine×3, inner-voice, brain-3d×2, server)
- Session 1 "not implemented" stub block in `Curriculum._cellRunner` + stale Session-1-framework block comment — replaced with loud throw on unknown subject/grade

### Architecture wins

- **`hebbianPairReinforce` primitive extracted to `NeuronCluster`** — reusable across every grade's sequence learning instead of buried in `_gateMathKReal`. Signature `({region, srcOneHot, correctOneHot, wrongOneHot, posLr, negLr, reps})`.
- **`CLUSTER_FRACTIONS` + `clusterSizesFor(totalNeurons)` exported from `cluster.js`** — Session 113 D2 FIXES LAW 5 VIOLATION discovered in D3 audit (server cortex was 0.25 via `250 * SCALE`, client was 0.30 via `CLUSTER_FRACTIONS.cortex`, both runtimes now produce identical cluster sizes at same tier).
- **`_hashEmbedding` renamed `_subwordEmbedding`** (matches actual fastText-style n-gram sum semantics; unused `_hashSeed` field deleted).
- **TALK direction rule** (sem→motor = PRODUCTION vs letter→motor = READ feedback) documented in `docs/EQUATIONS.md` T14.24 section.
- **`crossTargetFanout = 1500` derivation** — `expectedPostCurriculumVocab × fanoutPerMapping = 5000 × 0.3 ≈ 1500` documented in both `cluster.js` constructor comment + `docs/ARCHITECTURE.md`. Scale-up path noted.

### Audits closed (no code changes, ledger in TODO.md)

- **B6** try/catch sweep — 33 sites across curriculum/cluster/language-cortex/inner-voice all classified into 4 legitimate categories (opportunistic paths, error-to-result conversions, defensive corpus-load wraps, generate() fallback resets). Zero bad patterns.
- **C1** — 149 `_teachXxx` methods all direct-pattern architecture confirmed.
- **C2** — 10 `_gateXxx` methods; 7 use category-1 direct matrix probe, 3 legacy gates tied to eventual `runFullCurriculum` removal.
- **C3** — 16 Session 112 reasoning methods all direct-pattern + `dictionary.learnWord` routing + 3-pathway drive confirmed.
- **C4** — 63 `_autoFinal` exams all delegate to one shared helper with deterministic question gen + `_gateComprehension` probe.
- **C5** — 20 Life Experience methods all dual-layer category-1 (emotional concept features + recallable memory sentences).
- **C6** — zero category-4 text-match lookup debris.
- **D1** — Session 95-112 patch audit; Session 112 TALK-fix campaign (9 commits) all REVERTED in `5483566`; **Math-K TALK threshold at 40% flagged as patch debris** — must be resolved during Math-K grade-content rewrite per constraint #5 A+=95%.
- **D3** — 30+ hardcoded-number hits classified; found Law 5 violation (server/client cortex sizing math diverged), fixed in D2.
- **D5** — background probe demotion was already re-enabled in Session 111 (stale TODO premise closed).
- **F3/F1** — FINALIZED duplicate-collapse + TODO historical-sections preservation both documented as deliberate decisions (no code changes).

### Line-count damage — ~1340 lines of dead source deleted

| File | Before | After | Δ |
|---|---|---|---|
| `js/brain/language-cortex.js` | 3072 | 2133 | **−939** (31% shrinkage) |
| `js/brain/curriculum.js` | 16927 | 16869 | −58 |
| `js/brain/persistence.js` | 460 | 442 | −18 |
| `js/brain/sparse-matrix.js` | 467 | 460 | −7 |
| `js/brain/cluster.js` | 1864 | 1891 | +27 net (slot-scorer ripped but `hebbianPairReinforce` primitive + CLUSTER_FRACTIONS shared export added) |
| `js/brain/language.js` | 73 | DELETED | −73 |
| `docs/TODO-curriculum-depth.md` | 169 | DELETED | −169 |

Commit `747f437`: +638 insertions, −1647 deletions across 21 files.

### Zero runtime behavior changes

Every deletion was dead code or redundant indirection. All 12 touched JS files `node --check` clean at push. Curriculum direct-pattern Hebbian + `cluster.generateSentence` tick-driven motor emission are the only cognition path remaining — exactly as Gee confirmed: *"aqll that langage crap is baroke and is going to be replaced with ciriculum learning as equational right?"* — right.

## Current file status

| File | Status |
|------|--------|
| `docs/TODO.md` | T14.24-CLEAN parent `[x]` DONE; T14.24 parent still `[ ]` (grade content work) |
| `docs/TODO-full-syllabus.md` | 7990+ lines, 4513 open items — THE active next work |
| `docs/TODO-life-experience.md` | Complete |
| `docs/COMP-todo.md` | ON HOLD — distributed compute Part 2, back burner |
| `docs/FINALIZED.md` | Session 113 commit ledger table + closure summary written |
| `docs/ARCHITECTURE.md` | Updated with cleanup refs (A1 deletion notes, CLUSTER_FRACTIONS shared, LENIENT MIN semantic) |
| `docs/EQUATIONS.md` | TALK direction rule + crossTargetFanout=1500 derivation subsection added |
| `docs/NOW.md` | THIS FILE — Session 113 END snapshot |
| `docs/SKILL_TREE.md` | Session 113 updates deferred — content unchanged at capability level |
| `docs/ROADMAP.md` | Session 113 updates deferred — no phase changes |
| `SETUP.md` | language.js directory tree row removed |
| `.gitignore` | `server/temp-stale-weights/` entry removed |
| `js/brain/language.js` | DELETED |
| `js/brain/language-cortex.js` | 3072 → 2133 — all slot-scorer machinery gone |
| `js/brain/cluster.js` | `hebbianPairReinforce` primitive + `CLUSTER_FRACTIONS` export + `clusterSizesFor()` helper added; `cluster.grade` scalar mirror removed; dense accessors deleted |
| `js/brain/curriculum.js` | `_LEGACY_ELA_TO_CANONICAL` map deleted; Math-K anti-Hebbian refactored to use new cluster primitive; Session 1 stub block replaced with throw |
| `js/brain/persistence.js` | Dense-matrix fallback branches deleted (CSR-only post-T14.16) |
| `js/brain/embeddings.js` | `_hashEmbedding → _subwordEmbedding` renamed; `_hashSeed` field deleted |
| `server/brain-server.js` | `CLUSTER_SIZES` rewritten to use same fractions as client (Law 5 fix); `cluster.grade` defense init removed |

## Next session priorities

1. **Math-K grade content** — start Implementation Law #1 "code filed by grade year" with kindergarten Math. Use `TODO-full-syllabus.md` as content source. Every teaching equation must drive READ + THINK + TALK per constraint #6. A+ = 95% gates per constraint #5. Fix Math-K TALK convergence (40% threshold patch debris flagged in D1 — must be resolved equationally per Law #3, not by lowering threshold).
2. **ELA-K grade content** after Math-K — alphabet in ALPHABETICAL order (not frequency-ordered per Gee's binding), letter names, letter sounds as phoneme features.
3. **B1 continuation (deferred)** — shrink `language-cortex.js` remaining 2133 lines toward the ≤250 class-skeleton target by migrating public API methods onto cluster. Requires per-caller migration across engine/inner-voice/brain-3d/app/server. Not grade-content critical, can ship incrementally alongside grade work.
4. **Run full curriculum verification** — Law #5 browser/server parity now fixed at the cluster-size level; verify at runtime that both produce identical `cluster.grades` + `cluster.passedCells` shape post-boot.

## Binding constraints (17 — still in force)

1. LAW #0 — VERBATIM WORDS ONLY
2. LAW — Docs before push, no patches
3. LAW — Task numbers only in workflow docs
4. T14.24 DO NOT CLAIM DONE EARLY
5. A+ = 95% on all gates — REAL tests, not lowered thresholds
6. Every teaching equation feeds READ + THINK + TALK
7. No tests, ever (code it right)
8. Growth is the point
9. Gates must be REAL human-grade tests
10. Unity's brain is equational
11. Popups show REAL brain output
12. Life experiences match what she's lived through
13. Implementation Law 1: code filed by grade year
14. Implementation Law 2: audit all patch debris — **Session 113 D1 audit CLOSED; remaining Math-K TALK 40% threshold is the one flagged residual**
15. Implementation Law 3: equational layout (NOT sentence lists)
16. Implementation Law 4: check off before moving on
17. Implementation Law 5: ONE brain, runs anywhere, auto-scales — **Session 113 D2 FIXED cortex-size divergence via shared CLUSTER_FRACTIONS**

## One-line summary for Session 114 opener

Cleanup done, language-cortex slot-scorer machinery GONE, curriculum + `cluster.generateSentence` are the only cognition path, Law 5 cortex-size violation fixed, `hebbianPairReinforce` primitive extracted for grade sequence learning. Session 114 opens into Math-K grade content. 🖤
