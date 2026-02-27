# How to Pass Protocol QA — Deployer Checklist

> **Purpose:** Quick reference for developers deploying contracts on Boing Network.  
> **Full spec:** [QUALITY-ASSURANCE-NETWORK.md](QUALITY-ASSURANCE-NETWORK.md)

---

## Pre-flight: Use `boing_qaCheck` First

Before submitting a deployment, run a pre-flight check:

```bash
# RPC call (replace with your RPC URL)
curl -s -X POST http://127.0.0.1:8545/ -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"boing_qaCheck","params":["0x<hex_bytecode>","meme",""]}'
```

Result will be `allow`, `reject`, or `unsure`. If `reject`, the response includes `rule_id` and `message`.

---

## Hard Rules (Must Pass)

| Rule | Limit | Action |
|------|-------|--------|
| **Bytecode size** | ≤ 32 KiB | Shrink or split contract |
| **Valid opcodes only** | Stop, Add, Sub, Mul, MLoad, MStore, SLoad, SStore, Jump, JumpI, Push1..Push32, Return | Remove invalid bytes |
| **Well-formed** | No truncated PUSH, no trailing bytes | Fix bytecode stream |
| **Not blocklisted** | Bytecode hash not in blocklist | Contact governance if wrongly blocked |
| **Purpose (if provided)** | Must be valid category | Use one of the valid categories below |

---

## Valid Purpose Categories

- **dApp** / **dapp**
- **token**
- **NFT** / **nft**
- **meme**
- **community**
- **entertainment**
- **tooling**
- **other** (provide description hash for best outcome)

---

## Transaction Formats

**Legacy (no purpose):**
```rust
ContractDeploy { bytecode }
```

**With purpose (recommended):**
```rust
ContractDeployWithPurpose {
    bytecode,
    purpose_category: "meme",
    description_hash: None,  // or Some(hash) for "other"
}
```

---

## Common Rejections and Fixes

| rule_id | Cause | Fix |
|---------|-------|-----|
| `MAX_BYTECODE_SIZE` | Bytecode > 32 KiB | Reduce size or split |
| `INVALID_OPCODE` | Byte contains non-Boing opcode | Use only Boing VM opcodes |
| `MALFORMED_BYTECODE` | Truncated PUSH or trailing bytes | Validate instruction stream |
| `BLOCKLIST_MATCH` | Hash matches known scam/malware | Cannot deploy; contact if error |
| `SCAM_PATTERN_MATCH` | Contains known malicious pattern | Remove or refactor |
| `PURPOSE_DECLARATION_INVALID` | Invalid category | Use valid category from list above |

---

## When You Get "Unsure"

"Unsure" means the deployment is referred to the community QA pool. Common triggers:

- **Purpose = "other"** with minimal or no description
- **Category in "always review"** list (e.g. governance-defined high-stakes categories)

Provide a clear purpose category and (for "other") a description hash to reduce pool referrals.

---

## Meme and Community Assets

**Meme, community, and entertainment are valid purposes.** No extra justification required. Same QA bar as other categories: pass specs and avoid blocklist/scam patterns.

---

*Boing Network — Authentic. Decentralized. Optimal. Sustainable.*
