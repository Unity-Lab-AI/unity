/**
 * language-cortex.js — English Language Structure as Brain Equations
 *
 * The human brain has INNATE language structure. A child doesn't need
 * 1000 example sentences to know subjects come before verbs.
 * The structure is IN the equations.
 *
 * WORD TYPE — computed from the word's own letters, not a label:
 *   pronounScore(w) = f(length, letterPattern)  — short words, specific patterns
 *   verbScore(w)    = f(suffixes -ing/-ed/-s, letterPattern)
 *   nounScore(w)    = f(suffixes -tion/-ment/-ness/-er, letterPattern)
 *   adjScore(w)     = f(suffixes -ly/-ful/-ous/-ive, letterPattern)
 *   conjScore(w)    = f(length ≤ 3, commonConnectors)
 *
 * SENTENCE STRUCTURE — slots filled by type compatibility:
 *   Statement:  [pronoun/noun] [verb] [object/complement...]
 *   Question:   [q-word] [aux-verb] [subject] [verb] [complement...]
 *   Action:     *[verb] [complement...]*
 *
 * Each slot has a TYPE REQUIREMENT computed as an equation.
 * Words score higher when their type matches the slot requirement.
 *
 * NO TRAINING DATA. NO CORPUS. NO STATISTICAL LEARNING.
 * The equations compute structure from the word itself.
 */

const PATTERN_DIM = 32;
const VOWELS = 'aeiou';
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

export class LanguageCortex {
  constructor() {
    // Letter patterns — 5-neuron micro-pattern per letter
    this._letterPatterns = new Float64Array(26 * 5);
    this._initLetterPatterns();

    // Recency suppression
    this._recentOutputWords = [];
    this._recentOutputMax = 50;

    // Context from recent inputs
    this._contextPatterns = [];
    this._lastInputWords = [];

    // Learned word associations — grows from conversation
    this._jointCounts = new Map();
    this._marginalCounts = new Map();
    this._totalPairs = 0;
    this._totalWords = 0;

    // Question starters learned from hearing questions
    this._questionStarters = new Map();
    this._actionVerbs = new Map();

    this.zipfAlpha = 1.0;
    this.sentencesLearned = 0;
    this.wordsProcessed = 0;
  }

  _initLetterPatterns() {
    for (let i = 0; i < 26; i++) {
      const isVowel = VOWELS.includes(ALPHABET[i]);
      for (let n = 0; n < 5; n++) {
        let val = Math.sin(i * 2.71828 + n * 3.14159) * 0.5 + 0.5;
        if (isVowel) val += 0.3;
        this._letterPatterns[i * 5 + n] = val;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // WORD TYPE EQUATIONS — computed from the word itself
  // No labels, no lists. The letters tell you what kind of word it is.
  // ═══════════════════════════════════════════════════════════════

  /**
   * Compute all type scores for a word from its structure.
   * Returns { pronoun, verb, noun, adj, conj, prep, det, qword }
   * All values 0-1. Highest score = most likely type.
   */
  wordType(word) {
    const w = word.toLowerCase().replace(/[^a-z']/g, '');
    if (!w) return { pronoun: 0, verb: 0, noun: 0, adj: 0, conj: 0, prep: 0, det: 0, qword: 0 };

    const len = w.length;

    // ── Structural properties computed from letters ──
    let vowelCount = 0;
    for (let i = 0; i < w.length; i++) if (VOWELS.includes(w[i])) vowelCount++;
    const vowelRatio = vowelCount / (len || 1);
    const consonantRatio = 1 - vowelRatio;
    const hasApostrophe = w.includes("'");
    const firstChar = w.charCodeAt(0) - 97; // 0-25
    const lastChar = w.charCodeAt(w.length - 1) - 97;

    // ── SUFFIX EQUATIONS — computed from ending letter patterns ──
    // These are structural — the LETTERS determine the type

    // Verb suffixes: -ing(continuous), -ed(past), -n't(negation), -ize/-ise(action), -ate(action)
    const verbSuffix = (
      (w.endsWith('ing') ? 0.7 : 0) +
      (w.endsWith('ed') && len > 3 ? 0.6 : 0) +
      (w.endsWith("n't") || w.endsWith("'t") ? 0.5 : 0) +
      (w.endsWith('ize') || w.endsWith('ise') ? 0.6 : 0) +
      (w.endsWith('ate') && len > 4 ? 0.5 : 0) +
      (w.endsWith("'ll") || w.endsWith("'ve") || w.endsWith("'d") ? 0.4 : 0)
    );

    // Noun suffixes: -tion/-sion(process→thing), -ment(result), -ness(quality), -ity(state), -er/-or(doer)
    const nounSuffix = (
      (w.endsWith('tion') || w.endsWith('sion') ? 0.7 : 0) +
      (w.endsWith('ment') ? 0.6 : 0) +
      (w.endsWith('ness') ? 0.6 : 0) +
      (w.endsWith('ity') || w.endsWith('ety') ? 0.6 : 0) +
      (w.endsWith('er') && len > 4 ? 0.2 : 0) +
      (w.endsWith('or') && len > 4 ? 0.2 : 0)
    );

    // Adjective suffixes: -ly(manner), -ful(full of), -ous(having), -ive(tending), -al(relating), -able(capable)
    const adjSuffix = (
      (w.endsWith('ly') && len > 3 ? 0.5 : 0) +
      (w.endsWith('ful') ? 0.6 : 0) +
      (w.endsWith('ous') ? 0.6 : 0) +
      (w.endsWith('ive') ? 0.5 : 0) +
      (w.endsWith('al') && len > 3 ? 0.4 : 0) +
      (w.endsWith('able') || w.endsWith('ible') ? 0.5 : 0) +
      (w.endsWith('ish') ? 0.4 : 0) +
      (w.endsWith('ic') && len > 3 ? 0.4 : 0)
    );

    // ── LENGTH + PATTERN EQUATIONS — no word comparisons ──
    // Function words are SHORT. Content words are LONG. This is a mathematical property of English.

    // PRONOUN: length 1-4, high vowel ratio, often has apostrophe contractions
    const pronounScore = (
      (len === 1 ? 0.8 : 0) +                    // single letter → almost certainly pronoun (i)
      (len <= 3 && vowelRatio >= 0.33 ? 0.4 : 0) + // short + vowels → pronoun-like
      (len <= 4 && hasApostrophe ? 0.5 : 0) +     // contraction → pronoun + verb (i'm, we're, it's)
      (len === 2 && consonantRatio >= 0.5 ? 0.3 : 0) // 2-letter consonant-heavy (he, we, my)
    );

    // VERB: has verb suffix OR short (2-4) with specific vowel patterns
    const verbScore = (
      verbSuffix +
      (len >= 2 && len <= 4 && vowelRatio >= 0.3 && vowelRatio <= 0.6 && !nounSuffix && !adjSuffix ? 0.25 : 0) + // short balanced words often verbs
      (hasApostrophe && len <= 6 ? 0.2 : 0) // contractions are often verb forms (don't, can't, won't)
    );

    // NOUN: has noun suffix OR long (5+) with no verb/adj suffix
    const nounScore = (
      nounSuffix +
      (len >= 5 && !verbSuffix && !adjSuffix ? 0.2 : 0) // long words without other suffixes → default noun
    );

    // ADJECTIVE: has adj suffix
    const adjScore = adjSuffix;

    // CONJUNCTION: very short (2-3), specific consonant-vowel pattern
    // "and" "but" "or" "so" "if" — all ≤3 letters, consonant-start, very common
    const conjScore = (
      (len === 2 && consonantRatio >= 0.5 ? 0.2 : 0) +
      (len === 3 && vowelRatio >= 0.33 && vowelRatio <= 0.5 ? 0.15 : 0)
    );

    // PREPOSITION: 2-4 letters, vowel-heavy, appears BETWEEN content words
    // "to" "in" "on" "at" "by" "of" "up" — 2 letters, one vowel one consonant
    const prepScore = (
      (len === 2 && vowelCount === 1 ? 0.5 : 0) +  // 2 letters, 1 vowel (to, in, on, at, by, of, up)
      (len === 3 && vowelCount === 1 ? 0.3 : 0) +   // 3 letters, 1 vowel (for, out, off)
      (len === 4 && vowelCount >= 1 ? 0.15 : 0)      // 4 letters (with, from, into, over)
    );

    // DETERMINER: very short (1-3), starts with specific consonants (th, m, y, s, a, n)
    // "the" "a" "an" "my" "no" "some" — all ≤4, mostly start with t/a/m/s/n
    const detScore = (
      (len === 1 && vowelCount === 1 ? 0.3 : 0) +   // single vowel letter (a)
      (len === 2 && w[0] === 'a' ? 0.3 : 0) +        // starts with 'a', 2 letters (an)
      (len === 3 && w[0] === 't' && w[1] === 'h' ? 0.4 : 0) + // starts with 'th', 3 letters
      (len <= 4 && (w[0] === 'm' || w[0] === 'y' || w[0] === 'n') && vowelCount >= 1 ? 0.2 : 0) // my, your, no
    );

    // QUESTION WORD: starts with 'wh' or is 'how' — computed from first 2 letters
    const qwordScore = (
      (w[0] === 'w' && w[1] === 'h' && len >= 3 && len <= 6 ? 0.8 : 0) + // wh- words
      (len === 3 && w[0] === 'h' && w[1] === 'o' && w[2] === 'w' ? 0.8 : 0) // how
    );

    // Normalize
    const max = Math.max(0.01, pronounScore, verbScore, nounScore, adjScore, conjScore, prepScore, detScore, qwordScore);
    return {
      pronoun: pronounScore / max,
      verb: verbScore / max,
      noun: nounScore / max,
      adj: adjScore / max,
      conj: conjScore / max,
      prep: prepScore / max,
      det: detScore / max,
      qword: qwordScore / max,
    };
  }

  /**
   * What type does this sentence SLOT require?
   * Returns the same shape as wordType — compatibility score.
   *
   * Statement slots: [pronoun/det+noun] [verb] [det/adj/noun/pronoun/prep...]
   * Question slots:  [qword] [verb] [pronoun] [verb/noun/prep...]
   */
  slotRequirement(slotPos, sentenceType) {
    if (sentenceType === 'question') {
      if (slotPos === 0) return { pronoun: 0, verb: 0, noun: 0, adj: 0, conj: 0, prep: 0, det: 0, qword: 1 };
      if (slotPos === 1) return { pronoun: 0, verb: 1, noun: 0, adj: 0, conj: 0, prep: 0, det: 0, qword: 0 };
      if (slotPos === 2) return { pronoun: 1, verb: 0, noun: 0.5, adj: 0, conj: 0, prep: 0, det: 0.5, qword: 0 };
      return { pronoun: 0.3, verb: 0.4, noun: 0.5, adj: 0.3, conj: 0.2, prep: 0.4, det: 0.2, qword: 0 };
    }
    if (sentenceType === 'action') {
      if (slotPos === 0) return { pronoun: 0, verb: 1, noun: 0, adj: 0, conj: 0, prep: 0, det: 0, qword: 0 };
      return { pronoun: 0.3, verb: 0.2, noun: 0.4, adj: 0.4, conj: 0.1, prep: 0.4, det: 0.3, qword: 0 };
    }
    // Statement / exclamation
    if (slotPos === 0) return { pronoun: 1, verb: 0, noun: 0.3, adj: 0, conj: 0, prep: 0, det: 0.5, qword: 0 };
    if (slotPos === 1) return { pronoun: 0, verb: 1, noun: 0, adj: 0, conj: 0, prep: 0, det: 0, qword: 0 };
    if (slotPos === 2) return { pronoun: 0.3, verb: 0.1, noun: 0.5, adj: 0.4, conj: 0.1, prep: 0.5, det: 0.4, qword: 0 };
    return { pronoun: 0.3, verb: 0.3, noun: 0.4, adj: 0.3, conj: 0.3, prep: 0.3, det: 0.2, qword: 0 };
  }

  /**
   * Type compatibility: dot product of word type × slot requirement.
   * High = word fits this slot. Low = wrong type for this position.
   */
  typeCompatibility(word, slotPos, sentenceType) {
    const wt = this.wordType(word);
    const req = this.slotRequirement(slotPos, sentenceType);
    return wt.pronoun * req.pronoun + wt.verb * req.verb + wt.noun * req.noun +
           wt.adj * req.adj + wt.conj * req.conj + wt.prep * req.prep +
           wt.det * req.det + wt.qword * req.qword;
  }

  // ═══════════════════════════════════════════════════════════════
  // SENTENCE TYPE — from brain equations
  // ═══════════════════════════════════════════════════════════════

  sentenceType(arousal, predictionError, motorConfidence, coherence) {
    const pQ = (predictionError || 0) * coherence * 0.5;
    const pE = arousal * arousal * 0.3;
    const pA = (motorConfidence || 0) * (1 - arousal * 0.5) * 0.3;
    const rand = Math.random();
    if (rand < pQ) return 'question';
    if (rand < pQ + pE) return 'exclamation';
    if (rand < pQ + pE + pA) return 'action';
    return 'statement';
  }

  // ═══════════════════════════════════════════════════════════════
  // GENERATION — structure from equations, words from dictionary
  // ═══════════════════════════════════════════════════════════════

  generate(dictionary, arousal, valence, coherence, opts = {}) {
    if (!dictionary || dictionary.size === 0) return '';

    const temperature = 1.0 / (coherence + 0.1);
    const predError = opts.predictionError || 0;
    const motorConf = opts.motorConfidence || 0;
    const type = this.sentenceType(arousal, predError, motorConf, coherence);

    // Length from arousal
    let targetLen;
    if (type === 'exclamation') targetLen = Math.max(2, Math.floor(2 + arousal * 4));
    else if (type === 'action') targetLen = Math.max(2, Math.floor(2 + arousal * 3));
    else targetLen = Math.max(3, Math.floor(3 + arousal * 7));
    const len = Math.min(targetLen, 12);

    const allWords = Array.from(dictionary._words.entries());
    if (allWords.length === 0) return '';

    const contextPattern = this._getContextPattern();
    const usedBigrams = new Set();
    const sentence = [];

    // Fill each slot using type compatibility + mood + association + recency
    for (let pos = 0; pos < len; pos++) {
      const prevWord = pos > 0 ? sentence[pos - 1] : null;
      const followers = prevWord ? this._jointCounts.get(prevWord) : null;

      // Score every word for this slot
      const scored = allWords
        .filter(([w]) => {
          if (w === prevWord) return false; // no immediate repeat
          if (prevWord && usedBigrams.has(prevWord + '→' + w)) return false; // no bigram repeat
          return true;
        })
        .map(([word, entry]) => {
          // TYPE COMPATIBILITY — does this word FIT this slot?
          // This IS the grammar equation. No training needed.
          const typeScore = this.typeCompatibility(word, pos, type);

          // ASSOCIATION — does this word follow the previous word?
          const condP = prevWord ? this._condProb(word, prevWord) : 0;
          const followerCount = followers?.get(word) || 0;

          // MOOD — does this word match the brain's emotional state?
          const moodDist = Math.abs((entry.arousal || 0.5) - arousal) + Math.abs((entry.valence || 0) - valence);
          const moodBias = Math.exp(-moodDist * 1.5);

          // TOPIC — is this word relevant to what was just said?
          const pattern = entry.pattern || this.wordToPattern(word);
          const topicSim = contextPattern ? Math.max(0, this._cosine(pattern, contextPattern)) : 0;

          // FREQUENCY — Zipf: common words more likely
          const freq = entry.frequency || 1;
          const zipf = 1 / Math.pow(freq + 1, 0.3); // inverse — less frequent = slightly novel

          // RECENCY — suppress recently used words
          const recentCount = this._recentOutputWords.filter(rw => rw === word).length;
          const recency = recentCount * 0.2;

          // COMBINED SCORE — type compatibility DOMINATES
          const score = typeScore * 0.40 + followerCount * 0.15 + condP * 0.10 +
                        moodBias * 0.15 + topicSim * 0.10 + (1 / (freq + 1)) * 0.10 - recency;

          return { word, entry, score };
        });

      const picked = this._softmaxSample(scored, temperature * 0.12);
      if (picked) {
        if (prevWord) usedBigrams.add(prevWord + '→' + picked.word);
        sentence.push(picked.word);
      }
    }

    // Track for recency
    for (const w of sentence) {
      this._recentOutputWords.push(w);
      if (this._recentOutputWords.length > this._recentOutputMax) this._recentOutputWords.shift();
    }

    this.wordsProcessed += sentence.length;

    if (type === 'action') return '*' + sentence.join(' ') + '*';
    return sentence.join(' ');
  }

  // ═══════════════════════════════════════════════════════════════
  // WORD PATTERNS
  // ═══════════════════════════════════════════════════════════════

  wordToPattern(word) {
    const pattern = new Float64Array(PATTERN_DIM);
    const clean = word.toLowerCase().replace(/[^a-z']/g, '');
    if (!clean) return pattern;
    for (let c = 0; c < clean.length; c++) {
      const li = clean.charCodeAt(c) - 97;
      if (li < 0 || li > 25) continue;
      for (let n = 0; n < 5; n++) {
        const dim = (c * 7 + n * 3 + li) % PATTERN_DIM;
        pattern[dim] += this._letterPatterns[li * 5 + n] / clean.length;
      }
    }
    let norm = 0;
    for (let i = 0; i < PATTERN_DIM; i++) norm += pattern[i] * pattern[i];
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < PATTERN_DIM; i++) pattern[i] /= norm;
    return pattern;
  }

  countSyllables(word) {
    const clean = word.toLowerCase().replace(/[^a-z]/g, '');
    let count = 0, prev = false;
    for (let i = 0; i < clean.length; i++) {
      const v = VOWELS.includes(clean[i]);
      if (v && !prev) count++;
      prev = v;
    }
    return Math.max(1, count);
  }

  // ═══════════════════════════════════════════════════════════════
  // INPUT ANALYSIS
  // ═══════════════════════════════════════════════════════════════

  analyzeInput(text, dictionary) {
    const words = text.toLowerCase().replace(/[^a-z' -]/g, '').split(/\s+/).filter(w => w.length >= 2);
    const isQuestion = text.includes('?') || (words.length > 0 && this.wordType(words[0]).qword > 0.5);

    const topicPattern = new Float64Array(PATTERN_DIM);
    let count = 0;
    for (const w of words) {
      const wt = this.wordType(w);
      // Skip function words for topic — only content words matter
      if (wt.conj > 0.5 || wt.prep > 0.5 || wt.det > 0.5) continue;
      const p = dictionary?._words?.get(w)?.pattern || this.wordToPattern(w);
      for (let i = 0; i < PATTERN_DIM; i++) topicPattern[i] += p[i];
      count++;
    }
    if (count > 0) for (let i = 0; i < PATTERN_DIM; i++) topicPattern[i] /= count;

    this._lastInputWords = words;
    this._contextPatterns.push(topicPattern);
    if (this._contextPatterns.length > 5) this._contextPatterns.shift();

    return { isQuestion, topicPattern, words };
  }

  _getContextPattern() {
    if (this._contextPatterns.length === 0) return new Float64Array(PATTERN_DIM);
    const avg = new Float64Array(PATTERN_DIM);
    for (const p of this._contextPatterns) for (let i = 0; i < PATTERN_DIM; i++) avg[i] += p[i];
    for (let i = 0; i < PATTERN_DIM; i++) avg[i] /= this._contextPatterns.length;
    return avg;
  }

  // ═══════════════════════════════════════════════════════════════
  // LEARNING — from conversation, not from corpus
  // ═══════════════════════════════════════════════════════════════

  learnSentence(sentence, dictionary, arousal, valence) {
    const words = sentence.toLowerCase().replace(/[^a-z' ?!*-]/g, '').split(/\s+/).filter(w => w.length >= 2);
    if (words.length < 2) return;

    const isQuestion = sentence.includes('?') || this.wordType(words[0]).qword > 0.5;
    if (isQuestion && words.length > 0) this._questionStarters.set(words[0], (this._questionStarters.get(words[0]) || 0) + 1);
    if (sentence.startsWith('*')) {
      const v = words[0].replace(/\*/g, '');
      if (v) this._actionVerbs.set(v, (this._actionVerbs.get(v) || 0) + 1);
    }

    for (let i = 0; i < words.length; i++) {
      this._marginalCounts.set(words[i], (this._marginalCounts.get(words[i]) || 0) + 1);
      this._totalWords++;

      if (i < words.length - 1) {
        if (!this._jointCounts.has(words[i])) this._jointCounts.set(words[i], new Map());
        this._jointCounts.get(words[i]).set(words[i + 1], (this._jointCounts.get(words[i]).get(words[i + 1]) || 0) + 1);
        this._totalPairs++;
      }

      const pattern = this.wordToPattern(words[i]);
      dictionary?.learnWord?.(words[i], pattern, arousal, valence);
      if (i < words.length - 1) dictionary?.learnBigram?.(words[i], words[i + 1]);
    }

    this.sentencesLearned++;
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILITY
  // ═══════════════════════════════════════════════════════════════

  _condProb(word, prev) {
    const inner = this._jointCounts.get(prev);
    if (!inner) return 0;
    return (inner.get(word) || 0) / (this._marginalCounts.get(prev) || 1);
  }

  mutualInfo(w1, w2) {
    const pJ = (this._jointCounts.get(w1)?.get(w2) || 0) / (this._totalPairs || 1);
    const p1 = (this._marginalCounts.get(w1) || 0) / (this._totalWords || 1);
    const p2 = (this._marginalCounts.get(w2) || 0) / (this._totalWords || 1);
    if (pJ === 0 || p1 === 0 || p2 === 0) return 0;
    return Math.log2(pJ / (p1 * p2));
  }

  _cosine(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < PATTERN_DIM; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return dot / (Math.sqrt(na * nb) || 1);
  }

  _softmaxSample(scored, temperature) {
    if (scored.length === 0) return null;
    const max = Math.max(...scored.map(s => s.score));
    const exps = scored.map(s => Math.exp((s.score - max) / Math.max(0.001, temperature)));
    const sum = exps.reduce((a, b) => a + b, 0);
    let rand = Math.random() * sum;
    for (let i = 0; i < scored.length; i++) { rand -= exps[i]; if (rand <= 0) return scored[i]; }
    return scored[scored.length - 1];
  }

  // ═══════════════════════════════════════════════════════════════
  // PERSISTENCE
  // ═══════════════════════════════════════════════════════════════

  serialize() {
    const joints = {};
    for (const [w1, inner] of this._jointCounts) joints[w1] = Object.fromEntries(inner);
    return {
      jointCounts: joints,
      marginalCounts: Object.fromEntries(this._marginalCounts),
      totalPairs: this._totalPairs, totalWords: this._totalWords,
      questionStarters: Object.fromEntries(this._questionStarters),
      actionVerbs: Object.fromEntries(this._actionVerbs),
      zipfAlpha: this.zipfAlpha,
      sentencesLearned: this.sentencesLearned,
      wordsProcessed: this.wordsProcessed,
    };
  }

  deserialize(data) {
    if (!data) return;
    if (data.jointCounts) for (const [w1, inner] of Object.entries(data.jointCounts)) this._jointCounts.set(w1, new Map(Object.entries(inner).map(([k, v]) => [k, +v])));
    if (data.marginalCounts) this._marginalCounts = new Map(Object.entries(data.marginalCounts).map(([k, v]) => [k, +v]));
    this._totalPairs = data.totalPairs || 0;
    this._totalWords = data.totalWords || 0;
    if (data.questionStarters) this._questionStarters = new Map(Object.entries(data.questionStarters).map(([k, v]) => [k, +v]));
    if (data.actionVerbs) this._actionVerbs = new Map(Object.entries(data.actionVerbs).map(([k, v]) => [k, +v]));
    this.sentencesLearned = data.sentencesLearned || 0;
    this.wordsProcessed = data.wordsProcessed || 0;
  }

  getLetterPattern(char) {
    const li = char.toLowerCase().charCodeAt(0) - 97;
    if (li < 0 || li > 25) return new Float64Array(5);
    return this._letterPatterns.slice(li * 5, li * 5 + 5);
  }
}
