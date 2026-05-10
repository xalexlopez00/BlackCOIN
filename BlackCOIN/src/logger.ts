import * as fs from 'fs';
import * as path from 'path';
import { getConfig } from './config';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LOG_ORDER: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const COLORS: Record<LogLevel, string> = {
  error: '\x1b[31m',
  warn: '\x1b[33m',
  info: '\x1b[36m',
  debug: '\x1b[90m',
};

let logStream: fs.WriteStream | null = null;
let logBuffer: string[] = [];
const MAX_BUFFER = 5000;

function ensureLogFile(): void {
  if (logStream) return;
  try {
    const dataDir = getConfig().dataDir;
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const logPath = path.join(dataDir, 'node.log');
    logStream = fs.createWriteStream(logPath, { flags: 'a' });
  } catch {
    // fail silently, console logging still works
  }
}

function writeToFile(line: string): void {
  try {
    ensureLogFile();
    if (logStream) {
      logStream.write(line + '\n');
      logBuffer.push(line);
      if (logBuffer.length > MAX_BUFFER) logBuffer.shift();
    }
  } catch {
    // fail silently
  }
}

function shouldLog(level: LogLevel): boolean {
  const current = getConfig().logLevel;
  return LOG_ORDER[level] <= LOG_ORDER[current];
}

function fmt(level: LogLevel, source: string, msg: string, ...args: any[]): void {
  if (!shouldLog(level)) return;
  const ts = new Date().toISOString();
  const color = COLORS[level];
  const reset = '\x1b[0m';
  const extra = args.length > 0 ? ' ' + args.map(a => JSON.stringify(a)).join(' ') : '';
  const line = `${msg}${extra}`;
  console.log(`${color}[${ts}] [${level.toUpperCase()}] [${source}]${reset} ${line}`);
  writeToFile(`[${ts}] [${level.toUpperCase()}] [${source}] ${line}`);
}

export function getRecentLogs(count: number = 100): string[] {
  return logBuffer.slice(-count);
}

export function closeLogger(): void {
  if (logStream) {
    try { logStream.end(); } catch {}
    logStream = null;
  }
}

export const logger = {
  error: (msg: string, ...args: any[]) => fmt('error', 'NODE', msg, ...args),
  warn: (msg: string, ...args: any[]) => fmt('warn', 'NODE', msg, ...args),
  info: (msg: string, ...args: any[]) => fmt('info', 'NODE', msg, ...args),
  debug: (msg: string, ...args: any[]) => fmt('debug', 'NODE', msg, ...args),
  http: (msg: string, ...args: any[]) => fmt('info', 'HTTP', msg, ...args),
  p2p: (msg: string, ...args: any[]) => fmt('info', 'P2P', msg, ...args),
  support: (msg: string, ...args: any[]) => fmt('info', 'SUPPORT', msg, ...args),
  admin: (msg: string, ...args: any[]) => fmt('info', 'ADMIN', msg, ...args),
  wallet: (msg: string, ...args: any[]) => fmt('info', 'WALLET', msg, ...args),
  mining: (msg: string, ...args: any[]) => fmt('info', 'MINING', msg, ...args),
};
