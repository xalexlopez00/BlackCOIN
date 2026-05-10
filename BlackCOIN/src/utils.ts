import * as CryptoJS from 'crypto-js';
import { Block, Transaction } from './types';

export function getTransactionId(tx: Transaction): string {
  const txInContent = tx.txIns
    .map(ti => ti.txOutId + ti.txOutIndex)
    .reduce((a, b) => a + b, '');
  const txOutContent = tx.txOuts
    .map(to => to.address + to.amount)
    .reduce((a, b) => a + b, '');
  return CryptoJS.SHA256(txInContent + txOutContent + tx.timestamp + (tx.message || '')).toString();
}

export function calculateHash(
  index: number,
  previousHash: string,
  timestamp: number,
  data: Transaction[],
  difficulty: number,
  nonce: number
): string {
  const dataStr = data.map(t => t.id).join('');
  return CryptoJS.SHA256(
    index + previousHash + timestamp + dataStr + difficulty + nonce
  ).toString();
}

export function calculateHashForBlock(block: Block): string {
  return calculateHash(
    block.index, block.previousHash, block.timestamp,
    block.data, block.difficulty, block.nonce
  );
}

export function hashMatchesDifficulty(hash: string, difficulty: number): boolean {
  const prefix = '0'.repeat(difficulty);
  return hash.startsWith(prefix);
}
