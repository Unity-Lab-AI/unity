@echo off
title Unity Brain Server
echo.
echo   Starting Unity Brain Server...
echo.
cd /d "%~dp0server"
start "" http://localhost:8080
node brain-server.js
pause
