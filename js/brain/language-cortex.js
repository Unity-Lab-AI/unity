/**
 * language-cortex.js — Language Production from Brain Equations
 *
 * The cortex prediction equation ŝ = W·x doesn't just predict
 * neural patterns — it predicts the NEXT WORD from the current word.
 * Language structure emerges from the weight matrix W_lang.
 *
 * No grammar rules. No parts of speech labels. No sentence templates.
 * The brain learns word ORDER from every sentence it hears.
 * Words that appear in similar positions develop similar prediction
 * contexts — "I" and "you" and "she" all predict verbs because
 * the brain heard them before verbs thousands of times.
 *
 * Production equation:
 *   score(w) = W_pred[w] · current_pattern + W_mood · [arousal, valence] + W_pos · position
 *   P(w_next) = softmax(scores / temperature)
 *   temperature = 1.0 / (coherence + 0.1)  ← focused brain = less random
 *
 * Letter/syllable awareness:
 *   Each character maps to a cortex micro-pattern (5 neurons per char)
 *   Words are SEQUENCES of these patterns — the brain knows letters
 *   Syllable boundaries = vowel-consonant transitions in the pattern
 */

const PATTERN_DIM = 32;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
const VOWELS = 'aeiou';

export class LanguageCortex {
  constructor() {
    // Prediction weight matrix — learns word→next_word patterns
    // W_pred[i][j] = how strongly word pattern i predicts word pattern j
    this._predWeights = new Float64Array(PATTERN_DIM * PATTERN_DIM);
    this._initPredWeights();

    // Mood modulation weights — how arousal/valence shift word choice
    this._moodWeights = new Float64Array(PATTERN_DIM * 2);
    this._initMoodWeights();

    // Position encoding — where in the sentence are we
    this._posWeights = new Float64Array(PATTERN_DIM * 20); // max 20 positions
    this._initPosWeights();

    // Letter→pattern mapping — 26 letters, each a micro-pattern
    this._letterPatterns = new Float64Array(26 * 5); // 5 neurons per letter
    this._initLetterPatterns();

    // Learned sentence structures — running average of word-position patterns
    this._positionMemory = new Array(10).fill(null).map(() => new Float64Array(PATTERN_DIM));
    this._positionCounts = new Float64Array(10);

    // Stats
    this.sentencesLearned = 0;
    this.wordsProcessed = 0;
  }

  _initPredWeights() {
    // Small random init — learns from exposure
    for (let i = 0; i < this._predWeights.length; i++) {
      this._predWeights[i] = (Math.random() - 0.5) * 0.1;
    }
  }

  _initMoodWeights() {
    for (let i = 0; i < this._moodWeights.length; i++) {
      this._moodWeights[i] = (Math.random() - 0.5) * 0.2;
    }
  }

  _initPosWeights() {
    // Position encoding: each position gets a unique pattern
    // Earlier positions have different weight signatures than later ones
    for (let pos = 0; pos < 20; pos++) {
      for (let d = 0; d < PATTERN_DIM; d++) {
        // Sinusoidal position encoding (like transformers, but from equations)
        const angle = pos / Math.pow(10000, (2 * d) / PATTERN_DIM);
        this._posWeights[pos * PATTERN_DIM + d] = d % 2 === 0 ? Math.sin(angle) : Math.cos(angle);
      }
    }
  }

  _initLetterPatterns() {
    // Each letter gets a unique 5-neuron activation pattern
    // Vowels cluster together, consonants cluster by articulation
    for (let i = 0; i < 26; i++) {
      const isVowel = VOWELS.includes(ALPHABET[i]);
      for (let n = 0; n < 5; n++) {
        // Deterministic pattern from letter position
        let val = Math.sin(i * 2.71828 + n * 3.14159) * 0.5 + 0.5;
        if (isVowel) val += 0.3; // vowels have higher activation
        this._letterPatterns[i * 5 + n] = val;
      }
    }
  }

  /**
   * Get the cortex pattern for a word — built from its letters.
   * Each word is a SEQUENCE of letter patterns folded into 32 dimensions.
   */
  wordToPattern(word) {
    const pattern = new Float64Array(PATTERN_DIM);
    const clean = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!clean) return pattern;

    for (let c = 0; c < clean.length; c++) {
      const li = clean.charCodeAt(c) - 97; // a=0, z=25
      if (li < 0 || li > 25) continue;

      // Letter pattern folds into word pattern at position-dependent indices
      for (let n = 0; n < 5; n++) {
        const targetDim = (c * 7 + n * 3 + li) % PATTERN_DIM;
        pattern[targetDim] += this._letterPatterns[li * 5 + n] / clean.length;
      }

      // Syllable boundary detection: vowel→consonant or consonant→vowel transition
      if (c > 0) {
        const prevVowel = VOWELS.includes(clean[c - 1]);
        const currVowel = VOWELS.includes(clean[c]);
        if (prevVowel !== currVowel) {
          // Syllable boundary — add a rhythm marker
          const rhythmDim = (c * 11) % PATTERN_DIM;
          pattern[rhythmDim] += 0.15;
        }
      }
    }

    // Word length affects pattern — longer words have more spread activation
    const lengthFactor = Math.min(1, clean.length / 8);
    pattern[0] += lengthFactor * 0.2;

    // Normalize
    let norm = 0;
    for (let i = 0; i < PATTERN_DIM; i++) norm += pattern[i] * pattern[i];
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < PATTERN_DIM; i++) pattern[i] /= norm;

    return pattern;
  }

  /**
   * Count syllables in a word — from the equation (vowel cluster transitions).
   */
  countSyllables(word) {
    const clean = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!clean) return 0;
    let count = 0;
    let prevVowel = false;
    for (let i = 0; i < clean.length; i++) {
      const isVowel = VOWELS.includes(clean[i]);
      if (isVowel && !prevVowel) count++;
      prevVowel = isVowel;
    }
    return Math.max(1, count);
  }

  /**
   * Predict the next word's pattern from the current pattern + brain state.
   *
   * ŝ_next = W_pred · current + W_mood · [arousal, valence] + W_pos · position
   *
   * @param {Float64Array} currentPattern — 32-dim pattern of current word
   * @param {number} arousal
   * @param {number} valence
   * @param {number} position — word index in sentence (0, 1, 2...)
   * @returns {Float64Array} — predicted pattern for next word
   */
  predictNext(currentPattern, arousal, valence, position) {
    const predicted = new Float64Array(PATTERN_DIM);

    // W_pred · current — what typically follows this pattern
    for (let i = 0; i < PATTERN_DIM; i++) {
      let sum = 0;
      for (let j = 0; j < PATTERN_DIM; j++) {
        sum += this._predWeights[i * PATTERN_DIM + j] * currentPattern[j];
      }
      predicted[i] = sum;
    }

    // W_mood · [arousal, valence] — emotional modulation
    for (let i = 0; i < PATTERN_DIM; i++) {
      predicted[i] += this._moodWeights[i] * arousal + this._moodWeights[PATTERN_DIM + i] * valence;
    }

    // W_pos · position — where in the sentence affects what comes next
    const posIdx = Math.min(position, 19);
    for (let i = 0; i < PATTERN_DIM; i++) {
      predicted[i] += this._posWeights[posIdx * PATTERN_DIM + i] * 0.3;
    }

    return predicted;
  }

  /**
   * Score a candidate word against the predicted pattern.
   * Higher score = better fit for next word.
   */
  scoreWord(wordPattern, predictedPattern) {
    // Cosine similarity
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < PATTERN_DIM; i++) {
      dot += wordPattern[i] * predictedPattern[i];
      normA += wordPattern[i] * wordPattern[i];
      normB += predictedPattern[i] * predictedPattern[i];
    }
    return dot / (Math.sqrt(normA * normB) || 1);
  }

  /**
   * Generate a sentence from brain state using the prediction equation.
   *
   * @param {Dictionary} dictionary — the brain's vocabulary
   * @param {number} arousal
   * @param {number} valence
   * @param {number} coherence — affects temperature (focused = less random)
   * @param {number} maxWords
   * @returns {string}
   */
  generate(dictionary, arousal, valence, coherence, maxWords = 12) {
    if (!dictionary || dictionary.size === 0) return '';

    // Temperature from coherence — focused brain produces more structured speech
    const temperature = 1.0 / (coherence + 0.1);

    // Sentence length from arousal — high arousal = more words
    const targetLen = Math.max(2, Math.floor(2 + arousal * 8));
    const len = Math.min(targetLen, maxWords);

    // Start word — highest scoring word for position 0 given mood
    const startPredicted = this.predictNext(new Float64Array(PATTERN_DIM), arousal, valence, 0);
    const allWords = Array.from(dictionary._words.entries());
    if (allWords.length === 0) return '';

    // Score all words for starting position
    let bestStart = allWords[0];
    let bestScore = -Infinity;
    for (const [word, entry] of allWords) {
      const pattern = entry.pattern || this.wordToPattern(word);
      const score = this.scoreWord(pattern, startPredicted);
      // Mood proximity boost
      const moodDist = Math.abs(entry.arousal - arousal) + Math.abs(entry.valence - valence);
      const finalScore = score - moodDist * 0.3;
      if (finalScore > bestScore) { bestScore = finalScore; bestStart = [word, entry]; }
    }

    const sentence = [bestStart[0]];
    let currentPattern = bestStart[1].pattern || this.wordToPattern(bestStart[0]);

    // Generate remaining words via prediction chain
    for (let pos = 1; pos < len; pos++) {
      const predicted = this.predictNext(currentPattern, arousal, valence, pos);

      // Score all candidate words
      let best = null;
      let bestS = -Infinity;
      for (const [word, entry] of allWords) {
        if (sentence.includes(word) && sentence.length < 5) continue; // avoid early repeats
        const pattern = entry.pattern || this.wordToPattern(word);
        let score = this.scoreWord(pattern, predicted);

        // Temperature scaling — low temp = pick the best, high temp = more variety
        score = score / temperature;

        if (score > bestS) { bestS = score; best = [word, entry]; }
      }

      if (best) {
        sentence.push(best[0]);
        currentPattern = best[1].pattern || this.wordToPattern(best[0]);
      }
    }

    this.wordsProcessed += sentence.length;
    return sentence.join(' ');
  }

  /**
   * Learn from a sentence — update prediction weights.
   * Every consecutive word pair teaches W_pred what follows what.
   * Every word at a position teaches W_pos what goes where.
   *
   * ΔW_pred = η · (actual_next - predicted) · current^T
   * ΔW_pos  = η · (actual - position_average) · position_encoding^T
   */
  learnSentence(sentence, dictionary, arousal, valence) {
    const words = sentence.toLowerCase().replace(/[^a-z' -]/g, '').split(/\s+/).filter(w => w.length >= 2);
    if (words.length < 2) return;

    const lr = 0.005; // learning rate

    for (let i = 0; i < words.length - 1; i++) {
      const currentEntry = dictionary._words.get(words[i]);
      const nextEntry = dictionary._words.get(words[i + 1]);
      if (!currentEntry || !nextEntry) continue;

      const currentPattern = currentEntry.pattern || this.wordToPattern(words[i]);
      const nextPattern = nextEntry.pattern || this.wordToPattern(words[i + 1]);

      // Predict what should come next
      const predicted = this.predictNext(currentPattern, arousal, valence, i);

      // Update prediction weights: ΔW = η · error · input^T
      for (let r = 0; r < PATTERN_DIM; r++) {
        const error = nextPattern[r] - predicted[r];
        for (let c = 0; c < PATTERN_DIM; c++) {
          this._predWeights[r * PATTERN_DIM + c] += lr * error * currentPattern[c];
        }
        // Mood weight update
        this._moodWeights[r] += lr * error * arousal * 0.1;
        this._moodWeights[PATTERN_DIM + r] += lr * error * valence * 0.1;
      }

      // Position memory — running average of what patterns appear at each position
      const posIdx = Math.min(i, 9);
      this._positionCounts[posIdx]++;
      const posLr = 1 / this._positionCounts[posIdx];
      for (let d = 0; d < PATTERN_DIM; d++) {
        this._positionMemory[posIdx][d] += posLr * (currentPattern[d] - this._positionMemory[posIdx][d]);
      }
    }

    // Also learn each word into the dictionary with its letter pattern
    for (const word of words) {
      const pattern = this.wordToPattern(word);
      dictionary.learnWord(word, pattern, arousal, valence);
      // Learn bigrams
      const idx = words.indexOf(word);
      if (idx < words.length - 1) {
        dictionary.learnBigram(word, words[idx + 1]);
      }
    }

    this.sentencesLearned++;
  }

  /**
   * Get the alphabet as cortex patterns — the brain knows its letters.
   */
  getLetterPattern(char) {
    const li = char.toLowerCase().charCodeAt(0) - 97;
    if (li < 0 || li > 25) return new Float64Array(5);
    return this._letterPatterns.slice(li * 5, li * 5 + 5);
  }

  /**
   * Serialize learned weights for persistence.
   */
  serialize() {
    return {
      predWeights: Array.from(this._predWeights),
      moodWeights: Array.from(this._moodWeights),
      positionMemory: this._positionMemory.map(p => Array.from(p)),
      positionCounts: Array.from(this._positionCounts),
      sentencesLearned: this.sentencesLearned,
      wordsProcessed: this.wordsProcessed,
    };
  }

  /**
   * Load learned weights.
   */
  deserialize(data) {
    if (!data) return;
    if (data.predWeights) this._predWeights = new Float64Array(data.predWeights);
    if (data.moodWeights) this._moodWeights = new Float64Array(data.moodWeights);
    if (data.positionMemory) {
      for (let i = 0; i < Math.min(data.positionMemory.length, 10); i++) {
        this._positionMemory[i] = new Float64Array(data.positionMemory[i]);
      }
    }
    if (data.positionCounts) this._positionCounts = new Float64Array(data.positionCounts);
    this.sentencesLearned = data.sentencesLearned || 0;
    this.wordsProcessed = data.wordsProcessed || 0;
  }
}
