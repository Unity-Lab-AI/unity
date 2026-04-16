# NOW — Session Snapshot

> Saved: 2026-04-16 (Session 111 END — massive session, 15+ commits)
> Branch: `t14-language-rebuild`
> Recent HEAD: `c234a48`
> Status: K cells pass for all 6 subjects. G1 stuck on TALK for common words ("a", "the"). Life track built but needs content depth. 2D viz tabs fixed. Popup word salad removed. Curriculum framework functional but thin.

## What Session 111 accomplished

### Code shipped (15+ commits)
1. TALK probe direction fixed (sem→motor) — root cause of all non-ELA K failures
2. Grade-lock — all 6 subjects must pass grade N before advancing
3. Life Experience track — 6th subject, 20 methods birth to 25, dual-layer (emotional concept features + recallable memories), memory-weighted Hebbian
4. Focused retry — re-teach only failing words at 3× intensity
5. Function words (~120) taught at ELA-K via direct pattern
6. Word cap removed — no artificial per-grade limits
7. 3D popup silence guard — no speech from untrained weights, shows raw brain state numbers when can't speak
8. Ctrl+C shutdown fix — flag + event loop yield
9. Math-K SEQ digit-only filter + anti-Hebbian on wrong transitions
10. ELA-G1/G2/Math-G1 converted to direct pattern shared helpers
11. `_gateConceptTeach` built — concept cells no longer always fail
12. Background probe demotion re-enabled
13. Cross-projection density 300→1500 (5× more capacity)
14. Real human-grade comprehension gates (association + fill-in-blank)
15. Life method gates switched from `_gateVocabList` to `_teachVocabList`
16. Life reps reduced (50→12, 20→6, 15→5) so they fit in timeout
17. Shutdown checks inside `_teachVocabList`, `_teachSentenceList`, `_conceptTeach`
18. Setup page doc links fixed (sync route handlers)
19. Bundle loading fixed — http:// now loads app.bundle.js not stale raw app.js
20. Cluster Waves tab added to landing page
21. Neurons tab rewritten — flat 2D brain map grid with toggleable wave overlays
22. Synapses tab rewritten — animated circular network graph with co-firing pulses
23. ALL 2D viz tabs fixed — `brainViz.updateState(serverState)` was missing (ONE LINE root cause)
24. Modules/Senses/Memory tabs rewritten for aggregate server data
25. Camera feed fallback wiring to viz panel
26. Task number placement law — banned from public-facing files
27. Two new TODO files: `TODO-life-experience.md`, `TODO-curriculum-depth.md`
28. Full doc sync across all workflow + public docs
29. FINALIZED entry for Sessions 95-110 + Session 111

### Where curriculum stands
- **ELA-K:** PASSES consistently (attempt 3-5)
- **Math-K:** PASSES with SEQ fix (attempt 4)
- **Sci/Soc/Art-K:** PASS on attempt 1-3
- **Life-K:** PASSES after reduced reps (attempt 1-2)
- **All K cells → PASS → advance to Grade 1**
- **G1 cells:** TALK stuck on "a" (most common English word, GloVe too generic for sem→motor). ELA-G1 bounces 20-50%. Sci-G1 fails on "a" everywhere. TALK is the bottleneck at G1+.

### Known remaining issues
1. **"a"/"the" TALK failure** — most common words have GloVe embeddings so generic that sem→motor can't distinguish them from noise. Need a different approach for function words — maybe exempt them from TALK probes, or use letter-based probing for function words instead of sem-based
2. **Curriculum content is THIN** — 15-40 sentences per cell, real school has thousands of words and actual operations (see `docs/TODO-curriculum-depth.md`)
3. **Real human-grade tests not wired into all cells** — `_gateComprehension` + `_gateConversation` methods exist but only wired into `_teachVocabList` and `_teachSentenceList` gates, not all individual cells
4. **Popup word salad** — `languageCortex.generate()` on RemoteBrain produces garbage from untrained weights. Guard checks grades but RemoteBrain doesn't have grades field. Falls through to raw numbers `arousal:0.85 valence:0.12 Ψ:0.034`
5. **2D viz Senses tab** — camera shows in Unity's eye widget but not always in the viz panel video element
6. **Inner Voice tab** — has a `ivValence` undefined reference that may crash

### Task list (in-session)
- #32: T14.24 PARENT — DO NOT CLAIM DONE EARLY
- #35: Full 114-cell walk — all gates 95%+
- #36: Live chat verification — Unity speaks coherently

### TODO files
- `docs/TODO.md` — main active work (viz tabs, gate redesign, popup state, cross-projection, life experience, curriculum depth refs)
- `docs/TODO-curriculum-depth.md` — real-world parity: vocabulary depth, math operations, science method, history depth, reading practice, homework
- `docs/TODO-life-experience.md` — Unity's full life story, memory weighting tiers, all checked off for initial build

### Binding constraints still active
1. LAW #0 — VERBATIM WORDS ONLY
2. LAW — Docs before push, no patches
3. LAW — Task numbers only in workflow docs, BANNED from public pages
4. T14.24 DO NOT CLAIM DONE EARLY
5. A+ = 95% on all gates
6. Every teaching equation must drive READ + THINK + TALK
7. No tests, ever
8. Growth is the point
9. Gates must be real human-grade tests (paraphrase, solve, converse)
10. Unity's brain is equational — no lookup tables, no hardcoded rules
11. Popups must show REAL brain output, not fake text
12. Life experiences must match what she's actually LIVED through (no tattoos before college)

### Files modified this session
Code: `js/brain/curriculum.js` (~+2000 lines), `js/brain/cluster.js`, `js/brain/language-cortex.js`, `js/ui/brain-viz.js`, `js/ui/brain-3d.js`, `js/app.js`, `server/brain-server.js`

Docs: `docs/TODO.md`, `docs/FINALIZED.md`, `docs/NOW.md`, `docs/ARCHITECTURE.md`, `docs/SKILL_TREE.md`, `docs/ROADMAP.md`, `docs/EQUATIONS.md`, `docs/TODO-life-experience.md` (NEW), `docs/TODO-curriculum-depth.md` (NEW)

Public: `README.md`, `SETUP.md`, `brain-equations.html`, `unity-guide.html`, `index.html`, `docs/component-templates.txt`

Config: `.claude/CLAUDE.md`, memory files

### Next session priorities
1. Fix "a"/"the" TALK failure at G1+ (function word exemption or different probe)
2. Build real curriculum content depth per grade (not 15 sentences — thousands)
3. Wire comprehension/conversation gates into all cell runners
4. Get G1 passing across all 6 subjects
5. Live chat coherence test
