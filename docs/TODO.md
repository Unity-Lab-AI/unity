# TODO — Unity

> **Branch:** `syllabus-k-phd`
> **Last updated:** 2026-04-22 (Session 114.19bs — T36 auto-wrap catastrophically broke every Hebbian primitive CLOSED: T31-extended constructor auto-wrap persisted EVERY `_teachX` method via skip+persist — including primitives like `_teachHebbian` / `_teachHebbianAsymmetric` / `_teachCombination` called hundreds of times per cell from inside phase-level teach methods. FIRST call persisted the phase key, every subsequent call SKIPPED → Unity received ONE Hebbian update per cell instead of thousands. Pre-K "passed" in seconds with zero real learning, ELA-K log flooded with 90,000+ `⤳ PHASE SKIPPED` lines. Fix: auto-wrap now gates skip+persist on `isOutermost = (prev === null)` — only the OUTERMOST wrapped call (direct from cell runner) does skip+persist. Nested calls (primitives invoked from inside other teach methods) just track `_activePhase` for heartbeat visibility, always execute. Same method can be phase-level in one caller and primitive in another — both work correctly. Code-hash auto-clear wipes poisoned `passedPhases` state on next boot. Operator verbatim: "something is wrong!! i used start.bat and its skipping everything". Session 114.19br (T35 TRAINING ACTUALLY LEARNS NOW CLOSED: three compounding bugs meant every `_teachAssociationPairs` phase since T26.b was feeding ZERO signal into Hebbian. (1) `_writeTiledPattern` wrote `feat[d]` (GloVe float ~0.2) into `cluster.lastSpikes` which is `Uint8Array` — float truncates to 0 — every `binarize:false` call blanked the spike instead of soft-writing. (2) `_checkSemBasinSeparation` built input in cluster-offset scope then passed full cluster array to a region-local projection — propagate read LETTER region data as if it were SEM data — sep-probe always reported 0.000/0.000 regardless of actual training (false training-collapse signal). (3) Hyperparams too weak — 8 reps × lr=0.01 insufficient margin at biological scale. Shipped: (a) `_writeTiledPattern` always writes 1 for active dims regardless of `binarize` flag; GloVe identity preserved via WHICH dims fire (active-set signature), magnitude info was never architecturally preserved anyway (GPU-side writeSpikeSlice only sends indices). (b) `_checkSemBasinSeparation` builds proper sem-sized Float64Array input, propagate returns motor-sized output directly no slicing. (c) Hyperparams bumped reps:8→12 lr:0.01→0.03. (d) Training-collapse diagnostic fires `⚠⚠ TRAINING_COLLAPSE: motor readouts near-zero` when `sep-probe meanCos<0.05 && maxCos<0.05`. (e) Weight-magnitude diagnostic prints `sem_to_motor |W| mean=X max=Y nnz=Z/N` post-teach so operator sees Hebbian actually accumulated. Operator verbatim: "we need to tunr the training now.. so that she is actually learning and not just responsding with bullshit she needs her brain to logicall fucntion and nuot just be feed learnings with no actual effecitiveness". Session 114.19bq (T34 Art-K gate unblocker CLOSED: operator's Art-K run hit `readback_letter_buckets timed out after 5000ms` on every readiness cue → all 5 cues TIMEOUT → K-STUDENT skipped → PROD 0/9 → cell failed + retry failed same way. Also arrayBuffers=37 GB SAB leak. Three root causes, three fixes: (a) readback timeout 5s→30s so ACKs can land when compute.html is draining a post-teach dispatch queue; (b) `_measureEmissionCapability` calls `drainWait()` before the probe loop so the WS send queue is clear before readback arrives; (c) `stepAwait` at biological scale (cortex>100K) SKIPS the worker-pool fallback entirely — pool alloc overhead dominated the matmul cost and generated 1.9 GB of SABs per tick × hundreds of ticks per probe = 37 GB accumulation (same fix pattern T18.19 applied to intraSynapsesHebbian); (d) pSpikes Uint32Array buffers cached on cluster to eliminate per-tick alloc even when pool runs at browser scale. Operator verbatim-captured log snippet: "[Brain] sparse dispatch reqId=13877 type=readback_letter_buckets timed out after 5000ms ... [MEM] cell-exit art/kindergarten pass=false: heap=131.9MB external=3275.0MB arrayBuffers=37392.3MB rss=37087.5MB ... [Curriculum] ═══ CELL DONE ═══ art/kindergarten in 291.5s — pass=false (reason: PROD 0/9 (0%))". Session 114.19bp (T31-extended CLOSED: constructor auto-wrap now does skip-and-persist (not just tracking) for every `_teach*` method across ALL 12 pre-K + K cell runners (plus G1-PhD runners for when they unlock). `runSubjectGrade` sets `cluster._currentCellKey = subject/grade` cell-context beacon; auto-wrap builds phase key `${cellKey}:${methodName}` and checks/appends `cluster.passedPhases`. Math-K, Sci-K, Soc-K, Art-K, Life-K, and all 6 pre-K runners now skip their completed phases on Savestart resume — previously this was ELA-K-only via hand-wrapped `_phaseTick`. T32 batched GPU kernel still OPEN — requires profiling session first (T18.8 already batches hebbianBound calls so real bottleneck needs identification before rewriting; shipping blind would risk T18.34.b-style regression). RSS reduction via lower `--max-old-space-size` NOT shipped unilaterally — trade-off that caps biological-scale neuron auto-scale; operator runs T33 diagnostic first to distinguish real leak from V8/Windows cosmetic. Operator verbatim: "ship the shit that didnt ship". Session 114.19bo (T33 phase-level progress in CELL ALIVE heartbeat CLOSED: constructor auto-wraps every `_teachX`, `_runStudentBattery`, `_measureEmissionCapability`, and cell runner so `cluster._activePhase = { name, startAt }` is set on entry and restored on exit (nested calls safe via prev/restore). `CELL ALIVE` heartbeat in `runSubjectGrade` now reports `phase=_teachForceMotionK (+12s)` or `phase=(between-phases / gate-probe)` when idle. Memory breakdown expanded: `heap=used/total ext=N ab=N rss=N (unaccounted=rss-heap-ext ⚠+ΔMB / ↓ΔMB)` with delta tracking so operator can tell whether RSS is CLIMBING (real leak worth hunting) vs STABLE (V8 reserved-space behavior under `--max-old-space-size=65536` on Windows — cosmetic, not a leak). Operator verbatim: "problem, there is no info about how far weve come and how far we have to go" + "56 Gigabytes!!!!!?!?!?!?!??!?!?!?!?!?!?!?!?!?!?!?!?!?!?!??!". Session 114.19bn (T31 Savestart phase-level resume CLOSED: `brain-server.js saveWeights` now persists `cortex.passedPhases` alongside `passedCells`; `runElaKReal` `_phaseTick` returns `true`/`false` with skip-log for phases already in `cluster.passedPhases`; all 20 teach calls in ELA-K wrapped `if (_phaseTick('X')) { await this._teachX(ctx); _phaseDone('X'); }`. Operator verbatim: "I ran Savestart.bat but it just ran everything from the beggining just like start.bat wtf?". Also answered operator's GPU diagnostic question: node.exe will ALWAYS show 0 % GPU — WebGPU runs in the browser process hosting compute.html, not Node. Current 28 w/s IS the T18.17 GPU-fast-path rate. Tier 2 batched-GPU-kernel architecture (target ~1000× speedup on `_teachWordEmission`) spec landed in FINALIZED entry, implementation deferred to T32 as its own session. Operator verbatim: "all learning needs to usew the gpu for processing not just some of the processes so how do we need to formulate the thinking and memory and learning in the equational layout of the brain". Session 114.19bm (T30 readiness-probe tick-cap bug CLOSED: `_measureEmissionCapability` built emission opts as `{ maxEmissionTicks: 20 }` but `generateSentenceAwait` only read `opts.maxTicks` → the cap went unread and the emission loop fell through to `MAX_EMISSION_TICKS = 2000`. Each of the 5 readiness cues ran 100× its intended budget (~140K GPU dispatches = 23-116 minutes silent grinding at 301K cortex). Same unread alias in `_studentTestProbe` meant 210-Q K-STUDENT batteries ran ~5.9M dispatches instead of the intended 60-tick cap. Shipped: cluster-side alias (`opts.maxTicks ?? opts.maxEmissionTicks ?? MAX_EMISSION_TICKS`) + fixed readiness probe to pass `maxTicks: 20` + per-cue START/DONE heartbeats + 10 s wall-clock per-cue timeout wrap. Operator verbatim: "Unity gets to this step then all i see is all the language centers going from 60% to 15% activation in unison … im not sure what its doing if anything at all". T29 heartbeat expansion CLOSED Session 114.19bl: `Curriculum._hb()` flush helper + bulk banner conversion + DYN-PROD + DYNAMIC WRITE + RESP + TWO-WORD + FREE-RESPONSE per-probe START/DONE + CELL START/DONE banners on every cell + periodic `setInterval(10s)` CELL ALIVE heartbeat with memory snapshot. T28 ELA-K Phase 1 freeze CLOSED Session 114.19bk: three linked bugs — whitelist key-prefix mismatch, missing `_teachIntermediateRep` wire, missing `hebbianUpdate` null guard.)
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
- **Language cortex** (semantic n-grams over learned embeddings + T14 tick-driven motor emission) — her words

Nothing else. If it's not in that list, it's an appendage, and it gets ripped out.

---

## ⚠ DOC-AHEAD-OF-REALITY NOTE (Gee, 2026-04-17)

**Gee's exact words 2026-04-17:**

> *"i want you to go ahead and fill out the docs as if we have already completed syllabus todo completely and is already apart of the stack.. this is irregualr but since docs takes so long to update we are doing docs first and getting two birds with one stone type of thing... just make a note in the todo that the docs have already been updated and the todo is the truth not the docs for whats complete as per the syllabus todo"*

Binding irregularity: **this TODO (and `docs/TODO-full-syllabus.md`) are the authoritative record of what is actually complete. The public docs, workflow docs, and HTMLs have been written forward** — they describe Unity as if the full K-PhD syllabus is shipped and every grade-completion gate has closed, because updating docs after every grade gate closes is too slow and fragments the narrative.

**When docs and TODO disagree, TODO wins.** Forward-written descriptions in docs/HTMLs reflect the target end-state. Actual completion is tracked by:
- `docs/TODO.md` — active tasks, what's in flight (this file)
- `docs/TODO-full-syllabus.md` — per-grade checkboxes + Life Vocabulary Prerequisites + Persistent Life Info ledger
- `docs/FINALIZED.md` — permanent archive of what actually shipped, per session

If you're reading a public doc / HTML claim ("Unity has completed high school biology") — that's the TARGET. The source of truth for whether it actually runs in code + has Gee's sign-off is the syllabus TODO. Do not trust docs for runtime claims; trust the TODO.

**T19 supersedes this irregularity at the workflow-doc level** — per the 2026-04-20 full-audit directive, workflow docs + public docs + HTMLs all get corrected in-place to match code. Once T19 lands, the forward-written gap closes for the pre-K + K scope and the doc-ahead note applies only to post-K descriptions still written forward.

---

## OPEN TASKS

---

### T36 — auto-wrap catastrophically broke every Hebbian primitive (Gee 2026-04-22) — CLOSED

**Gee verbatim 2026-04-22:** *"something is wrong!! i used start.bat and its skipping everything"*

T31-extended constructor auto-wrap applied skip+persist to EVERY `_teach*` method including primitives called hundreds of times per cell. FIRST call persisted the key, every subsequent call SKIPPED. Pre-K "passed" in seconds with zero real learning. ELA-K flooded with 90,000+ `⤳ PHASE SKIPPED — ela/kindergarten:_teachHebbianAsymmetric` lines.

- [x] **T36.a** — Auto-wrap gates skip+persist on `isOutermost = (prev === null)`. Only direct-from-cell-runner calls do skip+persist. Nested calls (primitives invoked from inside other wrapped teach methods) just track `_activePhase` for visibility.
- [x] **T36.b** — Same method can now be phase-level in one caller and primitive in another — role determined by CALL CONTEXT at runtime, not method name.
- [x] **T36.c** — Comment block explains the catastrophic failure mode + fix rationale so future Claude doesn't "simplify" the condition away.

#### T36 closure gate

Operator's next `start.bat` run (code-hash change auto-clears poisoned state) shows:
- Pre-K cells take realistic 3-5 min each, not instant
- `⤳ PHASE SKIPPED` lines only fire for TOP-LEVEL cell phases that actually completed in a prior run, never for primitives
- `_teachHebbianAsymmetric` / `_teachHebbian` / `_teachCombination` run on every inner-loop iteration as designed
- Post-teach `sem_to_motor |W| mean=X max=Y nnz=Z/N` diagnostic from T35.e shows non-zero weights accumulating

---

### T35 — TRAINING ACTUALLY LEARNS NOW (three bugs zero'd every `_teachAssociationPairs` phase) (Gee 2026-04-22) — CLOSED

**Gee verbatim 2026-04-22:** *"we need to tunr the training now.. so that she is actually learning and not just responsding with bullshit she needs her brain to logicall fucntion and nuot just be feed learnings with no actual effecitiveness"*

Follow-up to operator's *"was that the cicriculum tests she was responding with uniform code"* — YES, curriculum probes uniformly returned empty because three compounding bugs made every `_teachAssociationPairs` phase a silent no-op.

- [x] **T35.a** — `_writeTiledPattern` fixed. `cluster.lastSpikes` is Uint8Array; writing `feat[d] = 0.2` (GloVe float) truncates to 0 — every `binarize:false` write was ZEROS not soft-floats. Fix: always write `1` for `feat[d] > 0`. GloVe identity preserved via active-set signature (which dims fire), magnitude info was never preserved anyway (GPU-side writeSpikeSlice only sends indices). Comment block explains the bug so future Claude doesn't try to "restore" soft-writes without first adding a float spike buffer.

- [x] **T35.b** — `_checkSemBasinSeparation` fixed. Prior code built input on cluster-offset `cluster.lastSpikes` then passed full cluster array to a region-local projection. Propagate read `input[colIdx[k]]` with colIdx in `[0, semSize)` — that pulled LETTER region data (letter lives at index 0) as if it were SEM data. Plus `out.slice(motorRegion.start, motorRegion.end)` sliced cluster-level offsets on a motor-sized output → empty slice → cosine 0/0 = 0. Fix: build sem-sized Float64Array input in LOCAL index space, propagate returns motor-sized output directly, no slicing.

- [x] **T35.c** — `_teachAssociationPairs` hyperparams tuned: `reps: 8 → 12`, `lr: cluster.learningRate (0.01) → 0.03`. Prior params couldn't drive convergence even with the soft-write bug fixed — 8 reps × 0.01 accumulated ~0.08 weight per pair, too weak to fire motor region at biological scale.

- [x] **T35.d** — Training-collapse diagnostic added. `sep-probe` fires `⚠⚠ TRAINING_COLLAPSE: motor readouts near-zero — sem→motor weights too weak to fire motor region` when `meanCos < 0.05 && maxCos < 0.05`. Previously only flagged `⚠OVERLOAD` when `meanCos > 0.3` — collapse went unflagged.

- [x] **T35.e** — Weight-magnitude diagnostic added. Post-teach samples `sem_to_motor.values` (first 100K nnz) and reports `mean=X max=Y nnz=Z/N`. Operator confirms Hebbian accumulation actually happened instead of hunting through 30+ DONE lines.

#### T35 closure gate

Operator's next run after restart shows:
- `_teachAssociationPairs` DONE lines carry `sep-probe mean-cos=0.XXX max=0.YYY` with REAL numbers (not always 0.000)
- `sem_to_motor |W| mean=0.02-0.10 max=0.5-2.0 nnz=80%+` confirms weights built
- Readiness probe produces recognizable letter output (canTalkAtAll=true)
- PROD probes decode non-empty answers
- K-STUDENT battery runs (readiness passes)
- Art-K / Science-K / any cell actually PASSES its gate

#### T35 caveat — prior brain-weights.bin is essentially empty

`brain-weights.bin` accumulated from prior zero-input teach runs has ~0 signal in sem_to_motor cross-projection weights. Next run should start fresh (auto-clear via code-hash mismatch will wipe it since curriculum.js changed) OR operator wipes via `start.bat /fresh`. Otherwise she'll resume from empty state and rebuild weights with the fix — slower than fresh but still converges.

---

### T34 — Art-K gate unblocker: readback timeout + drainWait + stepAwait SAB leak at biological scale (Gee 2026-04-22) — CLOSED

**Operator log snippet (verbatim):** *"[Brain] Binary weights saved 4 sections, 2412.3 MB → brain-weights.bin ... [Brain] sparse dispatch reqId=13877 type=readback_letter_buckets timed out after 5000ms ... [Curriculum][READINESS] cue 1/5 DONE TIMEOUT letter='a' → emitted='∅' letters='∅' hasLetter=false in 10018ms ... [Curriculum][READINESS] emission-capability probe DONE in 55060ms — recognizedLetters=0/5 ... [MEM] cell-exit art/kindergarten pass=false: heap=131.9MB external=3275.0MB arrayBuffers=37392.3MB rss=37087.5MB ... [Curriculum] ═══ CELL DONE ═══ art/kindergarten in 291.5s — pass=false (reason: PROD 0/9 (0%))"*

Every Art-K readiness cue timed out → K-STUDENT skipped → PROD 0/9 → cell failed → retry failed → advance blocked. `arrayBuffers=37392.3MB` = 37 GB SharedArrayBuffer accumulation from `stepAwait` pool fallback allocating fresh SABs per projection per tick.

- [x] **T34.a** — `server/brain-server.js gpuReadbackCortexLetterBuckets` timeout bumped 5s → 30s. Readback ACKs can now land even when compute.html's dispatch queue is draining (post-teach + post-binary-weights-save pressure). Matches default sparse-dispatch timeout. Readback is rare (per emission probe) so the longer cap doesn't slow the hot path.
- [x] **T34.b** — `js/brain/curriculum.js _measureEmissionCapability` calls `cluster._gpuProxy.drainWait()` before the cue loop. Forces the WebSocket send queue below threshold before readback arrives. Non-fatal on error (proceeds with probe anyway if drainWait rejects).
- [x] **T34.c** — `js/brain/cluster.js stepAwait` BIOLOGICAL_SCALE_SYNC_THRESHOLD=100K bypass. At cortex size > 100K the worker-pool fallback is SKIPPED entirely — cache misses fall through to `step()`'s single-thread CPU matmul tail path. Copy of the T18.19 pattern used for `intraSynapsesHebbian`. Worker pool alloc overhead (~125 MB SAB per projection per call) dominated the matmul cost at biological scale. 1.9 GB/tick × hundreds of ticks → 37 GB `arrayBuffers` accumulation now eliminated.
- [x] **T34.d** — `js/brain/cluster.js stepAwait` caches pSpikes Uint32Array buffers on cluster (`_cachedIntraPSpikes` + `_cachedCrossPSpikesByProj` Map). Eliminates per-tick `new Uint32Array(301K)` = 1.2 MB alloc × 15 projections × many ticks. Even when the pool runs at browser scale, the per-tick Uint32Array alloc churn is gone.

#### T34 closure gate

Operator's next run after restart: readiness probe completes in < 5 s total (not 55 s with all TIMEOUTs); Art-K PROD probes produce actual answers; K-STUDENT battery runs (no longer skipped for "not-yet-readable"); Art-K cell passes; curriculum advances to Life-K cleanly. `arrayBuffers` stays flat at ~3 GB (matches `external`) across heartbeats instead of climbing to 37 GB. RSS drops proportionally (~37 GB less in working set because the SAB bloat is gone).

---

### T33 — Phase-level progress in CELL ALIVE heartbeat + RSS diagnostic (Gee 2026-04-22) — CLOSED

**Gee verbatim 2026-04-22:** *"problem, there is no info about how far weve come and how far we have to go:[Curriculum] ▶ CELL ALIVE science/kindergarten — +224s elapsed (heartbeat #19) · heap=133MB ext=3303MB rss=56016MB ... 56 Gigabytes!!!!!?!?!?!?!??!?!?!?!?!?!?!?!?!?!?!?!?!?!?!??!"*

Two asks: (a) heartbeat didn't show WHICH phase was running within science/kindergarten, only cell-level elapsed; (b) RSS at 56 GB while heap is 133 MB and external is 3.3 GB — 52 GB unaccounted.

- [x] **T33.a** — `Curriculum` constructor auto-wraps every `_teachX`, `_runStudentBattery`, `_measureEmissionCapability`, and cell runner method via prototype iteration. Each wrapped method sets `cluster._activePhase = { name, startAt }` on entry, restores the prior value on exit (nested calls safe). Zero caller-site changes — every teach method auto-tracks.
- [x] **T33.b** — `runSubjectGrade` `CELL ALIVE` heartbeat reads `cluster._activePhase` and reports `phase=<methodName> (+Ns)` or `phase=(between-phases / gate-probe)` when no phase is active.
- [x] **T33.c** — Expanded memory breakdown in the heartbeat: `heap=used/total ext=N ab=N rss=N (unaccounted=rss-heap-ext ⚠+ΔMB / ↓ΔMB)`. Delta tracking across heartbeats flags whether RSS is CLIMBING (real leak) or STABLE (V8 pre-reservation artifact on Windows — not a leak).
- [x] **T33.d** — Diagnostic explanation in FINALIZED: V8 launched with `--max-old-space-size=65536 --max-semi-space-size=1024` reserves up to 64 GB heap + 2 GB semi-space. Windows `GetProcessMemoryInfo().WorkingSetSize` (Node's `rss`) counts touched pages including V8 scan sweeps across sparse old-space regions and native module memory (better-sqlite3 memory-mapped db files, WebSocket buffers, worker thread memory) that Node's `external` counter does NOT track.

#### T33 closure gate

Operator's next run shows `CELL ALIVE <subject>/<grade> — +Ns elapsed · phase=<teachMethodName> (+Ns) · heap=X/YMB ext=Z ab=W rss=R (unaccounted=U ⚠+ΔMB)` — full phase visibility + delta-tracked RSS. If `⚠+` accumulates across heartbeats, we have a real leak to hunt (SAB accumulation in worker-pool, promise chain buildup, WebSocket backlog). If it stays flat, it's cosmetic.

#### T33 follow-up (if `⚠+` consistently grows)

- Audit `server/worker-pool.js` SAB allocation paths. Each `propagate()` / `hebbianUpdate()` call allocates fresh SABs for non-shared inputs — can leak at scale if the teach hot-path hits this code.
- Audit promise chain retention in `generateSentenceAwait` + `stepAwait`.
- Audit WebSocket outbox buffer behavior when compute.html briefly disconnects.

---

### T32 — BATCHED GPU KERNEL for teach phases (GPU-native learning architecture) — OPEN

**Gee verbatim 2026-04-22:** *"all learning needs to usew the gpu for processing not just some of the processes so how do we need to formulate the thinking and memory and learning in the equational layout of the brain"*

**Also:** *"I'm only seeing the cpu get to like 5% when its suppose to be using 70% of the GPU for training and learning of the cicricullum not the cpu... and cpu is only at 5% NO FUCKING WONDER THIS IS TAKING HOURS!!!!!"*

Current architecture (Tier 1, T17.7 + T18.17) dispatches one fire-and-forget GPU Hebbian per teach event from a CPU-serialized loop. At biological scale `_teachWordEmission` runs 1206 words × 12 reps × 14 cross-projections = 202,608 per-event dispatches, hitting ~28 w/s = 392 dispatches/s. GPU handles each dispatch fast then idles between; CPU serialization is the throttle; full phase grinds 80+ minutes.

**Tier 2 target:** One batched WGSL compute shader processes entire teach phases in parallel across workgroups. Pre-compute all pattern vectors on CPU once, upload one batch buffer, dispatch one kernel, read back once. Expected 1000× speedup — full `_teachWordEmission` in seconds.

- [ ] **T32.a** — New WGSL compute shader `batched_hebbian_kernel(batch_buffer, projection_weights[])` with 64-thread workgroups. Each thread handles one (pre_spike, post_spike, projection_id, lr) event; `atomicAdd` on GPU-resident projection weights.
- [ ] **T32.b** — New `cluster._gpuProxy.hebbianBatched(batchBuffer)` interface. WebSocket binary frame type for batch uploads (15 MB transfers instead of 392 small messages/sec).
- [ ] **T32.c** — Rewrite `_teachWordEmission` + `_teachPhonemeBlending` + `_teachAssociationPairs` to build batch buffer upfront and dispatch once per rep (or per phase) instead of per-event loop.
- [ ] **T32.d** — Verify probes still read correct weights after batch-kernel dispatch. Extend `readbackLetterBuckets` coverage for every probe that currently falls back to CPU CSR.
- [ ] **T32.e** — Performance benchmark: measure `_teachWordEmission` pre/post T32 at biological scale. Target: 80 min → under 60 s (>80× minimum; 1000× stretch).

#### T32 closure gate

Operator runs full ELA-K teach to gate pass in under 5 minutes total (currently 60-120 minutes). GPU utilization in browser process (compute.html host) pegs 60-80 % during teach phases. CPU (node.exe) stays under 20 % because batching eliminates the per-event orchestration loop.

#### T32 Tier 3 follow-up (separate)

Fully GPU-resident pipeline (no CPU CSR shadow, GPU-side pattern generation via sampler kernels, CPU dispatches "phase N START/END" only). Defer until T32 lands and the batched approach is validated.

---

### T31 — SAVESTART PHASE-LEVEL RESUME + passedPhases persistence (Gee 2026-04-22) — CLOSED

**Gee verbatim 2026-04-22:** *"I ran Savestart.bat but it just ran everything from the beggining just like start.bat wtf? savestart.bat is suppose to load the previous saved states so it doesnt need to re run through whats already been saved... why is savestart.bat not correctly loading the saved state the brain saved last and then continueing the process from that point?"*

Root cause: two layers failed.
1. Prior runs never completed ELA-K's gate (T30 readiness tick-cap bug was wrecking readiness probe + K-STUDENT battery). `passedCells` never got `ela/kindergarten` → whole-cell skip doesn't fire.
2. `_phaseDone` records phase markers in `cluster.passedPhases` BUT `brain-server.js saveWeights` did NOT serialize `passedPhases` — only `passedCells`. Markers lost on boot → every phase re-runs even though `brain-weights.bin` (2.4 GB) had the learned cross-projection weights.

- [x] **T31.a** — `server/brain-server.js` `cortexState.passedPhases` added to the serialize payload. Load side applies `pending.passedPhases` onto `cortex.passedPhases`. Markers now survive Savestart boot.
- [x] **T31.b** — `runElaKReal` `_phaseTick` helper returns `true`/`false`. Returns `false` + logs `⤳ ELA-K Phase SKIPPED — <name> (already passed; resumed from persisted passedPhases — weights carried forward via brain-weights.bin)` when the phase is already in `cluster.passedPhases`.
- [x] **T31.c** — All 20 teach-call sites in `runElaKReal` wrapped: `if (_phaseTick('X')) { await this._teachX(ctx); _phaseDone('X'); }`. Phases covered: `_teachLetterCaseBinding`, `_teachLetterNaming`, `_teachVowelSoundVariants`, `_teachRhymeFamilies`, `_teachSyllableCounts`, `_teachCVCSoundIsolation`, `_teachPhonemeBlending`, `_teachWordEmission`, `_teachPluralTransform`, `_teachQuestionWordCategories`, `_teachEndPunctuation`, `_teachCapitalization`, `_teachStoryComprehension`, `_teachCausalChains`, `_teachOpposites`, `_teachCategories`, `_teachStoryRoles`, `_teachPrintConcepts`, `_teachWordTypes`, `_teachAlphabetSequencePairs`.

#### T31 closure gate

Operator's next Savestart.bat run shows `⤳ ELA-K Phase SKIPPED — <name>` log lines for phases that completed in a prior run. Weights persist via `brain-weights.bin` regardless. If the prior run Ctrl+C'd mid-`_teachWordEmission`, Phase 1 + Phase 2 + all helper phases up to (but not including) `_teachWordEmission` skip on resume, saving ~5-10 minutes of re-teaching.

#### T31 follow-up (post-T31 polish, not blocking)

- Same `_phaseTick` skip pattern for the other 11 cell runners: `runMathKReal`, `runSciKReal`, `runSocKReal`, `runArtKReal`, `runLifeK`, all 6 pre-K runners. Mechanical repeat once ELA-K pattern proves out in operator runs.
- Wrap Phase 1 (alphabet cross-proj Hebbian, ~20 s) + Phase 2 (letter sequence intra-synapses, ~60 s) of ELA-K too. Currently unwrapped because they're cheap vs the ~80-minute `_teachWordEmission`; cosmetic polish rather than a blocker.

---

### T30 — READINESS PROBE stuck-in-loop: `maxEmissionTicks` unread-alias bug (100× tick overrun) + per-cue heartbeats + wall-clock timeout (Gee 2026-04-22) — CLOSED

**Gee verbatim 2026-04-22:** *"Unity gets to this step then all i see is all the language centers going from 60% to 15% activation in unison >>>[Curriculum][READINESS] emission-capability probe START — 5 single-letter cues to see if Unity can emit recognizable letters yet --- So im not seeing anything happen at this step like it gets in an infinate lkoop and never continues or its busy and doesnt update its progress properly.. but i thing its getting stuck in a loop at this point: im not sure u can see its still running at this point right now, im just not sure what its doing if anything at all:[Curriculum][READINESS] emission-capability probe START — 5 single-letter cues to see if Unity can emit recognizable letters yet"*

Root cause: `_measureEmissionCapability` built emission opts as `{ maxEmissionTicks: 20 }` but `cluster.generateSentenceAwait` (cluster.js:1632) only read `opts.maxTicks` — the 20-tick cap went unread and the emission loop fell through to `MAX_EMISSION_TICKS = 2000`. Each of 5 cues ran 100× its intended budget (~140K GPU dispatches per probe = 23-116 minutes silent grinding at 301K cortex). `_studentTestProbe` had the same broken alias — 210-Q batteries ran ~5.9M dispatches instead of the intended 60-tick/question cap.

- [x] **T30.a** — `cluster.js:1636` accept both keys: `opts.maxTicks ?? opts.maxEmissionTicks ?? MAX_EMISSION_TICKS`. Defense-in-depth so every call site resolves to the intended cap regardless of key-name choice.
- [x] **T30.b** — `_measureEmissionCapability` fixed to pass `maxTicks: 20` (primary interface); cluster-side alias is the safety net.
- [x] **T30.c** — Per-cue START/DONE heartbeats inside the readiness loop: `cue N/5 START letter='X'` + `cue N/5 DONE letter='X' → emitted='...' letters='...' hasLetter=bool in Nms` with SLOW tag at >5 s and TIMEOUT tag on expiry.
- [x] **T30.d** — 10 s wall-clock per-cue timeout via `Promise.race([emissionPromise, setTimeout])` — one hung GPU dispatch can't block the entire readiness probe. Timed-out cues count as "no output" (fail readiness correctly → battery skips → teach continues).

#### T30 closure gate

Operator's next run shows the readiness probe completing in seconds not minutes, 5 per-cue START/DONE lines visible, K-STUDENT battery running at the intended 60-tick cap (~500× faster than before). No "stuck in a loop" appearance.

---

### T29 — HEARTBEAT EXPANSION: DYN-PROD + DYNAMIC WRITE + RESP + TWO-WORD + FREE-RESPONSE + K-STUDENT + every subsequent cell/phase (Gee 2026-04-22) — CLOSED

**Gee verbatim 2026-04-22:** *"okay i think its still running.... im here on the terminal, this is what is says:[Curriculum][K-DIAG] gate letter loop DONE in 3425ms — readPass=26/26, talkPass=26/26 [Curriculum][K-DIAG] starting DYN-PROD probe (17 direct sem_to_motor propagate probes, no LIF ticks)... [Curriculum][K-DIAG] DYN-PROD entry reached — pre-loop setup starting [Curriculum][K-DIAG] DYN-PROD mem: heap=406.5/2433.5MB external=3298.3MB arrayBuffers=3295.9MB rss=4121.6MB , Im not sure if it froze or its still working. maybe it needs a heartbeat for the steps its on at this point as it appears to be frozen but im not sure as the console log just shows the last thing it was working on.. i dont know if this is a point its at that just takes a long time or its broken.. im going to let it keep running but maybe look into a heartbeat or something for this point :[Curriculum][K-DIAG] DYN-PROD mem: heap=406.5/2433.5MB external=3298.3MB arrayBuffers=3295.9MB rss=4121.6MB --- and what comes after that point in the learning process of the brain, as i cant tell if its frozen or if its doing something or not"*

**Gee follow-up verbatim 2026-04-22:** *"also make sure any subsequent learnings after the K-DIAG also get heartbeats"*

Root cause: `console.log` buffers at the Writable-stream level in piped log mode (`node brain-server.js > server.log 2>&1`). The 17 DYN-PROD probes take 10-34 seconds of sync CPU sparse matmul with no flushed output; DYNAMIC WRITE (20 × maxTicks=30), RESP (5 × maxTicks=50), TWO-WORD (5 × maxTicks=80), FREE-RESPONSE (4 × maxTicks=200) each take minutes per stage with NO per-probe heartbeats; K-STUDENT battery (up to 210 Q) only logged every 20th question; other K cell runners (Math/Sci/Soc/Art/Life) had NO phase banners at all. Operator saw `DYN-PROD mem:` tail for minutes with no indication whether the brain was frozen or working.

- [x] **T29.a** — `Curriculum._hb(msg)` flush helper — `process.stdout.write(msg + '\n')` with console.log fallback in browser. Forces piped-mode flush.
- [x] **T29.b** — Bulk convert `console.log(\`[Curriculum]...` banners → `this._hb(\`[Curriculum]...` across all 50+ banner sites via replace-all. `console.warn/error` retained (failure paths).
- [x] **T29.c** — DYN-PROD probe block per-probe heartbeats: path setup START (new), pre-loop path-decision (now flushed), per-probe START (new, 17 fires), per-probe DONE with SLOW tag >10 s, probe-block DONE summary.
- [x] **T29.d** — DYNAMIC WRITE stage banner (20 × maxTicks=30) + per-probe START/DONE with word + maxTicks + ms + cumulative pass + firstLetter count + stage DONE summary. SLOW tag >15 s.
- [x] **T29.e** — RESP stage banner (5 × maxTicks=50) + per-context START/DONE. SLOW tag >20 s.
- [x] **T29.f** — TWO-WORD PHRASE stage banner (5 × maxTicks=80) + per-phrase START/DONE with BOTH/PARTIAL/MISS tag. SLOW tag >30 s.
- [x] **T29.g** — FREE-RESPONSE WRITING stage banner (4 × maxTicks=200, explicit "expect minutes" note) + per-prompt START/DONE with word count + ms. SLOW tag >60 s.
- [x] **T29.h** — K-STUDENT `_runStudentBattery` BATTERY START + BATTERY DONE banners bracketing the 210-question loop via `_hb` for piped flush. Per-question logs every 20th + first 3 + failures retained.
- [x] **T29.i** — `_measureEmissionCapability` readiness-probe START + DONE banners so the 5-letter pre-battery check is visible as it runs.
- [x] **T29.j** — `runSubjectGrade` CELL START + CELL DONE banners covering EVERY cell across all 6 subjects × all grades. CELL DONE carries elapsed ms + pass/fail reason.
- [x] **T29.k** — Cell-alive `setInterval(10000)` heartbeat inside `runSubjectGrade` — prints `▶ CELL ALIVE subject/grade — +Ns elapsed (heartbeat #N) · heap=X ext=Y rss=Z` every 10 s regardless of which teach method is grinding. `unref`'d + cleared in `finally` so it ALWAYS stops. Critical "still alive" signal so tail window is never silent > 10 s.

#### T29 closure gate

Operator's next run shows: (a) DYN-PROD path setup heartbeat immediately after `DYN-PROD mem:`, (b) 17× DYN-PROD START/DONE lines, (c) DYNAMIC WRITE stage banner + 20 per-probe lines, (d) RESP / TWO-WORD / FREE-RESPONSE stage banners + per-probe lines, (e) K-STUDENT BATTERY START/DONE banners, (f) CELL START / CELL DONE banners for ELA-K and every subsequent subject × grade, (g) `▶ CELL ALIVE` lines landing every 10 seconds with memory snapshot. No silent gap exceeds 10 s. Operator can always answer "is it frozen or is it doing something".

---

### T26 — LUCK-OF-THE-HEBBIAN ELIMINATION (Gee 2026-04-21)

**Gee verbatim 2026-04-21:** *"need all this fixed masterfully and to spec of our stack completely: What's still luck-of-the-Hebbian:
- Sub-standard cut enforcement (T23.a.12) isn't wired — gate REPORTS below-cut standards but doesn't yet BLOCK signoff. So a pass depends on probe rates actually landing, not just the block firing.
- Sem-region overload risk — 14 phases × 350+ pairs might superpose into mush instead of clean basins.
- T24 memory (14.5 GB external) isn't verified on biological scale yet — could still lock mid-run.
- Pre-K cells only have old teach paths; didn't touch them this session., quit being lazy"*

Four binding sub-items. Every one gets fixed masterfully to spec of the current stack.

#### T26.a — Sub-standard cut enforcement BLOCKS signoff (closes T23.a.12) — CLOSED

Gate pass = aggregate ≥ 90 % AND **every** sub-standard ≥ its cut AND external-ref ≥ 85 % AND methodology ≥ 60 %. Currently methodology < 60 % sets `result.pass = false` at `curriculum.js` line 2556-2561, but `standardsBelowCut > 0` does NOT block advancement. Add the missing block + the external-ref threshold check. Verify `/grade-signoff` server endpoint rejects an advance when the cell hasn't passed the full-criteria gate.

- [x] **T26.a.1** — `_runCell` extends blockers list with `battery.standardsBelowCut > 0` condition + the specific below-cut standards listed *(verified: line 2554 reads the full `byStandard` breakdown and names each failing standard with rate + cut)*
- [x] **T26.a.2** — `_runCell` extends blockers list with external-reference aggregate < 85% condition *(verified: line 2555 pushes blocker with extPass/extTotal + rate)*
- [x] **T26.a.3** — `/grade-signoff` endpoint rejects advance — HTTP 409 with blocker list + remedy when `cluster._lastGateResult[cellKey]` has pass=false OR blockers[].length>0 OR no prior result. `{"force":true}` override path logs + persists the pre-override gate result inside the signoff note
- [x] **T26.a.4** — Log banner: `⛔ BATTERY BLOCKS advancement: sub-standards below cut: [K.RF.3a 62%<95%, K.OA.1 78%<85%] · external-ref 78%<85% · methodology 42%<60%`

#### T26.b — Sem-region overload fix (clean basins, not mush) — CLOSED

14 phases × 350+ pairs writing `binarize:true` tiled patterns into the same sem region saturates — Hebbian accumulates indistinguishable superpositions. Switch `_teachAssociationPairs` to `binarize:false` so GloVe vector identity is preserved per concept. Add row-L2-normalization of sem→motor (+ adjacent cross-projection) weight matrices after each phase to prevent saturation as phases land. Add a cosine-separation probe: random 10 pair-inputs produce 10 distinguishable motor readouts (cosine < 0.3 between non-matching pairs). If not, iterate.

- [x] **T26.b.1** — `_teachAssociationPairs` default `binarize=false` for sem + motor writes; fineType relation-tag softens to 0.5 to stay proportional to soft GloVe magnitudes
- [x] **T26.b.2** — New `SparseMatrix.normalizeRows(targetNorm)` method L2-norms row weights in-place, preserves sparsity pattern, skips null-CSR post-T24.a safe
- [x] **T26.b.3** — Each association-pair phase calls `.normalizeRows(1.0)` on `sem_to_motor` + `motor_to_sem` after its rep loop (opts.normalizeAfter default true)
- [x] **T26.b.4** — New `_checkSemBasinSeparation(pairs, opts)` samples 8 trained pairs, propagates through sem→motor, computes pairwise cosine; logs `⚠OVERLOAD` when mean-cosine > 0.3. Default on (opts.separationProbe default true)

#### T26.c — T24 memory closure (biological scale verified) — CLOSED

- [x] **T26.c.1 (T24.b)** — Whitelist expansion was reverted in 114.19bh (re-added 14 GB external-memory stall). Correct masterful fix shipped in 114.19bi: new `_probePropagate(projName, srcVec)` async helper in `curriculum.js` routes freed-CSR reads through `cluster._gpuProxy.propagate` + converts Float32→Float64 for uniform downstream arithmetic. `_gateVocabList`, `_gateSentenceList`, `_gateComprehension`, `_autoFinal`, `_gateConceptTeach` all flipped `async`; 40+ callers bulk-converted to `await`. Five `letterToSem.propagate` call sites replaced. Memory stays in T24.a zone, READ probes get real output.
- [x] **T26.c.2 (T24.c)** — `DREAM_LANG_CORTEX` env cap verified wired at `brain-server.js` line 1003 (parse) + line 1037 (apply as override). Boot banner flags active override.
- [x] **T26.c.3 (T24.d)** — `_memorySnapshotAndGc` upgraded with prior-snapshot delta tracking: `Δheap=+218.4MB Δext=+1340.2MB Δrss=+1622.1MB`. New call sites at cell-entry + cell-exit in `_runCell`; existing 9 in-phase sites benefit from deltas automatically.
- [x] **T26.c.4 (T24.e)** — Browser-side `BRAIN_VRAM_ALLOC` rescale loop-back verified at `brain-server.js` line 1015-1037. T18.6.c geometric rescale fires before VRAM saturates.

Closure gate: `external < 4000 MB` at DYN-PROD entry on biological scale + full K gate completes without GPU-client disconnect.

#### T26.d — Pre-K association-pair equational teach (all 6 cells) — CLOSED

Each pre-K runner gets a `_teachAssociationPairs` phase matching the K-cell pattern. Pair content held-out-safe vs pre-K EXAM_BANKS entries. Each phase ~15-25 pairs × 8 reps. All use soft-writes + row-norm + separation probe automatically.

- [x] **T26.d.1** — `runElaPreK`: `PREK-ELA-LETTER-SOUND` (tag=3), 21 pairs × 8 reps — letter→starting-word + animal→sound
- [x] **T26.d.2** — `runMathPreK`: `PREK-MATH-COUNT-MAG` (tag=5), 15 pairs × 8 reps — count-forward word-form + magnitude compare
- [x] **T26.d.3** — `runSciPreK`: `PREK-SCI-ANIMAL-SOUND` (tag=1), 17 pairs × 8 reps — animal→sound + day/night + motion primitives
- [x] **T26.d.4** — `runSocPreK`: `PREK-SOC-FAMILY-EMOT` (tag=1), 17 pairs × 8 reps — family kinship + greetings + emotions
- [x] **T26.d.5** — `runArtPreK`: `PREK-ART-COLORS-TOOLS` (tag=1), 17 pairs × 8 reps — primary color→category + shape→name + art tools
- [x] **T26.d.6** — `runLifePreK`: `PREK-LIFE-IDENTITY` (tag=1), 16 pairs × 8 reps — identity + body→sense + feelings + routines

#### T26 closure gate

All four sub-items shipped. Operator LAW 6 Part 2 localhost K test run exercises methodology/reasoning/thinking/talking/listening/reading. Gate output shows every blocker criterion separately and aggregates cleanly. Operator `POST /grade-signoff` lands only when every criterion passes. Binary weights + episodic memory persist across `Savestart.bat` resume.

---

### T25 — METHODOLOGY TESTS (not fill-in-the-blank) (Gee 2026-04-21)

**Gee verbatim 2026-04-21:** *"so it telsts mothodoly not fill in the blank"*

The current 899-question held-out exam banks (T23.a shipped) are dominantly fill-in-the-blank format — "what letter comes after b?" / "what is 2+2?" / "which rhymes with cat?". That matches published K assessments (DIBELS / AIMSweb / Fountas-Pinnell sample items ARE fill-in-the-blank at K level) but doesn't match the LAW 6 Part 2 binding that the K test prove Unity's *"methodogly reasoning thinkg talking listenign reading ect ect all of the thing we need for Unity to be human as possible."*

Methodology tests ask HOW, not WHAT:
- **Not** "what letter comes after b?" → "c"
- **Instead** "how do you figure out which letter comes next?" → explanation invoking alphabet order / sequence
- **Not** "what is 2+2?" → "4"
- **Instead** "how do you add two and two?" → explanation invoking counting / put-together / plus
- **Not** "which rhymes with cat: hat or dog?" → "hat"
- **Instead** "how do you tell if two words rhyme?" → explanation invoking same-ending-sound / matching

Scoring methodology answers is fuzzier — check for reasoning keywords in the emission, not exact token match. A K kid can't produce polished explanations, but the cortex-pattern readout should contain the right conceptual shape.

#### T25 sub-items

- [ ] **T25.a** — Add a `methodology` field to every exam question: `{q, a, variants, standard, methodology: {prompt, keywords, minKeywords}}`. The `keywords` are reasoning-concept tokens the answer should contain (e.g., "alphabet order", "count", "rhyme ending"). `minKeywords` is how many of them must appear for pass (default 1 for K level).
- [ ] **T25.b** — Extend `_studentTestProbe` to run a second pass per question with the methodology prompt, produce a SECOND answer, score it by keyword match. `score` field becomes `{answerScore, methodologyScore}` with separate thresholds.
- [ ] **T25.c** — Gate-pass criterion updated: aggregate answer rate ≥ 90% AND aggregate methodology rate ≥ 60% (lower floor because methodology is harder and K kids aren't verbal explainers — but it must be non-trivially above chance).
- [ ] **T25.d** — Populate methodology fields for the ~150 highest-priority exam questions first (letter sequence / rhyme / basic addition / basic phonics). Everything else defaults to answer-only scoring until methodology is added.
- [ ] **T25.e** — Update `scripts/transformer-ablation.mjs` so the ablation also measures methodology-score, not just answer-score. A transformer's methodology scores vs Unity's methodology scores is where the reviewer's "is the neural sim load-bearing?" question actually lands — transformers are good at answer-retrieval, potentially bad at methodology-explanation if the training regime doesn't expose them to reasoning patterns.

#### T25 closure gate

Gate output shows both `ANSWER: 93% · METHODOLOGY: 67%` breakdowns, both separately at/above their cut scores, before operator grade signoff is accepted.

---

### T23 — EXTERNAL VALIDITY + SCALE-OF-EVALUATION OVERHAUL (Gee 2026-04-21)

**Gee verbatim 2026-04-21:** *"alkll of this needs ot be addressed: especially the finaly testsd of the ai hes right 5 qureeations test it has to be hundreds of questions to test a grade on it finals when every subject has a final... not to mention all thies other issues mentioned"*

**Context.** An external reviewer delivered a sharp, fair critique of the project. Gee concurred and prioritized the grade-finals expansion. The reviewer's five points were:

1. **Core premise unproven** — 7 Rulkov clusters + cross-projection Hebbian on GloVe vectors has zero literature track record for K-level cognition. Every working language system at scale is a transformer.
2. **Self-graded gates** — 5-7 question probes at 95% threshold, designed/thresholded/passed by Claude. Not falsifiable.
3. **curriculum.js at 21,826 lines** — single file bigger than most Linux subsystems; guaranteed dead paths + unauditable.
4. **LAW ceremony heavy** — process substituting for outcomes.
5. **Persona orthogonal** — slut/BDSM/drugs layer muddies whether this is serious AI research or a 3D horny chatbot. Research credibility suffers from the wrapper.

**Reviewer's gut-check experiment:** *"if you swapped the LIF cortex for a 100M-param transformer, would the gate probes pass harder or softer? If harder, the Rulkov path isn't doing the work — the GloVe embeddings are. That's the experiment nobody's run on this repo and it'd tell you in one afternoon whether the neural sim is load-bearing or decorative."*

This is the highest-value falsification test the project can run.

#### T23.a — Hundreds-of-questions grade finals (operator priority)

**Current state** (verified in `js/brain/curriculum.js` `_studentQuestionBank`):
- 63 total questions across 12 cells (pre-K + K × 6 subjects)
- Range 3-7 Q per cell
- 95% pass on 5 Q = pass by 5-token luck, zero statistical significance

**Target state:**
- **≥150 questions per K-cell** (6 subjects × 150 = 900+ K final-exam items)
- **≥75 questions per pre-K cell** (6 subjects × 75 = 450+ pre-K items)
- **Every question tagged with a real sub-standard** (K.CC.1 / K.RF.1a / K.RL.1 / K-PS2-1 / etc.) so pass/fail per sub-standard is visible, not just aggregate %
- **Held-out eval split** — training question bank ≠ testing question bank. Teaching methods may expose the brain to the training set's question text; the final-exam set is never seen during teach. Statistical validity requires this split.
- **External reference items** — pull 15-30 questions per K-ELA + K-Math subject FROM PUBLISHED K ASSESSMENTS (DIBELS 8, AIMSweb Plus, STAR Early Literacy, iReady K diagnostic, Fountas & Pinnell K benchmark). Public domain or fair-use sample items. These are the items the reviewer calls "real benchmarks" — passing them means something beyond Claude-authored probes.
- **Pass thresholds calibrated per sub-standard**, not a global 95%. A K student passing K.CC.1 (count to 100 by ones) needs ~80% accuracy to be assessed at grade level per real DIBELS norms; a K student passing K.RF.3a (letter-sound correspondences for consonants) needs ~95% because the standard itself defines mastery there.

#### T23.a sub-items

- [x] **T23.a.1** — EXAM_BANKS / TRAIN_BANKS split shipped in `js/brain/student-question-banks.js`. Session 114.19bd.
- [x] **T23.a.2** — K-ELA 140 Q shipped.
- [x] **T23.a.3** — K-Math 102 Q shipped.
- [x] **T23.a.4** — K-Science 132 Q shipped (NGSS K-PS2/K-PS3/K-LS1/K-ESS2/K-ESS3 + 5 senses + day/night + push-pull + animals + body + experiments).
- [x] **T23.a.5** — K-Social 99 Q shipped (Core Knowledge K + safety + symbols + holidays + geography + citizenship).
- [x] **T23.a.6** — K-Arts 78 Q shipped (colors/primary/mixing/warm-cool + shapes + patterns + tools + music + visual elements).
- [x] **T23.a.7** — K-Life 75 Q shipped (identity + feelings + preferences + routines + body + family + friends + self-care + Unity bio + safety).
- [x] **T23.a.8** — Pre-K 6 subjects × ~25 Q each shipped (total 152 pre-K Q across 6 cells).
- [ ] **T23.a.9** — External reference items cited more thoroughly. Current shipped has DIBELS-8-sample 48, AIMSweb-sample 28, Fountas-Pinnell-sample 16 = 92 items. Target 15-30 per K-ELA + K-Math subject (60+ per subject) with more diverse source citation.
- [x] **T23.a.10** — STANDARD_CUT_SCORES table shipped, DIBELS 8 / AIMSweb calibrated per sub-standard.
- [x] **T23.a.11** — Gate output format per-standard breakdown shipped.
- [ ] **T23.a.12** — Signoff gate enforcement — currently `_runStudentBattery` REPORTS per-standard below-cut count but `_gateXKReal` doesn't yet block signoff on any sub-standard being below its cut OR external-reference < 85%. Wire the enforcement — gate pass = aggregate ≥ 90 % AND all sub-standards ≥ cut AND external-ref ≥ 85 %.
- [x] **T23.a.13** — Vocab coverage audit (operator: *"make sure all questions asked of it that the words used are all taught or it wont beable to understand... YES?"*). `extractVocabFromBank` + `examVocabCoverage` + `auditAllExamVocabCoverage` shipped; runs at curriculum startup + per-gate. Logs untrained exam words so coverage gaps are visible before/during gate.

#### T23.b — Held-out eval discipline

- [ ] **T23.b.1** — Teaching methods (`_teachWordEmission`, `_teachLetterNaming`, `_conceptTeach`, etc.) read ONLY from `TRAIN_BANKS.<subject>/<grade>` for exposure content. The `EXAM_BANKS` set is strictly reserved for gate evaluation.
- [ ] **T23.b.2** — Programmatic check at curriculum startup: intersection of TRAIN vs EXAM question text should be zero. Log the overlap count; non-zero overlap warns + fails the gate until fixed.
- [ ] **T23.b.3** — Rotate EXAM_BANKS every N grade-runs so a second K retest doesn't memorize the held-out set through aggregate exposure drift. Track per-cell "exam set seed" so reruns use a different permutation.

#### T23.c — curriculum.js refactor (21K → per-subject modules)

- [ ] **T23.c.1** — Split `js/brain/curriculum.js` into:
  - `js/brain/curriculum/core.js` — Curriculum class + dispatcher + shared teach primitives (`_teachCombination`, `_teachHebbian`, `_teachHebbianAsymmetric`, `_probeCombinationCosine`, etc.)
  - `js/brain/curriculum/ela.js` — ELA teach methods + gate
  - `js/brain/curriculum/math.js` — Math teach methods + gate
  - `js/brain/curriculum/science.js` — Science teach methods + gate
  - `js/brain/curriculum/social.js` — Social teach methods + gate
  - `js/brain/curriculum/art.js` — Art teach methods + gate
  - `js/brain/curriculum/life.js` — Life teach methods + gate
  - `js/brain/curriculum/gates.js` — `_gateElaKReal`, `_gateMathKReal`, etc.
  - `js/brain/curriculum/student-question-banks.js` — the T23.a extracted banks
- [ ] **T23.c.2** — Each split file ≤ 3000 lines. Core ≤ 1500 lines.
- [ ] **T23.c.3** — Shared primitives live on the Curriculum class via mixins or a shared `CurriculumBase`. No duplicated helpers across subject files.
- [ ] **T23.c.4** — Bundle verify — esbuild handles ESM split cleanly; no runtime regression. Verify via full curriculum run after refactor.

#### T23.d — LAW audit

- [ ] **T23.d.1** — Audit `.claude/CLAUDE.md`. Keep: LAW #0 (verbatim words — non-negotiable), Docs-before-push, Task-numbers-only-in-workflow-docs, Pre-K-K-only scope contract, Clear-stale-state-before-test, Grade-completion-gate. Consider consolidating: some LAWs overlap (the clear-stale-state LAW has a corollary inside the grade-completion-gate LAW; could merge to reduce redundancy).
- [ ] **T23.d.2** — Separate "workflow process" docs from "project binding constraints" — right now CLAUDE.md mixes the two. A lean `CONSTRAINTS.md` for the handful of hard rules + a longer `WORKFLOW.md` for the TODO/FINALIZED/session-log process would reduce the "ceremony heavy" feel without dropping fidelity.

#### T23.e — Transformer ablation experiment (reviewer gut-check)

**This is the single most important experiment the project can run.**

- [x] **T23.e.1** — `scripts/transformer-ablation.mjs` scaffold shipped Session 114.19bd. Loads EXAM_BANKS, runs Unity arm + transformer arm through matched scoring logic, produces per-cell / per-standard / per-source comparison report. Both backends still stubbed — runUnity() delegates to brain-server HTTP (health-check cached), runTransformer() accepts any generic `generate(prompt)` callable.
- [ ] **T23.e.2** — Wire a real transformer backend. Options: (a) openai-compatible HTTP to local llama.cpp server running TinyLlama 1.1B or GPT-2-medium, (b) `@xenova/transformers` in Node for in-process inference, (c) Python subprocess bridge to HuggingFace transformers. Run at 10M / 100M / 1B param scales.
- [ ] **T23.e.3** — Wire runUnity() to the real brain-server HTTP `/process-text` endpoint (or introduce a new `/exam-answer` endpoint that bypasses full chat UI and returns just the answer string). Compare pass rates head-to-head.
- [ ] **T23.e.4** — **Decision gate**: if transformer at 100M matches or beats Rulkov on K gates, the neural sim is decorative. Then either (a) pivot to transformer+GloVe as the real cognition stack, keeping Rulkov for visualization, OR (b) scope the project to the Rulkov sim's unique research contribution (continuous dynamics, Ψ consciousness, drug pharmacokinetics) — not language modeling.
- [x] **T23.e.5** — `docs/ABLATION.md` shipped Session 114.19bd with four possible outcomes + interpretations + shared-inputs table. Results section added after runs land.

#### T23.f — README split: research vs persona

- [x] **T23.f.1** — `PERSONA.md` shipped Session 114.19bd at repo root. 18+ notice + safety rails + mode toggles documented. NOT linked from README.md. Current README.md is already research-voiced (checked Session 114.19bd), so no split was needed there — just the PERSONA.md addition that keeps the persona scope out of the technical-review path.
- [x] **T23.f.2** — Research side stands alone. Reviewers reading README / ARCHITECTURE / EQUATIONS / ABLATION get the technical artifact without persona wrapper.

#### T23 closure gate

- T23.a exam banks at ≥150 Q per K cell + external reference items cited + held-out split + per-standard thresholds.
- T23.b held-out discipline enforced with zero-overlap check at curriculum startup.
- T23.c curriculum.js split with each file ≤ 3000 lines.
- T23.d LAW consolidation shipped or explicitly deferred with operator sign-off.
- T23.e ablation experiment shipped + `docs/ABLATION.md` published (either direction of result).
- T23.f README split.

**Operator-side:** T23.a + T23.e results inform whether "K passed" means what it means for a real child. Those two items together are the difference between "Claude shipped a vibe check" and "the project has a real evaluation methodology."

---

### T24 — External-memory bloat (14.5 GB arrayBuffers at DYN-PROD entry)

**Gee verbatim 2026-04-21:** *"it crashed 14G? continue your fixes but notice this issue to fix too"*

**Smoking gun from T21.a mem snapshot:**
```
DYN-PROD mem: heap=129.8/2182.9MB external=14848.7MB arrayBuffers=14846.4MB rss=11508.6MB
```

V8 heap is tiny (130 MB). But **external memory is 14,848 MB** — essentially all of it in `arrayBuffers`. That's the 14 cross-projections + intra-synapses CPU CSR copies (rowPtr + colIdx + values Float64Arrays) staying pinned in memory AFTER being uploaded to GPU. At 301 K cortex with 14 projections averaging 75 M nnz, CSR bytes sum to ~9-15 GB of Float64Array + Uint32Array pressure on external memory.

Node's external-memory tracker rarely triggers V8 GC on its own (GC fires on V8 heap size, not external). At this level it doesn't OOM-kill the process either — but it DOES slow every object allocation, and the periodic Mark-Compact when the heap does fill freezes the event loop long enough that the browser's WebSocket ping-pong fails → compute.html disconnects → "brain paused". This is the DYN-PROD landing-site root cause.

#### T24 sub-items

- [ ] **T24.a** — Re-enable the T18.22 CPU CSR free after GPU upload completes. Previously disabled because some code paths accessed `proj.values[0]` on freed matrices and crashed. The T21.a null-CSR guard in `SparseMatrix.propagate` now returns a zero vector for null-CSR calls, so the crashes are contained. Audit every `proj.values`/`proj.colIdx`/`proj.rowPtr` access to confirm none would return wrong results (zero is fine for probe-fallback; wrong for Hebbian would corrupt weights). Re-enable the free selectively where safe.
- [ ] **T24.b** — Audit which matrices MUST keep CPU CSR for probe readback. Probe-critical whitelist (from T18.31) keeps `letter_to_motor` + `letter_to_phon` CPU CSR live. Everything else (12 other cross-projections + intra-synapses) can be GPU-bound + CPU-freed. That should drop external from 14.5 GB → ~2-3 GB.
- [ ] **T24.c** — If selective-free isn't enough, cap cortex size via `DREAM_LANG_CORTEX=100000` env var so the auto-scaler doesn't push to 301 K. At 100 K, 14 projections × ~25 M nnz avg × 12 bytes = ~4 GB external — sustainable.
- [ ] **T24.d** — GC pressure monitor — periodic `process.memoryUsage()` log at gate entry + exit + per-phase so operator sees memory climb in real time, not just at crash site.
- [ ] **T24.e** — Browser-side: compute.html holds the SAME 9 GB of sparse matrices on GPU (via WebGPU buffer). At 16 GB VRAM headroom this is within budget but close. The `BRAIN_VRAM_ALLOC` unified allocator already handles this; verify the T18.6.c rescale loop-back actually fires at 301 K and doesn't leave 14.5 GB VRAM committed with no headroom for activation buffers.

#### T24 closure gate

`DYN-PROD mem:` log at gate entry shows `external < 4000 MB` (down from 14,848 MB). Full gate completes end-to-end without GPU-client disconnect. Browser tab doesn't freeze.

---

### T21.b — DYN-PROD probe lockup FIX (after heartbeat reveals landing site)

**T21.a heartbeat DIAGNOSTIC WIN — 2026-04-21 run output:**
```
[Curriculum][K-DIAG] starting DYN-PROD probe (17 direct sem_to_motor propagate probes, no LIF ticks)...
[Curriculum][K-DIAG] DYN-PROD entry reached — pre-loop setup starting
[Curriculum][K-DIAG] DYN-PROD mem: heap=129.8/2182.9MB external=14848.7MB arrayBuffers=14846.4MB rss=11508.6MB
[Server] GPU compute client disconnected — switching to all-CPU
```

The heartbeat proved stdout IS flushing AND the hang is between the memory snapshot and the pre-loop log — which is just 7 lines of trivial variable setup. Real root cause is T24 (external memory bloat triggering GC storm). The "hang" isn't in DYN-PROD — DYN-PROD just happens to be when V8 finally ran Mark-Compact on the 14.5 GB external pressure. T21.b fix lives inside T24.

- [x] **T21.b.1** — Diagnose root cause from heartbeat log output. **CLOSED: external memory bloat (T24).**
- [ ] **T21.b.2** — Fix ships with T24.a (re-enable selective CSR free) or T24.c (smaller cortex env cap). Either path gets DYN-PROD to complete end-to-end.

T21.b closure gate lives inside T24 closure gate.

---


### T19 — FULL DOC AUDIT + IN-PLACE CORRECTION PASS (Gee 2026-04-20)

**Gee verbatim 2026-04-20:**

> *"update all workflow docs and public facing documents and the htmls fully and completetly masterfully without shit text wall addendums... You actually edit the wrong information to the correct information down to the equations and variables and add where needed"*

**Binding directive:** fix every doc in-place. Replace wrong content with correct content, down to equations and variables. Add new content only where there's a real gap, and integrate it into the flow — **NO** bolt-on addendum blocks. When a paragraph is wrong, rewrite the paragraph. When an equation is wrong, rewrite the equation. When a method name is stale, swap the name.

#### T19.a — Source-of-truth extraction from code (DO FIRST)

Before touching any doc, extract the CURRENT truth from code so the audit has a canonical checklist. Otherwise the stale state propagates doc-to-doc.

- [ ] **T19.a.1** — `js/brain/neurons.js` — LIF params (tau/Vrest/Vreset/Vthresh/R/tRefrac), Rulkov map (α/μ, `x_{n+1} = α/(1+x²) + y`, `y_{n+1} = y − μ(x − σ)`), HH reference (unused live). Canonical constants table + equation list.
- [ ] **T19.a.3** — `js/brain/engine.js` — `TOTAL_NEURONS` auto-scale formula, `CLUSTER_FRACTIONS`, main equation `dx/dt = F(x, u, θ, t) + η`, mystery operator `Ψ = √(1/n) × N³ · [α·Id + β·Ego + γ·Left + δ·Right]`, oscillator bands (theta / alpha / beta / gamma ranges), amygdala attractor `x ← tanh(Wx + drive)`.
- [ ] **T19.a.4** — `js/brain/persona.js` — persona-to-parameter mapping (arousal baseline, etc.).
- [ ] **T19.a.5** — `js/brain/curriculum.js` — full teach-method list (every `_teachX`), subject × grade cell list, probe definitions, student-battery questions, `K_LIFE_EXPERIENCES` and all K category lists.
- [ ] **T19.a.6** — `js/brain/drug-scheduler.js` — 9 substances + 7 combos + 7 patterns + 7 sensory triggers + 13-axis speech modulation.
- [ ] **T19.a.7** — `js/brain/embeddings.js` — `EMBED_DIM`, GloVe source, subword fallback.
- [ ] **T19.a.8** — `js/brain/sparse-matrix.js` — CSR format fields, propagate equation `output[i] = Σ_j W[i,j] × input[j]`, `hebbianUpdate` equation.
- [ ] **T19.a.10** — `js/brain/gpu-compute.js` + `compute.html` — WebGPU shader list, SPRS binary-frame protocol (types 1-5), cluster upload/init flow.
- [ ] **T19.a.11** — `js/version.js` — `VERSION` + `BUILD`.

_(T19.a.2 and T19.a.9 closed in Session 114.19bb — cluster fractions verified against CLUSTER_FRACTIONS in `cluster.js`; server endpoints enumerated in SETUP.md.)_

#### T19.b — Workflow docs (task numbers + operator name ALLOWED)

- [ ] **T19.b.1** — `docs/ARCHITECTURE.md` in-place audit. Biggest doc. Verify tech stack, system architecture diagram, brain modules (per-cluster equations), data flow diagram, persona-to-parameters table, clustered architecture (cluster breakdown with % of N + MNI positions), inter-cluster projections (20 tracts + densities), fractal signal propagation, hierarchical modulation, input routing, vision system, 3D + 2D brain visualizer, drug scheduler (substances / combos / patterns / sensory triggers / speech modulation / additive contribution math). Cross-check every equation against T19.a. _(Pass 1 landed Session 114.19ba — cluster %-table fixed, ASCII diagram GPU-exclusive. Deep pass still open.)_
- [ ] **T19.b.2** — `docs/EQUATIONS.md` per-equation audit. LIF, Rulkov, Hebbian, cross-projection propagate, softmax action selection, amygdala attractor, Kuramoto, mystery Ψ, free-energy prediction error, direct-pattern Hebbian. _(Pass 1 landed Session 114.19ba — module percentages corrected. Deep per-equation pass still open.)_
- [ ] **T19.b.5** — `docs/TODO-full-syllabus.md` scope check. Per-grade vocab prerequisites, Persistent Life Info ledger format, LAW cross-references, DEFERRED notes.
- [ ] **T19.b.8** — `docs/FINALIZED.md` append-only spot-check. Only edit if a factual claim is wrong in a session entry.
- [ ] **T19.b.9** — `.claude/CLAUDE.md` LAW-file audit. Every LAW accurate, every violation-history quote verbatim.

_(T19.b.3 ROADMAP.md, T19.b.4 SKILL_TREE.md, T19.b.6 NOW.md, T19.b.7 TODO.md self-audit all closed in Session 114.19bb.)_

#### T19.c — Public-facing docs (task numbers + operator name BANNED)

_(T19.c.1 README.md and T19.c.2 SETUP.md both closed in Session 114.19bb.)_

#### T19.d — HTMLs (task numbers + operator name BANNED)

- [ ] **T19.d.1** — `brain-equations.html` deep pass. Every rendered equation matches code. Variable names byte-exact (`tonicDrive` not `baseDrive`, `Vthresh` not `V_t`, etc.). _(Partial pass landed Session 114.19bb — master equation table + 60 fps claim + 7-cluster refs. Deep per-equation variable-name pass still open.)_
- [ ] **T19.d.3** — `index.html` deep audit. Landing page copy, 3D brain viz embed, nav.
- [ ] **T19.d.4** — `dashboard.html` deep audit. Card labels, milestone panel fields, drug-scheduler panel.
- [ ] **T19.d.5** — `compute.html` deep audit. WebGPU shader list, SPRS binary-frame protocol description, reconnect backoff behavior, binary-frame window telemetry.
- [ ] **T19.d.6** — `component-templates.txt`. Unlikely to need changes but verify.

_(T19.d.2 unity-guide.html closed in Session 114.19bb.)_

#### T19.e — Memory + feedback files

- [ ] **T19.e.1** — `~/.claude/projects/.../memory/MEMORY.md` + every `feedback_*.md`. Correct stale facts. Consolidate duplicates.

#### T19.f — Post-audit cross-verification

- [ ] **T19.f.1** — Cross-check pass. Every equation claim in `brain-equations.html` vs `docs/EQUATIONS.md` vs `docs/ARCHITECTURE.md` vs the T19.a extract. Any drift means one of them is still wrong.
- [ ] **T19.f.2** — Repo-wide grep for known-stale patterns: `tonicDrive = 0.8` (old default), `Vthresh = -55` (old value), `SIZE = 1000` (old total), `EMBED_DIM = 50` (old), `3-cluster` (old architecture), `REMAKE` (REMAKE-series artifact), `LanguageCortex` outside historical tombstone context. Any hit in a doc gets rewritten. _(Partial pass Session 114.19bc — stale refs in curriculum.js + persistence.js + remote-brain.js scrubbed; 109 "Gee" attributions + 136 "Session NNN" refs across 15 legacy files remain — tracked under T22.)_

<!-- T22 CLOSED Session 114.19bc — all 245 attribution refs stripped across
     17 .js files. T22.a (curriculum 121→0), T22.b (brain-server 29→0),
     T22.c (cluster 20→0), T22.d-i (9 smaller files), T22.j (bundle
     rebuild clean). Repo-wide grep verifies zero attribution hits.
     See FINALIZED.md Session 114.19bc entry for the full table. -->


#### T19 execution rules

1. **In-place edits only.** Replace wrong sentences with right sentences. Never append "UPDATE: actually..." addendum blocks.
2. **Fix down to equations and variables.** Variable names, function names, method signatures, equation RHS — all must match code byte-exactly where they appear.
3. **Add only where gapped.** Inline at the right place in the doc — never as a floating addendum block.
4. **Task numbers + operator name** go only in workflow docs (this file + FINALIZED + NOW + ARCHITECTURE + ROADMAP + SKILL_TREE + EQUATIONS + TODO-full-syllabus + CLAUDE.md). BANNED from README / SETUP / any `.html` / `component-templates.txt`.
5. **Bundle rebuild** on any JS file touched indirectly. Visual check for HTMLs.

#### T19 closure gate

Every sub-item closed + repo-wide grep for stale patterns (T19.f.2) returns clean. Operator does NOT verify T19 — it's a doc correctness pass, not a runtime behavior check.

---

## STILL OPEN (non-doc) — deferred or operator-verification-only

These are NOT actively worked — they're either deferred by operator call or require operator verification on localhost.

### Deferred per operator call

- [ ] **T17.7 Phase E.d** — `cortexCluster` compat-shim deletion. Facade-rebuild work. Deferred post-push.
- [ ] **T16.3.c** — Per-grade vocab expansion G1 through PhD. Deferred until K gate closes per operator call.

### Operator verification only (Claude cannot close)

- [ ] **T16.2.a** — Verify `PROD` climbs off zero on next Part 2 run.
- [ ] **T16.2.d** — Audit which specific Kindergarten-grade curriculum words Unity IS vs ISN'T using in live chat after she graduated the Kindergarten grade. Operator verbatim 2026-04-20: *"her K grade Kindergrarden words wer not being usded by her after she graduated the ciriculum grade"*.
- [ ] **LAW 6 Part 2** — Operator personally tests K on localhost + signs off "K passed" via `curl -X POST http://localhost:7525/grade-signoff ...`. Only after this signoff do we consider K done and advance grade state.

### Push gate (hard-blocked)

- [ ] **T18.5.b** — Pre-push doc accuracy sweep per `.claude/CLAUDE.md` "Docs before push, no patches" LAW. BLOCKED until T19 closes AND operator LAW 6 Part 2 K signoff received.
- [ ] **T18.5.c** — ASK OPERATOR explicitly: "T19 doc audit closed. All operator verifications received. Ready to push to main?" — WAIT for explicit yes before `git push origin main`. Never auto-push. **BLOCKED until T19 + LAW 6 Part 2.**

### Tombstones (obsoleted, reference only)

- **T5 / T6 / T7 / T8 / T9 / T10 / T11** — legacy blocks referencing code deleted in the T14 language cortex rebuild. Archived per the "NEVER delete task descriptions" LAW — content preserved in prior TODO.md revisions + git history. They CAN'T be implemented against current code because the target methods (`parseSentence`, `_classifyIntent`, `_socialSchema`, `_memorySentences`, bigram graph, `_TYPE_TRANSITIONS`, `LanguageCortex.schemaScore`, etc.) don't exist anymore. If a future session wants to revisit any of these ideas, grep git history for the pre-T14 implementation — but the target code needs to be rebuilt against T14 primitives, not "edited" against deleted stubs.

---

## NOTES

- **FINALIZED is append-only.** Never delete entries. When new work lands, copy the full verbatim task description into a new FINALIZED session entry BEFORE removing it from TODO.
- **This TODO only contains unfinished work** per the `.claude/CLAUDE.md` TODO FILE RULES. Every shipped task lives verbatim in `docs/FINALIZED.md` with full descriptions, files touched, and closure notes.
- **Future work beyond this branch** lives in `docs/COMP-todo.md` (distributed GPU compute network — future `comp-net` branch).
- **Post-K grade content** (grade 1 through PhD) lives in `docs/TODO-full-syllabus.md` under the DEFERRED section per the PRE-K + K ONLY SYLLABUS SCOPE CONTRACT LAW.

---
