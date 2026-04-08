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
export const CANONICAL_BOING_TESTNET_NATIVE_CP_POOL_HEX = validateHex32(
  '0xce4f819369630e89c4634112fdf01e1907f076bc30907f0402591abfca66518d',
);
