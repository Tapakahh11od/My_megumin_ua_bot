const { mainMenu } = require('../utils/keyboards');

const showMenu = async (ctx) => {
  await ctx.reply('Обери магію 🧙‍♀️', mainMenu());
};

module.exports = { showMenu };