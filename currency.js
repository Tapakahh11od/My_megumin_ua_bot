const https = require('https');
const logger = require('./utils/logger');

// 💱 Налаштування
const API_URL = 'https://api.monobank.ua/bank/currency';
const CACHE_TTL = 5 * 60 * 1000;
const REQUEST_TIMEOUT = 5000;

// 🗄️ Кеш
let cache = {
    data: null,
    timestamp: 0
};

// 💱 Отримання курсу валют
function getCurrency() {
    const now = Date.now();
    
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

                    if (!Array.isArray(parsed)) {
                        logger.error(`❌ API повернув не масив: ${typeof parsed}`);
                        resolve('❌ Тимчасова помилка курсу');
                        return;
                    }

                    const usd = parsed.find(r =>
                        r.currencyCodeA === 840 && r.currencyCodeB === 980
                    );

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

                    cache.data = result;
                    cache.timestamp = now;

                    resolve(result);
                } catch (err) {
                    logger.error(`❌ Помилка парсингу курсу: ${err.message}`);
                    resolve('❌ Помилка отримання курсу');
                }
            });
        });

        req.on('timeout', () => {
            req.destroy();
            logger.error('⏰ Тайм-аут запиту до банку');
            resolve('⏰ Банк не відповідає, спробуйте пізніше');
        });

        req.on('error', err => {
            logger.error(`❌ Помилка запиту курсу: ${err.message}`);
            resolve('❌ Не вдалося зв\'язатися з банком');
        });
    });
}

module.exports = { getCurrency };