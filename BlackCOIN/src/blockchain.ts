import { Block, Transaction, TxIn, TxOut, UnspentTxOut } from './types';
import { getConfig } from './config';
import { db } from './database';
import { logger } from './logger';
import { processTransactions, getCoinbaseTransaction, createTransaction } from './transaction';
import { findUnspentTxOuts, getBalance } from './wallet';
import { updateTransactionPool, getTransactionPool, addToTransactionPool } from './transactionPool';
import { mineBlock } from './miner';
import { getTransactionId, calculateHashForBlock, hashMatchesDifficulty } from './utils';
import { emit as eventEmit } from './events';

let blockchain: Block[] = [];
let unspentTxOuts: UnspentTxOut[] = [];

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';
const GENESIS_ADDRESS = 'P0000000000000000000000000000000000000000';

function createGenesisBlock(): Block {
  const tx = new Transaction();
  const txIn = new TxIn();
  txIn.txOutId = '';
  txIn.txOutIndex = 0;
  txIn.signature = '';
  tx.txIns = [txIn];
  const txOut = new TxOut(GENESIS_ADDRESS, 21000000);
  tx.txOuts = [txOut];
  tx.timestamp = 0;
  tx.id = getTransactionId(tx);

  const block = new Block(0, '', '', 0, [tx], 0, 0);
  block.hash = calculateHashForBlock(block);
  return block;
}

export function initBlockchain(): void {
  const loaded = db.loadBlocks();
  if (loaded.length > 0) {
    blockchain = loaded;
    unspentTxOuts = db.loadUtxos();
    logger.info(`Blockchain loaded: ${blockchain.length} blocks, ${unspentTxOuts.length} UTXOs`);
  } else {
    const genesis = createGenesisBlock();
    blockchain = [genesis];
    unspentTxOuts = processTransactions(genesis.data, [], 0) || [];
    db.saveBlocks(blockchain);
    db.saveUtxos(unspentTxOuts);
    logger.info('Genesis block created');
  }
}

export function getBlockchain(): Block[] {
  return blockchain;
}

export function getUnspentTxOuts(): UnspentTxOut[] {
  return [...unspentTxOuts];
}

export function setUnspentTxOuts(newUtxos: UnspentTxOut[]): void {
  unspentTxOuts = newUtxos;
  db.saveUtxos(unspentTxOuts);
}

export function getLatestBlock(): Block {
  return blockchain[blockchain.length - 1];
}

export function getBlockByHash(hash: string): Block | undefined {
  return blockchain.find(b => b.hash === hash);
}

export function getBlockByIndex(index: number): Block | undefined {
  return blockchain.find(b => b.index === index);
}

export function getTransactionFromChain(txId: string): Transaction | undefined {
  for (const block of blockchain) {
    const found = block.data.find(tx => tx.id === txId);
    if (found) return found;
  }
  return undefined;
}

export function getCoinbaseAmount(blockIndex: number): number {
  const config = getConfig();
  const halvings = Math.floor(blockIndex / config.halvingInterval);
  const amount = config.coinbaseAmount / Math.pow(2, halvings);
  return Math.max(amount, 1); // never goes below 1
}

function getDifficulty(): number {
  const config = getConfig();
  const latest = getLatestBlock();
  if (latest.index % config.difficultyAdjustmentInterval === 0 && latest.index !== 0) {
    return getAdjustedDifficulty(latest);
  }
  return latest.difficulty;
}

function getAdjustedDifficulty(latestBlock: Block): number {
  const config = getConfig();
  const prevAdjustment = blockchain[blockchain.length - config.difficultyAdjustmentInterval];
  const timeExpected = config.blockGenerationInterval * config.difficultyAdjustmentInterval;
  const timeTaken = latestBlock.timestamp - prevAdjustment.timestamp;

  if (timeTaken < timeExpected / 2) {
    return prevAdjustment.difficulty + 1;
  } else if (timeTaken > timeExpected * 2) {
    return Math.max(config.minDifficulty, prevAdjustment.difficulty - 1);
  }
  return prevAdjustment.difficulty;
}

function isValidBlockStructure(block: Block): boolean {
  return (
    typeof block.index === 'number' &&
    typeof block.hash === 'string' &&
    typeof block.previousHash === 'string' &&
    typeof block.timestamp === 'number' &&
    Array.isArray(block.data)
  );
}

function isValidNewBlock(newBlock: Block, previousBlock: Block): boolean {
  if (!isValidBlockStructure(newBlock)) {
    logger.debug('Invalid block structure');
    return false;
  }
  if (previousBlock.index + 1 !== newBlock.index) {
    logger.debug('Invalid index');
    return false;
  }
  if (previousBlock.hash !== newBlock.previousHash) {
    logger.debug('Invalid previous hash');
    return false;
  }
  if (calculateHashForBlock(newBlock) !== newBlock.hash) {
    logger.debug('Invalid hash');
    return false;
  }
  if (!hashMatchesDifficulty(newBlock.hash, newBlock.difficulty)) {
    logger.debug('Hash does not match difficulty');
    return false;
  }
  return true;
}

export function addBlockToChain(newBlock: Block): boolean {
  if (isValidNewBlock(newBlock, getLatestBlock())) {
    const newUtxos = processTransactions(newBlock.data, getUnspentTxOuts(), newBlock.index);
    if (newUtxos === null) {
      logger.error('Invalid transactions in block');
      return false;
    }
    blockchain.push(newBlock);
    setUnspentTxOuts(newUtxos);
    db.saveBlocks(blockchain);
    updateTransactionPool(unspentTxOuts);
    logger.info(`Block #${newBlock.index} added to chain: ${newBlock.hash.substring(0, 16)}...`);
    eventEmit('block:added', newBlock);
    return true;
  }
  return false;
}

function getAccumulatedDifficulty(): number {
  return blockchain
    .map(b => Math.pow(2, b.difficulty))
    .reduce((a, b) => a + b, 0);
}

export function isValidChain(chainToValidate: Block[]): UnspentTxOut[] | null {
  if (JSON.stringify(chainToValidate[0]) !== JSON.stringify(createGenesisBlock())) {
    logger.error('Invalid genesis block');
    return null;
  }

  let utxos: UnspentTxOut[] = [];
  for (let i = 0; i < chainToValidate.length; i++) {
    const current = chainToValidate[i];
    if (i !== 0 && !isValidNewBlock(current, chainToValidate[i - 1])) {
      logger.error(`Invalid block at index ${i}`);
      return null;
    }
    utxos = processTransactions(current.data, utxos, current.index);
    if (utxos === null) {
      logger.error(`Invalid transactions at block ${i}`);
      return null;
    }
  }
  return utxos;
}

export function replaceChain(newBlocks: Block[]): void {
  const newUtxos = isValidChain(newBlocks);
  if (newUtxos && getAccumulatedDifficulty() < newBlocks.map(b => Math.pow(2, b.difficulty)).reduce((a, b) => a + b, 0)) {
    logger.info('Replacing chain with received blockchain');
    blockchain = newBlocks;
    setUnspentTxOuts(newUtxos);
    db.saveBlocks(blockchain);
    updateTransactionPool(unspentTxOuts);
    eventEmit('chain:replaced');
  } else {
    logger.info('Received blockchain is not valid or not longer');
  }
}

export function getAccountBalance(address: string): number {
  return getBalance(address, getUnspentTxOuts());
}

export function getMyUnspentTransactionOutputs(address: string): UnspentTxOut[] {
  return findUnspentTxOuts(address, getUnspentTxOuts());
}

export function sendTransaction(
  toAddress: string,
  amount: number,
  senderPrivateKey: string,
  message?: string
): Transaction {
  const tx = createTransaction(toAddress, amount, senderPrivateKey, getUnspentTxOuts(), getTransactionPool(), message);
  addToTransactionPool(tx, getUnspentTxOuts());
  eventEmit('txpool:changed');
  return tx;
}

export async function generateRawNextBlock(
  blockData: Transaction[],
  minerAddress: string
): Promise<Block | null> {
  const previousBlock = getLatestBlock();
  const difficulty = getDifficulty();
  const nextIndex = previousBlock.index + 1;
  const nextTimestamp = Math.round(Date.now() / 1000);

  const newBlock = await mineBlock(nextIndex, previousBlock.hash, nextTimestamp, blockData, difficulty);

  if (addBlockToChain(newBlock)) {
    return newBlock;
  }
  return null;
}

export async function generateNextBlock(minerAddress: string): Promise<Block | null> {
  const nextIndex = getLatestBlock().index + 1;
  const reward = getCoinbaseAmount(nextIndex);
  const coinbaseTx = getCoinbaseTransaction(minerAddress, nextIndex, reward);
  const blockData = [coinbaseTx, ...getTransactionPool()];
  return generateRawNextBlock(blockData, minerAddress);
}

export async function generateNextBlockWithTransaction(
  receiverAddress: string,
  amount: number,
  senderPrivateKey: string,
  minerAddress: string
): Promise<Block | null> {
  const nextIndex = getLatestBlock().index + 1;
  const reward = getCoinbaseAmount(nextIndex);
  const coinbaseTx = getCoinbaseTransaction(minerAddress, nextIndex, reward);
  const tx = createTransaction(receiverAddress, amount, senderPrivateKey, getUnspentTxOuts(), getTransactionPool());
  const blockData = [coinbaseTx, tx];
  return generateRawNextBlock(blockData, minerAddress);
}

export function handleReceivedTransaction(transaction: Transaction): void {
  addToTransactionPool(transaction, getUnspentTxOuts());
  eventEmit('txpool:changed');
}
