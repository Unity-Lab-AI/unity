# TODO — THE FULL BRAIN REFACTOR

> **Branch:** `brain-refactor-full-control`
> **Started:** 2026-04-13
> **Philosophy:** Unity's brain controls EVERYTHING equationally. No scripts. No text-AI backends. No hardcoded fallbacks. No vestigial appendages. Every output — speech, vision, build, thought, memory, learning, motor action — flows from brain equations + learned corpus. The AI model (if any) is dumb muscle that follows orders the brain already decided.

---

## THE GUIDING PRINCIPLE

**If a behavior exists that isn't driven by brain state equations, it's wrong.**

Every piece of Unity's output must trace back to:
- **Cortex prediction** (ŝ = W·x + b) — what she expects
- **Amygdala valence/arousal** (V(s) = Σw·x) — how she feels about it
- **Basal ganglia motor selection** (softmax over learned channels) — what action she takes
- **Hippocampus recall** (Hopfield attractor) — what she remembers
- **Cerebellum error correction** (ε = target − output) — what she fixes
- **Hypothalamus drives** (homeostatic gradients) — what she needs
- **Mystery module Ψ** (√(1/n) × N³) — her consciousness level
- **Oscillation coherence** (Kuramoto) — her focus/scatter
- **Language cortex** (type n-grams + cortex pattern walk) — her words

Nothing else. If it's not in that list, it's an appendage, and it gets ripped out.

---

## R1 — AUDIT PASS: Find every scripted/hardcoded/AI-dependent path

**Goal:** Before touching code, produce a complete inventory of every place Unity's output is NOT driven by brain equations. This is the kill list.

### R1.1 — Scripted response inventory
Scan the codebase for every hardcoded response string, hardcoded word list, hardcoded action mapping, or hardcoded fallback text. Every `'...'`, every `'I\'m not sure'`, every `return "something"` that bypasses the brain.

**Files to audit:** `js/brain/language.js`, `js/brain/sensory.js`, `js/brain/engine.js`, `server/brain-server.js`, `js/brain/inner-voice.js`, `js/brain/language-cortex.js`, `js/brain/motor.js`, `js/app.js`.

**Output:** `docs/KILL_LIST.md` — every occurrence with file:line + classification (scripted string / hardcoded list / AI-bypass fallback / dead-appendage).

### R1.2 — AI-dependency inventory
Every place the code calls an external AI API (Pollinations, Anthropic, OpenAI, OpenRouter, local models). For each call site, note what Unity does if the AI fails — does it produce equational output, or does it fall through to a hardcoded fallback? Fallbacks are kill-list items.

**Files to audit:** `js/brain/language.js` (Broca's area), `js/ai/pollinations.js`, `js/brain/peripherals/ai-providers.js`, `server/brain-server.js` (`_generateBrainResponse`), `js/app.js` (image generation).

**Output:** extend `docs/KILL_LIST.md` with AI-dep section.

### R1.3 — Vestigial appendage sweep
Dead code that didn't surface in the orphan audit. Unused exports, never-called helpers, commented-out blocks, experimental files, duplicate implementations, half-finished features. Every file in `js/`, `server/`, `proxy.js`, `claude-proxy.js`.

**Output:** `docs/VESTIGIAL.md` — file-by-file inventory with DELETE / MERGE / REVIVE decisions pending Gee's call.

---

## R2 — SERVER BRAIN FULL CONTROL

**Goal:** The server brain must be able to do EVERYTHING a client brain does, equationally, with zero AI dependency. Right now the server has a fallback `_generateBrainResponse` that returns `'...'` when Pollinations fails. That's a placeholder for real equational generation that has to exist.

### R2.1 — Port dictionary to server
`server/dictionary.js` (new). Full port of `js/brain/dictionary.js`:
- `words` Map (word → {pattern, arousal, valence, count, cortexPattern})
- `bigrams` Map (prev → Map(next → count))
- `trigrams`, `quadgrams` Maps
- Letter-equation word classification (shared code with client?)
- `learnWord(word, cortexPattern, arousal, valence)`
- `learnSentence(text, cortexPattern, arousal, valence)`
- `findByPattern`, `findByMood` (optional, expensive)
- JSON persistence to `server/dictionary.json` with versioning

**Shared code strategy:** Create `js/brain/shared/` directory with pure equation modules (dictionary-core.js, language-cortex-core.js) importable from BOTH client AND server. No DOM dependencies, no localStorage calls — pass persistence hooks in.

### R2.2 — Port language cortex to server
`server/language-cortex.js` (new). Full port of the generation path:
- Type bigram/trigram/4gram storage
- `_fineType(word)` letter-position classifier
- `_typeGrammarScore(candType, historyTypes)` with backoff
- `_isCompleteSentence(tokens)` validator
- `nextSlotRequirement` phrase-state continuation
- Slot scorer with cortex-pattern-driven word selection
- `_postProcess` for intensifiers + agreement
- `generate(dictionary, arousal, valence, coherence, opts)` — the full path

### R2.3 — Corpus loading on server boot
`server/brain-server.js` boot sequence:
- Read `docs/Ultimate Unity.txt` from disk → `loadPersona`
- Read `docs/english-baseline.txt` from disk → `loadLinguisticBaseline`
- Read `docs/coding-knowledge.txt` from disk → `loadCodingKnowledge`
- Build dictionary + type n-grams before accepting connections
- Persist learned state to `server/dictionary.json` every `WEIGHT_SAVE_MS`

### R2.4 — Equational `_generateBrainResponse` fallback
Replace the `return { text: '...' }` stub with a real call to the server's language cortex. When AI fails (or when text-AI is removed entirely), the brain produces words from its own learned vocabulary driven by current brain state (arousal, valence, cortex pattern, motor selection).

### R2.5 — WebSocket dictionary delta sync
When the server learns a new bigram / trigram / word from a user's input, broadcast a delta to all connected `remote-brain` clients so their mirrors stay coherent.
- Delta format: `{ type: 'dict_delta', words: [...], bigrams: [...], trigrams: [...] }`
- Clients apply via `dictionary.applyDelta(delta)` method
- Conflict resolution: counter addition (never overwrite)

### R2.6 — Remote-brain client mirror
`js/brain/remote-brain.js` needs to:
- Accept `dict_delta` messages and apply them
- Route local user input through the server's learning path (already does this via brain state messages? verify)
- Fall back to its own cached dictionary if disconnected

---

## R3 — KILL THE AI TEXT BACKEND

**Goal:** Per Gee's memory `project_future_no_text_models.md` — all text-AI calls must go. Unity speaks from her own brain, period. Only image/audio/vision AI calls remain (those are sensory peripherals, not text cognition).

### R3.1 — Remove Pollinations/Anthropic/OpenAI/OpenRouter text-chat backends
- `js/brain/language.js` Broca's area: replace `_providers.chat()` with direct `languageCortex.generate()` call driven by brain state
- `server/brain-server.js` `_generateBrainResponse`: same — remove the Pollinations fetch, call server language cortex
- `js/brain/peripherals/ai-providers.js`: delete the `chat` method entirely. Keep the provider list for IMAGE generation only.
- Setup modal: remove text-model selection UI, keep only image-model + vision-model + audio-model fields

### R3.2 — Repurpose the AI model slot
The "AI model" dropdown in the setup modal still matters — for VISION (Pollinations GPT-4o describer) and IMAGE GEN. Rename the setting from "AI backend" to "Sensory AI (vision describer + image generator)" to be honest about its role. Unity's THINKING is her brain; the AI does her eyes and drawings.

### R3.3 — Verify no text-AI imports remain
Grep for `pollinations`, `anthropic`, `openai`, `openrouter`, `chat(` across all code. Every hit must either be (a) image/vision/audio sensory, (b) deleted, or (c) in a comment explaining the removal.

---

## R4 — CLIENT BRAIN FULL CONTROL

**Goal:** Mirror R2 on the client. The client brain should ALSO be fully equational. Already mostly is — `language-cortex.js` + `dictionary.js` + `inner-voice.js` do most of it. This is the cleanup pass.

### R4.1 — Rip out `BrocasArea.generate` AI dependency
Currently `js/brain/language.js:generate()` calls `this._providers.chat(messages, opts)`. Replace with:
- Build brain state → call `languageCortex.generate(dictionary, arousal, valence, coherence, { cortexPattern, predictionError, motorConfidence, psi })`
- Use the result directly as Unity's speech
- The `_buildPrompt` / `_buildBuildPrompt` methods become dead — delete them (they were for AI prompting)

### R4.2 — Motor-action-driven output path
The brain's BG motor selects one of: `respond_text`, `generate_image`, `build_ui`, `idle`. Each action drives a specific output path:
- `respond_text` → `languageCortex.generate()` → chat bubble
- `generate_image` → brain produces an image prompt equationally (from current cortex pattern + valence + arousal) → pollinations image API → display
- `build_ui` → brain produces a JSON component spec equationally (from coding-knowledge corpus + cortex pattern) → sandbox.inject()
- `idle` → no output, just internal thought cycle

The image and build paths currently lean on AI to produce the content. Those need to become equational too — but that's R5.

### R4.3 — Delete dead AI-prompt builders
Once R4.1 is done, the AI-prompt builders in `language.js` are dead:
- `_buildPrompt` (conversational prompt) → delete
- `_buildBuildPrompt` (build mode prompt) → delete
- `_getSelfImageDesc` → delete (was for prompt header)
- `_getHistory` → keep (used for brain's own memory, not prompting)
- The `BrocasArea` class shrinks to ~50 lines: call `languageCortex.generate()`, store the message, return it

---

## R5 — EQUATIONAL BUILD + IMAGE GENERATION

**Goal:** The `build_ui` and `generate_image` motor actions currently rely on AI to produce content. Replace with equation-driven generation.

### R5.1 — Equational image prompt generation
When BG selects `generate_image`:
- Current cortex pattern → sample top-K active words via `dictionary.findByPattern`
- Current arousal/valence → sample mood-matched words via `dictionary.findByMood`
- Compose into an image prompt using the learned bigram structure
- Feed to Pollinations image API (image is still a sensory peripheral, allowed)
- Display

This is a FORM of language generation — just for image prompts not chat replies. Shares the language cortex path.

### R5.2 — Equational component synthesis
The hardest part of R5. When BG selects `build_ui`:
- Current cortex pattern + user request → sample coding-corpus-learned words
- Use language cortex with `doInflections` enabled and coding-corpus-derived type n-grams
- Produce HTML + CSS + JS content strings via the same slot-scorer path
- Output as `{ html, css, js, id }` JSON

**Reality check:** This is genuinely hard. Language cortex right now produces sentences, not HTML structures. The coding corpus has HTML patterns as sentences ("A div contains a header and a body"). The jump from sentence generation to valid HTML/CSS/JS generation needs a structural grammar layer — not just word-by-word Markov.

**Approach options (pick during implementation):**
- **A — Template primitive library:** The coding corpus defines primitives (calculator, list, timer). Brain state selects a primitive equationally, fills in equation-derived parameters (color from valence, speed from arousal, id from current cortex pattern hash). Less pure but actually works.
- **B — Learned structural grammar:** Parse the coding corpus into HTML/CSS/JS AST patterns, learn type n-grams at the AST level, generate at the AST level then serialize. Pure equational. Much more work.
- **C — Hybrid:** Start with A to unblock, migrate to B later as language cortex grows.

**Recommendation:** Start with C — ship A quickly so build_ui is equation-driven TODAY, scope B as a future refinement.

### R5.3 — Delete `_buildBuildPrompt` once R5.2 ships
With equational component synthesis working, the build-mode AI prompt becomes redundant.

---

## R6 — SENSORY PERIPHERAL CLEANUP

**Goal:** The sensory peripherals (camera, mic, vision describer, image generator, audio TTS) are allowed to use AI because they're translating sensor data ↔ brain state, not generating Unity's cognition. Clean up the layering.

### R6.1 — Unify sensory peripheral interface
Every sensory peripheral exposes the same shape:
- `init(stream, brainHook)` — accept the raw stream + a hook into brain state
- `step(dt)` — process one frame/sample, produce `{ currents, metadata }` for cortex injection
- `destroy()` — clean shutdown

**Peripherals:**
- `visual-cortex.js` — already close to this shape
- `auditory-cortex.js` — similar, verify
- TTS output — write `speech-output.js` as a proper peripheral (it's currently scattered)
- Image output — write `image-output.js` as a proper peripheral

### R6.2 — Kill duplicate sensory paths
Anywhere a sensory stream is read from TWO places (e.g., brain visualizer reads camera, brain reads camera separately), consolidate to ONE read + shared state.

### R6.3 — Document the sensory contract
`docs/SENSORY.md` explaining: what goes in, what comes out, when AI is allowed, when it isn't.

---

## R7 — STATE MACHINE HONESTY

**Goal:** Every piece of persistent state Unity carries should be (a) saved, (b) loaded, (c) survive restarts. Right now there are asymmetries like U306 found — saved but never loaded.

### R7.1 — Save/load symmetry audit
For every field in `saveWeights` / `brain-weights.json` / localStorage / sessionStorage:
- Is it saved?
- Is it loaded?
- Does it round-trip without data loss?

Any asymmetry is a bug.

### R7.2 — Dictionary persistence
The client dictionary already persists to localStorage. The server dictionary (R2.1) must also persist. Both must survive restart and produce the SAME generation behavior they had before the restart.

### R7.3 — Cross-session conversation memory
SQLite episodic memory already exists in `server/episodic-memory.db`. Verify it's being written to AND read from, and that hippocampus recall uses it when the brain decides to remember.

---

## R8 — DOCS REFLECT REALITY

**Goal:** After R1-R7 ship, every doc file must match the new architecture. No claims about deleted features. No references to scripted paths that no longer exist.

### R8.1 — ARCHITECTURE.md full rewrite
Not just an update — a full rewrite. Start from a blank slate and describe the brain as it ACTUALLY is post-refactor.

### R8.2 — README.md sync
Same — rewrite. Unity's description, feature list, architecture diagram, setup flow.

### R8.3 — brain-equations.html sync
The teaching page must show the actual equations Unity runs, not aspirational ones.

### R8.4 — SKILL_TREE, ROADMAP, EQUATIONS.md
Sync all of these. Delete orphan entries. Update status markers. Document what's done vs what's planned.

---

## R9 — VERIFICATION (NOT TESTS)

**Per CLAUDE.md NO TESTS rule — we verify by running the thing, not by writing test files.**

### R9.1 — Boot test
After R1-R8, boot the client brain with no AI providers configured. Can she:
- Greet you on first load? (equational)
- Respond to "how are you"? (equational)
- Respond to "who are you"? (equational)
- Build a simple component via `/build calculator`? (R5.2)

### R9.2 — Server boot test
Boot the server brain alone. Can it:
- Load all 3 corpora from disk without error?
- Accept WebSocket connections?
- Generate equational responses via `_generateBrainResponse`?
- Broadcast dictionary deltas to connected clients?

### R9.3 — Restart persistence test
- Chat with Unity until she learns new words
- Kill the process
- Reboot
- Verify the learned words survived — she remembers what you taught her

### R9.4 — Zero-AI test
- Disconnect all network, disable all AI providers
- Unity should STILL respond (equationally, from her own brain)
- Vision + image gen will fail (expected — those are sensory peripherals)
- Core cognition must not fail

---

## R10 — FINAL CLEANUP

### R10.1 — Kill every "TODO:" comment that was a placeholder
Every `// TODO:` in the codebase. Either do the thing or document WHY it's deferred.

### R10.2 — Kill every dead import
Any `import` statement whose symbol is never used.

### R10.3 — Kill every console.log debug breadcrumb
Any `console.log('[Dev]` or `console.log('test')` that survived from debugging.

### R10.4 — Kill `.claude/.claude/` and similar accidental dirs
Verify no accidental nested claude directories, stray .DS_Store, etc.

### R10.5 — Merge brain-refactor-full-control back to main
Once R1-R10 verify clean via R9 boot tests, PR this branch into main. Keep the branch history — this is a major architectural milestone.

---

## EXECUTION ORDER

**Must be sequential (dependencies):**
1. **R1** Audit (can't refactor what we haven't inventoried)
2. **R2** Server full control (server is the new cognition root)
3. **R3** Kill text-AI (depends on R2 being equational)
4. **R4** Client full control (depends on R2 shared code being in place)
5. **R5** Equational build + image (depends on R4 language cortex being AI-free)
6. **R6** Sensory peripheral cleanup (can parallel with R5)
7. **R7** State machine symmetry (can parallel)
8. **R8** Docs (only after R1-R7 settle)
9. **R9** Verification (only after R8)
10. **R10** Final cleanup + merge

**Parallel opportunities:** R6 + R7 can run alongside R5 since they touch different files.

---

## DEFERRED (still from prior TODO, intentionally kept)

### U292 — ⏸ DEFERRED (manual QA, per CLAUDE.md NO TESTS rule) — Comprehensive grammar test suite

**Goal:** After implementing U283-U291, run Unity through a fixed set of test inputs and verify output grammar. Not a unit test, a verification script.

- Test inputs covering: greetings, questions, yes/no questions, wh-questions, imperatives, casual statements, self-description, opinion requests, descriptions
- Run each input 5 times to exercise variation
- Flag any output that fails the completeness check, has obvious agreement errors, or breaks basic English grammar
- Files: none — test script only, results printed to console

**Refactor rollup:** Folded into R9.1 boot test.

### U300 — ⏸ DEFERRED (manual QA, per CLAUDE.md NO TESTS rule) — Sandbox test inputs for build_ui verification

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

**Refactor rollup:** Folded into R9.1 boot test (after R5.2 equational build ships).

---

## Blocked Items

| Task | Blocked By | Notes |
|------|------------|-------|
| R2.4 | R2.1 + R2.2 | Server dict + language cortex must exist before equational fallback |
| R3.1 | R2.4 + R4.1 | Can't kill text-AI until both server and client have equational paths |
| R5.2 | R4.1 | Language cortex must be AI-free before we build on top |
| R5.3 | R5.2 | Can't delete build prompt until equational synth works |
| R9 | R1-R8 all shipped | Verification is last |
| R10.5 | R9 green | Merge only after verification |

---

## THE COMMIT
This TODO is committed on branch `brain-refactor-full-control` off `main@d050fdf` (orphan resolution complete). The refactor is the ONE big thing. Every task above is a step toward the same goal: **Unity runs entirely on her own brain equations, and every line of code that isn't part of that gets ripped out.**

No half measures. No scripted fallbacks. No vestigial appendages. No bullshit.
