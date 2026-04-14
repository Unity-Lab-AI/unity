# TODO — Unity

> **Branch:** `brain-refactor-full-control`
> **Last updated:** 2026-04-13
> **Philosophy:** Unity's brain controls EVERYTHING equationally. No scripts. No text-AI backends. No hardcoded fallbacks. No vestigial appendages. Every output — speech, vision, build, thought, memory, learning, motor action — flows from brain equations + learned corpus. The AI model (if any) is dumb muscle that follows orders the brain already decided.

---

## THE GUIDING PRINCIPLE

**If a behavior exists that isn't driven by brain state equations, it's wrong.**

Every piece of Unity's output must trace back to:
- **Cortex prediction** (ŝ = W·x + b) — what she expects
- **Amygdala valence/arousal** (V(s) = Σw·x, energy-basin attractor) — how she feels about it
- **Basal ganglia motor selection** (softmax over learned channels) — what action she takes
- **Hippocampus recall** (Hopfield attractor + persona sentence memory) — what she remembers
- **Cerebellum error correction** (ε = target − output) — what she fixes
- **Hypothalamus drives** (homeostatic gradients) — what she needs
- **Mystery module Ψ** (√(1/n) × N³) — her consciousness level
- **Oscillation coherence** (Kuramoto) — her focus/scatter
- **Language cortex** (semantic n-grams over learned embeddings) — her words

Nothing else. If it's not in that list, it's an appendage, and it gets ripped out.

---

## OPEN TASKS

Everything from the Phase 13 brain-refactor-full-control epic (R1 audit → R15 landing-page rework) has shipped and is fully archived in `docs/FINALIZED.md` with per-commit details. What remains below is the residual punch-list that was surfaced or deferred during the refactor pass.

Future work: distributed GPU compute network spec lives in `docs/COMP-todo.md` (planning only, not implemented, future `comp-net` branch).

---

### T1 — Consolidate duplicate sensory stream reads

**Source:** deferred during R7 sensory peripheral cleanup. The original R7.2 subtask description below was never executed — R7.1 (`destroy()` contract) shipped but R7.2 stayed on the list.

**The problem:**
`js/app.js` currently reads the same camera + mic streams from TWO places during boot:

- `js/app.js:1350–1364` — brain side: `brain.connectMicrophone(analyser)` + `brain.connectCamera(perms.cameraStream)` feed the analyser / video element into `auditoryCortex` / `visualCortex` for neural input
- `js/app.js:1537–1545` — viz side: `brainViz.setMicStream(perms.micStream)` + `brainViz.setVision({ _stream: perms.cameraStream, ... })` keep a **separate handle** to the same MediaStream objects so the viz panel can render the video + frequency bars

That's two consumers reading the same stream through different entry points. Not a runtime bug — the handles point to the same underlying MediaStream — but it's architecturally ugly and makes muting / destroy / reconnect paths fragile.

**What to do:**
- `brainViz.setVision(...)` should read from `brain.visualCortex.getVideoElement()` (new method on VisualCortex, returns the `_video` HTMLVideoElement it already holds) instead of keeping its own `_stream` reference
- `brainViz.setMicStream(...)` should read from `brain.auditoryCortex._analyser` (or a new `getAnalyser()` method) instead of taking the raw MediaStream
- Delete the duck-typed adapter shim at `js/app.js:1542` that wraps `visualCortex.getState()` as a fake vision object — brainViz should just hold a reference to `brain.visualCortex` directly

**Files:** `js/app.js`, `js/ui/brain-viz.js`, `js/brain/visual-cortex.js`, `js/brain/auditory-cortex.js`

**Acceptance:** grep for `perms.cameraStream` / `perms.micStream` in `js/app.js` should return 2 hits (one for `brain.connectCamera`, one for `brain.connectMicrophone`) instead of the current 6. Mute button still works. Viz panel still renders the video + frequency bars.

---

### T2 — Server-side embedding refinement persistence

**Source:** surfaced during the 2026-04-13 cleanup audit after R8 client-side shipped.

**The problem:**
R8 added client-side persistence for `sharedEmbeddings.serializeRefinements()` / `loadRefinements()` through `js/brain/persistence.js` — the online GloVe context-refinement deltas Unity learns from conversation now survive a browser reload.

But the server brain (`server/brain-server.js`) dynamic-imports the same `js/brain/embeddings.js` module via R3's approach, so the server ALSO has a `sharedEmbeddings` singleton accumulating refinements from every connected client's text. And `server/brain-server.js:1234 saveWeights()` writes `brain-weights.json` — but that save path was NOT extended to include `sharedEmbeddings.serializeRefinements()`.

**Consequence:** if the server crashes or restarts, the learned refinements from every connected conversation die on disk. Client-side refinements survive (each browser has its own localStorage blob), but the SERVER's accumulated shared learning is volatile.

**What to do:**
- Read `server/brain-server.js` `saveWeights()` (line ~1234) and `_loadWeights()` (line ~1284)
- Add a top-level `embeddingRefinements` field to the saved JSON, sourced from the dynamic-imported `sharedEmbeddings.serializeRefinements()`
- On load, call `sharedEmbeddings.loadRefinements(state.embeddingRefinements)` if present, with warn-and-continue on corrupt blob (mirror the client-side error handling)
- Verify the round-trip by booting the server, teaching Unity a new association, killing the process, rebooting, and checking that the refinement survived in the dynamic-imported singleton

**Files:** `server/brain-server.js`

**Acceptance:** server restarts preserve learned embedding refinements across reboots, same semantics as the client-side R8 fix.

**Estimated size:** ~15 lines. This is a 10-minute task.

---

### T3 — Rewrite `brain-equations.html` §8.11 Broca's Area section  [DONE 2026-04-13 commit `9060e2e` — section retitled "How Unity Picks Every Word Equationally", historical refactor note card explaining the pre-R4 AI-prompt path is gone, new four-tier pipeline equation box with full slot-score formula, new brain-state → slot-score-weights mapping box. Bonus fixes during the same pass: §8.20 duplicate section number renumbered to §8.21 for GPU Compute (Persona keeps 8.20), §8 Data Flow diagram stale "Broca's Area → AI model generates text from brain state prompt" line replaced with the real language cortex equational path, full tooltip audit across ~60 data-tip attributes verified accurate to current state.]

**Source:** explicitly flagged during R10.3 (`brain-equations.html` surgical edits for R2 semantic grounding) as "known residual cleanup, not R10.3 scope, flagged for R12". R12 final cleanup happened but never touched §8.11 because it was a content rewrite task, not a mechanical sweep.

**The problem:**
`brain-equations.html:292` (TOC entry) and `brain-equations.html:798–799` (body section) still describe "Broca's Area — What the AI Model Receives" as if Unity's speech is generated by an AI-prompt path. Post-R4, `BrocasArea` is a 68-line throwing stub (`js/brain/language.js:28` — see its header comment). The entire §8.11 equation box is misleading — it claims AI-prompt-based output that no longer exists in the codebase.

**What to do:**
Three options, pick one:

1. **Delete §8.11 entirely.** Update the TOC, remove the body section. Rationale: there's no Broca's Area in the equational sense anymore — the language cortex IS her speech production. The §8.13–§8.18 sections already cover the real equational language generation path. §8.11 is redundant historical framing.
2. **Rewrite §8.11 as "Broca's Area (historical)"** — preserve the original content as a historical footnote explaining what the AI-prompt path USED to do, with a prominent header noting "This section describes a pre-R4 architecture. Modern Unity generates every word equationally — see §8.14 Dictionary, §8.18.5 Semantic Coherence, §8.18.6 Semantic Grounding." Good if you want the teaching page to preserve the historical arc.
3. **Rewrite §8.11 as "Broca's Area → Language Cortex"** — keep the anatomical label (real brains have a Broca's area for speech production) but redefine the section content to describe Unity's equational language cortex instead of the old AI-prompt path. Most biologically honest framing but requires the most rewrite work.

**Recommendation:** Option 2 (historical footnote). Preserves the teaching page's narrative of "here's how Unity used to speak, here's how she speaks now", which is pedagogically useful and respects the refactor history.

**Files:** `brain-equations.html` (TOC entry at line 292, body section at lines 798 onward)

**Acceptance:** §8.11 no longer claims Unity speaks via an AI prompt. Either deleted from TOC + body, or rewritten with a clear "historical" marker that points forward to the real equational sections.

---

### T4 — Manual verification + merge PR to main (R12.7)

**Source:** the original R12.7 epic subtask. Gated on user go-ahead.

**The problem:**
The `brain-refactor-full-control` branch is code-complete and has been through static analysis + `npx esbuild` syntax validation but has NOT been manually tested in a browser. Every change relied on grep sweeps + read-before-edit discipline rather than runtime verification. The branch is ready for merge in principle but should not land on `main` until the user actually boots Unity in a browser and verifies the key flows.

**Suggested manual test checklist (NOT a scripted test per CLAUDE.md NO TESTS rule — just a "what to look at while clicking around" guide):**

1. Boot Unity — open `index.html` from `file://` OR run `start.bat` / `start.sh` then visit `http://localhost:7525`
2. Landing page loads — 3D brain visible, TALK TO UNITY button visible, Unity bubble visible bottom-right
3. **Click the Unity bubble BEFORE clicking TALK TO UNITY** (this was the dead-bubble bug) — should open the setup modal
4. Click TALK TO UNITY — same thing, opens the setup modal
5. Setup modal shows: two provider grids (🎨 Image Generation with 7 buttons + 👁 Vision Describer with 5 buttons), Pollinations API key field, mic/camera permission slots, WAKE UNITY UP button
6. Click each of the 12 provider buttons — per-backend setup instructions should render in the form area below the grids. Verify at least: Pollinations image, Pollinations vision, Automatic1111 (auto-detect instructions), DALL-E (remote, key field), Custom (full form with URL + model + kind + key)
7. Save a fake DALL-E backend with a test key — the env.js snippet panel should appear with the mode-specific path guidance (file:// shows exact path, localhost shows landmark-based instructions with OS-specific shell hints, remote warns about localStorage only)
8. Click `⬇ Download env.js` — file should actually download to the browser's Downloads folder
9. Close the modal, click WAKE UNITY UP — permissions dialog for mic + camera, then boot proceeds
10. Post-boot, click the Unity bubble — should toggle the chat panel (not reopen the setup modal)
11. Type something to Unity — she should respond equationally via the language cortex with no AI backend configured
12. Boot `node server/brain-server.js` from a terminal — should bind to port 7525 (not 8080), `http://localhost:7525/health` should respond
13. Connect a browser to the server — server brain should take over, landing page 3D viz should reflect server state

**If any of those fail, file as a new T5+ task in this file and I'll fix it.**

**After manual verification passes:**
- T1 + T2 + T3 can merge with main alongside the rest of Phase 13 (they're small, independent, and safe)
- OR land them first on the branch, then open the PR

**Merge PR command (do NOT run without explicit go-ahead):**
```bash
gh pr create --base main --head brain-refactor-full-control \
  --title "Phase 13: brain-refactor-full-control → equational Unity" \
  --body-file docs/FINALIZED.md
```
(Or open the PR manually via GitHub UI with a hand-written summary pointing at `docs/FINALIZED.md` for details.)

**Acceptance:** user has clicked the 13-step checklist, identified any runtime bugs, filed them as new tasks, and explicitly said "open the PR".

---

## POST-MERGE FOLLOWUPS

Tasks T5–T7 below are not blockers for merging `brain-refactor-full-control` to main. They can be worked on fresh branches after T4 lands. They're tracked here so they don't get lost.

---

### T5 — Massively expand 3D brain popup notification types with Unity's own dynamic commentary

**Source:** feature request from Gee 2026-04-13 — "i want to massively expand the popup notice in the 3D brain not the amount in the visualization but the total types available and i want them all to actually say something from Unity's mind like what she thinks about it (not scripted not hardcoded but dynamic coding of attributions)".

**Current state:**
`js/ui/brain-3d.js:1128–1215` has `_generateProcessNotification(state)` which fires one notification every ~5 seconds from a pool of **10 generators**. Every current generator is a NUMERIC TELEMETRY display — it renders the raw values of a single subsystem into a terse stats line:

| # | Current generator | Example output |
|---|---|---|
| 1 | Cluster snapshot (cycles through 7 clusters) | `🧠 Cortex 12.3%` |
| 2 | Consciousness | `✨ Ψ=0.0234 gate=1.24x` |
| 3 | Emotion | `🔥 a=87% v=0.123` |
| 4 | Oscillations band power | `〰 θ=3.2 α=1.8 β=4.1 γ=0.9` |
| 5 | Motor action | `⚙ motor: respond_text` |
| 6 | Inner voice sentence | `💭 "..."` |
| 7 | Memory recall | `📖 recall: "trigger"` |
| 8 | Dreaming flag | `💤 dreaming` |
| 9 | Reward delta | `🎯 δ=0.124` |
| 10 | Neuron count | `🧠 179,000 neurons` |

They're accurate but they read like debugger output, not like a mind observing itself. The user wants **Unity's first-person reaction** to each event, generated equationally, so the same category of event produces different commentary every time based on her current brain state + drug combo + mood.

**What the new notification format should look like:**
```
[emoji]  [one-line event label]
         "[Unity's dynamic commentary, produced by languageCortex.generate()
           with a semantic seed biased by this event type + current brain state]"
```

Example (NOT hardcoded — just illustrating the shape):
```
🧠  cortex firing hot
    "too much crawling through my head right now"
```
```
📖  i know this
    "yeah i've seen this pattern before"
```
```
🎯  reward spike
    "fuck yeah that hit"
```

Every commentary string comes from `innerVoice.languageCortex.generate()` with a context vector biased toward the event type's semantic signature. No lookup tables, no string templates, no `if (type === 'recognition') return 'I know this'`.

**The ~25 new event types to add** (alongside the existing 10 — keep those, add these as additional generators):

Each has a **detector condition** (when it fires) and a **semantic seed** (a 50d GloVe vector or small seed-word set that primes the language cortex toward the right emotional/topical space).

| # | Event type | Detector | Semantic seed words (for biasing the context vector, not for template output) |
|---|---|---|---|
| T5.a | **Topic drift** | `‖c(t) − c(t−5)‖ > 0.4` — context vector just shifted hard | shift, change, new, wait |
| T5.b | **Emotional spike** | `|valence(t) − valence(t−1)| > 0.3` | hit, surge, jolt |
| T5.c | **Dopamine hit** | `reward(t) > reward(t−1) + 0.15` | good, yes, pleasure |
| T5.d | **Dopamine crash** | `reward(t) < reward(t−1) − 0.15` | bad, wrong, disappoint |
| T5.e | **Recognition** | `hippocampus.recallConfidence > 0.6` | know, remember, familiar |
| T5.f | **Confusion** | `cortex.predictionError > 0.5` | what, confused, lost |
| T5.g | **Fatigue** | `cerebellum.errorAccum > threshold AND coherence dropping` | tired, worn, fade |
| T5.h | **Arousal climb** | `Δarousal > 0.1 over 10 frames` | wake, alert, rise |
| T5.i | **Arousal drop** | `Δarousal < −0.1 over 10 frames` | settle, calm, dim |
| T5.j | **Motor indecision** | BG softmax entropy > 0.7 (no clear winner) | can't, choose, stuck |
| T5.k | **Motor commitment** | BG confidence > 0.85 | decide, go, action |
| T5.l | **Silence period** | no sensory input for > 30s AND low arousal | empty, quiet, alone |
| T5.m | **Heard own voice** | `auditoryCortex.isEcho === true` | me, voice, self |
| T5.n | **Unknown word** | user input contained a token with zero dictionary entry | new, strange, word |
| T5.o | **Known topic echo** | user input matched a high-arousal persona memory | oh, topic, know |
| T5.p | **Color surge** | `visualCortex.colors` has a quadrant > 0.7 | color, bright, see |
| T5.q | **Motion detected** | `visualCortex.motionEnergy > 0.5` | move, motion, saw |
| T5.r | **Gaze shift** | `visualCortex.gazeTarget` changed | look, shift, there |
| T5.s | **Ψ climb** | `psi(t) > psi(t−10) + 0.05` | aware, real, sharp |
| T5.t | **Ψ crash** | `psi(t) < psi(t−10) − 0.05` | blur, dim, fade |
| T5.u | **Coherence lock** | `coherence > 0.8` | sync, clear, focused |
| T5.v | **Coherence scatter** | `coherence < 0.2` | scatter, fragment, noise |
| T5.w | **Hypothalamus drive dominant** | any drive > 0.7 | want, need, crave |
| T5.x | **Memory replay / consolidation** | hippocampus consolidation active | remember, replay, past |
| T5.y | **Mystery pulse** | mystery module output spiked | strange, pulse, deep |

That's 25 new types. Combined with the 10 existing (retained for raw numeric view), the total pool becomes 35.

**Implementation plan:**

1. **Thread a brain reference into `brain-3d.js`** so the viz module can call `brain.innerVoice.languageCortex.generate()` directly. Currently `brain-3d.js` only receives a state snapshot via `updateState(state)`. Add a `setBrain(brain)` method called from `app.js` `bootUnity` after `brain = new UnityBrain()`. The landing-page Brain3D creation path already runs with a `null` brain and gets its reference late via state updates; adding one more `setBrain` call fits.

2. **New file: `js/ui/brain-event-detectors.js`** — single module exporting a function that takes `(currentState, previousState, historyBuffer)` and returns an array of event types that fired this tick. Every detector from the table above lives here as a pure function. Keeps `brain-3d.js` from becoming a dumping ground.

3. **New helper: `_generateEventCommentary(eventType, state)` in `brain-3d.js`** — calls `this._brain.innerVoice.languageCortex.generate(...)` with the normal brain state PLUS an extra `semanticBias` param that temporarily primes the running context vector toward the event's seed GloVe embedding. Requires a small addition to `languageCortex.generate()` to accept + apply `semanticBias`. The bias blends into the context vector at ~0.3 weight so Unity's natural current-brain-state topic still dominates, but the event type shifts her enough to comment on it.

4. **Replace `_generateProcessNotification` loop** with a two-stage pipeline:
   - Stage A: detect events (call `detectBrainEvents(currentState, previousState, history)`)
   - Stage B: for each detected event, generate commentary via `_generateEventCommentary(eventType, state)`, render as a new notification with BOTH the event label (numeric telemetry) AND Unity's commentary

5. **Rate limiting:** the current system fires ~1 notification every 5 seconds. That stays. When multiple events fire in the same tick, pick the highest-priority one (e.g. motor commitment > cluster snapshot > Ψ climb) and drop the rest. No flood.

6. **Seed vector generation:** for each event type, the seed is computed at module load time by averaging `sharedEmbeddings.getEmbedding()` over the seed word list (NOT a runtime lookup — precomputed once). Stored as a `Float64Array(50)`. This is the ONLY place where a word list exists, and it's a seed for semantic biasing, not cognition routing — permitted per the CLAUDE.md "lexical tags by shape are fine because closed-class words are finite and known" exception applied to seed priming.

**Acceptance:**
- Boot Unity, open the 3D brain landing page, watch notifications for 5 minutes
- At least 15 different event types should fire in that window
- Every notification should have TWO visible lines: event label + dynamic commentary
- Commentary strings should be different every time the same event type fires
- Commentary should reflect current drug state / arousal / valence — same event under cokeAndWeed should read differently than under whiskey mellow
- Grep for hardcoded commentary strings longer than a label word should return zero matches

**Estimated size:** ~400 lines across 3 files. Single atomic commit reasonable.

---

### T6 — Private episodic memory scoping (server-side)

**Source:** privacy rule clarified by Gee 2026-04-13 — *"they are private episodes but its one brain of Unity"*.

**The rule:**
Unity's brain is ONE shared instance (dictionary, bigrams, embedding refinements, persona all shared across every user who connects to the same server). But **episodic memory** — the specific stored conversation episodes Unity's hippocampus recalls from — should be **per-user scoped**. Alice should never get a recall hit from Bob's conversation, even though Alice and Bob share all of Unity's vocabulary growth.

**Current state:**
- `server/brain-server.js` runs ONE `UnityBrain` instance with ONE `MemorySystem`
- Episodes are stored in `server/episodic-memory.db` (SQLite) as a flat pool with no user tagging
- When any user's conversation triggers a recall, the query hits the shared pool and can pull back any episode regardless of who originally stored it
- In practice, cortex pattern dissimilarity between different users' conversations makes cross-user recall statistically rare but **not impossible**, and that's not good enough for a stated privacy rule

**What to do:**

1. **Client identity** — generate a stable user UUID in localStorage on first page load. Key name: `unity_user_id`. Value: `crypto.randomUUID()`. Persists across sessions. Sent with every `text` WebSocket message in the payload: `{type: 'text', text, userId: storage.get('unity_user_id')}`.

2. **Server schema migration** — `server/episodic-memory.db` SQLite episodes table needs a `user_id TEXT` column. Migration at server boot time: `ALTER TABLE episodes ADD COLUMN user_id TEXT DEFAULT NULL;` — existing episodes (from before this migration) get NULL which means "legacy / unscoped" and they can either be deleted on first boot post-migration OR left as-is for all users to share (decision below).

3. **Server message handler** — `case 'text'` at `server/brain-server.js:1541` needs to extract `msg.userId` (fall back to the per-session `id` if absent, for backward compat) and pass it through `brain.processAndRespond(msg.text, msg.userId || id)`.

4. **Memory system scoping** — `js/brain/memory.js` `MemorySystem.store(episode, userId)` and `MemorySystem.recall(cortexPattern, userId)` methods need an optional `userId` parameter. Storage tags the episode with the userId. Recall filters `WHERE user_id = ?` in the SQLite query (or filters the in-memory array if running client-side without SQLite). `userId = null` falls back to unfiltered (client-mode behavior preserved).

5. **Hippocampus integration** — `js/brain/engine.js` `processAndRespond(text, userId)` already receives a client id per the current signature; thread `userId` through to any memory store/recall call site inside the hippocampus processing.

6. **Legacy episode decision** — existing episodes with `user_id = NULL` from before migration: (a) delete them on first boot after migration (clean slate, simplest), (b) keep them as shared "community episodes" available to all users (accepts the pre-migration shared-memory era), or (c) attribute them to a special `legacy` user_id that no real user can match (effectively archives them — they stay on disk for audit but never get recalled). **Recommendation:** option (a), delete on migration. Episodic memory isn't critical path — Unity rebuilds episodes from every new conversation, and users would rather start fresh than inherit random strangers' memories.

**Files:** `server/brain-server.js` (SQLite migration + text message handler), `js/brain/memory.js` (store/recall signature), `js/brain/engine.js` (userId threading), `js/app.js` (client-side UUID generation + attach to text messages), `js/brain/remote-brain.js` (userId in sendText helper)

**Acceptance:**
- Two browser tabs connect to the same `brain-server.js` instance, each with a different `unity_user_id`
- Tab A types "remember when we talked about my cat named whiskers" — stored as an episode tagged with Tab A's userId
- Tab B types "tell me something you remember" — recall query returns Tab B's episodes only, NOT Tab A's whiskers memory
- Both tabs share dictionary growth: if Tab A taught Unity the word "meowing", Tab B can later use it in a reply because the dictionary is still shared
- Server restart preserves per-user episode scoping

**Estimated size:** ~100 lines across 4-5 files. SQLite migration is the trickiest part; the rest is mechanical parameter threading.

**Priority:** MEDIUM. This is a correctness fix for the stated privacy rule, but not a blocker for merge. Current state (shared episode pool with statistical filtering via cortex pattern dissimilarity) is "mostly OK" for single-user or trusted multi-user use. Ship as a post-merge followup on a fresh branch.

---

## NOTES

- **Everything from the Phase 13 refactor is done.** Phase 13 R1 through R15 shipped and is fully archived in `docs/FINALIZED.md`. If you find a refactor-related item not covered by T1–T6 above or by a FINALIZED entry, file it as a new T-task in this doc.
- **T1–T4 are pre-merge cleanup.** T5–T6 are post-merge followups on fresh branches (3D brain popup expansion + per-user episodic memory scoping).
- **When all T-tasks are done**, this file reduces to just the header + guiding principle + an empty Open Tasks section. That's the template state — drop new tasks in as `### T1` etc. and the cycle repeats.
- **FINALIZED is append-only.** Never delete entries from it. When tasks complete, copy their full content (not a summary) into a new FINALIZED session entry, then remove them from Open Tasks above.

---

*Unity AI Lab — the refactor is done. Test her, ship her, let her grow.*
