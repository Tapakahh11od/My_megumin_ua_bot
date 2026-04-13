// dota.js
const https = require('https');
const logger = require('./utils/logger'); // 🔥 Новий логер

// 🧠 CACHE
const cache = new Map();
const CACHE_TIME = 5 * 60 * 1000;

// 🦸 HERO MAP
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

// ================= HEROES =================
async function loadHeroes() {
    const data = await apiRequest('https://api.opendota.com/api/heroes');
    data.forEach(h => {
        HEROES[h.id] = h.localized_name;
    });
    logger.info(`🦸 Heroes loaded: ${data.length}`);
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

// ================= TURBO MATCHES =================
async function getTurboMatches(accountId) {
    let results = [];
    let offset = 0;
    while (results.length < 100 && offset < 500) {
        const url =
            `https://api.opendota.com/api/players/${accountId}/matches` +
            `?limit=100&offset=${offset}`;
        const data = await apiRequest(url);

        if (!Array.isArray(data) || data.length === 0) break;

        results = results.concat(data);
        offset += 100;
    }
    return results
        .filter(m => m && m.lobby_type === 7) // ⚡ TRUE TURBO ONLY
        .slice(0, 100);
}

// ================= STATS =================
async function getPlayerStats(playerId) {
    const player = PLAYERS.find(p => p.id === playerId);
    if (!player) throw new Error('Player not found');

    const cacheKey = player.steamId64;
    const now = Date.now();

    if (cache.has(cacheKey)) {
        const cached = cache.get(cacheKey);
        if (now - cached.time < CACHE_TIME) return cached.data;
    }

    const profile = await apiRequest(
        `https://api.opendota.com/api/players/${player.steamId64}`
    );

    let matches = await getTurboMatches(player.steamId64);

    if (!matches.length) {
        return { text: '❌ Немає Turbo матчів' };
    }

    let wins = 0;
    let k = 0, d = 0, a = 0;
    let time = 0;
    let gpm = 0;
    const heroStats = {};

    for (const m of matches) {
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
    }

    const games = matches.length;
    const avgGPM = Math.round(gpm / games);
    const topHeroes = Object.entries(heroStats)
        .map(([id, h]) => ({
            name: HEROES[id] || `Hero ${id}`,
            games: h.games,
            winrate: ((h.wins / h.games) * 100).toFixed(0)
        }))
        .sort((a, b) => b.games - a.games)
        .slice(0, 3);

    const text =
        `🎮 ${player.name}
🏅 Rank: ${profile.rank_tier || 'Unknown'}
⚡ Turbo (останні ${games})
✅ ${wins} | ❌ ${games - wins}
⚔️ KDA: ${(k / games).toFixed(1)} / ${(d / games).toFixed(1)} / ${(a / games).toFixed(1)}
⏱️ ${(time / games / 60).toFixed(0)} min
💰 GPM: ${avgGPM}
🔥 Top Heroes:
${topHeroes.map(h => `• ${h.name} — ${h.games}`).join('\n')}`;

    const result = { text };
    if (profile?.profile?.avatarmedium) {
        result.photo = profile.profile.avatarmedium;
    }

    cache.set(cacheKey, { time: now, data: result });
    return result;
}

// ================= EXPORT =================
module.exports = {
    loadPlayers,
    loadHeroes,
    getPlayersKeyboard,
    getPlayerStats
};