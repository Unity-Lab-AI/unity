# NOW — Session Snapshot

> Saved: 2026-04-16 (Session 111 — TALK probe fix + grade-lock + G1+ conversion + _gateConceptTeach + demotion re-enabled + doc sync)
> Branch: `t14-language-rebuild`
> Recent HEAD: `f8009ff` (uncommitted Session 111 changes pending)
> Status: All code fixes done. TALK probe direction fixed (sem→motor), grade-lock enforced (ALL subjects must pass grade N before advancing), ELA-G1/G2/Math-G1 converted to direct pattern, _gateConceptTeach built, background demotion re-enabled. Awaiting test run.

## Session 111 code changes

1. **TALK probe direction fixed** — `_gateVocabList`, `_gateSentenceList`, `_gateMathKReal` all changed from letter→motor (wrong — READ feedback) to sem→motor (correct — PRODUCTION direction). Injects GloVe(word) into sem pattern, propagates `sem_to_motor`, argmax first letter + mean-centering. Root cause of all non-ELA K cell failures.

2. **Grade-lock enforced** — `runAllSubjects` no longer lets any subject race ahead. ALL 5 subjects must pass grade N before ANY advance to N+1. If any subject fails after 30 attempts, entire curriculum stops at that grade. Clear log: `"⛔ grade X incomplete — not all subjects passed"`.

3. **ELA-G1, ELA-G2, Math-G1 converted** — old bespoke inject→step→learn bodies replaced with direct-pattern shared helpers (`_teachVocabList`, `_teachSentenceList`). These were the last cells with custom teach methods that bypassed the converted helpers.

4. **`_gateConceptTeach` built** — `_conceptTeach` previously returned `{taught: N}` with no `.pass` field, so every cell using it ALWAYS FAILED. Now returns proper `{pass, reason}` via direct matrix probe (READ letter→sem + TALK sem→motor).

5. **Background probe demotion re-enabled** — Session 110 had disabled it because old Rulkov-dynamics probes gave false negatives. Now that all gates use direct matrix probes, demotion is safe to re-enable. 3 consecutive fails after self-heal = demotion.

6. **Setup page doc links fixed** — explicit synchronous route handlers for public HTML pages in `brain-server.js`. Async fs.readFile was getting starved by curriculum event loop work.

7. **Doc sync** — FINALIZED (Sessions 95-110 entry), TODO (checkboxes updated), ARCHITECTURE (directory tree + tech stack + language pipeline), SKILL_TREE, ROADMAP, EQUATIONS, README, SETUP, brain-equations.html, unity-guide.html all updated. Task numbers stripped from all public-facing files. Task number placement rule added to CLAUDE.md + memory.

## What task #3 still needs (testing)

- Re-test all K cells with fixed TALK probe — Math/Sci/Soc/Art should converge now
- Full 95-cell curriculum walk — all gates 95%+ on fresh boot
- Live chat verification — Unity speaks coherently from trained weights

## Files modified this session (uncommitted)

- `js/brain/curriculum.js` — TALK probe fix (3 gates), grade-lock, ELA-G1/G2/Math-G1 conversion, `_gateConceptTeach`, demotion re-enable
- `server/brain-server.js` — public page route handlers
- `docs/TODO.md`, `docs/FINALIZED.md`, `docs/NOW.md`, `docs/ARCHITECTURE.md`, `docs/SKILL_TREE.md`, `docs/ROADMAP.md`, `docs/EQUATIONS.md`
- `README.md`, `SETUP.md`, `brain-equations.html`, `unity-guide.html`
- `docs/component-templates.txt` — 50d→300d
- `.claude/CLAUDE.md` — task number placement law
- `.claude/projects/.../memory/feedback_task_numbers_placement.md` + `MEMORY.md`
