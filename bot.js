const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const fs = require('fs');
const path = require('path');
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
const { getCurrency } = require('./currency.js');

// 🔄 INIT DATA (SAFE)
birthdays.loadBirthdays();
dota.loadPlayers();

// ⚠️ IMPORTANT: HEROES must finish loading before usage
(async () => {
    try {
        await dota.loadHeroes();
        logger.info('✅ Heroes loaded');
    } catch (err) {
        logger.error(`❌ Failed to load heroes: ${err.message}`);
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
    await bot.answerCallbackQuery(cb.id);

    try {
        // 🎮 PLAYER STATS
        if (cb.data.startsWith('dota_player:')) {
            const playerId = cb.data.split(':')[1];
            await callbackHandlers.handleDotaPlayer(bot, chatId, playerId);
            return;
        }

        // 📋 Прості команди
        switch (cb.data) {
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
                logger.warn(`⚠️ Unknown callback: ${cb.data}`);
        }
    } catch (err) {
        logger.error(`❌ Callback handler error: ${err.message}`);
        await bot.sendMessage(chatId, '❌ Внутрішня помилка обробки запиту').catch(() => {});
    }
});

// ================= AUTO TASKS (CRON) =================
// 🎂 Щодня о 12:00 за Києвом — дні народження
cron.schedule('0 12 * * *', () => {
    logger.info('🔍 Checking birthdays...');
    if (!ADMIN_CHAT_ID) return;

    const today = birthdays.getTodayBirthdays();
    if (today.length > 0) {
        const names = today.map(p => p.name);
        birthdays.sendBirthdayGreeting(bot, ADMIN_CHAT_ID, names);
        logger.info(`🎉 Birthday greetings sent to: ${names.join(', ')}`);
    }
}, {
    timezone: 'Europe/Kyiv'
});

// ================= SERVER =================
const PORT = process.env.PORT || 3000;
http.createServer((_, res) => res.end('OK')).listen(PORT);

// ================= GLOBAL ERROR HANDLERS =================
process.on('unhandledRejection', (reason, promise) => {
    logger.error(`❌ Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

process.on('uncaughtException', (err) => {
    logger.error(`❌ Uncaught Exception: ${err.message}`);
    process.exit(1);
});

logger.info('✅ Bot started');