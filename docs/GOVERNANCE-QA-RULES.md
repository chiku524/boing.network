# Governance-Mutable QA Rules

> **Purpose:** How to update protocol QA rules (including the content blocklist for vulgarity/offensiveness) via governance so that vulgar and offensive assets are not deployed. All QA rule sets are **mutable** through the standard governance process.

---

## 1. What Can Be Updated

The following are **governance-mutable**:

| Item | Description |
|------|-------------|
| **Content blocklist** | Forbidden substrings in asset name/symbol (vulgarity, offensiveness). Case-insensitive. When a deploy includes `asset_name` or `asset_symbol` (see `ContractDeployWithPurposeAndMetadata`), any term on this list causes **Reject** (`CONTENT_POLICY_VIOLATION`). |
| **Bytecode blocklist** | Hashes of known scam/malware bytecode. Match → Reject. |
| **Scam patterns** | Byte sequences that, if found in bytecode, → Reject. |
| **Always-review categories** | Purpose categories that always go to the community QA pool (Unsure). |
| **Max bytecode size** | Governance can change the limit (e.g. 32 KiB). |

---

## 2. Governance Flow

1. **Propose** — Create a governance proposal with:
   - **target_key:** `qa_registry` (see `boing_qa::GOVERNANCE_QA_REGISTRY_KEY`)
   - **target_value:** JSON-serialized `RuleRegistry` (see below).

2. **Vote / cooling / execution** — Use the existing phased governance (Proposal → Cooling → Execution). When the proposal is **executed**, the node (or operator) applies the new registry:
   - Deserialize: `boing_qa::rule_registry_from_json(&target_value)`.
   - Replace the in-memory QA rule registry used by the mempool and RPC with this registry.

3. **Persistence** — Nodes that support config persistence should save the updated registry (e.g. to `qa_registry.json`) so it survives restarts until the next governance update.

---

## 3. JSON Format for `RuleRegistry`

The `target_value` is a JSON object with the same shape as `RuleRegistry`:

```json
{
  "max_bytecode_size": 32768,
  "blocklist": ["<base64 or hex of 32-byte hashes>"],
  "scam_patterns": ["<base64 or hex of byte sequences>"],
  "always_review_categories": ["token", "financial"],
  "content_blocklist": ["term1", "term2", "slur1", "vulgar_word"]
}
```

- **content_blocklist:** List of forbidden substrings. Deployment metadata (asset_name, asset_symbol) is checked case-insensitively; if any string in the list appears as a substring, the deploy is **Reject**ed with `CONTENT_POLICY_VIOLATION`.
- **blocklist:** In Rust `RuleRegistry` this is `Vec<[u8; 32]>`. In JSON you can use an array of hex strings (64 chars) or base64.
- **scam_patterns:** In Rust `Vec<Vec<u8>>`. In JSON use an array of hex or base64 strings.

Governance should maintain a **content_blocklist** of terms that the network does not allow in asset names or symbols (vulgarity, slurs, offensiveness). Add or remove terms by proposing a new full `RuleRegistry` JSON with the updated list.

---

## 4. Deploy-Time Metadata (Asset Name / Symbol)

To have content policy apply, deployers must use the **ContractDeployWithPurposeAndMetadata** payload and supply optional `asset_name` and/or `asset_symbol`:

- **asset_name:** Optional, max 256 UTF-8 bytes. Checked against `content_blocklist`.
- **asset_symbol:** Optional, max 32 UTF-8 bytes. Checked against `content_blocklist`.

If the deploy uses the legacy **ContractDeploy** or **ContractDeployWithPurpose** (without metadata), no name/symbol is checked and content policy does not apply. Wallets and CLI should be updated to support the new payload and to pass name/symbol when deploying tokens or NFTs so that vulgar/offensive names can be rejected.

---

## 5. RPC and SDK

- **boing_qaCheck** accepts optional params: `[hex_bytecode, purpose_category?, description_hash?, asset_name?, asset_symbol?]`. Use the last two to pre-flight content policy.
- **boing_submitTransaction** — When building a deploy tx, use the payload variant that includes `asset_name` and `asset_symbol` if you want them checked.

---

## 6. Summary

- **Content blocklist** is governance-mutable; add forbidden terms (vulgarity, offensiveness) via proposals.
- **Full registry** (blocklist, scam patterns, always-review categories, max size) is replaceable by executing a governance proposal with key `qa_registry` and value = JSON `RuleRegistry`.
- Deploy payload **ContractDeployWithPurposeAndMetadata** carries optional asset name/symbol; QA rejects if they contain any governance-forbidden term.

*Boing Network — Authentic. Decentralized. Quality-assured.*
