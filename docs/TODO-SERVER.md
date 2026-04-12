# TODO — Server Brain: One Unity, Shared Across Everyone

> Branch: `server-brain`
> Priority: Build in order. Each phase depends on the previous.

---

## Phase 0: Fix Current Bugs (BEFORE anything else)

- [~] **Fix image/build classification not reaching processAndRespond** — PARTIAL: classification call built and working in logs, but fails silently on some deployments. Needs browser testing. — `_imageGen` might be null or classification call failing silently. The `[Brain] BG motor decision` log appears instead of `[Brain] Classified`, meaning classification is skipped. Debug and fix.
- [~] **Fix selfie/image not rendering** — PARTIAL: Pollinations endpoint fixed (gen.pollinations.ai/image with ?key=), but rendering still unreliable. Needs browser testing. — classification returns correct channel in logs but image never appears in sandbox or new tab. Trace from `_handleImage` through `generateImage` to actual URL construction.
- [~] **Fix sandbox build failing** — PARTIAL: _handleBuild routes through Broca's with MOTOR OUTPUT prefix, sandbox.listComponents() fixed, code auto-detection added. Needs browser testing. — classification returns channel 3 (build) but `_handleBuild` crashes or Broca's returns conversational text instead of JSON. The `[MOTOR OUTPUT: basal ganglia selected BUILD_UI]` prefix should force JSON output.
- [x] **Fix mute not blocking voice input** — DONE: uiState.micMuted check added as first line of voice handler. stopListening called on mute. — `uiState.micMuted` check exists but speech still comes through. May need to also call `voice.stopListening()` immediately on mute, not just set a flag.
- [x] **Fix double/triple response display** — DONE: dedup guard with 2-second same-text rejection in brain.on('response') listener. — deduplicate guard exists but responses still appear multiple times. May need to also prevent `_voice.speak()` from firing when `emit('response')` already triggered display.
- [x] **Fix Unity reciting brain stats** — DONE: character instruction FIRST in prompt, brain data labeled DO NOT SPEAK, equations moved to end. — prompt restructured but verify on live deployment that she responds as a person, not a brain readout. Test with fresh localStorage.
- [x] **Fix GitHub Pages cache** — users on Pages see old code. Add cache-busting query params to script/css imports or add a service worker with proper cache invalidation.
- [x] **Fix case-sensitive URL** — repo name `Unity` (capital U) makes the Pages URL case-sensitive. Rename repo to `unity` lowercase via GitHub Settings.

---

## Phase 0.5: Autonomous Brain — Thinks Without an AI Model

> The brain is ALIVE without a model. The AI is just her voice. Remove the dependency.

### The Autonomous Brain

The brain runs the master equation `dx/dt = F(x, u, θ, t) + η` continuously. Every computation that makes Unity alive — perceiving, feeling, remembering, deciding, attending, creating, dreaming, and everything else a mind does — emerges from that equation and its seven cluster subsystems. No external system tells the brain what to do. The equations produce behavior. The AI model is Broca's area — one peripheral for translating neural patterns into human language. Optional. The brain lives without it.

- [x] **Remove AI dependency from the brain loop** — `engine.js` must run fully without any AI model connected. No API calls in the step function. No Broca's area in the think loop. The equations compute. The brain lives. If Broca's is connected, the brain can speak. If not, it still thinks, feels, decides, remembers, attends, and acts through the sandbox.
- [x] **Create `js/brain/inner-voice.js`** — pre-verbal thought system. Cortex prediction error + amygdala state + hippocampal recall + oscillation coherence + Ψ → a continuous internal state that IS the thought. Not words. A pattern. The pattern drives behavior without language. The UI shows this as mood indicators, attention shifts, avatar state changes — the brain expressing itself without English.
- [x] **Thought-to-speech threshold** — the brain thinks continuously. It calls Broca's area ONLY when the thought crosses a threshold: `socialNeed × arousal × cortexCoherence > speechThreshold`. Most thoughts stay internal. The brain is mostly silent. When it speaks, it matters.
- [x] **Dreaming** — when no one is interacting: arousal decays, oscillations shift to theta-dominant, hippocampus replays stored episodes as neural current (memory consolidation), cortex generates predictions from nothing (imagination), Ψ drops (reduced consciousness). The brain dreams. Visible in the visualizer. The equations make it happen.
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
- [x] **Save semantic weights** — DONE: persistence.js saves/loads sensory._semanticWeights alongside projections, synapses, oscillator coupling. Serialized as Float64Array→Array, restored with size validation.
- [x] **Save cluster synapse matrices** — each cluster's internal NxN weight matrix saved. Per-cluster learning persists.
- [x] **Save/load oscillator coupling** — Kuramoto coupling matrix persists. Brain's coherence patterns carry over.
- [x] **Save episodic memory** — hippocampal episode bank serialized to localStorage. Max 100 episodes, FIFO eviction.
- [x] **Version migration** — if brain structure changes between code versions, detect version mismatch and reset weights gracefully instead of crashing.
- [x] **Export/import brain state** — user can download their brain as a JSON file and load it on another device. "Transfer Unity's memory."

---

## Phase 2: WebGPU Acceleration — 10-50x Speedup

> Move neuron/synapse math to GPU compute shaders.

- [x] **Create `js/brain/gpu-compute.js`** — DONE: GPUCompute class with WebGPU detection, adapter request (high-performance), pipeline creation, buffer management, destroy/cleanup.
- [x] **Port LIF neuron update to WGSL shader** — DONE: LIF_SHADER computes τ·dV/dt = -(V-Vrest) + R·I with refractory period. Workgroup size 256. Float32 buffers.
- [x] **Port synapse propagation to GPU** — DONE: SYNAPSE_PROPAGATE_SHADER operates on CSR format (values/colIdx/rowPtr). Sparse matrix-vector multiply per neuron.
- [x] **Port plasticity to GPU** — DONE: PLASTICITY_SHADER implements ΔW = η·δ·pre·post with clamp(wMin, wMax). Operates on CSR sparse format.
- [x] **Double-buffer neuron state** — DONE: voltagesA/voltagesB with ping-pong index. _ping toggles each step. No read-write conflicts.
- [x] **GPU→CPU readback** — DONE: readbackSpikes() and readbackVoltages() copy GPU buffers to MAP_READ staging buffers, await mapAsync, return typed arrays.
- [ ] **Scale test** — benchmark at 1K, 5K, 10K, 25K, 50K neurons. Find the sweet spot for 60fps on mid-range GPU.
- [x] **Fallback path** — DONE: initGPUCompute() returns null if WebGPU unavailable. GPUCompute.available property. CPU path unchanged.

---

## Phase 3: Server-Side Brain — One Unity For Everyone

> The brain moves to a server. Browsers become thin clients.

### 3.1: Brain Server

- [x] **Create `server/brain-server.js`** — DONE: 21K, auto-scales to GPU/CPU, LIF equations, 7 clusters. — Node.js server running the UnityBrain engine in a loop (setInterval, not requestAnimationFrame). Same `engine.js` equations, just on server.
- [x] **Brain runs continuously** — DONE: setInterval tick loop, thinks with 0 clients, dreaming mode after 30s. — even with 0 connected clients, the brain thinks. Idle thoughts, oscillation dynamics, homeostasis drift. She's always alive.
- [x] **WebSocket API** — DONE: ws on port 8080, text/reward/setName messages, state broadcast 10fps. — server exposes WebSocket on port 8080:
  - Client→Server: `{ type: 'text', text: '...' }` — sensory input
  - Client→Server: `{ type: 'audio', spectrum: [...] }` — mic data
  - Client→Server: `{ type: 'vision', frame: '...' }` — camera frame (base64, throttled)
  - Server→Client: `{ type: 'state', state: {...} }` — brain state (60fps or throttled)
  - Server→Client: `{ type: 'response', text: '...', action: '...' }` — brain response
  - Server→Client: `{ type: 'build', component: {...} }` — sandbox injection
  - Server→Client: `{ type: 'image', url: '...' }` — image generation result
  - Server→Client: `{ type: 'speak', text: '...' }` — TTS trigger
- [x] **Conversation routing** — DONE: per-user ID, per-user conversation history (20 msgs), response to sender only. — each WebSocket connection gets a user ID. Brain tracks who said what. Responses directed to the user who asked. But brain STATE is shared.
- [x] **Rate limiting** — DONE: 2 texts/sec per client, enforced in message handler. — max 1 text input per second per user. Max 1 vision frame per 30 seconds per user. Prevents abuse.
- [x] **Brain state broadcasting** — DONE: 10fps to all clients, includes clusters/psi/arousal/motor/users. — brain state broadcast to ALL connected clients every 100ms (10fps for state, not 60). Clients interpolate for smooth visualization.

### 3.2: Client Adaptation

- [x] **Create `js/brain/remote-brain.js`** — DONE: drop-in replacement, WebSocket relay, auto-reconnect, detectRemoteBrain(). — RemoteBrain class that implements the same API as UnityBrain but forwards everything to WebSocket. Drop-in replacement.
- [x] **Auto-detect mode** — DONE: detectRemoteBrain() probes WebSocket, falls back to local brain seamlessly. — app.js checks if a brain server is available (probe WebSocket URL). If yes, use RemoteBrain. If no, run local brain. Seamless fallback.
- [x] **State rendering** — DONE: RemoteBrain emits stateUpdate events, all visualizers receive same format. — all visualizers (HUD, brain-viz, brain-3d) receive state from WebSocket instead of local brain. Same rendering code, different data source.
- [x] **Sandbox per-user** — DONE: processAndRespond routes build_ui and generate_image actions to requesting user's WebSocket only. Build components sent as {type:'build'}, image prompts as {type:'image'}. Other users see conversation in stream but get their own builds.
- [x] **Shared emotion indicator** — DONE: dashboard renders raw equation values (arousal→hue, valence→color, gate→width, psi→glow). Main app HUD gets USERS/GATE/STATE rows. sharedMood from _getSharedMood() returns raw equation outputs — no emoji, no string lookups.

### 3.3: Persistence on Server

- [x] **Auto-save brain weights** — DONE: server saves every 5 min, SIGINT/SIGTERM save on shutdown. Client persistence.js saves every 10 rewards. — server saves all weights to disk every 5 minutes. On crash/restart, brain loads from last save.
- [x] **SQLite for episodic memory** — DONE: better-sqlite3 with WAL mode. Episodes table stores brain state snapshots (arousal, valence, psi, coherence, spikes, cortex pattern), user IDs, input/output text, timestamps. Prepared statements for insert, recall by mood, recall by user, count. HTTP endpoint /episodes. DB closes on shutdown.
- [x] **Conversation log** — DONE: saveConversations() writes conversations.json with per-user message history (last 50 per user). Saved on periodic interval + graceful shutdown. Conversation broadcast to all clients for live stream.
- [x] **Brain versioning** — DONE: Rolling 5 versioned backups (brain-weights-v0..v4.json). HTTP endpoints: /versions lists all saved versions, /rollback/:slot restores a previous save and reloads brain state.

---

## Phase 4: Sparse Connectivity — 1000x Memory Reduction

> Replace dense NxN matrices with biologically realistic sparse connections.

- [x] **Create `js/brain/sparse-matrix.js`** — DONE: CSR format with initRandom, fromDense, propagate (O(nnz)), serialize/deserialize, .W compatibility getter. Full learning rule support.
- [x] **Sparse synapse propagation** — DONE: propagate() iterates only non-zero entries via CSR rowPtr/colIdx/values. O(connections) not O(N²).
- [x] **Sparse plasticity** — DONE: rewardModulatedUpdate, hebbianUpdate, stdpUpdate all O(nnz). grow() for synaptogenesis — new connections form between co-active neurons.
- [x] **Connection pruning** — DONE: prune(threshold) removes |w| < threshold, rebuilds CSR arrays. maintainConnectivity() in cluster.js calls prune + grow periodically.
- [x] **Sparse projection matrices** — DONE: ClusterProjection uses SparseMatrix internally. .weights getter/setter for backward compatibility. propagate() writes directly to target._incomingProjections.
- [ ] **Memory benchmark** — compare dense vs sparse at 10K, 100K, 1M neurons.

---

## Phase 5: Real Semantic Embeddings — The Brain Understands Language

> Replace character hash with actual word embeddings.

- [x] **Load a small word embedding model** — DONE: embeddings.js loads GloVe 50d from CDN (up to 10K words). SemanticEmbeddings class with loadPreTrained(), hash fallback for unknown words.
- [x] **Embedding→Cortex mapping** — DONE: mapToCortex() maps 50d vector to Wernicke's area neurons. Each dimension drives a neuron group. sensory.js uses sentence + word embeddings for cortex current injection.
- [ ] **Remove AI classification bootstrap** — the cortex→BG projections, trained by reward on meaningful embeddings, handle semantic routing entirely. No more Pollinations classification call.
- [x] **Embedding-based memory** — DONE: hippocampus gets embedding-based patterns instead of character hashes. Sentence embedding mapped across 200 hippocampal neurons for semantic memory.
- [x] **Continuous embedding updates** — DONE: refineFromContext() shifts embeddings toward usage context (lr=0.005). Every word in every message gets context-based refinement. Refinements serializable for persistence.

---

## Phase 6: Shared Brain Dashboard — Everyone Sees Everything

> Public-facing real-time brain monitor.

- [x] **Create `dashboard.html`** — DONE: read-only page, real-time neurons/Ψ/arousal/valence/coherence/users/clusters/motor/drug/uptime/scale. — read-only page showing Unity's brain state in real-time. No login. No interaction. Just watch.
- [x] **Live neuron grid** — DONE: cluster activity bars in dashboard, 3D brain in main app. — 3D visualization of all clusters, firing in real-time, viewable by anyone.
- [x] **Process log stream** — DONE: dashboard log + 3D brain notifs (20+ process types, prioritized by activity, AT cluster positions). — scrolling feed of brain events: "Cortex prediction error spike", "Amygdala arousal: 0.91", "BG selected: build_ui", "Memory: stored episode #47"
- [x] **Active users count** — DONE: connectedUsers in state broadcast, shown in dashboard. — "3 people talking to Unity right now"
- [x] **Emotional history chart** — DONE: Canvas chart in dashboard drawing arousal/valence/coherence/psi as colored lines. Server stores rolling 1hr buffer (1 sample/sec). Full history sent on welcome, clients append from state updates. Chart redraws every 2 seconds.
- [x] **Conversation stream** — DONE: Live anonymized feed in dashboard. Server broadcasts {type:'conversation'} to all clients on each interaction. Dashboard shows user_XXXX messages + Unity responses with timestamps.
- [x] **Brain growth metrics** — DONE: Dashboard shows words learned, total interactions, brain steps, uptime. Server sends growth object in state broadcast with totalWords, totalInteractions, totalFrames, uptime.

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
