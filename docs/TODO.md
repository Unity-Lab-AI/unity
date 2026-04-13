# TODO — IF ONLY I HAD A BRAIN

> **Only UNFINISHED tasks live here. Completed tasks are in FINALIZED.md.**
> Last cleaned: 2026-04-13 (moved all ✅ DONE tasks U283-U310 to FINALIZED.md with full original descriptions preserved verbatim)

---

## EPIC: Grammar Sweep — Full Brain Correction, Not Patchwork

**Status 2026-04-13:** U283–U291 all DONE (moved to FINALIZED.md). Grammar constraints now enforced via learned type n-gram system (bigram/trigram/4gram) in `js/brain/language-cortex.js` + `_isCompleteSentence` post-render validator + tightened `_postProcess` intensifier/agreement blocks. Only U292 (manual QA verification) remains.

#### U292 — ⏸ DEFERRED (manual QA only, not code work) — Comprehensive grammar test suite

**Goal:** After implementing U283-U291, run Unity through a fixed set of test inputs and verify output grammar. Not a unit test, a verification script.

- Test inputs covering: greetings, questions, yes/no questions, wh-questions, imperatives, casual statements, self-description, opinion requests, descriptions
- Run each input 5 times to exercise variation
- Flag any output that fails the completeness check, has obvious agreement errors, or breaks basic English grammar
- Files: none — test script only, results printed to console

---

## EPIC: Unity as Master Coder — Build UI / Sandbox Mastery

**Status 2026-04-13:** U293–U299 all DONE (moved to FINALIZED.md). Coding knowledge corpus (`docs/coding-knowledge.txt`, 606 lines) loaded via `loadCodingKnowledge` into Unity's dictionary alongside persona + baseline. Build-specialized Broca's prompt (`_buildBuildPrompt`) routes on `motor.selectedAction === 'build_ui'`. Sandbox auto-cleanup with `MAX_ACTIVE_COMPONENTS = 10`, LRU eviction, tracked timers/listeners, auto-remove on JS error. Only U300 (manual QA verification) remains.

#### U300 — ⏸ DEFERRED (manual QA only, not code work) — Sandbox test inputs for build_ui verification

**Goal:** Fixed test inputs to verify Unity's build_ui works end-to-end after U293-U299. Not a unit test, a manual QA checklist.

Test requests:
- "build me a calculator"
- "make a timer that counts up"
- "build a todo list"
- "create a color picker"
- "make a dice roller"
- "build a code viewer for javascript"
- "make a markdown preview"
- "build a unit converter"
- "create a password generator"
- "make a counter with increment and decrement"

For each: Unity should produce a working JSON component that injects cleanly, responds to user input, and doesn't leak memory or crash the sandbox. Manual verification only.

Files: none — test checklist

---

## EPIC: Orphan Resolution — Revive, Supersede, Fix, or Delete

**Status 2026-04-13:** U302–U310 all DONE (moved to FINALIZED.md). Orphan audit from `docs/ORPHANS.md` fully resolved — vision.js DELETED (superseded by visual-cortex.js V1→V4→IT), gpu-compute.js KEPT (false positive, used by compute.html), worker threads DELETED (root cause: idle polling CPU leak; GPU-exclusive fix shipped), HHNeuron KEPT as reference (createPopulation factory DELETED), server dictionary stub cleaned (full impl → U311), benchmark.js wired to /bench + /scale-test slash commands, env.example.js KEPT (false positive, used by setup modal + env.js dynamic import), dead UI paths scanned and cleaned (5 legacy compat DOM elements + 4 orphan CSS classes deleted).

### U311 — P1 — Full server-side shared dictionary (follow-up from U306)

**Context:** U306 discovered the server had an empty `this.dictionary = {...}` stub and an accumulator `_learnWords → _wordFreq` that was saving to `brain-weights.json` but never loaded back on restart. U306 fixed the save/load asymmetry so word frequencies now survive restarts. The FULL implementation — a real shared-across-users Unity dictionary with bigram/trigram/type n-grams + WebSocket delta sync so every user's conversation teaches every other user's brain — is its own epic.

Why this matters: Gee plans to remove text-AI backends entirely (see memory `project_future_no_text_models.md`). When that happens, the server's `_generateBrainResponse` fallback at `server/brain-server.js:906` needs to produce actual sentences from the brain's own learned vocabulary instead of returning `'...'`. The client-side dictionary in `js/brain/dictionary.js` + `js/brain/language-cortex.js` already knows how to do this — the server needs the same capability, but shared across every connected user so Unity gets smarter from every conversation.

**Scope (big — not a one-session task):**
- Port `js/brain/dictionary.js` behaviors to `server/dictionary.js` (words Map, bigram counts, trigram counts, type bigrams, persona/baseline/coding corpus ingestion on boot)
- Port `js/brain/language-cortex.js` generation path to a server-side generator that can be called from `_generateBrainResponse` when AI fails
- Load `docs/Ultimate Unity.txt` + `docs/english-baseline.txt` + `docs/coding-knowledge.txt` from the server filesystem on boot (same corpora clients use)
- Persist learned bigrams/trigrams to `server/dictionary.json` with versioning
- WebSocket delta sync: when the server learns new bigrams, push delta to all connected `remote-brain` clients so shared state stays coherent
- `js/brain/remote-brain.js` needs a mirror that accepts dictionary deltas and applies them locally
- Conflict resolution: concurrent learns from multiple users need to merge cleanly (counter addition, not overwrite)

**Files:** `server/dictionary.js` (NEW), `server/language-cortex.js` (NEW, or port from js/brain/), `server/brain-server.js` (wire into `_generateBrainResponse` fallback + delta broadcast), `js/brain/remote-brain.js` (accept dictionary deltas), possibly new `server/corpora/` symlink to `docs/` for corpus loading.

**Estimated size:** 500-1000 lines across 4+ files. Multi-session. Needs dedicated planning before starting.

---

## Blocked Items

| Task | Blocked By | Notes |
|------|------------|-------|
| None currently | — | — |

---
