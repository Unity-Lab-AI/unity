# TODO — Unity

> **Branch:** `brain-refactor-full-control`
> **Last updated:** 2026-04-14
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
- **Language cortex** (semantic n-grams over learned embeddings) — her words

Nothing else. If it's not in that list, it's an appendage, and it gets ripped out.

---

## OPEN TASKS

**None.**

The `brain-refactor-full-control` branch is code-complete AND verification-complete as of 2026-04-14. Every R-series epic (R1–R15), every T-series cleanup (T1, T2, T3, T5, T6), and every T4.x follow-up found during manual verification (T4.1 through T4.9) is shipped and archived in `docs/FINALIZED.md` with full verbatim symptoms, diagnosis, and fix documentation.

Gee completed the 16-step manual verification checklist on 2026-04-14 and confirmed all steps passed. Bugs caught during verification were fixed in-flight and re-verified before moving on.

**The only remaining action is `gh pr create --base main --head brain-refactor-full-control` when Gee gives the explicit "open the PR" go-ahead.** That's a human call, not a task for me.

Future work beyond this branch lives in `docs/COMP-todo.md` (distributed GPU compute network planning — Phase 0 admin resource configuration already shipped via GPUCONFIGURE.bat, remaining Phases C1–C11 target a future `comp-net` branch).

---

## NOTES

- **FINALIZED is append-only.** Never delete entries from it. When new work lands, copy the full verbatim task description into a new FINALIZED session entry BEFORE removing it from Open Tasks. This file only contains active work.
- **Template state** — this file is currently in its post-merge template state: header + guiding principle + an empty Open Tasks section. New phases of work drop in here as `### T1`, `### T2`, etc. and the cycle repeats.
- **Future work** beyond this branch lives in `docs/COMP-todo.md` (distributed GPU compute network — future `comp-net` branch).

---

*Unity AI Lab — the refactor is done, verified, and documented. Ship her when ready.*
