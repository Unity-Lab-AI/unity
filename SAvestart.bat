@echo off
title Unity Brain Server (SAVE-STATE RESUME)
echo.
echo   ==============================
echo     Unity Brain Server
echo     SAVE-STATE RESUME MODE
echo   ==============================
echo.
echo   This boot PRESERVES brain state — no auto-clear.
echo   Unity resumes from her last milestone save:
echo     - Cortex weights + cross-projections
echo     - cluster.grades milestone progression
echo     - conversations.json + episodic-memory.db
echo     - embedding refinements + drug scheduler state
echo.
echo   Use start.bat for a normal boot (code-hash preserve).
echo   Use start.bat /fresh for a full wipe and retrain.
echo.

REM FORCE preserve-state. Overrides autoClearStaleState() regardless of
REM code-hash change since last run. DREAM_FORCE_CLEAR is explicitly
REM REJECTED in this script — this entry point is for resume only.
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

REM Make sure esbuild is present
if exist node_modules\esbuild goto esbuild_done
echo   Installing esbuild for bundle build...
call npm install esbuild --save-dev
if errorlevel 1 goto err_esbuild_install
echo.
:esbuild_done

REM GloVe presence check — SAvestart resumes from save state, which
REM means GloVe must already be present (it was downloaded on the
REM original start.bat run that produced the save point). If missing,
REM fall through to subword fallback — saved weights may still load
REM but new teaching would use a different embedding substrate. Warn
REM Gee loudly and continue.
if exist "%~dp0corpora\glove.6B.300d.txt" goto glove_done
echo.
echo   ============================================================
echo   [!] GloVe 6B.300d NOT FOUND at corpora\glove.6B.300d.txt
echo.
echo   SAvestart.bat assumes GloVe was already downloaded by the
echo   prior start.bat run that produced the save state. If Unity's
echo   saved weights were learned under GloVe and we're now booting
echo   under the subword fallback, semantic probes will drift.
echo.
echo   Recommended: exit now, run start.bat once to download GloVe,
echo   then relaunch SAvestart.bat.
echo   ============================================================
echo.
pause
:glove_done

REM Rebuild the JS bundle — source may have changed since last save
REM but the saved brain weights hydrate against current code at runtime.
REM Rebuild keeps browser in sync with server-side code.
echo   Building js/app.bundle.js...
call npm run build
if errorlevel 1 goto err_bundle
echo   Bundle built.
echo.

REM Start brain server. Same V8 flags as start.bat for parity.
REM DREAM_KEEP_STATE=1 is set above so autoClearStaleState() skips
REM the file-wipe block and hydrates from existing brain-weights*.json
REM + conversations.json + episodic-memory.db.
echo   Starting brain server (SAVE-STATE RESUME)...
start /b node --max-old-space-size=65536 --max-semi-space-size=1024 --expose-gc brain-server.js
ping -n 3 127.0.0.1 >nul
start "" http://localhost:7525
echo.
echo   Landing:     http://localhost:7525
echo   GPU compute: http://localhost:7525/compute.html (auto-launched)
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
echo   ============================================================
echo.
pause
exit /b 1

:err_bundle
echo.
echo   ============================================================
echo   ERROR: esbuild bundle build failed.
echo   See the esbuild output above for the cause.
echo   ============================================================
echo.
pause
exit /b 1
