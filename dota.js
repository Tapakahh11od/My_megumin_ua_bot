const fs = require('fs');
const path = require('path');
const https = require('https');

// 🎮 Налаштування
const PLAYERS_FILE = path.join(__dirname, 'players.json');
const API_BASE = 'https://api.opendota.com/api';
const MATCH_LIMIT = 100;

let PLAYERS = [];

// 📥 Завантаження списку гравців
function loadPlayers() {
  try {
    const data = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8'));
    PLAYERS = data.players || [];
    console.log(`🎮 Завантажено ${PLAYERS.length} гравців Dota 2`);
  } catch (err) {
    console.error('❌ КРИТИЧНА ПОМИЛКА players.json:', err.message);
    process.exit(1);
  }
}

// 🔘 Клавіатура
function getPlayersKeyboard() {
  return {
    inline_keyboard: PLAYERS.map(p => [{
      text: `👤 ${p.name}`,
      callback_data: `dota_player:${p.id}`
    }])
  };
}

// 🌐 API запит
function apiRequest(endpoint, label = '') {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${endpoint}`;
    console.log(`🔍 ${label}: ${url}`);

    https.get(url, {
      headers: { 'User-Agent': 'MeguminBot/2.0' },
      timeout: 15000
    }, res => {
      let data = '';

      res.on('data', chunk => data += chunk);

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });

    }).on('error', reject)
      .on('timeout', () => reject(new Error('TIMEOUT')));
  });
}

// 📊 ГОЛОВНА ФУНКЦІЯ
async function getPlayerStats(playerId) {
  const player = PLAYERS.find(p => p.id === playerId);
  if (!player) throw new Error('Гравця не знайдено');

  try {
    // 🔄 Refresh
    try {
      await apiRequest(`/players/${player.steamId64}/refresh`);
      await new Promise(r => setTimeout(r, 2000));
    } catch {}

    const profile = await apiRequest(`/players/${player.steamId64}`);

    // 📥 Беремо більше матчів, щоб відфільтрувати Turbo
    const matches = await apiRequest(`/players/${player.steamId64}/matches?limit=200`);

    if (!matches.length) return '❌ Немає матчів';

    // ⚡ ФІЛЬТР TURBO
    const turboMatches = matches.filter(m => m.lobby_type === 7).slice(0, 100);

    if (!turboMatches.length) {
      return '⚠️ Немає Turbo ігор у останніх матчах';
    }

    let wins = 0;
    let totalKills = 0;
    let totalDeaths = 0;
    let totalAssists = 0;
    let totalDuration = 0;
    let totalGold = 0;

    const heroStats = {};

    turboMatches.forEach(m => {
      const isRadiant = m.player_slot < 128;

      if ((isRadiant && m.radiant_win) || (!isRadiant && !m.radiant_win)) {
        wins++;
      }

      totalKills += m.kills || 0;
      totalDeaths += m.deaths || 0;
      totalAssists += m.assists || 0;
      totalDuration += m.duration || 0;
      totalGold += m.gold_per_min || 0;

      // 🦸 Герої
      if (m.hero_id) {
        if (!heroStats[m.hero_id]) {
          heroStats[m.hero_id] = { games: 0, wins: 0 };
        }

        heroStats[m.hero_id].games++;

        if ((isRadiant && m.radiant_win) || (!isRadiant && !m.radiant_win)) {
          heroStats[m.hero_id].wins++;
        }
      }
    });

    const games = turboMatches.length;
    const losses = games - wins;

    const winRate = ((wins / games) * 100).toFixed(1);

    const avgKills = (totalKills / games).toFixed(1);
    const avgDeaths = (totalDeaths / games).toFixed(1);
    const avgAssists = (totalAssists / games).toFixed(1);

    const avgTime = Math.round((totalDuration / games) / 60);
    const avgGPM = Math.round(totalGold / games);

    // 🔥 ТОП 5 ГЕРОЇВ
    const topHeroes = Object.entries(heroStats)
      .map(([heroId, data]) => ({
        heroId,
        games: data.games,
        winrate: ((data.wins / data.games) * 100).toFixed(0)
      }))
      .sort((a, b) => b.games - a.games)
      .slice(0, 5);

    // 🧾 Профіль
    const avatar = profile.profile?.avatarmedium;
    const rank = profile.rank_tier || 'Невідомо';

    // 📝 ТЕКСТ
    let msg = `🎮 *${player.name}*\n`;
    msg += `🏅 Ранг: ${rank}\n\n`;

    msg += `⚡ *Turbo (останні ${games} ігор)*\n\n`;

    msg += `✅ ${wins} | ❌ ${losses} (${winRate}%)\n\n`;

    msg += `⚔️ KDA:\n`;
    msg += `${avgKills} / ${avgDeaths} / ${avgAssists}\n\n`;

    msg += `⏱️ ${avgTime} хв\n`;
    msg += `💰 GPM: ${avgGPM}\n\n`;

    msg += `🔥 *Топ герої:*\n`;

    if (topHeroes.length === 0) {
      msg += `— немає даних\n`;
    } else {
      topHeroes.forEach(h => {
        msg += `ID ${h.heroId} — ${h.games} ігор (${h.winrate}%)\n`;
      });
    }

    msg += `\n🔗 [Steam](https://steamcommunity.com/profiles/${player.steamId64})`;
    msg += `\n🔗 [OpenDota](https://www.opendota.com/players/${player.steamId64})`;

    if (avatar) {
      return {
        photo: avatar,
        caption: msg,
        parse_mode: 'Markdown'
      };
    }

    return { text: msg, parse_mode: 'Markdown' };

  } catch (err) {
    console.error(err);
    return '❌ Помилка отримання статистики';
  }
}

module.exports = {
  loadPlayers,
  getPlayersKeyboard,
  getPlayerStats
};