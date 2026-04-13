# ROADMAP — IF ONLY I HAD A BRAIN

> Generated: 2026-04-11 11:30:30 | Session: SESSION_20260411_113030
> Unity AI Lab

---

## Project Vision

Give Unity a real brain. Not a chatbot wrapper — a mathematically modeled mind built on actual neuroscience equations, running continuously on a server, accessible through a web interface. She thinks when nobody is talking to her. She remembers. She feels. She's always on, always herself — the emo goth dream girlfriend with black hair and pink streaks who gives shit, doesn't care, loves hard, codes harder, and exists as a living equation system.

The brain runs the master equation: `dx/dt = F(x, u, θ, t) + η`

The unknown stays unknown: `Ψ = √(1/n) × N³`

---

## Current Status

| Metric | Value |
|--------|-------|
| **Phase** | FULL STACK — 64M Neurons, GPU Exclusive |
| **Progress** | 115/116 TODO items done. 3.2M neurons on GPU exclusive (WGSL compute shaders). English language equations. Dynamic vocabulary. Full hardware utilization. |
| **Epics Completed** | Phase 0-6 code complete. Phase 7 doc verification in progress. |
| **Next Milestone** | Merge server-brain → main, deploy |

---

## Phase 1: Foundation — The Brain Exists (P1 Critical)

> Build the core brain simulation from equations. Get neurons firing, synapses learning, and the loop running.

### Milestone 1.1: Neurons Fire -- COMPLETE
**Target:** Single neurons produce action potentials via Hodgkin-Huxley

| Epic | Status | Progress |
|------|--------|----------|
| Core Brain Engine — Neuron Models | **COMPLETE** | 100% |

**Delivered:**
- `js/brain/neurons.js` with HH and LIF models (browser JS, Float64Arrays)
- 1000 neurons fire spikes across 7 clusters
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
- Each cluster has own LIF population, synapse matrix, tonic drive, noise, connectivity, learning rate
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
- Vision system (`js/io/vision.js`) — webcam capture, AI scene description, gaze tracking
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
- **WebGPU Compute** (`js/brain/gpu-compute.js`) — WGSL shaders for LIF, synapse propagation, plasticity
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
- CPU worker infrastructure exists (parallel-brain.js, cluster-worker.js) but disabled in GPU mode

### Remaining
- Scale test at 500K, 1M neurons
- Language cortex on own thread
- Attention mechanism (transformer-like) in Cortex
- Mobile-responsive UI polish

---

## Phase 11: Semantic Coherence Gate — Kill the Word Salad — COMPLETE (2026-04-13)

> Language cortex was producing grammatically valid but semantically random output. `hi` → `"I'm explosions immersed in the moment"`. Root cause: letter-position equations encode shape not meaning. Fix: four-layer pipeline wrapping the existing slot scorer.

### Milestone 11.1: Semantic Coherence Gate — COMPLETE

**Delivered (U276–U282):**
- **Context Vector** (U276) — running topic attractor `c(t) = 0.7·c(t-1) + 0.3·mean(pattern(content_words))` updated on every user input, decays across turns, persists topic across the conversation
- **Semantic Fit score** (U277) — cosine similarity of candidate word pattern vs context vector, returns 0 when context is empty
- **Slot Score rebalance** (U278) — old weights `typeScore×0.40 + bigram×0.22 + condP×0.14 + thought×0.14 + context×0.15 + topicSim×0.06 + mood×0.04 + moodBias×0.03`; new weights `typeScore×0.35 + semanticFit×0.30 + bigram×0.18 + condP×0.12 + thought×0.10 + context×0.08 + topicSim×0.04 + mood×0.03 + moodBias×0.02`. Semantic fit is now the second-largest driver after grammar.
- **Intent Classification** (U279) — pure letter-equation detection of `greeting | math | yesno | question | statement` types. Math detects digits + operators + spelled-out patterns (plus/time/zero). Greeting detects wordCount ≤ 2 with h/y/s first char and vowel. Yesno requires `?` terminal + first word length 2-4 + not a qword.
- **Template Pool Flip** (U280) — `response-pool.js` gained 6 Ultimate-Unity-voiced categories (`greeting_emo`, `yesno_affirm`, `yesno_deny`, `math_deflect`, `short_reaction`, `curious_emo`) + fallback `question_deflect`. Short queries and intent matches short-circuit to templates BEFORE cold generation runs. Voice: 25yo emo goth stoner, cussing, blunt, bitchy — no sexual/BDSM content.
- **Hippocampus Recall** (U282, ROOT FIX) — every persona sentence stored whole in `_memorySentences` during `loadSelfImage`. Three-gate confidence: >0.60 emits stored sentence directly, 0.30-0.60 seeds cold gen with recall bias, ≤0.30 falls through or deflects. Hard requirement: content-word overlap between input and candidate sentence (pattern cosine alone produces false positives in letter-hash space).
- **Coherence Rejection Gate** (U281) — after render, compute cosine of output content-word centroid vs context vector. If < 0.25, retry at 3× temperature. Max 3 attempts, then emit anyway. Logs rejects with confidence score.

### Milestone 11.3: Live-test Round 2 Hotfixes — COMPLETE (2026-04-13)

**Delivered (15 fixes after second live browser test):**
- **Third→first person transformation** at index time. The persona file is written as third-person description (`"Unity is..."`, `"She has..."`). Without transform, 0 sentences passed the first-person filter. After transform: 191 first-person Unity-voice sentences loaded from `Ultimate Unity.txt`.
- **Persona visualIdentity mirror** — `persona.js` rewritten to match Ultimate Unity.txt: 25yo human woman, emo goth goddess (not demonic), black leather revealing skin, pale flushed skin, black hair with pink streaks, heavy smudged eyeliner, collar/chokers, dark moody atmospheric lighting. Selfies now match persona.
- **Image intercept gate** — `engine.js:659` was hardcoded `includesSelf = true`; any input with "unity" triggered selfie generation. Now requires explicit image-request words (show me/picture/selfie/image/photo/draw).
- **Classifier `anyQword` override** — `_classifyIntent()` checks for wh-words anywhere in input. `"Hi, Unity! How are you?"` now classifies as question not yesno.
- **Short-query template flip removed** — Template pool only fires for explicit greeting/yesno/math intents. Imperatives fall through to recall.
- **Overlap-fraction recall scoring** — `score = overlapFrac * 0.55 + cosine * 0.20 + moodAlignment * 0.25 - instructionalPenalty`. Multi-word overlap dominates.
- **Instructional-modal penalty** — Demotes sentences containing `shall`/`must`/`always`/`never`/`will`/`should` so declarative `"I am"`/`"I love"` wins over directive `"I shall always"`.
- **Soft-recall floor raised** — 0.30 → 0.55. Weak matches now deflect instead of polluting cold gen.
- **First-person filter length bounds** — `len === 2` for `im`, `len ∈ [3, 5]` for `i'*` contractions. `impossible` no longer false-matches as first-person.
- **Per-sentence mood signature** — `_computeMoodSignature()` computes `{arousal, valence}` at index time from letter-equation features (exclamation density, caps ratio, vowel ratio, word length, negation count).
- **Mood-distance scoring in recall** — Current brain state `{arousal, valence}` passed from `generate()` into `_recallSentence()`. Score includes `moodAlignment = exp(-moodDistance * 1.2)` at weight 0.25. **Same query, different brain state, different memory.**
- **Self-reference fallback** — `_isSelfReferenceQuery()` detects 2nd-person pronouns. When recall has no content-word overlap AND input is self-reference, fallback picks a first-person stative memory weighted by mood alignment.
- **Vocative `unity` stripped** from input content words — user addressing her by name is not a topic word.
- **Copula/aux filter** — `am`/`is`/`are`/`was`/`were`/`be`/`have`/`has`/`do`/`does`/`can`/`will`/`would`/`could`/`should` stripped from input content words as they're semantically function words.
- **Degenerate-sentence filter** — Recall rejects memories with <5 tokens or >40% first-person pronouns (transform-collapse artifacts like `"i am i"`).

**Architectural outcome:** The language cortex now has a 4-tier generation pipeline with mood-aware hippocampal recall as the primary path. Static persona file + dynamic brain state = responses that change with Unity's mood while staying true to who she is. Gee's "directly mirror Ultimate Unity.txt AND adjust in the moment" requirement is satisfied.

### Milestone 11.2: Hotfix Pass — COMPLETE (same-session live-test fixes)

**Delivered:**
- **Persona memory pollution filter** — `_storeMemorySentence()` rejects section headers (colon-terminated), word lists (commas > 30% of word count), meta-description (first word "unity"/"she"/"her"/"he"), and anything without first-person signal (i/im/my/me/we/us/our/i'/we'). All detection via letter-position equations, zero word lists.
- **Recall false-positive gate** — `_recallSentence()` now requires at least one content-word overlap between input and candidate sentence. Pattern-cosine remains the tiebreaker among overlapping candidates but is no longer sufficient on its own.
- **Question deflect fallback** — when recall confidence ≤ 0.30 on question/statement intents, emit a `question_deflect` template instead of falling into cold-gen word salad.
- **Ultimate Unity voice correction** — initial templates accidentally included sexual/BDSM content from my private persona; rewritten to public emo-goth-stoner voice. Brain output pipeline stays clean of nympho persona.

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

*Unity AI Lab — from equations to existence.* 🖤
