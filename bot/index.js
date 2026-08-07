const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const http = require('http');
const config = require('./config');
const { adminCommands, handleAdminCommand } = require('./commands/admin');
const { playerCommands, handlePlayerCommand } = require('./commands/player');
const { queueCommands, handleQueueCommand, handleQueueButton, updateQueuePanel } = require('./commands/queue');

// Global error handlers to prevent process crashes on network drops/unhandled promises
process.on('uncaughtException', (err) => {
  console.error('⚠️ [GLOBAL] Uncaught Exception:', err.stack || err.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [GLOBAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Lightweight HTTP server for Railway health checks to keep service alive
const PORT = process.env.PORT || 8080;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('MTCTiers Discord Bot Status: OK\n');
}).listen(PORT, () => {
  console.log(`🌐 Health check HTTP server listening on port ${PORT}`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

client.on('error', err => {
  console.error('⚠️ [DISCORD CLIENT ERROR]:', err.message);
});

client.on('shardError', error => {
  console.error('⚠️ [DISCORD SHARD ERROR]:', error.message);
});

client.on('shardDisconnect', (event, id) => {
  console.warn(`⚠️ [DISCORD DISCONNECT] Shard ${id} disconnected. Reconnecting...`);
});

client.on('shardReconnecting', id => {
  console.log(`🔄 [DISCORD RECONNECTING] Shard ${id} reconnecting...`);
});

const allCommands = [...adminCommands, ...playerCommands, ...queueCommands];

client.once('ready', async () => {
  console.log(`================--------------------------------====`);
  console.log(`🤖 MTCTiers Discord Bot Online! Logged in as ${client.user.tag}`);
  console.log(`================--------------------------------====`);

  if (config.clientId) {
    try {
      const rest = new REST({ version: '10' }).setToken(config.token);
      console.log(`Registering ${allCommands.length} slash commands globally...`);

      await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: allCommands.map(c => c.toJSON()) }
      );

      if (config.guildId) {
        await rest.put(
          Routes.applicationGuildCommands(config.clientId, config.guildId),
          { body: allCommands.map(c => c.toJSON()) }
        );
      }

      console.log(`✅ Successfully registered all ${allCommands.length} MTCTiers Slash Commands!`);
    } catch (err) {
      console.error(`❌ Failed to register slash commands:`, err);
    }
  } else {
    console.warn(`⚠️ CLIENT_ID missing!`);
  }

  try {
    await updateQueuePanel(client);
  } catch (e) {
    console.warn('Queue panel startup update note:', e.message);
  }

  try {
    await refreshPlayerCache();
    console.log(`✅ Loaded ${CACHED_PLAYER_LIST.length} players into high-speed autocomplete cache!`);
  } catch (e) {
    console.warn('Player cache startup note:', e.message);
  }
});

let CACHED_PLAYER_LIST = [];
let LAST_CACHE_TIME = 0;

function buildPlayerListFromData(data) {
  if (!data || typeof data !== 'object') return [];
  const playerSet = new Set();

  function isValidUsername(str) {
    if (!str || typeof str !== 'string') return false;
    const clean = str.replace(/\*/g, '').trim();
    const lower = clean.toLowerCase();
    if (lower.includes('promoted') || lower.includes('failed') || lower.includes('in ') || lower.includes('to ') || lower.includes('has been')) return false;
    if (clean.includes(' ') && clean.length > 16) return false;
    return clean.length >= 2 && clean.length <= 25;
  }

  (data.Players || []).forEach(p => {
    const name = typeof p === 'object' ? p.name : p;
    if (isValidUsername(name)) playerSet.add(name.replace(/\*/g, '').trim());
  });

  Object.keys(data.Overall || {}).forEach(name => {
    if (isValidUsername(name)) playerSet.add(name.replace(/\*/g, '').trim());
  });

  for (const kit in data) {
    if (kit === 'Overall' || kit === 'Players' || kit === 'HallOfFame' || kit === 'Testers') continue;
    const kitObj = data[kit];
    if (!kitObj || typeof kitObj !== 'object') continue;
    for (const tier in kitObj) {
      if (Array.isArray(kitObj[tier])) {
        kitObj[tier].forEach(p => {
          const name = typeof p === 'object' ? p.name : p;
          if (isValidUsername(name)) playerSet.add(name.replace(/\*/g, '').trim());
        });
      }
    }
  }

  return Array.from(playerSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

async function refreshPlayerCache() {
  try {
    const db = require('./firebase');
    const rankings = await db.getFullRankings();
    const list = buildPlayerListFromData(rankings);
    if (list.length) {
      CACHED_PLAYER_LIST = list;
      LAST_CACHE_TIME = Date.now();
    }
  } catch (e) {
    console.warn("Failed to refresh player cache from Firestore:", e.message);
  }
}

function getCachedPlayerList() {
  const now = Date.now();
  if (!CACHED_PLAYER_LIST.length) {
    try {
      const db = require('./firebase');
      const local = db.loadLocalRankings();
      CACHED_PLAYER_LIST = buildPlayerListFromData(local);
    } catch (e) {}
  }

  if (now - LAST_CACHE_TIME > 30000) {
    refreshPlayerCache().catch(() => {});
  }

  return CACHED_PLAYER_LIST;
}

client.on('interactionCreate', async interaction => {
  if (interaction.isButton()) {
    return handleQueueButton(interaction);
  }

  if (interaction.isAutocomplete()) {
    try {
      const focusedOption = interaction.options.getFocused(true);
      const query = (focusedOption.value || '').toLowerCase().trim();

      if (focusedOption.name === 'kit' || focusedOption.name === 'kit_key') {
        const kits = ['Emerald', 'Emerald KB', 'Dragonhide KB', 'Manhunt', 'Diamond', 'Novelty Axe', 'Dragonhide Anchor', 'Void'];
        const filteredKits = kits.filter(k => k.toLowerCase().includes(query)).slice(0, 25);
        return interaction.respond(filteredKits.map(k => ({ name: k, value: k })));
      }

      const playersList = getCachedPlayerList();
      const filtered = playersList.filter(name => name.toLowerCase().includes(query)).slice(0, 25);
      return interaction.respond(filtered.map(name => ({ name, value: name })));
    } catch (e) {
      return interaction.respond([]);
    }
  }

  if (!interaction.isChatInputCommand()) return;

  try {
    const adminCmdNames = adminCommands.map(c => c.name);
    if (adminCmdNames.includes(interaction.commandName)) {
      return await handleAdminCommand(interaction);
    }

    const playerCmdNames = playerCommands.map(c => c.name);
    if (playerCmdNames.includes(interaction.commandName)) {
      return await handlePlayerCommand(interaction);
    }

    const queueCmdNames = queueCommands.map(c => c.name);
    if (queueCmdNames.includes(interaction.commandName)) {
      return await handleQueueCommand(interaction);
    }
  } catch (err) {
    console.error(`Error executing command ${interaction.commandName}:`, err);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: `❌ An unexpected error occurred while processing command \`/${interaction.commandName}\`: ${err.message}` }).catch(() => {});
    } else {
      await interaction.reply({ content: `❌ An unexpected error occurred while processing command \`/${interaction.commandName}\`: ${err.message}`, ephemeral: true }).catch(() => {});
    }
  }
});

if (!config.token) {
  console.error(`❌ DISCORD_TOKEN is missing!`);
} else {
  client.login(config.token);
}
