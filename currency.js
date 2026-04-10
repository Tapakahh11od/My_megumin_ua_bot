const https = require('https');

// 💱 Отримання курсу валют
function getCurrency() {
  return new Promise(resolve => {
    https.get('https://api.monobank.ua/bank/currency', res => {
      let data = '';
      
      res.on('data', chunk => data += chunk);
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          
          // ✅ Перевіряємо, чи це масив
          if (!Array.isArray(parsed)) {
            console.error('❌ API повернув не масив:', parsed);
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
          
          resolve(result);
        } catch (err) {
          console.error('❌ Помилка парсингу курсу:', err.message);
          resolve('❌ Помилка отримання курсу');
        }
      });
    }).on('error', err => {
      console.error('❌ Помилка запиту курсу:', err.message);
      resolve('❌ Не вдалося зв\'язатися з банком');
    });
  });
}

module.exports = { getCurrency };