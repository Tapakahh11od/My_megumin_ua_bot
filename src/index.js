require('dotenv').config();
const { bot } = require('./bot');
const { startBirthdayScheduler } = require('./scheduler/birthdayScheduler');
const http = require('http');

(async () => {
  try {
    console.log('Bot starting...');

    // 🔥 чистимо Telegram state
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });

    await new Promise(r => setTimeout(r, 1000));

    await bot.launch();

    console.log('Bot started');

    startBirthdayScheduler(bot);

  } catch (err) {
    console.error('FATAL ERROR:', err);
    process.exit(1);
  }
})();

// 🔥 Render health check server (ВАЖЛИВО)
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot is running');
});

server.listen(process.env.PORT || 3000, () => {
  console.log('HTTP server running');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));