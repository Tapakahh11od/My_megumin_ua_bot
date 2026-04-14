const { Telegraf } = require('telegraf');

const { showMenu } = require('./handlers/menu');
const { explosionHandler } = require('./handlers/explosion');
const { currencyHandler } = require('./handlers/currency');
const { dotaHandler } = require('./handlers/dota');
const { meguminHandler } = require('./handlers/megumin');

const bot = new Telegraf(process.env.BOT_TOKEN);

// =====================
// ⚡ GLOBAL ERROR HANDLER
// =====================
bot.catch((err, ctx) => {
  console.error('BOT ERROR:', err);
  if (ctx) {
    ctx.reply('❌ Сталася помилка. Спробуй ще раз.');
  }
});

// =====================
// COMMANDS
// =====================
bot.command('bot', showMenu);

// =====================
// BUTTONS (ACTIONS)
// =====================
bot.action('EXPLOSION', explosionHandler);
bot.action('CURRENCY', currencyHandler);
bot.action('DOTA', dotaHandler);
bot.action('MEGUMIN', meguminHandler);

// =====================
// UNKNOWN CALLBACKS SAFETY
// =====================
bot.on('callback_query', async (ctx, next) => {
  try {
    return next();
  } catch (err) {
    console.error('Callback error:', err);
    await ctx.answerCbQuery('⚠️ Щось пішло не так');
  }
});

module.exports = { bot };