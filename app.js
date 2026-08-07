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

      if (user) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (userProfile) userProfile.style.display = 'flex';
        if (userAvatar) userAvatar.src = user.photoURL || 'assets/mtctiers_default_skin.png';
        if (userName) userName.innerText = user.displayName || user.email.split('@')[0];

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
  { label: 'v4n1shed (Admin)', hash: '45fa8d30db1adfac35b83544615eb76462ea55c0ed65069d7b584ad72b42d165', role: 'admin', assignedPlayer: 'vorthexis' }
];

let CURRENT_ROLE = null;
let CURRENT_ASSIGNED_PLAYER = '*';

async function sha256Hex(str) {
  const buf = new TextEncoder().encode(str.toLowerCase().trim());
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const EMAIL_TO_PLAYER = {
  'ziadn6b@gmail.com': 'ziadlive',
  'v4n1shedytoffical@gmail.com': 'vorthexis',
  'v41nshedytoffical@gmail.com': 'vorthexis'
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
    const fsRes = await fetch("https://firestore.googleapis.com/v1/projects/mtctiers/databases/(default)/documents/rankings/whitelist");
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

  if (loginBtn) loginBtn.style.display = 'inline-flex';
  if (userProfile) userProfile.style.display = 'none';
  if (adminTag) adminTag.style.display = 'none';
  if (adminDuelBtn) adminDuelBtn.style.display = 'none';
  if (adminDashBtn) adminDashBtn.style.display = 'none';

  showToast("Logged out");
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
let CURRENT_TAB = 'home';
let CURRENT_KIT = 'Overall';
let CURRENT_PLAYER = null;

document.addEventListener('DOMContentLoaded', async () => {
  initMusicPlayer();
  await loadRankingsData();
  handleUrlParamsOnLoad();
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

async function loadRankingsData() {
  try {
    let loadedFromFirestore = false;

    // 1. Fetch directly from Firebase Firestore REST API (Primary Source of Truth)
    try {
      const fsRes = await fetch("https://firestore.googleapis.com/v1/projects/mtctiers/databases/(default)/documents/rankings");
      if (fsRes.ok) {
        const fsData = await fsRes.json();
        const docs = fsData.documents || [];
        if (docs.length) {
          docs.forEach(doc => {
            const docId = doc.name.split('/').pop();
            if (docId === 'players_meta') {
              const rawPlayers = doc.fields?.players?.arrayValue?.values || [];
              DATA.Players = rawPlayers.map(item => parseFirestoreMap(item.mapValue?.fields || {}));
            } else if (docId === 'whitelist') {
              const rawEntriesStr = doc.fields?.entries?.stringValue;
              if (rawEntriesStr) {
                try { WHITELIST_ENTRIES = JSON.parse(rawEntriesStr); } catch (e) {}
              }
            } else {
              let parsedDoc = parseFirestoreMap(doc.fields || {});
              if (parsedDoc && parsedDoc.tiers && typeof parsedDoc.tiers === 'object') {
                parsedDoc = parsedDoc.tiers;
              }
              DATA[docId] = parsedDoc;
            }
          });
          loadedFromFirestore = true;
        }
      }
    } catch (e) {
      console.warn("Direct Firestore REST load note:", e.message);
    }

    // 2. Fallback to local rankings.json only if offline/Firestore unreachable
    if (!loadedFromFirestore) {
      const res = await fetch(`data/rankings.json?v=${Date.now()}`);
      DATA = await res.json();
    }

    computeOverallPoints();
    renderCurrentTab();
  } catch (err) {
    console.error("Failed to load rankings data:", err);
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
      if (Array.isArray(DATA[kit][tier])) {
        DATA[kit][tier].forEach(p => {
          const name = typeof p === 'object' ? p.name : (p || '').toString().trim();
          if (name) {
            DATA.Overall[name] = (DATA.Overall[name] || 0) + points;
          }
        });
      }
    }
  }
}

function switchTab(tab) {
  CURRENT_TAB = tab;
  document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
  const navEl = document.getElementById('nav-' + tab);
  if (navEl) navEl.classList.add('active');

  const kitBar = document.getElementById('kitBar');
  const filterBar = document.getElementById('filterBar');
  const podiumWrap = document.getElementById('podiumWrap');

  if (tab === 'home') {
    CURRENT_KIT = 'Overall';
    updateKitBarActive('Overall');
    if (kitBar) kitBar.style.display = 'flex';
    if (filterBar) filterBar.style.display = 'flex';
    if (podiumWrap) podiumWrap.style.display = 'flex';
  } else if (tab === 'rankings') {
    if (CURRENT_KIT === 'Overall') {
      CURRENT_KIT = 'Emerald';
    }
    updateKitBarActive(CURRENT_KIT);
    if (kitBar) kitBar.style.display = 'flex';
    if (filterBar) filterBar.style.display = 'flex';
    if (podiumWrap) { podiumWrap.style.display = 'none'; podiumWrap.innerHTML = ''; }
  } else {
    if (kitBar) kitBar.style.display = 'none';
    if (filterBar) filterBar.style.display = 'none';
    if (podiumWrap) { podiumWrap.style.display = 'none'; podiumWrap.innerHTML = ''; }
  }

  renderCurrentTab();
}

function updateKitBarActive(kitName) {
  document.querySelectorAll('.kit-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.kit === kitName);
  });
}

function renderCurrentTab() {
  const displayList = document.getElementById('displayList');
  const podiumWrap = document.getElementById('podiumWrap');

  if (CURRENT_TAB === 'home' || CURRENT_TAB === 'rankings') {
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

function filterPlayerVisible(playerName) {
  const regionFilter = document.getElementById('filterRegion') ? document.getElementById('filterRegion').value : '';
  const deviceFilter = document.getElementById('filterDevice') ? document.getElementById('filterDevice').value : '';

  const playerMeta = (DATA.Players || []).find(p => p.name === playerName) || {};

  if (regionFilter && playerMeta.region !== regionFilter) return false;
  if (deviceFilter && playerMeta.device !== deviceFilter) return false;

  return true;
}

function applyFilters() {
  renderCurrentTab();
}

function resetFilters() {
  if (document.getElementById('filterRegion')) document.getElementById('filterRegion').value = '';
  if (document.getElementById('filterDevice')) document.getElementById('filterDevice').value = '';
  if (document.getElementById('filterRetired')) document.getElementById('filterRetired').value = 'all';
  applyFilters();
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

    const visiblePlayers = kitData[tier].filter(player => filterPlayerVisible(player));
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
  const isP1 = (d.player1 || '').toLowerCase().trim() === cleanTarget;
  const isP2 = (d.player2 || '').toLowerCase().trim() === cleanTarget;

  let won = false;
  if (d.winner && typeof d.winner === 'string') {
    won = d.winner.toLowerCase().trim() === cleanTarget;
  } else if (d.player1_score !== undefined && d.player2_score !== undefined) {
    const s1 = parseInt(d.player1_score, 10) || 0;
    const s2 = parseInt(d.player2_score, 10) || 0;
    won = isP1 ? s1 > s2 : s2 > s1;
  } else {
    won = isP1 ? d.result === 'Won' : d.result === 'Lost';
  }

  const myScore = isP1 ? d.player1_score : d.player2_score;
  const oppScore = isP1 ? d.player2_score : d.player1_score;
  const opponent = isP1 ? d.player2 : d.player1;
  return { won, myScore, oppScore, opponent, isP1 };
}

function duelDescLine(d, playerName) {
  if (d.note && typeof d.note === 'string' && d.note.trim()) {
    return d.note.trim();
  }
  const kit = (!d.kit || d.kit === 'Unknown') ? '' : d.kit;
  const tier = (!d.tier || d.tier === 'Unknown') ? '' : d.tier;
  
  if (d.outcome && typeof d.outcome === 'string') {
    const oc = d.outcome.trim();
    if (oc.includes('promoted') || oc.includes('demoted') || oc.includes('failed')) {
      if (oc.includes(' ')) return oc;
    }
    const subject = d.player1 || playerName;
    if (oc === 'failed') {
      return `${subject} failed${tier ? ' ' + tier : ''}${kit ? ' in ' + kit : ''}`;
    }
    const verb = oc === 'promoted' ? 'promoted' : oc === 'demoted' ? 'demoted' : oc;
    const toTier = tier ? ` to ${tier}` : '';
    const inKit = kit ? ` in ${kit}` : '';
    return `${subject} has been ${verb}${toTier}${inKit}`;
  }
  return `${kit}${tier ? ' · ' + tier : ''}`.trim();
}

function openDuelPopup(d, perspective) {
  const p = perspective || d.player1;
  const info = duelPerspective(d, p);
  const date = new Date(d.timestamp || d.created_at * 1000 || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const oc = d.outcome || 'tested';
  const ocColor = oc === 'promoted' ? 'var(--emerald)' : oc === 'demoted' ? 'var(--crimson)' : oc === 'failed' ? '#ff8800' : 'var(--text-muted)';

  document.getElementById('duelPopupContent').innerHTML = `
    <div style="text-align:center;">
      <div style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-muted);letter-spacing:2px;margin-bottom:12px;">${d.kit || ''} ${d.tier && d.tier !== 'Unknown' ? '· ' + d.tier : ''}</div>
      ${oc !== 'tested' ? `<div style="font-family:var(--font-mono);font-size:0.8rem;color:${ocColor};border:1px solid ${ocColor};border-radius:20px;padding:4px 16px;display:inline-block;margin-bottom:16px;letter-spacing:1px;font-weight:700;">${oc.toUpperCase()}</div>` : ''}
      <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:16px;">
        <span style="font-family:var(--font-heading);font-weight:800;font-size:1.2rem;color:#fff;cursor:pointer;" onclick="closeDuelPopup();openProfile('${d.player1}')">${d.player1}</span>
        <span style="font-family:var(--font-mono);font-size:0.8rem;color:var(--cyan);">VS</span>
        <span style="font-family:var(--font-heading);font-weight:800;font-size:1.2rem;color:var(--text-muted);cursor:pointer;" onclick="closeDuelPopup();openProfile('${d.player2}')">${d.player2}</span>
      </div>
      <div style="font-family:var(--font-heading);font-weight:900;font-size:3rem;color:${info.won ? 'var(--emerald)' : 'var(--crimson)'};letter-spacing:4px;line-height:1;margin-bottom:12px;">${info.myScore} - ${info.oppScore}</div>
      <div style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-dim);">${date}</div>
    </div>`;
  document.getElementById('duelPopupModal').classList.add('active');
}

function closeDuelPopup() {
  document.getElementById('duelPopupModal').classList.remove('active');
}

function parseFirestoreMap(fields) {
  const d = {};
  for (let k in fields) {
    const valObj = fields[k];
    if (valObj.stringValue !== undefined) d[k] = valObj.stringValue;
    else if (valObj.integerValue !== undefined) d[k] = parseInt(valObj.integerValue, 10);
    else if (valObj.booleanValue !== undefined) d[k] = valObj.booleanValue;
    else if (valObj.mapValue !== undefined) d[k] = parseFirestoreMap(valObj.mapValue.fields || {});
    else d[k] = Object.values(valObj)[0];
  }
  return d;
}

function dedupeAndSortDuels(duels) {
  const map = new Map();
  duels.forEach(d => {
    const key = d.id || d.message_id || `${d.player1}_${d.player2}_${d.timestamp || d.created_at}`;
    if (!map.has(key)) map.set(key, d);
  });
  const list = Array.from(map.values());
  return list.sort((a, b) => new Date(b.timestamp || b.created_at * 1000 || 0) - new Date(a.timestamp || a.created_at * 1000 || 0));
}

async function fetchDuelsFromFirestore(playerFilter) {
  let allDuels = [];

  // Load from local data/duels.json first (complete backup)
  try {
    const res = await fetch(`data/duels.json?v=${Date.now()}`);
    if (res.ok) {
      const localData = await res.json();
      if (Array.isArray(localData)) allDuels.push(...localData);
      else if (localData && Array.isArray(localData.duels)) allDuels.push(...localData.duels);
      else if (typeof localData === 'object') {
        Object.values(localData).forEach(val => {
          if (Array.isArray(val)) allDuels.push(...val);
          else if (val && Array.isArray(val.duels)) allDuels.push(...val.duels);
        });
      }
    }
  } catch (e) { console.warn("Local duels.json fetch note:", e.message); }

  // Merge with Firestore live duels
  try {
    const baseREST = "https://firestore.googleapis.com/v1/projects/mtctiers/databases/(default)/documents/duels";
    const res = await fetch(`${baseREST}?pageSize=300`);
    if (res.ok) {
      const data = await res.json();
      const docs = data.documents || [];
      docs.forEach(doc => {
        const rawDuels = doc.fields?.duels?.arrayValue?.values || [];
        rawDuels.forEach(item => {
          allDuels.push(parseFirestoreMap(item.mapValue?.fields || {}));
        });
      });
    }
  } catch (e) { console.warn("Firestore REST duels note:", e.message); }

  const combined = dedupeAndSortDuels(allDuels);

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
      const base = AUTH_API.replace('/api', '');
      const url = playerFilter
        ? `${base}/api/duels?player=${encodeURIComponent(playerFilter)}&limit=50`
        : `${base}/api/duels?limit=100`;
      const res = await fetch(url);
      const data = await res.json();
      duels = data.duels || [];
    }

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

    duels.forEach((d, i) => {
      const perspective = playerFilter || d.player1;
      const info = duelPerspective(d, perspective);
      const date = new Date(d.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const desc = duelDescLine(d, perspective);
      const jsonStr = JSON.stringify(d).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

      html += `
        <div class="duel-row ${info.won ? 'won' : 'lost'}" onclick="openDuelPopup(${jsonStr}, '${perspective}')">
          <div class="duel-row-top">
            <div class="duel-names">
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
  const metaBox = document.querySelector('.player-meta-box');

  try {
    let duels = await fetchDuelsFromFirestore(playerName);

    if (!duels || !duels.length) {
      const base = AUTH_API.replace('/api', '');
      const res = await fetch(`${base}/api/duels?player=${encodeURIComponent(playerName)}&limit=50`);
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

    if (!metaBox || !duels || !duels.length) return;

    const d = duels[0];
    const info = duelPerspective(d, playerName);
    const date = new Date(d.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const desc = duelDescLine(d, playerName);
    const jsonStr = JSON.stringify(d).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

    const section = document.createElement('div');
    section.className = 'profile-duel-section';
    section.innerHTML = `
      <div class="profile-duel-header">
        <span class="profile-duel-label-text">LATEST DUEL</span>
        <span class="profile-duel-viewall" onclick="closeProfileModal();switchTab('duels');renderDuelsView('${playerName}')">VIEW ALL ▶</span>
      </div>
      <div class="profile-duel-card" onclick="openDuelPopup(${jsonStr}, '${playerName}')">
        <div class="profile-duel-top">
          <div class="profile-duel-names">${playerName} <span>vs</span> ${info.opponent}</div>
          <div class="profile-duel-score-text" style="color: ${info.won ? 'var(--emerald)' : 'var(--crimson)'};">${info.myScore}-${info.oppScore}</div>
        </div>
        <div class="profile-duel-bottom">${desc} · ${date}</div>
      </div>
    `;

    metaBox.appendChild(section);
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

async function openProfile(name) {
  CURRENT_PLAYER = name;
  const overlay = document.getElementById('profileModalOverlay');
  const modal = document.getElementById('profileModal');

  const skinImg = document.getElementById('pSkinImg');
  skinImg.src = getPlayerSkinSrc(name);
  skinImg.onerror = function() { this.src = 'assets/mtctiers_default_skin.png'; this.style.opacity = '1'; };

  document.getElementById('pName').innerText = name;

  const sortedOverall = Object.entries(DATA.Overall).sort((a, b) => b[1] - a[1]);
  const rankIndex = sortedOverall.findIndex(([p]) => p === name);
  const targetPts = DATA.Overall[name] || 0;
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

  const pCard = document.querySelector('.profile-modal-card');
  if (pCard) {
    pCard.style.borderColor = accent;
    pCard.style.boxShadow = `0 0 35px ${accent}44`;
  }
  const nameEl = document.getElementById('pName');
  if (nameEl) {
    nameEl.innerText = name;
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
    window.history.replaceState(null, '', `?player=${encodeURIComponent(name)}`);
  }

  overlay.classList.add('active');
}

function closeProfileModal() {
  document.getElementById('profileModalOverlay').classList.remove('active');
  if (window.history && window.history.replaceState) {
    window.history.replaceState(null, '', window.location.pathname);
  }
}

function closeModalOnBackdrop(e) {
  if (e.target.id === 'profileModalOverlay') {
    closeProfileModal();
  }
}

function handleUrlParamsOnLoad() {
  const search = window.location.search;
  const hash = window.location.hash;
  let targetPlayer = null;

  if (search) {
    const params = new URLSearchParams(search);
    if (params.has('player')) targetPlayer = params.get('player');
    else if (params.has('p')) targetPlayer = params.get('p');
    else {
      const rawQuery = search.substring(1).trim();
      if (rawQuery && !rawQuery.includes('=')) {
        targetPlayer = rawQuery;
      }
    }
  }

  if (!targetPlayer && hash) {
    const rawHash = hash.substring(1).trim();
    if (rawHash.startsWith('player=')) targetPlayer = rawHash.replace('player=', '');
    else if (!rawHash.includes('=')) targetPlayer = rawHash;
  }

  if (targetPlayer) {
    const cleanName = decodeURIComponent(targetPlayer).replace(/\+/g, ' ').trim();
    if (cleanName) {
      setTimeout(() => {
        openProfile(cleanName);
      }, 200);
    }
  }
}

function copyProfileLink(playerName) {
  const pName = playerName || CURRENT_PLAYER || '';
  if (!pName) return;
  const baseUrl = window.location.origin + window.location.pathname;
  const shareUrl = `${baseUrl}?player=${encodeURIComponent(pName)}`;
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
  const embedCode = `<iframe src="${window.location.origin}${window.location.pathname}?player=${encodeURIComponent(pName)}" width="500" height="600" frameborder="0"></iframe>`;
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
  let toast = document.getElementById('toastNotification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toastNotification';
    toast.style.cssText = `
      position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
      background: rgba(13, 27, 42, 0.95); border: 1px solid var(--cyan);
      box-shadow: 0 0 20px rgba(0, 238, 255, 0.4); color: #fff;
      padding: 12px 24px; border-radius: 30px; font-family: var(--font-heading);
      font-size: 0.9rem; font-weight: 700; z-index: 10000; opacity: 0; transition: opacity 0.3s ease;
      pointer-events: none;
    `;
    document.body.appendChild(toast);
  }
  toast.innerText = msg;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 3000);
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

function renderProfileKitGrid(name) {
  const container = document.getElementById('pTiers');
  let html = '';

  Object.keys(KIT_MAP).forEach(kit => {
    if (kit === "Overall") return;
    const kitConfig = KIT_MAP[kit];
    let evaluatedTier = null;

    if (DATA[kit]) {
      for (let tier in DATA[kit]) {
        if (DATA[kit][tier].includes(name)) {
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
    if (DATA[kit]) {
      for (let tier in DATA[kit]) {
        if (DATA[kit][tier].includes(name)) {
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

function filterPlayerVisible(name) {
  const regionEl = document.getElementById('filterRegion');
  const deviceEl = document.getElementById('filterDevice');
  const region = regionEl ? regionEl.value : '';
  const device = deviceEl ? deviceEl.value : '';

  const pDetail = getPlayerMeta(name);

  if (region && pDetail.region !== region) return false;
  if (device && pDetail.device !== device) return false;

  return true;
}

function applyFilters() {
  renderCurrentTab();
}

function resetFilters() {
  document.getElementById('filterRegion').value = '';
  document.getElementById('filterDevice').value = '';
  document.getElementById('filterRetired').value = 'active';
  renderCurrentTab();
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
  if (!IS_ADMIN) return alert("Whitelisted staff admin access required.");

  const p1 = document.getElementById('sdP1').value.trim();
  const p2 = document.getElementById('sdP2').value.trim();
  const kit = document.getElementById('sdKit').value;
  const winner = document.getElementById('sdWinner').value.trim();
  const s1 = parseInt(document.getElementById('sdS1').value, 10) || 0;
  const s2 = parseInt(document.getElementById('sdS2').value, 10) || 0;
  const outcome = document.getElementById('sdOutcome').value.trim() || 'Rank Match';
  const newTier = document.getElementById('sdNewTier').value;

  if (!p1 || !p2 || !winner) return alert("Please fill in Player 1, Player 2, and Winner!");

  const dateStr = new Date().toISOString().split('T')[0];
  const timestamp = Date.now();

  const recordP1 = { timestamp, date: dateStr, kit, outcome, player1: p1, player2: p2, player1_score: s1, player2_score: s2, result: winner.toLowerCase() === p1.toLowerCase() ? 'Won' : 'Lost' };
  const recordP2 = { timestamp, date: dateStr, kit, outcome, player1: p1, player2: p2, player1_score: s1, player2_score: s2, result: winner.toLowerCase() === p2.toLowerCase() ? 'Won' : 'Lost' };

  showToast("Submitting duel & updating rankings...");

  try {
    if (db) {
      const p1Ref = db.collection('duels').doc(p1);
      const p1Doc = await p1Ref.get();
      let p1List = p1Doc.exists && Array.isArray(p1Doc.data().duels) ? p1Doc.data().duels : [];
      p1List.unshift(recordP1);
      await p1Ref.set({ player: p1, duels: p1List, count: p1List.length, last_updated: dateStr }, { merge: true });

      const p2Ref = db.collection('duels').doc(p2);
      const p2Doc = await p2Ref.get();
      let p2List = p2Doc.exists && Array.isArray(p2Doc.data().duels) ? p2Doc.data().duels : [];
      p2List.unshift(recordP2);
      await p2Ref.set({ player: p2, duels: p2List, count: p2List.length, last_updated: dateStr }, { merge: true });

      if (newTier) {
        const kitRef = db.collection('rankings').doc(kit);
        const kitDoc = await kitRef.get();
        let kitData = kitDoc.exists ? kitDoc.data() : {};
        if (kitData.tiers) kitData = kitData.tiers;

        for (let t in kitData) {
          if (Array.isArray(kitData[t])) {
            kitData[t] = kitData[t].filter(name => name.toLowerCase() !== winner.toLowerCase());
          }
        }
        if (!kitData[newTier]) kitData[newTier] = [];
        if (!kitData[newTier].includes(winner)) kitData[newTier].push(winner);

        await kitRef.set({ tiers: kitData }, { merge: true });
        DATA[kit] = kitData;
        computeOverallPoints();
      }
    }

    closeSubmitDuelModal();
    showToast("⚔️ Duel recorded & Tier updated!");
    renderCurrentTab();
  } catch (e) {
    alert("Failed to submit duel: " + e.message);
  }
}

function openEditProfileModal() {
  if (!CURRENT_PLAYER) return;
  const pDetail = getPlayerMeta(CURRENT_PLAYER);

  document.getElementById('epSub').innerText = `Editing profile for ${CURRENT_PLAYER}`;
  document.getElementById('epSkinUrl').value = pDetail.skinUrl || '';
  document.getElementById('epBannerUrl').value = pDetail.bannerUrl || '';
  document.getElementById('epColor').value = pDetail.accentColor || '#00eeff';
  document.getElementById('epLfm').value = pDetail.lfm ? 'ON' : 'OFF';
  document.getElementById('epRival').value = pDetail.rival || '';
  document.getElementById('epDesc').value = pDetail.description || '';

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
  if (!CURRENT_PLAYER) return;

  // Strict security authorization check
  if (!isAuthorizedToEditProfile(CURRENT_PLAYER)) {
    alert("❌ Security Violation: You are not authorized to edit this player profile!");
    closeEditProfileModal();
    return;
  }

  const rawSkin = document.getElementById('epSkinUrl').value.trim();
  const rawBanner = document.getElementById('epBannerUrl').value.trim();
  const accentColor = document.getElementById('epColor').value;
  const lfm = document.getElementById('epLfm').value === 'ON';
  const rawRival = document.getElementById('epRival').value.trim();
  const rawDesc = document.getElementById('epDesc').value.trim();

  // Validate URLs to prevent XSS / malicious schemes
  const skinUrl = sanitizeSafeUrl(rawSkin);
  const bannerUrl = sanitizeSafeUrl(rawBanner);

  if (rawSkin && !skinUrl) {
    return alert("Invalid Skin Image URL! Must start with http:// or https://");
  }
  if (rawBanner && !bannerUrl) {
    return alert("Invalid Banner Image URL! Must start with http:// or https://");
  }

  const rival = escapeHTML(rawRival).slice(0, 50);
  const description = escapeHTML(rawDesc).slice(0, 500);

  let pIndex = (DATA.Players || []).findIndex(p => (typeof p === 'object' ? p.name : p).toLowerCase() === CURRENT_PLAYER.toLowerCase());
  let existingObj = pIndex !== -1 && typeof DATA.Players[pIndex] === 'object' ? DATA.Players[pIndex] : { name: CURRENT_PLAYER };

  const updatedObj = {
    ...existingObj,
    name: CURRENT_PLAYER,
    skinUrl,
    bannerUrl,
    accentColor: /^#[0-9a-fA-F]{6}$/.test(accentColor) ? accentColor : '#00eeff',
    lfm,
    rival,
    description
  };

  if (pIndex !== -1) {
    DATA.Players[pIndex] = updatedObj;
  } else {
    if (!DATA.Players) DATA.Players = [];
    DATA.Players.push(updatedObj);
  }

  showToast("Saving profile customization...");

  try {
    let saved = false;
    if (db) {
      try {
        await db.collection('rankings').doc('players_meta').set({ players: DATA.Players }, { merge: true });
        saved = true;
      } catch (err) {
        console.warn("Firestore SDK write note:", err.message);
      }
    }

    if (!saved) {
      let idToken = '';
      if (auth && auth.currentUser) {
        try { idToken = await auth.currentUser.getIdToken(); } catch (e) {}
      }
      const headers = { 'Content-Type': 'application/json' };
      if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

      const patchRes = await fetch("https://firestore.googleapis.com/v1/projects/mtctiers/databases/(default)/documents/rankings/players_meta?updateMask.fieldPaths=players", {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          fields: {
            players: {
              arrayValue: {
                values: DATA.Players.map(pyToFirestoreValue)
              }
            }
          }
        })
      });

      if (!patchRes.ok) {
        const errJson = await patchRes.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `HTTP ${patchRes.status} Error`);
      }
    }

    closeEditProfileModal();
    openProfile(CURRENT_PLAYER);
    renderCurrentTab();
    showToast("✨ Profile updated successfully on Firebase!");
  } catch (e) {
    alert("❌ Failed to save profile to Firebase database: " + e.message);
  }
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

async function addEmailToWhitelist() {
  const input = document.getElementById('adNewEmail');
  const roleSelect = document.getElementById('adRole');
  const playerSelect = document.getElementById('adAssignedPlayer');

  const val = input.value.trim().toLowerCase();
  const role = roleSelect ? roleSelect.value : 'player';
  const assignedPlayer = playerSelect ? playerSelect.value : '*';

  if (!val) return alert("Please enter an email or username");

  const newHash = await sha256Hex(val);

  let existingIndex = WHITELIST_ENTRIES.findIndex(e => e.hash === newHash || (e.label && e.label.toLowerCase().includes(val)));

  const newEntry = {
    label: `${val} (${role === 'admin' ? 'Admin' : 'Player'})`,
    hash: newHash,
    role,
    assignedPlayer
  };

  if (existingIndex !== -1) {
    WHITELIST_ENTRIES[existingIndex] = newEntry;
  } else {
    WHITELIST_ENTRIES.push(newEntry);
  }

  input.value = '';
  renderWhitelistItems();

  try {
    if (db) {
      const hashes = WHITELIST_ENTRIES.map(e => e.hash);
      await db.collection('rankings').doc('whitelist').set({
        hashes,
        entries: JSON.stringify(WHITELIST_ENTRIES)
      });
      showToast(`Saved ${val} permissions (${role.toUpperCase()})!`);
    }
  } catch (e) {
    alert("Failed to update whitelist: " + e.message);
  }
}

async function removeEmailFromWhitelist(targetHash) {
  WHITELIST_ENTRIES = WHITELIST_ENTRIES.filter(e => e.hash !== targetHash);
  renderWhitelistItems();

  try {
    if (db) {
      const hashes = WHITELIST_ENTRIES.map(e => e.hash);
      await db.collection('rankings').doc('whitelist').set({
        hashes,
        entries: JSON.stringify(WHITELIST_ENTRIES)
      });
      showToast(`Removed entry from Whitelist`);
    }
  } catch (e) {
    alert("Failed to update whitelist: " + e.message);
  }
}

function handleSearch(val) {
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
}

function copyProfileLink() {
  if (!CURRENT_PLAYER) return;
  const url = new URL(window.location.href);
  url.searchParams.set('player', CURRENT_PLAYER);
  navigator.clipboard.writeText(url.toString()).then(() => showToast("Profile link copied!"));
}

function copyEmbedCode() {
  if (!CURRENT_PLAYER) return;
  const url = new URL(window.location.href);
  url.searchParams.set('player', CURRENT_PLAYER);
  const code = `<iframe src="${url.toString()}" width="500" height="400" style="border:none;border-radius:16px;"></iframe>`;
  navigator.clipboard.writeText(code).then(() => showToast("Embed iframe code copied!"));
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.innerText = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function handleUrlParamsOnLoad() {
  const params = new URLSearchParams(window.location.search);
  const player = params.get('player');
  const tab = params.get('tab');
  if (tab === 'duels' || tab === 'hof' || tab === 'testers' || tab === 'rankings') {
    switchTab(tab);
  }
  if (player && DATA.Overall && player in DATA.Overall) {
    openProfile(player);
  }
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
