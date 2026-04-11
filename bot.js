const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const fs = require('fs');
const path = require('path');
const dota = require('./dota.js');

// 🔐 ENV
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = Number(process.env.ADMIN_CHAT_ID);

// 📦 МОДУЛІ
const birthdays = require('./birthdays.js');
const { getCurrency } = require('./currency.js');

// 🔄 ЗАВАНТАЖЕННЯ ДАНИХ
birthdays.loadBirthdays();
dota.loadPlayers();

// 📖 info_bot.json
let botInfo;
try {
  const rawData = fs.readFileSync('info_bot.json', 'utf8');
  botInfo = JSON.parse(rawData);

  if (!botInfo.about) {
    throw new Error('У файлі відсутній ключ "about"');
  }

  console.log('✅ info_bot.json завантажено');
} catch (err) {
  console.error('❌ ПОМИЛКА info_bot.json:', err.message);
  process.exit(1);
}

// 🔥 Перевірка токену
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
    [{ text: '🎮 Dota 2 статистика', callback_data: 'dota_menu' }],
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

  // 🎮 DOTA МЕНЮ
  if (cb.data === 'dota_menu') {
    const keyboard = dota.getPlayersKeyboard();

    if (keyboard.inline_keyboard.length > 0) {
      bot.sendMessage(
        chatId,
        '🎮 *Оберіть гравця:*\n_Показано останні 100 матчів (включаючи Turbo)_',
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        }
      );
    } else {
      bot.sendMessage(chatId, '❌ Список гравців порожній.');
    }
    return;
  }

  // 🎮 СТАТИСТИКА
  if (cb.data.startsWith('dota_player:')) {
    const playerId = cb.data.split(':')[1];

    bot.sendMessage(
      chatId,
      '⏳ *Завантаження 100 матчів (включаючи Turbo)...*',
      { parse_mode: 'Markdown' }
    ).then(sentMsg => {

      dota.getPlayerStats(playerId)
        .then(result => {
          bot.deleteMessage(chatId, sentMsg.message_id).catch(() => {});

          if (typeof result === 'string') {
            bot.sendMessage(chatId, result, { parse_mode: 'Markdown' });
          } 
          else if (result.photo) {
            // ✅ ВИПРАВЛЕНО caption
            bot.sendPhoto(chatId, result.photo, {
              caption: result.caption,
              parse_mode: 'Markdown'
            });
          } 
          else {
            bot.sendMessage(chatId, result.text, {
              parse_mode: 'Markdown'
            });
          }
        })
        .catch(err => {
          bot.deleteMessage(chatId, sentMsg.message_id).catch(() => {});
          console.error('❌ Dota API Error:', err.message);

          let errorMsg = '❌ Не вдалося отримати дані';

          if (err.message === 'TIMEOUT')
            errorMsg = '⏰ OpenDota не відповідає, спробуй ще раз';

          if (err.message.includes('404'))
            errorMsg = '❌ Профіль не знайдено або приватний';

          bot.sendMessage(chatId, errorMsg);
        });

    });

    return;
  }

  // 💥 EXPLOSION
  if (cb.data === 'explosion') {
    sendExplosion(chatId);
  }

  // 💱 КУРС
  if (cb.data === 'currency') {
    bot.sendMessage(chatId, '⏳ Завантажую курс...');
    getCurrency()
      .then(text => bot.sendMessage(chatId, text, { parse_mode: 'Markdown' }))
      .catch(() => bot.sendMessage(chatId, '❌ Не вдалося отримати курс'));
  }

  // 🧙‍♀️ ПРО МЕГУМІН
  if (cb.data === 'about') {
    try {
      await bot.sendMessage(chatId, botInfo.about, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });

      const gifPath = path.join(__dirname, 'gif', 'anime-megumin.mp4');

      if (fs.existsSync(gifPath)) {
        await bot.sendVideo(chatId, gifPath);
      } else {
        console.error('❌ anime-megumin.mp4 не знайдено');
      }
    } catch (err) {
      console.error('❌ Помилка about:', err.message);
    }
  }
});

// ================= ФУНКЦІЇ =================
function sendExplosion(chatId) {
  const videoPath = path.join(__dirname, 'gif', 'megumin_explosion.mp4');

  if (fs.existsSync(videoPath)) {
    bot.sendVideo(chatId, videoPath, { caption: '💥 EXPLOSION!' });
  } else {
    bot.sendMessage(chatId, '💥 EXPLOSION! (відео не знайдено)');
  }
}

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
      console.log('🎂 Birthday:', names.join(', '));
    } else {
      console.log('📭 Немає ДН');
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
http.createServer((_, res) => res.end('OK')).listen(PORT);

console.log('✅ Bot started');