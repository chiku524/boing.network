# Boing SDK

TypeScript/JavaScript client for [Boing Network](https://github.com/chiku524/boing.network): typed RPC client, hex utilities, and structured errors (including QA rejection feedback).

## Install

```bash
npm install
npm run build
```

Or from a parent repo (when published): `npm install boing-sdk`.

## Quick start

```ts
import { createClient, BoingRpcError } from 'boing-sdk';

const client = createClient('http://localhost:8545');

// Read chain and account state
const height = await client.chainHeight();
const account = await client.getAccount('0x' + '00'.repeat(32)); // 32-byte hex
console.log(account.balance, account.nonce, account.stake);

// Pre-flight QA check before deploying a contract
const qa = await client.qaCheck('0x600160005260206000f3'); // hex bytecode
if (qa.result === 'reject') {
  console.error('QA rejected:', qa.rule_id, qa.message);
} else if (qa.result === 'allow') {
  // Submit signed tx (hex from Rust CLI or future signer)
  await client.submitTransaction(hexSignedTx);
}

// Handle structured QA errors on submit
try {
  await client.submitTransaction(hexSignedTx);
} catch (e) {
  if (e instanceof BoingRpcError && e.isQaRejected) {
    const { rule_id, message } = e.qaData ?? {};
    console.error('Deployment rejected:', rule_id, message);
  }
  throw e;
}
```

## API

- **createClient(config)** — `config` can be a URL string or `{ baseUrl, fetch?, timeoutMs? }`. Default timeout 30s; set `timeoutMs: 0` to disable.
- **BoingClient** — typed methods for all RPCs (32-byte account/hash params are validated locally before sending):
  - `chainHeight()`, `getBalance(hexAccountId)`, `getAccount(hexAccountId)`
  - `getBlockByHeight(height)`, `getBlockByHash(hexHash)`
  - `getAccountProof(hexAccountId)`, `verifyAccountProof(hexProof, hexStateRoot)`
  - `simulateTransaction(hexSignedTx)`, `submitTransaction(hexSignedTx)`
  - `registerDappMetrics(hexContract, hexOwner)`, `submitIntent(hexSignedIntent)`
  - `qaCheck(hexBytecode, purposeCategory?, descriptionHash?, assetName?, assetSymbol?)` — pre-flight QA without submitting (same param order as node `boing_qaCheck`)
  - `qaPoolList()`, `qaPoolConfig()`, `qaPoolVote(txHashHex, voterHex, vote)` — governance QA pool for Unsure deploys
  - `faucetRequest(hexAccountId)` — testnet only
- **BoingRpcError** — `code`, `message`, `data`, `method`; `isQaRejected`, `isQaPendingPool`, `pendingPoolTxHash`, `isQaPoolDisabled`, `isQaPoolFull`, `isQaPoolDeployerCap`, `qaData`; `toString()` for logging.
- **Hex helpers** — `ensureHex`, `bytesToHex`, `hexToBytes`, `accountIdToHex`, `hexToAccountId`, `validateHex32` (normalize + require 32 bytes).

All 32-byte IDs (account, hash) are hex strings with or without `0x` prefix. Invalid hex or wrong length throws before the request.

## Submitting transactions

The node expects **hex-encoded bincode-serialized SignedTransaction**. To produce that today:

1. Use the **Rust CLI** in this repo: `cargo run -p boing-cli -- dev` (local chain) and sign/build txs via the CLI.
2. Use **boing_simulateTransaction** and **boing_qaCheck** from this SDK to validate before submitting.
3. **Boing Express** (browser extension) can sign deploy txs via `boing_signTransaction` / `boing_sendTransaction` using `contract_deploy_purpose` or `contract_deploy_meta` with a **valid `purpose_category`** (protocol QA). Bare `contract_deploy` is not accepted from dApp injection so deployments carry an explicit QA declaration.
4. A future release may add a JS/TS signer in this package or JSON-submit on the node.

**Protocol QA:** Every **ContractDeploy** is checked in the **mempool** (`boing_qa`) before acceptance. Declaring purpose and optional metadata aligns client preflight (`boing_qaCheck`) with the same rules. See [QUALITY-ASSURANCE-NETWORK.md](../docs/QUALITY-ASSURANCE-NETWORK.md).

See [RPC-API-SPEC.md](../docs/RPC-API-SPEC.md) and [BUILD-ROADMAP.md](../docs/BUILD-ROADMAP.md).

## Planned

- Transaction builder and optional signing (when bincode/encoding is available in JS or node accepts JSON).
- CLI auto-completion, contract templates, tutorials. See [DEVELOPMENT-AND-ENHANCEMENTS.md](../docs/DEVELOPMENT-AND-ENHANCEMENTS.md).
