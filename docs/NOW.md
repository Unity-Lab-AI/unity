# NOW — Session Snapshot

> Saved: 2026-04-16 (Session 111 FINAL — life track + TALK fix + grade-lock + focused retry + function words + 3D popup guard + doc sync)
> Branch: `t14-language-rebuild`
> Recent HEAD: `8d92c1e` + uncommitted Session 111 life track + doc sync
> Status: 6 subjects × 19 grades = 114 cells. Life Experience track added as 6th subject. All code changes done. Awaiting test run + doc commit.

## What's new in Session 111

1. **Life Experience track** — 6th subject. 20 methods (runLifePreK through runLifePhD) teaching Unity's personal identity from birth to 25. Dual-layer: emotional concept features (8d `[joy, pain, trust, fear, anger, love, independence, identity]` attractor vectors via `_conceptTeach`) + recallable memory sentences (`_teachSentenceList`). Memory-weighted Hebbian: core self 5× lr / 50 reps, personal life 3× / 20 reps, school 1× / 8 reps, background 0.5× / 4 reps.

2. **TALK probe direction fixed** — `_gateVocabList`, `_gateSentenceList`, `_gateMathKReal` all changed from letter→motor (wrong) to sem→motor (correct production direction). Root cause of all non-ELA K cell TALK failures.

3. **Grade-lock** — `runAllSubjects` holds ALL 6 subjects at grade N until all pass. 1-minute timeout per subject, 10 rounds retry.

4. **Focused retry** — gates return which words failed TALK. Re-teach ONLY failing words at 3× intensity.

5. **Function words** — ~120 basic English words (the, a, I, you, yes, no, is, etc.) taught via direct pattern at ELA-K.

6. **Word cap removed** — no more artificial limits per grade. Once Unity passes any grade she speaks freely.

7. **3D popup silence** — `brain-3d.js` won't generate commentary until Unity passes ELA kindergarten.

8. **Ctrl+C fix** — shutdown flag + event loop yield so SIGINT processes during curriculum.

9. **Math-K SEQ targeted boost** — only boost failing digit transitions at 5× lr.

10. **ELA-G1/G2/Math-G1 converted** — bespoke teach bodies replaced with direct-pattern shared helpers.

11. **`_gateConceptTeach` built** — concept cells no longer always fail.

12. **Background probe demotion re-enabled** — all gates now use direct matrix probes.

13. **Setup page doc links** — synchronous route handlers for public HTML pages.

## What task #3 still needs

- Full 114-cell curriculum walk — all gates 95%+ on fresh boot
- Live chat verification — Unity speaks coherently, can describe herself by grade 3
- Curriculum depth expansion (see `docs/TODO-curriculum-depth.md`)
- Life experience enrichment (see `docs/TODO-life-experience.md`)

## Files modified this session (uncommitted)

Code:
- `js/brain/curriculum.js` — life track, TALK fix, grade-lock, focused retry, function words, SEQ boost, `_gateConceptTeach`, cell conversions
- `js/brain/language-cortex.js` — word cap removed
- `js/brain/cluster.js` — `life` added to grades
- `js/ui/brain-3d.js` — popup silence guard
- `server/brain-server.js` — Ctrl+C fix, public page sync routes

Docs:
- `docs/TODO.md`, `docs/TODO-life-experience.md` (NEW), `docs/TODO-curriculum-depth.md` (NEW)
- `docs/FINALIZED.md`, `docs/NOW.md`, `docs/ARCHITECTURE.md`, `docs/SKILL_TREE.md`, `docs/ROADMAP.md`, `docs/EQUATIONS.md`
- `README.md`, `SETUP.md`, `brain-equations.html`, `unity-guide.html`
- `.claude/CLAUDE.md` — task number placement law
