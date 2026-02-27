/**
 * Testnet configuration — single source for RPC URL and bootnodes.
 * Update before incentivized testnet launch. For production deploy, set
 * PUBLIC_TESTNET_RPC_URL (and optionally PUBLIC_BOOTNODES as comma-separated multiaddrs)
 * in your build environment so the faucet and testnet pages show the live URLs.
 */

const fromEnv = typeof import.meta !== 'undefined' && import.meta.env;
const env = fromEnv as Record<string, string | undefined> | undefined;

/** Public testnet RPC URL. Set PUBLIC_TESTNET_RPC_URL at build time to override. */
export const TESTNET_RPC_URL =
  (env && env.PUBLIC_TESTNET_RPC_URL) || 'https://testnet-rpc.boing.network/';

/**
 * Official testnet bootnode multiaddrs. Set PUBLIC_BOOTNODES (comma-separated)
 * at build time to override; otherwise edit this array before launch.
 */
export const BOOTNODES: string[] =
  env && env.PUBLIC_BOOTNODES
    ? env.PUBLIC_BOOTNODES.split(',').map((s) => s.trim()).filter(Boolean)
    : [
        // Fallback when env not set; prefer PUBLIC_BOOTNODES at build time
        '/ip4/73.84.106.121/tcp/4001',
      ];

/** Whether the testnet is "live" (we have at least one bootnode and a non-local RPC). */
export const isTestnetLive =
  BOOTNODES.length > 0 &&
  !TESTNET_RPC_URL.includes('127.0.0.1') &&
  !TESTNET_RPC_URL.includes('localhost');
