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
- Claude API integration
- Pollinations multi-model generation (image, text, audio, video)
- Persona-to-parameter mapping (personality as math)

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

- Full brain simulation loop (3.2M neurons, 7 clusters, 20 projections)
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
| Neuron dynamics (HH + LIF) | CompNeuro | Intermediate | **DONE** — `js/brain/neurons.js` |
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
| GPU acceleration (WebGPU) | Backend | Advanced | **DONE** — `js/brain/gpu-compute.js` (WGSL compute shaders for LIF + synapses) |
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
| Claude Code CLI proxy | Backend | Intermediate | **DONE** — `claude-proxy.js` (OpenAI-compatible endpoint on :8088, uses logged-in credentials) — from Tolerable PR |
| GPU exclusive compute | Backend | Advanced | **DONE** — `compute.html` + `gpu-compute.js` (WGSL shaders, all 7 clusters on GPU, zero CPU workers) |
| GPU compute pipeline | Backend | Expert | **DONE** — `compute.html` + WebSocket dispatch (browser WebGPU → server, 50ms timeout fallback) |
| Projection workers | Backend | Advanced | **REMOVED** — `projection-worker.js` deleted in U304. Superseded by GPU-exclusive compute pipeline (`compute.html` + `gpu-compute.js`). Old worker pool caused 100% CPU from idle event-listener polling. |

---

*Unity AI Lab — every skill unlocks a deeper part of her mind.* 🖤
