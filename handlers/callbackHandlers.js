// handlers/callbackHandlers.js
const fs = require('fs');
const path = require('path');
const { getCurrency } = require('../currency.js');
const dota = require('../dota.js');

// 💥 Explosion
const handleExplosion = (bot, chatId) => {
  const videoPath = path.join(__dirname, '..', 'gif', 'megumin_explosion.mp4');
  if (fs.existsSync(videoPath)) {
    bot.sendVideo(chatId, videoPath, { caption: '💥 EXPLOSION!' });
  } else {
    bot.sendMessage(chatId, '💥 EXPLOSION!');
  }
};

// 💱 Курс валют
const handleCurrency = async (bot, chatId) => {
  await bot.sendMessage(chatId, '⏳ Завантажую курс...');
  try {
    const text = await getCurrency();
    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  } catch {
    await bot.sendMessage(chatId, '❌ Помилка курсу');
  }
};

// 🧙 Про бота
const handleAbout = async (bot, chatId, botInfo) => {
  try {
    await bot.sendMessage(chatId, botInfo.about, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });
    const gifPath = path.join(__dirname, '..', 'gif', 'anime-megumin.mp4');
    if (fs.existsSync(gifPath)) {
      await bot.sendVideo(chatId, gifPath);
    }
  } catch (err) {
    console.error('❌ About error:', err.message);
  }
};

// 🎮 Dota меню
const handleDotaMenu = async (bot, chatId) => {
  const keyboard = dota.getPlayersKeyboard();
  await bot.sendMessage(
    chatId,
    '🎮 *Оберіть гравця:*\n_Останні 100 Turbo матчів_',
    {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    }
  );
};

// 🎮 Статистика гравця
const handleDotaPlayer = async (bot, chatId, playerId) => {
  if (!playerId) throw new Error('Invalid player ID');
  
  const loadingMsg = await bot.sendMessage(chatId, '⏳ Завантаження статистики...');
  
  try {
    const result = await dota.getPlayerStats(playerId);
    await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});

    if (!result) return bot.sendMessage(chatId, '❌ Порожня відповідь');
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
    if (err.message?.includes('404')) errorMsg = '❌ Профіль не знайдено або приватний';
    if (err.message === 'TIMEOUT') errorMsg = '⏰ OpenDota не відповідає';
    
    await bot.sendMessage(chatId, errorMsg);
  }
};

// 📦 Експорт
module.exports = {
  handleExplosion,
  handleCurrency,
  handleAbout,
  handleDotaMenu,
  handleDotaPlayer
};