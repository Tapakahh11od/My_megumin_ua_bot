const axios = require('axios');

const currencyHandler = async (ctx) => {
  await ctx.answerCbQuery();

  try {
    const res = await axios.get('https://api.monobank.ua/bank/currency', {
      timeout: 5000,
    });

    const usd = res.data.find(
      (c) => c.currencyCodeA === 840 && c.currencyCodeB === 980
    );

    const eur = res.data.find(
      (c) => c.currencyCodeA === 978 && c.currencyCodeB === 980
    );

    if (!usd || !eur) {
      return ctx.reply('⚠️ Дані по валюті тимчасово недоступні');
    }

    const usdBuy = usd.rateBuy ?? '—';
    const usdSell = usd.rateSell ?? '—';
    const eurBuy = eur.rateBuy ?? '—';
    const eurSell = eur.rateSell ?? '—';

    await ctx.reply(
      `💵 USD: ${usdBuy} / ${usdSell}\n💶 EUR: ${eurBuy} / ${eurSell}`
    );

  } catch (e) {
    console.error('Currency error:', e.message);
    await ctx.reply('❌ Помилка отримання курсу валют');
  }
};

module.exports = { currencyHandler };