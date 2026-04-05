/**
 * Thin ergonomic wrapper around `submitContractCallWithSimulationRetry` for a fixed contract + signer.
 */

import type { BoingClient } from './client.js';
import {
  submitContractCallWithSimulationRetry,
  type SubmitContractCallWithSimulationOptions,
  type SubmitFlowResult,
} from './submitFlow.js';
import type { Ed25519SecretKey32 } from './transactionBuilder.js';

export interface NativeContractSubmitterConfig {
  client: BoingClient;
  secretKey32: Ed25519SecretKey32;
  senderHex: string;
  contractHex: string;
  /** Default access list for calls (signer + contract is typical). */
  accessList?: { read: string[]; write: string[] };
  maxSimulationRetries?: number;
}

/**
 * Factory for repeated `ContractCall` submits to one contract with shared signer/client options.
 */
export function createNativeContractSubmitter(config: NativeContractSubmitterConfig) {
  return {
    /** Submit arbitrary calldata with simulate → access-list retry → submit. */
    async submitCalldata(
      calldata: Uint8Array,
      overrides?: Pick<
        SubmitContractCallWithSimulationOptions,
        'accessList' | 'maxSimulationRetries'
      >
    ): Promise<SubmitFlowResult> {
      return submitContractCallWithSimulationRetry({
        client: config.client,
        secretKey32: config.secretKey32,
        senderHex: config.senderHex,
        contractHex: config.contractHex,
        calldata,
        accessList: overrides?.accessList ?? config.accessList,
        maxSimulationRetries: overrides?.maxSimulationRetries ?? config.maxSimulationRetries,
      });
    },
  };
}
