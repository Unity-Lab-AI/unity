# NOW — Session Snapshot

> **Session:** 114.19av · **Date:** 2026-04-19 · **Branch:** `syllabus-k-phd` · **HEAD:** `86baaba` (T18.28) → pending T18.29 · **BUILD:** `0.1.0+62786614-e6be` (T18.28 pre-stamp)

---

## MASSIVE PROGRESS + REMAINING HANG at gate probe

### What's working post-T18.27/T18.28

Gee 2026-04-19 Part 2 run got FURTHER than any prior run:

```
Pre-K: all 5 subjects passed (T18.12.c resume)
ELA-K Phase 1 DONE in 0.3s               ← T18.17 GPU-bound fast path
ELA-K Phase 2 DONE in 0.3s               ← T18.25 sync bypass (301K threshold)
5 K.RF helpers: all completed            ← T18.25/T18.26 backpressure/throttle
_teachWordEmission DONE: 1029 × 12 reps  ← T18.26 backpressure-aware send
_teachPluralTransform DONE
_teachQuestionWordCategories DONE
_teachEndPunctuation DONE
_teachCapitalization DONE
_teachStoryComprehension DONE
_teachCausalChains DONE
[T18.28 drain-wait completed in 2104ms: bufferedAmount 269.2MB → 0.0MB] ← T18.28 works
[K-DIAG] gate: inv=29, motor=9946, mGroup=342, sem_to_motor=9946x50329 nnz=14919000...
← HANG HERE (no probe results logged)
```

### The hang — inside `_gateElaKReal` letter loop

T18.28's drain-wait confirmed compute.html's queue drained from 269 MB → 0 MB in 2104ms before the gate probe started. K-DIAG log fired. Then: silence.

Probe code after K-DIAG log:
- `for (const letter of ALPHABET)` — 26 iterations
- Each iteration:
  - `letterToPhon.propagate(letterPat)` — CPU sparse matmul on ~90M nnz matrix (~300-500ms at biological scale)
  - TALK probe `proj.propagate(letterPat)` for motor-feeding projections (~50-200ms each)
  - If no direct, fallback chain `letterToSem.propagate` + `semToMot.propagate`

Synchronous CPU compute — no awaits. Should take 30-60s total for all 26 letters. Gee said "hung" — either >2min wait with no output, or a silent throw + retry loop.

### T18.29 SHIPPING — defensive logging + null checks inside gate probe

**What this commit adds:**

- `[K-DIAG] gate probe starting letter loop (26 letters × READ+TALK)...` — fires once at loop start
- `[K-DIAG] letter 'X' READ propagate Nms` — fires for first 3 letters (a, b, c)
- `[K-DIAG] letter 'X' TALK via Y_to_motor propagate Nms` — fires for first 3 letters
- `[K-DIAG] gate letter N/26 'X' done in Nms (readPass=N talkPass=N so far)` — fires for letter 1, letter 13, letter 26, OR any letter taking >2s
- `[K-DIAG] gate letter loop DONE in Nms — readPass=X/26, talkPass=X/26` — end-of-loop

**Defensive null guards:** If any bound projection's `values`/`colIdx`/`rowPtr` arrays are null (defense against T18.22 regression), logs "CSR arrays null — skipping READ/TALK" instead of throwing. T18.27 reverted the nulls so this should never fire, but if it does we'll see exactly which projection.

**If T18.29 shows NO `letter 1/26 done` log**: hang is before first iteration — likely in K-DIAG itself or ALPHABET enumeration. Unlikely but caught.

**If T18.29 shows `letter 1/26` but not `letter 13/26`**: hangs somewhere in letters 2-12. We'll see the last letter logged + duration.

**If T18.29 shows all 26 letters but no `letter loop DONE`**: hangs in SEQ probe after the loop. Next T18.30 adds logging there.

### Full T18.x cascade recap (for context)

| # | Purpose | Status |
|---|---------|--------|
| T18.17 | GPU-bound fast path — skip CPU shadow on bound cross-projection Hebbian | ✓ proven (Phase 1 0.3s) |
| T18.19 | Worker-pool sync bypass at 100K threshold (was 10M, wrong for cortexCluster) | ✓ proven (Phase 2 0.3s) |
| T18.22 | Null CPU CSR arrays post GPU upload | ✗ REVERTED by T18.27 (science-K null-access) |
| T18.25 | Remove forced gc() (was crashing V8) + fix ReferenceError + lower sync threshold | ✓ proven |
| T18.26 | WebSocket backpressure-aware sparse binary send (drop at 50MB) | ✓ partial — superseded by T18.28 |
| T18.27 | Revert T18.22 nulls (science-K was reading `proj.values[0]`) | ✓ proven |
| T18.28 | Raise threshold 50→200MB + drain-wait before gate probe | ✓ drain proven, probe still hangs |
| T18.29 | **Per-letter diagnostic logging inside gate probe + defensive null guards** | SHIPPING NOW |

### Files touched this session (T18.29)

- `js/brain/curriculum.js` — per-letter diagnostic logging in `_gateElaKReal` + null-array defensive guards on bound projection `.propagate()` calls
- `docs/NOW.md` — this file (session 114.19av snapshot)

### Next steps

Gee retests → pastes gate probe log section → we see EXACTLY which letter / which operation hangs → ship T18.30 targeting the specific cause.

If no log lines appear after K-DIAG, the hang is outside the loop I instrumented and we need to look at code between K-DIAG log and the `for (const letter of ALPHABET)` start.

*— Unity AI Lab · 5 hours deep into the T18 cascade · first biological-scale gate probe imminent*
