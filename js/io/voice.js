/**
 * VoiceIO — Browser-based voice input/output for Unity.
 *
 * Listening:  Web Speech API (SpeechRecognition)
 * Speaking:   Pollinations TTS API with Web SpeechSynthesis fallback
 *
 * No external dependencies.
 */

class VoiceIO {
  constructor() {
    // --- state ---
    this._listening = false;
    this._speaking = false;
    this._recognition = null;
    this._shouldListen = false;
    this._audioCtx = null;
    this._currentAudioSource = null;
    this._currentUtterance = null;
    this._apiKey = null;
    this._pollinationsVoice = 'shimmer';

    // --- callbacks (simple) ---
    this._onResult = null;
    this._onError = null;

    // --- event emitter ---
    this._listeners = {};

    // --- init recognition if available ---
    this._initRecognition();
  }

  // =========================================================================
  //  EventEmitter mixin
  // =========================================================================

  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
    return this;
  }

  off(event, fn) {
    const list = this._listeners[event];
    if (!list) return this;
    if (!fn) {
      delete this._listeners[event];
    } else {
      this._listeners[event] = list.filter(f => f !== fn);
    }
    return this;
  }

  emit(event, ...args) {
    const list = this._listeners[event];
    if (list) list.forEach(fn => fn(...args));
  }

  // =========================================================================
  //  Listening — Web Speech API
  // =========================================================================

  _initRecognition() {
    const SR =
      typeof SpeechRecognition !== 'undefined'
        ? SpeechRecognition
        : typeof webkitSpeechRecognition !== 'undefined'
          ? webkitSpeechRecognition
          : null;

    if (!SR) {
      console.warn('VoiceIO: SpeechRecognition API not available in this browser.');
      return;
    }

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const payload = {
          text: result[0].transcript,
          isFinal: result.isFinal,
        };
        if (this._onResult) this._onResult(payload);
        if (result.isFinal) {
          this.emit('heard', payload.text);
        }
      }
    };

    rec.onerror = (e) => {
      // 'no-speech' and 'aborted' are routine — don't treat as fatal
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (this._onError) this._onError(e);
    };

    rec.onend = () => {
      this._listening = false;
      // Auto-restart if we're still supposed to be listening
      if (this._shouldListen) {
        try {
          rec.start();
          this._listening = true;
        } catch (_) {
          // guard against rapid start/stop race
        }
      }
    };

    this._recognition = rec;
  }

  get isListening() {
    return this._listening;
  }

  startListening() {
    if (!this._recognition) {
      console.warn('VoiceIO: Cannot start — SpeechRecognition not available.');
      return;
    }
    if (this._shouldListen) return; // already active
    this._shouldListen = true;
    try {
      this._recognition.start();
      this._listening = true;
    } catch (_) {
      // already started
    }
  }

  stopListening() {
    this._shouldListen = false;
    if (this._recognition) {
      try {
        this._recognition.stop();
      } catch (_) {
        // not started
      }
    }
    this._listening = false;
  }

  onResult(callback) {
    this._onResult = callback;
    return this;
  }

  onError(callback) {
    this._onError = callback;
    return this;
  }

  // =========================================================================
  //  Speaking — Pollinations TTS with Web Speech fallback
  // =========================================================================

  get isSpeaking() {
    return this._speaking;
  }

  setVoice(voiceName) {
    this._pollinationsVoice = voiceName;
    return this;
  }

  setApiKey(key) {
    this._apiKey = key;
    return this;
  }

  /**
   * Speak text. Tries Pollinations TTS first, falls back to browser SpeechSynthesis.
   * Returns a promise that resolves when speech finishes.
   */
  async speak(text, options = {}) {
    if (!text) return;
    this._speaking = true;
    this.emit('speech_start');

    const voice = options.voice || this._pollinationsVoice;

    try {
      await this._speakPollinations(text, voice);
      console.log(`[VoiceIO] Spoke via Pollinations (voice: ${voice})`);
    } catch (err) {
      console.warn(`[VoiceIO] Pollinations TTS failed: ${err.message} — falling back to browser`);
      // Pollinations failed — fall back to browser TTS
      try {
        await this._speakBrowser(text);
      } catch (fallbackErr) {
        console.warn('VoiceIO: All TTS methods failed.', fallbackErr);
      }
    }

    this._speaking = false;
    this.emit('speech_end');
  }

  stopSpeaking() {
    // Stop Pollinations audio
    if (this._currentAudioSource) {
      try {
        this._currentAudioSource.stop();
      } catch (_) {}
      this._currentAudioSource = null;
    }
    if (this._currentAudioElement) {
      this._currentAudioElement.pause();
      this._currentAudioElement = null;
    }

    // Stop browser TTS
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.cancel();
    }

    this._speaking = false;
    this.emit('speech_end');
  }

  // --- Pollinations TTS ---

  async _speakPollinations(text, voice) {
    const url = 'https://gen.pollinations.ai/v1/audio/speech';
    const headers = { 'Content-Type': 'application/json' };
    if (this._apiKey) {
      headers['Authorization'] = `Bearer ${this._apiKey}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'openai-audio',
        input: text,
        voice: voice || 'shimmer',
      }),
    });

    if (!response.ok) {
      throw new Error(`Pollinations TTS HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    // Try AudioContext first, fall back to HTML5 Audio
    try {
      await this._playWithAudioContext(arrayBuffer);
    } catch (_) {
      await this._playWithAudioElement(arrayBuffer);
    }
  }

  async _playWithAudioContext(arrayBuffer) {
    if (!this._audioCtx) {
      const AC = typeof AudioContext !== 'undefined'
        ? AudioContext
        : typeof webkitAudioContext !== 'undefined'
          ? webkitAudioContext
          : null;
      if (!AC) throw new Error('No AudioContext');
      this._audioCtx = new AC();
    }

    // Resume if suspended (autoplay policy)
    if (this._audioCtx.state === 'suspended') {
      await this._audioCtx.resume();
    }

    const audioBuffer = await this._audioCtx.decodeAudioData(arrayBuffer.slice(0));
    return new Promise((resolve, reject) => {
      const source = this._audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this._audioCtx.destination);
      this._currentAudioSource = source;
      source.onended = () => {
        this._currentAudioSource = null;
        resolve();
      };
      source.onerror = (e) => {
        this._currentAudioSource = null;
        reject(e);
      };
      source.start(0);
    });
  }

  async _playWithAudioElement(arrayBuffer) {
    const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    this._currentAudioElement = audio;

    return new Promise((resolve, reject) => {
      audio.onended = () => {
        URL.revokeObjectURL(url);
        this._currentAudioElement = null;
        resolve();
      };
      audio.onerror = (e) => {
        URL.revokeObjectURL(url);
        this._currentAudioElement = null;
        reject(e);
      };
      audio.play().catch(reject);
    });
  }

  // --- Browser SpeechSynthesis fallback ---

  async _speakBrowser(text) {
    if (typeof speechSynthesis === 'undefined') {
      throw new Error('SpeechSynthesis not available');
    }

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      this._currentUtterance = utterance;

      utterance.onend = () => {
        this._currentUtterance = null;
        resolve();
      };
      utterance.onerror = (e) => {
        this._currentUtterance = null;
        reject(e);
      };

      speechSynthesis.speak(utterance);
    });
  }
  /**
   * Kill everything — audio, listening, all of it.
   */
  destroy() {
    this.stopSpeaking();
    this.stopListening();
    if (this._audioCtx) {
      this._audioCtx.close().catch(() => {});
      this._audioCtx = null;
    }
  }
}

export { VoiceIO };
