const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const https = require('https');

// 🔐 ENV
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = Number(process.env.ADMIN_CHAT_ID);

// 📦 МОДУЛІ
const birthdays = require('./birthdays.js');
birthdays.loadBirthdays();

// 🔥 Перевірка
if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN not found');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
bot.deleteWebHook();

let explosionSentToday = false;
let birthdayNotifiedToday = false;

// ================= МЕНЮ =================
const mainMenu = {
  inline_keyboard: [
    [{ text: '💥 Explosion!', callback_data: 'explosion' }],
    [{ text: '💱 Курс валют', callback_data: 'currency' }],
    [{ text: '🧙‍♀️ Про Мегумін', callback_data: 'about' }]
  ]
};

// ================= КОМАНДИ =================
bot.onText(/\/start/, msg => {
  bot.sendMessage(msg.chat.id, '🧙‍♀️ Привіт!\nНатисни /bot');
});

bot.onText(/\/bot/, msg => {
  bot.sendMessage(msg.chat.id, '📋 Меню:', { reply_markup: mainMenu });
});

// ================= CALLBACK =================
bot.on('callback_query', async cb => {
  const chatId = cb.message.chat.id;
  await bot.answerCallbackQuery(cb.id);

  if (cb.data === 'explosion') {
    sendExplosion(chatId);
  }

  if (cb.data === 'currency') {
    bot.sendMessage(chatId, '⏳ Завантажую курс...');
    getCurrency().then(t => bot.sendMessage(chatId, t));
  }

  if (cb.data === 'about') {
    bot.sendMessage(chatId, '🧙‍♀️ Я Мегумін! EXPLOSION!');
  }
});

// ================= ФУНКЦІЇ =================
function sendExplosion(chatId) {
  const gif = 'CgACAgQAAxkBAAMCadep_WqfcQ14s78soH2lBvQ3wkMAAngGAAK8muRQ4pvZxf4pVQY7BA';
  bot.sendAnimation(chatId, gif, { caption: '💥 EXPLOSION!' });
}

function getCurrency() {
  return new Promise(resolve => {
    https.get('https://api.monobank.ua/bank/currency', res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const usd = json.find(r => r.currencyCodeA === 840 && r.currencyCodeB === 980);
          resolve(`USD: ${usd?.rateBuy ?? '-'} / ${usd?.rateSell ?? '-'}`);
        } catch {
          resolve('❌ Помилка курсу');
        }
      });
    });
  });
}

// ================= ⏰ АВТО =================
setInterval(() => {
  const kyiv = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Kyiv' }));
  const time = `${kyiv.getHours().toString().padStart(2, '0')}:${kyiv.getMinutes().toString().padStart(2, '0')}`;

  // 💥 18:00
  if (time === "18:00" && !explosionSentToday && ADMIN_CHAT_ID) {
    sendExplosion(ADMIN_CHAT_ID);
    explosionSentToday = true;
    console.log('💥 Explosion sent');
  }

  // 🎂 12:00
  if (time === "19:30" && !birthdayNotifiedToday && ADMIN_CHAT_ID) {
    const today = birthdays.getTodayBirthdays();

    if (today.length > 0) {
      const names = today.map(p => p.name);

      birthdays.sendBirthdayGreeting(bot, ADMIN_CHAT_ID, names);

      console.log('🎂 Birthday sent:', names.join(', '));
    } else {
      console.log('📭 Немає ДН сьогодні');
    }

    birthdayNotifiedToday = true;
  }

  // 🔄 reset
  if (time === "00:01") {
    explosionSentToday = false;
    birthdayNotifiedToday = false;
  }

}, 60000);

// ================= 🌐 SERVER =================
const PORT = process.env.PORT || 3000;

http.createServer((_, res) => {
  res.end('OK');
}).listen(PORT);

console.log('✅ Bot started');