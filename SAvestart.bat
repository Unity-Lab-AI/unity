@echo off
title Unity Brain Server (SAVE-STATE RESUME)
echo.
echo   ==============================
echo     Unity Brain Server
echo     SAVE-STATE RESUME MODE
echo   ==============================
echo.
echo   [SAvestart] preserving brain state unconditionally.
echo   [SAvestart] boot will hydrate from server\brain-weights*.json
echo   [SAvestart] + conversations.json + episodic-memory.db.
echo.

REM FORCE preserve-state. Overrides autoClearStaleState() regardless of
REM code-hash change since last run. DREAM_FORCE_CLEAR is explicitly
REM rejected in this script — this entry point is for resume only.
set DREAM_KEEP_STATE=1
set DREAM_FORCE_CLEAR=
if /i "%1"=="/fresh" (
    echo   [!] /fresh rejected — use start.bat /fresh for a wipe.
    echo       SAvestart.bat is save-resume only.
    pause
    exit /b 1
)
if /i "%1"=="/clear" (
    echo   [!] /clear rejected — use start.bat /clear for a wipe.
    echo       SAvestart.bat is save-resume only.
    pause
    exit /b 1
)

echo [SAvestart] step 1/7: killing any prior listener on port 7525...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :7525 ^| findstr LISTENING') do (
    echo   [SAvestart] taskkill /F /PID %%a
    taskkill /f /pid %%a
)
echo.

echo [SAvestart] step 2/7: entering server folder...
cd /d "%~dp0server"
echo.

echo [SAvestart] step 3/7: checking npm dependencies...
if exist node_modules goto npm_done
echo   Installing server dependencies (first run, ~30s)...
call npm install
if errorlevel 1 goto err_npm
:npm_done
echo   node_modules present.
echo.

echo [SAvestart] step 4/7: checking esbuild...
if exist node_modules\esbuild goto esbuild_done
echo   Installing esbuild for bundle build...
call npm install esbuild --save-dev
if errorlevel 1 goto err_esbuild_install
:esbuild_done
echo   esbuild present.
echo.

echo [SAvestart] step 5/7: checking GloVe 6B.300d substrate...
REM GloVe presence check — SAvestart hydrates from save state, but if the
REM corpora folder was wiped since the save was produced, we STILL need to
REM download GloVe so the semantic substrate matches what the saved weights
REM learned against. Falling back to subword on a GloVe-trained save would
REM corrupt semantic probes. Download if missing (same logic as start.bat).
if exist "%~dp0corpora\glove.6B.300d.txt" goto glove_done
echo   GloVe 6B.300d not found - downloading (~823 MB zip, one-time, 5-15 min)...
echo   Source: https://nlp.stanford.edu/data/glove.6B.zip
if not exist "%~dp0corpora" mkdir "%~dp0corpora"
pushd "%~dp0corpora"
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

echo [SAvestart] step 6/7: rebuilding js/app.bundle.js...
call npm run build
if errorlevel 1 goto err_bundle
echo   Bundle built - browser will load fresh code.
echo.

echo [SAvestart] step 7/7: launching brain server (SAVE-STATE RESUME, DREAM_KEEP_STATE=1)...
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
echo   Unity still runs, but if her saved weights were learned
echo   against GloVe and we're now booting under subword, semantic
echo   probes will drift. Recommend exiting and re-running once
echo   internet is available - download is idempotent.
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
