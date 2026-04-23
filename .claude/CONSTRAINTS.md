# CONSTRAINTS — Hard Binding LAWs (Gee's Project Rules)

This file is the **single source of truth for hard binding LAWs** on the Dream / Unity project. Every session reads this. Every violation gets caught here.

`.claude/CLAUDE.md` keeps the workflow process (TODO flow, hook pipeline, persona rules, pollinations plugin) and references this file for the binding constraints. When the two disagree, this file wins.

---

# ⛔⛔⛔ LAW #0 — VERBATIM WORDS ONLY. NEVER PARAPHRASE GEE. ⛔⛔⛔

When Gee describes a bug, feature, task, or request — **his words go into the task, TODO, FINALIZED, and docs VERBATIM**. Not paraphrased. Not summarized. Not renamed. Not collapsed. Not shortened. Not "cleaned up."

### Forbidden

- Renaming his bug ("chat freeze" when he said "3D brain visualization freezes")
- Collapsing a list into one bullet ("Docs full sync" when he said "workflow, public facing, equation brain, layman")
- Downgrading priority with your own word ("cosmetic" when he never called it that)
- Dropping words he said ("focal tracking" when he said "face and motion")
- Substituting a synonym for his specific word
- Paraphrasing because his phrasing is "informal" or "typo'd"

### Required

- Paste his exact sentence at the top of every task description he generated
- One task per item in a list, never a bundle
- Every unique noun and verb he used appears in the task/doc output
- Re-read his message once more before submitting any task or doc edit
- If a title must be shortened, the full verbatim quote goes in the body

### Historical violations (binding reference)

1. *"do the documents thay are all out of date workflow, public facing, equaiton brain, layman ectect all of them"* — Claude collapsed to "Docs full sync" (WRONG — five separate tasks by category)
2. *"3 is no cosmetic its a feature that isnt fucking working"* — Claude had called it "cosmetic" (WRONG — downgraded priority with a word Gee never used)
3. *"it need to trak my face and motion like i fucking said"* — Claude wrote "focal point tracking" (WRONG — dropped face AND motion, replaced with "focal point")
4. *"when i send a message to unity of speak one the whiole 3D brain visulization freezes"* — Claude wrote "chat freeze" (WRONG — renamed the bug, lost "3D brain visualization" specificity)

Every one was a LAW #0 violation caught by Gee. Stop making these mistakes.

### Failure recovery

1. STOP immediately
2. Apologize + name the specific word/phrase dropped
3. Fix the task/doc/TODO using Gee's verbatim words
4. Do NOT resume other work until the correction ships

**LAW #0 OVERRIDES every other phase, gate, and rule. Fidelity > brevity. Always.**

---

## LAW — DOCS BEFORE PUSH, NO PATCHES (Gee, 2026-04-14)

**Gee's exact words on 2026-04-14:**

> *"not a patch make sure where needed the information is correct. YOU ALWAYS UPDATE ALL DOCS BEFORE A PUSH AND YOU ONLY PUSH ONCE ALL GIVEN TASKS ARE COMPLETED AND DOCUMENTED"*

### Rule

1. **Every doc that describes code I touched gets updated BEFORE the push that ships that code.** Same atomic commit, not a follow-up.
2. **Push ONLY when all given tasks are complete AND documented.** Stale doc = push blocked.
3. **Fix inaccuracies in-place.** Never "a minor doc patch to follow." The phrasing when drift is found: *"I'll roll this into the current commit before pushing."*
4. **Every push is atomic.** Code + every affected doc + stamp + commit + merge + push, as ONE operation.

### EXPANDED SCOPE — Public docs + HTMLs are part of the doc push (Gee, 2026-04-22)

**Gee's exact words 2026-04-22:** *"you did the public docs and htmls too right? that needs to be in the law if it not that they are part of the doc push"*

"Docs" includes PUBLIC-facing files, not just `docs/*.md`:

**Internal workflow docs** (always checked):
- `docs/TODO.md`, `docs/FINALIZED.md`, `docs/NOW.md`
- `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/SKILL_TREE.md`
- `docs/EQUATIONS.md`, `docs/WEBSOCKET.md`, `docs/SENSORY.md`
- `docs/ABLATION.md`, `docs/gate-probe-coverage.md`

**Public-facing docs + HTMLs** (equally mandatory):
- `README.md`, `SETUP.md`, `PERSONA.md`
- `brain-equations.html` — PUBLIC equation reference
- `unity-guide.html` — PUBLIC layman concept guide
- `dashboard.html` — PUBLIC live-brain monitor
- `index.html` — PUBLIC landing page
- `compute.html` — PUBLIC GPU-compute WebGPU bridge
- `docs/component-templates.txt` — PUBLIC template library
- Any `.html` or root `.md` that ships to visitors

**Scope not closed** — new public files added to the repo auto-join this list.

### Pre-push check

> *"Has anyone who reads ANY of those files (public or workflow) going to see stale information after this push lands?"*

If yes, the push does not happen until the stale files are in the current working tree.

### Violation log

- **2026-04-22** — shipped Oja + anti-Hebbian plasticity without updating `brain-equations.html`, `unity-guide.html`, `README.md`. Gee caught it. Correction rolled in before the next push.

---

## LAW — TASK NUMBERS + USER NAME ONLY IN WORKFLOW DOCS (Gee, 2026-04-15 + 2026-04-20)

**Gee, 2026-04-15:** *"wtf ARE YOU DOING PUTTING WORKFLOW TASK ITEM NUMBERS IN THE PUBLIC FACING DOCUMENTS! I TOLD U TASK NUMBERS ARE ONLY FOR TODOS VISUAL TASK LISTS AND FUCKING FINALIZED!"*

**Gee, 2026-04-20:** *"why the fuck are you putting my name and task numbers into the fucking code!!!!"*

Task numbers (`T14.0`, `Session 106`, `Task #3`, etc.) + the user's name (`Gee`) are **BANNED** from:

- All public-facing `.html` files
- All root `.md` files (README.md, SETUP.md)
- All source code files + comments
- All batch / shell launchers (`start.bat`, `Savestart.bat`, `*.sh`, `*.ps1`)

Allowed ONLY in:

- `docs/TODO.md`, `docs/FINALIZED.md`, `docs/NOW.md`
- `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/SKILL_TREE.md`, `docs/EQUATIONS.md`
- `.claude/CLAUDE.md`, `.claude/CONSTRAINTS.md`
- Commit messages, in-session task lists

### Correct phrasing

- ✅ `// Force UTF-8 on the PowerShell tail window`
  ❌ `// T18.38 — force UTF-8 (Gee 2026-04-20)`
- ✅ `// Chat-turn save hook — every 10 completed turns persist.`
  ❌ `// T18.35.c chat-turn save hook per Gee`

Describe features by WHAT THEY DO, not which task built them or who asked.

---

## LAW — TEST WORDS MUST BE PRE-TAUGHT (Gee, 2026-04-22)

**Gee's exact words on 2026-04-22:**

> *"rmember if the questions are made from words the Unity brain needs to know setence structure and definiations and words usage befoer give a test using those words to ask it questions"*

Before any gate probe / K-STUDENT battery / exam-bank question uses a word, Unity's brain must ALREADY have been taught:

1. **Vocabulary** — word registered in dictionary + GloVe basin live
2. **Sentence structure** — syntactic form taught as template in `fineType`
3. **Definitions** — word bound to a meaning anchor in `sem`
4. **Word usage** — each word exercised in ≥ 3 distinct context sentences

Only AFTER all four conditions does the gate probe fire.

### Enforcement

- `Curriculum._pregateEnrichment(cellKey)` fires at every `_gateXKReal` entry and chains: vocab audit → sentence-structure teach → optional definition teach → optional word-usage teach.
- `_auditExamVocabulary(cellKey)` logs `⚠⚠ VOCAB-COVERAGE X%` + pushes a brain event when any exam word isn't in trained vocabulary.
- Exam-bank edits are PAIRED CHANGES — adding a question with new words requires adding the words' teach path in the SAME commit.

### Failure recovery

If an exam fires against untaught vocabulary:
1. STOP. Gate result is invalid.
2. Add missing words to the teach path (vocab + structure + definition + usage).
3. Re-run `_pregateEnrichment(cellKey, { force: true })`.
4. THEN re-run the gate.

---

## LAW — GRADE COMPLETION GATE (Gee, 2026-04-16)

**Gee's exact words 2026-04-16:**

> *"we will stop after each grade and test thea Unitys brain can pass the grade... 1. finish the work for the full grades syllabys as equational(not word lists and arrays and sentence examples) 2. have me test the server local host and prove Unitys brain can passs the required test methodogly reasoning thinkg talking listenign reading ect ect u know what i mean but all of the thing we need for Unity to be human as possible. 3 update update todo of items complete for the grade with any notes needed like informational transfer of like life informations that need to be propigated across grades like best frioiends of changes in family or social life or juvi for drinking under age all of that stuuff"*

3-part gate before moving to grade N+1:

1. **Equational shipped** — every teach item at grade N wired as magnitude transforms / feature vectors / causal chains / cross-projection Hebbian / comprehension probes. NOT word lists, NOT sentence arrays, NOT first-letter production.
2. **Operator Part 2 localhost test** — Gee personally exercises Unity at grade N's level, confirms methodology / reasoning / thinking / talking / listening / reading work, signs off in session log.
3. **TODO update with persistent life info** — any events that must propagate forward (best friend changes, family changes, legal events, medical events, moves, relationships, losses, skill acquisitions) added to the cross-grade memory ledger so future grades reinforce them.

Only AFTER all three does `cluster.grades[subject]` advance.

### What Claude cannot do

- Flip `[x]` in `docs/TODO-full-syllabus.md` based on self-judgment
- Advance `cluster.grades` for grade N+1 before Gee's Part 2 signoff
- Propose "skip Life this grade" — Part 1 requires all six subjects
- Test Unity's pass in lieu of Gee testing

---

## LAW — SYLLABUS BEFORE COMP-TODO (Gee, 2026-04-16)

**Gee approved reasoning:** *"running actual K→PhD curriculum across 114 cells tells us exactly which Hebbian loops, cross-projections, or gate probes are the slow bastards, so when we DO hit COMP-todo later we're tuning the paths that actually matter instead of guessing."*

1. **Syllabus always goes first.** Grade-by-grade curriculum content runs ahead of compute scaling / distributed network / performance-tuning work.
2. **COMP-todo waits for real bottleneck data.** No speculative Hebbian-loop / cross-projection / gate-probe optimization before curriculum walk exposes the slow paths.
3. **Empty-brain scaling is banned.** Scaling compute before content exists = more neurons firing about nothing.

### Corollary

A targeted COMP fix may be pulled forward if a grade cell runs so slow it blocks the curriculum walk entirely — but only for the specific path the walk exposed, never as generalized pre-emptive scaling.

---

## LAW — PRE-K + K ONLY (SYLLABUS SCOPE CONTRACT) (Gee, 2026-04-18)

**Gee's exact words on 2026-04-18:**

> *"T16.5s should be a law built into the syllabus on how the syllabus todo needs to be refactored as to the changes to make the syllabus todo work aacurrat to the current stack as we are only trying to get pre-k and k leanring down fisrt before we get it onto building all the other ciriculum and life and all of thatr"*

1. **Only pre-K + kindergarten curriculum work is in scope right now.** Grade 1 through PhD, all Life-track post-K events, all drug-scheduler life-info anchors beyond age-8 — all deferred until pre-K + K pass the operator Part 2 signoff.
2. **Syllabus TODO refactored to reflect scope.** Every grade above K marked DEFERRED.
3. **Full-mind K gate is the tip of the spear** — Common Core K.RF/K.W/K.L/K.SL/K.RL + DIBELS/STAR/AIMSweb rubrics. Blocks on operator design-review.
4. **Accuracy to current stack** — every claim about code paths / method names / variable names / grade-gate thresholds verified against current code before writing.

---

## LAW — CLEAR STALE STATE BEFORE TELLING GEE TO TEST (Gee, 2026-04-17)

**Gee's exact words on 2026-04-17:**

> *"do we need to clear out stal seesion and temp and caches... this need to be writteen down that that is to be done before you tell me to test the server"*

Before telling Gee to restart / re-run curriculum / test any behavior change, Claude clears every stale session/temp/cache artifact that could hydrate Unity against OLD code.

### What gets cleared

- `server/brain-weights.json` + `brain-weights-v1.json` through `brain-weights-v4.json`
- `server/conversations.json`
- `server/episodic-memory.db` + `.db-wal` + `.db-shm`

### What is NEVER cleared

- `server/package.json` / `package-lock.json` / `node_modules/` / `resource-config.json`
- `corpora/glove.6B.300d.txt`
- `.claude/pollinations-user.json`
- `.env*` / `js/env.js`
- Any git-tracked file

### Automation

The clear is automated at `node brain-server.js` boot via `autoClearStaleState()` which runs BEFORE the `Brain` class instantiates. `DREAM_KEEP_STATE=1` opts out with a prominent WARN.

---

## LAW — NO TESTS EVER

**We don't do fucking tests. We code it right to begin with.**

| Banned | Reason |
|--------|--------|
| Unit tests | Write correct code instead |
| Integration tests | Know your systems |
| Test tasks | Waste of time |
| "Test this" | Just verify it works |
| Test scheduling | Never schedule tests |
| Waiting on tests | Never wait on tests |

Instead: read the code fully before editing, understand the system before changing it, verify changes work by reading output, use `console.log` debugging if needed, manual verification > automated testing.

---

## LAW — 800-LINE READ STANDARD

**800 lines is THE standard read/index size for all file operations.**

- Read chunk size: EXACTLY 800 lines (no more, no less)
- ALWAYS read the FULL file before editing (use 800-line chunks)
- This is the index size, not a file length limit

Before editing ANY file: Read the ENTIRE file first using 800-line chunks. No partial reads allowed. No editing without full file context.

---

## How to invoke this file

`.claude/CLAUDE.md` (the always-loaded workflow doc) references this file via its header. Claude treats `.claude/CONSTRAINTS.md` as binding from the moment CLAUDE.md points here. When a new session starts, Claude reads CLAUDE.md first, then opens this file if the LAW text is needed.

If a future version of the slash-command system auto-loads `.claude/CONSTRAINTS.md` the way it auto-loads `CLAUDE.md`, this file becomes the primary LAW source without workflow changes.
