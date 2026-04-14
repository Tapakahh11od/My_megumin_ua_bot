const fs = require('fs');
const path = require('path');

const playersPath = path.join(__dirname, '../data/players.json');

const dotaHandler = async (ctx) => {
  await ctx.answerCbQuery();

  const data = JSON.parse(fs.readFileSync(playersPath));

  let message = '🎮 Dota 2 гравці:\n\n';

  data.players.forEach((p) => {
    message += `${p.name} → ID: ${p.playersid}\n`;
  });

  await ctx.reply(message);
};

module.exports = { dotaHandler };