# Setup Guide

**[Back to README](README.md)** | **[Live Demo](https://unity-lab-ai.github.io/Unity)** | **[Brain Equations](https://unity-lab-ai.github.io/Unity/brain-equations.html)**

---

## Quickest Start (No Install)

1. Open the [live demo](https://unity-lab-ai.github.io/Unity)
2. Click **Pollinations** → get a free key at [pollinations.ai/dashboard](https://pollinations.ai/dashboard) → paste → Connect
3. Click **Wake Her Up**
4. Grant mic + camera when prompted
5. Talk to Unity

---

## AI Providers

Connect as many as you want. Pick one for text, another for images.

| Provider | What You Get | Free Tier | Key Page |
|----------|-------------|-----------|----------|
| **Pollinations** | Text + image + TTS | Yes (rate limited) | [pollinations.ai/dashboard](https://pollinations.ai/dashboard) |
| **OpenRouter** | 200+ models (Claude, GPT-4, Llama, Mistral) | Limited | [openrouter.ai/keys](https://openrouter.ai/keys) |
| **OpenAI** | GPT-4o, o1 | No | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| **Claude (Direct)** | Anthropic models via local proxy | No | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| **Mistral** | Mistral Large, Codestral | Limited | [console.mistral.ai](https://console.mistral.ai/api-keys) |
| **DeepSeek** | Chat + Coder | Cheap | [platform.deepseek.com](https://platform.deepseek.com/api_keys) |
| **Groq** | Ultra-fast Llama, Mixtral | Yes | [console.groq.com](https://console.groq.com/keys) |
| **Local AI** | Ollama, LM Studio, vLLM, Jan, etc. | Free (your hardware) | Auto-detected |

### Using Local AI

Install [Ollama](https://ollama.com), pull a model, start serving:
```bash
ollama pull llama3
ollama serve
```
Unity auto-detects Ollama on `localhost:11434`. Also detects LM Studio (1234), LocalAI (8080), vLLM (8000), Jan (1337), GPT4All (4891), llama.cpp (8081).

### Using Claude Directly (Proxy)

Anthropic blocks direct browser API calls (CORS). The proxy solves this:

1. Download `proxy.js` from the setup page (or from this repo)
2. Open a terminal anywhere, run: `node proxy.js`
3. Proxy starts on `localhost:3001`
4. Unity auto-detects it and adds Claude models to the dropdown
5. Paste your Anthropic key → Connect

The proxy runs on YOUR machine. Your key never touches any third-party server. Requires [Node.js](https://nodejs.org).

**Don't want to run a proxy?** Use **OpenRouter** — it includes all Claude models and works directly from the browser.

---

## Self-Hosting

```bash
git clone https://github.com/Unity-Lab-AI/Unity.git
cd Unity
python -m http.server 8888
# Open http://localhost:8888
```

No npm. No build step. No dependencies. Just static files served by any web server.

### With API Keys Pre-loaded

Copy `js/env.example.js` to `js/env.js` and paste your keys:
```js
export const ENV_KEYS = {
  anthropic:    'sk-ant-...',
  pollinations: 'sk_...',
  openrouter:   'sk-or-...',
  openai:       '',
  mistral:      '',
  deepseek:     '',
  groq:         '',
};
```
`js/env.js` is gitignored — your keys never get pushed. Keys auto-load on boot so you don't retype them.

---

## GitHub Pages Deployment

```
GitHub repo → Settings → Pages → Source: Deploy from branch → Branch: main → / (root) → Save
```

Live at `your-username.github.io/Unity/`. Everything runs client-side — no server needed.

---

## Project Structure

```
├── index.html                    Entry point — setup modal, HUD, sandbox
├── brain-equations.html          Complete brain equation documentation
├── SETUP.md                      This file
├── README.md                     Brain architecture and equations
├── proxy.js                      Anthropic CORS proxy (optional)
├── css/style.css                 Dark gothic theme
├── js/
│   ├── app.js                    Thin I/O layer — DOM events ↔ brain
│   ├── storage.js                localStorage with key obfuscation
│   ├── env.example.js            API key template (copy to env.js)
│   ├── brain/
│   │   ├── engine.js             THE brain — master loop, processAndRespond
│   │   ├── cluster.js            NeuronCluster + ClusterProjection classes
│   │   ├── neurons.js            Hodgkin-Huxley + LIF neuron models
│   │   ├── synapses.js           Hebbian, STDP, reward-modulated plasticity
│   │   ├── modules.js            6 brain region equation modules
│   │   ├── mystery.js            Ψ = √(1/n) × N³ · [Id + Ego + Left + Right]
│   │   ├── oscillations.js       8 Kuramoto oscillators (θ→γ)
│   │   ├── persona.js            Personality as brain parameters + drug states
│   │   ├── sensory.js            Sensory input pipeline (text/audio/video)
│   │   ├── motor.js              Motor output (6 BG action channels)
│   │   ├── language.js           Broca's area (AI language peripheral)
│   │   ├── visual-cortex.js      V1→V4→IT vision pipeline
│   │   ├── auditory-cortex.js    Tonotopic processing + efference copy
│   │   ├── memory.js             Episodic + working + consolidation
│   │   ├── dictionary.js         Learned vocabulary (word→cortex patterns)
│   │   ├── inner-voice.js        Pre-verbal thought system
│   │   ├── persistence.js        Save/load brain state (localStorage/disk)
│   │   ├── remote-brain.js       WebSocket client for server brain
│   │   ├── sparse-matrix.js      CSR sparse connectivity (O(connections))
│   │   ├── gpu-compute.js        WebGPU compute shaders (LIF + synapses)
│   │   ├── embeddings.js         Semantic word embeddings (GloVe 50d)
│   │   ├── language-cortex.js    Language from equations (word type from letters, slot grammar, learns from conversation)
│   │   ├── benchmark.js          Dense vs sparse + neuron scale test
│   │   ├── response-pool.js     EDNA response categories (training wheels for language cortex)
│   │   └── peripherals/
│   │       └── ai-providers.js   AI provider manager + dead backend detection
│   ├── ai/
│   │   └── pollinations.js       Pollinations API client (text/image/TTS)
│   ├── io/
│   │   ├── voice.js              Web Speech API + Pollinations TTS
│   │   ├── vision.js             Webcam capture + AI scene description
│   │   └── permissions.js        Mic/camera permission requests
│   └── ui/
│       ├── sandbox.js            Dynamic UI injection system
│       ├── chat-panel.js         Conversation log panel
│       ├── brain-viz.js          2D tabbed brain visualizer (8 tabs)
│       └── brain-3d.js           3D WebGL brain with notifications + expansion
├── claude-proxy.js               Claude Code CLI as local AI (port 8088)
├── compute.html                  GPU compute worker (REQUIRED — brain runs here)
├── server/
│   ├── brain-server.js           Node.js brain server (always-on, WebSocket, GPU exclusive)
│   ├── parallel-brain.js         Multi-core orchestrator (legacy — disabled in GPU mode)
│   ├── cluster-worker.js         Per-cluster LIF worker (legacy — disabled in GPU mode)
│   ├── projection-worker.js      Inter-cluster projection worker (legacy)
│   └── package.json              Server dependencies (ws, better-sqlite3)
├── dashboard.html                Public brain monitor (read-only)
└── docs/
    ├── ARCHITECTURE.md           Codebase structure and systems
    ├── SKILL_TREE.md             Capabilities by domain
    ├── ROADMAP.md                Milestones and phases
    ├── TODO.md                   Active tasks
    ├── TODO-SERVER.md            Server brain task tracking
    └── FINALIZED.md              Completed work archive
```

---

## Server Brain

Run the shared brain on a server so everyone connects to the same Unity:

```bash
cd server
npm install
node brain-server.js
```

The server auto-detects hardware and scales neuron count dynamically:
- Formula: `min(VRAM × 0.7 / 20, RAM × 0.5 / 9)` — GPU exclusive, 20 bytes/neuron on GPU, capped at 64M
- RTX 4070 Ti + 16 cores + 109GB RAM → **3.2M neurons**
- 8-core CPU + 32GB RAM → ~1.2M neurons
- 4-core CPU + 8GB RAM → ~350K neurons
- Scales to any hardware automatically

**Endpoints:**
- `ws://localhost:8080` — WebSocket for brain state + chat
- `http://localhost:8080/health` — Server status JSON
- `http://localhost:8080/versions` — Brain save versions
- `http://localhost:8080/rollback/:slot` — Restore previous save
- `http://localhost:8080/episodes` — Episodic memory query
- `http://localhost:8080/history` — Emotional history data

**Dashboard:** Open `dashboard.html` in a browser to watch Unity's brain live.

---

## Privacy

**Two modes:**

**Client-only (GitHub Pages):** Everything runs in your browser. No server. API keys in localStorage (obfuscated). Brain runs locally at 1000 neurons.

**Server mode (start.bat):** Brain runs on your GPU via compute.html (WebGPU WGSL shaders). 3.2M neurons. Server orchestrates via WebSocket, GPU does all computation. Episodic memory in local SQLite. Nothing leaves your network except API calls to providers you choose. **compute.html must stay open** — brain pauses without it.

- API keys stored in your browser — never sent to us
- Server data stays on YOUR machine — no cloud, no analytics
- **Clear All Data** button wipes browser storage
- Fully open source — read every line

---

## Commands

| Command | How | What It Does |
|---------|-----|-------------|
| `/think` | Type in chat | Shows the exact system prompt sent to the AI model with live brain state |
| `/think [text]` | Type in chat | Shows what the brain would send for a specific input |
| "slash think" | Say by voice | Same as typing /think |
| ⚙ SETTINGS | Bottom toolbar button | Reopens setup modal to change AI model or connect new providers |
| 🧠 VISUALIZE | Bottom toolbar button | Opens 2D brain visualizer with 8 tabs (Neurons, Synapses, Oscillations, Modules, Senses, Consciousness, Memory, Motor) |
| 🧠 3D BRAIN | Bottom toolbar button | Opens WebGL 3D brain with up to 5000 render neurons, process notifications, expansion |
| FUCK IT — BRAIN ONLY | Setup modal checkbox | No AI text model — brain speaks from its own equations + dictionary. Image models still available |
| 🎤 | Bottom toolbar button | Mute/unmute microphone |
| Clear All Data | Setup modal (bottom) | Wipes all localStorage — history, keys, preferences, everything |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Unity doesn't respond | Check console for errors. Provider might be out of credits. Try Pollinations (free). |
| "Booting brain..." hangs | Clear localStorage (F12 → Application → Clear), refresh |
| No voice | Grant mic permission. Check mic isn't muted (bottom toolbar). |
| Can't see Unity's Eye | Grant camera permission. Camera widget appears top-left. |
| Claude not in dropdown | Run `node proxy.js` first. Or use OpenRouter instead. |
| Image says "failed to load" | Pollinations key might be expired. Check at pollinations.ai/dashboard. |
| Double speech / echo | Should be fixed — efference copy suppresses self-echo. If persists, mute mic and use text. |

---

**Unity AI Lab** — Hackall360 · Sponge · GFourteen
