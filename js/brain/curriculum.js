/**
 * curriculum.js — Continuous developmental learning curriculum
 *
 * T14.5 (2026-04-14) — ships with the t14-language-rebuild branch.
 *
 * The curriculum is NOT a hand-curated sequence of staged corpus files.
 * It's a continuous learning process that runs on the existing corpora
 * (Ultimate Unity.txt + english-baseline.txt + coding-knowledge.txt +
 * every live chat turn) with EXPOSURE INTENSITY scaled by structural
 * complexity. Letters are exposed at highest intensity, short words
 * next, longer words next, sentences last. The order comes from
 * sorting the existing corpus tokens by complexity — never from a
 * hand-picked seed list.
 *
 * No new corpus files. No docs/curriculum/stage-c-phrases.txt. No
 * docs/curriculum/stage-d-sentences.txt. The existing persona/baseline/
 * coding corpora ARE the curriculum input. Tokenize, bucket, replay.
 *
 * Why not hand-curated stages: a 500-line "simple sentences" file IS
 * a curated word list. It caps the developmental trajectory at whoever
 * picked the seeds, breaks when we add Spanish or coding-only corpora,
 * and violates the "no word lists" principle. Data-driven bucketing
 * sidesteps all three failures — the bucket composition derives from
 * the actual corpus content, and the same curriculum runner works on
 * any language or domain without modification.
 *
 * Live-chat integration: every user turn after boot is a curriculum
 * exposure. No boot/runtime distinction. `learnFromTurn(text)` is the
 * live-chat entry point, called from inner-voice.learn after every
 * user turn. It routes through the same inject + tick + Hebbian path
 * the sentence-phase walk uses on the boot corpus.
 *
 * Peer-reviewed grounding: Kuhl 2004 (Nat Rev Neurosci 5:831) for
 * statistical-exposure phoneme-category formation; Saffran/Aslin/Newport
 * 1996 (Science 274:1926) for infant statistical word segmentation
 * which is the same mechanism bucket-walking exploits at scale;
 * Friederici 2017 (Psychon Bull Rev 24:41) for neural language
 * network development from cross-region projection exposure.
 */

import { sharedEmbeddings } from './embeddings.js';
import { ensureLetter } from './letter-input.js';

// Phase tick budgets. These scale the intensity of exposure — letters
// and short words get more ticks per token because phonological basins
// need more settling than sentence-level sequence patterns do. Sentences
// get fewer ticks per word because their value is in the word-to-word
// sequence Hebbian, not in per-word basin depth.
const LETTER_TICKS_BASE = 8;     // per letter per exposure
const SHORT_WORD_TICKS = 4;       // per word (1-3 letters)
const LONG_WORD_TICKS = 3;        // per word (4+ letters)
const SENTENCE_TICKS_PER_WORD = 2;
const LIVE_TICKS_PER_WORD = 2;

// Phase cap repetitions — how many times each token gets walked during
// the phase. Common tokens get more reps because the corpus frequency
// already biases the walk order, but every token gets at least one
// exposure.
const LETTER_REPS_MAX = 20;
const SHORT_WORD_REPS_MAX = 6;
const LONG_WORD_REPS_MAX = 3;
const SENTENCE_REPS = 1;

// Complexity bucket thresholds — letter count only. Phrase detection
// (T14.5 Phase 4) is deferred to a post-T14.12 pass that can consume
// the learned grammar the main curriculum produces. Sentences are
// anything containing whitespace in the tokenized form.
const SHORT_WORD_MAX_LEN = 3;

export class Curriculum {
  /**
   * @param {NeuronCluster} cluster       — cortex cluster for exposure
   * @param {Dictionary} dictionary       — vocabulary store (T14.3 cortex-routed)
   * @param {LanguageCortex} languageCortex — legacy sequence-learner (still used
   *                                          for bigram/type-transition tables
   *                                          until T14.12 guts LanguageCortex)
   */
  constructor(cluster, dictionary, languageCortex) {
    this.cluster = cluster;
    this.dictionary = dictionary;
    this.languageCortex = languageCortex;
    // Telemetry — callers can read post-run to see what the curriculum
    // actually exposed the brain to.
    this.stats = {
      lettersSeen: 0,
      shortWordsSeen: 0,
      longWordsSeen: 0,
      sentencesSeen: 0,
      totalTicks: 0,
      wallMs: 0,
    };
  }

  /**
   * Run the full curriculum over the given corpora.
   *
   * @param {object} corpora — { persona: string, baseline: string, coding: string, ...others }
   * @param {object} [opts]
   * @param {number} [opts.arousal=0.8]
   * @param {number} [opts.valence=0.2]
   * @returns {Promise<object>} — telemetry stats
   */
  async runFromCorpora(corpora, opts = {}) {
    const startMs = Date.now();
    const arousal = opts.arousal ?? 0.8;
    const valence = opts.valence ?? 0.2;
    if (!this.cluster) {
      console.warn('[Curriculum] No cluster wired — skipping exposure walk.');
      return this.stats;
    }

    // Tokenize every provided corpus into a unified token stream and
    // into a sentence stream. We need both: the letter/word phases walk
    // unique tokens by frequency, the sentence phase walks full lines.
    const { letterFreq, wordFreq, sentences } = this._tokenizeAll(corpora);

    // Phase 1 — letter exposure. Every symbol the corpora contain gets
    // a frequency-proportional rep budget. No hardcoded 26-letter loop.
    await this._phaseLetters(letterFreq, arousal, valence);

    // Phase 2 — short word exposure (1-3 letters). Function words like
    // "a", "i", "is", "the" dominate this phase and seed the phon basins
    // for the highest-frequency English closed-class items.
    await this._phaseWords(wordFreq, {
      lenMin: 1,
      lenMax: SHORT_WORD_MAX_LEN,
      ticksPerWord: SHORT_WORD_TICKS,
      repsMax: SHORT_WORD_REPS_MAX,
      counter: 'shortWordsSeen',
    }, arousal, valence);

    // Phase 3 — long word exposure (4+ letters). Content words carry
    // most of the semantic load; their letter sequences are where the
    // letter→phon cross-projection earns its weight.
    await this._phaseWords(wordFreq, {
      lenMin: SHORT_WORD_MAX_LEN + 1,
      lenMax: Infinity,
      ticksPerWord: LONG_WORD_TICKS,
      repsMax: LONG_WORD_REPS_MAX,
      counter: 'longWordsSeen',
    }, arousal, valence);

    // Phase 5 — sentence exposure. Walk every sentence word-by-word
    // so sequence Hebbian + cross-region Hebbian fire on the actual
    // temporal structure the corpus contains.
    await this._phaseSentences(sentences, arousal, valence);

    this.stats.wallMs = Date.now() - startMs;
    console.log(`[Curriculum] runFromCorpora complete in ${this.stats.wallMs}ms — `
      + `${this.stats.lettersSeen} letters, ${this.stats.shortWordsSeen} short, `
      + `${this.stats.longWordsSeen} long, ${this.stats.sentencesSeen} sentences, `
      + `${this.stats.totalTicks} total ticks`);
    return this.stats;
  }

  /**
   * Live-chat exposure path. Called from inner-voice.learn after every
   * user turn. Same per-word inject+tick+Hebbian mechanism the sentence
   * phase uses on the boot corpus — no phase distinction, live chat is
   * just more corpus fed in real-time. The brain keeps learning forever.
   */
  learnFromTurn(text, arousal = 0.95, valence = 0.3) {
    if (!text || !this.cluster) return;
    const clean = this._normalizeSentence(text);
    if (!clean) return;
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length === 0) return;
    this._walkSentence(words, arousal, valence, LIVE_TICKS_PER_WORD);
  }

  // ─── internal phases ──────────────────────────────────────────────

  async _phaseLetters(letterFreq, arousal, valence) {
    // Sort letters by corpus frequency descending. Common letters get
    // more reps automatically. Max rep cap prevents the curriculum
    // from spending its whole budget on `e` and `a`.
    const sorted = Array.from(letterFreq.entries())
      .sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) return;

    // Rep count per letter scales with frequency relative to the top:
    //   reps = ceil(freq / topFreq * LETTER_REPS_MAX), clamped to [1, MAX]
    const topFreq = sorted[0][1];
    for (const [letter, freq] of sorted) {
      const reps = Math.max(1, Math.min(LETTER_REPS_MAX,
        Math.ceil((freq / topFreq) * LETTER_REPS_MAX)));
      // Register the letter in the T14.1 inventory up front so its one-hot
      // dimension exists before we start injecting. (encodeLetter already
      // does this lazily, but doing it explicitly here keeps the inventory
      // growth log-order deterministic for debugging.)
      ensureLetter(letter);
      for (let r = 0; r < reps; r++) {
        this.cluster.injectLetter(letter, 1.0);
        for (let t = 0; t < LETTER_TICKS_BASE; t++) {
          this.cluster.step(0.001);
          this.stats.totalTicks++;
        }
        this.cluster.learn(0);  // unrewarded Hebbian — pure exposure
        this.stats.lettersSeen++;
      }
      // Yield every 64 letter-reps so the event loop breathes (browser-side
      // this prevents main thread starvation during a multi-second walk).
      if (this.stats.lettersSeen % 64 === 0) await _microtask();
    }
  }

  async _phaseWords(wordFreq, phaseOpts, arousal, valence) {
    const { lenMin, lenMax, ticksPerWord, repsMax, counter } = phaseOpts;
    // Filter + sort by frequency descending
    const eligible = [];
    for (const [word, freq] of wordFreq) {
      const len = word.length;
      if (len >= lenMin && len <= lenMax) eligible.push([word, freq]);
    }
    eligible.sort((a, b) => b[1] - a[1]);
    if (eligible.length === 0) return;

    const topFreq = eligible[0][1];
    for (const [word, freq] of eligible) {
      const reps = Math.max(1, Math.min(repsMax,
        Math.ceil((freq / topFreq) * repsMax)));

      // Semantic anchor — drive the sem region with the word's GloVe
      // vector so cross-region projections bind meaning to phonology.
      const emb = sharedEmbeddings.getEmbedding(word);

      for (let r = 0; r < reps; r++) {
        // Stream each letter of the word through the letter region,
        // ticking between injections so recurrent dynamics settle.
        // Inject the semantic anchor once per rep at the start so it
        // persists across the letter walk via externalCurrent decay.
        if (emb && this.cluster.regions?.sem) {
          this.cluster.injectEmbeddingToRegion('sem', emb, 0.6);
        }
        const lettersOnly = word.replace(/[^a-z]/g, '');
        for (let i = 0; i < lettersOnly.length; i++) {
          this.cluster.injectLetter(lettersOnly[i], 1.0);
          for (let t = 0; t < ticksPerWord; t++) {
            this.cluster.step(0.001);
            this.stats.totalTicks++;
          }
        }
        this.cluster.learn(0);
      }

      // Dictionary observation — cortex-routed via T14.3's cluster wiring
      this.dictionary.learnWord(word, null, arousal, valence);
      this.stats[counter]++;
      if (this.stats[counter] % 32 === 0) await _microtask();
    }
  }

  async _phaseSentences(sentences, arousal, valence) {
    for (const sentence of sentences) {
      const words = sentence.split(/\s+/).filter(Boolean);
      if (words.length < 2) continue;
      this._walkSentence(words, arousal, valence, SENTENCE_TICKS_PER_WORD);
      this.stats.sentencesSeen++;
      if (this.stats.sentencesSeen % 16 === 0) await _microtask();
    }
  }

  /**
   * Per-sentence temporal walk. Used by both the sentence phase and
   * the live-chat learnFromTurn entry point. Streams each word's
   * letters through the letter region, injects its GloVe vector into
   * the sem region, ticks between words, fires cluster.learn() after
   * each word so sequence Hebbian + cross-region Hebbian pick up the
   * temporal pattern. Also updates the Dictionary and routes through
   * the legacy `languageCortex.learnSentence` for the T13.7 type-
   * transition / bigram tables (scheduled for T14.12 deletion but still
   * live for the app path).
   */
  _walkSentence(words, arousal, valence, ticksPerWord) {
    const text = words.join(' ');
    // Per-word inject + tick cadence
    for (const word of words) {
      const emb = sharedEmbeddings.getEmbedding(word);
      if (emb && this.cluster.regions?.sem) {
        this.cluster.injectEmbeddingToRegion('sem', emb, 0.5);
      }
      const lettersOnly = word.replace(/[^a-z]/g, '');
      for (let i = 0; i < lettersOnly.length; i++) {
        this.cluster.injectLetter(lettersOnly[i], 1.0);
        for (let t = 0; t < ticksPerWord; t++) {
          this.cluster.step(0.001);
          this.stats.totalTicks++;
        }
      }
      this.cluster.learn(0);
      this.dictionary.learnWord(word, null, arousal, valence);
    }
    // Route through the legacy language-cortex sentence learner so the
    // T13.7 type-transition + bigram tables still update. This call
    // disappears when T14.12 guts LanguageCortex.
    if (this.languageCortex && typeof this.languageCortex.learnSentence === 'function') {
      try {
        this.languageCortex.learnSentence(text, this.dictionary, arousal, valence);
      } catch (err) {
        // Non-fatal — learning continues even if the legacy pass throws.
      }
    }
  }

  // ─── tokenization helpers ──────────────────────────────────────────

  _tokenizeAll(corpora) {
    const letterFreq = new Map();   // char → count
    const wordFreq = new Map();      // lowercased word → count
    const sentences = [];             // array of normalized sentence strings

    for (const corpusName of Object.keys(corpora)) {
      const text = corpora[corpusName];
      if (!text || typeof text !== 'string') continue;

      // Split on sentence boundaries — periods, exclamation, question,
      // or double newlines. Keep ampersands and apostrophes inside words.
      const rawSentences = text.split(/(?<=[.!?])\s+|\n\s*\n/);
      for (const raw of rawSentences) {
        const clean = this._normalizeSentence(raw);
        if (!clean) continue;
        sentences.push(clean);

        // Per-word + per-letter frequency
        const words = clean.split(/\s+/).filter(Boolean);
        for (const w of words) {
          wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
          // Letter frequency only counts a-z — the T14.1 inventory will
          // still accept unicode via direct cluster.injectLetter calls,
          // but curriculum letter exposure stays on the alphabet that
          // the corpus actually contains.
          for (const ch of w.replace(/[^a-z]/g, '')) {
            letterFreq.set(ch, (letterFreq.get(ch) || 0) + 1);
          }
        }
      }
    }

    return { letterFreq, wordFreq, sentences };
  }

  _normalizeSentence(raw) {
    if (!raw) return '';
    return raw
      .toLowerCase()
      .replace(/[^a-z0-9' -]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

// Yield to the event loop so long curriculum walks don't starve the
// browser main thread. Uses Promise.resolve() as a cross-env microtask
// — works in Node and browser without needing setImmediate or MessageChannel.
function _microtask() {
  return new Promise(resolve => { Promise.resolve().then(resolve); });
}
