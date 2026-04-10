/**
 * Well-known **public Boing testnet** (chain id **6913**) identifiers.
 *
 * **Normative source of truth** for the canonical native CP pool address is
 * [RPC-API-SPEC.md](https://github.com/Boing-Network/boing.network/blob/main/docs/RPC-API-SPEC.md) § Native constant-product AMM
 * and [TESTNET.md](https://github.com/Boing-Network/boing.network/blob/main/docs/TESTNET.md) §5.3.
 * This constant is a **convenience mirror** for TypeScript apps and tutorials; it may lag a doc-only update — verify on docs if unsure.
 */

import { validateHex32 } from './hex.js';

/**
 * Canonical **v1** native constant-product pool `AccountId` on public Boing testnet (**6913**).
 * Rotations: [OPS-FRESH-TESTNET-BOOTSTRAP.md](../../docs/OPS-FRESH-TESTNET-BOOTSTRAP.md).
 */
/** Live stack on `https://testnet-rpc.boing.network` — see `docs/NATIVE-DEX-OPERATOR-DEPLOYMENT-RECORD.md` Appendix B. */
export const CANONICAL_BOING_TESTNET_NATIVE_CP_POOL_HEX = validateHex32(
  '0x7247ddc3180fdc4d3fd1e716229bfa16bad334a07d28aa9fda9ad1bfa7bdacc3',
);
