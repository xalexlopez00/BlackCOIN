import _ from 'lodash';
import { Transaction, TxIn, UnspentTxOut } from './types';
import { validateTransaction } from './transaction';
import { db } from './database';
import { logger } from './logger';

let transactionPool: Transaction[] = [];

export function initTransactionPool(): void {
  transactionPool = db.loadTransactionPool();
  logger.info(`Transaction pool loaded: ${transactionPool.length} transactions`);
}

export function getTransactionPool(): Transaction[] {
  return _.cloneDeep(transactionPool);
}

export function addToTransactionPool(tx: Transaction, unspentTxOuts: UnspentTxOut[]): void {
  if (!validateTransaction(tx, unspentTxOuts)) {
    throw new Error('Invalid transaction');
  }
  if (!isValidTxForPool(tx, transactionPool)) {
    throw new Error('Transaction already in pool');
  }
  transactionPool.push(tx);
  db.saveTransactionPool(transactionPool);
  logger.debug(`Transaction added to pool: ${tx.id}`);
}

export function updateTransactionPool(unspentTxOuts: UnspentTxOut[]): void {
  const invalid: Transaction[] = [];
  for (const tx of transactionPool) {
    for (const txIn of tx.txIns) {
      const found = unspentTxOuts.find(
        u => u.txOutId === txIn.txOutId && u.txOutIndex === txIn.txOutIndex
      );
      if (!found) {
        invalid.push(tx);
        break;
      }
    }
  }
  if (invalid.length > 0) {
    transactionPool = _.without(transactionPool, ...invalid);
    db.saveTransactionPool(transactionPool);
    logger.info(`Removed ${invalid.length} invalid transactions from pool`);
  }
}

export function clearTransactionPool(): void {
  transactionPool = [];
  db.saveTransactionPool([]);
  logger.debug('Transaction pool cleared');
}

function isValidTxForPool(tx: Transaction, pool: Transaction[]): boolean {
  const poolIns: TxIn[] = _(pool)
    .map(t => t.txIns)
    .flatten()
    .value();

  for (const txIn of tx.txIns) {
    const exists = poolIns.find(
      pi => pi.txOutId === txIn.txOutId && pi.txOutIndex === txIn.txOutIndex
    );
    if (exists) return false;
  }
  return true;
}
