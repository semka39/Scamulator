import { db, hashUserId } from './db.js';
import { getTemkaStateDir } from './sandbox.js';
import fs from 'fs';
import path from 'path';

export function seedInitialData() {
  const existingUsers = db.getAllUsers();
  if (existingUsers.length > 0) {
    return; // already seeded
  }

  console.log('🌱 Seeding initial platform data to SQLite (users, temkas, algorithms, transactions, comments)...');

  const now = Date.now();
  const h = 3600 * 1000;
  const d = 24 * h;

  // 1. Users
  const users = [
    {
      id: 'usr_wolf',
      username: 'crypto_wolf',
      passwordHash: 'wolf2026',
      balance: 75000,
      createdAt: new Date(now - 30 * d).toISOString(),
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      bio: 'Опытный архитектор алгоритмических смарт-пулов. Управляю ликвидностью с 2022 года.',
    },
    {
      id: 'usr_quant',
      username: 'smart_quant',
      passwordHash: 'quant999',
      balance: 42000,
      createdAt: new Date(now - 45 * d).toISOString(),
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
      bio: 'Quantitative finance & stochastic algorithms. Создаю математически устойчивые смарт-контракты.',
    },
    {
      id: 'usr_degen',
      username: 'degen_trader',
      passwordHash: 'degen123',
      balance: 18500,
      createdAt: new Date(now - 14 * d).toISOString(),
      avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
      bio: 'Охотник за иксами и опасными пулами. Риск 100% — прибыль x10.',
    },
    {
      id: 'usr_scam',
      username: 'newbie_scammer',
      passwordHash: 'scam404',
      balance: 9200,
      createdAt: new Date(now - 5 * d).toISOString(),
      avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80',
      bio: 'Тестирую вирусные механики и агрессивные мультипликаторы.',
    },
    {
      id: 'usr_investor',
      username: 'investor_pro',
      passwordHash: 'invest777',
      balance: 160000,
      createdAt: new Date(now - 60 * d).toISOString(),
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
      bio: 'Крупный венчурный инвестор. Анализирую скрипты на устойчивость перед крупным депозитом.',
    },
  ];

  for (const u of users) {
    db.insertUser(u);
  }

  // 2. Temkas & Python Algorithms
  const temkas = [
    {
      id: 'tmk_whale_treasury',
      ownerId: 'usr_wolf',
      ownerUsername: 'crypto_wolf',
      title: 'Китовый Пул Ликвидности v3',
      description: 'Масштабный пул институционального уровня с многоуровневым кэшбэком и джекпот-генератором для крупных ставок.',
      algorithmCode: `# Китовый алгоритм с накопительным джекпотом и сохранением состояния
state = load_state()
if "total_pool_volume" not in state:
    state["total_pool_volume"] = 0
if "jackpot_pool" not in state:
    state["jackpot_pool"] = 1000

state["total_pool_volume"] += amount
jackpot_cut = int(amount * 0.05)
state["jackpot_pool"] += jackpot_cut

# Базовый коэффициент
multiplier = 1.08

# VIP Бонус для крупных ставок
if amount >= 2000:
    multiplier = 1.25

# 15% шанс сорвать накопительный джекпот
lucky_seed = random.randint(1, 100)
jackpot_win = 0
if lucky_seed <= 15 and state["jackpot_pool"] > 500:
    jackpot_win = int(state["jackpot_pool"] * 0.4)
    state["jackpot_pool"] -= jackpot_win
    print(f"[JACKPOT TRIGGERED] User won {jackpot_win} bonus!")

save_state(state)
return int(amount * multiplier) + jackpot_win`,
      collateral: 12000,
      initialCapital: 25000,
      capital: 38400,
      minBet: 500,
      maxBet: 5000,
      status: 'Active' as const,
      createdAt: new Date(now - 12 * d).toISOString(),
      updatedAt: new Date(now - 1 * h).toISOString(),
      totalIn: 64000,
      totalOut: 50600,
      dealsCount: 28,
      maxMultiplier: 1.65,
      minMultiplier: 1.08,
      hasStateFile: true,
    },
    {
      id: 'tmk_liquidation_zone',
      ownerId: 'usr_degen',
      ownerUsername: 'degen_trader',
      title: 'Зона Ликвидации 85%',
      description: 'Сверхрисковый смарт-контракт! Владелец подал заявку на вывод 85% капитала. Осталось всего 3 депозита до исполнения!',
      algorithmCode: `# Рискованный алгоритм ликвидационной зоны
state = load_state()
streak = state.get("streak", 0)

# Высокая волатильность
dice = random.random()
if dice < 0.45:
    # Игрок побеждает
    multiplier = 1.60
    state["streak"] = streak + 1
else:
    # Защитный срез капитала
    multiplier = 0.40
    state["streak"] = 0

# Защита от опустошения
if current_capital < 2000:
    multiplier = 0.20

save_state(state)
return int(amount * multiplier)`,
      collateral: 4000,
      initialCapital: 8000,
      capital: 9500,
      minBet: 100,
      maxBet: 1500,
      status: 'Active' as const,
      createdAt: new Date(now - 4 * d).toISOString(),
      updatedAt: new Date(now - 20 * 60 * 1000).toISOString(),
      totalIn: 22000,
      totalOut: 20500,
      dealsCount: 18,
      maxMultiplier: 1.60,
      minMultiplier: 0.20,
      hasStateFile: true,
    },
    {
      id: 'tmk_golden_vein',
      ownerId: 'usr_quant',
      ownerUsername: 'smart_quant',
      title: 'Золотая Жила (Квантовый RTP 94%)',
      description: 'Математически выверенный алгоритм с предсказуемым распределением Гаусса и нулевой комиссией на первые 3 раунда.',
      algorithmCode: `# Квантовый генератор с динамической подстройкой RTP
state = load_state()
user_history = state.get(user_hash, {"count": 0, "won": 0})

user_history["count"] += 1
count = user_history["count"]

# Первые 3 ставки дают повышенный множитель новичка
if count <= 3:
    multiplier = 1.20
    print(f"Welcome bonus multiplier 1.20x applied for {user_hash}")
else:
    # Стохастическое распределение с матожиданием 0.94
    base = random.uniform(0.70, 1.20)
    multiplier = round(base, 2)

state[user_hash] = user_history
save_state(state)
return int(amount * multiplier)`,
      collateral: 8000,
      initialCapital: 20000,
      capital: 24800,
      minBet: 200,
      maxBet: 3000,
      status: 'Active' as const,
      createdAt: new Date(now - 20 * d).toISOString(),
      updatedAt: new Date(now - 2 * h).toISOString(),
      totalIn: 52000,
      totalOut: 47200,
      dealsCount: 35,
      maxMultiplier: 1.20,
      minMultiplier: 0.70,
      hasStateFile: true,
    },
    {
      id: 'tmk_meat_grinder',
      ownerId: 'usr_scam',
      ownerUsername: 'newbie_scammer',
      title: 'Мясорубка 2000',
      description: 'Агрессивная темка с диким разбросом: либо 3.0x, либо ликвидация до 0.25x. Заходи, если смелый.',
      algorithmCode: `# Агрессивный срез
roll = random.randint(1, 100)
if roll <= 25:
    return int(amount * 3.0)
elif roll <= 50:
    return int(amount * 1.1)
else:
    return int(amount * 0.25)`,
      collateral: 3000,
      initialCapital: 6000,
      capital: 7400,
      minBet: 50,
      maxBet: 1000,
      status: 'Active' as const,
      createdAt: new Date(now - 2 * d).toISOString(),
      updatedAt: new Date(now - 4 * h).toISOString(),
      totalIn: 15400,
      totalOut: 14000,
      dealsCount: 22,
      maxMultiplier: 3.0,
      minMultiplier: 0.25,
      hasStateFile: false,
    },
    {
      id: 'tmk_fresh_blood',
      ownerId: 'usr_wolf',
      ownerUsername: 'crypto_wolf',
      title: 'Свежая Кровь (NEW)',
      description: 'Только что созданный смарт-пул. Первые инвесторы получают фиксированные 1.15x выплаты.',
      algorithmCode: `state = load_state()
total_early_bets = state.get("early_bets", 0) + 1
state["early_bets"] = total_early_bets
save_state(state)

if total_early_bets <= 10:
    return int(amount * 1.15)
else:
    return int(amount * 0.95)`,
      collateral: 5000,
      initialCapital: 10000,
      capital: 10000,
      minBet: 100,
      maxBet: 2000,
      status: 'Active' as const,
      createdAt: new Date(now - 3 * h).toISOString(),
      updatedAt: new Date(now - 3 * h).toISOString(),
      totalIn: 0,
      totalOut: 0,
      dealsCount: 0,
      maxMultiplier: 0,
      minMultiplier: 0,
      hasStateFile: true,
    },
    {
      id: 'tmk_ponzi_bankrupt',
      ownerId: 'usr_scam',
      ownerUsername: 'newbie_scammer',
      title: 'Пирамида Судного Дня [ОБАНКРОЧЕНА]',
      description: 'Проект обанкротился! Алгоритм запросил 5.0x выплату при пустом пуле ликвидности. Залог и остаток пула полностью сожжены и выплачены победителю.',
      algorithmCode: `return int(amount * 5.0)`,
      collateral: 0,
      initialCapital: 5000,
      capital: 0,
      minBet: 500,
      maxBet: 5000,
      status: 'Bankrupt' as const,
      createdAt: new Date(now - 10 * d).toISOString(),
      updatedAt: new Date(now - 5 * d).toISOString(),
      totalIn: 28000,
      totalOut: 33000,
      dealsCount: 14,
      maxMultiplier: 5.0,
      minMultiplier: 0.5,
      hasStateFile: false,
    },
    {
      id: 'tmk_closed_alpha',
      ownerId: 'usr_quant',
      ownerUsername: 'smart_quant',
      title: 'Закрытый Альфа-Фонд (Успешно Закрыт)',
      description: 'Сезон 1 завершен. Автор успешно вывел заработанную прибыль и забрал первоначальный залог после исполнения протокола 10 депозитов.',
      algorithmCode: `return int(amount * 1.05)`,
      collateral: 0,
      initialCapital: 15000,
      capital: 3200,
      minBet: 100,
      maxBet: 1000,
      status: 'Closed' as const,
      createdAt: new Date(now - 25 * d).toISOString(),
      updatedAt: new Date(now - 15 * d).toISOString(),
      totalIn: 45000,
      totalOut: 39000,
      dealsCount: 40,
      maxMultiplier: 1.05,
      minMultiplier: 1.05,
      hasStateFile: false,
    },
  ];

  for (const t of temkas) {
    db.insertTemka(t);
  }

  // Pre-seed state files
  const stateFiles = [
    {
      temkaId: 'tmk_whale_treasury',
      state: { total_pool_volume: 64000, jackpot_pool: 4200 },
    },
    {
      temkaId: 'tmk_liquidation_zone',
      state: { streak: 1 },
    },
    {
      temkaId: 'tmk_golden_vein',
      state: {
        [hashUserId('usr_investor')]: { count: 12, won: 13500 },
        [hashUserId('usr_degen')]: { count: 4, won: 4200 },
      },
    },
    {
      temkaId: 'tmk_fresh_blood',
      state: { early_bets: 0 },
    },
  ];

  for (const sf of stateFiles) {
    try {
      const dir = getTemkaStateDir(sf.temkaId);
      fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(sf.state, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to pre-seed state file for', sf.temkaId, e);
    }
  }

  // 3. Transactions
  const transactions = [
    {
      id: 'tx_1',
      temkaId: 'tmk_whale_treasury',
      userId: 'usr_investor',
      userHash: hashUserId('usr_investor'),
      amount: 4000,
      payout: 5000,
      multiplier: 1.25,
      isDefault: false,
      isRefund: false,
      timestamp: new Date(now - 45 * 60 * 1000).toISOString(),
    },
    {
      id: 'tx_2',
      temkaId: 'tmk_whale_treasury',
      userId: 'usr_degen',
      userHash: hashUserId('usr_degen'),
      amount: 2500,
      payout: 4125,
      multiplier: 1.65,
      isDefault: false,
      isRefund: false,
      timestamp: new Date(now - 2 * h).toISOString(),
    },
    {
      id: 'tx_3',
      temkaId: 'tmk_whale_treasury',
      userId: 'usr_scam',
      userHash: hashUserId('usr_scam'),
      amount: 500,
      payout: 540,
      multiplier: 1.08,
      isDefault: false,
      isRefund: false,
      timestamp: new Date(now - 5 * h).toISOString(),
    },
    {
      id: 'tx_4',
      temkaId: 'tmk_liquidation_zone',
      userId: 'usr_investor',
      userHash: hashUserId('usr_investor'),
      amount: 1500,
      payout: 2400,
      multiplier: 1.60,
      isDefault: false,
      isRefund: false,
      timestamp: new Date(now - 10 * 60 * 1000).toISOString(),
    },
    {
      id: 'tx_5',
      temkaId: 'tmk_liquidation_zone',
      userId: 'usr_wolf',
      userHash: hashUserId('usr_wolf'),
      amount: 1000,
      payout: 400,
      multiplier: 0.40,
      isDefault: false,
      isRefund: false,
      timestamp: new Date(now - 25 * 60 * 1000).toISOString(),
    },
    {
      id: 'tx_6',
      temkaId: 'tmk_golden_vein',
      userId: 'usr_investor',
      userHash: hashUserId('usr_investor'),
      amount: 2000,
      payout: 2400,
      multiplier: 1.20,
      isDefault: false,
      isRefund: false,
      timestamp: new Date(now - 3 * h).toISOString(),
    },
    {
      id: 'tx_7',
      temkaId: 'tmk_golden_vein',
      userId: 'usr_degen',
      userHash: hashUserId('usr_degen'),
      amount: 1000,
      payout: 1080,
      multiplier: 1.08,
      isDefault: false,
      isRefund: false,
      timestamp: new Date(now - 6 * h).toISOString(),
    },
    {
      id: 'tx_8',
      temkaId: 'tmk_meat_grinder',
      userId: 'usr_degen',
      userHash: hashUserId('usr_degen'),
      amount: 800,
      payout: 200,
      multiplier: 0.25,
      isDefault: false,
      isRefund: false,
      timestamp: new Date(now - 35 * 60 * 1000).toISOString(),
    },
    {
      id: 'tx_9',
      temkaId: 'tmk_ponzi_bankrupt',
      userId: 'usr_investor',
      userHash: hashUserId('usr_investor'),
      amount: 5000,
      payout: 10000,
      multiplier: 2.0,
      isDefault: true,
      isRefund: false,
      timestamp: new Date(now - 5 * d).toISOString(),
    },
  ];

  for (const tx of transactions) {
    db.insertTransaction(tx);
  }

  // 4. Active Withdrawal Requests
  const wreq = {
    id: 'wreq_liquidation_1',
    temkaId: 'tmk_liquidation_zone',
    ownerId: 'usr_degen',
    amount: 8000, // 85% of 9500 capital
    claimCollateralAndClose: false,
    status: 'PENDING' as const,
    createdAt: new Date(now - 6 * h).toISOString(),
    depositsSinceRequest: 7, // 7 of 10 done!
    uniqueDepositors: ['usr_investor', 'usr_wolf'],
    deadlineAt: new Date(now + 42 * h).toISOString(),
  };
  db.insertWithdrawalRequest(wreq);

  // 5. Past Withdrawals
  const pastW = {
    id: 'pw_alpha_1',
    temkaId: 'tmk_closed_alpha',
    amount: 18000,
    claimedCollateral: true,
    timestamp: new Date(now - 15 * d).toISOString(),
  };
  db.insertPastWithdrawal(pastW);

  // 6. Comments (Proof-of-Bet)
  const comments = [
    {
      id: 'comm_1',
      temkaId: 'tmk_golden_vein',
      userId: 'usr_investor',
      username: 'investor_pro',
      text: 'Прогнал через пул более 15 депозитов. Квант реально настроил положительный математический баланс, на дистанции профит стабильно +12%. Респект создателю!',
      createdAt: new Date(now - 2 * h).toISOString(),
      likes: ['usr_wolf', 'usr_degen'],
      userStats: {
        roundedTotalBets: 15000,
        roundedTotalPayouts: 17000,
        exactRoiMultiplier: 1.16,
        colorCode: 'green' as const,
      },
    },
    {
      id: 'comm_2',
      temkaId: 'tmk_whale_treasury',
      userId: 'usr_degen',
      username: 'degen_trader',
      text: 'Вчера залетел джекпот на 1.65x! Пул тяжелый, выплачивает моментально без задержек. Слежу за очередью выводов Волка.',
      createdAt: new Date(now - 1 * d).toISOString(),
      likes: ['usr_investor'],
      userStats: {
        roundedTotalBets: 3000,
        roundedTotalPayouts: 4000,
        exactRoiMultiplier: 1.42,
        colorCode: 'green' as const,
      },
    },
    {
      id: 'comm_3',
      temkaId: 'tmk_meat_grinder',
      userId: 'usr_degen',
      username: 'degen_trader',
      text: 'Название оправдывает себя на 100% 💀 Поймал 3 подряд среза по 0.25x. Не суйтесь сюда без стальных нервов.',
      createdAt: new Date(now - 30 * 60 * 1000).toISOString(),
      likes: ['usr_scam'],
      userStats: {
        roundedTotalBets: 4000,
        roundedTotalPayouts: 1000,
        exactRoiMultiplier: 0.25,
        colorCode: 'red' as const,
      },
    },
  ];

  for (const c of comments) {
    db.insertComment(c);
  }

  // 7. Sandbox Logs
  const sandboxLogs = [
    {
      id: 'log_1',
      temkaId: 'tmk_whale_treasury',
      timestamp: new Date(now - 45 * 60 * 1000).toISOString(),
      durationMs: 18,
      depositAmount: 4000,
      userHash: hashUserId('usr_investor'),
      payout: 5000,
      stdout: '[JACKPOT TRIGGERED] User won 0 bonus!\n',
      stderr: '',
      status: 'SUCCESS' as const,
    },
    {
      id: 'log_2',
      temkaId: 'tmk_liquidation_zone',
      timestamp: new Date(now - 10 * 60 * 1000).toISOString(),
      durationMs: 14,
      depositAmount: 1500,
      userHash: hashUserId('usr_investor'),
      payout: 2400,
      stdout: '',
      stderr: '',
      status: 'SUCCESS' as const,
    },
  ];

  for (const l of sandboxLogs) {
    db.insertSandboxLog(l);
  }

  console.log('✅ Initial platform data seeded successfully into SQLite!');
}
