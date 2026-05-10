import * as dgram from 'dgram';
import * as os from 'os';
import * as CryptoJS from 'crypto-js';
import { getConfig } from './config';
import { connectToPeer } from './p2p';
import { logger } from './logger';

const DISCOVERY_PORT = 60000;
const BROADCAST_INTERVAL = 30000;

const NODE_ID = CryptoJS.SHA256(Math.random() + Date.now().toString()).toString().substring(0, 16);

let socket: dgram.Socket | null = null;
let intervalId: NodeJS.Timeout | null = null;

function getLocalIPs(): Set<string> {
  const ips = new Set<string>();
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const ifaces = interfaces[name];
    if (!ifaces) continue;
    for (const iface of ifaces) {
      if (iface.family === 'IPv4') {
        ips.add(iface.address);
      }
    }
  }
  return ips;
}

function getBroadcastAddresses(): string[] {
  const addrs: string[] = [];
  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    const ifaces = interfaces[name];
    if (!ifaces) continue;

    for (const iface of ifaces) {
      if (iface.family !== 'IPv4' || iface.internal) continue;

      const parts = iface.address.split('.');
      if (parts.length === 4) {
        addrs.push(`${parts[0]}.${parts[1]}.${parts[2]}.255`);

        if (iface.netmask) {
          const maskParts = iface.netmask.split('.');
          const broadcast = parts.map((p, i) =>
            (parseInt(p) | (~parseInt(maskParts[i]) & 0xFF)).toString()
          ).join('.');
          if (broadcast !== addrs[addrs.length - 1]) {
            addrs.push(broadcast);
          }
        }
      }
    }
  }

  return [...new Set(addrs)];
}

export function startDiscovery(): void {
  const p2pPort = getConfig().p2pPort;

  try {
    socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    socket.on('message', (msg, rinfo) => {
      const message = msg.toString().trim();
      const parts = message.split('|');
      if (parts[0] !== 'BLACKCOIN_DISCOVER') return;
      const senderId = parts[1];
      if (senderId === NODE_ID) return;

      const localIPs = getLocalIPs();
      if (localIPs.has(rinfo.address)) return;

      const peerAddr = `ws://${rinfo.address}:${p2pPort}`;
      connectToPeer(peerAddr);
    });

    socket.on('error', (err) => {
      logger.debug(`Discovery socket error: ${err.message}`);
    });

    socket.bind(DISCOVERY_PORT, () => {
      socket?.setBroadcast(true);
      logger.info(`LAN discovery listening on port ${DISCOVERY_PORT}`);

      const broadcast = () => {
        const addrs = getBroadcastAddresses();
        const msg = Buffer.from(`BLACKCOIN_DISCOVER|${NODE_ID}`);

        for (const addr of addrs) {
          try {
            socket?.send(msg, 0, msg.length, DISCOVERY_PORT, addr);
          } catch {}
        }
      };

      broadcast();
      intervalId = setInterval(broadcast, BROADCAST_INTERVAL);
    });
  } catch (e: any) {
    logger.debug(`Discovery init failed: ${e.message}`);
  }
}

export function stopDiscovery(): void {
  if (intervalId) clearInterval(intervalId);
  if (socket) {
    try { socket.close(); } catch {}
    socket = null;
  }
}
