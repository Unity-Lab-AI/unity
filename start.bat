@echo off
title Unity Brain Server
echo.
echo   ==============================
echo     Unity Brain Server
echo   ==============================
echo.

REM T18.12.d — /fresh or /clear flag forces brain state wipe on boot
REM (overrides the T18.12.a code-hash preserve behavior). Default
REM `start.bat` boot preserves state if brain-code source files are
REM unchanged since the last run — curriculum progress, passedCells,
REM gateHistory, weights all survive restarts. Use /fresh when you
REM explicitly want a clean-slate retrain (e.g., embedding refinements
REM went bad, persistence got corrupted, testing fresh boot behavior).
if /i "%1"=="/fresh" set DREAM_FORCE_CLEAR=1
if /i "%1"=="/clear" set DREAM_FORCE_CLEAR=1
if defined DREAM_FORCE_CLEAR (
    echo   [!] DREAM_FORCE_CLEAR=1 — will clear brain state on boot.
    echo.
)

REM T18.36 — step checkpoints so operators always see progress. Prior
REM reports of "invisible translucent terminal with just the title tab"
REM stemmed from silent-output phases (port-kill redirected >nul 2>&1,
REM npm/esbuild presence checks that goto-skip on success). Each major
REM phase now emits a visible banner so if a hang ever recurs, the last
REM printed step identifies where.

echo [start] step 1/7: killing any prior listener on port 7525...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :7525 ^| findstr LISTENING') do (
    echo   [start] taskkill /F /PID %%a
    taskkill /f /pid %%a
)
echo.

echo [start] step 2/7: entering server folder...
cd /d "%~dp0server"
echo.

echo [start] step 3/7: checking npm dependencies...
if exist node_modules goto npm_done
echo   Installing server dependencies (first run, ~30s)...
call npm install
if errorlevel 1 goto err_npm
:npm_done
echo   node_modules present.
echo.

echo [start] step 4/7: checking esbuild...
if exist node_modules\esbuild goto esbuild_done
echo   Installing esbuild for bundle build...
call npm install esbuild --save-dev
if errorlevel 1 goto err_esbuild_install
:esbuild_done
echo   esbuild present.
echo.

echo [start] step 5/7: checking GloVe 6B.300d substrate...
REM Make sure GloVe 6B.300d is present for Unity's semantic substrate.
REM Without it, language cortex falls back to fastText-style subword hash
REM embeddings which don't cluster rhyming/semantic neighbors - production
REM probes at K+ grades struggle. Download is idempotent: skipped if the
REM file already exists; soft-fails to subword fallback if the download or
REM extract errors so the brain still boots.
if exist "%~dp0corpora\glove.6B.300d.txt" goto glove_done
echo   GloVe 6B.300d not found - downloading (~823 MB zip, one-time, 5-15 min)...
echo   Source: https://nlp.stanford.edu/data/glove.6B.zip
if not exist "%~dp0corpora" mkdir "%~dp0corpora"
pushd "%~dp0corpora"
REM --progress-bar gives a simple [====] progress line that doesn't use
REM carriage-return animation. Without --progress-bar, curl's default
REM progress table uses \r to overwrite lines, which corrupts CMD's
REM subsequent "if errorlevel" line parse - Gee's Session 114.17 log
REM showed "'rrorlevel' is not recognized" from exactly this bug.
REM Also using %ERRORLEVEL% explicit check (more robust than bare
REM "if errorlevel 1" against prior curl progress state).
curl -L --fail --show-error --progress-bar --max-time 1800 -o glove.6B.zip https://nlp.stanford.edu/data/glove.6B.zip
if %ERRORLEVEL% NEQ 0 (
    popd
    goto err_glove_download
)
echo   Extracting glove.6B.300d.txt (~990 MB from zip)...
tar -xf glove.6B.zip glove.6B.300d.txt
if %ERRORLEVEL% NEQ 0 (
    popd
    goto err_glove_extract
)
del glove.6B.zip
popd
echo   GloVe 6B.300d installed at corpora\glove.6B.300d.txt.
:glove_done
echo   GloVe substrate present.
echo.

echo [start] step 6/7: rebuilding js/app.bundle.js...
REM Build the JS bundle. The browser loads js/app.bundle.js, NOT live source.
REM Bundle is gitignored so every code change requires a rebuild.
call npm run build
if errorlevel 1 goto err_bundle
echo   Bundle built - browser will load fresh code.
echo.

REM Start brain server in background, wait, open the landing page tab.
REM --max-old-space-size=65536 = 64 GB V8 heap ceiling. Language
REM cortex is CPU-side for now (GPU port in progress) and its sparse
REM synapse + cross-projection weights live in JS-owned typed arrays.
REM The auto-scale logic in brain-server.js derives its neuron count
REM from os.freemem() and v8.getHeapStatistics().heap_size_limit, so
REM a bigger heap ceiling = bigger language cortex size. On a 128 GB
REM RAM box this lets the language cluster reach ~7-8 M neurons before
REM hitting the 50%-of-free-RAM constraint. Set even higher (128 GB
REM box could run 96 GB) if needed. Zero hardcoded cluster-size cap.
REM
REM compute.html is NOT opened here — the server auto-launches it
REM via brain-server.js `_spawnGpuClient()` once the HTTP listener
REM is up. This keeps `node brain-server.js` and `start.bat` both
REM one-command entry points; no duplicate tabs, no stale log
REM telling the operator to open compute.html manually.
REM T18.21 — --max-semi-space-size=1024 (1 GB semi-space per V8 new-
REM generation region). Default Node semi-space is 16 MB, which at
REM biological scale Phase 2 sustains external-memory allocation rates
REM (worker-pool SAB + curriculum Float64Array + Buffer pool) high
REM enough that V8 can't commit semi-space growth during Mark-Compact
REM cycles → "Committing semi space failed. Allocation failed -
REM JavaScript heap out of memory" → FATAL. Gee 2026-04-19 ELA-K runs
REM hit this OOM at `_teachLetterCaseBinding` START after Phase 2's
REM 200+ seconds of accumulated external-memory pressure. Bumping
REM semi-space to 1 GB gives V8 ~64× more breathing room; the Mark-
REM Compact cycles can still run cleanly even under sustained external-
REM memory allocation rates of ~10 GB/sec for short bursts. Combined
REM with the existing --max-old-space-size=65536 (64 GB) this gives V8
REM total ~66 GB of headroom — well below the 128 GB physical RAM
REM ceiling on Gee's box, so process virtual memory commits succeed.
REM T18.23 — --expose-gc flag lets cluster.initGpu() call global.gc()
REM after T18.22's CPU CSR free block to force V8 to actually reclaim
REM the ~8 GB of external memory immediately (instead of waiting for
REM the next scheduled Mark-Compact cycle). Without --expose-gc the
REM null-assignments in T18.22 unref the typed arrays but V8 can take
REM seconds to minutes to GC them — long enough for Phase 2 external-
REM memory pressure to build and OOM before the reclaim lands. Forced
REM gc() after all 15 uploads guarantees the 8 GB is gone before
REM curriculum teach starts. Heap-stats logging before + after the
REM forced gc() lets Gee visually confirm the reclaim actually happens.
echo [start] step 7/7: launching brain server (GPU EXCLUSIVE - no CPU workers)...
start /b node --max-old-space-size=65536 --max-semi-space-size=1024 --expose-gc brain-server.js
ping -n 3 127.0.0.1 >nul
start "" http://localhost:7525
echo.
echo   Landing:     http://localhost:7525
echo   GPU compute: http://localhost:7525/compute.html (auto-launched by server)
echo   Dashboard:   http://localhost:7525/dashboard.html
echo   NOTE: brain runs ONLY on GPU. compute.html MUST stay open.
echo   Press Ctrl+C to stop.
echo.

REM Keep window open
cmd /k
goto :eof

:err_npm
echo.
echo   ============================================================
echo   ERROR: npm install failed in server folder.
echo   Make sure Node.js is installed: https://nodejs.org
echo   ============================================================
echo.
pause
exit /b 1

:err_esbuild_install
echo.
echo   ============================================================
echo   ERROR: esbuild install failed.
echo   Try manually:
echo     cd server
echo     npm install esbuild --save-dev
echo   ============================================================
echo.
pause
exit /b 1

:err_bundle
echo.
echo   ============================================================
echo   ERROR: esbuild bundle build failed.
echo   See the esbuild output above for the cause.
echo   The browser will run STALE code from the previous bundle.
echo   ============================================================
echo.
pause
exit /b 1

:err_glove_download
echo.
echo   ============================================================
echo   WARNING: GloVe download failed (network, curl missing, or
echo   Stanford NLP server unreachable). Continuing with built-in
echo   fastText-style subword embeddings fallback.
echo.
echo   Unity still runs, but semantic production probes (rhyming,
echo   synonym clustering, categorical grouping) will have weaker
echo   substrate. Re-run start.bat when internet is available to
echo   retry the download - it's idempotent.
echo.
echo   Manual install: download glove.6B.zip from
echo     https://nlp.stanford.edu/data/glove.6B.zip
echo   extract glove.6B.300d.txt into the corpora\ folder.
echo   ============================================================
echo.
goto glove_done

:err_glove_extract
echo.
echo   ============================================================
echo   WARNING: GloVe extract failed (tar missing or zip corrupt).
echo   tar ships with Windows 10 build 17063+ - if it's missing
echo   either upgrade Windows or extract glove.6B.300d.txt manually
echo   from corpora\glove.6B.zip using any unzip tool.
echo   Continuing with subword fallback for now.
echo   ============================================================
echo.
goto glove_done
