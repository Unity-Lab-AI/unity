/**
 * chat-panel.js — Full conversation log panel
 *
 * Opens when the Unity avatar is clicked. Shows complete message
 * history with text input at the bottom. Mic toggle inside panel.
 */

export class ChatPanel {
  constructor({ storage, onSend, onMicToggle }) {
    this._storage = storage;
    this._onSend = onSend;
    this._onMicToggle = onMicToggle;
    this._open = false;
    this._el = null;
    this._messagesEl = null;
    this._inputEl = null;
    this._build();
  }

  _build() {
    this._el = document.createElement('div');
    this._el.id = 'chat-panel';
    this._el.className = 'chat-panel hidden';
    this._el.innerHTML = `
      <div class="chat-header">
        <span class="chat-title">Unity</span>
        <div class="chat-header-btns">
          <button class="chat-close-btn" title="Close">&times;</button>
        </div>
      </div>
      <div class="chat-messages" id="chat-messages"></div>
      <div class="chat-input-wrap">
        <input type="text" class="chat-input" id="chat-input" placeholder="Talk to Unity..." autocomplete="off" spellcheck="false">
        <button class="chat-send-btn" title="Send">→</button>
      </div>
    `;
    document.body.appendChild(this._el);

    this._messagesEl = this._el.querySelector('#chat-messages');
    this._inputEl = this._el.querySelector('#chat-input');
    const sendBtn = this._el.querySelector('.chat-send-btn');
    const closeBtn = this._el.querySelector('.chat-close-btn');

    // Send on Enter or button click
    this._inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this._inputEl.value.trim()) {
        this._send();
      }
      if (e.key === 'Escape') this.close();
    });
    sendBtn.addEventListener('click', () => this._send());
    closeBtn.addEventListener('click', () => this.close());
  }

  _send() {
    const text = this._inputEl.value.trim();
    if (!text) return;
    this._inputEl.value = '';
    this._inputEl.placeholder = 'Unity is thinking...';

    // Add user message to UI immediately
    this._appendMessage('user', text);

    // Call the handler. The brain's 'response' event is what actually
    // renders the assistant message into the chat (wired in app.js via
    // brain.on('response', ...) → chatPanel.addMessage). We MUST NOT
    // also append it here — doing so produced two identical messages
    // in the chat for every user input (double-display bug).
    if (this._onSend) {
      this._onSend(text).then(() => {
        this._inputEl.placeholder = 'Talk to Unity...';
      }).catch(() => {
        this._inputEl.placeholder = 'Talk to Unity...';
      });
    }
  }

  _appendMessage(role, text) {
    const msg = document.createElement('div');
    msg.className = `chat-msg chat-msg-${role}`;

    const label = document.createElement('span');
    label.className = 'chat-msg-label';
    label.textContent = role === 'user' ? 'You' : 'Unity';

    const body = document.createElement('span');
    body.className = 'chat-msg-text';
    // Render HTML for images, escape text for everything else
    if (text.includes('<img ') || text.includes('<a ')) {
      body.innerHTML = text;
    } else {
      body.textContent = text;
    }

    msg.appendChild(label);
    msg.appendChild(body);
    this._messagesEl.appendChild(msg);
    this._messagesEl.scrollTop = this._messagesEl.scrollHeight;
  }

  _loadHistory() {
    this._messagesEl.innerHTML = '';
    const history = this._storage.getHistory();
    for (const entry of history) {
      this._appendMessage(entry.role, entry.text);
    }
  }

  toggle() {
    if (this._open) this.close();
    else this.open();
  }

  open() {
    this._open = true;
    this._loadHistory();
    this._el.classList.remove('hidden');
    setTimeout(() => this._inputEl.focus(), 100);
  }

  close() {
    this._open = false;
    this._el.classList.add('hidden');
  }

  isOpen() {
    return this._open;
  }

  /** Add a message from outside (e.g., voice result) */
  addMessage(role, text, skipSave = false) {
    // Save to storage so history persists across open/close
    // skipSave=true when the router already saved it
    if (!skipSave) {
      this._storage.saveMessage(role, text);
    }
    if (this._open) {
      this._appendMessage(role, text);
    }
  }
}
