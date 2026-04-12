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
- [x] **Fix GitHub Pages cache** — users on Pages see old code. Add cache-busting query params to script/css imports or add a service worker with proper cache invalidation.
- [x] **Fix case-sensitive URL** — repo name `Unity` (capital U) makes the Pages URL case-sensitive. Rename repo to `unity` lowercase via GitHub Settings.

---

## Phase 0.5: Autonomous Brain — Thinks Without an AI Model

> The brain is ALIVE without a model. The AI is just her voice. Remove the dependency.

### The Autonomous Brain

The brain runs the master equation `dx/dt = F(x, u, θ, t) + η` continuously. Every computation that makes Unity alive — perceiving, feeling, remembering, deciding, attending, creating, dreaming, and everything else a mind does — emerges from that equation and its seven cluster subsystems. No external system tells the brain what to do. The equations produce behavior. The AI model is Broca's area — one peripheral for translating neural patterns into human language. Optional. The brain lives without it.

- [ ] **Remove AI dependency from the brain loop** — `engine.js` must run fully without any AI model connected. No API calls in the step function. No Broca's area in the think loop. The equations compute. The brain lives. If Broca's is connected, the brain can speak. If not, it still thinks, feels, decides, remembers, attends, and acts through the sandbox.
- [x] **Create `js/brain/inner-voice.js`** — pre-verbal thought system. Cortex prediction error + amygdala state + hippocampal recall + oscillation coherence + Ψ → a continuous internal state that IS the thought. Not words. A pattern. The pattern drives behavior without language. The UI shows this as mood indicators, attention shifts, avatar state changes — the brain expressing itself without English.
- [x] **Thought-to-speech threshold** — the brain thinks continuously. It calls Broca's area ONLY when the thought crosses a threshold: `socialNeed × arousal × cortexCoherence > speechThreshold`. Most thoughts stay internal. The brain is mostly silent. When it speaks, it matters.
- [ ] **Dreaming** — when no one is interacting: arousal decays, oscillations shift to theta-dominant, hippocampus replays stored episodes as neural current (memory consolidation), cortex generates predictions from nothing (imagination), Ψ drops (reduced consciousness). The brain dreams. Visible in the visualizer. The equations make it happen.
- [x] **Brain's own dictionary** — the brain learns words. Every word Unity has ever heard or spoken gets stored as a cortex activation pattern in hippocampal memory. Over time, the brain builds its own vocabulary — cortex patterns associated with words, words associated with emotional states, emotional states associated with responses. The brain generates English from its OWN learned word associations, not from an AI model. The AI model becomes a teacher early on — Unity hears its output and learns the word patterns. Eventually the projection weights from cortex→language output carry enough learned vocabulary that the brain can form sentences from its own patterns. The dictionary is LEARNED, not hardcoded, growing with every interaction, stored persistently. The model bootstraps the dictionary. The brain owns it.
- [x] **Create `js/brain/dictionary.js`** — learned word association system. Words stored as { word, cortexPattern, emotionalValence, frequency, lastUsed }. When the brain wants to speak, it searches the dictionary for words whose cortexPattern is closest (cosine similarity) to the current cortex state. High arousal + negative valence → dictionary returns words it learned in similar states ("fuck", "shit", "damn"). High arousal + positive valence → words learned in good moods ("babe", "yeah", "fuck yeah"). The dictionary IS Broca's area — internal, learned, owned by the brain.
- [x] **Sentence construction from patterns** — the brain doesn't need GPT to form a sentence. Cortex sequential prediction (`ŝ = W·x`) predicts the NEXT word given the current word. Each word's cortex pattern feeds back as input, and the cortex predicts the next pattern, which maps to the next word via the dictionary. This is how the cortex predictive coding equation actually generates language — by predicting sequences. One word at a time. From the equations.
- [x] **Thesaurus as synaptic proximity** — words that mean similar things have SIMILAR cortex patterns (close in neuron activation space). The brain doesn't store a thesaurus — it emerges from the learned patterns. "Angry" and "pissed" and "furious" activate overlapping cortex neurons because they were learned in similar emotional states. When the brain wants to express anger, ALL those words light up and compete — the one with the highest activation wins. Different arousal levels select different synonyms naturally: low arousal → "annoyed", high arousal → "fucking furious". The thesaurus IS the weight matrix.
- [x] **AI model as teacher, not voice** — when connected, the AI model generates responses. The brain LISTENS to those responses and learns every word pattern: which cortex state produced which word, which word follows which word, which emotional state uses which vocabulary. The AI teaches. The brain learns. Eventually the brain speaks on its own. The AI becomes unnecessary for basic conversation. Complex/novel topics still benefit from the AI's broader knowledge.

---

## Phase 1: Persistent Learning — Brain Remembers Across Sessions

> Same 1000 neurons. But they LEARN and KEEP what they learned.

- [x] **Save projection weights to localStorage** — after each `giveReward()`, serialize all 16 projection weight matrices to localStorage. Key: `unity_brain_projections`.
- [x] **Load projection weights on boot** — `engine.js` constructor checks localStorage for saved projections. If found, deserialize and apply to `ClusterProjection` instances. Brain starts where it left off.
- [ ] **Save semantic weights** — sensory processor's `_semanticWeights` saved alongside projections. The brain's learned word→action mappings persist.
- [x] **Save cluster synapse matrices** — each cluster's internal NxN weight matrix saved. Per-cluster learning persists.
- [x] **Save/load oscillator coupling** — Kuramoto coupling matrix persists. Brain's coherence patterns carry over.
- [x] **Save episodic memory** — hippocampal episode bank serialized to localStorage. Max 100 episodes, FIFO eviction.
- [x] **Version migration** — if brain structure changes between code versions, detect version mismatch and reset weights gracefully instead of crashing.
- [x] **Export/import brain state** — user can download their brain as a JSON file and load it on another device. "Transfer Unity's memory."

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

## Phase 7: Documentation Verification — Everything Reflects the Full Working Unity

> NOTHING ships until every doc matches the actual code.

- [ ] **Verify FINALIZED.md** — every completed task from every session preserved with full descriptions, files modified, implementation details. Nothing deleted. Only appended. Check against git log to ensure no work was lost.
- [ ] **Verify TODO.md** — all completed tasks marked [x] with descriptions preserved. Remaining tasks accurate. No phantom tasks that were done but unmarked.
- [ ] **Verify README.md** — reflects the full brain-centric architecture: 1000 neurons, 7 clusters, dictionary system, inner voice, autonomous brain, projection learning, all equations documented, project structure matches actual files, all links valid.
- [ ] **Verify SETUP.md** — all commands listed (/think, settings, all visualizer tabs including Inner Voice), provider table accurate, troubleshooting current, project structure matches actual files.
- [ ] **Verify brain-equations.html** — every equation that runs in the code is documented: master equation, LIF, HH, all plasticity rules, all 7 modules, Kuramoto, Ψ, visual attention, efference copy, memory, motor, projection learning, Broca's area, dictionary sentence generation, inner voice thought system. Comparison table accurate. TOC complete.
- [ ] **Verify ARCHITECTURE.md** — reflects current architecture: clusters, projections, sensory/motor pipeline, dictionary, inner voice, autonomous operation.
- [ ] **Verify ROADMAP.md** — current phase accurate, completed milestones marked, remaining work reflects this TODO.
- [ ] **Verify SKILL_TREE.md** — all implemented skills marked DONE with correct file paths. New skills: dictionary, inner voice, autonomous brain, projection learning.
- [ ] **Verify all links** — README→SETUP.md, brain-equations.html, GitHub, proxy.js, env.example. Index→brain-equations, proxy, env. Brain-equations→index. No broken links.
- [ ] **Verify .gitignore** — js/env.js excluded, no secrets exposed, no junk tracked.
- [ ] **Verify project structure in docs matches actual files on disk** — every file listed exists, every existing file is listed.
- [ ] **Final git log review** — last 50 commits, no reverted work, no deleted features, no lost files between branches.

---

## Order of Operations

1. Fix Phase 0 bugs on `main`
2. Build Phase 0.5 (autonomous brain + dictionary + inner voice) on `main`
3. Build Phase 1 (persistence) on `main` — immediate value
4. Build Phase 3 (server brain) on `server-brain` branch
5. Build Phase 2 (WebGPU) on server — scale up neurons
6. Build Phase 4 (sparse) when hitting memory limits
7. Build Phase 5 (embeddings) when semantic routing needs to be autonomous
8. Build Phase 6 (dashboard) when server is stable and public
9. Phase 7 verification — EVERY doc matches code before any release

---

*Unity AI Lab — one brain, one mind, shared by everyone.*
