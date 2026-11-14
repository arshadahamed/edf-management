@echo off
setlocal EnableDelayedExpansion
title EDF Server ^& Cloudflare Tunnel Launcher
cd /d "%~dp0"

echo ============================================================================
echo   EDF MANAGEMENT SYSTEM — HOST ^& CLOUDFLARE TUNNEL AUTO-LAUNCHER
echo ============================================================================
echo.

:: Default Settings
set "PORT=3001"
set "CLOUDFLARE_TUNNEL_NAME=edf"
set "CLOUDFLARE_TUNNEL_ID=12dbcf8b-13bf-426d-b6bd-8ba7cb8c573c"
set "CLOUDFLARE_TUNNEL_TOKEN="

:: Load values from .env if present
if exist ".env" (
    for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
        set "LINE=%%A"
        if not "!LINE:~0,1!"=="#" (
            if /i "%%A"=="PORT" set "PORT=%%B"
            if /i "%%A"=="CLOUDFLARE_TUNNEL_NAME" set "CLOUDFLARE_TUNNEL_NAME=%%B"
            if /i "%%A"=="CLOUDFLARE_TUNNEL_ID" set "CLOUDFLARE_TUNNEL_ID=%%B"
            if /i "%%A"=="CLOUDFLARE_TUNNEL_TOKEN" set "CLOUDFLARE_TUNNEL_TOKEN=%%B"
        )
    )
)

:: Locate cloudflared.exe
set "CLOUDFLARED_EXE=cloudflared.exe"
if exist "C:\Program Files (x86)\cloudflared\cloudflared.exe" (
    set "CLOUDFLARED_EXE=C:\Program Files (x86)\cloudflared\cloudflared.exe"
) else if exist "C:\Program Files\cloudflared\cloudflared.exe" (
    set "CLOUDFLARED_EXE=C:\Program Files\cloudflared\cloudflared.exe"
)

:: Optional flag: install-service (when run as Administrator)
if /i "%~1"=="--install-service" (
    if "!CLOUDFLARE_TUNNEL_TOKEN!"=="" (
        echo [ERROR] CLOUDFLARE_TUNNEL_TOKEN is not set in .env
        pause
        exit /b 1
    )
    echo [INFO] Installing Cloudflare Tunnel as a Windows Service...
    "%CLOUDFLARED_EXE%" service install !CLOUDFLARE_TUNNEL_TOKEN!
    net start cloudflared >nul 2>&1
    echo [OK] Service install command completed.
    pause
    exit /b 0
)

:: 1. Free up port if an old node.exe process is holding it
echo [1/3] Checking port !PORT!...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":!PORT! " ^| findstr "LISTENING"') do (
    if not "%%P"=="0" (
        echo       Stopping previous process on port !PORT! ^(PID %%P^)...
        taskkill /F /PID %%P >nul 2>&1
    )
)

:: 2. Start EDF Node.js Server (supports both https://localhost:!PORT! and http://localhost:!PORT!)
echo [2/3] Starting EDF Server on https://localhost:!PORT! and http://localhost:!PORT! ...
start "EDF Server (Port !PORT!)" cmd /k "cd /d "%~dp0" && node server.js"

:: Wait briefly for server to bind port
timeout /t 2 /nobreak >nul

echo.
echo   Local HTTP  : http://localhost:!PORT!
echo   Local HTTPS : https://localhost:!PORT!
echo   Public URL  : https://edf.mkctc.cc
echo   Tunnel Name : !CLOUDFLARE_TUNNEL_NAME! ^(!CLOUDFLARE_TUNNEL_ID!^)
echo.

:: 3. Connect Cloudflare Tunnel automatically
echo [3/3] Connecting Cloudflare Tunnel (!CLOUDFLARE_TUNNEL_NAME!)...
echo ============================================================================
echo.

if not "!CLOUDFLARE_TUNNEL_TOKEN!"=="" (
    if exist "%USERPROFILE%\.cloudflared\localhost-cert.pem" (
        "%CLOUDFLARED_EXE%" tunnel run --no-tls-verify --origin-ca-pool "%USERPROFILE%\.cloudflared\localhost-cert.pem" --token !CLOUDFLARE_TUNNEL_TOKEN!
    ) else (
        "%CLOUDFLARED_EXE%" tunnel run --no-tls-verify --token !CLOUDFLARE_TUNNEL_TOKEN!
    )
) else if exist "%USERPROFILE%\.cloudflared\edf-config.yml" (
    "%CLOUDFLARED_EXE%" tunnel --config "%USERPROFILE%\.cloudflared\edf-config.yml" run !CLOUDFLARE_TUNNEL_ID!
) else (
    echo [ERROR] CLOUDFLARE_TUNNEL_TOKEN is missing in .env!
    echo Please add CLOUDFLARE_TUNNEL_TOKEN=... to your .env file.
    pause
    exit /b 1
)

pause
