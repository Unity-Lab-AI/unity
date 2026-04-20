# NOW — Session Snapshot

> **Session:** 114.19ax · **Date:** 2026-04-20 · **Branch:** `syllabus-k-phd` · **HEAD:** `ee8e700` (T18.33 + stamp; pushed to main) → pending T18.36 (start.bat/SAvestart.bat fix)

---

## T18.36 SHIPPING — start.bat visible checkpoints + SAvestart.bat full parity

Gee immediately post-T18.33 push: *"something is wrong with the start  .bat .. u use it ant the tertminal starts up invisible and translucent with no inofation in it jus t the header tab is visible.. are you sute the Savestart.bat is poroper its almnmost half the size of the start.bat"*

**Kill step:** node PID 16552 (10 GB resident) + PID 19448 (CLOSE_WAIT) still held port 7525 from prior session. `taskkill /F /PID 16552 19448` cleared both. Port verified free before shipping the batch fixes.

**SAvestart.bat parity fix (T18.36.b):** first version at 139 lines had dropped GloVe download + error handlers on the flawed reasoning *"resume-only, GloVe should already exist."* Wrong — if corpora folder is wiped, SAvestart would silently fall back to subword embeddings and corrupt saved-weights semantic substrate. Rewrote to 174 lines matching start.bat's full boot sequence; delta is ONLY `DREAM_KEEP_STATE=1` + reject `/fresh`/`/clear` flags + 7-step banner labelling.

**start.bat visible step checkpoints (T18.36.c):** invisible-terminal report traced to silent phases (`>nul 2>&1` on port-kill, `goto :skip` without echo on npm/esbuild/GloVe presence checks). Every phase now emits a visible `[start] step N/7: …` banner. If a future hang recurs the last printed step identifies where.

**T18.36 closure gate:** Gee re-runs start.bat → sees 7-step banners → server launches. Gee-verification only.

---

## T18.33 SHIPPING — DYN-PROD silent-cortex fix

### Gee's Part 2 run 2026-04-20 surfaced three bugs

```
[Curriculum][K-DIAG] SEQ probe DONE in 7308ms — seqPass=0/25
[Curriculum][K-DIAG] DYN-PROD 1/17 'cat'→'a' (expected 'c') in 9761ms — prodPass=0/1 so far
... (every word decodes to 'a') ...
[Curriculum][K-DIAG] DYN-PROD probe DONE in 159724ms — prodPass=0/17
[Curriculum][K-DIAG] DYN-PROD[cat→c] decoded=a, emb_pos=141/300, expected_slot=c(2:0.000) rank=3/26,
top5_motor=a(0:0.000),b(1:0.000),c(2:0.000),d(3:0.000),e(4:0.000),
spikes(cluster=0,motor=0/59676,sem=0)
[Brain] compute_batch 447 timed out after 15s — GPU may be hung
[Curriculum] ⏱ _teachPhonemeBlending heartbeat — rep 1/10, word 1016/1029, elapsed 246.5s, ~2.6 words/s
```

**The 0/17 DYN-PROD is NOT the brain guessing wrong.** All 26 motor slots tied at 0.000 → argmax picks index 0 = 'a' deterministically. Zero spikes across 102 `cluster.step()` calls = cortex is completely silent during the probe.

### T18.33 fixes (in this commit)

1. **`_probeReset` also clears GPU caches** — `_cachedIntraCurrents = null` + `_cachedCrossCurrents.clear()` added next to the existing `externalCurrent.fill(0)` + `lastSpikes = 0` reset. Tick 0 of every probe starts from a zero state driven only by fresh injection + baseline drive.
2. **DYN-PROD tick loop uses `await cluster.stepAwait(0.001)`** — synchronous `step(dt)` swapped for the async await-cascade variant. Fixes the root cause: at 6-tick dt=0.001 wall-clock (6 ms), async GPU propagates never resolve before the next tick reads the one-tick-lag cache → stale/empty currents feed LIF → cortex never fires. `stepAwait` awaits the full GPU cascade per tick so real currents flow.
3. **Per-tick firing log in DYN-PROD probe 1** — logs `cluster=X motor=Y sem=Z` for each of 6 ticks on run 0 of the first probe only. 6 lines total, negligible log cost. On next Part 2 run Gee will see whether injection crosses LIF threshold at tick 0.

### Why only DYN-PROD

Audited every probe in `_gateElaKReal` — WRITE / RESP / TWO-WORD / FREE-WRITING already use `generateSentenceAwait` (T18.4.b era fix). SEQ probe uses single-shot `cluster.synapses.propagate(letterInput)` — no tick loop, no GPU-cache dependency; its 0/25 failure is a probe-DESIGN mismatch (SEQ asks for intra-letter-region recurrent A→B→C that cross-projection curriculum never trains), not a bug.

### NOT fixed this session — flagged as T18.34 candidates

- `compute_batch 447 timed out after 15s — GPU may be hung` — GPU hang post-DYN-PROD. Needs WebGPU device status audit + `device.lost` handler surfacing check.
- `~3 words/s teach velocity` in `_teachPhonemeBlending` — CPU Hebbian whitelist (T18.31) on `letter_to_phon` + `letter_to_motor` (~90M nnz each) is the bottleneck. Likely route them through worker pool or rescope the whitelist once T18.33 lets DYN-PROD report motor spike counts correctly.
- `SEQ probe 0/25 design mismatch` — redesign or remove, blocked on T16.5.d substrate-probe decision.

### Drift recovery in this session

T18.23 through T18.32 (10 commits between T18.22 and T18.33) shipped without FINALIZED entries — a LAW "Docs before push, no patches" violation prior to this session. `docs/FINALIZED.md` Session 114.19aw now carries a SHA + subject catchup table for the full batch. Canonical per-commit detail lives in `git show <sha>`. Future sessions MUST NOT shortcut FINALIZED entries.

### T18.35.a also shipped this session — SAvestart.bat save-state resume wrapper

Gee verbatim 2026-04-20: *"we need a SAvestart.bat that starts up the brain normally but doesnt clear the state of the brain and goes off the save points of the full brain state based off the saves it shall make at milestones ... So make a todo list of evetyhting ive already told you to sdo and add all this too"*

New `SAvestart.bat` at repo root. Sets `DREAM_KEEP_STATE=1` before `node brain-server.js` so `autoClearStaleState()` skips the state-wipe block regardless of code-hash change. Rejects `/fresh` and `/clear` flags. Mirrors start.bat's V8 flags + npm/esbuild/bundle-rebuild + port-7525 kill. Relies on existing T18.12.b per-cell `_saveCheckpoint(cellKey)` infra for resume anchors.

**Full T18.35 block (b-f open)** — milestone save completeness audit, resume-from-last-cell walker, dashboard indicator, LAW 6 Part 2 grade-state integration — all tracked in `docs/TODO.md` with verbatim Gee quote.

### Files touched this session

- `js/brain/curriculum.js` — `_probeReset` GPU-cache clear; DYN-PROD inner tick loop uses `await cluster.stepAwait`; per-tick firing log for first probe (T18.33)
- `SAvestart.bat` — new wrapper at repo root (T18.35.a)
- `docs/TODO.md` — T18.23-T18.32 catchup block + T18.33 block + T18.34 candidate scaffold + T18.35 block + Session 114.19aw verbatim directive log
- `docs/FINALIZED.md` — Session 114.19aw entry prepended (T18.33 + T18.35.a + T18.23-T18.32 SHA table)
- `docs/NOW.md` — this file

### Next steps

Gee restarts localhost (auto-clear fires) → re-runs Part 2 ELA-K → pastes the DYN-PROD probe1 per-tick log. If `cluster/motor/sem` counts are all non-zero on tick 1, injection is crossing threshold and the cortex is alive; T18.33 closes. If counts stay at 0 across all 6 ticks, root cause isn't the GPU-cache-staleness bug — next-step is checking `cortexCluster.tonicDrive` / `driveBaseline` / `gainMultiplier` multipliers (LIF may need more drive than our injection + baseline provides at biological scale cortexCluster).

*— Unity AI Lab · Session 114.19aw · silent-cortex diagnosis → stepAwait + cache-clear → per-tick firing telemetry for the next Part 2 run*
