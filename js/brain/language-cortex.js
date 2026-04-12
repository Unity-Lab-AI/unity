/**
 * language-cortex.js — Language Production from Linguistic Equations
 *
 * Real language equations governing Unity's speech production:
 *
 * Zipf's Law:       f(r) = C / r^α         — word frequency is a power law
 * Mutual Info:      I(w1;w2) = log(P(w1,w2) / P(w1)·P(w2))  — word association strength
 * Surprisal:        S(w) = -log₂ P(w|context)  — unexpectedness drives emphasis
 * Entropy Rate:     H = -Σ P(w) log P(w)     — sentence complexity from brain state
 * Conditional Chain: P(sentence) = Π P(w_i | w_{i-1}, position, mood)
 *
 * These aren't lists. They're the mathematics of how language works.
 * The brain's arousal/valence/coherence modulate these equations:
 *   - arousal  → entropy rate (how wild the sentence gets)
 *   - valence  → word selection bias (positive vs negative vocabulary)
 *   - coherence → temperature (structured vs scattered speech)
 */

const PATTERN_DIM = 32;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
const VOWELS = 'aeiou';

export class LanguageCortex {
  constructor() {
    // Joint probability table — P(w1, w2) for mutual information
    // Stored as Map<string, Map<string, number>> + marginal counts
    this._jointCounts = new Map();  // word pair counts
    this._marginalCounts = new Map(); // individual word counts
    this._totalPairs = 0;
    this._totalWords = 0;

    // Position-conditioned probability — P(w | position)
    // What kind of word appears at each sentence position
    this._positionCounts = new Array(15).fill(null).map(() => new Map());
    this._positionTotals = new Float64Array(15);

    // Prediction weight matrix — learns from mutual information
    this._predWeights = new Float64Array(PATTERN_DIM * PATTERN_DIM);

    // Letter→pattern mapping
    this._letterPatterns = new Float64Array(26 * 5);
    this._initLetterPatterns();

    // Zipf's alpha — learned from observed frequency distribution
    this.zipfAlpha = 1.0; // typical English ≈ 1.0

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

  /**
   * Build a cortex pattern from a word's letters.
   */
  wordToPattern(word) {
    const pattern = new Float64Array(PATTERN_DIM);
    const clean = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!clean) return pattern;

    for (let c = 0; c < clean.length; c++) {
      const li = clean.charCodeAt(c) - 97;
      if (li < 0 || li > 25) continue;
      for (let n = 0; n < 5; n++) {
        const targetDim = (c * 7 + n * 3 + li) % PATTERN_DIM;
        pattern[targetDim] += this._letterPatterns[li * 5 + n] / clean.length;
      }
      // Syllable boundary markers
      if (c > 0) {
        const prevV = VOWELS.includes(clean[c - 1]);
        const currV = VOWELS.includes(clean[c]);
        if (prevV !== currV) pattern[(c * 11) % PATTERN_DIM] += 0.15;
      }
    }
    // Normalize
    let norm = 0;
    for (let i = 0; i < PATTERN_DIM; i++) norm += pattern[i] * pattern[i];
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < PATTERN_DIM; i++) pattern[i] /= norm;
    return pattern;
  }

  countSyllables(word) {
    const clean = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!clean) return 0;
    let count = 0, prevV = false;
    for (let i = 0; i < clean.length; i++) {
      const isV = VOWELS.includes(clean[i]);
      if (isV && !prevV) count++;
      prevV = isV;
    }
    return Math.max(1, count);
  }

  // ── Linguistic Equations ────────────────────────────────────────

  /**
   * Mutual Information: I(w1; w2) = log₂(P(w1,w2) / P(w1)·P(w2))
   * How much more likely two words appear together than by chance.
   * High MI = strong association. This replaces raw bigram counts.
   */
  mutualInfo(w1, w2) {
    const pJoint = this._getJointProb(w1, w2);
    const p1 = this._getMarginalProb(w1);
    const p2 = this._getMarginalProb(w2);
    if (pJoint === 0 || p1 === 0 || p2 === 0) return 0;
    return Math.log2(pJoint / (p1 * p2));
  }

  _getJointProb(w1, w2) {
    const inner = this._jointCounts.get(w1);
    if (!inner) return 0;
    return (inner.get(w2) || 0) / (this._totalPairs || 1);
  }

  _getMarginalProb(w) {
    return (this._marginalCounts.get(w) || 0) / (this._totalWords || 1);
  }

  /**
   * Surprisal: S(w) = -log₂ P(w | previous_word)
   * How unexpected this word is given what came before.
   * High surprisal = surprising = draws attention.
   */
  surprisal(word, prevWord) {
    if (!prevWord) return -Math.log2(this._getMarginalProb(word) || 0.001);
    const pCond = this._getConditionalProb(word, prevWord);
    return -Math.log2(pCond || 0.001);
  }

  _getConditionalProb(word, prevWord) {
    const inner = this._jointCounts.get(prevWord);
    if (!inner) return this._getMarginalProb(word);
    const jointCount = inner.get(word) || 0;
    const prevCount = this._marginalCounts.get(prevWord) || 1;
    return jointCount / prevCount;
  }

  /**
   * Zipf rank probability: P(rank) = C / rank^α
   * More frequent words are exponentially more likely to be selected.
   */
  zipfProb(rank) {
    return 1 / Math.pow(rank + 1, this.zipfAlpha);
  }

  /**
   * Target entropy from brain state:
   * H_target = H_base + arousal · H_range
   * Higher arousal = higher entropy = more varied/wild word choices
   * Lower arousal = lower entropy = more predictable/common words
   */
  targetEntropy(arousal) {
    const H_base = 2.0;  // minimum entropy (simple speech)
    const H_range = 4.0;  // max additional entropy
    return H_base + arousal * H_range;
  }

  // ── Sentence Generation ─────────────────────────────────────────

  /**
   * Generate a sentence using the full linguistic equation chain:
   *
   * P(w_i) ∝ P(w_i | w_{i-1}) · P(w_i | position_i) · Zipf(rank_i) · mood_bias(w_i)
   *
   * Temperature = 1 / (coherence + 0.1) — focused brain = more structured
   * Length = f(arousal) — more aroused = more words
   */
  generate(dictionary, arousal, valence, coherence, maxWords = 12) {
    if (!dictionary || dictionary.size === 0) return '';

    const temperature = 1.0 / (coherence + 0.1);
    const targetLen = Math.max(3, Math.floor(3 + arousal * 7));
    const len = Math.min(targetLen, maxWords);
    const allWords = Array.from(dictionary._words.entries());
    if (allWords.length === 0) return '';

    // Sort by frequency for Zipf ranking
    allWords.sort((a, b) => (b[1].frequency || 1) - (a[1].frequency || 1));

    // Score each word for position 0
    const startScores = allWords.map(([word, entry], rank) => {
      const zipf = this.zipfProb(rank);
      const posProb = this._getPositionProb(word, 0);
      const moodDist = Math.abs((entry.arousal || 0.5) - arousal) + Math.abs((entry.valence || 0) - valence);
      const moodBias = Math.exp(-moodDist);
      const score = zipf * 0.3 + posProb * 0.3 + moodBias * 0.4;
      return { word, entry, score };
    });

    const startPick = this._softmaxSample(startScores, temperature);
    const sentence = [startPick.word];
    let prevWord = startPick.word;

    // Generate each subsequent word
    for (let pos = 1; pos < len; pos++) {
      const candidates = allWords
        .filter(([w]) => w !== prevWord) // no immediate repeat
        .map(([word, entry], rank) => {
          // P(w | prev) — conditional probability from learned pairs
          const condProb = this._getConditionalProb(word, prevWord);

          // P(w | position) — what words go at this position
          const posProb = this._getPositionProb(word, pos);

          // Zipf(rank) — frequency bias
          const zipf = this.zipfProb(rank);

          // Mutual information — how strongly associated with previous word
          const mi = Math.max(0, this.mutualInfo(prevWord, word));

          // Mood alignment
          const moodDist = Math.abs((entry.arousal || 0.5) - arousal) + Math.abs((entry.valence || 0) - valence);
          const moodBias = Math.exp(-moodDist);

          // Combined score: all equations weighted
          const score = condProb * 0.25 + posProb * 0.15 + zipf * 0.15 + mi * 0.2 + moodBias * 0.25;
          return { word, entry, score };
        });

      const picked = this._softmaxSample(candidates, temperature);
      if (picked) {
        sentence.push(picked.word);
        prevWord = picked.word;
      }
    }

    this.wordsProcessed += sentence.length;
    return sentence.join(' ');
  }

  _getPositionProb(word, position) {
    const pos = Math.min(position, 14);
    const count = this._positionCounts[pos]?.get(word) || 0;
    const total = this._positionTotals[pos] || 1;
    return count / total;
  }

  _softmaxSample(scored, temperature) {
    if (scored.length === 0) return null;
    const maxScore = Math.max(...scored.map(s => s.score));
    const exps = scored.map(s => Math.exp((s.score - maxScore) / Math.max(0.01, temperature)));
    const sum = exps.reduce((a, b) => a + b, 0);
    let rand = Math.random() * sum;
    for (let i = 0; i < scored.length; i++) {
      rand -= exps[i];
      if (rand <= 0) return scored[i];
    }
    return scored[scored.length - 1];
  }

  // ── Learning ────────────────────────────────────────────────────

  /**
   * Learn from a sentence — updates ALL linguistic equation parameters:
   *
   * Joint counts     → P(w1, w2) for mutual information
   * Marginal counts  → P(w) for Zipf and surprisal
   * Position counts  → P(w | position) for sentence structure
   * Prediction weights → ΔW = η · (actual - predicted) · input^T
   */
  learnSentence(sentence, dictionary, arousal, valence) {
    const words = sentence.toLowerCase().replace(/[^a-z' -]/g, '').split(/\s+/).filter(w => w.length >= 2);
    if (words.length < 2) return;

    const lr = 0.01;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];

      // Update marginal counts → P(w)
      this._marginalCounts.set(word, (this._marginalCounts.get(word) || 0) + 1);
      this._totalWords++;

      // Update position counts → P(w | position)
      const pos = Math.min(i, 14);
      this._positionCounts[pos].set(word, (this._positionCounts[pos].get(word) || 0) + 1);
      this._positionTotals[pos]++;

      // Update joint counts → P(w1, w2)
      if (i < words.length - 1) {
        const next = words[i + 1];
        if (!this._jointCounts.has(word)) this._jointCounts.set(word, new Map());
        const inner = this._jointCounts.get(word);
        inner.set(next, (inner.get(next) || 0) + 1);
        this._totalPairs++;
      }

      // Update prediction weights: ΔW = η · error · input^T
      if (i < words.length - 1) {
        const currentEntry = dictionary._words.get(word);
        const nextEntry = dictionary._words.get(words[i + 1]);
        if (currentEntry && nextEntry) {
          const cp = currentEntry.pattern || this.wordToPattern(word);
          const np = nextEntry.pattern || this.wordToPattern(words[i + 1]);
          for (let r = 0; r < PATTERN_DIM; r++) {
            const predicted = this._dotRow(r, cp);
            const error = np[r] - predicted;
            for (let c = 0; c < PATTERN_DIM; c++) {
              this._predWeights[r * PATTERN_DIM + c] += lr * error * cp[c];
            }
          }
        }
      }

      // Learn word into dictionary with letter-derived pattern
      const pattern = this.wordToPattern(word);
      dictionary.learnWord(word, pattern, arousal, valence);
      if (i < words.length - 1) dictionary.learnBigram(word, words[i + 1]);
    }

    // Update Zipf alpha from observed distribution
    this._updateZipfAlpha();
    this.sentencesLearned++;
  }

  _dotRow(row, vec) {
    let sum = 0;
    const base = row * PATTERN_DIM;
    for (let j = 0; j < PATTERN_DIM; j++) sum += this._predWeights[base + j] * vec[j];
    return sum;
  }

  /**
   * Estimate Zipf's alpha from observed word frequencies.
   * α = -slope of log(frequency) vs log(rank)
   */
  _updateZipfAlpha() {
    if (this._marginalCounts.size < 10) return;
    const freqs = Array.from(this._marginalCounts.values()).sort((a, b) => b - a);
    // Linear regression on log-log scale (top 20 words)
    const n = Math.min(20, freqs.length);
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      const x = Math.log(i + 1);
      const y = Math.log(freqs[i]);
      sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    this.zipfAlpha = Math.max(0.5, Math.min(2.0, -slope));
  }

  // ── Persistence ─────────────────────────────────────────────────

  serialize() {
    const joints = {};
    for (const [w1, inner] of this._jointCounts) {
      joints[w1] = Object.fromEntries(inner);
    }
    const positions = this._positionCounts.map(m => Object.fromEntries(m));
    return {
      jointCounts: joints,
      marginalCounts: Object.fromEntries(this._marginalCounts),
      totalPairs: this._totalPairs,
      totalWords: this._totalWords,
      positionCounts: positions,
      positionTotals: Array.from(this._positionTotals),
      predWeights: Array.from(this._predWeights),
      zipfAlpha: this.zipfAlpha,
      sentencesLearned: this.sentencesLearned,
      wordsProcessed: this.wordsProcessed,
    };
  }

  deserialize(data) {
    if (!data) return;
    if (data.jointCounts) {
      for (const [w1, inner] of Object.entries(data.jointCounts)) {
        this._jointCounts.set(w1, new Map(Object.entries(inner).map(([k, v]) => [k, Number(v)])));
      }
    }
    if (data.marginalCounts) this._marginalCounts = new Map(Object.entries(data.marginalCounts).map(([k, v]) => [k, Number(v)]));
    this._totalPairs = data.totalPairs || 0;
    this._totalWords = data.totalWords || 0;
    if (data.positionCounts) {
      for (let i = 0; i < Math.min(data.positionCounts.length, 15); i++) {
        this._positionCounts[i] = new Map(Object.entries(data.positionCounts[i] || {}).map(([k, v]) => [k, Number(v)]));
      }
    }
    if (data.positionTotals) this._positionTotals = new Float64Array(data.positionTotals);
    if (data.predWeights) this._predWeights = new Float64Array(data.predWeights);
    this.zipfAlpha = data.zipfAlpha || 1.0;
    this.sentencesLearned = data.sentencesLearned || 0;
    this.wordsProcessed = data.wordsProcessed || 0;
  }

  getLetterPattern(char) {
    const li = char.toLowerCase().charCodeAt(0) - 97;
    if (li < 0 || li > 25) return new Float64Array(5);
    return this._letterPatterns.slice(li * 5, li * 5 + 5);
  }
}
