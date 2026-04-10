const fs = require('fs');
const path = require('path');

let BIRTHDAYS = [];

// 📥 Завантаження
function loadBirthdays() {
  try {
    const data = require('./birthdays.json');
    BIRTHDAYS = data;
    console.log(`📅 Завантажено ${BIRTHDAYS.length} ДН`);
  } catch (e) {
    console.error('❌ Помилка birthdays.json');
  }
}

// 📅 Сьогоднішні
function getTodayBirthdays() {
  const now = new Date().toLocaleString('en-US', { timeZone: 'Europe/Kyiv' });
  const date = new Date(now);

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return BIRTHDAYS.filter(p => p.date === `${day}.${month}`);
}

// 🎉 Відправка
async function sendBirthdayGreeting(bot, chatId, names) {
  const videoPath = path.join(__dirname, 'gif', 'konosuba.mp4');

  const greetingText =
    `🎉 УВАГА! СЬОГОДНІ ОСОБЛИВИЙ ДЕНЬ! ✨\n\n` +
    `🎈 Вітаю з Днем Народження, ${names.join(', ')}!\n\n` +
    `🎆 Нехай твоє життя буде яскравим, як мій вибух!\n` +
    `🔥 Нехай мрії збуваються з гучним БА-БА-БАХ!\n` +
    `🎇 А кожен день приносить нові магії!`;

  const videoCaption = `🎂 Тримай святковий танець на честь тебе! 👇`;

  // Спочатку відправляємо текст
  await bot.sendMessage(chatId, greetingText);

  // Потім відправляємо відео
  if (fs.existsSync(videoPath)) {
    await bot.sendVideo(chatId, videoPath, { caption: videoCaption });
  }
}

module.exports = {
  loadBirthdays,
  getTodayBirthdays,
  sendBirthdayGreeting
};