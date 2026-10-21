// ================================================================
// VaultNova v1.1.0 — tab.js
// ================================================================
const APP_VERSION = '1.1.0';

const CATS_DEF = [
  {id:0,key:'catAll',   icon:'✨'},
  {id:1,key:'catSocial',icon:'📱'},
  {id:2,key:'catEmail', icon:'📧'},
  {id:3,key:'catBank',  icon:'🏦'},
  {id:4,key:'catGames', icon:'🎮'},
  {id:5,key:'catWork',  icon:'💼'},
  {id:6,key:'catShop',  icon:'🛍️'},
  {id:7,key:'catOther', icon:'📁'},
];

const EMOJIS = ['🔐','🌐','📧','🏦','📱','👤','🎮','💼','🚧',
  '⭐','🔑','🏰','💎','🖥️','📷','🚗','✈️','🐶','🎉','🔗',
  '💡','🎨','🔬','📚','🎵','💰','🎁','👑','⚡','🚀'];

const ST = {
  groups: [],
  masterPwd: null,
  masterPwdEnabled: true,
  storageType: null,
  storageConfig: {},
  activeCat: 0,
  searchQ: '',
  editingIdx: -1,
  theme: 'dark',
  lang: 'en',
  autoLockMin: 15,
  lastSync: null,
  initialized: false,
};

let confirmCb = null;

function $(id){ return document.getElementById(id); }
function uid(){ return Math.random().toString(36).slice(2)+Date.now().toString(36); }

// ----------------------------------------------------------------
// LOGO SVG
// ----------------------------------------------------------------
function logoSVG(size=48) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="lg1" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#7c4dff"/>
      <stop offset="100%" stop-color="#4fc3f7"/>
    </linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <path d="M24 2 L44 10 L44 26 C44 36 34 44 24 46 C14 44 4 36 4 26 L4 10 Z" fill="url(#lg1)" opacity=".9"/>
  <path d="M24 4 L42 11.5 L42 26 C42 35 33 42.5 24 44.5 C15 42.5 6 35 6 26 L6 11.5 Z" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="1"/>
  <!-- Lock body -->
  <rect x="16" y="24" width="16" height="13" rx="3" fill="white" opacity=".95" filter="url(#glow)"/>
  <!-- Shackle -->
  <path d="M18 24 L18 19 C18 14.6 30 14.6 30 19 L30 24" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".95"/>
  <!-- Keyhole -->
  <circle cx="24" cy="29.5" r="2.2" fill="#4fc3f7"/>
  <rect x="23" y="31" width="2" height="3.5" rx="1" fill="#4fc3f7"/>
  <!-- Stars -->
  <circle cx="38" cy="8" r="1.2" fill="#ffd54f" opacity=".9"/>
  <circle cx="10" cy="14" r=".9" fill="#ffd54f" opacity=".7"/>
  <circle cx="40" cy="32" r="1" fill="white" opacity=".6"/>
</svg>`;
}

// ----------------------------------------------------------------
// SETTINGS PERSISTENCE
// ----------------------------------------------------------------
async function loadSettings(){
  return new Promise(r=>chrome.storage.sync.get(
    ['storageType','storageConfig','theme','lang','autoLockMin','masterPwdEnabled','lastSync'],r));
}
async function saveSettings(){
  return new Promise(r=>chrome.storage.sync.set({
    storageType:ST.storageType, storageConfig:ST.storageConfig,
    theme:ST.theme, lang:ST.lang,
    autoLockMin:ST.autoLockMin, masterPwdEnabled:ST.masterPwdEnabled,
    lastSync:ST.lastSync,
  },r));
}

// ----------------------------------------------------------------
// PERSIST DATA
// ----------------------------------------------------------------
async function persist(){
  if(!ST.storageType) return;
  const payload = ST.masterPwdEnabled && ST.masterPwd
    ? await CryptoHelper.encrypt(ST.groups, ST.masterPwd)
    : JSON.stringify(ST.groups);
  await StorageManager.save(payload, ST.masterPwd||'__nopwd__');
  ST.lastSync = new Date().toISOString();
  await saveSettings();
  updateSyncInfo();
}

async function loadData(pwd){
  let raw;
  try { raw = await StorageManager.load(pwd||'__nopwd__'); } catch(e) { return null; }
  if(!raw) return [];
  // Try encrypted
  if(typeof raw === 'string') {
    try { return await CryptoHelper.decrypt(raw, pwd); } catch(e) {
      try { return JSON.parse(raw); } catch(e2) { return null; }
    }
  }
  return Array.isArray(raw) ? raw : [];
}

// ----------------------------------------------------------------
// INIT
// ----------------------------------------------------------------
async function init(){
  const cfg = await loadSettings();
  ST.theme     = cfg.theme || 'dark';
  ST.lang      = cfg.lang  || detectBrowserLang();
  ST.autoLockMin = cfg.autoLockMin !== undefined ? cfg.autoLockMin : 15;
  ST.masterPwdEnabled = cfg.masterPwdEnabled !== false;
  ST.lastSync  = cfg.lastSync || null;

  setLang(ST.lang);
  applyTheme();

  // Render logos everywhere
  ['langLogo','lockLogo','sidebarLogo'].forEach(id=>{
    const el = $(id); if(el) el.innerHTML = logoSVG(id==='langLogo'?72:id==='lockLogo'?64:36);
  });
  $('setupLogo').innerHTML = logoSVG(48);

  if(!cfg.storageType){
    showLangScreen();
    return;
  }

  ST.storageType   = cfg.storageType;
  ST.storageConfig = cfg.storageConfig || {};
  await StorageManager.init(ST.storageType, ST.storageConfig);

  if(!ST.masterPwdEnabled){
    // No password — load directly
    ST.groups = (await loadData(null)) || [];
    ST.initialized = true;
    showApp();
  } else {
    showLockScreen();
  }
}

function detectBrowserLang(){
  const l = (navigator.language||'en').slice(0,2).toLowerCase();
  const supported = LANGUAGES.map(x=>x.code);
  return supported.includes(l) ? l : 'en';
}

// ----------------------------------------------------------------
// LANG SCREEN
// ----------------------------------------------------------------
let selectedLang = 'en';

function showLangScreen(){
  selectedLang = ST.lang;
  $('screenLang').classList.add('active');
  renderLangGrid();
}

function renderLangGrid(){
  const grid = $('langGrid'); grid.innerHTML='';
  LANGUAGES.forEach(l=>{
    const opt=document.createElement('div'); opt.className='lang-opt'+(l.code===selectedLang?' selected':'');
    opt.innerHTML=`<span class="lang-flag">${l.flag}</span><span class="lang-label">${l.label}</span>`;
    opt.addEventListener('click',()=>{ selectedLang=l.code; renderLangGrid(); });
    grid.appendChild(opt);
  });
}

$('langCont').addEventListener('click',()=>{
  ST.lang = selectedLang;
  setLang(ST.lang);
  $('screenLang').classList.remove('active');
  chrome.storage.sync.set({lang:ST.lang});
  // Check if already configured
  chrome.storage.sync.get('storageType',r=>{
    if(!r.storageType) showSetupScreen();
    else showLockScreen();
  });
});

// ----------------------------------------------------------------
// LOCK SCREEN
// ----------------------------------------------------------------
function showLockScreen(){
  translateLockScreen();
  const meta = STORAGE_META[ST.storageType];
  if(meta){ $('lockBadgeIcon').textContent=meta.icon; $('lockBadgeLabel').textContent=meta.label; }
  $('screenLock').classList.add('active');
  setTimeout(()=>$('lockPwd').focus(),100);
}

function translateLockScreen(){
  $('lockSub').textContent = t('enterMasterPwd');
  $('lockBtn').textContent = t('unlock');
  $('lockChangeStorage').textContent = t('changeStorage');
  $('lockSettings').textContent = t('settings');
}

$('lockBtn').addEventListener('click',doUnlock);
$('lockPwd').addEventListener('keydown',e=>{ if(e.key==='Enter') doUnlock(); });
$('lockChangeStorage').addEventListener('click',()=>{
  $('screenLock').classList.remove('active');
  showSetupScreen();
});
$('lockSettings').addEventListener('click',()=>openSettings());

async function doUnlock(){
  const pwd = $('lockPwd').value;
  if(!pwd&&ST.masterPwdEnabled){ $('lockErr').textContent=t('wrongPassword'); return; }
  $('lockBtn').textContent = t('verifying');
  $('lockErr').textContent='';
  try{
    const data = await loadData(pwd);
    if(data===null) throw new Error('WRONG_PASSWORD');
    ST.masterPwd = pwd;
    ST.groups = Array.isArray(data)?data:[];
    $('lockPwd').value='';
    ST.initialized=true;
    $('screenLock').classList.remove('active');
    showApp();
    if(ST.autoLockMin>0) chrome.runtime.sendMessage({type:'RESET_LOCK_TIMER',minutes:ST.autoLockMin});
  } catch(e){
    $('lockErr').textContent=t('wrongPassword');
  } finally{
    $('lockBtn').textContent=t('unlock');
  }
}

// ----------------------------------------------------------------
// SETUP SCREEN
// ----------------------------------------------------------------
let selStorageType='local';

function showSetupScreen(back=false){
  translateSetupScreen();
  selStorageType = ST.storageType||'local';
  $('screenSetup').classList.add('active');
  renderStorageGrid();
  if(back) $('setupBackBtn').classList.remove('hidden');
  else $('setupBackBtn').classList.add('hidden');
}

function translateSetupScreen(){
  $('setupTitle').textContent = t('chooseStorage');
  $('setupHint').textContent  = t('storageHint');
  $('pwdHint').textContent    = t('masterPasswordHint');
  $('pwdLabel1').textContent  = t('masterPassword');
  $('pwdLabel2').textContent  = t('repeatPassword');
  $('setupBtn').textContent   = t('saveAndStart');
  $('setupBackBtn').textContent = t('back');
}

function renderStorageGrid(){
  const grid=$('storageGrid'); grid.innerHTML='';
  Object.entries(STORAGE_META).forEach(([type,meta])=>{
    const opt=document.createElement('div');
    opt.className='storage-opt'+(type===selStorageType?' selected':'');
    const descKey='sd'+type.charAt(0).toUpperCase()+type.slice(1);
    opt.innerHTML=`<div class="s-icon">${meta.icon}</div>
      <div class="s-label" style="color:${meta.color}">${meta.label}</div>
      <div class="s-desc">${t(descKey)}</div>`;
    opt.addEventListener('click',()=>{ selStorageType=type; renderStorageGrid(); renderSetupFields(); });
    grid.appendChild(opt);
  });
  renderSetupFields();
}

function renderSetupFields(){
  const meta=STORAGE_META[selStorageType];
  const cont=$('setupFields');
  if(!meta.fields||meta.fields.length===0){ cont.style.display='none'; return; }
  cont.style.display='block';
  cont.innerHTML=meta.fields.map(f=>`
    <div class="sf-row">
      <div class="sf-label">${f.label}</div>
      <input class="sf-inp" id="sf_${f.key}" type="${f.type||'text'}" placeholder="${f.placeholder||''}" autocomplete="off">
      ${f.hint?`<div class="sf-hint">${f.hint}</div>`:''}
    </div>`).join('');
  // Restore saved config
  if(ST.storageType===selStorageType && ST.storageConfig){
    meta.fields.forEach(f=>{ const el=$('sf_'+f.key); if(el&&ST.storageConfig[f.key]) el.value=ST.storageConfig[f.key]; });
  }
}

$('setupBtn').addEventListener('click',doSetup);
$('setupBackBtn').addEventListener('click',()=>{
  $('screenSetup').classList.remove('active');
  if(ST.storageType) showLockScreen();
  else showLangScreen();
});

async function doSetup(){
  const pwd=$('setupPwd').value, pwd2=$('setupPwd2').value;
  if(pwd.length<6){$('setupErr').textContent=t('passwordTooShort');return;}
  if(pwd!==pwd2){$('setupErr').textContent=t('passwordMismatch');return;}
  $('setupErr').textContent='';
  const meta=STORAGE_META[selStorageType];
  const config={};
  (meta.fields||[]).forEach(f=>{ const el=$('sf_'+f.key); if(el) config[f.key]=el.value.trim(); });
  $('setupBtn').textContent=t('verifying');
  try{
    ST.storageType=selStorageType;
    ST.storageConfig=config;
    ST.masterPwd=pwd;
    ST.masterPwdEnabled=true;
    await StorageManager.init(ST.storageType,ST.storageConfig);
    let data=null;
    try{data=await loadData(pwd);}catch(e){}
    ST.groups=Array.isArray(data)?data:[];
    await saveSettings();
    await persist();
    ST.initialized=true;
    $('screenSetup').classList.remove('active');
    showApp();
  }catch(e){
    $('setupErr').textContent=t('error')+': '+e.message;
  }finally{
    $('setupBtn').textContent=t('saveAndStart');
  }
}

// ----------------------------------------------------------------
// SHOW APP
// ----------------------------------------------------------------
function showApp(){
  document.title='VaultNova';
  $('app').style.display='flex';
  translateApp();
  renderCats();
  renderCards();
  updateSyncInfo();
}

function translateApp(){
  $('sbTag').textContent       = t('appTagline');
  $('statTotalL').textContent  = t('total');
  $('statSyncL').textContent   = t('lastSync');
  $('sbCatLabel').textContent  = t('category');
  $('sbSettingsLabel').textContent = t('settings');
  $('sbSyncLabel').textContent     = t('syncNow');
  $('sbLockLabel').textContent     = t('lock');
  $('searchInp').placeholder   = t('search');
  $('btnAdd').textContent      = '+ '+t('addGroupBtn');
}

function updateSyncInfo(){
  const total = ST.groups.length;
  $('statTotal').textContent = total;
  const ls = ST.lastSync ? new Date(ST.lastSync).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : t('never');
  $('statSyncTime').textContent = ls;
}

// ----------------------------------------------------------------
// SIDEBAR EVENTS
// ----------------------------------------------------------------
$('sbBtnLock').addEventListener('click',()=>{
  ST.masterPwd=null; ST.groups=[]; ST.initialized=false;
  $('app').style.display='none';
  chrome.runtime.sendMessage({type:'LOCK_NOW'});
  $('lockPwd').value=''; $('lockErr').textContent='';
  showLockScreen();
});

$('sbBtnSettings').addEventListener('click',openSettings);
$('sbBtnSync').addEventListener('click', async()=>{
  $('sbBtnSync').querySelector('span').textContent=t('verifying');
  try{ await persist(); } catch(e){}
  $('sbBtnSync').querySelector('span').textContent=t('syncNow');
});

$('btnAdd').addEventListener('click',()=>openGroupModal(-1));
$('btnTheme').addEventListener('click',toggleTheme);

$('searchInp').addEventListener('input',e=>{ ST.searchQ=e.target.value.toLowerCase(); renderCards(); });

// ----------------------------------------------------------------
// CATEGORIES
// ----------------------------------------------------------------
function renderCats(){
  const list=$('catsList'); list.innerHTML='';
  CATS_DEF.forEach(c=>{
    const cnt = c.id===0 ? ST.groups.length : ST.groups.filter(g=>g.cat===c.id).length;
    const btn=document.createElement('button');
    btn.className='cat-btn'+(c.id===ST.activeCat?' active':'');
    btn.innerHTML=`<span>${c.icon}</span><span>${t(c.key)}</span><span class="cat-cnt">${cnt}</span>`;
    btn.addEventListener('click',()=>{ ST.activeCat=c.id; renderCats(); renderCards(); });
    list.appendChild(btn);
  });
}

// ----------------------------------------------------------------
// CARDS GRID
// ----------------------------------------------------------------
function renderCards(){
  const grid=$('cardsGrid'); grid.innerHTML='';
  let groups=ST.groups;
  if(ST.activeCat!==0) groups=groups.filter(g=>g.cat===ST.activeCat);
  if(ST.searchQ) groups=groups.filter(g=>
    g.name.toLowerCase().includes(ST.searchQ)||
    (g.note||'').toLowerCase().includes(ST.searchQ)||
    (g.rows||[]).some(r=>(r.label+r.value).toLowerCase().includes(ST.searchQ))
  );

  if(groups.length===0){
    const empty=document.createElement('div'); empty.className='empty-state';
    empty.innerHTML=`<div class="e-icon">🔐</div><div class="e-title">${t('nothingFound')}</div>`;
    grid.appendChild(empty);
  }

  groups.forEach(g=>{
    const idx=ST.groups.indexOf(g);
    grid.appendChild(buildCard(g,idx));
  });

  // Add card button
  const addBtn=document.createElement('div'); addBtn.className='add-card-btn';
  addBtn.innerHTML=`<span style="font-size:1.5rem">➕</span><span>${t('addGroupBtn')}</span>`;
  addBtn.addEventListener('click',()=>openGroupModal(-1));
  grid.appendChild(addBtn);

  updateSyncInfo();
}

function buildCard(g,idx){
  const card=document.createElement('div'); card.className='group-card'; card.dataset.id=g.id;

  // Header
  const hdr=document.createElement('div'); hdr.className='card-hdr';
  const dragH=document.createElement('span'); dragH.className='drag-h'; dragH.textContent='⋮⋮'; dragH.title='Drag';
  const icon=document.createElement('span'); icon.className='c-icon'; icon.textContent=g.icon||'🔑';
  const info=document.createElement('div'); info.className='c-info';
  const name=document.createElement('div'); name.className='c-name'; name.textContent=g.name;
  const note=document.createElement('div'); note.className='c-note'; note.textContent=g.note||'';
  info.append(name); if(g.note) info.append(note);
  const badge=document.createElement('span'); badge.className='c-badge'; badge.textContent=(g.rows||[]).length;
  const actions=document.createElement('div'); actions.className='card-actions';
  const editBtn=document.createElement('button'); editBtn.className='ic-btn'; editBtn.title=t('edit'); editBtn.textContent='✏️';
  editBtn.addEventListener('click',e=>{ e.stopPropagation(); openGroupModal(idx); });
  const delBtn=document.createElement('button'); delBtn.className='ic-btn d'; delBtn.title=t('delete'); delBtn.textContent='🗑️';
  delBtn.addEventListener('click',e=>{ e.stopPropagation();
    showConfirm(t('confirmDeleteGroup')+' «'+g.name+'»?',t('irreversible'),()=>{
      ST.groups.splice(idx,1); persist(); renderCats(); renderCards();
    });
  });
  actions.append(editBtn,delBtn);
  hdr.append(dragH,icon,info,badge,actions);

  // Rows
  const rowsEl=document.createElement('div'); rowsEl.className='card-rows';
  (g.rows||[]).forEach(row=>{
    const item=document.createElement('div'); item.className='row-item';
    const label=document.createElement('div'); label.className='row-label'; label.textContent=row.label;
    const valWrap=document.createElement('div'); valWrap.className='row-val-wrap';
    const inp=document.createElement('input');
    inp.className='row-inp'+(row.type==='password'?' pwd':'');
    inp.value=row.value; inp.readOnly=true;
    if(row.type==='password') inp.type='password';
    valWrap.appendChild(inp);
    const btns=document.createElement('div'); btns.className='row-btns';
    const copyBtn=document.createElement('button'); copyBtn.className='r-btn'; copyBtn.title=t('copy'); copyBtn.textContent='⧉';
    copyBtn.addEventListener('click',()=>{ navigator.clipboard.writeText(row.value); copyBtn.textContent='✅'; copyBtn.classList.add('copied'); setTimeout(()=>{copyBtn.textContent='⧉';copyBtn.classList.remove('copied');},1500); });
    btns.appendChild(copyBtn);
    if(row.type==='password'){
      const vis=document.createElement('button'); vis.className='r-btn'; vis.textContent='👁';
      vis.addEventListener('click',()=>{ inp.type=inp.type==='password'?'text':'password'; vis.textContent=inp.type==='password'?'👁':'🙈'; });
      btns.appendChild(vis);
    }
    item.append(label,valWrap,btns);
    rowsEl.appendChild(item);
  });

  hdr.addEventListener('click',()=>{
    const o=rowsEl.classList.contains('open');
    rowsEl.classList.toggle('open',!o); hdr.classList.toggle('open',!o);
  });

  // Drag & Drop
  card.draggable=false;
  dragH.addEventListener('mousedown',()=>card.draggable=true);
  card.addEventListener('dragstart',e=>{ e.dataTransfer.setData('text/plain',g.id); e.dataTransfer.effectAllowed='move'; setTimeout(()=>card.classList.add('dragging'),0); });
  card.addEventListener('dragend',()=>{ card.draggable=false; card.classList.remove('dragging'); document.querySelectorAll('.group-card').forEach(c=>c.classList.remove('drag-over')); });
  card.addEventListener('dragover',e=>{ e.preventDefault(); document.querySelectorAll('.group-card').forEach(c=>c.classList.remove('drag-over')); card.classList.add('drag-over'); });
  card.addEventListener('drop',e=>{ e.preventDefault(); const sid=e.dataTransfer.getData('text/plain'); if(sid===g.id) return; const si=ST.groups.findIndex(x=>x.id===sid),di=ST.groups.findIndex(x=>x.id===g.id); if(si<0||di<0) return; const [m]=ST.groups.splice(si,1); ST.groups.splice(di,0,m); persist(); renderCards(); });

  card.append(hdr,rowsEl);
  return card;
}

// ----------------------------------------------------------------
// GROUP MODAL
// ----------------------------------------------------------------
function openGroupModal(idx){
  ST.editingIdx=idx;
  const g=idx>=0?ST.groups[idx]:null;
  $('mgTitle').textContent=g?t('editGroup'):t('newGroup');
  $('mlIcon').textContent=t('icon'); $('mlName').textContent=t('groupName');
  $('mlNote').textContent=t('groupNote'); $('mlCat').textContent=t('category');
  $('mlFields').textContent=t('fields');
  $('mgAddRow').textContent=t('addField');
  $('mgCancel').textContent=t('cancel'); $('mgSave').textContent=t('save');
  $('mgIcon').value=g?g.icon||'':'';
  $('mgName').value=g?g.name:'';
  $('mgNote').value=g?g.note||'':'';

  // Emojis
  const eRow=$('mgEmojis'); eRow.innerHTML='';
  EMOJIS.forEach(em=>{
    const b=document.createElement('button'); b.className='emoji-btn'; b.textContent=em;
    b.addEventListener('click',()=>{ $('mgIcon').value=em; eRow.querySelectorAll('.emoji-btn').forEach(x=>x.classList.remove('sel')); b.classList.add('sel'); });
    eRow.appendChild(b);
  });

  // Cat
  const sel=$('mgCat'); sel.innerHTML='';
  CATS_DEF.filter(c=>c.id>0).forEach(c=>{
    const o=document.createElement('option'); o.value=c.id; o.textContent=c.icon+' '+t(c.key);
    if(g&&g.cat===c.id) o.selected=true; sel.appendChild(o);
  });
  if(!g) sel.value=7;

  // Rows
  const rl=$('mgRows'); rl.innerHTML='';
  (g?g.rows||[]:[{label:t('fieldLabel'),value:'',type:'text'},{label:t('masterPassword'),value:'',type:'password'}])
    .forEach(r=>addModalRow(r.label,r.value,r.type));

  $('modalGroup').classList.add('open');
  setTimeout(()=>$('mgName').focus(),100);
}

function addModalRow(label='',value='',type='text'){
  const list=$('mgRows');
  const item=document.createElement('div'); item.className='mrow-item';
  const lI=document.createElement('input'); lI.className='m-inp'; lI.placeholder=t('fieldLabel'); lI.value=label; lI.style.flex='.8';
  const vI=document.createElement('input'); vI.className='m-inp'; vI.placeholder=t('fieldValue'); vI.value=value;
  const tS=document.createElement('select'); tS.className='m-sel'; tS.style.width='auto';
  [['text','🔤 Text'],['password','🔒 Pwd'],['url','🔗 URL'],['email','📧 Email']].forEach(([v,l])=>{
    const o=document.createElement('option'); o.value=v; o.textContent=l; if(v===type) o.selected=true; tS.appendChild(o);
  });
  const rm=document.createElement('button'); rm.className='mrow-rm'; rm.textContent='✕';
  rm.addEventListener('click',()=>item.remove());
  item.append(lI,vI,tS,rm); list.appendChild(item);
}

$('mgAddRow').addEventListener('click',()=>addModalRow());
$('mgCancel').addEventListener('click',()=>$('modalGroup').classList.remove('open'));
$('modalGroup').addEventListener('click',e=>{ if(e.target===$('modalGroup')) $('modalGroup').classList.remove('open'); });
$('mgSave').addEventListener('click',()=>{
  const name=$('mgName').value.trim(); if(!name){$('mgName').focus();return;}
  const rows=[];
  $('mgRows').querySelectorAll('.mrow-item').forEach(item=>{
    const [lI,vI,tS]=item.querySelectorAll('input,select');
    if(lI.value.trim()||vI.value.trim()) rows.push({label:lI.value.trim(),value:vI.value,type:tS.value});
  });
  const g={
    id:(ST.editingIdx>=0?ST.groups[ST.editingIdx].id:null)||uid(),
    icon:$('mgIcon').value||'🔑',
    name,note:$('mgNote').value.trim(),
    cat:parseInt($('mgCat').value)||7, rows
  };
  if(ST.editingIdx>=0) ST.groups[ST.editingIdx]=g; else ST.groups.push(g);
  persist(); $('modalGroup').classList.remove('open'); renderCats(); renderCards();
});

// ----------------------------------------------------------------
// CONFIRM
// ----------------------------------------------------------------
function showConfirm(title,text,cb){
  $('confirmTitle').textContent=title;
  $('confirmText').textContent=text;
  $('confirmNo').textContent=t('cancel');
  $('confirmYes').textContent=t('delete');
  confirmCb=cb;
  $('modalConfirm').classList.add('open');
}
$('confirmNo').addEventListener('click',()=>$('modalConfirm').classList.remove('open'));
$('confirmYes').addEventListener('click',()=>{ $('modalConfirm').classList.remove('open'); if(confirmCb) confirmCb(); });
$('modalConfirm').addEventListener('click',e=>{ if(e.target===$('modalConfirm')) $('modalConfirm').classList.remove('open'); });

// ----------------------------------------------------------------
// SETTINGS PANEL
// ----------------------------------------------------------------
function openSettings(){
  const panel=$('panelSettings');
  $('psTitle').textContent=t('settings');
  $('psClose').addEventListener('click',()=>panel.classList.remove('open'),{once:true});
  renderSettingsPanel();
  panel.classList.add('open');
}
$('psClose').addEventListener('click',()=>$('panelSettings').classList.remove('open'));

async function renderSettingsPanel(){
  const body=$('panelBody'); body.innerHTML='';

  // --- Storage ---
  const sec1=document.createElement('div'); sec1.className='ps-section';
  sec1.innerHTML=`<div class="ps-title">${t('storage')}</div>`;
  const meta=STORAGE_META[ST.storageType||'local'];
  const csDiv=document.createElement('div'); csDiv.className='cs-current';
  csDiv.innerHTML=`<span class="cs-icon">${meta?.icon||'💻'}</span><span class="cs-name">${meta?.label||''}</span><span class="cs-status cs-ok" id="csStatus">${t('checking')}</span>`;
  sec1.appendChild(csDiv);
  const chBtn=document.createElement('button'); chBtn.className='ps-btn'; chBtn.textContent=t('changeStorage'); chBtn.style.width='100%'; chBtn.style.marginBottom='6px';
  chBtn.addEventListener('click',()=>{ $('panelSettings').classList.remove('open'); showSetupScreen(true); });
  sec1.appendChild(chBtn);
  body.appendChild(sec1);
  // test connection async
  StorageManager.test().then(ok=>{
    const s=$('csStatus'); if(s){s.textContent=ok?t('connected'):t('notConnected'); s.className='cs-status '+(ok?'cs-ok':'cs-err');}
  });

  // --- Export ---
  const sec2=document.createElement('div'); sec2.className='ps-section';
  sec2.innerHTML=`<div class="ps-title">${t('exportData')}</div><div class="export-grid" id="expGrid"></div>`;
  body.appendChild(sec2);
  const expGrid=sec2.querySelector('#expGrid');
  [
    {key:'exportEncrypted',icon:'🔐',ext:'.vault',fn:exportVault},
    {key:'exportJSON',     icon:'📄',ext:'.json', fn:exportJSON},
    {key:'exportCSV',      icon:'📊',ext:'.csv',  fn:exportCSV},
    {key:'exportHTML',     icon:'🌐',ext:'.html', fn:exportHTML},
  ].forEach(({key,icon,ext,fn})=>{
    const b=document.createElement('button'); b.className='exp-btn';
    b.innerHTML=`<span class="exp-icon">${icon}</span><span class="exp-label">${t(key)}</span><span class="exp-desc">${ext}</span>`;
    b.addEventListener('click',fn);
    expGrid.appendChild(b);
  });

  // Import
  const impRow=document.createElement('div'); impRow.className='ps-row';
  impRow.innerHTML=`<div class="ps-row-info"><div class="ps-row-label">${t('importData')}</div><div class="ps-row-desc">.vault .json</div></div>`;
  const impBtn=document.createElement('button'); impBtn.className='ps-btn'; impBtn.textContent='↑ '+t('importData');
  impBtn.addEventListener('click',doImport);
  impRow.appendChild(impBtn); sec2.appendChild(impRow);

  // --- Security ---
  const sec3=document.createElement('div'); sec3.className='ps-section';
  sec3.innerHTML=`<div class="ps-title">${t('masterPwdProtection')}</div>`;
  const pwdRow=document.createElement('div'); pwdRow.className='ps-row';
  pwdRow.innerHTML=`<div class="ps-row-info"><div class="ps-row-label">${t('masterPwdProtection')}</div><div class="ps-row-desc">${ST.masterPwdEnabled?t('masterPwdEnabled'):t('masterPwdDisabled')}</div></div>`;
  const toggle=document.createElement('button'); toggle.className='toggle'+(ST.masterPwdEnabled?' on':'');
  toggle.addEventListener('click',async()=>{
    ST.masterPwdEnabled=!ST.masterPwdEnabled;
    toggle.classList.toggle('on',ST.masterPwdEnabled);
    pwdRow.querySelector('.ps-row-desc').textContent=ST.masterPwdEnabled?t('masterPwdEnabled'):t('masterPwdDisabled');
    await saveSettings(); await persist();
  });
  pwdRow.appendChild(toggle); sec3.appendChild(pwdRow);

  // Auto-lock
  const alRow=document.createElement('div'); alRow.className='ps-row';
  alRow.innerHTML=`<div class="ps-row-info"><div class="ps-row-label">${t('autoLock')}</div></div>`;
  const alSel=document.createElement('select'); alSel.className='m-sel'; alSel.style.width='auto';
  [[0,t('autoLockOff')],[5,'5 min'],[15,'15 min'],[30,'30 min'],[60,'1h']].forEach(([v,l])=>{
    const o=document.createElement('option'); o.value=v; o.textContent=l; if(v===ST.autoLockMin) o.selected=true; alSel.appendChild(o);
  });
  alSel.addEventListener('change',async()=>{ ST.autoLockMin=parseInt(alSel.value); await saveSettings(); });
  alRow.appendChild(alSel); sec3.appendChild(alRow);
  body.appendChild(sec3);

  // --- Appearance ---
  const sec4=document.createElement('div'); sec4.className='ps-section';
  sec4.innerHTML=`<div class="ps-title">${t('theme')} / ${t('language')}</div>`;
  const thRow=document.createElement('div'); thRow.className='ps-row';
  thRow.innerHTML=`<div class="ps-row-info"><div class="ps-row-label">${t('theme')}</div></div>`;
  const thBtn=document.createElement('button'); thBtn.className='ps-btn active'; thBtn.textContent=ST.theme==='dark'?t('themeDark'):t('themeLight');
  thBtn.addEventListener('click',()=>{ toggleTheme(); thBtn.textContent=ST.theme==='dark'?t('themeDark'):t('themeLight'); });
  thRow.appendChild(thBtn); sec4.appendChild(thRow);

  const langRow=document.createElement('div'); langRow.className='ps-row';
  langRow.innerHTML=`<div class="ps-row-info"><div class="ps-row-label">${t('language')}</div></div>`;
  const langSel=document.createElement('select'); langSel.className='m-sel'; langSel.style.width='auto';
  LANGUAGES.forEach(l=>{ const o=document.createElement('option'); o.value=l.code; o.textContent=l.flag+' '+l.label; if(l.code===ST.lang) o.selected=true; langSel.appendChild(o); });
  langSel.addEventListener('change',()=>{ ST.lang=langSel.value; setLang(ST.lang); chrome.storage.sync.set({lang:ST.lang}); translateApp(); renderCats(); renderCards(); });
  langRow.appendChild(langSel); sec4.appendChild(langRow);
  body.appendChild(sec4);

  // --- Updates ---
  const sec5=document.createElement('div'); sec5.className='ps-section';
  sec5.innerHTML=`<div class="ps-title">${t('about')}</div>`;
  const verRow=document.createElement('div'); verRow.className='ps-row';
  verRow.innerHTML=`<div class="ps-row-info"><div class="ps-row-label">${t('currentVersion')}</div><div class="ps-row-desc">v${APP_VERSION}</div></div>`;
  const updBtn=document.createElement('button'); updBtn.className='ps-btn'; updBtn.textContent=t('checkUpdates');
  updBtn.addEventListener('click',()=>checkUpdates(updBtn));
  verRow.appendChild(updBtn); sec5.appendChild(verRow);
  body.appendChild(sec5);

  // --- Danger ---
  const sec6=document.createElement('div'); sec6.className='ps-section';
  sec6.innerHTML=`<div class="ps-title" style="color:var(--err)">${t('danger')}</div>`;
  const clearRow=document.createElement('div'); clearRow.className='ps-row';
  clearRow.innerHTML=`<div class="ps-row-info"><div class="ps-row-label">${t('clearAll')}</div></div>`;
  const clearBtn=document.createElement('button'); clearBtn.className='ps-btn danger'; clearBtn.textContent='🗑️ '+t('clearAll');
  clearBtn.addEventListener('click',()=>showConfirm(t('clearAll'),t('irreversible'),async()=>{
    ST.groups=[]; await persist();
    chrome.storage.sync.clear();
    location.reload();
  }));
  clearRow.appendChild(clearBtn); sec6.appendChild(clearRow);
  body.appendChild(sec6);
}

async function checkUpdates(btn){
  btn.textContent = t('verifying');
  // Simple version check — can be replaced with real URL
  await new Promise(r=>setTimeout(r,1200));
  btn.textContent = t('upToDate') + ' v' + APP_VERSION;
  setTimeout(()=>btn.textContent=t('checkUpdates'),3000);
}

// ----------------------------------------------------------------
// THEME
// ----------------------------------------------------------------
function applyTheme(){
  document.documentElement.setAttribute('data-theme',ST.theme);
}
function toggleTheme(){
  ST.theme = ST.theme==='dark'?'light':'dark';
  applyTheme();
  chrome.storage.sync.set({theme:ST.theme});
}

// ----------------------------------------------------------------
// EXPORT FUNCTIONS
// ----------------------------------------------------------------
function download(content,filename,mime){
  const blob=new Blob([content],{type:mime});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=filename; a.click();
}

function fname(ext){
  return 'vaultnova_'+new Date().toISOString().slice(0,10)+ext;
}

async function exportVault(){
  if(!ST.masterPwd&&ST.masterPwdEnabled){ alert(t('enterMasterPwd')); return; }
  const enc=await CryptoHelper.encrypt(ST.groups,ST.masterPwd||'__nopwd__');
  download(enc,fname('.vault'),'text/plain');
}

function exportJSON(){
  download(JSON.stringify(ST.groups,null,2),fname('.json'),'application/json');
}

function exportCSV(){
  const rows=['Group,Icon,Category,Field,Value,Type'];
  ST.groups.forEach(g=>{
    if(!g.rows||g.rows.length===0){
      rows.push(`"${g.name}","${g.icon||''}","${getCatName(g.cat)}","","",""`);
    } else {
      g.rows.forEach(r=>{
        const val=r.type==='password'?'[HIDDEN]':r.value;
        rows.push(`"${g.name}","${g.icon||''}","${getCatName(g.cat)}","${r.label}","${val}","${r.type}"`);
      });
    }
  });
  download(rows.join('\n'),fname('.csv'),'text/csv;charset=utf-8');
}

function getCatName(id){
  const c=CATS_DEF.find(x=>x.id===id);
  return c?t(c.key):'';
}

function exportHTML(){
  const rows=ST.groups.map(g=>{
    const fields=(g.rows||[]).map(r=>`
      <tr><td class="fl">${r.label}</td><td class="fv">${r.type==='password'?'<span class="pwd-mask">••••••••</span>':escHtml(r.value)}</td></tr>
    `).join('');
    return `<div class="card">
      <div class="card-hdr"><span class="ci">${g.icon||'🔑'}</span><span class="cn">${escHtml(g.name)}</span><span class="cat">${getCatName(g.cat)}</span></div>
      ${g.note?`<div class="note">${escHtml(g.note)}</div>`:''}
      <table>${fields}</table>
    </div>`;
  }).join('');

  const html=`<!DOCTYPE html><html lang="${ST.lang}"><head><meta charset="UTF-8">
<title>VaultNova Export — ${new Date().toLocaleDateString()}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#060810;color:#d0e8ff;padding:20px;}
h1{color:#4fc3f7;font-size:1.4rem;margin-bottom:4px;}
.meta{color:#4a6a8a;font-size:.78rem;margin-bottom:24px;}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;}
.card{background:rgba(6,14,40,.95);border:1px solid rgba(79,195,247,.15);border-radius:10px;overflow:hidden;}
.card-hdr{display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(79,195,247,.06);}
.ci{font-size:1.2rem;}.cn{flex:1;font-weight:700;color:#4fc3f7;font-size:.9rem;}
.cat{font-size:.65rem;background:rgba(79,195,247,.12);color:#4fc3f7;padding:2px 8px;border-radius:8px;}
.note{font-size:.75rem;color:#4a6a8a;padding:6px 12px;border-bottom:1px solid rgba(79,195,247,.07);}
table{width:100%;border-collapse:collapse;}
td{padding:6px 12px;font-size:.82rem;border-bottom:1px solid rgba(79,195,247,.05);}
td.fl{color:#4a6a8a;width:100px;}.fv{font-family:'Consolas','Courier New',mono;word-break:break-all;}
.pwd-mask{color:#4a6a8a;letter-spacing:.1em;}
tr:last-child td{border-bottom:none;}
</style></head><body>
<h1>🔐 VaultNova</h1>
<div class="meta">Export — ${new Date().toLocaleString()} — ${ST.groups.length} groups</div>
<div class="grid">${rows}</div>
</body></html>`;
  download(html,fname('.html'),'text/html;charset=utf-8');
}

function escHtml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function doImport(){
  const inp=document.createElement('input'); inp.type='file'; inp.accept='.vault,.json,.data';
  inp.onchange=async e=>{
    const file=e.target.files[0]; if(!file) return;
    const text=await file.text();
    try{
      let data;
      try { data=await CryptoHelper.decrypt(text.trim(),ST.masterPwd||'__nopwd__'); }
      catch(e){ data=JSON.parse(text); }
      if(Array.isArray(data)){
        ST.groups=data; await persist(); renderCats(); renderCards();
        $('panelSettings').classList.remove('open');
      }
    } catch(er){ alert(t('error')); }
  };
  inp.click();
}

// ----------------------------------------------------------------
// START
// ----------------------------------------------------------------
init();
