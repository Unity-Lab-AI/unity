@echo off
echo Starting Unity Brain (server-brain + EDNA response pool)
echo Opening http://localhost:8080 in browser...
start http://localhost:8080
cd /d C:\repos\Unity
py -3.12 -m http.server 8080
