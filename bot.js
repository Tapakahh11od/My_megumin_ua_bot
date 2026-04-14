const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const fs = require('fs');
const cron = require('node-cron');
const logger = require('./utils/logger');
const dota = require('./dota.js');

// 🔐 ENV + ВАЛІДАЦІЯ
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = parseInt(process.env.ADMIN_CHAT_ID, 10);

if (!BOT_TOKEN) {
    logger.error('❌ BOT_TOKEN not set in Render environment variables');
    process.exit(1);
}

if (isNaN(ADMIN_CHAT_ID)) {
    logger.error('❌ ADMIN_CHAT_ID must be a number in Render environment variables');
    process.exit(1);
}

// 📦 MODULES
const birthdays = require('./birthdays.js');

// 🔄 INIT
birthdays.loadBirthdays();
dota.loadPlayers();

// 📖 BOT INFO
let botInfo;
try {
    botInfo = JSON.parse(fs.readFileSync('info_bot.json', 'utf8'));

    if (!botInfo.about) throw new Error('Missing "about" field');

    logger.info('✅ info_bot.json loaded');
} catch (err) {
    logger.error(`❌ info_bot.json error: ${err.message}`);
    process.exit(1);
}

// 🤖 BOT INIT
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
bot.deleteWebHook();

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
const callbackHandlers = require('./handlers/callbackHandlers');

bot.on('callback_query', async (cb) => {
    const chatId = cb.message.chat.id;
    const data = cb.data;

    await bot.answerCallbackQuery(cb.id);

    try {

        // ⚡ DOTA PLAYER
        if (data.startsWith('dota_player:')) {
            const playerId = data.split(':')[1];

            // ⏳ UX LOADING
            const loadingMsg = await bot.sendMessage(chatId, '⏳ Завантажую статистику...');

            try {
                const result = await dota.getPlayerInfo(playerId);

                await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});

                if (result.photo) {
                    await bot.sendPhoto(chatId, result.photo, {
                        caption: result.text,
                        parse_mode: 'Markdown'
                    });
                } else {
                    await bot.sendMessage(chatId, result.text, {
                        parse_mode: 'Markdown'
                    });
                }

            } catch (err) {
                await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});

                logger.error(`❌ Dota error: ${err.message}`);

                let errorMsg = '❌ Помилка отримання даних';

                if (err.message?.includes('404')) {
                    errorMsg = '❌ Профіль не знайдено або приватний';
                }

                await bot.sendMessage(chatId, errorMsg);
            }

            return;
        }

        // 📋 MENU ACTIONS
        switch (data) {

            case 'explosion':
                await callbackHandlers.handleExplosion(bot, chatId);
                break;

            case 'currency':
                await callbackHandlers.handleCurrency(bot, chatId);
                break;

            case 'about':
                await callbackHandlers.handleAbout(bot, chatId, botInfo);
                break;

            case 'dota_menu':
                await callbackHandlers.handleDotaMenu(bot, chatId);
                break;

            default:
                logger.warn(`⚠️ Unknown callback: ${data}`);
        }

    } catch (err) {
        logger.error(`❌ Callback handler error: ${err.message}`);

        await bot.sendMessage(
            chatId,
            '❌ Внутрішня помилка обробки запиту'
        ).catch(() => {});
    }
});

// ================= AUTO TASKS =================
cron.schedule('0 12 * * *', () => {

    logger.info('🔍 Checking birthdays...');

    const today = birthdays.getTodayBirthdays();

    if (today.length > 0) {
        const names = today.map(p => p.name);

        birthdays.sendBirthdayGreeting(bot, ADMIN_CHAT_ID, names);

        logger.info(`🎉 Birthday greetings sent: ${names.join(', ')}`);
    }

}, {
    timezone: 'Europe/Kyiv'
});

// ================= SERVER =================
http.createServer((_, res) => res.end('OK')).listen(process.env.PORT || 3000);

// ================= ERRORS =================
process.on('unhandledRejection', (reason) => {
    logger.error(`❌ Unhandled Rejection: ${reason}`);
});

process.on('uncaughtException', (err) => {
    logger.error(`❌ Uncaught Exception: ${err.message}`);
    process.exit(1);
});

logger.info('✅ Bot started');