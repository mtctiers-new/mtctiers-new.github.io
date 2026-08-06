const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../firebase');

const LOGO_URL = 'https://raw.githubusercontent.com/mtctiers-new/mtctiers-new.github.io/main/assets/mtctiers.png';
const MAIN_SITE = 'https://mtctiers.com';

const playerCommands = [
  new SlashCommandBuilder().setName('info').setDescription('View official MTCTiers player card profile')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true).setAutocomplete(true)),

  new SlashCommandBuilder().setName('skin').setDescription('View player MultiCraft skin avatar')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true).setAutocomplete(true)),

  new SlashCommandBuilder().setName('tiers').setDescription('View all kit tiers of a player')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true).setAutocomplete(true)),

  new SlashCommandBuilder().setName('duelhistory').setDescription('View recent duels of a player')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true).setAutocomplete(true)),

  new SlashCommandBuilder().setName('search').setDescription('Search MTCTiers player rankings')
    .addStringOption(o => o.setName('query').setDescription('Username substring search').setRequired(true).setAutocomplete(true)),

  new SlashCommandBuilder().setName('kits').setDescription('List all official MTCTiers PvP kit categories & point rules'),

  new SlashCommandBuilder().setName('randomplayer').setDescription('Display a random MTCTiers player card profile'),

  new SlashCommandBuilder().setName('linkemail').setDescription('Self-service link your Google email to your MTCTiers profile for web login')
    .addStringOption(o => o.setName('email').setDescription('Your Google account email address').setRequired(true))
];

async function handlePlayerCommand(interaction) {
  await interaction.deferReply();

  const { commandName, options } = interaction;
  const rankings = await db.getFullRankings();
  const duels = db.loadLocalDuels();

  const errorEmbed = (desc) => new EmbedBuilder()
    .setAuthor({ name: 'MTCTiers Official', iconURL: LOGO_URL })
    .setThumbnail(LOGO_URL)
    .setTitle('❌ Player Not Found')
    .setDescription(desc)
    .setColor(0xef4444)
    .setFooter({ text: 'MTCTiers Official • mtctiers.com', iconURL: LOGO_URL })
    .setTimestamp();

  try {
    if (commandName === 'info' || commandName === 'randomplayer') {
      let player = '';
      if (commandName === 'randomplayer') {
        const pList = rankings.Players || [];
        if (!pList.length) return interaction.editReply({ embeds: [errorEmbed('No players found on leaderboard.')] });
        const randObj = pList[Math.floor(Math.random() * pList.length)];
        player = typeof randObj === 'object' ? randObj.name : randObj;
      } else {
        player = options.getString('player').trim();
      }

      const sortedOverall = Object.entries(rankings.Overall || {}).sort((a, b) => b[1] - a[1]);
      const rankIdx = sortedOverall.findIndex(([p]) => p.toLowerCase() === player.toLowerCase());

      if (rankIdx === -1 && commandName !== 'randomplayer') {
        return interaction.editReply({ embeds: [errorEmbed(`Could not find player **${player}** on MTCTiers.`)] });
      }

      const matchedName = rankIdx !== -1 ? sortedOverall[rankIdx][0] : player;
      const pts = rankings.Overall[matchedName] || 0;
      const rankNum = rankIdx !== -1 ? rankIdx + 1 : 'UNRANKED';

      const tInfo = db.getPlayerTitle(pts, typeof rankNum === 'number' ? rankNum : 999);
      const pDetail = (rankings.Players || []).find(p => (typeof p === 'object' ? p.name : p).toLowerCase() === matchedName.toLowerCase()) || {};
      const skinUrl = pDetail.skinUrl || `${MAIN_SITE}/assets/players/${matchedName.toLowerCase()}.png`;

      const kitTiers = [];
      for (const k in rankings) {
        if (['Overall', 'Players', 'HallOfFame', 'Testers', 'all_data', 'main', 'players_meta', 'queue_state'].includes(k)) continue;
        const kitObj = (rankings[k] && rankings[k].tiers && typeof rankings[k].tiers === 'object') ? rankings[k].tiers : rankings[k];
        if (!kitObj || typeof kitObj !== 'object') continue;

        for (const t in kitObj) {
          if (Array.isArray(kitObj[t])) {
            const hasPlayer = kitObj[t].some(p => (typeof p === 'object' ? p.name : p).toLowerCase() === matchedName.toLowerCase());
            if (hasPlayer) {
              kitTiers.push(`• **${k}**: \`${t}\``);
            }
          }
        }
      }

      const embed = new EmbedBuilder()
        .setAuthor({ name: 'MTCTiers Official Player Profile', iconURL: LOGO_URL })
        .setTitle(`🎮 ${matchedName}`)
        .setThumbnail(skinUrl)
        .setColor(tInfo.color)
        .addFields(
          { name: '🏆 Global Rank', value: `#**${rankNum}** OVERALL`, inline: true },
          { name: '⭐ Total Points', value: `**${pts} PTS**`, inline: true },
          { name: '👑 Title Badge', value: `${tInfo.icon} **${tInfo.title}**`, inline: true },
          { name: '🌐 Region', value: pDetail.region || 'EU', inline: true },
          { name: '📱 Device', value: pDetail.device || 'MK', inline: true },
          { name: '⚔️ Rival', value: pDetail.rival || 'None', inline: true },
          { name: '💬 Discord', value: pDetail.discord || 'Not set', inline: true },
          { name: '▶️ YouTube', value: pDetail.youtube || 'Not set', inline: true },
          { name: '🥊 Tierlist Placements', value: kitTiers.length ? kitTiers.join('\n') : '*No kit tiers assigned yet.*', inline: false }
        )
        .setFooter({ text: 'MTCTiers Official • mtctiers.com', iconURL: LOGO_URL })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === 'skin') {
      const player = options.getString('player').trim();
      const pDetail = (rankings.Players || []).find(p => (typeof p === 'object' ? p.name : p).toLowerCase() === player.toLowerCase()) || {};
      const skinUrl = pDetail.skinUrl || `${MAIN_SITE}/assets/players/${player.toLowerCase()}.png`;

      const embed = new EmbedBuilder()
        .setAuthor({ name: 'MTCTiers Skin Gallery', iconURL: LOGO_URL })
        .setTitle(`🎨 ${player}`)
        .setImage(skinUrl)
        .setThumbnail(LOGO_URL)
        .setColor(0x00eeff)
        .setFooter({ text: 'MTCTiers Official • mtctiers.com', iconURL: LOGO_URL })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === 'tiers') {
      const player = options.getString('player').trim();
      const activeTiers = [];
      const retiredTiers = [];

      for (const k in rankings) {
        if (['Overall', 'Players', 'HallOfFame', 'Testers', 'all_data', 'main', 'players_meta', 'queue_state'].includes(k)) continue;
        const kitObj = (rankings[k] && rankings[k].tiers && typeof rankings[k].tiers === 'object') ? rankings[k].tiers : rankings[k];
        if (!kitObj || typeof kitObj !== 'object') continue;

        for (const t in kitObj) {
          if (Array.isArray(kitObj[t])) {
            const hasPlayer = kitObj[t].some(p => (typeof p === 'object' ? p.name : p).toLowerCase() === player.toLowerCase());
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
        .setAuthor({ name: 'MTCTiers Official Tierlist', iconURL: LOGO_URL })
        .setThumbnail(LOGO_URL)
        .setTitle(`⚔️ Kit Tiers: ${player}`)
        .setColor(0x00eeff)
        .addFields(
          { name: '🔥 Active Tiers', value: activeTiers.length ? activeTiers.join('\n') : '*None*', inline: false },
          { name: '📜 Retired Tiers', value: retiredTiers.length ? retiredTiers.join('\n') : '*None*', inline: false }
        )
        .setFooter({ text: 'MTCTiers Official • mtctiers.com', iconURL: LOGO_URL })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === 'duelhistory') {
      const player = options.getString('player').trim();
      const dData = duels[player] || [];
      const dList = Array.isArray(dData) ? dData : dData.duels || [];

      if (!dList.length) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setAuthor({ name: 'MTCTiers Duel Records', iconURL: LOGO_URL }).setThumbnail(LOGO_URL).setTitle(`⚔️ Duel History: ${player}`).setDescription('*No recorded duels found.*').setColor(0x00eeff).setFooter({ text: 'MTCTiers Official • mtctiers.com', iconURL: LOGO_URL })] });
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
        .setAuthor({ name: 'MTCTiers Duel Records', iconURL: LOGO_URL })
        .setThumbnail(LOGO_URL)
        .setTitle(`⚔️ Duel History: ${player}`)
        .setDescription(`**Record:** ${wins}W / ${losses}L\n\n` + historyLines.join('\n'))
        .setColor(0x00eeff)
        .setFooter({ text: 'MTCTiers Official • mtctiers.com', iconURL: LOGO_URL })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === 'search') {
      const query = options.getString('query').trim().toLowerCase();
      const pList = rankings.Players || [];
      const matches = pList.filter(p => {
        const name = typeof p === 'object' ? p.name : p;
        return name.toLowerCase().includes(query);
      });

      if (!matches.length) {
        return interaction.editReply({ embeds: [errorEmbed(`No players matching "**${query}**".`)] });
      }

      const matchLines = matches.slice(0, 15).map(p => {
        const name = typeof p === 'object' ? p.name : p;
        const pts = rankings.Overall[name] || 0;
        return `• **${name}** — ${pts} PTS`;
      });

      const embed = new EmbedBuilder()
        .setAuthor({ name: 'MTCTiers Leaderboard Search', iconURL: LOGO_URL })
        .setThumbnail(LOGO_URL)
        .setTitle(`🔍 Search Results for "${query}"`)
        .setDescription(matchLines.join('\n'))
        .setColor(0x00eeff)
        .setFooter({ text: 'MTCTiers Official • mtctiers.com', iconURL: LOGO_URL })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

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
        .setAuthor({ name: 'MTCTiers PvP Kit Guide', iconURL: LOGO_URL })
        .setThumbnail(LOGO_URL)
        .setTitle('⚔️ OFFICIAL MTC TIERS PVP KITS')
        .setDescription(kitsList.join('\n\n') + '\n\n**Point Breakdown per Tier:**\n• **HT1**: 65 PTS | **LT1**: 45 PTS\n• **HT2**: 30 PTS | **LT2**: 20 PTS\n• **HT3**: 10 PTS | **LT3**: 5 PTS')
        .setColor(0x00eeff)
        .setFooter({ text: 'MTCTiers Official • mtctiers.com', iconURL: LOGO_URL })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === 'linkemail') {
      const inputEmail = options.getString('email').trim().toLowerCase();

      if (!inputEmail || !inputEmail.includes('@') || !inputEmail.includes('.')) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setAuthor({ name: 'MTCTiers Authentication', iconURL: LOGO_URL })
              .setTitle('❌ Invalid Email Format')
              .setDescription('Please enter a valid Google email address (e.g. `yourname@gmail.com`).')
              .setColor(0xef4444)
              .setTimestamp()
          ]
        });
      }

      const discordUser = interaction.user;
      const username = (discordUser.username || '').toLowerCase().trim();
      const userId = discordUser.id;
      const userTag = (discordUser.tag || '').toLowerCase().trim();

      const players = rankings.Players || [];
      const matchedPlayer = players.find(p => {
        if (typeof p !== 'object' || !p.discord) return false;
        const dStr = p.discord.toString().toLowerCase().trim();
        return dStr === username || dStr === userId || dStr === userTag || dStr.includes(username);
      });

      if (!matchedPlayer) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setAuthor({ name: 'MTCTiers Authentication', iconURL: LOGO_URL })
              .setTitle('❌ Discord Not Linked')
              .setDescription(`Your Discord account (**@${discordUser.username}**) is not linked to an MTCTiers profile.\n\nAsk an Admin to set your Discord username on MTCTiers first using \`/setdiscord player:<username> discord:@${discordUser.username}\`.`)
              .setColor(0xef4444)
              .setFooter({ text: 'MTCTiers Security System • mtctiers.com', iconURL: LOGO_URL })
              .setTimestamp()
          ]
        });
      }

      const crypto = require('crypto');
      const emailHash = crypto.createHash('sha256').update(inputEmail).digest('hex');

      let whitelistEntries = [];
      try {
        const doc = await db.getDoc('rankings', 'whitelist');
        if (doc && doc.entries) {
          whitelistEntries = JSON.parse(doc.entries);
        }
      } catch (e) {}

      let pName = matchedPlayer.name;
      let existingIndex = whitelistEntries.findIndex(e => e.hash === emailHash || (e.assignedPlayer && e.assignedPlayer.toLowerCase() === pName.toLowerCase()));

      const isExistingAdmin = existingIndex !== -1 && whitelistEntries[existingIndex].role === 'admin';

      const updatedEntry = {
        label: `${pName} (Player)`,
        hash: emailHash,
        role: isExistingAdmin ? 'admin' : 'player',
        assignedPlayer: pName
      };

      if (existingIndex !== -1) {
        whitelistEntries[existingIndex] = updatedEntry;
      } else {
        whitelistEntries.push(updatedEntry);
      }

      const hashes = whitelistEntries.map(e => e.hash);
      await db.patchDoc('rankings', 'whitelist', {
        hashes,
        entries: JSON.stringify(whitelistEntries)
      });

      const successEmbed = new EmbedBuilder()
        .setAuthor({ name: 'MTCTiers Security System', iconURL: LOGO_URL })
        .setTitle('✅ Google Email Linked Successfully!')
        .setDescription(`Successfully linked Google Email to **${pName}**!\n\n• **Assigned Profile**: \`${pName}\`\n• **Email Hash**: \`${emailHash.slice(0, 12)}...${emailHash.slice(-4)}\`\n• **Role**: \`${updatedEntry.role.toUpperCase()}\`\n\nYou can now log into **mtctiers.com** with Google Auth using \`${inputEmail}\` to edit your profile background, PFP, and description.`)
        .setColor(0x10b981)
        .setFooter({ text: 'MTCTiers Security • mtctiers.com', iconURL: LOGO_URL })
        .setTimestamp();

      return interaction.editReply({ embeds: [successEmbed] });
    }

  } catch (err) {
    console.error('Error handling player command:', err);
    return interaction.editReply({ embeds: [errorEmbed(err.message)] });
  }
}

module.exports = {
  playerCommands,
  handlePlayerCommand
};
