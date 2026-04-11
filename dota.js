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

  const matches = await getTurboMatches(player.steamId64);

  if (!matches || matches.length === 0) {
    return { text: '❌ Немає Turbo матчів' };
  }

  let wins = 0, k = 0, d = 0, a = 0, time = 0, gpm = 0;
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
      if (!heroStats[m.hero_id]) heroStats[m.hero_id] = { games: 0, wins: 0 };
      heroStats[m.hero_id].games++;
      if (win) heroStats[m.hero_id].wins++;
    }
  }

  const games = matches.length;

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

⚡ Turbo (100 games)
✅ ${wins} | ❌ ${games - wins}

⚔️ KDA: ${(k/games).toFixed(1)} / ${(d/games).toFixed(1)} / ${(a/games).toFixed(1)}
⏱️ ${(time/games/60).toFixed(0)} min
💰 GPM: ${(gpm/games).toFixed(0)}

🔥 Top Heroes:
${topHeroes.map(h => `• ${h.name} (${h.games})`).join('\n')}`;

  const result = {
    text
  };

  if (profile?.profile?.avatarmedium) {
    result.photo = profile.profile.avatarmedium;
  }

  cache.set(cacheKey, { time: now, data: result });

  return result;
}