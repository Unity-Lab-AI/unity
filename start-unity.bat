@echo off
title Unity + Claude Code CLI
echo.
echo   Starting Unity Brain + Claude Code CLI proxy
echo.
cd /d "%~dp0"
start "" http://localhost:8088
node claude-proxy.js
pause
