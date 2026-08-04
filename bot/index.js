const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const config = require('./config');
const { adminCommands, handleAdminCommand } = require('./commands/admin');
const { playerCommands, handlePlayerCommand } = require('./commands/player');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Combine all 28 slash command definitions
const allCommands = [...adminCommands, ...playerCommands];

client.once('ready', async () => {
  console.log(`================--------------------------------====`);
  console.log(`🤖 MTCTiers Discord Bot Online! Logged in as ${client.user.tag}`);
  console.log(`================--------------------------------====`);

  // Register slash commands to Guild ID (Instant single-server registration)
  if (config.clientId && config.guildId) {
    try {
      const rest = new REST({ version: '10' }).setToken(config.token);
      console.log(`Registering ${allCommands.length} slash commands to Guild ${config.guildId}...`);

      await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: allCommands.map(c => c.toJSON()) }
      );

      console.log(`✅ Successfully registered all 28 MTCTiers Slash Commands!`);
    } catch (err) {
      console.error(`❌ Failed to register slash commands:`, err);
    }
  } else {
    console.warn(`⚠️ CLIENT_ID or GUILD_ID missing in .env! Slash commands not registered automatically.`);
  }
});

// Interaction handler
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const adminCmdNames = adminCommands.map(c => c.name);
  if (adminCmdNames.includes(interaction.commandName)) {
    return handleAdminCommand(interaction);
  }

  const playerCmdNames = playerCommands.map(c => c.name);
  if (playerCmdNames.includes(interaction.commandName)) {
    return handlePlayerCommand(interaction);
  }
});

// Start bot
if (!config.token || config.token === 'your_discord_bot_token_here') {
  console.error(`❌ DISCORD_TOKEN is missing! Please set it in your .env file or Railway variables.`);
} else {
  client.login(config.token);
}
