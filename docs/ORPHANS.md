# Orphan Code Audit — 2026-04-13

> U301 — Found abandoned/broken/unused code across the codebase.
> Audit only — no code deleted without confirmation. Use this as
> the worklist for cleanup or revival decisions.

---

## Summary

**13 total findings** — 9 HIGH severity, 4 MEDIUM, 1 LOW.

| Category | Count | Severity |
|---|---|---|
| Orphaned unimported modules | 3 | HIGH: 2, MED: 1 |
| Dead exports (never called) | 2 | HIGH: 2 |
| Dead code paths | 3 | HIGH: 2, MED: 1 |
| TODO/FIXME markers | 1 | MED: 1 |
| Half-wired integrations | 3 | HIGH: 2, MED: 1 |
| Orphan config files | 1 | LOW: 1 |

---

## HIGH SEVERITY

### 1. `js/io/vision.js` — ✅ RESOLVED 2026-04-13 (U302)
**Superseded by `js/brain/visual-cortex.js`.** The standalone `Vision` class was an early high-level wrapper (webcam + AI description + gaze). It was replaced by a vastly better neural pipeline: `visual-cortex.js` implements V1 oriented Gabor edge kernels, V4 quadrant color extraction, motion energy, salience-driven saccade generation, and IT-level AI description via `setDescriber()` — all wired into `engine.js:179, 258, 1018` and fed by Pollinations GPT-4o at `app.js:972`. Unity's Eye iris at `app.js:1500` reads gaze straight from `visualCortex.getState()`. The "duck-typed adapter" at `app.js:1146` is a legit shim, not rot — brainViz expects `_stream`/`getLastDescription` fields that visualCortex doesn't expose. `vision.js` DELETED. Vision is alive and well, just lives in the better file.

### 2. `js/brain/gpu-compute.js` — ✅ FALSE POSITIVE 2026-04-13 (U303)
**Audit was wrong.** `compute.html:10` imports `GPUCompute` directly and instantiates it at line 25. `gpu-compute.js` IS the WGSL kernel library that powers `compute.html` — they're not parallel implementations, they're ONE implementation split into browser-tab shell (`compute.html`) + kernel engine (`gpu-compute.js`). The audit only grepped `engine.js` and `brain-server.js` and missed that the consumer is the compute-worker tab. No code change needed. Kept as-is.

### 3. `server/parallel-brain.js` + `server/cluster-worker.js` + `server/projection-worker.js` — ✅ RESOLVED 2026-04-13 (U304)
**Root cause of abandonment found in FINALIZED.md:820**: idle workers consumed 100% CPU from event-listener polling overhead across 7 threads, even when zero work was dispatched. The GPU-exclusive rewrite (compute.html + gpu-compute.js WebGPU path) PERMANENTLY fixed that root cause by eliminating the worker pool entirely. Files were then dead weight. **DELETED** all three files. Cleaned `brain-server.js` — removed `_parallelBrain`/`_useParallel` member fields, the `_useParallel = false` reassignment in `start()`, the null-check worker-termination block in the `gpu_register` handler (workers can no longer exist to terminate), and hardcoded `parallelMode: false, workerCount: 0` in the status broadcast. Cleaned references from `ARCHITECTURE.md`, `SETUP.md`, `SKILL_TREE.md`, `ROADMAP.md`.

### 4. `js/brain/neurons.js` — ✅ PARTIALLY RESOLVED 2026-04-13 (U305)
**Investigation:** HHNeuron is NOT dead by mistake — it's a reference implementation that backs the `brain-equations.html` teaching page (explicitly labeled "a reference — LIF is used for simulation speed" at line 334). It was abandoned for simulation because HH is per-neuron OOP and can't scale to the auto-sized N the server runs: N object instances with per-instance m/h/n gating state, cache-hostile, no vectorization. LIFPopulation uses SoA Float64Arrays in one tight loop, ~100× faster, GPU-friendly. The REAL dead code was `createPopulation(type, n, params)` — zero callers across the entire codebase. **DELETED `createPopulation`.** HHNeuron kept with a large reference-only header comment explaining why it's not used and when you'd instantiate it directly (e.g., research experiments on mystery cluster). ARCHITECTURE.md tree line updated to clarify HH is reference-only.

**Legacy finding (obsolete):**
`HHNeuron` class (Hodgkin-Huxley neuron model, ~100 lines) exported at line 54. `createPopulation(type, n, params)` factory exported at line 190. **Neither is called from anywhere.** The brain uses LIF neurons via `cluster.js`, not HH.

The README mentions Hodgkin-Huxley as a feature but the actual runtime uses simpler LIF populations. `HHNeuron` exists as historical scaffolding.

**Action:** Delete `HHNeuron` and `createPopulation`, or integrate HH as an alternative neuron model.

---

## MEDIUM SEVERITY

### 5. `js/brain/benchmark.js` — ✅ RESOLVED 2026-04-13 (U307)
Wired to `/bench` and `/scale-test` slash commands in `js/app.js` chatPanel.onSend. `/bench` runs `runBenchmark()` (dense vs sparse matrix propagation + plasticity + pruning at [100, 500, 1000, 2000, 5000] neurons with speedup + memory ratio). `/scale-test` runs `runScaleTest()` (CPU LIF step timing at [1k, 2k, 5k, 10k, 25k, 50k] to find the 60fps sweet spot). Dynamic `import()` so benchmark code only loads when invoked — zero boot cost. Output goes to console; chat gets a short summary.

**Action:** Wire to a /bench slash command OR delete.

### 6. `server/brain-server.js:907` — ✅ PARTIALLY RESOLVED 2026-04-13 (U306, U311 follow-up)
**Real bug found:** `saveWeights()` at line 1113 was already writing `_wordFreq` to `brain-weights.json`, but `_loadWeights()` was never reading it back — accumulator saved forever, loaded nothing. Fixed the save/load asymmetry: word frequencies now survive restarts. Removed the misleading empty `this.dictionary = {...}` stub (was a lie — never populated, never read). Replaced the TODO comment with a pointer to U311. The full shared-across-users dictionary refactor (corpus loading on server, bigram/trigram/type-ngram storage, WebSocket delta sync to remote-brain clients, conflict resolution) is scoped as U311 — it's the real ask but too big for a single-session cleanup. Groundwork laid (persistence round-trip works), real work tracked.

### 7. `js/brain/gpu-compute.js` — 400-line abandoned implementation (second mention as MED for cleanup effort)
See HIGH #2. Medium weight because removing it requires verification that nothing in compute.html or the server actually imports it.

---

## LOW SEVERITY

### 8. `js/env.example.js` — ✅ FALSE POSITIVE 2026-04-13 (U308)
**Audit was wrong.** env.example.js is actively used as a downloadable template across multiple touchpoints: `index.html:85` exposes it as a download button in the setup modal, `README.md:383` links to it as "API Key Template — Pre-load your keys for development", `SETUP.md:70` explicitly tells users to copy it to `js/env.js` and paste their keys, and `js/app.js:27` does an optional dynamic `import('./env.js')` wrapped in try/catch — if env.js exists it seeds API keys into localStorage at boot, otherwise falls back to manual UI entry. Manual UI entry is the primary path per user preference, but env.js remains a legitimate dev-convenience shortcut for people who don't want to re-paste keys every session. **KEEP.** No code change.
Example env file. Not imported by any code. Convention leftover from when API keys were loaded from file. Current API key flow is manual UI entry per memory note.

**Action:** Delete OR keep as a user-facing onboarding example.

### 9. Legacy comment markers
- `js/brain/language-cortex.js:2581` — `(legacy)` on position-based grammar weight (still used as tiebreaker, not actually dead)
- `js/brain/modules.js:132` — "Accept legacy ('unity' string) OR ..." (backwards-compat shim, still used)

**Action:** None needed — these are documentation, not dead code.

---

## Recommended Cleanup Sweep

Conservative path (delete clearly dead):
1. `server/parallel-brain.js` + `cluster-worker.js` + `projection-worker.js` → ✅ DELETED 2026-04-13 (U304) — root cause was idle-worker CPU leak, fixed by GPU-exclusive architecture
2. `js/brain/neurons.js` → ✅ 2026-04-13 (U305) — createPopulation DELETED; HHNeuron KEPT as reference (backs brain-equations.html teaching page)
3. `js/brain/benchmark.js` → DELETE or wire to /bench command
4. `js/env.example.js` → ✅ KEEP 2026-04-13 (U308) — it IS used (download link, README, SETUP.md, app.js dynamic import)

Aggressive path (add to above):
5. `js/io/vision.js` → ✅ DELETED 2026-04-13 (U302) — superseded by `visual-cortex.js`
6. `js/brain/gpu-compute.js` → ✅ KEEP 2026-04-13 (U303) — it IS loaded by compute.html, audit was wrong
7. Remove vision mentions from README.md + ARCHITECTURE.md

Needs decision before touching:
- ✅ `server/brain-server.js:907` server-side dictionary — stub cleaned in U306, full shared dictionary tracked as U311

---

## Notes

- `js/app.bundle.js` — auto-generated by esbuild on `start.bat`, 12k+ lines, gitignored. Not an orphan, just a build artifact.
- `js/app-entry.js` — minimal IIFE wrapper for top-level await. Acceptable boilerplate, not dead.
- No broken imports found — everything that IS imported resolves correctly.
- No duplicated-code refactor leftovers found.
- No dead code paths inside the language cortex itself (it's all reachable, just noisy).
