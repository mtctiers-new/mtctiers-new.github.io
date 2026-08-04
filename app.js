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
try {
  if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    console.log("Firebase initialized successfully.");
  }
} catch (e) {
  console.warn("Firebase init note:", e.message);
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

async function loadRankingsData() {
  try {
    const res = await fetch(`data/rankings.json?v=${Date.now()}`);
    DATA = await res.json();

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
          const name = p.trim();
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

  if (tab === 'home') {
    CURRENT_KIT = 'Overall';
    updateKitBarActive('Overall');
    kitBar.style.display = 'flex';
    filterBar.style.display = 'flex';
  } else if (tab === 'rankings') {
    if (CURRENT_KIT === 'Overall') {
      CURRENT_KIT = 'Emerald'; // Default to first kit when clicking KITS nav tab
    }
    updateKitBarActive(CURRENT_KIT);
    kitBar.style.display = 'flex';
    filterBar.style.display = 'flex';
  } else {
    kitBar.style.display = 'none';
    filterBar.style.display = 'none';
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
      renderOverallLeaderboard();
    } else if (CURRENT_KIT === 'All Kits') {
      renderAllKitsVerticalView();
    } else {
      renderKitView(CURRENT_KIT);
    }
  } else if (CURRENT_TAB === 'rules') {
    podiumWrap.innerHTML = '';
    renderRulesView();
  } else if (CURRENT_TAB === 'hof') {
    podiumWrap.innerHTML = '';
    renderHofView();
  } else if (CURRENT_TAB === 'testers') {
    podiumWrap.innerHTML = '';
    renderTestersView();
  } else if (CURRENT_TAB === 'duels') {
    podiumWrap.innerHTML = '';
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
          <img src="${skinPath}" alt="${name}" class="podium-avatar" onerror="this.style.opacity='0.2'">
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
          <img src="${skinPath}" class="ol-avatar" onerror="this.style.opacity='0.2'">
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
          <img src="${skinPath}" class="tier-card-avatar" onerror="this.src='assets/steve.png'">
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
  const isP1 = d.player1 === playerName;
  const won = isP1 ? d.result === 'Won' : d.result === 'Lost';
  const myScore = isP1 ? d.player1_score : d.player2_score;
  const oppScore = isP1 ? d.player2_score : d.player1_score;
  const opponent = isP1 ? d.player2 : d.player1;
  return { won, myScore, oppScore, opponent, isP1 };
}

function duelDescLine(d, playerName) {
  const kit = d.kit === 'Unknown' ? '' : d.kit;
  const tier = d.tier === 'Unknown' ? '' : d.tier;
  if (d.outcome && d.outcome !== 'tested') {
    const subject = d.player1;
    if (d.outcome === 'failed') {
      return `${subject} failed${tier ? ' ' + tier : ''}${kit ? ' in ' + kit : ''}`;
    }
    const verb = d.outcome === 'promoted' ? 'promoted to' : 'demoted to';
    return `${subject} has been ${verb}${tier ? ' ' + tier : ''}${kit ? ' in ' + kit : ''}`;
  }
  return `${kit}${tier ? ' · ' + tier : ''}`.trim();
}

function openDuelPopup(d, perspective) {
  const p = perspective || d.player1;
  const info = duelPerspective(d, p);
  const date = new Date(d.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
    const key = d.id || `${d.player1}_${d.player2}_${d.timestamp}`;
    if (!map.has(key)) map.set(key, d);
  });
  const list = Array.from(map.values());
  return list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

async function fetchDuelsFromFirestore(playerFilter) {
  const baseREST = "https://firestore.googleapis.com/v1/projects/mtctiers/databases/(default)/documents/duels";
  
  if (playerFilter) {
    if (db) {
      try {
        const docRef = await db.collection('duels').doc(playerFilter).get();
        if (docRef.exists) {
          const data = docRef.data();
          if (data.duels && Array.isArray(data.duels)) return data.duels;
        }
      } catch (e) { console.warn("Firestore SDK fetch note:", e.message); }
    }
    try {
      const res = await fetch(`${baseREST}/${encodeURIComponent(playerFilter)}`);
      if (res.ok) {
        const docData = await res.json();
        const rawDuels = docData.fields?.duels?.arrayValue?.values || [];
        return rawDuels.map(item => parseFirestoreMap(item.mapValue?.fields || {}));
      }
    } catch (e) { console.warn("Firestore REST player fetch note:", e.message); }
  } else {
    if (db) {
      try {
        const snap = await db.collection('duels').get();
        let allDuels = [];
        snap.forEach(doc => {
          const data = doc.data();
          if (data.duels && Array.isArray(data.duels)) {
            allDuels.push(...data.duels);
          }
        });
        if (allDuels.length) return dedupeAndSortDuels(allDuels);
      } catch (e) { console.warn("Firestore SDK all duels note:", e.message); }
    }
    try {
      const res = await fetch(`${baseREST}?pageSize=300`);
      if (res.ok) {
        const data = await res.json();
        const docs = data.documents || [];
        let allDuels = [];
        docs.forEach(doc => {
          const rawDuels = doc.fields?.duels?.arrayValue?.values || [];
          rawDuels.forEach(item => {
            allDuels.push(parseFirestoreMap(item.mapValue?.fields || {}));
          });
        });
        if (allDuels.length) return dedupeAndSortDuels(allDuels);
      }
    } catch (e) { console.warn("Firestore REST all duels note:", e.message); }
  }

  try {
    const res = await fetch(`data/duels.json?v=${Date.now()}`);
    if (res.ok) {
      const localData = await res.json();
      if (playerFilter) {
        const pList = localData[playerFilter] || [];
        return Array.isArray(pList) ? pList : (pList.duels || []);
      } else {
        let allDuels = [];
        Object.values(localData).forEach(val => {
          if (Array.isArray(val)) allDuels.push(...val);
          else if (val && val.duels) allDuels.push(...val.duels);
        });
        if (allDuels.length) return dedupeAndSortDuels(allDuels);
      }
    }
  } catch (e) { console.warn("Local duels.json fetch note:", e.message); }

  return [];
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
  skinImg.onerror = function() { this.style.opacity = '0.2'; };

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

  const pDetail = (DATA.Players || []).find(p => p.name === name) || {};
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

  overlay.classList.add('active');
}

function closeProfileModal() {
  document.getElementById('profileModalOverlay').classList.remove('active');
}

function closeModalOnBackdrop(e) {
  if (e.target.id === 'profileModalOverlay') {
    closeProfileModal();
  }
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

function getPlayerSkinSrc(name) {
  const cleanName = name.toLowerCase();
  return `assets/${cleanName}.png`;
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
  const region = document.getElementById('filterRegion').value;
  const device = document.getElementById('filterDevice').value;
  const pDetail = (DATA.Players || []).find(p => p.name === name);

  if (region && pDetail && pDetail.region !== region) return false;
  if (device && pDetail && pDetail.device !== device) return false;

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
