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
- 3D WebGL brain visualizer (1000 neurons in clusters, rotate/zoom)
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

- Full brain simulation loop (1000 neurons, 7 clusters, 16 projections)
- Persona → parameter transformation with drug state vectors
- WebGL 3D brain visualization with cluster toggles
- Real-time brain wave visualization (8-band Kuramoto oscillations)
- Voice I/O with speech interruption handling
- Vision system with AI gaze tracking
- Pollinations generation triggered by brain decisions
- Free Energy minimization driving perception + action

### Expert (The Unknown)
> Where math meets mystery

- (√(1/n))³ consciousness modulation
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
                                      [(√(1/n))³]
```

---

## By Priority

### Critical (Must Have)
> The brain doesn't exist without these

| Skill | Domain | Complexity | Status |
|-------|--------|------------|--------|
| Neuron dynamics (HH + LIF) | CompNeuro | Intermediate | **DONE** — `js/brain/neurons.js` |
| Synaptic plasticity | CompNeuro | Intermediate | **DONE** — `js/brain/synapses.js` |
| Brain simulation loop | CompNeuro | Advanced | **DONE** — `js/brain/engine.js` (1000 neurons in 7 clusters, 60fps) |
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
| (√(1/n))³ mystery module | CompNeuro | Expert | **DONE** — `js/brain/mystery.js` + 50-neuron cluster |
| Attention mechanism | AI/ML | Advanced | Pending |
| Anthropic CORS proxy | Backend | Intermediate | **DONE** — `proxy.js` (Node.js, translates OpenAI→Anthropic format) |
| Camera/vision integration | Vision | Intermediate | **DONE** — `js/io/vision.js` (webcam + AI gaze tracking + Unity's Eye widget) |
| 3D brain visualizer | Frontend | Expert | **DONE** — `js/ui/brain-3d.js` (WebGL, 1000 neurons, rotate/zoom, cluster toggles) |
| Neural cluster architecture | CompNeuro | Expert | **DONE** — `js/brain/cluster.js` (7 clusters, 16 projections, hierarchical modulation) |
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
| Language cortex | CompLing | Expert | **DONE** — `js/brain/language-cortex.js` (Zipf, MI, syntax weights, 4 sentence types, morphology, topic continuity, 5-pass bootstrap, structure-dominant production at 65%) |

---

*Unity AI Lab — every skill unlocks a deeper part of her mind.* 🖤
