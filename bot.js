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
try {
  // Спробуємо завантажити з файлу (локально)
  BIRTHDAYS = require('./birthdays.json');
} catch (e) {
  console.log('⚠️ birthdays.json не знайдено, використовуємо порожній список');
}

if (!BOT_TOKEN) {
  console.error('❌ ПОМИЛКА: Не знайдено BOT_TOKEN!');
  console.log('💡 Створи файл config.json і встав туди токен:');
  console.log('{ "BOT_TOKEN": "твій_токен_тут", "ADMIN_CHAT_ID": "-100..." }');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Стан: щоб не спамити "Explosion" щохвилини о 18:00
let explosionSentToday = false;
let birthdayNotifiedToday = false; // Щоб не вітати двічі за день

// ================= 📋 2. МЕНЮ (КНОПКИ) =================
const mainMenu = {
  inline_keyboard: [
    [{ text: '🆔 ID чату', callback_data: 'chat_id' }],
    [{ text: '💥 Explosion!', callback_data: 'explosion' }],
    [{ text: '💱 Курс валют', callback_data: 'currency' }]
  ]
};

// ================= 🔘 3. ОБРОБКА КОМАНД =================

// Команда /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 
    '🧙‍♀️ **Привіт! Я Мегумін!**\n\n' +
    'Магістр вибухової магії вже тут!\n' +
    'Натисни `/bot`, щоб побачити меню. 💥', 
    { parse_mode: 'Markdown' }
  );
});

// Команда /bot (відкриває меню)
bot.onText(/\/bot/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '📋 **Головне меню**\nОбери потрібну функцію:', { 
    reply_markup: mainMenu, 
    parse_mode: 'Markdown' 
  });
});

// Обробка натискань на кнопки
bot.on('callback_query', async (cb) => {
  const chatId = cb.message.chat.id;
  await bot.answerCallbackQuery(cb.id);

  switch (cb.data) {
    case 'chat_id':
      bot.sendMessage(chatId, `🆔 **ID цього чату:**\n\`${chatId}\``, { parse_mode: 'Markdown' });
      break;
      
    case 'explosion':
      sendExplosion(chatId);
      break;
      
    case 'currency':
      bot.sendMessage(chatId, '⏳ Завантажую курс...').then(() => {
        getCurrency().then(text => {
          bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
        });
      });
      break;
  }
});

// ================= 💥 ФУНКЦІЯ "EXPLOSION" =================
function sendExplosion(chatId) {
  const text = '💥 **EXPLOSION!** 💥\n_Мегумін використала свою фірмову магію!_ 🔥';
  const explosionGifId = 'CgACAgQAAxkBAAMCadep_WqfcQ14s78soH2lBvQ3wkMAAngGAAK8muRQ4pvZxf4pVQY7BA';
  
  bot.sendAnimation(chatId, explosionGifId, {
    caption: text,
    parse_mode: 'Markdown'
  });
}

// ================= 💱 ФУНКЦІЯ "КУРС ВАЛЮТ" =================
function getCurrency() {
  return new Promise((resolve) => {
    https.get('https://api.monobank.ua/bank/currency', { 
      headers: { 'User-Agent': 'Megumin-Bot' }, 
      timeout: 5000 
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const usd = json.find(r => r.currencyCodeA === 840 && r.currencyCodeB === 980);
          const eur = json.find(r => r.currencyCodeA === 978 && r.currencyCodeB === 980);
          
          let text = '💱 **Курс від Monobank**\n\n';
          if (usd) text += `🇺🇸 USD: 🟢 ${usd.rateBuy} / 🔴 ${usd.rateSell}\n`;
          if (eur) text += `🇪🇺 EUR: 🟢 ${eur.rateBuy} / 🔴 ${eur.rateSell}\n`;
          
          resolve(text + '\n🟢 купівля | 🔴 продаж');
        } catch {
          resolve('❌ Помилка завантаження курсу.');
        }
      });
    }).on('error', () => resolve('❌ Помилка завантаження курсу.'));
  });
}

// ================= 🎂 ФУНКЦІЯ "ДНІ НАРОДЖЕННЯ" =================
function getTodayBirthdays() {
  // Отримуємо сьогоднішню дату у форматі "ДД.ММ" за київським часом
  const nowKyiv = new Date().toLocaleString('uk-UA', { 
    timeZone: 'Europe/Kyiv', 
    day: '2-digit', 
    month: '2-digit' 
  });
  const [day, month] = nowKyiv.split('.');
  const today = `${day}.${month}`;
  
  // Фільтруємо список по сьогоднішній даті
  return BIRTHDAYS.filter(person => person.date === today);
}

// ================= ⏰ АВТО-ЗАВДАННЯ (Кожну хвилину) =================
setInterval(() => {
  // Час по Києву
  const nowKyiv = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' });
  const [dateStr, timeStr] = nowKyiv.split(', ');
  const currentTime = timeStr.substring(0, 5); // "HH:MM"
  
  // 🎯 Автоматичний вибух о 18:00
  if (currentTime === "18:00" && !explosionSentToday && ADMIN_CHAT_ID) {
    sendExplosion(ADMIN_CHAT_ID);
    explosionSentToday = true;
    console.log(`💥 ${currentTime} - Explosion надіслано!`);
  }
  
  // 🎂 Автоматичне привітання з ДН о 09:00 (прихована функція)
  if (currentTime === "09:00" && !birthdayNotifiedToday && ADMIN_CHAT_ID) {
    const todayBirthdays = getTodayBirthdays();
    if (todayBirthdays.length > 0) {
      const names = todayBirthdays.map(p => p.name).join(', ');
      const greeting = `🎉 **Увага! Сьогодні святкують!** 🎂\n` +
        `✨ ${names} — вітаю від усього магічного серця!\n` +
        `🧙‍♀️ _Нехай цей день буде сповнений магії та радості!_\n` +
        `💥 **EXPLOSION of happiness!**`;
      
      bot.sendMessage(ADMIN_CHAT_ID, greeting, { parse_mode: 'Markdown' });
      birthdayNotifiedToday = true;
      console.log(`🎂 ${currentTime} - Привітання з ДН надіслано!`);
    }
  }
  
  // Скидаємо ліміти опівночі, щоб завтра знову спрацювало
  if (currentTime === "00:01") {
    explosionSentToday = false;
    birthdayNotifiedToday = false;
  }
  
}, 60000); // Запускається кожні 60 секунд

// ================= 🌐 4. HTTP СЕРВЕР (Для Render) =================
http.createServer((_, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('✅ Megumin Bot is alive! 💥');
}).listen(3000, () => console.log('🌐 Server on port 3000'));

console.log('✅ Мегумін запущена! Використовуй /bot для меню. 💥');