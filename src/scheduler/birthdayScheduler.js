const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const birthdaysPath = path.join(__dirname, '../data/birthdays.json');

const videoPath = path.join(__dirname, '../../gif/birthdayScheduler.mp4');

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

const startBirthdayScheduler = (bot) => {
  cron.schedule('0 9 * * *', async () => {
    try {
      const today = new Date();

      const todayStr =
        String(today.getDate()).padStart(2, '0') +
        '.' +
        String(today.getMonth() + 1).padStart(2, '0');

      const data = JSON.parse(fs.readFileSync(birthdaysPath));

      const todayBirthdays = data.filter(
        (u) => u.date === todayStr
      );

      if (!todayBirthdays.length) return;

      for (const user of todayBirthdays) {
        await bot.telegram.sendMessage(
          ADMIN_CHAT_ID,
          `🎉 ${user.name} має День Народження! 🎂`
        );

        await bot.telegram.sendVideo(
          ADMIN_CHAT_ID,
          { source: videoPath },
          { caption: '🎊 Birthday from Megumin!' }
        );
      }

    } catch (err) {
      console.error('Birthday error:', err);
    }
  });
};

module.exports = { startBirthdayScheduler };