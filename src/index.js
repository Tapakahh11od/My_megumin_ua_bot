require('dotenv').config();
const { bot } = require('./bot');
const { startBirthdayScheduler } = require('./scheduler/birthdayScheduler');

(async () => {
  try {
    console.log('Starting bot...');

    // 🔥 1. Завжди прибираємо webhook
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });

    // 🔥 2. Скидаємо старі апдейти (ВАЖЛИВО ПРОТИ 409)
    await bot.telegram.getUpdates({ offset: -1 });

    // 🔥 3. запускаємо бот
    await bot.launch();

    console.log('Bot started');

    // 🔥 4. cron (дні народження)
    startBirthdayScheduler(bot);

  } catch (err) {
    console.error('FATAL ERROR:', err);
  }
})();

// graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));