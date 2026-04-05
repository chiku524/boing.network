# Network go-live checklist (operators)

**Audience:** You are about to bring **bootnodes**, **public JSON-RPC**, and **faucet** online so wallets, explorers, and scripts work. This complements [READINESS.md](READINESS.md) §3 (critical path) and [TESTNET.md](TESTNET.md). **Single routing map (testnet + RPC + infra):** [TESTNET-RPC-INFRA.md](TESTNET-RPC-INFRA.md). **Umbrella ops narrative:** [TESTNET-OPS-RUNBOOK.md](TESTNET-OPS-RUNBOOK.md).

**Software in this repo** should already build and test clean (`cargo test`, `boing-sdk` `npm test`) per [READINESS.md](READINESS.md) §1.1. This doc is **runtime / infra order** once binaries are ready.

---

## 1. Order of operations

1. **Same genesis everywhere** — All validators and full nodes must share one genesis (faucet account, chain id, etc.).
2. **Bootnodes** — At least two stable P2P listeners; publish multiaddrs on the website and in [TESTNET.md](TESTNET.md). See [INFRASTRUCTURE-SETUP.md](INFRASTRUCTURE-SETUP.md).
3. **Validators / block production** — Enough stake and connectivity that height advances.
4. **Public RPC** — `boing-node` with `--rpc-port` reachable (directly or via **Cloudflare Tunnel**). Set **`BOING_CHAIN_ID=6913`** and **`BOING_CHAIN_NAME=Boing Testnet`** on that process so **`boing_getNetworkInfo`** matches wallet chain **6913** ([`tools/boing-node-public-testnet.env.example`](../tools/boing-node-public-testnet.env.example), [RUNBOOK.md](RUNBOOK.md) §8). See [RUNBOOK.md](RUNBOOK.md) §8.3 for tunnels.
5. **Verify RPC from the internet** — Before announcing “testnet is up,” run the tutorial preflight (no keys):

   ```bash
   cd examples/native-boing-tutorial
   npm install
   export BOING_RPC_URL=https://your-public-rpc.example/
   npm run preflight-rpc
   ```

   Same as **`check-testnet-rpc`** plus a one-shot **`getSyncState`** sample; or use **`npm run check-testnet-rpc`** only. Optional full method matrix: **`BOING_PROBE_FULL=1 npm run preflight-rpc`** (or **`check-testnet-rpc`**). See [PRE-VIBEMINER-NODE-COMMANDS.md](PRE-VIBEMINER-NODE-COMMANDS.md).

6. **Faucet** — Node(s) behind the public URL should run with **`--faucet-enable`** if you expose `boing_faucetRequest`; confirm with a test account.
7. **Optional native AMM** — Deploy pool bytecode (CREATE2 recommended), publish canonical pool id per [OPS-CANONICAL-TESTNET-NATIVE-AMM-POOL.md](OPS-CANONICAL-TESTNET-NATIVE-AMM-POOL.md).

**Later upgrades** to the RPC node binary: [PUBLIC-RPC-NODE-UPGRADE-CHECKLIST.md](PUBLIC-RPC-NODE-UPGRADE-CHECKLIST.md).

---

## 2. Common failure: HTTP 530 / `error code: 1033`

Cloudflare returns **530** when the **tunnel cannot reach the origin** (RPC process down, wrong port, or tunnel not running). **No SDK or dApp fix** — restore `cloudflared` + `boing-node` on the origin. Details: [RUNBOOK.md](RUNBOOK.md) §8.3.

---

## 3. References

| Doc | Use |
|-----|-----|
| [READINESS.md](READINESS.md) | Build/test + launch-blocking table |
| [RUNBOOK.md](RUNBOOK.md) | Node flags, tunnel, monitoring |
| [TESTNET.md](TESTNET.md) | Bootnodes, faucet, user-facing URLs |
| [RPC-API-SPEC.md](RPC-API-SPEC.md) | Method reference |
| [examples/native-boing-tutorial/README.md](../examples/native-boing-tutorial/README.md) | `check-testnet-rpc`, `deploy-native-amm-pool` |
