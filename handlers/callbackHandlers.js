const fs = require('fs');
const path = require('path');
const { getCurrency } = require('../currency.js');
const { withRetry } = require('../utils/retry');

// 💥 Explosion
const handleExplosion = async (bot, chatId) => {
    const videoPath = path.join(__dirname, '..', 'gif', 'megumin_explosion.mp4');

    if (fs.existsSync(videoPath)) {
        await bot.sendVideo(chatId, videoPath, {
            caption: '💥 EXPLOSION!'
        });
    } else {
        await bot.sendMessage(chatId, '💥 EXPLOSION!');
    }
};

// 💱 Курс валют
const handleCurrency = async (bot, chatId) => {
    await bot.sendMessage(chatId, '⏳ Завантажую курс...');

    try {
        const text = await withRetry(() => getCurrency());

        await bot.sendMessage(chatId, text, {
            parse_mode: 'Markdown'
        });

    } catch (err) {
        console.error('❌ Currency error:', err.message);

        await bot.sendMessage(
            chatId,
            '❌ Помилка курсу (спробуйте пізніше)'
        );
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
    const dota = require('../dota.js');
    const keyboard = dota.getPlayersKeyboard();

    await bot.sendMessage(
        chatId,
        '🎮 *Оберіть гравця:*',
        {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        }
    );
};

module.exports = {
    handleExplosion,
    handleCurrency,
    handleAbout,
    handleDotaMenu
};