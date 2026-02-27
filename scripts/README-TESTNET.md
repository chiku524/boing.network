# Boing Testnet — Run Instructions

> **Full setup guide:** See [scripts/INFRASTRUCTURE-SETUP.md](INFRASTRUCTURE-SETUP.md) for step-by-step infrastructure setup.

## Computer 1 (Primary — bootnode + faucet + public RPC)

**Order:** Start node first, then tunnel.

### Terminal 1 — Node
```bat
scripts\start-bootnode-1.bat
```

Or use the legacy script:
```bat
scripts\start-testnet-node.bat
```

### Terminal 2 — Cloudflare tunnel
```bat
scripts\start-cloudflare-tunnel.bat
```

**Public RPC:** https://testnet-rpc.boing.network/

Get your public IP: `curl -s ifconfig.me` — share with Computer 2.

---

## Computer 2 (Secondary — Bootnode 2)

1. **Build:** `cargo build --release`

2. **Edit** `scripts\start-bootnode-2.bat` — replace `REPLACE_WITH_PRIMARY_IP` with Computer 1's public IP.

3. **Run:**
```bat
scripts\start-bootnode-2.bat
```

**Linux/macOS:**
```bash
BOOTNODE_1_IP=73.84.106.121 ./scripts/start-bootnode-2.sh
```

4. **Get Computer 2's public IP:** `curl -s ifconfig.me` — add to `PUBLIC_BOOTNODES`.

---

## Deploy website

Set in **GitHub → Settings → Secrets and variables → Actions → Variables**:

| Variable | Value |
|----------|-------|
| `PUBLIC_TESTNET_RPC_URL` | `https://testnet-rpc.boing.network/` |
| `PUBLIC_BOOTNODES` | `/ip4/PRIMARY_IP/tcp/4001,/ip4/SECONDARY_IP/tcp/4001` |

Then push to `main`; the deploy workflow will use them.
