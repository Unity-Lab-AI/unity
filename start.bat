@echo off
title Unity Brain Server
echo.
echo   Building bundle...
cd /d "%~dp0"
call npx esbuild js/app.js --bundle --format=esm --outfile=js/app.bundle.js --platform=browser --target=esnext 2>nul
echo   Starting Unity Brain Server...
echo.
cd /d "%~dp0server"
start "" http://localhost:8080
node brain-server.js
pause
