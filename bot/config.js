try { require('dotenv').config(); } catch (e) {}

module.exports = {
  token: process.env.DISCORD_TOKEN || '',
  clientId: process.env.CLIENT_ID || '',
  guildId: process.env.GUILD_ID || '',
  announcementChannelId: process.env.ANNOUNCEMENT_CHANNEL_ID || '',
  adminRoleIds: (process.env.ADMIN_ROLE_IDS || process.env.ADMIN_ROLE_ID || '1471337796961829156,1509248567922004028,1471336340258951309')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || 'mtctiers',
  
  // Point values for MTCTiers
  ptsPoints: {
    "HT1": 50,
    "LT1": 40,
    "HT2": 30,
    "LT2": 20,
    "HT3": 12,
    "LT3": 8,
    "HT4": 5,
    "LT4": 3,
    "HT5": 2,
    "LT5": 1,
    "Retired": 0
  }
};
