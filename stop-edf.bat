@echo off
setlocal EnableDelayedExpansion
title Stop EDF Server and Cloudflare Tunnel
cd /d "%~dp0"

set "PORT=3001"
if exist ".env" (
    for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
        if /i "%%A"=="PORT" set "PORT=%%B"
    )
)

echo Stopping Cloudflare Tunnel ^(cloudflared.exe^)...
taskkill /F /IM cloudflared.exe >nul 2>&1

echo Stopping EDF Server on port !PORT!...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":!PORT! " ^| findstr "LISTENING"') do (
    if not "%%P"=="0" (
        taskkill /F /PID %%P >nul 2>&1
    )
)

echo Done. Both EDF Server and Cloudflare Tunnel have been stopped.
ping 127.0.0.1 -n 3 >nul