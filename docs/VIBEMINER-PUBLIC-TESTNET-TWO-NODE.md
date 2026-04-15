# VibeMiner on Windows — public testnet (validator + full node)

**Goal:** Run **one validator** and **one full node** on separate Windows PCs with VibeMiner, both **joined to the same public Boing testnet** (not a private genesis lab).

**Bottom line:** This layout is **enough** for healthy testnet participation. You do **not** need Docker, systemd, or a Cloudflare tunnel unless you also want to **publish** JSON-RPC to the internet (separate goal).

---

## What you already satisfy

| Need | VibeMiner + official listing |
|------|------------------------------|
| Correct **`boing-node` build** | Zips from **`GET https://boing.network/api/networks`** (merged with app defaults); bump when the network bumps the tag. |
| **Bootnodes + P2P** | Presets pass **`--bootnodes`** and **`--p2p-listen`**; your nodes dial into the mesh. |
| **Same chain / genesis** | Same download + same network id as other testnet participants. |
| **Validator** | One machine with **`--validator`** and a staked account that can propose when elected. |
| **Full node** | Second machine **without** **`--validator`** — syncs, relays gossip, serves **local** RPC for your tools. |

---

## What you should verify on your side

1. **Firewall / router**
   - **Outbound TCP 4001** (and TCP to bootnode IPs) must work from both PCs.
   - **Inbound TCP 4001** is **recommended** so other peers can dial you; without it you may still sync via outbound dials, but mesh health is weaker behind symmetric NAT.

2. **Two distinct roles**
   - **Validator** machine: only one active validator identity per **staked key**; do not run the **same** validator keys on two machines at once.
   - **Full node** machine: no stake requirement; safe second box.

3. **Binary freshness**
   - If the network ships a new **`boing-node`** for consensus or RPC fixes, update the **node download URL** / tag in the listing (and VibeMiner pin per [VIBEMINER-INTEGRATION.md](VIBEMINER-INTEGRATION.md) §6) so both PCs pull a current zip.

4. **“Am I on the same chain as public RPC?”**
   - From either PC (with a local node running), use the repo helper (no SDK build):

     ```bash
     npm run compare-local-public-tip
     ```

     Optional env:

     - **`BOING_LOCAL_RPC_URL`** — default `http://127.0.0.1:8545` (use `http://<LAN-ip>:8545` from a **third** machine to probe your full node).
     - **`BOING_PUBLIC_RPC_URL`** — default `https://testnet-rpc.boing.network/`
     - **`BOING_SYNC_MAX_LAG`** — default `256` (exit **2** if local tip is farther behind).

5. **Optional: tunnel + indexer**
   - **Tunnel:** only if you want **others** to use **your** RPC URL (wallets, team). Not required to *join* testnet.
   - **Indexer / Workers:** L2 convenience for explorers and analytics; not required for consensus or for you to develop against **public** RPC + your local node.

---

## Related docs

- [VIBEMINER-INTEGRATION.md](VIBEMINER-INTEGRATION.md) — listings, **`/api/networks`**, §5.2 native AMM expectations.
- [TESTNET.md](TESTNET.md) — bootnodes, chain id **6913** (`0x1b01`), join flow.
- [RUNBOOK.md](RUNBOOK.md) §8 — public RPC, tunnel **530** / **1033** behavior.
- [PRE-VIBEMINER-NODE-COMMANDS.md](PRE-VIBEMINER-NODE-COMMANDS.md) — **`preflight-rpc`**, **`check-testnet-rpc`**.

---

*Boing Network — Authentic. Decentralized. Optimal. Sustainable.*
