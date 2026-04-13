import { describe, expect, it } from 'vitest';
import { bytesToHex, hexToBytes } from '../src/hex.js';
import { predictNonceDerivedContractAddress } from '../src/create2.js';
import {
  extractUniversalContractDeploymentsFromBlockJson,
  rpcTransactionJsonToTransactionInput,
  transactionIdFromUnsignedRpcTransaction,
} from '../src/universalContractDeployIndex.js';

function bytes32(fill: number): number[] {
  return Array(32).fill(fill);
}

describe('universalContractDeployIndex', () => {
  it('predicts nonce-derived deploy address and stable tx id', () => {
    const senderArr = bytes32(0x11);
    const bytecode = [1, 2, 3, 4];
    const txJson = {
      nonce: 0,
      sender: senderArr,
      payload: {
        ContractDeploy: {
          bytecode,
          create2_salt: null,
        },
      },
      access_list: {
        read: [senderArr],
        write: [senderArr],
      },
    };
    const senderHex = bytesToHex(Uint8Array.from(senderArr)) as `0x${string}`;
    const predicted = predictNonceDerivedContractAddress(senderHex, 0n);
    expect(() => rpcTransactionJsonToTransactionInput(txJson)).not.toThrow();
    const rows = extractUniversalContractDeploymentsFromBlockJson(42, [txJson]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.contractHex).toBe(predicted.toLowerCase());
    expect(rows[0]!.blockHeight).toBe(42);
    expect(rows[0]!.txIndex).toBe(0);
    expect(rows[0]!.payloadKind).toBe('ContractDeploy');
    const tid = transactionIdFromUnsignedRpcTransaction(txJson);
    expect(rows[0]!.txIdHex).toBe(tid);
    expect(tid.startsWith('0x')).toBe(true);
    expect(tid.length).toBe(66);
  });

  it('ignores non-deploy transactions', () => {
    const senderArr = bytes32(3);
    const toArr = bytes32(4);
    const txJson = {
      nonce: 1,
      sender: senderArr,
      payload: {
        Transfer: { to: toArr, amount: '1000' },
      },
      access_list: { read: [senderArr, toArr], write: [senderArr, toArr] },
    };
    const rows = extractUniversalContractDeploymentsFromBlockJson(1, [txJson]);
    expect(rows).toHaveLength(0);
  });

  it('parses hex string sender and bytecode', () => {
    const senderHex = `0x${'22'.repeat(32)}`;
    const senderU8 = hexToBytes(senderHex);
    const senderArr = [...senderU8];
    const bytecodeHex = '0x010203';
    const predicted = predictNonceDerivedContractAddress(senderHex, 5n);
    const txJson = {
      nonce: 5,
      sender: senderHex,
      payload: {
        ContractDeploy: {
          bytecode: bytecodeHex,
          create2_salt: null,
        },
      },
      access_list: {
        read: [senderArr],
        write: [senderArr],
      },
    };
    const rows = extractUniversalContractDeploymentsFromBlockJson(9, [txJson]);
    expect(rows[0]!.contractHex).toBe(predicted.toLowerCase());
  });
});
