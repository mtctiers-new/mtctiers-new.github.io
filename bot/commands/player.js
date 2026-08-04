const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../firebase');
const config = require('../config');

const playerCommands = [

  // 1. /info
  new SlashCommandBuilder()
    .setName('info')
    .setDescription('View official MTCTiers player card profile')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true)),

  // 2. /skin
  new SlashCommandBuilder()
    .setName('skin')
    .setDescription('View player Minecraft skin avatar')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true)),

  // 3. /tiers
  new SlashCommandBuilder()
    .setName('tiers')
    .setDescription('View all kit tiers of a player')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true)),

  // 4. /duelhistory
  new SlashCommandBuilder()
    .setName('duelhistory')
    .setDescription('View recent duels of a player')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true)),

  // 5. /search
  new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search MTCTiers player rankings')
    .addStringOption(o => o.setName('query').setDescription('Username substring search').setRequired(true)),

  // 6. /kits
  new SlashCommandBuilder()
    .setName('kits')
    .setDescription('List all official MTCTiers PvP kit categories & point rules'),

  // 7. /randomplayer
  new SlashCommandBuilder()
    .setName('randomplayer')
    .setDescription('Display a random MTCTiers player card profile')
];

async function handlePlayerCommand(interaction) {
  const { commandName, options } = interaction;
  const rankings = db.loadLocalRankings();
  const duels = db.loadLocalDuels();

  const errorEmbed = (desc) => new EmbedBuilder().setTitle('❌ Player Not Found').setDescription(desc).setColor(0xef4444).setTimestamp();

  try {

    // 1. /info
    if (commandName === 'info' || commandName === 'randomplayer') {
      let player = '';
      if (commandName === 'randomplayer') {
        const pList = rankings.Players || [];
        if (!pList.length) return interaction.reply({ embeds: [errorEmbed('No players found on leaderboard.')] });
        const randObj = pList[Math.floor(Math.random() * pList.length)];
        player = typeof randObj === 'object' ? randObj.name : randObj;
      } else {
        player = options.getString('player').trim();
      }

      const sortedOverall = Object.entries(rankings.Overall || {}).sort((a, b) => b[1] - a[1]);
      const rankIdx = sortedOverall.findIndex(([p]) => p.toLowerCase() === player.toLowerCase());

      if (rankIdx === -1 && commandName !== 'randomplayer') {
        return interaction.reply({ embeds: [errorEmbed(`Could not find player **${player}** on MTCTiers.`)] });
      }

      const matchedName = rankIdx !== -1 ? sortedOverall[rankIdx][0] : player;
      const pts = rankings.Overall[matchedName] || 0;
      const rankNum = rankIdx !== -1 ? rankIdx + 1 : 'UNRANKED';

      const tInfo = db.getPlayerTitle(pts, typeof rankNum === 'number' ? rankNum : 999);
      const pDetail = (rankings.Players || []).find(p => (typeof p === 'object' ? p.name : p).toLowerCase() === matchedName.toLowerCase()) || {};

      const skinUrl = pDetail.skinUrl || `https://preview-mtctiers-015.surge.sh/assets/players/${matchedName.toLowerCase()}.png`;

      // Collect kit tiers
      const kitTiers = [];
      for (const k in rankings) {
        if (k === 'Overall' || k === 'Players' || k === 'HallOfFame' || k === 'Testers') continue;
        for (const t in rankings[k]) {
          if (Array.isArray(rankings[k][t])) {
            const hasPlayer = rankings[k][t].some(p => p.toLowerCase() === matchedName.toLowerCase());
            if (hasPlayer) {
              kitTiers.push(`• **${k}**: \`${t}\``);
            }
          }
        }
      }

      const embed = new EmbedBuilder()
        .setTitle(`🎮 PLAYER PROFILE: ${matchedName}`)
        .setThumbnail(skinUrl)
        .setColor(tInfo.color)
        .addFields(
          { name: '🏆 Global Rank', value: `#**${rankNum}** OVERALL`, inline: true },
          { name: '⭐ Total Points', value: `**${pts} PTS**`, inline: true },
          { name: '👑 Title', value: `${tInfo.icon} **${tInfo.title}**`, inline: true },
          { name: '🌐 Region', value: pDetail.region || 'EU', inline: true },
          { name: '📱 Device', value: pDetail.device || 'MK', inline: true },
          { name: '⚔️ Rival', value: pDetail.rival || 'None', inline: true },
          { name: '💬 Discord', value: pDetail.discord || 'Not set', inline: true },
          { name: '▶️ YouTube', value: pDetail.youtube || 'Not set', inline: true },
          { name: '🥊 Tierlist Placements', value: kitTiers.length ? kitTiers.join('\n') : '*No kit tiers assigned yet.*', inline: false }
        )
        .setFooter({ text: 'MTCTiers Official Player Database', iconURL: 'https://preview-mtctiers-015.surge.sh/assets/mtctiers.png' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // 2. /skin
    if (commandName === 'skin') {
      const player = options.getString('player').trim();
      const pDetail = (rankings.Players || []).find(p => (typeof p === 'object' ? p.name : p).toLowerCase() === player.toLowerCase()) || {};
      const skinUrl = pDetail.skinUrl || `https://preview-mtctiers-015.surge.sh/assets/players/${player.toLowerCase()}.png`;

      const embed = new EmbedBuilder()
        .setTitle(`🎨 Skin Preview: ${player}`)
        .setImage(skinUrl)
        .setColor(0x00eeff)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // 3. /tiers
    if (commandName === 'tiers') {
      const player = options.getString('player').trim();
      const activeTiers = [];
      const retiredTiers = [];

      for (const k in rankings) {
        if (k === 'Overall' || k === 'Players' || k === 'HallOfFame' || k === 'Testers') continue;
        for (const t in rankings[k]) {
          if (Array.isArray(rankings[k][t])) {
            const hasPlayer = rankings[k][t].some(p => p.toLowerCase() === player.toLowerCase());
            if (hasPlayer) {
              if (t.startsWith('R')) {
                retiredTiers.push(`• **${k}**: \`${t}\``);
              } else {
                activeTiers.push(`• **${k}**: \`${t}\``);
              }
            }
          }
        }
      }

      const embed = new EmbedBuilder()
        .setTitle(`⚔️ Kit Tiers: ${player}`)
        .setColor(0x00eeff)
        .addFields(
          { name: '🔥 Active Tiers', value: activeTiers.length ? activeTiers.join('\n') : '*None*', inline: false },
          { name: '📜 Retired Tiers', value: retiredTiers.length ? retiredTiers.join('\n') : '*None*', inline: false }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // 4. /duelhistory
    if (commandName === 'duelhistory') {
      const player = options.getString('player').trim();
      const dData = duels[player] || [];
      const dList = Array.isArray(dData) ? dData : dData.duels || [];

      if (!dList.length) {
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`⚔️ Duel History: ${player}`).setDescription('*No recorded duels found.*').setColor(0x00eeff)] });
      }

      let wins = 0;
      let losses = 0;
      const historyLines = dList.slice(0, 8).map(d => {
        const isWin = d.result === 'Won';
        if (isWin) wins++; else losses++;
        const statusEmoji = isWin ? '🟢 WIN' : '🔴 LOSS';
        const opp = d.player1.toLowerCase() === player.toLowerCase() ? d.player2 : d.player1;
        const sMy = d.player1.toLowerCase() === player.toLowerCase() ? d.player1_score : d.player2_score;
        const sOpp = d.player1.toLowerCase() === player.toLowerCase() ? d.player2_score : d.player1_score;
        return `${statusEmoji} vs **${opp}** (${sMy}-${sOpp}) · *${d.kit}* (${d.outcome})`;
      });

      const embed = new EmbedBuilder()
        .setTitle(`⚔️ Duel History: ${player}`)
        .setDescription(`**Record:** ${wins}W / ${losses}L\n\n` + historyLines.join('\n'))
        .setColor(0x00eeff)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // 5. /search
    if (commandName === 'search') {
      const query = options.getString('query').trim().toLowerCase();
      const pList = rankings.Players || [];
      const matches = pList.filter(p => {
        const name = typeof p === 'object' ? p.name : p;
        return name.toLowerCase().includes(query);
      });

      if (!matches.length) {
        return interaction.reply({ embeds: [errorEmbed(`No players matching "**${query}**".`)] });
      }

      const matchLines = matches.slice(0, 15).map(p => {
        const name = typeof p === 'object' ? p.name : p;
        const pts = rankings.Overall[name] || 0;
        return `• **${name}** — ${pts} PTS`;
      });

      const embed = new EmbedBuilder()
        .setTitle(`🔍 Search Results for "${query}"`)
        .setDescription(matchLines.join('\n'))
        .setColor(0x00eeff)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // 6. /kits
    if (commandName === 'kits') {
      const kitsList = [
        '💎 **Emerald** — Standard Tier Testing',
        '🥊 **Emerald KB** — High Knockback Emerald PvP',
        '🐉 **Dragonhide KB** — Dragonhide Armor KB PvP',
        '🏹 **Manhunt** — Pursuit PvP',
        '⚔️ **Diamond** — Classic Diamond Sword & Armor',
        '🪓 **Novelty Axe** — Axe PvP',
        '⚓ **Dragonhide Anchor** — Heavy Anchor Combat',
        '🌌 **Void** — Void Edge PvP'
      ];

      const embed = new EmbedBuilder()
        .setTitle('⚔️ OFFICIAL MTC TIERS PVP KITS')
        .setDescription(kitsList.join('\n\n') + '\n\n**Point Breakdown per Tier:**\n• **HT1**: 65 PTS | **LT1**: 45 PTS\n• **HT2**: 30 PTS | **LT2**: 20 PTS\n• **HT3**: 10 PTS | **LT3**: 5 PTS')
        .setColor(0x00eeff)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

  } catch (err) {
    console.error('Error handling player command:', err);
    return interaction.reply({ embeds: [errorEmbed(err.message)], ephemeral: true });
  }
}

module.exports = {
  playerCommands,
  handlePlayerCommand
};
