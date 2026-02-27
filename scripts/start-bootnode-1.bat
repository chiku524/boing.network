@echo off
REM Bootnode 1 — Primary (bootnode + faucet). Run on the machine with public IP and Cloudflare tunnel.
REM This node is the first bootstrap peer. Run start-cloudflare-tunnel.bat in another terminal to expose RPC.
REM
REM Replace BOOTNODE_2_IP below with your secondary machine's public IP once it is running.

cd /d "%~dp0.."
if not exist "target\release\boing-node.exe" (
    echo Building boing-node...
    cargo build --release
)

echo Starting Bootnode 1 (validator + faucet)...
echo P2P: 0.0.0.0:4001
echo RPC: http://127.0.0.1:8545
echo.
echo After starting, run start-cloudflare-tunnel.bat in another terminal.
echo Your public IP: curl -s ifconfig.me — share with Bootnode 2.
echo Optional: Add --bootnodes /ip4/SECONDARY_IP/tcp/4001 once Bootnode 2 is running.
echo.

target\release\boing-node.exe --p2p-listen /ip4/0.0.0.0/tcp/4001 --validator --faucet-enable --rpc-port 8545 --data-dir ./bootnode1-data
