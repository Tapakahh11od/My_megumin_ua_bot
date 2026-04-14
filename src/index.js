require('dotenv').config();
const { bot } = require('./bot');
const { startBirthdayScheduler } = require('./scheduler/birthdayScheduler');

bot.launch();
console.log('Bot started');

// 🔥 автологіка ДР
startBirthdayScheduler(bot);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));