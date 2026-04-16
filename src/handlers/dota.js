const axios = require('axios');
const { Markup } = require('telegraf');

const { players } = require('../data/players.json');

const getPlayerData = async (accountId) => {
  try {
    const [profileRes, matchesRes, wlRes] = await Promise.all([
      axios.get(`https://api.opendota.com/api/players/${accountId}`),
      axios.get(`https://api.opendota.com/api/players/${accountId}/recentMatches`),
      axios.get(`https://api.opendota.com/api/players/${accountId}/wl`)
    ]);

    const profile = profileRes.data.profile || {};
    const matches = matchesRes.data?.slice(0, 10) || [];
    const wl = wlRes.data || {};

    return {
      name: profile.personaname || 'Unknown',
      avatar: profile.avatarfull || null,
      matches,
      wins: wl.win ?? 0,
      loses: wl.lose ?? 0
    };

  } catch (err) {
    console.error('DOTA API ERROR:', err.message);
    return null;
  }
};

const dotaHandler = async (ctx) => {
  const buttons = players.map(p =>
    [Markup.button.callback(p.name, `DOTA_PLAYER_${p.playersid}`)]
  );

  await ctx.reply(
    '🎮 Обери гравця:',
    Markup.inlineKeyboard(buttons)
  );
};

const dotaPlayerHandler = async (ctx) => {
  const accountId = ctx.callbackQuery.data.split('_').pop();

  await ctx.answerCbQuery();

  const data = await getPlayerData(accountId);

  if (!data) {
    return ctx.reply('❌ Не вдалося отримати дані');
  }

  const last10 = (data.matches || []).map(m => {
    const isWin =
      (m.player_slot < 128 && m.radiant_win) ||
      (m.player_slot >= 128 && !m.radiant_win);

    return isWin ? '✅' : '❌';
  }).join(' ');

  const message = `
👤 ${data.name}

🏆 Wins: ${data.wins}
❌ Loses: ${data.loses}

🕹 Last 10:
${last10}
`;

  if (data.avatar) {
    await ctx.replyWithPhoto(data.avatar, {
      caption: message
    });
  } else {
    await ctx.reply(message);
  }
};

module.exports = {
  dotaHandler,
  dotaPlayerHandler
};