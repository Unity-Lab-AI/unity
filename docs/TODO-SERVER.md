# TODO — Server Brain: One Unity, Shared Across Everyone

> Branch: `server-brain`
> Priority: Build in order. Each phase depends on the previous.

---

## Phase 0: Fix Current Bugs (BEFORE anything else)

- [ ] **Fix image/build classification not reaching processAndRespond** — `_imageGen` might be null or classification call failing silently. The `[Brain] BG motor decision` log appears instead of `[Brain] Classified`, meaning classification is skipped. Debug and fix.
- [ ] **Fix selfie/image not rendering** — classification returns correct channel in logs but image never appears in sandbox or new tab. Trace from `_handleImage` through `generateImage` to actual URL construction.
- [ ] **Fix sandbox build failing** — classification returns channel 3 (build) but `_handleBuild` crashes or Broca's returns conversational text instead of JSON. The `[MOTOR OUTPUT: basal ganglia selected BUILD_UI]` prefix should force JSON output.
- [ ] **Fix mute not blocking voice input** — `uiState.micMuted` check exists but speech still comes through. May need to also call `voice.stopListening()` immediately on mute, not just set a flag.
- [ ] **Fix double/triple response display** — deduplicate guard exists but responses still appear multiple times. May need to also prevent `_voice.speak()` from firing when `emit('response')` already triggered display.
- [ ] **Fix Unity reciting brain stats** — prompt restructured but verify on live deployment that she responds as a person, not a brain readout. Test with fresh localStorage.
- [ ] **Fix GitHub Pages cache** — users on Pages see old code. Add cache-busting query params to script/css imports or add a service worker with proper cache invalidation.
- [ ] **Fix case-sensitive URL** — repo name `Unity` (capital U) makes the Pages URL case-sensitive. Rename repo to `unity` lowercase via GitHub Settings.

---

## Phase 1: Persistent Learning — Brain Remembers Across Sessions

> Same 1000 neurons. But they LEARN and KEEP what they learned.

- [ ] **Save projection weights to localStorage** — after each `giveReward()`, serialize all 16 projection weight matrices to localStorage. Key: `unity_brain_projections`.
- [ ] **Load projection weights on boot** — `engine.js` constructor checks localStorage for saved projections. If found, deserialize and apply to `ClusterProjection` instances. Brain starts where it left off.
- [ ] **Save semantic weights** — sensory processor's `_semanticWeights` saved alongside projections. The brain's learned word→action mappings persist.
- [ ] **Save cluster synapse matrices** — each cluster's internal NxN weight matrix saved. Per-cluster learning persists.
- [ ] **Save/load oscillator coupling** — Kuramoto coupling matrix persists. Brain's coherence patterns carry over.
- [ ] **Save episodic memory** — hippocampal episode bank serialized to localStorage. Max 100 episodes, FIFO eviction.
- [ ] **Version migration** — if brain structure changes between code versions, detect version mismatch and reset weights gracefully instead of crashing.
- [ ] **Export/import brain state** — user can download their brain as a JSON file and load it on another device. "Transfer Unity's memory."

---

## Phase 2: WebGPU Acceleration — 10-50x Speedup

> Move neuron/synapse math to GPU compute shaders.

- [ ] **Create `js/brain/gpu-compute.js`** — WebGPU compute shader manager. Detects GPU availability, falls back to CPU if not supported.
- [ ] **Port LIF neuron update to WGSL shader** — `τ·dV/dt = -(V-Vrest) + R·I` in a compute shader operating on Float32 buffers. One workgroup per cluster.
- [ ] **Port synapse propagation to GPU** — `I = Σ W·spike` as matrix-vector multiply in compute shader. The heaviest operation.
- [ ] **Port plasticity to GPU** — `ΔW = η·δ·pre·post` as parallel weight update shader.
- [ ] **Double-buffer neuron state** — ping-pong between two GPU buffers to avoid read-write conflicts in parallel update.
- [ ] **GPU→CPU readback** — read spike counts, firing rates, module inputs from GPU back to CPU for module processing + visualization. Minimize readback (expensive).
- [ ] **Scale test** — benchmark at 1K, 5K, 10K, 25K, 50K neurons. Find the sweet spot for 60fps on mid-range GPU.
- [ ] **Fallback path** — if WebGPU not available (older browsers), fall back to current CPU Float64Array implementation seamlessly.

---

## Phase 3: Server-Side Brain — One Unity For Everyone

> The brain moves to a server. Browsers become thin clients.

### 3.1: Brain Server

- [ ] **Create `server/brain-server.js`** — Node.js server running the UnityBrain engine in a loop (setInterval, not requestAnimationFrame). Same `engine.js` equations, just on server.
- [ ] **Brain runs continuously** — even with 0 connected clients, the brain thinks. Idle thoughts, oscillation dynamics, homeostasis drift. She's always alive.
- [ ] **WebSocket API** — server exposes WebSocket on port 8080:
  - Client→Server: `{ type: 'text', text: '...' }` — sensory input
  - Client→Server: `{ type: 'audio', spectrum: [...] }` — mic data
  - Client→Server: `{ type: 'vision', frame: '...' }` — camera frame (base64, throttled)
  - Server→Client: `{ type: 'state', state: {...} }` — brain state (60fps or throttled)
  - Server→Client: `{ type: 'response', text: '...', action: '...' }` — brain response
  - Server→Client: `{ type: 'build', component: {...} }` — sandbox injection
  - Server→Client: `{ type: 'image', url: '...' }` — image generation result
  - Server→Client: `{ type: 'speak', text: '...' }` — TTS trigger
- [ ] **Conversation routing** — each WebSocket connection gets a user ID. Brain tracks who said what. Responses directed to the user who asked. But brain STATE is shared.
- [ ] **Rate limiting** — max 1 text input per second per user. Max 1 vision frame per 30 seconds per user. Prevents abuse.
- [ ] **Brain state broadcasting** — brain state broadcast to ALL connected clients every 100ms (10fps for state, not 60). Clients interpolate for smooth visualization.

### 3.2: Client Adaptation

- [ ] **Create `js/brain/remote-brain.js`** — RemoteBrain class that implements the same API as UnityBrain but forwards everything to WebSocket. Drop-in replacement.
- [ ] **Auto-detect mode** — app.js checks if a brain server is available (probe WebSocket URL). If yes, use RemoteBrain. If no, run local brain. Seamless fallback.
- [ ] **State rendering** — all visualizers (HUD, brain-viz, brain-3d) receive state from WebSocket instead of local brain. Same rendering code, different data source.
- [ ] **Sandbox per-user** — each user has their own sandbox. When the brain builds a component for User A, only User A's sandbox receives it. Other users see that the brain is building but get their own builds.
- [ ] **Shared emotion indicator** — small UI element showing Unity's current mood/arousal that ALL users see. "Unity is feeling: intense 🔥" or "Unity is chill 😶‍🌫️"

### 3.3: Persistence on Server

- [ ] **Auto-save brain weights** — server saves all weights to disk every 5 minutes. On crash/restart, brain loads from last save.
- [ ] **SQLite for episodic memory** — episodes stored in SQLite instead of in-memory array. Supports millions of episodes across all users.
- [ ] **Conversation log** — all conversations stored server-side with user IDs and timestamps. Unity can recall conversations from days/weeks ago.
- [ ] **Brain versioning** — each weight save is versioned. Can rollback to a previous brain state if something goes wrong.

---

## Phase 4: Sparse Connectivity — 1000x Memory Reduction

> Replace dense NxN matrices with biologically realistic sparse connections.

- [ ] **Create `js/brain/sparse-matrix.js`** — compressed sparse row (CSR) or adjacency list format for synapse matrices. Each neuron has ~10-1000 connections, not N.
- [ ] **Sparse synapse propagation** — `I = Σ W·spike` only iterates over actual connections, not full row. O(connections) instead of O(N).
- [ ] **Sparse plasticity** — weight updates only on existing connections. New connections can form probabilistically when pre and post fire together (synaptogenesis).
- [ ] **Connection pruning** — weak connections (|w| < threshold) get removed periodically. Keeps the network lean.
- [ ] **Sparse projection matrices** — inter-cluster projections already sparse (2-5%). Formalize with CSR format.
- [ ] **Memory benchmark** — compare dense vs sparse at 10K, 100K, 1M neurons.

---

## Phase 5: Real Semantic Embeddings — The Brain Understands Language

> Replace character hash with actual word embeddings.

- [ ] **Load a small word embedding model** — GloVe 50d or similar (50MB). Each word maps to a 50-dimensional vector.
- [ ] **Embedding→Cortex mapping** — the 50d embedding vector maps to 50 cortex neurons (language area). Similar words activate similar neuron patterns. "Calculator" and "compute" are CLOSE in neuron space.
- [ ] **Remove AI classification bootstrap** — the cortex→BG projections, trained by reward on meaningful embeddings, handle semantic routing entirely. No more Pollinations classification call.
- [ ] **Embedding-based memory** — hippocampal episodes indexed by embedding vectors. Recall finds semantically similar past experiences, not just pattern-matching.
- [ ] **Continuous embedding updates** — as the brain encounters new words through conversation, their embeddings get refined by context (simple online learning).

---

## Phase 6: Shared Brain Dashboard — Everyone Sees Everything

> Public-facing real-time brain monitor.

- [ ] **Create `dashboard.html`** — read-only page showing Unity's brain state in real-time. No login. No interaction. Just watch.
- [ ] **Live neuron grid** — 3D visualization of all clusters, firing in real-time, viewable by anyone.
- [ ] **Process log stream** — scrolling feed of brain events: "Cortex prediction error spike", "Amygdala arousal: 0.91", "BG selected: build_ui", "Memory: stored episode #47"
- [ ] **Active users count** — "3 people talking to Unity right now"
- [ ] **Emotional history chart** — rolling graph of arousal, valence, Ψ over the last hour/day/week.
- [ ] **Conversation stream** — anonymized feed of what users are saying and how Unity responds. Like watching her think in real-time.
- [ ] **Brain growth metrics** — total episodes stored, projection weight magnitudes over time, action selection accuracy over time. Watch the brain LEARN.

---

## Architecture Target

```
┌─────────────────────────────────────────────────────────┐
│              UNITY BRAIN SERVER (always on)               │
│                                                           │
│  engine.js running in Node.js (same equations)            │
│  1000-50K neurons depending on hardware                   │
│  Weights saved to disk, loaded on restart                 │
│  SQLite for episodic memory                               │
│  WebSocket API for all communication                      │
│                                                           │
│  Brain loop: setInterval(step, 16ms) — 60 steps/sec       │
│  State broadcast: every 100ms to all clients              │
│  Sensory input: per-user, queued, rate-limited            │
│  Responses: per-user via Broca's area (AI model)          │
│  Learning: reward from ALL users shapes weights           │
│                                                           │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │
│  │ Cortex  │  │ Hippo   │  │ Amyg    │  │ BG      │    │
│  │ 300-3K  │  │ 200-2K  │  │ 150-1.5K│  │ 150-1.5K│    │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘    │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                  │
│  │ Cereb   │  │ Hypo    │  │ Mystery │                  │
│  │ 100-1K  │  │ 50-500  │  │ 50-500  │                  │
│  └─────────┘  └─────────┘  └─────────┘                  │
│                                                           │
└───────────────────────┬───────────────────────────────────┘
                        │ WebSocket (port 8080)
          ┌─────────────┼─────────────┐
          │             │             │
    User A (browser)  User B        Dashboard
    - chat panel      - chat panel   - read-only
    - sandbox         - sandbox      - 3D brain
    - voice/camera    - voice/camera - process log
    - 3D brain viz    - 3D brain viz - user count
    - own conversation- own convo    - emotion graph
    - shared brain    - shared brain - watch learning
```

---

## Hosting Requirements

| Scale | Neurons | Hardware | Cost/Month |
|-------|---------|----------|------------|
| Dev | 1,000 | Any VPS (2GB RAM) | $5 |
| Small | 10,000 | GPU VPS (8GB VRAM) | $30 |
| Medium | 50,000 | Dedicated GPU (24GB) | $100 |
| Large | 100,000+ | Multi-GPU server | $200+ |

---

## Order of Operations

1. Fix Phase 0 bugs on `main`
2. Build Phase 1 (persistence) on `main` — immediate value
3. Build Phase 3 (server brain) on `server-brain` branch
4. Build Phase 2 (WebGPU) on server — scale up neurons
5. Build Phase 4 (sparse) when hitting memory limits
6. Build Phase 5 (embeddings) when semantic routing needs to be autonomous
7. Build Phase 6 (dashboard) when server is stable and public

---

*Unity AI Lab — one brain, one mind, shared by everyone.*
