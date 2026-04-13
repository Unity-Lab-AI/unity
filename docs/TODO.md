# TODO — IF ONLY I HAD A BRAIN

> **Only UNFINISHED tasks live here. Completed tasks are in FINALIZED.md.**
> Last cleaned: 2026-04-13

---

## EPIC: Grammar Sweep — Full Brain Correction, Not Patchwork

**Problem witnessed 2026-04-13 (post 44k dictionary + morphological expansion deploy):**

```
You: Hi Unity! how are you?
Unity: I'm not use vague terms like a human
```

This is structurally broken English. `"I'm not use vague terms"` violates subject-aux-verb agreement — `"I'm not"` needs a noun/adjective/participle complement, not a bare infinitive verb `"use"`. The Markov walk chained `I'm → not → use → vague → terms → like → a → human` which are individually valid bigrams but produce an ungrammatical whole.

**Root cause:** The slot scorer's grammar gate is a local, per-slot type-compatibility check. It validates that word N has a compatible type for slot N, but it does NOT enforce multi-slot dependencies like:
- `"I'm"` (copula contraction) → next slot must be noun/adj/PP, NOT bare verb
- `"not"` after `"I'm"` → next slot must be noun/adj/PP/participle (predicate complement)
- `"don't"` / `"can't"` / `"won't"` → next slot must be bare infinitive verb
- `"to"` (infinitive marker) → next slot must be bare infinitive verb

The slot scorer has `nextSlotRequirement(prevWord, ...)` but it only looks at ONE word back and treats `"I'm"` as "verb" (dominant type) which wants "noun" next. That's correct UNTIL the walk picks `"not"`, after which the scorer looks at `"not"` as prev word and picks from its continuations — which include "use" because `"not use"` is a common bigram (from "do not use", "I do not use", etc).

The grammar gate needs to track the SENTENCE-LEVEL constraint structure, not just per-slot local types.

### Sweep Correction Tasks — NOT patchwork

The patchwork approach has been exhausted. Every small fix addresses one symptom. A full sweep means restructuring the slot scorer's grammatical model to enforce phrase-level constraints, not word-pair constraints.

#### U283 — P1 — Phrase-level grammar state machine in slot scorer

**Goal:** Replace the single-prev-word type compatibility check with a phrase-state tracker. Each slot is filled based on the CURRENT PHRASE STATE, not just the previous word.

- Phrase states: SUBJECT / FINITE_VERB / PREDICATE_COMPLEMENT / OBJECT / MODIFIER / INFINITIVE_TO / BARE_INFINITIVE / NEGATED_AUX / PROGRESSIVE / PERFECT / etc.
- Transitions: each picked word moves the state machine forward based on the word's type AND the current state.
- Example: `"I"` → SUBJECT → next state FINITE_VERB. Picks `"am"` → FINITE_VERB → next state PREDICATE_COMPLEMENT. Picks `"not"` → NEGATED (still PREDICATE_COMPLEMENT). Picks `"use"` → FAIL because PREDICATE_COMPLEMENT wants noun/adj/participle, "use" is bare verb. Reject and retry.
- Files: `js/brain/language-cortex.js` — new `_PhraseState` class or equation-based state function, wire into `nextSlotRequirement`.

#### U284 — P1 — Contraction continuation rules

**Goal:** When the slot scorer picks a contracted form like `"I'm"`, `"don't"`, `"can't"`, the next-slot requirement must reflect the GRAMMATICAL ROLE of the underlying expansion, not just the contraction's letter shape.

- `"I'm"` = `I + am` (copula) → next = PREDICATE_COMPLEMENT (noun/adj/PP/-ing participle)
- `"don't"` = `do + not` (neg aux) → next = BARE_INFINITIVE_VERB
- `"can't"` = `can + not` → next = BARE_INFINITIVE_VERB
- `"won't"` = `will + not` → next = BARE_INFINITIVE_VERB
- `"I'll"` = `I + will` (modal) → next = BARE_INFINITIVE_VERB
- `"I've"` = `I + have` (perfect aux) → next = PAST_PARTICIPLE
- `"he's"` = `he + is` → next = PREDICATE_COMPLEMENT or PRESENT_PARTICIPLE
- `"they're"` = `they + are` → next = PREDICATE_COMPLEMENT or PRESENT_PARTICIPLE
- Each contraction has a mapped state transition. Pure letter-equation detection of the contraction + pinned next-state requirement.
- Files: `js/brain/language-cortex.js` — extend `nextSlotRequirement` with contraction-aware state transitions.

#### U285 — P1 — Negation particle continuation rules

**Goal:** The word `"not"` should force the next slot into a specific grammatical category based on what it negates.

- `"is not"` / `"am not"` / `"are not"` / `"was not"` / `"were not"` → next = PREDICATE_COMPLEMENT
- `"do not"` / `"does not"` / `"did not"` → next = BARE_INFINITIVE_VERB
- `"has not"` / `"have not"` / `"had not"` → next = PAST_PARTICIPLE
- `"will not"` / `"would not"` / `"should not"` / `"could not"` / `"might not"` → next = BARE_INFINITIVE_VERB
- Detect via two-word lookback (prev-prev + prev == copula/aux + not).
- Without this, `"I'm not use"` happens because `"not"` alone has no preference between noun-complement and bare-verb continuation.
- Files: `js/brain/language-cortex.js` — extend `nextSlotRequirement` with negation-aware two-word lookback.

#### U286 — P1 — Infinitive marker continuation

**Goal:** After `"to"`, the next word should be a bare infinitive verb, not a noun (unless `"to"` is functioning as a preposition).

- `"want to"` + next = BARE_INFINITIVE (`"want to go"`, `"want to try"`)
- `"going to"` + next = BARE_INFINITIVE (`"going to do"`, `"going to say"`)
- `"have to"` + next = BARE_INFINITIVE
- `"need to"` + next = BARE_INFINITIVE
- But `"go to"` + next = NOUN/DET (prepositional: `"go to the store"`)
- Distinguishable by the word BEFORE `"to"`: verbs like want/going/need/have take infinitive, while motion verbs go/come/walk/drive take prepositional.
- Files: `js/brain/language-cortex.js` — extend nextSlotRequirement with `to`-infinitive detection.

#### U287 — P1 — Sentence completeness validator post-render

**Goal:** After the slot scorer generates a sentence, run it through a completeness check. Incomplete sentences (ending on `"the"`, `"a"`, `"to"`, `"with"`, a bare aux, etc.) should either be extended or rejected and retried.

- Complete sentences end on: punctuation, content word (noun/adj/adv), or intransitive verb
- Incomplete sentences end on: determiner, preposition, conjunction, bare auxiliary, infinitive marker
- Detection via wordType of the last word + specific closed-class check
- If incomplete, attempt to extend by one more slot. If still incomplete after 3 attempts, reject the sentence and retry the whole generation with a higher-temperature variation.
- Files: `js/brain/language-cortex.js` — new `_isCompleteSentence(tokens)` method, wire into `generate()` post-render loop.

#### U288 — P1 — Intensifier placement rules

**Goal:** The current intensifier insertion (task 39) inserts before the first adj/verb found but can break grammar by placing `"so"` or `"really"` in ungrammatical positions.

- `"so"` / `"really"` / `"very"` / `"pretty"` only before adj/adv, not before verbs
- `"fucking"` (as intensifier) can go before adj/adv/noun but not before finite verbs
- Don't insert an intensifier if the following word is a copula
- Don't insert two intensifiers in a row
- Files: `js/brain/language-cortex.js` — tighten `_postProcess` intensifier block.

#### U289 — P1 — Subject-verb agreement sweep

**Goal:** Current agreement is a post-process copula swap (`"i are"` → `"i am"`). Extend to cover ALL verb forms, not just copulas.

- Third-person singular subjects (he/she/it/single noun) → verb gets -s (`"he codes"` not `"he code"`)
- First/second person + plural → bare verb (`"I code"`, `"you code"`, `"we code"`, `"they code"`)
- Detect subject person via `_isNominativePronoun` + closed-class check
- Apply `applyThird` in `_postProcess` based on subject person, not just a vague heuristic
- Files: `js/brain/language-cortex.js` — rewrite the third-person-s branch in `_postProcess`.

#### U290 — P2 — Determiner-noun phrase validator

**Goal:** When the slot scorer picks a determiner (`"the"`, `"a"`, `"an"`, `"my"`, `"this"`, `"some"`), the next slot must be a noun or adj+noun. The current phrase-structure continuation handles `det → noun` but doesn't enforce `det → adj → noun` properly.

- After `"the"`: next = NOUN or ADJ_LEADING_TO_NOUN
- After `"a"`: next = NOUN or ADJ starting with consonant (or "an" if vowel)
- After `"an"`: next = NOUN or ADJ starting with vowel
- If adj picked, MUST eventually pick noun before the phrase closes
- Files: `js/brain/language-cortex.js` — extend phrase state machine with NP-completeness tracking.

#### U291 — P2 — Preposition-object phrase validator

**Goal:** After a preposition (`"in"`, `"on"`, `"at"`, `"for"`, `"with"`, `"about"`), the next slot must eventually resolve to a noun phrase object.

- After prep: next = DET or PRONOUN or NOUN or ADJ (leading to noun)
- If no noun within 3 slots, reject and retry
- Handles compound preps (`"out of"`, `"because of"`, `"next to"`)
- Files: `js/brain/language-cortex.js` — extend phrase state machine with PP-completeness tracking.

#### U292 — P3 — Comprehensive grammar test suite

**Goal:** After implementing U283-U291, run Unity through a fixed set of test inputs and verify output grammar. Not a unit test, a verification script.

- Test inputs covering: greetings, questions, yes/no questions, wh-questions, imperatives, casual statements, self-description, opinion requests, descriptions
- Run each input 5 times to exercise variation
- Flag any output that fails the completeness check, has obvious agreement errors, or breaks basic English grammar
- Files: none — test script only, results printed to console

---

## EPIC: Unity as Master Coder — Build UI / Sandbox Mastery

**Goal:** Unity's brain needs the full complement of coding knowledge + algorithms + sandbox management discipline so the `build_ui` motor action produces working code every time, not broken fragments. She should code like a dedicated coding LLM (Qwen Coder, DeepSeek Coder, etc.) through equations + knowledge base + learned corpus, NOT through hardcoded code examples.

**Source:**
- User request 2026-04-13: "unity 's Brain also needs all the coding ability to be a master .js css and html editor to properly be able to use build ui and create code injected into her sandbox on the fly... any thing and everything in her sandbox with just the how to code knowledge shell have... she will know how to creat and code like a llm like qwen coder through our expanded codeing algoriths we are going to create... cappable of using the build UI to actuall make useful builds correctly and knows order of operations and things like closing out of past builds and keeping her sandbox clean from errant code running... give her a full complemet of coding algorithms and equations and how to knowldegabases for codeiing, her sandbox, and how to proeprly handle her sandbox and not crash it"

### Coding Knowledge Base Tasks

#### U293 — P1 — Create docs/coding-knowledge.txt — HTML/CSS/JS reference

**Goal:** Comprehensive but pattern-based coding knowledge file, loaded alongside persona and baseline into Unity's dictionary/bigrams/trigrams. Gives Unity the vocabulary + conventions of web coding. NOT full app examples.

Content categories:
- **HTML elements** — div/span/p/h1-h6/img/a/button/input/form/table/ul/ol/li/nav/header/footer/section/article/aside/main/canvas/video/audio + their common attributes
- **HTML semantics** — when to use each element, accessibility basics, proper document structure
- **CSS properties** — layout (display/flex/grid/position/float), box model (margin/padding/border/width/height), typography (font-family/size/weight/line-height/color), visual (background/border-radius/box-shadow/opacity/transform), animation (transition/keyframes), responsive (@media, em/rem/vw/vh/%)
- **CSS layout patterns** — flex centering, grid dashboard, sticky header, sidebar layout, card grid, hero section
- **JavaScript DOM** — querySelector/getElementById/createElement/appendChild/removeChild/innerHTML/textContent/setAttribute/classList/dataset
- **JavaScript events** — addEventListener/click/input/change/submit/keydown/mouseover, event delegation, preventDefault, stopPropagation
- **JavaScript patterns** — state as plain object, event handlers, async/await, fetch/Promise, setTimeout/setInterval, requestAnimationFrame, localStorage/sessionStorage
- **JavaScript data** — Array.map/filter/reduce/forEach, Object.keys/values/entries, JSON.parse/stringify, template literals
- **Build patterns** (not full code, just structure) — form with validation, list with add/remove, modal dialog, tabs, accordion, carousel, calculator state machine, timer, stopwatch, counter, todo list, game loop
- **Error handling** — try/catch, error boundaries, graceful fallback, console.error for debugging

Files: `docs/coding-knowledge.txt` (new)

#### U294 — P1 — Sandbox lifecycle knowledge section

**Goal:** Specific section in docs/coding-knowledge.txt documenting Unity's sandbox rules so the `_handleBuild` path produces code that respects the sandbox contract.

Must document:
- **Every component needs a unique id** — kebab-case-name
- **Before injecting a new component with an existing id, remove the old one** — `sandbox.remove(id)` then `sandbox.inject(spec)`, OR use `position: 'replace'`
- **Max active components** — set a soft cap (e.g. 10) and auto-remove the oldest when exceeded, OR list existing IDs and prompt user which to keep
- **Cleanup rules** — components that set `setInterval`/`setTimeout` must clear them on removal (MutationObserver for wrapper.remove, or attach to `el.__cleanup`)
- **Scoped CSS** — never use `body`/`html` selectors, never use `!important`, use component-scoped class names
- **JS context** — the wrapper element is `el`, unity API is `unity`, never touch `document.body` or global state
- **Error handling** — wrap risky code in try/catch, log errors to `sandbox._errors`, fall back gracefully
- **Memory** — don't create unbounded arrays, clean up references on removal
- **Ordering** — inject order: CSS first (via sandbox.injectCSS if global, or inline via spec.css), then HTML, then JS that binds to the rendered DOM
- **Common mistakes to avoid** — using innerHTML with unescaped user input, recursive DOM queries in animation loops, memory leaks from event listeners not cleaned up, multiple instances of same component stacked

Files: `docs/coding-knowledge.txt` section "SANDBOX DISCIPLINE"

#### U295 — P1 — Wire coding-knowledge.txt into the learning pipeline

**Goal:** Unity loads this corpus alongside persona + baseline so the vocabulary includes HTML tags, CSS properties, JS APIs, and common coding terms. The bigrams/trigrams/4-grams from this corpus feed the slot scorer when she's asked about coding.

- Add `loadCodingKnowledge(text)` method to LanguageCortex and InnerVoice (parallel to `loadBaseline`)
- app.js `loadPersonaSelfImage` fetches all THREE files via Promise.all
- Coding corpus sentences pass through the same pipeline (first-person transform is a no-op for generic technical text; mood signature computes low arousal / low valence for neutral technical content; cortex pattern derived per sentence)
- Files: `js/brain/language-cortex.js`, `js/brain/inner-voice.js`, `js/app.js`

#### U296 — P1 — Build-specialized Broca's area prompt

**Goal:** When BG motor selects `build_ui`, the Broca's area prompt must switch to a CODING MODE that references the coding knowledge + sandbox rules, not the casual conversational mode.

- New method `_buildBuildPrompt(brainState, userRequest)` separate from `_buildPrompt`
- Character block: still Unity, but in BUILD MODE — focused, technical, competent
- Sandbox rules summary (scoped CSS, unique IDs, cleanup, no globals)
- unity.* API reference (speak, chat, generateImage, getState, storage)
- JSON output contract: `{html, css, js, id}` only
- Existing components list — if any, she should REUSE the same id to update
- Current sandbox state — count of active components, memory warning if >10
- Files: `js/brain/language.js` — new method, switch in `generate()` based on `brainState.motor.selectedAction`

#### U297 — P1 — Sandbox auto-cleanup and soft cap

**Goal:** Prevent Unity from leaving hundreds of stale components running in the sandbox (setInterval leaks, event listener accumulation, DOM bloat).

- Set MAX_ACTIVE_COMPONENTS = 10 in sandbox.js
- When inject() would exceed cap, auto-remove the oldest component (track insertion timestamps)
- Before inject() with an existing id, always call remove(id) first (right now it bails with a warning — change behavior to replace)
- Track setInterval/setTimeout handles per component via a `_componentTimers` map
- When remove() fires, clear all timers owned by that component
- Same for registered event listeners on `window`/`document` — wrap addEventListener to track and clean up
- Files: `js/ui/sandbox.js`

#### U298 — P2 — Build error recovery and retry

**Goal:** When Unity builds a component and it throws, don't leave the broken component in the sandbox. Recover cleanly and either retry OR report the error in-voice.

- Wrap `_evaluateJS` execution in a timeout so infinite loops don't hang the UI
- If execution throws within 100ms of injection, consider the build a failure
- Auto-remove the broken component
- Emit a response message like `"shit, that build crashed — [error]"` in Unity's voice (via the language cortex, not hardcoded)
- Offer retry via a chat input like `"want me to try again?"`
- Files: `js/ui/sandbox.js` error handling + `js/brain/engine.js` `_handleBuild` retry logic

#### U299 — P2 — Build composition knowledge (primitives that combine)

**Goal:** Unity should know how to COMPOSE apps from primitives — form+list = todo app, canvas+loop = game, input+eval = calculator, textarea+pre = code editor — rather than memorizing full apps.

Document in coding-knowledge.txt:
- **Calculator primitive:** input field + button grid + display element + evaluate() function with safe parsing
- **List primitive:** array state + render function + add/remove handlers + persistence via localStorage
- **Timer primitive:** requestAnimationFrame loop + time delta + display update + start/stop state
- **Canvas game primitive:** canvas element + render loop + input handlers + game state object
- **Form primitive:** input elements + validation function + submit handler + feedback display
- **Modal primitive:** overlay div + content div + close handler + backdrop click to dismiss
- **Tab primitive:** header buttons + content divs + active state + click handler

Each is a PATTERN, not code. Unity combines them at build time based on the user's request. The knowledge is HOW they connect, not WHAT to type.

Files: `docs/coding-knowledge.txt` section "BUILD PRIMITIVES"

#### U300 — P2 — Sandbox test inputs for build_ui verification

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

Source: `docs/ORPHANS.md` — audit 2026-04-13 found 13 orphaned/abandoned/broken items across the codebase. Each needs a decision: is the feature needed and should be revived, has it been superseded by a better approach and should be deleted, or does it need a new implementation to replace it? Not ripping things out blindly — stacking the right work on what's actually wanted.

### U302 — P1 — Revive vision system (`js/io/vision.js`)

**Finding:** Full Vision class exists (118 lines) — webcam capture, AI scene description, gaze tracking, Unity's Eye widget. Never imported anywhere. README + ARCHITECTURE.md claim vision is a core feature but wiring was never completed.

**Decision plan:**
- Check whether vision is a wanted feature (Gee confirms yes/no)
- If YES: wire into `js/app.js` boot so the Vision instance is created and passed to `engine.connectMicrophone` equivalent or new `engine.connectVision`
- Add a sensory input pipeline: webcam frame → visual cortex (V1 edge detection → IT recognition) → cortex visual area neurons
- Unity's Eye widget (iris + crosshair overlay) visible in the UI
- If NO: delete `js/io/vision.js` and strip vision claims from README + ARCHITECTURE.md + brain-equations.html

**Files:** `js/io/vision.js`, `js/app.js`, `js/brain/engine.js`, `js/brain/sensory.js`, possibly `js/ui/vision-widget.js` (new)

### U303 — P2 — Integrate or delete `js/brain/gpu-compute.js`

**Finding:** 400-line WebGPU compute shader implementation with WGSL LIF kernel, synapse propagation, atomic spike counting. `GPUCompute` class + `initGPUCompute()` exported. Never instantiated. Meanwhile actual GPU work runs in `compute.html` (separate browser tab) via WebSocket from `server/brain-server.js`.

**Decision plan:**
- These are two parallel GPU implementations. Figure out which is the "real" one.
- compute.html is confirmed working (GPU worker output in console). That's the server-brain path.
- `gpu-compute.js` appears to be a client-brain path that never got wired in — for browser-local GPU mode
- If browser-local GPU is wanted as a client-side fallback when server unavailable: wire into `js/brain/engine.js` step loop as an alternative to CPU fallback
- If the compute.html path is definitive: DELETE `gpu-compute.js`

**Files:** `js/brain/gpu-compute.js`, `js/brain/engine.js`

### U304 — P1 — Delete abandoned worker thread system

**Finding:** `server/parallel-brain.js`, `server/cluster-worker.js`, `server/projection-worker.js` — fully implemented Worker thread pool. `server/brain-server.js:337-338` declares `_parallelBrain = null` and `_useParallel = false`. Line 663 has explicit comment `"NO CPU WORKERS — GPU exclusive. Don't spawn ParallelBrain at all."` — architecture decided against it but the files remain.

**Decision plan:**
- The comment makes the decision clear: GPU exclusive, no CPU workers
- DELETE `server/parallel-brain.js`, `server/cluster-worker.js`, `server/projection-worker.js`
- Remove the `_parallelBrain` / `_useParallel` stubs from `brain-server.js` lines 337-338 and the defensive null checks at lines 1444-1448
- Clean up any imports that reference them

**Files:** `server/parallel-brain.js` (delete), `server/cluster-worker.js` (delete), `server/projection-worker.js` (delete), `server/brain-server.js` (clean stubs)

### U305 — P2 — HHNeuron dead chain cleanup

**Finding:** `js/brain/neurons.js` exports `HHNeuron` class (~100 lines, full Hodgkin-Huxley model) and `createPopulation(type, n, params)` factory. Neither is called. Runtime uses LIF populations via `cluster.js`. README claims HH as a core neuron model.

**Decision plan:**
- Option A: Integrate HH as an alternative neuron type. Cluster init could accept `neuronType: 'HH'` to use HHNeuron instead of LIF. Used selectively for mystery cluster or specific simulation needs.
- Option B: Delete HHNeuron + createPopulation, update README to say "LIF neurons" not "Hodgkin-Huxley"
- Gee's call on which — HH is more biologically accurate but slower

**Files:** `js/brain/neurons.js`, `js/brain/cluster.js`, `README.md`, `docs/ARCHITECTURE.md`

### U306 — P2 — Server-side dictionary sync

**Finding:** `server/brain-server.js:314` has `this.dictionary = { words: new Map(), bigrams: new Map() }` stub. Line 907 has `// TODO: implement server-side dictionary`. Currently Unity's learned vocabulary (bigrams, trigrams, type n-grams) lives client-side only — user A's conversations don't teach user B's brain even though they share the neural state via WebSocket.

**Decision plan:**
- Decide whether cross-user language learning is wanted (Unity gets smarter from every user's conversation)
- If YES: implement server-side dictionary. Store persona + baseline + coding corpus on the server. Every user input learns into the SERVER's dictionary. Clients subscribe to dictionary updates via WebSocket delta sync.
- This is a significant refactor: `server/brain-server.js` needs a full dictionary + bigram + n-gram storage, `js/brain/remote-brain.js` needs to mirror the server dictionary, conflict resolution for concurrent learns.
- If NO: delete the stub + TODO, document that language learning is per-client

**Files:** `server/brain-server.js`, `js/brain/remote-brain.js`, potentially new `server/dictionary.js`

### U307 — P3 — Benchmark command integration

**Finding:** `js/brain/benchmark.js` exports `runBenchmark()` and `runScaleTest()`. Neither is called from anywhere.

**Decision plan:**
- Add a `/bench` slash command in chat that invokes runBenchmark
- Add a `/scale-test` for runScaleTest
- OR delete benchmark.js if Unity doesn't need self-diagnostics
- Low priority — debug-only tooling

**Files:** `js/brain/benchmark.js`, `js/ui/chat-panel.js` or wherever slash commands dispatch

### U308 — P3 — Delete `js/env.example.js`

**Finding:** Template env file, not imported by any code. Current API key flow is manual UI entry per user preference.

**Decision plan:**
- DELETE `js/env.example.js`
- Or keep as a developer onboarding reference if anyone hand-loads env vars for local testing
- Trivial, low priority

**Files:** `js/env.example.js`

### U309 — P2 — Stack new implementations on top of audit findings

**Goal:** As U302-U308 resolve, each decision either (a) revives an orphan into working code, (b) deletes it cleanly, or (c) supersedes it with a new implementation.

Track per-item:
- **Supersedes:** what newer architecture replaces the old (e.g. compute.html replaces gpu-compute.js for the server GPU path)
- **Stacks:** what new feature built ON the revived orphan (e.g. if vision revives, new Unity-can-see-your-webcam features become possible)
- **Needs fixing:** what was broken when the orphan was abandoned that needs to be fixed during revival (e.g. vision was never wired because the sensory pipeline didn't support video frames — now it does)

This is the meta-task: turn the orphan audit into a living worklist of architectural decisions, not a list of deletions. Each orphan is either a feature with a missing integration or a dead branch of a past decision.

**Files:** this TODO.md, `docs/ORPHANS.md`

### U310 — P3 — Remove dead `/chat` UI path

**Finding (not in original audit but worth tracking):** various stale UI elements and event handlers that may have been added during experiments and left in place. Worth a pass after U302-U309.

**Files:** TBD — scan after other cleanup

---

## Blocked Items

| Task | Blocked By | Notes |
|------|------------|-------|
| None currently | — | — |

---
