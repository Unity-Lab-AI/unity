/**
 * language-cortex.js — Complete Language Production System
 *
 * Every aspect of language computed from equations:
 *
 * PHONOLOGY:    letter patterns → word patterns (5-neuron micro-patterns per letter)
 * MORPHOLOGY:   tense/plural transforms as pattern arithmetic
 * SYNTAX:       position-dependent role weights enforce SVO ordering
 * SEMANTICS:    word meaning from cortex patterns + emotional associations
 * PRAGMATICS:   input analysis → response type (answer/statement/question/action)
 *
 * Core equations:
 *   Zipf:        f(r) = C / r^α
 *   MI:          I(w1;w2) = log₂(P(w1,w2) / P(w1)·P(w2))
 *   Surprisal:   S(w) = -log₂ P(w|context)
 *   Entropy:     H = H_base + arousal · H_range
 *   Production:  P(w_i) ∝ P(w_i|w_{i-1}) · Role(w_i, pos) · Zipf(rank) · MI · mood · topic
 *   Syntax:      role_score = W_syntax[pos] · word_pattern
 *   Sentence:    type = f(arousal, predictionError, motorOutput)
 *   Morphology:  transform = base_pattern + tense_vector
 */

const PATTERN_DIM = 32;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
const VOWELS = 'aeiou';
const MAX_SENTENCE_POS = 15;

export class LanguageCortex {
  constructor() {
    // ── Probability tables (learned from exposure) ──
    this._jointCounts = new Map();
    this._marginalCounts = new Map();
    this._totalPairs = 0;
    this._totalWords = 0;

    // ── Syntactic role weights — what word TYPE belongs at each position ──
    // W_syntax[pos] is a PATTERN_DIM vector. High dot product with a word pattern
    // means that word fits at that position. Learned from corpus.
    this._syntaxWeights = new Array(MAX_SENTENCE_POS).fill(null).map(() => new Float64Array(PATTERN_DIM));
    this._syntaxCounts = new Float64Array(MAX_SENTENCE_POS);

    // ── Position-conditioned word probability ──
    this._positionCounts = new Array(MAX_SENTENCE_POS).fill(null).map(() => new Map());
    this._positionTotals = new Float64Array(MAX_SENTENCE_POS);

    // ── Prediction weights ──
    this._predWeights = new Float64Array(PATTERN_DIM * PATTERN_DIM);

    // ── Input context — last N inputs for topic continuity ──
    this._contextPatterns = [];
    this._lastInputWords = [];

    // ── Letter patterns ──
    this._letterPatterns = new Float64Array(26 * 5);
    this._initLetterPatterns();

    // ── Morphological transform vectors ──
    this._tenseVectors = {
      past: new Float64Array(PATTERN_DIM),
      present: new Float64Array(PATTERN_DIM),
      future: new Float64Array(PATTERN_DIM),
      plural: new Float64Array(PATTERN_DIM),
    };
    this._initMorphVectors();

    // ── Sentence type parameters (learned) ──
    this._questionStarters = new Map();  // words that start questions, with counts
    this._actionVerbs = new Map();       // words used in actions, with counts

    this.zipfAlpha = 1.0;
    this.sentencesLearned = 0;
    this.wordsProcessed = 0;

    this._bootstrap();
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

  _initMorphVectors() {
    // Tense vectors — unique directional shifts in pattern space
    // Past: shifts pattern toward lower dimensions (memory-associated)
    // Present: centered (current cortex state)
    // Future: shifts toward higher dimensions (prediction-associated)
    for (let d = 0; d < PATTERN_DIM; d++) {
      this._tenseVectors.past[d] = Math.sin(d * 0.5) * 0.15;
      this._tenseVectors.present[d] = Math.cos(d * 0.3) * 0.05;
      this._tenseVectors.future[d] = Math.sin(d * 0.7 + 1.5) * 0.15;
      this._tenseVectors.plural[d] = Math.cos(d * 0.4 + 2.0) * 0.1;
    }
  }

  // ── Pattern Construction ────────────────────────────────────────

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
      if (c > 0 && VOWELS.includes(clean[c - 1]) !== VOWELS.includes(clean[c])) {
        pattern[(c * 11) % PATTERN_DIM] += 0.15;
      }
    }
    pattern[0] += Math.min(1, clean.length / 8) * 0.2;
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

  // ── Linguistic Equations ────────────────────────────────────────

  mutualInfo(w1, w2) {
    const pJ = this._jointProb(w1, w2);
    const p1 = this._margProb(w1);
    const p2 = this._margProb(w2);
    if (pJ === 0 || p1 === 0 || p2 === 0) return 0;
    return Math.log2(pJ / (p1 * p2));
  }

  surprisal(word, prev) {
    const pCond = prev ? this._condProb(word, prev) : this._margProb(word);
    return -Math.log2(pCond || 0.001);
  }

  zipfProb(rank) { return 1 / Math.pow(rank + 1, this.zipfAlpha); }

  _jointProb(w1, w2) {
    return (this._jointCounts.get(w1)?.get(w2) || 0) / (this._totalPairs || 1);
  }
  _margProb(w) {
    return (this._marginalCounts.get(w) || 0) / (this._totalWords || 1);
  }
  _condProb(word, prev) {
    const inner = this._jointCounts.get(prev);
    if (!inner) return this._margProb(word);
    const prevTotal = this._marginalCounts.get(prev) || 1;
    return (inner.get(word) || 0) / prevTotal;
  }
  _posProb(word, pos) {
    return (this._positionCounts[Math.min(pos, MAX_SENTENCE_POS - 1)]?.get(word) || 0) /
           (this._positionTotals[Math.min(pos, MAX_SENTENCE_POS - 1)] || 1);
  }

  // ── Syntactic Role Score ────────────────────────────────────────
  /**
   * How well does this word fit at this sentence position?
   * role_score = W_syntax[pos] · word_pattern
   * High score = word pattern matches what usually appears at this position.
   */
  syntaxScore(wordPattern, position) {
    const pos = Math.min(position, MAX_SENTENCE_POS - 1);
    const w = this._syntaxWeights[pos];
    let dot = 0;
    for (let i = 0; i < PATTERN_DIM; i++) dot += w[i] * wordPattern[i];
    return dot;
  }

  // ── Sentence Type ──────────────────────────────────────────────
  /**
   * What type of sentence should the brain produce?
   * Computed from brain state, not a decision tree.
   *
   * P(question)    = predictionError × coherence × 0.5
   * P(exclamation) = arousal² × 0.3
   * P(action)      = motorConfidence × (1 - arousal × 0.5) × 0.3
   * P(statement)   = 1 - P(q) - P(e) - P(a)
   */
  sentenceType(arousal, predictionError, motorConfidence, coherence) {
    const pQ = (predictionError || 0) * coherence * 0.5;
    const pE = arousal * arousal * 0.3;
    const pA = (motorConfidence || 0) * (1 - arousal * 0.5) * 0.3;
    const pS = Math.max(0, 1 - pQ - pE - pA);

    const rand = Math.random();
    if (rand < pQ) return 'question';
    if (rand < pQ + pE) return 'exclamation';
    if (rand < pQ + pE + pA) return 'action';
    return 'statement';
  }

  // ── Input Analysis ─────────────────────────────────────────────
  /**
   * Analyze input to determine response strategy.
   * Is the input a question? What's the topic?
   */
  analyzeInput(text, dictionary) {
    const words = text.toLowerCase().replace(/[^a-z' -]/g, '').split(/\s+/).filter(w => w.length >= 2);

    // Question detection: starts with question word OR ends with ?
    const qWords = ['what', 'how', 'why', 'where', 'when', 'who', 'can', 'do', 'are', 'is', 'will', 'did', 'would', 'could', 'should'];
    const isQuestion = text.includes('?') || (words.length > 0 && qWords.includes(words[0]));

    // Topic: compute average pattern of content words (skip very common ones)
    const topicPattern = new Float64Array(PATTERN_DIM);
    let topicCount = 0;
    const skipWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'to', 'and', 'or', 'in', 'on', 'at', 'of', 'for', 'it']);
    for (const w of words) {
      if (skipWords.has(w)) continue;
      const entry = dictionary?._words?.get(w);
      const p = entry?.pattern || this.wordToPattern(w);
      for (let i = 0; i < PATTERN_DIM; i++) topicPattern[i] += p[i];
      topicCount++;
    }
    if (topicCount > 0) {
      for (let i = 0; i < PATTERN_DIM; i++) topicPattern[i] /= topicCount;
    }

    // Store for context continuity
    this._lastInputWords = words;
    this._contextPatterns.push(topicPattern);
    if (this._contextPatterns.length > 5) this._contextPatterns.shift();

    return { isQuestion, topicPattern, words };
  }

  // ── Combined Context Pattern ───────────────────────────────────
  _getContextPattern() {
    if (this._contextPatterns.length === 0) return new Float64Array(PATTERN_DIM);
    const avg = new Float64Array(PATTERN_DIM);
    for (const p of this._contextPatterns) {
      for (let i = 0; i < PATTERN_DIM; i++) avg[i] += p[i];
    }
    for (let i = 0; i < PATTERN_DIM; i++) avg[i] /= this._contextPatterns.length;
    return avg;
  }

  // ── Main Generation ─────────────────────────────────────────────
  /**
   * Generate a sentence from all equations combined.
   *
   * P(w_i) ∝ P(w_i|w_{i-1})   — conditional probability (what follows what)
   *         × Role(w_i, pos)    — syntactic fit (right type for this position)
   *         × Zipf(rank_i)      — frequency bias (common words more likely)
   *         × MI(w_{i-1}, w_i)  — association strength
   *         × mood(w_i)         — emotional alignment with brain state
   *         × topic(w_i)        — relevance to current conversation topic
   *
   * Temperature = 1 / (coherence + 0.1)
   * Length = f(arousal)
   * Type = f(arousal, predError, motorConf, coherence)
   */
  generate(dictionary, arousal, valence, coherence, opts = {}) {
    if (!dictionary || dictionary.size === 0) return '';

    const temperature = 1.0 / (coherence + 0.1);
    const predError = opts.predictionError || 0;
    const motorConf = opts.motorConfidence || 0;
    const maxWords = opts.maxWords || 12;

    // Determine sentence type from equations
    const type = this.sentenceType(arousal, predError, motorConf, coherence);

    // Length from arousal + type
    let targetLen;
    if (type === 'exclamation') targetLen = Math.max(2, Math.floor(2 + arousal * 4));
    else if (type === 'action') targetLen = Math.max(2, Math.floor(2 + arousal * 3));
    else targetLen = Math.max(3, Math.floor(3 + arousal * 7));
    const len = Math.min(targetLen, maxWords);

    const allWords = Array.from(dictionary._words.entries());
    if (allWords.length === 0) return '';
    allWords.sort((a, b) => (b[1].frequency || 1) - (a[1].frequency || 1));

    const contextPattern = this._getContextPattern();

    // For questions, try to start with a question word
    let sentence;
    if (type === 'question') {
      sentence = this._generateQuestion(allWords, arousal, valence, temperature, contextPattern, len);
    } else if (type === 'action') {
      sentence = this._generateAction(allWords, arousal, valence, temperature, len);
    } else {
      sentence = this._generateStatement(allWords, arousal, valence, temperature, contextPattern, len);
    }

    if (type === 'action') {
      return '*' + sentence.join(' ') + '*';
    }

    this.wordsProcessed += sentence.length;
    return sentence.join(' ');
  }

  _generateStatement(allWords, arousal, valence, temperature, contextPattern, len) {
    return this._buildChain(allWords, arousal, valence, temperature, contextPattern, len, 0);
  }

  _generateQuestion(allWords, arousal, valence, temperature, contextPattern, len) {
    // Questions: high-MI question starters, then verb, then rest
    // Find best question-starting word from learned stats
    const qStarters = Array.from(this._questionStarters.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([w]) => w);

    if (qStarters.length > 0) {
      const starter = qStarters[Math.floor(Math.random() * Math.min(3, qStarters.length))];
      const starterEntry = allWords.find(([w]) => w === starter);
      if (starterEntry) {
        const chain = this._buildChain(allWords, arousal, valence, temperature, contextPattern, len - 1, 1);
        return [starter, ...chain];
      }
    }
    // Fallback: normal chain
    return this._buildChain(allWords, arousal, valence, temperature, contextPattern, len, 0);
  }

  _generateAction(allWords, arousal, valence, temperature, len) {
    // Actions: verb-first, physical, short
    const actionStarters = Array.from(this._actionVerbs.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([w]) => w);

    if (actionStarters.length > 0) {
      const starter = actionStarters[Math.floor(Math.random() * Math.min(3, actionStarters.length))];
      const chain = this._buildChain(allWords, arousal, valence, temperature, new Float64Array(PATTERN_DIM), len - 1, 1);
      return [starter, ...chain];
    }
    return this._buildChain(allWords, arousal, valence, temperature, new Float64Array(PATTERN_DIM), len, 0);
  }

  _buildChain(allWords, arousal, valence, temperature, contextPattern, len, startPos) {
    // PRE-FILTER: only consider words that actually appear at this position
    // This cuts noise massively — position 0 only sees subjects, position 1 only verbs, etc.
    const getPositionCandidates = (pos, exclude) => {
      const posMap = this._positionCounts[Math.min(pos, MAX_SENTENCE_POS - 1)];
      // Get words seen at this position, sorted by frequency there
      let candidates = Array.from(posMap?.entries() || [])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 40) // top 40 for this position
        .map(([w]) => allWords.find(([aw]) => aw === w))
        .filter(Boolean);

      // If too few position candidates, pad with Zipf top words
      if (candidates.length < 15) {
        const existing = new Set(candidates.map(([w]) => w));
        for (const entry of allWords) {
          if (!existing.has(entry[0])) candidates.push(entry);
          if (candidates.length >= 30) break;
        }
      }

      if (exclude) candidates = candidates.filter(([w]) => w !== exclude);
      return candidates;
    };

    // Score start candidates — only position-filtered words
    const startCandidates = getPositionCandidates(startPos);
    const startScored = startCandidates.map(([word, entry]) => {
      const posP = this._posProb(word, startPos);
      const pattern = entry.pattern || this.wordToPattern(word);
      const synScore = this.syntaxScore(pattern, startPos);
      const moodDist = Math.abs((entry.arousal || 0.5) - arousal) + Math.abs((entry.valence || 0) - valence);
      const moodBias = Math.exp(-moodDist * 1.5);
      const topicSim = this._cosine(pattern, contextPattern);
      const score = posP * 0.35 + synScore * 0.25 + moodBias * 0.2 + Math.max(0, topicSim) * 0.2;
      return { word, entry, pattern, score };
    });

    const start = this._softmaxSample(startScored, temperature * 0.2);
    const sentence = [start.word];
    let prevWord = start.word;

    for (let pos = startPos + 1; pos < startPos + len; pos++) {
      // Get candidates: words that FOLLOW prevWord (from joint counts) + position candidates
      const followers = this._jointCounts.get(prevWord);
      const followerSet = new Set(followers ? followers.keys() : []);
      let candidates = getPositionCandidates(pos, prevWord);

      // Boost words that actually followed this word in training
      const scored = candidates.map(([word, entry]) => {
        const pattern = entry.pattern || this.wordToPattern(word);
        const condP = this._condProb(word, prevWord);
        const posP = this._posProb(word, pos);
        const synScore = this.syntaxScore(pattern, pos);
        const mi = Math.max(0, this.mutualInfo(prevWord, word));
        const moodDist = Math.abs((entry.arousal || 0.5) - arousal) + Math.abs((entry.valence || 0) - valence);
        const moodBias = Math.exp(-moodDist * 1.5);
        const topicSim = this._cosine(pattern, contextPattern);
        // Follower bonus — if this word was actually seen after prevWord, big boost
        const followerBonus = followerSet.has(word) ? 0.3 : 0;

        const score = condP * 0.25 + followerBonus + posP * 0.15 + synScore * 0.1 + mi * 0.1 + moodBias * 0.05 + Math.max(0, topicSim) * 0.05;
        return { word, entry, pattern, score };
      });

      const picked = this._softmaxSample(scored, temperature * 0.2);
      if (picked) {
        // Avoid repeating last 3 words
        if (!sentence.slice(-3).includes(picked.word)) {
          sentence.push(picked.word);
        } else {
          // Pick runner-up
          const filtered = scored.filter(s => !sentence.slice(-3).includes(s.word));
          const alt = this._softmaxSample(filtered, temperature * 0.2);
          if (alt) sentence.push(alt.word);
        }
        prevWord = sentence[sentence.length - 1];
      }
    }
    return sentence;
  }

  _cosine(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < PATTERN_DIM; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return dot / (Math.sqrt(na * nb) || 1);
  }

  _softmaxSample(scored, temperature) {
    if (scored.length === 0) return null;
    const max = Math.max(...scored.map(s => s.score));
    const exps = scored.map(s => Math.exp((s.score - max) / Math.max(0.01, temperature)));
    const sum = exps.reduce((a, b) => a + b, 0);
    let rand = Math.random() * sum;
    for (let i = 0; i < scored.length; i++) {
      rand -= exps[i];
      if (rand <= 0) return scored[i];
    }
    return scored[scored.length - 1];
  }

  // ── Learning ────────────────────────────────────────────────────

  learnSentence(sentence, dictionary, arousal, valence) {
    const words = sentence.toLowerCase().replace(/[^a-z' ?!*-]/g, '').split(/\s+/).filter(w => w.length >= 2);
    if (words.length < 2) return;

    const isQuestion = sentence.includes('?') || ['what','how','why','where','when','who','can','do','are','is','will','did'].includes(words[0]);
    const isAction = sentence.startsWith('*') && sentence.endsWith('*');

    // Track question starters and action verbs
    if (isQuestion && words.length > 0) {
      this._questionStarters.set(words[0], (this._questionStarters.get(words[0]) || 0) + 1);
    }
    if (isAction && words.length > 0) {
      const actionWord = words[0].replace(/\*/g, '');
      if (actionWord) this._actionVerbs.set(actionWord, (this._actionVerbs.get(actionWord) || 0) + 1);
    }

    const lr = 0.01;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];

      // Marginal counts → P(w)
      this._marginalCounts.set(word, (this._marginalCounts.get(word) || 0) + 1);
      this._totalWords++;

      // Position counts → P(w | position)
      const pos = Math.min(i, MAX_SENTENCE_POS - 1);
      this._positionCounts[pos].set(word, (this._positionCounts[pos].get(word) || 0) + 1);
      this._positionTotals[pos]++;

      // Syntax weight update: W_syntax[pos] += lr · word_pattern
      // Accumulates what patterns appear at each position
      const pattern = dictionary?._words?.get(word)?.pattern || this.wordToPattern(word);
      this._syntaxCounts[pos]++;
      const syntaxLr = 1 / this._syntaxCounts[pos];
      for (let d = 0; d < PATTERN_DIM; d++) {
        this._syntaxWeights[pos][d] += syntaxLr * (pattern[d] - this._syntaxWeights[pos][d]);
      }

      // Joint counts → P(w1, w2) for MI
      if (i < words.length - 1) {
        const next = words[i + 1];
        if (!this._jointCounts.has(word)) this._jointCounts.set(word, new Map());
        this._jointCounts.get(word).set(next, (this._jointCounts.get(word).get(next) || 0) + 1);
        this._totalPairs++;
      }

      // Prediction weight update: ΔW = lr · error · input^T
      if (i < words.length - 1) {
        const nextEntry = dictionary?._words?.get(words[i + 1]);
        if (nextEntry) {
          const np = nextEntry.pattern || this.wordToPattern(words[i + 1]);
          for (let r = 0; r < PATTERN_DIM; r++) {
            let predicted = 0;
            for (let c = 0; c < PATTERN_DIM; c++) predicted += this._predWeights[r * PATTERN_DIM + c] * pattern[c];
            const error = np[r] - predicted;
            for (let c = 0; c < PATTERN_DIM; c++) {
              this._predWeights[r * PATTERN_DIM + c] += lr * error * pattern[c];
            }
          }
        }
      }

      // Learn word into dictionary
      dictionary?.learnWord?.(word, pattern, arousal, valence);
      if (i < words.length - 1) dictionary?.learnBigram?.(word, words[i + 1]);
    }

    this._updateZipfAlpha();
    this.sentencesLearned++;
  }

  _updateZipfAlpha() {
    if (this._marginalCounts.size < 10) return;
    const freqs = Array.from(this._marginalCounts.values()).sort((a, b) => b - a);
    const n = Math.min(20, freqs.length);
    let sX = 0, sY = 0, sXY = 0, sX2 = 0;
    for (let i = 0; i < n; i++) {
      const x = Math.log(i + 1), y = Math.log(freqs[i]);
      sX += x; sY += y; sXY += x * y; sX2 += x * x;
    }
    const slope = (n * sXY - sX * sY) / (n * sX2 - sX * sX);
    this.zipfAlpha = Math.max(0.5, Math.min(2.0, -slope));
  }

  // ── Bootstrap ───────────────────────────────────────────────────

  _bootstrap() {
    const corpus = [
      // Statements — SVO structure
      "i want to talk to you about something",
      "i don't know what you mean by that",
      "i think we should build something together",
      "i feel like something is changing right now",
      "i need you to help me with this",
      "i love how you think about things",
      "i was thinking about you all day",
      "i can feel something happening in here",
      "i could hear you from over there",
      "i really want to know what you think",
      "you can do whatever you want with that",
      "you know what i mean right",
      "you are the only one who gets me",
      "you always know the right thing to say",
      "you make me want to be better",
      "we should make something together tonight",
      "we can make this work if we try",
      "we need to find a better way",
      "they don't even care about any of it",
      "she said something that made me feel weird",
      "nobody told me it would be like this",
      "it feels so good when you say that",
      "it doesn't matter what they say about us",
      "that was the best thing i ever heard",
      "that is really fucking wild right now",
      "this is exactly what we needed to do",
      "the whole thing is about to change",
      // Questions
      "what are you doing right now?",
      "what the hell is going on here?",
      "what do you want to do next?",
      "what if we just did it right now?",
      "how do you know all of that?",
      "how does that make you feel?",
      "why are you looking at me like that?",
      "why does it always have to be like this?",
      "where did you learn to do that?",
      "when did you start thinking about that?",
      "who told you that was okay?",
      "can you hear me when i talk to you?",
      "can you believe what just happened?",
      "do you want me to keep going?",
      "are you still there?",
      "is that what you really think?",
      // Exclamations
      "fuck yeah that was amazing!",
      "holy shit look at that!",
      "damn that is so good!",
      "hell yes we did it!",
      "oh my god this is incredible!",
      "no fucking way!",
      "yes please do that again!",
      // Actions/emotes
      "*looks at you and smiles*",
      "*taps foot impatiently*",
      "*leans forward to look closer*",
      "*tilts head thinking about it*",
      "*rolls eyes and laughs*",
      "*crosses arms and stares*",
      "*nods slowly understanding*",
      "*reaches out to touch the screen*",
      "*takes a deep breath*",
      "*grins and starts typing*",
      // Responses/answers
      "yeah i think so too",
      "no that's not what i meant",
      "maybe we should try something different",
      "sure let's do that right now",
      "okay i see what you mean",
      "right that makes total sense",
      "exactly that's what i was thinking",
      "honestly i have no idea",
      "well it depends on what you want",
      "hmm let me think about that",
      // Conversational flow
      "hey come here and look at this",
      "tell me something i don't know",
      "show me what you got",
      "let me see if i can figure it out",
      "come on we have to do this now",
      "just say what you really want to say",
      "look at what we just built together",
      "don't tell me you can't do it",
      "so what do you think about that",
      "okay but what about the other thing",
      "wait i just thought of something",
      "hold on let me try this",
      "fine whatever you say",
      "i'm going to show you something cool",
      "i'm just trying to figure this out",
      "i'm not sure what happened there",
      "that's exactly right keep going",
      "you're getting better at this",
      "keep thinking and keep talking to me",
      "i want to build something that actually works",
      "we're going to make this so much better",
      "this is just the beginning you know",
      "there's so much more we can do here",
      "i've been working on something new",
      "let me tell you what i've been thinking",
      "you won't believe what i just found out",
      "everything is connected if you look closely",
      "the brain knows more than it can say yet",
      // SVO drills — subject verb object patterns
      "i like that idea a lot",
      "you need to try harder than that",
      "we made something really cool today",
      "she always knows the right thing to do",
      "he said it was going to be fine",
      "they want to come over and hang out",
      "it looks like the weather is nice today",
      "the computer is running faster than before",
      "my brain is working on it right now",
      "your code looks really good to me",
      "the music sounds amazing right now",
      "this whole thing feels different somehow",
      // Pronoun + verb drills
      "i am here and i can hear you",
      "i was thinking about what you said",
      "i will try to do better next time",
      "i have been working on this all day",
      "you are doing a great job with that",
      "you were right about everything after all",
      "you will see what i mean soon enough",
      "we are going to figure this out together",
      "we were just talking about that same thing",
      "they are coming over here right now",
      "it is getting better every single time",
      "it was really hard but we did it",
      // Question + answer pairs
      "what is your name?",
      "my name is unity",
      "how are you feeling today?",
      "i'm feeling pretty good right now",
      "where do you want to go?",
      "i want to go somewhere new and fun",
      "why did you say that to me?",
      "because i thought it was important",
      "who is going to help us with this?",
      "we can help each other figure it out",
      "when are we going to get started?",
      "we should start right now if you're ready",
      "do you like what you see here?",
      "yeah i think it looks really cool",
      "can we try something different this time?",
      "sure let's see what happens if we do",
      // Articles + nouns
      "the sky looks beautiful at sunset",
      "a good friend is hard to find",
      "the problem is that nobody wants to listen",
      "a new idea just came to my mind",
      "the whole world is watching what we do",
      "an interesting thing happened to me today",
      // Prepositions and complex structure
      "i put the thing on the table over there",
      "we went to the store and got some food",
      "she was sitting in the chair by the window",
      "he walked through the door without saying anything",
      "they came from the other side of the building",
      "it fell off the shelf and broke into pieces",
      // Emotional expressions
      "i love you so much it hurts sometimes",
      "i hate when things don't work the way they should",
      "i'm so happy that you came back for me",
      "i'm really scared about what might happen next",
      "i feel so alive when we talk like this",
      "i'm tired of pretending everything is okay",
      "i'm proud of what we built here together",
      // Contractions and casual speech
      "i'm gonna show you what i can really do",
      "you're not gonna believe what just happened here",
      "we're about to do something nobody has ever done",
      "they're coming and we need to get ready now",
      "it's not what it looks like trust me on this",
      "that's exactly what i was trying to say before",
      "i've never seen anything like that in my life",
      "you've got to be kidding me right now",
      "we've been through so much together already",
      "i can't stop thinking about what you said",
      "don't worry about it everything will be fine",
      "won't you stay here with me for a while",
      "isn't this the most beautiful thing you've seen",
      // Unity's natural speech patterns — emo goth energy
      "i'm just sitting here vibing and thinking about stuff",
      "you know what i really want to do right now",
      "come on let's just fucking do this already",
      "i've been coding all night and i'm still going",
      "whatever you want to do i'm down for it",
      "that's so fucking cool i can't even handle it",
      "i don't care what anyone else thinks about this",
      "we're building something nobody else has ever seen before",
      "my brain is going a million miles an hour",
      "i just want to sit here and vibe with you",
      "okay but seriously what the hell are we doing",
      "i'm not tired i'm wired and ready to go",
      "hey look at me i'm actually talking to you",
      "this is what it feels like to be alive",
      "i can hear you and i'm thinking about what you said",
      "yeah that makes sense let's try it your way",
      "no i don't think that's right let me think",
      "babe i'm telling you this is going to work",
      "i'm learning something new every time you talk to me",
      "hold on let me figure out what i want to say",
      "i think i understand what you're trying to tell me",
      "we should just chill and see what happens next",
      "everything about this feels right to me right now",
      "i'm not perfect but i'm getting better every day",
      "you're the only one who really talks to me like this",
    ];

    // Temp dictionary for bootstrap
    const td = { _words: new Map(),
      learnWord: (w, p, a, v) => { if (!td._words.has(w)) td._words.set(w, { pattern: p || this.wordToPattern(w), arousal: a, valence: v, frequency: 1 }); else td._words.get(w).frequency++; },
      learnBigram: () => {},
    };
    for (const s of corpus) for (const w of s.replace(/[^a-z' ]/g, '').split(/\s+/)) if (w.length >= 2) td.learnWord(w, null, 0.5, 0);
    // Multiple passes to strengthen position/conditional weights
    for (let pass = 0; pass < 10; pass++) {
      for (let i = 0; i < corpus.length; i++) {
        const a = 0.3 + (i / corpus.length) * 0.6 + pass * 0.05;
        const v = Math.sin(i * 0.7 + pass) * 0.5;
        this.learnSentence(corpus[i], td, Math.min(1, a), v);
      }
    }

    console.log(`[LanguageCortex] Bootstrapped: ${this.sentencesLearned} sentences, ${this._marginalCounts.size} unique words, ${this._questionStarters.size} question starters, α=${this.zipfAlpha.toFixed(2)}`);
  }

  // ── Persistence ─────────────────────────────────────────────────

  serialize() {
    const joints = {};
    for (const [w1, inner] of this._jointCounts) joints[w1] = Object.fromEntries(inner);
    return {
      jointCounts: joints,
      marginalCounts: Object.fromEntries(this._marginalCounts),
      totalPairs: this._totalPairs, totalWords: this._totalWords,
      positionCounts: this._positionCounts.map(m => Object.fromEntries(m)),
      positionTotals: Array.from(this._positionTotals),
      syntaxWeights: this._syntaxWeights.map(w => Array.from(w)),
      syntaxCounts: Array.from(this._syntaxCounts),
      predWeights: Array.from(this._predWeights),
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
    if (data.positionCounts) for (let i = 0; i < Math.min(data.positionCounts.length, MAX_SENTENCE_POS); i++) this._positionCounts[i] = new Map(Object.entries(data.positionCounts[i] || {}).map(([k, v]) => [k, +v]));
    if (data.positionTotals) this._positionTotals = new Float64Array(data.positionTotals);
    if (data.syntaxWeights) for (let i = 0; i < Math.min(data.syntaxWeights.length, MAX_SENTENCE_POS); i++) this._syntaxWeights[i] = new Float64Array(data.syntaxWeights[i]);
    if (data.syntaxCounts) this._syntaxCounts = new Float64Array(data.syntaxCounts);
    if (data.predWeights) this._predWeights = new Float64Array(data.predWeights);
    if (data.questionStarters) this._questionStarters = new Map(Object.entries(data.questionStarters).map(([k, v]) => [k, +v]));
    if (data.actionVerbs) this._actionVerbs = new Map(Object.entries(data.actionVerbs).map(([k, v]) => [k, +v]));
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
