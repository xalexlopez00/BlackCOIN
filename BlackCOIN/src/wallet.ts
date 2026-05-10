import * as CryptoJS from 'crypto-js';
import * as ecdsa from 'elliptic';
import { db } from './database';
import { UnspentTxOut, WalletInfo } from './types';
import { logger } from './logger';

const ec = new ecdsa.ec('secp256k1');

export function generatePrivateKey(): string {
  const keyPair = ec.genKeyPair();
  return keyPair.getPrivate().toString(16).padStart(64, '0');
}

export function getPublicKey(privateKey: string): string {
  const key = ec.keyFromPrivate(privateKey, 'hex');
  return key.getPublic().encode('hex');
}

export function getAddressFromPublicKey(publicKey: string): string {
  const shaHash = CryptoJS.SHA256(publicKey).toString();
  const ripeHash = CryptoJS.RIPEMD160(shaHash).toString();
  return 'P' + ripeHash;
}

export function getAddressFromPrivateKey(privateKey: string): string {
  return getAddressFromPublicKey(getPublicKey(privateKey));
}

export function isValidAddress(address: string): boolean {
  if (typeof address !== 'string') return false;
  if (!address.startsWith('P')) return false;
  if (address.length !== 41) return false;
  return /^P[a-fA-F0-9]{40}$/.test(address);
}

function encryptPrivateKey(privateKey: string, password: string): string {
  return CryptoJS.AES.encrypt(privateKey, password).toString();
}

function decryptPrivateKey(encrypted: string, password: string): string {
  const bytes = CryptoJS.AES.decrypt(encrypted, password);
  return bytes.toString(CryptoJS.enc.Utf8);
}

export function createWallet(name: string, password: string): WalletInfo {
  const wallets = db.loadWallets();

  const privateKey = generatePrivateKey();
  const publicKey = getPublicKey(privateKey);
  const address = getAddressFromPublicKey(publicKey);

  const id = 'wal_' + CryptoJS.SHA256(Date.now() + privateKey).toString().substring(0, 16);

  const wallet: WalletInfo = {
    id,
    name,
    address,
    publicKey,
    encryptedPrivateKey: encryptPrivateKey(privateKey, password),
    createdAt: Date.now(),
  };

  wallets.push(wallet);
  db.saveWallets(wallets);

  logger.info(`Wallet created: ${name} (${address})`);
  return wallet;
}

export function listWallets(): WalletInfo[] {
  return db.loadWallets();
}

export function getWallet(id: string): WalletInfo | undefined {
  return db.loadWallets().find(w => w.id === id);
}

export function getWalletByAddress(address: string): WalletInfo | undefined {
  return db.loadWallets().find(w => w.address === address);
}

export function getPrivateKey(id: string, password: string): string | null {
  const wallet = getWallet(id);
  if (!wallet) return null;
  try {
    const decrypted = decryptPrivateKey(wallet.encryptedPrivateKey, password);
    if (!decrypted) return null;
    return decrypted;
  } catch {
    return null;
  }
}

export function getBalance(address: string, unspentTxOuts: UnspentTxOut[]): number {
  return unspentTxOuts
    .filter(u => u.address === address)
    .reduce((sum, u) => sum + u.amount, 0);
}

export function findUnspentTxOuts(address: string, unspentTxOuts: UnspentTxOut[]): UnspentTxOut[] {
  return unspentTxOuts.filter(u => u.address === address);
}

export function importWallet(privateKeyHex: string, name: string, password: string): WalletInfo {
  const publicKey = getPublicKey(privateKeyHex);
  const address = getAddressFromPublicKey(publicKey);

  const wallets = db.loadWallets();
  const existing = wallets.find(w => w.address === address);
  if (existing) {
    throw new Error('Wallet with this address already exists: ' + address);
  }

  const id = 'wal_' + CryptoJS.SHA256(Date.now() + privateKeyHex).toString().substring(0, 16);
  const wallet: WalletInfo = {
    id,
    name,
    address,
    publicKey,
    encryptedPrivateKey: encryptPrivateKey(privateKeyHex, password),
    createdAt: Date.now(),
  };

  wallets.push(wallet);
  db.saveWallets(wallets);

  logger.info(`Wallet imported: ${name} (${address})`);
  return wallet;
}

export function exportPrivateKey(id: string, password: string): string | null {
  return getPrivateKey(id, password);
}
