const axios = require('axios');
const { Markup } = require('telegraf');

// Завантажуємо файл і прибираємо можливі проблеми з пробілами
const rawData = require('../data/players.json');
const players = rawData.players || rawData["players "] || [];

// Словник героїв для красивого відображення (ID -> Name)
const HEROES = {
  1: 'Anti-Mage', 2: 'Axe', 3: 'Bane', 8: 'Juggernaut', 9: 'Mirana',
  14: 'Pudge', 34: 'Tinker', 35: 'Sniper', 74: 'Invoker', 102: 'Abaddon',
  119: 'Dark Willow', 123: 'Hoodwink', 136: 'Marci'
};

const getHeroName = (id) => HEROES[id] || `Hero #${id}`;

// 1. Показати список гравців (кнопка "Dota 2")
const dotaHandler = async (ctx) => {
  await ctx.answerCbQuery();
  
  const buttons = players.map(p => [
    Markup.button.callback(p.name.trim(), `DOTA_PLAYER_${p.playersid.trim()}`)
  ]);

  await ctx.reply(
    '🎮 <b>Обери гравця для статистики:</b>',
    { 
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard(buttons) 
    }
  );
};

// 2. Обробка вибору конкретного гравця
const dotaPlayerHandler = async (ctx) => {
  const accountId = ctx.match[1]; // ID з регулярки
  await ctx.answerCbQuery();
  await ctx.reply('⏳ Завантаження даних з OpenDota...');

  try {
    const playerRes = await axios.get(`https://api.opendota.com/api/players/${accountId}`);
    const matchesRes = await axios.get(`https://api.opendota.com/api/players/${accountId}/recentMatches`);
    const wlRes = await axios.get(`https://api.opendota.com/api/players/${accountId}/wl`);

    const profile = playerRes.data.profile || {};
    const matches = matchesRes.data.slice(0, 10);
    const wl = wlRes.data || {};

    // Формуємо статистику останніх 10 матчів
    let history = [];
    let wins = 0;
    let losses = 0;

    matches.forEach(m => {
      const isRadiant = m.player_slot < 128;
      const isWin = (isRadiant && m.radiant_win) || (!isRadiant && !m.radiant_win);
      
      if (isWin) wins++;
      else losses++;

      const hero = getHeroName(m.hero_id);
      const kda = `${m.kills}/${m.deaths}/${m.assists}`;
      const resIcon = isWin ? '✅' : '❌';
      history.push(`${resIcon} ${hero} | KDA: ${kda}`);
    });

    const totalWinRate = Math.round((wins / 10) * 100);
    const caption = `
🎮 <b>${profile.personaname || 'Unknown'}</b>
🏆 Загалом Wins: ${wl.win} | Losses: ${wl.lose}

🔥 <b>Останні 10 матчів:</b>
${history.join('\n')}

📊 Winrate (10 матчів): ${totalWinRate}%
`;

    if (profile.avatarfull) {
      await ctx.replyWithPhoto(profile.avatarfull, {
        caption,
        parse_mode: 'HTML'
      });
    } else {
      await ctx.reply(caption, { parse_mode: 'HTML' });
    }

  } catch (error) {
    console.error('DOTA API ERROR:', error);
    await ctx.reply('❌ Помилка: Гравець не знайдений або API не відповідає.');
  }
};

module.exports = { dotaHandler, dotaPlayerHandler };