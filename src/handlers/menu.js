const { mainMenu } = require('../utils/keyboards');

const showMenu = async (ctx) => {
  try {
    await ctx.reply(
      '🧙‍♀️ Обери магію Мегумін:',
      mainMenu()
    );
  } catch (err) {
    console.error('Menu error:', err);
    await ctx.reply('❌ Помилка меню');
  }
};

module.exports = { showMenu };