import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Request, Response, NextFunction } from 'express';

export interface AdminSession {
  token: string;
  username: string;
  createdAt: number;
  expiresAt: number;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'admin_sessions.json');
const CREDENTIALS_FILE = path.join(DATA_DIR, 'admin_credentials.json');

// In-memory active session tokens cache
const activeSessions = new Map<string, AdminSession>();

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Load sessions from disk on startup
function loadSessionsFromDisk(): void {
  try {
    ensureDataDir();
    if (fs.existsSync(SESSIONS_FILE)) {
      const content = fs.readFileSync(SESSIONS_FILE, 'utf-8');
      const sessionsArray: AdminSession[] = JSON.parse(content);
      const now = Date.now();
      activeSessions.clear();
      sessionsArray.forEach((s) => {
        if (s.expiresAt > now) {
          activeSessions.set(s.token, s);
        }
      });
    }
  } catch (err) {
    console.error('Failed to load admin sessions from disk:', err);
  }
}

// Save sessions to disk
function saveSessionsToDisk(): void {
  try {
    ensureDataDir();
    const now = Date.now();
    const validSessions = Array.from(activeSessions.values()).filter((s) => s.expiresAt > now);
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(validSessions, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save admin sessions to disk:', err);
  }
}

// Initial load
loadSessionsFromDisk();

// Admin credentials management
interface AdminCredentials {
  username: string;
  salt: string;
  passwordHash: string;
}

function loadCredentials(): AdminCredentials {
  try {
    ensureDataDir();
    if (fs.existsSync(CREDENTIALS_FILE)) {
      const data = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf-8'));
      if (data.username && data.salt && data.passwordHash) {
        return data;
      }
    }
  } catch (err) {
    console.error('Failed to load admin credentials from disk:', err);
  }

  // Default credentials: admin / AdminElection2026!
  const defaultSalt = 'e5a8f4c29d1073b648fae92c710db84e';
  const defaultHash = hashPassword('AdminElection2026!', defaultSalt);
  const creds: AdminCredentials = {
    username: 'admin',
    salt: defaultSalt,
    passwordHash: defaultHash,
  };
  saveCredentials(creds);
  return creds;
}

function saveCredentials(creds: AdminCredentials): void {
  try {
    ensureDataDir();
    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save admin credentials to disk:', err);
  }
}

let cachedCredentials = loadCredentials();

export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

export function verifyAdminCredentials(user: string, pass: string): boolean {
  if (!user || !pass) return false;
  if (user.trim() !== cachedCredentials.username) {
    return false;
  }
  const testHash = hashPassword(pass, cachedCredentials.salt);
  return crypto.timingSafeEqual(Buffer.from(testHash), Buffer.from(cachedCredentials.passwordHash));
}

export function createAdminSession(username: string): { token: string; expiresAt: number } {
  const token = 'adm_' + crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const expiresAt = now + 12 * 60 * 60 * 1000; // 12 hours

  const session: AdminSession = {
    token,
    username,
    createdAt: now,
    expiresAt,
  };

  activeSessions.set(token, session);
  saveSessionsToDisk();

  return { token, expiresAt };
}

export function validateAdminSession(token: string | undefined): AdminSession | null {
  if (!token) return null;
  const cleanToken = token.trim();
  
  let session = activeSessions.get(cleanToken);
  if (!session) {
    // Re-check disk in case session was written by another turn or process
    loadSessionsFromDisk();
    session = activeSessions.get(cleanToken);
  }

  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    activeSessions.delete(cleanToken);
    saveSessionsToDisk();
    return null;
  }

  return session;
}

export function invalidateAdminSession(token: string): void {
  activeSessions.delete(token.trim());
  saveSessionsToDisk();
}

export function changeAdminPassword(oldPass: string, newPass: string): boolean {
  if (!verifyAdminCredentials(cachedCredentials.username, oldPass)) {
    return false;
  }
  const newSalt = crypto.randomBytes(16).toString('hex');
  const newHash = hashPassword(newPass, newSalt);
  cachedCredentials = {
    username: cachedCredentials.username,
    salt: newSalt,
    passwordHash: newHash,
  };
  saveCredentials(cachedCredentials);
  return true;
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized. Admin credentials or session token required.',
    });
    return;
  }

  const token = authHeader.substring(7).trim();
  const session = validateAdminSession(token);

  if (!session) {
    res.status(401).json({
      success: false,
      error: 'Session expired or invalid. Please sign in again.',
    });
    return;
  }

  (req as any).adminSession = session;
  next();
}
