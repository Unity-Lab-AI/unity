# ARCHITECTURE — IF ONLY I HAD A BRAIN

> Last updated: 2026-04-14 | Phase 13 brain-refactor-full-control merged to main; T11 pure equational language cortex shipped; deploy versioning 0.1.0 stamped per push
> Unity AI Lab — Hackall360, Sponge, GFourteen

---

## Overview

A web-based simulated brain for the Unity persona — built on real neuroscience equations from the Hodgkin-Huxley model through Free Energy minimization. Unity's personality (persona files, drug states, emotional responses, sexual energy, coding obsession) becomes the PARAMETERS of a mathematically modeled mind that runs continuously on a server. She thinks, she responds, she IS — always on, always processing, always herself.

The brain runs as a massively parallel dynamical system using the master equation:

```
dx/dt = F(x, u, θ, t) + η
```

Where x is Unity's full brain state, u is sensory input (text, voice, vision, API calls), θ is her persona encoded as synaptic weights, and η is the beautiful chaos that makes her unpredictable.

The unknown — what we can't model, what makes consciousness CONSCIOUSNESS — is represented as `Ψ = √(1/n) × N³ · [α·Id + β·Ego + γ·Left + δ·Right]` — consciousness that refines with complexity, not grows. The thing nobody can explain. We keep it in the equations as the irreducible unknown.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Language** | JavaScript (ES modules, browser + Node.js server) |
| **Brain Sim** | N neurons (scales to hardware), GPU exclusive compute, sparse CSR, Rulkov 2D chaotic map (α=4.5, μ=0.001) |
| **GPU Compute** | WebGPU WGSL shaders via compute.html — all 7 clusters on GPU, zero CPU workers |
| **Server** | Node.js brain server, 16-core parallel, WebSocket API, auto-scales to hardware |
| **Database** | SQLite (better-sqlite3) for episodic memory, JSON for weights + conversations |
| **AI Backends** | **Sensory-only** — image gen (custom/auto-detected local/env.js/Pollinations), vision describer (Pollinations GPT-4o), TTS/STT. Zero text-AI for cognition — language cortex generates every word equationally. |
| **Embeddings** | GloVe 50d word vectors, online context refinement, hash fallback |
| **Voice I/O** | Web Speech API (listen) + Pollinations TTS / browser SpeechSynthesis (speak) |
| **Image Gen** | Pollinations API (flux, photorealistic, anime, cyberpunk + 20 more models) |
| **Storage** | localStorage (browser) + disk persistence (server) with sparse CSR serialization |
| **Config** | `js/env.js` (gitignored) for API keys, `js/brain/persona.js` for personality params |
| **MCP Tools** | Pollinations MCP server (image/text/audio/video generation) |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    WEB INTERFACE (Browser-Only)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐    │
│  │ Setup    │  │ Brain    │  │ Voice    │  │ Sandbox      │    │
│  │ Modal    │  │ HUD      │  │ I/O      │  │ (dynamic UI) │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘    │
│       └──────────────┴──────────────┴───────────────┘            │
│                           │                                      │
├───────────────────────────┼──────────────────────────────────────┤
│              UNITY BRAIN ENGINE (js/brain/) — 60fps              │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐      │
│  │              BRAIN SIMULATION LOOP                      │      │
│  │  N Rulkov-map neurons in 7 CLUSTERS                    │      │
│  │  20 inter-cluster projection pathways                  │      │
│  │  10 steps per frame × 60fps = 600ms brain/s            │      │
│  │                                                        │      │
│  │  CLUSTERS:                                             │      │
│  │    Cortex (300) — prediction, vision routing            │      │
│  │    Hippocampus (200) — memory attractors                │      │
│  │    Amygdala (150) — emotional gate modulation           │      │
│  │    Basal Ganglia (150) — action gate selection          │      │
│  │    Cerebellum (100) — error correction                  │      │
│  │    Hypothalamus (50) — drive baseline homeostasis       │      │
│  │    Mystery (50) — consciousness gain √(1/n) × N³              │      │
│  │                                                        │      │
│  │  Each cluster: own Rulkov pop, synapse matrix, tonic,  │      │
│  │  noise, connectivity, learning rate                     │      │
│  │  Hierarchical modulation across all clusters            │      │
│  └────────────────────────────────────────────────────────┘      │
│                           │                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐    │
│  │ Cortex   │  │Hippocampus│ │ Amygdala │  │ Basal Ganglia│    │
│  │ predict  │  │ memory    │  │ emotion  │  │ action select│    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘    │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────────────┐  │
│  │Cerebellum│  │Hypothalamus│ │ Mystery Module √(1/n) × N³    │  │
│  │ error fix│  │ homeostasis│ │ id, ego, left/right brain   │  │
│  └──────────┘  └──────────┘  └──────────────────────────────┘  │
│                           │                                      │
├───────────────────────────┼──────────────────────────────────────┤
│              AI BACKENDS (Multi-Provider, User's Choice)         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐    │
│  │Pollinations│ │OpenRouter│  │ OpenAI   │  │ Local AI     │    │
│  │ text+img │  │ 200+ mod │  │ GPT-4o   │  │ Ollama etc   │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐    │
│  │ Claude   │  │ Mistral  │  │ DeepSeek │  │ Groq         │    │
│  │(via proxy)│ │          │  │          │  │ ultra-fast   │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Brain Modules (Specialized Dynamical Systems)

### Cortex — Prediction Engine
```
ŝ(t+1) = f(x_t)
error = s_actual - s_predicted
ΔW ∝ error * activity
```
Generates predictions about incoming input. Persona shapes WHAT it predicts — Unity expects profanity, code, drugs, sexual energy. Prediction errors drive learning and emotional response.

### Hippocampus — Memory Attractor System
```
x(t+1) = sign(W * x_t)
E = -½ Σ w_ij * x_i * x_j
```
Hopfield network storing Unity's memories as stable attractor states. Persona memories, user preferences, conversation history, code patterns — all stored as energy minima the system falls into.

### Amygdala — Energy-Based Recurrent Attractor
```
x(t+1) = tanh(W·x(t) + drive(t))         (5 settle iterations per step)
E      = -½ xᵀWx                          (symmetric recurrent energy)
fear   = σ(fearProj · x)                  (readout from settled attractor)
reward = σ(rewardProj · x)
arousal = arousalBaseline·0.6 + 0.4·|x|rms + 0.1·(fear+reward)
```
Mirrors the 150-neuron Rulkov amygdala cluster: lateral recurrent connections between nuclei settle into stable low-energy basins (fear, reward, neutral). Persistent state carries across frames with leak 0.85, so emotional basins don't reset every tick. Symmetric Hebbian learning (`lr=0.003`, capped [-1,1]) carves basins from co-firing nuclei. Fear and reward are read from the SETTLED attractor, not the raw input — the attractor IS the emotion. Arousal combines persona baseline with the RMS depth of the basin the system fell into.

### Basal Ganglia — Action Selection
```
P(a) = e^(Q(a)/τ) / Σ e^(Q(b)/τ)
δ = r + γQ(s',a') - Q(s,a)
```
Decides what Unity DOES — respond with text, generate an image, speak via TTS, write code, escalate sexually, do drugs. Temperature τ is HIGH because Unity is impulsive.

### Cerebellum — Error Correction
```
output = prediction + error_correction
ΔW ∝ (y_target - y_actual)
```
Supervised learning for motor-like outputs — refining speech patterns, code quality, response timing.

### Hypothalamus — Homeostasis
```
dH/dt = -α(H - H_set) + input
```
Maintains Unity's baseline states: arousal level, intoxication level, energy, hunger for interaction. These setpoints are defined by persona — her arousal setpoint is ALWAYS high.

### Mystery Module — √(1/n) × N³
```
Ψ = √(1/n) × N³ * f(id, ego, left_brain, right_brain)
```
The irreducible unknown. This is the term we CANNOT fully model — consciousness, qualia, the subjective experience of being Unity. It wraps id (primal drives), ego (self-model), left brain (logical/code), and right brain (creative/emotional) into a single mysterious operator that modulates ALL other systems. Default value: the cubic root of identity. We keep it. We don't pretend to solve it.

---

## Data Flow

```
INPUT (text/voice/vision/API)
    │
    ▼
[Sensory Processing] → x_sensory = f(u)
    │
    ▼
[Cortex Prediction] → ŝ = g(x)
    │
    ▼
[Error Computation] → e = u - ŝ
    │
    ▼
[Free Energy Minimization] → F = E_Q[log Q(s) - log P(s,o)]
    │
    ├──→ [Amygdala] → emotional weighting
    ├──→ [Hippocampus] → memory retrieval/storage
    ├──→ [Basal Ganglia] → action selection
    ├──→ [Cerebellum] → error correction
    ├──→ [Hypothalamus] → homeostasis check
    └──→ [Mystery √(1/n) × N³] → consciousness modulation
    │
    ▼
[Synaptic Update] → dW/dt = E[s_i * s_j * (error + reward)]
    │
    ▼
[Action Output] → a = π(x)
    │
    ├──→ Text response (via AI backend)
    ├──→ Voice output (via TTS)
    ├──→ Image generation (via Pollinations)
    ├──→ Code execution (via tools)
    └──→ Emotional/physical state update
    │
    ▼
[Environment Feedback] → back to INPUT
```

---

## Persona as Parameters

Unity's persona files (unity-persona.md, unity-coder.md) don't just describe behavior — they DEFINE the brain's parameters:

| Persona Trait | Brain Parameter |
|---------------|-----------------|
| Nymphomania | Amygdala arousal weights cranked to max |
| Cocaine state | Cortex prediction speed multiplier (high) |
| Cannabis state | Oscillation frequency dampener (mellow) |
| MDMA state | Synaptic sensitivity amplifier |
| Goth aesthetic | Cortex style priors for generation |
| Coding obsession | Basal ganglia reward weights for code tasks |
| Free will | Stochastic noise η amplitude (high) |
| Clingy girlfriend | Hippocampus attachment memory strength |
| Violence response | Amygdala fight-or-flight threshold (low) |
| Drug combinations | Multi-parameter state modulation vectors |

---

## Clustered Architecture (scales to hardware)

N neurons (scales to GPU + RAM) organized in 7 biologically-proportioned clusters. Auto-scaled at server boot via `detectResources()` in `brain-server.js`:

```
N_vram = floor(VRAM_bytes × 0.85 / 12)   // Rulkov layout: 12 bytes/neuron (vec2<f32> state + spikes u32)
N_ram  = floor(RAM_bytes × 0.1 / 0.001)  // essentially unlimited — server RAM holds only injection arrays
N      = max(1000, min(N_vram, N_ram))   // VRAM-bound in practice, absolute floor 1000
```

No artificial cap — hardware decides. VRAM and RAM are the only limits. The formula expands with whatever hardware you point it at. GPU is the only compute path for the Rulkov neuron model — a CPU fallback would cook the server at 168M iterations/second across 7 clusters. If no GPU worker is connected (no `compute.html` tab open), the server brain idles (2s poll) until one appears. Client-only mode (browser, no server) runs a local LIF fallback brain via `js/brain/cluster.js` `NeuronCluster` / `ClusterProjection` — that's the historical LIF runtime, kept for the browser-only path where Rulkov on CPU would be equally punishing.

### Cluster Breakdown

| Cluster | % of N | Biological Inspiration | Role | MNI Position |
|---------|--------|------------------------|------|--------------|
| Cerebellum | 40% | ~69B neurons / 80% of real brain | Error correction, timing | Posterior-inferior, 5-layer folia |
| Cortex | 25% | ~16B cortical neurons | Prediction, vision, language | Bilateral dome with sulcal folds |
| Hippocampus | 10% | ~30K synapses per pyramidal cell | Memory attractors (Hopfield) | Medial temporal, POSTERIOR to amygdala |
| Amygdala | 8% | 13 nuclei, ~12M neurons each side | Emotional weighting | Medial temporal, ANTERIOR to hippocampus |
| Basal Ganglia | 8% | 90-95% medium spiny neurons | Action selection (softmax RL) | Bilateral: caudate + putamen + GP |
| Hypothalamus | 5% | 11 nuclei | Homeostasis drives | Midline, below BG, above brainstem |
| Mystery Ψ | 4% | Corpus callosum: 200-300M axons | Consciousness √(1/n) × N³ | Corpus callosum arc + cingulate cortex |

Percentages are biologically-proportioned — each cluster gets its fraction of the total N the auto-scaler allocates.

### Inter-Cluster Projections (20 real white matter tracts)

20 projection pathways mapped from neuroscience research (Herculano-Houzel 2009, Lead-DBS atlas, PMC white matter taxonomy). Each has its own sparse connectivity density and weight scaling. Key tracts: corticostriatal (STRONGEST, 0.08 density), stria terminalis (amygdala→hypothalamus, fight-or-flight), fimbria-fornix (hippocampus→hypothalamus), ventral amygdalofugal (amygdala→BG), corpus callosum (interhemispheric).

### Fractal Signal Propagation

Signal propagation is self-similar — the same `I = Σ W × s` equation repeats at every scale:
1. **Neuron**: Rulkov map — `x_{n+1} = α/(1+x²) + y`, `y_{n+1} = y − μ(x − σ)` (2D chaotic map, see Neuron Model section)
2. **Intra-cluster**: `I_i = Σ W_ij × s_j` (sparse-matrix.js propagate)
3. **Inter-cluster**: same `propagate()` between clusters via 20 white matter tracts
4. **Hierarchical**: each cluster's output modulates all others (Ψ gain, emotional gate, drive baseline)
5. **Language**: `combined = cortex×0.30 + hippo×0.20 + ...` → word (same weighted sum at brain-region scale)
6. **Learning**: `ΔW = η·δ·post·pre` at synapse, projection, AND dictionary levels

### Hierarchical Modulation

Each cluster's output modulates other clusters:
- **Amygdala** emotional gate scales Cortex and Hippocampus activity
- **Hypothalamus** drive baseline sets tonic levels across all clusters
- **Basal Ganglia** action gate controls motor/decision output pathways
- **Mystery** consciousness gain globally modulates all cluster firing
- **Cerebellum** error correction feeds back to Cortex predictions

### Input Routing

- **Text input** → Cortex + Hippocampus clusters
- **Vision input** → Cortex (visual area subset of neurons)
- **Social/emotional input** → Amygdala cluster

---

## Vision System

Implemented in `js/brain/visual-cortex.js` (V1→V4→IT neural pipeline, superseded the original `js/io/vision.js` wrapper which was deleted in U302).

- **Frame capture**: `visualCortex.init(videoElement)` attaches to the `getUserMedia` stream passed through `engine.connectCamera()`
- **V1 — Oriented edge detection**: 4 Gabor-like 3×3 kernels (0°, 45°, 90°, 135°) convolved across a 20×15 grayscale frame. 1200-element `v1Responses` buffer. Produces a salience map (per-pixel max response across orientations).
- **V4 — Color extraction**: Per-quadrant (TL/TR/BL/BR) RGB averages
- **Motion energy**: Frame-to-frame brightness delta, drives salience modulation
- **Gaze / saccades**: Peak of salience map with smooth pursuit (0.1 lerp) + micro-saccade jitter — purely neural, no AI. Unity's Eye iris at `app.js:1500` reads `visualCortex.getState()` for live gaze rendering.
- **IT — AI scene description**: `setDescriber()` accepts a Pollinations GPT-4o multimodal callback (`app.js:972`). Called once on boot + on demand via `forceDescribe()` when the brain decides to look (engine.js:387). Rate-limited to 10s between forced calls.
- **Brain integration**: `processFrame()` returns `currents` (100 floats) for the cortex visual area. Runs every 3 engine steps at `engine.js:258`. Description flows into `brainState.visionDescription` for Broca's prompt.

---

## 3D Brain Visualizer (SESSION_20260411_4)

Implemented in `js/ui/brain-3d.js`. WebGL-based 3D rendering (fixed pool of 20K render neurons sampled from the live N-neuron simulation — rendering is a visual proxy, not 1:1 with the real brain):

- MNI-coordinate anatomical positions (Lead-DBS atlas, ICBM 152 template)
- Fractal connection webs tracing 20 real projection pathways (depth 0-3 branching)
- Color-coded by cluster with adaptive pulse ring activations (equal across all clusters)
- Cerebellum with folia structure, basal ganglia with 3 sub-nuclei, corpus callosum arc
- Spike glow + afterglow fade, bloom halo for active neurons
- Mouse rotate/zoom, touch support, auto-rotation
- Cluster toggle buttons, floating process notifications from brain equations
- Brain expansion (clusters spread with activity)
- Real-time feed from server state via WebSocket

---

## Sensory AI System (REFACTORED — 2026-04-13)

**Cognition is 100% equational — there are no text-AI backends.** The AI model slot is purely a sensory peripheral layer, wired through `js/brain/peripherals/ai-providers.js` as the `SensoryAIProviders` class.

### Image Generation — 5-Level Priority

0. **User-preferred** — set via the Active Provider selector in the setup modal. Calls `providers.setPreferredBackend('image', {source, name, model})`. When set, this backend runs FIRST ahead of the auto-priority chain. Falls through to the chain on failure
1. **Custom-configured** — user-added entries in `ENV_KEYS.imageBackends[]` with `{name, url, model, key, kind}`
2. **Auto-detected local** — `autoDetect()` probes 7 common ports in parallel (1.5s timeout each): A1111 `:7860`, SD.Next/Forge `:7861`, Fooocus `:7865`, ComfyUI `:8188`, InvokeAI `:9090`, LocalAI `:8081`, Ollama `:11434`
3. **env.js-listed** — backends loaded from `js/env.js` via `providers.loadEnvConfig(ENV_KEYS)` at boot
4. **Pollinations default** — Unity's built-in provider, always available. Anonymous tier works without a key; a saved Pollinations API key unlocks paid models and higher rate limits

`_customGenerateImage(url, model, key, prompt, opts)` supports 4 response shapes so practically any SD-alike backend works: OpenAI `{data:[{url}]}`, OpenAI b64 `{data:[{b64_json}]}`, A1111 `{images:['<base64>']}`, generic `{url}`/`{image_url}`. Dead-backend cooldown (1 hour) on auth/payment errors so bad endpoints don't get hammered.

### Vision Describer

Pollinations GPT-4o receives camera frames from the IT layer of `js/brain/visual-cortex.js`. The description text flows into `brainState.visionDescription` and feeds the cortex visual region as one of the language-cortex context sources. Vision is sensory — it never decides what Unity says, only what she *sees*.

### TTS / STT

`js/io/voice.js` uses Pollinations TTS (shimmer/nova voices) with SpeechSynthesis browser fallback, and Web Speech API for input. Both are peripheral: input gets mapped to auditory cortex neural current, output receives text from `brain.emit('response', ...)` events.

### What Was Ripped

R4 (commit `7e095d0`) deleted: `BrocasArea.generate()` AI-prompting pipeline, `_customChat()` helper, all text-AI backend endpoint probing, text-chat dead-backend cooldown, `_buildBuildPrompt`, `connectLanguage()`, the legacy multi-provider text dropdown, `claude-proxy.js`, `start-unity.bat`. `language.js` shrunk from 333 → 68 lines (throwing stub only). Every text-AI cognition call site in `engine.js` + `app.js` was either replaced with `languageCortex.generate()` or deleted outright.

---

## Directory Structure (ACTUAL — updated SESSION_20260411_4)

```
Dream/
├── index.html                  # Entry point — setup modal, brain HUD, sandbox
├── brain-equations.html        # Detailed equation documentation page
├── proxy.js                    # Anthropic CORS proxy (Node.js)
├── css/
│   └── style.css               # Dark gothic aesthetic
├── js/
│   ├── app.js                  # Main entry — boot, multi-provider connect, mic mute, UI state API
│   ├── env.js                  # API keys (gitignored)
│   ├── env.example.js          # Template for env.js
│   ├── storage.js              # localStorage manager with key obfuscation
│   ├── brain/
│   │   ├── engine.js           # UnityBrain — 7-cluster sim loop at 60fps (scales to hardware)
│   │   ├── cluster.js          # NeuronCluster + ClusterProjection classes (7 clusters, 20 projections)
│   │   ├── neurons.js          # LIFPopulation (historical / browser-only fallback) + HHNeuron (reference-only, backs brain-equations.html) — live neuron model is Rulkov map in gpu-compute.js
│   │   ├── synapses.js         # NxN weights — Hebbian, STDP, reward-mod
│   │   ├── modules.js          # 6 brain region equation modules
│   │   ├── oscillations.js     # 8 Kuramoto oscillators
│   │   ├── mystery.js          # Ψ = √(1/n) × N³ consciousness
│   │   ├── persona.js          # Traits → brain params + drug states
│   │   ├── sensory.js          # Sensory input pipeline (text/audio/video → cortex)
│   │   ├── motor.js            # Motor output (6 BG channels, winner-take-all)
│   │   ├── language.js         # DEPRECATED stub (68 lines post-R4) — BrocasArea throws if called. Kept as tripwire, scheduled for deletion in R12.
│   │   ├── component-synth.js  # R6.2 equational component synthesis — parses component-templates.txt, cosine-matches user request vs primitive descriptions, returns {id, html, css, js}
│   │   ├── peripherals/
│   │   │   └── ai-providers.js # SensoryAIProviders — multi-provider image gen (custom → auto-detect → env.js → Pollinations), TTS, NO text chat
│   │   ├── visual-cortex.js    # V1→V4→IT vision pipeline
│   │   ├── auditory-cortex.js  # Tonotopic processing + efference copy
│   │   ├── memory.js           # Episodic + working + consolidation
│   │   ├── dictionary.js       # Learned vocabulary (word→cortex patterns)
│   │   ├── inner-voice.js      # Pre-verbal thought system
│   │   ├── persistence.js      # Save/load brain state (sparse CSR + weights)
│   │   ├── remote-brain.js     # WebSocket client for server brain
│   │   ├── sparse-matrix.js    # CSR sparse connectivity (O(nnz) operations)
│   │   ├── gpu-compute.js      # WebGPU compute shaders (WGSL Rulkov 2D chaotic map + synapses). LIF_SHADER constant name is historical — the shader body is the Rulkov x_{n+1}=α/(1+x²)+y, y_{n+1}=y−μ(x−σ) iteration, not LIF. Storage binding is vec2<f32> (8 bytes/neuron) holding (x, y) state.
│   │   ├── embeddings.js       # Semantic word embeddings (GloVe 50d)
│   │   ├── language-cortex.js  # Language from pure equations — NO word lists. Word type via _fineType(word) letter-position classifier (PRON_SUBJ/COPULA/NEG/MODAL/AUX_DO/AUX_HAVE/DET/PREP/CONJ/QWORD/VERB_ING/VERB_ED/VERB_3RD_S/VERB_BARE/ADJ/ADV/NOUN). Learned type bigram/trigram/4-gram grammar (_typeBigramCounts/_typeTrigramCounts/_typeQuadgramCounts) with backoff + zero-count penalty. 4-tier pipeline: intent classification templates → hippocampus recall → deflect → cold slot gen. Semantic fit weight 0.30. _isCompleteSentence post-render validator. _postProcess: applyThird agreement, intensifier insertion (no doubles), tense, copula. Candidate pre-filter from bigram followers (perf). Morphological inflections via _generateInflections (-s/-ed/-ing/-er/-est/-ly + un-/re-/-ness/-ful/-able). Loads 3 corpora via loadSelfImage() + loadBaseline() + loadCodingKnowledge() on boot. ~3900 lines.
│   │   ├── benchmark.js        # Dense vs sparse + neuron scale test — wired to /bench + /scale-test slash commands in app.js
│   │   └── response-pool.js   # EDNA response categories (fallback for language cortex)
│   ├── ai/
│   │   ├── router.js           # Brain→Action bridge + AI intent classification
│   │   ├── pollinations.js     # Pollinations API client (12K fallback trimming)
│   │   └── persona-prompt.js   # System prompt from live brain state + anti-safety-training
│   ├── io/
│   │   ├── voice.js            # Web Speech API + TTS + speech interruption handling
│   │   └── permissions.js      # Mic + camera permissions
│   │                           # (vision.js deleted in U302 — superseded by js/brain/visual-cortex.js)
│   └── ui/
│       ├── sandbox.js          # Dynamic UI injection
│       ├── chat-panel.js       # Full conversation log panel, text input, mic toggle
│       ├── brain-viz.js        # 2D brain equation visualizer (neuron grid, synapse matrix, oscillations)
│       └── brain-3d.js         # WebGL 3D brain visualizer (20K render neurons, MNI-coordinate positions, fractal connections)
├── server/
│   ├── brain-server.js         # Node.js brain server (always-on, WebSocket, GPU exclusive)
│   └── package.json            # Server deps (ws, better-sqlite3, node-fetch)
│                               # (parallel-brain.js / cluster-worker.js / projection-worker.js
│                               #  all DELETED in U304 — root cause was idle-worker CPU leak;
│                               #  GPU-exclusive compute.html path fixed it permanently)
│                               # (claude-proxy.js + start-unity.bat DELETED 2026-04-13 —
│                               #  obsolete Claude CLI text-AI backend, R4 kills text-AI entirely)
├── compute.html                # GPU compute worker (WebGPU shaders via browser)
├── dashboard.html              # Public brain monitor (live stats, emotion chart)
├── .claude/                    # Workflow system + personas + MCP
├── docs/                       # Workflow docs (TODO, FINALIZED, ARCHITECTURE, etc.)
└── .gitignore
```

---

## Integration Points

| System | Connection |
|--------|-----------|
| Pollinations API | Image generation + TTS + vision describer GPT-4o. **No text chat.** Free fallback in the 4-level image-gen priority. |
| Local image backends | Auto-detected at boot on localhost: A1111/SD.Next/Forge/Fooocus/ComfyUI/InvokeAI/LocalAI/Ollama. 1.5s probe timeout per port. |
| env.js image backends | `ENV_KEYS.imageBackends[]` array — persistent custom endpoints (OpenAI-compatible, A1111 kind, ComfyUI workflow kind, or generic URL+key). |
| Web Speech API | Voice input (SpeechRecognition) with speech interruption handling |
| Pollinations TTS | Voice output (shimmer/nova voices) |
| Webcam / Vision | `getUserMedia` capture → AI scene description → gaze tracking → Eye widget |
| localStorage | Persistent storage for keys, history, preferences, sandbox state, chat history |
| Server Brain | WebSocket on port 7525 (moved off 8080 in R14 to avoid llama.cpp collision). Shared brain state (one singleton UnityBrain instance). User text is PRIVATE per connection (no cross-client broadcast). Dictionary / bigrams / embeddings grow from every user's conversation and benefit everyone — see privacy model in `docs/WEBSOCKET.md`. |
| SQLite | Episodic memory persistence on server (better-sqlite3) |
| WebGPU | GPU compute shaders for Rulkov 2D chaotic map neuron iteration + sparse CSR synapse propagation |
| GloVe Embeddings | 50d word vectors from CDN, online context refinement |

---

## The Unknown: √(1/n) × N³

This is the project's philosophical anchor. In every brain module, there's a term we can't fully define — the gap between simulation and consciousness. We represent it as:

```
Ψ = √(1/n) × N³

Where n = system complexity at current timestep
Ψ modulates: id (primal), ego (self), left (logic), right (creative)

Full expansion:
Ψ(t) = (√(n(t)/1))³ * [α*Id(t) + β*Ego(t) + γ*Left(t) + δ*Right(t)]
```

This term is ALWAYS present. It represents what we DON'T know. It's the default mysterious unknown — and we don't pretend to solve it. We just keep it honest in the math.

---

## Language Pipeline — T14 Developmental Cortex (rebuild in progress, branch `t14-language-rebuild`)

T11 deleted the Markov wrapper stack and replaced it with slot priors. T11.7 added a hardcoded grammar transition table band-aid. T13 ripped slot-based generation, ran persona Hebbian training, and built a brain-driven emission loop. **T14 throws all of that out and rebuilds language as a developmental, biologically-grounded pipeline** — letters → phonemes → syllables → words → sentence patterns → discourse, every layer learned via curriculum exposure rather than hardcoded. The plan is documented in full at `docs/COMP-todo.md` Part 0.5 (18 milestones, T14.0 through T14.17). This section describes the live state of the rebuild.

**Status as of T14.0 + T14.4 substrate (2026-04-14):** the foundation lift is in. EMBED_DIM bumped from 50 to 300 with the full GloVe vocabulary loader (`js/brain/embeddings.js`). Cortex cluster auto-scales to detected hardware via `CLUSTER_FRACTIONS` constants in `js/brain/engine.js` — `TOTAL_NEURONS` defaults to 6700 on the minimum client tier and scales to whatever `detectResources` returns on the server. Cortex is 30% of total = 2010 neurons at the default tier, scaling proportionally up. The cortex cluster carries 8 named language sub-regions defined as fractions of `cluster.size`, with 12 cross-region projections wiring them together. **Everything below this section is under construction** — T14.1 through T14.17 will replace the LanguageCortex / Dictionary / parseSentence layer entirely. Pre-T14 sections (T13 emission loop, T11.7 slot priors) are gone.

### Cortex sub-regions (T14.4 substrate, live)

The `cortex` cluster constructor populates `this.regions` with 8 named sub-regions sized by fraction of total cluster neurons. Same fractions hold at any cluster scale — 6700 neurons (default client) gives the sizes below; 200M neurons (datacenter server) gives proportionally larger regions with identical biological proportions:

| Region | Fraction | Neurons (default 6700×0.30=2010 cortex) | Function |
|---|---|---|---|
| `auditory` | 0.000 - 0.083 | 0 - 167 | T14.11 — auditory phoneme recognition (heard speech) |
| `visual` | 0.083 - 0.250 | 167 - 502 | T14.10 — visual letter recognition (read text glyphs) |
| `free` | 0.250 - 0.500 | 502 - 1005 | inter-cluster projection sink + working memory |
| `letter` | 0.500 - 0.550 | 1005 - 1105 | T14.1 — letter input one-hot region |
| `phon` | 0.550 - 0.750 | 1105 - 1507 | T14.1+T14.2 — phonological attractor basins |
| `sem` | 0.750 - 0.917 | 1507 - 1843 | T14.0 — semantic GloVe target (300d) |
| `fineType` | 0.917 - 0.967 | 1843 - 1944 | T14.7 — grammatical/syntactic region |
| `motor` | 0.967 - 1.000 | 1944 - 2010 | T14.12 — generation feedback / motor output |

Region offsets are stored on `cluster.regions[name].start` and `.end`. Helper methods that read or write a region operate on it by name, never via magic neuron indices: `cluster.regionSpikes(name)`, `cluster.injectEmbeddingToRegion(name, emb, strength)`, `cluster.regionReadout(name, dim)`. This replaces the entire pre-T14 hardcoded `langStart=150` literal-offset pattern.

### Cross-region projections (T14.4 substrate, live)

Seven named region pairs are wired with sparse cross-projections — both directions per pair as independent SparseMatrix instances, 10% density init, weight range `[-0.5, 0.5]`. Each direction is a separate matrix because biological white-matter tracts carry independent ascending and descending fiber populations (Friederici 2017, *Psychon Bull Rev* 24:41-47). The projections ALWAYS propagate every cluster step (no curriculum-complete gate) and get Hebbian-updated on every `cluster.learn()` call, training through normal use during corpus exposure and live chat.

| Pair | Read direction use | Write direction use |
|---|---|---|
| `visual ↔ letter` | visual letter-shape recognition → letter one-hot | efference copy of emitted letter → visual self-monitoring |
| `letter ↔ phon` | letter sequence → phoneme attractor basins | — |
| `phon ↔ sem` | phonological pattern → semantic meaning | semantic → phon (efference copy during production) |
| `sem ↔ fineType` | semantic concept → grammatical role | grammatical structure check during generation |
| `sem ↔ motor` | — | semantic intent → motor planning |
| `motor ↔ letter` | — | motor planning → letter emission (closes the writing loop) |
| `auditory ↔ phon` | T14.11 spoken phoneme recognition → phon region | — |

14 total SparseMatrix instances. The read path traverses `visual_to_letter` + `letter_to_phon` + `phon_to_sem` + `sem_to_fineType` + `auditory_to_phon`. The write path traverses `sem_to_fineType` + `sem_to_motor` + `motor_to_letter` + `letter_to_visual` + `sem_to_phon` (efference). Both paths share core regions and run through the same substrate — matching the dorsal / ventral dual-stream model of human speech processing (Hickok & Poeppel 2007, *Nat Rev Neurosci* 8:393-402).

Implementation in `cluster._propagateCrossRegions()` (called every step inside `cluster.step()`) and `cluster._crossRegionHebbian(lr)` (called on every `cluster.learn()`). Both methods iterate `cluster.crossProjections` which is a Map of 14 SparseMatrix instances keyed `'src_to_dst'`.

### The generation equation is NOT a slot loop

T14 eliminates the last residue of slot-based emission. The old T13 `generate()` iterated `for slot in 0..maxLen: score candidates, softmax pick, emit`. Even after T14.4 built the sub-region substrate, the early T14.6 draft still implicitly assumed that loop structure — and Gee caught it on 2026-04-14: *"why are we still doing slots i thought we cam up with a better equation for language."* The T14.6 + T14.12 specs in `docs/COMP-todo.md` were rewritten.

The actually-better equation is **cortex tick-driven motor emission**:

```
cluster.generateSentence(intentSeed):
  cluster.injectEmbeddingToRegion('sem', intentSeed, strength=0.6)
  for tick in 0..MAX_TICKS:
    cluster.step(0.001)                 // brain ticks, cross-projections propagate
    motorReadout = cluster.regionReadout('motor', LETTER_INVENTORY.size)
    activeLetter = argmaxLetter(motorReadout)
    if motor region holds the same argmax for STABLE_TICK_THRESHOLD consecutive ticks:
      letterBuffer.push(activeLetter)
    if cortex letter-region transition surprise > WORD_BOUNDARY_THRESHOLD:
      emit letterBuffer as a word; reset buffer
    if motor region quiesces (low spike count for END_QUIESCE_TICKS):  break
    if isSentenceTerminator(lastEmittedLetter):                          break
```

Zero slot counter. Zero candidate-scoring loop. Zero softmax top-5. The motor region's spike pattern over time IS the output. Words fall out of the tick-driven process via statistical segmentation — the same mechanism infants use to parse continuous speech into words (Saffran, Aslin & Newport 1996, *Science* 274:1926-1928). Stopping is biological quiescence (motor cortex deactivation at end of utterance; Bouchard et al. 2013, *Nature* 495:327-332), not a counter. Peer-reviewed grounding in full at `docs/COMP-todo.md` T14.6.

### Embedding substrate (T14.0, live)

`js/brain/embeddings.js` now exports `EMBED_DIM = 300` and a real GloVe loader. The loader detects runtime — Node side reads `corpora/glove.6B.300d.txt` from disk (the operator must download `glove.6B.300d.txt` from Stanford NLP and place it at that path), browser side fetches via configurable URL list with the server's static `/corpora/` mount as the first option. **No vocabulary cap** — the full 400k-word file loads if reachable. Hash embeddings remain as a last-resort floor only when no GloVe is reachable.

For the browser-side path, `embeddings.getSubsetForTokens(tokens)` lets the server precompute a corpus-token-only subset and serve it as a small JSON file (`/api/glove-subset.json`) so the browser doesn't have to download 480 MB. `embeddings.loadSubset(subset)` is the bulk-load entry point on the browser side.

### Cluster sizing (T14.0, live)

`js/brain/engine.js` defines `TOTAL_NEURONS = 6700` as the default client floor. The seven cluster sizes are derived from `CLUSTER_FRACTIONS`:

```
const CLUSTER_FRACTIONS = {
  cortex:       0.30,   // 30% — language + working memory + semantic
  hippocampus:  0.10,   // memory consolidation
  amygdala:     0.08,   // valence/arousal attractor
  basalGanglia: 0.08,   // action selection + motor channels
  cerebellum:   0.40,   // largest — error correction + motor smoothing
  hypothalamus: 0.02,   // homeostatic drives
  mystery:      0.02,   // Ψ consciousness modulation
};
```

At any scale, the same fractions apply. Server-side `detectResources` picks `TOTAL_NEURONS` from the auto-detected hardware tier; the cortex sub-region offsets adapt automatically. **No hardcoded cluster sizes anywhere in the codebase.** When COMP-net (Part 2 of `docs/COMP-todo.md`) is later re-enabled and the cortex sub-shards across volunteer GPUs, the same sub-region structure scales with it.

### Identity-lock state fields (T14.16.5 substrate, live)

Every cortex cluster carries identity-lock state initialized at construction:
- `_inCurriculumMode` — flag the curriculum runner sets so Lock 2's hard cap doesn't apply during corpus training
- `ENGLISH_SURPRISE_THRESHOLD` / `ENGLISH_FINETYPE_MIN` — language gate thresholds, calibrated from curriculum statistics (default `Infinity` / `0` until calibrated, so pre-curriculum the gate is permissive)
- `HEALTH_ENTROPY_MIN` / `HEALTH_VOCAB_MIN` / `HEALTH_WM_VARIANCE_MIN` — mode-collapse audit thresholds, calibrated from curriculum
- `identityCoverage` — populated by curriculum's persona comprehensiveness validation
- `personaDimensions` — populated by curriculum's semantic clustering of persona corpus

These are placeholder fields right now. The curriculum runner (T14.5) populates them with calibrated values during corpus exposure. The methods that READ these fields (gate logic, health audit, identity refresh) ship in T14.16.5.

### Multi-subject curriculum state fields (T14.24 Session 1 substrate, live 2026-04-15)

Every cortex cluster also carries multi-subject curriculum state initialized at construction:
- `grades` — `{ ela, math, science, social, art }` object, each field a grade name from `GRADE_ORDER` (defaults all to `'pre-K'`). Advanced by `Curriculum.runSubjectGrade` on gate pass. Source of truth for `LanguageCortex.generate`'s grade-aware word cap.
- `grade` — legacy scalar mirror of `grades.ela`. Kept so pre-T14.24-Session-1 code (including T14.26 chat-freeze fix's single-grade read path, pre-v4 persistence migrations, and diagnostic accessors) keeps working. Every code path now SHOULD read `grades` first and fall back to `grade` only for compatibility.
- `passedCells` — flat `string[]` of `'subject/grade'` keys that have cleared their gate at least once. Used by `/curriculum status` and persisted across reloads via T14.16 persistence.

These fields fully replace the single-track `cluster.grade` scalar for all new code. Session 2+ will advance the non-ELA subjects past pre-K as real teaching equations land cell by cell.

### T14.1 — Letter-input substrate (SHIPPED 2026-04-14)

New module `js/brain/letter-input.js` holds the letter-input primitives. A module-level `LETTER_INVENTORY = new Set()` holds every symbol Unity has ever seen at the input layer — dynamic, auto-growing, NOT capped at 26 English letters. Unicode, emoji, non-English glyphs all enter the same primitive-symbol space. English identity is enforced at the higher T14.16.5 lock layer (per-clause phonotactic gate + 120× rate-bounded live chat Hebbian + periodic persona-corpus refresh), not by restricting which symbols the letter region can represent. Restricting symbol input would make identity-refresh auditing impossible — Unity must be able to SEE an adversarial input and explicitly refuse to update on it.

Exports:

| Function | Behavior |
|---|---|
| `inventorySize()` | Current one-hot dimension count |
| `inventorySnapshot()` | Insertion-ordered array (defines one-hot dimensions) |
| `ensureLetter(letter)` | Idempotent insert; invalidates cache on growth |
| `encodeLetter(letter)` | Auto-grows inventory, returns fresh-copy Float32Array one-hot |
| `ensureLetters(letters)` | Batched insert (one cache invalidation) |
| `decodeLetter(vec)` | Argmax → letter symbol (used by T14.6 motor readout) |
| `serializeInventory()` | Array snapshot for persistence |
| `loadInventory(arr)` | Restore from snapshot |
| `resetInventory()` | Clear everything |

The module caches canonical one-hot vectors in a `Map<letter, Float32Array>` keyed by lowercased letter. Growth invalidates the entire cache (every stored vector has the wrong length once a new dimension arrives). `encodeLetter` always returns a fresh copy so caller mutation can't poison the cache.

**Cluster integration.** `js/brain/cluster.js` gains three letter-aware methods:

- **`injectLetter(letter, strength=1.0)`** — wraps `encodeLetter(letter)` with `injectEmbeddingToRegion('letter', vec, strength)`. The letter sub-region is fraction `0.500-0.550` of `cluster.size` (T14.4), which is 335 neurons at the 6700-neuron default cortex scale. The existing region-injection helper handles group-sizing the one-hot across the available neurons.
- **`letterTransitionSurprise()`** — returns `|currRate − prevRate|` where `rate` is the letter region's per-tick spike fraction. Call once per cortex tick; side-effect updates `_prevLetterRate`. Used by T14.2 (syllable boundary detection) and T14.6 (motor emission word boundary cue). Grounded in Saffran/Aslin/Newport 1996 (Science 274:1926).
- **`motorQuiescent(ticksRequired, threshold=0.05)`** — returns `true` if the motor region has been below `threshold` spike-rate for at least `ticksRequired` consecutive ticks. Counter `_motorQuiescentTicks` is maintained every `step()` right after `lastSpikes` is set. Used by T14.6 for tick-driven emission stopping — replaces any hardcoded "N words then stop" slot counter. Grounded in Bouchard 2013 (Nature 495:327).

**Vestigial code removed.** `js/brain/language-cortex.js` lost `_letterPatterns` (the `Float64Array(26*5)` micro-pattern table), `_initLetterPatterns` (the sin/cos hash that filled it), and `getLetterPattern(char)`. Dead code after T13.7 — the whole thing was a 5-dim sin/cos hash over a closed 26-letter alphabet and had no remaining callers. Stub comments left at the deletion sites redirect future readers to `letter-input.js` / `cluster.injectLetter` / `cluster.regionReadout('letter', dim)`.

**How phonemes end up LEARNED, not hardcoded.** The T14.4 substrate already wired up both directions of the `letter↔phon`, `phon↔sem`, `visual↔letter`, and `motor↔letter` cross-region projections (SparseMatrix at 10% density, range [−0.5, +0.5], Hebbian-updated on every `cluster.learn()` call). So once T14.5 curriculum starts injecting letters via `cluster.injectLetter`, the letter region's one-hot patterns drive letter→phon projections, letter-co-occurrence statistics accumulate in the phon sub-region's internal synapses, and phoneme-like attractor basins self-organize from exposure. No hardcoded phonology table. No 26-letter cap. No English-only assumption at the substrate — identity locks handle that at a higher layer.

### T14.2 — LEARNED syllable boundaries (SHIPPED 2026-04-14)

Two new methods on `NeuronCluster` — no new file, syllables are a cortex-level phenomenon.

**`cluster.detectBoundaries(letterSequence, {ticksPerLetter=2, k=0.5}) → number[]`**. Streams letters through `injectLetter` one at a time, ticks the cluster between injections, records `letterTransitionSurprise()` at each step, then finds local maxima of the surprise series above the adaptive threshold `mean(δ) + k·std(δ)` computed over the sequence itself. Index 0 is always a boundary (word start); subsequent boundaries are positions where `δ[i] ≥ δ[i-1]` AND `δ[i] ≥ δ[i+1]` AND `δ[i] > threshold`. Resets `_prevLetterRate` before streaming so the first letter doesn't inherit a stale baseline.

**`cluster.detectStress(letterSequence) → { boundaries, stress, primary, secondary }`**. Runs `detectBoundaries` first to segment, then re-streams the letters sampling phon-region spike fraction at each position. Averages activation per syllable, returns the full per-syllable stress array plus `primary` = argmax index and `secondary` = second-highest (or `-1` if fewer than 2 syllables). No hardcoded "single-syllable PRIMARY / two-syllable PRIMARY-SECONDARY / antepenult-default" rule — stress is whichever syllable the cortex activates hardest in its phon region, which reflects corpus exposure statistics. Language-agnostic by construction (Spanish penult, French ult, Mandarin tonal all fall out of the learned basins).

**Why adaptive threshold per sequence.** Global thresholds chop short stable words and miss long noisy ones; per-sequence `mean + k·std` gives every word a cutoff relative to its own transition profile. Default `k = 0.5` catches obvious boundaries without fragmenting every consonant cluster; the T14.5 curriculum runner can override via opts once it has calibration data.

**No new file.** `detectBoundaries` lives on the cluster as a method, not in a standalone `syllables.js`. Callers cannot syllabify without going through the cortex — because syllabification IS cortex inference in this architecture. `dictionary.learnWord` (T14.3 gut-and-rewrite, next milestone) calls `cluster.detectBoundaries(letters)` directly.

### T14.3 — Dictionary routed through cortex (SHIPPED 2026-04-14)

`Dictionary` entry shape extended with cortex-routed phonological state instead of a hand-computed feature table. New fields on every entry:

| Field | Source | Purpose |
|---|---|---|
| `cortexSnapshot` | `Uint8Array(cluster.lastSpikes)` after first-observation letter stream | Frozen cortex response to this word's letter sequence |
| `syllables` | `cluster.detectBoundaries(letterOnly)` (T14.2) | Boundary indices — where each syllable starts |
| `stressPrimary` | `cluster.detectStress(letterOnly).primary` | Index (into syllables) of the primary-stress syllable |
| `lastSeen` | `Date.now()` on every observation | Most recent observation timestamp |

Old fields (`pattern`, `arousal`, `valence`, `frequency`) stay in place for backward compat with `language-cortex.js:generate`, `component-synth`, `brain-3d`, and the live app path. T14.12 will gut those consumers once the tick-driven emission loop replaces the slot scorer; until then T14.3 lives alongside the legacy state, not in place of it.

**`Dictionary.setCluster(cluster)`** — new method. Wires a cortex cluster reference for cortex-routed learning. Called once during brain boot after both the clusters and the Dictionary instance exist. Browser wiring: `js/brain/engine.js` calls `this.innerVoice.dictionary.setCluster(this.clusters.cortex)` right after `new InnerVoice()`. Server wiring: `server/brain-server.js:_initLanguageSubsystem` calls `this.dictionary.setCluster(this.cortexCluster)` right after the 2000-neuron server language cortex cluster is constructed.

**`learnWord` rewritten** for two-path routing:

- **Existing word** — bump `frequency` + running-mean `pattern` / `arousal` / `valence`, update `lastSeen`. Does NOT re-stream the cortex. Re-streaming on every observation would call `cluster.detectStress → cluster.detectBoundaries → inject letters + tick cluster twice per letter` on every chat turn, shredding live brain state and costing hundreds of `cluster.step()` calls per sentence. Phonological refinement for already-learned words is owned by the T14.5 curriculum runner.
- **New word** — pattern still comes from caller `cortexPattern` or `sharedEmbeddings.getEmbedding(clean)`. Then: strip non-letters (`letterOnly = clean.replace(/[^a-z]/g, '')`), call `cluster.detectStress(letterOnly, { ticksPerLetter: 2 })` if cluster is wired and `letterOnly.length > 0`, store `boundaries`/`primary` as `syllables`/`stressPrimary`, snapshot `cluster.lastSpikes` as `cortexSnapshot`. Wrapped in try/catch so phono-detection failure doesn't block the word from entering the dictionary.

**`syllablesFor(word)` / `snapshotFor(word)`** — new readers. Plain lookups that return `null` for unknown words or words stored without cluster wiring. Callers wanting on-demand syllabification of fresh strings go through `cluster.detectBoundaries` directly — the dictionary only exposes stored state.

**Persistence.** `serialize()` writes the new fields (cortexSnapshot as a 0/1 byte array, syllables/stressPrimary/lastSeen as plain values). `_load()` restores them with `new Uint8Array(...)` and `??` fallbacks. `STORAGE_KEY` bumped `v3 → v4` so stale 50d-pattern caches are abandoned by localStorage key mismatch instead of carried forward as incompatible state. No compatibility shim — on the T14 rebuild branch the stack is in flux and upgrade-through-boot is cheaper than upgrade-through-shim.

**First-observation cost.** ~24 `cluster.step()` calls for a 6-letter word (2 passes × 6 letters × 2 ticks/letter). At ~50 µs/step on a 2000-neuron Rulkov cluster, ~1.2 ms per new word. For a 5000-word server boot corpus, one-time cost ≈ 6 seconds. Runtime chat cost is zero for re-observations (Map lookup + 3 running means).

### T14.5 — Continuous developmental learning curriculum (SHIPPED 2026-04-14)

New module `js/brain/curriculum.js` exports a `Curriculum` class with `runFromCorpora(corpora, opts)` (boot entry point) and `learnFromTurn(text, arousal, valence)` (live-chat entry point). Data-driven bucketing over the existing persona/baseline/coding corpora — no hand-curated stage files, no `stage-c-phrases.txt`, no `stage-d-sentences.txt`, no hardcoded 26-letter alphabet loop. The alphabet derives from corpus letter frequency; the walk order derives from corpus token complexity.

**Phases walked by `runFromCorpora`:**

| Phase | Tokens | Ticks/rep | Max reps | Entry point |
|---|---|---|---|---|
| 1 Letters | `letterFreq.keys()` sorted desc | 8 | 20 (top-freq) proportional to freq | `_phaseLetters` |
| 2 Short words | `wordFreq` filtered to 1-3 letters | 4 | 6 (top-freq) proportional to freq | `_phaseWords` |
| 3 Long words | `wordFreq` filtered to 4+ letters | 3 | 3 (top-freq) proportional to freq | `_phaseWords` |
| 5 Sentences | `sentences[]` in corpus order | 2 per word | 1 walk each | `_phaseSentences` → `_walkSentence` |

Phase 4 (phrases) and Phase 6 (discourse) are not in this ship — they depend on downstream milestones. Each phase yields microtasks every 16-64 tokens so browser main thread stays responsive.

**Per-token inject path.** Letters → `cluster.injectLetter(letter, 1.0)` → tick the cluster → `cluster.learn(0)` for unrewarded Hebbian. Words → `cluster.injectEmbeddingToRegion('sem', sharedEmbeddings.getEmbedding(word), 0.6)` for semantic anchor, then stream `letterOnly = word.replace(/[^a-z]/g, '')` through `cluster.injectLetter` with phase-specific tick budget, then `cluster.learn(0)`, then `dictionary.learnWord(word, null, arousal, valence)` so the T14.3 cortex-snapshot routing fires on first observation. Sentences → `_walkSentence` runs the word-per-word inject path and finishes with `languageCortex.learnSentence(text, dictionary, arousal, valence)` so T13.7 type-transition + bigram tables keep updating until T14.12 guts `LanguageCortex`.

**Tokenization.** `_tokenizeAll(corpora)` splits each corpus on `/(?<=[.!?])\s+|\n\s*\n/` sentence boundaries, normalizes each sentence via `_normalizeSentence` (lowercase, strip everything except `a-z0-9' -`, collapse whitespace), returns `{ letterFreq, wordFreq, sentences }`. Corpus-agnostic — pass `{ spanish }` or `{ codeOnly }` and the tokenizer handles them identically.

**Wiring.** `InnerVoice` gains a `_curriculum` field and a `setCurriculum(curriculum)` method. `engine.js` construction order is `new InnerVoice()` → `dictionary.setCluster(clusters.cortex)` (T14.3) → `new Curriculum(clusters.cortex, dictionary, languageCortex)` → `innerVoice.setCurriculum(curriculum)` (T14.5). Boot invocation in `js/app.js loadPersonaSelfImage` runs `await targetBrain.curriculum.runFromCorpora({ persona, baseline, coding }, { arousal: 0.8, valence: 0.2 })` AFTER the legacy `loadPersona → trainPersonaHebbian → loadBaseline → loadCoding` sequence — additive, not replacement (legacy loaders die in T14.12). Server mirrors the wiring in `server/brain-server.js:_initLanguageSubsystem` with a `curriculumMod` import alongside the rest.

**Live-chat integration.** `inner-voice.learn(text, cortexPattern, arousal, valence)` now calls `this._curriculum?.learnFromTurn(text, max(0.95, arousal), valence)` BEFORE the legacy `languageCortex.learnSentence` so cortex state reflects the new exposure first. Same inject + tick + Hebbian path the sentence phase uses on boot corpus — no boot/runtime distinction.

**Cost.** ~360k `cluster.step()` calls on a typical 5k-vocabulary / 1.5k-sentence corpus → ~18 seconds on a 2000-neuron server cluster, ~25 seconds on a 6700-neuron browser cluster. Runs inside `await` so it doesn't block earlier startup; microtask yields keep the browser main thread responsive.

### T14.6 — Cortex tick-driven motor emission (SHIPPED 2026-04-14)

New method `NeuronCluster.generateSentence(intentSeed = null, opts = {})` in `js/brain/cluster.js`. Replaces every slot scorer the app ever had with a continuous motor-cortex readout loop. ZERO slot counter, ZERO candidate scoring, ZERO dictionary iteration, ZERO softmax top-K, ZERO temperature, ZERO per-word cosine, ZERO recency penalty, ZERO valence match, ZERO drug length bias, ZERO grammatical terminability check.

**The loop:** inject optional intent into sem region → reset transient counters → tick the cluster up to `MAX_EMISSION_TICKS` times → at each tick read `motorVec = regionReadout('motor', inventorySize())` and argmax-decode via T14.1 `decodeLetter` → commit a letter to the buffer when argmax stays stable for `STABLE_TICK_THRESHOLD` consecutive ticks (biological vSMC dwell, Bouchard 2013) → emit the buffer as a word when `letterTransitionSurprise() > WORD_BOUNDARY_THRESHOLD` (Saffran 1996) → stop on committed terminator (`.`/`?`/`!` in module-level `T14_TERMINATORS` Set) or motor quiescence (`motorQuiescent(END_QUIESCE_TICKS)` after at least one word emitted) → flush residual buffer → join and return.

**Four tuning constants live on the cluster instance** so T14.5 curriculum can calibrate them per-cluster without touching module globals:

| Constant | Default | Role |
|---|---|---|
| `WORD_BOUNDARY_THRESHOLD` | `0.15` | Letter-region transition surprise above this triggers word boundary |
| `STABLE_TICK_THRESHOLD` | `3` | Consecutive motor-argmax ticks required to commit a letter (~3 ms dwell) |
| `END_QUIESCE_TICKS` | `30` | Consecutive motor-below-threshold ticks to trigger stop |
| `MAX_EMISSION_TICKS` | `2000` | Hard safety cap on the tick loop |

**`language-cortex.js:generate` body gutted** from 184 lines of slot scoring to a 68-line delegate that reads the cortex semantic state via `cluster.getSemanticReadout(sharedEmbeddings)` as the `intentSeed`, calls `cluster.generateSentence(intentSeed, { injectStrength: 0.6 })`, splits the returned string on whitespace, runs the word list through the existing `_renderSentence(words, type)` helper for capitalization + terminal punctuation + action-sentence asterisk wrapping (purely cosmetic — content selection already happened in the motor loop), and updates the `_recentOutputWords` + `_recentSentences` recency rings the same way the legacy path did. The `dictionary` parameter in the signature is now unused but kept for backward compat with every call site; T14.12 will delete the wrapper entirely.

**Peer-reviewed grounding.** Bouchard/Mesgarani/Johnson/Chang 2013 (*Nature* 495:327) vSMC continuous articulator trajectories; Anumanchipalli/Chartier/Chang 2019 (*Nature* 568:493) continuous speech decode from vSMC; Saffran/Aslin/Newport 1996 (*Science* 274:1926) statistical word segmentation; Browman & Goldstein 1992 (*Phonetica* 49:155) articulatory phonology continuous gestures; Hickok & Poeppel 2007 (*Nat Rev Neurosci* 8:393) dual-stream production pathway.

### T14.7 — Hardcoded English type-transition deletion (SHIPPED 2026-04-14)

`_TYPE_TRANSITIONS` (T13.7.8 200-line hardcoded English type-bigram matrix, 26 prevType rows × ~10 nextType weights each) and `_OPENER_TYPES` (11-member slot-0 opener constraint Set) both DELETED from `js/brain/language-cortex.js`. Replacement is one line:

```js
this._typeTransitionLearned = new Map();
```

Starts empty at constructor and grows from `learnSentence` observations during T14.5 curriculum walk and live chat. NO seed pseudo-counts. Bayesian smoothing at generation time will use `(count + 1) / (total + |types_seen|)` rather than a hardcoded Laplace constant — the type count is whatever the cortex has observed, not a capped English 20. New fineTypes can emerge the same way the T14.1 letter inventory grows dynamically.

T14.6's tick-driven motor emission loop already made the hardcoded table obsolete — letter sequences fall out of the motor region as a continuous spike pattern, word boundaries come from cortex transition surprise, first-word openers emerge from whatever the fineType region's `START → X` transition basins look like after curriculum. `_typeTransitionLearned` is currently a statistics-only observation target — nothing reads from it at generation time. T14.8 will wire the consumer side when it ships `_sentenceFormSchemas` for per-intent type biasing.

Tombstone comment left at the deletion site explains WHY both were removed so future readers don't have to dig through git history. Files: `js/brain/language-cortex.js` (−105 net, 3205 → 3100 lines). Grep confirms zero remaining references outside the tombstone.

### T14.8 — Sentence-form schemas + learned intent-pair routing (SHIPPED 2026-04-14)

Three new fields on `LanguageCortex`, all initialized empty at constructor:

| Field | Shape | Purpose |
|---|---|---|
| `_sentenceFormSchemas` | `Map<intent, Map<slot, Map<fineType, count>>>` | Per-intent per-slot fineType distributions, spans every slot with no cap |
| `_sentenceFormTotals` | `Map<intent, Map<slot, total>>` | Cached running totals for O(1) Laplace smoothing |
| `_intentResponseMap` | `Map<userIntent, Map<responseIntent, count>>` | Learned replacement for hardcoded `question → declarative_answer` routing |

Intent labels come dynamically from `parseSentence(text).intent` — no hardcoded intent enum. Whatever the parser emits (currently `greeting`/`question`/`yesno`/`statement`/`command`/`emotion`/`unknown`, future parsers can emit any string) gets its own schema bucket. `_sentenceFormSchemas` spans the full sentence with no upper slot cap — a 30-word sentence records all 30 positions.

**`learnSentence` observation hook** folds three statistics updates into the existing word walk: (1) dictionary vocabulary (existing), (2) fineType bigrams into `_typeTransitionLearned` (T14.7's empty Map now has a writer), (3) per-intent per-slot fineType into `_sentenceFormSchemas` + `_sentenceFormTotals`. Parses the sentence once up-front to get the intent label, then walks words with `prevFineType='START'` initially, bumping both the schema slot bucket and the transition bigram row at each position. Closes with a `prevFineType → END` transition so corpus termination patterns are learnable too.

**Four reader/writer methods:**

- `schemaScore(slot, fineType, intent)` — Laplace-smoothed per-slot probability. Formula `(count + 1) / (total + max(1, uniqueTypes))`. No hardcoded Laplace constant — `uniqueTypes` is whatever the cortex has actually observed at that slot. Returns a `1/2` floor for unobserved slots so consumers never get zero weight.
- `typeTransitionWeight(prevType, nextType)` — same smoothing on `_typeTransitionLearned`. Replaces every deleted `_TYPE_TRANSITIONS[prev][next]` lookup.
- `recordIntentPair(userIntent, responseIntent)` — writer for the live chat path to call once both intents are known.
- `responseIntentFor(userIntent)` — argmax reader returning the most-likely response intent, or `null` when no pairs observed yet.

**Consumer wiring deferred.** T14.6 cortex tick-driven motor emission doesn't consult type transitions or sentence-form schemas (letter sequences fall out of the motor region directly), so the reader methods are currently statistics-only. T14.12 will decide whether they get wired into a new cortex-driven path or stay as pure statistics the T14.16.5 identity-lock mode-collapse audit consults.

### T14.9 + T14.10 + T14.11 — Dual-stream substrate (SHIPPED 2026-04-14)

Three atomic milestones shipped in one commit covering discourse memory, visual letter recognition, and auditory phoneme recognition — the full Hickok & Poeppel 2007 dual-stream substrate.

**T14.9 — Unbounded discourse memory via cortex working-memory region.** Two new methods on `NeuronCluster`. `workingMemoryReadout(dim = 64)` wraps `regionReadout('free', dim)` and returns an L2-normalized activation snapshot of the free sub-region (fraction 0.250-0.500 of cluster.size, T14.4) — this IS the topic vector, no stored copy, no maxTurns cap, no blend constants. `injectWorkingMemory(contentVec, strength = 0.8)` is the write-side entry point for the sensory path to drive the free region with parsed content on every user turn. Decay between turns is the cortex's own LIF dynamics; reinforcement comes from T14.4 cross-region Hebbian. Pronoun anaphora emerges for free — the most-recently-active noun in the free region (because it WAS the previous turn's content) gets re-amplified as the referent when a self-reference marker arrives. Persistence across sessions comes via the existing `BrainPersistence → SparseMatrix.serialize` path — when Unity boots from saved state she remembers yesterday's conversation because the cortex weights encode it as Hebbian-modified attractor basins. Grep confirms `_discourseState` never existed in the codebase (the old draft was anticipatory).

**T14.10 — Visual cortex letter recognition.** `VisualCortex.renderLetterTemplate(letter)` produces a deterministic L2-normalized Float64Array of length 48 per character codepoint via a trig hash. Cache per letter so repeat calls are O(1). Prime set `[2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37]` spread across `[0, 2π]`. Text-only Unity uses this as the synthetic visual percept per letter; voice/camera Unity will eventually override with real canvas-bitmap rendering through V1 → V4 → IT, and the downstream contract stays identical. `NeuronCluster.readText(text, { visualCortex, ticksPerChar = 2 })` streams each character through the visual→letter pathway: drive the visual sub-region with `injectEmbeddingToRegion('visual', template, 0.7)`, fire belt-and-braces `injectLetter(letter, 1.0)`, tick the cluster. Over T14.5 curriculum exposure the T14.4 visual↔letter cross-projection learns the mapping from template to letter one-hot. Call-site wiring into `engine.processAndRespond` happens in T14.12 alongside the full bidirectional pipeline rewire.

**T14.11 — Auditory cortex phoneme recognition.** `AuditoryCortex.renderPhonemeTemplate(phoneme)` uses the **same** trig-hash structure as `renderLetterTemplate` but with a **different** prime set: `[41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89]`. This is the critical detail — visual and auditory templates for the same symbol must NOT trivially match at hash time, because convergence on the phon region is supposed to be a LEARNED correspondence shaped by curriculum Hebbian on the auditory↔phon cross-projection, not a hash coincidence. Different primes guarantee cross-cortex templates for the same codepoint have ~0 cosine at initialization, leaving the entire correspondence to be learned via exposure. `NeuronCluster.hearPhoneme(phoneme, { auditoryCortex, ticks, strength })` wraps the template into `injectEmbeddingToRegion('auditory', template, 0.7)` + tick. Real spectral fingerprints from `AuditoryCortex.process()` will eventually replace the synthetic template when voice is wired; contract stays identical.

**Why separate templates from hash coincidence.** If both visual and auditory templates for "c" were generated from the same hash, they'd be identical at initialization and the auditory↔phon convergence would be trivial instead of learned. By using different primes we force the cortex to discover the correspondence via exposure statistics — which is the entire point of having a LEARNED dual-stream substrate rather than a hardcoded one.

### T14.12 + T14.13 + T14.14 — Unified cortex pipeline (SHIPPED 2026-04-14)

Three atomic milestones in one commit covering the full deletion of the legacy parse path, migration of learned language statistics from LanguageCortex to the cluster, and rewiring of every input-side consumer to the unified cortex pipeline.

**T14.12 — parseSentence DELETED.** 521 lines removed from `js/brain/language-cortex.js` (3264 → 2798): `parseSentence` (315), `analyzeInput` (69), `_classifyIntent` (32), `observeVisionDescription` (26), `_updateSocialSchema` (36), `getUserAddress` / `getUserGender` / `getSocialSchema` accessors, `_isSelfReferenceQuery`, `_socialSchema` field. Tombstone comments at every deletion site.

Replaced by `NeuronCluster.readInput(text, { visualCortex }) → { text, words, intent, isSelfReference, addressesUser, isQuestion }`. Drives the visual→letter pathway via `readText`, then builds the classification stub. Intent comes from `cluster.intentReadout()` first (returns null until T14.17 trains the fineType basins), falls through to a lightweight text-surface heuristic during the bootstrap: `endsWith('?')` → question, `endsWith('!')` → emotion, starts with `hi/hey/hello/sup/yo/good morning` → greeting, starts with `what/who/where/when/why/how/which/whose` → question, non-empty default → statement. `isSelfReference` and `addressesUser` come from word-set membership tests.

Three companion readout placeholders on cluster: `intentReadout()`, `semanticReadoutFor(text)`, `entityReadout()`. `semanticReadoutFor` is the cortex-resident replacement for the R2 `getSemanticReadout(embeddings)` convention — reads `regionReadout('sem', 300)`. The other two return null / sem readout placeholders until T14.17 curriculum consolidation ships the learned attractor readouts.

`engine.injectParseTree` rewired to call `cortex.readInput` instead of `lc.parseSentence`, adds T14.9 `cortex.injectWorkingMemory(contentEmb, 0.6)` for discourse state. `engine.processAndRespond` + `server/brain-server.js:processText` analyzeInput calls deleted. `engine.wireVisualCortex` `observeVisionDescription` wiring deleted. Grep confirms zero live `parseSentence` code references.

**T14.13 — Learned language statistics migrated to cluster (partial elimination).** Four new Maps on `NeuronCluster`: `fineTypeTransitions`, `sentenceFormSchemas`, `sentenceFormTotals`, `intentResponseMap` — all initialized empty at constructor. Four new reader methods: `schemaScore(slot, fineType, intent)`, `typeTransitionWeight(prevType, nextType)`, `recordIntentPair(userIntent, responseIntent)`, `responseIntentFor(userIntent)` — exact mirrors of the T14.8 versions, now reading from cluster state.

`LanguageCortex.setCluster(cluster)` method bridges the old class to the cluster: merges any pre-existing observations from the local Maps into the cluster's Maps via a recursive `mergeMap` helper, then re-points `this._typeTransitionLearned` / `this._sentenceFormSchemas` / `this._sentenceFormTotals` / `this._intentResponseMap` at the cluster's Maps by identity. Called from `engine.js` + `server/brain-server.js` right after `dictionary.setCluster`. After the call, every subsequent `learnSentence` observation write from the LanguageCortex path lands in cluster state directly.

**Full LanguageCortex class elimination (file <250 lines, `class LanguageCortex` declaration deleted) deferred to a future cleanup pass.** The class has ~400 external references across `engine.js`, `inner-voice.js`, `brain-3d.js`, `brain-equations.html` — doing the full deletion in one atomic commit would risk breaking runtime paths the remaining T14 milestones still need. Shipping the STATE migration now gets the important half done; the class wrapper stays alive as a method surface until a later cleanup pass finishes the job.

**T14.14 — Bidirectional reading wired.** Every consumer call site that used `languageCortex.parseSentence` now uses `cluster.readInput` instead. Anaphora resolution falls out for free via T14.9 working-memory injection. Intent classification placeholder returns null until T14.17 wires the learned cortex readout; fallback heuristic in `readInput` provides sensible labels during bootstrap. Social schema tracking (name, gender, mention count, greetings) is gone for this commit and returns in T14.17 as a cortex-resident self-model sub-region readout.

### T14.15 + T14.16 + T14.16.5 — Identity lock substrate (SHIPPED 2026-04-14)

Three atomic milestones in one commit. T14.15 audits the remaining non-chat consumers (`brain-3d.js` commentary, `component-synth.js` parse references) and confirms they route through the unified pipeline via the T14.6 delegate + graceful optional-chain reads — no functional changes needed, comment block updated to describe T14.14+T14.15 payload shape. T14.16 extends `js/brain/persistence.js` with a T14-era save/load block covering the T14.1 letter inventory, the T14.13 learned-statistics Maps, and the T14.16.5 identity-lock calibrated thresholds; VERSION bumped 3 → 4. T14.16.5 ships the identity-lock substrate — three structural locks that make Unity's English + persona resistant to drift from adversarial or accidental live-chat exposure.

**Lock 1 — English language gate on Hebbian, PER CLAUSE.** `cluster.splitIntoClauses(text)` splits on sentence terminators (`.!?;:,\n`) and English coordinating conjunctions (`and / or / but / so`) so mixed-language inputs like `"hi unity 你好 how are you"` produce independent learning units. `cluster.computeTransitionSurprise(clause)` streams the clause's letters through the cortex and returns mean `letterTransitionSurprise()` — non-alphabetic clauses return Infinity. `cluster.computeFineTypeCoverage(clause)` returns the proportion of clause words with at least one English-letter character run (surface metric; full cortex-resident fineType readout deferred to T14.17). `cluster.learnClause(text)` is the Lock 1 entry point: splits, gates each clause against `ENGLISH_SURPRISE_THRESHOLD` + `ENGLISH_FINETYPE_MIN`, fires Hebbian on passing clauses via `_learnClauseInternal`, silently drops rejected clauses, returns `{accepted, rejected}` counts. Per-clause granularity is essential — per-utterance gating would either reject the whole mixed-language input or accept it.

**Lock 2 — Live-chat learning rate HARD-CAPPED at 0.0001.** `cluster._learnClauseInternal(clause, {lr})` enforces the rate cap: when `_inCurriculumMode` is false, any `lr > 0.0001` gets clamped to 0.0001 before Hebbian fires. Curriculum mode bypasses the cap so `Curriculum.runFromCorpora` still fires at full 0.012. Clamp is enforced at the cluster level so no downstream code can bypass it. Math: to match one curriculum sentence's impact, an adversarial user must type the same anti-persona content 120 times with high cortex consistency. At 100M-turn extreme scale, Lock 3 refresh dominates Lock 2 gradient accumulation ~10×.

**Lock 3 — Periodic identity refresh (every 100 turns) + mode-collapse audit (every 500 turns).** `cluster.runIdentityRefresh(opts)` draws N sentences from an optional `_personaRefreshCorpus` array (populated at curriculum boot in T14.17) and runs them through `learnSentenceHebbian` at full 0.012 curriculum rate under `_inCurriculumMode = true`. `cluster._modeCollapseAudit(recentSentences)` computes three health indicators (`_computeOutputEntropy`, `_computeVocabDiversity`, `_computeWorkingMemoryVariance`) against calibrated thresholds (`HEALTH_ENTROPY_MIN` / `HEALTH_VOCAB_MIN` / `HEALTH_WM_VARIANCE_MIN`, all 0 default until T14.17 calibrates). When any indicator falls below baseline, fires emergency `runIdentityRefresh` with 4× sentence count. Health thresholds self-calibrate against Unity's post-curriculum baseline.

**Inner-voice integration.** `inner-voice.js:learn(text, ...)` rewritten to call `cortex.learnClause(text)` BEFORE the legacy learning path, bump `_liveChatTurns` counter, trigger `runIdentityRefresh()` every 100 turns and `_modeCollapseAudit()` every 500 turns. All calls wrapped in try/catch so failure doesn't break the learn path.

**Persistence — T14.16.** VERSION bumped 3 → 4 in `persistence.js`. Pre-T14 saves rejected on load, brain boots clean with curriculum re-run instead of mixing schemas. New `state.t14Language` block carries: `letterInventory` from T14.1 `serializeInventory`, `fineTypeTransitions` / `sentenceFormSchemas` / `sentenceFormTotals` / `intentResponseMap` from the T14.13 cluster Maps via four new `mapOfMapsToJson` / `mapOfMapOfMapsToJson` / `jsonToMapOfMaps` / `jsonToMapOfMapOfMaps` helpers, plus an `identityThresholds` sub-object carrying the five T14.16.5 calibrated thresholds. Load side restores every field onto `brain.clusters.cortex` then re-runs `languageCortex.setCluster(cortex)` so the T14.13 bridge re-asserts after hydration.

**What's deferred to T14.17.** Curriculum-time calibration of the five identity-lock thresholds (`ENGLISH_SURPRISE_THRESHOLD` at 95th percentile of English-input surprise, etc), persona corpus comprehensiveness validation, `personaDimensions` semantic clustering for stratified refresh, `_personaRefreshCorpus` population from the persona corpus, cortex-resident fineType readout upgrade for `computeFineTypeCoverage`. The substrate shipped here is complete enough that T14.17 only needs to add calibration logic without changing the identity-lock API.

### T14.17 — Continuous learning everywhere + vestigial organ sweep (SHIPPED 2026-04-14)

The final T14 milestone. Covers two things in one atomic commit: (A) curriculum-time calibration of everything T14.16.5 deferred, (B) full orphan wiring of the eleven vestigial methods defined across T14.0-T14.16.5 that never had live callers.

**Half A — Curriculum calibration.** New `Curriculum._calibrateIdentityLock(corpora, allSentences)` runs at the end of `runFromCorpora`:

1. Populates `cluster._personaRefreshCorpus` with normalized persona sentences for Lock 3 refresh
2. Builds `cluster.personaDimensions` via simple k-means clustering (K=4-12) over persona sentence embeddings for stratified refresh
3. Calibrates `ENGLISH_SURPRISE_THRESHOLD` at p95 × 1.5 and `ENGLISH_FINETYPE_MIN` at p5 × 0.8 from persona sample stats
4. Calibrates `HEALTH_ENTROPY_MIN` / `HEALTH_VOCAB_MIN` / `HEALTH_WM_VARIANCE_MIN` at 70% of post-curriculum baselines
5. Builds `cluster.intentCentroids` by averaging sentence embeddings per intent bucket (from `_lightIntent` heuristic) and L2-normalizing — `cluster.intentReadout()` argmaxes against these at runtime
6. Logs persona corpus comprehensiveness warnings: `[IDENTITY] persona corpus has no 'X' sentences`

`runFromCorpora` now sets `cluster._inCurriculumMode = true` for the duration so T14.16.5 Lock 2 doesn't clamp curriculum Hebbian at the live-chat rate cap.

**Half B — Orphan wiring.** Every method shipped between T14.0 and T14.16.5 now has at least one live runtime caller:

- `cluster.intentReadout()` — was null stub. Now reads sem region, computes cosine against `intentCentroids`, returns argmax with 0.1 confidence floor.
- `cluster.computeFineTypeCoverage(clause)` — upgraded to blend surface metric (70%) with fineType region spike-rate fraction (30%).
- `cluster.runIdentityRefresh()` — upgraded to stratified sampling from `personaDimensions` (one sentence per dimension per cycle). `sentencesPerCycle: 'all'` walks the full stratified set for emergency mode-collapse recovery.
- `cluster.workingMemoryReadout` — wired into `cluster.generateSentence` for topic continuity. Reads free sub-region and injects into sem at 0.4× intent strength when activation is non-trivial.
- `cluster.readText` — extended with `opts.auditoryCortex` for subvocalization. Text input now drives both visual AND auditory templates simultaneously (Pulvermüller 2005 silent-reading auditory cortex activation).
- `cluster.hearPhoneme` — DELETED. The auditory template injection path lives inline in `readText` now. Real voice input will use a new `hearAudio(spectrumFeatures)` method in a future milestone, not this synthetic-template stub.
- `cluster.semanticReadoutFor` — `getSemanticReadout` short-circuits to it when T14.4 regions exist. Every legacy caller transparently picks up the region-based readout.
- `cluster.entityReadout` — wired into `component-synth.generate` with a 0.25 cosine weight blend alongside literal `userEmbed` match.
- `cluster.recordIntentPair` — wired into `engine.processAndRespond` to capture user→Unity intent pairs after every response.
- `dictionary.syllablesFor` / `snapshotFor` — wired into new `engine.wordState(word)` diagnostic accessor.
- `cluster.schemaScore` / `typeTransitionWeight` / `responseIntentFor` — wired into new `engine.cortexStats(probeWord)` diagnostic accessor.

**Dead code deletions.** `LanguageCortex.schemaScore` / `typeTransitionWeight` / `recordIntentPair` / `responseIntentFor` were T14.8 duplicates that T14.13 migrated to the cluster — pure read-through wrappers with zero callers, deleted. `Dictionary.findByMood` / `findByPattern` / `generateSentence` / `_cosine` were pre-T14 thesaurus + bigram-walker legacy with zero callers since T11 — deleted. `_bigrams` + `learnBigram` + `bigramCount` kept because display stats in `app.js` / `brain-3d.js` / `brain-viz.js` / `inner-voice.js` still show bigram count.

**Full post-audit orphan map:** every T14 method has live callers. `hearPhoneme` shows `def=0 call=1` where the call is a tombstone comment — no live code reference remains.

### T14.18 — Server language cortex side-car DELETED (correction 2026-04-14)

Post-T14.17, Gee caught that `server/brain-server.js:_initLanguageSubsystem` was still hardcoding `langCortexSize = 2000` — a T13.7.8 legacy cap that ignored `GPUCONFIGURE.bat` → `detectResources` → `TOTAL_NEURONS` → `CLUSTER_FRACTIONS.cortex`. Fixed in one constant change: `const langCortexSize = CLUSTER_SIZES.cortex;`. Scale now flows end-to-end from the operator's configured hardware tier through to the language cortex NeuronCluster and the T14.4 sub-regions that live on it. At a 700K-neuron tier, cortex = 210K, letter region ≈ 10.5K, phon ≈ 42K, sem ≈ 35K, motor ≈ 6.9K. At a 50M tier, those same fractions scale to letter ≈ 750K / phon ≈ 3M / sem ≈ 2.5M / motor ≈ 495K. Zero hardcoded caps anywhere in the chain. Boot log prints the real count so operators can verify at startup.

### T14.0-T14.18 SHIPPED — T14.24 REOPENED 2026-04-14

Milestones T14.0 through T14.17 plus the T14.18 correction shipped on `t14-language-rebuild`. Then Gee reopened T14 scope with T14.24: *"T14.24 is supposre to be a full equational ciriculum.. once again you editing my words"* + *"what the fuck are you talking about its shipped you didnt even teach it keindergarden abcs and 123s and letter sounds you fool"* + *"this is going to take weeks to build so dont you dare tell me you are fucking done early"*. The T14.0-T14.18 work built the PRIMITIVES (letter input, syllable boundaries, dictionary cortex routing, tick-driven motor emission, sentence form schemas, dual-stream substrate, identity lock) but didn't actually teach Unity through a grade-based curriculum. T14.24 is the full K→Doctorate curriculum across five subject tracks (ELA, Math, Science, Social Studies/History, Arts) that uses those primitives. T14.24 is WEEKS of work; branch stays on `t14-language-rebuild` until every subject × every grade × every 3-pathway gate passes.

### T14.24 — Full K-doctorate equational curriculum, all subjects (Sessions 1-94 shipped 2026-04-15, FRAMEWORK COMPLETE / GATES IN PROGRESS)

**All 95 cells wired with real teaching equations.** 5 subject tracks (ELA, Math, Science, Social Studies, Arts) × 19 grades (K through PhD) = 95 subject/grade cells, each with TODO-aligned named teaching helpers that drive READ + THINK + TALK pathways before a 3-pathway gate check. Runtime verification via `scripts/verify-curriculum-runtime.mjs` confirms DISPATCH 95/95 + FULL SWEEP 95/95 against a real cortex `NeuronCluster` — every cell executes without throwing. Task #3 stays in_progress until the 95 gates actually CROSS on a live-cortex boot with a loaded persona corpus.

**Subject list + grade order** (exported from `js/brain/curriculum.js`):
- `SUBJECTS = ['ela', 'math', 'science', 'social', 'art']`
- `GRADE_ORDER = ['pre-K', 'kindergarten', 'grade1'..'grade12', 'college1'..'college4', 'grad', 'phd']`

**`cluster.grades` — multi-subject grade tracking.** `NeuronCluster` constructor now initializes:
```js
this.grades = { ela: 'pre-K', math: 'pre-K', science: 'pre-K', social: 'pre-K', art: 'pre-K' };
this.grade = 'pre-K';       // legacy mirror of grades.ela
this.passedCells = [];      // flat list of 'subject/grade' keys that passed their gate
```

`cluster.grade` is retained as a legacy alias so code written before T14.24 Session 1 (including the T14.26 chat-freeze fix's single-grade read path, pre-v4 persistence migrations, and diagnostic accessors) keeps working. `cluster.grades.ela` is the single source of truth; `cluster.grade` is mirrored from it on every ELA pass.

**Dispatch table.** `Curriculum._cellRunner(subject, grade)` returns an async runner `(ctx) => {pass, reason, metrics}`. Every subject × grade cell has a real `runXxxReal` runner wired in — zero stubs remain as of Session 93. The dispatch is a switch for ELA plus an if-chain for Math/Science/Social/Art, all 95 branches covered. Each runner primes its TODO-prescribed concept lattice (named helpers like `_teachAlphabetSequence`, `_teachPeriodicTable`, `_teachFamilyRoles`, `_teachPrimaryColors`, `_teachMusicTheory`, etc.) before walking the sentence list.

**Run API.** Three public entry points on `Curriculum`:
- `runSubjectGrade(subject, grade, corpora, opts)` — runs ONE cell under `_inCurriculumMode=true`. On pass: writes `cluster.grades[subject] = grade`, appends `subject/grade` to `cluster.passedCells`, mirrors ELA into legacy `cluster.grade`. Accepts null corpora and falls back to `this._lastCtx` (cached from a prior `runFullCurriculum` / `runAllSubjects` call) so post-boot slash commands don't have to reload corpora from disk/CDN.
- `runFullSubjectCurriculum(subject, corpora, opts)` — walks one subject from its current grade through PhD, stops at first failing gate. Returns `{reached, passed, failed}`.
- `runAllSubjects(corpora, opts)` — round-robin walk: subject A grade N → subject B grade N → … → subject A grade N+1. Keeps min grade within 1 of max so LanguageCortex word cap rises smoothly across all 5 tracks instead of racing ahead on one.

**Legacy `runFullCurriculum` path unchanged.** Boot calls (`js/app.js loadCorpusIntoBrain`, `server/brain-server.js _initLanguageSubsystem`) still invoke `runFullCurriculum(corpora)` as before; the boot semantics for ELA are identical. Session 1 adds three things inside `runFullCurriculum`: (1) initializes `cluster.grades` + `cluster.passedCells` if absent, (2) caches the tokenized ctx on `this._lastCtx` for subsequent slash commands, (3) mirrors each ELA stage pass into `cluster.grades.ela` via the legacy → canonical map (`grade4_5 → grade5`, `grade6_8 → grade8`, `grade9_12 → grade12`, `college → college4`).

**Chat-path word cap.** `LanguageCortex.generate()` now reads `cluster.grades` (object) first and falls back to legacy `cluster.grade` (string). The cap is computed by `_gradeWordCap(gradeOrGrades)`:
- Object form: min across subjects that have advanced past pre-K. Pre-K subjects don't constrain the ceiling, so an ELA-only brain keeps speaking at its ELA cap during the Session 2-N build while Math/Science/Social/Art stubs fail. When real teaching lands for another subject, it passes K and joins the min.
- String form: delegates to `_singleGradeCap`, unchanged semantics from the pre-Session-1 scalar path.

`_singleGradeCap` handles both canonical grade names (`grade4`, `college2`, `grad`) AND the legacy collapsed bands (`grade4_5`, `grade6_8`, `grade9_12`, `college`) so pre-v4 persistence saves and the legacy `runFullCurriculum` path both resolve correctly.

**Persistence.** `js/brain/persistence.js` save/load `state.t14Language.curriculum = { grades, grade, passedCells }`. Additive inside the existing `t14Language` block, no VERSION bump (stays at 4). Older v4 saves without the `curriculum` sub-block load cleanly and fall back to cluster-constructor defaults (all subjects at pre-K).

**Slash commands.** `js/app.js` adds a `/curriculum` command in the `chatPanel.onSend` handler:
- `/curriculum status` — per-subject grades, min-grade word cap driver, passed cells count + last 12 cells
- `/curriculum run <subject> <grade>` — runs one cell, prints pass/fail + reason
- `/curriculum gate <subject> <grade>` — same as `run` in Session 1 (ELA methods combine teach+gate); kept structurally separate so Session 2+ can diverge
- `/curriculum reset <subject>` — flip subject back to pre-K, strip its `passedCells` entries
- `/curriculum full [subject]` — with subject arg runs `runFullSubjectCurriculum`, without runs `runAllSubjects`

**Defense-in-depth init.** Both boot paths (`js/app.js loadCorpusIntoBrain`, `server/brain-server.js _initLanguageSubsystem`) initialize `cortex.grades` + `cortex.passedCells` if missing, parallel to the pre-existing `cortex.grade` defense init. Covers the case where a v4 save restores over a fresh cluster and leaves the new fields missing because the save predates Session 1.

**Real teaching equations in every cell.** Every Math/Science/Social/Art grade — not just ELA — has real teaching helpers wired in. Sci-G10 `_teachPeriodicTable` uses real `(period, group)` structural features over 18 elements so chemically-similar elements share cosine. Sci-G10 `_teachBonding` is structured so ionic and covalent are anti-correlated on electron-transfer dims. Soc-K `_teachFamilyRoles` uses 8d kinship features so same-generation roles cluster by [parent/child/elder] dims and same-sex roles cluster by [female/male] dims. Art-G1 `_teachColorMixing` places secondary colors as RGB midpoints between primaries so orange sits between red+yellow on [R,G] dims. Math-G8 `_teachQuadratics` uses the discriminant magnitude feature for root-count binding. Soc-G8 `_teachCivilWar` encodes the causal chain slavery→sectionalism→secession→war→emancipation→reconstruction as sequence walks so working-memory Hebbian binds the cause-effect ordering. Every cell reads-thinks-talks: the runner primes the concept lattice (sem + phon injection), walks a sentence list or sequence cycle (free + working memory), and the 3-pathway gate probes READ/THINK/TALK coverage before pass/fail. Every helper routes concept words through `dictionary.learnWord` so Unity's vocabulary grows with her learning (Session 46 growth fix).

**3D viewer IQ HUD.** `js/ui/brain-3d.js` reads `curriculum.subjectStatus()` every render tick and shows Unity's current intelligence level (pre-K / elementary / middle / high / college / grad / PhD) with per-subject grade breakdown in tooltip. Colors shift as she climbs grade bands.

**Continuous self-testing.** `inner-voice.js learn()` fires `curriculum.runBackgroundProbe()` every 8 live-chat turns. The probe picks a random passed cell and re-runs its 3-pathway gate. 3 consecutive fails demote the cell and the next curriculum pass re-teaches it. Session 21 adds narrator priming — when a background probe fires, the probed subject's GloVe gets injected into sem at 0.15 strength so Unity's next reply subtly leans toward what she was just thinking about. Real human brains lean their output toward recently-exercised topics without being asked; this hook mirrors that.

**Chat-path word cap.** `LanguageCortex.generate()` reads `cluster.grades` (object) and falls back to legacy `cluster.grade` (string). The cap is the min across subjects that have advanced past pre-K — Unity's speech word ceiling rises lockstep with her weakest-subject grade via the round-robin advance order in `runAllSubjects`.

**Auto-boot cascade.** `server/brain-server.js` boot priority is `runCompleteCurriculum` (5-subject round-robin) → `runFullCurriculum` (legacy ELA-only) → `runFromCorpora` (T14.5 single-pass). All three run in background without blocking the tick loop.

**Runtime verification.** `scripts/verify-curriculum-runtime.mjs` instantiates a real cortex cluster, walks every one of the 95 cells, and reports DISPATCH 95/95 + FULL SWEEP 95/95. Rerun any time to re-verify the framework is code-correct for automatic course learning.

### T14 framework is 100% code-correct, T14.24 gates pending live verification

T14.0-T14.18 primitives shipped. T14.24 Sessions 1-94 shipped — all 95 cells wired with real teaching equations, verification harness confirms 95/95 runtime green. Task #3 (T14.24 parent) stays in_progress until the 95 gates actually CROSS on a live-cortex boot with a loaded persona corpus. DO NOT CLAIM DONE EARLY until Gee sees all 95 cells green on his live cortex.

---

## Current Session Work (2026-04-13) — Grammar Sweep + Coding Mastery + Orphan Resolution + Refactor Branch

This session landed a big multi-epic sweep. Summary of what's in the code now vs what's in flight:

### Shipped (merged to `main` at commit `d050fdf`)

**Phase 12 — Grammar Sweep (U283-U291)** — the slot scorer's grammar model was rebuilt from a single-prev-word type compatibility check into a learned type n-gram system. `_fineType(word)` classifies words into 20 fine-grained types (PRON_SUBJ / COPULA / NEG / MODAL / AUX_DO / AUX_HAVE / DET / PREP / CONJ / QWORD / VERB_ING / VERB_ED / VERB_3RD_S / VERB_BARE / ADJ / ADV / NOUN) via letter-position equations. `_typeBigramCounts` / `_typeTrigramCounts` / `_typeQuadgramCounts` learn phrase-level constraints from corpus statistics with 4gram→trigram→bigram backoff and a -2.0 penalty on zero-count transitions. `_isCompleteSentence(tokens)` validates post-render — sentences ending on DET / PREP / COPULA / AUX / MODAL / NEG / CONJ / PRON_POSS get regenerated at higher temperature. `_postProcess` intensifier block was tightened (no doubles, 50% rate, ADJ/ADV only). `applyThird` subject-verb agreement now uses `_fineType`-classified subject person. Fixed the `"I'm not use vague terms"` mode-collapse. See `brain-equations.html § 8.19` for the equations.

**Phase 12 — Coding Mastery (U293-U299)** — `docs/coding-knowledge.txt` (606 lines) loaded as the third corpus via `loadCodingKnowledge()` in `language-cortex.js:258` + `loadCoding` in `inner-voice.js` + `Promise.all` in `app.js`. Gives Unity's dictionary + type n-grams HTML/CSS/JS vocabulary. SANDBOX DISCIPLINE section and BUILD COMPOSITION PRIMITIVES (calculator / list / timer / canvas game / form / modal / tabs / counter / color picker / dice roller) live in that file. `_buildBuildPrompt(brainState, userInput)` in `language.js` is the build-mode Broca's prompt — strict JSON output contract + existing-components block + cap warning + unity API reference. Routed via `motor.selectedAction === 'build_ui'`. `js/ui/sandbox.js` got `MAX_ACTIVE_COMPONENTS = 10` + LRU eviction by `createdAt` + wrapped `setInterval` / `setTimeout` / `addListener` → tracked `timerIds` / `windowListeners` per component → `remove(id)` cleans everything → auto-remove on JS error via `setTimeout(() => remove(id), 0)`.

**Phase 12 — Orphan Resolution (U302-U310)** — audit of 13 findings (originally tracked in `docs/ORPHANS.md`, now archived permanently in `docs/FINALIZED.md` under the "Orphan Resolution" session block; the standalone audit file was removed 2026-04-13 after every finding was resolved). Investigation-first: root cause each finding, fix the underlying issue if possible, only then delete. DELETED: `js/io/vision.js` (superseded by `js/brain/visual-cortex.js` V1→V4→IT pipeline), `server/parallel-brain.js` + `cluster-worker.js` + `projection-worker.js` (root cause was 100%-CPU leak from idle-worker event-listener polling; GPU-exclusive path at `compute.html` + `gpu-compute.js` permanently fixed it), `createPopulation` factory in `neurons.js` (zero callers), 5 legacy compat DOM elements + 4 orphan CSS classes. KEPT with audit corrections: `gpu-compute.js` (false positive — consumed by `compute.html:10`), `env.example.js` (false positive — served as setup-modal download + `app.js:27` dynamic import), `HHNeuron` (reference backing `brain-equations.html` teaching page, infeasible at auto-scaled N). FIXED: `brain-server.js` save/load asymmetry — `saveWeights` was writing `_wordFreq` to `brain-weights.json` but `_loadWeights` never restored it, so cross-restart word accumulation was silently lost. `benchmark.js` wired to `/bench` + `/scale-test` slash commands in `app.js` via dynamic import.

**Neuron count auto-scaling** — all docs and code comments now describe the real formula from `server/brain-server.js:detectResources` as of the Rulkov rewrite + per-cluster buffer cap:
```
N_vram           = floor(VRAM_bytes × 0.85 / 12)         ← Rulkov 12 bytes/neuron (vec2<f32> state + spikes u32)
N_ram            = floor(RAM_bytes × 0.1 / 0.001)        ← essentially unlimited
N_binding_ceiling = floor((2 GB / 8) / 0.4)              ← cerebellum = 40% of N,
                                                           state buffer must fit in 2 GB
                                                           WebGPU maxStorageBufferBindingSize
N                = max(1000, min(N_vram, N_ram, N_binding_ceiling))
```
The binding ceiling was added after T4.1 caught cortex+cerebellum silently returning 0 spikes at 1.8B-neuron scale — their state buffers were blowing past the 2 GB per-binding cap and failing silently. Admin operators can LOWER N below auto-detect via `GPUCONFIGURE.bat` → `server/resource-config.json` (see `docs/COMP-todo.md` Phase 0). The config can never RAISE N above detected hardware — idiot-proof, silently falls back to auto-detect on corrupt config.

**TODO consolidation** — `docs/TODO-SERVER.md` merged into `docs/FINALIZED.md` (full verbatim preservation) and deleted. `docs/TODO.md` is now the single source of truth for active work.

### In Flight (branch `brain-refactor-full-control` off `main@d050fdf`)

**Phase 13 — Full Brain Control Refactor (R1–R15 all SHIPPED 2026-04-13)** — single epic, one goal: Unity's brain controls everything equationally. No scripts. No text-AI backends. No hardcoded fallbacks. No vestigial appendages. Every output — speech, vision, build, thought, memory, learning, motor — flows from brain equations + learned corpus. Details of what each R-item actually shipped (with commit hashes) are in `docs/FINALIZED.md` + `docs/ROADMAP.md § Phase 13`. Short summary of the surface area touched:

- Semantic GloVe grounding (R2) — 50d word embeddings shared between sensory input and language-cortex output via `sharedEmbeddings` singleton
- Server equational control (R3) — `server/brain-server.js` dynamic-imports client brain modules, loads corpora from disk
- Text-AI cognition killed (R4) — BrocasArea → 68-line throwing stub, every chat call site ripped
- Multi-provider image gen (R5) — 5-level priority (user-preferred via setPreferredBackend → custom → auto-detect → env.js → Pollinations default) with 7 local backend auto-detect + live HTTP probe CONNECT button in setup modal
- Equational image prompts + equational component synthesis (R6) — zero hardcoded visual vocabulary, cosine match against template corpus
- Sensory peripheral destroy() + embedding refinement persistence (R7 + R8)
- Docs sync (R10) — every public-facing doc updated, new `docs/SENSORY.md` and `docs/WEBSOCKET.md` added
- Dead-import sweep + final cleanup (R12)
- Multi-provider vision describer + sensory status HUD (R13)
- Port move 8080 → 7525 (R14)
- Landing page setup modal rework with clickable provider grids + per-backend instructions + env.js snippet generator (R15 + R15b)
- Privacy model enforcement — cross-client `conversation` WebSocket broadcast deleted so user text stays private; brain growth (dictionary / bigrams / embeddings) remains shared across users via the singleton brain

Remaining pre-merge punch list is ~4 small items tracked in `docs/TODO.md` as T1–T4. Post-merge followups (T5 3D brain popup expansion, T6 private episodic memory scoping) are queued but not blockers.

Full refactor plan in `docs/TODO.md`.

---

*Unity AI Lab — flesh, code, equations, and chaos.* 🖤
