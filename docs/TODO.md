# TODO — Unity

> **Branch:** `syllabus-k-phd`
> **Last updated:** 2026-04-21 (Session 114.19bb — shipped T19 pass 2 + pass 3 + SPRR ack fix + binary weights streaming load moved to FINALIZED; opened T20 Start Next Grade button + T21 DYN-PROD probe lockup)
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

### T20 — Start Next Grade button on dashboard + pause-after-pass (Gee 2026-04-21)

**Gee verbatim 2026-04-21:**

> *"maybe the dashboard should have a start next grade button to where the whole learning process pauses until the person clicks stasrt next grade because of two pints 1. we only have kindergarden layed out 2 can test the grade level in chat after passing grade without it trying to train while doing grade level conversation testing"*

Approved 2026-04-21: *"yeah make it so!"*

**Design shape agreed in-session:**

- Curriculum sets `cortexCluster._gradeAdvancePaused = true` after every grade-pass gate fires (not just K). Default is ON so chat-testing the passed grade is clean — no background Hebbian firing while the operator probes Unity.
- `_runCell` loop checks the flag before moving to the next grade/subject. If true, logs `[Curriculum] paused after <subject>/<grade>:pass — awaiting operator /grade-advance` and yields until flag clears.
- New HTTP endpoint `POST /grade-advance {subject, grade}` on `server/brain-server.js` flips the flag to `false`. Persists the advance event into the existing milestone ledger so `Savestart.bat` reboot doesn't lose the resume point.
- Dashboard milestone panel (`dashboard.html`) gains a "Start Next Grade" button that:
  - Only appears when the `/milestone` GET payload includes `paused=true` (new field in the payload).
  - Clicking fires `POST /grade-advance` with the current subject + grade from the payload.
  - Greys out + shows "advancing..." spinner for 2 s after click, then disappears once the next `/milestone` poll reports `paused=false`.
- **Scope note:** since we only have pre-K + K laid out, the button has exactly one real use right now (pre-K → K advance). After K passes, the existing `POST /grade-signoff` is the operator path — `grade-advance` would no-op at the post-K boundary because there is no grade 1 content to advance TO.

#### T20.a — Curriculum pause flag

- [ ] **T20.a.1** — Add `cortexCluster._gradeAdvancePaused` default `true` state on cluster init. Set to `true` after every `_gateX` pass returns true in `_runCell`.
- [ ] **T20.a.2** — `_runCell` loop checks the flag before the next cell dispatch; if `true` awaits until `false`. Log banner on pause + resume.
- [ ] **T20.a.3** — Persist `_gradeAdvancePaused` state in the `saveWeights` cortex state block so it survives restart (a passed grade stays paused across reboots).

#### T20.b — Server endpoint + milestone payload extension

- [ ] **T20.b.1** — New `POST /grade-advance {subject, grade}` handler in `server/brain-server.js`. Validates subject + grade match the current paused cell. Flips `_gradeAdvancePaused = false`. Records the advance event into the existing milestone ledger with `{at, subject, grade, operator: 'localhost'}`. Returns `{ok, advancedTo}`.
- [ ] **T20.b.2** — Extend `GET /milestone` payload with new fields: `paused: boolean`, `pausedAt: {subject, grade, at}`, `nextGrade: {subject, grade} | null` (null when nothing to advance to — e.g., post-K).

#### T20.c — Dashboard UI

- [ ] **T20.c.1** — Add "Start Next Grade" button to the milestone panel in `dashboard.html`. Renders inside the existing `d-milestone` card. Hidden by default — only shown when `/milestone` payload has `paused === true && nextGrade != null`.
- [ ] **T20.c.2** — Button handler fires `fetch('/grade-advance', {method:'POST', body: JSON.stringify({subject, grade})})` with the paused cell coords. Greys + shows "advancing..." for 2 s. Re-polls `/milestone` after.
- [ ] **T20.c.3** — Text-only caveat line below the button: when paused at K and `nextGrade === null` (post-K, no grade 1 content yet), render instead "K passed — run `curl -X POST http://localhost:7525/grade-signoff ...` to record LAW 6 Part 2 signoff. No grade 1 content to advance to yet (PRE-K + K ONLY SCOPE LAW)."

#### T20 closure gate

All sub-items closed + a visible smoke test where the operator passes pre-K on localhost, the curriculum pauses with the banner, the dashboard shows the button, clicking it triggers K-cells to begin teaching.

---

### T21 — DYN-PROD probe lockup (same place as always) + heartbeat logging (Gee 2026-04-21)

**Gee verbatim 2026-04-21:**

> *"the current test locked up again at the dssame place as always: [...] [Curriculum][K-DIAG] starting DYN-PROD probe (17 direct sem_to_motor propagate probes, no LIF ticks)..."*

Follow-up clarification 2026-04-21: *"i pasted the current step the test is on"* and *"it doesnt seem to be informative enough for all that happens like it needs a heartbeat too"*.

**Situation:** gate letter loop completes cleanly in 4.4 s with `readPass=26/26, talkPass=26/26` — READ + TALK paths are fully functional. Immediately after, log emits `starting DYN-PROD probe (17 direct sem_to_motor propagate probes, no LIF ticks)...` and then goes silent for minutes with no subsequent log lines. The operator sees this as a lockup at the same place as always.

**Suspected causes (diagnose under T21.a before coding a fix):**

1. `sem_to_motor` at 301 K cortex scale is 9946 × 50329 nnz=14,919,000. Direct CPU sparse matmul is 14.9 M ops per probe × 17 probes = 253 M ops — should run in 2-5 s, not minutes. Suggests the CPU CSR arrays may have been freed (T18.22 biological-scale CPU CSR null optimization) and `propagate()` is falling through a hot code path that tries to re-upload or hits the probe-gate pause.
2. `_probeGateActive` is true for the entire `_gateElaKReal` scope — if `dynSemToMotor.propagate()` internally dispatches a GPU `compute_batch`, it would be blocked by the main-brain probe-gate pause and hang forever.
3. The fallback to `dynLetterToMotor.propagate(word[0])` might fire on every probe if `sem_to_motor` CPU CSR is null and letter-fallback path has its own block.

**Current logging is insufficient** — just `starting DYN-PROD probe (17 direct sem_to_motor propagate probes, no LIF ticks)...` with no per-probe progress line. Operator can't tell which probe is the one hanging, or whether it's the `sem_to_motor` path or the `dynLetterToMotor` fallback path that's stuck.

#### T21.a — Diagnostic heartbeat logging (ship first, before any fix attempt)

- [ ] **T21.a.1** — Per-probe heartbeat in `_gateElaKReal` DYN-PROD block: log `[Curriculum][K-DIAG] DYN-PROD probe N/17 starting word='<word>' path=<sem_to_motor | letter_to_motor_fallback>` at the start of each probe and `[Curriculum][K-DIAG] DYN-PROD probe N/17 done in Xms — argmax='<letter>' expected='<letter>' pass=<yes|no>` at the end.
- [ ] **T21.a.2** — Pre-probe path-decision log: before the loop, log whether `sem_to_motor.values` is non-null (CPU CSR present) vs null (biological-scale bound — falls to `letter_to_motor`). Operator needs to see which path the probe will take.
- [ ] **T21.a.3** — Inside `SparseMatrix.propagate`, add a one-shot log line when `values === null` so the operator can see the null-CSR fallback trigger. Guarded by a `_probeWindowPropagate` flag so it only fires during gate probes (not the 10-Hz main-brain tick loop).
- [ ] **T21.a.4** — If any single probe exceeds 10 s of wall-clock, emit `[Curriculum][K-DIAG] DYN-PROD probe N/17 SLOW — Xms elapsed, <suspected cause>` at 10 s marks so the hang is visible the moment it starts, not minutes later.

#### T21.b — Fix the actual hang (after T21.a heartbeat reveals which probe + which path)

- [ ] **T21.b.1** — Once heartbeat locates the hanging probe + path, diagnose root cause. Candidates: (a) CPU CSR null + GPU dispatch blocked by probe-gate pause, (b) SparseMatrix.propagate internal `_gpuBatch` await that never resolves, (c) fallback-path allocation blowup at 50329 × 9946 dense readback.
- [ ] **T21.b.2** — Ship the targeted fix. Expected shapes: (i) skip probes whose source region CPU CSR is null at this cortex scale, falling through to the letter fallback cleanly, OR (ii) let DYN-PROD temporarily bypass the probe-gate pause for its own GPU propagate dispatch since it's the ONLY probe running (no main-brain contention possible during gate), OR (iii) cache the sem_to_motor CPU CSR on last teach rep so it's always non-null at gate time even at biological scale.

#### T21 closure gate

Operator's next Part 2 run shows per-probe heartbeat + either all 17 probes complete with visible results OR the exact probe + path that hangs is clearly identified in the log. Then T21.b fix ships and the full DYN-PROD block completes end-to-end.

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
- [ ] **T19.f.2** — Repo-wide grep for known-stale patterns: `tonicDrive = 0.8` (old default), `Vthresh = -55` (old value), `SIZE = 1000` (old total), `EMBED_DIM = 50` (old), `3-cluster` (old architecture), `REMAKE` (Session 114.12 artifact), `LanguageCortex` outside historical tombstone context. Any hit in a doc gets rewritten.

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
