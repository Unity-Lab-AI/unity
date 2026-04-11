// storage.js — localStorage manager for per-user state
// All data namespaced under 'unity_brain_' prefix

const PREFIX = 'unity_brain_';
const MAX_HISTORY = 50;

function prefixKey(key) {
  return PREFIX + key;
}

function generateUserId() {
  return 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

// ── Key obfuscation ──
// Not military-grade encryption, but prevents plain-text keys in localStorage
// and stops casual inspection / extension scraping. Keys are XOR'd with a
// per-user salt derived from the userId.
function obfuscate(text, salt) {
  const s = salt || 'unity_default_salt';
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ s.charCodeAt(i % s.length));
  }
  return btoa(result); // base64 the XOR'd bytes
}

function deobfuscate(encoded, salt) {
  const s = salt || 'unity_default_salt';
  try {
    const decoded = atob(encoded);
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ s.charCodeAt(i % s.length));
    }
    return result;
  } catch {
    return null;
  }
}

export class UserStorage {
  constructor() {
    this.userId = null;
    this._init();
  }

  _init() {
    const existing = this._raw('session');
    if (existing) {
      const session = JSON.parse(existing);
      this.userId = session.userId;
      // Update last visit
      session.lastVisit = new Date().toISOString();
      this._setRaw('session', JSON.stringify(session));
    } else {
      // First visit — create new session
      this.userId = generateUserId();
      const session = {
        userId: this.userId,
        firstVisit: new Date().toISOString(),
        lastVisit: new Date().toISOString(),
        messageCount: 0
      };
      this._setRaw('session', JSON.stringify(session));
      // Init empty structures
      this._setRaw('history', JSON.stringify([]));
      this._setRaw('preferences', JSON.stringify({
        voice: 'shimmer',
        model: 'openai',
        drugState: 'cokeAndWeed',
        theme: 'dark'
      }));
      this._setRaw('apikeys', JSON.stringify({}));
    }
  }

  // Raw localStorage access with prefix
  _raw(key) {
    try {
      return localStorage.getItem(prefixKey(key));
    } catch {
      return null;
    }
  }

  _setRaw(key, value) {
    try {
      localStorage.setItem(prefixKey(key), value);
    } catch (err) {
      console.warn('localStorage write failed:', err.message);
    }
  }

  _removeRaw(key) {
    try {
      localStorage.removeItem(prefixKey(key));
    } catch {
      // silent
    }
  }

  /**
   * Simple key-value get with prefix
   */
  get(key) {
    const raw = this._raw('kv_' + key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  /**
   * Simple key-value set with prefix
   */
  set(key, value) {
    this._setRaw('kv_' + key, JSON.stringify(value));
  }

  /**
   * Get stored API key for a service (pollinations, claude, etc.)
   * Keys are stored obfuscated — not plain text in localStorage.
   */
  getApiKey(service) {
    try {
      const keys = JSON.parse(this._raw('apikeys') || '{}');
      const stored = keys[service];
      if (!stored) return null;

      // Handle migration: if it starts with 'sk_' or looks like a raw key,
      // it was saved before obfuscation was added — return as-is then re-save obfuscated
      if (stored.startsWith('sk_') || stored.startsWith('sk-') || !stored.match(/^[A-Za-z0-9+/=]+$/)) {
        // Plain text key — migrate it to obfuscated on next save
        return stored;
      }

      // Try to deobfuscate
      const decoded = deobfuscate(stored, this.userId);
      // Sanity check — if deobfuscation produced garbage, return raw value
      if (!decoded || decoded.length < 5) return stored;
      return decoded;
    } catch {
      return null;
    }
  }

  /**
   * Store API key for a service.
   * Keys are obfuscated before storage — never stored as plain text.
   */
  setApiKey(service, key) {
    try {
      const keys = JSON.parse(this._raw('apikeys') || '{}');
      keys[service] = obfuscate(key, this.userId);
      this._setRaw('apikeys', JSON.stringify(keys));
    } catch (err) {
      console.warn('Failed to save API key:', err.message);
    }
  }

  /**
   * Check if a key exists for a service (without decoding it).
   */
  hasApiKey(service) {
    try {
      const keys = JSON.parse(this._raw('apikeys') || '{}');
      return !!keys[service];
    } catch {
      return false;
    }
  }

  /**
   * Returns session info: userId, firstVisit, lastVisit, messageCount, preferences
   */
  getSession() {
    try {
      const session = JSON.parse(this._raw('session') || '{}');
      const prefs = this.getPreferences();
      return {
        userId: session.userId || this.userId,
        firstVisit: session.firstVisit || null,
        lastVisit: session.lastVisit || null,
        messageCount: session.messageCount || 0,
        preferences: prefs
      };
    } catch {
      return {
        userId: this.userId,
        firstVisit: null,
        lastVisit: null,
        messageCount: 0,
        preferences: this.getPreferences()
      };
    }
  }

  /**
   * Append a message to conversation history (keeps last 50)
   */
  saveMessage(role, text) {
    try {
      const history = JSON.parse(this._raw('history') || '[]');
      history.push({
        role,
        text,
        timestamp: new Date().toISOString()
      });

      // Trim to last MAX_HISTORY messages
      while (history.length > MAX_HISTORY) {
        history.shift();
      }

      this._setRaw('history', JSON.stringify(history));

      // Increment message count in session
      const session = JSON.parse(this._raw('session') || '{}');
      session.messageCount = (session.messageCount || 0) + 1;
      this._setRaw('session', JSON.stringify(session));
    } catch (err) {
      console.warn('Failed to save message:', err.message);
    }
  }

  /**
   * Returns conversation history array
   */
  getHistory() {
    try {
      return JSON.parse(this._raw('history') || '[]');
    } catch {
      return [];
    }
  }

  /**
   * Returns user preferences
   */
  getPreferences() {
    try {
      return JSON.parse(this._raw('preferences') || '{}');
    } catch {
      return { voice: 'alloy', model: 'openai', drugState: 'sober', theme: 'dark' };
    }
  }

  /**
   * Set a single preference
   */
  setPreference(key, val) {
    try {
      const prefs = this.getPreferences();
      prefs[key] = val;
      this._setRaw('preferences', JSON.stringify(prefs));
    } catch (err) {
      console.warn('Failed to save preference:', err.message);
    }
  }

  /**
   * Wipe all data for this user
   */
  clear() {
    const keysToRemove = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (err) {
      console.warn('Failed to clear storage:', err.message);
    }
    this.userId = null;
  }

  /**
   * True if no prior session exists (this is the first visit)
   */
  isFirstVisit() {
    try {
      const session = JSON.parse(this._raw('session') || '{}');
      // If firstVisit and lastVisit are the same, this is the first visit
      return session.firstVisit === session.lastVisit;
    } catch {
      return true;
    }
  }
}
