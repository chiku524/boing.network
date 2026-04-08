# Native DEX deployment addresses (local copy)

Copy to **`DEPLOYMENT-ADDRESSES.local.md`** (gitignored) and fill in. Do **not** commit signing seeds.

The **LP vault** / **LP share** rows below list the **canonical public testnet** CREATE2 ids (deployer `0xc063…`, `npm run deploy-native-dex-lp-aux-contracts`); replace or clear if your deploy used nonce-derived addresses.

| Role | Account id (0x + 64 hex) | CREATE2 or nonce? |
|------|--------------------------|-------------------|
| Deployer (pubkey) | | |
| RPC URL | | |
| CP pool | | |
| Pair directory | | |
| Ledger router v1 | | |
| Ledger router v2 | | |
| Ledger router v3 | | |
| Multihop / swap2 router | | |
| LP vault (optional) | `0x2b195b93a57b632ca3c1cf58cb7578542a6d58998116cddb8a6a50f1bd652f48` | CREATE2 — matches **`canonical-testnet-dex-predicted.json`** when deploy script succeeds with **`create2: true`** |
| LP share token (optional) | `0x0618b4a6a30bc31822a0cdcf253ed2bcf642a6cecf26346ba655b63fccbde03c` | same |

**`register_pair`:** token_a | token_b | pool

**Scripts used:** `bootstrap-native-pool-and-dex`, `deploy-native-purpose-contract`, `deploy-native-dex-aux-contracts`, `deploy-native-dex-lp-aux-contracts`, `dump-native-bytecodes`.

**Reference:** [docs/NATIVE-DEX-OPERATOR-DEPLOYMENT-RECORD.md](../../docs/NATIVE-DEX-OPERATOR-DEPLOYMENT-RECORD.md)
