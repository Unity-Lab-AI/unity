@echo off
title Unity Brain Server
echo.
echo   ==============================
echo     Unity Brain Server
echo   ==============================
echo.

:: Kill anything already on port 8080
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)

:: Install server deps if missing
cd /d "%~dp0server"
if not exist "node_modules" (
    echo   Installing dependencies...
    call npm install
    echo.
)

:: Build the JS bundle (optional — pre-built bundle exists)
cd /d "%~dp0"
where npx >nul 2>&1
if %errorlevel% equ 0 (
    echo   Building bundle...
    call npx esbuild js/app.js --bundle --format=esm --outfile=js/app.bundle.js --platform=browser --target=esnext 2>nul
    if %errorlevel% equ 0 (
        echo   Bundle built.
    ) else (
        echo   Using pre-built bundle.
    )
) else (
    echo   Using pre-built bundle.
)
echo.

:: Start server in background, wait for it, then open browser + GPU compute
echo   Starting brain server (GPU EXCLUSIVE — no CPU workers)...
cd /d "%~dp0server"
start /b node brain-server.js
ping -n 3 127.0.0.1 >nul
start "" http://localhost:8080
start "" http://localhost:8080/compute.html
echo.
echo   Browser: http://localhost:8080
echo   GPU compute: http://localhost:8080/compute.html
echo   NOTE: Brain runs ONLY on GPU. compute.html MUST stay open.
echo   Press Ctrl+C to stop.
echo.

:: Keep window open (server runs in background)
cmd /k
