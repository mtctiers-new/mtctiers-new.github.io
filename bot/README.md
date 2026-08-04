# 🤖 MTCTiers Discord Bot & Duel Announcement Bot

Complete Discord Bot and Duel Announcement system for MTCTiers, designed for single-server deployment and optimized for **Railway Free Tier**.

---

## 📌 Features

### 🛡️ Admin Commands (21 Commands)
- `/addplayer` — Add new player to rankings & database.
- `/removeplayer` — Remove a player from MTCTiers.
- `/addskin` / `/changeskin` / `/removeskin` — Manage player Minecraft skins.
- `/addtester` / `/removetester` — Manage official MTCTiers Tier Testers.
- `/addhof` / `/edithof` / `/removehof` — Manage Hall of Fame entries.
- `/addkit` / `/removekit` — Manage PvP kit categories.
- `/setdevice` — Set player preferred input device (`MK`, `MB`, `CT`, `TP`).
- `/setregion` — Set player region (`NA`, `EU`, `SA`, `AS`, `OC`, `AF`).
- `/settier` — Set a player's tier placement in any kit (`HT1`, `LT1`, `HT2`, `LT2`, etc.) and automatically update overall points.
- `/removetier` — Remove a player's tier in a kit.
- `/setdiscord` — Link Discord handle to player profile.
- `/setyoutube` — Link YouTube channel to player profile.
- `/resetplayertiers` — Reset all kit placements for a player.
- `/renameplayer` — Rename a player across all kit rankings, duels, HOF, and database.
- `/announceduel` — Record a duel result and automatically post a rich announcement embed with scores, winner crown, outcome, and proof image to the configured **#duel-announcements** channel!

### 👤 Player Commands (7 Commands)
- `/info` — View full player card profile (Points, Rank, Title, Region, Device, Kits, Links).
- `/skin` — Display player avatar skin image.
- `/tiers` — View active & retired kit placements of any player.
- `/duelhistory` — View win/loss record and latest duel results of any player.
- `/search` — Search players on MTCTiers rankings.
- `/kits` — View all official PvP kits & point rules.
- `/randomplayer` — Display a random player profile card.

---

## ⚙️ Configuration Setup

Create a `.env` file in the `bot/` directory (or configure these environment variables in Railway):

```env
# Discord Bot Token (from Discord Developer Portal)
DISCORD_TOKEN=MTEx...your_bot_token

# Client ID (Application ID from Discord Developer Portal)
CLIENT_ID=123456789012345678

# Your Discord Server Guild ID (Single Server Mode for instant slash command registration)
GUILD_ID=987654321098765432

# Channel ID for Duel Announcement Embeds (e.g. #duel-announcements)
ANNOUNCEMENT_CHANNEL_ID=112233445566778899

# Admin Role ID (Only users with this Role or Administrator permissions can run admin commands)
ADMIN_ROLE_ID=998877665544332211

# Firebase Project ID
FIREBASE_PROJECT_ID=mtctiers
```

---

## 🚀 Railway Free Tier Deployment Guide

### Step 1: Push Code to GitHub
1. Create a repository on GitHub (or use your existing repository).
2. Commit and push the `bot/` directory code.

### Step 2: Create Railway Project
1. Go to [Railway.app](https://railway.app) and log in.
2. Click **+ New Project** ➔ **Deploy from GitHub repo**.
3. Select your repository.

### Step 3: Configure Environment Variables in Railway
1. Click on your deployed service in Railway.
2. Go to the **Variables** tab.
3. Click **Add Variable** and add the following keys from your `.env`:
   - `DISCORD_TOKEN`
   - `CLIENT_ID`
   - `GUILD_ID`
   - `ANNOUNCEMENT_CHANNEL_ID`
   - `ADMIN_ROLE_ID`
   - `FIREBASE_PROJECT_ID`

### Step 4: Verification
Railway will automatically build and start the bot using the included `Procfile` (`worker: node index.js`).
Once online, check your Discord server — all 28 `/` slash commands will register instantly!

---

## 🤖 Discord Bot Permission Gateway Intents

In the [Discord Developer Portal](https://discord.com/developers/applications):
1. Select your Bot application ➔ Go to **Bot** tab.
2. Under **Privileged Gateway Intents**, enable:
   - ✅ **Server Members Intent**
   - ✅ **Message Content Intent**
3. Save changes.
4. Go to **OAuth2 ➔ URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Administrator` (or `Send Messages`, `Embed Links`, `Attach Files`, `Use Application Commands`).
5. Copy the invite link and invite the bot to your Discord server.
