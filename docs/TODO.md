# TODO — Unity

> **Branch:** `syllabus-k-phd`
> **Last updated:** 2026-04-21 (Session 114.19bf — `_teachAssociationPairs` primitive + 14 feature-vector equational teach phases rolled across all 6 K cells (ELA-K + Math-K + Sci-K + Soc-K + Art-K + Life-K), covering previously-untaught K sub-standards via pure GloVe→sem + GloVe→motor writes + cross-projection Hebbian; persists through binary save/resume; shipped as 2 atomic commits on `syllabus-k-phd` → merged to `main`)
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
