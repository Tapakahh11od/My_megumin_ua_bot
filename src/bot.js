const { Telegraf } = require('telegraf');
const { showMenu } = require('./handlers/menu');
const { explosionHandler } = require('./handlers/explosion');
const { currencyHandler } = require('./handlers/currency');
const { dotaHandler, dotaPlayerHandler } = require('./handlers/dota');
const { meguminHandler } = require('./handlers/megumin');

const bot = new Telegraf(process.env.BOT_TOKEN);

// 🔥 Глобальний лов помилок (залишаємо)
bot.catch((err, ctx) => {
  console.error('BOT ERROR:', err);
});

// 📋 меню
bot.command('bot', showMenu);

// 🎯 основні кнопки
bot.action('EXPLOSION', explosionHandler);
bot.action('CURRENCY', currencyHandler);
bot.action('MEGUMIN', meguminHandler);

// 🎮 Dota
bot.action('DOTA', async (ctx) => {
  console.log('DOTA clicked');
  return dotaHandler(ctx);
});

// 🔴 ВАЖЛИВО: правильна регулярка + лог
bot.action(/^DOTA_PLAYER_(\d+)$/, async (ctx) => {
  console.log('Player selected:', ctx.match[1]);
  return dotaPlayerHandler(ctx);
});

module.exports = { bot };