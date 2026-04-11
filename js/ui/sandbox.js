/**
 * sandbox.js — Dynamic UI injection system
 *
 * Unity's page starts nearly empty. When she decides to build UI
 * (text inputs, code editors, visualizers, toggles, etc.) she
 * generates an HTML/CSS/JS spec and this module injects it live.
 *
 * Every component is isolated: scoped CSS, wrapped in its own div,
 * JS evaluated inside a try/catch so one bad component can't nuke
 * the rest.
 */

export class Sandbox {
  /** @param {string} containerId — DOM id of the sandbox container */
  constructor(containerId) {
    this._container = document.getElementById(containerId);
    if (!this._container) {
      throw new Error(`[Sandbox] Container element "#${containerId}" not found in DOM`);
    }

    /** Map<string, { wrapper: HTMLElement, styleEl: HTMLElement|null }> */
    this._components = new Map();

    /** Global style elements added via injectCSS */
    this._globalStyles = [];

    /** Captured errors from injected JS */
    this._errors = [];

    /** Saved component specs for persistence across visits */
    this._specs = new Map();

    /** Unity API object — wired up externally via setUnityAPI */
    this._unityAPI = {
      sandbox: this,
      speak: () => console.warn('[Sandbox] unity.speak not wired yet'),
      listen: () => console.warn('[Sandbox] unity.listen not wired yet'),
      chat: () => console.warn('[Sandbox] unity.chat not wired yet'),
      generateImage: () => console.warn('[Sandbox] unity.generateImage not wired yet'),
      getState: () => console.warn('[Sandbox] unity.getState not wired yet'),
      storage: () => console.warn('[Sandbox] unity.storage not wired yet'),
      on: () => console.warn('[Sandbox] unity.on not wired yet'),
    };
  }

  // ── Core injection ──────────────────────────────────────────

  /**
   * Inject a dynamic component into the sandbox.
   *
   * @param {object} spec
   * @param {string} [spec.html]     — HTML markup
   * @param {string} [spec.css]      — CSS rules (auto-scoped to component)
   * @param {string} [spec.js]       — JavaScript to evaluate in sandbox context
   * @param {string}  spec.id        — Unique component identifier
   * @param {string} [spec.position] — 'append' (default) | 'prepend' | 'replace'
   * @returns {HTMLElement} The component wrapper div
   */
  inject(spec) {
    const { html = '', css = '', js = '', id, position = 'append' } = spec;

    if (!id) {
      throw new Error('[Sandbox] inject() requires a spec.id');
    }

    // If replacing, remove old version first
    if (position === 'replace' && this._components.has(id)) {
      this.remove(id);
    }

    // If the component already exists (and not replacing), bail
    if (this._components.has(id)) {
      console.warn(`[Sandbox] Component "${id}" already exists. Remove it first or use position:"replace".`);
      return this._components.get(id).wrapper;
    }

    // -- Wrapper div --
    const wrapper = document.createElement('div');
    wrapper.id = `sandbox-${id}`;
    wrapper.classList.add('sandbox-component');
    wrapper.dataset.componentId = id;

    // -- Scoped CSS --
    let styleEl = null;
    if (css) {
      styleEl = this._injectScopedCSS(css, id);
    }

    // -- HTML --
    if (html) {
      wrapper.innerHTML = html;
    }

    // -- Insert into container --
    if (position === 'prepend' && this._container.firstChild) {
      this._container.insertBefore(wrapper, this._container.firstChild);
    } else {
      this._container.appendChild(wrapper);
    }

    // -- Track --
    this._components.set(id, { wrapper, styleEl });
    this._specs.set(id, { html, css, js, id, position });

    // -- JS (evaluated with sandbox context) --
    if (js) {
      this._evaluateJS(js, wrapper, id);
    }

    // -- Auto-persist to localStorage --
    this.saveState();

    return wrapper;
  }

  // ── Component management ────────────────────────────────────

  /** Remove a component by id */
  remove(id) {
    const entry = this._components.get(id);
    if (!entry) return false;

    entry.wrapper.remove();
    if (entry.styleEl) entry.styleEl.remove();
    this._components.delete(id);
    this._specs.delete(id);
    this.saveState();
    return true;
  }

  /** Remove all components from the sandbox */
  clear() {
    for (const [id] of this._components) {
      this.remove(id);
    }
    // Also nuke any global styles
    this._globalStyles.forEach((el) => el.remove());
    this._globalStyles = [];
  }

  /** Check if a component exists */
  has(id) {
    return this._components.has(id);
  }

  /** Get a component's wrapper element */
  getComponent(id) {
    const entry = this._components.get(id);
    return entry ? entry.wrapper : null;
  }

  /** List all component ids currently in the sandbox */
  listComponents() {
    return Array.from(this._components.keys());
  }

  // ── Global injection helpers ────────────────────────────────

  /** Inject global (non-scoped) CSS into the page */
  injectCSS(css) {
    const style = document.createElement('style');
    style.textContent = css;
    style.dataset.sandboxGlobal = 'true';
    document.head.appendChild(style);
    this._globalStyles.push(style);
    return style;
  }

  /** Run arbitrary JS with sandbox context (no specific component) */
  injectScript(js) {
    this._evaluateJS(js, this._container, '__global__');
  }

  /** querySelector scoped to the sandbox container */
  getElement(selector) {
    return this._container.querySelector(selector);
  }

  // ── Unity API ───────────────────────────────────────────────

  /**
   * Wire up the unity API object that injected scripts receive.
   * Called by app.js once the real callbacks are ready.
   *
   * @param {object} apiObject — partial or full override
   */
  setUnityAPI(apiObject) {
    this._unityAPI = {
      ...this._unityAPI,
      sandbox: this, // always keep sandbox ref
      ...apiObject,
    };
  }

  // ── Error tracking ─────────────────────────────────────────

  /** Get captured errors from injected JS */
  getErrors() {
    return [...this._errors];
  }

  // ── Internal helpers ────────────────────────────────────────

  /**
   * Prefix every CSS rule with the component's scoped selector
   * so styles don't leak across components.
   */
  _injectScopedCSS(css, id) {
    const scopePrefix = `#sandbox-${id}`;
    const scoped = this._scopeCSS(css, scopePrefix);

    const style = document.createElement('style');
    style.dataset.componentId = id;
    style.textContent = scoped;
    document.head.appendChild(style);
    return style;
  }

  /**
   * Naively scope CSS by prepending a selector to each rule.
   * Handles basic cases: selectors, @keyframes pass-through,
   * @media wrapping.
   */
  _scopeCSS(css, prefix) {
    // Strip comments
    let cleaned = css.replace(/\/\*[\s\S]*?\*\//g, '');

    const result = [];
    // Split on } that isn't inside a nested block
    // Simple approach: process line-by-line for top-level rules
    const blocks = this._parseTopLevelBlocks(cleaned);

    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;

      // Pass through @keyframes / @font-face as-is
      if (/^@(keyframes|font-face)\b/.test(trimmed)) {
        result.push(trimmed);
        continue;
      }

      // @media — scope the inner rules
      if (/^@media\b/.test(trimmed)) {
        const innerStart = trimmed.indexOf('{');
        const mediaQuery = trimmed.slice(0, innerStart + 1);
        const innerEnd = trimmed.lastIndexOf('}');
        const innerCSS = trimmed.slice(innerStart + 1, innerEnd);
        const scopedInner = this._scopeCSS(innerCSS, prefix);
        result.push(`${mediaQuery}\n${scopedInner}\n}`);
        continue;
      }

      // Regular rule — prepend prefix to selector
      const braceIdx = trimmed.indexOf('{');
      if (braceIdx === -1) continue;

      const selector = trimmed.slice(0, braceIdx).trim();
      const body = trimmed.slice(braceIdx);

      // Handle comma-separated selectors
      const scopedSelectors = selector
        .split(',')
        .map((s) => {
          s = s.trim();
          if (!s) return '';
          // :root or html or body — just replace with prefix
          if (s === ':root' || s === 'html' || s === 'body') {
            return prefix;
          }
          return `${prefix} ${s}`;
        })
        .filter(Boolean)
        .join(', ');

      result.push(`${scopedSelectors} ${body}`);
    }

    return result.join('\n');
  }

  /**
   * Parse top-level CSS blocks, respecting nested braces.
   * Returns an array of complete rule strings.
   */
  _parseTopLevelBlocks(css) {
    const blocks = [];
    let depth = 0;
    let current = '';

    for (let i = 0; i < css.length; i++) {
      const ch = css[i];
      if (ch === '{') depth++;
      if (ch === '}') {
        depth--;
        if (depth === 0) {
          current += ch;
          blocks.push(current.trim());
          current = '';
          continue;
        }
      }
      current += ch;
    }

    // Leftover (shouldn't happen with valid CSS)
    if (current.trim()) blocks.push(current.trim());

    return blocks;
  }

  // ── Persistence ─────────────────────────────────────────────

  /**
   * Save all current component specs to localStorage.
   * Call this after inject() or remove() to persist the sandbox state.
   */
  saveState() {
    try {
      const specs = [];
      for (const [id, spec] of this._specs) {
        specs.push(spec);
      }
      localStorage.setItem('unity_brain_sandbox', JSON.stringify(specs));
    } catch (err) {
      console.warn('[Sandbox] Failed to save state:', err.message);
    }
  }

  /**
   * Restore previously saved component specs from localStorage.
   * Re-injects all components that existed on the last visit.
   */
  restoreState() {
    try {
      const raw = localStorage.getItem('unity_brain_sandbox');
      if (!raw) return 0;
      const specs = JSON.parse(raw);
      let restored = 0;
      for (const spec of specs) {
        if (spec && spec.id && !this._components.has(spec.id)) {
          this.inject(spec);
          restored++;
        }
      }
      return restored;
    } catch (err) {
      console.warn('[Sandbox] Failed to restore state:', err.message);
      return 0;
    }
  }

  /**
   * Clear saved state from localStorage.
   */
  clearSavedState() {
    try {
      localStorage.removeItem('unity_brain_sandbox');
    } catch {
      // silent
    }
  }

  /**
   * Evaluate JS in a sandboxed context.
   * The script receives: el (wrapper), sandbox, unity.
   */
  _evaluateJS(js, wrapperEl, componentId) {
    try {
      const fn = new Function('el', 'sandbox', 'unity', js);
      fn(wrapperEl, this, this._unityAPI);
    } catch (err) {
      const error = {
        componentId,
        message: err.message,
        stack: err.stack,
        timestamp: Date.now(),
      };
      this._errors.push(error);
      console.error(`[Sandbox] JS error in component "${componentId}":`, err);
    }
  }
}
