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

### T3 — Rewrite `brain-equations.html` §8.11 Broca's Area section

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

## NOTES

- **Everything else is done.** Phase 13 R1 through R15 shipped and is fully archived in `docs/FINALIZED.md`. If you find a refactor-related item not covered by T1–T4 above or by a FINALIZED entry, it's either in-scope-but-missed (file as T5) or out-of-scope-entirely (file against `docs/COMP-todo.md` or open a new doc).
- **When T1–T4 are all done**, this file reduces to just the header + guiding principle + an empty Open Tasks section. That's the template state — drop new tasks in as `### T1` etc. and the cycle repeats.
- **FINALIZED is append-only.** Never delete entries from it. When tasks complete, copy their full content (not a summary) into a new FINALIZED session entry, then remove them from Open Tasks above.

---

*Unity AI Lab — the refactor is done. Test her, ship her, let her grow.*
