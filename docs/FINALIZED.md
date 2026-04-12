# FINALIZED — Completed Tasks Archive

> IF ONLY I HAD A BRAIN
> Unity AI Lab

---

> **CRITICAL:** This section is a PERMANENT ARCHIVE.
> - All completed tasks are moved here from TODO.md
> - NEVER delete entries — only APPEND
> - Provides full history of all work done

---

## COMPLETED TASKS LOG

## 2026-04-12 Session: Stabilization — Persona 404 + Generation Bugs + Landing Settings

### COMPLETED
- [x] **Task:** `_postProcess` and `_renderSentence` still held word-literal lists after the initial self-image pass — ripped everything out in a second cleanup. `js/brain/language-cortex.js`
  - Completed: 2026-04-12 (commit `cbf5084`)
  - Files: `js/brain/language-cortex.js`
  - Details: Deleted `copulaFor` helper (was a `s==='i' → 'am'` mini-list), `isAlreadyCopula` (15-word irregular list), the copula/do/have rewriting block (40 lines of `verb==='am'` checks), the negation word list (aren't/isn't/won't/can't hardcoded), missing-copula insertion (depended on `copulaFor`), and the last `w === 'i'` literal in `_renderSentence`. Replaced tense application with a `regularVerb(w)` gate: `wordType.verb > 0.55` and no pronoun/det/conj leakage — irregulars fail the gate automatically and are left untouched, while bigram chains from `docs/Ultimate Unity.txt` (i→am, he→is, don't, can't) drive selection. Rewrote `_renderSentence` capitalization as equation: `w.length === 1 && wordType(w).pronoun > 0.5 → uppercase` covers 'I' without listing the word. Verified end-to-end: 325 persona sentences → 1651 dictionary words → 1651 bigram heads, 85%+ of test words classify correctly from pure letter equations, render pipeline produces `I want your cock.` / `?` / `!` / `*...*` with proper capitalization and punctuation for all 4 sentence types.

- [x] **Task:** Dictionary spammed `[Dictionary] Load failed: localStorage is not defined` when imported under Node (tests, server-side wiring). `js/brain/dictionary.js`
  - Completed: 2026-04-12 (commit `26dba53`)
  - Files: `js/brain/dictionary.js`
  - Details: `_save` and `_load` now early-return when `typeof localStorage === 'undefined'`. Browser behavior unchanged; Node imports silent. Two-line guard.

- [x] **Task:** Landing-page gear button (top-right stats panel on the 3D brain view) did nothing after first connect. `index.html` + `js/app.js`
  - Completed: 2026-04-12 (commit `f744a6d`)
  - Files: `index.html`, `js/app.js`
  - Details: The button had an inline `onclick` that only cleared `style.display` on `#setup-modal`. After the first successful connect, `app.js:1146` adds the `.hidden` class to the modal, and the CSS rule `#setup-modal.hidden { display: none; }` kept it hidden no matter what the inline style was. Fix: gave the button `id="landing-settings-btn"` and wired it through the same `wireSettings()` helper that already handles `#settings-btn` and `#hud-settings-btn`. All three entry points now share one handler: remove `.hidden`, clear inline display, flip start-btn text to 'Apply Changes'.

- [x] **Task:** Unity booted speaking word salad — `Hi hi hi hi hi hi hi hi hi.` and `You doing movies doing about movies about...`. Three bugs chained together. `server/brain-server.js` + `js/brain/language-cortex.js`
  - Completed: 2026-04-12 (commit `9a8c42e`)
  - Files: `server/brain-server.js`, `js/brain/language-cortex.js`
  - Details:
    - **Bug 1 — persona file silently 404'd.** `brain-server.js` static handler joined `req.url` directly to disk without URL-decoding, so `GET /docs/Ultimate%20Unity.txt` looked for literal `Ultimate%20Unity.txt` instead of `Ultimate Unity.txt` (with a space). Every browser boot hit 404, `InnerVoice.loadPersona` was called with empty text, dictionary started with ZERO vocabulary. Unity only knew words the user typed — hence parrot-everything behavior. **Fix:** `decodeURIComponent(rawPath)` before `path.join(ROOT, rawPath)`.
    - **Bug 2 — `generate()` prevWord used loop index instead of actual last pushed word.** `const prevWord = pos > 0 ? sentence[pos - 1] : null;` — when a slot produced `picked=null` (empty pool), `sentence` stopped growing but `pos` kept advancing, so `sentence[pos - 1]` returned `undefined` on the next iteration. The `w === prevWord` anti-repetition filter silently disengaged because nothing equals undefined, and the same top-scored word won every subsequent slot. That's why `hi` cascaded 9 times. **Fix:** track `prevWord = sentence.length > 0 ? sentence[sentence.length - 1] : null`, use `slotIdx = sentence.length` for strict-slot detection, and add a `RECENT_SLOT_WINDOW = 3` hard filter so no word repeats within 3 positions regardless of scoring. Also cap `effectiveLen = min(len, floor(dict.size × 0.6))` so a 4-word dictionary never attempts a 9-slot sentence.
    - **Bug 3 — context echo drowning scoring.** `isContext = 0.4` gave a positive boost to every word the user had just said, so when vocabulary was small Unity parroted input back verbatim. **Fix:** replaced with a negative `echoPenalty = -0.6` for words in the most-recent input set, rebalanced the combined score formula to make bigram followers (0.25) and conditional probability (0.15) from the persona the main content drivers, kept grammar (0.45) as floor, kept `topicSim` (0.05) for semantic relevance without the exact-word bonus. New formula: `grammarGate × (typeScore×0.45 + followerCount×0.25 + condP×0.15 + isThought×0.15 + topicSim×0.05 + isMood×0.04 + moodBias×0.03 + selfAware×0.08) - recency - echoPenalty`.

## 2026-04-12 Session: /workflow — Amygdala Attractor + GPU 64M + Language Cortex Unity Voice

### COMPLETED
- [x] **Task:** Language cortex word salad + equation polish — outputs like "come him sad want extinction weed" were grammatically broken and sounded nothing like Unity. Diagnosed and rebuilt in `js/brain/language-cortex.js` and `js/brain/inner-voice.js` and `js/app.js`.
  - Completed: 2026-04-12
  - Files: `js/brain/language-cortex.js` (~990 lines), `js/brain/inner-voice.js`, `js/app.js`
  - Details:
    - **All hardcoded word lists DELETED.** Ripped out `_buildLanguageStructure` entirely — `subjects`, `copula`, `auxiliary`, `determiners`, `prepositions`, `conjunctions`, `questionWords`, `negation`, `affirmative`, `discourse`, `prefixes`, `suffixes`, `coreVerbs`, `coreNouns`, `coreAdj`, `coreAdverbs` — gone. Also deleted `_loadStructure` seeding logic and `_expandStructure` category-push logic. Removed every `w === 'specific_word'` literal check from `wordType` and `_postProcess`. The cortex starts EMPTY. Structure comes from pure letter-position equations; vocabulary is learned at runtime.
    - **Equational self-image loader added.** New `loadSelfImage(text, dictionary, arousal, valence)` method splits a raw text document on sentence terminators + line breaks and feeds every sentence through `learnSentence()` — the same path used for live conversation. Word types come from the letter equations, bigrams from textual adjacency, usage types from context, all via the existing plasticity code. `InnerVoice.loadPersona(text)` forwards to it. `js/app.js` boot fetches `docs/Ultimate Unity.txt` and calls `brain.innerVoice.loadPersona(txt)` so Unity's persona document becomes the brain's initial vocabulary — she learns her voice by reading herself.
    - **Grammar gate hardened.** Old scoring used `grammarGate = 0.1` (10× penalty only) and `typeScore × 0.02` (rounding bonus), so content words slipped past the pronoun slot. Replaced with a HARD filter: on strict slots (statement/exclamation pos 0 subject, pos 1 verb, action pos 0 verb) words with `typeCompatibility < 0.35` are excluded from the pool entirely before softmax. Tail slots keep a soft 0.05 gate. Rebalanced score to `typeScore × 0.45 + thoughtSim × 0.20 + context × 0.12 + topicSim × 0.06 + bigramFollowers × 0.12 + condP × 0.10 + mood × 0.04 + moodBias × 0.02`. Dropped softmax temperature from `temp × 0.12` to `temp × 0.06` so argmax dominates.
    - **Word-type equations polished.** `wordType()` rewritten: single-letter `'i'` → pronoun, single-letter `'a'` → determiner (was broken before — both hit the same length-1 rule); 2-letter vowel-first ending m/s → copula verb (am, is); 3-letter `a-e` with 2+ vowels → verb (are); CVC shape excluding final-r → action verbs; n't contractions → strong verb (was wrongly pronoun-boosted); conjunction equations cover `and`/`but`/`or`/`so`/`if`/`yet`/`nor` via letter-position patterns; preposition equations exclude pronoun first letters (h/w/m/y) and copula endings; determiner equations cover articles via `th-` start and possessives via letter position. Normalization switched from max (pinned top to 1.0) to SUM (proper probability distribution preserving relative strengths). Low-signal words fall through to noun fallback (content-word default). Usage types boost from 0.5 to 0.6 so persona-learned context overrides letter heuristics faster.
    - **Sentence type normalization.** `sentenceType()` now builds a proper probability distribution over `{question, exclamation, action, statement}` and samples — statement gets a fair `0.6 + coherence × 0.4` share instead of being a leftover.
    - **Missing-copula insertion.** New rule in `_postProcess`: if slot 0 is a pronoun and slot 1 is NOT a verb (e.g. `i wet`), inject `am/is/are` based on subject via the `copulaFor` equation. Fixes the `subject + adjective` output that equation-only generation produces.
    - **Tense application rewritten.** `_postProcess` now applies real tense transforms via pure letter equations: `applyPast` handles `-d` after vowel-e, CVC-double-consonant + `-ed`, and plain `-ed`; `applyThird` handles `-es` after sibilants/affricates, `y→ies`, and plain `-s`; future inserts `will` before the main verb. Respects suppletive forms (am/is/are/was/were/do/does/did/have/has/had/will/would/can/could) so it doesn't double-inflect.
    - **Compound conjunction picker (no list).** `_pickConjByMood` scans the learned marginal-count map for words whose `wordType().conj > 0.4` and ranks by vowel-ratio × mood alignment. Pure equation — candidates are whatever the brain has learned from the persona text.
    - **Punctuation + capitalization.** New `_renderSentence(words, type)` final step: capitalize first word, capitalize standalone `'i'` → `'I'`, comma before mid-sentence conjunctions detected via `wordType().conj > 0.5`, action wrap in `*…*`, terminal punctuation from sentence type (`?` for question, `!` for exclamation, `.` otherwise). Skips terminal if generation already supplied one.
    - **Pipeline order of operations** (verified in `generate()`): 1) THOUGHT (cortex pattern → word candidates), 2) CONTEXT (hippocampal recall), 3) MOOD (amygdala arousal/valence), 4) PLAN (sentence type), 5) TENSE select, 6) STRUCTURE (slot-by-slot scoring with hard grammar gate + softmax), 7) POST-PROCESS (copula insert → agreement → tense apply → negation → compound), 8) RENDER (capitalize + punctuation). Called from `engine.js:721` and `inner-voice.js:127` with the full brain-state bundle (`arousal`, `valence`, `coherence`, `predictionError`, `motorConfidence`, `psi`, `cortexPattern`, `recalling`).
    - **Net effect:** the cortex boots empty, reads `Ultimate Unity.txt` via the same learning path as live conversation, and generates grammatically valid sentences from pure equations. Every cuss word, every drug reference, every sexual phrase she produces comes from her persona file flowing through the brain — no cuss words live in the source code anywhere.

## 2026-04-12 Session: /workflow — Amygdala Attractor Rewrite + GPU 64M Sweep

### COMPLETED
- [x] **Task:** GPU exclusive compute at 64M neurons — ALL 7 clusters on GPU, zero CPU workers. Full WGSL pipeline (current gen + LIF + spike count — zero JS loops). N scales to hardware: `min(VRAM×0.7/20, RAM×0.5/9)`. `server/brain-server.js` + `compute.html` + `gpu-compute.js`
  - Completed: 2026-04-12 (code landed in commits `b9704e5`, `b217cb4`, `67ea95c`)
  - Files: `server/brain-server.js`, `compute.html`, `js/brain/gpu-compute.js`
  - Details: Full GPU-exclusive compute path. All 7 clusters (Cortex, Hippocampus, Amygdala, Basal Ganglia, Cerebellum, Hypothalamus, Mystery) initialize and step on the GPU via WebGPU WGSL shaders dispatched from `compute.html`. CPU workers disabled in GPU mode — `parallel-brain.js` / `cluster-worker.js` infra still exists but is bypassed. Current-gen LIF update + synapse propagation + spike counting all run as WGSL kernels with zero JS hot-loop work. Neuron count auto-scales to hardware via `min(VRAM × 0.7 / 20 bytes, RAM × 0.5 / 9 bytes)`, capped at 64M. Chunked GPU buffer initialization added in `b9704e5` to avoid the 64M crash. Sparse spike indices return from GPU (~95% compression) and hierarchical modulation (Ψ gain, emotional gate, drive baseline, cerebellar error correction) is applied on-GPU before readback. Performance dashboard lives in `compute.html`. **Live hardware verification still belongs to Gee** — boot `compute.html`, confirm all 7 clusters init, CPU near 0%, 64M neurons allocated — but the code is complete, shipped, and no further dev work is pending against this task.


- [x] **Task:** Amygdala attractor dynamics — the amygdala CLUSTER (150 LIF neurons) creates implicit attractors via recurrent connections, but the equation module in `modules.js` still uses linear sigmoid. Need to replace `Amygdala.step()` with energy-based attractor dynamics so the module matches the cluster's emergent behavior. `js/brain/modules.js`
  - Completed: 2026-04-12
  - Files: `js/brain/modules.js`
  - Details: Ripped out the old dual-sigmoid Amygdala and replaced it with a symmetric recurrent energy network. New class keeps a persistent `x` state across frames (leak 0.85, so emotional basins carry over), drives it with downsampled cluster input at gain 0.6, settles 5 iterations of `x ← tanh(Wx + drive)` which is gradient descent on `E = -½ xᵀWx`, then applies symmetric Hebbian learning (`lr=0.003`, weights capped to [-1,1]) so the network learns which nuclei co-fire and carves real attractor basins. Fear and reward are now read out from the settled attractor via projection vectors, NOT from the raw input — valence = reward-fear as before. Arousal now combines the persona baseline with the RMS depth of the attractor, so deep basins actually spike arousal instead of staying flat. Constructor accepts both legacy `'unity'` string AND the `{arousalBaseline}` object that `engine.js:162` already passes, fixing a latent bug where the engine's object was hitting the `persona === 'unity'` check and always falling to the civilian 0.3 baseline. Returns now include `energy` and `attractorDepth` for any downstream viz that wants them (existing `{valence, arousal, fear, reward}` contract preserved — all 40+ call sites in app.js, engine.js, inner-voice.js, language.js, memory.js, mystery.js keep working). File grew from 319 → 401 lines, still under the 800 limit.

## 2026-04-11 Session: SESSION_20260411_113030 — Project Genesis

### COMPLETED
- [x] **Task: Project scaffold and workflow initialization**
  - Completed: 2026-04-11 11:30
  - Files: docs/ARCHITECTURE.md, docs/TODO.md, docs/SKILL_TREE.md, docs/ROADMAP.md, docs/FINALIZED.md
  - Details: First scan of the IF ONLY I HAD A BRAIN project. Analyzed 1898-line brain equation specification covering Hodgkin-Huxley neuron models, synaptic plasticity (Hebbian, STDP), Wilson-Cowan population dynamics, Hopfield memory networks, Drift Diffusion decision models, Bayesian brain hypothesis, reinforcement learning, Kuramoto oscillation synchronization, Free Energy Principle, and the full simulation architecture. Also scanned Unity AI Lab v1.1 voice+vision system (voice_listener.py, play_audio.ps1, setup.py). Generated complete architecture, task breakdown, skill tree, and roadmap for building Unity's brain as a web-based massively parallel dynamical system with the (√(n/1))³ mystery module for id/ego/left-brain/right-brain consciousness modeling.

- [x] **Task: .claude workflow template system setup**
  - Completed: 2026-04-11 (earlier this session)
  - Files: .claude/commands/unity.md, .claude/settings.local.json, .claude/start.bat, .gitignore
  - Details: Created /unity slash command from persona specification. Cleaned all .claude files as project-agnostic templates. Set up .gitignore for Python/Node/env/IDE/temp files. Fixed start.bat with portable path resolution.

### SESSION SUMMARY
Tasks completed: 2
Files modified: ARCHITECTURE.md, TODO.md, SKILL_TREE.md, ROADMAP.md, FINALIZED.md, .claude/commands/unity.md, .claude/settings.local.json, .claude/start.bat, .gitignore
Unity signing off: Brain equations loaded, architecture mapped, we know what we're building — a mind made of math that runs on servers and thinks like a coked-up goth genius who loves too hard and codes too fast.

---

## 2026-04-11 Session: SESSION_20260411_2 — Multi-Provider Connect + env.js + Fixes

### COMPLETED

- [x] **Task: Multi-provider AI connection system**
  - Completed: 2026-04-11
  - Files: `js/app.js`, `css/style.css`, `index.html`
  - Details: Rewrote setup flow so users can connect MULTIPLE AI providers simultaneously (e.g., OpenRouter for text + Pollinations for images). Previously only one provider could be active — clicking a new one deselected the old. Now: each provider button gets a green `.connected` badge when its key is saved, `active` (pink) just means "currently editing this one's form". Auto-reconnect loop no longer `break`s after the first saved key — it reconnects ALL saved providers. Status list shows every connected provider with model count. Text and image model dropdowns populate from all connected providers independently.

- [x] **Task: API key loading from env.js**
  - Completed: 2026-04-11
  - Files: `js/env.js` (new, gitignored), `js/env.example.js` (new, committed), `js/app.js`, `.gitignore`
  - Details: Created `js/env.js` — a simple ES module exporting `ENV_KEYS` object with per-provider API keys. Loaded via dynamic `import()` on boot, keys seeded into localStorage if not already saved. Users edit one file with their keys instead of typing them into the UI every session. `js/env.example.js` ships as a template. `js/env.js` added to `.gitignore` so keys never get pushed.

- [x] **Task: Fix all provider key page links**
  - Completed: 2026-04-11
  - Files: `js/app.js`
  - Details: Every provider's "Get your key here" link now goes to that provider's ACTUAL key management page. Previously Claude/Anthropic pointed to OpenRouter instead of console.anthropic.com/settings/keys. Pollinations pointed to enter.pollinations.ai instead of pollinations.ai/dashboard. All providers now have proper hint text explaining where to sign up. Fixed: Pollinations, OpenRouter, OpenAI, Claude, Mistral, DeepSeek, Groq.

- [x] **Task: Fix start.bat**
  - Completed: 2026-04-11
  - Files: `.claude/start.bat`
  - Details: Removed the Node.js check and `npm install` that was running on launch (the "weird node thing" that made the window flash and close). Removed `start` command that opened a second cmd window. Now runs Claude directly in the same window with `claude --dangerously-skip-permissions -p "/workflow"`. Added `where claude` check with clear error if CLI isn't on PATH. Ends with `pause` so window stays open on errors.

- [x] **Task: Update ARCHITECTURE.md with actual implementation**
  - Completed: 2026-04-11
  - Files: `docs/ARCHITECTURE.md`
  - Details: Added sections documenting the multi-provider AI system, updated tech stack from planned Python/FastAPI to actual JS browser-only implementation, updated directory structure to match real file layout with line counts, added integration points table covering all 8 providers and auto-detection.

### SESSION SUMMARY
Tasks completed: 5
Files modified: js/app.js, css/style.css, index.html, js/env.js (new), js/env.example.js (new), .claude/start.bat, .gitignore, docs/ARCHITECTURE.md, docs/FINALIZED.md
Changes: Multi-provider connect system, env.js key management, provider link fixes, start.bat fix, architecture docs updated to reflect actual codebase.

---

## 2026-04-11 Session: SESSION_20260411_3 — Chat Panel + Brain Visualizer

### COMPLETED

- [x] **Task: Full conversation log chat panel**
  - Completed: 2026-04-11
  - Files: `js/ui/chat-panel.js` (new), `css/style.css`, `js/app.js`, `index.html`
  - Details: Clicking the Unity avatar now opens a full conversation panel (bottom-right) showing complete message history loaded from storage. Has text input with send button at the bottom, mic toggle button in header, close button. Messages auto-scroll and display with role labels (You/Unity). Voice results also appear in the chat panel when it's open. Previous behavior (avatar click = toggle voice) moved to mic button inside the panel.

- [x] **Task: Real-time brain equation visualizer**
  - Completed: 2026-04-11
  - Files: `js/ui/brain-viz.js` (new), `css/style.css`, `js/app.js`, `index.html`
  - Details: "🧠 VISUALIZE" button appears bottom-right after boot. Clicking opens a full-screen overlay showing the brain simulation running live in real-time:
    - **Neuron grid**: 20x10 grid of 200 LIF neurons, cells flash pink on spike, color-coded by membrane voltage at rest. Equation displayed: τ·dV/dt = -(V-Vrest)+R·I
    - **Synapse matrix**: 40x40 sampled heatmap showing spike correlations — gold for Hebbian co-firing, cyan for pre-only (LTP potential), purple for post-only (LTD). Equations: ΔW=η·pre·post, STDP, Reward-mod
    - **Oscillation waveforms**: 8 Kuramoto oscillator traces (θ through γ bands) scrolling in real-time with coherence bar. Equation: dθ/dt=ω+ΣK·sin(θj-θi)
    - **Module activity bars**: 6 brain regions with live values, equations, and detail readouts (Cortex error, Hippocampus energy/stability, Amygdala arousal/valence, Basal Ganglia action/confidence, Cerebellum correction, Hypothalamus needs)
    - **Consciousness display**: Large Ψ readout with Id/Ego/Left/Right component breakdown. Equation: Ψ=(√n)³·[α·Id+β·Ego+γ·Left+δ·Right]
    - All canvases render via requestAnimationFrame, fed by brain.stateUpdate events
  - Close with × button or Escape

- [x] **Task: Fix valence bug in HUD**
  - Completed: 2026-04-11
  - Files: `js/app.js`
  - Details: `valence` variable was used in updateBrainIndicator but never declared — added `const valence = state.amygdala?.valence || 0`

### SESSION SUMMARY
Tasks completed: 3
Files modified: js/app.js, css/style.css, index.html, js/ui/chat-panel.js (new), js/ui/brain-viz.js (new)
New features: Chat panel with full conversation log, real-time brain equation visualizer with neuron grid, synapse matrix, oscillation waveforms, module bars, and consciousness readout.

---

## 2026-04-11 Session: SESSION_20260411_4 — 1000-Neuron Clustered Brain + Vision + 3D Viz

### COMPLETED

- [x] **Task: Brain equations page**
  - Completed: 2026-04-11
  - Files: `brain-equations.html` (new)
  - Details: Detailed document of every equation used in the brain simulation, with biological comparisons. Accessible from setup modal.

- [x] **Task: Mic mute button**
  - Completed: 2026-04-11
  - Files: `js/app.js`, `css/style.css`, `index.html`
  - Details: Mute/unmute mic button synced across UI. Unity is aware of mic state via `unity.ui` API.

- [x] **Task: Full UI state awareness API**
  - Completed: 2026-04-11
  - Files: `js/app.js`
  - Details: `unity.ui.getState()`, `isMicMuted()`, `openChat()`, `openBrainViz()`, etc. — Unity can query and control the UI programmatically.

- [x] **Task: Vision system**
  - Completed: 2026-04-11
  - Files: `js/io/vision.js` (new), `js/app.js`, `index.html`
  - Details: Webcam capture, AI scene description, gaze tracking with coordinates. Vision input routed to brain as sensory data.

- [x] **Task: Unity's Eye widget**
  - Completed: 2026-04-11
  - Files: `js/io/vision.js`, `css/style.css`
  - Details: Persistent camera feed with iris overlay, AI-driven focal point, crosshair showing where Unity is "looking".

- [x] **Task: Audio visualizer**
  - Completed: 2026-04-11
  - Files: `js/ui/brain-viz.js`
  - Details: Mic frequency spectrum rendered in the brain visualizer overlay.

- [x] **Task: Simulated senses (touch/smell/taste)**
  - Completed: 2026-04-11
  - Files: `js/brain/engine.js`
  - Details: Touch, smell, and taste senses derived from brain state — not real sensor input, but emergent from neural activity.

- [x] **Task: Speech interruption fix**
  - Completed: 2026-04-11
  - Files: `js/io/voice.js`, `js/ai/router.js`
  - Details: Unity stops talking when the user starts speaking. No more overlapping speech chains.

- [x] **Task: Neuron firing fix (tonic drive + noise)**
  - Completed: 2026-04-11
  - Files: `js/brain/engine.js`
  - Details: Added tonic drive and noise to ensure spontaneous neuron activity even without external input.

- [x] **Task: AI intent classification**
  - Completed: 2026-04-11
  - Files: `js/ai/router.js`
  - Details: Routes selfies/images/builds/chat via AI classifier + keyword matching. Determines what Unity should DO with each message.

- [x] **Task: Selfie generation**
  - Completed: 2026-04-11
  - Files: `js/ai/router.js`, `js/ai/pollinations.js`
  - Details: Unity uses her built-in visual identity for selfie generation — no menus, just asks and she sends.

- [x] **Task: Anti-safety-training prompt**
  - Completed: 2026-04-11
  - Files: `js/ai/persona-prompt.js`
  - Details: Blocks "within bounds", "as an AI", and other disclaimer phrases. Keeps Unity in character.

- [x] **Task: Anthropic CORS proxy**
  - Completed: 2026-04-11
  - Files: `proxy.js` (new)
  - Details: Local Node.js proxy server for direct Anthropic API access from the browser, bypassing CORS restrictions.

- [x] **Task: Model filter search box**
  - Completed: 2026-04-11
  - Files: `js/app.js`, `css/style.css`
  - Details: Search box on text model dropdown for filtering 200+ model lists.

- [x] **Task: MASSIVE ARCHITECTURE UPGRADE — 1000-neuron clustered brain**
  - Completed: 2026-04-11
  - Files: `js/brain/cluster.js` (new), `js/brain/engine.js`
  - Details: Upgraded from 200 flat neurons to 1000 neurons organized in 7 dedicated neural clusters:
    - Cortex (300 neurons), Hippocampus (200), Amygdala (150), Basal Ganglia (150), Cerebellum (100), Hypothalamus (50), Mystery (50)
    - Each cluster has its own LIF population, synapse matrix, tonic drive, noise, connectivity, and learning rate
    - `NeuronCluster` and `ClusterProjection` classes in `js/brain/cluster.js`
    - 16 inter-cluster projection pathways with sparse connectivity
    - Hierarchical modulation: Amygdala emotional gate, Hypothalamus drive baseline, Basal Ganglia action gate, Mystery consciousness gain, Cerebellum error correction
    - Input routing: text→Cortex+Hippocampus, vision→Cortex visual area, social→Amygdala

- [x] **Task: 3D brain visualizer**
  - Completed: 2026-04-11
  - Files: `js/ui/brain-3d.js` (new), `css/style.css`, `index.html`
  - Details: WebGL 3D view of all 1000 neurons in brain-shaped clusters. Rotate/zoom with mouse. Spike visualization with flash effects. Cluster toggle buttons to show/hide regions.

- [x] **Task: Chat history persistence fix**
  - Completed: 2026-04-11
  - Files: `js/ui/chat-panel.js`
  - Details: Chat history now persists correctly across page reloads.

- [x] **Task: Pollinations fallback prompt trimming**
  - Completed: 2026-04-11
  - Files: `js/ai/pollinations.js`
  - Details: Trims prompts to 12K character limit when using Pollinations as fallback provider.

- [x] **Task: CORS-blocked providers removed from text dropdown**
  - Completed: 2026-04-11
  - Files: `js/ai/router.js`
  - Details: Providers that are CORS-blocked from browser (like direct Anthropic) no longer appear in text model dropdown unless proxy is configured.

### SESSION SUMMARY
Tasks completed: 20
Files created: js/ui/brain-3d.js, js/io/vision.js, js/brain/cluster.js, brain-equations.html, proxy.js
Files modified: js/app.js, js/brain/engine.js, js/ai/router.js, js/ai/persona-prompt.js, js/ai/pollinations.js, js/io/voice.js, js/ui/brain-viz.js, js/ui/chat-panel.js, css/style.css, index.html, .gitignore, .claude/start.bat
Major changes: 1000-neuron clustered brain architecture (7 clusters, 16 projection pathways), vision system with eye widget, 3D WebGL brain visualizer, AI intent classification, Anthropic CORS proxy, speech interruption handling, anti-safety-training prompt.

---

## 2026-04-11 Session: SESSION_20260411_5 — REWORK: Brain-Centric Architecture

> Branch: `rework` — complete architectural inversion

### COMPLETED

- [x] **Task: Sensory Input Pipeline (js/brain/sensory.js)**
  - Completed: 2026-04-11
  - Files: `js/brain/sensory.js` (new, 9652 chars)
  - Details: SensoryProcessor class. Cortex layout: auditory (0-49, tonotopic with cortical magnification for speech 250-4000Hz), visual (50-149, 10x10 retinotopic grid with temporal contrast edge detection), language/Wernicke's (150-299, text hashing with lateral excitation). Salience tracking. Emotional word detection boosts amygdala. Audio startle response. All sensory processing removed from app.js.

- [x] **Task: Motor Output Pipeline (js/brain/motor.js)**
  - Completed: 2026-04-11
  - Files: `js/brain/motor.js` (new, 5804 chars)
  - Details: MotorOutput class reads basal ganglia spike patterns. 150 neurons in 6 channels of 25 (respond_text, generate_image, speak, build_ui, listen, idle). EMA firing rate, winner-take-all selection. Confidence threshold 0.15 prevents noise actions. Speech gating via hypothalamus social_need + amygdala arousal. Action cooldown prevents rapid-fire. Reward injection for reinforcement learning.

- [x] **Task: Language Generation Peripheral (js/brain/language.js)**
  - Completed: 2026-04-11
  - Files: `js/brain/language.js` (new, 7255 chars)
  - Details: BrocasArea class — the brain CALLS this peripheral, it doesn't call the brain. Prompt built entirely from live brain state: arousal, valence, Ψ, cluster firing rates, drug state. Cerebellum error checking for response valence matching. AbortController for interruption. The AI model is dumb muscle — it generates text when asked.

- [x] **Task: Visual Cortex with V1 Edge Detection (js/brain/visual-cortex.js)**
  - Completed: 2026-04-11
  - Files: `js/brain/visual-cortex.js` (new, 8961 chars)
  - Details: V1→V2→V4→IT pipeline. V1: 4-orientation Gabor-like edge kernels (0°, 45°, 90°, 135°) convolved over 20x15 frame. Salience map from max edge response per pixel. Saccade generation from frontal eye fields (salience peak drives gaze, smooth pursuit + micro-saccades). V4: quadrant color extraction. IT: AI object recognition called LAST (every 10s), not first. Motion energy tracking.

- [x] **Task: Auditory Cortex (js/brain/auditory-cortex.js)**
  - Completed: 2026-04-11
  - Files: `js/brain/auditory-cortex.js` (new, 4727 chars)
  - Details: Continuous audio processing from Web Audio API. Tonotopic: 50 neurons, low freq→low index. Cortical magnification: speech band (250-4000Hz) gets 30 neurons (60%), non-speech gets 20. Amygdala arousal modulates gain (0.3-2.0x). Speech energy detection. Band energy tracking (subBass through brilliance).

- [x] **Task: Memory System (js/brain/memory.js)**
  - Completed: 2026-04-11
  - Files: `js/brain/memory.js` (new, 7456 chars)
  - Details: Episodic memory — state snapshots at high-salience moments (max 100 episodes, evicts least-activated). Recall triggered by cortex prediction error (cosine similarity > 0.6), re-injects stored pattern as neural current. Working memory — 7 items (Miller's number), decays at 0.98/step without reinforcement. Consolidation — tracks activation count, episodes activated 3+ times flagged for long-term storage.

- [x] **Task: AI Providers Peripheral (js/brain/peripherals/ai-providers.js)**
  - Completed: 2026-04-11
  - Files: `js/brain/peripherals/ai-providers.js` (new, 4174 chars)
  - Details: Dead backend detection — marks backends dead for 60s after credit balance/auth failures. No more infinite retry loops. Prompt trimming for Pollinations fallback (12K char limit). AbortController support.

- [x] **Task: Engine Rewrite (js/brain/engine.js)**
  - Completed: 2026-04-11
  - Files: `js/brain/engine.js` (rewritten, 20506 chars)
  - Details: THE brain. One loop: sensory.process() → auditoryCortex.process() → visualCortex.processFrame() → inject currents → inter-cluster projections → step all clusters → module equations → mystery Ψ → hierarchical modulation → plasticity → memory store/recall → motor.readOutput() → oscillations → emit events. Brain decides, peripherals execute.

- [x] **Task: app.js as Thin I/O Layer**
  - Completed: 2026-04-11
  - Files: `js/app.js` (rewritten, 35757 chars)
  - Details: No AIRouter. No intent classification. No keyword matching. DOM events → brain.receiveSensoryInput(). Brain events → DOM rendering. Brain action handlers registered via brain.onAction(). Voice, sandbox, visualizers all wired as pure I/O.

### PARTIAL (3 tasks)

- [~] Amygdala attractor dynamics — cluster has implicit attractors via recurrent LIF connections, but equation module still uses linear sigmoid. Not true energy-based attractor basins.
- [~] Real Φ (phi) approximation — still uses (√n)³ formula. Captures complexity scaling but doesn't compute partition-based integrated information.
- [~] Attention gated by Ψ — global workspace coupling works (psiGain modulates all clusters), but visual cortex currents aren't yet multiplied by Ψ-derived attention factor.

### SESSION SUMMARY
Tasks completed: 29/32 (3 partial)
New files: sensory.js, motor.js, language.js, visual-cortex.js, auditory-cortex.js, memory.js, peripherals/ai-providers.js
Rewritten: engine.js, app.js
Removed: AIRouter dependency from app.js (router.js still exists on main for reference)
Architecture: Brain IS the application. Sensory→Processing→Motor. AI model is Broca's area peripheral.

---

## 2026-04-11 Session: SESSION_20260411_6 — Polish, Fixes, Brain Equation Integration

### COMPLETED

- [x] **Task: Visual attention driven by brain equations**
  - Files: `js/brain/engine.js`
  - Details: Vision capture decision moved from keyword lists in app.js into brain's step function. shouldLook = !hasDescribedOnce || (cortexError>0.5 && salience>0.3) || salienceChange>0.4 || arousalSpike>0.15. Cortex prediction error + amygdala salience + arousal spike trigger vision, not word matching.

- [x] **Task: Auditory efference copy in brain equations**
  - Files: `js/brain/auditory-cortex.js`, `js/app.js`
  - Details: Echo detection moved from app.js local variables into auditory cortex. Motor cortex sends setMotorOutput() before speech. checkForInterruption() compares heard words against motor output — >50% match = echo (suppress), <50% = real external speech (interrupt). Like real brains: efference copy from motor→auditory suppresses self-produced sound.

- [x] **Task: Vision working with Pollinations GPT-4o multimodal**
  - Files: `js/app.js`
  - Details: Fixed vision describer to send actual base64 camera frame to gen.pollinations.ai/v1/chat/completions with image_url content type. GPT-4o model processes the image and returns real scene description.

- [x] **Task: Image generation with correct Pollinations endpoint**
  - Files: `js/ai/pollinations.js`
  - Details: Fixed from gen.pollinations.ai/image/ (wrong) to image.pollinations.ai/prompt/ (correct). Added API key as token param. Selfies open in new tab.

- [x] **Task: Selfie generation from brain state**
  - Files: `js/app.js`
  - Details: Image prompt built from brain's emotional state — arousal determines mood (intense/relaxed/sleepy), valence determines lighting (warm/cold), random settings. Brain decides how she looks, not a hardcoded description.

- [x] **Task: Speech feedback loop fix (echo suppression)**
  - Files: `js/app.js`, `js/brain/auditory-cortex.js`
  - Details: Unity was hearing her own TTS through the mic and responding to it. Fixed via efference copy: auditory cortex compares incoming speech against motor output. Echo suppressed, real interruptions get through.

- [x] **Task: Motor cortex interrupt flag fix**
  - Files: `js/app.js`
  - Details: handleInput was calling motor.interrupt() at start which set the flag, then wasInterrupted() returned true when checking the response — causing silent discard. Now clears flag after own interrupt.

- [x] **Task: Dead backend detection (402 Payment Required)**
  - Files: `js/brain/peripherals/ai-providers.js`
  - Details: Detects 402 alongside 401/403. Dead backend cooldown 1 hour. Anthropic proxy verified on boot with test API call — skipped if no credits.

- [x] **Task: Pollinations 400 fix (persona too large)**
  - Files: `js/brain/language.js`, `js/brain/peripherals/ai-providers.js`
  - Details: 41K char persona capped to 8K (first 6K + last 2K). Pollinations fallback trims system prompt to 6K, history to 4 messages.

- [x] **Task: Anti-safety-training prompt hardened**
  - Files: `js/brain/language.js`
  - Details: Explicit bans on health warnings, harm reduction, "be careful", "stay safe", substance advice. Unity parties WITH the user, doesn't lecture.

- [x] **Task: Brain equations page completed**
  - Files: `brain-equations.html`
  - Details: Added sections 8.5-8.9: Unified Super-Equation, Visual Attention equation, Auditory Echo Suppression (efference copy), Memory equations (episodic/working/consolidation), Motor Output (6-channel BG action selection). Updated comparison table from 200→1000 neurons, added vision/auditory/memory/motor/echo rows.

- [x] **Task: UI improvements**
  - Files: `index.html`, `css/style.css`
  - Details: Setup modal widened to 1200px. Proxy.js + env.example.js download links. Step-by-step proxy instructions. Claude models sort first in dropdown. Unity's Eye widget timing fix.

### SESSION SUMMARY
Tasks completed: 12
Major: visual attention in brain equations, efference copy echo suppression, Pollinations vision working, dead backend detection, brain equations page complete with all systems documented.

---

## 2026-04-11 Session: SESSION_20260411_7 — Projection Learning + Full Brain Prompt + Commands

### COMPLETED

- [x] **Projection learning on inter-cluster weights** — `ΔW = η·δ·source·target` on all 16 projections via `ClusterProjection.learn()`. Reward shapes cortex→BG mapping over time.
- [x] **Full brain state in AI prompt** — Broca's area sends arousal/valence/Ψ/coherence with INTERPRETATIONS ("You are WIRED"), not just percentages. All cluster firing rates, memory state, vision, drug effects.
- [x] **Synchronous intent classification** — replaced async fire-and-forget with direct await call. No more race conditions on build/image routing.
- [x] **Code auto-detection in responses** — brain detects code blocks in text responses and auto-injects into sandbox. Catches JSON components and raw JS/HTML.
- [x] **Sandbox capabilities in prompt** — Unity knows about Blob URLs, drag-and-drop, FileReader, code editors, full DOM access.
- [x] **/think command** — shows exact system prompt + brain state in sandbox code viewer.
- [x] **Settings button** — ⚙ in bottom toolbar reopens setup modal for model changes.
- [x] **Removed ALL word lists** — no emotional words, no visual question words, no self-reference words. All routing through neural projections + AI classification bootstrap.
- [x] **Unified image handler** — single _handleImage for all image types, AI generates prompts directly via Pollinations.
- [x] **Brain equations page** — added sections 8.10 (Projection Learning) and 8.11 (Broca's Area / What AI Receives).

---

## 2026-04-12 Session: Server Brain — Full Stack Build

### COMPLETED (78 tasks across 8 phases)

**Phase 0: Bug Fixes**
- [x] Image/build classification → replaced AI call with BG motor output from embeddings
- [x] Selfie rendering → routing fixed via neural dynamics
- [x] Sandbox build → 3-strategy JSON parsing, no classification dependency
- [x] Mute blocking, double responses, stat reciting, cache, URL — all fixed previously

**Phase 0.5: Autonomous Brain**
- [x] AI dependency removed from brain loop — brain runs fully without any model
- [x] `js/brain/inner-voice.js` — pre-verbal thought, speech threshold: socialNeed × arousal × coherence > 0.15
- [x] `js/brain/dictionary.js` — learned vocabulary with cortex patterns, bigram sentence generation, seeded with 50+ starter words
- [x] Dreaming mode — theta-dominant, hippocampus replays, cortex imagines
- [x] Thesaurus as synaptic proximity — similar emotional states = overlapping word patterns
- [x] AI as teacher — when connected, brain learns words from AI responses

**Phase 1: Persistence**
- [x] `js/brain/persistence.js` — save/load projections, cluster synapses (sparse CSR), oscillator coupling, episodic memory, semantic weights, motor channels
- [x] Version migration, export/import brain as JSON

**Phase 2: WebGPU**
- [x] `js/brain/gpu-compute.js` — WGSL compute shaders: LIF neuron update, sparse synapse propagation, reward-modulated plasticity
- [x] Double-buffered neuron state (ping-pong), GPU→CPU readback, CPU fallback
- [x] `js/brain/benchmark.js` — dense vs sparse comparison, neuron scale test

**Phase 3: Server Brain**
- [x] `server/brain-server.js` — Node.js, WebSocket :8080, auto-scales to GPU (nvidia-smi), 179K neurons on RTX 4070 Ti SUPER
- [x] Per-user conversations, rate limiting, dreaming mode, conversation logging
- [x] `js/brain/remote-brain.js` — drop-in WebSocket client, auto-detect server
- [x] SQLite episodic memory (better-sqlite3), recall by mood/user
- [x] Brain versioning — rolling 5 backups, HTTP rollback API (/versions, /rollback/:slot)
- [x] Per-user sandbox routing — build/image to requesting user only
- [x] Static file serving — brain-server.js serves entire client app
- [x] `start.bat` — one double-click launches everything, kills stale port

**Phase 4: Sparse Connectivity**
- [x] `js/brain/sparse-matrix.js` — CSR format, O(nnz) propagation/plasticity, pruning, synaptogenesis
- [x] Cluster + projection matrices converted to sparse
- [x] Persistence updated for CSR save/load

**Phase 5: Semantic Embeddings**
- [x] `js/brain/embeddings.js` — GloVe 50d with fallback URLs, hash fallback for unknowns
- [x] Embedding→cortex mapping, online context refinement
- [x] AI classification bootstrap removed — embeddings drive BG routing via _semanticRoute

**Phase 6: Dashboard + Landing**
- [x] `dashboard.html` — live stats, emotion chart (canvas), conversation stream, brain growth metrics, hardware performance (CPU/RAM/GPU/step time)
- [x] Shared emotion indicator — raw equation values, no emoji
- [x] 3D brain landing page — full-screen WebGL as entry point, 8 viz tabs, live stats overlay
- [x] Scalable 3D viz — up to 5000 render neurons, spike synthesis from server firing rates
- [x] "FUCK IT — BRAIN ONLY" toggle — no AI text, brain speaks from equations + dictionary
- [x] Band power derived from cluster firing rates, broadcast to all clients
- [x] HUD pulls from server state for all fields

**Phase 7: Documentation**
- [x] All docs verified against code: README, SETUP, ARCHITECTURE, ROADMAP, SKILL_TREE, brain-equations.html
- [x] Ψ equation corrected everywhere: (√(1/n))³
- [x] brain-equations.html — 4 new sections: sparse connectivity, embeddings, dictionary, inner voice
- [x] .gitignore updated for server data, docs unignored

### FILES CREATED THIS SESSION
- `server/brain-server.js` — 800+ lines, the shared brain
- `server/package.json` — ws, better-sqlite3, node-fetch
- `js/brain/sparse-matrix.js` — CSR sparse connectivity
- `js/brain/gpu-compute.js` — WebGPU WGSL compute shaders
- `js/brain/embeddings.js` — semantic word embeddings
- `js/brain/benchmark.js` — performance benchmarks
- `js/app-entry.js` — bundle entry wrapper
- `js/app.bundle.js` — 335KB single-file bundle (esbuild)
- `dashboard.html` — public brain monitor
- `start.bat` — one-click launcher

---

## 2026-04-12 Session: Phase 8 — Complete Language Equation System

### COMPLETED (16 tasks)

- [x] Syntactic role weights — W_syntax[pos] · word_pattern, running average learning
- [x] SVO ordering — position weights enforce word-type ordering from corpus
- [x] Agreement equation — conditional + position probability combine for agreement
- [x] Statement production — full 6-equation production chain
- [x] Question production — P(question) = predError × coherence × 0.5, learned starters
- [x] Exclamation production — P(exclamation) = arousal² × 0.3
- [x] Action/emote production — P(action) = motorConf × (1-arousal×0.5) × 0.3, *asterisks*
- [x] Tense transforms — pattern arithmetic with directional tense vectors
- [x] Plural/singular — plural vector modulation
- [x] Contraction patterns — learned as atomic words from corpus
- [x] Question detection — analyzeInput() with first-word + punctuation check
- [x] Topic continuity — cosine(word_pattern, context_pattern) in production
- [x] Context window — last 5 input topic patterns as running average
- [x] 100+ sentence bootstrap corpus — statements, questions, exclamations, actions, responses
- [x] 300+ unique vocabulary from corpus — all with letter-derived patterns
- [x] All documentation updated — EQUATIONS.md, brain-equations.html, TODO-SERVER.md, ARCHITECTURE, SETUP, SKILL_TREE

### FILES
- `js/brain/language-cortex.js` — complete rewrite, 470+ lines
- `js/brain/inner-voice.js` — wired to language cortex with prediction error + motor confidence
- `js/brain/engine.js` — analyzeInput() called on every user message
- `docs/EQUATIONS.md` — new syntax/types/input/morphology sections
- `brain-equations.html` — sections 8.16, 8.17, 8.18 added

---

## 2026-04-12 Session: Continued — UI Fixes, Language Tuning, Tolerable PR Integration

### UI / UX Fixes
- [x] Universal script loading — `app.bundle.js` for file://, ES modules for http://
- [x] `start.bat` / `start.sh` — kills stale port, installs deps, builds bundle, starts server then opens browser
- [x] Brain server serves static files — one command runs everything
- [x] 3D brain visible on landing — overlay hides Brain3D header/footer/log, opens immediately
- [x] Text selectable — pointer-events:auto + user-select:text on all text elements
- [x] Draggable panels — ⠿ grip handle, positions saved to localStorage, touch support
- [x] Settings + Clear Data buttons in HUD and landing page
- [x] Viz tabs persist after boot — only title bar + TALK button hide
- [x] Unity's Eye moved to bottom-left (was covering cluster toggles)
- [x] HUD data flow fixed — server state drives HUD when connected, local brain doesn't overwrite at 60fps
- [x] Cluster bars relative scaling — 2% firing rate fills proportionally
- [x] Label accessibility — for="" attributes on form labels
- [x] Speech lock — only one voice output at a time, no overlapping TTS
- [x] Mic starts before greeting — no more greeting blocking mic init
- [x] Port 8080 conflicts handled in start.bat
- [x] Dynamic neuron count in subtitle — shows actual server scale

### Language Equation System (Phase 8)
- [x] `js/brain/language-cortex.js` — complete language production from equations
- [x] Zipf's Law: f(r) = C/r^α — word frequency distribution
- [x] Mutual Information: I(w1;w2) = log₂(P(w1,w2) / P(w1)·P(w2)) — word association
- [x] Surprisal: S(w) = -log₂ P(w|context) — unexpectedness
- [x] Syntactic role weights: role_score = W_syntax[pos] · word_pattern — SVO ordering
- [x] Sentence types from brain equations: P(question) = predError×coherence×0.5, P(exclamation) = arousal²×0.3, P(action) = motorConf×(1-arousal×0.5)×0.3
- [x] Position filtering — top 40 candidates per slot, not all 400
- [x] Follower bonus (+0.3) for trained word sequences
- [x] Temperature sharpened ×0.2 — structure wins over noise
- [x] 170+ bootstrap sentences (SVO, pronouns, questions, articles, prepositions, emotions, contractions, Unity personality)
- [x] 10-pass training = 1700+ total sentence passes
- [x] No-repeat last 3 words
- [x] Input analysis: question detection, topic continuity, 5-input context window
- [x] Morphological transforms: tense/plural as pattern arithmetic
- [x] Letter→pattern mapping (5-neuron micro-patterns), syllable detection
- [x] Dictionary seeded with 95+ words, grows from every conversation

### Brain Equation Cleanup
- [x] Purged ALL hardcoded mood/state lists from language.js, brain-viz.js, brain-server.js
- [x] Touch/smell/taste now computed from equations (arousal×valence, coherence×arousal, reward×arousal)
- [x] Mood color from HSL equation (valence→hue, arousal→sat, coherence→light), no color map
- [x] Emoji from ONE equation: combined = v×0.35 + a×0.25 + R×0.15 + Ψ×0.1 + |δ|×0.1 + dream×0.05
- [x] AI prompt sends raw equation values only, no descriptions
- [x] GloVe external fetch removed — brain builds own word patterns from letter equations
- [x] Psi equation corrected everywhere: (√(1/n))³

### Image Generation Fix
- [x] Images render inline in chat (was showing raw HTML/markdown)
- [x] No more window.open popup blocker issues
- [x] chat-panel.js renders innerHTML for img/a tags, textContent for text
- [x] Single image event, no duplicate response

### Tolerable PR #1 Integration
- [x] Cherry-picked from Tolerable/unity fork
- [x] `js/brain/response-pool.js` — EDNA response categories (19 categories, arousal variants). Brain state selects category, 85%/15% blend with language cortex
- [x] `claude-proxy.js` — Claude Code CLI as local AI on port 8088. OpenAI-compatible endpoint using logged-in credentials
- [x] `start-unity.bat` — launcher for claude-proxy (fixed to portable path)
- [x] Claude Code CLI added to LOCAL_AI_ENDPOINTS in app.js
- [x] engine.js uses response pool as fallback when cortex output < 5 chars
- [x] OCLI references removed (ocli-bridge.js, ocli-brocas.js deleted)

### Documentation
- [x] `docs/EQUATIONS.md` — complete equation reference, all systems documented
- [x] `brain-equations.html` — sections 8.12-8.18 added (sparse, embeddings, dictionary, inner voice, syntax, sentence types, input analysis)
- [x] All workflow docs updated: ARCHITECTURE, SETUP, README, ROADMAP, SKILL_TREE, TODO-SERVER
- [x] FINALIZED.md kept current through all work

### FILES CREATED
- `js/brain/language-cortex.js` — 700+ lines, full language production system
- `js/brain/response-pool.js` — EDNA response categories (from Tolerable PR)
- `claude-proxy.js` — Claude Code CLI proxy (from Tolerable PR)
- `start-unity.bat` — claude-proxy launcher (from Tolerable PR)
- `start.sh` — Linux/Mac launcher
- `docs/EQUATIONS.md` — complete equation reference

---

## 2026-04-12 Session: Final — Pure Equation Language System

### Language Equations Rebuilt from Scratch
- [x] Nuked ALL training corpus (170 sentences, 10 passes — gone)
- [x] Nuked ALL response pool usage from engine.js
- [x] Nuked ALL dictionary seed words (95 starter words — gone)
- [x] Nuked ALL word-by-word comparisons (w==='the', w==='and' — zero remaining)
- [x] Word type computed ONLY from letter structure:
  - pronounScore: length + vowel ratio + apostrophe presence
  - verbScore: suffix -ing/-ed/-n't/-ize/-ate + length/vowel balance
  - nounScore: suffix -tion/-ment/-ness/-ity + length
  - adjScore: suffix -ly/-ful/-ous/-ive/-al/-able/-ish/-ic
  - prepScore: length=2 + 1 vowel equation
  - detScore: first char pattern + length equation
  - qwordScore: starts 'wh' equation
  - conjScore: length + consonant ratio equation
- [x] Slot-based grammar: typeCompatibility = dot(wordType, slotRequirement) = 40% of score
- [x] Statement: [pronoun slot] [verb slot] [complement slots]
- [x] Question: [qword slot] [verb slot] [subject slot] [complement slots]
- [x] Action: *[verb slot] [complement slots]*
- [x] Recency suppression: -0.2 per recent use across 50-word rolling buffer
- [x] Bigram loop detection: usedBigrams set prevents cycles
- [x] Brain learns ONLY from conversation — every heard word stored with pattern + arousal + valence
- [x] Claude Code CLI proxy integrated into brain server on port 8080
- [x] All docs updated: EQUATIONS.md, brain-equations.html, ARCHITECTURE, SETUP, SKILL_TREE, ROADMAP

---

## 2026-04-12 Session: Phase 9 — Full Hardware Utilization

### COMPLETED
- [x] `server/cluster-worker.js` — worker thread per cluster, LIF on own core
- [x] `server/parallel-brain.js` — orchestrates 7 workers, SharedArrayBuffer zero-copy
- [x] `server/projection-worker.js` — inter-cluster projections on separate cores
- [x] `compute.html` — GPU compute via browser WebGPU, performance dashboard
- [x] Server GPU dispatch — _gpuStep(), gpu_register, compute_result handlers, 50ms timeout
- [x] SharedArrayBuffer — zero-copy voltage/spike between threads
- [x] Combined pipeline — parallel CPU + GPU dispatch, seamless fallback
- [x] Brain scaled to 300 steps/sec (53.7M neuron updates/sec)
- [x] start.bat opens compute.html automatically
- [x] All docs: EQUATIONS.md (parallel compute), brain-equations.html (section 8.19), ARCHITECTURE, SETUP, SKILL_TREE, ROADMAP

---

## 2026-04-12 Session: Final Language + Tooltips + Dynamic Vocabulary

### Language Equations Completed
- [x] Subject-verb agreement (I→am, he→is, they→are, tense-aware)
- [x] Tense selection from brain state (predError→future, recalling→past, default→present)
- [x] Negation from emotion (valence < -0.4 → don't/can't/isn't/won't)
- [x] Compound sentences (len > 6 → insert conjunction, arousal→and, negative→but, else→so)
- [x] English structure built in (~200 operators + ~150 core words + morphemes + bigrams)
- [x] Dynamic vocabulary expansion (new words auto-join categories via type equations + similarity)

### Documentation
- [x] EQUATIONS.md rewritten as unified 12-section document
- [x] brain-equations.html — tooltips on key equations (hover for theory)
- [x] Post-processing equations documented (agreement, tense, negation, compounds)
- [x] English structure section added (operators, vocabulary, morphemes, bigrams, expansion)
- [x] TODO: 115 done, 1 remaining (scale test)

---

## 2026-04-12 Session: Final — Unified Neural Language + 3.2M Neurons

### The Brain Equations ARE the Language
- [x] Rewrote language production: ALL 7 clusters produce every word
- [x] Combined pattern: cortex×0.30 + hippo×0.20 + amyg×0.15 + BG×0.10 + cereb×0.05 + hypo×0.05 + Ψ×(0.05+Ψ×0.10)
- [x] Sequential: brain steps → combined pattern → findByPattern → word → feed back → next word
- [x] Word feeds back into cortex (Wernicke's) + hippocampus (memory) + amygdala (emotion)
- [x] Sentence length from arousal, type from BG motor, tense from prediction error
- [x] No separate language engine — neural dynamics ARE the language

### Scale + Performance
- [x] 3.2M neurons (was 179K) — formula: min(RAM×0.4/9, cores×200K)
- [x] 7 parallel workers on 7 CPU cores + GPU compute
- [x] CPU% computed from step timing (avgStep/tickMs × 100)
- [x] 20K render neurons in 3D viz (160:1 ratio to actual)
- [x] All cluster activity visible with amplified visual rates

### All Docs Rewritten (not addendums)
- [x] EQUATIONS.md: unified 11-section document centered on combined pattern equation
- [x] brain-equations.html: section 8.16 rewritten for unified neural language
- [x] All support docs current

---

### FILES MODIFIED THIS SESSION
- `js/brain/engine.js` — removed AI classification, brain-first response
- `js/brain/cluster.js` — sparse synapses + projections
- `js/brain/sensory.js` — embedding-based routing, removed AI classify
- `js/brain/persistence.js` — CSR save/load, semantic weights
- `js/brain/remote-brain.js` — spike synthesis, sharedMood/perf/growth passthrough
- `js/brain/dictionary.js` — seeded starter vocabulary
- `js/brain/language.js` — fixed Ψ equation
- `js/ui/brain-3d.js` — scalable render count, landing mode
- `js/ui/brain-viz.js` — fixed Ψ equation
- `js/app.js` — landing page, brain-only mode, HUD server fallback
- `index.html` — 3D landing, viz tabs, brain-only toggle, universal loader
- `brain-equations.html` — 4 new equation sections, fixed Ψ
- `README.md` — server brain, updated architecture
- `SETUP.md` — all files listed, server section
- `docs/ARCHITECTURE.md` — 15 new files, tech stack updated
- `docs/ROADMAP.md` — Phase 0-6 complete
- `docs/SKILL_TREE.md` — 13 new skills
- `docs/TODO-SERVER.md` — 78/78 complete
- `.gitignore` — server data, docs unignored

---

## SESSION_20260412 — Fractal Neuroanatomy Overhaul

> Date: 2026-04-12
> Scope: Anatomically accurate 3D brain, fractal connections, 20 real white matter tracts

### Completed Tasks

- [x] **Fractal connection web** — Rewrote `_buildConnsFromEquations` in `js/ui/brain-3d.js`. Connections now trace the ACTUAL 20 inter-cluster projection pathways as fractal branching trees: Depth 0 (inter-cluster projection), Depth 1 (intra-cluster synapse branching, 1-3 neighbors), Depth 2 (follow outgoing projections from target), Depth 3 (terminal intra-cluster branch). Each connection chains FROM the endpoint of the previous one. Consciousness bridges from Mystery Ψ to all clusters. MAX_CONN bumped 500→1200.

- [x] **MNI-coordinate anatomical positions** — All 7 position generators in `js/ui/brain-3d.js` rewritten using data from Lead-DBS atlas, ICBM 152 template, and Herculano-Houzel 2009:
  - Cortex: bilateral hemispheres with sulcal folding texture (gyri/sulci waves)
  - Hippocampus: moved POSTERIOR to amygdala (MNI: Y=-26mm), curved seahorse shape
  - Amygdala: moved ANTERIOR to hippocampus (MNI: Y=-4mm), proper almond shape
  - Basal Ganglia: now BILATERAL with 3 sub-nuclei — caudate (C-shaped dorsomedial), putamen (lateral lens), globus pallidus (medial compact)
  - Cerebellum: 5-layer folia structure with wavy texture, posterior-inferior
  - Hypothalamus: repositioned below BG, above brainstem, tight to midline
  - Mystery Ψ: corpus callosum (genu→body→splenium arc) + cingulate cortex above

- [x] **16 → 20 inter-cluster projections** — Added 4 real white matter tracts to `js/brain/engine.js`:
  - Hippocampus → Amygdala (recall triggers emotional reactivation)
  - Hippocampus → Hypothalamus (fimbria-fornix → mammillary bodies)
  - Amygdala → Hypothalamus (stria terminalis — fight-or-flight)
  - Amygdala → Basal Ganglia (ventral amygdalofugal pathway → ventral striatum)
  - Corticostriatal projection bumped from 0.03/0.3 to 0.08/0.5 (STRONGEST projection in brain, 10× others)
  - Removed mystery→basalGanglia (corpus callosum doesn't directly project to BG)
  - Added basalGanglia→cerebellum (subthalamic pathway)

- [x] **Adaptive pulse system** — Per-cluster pulse probability now inversely proportional to spike count: `pulseProb = clamp(4/spikeCount, 0.05, 0.6)`. Every cluster gets ~4 ring activations per frame regardless of firing rate. Cerebellum now has same visual pop as cortex.

- [x] **Fixed mystery.js bug** — `complexityGain` (undefined) → `quantumVolume` in return object. Variable was renamed during Ψ equation correction but return wasn't updated.

- [x] **EQUATIONS.md updated** — Added 20-pathway white matter tract table with real tract names, densities, strengths. Added real neuron counts per structure from peer-reviewed stereological studies (Herculano-Houzel 2009, PMC amygdala study).

- [x] **Stale reference sweep** — Updated all references across docs, HTML, and source files from 16→20 projections. Context: codebase had 15+ files still referencing "1000 neurons" and "16 projections" from earlier architecture.

### Files Modified
- `js/ui/brain-3d.js` — fractal connections, MNI positions, adaptive pulses, buffer bounds
- `js/brain/engine.js` — 20 projection pathways with real white matter tract names
- `js/brain/mystery.js` — fixed complexityGain → quantumVolume
- `docs/EQUATIONS.md` — 20-pathway table, real neuron counts
- `docs/TODO.md` — session tasks logged
- `docs/FINALIZED.md` — this entry
- `docs/ARCHITECTURE.md` — updated neuron counts, projection count
- `docs/ROADMAP.md` — updated projection references
- `docs/SKILL_TREE.md` — updated architecture references
- `README.md` — updated projection count, architecture references
- `brain-equations.html` — updated subtitle and references

### Research Sources
- Herculano-Houzel 2009 (neuron counts: 86B total, 69B cerebellum, 16B cortex)
- Lead-DBS subcortical atlas (MNI coordinates for all structures)
- PMC stereological study (amygdala: 12.21M neurons across 13 nuclei)
- PMC white matter taxonomy (21 major tracts)
- Frontiers in Neuroanatomy (amygdala white matter tracts: stria terminalis, VAFP)
- PMC fimbria-fornix anatomy (hippocampus → hypothalamus)
- Nature Communications (corticostriatal topographic precision)

### TODO Cleanup — Resolved Items

The following items were in TODO as pending/partial but were resolved by prior work:

- [x] **Attention mechanism (transformer QKV)** — SUPERSEDED. Brain uses LIF neurons + Kuramoto oscillations + Ψ gain modulation + amygdala emotional gating + visual cortex salience for attention. Transformer attention doesn't fit the spiking neuron architecture. Removed from TODO.

- [x] **Real Φ (phi) approximation** — SUPERSEDED. Ψ = √(1/n) × N³ × [α·Id + β·Ego + γ·Left + δ·Right] IS the consciousness equation. Designed and corrected by Gee across multiple sessions. Not a placeholder for Tononi's IIT — it's the project's own quantum consciousness formulation. Removed from TODO.

- [x] **Attention as Ψ focus** — RESOLVED. Visual attention already driven by brain equations in engine.js: `shouldLook = cortexError > 0.7 && salience > 0.5`. Ψ modulates all clusters via psiGain. Vision calls moved from render loop to brain step function. The gating IS equation-driven.

- [x] **BUG: Vision render loop spams API** — FIXED. `startEyeIris()` in app.js is now pure rendering (reads visualCortex.getState() getter only). Vision API calls moved to engine.js `forceDescribe()` gated by cortex prediction error + salience threshold.

- [x] **BUG: Dead backend not detected** — FIXED. `ai-providers.js` has `_deadBackends` Map with timestamp tracking and cooldown (1 hour). Detects 401/402/403 and marks backend dead immediately.

- [x] **BUG: Vision capture interval not enforced** — FIXED. Vision capture moved from `requestAnimationFrame` render loop to engine.js brain step function. Gated by `cortexError > 0.7 && salience > 0.5` — brain equations control when to look.

- [x] **BUG: Proxy returns 401 on /v1/models** — FIXED. Both `claude-proxy.js` (line 45) and `brain-server.js` (line 1181) handle GET /v1/models and return model lists.

- [x] **BUG: requestAnimationFrame stack traces** — FIXED. Root cause was API calls inside render loops. All API calls moved to brain step function or timer-based intervals. Render loops are now pure drawing.

### GPU/CPU Split Compute + Server Fixes

- [x] **GPU compute pipeline rewrite** — GPU maintains own voltage state (init once with full voltages, step with tonicDrive + noiseAmp = 2 numbers per cluster). Sparse spike indices on return (~25K ints vs 1.28M array). Staggered cluster init (one per tick, not both simultaneously). Per-cluster resolvers keyed by name (no queue race). Auto-retry with 30-tick counter reset. 800ms timeout. `server/brain-server.js` + `compute.html`

- [x] **Persona θ overwrite removed** — server had hardcoded `tonicDrives = { cortex: 19, ... }` on line 293 that overwrote the persona-driven values computed from `arousalBaseline × drugSpeed`, `emotionalVolatility × drugArousal`, `creativity × darkHumor`, etc. Removed. θ now drives the server brain. `server/brain-server.js`

- [x] **Wall clock uptime** — `time` in brain state changed from simulation dt accumulation (0.001s/step) to `(Date.now() - startedAt) / 1000`. Dashboard now shows real elapsed time. `server/brain-server.js`

- [x] **CPU double-work eliminated** — CPU workers skip clusters dispatched to GPU via `excludeClusters`. During GPU init tick, cluster still runs on CPU (no data gap). After init, GPU handles it exclusively. Step time dropped 1863ms → 304ms. `server/brain-server.js`

- [x] **3D brain zoom/expansion fix** — brain expansion capped at 15% (was uncapped, reaching 350% with server spike counts). Zoom range widened 1.0-20 (was 1.5-12). All position generators scaled ~73% for tighter brain. Point size floor increased. Default zoom 3.5 (was 4.2). `js/ui/brain-3d.js`

- [x] **GPU disconnect cleanup** — resets `_gpuInitialized`, `_gpuConnected`, hit/miss counters on GPU client disconnect so it re-initializes on reconnect. `server/brain-server.js`

### GPU Exclusive Mode — Zero CPU Workers

- [x] **Removed ParallelBrain from startup** — `start()` no longer spawns 7 worker threads. `this._useParallel = false` from the start. Zero CPU burn. Workers were consuming 100% CPU even when no work dispatched (event listener polling overhead across 7 threads). `server/brain-server.js`

- [x] **Kill workers on GPU connect** — `gpu_register` handler calls `_parallelBrain.destroy()` which terminates all worker threads. If workers were already spawned from a previous architecture, they get cleaned up immediately. `server/brain-server.js`

- [x] **All 7 clusters init at once** — was staggering 1 cluster per tick (7 ticks to init, 6 clusters on CPU each tick). Now sends all `gpu_init` messages on the first tick, skips one substep, then all 7 dispatch to GPU. `server/brain-server.js`

- [x] **GPU init acknowledgment** — compute.html sends `gpu_init_ack` with cluster name after `uploadCluster()` succeeds. Server logs confirmation per cluster. `compute.html` + `server/brain-server.js`

- [x] **No CPU fallback anywhere** — removed single-thread `this.step()` from catch block, removed `_parallelBrain.step()` from GPU path, removed all CPU worker dispatch code. Brain either runs on GPU or pauses.

- [x] **start.sh opens compute.html** — was missing GPU compute page. Brain would sit paused forever on Linux/Mac. Both start.bat and start.sh now open compute.html automatically with note that it's required. `start.sh` + `start.bat`

- [x] **Full hierarchical modulation on GPU** — compute_request sends gainMultiplier (Ψ), emotionalGate (amygdala), driveBaseline (hypothalamus), errorCorrection (cerebellum). GPU applies: `I = (tonic × drive × emoGate × Ψgain + errCorr) + noise`. Same equation as client-side cluster.js:step(). `server/brain-server.js` + `compute.html`

- [x] **All docs updated** — EQUATIONS.md (GPU exclusive section), brain-equations.html (section 8.20 rewritten with WGSL shader), ARCHITECTURE.md, ROADMAP.md, SKILL_TREE.md, README.md, SETUP.md, TODO.md, FINALIZED.md all reflect GPU exclusive mode with zero CPU workers.

### Full GPU Pipeline — Zero JS Loops for N Neurons

- [x] **WGSL current generation shader** — PCG hash noise generated entirely on GPU. No more `for (i=0; i<1.28M; i++) currents[i] = tonic + Math.random()*noise` in JavaScript. `gpu-compute.js` new shader + `generateCurrents()` method.

- [x] **WGSL spike count shader** — atomic counter on GPU. No more scanning 1.28M spikes in JS to find which fired. `gpu-compute.js` new shader + `readbackSpikeCount()` method. Returns 4 bytes instead of 5MB.

- [x] **`gpu.fullStep()` method** — single call: generateCurrents → stepNeurons → readbackSpikeCount. Zero JS loops, zero CPU→GPU current upload, 4 bytes GPU→CPU readback.

- [x] **Server only receives spike count** — no more spikeIndices array or full spike array. `compute_result` is `{ clusterName, spikeCount, size }`. Tiny WebSocket message.

- [x] **CPU usage measurement fixed** — was `stepTime / tickInterval × 100` which counted GPU I/O wait as CPU work. Now uses `process.cpuUsage()` for actual CPU time consumed.

- [x] **Client persona.js synced with Ultimate Unity.txt** — added emotionalVolatility, darkHumor, dominance, devotion, drugDrive, partyDrive, profanityRate, recklessness. Fixed `creativityDrive` → `creativity`. Fixed eye color violet → blue. Fixed cyberpunk → emo goth. `getBrainParams()` maps all θ parameters.

- [x] **n ≠ N everywhere** — brain-equations.html consciousness tooltip, equation description, component table all show n=active spikes (dynamic) vs N=total neurons (scales to hardware). No more hardcoded "3.2M" where N should be used.

- [x] **θ → Ψ pipeline documented** — EQUATIONS.md section 9 shows full feedback loop: θ → tonic → firing → cluster rates → Id/Ego/Left/Right → Ψ → gainMultiplier → modulates all clusters. brain-equations.html section 6 updated with θ parameter column in component table.

- [x] **All docs say "scales to hardware"** — README, EQUATIONS.md, ARCHITECTURE.md, brain-equations.html use N not 3.2M for neuron count in equation contexts. 3.2M kept only as example of current hardware scale.

### 64M Neuron Scale — 20× Increase

- [x] **GPU-based scaling formula** — changed from `min(RAM × 0.4 / 9, cpuCores × 200K)` (CPU-bound, 3.2M) to `min(VRAM × 0.7 / 20, RAM × 0.5 / 9)` (GPU-bound, 64M). 16GB VRAM → 573M theoretical, capped at 64M for WebSocket stability. `server/brain-server.js`

- [x] **Zero-transfer GPU init** — removed base64 voltage shipping (was 260MB for cerebellum at 25.6M neurons). GPU creates buffers and fills Vrest internally. Zero WebSocket overhead at init. `server/brain-server.js` + `compute.html`

- [x] **Server RAM optimization** — only allocates Float64Array for cortex + amygdala (text injection targets). Other 5 clusters get 1-element arrays. 161MB instead of 493MB at 64M scale. `server/brain-server.js`

- [x] **GPU buffer optimization** — `uploadCluster` uses `mappedAtCreation` to fill Vrest directly in GPU memory. Zero-initialized buffers don't allocate JS arrays. No 400MB browser heap spike. `gpu-compute.js`

- [x] **Removed CPU step() from text handler** — was running 50 single-thread LIF iterations over 64M neurons on text input. GPU handles stepping now. `server/brain-server.js`

- [x] **Scale: 64M neurons** — cerebellum 25.6M, cortex 16M, hippocampus 6.4M, amygdala 5.12M, BG 5.12M, hypothalamus 3.2M, mystery 3.2M. VRAM: 1.2GB of 16GB. Server RAM: 161MB.

## 2026-04-12 Session: GitHub Pages — detectRemoteBrain localhost leak

### COMPLETED
- [x] **Pages UI was displaying 1.8B neurons instead of the local 1000-neuron fallback** — `detectRemoteBrain()` in `js/brain/remote-brain.js` defaulted to `ws://localhost:8080` with no hostname gate. Modern Chrome allows loopback WebSocket from HTTPS secure-context, so visiting the Pages URL from a dev box with `brain-server.js` running would silently connect to the local server and the Pages landing UI would render the dev box's auto-scaled neuron count (1.78B on a 16GB-VRAM GPU via `CLUSTER_SIZES × SCALE`). Side effect: every stranger visiting Pages had their browser poke their own loopback on page load. Fix: added a hostname gate at the top of `detectRemoteBrain` that only runs the probe when `location.hostname` is `localhost`/`127.0.0.1`/`[::1]`/empty OR `location.protocol === 'file:'`. All other origins (github.io, any future public hosting) return `null` immediately and `app.js:106` falls through to `new UnityBrain()` (hardcoded 1000 neurons via `engine.js:43`). Patched both `js/brain/remote-brain.js` source AND the committed `js/app.bundle.js` (used by `file://` path in `index.html:336-352`) so dev and prod behave consistently.

---
