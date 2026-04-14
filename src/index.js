require('dotenv').config();
const { bot } = require('./bot');
const { startBirthdayScheduler } = require('./scheduler/birthdayScheduler');

(async () => {
  try {
    console.log('Starting bot...');

    // 🔥 ЖОРСТКИЙ RESET TELEGRAM СЕСІЙ
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });

    await bot.launch();

    console.log('Bot started');

    startBirthdayScheduler(bot);
  } catch (err) {
    console.error('ERROR:', err);
  }
})();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));