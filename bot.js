const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron'); // ✅ Додано для розкладу
const dota = require('./dota.js');

// 🔐 ENV + ВАЛІДАЦІЯ
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = parseInt(process.env.ADMIN_CHAT_ID, 10);

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN not set in Render environment variables');
  process.exit(1);
}

if (isNaN(ADMIN_CHAT_ID)) {
  console.error('❌ ADMIN_CHAT_ID must be a number in Render environment variables');
  process.exit(1);
}

// 📦 MODULES
const birthdays = require('./birthdays.js');
const { getCurrency } = require('./currency.js');

// 🔄 INIT DATA (SAFE)
birthdays.loadBirthdays();
dota.loadPlayers();

// ⚠️ IMPORTANT: HEROES must finish loading before usage
(async () => {
  try {
    await dota.loadHeroes();
    console.log('✅ Heroes loaded');
  } catch (err) {
    console.error('❌ Failed to load heroes:', err.message);
  }
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

  try {
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
      if (!playerId) throw new Error('Invalid player ID');

      const loadingMsg = await bot.sendMessage(
        chatId,
        '⏳ Завантаження статистики...'
      );

      try {
        const result = await dota.getPlayerStats(playerId);
        await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});

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
        if (err.message?.includes('404')) {
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
  } catch (err) {
    console.error('❌ Callback error:', err.message);
    bot.sendMessage(chatId, '❌ Внутрішня помилка').catch(() => {});
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

// ================= AUTO TASKS (CRON) =================

// 🎂 Щодня о 12:00 за Києвом — дні народження
cron.schedule('0 12 * * *', () => {
  console.log('🔍 Checking birthdays...');
  if (!ADMIN_CHAT_ID) return;
  
  const today = birthdays.getTodayBirthdays();
  if (today.length > 0) {
    const names = today.map(p => p.name);
    birthdays.sendBirthdayGreeting(bot, ADMIN_CHAT_ID, names);
    console.log(`🎉 Birthday greetings sent to: ${names.join(', ')}`);
  }
}, {
  timezone: 'Europe/Kyiv'
});

// 🔄 Щодня о 00:01 — скидання прапорців
cron.schedule('1 0 * * *', () => {
  explosionSentToday = false;
  birthdayNotifiedToday = false;
  console.log('🔄 Daily flags reset');
}, {
  timezone: 'Europe/Kyiv'
});

// ================= SERVER =================
const PORT = process.env.PORT || 3000;
http.createServer((_, res) => res.end('OK')).listen(PORT);

// ================= GLOBAL ERROR HANDLERS =================
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  process.exit(1);
});

console.log('✅ Bot started');