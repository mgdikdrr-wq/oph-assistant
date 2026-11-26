/* At-rest encryption primitives (Web Crypto AES-GCM). The device key is
   generated once and stored non-extractable in IndexedDB. Backups carry
   plaintext inside their own passcode-encrypted envelope, so a restore works
   even after the app's data (and key) were wiped. */
window.OPH_CRYPTO = (function () {
  function b64(buf) { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); }
  function unb64(s) { const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function genKey() {
    return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function encryptJSON(key, obj) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
    return { iv: b64(iv), ct: b64(ct) };
  }
  async function decryptJSON(key, row) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(row.iv) }, key, unb64(row.ct));
    return JSON.parse(new TextDecoder().decode(pt));
  }
  return { genKey, encryptJSON, decryptJSON };
})();
