import 'dotenv/config';
import prompts from 'prompts';
import { db, sqlite } from './db.js';
import { User, PromoCode } from './types.js';

const args = process.argv.slice(2);
const command = (args[0] || '').toLowerCase().trim();

function printHelp() {
  console.log(`
================================================================
          🛠️  TEMSHCHIK / SCAMULATOR ADMIN CLI  🛠️
================================================================

💻 ИНТЕРАКТИВНОЕ МЕНЮ (с динамическим поиском и стрелочками):
   npm run admin
   или:
   npm run admin:interactive

----------------------------------------------------------------
⚡ ПРЯМЫЕ КОМАНДЫ (для скриптов и быстрой работы):

1. 🎟️ Создать промокод:
   npm run admin promo:create <КОД> <СУММА> <АКТИВАЦИЙ>
   Пример: npm run admin promo:create BONUS1000 1000 50

2. 📋 Список промокодов:
   npm run admin promo:list

3. 🗑️ Удалить промокод (сбрасывает использования у юзеров):
   npm run admin promo:delete <КОД>
   Пример: npm run admin promo:delete BONUS1000

4. 💰 Выдать деньги пользователю:
   npm run admin:give-money -- <username_или_id> <сумма>
   Пример: npm run admin:give-money -- trader_neo 50000

5. ⚖️ Установить точный баланс:
   npm run admin set-balance <username_или_id> <сумма>

6. 🚫 Забанить аккаунт:
   npm run admin:ban -- <username_или_id> [причина]

7. 🟢 Разбанить аккаунт:
   npm run admin:unban -- <username_или_id>

8. 📋 Список пользователей:
   npm run admin list

9. 📊 Статистика платформы:
   npm run admin status

10. 🗑️ Полная очистка БД:
    npm run db:clear
================================================================
`);
}

// ----------------------------------------------------
// DYNAMIC AUTOCOMPLETE HELPERS
// ----------------------------------------------------

async function promptSelectUser(message: string): Promise<User | null> {
  const users = db.getAllUsers();
  if (users.length === 0) {
    console.log('⚠️ Нет зарегистрированных пользователей в базе данных.');
    return null;
  }

  const response = await prompts({
    type: 'autocomplete',
    name: 'user',
    message,
    choices: users.map((u) => ({
      title: `@${u.username.padEnd(16)} | Баланс: ${u.balance.toLocaleString('ru-RU').padStart(10)} ₽ ${u.isBanned ? '🚫 [ЗАБАНЕН]' : '🟢'} (ID: ${u.id})`,
      value: u,
    })),
    suggest: (input, choices) => {
      const q = (input || '').toLowerCase();
      return Promise.resolve(choices.filter((c) => c.title.toLowerCase().includes(q)));
    },
  });

  return response.user || null;
}

async function promptSelectPromoCode(message: string): Promise<PromoCode | null> {
  const promos = db.getAllPromoCodes();
  if (promos.length === 0) {
    console.log('⚠️ В базе данных пока нет созданных промокодов.');
    return null;
  }

  const response = await prompts({
    type: 'autocomplete',
    name: 'promo',
    message,
    choices: promos.map((p) => {
      const isExhausted = p.usedCount >= p.maxActivations;
      const statusLabel = isExhausted ? '🔴 ИСЧЕРПАН' : '🟢 АКТИВЕН';
      return {
        title: `${p.code.padEnd(14)} | +${p.amount.toLocaleString('ru-RU').padStart(8)} ₽ | Использовано: ${p.usedCount}/${p.maxActivations} [${statusLabel}]`,
        value: p,
      };
    }),
    suggest: (input, choices) => {
      const q = (input || '').toLowerCase();
      return Promise.resolve(choices.filter((c) => c.title.toLowerCase().includes(q)));
    },
  });

  return response.promo || null;
}

// ----------------------------------------------------
// INTERACTIVE CLI MENU
// ----------------------------------------------------

async function runInteractive() {
  console.clear();
  console.log(`
================================================================
          🛠️  TEMSHCHIK / SCAMULATOR ADMIN CLI  🛠️
================================================================
Управление через стрелочки ↑/↓, Enter для выбора.
В меню поиска начните печатать для фильтрации вариантов.
`);

  let active = true;

  while (active) {
    const { action } = await prompts({
      type: 'select',
      name: 'action',
      message: 'Выберите операцию:',
      choices: [
        { title: '🎟️  Промокоды: Создать новый промокод', value: 'promo_create' },
        { title: '📋  Промокоды: Список всех промокодов', value: 'promo_list' },
        { title: '🗑️  Промокоды: Удалить промокод (динамический поиск)', value: 'promo_delete' },
        { title: '💰  Пользователи: Изменить баланс / Выдать деньги (динамический поиск)', value: 'give_money' },
        { title: '⚖️  Пользователи: Установить точный баланс (динамический поиск)', value: 'set_balance' },
        { title: '🚫  Пользователи: Забанить аккаунт (динамический поиск)', value: 'ban_user' },
        { title: '🟢  Пользователи: Разбанить аккаунт (динамический поиск)', value: 'unban_user' },
        { title: '👥  Пользователи: Показать всех пользователей', value: 'list_users' },
        { title: '📊  Платформа: Общая статистика', value: 'status' },
        { title: '🧨  Платформа: Полная очистка базы данных', value: 'clear_db' },
        { title: '🚪  Выход', value: 'exit' },
      ],
      initial: 0,
    });

    if (!action || action === 'exit') {
      console.log('\n👋 До свидания!\n');
      process.exit(0);
    }

    console.log('');

    switch (action) {
      case 'promo_create': {
        const input = await prompts([
          {
            type: 'text',
            name: 'code',
            message: 'Введите промокод (например: WELCOME1000):',
            validate: (val) => (val && val.trim().length >= 2 ? true : 'Минимум 2 символа'),
          },
          {
            type: 'number',
            name: 'amount',
            message: 'Сумма начисления пользователю (₽):',
            validate: (val) => (val > 0 ? true : 'Сумма должна быть больше 0'),
          },
          {
            type: 'number',
            name: 'maxActivations',
            message: 'Максимальное количество активаций (всего):',
            initial: 50,
            validate: (val) => (val > 0 ? true : 'Количество должно быть больше 0'),
          },
        ]);

        if (!input.code || !input.amount || !input.maxActivations) {
          console.log('❌ Операция создания отменена.');
          break;
        }

        const res = db.createPromoCode(input.code, input.amount, input.maxActivations);
        if (!res.success || !res.promo) {
          console.error(`❌ Ошибка: ${res.error}`);
        } else {
          console.log(`\n✅ Промокод успешно создан!`);
          console.log(`🎟️  Код: ${res.promo.code}`);
          console.log(`💵 Сумма: +${res.promo.amount.toLocaleString('ru-RU')} ₽`);
          console.log(`🎯 Лимит активаций: ${res.promo.maxActivations}`);
          console.log(`⏰ Создан: ${new Date(res.promo.createdAt).toLocaleString()}\n`);
        }
        break;
      }

      case 'promo_list': {
        printPromoList();
        break;
      }

      case 'promo_delete': {
        const selected = await promptSelectPromoCode('Выберите промокод для удаления (вводите код для поиска):');
        if (!selected) {
          console.log('Операция отменена.');
          break;
        }

        const confirm = await prompts({
          type: 'confirm',
          name: 'yes',
          message: `Точно удалить промокод "${selected.code}"? Это сбросит историю его активаций у пользователей.`,
          initial: false,
        });

        if (!confirm.yes) {
          console.log('Удаление отменено.');
          break;
        }

        const res = db.deletePromoCode(selected.code);
        if (!res.success) {
          console.error(`❌ Ошибка: ${res.error}`);
        } else {
          console.log(`\n✅ Промокод "${selected.code}" успешно удалён!`);
          console.log(`🔄 История активаций промокода сброшена. Если создать его заново, пользователи смогут использовать его повторно.\n`);
        }
        break;
      }

      case 'give_money': {
        const user = await promptSelectUser('Выберите пользователя для изменения баланса (поиск по имени):');
        if (!user) break;

        const input = await prompts({
          type: 'number',
          name: 'amount',
          message: `Текущий баланс @${user.username}: ${user.balance.toLocaleString('ru-RU')} ₽. Введите сумму (например 25000 или -5000):`,
          validate: (val) => (!isNaN(val) && val !== 0 ? true : 'Введите ненулевое число'),
        });

        if (input.amount === undefined) break;

        const res = db.giveMoney(user.id, input.amount);
        if (!res.success || !res.user) {
          console.error(`❌ Ошибка: ${res.error}`);
        } else {
          console.log(`\n✅ Баланс успешно обновлен!`);
          console.log(`👤 Пользователь: @${res.user.username}`);
          console.log(`💵 Было: ${res.previousBalance?.toLocaleString('ru-RU')} ₽`);
          console.log(`➕ Изменение: ${input.amount > 0 ? '+' : ''}${input.amount.toLocaleString('ru-RU')} ₽`);
          console.log(`💰 Новый баланс: ${res.user.balance.toLocaleString('ru-RU')} ₽\n`);
        }
        break;
      }

      case 'set_balance': {
        const user = await promptSelectUser('Выберите пользователя для установки баланса (поиск по имени):');
        if (!user) break;

        const input = await prompts({
          type: 'number',
          name: 'amount',
          message: `Текущий баланс @${user.username}: ${user.balance.toLocaleString('ru-RU')} ₽. Введите точную сумму нового баланса:`,
          validate: (val) => (val >= 0 ? true : 'Баланс не может быть отрицательным'),
        });

        if (input.amount === undefined) break;

        const res = db.setBalance(user.id, input.amount);
        if (!res.success || !res.user) {
          console.error(`❌ Ошибка: ${res.error}`);
        } else {
          console.log(`\n✅ Баланс установлен!`);
          console.log(`👤 Пользователь: @${res.user.username}`);
          console.log(`💰 Новый баланс: ${res.user.balance.toLocaleString('ru-RU')} ₽\n`);
        }
        break;
      }

      case 'ban_user': {
        const user = await promptSelectUser('Выберите пользователя для блокировки (поиск по имени):');
        if (!user) break;

        if (user.isBanned) {
          console.log(`⚠️ Пользователь @${user.username} уже заблокирован (причина: ${user.banReason || 'Без причины'}).`);
          break;
        }

        const input = await prompts({
          type: 'text',
          name: 'reason',
          message: 'Укажите причину блокировки:',
          initial: 'Нарушение правил платформы',
        });

        const res = db.banUser(user.id, input.reason || 'Нарушение правил платформы');
        if (!res.success || !res.user) {
          console.error(`❌ Ошибка: ${res.error}`);
        } else {
          console.log(`\n🚫 Пользователь @${res.user.username} успешно заблокирован!`);
          console.log(`📝 Причина бана: "${input.reason}"\n`);
        }
        break;
      }

      case 'unban_user': {
        const user = await promptSelectUser('Выберите пользователя для разблокировки (поиск по имени):');
        if (!user) break;

        if (!user.isBanned) {
          console.log(`⚠️ Пользователь @${user.username} не заблокирован.`);
          break;
        }

        const res = db.unbanUser(user.id);
        if (!res.success || !res.user) {
          console.error(`❌ Ошибка: ${res.error}`);
        } else {
          console.log(`\n🟢 Пользователь @${res.user.username} успешно разблокирован!\n`);
        }
        break;
      }

      case 'list_users': {
        printUserList();
        break;
      }

      case 'status': {
        printStatus();
        break;
      }

      case 'clear_db': {
        const confirm = await prompts({
          type: 'confirm',
          name: 'yes',
          message: '⚠️ ВНИМАНИЕ: Вы действительно хотите полностью очистить базу данных? Все данные будут удалены.',
          initial: false,
        });

        if (confirm.yes) {
          db.clearDatabase();
          console.log('\n✅ База данных полностью очищена! Все таблицы сброшены.\n');
        } else {
          console.log('Очистка базы данных отменена.');
        }
        break;
      }
    }

    console.log('----------------------------------------------------------------');
  }
}

// ----------------------------------------------------
// PRINT HELPERS
// ----------------------------------------------------

function printPromoList() {
  const promos = db.getAllPromoCodes();
  console.log(`\n🎟️  Список промокодов платформы (Всего: ${promos.length}):`);
  console.log('----------------------------------------------------------------------------------------------------');
  if (promos.length === 0) {
    console.log('  (Промокодов пока нет. Создайте первый промокод через команду promo:create)');
  } else {
    console.log('  #   КОД             СУММА       АКТИВАЦИИ     СТАТУС             ДАТА СОЗДАНИЯ');
    console.log('----------------------------------------------------------------------------------------------------');
    promos.forEach((p, i) => {
      const isExhausted = p.usedCount >= p.maxActivations;
      const statusStr = isExhausted ? '🔴 ЛИМИТ ИСЧЕРПАН' : '🟢 АКТИВЕН';
      const num = String(i + 1).padStart(3);
      const codeStr = p.code.padEnd(15);
      const amtStr = (`+${p.amount.toLocaleString('ru-RU')} ₽`).padStart(11);
      const actStr = `${p.usedCount}/${p.maxActivations}`.padStart(12);
      const dateStr = new Date(p.createdAt).toLocaleString();
      console.log(` ${num}. ${codeStr} ${amtStr}  ${actStr}     ${statusStr.padEnd(18)} ${dateStr}`);
    });
  }
  console.log('----------------------------------------------------------------------------------------------------\n');
}

function printUserList() {
  const users = db.getAllUsers();
  console.log(`\n📋 Зарегистрированные пользователи (Всего: ${users.length}):`);
  console.log('----------------------------------------------------------------');
  if (users.length === 0) {
    console.log('  (База данных пуста)');
  } else {
    users.forEach((u, i) => {
      const statusStr = u.isBanned ? `[🚫 ЗАБАНЕН: ${u.banReason || 'Без причины'}]` : '[🟢 АКТИВЕН]';
      console.log(
        `${i + 1}. @${u.username.padEnd(16)} | Баланс: ${u.balance.toLocaleString('ru-RU').padStart(10)} ₽ | ${statusStr} (ID: ${u.id})`
      );
    });
  }
  console.log('----------------------------------------------------------------\n');
}

function printStatus() {
  const users = db.getAllUsers();
  const temkas = db.getAllTemkas();
  const promos = db.getAllPromoCodes();
  const txCountRow = sqlite.prepare('SELECT COUNT(*) as c FROM transactions').get() as any;
  const invoiceCountRow = sqlite.prepare('SELECT COUNT(*) as c FROM invoices').get() as any;
  const promoActCountRow = sqlite.prepare('SELECT COUNT(*) as c FROM promo_activations').get() as any;

  console.log(`\n📊 Статистика платформы Temshchik / Scamulator:`);
  console.log('----------------------------------------------------------------');
  console.log(`👥 Пользователей в БД: ${users.length} (забанено: ${users.filter((u) => u.isBanned).length})`);
  console.log(`📦 Всего смарт-контрактов (темок): ${temkas.length} (активных: ${temkas.filter((t) => t.status === 'Active').length})`);
  console.log(`🎟️  Промокодов создано: ${promos.length} (всего применений: ${promoActCountRow?.c || 0})`);
  console.log(`⚡ Совершенных транзакций: ${txCountRow?.c || 0}`);
  console.log(`💳 Созданных счетов на пополнение: ${invoiceCountRow?.c || 0}`);
  console.log('----------------------------------------------------------------\n');
}

// ----------------------------------------------------
// CLI DISPATCHER
// ----------------------------------------------------

async function run() {
  // If no arguments or explicitly asked for interactive menu
  if (!command || command === 'interactive' || command === 'menu' || command === 'i') {
    await runInteractive();
    return;
  }

  switch (command) {
    // ---------------- PROMO COMMANDS ----------------
    case 'promo:create':
    case 'promo-create':
    case 'create-promo': {
      const code = args[1];
      const amountRaw = args[2];
      const maxActivationsRaw = args[3];

      if (!code || !amountRaw || !maxActivationsRaw) {
        console.error('❌ Ошибка: укажите код, сумму бонуса и количество активаций.');
        console.log('👉 Пример: npm run admin promo:create -- BONUS1000 1000 50');
        process.exit(1);
      }

      const amount = parseFloat(amountRaw);
      const maxActivations = parseInt(maxActivationsRaw, 10);

      const res = db.createPromoCode(code, amount, maxActivations);
      if (!res.success || !res.promo) {
        console.error(`❌ Ошибка: ${res.error}`);
        process.exit(1);
      }

      console.log(`\n✅ Промокод успешно создан!`);
      console.log(`🎟️  Код: ${res.promo.code}`);
      console.log(`💵 Сумма: +${res.promo.amount.toLocaleString('ru-RU')} ₽`);
      console.log(`🎯 Максимум активаций: ${res.promo.maxActivations}`);
      console.log(`⏰ Создан: ${new Date(res.promo.createdAt).toLocaleString()}\n`);
      process.exit(0);
      break;
    }

    case 'promo:list':
    case 'promo-list':
    case 'promos': {
      printPromoList();
      process.exit(0);
      break;
    }

    case 'promo:delete':
    case 'promo-delete':
    case 'delete-promo': {
      const code = args[1];
      if (!code) {
        console.error('❌ Ошибка: укажите промокод для удаления.');
        console.log('👉 Пример: npm run admin promo:delete -- BONUS1000');
        process.exit(1);
      }

      const res = db.deletePromoCode(code);
      if (!res.success) {
        console.error(`❌ Ошибка: ${res.error}`);
        process.exit(1);
      }

      console.log(`\n✅ Промокод "${code.trim().toUpperCase()}" успешно удален!`);
      console.log(`🔄 История активаций промокода сброшена у пользователей.\n`);
      process.exit(0);
      break;
    }

    // ---------------- USER BALANCE COMMANDS ----------------
    case 'give-money':
    case 'give':
    case 'add-money': {
      const target = args[1];
      const amountRaw = args[2];

      if (!target || !amountRaw) {
        console.error('❌ Ошибка: укажите имя пользователя (или ID) и сумму.');
        console.log('👉 Пример: npm run admin:give-money -- user1 25000');
        process.exit(1);
      }

      const amount = parseFloat(amountRaw);
      if (isNaN(amount) || amount === 0) {
        console.error('❌ Ошибка: неверный формат суммы.');
        process.exit(1);
      }

      const res = db.giveMoney(target, amount);
      if (!res.success || !res.user) {
        console.error(`❌ Ошибка: ${res.error}`);
        process.exit(1);
      }

      console.log(`\n✅ Баланс пользователя успешно обновлен!`);
      console.log(`👤 Пользователь: @${res.user.username} (ID: ${res.user.id})`);
      console.log(`💵 Было: ${res.previousBalance?.toLocaleString('ru-RU')} ₽`);
      console.log(`➕ Изменение: ${amount > 0 ? '+' : ''}${amount.toLocaleString('ru-RU')} ₽`);
      console.log(`💰 Текущий баланс: ${res.user.balance.toLocaleString('ru-RU')} ₽\n`);
      process.exit(0);
      break;
    }

    case 'set-balance': {
      const target = args[1];
      const amountRaw = args[2];

      if (!target || amountRaw === undefined) {
        console.error('❌ Ошибка: укажите имя пользователя и точную сумму баланса.');
        process.exit(1);
      }

      const amount = parseFloat(amountRaw);
      if (isNaN(amount) || amount < 0) {
        console.error('❌ Ошибка: сумма баланса не может быть отрицательной.');
        process.exit(1);
      }

      const res = db.setBalance(target, amount);
      if (!res.success || !res.user) {
        console.error(`❌ Ошибка: ${res.error}`);
        process.exit(1);
      }

      console.log(`\n✅ Баланс пользователя установлен!`);
      console.log(`👤 Пользователь: @${res.user.username}`);
      console.log(`💰 Новый баланс: ${res.user.balance.toLocaleString('ru-RU')} ₽\n`);
      process.exit(0);
      break;
    }

    // ---------------- USER BAN / UNBAN ----------------
    case 'ban':
    case 'ban-user': {
      const target = args[1];
      const reason = args.slice(2).join(' ') || 'Нарушение правил платформы';

      if (!target) {
        console.error('❌ Ошибка: укажите имя пользователя (или ID) для блокировки.');
        console.log('👉 Пример: npm run admin:ban -- scammer_bot "Спам алгоритмами"');
        process.exit(1);
      }

      const res = db.banUser(target, reason);
      if (!res.success || !res.user) {
        console.error(`❌ Ошибка: ${res.error}`);
        process.exit(1);
      }

      console.log(`\n🚫 Аккаунт успешно заблокирован!`);
      console.log(`👤 Пользователь: @${res.user.username} (ID: ${res.user.id})`);
      console.log(`📝 Причина бана: "${reason}"`);
      console.log(`🔒 Доступ к авторизации и операциям ограничен.\n`);
      process.exit(0);
      break;
    }

    case 'unban':
    case 'unban-user': {
      const target = args[1];

      if (!target) {
        console.error('❌ Ошибка: укажите имя пользователя (или ID) для разблокировки.');
        console.log('👉 Пример: npm run admin:unban -- trader_neo');
        process.exit(1);
      }

      const res = db.unbanUser(target);
      if (!res.success || !res.user) {
        console.error(`❌ Ошибка: ${res.error}`);
        process.exit(1);
      }

      console.log(`\n🟢 Аккаунт успешно разблокирован!`);
      console.log(`👤 Пользователь: @${res.user.username} (ID: ${res.user.id})`);
      console.log(`🔓 Доступ к аккаунту полностью восстановлен.\n`);
      process.exit(0);
      break;
    }

    // ---------------- DB / STATS ----------------
    case 'clear-db':
    case 'db:clear':
    case 'clear': {
      console.log('⏳ Выполняется полная очистка базы данных и файлов состояний...');
      db.clearDatabase();
      console.log('✅ База данных полностью очищена! Все таблицы сброшены.');
      process.exit(0);
      break;
    }

    case 'list':
    case 'users':
    case 'list-users': {
      printUserList();
      process.exit(0);
      break;
    }

    case 'status':
    case 'info': {
      printStatus();
      process.exit(0);
      break;
    }

    case 'help':
    case '--help':
    case '-h':
    default: {
      printHelp();
      process.exit(0);
    }
  }
}

run().catch((err) => {
  console.error('Fatal CLI error:', err);
  process.exit(1);
});
