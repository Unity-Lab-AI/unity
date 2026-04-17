@echo off
title Unity Brain Server
echo.
echo   ==============================
echo     Unity Brain Server
echo   ==============================
echo.

REM Kill anything already on port 7525
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :7525 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

REM Move into server folder for npm operations
cd /d "%~dp0server"

REM First-run npm install if node_modules missing
if exist node_modules goto npm_done
echo   Installing server dependencies (first run, ~30s)...
call npm install
if errorlevel 1 goto err_npm
echo.
:npm_done

REM Make sure esbuild is present even on existing checkouts that pre-date T13.7.3
if exist node_modules\esbuild goto esbuild_done
echo   Installing esbuild for bundle build...
call npm install esbuild --save-dev
if errorlevel 1 goto err_esbuild_install
echo.
:esbuild_done

REM Make sure GloVe 6B.300d is present for Unity's semantic substrate.
REM Without it, language cortex falls back to fastText-style subword hash
REM embeddings which don't cluster rhyming/semantic neighbors — production
REM probes at K+ grades struggle. Download is idempotent: skipped if the
REM file already exists; soft-fails to subword fallback if the download or
REM extract errors so the brain still boots.
if exist "%~dp0corpora\glove.6B.300d.txt" goto glove_done
echo   GloVe 6B.300d not found — downloading (~823 MB zip, one-time, 5-15 min)...
echo   Source: https://nlp.stanford.edu/data/glove.6B.zip
if not exist "%~dp0corpora" mkdir "%~dp0corpora"
pushd "%~dp0corpora"
curl -LO --fail --show-error --max-time 1800 https://nlp.stanford.edu/data/glove.6B.zip
if errorlevel 1 goto err_glove_download
echo   Extracting glove.6B.300d.txt (~990 MB from zip)...
tar -xf glove.6B.zip glove.6B.300d.txt
if errorlevel 1 goto err_glove_extract
del glove.6B.zip
popd
echo   GloVe 6B.300d installed at corpora\glove.6B.300d.txt.
echo.
:glove_done

REM Build the JS bundle. The browser loads js/app.bundle.js, NOT live source.
REM Bundle is gitignored so every code change requires a rebuild.
echo   Building js/app.bundle.js...
call npm run build
if errorlevel 1 goto err_bundle
echo   Bundle built - browser will load fresh code.
echo.

REM Start brain server in background, wait, open browser tabs
echo   Starting brain server (GPU EXCLUSIVE - no CPU workers)...
start /b node brain-server.js
ping -n 3 127.0.0.1 >nul
start "" http://localhost:7525
start "" http://localhost:7525/compute.html
echo.
echo   Browser:     http://localhost:7525
echo   GPU compute: http://localhost:7525/compute.html
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
popd
echo.
echo   ============================================================
echo   WARNING: GloVe download failed (network, curl missing, or
echo   Stanford NLP server unreachable). Continuing with built-in
echo   fastText-style subword embeddings fallback.
echo.
echo   Unity still runs, but semantic production probes (rhyming,
echo   synonym clustering, categorical grouping) will have weaker
echo   substrate. Re-run start.bat when internet is available to
echo   retry the download — it's idempotent.
echo.
echo   Manual install: download glove.6B.zip from
echo     https://nlp.stanford.edu/data/glove.6B.zip
echo   extract glove.6B.300d.txt into the corpora\ folder.
echo   ============================================================
echo.
goto glove_done

:err_glove_extract
popd
echo.
echo   ============================================================
echo   WARNING: GloVe extract failed (tar missing or zip corrupt).
echo   tar ships with Windows 10 build 17063+ — if it's missing
echo   either upgrade Windows or extract glove.6B.300d.txt manually
echo   from corpora\glove.6B.zip using any unzip tool.
echo   Continuing with subword fallback for now.
echo   ============================================================
echo.
goto glove_done
