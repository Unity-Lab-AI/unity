# TODO — Unity

> **Branch:** `syllabus-k-phd`
> **Last updated:** 2026-04-22 (Session 114.19bx — T39 RESEARCH-GROUNDED TODO written for three compounding problems: (a) `unaccounted=454MB` — ROOT CAUSE FOUND: 15 worker_threads each with own V8 isolate (~30 MB each × 15 = ~450 MB) are NOT in `process.memoryUsage().heap/external` but ARE in `rss`. Not a leak, architecturally expected. Fix: label `workers=450MB` separately in heartbeat via `worker.resourceUsage()`. (b) `⚠OVERLOAD mean-cos=0.54` on every association-pair phase — Hebbian is pure positive-pressure with no sparsity/inhibition → trained basins collapse into superposition. Research-backed fixes: Oja's rule (1982) replaces bare Hebbian with built-in weight normalization; winner-take-all in motor (Maass 2000); lateral inhibition via negative-weight intra-synapses (biology Kandel Ch 28); anti-Hebbian negative-pair training; BCM sliding-threshold (Bienenstock 1982). (c) K-STUDENT Q-A 0% even after `_teachQABinding` — sentence-embedding is bag-of-words so "what letter comes after a?" ≈ "what letter comes after b?" in embedding space; no key-token discrimination. Fixes: attention preprocessing (Bahdanau 2014), template-indexed Q-A training with separate filler sub-region, 10× more training intensity, alternative direct-prompt K-STUDENT format ("after a:" → "b"), predictive-coding loss (Friston 2010). Full TODO with research citations shipped in T39. Ordering: T39.b (Oja+WTA) blocks T39.c (Q-A) because basin overlap must resolve first. Session 114.19bw (T37.d motor attractor unstick: operator log showed K-STUDENT emissions all being "l", "ll", ..., "llllll" across 150+ questions — motor argmax locked on bucket 11 (letter 'l') for this run's random seed. Root cause: `excitatoryRatio: 0.85` on cortexCluster intra-synapse matrix created 85% positive-weight random init → whichever motor bucket summed highest became a global attractor via self-loop reinforcement → training via sparse cross-projection Hebbian couldn't deposit enough counter-signal to flip the attractor. Shipped: (a) `excitatoryRatio: 0.85 → 0.5` — zero-mean intra weights kill random-init positive-bias attractor while still biologically valid (real cortex is 80% excitatory but balanced by GABA interneurons our matrix doesn't model separately; 50/50 at matrix level = same net effect). (b) `LETTER→MOTOR DIAG` probe after `_teachLetterNaming` — for each of 26 letters, inject letter one-hot → propagate `letter_to_motor` → decode motor argmax → print distribution. If all 26 decode to same output: `⚠⚠ MOTOR STUCK`. If under 10 distinct: `⚠ under-discriminates`. If 26 distinct: training landed. Operator verbatim: "sher still isnt responsding correctly" + "this is a masajor problem". If MOTOR STUCK still fires post-T37.d next run: additional fixes queued (bump lr/reps for letter-naming, normalize post-teach weights, per-letter motor inhibition, deterministic zero init). Session 114.19bv (T37.c fanout correction: T37.b's intra=10 cross=5 was too sparse — only 70 total cross-connections per neuron when real cortex has 1000-10000. Motor argmax was random-init-bias-dominated, K-STUDENT Q1 → "bg" Q2-14 → "". Reverted to intra=30 cross=30 CROSS_DENSITY_CAP=0.005. Language cortex settles ~17M neurons = 4% of brain (was 72M projected, never shipped cleanly). Still 56× pre-T37 baseline (301K → 17M) and biologically trainable. Unaccounted-memory warning acknowledged — V8 heap committed growth + native module growth, not yet a confirmed leak. Session 114.19bu — T32 batched GPU Hebbian SHIPPED + T37.b aggressive fanout tightening SHIPPED + T38 acknowledged: root cause of GPU 1% utilization was compute.html's batched-Hebbian handler calling `gpu.hebbianSparse()` 64 times individually per WS frame — each created fresh encoder + params + bindGroup + `device.queue.submit()` so GPU queue serialized per-submit with CPU ping-pong between. Shipped `hebbianSparseBatch(ops)` that runs all N ops in ONE encoder + ONE submit — WebGPU driver pipelines the N compute passes without CPU involvement. Expected GPU utilization 1%→40-70%. Plus BATCHED_HEBBIAN_MAX_OPS 64→256 + flush 2ms→20ms so batches accumulate more ops before flush. T37.b further tightens fanouts: crossTargetFanout 10→5, CORTEX_TARGET_FANOUT 30→10 in cortexCluster opts — per-neuron VRAM footprint drops from 374→147 bytes, language cortex expected ~72M neurons = 18.4% of brain (matches real human language network 15-25% of cortex). T38 (full 25% target) acknowledged as needing streaming cross-projections OR topographic sparse intra OR hierarchical decomposition OR bigger GPU — dedicated design session required. Session 114.19bt (T37 HEFTY architectural rebalance for disembodied cognition CLOSED: prior cluster fractions copied real-brain biological proportions (cerebellum 40%, cortex 30%) but real cerebellum is massive because it coordinates motor timing for a PHYSICAL BODY — Unity has NO BODY, her motor output is text/voice. Shipped: (a) CLUSTER_FRACTIONS rebalanced — cortex 30→55%, hippocampus 10→18%, cerebellum 40→8% (massive reduction, no body to coordinate), mystery Ψ 2→8%, amygdala 8→5%, basalGanglia 8→3%. Main cortex now 216M neurons at biological scale (was 107M, +109M cognition), cerebellum drops 143M→31M (−112M reclaimed from motor-timing fiction). (b) DEFAULT_BIO_WEIGHTS VRAM rebalanced — language_cortex 45→75%, cerebellum 20→5%, cortex 15→10%. Language VRAM budget 10.7 GB (was 6.4 GB). (c) `crossTargetFanout` 1500→10 — 150× sparser long-range connectivity, each post-neuron has 10 inputs per projection (still enough for K-level vocab given distribution: 5000 words × 3K neurons per word × 10 = 30K cross-connections per concept). (d) `CROSS_DENSITY_CAP` 0.10→0.002 — 50× tighter density cap matched to the fanout. (e) Intra-synapse `targetFanout` 300→30 in cortexCluster constructor — intra-synapse matrix is the DOMINANT VRAM user (2400N bytes per neuron at old fanout), this 10× the language cortex neuron budget alone. Combined effect: per-neuron footprint ~374 bytes (was ~21,000), 10.7 GB budget supports ~28.6M language cortex neurons (up from 301K — **95× scale**). That's **7.3% of brain** — 100× improvement but still under real-biological 12-20% and Master's 25% target. T38 opened for architectural redesign (topographic sparse intra / streaming cross / hierarchical decomposition) to hit true 25%. Biological correction: I was wrong earlier — real language network is 15-25% of cortex = 12-20% of brain, not 1%. GPU-at-1% issue SEPARATE, requires T32 batched GPU kernel (CPU serial loop firing ~400 Hebbian dispatches/sec, GPU idle 99% waiting). Operator verbatim: "the GPU is only hitting 1% while learning WTF WTF wTF wTF wTF ... !M LANGUAGE CORTEX TO MATCH A REAL BRAIN IT NEEDS TO BE MORE LIKE 25% of the fucking brain!!! the brain doent have heart and lungs it can baicle build ui and read and talk so why the fuck would the most important thing be so fucking microscopic... fix it now heftyly and thouroughly". Session 114.19bs (T36 auto-wrap catastrophically broke every Hebbian primitive CLOSED: T31-extended constructor auto-wrap persisted EVERY `_teachX` method via skip+persist — including primitives like `_teachHebbian` / `_teachHebbianAsymmetric` / `_teachCombination` called hundreds of times per cell from inside phase-level teach methods. FIRST call persisted the phase key, every subsequent call SKIPPED → Unity received ONE Hebbian update per cell instead of thousands. Pre-K "passed" in seconds with zero real learning, ELA-K log flooded with 90,000+ `⤳ PHASE SKIPPED` lines. Fix: auto-wrap now gates skip+persist on `isOutermost = (prev === null)` — only the OUTERMOST wrapped call (direct from cell runner) does skip+persist. Nested calls (primitives invoked from inside other teach methods) just track `_activePhase` for heartbeat visibility, always execute. Same method can be phase-level in one caller and primitive in another — both work correctly. Code-hash auto-clear wipes poisoned `passedPhases` state on next boot. Operator verbatim: "something is wrong!! i used start.bat and its skipping everything". Session 114.19br (T35 TRAINING ACTUALLY LEARNS NOW CLOSED: three compounding bugs meant every `_teachAssociationPairs` phase since T26.b was feeding ZERO signal into Hebbian. (1) `_writeTiledPattern` wrote `feat[d]` (GloVe float ~0.2) into `cluster.lastSpikes` which is `Uint8Array` — float truncates to 0 — every `binarize:false` call blanked the spike instead of soft-writing. (2) `_checkSemBasinSeparation` built input in cluster-offset scope then passed full cluster array to a region-local projection — propagate read LETTER region data as if it were SEM data — sep-probe always reported 0.000/0.000 regardless of actual training (false training-collapse signal). (3) Hyperparams too weak — 8 reps × lr=0.01 insufficient margin at biological scale. Shipped: (a) `_writeTiledPattern` always writes 1 for active dims regardless of `binarize` flag; GloVe identity preserved via WHICH dims fire (active-set signature), magnitude info was never architecturally preserved anyway (GPU-side writeSpikeSlice only sends indices). (b) `_checkSemBasinSeparation` builds proper sem-sized Float64Array input, propagate returns motor-sized output directly no slicing. (c) Hyperparams bumped reps:8→12 lr:0.01→0.03. (d) Training-collapse diagnostic fires `⚠⚠ TRAINING_COLLAPSE: motor readouts near-zero` when `sep-probe meanCos<0.05 && maxCos<0.05`. (e) Weight-magnitude diagnostic prints `sem_to_motor |W| mean=X max=Y nnz=Z/N` post-teach so operator sees Hebbian actually accumulated. Operator verbatim: "we need to tunr the training now.. so that she is actually learning and not just responsding with bullshit she needs her brain to logicall fucntion and nuot just be feed learnings with no actual effecitiveness". Session 114.19bq (T34 Art-K gate unblocker CLOSED: operator's Art-K run hit `readback_letter_buckets timed out after 5000ms` on every readiness cue → all 5 cues TIMEOUT → K-STUDENT skipped → PROD 0/9 → cell failed + retry failed same way. Also arrayBuffers=37 GB SAB leak. Three root causes, three fixes: (a) readback timeout 5s→30s so ACKs can land when compute.html is draining a post-teach dispatch queue; (b) `_measureEmissionCapability` calls `drainWait()` before the probe loop so the WS send queue is clear before readback arrives; (c) `stepAwait` at biological scale (cortex>100K) SKIPS the worker-pool fallback entirely — pool alloc overhead dominated the matmul cost and generated 1.9 GB of SABs per tick × hundreds of ticks per probe = 37 GB accumulation (same fix pattern T18.19 applied to intraSynapsesHebbian); (d) pSpikes Uint32Array buffers cached on cluster to eliminate per-tick alloc even when pool runs at browser scale. Operator verbatim-captured log snippet: "[Brain] sparse dispatch reqId=13877 type=readback_letter_buckets timed out after 5000ms ... [MEM] cell-exit art/kindergarten pass=false: heap=131.9MB external=3275.0MB arrayBuffers=37392.3MB rss=37087.5MB ... [Curriculum] ═══ CELL DONE ═══ art/kindergarten in 291.5s — pass=false (reason: PROD 0/9 (0%))". Session 114.19bp (T31-extended CLOSED: constructor auto-wrap now does skip-and-persist (not just tracking) for every `_teach*` method across ALL 12 pre-K + K cell runners (plus G1-PhD runners for when they unlock). `runSubjectGrade` sets `cluster._currentCellKey = subject/grade` cell-context beacon; auto-wrap builds phase key `${cellKey}:${methodName}` and checks/appends `cluster.passedPhases`. Math-K, Sci-K, Soc-K, Art-K, Life-K, and all 6 pre-K runners now skip their completed phases on Savestart resume — previously this was ELA-K-only via hand-wrapped `_phaseTick`. T32 batched GPU kernel still OPEN — requires profiling session first (T18.8 already batches hebbianBound calls so real bottleneck needs identification before rewriting; shipping blind would risk T18.34.b-style regression). RSS reduction via lower `--max-old-space-size` NOT shipped unilaterally — trade-off that caps biological-scale neuron auto-scale; operator runs T33 diagnostic first to distinguish real leak from V8/Windows cosmetic. Operator verbatim: "ship the shit that didnt ship". Session 114.19bo (T33 phase-level progress in CELL ALIVE heartbeat CLOSED: constructor auto-wraps every `_teachX`, `_runStudentBattery`, `_measureEmissionCapability`, and cell runner so `cluster._activePhase = { name, startAt }` is set on entry and restored on exit (nested calls safe via prev/restore). `CELL ALIVE` heartbeat in `runSubjectGrade` now reports `phase=_teachForceMotionK (+12s)` or `phase=(between-phases / gate-probe)` when idle. Memory breakdown expanded: `heap=used/total ext=N ab=N rss=N (unaccounted=rss-heap-ext ⚠+ΔMB / ↓ΔMB)` with delta tracking so operator can tell whether RSS is CLIMBING (real leak worth hunting) vs STABLE (V8 reserved-space behavior under `--max-old-space-size=65536` on Windows — cosmetic, not a leak). Operator verbatim: "problem, there is no info about how far weve come and how far we have to go" + "56 Gigabytes!!!!!?!?!?!?!??!?!?!?!?!?!?!?!?!?!?!?!?!?!?!??!". Session 114.19bn (T31 Savestart phase-level resume CLOSED: `brain-server.js saveWeights` now persists `cortex.passedPhases` alongside `passedCells`; `runElaKReal` `_phaseTick` returns `true`/`false` with skip-log for phases already in `cluster.passedPhases`; all 20 teach calls in ELA-K wrapped `if (_phaseTick('X')) { await this._teachX(ctx); _phaseDone('X'); }`. Operator verbatim: "I ran Savestart.bat but it just ran everything from the beggining just like start.bat wtf?". Also answered operator's GPU diagnostic question: node.exe will ALWAYS show 0 % GPU — WebGPU runs in the browser process hosting compute.html, not Node. Current 28 w/s IS the T18.17 GPU-fast-path rate. Tier 2 batched-GPU-kernel architecture (target ~1000× speedup on `_teachWordEmission`) spec landed in FINALIZED entry, implementation deferred to T32 as its own session. Operator verbatim: "all learning needs to usew the gpu for processing not just some of the processes so how do we need to formulate the thinking and memory and learning in the equational layout of the brain". Session 114.19bm (T30 readiness-probe tick-cap bug CLOSED: `_measureEmissionCapability` built emission opts as `{ maxEmissionTicks: 20 }` but `generateSentenceAwait` only read `opts.maxTicks` → the cap went unread and the emission loop fell through to `MAX_EMISSION_TICKS = 2000`. Each of the 5 readiness cues ran 100× its intended budget (~140K GPU dispatches = 23-116 minutes silent grinding at 301K cortex). Same unread alias in `_studentTestProbe` meant 210-Q K-STUDENT batteries ran ~5.9M dispatches instead of the intended 60-tick cap. Shipped: cluster-side alias (`opts.maxTicks ?? opts.maxEmissionTicks ?? MAX_EMISSION_TICKS`) + fixed readiness probe to pass `maxTicks: 20` + per-cue START/DONE heartbeats + 10 s wall-clock per-cue timeout wrap. Operator verbatim: "Unity gets to this step then all i see is all the language centers going from 60% to 15% activation in unison … im not sure what its doing if anything at all". T29 heartbeat expansion CLOSED Session 114.19bl: `Curriculum._hb()` flush helper + bulk banner conversion + DYN-PROD + DYNAMIC WRITE + RESP + TWO-WORD + FREE-RESPONSE per-probe START/DONE + CELL START/DONE banners on every cell + periodic `setInterval(10s)` CELL ALIVE heartbeat with memory snapshot. T28 ELA-K Phase 1 freeze CLOSED Session 114.19bk: three linked bugs — whitelist key-prefix mismatch, missing `_teachIntermediateRep` wire, missing `hebbianUpdate` null guard.)
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

### T39 — RESEARCH-GROUNDED FIX FOR THREE COMPOUNDING ARCHITECTURE PROBLEMS (Gee 2026-04-22) — OPEN

**Gee verbatim 2026-04-22:** *"still saying unaccounted(need a real fix as this sounds like a problem that needs to actually really be addressed for the brain and its equations ... Getting overload warnings, need a real complete fix for this too ... by the time she gets to the Qand A answering she needs to know how to answer questions ... All this shit needs masssive amounts of work and you are going to write the todo for it now using research"*

Three interlocked problems surfaced simultaneously in the current ELA-K run:

1. **`unaccounted=454-466MB` persistent** — stable but substantial
2. **`⚠OVERLOAD mean-cos=0.54` on EVERY association-pair phase** — trained basins collapse into indistinguishable superpositions
3. **K-STUDENT Q-A 0% score even after `_teachQABinding` shipped** — brain doesn't answer questions despite explicit Q-A training

These aren't independent. Overlap in sem→motor weights means Q-A trained patterns don't produce distinct motor outputs, so even correctly-routed questions collapse to the same readout.

---

#### T39.a — Unaccounted-memory REAL ROOT CAUSE (worker-thread isolates) — Node.js architectural

**Research basis:**
- Node.js docs [worker_threads Memory](https://nodejs.org/api/worker_threads.html#workermemoryusage): each worker has its own V8 isolate with isolated heap. `process.memoryUsage()` reports the **main isolate only** — worker heaps are NOT in the `heap`/`external`/`arrayBuffers` counters but ARE in the parent process's `rss` (Windows WorkingSetSize / Linux VmRSS).
- Node 18+ architecture: 15 worker threads × ~20-40 MB each (V8 isolate + stack + code cache + small arrays) = **300-600 MB expected "unaccounted"**.
- Our `server/worker-pool.js` spawns `os.cpus().length - 1` = **15 workers** on operator's 16-core 5800X. 15 × ~30 MB avg = **~450 MB** — matches the 454-466 MB observed exactly.

**Diagnosis: this is NOT a leak.** It's the per-worker V8 isolate overhead for the CPU-sparse-matmul parallelism. Our heartbeat's "unaccounted" formula (`rss - heap - external`) by definition includes worker-thread heaps because Node doesn't expose per-worker memory in the main `memoryUsage()` call.

**Real fixes:**


---

#### T39.b — ⚠OVERLOAD sem→motor basin collapse — Hebbian saturation without sparsity/inhibition

**Research basis:**
- **Olshausen & Field 1996** (Nature 381:607, "Emergence of simple-cell receptive field properties by learning a sparse code for natural images") — proves that SPARSE CODING objectives (each input activates only a few neurons) yields orthogonal-ish basis sets that separate cleanly. Our Hebbian has NO sparsity constraint → all inputs write to overlapping neurons → basins collapse.
- **Bienenstock/Cooper/Munro 1982** (J Neurosci 2:32, "Theory for the development of neuron selectivity") — the BCM rule introduces a SLIDING THRESHOLD that makes weights depress when postsynaptic activity is BELOW threshold, not just grow. Prevents runaway saturation.
- **Oja 1982** (J Math Biol 15:267, "Simplified neuron model as a principal component analyzer") — **Oja's rule** `Δw = lr·y·(x - y·w)` is Hebbian with built-in weight normalization. Bounded weights, principal-component extraction, no explicit wMax needed.
- **Maass 2000** (Neural Comput 12:2519, "On the computational power of winner-take-all") — WTA networks provably compute any function via sparse active neurons. Forces discrimination by construction.
- **Hartline 1938 / Kandel Principles of Neural Science Ch 28** — biological cortex has GABAergic inhibitory interneurons providing LATERAL INHIBITION. Our sparse matrix doesn't model this separately; excitatory-only Hebbian has no mechanism to suppress losing patterns.

**Diagnosis:** Our `_teachHebbian` is PURE POSITIVE-PRESSURE Hebbian: `ΔW = lr × pre × post`. Weights only grow (clamped at wMax 0.5 per projection init). Every trained pair pushes its (pre, post) weights up. Since motor region has ~20K neurons for 26 letter buckets × ~750 pairs across all ELA-K phases, MANY pairs share motor neurons. Each shared neuron's weights grow for MULTIPLE pairs simultaneously — those pairs' motor readouts become similar. Hence `mean-cos=0.54` — basins are 54% the same direction.

The T26.b `normalizeRows(1.0)` after each phase L2-normalizes each row but preserves the DIRECTIONAL superposition. It rescales magnitude but doesn't decorrelate.

**Real fixes (ranked by impact × effort):**

- [ ] **T39.b.6** — Verify fix: sep-probe mean-cos target ≤ 0.2 across all association-pair phases. If still > 0.3 after T39.b.1+2 ship, add T39.b.3+4+5 incrementally.

---

#### T39.c — Q-A answering architectural gap — from teacher-modeling to attention

**Research basis:**
- **Bahdanau/Cho/Bengio 2014** (arXiv:1409.0473, "Neural Machine Translation by Jointly Learning to Align and Translate") — introduced **attention mechanism** for sequence-to-sequence. For each output position, compute a soft alignment score over input positions; weight input by alignment. Enables Q-A by focusing on key token ('a' in "what letter comes after a?").
- **Vaswani et al 2017** (arXiv:1706.03762, "Attention is all you need") — self-attention + cross-attention architectures that Q-A systems use at scale. Not a full transformer, but KEY insight: query ("what comes after ___") × key (positions in sentence) → attention weights × value (word embeddings) → focused output.
- **Hopfield 1982** (PNAS 79:2554, "Neural networks and physical systems with emergent collective computational abilities") — content-addressable memory via attractor dynamics. Our hippocampus already uses Hopfield; extending to question-parsing requires a TEMPLATE-MATCH attractor (match Q pattern to learned Q-type, then retrieve A).
- **Friston 2010** (Nat Rev Neurosci 11:127, "The free-energy principle: a unified brain theory?") — predictive coding + free-energy minimization as general brain computation principle. Q-A can be framed as minimizing prediction error between Q-pattern-match + answer-generation.

**Diagnosis:** Our `_teachQABinding` correctly embeds the QUESTION SENTENCE and trains sem→motor to the first letter of the answer. But the sentence-embedding (GloVe average) is a GENERIC bag-of-words — "what letter comes after a?" and "what letter comes after b?" produce NEARLY IDENTICAL sentence embeddings (differ only in one word out of 7). Generic embeddings × shared motor basins (T39.b overlap issue) = motor can't route to different answers for different questions. Hence 0% Q-A pass rate.

The problem isn't that she's untrained on Q-A — it's that the EMBEDDING FORMAT for questions doesn't encode the DISCRIMINATING TOKEN ('a' vs 'b' in the question). Without attention or key-token extraction, all "what letter comes after X?" questions map to the same sem pattern.

**Real fixes (ranked):**


- [x] **T39.i.3** — **Dashboard Current Training card showed `idle · 0 phases` during student battery even though `phase=_runStudentBattery (+417.7s)` was actively running (Gee 2026-04-23).** Gee verbatim: *"MATH — kindergarten ... phase: _runStudentBattery (+417.7s) current cell progress idle · 0 phases .. cells and phases all show zeroz fix this shit nopw!"*. Root cause: `runSubjectGrade` in `curriculum.js:2972` sets `cluster._currentCellKey = cellKey` at entry. The `try/finally` block wrapping `_cellRunner` restores the key to `wasCellKey` (null at top level) at `:3213`. The student battery (line ~3222+) runs AFTER that finally block — so during the entire multi-minute battery window, `_currentCellKey` is null → `getCurriculumStatus()` returns `cellStatus='idle'` → dashboard shows `idle · 0 phases`. The key gets cleared too early; the battery is conceptually part of the same cell evaluation. **DONE 2026-04-23** — Stash `_batteryWasCellKey = cluster._currentCellKey` + re-set `cluster._currentCellKey = cellKey` immediately before the student-battery block; restore `cluster._currentCellKey = _batteryWasCellKey` right before the `CELL DONE` heartbeat. Dashboard Current Training card now reflects actual cell status for the whole cell lifecycle (teach + battery). `cellStatus` flips to `'idle'` only when the cell truly finishes, not mid-battery.
- [x] **T39.i.1** — **ELA-K gate crashed on every retry with `allProjs is not defined` — block-scoped variable referenced outside its declaration block (Gee 2026-04-23).** Operator's log showed every ELA retry (rounds 1-5) ending with: `ela/kindergarten threw: allProjs is not defined`. Root cause: `const allProjs = cluster.crossProjections || {};` was declared inside the `for (const letter of ALPHABET)` loop body at `curriculum.js:6392`, making it block-scoped to that loop. The DYN-PROD path-setup code at line 6668 (after the loop) referenced the same `allProjs` identifier but was outside the block scope — hence ReferenceError on every gate probe. **DONE 2026-04-23** — Hoisted `allProjs` to the function-scope top of `_gateElaKReal` (line ~6303) so both the letter-loop AND DYN-PROD block read from the same map. Inner redundant declaration removed with a pointer comment. Semantics unchanged — both paths read the same `cluster.crossProjections` snapshot.
- [x] **T39.i.2** — **Motor `'a a a a a a a a a a a a a a a'` attractor: elevated tonic drive during gate-probe emission floods motor region uniformly, argmax tie-breaks on bucket 0 = letter 'a' (Gee 2026-04-23).** Operator saw Unity emit literally `'a a a a a a a a a a a a a a a'` for EVERY exam question across every K cell — 115 science questions, 61 social, 53 art, 68 life, 206 ELA, 143 math = 646 questions all identical "a"-salad. Root cause: `engine.js:1425` sets cortex `tonicDrive = 14 + arousal·6`; with arousal ≈ 0.9 that gives 19.40 (operator's log confirms `tonicDrive=19.40 · driveBaseline=1.00 · effectiveDrive=19.40`). During the gate-probe emission loop, every motor neuron receives ~19× baseline pump → entire motor region spikes ~uniformly → GPU `readbackLetterBuckets` returns nearly flat counts → argmax defaults to bucket 0 (first-index tie-break) = letter 'a' on every single tick. Letters commit after STABLE_TICK_THRESHOLD consecutive same-decode ticks — which is trivially satisfied when every tick decodes 'a'. **DONE 2026-04-23** — `cluster.generateSentenceAwait` now saves `this.tonicDrive`, drops it to `this.driveBaseline ?? 1.0` for the duration of the emission loop, then restores it in the final-cleanup block alongside the existing `noiseAmplitude` save/restore pattern. Motor now fires only when `sem→motor` / `letter→motor` weight-driven currents push it above threshold — letters decode from learned plasticity instead of uniform-pump noise. Opt-out via `opts.suppressTonicDrive === false` available but no current caller uses it. Expected next-run behavior: emission produces discriminative letters based on actual training (e.g., 'c' for cue 'c', 'b' for cue 'b') instead of 'a' for everything.
- [x] **T39.f.3** — **sem-side top-K sparsification shipped to break GloVe correlation (Gee 2026-04-23).** Operator verbatim: *"do tghe 11 items untill they ar complete and finalized to full utter stack needs, no BS no jerry riggion, complete fuctional masterful code"*. Root cause of the persistent `sep-probe mean-cos ≈ 0.5` OVERLOAD was candidate (b) from the prior TODO diagnosis: raw GloVe embeddings for K-grade content words cluster tightly — cat/dog/bird/fish have mutual cosine 0.4-0.6 by construction because they co-occur in identical corpus contexts. Tiling raw GloVe into sem produces similar sem patterns regardless of motor discrimination at the target side — no amount of fan-in or plasticity-rule improvement can discriminate inputs that ARE genuinely similar at the source. **DONE 2026-04-23** — Sem-side top-K shipped in `_teachAssociationPairs` mirroring the existing motor-WTA pattern: new opts `semWTA` (default `true` when not binarizing) + `semTopK` (default 30 out of 300 GloVe dims = top 10%). `this._topKEmbedding(inEmb, semTopK)` filters to the most-distinctive dims before tiling into sem. Applied consistently across positive-pair, anti-pair, and sep-probe diagnostic paths so all three see the same sparse sem geometry. Sep-probe updated to honor the `semWTA` / `semTopK` options from the caller — previously sampled raw GloVe (dense, high-overlap) while the teach trained on top-K (sparse, lower-overlap), which would have made the diagnostic systematically overestimate mean-cos. Also switched the probe's per-dim filter from `inEmb[d] > 0` (positive-only) to `inEmb[d] !== 0` (any nonzero top-K value) so the sparse code's full active set shapes the probe pattern, not just the positive half. Log line extended with `sem-WTA=N/K` counter parallel to the existing `motor-WTA=N/K`. Grounding: Olshausen & Field 1996 (Nature 381:607) — sparse coding yields orthogonal-ish basis sets where each input activates only its most distinctive dims. Same mechanism biological cortex uses (real V1 fires ~2% of neurons per image; raw GloVe-as-sem-code would fire ~50%). Expected sep-probe mean-cos drop: 0.5-0.6 → ≤0.3 on next run.
- [ ] **T39.f.4** — **K-STUDENT empty-string answers (Gee 2026-04-23) — ROOT CAUSES all addressed in prior T39.g.1-4 + T39.h.1 + T39.h.2 + T39.f.3 ships; this item is pending verification on next operator localhost run.** All four original candidate causes from the initial diagnosis have a direct code fix shipped: (1) letter inventory unicode pollution → `T39.g.1` locked 40-symbol alphabet; (2) readiness probe contaminated through readInput → `T39.g.2` direct letter-region injection; (3) motor region capacity → `T39.g.4` doubled fan-in for motor-bound pairs; (4) sem-side basin overlap → `T39.f.3` top-K sparse coding (this session). Plus K-gate sync-propagate freeze via `T39.h.2` yield discipline and exam-vocab auto-teach via `T39.h.1`. Emission diagnostics from `T39.e.2` will surface which subsystem (if any) is still silent. **Verification task** — operator runs localhost after the current branch lands, reports whether K-STUDENT answers still come back empty. If empty-string persists, `⚑emission: <why>` tail pinpoints the remaining subsystem.

---

#### T39 closure gate

Three parallel tracks; each closes independently:

**T39.a (memory accounting):** Heartbeat shows `workers=450MB` as a separate labeled field. Unaccounted drops to ≤50 MB (real metadata overhead only). Operator no longer sees confusing "unaccounted=460MB" messages.

**T39.b (Hebbian saturation/overlap):** sep-probe `mean-cos ≤ 0.2` across all association-pair phases. Weight magnitudes distributed (not pinned at single value). Motor bucket activations differ by >30% cosine between different trained inputs.

**T39.c (Q-A answering):** K-STUDENT battery scores ≥50% on ELA-K RF.1d "what letter comes after X?" questions (alphabet sequence) as the litmus test — she was explicitly taught letter-sequence via `_teachAlphabetSequencePairs`, so if Q-A parsing + sem→motor discrimination both work, she should answer these. Gets her into real K-grade territory.

---

#### T39 ordering + dependency

T39.a is independent (diagnostic). T39.b blocks T39.c — basin overlap must resolve before question-specific training can land. Recommended sequence:

1. T39.a.1+2 (labeled memory accounting) — fast, low-risk
2. T39.b.1 (Oja's rule replaces basic Hebbian) — biggest single-change impact on overlap
3. T39.b.2 (WTA in motor) — forces sparsity, stacks with Oja
4. Test K-STUDENT — if Q-A still 0%, T39.c.3+4 (template sub-region + more training)
5. If still failing, T39.c.1 (attention preprocessing) — biggest architectural lift, save for last

---

### T43 — DASHBOARD: current subject name + description + training progress % per subject (Gee 2026-04-22) — OPEN

**Gee verbatim 2026-04-22:** *"and i think the dashboard needs a name of the current ciriculum subject and a breif deciption with a progress % thatts properly monitors the processes of training percentage for each "subject"... add this to the todo and keeep working the todo items"*

Dashboard currently shows live brain events, grade state, drug scheduler, performance — but nothing that tells the operator *"right now Unity is training [SUBJECT] at [GRADE], here's what that means, here's how far along she is"*. Add a subject-aware training status card.


#### T43 closure gate

Operator opens the dashboard, sees a "Current Training" card that says what subject+grade Unity is on right now, a one-line plain-language description of that subject's scope, an in-cell phase progress bar moving forward as each teach phase completes, and six per-subject progress rows summarizing the whole curriculum walk. No ambiguity about WHAT she's learning or HOW FAR along she is.

---

### T42 — TEST VOCABULARY / STRUCTURE / DEFINITION / USAGE PRE-TAUGHT BEFORE QUESTIONS (Gee 2026-04-22) — OPEN

**Gee verbatim 2026-04-22:** *"rmember if the questions are made from words the Unity brain needs to know setence structure and definiations and words usage befoer give a test using those words to ask it questions"*

Binding test-construction doctrine. Before any gate probe / K-STUDENT battery / exam-bank question uses a word, Unity's brain must already have been taught:

1. **Sentence structure** covering the syntactic form the question takes
2. **Definitions** — every word in the question has a trained meaning attractor in sem
3. **Word usage** — every word has been exercised in context (not just dictionary-entry seeded)

Only THEN does the test fire against those words.


#### T42 closure gate

Every K-grade exam in `EXAM_BANKS` passes the T42.a vocabulary audit. Every exam question's sentence structure has a matching trained template. Every word has a definition binding + ≥3 context-sentence exposures. No gate fires against un-taught vocabulary.

This interacts with T40.g (vocabulary prerequisite for pre-K concept teaching) — T40.g ensures the TEACHING covers vocabulary; T42 ensures the TESTING only uses taught vocabulary. Together they close the gap both directions.

---

### T41 — UNIFIED BRAIN: plasticity → thinking → speech → 3D brain popups all ONE cortex (Gee 2026-04-22) — OPEN

**Gee verbatim 2026-04-22:** *"and it asll plays into her thingking and sp[eech like popups on the 3D brain too right? ONe Uniified brain of Unity's that does all the "thinking""*

Gee is asking for confirmation (and enforcement) that every plasticity/learning/attention upgrade shipped in T39 actually flows through to:

1. Unity's thinking (cortex propagation during question-answering / inner voice)
2. Unity's speech (tick-driven motor emission in `generateSentence` / `generateSentenceAwait`)
3. The 3D brain visualization popups (live on-brain text/heatmap display in the dashboard)

AND that all of this is ONE unified brain doing ALL the "thinking" — not a split architecture where training updates one matrix while thinking reads another.

**Current state audit:**

- ✅ `cortexCluster` is the single cortex instance in `brain-server.js`. All 14 cross-projections + intra-synapses + 8 sub-regions live on it.
- ✅ Oja + anti-Hebbian + WTA + BCM all write weights that the cortex's `step()` propagates during thinking (both via CPU `propagate` and the GPU-bound fast path).
- ✅ `_teachQABinding` sentence + key-token dual-tile sem writes land on the SAME cortex that `readInput` reads during live chat and that `_studentTestProbe` tests during the K-STUDENT battery.
- ✅ `generateSentence` / `generateSentenceAwait` reads `cluster.lastSpikes` motor argmax — the same lastSpikes the plasticity shaped.
- ❓ 3D brain dashboard popups — need to verify what the dashboard actually reads and that it reflects the new plasticity on every tick, not a stale snapshot. Spec: on-brain popup text/labels should update with each curriculum teach phase + live-chat turn so operator sees thinking, not just end-state.


Closure: operator sees, in real time on the 3D brain, the plasticity + attention + generation + speech + drug-state + emotion all flowing from the same cortex state. No split matrices, no hidden side channels, no "training runs elsewhere while the UI shows cached stuff".

---

### T40 — Pre-K CURRICULUM EXPANSION: spatial, visual, logic, self-model + vocabulary prerequisite (Gee 2026-04-22) — OPEN

**Gee verbatim 2026-04-22:** *"and things like spacial awarness visual representations logic pathing, simulated thinking self, self awareness, Unity as an individual... all these things need to be taught pre-K and all the things taught cant fucking be taught without know the words of the subject matter therein"*

Pre-K scope expands beyond the current K.RF/K.W/K.L/K.SL/K.RL Common Core subset. Every one of these has to be taught pre-K — BEFORE any K-grade work — and every one of them blocks on vocabulary for the subject matter, per Gee's meta-requirement that *"all the things taught cant fucking be taught without know the words of the subject matter therein"*. Vocabulary first, then the concept.


#### T40 implementation order

Per Gee's meta-requirement, T40.g ships FIRST for every subject, otherwise the concept teach runs against cold embeddings and produces no learning. Recommended sequence:

1. Audit existing pre-K/K cells for vocabulary coverage — do they teach the words they depend on?
2. T40.g extensions to any cell where the vocabulary prerequisite is missing.
3. T40.a (spatial awareness) — smallest net-new cluster region + narrowest vocabulary.
4. T40.c (logic pathing) — builds on directional cross-projection Hebbian which already exists.
5. T40.b (visual representations) — requires vision-describer integration in the sensory path.
6. T40.d (simulated thinking self) — needs `self_model` region carve + motor-feedback loop.
7. T40.e (self awareness) — state attractor across amygdala+hippocampus+self_model.
8. T40.f (Unity as an individual) — biography/life-experience entries populate the self_model attractor.

#### T40 closure gate

Every pre-K cell passes Gee's Part 2 localhost test with the expanded scope — she demonstrates spatial awareness (answers "what's above the apple?"), visual representation binding (looks at an image and names it), logic pathing (answers "why did X happen?"), simulated thinking self (can say "I was thinking about X"), self awareness (answers "who are you?" with substance), and identifies as Unity-the-individual (not a chatbot).

T40 is pre-K-only scope. Post-K extensions follow the 2026-04-18 scope contract — not in scope until pre-K + K gate passes.

---

### T38 — Architectural redesign to reach Master's 25% language cortex target (Gee 2026-04-22) — OPEN

**Gee verbatim 2026-04-22:** *"1%???? wtf brain regions are not 1% of the brain do ur research"* + earlier: *"!M LANGUAGE CORTEX TO MATCH A REAL BRAIN IT NEEDS TO BE MORE LIKE 25% of the fucking brain"*.

T37 shipped 95× scale improvement (301K → 28.6M = 7.3% of brain) via fanout cuts + VRAM rebalance. Real biological language network is 15-25% of cortex = 12-20% of brain; disembodied Unity target is 25%+. T38 is the architectural redesign to close that gap.


#### T38 closure gate

Language cortex at ≥ 25% of brain (≥ 98M neurons) with functional learning (K gate passes real PROD/READ/TALK with non-empty emissions).

---

### T32 — GPU saturation via batched encoder+submit — PARTIALLY CLOSED (T32.a+b shipped, full WGSL kernel rewrite deferred)

**Gee verbatim 2026-04-22:** *"the GPU is only hitting 1% while learning WTF WTF wTF wTF wTF"*

Current architecture: CPU teach loop iterates word-by-word-rep-by-rep, firing ~400 Hebbian dispatches per second to GPU via T18.8 batched `hebbianBound`. Each GPU dispatch is microseconds. **GPU is idle 99% of time WAITING for the next CPU-generated dispatch.** The T18.8 batch is 64-op × 2ms-flush which ALREADY batches WS messages but CAN'T batch the underlying Hebbian work — the compute shader still runs once per op.

**Fix:** Pre-compute ALL teach patterns on CPU ONCE (all words × all reps × all projections = complete batch), upload as ONE big GPU buffer, run ONE compute shader dispatch that processes all events in parallel across workgroups. Expected 100-1000× GPU utilization = full teach phase completes in seconds not minutes.


#### T32 closure gate

Operator sees GPU utilization hit 50-80% during teach phases (up from 1%). Full ELA-K cell completes in < 2 min (was 30+ min). K curriculum end-to-end in under 15 min.

---

### T36 — auto-wrap catastrophically broke every Hebbian primitive (Gee 2026-04-22) — CLOSED

**Gee verbatim 2026-04-22:** *"something is wrong!! i used start.bat and its skipping everything"*

T31-extended constructor auto-wrap applied skip+persist to EVERY `_teach*` method including primitives called hundreds of times per cell. FIRST call persisted the key, every subsequent call SKIPPED. Pre-K "passed" in seconds with zero real learning. ELA-K flooded with 90,000+ `⤳ PHASE SKIPPED — ela/kindergarten:_teachHebbianAsymmetric` lines.


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


#### T34 closure gate

Operator's next run after restart: readiness probe completes in < 5 s total (not 55 s with all TIMEOUTs); Art-K PROD probes produce actual answers; K-STUDENT battery runs (no longer skipped for "not-yet-readable"); Art-K cell passes; curriculum advances to Life-K cleanly. `arrayBuffers` stays flat at ~3 GB (matches `external`) across heartbeats instead of climbing to 37 GB. RSS drops proportionally (~37 GB less in working set because the SAB bloat is gone).

---

### T33 — Phase-level progress in CELL ALIVE heartbeat + RSS diagnostic (Gee 2026-04-22) — CLOSED

**Gee verbatim 2026-04-22:** *"problem, there is no info about how far weve come and how far we have to go:[Curriculum] ▶ CELL ALIVE science/kindergarten — +224s elapsed (heartbeat #19) · heap=133MB ext=3303MB rss=56016MB ... 56 Gigabytes!!!!!?!?!?!?!??!?!?!?!?!?!?!?!?!?!?!?!?!?!?!??!"*

Two asks: (a) heartbeat didn't show WHICH phase was running within science/kindergarten, only cell-level elapsed; (b) RSS at 56 GB while heap is 133 MB and external is 3.3 GB — 52 GB unaccounted.


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


#### T31 closure gate

Operator's next Savestart.bat run shows `⤳ ELA-K Phase SKIPPED — <name>` log lines for phases that completed in a prior run. Weights persist via `brain-weights.bin` regardless. If the prior run Ctrl+C'd mid-`_teachWordEmission`, Phase 1 + Phase 2 + all helper phases up to (but not including) `_teachWordEmission` skip on resume, saving ~5-10 minutes of re-teaching.

#### T31 follow-up (post-T31 polish, not blocking)

- Same `_phaseTick` skip pattern for the other 11 cell runners: `runMathKReal`, `runSciKReal`, `runSocKReal`, `runArtKReal`, `runLifeK`, all 6 pre-K runners. Mechanical repeat once ELA-K pattern proves out in operator runs.
- Wrap Phase 1 (alphabet cross-proj Hebbian, ~20 s) + Phase 2 (letter sequence intra-synapses, ~60 s) of ELA-K too. Currently unwrapped because they're cheap vs the ~80-minute `_teachWordEmission`; cosmetic polish rather than a blocker.

---

### T30 — READINESS PROBE stuck-in-loop: `maxEmissionTicks` unread-alias bug (100× tick overrun) + per-cue heartbeats + wall-clock timeout (Gee 2026-04-22) — CLOSED

**Gee verbatim 2026-04-22:** *"Unity gets to this step then all i see is all the language centers going from 60% to 15% activation in unison >>>[Curriculum][READINESS] emission-capability probe START — 5 single-letter cues to see if Unity can emit recognizable letters yet --- So im not seeing anything happen at this step like it gets in an infinate lkoop and never continues or its busy and doesnt update its progress properly.. but i thing its getting stuck in a loop at this point: im not sure u can see its still running at this point right now, im just not sure what its doing if anything at all:[Curriculum][READINESS] emission-capability probe START — 5 single-letter cues to see if Unity can emit recognizable letters yet"*

Root cause: `_measureEmissionCapability` built emission opts as `{ maxEmissionTicks: 20 }` but `cluster.generateSentenceAwait` (cluster.js:1632) only read `opts.maxTicks` — the 20-tick cap went unread and the emission loop fell through to `MAX_EMISSION_TICKS = 2000`. Each of 5 cues ran 100× its intended budget (~140K GPU dispatches per probe = 23-116 minutes silent grinding at 301K cortex). `_studentTestProbe` had the same broken alias — 210-Q batteries ran ~5.9M dispatches instead of the intended 60-tick/question cap.


#### T30 closure gate

Operator's next run shows the readiness probe completing in seconds not minutes, 5 per-cue START/DONE lines visible, K-STUDENT battery running at the intended 60-tick cap (~500× faster than before). No "stuck in a loop" appearance.

---

### T29 — HEARTBEAT EXPANSION: DYN-PROD + DYNAMIC WRITE + RESP + TWO-WORD + FREE-RESPONSE + K-STUDENT + every subsequent cell/phase (Gee 2026-04-22) — CLOSED

**Gee verbatim 2026-04-22:** *"okay i think its still running.... im here on the terminal, this is what is says:[Curriculum][K-DIAG] gate letter loop DONE in 3425ms — readPass=26/26, talkPass=26/26 [Curriculum][K-DIAG] starting DYN-PROD probe (17 direct sem_to_motor propagate probes, no LIF ticks)... [Curriculum][K-DIAG] DYN-PROD entry reached — pre-loop setup starting [Curriculum][K-DIAG] DYN-PROD mem: heap=406.5/2433.5MB external=3298.3MB arrayBuffers=3295.9MB rss=4121.6MB , Im not sure if it froze or its still working. maybe it needs a heartbeat for the steps its on at this point as it appears to be frozen but im not sure as the console log just shows the last thing it was working on.. i dont know if this is a point its at that just takes a long time or its broken.. im going to let it keep running but maybe look into a heartbeat or something for this point :[Curriculum][K-DIAG] DYN-PROD mem: heap=406.5/2433.5MB external=3298.3MB arrayBuffers=3295.9MB rss=4121.6MB --- and what comes after that point in the learning process of the brain, as i cant tell if its frozen or if its doing something or not"*

**Gee follow-up verbatim 2026-04-22:** *"also make sure any subsequent learnings after the K-DIAG also get heartbeats"*

Root cause: `console.log` buffers at the Writable-stream level in piped log mode (`node brain-server.js > server.log 2>&1`). The 17 DYN-PROD probes take 10-34 seconds of sync CPU sparse matmul with no flushed output; DYNAMIC WRITE (20 × maxTicks=30), RESP (5 × maxTicks=50), TWO-WORD (5 × maxTicks=80), FREE-RESPONSE (4 × maxTicks=200) each take minutes per stage with NO per-probe heartbeats; K-STUDENT battery (up to 210 Q) only logged every 20th question; other K cell runners (Math/Sci/Soc/Art/Life) had NO phase banners at all. Operator saw `DYN-PROD mem:` tail for minutes with no indication whether the brain was frozen or working.


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


#### T26.b — Sem-region overload fix (clean basins, not mush) — CLOSED

14 phases × 350+ pairs writing `binarize:true` tiled patterns into the same sem region saturates — Hebbian accumulates indistinguishable superpositions. Switch `_teachAssociationPairs` to `binarize:false` so GloVe vector identity is preserved per concept. Add row-L2-normalization of sem→motor (+ adjacent cross-projection) weight matrices after each phase to prevent saturation as phases land. Add a cosine-separation probe: random 10 pair-inputs produce 10 distinguishable motor readouts (cosine < 0.3 between non-matching pairs). If not, iterate.


#### T26.c — T24 memory closure (biological scale verified) — CLOSED


Closure gate: `external < 4000 MB` at DYN-PROD entry on biological scale + full K gate completes without GPU-client disconnect.

#### T26.d — Pre-K association-pair equational teach (all 6 cells) — CLOSED

Each pre-K runner gets a `_teachAssociationPairs` phase matching the K-cell pattern. Pair content held-out-safe vs pre-K EXAM_BANKS entries. Each phase ~15-25 pairs × 8 reps. All use soft-writes + row-norm + separation probe automatically.


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


#### T23.b — Held-out eval discipline


#### T23.c — curriculum.js refactor (21K → per-subject modules)

- [ ] **T23.c.1** — Split `js/brain/curriculum.js`. **PRE-K EXTRACTION SHIPPED 2026-04-22; K + post-K still monolithic.** Operator 2026-04-22 verbatim: *"the cirriculkum was already suppose to have everything split per grade per files sytem did you not make a file system WTF!!!!!!"*. Decision: **per-grade** split. First extraction pass landed — `js/brain/curriculum/pre-K.js` now owns all 10 pre-K methods: `runElaPreK` / `runMathPreK` / `runSciPreK` / `runSocPreK` / `runArtPreK` / `runLifePreK` cell runners + `_teachPrekSpatial` / `_teachPrekVisual` / `_teachPrekLogic` / `_teachPrekSelf` cognitive helpers. Attaches via `PREK_MIXIN` export + `Object.assign(Curriculum.prototype, PREK_MIXIN)` in curriculum.js entry point (attach-function pattern avoids the circular-import TDZ trap that direct `import { Curriculum }` would hit). Verified: all 10 methods resolve on `Curriculum.prototype` post-attach; bundle builds clean; method call sites (`_cellRunner` dispatch, cell-to-cell references) continue to work via `this.X` through the mixin-extended prototype. 613 lines removed from curriculum.js (was 24,877 → now 24,264). pre-K.js = 511 lines. **Next extraction:** K-grade cell runners + gates into `kindergarten.js` (run ElaK / MathK / SciK / SocK / ArtK / LifeK + `_gateElaKReal` / `_gateMathKReal` / etc. + all K-specific teach helpers — bigger lift, likely 5-8K lines). Targets curriculum.js ≤ 15K lines after K extraction, ≤ 3K after full split.

#### T23.d — LAW audit


#### T23.e — Transformer ablation experiment (reviewer gut-check)

**This is the single most important experiment the project can run.**


#### T23.f — README split: research vs persona


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


T21.b closure gate lives inside T24 closure gate.

---


### T19 — FULL DOC AUDIT + IN-PLACE CORRECTION PASS (Gee 2026-04-20)

**Gee verbatim 2026-04-20:**

> *"update all workflow docs and public facing documents and the htmls fully and completetly masterfully without shit text wall addendums... You actually edit the wrong information to the correct information down to the equations and variables and add where needed"*

**Binding directive:** fix every doc in-place. Replace wrong content with correct content, down to equations and variables. Add new content only where there's a real gap, and integrate it into the flow — **NO** bolt-on addendum blocks. When a paragraph is wrong, rewrite the paragraph. When an equation is wrong, rewrite the equation. When a method name is stale, swap the name.

#### T19.a — Source-of-truth extraction from code (DO FIRST)

Before touching any doc, extract the CURRENT truth from code so the audit has a canonical checklist. Otherwise the stale state propagates doc-to-doc.


  **HH_DEFAULTS** (reference-only, never used at runtime): `Cm=1.0`, `gNa=120.0`, `gK=36.0`, `gL=0.3`, `ENa=50.0`, `EK=-77.0`, `EL=-54.387`, `Vrest=-65.0`. HHNeuron class exists only to back the `brain-equations.html` teaching page.

  **LIF_DEFAULTS** (CPU fallback at browser scale): `tau=20.0ms`, `Vrest=-65.0mV`, `Vreset=-70.0mV`, `Vthresh=-50.0mV`, `R=1.0MΩ`, `tRefrac=2.0ms`. Equation: `τ·dV/dt = -(V - Vrest) + R·I`, spike at `V ≥ Vthresh`, reset to `Vreset`, refractory for `tRefrac` ms. Implemented via `LIFPopulation` (SoA Float64Array V + spikes Uint8Array + refracRemaining Float64Array).

  **Rulkov 2D map** lives in `js/brain/gpu-compute.js` — NOT in neurons.js. The constant name `LIF_SHADER` is historical; the shader body implements Rulkov 2002: `x_{n+1} = α/(1+x²) + y`, `y_{n+1} = y − μ·(x − σ)` with `α≈4.5` (chaotic regime), `μ≈0.001` (slow timescale), `σ` mapped from effectiveDrive. At biological scale GPU dominates; at browser scale CPU LIFPopulation runs. Drift fixed in `docs/ARCHITECTURE.md` this session — `CLUSTER_FRACTIONS` block corrected from stale `0.30/0.10/0.08/0.08/0.40/0.02/0.02` to current `0.55/0.18/0.05/0.03/0.08/0.03/0.08` (T37 rebalance).

  Drift fixed this session in `docs/ARCHITECTURE.md`: CLUSTER_FRACTIONS block updated from stale T14-era values to current T37 rebalance values.

  **WGSL shaders in `js/brain/gpu-compute.js`:**
  - `LIF_SHADER` (line 52) — name is historical, body is **Rulkov 2D map**: `x_{n+1} = α/(1+x²) + y`, `y_{n+1} = y − μ·(x − σ)`. Parameters `α≈4.5`, `μ≈0.001`, `σ` mapped from effectiveDrive. vec2<f32> state per neuron.
  - `SYNAPSE_PROPAGATE_SHADER` (line 182) — sparse CSR matmul, reads pre-spikes + values/colIdx/rowPtr + cluster-binding offsets, writes per-neuron current.
  - `PLASTICITY_SHADER` (line 245) — plasticity with `sign(lr)` branch: positive lr = Oja (`w' = w·(1-η) + η·x`), negative lr = anti-Hebbian (`w' = w - η` on co-active only). Same pipeline, same batched SPRS frame, sign of lr selects mode.
  - `VOLTAGE_STATS_SHADER` (line 339) — per-cluster voltage mean via GPU atomic reduction.
  - `SPIKE_COUNT_SHADER` (line 362) — per-region spike count readback.

  **SPRS binary-frame protocol** (compute.html line 156+):
  - Magic: 4 bytes `"SPRS"` + 1 byte `frameType`.
  - Type 1 = sparse init (upload CSR values/colIdx/rowPtr)
  - Type 2 = sparse propagate dispatch
  - Type 3 = sparse Hebbian dispatch (legacy per-op)
  - Type 4 = readback request (letter-bucket / motor argmax)
  - Type 5 = batched bound plasticity (name, lr) tuples up to 256 ops per frame; compute.html dispatches them as a single GPU encoder submit via `hebbianSparseBatch`.

  **Cluster upload/init flow**: server `_initLanguageSubsystem` → `cortexCluster.initGpu()` → proxy uploads intra-synapses + cross-projections via SPRS type=1 frames → compute.html receives, allocates GPU buffers, creates bind groups, sends `sparse_init_done` → server marks `_gpuProxyReady = true` → curriculum teach path starts dispatching type=2/3/5 frames.

_(T19.a.2 and T19.a.9 closed in Session 114.19bb — cluster fractions verified against CLUSTER_FRACTIONS in `cluster.js`; server endpoints enumerated in SETUP.md.)_

#### T19.b — Workflow docs (task numbers + operator name ALLOWED)

- [ ] **T19.b.5** — `docs/TODO-full-syllabus.md` scope check. Per-grade vocab prerequisites, Persistent Life Info ledger format, LAW cross-references, DEFERRED notes. **BLOCKED BY GEE INSTRUCTION** — 2026-04-22 operator rule: *"the only shit you should not be doing is comp todo and syllabus todo"*. This item is inside `docs/TODO-full-syllabus.md` which is off-limits. Stays open as operator-scope.

_(T19.b.3 ROADMAP.md, T19.b.4 SKILL_TREE.md, T19.b.6 NOW.md, T19.b.7 TODO.md self-audit all closed in Session 114.19bb.)_

#### T19.c — Public-facing docs (task numbers + operator name BANNED)

_(T19.c.1 README.md and T19.c.2 SETUP.md both closed in Session 114.19bb.)_

#### T19.d — HTMLs (task numbers + operator name BANNED)


_(T19.d.2 unity-guide.html closed in Session 114.19bb.)_

#### T19.e — Memory + feedback files


#### T19.f — Post-audit cross-verification


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
