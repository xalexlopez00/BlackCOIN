import express from 'express';
import bodyParser from 'body-parser';
import {
  generateNextBlock,
  getAccountBalance,
  getBlockByHash,
  getBlockByIndex,
  getBlockchain,
  getLatestBlock,
  getMyUnspentTransactionOutputs,
  getTransactionFromChain,
  getUnspentTxOuts,
  sendTransaction,
} from './blockchain';
import * as path from 'path';
import { connectToPeers, getPeers, getSockets } from './p2p';
import { getTransactionPool } from './transactionPool';
import { isValidAddress, listWallets, getPrivateKey, createWallet, importWallet, exportPrivateKey } from './wallet';
import { registerName, resolveName, lookupAddress, listNames, isNameReference } from './names';
import { registerUser, loginUser, authenticate, logoutUser, listUsers, getUser, makeAdmin, removeAdmin, resetUserPassword, changeOwnPassword, deleteUser, getFullUserInfo, requestPasswordReset, setUserEmail } from './users';
import { createTicket, replyToTicket, closeTicket, reopenTicket, getTickets, getTicketsByStatus, getTicket, getTicketStats, deleteTicket, userReplyToTicket } from './support';
import { getAllSettings, setSetting, deleteSetting, loadPeers, removePeer, cleanupDeadPeers, listAllSessions, revokeSession, vacuumDB } from './database';
import { logger, getRecentLogs } from './logger';
import { executeCommand } from './terminal';

export function initHttpServer(httpPort: number): void {
  const app = express();
  app.use(bodyParser.json());

  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
  });

  function requireAdmin(req: any, res: any, next: any) {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin access required' });
    next();
  }

  function requireAuth(req: any, res: any, next: any) {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    next();
  }

  function auth(req: any, _res: any, next: any) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const user = authenticate(token);
      if (user) req.user = user;
    }
    next();
  }
  app.use(auth);

  // ──────────────────────────────────────────
  // Auth
  // ──────────────────────────────────────────
  app.post('/api/v1/auth/register', (req, res) => {
    try {
      const { username, password, adminCode, email } = req.body;
      const user = registerUser(username, password, adminCode, email);
      const token = loginUser(username, password);
      res.json({ success: true, username: user.username, token, isAdmin: user.isAdmin, email: user.email || '' });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/v1/auth/login', (req, res) => {
    try {
      const { username, password } = req.body;
      const token = loginUser(username, password);
      if (!token) return res.status(401).json({ error: 'Invalid credentials' });
      const user = authenticate(token);
      res.json({ success: true, username, token, isAdmin: user?.isAdmin });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/v1/auth/logout', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) logoutUser(token);
    res.json({ success: true });
  });

  app.get('/api/v1/auth/me', (req: any, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const full = getFullUserInfo(req.user.username);
    res.json({
      username: req.user.username,
      isAdmin: req.user.isAdmin,
      createdAt: req.user.createdAt,
      email: full?.email || '',
    });
  });

  app.post('/api/v1/auth/recover-password', (req, res) => {
    try {
      const { username } = req.body;
      if (!username) return res.status(400).json({ error: 'Username required' });
      const result = requestPasswordReset(username);
      res.json({ success: true, ticketId: result.ticketId, message: result.message });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/v1/auth/change-password', requireAuth, (req: any, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current and new password required' });
      }
      changeOwnPassword(req.user.username, currentPassword, newPassword);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ──────────────────────────────────────────
  // Admin - User management
  // ──────────────────────────────────────────
  app.get('/api/v1/admin/users', requireAdmin, (_req: any, res) => {
    const users = listUsers();
    res.json({ count: users.length, users });
  });

  app.post('/api/v1/admin/promote', requireAdmin, (req: any, res) => {
    try {
      const { username } = req.body;
      if (!username) return res.status(400).json({ error: 'Username required' });
      const user = makeAdmin(username, req.user.username);
      res.json({ success: true, username: user.username, isAdmin: user.isAdmin });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/v1/admin/demote', requireAdmin, (req: any, res) => {
    try {
      const { username } = req.body;
      if (!username) return res.status(400).json({ error: 'Username required' });
      const user = removeAdmin(username, req.user.username);
      res.json({ success: true, username: user.username, isAdmin: user.isAdmin });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/v1/admin/set-email', requireAdmin, (req: any, res) => {
    try {
      const { username, email } = req.body;
      if (!username || email === undefined) return res.status(400).json({ error: 'Username and email required' });
      setUserEmail(username, email, req.user.username);
      res.json({ success: true, username, email });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/v1/admin/reset-password', requireAdmin, (req: any, res) => {
    try {
      const { username, newPassword } = req.body;
      if (!username || !newPassword) return res.status(400).json({ error: 'Username and newPassword required' });
      resetUserPassword(username, newPassword, req.user.username);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete('/api/v1/admin/users/:username', requireAdmin, (req: any, res) => {
    try {
      deleteUser(req.params.username, req.user.username);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ──────────────────────────────────────────
  // Admin - Settings
  // ──────────────────────────────────────────
  app.get('/api/v1/admin/settings', requireAdmin, (_req: any, res) => {
    const settings = getAllSettings();
    res.json({ count: Object.keys(settings).length, settings });
  });

  app.put('/api/v1/admin/settings/:key', requireAdmin, (req: any, res) => {
    try {
      const { value } = req.body;
      if (value === undefined) return res.status(400).json({ error: 'Value required' });
      setSetting(req.params.key, String(value));
      res.json({ success: true, key: req.params.key, value: String(value) });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete('/api/v1/admin/settings/:key', requireAdmin, (req: any, res) => {
    try {
      deleteSetting(req.params.key);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ──────────────────────────────────────────
  // Admin - Peers (persistent store)
  // ──────────────────────────────────────────
  app.get('/api/v1/admin/peers', requireAdmin, (_req: any, res) => {
    const peers = loadPeers();
    res.json({ count: peers.length, peers });
  });

  app.delete('/api/v1/admin/peers/:address', requireAdmin, (req: any, res) => {
    try {
      removePeer(req.params.address);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/v1/admin/peers/cleanup', requireAdmin, (_req: any, res) => {
    const removed = cleanupDeadPeers(10);
    res.json({ success: true, removed });
  });

  // ──────────────────────────────────────────
  // Admin - Stats / Logs / Sessions / Announce
  // ──────────────────────────────────────────
  app.get('/api/v1/admin/stats', requireAdmin, (_req: any, res) => {
    const chain = getBlockchain();
    const latest = getLatestBlock();
    const utxos = getUnspentTxOuts();
    const pool = getTransactionPool();
    const wallets = listWallets();
    const users = listUsers();
    const ticketStats = getTicketStats();
    res.json({
      node: {
        blocks: chain.length,
        latestBlock: latest.index,
        difficulty: latest.difficulty,
        peers: getPeers().length,
        utxos: utxos.length,
        poolSize: pool.length,
        wallets: wallets.length,
      },
      users: {
        total: users.length,
        admins: users.filter((u: any) => u.isAdmin).length,
      },
      tickets: ticketStats,
      memory: process.memoryUsage().rss,
      uptime: process.uptime(),
    });
  });

  app.get('/api/v1/admin/logs', requireAdmin, (req: any, res) => {
    const count = parseInt(req.query.count as string) || 100;
    const logs = getRecentLogs(count);
    res.json({ count: logs.length, logs });
  });

  app.get('/api/v1/admin/sessions', requireAdmin, (_req: any, res) => {
    const sessions = listAllSessions();
    res.json({ count: sessions.length, sessions });
  });

  app.delete('/api/v1/admin/sessions/:token', requireAdmin, (req: any, res) => {
    try {
      revokeSession(req.params.token);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/v1/admin/terminal', requireAdmin, async (req: any, res) => {
    try {
      const { command } = req.body;
      if (!command) return res.status(400).json({ error: 'Command required' });
      const result = await executeCommand(command, req.user.username);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/v1/admin/announce', requireAdmin, (req: any, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: 'Message required' });
      const msg = JSON.stringify({ type: 'announcement', from: req.user.username, message, timestamp: Date.now() });
      let sent = 0;
      getSockets().forEach(ws => {
        try { ws.send(msg); sent++; } catch {}
      });
      logger.admin(`Announcement sent to ${sent} peers by ${req.user.username}: ${message}`);
      res.json({ success: true, sent });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ──────────────────────────────────────────
  // Support tickets
  // ──────────────────────────────────────────
  app.post('/api/v1/support/ticket', requireAuth, (req: any, res) => {
    try {
      const { subject, message, txId } = req.body;
      const ticket = createTicket(req.user.username, subject || 'No subject', message || '', txId);
      res.json({ success: true, ticket });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/v1/support/tickets', requireAuth, (req: any, res) => {
    const tickets = req.user.isAdmin ? getTickets() : getTickets(req.user.username);
    res.json({ count: tickets.length, tickets });
  });

  app.get('/api/v1/support/tickets/:id', requireAuth, (req: any, res) => {
    const ticket = getTicket(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (!req.user.isAdmin && ticket.username !== req.user.username) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(ticket);
  });

  app.post('/api/v1/support/tickets/:id/user-reply', requireAuth, (req: any, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: 'Message required' });
      const ticket = userReplyToTicket(req.params.id, req.user.username, message);
      if (!ticket) return res.status(404).json({ error: 'Ticket not found or access denied' });
      res.json({ success: true, ticket });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/v1/support/tickets/:id/reply', requireAdmin, (req: any, res) => {
    try {
      const { reply, closeAfterReply } = req.body;
      const ticket = replyToTicket(req.params.id, req.user.username, reply || '', closeAfterReply !== false);
      if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
      res.json({ success: true, ticket });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/v1/support/tickets/:id/close', requireAdmin, (req: any, res) => {
    try {
      const ticket = closeTicket(req.params.id, req.user.username);
      if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
      res.json({ success: true, ticket });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/v1/support/tickets/:id/reopen', requireAuth, (req: any, res) => {
    try {
      const ticket = reopenTicket(req.params.id, req.user.username);
      if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
      res.json({ success: true, ticket });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete('/api/v1/support/tickets/:id', requireAdmin, (req: any, res) => {
    try {
      const deleted = deleteTicket(req.params.id, req.user.username);
      if (!deleted) return res.status(404).json({ error: 'Ticket not found' });
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ──────────────────────────────────────────
  // Health / Info
  // ──────────────────────────────────────────
  app.get('/healthz', (_req, res) => {
    const chain = getBlockchain();
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      blocks: chain.length,
      latestBlock: chain.length > 0 ? chain[chain.length - 1].index : -1,
      peers: getPeers().length,
      memory: process.memoryUsage().rss,
    });
  });

  app.get('/api/v1/info', (_req, res) => {
    const chain = getBlockchain();
    const utxos = getUnspentTxOuts();
    const pool = getTransactionPool();
    res.json({
      blocks: chain.length,
      transactions: chain.reduce((sum, b) => sum + b.data.length, 0),
      utxos: utxos.length,
      poolSize: pool.length,
      peers: getPeers().length,
      latestBlock: getLatestBlock().index,
    });
  });

  // ──────────────────────────────────────────
  // Blockchain
  // ──────────────────────────────────────────
  app.get('/api/v1/blocks', (_req, res) => {
    const chain = getBlockchain();
    res.json({ count: chain.length, blocks: chain.slice(-20) });
  });

  app.get('/api/v1/blocks/all', (_req, res) => {
    res.json(getBlockchain());
  });

  app.get('/api/v1/blocks/latest', (_req, res) => {
    res.json(getLatestBlock());
  });

  app.get('/api/v1/blocks/hash/:hash', (req, res) => {
    const block = getBlockByHash(req.params.hash);
    if (!block) return res.status(404).json({ error: 'Block not found' });
    res.json(block);
  });

  app.get('/api/v1/blocks/index/:index', (req, res) => {
    const block = getBlockByIndex(parseInt(req.params.index));
    if (!block) return res.status(404).json({ error: 'Block not found' });
    res.json(block);
  });

  // ──────────────────────────────────────────
  // Transactions
  // ──────────────────────────────────────────
  app.get('/api/v1/transactions/:id', (req, res) => {
    const tx = getTransactionFromChain(req.params.id);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    res.json(tx);
  });

  app.post('/api/v1/transactions/send', (req, res) => {
    try {
      const { to, amount, walletId, password, privateKey } = req.body;

      let resolvedKey: string | null = privateKey || null;

      if (walletId && password) {
        resolvedKey = getPrivateKey(walletId, password);
        if (!resolvedKey) {
          return res.status(401).json({ error: 'Invalid wallet ID or password' });
        }
      }

      if (!resolvedKey) {
        return res.status(400).json({
          error: 'Provide (walletId + password) or privateKey',
        });
      }

      if (!to || !amount) {
        return res.status(400).json({ error: 'Missing to address or amount' });
      }

      let resolvedTo = to;
      if (isNameReference(to)) {
        const addr = resolveName(to);
        if (!addr) {
          return res.status(404).json({ error: `Name '${to}' not found` });
        }
        resolvedTo = addr;
      }

      if (!isValidAddress(resolvedTo)) {
        return res.status(400).json({ error: 'Invalid receiver address' });
      }
      if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
      }

      const message = req.body.message || '';
      if (message && message.length > 280) {
        return res.status(400).json({ error: 'Message too long (max 280 chars)' });
      }
      const tx = sendTransaction(resolvedTo, amount, resolvedKey, message);
      res.json({ success: true, txid: tx.id, txOuts: tx.txOuts.length, toName: to !== resolvedTo ? to : undefined, message: message || undefined });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ──────────────────────────────────────────
  // Mining
  // ──────────────────────────────────────────
  app.post('/api/v1/mine', async (req, res) => {
    try {
      const { minerAddress } = req.body;
      if (!minerAddress) {
        return res.status(400).json({ error: 'Missing minerAddress' });
      }
      if (!isValidAddress(minerAddress)) {
        return res.status(400).json({ error: 'Invalid miner address' });
      }
      const newBlock = await generateNextBlock(minerAddress);
      if (!newBlock) {
        return res.status(400).json({ error: 'Could not generate block' });
      }
      res.json({ success: true, blockHash: newBlock.hash, blockIndex: newBlock.index, txCount: newBlock.data.length });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/v1/mine/:address', async (req, res) => {
    try {
      if (!isValidAddress(req.params.address)) {
        return res.status(400).json({ error: 'Invalid miner address' });
      }
      const newBlock = await generateNextBlock(req.params.address);
      if (!newBlock) {
        return res.status(400).json({ error: 'Could not generate block' });
      }
      res.json({ success: true, blockHash: newBlock.hash, blockIndex: newBlock.index, txCount: newBlock.data.length });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ──────────────────────────────────────────
  // Wallets
  // ──────────────────────────────────────────
  app.get('/api/v1/wallets', (_req, res) => {
    const wallets = listWallets().map(w => ({
      id: w.id,
      name: w.name,
      address: w.address,
      createdAt: w.createdAt,
    }));
    res.json(wallets);
  });

  app.post('/api/v1/wallets/create', (req, res) => {
    try {
      const { name, password } = req.body;
      if (!name || !password) {
        return res.status(400).json({ error: 'Name and password required' });
      }
      if (password.length < 4) {
        return res.status(400).json({ error: 'Password must be at least 4 characters' });
      }
      const wallet = createWallet(name, password);
      res.json({ success: true, id: wallet.id, name: wallet.name, address: wallet.address });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/v1/wallets/export', (req, res) => {
    try {
      const { walletId, password } = req.body;
      if (!walletId || !password) {
        return res.status(400).json({ error: 'Wallet ID and password required' });
      }
      const key = exportPrivateKey(walletId, password);
      if (!key) {
        return res.status(401).json({ error: 'Invalid wallet ID or password' });
      }
      res.json({ success: true, privateKey: key });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/v1/wallets/import', (req, res) => {
    try {
      const { privateKey, name, password } = req.body;
      if (!privateKey || !name || !password) {
        return res.status(400).json({ error: 'Private key, name, and password required' });
      }
      if (privateKey.length !== 64) {
        return res.status(400).json({ error: 'Private key must be 64 hex characters' });
      }
      if (password.length < 4) {
        return res.status(400).json({ error: 'Password must be at least 4 characters' });
      }
      const wallet = importWallet(privateKey, name, password);
      res.json({ success: true, id: wallet.id, name: wallet.name, address: wallet.address });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/v1/wallets/:address/balance', (req, res) => {
    if (!isValidAddress(req.params.address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }
    const balance = getAccountBalance(req.params.address);
    const utxos = getMyUnspentTransactionOutputs(req.params.address);
    res.json({ address: req.params.address, balance, utxos: utxos.length });
  });

  // ──────────────────────────────────────────
  // Rich list / Address
  // ──────────────────────────────────────────
  app.get('/api/v1/richlist', (_req, res) => {
    const wallets = listWallets();
    const utxos = getUnspentTxOuts();
    const rich = wallets
      .map(w => ({
        id: w.id,
        name: w.name,
        address: w.address,
        balance: utxos.filter(u => u.address === w.address).reduce((s, u) => s + u.amount, 0),
      }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 20);
    const totalSupply = utxos.reduce((s, u) => s + u.amount, 0);
    res.json({ totalSupply, count: rich.length, wallets: rich });
  });

  app.get('/api/v1/address/:address', (req, res) => {
    if (!isValidAddress(req.params.address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }
    const balance = getAccountBalance(req.params.address);
    const utxos = getMyUnspentTransactionOutputs(req.params.address);
    res.json({ address: req.params.address, balance, unspentTxOuts: utxos });
  });

  app.get('/api/v1/utxos', (_req, res) => {
    const utxos = getUnspentTxOuts();
    res.json({ count: utxos.length, utxos });
  });

  app.get('/api/v1/transaction-pool', (_req, res) => {
    res.json(getTransactionPool());
  });

  // ──────────────────────────────────────────
  // CNS Names
  // ──────────────────────────────────────────
  app.post('/api/v1/names/register', (req, res) => {
    try {
      const { name, address, ownerId } = req.body;
      if (!name || !address) {
        return res.status(400).json({ error: 'Missing name or address' });
      }
      if (!isValidAddress(address)) {
        return res.status(400).json({ error: 'Invalid address' });
      }
      const entry = registerName(name, address, ownerId || '');
      res.json({ success: true, name: entry.name + '.pro', address: entry.address });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/v1/names/resolve/:name', (req, res) => {
    const address = resolveName(req.params.name);
    if (!address) return res.status(404).json({ error: 'Name not found' });
    res.json({ name: req.params.name.toLowerCase() + '.pro', address });
  });

  app.get('/api/v1/names/lookup/:address', (req, res) => {
    const name = lookupAddress(req.params.address);
    if (!name) return res.status(404).json({ error: 'No name found for this address' });
    res.json({ address: req.params.address, name });
  });

  app.get('/api/v1/names', (_req, res) => {
    res.json({ count: listNames().length, names: listNames() });
  });

  // ──────────────────────────────────────────
  // Peers
  // ──────────────────────────────────────────
  app.get('/api/v1/peers', (_req, res) => {
    res.json({ count: getPeers().length, peers: getPeers() });
  });

  app.post('/api/v1/peers/connect', (req, res) => {
    const { peers } = req.body;
    if (!peers || !Array.isArray(peers)) {
      return res.status(400).json({ error: 'peers array required' });
    }
    connectToPeers(peers);
    res.json({ success: true, message: `Connecting to ${peers.length} peers...` });
  });

  app.listen(httpPort, () => {
    logger.info(`HTTP API server listening on port ${httpPort}`);
    logger.info(`API available at http://localhost:${httpPort}/api/v1/info`);
  });
}
