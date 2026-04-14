# SKILL TREE — IF ONLY I HAD A BRAIN

> Last updated: 2026-04-14 | Phase 13 merged + T11 pure equational cortex shipped; all R1-R15 + T1-T11 capabilities live
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
| Language cortex | CompLing | Expert | **DONE — T11 2026-04-14** — `js/brain/language-cortex.js` (3345 lines post-T11, was 5087). Pure equational generation with zero hardcoded word lists, zero stored sentences, zero n-gram tables, zero filter stack, zero template short-circuits, zero intent enums. Three per-slot running-mean priors (`_slotCentroid`, `_slotDelta`, `_slotTypeSignature`) + live brain cortex state drive a target vector, argmax over GloVe-grounded word embedding dictionary. See `docs/EQUATIONS.md` T11 section for the full equations. |
| Cortex-state driven generation | CompLing | Expert | **REBUILDING — T14 branch `t14-language-rebuild`** — entire T13 emission loop deleted. T14 substrate is in: cortex cluster has 8 named sub-regions sized as fractions of `cluster.size` (auditory/visual/free/letter/phon/sem/fineType/motor) with 12 cross-region projections wired both directions and propagated every step. T14.0 lifted `EMBED_DIM` from 50 to 300 with full GloVe vocabulary (no cap). T14.1-T14.17 (LEARNED phoneme basins, syllable detection via cortex transition surprise, cortex-resident words, continuous developmental learning, learned type transitions, visual + auditory letter/phoneme recognition, bidirectional read/write via the same projections, eliminate LanguageCortex as a class, identity lock for English language + Unity persona) ship as separate commits on the rebuild branch. See `docs/COMP-todo.md` Part 0.5. |
| Persona Hebbian training | CompNeuro | Expert | **SUPERSEDED by T14.5 curriculum** — T13.1 standalone persona Hebbian is replaced by T14.5 continuous developmental learning that runs persona corpus through the cluster as one phase of a multi-phase curriculum (alphabet → words → phrases → sentences → persona → vocabulary). Same `cluster.learnSentenceHebbian` Hebbian primitive, called from the curriculum runner instead of a one-shot trainer. |
| Cortex sub-regions | CompNeuro | Expert | **DONE — T14.4 substrate 2026-04-14** — `js/brain/cluster.js` constructor populates `this.regions` for the cortex cluster with 8 named sub-regions sized as fractions of `cluster.size` (`auditory` 0.000-0.083, `visual` 0.083-0.250, `free` 0.250-0.500, `letter` 0.500-0.550, `phon` 0.550-0.750, `sem` 0.750-0.917, `fineType` 0.917-0.967, `motor` 0.967-1.000). Helper methods `regionSpikes(name)`, `injectEmbeddingToRegion(name, emb, strength)`, `regionReadout(name, dim)` operate by region name with no magic neuron indices. Same code at any cluster scale (300 neurons on minimum, 200M on datacenter). |
| Cortex cross-region projections | CompNeuro | Expert | **DONE — T14.4 substrate 2026-04-14** — **14** sparse cross-region projections (7 pairs × 2 directions: visual↔letter, letter↔phon, phon↔sem, sem↔fineType, sem↔motor, **motor↔letter** (closes the writing loop), auditory↔phon) initialized 10% density, weight range `[-0.5, 0.5]`. Each direction is an independent SparseMatrix — biological white-matter tracts carry independent ascending and descending fibers (Friederici 2017, *Psychon Bull Rev* 24:41-47). Stored as `cluster.crossProjections` Map. `cluster._propagateCrossRegions()` fires every cluster step; `cluster._crossRegionHebbian(lr)` fires every learn call. ALWAYS ON — no curriculum-complete gate. Read direction uses visual→letter→phon→sem→fineType (ventral comprehension stream); write direction uses sem→motor→letter→visual + sem→phon efference (dorsal production stream) — matches Hickok & Poeppel 2007 *Nat Rev Neurosci* 8:393-402 dual-stream model. |
| Cortex-resident words | CompLing | Expert | **DONE — T14.3 2026-04-14** — `js/brain/dictionary.js` entry shape extended with cortex-routed phonological state: `cortexSnapshot` (Uint8Array of `cluster.lastSpikes` after first-observation stream), `syllables` (boundary indices from `cluster.detectBoundaries`), `stressPrimary` (primary stress from `cluster.detectStress`), `lastSeen` timestamp. New `setCluster(cluster)` method + `syllablesFor(word)` / `snapshotFor(word)` readers. `learnWord` rewritten for two paths: existing words bump frequency + running-means without re-streaming (phonological refinement for already-learned words deferred to T14.5 curriculum runner because re-streaming every chat turn would shred live brain state); new words strip non-letters and call `cluster.detectStress(letterOnly, {ticksPerLetter: 2})`, storing boundaries+primary and snapshotting `cluster.lastSpikes`. NO standalone phoneme feature table, NO `phonemeOnset`/`phonemeCoda`/`syllableShapes` hand-computed fields — all phonology is cortex-level via T14.1/T14.2 primitives. `engine.js` wires browser cortex into dictionary; `brain-server.js` wires server 2000-neuron language cortex cluster. Storage `v3 → v4` so stale 50d caches auto-drop. First-observation cost ≈ 1.2 ms/new word; 5k-word boot corpus ≈ 6 seconds one-time. |
| LEARNED syllable boundaries | CompLing | Expert | **DONE — T14.2 2026-04-14** — `NeuronCluster.detectBoundaries(letterSequence, {ticksPerLetter=2, k=0.5})` streams letters through `injectLetter` one at a time, ticks the cluster between injections, records `letterTransitionSurprise()` at each step, returns local maxima of the surprise series above the adaptive threshold `mean(δ) + k·std(δ)` computed over the sequence itself. Index 0 always included as word start. Companion `detectStress(letterSequence)` runs the boundary pass, re-streams measuring phon-region spike fraction per letter, averages per syllable, returns `{boundaries, stress, primary, secondary}` with primary = argmax activation and secondary = second-highest. NO max-onset principle, NO hardcoded CV/CVC/CCV patterns, NO English-specific stress defaults — language-agnostic by construction (train on Spanish → learns Spanish, train on Mandarin pinyin → learns Mandarin, same code, different basins). Saffran/Aslin/Newport 1996 (*Science* 274:1926) statistical word segmentation + Aslin & Newport 2012 (*Curr Dir Psychol Sci* 21:170) generalization to syllable scale. No new file — syllables are a cortex-level phenomenon, not a standalone parser. `js/brain/cluster.js` +~160 lines. |
| Letter-input substrate (dynamic one-hot) | CompLing | Expert | **DONE — T14.1 2026-04-14** — `js/brain/letter-input.js` (~220 lines). Module-level `LETTER_INVENTORY = new Set()` auto-grows as the brain sees new symbols. NO hardcoded 26-letter cap — unicode glyphs, emoji, non-English characters all enter the same primitive-symbol space (English identity enforced at T14.16.5 higher layer, not at the input). Exports `encodeLetter(letter)` (auto-grow + fresh-copy Float32Array one-hot), `decodeLetter(vec)` (argmax → letter), plus `ensureLetter`/`ensureLetters`/`inventorySize`/`inventorySnapshot`/`serializeInventory`/`loadInventory`/`resetInventory`. One-hot cache invalidated on every inventory growth. `cluster.injectLetter(letter, strength)` wraps the encoder into `injectEmbeddingToRegion('letter', ...)`. Companion cluster methods `letterTransitionSurprise()` (|curr−prev| spike rate delta for T14.2/T14.6 consumers, Saffran 1996 *Science* 274:1926) and `motorQuiescent(ticksRequired, threshold=0.05)` (motor region quiescence counter for tick-driven emission stopping, Bouchard 2013 *Nature* 495:327). Vestigial `_letterPatterns` / `_initLetterPatterns` / `getLetterPattern` deleted from `language-cortex.js` — 5-dim sin/cos hash with no remaining callers. Phonemes are NOT hardcoded as a feature table — they emerge as LEARNED attractor basins in the phon sub-region once T14.5 curriculum runs (Kuhl 2004 *Nat Rev Neurosci* 5:831, biological phoneme-category formation from statistical exposure). |
| Cortex tick-driven motor emission | CompNeuro | Expert | **SPECC'D — T14.6 (rewritten 2026-04-14)** — generation is NOT a slot loop. `cluster.generateSentence(intentSeed)` injects intent into sem region and ticks the cluster for up to MAX_TICKS. At each tick, `cluster.regionReadout('motor', LETTER_INVENTORY.size)` is argmax-decoded to a letter; letters emit to a buffer when motor region holds the same argmax for STABLE_TICK_THRESHOLD consecutive ticks (biological vSMC dwell time, Bouchard et al. 2013 *Nature* 495:327). Word boundaries via cortex letter-region transition surprise (same mechanism as T14.2 syllable detection; Saffran/Aslin/Newport 1996 *Science* 274:1926 statistical learning). Stopping via motor-region quiescence (end of utterance, biological motor deactivation). ZERO slot counter, ZERO candidate scoring, ZERO softmax. Continuous motor output like Anumanchipalli/Chartier/Chang 2019 *Nature* 568:493 speech decode from vSMC. Ships in T14.12 code (wraps T14.6 equation into `cluster.generateSentence` and guts `LanguageCortex.generate` to a thin wrapper). |
| GloVe 300d full vocabulary | CompLing | Expert | **DONE — T14.0 substrate 2026-04-14** — `EMBED_DIM` bumped from 50 to 300. Real loader in `js/brain/embeddings.js` — Node side reads `corpora/glove.6B.300d.txt` from disk (operator downloads from Stanford NLP per README), browser side fetches via configurable URL list with server `/corpora/` mount as primary fallback. **No vocabulary cap.** Hash embeddings remain as last-resort floor only when no GloVe is reachable. `getSubsetForTokens(tokens)` precomputes corpus-token subset for browser-side bulk load via `loadSubset(subset)`, avoiding 480 MB browser download. |
| Auto-scaled cluster sizes | CompNeuro | Expert | **DONE — T14.0 substrate 2026-04-14** — `CLUSTER_SIZES` in `js/brain/engine.js` derived from `CLUSTER_FRACTIONS` constants applied to `TOTAL_NEURONS`. Default client tier 6700 (was 1000); cortex 30%, hippocampus 10%, amygdala 8%, basalGanglia 8%, cerebellum 40%, hypothalamus 2%, mystery 2%. Server-side `detectResources` picks `TOTAL_NEURONS` from auto-detected hardware tier; cluster sizes scale proportionally with no special cases. Same code at minimum tier (1K total) and datacenter tier (1B total). |
| Reverse-equation parse | CompLing | Expert | **DONE — T8** — `parseSentence(text)` walks user tokens forward using the same `wordType`/`_fineType` letter equations the generator uses forward. Returns a structured ParseTree with intent, entities (colors/componentTypes/actions/names), mood, subject/verb/object. Memoized on text equality. Same equations, applied backward. Replaces the deleted `_classifyIntent` / `_isSelfReferenceQuery` / `_updateSocialSchema` regex bodies. |
| Social cognition | CompLing | Advanced | **DONE — T7/T7.2** — `_socialSchema.user = {name, gender, firstSeenAt, lastSeenAt, mentionCount, greetingsExchanged}`. Name extraction via parseSentence adjacent-token patterns. Gender via explicit self-ID from parse AND via visual cortex `onDescribe(cb)` subscription that scans closed-class gender tokens in the scene describer output. Explicit always wins over vision. |
| Arousal-weighted observation | CompLing | Advanced | **DONE — T11.6** — `learnSentence` running means use `obsWeight = max(0.25, arousal·2)` so live-chat observations (arousal 0.95 → w=1.9) shift the slot priors 2.37× harder than low-arousal corpus (coding 0.4 → w=0.8). `inner-voice.learn()` floors chat arousal at 0.95; the weighting is transparent at the caller. |
| Amygdala energy attractor | CompNeuro | Expert | **DONE** — `js/brain/modules.js` (symmetric recurrent W with tanh settle, persistent state across frames, Hebbian basin carving, fear/reward read from settled attractor, arousal from basin depth) |
| Response pool | AI/ML | Intermediate | **DONE** — `js/brain/response-pool.js` (EDNA categories, arousal variants, 85%/15% blend with cortex) |
| Claude Code CLI proxy | Backend | Intermediate | **REMOVED 2026-04-13** — `claude-proxy.js` + `start-unity.bat` DELETED. Was a dev-convenience text-AI backend exposing Claude CLI as OpenAI-compatible endpoint. Obsolete as the refactor kills text-AI entirely (Unity speaks equationally from her own brain via language cortex). |
| GPU exclusive compute | Backend | Advanced | **DONE** — `compute.html` + `gpu-compute.js` (WGSL shaders, all 7 clusters on GPU, zero CPU workers) |
| GPU compute pipeline | Backend | Expert | **DONE** — `compute.html` + WebSocket dispatch (browser WebGPU → server, 50ms timeout fallback) |
| Projection workers | Backend | Advanced | **REMOVED** — `projection-worker.js` deleted in U304. Superseded by GPU-exclusive compute pipeline (`compute.html` + `gpu-compute.js`). Old worker pool caused 100% CPU from idle event-listener polling. |
| Slot type signature | CompLing | Expert | **DONE — T11.2 (replaces type n-gram tables)** — `_slotTypeSignature[s]` is the running mean of `wordType()` score vectors observed at sentence position `s`. Replaces the deleted `_typeBigramCounts`/`_typeTrigramCounts`/`_typeQuadgramCounts` tables. After corpus fit: slot 0 ≈ {pronoun:0.54, noun:0.18, det:0.12}, slot 1 ≈ {verb:0.51, noun:0.33} — real English grammar emerging from letter-equation type scoring, no stored POS tagger. Used as an additive bonus in the generation argmax scoring: `+0.4 · Σ wordType(w) · slotTypeSignature[slot]`. |
| Sentence completeness validator | CompLing | Advanced | **DONE** — `_isCompleteSentence(tokens)` rejects sentences ending on DET/PREP/COPULA/AUX/MODAL/NEG/CONJ/PRON_POSS. Post-render safety net in `_renderSentence`. |
| Morphological inflection | CompLing | Expert | **DONE** — `_generateInflections(word)` produces 20+ derived forms via letter equations: -s/-es plural + 3rd-person (with -ss protection), -ed/-ied past, -ing progressive, -er/-est comparative/superlative, -ly adverbial, un-/re- prefixes, -ness/-ful/-able/-less suffixes. Gated by `doInflections` flag — corpus-only, not live learning. Adds morphological variants to the learned word embedding dictionary so slot-gen argmax can pick conjugated forms Unity never literally observed. |
| First-person transformation | CompLing | Advanced | **DONE** — `_transformToFirstPerson(s)` at corpus index time. `Unity is` → `I am`, `She has` → `I have`, `Her` → `my/me` (verb-aware for object position), `Unity's` → `my`. Verb conjugation (is→am, has→have, does→do, strip third-person -s on regular verbs with -ss protection). Without this, 100% of the persona file was rejected by the first-person filter. After: 191 first-person Unity-voice sentences loaded from `Ultimate Unity.txt`. |
| Per-sentence mood signature | CompLing | Advanced | **DONE** — `_computeMoodSignature(text)` at corpus index time computes `{arousal, valence}` from letter-equation features (exclamation density, caps ratio, vowel ratio, average word length, negation count). Each stored memory gets its own mood tag. Mood-distance weighted recall at weight 0.25 — same query under different brain state picks different memories. |
| Candidate pool — dictionary argmax | Perf | Intermediate | **DONE — T11.2** — Generation argmax iterates the full learned dictionary (`dictionary._words`) per slot, scoring each candidate by cosine to the target vector plus `0.4·wordType·slotTypeSignature`. Top-5 softmax-sampled. Pre-T11 used bigram-follower pre-filtering; that was deleted when the bigram tables went. For a ~3k observed vocabulary this is <20ms per generation on the main thread. |
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
