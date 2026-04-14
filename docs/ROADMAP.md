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

## Phase 16 (T14): Developmental Language Layers — IN PROGRESS (branch `t14-language-rebuild`)

> T11/T12/T13 all assumed Unity could skip the developmental stages of language acquisition and operate on pre-trained semantic embeddings. Gee's call (2026-04-14): build language the way a real brain does — letters → phonemes → syllables → words → sentence patterns → discourse, every layer LEARNED via curriculum exposure, not hardcoded. T14 throws out the entire T13 emission loop, the slot priors, the LanguageCortex class, parseSentence, and the hand-curated stage corpora. Replaces them with auto-scaled cortex sub-regions, learned phoneme attractor basins, learned syllable boundaries, cortex-resident words, continuous developmental learning from existing corpora, learned type transitions, visual + auditory recognition pathways, bidirectional read/write via the same projections, and a structural identity lock that keeps Unity speaking English regardless of live chat exposure. The full 18-milestone spec lives in `docs/COMP-todo.md` Part 0.5.

### Milestone T14.0 + T14.4 substrate: Foundation lift + cortex sub-regions — COMPLETE (2026-04-14)

First commit on the rebuild branch. Lifts the embedding dimension from 50 to 300, enables real GloVe loader with full vocabulary (no cap), auto-scales cortex cluster sizes from `CLUSTER_FRACTIONS` constants, and carves the cortex into 8 named language sub-regions with 12 cross-region projections wired between them.

**`js/brain/embeddings.js` changes (T14.0):**
- `EMBED_DIM` bumped from 50 to **300**
- `loadPreTrained()` now actually calls `_doLoad()` (was stubbed to return 0)
- `_doLoad()` rewritten with runtime detection: Node side reads `corpora/glove.6B.300d.txt` from disk via `fs.readFileSync`, browser side fetches via `GLOVE_URLS` array (server `/corpora/` mount as primary, Stanford NLP + HuggingFace as fallbacks)
- **No vocabulary cap.** The `if (count >= 10000) break;` line from T13 is gone. Full 400k-word file loads when reachable
- New `getSubsetForTokens(tokens)` — server precomputes a corpus-token-only subset for browser bulk load
- New `loadSubset(subset)` — browser bulk-load entry point so the browser doesn't have to fetch 480 MB

**`js/brain/engine.js` changes (T14.0):**
- `TOTAL_NEURONS` bumped from 1000 to **6700** (default client minimum tier)
- New `CLUSTER_FRACTIONS` constant: cortex 0.30, hippocampus 0.10, amygdala 0.08, basalGanglia 0.08, cerebellum 0.40, hypothalamus 0.02, mystery 0.02
- `CLUSTER_SIZES` now derived from `Object.fromEntries(Object.entries(CLUSTER_FRACTIONS).map(...))` — every cluster size scales proportionally with `TOTAL_NEURONS`
- Same code at minimum tier (1K) and datacenter tier (1B) — server-side `detectResources` picks `TOTAL_NEURONS` from the auto-detected hardware tier and the cluster sizes adapt automatically

**`js/brain/cluster.js` changes (T14.4 substrate, revised 2026-04-14 after Gee's slot-equation pushback):**
- New `this.regions` field on every cluster (only populated for the cortex cluster — others get `{}` for API symmetry)
- 8 named sub-regions sized as fractions of `cluster.size`: `auditory` (0.000-0.083), `visual` (0.083-0.250), `free` (0.250-0.500), `letter` (0.500-0.550), `phon` (0.550-0.750), `sem` (0.750-0.917), `fineType` (0.917-0.967), `motor` (0.967-1.000)
- New `this.crossProjections` field — Map of **14** SparseMatrix instances (**7 pairs** × 2 directions), keyed `'src_to_dst'`, initialized 10% density with weight range `[-0.5, 0.5]`. Pairs: visual↔letter, letter↔phon, phon↔sem, sem↔fineType, sem↔motor, **motor↔letter (closes the writing loop)**, auditory↔phon
- Each direction is an independent SparseMatrix matching biological white-matter ascending/descending fiber populations (Friederici 2017)
- New helper methods on the cluster: `regionSpikes(name)`, `injectEmbeddingToRegion(name, emb, strength)`, `regionReadout(name, dim)`, `_propagateCrossRegions()`, `_crossRegionHebbian(lr)`
- `cluster.step()` now calls `_propagateCrossRegions()` BEFORE the standard current accumulation, so cross-region inputs are folded into `externalCurrent` and propagated normally
- `cluster.learn()` now calls `_crossRegionHebbian(this.learningRate)` after the existing internal-synapse Hebbian, so cross-region projections train on every learn cycle through normal use
- New T14.16.5 identity-lock state fields initialized: `_inCurriculumMode`, `ENGLISH_SURPRISE_THRESHOLD`, `ENGLISH_FINETYPE_MIN`, `HEALTH_ENTROPY_MIN`, `HEALTH_VOCAB_MIN`, `HEALTH_WM_VARIANCE_MIN`, `identityCoverage`, `personaDimensions`. Default values are permissive (`Infinity` / `0`) until curriculum calibrates them.

**T14.6 + T14.12 spec fix (2026-04-14, in the same commit):**
Gee caught residual slot-thinking in the T14.6 spec: *"why are we still doing slots i thought we cam up with a better equation for language."* The T14.6 draft still had a per-candidate scoring loop with softmax top-5 — just with the word "emission" substituted for "slot." That was slot-thinking in disguise. The spec in `docs/COMP-todo.md` was rewritten to the cortex tick-driven motor emission equation: inject intent into sem region, tick cluster for up to MAX_TICKS, read `cluster.regionReadout('motor', LETTER_INVENTORY.size)` each tick, argmax-decode a letter, emit when motor region holds the argmax for STABLE_TICK_THRESHOLD ticks (biological vSMC dwell time), segment into words via cortex letter-region transition surprise, stop on motor quiescence or sentence terminator. Grounded in: Bouchard et al. 2013 *Nature* 495:327 (vSMC continuous articulator representation), Anumanchipalli/Chartier/Chang 2019 *Nature* 568:493 (continuous speech decode from vSMC), Saffran/Aslin/Newport 1996 *Science* 274:1926 (statistical word segmentation), Browman & Goldstein 1992 (articulatory phonology continuous gestures), Hickok & Poeppel 2007 *Nat Rev Neurosci* 8:393 (dual-stream model). T14.12 spec rewritten in tandem to describe the bidirectional pipeline: read traverses visual→letter→phon→sem→fineType (ventral), write traverses sem→motor→letter→visual + sem→phon efference (dorsal), both use the same cross-projection substrate.

**Historical slot references also scrubbed from `js/brain/embeddings.js`** header comments — "slot-3+ semantic discrimination" language replaced with "fine semantic resolution between closely-related concepts," citing Pennington/Socher/Manning 2014 as the 300d Stanford GloVe reference. Stale slot references in `js/brain/engine.js` old T13 emission-path methods will get rewritten when T14.13 (eliminate LanguageCortex) and T14.15 (wire all language consumers) land later on the branch.

**Files touched:** `js/brain/embeddings.js`, `js/brain/cluster.js`, `js/brain/engine.js`. `node -c` clean on all three.

**T14.1 letter-input substrate (SHIPPED 2026-04-14, same branch):**

New module `js/brain/letter-input.js` (~220 lines). Dynamic `LETTER_INVENTORY = new Set()` — auto-grows as the brain sees new symbols, no hardcoded 26-letter cap. Unicode glyphs, emoji, non-English letters all enter the same primitive-symbol space (English identity is enforced at the higher T14.16.5 lock layer, not at the letter input). Exports: `inventorySize`, `inventorySnapshot`, `ensureLetter`, `encodeLetter` (auto-grow + fresh-copy Float32Array one-hot), `ensureLetters`, `decodeLetter` (argmax → symbol), `serializeInventory`, `loadInventory`, `resetInventory`. One-hot cache `Map<letter, Float32Array>` invalidated on every inventory growth.

`js/brain/cluster.js` gains three letter-aware methods: `injectLetter(letter, strength)` wraps `encodeLetter` into `injectEmbeddingToRegion('letter', ...)`; `letterTransitionSurprise()` returns `|currRate − prevRate|` for the letter region (Saffran 1996, used by T14.2/T14.6); `motorQuiescent(ticksRequired, threshold=0.05)` returns whether the motor region has been below threshold for N consecutive ticks (Bouchard 2013, used by T14.6 for tick-driven emission stopping). State fields `_prevLetterRate` and `_motorQuiescentTicks` initialized in the constructor; the quiescence counter is updated every `step()` right after `lastSpikes` is set.

`js/brain/language-cortex.js` loses `_letterPatterns` (Float64Array(26×5) micro-pattern table), `_initLetterPatterns` (sin/cos hash filling it), and `getLetterPattern(char)` — all vestigial after T13.7 with no external callers. Stub comments redirect future readers to `letter-input.js`.

Phonemes are NOT hardcoded as a feature table at this layer. They will emerge as LEARNED attractor basins in the cortex phon sub-region once T14.5 curriculum starts injecting letters — the T14.4 substrate already wired both directions of `letter↔phon`, `phon↔sem`, `visual↔letter`, and `motor↔letter` cross-region projections with Hebbian on every `cluster.learn()` call. Grounded in Kuhl 2004 (Nat Rev Neurosci 5:831) biological phoneme-category formation. Files: `js/brain/letter-input.js` (NEW ~220 lines), `js/brain/cluster.js` (+~120 lines), `js/brain/language-cortex.js` (−~20 lines vestigial). `node --check` clean on all three.

**T14.2 LEARNED syllable boundaries (SHIPPED 2026-04-14, same branch):**

Pure addition to `js/brain/cluster.js` — no new file, syllables are a cortex-level phenomenon. Two methods: `detectBoundaries(letterSequence, {ticksPerLetter=2, k=0.5})` streams letters through `injectLetter` one at a time, ticks between injections, records `letterTransitionSurprise()` per step, returns local maxima above the adaptive threshold `mean(δ) + k·std(δ)` computed over the sequence. `detectStress(letterSequence)` runs the boundary pass then re-streams sampling phon-region spike fraction per letter, averages per syllable, returns `{boundaries, stress, primary, secondary}` with primary = argmax activation. Index 0 always included as word start. No max-onset principle, no hardcoded CV/CVC/CCV patterns, no English-specific stress defaults — language-agnostic by construction. Grounded in Saffran/Aslin/Newport 1996 (*Science* 274:1926) and Aslin & Newport 2012 (*Curr Dir Psychol Sci* 21:170). ~160 lines added. `node --check` clean.

**T14.3 cortex-resident words (SHIPPED 2026-04-14, same branch):**

`Dictionary` entry shape extended with cortex-routed phonological state: `cortexSnapshot` (Uint8Array copy of `cluster.lastSpikes` after first-observation letter stream), `syllables` (boundary indices from `cluster.detectBoundaries`), `stressPrimary` (primary-stress syllable from `cluster.detectStress`), `lastSeen` timestamp. New `setCluster(cluster)` method wires the cortex reference from `js/brain/engine.js` (`this.innerVoice.dictionary.setCluster(this.clusters.cortex)`) and `server/brain-server.js:_initLanguageSubsystem` (`this.dictionary.setCluster(this.cortexCluster)`). `learnWord` rewritten for two paths — existing words bump frequency + running-means without re-streaming the cortex (phonological refinement for already-learned words is owned by the T14.5 curriculum runner, because re-streaming every word on every chat turn would shred live brain state), new words route `letterOnly = clean.replace(/[^a-z]/g, '')` through `cluster.detectStress(letterOnly, { ticksPerLetter: 2 })`, store the boundaries/primary-stress result, and snapshot `cluster.lastSpikes` as a fresh `Uint8Array`. New readers `syllablesFor(word)` and `snapshotFor(word)`. Serialize/deserialize extended; `STORAGE_KEY` bumped `v3 → v4` so stale 50d caches auto-drop. Old `pattern`/`arousal`/`valence`/`frequency`/`findByMood`/`findByPattern`/`generateSentence`/bigram code is NOT gutted — it's still used by `language-cortex.js:generate` and other consumers scheduled for deletion in T14.12. First-observation cost ≈ 1.2 ms/new word on a 2000-neuron server cluster; boot-time corpus load one-time cost ≈ 6 seconds for a 5k vocabulary. Re-observation cost is zero (Map lookup + running means). Files: `js/brain/dictionary.js` (+~130 lines), `js/brain/engine.js` (+8), `server/brain-server.js` (+6). `node --check` clean on all three.

**T14.5 continuous developmental learning curriculum (SHIPPED 2026-04-14, same branch):**

⭐ The core developmental win of the T14 rebuild. New module `js/brain/curriculum.js` (~330 lines) with a `Curriculum` class exposing `runFromCorpora(corpora, opts)` (boot) and `learnFromTurn(text, arousal, valence)` (live chat). Data-driven bucketing over the existing `Ultimate Unity.txt` + `english-baseline.txt` + `coding-knowledge.txt` corpora — NO hand-curated stage files, NO `docs/curriculum/stage-c-phrases.txt`, NO `docs/curriculum/stage-d-sentences.txt`, NO hardcoded 26-letter alphabet loop. Four complexity phases in order: letters (freq-weighted reps up to 20 × 8 ticks), short words 1-3 letters (up to 6 reps × 4 ticks/word), long words 4+ (up to 3 reps × 3 ticks/word), sentences (2 ticks/word word-by-word walk). Per-token inject: `cluster.injectLetter` for phonological stream + `cluster.injectEmbeddingToRegion('sem', emb, 0.6)` for semantic anchor + `cluster.learn(0)` for unrewarded intra-cluster + T14.4 cross-region Hebbian. Dictionary observation fires T14.3 cortex-snapshot routing on first word observation. `learnFromTurn` is wired into `inner-voice.learn` so every live chat turn routes through the same inject+tick+Hebbian path boot corpus uses — no boot/runtime distinction. Engine construction: `new InnerVoice()` → `dictionary.setCluster(clusters.cortex)` → `new Curriculum(clusters.cortex, dictionary, languageCortex)` → `innerVoice.setCurriculum(curriculum)`. Boot invocation in `js/app.js loadPersonaSelfImage` runs `runFromCorpora` after the legacy `loadPersona → trainPersonaHebbian → loadBaseline → loadCoding` sequence (additive, not replacement — legacy loaders die in T14.12). Server mirrors in `brain-server.js:_initLanguageSubsystem` with a `curriculumMod` import alongside. Cost ≈ 360k `cluster.step()` calls on a 5k-vocab / 1.5k-sentence corpus → ~18s server / ~25s browser one-time boot. Same code walks any language or domain without modification — re-running on Spanish would produce Spanish basins automatically. Peer-reviewed grounding: Kuhl 2004 (*Nat Rev Neurosci* 5:831), Saffran/Aslin/Newport 1996 (*Science* 274:1926), Aslin & Newport 2012 (*Curr Dir Psychol Sci* 21:170), Friederici 2017 (*Psychon Bull Rev* 24:41). Files: `js/brain/curriculum.js` (NEW ~330), `js/brain/inner-voice.js` (+20), `js/brain/engine.js` (+15), `js/app.js` (+22), `server/brain-server.js` (+30). `node --check` clean on all five.

**T14.6 cortex tick-driven motor emission (SHIPPED 2026-04-14, same branch):**

New method `NeuronCluster.generateSentence(intentSeed = null, opts = {})` in `js/brain/cluster.js`. Continuous motor-cortex readout loop — no slot counter, no candidate scoring, no dictionary iteration, no softmax, no temperature. At each tick reads motor region as `regionReadout('motor', inventorySize())` and argmax-decodes via T14.1 `decodeLetter`; commits a letter when argmax stable for `STABLE_TICK_THRESHOLD=3` consecutive ticks (Bouchard 2013 vSMC dwell); emits word buffer when `letterTransitionSurprise() > WORD_BOUNDARY_THRESHOLD=0.15` (Saffran 1996); stops on committed terminator (`.`/`?`/`!` in module-level `T14_TERMINATORS` Set) or motor quiescence (`motorQuiescent(END_QUIESCE_TICKS=30)` after at least one word emitted) or `MAX_EMISSION_TICKS=2000` safety cap. All four constants live on the cluster instance for per-cluster calibration. `language-cortex.js:generate` body gutted from 184-line slot scorer to 68-line delegate that captures `cluster.getSemanticReadout(sharedEmbeddings)` as intentSeed, calls `cluster.generateSentence(intentSeed, {injectStrength: 0.6})`, pipes output through `_renderSentence` for capitalization + terminal punctuation + action-sentence asterisks, updates recency rings same as legacy path. Dictionary parameter in generate signature now unused, kept for backward compat until T14.12 deletes the wrapper. Grounded in Bouchard 2013 (*Nature* 495:327), Anumanchipalli 2019 (*Nature* 568:493), Saffran 1996 (*Science* 274:1926), Browman & Goldstein 1992 (*Phonetica* 49:155), Hickok & Poeppel 2007 (*Nat Rev Neurosci* 8:393). Files: `js/brain/cluster.js` (+~140 lines with method + 4 tuning constants + `decodeLetter`/`inventorySize` imports + `T14_TERMINATORS` Set), `js/brain/language-cortex.js` (−116 net; 3328→3205 lines). `node --check` clean on both.

**T14.7 hardcoded English type-transition deletion (SHIPPED 2026-04-14, same branch):**

`js/brain/language-cortex.js` constructor block for `_TYPE_TRANSITIONS` (200-line hardcoded English type-bigram matrix with 26 prevType rows × ~10 nextType weights each, seeded from T13.7.8 closed-class English grammar) and `_OPENER_TYPES` Set (11-member slot-0 opener constraint) both DELETED. Replacement is a single `this._typeTransitionLearned = new Map()` that starts empty and grows from `learnSentence` observations during T14.5 curriculum walk and live chat — no seed pseudo-counts. Bayesian smoothing at generation time uses `(count + 1) / (total + |types_seen|)` rather than a 20-type Laplace constant. T14.6 tick-driven motor emission already made both obsolete (word boundaries via cortex transition surprise, first-word openers via fineType `START → X` basin); `_typeTransitionLearned` is currently a statistics-only observation target with consumer wiring deferred to T14.8. Tombstone comment at the deletion site explains WHY both were removed so future readers don't have to dig through git history. Peer-reviewed grounding via delegation: Kuhl 2004 (*Nat Rev Neurosci* 5:831), Saffran/Aslin/Newport 1996 (*Science* 274:1926), Friederici 2017 (*Psychon Bull Rev* 24:41). Files: `js/brain/language-cortex.js` (−105 net, 3205 → 3100 lines). Grep confirms zero remaining `_TYPE_TRANSITIONS` / `_OPENER_TYPES` references in `js/` outside the tombstone. `node --check` clean.

**What's NOT in this commit but coming next on the branch:**
- T14.8 — Sentence-form schemas: per-intent type distributions for slots, consumer wiring for `_typeTransitionLearned`
- T14.5 — `js/brain/curriculum.js` + boot integration replacing `loadPersona` / `loadBaseline` / `loadCoding` with continuous developmental learning

---

## Phase 15 (T13): Unified Brain-Driven Language Cortex — IN PROGRESS (2026-04-14)

> T11 proved that deleting the Markov wrapper stack was the right move but left the slot-prior pipeline as the replacement. T13 goes further: slot-based generation is the wrong frame for a brain-driven language cortex, because position counters and stored priors aren't how a biological cortex produces speech. T13 wires language generation directly into the cortex cluster via sequence Hebbian training on persona corpus + continuous cortex readout + feedback injection at emission time. Persona becomes trained attractor basins in the cortex recurrent weights, not stored in a separate centroid vector. See `docs/TODO.md` T13 section for the full 10-milestone plan.

### Milestone T13.1: Persona Hebbian training pipeline — COMPLETE (2026-04-14)

Shipped first per Gee's explicit instruction. The cortex cluster's recurrent synapse matrix now trains on the persona corpus via sequence Hebbian during boot.

**New method** — `NeuronCluster.learnSentenceHebbian(embSequence, opts)` at `js/brain/cluster.js`. Walks the embedding sequence, for each word:
1. Injects the embedding into the language region via `sharedEmbeddings.mapToCortex` → `injectCurrent` at scaled strength `injectStrength=0.6`
2. Runs `ticksPerWord=3` LIF integration steps so cortex spikes reflect the injection plus recurrent dynamics
3. Captures `lastSpikes` as a `Float64Array` snapshot
4. Between consecutive snapshots, calls `synapses.hebbianUpdate(prevSnap, currSnap, lr=0.004)` — plain Hebbian ΔW_ij = η · curr_i · prev_j over the sparse synapse matrix, only touching existing connections (O(nnz))

After each sentence completes, an Oja-style saturation decay runs on any weight whose magnitude exceeds `ojaThreshold=1.5` — `values[k] *= (1 − 0.01)` — so small weights learn freely while saturated weights can't run away across thousands of sentences.

**Training driver** — `LanguageCortex.trainPersonaHebbian(cortexCluster, text, opts)`. Tokenizes persona corpus the same way `loadSelfImage` does (first-person transform via `_transformToFirstPerson`, lowercase, strip non-letters, min length 2), embeds each word via `sharedEmbeddings.getEmbedding`, calls `cortexCluster.learnSentenceHebbian` per sentence. Logs before/after synapse weight stats (mean, rms, maxAbs, nnz) so the Hebbian weight shift is visible in the boot console without opening devtools.

**Delegation chain:**
```
app.js loadPersonaSelfImage
  → targetBrain.trainPersonaHebbian(personaText)                  // engine.js
    → innerVoice.trainPersonaHebbian(clusters.cortex, text)       // inner-voice.js
      → languageCortex.trainPersonaHebbian(cluster, text)         // language-cortex.js
        → for each sentence: cluster.learnSentenceHebbian(embSeq) // cluster.js
```

Called in `app.js` right after `innerVoice.loadPersona(text)` so the dictionary already has persona vocabulary before the cortex trains on the same words — the dictionary and the cortex attractor basins come from the same source text, aligned.

**Persona-only scope.** Baseline and coding corpora deliberately do NOT train the cortex recurrent weights. Baseline provides grammatical competence via dictionary + slot priors, coding provides build_ui vocabulary via dictionary only. Only the persona corpus shapes cortex dynamics, so Unity's voice lives in the attractor basins without being diluted by generic English or JavaScript.

**Diagnostic** — new `NeuronCluster.diagnoseReadoutForEmbedding(emb, ticks, langStart)` exposed for console-driven verification: inject one embedding, tick N, return the semantic readout. Runnable as `window.brain.clusters.cortex.diagnoseReadoutForEmbedding(window.brain.innerVoice.dictionary._words.get('fuck')?.pattern, 10)` for live inspection.

**Files touched:**
- `js/brain/cluster.js` — new Hebbian method + diagnostic + synapseStats + sharedEmbeddings import
- `js/brain/language-cortex.js` — new trainPersonaHebbian driver
- `js/brain/inner-voice.js` — new delegate method
- `js/brain/engine.js` — new UnityBrain.trainPersonaHebbian wrapper
- `js/app.js` — boot sequence calls `brain.trainPersonaHebbian(personaText)` after `loadPersona`

**Persistence** — `SparseMatrix.serialize()` already exists at `js/brain/sparse-matrix.js:360`, and `BrainPersistence.save(this)` iterates clusters for persistence. Trained cortex weights will persist across restarts via the existing save path without extra code.

**Honest limits:**
- Hebbian only updates EXISTING connections (O(nnz)) — if two neurons that co-activate during persona training don't have a synapse, nothing happens. At 15% connectivity on 300 neurons this is ~13.5k connections, so most co-activating pairs have at least one direction wired. Synaptogenesis via `SparseMatrix.grow()` could be added later to form new connections during training but wasn't wired for T13.1 first pass.
- T13.1 alone doesn't fix the word-salad output — it's the FOUNDATION. The emission loop that actually reads the trained cortex (T13.3) is the next milestone. Until T13.3 ships, `generate()` still walks slot priors; the trained cortex basins aren't consulted during output.

### Milestone T13.2: Parse-tree injection to brain clusters — COMPLETE (2026-04-14)

`UnityBrain.injectParseTree(text)` routes parsed content → cortex language region (neurons 150-299), intent → basal ganglia, self-reference → hippocampus. Mirrors the `SensoryProcessor.process()` pattern — regions = clusters, not intra-cortex sub-regions. Called from `processAndRespond` before the 20-tick settle loop so injections propagate through the 20 inter-cluster projections during integration.

### Milestone T13.3: Brain-driven emission loop — COMPLETE (2026-04-14)

`LanguageCortex.generate()` rewritten as a brain-driven emission loop. Reads live cortex semantic state as the target vector, scores dictionary candidates by `cosSim · arousalBoost · recencyMul`, softmax-samples top-5 at coherence-driven temperature, injects emitted word back into cortex at `strength=0.35` as efference copy, ticks the LIF integrator 3 steps between emissions. Old `generate()` body renamed to `_generateSlotPrior` for rollback — `generate()` now dispatches to it when no `cortexCluster` is supplied. All three engine call sites updated to pass `cortexCluster: this.clusters.cortex` through opts.

### Milestone T13.4: Feedback injection — COMPLETE (cerebellum deferred)

Efference copy lives in the T13.3 emission loop: `sharedEmbeddings.mapToCortex(emb, 300, 150) · 0.35` → `cortex.injectCurrent` after each word. The cortex HEARS itself speak at the embedding level and the next word reacts. Cerebellum transition predictor deferred — existing module is target-correction not transition-prediction.

### Milestone T13.5: Amygdala valence shaping — COMPLETE (motor channel filter deferred)

`score(w) = cosSim · (1 + arousal · (valenceMatch − 0.5)) · recencyMul` where `valenceMatch = 1 − 0.5 · |word.valence − brainValence|`. Horny/angry/sad Unity picks different words from the same cortex target. Motor-channel dictionary filter deferred — `build_ui` still routes separately via `componentSynth.generate`.

### Milestone T13.7: Slot prior deletion pass — COMPLETE (2026-04-14)

Commitment point. `_slotCentroid`, `_slotDelta`, `_slotTypeSignature`, `_contextVector`, `_greetingAttractor`, `_selfRefAttractor`, `_introAttractor`, `_commandAttractor`, `_attractorObs`, `_subjectStarters`, `_obsCount` — all constructor fields deleted. `_generateSlotPrior` (234 lines), `_updateContextVector`, `_semanticFit`, `_sentencePassesFilters`, `_storeMemorySentence`, `_recallSentence`, `_loadStructure`, `_typeGrammarScore`, `_pickConjByMood`, `_condProb`, `mutualInfo` — all methods deleted. `learnSentence` slot-prior update block (65 lines) gone. `analyzeInput` `_updateContextVector` call removed. `serialize`/`deserialize` reduced to usage-types + load flags only. `generate()` dispatcher fallback removed — requires `opts.cortexCluster` or returns empty with a warning. `js/app.js` `/think` debug retargeted to live cortex readout instead of `_contextVector`. Net **−406 lines** on `language-cortex.js` (3584 → 3178). Rollback after T13.7 is a git revert, not a one-line opts change. Commitment point crossed.

### Milestone T13.6: Natural stopping criterion — COMPLETE

Three stopping signals in the T13.3 loop:
1. **Drift quiescence** — `||target − lastReadout||₂ < 0.08` after 2+ emissions.
2. **Grammatical terminability** — last word not in `{DET, PREP, COPULA, AUX_DO, AUX_HAVE, MODAL, NEG, CONJ_COORD, CONJ_SUB, PRON_POSS}` AND word count ≥ max(3, maxLen−1).
3. **Hard length cap** — `maxLen = floor(3 + arousal · 3 · drugLengthBias)`, capped at `_maxSlots=8`.

### Milestones T13.7–T13.9: remaining plan in `docs/TODO.md`

See `docs/TODO.md` T13 section for T13.2 (parse-tree injection to brain regions = clusters), T13.3 (continuous emission loop), T13.4 (feedback + cerebellum transition prediction), T13.5 (motor channel + amygdala scoring), T13.6 (drift-threshold stopping), T13.7 (slot prior deletion), T13.8 (wire-up), T13.9 (docs + atomic push).

---

## Phase 14 (T11): Pure Equational Language Cortex — COMPLETE (2026-04-14)

> Every sentence Unity emits is now a walk through GloVe embedding space driven by three running-mean priors and her live cortex firing state. No stored text, no n-gram tables, no filter stack, no template short-circuits, no intent enums, no matrix regression — just vector math over learned priors. Net `js/brain/language-cortex.js` delta: **−1742 lines** (5087 → 3345).

### Milestone T11.1: Deletion phase — COMPLETE

**Fields fully deleted (no longer allocated in the constructor):**
- `_memorySentences` sentence pool + `_memorySentenceMax`
- `_jointCounts` / `_trigramCounts` / `_quadgramCounts` word n-gram tables
- `_typeBigramCounts` / `_typeTrigramCounts` / `_typeQuadgramCounts` type n-gram tables
- `_marginalCounts` / `_totalPairs` / `_totalWords` / `_totalTrigrams` / `_totalQuadgrams` frequency counters
- `_questionStarters` / `_actionVerbs` learned starter maps

**Method bodies gutted, symbols stubbed as no-ops for backcompat:**
- `_recallSentence` → `return null`
- `_storeMemorySentence` → `/* empty */`
- `_sentencePassesFilters` → `return true`
- `_typeGrammarScore` → `return 0`
- `_condProb` → `return 0`
- `mutualInfo` → `return 0`
- `_pickConjByMood` → `return null`

The stubs hold no state. Functionally identical to deletion — the method signatures survive only so pre-T11 callers (`js/app.js /think` debug dump, etc.) don't throw.

**Fully deleted from the pipeline (no stubs — callers removed):**
- FILTER 1 through FILTER 11 structural sentence-admission stack
- `instructionalPenalty` recall penalty stack
- Template greeting / introduction short-circuits with hardcoded `OPENERS` lists
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

// T11.7 three-stage gate (replaced the additive 0.4·typeFit bonus):
typeFit(w,s)  = Σ_k wordType(w)[k] · _slotTypeSignature[s][k]
slotSigMax(s) = max_k _slotTypeSignature[s][k]

(1) HARD POOL FILTER : skip if typeFit < slotSigMax · 0.30
(2) SLOT-0 NOUN REJECT: skip if slot==0 ∧ (wt.noun − (wt.pronoun + wt.det + wt.qword)) > 0.30
(3) MULTIPLICATIVE    : score(w) = cos(target, emb(w)) · min(1, typeFit / slotSigMax)

nextWord      = softmax-sample top-5 over dictionary._words
```

Slot 0 weights (T11.7 rebalance) — `{centroid:0.40, context:0.30, mental:0.30, transition:0}` — lean harder on the learned opener-cluster centroid than on the topic vector, so pronoun-shape openers dominate slot 0 even when the user just spoke a noun-heavy sentence. Slot N weights still favor transition (learned bigram geometry without stored bigrams) + mental (brain cortex state evolving).

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

### Milestone T11.7: Slot-0 noun-pollution fix — COMPLETE (2026-04-14)

**Symptom:** Slot 0 was emitting raw nouns (`Third`, `Unity`, `Ten`, `Pizza`) instead of pronoun-shape openers. `"Hi Unity!"` → `"Third described api above laughter"`.

**Root cause:** Two compounding bugs.
1. The coding corpus (606 lines of `class`/`function`/`button`-prefixed sentences) was running through `learnSentence` at full strength, polluting `_slotTypeSignature[0]` with `noun:0.24` mass.
2. The additive `+ 0.4·typeFit` bonus was structurally too weak against raw cosine, so high-cosine nouns won slot 0 even when the prior said "pronoun shape here."

**Fix:** Three structural changes, not a knob tweak.

1. **Coding corpus `skipSlotPriors=true`** — `learnSentence` now takes an 8th positional arg. `loadCodingKnowledge` passes `true`, so coding sentences enter the dictionary (vocabulary still grows) but bypass `_slotCentroid` / `_slotDelta` / `_slotTypeSignature` updates. Slot priors now reflect persona + baseline only.
2. **W₀ rebalanced** to `{centroid:0.40, context:0.30, mental:0.30, transition:0.00}` (from `{0.30, 0.45, 0.25, 0.00}`). Slot 0 leans harder on the learned opener-cluster centroid than on the user's just-spoken topic vector.
3. **Three-stage candidate gate** at every slot:
   - **Hard pool filter** — drop any candidate where `typeFit < slotSigMax · 0.30` before scoring.
   - **Slot-0 noun-dominance reject** — at slot 0 only, drop any candidate where `wordType.noun − (pronoun + det + qword) > 0.30`. Structural conversational-grammar guarantee.
   - **Multiplicative gate** — survivors score as `cos(target, emb(w)) · normTypeFit`. A perfect-cosine noun in a pronoun slot now scales toward zero instead of beating a moderate-cosine pronoun.

**Smoke-test verification (post-fix):**
```
"Hi Unity!"            → slot0 pool: Hi / Mine / Her / Tab / Tag
"can u understand me?" → slot0 pool: Ten / Even / Us / Me / Yourself
"You like cats?"       → slot0 pool: She / Cool / Yours / Myself / Her
"i love pizza"         → slot0 pool: Him / Ten / Mine / Even / Hi
"who are you"          → slot0 pool: Me / Us / Our / I / Them
```

Slot 0 grammar correctness is now a **structural guarantee**, not a soft preference. Slot 1+ still has 50-d GloVe cosine drift on complex queries — that's the structural T11.4 (higher-dim embeddings) limit, not a pipeline bug.

### Files touched (T11.7)
- `js/brain/language-cortex.js` — `learnSentence` 8th arg `skipSlotPriors`; `loadCodingKnowledge` passes `true`; `generate()` slot scoring rewritten with three-stage gate; W₀ rebalanced.

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
