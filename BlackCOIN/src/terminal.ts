import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger';
import { getBlockchain, getLatestBlock, getUnspentTxOuts } from './blockchain';
import { getPeers } from './p2p';
import { getTransactionPool } from './transactionPool';
import { listUsers } from './users';
import { listWallets } from './wallet';
import { getTickets, getTicketStats } from './support';
import { loadPeers, getAllSettings } from './database';

const execAsync = promisify(exec);

const BLOCKED_PATTERNS = [
  'rm -rf', 'rmdir /s', 'format', 'del /f',
  'shutdown', 'reboot', 'halt', 'poweroff',
  'dd if=', 'mkfs', 'fdisk', 'mkswap',
  'chmod 777', 'chown', 'sudo',
  '> /dev/', '> /dev/sda', ':(){', 'forkbomb',
];

function isBlocked(cmd: string): boolean {
  const lower = cmd.toLowerCase().trim();
  for (const p of BLOCKED_PATTERNS) {
    if (lower.includes(p)) return true;
  }
  return false;
}

function runBuiltin(cmd: string): { output: string } | null {
  const parts = cmd.trim().split(/\s+/);
  const main = parts[0].toLowerCase();

  if (main === 'help' || main === '?') {
    return {
      output: `Comandos disponibles:
  help, ?         - Muestra esta ayuda
  status, info    - Informacion del nodo
  users           - Lista de usuarios
  wallets         - Lista de carteras
  tickets         - Tickets de soporte
  peers           - Pares conectados
  mempool         - Transacciones en mempool
  settings        - Configuracion del nodo
  clear, cls      - Limpia la terminal
  exit            - Salir (vuelve al panel)

Cualquier otro comando se ejecuta en el sistema.
`
    };
  }

  if (main === 'status' || main === 'info') {
    const chain = getBlockchain();
    const latest = getLatestBlock();
    const utxos = getUnspentTxOuts();
    const pool = getTransactionPool();
    const users = listUsers();
    const wallets = listWallets();
    const peers = getPeers();
    const tickets = getTicketStats();
    return {
      output: `[Node Status]
  Bloques:     ${chain.length}
  Ultimo:      #${latest.index} (diff: ${latest.difficulty})
  UTXOs:       ${utxos.length}
  Mempool:     ${pool.length} txs
  Pares:       ${peers.length}
  Wallets:     ${wallets.length}
  Usuarios:    ${users.length} (${users.filter(u => u.isAdmin).length} admins)
  Tickets:     ${tickets.total} (${tickets.open} open, ${tickets.closed} closed)
  Uptime:      ${Math.floor(process.uptime() / 60)}m
  Memoria:     ${(process.memoryUsage().rss / 1024 / 1024).toFixed(0)} MB
`
    };
  }

  if (main === 'users') {
    const users = listUsers();
    return {
      output: users.map(u => `  ${u.username.padEnd(20)} ${u.isAdmin ? 'ADMIN' : 'user'}  ${new Date(u.createdAt).toISOString().slice(0, 10)}`).join('\n') +
        `\n  ---\n  Total: ${users.length} usuarios`
    };
  }

  if (main === 'wallets') {
    const wallets = listWallets();
    return {
      output: wallets.map(w => `  ${w.id.slice(0, 12).padEnd(14)} ${w.name.padEnd(16)} ${w.address.slice(0, 16)}...`).join('\n') +
        `\n  ---\n  Total: ${wallets.length} carteras`
    };
  }

  if (main === 'tickets') {
    const tickets = getTickets();
    return {
      output: tickets.map(t =>
        `  ${t.id.slice(0, 14).padEnd(16)} ${t.username.padEnd(14)} ${t.status.padEnd(8)} ${t.subject.slice(0, 30)}`
      ).join('\n') +
        `\n  ---\n  Total: ${tickets.length} tickets`
    };
  }

  if (main === 'peers') {
    const peers = getPeers();
    return {
      output: peers.length
        ? peers.map(p => `  ${p}`).join('\n')
        : '  No hay pares conectados'
    };
  }

  if (main === 'mempool') {
    const pool = getTransactionPool();
    return {
      output: pool.length
        ? pool.map(tx => `  ${tx.id.slice(0, 16)}...  outs: ${tx.txOuts.length}  msg: "${tx.message || ''}"`).join('\n')
        : '  Mempool vacio'
    };
  }

  if (main === 'settings') {
    const settings = getAllSettings();
    const entries = Object.entries(settings);
    return {
      output: entries.length
        ? entries.map(([k, v]) => `  ${k.padEnd(20)} = ${v}`).join('\n')
        : '  Sin configuraciones'
    };
  }

  if (main === 'clear' || main === 'cls') {
    return { output: '' };
  }

  return null;
}

export async function executeCommand(command: string, username: string): Promise<{ output: string; error?: string }> {
  const trimmed = command.trim();
  if (!trimmed) return { output: '', error: '' };

  logger.admin(`[TERMINAL] ${username}: ${trimmed}`);

  const builtin = runBuiltin(trimmed);
  if (builtin !== null) {
    return builtin;
  }

  if (isBlocked(trimmed)) {
    return { output: '', error: 'Comando bloqueado por seguridad' };
  }

  try {
    const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash';
    const shellFlag = process.platform === 'win32' ? '-Command' : '-c';
    const { stdout, stderr } = await execAsync(trimmed, {
      timeout: 15000,
      maxBuffer: 512 * 1024,
      cwd: process.cwd(),
      shell: `${shell} ${shellFlag}`,
    });
    return { output: stdout, error: stderr };
  } catch (e: any) {
    return {
      output: e.stdout || '',
      error: e.stderr || e.message,
    };
  }
}
