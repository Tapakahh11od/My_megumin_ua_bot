const fs = require('fs');
const path = require('path');

const infoPath = path.join(__dirname, '../data/info_bot.json');

const meguminHandler = async (ctx) => {
  await ctx.answerCbQuery();

  const data = JSON.parse(fs.readFileSync(infoPath));

  await ctx.reply(data.about);

  await ctx.replyWithVideo({
    source: path.join(__dirname, '../../gif/info_bot.mp4'),
    caption: '🧙‍♀️ Megumin',
  });
};

module.exports = { meguminHandler };