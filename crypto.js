// AES-256-GCM encryption with PBKDF2 key derivation
const CryptoHelper = {
  async deriveKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false, ['encrypt', 'decrypt']
    );
  },

  async encrypt(data, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv   = crypto.getRandomValues(new Uint8Array(12));
    const key  = await this.deriveKey(password, salt);
    const enc  = new TextEncoder();
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(data))
    );
    const buf = new Uint8Array(16 + 12 + encrypted.byteLength);
    buf.set(salt, 0); buf.set(iv, 16);
    buf.set(new Uint8Array(encrypted), 28);
    return btoa(String.fromCharCode(...buf));
  },

  async decrypt(encStr, password) {
    try {
      const buf  = new Uint8Array(atob(encStr).split('').map(c => c.charCodeAt(0)));
      const salt = buf.slice(0, 16);
      const iv   = buf.slice(16, 28);
      const data = buf.slice(28);
      const key  = await this.deriveKey(password, salt);
      const dec  = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
      return JSON.parse(new TextDecoder().decode(dec));
    } catch(e) { throw new Error('WRONG_PASSWORD'); }
  },

  // Hash password for quick verification (not for encryption)
  async hashPassword(password) {
    const enc  = new TextEncoder();
    const buf  = await crypto.subtle.digest('SHA-256', enc.encode(password + 'pwdmgr_salt_v1'));
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
  }
};
