require('dotenv').config();
const { bot } = require('./bot');
const { startBirthdayScheduler } = require('./scheduler/birthdayScheduler');

(async () => {
  try {
    console.log('Bot starting...');

    // 🔥 гарантія чистого стану
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });

    // 🔥 маленька пауза (дуже важливо для Render)
    await new Promise(r => setTimeout(r, 1000));

    await bot.launch();

    console.log('Bot started');

    startBirthdayScheduler(bot);

  } catch (err) {
    console.error('FATAL ERROR:', err);
    process.exit(1);
  }
})();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));