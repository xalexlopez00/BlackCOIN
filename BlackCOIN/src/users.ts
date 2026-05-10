import * as CryptoJS from 'crypto-js';
import { UserInfo } from './types';
import { db } from './database';
import { logger } from './logger';
import { createTicket } from './support';

const SESSION_DURATION = 24 * 60 * 60 * 1000;
const ADMIN_CODE = 'BLACKADMIN2024';

function hashPassword(password: string): string {
  return CryptoJS.SHA256(password + 'blackcoin_salt').toString();
}

function generateToken(): string {
  return CryptoJS.SHA256(Date.now() + Math.random().toString()).toString();
}

export function registerUser(username: string, password: string, adminCode?: string, email?: string): UserInfo {
  if (!username || username.length < 3) throw new Error('Username must be at least 3 characters');
  if (!password || password.length < 4) throw new Error('Password must be at least 4 characters');
  if (!/^[a-zA-Z0-9_-]{3,32}$/.test(username)) throw new Error('Invalid username format');

  const users = db.loadUsers();
  if (users.find(u => u.username === username)) {
    throw new Error('Username already exists');
  }

  const isAdmin = users.length === 0 || adminCode === ADMIN_CODE;

  const user: UserInfo = {
    username,
    passwordHash: hashPassword(password),
    createdAt: Date.now(),
    isAdmin,
    email: email || '',
  };

  users.push(user);
  db.saveUsers(users);
  logger.info(`User registered: ${username}${isAdmin ? ' (admin)' : ''}${email ? ' email=' + email : ''}`);
  return user;
}

export function loginUser(username: string, password: string): string | null {
  const users = db.loadUsers();
  const user = users.find(u => u.username === username);
  if (!user) return null;
  if (user.passwordHash !== hashPassword(password)) return null;

  const token = generateToken();
  const expiresAt = Date.now() + SESSION_DURATION;
  db.saveSession(token, username, expiresAt);
  return token;
}

export function authenticate(token: string): UserInfo | null {
  const session = db.loadSession(token);
  if (!session) return null;
  const users = db.loadUsers();
  return users.find(u => u.username === session.username) || null;
}

export function logoutUser(token: string): void {
  db.deleteSession(token);
}

export function listUsers(): UserInfo[] {
  return db.loadUsers().map(u => ({
    username: u.username,
    createdAt: u.createdAt,
    isAdmin: u.isAdmin,
    email: u.email || '',
  } as UserInfo));
}

export function getUser(username: string): UserInfo | undefined {
  return db.loadUsers().find(u => u.username === username);
}

export function makeAdmin(username: string, requesterUsername: string): UserInfo {
  const users = db.loadUsers();
  const requester = users.find(u => u.username === requesterUsername);
  if (!requester || !requester.isAdmin) {
    throw new Error('Only admins can promote users');
  }

  const user = users.find(u => u.username === username);
  if (!user) throw new Error('User not found');
  if (user.isAdmin) throw new Error('User is already admin');

  user.isAdmin = true;
  db.saveUsers(users);
  logger.info(`User ${username} promoted to admin by ${requesterUsername}`);
  return { ...user };
}

export function removeAdmin(username: string, requesterUsername: string): UserInfo {
  const users = db.loadUsers();
  const requester = users.find(u => u.username === requesterUsername);
  if (!requester || !requester.isAdmin) {
    throw new Error('Only admins can demote users');
  }

  const user = users.find(u => u.username === username);
  if (!user) throw new Error('User not found');
  if (!user.isAdmin) throw new Error('User is not an admin');
  if (users.filter(u => u.isAdmin).length <= 1) {
    throw new Error('Cannot demote the last admin');
  }

  user.isAdmin = false;
  db.saveUsers(users);
  logger.info(`User ${username} demoted by ${requesterUsername}`);
  return { ...user };
}

export function resetUserPassword(username: string, newPassword: string, requesterUsername: string): void {
  const users = db.loadUsers();
  const requester = users.find(u => u.username === requesterUsername);
  if (!requester || !requester.isAdmin) {
    throw new Error('Only admins can reset passwords');
  }

  const user = users.find(u => u.username === username);
  if (!user) throw new Error('User not found');
  if (!newPassword || newPassword.length < 4) throw new Error('Password must be at least 4 characters');

  user.passwordHash = hashPassword(newPassword);
  db.saveUsers(users);
  logger.info(`Password reset for ${username} by ${requesterUsername}`);
}

export function changeOwnPassword(username: string, currentPassword: string, newPassword: string): void {
  const users = db.loadUsers();
  const user = users.find(u => u.username === username);
  if (!user) throw new Error('User not found');
  if (user.passwordHash !== hashPassword(currentPassword)) {
    throw new Error('Current password is incorrect');
  }
  if (!newPassword || newPassword.length < 4) throw new Error('Password must be at least 4 characters');

  user.passwordHash = hashPassword(newPassword);
  db.saveUsers(users);
  logger.info(`Password changed for ${username}`);
}

export function setUserEmail(username: string, email: string, requesterUsername: string): void {
  const users = db.loadUsers();
  const requester = users.find(u => u.username === requesterUsername);
  if (!requester || !requester.isAdmin) {
    throw new Error('Only admins can change user email');
  }
  const user = users.find(u => u.username === username);
  if (!user) throw new Error('User not found');
  user.email = email;
  db.saveUsers(users);
  logger.info(`Email updated for ${username} to ${email} by ${requesterUsername}`);
}

export function getFullUserInfo(username: string): { username: string; createdAt: number; isAdmin: boolean; email: string } | null {
  const user = db.loadUsers().find(u => u.username === username);
  if (!user) return null;
  return {
    username: user.username,
    createdAt: user.createdAt,
    isAdmin: user.isAdmin,
    email: user.email || '',
  };
}

export function requestPasswordReset(username: string): { ticketId: string; message: string } {
  const users = db.loadUsers();
  const user = users.find(u => u.username === username);
  if (!user) throw new Error('User not found');

  const ticket = createTicket(
    username,
    'Recuperacion de contrasena',
    'Solicito recuperar mi contrasena. Mi email registrado es: ' + (user.email || 'No tengo email registrado')
  );

  logger.info(`[RECOVER] Password reset ticket created for ${username}: ${ticket.id}`);
  return { ticketId: ticket.id, message: 'Se ha creado un ticket de recuperacion. Un admin te atenderá.' };
}

export function deleteUser(username: string, requesterUsername: string): void {
  const users = db.loadUsers();
  const requester = users.find(u => u.username === requesterUsername);
  if (!requester || !requester.isAdmin) {
    throw new Error('Only admins can delete users');
  }
  if (username === requesterUsername) {
    throw new Error('Cannot delete yourself');
  }

  const idx = users.findIndex(u => u.username === username);
  if (idx === -1) throw new Error('User not found');

  users.splice(idx, 1);
  db.saveUsers(users);
  logger.info(`User ${username} deleted by ${requesterUsername}`);
}
