const path = require('path');

const explosionHandler = async (ctx) => {
  try {
    await ctx.answerCbQuery();

    await ctx.reply('💥 EXPLOSION!!!');

    await ctx.replyWithVideo({
      source: path.join(__dirname, '../../gif/EXPLOSION.mp4'),
      caption: '💣 Megumin Explosion!!!',
    });

  } catch (err) {
    console.error('Explosion error:', err);
    await ctx.reply('💥 EXPLOSION failed...');
  }
};

module.exports = { explosionHandler };