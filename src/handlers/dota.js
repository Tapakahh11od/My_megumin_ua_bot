const axios = require('axios');
const { Markup } = require('telegraf');

// 📦 Підключаємо гравців
const rawData = require('../data/players.json');
const players = rawData.players || [];

// 🧙‍♂️ Мінімальний словник героїв
const HEROES = {
  1: 'Anti-Mage', 2: 'Axe', 3: 'Bane', 8: 'Juggernaut', 9: 'Mirana',
  14: 'Pudge', 34: 'Tinker', 35: 'Sniper', 74: 'Invoker', 102: 'Abaddon',
  119: 'Dark Willow', 123: 'Hoodwink', 136: 'Marci'
};

const getHeroName = (id) => HEROES[id] || `Hero #${id}`;

// =======================
// 🎮 СПИСОК ГРАВЦІВ
// =======================
const dotaHandler = async (ctx) => {
  await ctx.answerCbQuery();

  const buttons = players.map(p => [
    Markup.button.callback(p.name, `DOTA_PLAYER_${p.accountId}`)
  ]);

  await ctx.reply(
    '🎮 <b>Обери гравця:</b>',
    {
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard(buttons)
    }
  );
};

// =======================
// 📊 СТАТИСТИКА ГРАВЦЯ
// =======================
const dotaPlayerHandler = async (ctx) => {
  const accountId = ctx.match[1];

  await ctx.answerCbQuery();
  await ctx.reply('⏳ Завантаження статистики...');

  try {
    const [playerRes, matchesRes, wlRes, heroesRes] = await Promise.all([
      axios.get(`https://api.opendota.com/api/players/${accountId}`),
      axios.get(`https://api.opendota.com/api/players/${accountId}/recentMatches`),
      axios.get(`https://api.opendota.com/api/players/${accountId}/wl`),
      axios.get(`https://api.opendota.com/api/players/${accountId}/heroes`)
    ]);

    const profile = playerRes.data.profile || {};
    const matches = (matchesRes.data || []).slice(0, 20);
    const wl = wlRes.data || {};
    const heroes = heroesRes.data || [];

    // 📊 історія матчів
    let history = [];
    let wins = 0;

    matches.forEach(m => {
      const isRadiant = m.player_slot < 128;
      const isWin = (isRadiant && m.radiant_win) || (!isRadiant && !m.radiant_win);

      if (isWin) wins++;

      const hero = getHeroName(m.hero_id);
      const kda = `${m.kills}/${m.deaths}/${m.assists}`;
      const icon = isWin ? '✅' : '❌';

      history.push(`${icon} ${hero} | ${kda}`);
    });

    const totalWinRate = matches.length
      ? Math.round((wins / matches.length) * 100)
      : 0;

    // 🏆 ТОП герої
    const topHeroes = heroes
      .filter(h => h.games >= 5)
      .map(h => ({
        name: getHeroName(h.hero_id),
        winrate: Math.round((h.win / h.games) * 100),
        games: h.games
      }))
      .sort((a, b) => b.winrate - a.winrate)
      .slice(0, 5);

    const topHeroesText = topHeroes.length
      ? topHeroes.map(h => `🏆 ${h.name} — ${h.winrate}% (${h.games})`).join('\n')
      : 'Немає даних';

    const text = `
🎮 <b>${profile.personaname || 'Unknown'}</b>

🏆 Загалом: ${wl.win || 0}W / ${wl.lose || 0}L

📊 <b>Останні ${matches.length} матчів:</b>
${history.join('\n')}

🔥 Winrate: ${totalWinRate}%

🏅 <b>Топ герої:</b>
${topHeroesText}
`;

    if (profile.avatarfull) {
      await ctx.replyWithPhoto(profile.avatarfull, {
        caption: text,
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Оновити', `DOTA_PLAYER_${accountId}`)],
          [Markup.button.callback('🔙 Назад', 'DOTA')]
        ])
      });
    } else {
      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Оновити', `DOTA_PLAYER_${accountId}`)],
          [Markup.button.callback('🔙 Назад', 'DOTA')]
        ])
      });
    }

  } catch (error) {
    console.error('DOTA ERROR:', error.response?.data || error.message);
    await ctx.reply('❌ Не вдалося отримати статистику');
  }
};

module.exports = { dotaHandler, dotaPlayerHandler };