const fs = require('fs');
const path = require('path');

const infoPath = path.join(__dirname, '../data/info_bot.json');
const gifPath = path.join(__dirname, '../../gif/megumin.gif');

const meguminHandler = async (ctx) => {
  await ctx.answerCbQuery();

  const data = JSON.parse(fs.readFileSync(infoPath));

  await ctx.reply(data.about);

  await ctx.replyWithAnimation({
    source: gifPath,
  });
};

module.exports = { meguminHandler };