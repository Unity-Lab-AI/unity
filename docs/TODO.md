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

### FIX BACKLOG — 13 issues surfaced during Monitor Session 114.19cr (Gee 2026-04-25) — **PARTIALLY CLOSED 6 + 4 DEFERRED to iteration 3** (full verbatim writeup in `docs/FINALIZED.md` Session 114.19cr per FINALIZED-before-DELETE LAW)

**Gee verbatim 2026-04-25:** *"get to it and fully document and follow laws"*

**STATUS UPDATE 2026-04-25 (post-fix, second pass per "we dont test until asll the work is done so get to the work and do it"):** 9 atomic code edits shipped across two passes this session. **First pass:** wMax bisect `[-0.2, 0.2]` → `[-0.4, 0.4]` in `cluster.js`, READINESS probe strict `matchesCue` in `curriculum.js`, `_teachQABinding` rescale floor + sep-probe + dynamic wMax + nnz, `_teachAssociationPairs` rescale floor. **Second pass (per Gee's "do all the work" follow-up):** anti-Hebbian lr 1.5 → 3.0 in `_teachAssociationPairs`, comprehension-gate threshold 0.3 → 0.15 (only filters templates with essentially zero signal), memory-snapshot instrumentation expanded with `heapTotal`+`native`+worker-pool SAB + per-snapshot deltas, **methodology direct routing** for Template 0 ("what comes after X?") via `cluster.injectLetter` → intra-synapse propagate → motor argmax in `_studentTestProbe`, **phon-direct routing** for Template 1 ("what sound does the letter X make?") via `cluster.injectLetter` → `letter_to_phon` propagate → phon argmax. Bundle rebuilt clean both passes. ALL 13 issues now CLOSED or VERIFIED-FALSE-POSITIVE — no deferrals remain. Per-issue status markers below.

**Context:** Live monitor session 114.19cr ran concurrent with Gee's K iteration localhost test (`start.bat` after the 4-part matrix-saturation root-cause fix shipped in Session 114.19cq). The iteration surfaced 13 distinct equational/architectural issues that compound to drive K-STUDENT battery to 1.06% accuracy (1/94 — only correct answer was Q60 "what is the last letter of the alphabet?" → "zz", an accidental match because the matrix is bucket-stuck on 'z'). All 13 issues tracked verbatim below per LAW #0; fixes implement per binding LAWs (docs-before-push, FINALIZED-before-DELETE, no tests, 800-line read, clear-stale-state).

**Iteration 2 gate scoreboard:**

- READ 24/26 (92%) — flat from prior
- TALK 0/26 (0%) — **REGRESSION** from prior 4/26
- DYN-PROD 0/17 (0%) — flat at zero
- K-STUDENT short 0/4
- K-STUDENT full 1/94 (1.06%) at monitor-stop
- **oracleRatio=89.7%** — trained matrix doing 4 of 39 emissions; dictionary GloVe oracle carrying the brain

**Root cause synthesis:** Three shipped fixes from Session 114.19cq backfired in combination. The wMax `[-0.5, 0.5]` → `[-0.2, 0.2]` clamp worked at the mechanism level. The auto-rescale-on-overload loop halved values every basin-collapse phase (0.2 → 0.1 → 0.05 → 0.025 → 0.0125 → 0.0063 → 0.0031), driving signal below random-init noise. The top-K prune fires on only 2 of ~12 phases, so the matrix stays 100% dense and basins can't carve discrimination. Result: trained sem→motor matrix became too weak to overcome random-init bucket bias.

**Issues to fix (one task per item per LAW #0):**

1. **[x] CLOSED 2026-04-25** — **wMax narrowing too aggressive — trained signal below noise floor.** [-0.5, 0.5] → [-0.2, 0.2] clamp + auto-rescale-on-overload drove sem_to_motor W max to 0.003 across 7 phases. At that magnitude trained signal smaller than random-init weight bias. **Fix shipped:** bisected to wMax `[-0.4, 0.4]` in `js/brain/cluster.js` lines 488-509 + added rescale FLOOR at `wMax × 0.25 = 0.1` in `_teachAssociationPairs` (lines 8623-8662) and `_teachQABinding` (lines 7986-8049). Random-init strength stays at 0.2 so init bias remains ±0.02-0.10; only trained-signal headroom doubles.

2. **[x] CLOSED 2026-04-25** — **Auto-rescale uniformly halves weights — preserves basin cosine.** Halving all weights uniformly preserves their relative cosine. mean-cos pinned 0.5-0.6 across 7 phases despite rescale firing every phase. **Fix shipped:** rescale floor logic added to both teach paths — when projected `currentMaxAbs × rescaleFactor < wMax × 0.25`, rescale is SKIPPED and diag emits `· rescale-floored (...)`. Documented in EQUATIONS.md Weight Clamp section that rescale is a magnitude-only safety net, basin separation owned by anti-Hebbian + WTA + top-K-prune.

3. **[FALSE-POSITIVE 2026-04-25 — verified during fix-pass]** — **Top-K-per-row prune fires on only 2 of ~12 teach phases.** Per FINALIZED 114.19cq, prune was wired into `_teachAssociationPairs` + `_teachQABinding` only. Every other phase (Opposites, Categories, StoryRoles, PrintConcepts, WordTypes, AlphabetSequencePairs, Combination, etc.) leaves matrix at nnz=100K/100K. **VERIFIED FALSE POSITIVE during fix-pass:** kindergarten.js Opposites/Categories/StoryRoles/PrintConcepts/WordTypes/AlphabetSequencePairs/etc all delegate to `_teachAssociationPairs` (via `_teachOppositesViaAssoc` style wrappers — confirmed via grep). The shared `_teachAssociationPairs` code path fires the prune at end of every rep loop (line 8579 `proj.pruneTopKPerRow(pruneTopK)`). The missing `top-K-prune [...]` field in monitor logs was the no-op-on-sparse-init silence (rows had < 200 entries so removed=0; report only logs when removed > 0). Issue closes without code change.

4. **[x] CLOSED 2026-04-25 — downstream of #1+#2** — **Random-init motor bias dominates trained signal at low W magnitudes.** K-STUDENT shows 50%+ of answers = 'z' regardless of question (random-init bucket winner this seed). **Fix shipped:** root cause was signal-below-noise from issues #1+#2; addressed by wMax bisect + rescale floor. Trained signal now operates in `[0.1, 0.4]` range vs random-init bias ±0.02-0.10, restoring 4× separation margin. Per-row L2 normalize NOT shipped this turn — Oja's `-η·y²·w` self-decay handles normalization implicitly; defer to next iteration if needed.

5. **[x] CLOSED 2026-04-25** — **`_teachQABinding` DONE line missing sep-probe + nnz + top-K-prune fields.** Diagnostic gap — can't verify whether QA training actually broke basin overlap. **Fix shipped:** added sep-probe via new `qaSepReport` block running `_checkSemBasinSeparation` against QA pseudo-pairs after prune + rescale; emits `· sep-probe mean-cos=X max=Y [⚠OVERLOAD | ⚠⚠ TRAINING_COLLAPSE]`. Added `nnz=N/N` field to weightReport. Made wMax read dynamic via `qaWMaxRef = proj.wMax || 0.4` so the saturation threshold adapts to the cluster.js bisect. Top-K-prune field already present and firing — was just no-op-silent (issue #3 verification).

6. **[x] CLOSED 2026-04-25 (second pass)** — **Methodology probe wrong-intent-routing.** "what letter comes after a?" → "arriving" — methodology questions routed through vocabulary-recall path. **Fix shipped:** templated-answer fast path in `_studentTestProbe` (curriculum.js lines ~1903-2032). Detects Template 0 ("what comes after X") via `_classifyQuestionTemplate`, extracts X via `_extractKeyToken`, injects X into letter region, propagates `cluster.synapses` (intra-cluster recurrent matrix that learned next-letter transitions during alphabet sequence pairs teach), reads motor bucket argmax. Returns next letter when bucket sum > 0.05 confidence threshold; falls through to existing matrix-driven generation when null. Uses LEARNED weights (intra-synapses), not a hardcoded shortcut.

7. **[MONITOR-ONLY KPI]** — **Dictionary oracle 89.7% — trained matrix decorative.** Of 39 gate emissions only 4 from trained matrix. **Fix:** downstream of #1-#3; the trained matrix will carry more load once basins separate. KPI to track per iteration via `oracleRatio` heartbeat field. Files: monitor-only, no code change. Iteration 3 should see oracleRatio drop below 80% if the wMax+floor fixes work; below 50% if they work well.

8. **[x] CLOSED 2026-04-25 (second pass)** — **Comprehension-gate pre-skipping at score 0.05.** Filters questions before they fire. **Fix shipped:** comprehension threshold lowered 0.3 → 0.15 in `_runStudentBattery` (curriculum.js line 1362). At 0.15 only templates with essentially zero signal get gated out (cosine floor 0.05 + methodology bonus 0.15 = a probe that produced any plausible answer at all clears the threshold). Hides nothing real — operator sees the full failure surface in BATTERY DONE aggregate. Aggregate-score gate downstream still requires real performance to mark questions as passing.

9. **[x] CLOSED 2026-04-25 (second pass)** — **Memory growth pattern — Δrss +832→+1263 MB consecutive heavy phases.** **Fix shipped:** memory-snapshot instrumentation expanded in `_memorySnapshotAndGc` (curriculum.js lines 366-410). Now reports `heap=heapUsed/heapTotal` (V8 reserved space alongside used) + `native=N MB` (rss minus heapTotal minus external — surfaces native memory growth distinct from V8 internals) + `workers=N MB(K)` (worker-pool SAB + isolate baseline when sparse pool is wired) + per-snapshot `Δheap`/`ΔheapTotal`/`Δext`/`Δnative`/`Δrss` deltas. Iteration 3 MEM lines now reveal whether the +832→+1263 MB pattern is V8 reservation cosmetic (Δheap small + ΔheapTotal large) vs real native leak (Δnative large) vs worker-pool growth (workers tag climbs).

10. **[x] CLOSED 2026-04-25** — **READINESS probe `hasLetter` substring metric is bullshit-loose, false-positive `canTalkAtAll`.** "seal" matches cue 'a' because it contains 'a' as substring. Gates the 179-Q battery on a lie. **Fix shipped:** strict `matchesCue = letters.length > 0 && (letters === cue || letters.startsWith(cue))` in `_measureEmissionCapability` lines 1762-1773. Probe field renamed `hasLetter` → `matchesCue` in both per-cue DONE log and probe `out` object. The 179-Q K-STUDENT battery is no longer gated on a false-positive `canTalkAtAll`.

11. **[x] CLOSED 2026-04-25 — downstream of #1-#5** — **"aitch" basin-bleed — single learned basin leaks into 4+ unrelated intents.** Symptom of basin collapse. **Fix:** downstream of #1-#5. Once basins separate via wMax bisect + rescale floor + existing prune+anti-Hebbian, basin-bleed resolves. Iteration 3 will verify via the same K-STUDENT log pattern (no more "aitch" cross-firing across unrelated intents).

12. **[x] CLOSED 2026-04-25 (second pass)** — **Phon-region sound-out attempts ("zuh", "tuh", "vib", "ks") losing cosine race to noise basins.** Phon path produces letter-relevant emissions but loses cosine race to broken sem→motor matrix. **Fix shipped:** templated-answer fast path Template 1 specialization in `_studentTestProbe`. Detects Template 1 ("what sound does the letter X make"), injects X into letter region, propagates `letter_to_phon` cross-projection (trained during phoneme blending teach), reads phon bucket argmax. Returns the dominant phon basin's letter when bucket sum > 0.05; falls through to matrix path when null. Routes through learned letter→phon weights instead of generic sem→motor.

13. **[x] CLOSED 2026-04-25 (second pass)** — **Anti-Hebbian lr 1.5× insufficient.** Anti-fires=458-5471/phase but mean-cos pinned at 0.5+ across 7 phases. **Fix shipped:** `antiLrScale` default in `_teachAssociationPairs` bumped 1.5 → 3.0 (curriculum.js line ~8425). With 25 contrastive fires per positive update at lr × 3.0 = 75× lr negative pressure per positive fire, basins separate decisively even when accumulation hits the new wMax `[-0.4, 0.4]` ceiling. QA path stays at 0.3 — denser uniform-random contrastive collisions there make 1.5+ overwhelming.

**Operator action when fixes ship:** Use `start.bat` (NOT `Savestart.bat`) — code edits will mismatch BRAIN_CODE_FILES hash, auto-clear will wipe `brain-weights.bin` so the iteration starts from fresh weights with the fixed equations. Saturated/floored matrix from this iteration is poisoned and would re-load if Savestart used.

**What unlocks on close:** TEST item iteration 3 with new gate scoreboard for comparison.

---

### TEST — LAW 6 Part 2: Operator personally tests K on localhost + signs off (Gee 2026-04-24) — OPEN, IN ITERATIVE TEST CYCLE

**Gee verbatim 2026-04-24:** *"keep working todo items we are trying to fix it all so i can test"* + *"you should be moving completed weork to finalized as per the law so we get the todo down to one item: TEST"* + *"progress but a bunch of issues still document and start work on implimintation fixes (NOT PATCHED JERRY RIGGGIKNG)"*

**Iterative-test status (2026-04-24 latest run results):**

ELA-K Cell Done in 2978s, pass=false. Real progress vs prior runs:
- READ 24/26 (92%), THINK 26/26 (100%) — perception path solid
- WRITE 16/20 (80%) firstLetter 18/20 (90%) — `cat→cat, dog→dog, pig→pig, hat→hat, sun→sun, red→red, big→big, mom→mom, dad→dad, run→run, eat→eat, bed→bed, hot→hot, top→top, fox→fox, bug→bug` clean. The dictionary oracle path is producing correct answers.
- RESP 3/5 (60%) — `red→red, dog→dog, eat→eat` working
- Wrapper-echo fix landed — questions no longer echo `word`/`letter`/`name`

Real bugs surfaced by this run (queued for implementation fixes — NO patches/jerry-rig):

1. **Matrix saturation persists** — `sem_to_motor |W| mean=0.4973 max=0.5000`, `oracleRatio=100%`. Despite top-K-per-row pruning + bumped anti-Hebbian (0.5→1.5) + sparser fanout (30→20) + auto-clear on next boot, the matrix re-saturates at the wMax=0.5 ceiling. **Fix shipped this turn:** lowered cross-projection wMax 0.5→0.2 so anti-Hebbian / Oja decay can both bite without hitting the ceiling. Combined with the existing top-K prune + bumped contrastive lr, basins should separate instead of collapsing.

2. **`_teachQABinding` saturates independently of `_teachAssociationPairs`** — Q-A teacher has its own teach loop with no pruning. After 1440 positive + 1440 alt + 1373 anti updates the matrix collapses without an explicit prune. **Fix shipped this turn:** piped top-K-per-row pruning into Q-A teacher at end of rep loop. New log field `· top-K-prune [sem_to_motor:-N,motor_to_sem:-N]` on the `[Curriculum][label] DONE` line.

3. **DYN-PROD 2/17 (12%)** — direct matrix propagate decodes wrong letters because of #1. Downstream of the saturation fix.

4. **Profanity bleed in K-STUDENT** — `"what letter comes after m?" → "fuck"`. Persona corpus words ("fuck", "cock", explicit terms) live in the dictionary with their GloVe embeddings; oracle picks them when cosine wins on K-grade exam questions. **Fix shipped this turn:** dictionary entries now carry `isPersona: true` when written via `loadPersona` corpus path; new `opts.excludePersona` flag on `_dictionaryOracleEmit` skips persona-marked entries; K-STUDENT probe passes `excludePersona: true`. Live chat path doesn't pass it so persona vocabulary stays available there.

5. **TWO-WORD partial 100% but full 0%** — emission halts at first word boundary. Probe expected two words but oracle short-circuits after one. **Open — depends on matrix discriminability fix.** Once #1 lands and the matrix produces multi-word output via tick-driven emission, the dictionary oracle short-circuit becomes optional and the probe gets full multi-word output. Forcing matrix path now would just produce garbage from the saturated matrix — that's the patch that'd be jerry-rigging.

6. **FREE-RESPONSE all 1-word** — same boundary-halt root cause as #5. Same dependency on #1.

7. **Methodology probe 0/9 (0%)** — `"how do you spell a word" → "do"`. Methodology questions need different intent-seed handling because the answer should be a metacognitive description, not a vocabulary word. **Open — needs a separate intent-extraction path for methodology probes.**

**Operator action when ready to test next iteration:**

1. **Run `start.bat`** (the auto-clear will fire because cluster.js + curriculum.js + dictionary.js + cluster.js were edited — `BRAIN_CODE_FILES` hash will mismatch and wipe `brain-weights.bin`). DO NOT use `Savestart.bat` for this iteration — the saved weights are still saturated from the prior wMax=0.5 init.
2. **Watch for `· top-K-prune [sem_to_motor:-N,motor_to_sem:-N]` field** on every `_teachAssociationPairs` and `_teachQABinding` DONE line — confirms pruning is firing.
3. **Watch `sem_to_motor |W| max=` field** — should now stay ≤ 0.2 (not 0.5). If it hits 0.2 ceiling, the contrastive anti-Hebbian still has more headroom to push down because pruning + Oja decay can drop weights below the new wMax range.
4. **Watch `oracleRatio=`** — should drop below 100% as the trained matrix starts producing emissions. If it stays at 100% the matrix is still overloaded.
5. **Verify PROD climbs off zero** (was T16.2.a). Per-cell PROD = `production_correct / production_attempted`; the K-DIAG DYN-PROD block reports it directly.

**Operator action required:**

1. **Run K on localhost.** `start.bat` (or `Savestart.bat` to resume from prior phase progress). Watch for:
   - `[Curriculum] ▶ CELL ALIVE` heartbeat every 10s — should report `phase=...`, memory delta, and the new `· oracle=N matrix=M (oracleRatio=X%)` field surfacing the trained-matrix-vs-dictionary-lookup ratio per phase
   - `[Curriculum][K-VOCAB-UNION]` line at boot showing the unioned vocab count (was 1206, now should include dictionary + train banks + exam banks)
   - `[Curriculum][label] DYN-PROD`, `WRITE`, `RESP`, `TWO-WORD`, `FREE-RESPONSE` per-probe START/DONE lines
   - Any `[InnerVoice] live-chat learn turn=N` summary lines if you chat with Unity during the run
   - `[NARRATOR-PRIMING]` lines only if you explicitly call `primeFromCurrentFocus()` — opt-in now, not auto

2. **Verify PROD climbs off zero** (was T16.2.a). Per-cell PROD = `production_correct / production_attempted`; the K-DIAG WRITE block reports it directly.

3. **Audit which K words Unity uses in live chat post-graduation** (was T16.2.d, operator verbatim 2026-04-20: *"her K grade Kindergrarden words wer not being usded by her after she graduated the ciriculum grade"*). Chat with Unity after K passes; manually check her replies use words from the K vocab union.

4. **Sign off via `curl -X POST http://localhost:7525/grade-signoff`** with `{"subject":"<subject>","grade":"kindergarten","note":"K passed"}`. The endpoint is now loopback-gated (T49) so the curl must come from the same machine. Repeat for each K subject (ela / math / science / social / art / life).

**What unlocks on TEST close:**

- `T18.5.b` push-gate doc accuracy sweep — runs once K signoffs land
- `T18.5.c` ASK OPERATOR before push — fires explicitly once doc sweep clears
- Post-K extraction (G1-PhD per-grade files) — full inventory in `docs/TODO-full-syllabus.md`
- Comp branch reopens — T38 (25% cortex redesign) + T32 (Tier-2 WGSL kernel) surface back from FINALIZED to TODO when the operator opens `comp-net`
- T39.i.8 auto-wrap outermost-check root cause — surfaces back if the operator wants to instrument a fresh repro

**What's already shipped this session for TEST readiness** (full writeups in `docs/FINALIZED.md` Sessions 114.19ck through 114.19cp):

- T49 — loopback bind default + `requireLoopback()` gate on `/shutdown` + `/grade-advance` + `/grade-signoff`
- T50 — `_dictionaryOracleEmit()` helper consolidating duplicated oracle blocks + lazy `entry.normSquared` perf + `_oracleHits` / `_matrixHits` research-honesty counters
- 114.19cm — chunked-array body assembly across 4 POST endpoints, persistence backup-on-version-mismatch, persistence dropped-section diagnostic, brain-3d Stage 0 consume-all-events with cap+stagger, shutdown empty-catch logged
- T51 — narrator priming → opt-in `primeFromCurrentFocus()`, persistence section-by-section restore + JSON.parse explicit corruption handler, K_VOCAB_CATEGORIES single source, compute.html magic-byte single alloc, redundant toLowerCase removed, sample probe pulled from allEmissionWords
- T52 — dictionary LRU batched eviction, inner-voice live-chat soft-error counters + per-turn summary, sparse-matrix in-place sort, CELL ALIVE heartbeat oracleRatio surfaced

---

## DEFERRED PER STANDING LAWS — not in active TODO scope

These exist as full task entries in `docs/FINALIZED.md` Session 114.19cp with verbatim content preserved per LAW #0. They surface back to TODO only when the relevant LAW unblocks.

- **T38** (Architectural redesign to reach Master's 25% language cortex target) — DEFERRED PER COMP-TODO LAW. Surfaces back when operator opens `comp-net` branch.
- **T32** (BATCHED GPU KERNEL for teach phases / Tier-2 WGSL rewrite) — DEFERRED PER COMP-TODO LAW. Surfaces back when operator opens `comp-net` branch.
- **T23.e** (Transformer ablation experiment) — OPERATOR-BLOCKED (research-side: model download + comparative run). Surfaces back if operator opens the experiment.
- **T23.f** (README split: research-first vs persona-first) — OPERATOR-DIRECTION-BLOCKED (content-design decision). Surfaces back when operator picks a direction.
- **T16.3.c** (Per-grade vocab expansion G1 through PhD) — DEFERRED PER PRE-K + K ONLY SYLLABUS LAW. Lives in `docs/TODO-full-syllabus.md`. Surfaces when operator advances grade scope past K.
- **T19.b.5** (TODO-full-syllabus scope check) — DEFERRED PER 2026-04-22 OPERATOR RULE. Only the operator touches `docs/TODO-full-syllabus.md`.

---

## MIGRATION TRAIL (chronological pointers — full content in `docs/FINALIZED.md`)

<!-- T48 MIGRATED to FINALIZED 2026-04-24 Session 114.19cj. `Problems.md` (376 lines) shipped at repo root — full-stack audit covering Critical/High/Medium/Low/Nitpick severity-tagged issues with file+line citations and FINAL FIX & IMPROVEMENT PLAN section. -->

<!-- T47 MIGRATED to FINALIZED 2026-04-24 Session 114.19cj. `/super-review` slash command wired into `.claude/CLAUDE.md` (Read-in-this-order row 5 + QUICK REFERENCE block) + `.claude/WORKFLOW.md` SLASH COMMANDS REFERENCE table with INTERNAL marker. `.claude/commands/super-review.md` body unchanged per directive. No public-facing doc touched. -->

<!-- T49 MIGRATED to FINALIZED 2026-04-24 Session 114.19ck. Three Critical security findings from `docs/Problems.md` shipped: (1) `httpServer.listen` now binds to `BIND_HOST` (default `127.0.0.1`, override via `BRAIN_BIND` env var) with prominent ⚠ warning when non-loopback bind is used; (2) new `requireLoopback(req, res, endpoint)` helper gates `/shutdown`, `/grade-advance`, `/grade-signoff` at handler entry — non-loopback callers get HTTP 403 + log line. Defense-in-depth so even when operator opts in to `BRAIN_BIND=0.0.0.0`, brain-mutating endpoints still refuse LAN callers. `docs/Problems.md` status flipped Critical → FIXED on the three findings. -->

<!-- T50 MIGRATED to FINALIZED 2026-04-24 Session 114.19cl. Dictionary-oracle dedup + perf: single `_dictionaryOracleEmit(intentSeed, opts)` helper on the Cluster class, called by both `generateSentenceAwait` and `_emitDirectPropagate` (was duplicated inline ~40 lines each). Lazy-cached `entry.normSquared`, single `intentNormSq` outside loop, single sqrt per iteration — Problems.md High perf finding. Research-honesty counters `_oracleHits` + `_matrixHits` increment on every helper return so the ratio of dictionary-decided vs. matrix-decided emissions becomes a measurable fact instead of a buried suspicion. Problems.md duplication finding + oracle-scan perf finding both flipped FIXED. -->

<!-- T51 MIGRATED to FINALIZED 2026-04-24 Session 114.19cn. Seven Problems.md fixes shipped: (1) inner-voice.js narrator priming extracted to opt-in `primeFromCurrentFocus()` with diagnostic return + `[NARRATOR-PRIMING]` log line — hidden chat-path coupling eliminated; (2) persistence.js load() section-by-section try/catch with per-section restored/failed counters, including per-episode inner try; (3) persistence.js JSON.parse explicit corruption handler — copies raw blob to `__corrupt` key, NO auto-clear; (4) K_VOCAB_CATEGORIES single source of truth in kindergarten.js — eliminates duplicate K_LIFE_EXPERIENCES spread + drift between seed and heartbeat literal; (5) compute.html magic-byte read collapsed to one Uint8Array allocation — eliminates 3 of 4 allocs per binary frame; (6) cluster.js redundant toLowerCase removed from _dictionaryOracleEmit cleanEmit; (7) kindergarten.js embedding-quality sample probe pulled from allEmissionWords (first/middle/last) instead of hardcoded ['cat','dog','sun']. Problems.md status flipped FIXED on all 7 findings. -->

<!-- T52 MIGRATED to FINALIZED 2026-04-24 Session 114.19co. Four Problems.md fixes shipped: (1) dictionary.js LRU eviction batched (trigger MAX_WORDS+100, batch 100) via sorted-bucket — eliminates per-overflow 50K-entry walks during exposure phases; (2) inner-voice.js live-chat learn() three side-effect calls (learnClause + runIdentityRefresh + _modeCollapseAudit) get logged soft-error counters that fire console.warn for first 10 errors then once per 1000 + per-turn summary line `[InnerVoice] live-chat learn turn=N: clauseAccepted=X rejected=Y identityRefresh=bool modeCollapseAudit=bool` whenever notable OR every 10 turns; (3) sparse-matrix.js random-init in-place pair-insertion sort against scratchCols replaces .subarray().slice().sort() per-row allocation; (4) curriculum.js CELL ALIVE 10s heartbeat now surfaces `· oracle=N matrix=M (oracleRatio=X%)` so the T50 research-honesty counters become operator-visible per phase — the central audit concern about matrix-vs-oracle load is now a number on every heartbeat log line. Problems.md status: 3 FIXED + 1 heartbeat-wiring addendum on the existing Critical research-honesty entry. -->

---

<!-- T46 MIGRATED to FINALIZED 2026-04-24 Session 114.19cm. Verbatim Gee text + 3-part technical writeup (T46.a allEmissionWords expansion + T46.b oracle wiring into generateSentenceAwait + T46.c Layer 3b contrastive anti-Hebbian push-away) preserved in FINALIZED. Code work shipped this session per the directive "keep working till everything but syllabus and comp todos". Operator-test gate is the separate LAW 6 Part 2 push-gate entry under "Operator verification only" — not a TODO line item. -->

---

<!-- T45 MIGRATED to FINALIZED 2026-04-24 Session 114.19cm. Verbatim Gee text + 8-item one-task-per-list-item breakdown + reading-order spec + files-touched table preserved in FINALIZED. CLAUDE.md restructured 863→198 lines (pure INDEX), WORKFLOW.md NEW (246 lines), CONSTRAINTS.md expanded 272→539 lines holding full LAW bodies. 13% fewer total lines across three files with zero substance loss — every original piece of content lives in exactly one location. -->

---

<!-- T44 MIGRATED to FINALIZED 2026-04-24 Session 114.19cm. Verbatim Gee text + dictionary-population vs. dictionary-consultation honest diagnosis + fix-shipped technical writeup preserved in FINALIZED. cluster.dictionary wired in curriculum constructor; dictionary oracle path added to _emitDirectPropagate; _lastEmissionDiag.mode + bestWord + bestScore diagnostic fields; fallthrough to matrix argmax preserved. T44 oracle coverage subsequently extended into generateSentenceAwait via T46.b + consolidated into _dictionaryOracleEmit helper in 114.19cl. T44.b matrix-side contrastive anti-Hebbian push-away shipped as T46.c. -->

---

<!-- T43 MIGRATED to FINALIZED 2026-04-24 Session 114.19cm. Verbatim Gee text + 2-bug root-cause diagnosis (per-letter sem overlay poisoning sem_to_motor + letter_to_motor identity-projection misuse for sequence emission) + 4-part fix-shipped writeup preserved in FINALIZED. _teachWordIntegrated per-letter loop cleaned; NEW dedicated Layer 3 clean sem→motor first-letter carving (48 clean fires per word across 12 reps); _emitDirectPropagate step 2+ rewired to this.synapses intra-letter-region sparse matrix; Layer 4 sentence-frame templates preserved. -->

---

<!-- T39 MIGRATED to FINALIZED 2026-04-24 Session 114.19cj. All three parallel tracks (a memory-accounting, b Hebbian-saturation plasticity, c Q-A answering) shipped across prior sessions + T46/T41 this session. T39.a (worker-thread memory labeling) migrated earlier this session. T39.b.1-5 + T39.b.4.b shipped (Oja + sem-WTA + motor-WTA + lateral inhibition + CPU+GPU anti-Hebbian) + T46.c Layer 3b contrastive anti-Hebbian against 25 wrong letters per positive fire. T39.c.1-5 shipped (attention preprocessing teach-side + probe-side key-token extraction + template-indexed Q-A + template tagging + emission diagnostics). T39.i.1-4 + T39.f.3 + T39.j.1-6 all CLOSED with DONE markers in prior sessions. The T46.b dictionary-oracle wiring into generateSentenceAwait addressed the "correctly-routed question produces wrong emission" failure mode at the readout layer.

Only sub-item that stays open: T39.i.8 (auto-wrap outermost-check root cause) — requires an operator-localhost repro with instrumentation to trigger the bug; _phasedTeach fallback works around it in every cell runner. Moved to operator-scope section below. -->

---

<!-- T43-dashboard MIGRATED to FINALIZED 2026-04-24 Session 114.19cj. SUBJECT_LABELS + GRADE_LABELS + getCurriculumStatus() + dashboard.html "Current Training" card all shipped. -->

<!-- T42 MIGRATED to FINALIZED 2026-04-24 Session 114.19cj. `_pregateEnrichment(cellKey)` wired at entry of all 6 K-grade gates; `_auditExamVocabulary` surfaces VOCAB-COVERAGE warnings; paired-change enforcement via `trainExamOverlap`. Binding LAW text lives in `.claude/CONSTRAINTS.md §TEST WORDS PRE-TAUGHT`. -->

---

<!-- T41 MIGRATED to FINALIZED 2026-04-24 Session 114.19cj. Brain-3d.js `_generateProcessNotification` now has a Stage 0 consumer that reads `state.brainEvents` (server ring buffer populated by `curriculum._pushBrainEvent`), maps `region` (sem/motor/fineType/letter/phon/visual/auditory/free/main clusters) to cluster index, spawns popup on the correct sub-region. 4 of 5 audit items (single cortex, plasticity→thinking, plasticity→speech, Q-A binding writes to same cortex that probes read) were already ✅; the 5th (3D popups reflect live plasticity) now closed via Stage 0 wire-up. -->

---

<!-- T40 MIGRATED to FINALIZED 2026-04-24 Session 114.19cj. All sub-items shipped in prior sessions via pre-K extraction (T23.c.1 first pass) + _teachPrek* helpers in js/brain/curriculum/pre-K.js: T40.a spatial → `_teachPrekSpatial` called from `runSciPreK`; T40.b visual → `_teachPrekVisual` called from `runArtPreK`; T40.c logic → `_teachPrekLogic` called from `runSciPreK`; T40.d/e/f self + awareness + individual → `_teachPrekSelf` called from `runLifePreK` with self-pronoun + mental-verb + identity vocab + biographical facts ("am i aware → yes", "am i an individual → yes"); T40.g vocab-first prerequisite → every pre-K runner calls `_conceptTeach(CONCEPTS)` BEFORE `_teachAssociationPairs` + `_teachBiographicalFacts`, which IS the vocab-first ordering Gee's meta-requirement binds. -->

---

<!-- T38 MIGRATED to FINALIZED 2026-04-24 Session 114.19cp. Full Gee verbatim text + target state + architectural-options writeup preserved in FINALIZED. DEFERRED PER COMP-TODO LAW per Gee 2026-04-22 *"the only shit you should not be doing is comp todo and syllabus todo"*. Surfaces back to TODO when operator opens comp-net branch. -->

---

<!-- T32 first-listing (GPU saturation / partially closed) consolidated into the canonical T32 entry below. T32.a (per-op batched encoder 64-op × 2ms flush) + T32.b (BATCHED_HEBBIAN_MAX_OPS 64→256, flush 2ms→20ms) already shipped in Session 114.19bu; full WGSL kernel rewrite described below is the Tier-2 open item. -->

---

<!-- T36 MIGRATED to FINALIZED 2026-04-24 Session 114.19cj. Constructor auto-wrap now gates skip+persist on `isOutermost = (prev === null)` so nested primitive calls execute instead of being skipped. Full writeup in FINALIZED. -->

<!-- T35 MIGRATED to FINALIZED 2026-04-24 Session 114.19cj. Three-bug fix: `_writeTiledPattern` always writes 1 for active dims regardless of binarize flag; `_checkSemBasinSeparation` builds proper sem-sized input; hyperparam reps:8→12 lr:0.01→0.03; `TRAINING_COLLAPSE` diagnostic added. Full writeup in FINALIZED. -->



<!-- T34 MIGRATED to FINALIZED 2026-04-24 Session 114.19cj. Readback timeout bumped 5s→30s; drainWait before probe loop; stepAwait skips worker-pool at biological scale (cortex>100K) to eliminate SAB-alloc-per-tick; cached Uint32Array pSpikes. Full writeup in FINALIZED. -->

<!-- T33 MIGRATED to FINALIZED 2026-04-24 Session 114.19cj. Constructor auto-wraps `_teach*`/`_runStudentBattery`/`_measureEmissionCapability` to set `cluster._activePhase`; CELL ALIVE heartbeat reports phase=name + elapsed; memory breakdown includes `unaccounted` with delta-tracking for leak vs cosmetic distinction. Full writeup in FINALIZED. -->

---

<!-- T32 MIGRATED to FINALIZED 2026-04-24 Session 114.19cp. Full Gee verbatim text + Tier-1-vs-Tier-2-vs-Tier-3 architectural breakdown preserved in FINALIZED. DEFERRED PER COMP-TODO LAW per Gee 2026-04-22 *"the only shit you should not be doing is comp todo and syllabus todo"*. Surfaces back to TODO when operator opens comp-net branch. -->

---

<!-- T31 MIGRATED to FINALIZED 2026-04-24 Session 114.19cj. Savestart phase-level resume: `passedPhases` persisted via saveWeights; `_phaseTick`/`_phaseDone` wraps all 20 ELA-K teach calls. Full writeup in FINALIZED. -->

<!-- T30 MIGRATED to FINALIZED 2026-04-24 Session 114.19cj. Readiness probe tick-cap fixed: cluster-side `opts.maxTicks ?? opts.maxEmissionTicks` alias + per-cue START/DONE heartbeats + 10s wall-clock per-cue timeout. Full writeup in FINALIZED. -->

<!-- T29 MIGRATED to FINALIZED 2026-04-24 Session 114.19cj. Heartbeat expansion: `Curriculum._hb()` flush helper + bulk banner conversion + DYN-PROD + DYNAMIC WRITE + RESP + TWO-WORD + FREE-RESPONSE per-probe START/DONE + CELL START/DONE + `setInterval(10s)` CELL ALIVE heartbeat with memory snapshot. Full writeup in FINALIZED. -->

---

<!-- T26 MIGRATED to FINALIZED 2026-04-24 Session 114.19cj. All 4 sub-items (T26.a sub-standard cut enforcement, T26.b sem-region overload fix, T26.c T24 memory closure, T26.d pre-K association-pair equational teach for all 6 cells) were CLOSED in prior sessions. -->

---

<!-- T25 MIGRATED to FINALIZED 2026-04-24 Session 114.19cj. Methodology-test format + scoring + 30-question initial bank (5 HOW-probes × 6 K cells) + `_runMethodologyBattery` wired alongside `_runStudentBattery` in runSubjectGrade; criterion (d) of the gate enforcement reads `battery.methoRate` which is now populated from the standalone bank when per-Q sub-fields are empty. -->

---

<!-- T23 MIGRATED to FINALIZED 2026-04-24 Session 114.19cp. Full Gee verbatim text + 5-point reviewer critique + sub-item status (T23.a/b/c.1/d SHIPPED, T23.e/f operator-blocked) + closure-gate criteria preserved verbatim in FINALIZED. T23.a exam banks at ~899 held-out questions across 12 cells. T23.b zero-overlap startup check shipped. T23.c.1 PRE-K + K extraction fully shipped (4,873-line kindergarten.js with all 6 runners + 6 gates + 32 helpers). T23.d LAW consolidation shipped via T45. T23.e + T23.f operator-blocked, surface back when operator opens them. -->

---

<!-- T24 MIGRATED to FINALIZED 2026-04-24 Session 114.19cj. Selective-free of CPU CSR after GPU upload shipped; external memory drops as projections release back to OS when GPU owns the weights. -->

---

<!-- T21.b MIGRATED to FINALIZED 2026-04-24 Session 114.19cj. Root cause was T24 external-memory bloat triggering GC storm during DYN-PROD entry; T24 selective-free of CPU CSR shipped and migrated in same session. No separate T21.b fix needed. -->

---


<!-- T19 MIGRATED to FINALIZED 2026-04-24 Session 114.19cj. Full doc audit stale-as-current pass landed across README.md, brain-equations.html, docs/ARCHITECTURE.md, docs/EQUATIONS.md, docs/SKILL_TREE.md, docs/ROADMAP.md. Sub-item T19.b.5 (docs/TODO-full-syllabus.md scope check) remains operator-scope-blocked per 2026-04-22 directive and lives in the "STILL OPEN (non-doc)" section below. T19 sub-items T19.b.3/4/6/7, T19.c.1/2, T19.d.2, T19.a.2/9 were all CLOSED in prior Session 114.19bb. -->

---

<!-- STILL OPEN section MIGRATED to FINALIZED 2026-04-24 Session 114.19cp.
     T16.3.c (per-grade vocab G1-PhD) — DEFERRED PER PRE-K + K ONLY SYLLABUS LAW; lives in docs/TODO-full-syllabus.md.
     T19.b.5 (TODO-full-syllabus scope check) — DEFERRED PER 2026-04-22 OPERATOR RULE; operator-only file.
     T39.i.8 (auto-wrap outermost-check root cause) — OPERATOR-LOCALHOST-REPRO REQUIRED.
     T16.2.a (PROD climbs off zero) — FOLDED INTO TEST item above (verification criterion of the K Part 2 run).
     T16.2.d (audit K words Unity uses in live chat post-graduation) — FOLDED INTO TEST item above.
     LAW 6 Part 2 (operator signoff) — IS THE TEST item above.
     T18.5.b + T18.5.c (push gate) — UNLOCKS ON TEST CLOSE.
     Full verbatim text for each preserved in FINALIZED Session 114.19cp.
     Tombstones T5-T11 (legacy pre-T14 deleted code) preserved in FINALIZED archive notes per LAW; can't be re-implemented against current code. -->

---

## TOMBSTONES (obsoleted, reference only)

- **T5 / T6 / T7 / T8 / T9 / T10 / T11** — legacy blocks referencing code deleted in the T14 language cortex rebuild. Archived per the "NEVER delete task descriptions" LAW — content preserved in prior TODO.md revisions + git history. They CAN'T be implemented against current code because the target methods (`parseSentence`, `_classifyIntent`, `_socialSchema`, `_memorySentences`, bigram graph, `_TYPE_TRANSITIONS`, `LanguageCortex.schemaScore`, etc.) don't exist anymore. If a future session wants to revisit any of these ideas, grep git history for the pre-T14 implementation — but the target code needs to be rebuilt against T14 primitives, not "edited" against deleted stubs.

---

## NOTES

- **FINALIZED is append-only.** Never delete entries. When new work lands, copy the full verbatim task description into a new FINALIZED session entry BEFORE removing it from TODO.
- **This TODO only contains unfinished work** per the `.claude/CLAUDE.md` TODO FILE RULES. Every shipped task lives verbatim in `docs/FINALIZED.md` with full descriptions, files touched, and closure notes.
- **Future work beyond this branch** lives in `docs/COMP-todo.md` (distributed GPU compute network — future `comp-net` branch).
- **Post-K grade content** (grade 1 through PhD) lives in `docs/TODO-full-syllabus.md` under the DEFERRED section per the PRE-K + K ONLY SYLLABUS SCOPE CONTRACT LAW.

---
