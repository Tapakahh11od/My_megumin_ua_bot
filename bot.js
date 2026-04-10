const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const https = require('https');

// 🔐 Змінні середовища
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = Number(process.env.ADMIN_CHAT_ID);

// 🎂 Дні народження
let BIRTHDAYS = [];
try { BIRTHDAYS = require('./birthdays.json'); } 
catch (e) { console.log('⚠️ birthdays.json не знайдено'); }

// 🎮 Гравці Dota 2
let PLAYERS = [];
try { PLAYERS = require('./players.json').players; } 
catch (e) { console.log('⚠️ players.json не знайдено'); }

// 🔥 Перевірка токенів
if (!BOT_TOKEN) { console.error('❌ BOT_TOKEN not found'); process.exit(1); }
if (!ADMIN_CHAT_ID) { console.error('❌ ADMIN_CHAT_ID not found'); process.exit(1); }

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// 📊 Стани
let explosionSentToday = false;
let birthdayNotifiedToday = false;
let waitingForMedia = {};

// ================= 📋 ГОЛОВНЕ МЕНЮ =================
const mainMenu = {
  inline_keyboard: [
    [{ text: '💥 Explosion!', callback_data: 'explosion' }],
    [{ text: '💱 Курс валют', callback_data: 'currency' }],
    [{ text: '🎮 Dota 2 статистика', callback_data: 'dota_menu' }],
    [{ text: '🧙‍♀️ Про Мегумін', callback_data: 'about' }],
    [{ text: '🆔 Отримати File ID', callback_data: 'get_file_id' }]
  ]
};

// ================= 🎮 МЕНЮ ВИБОРУ ГРАВЦЯ =================
function getPlayerMenu() {
  const keyboard = PLAYERS.map(p => [{ 
    text: p.name, 
    callback_ `dota_select_${p.id}` 
  }]);
  keyboard.push([{ text: '🔙 Назад', callback_ 'back_to_main' }]);
  return { inline_keyboard: keyboard };
}

// ================= 📊 МЕНЮ ВИБОРУ КІЛЬКОСТІ ІГОР =================
function getGamesCountMenu(playerId) {
  return {
    inline_keyboard: [
      [{ text: '📈 Останні 10 ігор', callback_ `dota_stats_${playerId}_10` }],
      [{ text: '📊 Останні 50 ігор', callback_ `dota_stats_${playerId}_50` }],
      [{ text: '📉 Останні 100 ігор', callback_ `dota_stats_${playerId}_100` }],
      [{ text: '🔙 Назад до гравців', callback_ 'dota_menu' }]
    ]
  };
}

// ================= 🚀 КОМАНДИ =================
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, '🧙‍♀️ Привіт! Я Мегумін!\n\nМагістр вибухової магії вже тут!\nНатисни /bot, щоб побачити меню. 💥');
});

bot.onText(/\/bot/, (msg) => {
  bot.sendMessage(msg.chat.id, '📋 Головне меню\nОбери функцію:', { reply_markup: mainMenu });
});

bot.onText(/\/getid/, (msg) => {
  const text = `🆔 Інформація про чат:\n📛 Назва: ${msg.chat.title || 'Особистий чат'}\n🔢 ID: ${msg.chat.id}\n📎 Тип: ${msg.chat.type}`;
  bot.sendMessage(msg.chat.id, text);
});

// ================= 🆔 ОБРОБКА МЕДІА (тільки після кнопки) =================
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  
  if (!waitingForMedia[chatId]) return;
  delete waitingForMedia[chatId];
  
  if (msg.animation) {
    const file = msg.animation;
    bot.sendMessage(chatId, 
      `🎬 **File ID GIF:**\n\`${file.file_id}\`\n\n` +
      `📛 Назва: ${file.file_name || '—'}\n` +
      `📊 Розмір: ${file.file_size} байт`, 
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  if (msg.photo && msg.photo.length > 0) {
    const file = msg.photo[msg.photo.length - 1];
    bot.sendMessage(chatId, 
      `📷 **File ID фото:**\n\`${file.file_id}\`\n\n` +
      `📊 Розмір: ${file.file_size} байт`, 
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  if (msg.video) {
    const file = msg.video;
    bot.sendMessage(chatId, 
      `🎥 **File ID відео:**\n\`${file.file_id}\`\n\n` +
      `📛 Назва: ${file.file_name || '—'}\n` +
      `📊 Розмір: ${file.file_size} байт`, 
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  if (msg.sticker) {
    bot.sendMessage(chatId, 
      `✨ **File ID стікера:**\n\`${msg.sticker.file_id}\``, 
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  bot.sendMessage(chatId, '❌ Це не медіа. Натисни кнопку ще раз і надішли фото/відео/гіфку.');
});

// ================= 🔘 ОБРОБКА КНОПОК =================
bot.on('callback_query', async (cb) => {
  const chatId = cb.message.chat.id;
  await bot.answerCallbackQuery(cb.id);

  if (cb.data === 'explosion') { sendExplosion(chatId); return; }
  
  if (cb.data === 'currency') {
    bot.sendMessage(chatId, '⏳ Завантажую курс...');
    getCurrency().then(t => bot.sendMessage(chatId, t));
    return;
  }
  
  if (cb.data === 'about') {
    bot.sendMessage(chatId, '🧙‍♀️ Про Мегумін\n\nЯ — архіволшебниця з Коносуби!\n💥 Вибухи\n💱 Курси валют\n🎮 Dota 2 статистика\n🎂 Дні народження\n\nEXPLOSION!');
    return;
  }

  if (cb.data === 'get_file_id') {
    waitingForMedia[chatId] = true;
    bot.sendMessage(chatId, '📎 **Надішли фото/відео/гіфку/стікер**, і я покажу File ID:');
    return;
  }

  if (cb.data === 'dota_menu') {
    if (PLAYERS.length === 0) {
      bot.sendMessage(chatId, '❌ Список гравців порожній. Додай гравців у players.json');
    } else {
      bot.sendMessage(chatId, '🎮 **Обери гравця для статистики:**', { 
        reply_markup: getPlayerMenu(), parse_mode: 'Markdown' 
      });
    }
    return;
  }
  
  if (cb.data === 'back_to_main') {
    bot.sendMessage(chatId, '📋 Головне меню', { reply_markup: mainMenu });
    return;
  }
  
  if (cb.data.startsWith('dota_select_')) {
    const playerId = cb.data.replace('dota_select_', '');
    bot.sendMessage(chatId, '📊 **Обери кількість ігор для статистики:**', {
      reply_markup: getGamesCountMenu(playerId), parse_mode: 'Markdown'
    });
    return;
  }
  
  if (cb.data.startsWith('dota_stats_')) {
    const parts = cb.data.split('_');
    const playerId = parts[2];
    const count = parseInt(parts[3]);
    
    const player = PLAYERS.find(p => p.id === playerId);
    if (!player) {
      bot.sendMessage(chatId, '❌ Гравця не знайдено');
      return;
    }
    
    bot.sendMessage(chatId, `⏳ Завантажую статистику для **${player.name}** (${count} ігор)...`, { parse_mode: 'Markdown' });
    
    getRecentMatches(player.steamId64, count).then(matches => {
      if (!matches || matches.length === 0) {
        bot.sendMessage(chatId, '❌ Не вдалося отримати дані. Перевір, чи профіль публічний.');
        return;
      }
      const stats = formatStats(matches, player.name, count);
      bot.sendMessage(chatId, stats, { parse_mode: 'Markdown', disable_web_page_preview: true });
    });
    return;
  }
});

// ================= 💥 ФУНКЦІЇ =================

function sendExplosion(chatId) {
  const gif = 'CgACAgQAAxkBAAMCadep_WqfcQ14s78soH2lBvQ3wkMAAngGAAK8muRQ4pvZxf4pVQY7BA';
  bot.sendAnimation(chatId, gif, { caption: '💥 EXPLOSION! 💥\nМегумін використала магію!' });
}

function getCurrency() {
  return new Promise((resolve) => {
    https.get('https://api.monobank.ua/bank/currency', { headers: { 'User-Agent': 'Megumin-Bot' }, timeout: 8000 }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const usd = json.find(r => r.currencyCodeA === 840 && r.currencyCodeB === 980);
          const eur = json.find(r => r.currencyCodeA === 978 && r.currencyCodeB === 980);
          resolve(`💱 Курс Monobank\n\nUSD: ${usd?.rateBuy ?? '—'} / ${usd?.rateSell ?? '—'}\nEUR: ${eur?.rateBuy ?? '—'} / ${eur?.rateSell ?? '—'}`);
        } catch { resolve('❌ Помилка курсу'); }
      });
    }).on('error', () => resolve('❌ Помилка з\'єднання'));
  });
}

// ================= 🎮 DOTA 2 API =================

function getRecentMatches(steamId64, count = 10) {
  return new Promise((resolve) => {
    https.get(`https://api.opendota.com/api/players/${steamId64}/recentMatches?limit=${count}`, {
      headers: { 'User-Agent': 'Megumin-Bot' },
      timeout: 20000
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

function formatStats(matches, playerName, count) {
  const actualCount = matches.length;
  const wins = matches.filter(m => m.win).length;
  const losses = actualCount - wins;
  const winrate = actualCount > 0 ? Math.round(wins / actualCount * 100) : 0;
  
  const totalK = matches.reduce((s, m) => s + (m.kills || 0), 0);
  const totalD = matches.reduce((s, m) => s + (m.deaths || 0), 0);
  const totalA = matches.reduce((s, m) => s + (m.assists || 0), 0);
  const avgKDA = actualCount > 0 ? ((totalK + totalA) / Math.max(totalD, 1)).toFixed(2) : '0.00';
  
  const heroStats = {};
  matches.forEach(m => {
    const hero = m.hero_name || 'Unknown';
    if (!heroStats[hero]) heroStats[hero] = { wins: 0, games: 0 };
    heroStats[hero].games++;
    if (m.win) heroStats[hero].wins++;
  });
  const topHeroes = Object.entries(heroStats)
    .sort((a, b) => b[1].games - a[1].games)
    .slice(0, 3)
    .map(([hero, stats]) => `${hero} (${stats.wins}/${stats.games})`)
    .join(', ');
  
  const lastMatch = matches[0];
  const lastResult = lastMatch?.win ? '🟢 Перемога' : '🔴 Поразка';
  const lastHero = lastMatch?.hero_name || '—';
  const lastKDA = lastMatch ? `${lastMatch.kills}/${lastMatch.deaths}/${lastMatch.assists}` : '—';
  
  return (
    `🎮 **Статистика: ${playerName}**\n` +
    `📊 Останні ${actualCount} ігор (із ${count} запитаних)\n\n` +
    `🏆 **Загальна:**\n` +
    `🟢 Перемоги: ${wins}\n` +
    `🔴 Поразки: ${losses}\n` +
    `📈 Winrate: ${winrate}%\n` +
    `⚔️ Сер. KDA: ${avgKDA}\n\n` +
    `🦸 **Топ герої:**\n${topHeroes || '—'}\n\n` +
    `🎯 **Остання гра:**\n` +
    `• Результат: ${lastResult}\n` +
    `• Герой: ${lastHero}\n` +
    `• K/D/A: ${lastKDA}\n` +
    `${lastMatch?.match_id ? `• [Деталі](https://www.opendota.com/matches/${lastMatch.match_id})` : ''}`
  );
}

// ================= 🎂 ДН =================
function getTodayBirthdays() {
  const now = new Date().toLocaleString('en-US', { timeZone: 'Europe/Kyiv' });
  const date = new Date(now);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return BIRTHDAYS.filter(p => p.date === `${day}.${month}`);
}

// ================= ⏰ ТАЙМЕР =================
setInterval(() => {
  const now = new Date().toLocaleString('en-US', { timeZone: 'Europe/Kyiv' });
  const date = new Date(now);
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  if (time === "18:00" && !explosionSentToday) {
    sendExplosion(ADMIN_CHAT_ID);
    explosionSentToday = true;
    console.log('💥 Вибух надіслано!');
  }

  if (time === "13:00" && !birthdayNotifiedToday) {
    const today = getTodayBirthdays();
    if (today.length > 0) {
      const names = today.map(p => p.name).join(', ');
      const greeting = `🧙‍♀️ **УВАГА! СЬОГОДНІ ОСОБЛИВИЙ ДЕНЬ!** 💥\n\n🎉 Вітаю з Днем Народження, ${names}!\n\n✨ Нехай твоє життя буде яскравим, як мій вибух!\n🔥 Нехай мрії збуваються з гучним БА-БА-БАХ!\n💫 А кожен день приносить нові магії!\n\n🎂 Тримай святковий танець на честь тебе! 👇`;
      const birthdayGif = 'CgACAgQAAxkBAAMFadi81IGwjoOZUeRA_2qtxsJsenUAAkAIAAIY1PVRwmNUQHc8GXI7BA';
      bot.sendMessage(ADMIN_CHAT_ID, greeting, { parse_mode: 'Markdown' });
      bot.sendAnimation(ADMIN_CHAT_ID, birthdayGif, { caption: `💥 **EXPLOSION FOR ${names.toUpperCase()}!** 💥` });
      birthdayNotifiedToday = true;
      console.log(`🎂 Привітання надіслано для: ${names}`);
    }
  }

  if (time === "00:01") {
    explosionSentToday = false;
    birthdayNotifiedToday = false;
    console.log('🔄 Прапори скинуто');
  }
}, 60000);

// ================= 🌐 HTTP-СЕРВЕР =================
const PORT = process.env.PORT || 3000;
http.createServer((_, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('✅ Bot is alive');
}).listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));

console.log('✅ Мегумін запущена! 💥');