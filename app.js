const firebaseConfig = {
  apiKey: "AIzaSyBJ7IHIiOB6UI7upD4tvFQ_-yUtgZq7oFw",
  authDomain: "mtctiers.firebaseapp.com",
  projectId: "mtctiers",
  storageBucket: "mtctiers.firebasestorage.app",
  messagingSenderId: "594002559405",
  appId: "1:594002559405:web:020451b3ac0fdcb090a124",
  measurementId: "G-6YFVGM26JH"
};

let db = null;
let auth = null;
let CURRENT_USER = null;
let IS_ADMIN = false;
let WHITELIST_EMAILS = ['admin@mtctiers.com', 'mtctiers@gmail.com', 'cicweb@gmail.com', 'game1k@mtctiers.com'];

const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/mtctiers/databases/(default)/documents';
const DISCORD_BOT_WRITE_MSG = 'Profile, duel, and whitelist changes go through the Discord bot. This site is read-only.';
let firestoreReadDenied = false;
let firestoreStatusToastShown = false;
let DATA_LOAD_ERROR = '';

try {
  if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    console.log("Firebase initialized successfully.");

    auth.onAuthStateChanged(async (user) => {
      CURRENT_USER = user;
      const loginBtn = document.getElementById('loginBtn');
      const userProfile = document.getElementById('userProfile');
      const userAvatar = document.getElementById('userAvatar');
      const userName = document.getElementById('userName');
      const adminTag = document.getElementById('adminTag');
      const adminDuelBtn = document.getElementById('adminDuelBtn');
      const mnav2fa = document.getElementById('mnav-2fa');

      if (user) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (userProfile) userProfile.style.display = 'flex';
        if (userAvatar) userAvatar.src = user.photoURL || 'assets/mtctiers_default_skin.png';
        if (userName) userName.innerText = user.displayName || user.email.split('@')[0];
        if (mnav2fa) mnav2fa.style.display = 'flex';

        await checkWhitelistStatus(user.email);

        const adminDashBtn = document.getElementById('adminDashBtn');

        if (IS_ADMIN) {
          if (adminTag) adminTag.style.display = 'inline-block';
          if (adminDuelBtn) adminDuelBtn.style.display = 'inline-flex';
          if (adminDashBtn) adminDashBtn.style.display = 'inline-flex';
        } else {
          if (adminTag) adminTag.style.display = 'none';
          if (adminDuelBtn) adminDuelBtn.style.display = 'none';
          if (adminDashBtn) adminDashBtn.style.display = 'none';
        }
      } else {
        IS_ADMIN = false;
        const adminDashBtn = document.getElementById('adminDashBtn');
        if (loginBtn) loginBtn.style.display = 'inline-flex';
        if (userProfile) userProfile.style.display = 'none';
        if (adminTag) adminTag.style.display = 'none';
        if (adminDuelBtn) adminDuelBtn.style.display = 'none';
        if (adminDashBtn) adminDashBtn.style.display = 'none';
        if (mnav2fa) mnav2fa.style.display = 'none';
        if (CURRENT_TAB === '2fa') switchTab('home');
      }
    });
  }
} catch (e) {
  console.warn("Firebase init note:", e.message);
}

let WHITELIST_ENTRIES = [
  { label: 'ziadn6b@gmail.com (Owner)', hash: 'd4a5b883a89d3c535ffb6bced51d56033b4d410fdd3fde242fae780bac7a4602', role: 'admin', assignedPlayer: '*' },
  { label: 'v4n1shedytoffical@gmail.com (Admin)', hash: 'de120db9844ffefef088609b949a32573699e2ab85ecbeb1482657ff5686632e', role: 'admin', assignedPlayer: '*' },
  { label: 'v41nshedytoffical@gmail.com (Admin)', hash: 'c0e9b169d9f8e920cdc57277caccbaa160e1e2b7d886952bb027b51330f5bb16', role: 'admin', assignedPlayer: '*' },
  { label: 'vorthexis (Admin)', hash: '3eef6721a50faedfaaefa7c075faa4fb604f6b59dbed9b147ac953051934b452', role: 'admin', assignedPlayer: 'vorthexis' },
  { label: 'v41nshed (Admin)', hash: 'b3339600b6cca216725b00048b34f873035b7e3c9d2f100ba33828adc045fa6f', role: 'admin', assignedPlayer: 'vorthexis' },
  { label: 'v4n1shed (Admin)', hash: '45fa8d30db1adfac35b83544615eb76462ea55c0ed65069d7b584ad72b42d165', role: 'admin', assignedPlayer: 'vorthexis' },
  { label: 'itzx9jm@gmail.com (Admin)', hash: 'c949aec5c7f3b20a7c5752fef10e2a9a5ee8be71a1100a37959f88a33a78aa62', role: 'admin', assignedPlayer: '*' }
];

let CURRENT_ROLE = null;
let CURRENT_ASSIGNED_PLAYER = '*';

async function sha256Hex(str) {
  const buf = new TextEncoder().encode(str.toLowerCase().trim());
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getFirebaseIdToken() {
  if (!auth || !auth.currentUser) return '';
  try {
    return await auth.currentUser.getIdToken();
  } catch (e) {
    return '';
  }
}

function describeFirestoreHttpError(status, context) {
  if (status === 429) {
    return `Firebase rate limited (HTTP 429) while ${context}.`;
  }
  if (status === 403 || status === 401) {
    return `Firebase denied ${context} (HTTP ${status}). Collection list is not public; individual rankings/kit documents are fetched directly. If those fail, the published data/*.json snapshot is shown.`;
  }
  return `Firebase error (HTTP ${status}) while ${context}.`;
}

function notifyFirestoreReadStatus(status, context) {
  console.warn(describeFirestoreHttpError(status, context));
  if (firestoreStatusToastShown) return;
  if (status === 429) {
    firestoreStatusToastShown = true;
    showToast('⚠️ Serving published snapshot (Firebase rate limited)');
  } else if (status === 403 || status === 401) {
    firestoreStatusToastShown = true;
    showToast('⚠️ Firestore list/doc denied (HTTP ' + status + '). Showing published snapshot.');
  }
}

async function firestoreRest(path, options = {}) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  const token = await getFirebaseIdToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const url = path.startsWith('http') ? path : `${FIRESTORE_BASE}/${String(path).replace(/^\//, '')}`;
  const fetchOpts = Object.assign({}, options, { headers });
  delete fetchOpts.headers;
  fetchOpts.headers = headers;
  return fetch(url, fetchOpts);
}

async function firestoreWriteDoc() {
  throw new Error(DISCORD_BOT_WRITE_MSG);
}

const EMAIL_TO_PLAYER = {
  'ziadn6b@gmail.com': 'ziadlive',
  'v4n1shedytoffical@gmail.com': 'vorthexis',
  'v41nshedytoffical@gmail.com': 'vorthexis',
  'itzx9jm@gmail.com': 'x9jm'
};

async function checkWhitelistStatus(email) {
  if (!email) {
    IS_ADMIN = false;
    CURRENT_ROLE = null;
    CURRENT_ASSIGNED_PLAYER = null;
    return;
  }
  const cleanEmail = email.toLowerCase().trim();
  const emailHash = await sha256Hex(cleanEmail);

  try {
    const fsRes = await firestoreRest('rankings/whitelist');
    if (fsRes.ok) {
      const doc = await fsRes.json();
      const rawEntriesStr = doc.fields?.entries?.stringValue;
      if (rawEntriesStr) {
        try {
          const parsed = JSON.parse(rawEntriesStr);
          if (Array.isArray(parsed) && parsed.length) {
            WHITELIST_ENTRIES = parsed;
          }
        } catch (e) {}
      }
    } else if (fsRes.status === 403 || fsRes.status === 401) {
      console.warn(describeFirestoreHttpError(fsRes.status, 'reading rankings/whitelist'));
    } else if (fsRes.status === 429) {
      notifyFirestoreReadStatus(429, 'reading rankings/whitelist');
    } else {
      console.warn(describeFirestoreHttpError(fsRes.status, 'reading rankings/whitelist'));
    }
  } catch (e) {
    console.warn("Whitelist fetch note:", e.message);
  }

  const matched = WHITELIST_ENTRIES.find(e => 
    e.hash === emailHash || 
    (e.email && e.email.toLowerCase().trim() === cleanEmail) ||
    (e.label && e.label.toLowerCase().trim() === cleanEmail)
  );

  if (matched) {
    CURRENT_ROLE = matched.role || 'player';
    IS_ADMIN = (CURRENT_ROLE === 'admin');
    CURRENT_ASSIGNED_PLAYER = IS_ADMIN ? '*' : (matched.assignedPlayer || EMAIL_TO_PLAYER[cleanEmail] || null);
  } else {
    IS_ADMIN = ['ziadn6b@gmail.com', 'v4n1shedytoffical@gmail.com', 'v41nshedytoffical@gmail.com'].includes(cleanEmail);
    CURRENT_ROLE = IS_ADMIN ? 'admin' : 'player';
    CURRENT_ASSIGNED_PLAYER = IS_ADMIN ? '*' : (EMAIL_TO_PLAYER[cleanEmail] || null);
  }
}

function isAuthorizedToEditProfile(targetPlayerName) {
  if (!CURRENT_USER) return false;
  if (IS_ADMIN === true) return true;
  if (!targetPlayerName || typeof targetPlayerName !== 'string') return false;

  const targetClean = targetPlayerName.toLowerCase().trim();

  // Match 1: Whitelisted Assigned Profile
  if (CURRENT_ASSIGNED_PLAYER && CURRENT_ASSIGNED_PLAYER !== '*') {
    if (CURRENT_ASSIGNED_PLAYER.toLowerCase().trim() === targetClean) return true;
  }

  // Match 2: Mapped Email
  const userEmail = (CURRENT_USER.email || '').toLowerCase().trim();
  if (userEmail && EMAIL_TO_PLAYER[userEmail]) {
    if (EMAIL_TO_PLAYER[userEmail].toLowerCase().trim() === targetClean) return true;
  }

  return false;
}

function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitizeSafeUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return '';
  const clean = urlStr.trim();
  if (/^https?:\/\/[^\s<>"'\\]+$/i.test(clean)) {
    return clean;
  }
  return '';
}

async function loginWithGoogle() {
  if (!auth) return alert("Firebase Auth SDK not initialized.");
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await auth.signInWithPopup(provider);
    showToast("✅ Authenticated via Google Auth!");
  } catch (e) {
    console.error("Google Auth error:", e.message);
    alert("Google Sign-In Error: " + (e.message || "Failed to authenticate with Google."));
  }
}

async function logoutUser() {
  IS_ADMIN = false;
  CURRENT_ROLE = null;
  CURRENT_ASSIGNED_PLAYER = null;
  CURRENT_USER = null;
  if (auth) {
    try { await auth.signOut(); } catch (e) {}
  }
  const loginBtn = document.getElementById('loginBtn');
  const userProfile = document.getElementById('userProfile');
  const adminTag = document.getElementById('adminTag');
  const adminDuelBtn = document.getElementById('adminDuelBtn');
  const adminDashBtn = document.getElementById('adminDashBtn');
  const nav2fa = document.getElementById('nav-2fa');
  const mnav2fa = document.getElementById('mnav-2fa');

  if (loginBtn) loginBtn.style.display = 'inline-flex';
  if (userProfile) userProfile.style.display = 'none';
  if (adminTag) adminTag.style.display = 'none';
  if (adminDuelBtn) adminDuelBtn.style.display = 'none';
  if (adminDashBtn) adminDashBtn.style.display = 'none';
  if (nav2fa) nav2fa.style.display = 'none';
  if (mnav2fa) mnav2fa.style.display = 'none';

  if (CURRENT_TAB === '2fa') switchTab('home');

  closeUserAccountMenu();
  showToast("Logged out");
}

/* 👤 USER ACCOUNT DROPDOWN MENU HANDLERS */
function getLoggedInPlayerName() {
  if (!CURRENT_USER) return null;
  const email = (CURRENT_USER.email || '').toLowerCase().trim();
  if (CURRENT_ASSIGNED_PLAYER && CURRENT_ASSIGNED_PLAYER !== '*') {
    return CURRENT_ASSIGNED_PLAYER;
  }
  if (EMAIL_TO_PLAYER[email]) {
    return EMAIL_TO_PLAYER[email];
  }
  if (CURRENT_USER.displayName) {
    const matched = Object.keys(DATA.Overall || {}).find(p => p.toLowerCase().trim() === CURRENT_USER.displayName.toLowerCase().trim());
    if (matched) return matched;
  }
  return CURRENT_USER.displayName || email.split('@')[0];
}

function toggleUserAccountMenu(e) {
  if (e) e.stopPropagation();
  const profileEl = document.getElementById('userProfile');
  const menuEl = document.getElementById('userAccountMenu');
  if (!menuEl) return;

  const isActive = menuEl.classList.contains('active');
  if (!isActive && CURRENT_USER) {
    const nameEl = document.getElementById('menuUserName');
    const emailEl = document.getElementById('menuUserEmail');
    const pName = getLoggedInPlayerName();
    if (nameEl) nameEl.innerText = pName || 'Player Account';
    if (emailEl) emailEl.innerText = CURRENT_USER.email || '';
    
    menuEl.classList.add('active');
    if (profileEl) profileEl.classList.add('menu-open');
  } else {
    menuEl.classList.remove('active');
    if (profileEl) profileEl.classList.remove('menu-open');
  }
}

function closeUserAccountMenu() {
  const profileEl = document.getElementById('userProfile');
  const menuEl = document.getElementById('userAccountMenu');
  if (menuEl) menuEl.classList.remove('active');
  if (profileEl) profileEl.classList.remove('menu-open');
}

document.addEventListener('click', (e) => {
  const userProfile = document.getElementById('userProfile');
  if (userProfile && !userProfile.contains(e.target)) {
    closeUserAccountMenu();
  }
});

function openMyPlayerProfile() {
  closeUserAccountMenu();
  const pName = getLoggedInPlayerName();
  if (pName) {
    openProfile(pName);
  } else {
    showToast("⚠️ Could not locate your player profile.");
  }
}

function openMyProfileCustomization() {
  closeUserAccountMenu();
  const pName = getLoggedInPlayerName();
  if (pName) {
    CURRENT_PLAYER = pName;
    openEditProfileModal();
  } else {
    showToast("⚠️ Could not locate your player profile.");
  }
}

function openMy2faSecurity() {
  closeUserAccountMenu();
  switchTab('2fa');
}

const AUTH_API = "https://mtc-backend-production-e0ab.up.railway.app/api";

const KIT_MAP = {
  "Overall":           { img: "",                              color: "var(--gold)"  },
  "Emerald":           { img: "assets/emerald.png",           color: "#10b981"      },
  "Emerald KB":        { img: "assets/emerald_kb.png",        color: "#00e5b0"      },
  "Dragonhide KB":     { img: "assets/dragonhide_kb.png",     color: "#ff6a00"      },
  "Manhunt":           { img: "assets/manhunt.png",           color: "#ff1a6b"      },
  "Diamond":           { img: "assets/diamond.png",           color: "#00c8ff"      },
  "Novelty Axe":       { img: "assets/novelty_axe.png",       color: "#ffaa00"      },
  "Dragonhide Anchor": { img: "assets/dragonhide_anchor.png", color: "#a855f7"      },
  "Void":              { img: "assets/void.png",              color: "#ff00ff"      }
};

const PTS_POINTS = {
  "HT1": 50, "LT1": 40, "HT2": 30, "LT2": 20, "HT3": 12, "LT3": 8, "HT4": 5, "LT4": 3, "HT5": 2, "LT5": 1
};

const REGION_MAP = {
  "NA": { label: "North America", color: "#3498db" },
  "EU": { label: "Europe", color: "#ef4444" },
  "SA": { label: "South America", color: "#10b981" },
  "AS": { label: "Asia", color: "#ff8800" },
  "OC": { label: "Oceania", color: "#a855f7" },
  "AF": { label: "Africa", color: "#eab308" }
};

const DEVICE_MAP = {
  "MK": { label: "Mouse & Keyboard", color: "#00eeff" },
  "MB": { label: "Mobile", color: "#ff7f50" },
  "CT": { label: "Controller", color: "#a855f7" },
  "TP": { label: "Trackpad", color: "#ec4899" }
};

function getPlayerTitle(pts, rank) {
  if (pts >= 350 || rank === 1) return { title: "Combat Grandmaster", color: "#ffd700", icon: "👑" };
  if (pts >= 200 || rank <= 3) return { title: "Combat Master", color: "#a855f7", icon: "⚔️" };
  if (pts >= 120 || rank <= 10) return { title: "Combat Ace", color: "#00eeff", icon: "🔥" };
  if (pts >= 60) return { title: "Combat Specialist", color: "#ffaa00", icon: "🎯" };
  if (pts >= 20) return { title: "Combatant", color: "#10b981", icon: "🛡️" };
  if (pts > 0) return { title: "Novice", color: "#9ca3af", icon: "🔰" };
  return { title: "Unranked", color: "#6b7280", icon: "" };
}

let DATA = { Overall: {}, Players: [] };
let CURRENT_TAB = 'dashboard';
let CURRENT_KIT = 'Overall';
let CURRENT_PLAYER = null;

function purgeDataCaches() {
  const cacheKeys = [
    'MTCTIERS_RANKINGS_CACHE_V2',
    'MTCTIERS_DUELS_CACHE_V2',
    'MTCTIERS_RANKINGS_CACHE',
    'MTCTIERS_DUELS_CACHE',
    'MTCTIERS_DATA_CACHE',
    'MTCTIERS_CACHE_V1'
  ];
  cacheKeys.forEach(k => localStorage.removeItem(k));
}

async function destroyCache() {
  purgeDataCaches();
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (let r of regs) await r.unregister();
    }
  } catch (e) { console.warn("Destroy cache note:", e.message); }

  showToast("💥 All Caches & Service Worker Storage Destroyed!");
  setTimeout(() => {
    window.location.reload(true);
  }, 500);
}

document.addEventListener('DOMContentLoaded', async () => {
  applyOfflineBanner(false);
  initMusicPlayer();
  checkAppInstalledState();
  await loadRankingsData();
  await handleUrlParamsOnLoad();
});

function parseFirestoreValue(fieldVal) {
  if (!fieldVal) return null;
  if ('stringValue' in fieldVal) return fieldVal.stringValue;
  if ('integerValue' in fieldVal) return parseInt(fieldVal.integerValue, 10);
  if ('doubleValue' in fieldVal) return parseFloat(fieldVal.doubleValue);
  if ('booleanValue' in fieldVal) return fieldVal.booleanValue;
  if ('arrayValue' in fieldVal) return (fieldVal.arrayValue?.values || []).map(parseFirestoreValue);
  if ('mapValue' in fieldVal) return parseFirestoreMap(fieldVal.mapValue?.fields || {});
  return null;
}

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

const KNOWN_ASSET_SKINS = new Set([
  'game1k', 'system1117', 'timmyloal', 'x9jm', 'ziadlive', 'vorthexis', 'farxd', 'rangee', 'sample'
]);

function getPlayerSkinSrc(name) {
  if (!name) return 'assets/mtctiers_default_skin.png';
  const cleanName = (typeof name === 'object' ? name.name : name || '').toString().toLowerCase().trim();
  
  const pDetail = (DATA.Players || []).find(p => (typeof p === 'object' ? p.name : p || '').toString().toLowerCase().trim() === cleanName) || {};
  if (pDetail.skinUrl && pDetail.skinUrl.trim()) {
    return pDetail.skinUrl.trim();
  }
  
  if (KNOWN_ASSET_SKINS.has(cleanName)) {
    return `assets/${cleanName}.png`;
  }

  return 'assets/mtctiers_default_skin.png';
}

function getPlayerMeta(name) {
  if (!name) return {};
  const clean = name.toLowerCase().trim();
  return (DATA.Players || []).find(p => (typeof p === 'object' ? p.name : p).toLowerCase().trim() === clean) || {};
}

function getPlayersInTier(tierData) {
  if (!tierData) return [];
  if (Array.isArray(tierData)) return tierData.map(p => (typeof p === 'object' ? p.name : p)).filter(Boolean);
  if (typeof tierData === 'object') {
    return Object.values(tierData).map(p => (typeof p === 'object' ? p.name : p)).filter(Boolean);
  }
  if (typeof tierData === 'string') return [tierData];
  return [];
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

function normalizeDataKits(dataObj) {
  if (!dataObj || typeof dataObj !== 'object') return dataObj;
  for (let kit in dataObj) {
    if (kit === 'Overall' || kit === 'Players' || kit === 'whitelist') continue;
    dataObj[kit] = unwrapKitTiers(dataObj[kit]);
  }
  return dataObj;
}

const RANKINGS_META_SKIP = ['Overall', 'Players', 'whitelist', 'all_data', 'queue_state', 'HallOfFame', 'Testers', 'main', 'players_meta', 'config', 'admin_guide'];

function countKitTierPlayers(dataObj) {
  if (!dataObj || typeof dataObj !== 'object') return 0;
  let count = 0;
  for (const kit in dataObj) {
    if (RANKINGS_META_SKIP.includes(kit)) continue;
    const kitData = unwrapKitTiers(dataObj[kit]);
    for (const tier in kitData) {
      if (Array.isArray(kitData[tier])) count += kitData[tier].length;
    }
  }
  return count;
}

function rankingsSnapshotLooksValid(dataObj) {
  if (!dataObj || typeof dataObj !== 'object') return false;
  const playerCount = Array.isArray(dataObj.Players) ? dataObj.Players.length : 0;
  const overallCount = dataObj.Overall && typeof dataObj.Overall === 'object'
    ? Object.keys(dataObj.Overall).length : 0;
  return (playerCount > 0 || overallCount > 0) && countKitTierPlayers(dataObj) > 0;
}

function hasAnyKitTierArrays() {
  return countKitTierPlayers(DATA) > 0;
}

function persistLastGoodRankings(dataObj) {
  if (!rankingsSnapshotLooksValid(dataObj)) return;
  try {
    localStorage.setItem('MTCTIERS_RANKINGS_CACHE_V2', JSON.stringify({ ts: Date.now(), data: dataObj }));
  } catch (e) {}
}

function readLastGoodRankings() {
  try {
    const cached = JSON.parse(localStorage.getItem('MTCTIERS_RANKINGS_CACHE_V2') || 'null');
    if (cached && rankingsSnapshotLooksValid(cached.data)) return cached.data;
  } catch (e) {}
  return null;
}

function applyRankingsPayload(dataObj) {
  DATA = dataObj;
  normalizeDataKits(DATA);
  computeOverallPoints();
  window.DATA = DATA;
  persistLastGoodRankings(DATA);
}

function rankingKitDocIds() {
  return Object.keys(KIT_MAP).filter(k => k !== 'Overall');
}

async function fetchLiveRankingsFromPublicDocs() {
  const next = { Overall: {}, Players: [] };
  let loadedKits = 0;
  let lastStatus = 0;
  let lastContext = '';
  let lastUrl = '';

  const docIds = ['players_meta'].concat(rankingKitDocIds());
  const results = await Promise.all(docIds.map(async (docId) => {
    const path = 'rankings/' + encodeURIComponent(docId);
    const res = await firestoreRest(path);
    return { docId, path, res };
  }));

  for (const { docId, path, res } of results) {
    const url = `${FIRESTORE_BASE}/${path}`;
    if (!res.ok) {
      lastStatus = res.status;
      lastContext = 'reading ' + path;
      lastUrl = url;
      continue;
    }
    const json = await res.json();
    const parsed = parseFirestoreMap(json.fields || {});
    if (docId === 'players_meta') {
      const rawPlayers = parsed.players;
      if (Array.isArray(rawPlayers) && rawPlayers.length) {
        next.Players = rawPlayers;
      }
    } else {
      next[docId] = unwrapKitTiers(parsed);
      loadedKits++;
    }
  }

  if (rankingsSnapshotLooksValid(next) && loadedKits > 0) {
    return { data: next };
  }
  return { data: null, status: lastStatus, context: lastContext, url: lastUrl };
}

async function fetchPublishedRankingsSnapshot() {
  const url = `/data/rankings.json?v=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    return { data: null, status: res.status, url };
  }
  const json = await res.json();
  if (!rankingsSnapshotLooksValid(json)) {
    return { data: null, status: res.status, url, reason: 'snapshot missing players or kit arrays' };
  }
  return { data: json };
}

async function loadRankingsData() {
  DATA_LOAD_ERROR = '';
  try {
    let applied = false;

    try {
      const live = await fetchLiveRankingsFromPublicDocs();
      if (live.data) {
        applyRankingsPayload(live.data);
        applied = true;
      } else if (live.status) {
        notifyFirestoreReadStatus(live.status, live.context || 'reading rankings documents');
        if (live.status !== 403 && live.status !== 401 && live.status !== 429) {
          DATA_LOAD_ERROR = `Live rankings failed: ${live.url || live.context} (HTTP ${live.status})`;
        }
      }
    } catch (e) {
      console.warn('Direct Firestore document load note:', e.message);
    }

    if (!applied) {
      try {
        const snap = await fetchPublishedRankingsSnapshot();
        if (snap.data) {
          applyRankingsPayload(snap.data);
          applied = true;
          if (!firestoreStatusToastShown) {
            firestoreStatusToastShown = true;
            showToast('⚠️ Showing published rankings snapshot.');
          }
        } else if (snap.status) {
          DATA_LOAD_ERROR = `Published snapshot failed: ${snap.url} (HTTP ${snap.status}${snap.reason ? ' — ' + snap.reason : ''})`;
        }
      } catch (e) {
        DATA_LOAD_ERROR = `Published snapshot request failed: /data/rankings.json (${e.message})`;
      }
    }

    if (!applied) {
      const cached = readLastGoodRankings();
      if (cached) {
        applyRankingsPayload(cached);
        applied = true;
        if (!firestoreStatusToastShown) {
          firestoreStatusToastShown = true;
          showToast('⚠️ Showing last saved rankings snapshot.');
        }
      }
    }

    if (!applied) {
      DATA = { Overall: {}, Players: [] };
      window.DATA = DATA;
      if (!DATA_LOAD_ERROR) {
        DATA_LOAD_ERROR = 'Could not load rankings from Firestore documents or /data/rankings.json.';
      }
    }

    renderCurrentTab();
  } catch (err) {
    console.error('Failed to load rankings data:', err);
    DATA_LOAD_ERROR = DATA_LOAD_ERROR || ('Failed to load rankings: ' + err.message);
    renderCurrentTab();
  }
}

function computeOverallPoints() {
  DATA.Overall = {};
  if (DATA.Players && Array.isArray(DATA.Players)) {
    DATA.Players.forEach(p => {
      const name = typeof p === 'object' ? p.name : p;
      if (name) DATA.Overall[name] = 0;
    });
  }
  for (let kit in DATA) {
    if (kit === "Overall" || kit === "Players") continue;
    for (let tier in DATA[kit]) {
      const cleanTier = tier.replace(/^R/, '').trim();
      const points = PTS_POINTS[cleanTier] || 0;
      const players = getPlayersInTier(DATA[kit][tier]);
      players.forEach(p => {
        const name = (p || '').toString().trim();
        if (name) {
          DATA.Overall[name] = (DATA.Overall[name] || 0) + points;
        }
      });
    }
  }
}

function isMobileDevice() {
  return window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function switchTab(tab, options) {
  if (tab === '2fa') {
    if (!CURRENT_USER) {
      showToast("🔒 2FA Authenticator requires login. Please sign in with Google!");
      switchTab('home');
      return;
    }
  }

  CURRENT_TAB = tab;
  document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.mobile-nav-item').forEach(m => m.classList.remove('active'));

  const navEl = document.getElementById('nav-' + tab);
  if (navEl) navEl.classList.add('active');

  const mnavEl = document.getElementById('mnav-' + tab);
  if (mnavEl) mnavEl.classList.add('active');

  const kitBar = document.getElementById('kitBar');
  const filterBar = document.getElementById('filterBar');
  const podiumWrap = document.getElementById('podiumWrap');
  const dashboardWrap = document.getElementById('dashboardWrap');

  if (tab === 'dashboard') {
    if (kitBar) kitBar.style.display = 'none';
    if (filterBar) filterBar.style.display = 'none';
    if (podiumWrap) { podiumWrap.style.display = 'none'; podiumWrap.innerHTML = ''; }
    if (dashboardWrap) dashboardWrap.style.display = 'flex';
  } else if (tab === 'home') {
    CURRENT_KIT = 'Overall';
    updateKitBarActive('Overall');
    if (kitBar) kitBar.style.display = 'flex';
    if (filterBar) filterBar.style.display = 'flex';
    if (podiumWrap) podiumWrap.style.display = 'flex';
    if (dashboardWrap) { dashboardWrap.style.display = 'none'; dashboardWrap.innerHTML = ''; }
  } else if (tab === 'rankings') {
    if (CURRENT_KIT === 'Overall') {
      CURRENT_KIT = 'Emerald';
    }
    updateKitBarActive(CURRENT_KIT);
    if (kitBar) kitBar.style.display = 'flex';
    if (filterBar) filterBar.style.display = 'flex';
    if (podiumWrap) { podiumWrap.style.display = 'none'; podiumWrap.innerHTML = ''; }
    if (dashboardWrap) { dashboardWrap.style.display = 'none'; dashboardWrap.innerHTML = ''; }
  } else {
    if (kitBar) kitBar.style.display = 'none';
    if (filterBar) filterBar.style.display = 'none';
    if (podiumWrap) { podiumWrap.style.display = 'none'; podiumWrap.innerHTML = ''; }
    if (dashboardWrap) { dashboardWrap.style.display = 'none'; dashboardWrap.innerHTML = ''; }
  }

  if (!(options && options.skipRender)) {
    renderCurrentTab();
  }
}

function updateKitBarActive(kitName) {
  document.querySelectorAll('.kit-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.kit === kitName);
  });
}

function renderCurrentTab() {
  const displayList = document.getElementById('displayList');
  const podiumWrap = document.getElementById('podiumWrap');

  if (CURRENT_TAB === 'dashboard') {
    renderDashboardView();
  } else if (CURRENT_TAB === 'home' || CURRENT_TAB === 'rankings') {
    if (CURRENT_KIT === 'Overall') {
      if (podiumWrap) podiumWrap.style.display = 'flex';
      renderOverallLeaderboard();
    } else if (CURRENT_KIT === 'All Kits') {
      if (podiumWrap) { podiumWrap.style.display = 'none'; podiumWrap.innerHTML = ''; }
      renderAllKitsVerticalView();
    } else {
      if (podiumWrap) { podiumWrap.style.display = 'none'; podiumWrap.innerHTML = ''; }
      renderKitView(CURRENT_KIT);
    }
  } else if (CURRENT_TAB === 'rules') {
    if (podiumWrap) { podiumWrap.style.display = 'none'; podiumWrap.innerHTML = ''; }
    renderRulesView();
  } else if (CURRENT_TAB === 'hof') {
    if (podiumWrap) { podiumWrap.style.display = 'none'; podiumWrap.innerHTML = ''; }
    renderHofView();
  } else if (CURRENT_TAB === 'testers') {
    if (podiumWrap) { podiumWrap.style.display = 'none'; podiumWrap.innerHTML = ''; }
    renderTestersView();
  } else if (CURRENT_TAB === 'duels') {
    if (podiumWrap) { podiumWrap.style.display = 'none'; podiumWrap.innerHTML = ''; }
    renderDuelsView();
  } else if (CURRENT_TAB === '2fa') {
    if (podiumWrap) { podiumWrap.style.display = 'none'; podiumWrap.innerHTML = ''; }
    render2faView();
  }
}

function renderOverallLeaderboard() {
  const podiumWrap = document.getElementById('podiumWrap');
  const displayList = document.getElementById('displayList');

  const sortedPlayers = Object.entries(DATA.Overall)
    .sort((a, b) => b[1] - a[1])
    .filter(([name]) => filterPlayerVisible(name));

  const top3 = sortedPlayers.slice(0, 3);
  let podiumHtml = '';
  top3.forEach(([name, pts], idx) => {
    const rank = idx + 1;
    const skinPath = getPlayerSkinSrc(name);

    podiumHtml += `
      <div class="podium-card rank-${rank}" onclick="openProfile('${name}')">
        <span class="podium-rank-badge">#${rank}</span>
        <div class="podium-avatar-wrap">
          <img src="${skinPath}" alt="${name}" class="podium-avatar" onerror="this.src='assets/mtctiers_default_skin.png'">
        </div>
        <div class="podium-name">${name}</div>
        <div class="podium-pts">${pts} PTS</div>
      </div>
    `;
  });
  podiumWrap.innerHTML = podiumHtml;

  let tableHtml = `
    <div class="overall-list-wrap">
      <div class="overall-header">
        <div>Rank</div>
        <div>Player</div>
        <div>Score</div>
        <div>Kits Tiered</div>
      </div>
  `;

  sortedPlayers.forEach(([name, pts], index) => {
    const rank = index + 1;
    const skinPath = getPlayerSkinSrc(name);
    const kitsBadges = getPlayerKitBadges(name);

    tableHtml += `
      <div class="overall-row" onclick="openProfile('${name}')">
        <div class="ol-rank">#${rank}</div>
        <div class="ol-player">
          <img src="${skinPath}" class="ol-avatar" onerror="this.src='assets/mtctiers_default_skin.png'">
          <span class="ol-name">${name}</span>
        </div>
        <div class="ol-pts">${pts}</div>
        <div class="ol-kits">${kitsBadges}</div>
      </div>
    `;
  });

  tableHtml += `</div>`;
  displayList.innerHTML = tableHtml;
}

function isPlayerActive(name) {
  const cleanName = (name || '').toLowerCase().trim();
  for (let k in DATA) {
    if (k === 'Overall' || k === 'Players' || k === 'whitelist') continue;
    if (!DATA[k] || typeof DATA[k] !== 'object') continue;
    for (let t in DATA[k]) {
      if (!t.startsWith('R') && isPlayerInTier(DATA[k][t], cleanName)) {
        return true;
      }
    }
  }
  return false;
}

function isPlayerRetired(name) {
  const cleanName = (name || '').toLowerCase().trim();
  let hasTiers = false;
  let hasActive = false;
  for (let k in DATA) {
    if (k === 'Overall' || k === 'Players' || k === 'whitelist') continue;
    if (!DATA[k] || typeof DATA[k] !== 'object') continue;
    for (let t in DATA[k]) {
      if (isPlayerInTier(DATA[k][t], cleanName)) {
        hasTiers = true;
        if (!t.startsWith('R')) hasActive = true;
      }
    }
  }
  return hasTiers && !hasActive;
}

function filterPlayerVisible(playerName) {
  const regionFilter = document.getElementById('filterRegion') ? document.getElementById('filterRegion').value : '';
  const deviceFilter = document.getElementById('filterDevice') ? document.getElementById('filterDevice').value : '';
  const retiredFilter = document.getElementById('filterRetired') ? document.getElementById('filterRetired').value : 'all';

  const playerMeta = getPlayerMeta(playerName);

  if (regionFilter && (playerMeta.region || '').toUpperCase() !== regionFilter.toUpperCase()) {
    return false;
  }
  if (deviceFilter && (playerMeta.device || '').toUpperCase() !== deviceFilter.toUpperCase()) {
    return false;
  }

  if (!hasAnyKitTierArrays()) return true;

  if (retiredFilter === 'active') {
    if (!isPlayerActive(playerName)) return false;
  } else if (retiredFilter === 'retired') {
    if (!isPlayerRetired(playerName)) return false;
  }

  return true;
}

function applyFilters() {
  renderCurrentTab();
}

function resetFilters() {
  if (document.getElementById('filterRegion')) document.getElementById('filterRegion').value = '';
  if (document.getElementById('filterDevice')) document.getElementById('filterDevice').value = '';
  if (document.getElementById('filterRetired')) document.getElementById('filterRetired').value = 'all';
  renderCurrentTab();
}

function getKitVerticalTierHtml(kitName) {
  const kitData = DATA[kitName];
  if (!kitData) return '<div style="text-align:center;padding:20px;color:var(--text-muted);font-family:var(--font-heading);">No evaluations for this kit</div>';

  const tierOrder = ['HT1', 'LT1', 'HT2', 'LT2', 'HT3', 'LT3', 'HT4', 'LT4', 'HT5', 'LT5', 'RHT1', 'RLT1', 'RHT2', 'RLT2', 'RHT3', 'RLT3', 'RHT4', 'RLT4', 'RHT5', 'RLT5'];
  const retiredFilter = document.getElementById('filterRetired') ? document.getElementById('filterRetired').value : '';

  let html = `<div class="vertical-tier-container">`;
  let totalCount = 0;

  tierOrder.forEach(tier => {
    if (!kitData[tier]) return;

    const isRetired = tier.startsWith('R');
    if (retiredFilter === 'active' && isRetired) return;
    if (retiredFilter === 'retired' && !isRetired) return;

    const rawPlayers = getPlayersInTier(kitData[tier]);
    const visiblePlayers = rawPlayers.filter(player => filterPlayerVisible(player));
    if (!visiblePlayers.length) return;

    totalCount += visiblePlayers.length;

    const cleanTierName = isRetired ? tier.slice(1) : tier;
    const tierNum = cleanTierName.slice(-1);
    const tierClass = isRetired ? 'tier-retired' : `tier-t${tierNum}`;
    const displayBadgeText = isRetired ? `RET ${cleanTierName}` : tier;

    html += `
      <div class="vertical-tier-section">
        <div class="vertical-tier-badge-box ${tierClass}">
          <span>${displayBadgeText}</span>
          <span class="tier-count">${visiblePlayers.length} ${visiblePlayers.length === 1 ? 'PLAYER' : 'PLAYERS'}</span>
        </div>
        <div class="vertical-tier-cards-wrap">
    `;

    visiblePlayers.forEach(player => {
      const skinPath = getPlayerSkinSrc(player);
      const tierLabel = isRetired ? 'Retired ' + cleanTierName : tier;

      html += `
        <div class="tier-card" onclick="openProfile('${player}')">
          <img src="${skinPath}" class="tier-card-avatar" onerror="this.src='assets/mtctiers_default_skin.png'">
          <div class="tier-card-info">
            <div class="tier-card-name">${player}</div>
            <div class="tier-card-badge">${tierLabel}</div>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  html += `</div>`;
  if (totalCount === 0) return '<div style="text-align:center;padding:30px;color:var(--text-muted);font-family:var(--font-heading);">No players match the current filters</div>';
  return html;
}

function renderKitView(kitName) {
  const podiumWrap = document.getElementById('podiumWrap');
  podiumWrap.innerHTML = '';

  const displayList = document.getElementById('displayList');
  displayList.innerHTML = getKitVerticalTierHtml(kitName);
}

function renderAllKitsVerticalView() {
  const podiumWrap = document.getElementById('podiumWrap');
  podiumWrap.innerHTML = '';

  const displayList = document.getElementById('displayList');
  let html = `<div style="display:flex;flex-direction:column;gap:36px;">`;

  const kits = Object.keys(KIT_MAP).filter(k => k !== 'Overall' && k !== 'All Kits');

  kits.forEach(kitName => {
    const kitConfig = KIT_MAP[kitName];
    const tierHtml = getKitVerticalTierHtml(kitName);

    html += `
      <div class="kit-vertical-block">
        <div class="kit-vertical-header" style="--kit-color: ${kitConfig.color};">
          ${kitConfig.img ? `<img src="${kitConfig.img}" onerror="this.style.display='none'">` : ''}
          <span>${kitName.toUpperCase()} TIERS</span>
        </div>
        ${tierHtml}
      </div>
    `;
  });

  html += `</div>`;
  displayList.innerHTML = html;
}

async function renderHofView() {
  const displayList = document.getElementById('displayList');
  try {
    const res = await fetch(`data/hof.json?v=${Date.now()}`);
    const data = await res.json();
    let html = `<div class="hof-grid">`;
    data.forEach(item => {
      const skinPath = getPlayerSkinSrc(item.name);
      html += `
        <div class="hof-card" onclick="openProfile('${item.name}')">
          <div class="hof-card-header">
            <div class="hof-avatar-box">
              <img src="${skinPath}" class="hof-avatar" onerror="this.src='assets/steve.png'">
            </div>
            <div class="hof-meta">
              <div class="hof-name">${item.name}</div>
              <span class="hof-badge">👑 HALL OF FAME</span>
            </div>
          </div>
          <div class="hof-desc">${item.description || 'Legendary MultiCraft competitor.'}</div>
        </div>
      `;
    });
    html += `</div>`;
    displayList.innerHTML = html;
  } catch (e) { console.error(e); }
}

async function renderTestersView() {
  const displayList = document.getElementById('displayList');
  try {
    const res = await fetch(`data/testers.json?v=${Date.now()}`);
    const data = await res.json();
    let html = `<div class="tier-grid">`;
    data.forEach(item => {
      const skinPath = getPlayerSkinSrc(item.name);
      html += `
        <div class="tier-card" onclick="openProfile('${item.name}')">
          <img src="${skinPath}" class="tier-card-avatar" onerror="this.src='assets/steve.png'">
          <div class="tier-card-info">
            <div class="tier-card-name" style="color:var(--purple);">${item.name}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);">${item.discord ? 'Discord: ' + item.discord : ''}</div>
          </div>
        </div>
      `;
    });
    html += `</div>`;
    displayList.innerHTML = html;
  } catch (e) { console.error(e); }
}

function duelPerspective(d, playerName) {
  const cleanTarget = (playerName || '').toLowerCase().trim();
  const cleanP1 = (d.player1 || '').toLowerCase().trim();
  const cleanP2 = (d.player2 || '').toLowerCase().trim();
  const isP1 = cleanP1 === cleanTarget;
  const isP2 = cleanP2 === cleanTarget;

  let winnerName = (d.winner || '').trim();
  if (!winnerName) {
    const s1 = parseInt(d.player1_score, 10) || 0;
    const s2 = parseInt(d.player2_score, 10) || 0;
    if (s1 > s2) winnerName = d.player1;
    else if (s2 > s1) winnerName = d.player2;
    else winnerName = d.result === 'Won' ? (isP1 ? d.player1 : d.player2) : (isP1 ? d.player2 : d.player1);
  }

  const won = winnerName.toLowerCase().trim() === cleanTarget;
  const myScore = isP1 ? d.player1_score : d.player2_score;
  const oppScore = isP1 ? d.player2_score : d.player1_score;
  const opponent = isP1 ? d.player2 : (isP2 ? d.player1 : (d.player1 || 'Opponent'));

  return { won, myScore, oppScore, opponent, isP1, winnerName };
}

function duelDescLine(d, playerName) {
  if (d.note && typeof d.note === 'string' && d.note.trim()) {
    return d.note.trim();
  }
  const kit = (!d.kit || d.kit === 'Unknown') ? '' : d.kit;
  const tier = (!d.tier || d.tier === 'Unknown') ? '' : d.tier;
  const rawOc = (d.outcome || '').trim();

  let winnerName = (d.winner || '').trim();
  let loserName = '';
  if (d.player1 && d.player2) {
    if (winnerName.toLowerCase() === d.player1.toLowerCase()) loserName = d.player2;
    else if (winnerName.toLowerCase() === d.player2.toLowerCase()) loserName = d.player1;
  }
  if (!winnerName) {
    const s1 = parseInt(d.player1_score, 10) || 0;
    const s2 = parseInt(d.player2_score, 10) || 0;
    if (s1 > s2) { winnerName = d.player1; loserName = d.player2; }
    else if (s2 > s1) { winnerName = d.player2; loserName = d.player1; }
  }

  if (rawOc) {
    const lowerOc = rawOc.toLowerCase();
    if (lowerOc.includes('promoted')) {
      const targetTier = tier || (rawOc.match(/ht\d|lt\d|rht\d|rlt\d/i) || [''])[0].toUpperCase();
      return `${winnerName || 'Winner'} has been promoted${targetTier ? ' to ' + targetTier : ''}${kit ? ' in ' + kit : ''}`;
    }
    if (lowerOc.includes('demoted')) {
      const targetTier = tier || (rawOc.match(/ht\d|lt\d|rht\d|rlt\d/i) || [''])[0].toUpperCase();
      const demotedSubject = loserName || d.player1 || 'Player';
      return `${demotedSubject} has been demoted${targetTier ? ' to ' + targetTier : ''}${kit ? ' in ' + kit : ''}`;
    }
    if (lowerOc.includes('failed')) {
      const failedSubject = loserName || d.player1 || 'Player';
      return `${failedSubject} failed${tier ? ' ' + tier : ''}${kit ? ' in ' + kit : ''}`;
    }
    return rawOc;
  }

  return `${kit}${tier ? ' · ' + tier : ''}`.trim();
}

function parseFirestoreMap(fields) {
  if (!fields || typeof fields !== 'object') return {};
  const d = {};
  for (let k in fields) {
    const valObj = fields[k];
    if (!valObj || typeof valObj !== 'object') continue;

    if (valObj.stringValue !== undefined) d[k] = valObj.stringValue;
    else if (valObj.integerValue !== undefined) d[k] = parseInt(valObj.integerValue, 10);
    else if (valObj.doubleValue !== undefined) d[k] = valObj.doubleValue;
    else if (valObj.booleanValue !== undefined) d[k] = valObj.booleanValue;
    else if (valObj.timestampValue !== undefined) d[k] = valObj.timestampValue;
    else if (valObj.nullValue !== undefined) d[k] = null;
    else if (valObj.arrayValue !== undefined) {
      d[k] = (valObj.arrayValue.values || []).map(item => parseFirestoreMapVal(item));
    }
    else if (valObj.mapValue !== undefined) d[k] = parseFirestoreMap(valObj.mapValue.fields || {});
    else d[k] = Object.values(valObj)[0];
  }
  return d;
}

function parseFirestoreMapVal(item) {
  if (!item || typeof item !== 'object') return item;
  if (item.stringValue !== undefined) return item.stringValue;
  if (item.integerValue !== undefined) return parseInt(item.integerValue, 10);
  if (item.doubleValue !== undefined) return item.doubleValue;
  if (item.booleanValue !== undefined) return item.booleanValue;
  if (item.timestampValue !== undefined) return item.timestampValue;
  if (item.nullValue !== undefined) return null;
  if (item.mapValue) return parseFirestoreMap(item.mapValue.fields || {});
  if (item.arrayValue) return (item.arrayValue.values || []).map(parseFirestoreMapVal);
  return Object.values(item)[0];
}

function toPositiveInt(val) {
  if (typeof val === 'number') {
    return Number.isInteger(val) && val > 0 && Number.isSafeInteger(val) ? val : null;
  }
  if (typeof val === 'string') {
    const s = val.trim();
    if (!/^[1-9]\d{0,8}$/.test(s)) return null;
    return parseInt(s, 10);
  }
  return null;
}

function getDuelIntegerId(d) {
  if (!d || typeof d !== 'object') return null;
  const fromNumber = toPositiveInt(d.duel_number);
  if (fromNumber) return fromNumber;
  if (d.message_id && d.duel_number == null) return null;
  return toPositiveInt(d.id);
}

let MAX_DUEL_INTEGER_ID = 364;

function noteDuelIntegerId(n) {
  if (n && n > MAX_DUEL_INTEGER_ID) MAX_DUEL_INTEGER_ID = n;
}

async function allocateNextDuelIntegerId() {
  if (db) {
    try {
      const meta = await db.collection('duels').doc('all_duels').get();
      const fromMeta = meta.exists ? toPositiveInt(meta.data().total_count) : null;
      if (fromMeta) noteDuelIntegerId(fromMeta);
    } catch (e) {
      console.warn('all_duels total_count read note:', e.message);
    }
  }
  for (const v of DUELS_REGISTRY.values()) {
    noteDuelIntegerId(getDuelIntegerId(v));
  }
  try {
    const cached = JSON.parse(localStorage.getItem('MTCTIERS_DUELS_CACHE_V2') || 'null');
    if (cached && Array.isArray(cached.duels)) {
      cached.duels.forEach(d => noteDuelIntegerId(getDuelIntegerId(d)));
    }
  } catch (e) {}
  return MAX_DUEL_INTEGER_ID + 1;
}

function dedupeAndSortDuels(duels) {
  const map = new Map();
  duels.forEach(d => {
    const id = getDuelIntegerId(d);
    if (!id) return;
    noteDuelIntegerId(id);
    const existing = map.get(id);
    if (!existing) {
      map.set(id, d);
      return;
    }
    if (toPositiveInt(existing.duel_number) == null && toPositiveInt(d.duel_number) != null) {
      map.set(id, d);
    }
  });
  return Array.from(map.values()).sort((a, b) => getDuelIntegerId(b) - getDuelIntegerId(a));
}

function collectDuelsFromPayload(payload, into) {
  if (!payload) return;
  if (Array.isArray(payload)) {
    into.push(...payload);
  } else if (Array.isArray(payload.duels)) {
    into.push(...payload.duels);
  } else if (typeof payload === 'object') {
    Object.values(payload).forEach(val => {
      if (Array.isArray(val)) into.push(...val);
      else if (val && Array.isArray(val.duels)) into.push(...val.duels);
    });
  }
}

async function fetchDuelsFromFirestore(playerFilter) {
  let allDuels = [];
  const now = Date.now();
  const cachedDuelsStr = localStorage.getItem('MTCTIERS_DUELS_CACHE_V2');
  let cachedDuelsObj = null;

  if (cachedDuelsStr) {
    try { cachedDuelsObj = JSON.parse(cachedDuelsStr); } catch (e) {}
  }

  // 1. Firestore (authenticated when possible). Unauthenticated list is 403 — do not treat as success.
  if (!firestoreReadDenied) {
    try {
      const res = await firestoreRest('duels?pageSize=300');
      if (res.status === 429) {
        notifyFirestoreReadStatus(429, 'reading duels');
      } else if (res.status === 403 || res.status === 401) {
        notifyFirestoreReadStatus(res.status, 'reading duels');
      } else if (res.ok) {
        const data = await res.json();
        const docs = data.documents || [];
        docs.forEach(doc => {
          const rawDuels = doc.fields?.duels?.arrayValue?.values || [];
          rawDuels.forEach(item => {
            allDuels.push(parseFirestoreMap(item.mapValue?.fields || {}));
          });
        });
      } else {
        notifyFirestoreReadStatus(res.status, 'reading duels');
      }
    } catch (e) { console.warn("Firestore REST duels note:", e.message); }
  }

  // 2. Existing Railway AUTH_API — live duels when Firestore is not publicly readable.
  try {
    const url = playerFilter
      ? `${AUTH_API}/duels?player=${encodeURIComponent(playerFilter)}&limit=200`
      : `${AUTH_API}/duels?limit=200`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      collectDuelsFromPayload(data, allDuels);
    } else {
      console.warn('AUTH_API duels HTTP', res.status);
    }
  } catch (e) { console.warn("AUTH_API duels note:", e.message); }

  // 3. Published snapshot (bot → data/duels.json)
  try {
    const res = await fetch(`data/duels.json?v=${now}`);
    if (res.ok) {
      collectDuelsFromPayload(await res.json(), allDuels);
    }
  } catch (e) { console.warn("Local duels.json fetch note:", e.message); }

  if (cachedDuelsObj && Array.isArray(cachedDuelsObj.duels)) {
    allDuels.push(...cachedDuelsObj.duels);
  }

  const combined = dedupeAndSortDuels(allDuels);
  try {
    localStorage.setItem('MTCTIERS_DUELS_CACHE_V2', JSON.stringify({ ts: now, duels: combined }));
  } catch (e) {}

  if (playerFilter) {
    const cleanP = playerFilter.toLowerCase().trim();
    return combined.filter(d =>
      (d.player1 && d.player1.toLowerCase().trim() === cleanP) ||
      (d.player2 && d.player2.toLowerCase().trim() === cleanP)
    );
  }

  return combined;
}

async function renderDuelsView(playerFilter) {
  const podiumWrap = document.getElementById('podiumWrap');
  podiumWrap.innerHTML = '';
  const displayList = document.getElementById('displayList');
  displayList.innerHTML = `<div style="text-align:center;padding:40px;color:var(--cyan);font-family:var(--font-heading);font-weight:700;">Loading Duels...</div>`;

  try {
    let duels = await fetchDuelsFromFirestore(playerFilter);

    if (!duels || !duels.length) {
      const url = playerFilter
        ? `${AUTH_API}/duels?player=${encodeURIComponent(playerFilter)}&limit=50`
        : `${AUTH_API}/duels?limit=200`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        duels = data.duels || [];
      }
    }

    duels = (duels || []).filter(d => getDuelIntegerId(d));

    if (!duels.length) {
      displayList.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted);font-family:var(--font-heading);">No duels found</div>`;
      return;
    }

    let html = `
      <div class="duel-tab-header">
        <span class="duel-tab-title">${playerFilter ? playerFilter + "'S DUELS" : 'DUEL HISTORY'}</span>
        <span class="duel-tab-count">${duels.length} DUELS</span>
      </div>
      <div class="duel-list">
    `;

    DUELS_REGISTRY.clear();
    duels.forEach((d) => {
      const duelNum = getDuelIntegerId(d);
      if (!duelNum) return;
      DUELS_REGISTRY.set(duelNum, d);
      DUELS_REGISTRY.set(String(duelNum), d);

      const perspective = playerFilter || d.player1;
      const info = duelPerspective(d, perspective);
      const date = new Date(d.timestamp || d.created_at * 1000 || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const desc = duelDescLine(d, perspective);

      html += `
        <div class="duel-row ${info.won ? 'won' : 'lost'}" onclick="openDuelPopupById('${duelNum}', '${perspective}')">
          <div class="duel-row-top">
            <div class="duel-names">
              <span class="duel-num-tag">#${duelNum}</span>
              <span class="duel-p1" onclick="event.stopPropagation();openProfile('${perspective}')">${perspective}</span>
              <span class="duel-vs">vs</span>
              <span class="duel-p2" onclick="event.stopPropagation();openProfile('${info.opponent}')">${info.opponent}</span>
            </div>
            <span class="duel-score ${info.won ? 'won' : 'lost'}">${info.myScore}-${info.oppScore}</span>
          </div>
          <div class="duel-row-bottom">
            <span class="duel-desc">${desc}</span>
            <span class="duel-date">${date}</span>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    displayList.innerHTML = html;
  } catch (e) {
    displayList.innerHTML = `<div style="text-align:center;padding:40px;color:var(--crimson);font-family:var(--font-heading);">Could not load duels</div>`;
  }
}

async function renderProfileDuels(playerName) {
  document.querySelectorAll('.profile-duel-section').forEach(el => el.remove());
  const bioCard = document.querySelector('.player-bio-card');

  try {
    let duels = await fetchDuelsFromFirestore(playerName);

    if (!duels || !duels.length) {
      const res = await fetch(`${AUTH_API}/duels?player=${encodeURIComponent(playerName)}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        duels = data.duels || [];
      }
    }

    let wins = 0;
    let losses = 0;
    if (duels && Array.isArray(duels)) {
      duels.forEach(d => {
        const info = duelPerspective(d, playerName);
        if (info.won) wins++;
        else losses++;
      });
    }

    const pWLEl = document.getElementById('pWL');
    if (pWLEl) {
      pWLEl.innerText = `${wins}W / ${losses}L`;
    }

    if (!bioCard || !duels || !duels.length) return;

    const d = duels[0];
    const duelId = getDuelIntegerId(d);
    if (duelId) {
      DUELS_REGISTRY.set(duelId, d);
      DUELS_REGISTRY.set(String(duelId), d);
    }

    const info = duelPerspective(d, playerName);
    const date = new Date(d.timestamp || d.created_at * 1000 || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const desc = duelDescLine(d, playerName);

    const section = document.createElement('div');
    section.className = 'profile-duel-section';
    section.innerHTML = `
      <div class="profile-duel-header">
        <span class="profile-duel-label-text">LATEST DUEL</span>
        <span class="profile-duel-viewall" onclick="closeProfileModal();switchTab('duels');renderDuelsView('${playerName}')">VIEW ALL ▶</span>
      </div>
      <div class="profile-duel-card" onclick="${duelId ? `openDuelPopupById('${duelId}', '${playerName}')` : ''}">
        <div class="profile-duel-top">
          <div class="profile-duel-names">${playerName} <span>vs</span> ${info.opponent}</div>
          <div class="profile-duel-score-text" style="color: ${info.won ? 'var(--emerald)' : 'var(--crimson)'};">${info.myScore}-${info.oppScore}</div>
        </div>
        <div class="profile-duel-bottom">${desc} · ${date}</div>
      </div>
    `;

    bioCard.insertAdjacentElement('afterend', section);
  } catch (e) {
    console.warn("Duel history fetch note:", e.message);
  }
}

function selectKit(kit) {
  CURRENT_KIT = kit;
  updateKitBarActive(kit);
  if (kit === 'Overall') {
    CURRENT_TAB = 'home';
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
    const navEl = document.getElementById('nav-home');
    if (navEl) navEl.classList.add('active');
  } else {
    CURRENT_TAB = 'rankings';
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
    const navEl = document.getElementById('nav-rankings');
    if (navEl) navEl.classList.add('active');
  }
  renderCurrentTab();
}

function resolvePlayerName(raw) {
  if (!raw) return null;
  let clean = String(raw);
  try { clean = decodeURIComponent(clean); } catch (e) {}
  clean = clean.replace(/\+/g, ' ').trim();
  if (!clean) return null;
  const keys = Object.keys(DATA.Overall || {});
  const exact = keys.find(p => p === clean);
  if (exact) return exact;
  const lower = clean.toLowerCase();
  const ci = keys.find(p => p.toLowerCase() === lower);
  return ci || clean;
}

function siteShareBase() {
  return `${window.location.origin}/`;
}

async function openProfile(name) {
  name = resolvePlayerName(name) || name;
  CURRENT_PLAYER = name;
  const overlay = document.getElementById('profileModalOverlay');
  const modal = document.getElementById('profileModal');

  const skinImg = document.getElementById('pSkinImg');
  skinImg.src = getPlayerSkinSrc(name);
  skinImg.onerror = function() { this.src = 'assets/mtctiers_default_skin.png'; this.style.opacity = '1'; };

  document.getElementById('pName').innerText = name;

  const sortedOverall = Object.entries(DATA.Overall).sort((a, b) => b[1] - a[1]);
  const rankIndex = sortedOverall.findIndex(([p]) => p.toLowerCase() === name.toLowerCase());
  const overallKey = rankIndex !== -1 ? sortedOverall[rankIndex][0] : name;
  const targetPts = DATA.Overall[overallKey] || DATA.Overall[name] || 0;
  const rankNum = rankIndex !== -1 ? rankIndex + 1 : 999;
  const tInfo = getPlayerTitle(targetPts, rankNum);

  const pRankEl = document.getElementById('pRank');
  pRankEl.innerText = rankIndex !== -1 ? `#${rankNum} OVERALL` : `UNRANKED`;

  const pTitleEl = document.getElementById('pTitleBadge');
  if (pTitleEl) {
    pTitleEl.innerText = `${tInfo.icon} ${tInfo.title.toUpperCase()}`;
    pTitleEl.style.color = tInfo.color;
    pTitleEl.style.borderColor = `${tInfo.color}66`;
    pTitleEl.style.background = `${tInfo.color}18`;
    pTitleEl.style.boxShadow = `0 0 12px ${tInfo.color}35`;
  }

  animatePointsCount(targetPts);

  const pDetail = getPlayerMeta(name);

  // Custom Banner / BG Image (Sanitized)
  const bannerEl = document.getElementById('pBanner');
  if (bannerEl) {
    const safeBanner = sanitizeSafeUrl(pDetail.bannerUrl);
    if (safeBanner) {
      bannerEl.style.backgroundImage = `url('${safeBanner}')`;
      bannerEl.style.backgroundSize = 'cover';
      bannerEl.style.backgroundPosition = 'center';
    } else {
      bannerEl.style.backgroundImage = 'none';
    }
  }

  // Accent Color Application
  const accent = (pDetail.accentColor && /^#[0-9a-fA-F]{6}$/.test(pDetail.accentColor.trim())) 
    ? pDetail.accentColor.trim() 
    : '#00eeff';

  const pCard = document.getElementById('profileModal');
  if (pCard) {
    pCard.style.borderColor = accent;
    pCard.style.boxShadow = `0 0 35px ${accent}44`;
  }
  const nameEl = document.getElementById('pName');
  if (nameEl) {
    const customEmote = (pDetail.customEmote || pDetail.emote || '').trim();
    const emoteHtml = customEmote ? `<span class="profile-custom-emote" title="Custom Profile Emote">${escapeHTML(customEmote)}</span>` : '';
    nameEl.innerHTML = `${escapeHTML(name)}${emoteHtml}`;
    nameEl.style.color = accent;
  }

  // Strict Profile Edit button authorization check
  const pEditBtn = document.getElementById('pEditBtn');
  const canEdit = isAuthorizedToEditProfile(name);

  if (pEditBtn) {
    pEditBtn.style.display = canEdit ? 'inline-flex' : 'none';
  }

  const descEl = document.getElementById('pDescription');
  if (pDetail.description && pDetail.description.trim()) {
    descEl.innerText = pDetail.description;
    descEl.style.display = 'block';
  } else {
    descEl.innerText = '';
    descEl.style.display = 'none';
  }

  const regCode = pDetail.region || 'EU';
  const devCode = pDetail.device || 'MK';
  const regObj = REGION_MAP[regCode] || { label: regCode };
  const devObj = DEVICE_MAP[devCode] || { label: devCode };

  const pRegionEl = document.getElementById('pRegion');
  pRegionEl.innerText = `REGION: ${regCode} (${regObj.label})`;
  pRegionEl.setAttribute('title', regObj.label);

  const pDeviceEl = document.getElementById('pDevice');
  pDeviceEl.innerText = `DEVICE: ${devCode} (${devObj.label})`;
  pDeviceEl.setAttribute('title', devObj.label);

  document.getElementById('pRival').innerText = `RIVAL: ${pDetail.rival || 'None'}`;
  document.getElementById('pLfm').innerText = `LFM: ${pDetail.lfm ? 'ON' : 'OFF'}`;

  renderProfileKitGrid(name);
  renderProfileDuels(name);

  if (window.history && window.history.replaceState) {
    const params = new URLSearchParams(window.location.search);
    params.set('player', name);
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  }

  overlay.classList.add('active');
}

function closeProfileModal() {
  document.getElementById('profileModalOverlay').classList.remove('active');
  if (window.history && window.history.replaceState) {
    const params = new URLSearchParams(window.location.search);
    params.delete('player');
    params.delete('p');
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }
}

const DUELS_REGISTRY = new Map();

function copyDuelLink(duelId, playerName) {
  const n = toPositiveInt(duelId);
  if (!n) {
    showToast('⚠️ This duel has no integer id to share.');
    return;
  }
  const baseUrl = siteShareBase();
  let shareUrl = `${baseUrl}?tab=duels&duel=${n}`;
  if (playerName) {
    shareUrl += `&player=${encodeURIComponent(playerName)}`;
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(shareUrl).then(() => {
      showToast(`🔗 Copied direct link for Duel #${n}!`);
    }).catch(() => {
      prompt("Copy direct duel link:", shareUrl);
    });
  } else {
    prompt("Copy direct duel link:", shareUrl);
  }
}

function openDuelPopupById(duelId, perspective) {
  const n = toPositiveInt(duelId);
  if (!n) {
    showToast(`⚠️ Duel #${duelId} is not a valid integer id.`);
    return;
  }
  let duel = DUELS_REGISTRY.get(n) || DUELS_REGISTRY.get(String(n));
  if (!duel) {
    for (const v of DUELS_REGISTRY.values()) {
      if (getDuelIntegerId(v) === n) {
        duel = v;
        break;
      }
    }
  }
  if (duel) {
    openDuelPopup(duel, perspective);
  } else {
    showToast(`⚠️ Duel #${n} not found in current cache.`);
  }
}

function openDuelPopup(duel, perspective) {
  const p = perspective || duel.player1;
  const info = duelPerspective(duel, p);
  const dateStr = new Date(duel.timestamp || duel.created_at * 1000 || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const duelNum = getDuelIntegerId(duel);

  let modal = document.getElementById('duelPopupModalOverlay');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'duelPopupModalOverlay';
    modal.className = 'modal-overlay';
    modal.onclick = (e) => { if (e.target.id === 'duelPopupModalOverlay') modal.classList.remove('active'); };
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-card duel-popup-card" style="max-width:480px;border-color:var(--cyan);box-shadow:0 0 35px rgba(0,238,255,0.35);background:rgba(10,20,35,0.95);backdrop-filter:blur(16px);border-radius:20px;padding:24px;position:relative;">
      <button class="modal-close-btn" style="position:absolute;top:16px;right:16px;background:none;border:none;color:#aaa;font-size:1.5rem;cursor:pointer;" onclick="closeDuelPopup()">&times;</button>
      <div style="font-family:var(--font-heading);font-weight:900;font-size:1.3rem;color:var(--cyan);margin-bottom:4px;display:flex;align-items:center;justify-content:space-between;">
        <span>⚔️ DUEL #${duelNum ?? 'N/A'}</span>
        <span style="font-size:0.8rem;color:var(--text-muted);font-weight:600;">ID: #${duelNum ?? 'N/A'}</span>
      </div>
      <div style="font-family:var(--font-heading);font-size:0.85rem;color:var(--text-muted);margin-bottom:16px;">${dateStr}</div>

      <div style="background:rgba(255,255,255,0.04);border:1px solid var(--border-color);border-radius:14px;padding:18px;margin-bottom:16px;text-align:center;">
        <div style="font-family:var(--font-heading);font-size:1.2rem;font-weight:800;color:#fff;margin-bottom:8px;">
          <span style="color:var(--cyan);cursor:pointer;" onclick="closeDuelPopup();openProfile('${p}')">${p}</span>
          <span style="color:var(--text-muted);font-size:0.85rem;margin:0 8px;">VS</span>
          <span style="color:#fff;cursor:pointer;" onclick="closeDuelPopup();openProfile('${info.opponent}')">${info.opponent}</span>
        </div>
        <div style="font-family:var(--font-heading);font-size:2.4rem;font-weight:900;letter-spacing:1px;color:${info.won ? 'var(--emerald)' : 'var(--crimson)'};">
          ${info.myScore} - ${info.oppScore}
        </div>
        <div style="font-family:var(--font-heading);font-size:0.9rem;font-weight:700;color:var(--gold);margin-top:6px;">
          🏆 Winner: ${duel.winner || (info.won ? p : info.opponent)}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;font-family:var(--font-heading);font-size:0.85rem;">
        <div style="background:rgba(0,0,0,0.25);padding:10px 14px;border-radius:10px;border:1px solid var(--border-color);">
          <span style="color:var(--text-muted);display:block;font-size:0.75rem;">KIT CATEGORY</span>
          <span style="color:#fff;font-weight:700;">${duel.kit || 'N/A'}</span>
        </div>
        <div style="background:rgba(0,0,0,0.25);padding:10px 14px;border-radius:10px;border:1px solid var(--border-color);">
          <span style="color:var(--text-muted);display:block;font-size:0.75rem;">OUTCOME / TYPE</span>
          <span style="color:#fff;font-weight:700;">${duel.outcome || duel.tier || 'Rank Match'}</span>
        </div>
      </div>

      ${duel.note ? `
        <div style="background:rgba(0,238,255,0.06);border:1px dashed rgba(0,238,255,0.3);border-radius:10px;padding:12px;margin-bottom:16px;font-size:0.85rem;color:#ddd;line-height:1.4;">
          💬 <strong>Notes:</strong> ${escapeHTML(duel.note)}
        </div>
      ` : ''}

      <div style="display:flex;gap:10px;">
        <button class="btn btn-secondary" style="flex:1;padding:10px 16px;" onclick="copyDuelLink('${duelNum}', '${p}')">🔗 Copy Direct Link</button>
        <button class="btn btn-primary" style="flex:1;padding:10px 16px;" onclick="closeDuelPopup()">Close</button>
      </div>
    </div>
  `;

  if (window.history && window.history.replaceState) {
    const params = new URLSearchParams();
    params.set('tab', 'duels');
    if (duelNum) params.set('duel', String(duelNum));
    if (p) params.set('player', p);
    window.history.replaceState(null, '', `?${params.toString()}`);
  }

  modal.classList.add('active');
}

function closeDuelPopup() {
  const overlay = document.getElementById('duelPopupModalOverlay');
  if (overlay) overlay.classList.remove('active');
  const htmlModal = document.getElementById('duelPopupModal');
  if (htmlModal) htmlModal.classList.remove('active');
}

function closeModalOnBackdrop(e) {
  if (e.target.id === 'profileModalOverlay') {
    closeProfileModal();
  }
}

async function handleUrlParamsOnLoad() {
  const search = window.location.search;
  const hash = window.location.hash;
  let targetPlayer = null;
  let targetDuelId = null;
  let targetTab = null;

  if (search) {
    const params = new URLSearchParams(search);
    if (params.has('player')) targetPlayer = params.get('player');
    else if (params.has('p')) targetPlayer = params.get('p');
    if (params.has('duel')) targetDuelId = toPositiveInt(params.get('duel'));
    else if (params.has('d')) targetDuelId = toPositiveInt(params.get('d'));
    if (params.has('tab')) targetTab = params.get('tab');
  }

  if (hash) {
    const rawHash = hash.substring(1).trim();
    if (!targetPlayer && rawHash.startsWith('player=')) targetPlayer = rawHash.replace('player=', '');
    else if (!targetDuelId && rawHash.startsWith('duel=')) targetDuelId = toPositiveInt(rawHash.replace('duel=', ''));
    else if (!targetPlayer && rawHash && !rawHash.includes('=')) targetPlayer = rawHash;
  }

  if (targetPlayer) {
    targetPlayer = resolvePlayerName(targetPlayer);
  }

  if (targetDuelId) {
    switchTab('duels', { skipRender: true });
    await renderDuelsView(targetPlayer);
    openDuelPopupById(targetDuelId, targetPlayer);
    return;
  }

  if (targetTab === 'duels') {
    switchTab('duels', { skipRender: true });
    await renderDuelsView(targetPlayer);
    return;
  }

  if (targetTab === 'hof' || targetTab === 'testers' || targetTab === 'rankings' || targetTab === 'rules' || targetTab === '2fa') {
    switchTab(targetTab);
    if (targetPlayer && targetTab !== '2fa') {
      setTimeout(() => openProfile(targetPlayer), 200);
    }
    return;
  }

  if (targetPlayer) {
    setTimeout(() => openProfile(targetPlayer), 200);
  }
}

function copyProfileLink(playerName) {
  const pName = playerName || CURRENT_PLAYER || '';
  if (!pName) return;
  const shareUrl = `${siteShareBase()}?player=${encodeURIComponent(pName)}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(shareUrl).then(() => {
      showToast(`🔗 Copied profile link for ${pName}!`);
    }).catch(() => {
      prompt("Copy this share link:", shareUrl);
    });
  } else {
    prompt("Copy this share link:", shareUrl);
  }
}

function copyEmbedCode(playerName) {
  const pName = playerName || CURRENT_PLAYER || '';
  if (!pName) return;
  const embedCode = `<iframe src="${siteShareBase()}?player=${encodeURIComponent(pName)}" width="500" height="600" frameborder="0"></iframe>`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(embedCode).then(() => {
      showToast(`⚡ Copied embed code for ${pName}!`);
    }).catch(() => {
      prompt("Copy embed code:", embedCode);
    });
  } else {
    prompt("Copy embed code:", embedCode);
  }
}

function showToast(msg) {
  let toast = document.getElementById('toast') || document.getElementById('toastNotification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.innerText = msg;
  toast.classList.add('show');
  toast.style.opacity = '1';
  clearTimeout(showToast._hideTimer);
  showToast._hideTimer = setTimeout(() => {
    toast.classList.remove('show');
    toast.style.opacity = '0';
  }, 3200);
}

function animatePointsCount(targetPts) {
  const el = document.getElementById('pPoints');
  let current = 0;
  const step = Math.ceil(targetPts / 20) || 1;
  const timer = setInterval(() => {
    current += step;
    if (current >= targetPts) {
      current = targetPts;
      clearInterval(timer);
    }
    el.innerText = current;
  }, 30);
}

function isPlayerInTier(tierList, playerName) {
  if (!tierList || !Array.isArray(tierList) || !playerName) return false;
  const cleanTarget = playerName.toLowerCase().trim();
  return tierList.some(item => {
    if (!item) return false;
    const name = typeof item === 'object' ? item.name : item;
    return (name || '').toString().toLowerCase().trim() === cleanTarget;
  });
}

function renderProfileKitGrid(name) {
  const container = document.getElementById('pTiers');
  let html = '';

  Object.keys(KIT_MAP).forEach(kit => {
    if (kit === "Overall") return;
    const kitConfig = KIT_MAP[kit];
    let evaluatedTier = null;

    if (DATA[kit] && typeof DATA[kit] === 'object') {
      for (let tier in DATA[kit]) {
        if (isPlayerInTier(DATA[kit][tier], name)) {
          evaluatedTier = tier;
          break;
        }
      }
    }

    if (!evaluatedTier) return;

    const isRetired = evaluatedTier.startsWith('R');
    const displayTier = isRetired ? 'Retired ' + evaluatedTier.slice(1) : evaluatedTier;

    html += `
      <div class="kit-circle-card" style="--kit-accent: ${kitConfig.color};">
        <div class="kit-circle-icon-wrap">
          <img src="${kitConfig.img}" alt="${kit}" onerror="this.src='assets/default.png'">
        </div>
        <div class="kit-circle-title">${kit}</div>
        <div class="kit-circle-tier">${displayTier}</div>
      </div>
    `;
  });

  if (!html) {
    html = `<div style="color:var(--text-muted);font-family:var(--font-heading);font-size:0.85rem;padding:10px;">Unranked in all kits</div>`;
  }

  container.innerHTML = html;
}

function getPlayerKitBadges(name) {
  let html = '';
  Object.keys(KIT_MAP).forEach(kit => {
    if (kit === "Overall") return;
    if (DATA[kit] && typeof DATA[kit] === 'object') {
      for (let tier in DATA[kit]) {
        if (isPlayerInTier(DATA[kit][tier], name)) {
          const img = KIT_MAP[kit].img;
          html += `
            <div class="ol-kit-badge" title="${kit}: ${tier}">
              <img src="${img}" onerror="this.src='assets/default.png'">
              <span class="ol-kit-tier">${tier}</span>
            </div>
          `;
          break;
        }
      }
    }
  });
  return html;
}



function openSubmitDuelModal() {
  if (!IS_ADMIN) return alert("Whitelisted staff admin access required.");
  document.getElementById('submitDuelModalOverlay').classList.add('active');
}

function closeSubmitDuelModal() {
  document.getElementById('submitDuelModalOverlay').classList.remove('active');
}

function closeSubmitDuelModalOnBackdrop(e) {
  if (e.target.id === 'submitDuelModalOverlay') {
    closeSubmitDuelModal();
  }
}

async function submitDuelFromSite() {
  showToast(DISCORD_BOT_WRITE_MSG);
  alert(DISCORD_BOT_WRITE_MSG);
}

function selectProfileEmote(emoji) {
  const input = document.getElementById('epEmote');
  if (input) input.value = emoji;
  document.querySelectorAll('.emote-option').forEach(el => {
    el.classList.toggle('selected', el.innerText.trim() === emoji || (emoji === '' && el.innerText.includes('None')));
  });
}

function openEditProfileModal() {
  if (!CURRENT_PLAYER) return;

  const pDetail = getPlayerMeta(CURRENT_PLAYER);
  document.getElementById('epSub').innerText = `Editing profile for ${CURRENT_PLAYER}`;
  document.getElementById('epSkinUrl').value = pDetail.skinUrl || '';
  document.getElementById('epBannerUrl').value = pDetail.bannerUrl || '';
  document.getElementById('epEmote').value = pDetail.customEmote || pDetail.emote || '';
  document.getElementById('epColor').value = pDetail.accentColor || '#00eeff';
  document.getElementById('epLfm').value = pDetail.lfm ? 'ON' : 'OFF';
  document.getElementById('epRival').value = pDetail.rival || '';
  document.getElementById('epDesc').value = pDetail.description || '';

  selectProfileEmote(pDetail.customEmote || pDetail.emote || '');

  document.getElementById('editProfileModalOverlay').classList.add('active');
}

function closeEditProfileModal() {
  document.getElementById('editProfileModalOverlay').classList.remove('active');
}

function closeEditProfileModalOnBackdrop(e) {
  if (e.target.id === 'editProfileModalOverlay') {
    closeEditProfileModal();
  }
}

async function saveProfileCustomization() {
  showToast(DISCORD_BOT_WRITE_MSG);
  alert(DISCORD_BOT_WRITE_MSG);
}

function openAdminDashModal() {
  if (!IS_ADMIN) return alert("Whitelisted admin access required.");

  const select = document.getElementById('adAssignedPlayer');
  if (select) {
    const players = Object.keys(DATA.Overall || {}).sort();
    select.innerHTML = '<option value="*">All Profiles (*)</option>' +
      players.map(p => `<option value="${p}">${p}</option>`).join('');
  }

  renderWhitelistItems();
  document.getElementById('adminDashModalOverlay').classList.add('active');
}

function closeAdminDashModal() {
  document.getElementById('adminDashModalOverlay').classList.remove('active');
}

function closeAdminDashModalOnBackdrop(e) {
  if (e.target.id === 'adminDashModalOverlay') {
    closeAdminDashModal();
  }
}

function renderWhitelistItems() {
  const container = document.getElementById('whitelistItemsList');
  const noteEl = document.getElementById('whitelistFirestoreNote');
  if (noteEl) {
    noteEl.style.display = 'block';
    noteEl.innerText = DISCORD_BOT_WRITE_MSG;
  }
  if (!container) return;

  if (!WHITELIST_ENTRIES || !WHITELIST_ENTRIES.length) {
    container.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem;">No whitelisted entries</div>`;
    return;
  }

  container.innerHTML = WHITELIST_ENTRIES.map(entry => {
    const isAdm = entry.role === 'admin';
    const profileTag = entry.assignedPlayer === '*' ? 'All Profiles (*)' : `Profile: ${entry.assignedPlayer}`;
    return `
      <div class="whitelist-item-row" style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div style="display:flex;flex-direction:column;gap:2px;">
          <div style="font-family:var(--font-heading);font-weight:700;font-size:0.85rem;color:#fff;">
            ${entry.label || entry.email || 'Whitelisted Account'}
            <span style="margin-left:6px;font-size:0.7rem;padding:2px 6px;border-radius:4px;background:${isAdm ? 'rgba(168,85,247,0.25)' : 'rgba(0,238,255,0.2)'};color:${isAdm ? '#d8b4fe' : '#67e8f9'};border:1px solid ${isAdm ? '#a855f7' : '#00eeff'};">${(entry.role || 'player').toUpperCase()}</span>
          </div>
          <div style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-muted);">${profileTag}</div>
        </div>
        <button onclick="removeEmailFromWhitelist('${entry.hash}')" class="whitelist-remove-btn">Remove</button>
      </div>
    `;
  }).join('');
}

async function persistWhitelistEntries() {
  throw new Error(DISCORD_BOT_WRITE_MSG);
}

async function addEmailToWhitelist() {
  showToast(DISCORD_BOT_WRITE_MSG);
  alert(DISCORD_BOT_WRITE_MSG);
}

async function removeEmailFromWhitelist() {
  showToast(DISCORD_BOT_WRITE_MSG);
  alert(DISCORD_BOT_WRITE_MSG);
}

let searchDebounceTimer = null;
function handleSearch(val) {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    const popup = document.getElementById('searchPopup');
    if (!val.trim()) {
      popup.style.display = 'none';
      return;
    }

    const matches = Object.keys(DATA.Overall || {}).filter(name => 
      name.toLowerCase().includes(val.toLowerCase())
    ).slice(0, 6);

    if (matches.length === 0) {
      popup.innerHTML = `<div class="search-item"><span>No player found</span></div>`;
    } else {
      popup.innerHTML = matches.map(m => `
        <div class="search-item" onclick="openProfile('${m}');document.getElementById('searchPopup').style.display='none';">
          <b>${m}</b>
          <span>VIEW PROFILE</span>
        </div>
      `).join('');
    }
    popup.style.display = 'block';
  }, 100);
}

let audioPlayer = null;
let isScrubbing = false;
let previousVolume = 0.5;

function initMusicPlayer() {
  audioPlayer = new Audio('assets/music.mp3');
  audioPlayer.loop = true;
  audioPlayer.volume = 0.5;

  const playBtn = document.getElementById('musicPlayBtn');
  const seekInput = document.getElementById('musicSeek');
  const timeDisplay = document.getElementById('musicTime');
  const widget = document.getElementById('musicPlayerWidget');
  const volSlider = document.getElementById('musicVolume');

  if (!audioPlayer || !playBtn) return;
  if (volSlider) volSlider.value = 50;

  audioPlayer.addEventListener('loadedmetadata', () => {
    if (seekInput) seekInput.max = Math.floor(audioPlayer.duration);
  });

  audioPlayer.addEventListener('timeupdate', () => {
    if (isScrubbing) return;
    if (seekInput) seekInput.value = Math.floor(audioPlayer.currentTime);
    if (timeDisplay) timeDisplay.innerText = formatAudioTime(audioPlayer.currentTime);
  });

  audioPlayer.addEventListener('play', () => {
    playBtn.innerText = '⏸';
    if (widget) widget.classList.add('playing');
  });

  audioPlayer.addEventListener('pause', () => {
    playBtn.innerText = '▶';
    if (widget) widget.classList.remove('playing');
  });

  const startAutoplay = () => {
    audioPlayer.play().catch(() => {});
    document.removeEventListener('click', startAutoplay);
    document.removeEventListener('keydown', startAutoplay);
  };
  document.addEventListener('click', startAutoplay, { once: true });
  document.addEventListener('keydown', startAutoplay, { once: true });
}

function toggleMusicPlay() {
  if (!audioPlayer) return;
  if (audioPlayer.paused) {
    audioPlayer.play().catch(err => console.warn("Audio play blocked:", err));
  } else {
    audioPlayer.pause();
  }
}

function seekMusic(val) {
  if (!audioPlayer) return;
  audioPlayer.currentTime = parseFloat(val);
}

function setMusicVolume(val) {
  if (!audioPlayer) return;
  const numVal = parseFloat(val);
  const vol = numVal / 100;
  audioPlayer.volume = vol;
  if (vol > 0) previousVolume = vol;

  const volBtn = document.getElementById('musicVolBtn');
  if (volBtn) {
    if (vol === 0) volBtn.innerText = '🔇';
    else if (vol < 0.4) volBtn.innerText = '🔈';
    else if (vol < 0.7) volBtn.innerText = '🔉';
    else volBtn.innerText = '🔊';
  }
}

function toggleMuteMusic() {
  if (!audioPlayer) return;
  const volSlider = document.getElementById('musicVolume');
  if (audioPlayer.volume > 0) {
    previousVolume = audioPlayer.volume;
    setMusicVolume(0);
    if (volSlider) volSlider.value = 0;
  } else {
    const restoreVal = (previousVolume || 0.5) * 100;
    setMusicVolume(restoreVal);
    if (volSlider) volSlider.value = restoreVal;
  }
}

function formatAudioTime(secs) {
  if (!isFinite(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function enterSite() {
  const enterScreen = document.getElementById('enterScreen');
  if (enterScreen) {
    enterScreen.classList.add('hidden');
  }
  if (audioPlayer && audioPlayer.paused) {
    audioPlayer.play().catch(err => console.warn("Audio play:", err));
  }
}

let CURRENT_RULES_SUBTAB = 'conduct';

function renderRulesView(subTab) {
  if (subTab) CURRENT_RULES_SUBTAB = subTab;
  const podiumWrap = document.getElementById('podiumWrap');
  podiumWrap.innerHTML = '';
  const displayList = document.getElementById('displayList');

  let html = `
    <div class="rules-container">
      <div class="rules-header">
        <h2 class="rules-main-title">📜 OFFICIAL MTCTIERS RULEBOOKS</h2>
        <p class="rules-main-sub">Official Community Conduct, Tier Testing Rules & Approved Server Requirements</p>
      </div>

      <div class="rules-subtabs">
        <button class="rules-subtab-btn ${CURRENT_RULES_SUBTAB === 'conduct' ? 'active' : ''}" onclick="renderRulesView('conduct')">📜 Community & Conduct</button>
        <button class="rules-subtab-btn ${CURRENT_RULES_SUBTAB === 'testing' ? 'active' : ''}" onclick="renderRulesView('testing')">⚔️ Tier Testing Rules</button>
        <button class="rules-subtab-btn ${CURRENT_RULES_SUBTAB === 'servers' ? 'active' : ''}" onclick="renderRulesView('servers')">🛡️ Server Requirements</button>
      </div>

      <div class="rules-content-box">
  `;

  if (CURRENT_RULES_SUBTAB === 'conduct') {
    html += getConductRulesHtml();
  } else if (CURRENT_RULES_SUBTAB === 'testing') {
    html += getTestingRulesHtml();
  } else if (CURRENT_RULES_SUBTAB === 'servers') {
    html += getServerReqRulesHtml();
  }

  html += `
      </div>
    </div>
  `;

  displayList.innerHTML = html;
}

function getConductRulesHtml() {
  const rules = [
    { title: "No Toxicity", text: "Disrespect, harassment, or excessive negativity toward other members is not permitted. Lighthearted joking is allowed when clearly unserious and mutually understood; however, repeated or targeted toxicity will result in punishment." },
    { title: "Staff Authority & Pausing Tests", text: "Authorized staff members have full discretion to pause or end a tier test if they believe a rule violation, issue, or unfair circumstance has occurred. Players may request a review if they believe the reason for stopping the test was invalid and can provide evidence supporting their claim." },
    { title: "No Impersonation", text: "Pretending to be a high-ranked player, staff member, or official tier tester is strictly prohibited. Official roles and testers are listed through the appropriate MTCTiers platforms." },
    { title: "No Destructive Behavior", text: "Any attempt to disrupt the tier testing system, organize harassment campaigns, spread targeted misinformation about players, or repeatedly damage the integrity of the community is prohibited." },
    { title: "No Leaderboard Manipulation", text: "Using alternative accounts to gain additional placements on the leaderboard or artificially affect the rankings of other players is prohibited." },
    { title: "No Server Restrictions", text: "Players should be willing to use approved servers when necessary. Players are not required to use every available server, but refusing to test anywhere except a specific server without a valid reason is not permitted." },
    { title: "No Unauthorized Advertising", text: "Advertising unrelated servers, communities, or services is prohibited unless explicit permission has been given." },
    { title: "No Targeted Harassment", text: "Repeatedly insulting, harassing, or targeting another player is prohibited. General competitive interactions are allowed unless they become continuous or directed at a specific person." },
    { title: "No Suicide Baiting", text: "Encouraging, joking about, or pressuring someone to harm themselves is strictly prohibited and will be treated as a serious offense." },
    { title: "No NSFW Content", text: "Sexual, explicit, or inappropriate content is not permitted anywhere within the MTCTiers community." },
    { title: "No Lying or Misinformation", text: "Providing false information regarding ranks, test history, or other relevant information is prohibited." },
    { title: "No Individual Targeting", text: "Repeatedly singling out, harassing, or attempting to negatively affect specific players or members of the community is prohibited." },
    { title: "No Racism or Hate Speech", text: "Discrimination, slurs, or hateful behavior directed toward any race, ethnicity, nationality, religion, or group is strictly prohibited." },
    { title: "No Unnecessary Redo Demands", text: "Players may not demand a round be replayed without a valid reason. Authorized staff members have full authority to deny redo requests that do not meet reasonable standards." },
    { title: "No Sexism", text: "Sexist comments, discrimination, or harassment based on gender are prohibited." },
    { title: "Respect Toward LGBTQ+ Individuals", text: "Players are not required to personally support LGBTQ+ identities; however, harassment, discrimination, or hateful behavior toward LGBTQ+ individuals is not allowed. Violations may result in warnings or bans depending on severity." },
    { title: "No Provoking or Escalating Conflicts", text: "Intentionally provoking, baiting, or attempting to create unnecessary arguments with other members is prohibited. Competitive banter is allowed when both parties are comfortable with it, but repeated attempts to upset, harass, or escalate situations may result in punishment." }
  ];

  let html = `<div class="rules-list"><h3 class="rules-sec-title">MTCTiers Official Community and Conduct Rules</h3>`;
  rules.forEach((r, idx) => {
    html += `
      <div class="rule-item-card">
        <div class="rule-num">#${idx + 1}</div>
        <div class="rule-body">
          <div class="rule-title">${r.title}</div>
          <div class="rule-desc">${r.text}</div>
        </div>
      </div>
    `;
  });
  html += `</div>`;
  return html;
}

function getTestingRulesHtml() {
  const rules = [
    { title: "Unfair Advantage & Modifications", text: "Any client modifications that create an unfair gameplay advantage are prohibited and will result in a permanent restriction from official MTCTiers tier testing. Standard video, GUI, and accessibility settings, along with performance optimization settings that do not alter gameplay, are permitted." },
    { title: "Macro & Multi-Input Bindings", text: "Binding your attack (dig) button to more than one physical input, or configuring a single physical input to perform multiple in-game actions, is prohibited and may result in a permanent restriction. Any hardware or software that automates clicks, repeated inputs, or sequences of actions is not permitted." },
    { title: "Hunger & Food Provisions", text: "Every tier test round must begin with both players at full hunger. Servers must provide a reasonable amount of food to maintain hunger throughout the test. Food that restores only hunger may be provided in unlimited quantities. However, food that grants additional effects, including but not limited to healing, regeneration, absorption, or any other status effect, must not be provided in unlimited quantities unless explicitly required by the official kit." },
    { title: "Equipment Durability & Broken Items", text: "If a player's weapon or armor breaks due to durability loss during a round, that round will not be counted and must be replayed using a fresh, undamaged kit." },
    { title: "Terrain Modification Rules", text: "Terrain modifications are permitted in all official kits except Emerald and Diamond. For these two kits, every round must begin on a clean, unmodified arena. In all other kits, terrain changes from previous rounds or matches are permitted unless a kit-specific rule states otherwise. For the Manhunt kit, previously used arenas may be reused across multiple tests, and terrain from previous matches may remain. However, players participating in an official test may not actively place or break blocks within the arena unless doing so is part of the official Manhunt kit rules." },
    { title: "Verification & Screenshare Rights", text: "MTCTiers staff reserve the right to request verification, including a screenshare or additional checks, whenever suspicious activity is observed. Refusing to comply without a reasonable explanation may result in a temporary restriction depending on the circumstances. Severe or repeated violations may result in a permanent restriction." },
    { title: "Void Boundary Death", text: "Falling into the void results in a loss for that round. The void is defined as a fall of more than 100 blocks from the arena's spawn level to the ground or any equivalent death zone designated by the arena." },
    { title: "Tester Instructions & Match Integrity", text: "All participants are expected to follow the instructions of the assigned tester throughout the tier test. Intentionally delaying the test, exploiting unintended game mechanics, interfering with the testing process, or disconnecting without a valid reason may result in the round or entire test being declared invalid." },
    { title: "Disciplinary Action & Finality", text: "Violation of any of these rules may result in the test being voided, the removal of an awarded tier, temporary or permanent suspension from official MTCTiers tier testing, or any other disciplinary action deemed appropriate by MTCTiers staff. All staff decisions are final unless successfully overturned through the official appeals process." }
  ];

  let html = `<div class="rules-list"><h3 class="rules-sec-title">MTCTiers Official Tier Testing Rules</h3>`;
  rules.forEach((r, idx) => {
    html += `
      <div class="rule-item-card">
        <div class="rule-num">#${idx + 1}</div>
        <div class="rule-body">
          <div class="rule-title">${r.title}</div>
          <div class="rule-desc">${r.text}</div>
        </div>
      </div>
    `;
  });
  html += `</div>`;
  return html;
}

function getServerReqRulesHtml() {
  const rules = [
    { title: "Solid Block Arena Construction", text: "Testing arenas must be constructed entirely of solid, full blocks. Instant-break blocks, including but not limited to leaves, glass panes, scaffolding, and similar materials, may not be used as arena flooring or primary structures." },
    { title: "Permanent Daytime", text: "The server must maintain permanent daytime throughout all official testing." },
    { title: "Minimum Playable Size (32×32)", text: "Every testing arena must have a minimum playable size of 32×32 blocks." },
    { title: "Arena Protection & Permissions", text: "All PvP testing areas must be fully protected. Arenas may not be publicly editable or have additional players with build permissions during official testing." },
    { title: "Default MultiCraft Cooldown (0.25)", text: "The server's attack cooldown must remain at the default MultiCraft value of 0.25 and may not be modified." },
    { title: "Unmodified Testing Kits & Items", text: "Items included in testing kits may not be modified using commands, plugins, or item editors, including /ie, unless the official MTCTiers version of that kit intentionally uses metadata-edited or /ie items. In such cases, the server's items must exactly match the official kit." },
    { title: "Enchantment Controls & Limits", text: "Only enchantments included in the official MTCTiers kit are permitted. Additional enchantments are prohibited unless explicitly allowed by the official kit. Unbreaking is permitted where applicable to prevent equipment from breaking during testing." },
    { title: "Keep Inventory Enabled", text: "Keep Inventory must remain enabled at all times during official testing." },
    { title: "Official Approved Arenas Only", text: "Players may not create or use their own testing arenas. All official tests must be conducted in the server's approved testing arenas." },
    { title: "No External Advantages or Potion Effects", text: "No additional items, potion effects, status effects, commands, or gameplay advantages outside of the official MTCTiers kit are permitted." },
    { title: "Exact Kit Matching Requirement", text: "The server's testing kit must exactly match the official MTCTiers kit for the corresponding tier. Any deviation from the official equipment, enchantments, attributes, metadata, or item properties is prohibited." },
    { title: "Manhunt Arena Reuse Rules", text: "For the Manhunt kit, previously used arenas may be reused across multiple tests. Terrain modifications from previous matches may remain; however, players may not actively place or break blocks during an official test unless doing so is part of the official Manhunt kit rules." }
  ];

  let html = `<div class="rules-list"><h3 class="rules-sec-title">MTCTiers Official Server Requirements</h3>`;
  rules.forEach((r, idx) => {
    html += `
      <div class="rule-item-card">
        <div class="rule-num">#${idx + 1}</div>
        <div class="rule-body">
          <div class="rule-title">${r.title}</div>
          <div class="rule-desc">${r.text}</div>
        </div>
      </div>
    `;
  });
  html += `</div>`;
  return html;
}

/* =========================================================
   DASHBOARD (HOME) — Top Players / Recent Duels /
   Leaderboards & News / Servers
   ========================================================= */

let DASH_LB_VIEW = 'overall';

function renderDashboardView() {
  const wrap = document.getElementById('dashboardWrap');
  if (!wrap) return;
  wrap.style.display = 'flex';

  wrap.innerHTML = `
    <section class="dash-section dash-podium-section">
      <div class="dash-section-title">🏆 TOP PLAYERS</div>
      <div id="dashPodium" class="mcpvp-podium">
        <div class="dash-empty">Loading top players...</div>
      </div>
    </section>

    <section class="dash-section dash-duels-section">
      <div class="dash-section-header">
        <div class="dash-section-title">⚔️ RECENT DUELS</div>
        <span class="dash-viewall" onclick="switchTab('duels')">VIEW ALL ▶</span>
      </div>
      <div id="dashDuels" class="dash-duels-list">
        <div class="dash-empty">Loading recent duels...</div>
      </div>
    </section>

    <section class="dash-split">
      <div class="dash-section dash-leaderboard-section">
        <div class="dash-section-header">
          <div class="dash-section-title">📊 LEADERBOARDS</div>
          <div class="dash-lb-tabs" id="dashLbTabs">
            <button type="button" class="dash-lb-tab active" data-view="overall" onclick="switchTab('home')">OVERALL</button>
          </div>
        </div>
        <div id="dashLeaderboardList" class="dash-lb-list">
          <div class="dash-empty">Loading leaderboard...</div>
        </div>
      </div>

      <div class="dash-section dash-news-section">
        <div class="dash-section-header">
          <div class="dash-section-title">📰 NEWS &amp; CHANGELOG</div>
        </div>
        <div id="dashNewsList" class="dash-news-list">
          <div class="dash-empty">Loading changelog...</div>
        </div>
      </div>

      <a href="status.html" class="dash-section dash-status-card">
        <div class="dash-status-icon">🟢</div>
        <div class="dash-status-title">STATUS</div>
        <div class="dash-status-text">Site &amp; server uptime</div>
      </a>
    </section>

    <section class="dash-section dash-servers-section">
      <div class="dash-section-title">🖥️ OFFICIAL SERVERS</div>
      <div class="dash-maintenance-card">
        <div class="dash-maintenance-icon">🛠️</div>
        <div class="dash-maintenance-title">Under Maintenance</div>
        <div class="dash-maintenance-text">Live server listings are temporarily unavailable while the server data API is being rebuilt. Check back soon.</div>
      </div>
    </section>
  `;

  renderDashboardPodium();
  renderDashboardDuels();
  renderDashboardLeaderboardList();
  fetchAndRenderChangelog();
}

function renderDashboardPodium() {
  const el = document.getElementById('dashPodium');
  if (!el) return;

  const sorted = Object.entries(DATA.Overall || {})
    .sort((a, b) => b[1] - a[1]);

  const top3 = sorted.slice(0, 3);
  if (!top3.length) {
    el.innerHTML = DATA_LOAD_ERROR
      ? `<div class="dash-empty">${DATA_LOAD_ERROR}</div>`
      : '<div class="dash-empty">No ranked players yet</div>';
    return;
  }

  // Visual order (left-to-right): 2nd, 1st, 3rd — like a real podium
  const displayOrder = [2, 1, 3];
  let html = '';
  displayOrder.forEach(rank => {
    const entry = top3[rank - 1];
    if (!entry) return;
    const [name, pts] = entry;
    const skinPath = getPlayerSkinSrc(name);

    html += `
      <div class="mcpvp-podium-item place-${rank}" onclick="openProfile('${name}')">
        <div class="mcpvp-podium-avatar-wrap">
          <img src="${skinPath}" alt="${name}" class="mcpvp-podium-avatar" onerror="this.src='assets/mtctiers_default_skin.png'">
        </div>
        <div class="mcpvp-podium-name">${name}</div>
        <div class="mcpvp-podium-pts">${pts} PTS</div>
        <div class="mcpvp-podium-stand">
          <span class="mcpvp-podium-stand-rank">${rank}</span>
        </div>
      </div>
    `;
  });
  el.innerHTML = html;
}

async function renderDashboardDuels() {
  const el = document.getElementById('dashDuels');
  if (!el) return;

  try {
    const duels = await fetchDuelsFromFirestore();
    if (!duels || !duels.length) {
      el.innerHTML = '<div class="dash-empty">No recent duels</div>';
      return;
    }

    const recent = duels.slice(0, 6);
    let html = '';
    recent.forEach((d, i) => {
      const duelId = String(d.id || d.message_id || `dash_${i}`);
      DUELS_REGISTRY.set(duelId, d);

      const perspective = d.player1;
      const info = duelPerspective(d, perspective);
      const date = new Date(d.timestamp || d.created_at * 1000 || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const desc = duelDescLine(d, perspective);

      html += `
        <div class="dash-duel-card" onclick="openDuelPopupById('${duelId}', '${perspective}')">
          <div class="dash-duel-score ${info.won ? 'won' : 'lost'}">${d.player1_score}-${d.player2_score}</div>
          <div class="dash-duel-names">
            <span class="dash-duel-p1" onclick="event.stopPropagation();openProfile('${d.player1}')">${d.player1}</span>
            <span class="dash-duel-vs">vs</span>
            <span class="dash-duel-p2" onclick="event.stopPropagation();openProfile('${d.player2}')">${d.player2}</span>
          </div>
          <div class="dash-duel-desc">${desc}</div>
          <div class="dash-duel-date">${date}</div>
        </div>
      `;
    });
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = '<div class="dash-empty">Could not load duels</div>';
  }
}

function renderDashboardLeaderboardList() {
  const el = document.getElementById('dashLeaderboardList');
  if (!el) return;

  const entries = Object.entries(DATA.Overall || {})
    .sort((a, b) => b[1] - a[1]);

  const top = entries.slice(0, 3);
  if (!top.length) {
    el.innerHTML = DATA_LOAD_ERROR
      ? `<div class="dash-empty">${DATA_LOAD_ERROR}</div>`
      : '<div class="dash-empty">No data yet</div>';
    return;
  }

  let html = '';
  top.forEach(([name, pts], idx) => {
    html += `
      <div class="dash-lb-row" onclick="openProfile('${name}')">
        <span class="dash-lb-rank">#${idx + 1}</span>
        <span class="dash-lb-name">${name}</span>
        <span class="dash-lb-pts">${pts} PTS</span>
      </div>
    `;
  });
  el.innerHTML = html;
}

const CHANGELOG_SOURCE_URL = "https://mtctiers-discord-bot-production.up.railway.app/changelog"; // e.g. "https://mtctiers-bot.up.railway.app/changelog"

function parseChangelogMessage(content) {
  if (!content || typeof content !== 'string') return null;

  const lines = content.replace(/\r\n/g, '\n').split('\n').map(l => l.trim());
  let title = '';
  const changes = [];

  for (const line of lines) {
    if (!line) continue;

    if (!title) {
      const m = line.match(/^\*\*(.+?)\*\*$/);
      title = m ? m[1].trim() : line.replace(/\*/g, '').trim();
      continue;
    }

    const addM = line.match(/^\[\+\]\s*(.+)/);
    const remM = line.match(/^\[-\]\s*(.+)/);
    const chgM = line.match(/^\[~\]\s*(.+)/);

    if (addM) changes.push({ type: 'added', text: addM[1].trim() });
    else if (remM) changes.push({ type: 'removed', text: remM[1].trim() });
    else if (chgM) changes.push({ type: 'changed', text: chgM[1].trim() });
    else changes.push({ type: 'note', text: line });
  }

  if (!title && !changes.length) return null;
  return { title: title || 'Update', changes };
}

async function fetchAndRenderChangelog() {
  const el = document.getElementById('dashNewsList');
  if (!el) return;

  if (!CHANGELOG_SOURCE_URL || CHANGELOG_SOURCE_URL.startsWith('PASTE_')) {
    el.innerHTML = '<div class="dash-empty">Changelog not connected yet</div>';
    return;
  }

  try {
    const res = await fetch(CHANGELOG_SOURCE_URL);
    if (!res.ok) throw new Error('changelog fetch failed');
    const messages = await res.json();

    if (!Array.isArray(messages) || !messages.length) {
      el.innerHTML = '<div class="dash-empty">No changelogs currently.</div>';
      return;
    }

    const parsed = messages
      .map(m => {
        const entry = parseChangelogMessage(m.content);
        if (!entry) return null;
        entry.timestamp = m.timestamp || m.created_at || null;
        entry.author = (m.author && typeof m.author === 'object') ? (m.author.username || m.author.name || '') : (m.author || '');
        return entry;
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

    if (!parsed.length) {
      el.innerHTML = '<div class="dash-empty">No changelog entries yet — check back soon.</div>';
      return;
    }

    let html = '';
    parsed.slice(0, 50).forEach(entry => {
      const date = entry.timestamp
        ? new Date(entry.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '';
      const title = escapeHTML(entry.title);
      const author = escapeHTML(entry.author || '');

      let changesHtml = '';
      entry.changes.forEach(c => {
        const cls = c.type === 'added' ? 'added' : c.type === 'removed' ? 'removed' : c.type === 'changed' ? 'changed' : 'note';
        const prefix = c.type === 'added' ? '+' : c.type === 'removed' ? '−' : c.type === 'changed' ? '~' : '•';
        changesHtml += `<li class="${cls}"><span class="dash-news-prefix">${prefix}</span>${escapeHTML(c.text)}</li>`;
      });

      html += `
        <div class="dash-news-item">
          <div class="dash-news-top">
            <span class="dash-news-title">${title}</span>
            <span class="dash-news-date">${date}</span>
          </div>
          <ul class="dash-news-changes">${changesHtml}</ul>
          ${author ? `<div class="dash-news-author">— ${author}</div>` : ''}
        </div>
      `;
    });
    el.innerHTML = html;
  } catch (e) {
    console.warn("Changelog fetch note:", e.message);
    el.innerHTML = '<div class="dash-empty">Could not load changelog.</div>';
  }
}
/* 🔐 2FA AUTHENTICATOR & PWA MOBILE / PC SYSTEM */

// Base32 Decoder
function base32ToBytes(base32Str) {
  const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  let bytes = [];
  const clean = (base32Str || '').toUpperCase().replace(/[^A-Z2-7]/g, '');

  for (let i = 0; i < clean.length; i++) {
    const val = base32chars.indexOf(clean.charAt(i));
    bits += val.toString(2).padStart(5, '0');
  }

  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substr(i, 8), 2));
  }

  return new Uint8Array(bytes);
}

// Base32 Secret Generator
function generateBase32Secret(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    secret += chars[array[i] % chars.length];
  }
  return secret;
}

// Pure JavaScript RFC 6238 TOTP Generator (100% Offline via Web Crypto API)
async function generateTOTPCode(secretBase32) {
  try {
    const secretBytes = base32ToBytes(secretBase32);
    if (!secretBytes.length) return "000000";

    const timeStep = 30;
    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / timeStep);

    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setUint32(4, counter, false);

    const key = await crypto.subtle.importKey(
      'raw',
      secretBytes,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, buffer);
    const sigBytes = new Uint8Array(signature);
    const offset = sigBytes[sigBytes.length - 1] & 0xf;

    const code = (
      ((sigBytes[offset] & 0x7f) << 24) |
      ((sigBytes[offset + 1] & 0xff) << 16) |
      ((sigBytes[offset + 2] & 0xff) << 8) |
      (sigBytes[offset + 3] & 0xff)
    ) % 1000000;

    return String(code).padStart(6, '0');
  } catch (err) {
    console.warn("TOTP generation note:", err.message);
    return "000000";
  }
}

let totpIntervalId = null;

async function render2faView() {
  const displayList = document.getElementById('displayList');
  if (!displayList) return;

  const currentAccount = CURRENT_USER ? (CURRENT_USER.email || CURRENT_USER.displayName || 'GuestUser') : 'MTCTiersPlayer';
  let storedSecret = localStorage.getItem(`mtc_2fa_secret_${currentAccount}`);

  if (!storedSecret) {
    storedSecret = generateBase32Secret(16);
    localStorage.setItem(`mtc_2fa_secret_${currentAccount}`, storedSecret);
  }

  const initialCode = await generateTOTPCode(storedSecret);
  const formattedCode = initialCode.slice(0, 3) + ' ' + initialCode.slice(3);
  const otpUrl = `otpauth://totp/MTCTiers:${encodeURIComponent(currentAccount)}?secret=${storedSecret}&issuer=MTCTiers`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpUrl)}`;

  displayList.innerHTML = `
    <div class="totp-container">
      <div class="totp-header">
        <span class="totp-icon">🔐</span>
        <h2 class="totp-title">MTCTIERS 2FA AUTHENTICATOR</h2>
      </div>
      <p class="totp-subtitle">Official Mobile & Desktop PWA 2FA Security App — Works 100% Offline!</p>

      <div class="totp-card">
        <div style="font-size:0.8rem;color:var(--text-muted);letter-spacing:1px;">ACCOUNT: <strong style="color:#fff;">${currentAccount}</strong></div>
        <div class="totp-code-display" id="totpLiveCode">${formattedCode}</div>
        
        <div class="totp-timer-wrap">
          <svg class="totp-timer-svg" viewBox="0 0 24 24">
            <circle class="totp-timer-circle" id="totpTimerCircle" cx="12" cy="12" r="10"></circle>
          </svg>
          <span>REFRESHES IN <strong id="totpSeconds">30</strong>s</span>
        </div>
      </div>

      <div class="totp-secret-box">
        <span>SECRET: <strong id="totpSecretText">${storedSecret}</strong></span>
        <button class="auth-btn" style="padding:6px 12px;font-size:0.75rem;" onclick="copy2faSecret('${storedSecret}')">COPY SECRET</button>
      </div>

      <img src="${qrUrl}" alt="2FA QR Code" class="totp-qr-img" onerror="this.style.display='none'">
      <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">Scan with Google Authenticator, Authy, or MTCTiers Mobile App</div>

      <div style="margin-top:20px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
        <input type="text" id="totpTestInput" class="form-input" style="max-width:180px;text-align:center;font-size:1.1rem;font-weight:900;letter-spacing:2px;" placeholder="000000" maxlength="6">
        <button class="auth-btn" onclick="verify2faCode('${storedSecret}')">VERIFY 2FA CODE</button>
        <button class="btn-pwa-install" onclick="regenerate2faSecret('${currentAccount}')">REGENERATE KEY</button>
      </div>
    </div>
  `;

  startTotpLiveLoop(storedSecret);
}

function startTotpLiveLoop(secret) {
  if (totpIntervalId) clearInterval(totpIntervalId);

  const update = async () => {
    const epoch = Math.floor(Date.now() / 1000);
    const secondsLeft = 30 - (epoch % 30);
    const secEl = document.getElementById('totpSeconds');
    const circleEl = document.getElementById('totpTimerCircle');
    const codeEl = document.getElementById('totpLiveCode');

    if (secEl) secEl.innerText = secondsLeft;
    if (circleEl) {
      const offset = 63 * (1 - (secondsLeft / 30));
      circleEl.style.strokeDashoffset = offset;
    }

    if (codeEl) {
      const code = await generateTOTPCode(secret);
      codeEl.innerText = code.slice(0, 3) + ' ' + code.slice(3);
    }
  };

  update();
  totpIntervalId = setInterval(update, 1000);
}

function copy2faSecret(secret) {
  navigator.clipboard.writeText(secret).then(() => {
    showToast('🔑 2FA Secret Key copied to clipboard!');
  }).catch(() => {
    showToast(`Secret: ${secret}`);
  });
}

async function verify2faCode(secret) {
  const inputEl = document.getElementById('totpTestInput');
  const userVal = (inputEl ? inputEl.value : '').replace(/\s+/g, '').trim();
  const validCode = await generateTOTPCode(secret);

  if (userVal === validCode) {
    showToast('✅ 2FA Code Verified Successfully! Account Secure.');
  } else {
    showToast('❌ Invalid 2FA Security Code. Try again.');
  }
}

function regenerate2faSecret(account) {
  if (confirm('Regenerate 2FA Secret Key? You will need to re-pair Google Authenticator / MTCTiers App.')) {
    const newSecret = generateBase32Secret(16);
    localStorage.setItem(`mtc_2fa_secret_${account}`, newSecret);
    showToast('🔑 New 2FA Secret Key generated!');
    render2faView();
  }
}

/* 📲 PWA EVENT LISTENERS & SERVICE WORKER */
let deferredPwaPrompt = null;

function isIosDevice() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isCurrentDeviceMobile() {
  return window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function isPwaInstalledOnCurrentDevice() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isStandalone) return true;

  const onMobile = isCurrentDeviceMobile();
  const key = onMobile ? 'pwa_installed_mobile' : 'pwa_installed_pc';
  return localStorage.getItem(key) === 'true';
}

function checkAppInstalledState() {
  const pwaBtn = document.getElementById('pwaInstallBtn');
  const pwaBanner = document.getElementById('pwaBanner');

  if (isPwaInstalledOnCurrentDevice()) {
    if (pwaBtn) pwaBtn.style.display = 'none';
    if (pwaBanner) pwaBanner.style.display = 'none';
  } else {
    const shouldShow = deferredPwaPrompt || isIosDevice() || isCurrentDeviceMobile();
    if (shouldShow) {
      if (pwaBtn) pwaBtn.style.display = 'inline-flex';
      if (pwaBanner && !localStorage.getItem('pwa_banner_closed')) {
        pwaBanner.style.display = 'block';
      }
    }
  }
}

window.addEventListener('appinstalled', () => {
  const key = isCurrentDeviceMobile() ? 'pwa_installed_mobile' : 'pwa_installed_pc';
  localStorage.setItem(key, 'true');
  showToast('🎉 MTCTiers App Installed Successfully!');
  checkAppInstalledState();
});

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPwaPrompt = e;
  if (isPwaInstalledOnCurrentDevice()) {
    checkAppInstalledState();
    return;
  }
  const pwaBtn = document.getElementById('pwaInstallBtn');
  const pwaBanner = document.getElementById('pwaBanner');
  if (pwaBtn) pwaBtn.style.display = 'inline-flex';
  if (pwaBanner && !localStorage.getItem('pwa_banner_closed')) {
    pwaBanner.style.display = 'block';
  }
});

function promptPwaInstall() {
  if (deferredPwaPrompt) {
    deferredPwaPrompt.prompt();
    deferredPwaPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        const key = isCurrentDeviceMobile() ? 'pwa_installed_mobile' : 'pwa_installed_pc';
        localStorage.setItem(key, 'true');
        showToast('🎉 MTCTiers App Installed!');
        checkAppInstalledState();
      }
      deferredPwaPrompt = null;
    });
  } else if (isIosDevice()) {
    alert('📱 How to install MTCTiers App on iPhone / iPad:\n\n1. Tap the Share button (square with arrow ↑) at the bottom of Safari.\n2. Scroll down and tap "Add to Home Screen" ➕\n3. Tap "Add" in the top right corner!');
  } else {
    showToast('📱 Tap browser menu ➔ "Add to Home Screen" or "Install App"');
  }
}

function closePwaBanner() {
  const pwaBanner = document.getElementById('pwaBanner');
  if (pwaBanner) pwaBanner.style.display = 'none';
  localStorage.setItem('pwa_banner_closed', 'true');
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('⚡ [PWA] Service Worker registered:', reg.scope))
      .catch(err => console.warn('[PWA] Service Worker registration note:', err.message));
  });
}

// Offline Connection Event Listeners
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

function applyOfflineBanner(announce) {
  const offlineInd = document.getElementById('offlineIndicator');
  const offline = navigator.onLine === false;
  if (offlineInd) offlineInd.style.display = offline ? 'block' : 'none';
  if (!announce) return;
  if (offline) {
    showToast('📡 Connection Offline. Local Rankings & 2FA Active!');
  } else {
    showToast('🟢 Online Connection Restored!');
  }
}

function updateOnlineStatus() {
  applyOfflineBanner(true);
}
