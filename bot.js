const TelegramBot = require('node-telegram-bot-api');
const http = require('http');

// ================= 📦 1. ЗАВАНТАЖЕННЯ НАЛАШТУВАНЬ =================
let localConfig = {};
try { localConfig = require('./config.json'); } catch (e) {}

const BOT_TOKEN = process.env.BOT_TOKEN || localConfig.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || localConfig.ADMIN_CHAT_ID;

if (!BOT_TOKEN) {
  console.error('❌ ПОМИЛКА: Не знайдено BOT_TOKEN!');
  console.log('💡 Створи файл config.json і встав туди токен:');
  console.log('{ "BOT_TOKEN": "твій_токен_тут", "ADMIN_CHAT_ID": "-100..." }');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Стан: щоб не спамити "Explosion" щохвилини о 18:00
let explosionSentToday = false;

// ================= 📋 2. МЕНЮ (КНОПКИ) =================
const mainMenu = {
  inline_keyboard: [
    [{ text: '🆔 ID чату', callback_data: 'chat_id' }],
    [{ text: '💥 Explosion!', callback_data: 'explosion' }]
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
  }
});

// ================= 💥 ФУНКЦІЯ "EXPLOSION" =================
function sendExplosion(chatId) {
  const text = '💥 **EXPLOSION!** 💥\n_Мегумін використала свою фірмову магію!_ 🔥';
  
  // Твій GIF (file_id)
  const explosionGifId = 'CgACAgQAAxkBAAMCadep_WqfcQ14s78soH2lBvQ3wkMAAngGAAK8muRQ4pvZxf4pVQY7BA';
  
  bot.sendAnimation(chatId, explosionGifId, {
    caption: text,
    parse_mode: 'Markdown'
  });
}

// Тимчасова команда для отримання file_id
bot.on('message', (msg) => {
  if (msg.animation) {
    const fileId = msg.animation.file_id;
    bot.sendMessage(msg.chat.id, `🎬 **File ID:**\n\`${fileId}\``, { parse_mode: 'Markdown' });
    console.log('GIF File ID:', fileId);
  }
});

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
  
  // Скидаємо ліміт опівночі, щоб завтра знову спрацювало
  if (currentTime === "00:01") {
    explosionSentToday = false;
  }
  
}, 60000); // Запускається кожні 60 секунд

// ================= 🌐 4. HTTP СЕРВЕР (Для Render) =================
http.createServer((_, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('✅ Megumin Bot is alive! 💥');
}).listen(3000, () => console.log('🌐 Server on port 3000'));

console.log('✅ Мегумін запущена! Використовуй /bot для меню. 💥');