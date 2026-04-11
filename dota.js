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
  if (!player) throw new Error(`Гравця "${playerId}" не знайдено`);

  console.log(`🎮 Статистика для ${player.name}`);

  try {
    // 🔄 Оновлення профілю
    try {
      await apiRequest(`/players/${player.steamId64}/refresh`, 'Refresh');
    } catch (e) {
      console.log('⚠️ Refresh не вдався (це нормально)');
    }

    // 📥 Дані
    const profile = await apiRequest(`/players/${player.steamId64}`, 'Profile');
    const matches = await apiRequest(
      `/players/${player.steamId64}/matches?limit=${MATCH_LIMIT}`,
      'Matches'
    );

    if (!matches || matches.length === 0) {
      return `⚠️ Немає матчів (можливо профіль приватний)`;
    }

    // 📊 Статистика
    let wins = 0;
    let totalKills = 0;
    let totalDeaths = 0;
    let totalAssists = 0;
    let totalDuration = 0;

    const heroesPlayed = new Set();
    let turboGames = 0;

    matches.forEach(m => {
      // ✅ ПРАВИЛЬНЕ ВИЗНАЧЕННЯ ПЕРЕМОГИ
      const isRadiant = m.player_slot < 128;
      if ((isRadiant && m.radiant_win) || (!isRadiant && !m.radiant_win)) {
        wins++;
      }

      // 📊 Статистика
      totalKills += m.kills || 0;
      totalDeaths += m.deaths || 0;
      totalAssists += m.assists || 0;
      totalDuration += m.duration || 0;

      if (m.hero_id) heroesPlayed.add(m.hero_id);

      // ⚡ Turbo режим
      if (m.game_mode === 23) {
        turboGames++;
      }
    });

    const games = matches.length;
    const losses = games - wins;

    const winRate = ((wins / games) * 100).toFixed(1);

    // ✅ СЕРЕДНІ ЯК У ДОТІ
    const avgKills = (totalKills / games).toFixed(1);
    const avgDeaths = (totalDeaths / games).toFixed(1);
    const avgAssists = (totalAssists / games).toFixed(1);

    const avgKDA = ((totalKills + totalAssists) / Math.max(totalDeaths, 1)).toFixed(2);

    const avgTime = Math.round((totalDuration / games) / 60);

    // 🧾 Профіль
    const avatar = profile.profile?.avatarmedium;
    const rank = profile.rank_tier || 'Невідомо';

    // 📝 Повідомлення
    let msg = `🎮 *${player.name}*\n`;
    msg += `🏅 Ранг: ${rank}\n\n`;

    msg += `📊 *Останні ${games} ігор (включаючи Turbo)*\n\n`;

    msg += `✅ Перемоги: *${wins}* (${winRate}%)\n`;
    msg += `❌ Поразки: *${losses}*\n\n`;

    msg += `⚔️ Середній KDA:\n`;
    msg += `*${avgKills} / ${avgDeaths} / ${avgAssists}*\n`;
    msg += `KDA: ${avgKDA}\n\n`;

    msg += `⏱️ Сер. час: ${avgTime} хв\n`;
    msg += `🦸 Героїв: ${heroesPlayed.size}\n`;
    msg += `⚡ Turbo ігор: ${turboGames}\n\n`;

    msg += `🔗 [Steam](https://steamcommunity.com/profiles/${player.steamId64})\n`;
    msg += `🔗 [OpenDota](https://www.opendota.com/players/${player.steamId64})`;

    if (avatar) {
      return {
        photo: avatar,
        caption: msg,
        parse_mode: 'Markdown'
      };
    }

    return {
      text: msg,
      parse_mode: 'Markdown'
    };

  } catch (err) {
    console.error(err);

    if (err.message.includes('404')) {
      return `❌ Профіль не знайдено або приватний`;
    }

    return `❌ Помилка отримання статистики`;
  }
}

module.exports = {
  loadPlayers,
  getPlayersKeyboard,
  getPlayerStats
};