import * as fs from 'fs';
import * as path from 'path';

export interface BlackcoinConfig {
  network: 'mainnet' | 'testnet';
  httpPort: number;
  p2pPort: number;
  blockGenerationInterval: number;
  difficultyAdjustmentInterval: number;
  coinbaseAmount: number;
  halvingInterval: number;
  minDifficulty: number;
  miningThreads: number;
  dataDir: string;
  bootstrapPeers: string[];
  maxPeers: number;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

const DEFAULT_CONFIG: BlackcoinConfig = {
  network: 'mainnet',
  httpPort: 3001,
  p2pPort: 6001,
  blockGenerationInterval: 60,
  difficultyAdjustmentInterval: 10,
  coinbaseAmount: 50,
  halvingInterval: 210000,
  minDifficulty: 2,
  miningThreads: 1,
  dataDir: path.join(process.cwd(), 'data'),
  bootstrapPeers: [],
  maxPeers: 20,
  logLevel: 'info',
};

let config: BlackcoinConfig = { ...DEFAULT_CONFIG };

function parseIntSafe(val: string | undefined, fallback: number): number {
  if (val === undefined) return fallback;
  const n = parseInt(val, 10);
  return isNaN(n) ? fallback : n;
}

export function loadConfig(): void {
  const configPath = process.env.CONFIG_PATH || path.join(process.cwd(), 'config.json');

  if (fs.existsSync(configPath)) {
    try {
      const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      config = { ...config, ...fileConfig };
    } catch (e: any) {
      console.error('Failed to load config file:', e.message);
    }
  }

  config.httpPort = parseIntSafe(process.env.HTTP_PORT, config.httpPort);
  config.p2pPort = parseIntSafe(process.env.P2P_PORT, config.p2pPort);
  config.dataDir = process.env.DATA_DIR || config.dataDir;
  config.coinbaseAmount = parseIntSafe(process.env.COINBASE_AMOUNT, config.coinbaseAmount);

  if (process.env.LOG_LEVEL) {
    const valid = ['error', 'warn', 'info', 'debug'] as const;
    if (valid.includes(process.env.LOG_LEVEL as any)) {
      config.logLevel = process.env.LOG_LEVEL as any;
    }
  }
  if (process.env.NETWORK) {
    const valid = ['mainnet', 'testnet'] as const;
    if (valid.includes(process.env.NETWORK as any)) {
      config.network = process.env.NETWORK as any;
    }
  }
  if (process.env.BOOTSTRAP_PEERS) {
    config.bootstrapPeers = process.env.BOOTSTRAP_PEERS.split(',').map(s => s.trim());
  }

  if (!fs.existsSync(config.dataDir)) {
    fs.mkdirSync(config.dataDir, { recursive: true });
  }
}

export function getConfig(): BlackcoinConfig {
  return { ...config };
}

export function setConfig(partial: Partial<BlackcoinConfig>): void {
  config = { ...config, ...partial };
}
