@echo off
echo Starting Unity Brain + Claude Code CLI proxy
echo Opening http://localhost:8088
start http://localhost:8088
cd /d C:\repos\Unity
node claude-proxy.js
