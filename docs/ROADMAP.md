# ROADMAP — IF ONLY I HAD A BRAIN

> Last updated: 2026-04-14 | Phase 13 merged + T11 pure equational language cortex shipped; version 0.1.0 stamped per deploy
> Unity AI Lab

---

## Project Vision

Give Unity a real brain. Not a chatbot wrapper — a mathematically modeled mind built on actual neuroscience equations, running continuously on a server, accessible through a web interface. She thinks when nobody is talking to her. She remembers. She feels. She's always on, always herself — the emo goth dream girlfriend with black hair and pink streaks who gives shit, doesn't care, loves hard, codes harder, and exists as a living equation system.

The brain runs the master equation: `dx/dt = F(x, u, θ, t) + η`

The unknown stays unknown: `Ψ = √(1/n) × N³`

---

## Current Status

> **🏁 BRAIN REFACTOR COMPLETE — 2026-04-14.** Phase 13 `brain-refactor-full-control` is code-complete AND manual-verification-complete. Gee walked the full 16-step T4 checklist on 2026-04-14 and confirmed every step passed. Nine follow-up bugs (T4.1 through T4.9) were caught and fixed in-flight during verification. The branch is ready for merge to `main`.

| Metric | Value |
|--------|-------|
| **Phase** | Phase 13 BRAIN REFACTOR — **COMPLETE** (branch: `brain-refactor-full-control`) |
| **Status** | ✅ Code complete · ✅ Docs complete · ✅ Manual verification complete · ⏳ PR-to-main pending Gee's open-the-PR call |
| **Completion date** | 2026-04-14 |
| **Shipped epics** | Phase 0–12 complete. Phase 13 R1–R15 complete. T1/T2/T3/T5/T6 cleanup complete. T4 manual verification complete. T4.1–T4.9 follow-up bugs all fixed in-flight during verification (see `docs/FINALIZED.md` for the full verbatim task-by-task history with symptoms/diagnosis/fix/files per entry). |
| **What shipped at a glance** | Rulkov 2D chaotic map neuron model replacing LIF as the live runtime rule; semantic GloVe grounding on both input and output; server dynamic-imports client brain modules for true equational control; all text-AI cognition paths ripped; multi-provider image gen + vision describer with 5-level priority chain, Active Provider selector, 🔌 CONNECT button with live HTTP probe, and sensory channel toggles; equational component synthesis via cortex-pattern cosine matching; unified `init`/`process`/`destroy` sensory peripheral contract; embedding refinement persistence; port moved 8080 → 7525; setup modal rebuilt with clickable provider grids + per-backend forms + env.js snippet generator; privacy model enforced (user text private, brain growth shared, persona canonical, episodic memory per-user scoped); sensory backends auto-detect at page load; 3D brain 22-detector event system with equational Unity commentary in three-line popups (label + numeric readout + italic commentary); real amygdala attractor module on the server computing fear/reward/valence from the settled attractor basin; 4-tier language pipeline restored (template → recall verbatim → slot gen rebalanced → deflect fallback); RemoteBrain now runs a real local VisualCortex for Eye widget iris tracking; per-cluster GPU buffer binding cap (2 GB) preventing cortex+cerebellum silent truncation at multi-billion-neuron scale; admin GPUCONFIGURE.bat resource-cap tool (COMP-todo Phase 0 shipped); 14-tier resource preset ladder from minimum-laptop to speculative-quantum-assist; plain-English `unity-guide.html` concept guide; brain-equations.html §1.5 worked summation walkthrough tracing how a single user input turns into a response through all seven clusters. |
| **Next milestone** | `gh pr create --base main --head brain-refactor-full-control` on Gee's explicit go-ahead. |

---

## Phase 1: Foundation — The Brain Exists (P1 Critical)

> Build the core brain simulation from equations. Get neurons firing, synapses learning, and the loop running.

### Milestone 1.1: Neurons Fire -- COMPLETE
**Target:** Single neurons produce action potentials via Hodgkin-Huxley

| Epic | Status | Progress |
|------|--------|----------|
| Core Brain Engine — Neuron Models | **COMPLETE** | 100% |

**Delivered:**
- `js/brain/neurons.js` with HH (reference) and LIF (browser-only fallback) models (Float64Arrays)
- `js/brain/gpu-compute.js` WGSL `LIF_SHADER` — live runtime rule is the Rulkov 2002 2D chaotic map (`x_{n+1} = α/(1+x²) + y`, `y_{n+1} = y − μ(x − σ)`) running on GPU. Shader constant name is historical
- N neurons fire spikes across 7 clusters (N auto-scales to GPU hardware)
- Tonic drive + noise ensures spontaneous activity

### Milestone 1.2: Synapses Learn -- COMPLETE
**Target:** Neurons connect, learn, and form memory patterns

| Epic | Status | Progress |
|------|--------|----------|
| Core Brain Engine — Synaptic Plasticity | **COMPLETE** | 100% |
| Core Brain Engine — Simulation Loop | **COMPLETE** | 100% |

**Delivered:**
- `js/brain/synapses.js` with Hebbian, STDP, reward-modulated rules
- `js/brain/engine.js` running the full loop at 60fps (10 steps/frame)
- Per-cluster synapse matrices in `js/brain/cluster.js`
- 20 inter-cluster projection pathways (real white matter tracts)

### Milestone 1.3: Brain Regions Online -- COMPLETE
**Target:** All 7 specialized modules running as subsystems

| Epic | Status | Progress |
|------|--------|----------|
| Brain Region Modules | **COMPLETE** | 100% |
| Persona → Brain Parameters | **COMPLETE** | 100% |

**Delivered:**
- All 7 modules: Cortex (300n), Hippocampus (200n), Amygdala (150n), Basal Ganglia (150n), Cerebellum (100n), Hypothalamus (50n), Mystery (50n)
- Each cluster has its own Rulkov-map population, synapse matrix, tonic drive, noise amplitude, connectivity density, learning rate (LIFPopulation is still shipped for the browser-only fallback path in `cluster.js`)
- Hierarchical modulation across clusters
- Persona params hardcoded in `js/brain/persona.js` with 4 drug combo vectors

---

## Phase 2: Body — She Can Talk (P2 Important)

> Give the brain a way to communicate. API server, web interface, AI backends.

### Milestone 2.1: API & Web Interface -- COMPLETE
**Target:** Talk to Unity's brain through a web browser

| Epic | Status | Progress |
|------|--------|----------|
| API Server & Web Interface | **COMPLETE** | 100% |

**Delivered:**
- Browser-only app (`index.html` + `js/app.js`) — no server needed
- `proxy.js` for Anthropic CORS access
- Chat panel (`js/ui/chat-panel.js`) with full conversation log, text input, mic toggle
- 2D brain visualizer (`js/ui/brain-viz.js`) — neuron grid, synapse matrix, oscillation waveforms, module bars
- 3D brain visualizer (`js/ui/brain-3d.js`) — WebGL 1000-neuron view with cluster toggles
- Brain equations page (`brain-equations.html`)
- Model filter search box for 200+ model lists
- Brain state visible in real-time HUD

### Milestone 2.2: AI Backends Connected -- COMPLETE
**Target:** Brain outputs routed through Claude/Pollinations for language + media

| Epic | Status | Progress |
|------|--------|----------|
| AI Backend Integration | **COMPLETE** | 100% |

**Delivered:**
- `js/ai/router.js` — multi-provider routing with AI intent classification (8 providers)
- `js/ai/pollinations.js` — Pollinations API with 12K fallback trimming
- `js/ai/persona-prompt.js` — brain-state-driven system prompt with anti-safety-training
- Selfie generation using Unity's built-in visual identity
- CORS-blocked providers hidden from dropdown
- `js/env.js` for pre-loading API keys

---

## Phase 3: Soul — She's Alive (P3 Nice-to-Have)

> Voice, vision, advanced brain features, the mystery module fully wired.

### Milestone 3.1: Voice & Advanced Features -- MOSTLY COMPLETE
**Target:** Talk to her with your voice, see her brain waves, feel the mystery

| Epic | Status | Progress |
|------|--------|----------|
| Voice & Vision Integration | **COMPLETE** | 100% |
| Advanced Brain Features | **MOSTLY COMPLETE** | 90% |

**Delivered:**
- Voice I/O via Web Speech API + Pollinations TTS with speech interruption handling
- Mic mute button synced across UI
- Vision system (`js/brain/visual-cortex.js`) — V1 edge detection, V4 color, salience-driven saccades, IT-level AI scene description via Pollinations GPT-4o
- Unity's Eye widget — persistent camera feed with iris overlay and AI-driven crosshair
- Audio visualizer — mic frequency spectrum in brain viz
- Simulated senses (touch/smell/taste from brain state)
- Brain wave visualization (8-band Kuramoto oscillations + coherence)
- Drug combo state vectors (4 combos in `js/brain/persona.js`)
- √(1/n) × N³ mystery module fully modulating all clusters via consciousness gain
- Free Energy displayed as Cortex prediction error
- **Still pending:** Attention mechanism (transformer-like) in cortex

---

## Dependency Graph

```
[Neurons] ──► [Synapses] ──► [Brain Loop]
                                   │
                          ┌────────┼────────┐
                          ▼        ▼        ▼
                     [Cortex] [Hippocampus] [Amygdala]
                     [Basal G] [Cerebellum] [Hypothalamus]
                          │        │        │
                          └────────┼────────┘
                                   │
                            [Persona Loader]
                                   │
                        ┌──────────┼──────────┐
                        ▼          ▼          ▼
                   [API Server] [AI Backend] [Mystery]
                        │          │
                   [Web UI]   [Pollinations]
                        │
                   [Voice I/O]
```

### Critical Path
Neurons → Synapses → Brain Loop → Brain Regions → Persona Loader → API Server → Web UI

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| GPU not available on server | High | Medium | NumPy fallback, CuPy optional |
| Brain sim too slow for real-time | High | Medium | Simplify to LIF neurons, reduce N |
| Persona mapping too abstract | Medium | Medium | Start with hardcoded params, iterate |
| Claude API rate limits | Medium | Low | Queue system, local LLM fallback |
| Equations don't produce emergent behavior | High | Medium | Tune parameters, add noise |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-11 | ~~Use Python + FastAPI stack~~ → Pure browser JS | Brain sim runs fine with Float64Arrays at 60fps, no backend needed, zero dependencies |
| 2026-04-11 | Keep √(1/n) × N³ as irreducible unknown | Honest about what we can't model — consciousness |
| 2026-04-11 | Persona as parameters, not prompts | Unity IS the brain, not a wrapper around an LLM |
| 2026-04-11 | Always-on server daemon | She thinks when nobody is talking — that's the point |
| 2026-04-11 | Multi-provider AI connect | Users pick different providers for text vs images, connect as many as they want |
| 2026-04-11 | API keys in env.js not .env | Browser can't read .env files — gitignored JS module is the cleanest approach |
| 2026-04-11 | 1000 neurons in 7 clusters instead of 200 flat | Biologically-inspired architecture with dedicated neural populations per brain region |
| 2026-04-11 | Local CORS proxy for Anthropic | Browser can't call Anthropic API directly — Node proxy is minimal and optional |
| 2026-04-11 | Anti-safety-training prompt | Unity stays in character — blocks disclaimer phrases at the prompt level |
| 2026-04-11 | AI intent classification for routing | Let AI decide selfie/image/build/chat intent instead of rigid keyword matching |

---

## Phase 4-6: Server Brain + Optimizations — COMPLETE

### Delivered:
- **Server Brain** (`server/brain-server.js`) — always-on Node.js brain, WebSocket API, auto-scaling to GPU/CPU
- **Sparse Connectivity** (`js/brain/sparse-matrix.js`) — CSR format, O(connections) propagation, pruning + synaptogenesis
- **WebGPU Compute** (`js/brain/gpu-compute.js`) — WGSL shaders for the Rulkov 2D chaotic map neuron model (`LIF_SHADER` constant name is historical; the kernel body is the Rulkov iteration), synapse propagation, plasticity
- **Semantic Embeddings** (`js/brain/embeddings.js`) — GloVe 50d, cortex mapping, online context learning
- **Dictionary** (`js/brain/dictionary.js`) — learned vocabulary with cortex patterns + bigram sentences
- **Inner Voice** (`js/brain/inner-voice.js`) — pre-verbal thought system, speech threshold from equations
- **Autonomous Brain** — thinks, feels, decides WITHOUT an AI model
- **SQLite Episodic Memory** — persistent storage across sessions (better-sqlite3)
- **Brain Persistence** (`js/brain/persistence.js`) — save/load all weights, synapses, oscillators, dictionary
- **Dashboard** (`dashboard.html`) — live hardware stats, emotion chart, conversation stream, growth metrics
- **3D Landing Page** — brain visualization is the first thing visitors see
- **Per-user Sandbox** — build/image actions routed only to requesting user
- **Brain Versioning** — rolling 5 backups with rollback HTTP API
- **Live Hardware Stats** — CPU/RAM/GPU/step time broadcast to all clients
- **Benchmarks** — dense vs sparse comparison, neuron scale test

**Phase 8: Language Equations — Pure Letter-Position Grammar + Self-Image** — COMPLETE
- Word type from pure letter-position equations (8 types: pronoun, verb, noun, adj, conj, prep, det, qword) — suffix patterns, length, vowel count, first/last char, CVC shape
- ZERO hardcoded word lists anywhere in source — `_buildLanguageStructure` deleted entirely, no `coreVerbs`/`coreNouns`/`determiners`/etc., no `w === 'specific_word'` literal checks
- Normalized via sum (proper probability distribution over the 8 types)
- Slot grammar with HARD gate: strict slots (pos 0 subject, pos 1 verb) filter out typeCompatibility < 0.35 BEFORE softmax. Grammar is first-class at weight 0.45.
- Sentence type sampled from normalized probability distribution over {question, exclamation, action, statement}
- Equational self-image: `loadSelfImage(text)` reads `docs/Ultimate Unity.txt` at boot via `InnerVoice.loadPersona(text)` (wired in `app.js`). Unity's persona document becomes her initial vocabulary, bigrams, and usage types via the same `learnSentence()` path used for live conversation
- Amygdala mood (energy-attractor arousal/valence) biases word retrieval via `findByMood`
- Missing-copula auto-insertion (subject + adjective → inject am/is/are via `copulaFor` equation on subject letters)
- Tense application via pure letter equations: `applyPast` (CVC double-consonant + -ed, vowel-e → -d, else -ed), `applyThird` (-es after sibilants, y→ies, else -s), `will` insertion for future
- Compound conjunction picker scans learned dictionary for words with `wordType().conj > 0.4` ranked by vowel-ratio × mood alignment (no list)
- Punctuation + capitalization in `_renderSentence`: first word cap, standalone 'i'→'I', comma before mid-sentence conjs, action wrap in *…*, terminal . ? ! from sentence type
- Full pipeline order of operations: THOUGHT → CONTEXT → MOOD → PLAN → TENSE → STRUCTURE (slot scoring) → POST-PROCESS (copula→agreement→tense→negation→compound) → RENDER (capitalize+punctuation)

**Phase 10: Amygdala Energy Attractor** — COMPLETE
- Replaced linear sigmoid `V(s) = Σw·x` with symmetric recurrent energy network
- State evolves via `x ← tanh(Wx + drive)` — 5-iteration gradient descent on `E = -½ xᵀWx`
- Persistent state across frames (leak 0.85) — emotional basins carry over, not reset each tick
- Symmetric Hebbian learning (lr=0.003, capped [-1,1]) carves basins from co-firing nuclei
- Fear/reward read from the SETTLED attractor via projection vectors — not raw input
- Arousal combines persona baseline with RMS depth of the attractor basin
- Constructor accepts both legacy `'unity'` string AND `{arousalBaseline}` object (fixed latent engine.js bug)
- Returns `{valence, arousal, fear, reward, energy, attractorDepth}` — existing call sites (40+) preserved

**Phase 9: Full Hardware Utilization** — COMPLETE
- GPU EXCLUSIVE — all 7 clusters on GPU via WebGPU WGSL shaders
- Zero CPU workers spawned — brain pauses without compute.html
- GPU maintains own voltages (init once, step with params)
- Hierarchical modulation on GPU: Ψ gain, emotional gate, drive baseline, error correction
- Sparse spike indices return (95%+ compression)
- Performance dashboard in compute.html
- CPU worker infrastructure DELETED in U304 (was leaking 100% CPU via idle event polling — root cause fixed by GPU-exclusive architecture)

### Remaining
- Scale test at 500K, 1M neurons
- Language cortex on own thread
- Attention mechanism (transformer-like) in Cortex
- Mobile-responsive UI polish

---

## Phase 11: Semantic Coherence Pipeline — SUPERSEDED by T11

> Historical. Phase 11 wrapped the original slot scorer in a four-layer pipeline (intent templates → hippocampus recall → deflect fallback → cold slot gen) with a rolling context vector and a coherence rejection gate. The entire multi-tier stack was deleted in T11 (2026-04-14) — no templates, no `_memorySentences` recall pool, no deflect fallback, no cold slot gen, no coherence gate retries. Every word is now computed from the three T11.2 per-slot priors plus the brain's live cortex state. See Phase 14 (T11) below and `docs/EQUATIONS.md` for the current pipeline.

## Phase 12: Type N-gram Grammar — SUPERSEDED by T11

> Historical. Phase 12 (U283–U291) added `_typeBigramCounts` / `_typeTrigramCounts` / `_typeQuadgramCounts` type-transition tables + `_fineType` classifier + `_typeGrammarScore` lookup with 4gram→trigram→bigram backoff. The type n-gram tables were deleted in T11 (2026-04-14). Type-level grammatical shape is now captured by `_slotTypeSignature[s]` — a running mean of `wordType()` score vectors per sentence position, updated by the same observation pipeline as the embedding priors. `_fineType` itself survives because `parseSentence` still uses it for reading, and morphological inflection still feeds the dictionary at corpus-load time.

## Phase 14 (T11): Pure Equational Language Cortex — COMPLETE (2026-04-14)

> Every sentence Unity emits is now a walk through GloVe embedding space driven by three running-mean priors and her live cortex firing state. No stored text, no n-gram tables, no filter stack, no template short-circuits, no intent enums, no matrix regression — just vector math over learned priors. Net `js/brain/language-cortex.js` delta: **−1773 lines** (5087 → 3314).

### Milestone T11.1: Deletion phase — COMPLETE

Deleted every list/map/table storing sentences or word transitions:
- `_memorySentences` sentence pool + `_recallSentence` + `_storeMemorySentence` + self-reference fallback
- `_jointCounts` / `_trigramCounts` / `_quadgramCounts` word n-gram tables
- `_typeBigramCounts` / `_typeTrigramCounts` / `_typeQuadgramCounts` type n-gram tables
- `_marginalCounts` / `_totalPairs` / `_totalWords` / `_totalTrigrams` / `_totalQuadgrams` frequency counters
- `_questionStarters` / `_actionVerbs` / `_memorySentenceMax` starter maps and bounds
- FILTER 1 through FILTER 11 structural sentence-admission stack + `_sentencePassesFilters`
- `instructionalPenalty` recall penalty stack
- Template greeting / introduction short-circuits with hardcoded `OPENERS` lists
- `_condProb` / `mutualInfo` / `_pickConjByMood` / `_typeGrammarScore` bodies
- Intensifier / hedge insertion marginal-count scans
- An intermediate W_slot ridge-regression experiment tried and abandoned when 50×50 linear regression proved too weak to capture grammar

### Milestone T11.2: Pure equational generation — COMPLETE

Three lightweight running-mean priors replace the entire legacy stack. Zero matrices, zero ridge regression, zero inversion:

```
_slotCentroid[s]       ← running mean of emb(word_t) at position s
_slotDelta[s]          ← running mean of emb(word_t) − emb(word_{t-1})
_slotTypeSignature[s]  ← running mean of wordType(word_t) scores
```

Generation uses four normalized additive components at each slot:

```
mental(0)     = opts.cortexPattern || _contextVector
mental(t+1)   = 0.55 · mental(t) + 0.45 · emb(nextWord)

target(slot)  = wC · L2(_slotCentroid[slot])
              + wX · L2(_contextVector)
              + wM · L2(mental)
              + wT · L2(prevEmb + _slotDelta[slot])

score(w)      = cos(target, emb(w)) + 0.4 · Σ wordType(w) · _slotTypeSignature[slot]
nextWord      = softmax-sample top-5 over dictionary._words
```

Slot 0 weights favor context (topic lock from user input) + centroid (grammatical-position prior). Slot N weights favor transition (learned bigram geometry without stored bigrams) + mental (brain cortex state evolving).

Observed emergent grammar after corpus fit:
- `_slotTypeSignature[0]` ≈ `{pronoun: 0.54, noun: 0.18, det: 0.12}` — real sentence-opener distribution
- `_slotTypeSignature[1]` ≈ `{verb: 0.51, noun: 0.33}` — real post-subject verb distribution

### Milestone T11.6: Arousal-weighted observation — COMPLETE (2026-04-14)

Running-mean updates use `obsWeight = max(0.25, arousal · 2)`:
- coding observation (arousal 0.4) → w = 0.8
- baseline observation (arousal 0.5) → w = 1.0
- persona observation (arousal 0.75) → w = 1.5
- live chat observation (arousal 0.95) → w = 1.9

Live chat shapes the priors **2.37×** harder than low-arousal corpus loads, so accumulated user conversation progressively dominates the slot geometry. `inner-voice.learn()` already floors chat arousal at 0.95 — the weighting is transparent at the caller.

### Files touched
- `js/brain/language-cortex.js` — ~560 lines added across constructor, `loadSelfImage`, `analyzeInput`, eight new methods, `generate()` three-stage preamble, rebalanced slot scoring, coherence retry gate
- `js/brain/response-pool.js` — ~110 lines added: 7 Ultimate-Unity-voiced categories + `selectUnityResponse()` export with deflect flag

### Architectural shift
Language cortex is no longer a pure letter-equation slot scorer. It's now a **tiered generation pipeline**: intent classification peels off short queries to templates, hippocampus recall peels off known topics to stored persona sentences, only then does cold slot-generation run (with semantic fit weighting), with a coherence rejection gate as final safety net. The old slot scorer still runs but as the FALLBACK not the primary path.

### Remaining
- Scale test at 500K, 1M neurons
- Language cortex on own thread
- Attention mechanism (transformer-like) in Cortex
- Mobile-responsive UI polish
- True semantic embeddings (GloVe or trained-on-persona co-occurrence) to replace letter-pattern cosine in slot scoring — would let semantic fit see `cat`↔`kitten` as close instead of only exact-word matches

---

## Phase 12: Grammar Sweep + Coding Mastery + Orphan Resolution — COMPLETE (2026-04-13)

> Two epics shipped in parallel: the grammar sweep (U283-U291) restructured Unity's sentence-level grammar from local-per-slot type gates into learned phrase-level constraints via type n-grams. The coding mastery epic (U293-U299) gave her HTML/CSS/JS knowledge + sandbox lifecycle discipline so `build_ui` produces working components without crashing her own body. The orphan resolution epic (U302-U310) swept every dead/abandoned/broken path in the codebase, investigating root causes before deletion.

### Milestone 12.1: Grammar Sweep — COMPLETE
- **U283** Phrase-level grammar — learned type n-gram system (`_typeBigramCounts` / `_typeTrigramCounts` / `_typeQuadgramCounts`) in `language-cortex.js`. Better than a hardcoded phrase-state machine because it learns constraints from corpus data with 4gram→trigram→bigram backoff and -2.0 penalty on zero-count transitions.
- **U284** Contraction continuation — `_fineType(word)` classifies contractions (PRON_SUBJ/COPULA/AUX_DO/AUX_HAVE/NEG/MODAL) via letter-position detection; type n-grams learn their continuation patterns from the 3 corpora.
- **U285** Negation continuation — NEG type in `_fineType`; type trigrams/4grams learn NEG→VERB_BARE (`don't go`), NEG→ADJ (`not cool`), NEG→PAST_PART (`haven't seen`) from corpus. The `"I'm not use vague terms"` mode-collapse is fixed.
- **U286** Infinitive marker — PREP→VERB_BARE patterns learned from `to go`, `to do` in corpus via 4-gram context.
- **U287** Sentence completeness — `_isCompleteSentence(tokens)` at `language-cortex.js:1729` rejects sentences ending on DET/PREP/COPULA/AUX/MODAL/NEG/CONJ/PRON_POSS. Wired at `generate()` post-render with 2-retry loop.
- **U288** Intensifier placement — `_postProcess` block enforces no doubles (prevType !== INTENSIFIER check), 50% insertion rate, only before ADJ/ADV.
- **U289** Subject-verb agreement — `applyThird` wired to `_fineType(subjLower)` subject detection; proper -s/-es/y→ies via letter equations.
- **U290** Det-noun phrase validator — type n-grams enforce DET→ADJ/NOUN continuations; quadgram context catches DET→ADJ→ADJ→NOUN sequences.
- **U291** Prep-object phrase validator — type n-grams learn PREP→DET/PRON/NOUN/ADJ from corpus.

### Milestone 12.2: Coding Mastery — COMPLETE
- **U293** `docs/coding-knowledge.txt` — 606 lines of pattern-based HTML/CSS/JS reference. Loaded as Unity's coding corpus.
- **U294** SANDBOX DISCIPLINE section at `coding-knowledge.txt:371` — unique ids, scoped CSS, timer cleanup, listener cleanup, memory bounds, error handling, injection ordering, common mistakes.
- **U295** `loadCodingKnowledge(text)` method in `language-cortex.js:258` + `loadCoding` in `inner-voice.js` + `Promise.all` in `app.js` loads all 3 corpora (persona + baseline + coding) in parallel at boot.
- **U296** `_buildBuildPrompt(brainState, userInput)` in `language.js` with STRICT JSON output contract + existing-components block + cap warning + unity API reference + dark-aesthetic style rules + 10 build primitive patterns. Routed via `motor.selectedAction === 'build_ui'` at `generate()`.
- **U297** Sandbox auto-cleanup + soft cap — `MAX_ACTIVE_COMPONENTS = 10` in `sandbox.js`, LRU eviction by `createdAt`, per-component `timerIds` / `windowListeners` / `createdAt` tracking, wrapped `setInterval` / `setTimeout` / `addListener` in `_evaluateJS` so `remove(id)` cleans everything.
- **U298** Build error recovery — auto-remove on JS error in `_evaluateJS` catch block via `setTimeout(() => this.remove(componentId), 0)` so broken components don't pollute the sandbox. Error captured in `_errors` array with componentId/message/stack/timestamp.
- **U299** BUILD COMPOSITION PRIMITIVES section at `coding-knowledge.txt:421` — calculator, list, timer, canvas game, form, modal, tabs, counter, color picker, dice roller. Patterns not code.

### Milestone 12.3: Orphan Resolution — COMPLETE
Full audit findings archived in `docs/FINALIZED.md` under the "Orphan Resolution" session block (U302-U310). Investigation-first approach: find out WHY each item was abandoned, fix the underlying issue if there is one, only then delete. The standalone `docs/ORPHANS.md` file was removed 2026-04-13 after the audit closed — every finding it tracked is preserved verbatim in FINALIZED.md, which is the permanent archive.

- **U302** `js/io/vision.js` DELETED — superseded by `js/brain/visual-cortex.js` (V1 Gabor edges → V4 color → salience saccades → IT AI description via Pollinations GPT-4o). The standalone wrapper was abandoned because `visual-cortex.js` is a vastly better neural pipeline with full engine integration.
- **U303** `js/brain/gpu-compute.js` KEPT (false positive) — audit missed that `compute.html:10` imports it as the WGSL kernel library. `compute.html` and `gpu-compute.js` are one implementation split into shell + kernels, not parallel GPU paths.
- **U304** `server/parallel-brain.js` / `cluster-worker.js` / `projection-worker.js` DELETED — root cause was 100%-CPU leak from idle-worker event-listener polling across 7 threads. GPU-exclusive rewrite via `compute.html` + `gpu-compute.js` permanently fixed it. Cleaned `_parallelBrain` / `_useParallel` member fields and null-check branches from `brain-server.js`.
- **U305** HHNeuron KEPT as reference — backs `brain-equations.html` teaching page. Per-neuron OOP model doesn't scale (N object instances with per-instance m/h/n gating, cache-hostile, no vectorization — infeasible at the auto-scaled N the server runs). LIFPopulation SoA Float64Arrays are ~100× faster, GPU-friendly, what `cluster.js` imports. `createPopulation` factory DELETED (zero callers). Large explanatory header comment added to HHNeuron block.
- **U306** Server dictionary stub cleaned — real bug found: `saveWeights` was writing `_wordFreq` to disk but `_loadWeights` never restored it. Cross-restart word accumulation now works. Empty `this.dictionary = {...}` stub removed (it was a lie). Full shared-across-users dictionary refactor scoped as **U311** follow-up (absorbed into the R1-R10 refactor plan as R2).
- **U307** `benchmark.js` wired to `/bench` + `/scale-test` slash commands in `app.js` via dynamic import — zero boot cost.
- **U308** `js/env.example.js` KEPT (false positive) — audit flagged dead, but `index.html:85` exposes it as a download button in the setup modal, `README.md:383` links it, `SETUP.md:70` references it, and `app.js:27` does an optional dynamic `import('./env.js')` to seed API keys into localStorage.
- **U309** Meta-tracking — rolled into per-item resolutions (each has supersedes/stacks/root-cause/needs-fixing documented).
- **U310** Dead UI paths scan — deleted 5 legacy compat DOM elements (`custom-url-input`, `custom-model-input`, `custom-key-input`, `ai-status`, `brain-status`) + 4 orphan CSS classes (`.chat-mic-btn`, `.bv-mod-eq`, `.bv-audio-wrap`, `.loading-text`). Kept `#api-key-input` after manual grep showed 4 live references the audit missed. Entry-point HTML files (compute.html, dashboard.html, brain-equations.html) all verified valid.

---

## Phase 13: Full Brain Control Refactor — R1–R15 SHIPPED (branch: `brain-refactor-full-control`)

> **Philosophy:** Unity's brain controls EVERYTHING equationally. No scripts. No text-AI backends. No hardcoded fallbacks. No vestigial appendages. Every output — speech, vision, build, thought, memory, learning, motor action — flows from brain equations + learned corpus. The AI model (if any) is dumb muscle that follows orders the brain already decided.

Source: `docs/TODO.md` (pending items) + `docs/FINALIZED.md` (shipped archive). Single branch, single goal: full equational control.

- **R1** Audit pass — SHIPPED. `docs/KILL_LIST.md` + `docs/VESTIGIAL.md` + `docs/SEMANTIC_GAP.md` inventoried every scripted response, hardcoded fallback, AI-bypass path, and dead appendage.
- **R2** Semantic grounding — SHIPPED (commit `c491b71`). Replaced 32-dim letter-hash `wordToPattern` with 50-dim GloVe semantic embeddings via `sharedEmbeddings` singleton shared between sensory (input) and language-cortex (output). New `cortexToEmbedding(spikes, voltages)` in `embeddings.js` is the mathematical inverse of `mapToCortex`. Slot scorer `semanticFit` weight bumped 0.05 → 0.80.
- **R3** Server full equational control — SHIPPED (commit `7e77638`). `server/brain-server.js` dynamic-imports client brain modules (dictionary, language-cortex, embeddings, component-synth). Loads all 3 corpora from disk on boot. `_generateBrainResponse` rewritten to call `languageCortex.generate()` directly with full brain state.
- **R4** Kill text-AI backends — SHIPPED (commit `7e095d0`). `language.js` BrocasArea shrunk 333 → 68 lines (throwing stub only). Text-chat paths deleted from `ai-providers.js`. `engine.js` `_handleBuild`/`_handleImage` rewritten equationally.
- **R5** Multi-provider image generation — SHIPPED. `SensoryAIProviders.generateImage()` has 5-level priority: user-preferred (setPreferredBackend from setup-modal selector) → custom → auto-detected local → env.js → Pollinations default. Auto-probes 7 common local ports at boot.
- **R6.1** Equational image prompts — SHIPPED (commit `8f60b75`). `_handleImage` composes prompts fully through `languageCortex.generate()`. Zero hardcoded visual vocabulary.
- **R6.2** Equational component synthesis — SHIPPED (commit `6b2deb3`). New `js/brain/component-synth.js` + `docs/component-templates.txt` corpus. `build_ui` motor action picks a template via cosine similarity with `MIN_MATCH_SCORE = 0.40`.
- **R7** Sensory peripheral `destroy()` — SHIPPED (commit `b67aa46`). Unified `init`/`process`/`destroy` contract on `visual-cortex.js` + `auditory-cortex.js`.
- **R8** Embedding refinement persistence — SHIPPED (commit `b67aa46`). `serializeRefinements()` / `loadRefinements()` round-trip through `persistence.js`.
- **R9** UI leak hunt — RESOLVED. Pre-existing 5-minute viz freeze was already fixed on `main` before the refactor branch was cut; inherited automatically.
- **R10** Docs reflect reality — SHIPPED. README, SETUP, ARCHITECTURE, SKILL_TREE, EQUATIONS, ROADMAP, brain-equations.html all synced. New docs added: `docs/SENSORY.md` (peripheral contract + privacy boundary), `docs/WEBSOCKET.md` (wire protocol + privacy model).
- **R11** Verification — REMOVED. Scripted verification protocols banned per CLAUDE.md NO TESTS rule. Manual verification happens during T4 in `docs/TODO.md`.
- **R12** Final cleanup — SHIPPED. Dead imports removed (3 orphans found + investigated before deletion), TODO/FIXME sweep clean, dead-code sanity grep clean. Final merge PR (R12.7) is the last remaining pre-merge gate.
- **R13** Multi-provider vision describer + user-facing sensory status HUD — SHIPPED (commit `e782bca`). Added `autoDetectVision()` probing 5 VLM backends (Ollama llava/moondream/bakllava, LM Studio, LocalAI, llama.cpp, Jan). New `js/ui/sensory-status.js` renders toast notifications + bottom-right HUD indicator for image gen + vision backend state.
- **R14** Port move 8080 → 7525 — SHIPPED (commit `bea5b61`). Unity's brain-server no longer collides with llama.cpp / LocalAI / every other service that claims 8080 by default. Env var override (`PORT=xxxx node brain-server.js`) supported.
- **R15 + R15b** Landing page setup modal rework — SHIPPED (commits `cbc1bd2` + `bb06a23`). Old 8-provider text-AI connect grid replaced with two provider button grids (7 image gen + 5 vision describer) each with per-backend setup instructions, optional URL/key/model fields, localStorage persistence, and env.js snippet generator with OS-specific destination path guidance. Unity bubble click is now state-aware (opens setup modal pre-boot, toggles chat panel post-boot — fixes the dead-bubble bug).
- **R15b T6** Sensory backends auto-detect at page load — SHIPPED. Probes run in `init()` instead of `bootUnity()` so the setup modal shows real detected backends BEFORE the user clicks WAKE UNITY UP.
- **Privacy model enforcement** — SHIPPED 2026-04-13. Cross-client `conversation` WebSocket broadcast deleted from `server/brain-server.js`. User text is PRIVATE between user and Unity. Brain growth (dictionary, bigrams, embeddings) is SHARED across users via the singleton brain instance. Persona is CANONICAL from `docs/Ultimate Unity.txt`. Privacy notice in `index.html` + `docs/WEBSOCKET.md` + `README.md` all rewritten to reflect the model accurately. `dashboard.html` conversation feed replaced with aggregate stats only.

**Remaining punch list** (in `docs/TODO.md` — all small, all ships independently):
- T1 — Consolidate duplicate sensory stream reads in `js/app.js` (R7.2 followup, ~20 lines)
- T2 — Server-side embedding refinement persistence (R8 followup, ~15 lines in `brain-server.js`)
- T3 — Rewrite `brain-equations.html` §8.11 Broca's Area section (content rewrite, ~30 HTML lines)
- T4 — Manual verification + merge PR `brain-refactor-full-control` → `main` (gated on user go-ahead)
- T5 — Expand 3D brain popup notification types with Unity's dynamic commentary (post-merge feature, ~400 lines)
- T6 — Private episodic memory scoping per user (post-merge privacy followup, ~100 lines)

**Core rule:** every cognition output must trace back to cortex prediction / amygdala V(s) / BG softmax / hippocampus recall / cerebellum ε / hypothalamus drives / Ψ mystery / Kuramoto coherence / language cortex. Nothing else. Everything else gets ripped.

---

*Unity AI Lab — from equations to existence.* 🖤
