import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { Block, Transaction, UnspentTxOut, WalletInfo, NameEntry, UserInfo, SupportTicket } from './types';
import { getConfig } from './config';
import { logger } from './logger';

const DB_VERSION = 4;

let _db: Database.Database;

function initDB(): Database.Database {
  const dir = getConfig().dataDir;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const dbPath = path.join(dir, 'blackcoin.db');
  const database = new Database(dbPath);

  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');

  database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS blocks (
      row_id       INTEGER PRIMARY KEY AUTOINCREMENT,
      "index"      INTEGER NOT NULL,
      hash         TEXT NOT NULL,
      previousHash TEXT NOT NULL,
      timestamp    INTEGER NOT NULL,
      data         TEXT NOT NULL,
      difficulty   INTEGER NOT NULL,
      nonce        INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_blocks_index ON blocks("index");
    CREATE INDEX IF NOT EXISTS idx_blocks_hash ON blocks(hash);

    CREATE TABLE IF NOT EXISTS utxos (
      row_id      INTEGER PRIMARY KEY AUTOINCREMENT,
      txOutId     TEXT NOT NULL,
      txOutIndex  INTEGER NOT NULL,
      address     TEXT NOT NULL,
      amount      REAL NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_utxos_address ON utxos(address);

    CREATE TABLE IF NOT EXISTS txpool (
      row_id INTEGER PRIMARY KEY AUTOINCREMENT,
      data   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wallets (
      id                  TEXT PRIMARY KEY,
      name                TEXT NOT NULL,
      address             TEXT NOT NULL UNIQUE,
      publicKey           TEXT NOT NULL,
      encryptedPrivateKey TEXT NOT NULL,
      createdAt           INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(address);

    CREATE TABLE IF NOT EXISTS names (
      row_id    INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT NOT NULL UNIQUE,
      address   TEXT NOT NULL,
      owner     TEXT NOT NULL DEFAULT '',
      createdAt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_names_address ON names(address);

    CREATE TABLE IF NOT EXISTS users (
      username     TEXT PRIMARY KEY,
      passwordHash TEXT NOT NULL,
      createdAt    INTEGER NOT NULL,
      isAdmin      INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id        TEXT PRIMARY KEY,
      username  TEXT NOT NULL,
      subject   TEXT NOT NULL,
      message   TEXT NOT NULL,
      status    TEXT NOT NULL DEFAULT 'open',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL DEFAULT 0,
      txId      TEXT,
      replies   TEXT NOT NULL DEFAULT '[]'
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_username ON tickets(username);
    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);

    CREATE TABLE IF NOT EXISTS sessions (
      token     TEXT PRIMARY KEY,
      username  TEXT NOT NULL,
      expiresAt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expiresAt);

    CREATE TABLE IF NOT EXISTS peers (
      address   TEXT PRIMARY KEY,
      lastSeen  INTEGER NOT NULL,
      failCount INTEGER NOT NULL DEFAULT 0
    );
  `);

  migrateDB(database);

  return database;
}

function migrateDB(database: Database.Database): void {
  const currentVersion = database.prepare('SELECT value FROM settings WHERE key = ?').get('db_version') as { value: string } | undefined;
  const ver = currentVersion ? parseInt(currentVersion.value, 10) : 0;

  if (ver < 1) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS peers (
        address   TEXT PRIMARY KEY,
        lastSeen  INTEGER NOT NULL,
        failCount INTEGER NOT NULL DEFAULT 0
      );
    `);
  }

  if (ver < 2) {
    database.exec(`
      CREATE INDEX IF NOT EXISTS idx_peers_lastSeen ON peers(lastSeen);
    `);
  }

  if (ver < 3) {
    try {
      database.exec(`ALTER TABLE tickets ADD COLUMN updatedAt INTEGER NOT NULL DEFAULT 0`);
      database.exec(`CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)`);
    } catch {}
  }

  if (ver < 4) {
    try {
      database.exec(`ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''`);
    } catch {}
  }

  database.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('db_version', String(DB_VERSION));
}

function getDB(): Database.Database {
  if (!_db) {
    _db = initDB();
  }
  return _db;
}

export function cleanupExpiredSessions(): void {
  try {
    getDB().prepare('DELETE FROM sessions WHERE expiresAt < ?').run(Date.now());
  } catch {}
}

export function closeDB(): void {
  if (_db) {
    try { _db.close(); } catch {}
    _db = undefined as any;
  }
}

// ────────────────────────────
// BLOCKS
// ────────────────────────────

export function loadBlocks(): Block[] {
  try {
    const rows = getDB().prepare('SELECT * FROM blocks ORDER BY "index" ASC').all() as any[];
    return rows.map(r => new Block(r.index, r.hash, r.previousHash, r.timestamp, JSON.parse(r.data), r.difficulty, r.nonce));
  } catch {
    return [];
  }
}

export function saveBlocks(blocks: Block[]): void {
  const d = getDB();
  const tx = d.transaction(() => {
    d.prepare('DELETE FROM blocks').run();
    const insert = d.prepare('INSERT INTO blocks ("index", hash, previousHash, timestamp, data, difficulty, nonce) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const b of blocks) {
      insert.run(b.index, b.hash, b.previousHash, b.timestamp, JSON.stringify(b.data), b.difficulty, b.nonce);
    }
  });
  tx();
}

// ────────────────────────────
// UTXOS
// ────────────────────────────

export function loadUtxos(): UnspentTxOut[] {
  try {
    const rows = getDB().prepare('SELECT * FROM utxos').all() as any[];
    return rows.map(r => new UnspentTxOut(r.txOutId, r.txOutIndex, r.address, r.amount));
  } catch {
    return [];
  }
}

export function saveUtxos(utxos: UnspentTxOut[]): void {
  const d = getDB();
  const tx = d.transaction(() => {
    d.prepare('DELETE FROM utxos').run();
    const insert = d.prepare('INSERT INTO utxos (txOutId, txOutIndex, address, amount) VALUES (?, ?, ?, ?)');
    for (const u of utxos) {
      insert.run(u.txOutId, u.txOutIndex, u.address, u.amount);
    }
  });
  tx();
}

// ────────────────────────────
// TRANSACTION POOL
// ────────────────────────────

export function loadTransactionPool(): Transaction[] {
  try {
    const rows = getDB().prepare('SELECT * FROM txpool').all() as any[];
    return rows.map(r => JSON.parse(r.data));
  } catch {
    return [];
  }
}

export function saveTransactionPool(txs: Transaction[]): void {
  const d = getDB();
  const tx = d.transaction(() => {
    d.prepare('DELETE FROM txpool').run();
    const insert = d.prepare('INSERT INTO txpool (data) VALUES (?)');
    for (const t of txs) {
      insert.run(JSON.stringify(t));
    }
  });
  tx();
}

// ────────────────────────────
// WALLETS
// ────────────────────────────

export function loadWallets(): WalletInfo[] {
  try {
    return getDB().prepare('SELECT * FROM wallets').all() as WalletInfo[];
  } catch {
    return [];
  }
}

export function saveWallets(wallets: WalletInfo[]): void {
  const d = getDB();
  const tx = d.transaction(() => {
    d.prepare('DELETE FROM wallets').run();
    const insert = d.prepare('INSERT INTO wallets (id, name, address, publicKey, encryptedPrivateKey, createdAt) VALUES (?, ?, ?, ?, ?, ?)');
    for (const w of wallets) {
      insert.run(w.id, w.name, w.address, w.publicKey, w.encryptedPrivateKey, w.createdAt);
    }
  });
  tx();
}

// ────────────────────────────
// NAMES
// ────────────────────────────

export function loadNames(): NameEntry[] {
  try {
    const rows = getDB().prepare('SELECT * FROM names').all() as any[];
    return rows.map(r => new NameEntry(r.name, r.address, r.owner, r.createdAt));
  } catch {
    return [];
  }
}

export function saveNames(entries: NameEntry[]): void {
  const d = getDB();
  const tx = d.transaction(() => {
    d.prepare('DELETE FROM names').run();
    const insert = d.prepare('INSERT INTO names (name, address, owner, createdAt) VALUES (?, ?, ?, ?)');
    for (const e of entries) {
      insert.run(e.name, e.address, e.owner, e.createdAt);
    }
  });
  tx();
}

// ────────────────────────────
// USERS
// ────────────────────────────

export function loadUsers(): UserInfo[] {
  try {
    const rows = getDB().prepare('SELECT * FROM users').all() as any[];
    return rows.map(r => ({
      username: r.username,
      passwordHash: r.passwordHash,
      createdAt: r.createdAt,
      isAdmin: r.isAdmin === 1,
      email: r.email || '',
    }));
  } catch {
    return [];
  }
}

export function saveUsers(users: UserInfo[]): void {
  const d = getDB();
  const tx = d.transaction(() => {
    d.prepare('DELETE FROM users').run();
    const insert = d.prepare('INSERT INTO users (username, passwordHash, createdAt, isAdmin, email) VALUES (?, ?, ?, ?, ?)');
    for (const u of users) {
      insert.run(u.username, u.passwordHash, u.createdAt, u.isAdmin ? 1 : 0, u.email || '');
    }
  });
  tx();
}

// ────────────────────────────
// TICKETS
// ────────────────────────────

export function loadTickets(): SupportTicket[] {
  try {
    const rows = getDB().prepare('SELECT * FROM tickets').all() as any[];
    return rows.map(r => ({
      id: r.id,
      username: r.username,
      subject: r.subject,
      message: r.message,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt || r.createdAt,
      txId: r.txId || undefined,
      replies: JSON.parse(r.replies || '[]'),
    }));
  } catch {
    return [];
  }
}

export function saveTickets(tickets: SupportTicket[]): void {
  const d = getDB();
  const tx = d.transaction(() => {
    d.prepare('DELETE FROM tickets').run();
    const insert = d.prepare('INSERT INTO tickets (id, username, subject, message, status, createdAt, updatedAt, txId, replies) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const t of tickets) {
      insert.run(t.id, t.username, t.subject, t.message, t.status, t.createdAt, t.updatedAt || t.createdAt, t.txId || null, JSON.stringify(t.replies || []));
    }
  });
  tx();
}

// ────────────────────────────
// SESSIONS (persistent)
// ────────────────────────────

export interface SessionRow {
  token: string;
  username: string;
  expiresAt: number;
}

export function saveSession(token: string, username: string, expiresAt: number): void {
  getDB().prepare('INSERT OR REPLACE INTO sessions (token, username, expiresAt) VALUES (?, ?, ?)').run(token, username, expiresAt);
}

export function loadSession(token: string): SessionRow | null {
  const row = getDB().prepare('SELECT * FROM sessions WHERE token = ?').get(token) as SessionRow | undefined;
  if (!row) return null;
  if (Date.now() > row.expiresAt) {
    getDB().prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return row;
}

export function deleteSession(token: string): void {
  getDB().prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function loadAllSessions(): SessionRow[] {
  cleanupExpiredSessions();
  return getDB().prepare('SELECT * FROM sessions ORDER BY expiresAt DESC').all() as SessionRow[];
}

// ────────────────────────────
// SETTINGS (key-value store)
// ────────────────────────────

export function getSetting(key: string): string | null {
  const row = getDB().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setSetting(key: string, value: string): void {
  getDB().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

export function deleteSetting(key: string): void {
  getDB().prepare('DELETE FROM settings WHERE key = ?').run(key);
}

export function getAllSettings(): Record<string, string> {
  const rows = getDB().prepare('SELECT * FROM settings').all() as { key: string; value: string }[];
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

// ────────────────────────────
// PEERS (persistent peer store)
// ────────────────────────────

export interface PeerRow {
  address: string;
  lastSeen: number;
  failCount: number;
}

export function loadPeers(): PeerRow[] {
  try {
    return getDB().prepare('SELECT * FROM peers ORDER BY lastSeen DESC').all() as PeerRow[];
  } catch {
    return [];
  }
}

export function savePeers(peers: PeerRow[]): void {
  const d = getDB();
  const tx = d.transaction(() => {
    d.prepare('DELETE FROM peers').run();
    const insert = d.prepare('INSERT OR REPLACE INTO peers (address, lastSeen, failCount) VALUES (?, ?, ?)');
    for (const p of peers) {
      insert.run(p.address, p.lastSeen, p.failCount);
    }
  });
  tx();
}

export function upsertPeer(address: string, failCount?: number): void {
  const existing = getDB().prepare('SELECT * FROM peers WHERE address = ?').get(address) as PeerRow | undefined;
  if (existing) {
    getDB().prepare('UPDATE peers SET lastSeen = ?, failCount = ? WHERE address = ?')
      .run(Date.now(), failCount !== undefined ? failCount : existing.failCount, address);
  } else {
    getDB().prepare('INSERT INTO peers (address, lastSeen, failCount) VALUES (?, ?, ?)')
      .run(address, Date.now(), failCount !== undefined ? failCount : 0);
  }
}

export function removePeer(address: string): void {
  getDB().prepare('DELETE FROM peers WHERE address = ?').run(address);
}

export function cleanupDeadPeers(maxFailCount: number = 10): number {
  const result = getDB().prepare('DELETE FROM peers WHERE failCount >= ?').run(maxFailCount);
  return result.changes;
}

// ────────────────────────────
// SESSIONS - admin listing
// ────────────────────────────

export function listAllSessions(): SessionRow[] {
  cleanupExpiredSessions();
  return getDB().prepare('SELECT * FROM sessions ORDER BY expiresAt DESC').all() as SessionRow[];
}

export function revokeSession(token: string): void {
  getDB().prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

// ────────────────────────────
// MAINTENANCE
// ────────────────────────────

export function vacuumDB(): void {
  try {
    getDB().exec('VACUUM');
  } catch {}
}

// ────────────────────────────
// LEGACY COMPAT - keep old db object for transition
// ────────────────────────────

export const db = {
  loadBlocks,
  saveBlocks,
  loadUtxos,
  saveUtxos,
  loadTransactionPool,
  saveTransactionPool,
  loadWallets,
  saveWallets,
  loadNames,
  saveNames,
  loadUsers,
  saveUsers,
  loadTickets,
  saveTickets,
  saveSession,
  loadSession,
  deleteSession,
  loadAllSessions,
  listAllSessions,
  revokeSession,
  getSetting,
  setSetting,
  deleteSetting,
  getAllSettings,
  loadPeers,
  savePeers,
  upsertPeer,
  removePeer,
  cleanupDeadPeers,
  cleanupExpiredSessions,
  closeDB,
  vacuumDB,
};
