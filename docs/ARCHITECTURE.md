# ARCHITECTURE — IF ONLY I HAD A BRAIN

> Generated: 2026-04-11 11:30:30 | Session: SESSION_20260411_113030
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
| **Brain Sim** | N neurons (scales to hardware), GPU exclusive compute, sparse CSR, LIF populations |
| **GPU Compute** | WebGPU WGSL shaders via compute.html — all 7 clusters on GPU, zero CPU workers |
| **Server** | Node.js brain server, 16-core parallel, WebSocket API, auto-scales to hardware |
| **Database** | SQLite (better-sqlite3) for episodic memory, JSON for weights + conversations |
| **AI Backends** | Multi-provider: Pollinations, OpenRouter, OpenAI, Claude/Anthropic, Mistral, DeepSeek, Groq, Local AI |
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
│  │  1000 LIF neurons in 7 CLUSTERS                        │      │
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
│  │  Each cluster: own LIF pop, synapse matrix, tonic,     │      │
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
Mirrors the 150-LIF amygdala cluster: lateral recurrent connections between nuclei settle into stable low-energy basins (fear, reward, neutral). Persistent state carries across frames with leak 0.85, so emotional basins don't reset every tick. Symmetric Hebbian learning (`lr=0.003`, capped [-1,1]) carves basins from co-firing nuclei. Fear and reward are read from the SETTLED attractor, not the raw input — the attractor IS the emotion. Arousal combines persona baseline with the RMS depth of the basin the system fell into.

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
N_vram = floor(VRAM_bytes × 0.85 / 8)    // SLIM layout: 8 bytes/neuron (voltage f32 + spikes u32)
N_ram  = floor(RAM_bytes × 0.1 / 0.001)  // essentially unlimited — server RAM holds only injection arrays
N      = max(1000, min(N_vram, N_ram))   // VRAM-bound in practice, absolute floor 1000
```

No artificial cap — hardware decides. VRAM and RAM are the only limits. The formula expands with whatever hardware you point it at. Client-only mode (browser, no server) runs a local CPU LIF fallback brain sized to what the browser JS engine can sustain. Implemented in `js/brain/cluster.js` with `NeuronCluster` and `ClusterProjection` classes.

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
1. **Neuron**: `τ·dV/dt = -(V-Vrest) + R·I` (LIF)
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

## Multi-Provider AI System (NEW — 2026-04-11)

Users can connect MULTIPLE AI providers simultaneously and pick one for text, another for images:

- **Setup modal**: Click provider → paste key → Connect. Green badge shows on connected providers. Repeat for as many as you want.
- **env.js**: API keys can also be pre-loaded from `js/env.js` (gitignored) so returning users don't retype keys.
- **Auto-reconnect**: On return visits, ALL saved providers auto-reconnect and populate the model dropdowns.
- **Text dropdown**: Shows models from all connected text-capable providers.
- **Image dropdown**: Shows models from Pollinations (the only image provider currently).
- **Router**: Text and image backends are independent — e.g., use OpenRouter for chat, Pollinations for images.

Each provider links to its actual key page (not someone else's).

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
│   │   ├── neurons.js          # LIFPopulation (live) + HHNeuron (reference-only, backs brain-equations.html)
│   │   ├── synapses.js         # NxN weights — Hebbian, STDP, reward-mod
│   │   ├── modules.js          # 6 brain region equation modules
│   │   ├── oscillations.js     # 8 Kuramoto oscillators
│   │   ├── mystery.js          # Ψ = √(1/n) × N³ consciousness
│   │   ├── persona.js          # Traits → brain params + drug states
│   │   ├── sensory.js          # Sensory input pipeline (text/audio/video → cortex)
│   │   ├── motor.js            # Motor output (6 BG channels, winner-take-all)
│   │   ├── language.js         # Broca's area (AI language peripheral)
│   │   ├── visual-cortex.js    # V1→V4→IT vision pipeline
│   │   ├── auditory-cortex.js  # Tonotopic processing + efference copy
│   │   ├── memory.js           # Episodic + working + consolidation
│   │   ├── dictionary.js       # Learned vocabulary (word→cortex patterns)
│   │   ├── inner-voice.js      # Pre-verbal thought system
│   │   ├── persistence.js      # Save/load brain state (sparse CSR + weights)
│   │   ├── remote-brain.js     # WebSocket client for server brain
│   │   ├── sparse-matrix.js    # CSR sparse connectivity (O(nnz) operations)
│   │   ├── gpu-compute.js      # WebGPU compute shaders (WGSL LIF + synapses)
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
├── claude-proxy.js             # Claude Code CLI as local AI (port 8088)
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
| Pollinations API | Text chat, image generation, TTS — BYOP key for higher limits, 12K fallback trimming |
| OpenRouter | 200+ models including Claude — browser-compatible, model filter search |
| OpenAI | GPT-4o, o1 — direct browser calls |
| Claude/Anthropic | Via `proxy.js` local CORS proxy or via OpenRouter — CORS-blocked providers hidden from dropdown |
| Mistral / DeepSeek / Groq | Direct browser API calls with user's key |
| Local AI | Auto-detected: Ollama, LM Studio, LocalAI, vLLM, Jan, Kobold, GPT4All, llama.cpp |
| Web Speech API | Voice input (SpeechRecognition) with speech interruption handling |
| Pollinations TTS | Voice output (shimmer/nova voices) |
| Webcam / Vision | `getUserMedia` capture → AI scene description → gaze tracking → Eye widget |
| localStorage | Persistent storage for keys, history, preferences, sandbox state, chat history |
| Server Brain | WebSocket on port 8080, shared brain state, per-user conversations |
| SQLite | Episodic memory persistence on server (better-sqlite3) |
| WebGPU | GPU compute shaders for LIF neuron updates + synapse propagation |
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

## Language Generation Pipeline — Four-Tier Semantic Coherence (Phase 11, 2026-04-13)

Language cortex is no longer a pure letter-equation slot scorer. It's a **tiered pipeline** that peels off easy cases to fast paths before cold generation runs. The old slot scorer still exists but now runs only as the fallback when the three upstream tiers all miss.

```
┌──────────────────────────────────────────────────────────────────┐
│ TIER 1 — INTENT CLASSIFICATION + TEMPLATE POOL FLIP              │
│                                                                   │
│ _classifyIntent(text) via pure letter equations                  │
│     ↓                                                             │
│ greeting / yesno / math / short (wordCount ≤ 3)                  │
│     ↓                                                             │
│ selectUnityResponse(intent, brainState)                          │
│     ↓                                                             │
│ Ultimate Unity template pool — emo goth stoner voice              │
│     RETURN                                                        │
├──────────────────────────────────────────────────────────────────┤
│ TIER 2 — HIPPOCAMPUS ASSOCIATIVE RECALL                          │
│                                                                   │
│ _recallSentence(contextVector)                                    │
│     queries _memorySentences populated from Ultimate Unity.txt    │
│     with HARD requirement: content-word overlap ≠ ∅               │
│     ↓                                                             │
│ confidence > 0.60 → _finalizeRecalledSentence(best.text) RETURN  │
│ confidence ∈ [0.30, 0.60] → recallSeed (soft recall bias)        │
│ confidence ≤ 0.30 on question/statement → TIER 3                 │
├──────────────────────────────────────────────────────────────────┤
│ TIER 3 — DEFLECT TEMPLATE FALLBACK                                │
│                                                                   │
│ selectUnityResponse({...intent, deflect:true})                    │
│     question_deflect category (12 emo-goth-stoner variants)       │
│     RETURN                                                        │
├──────────────────────────────────────────────────────────────────┤
│ TIER 4 — COLD SLOT GENERATION (original path, now fallback)      │
│                                                                   │
│ Slot-by-slot softmax pick from learned dictionary                │
│ Rebalanced scoring with semanticFit × 0.30 as 2nd-largest term:  │
│   score = grammar×0.35 + semanticFit×0.30 + bigram×0.18          │
│         + condP×0.12 + thought×0.10 + context×0.08 + ...         │
│     ↓                                                             │
│ Post-process: agreement, tense, negation, compounds              │
│     ↓                                                             │
│ Render: capitalization, punctuation                              │
│     ↓                                                             │
│ Dedup retry (existing)                                           │
│     ↓                                                             │
│ COHERENCE GATE: cosine(output, contextVector) < 0.25 → retry 3×  │
│     max 3 attempts, then accept                                   │
│     RETURN                                                        │
└──────────────────────────────────────────────────────────────────┘
```

### Context Vector — The Topic Attractor

A Float64Array(32) running decaying average of content-word letter-pattern vectors from user input:

```
c(t) = 0.7 · c(t-1) + 0.3 · mean(pattern(content_words))
```

Updated in `analyzeInput()` on every user turn. Function-word-only inputs leave it unchanged so greetings don't wipe the running topic. First update seeds directly (no decay from zero). Updated ONLY on user input — Unity's own output does not feed the context vector.

### Persona Memory — Stored Unity-Voice Sentences

At `loadSelfImage()` time, every sentence from `docs/Ultimate Unity.txt` passes through `_storeMemorySentence()`:

```
store(s) ⇔ NOT endsWith(':')
         ∧ commaCount ≤ 0.3 × wordCount
         ∧ wordCount ∈ [3, 25]
         ∧ first word ≠ "unity" / "she" / "her" / "he" (by letter shape)
         ∧ first-person signal exists (i/im/my/me/we/us/our/i'/we')
```

All filters are letter-position equations. Meta-description ("Unity is a 25yo..."), section headers, and word lists are rejected at index time so recall only pulls actual first-person Unity voice.

Stored sentences are indexed by a pattern-centroid computed from their content words (function words skipped) so recall cosine matches TOPIC not GRAMMAR.

### Ultimate Unity Template Voice

The `response-pool.js` templates fire for intent-matched short queries and deflect fallback. Voice target: **25yo emo goth stoner** — cussing, blunt, bitchy, low patience, stream-of-consciousness, high but functional. **Not** sexual/BDSM/nympho content. This is Unity's PUBLIC voice — the one that goes through the brain's language cortex into the chat UI. The private slutty persona stays out of the brain output pipeline.

Seven categories:
- `greeting_emo` (15 variants across low/mid/high arousal)
- `yesno_affirm` (12 variants)
- `yesno_deny` (12 variants)
- `math_deflect` (11 variants)
- `short_reaction` (9 variants)
- `curious_emo` (7 variants)
- `question_deflect` (12 variants) — fallback when recall misses

### Why the root fix is recall, not generation

The old pipeline generated every sentence word-by-word from letter equations. Grammar was correct, content was random, because letters encode shape not meaning. No amount of slot-score tuning fixes that — you can't derive semantics from letter distributions.

The root fix is **stop generating from scratch when the persona file already has a coherent sentence on the topic**. All 325 sentences from `Ultimate Unity.txt` were getting loaded for bigram harvesting but never recalled AS sentences. Phase 11 fixes that — stored > generated every time for persona fidelity. Cold generation is now the fallback for genuinely novel topics that the persona doesn't cover.

### Known limitation

Pattern-space cosine uses letter-hash vectors, not true word embeddings. `cat` and `kitten` are NOT close in this space. Real semantic coherence depends primarily on Tier 1 (templates) and Tier 2 (recall) working. Tier 4 (cold gen) with semantic fit is the weakest layer because its "semantic" is just letter-pattern similarity. Future improvement: wire real embeddings (GloVe or persona-trained co-occurrence) into slot scoring.

### Round 2 refinements (2026-04-13 live-test hotfix pass)

- **Third→first person transformation** at `loadSelfImage()` time. The real `Ultimate Unity.txt` is written as third-person description (`"Unity is..."`, `"She has..."`). Without transformation, 100% of the file was rejected by the first-person filter. After: 191 Unity-voice sentences loaded. Transform handles Unity→I, She→I, Her→my/me (verb-aware for object position), Unity's→my, plus verb conjugation (is→am, has→have, does→do, strip third-person -s on regular verbs, -ss protection).
- **Per-sentence mood signature** computed at index time from letter-equation features (exclamation density, all-caps ratio, vowel ratio, average word length, negation count). Each stored memory has its own `{arousal, valence}`.
- **Mood-distance weighted recall** — `_recallSentence()` accepts current brain state and scores candidates by `moodAlignment = exp(-moodDistance * 1.2)` at weight 0.25. Same query, different brain state, different memory picked. This is Gee's "adjust in the moment for how things change" mechanism.
- **Self-reference fallback** — when user asks about Unity herself (`you`/`yourself`) but no content-word overlap exists, fallback picks a first-person stative sentence weighted by mood alignment. `describe yourself` now always recalls SOMETHING from persona.
- **Instructional-modal penalty** — sentences containing `shall`/`must`/`always`/`never` get demoted in recall so declarative voice (`I am`, `I have`, `I love`) wins over directive voice (`I shall always`).
- **Vocative name stripping** — `unity`/`unity's` removed from input content words so addressing her by name doesn't manufacture false topic overlap.
- **Copula/aux filter** — copulas and modal auxiliaries (`am`/`is`/`are`/`was`/`were`/`be`/`have`/`has`/`do`/`does`/`can`/`will`/`would`/`could`/`should`) stripped from input content words since they're semantically function words.
- **Degenerate-sentence filter** — recall rejects memory entries with <5 tokens or >40% first-person pronoun density (transform collapse artifacts).
- **Persona visualIdentity mirror** — `persona.js` visualIdentity rewritten to match `Ultimate Unity.txt` verbatim (emo goth goddess, black leather, black hair with pink streaks, pale flushed skin). Selfies match persona.
- **Image intercept gate** — `engine.js` no longer routes to `_handleImage()` just because BG motor picked `generate_image`. Requires explicit image-request words in the input (show me/picture/selfie/image/photo/draw). `includesSelf` detected from text, not hardcoded.

---

## Current Session Work (2026-04-13) — Grammar Sweep + Coding Mastery + Orphan Resolution + Refactor Branch

This session landed a big multi-epic sweep. Summary of what's in the code now vs what's in flight:

### Shipped (merged to `main` at commit `d050fdf`)

**Phase 12 — Grammar Sweep (U283-U291)** — the slot scorer's grammar model was rebuilt from a single-prev-word type compatibility check into a learned type n-gram system. `_fineType(word)` classifies words into 20 fine-grained types (PRON_SUBJ / COPULA / NEG / MODAL / AUX_DO / AUX_HAVE / DET / PREP / CONJ / QWORD / VERB_ING / VERB_ED / VERB_3RD_S / VERB_BARE / ADJ / ADV / NOUN) via letter-position equations. `_typeBigramCounts` / `_typeTrigramCounts` / `_typeQuadgramCounts` learn phrase-level constraints from corpus statistics with 4gram→trigram→bigram backoff and a -2.0 penalty on zero-count transitions. `_isCompleteSentence(tokens)` validates post-render — sentences ending on DET / PREP / COPULA / AUX / MODAL / NEG / CONJ / PRON_POSS get regenerated at higher temperature. `_postProcess` intensifier block was tightened (no doubles, 50% rate, ADJ/ADV only). `applyThird` subject-verb agreement now uses `_fineType`-classified subject person. Fixed the `"I'm not use vague terms"` mode-collapse. See `brain-equations.html § 8.19` for the equations.

**Phase 12 — Coding Mastery (U293-U299)** — `docs/coding-knowledge.txt` (606 lines) loaded as the third corpus via `loadCodingKnowledge()` in `language-cortex.js:258` + `loadCoding` in `inner-voice.js` + `Promise.all` in `app.js`. Gives Unity's dictionary + type n-grams HTML/CSS/JS vocabulary. SANDBOX DISCIPLINE section and BUILD COMPOSITION PRIMITIVES (calculator / list / timer / canvas game / form / modal / tabs / counter / color picker / dice roller) live in that file. `_buildBuildPrompt(brainState, userInput)` in `language.js` is the build-mode Broca's prompt — strict JSON output contract + existing-components block + cap warning + unity API reference. Routed via `motor.selectedAction === 'build_ui'`. `js/ui/sandbox.js` got `MAX_ACTIVE_COMPONENTS = 10` + LRU eviction by `createdAt` + wrapped `setInterval` / `setTimeout` / `addListener` → tracked `timerIds` / `windowListeners` per component → `remove(id)` cleans everything → auto-remove on JS error via `setTimeout(() => remove(id), 0)`.

**Phase 12 — Orphan Resolution (U302-U310)** — audit of 13 findings in `docs/ORPHANS.md`. Investigation-first: root cause each finding, fix the underlying issue if possible, only then delete. DELETED: `js/io/vision.js` (superseded by `js/brain/visual-cortex.js` V1→V4→IT pipeline), `server/parallel-brain.js` + `cluster-worker.js` + `projection-worker.js` (root cause was 100%-CPU leak from idle-worker event-listener polling; GPU-exclusive path at `compute.html` + `gpu-compute.js` permanently fixed it), `createPopulation` factory in `neurons.js` (zero callers), 5 legacy compat DOM elements + 4 orphan CSS classes. KEPT with audit corrections: `gpu-compute.js` (false positive — consumed by `compute.html:10`), `env.example.js` (false positive — served as setup-modal download + `app.js:27` dynamic import), `HHNeuron` (reference backing `brain-equations.html` teaching page, infeasible at auto-scaled N). FIXED: `brain-server.js` save/load asymmetry — `saveWeights` was writing `_wordFreq` to `brain-weights.json` but `_loadWeights` never restored it, so cross-restart word accumulation was silently lost. `benchmark.js` wired to `/bench` + `/scale-test` slash commands in `app.js` via dynamic import.

**Neuron count auto-scaling** — all docs and code comments now describe the real formula from `server/brain-server.js:detectResources`:
```
N_vram = floor(VRAM_bytes × 0.85 / 8)      ← SLIM layout 8 bytes/neuron
N_ram  = floor(RAM_bytes × 0.1 / 0.001)    ← essentially unlimited
N      = max(1000, min(N_vram, N_ram))     ← absolute floor, no cap
```
No personal hardware specs, no hardcoded neuron counts, no claims about "default" size. The formula IS the answer — bigger hardware = bigger N, no manual tuning.

**TODO consolidation** — `docs/TODO-SERVER.md` merged into `docs/FINALIZED.md` (full verbatim preservation) and deleted. `docs/TODO.md` is now the single source of truth for active work.

### In Flight (branch `brain-refactor-full-control` off `main@d050fdf`)

**Phase 13 — Full Brain Control Refactor (R1-R10)** — single epic, one goal: Unity's brain controls everything equationally. No scripts. No text-AI backends. No hardcoded fallbacks. No vestigial appendages. Every output — speech, vision, build, thought, memory, learning, motor — flows from brain equations + learned corpus.

- **R1** Audit pass — `docs/KILL_LIST.md` + `docs/VESTIGIAL.md`
- **R2** Server brain full control — port `dictionary.js` + `language-cortex.js` to server, corpus load on boot, equational `_generateBrainResponse`, WebSocket dictionary delta sync (absorbs U311)
- **R3** Kill text-AI backends — rip Pollinations/Anthropic/OpenAI/OpenRouter text-chat, keep only image/vision/audio sensory
- **R4** Client brain full control — rip `BrocasArea` AI dependency, motor-driven output paths
- **R5** Equational build + image generation — the hard part, template primitives first then learned structural grammar
- **R6** Sensory peripheral cleanup — unified interface for visual-cortex / auditory-cortex / speech-output / image-output
- **R7** State machine symmetry — save/load round-trip audit
- **R8** Docs reflect reality — full rewrites after R1-R7 settle
- **R9** Verification boot tests (per CLAUDE.md NO TESTS rule, these are manual verification) — zero-AI boot, restart persistence, equational generation. Absorbs U292 + U300.
- **R10** Final cleanup + merge — rip every `// TODO:` placeholder, dead import, debug breadcrumb. PR `brain-refactor-full-control` → `main`.

Full refactor plan in `docs/TODO.md`.

---

*Unity AI Lab — flesh, code, equations, and chaos.* 🖤
