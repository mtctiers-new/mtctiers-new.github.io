const db = require('./firebase');
const { EmbedBuilder } = require('discord.js');

const TARGET_RESULTS_CHANNEL = '1484010943657803976';
const LOGO_URL = 'https://raw.githubusercontent.com/mtctiers-new/mtctiers-new.github.io/main/assets/mtctiers.png';

const KITS = ['Emerald KB', 'Dragonhide KB', 'Dragonhide Anchor', 'Novelty Axe', 'Emerald', 'Manhunt', 'Diamond', 'Void'];
const DUMMY_NAMES = ['playerign', 'opponentign', 'username', 'testuser', 'playername'];

function parseManualResultText(text) {
  if (!text || typeof text !== 'string') return null;

  let matchedKit = null;
  for (const k of KITS) {
    if (new RegExp('\\b' + k.replace(/\s+/g, '\\s+') + '\\b', 'i').test(text)) {
      matchedKit = k;
      break;
    }
  }
  if (!matchedKit) {
    for (const k of KITS) {
      if (text.toLowerCase().includes(k.toLowerCase())) {
        matchedKit = k;
        break;
      }
    }
  }

  // Tested player & action & tier
  const actionRegex = /(?:@\S+\s*-\s*)?([a-zA-Z0-9_-]{2,20})\s+(failed|has been promoted to|promoted to|promoted|has been demoted to|demoted to|demoted)\s+([A-Z0-9]{2,5})/i;
  const mAction = text.match(actionRegex);

  if (!mAction) return null;

  const player = mAction[1].trim();
  if (DUMMY_NAMES.includes(player.toLowerCase())) return null;
  const rawOutcome = mAction[2].toLowerCase();
  const tier = mAction[3].toUpperCase();

  let outcome = 'promoted';
  if (rawOutcome.includes('failed')) outcome = 'failed';
  else if (rawOutcome.includes('demote')) outcome = 'demoted';

  // Fight record & opponent
  // e.g. "Lost 12-0 against @Game1K (Can't Tier Test BC HT1) - Game1K" or "Won 5-0 against @Coldhert - x9jm"
  const fightRegex = /(Won|Lost)\s+(\d+)-(\d+)\s+against\s+(?:@\S+.*?-\s*)?([a-zA-Z0-9_-]{2,20})/i;
  const mFight = text.match(fightRegex);

  let p1_score = 0;
  let p2_score = 0;
  let opponent = 'Opponent';
  let won = false;

  if (mFight) {
    const res = mFight[1].toLowerCase();
    won = res === 'won';
    const s1 = parseInt(mFight[2], 10) || 0;
    const s2 = parseInt(mFight[3], 10) || 0;
    opponent = mFight[4].trim();

    if (won) {
      p1_score = Math.max(s1, s2);
      p2_score = Math.min(s1, s2);
    } else {
      p1_score = Math.min(s1, s2);
      p2_score = Math.max(s1, s2);
    }
  }

  return {
    player,
    outcome,
    rawOutcome,
    tier,
    kit: matchedKit || 'Dragonhide KB',
    opponent,
    p1_score,
    p2_score,
    won,
    rawText: text
  };
}

async function processManualResult(parsed) {
  if (!parsed || !parsed.player) return null;

  const rankings = await db.getFullRankings();
  const kit = parsed.kit;
  const player = parsed.player;

  // 1. Update Kit Rankings if promoted or demoted
  if (parsed.outcome === 'promoted' || parsed.outcome === 'demoted') {
    if (!rankings[kit]) rankings[kit] = {};

    for (const t in rankings[kit]) {
      if (Array.isArray(rankings[kit][t])) {
        rankings[kit][t] = rankings[kit][t].filter(p => (typeof p === 'object' ? p.name : p || '').toString().toLowerCase() !== player.toLowerCase());
      }
    }

    if (!rankings[kit][parsed.tier]) rankings[kit][parsed.tier] = [];
    if (!rankings[kit][parsed.tier].includes(player)) {
      rankings[kit][parsed.tier].push(player);
    }

    db.recomputeOverallPoints(rankings);
    db.saveLocalRankings(rankings);
    await db.patchDoc('rankings', kit, rankings[kit]);
    await db.patchDoc('rankings', 'players_meta', { players: rankings.Players || [] });
  }

  // 2. Record Duel History for both players
  try {
    const timestamp = Date.now();
    const isoDate = new Date().toISOString().split('T')[0];

    const recordP1 = {
      timestamp,
      date: isoDate,
      kit: parsed.kit,
      outcome: parsed.outcome,
      player1: parsed.player,
      player2: parsed.opponent,
      player1_score: parsed.p1_score,
      player2_score: parsed.p2_score,
      winner: parsed.won ? parsed.player : parsed.opponent,
      result: parsed.won ? 'Won' : 'Lost',
      tier: parsed.tier,
      note: `${parsed.player} ${parsed.rawOutcome} ${parsed.tier} in ${parsed.kit}`
    };

    const recordP2 = {
      timestamp,
      date: isoDate,
      kit: parsed.kit,
      outcome: parsed.outcome,
      player1: parsed.player,
      player2: parsed.opponent,
      player1_score: parsed.p1_score,
      player2_score: parsed.p2_score,
      winner: parsed.won ? parsed.player : parsed.opponent,
      result: parsed.won ? 'Lost' : 'Won',
      tier: parsed.tier,
      note: `${parsed.player} ${parsed.rawOutcome} ${parsed.tier} in ${parsed.kit}`
    };

    // Patch P1
    const p1Doc = (await db.getDoc('duels', parsed.player)) || { player: parsed.player, duels: [] };
    let p1List = Array.isArray(p1Doc.duels) ? p1Doc.duels : [];
    p1List.unshift(recordP1);
    await db.patchDoc('duels', parsed.player, { player: parsed.player, duels: p1List, count: p1List.length });

    // Patch Opponent
    if (parsed.opponent && parsed.opponent !== 'Opponent') {
      const p2Doc = (await db.getDoc('duels', parsed.opponent)) || { player: parsed.opponent, duels: [] };
      let p2List = Array.isArray(p2Doc.duels) ? p2Doc.duels : [];
      p2List.unshift(recordP2);
      await db.patchDoc('duels', parsed.opponent, { player: parsed.opponent, duels: p2List, count: p2List.length });
    }
  } catch (e) {
    console.warn('Manual result duel patch note:', e.message);
  }

  return rankings;
}

function buildTestResultEmbed({ player, tester, region, prevRank, rankEarned, kit, score, proofUrl }) {
  const embed = new EmbedBuilder()
    .setAuthor({ name: `${player}'s Test Results 🏆`, iconURL: LOGO_URL })
    .addFields(
      { name: 'Tester:', value: tester ? `<@${tester}>` : 'Staff', inline: false },
      { name: 'Region:', value: `${region || 'NA'}`, inline: false },
      { name: 'Username:', value: `${player}`, inline: false },
      { name: 'Previous Rank:', value: `${prevRank || 'Unranked'}`, inline: false },
      { name: 'Rank Earned:', value: `${rankEarned || 'Tier Tested'}`, inline: false },
      { name: 'Kit:', value: `${kit}`, inline: false },
      { name: 'Score:', value: `${score || '5 - 0'}`, inline: false }
    )
    .setColor(0x00eeff)
    .setFooter({ text: 'MTCTiers Official System • mtctiers.com', iconURL: LOGO_URL })
    .setTimestamp();

  if (proofUrl) {
    embed.setImage(proofUrl);
  }

  return embed;
}

module.exports = {
  TARGET_RESULTS_CHANNEL,
  parseManualResultText,
  processManualResult,
  buildTestResultEmbed
};
