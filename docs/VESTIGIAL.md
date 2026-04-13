# VESTIGIAL — Dead Code That Survived The Orphan Sweep

> **Audit date:** 2026-04-13 (R1.2 of brain-refactor-full-control)
> **Scope:** Code that exists but isn't called, commented-out blocks, half-finished features, duplicate implementations, orphan scaffolding. The prior orphan sweep (U302-U310) caught 13 big items; this audit catches the smaller fish that slipped through.

**Classification:**
- **DELETE** — unused, delete immediately
- **DELETE-AFTER-R2** — currently used but will be obsolete once semantic grounding lands
- **INTEGRATE** — exists but isn't wired into the active path
- **VERIFY** — suspected dead, needs runtime confirmation before removal
- **KEEP-REFERENCE** — intentionally dead but referenced by docs (HHNeuron pattern)

---

## 1. `js/brain/dictionary.js` — Orphan `_seed()` method (DELETE)

**Lines 52-140** — The entire `_seed()` method is never called. The constructor comment at line 49 explicitly says `// No seed — brain learns every word from conversation, same as a human`. Grep confirms zero call sites anywhere in the codebase.

The method contains:
- 87 lines of hardcoded word seeds with arousal/valence tuples (`['yeah', 0.9, 0.6]`, `['fuck', 0.95, 0.1]`, etc.)
- 40+ lines of hardcoded bigram networks (`['gonna', 'feel']`, `['i\'m', 'high']`, etc.)
- A loop at lines 89-91 calling `this.learnWord` on each seed
- A loop at lines 136-139 calling `this.learnBigram` on each flow

**Why it's still in the file:** survived from pre-equational refactor when the brain boot-seeded a starter vocabulary. Replaced by corpus-driven learning (persona + baseline + coding files) but the method was never removed.

**Action:** DELETE the entire `_seed` method. Zero references, zero behavioral risk.

---

## 2. `js/brain/language-cortex.js` — Defensive `findByPattern` fallback (DELETE-AFTER-R2)

**Line 3753** inside `learnSentence`:
```js
if (!fromPersona && !cortexPattern && dictionary && dictionary.findByPattern) {
  const similar = dictionary.findByPattern(pat, 3) || [];
  // ...
}
```

This path runs when (a) not loading from persona, (b) no cortex pattern provided. It was the original O(N²) boot-hang bug from commit `74c402e` — each learned word triggered a full dictionary scan looking for similar patterns. The persona-load path correctly skips it, but the LIVE conversation path still hits it.

**After R2.1** (embeddings promoted to substrate), pattern similarity becomes a hash-table lookup over semantic space instead of an O(N) letter-hash scan, so the guard becomes unnecessary — similarity lookups are cheap. Move to native semantic path.

**Action:** DELETE the entire conditional after R2.2 lands. Part of the dictionary rewrite.

---

## 3. `js/brain/dictionary.js:252, 276, 300` — `findByMood` / `findByPattern` (DELETE-AFTER-R2)

`findByMood(arousal, valence, count)` at line 252 and `findByPattern(pattern, count)` at line 276 are still called from `language-cortex.js:2189, 2199` and `_getContextualWord` at line 300.

After R2:
- `findByPattern` gets replaced by semantic cosine lookup — the IMPLEMENTATION changes but the method name stays
- `findByMood` is a separate mood-based retrieval path and can stay (mood is orthogonal to semantics)

**Action:** KEEP method names, REWRITE implementations in R2.2 to use semantic space. The current letter-hash `findByPattern` becomes dead-in-practice but the API contract is preserved.

---

## 4. `js/brain/inner-voice.js:135-158` — Stale comment block about removed hot paths

**Lines 135-158** contain a large comment block explaining that `findByPattern`/`findByMood` were stripped from `think()` for perf reasons (commit `a0162cf`). The comment is accurate but now misleading — it describes a PAST bug that's been fixed and a PAST architecture that's being replaced.

**Action:** TRIM to a single line referencing commit `a0162cf` for history. Delete the multi-line explanation once R2 ships (the whole inner-voice.think() behavior will change).

---

## 5. `js/brain/neurons.js` — `HHNeuron` reference implementation (KEEP-REFERENCE)

**Lines 66-198** — Hodgkin-Huxley neuron class, not called by the runtime (`cluster.js` imports `LIFPopulation` directly). The header comment at lines 4-19 explicitly documents this as a reference implementation backing `brain-equations.html`. Confirmed in U305 (FINALIZED.md entry).

**Action:** KEEP as-is. Referenced by the teaching page. Not truly dead.

**Note for R10.3:** `brain-equations.html` must continue to reference HHNeuron — don't delete it during doc rewrite.

---

## 6. `js/brain/language.js` BrocasArea — Partially dead already (DELETE-AFTER-R4)

The entire class is a candidate for deletion or radical trimming per R4.1. Current state as of commit `8d33c17`:

**What's still called:**
- `generate(brainState, userInput)` — called from `app.js:1273` (sandbox unity API chat), `app.js:1373` (greeting path), `engine.js:712, 887` (build_ui)
- `_buildPrompt(state)` — called from `app.js:1072` for `/think` display
- `_buildBuildPrompt(state, userInput)` — called internally by `generate` in build mode
- `abort()` — called from `engine.js:641`
- `connectLanguage(brocasArea)` gate at `engine.js:614`

**What's truly dead already:**
- Lines within `_buildPrompt` that reference removed features
- `_clusterSummary()` — verify grep, appears unused
- `_getSelfImageDesc()` — only used by `_buildPrompt`, dies with it

**Action:** DELETE entire class after R4.1 migration. Until then, EVERY method is in "pending-delete" state.

---

## 7. `js/brain/engine.js:614` — `connectLanguage` API

```js
connectLanguage(brocasArea) {
  this._brocasArea = brocasArea;
}
```

Single-line setter. Only meaningful if BrocasArea exists. Dies with R4.1.

**Action:** DELETE. Since the brain will speak equationally, there's no peripheral to "connect" for language.

---

## 8. `js/app.js:1352` — BrocasArea null-check gate

```js
if (brocasArea) {
  // ...
}
```

Defensive null check around BrocasArea consumer code. Dies with R4.1 — once BrocasArea is gone there's no variable to check.

**Action:** DELETE block + the null check together in R4.1.

---

## 9. `claude-proxy.js` (top-level file) — Obsolete dev tool (DELETE)

**File:** `claude-proxy.js`, ~100 lines, top-level.

Purpose: exposes the user's logged-in Claude Code CLI (`claude -p`) as an OpenAI-compatible `/v1/chat/completions` HTTP endpoint on localhost:8088. Was a dev convenience so Unity could use the Claude Max subscription as a text-AI backend without paying for API tokens.

**Obsolete because:** R4 kills text-AI backends entirely. No more OpenAI-compatible routing. This file serves no purpose in the post-refactor architecture.

**Action:** DELETE entire file. Verify no references remain in `README.md`, `SETUP.md`, `docs/ARCHITECTURE.md`, `.claude/start.bat` before committing the deletion.

---

## 10. `js/brain/benchmark.js` runBenchmark / runScaleTest — Development tool, KEEP

**Lines 163, 218** — already wired to `/bench` and `/scale-test` slash commands via `app.js:1138`. Not dead.

**Action:** KEEP as-is. Just flagging because a dead-code sweep might flag these as "only called from one place".

---

## 11. `js/brain/engine.js:712` — `_handleBuild` AI path duplication

**Lines 712-900 (ish)** — `_handleBuild` still calls `brocasArea.generate()` for build_ui mode even though the equational text-response path at line 775 explicitly bypasses BrocasArea for chat. This is an INCONSISTENCY — some paths are equational, some still use AI.

```js
// engine.js:712
if (effectiveAction === 'build_ui' && this._brocasArea && this._sandbox) {
  // ... build JSON prompt
  let raw = await this._brocasArea.generate(this.getState(), buildInput);
  // ... parse JSON, inject into sandbox
}
```

**Action:** REPLACE in R6.2 with component synthesis. The whole `_handleBuild` method rewrites to call `componentSynth.generate(userRequest, brainState)` instead. Not dead yet, but on the delete list.

---

## 12. `js/app.js:1072` — `/think` command builds AI prompt

```js
const prompt = brocasArea._buildPrompt(state);
```

The `/think` slash command is meant to DISPLAY the brain state that would be sent to the AI model. After R4 there IS no AI prompt — there's just brain state. The command should show the raw brain state dump, not a constructed prompt.

**Action:** REWRITE in R4.1. The `/think` handler becomes: "dump `brain.getState()` as JSON into the sandbox for inspection". No BrocasArea involvement.

---

## 13. `js/app.js:1373` — Greeting path via BrocasArea

```js
const text = await brocasArea.generate(state, prompt);
```

Some greeting/welcome path uses BrocasArea to generate Unity's first line on boot.

**Action:** REPLACE in R4.1. Route through `brain.processAndRespond(greetingTrigger)` so the first emission also comes from the equational language cortex. Or better: let the brain spontaneously emit a greeting when `socialNeed × arousal × coherence > speechThreshold` on boot.

---

## 14. `js/brain/sensory.js` — `bgCurrent` sized 150 (hardcode)

**Line 48:**
```js
this.bgCurrent = new Float64Array(150);  // basal ganglia — 6 channels × 25 neurons
```

Hardcoded BG size. Matches `motor.js:24` (`BG_SIZE = 150`), but if the client brain rescales (R6.1 note in TODO), this breaks.

**Action:** REPLACE-EQUATIONAL — allocate from `brain.clusters.basalGanglia.size`. Low priority, documented in KILL_LIST §6.1.

---

## 15. Commented-out code blocks (GREP SWEEP)

Grep for `^\s*//` lines that look like commented-out code (not documentation comments):
- `js/brain/inner-voice.js:135-158` — the big NOTE block (covered in §4 above)
- Any `//` followed by `import`, `const`, `let`, `var`, `function`, `class` — those are commented-out code
- Any `/* ... */` multi-line blocks with executable-looking content

**Action:** Single grep sweep in R12.3 cleanup pass. For now, not enough instances to list individually.

---

## 16. Duplicate definitions (VERIFY)

- `js/brain/engine.js:53-61` client `CLUSTER_SIZES` constants vs `server/brain-server.js:122-130` server `CLUSTER_SIZES` with `SCALE` multiplier — these are intentional different-brain definitions, not duplicates
- `js/brain/motor.js:24-27` `BG_SIZE = 150, CHANNELS = 6, NEURONS_PER_CHANNEL = 25` vs `js/brain/sensory.js:48` `bgCurrent = new Float64Array(150)` — SAME NUMBER but derived independently. If either changes, the other breaks. Should share a single source of truth.

**Action:** CONSOLIDATE in R5 — move BG layout constants to a shared constant file imported by both motor and sensory.

---

## 17. Empty / unused fields in constructors

### `js/brain/dictionary.js:44`
```js
this._sentenceBuffer = [];
```
"Current sentence being constructed" — grep for `_sentenceBuffer` to verify it's read anywhere.

**Action:** VERIFY, likely DELETE.

### `js/brain/language-cortex.js` — various `_recent*` fields
- `_recentSentences` — used, keep
- `_recentOpenerNgrams` — used (tonight's fix), keep
- `_recentOutputWords` — used, keep
- Any other `_recent*` that grep shows only assigned-to, never read — delete

**Action:** Grep-based verification during R2.3 rewrite.

---

## 18. Summary

| Category | Count | Priority |
|----------|-------|----------|
| Orphan methods (`_seed`) | 1 (90 lines) | IMMEDIATE — can delete standalone |
| Dead defensive fallbacks (`findByPattern` O(N²) guard) | 1 | AFTER R2.2 |
| BrocasArea class + every caller | ~12 call sites | AFTER R4.1 |
| Obsolete dev tools (`claude-proxy.js`) | 1 file | IMMEDIATE — can delete standalone |
| Stale comment blocks | 1 (inner-voice NOTE) | R12.3 cleanup |
| Hardcoded sizes that should be derived | 2 | R5 consolidation |
| Empty constructor fields (suspected) | 1-2 | R12.3 verify + delete |

**Standalone deletions available right now (independent of R2-R11):**
1. `js/brain/dictionary.js` `_seed()` method — 90 lines
2. `claude-proxy.js` top-level file — 100 lines

Both are zero-risk, zero-dependency, just grep-confirmed dead. Can ship as a first cleanup commit before R2 kicks off.

---

*Unity AI Lab — dead code is a lie. Delete it or use it.*
