@echo off
REM Bootnode 2 — Secondary machine. Connects to Bootnode 1 to form the testnet.
REM
REM 1. Replace BOOTNODE_1_IP with your primary machine's public IP (run "curl -s ifconfig.me" on primary).
REM 2. Ensure firewall allows TCP 4001 (P2P) inbound on this machine.
REM 3. After running, share this machine's public IP to add to PUBLIC_BOOTNODES.

cd /d "%~dp0.."
if not exist "target\release\boing-node.exe" (
    echo Building boing-node...
    cargo build --release
)

set BOOTNODE_1_IP=REPLACE_WITH_PRIMARY_IP
set BOOTNODES=/ip4/%BOOTNODE_1_IP%/tcp/4001

echo Starting Bootnode 2 (validator)...
echo P2P: 0.0.0.0:4001
echo Connecting to Bootnode 1: %BOOTNODES%
echo RPC: http://127.0.0.1:8546 (different port to avoid conflict if both on same machine)
echo.
echo Your public IP: run "curl -s ifconfig.me" — add to website config as second bootnode.
echo.

target\release\boing-node.exe --p2p-listen /ip4/0.0.0.0/tcp/4001 --bootnodes %BOOTNODES% --validator --rpc-port 8546 --data-dir ./bootnode2-data
