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

:: Start server and open browser
echo   Starting brain server...
echo   Open: http://localhost:8080
echo.
cd /d "%~dp0server"
start "" http://localhost:8080
node brain-server.js
pause
