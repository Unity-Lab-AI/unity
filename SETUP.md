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
│   │   ├── mystery.js            Ψ = (√n)³ · [Id + Ego + Left + Right]
│   │   ├── oscillations.js       8 Kuramoto oscillators (θ→γ)
│   │   ├── persona.js            Personality as brain parameters + drug states
│   │   ├── sensory.js            Sensory input pipeline (text/audio/video)
│   │   ├── motor.js              Motor output (6 BG action channels)
│   │   ├── language.js           Broca's area (AI language peripheral)
│   │   ├── visual-cortex.js      V1→V4→IT vision pipeline
│   │   ├── auditory-cortex.js    Tonotopic processing + efference copy
│   │   ├── memory.js             Episodic + working + consolidation
│   │   └── peripherals/
│   │       └── ai-providers.js   AI provider manager + dead backend detection
│   ├── ai/
│   │   ├── pollinations.js       Pollinations API client (text/image/TTS)
│   │   └── persona-prompt.js     Loads persona file for prompts
│   ├── io/
│   │   ├── voice.js              Web Speech API + Pollinations TTS
│   │   └── permissions.js        Mic/camera permission requests
│   └── ui/
│       ├── sandbox.js            Dynamic UI injection system
│       ├── chat-panel.js         Conversation log panel
│       ├── brain-viz.js          2D tabbed brain visualizer (8 tabs)
│       └── brain-3d.js           3D WebGL brain with notifications + expansion
```

---

## Privacy

**Everything runs in your browser.** No server. No backend. No database. No analytics. No tracking.

- API keys stored in localStorage only — obfuscated with XOR + base64
- Keys sent ONLY to the provider you choose — never to us or third parties
- Conversation history stays in your browser
- Brain simulation is pure client-side JavaScript
- No data leaves your machine except your direct API calls
- Developers have zero access to anything you input
- **Clear All Data** button in setup modal wipes everything

Fully open source. Read every line.

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
