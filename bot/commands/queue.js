const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../firebase');
const config = require('../config');
const { buildTestResultEmbed, TARGET_RESULTS_CHANNEL } = require('../manual_results');

const LOGO_URL = 'https://raw.githubusercontent.com/mtctiers-new/mtctiers-new.github.io/main/assets/mtctiers.png';
const TARGET_CHANNEL_ID = '1524107242394091630';

const TIER_TESTERS = [
  { userId: '1073335999981162506', ign: 'x9jm', tag: 'Myth' },
  { userId: '1303536570095108146', ign: 'Vorthexis', tag: 'vorthexis' },
  { userId: '1268588197508550677', ign: 'LastChance', tag: 'Angelic Jibril' },
  { userId: '1218594129261363293', ign: '-_Hades_-', tag: 'ABit1Insan3' },
  { userId: '1371980952036839476', ign: 'skibidi1234567', tag: 'TaoAngKhi' },
  { userId: null, ign: 'ChillPotato', tag: 'ChillPotato (No Discord)' }
];

function buildOldStyleResultMessage({ playerMention, playerIgn, kit, outcome, prevRank, score, testerMention, testerIgn }) {
  const lines = [];
  const outcomeLower = outcome.toLowerCase();
  const isFailed = outcomeLower.includes('fail');
  const isDemoted = outcomeLower.includes('demot');

  let header;
  if (isFailed) {
    header = `${playerMention} - \`${playerIgn}\` failed **${outcome}** in ${kit}`;
  } else if (isDemoted) {
    header = `${playerMention} - \`${playerIgn}\` has been demoted to **${outcome}** in ${kit}`;
  } else {
    header = `${playerMention} - \`${playerIgn}\` has been promoted to **${outcome}** in ${kit}`;
  }
  lines.push(header);

  if (!isFailed) {
    lines.push('');
    lines.push('**Previous Rank**');
    lines.push(`> ${prevRank || 'Unranked'}`);
  }

  lines.push('');
  lines.push(`**${outcome} Fight**`);
  lines.push(`> ${score} against ${testerMention} - \`${testerIgn}\``);

  return lines.join('\n');
}

function isTesterOrAdmin(member, userId) {
  if (TIER_TESTERS.some(t => t.userId === userId)) return true;
  if (!member) return false;
  if (member.permissions && member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (config.adminRoleIds && config.adminRoleIds.length > 0) {
    return config.adminRoleIds.some(r => member.roles && member.roles.cache && member.roles.cache.has(r));
  }
  return false;
}

async function getQueueData() {
  const doc = await db.getDoc('rankings', 'queue_state');
  if (!doc) {
    return {
      queue: [],
      onlineTesters: [],
      panelChannelId: TARGET_CHANNEL_ID,
      panelMessageId: null,
      lastSession: 'N/A'
    };
  }
  return {
    queue: Array.isArray(doc.queue) ? doc.queue : [],
    onlineTesters: Array.isArray(doc.onlineTesters) ? doc.onlineTesters : [],
    panelChannelId: doc.panelChannelId || TARGET_CHANNEL_ID,
    panelMessageId: doc.panelMessageId || null,
    lastSession: doc.lastSession || 'N/A'
  };
}

async function saveQueueData(data) {
  await db.patchDoc('rankings', 'queue_state', data);
}

function buildQueueEmbed(data) {
  const isOnline = data.onlineTesters.length > 0;
  const embedColor = isOnline ? 0x22c55e : 0xef4444;

  const title = isOnline ? '🟢 Testers Online' : 'No Testers Online';

  let desc = '';
  if (isOnline) {
    desc = `**${data.onlineTesters.length} tester(s) are currently available to test!**\nYou can click below to join the testing queue.\nCheck back frequently!`;
  } else {
    desc = `No testers are available at this time.\nYou will be pinged when a tester is available.\nCheck back later!`;
  }

  const onlineTestersStr = data.onlineTesters.length
    ? data.onlineTesters.map(t => `• <@${t.userId}> — \`${t.ign}\``).join('\n')
    : '*None*';

  const queueListStr = data.queue.length
    ? data.queue.map((q, idx) => `**${idx + 1}.** <@${q.userId}> (\`${q.username}\`)`).join('\n')
    : '*Queue is empty.*';

  const embed = new EmbedBuilder()
    .setAuthor({ name: 'MTCTiers Official Tier Testing Queue', iconURL: LOGO_URL })
    .setTitle(title)
    .setDescription(desc)
    .setColor(embedColor)
    .addFields(
      { name: '👥 Testers Currently Online', value: onlineTestersStr, inline: false },
      { name: '⏳ Current Queue', value: queueListStr, inline: false },
      { name: '🕒 Last testing session', value: data.lastSession || 'N/A', inline: false }
    )
    .setFooter({ text: 'MTCTiers Official Queue • mtctiers.com', iconURL: LOGO_URL })
    .setTimestamp();

  return embed;
}

function buildQueueButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_join_queue').setLabel('Join Queue').setStyle(ButtonStyle.Primary).setEmoji('📥'),
    new ButtonBuilder().setCustomId('btn_leave_queue').setLabel('Leave Queue').setStyle(ButtonStyle.Secondary).setEmoji('📤')
  );
}

async function updateQueuePanel(client) {
  try {
    const data = await getQueueData();
    const channelId = data.panelChannelId || TARGET_CHANNEL_ID;
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    const embed = buildQueueEmbed(data);
    const row = buildQueueButtons();

    if (data.panelMessageId) {
      const msg = await channel.messages.fetch(data.panelMessageId).catch(() => null);
      if (msg) {
        await msg.edit({ embeds: [embed], components: [row] });
        return;
      }
    }

    const newMsg = await channel.send({ embeds: [embed], components: [row] });
    data.panelMessageId = newMsg.id;
    await saveQueueData(data);
  } catch (err) {
    console.error('Error updating queue panel:', err);
  }
}

const queueCommands = [
  new SlashCommandBuilder().setName('sendqueuepanel').setDescription('[Admin/Tester] Send or refresh the persistent testing queue panel'),

  new SlashCommandBuilder().setName('testerstatus').setDescription('[Tester] Toggle your online/offline status for tier testing')
    .addStringOption(o => o.setName('status').setDescription('Set your testing status').setRequired(true)
      .addChoices(
        { name: 'Online 🟢', value: 'online' },
        { name: 'Offline 🔴', value: 'offline' }
      )),

  new SlashCommandBuilder().setName('nextinqueue').setDescription('[Tester] Call the next player waiting in the testing queue'),

  new SlashCommandBuilder().setName('clearqueue').setDescription('[Admin/Tester] Clear all players from the testing queue'),

  new SlashCommandBuilder().setName('tiertesters').setDescription('View official MTCTiers Tier Testers list')
];

async function handleQueueCommand(interaction) {
  await interaction.deferReply({ ephemeral: interaction.commandName !== 'tiertesters' && interaction.commandName !== 'sendqueuepanel' });

  const { commandName, options, member, user, channel, client, guild } = interaction;
  const data = await getQueueData();

  try {
    if (commandName === 'sendqueuepanel') {
      if (!isTesterOrAdmin(member, user.id)) {
        return interaction.editReply({ content: '❌ **Permission Denied**: Only Tier Testers and Admins can use this command.' });
      }

      const targetChan = await client.channels.fetch(TARGET_CHANNEL_ID).catch(() => channel);
      const embed = buildQueueEmbed(data);
      const row = buildQueueButtons();

      const newMsg = await targetChan.send({ embeds: [embed], components: [row] });
      data.panelChannelId = targetChan.id;
      data.panelMessageId = newMsg.id;
      await saveQueueData(data);

      return interaction.editReply({ content: `✅ Testing Queue Panel successfully posted in <#${targetChan.id}>!` });
    }

    if (commandName === 'testerstatus') {
      if (!isTesterOrAdmin(member, user.id)) {
        return interaction.editReply({ content: '❌ **Permission Denied**: Only MTCTiers Tier Testers can toggle testing status.' });
      }

      const statusVal = options.getString('status');
      const testerObj = TIER_TESTERS.find(t => t.userId === user.id) || { userId: user.id, ign: user.username, tag: user.tag };

      if (statusVal === 'online') {
        const exists = data.onlineTesters.some(t => t.userId === user.id);
        if (!exists) {
          data.onlineTesters.push(testerObj);
        }
        data.lastSession = `<t:${Math.floor(Date.now() / 1000)}:f> (<t:${Math.floor(Date.now() / 1000)}:R>)`;
        await saveQueueData(data);
        await updateQueuePanel(client);

        let pingMsg = '';
        if (data.queue.length > 0) {
          const pings = data.queue.map(q => `<@${q.userId}>`).join(', ');
          pingMsg = `\n🔔 **Notice:** ${pings} — <@${user.id}> is now **ONLINE** and ready to test!`;
          try {
            const chan = await client.channels.fetch(TARGET_CHANNEL_ID).catch(() => null);
            if (chan) await chan.send(`🟢 **Tester Available!** ${pings} — <@${user.id}> is now online for tier testing!`);
          } catch (e) {}
        }

        return interaction.editReply({ content: `🟢 You are now marked as **ONLINE** for tier testing!${pingMsg}` });
      } else {
        data.onlineTesters = data.onlineTesters.filter(t => t.userId !== user.id);
        await saveQueueData(data);
        await updateQueuePanel(client);

        return interaction.editReply({ content: `🔴 You are now marked as **OFFLINE** for tier testing.` });
      }
    }

    if (commandName === 'nextinqueue') {
      if (!isTesterOrAdmin(member, user.id)) {
        return interaction.editReply({ content: '❌ **Permission Denied**: Only Tier Testers can call the next player.' });
      }

      if (!data.queue.length) {
        return interaction.editReply({ content: '⚠️ The testing queue is currently empty!' });
      }

      const nextPlayer = data.queue.shift();
      await saveQueueData(data);
      await updateQueuePanel(client);

      // Create private channel for testing
      let testChan = null;
      try {
        const parentCategory = channel ? channel.parentId : null;
        testChan = await guild.channels.create({
          name: `test-${nextPlayer.username.toLowerCase()}`,
          type: ChannelType.GuildText,
          parent: parentCategory || undefined,
          permissionOverwrites: [
            {
              id: guild.id,
              deny: [PermissionFlagsBits.ViewChannel]
            },
            {
              id: nextPlayer.userId,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
            },
            {
              id: user.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
            },
            {
              id: client.user.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels]
            }
          ]
        });

        const closeBtnRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`btn_close_test_${nextPlayer.userId}_${nextPlayer.username}`)
            .setLabel('Close Test & Submit Result')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('📝')
        );

        await testChan.send({
          content: `⚔️ **Tier Test Started for <@${nextPlayer.userId}> (\`${nextPlayer.username}\`)!**\nTester: <@${user.id}>\n\nWhen the fight is complete, click **Close Test & Submit Result** below to fill out scores and log results.`,
          components: [closeBtnRow]
        });
      } catch (e) {
        console.warn('Private test channel creation note:', e.message);
      }

      const chanMention = testChan ? `<#${testChan.id}>` : 'a private channel';
      return interaction.editReply({ content: `✅ Created private test channel ${chanMention} for **<@${nextPlayer.userId}>**! ${data.queue.length} player(s) remaining in queue.` });
    }

    if (commandName === 'clearqueue') {
      if (!isTesterOrAdmin(member, user.id)) {
        return interaction.editReply({ content: '❌ **Permission Denied**: Only Tier Testers can clear the queue.' });
      }

      data.queue = [];
      await saveQueueData(data);
      await updateQueuePanel(client);

      return interaction.editReply({ content: '🧹 Successfully cleared the testing queue!' });
    }

    if (commandName === 'tiertesters') {
      const lines = [
        '• <@1073335999981162506> - `x9jm`',
        '• <@1303536570095108146> - `Vorthexis`',
        '• <@1268588197508550677> - `LastChance`',
        '• <@1218594129261363293> - `-_Hades_-`',
        '• `ChillPotato`',
        '• <@1371980952036839476> - `skibidi1234567`'
      ];

      const embed = new EmbedBuilder()
        .setAuthor({ name: 'MTCTiers Official Team', iconURL: LOGO_URL })
        .setTitle('Tiertesters')
        .setDescription(lines.join('\n'))
        .setColor(0x00eeff)
        .setFooter({ text: 'MTCTiers Official • mtctiers.com', iconURL: LOGO_URL })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

  } catch (err) {
    console.error('Error handling queue command:', err);
    return interaction.editReply({ content: `❌ Error: ${err.message}` });
  }
}

async function handleQueueButton(interaction) {
  const { customId, user, client } = interaction;

  if (customId.startsWith('btn_close_test_')) {
    const parts = customId.split('_');
    const targetUserId = parts[3] || user.id;
    const targetUsername = parts.slice(4).join('_') || 'Player';

    const modal = new ModalBuilder()
      .setCustomId(`modal_submit_test_${targetUserId}_${targetUsername}`)
      .setTitle(`Tier Test Results: ${targetUsername}`);

    const inputIgn = new TextInputBuilder()
      .setCustomId('field_ign')
      .setLabel('Player Username / IGN')
      .setValue(targetUsername)
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const inputKit = new TextInputBuilder()
      .setCustomId('field_kit')
      .setLabel('Kit Category (e.g. Dragonhide KB, Emerald)')
      .setValue('Dragonhide KB')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const inputOutcome = new TextInputBuilder()
      .setCustomId('field_outcome')
      .setLabel('Rank Earned / Outcome (e.g. HT5, Failed)')
      .setValue('HT5')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const inputPrevRank = new TextInputBuilder()
      .setCustomId('field_prev_rank')
      .setLabel('Previous Rank (e.g. Low Tier 4, Unranked)')
      .setValue('Unranked')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const inputScore = new TextInputBuilder()
      .setCustomId('field_score')
      .setLabel('Fight Score (e.g. 5 - 0)')
      .setValue('5 - 0')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(inputIgn),
      new ActionRowBuilder().addComponents(inputKit),
      new ActionRowBuilder().addComponents(inputOutcome),
      new ActionRowBuilder().addComponents(inputPrevRank),
      new ActionRowBuilder().addComponents(inputScore)
    );

    return interaction.showModal(modal);
  }

  await interaction.deferReply({ ephemeral: true });
  const data = await getQueueData();

  if (customId === 'btn_join_queue') {
    const existingIdx = data.queue.findIndex(q => q.userId === user.id);
    if (existingIdx !== -1) {
      return interaction.editReply({ content: `⚠️ You are already in the testing queue at position **#${existingIdx + 1}**!` });
    }

    data.queue.push({
      userId: user.id,
      username: user.username,
      tag: user.tag,
      joinedAt: new Date().toISOString()
    });

    await saveQueueData(data);
    await updateQueuePanel(client);

    return interaction.editReply({ content: `📥 **Joined Queue!** You are position **#${data.queue.length}** in line.` });
  }

  if (customId === 'btn_leave_queue') {
    const existingIdx = data.queue.findIndex(q => q.userId === user.id);
    if (existingIdx === -1) {
      return interaction.editReply({ content: `⚠️ You are not currently in the testing queue.` });
    }

    data.queue.splice(existingIdx, 1);
    await saveQueueData(data);
    await updateQueuePanel(client);

    return interaction.editReply({ content: `📤 **Left Queue.** You have been removed from the testing queue.` });
  }
}

async function handleQueueModal(interaction) {
  if (!interaction.customId.startsWith('modal_submit_test_')) return;

  await interaction.deferReply({ ephemeral: true });

  try {
    const parts = interaction.customId.split('_');
    const targetUserId = parts[3];

    const ign = interaction.fields.getTextInputValue('field_ign').trim();
    const kit = interaction.fields.getTextInputValue('field_kit').trim();
    const outcome = interaction.fields.getTextInputValue('field_outcome').trim();
    const prevRank = interaction.fields.getTextInputValue('field_prev_rank').trim();
    const score = interaction.fields.getTextInputValue('field_score').trim();

    const isFailed = outcome.toLowerCase().includes('fail');
    const cleanTier = (outcome.match(/[HR]?LT\d|[HR]?HT\d/i) || [outcome])[0].toUpperCase();

    // 1. Patch Rankings
    const rankings = await db.getFullRankings();
    if (!isFailed && cleanTier) {
      if (!rankings[kit]) rankings[kit] = {};
      for (const t in rankings[kit]) {
        if (Array.isArray(rankings[kit][t])) {
          rankings[kit][t] = rankings[kit][t].filter(p => (typeof p === 'object' ? p.name : p || '').toString().toLowerCase() !== ign.toLowerCase());
        }
      }
      if (!rankings[kit][cleanTier]) rankings[kit][cleanTier] = [];
      if (!rankings[kit][cleanTier].includes(ign)) rankings[kit][cleanTier].push(ign);

      db.recomputeOverallPoints(rankings);
      db.saveLocalRankings(rankings);
      await db.patchDoc('rankings', kit, rankings[kit]);
      await db.patchDoc('rankings', 'players_meta', { players: rankings.Players || [] });
    }

    // 2. Build old-style plain-text result message
    const testerEntry = TIER_TESTERS.find(t => t.userId === interaction.user.id);
    const testerIgn = testerEntry ? testerEntry.ign : interaction.user.username;

    const msg = buildOldStyleResultMessage({
      playerMention: `<@${targetUserId}>`,
      playerIgn: ign,
      kit,
      outcome,
      prevRank,
      score,
      testerMention: `<@${interaction.user.id}>`,
      testerIgn
    });

    // 3. Post to tiertesters chat (1488183052407406723)
    let postedNote = '';
    try {
      const targetChan = await interaction.client.channels.fetch(TARGET_RESULTS_CHANNEL).catch(() => null);
      if (targetChan) {
        await targetChan.send(msg);
        postedNote = ` and result posted to <#${TARGET_RESULTS_CHANNEL}>`;
      }
    } catch (e) {
      console.warn('Error sending test result to tiertesters channel:', e.message);
    }

    // 4. Confirm to tester and schedule channel deletion in 5 seconds
    await interaction.editReply({ content: `✅ **Tier test submitted** for **${ign}**${postedNote}! Deleting this channel in 5 seconds...` });

    setTimeout(() => {
      if (interaction.channel && interaction.channel.deletable) {
        interaction.channel.delete().catch(() => null);
      }
    }, 5000);
  } catch (err) {
    console.error('Error handling queue modal submission:', err);
    return interaction.editReply({ content: `❌ Error submitting test result: ${err.message}` });
  }
}

module.exports = {
  queueCommands,
  handleQueueCommand,
  handleQueueButton,
  handleQueueModal,
  updateQueuePanel,
  TARGET_CHANNEL_ID
};

