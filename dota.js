const https = require('https');

// ===== API =====
function apiRequest(url) {
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            if (res.statusCode !== 200) {
                return reject(new Error(`Status: ${res.statusCode}`));
            }

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

// ===== LOAD PLAYERS =====
let PLAYERS = [];

function loadPlayers() {
    const fs = require('fs');
    const path = require('path');

    const data = JSON.parse(
        fs.readFileSync(path.join(__dirname, 'players.json'), 'utf8')
    );

    if (!Array.isArray(data.players)) {
        throw new Error('Invalid players.json');
    }

    PLAYERS = data.players;
}

// ===== KEYBOARD =====
function getPlayersKeyboard() {
    return {
        inline_keyboard: PLAYERS.map(p => [{
            text: `👤 ${p.name}`,
            callback_data: `player:${p.id}`
        }])
    };
}

// ===== GET TURBO STATS =====
async function getTurboStats(accountId) {
    let matches = [];
    let offset = 0;

    while (offset < 300) {
        const data = await apiRequest(
            `https://api.opendota.com/api/players/${accountId}/matches?limit=100&offset=${offset}`
        );

        if (!Array.isArray(data) || data.length === 0) break;

        matches = matches.concat(data);
        offset += 100;
    }

    // тільки TURBO
    matches = matches.filter(m => m.lobby_type === 7);

    let wins = 0;

    for (const m of matches) {
        const isRadiant = m.player_slot < 128;
        const win = (isRadiant && m.radiant_win) || (!isRadiant && !m.radiant_win);
        if (win) wins++;
    }

    const total = matches.length;
    const loses = total - wins;
    const winrate = total ? ((wins / total) * 100).toFixed(1) : 0;

    return { total, wins, loses, winrate };
}

// ===== MAIN =====
async function getPlayerInfo(playerId) {
    const player = PLAYERS.find(p => p.id === playerId);
    if (!player) throw new Error('Player not found');

    const profile = await apiRequest(
        `https://api.opendota.com/api/players/${player.accountId}`
    );

    const stats = await getTurboStats(player.accountId);

    const name = profile?.profile?.personaname || 'Unknown';
    const avatar = profile?.profile?.avatarfull;

    const text =
`🎮 ${name}

⚡ Turbo (all time)
✅ ${stats.wins} / ❌ ${stats.loses}
📊 Winrate: ${stats.winrate}%`;

    return { text, photo: avatar };
}

module.exports = {
    loadPlayers,
    getPlayersKeyboard,
    getPlayerInfo
};