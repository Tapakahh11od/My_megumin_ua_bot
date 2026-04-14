const { Markup } = require('telegraf');

const mainMenu = () =>
  Markup.inlineKeyboard([
    [
      Markup.button.callback('💥 Explosion!', 'EXPLOSION'),
    ],
    [
      Markup.button.callback('💵 Курс валют', 'CURRENCY'),
    ],
    [
      Markup.button.callback('🎮 Dota 2 (soon)', 'DOTA'),
    ],
    [
      Markup.button.callback('🔥 Про Мегумін', 'MEGUMIN'),
    ],
  ]);

module.exports = { mainMenu };