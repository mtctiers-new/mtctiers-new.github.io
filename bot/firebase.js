const fetch = globalThis.fetch || require('node-fetch');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const BASE_URL = `https://firestore.googleapis.com/v1/projects/${config.firebaseProjectId}/databases/(default)/documents`;

function pyToFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(pyToFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) fields[k] = pyToFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function firestoreValueToJs(fieldVal) {
  if (!fieldVal) return null;
  if ('stringValue' in fieldVal) return fieldVal.stringValue;
  if ('integerValue' in fieldVal) return parseInt(fieldVal.integerValue, 10);
  if ('doubleValue' in fieldVal) return parseFloat(fieldVal.doubleValue);
  if ('booleanValue' in fieldVal) return fieldVal.booleanValue;
  if ('arrayValue' in fieldVal) {
    return (fieldVal.arrayValue.values || []).map(firestoreValueToJs);
  }
  if ('mapValue' in fieldVal) {
    const obj = {};
    const fields = fieldVal.mapValue.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      obj[k] = firestoreValueToJs(v);
    }
    return obj;
  }
  return null;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const AbortControllerClass = globalThis.AbortController || require('abort-controller');
  const controller = new AbortControllerClass();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function getDoc(collection, docId) {
  try {
    const url = `${BASE_URL}/${collection}/${encodeURIComponent(docId)}`;
    const res = await fetchWithTimeout(url, {}, 15000);
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.fields) return null;
    
    const data = {};
    for (const [k, v] of Object.entries(json.fields)) {
      data[k] = firestoreValueToJs(v);
    }
    return data;
  } catch (err) {
    console.error(`Error getting doc ${collection}/${docId}:`, err.message);
    return null;
  }
}

async function patchDoc(collection, docId, fieldsDict) {
  try {
    const url = `${BASE_URL}/${collection}/${encodeURIComponent(docId)}`;
    const payload = { fields: {} };
    for (const [k, v] of Object.entries(fieldsDict)) {
      if (v !== undefined) payload.fields[k] = pyToFirestoreValue(v);
    }
    const res = await fetchWithTimeout(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, 15000);
    return res.ok;
  } catch (err) {
    console.error(`Error patching doc ${collection}/${docId}:`, err.message);
    return false;
  }
}

const RANKINGS_PATH = path.join(__dirname, '..', 'data', 'rankings.json');
const DUELS_PATH = path.join(__dirname, '..', 'data', 'duels.json');

function loadLocalRankings() {
  try {
    if (fs.existsSync(RANKINGS_PATH)) {
      return JSON.parse(fs.readFileSync(RANKINGS_PATH, 'utf8'));
    }
  } catch (e) {}
  return { Overall: {}, Players: [] };
}

function saveLocalRankings(data) {
  try {
    const dir = path.dirname(RANKINGS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(RANKINGS_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}
}

function loadLocalDuels() {
  try {
    if (fs.existsSync(DUELS_PATH)) {
      return JSON.parse(fs.readFileSync(DUELS_PATH, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function saveLocalDuels(data) {
  try {
    const dir = path.dirname(DUELS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DUELS_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}
}

function recomputeOverallPoints(rankingsData) {
  rankingsData.Overall = {};
  if (Array.isArray(rankingsData.Players)) {
    rankingsData.Players.forEach(p => {
      const name = typeof p === 'object' ? p.name : p;
      if (name && typeof name === 'string') rankingsData.Overall[name] = 0;
    });
  }

  for (const kit in rankingsData) {
    if (kit === 'Overall' || kit === 'Players' || kit === 'HallOfFame' || kit === 'Testers' || kit === 'all_data' || kit === 'main' || kit === 'players_meta' || kit === 'queue_state') continue;
    
    const kitData = (rankingsData[kit] && rankingsData[kit].tiers && typeof rankingsData[kit].tiers === 'object')
      ? rankingsData[kit].tiers
      : rankingsData[kit];

    if (!kitData || typeof kitData !== 'object') continue;

    for (const tier in kitData) {
      const cleanTier = tier.replace(/^R/, '').trim();
      const points = config.ptsPoints[cleanTier] || 0;
      if (Array.isArray(kitData[tier])) {
        kitData[tier].forEach(p => {
          const rawName = typeof p === 'object' ? p.name : p;
          const name = (rawName && typeof rawName === 'string') ? rawName.trim() : '';
          if (name) {
            rankingsData.Overall[name] = (rankingsData.Overall[name] || 0) + points;
          }
        });
      }
    }
  }
}

function getPlayerTitle(pts, rank) {
  if (pts >= 350 || rank === 1) return { title: "Combat Grandmaster", color: 0xffd700, icon: "👑" };
  if (pts >= 200 || rank <= 3) return { title: "Combat Master", color: 0xa855f7, icon: "⚔️" };
  if (pts >= 120 || rank <= 10) return { title: "Combat Ace", color: 0x00eeff, icon: "🔥" };
  if (pts >= 60) return { title: "Combat Specialist", color: 0xffaa00, icon: "🎯" };
  if (pts >= 20) return { title: "Combatant", color: 0x10b981, icon: "🛡️" };
  if (pts > 0) return { title: "Novice", color: 0x9ca3af, icon: "🔰" };
  return { title: "Unranked", color: 0x6b7280, icon: "" };
}

function unwrapKitTiers(obj) {
  if (!obj || typeof obj !== 'object') return {};
  let result = {};
  function recurse(o) {
    if (!o || typeof o !== 'object') return;
    for (let k in o) {
      if (k === 'tiers' && typeof o[k] === 'object') {
        recurse(o[k]);
      } else {
        if (!result[k]) result[k] = [];
        if (Array.isArray(o[k])) {
          o[k].forEach(item => {
            const valName = typeof item === 'object' ? item.name : item;
            if (valName && !result[k].includes(valName)) result[k].push(valName);
          });
        }
      }
    }
  }
  recurse(obj);
  return result;
}

async function getFullRankings() {
  try {
    const url = `${BASE_URL}/rankings?pageSize=100`;
    const res = await fetchWithTimeout(url, {}, 15000);
    if (!res.ok) return loadLocalRankings();
    const data = await res.json();
    const docs = data.documents || [];
    if (!docs.length) return loadLocalRankings();

    const rankingsData = { Overall: {}, Players: [] };

    docs.forEach(doc => {
      const docId = doc.name.split('/').pop();
      const fields = doc.fields || {};
      const docObj = {};
      for (const [k, v] of Object.entries(fields)) {
        docObj[k] = firestoreValueToJs(v);
      }
      if (docId === 'players_meta' || docId === 'Players') {
        rankingsData.Players = docObj.players || docObj.Players || [];
      } else if (['Overall', 'config', 'admin_guide', 'queue_state', 'all_data', 'main', 'whitelist'].includes(docId)) {
        // Exclude system metadata documents
      } else {
        rankingsData[docId] = unwrapKitTiers(docObj);
      }
    });

    recomputeOverallPoints(rankingsData);
    return rankingsData;
  } catch (err) {
    console.error("Error fetching full rankings from Firestore:", err.message);
    return loadLocalRankings();
  }
}

module.exports = {
  getDoc,
  patchDoc,
  getFullRankings,
  loadLocalRankings,
  saveLocalRankings,
  loadLocalDuels,
  saveLocalDuels,
  recomputeOverallPoints,
  getPlayerTitle,
  unwrapKitTiers
};
