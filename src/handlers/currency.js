const axios = require('axios');

const currencyHandler = async (ctx) => {
  await ctx.answerCbQuery();

  try {
    const res = await axios.get('https://api.monobank.ua/bank/currency');

    const usd = res.data.find(
      (c) => c.currencyCodeA === 840 && c.currencyCodeB === 980
    );

    const eur = res.data.find(
      (c) => c.currencyCodeA === 978 && c.currencyCodeB === 980
    );

    await ctx.reply(
      `💵 USD: ${usd.rateBuy} / ${usd.rateSell}\n💶 EUR: ${eur.rateBuy} / ${eur.rateSell}`
    );
  } catch (e) {
    await ctx.reply('❌ Помилка курсу');
  }
};

module.exports = { currencyHandler };