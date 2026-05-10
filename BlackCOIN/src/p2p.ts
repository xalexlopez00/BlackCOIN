import WebSocket, { Server as WebSocketServer } from 'ws';
import * as os from 'os';
import {
  addBlockToChain,
  getBlockchain,
  getLatestBlock,
  handleReceivedTransaction,
  replaceChain,
} from './blockchain';
import { Block, Transaction, MessageType, Message } from './types';
import { getTransactionPool } from './transactionPool';
import { getConfig } from './config';
import { logger } from './logger';
import { on as eventOn } from './events';
import { upsertPeer, removePeer, loadPeers, cleanupDeadPeers } from './database';

const sockets: Map<string, WebSocket> = new Map();
const ipConnections: Map<string, number> = new Map();
const MAX_CONNECTIONS_PER_IP = 5;
let server: WebSocketServer | null = null;

function getLocalIPs(): Set<string> {
  const ips = new Set<string>(['127.0.0.1', '::1', 'localhost']);
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const ifaces = interfaces[name];
    if (!ifaces) continue;
    for (const iface of ifaces) {
      ips.add(iface.address);
    }
  }
  return ips;
}

function isSelfConnection(address: string): boolean {
  const localIPs = getLocalIPs();
  const cleanAddr = address.replace('ws://', '').split(':')[0];
  if (localIPs.has(cleanAddr)) {
    const port = address.includes(']:') ? parseInt(address.split(']:')[1]?.split(':')[0]) : parseInt(address.split(':')[2]);
    if (port === getConfig().p2pPort) return true;
  }
  return false;
}

export function initP2PServer(p2pPort: number): void {
  server = new WebSocketServer({ port: p2pPort });
  server.on('connection', (ws: WebSocket, req) => {
    const remoteAddr = req.socket.remoteAddress || 'unknown';

    if (isSelfConnection(`ws://${remoteAddr}:${p2pPort}`)) {
      logger.debug(`Rejected self-connection from ${remoteAddr}`);
      ws.close(1013, 'Self-connection');
      return;
    }

    const peerId = `${remoteAddr}:${req.socket.remotePort}`;

    const ipCount = ipConnections.get(remoteAddr) || 0;
    if (ipCount >= MAX_CONNECTIONS_PER_IP) {
      logger.warn(`Rejected connection from ${remoteAddr}: too many connections`);
      ws.close(1013, 'Too many connections from this IP');
      return;
    }

    initConnection(ws, peerId);

    ipConnections.set(remoteAddr, (ipConnections.get(remoteAddr) || 0) + 1);
  });
  logger.info(`P2P server listening on port ${p2pPort}`);

  eventOn('block:added', () => broadcastLatest());
  eventOn('chain:replaced', () => broadcastLatest());
  eventOn('txpool:changed', () => broadcastTransactionPool());
}

export function getSockets(): WebSocket[] {
  return Array.from(sockets.values());
}

export function getPeers(): string[] {
  return Array.from(sockets.keys());
}

function initConnection(ws: WebSocket, peerId: string): void {
  sockets.set(peerId, ws);
  initMessageHandler(ws);
  initErrorHandler(ws, peerId);
  ws.send(JSON.stringify(new Message(MessageType.QUERY_LATEST, null)));

  upsertPeer(peerId, 0);

  setTimeout(() => {
    broadcast(JSON.stringify(new Message(MessageType.QUERY_TRANSACTION_POOL, null)));
  }, 500);

  logger.info(`Peer connected: ${peerId}`);
}

function JSONToObject<T>(data: string): T | null {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function initMessageHandler(ws: WebSocket): void {
  ws.on('message', (data: string) => {
    try {
      const message: Message = JSONToObject<Message>(data);
      if (!message) return;

      switch (message.type) {
        case MessageType.QUERY_LATEST:
          ws.send(JSON.stringify(new Message(MessageType.RESPONSE_BLOCKCHAIN, JSON.stringify([getLatestBlock()]))));
          break;

        case MessageType.QUERY_ALL:
          ws.send(JSON.stringify(new Message(MessageType.RESPONSE_BLOCKCHAIN, JSON.stringify(getBlockchain()))));
          break;

        case MessageType.RESPONSE_BLOCKCHAIN: {
          const receivedBlocks: Block[] = JSONToObject<Block[]>(message.data);
          if (!receivedBlocks || receivedBlocks.length === 0) break;
          handleBlockchainResponse(receivedBlocks);
          break;
        }

        case MessageType.QUERY_TRANSACTION_POOL:
          ws.send(JSON.stringify(new Message(MessageType.RESPONSE_TRANSACTION_POOL, JSON.stringify(getTransactionPool()))));
          break;

        case MessageType.RESPONSE_TRANSACTION_POOL: {
          const receivedTxs: Transaction[] = JSONToObject<Transaction[]>(message.data);
          if (!receivedTxs) break;
          receivedTxs.forEach(tx => {
            try {
              handleReceivedTransaction(tx);
            } catch (e: any) {
              logger.debug(`Transaction rejected: ${e.message}`);
            }
          });
          break;
        }

        case MessageType.QUERY_PEERS:
          ws.send(JSON.stringify(new Message(MessageType.RESPONSE_PEERS, JSON.stringify(getPeers()))));
          break;

        case MessageType.RESPONSE_PEERS: {
          const peers: string[] = JSONToObject<string[]>(message.data);
          if (peers) {
            peers.forEach(peer => connectToPeer(peer));
          }
          break;
        }
      }
    } catch (e: any) {
      logger.error(`Message handler error: ${e.message}`);
    }
  });
}

function initErrorHandler(ws: WebSocket, peerId: string): void {
  const close = () => {
    sockets.delete(peerId);
    const ip = peerId.split(':')[0];
    const current = ipConnections.get(ip) || 1;
    if (current <= 1) {
      ipConnections.delete(ip);
    } else {
      ipConnections.set(ip, current - 1);
    }
    const peer = loadPeers().find(p => p.address === peerId);
    if (peer) {
      upsertPeer(peerId, peer.failCount + 1);
    }
    logger.info(`Peer disconnected: ${peerId}`);
  };
  ws.on('close', close);
  ws.on('error', close);
}

function handleBlockchainResponse(receivedBlocks: Block[]): void {
  const latestReceived = receivedBlocks[receivedBlocks.length - 1];
  const latestHeld = getLatestBlock();

  if (latestReceived.index > latestHeld.index) {
    logger.info(`Blockchain behind: local #${latestHeld.index}, peer #${latestReceived.index}`);

    if (latestHeld.hash === latestReceived.previousHash) {
      if (addBlockToChain(latestReceived)) {
        broadcast(JSON.stringify(new Message(MessageType.RESPONSE_BLOCKCHAIN, JSON.stringify([latestReceived]))));
      }
    } else if (receivedBlocks.length === 1) {
      broadcast(JSON.stringify(new Message(MessageType.QUERY_ALL, null)));
    } else {
      replaceChain(receivedBlocks);
    }
  }
}

function broadcast(message: string): void {
  sockets.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

export function broadcastLatest(): void {
  broadcast(JSON.stringify(new Message(MessageType.RESPONSE_BLOCKCHAIN, JSON.stringify([getLatestBlock()]))));
}

export function broadcastTransactionPool(): void {
  broadcast(JSON.stringify(new Message(MessageType.RESPONSE_TRANSACTION_POOL, JSON.stringify(getTransactionPool()))));
}

export function connectToPeer(peerAddress: string): void {
  if (!peerAddress.startsWith('ws://')) return;

  if (sockets.has(peerAddress)) return;
  if (isSelfConnection(peerAddress)) return;

  if (sockets.size >= getConfig().maxPeers) {
    logger.warn(`Max peers (${getConfig().maxPeers}) reached, cannot connect to ${peerAddress}`);
    return;
  }

  try {
    const ws = new WebSocket(peerAddress);
    ws.on('open', () => {
      initConnection(ws, peerAddress);
    });
    ws.on('error', () => {
      logger.debug(`Failed to connect to peer: ${peerAddress}`);
      const peer = loadPeers().find(p => p.address === peerAddress);
      upsertPeer(peerAddress, peer ? peer.failCount + 1 : 1);
    });
  } catch (e: any) {
    logger.debug(`Connection error to ${peerAddress}: ${e.message}`);
  }
}

export function connectToPeers(peers: string[]): void {
  peers.forEach(peer => {
    const cleanPeer = peer.startsWith('ws://') ? peer : `ws://${peer}`;
    connectToPeer(cleanPeer);
  });
}

export function connectToBootstrapPeers(): void {
  const config = getConfig();
  if (config.bootstrapPeers.length > 0) {
    logger.info(`Connecting to ${config.bootstrapPeers.length} bootstrap peers...`);
    connectToPeers(config.bootstrapPeers);
  }
}

export function connectToStoredPeers(): void {
  cleanupDeadPeers(10);
  const stored = loadPeers();
  const active = stored.filter(p => p.failCount < 5).slice(0, 10);
  if (active.length > 0) {
    logger.info(`Connecting to ${active.length} stored peers...`);
    connectToPeers(active.map(p => p.address));
  }
}
