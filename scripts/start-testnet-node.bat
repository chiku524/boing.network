@echo off
REM Start Boing node (bootnode + faucet) for Computer 1.
REM Run this in one terminal. Keep it open.

cd /d "%~dp0.."
if not exist "target\release\boing-node.exe" (
    echo Building boing-node...
    cargo build --release
)

echo Starting Boing node (bootnode + faucet)...
echo RPC: http://127.0.0.1:8545
echo P2P: port 4001
target\release\boing-node.exe --p2p-listen /ip4/0.0.0.0/tcp/4001 --validator --faucet-enable --rpc-port 8545 --data-dir ./boing-data
