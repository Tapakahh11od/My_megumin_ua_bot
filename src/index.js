require('dotenv').config();
const { bot } = require('./bot');
const { startBirthdayScheduler } = require('./scheduler/birthdayScheduler');

(async () => {
  try {
    // 🔥 ЖОРСТКИЙ ресет
    await bot.telegram.deleteWebhook();
    await bot.telegram.getUpdates({ offset: -1 });

    await bot.launch();
    console.log('Bot started');

    startBirthdayScheduler(bot);
  } catch (e) {
    console.error(e);
  }
})();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));