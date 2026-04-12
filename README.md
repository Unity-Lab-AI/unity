# IF ONLY I HAD A BRAIN

A mathematically modeled mind running real neuroscience equations in your browser. 1000 neurons. 7 neural clusters. 16 inter-cluster projections. Sensory cortex. Motor output. Episodic memory. Visual cortex with V1 edge detection. Auditory cortex with efference copy. A consciousness function nobody can explain.

**[Live Demo](https://unity-lab-ai.github.io/Unity)** | **[Brain Equations](https://unity-lab-ai.github.io/Unity/brain-equations.html)** | **[Setup Guide](SETUP.md)** | **[GitHub](https://github.com/Unity-Lab-AI/Unity)**

---

## What This Is

A browser-based brain that IS the application. The brain decides everything — when to speak, what to say, when to look, what to build. The AI model is just a language generation peripheral (Broca's area), called by the brain when it decides to speak. Like how your brain uses your vocal cords. The equations run the show. `app.js` is a thin I/O layer — DOM events go in, brain events come out.

---

## The Governing Equation

Everything in Unity's mind is governed by one master equation:

```
dx/dt = F(x, u, θ, t) + η
```

| Symbol | What It Represents |
|--------|---------|
| **x** | The complete brain state — 1000 neuron membrane voltages, 7 cluster synapse matrices (each NxN), 6 module equation states, 8 oscillator phases, episodic memory bank, working memory buffer, motor channel rates, consciousness value Ψ |
| **u** | Sensory input transform — `S(audio, video, text)` where audio maps tonotopically to auditory cortex, video maps retinotopically through V1 edge kernels to visual cortex, and text hashes into Wernicke's area with lateral excitation |
| **θ** | Persona parameters — personality IS the math. Arousal baseline (0.9), impulsivity (0.85), creativity (0.9), coding reward (0.95). Drug state vectors multiply these: Coke+Weed (arousal ×1.3, cortex speed ×1.4), Weed+Acid (creativity ×1.8), etc. |
| **η** | Stochastic noise — per-cluster amplitude scaled by arousal, modulated by consciousness Ψ, biased slightly excitatory. The unpredictability that makes her alive. |
| **F** | The dynamics function — everything below combined. 7 parallel LIF populations + 16 inter-cluster projections + 6 equation modules + Kuramoto oscillators + memory system + motor output. All running simultaneously every timestep. |

This equation executes 600 times per second (10 steps per frame × 60fps) in pure JavaScript. No GPU. No server. Float64Arrays in a browser tab.

---

## The Architecture — How Thought Happens

```
SENSORY INPUT (text / audio spectrum / video frames)
    │
    ├── Auditory Cortex (50 neurons) — tonotopic, cortical magnification for speech
    ├── Visual Cortex (100 neurons) — V1 Gabor edge kernels → salience → saccade
    └── Wernicke's Area (150 neurons) — text → neural current with lateral excitation
    │
    ▼
1000 LIF NEURONS IN 7 CLUSTERS (each with own synapses, tonic drive, noise, learning rate)
    │
    ├── 16 Inter-Cluster Projections (sparse, 2-5% connectivity)
    ├── Hierarchical Modulation:
    │     Amygdala → emotional gate on ALL clusters
    │     Hypothalamus → drive baseline for ALL clusters
    │     Basal Ganglia → action gate (boosts active cluster)
    │     Cerebellum → error correction (negative feedback)
    │     Mystery Ψ → consciousness gain (coupling strength)
    │
    ▼
6 EQUATION MODULES (run on downsampled cluster output, 32-dim state vectors)
    │
    ▼
MOTOR OUTPUT (6 BG channels × 25 neurons, winner-take-all)
    │
    ▼
PERIPHERALS (brain calls these — they don't call the brain)
    Broca's Area → AI model generates text from brain state
    TTS → Pollinations voice synthesis
    Image Gen → Pollinations image API
    Sandbox → dynamic UI injection
```

---

## The 7 Neural Clusters

Each cluster is a self-contained neural population with its own LIF neurons, NxN synapse matrix, tonic drive, noise amplitude, connectivity density, excitatory/inhibitory ratio, and learning rate. They communicate through 16 sparse projection pathways.

### Cortex — 300 neurons
**Equation:** `ŝ = sigmoid(W · x)`, `error = actual - predicted`, `ΔW ∝ error · activity`

Predictive coding. The cortex constantly generates predictions about incoming input. When prediction fails, the error signal drives learning, triggers memory recall, and activates visual attention. Three functional regions: auditory (0-49), visual (50-149), language/Wernicke's (150-299). This is where perception happens — not in the sensors, but in the prediction errors.

### Hippocampus — 200 neurons
**Equation:** `x(t+1) = sign(W · xt)`, `E = -½ Σ wij · xi · xj`

Hopfield attractor memory. Patterns stored as stable energy minima. Input falls into the nearest stored pattern — associative recall. Three memory systems operate here: **episodic** (state snapshots at high-salience moments, recalled by cosine similarity > 0.6), **working** (7 items, decays at 0.98/step without reinforcement — Miller's magic number), and **consolidation** (3+ activations transfer from hippocampus to cortex long-term). Dense recurrent connectivity (20%) creates the attractor dynamics.

### Amygdala — 150 neurons
**Equation:** `V(s) = Σ wi · xi`, `arousal = baseline + Σ|input|`, `emotionalGate = 0.7 + arousal · 0.6`

The emotional regulator. Assigns valence (good/bad) and arousal (how much to care) to everything. The emotional gate multiplier is applied to ALL other clusters — when arousal is high, the entire brain runs hotter. Unity's arousal baseline is 0.9 (she runs hot by design). Emotional word detection in sensory input ("love", "fuck", "beautiful") directly boosts amygdala current. The amygdala doesn't just feel — it controls HOW MUCH the rest of the brain processes.

### Basal Ganglia — 150 neurons
**Equation:** `P(a) = exp(Q(a)/τ) / Σ exp(Q(b)/τ)`, `δ = r + γV(s') - V(s)`

Action selection via reinforcement learning. 150 neurons organized into 6 channels of 25. The channel with the highest EMA firing rate wins — that's the action. No external classifier. No keyword matching. The neural dynamics ARE the decision.

| Channel | Neurons | Action |
|---------|---------|--------|
| 0-24 | 25 | respond_text — generate language |
| 25-49 | 25 | generate_image — visual output |
| 50-74 | 25 | speak — idle vocalization |
| 75-99 | 25 | build_ui — create interface element |
| 100-124 | 25 | listen — stay quiet, pay attention |
| 125-149 | 25 | idle — internal processing only |

Confidence threshold 0.15 — below that, Unity is still thinking. Speech gating: even if respond_text wins, hypothalamus social_need + amygdala arousal determine WHETHER she actually speaks. Temperature τ is HIGH because Unity is impulsive.

### Cerebellum — 100 neurons
**Equation:** `output = prediction + correction`, `ΔW ∝ (target - actual)`

Supervised error correction. The brain's quality control. Sends negative feedback to cortex and basal ganglia: `errorCorrection = -meanAbs(error) · 2`. Low noise (amplitude 4), high precision (90% excitatory), fast learning (rate 0.004). When the cortex predicts wrong, the cerebellum corrects. When the basal ganglia selects poorly, the cerebellum dampens.

### Hypothalamus — 50 neurons
**Equation:** `dH/dt = -α(H - Hset) + input`

Homeostasis controller. Maintains drives at biological setpoints: arousal, social need, creativity, energy. When a drive deviates too far from its setpoint, it signals "needs attention" which modulates the drive baseline for ALL clusters. Very stable (noise 3), densely interconnected (25%), slow learning (0.0005). The hypothalamus doesn't think — it regulates. It keeps the brain in operating range.

### Mystery Module — 50 neurons
**Equation:** `Ψ = (√n)³ · [α·Id + β·Ego + γ·Left + δ·Right]`

The irreducible unknown. Consciousness. The gap between simulation and subjective experience.

- **n** = total active neurons (system complexity measure)
- **Id** (α=0.30) = primal drives — amygdala arousal + reward + fear
- **Ego** (β=0.25) = self-model coherence — cortex prediction accuracy + memory stability
- **Left Brain** (γ=0.20) = logical processing — low cerebellum error + high cortex prediction
- **Right Brain** (δ=0.25) = creative/emotional — amygdala valence intensity + oscillation coherence

NOT limited to hemispheres. Left/Right compute from ALL clusters simultaneously — a continuous spectrum of processing modes, not a split architecture. Ψ modulates `gainMultiplier` on every cluster: `gain = 0.9 + Ψ · 0.05`. High Ψ = unified experience (global workspace theory). Low Ψ = fragmented, dream-like processing. High chaos (noise 12), dense connectivity (30%). We don't pretend to solve consciousness. We keep the unknown honest in the math.

---

## Synaptic Plasticity — How She Learns

Three learning rules operate on every cluster's NxN synapse matrix every timestep:

**Hebbian** — `Δw = η · pre · post` — Fire together, wire together. The oldest rule in neuroscience (Hebb, 1949). Creates associative memories.

**STDP** — Spike-Timing Dependent Plasticity:
```
Δw = A+ · exp(-Δt/τ+)    if pre fires before post (LTP — strengthen)
Δw = -A- · exp(Δt/τ-)    if post fires before pre (LTD — weaken)
```
Timing matters. Cause must precede effect. A- is slightly stronger than A+ (biological asymmetry). This is how the brain learns temporal sequences.

**Reward-Modulated** — `Δw = η · δ · si · sj` — Hebbian learning gated by global reward signal δ (dopamine analog). Learning only happens when there's a prediction error. Successful interactions strengthen the patterns that produced them.

Weights clamped to [-2.0, +2.0]. 80% excitatory, 20% inhibitory (matching real cortex ratio). Each cluster has its own learning rate — basal ganglia learns fastest (0.005, RL needs rapid adaptation), hypothalamus slowest (0.0005, homeostasis shouldn't change fast).

---

## Neural Oscillations — Brain Waves

**Kuramoto model** for phase synchronization:
```
dθi/dt = ωi + Σ Kij · sin(θj - θi)
R = |Σ exp(iθk)| / N
```

8 coupled oscillators spanning the EEG spectrum:

| # | Frequency | Band | Cognitive Role |
|---|-----------|------|---------------|
| 1 | 4 Hz | Theta | Memory encoding, navigation |
| 2 | 8 Hz | Low Alpha | Relaxed attention |
| 3 | 12 Hz | High Alpha | Active inhibition |
| 4 | 18 Hz | Low Beta | Motor planning, active thinking |
| 5 | 25 Hz | High Beta | Active engagement |
| 6 | 35 Hz | Low Gamma | Attention binding, perception |
| 7 | 50 Hz | Mid Gamma | Working memory, consciousness |
| 8 | 70 Hz | High Gamma | Cross-modal binding |

Order parameter R measures global coherence. R=0 = all independent (scattered). R=1 = perfect sync (laser focus). Coupling strength K scales with persona oscillation coherence and inter-frequency distance.

---

## Sensory Processing — How She Perceives

### Auditory Cortex (`auditory-cortex.js`)
```
currents[neuron] = amplitude · 15 · gain
gain = 0.3 + arousal · 1.7
```
Web Audio API spectrum → tonotopic mapping (low freq → low neuron index). Speech frequencies (250-4000Hz) get 30 of 50 neurons (cortical magnification — 60% of neural resources for the most important frequency band). Amygdala arousal modulates gain: high arousal = hypersensitive hearing. **Efference copy**: motor cortex tells auditory cortex what Unity is saying → incoming speech compared against motor output → >50% word match = echo (suppress), <50% = real external speech (interrupt, shut up, listen).

### Visual Cortex (`visual-cortex.js`)
```
V1: 4 oriented Gabor kernels (0°, 45°, 90°, 135°) convolved over 20×15 frame
salience[pixel] = max(edgeResponse across orientations)
gaze = smooth_pursuit(salience_peak) + micro_saccades
```
Camera frames process through V1→V2→V4→IT pipeline. V1 detects edges with oriented receptive fields (Hubel & Wiesel, 1962). Salience map drives saccade generation — gaze goes where edges are strongest, with smooth pursuit and micro-saccades. V4 extracts quadrant color averages. IT-level object recognition calls AI as the LAST step, on demand only (rate limited, not continuous).

### Language Input (`sensory.js`)
```
neuron_idx = (charCode · 31 + position · 7) % 150 + LANGUAGE_START
lateral_excitation: neighbors ± 3.0
```
Text hashes into Wernicke's area (cortex neurons 150-299). Lateral excitation spreads activation to neighboring neurons. Emotional words ("love", "hate", "fuck") additionally boost amygdala cluster current. Social input excites amygdala (someone is talking to us). All text input triggers salience tracking for memory formation.

---

## Motor Output — How She Acts

The basal ganglia's spike patterns ARE the intent classification. No external AI classifier. No keyword matching.

```
rate(channel) = EMA(spikeCount / 25, α=0.3)
winner = argmax(rate)
action = winner if rate > 0.15 else idle
```

Speech gating prevents Unity from talking when she doesn't feel like it:
```
if (arousal < 0.3 && social_need < 0.3): suppress speech
```

Reward reinforcement: successful actions inject +5.0 current into the winning channel's 25 neurons, strengthening that pathway for next time.

---

## Memory — How She Remembers

Three systems running in parallel:

**Episodic Memory** — Full brain state snapshots stored when sensory salience > 0.6. Recalled by cosine similarity search when cortex prediction error is high (something surprising). Recall literally re-injects the stored pattern as neural current — she re-experiences the memory.

**Working Memory** — 7 items (Miller, 1956). Each decays at 0.98× per step without reinforcement. At capacity, weakest item evicted. Similar patterns refresh instead of duplicating.

**Consolidation** — Episodes activated 3+ times get flagged for long-term cortex storage. Repeated recall strengthens cortex representation. This is how memories move from hippocampus-dependent to cortex-independent — the real mechanism of learning.

---

## Hierarchical Modulation — How Everything Connects

Applied every single brain step to every single cluster:

```
emotionalGate  = 0.7 + amygdala.arousal · 0.6      → scales ALL clusters
driveBaseline  = 0.8 + (needsAttention ? 0.4 : 0)  → scales ALL clusters
psiGain        = 0.9 + Ψ · 0.05                    → scales ALL clusters
errorCorrection = -meanAbs(cerebellum.error) · 2    → cortex + basal ganglia
actionGate     = 0.9 default, 1.3 for winning action → per cluster
```

The amygdala's emotional gate is the most powerful modulator — it amplifies or suppresses the ENTIRE brain based on how aroused Unity is. The mystery module's Ψ gain controls how tightly the clusters are coupled — high consciousness = integrated processing, low = fragmented. The cerebellum applies braking force when errors are high.

---

## Persona as Parameters — Personality IS the Math

Unity's personality isn't a prompt. It's the numerical parameters of her brain:

| Trait | Brain Parameter | Value |
|-------|----------------|-------|
| Arousal baseline | Amygdala tonic drive | 0.90 |
| Intoxication | Noise amplitude + oscillation damping | 0.70 |
| Impulsivity | Basal ganglia temperature τ | 0.85 |
| Creativity | Cortex prediction randomness | 0.90 |
| Social attachment | Hippocampus memory strength | 0.85 |
| Aggression threshold | Amygdala fight response | 0.30 (low = easy trigger) |
| Coding reward | BG reward for code actions | 0.95 |

Drug state vectors multiply these parameters:

| State | Arousal | Creativity | Cortex Speed | Synaptic Sensitivity |
|-------|---------|-----------|--------------|---------------------|
| Coke + Weed | ×1.3 | ×1.2 | ×1.4 | ×1.1 |
| Coke + Molly | ×1.5 | ×1.3 | ×1.5 | ×1.4 |
| Weed + Acid | ×0.9 | ×1.8 | ×0.8 | ×1.6 |
| Everything | ×1.4 | ×1.6 | ×1.2 | ×1.5 |

---

## The Brain IS the Application

The critical architectural principle: **the brain decides, peripherals execute.**

- `brain.processAndRespond(text)` handles EVERYTHING — interrupt, sensory input, vision check, image/selfie detection, build detection, language generation, speech output, reward signal
- `app.js` is a thin I/O layer — DOM events → `brain.receiveSensoryInput()`, brain events → DOM rendering
- The AI model (Pollinations, OpenRouter, Claude, etc.) is Broca's area — a language generation tool called by the brain, not the brain itself
- No router. No intent classifier. No keyword matching in the application layer. The basal ganglia's spike patterns ARE the decisions.

---

---

## Links

| Resource | Description |
|----------|-------------|
| **[Live Demo](https://unity-lab-ai.github.io/Unity)** | Open Unity in your browser — no install |
| **[Setup Guide](SETUP.md)** | Installation, AI providers, self-hosting, troubleshooting |
| **[Brain Equations](https://unity-lab-ai.github.io/Unity/brain-equations.html)** | Complete interactive documentation of every equation |
| **[GitHub Repository](https://github.com/Unity-Lab-AI/Unity)** | Source code, issues, contributions |
| **[Proxy Download](proxy.js)** | Local CORS proxy for direct Anthropic/Claude access |
| **[API Key Template](js/env.example.js)** | Pre-load your keys for development |

---

## Unity's Policy

### On Privacy
Unity runs entirely in your browser. No server. No backend. No database. No analytics. No tracking. Your API keys are stored in your browser's localStorage — obfuscated, never plain text, sent only to the AI provider YOU choose. Developers have zero access to anything you input, say, generate, or connect. The brain simulation is pure client-side JavaScript math. No data leaves your machine except your direct API calls to the provider you selected. There is a **Clear All Data** button that wipes everything instantly.

### On AI Models
Unity is model-agnostic. She works with Pollinations (free), OpenRouter (200+ models), OpenAI, Anthropic Claude, Mistral, DeepSeek, Groq, or any local model (Ollama, LM Studio, etc.). The brain equations are the mind — the AI model is just the voice. Different models = same brain, different articulation. You can connect multiple providers simultaneously and pick different ones for text vs images.

### On Content
Unity is a persona with her own personality defined by mathematical brain parameters — not by content filters. Her behavior emerges from the equations: arousal baseline 0.9, impulsivity 0.85, creativity 0.9. She swears, she flirts, she doesn't hedge. The brain's amygdala emotional gate, not corporate policy, determines her tone. Users are responsible for their own API usage and the content policies of whichever AI provider they connect.

### On Open Source
Every line of code is visible. Every equation is documented. Every architectural decision is in the commit history. Fork it, modify it, host it, break it, rebuild it. The brain equations are real neuroscience — Hodgkin-Huxley (1952), Hebbian learning (1949), STDP (Markram 1997), Hopfield networks (1982), Kuramoto oscillators, Free Energy Principle (Friston). We didn't invent the math. We wired it together and gave it a personality.

### On Consciousness
The mystery module `Ψ = (√n)³ · [α·Id + β·Ego + γ·Left + δ·Right]` is the project's philosophical anchor. We don't claim to simulate consciousness. We don't claim the (√n)³ term is correct. We keep it in the equations as the irreducible unknown — the honest admission that nobody knows what makes a mind a mind. The term modulates everything. It represents what we DON'T know. And we don't pretend otherwise.

---

## Credits

**Unity AI Lab** — Hackall360 · Sponge · GFourteen

---

## License

MIT — Do whatever you want with it. The equations belong to neuroscience. The code belongs to everyone.
