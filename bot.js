const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const dota = require('./dota.js');

// 🔐 ENV + ВАЛІДАЦІЯ
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = parseInt(process.env.ADMIN_CHAT_ID, 10);

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN not set in Render environment variables');
  process.exit(1);
}

if (isNaN(ADMIN_CHAT_ID)) {
  console.error('❌ ADMIN_CHAT_ID must be a number in Render environment variables');
  process.exit(1);
}

// 📦 MODULES
const birthdays = require('./birthdays.js');
const { getCurrency } = require('./currency.js');

// 🔄 INIT DATA (SAFE)
birthdays.loadBirthdays();
dota.loadPlayers();

// ⚠️ IMPORTANT: HEROES must finish loading before usage
(async () => {
  try {
    await dota.loadHeroes();
    console.log('✅ Heroes loaded');
  } catch (err) {
    console.error('❌ Failed to load heroes:', err.message);
  }
})();

// 📖 BOT INFO
let botInfo;
try {
  const rawData = fs.readFileSync('info_bot.json', 'utf8');
  botInfo = JSON.parse(rawData);

  if (!botInfo.about) {
    throw new Error('Missing "about" field');
  }

  console.log('✅ info_bot.json loaded');
} catch (err) {
  console.error('❌ info_bot.json error:', err.message);
  process.exit(1);
}

// 🤖 BOT INIT
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
bot.deleteWebHook();

// FLAGS (використовуються в cron)
let explosionSentToday = false;
let birthdayNotifiedToday = false;

// ================= MENU =================
const mainMenu = {
  inline_keyboard: [
    [{ text: '💥 Explosion!', callback_data: 'explosion' }],
    [{ text: '💱 Курс валют', callback_data: 'currency' }],
    [{ text: '🎮 Dota 2 статистика', callback_data: 'dota_menu' }],
    [{ text: '🧙‍♀️ Про Мегумін', callback_data: 'about' }]
  ]
};

// ================= COMMANDS =================
bot.onText(/\/start/, msg => {
  bot.sendMessage(msg.chat.id, '🧙‍♀️ Привіт!\nНатисни /bot');
});

bot.onText(/\/bot/, msg => {
  bot.sendMessage(msg.chat.id, '📋 Меню:', { reply_markup: mainMenu });
});

// ================= CALLBACK =================
const callbackHandlers = require('./handlers/callbackHandlers');

bot.on('callback_query', async (cb) => {
  const chatId = cb.message.chat.id;
  await bot.answerCallbackQuery(cb.id);

  try {
    // 🎮 PLAYER STATS (особливий випадок з параметром)
    if (cb.data.startsWith('dota_player:')) {
      const playerId = cb.data.split(':')[1];
      await callbackHandlers.handleDotaPlayer(bot, chatId, playerId);
      return;
    }

    // 📋 Прості команди через switch
    switch (cb.data) {
      case 'explosion':
        await callbackHandlers.handleExplosion(bot, chatId);
        break;
      case 'currency':
        await callbackHandlers.handleCurrency(bot, chatId);
        break;
      case 'about':
        await callbackHandlers.handleAbout(bot, chatId, botInfo);
        break;
      case 'dota_menu':
        await callbackHandlers.handleDotaMenu(bot, chatId);
        break;
      default:
        console.warn(`⚠️ Unknown callback: ${cb.data}`);
    }
  } catch (err) {
    console.error('❌ Callback handler error:', err.message);
    await bot.sendMessage(chatId, '❌ Внутрішня помилка обробки запиту').catch(() => {});
  }
});

// ================= AUTO TASKS (CRON) =================

// 🎂 Щодня о 12:00 за Києвом — дні народження
cron.schedule('0 12 * * *', () => {
  console.log('🔍 Checking birthdays...');
  if (!ADMIN_CHAT_ID) return;
  
  const today = birthdays.getTodayBirthdays();
  if (today.length > 0) {
    const names = today.map(p => p.name);
    birthdays.sendBirthdayGreeting(bot, ADMIN_CHAT_ID, names);
    console.log(`🎉 Birthday greetings sent to: ${names.join(', ')}`);
  }
}, {
  timezone: 'Europe/Kyiv'
});

// 🔄 Щодня о 00:01 — скидання прапорців
cron.schedule('1 0 * * *', () => {
  explosionSentToday = false;
  birthdayNotifiedToday = false;
  console.log('🔄 Daily flags reset');
}, {
  timezone: 'Europe/Kyiv'
});

// ================= SERVER =================
const PORT = process.env.PORT || 3000;
http.createServer((_, res) => res.end('OK')).listen(PORT);

// ================= GLOBAL ERROR HANDLERS =================
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  process.exit(1);
});

console.log('✅ Bot started');