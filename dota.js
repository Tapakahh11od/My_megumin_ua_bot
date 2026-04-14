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

// ================= GET TURBO STATS =================
async function getTurboStats(accountId) {
    // Перевірка кешу
    if (statsCache.has(accountId)) {
        const cached = statsCache.get(accountId);
        if (Date.now() - cached.time < CACHE_TTL) {
            return cached.data;
        }
    }

    let matches = [];
    let offset = 0;
    
    while (offset < 300) {
        const url = `https://api.opendota.com/api/players/${accountId}/matches?limit=100&offset=${offset}`;
        const data = await apiRequest(url);
        
        if (!Array.isArray(data) || data.length === 0) break;
        
        const turbo = data.filter(m => m && m.lobby_type === 7);
        matches = matches.concat(turbo);
        
        if (matches.length >= 50) break;
        offset += 100;
    }

    const total = matches.length;
    if (total === 0) {
        return { wins: 0, losses: 0, winrate: '0.0' };
    }

    let wins = 0;
    for (const m of matches) {
        const isRadiant = m.player_slot < 128;
        const win = (isRadiant && m.radiant_win) || (!isRadiant && !m.radiant_win);
        if (win) wins++;
    }

    const losses = total - wins;
    const winrate = ((wins / total) * 100).toFixed(1);
    
    const result = { total, wins, losses, winrate };
    
    // Збереження в кеш
    statsCache.set(accountId, { time: Date.now(), data: result });
    
    return result;
}

// ================= GET PLAYER INFO =================
async function getPlayerInfo(playerId) {
    const player = PLAYERS.find(p => p.id === playerId);
    if (!player) throw new Error('Player not found');

    const profile = await apiRequest(
        `https://api.opendota.com/api/players/${player.steamId64}`
    );

    const stats = await getTurboStats(player.steamId64);

    const nickname = profile?.profile?.personaname || player.name;
    const avatar = profile?.profile?.avatarmedium;

    const text = 
`🎮 ${nickname}
⚡ Turbo режим
✅ ${stats.wins} / ❌ ${stats.losses}
📊 Winrate: ${stats.winrate}%`;

    return { text, photo: avatar };
}

// ================= EXPORT =================
module.exports = {
    loadPlayers,
    getPlayersKeyboard,
    getPlayerInfo
};