/**
 * sensory-status.js — R13 user-facing sensory backend notices
 *
 * Renders toast notifications + a small HUD corner for Unity's sensory
 * AI providers (image gen, vision describer, TTS). Subscribes to the
 * `unity-sensory-status` window event that ai-providers.js emits on
 * every state change: autodetect-complete, backend-dead, backend-failed,
 * paused, all-failed.
 *
 * Why this exists: pre-R13 the 4-level provider priority failed silently.
 * Users had no idea if their local A1111/Ollama was alive, if Pollinations
 * was rate-limited, or if vision had died. Now every transition surfaces
 * a visible toast with color coding and the HUD stays in sync.
 */

const TOAST_DURATION = 6000;
const MAX_TOASTS = 4;

export class SensoryStatusUI {
  constructor() {
    this._container = null;
    this._hud = null;
    this._toasts = [];
    this._providers = null;
    this._bootInventoryShown = { image: false, vision: false };
  }

  /**
   * Wire up the listener. Called once from app.js after providers is
   * constructed. The event payload comes from ai-providers.js
   * _emitStatus({kind, event, backend, reason, ...}).
   */
  init(providers) {
    this._providers = providers;
    this._createContainer();
    this._createHud();

    window.addEventListener('unity-sensory-status', (e) => {
      this._handleStatus(e.detail);
    });

    // Poll the HUD every 5s so dead-cooldown recovery shows up even
    // without an explicit event.
    setInterval(() => this._refreshHud(), 5000);
  }

  _createContainer() {
    let el = document.getElementById('sensory-toast-container');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sensory-toast-container';
      el.style.cssText = `
        position: fixed;
        bottom: 16px;
        right: 16px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: none;
        max-width: 360px;
      `;
      document.body.appendChild(el);
    }
    this._container = el;
  }

  _createHud() {
    let el = document.getElementById('sensory-hud');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sensory-hud';
      el.style.cssText = `
        position: fixed;
        top: 8px;
        right: 8px;
        z-index: 9998;
        font-family: monospace;
        font-size: 10px;
        color: #ccc;
        background: rgba(0,0,0,0.55);
        border: 1px solid #333;
        padding: 4px 8px;
        border-radius: 4px;
        pointer-events: auto;
        cursor: default;
        user-select: none;
      `;
      el.title = 'Click to see backend details';
      el.addEventListener('click', () => this._showInventoryToast());
      document.body.appendChild(el);
    }
    this._hud = el;
    this._refreshHud();
  }

  _refreshHud() {
    if (!this._hud || !this._providers?.getStatus) return;
    const status = this._providers.getStatus();
    const imgAlive = status.image.filter(b => b.state === 'alive').length;
    const imgTotal = status.image.length;
    const visAlive = status.vision.filter(b => b.state === 'alive').length;
    const visTotal = status.vision.length;
    const imgDot = imgAlive > 0 ? '🟢' : '🔴';
    const visDot = status.visionPaused ? '🟡' : (visAlive > 0 ? '🟢' : '🔴');
    this._hud.textContent = `${imgDot} img ${imgAlive}/${imgTotal}   ${visDot} vis ${visAlive}/${visTotal}`;
  }

  _handleStatus(payload) {
    if (!payload) return;
    const { kind, event } = payload;

    if (event === 'autodetect-complete') {
      const backends = payload.backends || [];
      const label = kind === 'image' ? 'Image gen' : 'Vision';
      if (!this._bootInventoryShown[kind]) {
        this._bootInventoryShown[kind] = true;
        if (backends.length === 0) {
          this._toast(`${label}: no local backends found. Using Pollinations fallback. Configure in js/env.js for local control.`, 'info');
        } else {
          const names = backends.map(b => b.name).join(', ');
          this._toast(`${label}: found ${backends.length} local backend(s) — ${names}`, 'success');
        }
      }
    } else if (event === 'backend-failed') {
      this._toast(`${payload.kind || 'Sensory'} backend failed: ${payload.backend} (${payload.reason || 'unknown'}) — falling through`, 'warn');
    } else if (event === 'backend-dead') {
      this._toast(`Backend marked dead (1h cooldown): ${payload.url}`, 'warn');
    } else if (event === 'paused') {
      this._toast(`Vision describer paused for ${Math.round((payload.duration || 30000) / 1000)}s after repeated failures — check backends`, 'error');
    } else if (event === 'all-failed') {
      if (kind === 'vision') {
        this._toast('Vision describer: all backends failed this attempt. Configure a local VLM (Ollama llava) or check Pollinations.', 'error');
      }
    }
    this._refreshHud();
  }

  _showInventoryToast() {
    if (!this._providers?.getStatus) return;
    const status = this._providers.getStatus();
    const img = status.image.map(b => `  ${b.state === 'alive' ? '🟢' : '🔴'} ${b.name} (${b.source})`).join('\n');
    const vis = status.vision.map(b => `  ${b.state === 'alive' ? '🟢' : '🔴'} ${b.name} (${b.source})`).join('\n');
    const text = `IMAGE GEN:\n${img}\n\nVISION:\n${vis}${status.visionPaused ? '\n\n⚠ vision paused' : ''}`;
    this._toast(text, 'info', 12000);
  }

  _toast(message, level = 'info', duration = TOAST_DURATION) {
    if (!this._container) return;
    const colors = {
      info:    { bg: 'rgba(20,40,60,0.92)',  border: '#4a90e2' },
      success: { bg: 'rgba(20,60,30,0.92)',  border: '#4caf50' },
      warn:    { bg: 'rgba(60,50,20,0.92)',  border: '#ff9800' },
      error:   { bg: 'rgba(60,20,30,0.92)',  border: '#e53935' },
    };
    const c = colors[level] || colors.info;

    const el = document.createElement('div');
    el.style.cssText = `
      background: ${c.bg};
      color: #eee;
      border-left: 3px solid ${c.border};
      padding: 8px 12px;
      font-family: monospace;
      font-size: 11px;
      white-space: pre-wrap;
      border-radius: 2px;
      pointer-events: auto;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
      max-width: 360px;
      overflow: hidden;
      text-overflow: ellipsis;
      opacity: 0;
      transform: translateX(20px);
      transition: opacity 0.3s, transform 0.3s;
    `;
    el.textContent = message;
    this._container.appendChild(el);
    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateX(0)';
    });

    this._toasts.push(el);
    if (this._toasts.length > MAX_TOASTS) {
      const old = this._toasts.shift();
      old.remove();
    }

    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(20px)';
      setTimeout(() => {
        el.remove();
        const i = this._toasts.indexOf(el);
        if (i >= 0) this._toasts.splice(i, 1);
      }, 300);
    }, duration);
  }
}

export const sensoryStatus = new SensoryStatusUI();
