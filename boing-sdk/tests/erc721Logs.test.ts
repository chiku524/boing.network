import { describe, expect, it } from 'vitest';
import { ERC721_TRANSFER_TOPIC0_HEX, tryParseErc721TransferRpcLog } from '../src/erc721Logs.js';

describe('tryParseErc721TransferRpcLog', () => {
  it('parses 4-topic transfer', () => {
    const fromTopic =
      '0x000000000000000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const toTopic =
      '0x000000000000000000000000bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const tokenTopic =
      '0x00000000000000000000000000000000000000000000000000000000000007da';
    const p = tryParseErc721TransferRpcLog({
      block_height: 5,
      tx_index: 0,
      tx_id: '0xcc',
      log_index: 1,
      address: '0x' + 'dd'.repeat(32),
      topics: [ERC721_TRANSFER_TOPIC0_HEX, fromTopic, toTopic, tokenTopic],
      data: '0x',
    });
    expect(p?.tokenId).toBe(2010n);
    expect(p?.fromHex.endsWith('aa')).toBe(true);
    expect(p?.toHex.endsWith('bb')).toBe(true);
  });
});
