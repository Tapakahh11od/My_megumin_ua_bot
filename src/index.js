require('dotenv').config();
const { bot } = require('./bot');
const { startBirthdayScheduler } = require('./scheduler/birthdayScheduler');

(async () => {
  try {
    console.log('Starting bot...');

    // 🔥 повний reset Telegram стану
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });

    // 🔥 НЕМАЄ getUpdates reset (він інколи викликає 409)
    await bot.launch();

    console.log('Bot started');

    startBirthdayScheduler(bot);
  } catch (err) {
    console.error('FATAL ERROR:', err);
  }
})();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));