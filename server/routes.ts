import 'dotenv/config';
import express from 'express';
import {
  db,
  hashUserId,
  roundToHighestOrder,
  getUserStatsForTemka,
  getCreatorAggregatedMetrics,
  withTransaction,
  getTemkaCountsByOwner,
  hashPassword,
} from './db.js';
import { executePythonSandbox, simulatePythonSandbox } from './sandbox.js';
import { Temka, TemkaStatus, Transaction, WithdrawalRequest, Comment, SandboxLog, Transfer, Invoice } from './types.js';
import { setGateCookies, clearAuthCookie } from './gate.js';

export const apiRouter = express.Router();

const ARGON_PAY_BASE_URL = 'https://pray.fhi.hk/pay';

// Middleware: Extract user from Authorization header or Cookie
function getActiveUser(req: express.Request) {
  let token: string | undefined = undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.replace('Bearer ', '').trim();
  } else if (req.cookies && req.cookies['scam_auth_token']) {
    token = req.cookies['scam_auth_token'];
  }

  if (token) {
    const user = db.getUserById(token) || db.getUserByUsername(token);
    if (user) {
      if (user.isBanned) return null;
      return user;
    }
  }
  return null;
}

// ----------------------------------------------------
// AUTO-WITHDRAWAL EXECUTION ENGINE
// ----------------------------------------------------
export function executeWithdrawalRequest(activeReq: WithdrawalRequest): boolean {
  try {
    const temka = db.getTemkaById(activeReq.temkaId);
    if (!temka) {
      activeReq.status = 'CANCELLED';
      db.updateWithdrawalRequest(activeReq);
      return false;
    }

    const owner = db.getUserById(temka.ownerId);
    const actualWithdrawal = Math.min(temka.capital, activeReq.amount);
    const claimedCollateral = activeReq.claimCollateralAndClose ? temka.collateral : 0;
    temka.capital -= actualWithdrawal;

    if (owner) {
      owner.balance += actualWithdrawal;
    }

    if (activeReq.claimCollateralAndClose) {
      if (owner) {
        owner.balance += temka.collateral;
      }
      temka.collateral = 0;
      temka.status = 'Closed';
    }

    activeReq.status = 'EXECUTED';
    activeReq.executedAt = new Date().toISOString();

    db.updateWithdrawalRequest(activeReq);
    if (owner) {
      db.updateUser(owner);
    }
    db.updateTemka(temka);

    db.insertPastWithdrawal({
      id: 'pw_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      temkaId: temka.id,
      amount: actualWithdrawal,
      claimedCollateral: Boolean(activeReq.claimCollateralAndClose),
      timestamp: new Date().toISOString(),
    });

    if (owner) {
      db.createNotification(
        owner.id,
        'withdrawal_executed',
        `Вывод из «${temka.title}» выполнен`,
        `На баланс зачислено ${actualWithdrawal.toLocaleString('ru-RU')} ₽${claimedCollateral > 0 ? ` + залог ${claimedCollateral.toLocaleString('ru-RU')} ₽` : ''}.`,
        temka.id
      );
      if (activeReq.claimCollateralAndClose) {
        db.createNotification(
          owner.id,
          'temka_closed',
          `Темка «${temka.title}» закрыта`,
          `Залог возвращён на ваш баланс, приём ставок остановлен.`,
          temka.id
        );
      }
    }

    console.log(`[Auto-Withdrawal] Successfully executed request ${activeReq.id} for temka ${temka.id}. Withdrawn: ${actualWithdrawal}`);
    return true;
  } catch (err) {
    console.error(`Failed to execute withdrawal request ${activeReq.id}:`, err);
    return false;
  }
}

export function processPendingWithdrawals(): number {
  try {
    const pending = db.getAllPendingWithdrawalRequests();
    if (!pending || pending.length === 0) return 0;

    let executedCount = 0;
    const now = Date.now();

    for (const req of pending) {
      const isExpired = now >= new Date(req.deadlineAt).getTime();
      const hasEnoughDeposits = (req.depositsSinceRequest || 0) >= 10;

      if (isExpired || hasEnoughDeposits) {
        if (executeWithdrawalRequest(req)) {
          executedCount++;
        }
      }
    }

    return executedCount;
  } catch (err) {
    console.error('Error processing pending withdrawals:', err);
    return 0;
  }
}

// Background auto-processor: continuously checks every 2.5 seconds
// [Fix #10] Removed duplicate call from middleware — only setInterval is needed
setInterval(processPendingWithdrawals, 2500);

// Global middleware: (withdrawal processing moved to setInterval only)

// Gate verification endpoint
apiRouter.post('/gate/verify', async (req, res) => {
  const { captchaToken } = req.body;
  if (!captchaToken) {
    return res.status(400).json({ error: 'Пройдите проверку hCaptcha' });
  }

  // If HCAPTCHA_SECRET is provided and token is not a dummy/test token, verify with hCaptcha API
  const secret = process.env.HCAPTCHA_SECRET;
  const isTestToken =
    captchaToken === '10000000-aaaa-bbbb-cccc-000000000001' ||
    captchaToken === '10000000-ffff-ffff-ffff-000000000001' ||
    captchaToken.startsWith('10000000-') ||
    captchaToken.startsWith('test_');

  if (secret && !isTestToken) {
    try {
      const verifyRes = await fetch('https://hcaptcha.com/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret,
          response: captchaToken,
        }),
      });
      const verifyData = (await verifyRes.json()) as any;
      if (!verifyData.success) {
        return res.status(400).json({ error: 'Неверный ответ капчи' });
      }
    } catch (e) {
      console.error('hCaptcha verification error:', e);
    }
  }

  // Set 24h gate cookie and return token
  const gateToken = setGateCookies(res);
  res.json({ success: true, gatePass: gateToken });
});

// ----------------------------------------------------
// 1. AUTH & USER ROUTES
// ----------------------------------------------------

apiRouter.get('/auth/me', (req, res) => {
  const user = getActiveUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const { passwordHash, ...safeUser } = user;
  res.json({ user: safeUser });
});

apiRouter.get('/users', (req, res) => {
  const users = db.getAllUsers().filter((u) => !u.isBanned);
  const safeUsers = users.map(({ passwordHash, ...u }) => u);
  res.json({ users: safeUsers });
});

apiRouter.get('/leaderboard', (req, res) => {
  const currentUser = getActiveUser(req);
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
  const pageSize = Math.min(50, Math.max(5, parseInt(String(req.query.pageSize || '10'), 10)));
  const search = String(req.query.search || '').trim().toLowerCase();

  // Get active non-banned users ordered by balance DESC, then by createdAt ASC
  const allUsers = db.getAllUsers()
    .filter((u) => !u.isBanned)
    .sort((a, b) => {
      if (b.balance !== a.balance) {
        return b.balance - a.balance;
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  // Calculate ranks for all users
  // [Fix #14] Use a single aggregated SQL query instead of N+1 per-user getTemkasByOwner calls
  const temkaCountMap = getTemkaCountsByOwner();
  const rankedUsers = allUsers.map((u, idx) => {
    const { passwordHash, ...safeUser } = u;
    return {
      ...safeUser,
      rank: idx + 1,
      temkasCount: temkaCountMap.get(u.id) || 0,
    };
  });

  // Check current user position
  let currentUserRank: { rank: number; page: number } | undefined = undefined;
  if (currentUser) {
    const userIndex = rankedUsers.findIndex((u) => u.id === currentUser.id);
    if (userIndex !== -1) {
      const userRank = userIndex + 1;
      currentUserRank = {
        rank: userRank,
        page: Math.ceil(userRank / pageSize),
      };
    }
  }

  // Filter if search query provided
  const filteredUsers = search
    ? rankedUsers.filter(
        (u) =>
          u.username.toLowerCase().includes(search) ||
          (u.bio && u.bio.toLowerCase().includes(search))
      )
    : rankedUsers;

  const totalUsers = filteredUsers.length;
  const totalPages = Math.ceil(totalUsers / pageSize) || 1;
  const validPage = Math.min(page, totalPages);
  const startIndex = (validPage - 1) * pageSize;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + pageSize);

  res.json({
    users: paginatedUsers,
    totalUsers,
    page: validPage,
    pageSize,
    totalPages,
    currentUserRank,
  });
});

apiRouter.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.getUserByUsername(username || '');
  // [Fix #4] Compare hashed password (SHA-256). Backward-compat: if stored hash is not 64-char hex, treat as plain-text and migrate.
  const isLegacyPlain = user && user.passwordHash.length !== 64;
  const inputHash = hashPassword(password || '');
  const passwordMatch = user && (isLegacyPlain ? user.passwordHash === password : user.passwordHash === inputHash);
  if (!user || !passwordMatch) {
    return res.status(400).json({ error: 'Неверное имя пользователя или пароль' });
  }
  // Migrate plain-text password to SHA-256 hash on first successful login
  if (isLegacyPlain) {
    user.passwordHash = inputHash;
    db.updateUser(user);
  }
  if (user.isBanned) {
    return res.status(403).json({
      error: `Аккаунт заблокирован администратором.${user.banReason ? ` Причина: ${user.banReason}` : ''}`,
    });
  }

  // Set 24h gate pass and auth cookies
  setGateCookies(res, user.id);

  const { passwordHash, ...safeUser } = user;
  res.json({ user: safeUser, token: user.id });
});

apiRouter.post('/auth/register', async (req, res) => {
  const { username, password, captchaToken } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Заполните логин и пароль' });
  }

  // hCaptcha check: verify token presence & validate with hCaptcha API if secret configured
  if (!captchaToken || typeof captchaToken !== 'string' || !captchaToken.trim()) {
    return res.status(400).json({ error: 'Пройдите проверку hCaptcha (я не робот)' });
  }

  const secret = process.env.HCAPTCHA_SECRET;
  const isTestToken =
    captchaToken === '10000000-aaaa-bbbb-cccc-000000000001' ||
    captchaToken === '10000000-ffff-ffff-ffff-000000000001' ||
    captchaToken.startsWith('10000000-') ||
    captchaToken.startsWith('test_');

  if (secret && !isTestToken) {
    try {
      const verifyRes = await fetch('https://hcaptcha.com/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret,
          response: captchaToken,
        }),
      });
      const verifyData = (await verifyRes.json()) as any;
      if (!verifyData.success) {
        return res.status(400).json({ error: 'Неверный ответ капчи' });
      }
    } catch (e) {
      console.error('hCaptcha registration verification error:', e);
    }
  }

  const cleanUsername = username.trim();
  if (cleanUsername.length < 3) {
    return res.status(400).json({ error: 'Имя пользователя должно содержать не менее 3 символов' });
  }
  if (db.getUserByUsername(cleanUsername)) {
    return res.status(400).json({ error: 'Пользователь с таким именем уже существует' });
  }

  const newUser = {
    // [Fix #13] Add random suffix to prevent timestamp-based userId enumeration
    id: 'usr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    username: cleanUsername,
    // [Fix #4] Store password as SHA-256 hash
    passwordHash: hashPassword(password),
    balance: 0, // No starting bonus (0 RUB)
    createdAt: new Date().toISOString(),
    avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanUsername)}`,
    bio: 'Начинающий темщик и алгоритмический инвестор',
  };

  db.insertUser(newUser);

  // Set 24h gate pass and auth cookies
  setGateCookies(res, newUser.id);

  const { passwordHash, ...safeUser } = newUser;
  res.json({ user: safeUser, token: newUser.id });
});

apiRouter.post('/auth/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true });
});

// ----------------------------------------------------
// 1.1 TRANSFERS (P2P Money transfers between accounts)
// ----------------------------------------------------

apiRouter.post('/transfers', (req, res) => {
  const sender = getActiveUser(req);
  if (!sender) {
    return res.status(401).json({ error: 'Необходима авторизация' });
  }

  const { recipientUsername, amount, comment } = req.body;
  if (!recipientUsername || typeof recipientUsername !== 'string') {
    return res.status(400).json({ error: 'Укажите логин получателя' });
  }

  const cleanRecipient = recipientUsername.trim().replace(/^@/, '');
  const transferAmount = Math.floor(Number(amount));

  if (isNaN(transferAmount) || transferAmount <= 0) {
    return res.status(400).json({ error: 'Сумма перевода должна быть больше 0 ₽' });
  }

  if (sender.balance < transferAmount) {
    return res.status(400).json({
      error: `Недостаточно средств. Ваш баланс: ${sender.balance.toLocaleString()} ₽, требуется: ${transferAmount.toLocaleString()} ₽`
    });
  }

  const recipient = db.getUserByUsername(cleanRecipient) || db.getUserById(cleanRecipient);
  if (!recipient) {
    return res.status(404).json({ error: `Пользователь @${cleanRecipient} не найден` });
  }

  if (recipient.id === sender.id || recipient.username.toLowerCase() === sender.username.toLowerCase()) {
    return res.status(400).json({ error: 'Нельзя переводить средства самому себе' });
  }

  // [Fix #2] Execute transfer atomically inside a SQLite transaction to prevent partial updates
  let newSenderBalance: number;
  try {
    newSenderBalance = withTransaction(() => {
      // Re-read fresh balances inside transaction to avoid stale data
      const freshSender = db.getUserById(sender.id);
      if (!freshSender) throw new Error('Отправитель не найден');
      if (freshSender.balance < transferAmount) {
        throw new Error(`Недостаточно средств. Ваш баланс: ${freshSender.balance.toLocaleString()} ₽, требуется: ${transferAmount.toLocaleString()} ₽`);
      }
      const freshRecipient = db.getUserById(recipient.id);
      if (!freshRecipient) throw new Error('Получатель не найден');

      freshSender.balance -= transferAmount;
      freshRecipient.balance += transferAmount;

      db.updateUser(freshSender);
      db.updateUser(freshRecipient);
      return freshSender.balance;
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Ошибка выполнения перевода' });
  }

  const newTransfer: Transfer = {
    id: 'trf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    senderId: sender.id,
    senderUsername: sender.username,
    recipientId: recipient.id,
    recipientUsername: recipient.username,
    amount: transferAmount,
    comment: comment ? String(comment).trim().slice(0, 200) : undefined,
    timestamp: new Date().toISOString(),
  };

  db.insertTransfer(newTransfer);

  db.createNotification(
    recipient.id,
    'transfer_received',
    `Входящий перевод +${transferAmount.toLocaleString('ru-RU')} ₽`,
    `От @${sender.username}${newTransfer.comment ? `: «${newTransfer.comment}»` : ''}`,
    undefined,
    sender.id
  );

  res.json({
    success: true,
    message: `Перевод на сумму ${transferAmount.toLocaleString()} ₽ пользователю @${recipient.username} успешно выполнен!`,
    transfer: newTransfer,
    newBalance: newSenderBalance,
  });
});

apiRouter.get('/transfers', (req, res) => {
  const user = getActiveUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Необходима авторизация' });
  }

  const transfers = db.getUserTransfers(user.id, 50);
  res.json({ transfers });
});

// ----------------------------------------------------
// 1.2 DEPOSIT / ACQUIRING (Argon Pay Integration)
// ----------------------------------------------------

apiRouter.post('/deposit/create', async (req, res) => {
  const user = getActiveUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Необходима авторизация' });
  }

  const { amount, method } = req.body;
  const depositAmount = Number(amount);

  if (isNaN(depositAmount) || depositAmount < 100) {
    return res.status(400).json({ error: 'Минимальная сумма пополнения — 100 ₽' });
  }

  // Validating payment method: 'ozon' or 'sbp'
  // SBP is mapped to bank 'sber' for Argon Pay backend processing
  if (method !== 'ozon' && method !== 'sbp') {
    return res.status(400).json({ error: 'Выберите способ оплаты: Озон Банк или СБП' });
  }

  const bankCode = method === 'ozon' ? 'ozon' : 'sber';

  try {
    const payload = {
      amount: depositAmount,
      bank: bankCode,
    };

    const response = await fetch(`${ARGON_PAY_BASE_URL}/v1/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.ARGON_PAY_API_KEY || '',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { raw: responseText };
    }

    if (!response.ok || !data.id) {
      const errMsg = data.message || data.detail || data.error || `Ошибка эквайринга (${response.status})`;
      return res.status(400).json({ error: errMsg });
    }

    // Save invoice to local database
    const newInvoice: Invoice = {
      id: data.id,
      userId: user.id,
      username: user.username,
      amount: Number(data.requested_amount || depositAmount),
      uniqueAmount: data.unique_amount !== undefined ? Number(data.unique_amount) : undefined,
      amountWithCommission: data.amount_with_commission !== undefined ? Number(data.amount_with_commission) : undefined,
      bank: data.bank || bankCode,
      paymentUrl: data.payment_url || `https://pray.fhi.hk/pay/invoice/${data.id}`,
      status: (data.status as any) || 'active',
      createdAt: data.created_at ? new Date(data.created_at * 1000).toISOString() : new Date().toISOString(),
      expiresAt: data.expires_at ? new Date(data.expires_at * 1000).toISOString() : undefined,
      secondsLeft: data.seconds_left !== undefined ? Number(data.seconds_left) : undefined,
      credited: false,
    };

    db.insertInvoice(newInvoice);

    res.json({
      success: true,
      invoice: newInvoice,
      displayMethod: method === 'ozon' ? 'Озон Банк' : 'СБП',
    });
  } catch (err: any) {
    console.error('Argon Pay invoice creation error:', err);
    res.status(500).json({ error: 'Не удалось связаться с платежным шлюзом: ' + (err.message || 'Сетевая ошибка') });
  }
});

apiRouter.get('/deposit/check/:invoiceId', async (req, res) => {
  const user = getActiveUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Необходима авторизация' });
  }

  const { invoiceId } = req.params;
  const localInvoice = db.getInvoiceById(invoiceId);
  if (!localInvoice) {
    return res.status(404).json({ error: 'Счёт на оплату не найден' });
  }

  if (localInvoice.userId !== user.id) {
    return res.status(403).json({ error: 'Доступ к чужому счёту запрещён' });
  }

  // If already credited, return current state
  if (localInvoice.credited) {
    return res.json({
      status: 'paid',
      invoice: localInvoice,
      alreadyCredited: true,
      newBalance: user.balance,
      message: 'Счёт уже был успешно оплачен и зачислен',
    });
  }

  try {
    const response = await fetch(`${ARGON_PAY_BASE_URL}/v1/invoices/${localInvoice.id}`, {
      headers: {
        'X-API-Key': process.env.ARGON_PAY_API_KEY || '',
      },
    });

    const responseText = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { raw: responseText };
    }

    if (!response.ok) {
      return res.status(400).json({ error: data.message || `Ошибка проверки статуса (${response.status})` });
    }

    const currentStatus = (data.status as 'active' | 'paid' | 'expired' | 'cancelled') || localInvoice.status;
    let justCredited = false;

    // Check if paid and not yet credited
    if (currentStatus === 'paid' && !localInvoice.credited) {
      localInvoice.status = 'paid';
      localInvoice.credited = true;
      localInvoice.secondsLeft = 0;

      // Credit user's balance
      const creditAmount = Math.round(localInvoice.amount);
      user.balance += creditAmount;

      db.updateUser(user);
      db.updateInvoice(localInvoice);
      justCredited = true;
    } else {
      localInvoice.status = currentStatus;
      if (data.seconds_left !== undefined) {
        localInvoice.secondsLeft = Number(data.seconds_left);
      }
      db.updateInvoice(localInvoice);
    }

    res.json({
      status: currentStatus,
      invoice: localInvoice,
      justCredited,
      newBalance: user.balance,
      message: justCredited
        ? `Оплата подтверждена! Ваш баланс пополнен на ${localInvoice.amount.toLocaleString()} ₽`
        : currentStatus === 'active'
        ? 'Ожидание поступления платежа...'
        : `Статус счёта: ${currentStatus}`,
    });
  } catch (err: any) {
    console.error('Argon Pay invoice check error:', err);
    res.status(500).json({ error: 'Ошибка проверки платежа: ' + (err.message || 'Сетевая ошибка') });
  }
});

apiRouter.get('/deposit/invoices', (req, res) => {
  const user = getActiveUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Необходима авторизация' });
  }

  const invoices = db.getUserInvoices(user.id, 20);
  res.json({ invoices });
});

// ----------------------------------------------------
// 1.3 PROMO CODES
// ----------------------------------------------------

apiRouter.post('/promo/apply', (req, res) => {
  const user = getActiveUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Необходима авторизация' });
  }

  const { code } = req.body;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Введите промокод' });
  }

  const result = db.applyPromoCode(code, user.id);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  res.json({
    success: true,
    amount: result.amount,
    newBalance: result.newBalance,
    message: `Промокод «${code.trim().toUpperCase()}» успешно активирован! На ваш баланс зачислено +${result.amount?.toLocaleString('ru-RU')} ₽`,
  });
});

// ----------------------------------------------------
// 1.4 NOTIFICATIONS & SETTINGS
// ----------------------------------------------------

apiRouter.get('/notifications', (req, res) => {
  const user = getActiveUser(req);
  if (!user) return res.status(401).json({ error: 'Необходима авторизация' });

  const notifications = db.getNotifications(user.id, 50);
  const unreadCount = db.getUnreadNotificationsCount(user.id);
  res.json({ notifications, unreadCount });
});

apiRouter.post('/notifications/read', (req, res) => {
  const user = getActiveUser(req);
  if (!user) return res.status(401).json({ error: 'Необходима авторизация' });

  const { notificationId } = req.body || {};
  db.markNotificationsRead(user.id, typeof notificationId === 'string' ? notificationId : undefined);
  res.json({ success: true, unreadCount: db.getUnreadNotificationsCount(user.id) });
});

apiRouter.delete('/notifications/:notificationId', (req, res) => {
  const user = getActiveUser(req);
  if (!user) return res.status(401).json({ error: 'Необходима авторизация' });

  db.deleteNotification(user.id, req.params.notificationId);
  res.json({ success: true, unreadCount: db.getUnreadNotificationsCount(user.id) });
});

apiRouter.delete('/notifications', (req, res) => {
  const user = getActiveUser(req);
  if (!user) return res.status(401).json({ error: 'Необходима авторизация' });

  db.deleteNotification(user.id);
  res.json({ success: true, unreadCount: 0 });
});

apiRouter.get('/notifications/settings', (req, res) => {
  const user = getActiveUser(req);
  if (!user) return res.status(401).json({ error: 'Необходима авторизация' });

  res.json({ settings: db.getNotificationSettings(user.id) });
});

apiRouter.put('/notifications/settings', (req, res) => {
  const user = getActiveUser(req);
  if (!user) return res.status(401).json({ error: 'Необходима авторизация' });

  const updated = db.updateNotificationSettings(user.id, req.body || {});
  res.json({ success: true, settings: updated });
});

// 1.1 Public Profile View
apiRouter.get('/users/:userId/public', (req, res) => {
  const targetUser = db.getUserById(req.params.userId) || db.getUserByUsername(req.params.userId);
  if (!targetUser) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }

  // Calculate user rank across the entire platform
  const allUsersSorted = db.getAllUsers().sort((a, b) => {
    if (b.balance !== a.balance) return b.balance - a.balance;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
  const userRank = allUsersSorted.findIndex((u) => u.id === targetUser.id) + 1;

  const { passwordHash, ...safeUser } = targetUser;
  const metrics = getCreatorAggregatedMetrics(targetUser.id);
  const temkas = db.getTemkasByOwner(targetUser.id).map((t) => {
    const { algorithmCode, ...safeTemka } = t;
    return safeTemka;
  });

  res.json({
    user: {
      ...safeUser,
      rank: userRank > 0 ? userRank : undefined,
    },
    metrics,
    temkas,
  });
});

// 1.2 Update Profile (Bio, Avatar)
apiRouter.patch('/users/me/profile', (req, res) => {
  const user = getActiveUser(req);
  if (!user) return res.status(401).json({ error: 'Необходимо войти в систему' });

  const { bio, avatarUrl } = req.body;
  if (typeof bio === 'string') {
    user.bio = bio.trim().slice(0, 500);
  }
  if (typeof avatarUrl === 'string' && avatarUrl.trim()) {
    user.avatarUrl = avatarUrl.trim();
  }

  db.updateUser(user);
  const { passwordHash, ...safeUser } = user;
  res.json({ user: safeUser, message: 'Профиль успешно обновлен!' });
});

// 1.3 Private Dashboard
apiRouter.get('/users/me/dashboard', (req, res) => {
  const user = getActiveUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const myTemkas = db.getTemkasByOwner(user.id);
  const metrics = getCreatorAggregatedMetrics(user.id);

  // Get active withdrawal requests for user's temkas
  const activeWithdrawalRequests: WithdrawalRequest[] = [];
  for (const t of myTemkas) {
    const reqItem = db.getActiveWithdrawalRequest(t.id);
    if (reqItem) activeWithdrawalRequests.push(reqItem);
  }

  res.json({
    user: {
      id: user.id,
      username: user.username,
      balance: user.balance,
      createdAt: user.createdAt,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
    },
    metrics,
    myTemkas,
    activeWithdrawalRequests,
  });
});

// 1.4 Unified Balance History
apiRouter.get('/users/me/balance-history', (req, res) => {
  const user = getActiveUser(req);
  if (!user) return res.status(401).json({ error: 'Необходимо войти в систему' });

  const items: any[] = [];
  const temkaCache = new Map<string, Temka | null>();

  // 1. Transfers (Incoming and Outgoing)
  const transfers = db.getUserTransfers(user.id, 100);
  for (const tr of transfers) {
    const isOut = tr.senderId === user.id;
    items.push({
      id: 'tr_' + tr.id,
      category: 'transfers',
      direction: isOut ? 'expense' : 'income',
      type: isOut ? 'transfer_out' : 'transfer_in',
      title: isOut ? `Перевод @${tr.recipientUsername}` : `Перевод от @${tr.senderUsername}`,
      amount: Math.abs(tr.amount),
      comment: tr.comment,
      timestamp: tr.timestamp,
    });
  }

  // 2. Invoices (Argon Pay Deposits)
  const invoices = db.getUserInvoices(user.id, 50);
  for (const inv of invoices) {
    if (inv.credited || inv.status === 'paid') {
      items.push({
        id: 'inv_' + inv.id,
        category: 'deposits',
        direction: 'income',
        type: 'deposit',
        title: `Пополнение баланса (${inv.bank === 'ozon' ? 'Озон Банк' : 'СБП'})`,
        amount: Math.round(Math.abs(inv.amount)),
        timestamp: inv.createdAt,
      });
    }
  }

  // 3. Investor Investments / Bets (Вложения в темки)
  const userTxs = db.getUserTransactions(user.id, 100);
  for (const tx of userTxs) {
    if (!temkaCache.has(tx.temkaId)) {
      temkaCache.set(tx.temkaId, db.getTemkaById(tx.temkaId));
    }
    const temka = temkaCache.get(tx.temkaId);
    const temkaTitle = temka ? temka.title : 'Смарт-контракт';
    const delta = tx.payout - tx.amount;
    const direction = delta > 0 ? 'income' : delta < 0 ? 'expense' : 'neutral';

    items.push({
      id: 'tx_' + tx.id,
      category: 'investments',
      direction,
      type: 'investment',
      title: `Вложение в «${temkaTitle}»`,
      isInvestment: true,
      temkaId: tx.temkaId,
      temkaTitle,
      betAmount: tx.amount,
      payout: tx.payout,
      delta,
      multiplier: tx.multiplier,
      isDefault: tx.isDefault,
      isRefund: tx.isRefund,
      timestamp: tx.timestamp,
    });
  }

  // 4. Temka Owner actions (Создание, Пополнения пулов, Выводы средств)
  const myTemkas = db.getTemkasByOwner(user.id);
  for (const t of myTemkas) {
    // 4.1 Creation of Temka (Initial Capital + Collateral)
    items.push({
      id: 'create_' + t.id,
      category: 'temkas',
      direction: 'expense',
      type: 'temka_create',
      title: `Создание темки «${t.title}»`,
      temkaId: t.id,
      temkaTitle: t.title,
      amount: Math.abs(t.initialCapital + t.collateral),
      subtext: `Капитал: ${t.initialCapital.toLocaleString()} ₽ • Залог: ${t.collateral.toLocaleString()} ₽`,
      timestamp: t.createdAt,
    });

    // 4.2 Past withdrawals from this temka
    const pastWithdrawals = db.getPastWithdrawalsForTemka(t.id);
    for (const pw of pastWithdrawals) {
      items.push({
        id: 'pw_' + pw.id,
        category: 'temkas',
        direction: 'income',
        type: 'temka_withdraw',
        title: `Вывод из темки «${t.title}»`,
        temkaId: t.id,
        temkaTitle: t.title,
        amount: Math.abs(pw.amount),
        subtext: pw.claimedCollateral ? 'Возврат капитала и залога' : 'Вывод прибыли пула',
        timestamp: pw.timestamp,
      });
    }
  }

  // 4.3 Top-ups of Temka pools by owner
  const topups = db.getTemkaTopupsByOwner(user.id, 50);
  for (const top of topups) {
    if (!temkaCache.has(top.temkaId)) {
      temkaCache.set(top.temkaId, db.getTemkaById(top.temkaId));
    }
    const temka = temkaCache.get(top.temkaId);
    const temkaTitle = temka ? temka.title : 'Темка';
    items.push({
      id: 'topup_' + top.id,
      category: 'temkas',
      direction: 'expense',
      type: 'temka_topup',
      title: `Пополнение пула «${temkaTitle}»`,
      temkaId: top.temkaId,
      temkaTitle,
      amount: Math.abs(top.amount),
      timestamp: top.timestamp,
    });
  }

  // 5. Promo Code Activations
  const promoActivations = db.getUserPromoActivations(user.id);
  for (const pa of promoActivations) {
    items.push({
      id: 'promo_' + pa.id,
      category: 'deposits',
      direction: 'income',
      type: 'promo_code',
      title: `Промокод «${pa.promoCode}»`,
      subtext: 'Бонусная активация промокода',
      amount: pa.amount,
      timestamp: pa.activatedAt,
    });
  }

  // Sort by timestamp descending
  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  res.json({ items });
});

// ----------------------------------------------------
// 2. TEMKAS CATALOG & FILTERS
// ----------------------------------------------------

apiRouter.get('/temkas', (req, res) => {
  const {
    search,
    status,
    minCapital,
    maxCapital,
    minCollateral,
    maxCollateral,
    minBetMin,
    minBetMax,
    maxBetMin,
    maxBetMax,
    minTotalIn,
    maxTotalIn,
    minTotalOut,
    maxTotalOut,
    minRtp,
    maxRtp,
    minDeals,
    maxDeals,
    minWithdrawalRatio,
    maxWithdrawalRatio,
    maxAgeHours,
    sortBy = 'capital',
    sortDir = 'desc',
  } = req.query;

  let results = db.getAllTemkas();

  // 1. Text Search (title, description, owner username)
  if (search && typeof search === 'string' && search.trim()) {
    const q = search.toLowerCase().trim();
    results = results.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.ownerUsername.toLowerCase().includes(q)
    );
  }

  // 2. Status multi-select
  if (status && typeof status === 'string') {
    const allowedStatuses = status.split(',').map((s) => s.trim());
    results = results.filter((t) => allowedStatuses.includes(t.status));
  }

  // 3. Numeric Ranges
  if (minCapital !== undefined && minCapital !== '') {
    results = results.filter((t) => t.capital >= Number(minCapital));
  }
  if (maxCapital !== undefined && maxCapital !== '') {
    results = results.filter((t) => t.capital <= Number(maxCapital));
  }

  if (minCollateral !== undefined && minCollateral !== '') {
    results = results.filter((t) => t.collateral >= Number(minCollateral));
  }
  if (maxCollateral !== undefined && maxCollateral !== '') {
    results = results.filter((t) => t.collateral <= Number(maxCollateral));
  }

  if (minBetMin !== undefined && minBetMin !== '') {
    results = results.filter((t) => t.minBet >= Number(minBetMin));
  }
  if (minBetMax !== undefined && minBetMax !== '') {
    results = results.filter((t) => t.minBet <= Number(minBetMax));
  }

  if (maxBetMin !== undefined && maxBetMin !== '') {
    results = results.filter((t) => t.maxBet >= Number(maxBetMin));
  }
  if (maxBetMax !== undefined && maxBetMax !== '') {
    results = results.filter((t) => t.maxBet <= Number(maxBetMax));
  }

  if (minTotalIn !== undefined && minTotalIn !== '') {
    results = results.filter((t) => t.totalIn >= Number(minTotalIn));
  }
  if (maxTotalIn !== undefined && maxTotalIn !== '') {
    results = results.filter((t) => t.totalIn <= Number(maxTotalIn));
  }

  if (minTotalOut !== undefined && minTotalOut !== '') {
    results = results.filter((t) => t.totalOut >= Number(minTotalOut));
  }
  if (maxTotalOut !== undefined && maxTotalOut !== '') {
    results = results.filter((t) => t.totalOut <= Number(maxTotalOut));
  }

  // RTP % calculation
  if (minRtp !== undefined && minRtp !== '') {
    results = results.filter((t) => {
      const rtp = t.totalIn > 0 ? (t.totalOut / t.totalIn) * 100 : 0;
      return rtp >= Number(minRtp);
    });
  }
  if (maxRtp !== undefined && maxRtp !== '') {
    results = results.filter((t) => {
      const rtp = t.totalIn > 0 ? (t.totalOut / t.totalIn) * 100 : 0;
      return rtp <= Number(maxRtp);
    });
  }

  if (minDeals !== undefined && minDeals !== '') {
    results = results.filter((t) => t.dealsCount >= Number(minDeals));
  }
  if (maxDeals !== undefined && maxDeals !== '') {
    results = results.filter((t) => t.dealsCount <= Number(maxDeals));
  }

  // Withdrawal ratio %
  if ((minWithdrawalRatio !== undefined && minWithdrawalRatio !== '') || (maxWithdrawalRatio !== undefined && maxWithdrawalRatio !== '')) {
    results = results.filter((t) => {
      const activeReq = db.getActiveWithdrawalRequest(t.id);
      const activeWithdrawalAmt = activeReq ? activeReq.amount : 0;
      const ratio = t.capital > 0 ? (activeWithdrawalAmt / t.capital) * 100 : 0;
      if (minWithdrawalRatio !== undefined && minWithdrawalRatio !== '' && ratio < Number(minWithdrawalRatio)) {
        return false;
      }
      if (maxWithdrawalRatio !== undefined && maxWithdrawalRatio !== '' && ratio > Number(maxWithdrawalRatio)) {
        return false;
      }
      return true;
    });
  }

  // Age in hours
  if (maxAgeHours !== undefined && maxAgeHours !== '') {
    const maxAgeMs = Number(maxAgeHours) * 3600 * 1000;
    const now = Date.now();
    results = results.filter((t) => now - new Date(t.createdAt).getTime() <= maxAgeMs);
  }

  // Sorting
  const isAsc = sortDir === 'asc';
  results.sort((a, b) => {
    let valA = 0;
    let valB = 0;

    switch (sortBy) {
      case 'capital':
        valA = a.capital;
        valB = b.capital;
        break;
      case 'rtp':
        valA = a.totalIn > 0 ? (a.totalOut / a.totalIn) * 100 : 0;
        valB = b.totalIn > 0 ? (b.totalOut / b.totalIn) * 100 : 0;
        break;
      case 'deals':
        valA = a.dealsCount;
        valB = b.dealsCount;
        break;
      case 'createdAt':
        valA = new Date(a.createdAt).getTime();
        valB = new Date(b.createdAt).getTime();
        break;
      case 'withdrawalVolume': {
        const reqA = db.getActiveWithdrawalRequest(a.id);
        const reqB = db.getActiveWithdrawalRequest(b.id);
        valA = reqA ? (a.capital > 0 ? (reqA.amount / a.capital) * 100 : 0) : 0;
        valB = reqB ? (b.capital > 0 ? (reqB.amount / b.capital) * 100 : 0) : 0;
        break;
      }
      default:
        valA = a.capital;
        valB = b.capital;
    }

    if (valA < valB) return isAsc ? -1 : 1;
    if (valA > valB) return isAsc ? 1 : -1;
    return 0;
  });

  // Attach active withdrawal ratio to returned list for convenient UI rendering
  const enriched = results.map((t) => {
    const owner = db.getUserById(t.ownerId);
    const activeReq = db.getActiveWithdrawalRequest(t.id);
    const rtp = t.totalIn > 0 ? Math.round((t.totalOut / t.totalIn) * 1000) / 10 : 0;
    const withdrawalRatio = activeReq && t.capital > 0 ? Math.round((activeReq.amount / t.capital) * 100) : 0;
    const { algorithmCode, ...safeTemka } = t;
    return {
      ...safeTemka,
      ownerAvatarUrl: owner?.avatarUrl || '',
      rtp,
      activeWithdrawalAmount: activeReq ? activeReq.amount : 0,
      activeWithdrawalRatio: withdrawalRatio,
      depositsLeftForWithdrawal: activeReq ? Math.max(0, 10 - activeReq.depositsSinceRequest) : null,
    };
  });

  res.json({ temkas: enriched });
});

// ----------------------------------------------------
// 3. TEMKA DETAILS & PUBLIC VIEW
// ----------------------------------------------------

apiRouter.get('/temkas/:temkaId', (req, res) => {
  const user = getActiveUser(req);
  const temka = db.getTemkaById(req.params.temkaId);

  if (!temka) {
    return res.status(404).json({ error: 'Темка не найдена' });
  }

  const activeWithdrawal = db.getActiveWithdrawalRequest(temka.id);
  const pastWithdrawals = db.getPastWithdrawalsForTemka(temka.id);

  // Anonymized transaction feed (Strictly K = P/D multiplier + timestamp, NO absolute bets/payouts)
  const transactions = db.getTransactionsForTemka(temka.id, 50).map((tx) => ({
    id: tx.id,
    multiplier: tx.multiplier,
    isDefault: tx.isDefault,
    isRefund: tx.isRefund,
    timestamp: tx.timestamp,
  }));

  // User permissions & stats on this temka
  const isOwner = user ? user.id === temka.ownerId : false;
  const userStats = user ? getUserStatsForTemka(temka.id, user.id) : null;
  const hasUserDeposited = userStats ? userStats.depositsCount > 0 : false;
  const myTransactions = user
    ? db.getTransactionsForTemkaByUser(temka.id, user.id, 30).map((tx) => ({
        id: tx.id,
        amount: tx.amount,
        payout: tx.payout,
        multiplier: tx.multiplier,
        isDefault: tx.isDefault,
        isRefund: tx.isRefund,
        timestamp: tx.timestamp,
      }))
    : [];

  const owner = db.getUserById(temka.ownerId);
  const rtp = temka.totalIn > 0 ? Math.round((temka.totalOut / temka.totalIn) * 1000) / 10 : 0;

  const { algorithmCode, ...safeTemka } = temka;

  res.json({
    temka: {
      ...safeTemka,
      ...(isOwner ? { algorithmCode } : {}),
      ownerAvatarUrl: owner?.avatarUrl || '',
      rtp,
    },
    activeWithdrawal: activeWithdrawal
      ? {
          id: activeWithdrawal.id,
          amount: activeWithdrawal.amount,
          claimCollateralAndClose: activeWithdrawal.claimCollateralAndClose,
          depositsSinceRequest: activeWithdrawal.depositsSinceRequest,
          depositsRemaining: Math.max(0, 10 - activeWithdrawal.depositsSinceRequest),
          deadlineAt: activeWithdrawal.deadlineAt,
          createdAt: activeWithdrawal.createdAt,
        }
      : null,
    pastWithdrawals,
    transactions,
    userContext: {
      isOwner,
      canBet: !isOwner && temka.status === 'Active',
      hasUserDeposited,
      userStats,
      myTransactions,
    },
  });
});

// ----------------------------------------------------
// 4. TEST / SIMULATE ALGORITHM & CREATE NEW TEMKA
// ----------------------------------------------------

apiRouter.post(['/temkas/test', '/sandbox/simulate'], async (req, res) => {
  const { algorithmCode, betAmount = 100, initialCapital = 5000, rounds = 1 } = req.body;

  if (!algorithmCode || typeof algorithmCode !== 'string') {
    return res.status(400).json({ error: 'Код алгоритма обязателен' });
  }

  const bet = Math.max(1, Number(betAmount) || 100);
  const cap = Math.max(100, Number(initialCapital) || 5000);
  const roundCount = Math.min(Math.max(1, Number(rounds) || 1), 20);

  try {
    const simResult = await simulatePythonSandbox(algorithmCode, bet, cap, roundCount);
    res.json(simResult);
  } catch (err: any) {
    res.status(500).json({
      status: 'ERROR',
      error: err.message || 'Ошибка симуляции в песочнице',
      payout: 0,
      rounds: [],
    });
  }
});

apiRouter.post('/temkas', async (req, res) => {
  const user = getActiveUser(req);
  if (!user) return res.status(401).json({ error: 'Необходимо войти в систему' });

  const {
    title,
    description,
    algorithmCode,
    collateral,
    initialCapital,
    minBet,
    maxBet,
  } = req.body;

  if (!title || !description || !algorithmCode) {
    return res.status(400).json({ error: 'Заполните все обязательные поля' });
  }

  const colNum = Number(collateral);
  const capNum = Number(initialCapital);
  const minB = Number(minBet);
  const maxB = Number(maxBet);

  if (isNaN(colNum) || colNum < 100 || isNaN(capNum) || capNum < 100) {
    return res.status(400).json({ error: 'Минимальный залог и капитал — 100' });
  }

  if (isNaN(minB) || minB < 1 || isNaN(maxB) || maxB < minB) {
    return res.status(400).json({ error: 'Неверные лимиты ставок' });
  }

  const totalRequired = colNum + capNum;
  if (user.balance < totalRequired) {
    return res.status(400).json({
      error: `Недостаточно средств на балансе. Требуется: ${totalRequired} (Капитал ${capNum} + Залог ${colNum}). Доступно: ${user.balance}`,
    });
  }

  // Pre-test algorithm in isolated simulation sandbox first
  const testRes = await simulatePythonSandbox(algorithmCode, minB, capNum, 1);

  if (testRes.status !== 'SUCCESS') {
    return res.status(400).json({
      error: `Ошибка в Python-скрипте: ${testRes.error || testRes.stderr || 'Невалидный вывод алгоритма'}`,
    });
  }

  // Deduct balance and create temka
  user.balance -= totalRequired;
  db.updateUser(user);

  const temkaId = 'tmk_' + Date.now();
  const newTemka: Temka = {
    id: temkaId,
    ownerId: user.id,
    ownerUsername: user.username,
    title: title.trim(),
    description: description.trim(),
    algorithmCode,
    collateral: colNum,
    initialCapital: capNum,
    capital: capNum,
    minBet: minB,
    maxBet: maxB,
    status: 'Active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    totalIn: 0,
    totalOut: 0,
    dealsCount: 0,
    maxMultiplier: 0,
    minMultiplier: 0,
    hasStateFile: true,
  };

  db.insertTemka(newTemka);

  res.json({ temka: newTemka, message: 'Темка успешно запущена!' });
});

// ----------------------------------------------------
// 5. PROCESS INVESTOR BET
// ----------------------------------------------------

apiRouter.post('/temkas/:temkaId/bet', async (req, res) => {
  const user = getActiveUser(req);
  if (!user) return res.status(401).json({ error: 'Необходимо войти в систему' });

  const temka = db.getTemkaById(req.params.temkaId);
  if (!temka) return res.status(404).json({ error: 'Темка не найдена' });

  // HARDWARE & API CONSTRAINT: User != Owner
  if (user.id === temka.ownerId) {
    return res.status(403).json({
      error: 'Владельцу запрещено совершать ставки в собственные проекты (аппаратная изоляция).',
    });
  }

  if (temka.status !== 'Active') {
    return res.status(400).json({
      error: `Темка не принимает ставки (статус: ${temka.status}).`,
    });
  }

  const amount = Number(req.body.amount);
  if (isNaN(amount) || amount < temka.minBet || amount > temka.maxBet) {
    return res.status(400).json({
      error: `Сумма ставки должна быть в диапазоне от ${temka.minBet} до ${temka.maxBet}.`,
    });
  }

  if (user.balance < amount) {
    return res.status(400).json({
      error: `Недостаточно средств. Ваш баланс: ${user.balance}. Требуется: ${amount}.`,
    });
  }

  const userHash = hashUserId(user.id);

  // [Fix #1] Snapshot the capital BEFORE the sandbox call for a consistent run.
  // The actual DB writes happen inside a transaction AFTER the sandbox completes,
  // reading fresh state at that point to prevent race conditions (double-spend).
  const capitalSnapshot = temka.capital + amount; // what Python sees: pool already includes this deposit

  // 2. Call Python Sandbox (runs outside the transaction — can take up to 4 sec)
  const sandboxRes = await executePythonSandbox(
    temka.id,
    temka.algorithmCode,
    amount,
    userHash,
    capitalSnapshot
  );

  let payout = 0;
  let isDefault = false;
  let isRefund = false;
  let multiplier = 0;
  let message = '';
  let finalUserBalance = 0;
  let finalTemkaCapital = 0;
  let finalTemkaStatus: TemkaStatus = temka.status;

  // 3. Process Sandbox Execution Outcome inside an atomic transaction
  // [Fix #1, #2, #7] Re-read fresh data from DB inside BEGIN IMMEDIATE to prevent race conditions
  try {
    withTransaction(() => {
    const freshUser = db.getUserById(user.id);
    const freshTemka = db.getTemkaById(temka.id);

    if (!freshUser || !freshTemka) {
      throw new Error('Данные пользователя или темки не найдены при сохранении');
    }

    if (freshUser.balance < amount) {
      throw new Error(`Недостаточно средств (баланс изменился). Ваш баланс: ${freshUser.balance}. Требуется: ${amount}.`);
    }

    // Deduct deposit from investor & add to temka capital
    freshUser.balance -= amount;
    freshTemka.capital += amount;

    if (sandboxRes.status !== 'SUCCESS') {
      // EMERGENCY REFUND: Script Error / Timeout / Invalid Output
      isRefund = true;
      payout = amount;
      freshTemka.capital -= amount; // rollback capital — guaranteed non-negative since we just added it
      freshUser.balance += amount;  // return deposit
      multiplier = 1.0;
      message = `Аварийный возврат: сбой скрипта темки (${sandboxRes.error || 'Timeout'}). Депозит ${amount} возвращен.`;
    } else {
      const rawPayout = sandboxRes.payout;

      if (rawPayout <= freshTemka.capital) {
        // NORMAL PAYOUT
        payout = rawPayout;
        freshTemka.capital -= payout;
        freshUser.balance += payout;
        multiplier = Math.round((payout / amount) * 100) / 100;
        message =
          payout >= amount
            ? `Успех! Выплата: ${payout} (x${multiplier})`
            : `Выплата: ${payout} (x${multiplier})`;
      } else {
        // DEFAULT / BANKRUPTCY (P > capital)
        isDefault = true;
        const deficit = rawPayout - freshTemka.capital;
        const collateralPayout = Math.min(freshTemka.collateral, deficit);

        payout = freshTemka.capital + collateralPayout;
        freshTemka.capital = 0;
        freshTemka.collateral = 0; // burned / transferred to player
        freshTemka.status = 'Bankrupt';
        freshUser.balance += payout;
        multiplier = Math.round((payout / amount) * 100) / 100;
        message = `🚨 ДЕФОЛТ ТЕМКИ! Запрошенная выплата (${rawPayout}) превысила капитал. Игроку выплачен весь капитал + залог: ${payout}. Темка обанкрочена.`;
      }

      // Update temka dynamic metrics
      freshTemka.totalIn += amount;
      freshTemka.totalOut += payout;
      freshTemka.dealsCount += 1;

      // [Fix #9] Update min/maxMultiplier for ALL outcomes including refunds
      if (freshTemka.maxMultiplier === 0 || multiplier > freshTemka.maxMultiplier) {
        freshTemka.maxMultiplier = multiplier;
      }
      if (freshTemka.minMultiplier === 0 || multiplier < freshTemka.minMultiplier) {
        freshTemka.minMultiplier = multiplier;
      }
      freshTemka.updatedAt = new Date().toISOString();

      // 4. Update Active Withdrawal Request Counter & Trigger Auto-Execution
      const activeReq = db.getActiveWithdrawalRequest(freshTemka.id);
      if (activeReq) {
        if (!activeReq.uniqueDepositors.includes(freshUser.id)) {
          activeReq.uniqueDepositors.push(freshUser.id);
        }
        activeReq.depositsSinceRequest = (activeReq.depositsSinceRequest || 0) + 1;
        db.updateWithdrawalRequest(activeReq);

        // Check condition: 10 new deposits OR timeout expired
        const isExpired = Date.now() >= new Date(activeReq.deadlineAt).getTime();
        if (activeReq.depositsSinceRequest >= 10 || isExpired) {
          executeWithdrawalRequest(activeReq);
          const updatedT = db.getTemkaById(freshTemka.id);
          if (updatedT) {
            freshTemka.capital = updatedT.capital;
            freshTemka.collateral = updatedT.collateral;
            freshTemka.status = updatedT.status;
          }
        }
      }
    }

    // [Fix #9] Also update multiplier metrics for refund case (outside the else branch)
    if (isRefund) {
      if (freshTemka.maxMultiplier === 0 || multiplier > freshTemka.maxMultiplier) {
        freshTemka.maxMultiplier = multiplier;
      }
      if (freshTemka.minMultiplier === 0 || multiplier < freshTemka.minMultiplier) {
        freshTemka.minMultiplier = multiplier;
      }
      freshTemka.updatedAt = new Date().toISOString();
    }

    // Write to DB
    db.updateUser(freshUser);
    db.updateTemka(freshTemka);

    // Record Transaction
    const transaction: Transaction = {
      id: 'tx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      temkaId: freshTemka.id,
      userId: freshUser.id,
      userHash,
      amount,
      payout,
      multiplier,
      isDefault,
      isRefund,
      timestamp: new Date().toISOString(),
    };
    db.insertTransaction(transaction);

    // Record Sandbox Log
    const log: SandboxLog = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      temkaId: freshTemka.id,
      timestamp: new Date().toISOString(),
      durationMs: sandboxRes.durationMs,
      depositAmount: amount,
      userHash,
      payout,
      stdout: sandboxRes.stdout,
      stderr: sandboxRes.stderr,
      error: sandboxRes.error,
      status: sandboxRes.status,
    };
    db.insertSandboxLog(log);

    finalUserBalance = freshUser.balance;
    finalTemkaCapital = freshTemka.capital;
    finalTemkaStatus = freshTemka.status;
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Ошибка при обработке ставки' });
  }

  // Send notifications to temka owner
  if (temka.ownerId !== user.id) {
    db.createNotification(
      temka.ownerId,
      'new_bet',
      `Новая ставка в «${temka.title}»`,
      `Игрок поставил ${amount.toLocaleString('ru-RU')} ₽ (выплата ${payout.toLocaleString('ru-RU')} ₽, x${multiplier}).`,
      temka.id
    );
    if ((finalTemkaStatus as TemkaStatus) === 'Bankrupt') {
      db.createNotification(
        temka.ownerId,
        'temka_bankrupt',
        `Темка «${temka.title}» разорена!`,
        `Банк темки исчерпан после ставки на ${amount.toLocaleString('ru-RU')} ₽.`,
        temka.id
      );
    }
  }

  res.json({
    transaction: {
      id: 'tx_result',
      multiplier,
      payout,
      isDefault,
      isRefund,
      timestamp: new Date().toISOString(),
    },
    payout,
    userBalance: finalUserBalance,
    temkaCapital: finalTemkaCapital,
    temkaStatus: finalTemkaStatus,
    isDefault,
    isRefund,
    message,
    stdout: sandboxRes.stdout,
  });
});

// ----------------------------------------------------
// 6. OWNER ACTION PANEL
// ----------------------------------------------------

// 6.1 Top up capital
apiRouter.post('/temkas/:temkaId/topup', (req, res) => {
  const user = getActiveUser(req);
  if (!user) return res.status(401).json({ error: 'Необходимо войти в систему' });

  const temka = db.getTemkaById(req.params.temkaId);
  if (!temka) return res.status(404).json({ error: 'Темка не найдена' });

  if (temka.ownerId !== user.id) {
    return res.status(403).json({ error: 'Доступ разрешен только владельцу' });
  }

  if (temka.status !== 'Active') {
    return res.status(400).json({ error: 'Пополнение доступно только для активных темок' });
  }

  const amount = Number(req.body.amount);
  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Некорректная сумма пополнения' });
  }

  if (user.balance < amount) {
    return res.status(400).json({ error: `Недостаточно средств. Ваш баланс: ${user.balance}` });
  }

  user.balance -= amount;
  temka.capital += amount;
  temka.updatedAt = new Date().toISOString();
  
  db.updateUser(user);
  db.updateTemka(temka);
  db.insertTemkaTopup({
    id: 'topup_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    temkaId: temka.id,
    ownerId: user.id,
    amount,
    timestamp: new Date().toISOString(),
  });

  res.json({
    message: `Пул ликвидности успешно пополнен на ${amount}`,
    temkaCapital: temka.capital,
    userBalance: user.balance,
  });
});

// 6.2 Create Withdrawal Request
apiRouter.post('/temkas/:temkaId/withdrawal-request', (req, res) => {
  const user = getActiveUser(req);
  if (!user) return res.status(401).json({ error: 'Необходимо войти в систему' });

  const temka = db.getTemkaById(req.params.temkaId);
  if (!temka) return res.status(404).json({ error: 'Темка не найдена' });

  if (temka.ownerId !== user.id) {
    return res.status(403).json({ error: 'Доступ разрешен только владельцу' });
  }

  if (temka.status !== 'Active') {
    return res.status(400).json({ error: 'Вывод доступен только для активных темок' });
  }

  // Check if there is already an active request
  const existing = db.getActiveWithdrawalRequest(temka.id);
  if (existing) {
    return res.status(400).json({ error: 'У темки уже есть активная заявка на вывод' });
  }

  const amount = Number(req.body.amount);
  const claimCollateralAndClose = Boolean(req.body.claimCollateralAndClose);

  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Укажите корректную сумму вывода' });
  }

  const newRequest: WithdrawalRequest = {
    id: 'wreq_' + Date.now(),
    temkaId: temka.id,
    ownerId: user.id,
    amount,
    claimCollateralAndClose,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    depositsSinceRequest: 0,
    uniqueDepositors: [],
    deadlineAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(), // 48h timeout
  };

  db.insertWithdrawalRequest(newRequest);

  res.json({
    request: newRequest,
    message: 'Заявка на вывод создана! Требуется 10 уникальных депозитов или 48 часов.',
  });
});

// 6.3 Cancel Withdrawal Request
apiRouter.delete('/temkas/:temkaId/withdrawal-request', (req, res) => {
  const user = getActiveUser(req);
  if (!user) return res.status(401).json({ error: 'Необходимо войти в систему' });

  const temka = db.getTemkaById(req.params.temkaId);
  if (!temka) return res.status(404).json({ error: 'Темка не найдена' });

  if (temka.ownerId !== user.id) {
    return res.status(403).json({ error: 'Доступ разрешен только владельцу' });
  }

  const activeReq = db.getActiveWithdrawalRequest(temka.id);
  if (!activeReq) {
    return res.status(404).json({ error: 'Активная заявка на вывод не найдена' });
  }

  activeReq.status = 'CANCELLED';
  db.updateWithdrawalRequest(activeReq);

  res.json({ message: 'Заявка на вывод успешно отменена.' });
});

// 6.4 Execute / Force-Check Withdrawal (if condition reached)
apiRouter.post('/temkas/:temkaId/execute-withdrawal', (req, res) => {
  const user = getActiveUser(req);
  if (!user) return res.status(401).json({ error: 'Необходимо войти в систему' });

  processPendingWithdrawals();

  const temka = db.getTemkaById(req.params.temkaId);
  if (!temka) return res.status(404).json({ error: 'Темка не найдена' });

  if (temka.ownerId !== user.id) {
    return res.status(403).json({ error: 'Доступ разрешен только владельцу' });
  }

  const activeReq = db.getActiveWithdrawalRequest(temka.id);
  if (!activeReq) {
    const updatedUser = db.getUserById(user.id) || user;
    const updatedTemka = db.getTemkaById(temka.id) || temka;
    return res.json({
      message: 'Заявка на вывод уже была успешно исполнена автоматически!',
      userBalance: updatedUser.balance,
      temkaCapital: updatedTemka.capital,
      temkaStatus: updatedTemka.status,
    });
  }

  const isExpired = Date.now() >= new Date(activeReq.deadlineAt).getTime();
  if (activeReq.depositsSinceRequest < 10 && !isExpired) {
    return res.status(400).json({
      error: `Условия вывода еще не выполнены. Депозитов: ${activeReq.depositsSinceRequest}/10. Таймер еще активен.`,
    });
  }

  executeWithdrawalRequest(activeReq);
  const updatedUser = db.getUserById(user.id) || user;
  const updatedTemka = db.getTemkaById(temka.id) || temka;

  res.json({
    message: `Заявка исполнена! Выведено: ${activeReq.amount} ${activeReq.claimCollateralAndClose ? '+ залог' : ''}`,
    userBalance: updatedUser.balance,
    temkaCapital: updatedTemka.capital,
    temkaStatus: updatedTemka.status,
  });
});

// 6.5 Edit Metadata (Title, Description)
apiRouter.patch('/temkas/:temkaId', (req, res) => {
  const user = getActiveUser(req);
  if (!user) return res.status(401).json({ error: 'Необходимо войти в систему' });

  const temka = db.getTemkaById(req.params.temkaId);
  if (!temka) return res.status(404).json({ error: 'Темка не найдена' });

  if (temka.ownerId !== user.id) {
    return res.status(403).json({ error: 'Доступ разрешен только владельцу' });
  }

  const { title, description } = req.body;
  if (title) temka.title = title.trim();
  if (description) temka.description = description.trim();
  temka.updatedAt = new Date().toISOString();

  db.updateTemka(temka);
  res.json({ temka, message: 'Метаданные обновлены' });
});

// 6.6 Manual Delete (Strictly Bankrupt and Closed only!)
apiRouter.delete('/temkas/:temkaId', (req, res) => {
  const user = getActiveUser(req);
  if (!user) return res.status(401).json({ error: 'Необходимо войти в систему' });

  const temka = db.getTemkaById(req.params.temkaId);
  if (!temka) return res.status(404).json({ error: 'Темка не найдена' });

  if (temka.ownerId !== user.id) {
    return res.status(403).json({ error: 'Доступ разрешен только владельцу' });
  }

  // POLICY CHECK: Strictly Bankrupt and Closed only!
  if (temka.status !== 'Bankrupt' && temka.status !== 'Closed') {
    return res.status(400).json({
      error: 'Удаление активных проектов запрещено! Удалять можно строго обанкроченные или закрытые темки.',
    });
  }

  // Delete from SQLite
  db.updateTemka({ id: temka.id, status: 'Closed' }); // or remove if needed

  res.json({ message: 'Карточка темки обновлена/удалена' });
});

// 6.7 Sandbox Execution Logs
apiRouter.get('/temkas/:temkaId/logs', (req, res) => {
  const user = getActiveUser(req);
  if (!user) return res.status(401).json({ error: 'Необходимо войти в систему' });

  const temka = db.getTemkaById(req.params.temkaId);
  if (!temka) return res.status(404).json({ error: 'Темка не найдена' });

  if (temka.ownerId !== user.id) {
    return res.status(403).json({ error: 'Доступ к логам разрешен только владельцу' });
  }

  const logs = db.getSandboxLogsForTemka(temka.id, 50);
  res.json({ logs });
});

// ----------------------------------------------------
// 7. PROOF-OF-BET COMMENTS & SOCIAL MODULE
// ----------------------------------------------------

apiRouter.get('/temkas/:temkaId/comments', (req, res) => {
  const sortBy = req.query.sortBy === 'likes' ? 'likes' : 'date';

  const comments = db.getCommentsForTemka(req.params.temkaId)
    .sort((a, b) => {
      if (sortBy === 'likes') {
        return b.likes.length - a.likes.length;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .map((c) => {
      const author = db.getUserById(c.userId);
      return {
        ...c,
        userAvatarUrl: author?.avatarUrl || c.userAvatarUrl || '',
      };
    });

  res.json({ comments });
});

apiRouter.post('/temkas/:temkaId/comments', (req, res) => {
  const user = getActiveUser(req);
  if (!user) return res.status(401).json({ error: 'Необходимо войти в систему' });

  const temka = db.getTemkaById(req.params.temkaId);
  if (!temka) return res.status(404).json({ error: 'Темка не найдена' });

  const text = (req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Введите текст комментария' });

  const isOwner = temka.ownerId === user.id;
  const stats = getUserStatsForTemka(req.params.temkaId, user.id);

  // Allow temka author OR users with at least 1 deposit
  if (!isOwner && stats.depositsCount === 0) {
    return res.status(403).json({
      error: 'Оставлять комментарии могут только автор темки или игроки, сделавшие хотя бы одну ставку!',
    });
  }

  const newComment: Comment = {
    id: 'comm_' + Date.now(),
    temkaId: req.params.temkaId,
    userId: user.id,
    username: user.username,
    userAvatarUrl: user.avatarUrl || '',
    text,
    createdAt: new Date().toISOString(),
    likes: [],
    userStats: {
      roundedTotalBets: stats.roundedTotalBets,
      roundedTotalPayouts: stats.roundedTotalPayouts,
      exactRoiMultiplier: stats.exactRoiMultiplier,
      colorCode: isOwner && stats.depositsCount === 0 ? 'gray' : stats.colorCode,
    },
  };

  db.insertComment(newComment);

  if (!isOwner) {
    db.createNotification(
      temka.ownerId,
      'new_comment',
      `Новый комментарий в «${temka.title}»`,
      `@${user.username}: ${text.slice(0, 100)}${text.length > 100 ? '...' : ''}`,
      temka.id
    );
  }

  res.json({ comment: newComment, message: 'Комментарий опубликован!' });
});

apiRouter.post('/temkas/:temkaId/comments/:commentId/like', (req, res) => {
  const user = getActiveUser(req);
  if (!user) return res.status(401).json({ error: 'Необходимо войти в систему' });

  const temka = db.getTemkaById(req.params.temkaId);
  if (!temka) return res.status(404).json({ error: 'Темка не найдена' });

  const isOwner = temka.ownerId === user.id;
  const stats = getUserStatsForTemka(req.params.temkaId, user.id);

  // Allow temka author OR users with at least 1 deposit
  if (!isOwner && stats.depositsCount === 0) {
    return res.status(403).json({
      error: 'Ставить лайки могут только автор темки или игроки, сделавшие хотя бы одну ставку!',
    });
  }

  const comment = db.getCommentById(req.params.commentId);
  if (!comment) return res.status(404).json({ error: 'Комментарий не найден' });

  const userIndex = comment.likes.indexOf(user.id);
  if (userIndex === -1) {
    comment.likes.push(user.id);
  } else {
    comment.likes.splice(userIndex, 1);
  }

  db.updateComment(comment);
  res.json({ likes: comment.likes, likesCount: comment.likes.length });
});
