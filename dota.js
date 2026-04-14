const https = require('https');

// 🧠 CACHE (5 хвилин)
const statsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

// ================= PLAYERS =================
let PLAYERS = [];

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

// ================= KEYBOARD =================
function getPlayersKeyboard() {
    return {
        inline_keyboard: PLAYERS.map(p => [{
            text: `👤 ${p.name}`,
            callback_data: `dota_player:${p.id}`
        }])
    };
}

// ================= API REQUEST =================
function apiRequest(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { timeout: 5000 }, res => {
            let data = '';

            res.on('data', chunk => data += chunk);

            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (err) {
                    reject(new Error('Invalid JSON response'));
                }
            });
        }).on('error', reject);
    });
}

// ================= TURBO STATS =================
async function getTurboStats(accountId) {
    // 🔁 CACHE
    const cached = statsCache.get(accountId);
    if (cached && Date.now() - cached.time < CACHE_TTL) {
        return cached.data;
    }

    try {
        // ⚡ беремо тільки перші 100 ігор (достатньо)
        const url = `https://api.opendota.com/api/players/${accountId}/matches?limit=100`;
        const matches = await apiRequest(url);

        if (!Array.isArray(matches)) {
            throw new Error('Invalid matches response');
        }

        // 🎮 тільки turbo
        const turboMatches = matches.filter(m => m.lobby_type === 7);

        if (turboMatches.length === 0) {
            return { wins: 0, losses: 0, winrate: '0.0' };
        }

        let wins = 0;

        for (const m of turboMatches) {
            const isRadiant = m.player_slot < 128;
            const win =
                (isRadiant && m.radiant_win) ||
                (!isRadiant && !m.radiant_win);

            if (win) wins++;
        }

        const total = turboMatches.length;
        const losses = total - wins;
        const winrate = ((wins / total) * 100).toFixed(1);

        const result = { wins, losses, winrate };

        statsCache.set(accountId, {
            time: Date.now(),
            data: result
        });

        return result;

    } catch (err) {
        console.error('❌ Turbo stats error:', err.message);
        return { wins: 0, losses: 0, winrate: '0.0' };
    }
}

// ================= PLAYER INFO =================
async function getPlayerInfo(playerId) {
    const player = PLAYERS.find(p => String(p.id) === String(playerId));
    if (!player) throw new Error('Player not found');

    try {
        const profile = await apiRequest(
            `https://api.opendota.com/api/players/${player.steamId64}`
        );

        const stats = await getTurboStats(player.steamId64);

        const nickname =
            profile?.profile?.personaname || player.name;

        const avatar =
            profile?.profile?.avatarmedium || null;

        const text =
`🎮 *${nickname}*

⚡ *Turbo*
🏆 ${stats.wins}W / ${stats.losses}L
📊 Winrate: *${stats.winrate}%*`;

        return {
            text,
            photo: avatar
        };

    } catch (err) {
        console.error('❌ Player info error:', err.message);
        throw err;
    }
}

// ================= EXPORT =================
module.exports = {
    loadPlayers,
    getPlayersKeyboard,
    getPlayerInfo
};