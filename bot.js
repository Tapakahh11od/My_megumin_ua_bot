const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const fs = require('fs');

// 🔐 ENV
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = Number(process.env.ADMIN_CHAT_ID);

// 📦 МОДУЛІ
const birthdays = require('./birthdays.js');
const { getCurrency } = require('./currency.js');

birthdays.loadBirthdays();

// 📖 Читаємо info_bot.json
let botInfo = {};
try {
  const rawData = fs.readFileSync('info_bot.json', 'utf8');
  botInfo = JSON.parse(rawData);
  console.log('✅ info_bot.json завантажено');
} catch (err) {
  console.error('❌ Помилка читання info_bot.json:', err.message);
}

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
    bot.sendMessage(chatId, '⏳ Завантажую курс...', { parse_mode: 'Markdown' });
    getCurrency().then(text => 
      bot.sendMessage(chatId, text, { parse_mode: 'Markdown' })
    );
  }

  if (cb.data === 'about') {
    const aboutText = botInfo.about || '🧙‍♀️ Я Мегумін! EXPLOSION!';
    bot.sendMessage(chatId, aboutText, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true 
    });
  }
});

// ================= ФУНКЦІЇ =================
function sendExplosion(chatId) {
  const gif = 'CgACAgQAAxkBAAMCadep_WqfcQ14s78soH2lBvQ3wkMAAngGAAK8muRQ4pvZxf4pVQY7BA';
  bot.sendAnimation(chatId, gif, { caption: '💥 EXPLOSION!' });
}

// ⚠️ Функцію getCurrency() видалено - тепер вона в currency.js

// ================= ⏰ АВТО =================
setInterval(() => {
  const kyiv = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Kyiv' }));
  const time = `${kyiv.getHours().toString().padStart(2, '0')}:${kyiv.getMinutes().toString().padStart(2, '0')}`;

  if (time === "18:00" && !explosionSentToday && ADMIN_CHAT_ID) {
    sendExplosion(ADMIN_CHAT_ID);
    explosionSentToday = true;
    console.log('💥 Explosion sent');
  }

  if (time === "12:00" && !birthdayNotifiedToday && ADMIN_CHAT_ID) {
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