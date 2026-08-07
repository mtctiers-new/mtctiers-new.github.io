const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../firebase');
const config = require('../config');
const { buildTestResultEmbed, TARGET_RESULTS_CHANNEL } = require('../manual_results');

function isAdmin(interaction) {
  if (!interaction) return false;
  const user = interaction.user;
  const member = interaction.member;

  if (user && interaction.guild && interaction.guild.ownerId === user.id) return true;

  if (member && member.permissions) {
    if (member.permissions.has(PermissionFlagsBits.Administrator) || member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
    if (config.adminRoleIds && config.adminRoleIds.length > 0) {
      if (member.roles && config.adminRoleIds.some(roleId => member.roles.cache && member.roles.cache.has(roleId))) return true;
    }
  }

  const knownAdminIds = ['1073335999981162506', '1303536570095108146'];
  if (user && knownAdminIds.includes(user.id)) return true;

  return false;
}

const adminCommands = [
  new SlashCommandBuilder().setName('addplayer').setDescription('[Admin] Add a new player to MTCTiers')
    .addStringOption(o => o.setName('username').setDescription('Player MultiCraft username').setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName('region').setDescription('Region (NA, EU, SA, AS, OC, AF)').setRequired(false))
    .addStringOption(o => o.setName('device').setDescription('Device (MK, MB, CT, TP)').setRequired(false)),

  new SlashCommandBuilder().setName('removeplayer').setDescription('[Admin] Remove a player from MTCTiers')
    .addStringOption(o => o.setName('username').setDescription('Player username').setRequired(true).setAutocomplete(true)),

  new SlashCommandBuilder().setName('addskin').setDescription('[Admin] Set a player skin image')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true).setAutocomplete(true))
    .addAttachmentOption(o => o.setName('image').setDescription('Skin image file').setRequired(false))
    .addStringOption(o => o.setName('image_url').setDescription('Skin image URL').setRequired(false)),

  new SlashCommandBuilder().setName('removeskin').setDescription('[Admin] Remove a custom skin from a player')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true).setAutocomplete(true)),

  new SlashCommandBuilder().setName('changeskin').setDescription('[Admin] Change a player skin image')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true).setAutocomplete(true))
    .addAttachmentOption(o => o.setName('image').setDescription('New skin image file').setRequired(false))
    .addStringOption(o => o.setName('image_url').setDescription('New skin image URL').setRequired(false)),

  new SlashCommandBuilder().setName('addtester').setDescription('[Admin] Add a player as an official MTCTiers Tier Tester')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName('discord').setDescription('Discord username or tag').setRequired(true)),

  new SlashCommandBuilder().setName('removetester').setDescription('[Admin] Remove a player from the Tier Testers team')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true).setAutocomplete(true)),

  new SlashCommandBuilder().setName('addhof').setDescription('[Admin] Add a player to the Hall of Fame')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName('bio').setDescription('Hall of Fame bio').setRequired(true)),

  new SlashCommandBuilder().setName('edithof').setDescription('[Admin] Edit a Hall of Fame player bio')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName('bio').setDescription('New bio').setRequired(true)),

  new SlashCommandBuilder().setName('removehof').setDescription('[Admin] Remove a player from the Hall of Fame')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true).setAutocomplete(true)),

  new SlashCommandBuilder().setName('addkit').setDescription('[Admin] Add a new kit category')
    .addStringOption(o => o.setName('kit_key').setDescription('Kit key').setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName('name').setDescription('Full display name').setRequired(true))
    .addStringOption(o => o.setName('image_url').setDescription('Icon image URL').setRequired(false)),

  new SlashCommandBuilder().setName('removekit').setDescription('[Admin] Remove a kit category')
    .addStringOption(o => o.setName('kit_key').setDescription('Kit key').setRequired(true).setAutocomplete(true)),

  new SlashCommandBuilder().setName('setdevice').setDescription('[Admin] Set a player preferred device')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName('device').setDescription('Device type').setRequired(true)
      .addChoices(
        { name: 'Mouse & Keyboard (MK)', value: 'MK' },
        { name: 'Mobile (MB)', value: 'MB' },
        { name: 'Controller (CT)', value: 'CT' },
        { name: 'Trackpad (TP)', value: 'TP' }
      )),

  new SlashCommandBuilder().setName('setregion').setDescription('[Admin] Set a player region')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName('region').setDescription('Region').setRequired(true)
      .addChoices(
        { name: 'North America (NA)', value: 'NA' },
        { name: 'Europe (EU)', value: 'EU' },
        { name: 'South America (SA)', value: 'SA' },
        { name: 'Asia (AS)', value: 'AS' },
        { name: 'Oceania (OC)', value: 'OC' },
        { name: 'Africa (AF)', value: 'AF' }
      )),

  new SlashCommandBuilder().setName('settier').setDescription('[Admin] Set a player tier in a kit')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName('kit').setDescription('Kit').setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName('tier').setDescription('Tier').setRequired(true)
      .addChoices(
        { name: 'HT1 (50 pts)', value: 'HT1' },
        { name: 'LT1 (40 pts)', value: 'LT1' },
        { name: 'HT2 (30 pts)', value: 'HT2' },
        { name: 'LT2 (20 pts)', value: 'LT2' },
        { name: 'HT3 (12 pts)', value: 'HT3' },
        { name: 'LT3 (8 pts)', value: 'LT3' },
        { name: 'HT4 (5 pts)', value: 'HT4' },
        { name: 'LT4 (3 pts)', value: 'LT4' },
        { name: 'HT5 (2 pts)', value: 'HT5' },
        { name: 'LT5 (1 pt)', value: 'LT5' },
        { name: 'Retired HT1', value: 'RHT1' },
        { name: 'Retired LT1', value: 'RLT1' },
        { name: 'Retired HT2', value: 'RHT2' },
        { name: 'Retired LT2', value: 'RLT2' },
        { name: 'Retired HT3', value: 'RHT3' },
        { name: 'Retired LT3', value: 'RLT3' },
        { name: 'Retired HT4', value: 'RHT4' },
        { name: 'Retired LT4', value: 'RLT4' },
        { name: 'Retired HT5', value: 'RHT5' },
        { name: 'Retired LT5', value: 'RLT5' }
      )),

  new SlashCommandBuilder().setName('removetier').setDescription('[Admin] Remove a player tier from a kit')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName('kit').setDescription('Kit name').setRequired(true).setAutocomplete(true)),

  new SlashCommandBuilder().setName('setdiscord').setDescription('[Admin] Set a player Discord handle')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName('discord').setDescription('Discord username/tag').setRequired(true)),

  new SlashCommandBuilder().setName('setyoutube').setDescription('[Admin] Set a player YouTube link')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName('youtube').setDescription('YouTube channel link').setRequired(true)),

  new SlashCommandBuilder().setName('resetplayertiers').setDescription('[Admin] Reset all tiers for a player')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true).setAutocomplete(true)),

  new SlashCommandBuilder().setName('renameplayer').setDescription('[Admin] Rename a player across all rankings & duels')
    .addStringOption(o => o.setName('old_username').setDescription('Current username').setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName('new_username').setDescription('New username').setRequired(true).setAutocomplete(true)),

  new SlashCommandBuilder().setName('announceduel').setDescription('[Admin] Record a duel result and post announcement embed')
    .addStringOption(o => o.setName('player1').setDescription('Player 1 username').setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName('player2').setDescription('Player 2 username').setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName('kit').setDescription('Kit played').setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName('winner').setDescription('Winning player username').setRequired(true).setAutocomplete(true))
    .addIntegerOption(o => o.setName('player1_score').setDescription('Player 1 score').setRequired(true))
    .addIntegerOption(o => o.setName('player2_score').setDescription('Player 2 score').setRequired(true))
    .addStringOption(o => o.setName('outcome').setDescription('Outcome (e.g. Promoted, Tier Test)').setRequired(true))
    .addStringOption(o => o.setName('new_tier').setDescription('Update winner/tested player tier automatically (e.g. HT1, LT2, HT4)').setRequired(false))
    .addStringOption(o => o.setName('previous_rank').setDescription('Previous Rank (e.g. Low Tier 4)').setRequired(false))
    .addStringOption(o => o.setName('region').setDescription('Region (NA, EU, AS, SA)').setRequired(false))
    .addAttachmentOption(o => o.setName('proof_image').setDescription('Proof screenshot/image').setRequired(false)),

  new SlashCommandBuilder().setName('removeduel').setDescription('[Admin] Remove a broken or glitched duel from a player history')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true).setAutocomplete(true))
    .addIntegerOption(o => o.setName('duel_number').setDescription('Duel number in history (1 = most recent)').setRequired(true)),

  new SlashCommandBuilder().setName('editduel').setDescription('[Admin] Edit a broken or glitched duel in a player history')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true).setAutocomplete(true))
    .addIntegerOption(o => o.setName('duel_number').setDescription('Duel number in history (1 = most recent)').setRequired(true))
    .addIntegerOption(o => o.setName('player1_score').setDescription('New player 1 score').setRequired(false))
    .addIntegerOption(o => o.setName('player2_score').setDescription('New player 2 score').setRequired(false))
    .addStringOption(o => o.setName('outcome').setDescription('New outcome text').setRequired(false))
    .addStringOption(o => o.setName('tier').setDescription('New target tier').setRequired(false))
];

async function handleAdminCommand(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: '❌ **Permission Denied**: Only MTCTiers Admins can use this command.', ephemeral: true });
  }

  await interaction.deferReply();

  const { commandName, options } = interaction;
  const rankings = await db.getFullRankings();
  const duels = db.loadLocalDuels();

  const successEmbed = (title, desc) => new EmbedBuilder().setTitle(title).setDescription(desc).setColor(0x00eeff).setTimestamp();
  const errorEmbed = (desc) => new EmbedBuilder().setTitle('❌ Error').setDescription(desc).setColor(0xef4444).setTimestamp();

  try {
    if (commandName === 'addplayer') {
      const username = options.getString('username').trim();
      const region = (options.getString('region') || 'EU').toUpperCase();
      const device = (options.getString('device') || 'MK').toUpperCase();

      let pIdx = rankings.Players.findIndex(p => (typeof p === 'object' ? p.name : p).toLowerCase() === username.toLowerCase());
      if (pIdx === -1) {
        rankings.Players.push({ name: username, region, device, description: '', rival: 'None', lfm: false });
      } else if (typeof rankings.Players[pIdx] === 'object') {
        rankings.Players[pIdx].region = region;
        rankings.Players[pIdx].device = device;
      }
      db.recomputeOverallPoints(rankings);
      db.saveLocalRankings(rankings);
      await db.patchDoc('rankings', 'players_meta', { players: rankings.Players || [] });

      return interaction.editReply({ embeds: [successEmbed('✅ Player Added', `Successfully added **${username}** (Region: **${region}**, Device: **${device}**) to MTCTiers!`)] });
    }

    if (commandName === 'removeplayer') {
      const username = options.getString('username').trim();
      rankings.Players = rankings.Players.filter(p => (typeof p === 'object' ? p.name : p).toLowerCase() !== username.toLowerCase());
      delete rankings.Overall[username];

      for (const kit in rankings) {
        if (kit === 'Overall' || kit === 'Players') continue;
        for (const tier in rankings[kit]) {
          if (Array.isArray(rankings[kit][tier])) {
            rankings[kit][tier] = rankings[kit][tier].filter(p => (typeof p === 'object' ? p.name : p || '').toString().toLowerCase() !== username.toLowerCase());
          }
        }
      }
      db.recomputeOverallPoints(rankings);
      db.saveLocalRankings(rankings);
      await db.patchDoc('rankings', 'players_meta', { players: rankings.Players || [] });

      return interaction.editReply({ embeds: [successEmbed('🗑️ Player Removed', `Successfully removed **${username}** from MTCTiers.`)] });
    }

    if (commandName === 'addskin' || commandName === 'changeskin') {
      const player = options.getString('player').trim();
      const imgAttachment = options.getAttachment('image');
      const imgUrlOption = options.getString('image_url');
      const rawUrl = imgAttachment ? imgAttachment.url : imgUrlOption;

      if (!rawUrl) {
        return interaction.editReply({ embeds: [errorEmbed('Please attach an image file or provide an `image_url`.')] });
      }

      const { uploadToCatbox } = require('../catbox');
      const skinUrl = await uploadToCatbox(rawUrl);

      let pIdx = rankings.Players.findIndex(p => (typeof p === 'object' ? p.name : p).toLowerCase() === player.toLowerCase());
      if (pIdx !== -1) {
        let existing = rankings.Players[pIdx];
        if (typeof existing === 'string') {
          rankings.Players[pIdx] = { name: existing, skinUrl: skinUrl, region: 'EU', device: 'MK' };
        } else if (typeof existing === 'object') {
          existing.skinUrl = skinUrl;
        }
      } else {
        rankings.Players.push({ name: player, skinUrl: skinUrl, region: 'EU', device: 'MK' });
      }
      db.saveLocalRankings(rankings);
      await db.patchDoc('rankings', 'players_meta', { players: rankings.Players || [] });

      return interaction.editReply({ embeds: [successEmbed('🎨 Skin Updated (Permanent Link)', `Successfully updated skin for **${player}**!\n🔗 **Permanent Image URL:** ${skinUrl}`).setImage(skinUrl)] });
    }

    if (commandName === 'removeskin') {
      const player = options.getString('player').trim();
      let pIdx = rankings.Players.findIndex(p => (typeof p === 'object' ? p.name : p).toLowerCase() === player.toLowerCase());
      if (pIdx !== -1 && typeof rankings.Players[pIdx] === 'object') {
        delete rankings.Players[pIdx].skinUrl;
      }
      db.saveLocalRankings(rankings);
      await db.patchDoc('rankings', 'players_meta', { players: rankings.Players || [] });

      return interaction.editReply({ embeds: [successEmbed('🧹 Skin Reset', `Reset skin for **${player}** to default.`)] });
    }

    if (commandName === 'addtester') {
      const player = options.getString('player').trim();
      const discord = options.getString('discord').trim();

      rankings.Testers = rankings.Testers || [];
      rankings.Testers = rankings.Testers.filter(t => t.name.toLowerCase() !== player.toLowerCase());
      rankings.Testers.push({ name: player, discord });

      db.saveLocalRankings(rankings);
      await db.patchDoc('rankings', 'main', { Testers: rankings.Testers });

      return interaction.editReply({ embeds: [successEmbed('⚔️ Tester Added', `Added **${player}** (${discord}) as an official MTCTiers Tier Tester!`)] });
    }

    if (commandName === 'removetester') {
      const player = options.getString('player').trim();
      if (rankings.Testers) {
        rankings.Testers = rankings.Testers.filter(t => t.name.toLowerCase() !== player.toLowerCase());
      }
      db.saveLocalRankings(rankings);
      await db.patchDoc('rankings', 'main', { Testers: rankings.Testers });

      return interaction.editReply({ embeds: [successEmbed('🗑️ Tester Removed', `Removed **${player}** from the Tier Testers team.`)] });
    }

    if (commandName === 'addhof' || commandName === 'edithof') {
      const player = options.getString('player').trim();
      const bio = options.getString('bio').trim();

      rankings.HallOfFame = rankings.HallOfFame || [];
      const existing = rankings.HallOfFame.find(h => h.name.toLowerCase() === player.toLowerCase());
      if (existing) {
        existing.bio = bio;
      } else {
        rankings.HallOfFame.push({ name: player, bio });
      }
      db.saveLocalRankings(rankings);
      await db.patchDoc('rankings', 'main', { HallOfFame: rankings.HallOfFame });

      return interaction.editReply({ embeds: [successEmbed('👑 Hall of Fame Updated', `Updated Hall of Fame entry for **${player}**:\n*${bio}*`)] });
    }

    if (commandName === 'removehof') {
      const player = options.getString('player').trim();
      if (rankings.HallOfFame) {
        rankings.HallOfFame = rankings.HallOfFame.filter(h => h.name.toLowerCase() !== player.toLowerCase());
      }
      db.saveLocalRankings(rankings);
      await db.patchDoc('rankings', 'main', { HallOfFame: rankings.HallOfFame });

      return interaction.editReply({ embeds: [successEmbed('🗑️ HOF Removed', `Removed **${player}** from Hall of Fame.`)] });
    }

    if (commandName === 'setdevice') {
      const player = options.getString('player').trim();
      const device = options.getString('device');

      let pIdx = rankings.Players.findIndex(p => (typeof p === 'object' ? p.name : p).toLowerCase() === player.toLowerCase());
      if (pIdx !== -1 && typeof rankings.Players[pIdx] === 'object') {
        rankings.Players[pIdx].device = device;
      } else {
        rankings.Players.push({ name: player, device, region: 'EU' });
      }
      db.saveLocalRankings(rankings);
      await db.patchDoc('rankings', 'players_meta', { players: rankings.Players || [] });

      return interaction.editReply({ embeds: [successEmbed('📱 Device Updated', `Set device for **${player}** to **${device}**.`)] });
    }

    if (commandName === 'setregion') {
      const player = options.getString('player').trim();
      const region = options.getString('region');

      let pIdx = rankings.Players.findIndex(p => (typeof p === 'object' ? p.name : p).toLowerCase() === player.toLowerCase());
      if (pIdx !== -1 && typeof rankings.Players[pIdx] === 'object') {
        rankings.Players[pIdx].region = region;
      } else {
        rankings.Players.push({ name: player, region, device: 'MK' });
      }
      db.saveLocalRankings(rankings);
      await db.patchDoc('rankings', 'players_meta', { players: rankings.Players || [] });

      return interaction.editReply({ embeds: [successEmbed('🌐 Region Updated', `Set region for **${player}** to **${region}**.`)] });
    }

    if (commandName === 'settier') {
      const player = options.getString('player').trim();
      const kit = options.getString('kit').trim();
      const tier = options.getString('tier').trim();

      if (!rankings[kit]) rankings[kit] = {};

      for (const t in rankings[kit]) {
        if (Array.isArray(rankings[kit][t])) {
          rankings[kit][t] = rankings[kit][t].filter(p => (typeof p === 'object' ? p.name : p || '').toString().toLowerCase() !== player.toLowerCase());
        }
      }

      if (!rankings[kit][tier]) rankings[kit][tier] = [];
      rankings[kit][tier].push(player);

      db.recomputeOverallPoints(rankings);
      db.saveLocalRankings(rankings);
      await db.patchDoc('rankings', kit, rankings[kit]);
      await db.patchDoc('rankings', 'players_meta', { players: rankings.Players || [] });

      const pts = rankings.Overall[player] || 0;
      return interaction.editReply({ embeds: [successEmbed('⚔️ Tier Updated', `Set **${player}** in **${kit}** to **${tier}**!\nTotal Score: **${pts} PTS**`)] });
    }

    if (commandName === 'removetier') {
      const player = options.getString('player').trim();
      const kit = options.getString('kit').trim();

      if (rankings[kit]) {
        for (const t in rankings[kit]) {
          if (Array.isArray(rankings[kit][t])) {
            rankings[kit][t] = rankings[kit][t].filter(p => (typeof p === 'object' ? p.name : p || '').toString().toLowerCase() !== player.toLowerCase());
          }
        }
      }
      db.recomputeOverallPoints(rankings);
      db.saveLocalRankings(rankings);
      await db.patchDoc('rankings', kit, rankings[kit]);
      await db.patchDoc('rankings', 'players_meta', { players: rankings.Players || [] });

      return interaction.editReply({ embeds: [successEmbed('🗑️ Tier Removed', `Removed **${player}** tier for **${kit}**.`)] });
    }

    if (commandName === 'setdiscord') {
      const player = options.getString('player').trim();
      const discord = options.getString('discord').trim();

      let pIdx = rankings.Players.findIndex(p => (typeof p === 'object' ? p.name : p).toLowerCase() === player.toLowerCase());
      if (pIdx !== -1 && typeof rankings.Players[pIdx] === 'object') {
        rankings.Players[pIdx].discord = discord;
      }
      db.saveLocalRankings(rankings);
      await db.patchDoc('rankings', 'players_meta', { players: rankings.Players || [] });

      return interaction.editReply({ embeds: [successEmbed('💬 Discord Linked', `Linked Discord **${discord}** to **${player}**.`)] });
    }

    if (commandName === 'setyoutube') {
      const player = options.getString('player').trim();
      const youtube = options.getString('youtube').trim();

      let pIdx = rankings.Players.findIndex(p => (typeof p === 'object' ? p.name : p).toLowerCase() === player.toLowerCase());
      if (pIdx !== -1 && typeof rankings.Players[pIdx] === 'object') {
        rankings.Players[pIdx].youtube = youtube;
      }
      db.saveLocalRankings(rankings);
      await db.patchDoc('rankings', 'players_meta', { players: rankings.Players || [] });

      return interaction.editReply({ embeds: [successEmbed('▶️ YouTube Linked', `Linked YouTube **${youtube}** to **${player}**.`)] });
    }

    if (commandName === 'resetplayertiers') {
      const player = options.getString('player').trim();

      for (const kit in rankings) {
        if (kit === 'Overall' || kit === 'Players') continue;
        for (const tier in rankings[kit]) {
          if (Array.isArray(rankings[kit][tier])) {
            rankings[kit][tier] = rankings[kit][tier].filter(p => (typeof p === 'object' ? p.name : p || '').toString().toLowerCase() !== player.toLowerCase());
          }
        }
      }
      db.recomputeOverallPoints(rankings);
      db.saveLocalRankings(rankings);
      await db.patchDoc('rankings', 'players_meta', { players: rankings.Players || [] });

      return interaction.editReply({ embeds: [successEmbed('🔄 Tiers Reset', `Reset all kit tiers for **${player}**.`)] });
    }

    if (commandName === 'renameplayer') {
      const oldName = options.getString('old_username').trim();
      const newName = options.getString('new_username').trim();

      let pIdx = rankings.Players.findIndex(p => (typeof p === 'object' ? p.name : p).toLowerCase() === oldName.toLowerCase());
      if (pIdx !== -1 && typeof rankings.Players[pIdx] === 'object') {
        rankings.Players[pIdx].name = newName;
      }

      for (const kit in rankings) {
        if (kit === 'Overall' || kit === 'Players') continue;
        for (const tier in rankings[kit]) {
          if (Array.isArray(rankings[kit][tier])) {
            rankings[kit][tier] = rankings[kit][tier].map(p => ((typeof p === 'object' ? p.name : p || '').toString().toLowerCase() === oldName.toLowerCase() ? newName : p));
          }
        }
      }

      db.recomputeOverallPoints(rankings);
      db.saveLocalRankings(rankings);
      await db.patchDoc('rankings', 'players_meta', { players: rankings.Players || [] });

      return interaction.editReply({ embeds: [successEmbed('✏️ Player Renamed', `Renamed **${oldName}** ➔ **${newName}** across all kit rankings!`)] });
    }

    if (commandName === 'announceduel') {
      const p1 = options.getString('player1').trim();
      const p2 = options.getString('player2').trim();
      const kit = options.getString('kit').trim();
      const winner = options.getString('winner').trim();
      const s1 = options.getInteger('player1_score');
      const s2 = options.getInteger('player2_score');
      const outcome = (options.getString('outcome') || 'Tier Test').trim();
      const newTierOpt = options.getString('new_tier');
      const prevRank = options.getString('previous_rank') || 'Unranked';
      const region = (options.getString('region') || 'NA').toUpperCase();
      const imgAttachment = options.getAttachment('proof_image');
      let autoTierMsg = '';

      if (newTierOpt && newTierOpt.trim()) {
        const cleanTier = newTierOpt.trim();
        const targetPlayer = winner;

        if (!rankings[kit]) rankings[kit] = {};
        for (let t in rankings[kit]) {
          if (Array.isArray(rankings[kit][t])) {
            rankings[kit][t] = rankings[kit][t].filter(p => (typeof p === 'object' ? p.name : p || '').toString().toLowerCase() !== targetPlayer.toLowerCase());
          }
        }
        if (!rankings[kit][cleanTier]) rankings[kit][cleanTier] = [];
        if (!rankings[kit][cleanTier].includes(targetPlayer)) {
          rankings[kit][cleanTier].push(targetPlayer);
        }

        db.recomputeOverallPoints(rankings);
        db.saveLocalRankings(rankings);
        await db.patchDoc('rankings', kit, rankings[kit]);
        autoTierMsg = ` (Updated **${targetPlayer}** to **${cleanTier}** in ${kit})`;
      }

      // Record duel to Firestore duels collection
      try {
        const timestamp = Date.now();
        const isoDate = new Date().toISOString().split('T')[0];
        const recordP1 = { timestamp, date: isoDate, kit, outcome, player1: p1, player2: p2, player1_score: s1, player2_score: s2, winner, result: winner.toLowerCase() === p1.toLowerCase() ? 'Won' : 'Lost', tier: newTierOpt || '' };
        const recordP2 = { timestamp, date: isoDate, kit, outcome, player1: p1, player2: p2, player1_score: s1, player2_score: s2, winner, result: winner.toLowerCase() === p2.toLowerCase() ? 'Won' : 'Lost', tier: newTierOpt || '' };

        const p1Doc = (await db.getDoc('duels', p1)) || { player: p1, duels: [] };
        let p1List = Array.isArray(p1Doc.duels) ? p1Doc.duels : [];
        p1List.unshift(recordP1);
        await db.patchDoc('duels', p1, { player: p1, duels: p1List, count: p1List.length });

        const p2Doc = (await db.getDoc('duels', p2)) || { player: p2, duels: [] };
        let p2List = Array.isArray(p2Doc.duels) ? p2Doc.duels : [];
        p2List.unshift(recordP2);
        await db.patchDoc('duels', p2, { player: p2, duels: p2List, count: p2List.length });
      } catch (e) { console.warn('Firestore duel patch note:', e.message); }

      const resultEmbed = buildTestResultEmbed({
        player: winner,
        tester: interaction.user.id,
        region,
        prevRank,
        rankEarned: newTierOpt || outcome,
        kit,
        score: `${s1} - ${s2}`,
        proofUrl: imgAttachment ? imgAttachment.url : null
      });

      let targetChan = null;
      try {
        const chanId = TARGET_RESULTS_CHANNEL || config.announcementChannelId;
        targetChan = await interaction.client.channels.fetch(chanId).catch(() => null);
        if (targetChan) {
          await targetChan.send({ embeds: [resultEmbed] });
        }
      } catch (e) {
        console.warn('Failed to send announcement embed:', e.message);
      }

      const chanNote = targetChan ? ` & posted embed to <#${targetChan.id}>` : '';
      return interaction.editReply({ content: `✅ **Duel Recorded** for **${p1}** vs **${p2}** (${s1} - ${s2}) in **${kit}**${autoTierMsg}${chanNote}!` });
    }

    if (commandName === 'removeduel') {
      const player = options.getString('player').trim();
      const num = options.getInteger('duel_number');

      const doc = await db.getDoc('duels', player);
      if (!doc || !Array.isArray(doc.duels) || !doc.duels.length) {
        return interaction.editReply({ content: `⚠️ No duel history found for **${player}**.` });
      }

      if (num < 1 || num > doc.duels.length) {
        return interaction.editReply({ content: `⚠️ Invalid duel number. Total duels: **${doc.duels.length}**.` });
      }

      const removed = doc.duels.splice(num - 1, 1)[0];
      await db.patchDoc('duels', player, { player, duels: doc.duels, count: doc.duels.length });

      return interaction.editReply({ content: `🗑️ **Duel Removed**: Removed duel #${num} (${removed.kit} · ${removed.player1} vs ${removed.player2}) for **${player}**.` });
    }

    if (commandName === 'editduel') {
      const player = options.getString('player').trim();
      const num = options.getInteger('duel_number');
      const s1 = options.getInteger('player1_score');
      const s2 = options.getInteger('player2_score');
      const outcome = options.getString('outcome');
      const tier = options.getString('tier');

      const doc = await db.getDoc('duels', player);
      if (!doc || !Array.isArray(doc.duels) || !doc.duels.length) {
        return interaction.editReply({ content: `⚠️ No duel history found for **${player}**.` });
      }

      if (num < 1 || num > doc.duels.length) {
        return interaction.editReply({ content: `⚠️ Invalid duel number. Total duels: **${doc.duels.length}**.` });
      }

      const d = doc.duels[num - 1];
      if (s1 !== null) d.player1_score = s1;
      if (s2 !== null) d.player2_score = s2;
      if (outcome) d.outcome = outcome;
      if (tier) d.tier = tier;

      await db.patchDoc('duels', player, { player, duels: doc.duels, count: doc.duels.length });

      return interaction.editReply({ content: `✏️ **Duel Updated**: Updated duel #${num} for **${player}** (${d.kit} · Score: ${d.player1_score} - ${d.player2_score}).` });
    }

  } catch (err) {
    console.error('Error handling admin command:', err);
    return interaction.editReply({ embeds: [errorEmbed(err.message)] });
  }
}

module.exports = {
  adminCommands,
  handleAdminCommand
};
