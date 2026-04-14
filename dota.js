const https = require('https');

// 🧠 CACHE
const cache = new Map();
const CACHE_TTL = 60 * 1000;

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

// ================= SAFE API =================
function api(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { timeout: 6000 }, res => {
            let data = '';

            res.on('data', c => data += c);

            res.on('end', () => {

                // 🛡 invalid response guard
                if (!data || typeof data !== 'string') {
                    return reject(new Error('Empty response'));
                }

                const trimmed = data.trim();

                if (
                    !trimmed.startsWith('{') &&
                    !trimmed.startsWith('[')
                ) {
                    return reject(new Error('Invalid JSON response'));
                }

                try {
                    resolve(JSON.parse(trimmed));
                } catch (e) {
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

    if (!player) {
        throw new Error('Player not found');
    }

    // 🧠 CACHE
    const cached = cache.get(playerId);
    if (cached && Date.now() - cached.time < CACHE_TTL) {
        return cached.data;
    }

    const accountId = player.steamId64;

    try {
        // ⚡ SAFE PARALLEL (no crash)
        const [profile, wl, heroes, recent] = await Promise.allSettled([
            api(`https://api.opendota.com/api/players/${accountId}`),
            api(`https://api.opendota.com/api/players/${accountId}/wl`),
            api(`https://api.opendota.com/api/players/${accountId}/heroes`),
            api(`https://api.opendota.com/api/players/${accountId}/recentMatches`)
        ]);

        // 🛡 SAFE DATA EXTRACTION
        const profileData = profile.status === 'fulfilled' ? profile.value : {};
        const wlData = wl.status === 'fulfilled' ? wl.value : { win: 0, lose: 0 };

        const heroesRaw = heroes.status === 'fulfilled' ? heroes.value : [];
        const recentData = recent.status === 'fulfilled' ? recent.value : [];

        // 🧠 FIX heroes format
        const heroesData = Array.isArray(heroesRaw)
            ? heroesRaw
            : (heroesRaw?.result || heroesRaw?.heroes || []);

        // 👤 NAME
        const name = profileData?.profile?.personaname || player.name;
        const avatar = profileData?.profile?.avatarfull || null;

        // 📊 WL
        const wins = wlData.win || 0;
        const losses = wlData.lose || 0;
        const total = wins + losses;
        const winrate = total ? ((wins / total) * 100).toFixed(1) : '0.0';

        // 🧙 HEROES (SAFE)
        const topHeroes = (heroesData || [])
            .sort((a, b) => (b.games || 0) - (a.games || 0))
            .slice(0, 3)
            .map(h => {
                const games = h.games || 0;
                const wr = games ? ((h.win / games) * 100).toFixed(0) : 0;
                return `• Hero ID ${h.hero_id ?? 'unknown'} — ${wr}% (${games})`;
            })
            .join('\n') || '• Немає даних';

        // 🕒 RECENT MATCHES
        const recentLine = (recentData || [])
            .slice(0, 5)
            .map(m => {
                if (!m) return 'L';

                const win =
                    (m.player_slot < 128 && m.radiant_win) ||
                    (m.player_slot >= 128 && !m.radiant_win);

                return win ? 'W' : 'L';
            })
            .join(' / ') || 'Немає ігор';

        // 📦 RESULT TEXT
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

        // 💾 CACHE SAVE
        cache.set(playerId, {
            time: Date.now(),
            data: result
        });

        return result;

    } catch (err) {
        console.error('❌ DOTA CRITICAL ERROR:', err.message);

        // 🛡 NEVER CRASH BOT
        return {
            text: `❌ Тимчасова помилка отримання Dota даних\nСпробуйте пізніше`,
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