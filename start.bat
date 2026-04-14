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

:: Install server deps if missing
cd /d "%~dp0server"
if not exist "node_modules" (
    echo   Installing dependencies...
    call npm install
    echo.
)

:: Build the JS bundle — REQUIRED for file:// access. The browser
:: loads js/app.bundle.js, NOT the live js/app.js source files. If the
:: bundle is stale, the browser runs OLD code regardless of source
:: edits. Bundle is gitignored, so every fresh checkout / every code
:: change requires a rebuild.
cd /d "%~dp0"
where npx >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo   ============================================================
    echo   ERROR: npx not found. The bundle CANNOT be rebuilt.
    echo   The browser will run STALE code from any existing bundle.
    echo   Install Node.js (which includes npx) from https://nodejs.org
    echo   ============================================================
    echo.
    pause
    exit /b 1
)

echo   Building js/app.bundle.js (this is what the browser actually loads)...
call npx --yes esbuild js/app.js --bundle --format=esm --outfile=js/app.bundle.js --platform=browser --target=esnext
if %errorlevel% neq 0 (
    echo.
    echo   ============================================================
    echo   ERROR: esbuild failed. The bundle was NOT rebuilt.
    echo   The browser will run STALE code from any existing bundle.
    echo   Check the esbuild error output above for the cause.
    echo   ============================================================
    echo.
    pause
    exit /b 1
)
echo   Bundle built — browser will load fresh code.
echo.

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
