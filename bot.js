const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const https = require('https');

// 🔐 Змінні середовища (тільки для Render)
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = Number(process.env.ADMIN_CHAT_ID);

// 🎂 Дні народження (завантажуємо з файлу)
let BIRTHDAYS = [];
try { BIRTHDAYS = require('./birthdays.json'); } 
catch (e) { console.log('⚠️ birthdays.json не знайдено'); }

// 🔥 Перевірка обов'язкових змінних
if (!BOT_TOKEN) {
  console.error('❌ ПОМИЛКА: Не знайдено BOT_TOKEN у змінних середовища!');
  process.exit(1);
}
if (!ADMIN_CHAT_ID) {
  console.error('❌ ПОМИЛКА: Не знайдено ADMIN_CHAT_ID у змінних середовища!');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// 📊 Стани
let explosionSentToday = false;
let birthdayNotifiedToday = false;

// ================= 📋 МЕНЮ =================
const mainMenu = {
  inline_keyboard: [
    [{ text: '💥 Explosion!', callback_data: 'explosion' }],
    [{ text: '💱 Курс валют', callback_data: 'currency' }],
    [{ text: '⛽ Ціни на паливо', callback_data: 'fuel' }],
    [{ text: '🧙‍♀️ Про Мегумін', callback_data: 'about' }]
  ]
};

// ================= 🚀 КОМАНДИ =================
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, '🧙‍♀️ Привіт! Я Мегумін!\n\nМагістр вибухової магії вже тут!\nНатисни /bot, щоб побачити меню. 💥');
});

bot.onText(/\/bot/, (msg) => {
  bot.sendMessage(msg.chat.id, '📋 Головне меню\nОбери функцію:', { reply_markup: mainMenu });
});

bot.onText(/\/getid/, (msg) => {
  const text = `🆔 Інформація про чат:\n📛 Назва: ${msg.chat.title || 'Особистий чат'}\n🔢 ID: ${msg.chat.id}\n📎 Тип: ${msg.chat.type}`;
  bot.sendMessage(msg.chat.id, text);
});

// ================= 🔘 КНОПКИ =================
bot.on('callback_query', async (cb) => {
  const chatId = cb.message.chat.id;
  await bot.answerCallbackQuery(cb.id);

  switch (cb.data) {
    case 'explosion': sendExplosion(chatId); break;
    case 'currency':
      bot.sendMessage(chatId, '⏳ Завантажую курс...');
      getCurrency().then(t => bot.sendMessage(chatId, t));
      break;
    case 'fuel':
      bot.sendMessage(chatId, '⏳ Завантажую ціни на паливо...');
      getFuelPrices().then(t => bot.sendMessage(chatId, t));
      break;
    case 'about':
      bot.sendMessage(chatId, '🧙‍♀️ Про Мегумін\n\nЯ — архіволшебниця з Коносуби!\n💥 Вибухи\n💱 Курси валют\n⛽ Паливо\n🎂 Дні народження\n\nEXPLOSION!');
      break;
  }
});

// ================= 💥 ФУНКЦІЇ =================
function sendExplosion(chatId) {
  const gif = 'CgACAgQAAxkBAAMCadep_WqfcQ14s78soH2lBvQ3wkMAAngGAAK8muRQ4pvZxf4pVQY7BA';
  bot.sendAnimation(chatId, gif, { caption: '💥 EXPLOSION! 💥\nМегумін використала магію!' });
}

function getCurrency() {
  return new Promise((resolve) => {
    https.get('https://api.monobank.ua/bank/currency', { headers: { 'User-Agent': 'Megumin-Bot' }, timeout: 8000 }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const usd = json.find(r => r.currencyCodeA === 840 && r.currencyCodeB === 980);
          const eur = json.find(r => r.currencyCodeA === 978 && r.currencyCodeB === 980);
          resolve(`💱 Курс Monobank\n\nUSD: ${usd?.rateBuy ?? '—'} / ${usd?.rateSell ?? '—'}\nEUR: ${eur?.rateBuy ?? '—'} / ${eur?.rateSell ?? '—'}`);
        } catch { resolve('❌ Помилка курсу'); }
      });
    }).on('error', () => resolve('❌ Помилка з\'єднання'));
  });
}

// ⛽ ЦІНИ НА ПАЛИВО (Виправлена версія)
function getFuelPrices() {
  return new Promise((resolve) => {
    https.get('https://index.minfin.com.ua/ua/markets/fuel/', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 8000
    }, (res) => {

      let html = '';

      res.on('data', chunk => html += chunk);

      res.on('end', () => {
        try {
          // беремо основні ціни
          const a95 = html.match(/А-95[\s\S]{0,100}?(\d+\.\d+)/)?.[1];
          const dt  = html.match(/Дизель[\s\S]{0,100}?(\d+\.\d+)/)?.[1];
          const gas = html.match(/Газ[\s\S]{0,100}?(\d+\.\d+)/)?.[1];

          resolve(
`⛽ Середні ціни (Україна):

А-95: ${a95 || '—'} ₴
ДП: ${dt || '—'} ₴
Газ: ${gas || '—'} ₴

(дані Minfin)`
          );

        } catch (e) {
          console.error(e);
          resolve('❌ Помилка парсингу палива');
        }
      });

    }).on('error', () => {
      resolve('❌ Помилка з\'єднання');
    });
  });
}

function getTodayBirthdays() {
  const now = new Date().toLocaleString('en-US', { timeZone: 'Europe/Kyiv' });
  const date = new Date(now);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return BIRTHDAYS.filter(p => p.date === `${day}.${month}`);
}

// ================= ⏰ ТАЙМЕР =================
setInterval(() => {
  const now = new Date().toLocaleString('en-US', { timeZone: 'Europe/Kyiv' });
  const date = new Date(now);
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  if (time === "18:00" && !explosionSentToday) {
    sendExplosion(ADMIN_CHAT_ID);
    explosionSentToday = true;
    console.log('💥 Вибух надіслано!');
  }

  if (time === "09:00" && !birthdayNotifiedToday) {
    const today = getTodayBirthdays();
    if (today.length > 0) {
      const names = today.map(p => p.name).join(', ');
      bot.sendMessage(ADMIN_CHAT_ID, `🎉 З Днем Народження!\n${names}`);
      birthdayNotifiedToday = true;
      console.log('🎂 Привітання надіслано!');
    }
  }

  // Скидання прапорів опівночі
  if (time === "00:01") {
    explosionSentToday = false;
    birthdayNotifiedToday = false;
    console.log('🔄 Прапори скинуто');
  }
}, 60000);

// ================= 🌐 HTTP-СЕРВЕР (для Render) =================
const PORT = process.env.PORT || 3000;
http.createServer((_, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('✅ Bot is alive');
}).listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));

console.log('✅ Мегумін запущена! 💥');