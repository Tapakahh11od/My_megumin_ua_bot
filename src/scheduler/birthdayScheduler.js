const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const birthdaysPath = path.join(__dirname, '../data/birthdays.json');
const gifPath = path.join(__dirname, '../../gif/megumin.gif');

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

const startBirthdayScheduler = (bot) => {
  cron.schedule('0 9 * * *', async () => {
    const today = new Date();

    const todayStr =
      String(today.getDate()).padStart(2, '0') +
      '.' +
      String(today.getMonth() + 1).padStart(2, '0');

    try {
      const data = JSON.parse(fs.readFileSync(birthdaysPath));

      const todayBirthdays = data.filter(
        (u) => u.date === todayStr
      );

      if (!todayBirthdays.length) return;

      for (const user of todayBirthdays) {
        await bot.telegram.sendMessage(
          ADMIN_CHAT_ID,
          `🎉 ${user.name}, з Днем Народження! 🎂💥`
        );

        await bot.telegram.sendAnimation(ADMIN_CHAT_ID, {
          source: gifPath,
        });
      }
    } catch (e) {
      console.error(e);
    }
  });
};

module.exports = { startBirthdayScheduler };