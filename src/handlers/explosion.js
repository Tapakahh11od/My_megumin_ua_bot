const path = require('path');

const explosionHandler = async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.reply('💥 EXPLOSION!!!');

  await ctx.replyWithVideo({
    source: path.join(__dirname, '../../gif/EXPLOSION.mp4'),
    caption: '💣 MEGUMIN EXPLOSION!',
  });
};

module.exports = { explosionHandler };