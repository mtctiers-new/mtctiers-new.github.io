require('dotenv').config();

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
    "HT1": 65,
    "LT1": 45,
    "HT2": 30,
    "LT2": 20,
    "HT3": 10,
    "LT3": 5,
    "Retired": 0
  }
};
