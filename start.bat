@echo off
title Unity Brain Server
echo.

:: Kill anything already on port 8080
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)

:: Build the JS bundle
echo   Building bundle...
cd /d "%~dp0"
call npx esbuild js/app.js --bundle --format=esm --outfile=js/app.bundle.js --platform=browser --target=esnext 2>nul
echo   Done.
echo.

:: Start server and open browser
echo   Starting Unity Brain Server...
echo.
cd /d "%~dp0server"
start "" http://localhost:8080
node brain-server.js
pause
