const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const https = require('https');

let localConfig = {};
try { localConfig = require('./config.json'); } catch (e) {}

const BOT_TOKEN = process.env.BOT_TOKEN || localConfig.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || localConfig.ADMIN_CHAT_ID;

let BIRTHDAYS = [];
try { BIRTHDAYS = require('./birthdays.json'); } catch (e) {}

if (!BOT_TOKEN) {
  console.error('❌ ПОМИЛКА: Не знайдено BOT_TOKEN!');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

let explosionSentToday = false;
let birthdayNotifiedToday = false;

// ✅ МЕНЮ - АБСОЛЮТНО ПРАВИЛЬНИЙ СИНТАКСИС
const mainMenu = {
  inline_keyboard: [
    [{ text: '💥 Explosion!', callback_ 'explosion' }],
    [{ text: '💱 Курс валют', callback_ 'currency' }],
    [{ text: '⛽ Ціни на паливо', callback_ 'fuel' }],
    [{ text: '🧙‍♀️ Про Мегумін', callback_ 'about' }]
  ]
};

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 
    '🧙‍♀️ **Привіт! Я Мегумін!**\n\n' +
    'Магістр вибухової магії вже тут!\n' +
    'Натисни `/bot`, щоб побачити меню. 💥', 
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/bot/, (msg) => {
  bot.sendMessage(msg.chat.id, '📋 **Головне меню**\nОбери потрібну функцію:', { 
    reply_markup: mainMenu, 
    parse_mode: 'Markdown' 
  });
});

bot.onText(/\/getid/, (msg) => {
  const chatId = msg.chat.id;
  const chatTitle = msg.chat.title || 'Особистий чат';
  const chatType = msg.chat.type;
  
  const text = `🆔 **Інформація про чат:**\n\n` +
               `📛 Назва: \`${chatTitle}\`\n` +
               `🔢 ID: \`${chatId}\`\n` +
               `📎 Тип: \`${chatType}\``;
  
  bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

bot.on('callback_query', async (cb) => {
  const chatId = cb.message.chat.id;
  await bot.answerCallbackQuery(cb.id);

  switch (cb.data) {
    case 'explosion':
      sendExplosion(chatId);
      break;
    case 'currency':
      bot.sendMessage(chatId, '⏳ Завантажую курс...');
      getCurrency().then(t => bot.sendMessage(chatId, t, { parse_mode: 'Markdown' }));
      break;
    case 'fuel':
      bot.sendMessage(chatId, '⏳ Завантажую ціни на паливо...');
      getFuelPrices().then(t => bot.sendMessage(chatId, t, { parse_mode: 'Markdown' }));
      break;
    case 'about':
      const aboutText = '🧙‍♀️ **Про Мегумін**\n\n' +
                        'Я — архіволшебниця з Коносуби!\n' +
                        'Вмію тільки вибухову магію... ну і ще:\n\n' +
                        '💥 Вибухи по кнопці та о 18:00\n' +
                        '💱 Курси валют (Monobank)\n' +
                        '⛽ Ціни на паливо (Minfin)\n' +
                        '🎂 Автоматичні привітання з ДН\n' +
                        '🆔 Дізнатися ID чату (команда /getid)\n\n' +
                        '✨ _EXPLOSION!_';
      bot.sendMessage(chatId, aboutText, { parse_mode: 'Markdown' });
      break;
  }
});

function sendExplosion(chatId) {
  const text = '💥 **EXPLOSION!** 💥\n_Мегумін використала свою фірмову магію!_ 🔥';
  const explosionGifId = 'CgACAgQAAxkBAAMCadep_WqfcQ14s78soH2lBvQ3wkMAAngGAAK8muRQ4pvZxf4pVQY7BA';
  bot.sendAnimation(chatId, explosionGifId, { caption: text, parse_mode: 'Markdown' });
}

function getCurrency() {
  return new Promise((resolve) => {
    https.get('https://api.monobank.ua/bank/currency', { 
      headers: { 'User-Agent': 'Megumin-Bot/1.0' }, 
      timeout: 8000 
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const usd = json.find(r => r.currencyCodeA === 840 && r.currencyCodeB === 980);
          const eur = json.find(r => r.currencyCodeA === 978 && r.currencyCodeB === 980);
          let t = '💱 **Курс від Monobank**\n\n';
          if (usd) t += `🇺🇸 USD: 🟢 ${usd.rateBuy} / 🔴 ${usd.rateSell}\n`;
          if (eur) t += `🇪🇺 EUR: 🟢 ${eur.rateBuy} / 🔴 ${eur.rateSell}\n`;
          resolve(t + '\n🟢 купівля | 🔴 продаж');
        } catch { resolve('❌ Помилка завантаження курсу.'); }
      });
    }).on('error', () => resolve('❌ Помилка з\'єднання з курсом.'));
  });
}

function getFuelPrices() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'minfin.com.ua',
      path: '/api/currency/fuel/',
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://minfin.com.ua/currency/fuel/',
        'X-Requested-With': 'XMLHttpRequest'
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          let a92, a95, dt, gas;
          
          if (json.A95 || json.A92 || json.Diesel || json.Gas) {
            a95 = json.A95?.sale != null ? json.A95.sale.toFixed(2) : '—';
            a92 = json.A92?.sale != null ? json.A92.sale.toFixed(2) : '—';
            dt = json.Diesel?.sale != null ? json.Diesel.sale.toFixed(2) : '—';
            gas = json.Gas?.sale != null ? json.Gas.sale.toFixed(2) : '—';
          } else {
            a95 = '—'; a92 = '—'; dt = '—'; gas = '—';
          }
          
          const text = `⛽ **Паливо (середнє по Україні):**\n\n` +
                       `🟢 А-92: **${a92}** грн\n` +
                       `🔵 А-95: **${a95}** грн\n` +
                       `🔴 ДП: **${dt}** грн\n` +
                       `🟡 Газ: **${gas}** грн\n\n` +
                       `📅 Оновлено: ${new Date().toLocaleDateString('uk-UA')}`;
          resolve(text);
        } catch { resolve('❌ Не вдалося завантажити ціни на паливо.'); }
      });
    });
    req.on('error', () => resolve('❌ Помилка з\'єднання.'));
    req.on('timeout', () => { req.destroy(); resolve('⏱️ Таймаут.'); });
    req.end();
  });
}

function getTodayBirthdays() {
  const nowKyiv = new Date().toLocaleString('uk-UA', { 
    timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit' 
  });
  const [day, month] = nowKyiv.split('.');
  return BIRTHDAYS.filter(p => p.date === `${day}.${month}`);
}

setInterval(() => {
  const nowKyiv = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' });
  const [, timeStr] = nowKyiv.split(', ');
  const currentTime = timeStr.substring(0, 5);
  
  if (currentTime === "18:00" && !explosionSentToday && ADMIN_CHAT_ID) {
    sendExplosion(ADMIN_CHAT_ID);
    explosionSentToday = true;
  }
  if (currentTime === "09:00" && !birthdayNotifiedToday && ADMIN_CHAT_ID) {
    const today = getTodayBirthdays();
    if (today.length > 0) {
      const names = today.map(p => p.name).join(', ');
      bot.sendMessage(ADMIN_CHAT_ID, `🎉 **З Днем Народження!** 🎂\n✨ ${names}\n💥 EXPLOSION of happiness!`, { parse_mode: 'Markdown' });
      birthdayNotifiedToday = true;
    }
  }
  if (currentTime === "00:01") {
    explosionSentToday = false;
    birthdayNotifiedToday = false;
  }
}, 60000);

http.createServer((_, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('✅ Megumin Bot is alive! 💥');
}).listen(3000, () => console.log('🌐 Server on port 3000'));

console.log('✅ Мегумін запущена! 💥');
