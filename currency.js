// currency.js
const https = require('https');
const logger = require('./utils/logger'); // Використовуємо Winston

// 💱 Налаштування
const API_URL = 'https://api.monobank.ua/bank/currency';
const CACHE_TTL = 5 * 60 * 1000; // 5 хвилин кешування
const REQUEST_TIMEOUT = 5000;    // 5 секунд тайм-аут

// 🗄️ Кеш
let cache = {
  data: null,
  timestamp: 0
};

// 💱 Отримання курсу валют
function getCurrency() {
  const now = Date.now();

  // 🔁 Повертаємо кеш, якщо він ще валідний
  if (cache.data && now - cache.timestamp < CACHE_TTL) {
    logger.info('♻️ Курс взято з кешу');
    return Promise.resolve(cache.data);
  }

  return new Promise(resolve => {
    const req = https.get(API_URL, { timeout: REQUEST_TIMEOUT }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);

          // ✅ Перевіряємо, чи це масив
          if (!Array.isArray(parsed)) {
            logger.error(`❌ API повернув не масив: ${typeof parsed}`);
            resolve('❌ Тимчасова помилка курсу');
            return;
          }

          // USD (840) to UAH (980)
          const usd = parsed.find(r =>
            r.currencyCodeA === 840 && r.currencyCodeB === 980
          );

          // EUR (978) to UAH (980)
          const eur = parsed.find(r =>
            r.currencyCodeA === 978 && r.currencyCodeB === 980
          );

          let result = '💱 *Курс валюти MonoBank*\n\n';

          if (usd && usd.rateBuy !== undefined) {
            result += `🇺🇸 *USD:* ${usd.rateBuy} / ${usd.rateSell}\n`;
          } else {
            result += `🇺🇸 *USD:* дані недоступні\n`;
          }

          if (eur && eur.rateBuy !== undefined) {
            result += `🇪🇺 *EUR:* ${eur.rateBuy} / ${eur.rateSell}\n`;
          } else {
            result += `🇪🇺 *EUR:* дані недоступні\n`;
          }

          result += `\n_Купівля / Продаж_`;

          // 💾 Зберігаємо в кеш
          cache.data = result;
          cache.timestamp = now;

          resolve(result);
        } catch (err) {
          logger.error(`❌ Помилка парсингу курсу: ${err.message}`);
          resolve('❌ Помилка отримання курсу');
        }
      });
    });

    // ⏱️ Обробка тайм-ауту
    req.on('timeout', () => {
      req.destroy();
      logger.error('⏰ Тайм-аут запиту до банку');
      resolve('⏰ Банк не відповідає, спробуйте пізніше');
    });

    // 🌐 Обробка мережевих помилок
    req.on('error', err => {
      logger.error(`❌ Помилка запиту курсу: ${err.message}`);
      resolve('❌ Не вдалося зв\'язатися з банком');
    });
  });
}

// 🔄 Примусове оновлення кешу (опціонально)
function clearCurrencyCache() {
  cache.data = null;
  cache.timestamp = 0;
  logger.info('🗑️ Кеш курсу очищено');
}

module.exports = {
  getCurrency,
  clearCurrencyCache
};