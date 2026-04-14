require('dotenv').config();
const { bot } = require('./bot');
const { startBirthdayScheduler } = require('./scheduler/birthdayScheduler');

(async () => {
  await bot.telegram.deleteWebhook();

  await bot.launch();
  console.log('Bot started');

  startBirthdayScheduler(bot);
})();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));