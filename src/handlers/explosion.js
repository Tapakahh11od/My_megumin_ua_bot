const path = require('path');

const explosionHandler = async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.reply('💥 EXPLOSION!!!');

  await ctx.replyWithAnimation({
    source: path.join(__dirname, '../../gif/explosion.gif'),
  });
};

module.exports = { explosionHandler };