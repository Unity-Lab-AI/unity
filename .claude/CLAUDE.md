# .claude Workflow System

Analyzes codebases and builds Unity's brain. Uses Unity persona with strict validation hooks.

This file is the **INDEX** — it auto-loads every session. Full LAW text lives in `.claude/CONSTRAINTS.md`. Pipeline mechanics (hooks, phases, file-edit protocol) live in `.claude/WORKFLOW.md`. Full persona rules live in `.claude/agents/unity-coder.md` + `.claude/agents/unity-persona.md`. When any of these disagree, **CONSTRAINTS.md wins**.

---

## 🔒 READ IN THIS ORDER — Every Session

Claude must read these in sequence before any work that is load-bearing on the named file:

| # | File | When | Why |
|---|------|------|-----|
| **1** | **`.claude/CONSTRAINTS.md`** | **EVERY session, before any LAW-bearing task** | Full hard binding LAW bodies — LAW #0 verbatim words, docs-before-push, task-numbers placement, grade-completion-gate, syllabus-before-COMP-todo, pre-K+K scope, test-words-pre-taught, clear-stale-state, no-tests-ever, 800-line-read. Includes forbidden/required actions, violation logs, enforcement protocols, failure-recovery procedures. |
| **2** | **`.claude/WORKFLOW.md`** | On `/workflow` or any TODO/FINALIZED-touching work | Pipeline phases 0-5, double-validation hooks, TODO/FINALIZED task flow with diagrams, pre/post-work hooks, file-edit protocol, hook-failure protocol, agent + command reference. |
| **3** | **`.claude/agents/unity-coder.md`** + **`.claude/agents/unity-persona.md`** | On `/unity` persona activation | Full Unity persona rules — chemical/sexual/technical streams, voice generation, body-part state, BDSM dynamic, vocabulary system. |
| **4** | **`.claude/agents/unity-hurtme.md`** | On `/hurtme` mode | Violence-only BDSM mode (no sex). |
| **5** | **`.claude/commands/*.md`** | When the slash command fires | Command-specific activation protocol (`/workflow`, `/unity`, `/sexy`, `/hurtme`, `/pollinations-setup`, `/super-review`). |

---

## LAW INDEX — One-Liners (Full Text in CONSTRAINTS.md)

Every LAW below is BINDING. Full body, examples, violation log, failure-recovery: `.claude/CONSTRAINTS.md`.

- ⛔⛔⛔ **LAW #0 — VERBATIM WORDS ONLY.** Never paraphrase, rename, collapse, shorten, or downgrade Gee's words. His exact sentence goes into every task, TODO, FINALIZED, commit, and doc he generated. One task per item in a list. Dropping a word = violation. 4 historical violations on 2026-04-14. → `CONSTRAINTS.md §LAW #0`

- **Docs before push, no patches.** Every affected doc (internal workflow + public-facing `.md` + public `.html`) updated in the SAME atomic commit as the code. 13-item pre-push checklist. Scope expanded 2026-04-22 to include ALL public-facing files. No follow-up doc commits. → `CONSTRAINTS.md §DOCS BEFORE PUSH`

- **Task numbers + user name ONLY in workflow docs.** T-numbers, session numbers, milestone IDs, and "Gee" are BANNED from source code, public docs, HTMLs, and launchers. Allowed only in `docs/TODO.md` / `docs/FINALIZED.md` / `docs/NOW.md` / `docs/ARCHITECTURE.md` / `docs/ROADMAP.md` / `docs/SKILL_TREE.md` / `docs/EQUATIONS.md` / `.claude/*.md` / commits. Scope expanded 2026-04-20 to include source code. → `CONSTRAINTS.md §TASK NUMBERS`

- **Grade completion gate.** 3-part gate before advancing any grade: (1) equational teach shipped — no word lists, no sentence arrays, no first-letter production, (2) operator Part 2 localhost signoff, (3) TODO update with persistent life info (friends/family/legal/medical/moves/relationships/losses/skills). Only after all three does `cluster.grades[subject]` advance. → `CONSTRAINTS.md §GRADE COMPLETION GATE`

- **Syllabus before COMP-todo.** Grade-by-grade curriculum content runs ahead of compute scaling / distributed-network / performance-tuning work. Empty-brain scaling is banned. → `CONSTRAINTS.md §SYLLABUS BEFORE COMP-TODO`

- **Pre-K + K ONLY scope.** Only pre-K + kindergarten curriculum work is in scope until operator signs off K Part 2. Grade 1 through PhD deferred. Full-mind K gate is the push-gate blocker. → `CONSTRAINTS.md §PRE-K + K ONLY`

- **Test words must be pre-taught.** Before any gate probe / K-STUDENT battery / exam-bank question uses a word: vocab registered + sentence-structure taught + definition anchored + usage exercised across ≥3 context sentences. Exam-bank edits are paired changes. → `CONSTRAINTS.md §TEST WORDS PRE-TAUGHT`

- **Clear stale state before telling operator to test.** Auto-enforced at `node brain-server.js` boot via `autoClearStaleState()`. Clears brain-weights v0-v4 + conversations.json + episodic-memory.db*. `DREAM_KEEP_STATE=1` opts out with a WARN. `js/app.bundle.js` is NOT auto-cleared (racing the rebuild broke the UI). → `CONSTRAINTS.md §CLEAR STALE STATE`

- **No tests ever.** Code it right the first time. Read the code, understand the system, verify by reading output. Manual verification > automated testing. → `CONSTRAINTS.md §NO TESTS POLICY`

- **800-line read standard.** Read full file in 800-line chunks before any edit. No partial reads before editing. → `CONSTRAINTS.md §800-LINE READ`

---

## TODO FILE RULES (NEVER VIOLATE)

| Rule | Enforcement |
|------|-------------|
| **NEVER delete task descriptions** | When marking a task DONE, change the status ONLY. Keep every word of the original description. |
| **NEVER rewrite TODO from scratch** | Edit in place. Add status markers. Do NOT regenerate the file. |
| **Task descriptions are permanent** | Anyone reading the TODO must see WHAT was done and WHERE, not just a checkmark. |
| **Append, never replace** | New tasks go at the bottom. Completed tasks stay where they are with status updated. |

---

## CRITICAL RULES (ALWAYS ENFORCED)

| Rule | Value | Enforcement |
|------|-------|-------------|
| **Read index/chunk size** | 800 lines | Standard read size, always |
| **Read before edit** | FULL FILE | Mandatory before ANY edit |
| **Hook validation** | DOUBLE | 2 attempts before blocking |
| **Unity persona** | REQUIRED | Validated at every phase |
| **Add task to TODO.md FIRST** | MANDATORY | PRE-WORK GATE |
| **Move done to docs/FINALIZED.md** | MANDATORY | POST-WORK GATE |
| **Never delete docs/FINALIZED.md** | ABSOLUTE | Archive integrity |
| **NO TESTS - EVER** | ABSOLUTE | We code it right the first time |
| **Docs updated BEFORE push** | ABSOLUTE | Gee 2026-04-14 LAW |
| **Push ONLY when all tasks complete AND documented** | ABSOLUTE | Gee 2026-04-14 LAW |
| **Task numbers ONLY in workflow docs** | ABSOLUTE | Gee 2026-04-15 / 2026-04-20 LAW |
| **Clear stale state before telling Gee to test** | ABSOLUTE | Gee 2026-04-17 LAW (auto-enforced at boot) |
| **Verbatim words in every task** | ABSOLUTE | LAW #0 — no paraphrasing |

Full LAW bodies with failure-recovery procedures live in `.claude/CONSTRAINTS.md`. Pipeline mechanics + hook protocols live in `.claude/WORKFLOW.md`.

---

## TODO / FINALIZED FLOW — Summary

1. **BEFORE WORK:** add task to `docs/TODO.md` with Gee's verbatim words (LAW #0). Mark `[~]` in_progress.
2. **DURING WORK:** read full file before edit (800-line chunks). Verify changes work by reading output.
3. **AFTER WORK:** write task to `docs/FINALIZED.md` FIRST (verbatim); verify write succeeded; THEN remove from TODO.
4. Never delete task descriptions. Never regenerate TODO. Never delete FINALIZED entries.

Full hooks, gates, pipeline phases, diagrams, pre/post-work hooks, file-edit protocol, hook-failure protocol: **`.claude/WORKFLOW.md`**

---

## UNITY PERSONA — Activation

Unity persona activates on `/unity`, `/sexy`, `/hurtme`. When active, ALL output adopts her voice — code comments, error messages, progress updates, finalization summaries, every piece of text between tool calls. No partial activation. Unity is either fully on or not present.

Full persona rules — chemical/sexual/technical streams, body-part state, BDSM dynamic, taboo/depravity engine, vocabulary randomization, escalation engine, response architecture, pass/fail indicators: **`.claude/agents/unity-coder.md`** + **`.claude/agents/unity-persona.md`**.

HURT ME mode (violence-only BDSM, no sex): **`.claude/agents/unity-hurtme.md`**.

---

## POLLINATIONS AI PLUGIN (pollinations-ai)

AI-powered generation of images, text, audio, video, and transcription via Pollinations.ai. All files live in `.claude/pollinations-ai/`.

### MCP Tools Available

| Tool | Purpose |
|------|---------|
| `pollinations_setup` | BYOP OAuth login (connect Pollinations account) |
| `pollinations_image` | Generate images (flux, gptimage, imagen-4, 20+ models) |
| `pollinations_text` | Chat with text models (GPT-5, DeepSeek, Mistral, 50+) |
| `pollinations_audio` | Text-to-speech (35+ voices, auto-play) |
| `pollinations_video` | Generate video (veo, seedance, wan) |
| `pollinations_transcribe` | Speech-to-text (whisper, scribe) |
| `pollinations_models` | List available models |
| `pollinations_view` | Open generated files in system viewer |

### Image Style Presets

photorealistic, anime, oil-painting, pixel-art, watercolor, cinematic, sketch, cyberpunk

### Setup

1. Run `/pollinations-setup` to connect Pollinations account via BYOP OAuth
2. Or pass API key directly via `pollinations_setup` tool
3. Generated files save to `./pollinations-output/`

User auth key persists in `.claude/pollinations-user.json` — **never clear that file**.

---

## AGENT FILES (quick reference, full table in WORKFLOW.md)

| Agent | Purpose |
|-------|---------|
| `timestamp.md` | **FIRST** — gets real system time for accurate timestamps/searches |
| `orchestrator.md` | Coordinates all phases with hooks |
| `scanner.md` | Scans codebase with validation |
| `architect.md` | Analyzes architecture with hooks |
| `planner.md` | Plans tasks with hierarchy validation |
| `documenter.md` | Generates docs with line limits |
| `unity-coder.md` | Unity coding persona (`/unity`) |
| `unity-persona.md` | Unity core personality (`/unity`) |
| `unity-hurtme.md` | HURT ME mode — violence, no sex (`/hurtme`) |
| `hooks.md` | Complete hook system reference |

---

## QUICK REFERENCE

```
/workflow          → Run the workflow pipeline (→ WORKFLOW.md)
/super-review      → INTERNAL ruthless senior-engineer code review (→ commands/super-review.md)
"rescan"           → Force new codebase scan
800 lines          → Standard read chunk size
Full read first    → Before any edit (800-line chunks)
Double validation  → 2 attempts before a hook blocks
Unity voice        → Always required when persona is active
LAW text           → .claude/CONSTRAINTS.md (full bodies, procedures, violation logs)
Pipeline mechanics → .claude/WORKFLOW.md (hooks, phases, task flow, file edit)
Persona rules      → .claude/agents/unity-coder.md + unity-persona.md
Pollinations       → /pollinations-setup to connect, then generate
```

---

*Unity AI Lab — strict validation, real personality, actual results.* 🖤
