// dota.js
const https = require('https');

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
    let matches = [];
    let offset = 0;
    
    // Збираємо до 500 матчів для точної статистики
    while (offset < 500) {
        const url = `https://api.opendota.com/api/players/${accountId}/matches?limit=100&offset=${offset}`;
        const data = await apiRequest(url);
        
        if (!Array.isArray(data) || data.length === 0) break;
        
        // Фільтруємо тільки ТУРБО (lobby_type === 7)
        const turbo = data.filter(m => m && m.lobby_type === 7);
        matches = matches.concat(turbo);
        
        // Якщо набрали хоча б 50 турбо матчів — достатньо
        if (matches.length >= 50) break;
        
        offset += 100;
    }
    
    const total = matches.length;
    if (total === 0) return { wins: 0, losses: 0, winrate: '0.0' };
    
    let wins = 0;
    for (const m of matches) {
        const isRadiant = m.player_slot < 128;
        const win = (isRadiant && m.radiant_win) || (!isRadiant && !m.radiant_win);
        if (win) wins++;
    }
    
    const losses = total - wins;
    const winrate = ((wins / total) * 100).toFixed(1);
    
    return { total, wins, losses, winrate };
}

// ================= GET PLAYER INFO (СПРОЩЕНИЙ) =================
async function getPlayerInfo(playerId) {
    const player = PLAYERS.find(p => p.id === playerId);
    if (!player) throw new Error('Player not found');
    
    // Отримуємо профіль з OpenDota
    const profile = await apiRequest(
        `https://api.opendota.com/api/players/${player.steamId64}`
    );
    
    // Отримуємо статистику Турбо
    const stats = await getTurboStats(player.steamId64);
    
    const nickname = profile?.profile?.personaname || player.name;
    const avatar = profile?.profile?.avatarmedium;
    
    // Формуємо просте повідомлення
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
    getPlayerInfo  // ✅ Нова спрощена функція
};