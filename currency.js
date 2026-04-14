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

    // ♻️ CACHE
    if (cache.data && now - cache.timestamp < CACHE_TTL) {
        logger.info('♻️ Курс взято з кешу');
        return Promise.resolve(cache.data);
    }

    return new Promise((resolve) => {
        const req = https.get(API_URL, { timeout: REQUEST_TIMEOUT }, (res) => {
            let data = '';

            res.on('data', chunk => data += chunk);

            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);

                    if (!Array.isArray(parsed)) {
                        throw new Error('API response is not array');
                    }

                    const usd = parsed.find(r =>
                        r.currencyCodeA === 840 && r.currencyCodeB === 980
                    );

                    const eur = parsed.find(r =>
                        r.currencyCodeA === 978 && r.currencyCodeB === 980
                    );

                    const format = (cur, label) => {
                        if (!cur || cur.rateBuy === undefined) {
                            return `${label}: дані недоступні`;
                        }

                        return `${label}: ${cur.rateBuy} / ${cur.rateSell}`;
                    };

                    const result =
`💱 *Курс валюти MonoBank*

🇺🇸 *USD:* ${usd?.rateBuy ?? '—'} / ${usd?.rateSell ?? '—'}
🇪🇺 *EUR:* ${eur?.rateBuy ?? '—'} / ${eur?.rateSell ?? '—'}

_Купівля / Продаж_`;

                    // 🧠 кеш
                    cache.data = result;
                    cache.timestamp = now;

                    resolve(result);

                } catch (err) {
                    logger.error(`❌ Currency parse error: ${err.message}`);
                    resolve('❌ Помилка отримання курсу');
                }
            });
        });

        req.on('timeout', () => {
            req.destroy();
            logger.error('⏰ Currency request timeout');
            resolve('⏰ Банк не відповідає, спробуйте пізніше');
        });

        req.on('error', (err) => {
            logger.error(`❌ Currency request error: ${err.message}`);
            resolve('❌ Не вдалося зв\'язатися з банком');
        });
    });
}

module.exports = { getCurrency };