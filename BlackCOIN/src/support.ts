import * as CryptoJS from 'crypto-js';
import { SupportTicket, TicketReply } from './types';
import { db } from './database';
import { logger } from './logger';

function generateTicketId(): string {
  return 'tkt_' + CryptoJS.SHA256(Date.now() + Math.random().toString()).toString().substring(0, 16);
}

export function createTicket(username: string, subject: string, message: string, txId?: string): SupportTicket {
  if (!subject || subject.trim().length === 0) throw new Error('Subject is required');
  if (!message || message.trim().length === 0) throw new Error('Message is required');

  const tickets = db.loadTickets();
  const id = generateTicketId();
  const now = Date.now();

  const ticket: SupportTicket = {
    id,
    username,
    subject: subject.trim(),
    message: message.trim(),
    status: 'open',
    createdAt: now,
    updatedAt: now,
    txId,
    replies: [],
  };

  tickets.push(ticket);
  db.saveTickets(tickets);
  logger.info(`[SUPPORT] Ticket created: ${id} by ${username} - \"${subject}\"`);
  return { ...ticket };
}

export function userReplyToTicket(ticketId: string, username: string, message: string): SupportTicket | null {
  if (!message || message.trim().length === 0) throw new Error('Message is required');

  const tickets = db.loadTickets();
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) return null;
  if (ticket.username !== username) return null;
  if (ticket.status === 'closed') throw new Error('Ticket is closed. Reopen it first.');

  addReply(ticket, username, message.trim(), 'user');
  ticket.updatedAt = Date.now();
  db.saveTickets(tickets);
  logger.info(`[SUPPORT] Ticket ${ticketId}: ${username} replied`);
  return { ...ticket };
}

export function replyToTicket(
  ticketId: string,
  adminUsername: string,
  reply: string,
  closeAfterReply: boolean = true
): SupportTicket | null {
  if (!reply || reply.trim().length === 0) throw new Error('Reply message is required');

  const tickets = db.loadTickets();
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) return null;

  addReply(ticket, adminUsername, reply.trim(), 'admin');
  ticket.updatedAt = Date.now();
  ticket.status = closeAfterReply ? 'closed' : ticket.status;

  db.saveTickets(tickets);
  logger.info(`[SUPPORT] Ticket ${ticketId} replied by ${adminUsername}${closeAfterReply ? ' and closed' : ''}`);
  return { ...ticket };
}

export function addSystemNote(ticketId: string, message: string): SupportTicket | null {
  const tickets = db.loadTickets();
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) return null;

  addReply(ticket, 'system', message, 'system');
  ticket.updatedAt = Date.now();
  db.saveTickets(tickets);
  return { ...ticket };
}

function addReply(ticket: SupportTicket, by: string, message: string, type: 'user' | 'admin' | 'system'): void {
  ticket.replies.push({ by, message, createdAt: Date.now(), type });
}

export function closeTicket(ticketId: string, adminUsername: string): SupportTicket | null {
  const tickets = db.loadTickets();
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) return null;
  if (ticket.status === 'closed') throw new Error('Ticket is already closed');

  ticket.status = 'closed';
  ticket.updatedAt = Date.now();
  addReply(ticket, adminUsername, 'Ticket closed by admin', 'system');
  db.saveTickets(tickets);
  logger.info(`[SUPPORT] Ticket ${ticketId} closed by ${adminUsername}`);
  return { ...ticket };
}

export function reopenTicket(ticketId: string, username: string): SupportTicket | null {
  const tickets = db.loadTickets();
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) return null;
  if (ticket.status === 'open') throw new Error('Ticket is already open');

  const users = db.loadUsers();
  const user = users.find(u => u.username === username);
  const isOwner = ticket.username === username;
  const isAdmin = user?.isAdmin === true;

  if (!isOwner && !isAdmin) return null;

  ticket.status = 'open';
  ticket.updatedAt = Date.now();
  addReply(ticket, username, 'Ticket reopened', 'system');
  db.saveTickets(tickets);
  logger.info(`[SUPPORT] Ticket ${ticketId} reopened by ${username}`);
  return { ...ticket };
}

export function getTickets(username?: string): SupportTicket[] {
  const tickets = db.loadTickets();
  if (username) {
    return tickets.filter(t => t.username === username);
  }
  return tickets;
}

export function getTicketsByStatus(status: 'open' | 'closed'): SupportTicket[] {
  return db.loadTickets().filter(t => t.status === status);
}

export function getTicket(id: string): SupportTicket | undefined {
  return db.loadTickets().find(t => t.id === id);
}

export function deleteTicket(ticketId: string, adminUsername: string): boolean {
  const tickets = db.loadTickets();
  const idx = tickets.findIndex(t => t.id === ticketId);
  if (idx === -1) return false;

  tickets.splice(idx, 1);
  db.saveTickets(tickets);
  logger.info(`[SUPPORT] Ticket ${ticketId} deleted by ${adminUsername}`);
  return true;
}

export function getTicketStats(): { total: number; open: number; closed: number; byUser: Record<string, number> } {
  const tickets = db.loadTickets();
  const byUser: Record<string, number> = {};
  for (const t of tickets) {
    byUser[t.username] = (byUser[t.username] || 0) + 1;
  }
  return {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    closed: tickets.filter(t => t.status === 'closed').length,
    byUser,
  };
}

export function addSystemNoteToAllOpenTickets(note: string): number {
  const tickets = db.loadTickets();
  let count = 0;
  for (const ticket of tickets) {
    if (ticket.status === 'open') {
      addReply(ticket, 'system', note, 'system');
      ticket.updatedAt = Date.now();
      count++;
    }
  }
  db.saveTickets(tickets);
  return count;
}
