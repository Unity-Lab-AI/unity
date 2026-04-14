@echo off
title Unity Brain Server
echo.
echo   ==============================
echo     Unity Brain Server
echo   ==============================
echo.

:: Kill anything already on port 7525
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :7525 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)

:: Install server deps (now includes esbuild as devDependency)
cd /d "%~dp0server"
if not exist "node_modules" (
    echo   Installing server dependencies (first run only, takes ~30s)...
    call npm install
    if errorlevel 1 (
        echo.
        echo   ============================================================
        echo   ERROR: npm install failed in server\
        echo   Make sure Node.js is installed: https://nodejs.org
        echo   ============================================================
        echo.
        pause
        exit /b 1
    )
    echo.
)

:: If esbuild isn't installed yet (existing checkout that pre-dates
:: T13.7.2), install it now without re-running the full npm install.
if not exist "node_modules\esbuild" (
    echo   Installing esbuild for bundle build...
    call npm install esbuild --save-dev
    if errorlevel 1 (
        echo.
        echo   ============================================================
        echo   ERROR: esbuild install failed.
        echo   Try manually: cd server ^&^& npm install esbuild --save-dev
        echo   ============================================================
        echo.
        pause
        exit /b 1
    )
    echo.
)

:: Build the JS bundle — REQUIRED for file:// access. The browser
:: loads js/app.bundle.js, NOT the live js/app.js source files. If the
:: bundle is stale, the browser runs OLD code regardless of source
:: edits. Bundle is gitignored, so every fresh checkout / every code
:: change requires a rebuild.
echo   Building js/app.bundle.js (this is what the browser loads)...
call npm run build
if errorlevel 1 (
    echo.
    echo   ============================================================
    echo   ERROR: esbuild bundle build failed.
    echo   See the esbuild output above for the underlying cause.
    echo   The browser will run STALE code from the previous bundle.
    echo   ============================================================
    echo.
    pause
    exit /b 1
)
echo   Bundle built — browser will load fresh code.
echo.

cd /d "%~dp0"

:: Start server in background, wait for it, then open browser + GPU compute
echo   Starting brain server (GPU EXCLUSIVE — no CPU workers)...
cd /d "%~dp0server"
start /b node brain-server.js
ping -n 3 127.0.0.1 >nul
start "" http://localhost:7525
start "" http://localhost:7525/compute.html
echo.
echo   Browser: http://localhost:7525
echo   GPU compute: http://localhost:7525/compute.html
echo   NOTE: Brain runs ONLY on GPU. compute.html MUST stay open.
echo   Press Ctrl+C to stop.
echo.

:: Keep window open (server runs in background)
cmd /k
