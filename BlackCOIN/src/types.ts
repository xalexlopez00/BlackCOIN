export class TxIn {
  txOutId: string = '';
  txOutIndex: number = 0;
  signature: string = '';
  publicKey: string = '';
}

export class TxOut {
  constructor(
    public address: string,
    public amount: number
  ) {}
}

export class Transaction {
  id: string = '';
  txIns: TxIn[] = [];
  txOuts: TxOut[] = [];
  timestamp: number = 0;
  message: string = '';
}

export class UnspentTxOut {
  constructor(
    public readonly txOutId: string,
    public readonly txOutIndex: number,
    public readonly address: string,
    public readonly amount: number
  ) {}
}

export class Block {
  constructor(
    public index: number,
    public hash: string,
    public previousHash: string,
    public timestamp: number,
    public data: Transaction[],
    public difficulty: number,
    public nonce: number
  ) {}
}

export interface WalletInfo {
  id: string;
  name: string;
  address: string;
  publicKey: string;
  encryptedPrivateKey: string;
  createdAt: number;
}

export interface WalletData {
  privateKey: string;
  publicKey: string;
  address: string;
}

export class NameEntry {
  constructor(
    public readonly name: string,
    public readonly address: string,
    public readonly owner: string,
    public readonly createdAt: number
  ) {}
}

export interface UserInfo {
  username: string;
  passwordHash: string;
  createdAt: number;
  isAdmin: boolean;
  email?: string;
}

export type ReplyType = 'user' | 'admin' | 'system';

export interface TicketReply {
  by: string;
  message: string;
  createdAt: number;
  type: ReplyType;
}

export interface SupportTicket {
  id: string;
  username: string;
  subject: string;
  message: string;
  status: 'open' | 'closed';
  createdAt: number;
  updatedAt: number;
  txId?: string;
  replies: TicketReply[];
}

export interface LogEntry {
  id: string;
  timestamp: number;
  level: string;
  source: string;
  message: string;
  data?: any;
}

export enum MessageType {
  QUERY_LATEST = 0,
  QUERY_ALL = 1,
  RESPONSE_BLOCKCHAIN = 2,
  QUERY_TRANSACTION_POOL = 3,
  RESPONSE_TRANSACTION_POOL = 4,
  QUERY_PEERS = 5,
  RESPONSE_PEERS = 6,
}

export class Message {
  constructor(
    public type: MessageType,
    public data: any
  ) {}
}
