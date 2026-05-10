import * as CryptoJS from 'crypto-js';
import { NameEntry } from './types';
import { db } from './database';
import { isValidAddress } from './wallet';
import { logger } from './logger';

const VALID_NAME_RE = /^[a-zA-Z0-9_-]{2,32}$/;

export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\.pro$/, '');
}

export function isValidName(name: string): boolean {
  return VALID_NAME_RE.test(name);
}

export function isNameReference(input: string): boolean {
  return input.endsWith('.pro') || (isValidName(input) && !isValidAddress(input));
}

export function registerName(name: string, address: string, ownerId: string): NameEntry {
  const normalized = normalizeName(name);

  if (!isValidName(normalized)) {
    throw new Error('Invalid name: use 2-32 chars, letters/numbers/-/_');
  }
  if (!isValidAddress(address)) {
    throw new Error('Invalid address');
  }

  const entries = db.loadNames();
  const existing = entries.find(
    e => e.name === normalized || e.address === address
  );
  if (existing) {
    if (existing.name === normalized) {
      throw new Error(`Name '${normalized}.pro' is already registered`);
    }
    throw new Error('This address already has a registered name');
  }

  const entry = new NameEntry(normalized, address, ownerId, Date.now());
  entries.push(entry);
  db.saveNames(entries);

  logger.info(`Name registered: ${normalized}.pro -> ${address}`);
  return entry;
}

export function resolveName(name: string): string | null {
  const normalized = normalizeName(name);
  const entries = db.loadNames();
  const entry = entries.find(e => e.name === normalized);
  return entry ? entry.address : null;
}

export function lookupAddress(address: string): string | null {
  const entries = db.loadNames();
  const entry = entries.find(e => e.address === address);
  return entry ? entry.name + '.pro' : null;
}

export function listNames(): NameEntry[] {
  return db.loadNames();
}

export function unregisterName(name: string, ownerId: string): boolean {
  const normalized = normalizeName(name);
  const entries = db.loadNames();
  const idx = entries.findIndex(e => e.name === normalized && e.owner === ownerId);
  if (idx === -1) return false;
  entries.splice(idx, 1);
  db.saveNames(entries);
  logger.info(`Name unregistered: ${normalized}.pro`);
  return true;
}
