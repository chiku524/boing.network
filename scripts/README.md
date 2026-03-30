# Boing Testnet Scripts

Scripts for running bootnodes and the Cloudflare tunnel.

| Script | Purpose |
|--------|---------|
| `start-bootnode-1.bat` / `.sh` | Primary bootnode (validator + faucet + RPC) |
| `start-bootnode-2.bat` / `.sh` | Secondary bootnode |
| `start-cloudflare-tunnel.bat` | Expose RPC at testnet-rpc.boing.network |
| `verify-public-testnet-rpc.mjs` | Check `boing_chainHeight`, `boing_getQaRegistry`, `boing_qaPoolConfig` on the public RPC (`TESTNET_RPC_URL` optional) |

**Full setup guide:** [docs/INFRASTRUCTURE-SETUP.md](../docs/INFRASTRUCTURE-SETUP.md)
