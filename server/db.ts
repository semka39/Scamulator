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
  PromoCode,
  PromoActivation,
  NotificationType,
  NotificationSettings,
  AppNotification,
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
    // PRAGMA user_version read (for future migrations, using prepare+get)
    // const { user_version } = dbInstance.prepare('PRAGMA user_version').get() as any;
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

    CREATE TABLE IF NOT EXISTS promo_codes (
      code TEXT PRIMARY KEY,
      amount INTEGER NOT NULL,
      maxActivations INTEGER NOT NULL,
      usedCount INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS promo_activations (
      id TEXT PRIMARY KEY,
      promoCode TEXT NOT NULL,
      userId TEXT NOT NULL,
      username TEXT NOT NULL,
      amount INTEGER NOT NULL,
      activatedAt TEXT NOT NULL,
      UNIQUE(promoCode, userId)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      temkaId TEXT,
      relatedUserId TEXT,
      isRead INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_settings (
      userId TEXT PRIMARY KEY,
      new_bet INTEGER NOT NULL DEFAULT 1,
      temka_bankrupt INTEGER NOT NULL DEFAULT 1,
      temka_closed INTEGER NOT NULL DEFAULT 1,
      withdrawal_executed INTEGER NOT NULL DEFAULT 1,
      new_comment INTEGER NOT NULL DEFAULT 1,
      transfer_received INTEGER NOT NULL DEFAULT 1
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
    CREATE INDEX IF NOT EXISTS idx_promo_activations_code ON promo_activations(promoCode);
    CREATE INDEX IF NOT EXISTS idx_promo_activations_user ON promo_activations(userId, activatedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_notifications_userId ON notifications(userId, createdAt DESC);
  `);

  // Safe migration for existing DBs
  try {
    sqlite.exec(`ALTER TABLE notifications ADD COLUMN relatedUserId TEXT`);
  } catch {}
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
      DELETE FROM promo_codes;
      DELETE FROM promo_activations;
      DELETE FROM notifications;
      DELETE FROM notification_settings;
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
  getTransactionsForTemkaByUser(temkaId: string, userId: string, limit: number = 30): Transaction[] {
    const rows = sqlite.prepare(`
      SELECT * FROM transactions WHERE temkaId = ? AND userId = ? ORDER BY timestamp DESC LIMIT ?
    `).all(temkaId, userId, limit) as any[];
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

  // Promo Codes
  createPromoCode(code: string, amount: number, maxActivations: number): { success: boolean; promo?: PromoCode; error?: string } {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 2) {
      return { success: false, error: 'Код промокода должен содержать не менее 2 символов' };
    }
    const cleanAmount = Math.floor(Number(amount));
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      return { success: false, error: 'Сумма бонуса промокода должна быть больше 0' };
    }
    const cleanMax = Math.floor(Number(maxActivations));
    if (isNaN(cleanMax) || cleanMax <= 0) {
      return { success: false, error: 'Количество активаций должно быть больше 0' };
    }

    const existing = db.getPromoCode(cleanCode);
    if (existing) {
      return { success: false, error: `Промокод "${cleanCode}" уже существует!` };
    }

    const promo: PromoCode = {
      code: cleanCode,
      amount: cleanAmount,
      maxActivations: cleanMax,
      usedCount: 0,
      createdAt: new Date().toISOString(),
    };

    sqlite.prepare(`
      INSERT INTO promo_codes (code, amount, maxActivations, usedCount, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(promo.code, promo.amount, promo.maxActivations, promo.usedCount, promo.createdAt);

    return { success: true, promo };
  },

  getPromoCode(code: string): PromoCode | null {
    const cleanCode = (code || '').trim().toUpperCase();
    const row = sqlite.prepare('SELECT * FROM promo_codes WHERE code = ?').get(cleanCode) as any;
    return row ? formatPromoCode(row) : null;
  },

  getAllPromoCodes(): PromoCode[] {
    const rows = sqlite.prepare('SELECT * FROM promo_codes ORDER BY createdAt DESC').all() as any[];
    return rows.map(formatPromoCode);
  },

  deletePromoCode(code: string): { success: boolean; error?: string } {
    const cleanCode = (code || '').trim().toUpperCase();
    const existing = db.getPromoCode(cleanCode);
    if (!existing) {
      return { success: false, error: `Промокод "${cleanCode}" не найден` };
    }

    withTransaction(() => {
      sqlite.prepare('DELETE FROM promo_codes WHERE code = ?').run(cleanCode);
      // Reset user activations as requested: if re-created, users can use it again
      sqlite.prepare('DELETE FROM promo_activations WHERE promoCode = ?').run(cleanCode);
    });

    return { success: true };
  },

  hasUserActivatedPromo(code: string, userId: string): boolean {
    const cleanCode = (code || '').trim().toUpperCase();
    const row = sqlite.prepare('SELECT 1 FROM promo_activations WHERE promoCode = ? AND userId = ?').get(cleanCode, userId) as any;
    return Boolean(row);
  },

  getUserPromoActivations(userId: string): PromoActivation[] {
    const rows = sqlite.prepare('SELECT * FROM promo_activations WHERE userId = ? ORDER BY activatedAt DESC').all(userId) as any[];
    return rows.map(formatPromoActivation);
  },

  applyPromoCode(code: string, userId: string): { success: boolean; amount?: number; newBalance?: number; error?: string } {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) {
      return { success: false, error: 'Введите промокод' };
    }

    const user = db.getUserById(userId);
    if (!user) {
      return { success: false, error: 'Пользователь не найден' };
    }
    if (user.isBanned) {
      return { success: false, error: 'Аккаунт заблокирован' };
    }

    const promo = db.getPromoCode(cleanCode);
    if (!promo) {
      return { success: false, error: 'Промокод не найден или был удалён' };
    }

    if (db.hasUserActivatedPromo(cleanCode, userId)) {
      return { success: false, error: 'Вы уже активировали этот промокод ранее' };
    }

    if (promo.usedCount >= promo.maxActivations) {
      return { success: false, error: 'Лимит активаций этого промокода исчерпан' };
    }

    let updatedBalance = user.balance;

    try {
      withTransaction(() => {
        const freshUser = db.getUserById(userId);
        const freshPromo = db.getPromoCode(cleanCode);

        if (!freshUser || !freshPromo) {
          throw new Error('Данные промокода или пользователя изменились');
        }

        if (db.hasUserActivatedPromo(cleanCode, userId)) {
          throw new Error('Вы уже активировали этот промокод');
        }

        if (freshPromo.usedCount >= freshPromo.maxActivations) {
          throw new Error('Лимит активаций этого промокода исчерпан');
        }

        // Increment usage
        sqlite.prepare('UPDATE promo_codes SET usedCount = usedCount + 1 WHERE code = ?').run(cleanCode);

        // Record activation
        const activationId = 'act_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        sqlite.prepare(`
          INSERT INTO promo_activations (id, promoCode, userId, username, amount, activatedAt)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(activationId, cleanCode, freshUser.id, freshUser.username, freshPromo.amount, new Date().toISOString());

        // Credit balance
        freshUser.balance += freshPromo.amount;
        db.updateUser(freshUser);
        updatedBalance = freshUser.balance;
      });
    } catch (err: any) {
      return { success: false, error: err.message || 'Ошибка активации промокода' };
    }

    return {
      success: true,
      amount: promo.amount,
      newBalance: updatedBalance,
    };
  },

  // Notifications & Settings
  getNotificationSettings(userId: string): NotificationSettings {
    const row = sqlite.prepare('SELECT * FROM notification_settings WHERE userId = ?').get(userId) as any;
    if (!row) {
      return {
        new_bet: true,
        temka_bankrupt: true,
        temka_closed: true,
        withdrawal_executed: true,
        new_comment: true,
        transfer_received: true,
      };
    }
    return {
      new_bet: Boolean(row.new_bet),
      temka_bankrupt: Boolean(row.temka_bankrupt),
      temka_closed: Boolean(row.temka_closed),
      withdrawal_executed: Boolean(row.withdrawal_executed),
      new_comment: Boolean(row.new_comment),
      transfer_received: Boolean(row.transfer_received),
    };
  },
  updateNotificationSettings(userId: string, patch: Partial<NotificationSettings>): NotificationSettings {
    const current = db.getNotificationSettings(userId);
    const next: NotificationSettings = {
      new_bet: patch.new_bet !== undefined ? Boolean(patch.new_bet) : current.new_bet,
      temka_bankrupt: patch.temka_bankrupt !== undefined ? Boolean(patch.temka_bankrupt) : current.temka_bankrupt,
      temka_closed: patch.temka_closed !== undefined ? Boolean(patch.temka_closed) : current.temka_closed,
      withdrawal_executed: patch.withdrawal_executed !== undefined ? Boolean(patch.withdrawal_executed) : current.withdrawal_executed,
      new_comment: patch.new_comment !== undefined ? Boolean(patch.new_comment) : current.new_comment,
      transfer_received: patch.transfer_received !== undefined ? Boolean(patch.transfer_received) : current.transfer_received,
    };
    sqlite.prepare(`
      INSERT INTO notification_settings (
        userId, new_bet, temka_bankrupt, temka_closed, withdrawal_executed, new_comment, transfer_received
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(userId) DO UPDATE SET
        new_bet = excluded.new_bet,
        temka_bankrupt = excluded.temka_bankrupt,
        temka_closed = excluded.temka_closed,
        withdrawal_executed = excluded.withdrawal_executed,
        new_comment = excluded.new_comment,
        transfer_received = excluded.transfer_received
    `).run(
      userId,
      next.new_bet ? 1 : 0,
      next.temka_bankrupt ? 1 : 0,
      next.temka_closed ? 1 : 0,
      next.withdrawal_executed ? 1 : 0,
      next.new_comment ? 1 : 0,
      next.transfer_received ? 1 : 0
    );
    return next;
  },
  createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    temkaId?: string,
    relatedUserId?: string
  ): AppNotification | null {
    const settings = db.getNotificationSettings(userId);
    if (!settings[type]) {
      return null;
    }
    const notif: AppNotification = {
      id: 'ntf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      userId,
      type,
      title,
      message,
      temkaId,
      relatedUserId,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    sqlite.prepare(`
      INSERT INTO notifications (id, userId, type, title, message, temkaId, relatedUserId, isRead, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(notif.id, notif.userId, notif.type, notif.title, notif.message, notif.temkaId || null, notif.relatedUserId || null, notif.createdAt);
    return notif;
  },
  getNotifications(userId: string, limit: number = 50): AppNotification[] {
    const rows = sqlite.prepare(`
      SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC LIMIT ?
    `).all(userId, limit) as any[];
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      type: row.type as NotificationType,
      title: row.title,
      message: row.message,
      temkaId: row.temkaId || undefined,
      relatedUserId: row.relatedUserId || undefined,
      isRead: Boolean(row.isRead),
      createdAt: row.createdAt,
    }));
  },
  getUnreadNotificationsCount(userId: string): number {
    const row = sqlite.prepare(`
      SELECT COUNT(*) as cnt FROM notifications WHERE userId = ? AND isRead = 0
    `).get(userId) as any;
    return Number(row?.cnt || 0);
  },
  markNotificationsRead(userId: string, notificationId?: string): void {
    if (notificationId) {
      sqlite.prepare('UPDATE notifications SET isRead = 1 WHERE id = ? AND userId = ?').run(notificationId, userId);
    } else {
      sqlite.prepare('UPDATE notifications SET isRead = 1 WHERE userId = ? AND isRead = 0').run(userId);
    }
  },
  deleteNotification(userId: string, notificationId?: string): void {
    if (notificationId) {
      sqlite.prepare('DELETE FROM notifications WHERE id = ? AND userId = ?').run(notificationId, userId);
    } else {
      sqlite.prepare('DELETE FROM notifications WHERE userId = ?').run(userId);
    }
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

function formatPromoCode(row: any): PromoCode {
  return {
    code: row.code,
    amount: row.amount,
    maxActivations: row.maxActivations,
    usedCount: row.usedCount,
    createdAt: row.createdAt,
  };
}

function formatPromoActivation(row: any): PromoActivation {
  return {
    id: row.id,
    promoCode: row.promoCode,
    userId: row.userId,
    username: row.username,
    amount: row.amount,
    activatedAt: row.activatedAt,
  };
}

// ----------------------------------------------------
// Transaction helper
// ----------------------------------------------------

export function withTransaction<T>(fn: () => T): T {
  sqlite.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    sqlite.exec('COMMIT');
    return result;
  } catch (err) {
    try { sqlite.exec('ROLLBACK'); } catch {}
    throw err;
  }
}

// Count temkas per owner in one SQL query (for leaderboard N+1 fix)
export function getTemkaCountsByOwner(): Map<string, number> {
  const rows = sqlite.prepare(
    'SELECT ownerId, COUNT(*) as cnt FROM temkas GROUP BY ownerId'
  ).all() as { ownerId: string; cnt: number }[];
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.ownerId, r.cnt);
  }
  return map;
}

// Hash password with SHA-256
export function hashPassword(plain: string): string {
  return crypto.createHash('sha256').update(plain).digest('hex');
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
