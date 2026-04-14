const https = require('https');

// 🧠 CACHE
const cache = new Map();
const CACHE_TTL = 60 * 1000; // 1 хв

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
        const req = https.get(url, { timeout: 5000 }, res => {
            let data = '';

            res.on('data', c => data += c);

            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch {
                    reject(new Error('Bad JSON'));
                }
            });
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout'));
        });

        req.on('error', reject);
    });
}

// ================= MAIN =================
async function getPlayerInfo(playerId) {
    const player = PLAYERS.find(p => String(p.id) === String(playerId));
    if (!player) throw new Error('Player not found');

    const cached = cache.get(playerId);
    if (cached && Date.now() - cached.time < CACHE_TTL) {
        return cached.data;
    }

    const accountId = player.steamId64;

    try {
        // ⚡ SAFE PARALLEL REQUESTS
        const [profile, wl, heroes, recent] = await Promise.allSettled([
            api(`https://api.opendota.com/api/players/${accountId}`),
            api(`https://api.opendota.com/api/players/${accountId}/wl`),
            api(`https://api.opendota.com/api/players/${accountId}/heroes`),
            api(`https://api.opendota.com/api/players/${accountId}/recentMatches`)
        ]);

        // 🧠 SAFE DATA
        const profileData = profile.status === 'fulfilled' ? profile.value : {};
        const wlData = wl.status === 'fulfilled' ? wl.value : { win: 0, lose: 0 };
        const heroesData = heroes.status === 'fulfilled' ? heroes.value : [];
        const recentData = recent.status === 'fulfilled' ? recent.value : [];

        // 👤 NAME + AVATAR
        const name = profileData?.profile?.personaname || player.name;
        const avatar = profileData?.profile?.avatarfull || null;

        // 📊 WIN/LOSS
        const wins = wlData.win || 0;
        const losses = wlData.lose || 0;
        const total = wins + losses;
        const winrate = total ? ((wins / total) * 100).toFixed(1) : '0.0';

        // 🧙 HEROES (SAFE - NO localized_name)
        const topHeroes = (heroesData || [])
            .sort((a, b) => (b.games || 0) - (a.games || 0))
            .slice(0, 3)
            .map(h => {
                const games = h.games || 0;
                const wr = games ? ((h.win / games) * 100).toFixed(0) : 0;
                return `• Hero ID ${h.hero_id} — ${wr}% (${games})`;
            })
            .join('\n') || '• Немає даних';

        // 🕒 RECENT MATCHES
        const recentLine = (recentData || [])
            .slice(0, 5)
            .map(m => {
                const win =
                    (m.player_slot < 128 && m.radiant_win) ||
                    (m.player_slot >= 128 && !m.radiant_win);

                return win ? 'W' : 'L';
            })
            .join(' / ') || 'Немає ігор';

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
        console.error('❌ DOTA FULL ERROR:', err);

        // 🛡 ALWAYS RETURN SOMETHING
        return {
            text: `❌ Не вдалося отримати повну статистику\n\nСпробуйте пізніше`,
            photo: null
        };
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