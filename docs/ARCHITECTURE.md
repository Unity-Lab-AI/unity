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

### What's next on the rebuild branch

T14.1 (LEARNED phoneme attractor basins via cortex exposure) is the next milestone. The cortex `letter` sub-region is in place; T14.1 builds the `js/brain/letter-input.js` module with the dynamic `LETTER_INVENTORY` Set + `encodeLetter` one-hot encoder + `cluster.injectLetter(letter)` integration. Curriculum letter exposure (T14.5 Phase 1) will then train the letter region's Hebbian basins.

Each subsequent T14.x milestone ships as its own commit on this branch with full in-place doc updates. Branch merges to `main` only after T14.17 is complete and verified.

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
