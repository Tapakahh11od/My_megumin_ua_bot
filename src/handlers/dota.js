const dotaHandler = async (ctx) => {
  try {
    await ctx.answerCbQuery();

    await ctx.reply(
      `🎮 Dota 2 статистика\n\n` +
      `⚠️ Цей розділ тимчасово вимкнено.\n` +
      `💡 Ми працюємо над інтеграцією реальної статистики.\n\n` +
      `🚀 Скоро буде:\n` +
      `• профілі гравців\n` +
      `• матчі\n` +
      `• MMR статистика`
    );

  } catch (err) {
    console.error('Dota handler error:', err);
    await ctx.reply('❌ Помилка в Dota розділі');
  }
};

module.exports = { dotaHandler };