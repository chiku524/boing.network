/**
 * **Predicted CREATE2** addresses for native DEX aux contracts when deployed by the canonical pool deployer.
 * Regenerate: `cargo run -p boing-execution --example print_native_create2_manifest -- <DEPLOYER_HEX>`.
 * Mirror of `scripts/canonical-testnet-dex-predicted.json`.
 */
import { validateHex32 } from './hex.js';
export const CANONICAL_BOING_TESTNET_NATIVE_DEX_DEPLOYER_HEX = validateHex32('0xc063512f42868f1278c59a1f61ec0944785c304dbc48dec7e4c41f70f666733f');
export const CANONICAL_BOING_TESTNET_NATIVE_DEX_FACTORY_HEX = validateHex32('0x12dff97625620a1f10c05cd66cd72878288e8fea70d4150e9815bd38983b2890');
export const CANONICAL_BOING_TESTNET_NATIVE_DEX_LEDGER_ROUTER_V1_HEX = validateHex32('0x371b4cd7e3b88e06e6b89bdc86214918a7e7ec73b62deb7f9975e4166736d54d');
export const CANONICAL_BOING_TESTNET_NATIVE_DEX_LEDGER_ROUTER_V2_HEX = validateHex32('0x60a232b91d6f86a61d037ea6ea0fb769897f983c8e0d399e3df5189d00868992');
export const CANONICAL_BOING_TESTNET_NATIVE_DEX_LEDGER_ROUTER_V3_HEX = validateHex32('0xfb552619b27dacacba52b62d97cd171eabe4a74dac262ecb0e8735284d7555ba');
export const CANONICAL_BOING_TESTNET_NATIVE_DEX_MULTIHOP_SWAP_ROUTER_HEX = validateHex32('0x43a6410510e7d742db8366347a343af6f7d2d1aec39b8281677d5643a7fc110b');
export const CANONICAL_BOING_TESTNET_NATIVE_AMM_LP_VAULT_HEX = validateHex32('0x2b195b93a57b632ca3c1cf58cb7578542a6d58998116cddb8a6a50f1bd652f48');
export const CANONICAL_BOING_TESTNET_NATIVE_LP_SHARE_TOKEN_HEX = validateHex32('0x0618b4a6a30bc31822a0cdcf253ed2bcf642a6cecf26346ba655b63fccbde03c');
