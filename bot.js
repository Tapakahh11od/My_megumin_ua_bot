const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const https = require('https');

// ================= 📦 1. ЗАВАНТАЖЕННЯ НАЛАШТУВАНЬ =================
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

// ================= 📋 2. МЕНЮ (КНОПКИ) =================
const mainMenu = {
  inline_keyboard: [
    [{ text: '💥 Explosion!', callback_ 'explosion' }],
    [{ text: '💱 Курс валют', callback_ 'currency' }],
    [{ text: '⛽ Ціни на паливо', callback_ 'fuel' }],
    [{ text: '🧙‍♀️ Про Мегумін', callback_ 'about' }]
  ]
};

// ================= 🔘 3. ОБРОБКА КОМАНД =================
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

// ================= 🔌 ОБРОБКА КНОПОК =================
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

// ================= ⚙️ ФУНКЦІЇ =================
function sendExplosion(chatId) {
  const text = '💥 **EXPLOSION!** 💥\n_Мегумін використала свою фірмову магію!_ 🔥';
  const explosionGifId = 'CgACAgQAAxkBAAMCadep_WqfcQ14s78soH2lBvQ3wkMAAngGAAK8muRQ4pvZxf4pVQY7BA';
  bot.sendAnimation(chatId, explosionGifId, { caption: text, parse_mode: 'Markdown' });
}

// 💱 Курс валют
function getCurrency() {
  return new Promise((resolve) => {
    // ✅ ВИПРАВЛЕНО: видалено пробіли в кінці URL
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
        } catch { 
          resolve('❌ Помилка завантаження курсу.'); 
        }
      });
    }).on('error', () => {
      resolve('❌ Помилка з\'єднання з курсом.');
    });
  });
}

// ⛽ Ціни на паливо
function getFuelPrices() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'minfin.com.ua',
      path: '/api/currency/fuel/',
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7',
        // ✅ ВИПРАВЛЕНО: видалено пробіли в кінці URL
        'Referer': 'https://minfin.com.ua/currency/fuel/',
        'X-Requested-With': 'XMLHttpRequest'
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      console.log(`📡 Fuel API Status: ${res.statusCode}`);
      
      res.on('data', chunk => data += chunk);
      
      res.on('end', () => {
        try {
          console.log('📦 Fuel API Raw Response:', data.substring(0, 500));
          
          const json = JSON.parse(data);
          
          let a92, a95, dt, gas;
          
          if (json.A95 || json.A92 || json.Diesel || json.Gas) {
            a95 = json.A95?.sale != null ? json.A95.sale.toFixed(2) : '—';
            a92 = json.A92?.sale != null ? json.A92.sale.toFixed(2) : '—';
            dt = json.Diesel?.sale != null ? json.Diesel.sale.toFixed(2) : '—';
            gas = json.Gas?.sale != null ? json.Gas.sale.toFixed(2) : '—';
          }
          else if (Array.isArray(json.fuels) || Array.isArray(json)) {
            const fuels = json.fuels || json;
            a95 = '—'; a92 = '—'; dt = '—'; gas = '—';
            
            fuels.forEach(fuel => {
              const name = (fuel.name || fuel.type || '').toUpperCase();
              const price = fuel.price || fuel.sale || fuel.cost;
              
              if (name.includes('А-92') || name.includes('AI-92')) a92 = price.toFixed(2);
              else if (name.includes('А-95') || name.includes('AI-95')) a95 = price.toFixed(2);
              else if (name.includes('ДП') || name.includes('DT') || name.includes('DIESEL')) dt = price.toFixed(2);
              else if (name.includes('ГАЗ') || name.includes('GAS')) gas = price.toFixed(2);
            });
          }
          else if (typeof json === 'object') {
            a95 = json.a95 || json.A95 || json['А-95'] || '—';
            a92 = json.a92 || json.A92 || json['А-92'] || '—';
            dt = json.dt || json.Diesel || json.DT || json['ДП'] || '—';
            gas = json.gas || json.Gas || json.GAS || json['ГАЗ'] || '—';
            
            if (typeof a95 === 'number') a95 = a95.toFixed(2);
            if (typeof a92 === 'number') a92 = a92.toFixed(2);
            if (typeof dt === 'number') dt = dt.toFixed(2);
            if (typeof gas === 'number') gas = gas.toFixed(2);
          }
          else {
            throw new Error('Unknown format');
          }
          
          const text = `⛽ **Паливо (середнє по Україні):**\n\n` +
                       `🟢 А-92: **${a92}** грн\n` +
                       `🔵 А-95: **${a95}** грн\n` +
                       `🔴 ДП: **${dt}** грн\n` +
                       `🟡 Газ: **${gas}** грн\n\n` +
                       `📅 Оновлено: ${new Date().toLocaleDateString('uk-UA')} ${new Date().toLocaleTimeString('uk-UA', {hour: '2-digit', minute:'2-digit'})}`;
          
          resolve(text);
        } catch (err) {
          console.error('❌ Fuel parse error:', err.message);
          console.error('📄 Raw response:', data);
          
          resolve('⛽ **Паливо**\n\nТимчасово недоступно. Спробуйте пізніше. 🔧\n\n_Можливо, API Minfin тимчасово не працює._');
        }
      });
    });

    req.on('error', (err) => {
      console.error('❌ Fuel request error:', err.message);
      resolve('❌ Помилка з\'єднання з API палива. Спробуйте пізніше.');
    });

    req.on('timeout', () => {
      req.destroy();
      console.error('⏱️ Fuel API timeout');
      resolve('⏱️ Перевищено час очікування. Спробуйте пізніше.');
    });

    req.end();
  });
}

// 🎂 Іменинники
function getTodayBirthdays() {
  const nowKyiv = new Date().toLocaleString('uk-UA', { 
    timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit' 
  });
  const [day, month] = nowKyiv.split('.');
  return BIRTHDAYS.filter(p => p.date === `${day}.${month}`);
}

// ================= ⏰ АВТО-ЗАВДАННЯ =================
setInterval(() => {
  const nowKyiv = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' });
  const [, timeStr] = nowKyiv.split(', ');
  const currentTime = timeStr.substring(0, 5);
  
  if (currentTime === "18:00" && !explosionSentToday && ADMIN_CHAT_ID) {
    sendExplosion(ADMIN_CHAT_ID);
    explosionSentToday = true;
    console.log(`💥 ${currentTime} - Explosion sent!`);
  }
  
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
      console.log(`🎂 ${currentTime} - Birthday greeting sent!`);
    }
  }
  
  if (currentTime === "00:01") {
    explosionSentToday = false;
    birthdayNotifiedToday = false;
  }
}, 60000);

// ================= 🌐 Простий сервер для health check =================
http.createServer((_, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('✅ Megumin Bot is alive! 💥');
}).listen(3000, () => console.log('🌐 Server on port 3000'));

console.log('✅ Мегумін запущена! Використовуй /bot для меню. 💥');