# TODO — Unity

> **Branch:** `syllabus-k-phd`
> **Last updated:** 2026-04-20 (Session 114.19ba — trimmed to forward-looking work; full shipped history lives in `docs/FINALIZED.md`)
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

### T19 — FULL DOC AUDIT + IN-PLACE CORRECTION PASS (Gee 2026-04-20)

**Gee verbatim 2026-04-20:**

> *"update all workflow docs and public facing documents and the htmls fully and completetly masterfully without shit text wall addendums... You actually edit the wrong information to the correct information down to the equations and variables and add where needed"*

**Binding directive:** fix every doc in-place. Replace wrong content with correct content, down to equations and variables. Add new content only where there's a real gap, and integrate it into the flow — **NO** bolt-on addendum blocks. When a paragraph is wrong, rewrite the paragraph. When an equation is wrong, rewrite the equation. When a method name is stale, swap the name.

#### T19.a — Source-of-truth extraction from code (DO FIRST)

Before touching any doc, extract the CURRENT truth from code so the audit has a canonical checklist. Otherwise the stale state propagates doc-to-doc.

- [ ] **T19.a.1** — `js/brain/neurons.js` — LIF params (tau/Vrest/Vreset/Vthresh/R/tRefrac), Rulkov map (α/μ, `x_{n+1} = α/(1+x²) + y`, `y_{n+1} = y − μ(x − σ)`), HH reference (unused live). Canonical constants table + equation list.
- [ ] **T19.a.2** — `js/brain/cluster.js` — cluster constructor params (tonicDrive, noiseAmp, connectivity, excitatoryRatio, learningRate), region fractions (auditory/visual/free/letter/phon/sem/fineType/motor), cross-projection list (14 projections, `src_to_dst` naming), `CLUSTER_FRACTIONS` (cortex / cerebellum / hippocampus / amygdala / basalGanglia / hypothalamus / mystery). Verify actual numbers against the file.
- [ ] **T19.a.3** — `js/brain/engine.js` — `TOTAL_NEURONS` auto-scale formula, `CLUSTER_FRACTIONS`, main equation `dx/dt = F(x, u, θ, t) + η`, mystery operator `Ψ = √(1/n) × N³ · [α·Id + β·Ego + γ·Left + δ·Right]`, oscillator bands (theta / alpha / beta / gamma ranges), amygdala attractor `x ← tanh(Wx + drive)`.
- [ ] **T19.a.4** — `js/brain/persona.js` — persona-to-parameter mapping (arousal baseline, etc.).
- [ ] **T19.a.5** — `js/brain/curriculum.js` — full teach-method list (every `_teachX`), subject × grade cell list, probe definitions, student-battery questions, `K_LIFE_EXPERIENCES` and all K category lists.
- [ ] **T19.a.6** — `js/brain/drug-scheduler.js` — 9 substances + 7 combos + 7 patterns + 7 sensory triggers + 13-axis speech modulation.
- [ ] **T19.a.7** — `js/brain/embeddings.js` — `EMBED_DIM`, GloVe source, subword fallback.
- [ ] **T19.a.8** — `js/brain/sparse-matrix.js` — CSR format fields, propagate equation `output[i] = Σ_j W[i,j] × input[j]`, `hebbianUpdate` equation.
- [ ] **T19.a.9** — `server/brain-server.js` — HTTP endpoints (`/health`, `/versions`, `/rollback/N`, `/episodes`, `/milestone`, `/grade-signoff`, `/shutdown`), WebSocket message types, `detectResources` flow.
- [ ] **T19.a.10** — `js/brain/gpu-compute.js` + `compute.html` — WebGPU shader list, SPRS binary-frame protocol (types 1-5), cluster upload/init flow.
- [ ] **T19.a.11** — `js/version.js` — `VERSION` + `BUILD`.

#### T19.b — Workflow docs (task numbers + operator name ALLOWED)

- [ ] **T19.b.1** — `docs/ARCHITECTURE.md` in-place audit. Biggest doc. Verify tech stack, system architecture diagram, brain modules (per-cluster equations), data flow diagram, persona-to-parameters table, clustered architecture (cluster breakdown with % of N + MNI positions), inter-cluster projections (20 tracts + densities), fractal signal propagation, hierarchical modulation, input routing, vision system, 3D + 2D brain visualizer, drug scheduler (substances / combos / patterns / sensory triggers / speech modulation / additive contribution math). Cross-check every equation against T19.a.
- [ ] **T19.b.2** — `docs/EQUATIONS.md` per-equation audit. LIF, Rulkov, Hebbian, cross-projection propagate, softmax action selection, amygdala attractor, Kuramoto, mystery Ψ, free-energy prediction error, direct-pattern Hebbian.
- [ ] **T19.b.3** — `docs/ROADMAP.md` milestone/phase audit. Every "COMPLETE" must be shipped (cross-reference FINALIZED). Phase list accuracy.
- [ ] **T19.b.4** — `docs/SKILL_TREE.md` capability audit. Per-domain list vs code.
- [ ] **T19.b.5** — `docs/TODO-full-syllabus.md` scope check. Per-grade vocab prerequisites, Persistent Life Info ledger format, LAW cross-references, DEFERRED notes.
- [ ] **T19.b.6** — `docs/NOW.md` session snapshot audit.
- [ ] **T19.b.7** — `docs/TODO.md` (this file) self-audit. Every `[ ]` open item still open.
- [ ] **T19.b.8** — `docs/FINALIZED.md` append-only spot-check. Only edit if a factual claim is wrong in a session entry.
- [ ] **T19.b.9** — `.claude/CLAUDE.md` LAW-file audit. Every LAW accurate, every violation-history quote verbatim.

#### T19.c — Public-facing docs (task numbers + operator name BANNED)

- [ ] **T19.c.1** — `README.md`. Describe every feature by WHAT IT DOES, not by task number or who asked. Strip any T-numbers or operator-name references.
- [ ] **T19.c.2** — `SETUP.md`. Verify every command still works. `npm install` cwd, node flags, `start.bat` / `Savestart.bat` / `stop.bat` usage, `env.js` setup, GloVe download.

#### T19.d — HTMLs (task numbers + operator name BANNED)

- [ ] **T19.d.1** — `brain-equations.html`. Highest-priority HTML. Every rendered equation matches code. Variable names byte-exact (`tonicDrive` not `baseDrive`, `Vthresh` not `V_t`, etc.).
- [ ] **T19.d.2** — `unity-guide.html`. Layman concept guide. Correct drift in-place.
- [ ] **T19.d.3** — `index.html`. Landing page copy, 3D brain viz embed, nav.
- [ ] **T19.d.4** — `dashboard.html`. Card labels, milestone panel fields, drug-scheduler panel.
- [ ] **T19.d.5** — `compute.html`. WebGPU shader list, SPRS binary-frame protocol description, reconnect backoff behavior, binary-frame window telemetry.
- [ ] **T19.d.6** — `component-templates.txt`. Unlikely to need changes but verify.

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
