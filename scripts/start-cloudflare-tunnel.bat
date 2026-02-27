@echo off
REM Start Cloudflare tunnel for testnet-rpc.boing.network.
REM Run this AFTER the node is running. Keep it open.
REM Requires: .cloudflared/cloudflared.exe and config in %USERPROFILE%\.cloudflared\

cd /d "%~dp0.."
if not exist ".cloudflared\cloudflared.exe" (
    echo Error: .cloudflared\cloudflared.exe not found.
    echo Run the Cloudflare tunnel setup first.
    pause
    exit /b 1
)

echo Starting Cloudflare tunnel (testnet-rpc.boing.network -> 127.0.0.1:8545)...
.cloudflared\cloudflared.exe tunnel --config "%USERPROFILE%\.cloudflared\config.yml" run boing-testnet-rpc
