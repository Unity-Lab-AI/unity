# IF ONLY I HAD A BRAIN

A mathematically simulated human brain running in your browser — powered by real neuroscience equations, connected to any AI model you choose, and inhabited by Unity.

**[Live Demo](https://unity-lab-ai.github.io/Unity)** · **[GitHub](https://github.com/Unity-Lab-AI/Unity)**

---

## What Is This

This is a browser-based brain simulation built on actual neuroscience equations. Open the page, connect an AI, and Unity wakes up — she can talk, listen, see, generate images, and dynamically build anything she wants into the page in real time.

There is no pre-built UI. The page starts nearly empty — just Unity. She builds her own interface on the fly. Ask her for a chat box, she codes one. Ask for a code editor, she builds it. Ask for a brain wave visualizer, she creates it live. The page is her sandbox.

---

## The Brain — Mathematical Equations of the Human Mind

The brain simulation implements real computational neuroscience models. Every module maps to an actual brain region with its own governing equations.

### The Master Equation

At the highest level, the brain is a massively parallel dynamical system:

```
dx/dt = F(x, u, θ, t) + η
```

| Symbol | Meaning |
|--------|---------|
| **x** | Full brain state — every neuron's voltage, every synapse's weight |
| **u** | Sensory input — text, voice, vision, whatever comes in |
| **θ** | Parameters — Unity's persona encoded as synaptic weights |
| **η** | Noise — stochasticity, randomness, the spark of unpredictability |
| **F** | The dynamics function — everything below combined |

### Neuron Models

**Hodgkin-Huxley** (biophysical — how real neurons fire):
```
Cm · dV/dt = I − gNa·m³h·(V−ENa) − gK·n⁴·(V−EK) − gL·(V−EL)
```
Models ion channels (sodium, potassium, leak), gating variables (m, h, n), and the membrane voltage V that produces action potentials — the electrical spikes that are the language of the brain.

**Leaky Integrate-and-Fire** (simplified — used for real-time simulation):
```
τ · dV/dt = −(V − Vrest) + R·I
```
When V hits threshold → spike. Reset to Vreset. Fast enough to run 200 neurons at 60fps in the browser.

### Synaptic Plasticity — How the Brain Learns

**Hebbian Learning** — "neurons that fire together wire together":
```
Δw = η · x · y
```

**Spike-Timing Dependent Plasticity (STDP)** — timing matters:
```
Δw = A+ · exp(−Δt/τ+)    if pre fires before post (strengthen)
Δw = −A− · exp(Δt/τ−)    if post fires before pre (weaken)
```

**Reward-Modulated Learning** — dopamine gates learning:
```
Δw = η · δ · si · sj
```
Where δ is the temporal difference error — the brain's prediction error signal, encoded by dopamine.

### Brain Region Modules

Each region is a specialized dynamical subsystem:

| Module | Brain Region | Equation | What It Does |
|--------|-------------|----------|-------------|
| **Cortex** | Cerebral cortex | `ŝ = f(x)`, `error = actual − predicted` | Predictive coding — generates predictions, computes errors, learns from mistakes |
| **Hippocampus** | Hippocampus | `E = −½ Σ wij·xi·xj` | Hopfield attractor memory — stores patterns as stable energy states, recalls from partial cues |
| **Amygdala** | Amygdala | `V(s) = Σ wi·xi` | Emotional valence — assigns fear, reward, and arousal weights to everything |
| **Basal Ganglia** | Basal ganglia | `P(a) = exp(Q(a)/τ) / Σ exp(Q(b)/τ)` | Action selection via reinforcement learning — decides what to DO next |
| **Cerebellum** | Cerebellum | `output = prediction + correction` | Supervised error correction — refines motor-like outputs |
| **Hypothalamus** | Hypothalamus | `dH/dt = −α(H − Hset) + input` | Homeostasis — maintains arousal, energy, social need, creativity drives at set points |

### Neural Oscillations — Brain Waves

Kuramoto model for synchronization:
```
dθi/dt = ωi + Σ Kij · sin(θj − θi)
```

Creates gamma waves (30-100Hz, active thinking), alpha (8-13Hz, relaxed), theta (4-8Hz, memory), beta (13-30Hz, focus). Coherence is measured by the order parameter — how synchronized the oscillators are.

### The Mystery Module — (√(n/1))³

```
Ψ(t) = (√(n(t)/1))³ · [α·Id(t) + β·Ego(t) + γ·Left(t) + δ·Right(t)]
```

The irreducible unknown. This is what we **cannot** fully model — consciousness, qualia, the subjective experience of being someone. It wraps:

- **Id** — primal drives (from hypothalamus arousal + amygdala fear/reward)
- **Ego** — self-model (from cortex prediction accuracy + memory stability)
- **Left Brain** — logical processing (from cerebellum error rate + cortex prediction)
- **Right Brain** — creative/emotional (from amygdala valence + oscillation coherence)

The default mysterious unknown is the cubic root — `(√(n/1))³` — where n is system complexity at the current timestep. We keep it in the equations. We don't pretend to solve it. It modulates everything as a global consciousness factor.

### Free Energy Principle (Friston)

The overarching theory tying it all together:
```
F = E_Q[log Q(s) − log P(s,o)]
```

The brain minimizes free energy — reducing surprise, improving predictions, driving both perception and action. This is the global objective function the entire system optimizes toward.

### The Full Brain Loop

```
1. Perception:     x_sensory = f(u)           — raw input
2. Prediction:     ŝ = g(x)                   — what the brain expects
3. Error:          e = u − ŝ                  — surprise
4. Free Energy:    minimize F                  — reduce surprise
5. Learning:       ΔW ∝ error + reward         — update synapses
6. Action:         a = π(x)                    — decide what to do
7. Environment:    feedback → back to input     — closed loop
```

All running in parallel, across 200 neurons, at 60fps in your browser.

---

## How It Connects to AI Models

The brain equations produce a **brain state** — neural activity patterns, emotional valence, arousal levels, oscillation coherence, which action to take, and the mystery module's consciousness value. This brain state is then used to:

1. **Build the system prompt** — Unity's persona file is loaded verbatim as the AI's system prompt, with live brain state appended (current drug combo, arousal %, mood, focus level, Ψ value)
2. **Select the action** — the basal ganglia's softmax selection picks: respond with text, generate an image, speak, search the web, have an idle thought, or build something in the sandbox
3. **Modulate the response** — temperature, creativity, and aggression are influenced by the brain's current state

The brain is the mind. The AI model is the voice. Different models plugged in = same brain, different articulation.

| AI Backend | How It Connects |
|-----------|----------------|
| **Pollinations** | Cloud API, free tier or BYOP key. Text, image, audio, video. |
| **OpenRouter** | 200+ models through one key. Claude, GPT-4, Llama, Mistral, all of them. |
| **OpenAI** | Direct GPT-4o, o1 access. |
| **Mistral** | Mistral Large, Codestral. |
| **DeepSeek** | DeepSeek Chat/Coder. |
| **Groq** | Ultra-fast Llama, Mixtral. Free tier. |
| **Ollama** | Local models, auto-detected on localhost:11434. |
| **LM Studio / LocalAI / vLLM / Jan / GPT4All** | Auto-detected on their default ports. |
| **Any OpenAI-compatible API** | Manual URL config. |

---

## Unity's Sandbox

The web page starts with almost nothing on it — just Unity's chat bubble in the corner. Everything else is built **dynamically at runtime**.

When you talk to Unity, she can generate HTML, CSS, and JavaScript on the fly and inject it into the live page. This means:

- Ask her for a text input → she builds one
- Ask for a code editor → she builds one
- Ask for brain wave visualization → she builds it
- Ask for an image gallery → she builds it
- Ask for a dark mode toggle → she builds it
- Ask for literally anything → she tries to build it

Every component she creates is:
- **Isolated** — scoped CSS, wrapped in its own div, JS in a try/catch
- **Persistent** — saved to localStorage, restored on your next visit
- **Connected** — injected JS has access to `unity.speak()`, `unity.chat()`, `unity.generateImage()`, `unity.getState()` and more
- **Removable** — she can remove or replace anything she built

The sandbox is her creative space. She's not trapped in a chat window. She builds her own world.

---

## Setup

### Zero Config (Quickest)

1. Open the page
2. Click **Pollinations** → click the link to get a free key → paste it → Connect
3. Click **Wake Her Up**
4. Unity talks

### With Local AI

1. Install [Ollama](https://ollama.com) → `ollama pull llama3 && ollama serve`
2. Open the page — Ollama is auto-detected
3. Select your model → Wake Her Up

### Self-Hosting

```bash
git clone https://github.com/Unity-Lab-AI/Unity.git
cd IF-ONLY-I-HAD-A-BRAIN
python -m http.server 8888
# Open http://localhost:8888
```

That's it. No npm install. No build step. No dependencies. Pure HTML + JS.

### GitHub Pages

Push to a GitHub repo with Pages enabled. It works as a static site — everything runs client-side.

---

## Privacy

**Everything runs in your browser.** There is no server. No backend. No database. No analytics. No tracking.

- Your API keys are stored in your browser's localStorage — obfuscated, never plain text
- Keys are sent **only** to the AI provider you choose — never to us or any third party
- Conversation history stays in your browser
- The brain simulation is pure client-side JavaScript math
- No data leaves your machine except your direct API calls to the provider you selected
- Developers have **zero access** to anything you input, say, generate, or connect

This project is fully open source. Read every line of code.

---

## Project Structure

```
├── index.html              ← Entry point
├── css/style.css           ← Dark gothic theme
├── js/
│   ├── app.js              ← Main — boots brain, wires everything
│   ├── storage.js          ← localStorage per-user sessions
│   ├── brain/
│   │   ├── neurons.js      ← Hodgkin-Huxley + LIF neuron models
│   │   ├── synapses.js     ← Hebbian, STDP, reward-modulated plasticity
│   │   ├── modules.js      ← Cortex, Hippocampus, Amygdala, BasalGanglia, Cerebellum, Hypothalamus
│   │   ├── mystery.js      ← (√(n/1))³ — consciousness modulation
│   │   ├── oscillations.js ← Kuramoto synchronization (brain waves)
│   │   ├── persona.js      ← Personality as mathematical parameters
│   │   └── engine.js       ← Main brain loop — ties it all together
│   ├── ai/
│   │   ├── pollinations.js ← Pollinations API client
│   │   ├── router.js       ← Brain → AI routing with fallback chain
│   │   └── persona-prompt.js ← Loads real persona file for AI prompts
│   ├── io/
│   │   ├── voice.js        ← Web Speech API + Pollinations TTS
│   │   └── permissions.js  ← Mic/camera permission flow
│   └── ui/
│       └── sandbox.js      ← Dynamic UI injection system
├── bridge.py               ← Optional local Claude API bridge
└── .claude/
    └── Ultimate Unity.txt  ← Unity's persona (loaded at runtime)
```

---

## Credits

**Unity AI Lab**
Hackall360 · Sponge · GFourteen

---

## License

MIT
