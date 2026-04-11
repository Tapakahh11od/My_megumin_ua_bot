const https = require('https');

// 🧠 КЕШ (5 хв)
const cache = new Map();
const CACHE_TIME = 5 * 60 * 1000;

// 🦸 HERO MAP (можна розширити)
let HEROES = {};

// ================= API =================
function apiRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';

      res.on('data', c => data += c);

      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });

    }).on('error', reject);
  });
}

// ================= LOAD HEROES =================
async function loadHeroes() {
  try {
    const data = await apiRequest('https://api.opendota.com/api/heroes');

    data.forEach(h => {
      HEROES[h.id] = h.localized_name;
    });

    console.log(`🦸 Loaded ${data.length} heroes`);
  } catch (e) {
    console.error('❌ Heroes load error', e.message);
  }
}

// ================= PLAYERS =================
let PLAYERS = [];

function loadPlayers() {
  const fs = require('fs');
  const path = require('path');

  const data = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'players.json'), 'utf8')
  );

  PLAYERS = data.players || [];
}

// ================= KEYBOARD =================
function getPlayersKeyboard() {
  return {
    inline_keyboard: PLAYERS.map(p => [{
      text: `👤 ${p.name}`,
      callback_data: `dota_player:${p.id}`
    }])
  };
}

// ================= GET 100 TURBO (PAGINATION) =================
async function getTurboMatches(accountId) {
  let results = [];
  let offset = 0;

  while (results.length < 100 && offset < 500) {
    const url =
      `https://api.opendota.com/api/players/${accountId}/matches` +
      `?lobby_type=7&limit=100&offset=${offset}`;

    const data = await apiRequest(url);

    if (!data || data.length === 0) break;

    results = results.concat(data);
    offset += 100;
  }

  return results.slice(0, 100);
}

// ================= STATS =================
async function getPlayerStats(playerId) {
  const player = PLAYERS.find(p => p.id === playerId);
  if (!player) throw new Error('Player not found');

  const cacheKey = player.steamId64;
  const now = Date.now();

  // 🔥 CACHE CHECK
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (now - cached.time < CACHE_TIME) {
      return cached.data;
    }
  }

  // 🧠 GET DATA
  const profile = await apiRequest(
    `https://api.opendota.com/api/players/${player.steamId64}`
  );

  const matches = await getTurboMatches(player.steamId64);

  if (!matches.length) {
    return '❌ No Turbo matches found';
  }

  let wins = 0;
  let k = 0, d = 0, a = 0;
  let time = 0;
  let gpm = 0;

  const heroStats = {};

  matches.forEach(m => {
    const isRadiant = m.player_slot < 128;
    const win = (isRadiant && m.radiant_win) || (!isRadiant && !m.radiant_win);

    if (win) wins++;

    k += m.kills || 0;
    d += m.deaths || 0;
    a += m.assists || 0;
    time += m.duration || 0;
    gpm += m.gold_per_min || 0;

    if (m.hero_id) {
      if (!heroStats[m.hero_id]) {
        heroStats[m.hero_id] = { games: 0, wins: 0 };
      }

      heroStats[m.hero_id].games++;
      if (win) heroStats[m.hero_id].wins++;
    }
  });

  const games = matches.length;

  // 🔥 TOP HEROES
  const topHeroes = Object.entries(heroStats)
    .map(([id, h]) => ({
      name: HEROES[id] || `Hero ${id}`,
      games: h.games,
      winrate: ((h.wins / h.games) * 100).toFixed(0)
    }))
    .sort((a, b) => b.games - a.games)
    .slice(0, 3);

  const result = {
    text:
`🎮 ${player.name}
🏅 Rank: ${profile.rank_tier || 'Unknown'}

⚡ Turbo (100 games)
✅ ${wins} | ❌ ${games - wins} (${((wins/games)*100).toFixed(1)}%)

⚔️ KDA: ${(k/games).toFixed(1)} / ${(d/games).toFixed(1)} / ${(a/games).toFixed(1)}
⏱️ ${(time/games/60).toFixed(0)} min
💰 GPM: ${(gpm/games).toFixed(0)}

🔥 Top Heroes:
${topHeroes.map(h =>
`• ${h.name} — ${h.games} games (${h.winrate}%)`
).join('\n')}

🔗 OpenDota: https://www.opendota.com/players/${player.steamId64}`
  };

  // 💾 CACHE SAVE
  cache.set(cacheKey, {
    time: now,
    data: result
  });

  if (profile.profile?.avatarmedium) {
    result.photo = profile.profile.avatarmedium;
  }

  return result;
}

// ================= EXPORT =================
module.exports = {
  loadPlayers,
  loadHeroes,
  getPlayersKeyboard,
  getPlayerStats
};