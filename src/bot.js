const { Telegraf } = require('telegraf');

const { showMenu } = require('./handlers/menu');
const { explosionHandler } = require('./handlers/explosion');
const { currencyHandler } = require('./handlers/currency');
const { dotaHandler } = require('./handlers/dota');
const { meguminHandler } = require('./handlers/megumin');

const bot = new Telegraf(process.env.BOT_TOKEN);

// 🔥 error handler
bot.catch((err, ctx) => {
  console.error('BOT ERROR:', err);
});

// commands
bot.command('bot', showMenu);

// actions
bot.action('EXPLOSION', explosionHandler);
bot.action('CURRENCY', currencyHandler);
bot.action('DOTA', dotaHandler);
bot.action('MEGUMIN', meguminHandler);

module.exports = { bot };