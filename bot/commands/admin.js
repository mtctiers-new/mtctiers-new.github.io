const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../firebase');
const config = require('../config');

// Check if member is admin (has Administrator permission or any Whitelisted Admin Role)
function isAdmin(member) {
  if (!member) return false;
  if (member.permissions && member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (config.adminRoleIds && config.adminRoleIds.length > 0) {
    return config.adminRoleIds.some(roleId => member.roles && member.roles.cache.has(roleId));
  }
  return false;
}

// -------------------------------------------------------------
// SLASH COMMAND BUILDERS FOR ALL 21 ADMIN COMMANDS
// -------------------------------------------------------------

const adminCommands = [

  // 1. /addplayer
  new SlashCommandBuilder()
    .setName('addplayer')
    .setDescription('[Admin] Add a new player to MTCTiers')
    .addStringOption(o => o.setName('username').setDescription('Player Minecraft username').setRequired(true))
    .addStringOption(o => o.setName('region').setDescription('Region (NA, EU, SA, AS, OC, AF)').setRequired(false))
    .addStringOption(o => o.setName('device').setDescription('Device (MK, MB, CT, TP)').setRequired(false)),

  // 2. /removeplayer
  new SlashCommandBuilder()
    .setName('removeplayer')
    .setDescription('[Admin] Remove a player from MTCTiers')
    .addStringOption(o => o.setName('username').setDescription('Player username').setRequired(true)),

  // 3. /addskin
  new SlashCommandBuilder()
    .setName('addskin')
    .setDescription('[Admin] Set a player skin image')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true))
    .addAttachmentOption(o => o.setName('image').setDescription('Skin image file').setRequired(false))
    .addStringOption(o => o.setName('image_url').setDescription('Skin image URL (if not attaching file)').setRequired(false)),

  // 4. /removeskin
  new SlashCommandBuilder()
    .setName('removeskin')
    .setDescription('[Admin] Remove a custom skin from a player')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true)),

  // 5. /changeskin
  new SlashCommandBuilder()
    .setName('changeskin')
    .setDescription('[Admin] Change a player skin image')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true))
    .addAttachmentOption(o => o.setName('image').setDescription('New skin image file').setRequired(false))
    .addStringOption(o => o.setName('image_url').setDescription('New skin image URL').setRequired(false)),

  // 6. /addtester
  new SlashCommandBuilder()
    .setName('addtester')
    .setDescription('[Admin] Add a player as an official MTCTiers Tier Tester')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true))
    .addStringOption(o => o.setName('discord').setDescription('Discord username or tag').setRequired(true)),

  // 7. /removetester
  new SlashCommandBuilder()
    .setName('removetester')
    .setDescription('[Admin] Remove a player from the Tier Testers team')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true)),

  // 8. /addhof
  new SlashCommandBuilder()
    .setName('addhof')
    .setDescription('[Admin] Add a player to the Hall of Fame')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true))
    .addStringOption(o => o.setName('bio').setDescription('Hall of Fame bio / achievements').setRequired(true)),

  // 9. /edithof
  new SlashCommandBuilder()
    .setName('edithof')
    .setDescription('[Admin] Edit a Hall of Fame player bio')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true))
    .addStringOption(o => o.setName('bio').setDescription('New bio').setRequired(true)),

  // 10. /removehof
  new SlashCommandBuilder()
    .setName('removehof')
    .setDescription('[Admin] Remove a player from the Hall of Fame')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true)),

  // 11. /addkit
  new SlashCommandBuilder()
    .setName('addkit')
    .setDescription('[Admin] Add a new kit category')
    .addStringOption(o => o.setName('kit_key').setDescription('Kit key (e.g. Emerald)').setRequired(true))
    .addStringOption(o => o.setName('name').setDescription('Full display name').setRequired(true))
    .addStringOption(o => o.setName('image_url').setDescription('Icon image URL').setRequired(false)),

  // 12. /removekit
  new SlashCommandBuilder()
    .setName('removekit')
    .setDescription('[Admin] Remove a kit category')
    .addStringOption(o => o.setName('kit_key').setDescription('Kit key').setRequired(true)),

  // 13. /setdevice
  new SlashCommandBuilder()
    .setName('setdevice')
    .setDescription('[Admin] Set a player preferred device')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true))
    .addStringOption(o => o.setName('device').setDescription('Device type').setRequired(true)
      .addChoices(
        { name: 'Mouse & Keyboard (MK)', value: 'MK' },
        { name: 'Mobile (MB)', value: 'MB' },
        { name: 'Controller (CT)', value: 'CT' },
        { name: 'Trackpad (TP)', value: 'TP' }
      )),

  // 14. /setregion
  new SlashCommandBuilder()
    .setName('setregion')
    .setDescription('[Admin] Set a player region')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true))
    .addStringOption(o => o.setName('region').setDescription('Region').setRequired(true)
      .addChoices(
        { name: 'North America (NA)', value: 'NA' },
        { name: 'Europe (EU)', value: 'EU' },
        { name: 'South America (SA)', value: 'SA' },
        { name: 'Asia (AS)', value: 'AS' },
        { name: 'Oceania (OC)', value: 'OC' },
        { name: 'Africa (AF)', value: 'AF' }
      )),

  // 15. /settier
  new SlashCommandBuilder()
    .setName('settier')
    .setDescription('[Admin] Set a player tier in a kit')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true))
    .addStringOption(o => o.setName('kit').setDescription('Kit (e.g. Emerald, Manhunt, Void, etc.)').setRequired(true))
    .addStringOption(o => o.setName('tier').setDescription('Tier').setRequired(true)
      .addChoices(
        { name: 'HT1 (65 pts)', value: 'HT1' },
        { name: 'LT1 (45 pts)', value: 'LT1' },
        { name: 'HT2 (30 pts)', value: 'HT2' },
        { name: 'LT2 (20 pts)', value: 'LT2' },
        { name: 'HT3 (10 pts)', value: 'HT3' },
        { name: 'LT3 (5 pts)', value: 'LT3' },
        { name: 'Retired HT1', value: 'RHT1' },
        { name: 'Retired LT1', value: 'RLT1' },
        { name: 'Retired HT2', value: 'RHT2' },
        { name: 'Retired LT2', value: 'RLT2' },
        { name: 'Retired HT3', value: 'RHT3' },
        { name: 'Retired LT3', value: 'RLT3' }
      )),

  // 16. /removetier
  new SlashCommandBuilder()
    .setName('removetier')
    .setDescription('[Admin] Remove a player tier from a kit')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true))
    .addStringOption(o => o.setName('kit').setDescription('Kit name').setRequired(true)),

  // 17. /setdiscord
  new SlashCommandBuilder()
    .setName('setdiscord')
    .setDescription('[Admin] Set a player Discord handle')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true))
    .addStringOption(o => o.setName('discord').setDescription('Discord username/tag').setRequired(true)),

  // 18. /setyoutube
  new SlashCommandBuilder()
    .setName('setyoutube')
    .setDescription('[Admin] Set a player YouTube link')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true))
    .addStringOption(o => o.setName('youtube').setDescription('YouTube channel link').setRequired(true)),

  // 19. /resetplayertiers
  new SlashCommandBuilder()
    .setName('resetplayertiers')
    .setDescription('[Admin] Reset all tiers for a player')
    .addStringOption(o => o.setName('player').setDescription('Player username').setRequired(true)),

  // 20. /renameplayer
  new SlashCommandBuilder()
    .setName('renameplayer')
    .setDescription('[Admin] Rename a player across all rankings & duels')
    .addStringOption(o => o.setName('old_username').setDescription('Current username').setRequired(true))
    .addStringOption(o => o.setName('new_username').setDescription('New username').setRequired(true)),

  // 21. /announceduel
  new SlashCommandBuilder()
    .setName('announceduel')
    .setDescription('[Admin] Record a duel result and post announcement embed')
    .addStringOption(o => o.setName('player1').setDescription('Player 1 username').setRequired(true))
    .addStringOption(o => o.setName('player2').setDescription('Player 2 username').setRequired(true))
    .addStringOption(o => o.setName('kit').setDescription('Kit played').setRequired(true))
    .addStringOption(o => o.setName('winner').setDescription('Winning player username').setRequired(true))
    .addIntegerOption(o => o.setName('player1_score').setDescription('Player 1 score').setRequired(true))
    .addIntegerOption(o => o.setName('player2_score').setDescription('Player 2 score').setRequired(true))
    .addStringOption(o => o.setName('outcome').setDescription('Outcome (e.g. promoted, tier retained, demoted)').setRequired(true))
    .addAttachmentOption(o => o.setName('proof_image').setDescription('Proof screenshot/image').setRequired(false))
];

// -------------------------------------------------------------
// COMMAND HANDLER FUNCTION
// -------------------------------------------------------------

async function handleAdminCommand(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({ content: '❌ **Permission Denied**: Only MTCTiers Admins can use this command.', ephemeral: true });
  }

  const { commandName, options } = interaction;
  const rankings = db.loadLocalRankings();
  const duels = db.loadLocalDuels();

  // Helper embed
  const successEmbed = (title, desc) => new EmbedBuilder().setTitle(title).setDescription(desc).setColor(0x00eeff).setTimestamp();
  const errorEmbed = (desc) => new EmbedBuilder().setTitle('❌ Error').setDescription(desc).setColor(0xef4444).setTimestamp();

  try {

    // 1. /addplayer
    if (commandName === 'addplayer') {
      const username = options.getString('username').trim();
      const region = (options.getString('region') || 'EU').toUpperCase();
      const device = (options.getString('device') || 'MK').toUpperCase();

      let pObj = rankings.Players.find(p => (typeof p === 'object' ? p.name : p).toLowerCase() === username.toLowerCase());
      if (!pObj) {
        rankings.Players.push({ name: username, region, device, description: '', rival: 'None', lfm: false });
      } else if (typeof pObj === 'object') {
        pObj.region = region;
        pObj.device = device;
      }
      db.recomputeOverallPoints(rankings);
      db.saveLocalRankings(rankings);
      await db.patchDoc('rankings', 'all_data', rankings);

      return interaction.reply({ embeds: [successEmbed('✅ Player Added', `Successfully added **${username}** (Region: **${region}**, Device: **${device}**) to MTCTiers!`)] });
    }

    // 2. /removeplayer
    if (commandName === 'removeplayer') {
      const username = options.getString('username').trim();
      rankings.Players = rankings.Players.filter(p => (typeof p === 'object' ? p.name : p).toLowerCase() !== username.toLowerCase());
      delete rankings.Overall[username];

      for (const kit in rankings) {
        if (kit === 'Overall' || kit === 'Players') continue;
        for (const tier in rankings[kit]) {
          if (Array.isArray(rankings[kit][tier])) {
            rankings[kit][tier] = rankings[kit][tier].filter(p => p.toLowerCase() !== username.toLowerCase());
          }
        }
      }
      db.recomputeOverallPoints(rankings);
      db.saveLocalRankings(rankings);
      await db.patchDoc('rankings', 'all_data', rankings);

      return interaction.reply({ embeds: [successEmbed('🗑️ Player Removed', `Successfully removed **${username}** from MTCTiers.`)] });
    }

    // 3. /addskin or 5. /changeskin
    if (commandName === 'addskin' || commandName === 'changeskin') {
      const player = options.getString('player').trim();
      const imgAttachment = options.getAttachment('image');
      const imgUrlOption = options.getString('image_url');
      const skinUrl = imgAttachment ? imgAttachment.url : imgUrlOption;

      if (!skinUrl) {
        return interaction.reply({ embeds: [errorEmbed('Please attach an image file or provide an `image_url`.')] });
      }

      let pObj = rankings.Players.find(p => (typeof p === 'object' ? p.name : p).toLowerCase() === player.toLowerCase());
      if (typeof pObj === 'object') {
        pObj.skinUrl = skinUrl;
      } else if (!pObj) {
        rankings.Players.push({ name: player, skinUrl, region: 'EU', device: 'MK' });
      }
      db.saveLocalRankings(rankings);
      await db.patchDoc('rankings', 'all_data', rankings);

      return interaction.reply({ embeds: [successEmbed('🎨 Skin Updated', `Successfully updated skin for **${player}**!`).setImage(skinUrl)] });
    }

    // 4. /removeskin
    if (commandName === 'removeskin') {
      const player = options.getString('player').trim();
      let pObj = rankings.Players.find(p => (typeof p === 'object' ? p.name : p).toLowerCase() === player.toLowerCase());
      if (typeof pObj === 'object') {
        delete pObj.skinUrl;
      }
      db.saveLocalRankings(rankings);
      await db.patchDoc('rankings', 'all_data', rankings);

      return interaction.reply({ embeds: [successEmbed('🧹 Skin Reset', `Reset skin for **${player}** to default.`)] });
    }

    // 6. /addtester
    if (commandName === 'addtester') {
      const player = options.getString('player').trim();
      const discord = options.getString('discord').trim();

      rankings.Testers = rankings.Testers || [];
      rankings.Testers = rankings.Testers.filter(t => t.name.toLowerCase() !== player.toLowerCase());
      rankings.Testers.push({ name: player, discord });

      db.saveLocalRankings(rankings);
      await db.patchDoc('rankings', 'all_data', rankings);

      return interaction.reply({ embeds: [successEmbed('⚔️ Tester Added', `Added **${player}** (${discord}) as an official MTCTiers Tier Tester!`)] });
    }

    // 7. /removetester
    if (commandName === 'removetester') {
      const player = options.getString('player').trim();
      if (rankings.Testers) {
        rankings.Testers = rankings.Testers.filter(t => t.name.toLowerCase() !== player.toLowerCase());
      }
      db.saveLocalRankings(rankings);
      await db.patchDoc('rankings', 'all_data', rankings);

      return interaction.reply({ embeds: [successEmbed('🗑️ Tester Removed', `Removed **${player}** from the Tier Testers team.`)] });
    }

    // 8. /addhof or 9. /edithof
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
      await db.patchDoc('rankings', 'all_data', rankings);

      return interaction.reply({ embeds: [successEmbed('👑 Hall of Fame Updated', `Updated Hall of Fame entry for **${player}**:\n*${bio}*`)] });
    }

    // 10. /removehof
    if (commandName === 'removehof') {
      const player = options.getString('player').trim();
      if (rankings.HallOfFame) {
        rankings.HallOfFame = rankings.HallOfFame.filter(h => h.name.toLowerCase() !== player.toLowerCase());
      }
      db.saveLocalRankings(rankings);
      await db.patchDoc('rankings', 'all_data', rankings);

      return interaction.reply({ embeds: [successEmbed('🗑️ HOF Removed', `Removed **${player}** from Hall of Fame.`)] });
    }

    // 13. /setdevice
    if (commandName === 'setdevice') {
      const player = options.getString('player').trim();
      const device = options.getString('device');

      let pObj = rankings.Players.find(p => (typeof p === 'object' ? p.name : p).toLowerCase() === player.toLowerCase());
      if (typeof pObj === 'object') {
        pObj.device = device;
      } else {
        rankings.Players.push({ name: player, device, region: 'EU' });
      }
      db.saveLocalRankings(rankings);
      await db.patchDoc('rankings', 'all_data', rankings);

      return interaction.reply({ embeds: [successEmbed('📱 Device Updated', `Set device for **${player}** to **${device}**.`)] });
    }

    // 14. /setregion
    if (commandName === 'setregion') {
      const player = options.getString('player').trim();
      const region = options.getString('region');

      let pObj = rankings.Players.find(p => (typeof p === 'object' ? p.name : p).toLowerCase() === player.toLowerCase());
      if (typeof pObj === 'object') {
        pObj.region = region;
      } else {
        rankings.Players.push({ name: player, region, device: 'MK' });
      }
      db.saveLocalRankings(rankings);
      await db.patchDoc('rankings', 'all_data', rankings);

      return interaction.reply({ embeds: [successEmbed('🌐 Region Updated', `Set region for **${player}** to **${region}**.`)] });
    }

    // 15. /settier
    if (commandName === 'settier') {
      const player = options.getString('player').trim();
      const kit = options.getString('kit').trim();
      const tier = options.getString('tier').trim();

      if (!rankings[kit]) rankings[kit] = {};

      // Remove player from existing tiers in this kit first
      for (const t in rankings[kit]) {
        if (Array.isArray(rankings[kit][t])) {
          rankings[kit][t] = rankings[kit][t].filter(p => p.toLowerCase() !== player.toLowerCase());
        }
      }

      if (!rankings[kit][tier]) rankings[kit][tier] = [];
      rankings[kit][tier].push(player);

      db.recomputeOverallPoints(rankings);
      db.saveLocalRankings(rankings);
      await db.patchDoc('rankings', 'all_data', rankings);

      const pts = rankings.Overall[player] || 0;
      return interaction.reply({ embeds: [successEmbed('⚔️ Tier Updated', `Set **${player}** in **${kit}** to **${tier}**!\nTotal Score: **${pts} PTS**`)] });
    }

    // 16. /removetier
    if (commandName === 'removetier') {
      const player = options.getString('player').trim();
      const kit = options.getString('kit').trim();

      if (rankings[kit]) {
        for (const t in rankings[kit]) {
          if (Array.isArray(rankings[kit][t])) {
            rankings[kit][t] = rankings[kit][t].filter(p => p.toLowerCase() !== player.toLowerCase());
          }
        }
      }
      db.recomputeOverallPoints(rankings);
      db.saveLocalRankings(rankings);
      await db.patchDoc('rankings', 'all_data', rankings);

      return interaction.reply({ embeds: [successEmbed('🗑️ Tier Removed', `Removed **${player}** tier for **${kit}**.`)] });
    }

    // 17. /setdiscord
    if (commandName === 'setdiscord') {
      const player = options.getString('player').trim();
      const discord = options.getString('discord').trim();

      let pObj = rankings.Players.find(p => (typeof p === 'object' ? p.name : p).toLowerCase() === player.toLowerCase());
      if (typeof pObj === 'object') {
        pObj.discord = discord;
      }
      db.saveLocalRankings(rankings);
      await db.patchDoc('rankings', 'all_data', rankings);

      return interaction.reply({ embeds: [successEmbed('💬 Discord Linked', `Linked Discord **${discord}** to **${player}**.`)] });
    }

    // 18. /setyoutube
    if (commandName === 'setyoutube') {
      const player = options.getString('player').trim();
      const youtube = options.getString('youtube').trim();

      let pObj = rankings.Players.find(p => (typeof p === 'object' ? p.name : p).toLowerCase() === player.toLowerCase());
      if (typeof pObj === 'object') {
        pObj.youtube = youtube;
      }
      db.saveLocalRankings(rankings);
      await db.patchDoc('rankings', 'all_data', rankings);

      return interaction.reply({ embeds: [successEmbed('▶️ YouTube Linked', `Linked YouTube **${youtube}** to **${player}**.`)] });
    }

    // 19. /resetplayertiers
    if (commandName === 'resetplayertiers') {
      const player = options.getString('player').trim();

      for (const kit in rankings) {
        if (kit === 'Overall' || kit === 'Players') continue;
        for (const tier in rankings[kit]) {
          if (Array.isArray(rankings[kit][tier])) {
            rankings[kit][tier] = rankings[kit][tier].filter(p => p.toLowerCase() !== player.toLowerCase());
          }
        }
      }
      db.recomputeOverallPoints(rankings);
      db.saveLocalRankings(rankings);
      await db.patchDoc('rankings', 'all_data', rankings);

      return interaction.reply({ embeds: [successEmbed('🔄 Tiers Reset', `Reset all kit tiers for **${player}**.`)] });
    }

    // 20. /renameplayer
    if (commandName === 'renameplayer') {
      const oldName = options.getString('old_username').trim();
      const newName = options.getString('new_username').trim();

      let pObj = rankings.Players.find(p => (typeof p === 'object' ? p.name : p).toLowerCase() === oldName.toLowerCase());
      if (typeof pObj === 'object') {
        pObj.name = newName;
      }

      for (const kit in rankings) {
        if (kit === 'Overall') continue;
        if (kit === 'Players') continue;
        for (const tier in rankings[kit]) {
          if (Array.isArray(rankings[kit][tier])) {
            rankings[kit][tier] = rankings[kit][tier].map(p => (p.toLowerCase() === oldName.toLowerCase() ? newName : p));
          }
        }
      }

      db.recomputeOverallPoints(rankings);
      db.saveLocalRankings(rankings);
      await db.patchDoc('rankings', 'all_data', rankings);

      return interaction.reply({ embeds: [successEmbed('✏️ Player Renamed', `Renamed **${oldName}** ➔ **${newName}** across all kit rankings!`)] });
    }

    // 21. /announceduel
    if (commandName === 'announceduel') {
      const p1 = options.getString('player1').trim();
      const p2 = options.getString('player2').trim();
      const kit = options.getString('kit').trim();
      const winner = options.getString('winner').trim();
      const s1 = options.getInteger('player1_score');
      const s2 = options.getInteger('player2_score');
      const outcome = options.getString('outcome').trim();
      const imgAttachment = options.getAttachment('proof_image');

      const dateStr = new Date().toISOString().split('T')[0];

      // Save duel record for P1
      if (!duels[p1]) duels[p1] = [];
      const p1Duels = Array.isArray(duels[p1]) ? duels[p1] : duels[p1].duels || [];
      const res1 = winner.toLowerCase() === p1.toLowerCase() ? 'Won' : 'Lost';
      const duelRecord1 = { date: dateStr, kit, outcome, player1: p1, player2: p2, player1_score: s1, player2_score: s2, result: res1 };
      p1Duels.unshift(duelRecord1);
      duels[p1] = p1Duels;

      // Save duel record for P2
      if (!duels[p2]) duels[p2] = [];
      const p2Duels = Array.isArray(duels[p2]) ? duels[p2] : duels[p2].duels || [];
      const res2 = winner.toLowerCase() === p2.toLowerCase() ? 'Won' : 'Lost';
      const duelRecord2 = { date: dateStr, kit, outcome, player1: p1, player2: p2, player1_score: s1, player2_score: s2, result: res2 };
      p2Duels.unshift(duelRecord2);
      duels[p2] = p2Duels;

      db.saveLocalDuels(duels);
      await db.patchDoc('duels', p1, { player: p1, duels: p1Duels, count: p1Duels.length, last_updated: dateStr });
      await db.patchDoc('duels', p2, { player: p2, duels: p2Duels, count: p2Duels.length, last_updated: dateStr });

      // Create rich announcement embed
      const isP1Winner = winner.toLowerCase() === p1.toLowerCase();
      const p1Emoji = isP1Winner ? '👑' : '⚔️';
      const p2Emoji = !isP1Winner ? '👑' : '⚔️';

      const duelEmbed = new EmbedBuilder()
        .setTitle(`⚔️ OFFICIAL MTC TIERS DUEL RESULT`)
        .setDescription(`**${p1}** vs **${p2}**\n**Kit:** ${kit}`)
        .addFields(
          { name: `${p1Emoji} ${p1}`, value: `Score: **${s1}**`, inline: true },
          { name: `${p2Emoji} ${p2}`, value: `Score: **${s2}**`, inline: true },
          { name: `🏆 Winner`, value: `**${winner}** (${outcome.toUpperCase()})`, inline: false },
          { name: `📅 Date`, value: dateStr, inline: true }
        )
        .setColor(0x00eeff)
        .setFooter({ text: 'MTCTiers Official Tier Testing System', iconURL: 'https://preview-mtctiers-015.surge.sh/assets/mtctiers.png' })
        .setTimestamp();

      if (imgAttachment) {
        duelEmbed.setImage(imgAttachment.url);
      }

      // Send to Announcement Channel if configured
      let channelMsg = '';
      if (config.announcementChannelId) {
        try {
          const annChannel = await interaction.client.channels.fetch(config.announcementChannelId);
          if (annChannel) {
            await annChannel.send({ embeds: [duelEmbed] });
            channelMsg = ` & posted to <#${config.announcementChannelId}>`;
          }
        } catch (e) {
          console.warn('Failed to send to announcement channel:', e.message);
        }
      }

      return interaction.reply({ content: `✅ **Duel Recorded**${channelMsg}!`, embeds: [duelEmbed] });
    }

  } catch (err) {
    console.error('Error handling admin command:', err);
    return interaction.reply({ embeds: [errorEmbed(err.message)], ephemeral: true });
  }
}

module.exports = {
  adminCommands,
  handleAdminCommand
};
