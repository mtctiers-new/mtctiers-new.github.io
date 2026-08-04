const AUTH_API = "https://mtc-backend-production-e0ab.up.railway.app/api";

const KIT_MAP = {
    "Overall":           { img:"",                              color:"var(--gold)"  },
    "Emerald":           { img:"assets/emerald.png",           color:"#1a7a1a"      },
    "Emerald KB":        { img:"assets/emerald_kb.png",        color:"#00e5b0"      },
    "Dragonhide KB":     { img:"assets/dragonhide_kb.png",     color:"#ff6a00"      },
    "Manhunt":           { img:"assets/manhunt.png",           color:"#ff1a6b"      },
    "Diamond":           { img:"assets/diamond.png",           color:"#00c8ff"      },
    "Novelty Axe":       { img:"assets/novelty_axe.png",       color:"#ffaa00"      },
    "Dragonhide Anchor": { img:"assets/dragonhide_anchor.png", color:"#8a2be2"      },
    "Void":              { img:"assets/void.png",              color:"#ff00ff"      },
};
const REGION_MAP = {
    "NA":{ label:"North America",color:"#3498db"},"SA":{ label:"South America",color:"#00ff88"},
    "EU":{ label:"Europe",color:"#ff4d4d"},"AS":{ label:"Asia",color:"#ff8800"},
    "OC":{ label:"Oceania",color:"#ff00ff"},"AF":{ label:"Africa",color:"#00d4ff"},
};
const DEVICE_MAP = {
    "MK":{ label:"Mouse & Keyboard",color:"#00ffff"},"MB":{ label:"Mobile",color:"#ff7f50"},
    "CT":{ label:"Controller",color:"#b044ff"},"TP":{ label:"Touchpad",color:"#ff00aa"},
};
const THEME_PRESETS = {
    "DEFAULT": { bg:"",border:"",glow:"",name:"",nameStyle:"" },
    "CYBER":   { bg:"#06060a",border:"#00eeff",glow:"#00eeff",name:"#00eeff",nameStyle:"" },
    "GOLD":    { bg:"linear-gradient(135deg,#0a0800,#1a1200)",border:"#ffd700",glow:"#ffd700",name:"",nameStyle:"gradient:#ffd700-#ff8800" },
    "VOID":    { bg:"linear-gradient(135deg,#0a0010,#1a0030)",border:"#b044ff",glow:"#b044ff",name:"",nameStyle:"gradient:#b044ff-#ff00ff" },
    "BLOOD":   { bg:"linear-gradient(135deg,#0d0000,#1a0000)",border:"#ff3333",glow:"#ff3333",name:"#ff6666",nameStyle:"glow:#ff3333" },
    "OCEAN":   { bg:"linear-gradient(135deg,#00080d,#001a2a)",border:"#0088ff",glow:"#0088ff",name:"",nameStyle:"gradient:#0088ff-#00eeff" },
    "FOREST":  { bg:"linear-gradient(135deg,#000a00,#001a00)",border:"#00cc44",glow:"#00cc44",name:"#44ff88",nameStyle:"glow:#00cc44" },
    "SUNSET":  { bg:"linear-gradient(135deg,#0d0500,#1a0a00)",border:"#ff6a00",glow:"#ff6a00",name:"",nameStyle:"gradient:#ff6a00-#ffd700" },
    "RAINBOW": { bg:"#06060a",border:"#ff00ff",glow:"#ff00ff",name:"",nameStyle:"animated" },
};

let AUTH = null;
const TOKEN_KEY  = "mtc_token";
const saveToken  = t => localStorage.setItem(TOKEN_KEY,t);
const loadToken  = ()=> localStorage.getItem(TOKEN_KEY)||"";
const clearToken = ()=> localStorage.removeItem(TOKEN_KEY);

async function authCall(method,path,body){
    const opts={method,headers:{"Content-Type":"application/json","Authorization":`Bearer ${loadToken()}`}};
    if(body!==undefined) opts.body=JSON.stringify(body);
    let res;
    try{ res=await fetch(AUTH_API+path,opts); }
    catch(e){ throw new Error("Cannot reach server."); }
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error||`Error ${res.status}`);
    return data;
}
async function restoreSession(){
    if(!loadToken()) return;
    try{ const d=await authCall("GET","/me"); AUTH={name:d.name,role:d.role,profile:d.profile}; updateNavAuth(); }
    catch(_){ clearToken(); AUTH=null; }
}
async function doLogin(){
    const name=document.getElementById('lcName').value.trim();
    const code=document.getElementById('lcCode').value.trim();
    const btn=document.getElementById('lcSubmit');
    if(!name||!code) return;
    btn.disabled=true; btn.textContent="LOGGING IN...";
    try{
        const d=await authCall("POST","/login",{name,code});
        saveToken(d.token);
        AUTH={name:d.name,role:d.role,profile:null};
        try{ const me=await authCall("GET","/me"); AUTH.profile=me.profile; }catch(_){}
        updateNavAuth(); playBtnSound(); setTimeout(closeLoginModal,300);
    }catch(err){
        let el=document.getElementById('lcErrMsg');
        if(!el){ el=document.createElement('div'); el.id='lcErrMsg'; el.style.cssText='font-family:"MultiCraftFont",monospace;font-size:0.5rem;color:#ff4444;text-align:center;margin-top:8px;letter-spacing:1px;'; document.getElementById('lcSubmit').after(el); }
        el.textContent=err.message||"Login failed."; setTimeout(()=>{ if(el) el.textContent=""; },3000);
    }finally{ btn.disabled=false; btn.textContent="LOGIN"; }
}
async function doLogout(){
    try{ await authCall("POST","/logout"); }catch(_){}
    clearToken(); AUTH=null; updateNavAuth();
}

async function saveProfileEdits(){
    const btn=document.getElementById('peSave');
    const msg=document.getElementById('peMsg');
    if(!btn) return;
    btn.disabled=true; btn.textContent="SAVING...";
    try{
        const socialEntries=[];
        document.querySelectorAll('.social-entry').forEach(row=>{
            const label=row.querySelector('.pe-social-label')?.value.trim()||"";
            const url=row.querySelector('.pe-social-url')?.value.trim()||"";
            const icon=row.dataset.icon||"";
            if(label||url||icon) socialEntries.push({label,url,icon});
        });
        const parseColor=v=>{ v=(v||"").trim(); if(!v) return ""; if(/^#[0-9a-fA-F]{3,8}([-,]#[0-9a-fA-F]{3,8})+$/.test(v)){ return `linear-gradient(135deg,${v.split(/[-,]/).filter(s=>s.startsWith('#')).join(',')})`; } return v; };
        const d=await authCall("PATCH","/profile",{
            pronouns:          document.getElementById('pePronouns')?.value.trim()||"",
            description:       document.getElementById('peDescription')?.value.trim()||"",
            rival:             document.getElementById('peRival')?.value.trim()||"",
            banner:            parseColor(document.getElementById('peBanner')?.value||""),
            lfm_status:        document.getElementById('peLfm')?.checked?1:0,
            socials:           socialEntries,
            theme_bg:          parseColor(document.getElementById('peThemeBg')?.value||""),
            theme_bg_image:    AUTH?.profile?.theme_bg_image||"",
            theme_border:      document.getElementById('peThemeBorder')?.value.trim()||"",
            theme_glow:        document.getElementById('peThemeGlow')?.value.trim()||"",
            theme_name_color:  document.getElementById('peThemeNameColor')?.value.trim()||"",
            theme_name_style:  document.getElementById('_peNameStylePreset')?.value||'',
            theme_name_glow:   document.getElementById('peThemeNameGlow')?.value.trim()||'',
            custom_colors:     window._customColors||{},
        });
        if(AUTH) AUTH.profile=d.profile;
        const currentName=document.getElementById('pName')?.innerText.trim();
        if(currentName&&document.getElementById('profileModal').style.display!=='none'){
            clearProfileExtras();
            applyRankTitleBadge(currentName);
            applyProfileTheme(d.profile);
            injectProfileExtras(currentName,AUTH.role,d.profile);
            injectEditPanel(currentName);
        }
        if(msg){ msg.textContent="✓ Saved!"; msg.className="pe-msg ok"; }
    }catch(err){
        if(msg){ msg.textContent=err.message||"Save failed."; msg.className="pe-msg err"; }
    }finally{
        if(btn){ btn.disabled=false; btn.textContent="SAVE CHANGES"; }
        setTimeout(()=>{ if(msg) msg.textContent=""; },3000);
    }
}

async function saveBgImage(b64){
    if(!AUTH) return;
    try{
        const d=await authCall("PATCH","/profile",{theme_bg_image:b64});
        if(AUTH) AUTH.profile=d.profile;
        const modal=document.querySelector('.profile-modal-content');
        if(modal&&b64){
            modal.style.background="";
            modal.style.backgroundColor="";
            modal.style.backgroundImage=`url(${b64})`;
            modal.style.backgroundSize="cover";
            modal.style.backgroundPosition="center";
            modal.style.backgroundRepeat="no-repeat";
        }
        const prev=document.getElementById('bgImgPreview');
        if(prev) prev.style.background=`url(${b64}) center/cover`;
        const currentName=document.getElementById('pName')?.innerText.trim();
        if(currentName) injectEditPanel(currentName);
    }catch(e){ console.warn("BG image save failed",e); }
}
async function clearBgImage(){
    if(!AUTH) return;
    try{
        const d=await authCall("PATCH","/profile",{theme_bg_image:""});
        if(AUTH) AUTH.profile=d.profile;
        const modal=document.querySelector('.profile-modal-content');
        if(modal){
            modal.style.background="";
            modal.style.backgroundColor="";
            modal.style.backgroundImage="";
            modal.style.backgroundSize="";
            modal.style.backgroundPosition="";
            modal.style.backgroundRepeat="";
            if(d.profile?.theme_bg) modal.style.background=d.profile.theme_bg;
        }
        const prev=document.getElementById('bgImgPreview');
        if(prev) prev.style.background='#111';
        const currentName=document.getElementById('pName')?.innerText.trim();
        if(currentName) injectEditPanel(currentName);
    }catch(e){ console.warn(e); }
}

function updateNavAuth(){
    const btn=document.getElementById('loginNavBtn');
    const badge=document.getElementById('navUserBadge');
    if(!btn) return;
    if(AUTH){
        btn.textContent="LOGOUT"; btn.classList.add('li');
        document.getElementById('navUserName').textContent=AUTH.name;
        const urole=document.getElementById('navUserRole');
        urole.textContent=AUTH.role.toUpperCase(); urole.dataset.r=AUTH.role;
        badge.classList.add('vis');
    }else{
        btn.textContent="LOGIN"; btn.classList.remove('li');
        badge.classList.remove('vis');
    }
}
let _logoutConfirm=false;
function handleAuthBtn(){
    playBtnSound();
    if(!AUTH){ openLoginModal(); return; }
    if(_logoutConfirm){ doLogout(); _logoutConfirm=false; return; }
    _logoutConfirm=true;
    const btn=document.getElementById('loginNavBtn');
    btn.textContent="CONFIRM?"; btn.style.color="#ff4444"; btn.style.borderColor="#ff4444";
    setTimeout(()=>{ _logoutConfirm=false; btn.textContent="LOGOUT"; btn.style.color=""; btn.style.borderColor=""; },2500);
}
function openLoginModal(){ document.getElementById('loginModal').classList.add('open'); document.getElementById('lcName').focus(); }
function closeLoginModal(){ document.getElementById('loginModal').classList.remove('open'); document.getElementById('lcCode').value=""; }
document.getElementById('lcName').addEventListener('keydown',e=>{ if(e.key==='Enter') doLogin(); });
document.getElementById('lcCode').addEventListener('keydown',e=>{ if(e.key==='Enter') doLogin(); });

function parseCss(v){
    v=(v||"").trim(); if(!v) return "";
    if(/^#[0-9a-fA-F]{3,8}([-,]#[0-9a-fA-F]{3,8})+$/.test(v))
        return `linear-gradient(135deg,${v.split(/[-,]/).filter(s=>s.startsWith('#')).join(',')})`;
    return v;
}

function applyNameStyle(el, color, style, glowHex){
    el.style.color="";
    el.style.webkitTextFillColor="";
    el.style.webkitBackgroundClip="";
    el.style.backgroundClip="";
    el.style.backgroundImage="";
    el.style.backgroundSize="";
    el.style.textShadow="";
    el.style.filter="";
    el.classList.remove('name-animated');

    if(!glowHex && style&&style.startsWith("glow:")){
        glowHex = style.slice(5);
        style = "";
    }

    const applyGlow = ()=>{
        if(!glowHex) return;
        let g = glowHex;
        if(/^#[0-9a-fA-F]{3}$/.test(g)){
            g = '#' + g.slice(1).split('').map(ch=>ch+ch).join('');
        }
        if(el.style.webkitTextFillColor==='transparent'){
            el.style.filter = `drop-shadow(0 0 4px ${g}99) drop-shadow(0 0 9px ${g}55)`;
        } else {
            const base = el.style.textShadow ? el.style.textShadow+',' : '';
            el.style.textShadow = `${base}0 0 6px ${g}99,0 0 14px ${g}4d`;
        }
    };

    if(style==="animated"){
        el.classList.add('name-animated');
        applyGlow();
        return;
    }
    if(style&&style.startsWith("gradient:")){
        const stops=style.slice(9).split(/[-,]/).filter(s=>s.startsWith('#'));
        if(stops.length>=2){
            el.style.backgroundImage=`linear-gradient(90deg,${stops.join(',')})`;
            el.style.backgroundSize="100% 100%";
            el.style.webkitBackgroundClip="text";
            el.style.backgroundClip="text";
            el.style.webkitTextFillColor="transparent";
            applyGlow();
            return;
        }
    }
    if(color){
        const parsed=parseCss(color);
        const stops=(color.match(/#[0-9a-fA-F]{3,8}/g)||[]);
        if(parsed.includes("gradient") && stops.length>=2){
            el.style.backgroundImage = `linear-gradient(90deg,${stops.join(',')})`;
            el.style.backgroundSize="100% 100%";
            el.style.webkitBackgroundClip="text";
            el.style.backgroundClip="text";
            el.style.webkitTextFillColor="transparent";
            applyGlow();
            return;
        }else if(stops.length===1){

            el.style.color=stops[0];
        }else{
            el.style.color=color;
        }
    }
    applyGlow();
}

function applyProfileTheme(profile){
    const modal=document.querySelector('.profile-modal-content');
    const nameEl=document.getElementById('pName');
    if(!modal||!profile) return;

    const bgImg    = profile.theme_bg_image||"";
    const bg       = profile.theme_bg||"";
    const border   = profile.theme_border||"";
    const glow     = profile.theme_glow||"";
    const nameC    = profile.theme_name_color||"";
    const nameStyle= profile.theme_name_style||"";
    const banner   = profile.banner||"";

    if(bgImg){
        modal.style.backgroundImage=`url(${bgImg})`;
        modal.style.backgroundSize="cover";
        modal.style.backgroundPosition="center";
        modal.style.backgroundRepeat="no-repeat";
        modal.style.backgroundColor="transparent";
    } else if(bg){
        modal.style.backgroundImage="none";
        modal.style.backgroundColor="";
        modal.style.backgroundSize="";
        modal.style.backgroundPosition="";
        modal.style.background=bg;
    } else {
        modal.style.backgroundImage="";
        modal.style.background="";
        modal.style.backgroundColor="";
    }

    modal.style.borderColor=border||"";
    modal.style.boxShadow=glow?`0 0 40px ${glow}55,0 0 80px ${glow}22`:"";
    if(nameEl) applyNameStyle(nameEl, nameC, nameStyle, profile.theme_name_glow||'');

    if(banner){
        let strip=document.querySelector('.profile-banner-strip');
        if(!strip){ strip=document.createElement('div'); strip.className='profile-banner-strip'; modal.prepend(strip); }
        strip.style.background=banner;
    }
}

function resetProfileTheme(){
    const modal=document.querySelector('.profile-modal-content');
    const nameEl=document.getElementById('pName');
    if(modal){
        modal.style.background=""; modal.style.backgroundImage="";
        modal.style.backgroundColor=""; modal.style.backgroundSize="";
        modal.style.backgroundPosition=""; modal.style.backgroundRepeat="";
        modal.style.borderColor=""; modal.style.boxShadow="";
    }
    if(nameEl){
        nameEl.style.color=""; nameEl.style.webkitTextFillColor="";
        nameEl.style.webkitBackgroundClip=""; nameEl.style.backgroundClip="";
        nameEl.style.backgroundImage=""; nameEl.style.backgroundSize="";
        nameEl.style.textShadow=""; nameEl.classList.remove('name-animated');
    }
}

function toggleEditDropdown(toggle){
    toggle.classList.toggle('open');
    document.getElementById('editDropdownBody')?.classList.toggle('vis');
}

function injectEditPanel(profileName){
    document.getElementById('profileEditPanel')?.remove();
    if(!AUTH||AUTH.name!==profileName) return;
    const p=AUTH.profile||{};
    const left=document.querySelector('.profile-left');
    if(!left) return;

    const toShorthand=v=>{ if(!v) return ''; const m=v.match(/linear-gradient\([^,]+,(#[0-9a-fA-F]{3,8}(?:,#[0-9a-fA-F]{3,8})*)\)/); return m?m[1].replace(/,/g,'-'):v; };
    const socialsArr=Array.isArray(p.socials)?p.socials:[];
    let socialsHtml='';
    socialsArr.forEach((s,i)=>{
        const iconHtml=s.icon?`<img src="${s.icon}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:3px;">`:`<span style="font-size:0.5rem;">📷</span>`;
        socialsHtml+=`<div class="social-entry" data-icon="${esc(s.icon||'')}">
            <div class="social-icon-btn" onclick="pickSocialIcon(this)">${iconHtml}</div>
            <input class="pe-input pe-social-label" placeholder="Label (optional)" maxlength="40" value="${esc(s.label||'')}">
            <input class="pe-input pe-social-url" placeholder="URL or text" maxlength="300" value="${esc(s.url||'')}">
            <button class="social-del-btn" onclick="this.closest('.social-entry').remove()">✕</button>
        </div>`;
    });
    const presetBtns=Object.keys(THEME_PRESETS).map(k=>`<button class="theme-preset-btn" onclick="applyPreset('${k}',this)">${k}</button>`).join('');
    const nsv=p.theme_name_style||"";
    const bgImgExists=!!p.theme_bg_image;

    const panel=document.createElement('div');
    panel.id='profileEditPanel'; panel.className='vis';
    panel.innerHTML=`
        <div id="editDropdownToggle" onclick="toggleEditDropdown(this)">
            <span>✏ EDIT PROFILE</span><span class="edit-arrow">▼</span>
        </div>
        <div id="editDropdownBody">
            <div class="pe-group-label">BASIC</div>
            <div><label class="pe-field-label">PRONOUNS</label>
                <input class="pe-input" id="pePronouns" placeholder="e.g. he/him" maxlength="30" value="${esc(p.pronouns||'')}"></div>
            <div><label class="pe-field-label">STATUS</label>
                <input class="pe-input" id="peDescription" placeholder="Something about you..." maxlength="120" value="${esc(p.description||'')}"></div>
            <div><label class="pe-field-label">RIVAL</label>
                <input class="pe-input" id="peRival" placeholder="Player name..." maxlength="50" value="${esc(p.rival||'')}"></div>
            <div class="lfm-wrap">
                <input type="checkbox" id="peLfm" ${p.lfm_status?'checked':''}>
                <label class="lfm-track" for="peLfm"></label>
                <span class="lfm-lbl">LOOKING FOR MATCH</span>
            </div>
            <div class="pe-group-label">SOCIALS</div>
            <div id="socialsContainer">${socialsHtml}</div>
            <button class="add-social-btn" onclick="addSocialEntry()">+ ADD SOCIAL</button>
            <div class="pe-group-label">THEME</div>
            <div class="theme-presets">${presetBtns}</div>
            <div><label class="pe-field-label">BACKGROUND <span>(#hex, #a-#b, or CSS)</span></label>
                <div class="theme-row"><div class="theme-swatch" id="swatchBg"></div>
                <input class="pe-input" id="peThemeBg" placeholder="#06060a or #0a0800-#1a1200" maxlength="300" value="${esc(toShorthand(p.theme_bg||''))}"></div></div>
            <div><label class="pe-field-label">BACKGROUND IMAGE</label>
                <div style="display:flex;gap:6px;align-items:center;">
                    <div id="bgImgPreview" style="width:40px;height:28px;border-radius:4px;border:1px solid #222;background:${bgImgExists?`url(${p.theme_bg_image}) center/cover`:'#111'};flex-shrink:0;overflow:hidden;"></div>
                    <button class="add-social-btn" style="flex:1;margin:0;" onclick="pickBgImage()">📷 UPLOAD IMAGE</button>
                    ${bgImgExists?`<button class="social-del-btn" onclick="clearBgImage()">✕</button>`:''}
                </div></div>
            <div><label class="pe-field-label">BORDER COLOR</label>
                <div class="theme-row"><div class="theme-swatch" id="swatchBorder"></div>
                <input class="pe-input" id="peThemeBorder" placeholder="#00eeff" maxlength="30" value="${esc(p.theme_border||'')}"></div></div>
            <div><label class="pe-field-label">GLOW COLOR</label>
                <div class="theme-row"><div class="theme-swatch" id="swatchGlow"></div>
                <input class="pe-input" id="peThemeGlow" placeholder="#00eeff" maxlength="30" value="${esc(p.theme_glow||'')}"></div></div>
            <div><label class="pe-field-label">NAME COLOR <span>(#hex or gradient #a-#b)</span></label>
                <div class="theme-row"><div class="theme-swatch" id="swatchName"></div>
                <input class="pe-input" id="peThemeNameColor" placeholder="#ffffff or #ff00ff-#00eeff" maxlength="100" value="${esc(p.theme_name_color||'')}"></div></div>
            <div><label class="pe-field-label">NAME GLOW <span>(#hex color, leave blank for none)</span></label>
                <div class="theme-row"><div class="theme-swatch" id="swatchNameGlow"></div>
                <input class="pe-input" id="peThemeNameGlow" placeholder="#00eeff" maxlength="30" value="${esc(p.theme_name_glow||'')}" oninput="syncNameGlowSwatch()"></div></div>
            <input type="hidden" id="_peNameStylePreset" value="${esc(nsv.startsWith('glow:')?'':nsv)}">
            <div><label class="pe-field-label">BANNER <span>(#a-#b)</span></label>
                <div class="banner-bar" id="peBannerPreview"></div>
                <input class="pe-input" id="peBanner" placeholder="#00eeff-#4122fd-#ff00ff" maxlength="200" value="${esc(toShorthand(p.banner||''))}"></div>
            <div class="pe-group-label">CUSTOM COLORS</div>
            <div style="font-family:'MultiCraftFont',monospace;font-size:0.38rem;color:#333;margin-bottom:6px;letter-spacing:1px;">Leave blank to use defaults. Accepts #hex.</div>
            <div id="colorPickersContainer"></div>
            <button class="pe-save" id="peSave" onclick="saveProfileEdits()">SAVE CHANGES</button>
            <div class="pe-msg" id="peMsg"></div>
        </div>`;
    left.appendChild(panel);

    const liveTheme=[
        {id:'peThemeBg',        sw:'swatchBg',     fn:v=>{
            const m=document.querySelector('.profile-modal-content');
            if(!m) return;
            if(AUTH?.profile?.theme_bg_image){ return; }
            m.style.backgroundImage="none"; m.style.background=parseCss(v)||"";
        }},
        {id:'peThemeBorder',    sw:'swatchBorder', fn:v=>{ const m=document.querySelector('.profile-modal-content'); if(m) m.style.borderColor=v||""; }},
        {id:'peThemeGlow',      sw:'swatchGlow',   fn:v=>{ const m=document.querySelector('.profile-modal-content'); if(m) m.style.boxShadow=v?`0 0 40px ${v}55,0 0 80px ${v}22`:""; }},
        {id:'peThemeNameColor', sw:'swatchName',   fn:v=>{ const n=document.getElementById('pName'); const st=document.getElementById('_peNameStylePreset')?.value||''; const g=document.getElementById('peThemeNameGlow')?.value.trim()||''; if(n) applyNameStyle(n,v,st,g); }},
    ];
    liveTheme.forEach(({id,sw,fn})=>{
        const inp=document.getElementById(id); const swatch=document.getElementById(sw);
        if(!inp||!swatch) return;
        const update=()=>{ const v=inp.value.trim(); swatch.style.background=parseCss(v)||"#111"; fn(v); };
        update(); inp.addEventListener('input',update);
    });
    window.syncNameGlowSwatch=()=>{
        const gv=document.getElementById('peThemeNameGlow')?.value.trim()||'';
        const sw=document.getElementById('swatchNameGlow');
        if(sw) sw.style.background=gv||'#111';
        const c2=document.getElementById('peThemeNameColor')?.value.trim()||'';
        const st=document.getElementById('_peNameStylePreset')?.value||'';
        const n=document.getElementById('pName');
        if(n) applyNameStyle(n, c2, st, gv);
    };
    document.getElementById('peThemeNameGlow')?.addEventListener('input', window.syncNameGlowSwatch);
    const bi=document.getElementById('peBanner'); const bp=document.getElementById('peBannerPreview');
    const syncBanner=()=>{
        const parsed=parseCss(bi.value);
        bp.style.background=parsed||'transparent';
        let strip=document.querySelector('.profile-banner-strip');
        if(!strip&&parsed){ strip=document.createElement('div'); strip.className='profile-banner-strip'; document.querySelector('.profile-modal-content').prepend(strip); }
        if(strip) strip.style.background=parsed||'transparent';
    };
    syncBanner(); bi.addEventListener('input',syncBanner);
    liveTheme.forEach(({id,sw,fn})=>{ const v=document.getElementById(id)?.value.trim(); const s=document.getElementById(sw); if(s) s.style.background=parseCss(v)||"#111"; if(v) fn(v); });
    if(window.syncNameGlowSwatch) window.syncNameGlowSwatch();
    buildColorPickers(p.custom_colors||{});
}

function pickBgImage(){
    const input=document.createElement('input'); input.type='file'; input.accept='image/*';
    input.onchange=()=>{
        const file=input.files[0]; if(!file) return;
        const reader=new FileReader();
        reader.onload=e=>{ saveBgImage(e.target.result); };
        reader.readAsDataURL(file);
    };
    input.click();
}
function addSocialEntry(){
    const c=document.getElementById('socialsContainer');
    if(!c||c.querySelectorAll('.social-entry').length>=8) return;
    const div=document.createElement('div'); div.className='social-entry'; div.dataset.icon='';
    div.innerHTML=`<div class="social-icon-btn" onclick="pickSocialIcon(this)"><span style="font-size:0.5rem;">📷</span></div>
        <input class="pe-input pe-social-label" placeholder="Label (optional)" maxlength="40">
        <input class="pe-input pe-social-url" placeholder="URL or text" maxlength="300">
        <button class="social-del-btn" onclick="this.closest('.social-entry').remove()">✕</button>`;
    c.appendChild(div);
}
function pickSocialIcon(btn){
    const input=document.createElement('input'); input.type='file'; input.accept='image/*';
    input.onchange=()=>{
        const file=input.files[0]; if(!file) return;
        const img=new Image(); const url=URL.createObjectURL(file);
        img.onload=()=>{
            const canvas=document.createElement('canvas'); canvas.width=48; canvas.height=48;
            canvas.getContext('2d').drawImage(img,0,0,48,48);
            const b64=canvas.toDataURL('image/png'); URL.revokeObjectURL(url);
            btn.innerHTML=`<img src="${b64}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:3px;">`;
            btn.closest('.social-entry').dataset.icon=b64;
        }; img.src=url;
    }; input.click();
}
function applyPreset(name,btn){
    document.querySelectorAll('.theme-preset-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const p=THEME_PRESETS[name]; if(!p) return;
    const toSh=v=>{ if(!v) return ''; const m=v.match(/linear-gradient\([^,]+,(#[0-9a-fA-F]{3,8}(?:,#[0-9a-fA-F]{3,8})*)\)/); return m?m[1].replace(/,/g,'-'):v; };
    const set=(id,val)=>{ const el=document.getElementById(id); if(el){ el.value=toSh(val); el.dispatchEvent(new Event('input')); } };

    const presetInput=document.getElementById('_peNameStylePreset');
    if(presetInput) presetInput.value = p.nameStyle||'';

    set('peThemeBg',p.bg); set('peThemeBorder',p.border); set('peThemeGlow',p.glow); set('peThemeNameColor',p.name);

    if(window.syncNameGlowSwatch) window.syncNameGlowSwatch();
    const _n=document.getElementById('pName');
    const _c=document.getElementById('peThemeNameColor')?.value.trim()||'';
    const _g=document.getElementById('peThemeNameGlow')?.value.trim()||'';
    const _s=document.getElementById('_peNameStylePreset')?.value||'';
    if(_n) applyNameStyle(_n,_c,_s,_g);
}

function clearProfileExtras(){
    document.querySelectorAll('.lfm-badge,.rival-badge,.profile-role-badge,.profile-pronouns,.profile-description,.custom-social-row,.profile-duel-section,.wl-badge,.wl-row').forEach(el=>el.remove());
    document.querySelector('.profile-banner-strip')?.remove();
    document.getElementById('profileEditPanel')?.remove();
    document.querySelector('.profile-toolbox')?.remove();
    resetProfileTheme();
    resetCustomColors();
}
function injectProfileExtras(name,role,profile){
    if(!profile) return;
    const badgeRow=document.getElementById('pBadgeRow');
    const meta=document.getElementById('pMeta');
    if((role==='owner'||role==='tester')&&badgeRow&&!badgeRow.querySelector('.profile-role-badge')){
        const b=document.createElement('div'); b.className=`profile-role-badge ${role}`;
        b.textContent=role==='owner'?'👑 Owner':'Tier Tester'; badgeRow.appendChild(b);
    }
    if(profile.pronouns){ const pr=document.createElement('div'); pr.className='profile-pronouns'; pr.textContent=profile.pronouns; meta.insertBefore(pr,meta.firstChild); }
    if(profile.description){ const ds=document.createElement('div'); ds.className='profile-description'; ds.textContent=profile.description; meta.appendChild(ds); }
    if(profile.rival&&badgeRow){ const b=document.createElement('div'); b.className='rival-badge'; b.textContent=`⚡ RIVAL: ${profile.rival}`; badgeRow.appendChild(b); }
    applyProfileTheme(profile);
    if(profile.custom_colors) applyCustomColors(profile.custom_colors);
    fetchWLRatio(name);

    const socials=Array.isArray(profile.socials)?profile.socials.filter(s=>s.icon||s.url):[];
    if(socials.length){
        const row=document.createElement('div'); row.className='custom-social-row';
        socials.forEach(s=>{
            const a=document.createElement('a');
            if(s.url){ a.href=s.url.startsWith('http')?s.url:`https://${s.url}`; a.target='_blank'; a.rel='noopener'; }
            else{ a.href='#'; a.onclick=e=>e.preventDefault(); }
            a.className='custom-social-link custom-social-bare';
            if(s.icon){
                const img=document.createElement('img'); img.src=s.icon; img.alt='';
                img.onerror=()=>img.remove();
                img.style.cssText='width:13px;height:13px;object-fit:cover;border-radius:2px;';
                a.appendChild(img);
            }
            const displayText = s.label || (!s.icon && s.url ? s.url : '');
            if(displayText){ const txt=document.createElement('span'); txt.textContent=displayText; a.appendChild(txt); }
            if(!s.icon && !displayText) return;
            row.appendChild(a);
        });
        const pts=document.getElementById('pPoints');
        if(pts) pts.parentNode.insertBefore(row,pts);
    }
}
const _profileCache = {};
async function getProfileCached(name){
    if(_profileCache[name]) return _profileCache[name];
    try{
        const d = await authCall("GET", `/profile/${encodeURIComponent(name)}`);
        _profileCache[name] = d;
        return d;
    }catch(_){ return null; }
}

function attachRowHover(row, name){
    let _hoverTimeout = null;
    row.addEventListener('mouseenter', ()=>{
        _hoverTimeout = setTimeout(async()=>{
            const d = await getProfileCached(name);
            if(!d||!d.profile) return;
            const p = d.profile;
            if(p.theme_bg_image){
                row.style.backgroundImage = `url(${p.theme_bg_image})`;
                row.style.backgroundSize = 'cover';
                row.style.backgroundPosition = 'center';
            } else if(p.theme_bg){
                row.style.background = p.theme_bg;
            }
            if(p.theme_border) row.style.borderColor = p.theme_border;
            if(p.theme_glow) row.style.boxShadow = `0 0 18px ${p.theme_glow}55`;
            const nameEl = row.querySelector('.ol-name');
            if(nameEl&&(p.theme_name_color||p.theme_name_style||p.theme_name_glow)){
                applyNameStyle(nameEl, p.theme_name_color||'', p.theme_name_style||'', p.theme_name_glow||'');
            }
            if(p.custom_colors){
                const cc = p.custom_colors;
                row.querySelectorAll('.ol-kit-icon').forEach(icon=>{
                    const label = icon.querySelector('.ol-kit-icon-label');
                    if(!label||!label.textContent) return;
                    const bc = icon.style.borderColor;
                    const isRetired = bc==='#444'||bc==='rgb(68, 68, 68)';
                    if(isRetired && cc.retiredTier){
                        icon.style.borderColor=cc.retiredTier;
                        label.style.color=cc.retiredTier;
                        return;
                    }
                    const img = icon.querySelector('img');
                    const src = img?.src||'';
                    const kitName = Object.keys(KIT_MAP).find(k=>k!=='Overall'&&src.includes(k.toLowerCase().replace(/ /g,'_').replace(/ /g,'_')));
                    const kitId = kitName?'kit_'+kitName.replace(/ /g,'_'):'';
                    const col = (kitId&&cc[kitId])||cc.kitAccent;
                    if(col){ icon.style.borderColor=col; label.style.color=col; }
                });
                if(cc.nameGradientA&&cc.nameGradientB&&nameEl){
                    nameEl.style.backgroundImage=`linear-gradient(90deg,${cc.nameGradientA},${cc.nameGradientB})`;
                    nameEl.style.webkitBackgroundClip='text';
                    nameEl.style.backgroundClip='text';
                    nameEl.style.webkitTextFillColor='transparent';
                }
            }
        }, 80);
    });
    row.addEventListener('mouseleave', ()=>{
        if(_hoverTimeout) clearTimeout(_hoverTimeout);
        row.style.background='';
        row.style.backgroundImage='';
        row.style.borderColor='';
        row.style.boxShadow='';
        const nameEl = row.querySelector('.ol-name');
        if(nameEl){
            nameEl.style.backgroundImage='';
            nameEl.style.webkitBackgroundClip='';
            nameEl.style.backgroundClip='';
            nameEl.style.webkitTextFillColor='';
            nameEl.style.color='';
            nameEl.style.textShadow='';
            nameEl.style.filter='';
            nameEl.classList.remove('name-animated');
        }
    });
}

const TIER_RANK_ORDER = ['HT1','LT1','HT2','LT2','HT3','LT3','HT4','LT4','HT5','LT5'];
function tierRank(t){
    if(!t) return 999;
    const base = t.startsWith('R') ? t.slice(1) : t;
    const idx = TIER_RANK_ORDER.indexOf(base);
    return idx===-1 ? 999 : idx;
}

async function computePeakTiers(playerName){
    const peaks={};
    try{
        const base=AUTH_API.replace('/api','');
        let allDuels=[], offset=0, total=null;
        while(total===null||allDuels.length<total){
            const res=await fetch(`${base}/api/duels?player=${encodeURIComponent(playerName)}&limit=200&offset=${offset}`);
            const data=await res.json();
            const batch=data.duels||[];
            allDuels=allDuels.concat(batch);
            if(total===null) total=data.total||batch.length;
            if(batch.length<200) break;
            offset+=200;
        }
        allDuels.forEach(d=>{
            if(d.player1!==playerName) return;
            if(d.outcome!=='promoted') return;
            if(!d.kit||d.kit==='Unknown') return;
            if(!d.tier||d.tier==='Unknown') return;
            const clean = d.tier.replace(/^R/,'');
            const r = tierRank(clean);
            if(r===999) return;
            if(peaks[d.kit]===undefined || r < tierRank(peaks[d.kit])) peaks[d.kit]=clean;
        });
    }catch(_){}
    return peaks;
}

async function applyPeakTiers(playerName){
    const peaks = await computePeakTiers(playerName);
    if(!Object.keys(peaks).length) return;
    const modal=document.getElementById('profileModal');
    if(!modal||modal.dataset.openPlayer!==playerName) return;

    document.querySelectorAll('#pTiers .p-kit-item').forEach(item=>{
        const popup = item.querySelector('.kit-popup');
        if(!popup) return;
        const spans = popup.querySelectorAll('span');
        const currentSpan = spans[0];
        const kitSpan     = spans[1];
        if(!currentSpan||!kitSpan) return;
        const kitName = kitSpan.textContent.trim();
        const peak = peaks[kitName];
        if(!peak) return;

        const currentText = currentSpan.textContent.replace('Retired ','').trim();
        const isUnranked  = currentText==='UNRANKED';
        if(isUnranked || tierRank(peak) < tierRank(currentText)){
            popup.querySelector('.kit-peak-line')?.remove();
            const peakLine=document.createElement('div');
            peakLine.className='kit-peak-line';
            peakLine.style.cssText='margin-top:4px;padding-top:4px;border-top:1px solid rgba(255,215,0,0.15);color:var(--gold);font-size:0.5rem;';
            peakLine.textContent=`PEAK: ${peak}`;
            popup.appendChild(peakLine);
        }
    });
}

async function fetchWLRatio(playerName){
    try{
        const base=AUTH_API.replace('/api','');
        let allDuels=[], offset=0, total=null;
        while(total===null||allDuels.length<total){
            const res=await fetch(`${base}/api/duels?player=${encodeURIComponent(playerName)}&limit=200&offset=${offset}`);
            const data=await res.json();
            const batch=data.duels||[];
            allDuels=allDuels.concat(batch);
            if(total===null) total=data.total||batch.length;
            if(batch.length<200) break;
            offset+=200;
        }
        if(!allDuels.length) return;
        let wins=0, losses=0;
        allDuels.forEach(d=>{
            if(!d.player1||!d.player2||!d.result) return;
            const isP1=d.player1===playerName;
            const won=isP1?d.result==='Won':d.result==='Lost';
            if(won) wins++; else losses++;
        });
        const modal=document.getElementById('profileModal');
        if(!modal||modal.dataset.openPlayer!==playerName) return;
        const badgeRow=document.getElementById('pBadgeRow');
        if(!badgeRow) return;
        const b=document.createElement('div');
        b.className='wl-badge';
        b.dataset.player=playerName;
        b.style.cssText='font-family:"MultiCraftFont",monospace;font-size:0.42rem;border:1px solid #222;border-radius:20px;padding:2px 8px;letter-spacing:1px;background:rgba(255,255,255,0.04);white-space:nowrap;';
        b.innerHTML=`<span style="color:#00ff88;">${wins}W</span><span style="color:#333;margin:0 3px;">/</span><span style="color:#ff4444;">${losses}L</span>`;
        badgeRow.appendChild(b);
    }catch(_){}
}

const COLOR_SLOTS = [
    {id:'rankBadge',      label:'RANK BADGE'},
    {id:'titleBadge',     label:'TITLE BADGE'},
    {id:'roleBadge',      label:'ROLE BADGE'},
    {id:'rivalBadge',     label:'RIVAL BADGE'},
    {id:'wlBadge',        label:'W/L BADGE'},
    {id:'nameGradientA',  label:'NAME GRADIENT START'},
    {id:'nameGradientB',  label:'NAME GRADIENT END'},
    {id:'pts',            label:'POINTS NUMBER'},
    {id:'kitAccent',      label:'ALL KIT CIRCLES (accent)'},
    {id:'retiredTier',    label:'RETIRED TIER COLOR'},
    ...Object.keys(KIT_MAP).filter(k=>k!=='Overall').map(k=>({id:'kit_'+k.replace(/ /g,'_'), label:k.toUpperCase()+' CIRCLE'})),
];

function buildColorPickers(colors){
    window._customColors = Object.assign({}, colors);
    const container = document.getElementById('colorPickersContainer');
    if(!container) return;
    container.innerHTML='';
    COLOR_SLOTS.forEach(slot=>{
        const row=document.createElement('div');
        row.style.cssText='display:flex;align-items:center;gap:7px;margin-bottom:5px;';
        const swatch=document.createElement('div');
        swatch.style.cssText='width:18px;height:18px;border-radius:3px;border:1px solid #222;flex-shrink:0;';
        const val=colors[slot.id]||'';
        swatch.style.background=val||'#111';
        const inp=document.createElement('input');
        inp.className='pe-input';
        inp.style.cssText='flex:1;padding:5px 8px;font-size:0.55rem;';
        inp.placeholder=slot.label+' (#hex)';
        inp.maxLength=30;
        inp.value=val;
        inp.addEventListener('input',()=>{
            const v=inp.value.trim();
            swatch.style.background=v||'#111';
            if(v) window._customColors[slot.id]=v;
            else delete window._customColors[slot.id];
            applyCustomColors(window._customColors);
        });
        row.appendChild(swatch);
        row.appendChild(inp);
        container.appendChild(row);
    });
}

function applyCustomColors(colors){
    if(!colors) return;
    const cc=colors;
    const rank=document.getElementById('pRank');
    if(rank&&cc.rankBadge){ rank.style.color=cc.rankBadge; rank.style.borderColor=cc.rankBadge+'88'; rank.style.background=cc.rankBadge+'18'; }
    const title=document.getElementById('pTitleBadge');
    if(title&&cc.titleBadge){ title.style.color=cc.titleBadge; title.style.borderColor=cc.titleBadge; title.style.background=cc.titleBadge+'18'; }
    document.querySelectorAll('.profile-role-badge').forEach(b=>{ if(cc.roleBadge){ b.style.color=cc.roleBadge; b.style.borderColor=cc.roleBadge; b.style.background=cc.roleBadge+'18'; } });
    document.querySelectorAll('.rival-badge').forEach(b=>{ if(cc.rivalBadge){ b.style.color=cc.rivalBadge; b.style.borderColor=cc.rivalBadge; b.style.background=cc.rivalBadge+'18'; } });
    document.querySelectorAll('.wl-badge').forEach(b=>{ if(cc.wlBadge){ b.style.borderColor=cc.wlBadge+'44'; } });
    const pts=document.getElementById('pPoints');
    if(pts&&cc.pts) pts.style.color=cc.pts;
    document.querySelectorAll('.p-kit-item').forEach(item=>{
        const tierLabel=item.querySelector('.p-kit-tier-label');
        const circle=item.querySelector('.p-kit-circle');
        if(!tierLabel||!circle) return;
        const spans=item.querySelectorAll('.kit-popup span');
        const currentSpan=spans[0];
        const kitSpan=spans[1];
        const kitName=kitSpan?kitSpan.textContent:'';
        const isRetired = currentSpan && currentSpan.textContent.startsWith('Retired');
        const kitId='kit_'+kitName.replace(/ /g,'_');

        if(isRetired && cc.retiredTier){
            circle.style.borderColor=cc.retiredTier;
            tierLabel.style.color=cc.retiredTier;
            if(currentSpan) currentSpan.style.color=cc.retiredTier;
            if(item.querySelector('.kit-popup')) item.querySelector('.kit-popup').style.borderColor=cc.retiredTier;
            return;
        }

        const col=cc[kitId]||cc.kitAccent;
        if(col&&circle.style.opacity!=='0.3'){
            circle.style.borderColor=col;
            tierLabel.style.color=col;
        }
    });
}

function resetCustomColors(){
    document.querySelectorAll('.profile-role-badge,.rival-badge,.wl-badge').forEach(b=>{ b.style.color=''; b.style.borderColor=''; b.style.background=''; });
    const pts=document.getElementById('pPoints');
    if(pts) pts.style.color='';
    document.querySelectorAll('.p-kit-circle').forEach(c=>{ c.style.borderColor=''; });
    document.querySelectorAll('.p-kit-tier-label').forEach(t=>{ t.style.color=''; });
    document.querySelectorAll('.kit-popup').forEach(p=>{ p.style.borderColor=''; });
    document.querySelectorAll('.kit-popup span').forEach(s=>{ s.style.color=''; });
}

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

/* ══════════════════════════════════════════════════════
   DUEL HELPERS
══════════════════════════════════════════════════════ */
function duelPerspective(d, playerName){
    const isP1 = d.player1===playerName;
    const won  = isP1 ? d.result==='Won' : d.result==='Lost';
    const myScore  = isP1 ? d.player1_score : d.player2_score;
    const oppScore = isP1 ? d.player2_score : d.player1_score;
    const opponent = isP1 ? d.player2 : d.player1;
    return { won, myScore, oppScore, opponent, isP1 };
}

function duelDescLine(d, playerName){
    const kit  = d.kit==='Unknown'?'':d.kit;
    const tier = d.tier==='Unknown'?'':d.tier;
    if(d.outcome&&d.outcome!=='tested'){
        const subject = d.player1;
        if(d.outcome==='failed'){
            return `${subject} failed${tier?' '+tier:''}${kit?' in '+kit:''}`;
        }
        const verb = d.outcome==='promoted'?'promoted to':'demoted to';
        return `${subject} has been ${verb}${tier?' '+tier:''}${kit?' in '+kit:''}`;
    }
    return `${kit}${tier?' · '+tier:''}`.trim();
}

function openDuelPopup(d, perspective){
    const p    = perspective||d.player1;
    const info = duelPerspective(d, p);
    const date = new Date(d.timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    const oc   = d.outcome||'tested';
    const ocColor = oc==='promoted'?'#00ff88':oc==='demoted'?'#ff4444':oc==='failed'?'#ff8800':'#555';

    document.getElementById('duelPopupContent').innerHTML=`
        <div style="font-family:'MultiCraftFont',monospace;text-align:center;">
            <div style="font-size:0.45rem;color:#444;letter-spacing:2px;margin-bottom:10px;">${d.kit||''} ${d.tier&&d.tier!=='Unknown'?'· '+d.tier:''}</div>
            ${oc!=='tested'?`<div style="font-size:0.5rem;color:${ocColor};border:1px solid ${ocColor};border-radius:20px;padding:3px 14px;display:inline-block;margin-bottom:12px;letter-spacing:2px;">${oc.toUpperCase()}</div>`:''}
            <div style="display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:10px;">
                <span style="font-size:0.8rem;color:#fff;cursor:pointer;" onclick="closeDuelPopup();openProfile('${d.player1}')">${d.player1}</span>
                <span style="font-size:0.4rem;color:#333;">vs</span>
                <span style="font-size:0.8rem;color:#777;cursor:pointer;" onclick="closeDuelPopup();openProfile('${d.player2}')">${d.player2}</span>
            </div>
            <div style="font-size:2.5rem;color:${info.won?'#00ff88':'#ff4444'};letter-spacing:6px;margin-bottom:6px;">${info.myScore} - ${info.oppScore}</div>
            <div style="font-size:0.42rem;color:#333;margin-top:10px;">${date}</div>
        </div>`;
    document.getElementById('duelPopupModal').classList.add('open');
}
function closeDuelPopup(){ document.getElementById('duelPopupModal').classList.remove('open'); }

/* ══════════════════════════════════════════════════════
   PROFILE DUEL SECTION
══════════════════════════════════════════════════════ */
async function renderProfileDuels(playerName){
    document.querySelectorAll('.profile-duel-section').forEach(el=>el.remove());
    window._profileDuelData = null;

    const left=document.querySelector('.profile-left');
    if(!left) return;

    try{
        const base=AUTH_API.replace('/api','');
        const res=await fetch(`${base}/api/duels?player=${encodeURIComponent(playerName)}&limit=1`);
        if(!res.ok) return;
        const data=await res.json();
        const duels=data.duels||[];
        if(!duels.length) return;

        const d    = duels[0];
        const info = duelPerspective(d, playerName);
        const date = new Date(d.timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
        const scoreColor = info.won?'#00ff88':'#ff4444';
        const desc = duelDescLine(d, playerName);

        window._profileDuelData = { duel: d, player: playerName };

        const section=document.createElement('div');
        section.className='profile-duel-section';
        section.dataset.owner=playerName;
        section.innerHTML=`
            <div class="profile-duel-header">
                <span class="profile-duel-label-text">DUEL HISTORY</span>
                <span class="profile-duel-viewall" onclick="openProfileDuelAll('${playerName}')">VIEW ALL ▶</span>
            </div>
            <div class="profile-duel-card" id="profileDuelCard">
                <div class="profile-duel-top">
                    <div class="profile-duel-names">${playerName}<span>vs</span>${info.opponent}</div>
                    <div class="profile-duel-score-text" style="color:${scoreColor};">${info.myScore}-${info.oppScore}</div>
                </div>
                <div class="profile-duel-bottom">${desc} · ${date}</div>
            </div>`;

        section.querySelector('#profileDuelCard').onclick = ()=>{
            if(window._profileDuelData?.player===playerName)
                openDuelPopup(window._profileDuelData.duel, playerName);
        };

        const pts=document.getElementById('pPoints');
        if(pts) pts.parentNode.insertBefore(section,pts); else left.appendChild(section);
    }catch(e){ console.warn("Duel history:",e.message); }
}

function openProfileDuelAll(playerName){
    closeProfileModal();
    CURRENT_TAB='duels';
    document.querySelectorAll('.nav-link').forEach(n=>n.classList.remove('active'));
    document.getElementById('nav-duels')?.classList.add('active');
    renderDuels(playerName);
}

/* ══════════════════════════════════════════════════════
   DUELS TAB
══════════════════════════════════════════════════════ */
async function renderDuels(playerFilter){
    document.getElementById('kitBar').style.display='none';
    document.getElementById('filterBar').style.display='none';
    document.getElementById('showMoreBtn').style.display='none';
    document.getElementById('podiumWrap').style.display='none';
    const dl=document.getElementById('displayList');
    dl.innerHTML=''; dl.classList.remove('overall-mode');
    const lbl=document.getElementById('viewLabel');
    lbl.innerText=playerFilter?`${playerFilter}'S DUELS`:'DUEL HISTORY';
    lbl.style.color='var(--theme)';

    const header=document.createElement('div'); header.className='duel-tab-header';
    header.innerHTML=`<span class="duel-tab-title">${playerFilter?playerFilter+"'S DUELS":'DUEL HISTORY'}</span><span class="duel-tab-count" id="duelCount">LOADING...</span>`;
    dl.appendChild(header);
    const list=document.createElement('div'); list.className='duel-list'; dl.appendChild(list);

    try{
        const base=AUTH_API.replace('/api','');
        const url=playerFilter
            ?`${base}/api/duels?player=${encodeURIComponent(playerFilter)}&limit=50`
            :`${base}/api/duels?limit=100`;
        const res=await fetch(url);
        const data=await res.json();
        const duels=data.duels||[];
        document.getElementById('duelCount').textContent=`${data.total||duels.length} DUELS`;
        if(!duels.length){ list.innerHTML=`<div class="empty-state" style="margin-top:40px;"><h2>NO DUELS FOUND</h2></div>`; return; }

        duels.forEach((d,i)=>{
            const perspective=playerFilter||d.player1;
            const info=duelPerspective(d, perspective);
            const date=new Date(d.timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
            const desc=duelDescLine(d, perspective);

            const row=document.createElement('div');
            row.className=`duel-row ${info.won?'won':'lost'}`;
            row.style.animationDelay=`${i*0.04}s`;
            row.innerHTML=`
                <div class="duel-row-top">
                    <div class="duel-names">
                        <span class="duel-p1" onclick="event.stopPropagation();openProfile('${perspective}')">${perspective}</span>
                        <span class="duel-vs">vs</span>
                        <span class="duel-p2" onclick="event.stopPropagation();openProfile('${info.opponent}')">${info.opponent}</span>
                    </div>
                    <span class="duel-score ${info.won?'won':'lost'}">${info.myScore}-${info.oppScore}</span>
                </div>
                <div class="duel-row-bottom">
                    <span class="duel-desc">${desc}</span>
                    <span class="duel-date">${date}</span>
                </div>`;
            row.onclick=()=>openDuelPopup(d,perspective);
            list.appendChild(row);
        });
    }catch(e){ list.innerHTML=`<div class="empty-state" style="margin-top:40px;"><h2>COULD NOT LOAD DUELS</h2></div>`; }
}

/* ══════════════════════════════════════════════════════
   SITE CORE
══════════════════════════════════════════════════════ */
let DATA={}, CURRENT_TAB='home', CURRENT_KIT='Overall', SHOW_ALL=false;
const PREVIEW=2;
const PTS={"HT1":50,"LT1":40,"HT2":30,"LT2":20,"HT3":12,"LT3":8,"HT4":5,"LT4":3,"HT5":2,"LT5":1};
const skinCache={};
const DEFAULT_SKIN='assets/mtctiers_default_skin.png';

async function hasSkin(n){if(n in skinCache)return skinCache[n];try{const r=await fetch(`assets/${n.toLowerCase()}.png`,{method:'HEAD'});skinCache[n]=r.ok;}catch{skinCache[n]=false;}return skinCache[n];}
function skinSrc(n){return skinCache[n]?`assets/${n.toLowerCase()}.png`:DEFAULT_SKIN;}
async function prewarmSkins(names){await Promise.all(names.map(hasSkin));}
function typeText(el,text,dur=1000){el.textContent='';const chars=text.split('');const iv=dur/chars.length;let i=0;const t=setInterval(()=>{el.textContent+=chars[i++];if(i>=chars.length)clearInterval(t);},iv);}
function buildThemeVars(){let css=":root{\n";for(const[c,{color}]of Object.entries(REGION_MAP))css+=`--reg-${c.toLowerCase()}:${color};\n`;for(const[c,{color}]of Object.entries(DEVICE_MAP))css+=`--dev-${c.toLowerCase()}:${color};\n`;css+="}\n";for(const[c]of Object.entries(REGION_MAP)){const v=`var(--reg-${c.toLowerCase()})`;css+=`.tag-reg-${c.toLowerCase()}{color:${v};border-color:${v}!important}\n`;}for(const[c]of Object.entries(DEVICE_MAP)){const v=`var(--dev-${c.toLowerCase()})`;css+=`.tag-dev-${c.toLowerCase()}{color:${v};border-color:${v}!important}\n`;}const el=document.createElement('style');el.textContent=css;document.head.appendChild(el);}
function playBtnSound(){const a=new Audio('sounds/button.mp3');a.volume=0.5;a.play().catch(()=>{});}
function getTags(name){const p=DATA.Players?.find(x=>x.name===name)||{region:"?",device:"?"};const reg=REGION_MAP[p.region];const dev=DEVICE_MAP[p.device];return `<div style="margin-top:5px;"><div class="tag-wrap ${reg?'has-hover':''}"><span class="tag tag-reg-${p.region.toLowerCase()}">${p.region}</span>${reg?`<div class="tag-popup">${reg.label}</div>`:''}</div><div class="tag-wrap ${dev?'has-hover':''}"><span class="tag tag-dev-${p.device.toLowerCase()}">${p.device}</span>${dev?`<div class="tag-popup">${dev.label}</div>`:''}</div></div>`;}
async function load(){buildThemeVars();populateFilterDropdowns();try{const r=await fetch(`data/rankings.json?v=${Date.now()}`);DATA=await r.json();let totals={};for(let k in DATA){if(k==="Overall"||k==="Players")continue;for(let t in DATA[k])DATA[k][t].forEach(p=>{totals[p]=(totals[p]||0)+(PTS[t.replace('R','')]||0);});}if(DATA.Players)DATA.Players.forEach(p=>{if(!(p.name in totals))totals[p.name]=0;});DATA["Overall"]=totals;buildKitBar();CURRENT_TAB='home';await renderOverall();}catch(e){console.error(e);}}
function buildKitBar(){const bar=document.getElementById('kitBar');bar.innerHTML="";Object.entries(KIT_MAP).forEach(([name,{img,color}])=>{const btn=document.createElement('button');const active=name==='Overall';btn.className=`kit-btn ${active?'active':''}`;btn.style.setProperty('--kit-active-color',color);btn.style.color=color;btn.style.opacity=active?'1':'0.4';btn.innerHTML=(img?`<img src="${img}" style="width:16px;vertical-align:middle;">`:'') + name.toUpperCase();btn.onclick=()=>{playBtnSound();if(CURRENT_TAB!=='rankings'&&CURRENT_TAB!=='home')return;document.querySelectorAll('.kit-btn').forEach(b=>{b.classList.remove('active');b.style.opacity='0.4';});btn.classList.add('active');btn.style.opacity='1';CURRENT_KIT=name;setUrl({kit:name==='Overall'?'':name,player:''});if(name==='Overall')renderOverall();else renderKit(name);};bar.appendChild(btn);});}
function populateFilterDropdowns(){const ks=document.getElementById('filterKit');Object.keys(KIT_MAP).forEach(k=>{if(k==='Overall')return;const o=document.createElement('option');o.value=k;o.textContent=k.toUpperCase();ks.appendChild(o);});const rs=document.getElementById('filterRegion');Object.entries(REGION_MAP).forEach(([code,{label}])=>{const o=document.createElement('option');o.value=code;o.textContent=`${code} — ${label}`;rs.appendChild(o);});const ds=document.getElementById('filterDevice');Object.entries(DEVICE_MAP).forEach(([code,{label}])=>{const o=document.createElement('option');o.value=code;o.textContent=`${code} — ${label}`;ds.appendChild(o);});}
function getFilters(){return{kit:document.getElementById('filterKit').value,region:document.getElementById('filterRegion').value,device:document.getElementById('filterDevice').value,retired:document.getElementById('filterRetired').value};}
function applyFilters(){if(CURRENT_KIT&&CURRENT_KIT!=='Overall'){renderKit(CURRENT_KIT);}else{if(CURRENT_TAB!=='rankings'){SHOW_ALL=false;document.getElementById('kitBar').style.display='none';}renderOverall();}}
function resetFilters(){['filterKit','filterRegion','filterDevice','filterRetired'].forEach(id=>document.getElementById(id).value='');applyFilters();}
function toggleShowMore(){switchTab('rankings');}
function buildFilteredOverall(){const{kit,region,device,retired}=getFilters();let scoredMap={};const playerStatus={};for(let k in DATA){if(k==='Overall'||k==='Players')continue;for(let t in DATA[k]){const isR=t.startsWith('R');DATA[k][t].forEach(name=>{if(!playerStatus[name])playerStatus[name]={active:false,retired:false};if(isR)playerStatus[name].retired=true;else playerStatus[name].active=true;});}}if(!retired){scoredMap={...DATA.Overall};}else{for(let k in DATA){if(k==='Overall'||k==='Players')continue;for(let t in DATA[k]){const isR=t.startsWith('R');if(retired==='active'&&isR)continue;if(retired==='retired'&&!isR)continue;const pts=PTS[t.replace('R','')];if(!pts)continue;DATA[k][t].forEach(name=>{scoredMap[name]=(scoredMap[name]||0)+pts;});}}if(DATA.Players)DATA.Players.forEach(p=>{if(!(p.name in scoredMap))scoredMap[p.name]=0;});}let entries=Object.entries(scoredMap);if(region||device)entries=entries.filter(([name])=>{const p=DATA.Players?.find(x=>x.name===name);if(!p)return false;if(region&&p.region!==region)return false;if(device&&p.device!==device)return false;return true;});if(retired==='active')entries=entries.filter(([name])=>{const s=playerStatus[name];return s&&s.active;});else if(retired==='retired')entries=entries.filter(([name])=>{const s=playerStatus[name];return s&&s.retired&&!s.active;});if(retired)entries=entries.filter(([,pts])=>pts>0);if(kit){const kitScores={};if(DATA[kit]){for(let t in DATA[kit]){const isR=t.startsWith('R');if(retired==='active'&&isR)continue;if(retired==='retired'&&!isR)continue;const pts=PTS[t.replace('R','')];if(!pts)continue;DATA[kit][t].forEach(name=>{if(!kitScores[name]||kitScores[name].pts<pts)kitScores[name]={pts,tier:t};});}}entries=entries.filter(([name])=>kitScores[name]).map(([name])=>[name,kitScores[name].pts,kitScores[name].tier]);entries.sort((a,b)=>b[1]-a[1]);return{entries,kitMode:true,kitName:kit};}entries.sort((a,b)=>b[1]-a[1]);return{entries,kitMode:false,kitName:null};}
function getRankTitle(pts,rank){if(rank===1||pts>=300)return{title:"Combat Grandmaster",color:"#ffd700"};if(rank<=3||pts>=200)return{title:"Combat Master",color:"#00eeff"};if(pts>=150)return{title:"Combat Ace",color:"#ff6a00"};if(pts>=50)return{title:"Combat Specialist",color:"#b044ff"};if(pts>=20)return{title:"Combat Cadet",color:"#00ff88"};if(pts>=10)return{title:"Combat Novice",color:"#ff7f50"};return{title:"Rookie",color:"#888"};}
function titleBadgeHtml(pts,rank){const{title,color}=getRankTitle(pts,rank);return `<span style="font-family:'MultiCraftFont',monospace;font-size:0.45rem;color:${color};border:1px solid ${color};border-radius:20px;padding:2px 8px;letter-spacing:1px;background:${color}18;white-space:nowrap;">${title}</span>`;}
function applyRankTitleBadge(name){
    const sorted=Object.entries(DATA.Overall).sort((a,b)=>b[1]-a[1]);
    const rankIdx=sorted.findIndex(x=>x[0]===name); const rankNum=rankIdx+1; const rankPts=DATA.Overall[name];
    const{title:rankTitle,color:rankTitleColor}=getRankTitle(rankPts,rankNum);
    document.getElementById('pRank').innerText="RANK #"+rankNum;
    const titleBadge=document.getElementById('pTitleBadge');
    titleBadge.textContent=rankTitle; titleBadge.style.color=rankTitleColor; titleBadge.style.borderColor=rankTitleColor; titleBadge.style.background=rankTitleColor+'18';
}
async function renderOverall(){if(CURRENT_TAB!=='rankings'&&CURRENT_TAB!=='home')return;const lbl=document.getElementById('viewLabel');const isHome=CURRENT_TAB==='home';lbl.style.display=isHome?'none':'';if(!isHome){lbl.innerText='OVERALL';lbl.style.color=KIT_MAP['Overall'].color;}document.getElementById('filterBar').style.display=isHome?'none':'flex';document.getElementById('topPlayersTitle').style.display=isHome?'block':'none';if(!isHome)document.getElementById('filterKit').style.display='';document.getElementById('kitBar').style.display=(!isHome&&SHOW_ALL)?'flex':'none';const dl=document.getElementById('displayList');dl.innerHTML='';dl.classList.add('overall-mode');const podium=document.getElementById('podiumWrap');podium.innerHTML='';const smBtn=document.getElementById('showMoreBtn');const{entries,kitMode}=buildFilteredOverall();if(entries.length===0){podium.style.display='none';smBtn.style.display='none';dl.innerHTML=`<div class="empty-state"><h2>NO PLAYERS MATCH FILTERS</h2></div>`;return;}if(SHOW_ALL){podium.style.display='none';}else{const top3=entries.slice(0,3);await prewarmSkins(top3.map(e=>e[0]));podium.style.display='flex';for(let i=0;i<top3.length;i++){const[name,pts]=top3[i];const rank=i+1;const rankColors=['var(--gold)','#aaa','#cd7f32'];const{title:pTitle,color:pColor}=getRankTitle(pts,rank);const card=document.createElement('div');card.className=`podium-card rank-${rank}`;card.onclick=()=>{playBtnSound();openProfile(name);};card.innerHTML=`<div class="podium-name">${name}</div><div class="podium-skin-wrap"><img src="${skinSrc(name)}" alt="${name}"></div><div class="podium-platform"><div class="podium-pts-badge" style="border-color:${rankColors[i]};color:${rankColors[i]};">${pts} PTS</div><span class="podium-rank-num">${rank}</span></div><div style="font-family:'MultiCraftFont',monospace;font-size:0.45rem;color:${pColor};border:1px solid ${pColor};border-radius:20px;padding:2px 8px;margin-top:6px;letter-spacing:1px;background:${pColor}18;text-align:center;">${pTitle}</div>`;card.style.animation=`podiumDrop 0.5s cubic-bezier(0.22,1,0.36,1) ${i*0.12}s both`;podium.appendChild(card);}}if(isHome){document.getElementById('topPlayersTitle').style.display='block';const homeList=document.createElement('div');homeList.id='overallList';const homeRows=entries.slice(3,3+PREVIEW);await prewarmSkins(homeRows.map(e=>e[0]));for(let i=0;i<homeRows.length;i++){const[name,pts]=homeRows[i];const rank=i+4;const row=document.createElement('div');row.className='ol-row';row.onclick=()=>{playBtnSound();openProfile(name);};row.style.animationDelay=`${i*0.08}s`;row.innerHTML=`<span class="ol-rank">${rank}</span><div class="ol-skin"><img src="${skinSrc(name)}" alt="${name}"></div><div class="ol-name-block"><div class="ol-name" style="font-family:'MultiCraftFont',monospace;">${name}</div>${getTags(name)}<div style="margin-top:4px;">${titleBadgeHtml(pts,rank)}</div></div><div class="ol-pts"><span class="ol-pts-icon"></span>${pts} PTS</div>`;attachRowHover(row, name);homeList.appendChild(row);}dl.appendChild(homeList);if(entries.length>3+PREVIEW){const flDiv=document.createElement('div');flDiv.style.cssText="font-family:'MultiCraftFont',monospace;font-size:0.65rem;color:#555;cursor:pointer;margin-top:10px;margin-bottom:10px;letter-spacing:1px;text-align:center;width:100%;transition:color 0.2s;";flDiv.textContent='FULL LEADERBOARD ▶';flDiv.onmouseenter=()=>flDiv.style.color='var(--purple)';flDiv.onmouseleave=()=>flDiv.style.color='#555';flDiv.onclick=()=>switchTab('rankings');dl.appendChild(flDiv);}document.getElementById('showMoreBtn').style.display='none';return;}const listWrap=document.createElement('div');listWrap.id='overallList';const rowEntries=SHOW_ALL?entries:entries.slice(3,3+PREVIEW);await prewarmSkins(rowEntries.map(e=>e[0]));for(let i=0;i<rowEntries.length;i++){const[name,pts,tier]=rowEntries[i];const rank=SHOW_ALL?i+1:i+4;const isFullLB=SHOW_ALL;const row=document.createElement('div');row.className='ol-row'+(isFullLB?' ol-row-full':'');row.onclick=()=>{playBtnSound();openProfile(name);};if(isFullLB){const p=DATA.Players?.find(x=>x.name===name);const regCode=p?.region||'?';const regColor=REGION_MAP[regCode]?.color||'#555';const devCode=p?.device||'?';const devColor=DEVICE_MAP[devCode]?.color||'#555';let kitIconsHtml='<div class="ol-kit-icons">';Object.entries(KIT_MAP).forEach(([kname,{img,color}])=>{if(kname==='Overall')return;let tierLabel='',tierColor='#2a2a2a';if(DATA[kname]){for(let t in DATA[kname]){if(DATA[kname][t].includes(name)){const isR=t.startsWith('R');tierLabel=isR?t.slice(1):t;tierColor=isR?'#444':color;break;}}}kitIconsHtml+=`<div class="ol-kit-icon" style="border-color:${tierColor};opacity:${tierLabel?'1':'0.25'};"><img src="${img}" style="width:20px;height:20px;image-rendering:pixelated;display:block;"><span class="ol-kit-icon-label" style="color:${tierColor};font-size:0.5rem;">${tierLabel||''}</span></div>`;});kitIconsHtml+='</div>';row.innerHTML=`<span class="ol-rank">${rank}</span><div class="ol-skin"><img src="${skinSrc(name)}" alt="${name}"></div><div class="ol-name-block"><div class="ol-name" style="font-family:'MultiCraftFont',monospace;">${name}</div><div style="margin-top:4px;">${titleBadgeHtml(pts,rank)}</div></div><div class="tag-wrap has-hover" style="position:relative;"><span class="ol-region-badge" style="background:${regColor}22;border:1px solid ${regColor};color:${regColor};cursor:help;">${regCode}</span><div class="tag-popup" style="border-color:${regColor};">${REGION_MAP[regCode]?.label||regCode}</div></div><div class="tag-wrap has-hover" style="position:relative;"><span class="ol-region-badge" style="background:${devColor}22;border:1px solid ${devColor};color:${devColor};cursor:help;">${devCode}</span><div class="tag-popup" style="border-color:${devColor};">${DEVICE_MAP[devCode]?.label||devCode}</div></div>${kitIconsHtml}<div class="ol-pts"><span class="ol-pts-icon"></span>${pts} PTS</div>`;}else{row.innerHTML=`<span class="ol-rank">${rank}</span><div class="ol-skin"><img src="${skinSrc(name)}" alt="${name}"></div><div class="ol-name-block"><div class="ol-name">${name}</div>${getTags(name)}<div style="margin-top:4px;">${titleBadgeHtml(pts,rank)}</div></div>${kitMode&&tier?`<span class="ol-tier-badge">${tier.startsWith('R')?'Retired '+tier.slice(1):tier}</span>`:''}<div class="ol-pts"><span class="ol-pts-icon"></span>${pts} PTS</div>`;}attachRowHover(row, name);
        row.style.animationDelay=`${i*0.06}s`;listWrap.appendChild(row);}dl.appendChild(listWrap);if(!isHome&&entries.length>3+PREVIEW){smBtn.style.display='block';smBtn.textContent=SHOW_ALL?'▲ SHOW LESS':'FULL LEADERBOARD ▶';}else{smBtn.style.display='none';}}
async function renderKit(kit){if(CURRENT_TAB!=='rankings'&&CURRENT_TAB!=='home')return;const{region,device,retired}=getFilters();const color=KIT_MAP[kit]?.color||'var(--gold)';const lbl=document.getElementById('viewLabel');lbl.innerText=kit.toUpperCase();lbl.style.color=color;document.getElementById('filterBar').style.display='flex';document.getElementById('filterKit').style.display='none';document.getElementById('topPlayersTitle').style.display='none';document.getElementById('podiumWrap').style.display='none';document.getElementById('showMoreBtn').style.display='none';const dl=document.getElementById('displayList');dl.innerHTML='';dl.classList.remove('overall-mode');const kitPlayerStatus={};for(let k in DATA){if(k==='Overall'||k==='Players')continue;for(let t in DATA[k]){const isR=t.startsWith('R');DATA[k][t].forEach(name=>{if(!kitPlayerStatus[name])kitPlayerStatus[name]={active:false,retired:false};if(isR)kitPlayerStatus[name].retired=true;else kitPlayerStatus[name].active=true;});}}function kitPlayerVisible(name){const p=DATA.Players?.find(x=>x.name===name);if(region&&(!p||p.region!==region))return false;if(device&&(!p||p.device!==device))return false;if(retired==='active'){const s=kitPlayerStatus[name];if(!s||!s.active)return false;}else if(retired==='retired'){const s=kitPlayerStatus[name];if(!s||!s.retired||s.active)return false;}return true;}const allKitPlayers=[];if(DATA[kit]){for(let t in DATA[kit])DATA[kit][t].forEach(n=>{if(!allKitPlayers.includes(n))allKitPlayers.push(n);})}await prewarmSkins(allKitPlayers);const kitTop=[];if(DATA[kit]){const tierOrder2=['HT1','RHT1','LT1','RLT1','HT2','RHT2','LT2','RLT2','HT3','RHT3','LT3','RLT3','HT4','RHT4','LT4','RLT4','HT5','RHT5','LT5','RLT5'];for(const t of tierOrder2){if(retired==='active'&&t.startsWith('R'))continue;if(retired==='retired'&&!t.startsWith('R'))continue;if(DATA[kit][t])DATA[kit][t].forEach(n=>{if(kitTop.length<3&&kitPlayerVisible(n))kitTop.push({name:n,tier:t});});if(kitTop.length>=3)break;}}if(kitTop.length>0){const mp=document.createElement('div');mp.id='podiumWrap2';mp.style.cssText='display:flex;justify-content:center;align-items:flex-end;gap:16px;margin-bottom:28px;padding:0 12px;';for(let i=0;i<kitTop.length;i++){const{name,tier}=kitTop[i];const rank=i+1;const rankColors=['var(--gold)','#aaa','#cd7f32'];const card=document.createElement('div');card.className=`podium-card rank-${rank}`;card.onclick=()=>{playBtnSound();openProfile(name);};card.innerHTML=`<div class="podium-name">${name}</div><div class="podium-skin-wrap"><img src="${skinSrc(name)}" alt="${name}"></div><div class="podium-platform"><div class="podium-pts-badge" style="border-color:${rankColors[i]};color:${rankColors[i]};">${tier}</div><span class="podium-rank-num">${rank}</span></div>`;card.style.animation=`podiumDrop 0.5s cubic-bezier(0.22,1,0.36,1) ${i*0.12}s both`;mp.appendChild(card);}dl.appendChild(mp);}const grid=document.createElement('div');grid.style.cssText="display:flex;gap:20px;flex-wrap:wrap;justify-content:center;margin-top:24px;";let anyPlayers=false;const TIER_ORDER=['HT1','RHT1','LT1','RLT1','HT2','RHT2','LT2','RLT2','HT3','RHT3','LT3','RLT3','HT4','RHT4','LT4','RLT4','HT5','RHT5','LT5','RLT5'];if(DATA[kit]){["T1","T2","T3","T4","T5"].forEach(lvl=>{const lvlNum=lvl.slice(1);const orderedTiers=TIER_ORDER.filter(t=>{const base=t.startsWith('R')?t.slice(1):t;return base.slice(-1)===lvlNum;});let col=`<div style="min-width:200px;"><div style="color:var(--purple);border-bottom:1px solid var(--border);margin-bottom:10px;text-align:center;font-family:'MultiCraftFont';font-size:0.9rem;">${lvl}</div>`;let has=false;orderedTiers.forEach(t=>{if(!DATA[kit][t])return;if(retired==='active'&&t.startsWith('R'))return;if(retired==='retired'&&!t.startsWith('R'))return;DATA[kit][t].forEach(name=>{if(!kitPlayerVisible(name))return;has=true;anyPlayers=true;const isR=t.startsWith('R');const label=isR?'Retired '+t.substring(1):t;
const lc=isR?'var(--grey)':'var(--gold)';
col+=`<div class="tier-card clickable" style="width:200px;padding:12px;display:flex;align-items:center;gap:10px;" onclick="openProfile('${name}')"><img src="${skinSrc(name)}" alt="${name}" style="width:36px;height:36px;image-rendering:pixelated;object-fit:cover;object-position:top;transform:scale(1.3);transform-origin:top;flex-shrink:0;"><div><div style="font-size:0.9rem;font-weight:bold;">${name}</div>${getTags(name)}<div class="rk-tier-label" data-retired="${isR?'1':'0'}" style="font-size:0.6rem;color:${lc};margin-top:4px;font-weight:bold;">${label}</div></div></div>`;});});if(has){col+=`</div>`;grid.innerHTML+=col;}});}if(!anyPlayers){dl.innerHTML=`<div class="empty-state"><h2>NO RANKED PLAYERS</h2></div>`;return;}dl.appendChild(grid);}

async function switchTab(tab){
    playBtnSound(); CURRENT_TAB=tab;
    document.querySelectorAll('.nav-link').forEach(n=>n.classList.remove('active'));
    const navEl=document.getElementById('nav-'+tab); if(navEl) navEl.classList.add('active');
    const dl=document.getElementById('displayList'); dl.innerHTML=''; dl.classList.remove('overall-mode');
    document.getElementById('podiumWrap').style.display='none';
    document.getElementById('filterBar').style.display='none';
    document.getElementById('showMoreBtn').style.display='none';
    if(tab==='home'){
        setUrl({tab:'',kit:'',player:''});
        document.getElementById('kitBar').style.display='none';
        SHOW_ALL=false; CURRENT_KIT='Overall';
        document.querySelectorAll('.kit-btn').forEach(b=>{b.classList.remove('active');b.style.opacity='0.4';});
        const ob=[...document.querySelectorAll('.kit-btn')].find(b=>b.textContent.trim()==='OVERALL');
        if(ob){ob.classList.add('active');ob.style.opacity='1';}
        await renderOverall();
    }else if(tab==='rankings'){
        setUrl({tab:'rankings',kit:'',player:''});
        SHOW_ALL=true; document.getElementById('kitBar').style.display='flex';
        document.getElementById('filterBar').style.display='flex';
        document.getElementById('topPlayersTitle').style.display='none';
        dl.innerHTML='';
        if(CURRENT_KIT==='Overall') await renderOverall(); else await renderKit(CURRENT_KIT);
    }else if(tab==='duels'){
        setUrl({tab:'duels',kit:'',player:''}); await renderDuels();
    }else{
        document.getElementById('kitBar').style.display='none';
        setUrl({tab:tab,kit:'',player:''});
        const lbl=document.getElementById('viewLabel');
        lbl.innerText=tab==='hof'?"HALL OF FAME":"TIER TESTERS"; lbl.style.color='var(--gold)';
        try{
            const r=await fetch(`data/${tab}.json?v=${Date.now()}`);
            const data=await r.json();
            data.forEach(i=>{
                const hasProf=(i.name in DATA.Overall);
                dl.innerHTML+=`<div class="tier-card ${hasProf?'clickable':''}" ${hasProf?`onclick="openProfile('${i.name}')"`:''}><b style="color:var(--purple);font-family:'MultiCraftFont';font-size:1rem;">${i.name}</b>${i.discord?`<div style="color:var(--purple);font-size:0.85rem;font-weight:bold;margin-top:5px;">Discord: ${i.discord}</div>`:''}<p style="font-size:0.75rem;color:#bbb;margin-top:8px;">${i.description||''}</p></div>`;
            });
        }catch(e){ console.error(e); }
    }
}
function closeProfileModal(){
    const _cm=document.getElementById('profileModal');
    _cm.style.display='none';
    _cm.dataset.openPlayer='';
    clearProfileExtras();
    window._profileDuelData=null;
    setUrl({player:''});
}
function fireConfetti(){const colors=['#ffd700','#fff','var(--theme)','#ff00ff','#00eeff','#ff6a00'];const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;inset:0;z-index:9999;pointer-events:none;';canvas.width=window.innerWidth;canvas.height=window.innerHeight;document.body.appendChild(canvas);const ctx=canvas.getContext('2d');const pieces=Array.from({length:120},()=>({x:Math.random()*canvas.width,y:-20-Math.random()*200,r:Math.random()*7+3,color:colors[Math.floor(Math.random()*colors.length)],vx:(Math.random()-.5)*4,vy:Math.random()*4+2,spin:Math.random()*.3-.15,angle:Math.random()*Math.PI*2,shape:Math.random()>.5?'rect':'circle',w:Math.random()*10+5,h:Math.random()*5+3,alpha:1}));const start=performance.now();const duration=2800;function draw(now){const elapsed=now-start;ctx.clearRect(0,0,canvas.width,canvas.height);pieces.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=0.08;p.angle+=p.spin;p.alpha=Math.max(0,1-(elapsed/duration)*1.2);ctx.globalAlpha=p.alpha;ctx.fillStyle=p.color;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);if(p.shape==='rect'){ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);}else{ctx.beginPath();ctx.arc(0,0,p.r,0,Math.PI*2);ctx.fill();}ctx.restore();});ctx.globalAlpha=1;if(elapsed<duration)requestAnimationFrame(draw);else canvas.remove();}requestAnimationFrame(draw);}

/* ══════════════════════════════════════════════════════
   FIXED-POSITION KIT POPUPS (no more clipping)
   Converts each .kit-popup to position:fixed and computes its
   coordinates on hover, so it escapes .profile-right's
   overflow-y:auto instead of being clipped by it.
══════════════════════════════════════════════════════ */
let _fixedPopupEl = null;

function enableFixedKitPopups(){
    
    if(!_fixedPopupEl){
        _fixedPopupEl = document.createElement('div');
        _fixedPopupEl.className = 'kit-popup kit-popup-fixed';
        document.body.appendChild(_fixedPopupEl);
    }
    _fixedPopupEl.style.visibility = 'hidden';
    _fixedPopupEl.style.opacity = '0';

    document.querySelectorAll('#pTiers .p-kit-item').forEach(item=>{
        const sourcePopup = item.querySelector('.kit-popup');
        if(!sourcePopup || sourcePopup.classList.contains('kit-popup-fixed')) return;

        sourcePopup.style.visibility = 'hidden';
        sourcePopup.style.opacity = '0';
        sourcePopup.style.pointerEvents = 'none';

        item.addEventListener('mouseenter', ()=>{
            const liveSource = item.querySelector('.kit-popup:not(.kit-popup-fixed)');
            if(!liveSource) return;
            _fixedPopupEl.innerHTML = liveSource.innerHTML;
            _fixedPopupEl.style.borderColor = liveSource.style.borderColor || '';

            const rect = item.getBoundingClientRect();
            _fixedPopupEl.style.visibility = 'visible';
            _fixedPopupEl.style.opacity = '1';
            _fixedPopupEl.style.position = 'fixed';
            _fixedPopupEl.style.left = '0px';
            _fixedPopupEl.style.top = '0px';
            _fixedPopupEl.style.transform = 'none';

            const popRect = _fixedPopupEl.getBoundingClientRect();
            let left = rect.left + rect.width / 2 - popRect.width / 2;
            let top = rect.top - popRect.height - 10;

            left = Math.max(8, Math.min(left, window.innerWidth - popRect.width - 8));
            
            if(top < 8) top = rect.bottom + 10;

            _fixedPopupEl.style.left = `${left}px`;
            _fixedPopupEl.style.top = `${top}px`;
        });

        item.addEventListener('mouseleave', ()=>{
            _fixedPopupEl.style.visibility = 'hidden';
            _fixedPopupEl.style.opacity = '0';
        });
    });
}

async function openProfile(name){
    playBtnSound();
    if(!(name in DATA.Overall)) return;
    document.querySelectorAll('.profile-duel-section').forEach(el=>el.remove());
    window._profileDuelData=null;
    clearProfileExtras();
    applyRankTitleBadge(name);
    typeText(document.getElementById('pName'),name,1000);
    document.getElementById('pMeta').innerHTML=getTags(name);
    const targetPts=DATA.Overall[name]; const pPoints=document.getElementById('pPoints');
    pPoints.innerHTML='0 <span class="profile-elo-label">PTS</span>';
    const dur=1500; const st=performance.now();
    function countUp(now){const el=now-st;const pr=Math.min(el/dur,1);const ea=1-Math.pow(1-pr,3);pPoints.innerHTML=Math.round(ea*targetPts)+' <span class="profile-elo-label">PTS</span>';if(pr<1)requestAnimationFrame(countUp);}
    requestAnimationFrame(countUp);
    let ranked=[],unranked=[];
    Object.keys(KIT_MAP).forEach(k=>{if(k==="Overall")return;let found=false,display="",color="var(--grey)";const img=KIT_MAP[k]?.img;if(DATA[k]){for(let t in DATA[k]){if(DATA[k][t].includes(name)){found=true;const isR=t.startsWith('R');display=isR?'Retired '+t.substring(1):t;color=isR?'var(--grey)':'var(--gold)';break;}}}const html=`<div class="p-kit-item"><div class="kit-popup" style="border-color:${color}"><span style="color:${color}">${found?display:"UNRANKED"}</span><br><span style="color:#666">${k}</span></div><div class="p-kit-circle" style="border-color:${found?color:'#222'};opacity:${found?'1':'0.3'};"><img src="${img}"></div><div class="p-kit-tier-label" style="color:${color};">${found?display:"—"}</div></div>`;if(found)ranked.push(html);else unranked.push(html);});
    document.getElementById('pTiers').innerHTML=[...ranked,...unranked].map((h,i)=>h.replace('<div class="p-kit-item">',`<div class="p-kit-item" style="animation:kitCircleIn 0.4s ease-out ${i*0.05}s both;">`)).join('');
    enableFixedKitPopups();
    const skinWrap=document.getElementById('pSkin'); const skinImg=document.getElementById('pSkinImg');
    hasSkin(name).then(()=>{ skinImg.src=skinSrc(name); skinWrap.style.display='flex'; });
    setUrl({player:name});
    const _pModal=document.getElementById('profileModal');
    _pModal.style.display='flex';
    _pModal.dataset.openPlayer=name;
    try{
        const data=await authCall("GET",`/profile/${encodeURIComponent(name)}`);
        injectProfileExtras(name,data.role,data.profile);
        injectEditPanel(name);
    }catch(e){ console.warn("Profile extras:",e.message); }
    renderProfileDuels(name).catch(()=>{});
    applyPeakTiers(name);
    applyRankTitleBadge(name);
}
async function handleUrlOnLoad(){const p=new URLSearchParams(window.location.search);const player=p.get('player');const kit=p.get('kit');const tab=p.get('tab');if(player&&DATA.Overall&&player in DATA.Overall){openProfile(player);}else if(tab==='rankings'){switchTab('rankings');}else if(tab==='hof'||tab==='testers'){switchTab(tab);}else if(tab==='duels'){switchTab('duels');}else if(kit&&kit!=='Overall'&&KIT_MAP[kit]){CURRENT_KIT=kit;document.querySelectorAll('.kit-btn').forEach(b=>{b.classList.remove('active');b.style.opacity='0.4';});const btn=[...document.querySelectorAll('.kit-btn')].find(b=>b.textContent.trim()===kit.toUpperCase());if(btn){btn.classList.add('active');btn.style.opacity='1';}document.getElementById('filterBar').style.display='none';document.getElementById('showMoreBtn').style.display='none';document.getElementById('kitBar').style.display='flex';await renderKit(kit);}}
function copyProfileLink(){const url=new URL(window.location.href);url.searchParams.set('player',document.getElementById('pName').innerText.trim());navigator.clipboard.writeText(url.toString()).then(()=>{const btn=document.getElementById('profileCopyBtn');btn.textContent='✓';btn.style.borderColor='var(--purple)';btn.style.color='var(--purple)';setTimeout(()=>{btn.textContent='⧉';btn.style.borderColor='';btn.style.color='';},1500);});}

function isEmbedMode(){
    return new URLSearchParams(window.location.search).get('embed');
}

function copyEmbedCode(){
    const name = document.getElementById('pName').innerText.trim();
    if(!name) return;
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('embed', name);
    const iframeCode = `<iframe src="${url.toString()}" width="480" height="360" style="border:none;border-radius:12px;" loading="lazy"></iframe>`;
    navigator.clipboard.writeText(iframeCode).then(()=>{
        const btn=document.getElementById('profileEmbedBtn');
        if(!btn) return;
        const original=btn.textContent;
        btn.textContent='✓'; btn.style.borderColor='var(--purple)'; btn.style.color='var(--purple)';
        setTimeout(()=>{ btn.textContent=original; btn.style.borderColor=''; btn.style.color=''; },1500);
    }).catch(()=>{});
}

async function renderEmbedProfile(name){
    document.documentElement.classList.add('embed-mode');
    document.body.classList.add('embed-mode');
    document.querySelector('.welcome-overlay')?.remove();
    document.querySelector('nav')?.remove();
    document.querySelector('header')?.remove();
    document.getElementById('viewLabel')?.remove();
    document.getElementById('kitBar')?.remove();
    document.getElementById('filterBar')?.remove();
    document.getElementById('topPlayersTitle')?.remove();
    document.getElementById('podiumWrap')?.remove();
    document.getElementById('displayList')?.remove();
    document.getElementById('showMoreBtn')?.remove();
    document.querySelector('.info-btn')?.remove();
    document.getElementById('music-player')?.remove();
    document.getElementById('infoModal')?.remove();
    document.getElementById('loginModal')?.remove();
    document.getElementById('duelPopupModal')?.remove();

    const modal = document.getElementById('profileModal');
    if(!modal) return;

    if(!DATA.Overall || !(name in DATA.Overall)){
        modal.style.display='flex';
        modal.innerHTML = `<div style="font-family:'MultiCraftFont',monospace;color:#ff4444;text-align:center;padding:40px;width:100%;">PLAYER NOT FOUND</div>`;
        return;
    }

    modal.classList.add('embed-modal');
    modal.style.display = 'flex';
    modal.onclick = null; 
    modal.querySelector('.profile-close-btn')?.remove();
    modal.querySelector('.profile-copy-btn')?.remove();
    modal.querySelector('.profile-embed-btn')?.remove();

    await openProfile(name);
}
function setUrl(params){const u=new URL(window.location.href);Object.entries(params).forEach(([k,v])=>v?u.searchParams.set(k,v):u.searchParams.delete(k));window.history.replaceState({},'',u);}
function handleSearch(val){const pop=document.getElementById('searchPopup');if(!val){pop.style.display='none';return;}const matches=Object.keys(DATA.Overall||{}).filter(n=>n.toLowerCase().includes(val.toLowerCase())).slice(0,5);pop.innerHTML=matches.map(m=>`<div class="search-item" onclick="openProfile('${m}');document.getElementById('searchPopup').style.display='none';"><b>${m}</b><span style="color:var(--purple);font-size:0.5rem;">VIEW PROFILE</span></div>`).join('')||'';pop.style.display=matches.length?'block':'none';}
const _MP = atob("aHR0cHM6Ly9tdWx0aWNyYWZ0LXByb2R1Y3Rpb24udXAucmFpbHdheS5hcHAvcHJveHkvZmluZC1uZWFyYnktc2VydmVycw==");
const MTC_SERVER_CODES = ["JC5A69FB","OPL5OBPM"];
const SRV_REFRESH_MS = 15000;
var _srvInterval = null;

function typeTextEl(el, text, speed){
    speed = speed || 14;
    el.textContent='';
    var i=0;
    var tick=setInterval(function(){ el.textContent+=text[i++]; if(i>=text.length) clearInterval(tick); }, speed);
}

async function fetchServerInfo(retryCount){
    retryCount = retryCount || 0;
    var cards = document.querySelectorAll('.server-card');
    if(!cards.length) return;
    try{
        var res = await fetch(_MP, {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ favorites: MTC_SERVER_CODES.join(',') })
        });
        if(!res.ok) throw new Error('HTTP '+res.status);
        var data = await res.json();
        var favorites = (data && data.favorites) || {};

        var anyFound = false;
        cards.forEach(function(card){
            var code = card.dataset.code;
            var srv  = favorites[code];
            var nameEl    = card.querySelector('.srvName');
            var playersEl = card.querySelector('.srvPlayers');
            var descEl    = card.querySelector('.srvDesc');
            var table     = card.querySelector('.srvTable');
            var tbody     = card.querySelector('.srvTableBody');
            if(!srv){
                if(!nameEl.dataset.loadedOnce) nameEl.textContent = 'UNAVAILABLE';
                return;
            }
            anyFound = true;
            nameEl.dataset.loadedOnce = '1';
            nameEl.textContent = srv.server_name || code;
            var cur = srv.connected_players != null ? srv.connected_players : 0;
            var max = srv.max_players || 50;
            if(playersEl) playersEl.textContent = cur + '/' + max;
            if(descEl && !descEl.dataset.loaded){
                var desc = (srv.description || '').replace(/\n+/g,' · ').trim();
                if(desc){ descEl.dataset.loaded = '1'; typeTextEl(descEl, desc, 12); }
            }
            if(table && tbody){
                table.style.display = 'table';
                var rows = [
                    ['PVP', srv.pvp ? '✓ Enabled' : '✗ Disabled'],
                ];
                tbody.innerHTML = rows.map(function(r){
                    return '<tr>' +
                        '<td style="font-family:MultiCraftFont,monospace;font-size:0.4rem;color:#444;letter-spacing:1px;padding:3px 6px 3px 0;border-bottom:1px solid #0d0d0d;">' + r[0] + '</td>' +
                        '<td style="font-family:MultiCraftFont,monospace;font-size:0.4rem;color:#888;padding:3px 0;border-bottom:1px solid #0d0d0d;">' + r[1] + '</td>' +
                        '</tr>';
                }).join('');
            }
        });

        if(!anyFound && retryCount < 3){
            setTimeout(()=>fetchServerInfo(retryCount+1), 1000);
        }
    }catch(e){
        if(retryCount < 3){ setTimeout(()=>fetchServerInfo(retryCount+1), 1000); return; }
        cards.forEach(function(card){
            var nameEl = card.querySelector('.srvName');
            if(nameEl && !nameEl.dataset.loadedOnce) nameEl.textContent='COULD NOT LOAD';
        });
        console.warn('Server info:', e.message);
    }
}

function openInfo(){
    playBtnSound();
    document.getElementById('infoModal').style.display='flex';
    document.querySelectorAll('.server-card').forEach(function(card){
        var nameEl    = card.querySelector('.srvName');
        var playersEl = card.querySelector('.srvPlayers');
        var descEl    = card.querySelector('.srvDesc');
        var table     = card.querySelector('.srvTable');
        if(!nameEl.dataset.loadedOnce) nameEl.textContent = 'LOADING...';
        if(playersEl) playersEl.textContent = playersEl.textContent==='-'?'-':playersEl.textContent;
        if(descEl && !descEl.dataset.loaded) descEl.textContent='';
        if(table && table.style.display!=='table') table.style.display='none';
    });
    fetchServerInfo();
    if(_srvInterval) clearInterval(_srvInterval);
    _srvInterval = setInterval(fetchServerInfo, SRV_REFRESH_MS);
}

document.getElementById('infoModal').addEventListener('click', function(){
    if(_srvInterval){ clearInterval(_srvInterval); _srvInterval=null; }
});

let MUSIC_TRACKS = [];
let _musicIdx = 0;
const musicAudio = new Audio();
musicAudio.volume = 0.6;

function musicTrackNameFromFile(filename){
    return filename.replace(/\.mp3$/i, '');
}

async function loadMusicTracklist(){
    try{
        const res = await fetch('audio/tracklist.json');
        const data = await res.json();
        MUSIC_TRACKS = (data.tracks || []).filter(Boolean);
    }catch(e){
        MUSIC_TRACKS = [];
    }
    setupMusicPlayer();
}

function setupMusicPlayer(){
    const nameEl    = document.getElementById('music-track-name');
    const playBtn   = document.getElementById('music-play-btn');
    const prevBtn   = document.getElementById('music-prev-btn');
    const nextBtn   = document.getElementById('music-next-btn');
    const playerEl  = document.getElementById('music-player');
    const seekEl    = document.getElementById('music-seek');
    const curTimeEl = document.getElementById('music-time-current');
    const durTimeEl = document.getElementById('music-time-duration');

    if(!nameEl || !playerEl) return; 

    if(!MUSIC_TRACKS.length){
        nameEl.textContent = 'No tracks';
        playBtn.disabled = true;
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        seekEl.disabled = true;
        return;
    }

    musicAudio.loop = MUSIC_TRACKS.length === 1;

    musicAudio.addEventListener('ended', ()=>{
        if(MUSIC_TRACKS.length > 1){
            _musicIdx = (_musicIdx + 1) % MUSIC_TRACKS.length;
            loadMusicTrack(_musicIdx, true);
        }
    });

    prevBtn.onclick = ()=>{
        if(MUSIC_TRACKS.length < 2) return;
        _musicIdx = (_musicIdx - 1 + MUSIC_TRACKS.length) % MUSIC_TRACKS.length;
        loadMusicTrack(_musicIdx, true);
    };
    nextBtn.onclick = ()=>{
        if(MUSIC_TRACKS.length < 2) return;
        _musicIdx = (_musicIdx + 1) % MUSIC_TRACKS.length;
        loadMusicTrack(_musicIdx, true);
    };
    prevBtn.disabled = MUSIC_TRACKS.length < 2;
    nextBtn.disabled = MUSIC_TRACKS.length < 2;

    playBtn.onclick = ()=>{
        if(musicAudio.paused) musicAudio.play().catch(()=>{});
        else musicAudio.pause();
    };
    musicAudio.addEventListener('play',  ()=>{ playBtn.textContent='⏸'; });
    musicAudio.addEventListener('pause', ()=>{ playBtn.textContent='▶'; });

    const formatTime = (secs)=>{
        if(!isFinite(secs) || secs < 0) return '0:00';
        const m = Math.floor(secs/60);
        const s = Math.floor(secs%60).toString().padStart(2,'0');
        return `${m}:${s}`;
    };
    musicAudio.addEventListener('loadedmetadata', ()=>{
        seekEl.max = musicAudio.duration || 0;
        durTimeEl.textContent = formatTime(musicAudio.duration);
    });
    let isScrubbing = false;
    musicAudio.addEventListener('timeupdate', ()=>{
        if(isScrubbing) return;
        seekEl.value = musicAudio.currentTime;
        curTimeEl.textContent = formatTime(musicAudio.currentTime);
    });
    seekEl.addEventListener('input', ()=>{
        isScrubbing = true;
        curTimeEl.textContent = formatTime(parseFloat(seekEl.value));
    });
    seekEl.addEventListener('change', ()=>{
        musicAudio.currentTime = parseFloat(seekEl.value);
        isScrubbing = false;
    });

    loadMusicTrack(_musicIdx, false);
    makeMusicPlayerDraggable(playerEl, document.getElementById('music-drag-handle'));
    attemptMusicAutoplay();
}

function attemptMusicAutoplay(){
    let fallbackArmed = false;
    const armFallback = ()=>{
        if(fallbackArmed) return;
        fallbackArmed = true;
        const startOnFirstInteraction = ()=>{
            musicAudio.play().catch(()=>{});
            document.removeEventListener('click', startOnFirstInteraction);
            document.removeEventListener('keydown', startOnFirstInteraction);
            document.removeEventListener('touchstart', startOnFirstInteraction);
        };
        document.addEventListener('click', startOnFirstInteraction, {once:true});
        document.addEventListener('keydown', startOnFirstInteraction, {once:true});
        document.addEventListener('touchstart', startOnFirstInteraction, {once:true});
    };

    const playPromise = musicAudio.play();
    if(playPromise && typeof playPromise.catch === 'function'){
        playPromise.catch(armFallback);
    }

    setTimeout(()=>{
        if(musicAudio.paused) armFallback();
    }, 600);
}

function loadMusicTrack(index, autoplay){
    const nameEl = document.getElementById('music-track-name');
    if(!nameEl) return;
    const filename = MUSIC_TRACKS[index];
    musicAudio.src = `audio/${filename}`;
    nameEl.textContent = musicTrackNameFromFile(filename);
    if(autoplay) musicAudio.play().catch(()=>{});
}

function makeMusicPlayerDraggable(el, handle){
    let isDragging = false, offsetX = 0, offsetY = 0;
    const startDrag = (clientX, clientY)=>{
        isDragging = true;
        const rect = el.getBoundingClientRect();
        offsetX = clientX - rect.left;
        offsetY = clientY - rect.top;
    };
    const moveDrag = (clientX, clientY)=>{
        if(!isDragging) return;
        const x = clientX - offsetX, y = clientY - offsetY;
        const maxX = window.innerWidth - el.offsetWidth;
        const maxY = window.innerHeight - el.offsetHeight;
        el.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
        el.style.top  = `${Math.max(0, Math.min(y, maxY))}px`;
        el.style.right = 'auto';
        el.style.bottom = 'auto';
    };
    const endDrag = ()=>{ isDragging = false; };
    handle.addEventListener('mousedown', (e)=>{ startDrag(e.clientX, e.clientY); e.preventDefault(); });
    document.addEventListener('mousemove', (e)=> moveDrag(e.clientX, e.clientY));
    document.addEventListener('mouseup', endDrag);
    handle.addEventListener('touchstart', (e)=>{ const t=e.touches[0]; startDrag(t.clientX, t.clientY); }, {passive:true});
    document.addEventListener('touchmove', (e)=>{ const t=e.touches[0]; moveDrag(t.clientX, t.clientY); }, {passive:true});
    document.addEventListener('touchend', endDrag);
}

function dismissWelcomeOverlay(){
    const overlay = document.getElementById('welcome-overlay');
    if(overlay) overlay.classList.add('dismissed');
}
document.addEventListener('keydown', dismissWelcomeOverlay, {once:true});

(async()=>{
    const embedName = isEmbedMode();
    if(!embedName) loadMusicTracklist(); 
    await restoreSession();
    await load();
    if(embedName){
        await renderEmbedProfile(embedName);
    } else {
        await handleUrlOnLoad();
    }
})();
document.addEventListener('click',e=>{ if(!e.target.closest('.search-wrap')) document.getElementById('searchPopup')?.style && (document.getElementById('searchPopup').style.display='none'); });
if(!isEmbedMode()){
    const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;inset:0;z-index:0;pointer-events:none;';document.body.prepend(canvas);const ctx=canvas.getContext('2d');canvas.width=window.innerWidth;canvas.height=window.innerHeight;window.addEventListener('resize',()=>{canvas.width=window.innerWidth;canvas.height=window.innerHeight;});let stars=[];function spawnStar(){return{x:Math.random()*canvas.width,y:-10,size:Math.random()*3+1,speed:Math.random()*8+4,drift:Math.random()*1.5-.75};}
    let _starPaused=false;
    document.addEventListener('visibilitychange',()=>{
        if(document.hidden){ _starPaused=true; }
        else { _starPaused=false; stars=[]; }
    });
    setInterval(()=>{ if(!_starPaused) for(let i=0;i<6;i++) stars.push(spawnStar()); },80);
    (function animate(){
        ctx.clearRect(0,0,canvas.width,canvas.height);
        if(!_starPaused){
            for(let i=0;i<stars.length;i++){const s=stars[i];ctx.beginPath();ctx.fillStyle='white';ctx.shadowBlur=10;ctx.shadowColor='#00eeff';ctx.arc(s.x,s.y,s.size,0,Math.PI*2);ctx.fill();s.y+=s.speed;s.x+=s.drift;if(s.y>canvas.height+20){stars.splice(i,1);i--;}}
        }
        requestAnimationFrame(animate);
    })();
}
