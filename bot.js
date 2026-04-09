const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const https = require('https');

// ================= 📦 1. ЗАВАНТАЖЕННЯ НАЛАШТУВАНЬ =================
let localConfig = {};
try { localConfig = require('./config.json'); } catch (e) {}

const BOT_TOKEN = process.env.BOT_TOKEN || localConfig.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || localConfig.ADMIN_CHAT_ID;

// 🎂 Завантаження списку днів народження
let BIRTHDAYS = [];
try { BIRTHDAYS = require('./birthdays.json'); } catch (e) {}

if (!BOT_TOKEN) {
  console.error('❌ ПОМИЛКА: Не знайдено BOT_TOKEN!');
  process.exit(1);
}

// 🔄 Вибір режиму: polling для локалки, webhook для Render
const isProduction = process.env.RENDER_EXTERNAL_URL || process.env.NODE_ENV === 'production';

const botOptions = isProduction ? {
  webhook: {
    allowedUpdates: ['message', 'callback_query', 'inline_query'],
    host: process.env.RENDER_EXTERNAL_URL?.replace('https://', '')
  }
} : {
  polling: true
};

const bot = new TelegramBot(BOT_TOKEN, botOptions);

// Встановлення webhook для Render
if (isProduction && process.env.RENDER_EXTERNAL_URL) {
  const webhookUrl = `${process.env.RENDER_EXTERNAL_URL}/bot${BOT_TOKEN}`;
  bot.setWebHook(webhookUrl).then(() => {
    console.log(`🔗 Webhook встановлено: ${webhookUrl}`);
  }).catch(err => {
    console.error('❌ Помилка встановлення webhook:', err.message);
  });
}

// Стани для авто-завдань
let explosionSentToday = false;
let birthdayNotifiedToday = false;

// ================= 📋 2. МЕНЮ (КНОПКИ) =================
const mainMenu = {
  inline_keyboard: [
    [{ text: '💥 Explosion!', callback_data: 'explosion' }],
    [{ text: '💱 Курс валют', callback_data: 'currency' }],
    [{ text: '⛽ Ціни на паливо', callback_data: 'fuel' }],
    [{ text: '🧙‍♀️ Про Мегумін', callback_data: 'about' }]
  ]
};

// ================= 🔘 3. ОБРОБКА КОМАНД =================

// Команда /start
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 
    '🧙‍♀️ **Привіт! Я Мегумін!**\n\n' +
    'Магістр вибухової магії вже тут!\n' +
    'Натисни `/bot`, щоб побачити меню. 💥', 
    { parse_mode: 'Markdown' }
  );
});

// Команда /bot (відкриває меню)
bot.onText(/\/bot/, (msg) => {
  bot.sendMessage(msg.chat.id, '📋 **Головне меню**\nОбери потрібну функцію:', { 
    reply_markup: mainMenu, 
    parse_mode: 'Markdown' 
  });
});

// 🆔 Нова команда /getid (замість кнопки)
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

// ================= 🔌 ОБРОБКА КНОПОК =================
bot.on('callback_query', async (cb) => {
  const chatId = cb.message.chat.id;
  await bot.answerCallbackQuery(cb.id);

  switch (cb.data) {
    case 'explosion':
      sendExplosion(chatId);
      break;
      
    case 'currency':
      bot.sendMessage(chatId, '⏳ Завантажую курс...').then(() => {
        getCurrency().then(t => bot.sendMessage(chatId, t, { parse_mode: 'Markdown' }));
      });
      break;
      
    case 'fuel':
      bot.sendMessage(chatId, '⏳ Завантажую ціни на паливо...').then(() => {
        getFuelPrices().then(t => bot.sendMessage(chatId, t, { parse_mode: 'Markdown' }));
      });
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

// ================= ⚙️ ФУНКЦІЇ =================

// 💥 Вибух
function sendExplosion(chatId) {
  const text = '💥 **EXPLOSION!** 💥\n_Мегумін використала свою фірмову магію!_ 🔥';
  const explosionGifId = 'CgACAgQAAxkBAAMCadep_WqfcQ14s78soH2lBvQ3wkMAAngGAAK8muRQ4pvZxf4pVQY7BA';
  bot.sendAnimation(chatId, explosionGifId, { caption: text, parse_mode: 'Markdown' });
}

// 💱 Курс валют (виправлено URL)
function getCurrency() {
  return new Promise((resolve) => {
    // ✅ Видалено зайві пробіли в URL
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
        } catch (err) {
          console.error('❌ Currency parse error:', err.message);
          resolve('❌ Помилка завантаження курсу.');
        }
      });
    }).on('error', (err) => {
      console.error('❌ Currency request error:', err.message);
      resolve('❌ Помилка з\'єднання з курсом.');
    });
  });
}

// ⛽ Ціни на паливо (виправлено URL + покращено обробку)
function getFuelPrices() {
  return new Promise((resolve) => {
    // ✅ Видалено зайві пробіли в URL
    const options = {
      hostname: 'minfin.com.ua',
      path: '/api/currency/fuel/',
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://minfin.com.ua/'
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', chunk => data += chunk);
      
      res.on('end', () => {
        try {
          // 🔍 Логування для відладки (бачитимете в Render logs)
          console.log('📦 Fuel API raw response:', data.substring(0, 300));
          
          const json = JSON.parse(data);
          
          // Перевірка, чи є дані
          if (!json || typeof json !== 'object') {
            throw new Error('Invalid API response structure');
          }
          
          // Безпечне отримання цін з fallback
          const a95 = json.A95?.sale != null ? json.A95.sale.toFixed(2) : '—';
          const a92 = json.A92?.sale != null ? json.A92.sale.toFixed(2) : '—';
          const dt = json.Diesel?.sale != null ? json.Diesel.sale.toFixed(2) : '—';
          const gas = json.Gas?.sale != null ? json.Gas.sale.toFixed(2) : '—';
          
          const text = `⛽ **Паливо (середнє по Україні):**\n\n` +
                       `🟢 А-92: **${a92}** грн\n` +
                       `🔵 А-95: **${a95}** грн\n` +
                       `🔴 ДП: **${dt}** грн\n` +
                       `🟡 Газ: **${gas}** грн\n\n` +
                       `📅 Оновлено: ${new Date().toLocaleDateString('uk-UA')}`;
          
          resolve(text);
        } catch (err) {
          console.error('❌ Fuel API error:', err.message);
          console.error('📄 Raw response:', data);
          resolve('❌ Не вдалося завантажити ціни на паливо. Спробуйте пізніше.');
        }
      });
    });

    req.on('error', (err) => {
      console.error('❌ Fuel request error:', err.message);
      resolve('❌ Помилка з\'єднання з API палива.');
    });

    req.on('timeout', () => {
      req.destroy();
      console.error('⏱️ Fuel API timeout');
      resolve('⏱️ Перевищено час очікування. Спробуйте пізніше.');
    });

    req.end();
  });
}

// 🎂 Пошук іменинників на сьогодні
function getTodayBirthdays() {
  const nowKyiv = new Date().toLocaleString('uk-UA', { 
    timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit' 
  });
  const [day, month] = nowKyiv.split('.');
  return BIRTHDAYS.filter(p => p.date === `${day}.${month}`);
}

// ================= ⏰ АВТО-ЗАВДАННЯ (Кожну хвилину) =================
setInterval(() => {
  const nowKyiv = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' });
  const [dateStr, timeStr] = nowKyiv.split(', ');
  const currentTime = timeStr.substring(0, 5);
  
  // 💥 Автоматичний вибух о 18:00
  if (currentTime === "18:00" && !explosionSentToday && ADMIN_CHAT_ID) {
    sendExplosion(ADMIN_CHAT_ID);
    explosionSentToday = true;
    console.log(`💥 ${currentTime} - Explosion надіслано!`);
  }
  
  // 🎂 Автоматичне привітання з ДН о 09:00
  if (currentTime === "09:00" && !birthdayNotifiedToday && ADMIN_CHAT_ID) {
    const today = getTodayBirthdays();
    if (today.length > 0) {
      const names = today.map(p => p.name).join(', ');
      const greeting = `🎉 **Увага! Сьогодні святкують!** 🎂\n` +
        `✨ ${names} — вітаю від усього магічного серця!\n` +
        `🧙‍♀️ _Нехай цей день буде сповнений магії та радості!_\n` +
        `💥 **EXPLOSION of happiness!**`;
      
      bot.sendMessage(ADMIN_CHAT_ID, greeting, { parse_mode: 'Markdown' });
      birthdayNotifiedToday = true;
      console.log(`🎂 ${currentTime} - Привітання з ДН надіслано!`);
    }
  }
  
  // Скидання лімітів опівночі
  if (currentTime === "00:01") {
    explosionSentToday = false;
    birthdayNotifiedToday = false;
  }
}, 60000);

// ================= 🌐 HTTP СЕРВЕР (Для Render) =================
http.createServer((req, res) => {
  // Обробка webhook запитів від Telegram
  if (isProduction && req.method === 'POST' && req.url === `/bot${BOT_TOKEN}`) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        bot.processUpdate(JSON.parse(body));
        res.writeHead(200);
        res.end('OK');
      } catch (e) {
        console.error('❌ Webhook processing error:', e.message);
        res.writeHead(500);
        res.end('Error');
      }
    });
  } else {
    // Звичайний health check
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('✅ Megumin Bot is alive! 💥');
  }
}).listen(3000, () => console.log('🌐 Server on port 3000'));

console.log('✅ Мегумін запущена! Використовуй /bot для меню. 💥');