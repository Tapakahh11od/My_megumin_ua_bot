// utils/retry.js

/**
 * Функція для автоматичного повтору невдалих запитів
 * @param {Function} fn - Асинхронна функція, яку треба виконати
 * @param {number} retries - Кількість спроб (за замовчуванням 3)
 * @param {number} delay - Затримка між спробами в мс (за замовчуванням 1000)
 */
async function withRetry(fn, retries = 3, delay = 1000) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Виконуємо основну функцію
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Якщо це остання спроба — не чекаємо, кидаємо помилку
      if (attempt === retries) break;

      // Експоненційна затримка (1с, 2с, 4с...)
      const waitTime = delay * Math.pow(2, attempt - 1);
      console.warn(`⚠️ Спроба ${attempt}/${retries} невдала. Чекаю ${waitTime}мс... (${error.message})`);
      
      await new Promise(res => setTimeout(res, waitTime));
    }
  }

  throw lastError;
}

module.exports = { withRetry };