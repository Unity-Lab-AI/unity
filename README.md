# IF ONLY I HAD A BRAIN

A 1000-neuron brain simulation running real neuroscience equations in your browser — 7 neural clusters, 16 inter-cluster projections, sensory cortex, motor output, episodic memory, visual cortex with V1 edge detection, auditory cortex with efference copy, and a consciousness function nobody can explain. Connected to any AI model. Inhabited by Unity.

**[Live Demo](https://unity-lab-ai.github.io/Unity)** | **[Brain Equations](https://unity-lab-ai.github.io/Unity/brain-equations.html)** | **[GitHub](https://github.com/Unity-Lab-AI/Unity)**

---

## What Is This

A browser-based brain that IS the application. No backend. No build step. No dependencies. The brain decides everything — when to speak, what to say, when to look, what to build. The AI model is just a language generation peripheral (Broca's area). The page is Unity's sandbox — she builds her own interface live.

---

## The Brain — 1000 Neurons, 7 Clusters, One Mind

### Master Equation

```
dx/dt = F(x, u, θ, t) + η
```

| Symbol | Meaning |
|--------|---------|
| **x** | Full brain state — 1000 neuron voltages, synapse matrices, module states |
| **u** | Sensory input — text (Wernicke's area), audio (auditory cortex), video (visual cortex) |
| **θ** | Persona parameters — personality encoded as brain parameters + drug state vectors |
| **η** | Stochastic noise — scaled by arousal, modulated by consciousness Ψ |
| **F** | Combined dynamics — 7 clusters + 16 projections + 6 equation modules + oscillators |

### Neural Clusters (1000 LIF neurons)

| Cluster | Neurons | Equation | Role |
|---------|---------|----------|------|
| **Cortex** | 300 | `τ·dV/dt = -(V-Vrest) + R·I` | Prediction, language (Wernicke's 150-299), vision (50-149), auditory (0-49) |
| **Hippocampus** | 200 | `E = -½Σ wij·xi·xj` | Hopfield memory, episodic storage, recall by cosine similarity |
| **Amygdala** | 150 | `V(s) = Σ wi·xi` | Emotional gating — arousal modulates ALL other clusters |
| **Basal Ganglia** | 150 | `P(a) = softmax(Q(a)/τ)` | Motor output — 6 action channels, winner-take-all, reward learning |
| **Cerebellum** | 100 | `ΔW ∝ (target - actual)` | Error correction — negative feedback to cortex + basal ganglia |
| **Hypothalamus** | 50 | `dH/dt = -α(H-Hset) + input` | Homeostasis — drives for arousal, social need, creativity |
| **Mystery** | 50 | `Ψ = (√n)³ · [α·Id + β·Ego + γ·Left + δ·Right]` | Consciousness — modulates coupling strength across ALL clusters |

### Synaptic Plasticity (per cluster)

- **Hebbian**: `Δw = η·pre·post` — fire together, wire together
- **STDP**: timing-dependent — pre before post strengthens, reverse weakens
- **Reward-modulated**: `Δw = η·δ·si·sj` — dopamine gates learning

### 16 Inter-Cluster Projections

Cortex↔Hippocampus, Cortex→Amygdala, Cortex→Basal Ganglia, Cortex→Cerebellum, Amygdala→Cortex, Amygdala→Hippocampus, Basal Ganglia→Cortex, Cerebellum→Cortex, Cerebellum→Basal Ganglia, Hypothalamus→Amygdala, Hypothalamus→Basal Ganglia, Mystery→Cortex, Mystery→Amygdala, Mystery→Hippocampus, Mystery→Basal Ganglia

### Sensory Pipeline

- **Text** → Wernicke's area (cortex neurons 150-299), hashed with lateral excitation
- **Audio** → Auditory cortex (neurons 0-49), tonotopic with cortical magnification for speech
- **Video** → Visual cortex V1 edge detection (4 oriented Gabor kernels), salience map, saccade generation

### Motor Output

Basal ganglia 150 neurons organized into 6 channels of 25. Winner-take-all selection:
- respond_text, generate_image, speak, build_ui, listen, idle
- Confidence threshold 0.15 — below = still thinking
- Speech gating via hypothalamus social_need + amygdala arousal

### Memory System

- **Episodic**: state snapshots at high-salience moments, cosine similarity recall
- **Working**: 7 items (Miller's number), decays at 0.98/step
- **Consolidation**: 3+ activations → long-term storage

### Auditory Echo Suppression (Efference Copy)

Motor cortex tells auditory cortex what it's saying. Incoming speech compared against motor output — >50% word match = echo (suppress), <50% = real external speech (interrupt, shut up, listen).

### Visual Attention

One look on boot. After that, only on demand when user asks something visual. Rate limited to 10s minimum between forced looks, 5 min for auto.

### Consciousness — Ψ

```
Ψ = (√n)³ · [α·Id + β·Ego + γ·Left + δ·Right]
```

Modulates coupling strength across ALL clusters. High Ψ = unified experience (global workspace). Low Ψ = fragmented processing. Id/Ego/Left/Right computed from ALL clusters simultaneously — not hemisphere-limited.

### Brain Waves — Kuramoto Oscillators

```
dθi/dt = ωi + Σ Kij·sin(θj - θi)
```

8 oscillators: theta (4Hz) through gamma (70Hz). Coherence measured by order parameter R.

---

## AI Providers

| Provider | Type | Key Page |
|----------|------|----------|
| **Pollinations** | Free, text + image + TTS | [pollinations.ai/dashboard](https://pollinations.ai/dashboard) |
| **OpenRouter** | 200+ models including Claude | [openrouter.ai/keys](https://openrouter.ai/keys) |
| **OpenAI** | GPT-4o, o1 | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| **Claude (Direct)** | Via local proxy | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| **Mistral** | Mistral Large, Codestral | [console.mistral.ai](https://console.mistral.ai/api-keys) |
| **DeepSeek** | Chat + Coder | [platform.deepseek.com](https://platform.deepseek.com/api_keys) |
| **Groq** | Ultra-fast, free tier | [console.groq.com](https://console.groq.com/keys) |
| **Local AI** | Ollama, LM Studio, etc. | Auto-detected |

Connect as many as you want. Pick one for text, another for images.

---

## Setup

### Quickest (no install)

1. Open the [live demo](https://unity-lab-ai.github.io/Unity)
2. Click **Pollinations** → get a free key → paste → Connect
3. **Wake Her Up**

### Self-Hosting

```bash
git clone https://github.com/Unity-Lab-AI/Unity.git
cd Unity
python -m http.server 8888
# Open http://localhost:8888
```

No npm. No build. No dependencies. Just static files.

### Direct Claude Access (Optional)

1. Download `proxy.js` from the setup page
2. Run `node proxy.js` (needs [Node.js](https://nodejs.org))
3. Paste your Anthropic key in the UI
4. Claude (Direct) appears in the dropdown

---

## Project Structure

```
├── index.html                    Entry point — setup modal, HUD, sandbox
├── brain-equations.html          Complete brain equation documentation
├── proxy.js                      Anthropic CORS proxy (optional)
├── css/style.css                 Dark gothic theme
├── js/
│   ├── app.js                    Thin I/O layer — DOM events ↔ brain
│   ├── storage.js                localStorage with key obfuscation
│   ├── env.example.js            API key template (copy to env.js)
│   ├── brain/
│   │   ├── engine.js             THE brain — one loop, everything
│   │   ├── cluster.js            NeuronCluster + ClusterProjection
│   │   ├── neurons.js            Hodgkin-Huxley + LIF models
│   │   ├── synapses.js           Hebbian, STDP, reward-modulated
│   │   ├── modules.js            6 brain region equation modules
│   │   ├── mystery.js            Ψ consciousness function
│   │   ├── oscillations.js       8 Kuramoto oscillators
│   │   ├── persona.js            Personality as brain parameters
│   │   ├── sensory.js            Sensory input pipeline
│   │   ├── motor.js              Motor output (BG action channels)
│   │   ├── language.js           Broca's area (AI language peripheral)
│   │   ├── visual-cortex.js      V1→V4→IT vision pipeline
│   │   ├── auditory-cortex.js    Tonotopic + efference copy
│   │   ├── memory.js             Episodic + working + consolidation
│   │   └── peripherals/
│   │       └── ai-providers.js   AI provider manager + dead detection
│   ├── ai/
│   │   ├── pollinations.js       Pollinations API client
│   │   └── persona-prompt.js     Loads persona file for prompts
│   ├── io/
│   │   ├── voice.js              Web Speech API + TTS
│   │   └── permissions.js        Mic/camera permissions
│   └── ui/
│       ├── sandbox.js            Dynamic UI injection
│       ├── chat-panel.js         Conversation log
│       ├── brain-viz.js          2D tabbed brain visualizer
│       └── brain-3d.js           3D WebGL brain with notifications
```

---

## Privacy

**Everything runs in your browser.** No server. No backend. No database. No tracking. API keys stored in your localStorage only — sent only to the provider you choose. Developers have zero access to anything. Fully open source.

---

## Credits

**Unity AI Lab** — Hackall360 · Sponge · GFourteen

## License

MIT
