const https = require('https');
const fs = require('fs');
const path = require('path');

// 🎮 Налаштування
const PLAYERS_FILE = path.join(__dirname, 'players.json');
const API_BASE = 'https://api.opendota.com/api';
const MATCH_LIMIT = 20;

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
function apiRequest(endpoint, label = '') {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${endpoint}`;
    console.log(`🔍 ЗАПИТ ${label}: ${url}`);
    
    https.get(url, { 
      headers: { 'User-Agent': 'MeguminBot/1.0' },
      timeout: 10000
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`📥 ВІДПОВІДЬ ${label}: Статус ${res.statusCode}`);
        
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) { reject(e); }
        } else {
          console.error(`❌ ПОМИЛКА: ${data.substring(0, 100)}`);
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    }).on('error', err => {
      console.error(`❌ МЕРЕЖЕВА ПОМИЛКА: ${err.message}`);
      reject(err);
    }).on('timeout', () => {
      console.error('⏰ ТАЙМ-АУТ');
      reject(new Error('TIMEOUT'));
    });
  });
}

// 📊 Отримання статистики гравця
async function getPlayerStats(playerId) {
  const player = PLAYERS.find(p => p.id === playerId);
  if (!player) throw new Error(`Гравця "${playerId}" не знайдено в players.json`);

  console.log(`🎮 Запит статистики для: ${player.name} (${player.steamId64})`);

  try {
    const profile = await apiRequest(`/players/${player.steamId64}`, 'Профіль');
    const matches = await apiRequest(`/players/${player.steamId64}/matches?limit=${MATCH_LIMIT}`, 'Матчі');

    if (!matches || matches.length === 0) {
      return `⚠️ Немає даних про матчі для ${player.name}. Перевірте, чи публічний профіль.`;
    }

    // 📈 Підрахунок статистики
    let wins = 0;
    let totalKills = 0, totalDeaths = 0, totalAssists = 0;
    let avgDuration = 0;
    const heroesPlayed = new Set();

    matches.forEach(m => {
      // ✅ ВИПРАВЛЕНО: правильна перевірка перемоги
      if (m.win === 1 || m.win === true) wins++;
      
      totalKills += m.kills || 0;
      totalDeaths += m.deaths || 0;
      totalAssists += m.assists || 0;
      avgDuration += m.duration || 0;
      
      // ✅ ВИПРАВЛЕНО: правильне поле для героя
      if (m.hero_id) heroesPlayed.add(m.hero_id);
    });

    const gamesPlayed = matches.length;
    const winRate = ((wins / gamesPlayed) * 100).toFixed(1);
    const avgKDA = ((totalKills + totalAssists) / Math.max(totalDeaths, 1)).toFixed(2);
    const avgMatchTime = Math.round((avgDuration / gamesPlayed) / 60);

    // 📝 Формування повідомлення
    const avatar = profile.avatarmedium || profile.avatar || null;
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

    if (!avatar) {
      return { text: msg, parse_mode: 'Markdown' };
    }
    return { text: msg, photo: avatar, parse_mode: 'Markdown' };
    
  } catch (err) {
    if (err.message.includes('404')) {
      return `❌ Профіль ${player.name} не знайдено або приватний.\nПеревірте налаштування Steam.`;
    }
    throw err;
  }
}

module.exports = {
  loadPlayers,
  getPlayersKeyboard,
  getPlayerStats
};