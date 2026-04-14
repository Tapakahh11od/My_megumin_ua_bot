const fs = require('fs');
const path = require('path');

const infoPath = path.join(__dirname, '../data/info_bot.json');

const videoPath = path.join(__dirname, '../../gif/info_bot.mp4');

const meguminHandler = async (ctx) => {
  try {
    await ctx.answerCbQuery();

    const data = JSON.parse(fs.readFileSync(infoPath));

    // 🧙 текст про Мегумін
    await ctx.reply(data.about);

    // 🎬 відео
    await ctx.replyWithVideo({
      source: videoPath,
      caption: '🧙‍♀️ Megumin — Explosion Arch Wizard',
    });

  } catch (err) {
    console.error('Megumin handler error:', err);
    await ctx.reply('❌ Помилка в інформації про Мегумін');
  }
};

module.exports = { meguminHandler };