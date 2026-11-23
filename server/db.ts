import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import {
  User,
  Temka,
  Transaction,
  WithdrawalRequest,
  PastWithdrawal,
  Comment,
  SandboxLog,
  Transfer,
  Invoice,
  DatabaseSchema,
} from './types.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'app.sqlite');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function cleanCorruptedFiles() {
  try {
    if (fs.existsSync(DB_FILE)) fs.unlinkSync(DB_FILE);
    if (fs.existsSync(`${DB_FILE}-wal`)) fs.unlinkSync(`${DB_FILE}-wal`);
    if (fs.existsSync(`${DB_FILE}-shm`)) fs.unlinkSync(`${DB_FILE}-shm`);
  } catch (err) {
    console.error('Error cleaning sqlite files:', err);
  }
}

function createDatabaseConnection(): DatabaseSync {
  ensureDataDir();
  try {
    const dbInstance = new DatabaseSync(DB_FILE);
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    dbInstance.exec('PRAGMA user_version;');
    return dbInstance;
  } catch (err) {
    console.warn('⚠️ SQLite database file was malformed or could not be opened. Resetting clean DB:', err);
    cleanCorruptedFiles();
    const dbInstance = new DatabaseSync(DB_FILE);
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    return dbInstance;
  }
}

export let sqlite = createDatabaseConnection();

// Initialize database tables and indexes
export function initSqliteSchema() {
  try {
    executeSchemaCreation();
  } catch (err) {
    console.error('Schema creation failed, recreating fresh database:', err);
    cleanCorruptedFiles();
    sqlite = createDatabaseConnection();
    executeSchemaCreation();
  }
}

function executeSchemaCreation() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      balance INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      avatarUrl TEXT,
      bio TEXT,
      isBanned INTEGER NOT NULL DEFAULT 0,
      banReason TEXT
    );

    CREATE TABLE IF NOT EXISTS temkas (
      id TEXT PRIMARY KEY,
      ownerId TEXT NOT NULL,
      ownerUsername TEXT NOT NULL,
      ownerAvatarUrl TEXT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      algorithmCode TEXT NOT NULL,
      collateral INTEGER NOT NULL,
      initialCapital INTEGER NOT NULL,
      capital INTEGER NOT NULL,
      minBet INTEGER NOT NULL,
      maxBet INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      totalIn INTEGER NOT NULL DEFAULT 0,
      totalOut INTEGER NOT NULL DEFAULT 0,
      dealsCount INTEGER NOT NULL DEFAULT 0,
      maxMultiplier REAL NOT NULL DEFAULT 0,
      minMultiplier REAL NOT NULL DEFAULT 0,
      hasStateFile INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      temkaId TEXT NOT NULL,
      userId TEXT NOT NULL,
      userHash TEXT NOT NULL,
      amount INTEGER NOT NULL,
      payout INTEGER NOT NULL,
      multiplier REAL NOT NULL,
      isDefault INTEGER NOT NULL DEFAULT 0,
      isRefund INTEGER NOT NULL DEFAULT 0,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS withdrawal_requests (
      id TEXT PRIMARY KEY,
      temkaId TEXT NOT NULL,
      ownerId TEXT NOT NULL,
      amount INTEGER NOT NULL,
      claimCollateralAndClose INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'PENDING',
      createdAt TEXT NOT NULL,
      executedAt TEXT,
      depositsSinceRequest INTEGER NOT NULL DEFAULT 0,
      uniqueDepositorsJson TEXT NOT NULL DEFAULT '[]',
      deadlineAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS past_withdrawals (
      id TEXT PRIMARY KEY,
      temkaId TEXT NOT NULL,
      amount INTEGER NOT NULL,
      claimedCollateral INTEGER NOT NULL DEFAULT 0,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      temkaId TEXT NOT NULL,
      userId TEXT NOT NULL,
      username TEXT NOT NULL,
      userAvatarUrl TEXT,
      text TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      likesJson TEXT NOT NULL DEFAULT '[]',
      userStatsJson TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sandbox_logs (
      id TEXT PRIMARY KEY,
      temkaId TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      durationMs INTEGER NOT NULL,
      depositAmount INTEGER NOT NULL,
      userHash TEXT NOT NULL,
      payout INTEGER NOT NULL,
      stdout TEXT NOT NULL,
      stderr TEXT NOT NULL,
      error TEXT,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transfers (
      id TEXT PRIMARY KEY,
      senderId TEXT NOT NULL,
      senderUsername TEXT NOT NULL,
      recipientId TEXT NOT NULL,
      recipientUsername TEXT NOT NULL,
      amount INTEGER NOT NULL,
      comment TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS temka_topups (
      id TEXT PRIMARY KEY,
      temkaId TEXT NOT NULL,
      ownerId TEXT NOT NULL,
      amount INTEGER NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      username TEXT NOT NULL,
      amount REAL NOT NULL,
      uniqueAmount REAL,
      amountWithCommission REAL,
      bank TEXT NOT NULL,
      paymentUrl TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      createdAt TEXT NOT NULL,
      expiresAt TEXT,
      secondsLeft REAL,
      credited INTEGER NOT NULL DEFAULT 0
    );

    -- Optimized query indexes
    CREATE INDEX IF NOT EXISTS idx_transactions_temkaId ON transactions(temkaId, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_transactions_userId ON transactions(userId, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_temkas_ownerId ON temkas(ownerId);
    CREATE INDEX IF NOT EXISTS idx_temkas_status ON temkas(status);
    CREATE INDEX IF NOT EXISTS idx_withdrawal_temkaId ON withdrawal_requests(temkaId, status);
    CREATE INDEX IF NOT EXISTS idx_comments_temkaId ON comments(temkaId, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_sandbox_logs_temkaId ON sandbox_logs(temkaId, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_transfers_senderId ON transfers(senderId, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_transfers_recipientId ON transfers(recipientId, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_temka_topups_ownerId ON temka_topups(ownerId, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_invoices_userId ON invoices(userId, createdAt DESC);
  `);
}

// Ensure schema is prepared
initSqliteSchema();

// ----------------------------------------------------
// DB Helper Repository Methods (SQLite-backed)
// ----------------------------------------------------

export function hashUserId(userId: string): string {
  return 'usr_' + crypto.createHash('sha256').update(userId).digest('hex').substring(0, 10);
}

export function roundToHighestOrder(val: number): number {
  if (val <= 0) return 0;
  if (val < 10) return Math.round(val);
  const order = Math.pow(10, Math.floor(Math.log10(val)));
  return Math.round(val / order) * order;
}

// In-memory facade interface for backward compatibility if needed, backed directly by SQLite
export const db = {
  // Users
  getUserById(id: string): User | null {
    const row = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    return row ? formatUser(row) : null;
  },
  getUserByUsername(username: string): User | null {
    const row = sqlite.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(username.trim()) as any;
    return row ? formatUser(row) : null;
  },
  getAllUsers(): User[] {
    const rows = sqlite.prepare('SELECT * FROM users ORDER BY createdAt ASC').all() as any[];
    return rows.map(formatUser);
  },
  insertUser(user: User): void {
    sqlite.prepare(`
      INSERT INTO users (id, username, passwordHash, balance, createdAt, avatarUrl, bio, isBanned, banReason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.id,
      user.username,
      user.passwordHash,
      user.balance,
      user.createdAt,
      user.avatarUrl || null,
      user.bio || null,
      user.isBanned ? 1 : 0,
      user.banReason || null
    );
  },
  updateUser(user: Partial<User> & { id: string }): void {
    const existing = db.getUserById(user.id);
    if (!existing) return;
    const updated = { ...existing, ...user };
    sqlite.prepare(`
      UPDATE users
      SET username = ?, passwordHash = ?, balance = ?, avatarUrl = ?, bio = ?, isBanned = ?, banReason = ?
      WHERE id = ?
    `).run(
      updated.username,
      updated.passwordHash,
      updated.balance,
      updated.avatarUrl || null,
      updated.bio || null,
      updated.isBanned ? 1 : 0,
      updated.banReason || null,
      user.id
    );
  },
  banUser(usernameOrId: string, reason: string = 'Нарушение правил платформы'): { success: boolean; user?: User; error?: string } {
    const user = db.getUserByUsername(usernameOrId) || db.getUserById(usernameOrId);
    if (!user) {
      return { success: false, error: `Пользователь "${usernameOrId}" не найден` };
    }
    user.isBanned = true;
    user.banReason = reason;
    db.updateUser(user);
    return { success: true, user };
  },
  unbanUser(usernameOrId: string): { success: boolean; user?: User; error?: string } {
    const user = db.getUserByUsername(usernameOrId) || db.getUserById(usernameOrId);
    if (!user) {
      return { success: false, error: `Пользователь "${usernameOrId}" не найден` };
    }
    user.isBanned = false;
    user.banReason = undefined;
    db.updateUser(user);
    return { success: true, user };
  },
  giveMoney(usernameOrId: string, amount: number): { success: boolean; user?: User; previousBalance?: number; error?: string } {
    const user = db.getUserByUsername(usernameOrId) || db.getUserById(usernameOrId);
    if (!user) {
      return { success: false, error: `Пользователь "${usernameOrId}" не найден` };
    }
    const previousBalance = user.balance;
    user.balance += Math.floor(amount);
    db.updateUser(user);
    return { success: true, user, previousBalance };
  },
  setBalance(usernameOrId: string, exactAmount: number): { success: boolean; user?: User; previousBalance?: number; error?: string } {
    const user = db.getUserByUsername(usernameOrId) || db.getUserById(usernameOrId);
    if (!user) {
      return { success: false, error: `Пользователь "${usernameOrId}" не найден` };
    }
    const previousBalance = user.balance;
    user.balance = Math.floor(exactAmount);
    db.updateUser(user);
    return { success: true, user, previousBalance };
  },
  clearDatabase(): void {
    sqlite.exec(`
      DELETE FROM users;
      DELETE FROM temkas;
      DELETE FROM transactions;
      DELETE FROM withdrawal_requests;
      DELETE FROM past_withdrawals;
      DELETE FROM comments;
      DELETE FROM sandbox_logs;
      DELETE FROM transfers;
      DELETE FROM temka_topups;
      DELETE FROM invoices;
      VACUUM;
    `);
    // Clean up temka state directory
    const statesDir = path.join(DATA_DIR, 'temka_states');
    if (fs.existsSync(statesDir)) {
      try {
        fs.rmSync(statesDir, { recursive: true, force: true });
      } catch (err) {
        console.error('Error removing temka states dir:', err);
      }
    }
  },

  // Temkas
  getTemkaById(id: string): Temka | null {
    const row = sqlite.prepare('SELECT * FROM temkas WHERE id = ?').get(id) as any;
    return row ? formatTemka(row) : null;
  },
  getAllTemkas(): Temka[] {
    const rows = sqlite.prepare('SELECT * FROM temkas ORDER BY createdAt DESC').all() as any[];
    return rows.map(formatTemka);
  },
  getTemkasByOwner(ownerId: string): Temka[] {
    const rows = sqlite.prepare('SELECT * FROM temkas WHERE ownerId = ? ORDER BY createdAt DESC').all(ownerId) as any[];
    return rows.map(formatTemka);
  },
  insertTemka(temka: Temka): void {
    sqlite.prepare(`
      INSERT INTO temkas (
        id, ownerId, ownerUsername, ownerAvatarUrl, title, description, algorithmCode,
        collateral, initialCapital, capital, minBet, maxBet, status, createdAt, updatedAt,
        totalIn, totalOut, dealsCount, maxMultiplier, minMultiplier, hasStateFile
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      temka.id, temka.ownerId, temka.ownerUsername, temka.ownerAvatarUrl || null, temka.title, temka.description,
      temka.algorithmCode, temka.collateral, temka.initialCapital, temka.capital, temka.minBet, temka.maxBet,
      temka.status, temka.createdAt, temka.updatedAt, temka.totalIn, temka.totalOut, temka.dealsCount,
      temka.maxMultiplier, temka.minMultiplier, temka.hasStateFile ? 1 : 0
    );
  },
  updateTemka(temka: Partial<Temka> & { id: string }): void {
    const existing = db.getTemkaById(temka.id);
    if (!existing) return;
    const u = { ...existing, ...temka, updatedAt: new Date().toISOString() };
    sqlite.prepare(`
      UPDATE temkas
      SET ownerUsername = ?, ownerAvatarUrl = ?, title = ?, description = ?, algorithmCode = ?,
          collateral = ?, initialCapital = ?, capital = ?, minBet = ?, maxBet = ?, status = ?,
          updatedAt = ?, totalIn = ?, totalOut = ?, dealsCount = ?, maxMultiplier = ?,
          minMultiplier = ?, hasStateFile = ?
      WHERE id = ?
    `).run(
      u.ownerUsername, u.ownerAvatarUrl || null, u.title, u.description, u.algorithmCode,
      u.collateral, u.initialCapital, u.capital, u.minBet, u.maxBet, u.status,
      u.updatedAt, u.totalIn, u.totalOut, u.dealsCount, u.maxMultiplier,
      u.minMultiplier, u.hasStateFile ? 1 : 0, u.id
    );
  },

  // Transactions
  insertTransaction(tx: Transaction): void {
    sqlite.prepare(`
      INSERT INTO transactions (
        id, temkaId, userId, userHash, amount, payout, multiplier, isDefault, isRefund, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      tx.id, tx.temkaId, tx.userId, tx.userHash, tx.amount, tx.payout, tx.multiplier,
      tx.isDefault ? 1 : 0, tx.isRefund ? 1 : 0, tx.timestamp
    );
  },
  getTransactionsForTemka(temkaId: string, limit: number = 100): Transaction[] {
    const rows = sqlite.prepare(`
      SELECT * FROM transactions WHERE temkaId = ? ORDER BY timestamp DESC LIMIT ?
    `).all(temkaId, limit) as any[];
    return rows.map(formatTransaction);
  },
  getUserTransactions(userId: string, limit: number = 200): Transaction[] {
    const rows = sqlite.prepare(`
      SELECT * FROM transactions WHERE userId = ? ORDER BY timestamp DESC LIMIT ?
    `).all(userId, limit) as any[];
    return rows.map(formatTransaction);
  },
  getRecentTransactions(limit: number = 50): Transaction[] {
    const rows = sqlite.prepare(`
      SELECT * FROM transactions ORDER BY timestamp DESC LIMIT ?
    `).all(limit) as any[];
    return rows.map(formatTransaction);
  },

  // Withdrawal Requests
  getActiveWithdrawalRequest(temkaId: string): WithdrawalRequest | null {
    const row = sqlite.prepare(`
      SELECT * FROM withdrawal_requests WHERE temkaId = ? AND status = 'PENDING' LIMIT 1
    `).get(temkaId) as any;
    return row ? formatWithdrawalRequest(row) : null;
  },
  getAllPendingWithdrawalRequests(): WithdrawalRequest[] {
    const rows = sqlite.prepare(`
      SELECT * FROM withdrawal_requests WHERE status = 'PENDING'
    `).all() as any[];
    return rows.map(formatWithdrawalRequest);
  },
  insertWithdrawalRequest(wreq: WithdrawalRequest): void {
    sqlite.prepare(`
      INSERT INTO withdrawal_requests (
        id, temkaId, ownerId, amount, claimCollateralAndClose, status, createdAt, executedAt,
        depositsSinceRequest, uniqueDepositorsJson, deadlineAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      wreq.id, wreq.temkaId, wreq.ownerId, wreq.amount, wreq.claimCollateralAndClose ? 1 : 0,
      wreq.status, wreq.createdAt, wreq.executedAt || null, wreq.depositsSinceRequest,
      JSON.stringify(wreq.uniqueDepositors || []), wreq.deadlineAt
    );
  },
  updateWithdrawalRequest(wreq: WithdrawalRequest): void {
    sqlite.prepare(`
      UPDATE withdrawal_requests
      SET amount = ?, claimCollateralAndClose = ?, status = ?, executedAt = ?,
          depositsSinceRequest = ?, uniqueDepositorsJson = ?, deadlineAt = ?
      WHERE id = ?
    `).run(
      wreq.amount, wreq.claimCollateralAndClose ? 1 : 0, wreq.status, wreq.executedAt || null,
      wreq.depositsSinceRequest, JSON.stringify(wreq.uniqueDepositors || []), wreq.deadlineAt, wreq.id
    );
  },

  // Past Withdrawals
  insertPastWithdrawal(pw: PastWithdrawal): void {
    sqlite.prepare(`
      INSERT INTO past_withdrawals (id, temkaId, amount, claimedCollateral, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).run(pw.id, pw.temkaId, pw.amount, pw.claimedCollateral ? 1 : 0, pw.timestamp);
  },
  getPastWithdrawalsForTemka(temkaId: string): PastWithdrawal[] {
    const rows = sqlite.prepare(`
      SELECT * FROM past_withdrawals WHERE temkaId = ? ORDER BY timestamp DESC
    `).all(temkaId) as any[];
    return rows.map((r) => ({
      id: r.id,
      temkaId: r.temkaId,
      amount: r.amount,
      claimedCollateral: Boolean(r.claimedCollateral),
      timestamp: r.timestamp,
    }));
  },

  // Comments
  getCommentsForTemka(temkaId: string): Comment[] {
    const rows = sqlite.prepare(`
      SELECT * FROM comments WHERE temkaId = ? ORDER BY createdAt DESC
    `).all(temkaId) as any[];
    return rows.map(formatComment);
  },
  getCommentById(id: string): Comment | null {
    const row = sqlite.prepare('SELECT * FROM comments WHERE id = ?').get(id) as any;
    return row ? formatComment(row) : null;
  },
  insertComment(c: Comment): void {
    sqlite.prepare(`
      INSERT INTO comments (
        id, temkaId, userId, username, userAvatarUrl, text, createdAt, likesJson, userStatsJson
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      c.id, c.temkaId, c.userId, c.username, c.userAvatarUrl || null, c.text, c.createdAt,
      JSON.stringify(c.likes || []), JSON.stringify(c.userStats || {})
    );
  },
  updateComment(c: Comment): void {
    sqlite.prepare(`
      UPDATE comments
      SET userAvatarUrl = ?, text = ?, likesJson = ?, userStatsJson = ?
      WHERE id = ?
    `).run(c.userAvatarUrl || null, c.text, JSON.stringify(c.likes || []), JSON.stringify(c.userStats || {}), c.id);
  },

  // Sandbox Logs
  insertSandboxLog(log: SandboxLog): void {
    sqlite.prepare(`
      INSERT INTO sandbox_logs (
        id, temkaId, timestamp, durationMs, depositAmount, userHash, payout, stdout, stderr, error, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      log.id, log.temkaId, log.timestamp, log.durationMs, log.depositAmount, log.userHash,
      log.payout, log.stdout || '', log.stderr || '', log.error || null, log.status
    );
  },
  getSandboxLogsForTemka(temkaId: string, limit: number = 50): SandboxLog[] {
    const rows = sqlite.prepare(`
      SELECT * FROM sandbox_logs WHERE temkaId = ? ORDER BY timestamp DESC LIMIT ?
    `).all(temkaId, limit) as any[];
    return rows.map(formatSandboxLog);
  },

  // Transfers
  insertTransfer(tx: Transfer): void {
    sqlite.prepare(`
      INSERT INTO transfers (id, senderId, senderUsername, recipientId, recipientUsername, amount, comment, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(tx.id, tx.senderId, tx.senderUsername, tx.recipientId, tx.recipientUsername, tx.amount, tx.comment || null, tx.timestamp);
  },
  getUserTransfers(userId: string, limit: number = 100): Transfer[] {
    const rows = sqlite.prepare(`
      SELECT * FROM transfers WHERE senderId = ? OR recipientId = ? ORDER BY timestamp DESC LIMIT ?
    `).all(userId, userId, limit) as any[];
    return rows.map(formatTransfer);
  },

  // Temka Topups
  insertTemkaTopup(topup: { id: string; temkaId: string; ownerId: string; amount: number; timestamp: string }): void {
    sqlite.prepare(`
      INSERT INTO temka_topups (id, temkaId, ownerId, amount, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).run(topup.id, topup.temkaId, topup.ownerId, topup.amount, topup.timestamp);
  },
  getTemkaTopupsByOwner(ownerId: string, limit: number = 100): { id: string; temkaId: string; ownerId: string; amount: number; timestamp: string }[] {
    const rows = sqlite.prepare(`
      SELECT * FROM temka_topups WHERE ownerId = ? ORDER BY timestamp DESC LIMIT ?
    `).all(ownerId, limit) as any[];
    return rows.map((r) => ({
      id: r.id,
      temkaId: r.temkaId,
      ownerId: r.ownerId,
      amount: r.amount,
      timestamp: r.timestamp,
    }));
  },

  // Invoices (Argon Pay)
  insertInvoice(inv: Invoice): void {
    sqlite.prepare(`
      INSERT INTO invoices (
        id, userId, username, amount, uniqueAmount, amountWithCommission, bank, paymentUrl, status, createdAt, expiresAt, secondsLeft, credited
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      inv.id, inv.userId, inv.username, inv.amount, inv.uniqueAmount || null,
      inv.amountWithCommission || null, inv.bank, inv.paymentUrl || null,
      inv.status, inv.createdAt, inv.expiresAt || null, inv.secondsLeft || null,
      inv.credited ? 1 : 0
    );
  },
  getInvoiceById(id: string): Invoice | null {
    const row = sqlite.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as any;
    return row ? formatInvoice(row) : null;
  },
  updateInvoice(inv: Partial<Invoice> & { id: string }): void {
    const existing = db.getInvoiceById(inv.id);
    if (!existing) return;
    const u = { ...existing, ...inv };
    sqlite.prepare(`
      UPDATE invoices
      SET status = ?, uniqueAmount = ?, amountWithCommission = ?, paymentUrl = ?, expiresAt = ?, secondsLeft = ?, credited = ?
      WHERE id = ?
    `).run(
      u.status, u.uniqueAmount || null, u.amountWithCommission || null,
      u.paymentUrl || null, u.expiresAt || null, u.secondsLeft || null,
      u.credited ? 1 : 0, u.id
    );
  },
  getUserInvoices(userId: string, limit: number = 30): Invoice[] {
    const rows = sqlite.prepare(`
      SELECT * FROM invoices WHERE userId = ? ORDER BY createdAt DESC LIMIT ?
    `).all(userId, limit) as any[];
    return rows.map(formatInvoice);
  },
};

// Formatting helpers
function formatUser(row: any): User {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.passwordHash,
    balance: row.balance,
    createdAt: row.createdAt,
    avatarUrl: row.avatarUrl || undefined,
    bio: row.bio || undefined,
    isBanned: Boolean(row.isBanned),
    banReason: row.banReason || undefined,
  };
}

function formatTemka(row: any): Temka {
  return {
    id: row.id,
    ownerId: row.ownerId,
    ownerUsername: row.ownerUsername,
    ownerAvatarUrl: row.ownerAvatarUrl || undefined,
    title: row.title,
    description: row.description,
    algorithmCode: row.algorithmCode,
    collateral: row.collateral,
    initialCapital: row.initialCapital,
    capital: row.capital,
    minBet: row.minBet,
    maxBet: row.maxBet,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    totalIn: row.totalIn,
    totalOut: row.totalOut,
    dealsCount: row.dealsCount,
    maxMultiplier: row.maxMultiplier,
    minMultiplier: row.minMultiplier,
    hasStateFile: Boolean(row.hasStateFile),
  };
}

function formatTransaction(row: any): Transaction {
  return {
    id: row.id,
    temkaId: row.temkaId,
    userId: row.userId,
    userHash: row.userHash,
    amount: row.amount,
    payout: row.payout,
    multiplier: row.multiplier,
    isDefault: Boolean(row.isDefault),
    isRefund: Boolean(row.isRefund),
    timestamp: row.timestamp,
  };
}

function formatWithdrawalRequest(row: any): WithdrawalRequest {
  let uniqueDepositors: string[] = [];
  try {
    uniqueDepositors = JSON.parse(row.uniqueDepositorsJson || '[]');
  } catch (e) {}

  return {
    id: row.id,
    temkaId: row.temkaId,
    ownerId: row.ownerId,
    amount: row.amount,
    claimCollateralAndClose: Boolean(row.claimCollateralAndClose),
    status: row.status,
    createdAt: row.createdAt,
    executedAt: row.executedAt || undefined,
    depositsSinceRequest: row.depositsSinceRequest,
    uniqueDepositors,
    deadlineAt: row.deadlineAt,
  };
}

function formatComment(row: any): Comment {
  let likes: string[] = [];
  let userStats: any = {};
  try {
    likes = JSON.parse(row.likesJson || '[]');
  } catch (e) {}
  try {
    userStats = JSON.parse(row.userStatsJson || '{}');
  } catch (e) {}

  return {
    id: row.id,
    temkaId: row.temkaId,
    userId: row.userId,
    username: row.username,
    userAvatarUrl: row.userAvatarUrl || undefined,
    text: row.text,
    createdAt: row.createdAt,
    likes,
    userStats,
  };
}

function formatSandboxLog(row: any): SandboxLog {
  return {
    id: row.id,
    temkaId: row.temkaId,
    timestamp: row.timestamp,
    durationMs: row.durationMs,
    depositAmount: row.depositAmount,
    userHash: row.userHash,
    payout: row.payout,
    stdout: row.stdout || '',
    stderr: row.stderr || '',
    error: row.error || undefined,
    status: row.status,
  };
}

function formatTransfer(row: any): Transfer {
  return {
    id: row.id,
    senderId: row.senderId,
    senderUsername: row.senderUsername,
    recipientId: row.recipientId,
    recipientUsername: row.recipientUsername,
    amount: row.amount,
    comment: row.comment || undefined,
    timestamp: row.timestamp,
  };
}

function formatInvoice(row: any): Invoice {
  return {
    id: row.id,
    userId: row.userId,
    username: row.username,
    amount: row.amount,
    uniqueAmount: row.uniqueAmount || undefined,
    amountWithCommission: row.amountWithCommission || undefined,
    bank: row.bank,
    paymentUrl: row.paymentUrl || undefined,
    status: row.status,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt || undefined,
    secondsLeft: row.secondsLeft || undefined,
    credited: Boolean(row.credited),
  };
}

// Calculation queries using native SQL aggregations for max speed
export function getUserStatsForTemka(temkaId: string, userId: string) {
  const row = sqlite.prepare(`
    SELECT
      COALESCE(SUM(amount), 0) as totalBets,
      COALESCE(SUM(payout), 0) as totalPayouts,
      COUNT(*) as depositsCount
    FROM transactions
    WHERE temkaId = ? AND userId = ? AND isRefund = 0
  `).get(temkaId, userId) as any;

  const totalBets = row ? row.totalBets : 0;
  const totalPayouts = row ? row.totalPayouts : 0;
  const depositsCount = row ? row.depositsCount : 0;

  const roundedTotalBets = roundToHighestOrder(totalBets);
  const roundedTotalPayouts = roundToHighestOrder(totalPayouts);

  let exactRoiMultiplier = 0;
  if (totalBets > 0) {
    exactRoiMultiplier = Math.round((totalPayouts / totalBets) * 100) / 100;
  }

  let colorCode: 'green' | 'gray' | 'red' = 'gray';
  if (exactRoiMultiplier > 1.0) colorCode = 'green';
  else if (exactRoiMultiplier < 1.0) colorCode = 'red';

  return {
    totalBetsRaw: totalBets,
    totalPayoutsRaw: totalPayouts,
    depositsCount,
    roundedTotalBets,
    roundedTotalPayouts,
    exactRoiMultiplier,
    colorCode,
  };
}

export function getCreatorAggregatedMetrics(ownerId: string) {
  const row = sqlite.prepare(`
    SELECT
      COUNT(*) as totalTemkas,
      COALESCE(SUM(totalIn), 0) as totalCapitalRaised,
      COALESCE(SUM(totalOut), 0) as totalPayoutsGiven,
      COALESCE(SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END), 0) as activeCount,
      COALESCE(SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END), 0) as successfulClosedCount,
      COALESCE(SUM(CASE WHEN status = 'Bankrupt' THEN 1 ELSE 0 END), 0) as bankruptCount
    FROM temkas
    WHERE ownerId = ?
  `).get(ownerId) as any;

  const totalCapitalRaised = row ? row.totalCapitalRaised : 0;
  const totalPayoutsGiven = row ? row.totalPayoutsGiven : 0;
  const overallPayoutRate =
    totalCapitalRaised > 0
      ? Math.round((totalPayoutsGiven / totalCapitalRaised) * 1000) / 10
      : 0;

  return {
    totalTemkas: row ? row.totalTemkas : 0,
    activeCount: row ? row.activeCount : 0,
    successfulClosedCount: row ? row.successfulClosedCount : 0,
    bankruptCount: row ? row.bankruptCount : 0,
    totalCapitalRaised,
    totalPayoutsGiven,
    overallPayoutRate,
  };
}
