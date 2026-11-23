import { db, sqlite } from './db.js';

const args = process.argv.slice(2);
const command = (args[0] || '').toLowerCase().trim();

function printHelp() {
  console.log(`
================================================================
          🛠️  TEMSHCHIK / SCAMULATOR ADMIN CLI  🛠️
================================================================

Использование (CLI команды управления):

1. 💰 Выдать деньги пользователю:
   npm run admin:give-money -- <username_или_id> <сумма>
   или:
   npm run admin give-money <username> <сумма>
   Пример: npm run admin:give-money -- trader_neo 50000

2. 🚫 Забанить аккаунт:
   npm run admin:ban -- <username_или_id> [причина]
   или:
   npm run admin ban <username> "Причина блокировки"
   Пример: npm run admin:ban -- hacker_99 "Нарушение правил площадки"

3. 🟢 Разбанить аккаунт:
   npm run admin:unban -- <username_или_id>
   или:
   npm run admin unban <username>
   Пример: npm run admin:unban -- trader_neo

4. 🗑️ Полная очистка базы данных:
   npm run admin:clear-db
   или:
   npm run db:clear

5. 📋 Список пользователей и статусов:
   npm run admin list
   или:
   npm run admin users

6. 📊 Общая статистика платформы:
   npm run admin status
================================================================
`);
}

async function run() {
  switch (command) {
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
      const users = db.getAllUsers();
      console.log(`\n📋 Зарегистрированные пользователи (Всего: ${users.length}):`);
      console.log('----------------------------------------------------------------');
      if (users.length === 0) {
        console.log('  (База данных пуста. Зарегистрируйте аккаунты через веб-интерфейс)');
      } else {
        users.forEach((u, i) => {
          const statusStr = u.isBanned ? `[🚫 ЗАБАНЕН: ${u.banReason || 'Без причины'}]` : '[🟢 АКТИВЕН]';
          console.log(
            `${i + 1}. @${u.username.padEnd(16)} | Баланс: ${u.balance.toLocaleString('ru-RU').padStart(10)} ₽ | ${statusStr} (ID: ${u.id})`
          );
        });
      }
      console.log('----------------------------------------------------------------\n');
      process.exit(0);
      break;
    }

    case 'status':
    case 'info': {
      const users = db.getAllUsers();
      const temkas = db.getAllTemkas();
      const txCountRow = sqlite.prepare('SELECT COUNT(*) as c FROM transactions').get() as any;
      const invoiceCountRow = sqlite.prepare('SELECT COUNT(*) as c FROM invoices').get() as any;

      console.log(`\n📊 Статистика платформы Temshchik / Scamulator:`);
      console.log('----------------------------------------------------------------');
      console.log(`👥 Пользователей в БД: ${users.length} (забанено: ${users.filter((u) => u.isBanned).length})`);
      console.log(`📦 Всего смарт-контрактов (темок): ${temkas.length} (активных: ${temkas.filter((t) => t.status === 'Active').length})`);
      console.log(`⚡ Совершенных транзакций: ${txCountRow?.c || 0}`);
      console.log(`💳 Созданных счетов на пополнение: ${invoiceCountRow?.c || 0}`);
      console.log('----------------------------------------------------------------\n');
      process.exit(0);
      break;
    }

    case 'help':
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
