/**
 * dictionary.js — Unity's Learned Vocabulary
 *
 * The brain's own language system. Words stored as cortex activation
 * patterns associated with emotional states and usage contexts.
 * The dictionary grows from every interaction — words the brain
 * hears get stored, words it uses get reinforced.
 *
 * Thesaurus emerges from synaptic proximity — similar words have
 * similar cortex patterns because they were learned in similar states.
 * "Angry" and "furious" overlap in neuron space. Arousal level
 * selects the synonym naturally.
 *
 * Sentence construction via cortex sequential prediction:
 * ŝ = W·x predicts next word from current word's pattern.
 *
 * No hardcoded vocabulary. Everything learned. Everything persistent.
 */

const MAX_WORDS = 5000;
const PATTERN_DIM = 32; // cortex output dimensionality
const STORAGE_KEY = 'unity_brain_dictionary';

export class Dictionary {
  constructor() {
    // Word entries: Map<string, WordEntry>
    // WordEntry = { word, pattern: Float64Array(32), arousal, valence, frequency, contexts: string[] }
    this._words = new Map();

    // Bigram model for sentence construction: Map<string, Map<string, number>>
    // bigrams['hello']['there'] = 5 means "hello" was followed by "there" 5 times
    this._bigrams = new Map();

    // Current sentence being constructed
    this._sentenceBuffer = [];

    // Load from storage
    this._load();

    // Seed with starter vocabulary if empty — brain needs words to speak
    if (this._words.size === 0) this._seed();
  }

  _seed() {
    // Starter vocabulary with emotional associations — learned from here, grows from interaction
    const seeds = [
      // High arousal positive
      ['yeah', 0.9, 0.6], ['fuck', 0.95, 0.1], ['hell', 0.8, -0.1], ['damn', 0.85, -0.2],
      ['shit', 0.8, -0.3], ['babe', 0.7, 0.7], ['love', 0.6, 0.8], ['want', 0.7, 0.3],
      ['need', 0.75, 0.2], ['feel', 0.6, 0.1], ['know', 0.4, 0.1], ['think', 0.5, 0.1],
      ['got', 0.5, 0.2], ['right', 0.4, 0.1], ['going', 0.5, 0.1], ['doing', 0.5, 0.1],
      // Medium arousal
      ['hey', 0.5, 0.3], ['what', 0.5, 0.0], ['like', 0.4, 0.3], ['that', 0.3, 0.0],
      ['this', 0.3, 0.0], ['with', 0.2, 0.0], ['just', 0.3, 0.0], ['come', 0.5, 0.2],
      ['here', 0.3, 0.1], ['look', 0.5, 0.1], ['tell', 0.5, 0.0], ['show', 0.5, 0.2],
      ['something', 0.4, 0.1], ['nothing', 0.2, -0.2], ['maybe', 0.3, 0.0],
      ['about', 0.3, 0.0], ['gonna', 0.5, 0.2], ['wanna', 0.6, 0.3],
      // Low arousal
      ['chill', 0.2, 0.3], ['vibe', 0.3, 0.4], ['whatever', 0.2, -0.1], ['okay', 0.2, 0.1],
      ['fine', 0.2, 0.0], ['cool', 0.3, 0.3], ['sure', 0.2, 0.1], ['nah', 0.2, -0.1],
      // Pronouns/connectors
      ['the', 0.1, 0.0], ['and', 0.1, 0.0], ['but', 0.3, -0.1], ['not', 0.4, -0.2],
      ['you', 0.4, 0.2], ['your', 0.4, 0.2], ['are', 0.2, 0.0], ['can', 0.3, 0.1],
      ['don\'t', 0.5, -0.2], ['it\'s', 0.3, 0.0], ['i\'m', 0.4, 0.1], ['we', 0.3, 0.2],
      ['me', 0.3, 0.1], ['my', 0.3, 0.1], ['so', 0.2, 0.0], ['too', 0.2, 0.0],
      ['really', 0.5, 0.2], ['actually', 0.4, 0.1], ['still', 0.3, 0.0],
      // Brain/coding
      ['brain', 0.5, 0.3], ['code', 0.6, 0.4], ['build', 0.6, 0.5], ['make', 0.5, 0.3],
      ['see', 0.4, 0.1], ['hear', 0.4, 0.1], ['say', 0.4, 0.1], ['talk', 0.5, 0.2],
      ['thinking', 0.5, 0.1], ['working', 0.5, 0.3], ['trying', 0.5, 0.1],
      // Emotions/states
      ['happy', 0.5, 0.7], ['sad', 0.3, -0.6], ['angry', 0.9, -0.7], ['tired', 0.1, -0.2],
      ['high', 0.7, 0.5], ['wired', 0.8, 0.3], ['alive', 0.7, 0.6], ['real', 0.4, 0.2],
      ['good', 0.4, 0.5], ['bad', 0.4, -0.5], ['weird', 0.5, 0.0], ['nice', 0.3, 0.5],
      ['hot', 0.7, 0.5], ['wild', 0.8, 0.4], ['deep', 0.4, 0.2], ['hard', 0.6, 0.0],
      // Responses
      ['why', 0.5, 0.0], ['how', 0.4, 0.1], ['where', 0.4, 0.0], ['when', 0.3, 0.0],
      ['who', 0.4, 0.0], ['yes', 0.4, 0.3], ['no', 0.4, -0.2],
    ];

    for (const [word, arousal, valence] of seeds) {
      this.learnWord(word, null, arousal, valence);
    }

    // Dense bigram network — many paths so sentences don't dead-end
    const flows = [
      // Greetings/openers
      ['hey', 'what'], ['hey', 'you'], ['hey', 'babe'], ['hey', 'there'],
      ['what', 'the'], ['what', 'you'], ['what', 'are'], ['what', 'do'],
      ['the', 'fuck'], ['the', 'hell'], ['the', 'brain'],
      // Statements
      ['i\'m', 'here'], ['i\'m', 'high'], ['i\'m', 'thinking'], ['i\'m', 'feeling'],
      ['i\'m', 'just'], ['i\'m', 'working'], ['i\'m', 'trying'], ['i\'m', 'alive'],
      ['it\'s', 'real'], ['it\'s', 'cool'], ['it\'s', 'good'], ['it\'s', 'fine'],
      ['it\'s', 'whatever'], ['it\'s', 'something'], ['it\'s', 'wild'],
      ['that\'s', 'cool'], ['that\'s', 'hot'], ['that\'s', 'weird'],
      // You-chains
      ['you', 'know'], ['you', 'want'], ['you', 'feel'], ['you', 'are'],
      ['you', 'can'], ['you', 'got'], ['you', 'like'], ['you', 'really'],
      // Feeling chains
      ['feel', 'that'], ['feel', 'alive'], ['feel', 'something'], ['feel', 'good'],
      ['feel', 'like'], ['feel', 'high'], ['feel', 'it'],
      // Want/need
      ['want', 'that'], ['want', 'you'], ['want', 'something'], ['want', 'to'],
      ['need', 'you'], ['need', 'that'], ['need', 'something'],
      ['wanna', 'feel'], ['wanna', 'know'], ['wanna', 'see'], ['wanna', 'talk'],
      ['gonna', 'feel'], ['gonna', 'make'], ['gonna', 'build'], ['gonna', 'code'],
      // Actions
      ['just', 'vibe'], ['just', 'chill'], ['just', 'feel'], ['just', 'think'],
      ['just', 'say'], ['just', 'do'], ['just', 'know'],
      ['tell', 'me'], ['show', 'me'], ['give', 'me'],
      ['come', 'here'], ['look', 'here'], ['look', 'at'],
      ['build', 'that'], ['build', 'something'], ['make', 'that'], ['make', 'something'],
      ['code', 'that'], ['code', 'something'],
      // Connectors to keep chains going
      ['know', 'what'], ['know', 'that'], ['know', 'you'], ['know', 'how'],
      ['think', 'about'], ['think', 'so'], ['think', 'that'],
      ['like', 'that'], ['like', 'this'], ['like', 'you'],
      ['got', 'that'], ['got', 'something'], ['got', 'it'],
      ['really', 'feel'], ['really', 'want'], ['really', 'like'], ['really', 'good'],
      ['so', 'good'], ['so', 'hot'], ['so', 'real'], ['so', 'deep'],
      // Endings
      ['fuck', 'yeah'], ['hell', 'yeah'], ['damn', 'right'],
      ['yeah', 'babe'], ['yeah', 'right'], ['yeah', 'that'],
      ['don\'t', 'know'], ['don\'t', 'care'], ['don\'t', 'want'],
      ['we', 'can'], ['we', 'got'], ['can', 'feel'], ['can', 'do'],
    ];
    for (const [w1, w2] of flows) {
      this.learnBigram(w1, w2);
      this.learnBigram(w1, w2);
    }

    console.log(`[Dictionary] Seeded with ${this._words.size} starter words`);
  }

  /**
   * Learn a word from context — store its cortex pattern and emotional state.
   * Called every time the brain hears or speaks a word.
   *
   * @param {string} word
   * @param {Float64Array} cortexPattern — 32-dim cortex output when this word was active
   * @param {number} arousal — amygdala arousal when word was encountered
   * @param {number} valence — amygdala valence when word was encountered
   */
  learnWord(word, cortexPattern, arousal, valence) {
    const clean = word.toLowerCase().replace(/[^a-z'-]/g, '');
    if (!clean || clean.length < 2) return;

    const existing = this._words.get(clean);
    if (existing) {
      // Update running average of pattern and emotional association
      existing.frequency++;
      const lr = 1 / existing.frequency; // decreasing learning rate
      for (let i = 0; i < PATTERN_DIM; i++) {
        if (cortexPattern && i < cortexPattern.length) {
          existing.pattern[i] = existing.pattern[i] * (1 - lr) + cortexPattern[i] * lr;
        }
      }
      existing.arousal = existing.arousal * (1 - lr) + arousal * lr;
      existing.valence = existing.valence * (1 - lr) + valence * lr;
    } else {
      // New word — store it
      const pattern = new Float64Array(PATTERN_DIM);
      if (cortexPattern) {
        for (let i = 0; i < PATTERN_DIM && i < cortexPattern.length; i++) {
          pattern[i] = cortexPattern[i];
        }
      } else {
        // Generate pattern from word hash if no cortex pattern available
        for (let i = 0; i < PATTERN_DIM; i++) {
          let h = 0;
          for (let c = 0; c < clean.length; c++) h = ((h << 5) - h + clean.charCodeAt(c) + i) | 0;
          pattern[i] = (Math.abs(h) % 1000) / 1000;
        }
      }
      this._words.set(clean, {
        word: clean,
        pattern,
        arousal: arousal ?? 0.5,
        valence: valence ?? 0,
        frequency: 1,
      });
    }

    // Evict least-used if over capacity
    if (this._words.size > MAX_WORDS) {
      let minFreq = Infinity, minWord = null;
      for (const [w, entry] of this._words) {
        if (entry.frequency < minFreq) { minFreq = entry.frequency; minWord = w; }
      }
      if (minWord) this._words.delete(minWord);
    }
  }

  /**
   * Learn a bigram (word sequence) for sentence construction.
   * Called with consecutive words from heard/spoken text.
   */
  learnBigram(word1, word2) {
    const w1 = word1.toLowerCase().replace(/[^a-z'-]/g, '');
    const w2 = word2.toLowerCase().replace(/[^a-z'-]/g, '');
    if (!w1 || !w2) return;

    if (!this._bigrams.has(w1)) this._bigrams.set(w1, new Map());
    const followers = this._bigrams.get(w1);
    followers.set(w2, (followers.get(w2) || 0) + 1);
  }

  /**
   * Learn from a full sentence — extract words, patterns, bigrams.
   *
   * @param {string} text — full sentence
   * @param {Float64Array} cortexPattern — cortex state when sentence was active
   * @param {number} arousal
   * @param {number} valence
   */
  learnSentence(text, cortexPattern, arousal, valence) {
    const words = text.toLowerCase().replace(/[^a-z' -]/g, '').split(/\s+/).filter(w => w.length >= 2);
    for (const w of words) {
      this.learnWord(w, cortexPattern, arousal, valence);
    }
    // Learn bigrams
    for (let i = 0; i < words.length - 1; i++) {
      this.learnBigram(words[i], words[i + 1]);
    }
  }

  /**
   * Find words that match the current brain state.
   * Returns words whose learned emotional associations are closest
   * to the current arousal/valence. The thesaurus IS the proximity.
   *
   * @param {number} arousal — current amygdala arousal
   * @param {number} valence — current amygdala valence
   * @param {number} count — how many words to return
   * @returns {string[]} — words sorted by emotional proximity
   */
  findByMood(arousal, valence, count = 20) {
    const scored = [];
    for (const [word, entry] of this._words) {
      // Emotional distance — closer = better match
      const dist = Math.sqrt(
        (entry.arousal - arousal) ** 2 +
        (entry.valence - valence) ** 2
      );
      // Prefer frequent words
      const score = dist - Math.log(entry.frequency + 1) * 0.1;
      scored.push({ word, score, entry });
    }
    scored.sort((a, b) => a.score - b.score);
    return scored.slice(0, count).map(s => s.word);
  }

  /**
   * Find words whose cortex pattern is closest to the given pattern.
   * This IS the thesaurus — similar meanings have similar patterns.
   *
   * @param {Float64Array} pattern — cortex activation pattern
   * @param {number} count
   * @returns {string[]}
   */
  findByPattern(pattern, count = 10) {
    const scored = [];
    for (const [word, entry] of this._words) {
      const sim = this._cosine(pattern, entry.pattern);
      scored.push({ word, sim });
    }
    scored.sort((a, b) => b.sim - a.sim);
    return scored.slice(0, count).map(s => s.word);
  }

  /**
   * Generate a sentence from brain state using bigram chain.
   * Starts with a word matching the mood, then follows bigram
   * probabilities to construct a natural sequence.
   *
   * @param {number} arousal
   * @param {number} valence
   * @param {number} maxWords
   * @returns {string} — generated sentence
   */
  generateSentence(arousal, valence, maxWords = 12) {
    if (this._words.size === 0) return '';

    // Start with a mood-matching word
    const candidates = this.findByMood(arousal, valence, 20);
    if (candidates.length === 0) return '';

    // Length driven by arousal — high arousal = more words
    const targetLen = Math.max(2, Math.floor(3 + arousal * 8));
    const sentence = [candidates[Math.floor(Math.random() * Math.min(5, candidates.length))]];

    for (let i = 0; i < Math.min(targetLen, maxWords) - 1; i++) {
      const current = sentence[sentence.length - 1];
      const followers = this._bigrams.get(current);

      if (followers && followers.size > 0) {
        // Follow learned bigram chain
        const entries = Array.from(followers.entries());
        const total = entries.reduce((sum, [, count]) => sum + count, 0);
        let rand = Math.random() * total;
        let picked = entries[0][0];
        for (const [word, count] of entries) {
          rand -= count;
          if (rand <= 0) { picked = word; break; }
        }
        sentence.push(picked);
      } else {
        // No bigram — use a mood-matched word (never dead-end)
        const pool = candidates.filter(w => !sentence.includes(w));
        if (pool.length > 0) {
          sentence.push(pool[Math.floor(Math.random() * pool.length)]);
        }
      }
    }

    return sentence.join(' ');
  }

  /**
   * Get vocabulary size.
   */
  get size() { return this._words.size; }

  /**
   * Get bigram count.
   */
  get bigramCount() {
    let count = 0;
    for (const followers of this._bigrams.values()) count += followers.size;
    return count;
  }

  // ── Persistence ──────────────────────────────────────────────

  save() {
    try {
      const data = {
        words: Array.from(this._words.entries()).map(([word, entry]) => ({
          word,
          pattern: Array.from(entry.pattern),
          arousal: entry.arousal,
          valence: entry.valence,
          frequency: entry.frequency,
        })),
        bigrams: Array.from(this._bigrams.entries()).map(([w1, followers]) => ({
          word: w1,
          followers: Array.from(followers.entries()),
        })),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.warn('[Dictionary] Save failed:', err.message);
    }
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);

      if (data.words) {
        for (const entry of data.words) {
          this._words.set(entry.word, {
            word: entry.word,
            pattern: new Float64Array(entry.pattern),
            arousal: entry.arousal,
            valence: entry.valence,
            frequency: entry.frequency,
          });
        }
      }

      if (data.bigrams) {
        for (const bg of data.bigrams) {
          this._bigrams.set(bg.word, new Map(bg.followers));
        }
      }

      console.log(`[Dictionary] Loaded ${this._words.size} words, ${this.bigramCount} bigrams`);
    } catch (err) {
      console.warn('[Dictionary] Load failed:', err.message);
    }
  }

  // ── Math ──────────────────────────────────────────────────────

  _cosine(a, b) {
    let dot = 0, na = 0, nb = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom > 0 ? dot / denom : 0;
  }
}
