import * as readline from 'readline';
import { logger, getRecentLogs } from './logger';
import { getBlockchain, getLatestBlock, getAccountBalance, getUnspentTxOuts, generateNextBlock, getBlockByHash, sendTransaction } from './blockchain';
import { getTransactionPool } from './transactionPool';
import { getPeers, connectToPeers, connectToPeer } from './p2p';
import { createWallet, listWallets, importWallet, getPrivateKey, isValidAddress } from './wallet';
import { registerName, resolveName, lookupAddress, listNames, isNameReference } from './names';
import { registerUser, loginUser, authenticate, listUsers, makeAdmin, removeAdmin, resetUserPassword, deleteUser } from './users';
import { createTicket, getTickets, getTicket, getTicketsByStatus, reopenTicket, replyToTicket, closeTicket, userReplyToTicket, getTicketStats, deleteTicket } from './support';
import { getAllSettings, setSetting, deleteSetting, loadPeers, removePeer, cleanupDeadPeers, listAllSessions, revokeSession, vacuumDB } from './database';
import { getConfig, setConfig } from './config';
import * as os from 'os';

let rl: readline.ReadLine | null = null;

let currentUser: { username: string; token: string; isAdmin: boolean } | null = null;

function printHeader(): void {
  const config = getConfig();
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║         BLACKCOIN NODE v1.0              ║');
  console.log(`║         Network: ${config.network.padEnd(25)}║`);
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
}

function printHelp(): void {
  console.log('');
  console.log('═══ GENERAL ═══');
  console.log('  help, ?                    Show this help');
  console.log('  info                       Node info');
  console.log('  blockchain                 Show blockchain summary');
  console.log('  blocks                     Show latest blocks');
  console.log('  block <hash|index>         Show block details');
  console.log('  balance <address>          Get address balance');
  console.log('  utxos                      Show unspent outputs');
  console.log('  pool                       Show transaction pool');
  console.log('');
  console.log('═══ WALLET ═══');
  console.log('  wallets                    List wallets');
  console.log('  wallet:create <name>       Create wallet (prompts for password)');
  console.log('  wallet:show <id|address>   Show wallet details');
  console.log('  wallet:import <pk> <name>  Import private key (prompts for password)');
  console.log('  wallet:export <id>         Export private key (prompts for password)');
  console.log('  send <to> <amt> <from>     Send coins, supports @name.pro');
  console.log('                             Optional: send <to> <amt> <from> <msg>');
  console.log('  mine <address>             Mine a block');
  console.log('');
  console.log('═══ CNS NAMES ═══');
  console.log('  name:register <n> <addr>   Register CNS name (e.g. alice)');
  console.log('  name:resolve <name>        Resolve CNS name to address');
  console.log('  name:lookup <address>      Find name for an address');
  console.log('  names                      List all CNS names');
  console.log('');
  console.log('═══ NETWORK ═══');
  console.log('  peers                      List connected peers');
  console.log('  peer:connect <ws://h:p>    Connect to peer');
  console.log('  peer:stored                List known peers');
  console.log('');
  console.log('═══ AUTH ═══');
  console.log('  register <user> <pass>     Register a new user');
  console.log('  register:admin <u> <p>     Register as admin (prompts for code)');
  console.log('  login <user> <pass>        Login');
  console.log('  logout                     Logout');
  console.log('  me                         Show current user');
  console.log('');
  console.log('═══ SUPPORT ═══');
  console.log('  ticket:create <subj> <msg> Create support ticket');
  console.log('  ticket:list                List your tickets');
  console.log('  ticket:show <id>           Show ticket with conversation');
  console.log('  ticket:reply <id> <msg>    Reply to your ticket');
  console.log('  ticket:reopen <id>         Reopen a closed ticket');
  console.log('');
  console.log('═══ ADMIN ═══');
  console.log('  admin:users                List all users');
  console.log('  admin:add <user>           Make user admin');
  console.log('  admin:remove <user>        Demote admin');
  console.log('  admin:reset-pass <user>    Reset user password (prompts)');
  console.log('  admin:delete <user>        Delete user');
  console.log('  admin:tickets [open|closed] List all tickets (optional filter)');
  console.log('  admin:ticket <id>          View ticket details');
  console.log('  admin:reply <id> <msg>     Reply (closes unless -noclose)');
  console.log('  admin:ticket:close <id>    Close ticket');
  console.log('  admin:ticket:delete <id>   Delete ticket');
  console.log('  admin:stats                System statistics');
  console.log('  admin:logs [n]             View recent logs');
  console.log('  admin:settings             Show all settings');
  console.log('  admin:setting <k> <v>      Set a setting');
  console.log('  admin:peers                Show stored peers');
  console.log('  admin:peers:cleanup        Remove dead peers');
  console.log('  admin:sessions             List active sessions');
  console.log('  admin:revoke <token>       Revoke a session');
  console.log('  admin:announce <msg>       Broadcast message to peers');
  console.log('  admin:log:level <level>    Set log level (error|warn|info|debug)');
  console.log('  admin:db:vacuum            Vacuum database');
  console.log('');
  console.log('═══ OTHER ═══');
  console.log('  config                     Show configuration');
  console.log('  clear                      Clear screen');
  console.log('  exit, quit                 Stop node');
  console.log('');
}

function formatTimestamp(ts: number): string {
  if (ts === 0) return 'Genesis';
  const ms = ts < 10000000000 ? ts * 1000 : ts;
  return new Date(ms).toISOString();
}

async function promptUser(): Promise<void> {
  if (rl) rl.close();

  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  printHeader();
  printHelp();

  const ask = () => {
    const prefix = currentUser ? `${currentUser.username}@` : '';
    rl!.question(`${prefix}blackcoin> `, async (input) => {
      const args = input.trim().split(/\s+/);
      const cmd = args[0]?.toLowerCase() || '';

      try {
        switch (cmd) {
          case 'help':
          case '?':
            printHelp();
            break;

          case 'info': {
            const chain = getBlockchain();
            const latest = getLatestBlock();
            const utxos = getUnspentTxOuts();
            const pool = getTransactionPool();
            const wallets = listWallets();
            console.log('');
            console.log(`  Blocks:       ${chain.length}`);
            console.log(`  Tx count:     ${chain.reduce((s, b) => s + b.data.length, 0)}`);
            console.log(`  UTXOs:        ${utxos.length}`);
            console.log(`  Pool size:    ${pool.length}`);
            console.log(`  Peers:        ${getPeers().length}`);
            console.log(`  Wallets:      ${wallets.length}`);
            console.log(`  Latest block: #${latest.index} (${latest.hash.substring(0, 16)}...)`);
            console.log(`  Difficulty:   ${latest.difficulty}`);
            if (currentUser) console.log(`  Logged in:    ${currentUser.username}${currentUser.isAdmin ? ' (admin)' : ''}`);
            break;
          }

          case 'blockchain':
          case 'bc': {
            const chain = getBlockchain();
            console.log('');
            console.log(`  Blockchain (${chain.length} blocks):`);
            chain.forEach(b => {
              const txs = b.data.map(t => t.id.substring(0, 12)).join(', ');
              console.log(`  #${b.index} [${b.hash.substring(0, 12)}...] ${formatTimestamp(b.timestamp)} | ${b.data.length} tx(s) | diff: ${b.difficulty}`);
            });
            break;
          }

          case 'blocks': {
            const chain = getBlockchain();
            const latest20 = chain.slice(-20);
            console.log('');
            console.log(`  Latest blocks (${latest20.length}):`);
            latest20.forEach(b => {
              console.log(`  #${b.index} ${b.hash.substring(0, 16)}... diff:${b.difficulty} txs:${b.data.length}`);
            });
            break;
          }

          case 'block': {
            const query = args[1];
            if (!query) return console.log('  Usage: block <hash|index>');
            let block;
            if (/^\d+$/.test(query)) {
              block = getBlockchain().find(b => b.index === parseInt(query));
            } else {
              block = getBlockByHash(query);
            }
            if (!block) return console.log('  Block not found');
            console.log('');
            console.log(`  Block #${block.index}`);
            console.log(`  Hash:        ${block.hash}`);
            console.log(`  Previous:    ${block.previousHash}`);
            console.log(`  Timestamp:   ${formatTimestamp(block.timestamp)}`);
            console.log(`  Difficulty:  ${block.difficulty}`);
            console.log(`  Nonce:       ${block.nonce}`);
            console.log(`  Transactions:`);
            block.data.forEach(tx => {
              console.log(`    ${tx.id.substring(0, 16)}...`);
              tx.txIns.forEach(ti => console.log(`      In:  ${ti.txOutId.substring(0, 12)}...[${ti.txOutIndex}]`));
              tx.txOuts.forEach(to => console.log(`      Out: ${to.address} -> ${to.amount}`));
            });
            break;
          }

          case 'balance': {
            const address = args[1];
            if (!address) return console.log('  Usage: balance <address>');
            if (!isValidAddress(address)) return console.log('  Invalid address');
            const balance = getAccountBalance(address);
            console.log(`  Balance of ${address}: ${balance}`);
            break;
          }

          case 'utxos': {
            const utxos = getUnspentTxOuts();
            console.log('');
            console.log(`  Unspent TX Outputs (${utxos.length}):`);
            utxos.forEach(u => {
              console.log(`  ${u.txOutId.substring(0, 16)}...[${u.txOutIndex}] ${u.address} -> ${u.amount}`);
            });
            break;
          }

          case 'pool': {
            const pool = getTransactionPool();
            console.log('');
            console.log(`  Transaction Pool (${pool.length}):`);
            pool.forEach(tx => {
              console.log(`  ${tx.id.substring(0, 16)}... amount: ${tx.txOuts.reduce((s, o) => s + o.amount, 0)}`);
            });
            break;
          }

          case 'wallets': {
            const wallets = listWallets();
            console.log('');
            console.log(`  Wallets (${wallets.length}):`);
            wallets.forEach(w => {
              const balance = getAccountBalance(w.address);
              console.log(`  [${w.id.substring(0, 12)}...] ${w.name} - ${w.address} balance: ${balance}`);
            });
            break;
          }

          case 'wallet:create': {
            const name = args.slice(1).join(' ') || 'default';
            console.log('');
            const pwd = await new Promise<string>(resolve => {
              rl!.question('  Enter password (min 4 chars): ', resolve);
            });
            if (!pwd || pwd.length < 4) return console.log('  Password must be at least 4 characters');
            const pwd2 = await new Promise<string>(resolve => {
              rl!.question('  Confirm password: ', resolve);
            });
            if (pwd !== pwd2) return console.log('  Passwords do not match');
            const wallet = createWallet(name, pwd);
            console.log('');
            console.log(`  Wallet created!`);
            console.log(`  ID:      ${wallet.id}`);
            console.log(`  Name:    ${wallet.name}`);
            console.log(`  Address: ${wallet.address}`);
            break;
          }

          case 'wallet:show': {
            const query = args[1];
            if (!query) return console.log('  Usage: wallet:show <id|address>');
            const wallets = listWallets();
            const wallet = wallets.find(w => w.id === query || w.address === query);
            if (!wallet) return console.log('  Wallet not found');
            const balance = getAccountBalance(wallet.address);
            console.log('');
            console.log(`  ID:        ${wallet.id}`);
            console.log(`  Name:      ${wallet.name}`);
            console.log(`  Address:   ${wallet.address}`);
            console.log(`  PublicKey: ${wallet.publicKey.substring(0, 32)}...`);
            console.log(`  Balance:   ${balance}`);
            console.log(`  Created:   ${new Date(wallet.createdAt).toISOString()}`);
            break;
          }

          case 'wallet:import': {
            const privKey = args[1];
            const name = args.slice(2).join(' ') || 'imported';
            if (!privKey) return console.log('  Usage: wallet:import <privatekey_hex> <name>');
            if (!/^[a-fA-F0-9]{64}$/.test(privKey)) return console.log('  Invalid private key format (must be 64 hex chars)');
            console.log('');
            const pwd = await new Promise<string>(resolve => {
              rl!.question('  Enter password (min 4 chars): ', resolve);
            });
            if (!pwd || pwd.length < 4) return console.log('  Password must be at least 4 characters');
            try {
              const wallet = importWallet(privKey, name, pwd);
              console.log(`  Wallet imported: ${wallet.name} (${wallet.address})`);
            } catch (e: any) {
              console.log(`  Error: ${e.message}`);
            }
            break;
          }

          case 'wallet:export': {
            const id = args[1];
            if (!id) return console.log('  Usage: wallet:export <id>');
            const pwd = await new Promise<string>(resolve => {
              rl!.question('  Enter password: ', resolve);
            });
            const key = getPrivateKey(id, pwd);
            if (!key) return console.log('  Invalid wallet ID or password');
            console.log(`  Private key: ${key}`);
            break;
          }

          case 'name:register': {
            const nName = args[1];
            const nAddr = args[2];
            if (!nName || !nAddr) return console.log('  Usage: name:register <name> <address>');
            if (!isValidAddress(nAddr)) return console.log('  Invalid address');
            try {
              const entry = registerName(nName, nAddr, '');
              console.log(`  Registered: ${entry.name}.pro -> ${entry.address}`);
            } catch (e: any) {
              console.log(`  Error: ${e.message}`);
            }
            break;
          }

          case 'name:resolve': {
            const rName = args[1];
            if (!rName) return console.log('  Usage: name:resolve <name>');
            const addr = resolveName(rName);
            if (!addr) return console.log(`  Name '${rName}' not found`);
            const display = rName.endsWith('.pro') ? rName : rName + '.pro';
            console.log(`  ${display} -> ${addr}`);
            break;
          }

          case 'name:lookup': {
            const lAddr = args[1];
            if (!lAddr) return console.log('  Usage: name:lookup <address>');
            const name = lookupAddress(lAddr);
            if (!name) return console.log('  No name found for this address');
            console.log(`  ${lAddr} -> ${name}`);
            break;
          }

          case 'names': {
            const all = listNames();
            console.log('');
            console.log(`  CNS Names (${all.length}):`);
            all.forEach(e => {
              console.log(`  ${e.name}.pro -> ${e.address}`);
            });
            break;
          }

          case 'send': {
            let to = args[1];
            const amt = parseFloat(args[2]);
            const fromId = args[3];
            const msg = args.slice(4).join(' ') || '';
            if (!to || !amt || !fromId) return console.log('  Usage: send <toAddress|name.pro> <amount> <fromWalletId> [message]');
            if (msg && msg.length > 280) return console.log('  Message too long (max 280 chars)');
            if (isNameReference(to)) {
              const resolved = resolveName(to);
              if (!resolved) return console.log(`  Name '${to}' not found. Register it first with name:register`);
              console.log(`  Resolved ${to} -> ${resolved}`);
              to = resolved;
            }
            if (!isValidAddress(to)) return console.log('  Invalid target address');
            if (!isFinite(amt) || amt <= 0) return console.log('  Invalid amount');
            const pwd = await new Promise<string>(resolve => {
              rl!.question('  Enter wallet password: ', resolve);
            });
            const privKey = getPrivateKey(fromId, pwd);
            if (!privKey) return console.log('  Invalid wallet ID or password');
            try {
              const tx = sendTransaction(to, amt, privKey, msg || undefined);
              console.log(`  Transaction sent: ${tx.id}${msg ? ` with message: "${msg}"` : ''}`);
            } catch (e: any) {
              console.log(`  Error: ${e.message}`);
            }
            break;
          }

          case 'mine': {
            const address = args[1];
            if (!address) return console.log('  Usage: mine <address>');
            if (!isValidAddress(address)) return console.log('  Invalid address');
            console.log('  Mining... (the node remains responsive during mining)');
            const block = await generateNextBlock(address);
            if (block) {
              console.log(`  Block #${block.index} mined! ${block.hash.substring(0, 16)}...`);
            } else {
              console.log('  Mining failed');
            }
            break;
          }

          case 'peers': {
            const peers = getPeers();
            console.log('');
            console.log(`  Connected peers (${peers.length}):`);
            peers.forEach(p => console.log(`  ${p}`));
            break;
          }

          case 'peer:connect': {
            const peer = args[1];
            if (!peer) return console.log('  Usage: peer:connect <ws://host:port>');
            connectToPeers([peer]);
            console.log(`  Connecting to ${peer}...`);
            break;
          }

          // ──────── AUTH ────────
          case 'register': {
            const u = args[1];
            const p = args[2];
            if (!u || !p) return console.log('  Usage: register <username> <password>');
            try {
              const user = registerUser(u, p);
              const token = loginUser(u, p);
              currentUser = { username: user.username, token: token!, isAdmin: user.isAdmin };
              console.log(`  Registered and logged in as ${user.username}${user.isAdmin ? ' (admin)' : ''}`);
            } catch (e: any) {
              console.log(`  Error: ${e.message}`);
            }
            break;
          }

          case 'register:admin': {
            const u = args[1];
            const p = args[2];
            if (!u || !p) return console.log('  Usage: register:admin <username> <password>');
            const code = await new Promise<string>(resolve => {
              rl!.question('  Enter admin code: ', resolve);
            });
            try {
              const user = registerUser(u, p, code);
              const token = loginUser(u, p);
              currentUser = { username: user.username, token: token!, isAdmin: user.isAdmin };
              if (user.isAdmin) {
                console.log(`  Registered and logged in as ADMIN: ${user.username}`);
              } else {
                console.log(`  Registered as ${user.username} (invalid admin code, regular user)`);
              }
            } catch (e: any) {
              console.log(`  Error: ${e.message}`);
            }
            break;
          }

          case 'login': {
            const u = args[1];
            const p = args[2];
            if (!u || !p) return console.log('  Usage: login <username> <password>');
            const token = loginUser(u, p);
            if (!token) return console.log('  Invalid credentials');
            const user = authenticate(token);
            currentUser = { username: u, token, isAdmin: user?.isAdmin || false };
            console.log(`  Logged in as ${u}${currentUser.isAdmin ? ' (admin)' : ''}`);
            break;
          }

          case 'logout': {
            if (!currentUser) return console.log('  Not logged in');
            currentUser = null;
            console.log('  Logged out');
            break;
          }

          case 'me': {
            if (!currentUser) return console.log('  Not logged in');
            console.log(`  Username: ${currentUser.username}`);
            console.log(`  Role:     ${currentUser.isAdmin ? 'Admin' : 'User'}`);
            break;
          }

          // ──────── SUPPORT TICKETS ────────
          case 'ticket:create': {
            if (!currentUser) return console.log('  Login first: login <user> <pass>');
            const subject = args[1];
            const msg = args.slice(2).join(' ');
            if (!subject) return console.log('  Usage: ticket:create <subject> <message>');
            try {
              const ticket = createTicket(currentUser.username, subject, msg);
              console.log('');
              console.log(`  Ticket created: ${ticket.id}`);
              console.log(`  Subject: ${ticket.subject}`);
              console.log(`  Use ticket:show ${ticket.id} to view`);
            } catch (e: any) {
              console.log(`  Error: ${e.message}`);
            }
            break;
          }

          case 'ticket:list': {
            if (!currentUser) return console.log('  Login first: login <user> <pass>');
            const tickets = currentUser.isAdmin ? getTickets() : getTickets(currentUser.username);
            console.log('');
            if (tickets.length === 0) return console.log('  No tickets found');
            console.log(`  Tickets (${tickets.length}):`);
            tickets.forEach(t => {
              const replies = t.replies.length;
              const last = replies > 0 ? ` - last reply ${new Date(t.updatedAt).toLocaleDateString()}` : '';
              console.log(`  [${t.status}] ${t.id} ${t.subject} (${replies} replies) by ${t.username}${last}`);
            });
            break;
          }

          case 'ticket:show': {
            const tid = args[1];
            if (!tid) return console.log('  Usage: ticket:show <id>');
            const ticket = getTicket(tid);
            if (!ticket) return console.log('  Ticket not found');
            if (!currentUser || (!currentUser.isAdmin && ticket.username !== currentUser.username)) {
              return console.log('  Access denied');
            }
            console.log('');
            console.log(`  ID:        ${ticket.id}`);
            console.log(`  Status:    ${ticket.status}`);
            console.log(`  By:        ${ticket.username}`);
            console.log(`  Subject:   ${ticket.subject}`);
            console.log(`  Created:   ${new Date(ticket.createdAt).toISOString()}`);
            console.log(`  Updated:   ${new Date(ticket.updatedAt).toISOString()}`);
            if (ticket.txId) console.log(`  TxId:      ${ticket.txId}`);
            console.log('');
            console.log(`  ─── Conversation ───`);
            console.log(`  [USER] ${ticket.username}: ${ticket.message}`);
            if (ticket.replies.length > 0) {
              ticket.replies.forEach((r) => {
                const label = r.type === 'admin' ? 'ADMIN' : r.type === 'system' ? 'SYSTEM' : 'USER';
                console.log(`  [${label}] ${r.by}: ${r.message}`);
                console.log(`          ${new Date(r.createdAt).toISOString()}`);
              });
            }
            console.log(`  ────────────────────`);
            break;
          }

          case 'ticket:reply': {
            if (!currentUser) return console.log('  Login first');
            const rtid = args[1];
            const rmsg = args.slice(2).join(' ');
            if (!rtid || !rmsg) return console.log('  Usage: ticket:reply <id> <message>');
            try {
              const ticket = userReplyToTicket(rtid, currentUser.username, rmsg);
              if (ticket) {
                console.log(`  Replied to ticket ${rtid}`);
              } else {
                console.log('  Ticket not found or access denied');
              }
            } catch (e: any) {
              console.log(`  Error: ${e.message}`);
            }
            break;
          }

          case 'ticket:reopen': {
            if (!currentUser) return console.log('  Login first');
            const rtid = args[1];
            if (!rtid) return console.log('  Usage: ticket:reopen <id>');
            try {
              const t = reopenTicket(rtid, currentUser.username);
              if (t) {
                console.log(`  Ticket ${rtid} reopened`);
              } else {
                console.log('  Ticket not found or access denied');
              }
            } catch (e: any) {
              console.log(`  Error: ${e.message}`);
            }
            break;
          }

          // ──────── ADMIN ────────
          case 'admin:users': {
            if (!currentUser?.isAdmin) return console.log('  Admin only');
            const users = listUsers();
            console.log('');
            console.log(`  Users (${users.length}):`);
            users.forEach(u => {
              console.log(`  ${u.isAdmin ? '[ADMIN]' : '[USER] '} ${u.username} (created: ${new Date(u.createdAt).toISOString()})`);
            });
            break;
          }

          case 'admin:add': {
            if (!currentUser?.isAdmin) return console.log('  Admin only');
            const target = args[1];
            if (!target) return console.log('  Usage: admin:add <username>');
            try {
              const user = makeAdmin(target, currentUser.username);
              logger.admin(`${target} promoted to admin by ${currentUser.username}`);
              console.log(`  ${user.username} is now admin`);
            } catch (e: any) {
              console.log(`  Error: ${e.message}`);
            }
            break;
          }

          case 'admin:remove': {
            if (!currentUser?.isAdmin) return console.log('  Admin only');
            const target2 = args[1];
            if (!target2) return console.log('  Usage: admin:remove <username>');
            try {
              const user = removeAdmin(target2, currentUser.username);
              logger.admin(`${target2} demoted by ${currentUser.username}`);
              console.log(`  ${user.username} is no longer admin`);
            } catch (e: any) {
              console.log(`  Error: ${e.message}`);
            }
            break;
          }

          case 'admin:reset-pass': {
            if (!currentUser?.isAdmin) return console.log('  Admin only');
            const ruser = args[1];
            if (!ruser) return console.log('  Usage: admin:reset-pass <username>');
            const newPwd = await new Promise<string>(resolve => {
              rl!.question('  New password: ', resolve);
            });
            try {
              resetUserPassword(ruser, newPwd, currentUser.username);
              logger.admin(`Password reset for ${ruser} by ${currentUser.username}`);
              console.log(`  Password for ${ruser} updated`);
            } catch (e: any) {
              console.log(`  Error: ${e.message}`);
            }
            break;
          }

          case 'admin:delete': {
            if (!currentUser?.isAdmin) return console.log('  Admin only');
            const duser = args[1];
            if (!duser) return console.log('  Usage: admin:delete <username>');
            const confirm = await new Promise<string>(resolve => {
              rl!.question(`  Are you sure you want to delete '${duser}'? (yes/no): `, resolve);
            });
            if (confirm.toLowerCase() !== 'yes') return console.log('  Cancelled');
            try {
              deleteUser(duser, currentUser.username);
              logger.admin(`User ${duser} deleted by ${currentUser.username}`);
              console.log(`  User ${duser} deleted`);
            } catch (e: any) {
              console.log(`  Error: ${e.message}`);
            }
            break;
          }

          case 'admin:tickets': {
            if (!currentUser?.isAdmin) return console.log('  Admin only');
            const statusFilter = args[1]?.toLowerCase();
            const allTickets = statusFilter ? getTicketsByStatus(statusFilter as any) : getTickets();
            console.log('');
            if (allTickets.length === 0) return console.log('  No tickets found');
            console.log(`  All Support Tickets (${allTickets.length}):`);
            allTickets.forEach(t => {
              const replies = t.replies.length;
              const last = replies > 0 ? ` - last: ${new Date(t.updatedAt).toLocaleDateString()}` : '';
              console.log(`  [${t.status}] ${t.id} ${t.subject} by ${t.username} (${replies} replies)${last}`);
            });
            console.log(`  Use 'admin:ticket <id>' to view details`);
            break;
          }

          case 'admin:ticket': {
            if (!currentUser?.isAdmin) return console.log('  Admin only');
            const aid = args[1];
            if (!aid) return console.log('  Usage: admin:ticket <id>');
            const ticket = getTicket(aid);
            if (!ticket) return console.log('  Ticket not found');
            console.log('');
            console.log(`  ID:        ${ticket.id}`);
            console.log(`  Status:    ${ticket.status}`);
            console.log(`  By:        ${ticket.username}`);
            console.log(`  Subject:   ${ticket.subject}`);
            console.log(`  Created:   ${new Date(ticket.createdAt).toISOString()}`);
            console.log(`  Updated:   ${new Date(ticket.updatedAt).toISOString()}`);
            if (ticket.txId) console.log(`  TxId:      ${ticket.txId}`);
            console.log('');
            console.log(`  ─── Conversation ───`);
            console.log(`  [USER] ${ticket.username}: ${ticket.message}`);
            ticket.replies.forEach((r) => {
              const label = r.type === 'admin' ? 'ADMIN' : r.type === 'system' ? 'SYSTEM' : 'USER';
              console.log(`  [${label}] ${r.by}: ${r.message}`);
              console.log(`          ${new Date(r.createdAt).toISOString()}`);
            });
            console.log(`  ────────────────────`);
            break;
          }

          case 'admin:reply': {
            if (!currentUser?.isAdmin) return console.log('  Admin only');
            const rtid2 = args[1];
            if (!rtid2) return console.log('  Usage: admin:reply <ticketId> <message> [-noclose]');
            const closeIdx = args.indexOf('-noclose');
            const closeAfter = closeIdx === -1;
            const replyMsg = closeIdx === -1 ? args.slice(2).join(' ') : args.slice(2, closeIdx).join(' ');
            if (!replyMsg) return console.log('  Usage: admin:reply <ticketId> <message> [-noclose]');
            try {
              const ticket = replyToTicket(rtid2, currentUser.username, replyMsg, closeAfter);
              if (ticket) {
                console.log(`  Replied to ticket ${rtid2}${closeAfter ? ' and closed' : ' (open)'}`);
                logger.admin(`Replied to ticket ${rtid2} by ${currentUser.username}`);
              } else {
                console.log('  Ticket not found');
              }
            } catch (e: any) {
              console.log(`  Error: ${e.message}`);
            }
            break;
          }

          case 'admin:ticket:close': {
            if (!currentUser?.isAdmin) return console.log('  Admin only');
            const ctid = args[1];
            if (!ctid) return console.log('  Usage: admin:ticket:close <id>');
            try {
              const t = closeTicket(ctid, currentUser.username);
              if (t) {
                console.log(`  Ticket ${ctid} closed`);
                logger.admin(`Ticket ${ctid} closed by ${currentUser.username}`);
              } else {
                console.log('  Ticket not found');
              }
            } catch (e: any) {
              console.log(`  Error: ${e.message}`);
            }
            break;
          }

          case 'admin:ticket:delete': {
            if (!currentUser?.isAdmin) return console.log('  Admin only');
            const dtid = args[1];
            if (!dtid) return console.log('  Usage: admin:ticket:delete <id>');
            const confirm2 = await new Promise<string>(resolve => {
              rl!.question(`  Delete ticket '${dtid}'? (yes/no): `, resolve);
            });
            if (confirm2.toLowerCase() !== 'yes') return console.log('  Cancelled');
            if (deleteTicket(dtid, currentUser.username)) {
              console.log(`  Ticket ${dtid} deleted`);
              logger.admin(`Ticket ${dtid} deleted by ${currentUser.username}`);
            } else {
              console.log('  Ticket not found');
            }
            break;
          }

          case 'admin:stats': {
            if (!currentUser?.isAdmin) return console.log('  Admin only');
            const chain = getBlockchain();
            const latest = getLatestBlock();
            const utxos = getUnspentTxOuts();
            const pool = getTransactionPool();
            const wallets = listWallets();
            const users = listUsers();
            const stats = getTicketStats();
            const mem = process.memoryUsage();
            const uptime = process.uptime();
            const days = Math.floor(uptime / 86400);
            const hours = Math.floor((uptime % 86400) / 3600);
            console.log('');
            console.log(`  ╔══ Node Stats ═══`);
            console.log(`  ║  Uptime:      ${days}d ${hours}h`);
            console.log(`  ║  Memory:      ${(mem.rss / 1024 / 1024).toFixed(1)} MB RSS`);
            console.log(`  ║  Blocks:      ${chain.length}`);
            console.log(`  ║  Latest:      #${latest.index} (${latest.hash.substring(0, 12)}...)`);
            console.log(`  ║  Difficulty:  ${latest.difficulty}`);
            console.log(`  ║  UTXOs:       ${utxos.length}`);
            console.log(`  ║  Pool:        ${pool.length}`);
            console.log(`  ║  Wallets:     ${wallets.length}`);
            console.log(`  ║  Users:       ${users.length}`);
            console.log(`  ║  Admins:      ${users.filter(u => u.isAdmin).length}`);
            console.log(`  ║  Peers:       ${getPeers().length}`);
            console.log(`  ║  Tickets:     ${stats.total} (${stats.open} open, ${stats.closed} closed)`);
            console.log(`  ╚═══════════════`);
            break;
          }

          case 'admin:logs': {
            if (!currentUser?.isAdmin) return console.log('  Admin only');
            const n = parseInt(args[1]) || 50;
            const logs = getRecentLogs(n);
            console.log('');
            if (logs.length === 0) return console.log('  No logs available');
            console.log(`  Recent logs (${logs.length}):`);
            logs.forEach(line => console.log(`  ${line}`));
            break;
          }

          case 'admin:settings': {
            if (!currentUser?.isAdmin) return console.log('  Admin only');
            const settings = getAllSettings();
            console.log('');
            console.log(`  Settings (${Object.keys(settings).length}):`);
            Object.entries(settings).forEach(([k, v]) => {
              console.log(`  ${k}: ${v}`);
            });
            break;
          }

          case 'admin:setting': {
            if (!currentUser?.isAdmin) return console.log('  Admin only');
            const skey = args[1];
            const sval = args.slice(2).join(' ');
            if (!skey || !sval) return console.log('  Usage: admin:setting <key> <value>');
            setSetting(skey, sval);
            logger.admin(`Setting ${skey} = ${sval} by ${currentUser.username}`);
            console.log(`  Setting saved: ${skey} = ${sval}`);
            break;
          }

          case 'admin:peers': {
            if (!currentUser?.isAdmin) return console.log('  Admin only');
            const peers = loadPeers();
            console.log('');
            console.log(`  Stored Peers (${peers.length}):`);
            peers.forEach(p => {
              console.log(`  ${p.address} (lastSeen: ${new Date(p.lastSeen).toISOString()}, fails: ${p.failCount})`);
            });
            break;
          }

          case 'admin:peers:cleanup': {
            if (!currentUser?.isAdmin) return console.log('  Admin only');
            const removed = cleanupDeadPeers(10);
            console.log(`  Removed ${removed} dead peers`);
            break;
          }

          case 'admin:sessions': {
            if (!currentUser?.isAdmin) return console.log('  Admin only');
            const sessions = listAllSessions();
            console.log('');
            console.log(`  Active Sessions (${sessions.length}):`);
            sessions.forEach(s => {
              const tokenShort = s.token.substring(0, 16) + '...';
              const expires = new Date(s.expiresAt).toISOString();
              const expLabel = Date.now() > s.expiresAt ? 'EXPIRED' : 'active';
              console.log(`  ${tokenShort} ${s.username} expires: ${expires} [${expLabel}]`);
            });
            break;
          }

          case 'admin:revoke': {
            if (!currentUser?.isAdmin) return console.log('  Admin only');
            const rtoken = args[1];
            if (!rtoken) return console.log('  Usage: admin:revoke <token>');
            revokeSession(rtoken);
            console.log('  Session revoked');
            break;
          }

          case 'admin:announce': {
            if (!currentUser?.isAdmin) return console.log('  Admin only');
            const announceMsg = args.slice(1).join(' ');
            if (!announceMsg) return console.log('  Usage: admin:announce <message>');
            const { getSockets, getPeers: getPeersList } = await import('./p2p');
            const message = JSON.stringify({ type: 'announcement', from: currentUser.username, message: announceMsg, timestamp: Date.now() });
            getSockets().forEach(ws => {
              try { ws.send(message); } catch {}
            });
            logger.admin(`Announcement sent to ${getPeersList().length} peers: ${announceMsg}`);
            console.log(`  Announcement sent to ${getPeersList().length} peers`);
            break;
          }

          case 'admin:log:level': {
            if (!currentUser?.isAdmin) return console.log('  Admin only');
            const level = args[1]?.toLowerCase();
            const valid = ['error', 'warn', 'info', 'debug'];
            if (!level || !valid.includes(level)) return console.log(`  Usage: admin:log:level <${valid.join('|')}>`);
            setConfig({ logLevel: level as any });
            logger.admin(`Log level changed to ${level} by ${currentUser.username}`);
            console.log(`  Log level set to: ${level}`);
            break;
          }

          case 'admin:db:vacuum': {
            if (!currentUser?.isAdmin) return console.log('  Admin only');
            vacuumDB();
            console.log('  Database vacuumed');
            break;
          }

          case 'peer:stored': {
            const storedPeers = loadPeers();
            console.log('');
            console.log(`  Known peers (${storedPeers.length}):`);
            storedPeers.slice(0, 20).forEach(p => {
              console.log(`  ${p.address} (fails: ${p.failCount})`);
            });
            break;
          }

          case 'config': {
            const config = getConfig();
            console.log('');
            Object.entries(config).forEach(([k, v]) => {
              console.log(`  ${k}: ${JSON.stringify(v)}`);
            });
            break;
          }

          case 'clear':
            console.clear();
            printHeader();
            break;

          case 'exit':
          case 'quit':
            console.log('  Stopping node...');
            process.exit(0);
            break;

          default:
            if (cmd) console.log(`  Unknown command: ${cmd}. Type 'help'`);
        }
      } catch (e: any) {
        console.log(`  Error: ${e.message}`);
      }

      ask();
    });
  };

  ask();
}

export { promptUser };
