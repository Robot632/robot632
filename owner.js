// -----------------------------------------------------------
// Owner-only debug panel loader.
//
// The panel itself is NOT in this repo in readable form: it lives
// in debug.enc.json, encrypted with AES-GCM under a key derived
// from a password (PBKDF2-SHA256). Without the password that file
// is just noise, and the password is not stored anywhere here.
//
// The terminal's `debug` command asks for the password once; if it
// decrypts the file, the derived key (not the password) is kept in
// this browser's localStorage, and from then on the home page loads
// the panel on that device only. `debug off` forgets the key.
// -----------------------------------------------------------
window.R632Owner = (function(){
  const KEY_STORE = 'robot632_debug_key';
  const FILE = 'debug.enc.json';

  const toB64 = (bytes) => btoa(String.fromCharCode(...bytes));
  const fromB64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

  function supported(){
    return !!(window.crypto && crypto.subtle && window.fetch);
  }

  async function fetchBlob(){
    const res = await fetch(FILE, { cache: 'no-store' });
    if (!res.ok) throw new Error('panel file missing');
    return res.json();
  }

  async function deriveRaw(password, blob){
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: fromB64(blob.salt), iterations: blob.iter, hash: 'SHA-256' }, base, 256);
    return new Uint8Array(bits);
  }

  // throws if the key is wrong (AES-GCM checks integrity)
  async function decrypt(raw, blob){
    const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(blob.iv) }, key, fromB64(blob.data));
    return new TextDecoder().decode(plain);
  }

  function storedKey(){
    try { return localStorage.getItem(KEY_STORE); } catch (e){ return null; }
  }

  return {
    unlocked: () => !!storedKey(),

    // true if the password opens the panel (and remembers this device)
    async unlock(password){
      if (!supported()) return false;
      const blob = await fetchBlob();
      const raw = await deriveRaw(password, blob);
      try { await decrypt(raw, blob); } catch (e){ return false; }
      try { localStorage.setItem(KEY_STORE, toB64(raw)); } catch (e){ return false; }
      return true;
    },

    lock(){
      try { localStorage.removeItem(KEY_STORE); } catch (e){}
    },

    // decrypts and runs the panel on this page, if this device is unlocked
    async run(){
      const k = storedKey();
      if (!k || !supported()) return;
      try {
        const blob = await fetchBlob();
        const code = await decrypt(fromB64(k), blob);
        const s = document.createElement('script');
        s.textContent = code;
        document.body.appendChild(s);
      } catch (e){
        // the panel was re-encrypted with a new password: forget the old key
        this.lock();
      }
    }
  };
})();
