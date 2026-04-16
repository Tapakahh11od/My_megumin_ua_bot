const { Telegraf } = require('telegraf');
const { showMenu } = require('./handlers/menu');
const { explosionHandler } = require('./handlers/explosion');
const { currencyHandler } = require('./handlers/currency');
// Змініть імпорт тут:
const { dotaHandler, dotaPlayerHandler } = require('./handlers/dota'); 
const { meguminHandler } = require('./handlers/megumin');

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.catch((err, ctx) => {
  console.error('BOT ERROR:', err);
});

bot.command('bot', showMenu);

bot.action('EXPLOSION', explosionHandler);
bot.action('CURRENCY', currencyHandler);
bot.action('MEGUMIN', meguminHandler);

// Кнопка загального меню Доти
bot.action('DOTA', dotaHandler);

// 👇 ДОДАЙТЕ ЦЕЙ РЯДОК: Слухач для конкретних гравців
bot.action(/^DOTA_PLAYER_(\d+)$/, dotaPlayerHandler);

module.exports = { bot };