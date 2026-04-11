const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const fs = require('fs');
const path = require('path');
const dota = require('./dota.js');

// 🔐 ENV
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = Number(process.env.ADMIN_CHAT_ID);

// 📦 MODULES
const birthdays = require('./birthdays.js');
const { getCurrency } = require('./currency.js');

// 🔄 INIT DATA (SAFE)
birthdays.loadBirthdays();
dota.loadPlayers();

// ⚠️ IMPORTANT: HEROES must finish loading before usage
(async () => {
  await dota.loadHeroes();
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

// 🔥 TOKEN CHECK
if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN not found');
  process.exit(1);
}

// 🤖 BOT INIT
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
bot.deleteWebHook();

// FLAGS
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
bot.on('callback_query', async (cb) => {
  const chatId = cb.message.chat.id;
  await bot.answerCallbackQuery(cb.id);

  // 🎮 MENU
  if (cb.data === 'dota_menu') {
    const keyboard = dota.getPlayersKeyboard();

    bot.sendMessage(
      chatId,
      '🎮 *Оберіть гравця:*\n_Останні 100 Turbo матчів_',
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }
    );
    return;
  }

  // 🎮 PLAYER STATS
  if (cb.data.startsWith('dota_player:')) {
    const playerId = cb.data.split(':')[1];

    const loadingMsg = await bot.sendMessage(
      chatId,
      '⏳ Завантаження статистики...'
    );

    try {
      const result = await dota.getPlayerStats(playerId);

      await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});

      // 🧠 SAFE HANDLING
      if (!result) {
        return bot.sendMessage(chatId, '❌ Порожня відповідь');
      }

      if (typeof result === 'string') {
        return bot.sendMessage(chatId, result, { parse_mode: 'Markdown' });
      }

      if (result.photo) {
        return bot.sendPhoto(chatId, result.photo, {
          caption: result.text || '📊 Dota stats',
          parse_mode: 'Markdown'
        });
      }

      return bot.sendMessage(chatId, result.text || '❌ Немає даних', {
        parse_mode: 'Markdown'
      });

    } catch (err) {
      console.error('❌ Dota error:', err.message);

      await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});

      let errorMsg = '❌ Помилка отримання даних';

      if (err.message.includes('404')) {
        errorMsg = '❌ Профіль не знайдено або приватний';
      }

      if (err.message === 'TIMEOUT') {
        errorMsg = '⏰ OpenDota не відповідає';
      }

      bot.sendMessage(chatId, errorMsg);
    }

    return;
  }

  // 💥 EXPLOSION
  if (cb.data === 'explosion') {
    sendExplosion(chatId);
  }

  // 💱 CURRENCY
  if (cb.data === 'currency') {
    bot.sendMessage(chatId, '⏳ Завантажую курс...');

    getCurrency()
      .then(text =>
        bot.sendMessage(chatId, text, { parse_mode: 'Markdown' })
      )
      .catch(() =>
        bot.sendMessage(chatId, '❌ Помилка курсу')
      );
  }

  // 🧙 ABOUT
  if (cb.data === 'about') {
    try {
      await bot.sendMessage(chatId, botInfo.about, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });

      const gifPath = path.join(__dirname, 'gif', 'anime-megumin.mp4');

      if (fs.existsSync(gifPath)) {
        await bot.sendVideo(chatId, gifPath);
      }

    } catch (err) {
      console.error('❌ About error:', err.message);
    }
  }
});

// ================= EXPLOSION =================
function sendExplosion(chatId) {
  const videoPath = path.join(__dirname, 'gif', 'megumin_explosion.mp4');

  if (fs.existsSync(videoPath)) {
    bot.sendVideo(chatId, videoPath, { caption: '💥 EXPLOSION!' });
  } else {
    bot.sendMessage(chatId, '💥 EXPLOSION!');
  }
}

// ================= AUTO TASKS =================
setInterval(() => {
  const kyiv = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Europe/Kyiv' })
  );

  const time = `${kyiv.getHours().toString().padStart(2, '0')}:${kyiv
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;

  if (time === '18:00' && !explosionSentToday && ADMIN_CHAT_ID) {
    sendExplosion(ADMIN_CHAT_ID);
    explosionSentToday = true;
  }

  if (time === '12:00' && !birthdayNotifiedToday && ADMIN_CHAT_ID) {
    const today = birthdays.getTodayBirthdays();

    if (today.length > 0) {
      const names = today.map(p => p.name);
      birthdays.sendBirthdayGreeting(bot, ADMIN_CHAT_ID, names);
    }

    birthdayNotifiedToday = true;
  }

  if (time === '00:01') {
    explosionSentToday = false;
    birthdayNotifiedToday = false;
  }
}, 60000);

// ================= SERVER =================
const PORT = process.env.PORT || 3000;

http.createServer((_, res) => res.end('OK')).listen(PORT);

console.log('✅ Bot started');