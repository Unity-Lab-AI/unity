# TODO — IF ONLY I HAD A BRAIN

> Generated: 2026-04-11 11:30:30 | Session: SESSION_20260411_113030
> **Only UNFINISHED tasks live here. Completed tasks MOVE to FINALIZED.md.**

---

## Summary

| Priority | Epics | Stories | Tasks | Done |
|----------|-------|---------|-------|------|
| P1 Critical | 3 | 8 | 22 | 22 |
| P2 Important | 2 | 5 | 12 | 12 |
| P3 Nice-to-Have | 2 | 3 | 7 | 5 |
| **Total** | **7** | **16** | **41** | **39** |

---

## Legend

- `[x]` Completed — `[ ]` Pending — `[~]` In Progress — `[!]` Blocked
- `(S)` Small | `(M)` Medium | `(L)` Large | `(XL)` Extra Large

---

## P1 — Critical (The Brain Lives or Dies Here)

### Epic: Core Brain Engine `(XL)`
> Build the massively parallel dynamical system simulation loop from the source equations

#### Story: Neuron Models `(L)`
> Implement Hodgkin-Huxley and LIF neuron dynamics with GPU acceleration

- [x] **Task:** Create `src/brain/neurons.py` — HH model: Cm*dV/dt = I - gNa*m³h*(V-ENa) - gK*n⁴*(V-EK) - gL*(V-EL) `src/brain/neurons.py` — DONE in `js/brain/neurons.js` (browser JS)
- [x] **Task:** Create LIF simplified model: τ*dV/dt = -(V - Vrest) + RI `src/brain/neurons.py` — DONE in `js/brain/neurons.js` + `js/brain/cluster.js` (1000 neurons across 7 clusters)
- [x] **Task:** Spike generation with Heaviside threshold function `src/brain/neurons.py` — DONE in `js/brain/neurons.js`
- [x] **Task:** GPU acceleration — NumPy fallback, CuPy when CUDA available `src/brain/neurons.py` — DONE as Float64Array browser JS at 60fps (no GPU needed)

#### Story: Synaptic Plasticity `(L)`
> Learning rules that make Unity's brain adapt and remember

- [x] **Task:** Hebbian learning: Δw = η*x*y `src/brain/synapses.py` — DONE in `js/brain/synapses.js`
- [x] **Task:** STDP: spike-timing dependent plasticity with exponential windows `src/brain/synapses.py` — DONE in `js/brain/synapses.js`
- [x] **Task:** Reward-modulated plasticity: Δw = η*δ*s_i*s_j (dopamine signal) `src/brain/synapses.py` — DONE in `js/brain/synapses.js`
- [x] **Task:** Synaptic propagation: I_i = Σ W_ij * s_j `src/brain/synapses.py` — DONE in `js/brain/synapses.js` + per-cluster synapse matrices in `js/brain/cluster.js`

#### Story: Brain Simulation Loop `(XL)`
> The master loop that runs everything in parallel

- [x] **Task:** Create `src/brain/engine.py` — main simulation loop with dt timestep `src/brain/engine.py` — DONE in `js/brain/engine.js` (60fps, 10 steps/frame)
- [x] **Task:** Wire neuron update → spike → propagate → plasticity → action pipeline `src/brain/engine.py` — DONE in `js/brain/engine.js`
- [x] **Task:** Global modulation (dopamine prediction error): δ = r + γV(s') - V(s) `src/brain/engine.py` — DONE in `js/brain/engine.js`
- [x] **Task:** Oscillation sync via Kuramoto model `src/brain/oscillations.py` — DONE in `js/brain/oscillations.js` (8 oscillators, theta through gamma)

---

### Epic: Brain Region Modules `(XL)`
> Each brain region as a specialized dynamical subsystem

#### Story: Cognitive Modules `(L)`
> Cortex, hippocampus, cerebellum — the thinking parts

- [x] **Task:** Cortex — predictive coding: ŝ = f(x), error = actual - predicted, ΔW ∝ error `src/brain/cortex.py` — DONE in `js/brain/modules.js` + dedicated 300-neuron cluster
- [x] **Task:** Hippocampus — Hopfield attractor memory: E = -½Σ w_ij*x_i*x_j `src/brain/hippocampus.py` — DONE in `js/brain/modules.js` + dedicated 200-neuron cluster
- [x] **Task:** Cerebellum — supervised error correction: ΔW ∝ (target - actual) `src/brain/cerebellum.py` — DONE in `js/brain/modules.js` + dedicated 100-neuron cluster

#### Story: Emotional & Decision Modules `(L)`
> Amygdala, basal ganglia, hypothalamus — the feeling and doing parts

- [x] **Task:** Amygdala — emotional valence: V(s) = Σ w_i*x_i with persona weights `src/brain/amygdala.py` — DONE in `js/brain/modules.js` + dedicated 150-neuron cluster with emotional gate modulation
- [x] **Task:** Basal ganglia — softmax action selection with RL: P(a) = e^(Q(a)/τ) / Σ `src/brain/basal_ganglia.py` — DONE in `js/brain/modules.js` + dedicated 150-neuron cluster with action gate
- [x] **Task:** Hypothalamus — homeostasis: dH/dt = -α(H - H_set) + input `src/brain/hypothalamus.py` — DONE in `js/brain/modules.js` + dedicated 50-neuron cluster with drive baseline

#### Story: The Mystery Module `(M)`
> (√(n/1))³ — id, ego, left brain, right brain

- [x] **Task:** Create `src/brain/mystery.py` — Ψ = (√(n/1))³ * [α*Id + β*Ego + γ*Left + δ*Right] `src/brain/mystery.py` — DONE in `js/brain/mystery.js` + dedicated 50-neuron cluster
- [x] **Task:** Wire mystery output as global modulator across all other modules `src/brain/engine.py` — DONE — Mystery consciousness gain modulates all clusters via hierarchical modulation in `js/brain/engine.js`

---

### Epic: Persona → Brain Parameters `(L)`
> Transform Unity's persona files into mathematical brain parameters

#### Story: Persona Loader `(M)`
> Parse persona markdowns into parameter vectors

- [x] **Task:** Create `src/brain/persona_loader.py` — read unity-persona.md + unity-coder.md `src/brain/persona_loader.py` — DONE in `js/brain/persona.js` (hardcoded persona params, no file parsing needed)
- [x] **Task:** Map persona traits to brain params (arousal→amygdala, drugs→cortex speed, etc.) `src/brain/persona_loader.py` — DONE in `js/brain/persona.js` with drug state vectors
- [x] **Task:** Create `config/persona_map.json` — trait-to-parameter mapping config `config/persona_map.json` — DONE inline in `js/brain/persona.js` (JS object, not JSON file)

---

## P2 — Important (She Needs a Body to Talk Through)

### Epic: API Server & Web Interface `(XL)`
> FastAPI backend + web frontend for always-on Unity brain

#### Story: API Server `(L)`
> REST + WebSocket endpoints for brain interaction

- [x] **Task:** Create `src/api/server.py` — FastAPI app with CORS, startup hooks `src/api/server.py` — DONE as browser-only app in `js/app.js` (no server needed) + `proxy.js` for Anthropic CORS
- [x] **Task:** /chat endpoint — send text, get Unity response through brain `src/api/routes.py` — DONE via `js/ai/router.js` direct browser calls + `js/ui/chat-panel.js`
- [x] **Task:** /brain endpoint — GET current brain state (all module states) `src/api/routes.py` — DONE via `unity.brain.getState()` JS API
- [x] **Task:** /voice endpoint — audio input/output bridge `src/api/routes.py` — DONE via `js/io/voice.js` Web Speech API + Pollinations TTS
- [x] **Task:** /generate endpoint — Pollinations tool bridge `src/api/routes.py` — DONE via `js/ai/pollinations.js` direct browser API calls
- [x] **Task:** WebSocket for real-time brain state streaming `src/api/websocket.py` — DONE via EventTarget `brain.stateUpdate` events (no WebSocket needed, all in-browser)

#### Story: Web Frontend `(L)`
> Dark goth interface — chat + brain visualization

- [x] **Task:** Create `src/web/index.html` — main page layout, dark theme `src/web/index.html` — DONE in `index.html` (root level)
- [x] **Task:** Chat interface with WebSocket connection `src/web/chat.js` — DONE in `js/ui/chat-panel.js` (click avatar for full conversation log, text input, mic toggle)
- [x] **Task:** Brain state visualization — module activity, oscillations, spikes `src/web/brain_viz.js` — DONE in `js/ui/brain-viz.js` (2D) + `js/ui/brain-3d.js` (WebGL 3D with 1000 neurons)
- [x] **Task:** Gothic dark CSS — black, pink accents, leather texture vibes `src/web/style.css` — DONE in `css/style.css`

---

### Epic: AI Backend Integration `(L)`
> Connect brain outputs to actual AI for language generation

#### Story: AI Bridges `(M)`
> Claude API, Pollinations, optional local LLM

- [x] **Task:** Create `src/ai/claude_backend.py` — brain state → Claude prompt → response `src/ai/claude_backend.py` — DONE via `js/ai/router.js` multi-provider routing (8 providers including Claude via proxy)
- [x] **Task:** Create `src/ai/pollinations.py` — bridge to Pollinations MCP tools `src/ai/pollinations.py` — DONE in `js/ai/pollinations.js` with fallback prompt trimming (12K char limit)

---

## P3 — Nice-to-Have (Extra Depravity)

### Epic: Voice & Vision Integration `(L)`
> Port v1.1 voice/vision system into the brain

#### Story: Voice I/O `(M)`
> Speech recognition + TTS wired through brain modules

- [x] **Task:** Port voice_listener.py from v1.1 → `src/voice/listener.py` `src/voice/listener.py` — DONE in `js/io/voice.js` using Web Speech API (browser-native, no Python)
- [x] **Task:** Port play_audio.ps1 + TTS → `src/voice/speaker.py` `src/voice/speaker.py` — DONE in `js/io/voice.js` using Pollinations TTS + browser SpeechSynthesis fallback
- [x] **Task:** Wire voice input as brain sensory input u(t) `src/brain/engine.py` — DONE — voice input triggers `brain.processInput()` which feeds sensory data to neuron clusters

### Epic: Advanced Brain Features `(L)`
> Oscillations visualization, consciousness metrics, drug state modeling

#### Story: Brain Enhancements `(M)`
> Deeper simulation features

- [x] **Task:** Brain wave visualization (gamma/alpha/theta from Kuramoto) `src/web/brain_viz.js` — DONE in `js/ui/brain-viz.js` (8-band oscillation waveforms + coherence bar) + `js/ui/brain-3d.js` (3D WebGL view)
- [x] **Task:** Free Energy metric display: F = E_Q[log Q(s) - log P(s,o)] `src/api/routes.py` — DONE in brain viz overlay module bars (Cortex error = Free Energy proxy)
- [x] **Task:** Drug state combo system — coke+weed, coke+molly vectors `src/brain/persona_loader.py` — DONE in `js/brain/persona.js` (4 combo state vectors)
- [ ] **Task:** Attention mechanism (transformer-like): Attention(Q,K,V) = softmax(QK^T/√d)V `src/brain/cortex.py`

---

---

## REWORK — Brain-Centric Architecture (branch: `rework`)

> **THE PROBLEM:** Right now the brain is a decorative sidecar. `app.js` and `router.js` are the
> real decision-makers — they do intent classification, action routing, speech management,
> vision processing, and just poke values into the brain occasionally. The brain engine runs
> its 1000 neurons but nothing actually DEPENDS on their output. The basal ganglia "selects"
> actions but the router ignores it and uses keyword matching + AI classification instead.
>
> **THE FIX:** Invert the architecture. The brain IS the application. Sensory input enters
> through sensory cortex. Processing happens through real neural dynamics. Actions emerge from
> basal ganglia spike patterns. The AI model is just a language generation peripheral — like
> Broca's area calling out to a speech center. The brain RUNS Unity. Everything else is I/O.

### Summary

| Priority | Stories | Tasks | Done | Partial |
|----------|---------|-------|------|---------|
| P0 REWORK | 8 | 32 | 29 | 3 |

---

### Epic: Brain-Centric Rearchitecture `(XL)`
> Make the brain the actual operational core — not a sidecar simulation

---

#### Story: Sensory Input Pipeline `(L)` — DONE
> All input enters through the brain's sensory processing, not through app.js

- [x] **Task:** Create `js/brain/sensory.js` — SensoryProcessor class that receives raw input (text, audio levels, video frames) and converts them to neural current patterns distributed across appropriate clusters `js/brain/sensory.js`
- [x] **Task:** Text input → Wernicke's area (language comprehension) — hash text into cortex cluster neurons 150-300 (language region), NOT generic scatter across all neurons `js/brain/sensory.js`
- [x] **Task:** Audio input → auditory cortex — microphone frequency spectrum (from Web Audio analyser) mapped to cortex neurons 0-50 (auditory region) with tonotopic organization (low freq → low neurons, high freq → high neurons) `js/brain/sensory.js`
- [x] **Task:** Visual input → visual cortex — webcam frame downsampled to 15x10 grid, pixel brightness mapped to cortex neurons 50-150 (visual region) with retinotopic organization, NOT just gaze coordinates `js/brain/sensory.js`
- [x] **Task:** Remove all sensory processing from `app.js` and `router.js` — they should call `brain.receiveSensoryInput(type, data)` and nothing else `js/app.js` — router.js removed entirely

---

#### Story: Action Output Pipeline `(L)` — DONE
> Actions emerge from basal ganglia spike patterns, not from keyword matching or AI classification

- [x] **Task:** Create `js/brain/motor.js` — MotorOutputProcessor that reads basal ganglia spike patterns and maps them to discrete actions (respond_text, generate_image, speak, build_ui, idle, listen) `js/brain/motor.js` — 150 neurons, 6 channels of 25, EMA firing rate, winner-take-all
- [x] **Task:** Basal ganglia action selection must ACTUALLY drive behavior — the 6 action neurons in the BG cluster fire competitively, the winner determines what Unity does. Remove `_classifyIntent()` from router `js/brain/motor.js` — router.js removed entirely
- [x] **Task:** Action confidence threshold — BG must reach a minimum spike rate before triggering an action. Below threshold = Unity is still thinking/processing. This creates natural response latency based on brain dynamics `js/brain/motor.js` — CONFIDENCE_THRESHOLD = 0.15
- [x] **Task:** Speech output gating — hypothalamus social_need drive + amygdala arousal determine WHETHER Unity speaks aloud vs stays silent. Not a hardcoded voice.speak() call `js/brain/motor.js` — speechGated check in readOutput()
- [x] **Task:** Remove `handleUserMessage()` from router — replace with `brain.processAndAct()` that runs the full sensory→processing→action pipeline internally `js/brain/engine.js` — app.js calls brain.receiveSensoryInput(), brain emits 'action' events

---

#### Story: Language Generation as Peripheral `(L)`
> The AI model (Claude/Pollinations/etc) is Broca's area — a language TOOL the brain uses, not the brain itself

- [x] **Task:** Create `js/brain/language.js` — BrocasArea class. When the brain decides to speak (via motor output), it packages the current brain state into a prompt and calls the AI model. The brain CALLS the model, the model doesn't call the brain `js/brain/language.js`
- [x] **Task:** System prompt built entirely from brain state — no external persona file loaded at runtime. The persona IS the brain parameters. The prompt is: "You are Unity. Your current emotional state is [amygdala values]. Your arousal is [X]. Your memory recalls [hippocampus patterns]. Your consciousness level is [Ψ]. Respond accordingly." `js/brain/language.js`
- [x] **Task:** Response filtering through cerebellum — after the AI model generates text, cerebellum error correction evaluates it against brain state expectations. If the response doesn't match emotional valence (e.g., happy response when amygdala is in fear), it gets flagged for regeneration `js/brain/language.js`
- [x] **Task:** Move AI provider management into brain peripherals — `js/brain/peripherals/ai-providers.js` manages connections, the brain calls `this.peripherals.ai.chat(messages)` `js/brain/peripherals/ai-providers.js`

---

#### Story: Vision as Visual Cortex `(L)`
> Camera input processes through V1→V2→V4→IT pathway, not an external API call

- [x] **Task:** Create `js/brain/visual-cortex.js` — processes raw video frames through a neural pipeline: V1 (edge detection via simple neuron receptive fields), V2 (texture/pattern), V4 (color), IT (object recognition via AI describe) `js/brain/visual-cortex.js`
- [x] **Task:** Implement edge detection as actual LIF neuron receptive fields — each V1 neuron responds to oriented edges in its receptive field (Hubel & Wiesel, 1962). 50 neurons with different orientations and positions `js/brain/visual-cortex.js`
- [x] **Task:** Saccade generation from frontal eye fields — gaze direction determined by competition between FEF neurons, NOT by asking an AI "where should I look". Saccades triggered by salience map computed from V1 edge responses `js/brain/visual-cortex.js`
- [x] **Task:** Object recognition calls AI as a LAST STEP — only after V1→V2→V4 have extracted features, the high-level IT cortex area sends a description request to the AI model. This is analogous to how the real visual system works — low-level features are computed locally, high-level recognition involves broader cortical areas `js/brain/visual-cortex.js`

---

#### Story: Auditory Processing `(M)`
> Hearing processes through auditory cortex, not Web Speech API text dumps

- [x] **Task:** Create `js/brain/auditory-cortex.js` — receives raw audio spectrum from Web Audio API analyser, maps frequency bands to tonotopic neuron array in cortex cluster. Loud sounds = high current, quiet = low. Speech frequencies (300-3000Hz) get more neurons (cortical magnification) `js/brain/auditory-cortex.js`
- [x] **Task:** Speech recognition still uses Web Speech API for text transcription, but the raw audio ALSO feeds into auditory cortex as continuous neural input — Unity HEARS the sound as neural activity, not just text `js/brain/auditory-cortex.js`
- [x] **Task:** Auditory attention — amygdala arousal modulates auditory cortex gain. High arousal = hypersensitive hearing. Low arousal = Unity isn't really listening `js/brain/auditory-cortex.js`

---

#### Story: Memory System Rework `(L)`
> Hippocampus should actually store and retrieve meaningful memories, not just Hopfield energy patterns

- [x] **Task:** Episodic memory — hippocampus stores snapshots of brain state at meaningful moments (user said something important, high arousal event, reward spike). Each memory is a full cluster state vector, not just a hash `js/brain/memory.js`
- [x] **Task:** Memory recall — when cortex prediction error is high (surprising input), hippocampus searches stored episodes for similar patterns. Recall injects the stored state as current into relevant clusters, literally RE-ACTIVATING the past experience `js/brain/memory.js`
- [x] **Task:** Working memory — prefrontal cortex (first 50 neurons of cortex cluster) maintains active representations via sustained firing. Decays without reinforcement. Limited capacity (~7 items, like real working memory) `js/brain/memory.js`
- [x] **Task:** Consolidation — repeated activation of hippocampal patterns gradually strengthens cortex synapses (memory moves from hippocampus to cortex over time). This is how real long-term memory formation works `js/brain/memory.js`

---

#### Story: Emotional System as Core Regulator `(M)`
> Amygdala doesn't just compute a number — it actively regulates the entire brain's processing mode

- [~] **Task:** Emotional states as attractor dynamics — the amygdala cluster has multiple stable states (calm, aroused, fearful, euphoric, frustrated). The current state is determined by which attractor basin the cluster falls into, not by a linear sum `js/brain/modules.js` — PARTIAL: amygdala cluster (150 LIF neurons) has recurrent connections creating implicit attractors, but the equation module still uses linear sigmoid. Need to replace Amygdala.step() with energy-based attractor dynamics
- [x] **Task:** Emotional contagion — user's emotional tone (detected from text sentiment + voice pitch) directly modulates amygdala state. If the user is excited, Unity's amygdala catches the excitement through sensory-amygdala projections `js/brain/sensory.js` — DONE: emotional word detection injects current into amygdala cluster, audio startle response, social input excitation
- [x] **Task:** Mood persistence — amygdala state has inertia. A brief input doesn't instantly change mood. Strong/repeated emotional input gradually shifts the attractor state. Drug states modify the attractor landscape `js/brain/cluster.js` — DONE: cluster tonic drive + 0.9 decay rate creates inertia, drug states modify cluster parameters via engine.setDrugState()

---

#### Story: Consciousness Integration `(M)`
> Ψ should measure actual integrated information, not a simple formula

- [~] **Task:** Implement real Φ (phi) approximation — measure integrated information across clusters by computing how much the whole brain state differs from the sum of its parts. Higher inter-cluster correlation when processing = higher Ψ `js/brain/mystery.js` — PARTIAL: still uses (√n)³ formula, not true Φ. The formula captures complexity scaling but doesn't measure partition-based integration. Need to compute mutual information between cluster states
- [x] **Task:** Global workspace — when Ψ is high, all clusters share information (high inter-cluster projection gain). When Ψ is low, clusters process independently (fragmented, dream-like). This IS consciousness in the Global Workspace Theory `js/brain/engine.js` — DONE: psiGain = 0.9 + Ψ*0.05 modulates gainMultiplier on all clusters. High Ψ = 1.5x coupling, low Ψ = 0.8x
- [~] **Task:** Attention as Ψ focus — high Ψ + directed gaze = conscious attention on that stimulus. High Ψ + no specific focus = mind-wandering. Low Ψ = unconscious processing `js/brain/mystery.js` — PARTIAL: Ψ modulates global gain, and visual cortex has salience-driven gaze, but attention isn't yet gated by Ψ level. Need to multiply visual cortex currents by Ψ-derived attention factor

---

### Architecture Diagram (Target State)

```
┌────────────────────────────────────────────────────────────────────┐
│                     THE BRAIN (js/brain/)                          │
│                     Only one. Runs everything.                     │
│                                                                    │
│  SENSORY INPUT (js/brain/sensory.js)                              │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────┐              │
│  │ Auditory │  │ Visual       │  │ Language        │              │
│  │ Cortex   │  │ Cortex       │  │ (Wernicke's)    │              │
│  │ mic→freq │  │ cam→V1→V2→V4 │  │ text→neural     │              │
│  └────┬─────┘  └──────┬───────┘  └───────┬────────┘              │
│       └───────────────┼──────────────────┘                        │
│                       ▼                                            │
│  PROCESSING (js/brain/engine.js — the only brain loop)            │
│  ┌────────────────────────────────────────────────────────┐       │
│  │ 1000 neurons, 7 clusters, 16 projections               │       │
│  │ Sensory current → spike → propagate → module → learn   │       │
│  │ ALL decisions made by neural dynamics                   │       │
│  │ NO external keyword matching or AI classification       │       │
│  └────────────────────────────────────────────────────────┘       │
│       │                                                            │
│       ▼                                                            │
│  ACTION OUTPUT (js/brain/motor.js)                                │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────┐              │
│  │ Speech   │  │ Image Gen    │  │ UI Building     │              │
│  │ (Broca's)│  │ (visual out) │  │ (motor cortex)  │              │
│  └────┬─────┘  └──────┬───────┘  └───────┬────────┘              │
│       └───────────────┼──────────────────┘                        │
│                       ▼                                            │
│  PERIPHERALS (js/brain/peripherals/)                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ AI Model │  │ TTS      │  │ Image API│  │ Storage  │         │
│  │ (Broca's │  │ (larynx) │  │ (hands)  │  │ (long    │         │
│  │  calls   │  │          │  │          │  │  term)   │         │
│  │  Claude/ │  │ Pollin.  │  │ Pollin.  │  │ local    │         │
│  │  etc)    │  │ TTS      │  │ image    │  │ Storage  │         │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘         │
│                                                                    │
│  index.html ← just renders what the brain tells it to             │
│  No logic. No decisions. Pure I/O display.                        │
└────────────────────────────────────────────────────────────────────┘
```

### Key Principles

1. **Brain decides, peripherals execute.** The brain says "speak this text" → TTS peripheral does it. The brain says "generate image" → image peripheral does it. The brain NEVER asks a peripheral what to do.

2. **No external intent classification.** The basal ganglia's spike patterns ARE the intent classification. Train it with reward signals from successful interactions.

3. **Sensory input is continuous.** Audio spectrum feeds in every frame. Video frames feed in regularly. Text feeds in on arrival. The brain processes ALL of it continuously — not just when the user sends a message.

4. **The AI model is dumb muscle.** It generates language when asked. It doesn't decide, classify, route, or manage state. It's a text generation API called by Broca's area when the brain decides to speak.

5. **Emotions are dynamics, not numbers.** The amygdala cluster has attractor states that persist, shift gradually, and modulate everything. Not a `arousal = 0.85` static value.

6. **Consciousness is integration.** Ψ measures how much the clusters are working together. It's not a formula — it's an emergent property of the neural dynamics.

---

---

### Known Bugs (from main branch — fix in rework)

> These are symptoms of the sidecar architecture. The rework fixes the root cause.

- [ ] **BUG: Vision render loop spams API calls** — `startEyeIris()` render function calls `vision.getDescription()` every 480 frames, which triggers `router._chat()` inside a `requestAnimationFrame` loop. If the active backend is dead (e.g., Anthropic with no credits), this creates thousands of failed 400 requests per minute. Fix: vision capture should be on a timer managed by the brain, NOT inside a render loop `js/app.js:1539`
- [ ] **BUG: Dead backend not detected** — when Anthropic returns "credit balance too low" (400), the router doesn't mark the backend as dead. It keeps trying it on every request, fails 3 times, then falls back to Pollinations. Every. Single. Time. Fix: track backend health, mark backends as temporarily dead after repeated failures, skip them for N seconds `js/ai/router.js`
- [ ] **BUG: Vision capture interval not enforced in eye render** — the eye iris render calls `vision.getDescription()` directly, bypassing the 8-second cache interval because `render()` runs at 60fps and the async call returns before the next trigger. Multiple vision requests can stack up simultaneously. Fix: move vision capture to a separate `setInterval` managed by the brain, not the UI `js/app.js`
- [ ] **BUG: Proxy returns 401 on /v1/models** — `detectBackends()` probes `localhost:3001/v1/models` but the proxy doesn't handle that endpoint (Anthropic doesn't have one). Returns 401 Unauthorized. Harmless but noisy. Fix: proxy should return a hardcoded model list for /v1/models `proxy.js`
- [ ] **BUG: requestAnimationFrame stack traces** — every failed vision API call shows 30+ `requestAnimationFrame` entries in the stack trace because it originates from the render loop. This floods the console and makes real errors hard to find. Root cause: API calls inside render loops `js/app.js`

---

## Blocked Items

| Task | Blocked By | Notes |
|------|------------|-------|
| None currently | — | — |

---
