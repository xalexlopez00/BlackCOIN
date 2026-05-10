import { loadConfig, getConfig } from './config';
import { logger } from './logger';
import { initBlockchain } from './blockchain';
import { initTransactionPool } from './transactionPool';
import { initP2PServer } from './p2p';
import { initHttpServer } from './api';
import { promptUser } from './cli';
import { connectToBootstrapPeers, connectToStoredPeers } from './p2p';
import { startDiscovery } from './discovery';

function main(): void {
  loadConfig();

  const config = getConfig();

  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║               BLACKCOIN NODE v1.0                     ║');
  console.log(`║   Network: ${config.network.padEnd(35)}║`);
  console.log(`║   HTTP: ${config.httpPort}`.padEnd(52) + '║');
  console.log(`║   P2P:  ${config.p2pPort}`.padEnd(52) + '║');
  console.log(`║   Data: ${config.dataDir}`.padEnd(50) + '║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');

  initBlockchain();
  initTransactionPool();
  initP2PServer(config.p2pPort);
  connectToStoredPeers();
  connectToBootstrapPeers();
  startDiscovery();
  initHttpServer(config.httpPort);
  promptUser();
}

main();
