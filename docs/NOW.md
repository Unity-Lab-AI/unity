# NOW — Session Snapshot

> Saved: 2026-04-18 (Session 114.19ac extended — T15.C closed (12/12) + T17.7 Phase E.a + E.b + Phase C follow-up + partial Phase F doc sweep + NEW LAW: PRE-K + K ONLY SYLLABUS SCOPE CONTRACT (`.claude/CLAUDE.md` 2026-04-18 per Gee 'T16.5s should be a law built into the syllabus ... only trying to get pre-k and k learning down first'). T15.D REMOVED from backlog per Gee 2026-04-18 'T15D is NOT going to be done and can be removed'. Remaining: T17.7 Phase E.c/E.d (cortexCluster deletion), T17.7 Phase F continuation, T16.5.b/d (Gee design-review), T16 Part 2 (Gee localhost), T18.5.b/c push gate.)

## Current state of `syllabus-k-phd`

Latest commit target: Session 114.19aa (T17.7 Phase D atomic migration). Prior commit `d98114d` shipped Phase C; this session's Phase D ships stacked on top. All prior session commits (114.19y 16 commits) pushed to `origin/syllabus-k-phd`.

## Session 114.19z — what shipped (Phase C)

### Gee's directives for this session

- **Continuation directive:** *"keep working these items off^(and remember drug shit it tied to life and syllabus shit)"* — T15 drug work must be woven into Life Experience + syllabus, not standalone.
- **Defer directive:** *"we wont be doing D15.D untill way later.. not after Kindergarden  learning only of the brain"* — T15.D (manual V1-V11 verification) deferred past the K-only push gate.

### Phase C architecture — shared forwarder migration

Rather than per-method commits across 15-20 teach helpers, Phase C ships as **one atomic shared-infrastructure migration**. `_writeTiledPattern` is used by every teach method in `curriculum.js`, so wiring it once migrates all teach paths together. Mirrors the same "no jerry rigging" principle from 114.19y — one clean boundary, every teach path moves together.

### Files touched

| File | What changed |
|------|--------------|
| `js/brain/gpu-compute.js` | New `rebindSparseMatrix(name, binding)` — converts already-uploaded standalone matrix to cluster-bound without re-transfer; frees standalone preSpikes/postCurrents/postSpikes buffers (~840 MB VRAM reclaimed across 14 projections) |
| `compute.html` | New `rebind_sparse` message handler calling `gpu.rebindSparseMatrix`, echoes `rebind_sparse_ack` |
| `server/brain-server.js` | `_ensureCortexCrossProjectionsBound()` rebinds 14 cortex cross-projections to main-cortex first-N sub-slices after `cortexCluster.initGpu()` completes. `gpuSparseHebbianBound` + `gpuSparsePropagateBound` zero-length-array variants. `_gpuWriteCortexSpikeSlice` helper for JSON write_spike_slice targeting main cortex. `gpuProxy` extended with `writeSpikeSlice` / `clearSpikeSlice` / `hebbianBound` / `propagateBound`. Ack switch extended for `rebind_sparse_ack`. |
| `js/brain/cluster.js` | `_crossRegionHebbian` routes bound projections through `gpuProxy.hebbianBound(name, lr)` (no pre/post array transfer). `_dispatchGpuPropagates` similarly switches to `gpuProxy.propagateBound(name)` for bound projections. |
| `js/brain/curriculum.js` | `_writeTiledPattern` forwards sparse indices to main cortex via `cluster._gpuProxy.writeSpikeSlice(regionName, indices)` after CPU-shadow write; indices map 1:1 since N == standalone region size. `_clearSpikes` clears all main-cortex region slices via `gpuProxy.clearSpikeSlice`. `_resolveRegionName` caches the {start,end}→name reverse lookup per cluster. |

### Mystery Ψ still woven through the main equation (per Gee)

Phase C adds no new Ψ terms — the three 114.19y terms remain active on every teach-time dispatch:
1. **Global gain** (pre-existing): `gainMultiplier = 0.9 + Ψ · 0.05` baked into `effectiveDrive`
2. **Per-region hemispheric binding** (114.19y A.3): `hemisphereGate = 0.5 + 0.5 · sigmoid(Ψ · 4.0)` in LIF_SHADER — applies to every main-cortex neuron including ones firing under teach currents
3. **Divergence correction gain** (114.19y B.4): `(1 + Ψ · 0.25) · 3` on cortex error correction

Cross-projection currents land in main-cortex `currents` buffer at the bound dst offset; LIF consumes them multiplied by the Ψ-modulated region gate. Mystery Ψ stays non-optional per Gee 'cant not have it involved'.

### Wire savings

At 7M-per-direction standalone size each Hebbian call shipped ~56 MB of pre+post arrays. With `hebbianBound` that drops to ~20 bytes per call. Across a K curriculum rep firing thousands of Hebbians, this is the difference between feasible and not at biological scale. Same logic for propagate.

## What's STILL open before push to main

### T17.7 remaining phases
- **Phase C follow-up** — per-region divergence telemetry during K curriculum walk
- **Phase E** — delete standalone `cortexCluster` + persistence VERSION 4→5 bump
- **Phase F** — Gee Part 2 verification + full doc + HTML sweep (README / ARCHITECTURE / EQUATIONS / brain-equations.html / unity-guide.html / SETUP)

### T16 remaining
- **T16.1.b** — Ctrl+C halts cleanly (Gee Part 2 verification)
- **T16.2.a / T16.2.d** — sem-write fix verification + K-word usage audit (Gee Part 2)
- **T16.5.b / T16.5.c / T16.5.d** — full-mind K gate redesign (blocked on Gee design-review; Common Core K.RF/K.W/K.L + DIBELS/STAR/AIMSweb rubrics)

### T15 (drug scheduler — tied to Life + syllabus per Gee)
- **T15.A** — pharmacology research (11 substances + 7 combos + 7 adult patterns + 7 sensory triggers + 8 brain mappings + 13 speech effects + 8 grade gates)
- **T15.B** — architecture (drug-scheduler module + persona rewrite + sensory wiring + UI + speech integration + decision engine + persistence)
- **T15.C** — implementation
- **T15.D** — manual verification V1-V11 **— DEFERRED past K-only push gate per Gee 2026-04-18**

### Push sequence (per T18.5 + Gee upgrade)
1. All of the above close (T15.D excluded per defer directive)
2. **T18.5.b** pre-push doc accuracy sweep (LAW: Docs before push, no patches)
3. **T18.5.c** ASK GEE explicitly for push approval — WAIT for his explicit yes
4. Gee's Part 2 K-curriculum signoff per LAW 6
5. `git push origin main`

**`syllabus-k-phd` branch is the working branch.** NO main-branch push until every step above closes.

## Session 114.19z commit plan

Single atomic commit covering all files listed above under one subject: `T17.7 Phase C — shared _writeTiledPattern forwarder + cross-projection rebind + cluster-bound Hebbian/propagate`.
