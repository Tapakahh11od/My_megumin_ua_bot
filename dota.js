const https = require('https');
const fs = require('fs');
const path = require('path');

// 🎮 Налаштування
const PLAYERS_FILE = path.join(__dirname, 'players.json');
const API_BASE = 'https://api.opendota.com/api';
const MATCH_LIMIT = 20; // ⚠️ Рекомендую 20 замість 100: API має ліміти, а 100 матчів створять величезне повідомлення

let PLAYERS = [];

// 📥 Завантаження списку гравців
function loadPlayers() {
  try {
    const data = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8'));
    PLAYERS = data.players || [];
    console.log(`🎮 Завантажено ${PLAYERS.length} гравців Dota 2`);
  } catch (err) {
    console.error('❌ КРИТИЧНА ПОМИЛКА players.json:', err.message);
    process.exit(1); // ВИМИКАЄМО БОТА
  }
}

// 🔘 Створення клавіатури з гравцями
function getPlayersKeyboard() {
  return {
    inline_keyboard: PLAYERS.map(p => [{
      text: `👤 ${p.name}`,
      callback_data: `dota_player:${p.id}`
    }])
  };
}

// 🌐 Універсальний запит до API
function apiRequest(endpoint) {
  return new Promise((resolve, reject) => {
    https.get(`${API_BASE}${endpoint}`, { 
      headers: { 'User-Agent': 'MeguminBot/1.0' },
      timeout: 10000 // 10 секунд
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) { reject(e); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    }).on('error', reject)
      .on('timeout', () => reject(new Error('TIMEOUT')));
  });
}

// 📊 Отримання статистики гравця
async function getPlayerStats(playerId) {
  const player = PLAYERS.find(p => p.id === playerId);
  if (!player) throw new Error('Гравця не знайдено');

  // 1. Отримуємо профіль (для аватарки та рейтингу)
  const profile = await apiRequest(`/players/${player.steamId64}`);
  
  // 2. Отримуємо останні матчі
  const matches = await apiRequest(`/players/${player.steamId64}/matches?limit=${MATCH_LIMIT}`);

  if (!matches || matches.length === 0) {
    return `⚠️ Немає даних про матчі для ${player.name}`;
  }

  // 📈 Підрахунок статистики
  let wins = 0;
  let totalKills = 0, totalDeaths = 0, totalAssists = 0;
  let avgDuration = 0;
  const heroesPlayed = new Set();

  matches.forEach(m => {
    if (m.is_win) wins++;
    totalKills += m.kills || 0;
    totalDeaths += m.deaths || 0;
    totalAssists += m.assists || 0;
    avgDuration += m.duration || 0;
    if (m.hero_name) heroesPlayed.add(m.hero_name);
  });

  const gamesPlayed = matches.length;
  const winRate = ((wins / gamesPlayed) * 100).toFixed(1);
  const avgKDA = ((totalKills + totalAssists) / Math.max(totalDeaths, 1)).toFixed(2);
  const avgMatchTime = Math.round((avgDuration / gamesPlayed) / 60); // у хвилинах

  // 📝 Формування повідомлення
  const avatar = profile.avatarmedium || profile.avatar || '';
  const mmr = profile.solo_competitive_rank || profile.competitive_rank || 'Невідомо';
  const rankIcon = profile.rank_tier ? `🏅 Ранг: ${profile.rank_tier}` : '';

  let msg = `🎮 *Статистика: ${player.name}*\n`;
  msg += `${rankIcon} | 📊 MMR: ${mmr}\n\n`;
  msg += `📈 *За останні ${gamesPlayed} ігор:*\n`;
  msg += `✅ Перемоги: *${wins}* (${winRate}%)\n`;
  msg += `❌ Поразки: *${gamesPlayed - wins}*\n\n`;
  msg += `⚔️ KDA: *${totalKills}/${totalDeaths}/${totalAssists}* (KDA: ${avgKDA})\n`;
  msg += `⏱️ Сер. час гри: ~${avgMatchTime} хв\n`;
  msg += `🦸 Героїв зіграно: ${heroesPlayed.size}\n`;
  msg += `\n🔗 [Профіль Steam](https://steamcommunity.com/profiles/${player.steamId64}) | [OpenDota](https://www.opendota.com/players/${player.steamId64})`;

  return { text: msg, photo: avatar, parse_mode: 'Markdown' };
}

module.exports = {
  loadPlayers,
  getPlayersKeyboard,
  getPlayerStats
};