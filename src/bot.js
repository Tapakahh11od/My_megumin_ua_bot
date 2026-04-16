const axios = require('axios');
const fs = require('fs');

const players = JSON.parse(fs.readFileSync('./players.json', 'utf-8')).players;

const getPlayerData = async (accountId) => {
  try {
    // профіль
    const profileRes = await axios.get(`https://api.opendota.com/api/players/${accountId}`);
    const profile = profileRes.data.profile;

    // останні матчі
    const matchesRes = await axios.get(`https://api.opendota.com/api/players/${accountId}/recentMatches`);
    const matches = matchesRes.data.slice(0, 10);

    // win/lose
    const wlRes = await axios.get(`https://api.opendota.com/api/players/${accountId}/wl`);
    const wl = wlRes.data;

    return {
      name: profile.personaname,
      avatar: profile.avatarfull,
      matches,
      wins: wl.win,
      loses: wl.lose
    };

  } catch (err) {
    console.error('DOTA API ERROR:', err.message);
    return null;
  }
};

const dotaHandler = async (ctx) => {
  let message = '🎮 Dota Stats:\n\n';

  for (const player of players) {
    const data = await getPlayerData(player.playersid);

    if (!data) {
      message += `❌ ${player.name} - помилка\n\n`;
      continue;
    }

    // рахуємо 10 останніх
    let last10 = data.matches.map(m => {
      const isWin = (m.player_slot < 128 && m.radiant_win) || (m.player_slot >= 128 && !m.radiant_win);
      return isWin ? '✅' : '❌';
    }).join(' ');

    message += `👤 ${data.name}\n`;
    message += `🏆 Wins: ${data.wins} | ❌ Loses: ${data.loses}\n`;
    message += `🕹 Last 10: ${last10}\n`;
    message += `\n`;
  }

  await ctx.reply(message);
};

module.exports = { dotaHandler };