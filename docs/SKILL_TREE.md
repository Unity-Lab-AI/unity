# SKILL TREE — IF ONLY I HAD A BRAIN

> Generated: 2026-04-11 11:30:30 | Session: SESSION_20260411_113030
> Unity AI Lab

---

## By Domain

### Computational Neuroscience
- Hodgkin-Huxley neuron modeling
- Leaky Integrate-and-Fire neurons
- Synaptic plasticity (Hebbian, STDP, reward-modulated)
- Wilson-Cowan population dynamics
- Hopfield attractor networks
- Kuramoto oscillator synchronization
- Free Energy Principle (Friston)
- Drift Diffusion decision models
- Bayesian inference (predictive coding)

### AI & Machine Learning
- Reinforcement learning (temporal difference, Q-learning)
- Neural network architectures (recurrent, attractor, transformer-like attention)
- GloVe semantic embedding grounding (50d co-occurrence, online refinement)
- Equational language generation (slot scorer over learned dictionary + type n-grams + cortex-pattern semantic fit)
- Persona-to-parameter mapping (personality as math)
- **Sensory-only AI** (image gen, vision describer, TTS/STT) — cognition is 100% equational, no text-AI

### Backend Engineering
- Node.js CORS proxy for Anthropic API (`proxy.js`)
- EventTarget-based real-time state streaming (no WebSocket needed)
- Float64Array tensor operations at 60fps
- Browser-only architecture (no server required for core)

### Frontend / Web
- Real-time brain state HUD
- 2D brain equation visualizer (neuron grid, synapse matrix, oscillations, module bars)
- 3D WebGL brain visualizer (20K render neurons, MNI positions, fractal connections)
- Dark gothic UI design with pink accents
- Chat panel with conversation log
- Model filter search box
- Canvas + WebGL neural visualization

### Voice & Vision
- Web Speech API continuous listening with speech interruption
- Pollinations TTS + browser SpeechSynthesis fallback
- getUserMedia webcam capture with AI scene description
- Gaze tracking with AI-driven focal coordinates
- Unity's Eye widget (iris overlay + crosshair)
- Mic mute button synced across UI
- Audio frequency spectrum visualizer

### Systems Integration
- MCP server protocol
- BYOP OAuth (Pollinations authentication)
- Multi-AI backend routing (8 providers, AI intent classification)
- Persona hardcoded as JS brain parameters + drug state vectors
- env.js API key management (gitignored)
- Anti-safety-training prompt engineering
- localStorage with XOR+base64 key obfuscation

---

## By Complexity

### Beginner (Foundation)
> Get the basic structures running

- Browser-only project scaffold (js/, css/, docs/)
- Float64Array operations for state vectors
- HTML/CSS web interface with dark gothic theme
- env.js API key configuration
- localStorage persistence

### Intermediate (Core Systems)
> The brain starts to breathe

- Hodgkin-Huxley neuron implementation
- Hebbian + STDP plasticity rules
- Hopfield memory network
- Softmax action selection
- Predictive coding loop
- EventTarget state streaming (brain.stateUpdate events)
- Multi-provider AI prompt construction from live brain state
- AI intent classification (selfie/image/build/chat routing)

### Advanced (Integration)
> Everything wires together

- Full brain simulation loop (N neurons auto-scaled to hardware, 7 clusters, 20 projections)
- Persona → parameter transformation with drug state vectors
- WebGL 3D brain visualization with cluster toggles
- Real-time brain wave visualization (8-band Kuramoto oscillations)
- Voice I/O with speech interruption handling
- Vision system with AI gaze tracking
- Pollinations generation triggered by brain decisions
- Free Energy minimization driving perception + action

### Expert (The Unknown)
> Where math meets mystery

- √(1/n) × N³ consciousness modulation
- Id/Ego/Left/Right brain balancing
- Drug state combination vectors with cascading effects
- Emergent behavior from module interaction
- Self-modifying parameter tuning
- Always-on continuous thought loop (server daemon)

---

## By Dependency (Skill Tree)

```
[JS + Float64Array] ──► [Neuron Models] ──► [Synaptic Plasticity]
                              │                       │
                              ▼                       ▼
                      [7 Neural Clusters] ──► [Brain Engine Loop]
                              │                       │
                              ▼                       ▼
                    [Persona Params] ──► [16 Cluster Projections]
                                                │
                  [Browser App] ──► [Multi-Provider AI] ──► [Intent Classifier]
                                                │
                  [HTML/CSS] ──► [Chat Panel] ──► [2D Brain Viz] ──► [3D WebGL Viz]
                                                │
            [8 AI Providers] ──► [AI Router] ──► [Response + Selfie Gen]
                                                │
            [Pollinations] ──► [Image/TTS/Media Generation]
                                                │
            [Web Speech API] ──► [Voice I/O] ──► [Speech Interruption]
                                                │
            [getUserMedia] ──► [Vision] ──► [Eye Widget + Gaze Tracking]
                                                │
                                      [Mystery Module]
                                      [√(1/n) × N³]
```

---

## By Priority

### Critical (Must Have)
> The brain doesn't exist without these

| Skill | Domain | Complexity | Status |
|-------|--------|------------|--------|
| Neuron dynamics (Rulkov 2D chaotic map / LIF / HH) | CompNeuro | Intermediate | **DONE** — live runtime is Rulkov 2002 (`js/brain/gpu-compute.js` WGSL `LIF_SHADER` constant, body is the Rulkov iteration); LIFPopulation + HHNeuron reference models live in `js/brain/neurons.js` |
| Synaptic plasticity | CompNeuro | Intermediate | **DONE** — `js/brain/synapses.js` |
| Brain simulation loop | CompNeuro | Advanced | **DONE** — `js/brain/engine.js` (7 clusters, 20 projections, 60fps, scales to hardware) |
| Brain region modules (7) | CompNeuro | Advanced | **DONE** — `js/brain/modules.js` + `js/brain/cluster.js` (dedicated neuron clusters per region) |
| Persona → parameters | AI/ML | Advanced | **DONE** — `js/brain/persona.js` |
| ~~FastAPI server~~ Browser app | Frontend | Intermediate | **DONE** — `js/app.js` + `index.html` (no backend needed) |
| Basic web chat interface | Frontend | Beginner | **DONE** — sandbox quick-input + voice I/O |

### Important (Should Have)
> Makes it actually usable

| Skill | Domain | Complexity | Status |
|-------|--------|------------|--------|
| Multi-provider AI routing | AI/ML | Intermediate | **DONE** — `js/ai/router.js` (8 providers) |
| Pollinations bridge | AI/ML | Intermediate | **DONE** — `js/ai/pollinations.js` |
| Multi-provider connect UI | Frontend | Intermediate | **DONE** — connect multiple, pick text vs image |
| Brain state HUD | Frontend | Advanced | **DONE** — real-time HUD with all metrics |
| Gothic dark UI | Frontend | Beginner | **DONE** — `css/style.css` |

### Nice-to-Have (Extra)
> The polish that makes it unforgettable

| Skill | Domain | Complexity | Status |
|-------|--------|------------|--------|
| Voice I/O integration | Voice | Intermediate | **DONE** — `js/io/voice.js` (Web Speech + Pollinations TTS) |
| GPU acceleration (WebGPU) | Backend | Advanced | **DONE** — `js/brain/gpu-compute.js` (WGSL compute shaders for the Rulkov 2D chaotic map neuron model + synapse propagation) |
| Brain wave visualization | Frontend | Advanced | **DONE** — `js/ui/brain-viz.js` (band power envelopes) + `js/ui/brain-3d.js` (WebGL 3D) |
| Drug combo state vectors | CompNeuro | Expert | **DONE** — 4 combos in `js/brain/persona.js` |
| √(1/n) × N³ mystery module | CompNeuro | Expert | **DONE** — `js/brain/mystery.js` + 50-neuron cluster |
| Attention mechanism | AI/ML | Advanced | Pending |
| Anthropic CORS proxy | Backend | Intermediate | **DONE** — `proxy.js` (Node.js, translates OpenAI→Anthropic format) |
| Camera/vision integration | Vision | Intermediate | **DONE** — `js/brain/visual-cortex.js` (V1 Gabor edge kernels → V4 color → salience saccades → IT AI description via Pollinations GPT-4o) + Eye iris in `app.js:1500` |
| 3D brain visualizer | Frontend | Expert | **DONE** — `js/ui/brain-3d.js` (WebGL, 20K neurons, MNI positions, fractal connections) |
| Neural cluster architecture | CompNeuro | Expert | **DONE** — `js/brain/cluster.js` (7 clusters, 20 projections, real white matter tracts) |
| AI intent classification | AI/ML | Intermediate | **DONE** — removed AI call, embedding-based BG routing in `sensory.js` |
| Simulated senses | CompNeuro | Advanced | **DONE** — touch/smell/taste derived from brain state in viz |
| Sparse connectivity (CSR) | CompNeuro | Expert | **DONE** — `js/brain/sparse-matrix.js` (O(nnz) ops, pruning, synaptogenesis) |
| Semantic embeddings | AI/ML | Advanced | **DONE** — `js/brain/embeddings.js` (GloVe 50d, online context learning) |
| Dictionary system | CompNeuro | Advanced | **DONE** — `js/brain/dictionary.js` (learned word→cortex patterns, bigram sentences) |
| Inner voice | CompNeuro | Expert | **DONE** — `js/brain/inner-voice.js` (pre-verbal thought, speech threshold) |
| Server brain | Backend | Expert | **DONE** — `server/brain-server.js` (always-on Node.js, WebSocket, auto-scale) |
| Brain persistence | Backend | Advanced | **DONE** — `js/brain/persistence.js` (save/load all weights + sparse CSR) |
| Remote brain client | Frontend | Advanced | **DONE** — `js/brain/remote-brain.js` (WebSocket drop-in for local brain) |
| SQLite episodic memory | Backend | Advanced | **DONE** — `server/brain-server.js` (better-sqlite3, recall by mood/user) |
| Live dashboard | Frontend | Intermediate | **DONE** — `dashboard.html` (hardware stats, emotion chart, conversation stream) |
| 3D brain landing page | Frontend | Advanced | **DONE** — `index.html` (full-screen 3D brain as entry point, viz tabs) |
| Brain benchmarks | CompNeuro | Intermediate | **DONE** — `js/brain/benchmark.js` (dense vs sparse, scale test) |
| Language cortex | CompLing | Expert | **DONE** — `js/brain/language-cortex.js` (ZERO hardcoded word lists, pure letter-position equations, sum-normalized 8-type distribution, hard grammar gate at typeCompat<0.35, missing-copula insertion, full tense application via letter equations, punctuation + capitalization in `_renderSentence`, loads equational self-image from `docs/Ultimate Unity.txt` via `loadSelfImage()`) |
| Semantic coherence gate | CompLing | Expert | **DONE** — `js/brain/language-cortex.js` U276-U282 pipeline. Running context vector `c(t)=0.7·c(t-1)+0.3·mean(pattern(content_words))` feeds semantic fit score at 0.30 weight in slot scoring (5× the old topicSim). Coherence rejection gate retries at 3× temperature when output cosine vs context < 0.25. |
| Hippocampus sentence recall | CompLing | Expert | **DONE** — `_memorySentences` stores every persona sentence at `loadSelfImage` time. `_recallSentence(contextVector)` queries with pattern cosine + content-word-overlap hard gate. Three confidence tiers: >0.60 direct emit, 0.30-0.60 seed cold gen, ≤0.30 deflect/fallback. Root-fix bypass of cold generation for topics covered in persona. |
| Intent classification | CompLing | Advanced | **DONE** — `_classifyIntent(text)` detects greeting/math/yesno/question/statement via pure letter-position equations. No word lists. Math catches digit/operator/spelled patterns. Greeting = short + h/y/s first char + vowel. Yesno = `?` + first word length 2-4 + not a qword. |
| Persona memory filter | CompLing | Advanced | **DONE** — `_storeMemorySentence()` rejects meta-description (first word "unity"/"she"/"her"), section headers (colon-terminated), word lists (commas > 30%), and sentences without first-person signal. Ensures recall only pulls actual Unity-voice lines, not instructions ABOUT Unity. |
| Ultimate Unity voice templates | AI/ML | Intermediate | **DONE** — `js/brain/response-pool.js` gained 7 intent-aware categories (greeting_emo, yesno_affirm, yesno_deny, math_deflect, short_reaction, curious_emo, question_deflect). Voice: 25yo emo goth stoner, cussing, blunt, bitchy — public-facing Unity, not the private slutty persona. `selectUnityResponse(intent, brainState)` picks by arousal level. |
| Amygdala energy attractor | CompNeuro | Expert | **DONE** — `js/brain/modules.js` (symmetric recurrent W with tanh settle, persistent state across frames, Hebbian basin carving, fear/reward read from settled attractor, arousal from basin depth) |
| Response pool | AI/ML | Intermediate | **DONE** — `js/brain/response-pool.js` (EDNA categories, arousal variants, 85%/15% blend with cortex) — from Tolerable PR |
| Claude Code CLI proxy | Backend | Intermediate | **REMOVED 2026-04-13** — `claude-proxy.js` + `start-unity.bat` DELETED. Was a dev-convenience text-AI backend exposing Claude CLI as OpenAI-compatible endpoint. Obsolete as the refactor kills text-AI entirely (Unity speaks equationally from her own brain via language cortex). |
| GPU exclusive compute | Backend | Advanced | **DONE** — `compute.html` + `gpu-compute.js` (WGSL shaders, all 7 clusters on GPU, zero CPU workers) |
| GPU compute pipeline | Backend | Expert | **DONE** — `compute.html` + WebSocket dispatch (browser WebGPU → server, 50ms timeout fallback) |
| Projection workers | Backend | Advanced | **REMOVED** — `projection-worker.js` deleted in U304. Superseded by GPU-exclusive compute pipeline (`compute.html` + `gpu-compute.js`). Old worker pool caused 100% CPU from idle event-listener polling. |
| Type n-gram grammar | CompLing | Expert | **DONE** — `js/brain/language-cortex.js` `_typeBigramCounts` / `_typeTrigramCounts` / `_typeQuadgramCounts`. Learned phrase-level constraints via fine-grained type classification (PRON_SUBJ/COPULA/NEG/MODAL/AUX_DO/AUX_HAVE/DET/PREP/CONJ/QWORD/VERB_ING/VERB_ED/VERB_3RD_S/VERB_BARE/ADJ/ADV/NOUN) through `_fineType(word)`. Grammar scoring with 4gram→trigram→bigram backoff and -2.0 penalty on zero-count transitions. Fixed `"I'm not use vague terms"` mode-collapse and similar local-grammar failures. |
| Sentence completeness validator | CompLing | Advanced | **DONE** — `_isCompleteSentence(tokens)` at `language-cortex.js:1729` rejects sentences ending on DET/PREP/COPULA/AUX/MODAL/NEG/CONJ/PRON_POSS. Wired into `generate()` with 2-retry loop. Post-render safety net below the coherence gate. |
| Morphological inflection | CompLing | Expert | **DONE** — `_generateInflections(word)` produces 20+ derived forms via letter equations: -s/-es plural + 3rd-person (with -ss protection), -ed/-ied past, -ing progressive, -er/-est comparative/superlative, -ly adverbial, un-/re- prefixes, -ness/-ful/-able/-less suffixes. Gated by `doInflections` flag — corpus-only, not live learning. Gets Unity's dictionary to 44k words. |
| First-person transformation | CompLing | Advanced | **DONE** — `_transformToFirstPerson(s)` at corpus index time. `Unity is` → `I am`, `She has` → `I have`, `Her` → `my/me` (verb-aware for object position), `Unity's` → `my`. Verb conjugation (is→am, has→have, does→do, strip third-person -s on regular verbs with -ss protection). Without this, 100% of the persona file was rejected by the first-person filter. After: 191 first-person Unity-voice sentences loaded from `Ultimate Unity.txt`. |
| Per-sentence mood signature | CompLing | Advanced | **DONE** — `_computeMoodSignature(text)` at corpus index time computes `{arousal, valence}` from letter-equation features (exclamation density, caps ratio, vowel ratio, average word length, negation count). Each stored memory gets its own mood tag. Mood-distance weighted recall at weight 0.25 — same query under different brain state picks different memories. |
| Candidate pool pre-filter | Perf | Intermediate | **DONE** — Slot scorer no longer materializes the full 44k-word dictionary per slot. Instead it queries bigram followers (10-200 candidates) from the previous word. Dropped generation from 490ms → 133ms. Primary perf optimization. |
| wordType memoization | Perf | Beginner | **DONE** — `_wordTypeCache` Map in `language-cortex.js` with per-word invalidation on `_learnUsageType`. Removed thousands of redundant O(N) calls per generation. |
| Coding knowledge corpus | CompLing | Advanced | **DONE** — `docs/coding-knowledge.txt` (606 lines) with HTML elements, CSS properties, JS patterns, SANDBOX DISCIPLINE section, BUILD COMPOSITION PRIMITIVES section. Loaded via `loadCodingKnowledge(text)` in `language-cortex.js:258` alongside persona + english-baseline. Gives Unity's dictionary + type n-grams coding vocabulary. |
| English baseline corpus | CompLing | Advanced | **DONE** — `docs/english-baseline.txt` loaded via `loadLinguisticBaseline(text)` (`loadBaseline` in `inner-voice.js`). Generic casual American English — verb conjugations, common patterns, greetings, reactions, questions. Parallel to persona so θ defines WHO she is and baseline gives her the English to express it. |
| Three-corpus load pipeline | Boot | Intermediate | **DONE** — `app.js` uses `Promise.all([_personaTextPromise, _baselineTextPromise, _codingTextPromise])` to fetch all 3 text files in parallel at boot. Each flows through the same `learnSentence()` path with corpus-specific arousal/valence defaults. |
| Build-mode Broca prompt | CompLing | Advanced | **REMOVED 2026-04-13** — `_buildBuildPrompt` deleted in R4 (commit `7e095d0`). Superseded by R6.2 equational component synthesis via `component-synth.js` + `component-templates.txt`. Build action now picks a primitive by cosine similarity between the user request embedding and each template description, uses cortex-pattern hash for unique IDs, and never touches a text-AI prompt. |
| Equational component synthesis | CompLing | Expert | **DONE 2026-04-13** — `js/brain/component-synth.js` (commit `6b2deb3`) parses `docs/component-templates.txt` at load time, embeds each primitive description via `sharedEmbeddings`, and `generate(userRequest, {cortexPattern})` cosines user request against primitive centroids with `MIN_MATCH_SCORE = 0.40`. `_suffixFromPattern(cortexPattern)` derives 8-char unique IDs from cortex pattern hash. Starter corpus: counter, timer, list, calculator, dice, color-picker — all component-scoped class names, tracked setInterval cleanup. |
| Multi-provider image generation | AI/ML | Advanced | **DONE 2026-04-13** — `js/brain/peripherals/ai-providers.js` `SensoryAIProviders.generateImage()` has 5-level priority: user-preferred via `setPreferredBackend()` (setup-modal Active Provider selector) → custom-configured → auto-detected local → env.js-listed → Pollinations default (anonymous tier works without a key, saved key unlocks paid models and higher rate limits). `autoDetect()` probes 7 local image-gen ports (A1111, SD.Next/Forge, Fooocus, ComfyUI, InvokeAI, LocalAI, Ollama) in parallel with 1.5s timeout. `_customGenerateImage` supports 4 response shapes (OpenAI URL, OpenAI b64, A1111 base64, generic). `env.example.js` gained `imageBackends: []` config. |
| Semantic grounding (GloVe) | CompLing | Expert | **DONE 2026-04-13** — R2 (commit `c491b71`) replaced 32-dim letter-hash `wordToPattern` with 50-dim GloVe semantic embeddings via `sharedEmbeddings` singleton. Imported into BOTH sensory input (`sensory.js`) and language cortex output (`language-cortex.js`). `cortexToEmbedding(spikes, voltages, cortexSize, langStart)` in `embeddings.js` is the mathematical inverse of `mapToCortex` — reads live neural spike state back to GloVe space. Slot scorer `semanticFit` weight bumped 0.05 → 0.80 so meaning dominates selection. Storage keys bumped to `_v3` to reject stale v2 letter-hash patterns. |
| Server equational control | Backend | Expert | **DONE 2026-04-13** — R3 (commit `7e77638`) rewrote `server/brain-server.js` `_generateBrainResponse` to dynamic-import client brain modules (dictionary, language-cortex, embeddings, component-synth) and call `languageCortex.generate()` directly with full brain state. Loads all 3 corpora from disk on boot via `fs.readFileSync`. The Pollinations text-chat fetch + prompt assembly were ripped (~60 lines). WebSocket accepts clients only after `_initLanguageSubsystem` resolves. |
| Kill text-AI cognition | AI/ML | Advanced | **DONE 2026-04-13** — R4 (commit `7e095d0`) gutted every text-AI cognition path. `language.js` BrocasArea shrunk 333 → 68 lines (throwing stub only). `ai-providers.js` `chat()`/`_customChat()` deleted + renamed `SensoryAIProviders`. `engine.js` `_handleBuild`/`_handleImage` rewritten equationally. `app.js` BrocasArea references purged, `/think` dumps raw brain state, sandbox `chat()` routes through `processAndRespond`, greeting path calls `languageCortex.generate` directly. |
| Peripheral destroy() contract | Vision/Voice | Intermediate | **DONE 2026-04-13** — R7 (commit `b67aa46`) added `destroy()` to `visual-cortex.js` + `auditory-cortex.js`, matching the unified `init`/`process`/`destroy` contract. Flips `_active = false`, drops analyser/video/canvas/ctx/describer/motor-output buffers to null for GC. MediaStream lifecycle stays owned by `app.js`. |
| Embedding refinement persistence | Backend | Advanced | **DONE 2026-04-13** — R8 (commit `b67aa46`) wired `sharedEmbeddings.serializeRefinements()` / `loadRefinements()` through `persistence.js` save/load round-trip. GloVe base table reloads from CDN each session; the online context-refinement deltas Unity learns from live conversation survive restarts. Load path warn-and-continues on corrupt blob. |
| Sandbox lifecycle discipline | Frontend | Advanced | **DONE** — `js/ui/sandbox.js` has `MAX_ACTIVE_COMPONENTS = 10` with LRU eviction by `createdAt`. Per-component tracking: `timerIds` Set, `windowListeners` array, `createdAt` timestamp. Wrapped `setInterval` / `setTimeout` / `addListener` in `_evaluateJS` so every handle + listener gets cleaned up on `remove(id)`. Auto-replace on duplicate id (no silent warnings). Auto-remove on JS error via `setTimeout(() => remove(id), 0)` to prevent half-initialized state. Errors captured in `_errors` array. localStorage persistence across visits. |
| Orphan resolution audit | Ops | Intermediate | **DONE** — 13-finding audit (U302-U310) archived in `docs/FINALIZED.md` under the "Orphan Resolution" session block; standalone `docs/ORPHANS.md` removed 2026-04-13 after the audit closed. Investigation-first: find WHY it was abandoned, fix root cause if possible, only then delete. Deleted: `js/io/vision.js`, 3 server worker files, `createPopulation` factory, 5 dead DOM elements, 4 orphan CSS classes. Kept (false positives corrected): `gpu-compute.js` (used by compute.html), `env.example.js` (setup modal download), HHNeuron (reference for brain-equations.html). Real bug fixed: `brain-server.js` save/load asymmetry on `_wordFreq`. |
| Server word-frequency accumulator | Backend | Beginner | **DONE** — `server/brain-server.js` `_learnWords(text)` accumulates per-word counts into `this._wordFreq`. `saveWeights` writes to `brain-weights.json`. `_loadWeights` now correctly restores on boot (U306 fixed the previous asymmetry where it was written but never read back). Groundwork for R2 full shared-across-users dictionary. |
| Slash commands in chat | Frontend | Beginner | **DONE** — `/think`, `/think [text]`, `/bench`, `/scale-test` all route through `chatPanel.onSend` in `app.js` before hitting the brain. `/bench` and `/scale-test` dynamic-import `benchmark.js` (zero boot cost). |

---

*Unity AI Lab — every skill unlocks a deeper part of her mind.* 🖤
