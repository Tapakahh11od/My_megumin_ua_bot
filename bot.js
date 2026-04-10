const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const https = require('https');

// 🔐 ENV
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = Number(process.env.ADMIN_CHAT_ID);

// 📦 Конфіги				  
let BIRTHDAYS = [];
try { BIRTHDAYS = require('./birthdays.json'); } catch {}

let PLAYERS = [];
try { PLAYERS = require('./players.json').players; } catch {}

// 📖 Опис бота (окремий файл)
let BOT_INFO = { about: '🧙‍♀️ Привіт! Я Мегумін! 💥' }; // Резерв
try { BOT_INFO = require('./info_bot.json'); } catch (e) {
  console.log('⚠️ info_bot.json не знайдено, використовується стандартний опис');
}

// 🔥 Перевірка токенів
if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN not found');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
bot.deleteWebHook(); // 🔥 фікс 409

let waitingForMedia = {};

// ================= МЕНЮ =================
const mainMenu = {
  inline_keyboard: [
    [{ text: '💥 Explosion!', callback_data: 'explosion' }],
    [{ text: '💱 Курс валют', callback_data: 'currency' }],
    [{ text: '🎮 Dota 2 статистика', callback_data: 'dota_menu' }],
    [{ text: '🧙‍♀️ Про Мегумін', callback_data: 'about' }],
    [{ text: '🆔 Отримати File ID', callback_data: 'get_file_id' }]
  ]
};

function getPlayerMenu() {
  const keyboard = PLAYERS.map(p => [{
    text: p.name,
    callback_data: `dota_select_${p.id}`
  }]);

  keyboard.push([{ text: '🔙 Назад', callback_data: 'back_to_main' }]);

  return { inline_keyboard: keyboard };
}

function getGamesCountMenu(playerId) {
  return {
    inline_keyboard: [
      [{ text: '📈 10 ігор', callback_data: `dota_stats_${playerId}_10` }],
      [{ text: '📊 50 ігор', callback_data: `dota_stats_${playerId}_50` }],
      [{ text: '📉 100 ігор', callback_data: `dota_stats_${playerId}_100` }],
      [{ text: '🔙 Назад', callback_data: 'dota_menu' }]
    ]
  };
}

// ================= КОМАНДИ =================
bot.onText(/\/start/, msg => {
  bot.sendMessage(msg.chat.id, '🧙‍♀️ Привіт!\nНатисни /bot');
});

bot.onText(/\/bot/, msg => {
  bot.sendMessage(msg.chat.id, '📋 Меню:', { reply_markup: mainMenu });
});

// ================= MEDIA =================
bot.on('message', msg => {
  const chatId = msg.chat.id;
  if (!waitingForMedia[chatId]) return;
  delete waitingForMedia[chatId];

  if (msg.photo) {
    const file = msg.photo.pop();
    return bot.sendMessage(chatId, `📷 ID:\n\`${file.file_id}\``, { parse_mode: 'Markdown' });
  }

  if (msg.video) {
    return bot.sendMessage(chatId, `🎥 ID:\n\`${msg.video.file_id}\``, { parse_mode: 'Markdown' });
  }

  if (msg.animation) {
    return bot.sendMessage(chatId, `🎬 ID:\n\`${msg.animation.file_id}\``, { parse_mode: 'Markdown' });
  }

  if (msg.sticker) {
    return bot.sendMessage(chatId, `✨ ID:\n\`${msg.sticker.file_id}\``, { parse_mode: 'Markdown' });
  }

  bot.sendMessage(chatId, '❌ Це не медіа');
});

// ================= CALLBACK =================
bot.on('callback_query', async cb => {
  const chatId = cb.message.chat.id;
  await bot.answerCallbackQuery(cb.id);

  if (cb.data === 'explosion') {
    return bot.sendMessage(chatId, '💥 EXPLOSION!');
  }

  if (cb.data === 'currency') {
    bot.sendMessage(chatId, '⏳ Завантажую...');
    const text = await getCurrency();
    return bot.sendMessage(chatId, text);
  }

  if (cb.data === 'about') {
        return bot.sendMessage(chatId, BOT_INFO.about, { parse_mode: 'Markdown' });
  }

  if (cb.data === 'get_file_id') {
    waitingForMedia[chatId] = true;
    return bot.sendMessage(chatId, 'Надішли файл');
  }

  if (cb.data === 'dota_menu') {
    return bot.sendMessage(chatId, '🎮 Обери гравця', {
      reply_markup: getPlayerMenu()
    });
  }

  if (cb.data === 'back_to_main') {
    return bot.sendMessage(chatId, '📋 Меню', { reply_markup: mainMenu });
  }

  if (cb.data.startsWith('dota_select_')) {
    const id = cb.data.replace('dota_select_', '');
    return bot.sendMessage(chatId, '📊 Обери кількість', {
      reply_markup: getGamesCountMenu(id)
    });
  }

  if (cb.data.startsWith('dota_stats_')) {
    const [_, __, id, count] = cb.data.split('_');
    const player = PLAYERS.find(p => p.id === id);

    if (!player) return bot.sendMessage(chatId, '❌ Гравець не знайдений');

    bot.sendMessage(chatId, '⏳ Завантажую...');

    const matches = await getRecentMatches(player.steamId64, count);
    if (!matches) return bot.sendMessage(chatId, '❌ Помилка');

    return bot.sendMessage(chatId, `🎮 Ігор: ${matches.length}`);
  }
});

// ================= API =================
function getCurrency() {
  return new Promise(resolve => {
    https.get('https://api.monobank.ua/bank/currency', res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const usd = json.find(r => r.currencyCodeA === 840 && r.currencyCodeB === 980);
          resolve(`USD: ${usd.rateBuy}/${usd.rateSell}`);
        } catch {
          resolve('❌ Помилка');
        }
      });
    }).on('error', () => resolve('❌ Помилка'));
  });
}

function getRecentMatches(id, count) {
  return new Promise(resolve => {
    https.get(`https://api.opendota.com/api/players/${id}/recentMatches?limit=${count}`, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

// ================= SERVER =================
http.createServer((_, res) => {
  res.end('OK');
}).listen(process.env.PORT || 3000);

console.log('✅ Bot started');