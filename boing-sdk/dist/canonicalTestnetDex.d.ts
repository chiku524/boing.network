/**
 * **Live native DEX aux** on public Boing testnet RPC (`https://testnet-rpc.boing.network`, chain **6913**).
 * Deployed via `npm run deploy-native-dex-full-stack` (operator record: `docs/NATIVE-DEX-OPERATOR-DEPLOYMENT-RECORD.md` Appendix B).
 *
 * **V1 ledger router** is optional (`BOING_AUX_INCLUDE_LEDGER_V1`); this stack ships swap2 + v2 + v3 forwarders only.
 * `CANONICAL_BOING_TESTNET_NATIVE_DEX_LEDGER_ROUTER_V1_HEX` remains a legacy CREATE2 prediction id — do not assume it is deployed.
 */
export declare const CANONICAL_BOING_TESTNET_NATIVE_DEX_DEPLOYER_HEX: string;
export declare const CANONICAL_BOING_TESTNET_NATIVE_DEX_FACTORY_HEX: string;
/** Legacy predicted v1 — not deployed on the current testnet-rpc full-stack bundle unless aux includes v1. */
export declare const CANONICAL_BOING_TESTNET_NATIVE_DEX_LEDGER_ROUTER_V1_HEX: string;
export declare const CANONICAL_BOING_TESTNET_NATIVE_DEX_LEDGER_ROUTER_V2_HEX: string;
export declare const CANONICAL_BOING_TESTNET_NATIVE_DEX_LEDGER_ROUTER_V3_HEX: string;
export declare const CANONICAL_BOING_TESTNET_NATIVE_DEX_MULTIHOP_SWAP_ROUTER_HEX: string;
export declare const CANONICAL_BOING_TESTNET_NATIVE_AMM_LP_VAULT_HEX: string;
export declare const CANONICAL_BOING_TESTNET_NATIVE_LP_SHARE_TOKEN_HEX: string;
//# sourceMappingURL=canonicalTestnetDex.d.ts.map