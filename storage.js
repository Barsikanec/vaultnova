// ================================================================
// STORAGE MANAGER — all adapters
// ================================================================

const STORAGE_TYPES = {
  LOCAL:      'local',
  FILE:       'file',
  SUPABASE:   'supabase',
  YANDEX:     'yandex',
  GDRIVE:     'gdrive',
  DROPBOX:    'dropbox',
  ONEDRIVE:   'onedrive',
  WEBDAV:     'webdav',
  CUSTOM:     'custom'
};

const STORAGE_META = {
  local:    { label: '\uD83D\uDCBB \u041B\u043E\u043A\u0430\u043B\u044C\u043D\u043E (\u0432 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435)',    icon: '\uD83D\uDCBB', color: '#4fc3f7', fields: [] },
  file:     { label: '\uD83D\uDCC1 \u041B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0439 \u0444\u0430\u0439\u043B',           icon: '\uD83D\uDCC1', color: '#80cbc4', fields: [] },
  supabase: { label: '\u26A1 Supabase',                       icon: '\u26A1', color: '#69d475',
    fields: [
      { key:'url',      label:'URL \u043F\u0440\u043E\u0435\u043A\u0442\u0430',        placeholder:'https://xxx.supabase.co', type:'url' },
      { key:'anonKey',  label:'Anon Key',              placeholder:'eyJhbGci...', type:'password' },
      { key:'email',    label:'Email',                 placeholder:'you@example.com', type:'email' },
      { key:'password', label:'\u041F\u0430\u0440\u043E\u043B\u044C \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0430',     placeholder:'\u0412\u0430\u0448 \u043F\u0430\u0440\u043E\u043B\u044C', type:'password' },
    ]
  },
  yandex:   { label: '\uD83D\uDFE1 \u042F\u043D\u0434\u0435\u043A\u0441.\u0414\u0438\u0441\u043A',              icon: '\uD83D\uDFE1', color: '#ffd54f',
    fields: [
      { key:'token', label:'OAuth Token', placeholder:'y0_AgAAAA...', type:'password', hint:'\uD83D\uDD17 \u041F\u043E\u043B\u0443\u0447\u0438\u0442\u044C: oauth.yandex.ru' }
    ]
  },
  gdrive:   { label: '\uD83D\uDD35 Google Drive',               icon: '\uD83D\uDD35', color: '#4285f4',
    fields: [
      { key:'clientId', label:'Client ID', placeholder:'xxx.apps.googleusercontent.com', type:'text', hint:'\uD83D\uDD17 console.cloud.google.com' }
    ]
  },
  dropbox:  { label: '\uD83D\uDFE6 Dropbox',                    icon: '\uD83D\uDFE6', color: '#0061fe',
    fields: [
      { key:'token', label:'Access Token', placeholder:'sl.xxx...', type:'password', hint:'\uD83D\uDD17 dropbox.com/developers' }
    ]
  },
  onedrive: { label: '\uD83D\uDFE6 OneDrive',                   icon: '\uD83D\uDFE6', color: '#0078d4',
    fields: [
      { key:'clientId', label:'Client ID', placeholder:'xxx-xxx-xxx', type:'text', hint:'\uD83D\uDD17 portal.azure.com' }
    ]
  },
  webdav:   { label: '\uD83D\uDEE0\uFE0F WebDAV \u0441\u0435\u0440\u0432\u0435\u0440',           icon: '\uD83D\uDEE0\uFE0F', color: '#b39ddb',
    fields: [
      { key:'url',      label:'URL \u0441\u0435\u0440\u0432\u0435\u0440\u0430',  placeholder:'https://my.server.com/dav/', type:'url' },
      { key:'username', label:'\u041B\u043E\u0433\u0438\u043D',        placeholder:'user', type:'text' },
      { key:'password', label:'\u041F\u0430\u0440\u043E\u043B\u044C',        placeholder:'pass', type:'password' },
    ]
  },
  custom:   { label: '\uD83D\uDD17 \u0421\u0432\u043E\u0439 API \u0441\u0435\u0440\u0432\u0435\u0440',       icon: '\uD83D\uDD17', color: '#ff8a65',
    fields: [
      { key:'url',    label:'API URL',   placeholder:'https://my.api.com/passwords', type:'url' },
      { key:'apiKey', label:'API Key',   placeholder:'Bearer xxx', type:'password' },
    ]
  },
};

// ----------------------------------------------------------------
// LOCAL ADAPTER — chrome.storage.local
// ----------------------------------------------------------------
const LocalAdapter = {
  async load(masterPwd) {
    return new Promise(res => {
      chrome.storage.local.get('enc_data', async r => {
        if (!r.enc_data) return res(null);
        try { res(await CryptoHelper.decrypt(r.enc_data, masterPwd)); }
        catch(e) { throw e; }
      });
    });
  },
  async save(data, masterPwd) {
    const enc = await CryptoHelper.encrypt(data, masterPwd);
    return new Promise(res => chrome.storage.local.set({ enc_data: enc }, res));
  },
  async test() { return true; }
};

// ----------------------------------------------------------------
// FILE ADAPTER — download/upload JSON file
// ----------------------------------------------------------------
const FileAdapter = {
  _pending: null,
  async load(masterPwd) {
    return new Promise((res, rej) => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.json,.data,.enc';
      inp.onchange = async e => {
        const file = e.target.files[0]; if (!file) return res(null);
        const text = await file.text();
        try { res(await CryptoHelper.decrypt(text.trim(), masterPwd)); }
        catch(er) { rej(er); }
      };
      inp.click();
    });
  },
  async save(data, masterPwd) {
    const enc  = await CryptoHelper.encrypt(data, masterPwd);
    const blob = new Blob([enc], { type: 'text/plain' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = 'passwords_' + new Date().toISOString().slice(0,10) + '.enc';
    a.click();
  },
  async test() { return true; }
};

// ----------------------------------------------------------------
// SUPABASE ADAPTER
// ----------------------------------------------------------------
const SupabaseAdapter = {
  _cfg: null, _token: null,

  init(cfg) { this._cfg = cfg; },

  async _authRequest(endpoint, body) {
    const r = await fetch(`${this._cfg.url}/auth/v1/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': this._cfg.anonKey },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  async _ensureAuth() {
    if (this._token) return;
    const d = await this._authRequest('token?grant_type=password', {
      email: this._cfg.email, password: this._cfg.password
    });
    this._token = d.access_token;
  },

  async load(masterPwd) {
    await this._ensureAuth();
    const r = await fetch(`${this._cfg.url}/rest/v1/vault?select=data&order=id.desc&limit=1`, {
      headers: { 'apikey': this._cfg.anonKey, 'Authorization': `Bearer ${this._token}` }
    });
    const rows = await r.json();
    if (!rows.length || !rows[0].data) return null;
    return CryptoHelper.decrypt(rows[0].data, masterPwd);
  },

  async save(data, masterPwd) {
    await this._ensureAuth();
    const enc = await CryptoHelper.encrypt(data, masterPwd);
    // Upsert single row (id=1)
    await fetch(`${this._cfg.url}/rest/v1/vault`, {
      method: 'POST',
      headers: {
        'apikey': this._cfg.anonKey, 'Authorization': `Bearer ${this._token}`,
        'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ id: 1, data: enc, updated_at: new Date().toISOString() })
    });
  },

  async test() {
    try { await this._ensureAuth(); return true; } catch(e) { return false; }
  }
};

// ----------------------------------------------------------------
// YANDEX DISK ADAPTER (WebDAV)
// ----------------------------------------------------------------
const YandexAdapter = {
  _token: null,
  _file: 'disk:/Apps/PasswordManager/vault.enc',

  init(cfg) { this._token = cfg.token; },

  _headers() {
    return { 'Authorization': `OAuth ${this._token}` };
  },

  async load(masterPwd) {
    // Get download URL
    const r = await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(this._file)}`,
      { headers: this._headers() }
    );
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('Yandex Disk error: ' + r.status);
    const { href } = await r.json();
    const dr = await fetch(href);
    const text = await dr.text();
    return CryptoHelper.decrypt(text.trim(), masterPwd);
  },

  async save(data, masterPwd) {
    const enc = await CryptoHelper.encrypt(data, masterPwd);
    // Get upload URL
    const r = await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources/upload?path=${encodeURIComponent(this._file)}&overwrite=true`,
      { headers: this._headers() }
    );
    const { href } = await r.json();
    await fetch(href, { method: 'PUT', body: enc });
  },

  async test() {
    try {
      const r = await fetch('https://cloud-api.yandex.net/v1/disk/', { headers: this._headers() });
      return r.ok;
    } catch(e) { return false; }
  }
};

// ----------------------------------------------------------------
// GOOGLE DRIVE ADAPTER (chrome.identity)
// ----------------------------------------------------------------
const GDriveAdapter = {
  _clientId: null, _token: null,
  _fileName: 'password_vault.enc',
  _fileId: null,

  init(cfg) { this._clientId = cfg.clientId; },

  async _getToken() {
    return new Promise((res, rej) => {
      chrome.identity.getAuthToken({ interactive: true }, token => {
        if (chrome.runtime.lastError) rej(chrome.runtime.lastError);
        else { this._token = token; res(token); }
      });
    });
  },

  _h() { return { 'Authorization': `Bearer ${this._token}` }; },

  async _findFile() {
    const r = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name%3D'${this._fileName}'%20and%20trashed%3Dfalse&fields=files(id)`,
      { headers: this._h() }
    );
    const d = await r.json();
    return d.files && d.files.length ? d.files[0].id : null;
  },

  async load(masterPwd) {
    await this._getToken();
    const id = await this._findFile();
    if (!id) return null;
    this._fileId = id;
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, { headers: this._h() });
    const text = await r.text();
    return CryptoHelper.decrypt(text.trim(), masterPwd);
  },

  async save(data, masterPwd) {
    await this._getToken();
    const enc = await CryptoHelper.encrypt(data, masterPwd);
    const blob = new Blob([enc], { type: 'text/plain' });
    if (!this._fileId) this._fileId = await this._findFile();
    if (this._fileId) {
      // Update existing
      const form = new FormData();
      form.append('file', blob);
      await fetch(`https://www.googleapis.com/upload/drive/v3/files/${this._fileId}?uploadType=multipart`, {
        method: 'PATCH', headers: this._h(), body: form
      });
    } else {
      // Create new
      const meta = JSON.stringify({ name: this._fileName });
      const form = new FormData();
      form.append('metadata', new Blob([meta], { type: 'application/json' }));
      form.append('file', blob);
      const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST', headers: this._h(), body: form
      });
      const d = await r.json();
      this._fileId = d.id;
    }
  },

  async test() {
    try { await this._getToken(); return !!this._token; } catch(e) { return false; }
  }
};

// ----------------------------------------------------------------
// DROPBOX ADAPTER
// ----------------------------------------------------------------
const DropboxAdapter = {
  _token: null,
  _path: '/password_vault.enc',

  init(cfg) { this._token = cfg.token; },
  _h() { return { 'Authorization': `Bearer ${this._token}` }; },

  async load(masterPwd) {
    const r = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: { ...this._h(), 'Dropbox-API-Arg': JSON.stringify({ path: this._path }) }
    });
    if (r.status === 409) return null;
    const text = await r.text();
    return CryptoHelper.decrypt(text.trim(), masterPwd);
  },

  async save(data, masterPwd) {
    const enc = await CryptoHelper.encrypt(data, masterPwd);
    await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        ...this._h(),
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({ path: this._path, mode: 'overwrite' })
      },
      body: enc
    });
  },

  async test() {
    try {
      const r = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
        method: 'POST', headers: this._h()
      });
      return r.ok;
    } catch(e) { return false; }
  }
};

// ----------------------------------------------------------------
// WEBDAV ADAPTER
// ----------------------------------------------------------------
const WebDAVAdapter = {
  _url: null, _user: null, _pass: null,
  _file: 'password_vault.enc',

  init(cfg) {
    this._url  = cfg.url.endsWith('/') ? cfg.url : cfg.url + '/';
    this._user = cfg.username;
    this._pass = cfg.password;
  },

  _h() {
    const creds = btoa(`${this._user}:${this._pass}`);
    return { 'Authorization': `Basic ${creds}` };
  },

  async load(masterPwd) {
    const r = await fetch(this._url + this._file, { headers: this._h() });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('WebDAV error: ' + r.status);
    const text = await r.text();
    return CryptoHelper.decrypt(text.trim(), masterPwd);
  },

  async save(data, masterPwd) {
    const enc = await CryptoHelper.encrypt(data, masterPwd);
    await fetch(this._url + this._file, {
      method: 'PUT',
      headers: { ...this._h(), 'Content-Type': 'text/plain' },
      body: enc
    });
  },

  async test() {
    try {
      const r = await fetch(this._url, { method: 'PROPFIND', headers: this._h() });
      return r.ok || r.status === 207;
    } catch(e) { return false; }
  }
};

// ----------------------------------------------------------------
// CUSTOM API ADAPTER
// ----------------------------------------------------------------
const CustomAdapter = {
  _url: null, _key: null,

  init(cfg) {
    this._url = cfg.url.endsWith('/') ? cfg.url : cfg.url + '/';
    this._key = cfg.apiKey;
  },

  _h() { return { 'Authorization': this._key, 'Content-Type': 'application/json' }; },

  async load(masterPwd) {
    const r = await fetch(this._url + 'load', { headers: this._h() });
    if (r.status === 404) return null;
    const { data } = await r.json();
    if (!data) return null;
    return CryptoHelper.decrypt(data, masterPwd);
  },

  async save(data, masterPwd) {
    const enc = await CryptoHelper.encrypt(data, masterPwd);
    await fetch(this._url + 'save', {
      method: 'POST', headers: this._h(),
      body: JSON.stringify({ data: enc })
    });
  },

  async test() {
    try { const r = await fetch(this._url + 'ping', { headers: this._h() }); return r.ok; }
    catch(e) { return false; }
  }
};

// ----------------------------------------------------------------
// STORAGE MANAGER — picks the right adapter
// ----------------------------------------------------------------
const StorageManager = {
  _type: null,
  _adapter: null,

  async init(type, config) {
    this._type = type;
    switch(type) {
      case 'local':    this._adapter = LocalAdapter; break;
      case 'file':     this._adapter = FileAdapter;  break;
      case 'supabase': SupabaseAdapter.init(config);  this._adapter = SupabaseAdapter; break;
      case 'yandex':   YandexAdapter.init(config);    this._adapter = YandexAdapter;   break;
      case 'gdrive':   GDriveAdapter.init(config);    this._adapter = GDriveAdapter;   break;
      case 'dropbox':  DropboxAdapter.init(config);   this._adapter = DropboxAdapter;  break;
      case 'webdav':   WebDAVAdapter.init(config);    this._adapter = WebDAVAdapter;   break;
      case 'custom':   CustomAdapter.init(config);    this._adapter = CustomAdapter;   break;
    }
  },

  async load(masterPwd) { return this._adapter.load(masterPwd); },
  async save(data, masterPwd) { return this._adapter.save(data, masterPwd); },
  async test() { return this._adapter ? this._adapter.test() : false; }
};
