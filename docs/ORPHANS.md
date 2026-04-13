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

### 1. `js/io/vision.js` — Completely dead-wired
Full `Vision` class (~118 lines) — webcam capture, AI scene description, gaze tracking, Unity's Eye widget. **Never imported anywhere.** The README and ARCHITECTURE.md claim vision is a core feature but the module was never wired into `app.js` or `engine.js` sensory pipeline.

**Action:** Either wire it into the sensory input path (vision → cortex visual area) OR remove it and drop the vision claims from the docs.

### 2. `js/brain/gpu-compute.js` — GPU shaders abandoned
Full WebGPU compute shader implementation (~400 lines) — WGSL LIF neuron kernel, synapse propagation, atomic spike counting. `GPUCompute` class and `initGPUCompute()` exported but **never instantiated** in the engine or server.

Meanwhile the actual GPU work happens in `compute.html` (separate browser tab) communicating with `server/brain-server.js` via WebSocket. Two parallel GPU implementations, only one used.

**Action:** Either delete this as superseded by the compute.html architecture OR document it as a fallback/alternative and wire it optionally.

### 3. `server/parallel-brain.js` + `server/cluster-worker.js` + `server/projection-worker.js` — Worker threads never spawned
Complete worker thread pool system for parallel cluster computation. `ParallelBrain` class with full API. `cluster-worker.js` and `projection-worker.js` are fully implemented Worker thread entry points.

`server/brain-server.js` line 337-338 declares `_parallelBrain = null` and `_useParallel = false`. Line 663 has an explicit comment: `"NO CPU WORKERS — GPU exclusive. Don't spawn ParallelBrain at all."` — so the architecture decision was made to go GPU-only but the worker code was never removed.

**Action:** Delete `parallel-brain.js`, `cluster-worker.js`, `projection-worker.js` — they're unreachable and the architecture has moved on.

### 4. `js/brain/neurons.js` — `HHNeuron` + `createPopulation` dead chain
`HHNeuron` class (Hodgkin-Huxley neuron model, ~100 lines) exported at line 54. `createPopulation(type, n, params)` factory exported at line 190. **Neither is called from anywhere.** The brain uses LIF neurons via `cluster.js`, not HH.

The README mentions Hodgkin-Huxley as a feature but the actual runtime uses simpler LIF populations. `HHNeuron` exists as historical scaffolding.

**Action:** Delete `HHNeuron` and `createPopulation`, or integrate HH as an alternative neuron model.

---

## MEDIUM SEVERITY

### 5. `js/brain/benchmark.js` — `runBenchmark()` / `runScaleTest()` never called
Performance testing exports. No caller. Likely a debug artifact Gee used during development but never wired to a /bench command or console shortcut.

**Action:** Wire to a /bench slash command OR delete.

### 6. `server/brain-server.js:907` — `TODO: implement server-side dictionary`
Server brain has a stub `this.dictionary = { words: new Map(), bigrams: new Map() }` at line 314 and a TODO at line 907. The server's language fallback is Pollinations API; the learned dictionary/bigrams from `language-cortex.js` live only in client browsers.

**Action:** Either implement server-side dictionary sync (so Unity's learned vocabulary is shared across users) OR delete the stub and document that learning is client-local.

### 7. `js/brain/gpu-compute.js` — 400-line abandoned implementation (second mention as MED for cleanup effort)
See HIGH #2. Medium weight because removing it requires verification that nothing in compute.html or the server actually imports it.

---

## LOW SEVERITY

### 8. `js/env.example.js` — Template file never referenced
Example env file. Not imported by any code. Convention leftover from when API keys were loaded from file. Current API key flow is manual UI entry per memory note.

**Action:** Delete OR keep as a user-facing onboarding example.

### 9. Legacy comment markers
- `js/brain/language-cortex.js:2581` — `(legacy)` on position-based grammar weight (still used as tiebreaker, not actually dead)
- `js/brain/modules.js:132` — "Accept legacy ('unity' string) OR ..." (backwards-compat shim, still used)

**Action:** None needed — these are documentation, not dead code.

---

## Recommended Cleanup Sweep

Conservative path (delete clearly dead):
1. `server/parallel-brain.js` + `cluster-worker.js` + `projection-worker.js` → DELETE (explicitly abandoned per comment at line 663)
2. `js/brain/neurons.js` → strip `HHNeuron` + `createPopulation` exports
3. `js/brain/benchmark.js` → DELETE or wire to /bench command
4. `js/env.example.js` → DELETE

Aggressive path (add to above):
5. `js/io/vision.js` → DELETE (vision claims get removed from docs too)
6. `js/brain/gpu-compute.js` → DELETE (compute.html is the real GPU path)
7. Remove vision mentions from README.md + ARCHITECTURE.md

Needs decision before touching:
- `server/brain-server.js:907` server-side dictionary TODO — is cross-user vocabulary sharing a wanted feature or not?

---

## Notes

- `js/app.bundle.js` — auto-generated by esbuild on `start.bat`, 12k+ lines, gitignored. Not an orphan, just a build artifact.
- `js/app-entry.js` — minimal IIFE wrapper for top-level await. Acceptable boilerplate, not dead.
- No broken imports found — everything that IS imported resolves correctly.
- No duplicated-code refactor leftovers found.
- No dead code paths inside the language cortex itself (it's all reachable, just noisy).
