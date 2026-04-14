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
