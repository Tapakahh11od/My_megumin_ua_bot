const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const https = require('https');

let localConfig = {};
try { localConfig = require('./config.json'); } catch (e) {}

const BOT_TOKEN = process.env.BOT_TOKEN || localConfig.BOT_TOKEN;
const ADMIN_CHAT_ID = Number(process.env.ADMIN_CHAT_ID || localConfig.ADMIN_CHAT_ID);

let BIRTHDAYS = [];
try { BIRTHDAYS = require('./birthdays.json'); } catch (e) {}

if (!BOT_TOKEN) {
  console.error('❌ ПОМИЛКА: Не знайдено BOT_TOKEN!');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

let explosionSentToday = false;
let birthdayNotifiedToday = false;

// ✅ ВИПРАВЛЕНЕ МЕНЮ
const mainMenu = {
  inline_keyboard: [
    [{ text: '💥 Explosion!', callback_data: 'explosion' }],
    [{ text: '💱 Курс валют', callback_data: 'currency' }],
    [{ text: '⛽ Ціни на паливо', callback_data: 'fuel' }],
    [{ text: '🧙‍♀️ Про Мегумін', callback_data: 'about' }]
  ]
};

// START
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    '🧙‍♀️ Привіт! Я Мегумін!\n\nМагістр вибухової магії вже тут!\nНатисни /bot, щоб побачити меню. 💥'
  );
});

// MENU
bot.onText(/\/bot/, (msg) => {
  bot.sendMessage(msg.chat.id, '📋 Головне меню\nОбери функцію:', {
    reply_markup: mainMenu
  });
});

// GET CHAT ID
bot.onText(/\/getid/, (msg) => {
  const chatId = msg.chat.id;
  const chatTitle = msg.chat.title || 'Особистий чат';
  const chatType = msg.chat.type;

  const text =
    `🆔 Інформація про чат:\n\n` +
    `📛 Назва: ${chatTitle}\n` +
    `🔢 ID: ${chatId}\n` +
    `📎 Тип: ${chatType}`;

  bot.sendMessage(chatId, text);
});

// CALLBACK
bot.on('callback_query', async (cb) => {
  const chatId = cb.message.chat.id;
  await bot.answerCallbackQuery(cb.id);

  switch (cb.data) {
    case 'explosion':
      sendExplosion(chatId);
      break;

    case 'currency':
      bot.sendMessage(chatId, '⏳ Завантажую курс...');
      getCurrency().then(t => bot.sendMessage(chatId, t));
      break;

    case 'fuel':
      bot.sendMessage(chatId, '⏳ Завантажую ціни на паливо...');
      getFuelPrices().then(t => bot.sendMessage(chatId, t));
      break;

    case 'about':
      bot.sendMessage(
        chatId,
        '🧙‍♀️ Про Мегумін\n\n' +
        'Я — архіволшебниця з Коносуби!\n\n' +
        '💥 Вибухи\n💱 Курси валют\n⛽ Паливо\n🎂 Дні народження\n\n' +
        'EXPLOSION!'
      );
      break;
  }
});

// EXPLOSION
function sendExplosion(chatId) {
  const text = '💥 EXPLOSION! 💥\nМегумін використала магію!';
  const gif = 'CgACAgQAAxkBAAMCadep_WqfcQ14s78soH2lBvQ3wkMAAngGAAK8muRQ4pvZxf4pVQY7BA';

  bot.sendAnimation(chatId, gif, { caption: text });
}

// CURRENCY
function getCurrency() {
  return new Promise((resolve) => {
    https.get('https://api.monobank.ua/bank/currency', {
      headers: { 'User-Agent': 'Megumin-Bot' },
      timeout: 8000
    }, (res) => {

      let data = '';

      res.on('data', chunk => data += chunk);

      res.on('end', () => {
        try {
          const json = JSON.parse(data);

          const usd = json.find(r => r.currencyCodeA === 840 && r.currencyCodeB === 980);
          const eur = json.find(r => r.currencyCodeA === 978 && r.currencyCodeB === 980);

          const usdBuy = usd?.rateBuy ?? '—';
          const usdSell = usd?.rateSell ?? '—';

          const eurBuy = eur?.rateBuy ?? '—';
          const eurSell = eur?.rateSell ?? '—';

          const text =
            `💱 Курс Monobank\n\n` +
            `USD: ${usdBuy} / ${usdSell}\n` +
            `EUR: ${eurBuy} / ${eurSell}`;

          resolve(text);

        } catch {
          resolve('❌ Помилка курсу');
        }
      });

    }).on('error', () => resolve('❌ Помилка з\'єднання'));
  });
}

// FUEL
function getFuelPrices() {
  return new Promise((resolve) => {

    const req = https.request({
      hostname: 'minfin.com.ua',
      path: '/api/currency/fuel/',
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    }, (res) => {

      let data = '';
      res.on('data', chunk => data += chunk);

      res.on('end', () => {
        try {
          const json = JSON.parse(data);

          const a95 = json.A95?.sale?.toFixed(2) ?? '—';
          const a92 = json.A92?.sale?.toFixed(2) ?? '—';
          const dt = json.Diesel?.sale?.toFixed(2) ?? '—';
          const gas = json.Gas?.sale?.toFixed(2) ?? '—';

          resolve(
            `⛽ Паливо:\n\n` +
            `А-92: ${a92}\n` +
            `А-95: ${a95}\n` +
            `ДП: ${dt}\n` +
            `Газ: ${gas}`
          );

        } catch {
          resolve('❌ Помилка палива');
        }
      });

    });

    req.on('error', () => resolve('❌ Помилка з\'єднання'));
    req.on('timeout', () => {
      req.destroy();
      resolve('⏱️ Таймаут');
    });

    req.end();
  });
}

// BIRTHDAYS
function getTodayBirthdays() {
  const now = new Date().toLocaleString('en-US', { timeZone: 'Europe/Kyiv' });
  const date = new Date(now);

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return BIRTHDAYS.filter(p => p.date === `${day}.${month}`);
}

// TIMER
setInterval(() => {
  const now = new Date().toLocaleString('en-US', { timeZone: 'Europe/Kyiv' });
  const date = new Date(now);

  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  if (time === "18:00" && !explosionSentToday && ADMIN_CHAT_ID) {
    sendExplosion(ADMIN_CHAT_ID);
    explosionSentToday = true;
  }

  if (time === "09:00" && !birthdayNotifiedToday && ADMIN_CHAT_ID) {
    const today = getTodayBirthdays();

    if (today.length > 0) {
      const names = today.map(p => p.name).join(', ');
      bot.sendMessage(ADMIN_CHAT_ID, `🎉 З Днем Народження!\n${names}`);
      birthdayNotifiedToday = true;
    }
  }

  if (time === "00:01") {
    explosionSentToday = false;
    birthdayNotifiedToday = false;
  }

}, 60000);

// SERVER (ВАЖЛИВО ДЛЯ RENDER)
const PORT = process.env.PORT || 3000;

http.createServer((_, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('✅ Bot is alive');
}).listen(PORT, () => console.log(`🌐 Server running on ${PORT}`));

console.log('✅ Мегумін запущена! 💥');