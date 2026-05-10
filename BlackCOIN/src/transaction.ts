import * as CryptoJS from 'crypto-js';
import * as ecdsa from 'elliptic';
import _ from 'lodash';
import { Transaction, TxIn, TxOut, UnspentTxOut } from './types';
import { isValidAddress, getPublicKey, getAddressFromPublicKey, getAddressFromPrivateKey, findUnspentTxOuts } from './wallet';
import { getTransactionId } from './utils';
import { logger } from './logger';

const ec = new ecdsa.ec('secp256k1');

export { getTransactionId };

export function getCoinbaseTransaction(address: string, blockIndex: number, amount?: number): Transaction {
  const t = new Transaction();
  const txIn = new TxIn();
  txIn.signature = '';
  txIn.txOutId = '';
  txIn.txOutIndex = blockIndex;

  t.txIns = [txIn];
  t.txOuts = [new TxOut(address, amount || 50)];
  t.timestamp = Date.now();
  t.id = getTransactionId(t);
  return t;
}

export function signTxIn(
  tx: Transaction,
  txInIndex: number,
  privateKey: string,
  aUnspentTxOuts: UnspentTxOut[]
): string {
  const txIn = tx.txIns[txInIndex];
  const dataToSign = tx.id;
  const referencedUTxOut = aUnspentTxOuts.find(
    u => u.txOutId === txIn.txOutId && u.txOutIndex === txIn.txOutIndex
  );
  if (!referencedUTxOut) {
    throw new Error('Could not find referenced txOut');
  }

  const referencedAddress = referencedUTxOut.address;
  if (getAddressFromPrivateKey(privateKey) !== referencedAddress) {
    throw new Error('Trying to sign input with wrong private key');
  }

  const key = ec.keyFromPrivate(privateKey, 'hex');
  const signature = key.sign(dataToSign).toDER();
  txIn.publicKey = getPublicKey(privateKey);
  return Array.from(signature, (b: any) => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function validateTxIn(
  txIn: TxIn,
  transaction: Transaction,
  aUnspentTxOuts: UnspentTxOut[]
): boolean {
  const referencedUTxOut = aUnspentTxOuts.find(
    u => u.txOutId === txIn.txOutId && u.txOutIndex === txIn.txOutIndex
  );
  if (!referencedUTxOut) {
    logger.debug(`Referenced txOut not found: ${JSON.stringify(txIn)}`);
    return false;
  }

  try {
    if (!txIn.publicKey) {
      logger.debug('Missing publicKey in txIn');
      return false;
    }
    if (getAddressFromPublicKey(txIn.publicKey) !== referencedUTxOut.address) {
      logger.debug('Public key does not match address');
      return false;
    }
    const key = ec.keyFromPublic(txIn.publicKey, 'hex');
    return key.verify(transaction.id, txIn.signature);
  } catch (e: any) {
    logger.debug(`Signature verification failed: ${e.message}`);
    return false;
  }
}

export function validateTransaction(
  tx: Transaction,
  aUnspentTxOuts: UnspentTxOut[]
): boolean {
  if (getTransactionId(tx) !== tx.id) {
    logger.debug(`Invalid tx id: ${tx.id}`);
    return false;
  }

  const hasValidTxIns = tx.txIns
    .map(ti => validateTxIn(ti, tx, aUnspentTxOuts))
    .reduce((a, b) => a && b, true);

  if (!hasValidTxIns) return false;

  const totalTxInValues = tx.txIns
    .map(ti => {
      const utxo = aUnspentTxOuts.find(
        u => u.txOutId === ti.txOutId && u.txOutIndex === ti.txOutIndex
      );
      return utxo ? utxo.amount : 0;
    })
    .reduce((a, b) => a + b, 0);

  const totalTxOutValues = tx.txOuts
    .map(to => to.amount)
    .reduce((a, b) => a + b, 0);

  if (totalTxOutValues > totalTxInValues) {
    logger.debug(`txOut (${totalTxOutValues}) > txIn (${totalTxInValues})`);
    return false;
  }

  return true;
}

export function validateBlockTransactions(
  transactions: Transaction[],
  unspentTxOuts: UnspentTxOut[],
  blockIndex: number
): boolean {
  const coinbaseTx = transactions[0];
  if (!validateCoinbaseTx(coinbaseTx, blockIndex)) {
    logger.debug('Invalid coinbase transaction');
    return false;
  }

  const txIns = _(transactions)
    .map(tx => tx.txIns)
    .flatten()
    .value();

  const groups = _.countBy(txIns, (ti: TxIn) => ti.txOutId + ti.txOutIndex);
  const hasDupes = _(groups)
    .map((v, k) => v > 1)
    .includes(true);

  if (hasDupes) {
    logger.debug('Duplicate txIns found');
    return false;
  }

  const normalTransactions = transactions.slice(1);
  return normalTransactions
    .map(tx => validateTransaction(tx, unspentTxOuts))
    .reduce((a, b) => a && b, true);
}

function validateCoinbaseTx(tx: Transaction, blockIndex: number): boolean {
  if (!tx) return false;
  if (getTransactionId(tx) !== tx.id) return false;
  if (tx.txIns.length !== 1) return false;
  if (tx.txIns[0].txOutIndex !== blockIndex) return false;
  if (tx.txOuts.length !== 1) return false;
  return true;
}

export function updateUnspentTxOuts(
  transactions: Transaction[],
  aUnspentTxOuts: UnspentTxOut[]
): UnspentTxOut[] {
  const newUnspentTxOuts: UnspentTxOut[] = transactions
    .map(t => t.txOuts.map((txOut, idx) => new UnspentTxOut(t.id, idx, txOut.address, txOut.amount)))
    .reduce((a, b) => a.concat(b), []);

  const consumedTxOuts = transactions
    .map(t => t.txIns)
    .reduce((a, b) => a.concat(b), [])
    .map(ti => new UnspentTxOut(ti.txOutId, ti.txOutIndex, '', 0));

  return aUnspentTxOuts
    .filter(u => !consumedTxOuts.find(c => c.txOutId === u.txOutId && c.txOutIndex === u.txOutIndex))
    .concat(newUnspentTxOuts);
}

export function processTransactions(
  transactions: Transaction[],
  aUnspentTxOuts: UnspentTxOut[],
  blockIndex: number
): UnspentTxOut[] | null {
  if (!validateBlockTransactions(transactions, aUnspentTxOuts, blockIndex)) {
    logger.error('Invalid block transactions');
    return null;
  }
  return updateUnspentTxOuts(transactions, aUnspentTxOuts);
}

export function findTxOutsForAmount(
  amount: number,
  myUnspentTxOuts: UnspentTxOut[]
): { includedUnspentTxOuts: UnspentTxOut[]; leftOverAmount: number } {
  let currentAmount = 0;
  const includedUnspentTxOuts: UnspentTxOut[] = [];

  for (const utxo of myUnspentTxOuts) {
    includedUnspentTxOuts.push(utxo);
    currentAmount += utxo.amount;
    if (currentAmount >= amount) {
      return { includedUnspentTxOuts, leftOverAmount: currentAmount - amount };
    }
  }

  throw new Error(
    `Insufficient balance: need ${amount}, have ${currentAmount}`
  );
}

export function createTransaction(
  receiverAddress: string,
  amount: number,
  senderPrivateKey: string,
  unspentTxOuts: UnspentTxOut[],
  txPool: Transaction[],
  message?: string
): Transaction {
  if (!isValidAddress(receiverAddress)) {
    throw new Error('Invalid receiver address');
  }
  if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
    throw new Error('Invalid amount');
  }
  if (amount > 1e15) {
    throw new Error('Amount exceeds maximum allowed (1e15)');
  }
  if (message && message.length > 280) {
    throw new Error('Message too long (max 280 characters)');
  }

  const myAddress = getAddressFromPrivateKey(senderPrivateKey);
  const myUtxos = unspentTxOuts.filter(u => u.address === myAddress);

  const poolTxIns = _(txPool)
    .map(tx => tx.txIns)
    .flatten()
    .value();

  const availableUtxos = myUtxos.filter(
    u => !poolTxIns.find(
      pi => pi.txOutId === u.txOutId && pi.txOutIndex === u.txOutIndex
    )
  );

  const { includedUnspentTxOuts, leftOverAmount } = findTxOutsForAmount(amount, availableUtxos);

  const tx = new Transaction();
  tx.txIns = includedUnspentTxOuts.map(u => {
    const ti = new TxIn();
    ti.txOutId = u.txOutId;
    ti.txOutIndex = u.txOutIndex;
    return ti;
  });

  tx.txOuts = [new TxOut(receiverAddress, amount)];
  if (leftOverAmount > 0) {
    tx.txOuts.push(new TxOut(myAddress, leftOverAmount));
  }

  tx.timestamp = Date.now();
  tx.message = message || '';
  tx.id = getTransactionId(tx);

  tx.txIns = tx.txIns.map((ti, idx) => {
    ti.signature = signTxIn(tx, idx, senderPrivateKey, unspentTxOuts);
    return ti;
  });

  return tx;
}
