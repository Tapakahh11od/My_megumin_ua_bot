const https = require('https');

// 🧠 CACHE
const cache = new Map();
const CACHE_TTL = 60 * 1000; // 1 хв (швидше оновлення)

let PLAYERS = [];

// ================= LOAD PLAYERS =================
function loadPlayers() {
    const fs = require('fs');
    const path = require('path');

    try {
        const data = JSON.parse(
            fs.readFileSync(path.join(__dirname, 'players.json'), 'utf8')
        );
        PLAYERS = data.players || [];
    } catch (err) {
        console.error('❌ Failed to load players:', err.message);
    }
}

// ================= HTTP =================
function api(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { timeout: 5000 }, res => {
            let data = '';

            res.on('data', c => data += c);

            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch {
                    reject(new Error('Bad JSON'));
                }
            });
        }).on('error', reject);
    });
}

// ================= CORE =================
async function getPlayerInfo(playerId) {
    const player = PLAYERS.find(p => String(p.id) === String(playerId));
    if (!player) throw new Error('Player not found');

    // 🧠 CACHE
    const cached = cache.get(playerId);
    if (cached && Date.now() - cached.time < CACHE_TTL) {
        return cached.data;
    }

    const accountId = player.steamId64;

    try {
        // ⚡ 1. Профіль + WL паралельно
        const [profile, wl] = await Promise.all([
            api(`https://api.opendota.com/api/players/${accountId}`),
            api(`https://api.opendota.com/api/players/${accountId}/wl`)
        ]);

        // ⚡ 2. Герої + recent matches (легкі endpoints)
        const [heroes, recent] = await Promise.all([
            api(`https://api.opendota.com/api/players/${accountId}/heroes`),
            api(`https://api.opendota.com/api/players/${accountId}/recentMatches`)
        ]);

        // 👤 nickname + avatar
        const name = profile?.profile?.personaname || player.name;
        const avatar = profile?.profile?.avatarfull;

        // 📊 WL
        const wins = wl.win || 0;
        const losses = wl.lose || 0;
        const total = wins + losses;
        const winrate = total ? ((wins / total) * 100).toFixed(1) : '0.0';

        // 🧙 top heroes
        const topHeroes = (heroes || [])
            .sort((a, b) => b.games - a.games)
            .slice(0, 3)
            .map(h => {
                const wr = h.games ? ((h.win / h.games) * 100).toFixed(0) : 0;
                return `• ${h.localized_name || h.hero_id} — ${wr}% (${h.games})`;
            })
            .join('\n');

        // 🕒 recent games
        const recentLine = (recent || [])
            .slice(0, 5)
            .map(m => {
                const win = (m.player_slot < 128 && m.radiant_win) ||
                            (m.player_slot >= 128 && !m.radiant_win);
                return win ? 'W' : 'L';
            })
            .join(' / ');

        // 📦 TEXT
        const text =
`🎮 *${name}*

🏆 Win/Loss: ${wins} / ${losses}
📊 Winrate: ${winrate}%

🕒 Recent: ${recentLine}

🧙 Top heroes:
${topHeroes}`;

        const result = {
            text,
            photo: avatar
        };

        cache.set(playerId, {
            time: Date.now(),
            data: result
        });

        return result;

    } catch (err) {
        console.error('❌ Dota error:', err.message);
        throw err;
    }
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

module.exports = {
    loadPlayers,
    getPlayerInfo,
    getPlayersKeyboard
};