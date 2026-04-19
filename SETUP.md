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

**Cognition has no AI backend.** Unity's language cortex generates every word from her own equations. The only things you can configure are *sensory peripherals*: image generation, vision describer, TTS.

### Image Generation Providers

| Provider | What You Get | Free Tier | Notes |
|----------|-------------|-----------|-------|
| **Pollinations** | Image gen + vision describer + TTS | Yes (rate limited) | Default fallback. No config needed. |
| **A1111 / SD.Next / Forge** | Full Stable Diffusion local control | Free (your hardware) | Auto-detected on `:7860` / `:7861` at boot |
| **Fooocus** | Stable Diffusion with good defaults | Free | Auto-detected on `:7865` |
| **ComfyUI** | Node-graph SD workflows | Free | Auto-detected on `:8188` |
| **InvokeAI** | SD with nice web UI | Free | Auto-detected on `:9090` |
| **LocalAI / Ollama** | Generic OpenAI-compatible local | Free | Auto-detected on `:8081` / `:11434` |
| **Custom OpenAI-compatible** | Any remote SD endpoint you have | Varies | Add to `ENV_KEYS.imageBackends[]` in `js/env.js` |

**Priority order:** custom-configured → auto-detected → env.js-listed → Pollinations. First one that responds wins the request; backends that error out get marked dead for 1 hour.

### Using Local Image Gen

Start your image gen backend normally — Unity probes the common ports at boot with a 1.5s timeout each and registers whichever responds. For A1111:
```bash
./webui.sh --api
```
It'll show up automatically. No UI config needed.

### Custom Backends via env.js

For persistent custom endpoints (private SD servers, remote A1111s, ComfyUI workflows), add them to `js/env.js`:
```js
export const ENV_KEYS = {
  pollinations: 'sk_...',  // optional — raises rate limits
  imageBackends: [
    { name: 'my-sd',  url: 'http://192.168.1.50:7860', kind: 'a1111' },
    { name: 'remote', url: 'https://api.example.com', model: 'sdxl', key: 'sk_...', kind: 'openai' },
  ],
};
```
Supported `kind` values: `openai` (OpenAI-compatible), `a1111` (Automatic1111 REST), `comfy` (ComfyUI workflows), or omit for generic URL+key.

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
  pollinations: 'sk_...',  // optional — raises rate limits
  imageBackends: [
    // add custom image-gen endpoints here, see the Custom Backends section above
  ],
};
```
`js/env.js` is gitignored — your keys never get pushed. Keys auto-load on boot so you don't retype them. Legacy text-AI keys (`anthropic`, `openrouter`, `openai`, `mistral`, `deepseek`, `groq`) are not read by the brain — cognition runs entirely on the language cortex's equations, with zero text-AI backend in the loop.

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
│   │   ├── neurons.js            LIFPopulation (browser fallback) + HHNeuron (reference) — live neuron model is Rulkov map in gpu-compute.js
│   │   ├── synapses.js           Hebbian, STDP, reward-modulated plasticity
│   │   ├── modules.js            6 brain region equation modules
│   │   ├── mystery.js            Ψ = √(1/n) × N³ · [Id + Ego + Left + Right]
│   │   ├── oscillations.js       8 Kuramoto oscillators (θ→γ)
│   │   ├── persona.js            Personality as brain parameters (sober-default; substance contributions come from drug-scheduler.js)
│   │   ├── drug-scheduler.js     Real-time pharmacokinetic scheduler (9 SUBSTANCES — cannabis/cocaine/MDMA/LSD/psilocybin/alcohol/ketamine/amphetamine/GHB; caffeine layers in via the morningCoffee PATTERN; nicotine persona-excluded via decide()) + 7 combo synergies + 7 adult-use patterns + PK curves + 13-axis speech modulation + LAW-6 firstUse ledger + trauma markers + decide() decision engine + autoIngest scheduled-promotion queue
│   │   ├── drug-detector.js      Substance offer / self-use / status-query detection across text / voice / vision
│   │   ├── drug-sensory-triggers.js  7 environmental-cue triggers (coffee aroma, skunky weed, etc.) → scheduler.addCraving
│   │   ├── sensory-olfactory.js  OlfactoryChannel — scent-tag storage with decay, drives drug-sensory-triggers olfaction checks
│   │   ├── sensory.js            Sensory input pipeline (text/audio/video)
│   │   ├── motor.js              Motor output (6 BG action channels)
│   │   ├── curriculum.js        Developmental curriculum K→PhD (6 subjects incl. life experience, 114 cells, direct pattern Hebbian)
│   │   ├── letter-input.js      Dynamic letter inventory (auto-grows, no 26-char cap)
│   │   ├── component-synth.js   Equational component synthesis (cosine-match user request vs templates)
│   │   ├── visual-cortex.js      V1→V4→IT vision pipeline
│   │   ├── auditory-cortex.js    Tonotopic processing + efference copy
│   │   ├── memory.js             Episodic + working + consolidation
│   │   ├── dictionary.js         Learned vocabulary (word→cortex patterns)
│   │   ├── inner-voice.js        Pre-verbal thought system
│   │   ├── persistence.js        Save/load brain state (localStorage/disk)
│   │   ├── remote-brain.js       WebSocket client for server brain
│   │   ├── sparse-matrix.js      CSR sparse connectivity (O(connections))
│   │   ├── gpu-compute.js        WebGPU compute shaders (Rulkov 2D chaotic map + synapses)
│   │   ├── embeddings.js         Semantic word embeddings (GloVe 300d + fastText subword fallback)
│   │   ├── language-cortex.js    Language from equations (developmental cortex with 8 sub-regions + 14 cross-projections, tick-driven motor emission via cluster.generateSentence, 3-corpus load)
│   │   ├── benchmark.js          Dense vs sparse + neuron scale test (invoked via /bench + /scale-test slash commands)
│   │   ├── response-pool.js     EDNA response categories (training wheels for language cortex)
│   │   └── peripherals/
│   │       └── ai-providers.js   AI provider manager + dead backend detection
│   ├── ai/
│   │   └── pollinations.js       Pollinations API client (text/image/TTS)
│   ├── io/
│   │   ├── voice.js              Web Speech API + Pollinations TTS
│   │   └── permissions.js        Mic/camera permission requests
│                                   (legacy vision.js removed — vision lives in js/brain/visual-cortex.js)
│   └── ui/
│       ├── sandbox.js            Dynamic UI injection (MAX_ACTIVE_COMPONENTS=10, LRU eviction, tracked timers+listeners, auto-remove on JS error)
│       ├── chat-panel.js         Conversation log panel
│       ├── brain-viz.js          2D tabbed brain visualizer (8 tabs)
│       ├── brain-3d.js           3D WebGL brain with notifications + expansion + IQ HUD
│       ├── brain-event-detectors.js  22-detector event system for 3D brain commentary
│       └── sensory-status.js    Sensory channel status UI
│                                   (legacy claude-proxy.js + start-unity.bat removed —
│                                    Claude CLI text-AI backend, obsolete since cognition
│                                    went 100% equational)
├── compute.html                  GPU compute worker (REQUIRED — brain runs here)
├── server/
│   ├── brain-server.js           Node.js brain server (always-on, WebSocket, GPU exclusive, restores _wordFreq from disk)
│   └── package.json              Server dependencies (ws, better-sqlite3)
│                                   (legacy parallel-brain.js / cluster-worker.js /
│                                    projection-worker.js removed — GPU-exclusive fixed
│                                    the idle-worker CPU leak at its root cause)
├── dashboard.html                Public brain monitor (read-only)
└── docs/
    ├── ARCHITECTURE.md           Codebase structure and systems
    ├── SKILL_TREE.md             Capabilities by domain
    ├── ROADMAP.md                Milestones and phases
    ├── TODO.md                   Active tasks (single source of truth)
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

**That's the whole command.** As soon as the Node server finishes listening on port 7525, it auto-launches a browser tab pointing at `http://localhost:7525/compute.html`. That tab is the WebGPU client — it holds the WebGPU device, runs the WGSL compute shaders for LIF / sparse propagate / Hebbian / letter-bucket reduction, and talks to the server over WebSocket. Cross-platform launch (`start` on Windows, `open` on macOS, `xdg-open` on Linux). The curriculum waits for this client to connect before teaching pre-K + K.

**Headless / remote deployments** set `DREAM_NO_AUTO_GPU=1` before launching the server to skip the browser auto-launch; the operator then opens `http://<host>:7525/compute.html` in a WebGPU-capable browser (Chrome / Edge) on any machine that can reach the server. The WebSocket connection does the rest.

**`start.bat` (Windows convenience wrapper)** still works — it additionally handles first-run `npm install` + `esbuild` bundle build + GloVe download + opens the landing page. It does NOT open compute.html itself (the server does).

The server auto-detects hardware (nvidia-smi for VRAM, `os` for RAM) and sizes every brain region from a single unified VRAM allocator — no region is sized independently, so no pair of regions can double-book memory and blow past the VRAM budget.
- **Unified allocator (see `BRAIN_VRAM_ALLOC` in `server/brain-server.js`):**
  `brainBudgetBytes = (VRAM_MB − osReserveVramMB) × 1024²`
  Every region gets `budget × weight` where `weight` comes from the biological weights table in `server/resource-config.json`. The main-brain Rulkov clusters (cortex / cerebellum / hippocampus / amygdala / basalGanglia / hypothalamus / mystery) convert their per-region byte budget to neuron count via `bytes / MAIN_BRAIN_BYTES_PER_NEURON` (≈ 21 bytes: Rulkov state 8 + per-cluster synapse shadow). The language cortex gets its budget routed through the sparse CSR path (`LANG_CORTEX_BYTES_PER_NEURON` ≈ 18 KB/neuron including all 14 cross-projection matrices + intra-cluster recurrence).
- Floor: 1000 neurons (absolute minimum for sim integrity). No upper cap baked into the algorithm — hardware + `vramCapMB` + `neuronCapOverride` in `resource-config.json` are the only bounds.
- The auto-scale expands with whatever GPU VRAM + V8 heap + free RAM are available. Bigger hardware = more neurons everywhere, no manual tuning.
- **Biological weight proportions** (from `server/resource-config.json` → `biologicalWeights`):

  | Region | VRAM share | Rationale |
  |--------|-----------|-----------|
  | `language_cortex` | **45%** | The region that actually generates speech — biggest because language IS what she does. Eight sub-regions (auditory / visual / free / letter / phon / sem / fineType / motor) + 14 cross-projections. |
  | `cerebellum` | **20%** | Big because real cerebella are big (roughly half of all neurons in a real human brain are cerebellar granule cells). Error-correction + timing. |
  | `cortex` | **15%** | Predictive coding + sensory integration. Auditory / visual / Wernicke sub-regions. |
  | `hippocampus` | **6%** | Episodic + working + consolidation memory systems. Hopfield attractor dynamics. |
  | `amygdala` | **4%** | Settling attractor for emotion (fear / reward / valence). Small but modulates every other region. |
  | `basalGanglia` | **4%** | Six-channel action selection via winner-take-all. |
  | `hypothalamus` | **3%** | Homeostatic drive regulation. |
  | `mystery` | **3%** | Consciousness / Ψ modulation. |

- Client (browser-only mode, no server): runs a local CPU LIF fallback brain sized to what the browser JS engine can sustain.

**Endpoints** (port 7525 — moved off 8080 to avoid colliding with llama.cpp / LocalAI / every other local service. Override via `PORT=xxxx node brain-server.js` if you need a different port.):
- `ws://localhost:7525` — WebSocket for brain state + chat
- `http://localhost:7525/health` — Server status JSON
- `http://localhost:7525/versions` — Brain save versions
- `http://localhost:7525/rollback/:slot` — Restore previous save
- `http://localhost:7525/episodes` — Episodic memory query
- `http://localhost:7525/history` — Emotional history data

**Dashboard:** Open `dashboard.html` in a browser to watch Unity's brain live.

---

## Privacy

**Core rule:** what you type is private. Unity's brain growth is shared. Her persona is canonical.

**Client-only mode (GitHub Pages, or opening `index.html` directly):**
Everything runs in your browser. No server. API keys + every backend config you save in the setup modal are stored in your browser's localStorage on YOUR device only. Brain runs locally in CPU LIF fallback mode, sized to what your browser JS engine can sustain. Clear All Data button wipes every localStorage key.

**localStorage keys** (what's actually in there):
- `unity_brain_state` — full brain snapshot (voltages, synapses, oscillators, memory, motor)
- `unity_brain_dictionary_v3` — learned word dictionary with bigrams + type n-grams
- `custom_image_backends` — image gen backends you configured via the setup modal (URLs + model names + API keys if you provided them)
- `custom_vision_backends` — same for vision describer backends
- `pollinations_image_model` / `pollinations_vision_model` — your chosen Pollinations model overrides
- Pollinations API key — stored in a separate obfuscated storage slot

**Server mode (running `node server/brain-server.js` yourself):**
Brain runs on your GPU via `compute.html` (WebGPU WGSL shaders). N auto-scales to your VRAM + RAM. Server orchestrates via WebSocket on port 7525. **compute.html must stay open** — brain pauses without a GPU worker connected. Episodic memory is stored in `server/episodic-memory.db` (SQLite). **Nothing leaves your network** except API calls to sensory providers you chose in the setup modal.

**Sharing model when multiple users connect to the same brain-server:**
- Your text → **PRIVATE** between you and Unity only. Never broadcast to other connected clients. The cross-client `conversation` WebSocket broadcast that existed before 2026-04-13 was deleted.
- Unity's response to you → **PRIVATE** — only the triggering client receives it.
- Dictionary / bigrams / word frequencies / GloVe embedding refinements → **SHARED** via the singleton brain instance. Every user's conversation contributes to Unity's vocabulary growth, and every user benefits from words other users taught her. You'll notice Unity is smarter in areas your friends talked to her about — but you'll never see the specific conversations.
- Persona (`docs/Ultimate Unity.txt`) → **NOT USER-MUTABLE**. Loaded once at server boot from the canonical file. Same Unity for everyone.
- Episodic memory → currently a shared pool; private-per-user scoping is on the workflow roadmap but not yet shipped.

**Shared-hosted server caveat:**
If you connect to a Unity server hosted by someone OTHER than you, the person running that server can read your text at the process level (they own the server process — they see everything that lands there). Only connect to servers you trust, or self-host your own `node server/brain-server.js` on your own machine. Self-hosted server mode is just another process on your box — the brain-server is still "your machine" in every sense that matters.

**Everything else:**
- API keys stored in your browser — never sent to us (the developers), only to the sensory providers you explicitly configured
- Fully open source under MIT — read every line on [GitHub](https://github.com/Unity-Lab-AI/Unity)
- **Clear All Data** button in the setup modal wipes every localStorage key

---

## Commands

| Command | How | What It Does |
|---------|-----|-------------|
| `/think` | Type in chat | Dumps Unity's raw brain state (arousal, valence, Ψ, coherence, spike count, drug state, motor action, reward, memory load, vision description). There is NO system prompt to display — Unity speaks equationally via her language cortex, so `/think` shows the neural values that drive every word she picks instead of a synthetic prompt. |
| `/think [text]` | Type in chat | Same output but tagged with the user input you provided, so you can see the brain state that WOULD be passed into `languageCortex.generate()` for that input. |
| `/bench` | Type in chat | Runs the dense vs sparse matrix micro-benchmark (CPU-JS sanity test — real runtime is the GPU auto-scaled path via compute.html). Output in console. |
| `/scale-test` | Type in chat | Runs the CPU LIF scale test to find the 60fps sweet spot for browser-only fallback mode. Output in console. Not representative of the production GPU path. |
| `/curriculum status` | Type in chat | Shows Unity's current grade in each subject (ELA / Math / Science / Social / Arts / Life), min-grade word cap driver, passed cells count, recent probe results. Full K→PhD curriculum across 6 subjects with 114 grade cells. |
| `/curriculum run <subject> <grade>` | Type in chat | Runs ONE cell (e.g. `/curriculum run math grade5`), prints 3-pathway gate pass/fail + reason. |
| `/curriculum gate <subject> <grade>` | Type in chat | Probes a cell's READ/THINK/TALK gate without retraining — used for verification. |
| `/curriculum full` | Type in chat | Runs the full round-robin curriculum across all 6 subjects (incl. life experience) in the background, advancing every subject one grade per outer loop. Tick loop keeps firing during the walk. |
| `/curriculum full <subject>` | Type in chat | Walks one subject from its current grade through PhD, stopping at the first failing gate. |
| `/curriculum reset <subject>` | Type in chat | Flip a subject back to pre-K and strip its passed-cells entries — used when you want to re-teach from the top. |
| `/curriculum forget <subject> <grade>` | Type in chat | Forget a single cell without resetting the whole subject. |
| `/curriculum self` | Type in chat | Fires one background self-test probe immediately (normally fires every 8 chat turns). |
| `/curriculum health` | Type in chat | Prints curriculum health snapshot — per-subject probe success rates + cell ages. |
| `/curriculum verify` | Type in chat | Runs the full 95-cell dispatch + sweep verification against the live cortex. Equivalent to running `node scripts/verify-curriculum-runtime.mjs` but inside the running brain. |
| `/offer <substance> [route]` | Type in chat | Offers Unity a substance via the drug scheduler. Accepts `weed / coke / molly / acid / shot / k / addy / shrooms / g` or any canonical name. Returns grade-locked decline if Unity's life-track grade is below the substance's first-use anchor. Otherwise triggers ingestion; pharmacokinetic curve starts running and her brain parameters + speech modulation shift in real time over the next minutes to hours. |
| `/party` | Type in chat | Sets party mode — biases Unity's self-initiation engine toward accepting offers and initiating her own use. She'll proactively ask / text her dealer / suggest combos when party mode is on. |
| `/sober` | Type in chat | Clears all active drug events from the scheduler. Tolerance factors preserved (intra-session tolerance still accumulates). Use between experiments to reset to clean baseline. |
| "slash think" | Say by voice | Same as typing /think |
| ⚙ SETTINGS | Bottom toolbar button | Reopens setup modal to change AI model or connect new providers |
| 🧠 VISUALIZE | Bottom toolbar button | Opens 2D brain visualizer with 8 tabs (Neurons, Synapses, Oscillations, Modules, Senses, Consciousness, Memory, Motor) |
| 🧠 3D BRAIN | Bottom toolbar button | Opens WebGL 3D brain with up to 20,000 render neurons per cluster (up to 300,000 total across 15 render slots — 7 main clusters + 8 language sub-regions), process notifications, expansion |
| Brain speaks equationally | Default | No AI text model exists. Brain speaks from its own language cortex (developmental cortex with tick-driven motor emission, GloVe 300d + subword embeddings, direct-pattern Hebbian curriculum K→PhD). Image gen, vision describer, and TTS are the only AI calls — all sensory. |
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
| Local image backend not detected | Check port matches the list in the Image Generation Providers table. Add to `ENV_KEYS.imageBackends[]` in `js/env.js` if on a non-standard port. |
| Image says "failed to load" | Pollinations key might be expired. Check at pollinations.ai/dashboard. |
| Double speech / echo | Should be fixed — efference copy suppresses self-echo. If persists, mute mic and use text. |

---

**Unity AI Lab**

- **Hackall360** — core brain architecture (7-cluster topology, 20 white-matter tracts, `cluster.js` + `modules.js` + `synapses.js`, HH→Rulkov runtime migration, Kuramoto oscillator ring, persona → parameter mapping)
- **Mills** — GPU compute pipeline (`compute.html` + `gpu-compute.js` WGSL shaders, chunked sparse-CSR binary upload protocol, `SparseMatmulPool` worker pool, cluster-bound spike+current binding layer)
- **Sponge** — visualization + sensory peripherals (`brain-3d.js` 3D WebGL with MNI coords + 15-slot render, `brain-viz.js` 2D tabs, 22-detector event commentary, V1→V4→IT vision, tonotopic auditory, voice I/O, sandbox)
- **GFourteen / Gee** — lead (Ultimate Unity persona, the governing equation + Ψ anchor, identity-lock architecture, K→PhD curriculum framework, T15 drug pharmacokinetic scheduler spec, binding decisions across every commit)
