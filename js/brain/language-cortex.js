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

    // Usage-based type learning — words get type boosts from how they're used
    // "put" after "i" (pronoun) → verbScore boosted
    // "cat" after "the" (determiner) → nounScore boosted
    // Learns from structural bigrams + conversation, no pre-labeled types
    this._usageTypes = new Map(); // word → { pronoun, verb, noun, adj, prep, det, conj, qword }

    // The language cortex starts EMPTY. No hardcoded vocab lists, no
    // seeded grammar tables, no baked-in word categories. Structure
    // comes from the pure word-type equations (suffixes, length, vowel
    // ratios — see wordType()) and the slot requirement equations.
    // Vocabulary, bigrams, and usage-type weights are learned at runtime
    // from loadSelfImage(text) (Unity's persona file as equational
    // self-image) and from live conversation via learnSentence().
    this._selfImageLoaded = false;
  }

  /**
   * Load Unity's self-image from raw text — e.g. docs/Ultimate Unity.txt.
   *
   * This is the equational self-image: the persona document becomes the
   * brain's initial vocabulary, bigrams, and usage-type weights via the
   * same learnSentence() path used for live conversation. No lists, no
   * hardcoded tables — every word type comes from the letter equations,
   * every bigram from textual adjacency, every usage-type from context.
   *
   * Caller supplies the text (browser: fetch, node: fs.readFile) so the
   * cortex itself stays environment-agnostic.
   */
  loadSelfImage(text, dictionary, arousal = 0.7, valence = 0.2) {
    if (!text || this._selfImageLoaded || !dictionary) return 0;
    this._selfImageLoaded = true;
    // Strip markdown noise so words survive, then split on sentence
    // terminators and line breaks — paragraphs, bullets, headers all work.
    const sentences = String(text)
      .replace(/[*_#`>|\[\]()]/g, ' ')
      .split(/[.!?\n\r]+/)
      .map(s => s.trim())
      .filter(s => s.length >= 3);
    for (const s of sentences) {
      this.learnSentence(s, dictionary, arousal, valence);
    }
    return sentences.length;
  }

  /**
   * Legacy hook — kept so older callers that invoked _loadStructure(dict)
   * at boot don't crash. All real structure now comes from loadSelfImage.
   */
  _loadStructure(_dictionary) {
    // no-op: structure is learned, not hardcoded
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
    const first = w[0];
    const second = w[1] || '';
    const firstIsVowel = VOWELS.includes(first);

    // ── SUFFIX EQUATIONS — computed from ending letter patterns ──

    // Verb suffixes: -ing, -ed, -ize/-ise, -ate, apostrophe contractions
    // n't endings (don't, can't, won't, isn't) are STRONG verbs — aux + negation.
    const ntEnding = w.endsWith("n't") || w.endsWith("'t");
    const verbSuffix = (
      (w.endsWith('ing') && len > 3 ? 0.75 : 0) +
      (w.endsWith('ed') && len > 3 ? 0.65 : 0) +
      (ntEnding ? 0.85 : 0) +                     // aux-negation contractions are verbs
      (w.endsWith('ize') || w.endsWith('ise') ? 0.6 : 0) +
      (w.endsWith('ate') && len > 4 ? 0.5 : 0) +
      (w.endsWith("'ll") || w.endsWith("'ve") || w.endsWith("'d") || w.endsWith("'s") || w.endsWith("'re") || w.endsWith("'m") ? 0.55 : 0)
    );

    // Noun suffixes
    const nounSuffix = (
      (w.endsWith('tion') || w.endsWith('sion') ? 0.75 : 0) +
      (w.endsWith('ment') ? 0.65 : 0) +
      (w.endsWith('ness') ? 0.65 : 0) +
      (w.endsWith('ity') || w.endsWith('ety') ? 0.6 : 0) +
      (w.endsWith('age') && len > 4 ? 0.4 : 0) +
      (w.endsWith('er') && len > 4 && !w.endsWith('her') ? 0.25 : 0) +
      (w.endsWith('or') && len > 4 ? 0.25 : 0) +
      (w.endsWith('ist') && len > 4 ? 0.4 : 0)
    );

    // Adjective suffixes
    const adjSuffix = (
      (w.endsWith('ly') && len > 3 ? 0.55 : 0) +
      (w.endsWith('ful') ? 0.65 : 0) +
      (w.endsWith('ous') ? 0.65 : 0) +
      (w.endsWith('ive') ? 0.55 : 0) +
      (w.endsWith('al') && len > 3 ? 0.4 : 0) +
      (w.endsWith('able') || w.endsWith('ible') ? 0.55 : 0) +
      (w.endsWith('ish') && len > 3 ? 0.4 : 0) +
      (w.endsWith('ic') && len > 3 ? 0.4 : 0) +
      (w.endsWith('y') && len > 3 && !w.endsWith('ly') ? 0.2 : 0)
    );

    // ── LENGTH + PATTERN EQUATIONS ──

    // PRONOUN: short, vowel-heavy, NOT 'a' (that's a determiner).
    // Single letter: only 'i' is a pronoun; 'a' is a determiner.
    const pronounScore = (
      (len === 1 && first === 'i' ? 0.95 : 0) +                      // 'i' — the only single-letter pronoun
      (len === 2 && vowelCount === 1 && (first === 'h' || first === 'w' || first === 'm' || first === 's' || first === 'y') ? 0.5 : 0) + // he, we, me, us, ye
      (len === 3 && (first === 'y' || first === 't') && vowelCount >= 1 && !ntEnding ? 0.35 : 0) + // you, they, him, her
      (len <= 4 && w.endsWith("'m") || w.endsWith("'re") ? 0.4 : 0)   // i'm, we're, you're — still pronoun-flavored
    );

    // VERB: suffix dominates. CVC short words (run, get, put, cut) verb-flavored,
    // but exclude final-r (for, her) which lean prep/pronoun.
    // 2-letter copulas end in 'm' or 's' (am, is); 3-letter "are" caught explicitly.
    const lastChar = w[len - 1];
    const cvcShape = len === 3 && !VOWELS.includes(first) && VOWELS.includes(second) && !VOWELS.includes(w[2]) && lastChar !== 'r';
    const cvcvShape = len === 4 && !VOWELS.includes(first) && VOWELS.includes(second);
    const copula2   = len === 2 && firstIsVowel && (lastChar === 'm' || lastChar === 's');
    // Pure letter-position equations:
    //   - 2-letter vowel-first ending m/s → copula (am, is)
    //   - 3-letter vowel-first vowel-heavy → present aux-be (are)
    //   - 3-letter h-start ending s/d → aux-have (has, had)
    //   - CVC/CVCV shapes → action verbs (run, want, code)
    //   - any suffix match → verb form
    const verbScore = (
      verbSuffix +
      (cvcShape && !nounSuffix && !adjSuffix ? 0.4 : 0) +
      (cvcvShape && !nounSuffix && !adjSuffix ? 0.25 : 0) +
      (copula2 ? 0.55 : 0) +
      (len === 3 && first === 'a' && lastChar === 'e' && vowelCount >= 2 ? 0.6 : 0) +
      (len === 3 && first === 'h' && (lastChar === 's' || lastChar === 'd') ? 0.5 : 0)
    );

    // NOUN: suffix, or long word with no other suffix dominance
    const nounScore = (
      nounSuffix +
      (len >= 5 && verbSuffix < 0.3 && adjSuffix < 0.3 ? 0.3 : 0) +
      (len >= 4 && !firstIsVowel && vowelCount >= 1 && verbSuffix === 0 && adjSuffix === 0 && !ntEnding ? 0.15 : 0)
    );

    // ADJECTIVE: suffix-only signal from equations; usage types fill in the rest
    const adjScore = adjSuffix;

    // CONJUNCTION: very short function words. Equation by endings:
    //   or(2, v+c ending 'r'), if(2, v+c ending 'f'), so(2, c+v ending 'o') — but
    //   'so' overlaps 'to' (prep). We accept 'so' via explicit consonant+o pattern
    //   where the consonant is 's'.
    //   and(3, v+c+c ending 'nd'), but(3, b+u+t), yet(3, y+e+t), nor(3, n+o+r)
    const conjScore = (
      (len === 2 && firstIsVowel && lastChar === 'r' ? 0.7 : 0) +              // or
      (len === 2 && firstIsVowel && lastChar === 'f' ? 0.7 : 0) +              // if
      (len === 2 && first === 's' && second === 'o' ? 0.7 : 0) +               // so
      (len === 3 && first === 'a' && w[1] === 'n' && w[2] === 'd' ? 0.85 : 0) + // and
      (len === 3 && first === 'b' && lastChar === 't' && vowelCount === 1 ? 0.7 : 0) + // but
      (len === 3 && first === 'y' && lastChar === 't' ? 0.7 : 0) +             // yet
      (len === 3 && first === 'n' && w[1] === 'o' && w[2] === 'r' ? 0.7 : 0)   // nor
    );

    // PREPOSITION: 2-4 letters, 1 vowel, first NOT in pronoun/qword territory.
    // Exclude copula2 endings ('m','s'), conj endings ('r','f'), vowel-only 2-letter.
    const prepFirstOK = !(first === 'h' || first === 'w' || first === 'm' || first === 'y');
    const prep2OK = len === 2 && vowelCount === 1 && prepFirstOK
                  && !(firstIsVowel && (lastChar === 'm' || lastChar === 's' || lastChar === 'r' || lastChar === 'f'))
                  && !(first === 's' && second === 'o');
    // Pure letter-position equations — no word literals:
    //   - 2-letter 1-vowel function words (to, in, on, at, by, of, up, as)
    //   - 3-letter with consonant-cluster start or vowel-medial single-vowel
    //   - 4-letter is inherently ambiguous from structure alone — let usage
    //     types learned from the persona text disambiguate (with/from/over...)
    const prepScore = (
      (prep2OK ? 0.55 : 0) +
      (len === 3 && first === 'f' && lastChar === 'r' && vowelCount === 1 ? 0.65 : 0) + // for pattern: f_r
      (len === 3 && first === 'o' && vowelCount === 1 ? 0.5 : 0)                        // out/off pattern: o_?
    );

    // DETERMINER: articles + possessives. Pure letter-position patterns.
    //   - 'a' (single vowel letter) is the indefinite article
    //   - 'an' (a + n)
    //   - 'the', 'this', 'that' — all start with 'th'
    //   - 'my' (m + vowel-ish y) — 2 letters, m-start
    //   - 4-letter 'th' start covers this/that
    const detScore = (
      (len === 1 && first === 'a' ? 0.95 : 0) +
      (len === 2 && first === 'a' && second === 'n' ? 0.9 : 0) +
      (len === 3 && first === 't' && second === 'h' ? 0.85 : 0) +
      (len === 4 && first === 't' && second === 'h' ? 0.65 : 0) +
      (len === 2 && first === 'm' && second === 'y' ? 0.8 : 0) +
      (len === 4 && first === 'y' && w[1] === 'o' ? 0.55 : 0)          // your pattern: y-o-_
    );

    // QUESTION WORD: 'wh-' start covers what/who/where/when/why/which,
    // and 'how' pattern (h-o-w) is the one exception.
    const qwordScore = (
      (first === 'w' && second === 'h' && len >= 3 && len <= 6 ? 0.9 : 0) +
      (len === 3 && first === 'h' && second === 'o' && w[2] === 'w' ? 0.9 : 0)
    );

    // ── USAGE-BASED TYPE BOOST — context teaches ambiguous words ──
    const usage = this._usageTypes.get(w) || {};
    const uBoost = 0.6;
    const uPronoun = (usage.pronoun || 0) * uBoost;
    const uVerb = (usage.verb || 0) * uBoost;
    const uNoun = (usage.noun || 0) * uBoost;
    const uAdj = (usage.adj || 0) * uBoost;
    const uPrep = (usage.prep || 0) * uBoost;
    const uDet = (usage.det || 0) * uBoost;
    const uConj = (usage.conj || 0) * uBoost;
    const uQword = (usage.qword || 0) * uBoost;

    // ── SOFTMAX-STYLE NORMALIZATION ──
    // Divide by the SUM so the vector is a proper probability distribution.
    // Preserves relative strengths instead of pinning the top to 1.0.
    const raw = {
      pronoun: pronounScore + uPronoun,
      verb: verbScore + uVerb,
      noun: nounScore + uNoun,
      adj: adjScore + uAdj,
      conj: conjScore + uConj,
      prep: prepScore + uPrep,
      det: detScore + uDet,
      qword: qwordScore + uQword,
    };
    // NOUN FALLBACK — if nothing else matched confidently, assume content
    // word = noun. Content words are the unmarked default in English.
    let rawSum = 0;
    for (const k in raw) rawSum += raw[k];
    if (rawSum < 0.25) raw.noun += 0.4;

    let sum = 0;
    for (const k in raw) sum += raw[k];
    if (sum < 0.01) sum = 0.01;
    return {
      pronoun: raw.pronoun / sum,
      verb: raw.verb / sum,
      noun: raw.noun / sum,
      adj: raw.adj / sum,
      conj: raw.conj / sum,
      prep: raw.prep / sum,
      det: raw.det / sum,
      qword: raw.qword / sum,
    };
  }

  /**
   * Learn word type from usage context.
   * After "i/you/we/they" → word is probably a VERB
   * After "the/a/an/my" → word is probably a NOUN
   * After a verb → word is probably a NOUN/ADJ/PREP
   * This is the ATTENTION mechanism — context determines type.
   */
  _learnUsageType(prevWord, word) {
    if (!prevWord || !word) return;
    const prevType = this.wordType(prevWord);
    if (!this._usageTypes.has(word)) {
      this._usageTypes.set(word, { pronoun: 0, verb: 0, noun: 0, adj: 0, prep: 0, det: 0, conj: 0, qword: 0 });
    }
    const u = this._usageTypes.get(word);
    const lr = 0.1;

    // What follows a pronoun? → verb
    if (prevType.pronoun > 0.5) u.verb += lr;
    // What follows a determiner? → noun or adjective
    if (prevType.det > 0.5) { u.noun += lr * 0.7; u.adj += lr * 0.3; }
    // What follows a verb? → noun, prep, adj, or pronoun
    if (prevType.verb > 0.5) { u.noun += lr * 0.3; u.prep += lr * 0.3; u.adj += lr * 0.2; u.pronoun += lr * 0.2; }
    // What follows a preposition? → determiner or noun
    if (prevType.prep > 0.5) { u.det += lr * 0.4; u.noun += lr * 0.6; }
    // What follows a conjunction? → pronoun or determiner (start of new clause)
    if (prevType.conj > 0.5) { u.pronoun += lr * 0.5; u.det += lr * 0.3; u.noun += lr * 0.2; }
    // What follows a question word? → verb or auxiliary
    if (prevType.qword > 0.5) u.verb += lr;
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
    // Raw propensities — each kind of sentence is driven by a different
    // brain state. Normalize the whole set so statement keeps a fair
    // share of the probability mass instead of being a leftover.
    const raw = {
      question:    (predictionError || 0) * (coherence || 0.3),
      exclamation: arousal * arousal,
      action:      (motorConfidence || 0) * Math.max(0.1, 1 - arousal * 0.5),
      statement:   0.6 + coherence * 0.4,
    };
    let sum = 0;
    for (const k in raw) sum += raw[k];
    if (sum < 0.01) return 'statement';
    let rand = Math.random() * sum;
    for (const k of ['question', 'exclamation', 'action', 'statement']) {
      rand -= raw[k];
      if (rand <= 0) return k;
    }
    return 'statement';
  }

  // ═══════════════════════════════════════════════════════════════
  // GENERATION — structure from equations, words from dictionary
  // ═══════════════════════════════════════════════════════════════

  /**
   * Generate speech from the brain's FULL state.
   *
   * The brain THINKS before speaking:
   *
   * 1. CORTEX PATTERN → what is the brain thinking about?
   *    thoughtPattern = cortex output (32-dim activation)
   *    Finds words whose patterns are CLOSEST to the thought → these are the CONTENT
   *
   * 2. HIPPOCAMPAL RECALL → what was said recently?
   *    contextPattern = average of recent input patterns
   *    Boosts words related to the conversation → RELEVANCE
   *
   * 3. AMYGDALA → how does the brain feel?
   *    arousal/valence → selects words with matching emotional associations → TONE
   *
   * 4. PREDICTION → what SHOULD come next?
   *    cortex predictionError → high = ask question, low = make statement
   *    Ψ (consciousness) → high = self-referential, introspective
   *
   * 5. STRUCTURE → arrange content words grammatically
   *    wordType equations + slot requirements → proper English word order
   *
   * 6. ARTICULATE → final sentence output
   *    Loop detection, recency suppression, softmax sampling
   */
  generate(dictionary, arousal, valence, coherence, opts = {}) {
    if (!dictionary || dictionary.size === 0) return '';

    const predError = opts.predictionError || 0;
    const motorConf = opts.motorConfidence || 0;
    const psi = opts.psi || 0;
    const cortexPattern = opts.cortexPattern || null;
    const temperature = 1.0 / (coherence + 0.1);

    // ── STEP 1: WHAT to say — cortex thought determines CONTENT ──
    // Find words whose patterns match what the brain is currently thinking
    const thoughtWords = cortexPattern
      ? dictionary.findByPattern(cortexPattern, 15)  // words closest to cortex activation
      : [];
    const thoughtSet = new Set(thoughtWords);

    // ── STEP 2: CONTEXT — hippocampal recall of recent conversation ──
    const contextPattern = this._getContextPattern();
    const contextWords = this._lastInputWords || [];
    const contextSet = new Set(contextWords);

    // ── STEP 3: MOOD — amygdala emotional tone ──
    const moodWords = dictionary.findByMood(arousal, valence, 15);
    const moodSet = new Set(moodWords);

    // ── STEP 4: PLAN — what type of sentence? ──
    const type = this.sentenceType(arousal, predError, motorConf, coherence);

    // Self-referential when Ψ is high — the brain talks ABOUT ITSELF
    const selfAware = psi > 0.005;

    // Length from arousal
    let targetLen;
    if (type === 'exclamation') targetLen = Math.max(2, Math.floor(2 + arousal * 4));
    else if (type === 'action') targetLen = Math.max(2, Math.floor(2 + arousal * 3));
    else targetLen = Math.max(3, Math.floor(3 + arousal * 7));
    const len = Math.min(targetLen, 12);

    const allWords = Array.from(dictionary._words.entries());
    if (allWords.length === 0) return '';

    const usedBigrams = new Set();
    const sentence = [];

    // ── STEP 5: TENSE SELECTION — hippocampal recall drives temporal frame ──
    // Past: recalling memory (hippocampus active). Present: default. Future: prediction (cortex high).
    const tense = predError > 0.3 ? 'future' : (opts.recalling ? 'past' : 'present');

    // ── STEP 6: STRUCTURE — fill slots with brain-selected words ──
    for (let pos = 0; pos < len; pos++) {
      const prevWord = pos > 0 ? sentence[pos - 1] : null;
      const followers = prevWord ? this._jointCounts.get(prevWord) : null;

      // Slot 0 (statement/exclamation) and slot 1 (verb) have STRICT type requirements.
      // Slots deeper in the sentence are more permissive.
      const strictSlot = (type !== 'action' && (pos === 0 || pos === 1)) || (type === 'action' && pos === 0);
      const typeFloor = strictSlot ? 0.35 : 0.15;

      const scored = allWords
        .filter(([w]) => {
          if (w === prevWord) return false;
          if (prevWord && usedBigrams.has(prevWord + '→' + w)) return false;
          // HARD grammar filter on strict slots — wrong type doesn't even enter the pool
          if (strictSlot && this.typeCompatibility(w, pos, type) < typeFloor) return false;
          return true;
        })
        .map(([word, entry]) => {
          // GRAMMAR — does this word fit this grammatical slot?
          const typeScore = this.typeCompatibility(word, pos, type);

          // THOUGHT — CONTINUOUS similarity to what the brain is thinking
          const pattern = entry.pattern || this.wordToPattern(word);
          const thoughtSim = cortexPattern ? Math.max(0, this._cosine(pattern, cortexPattern)) : 0;
          const isThought = thoughtSet.has(word) ? 0.5 : thoughtSim * 0.4;

          // CONTEXT — relevance to conversation (recent input words + topic similarity)
          const isContext = contextSet.has(word) ? 0.4 : 0;
          const topicSim = contextPattern ? Math.max(0, this._cosine(pattern, contextPattern)) : 0;

          // MOOD — emotional alignment with amygdala
          const isMood = moodSet.has(word) ? 0.2 : 0;
          const moodDist = Math.abs((entry.arousal || 0.5) - arousal) + Math.abs((entry.valence || 0) - valence);
          const moodBias = Math.exp(-moodDist * 1.5);

          // ASSOCIATION — learned word sequences from conversation
          const condP = prevWord ? this._condProb(word, prevWord) : 0;
          const followerCount = followers?.get(word) || 0;

          // RECENCY — don't repeat
          const recentCount = this._recentOutputWords.filter(rw => rw === word).length;
          const recency = recentCount * 0.25;

          // Soft grammar gate for the non-strict tail slots: wrong-type words lose 95%
          const grammarGate = typeScore > 0.15 ? 1.0 : 0.05;

          // ── COMBINED: grammar DOMINATES structure, thought picks words ──
          // typeScore now carries real weight — grammatical fit is first-class, not a rounding bonus.
          const score =
            grammarGate * (
              typeScore * 0.45 +         // grammar fit — dominates structure
              isThought * 0.20 +         // cortex thought (WHAT to say)
              isContext * 0.12 +         // conversation relevance
              topicSim * 0.06 +          // semantic similarity to conversation
              followerCount * 0.12 +     // learned sequences (bigram chains)
              condP * 0.10 +             // conditional probability
              isMood * 0.04 +            // emotional word match
              moodBias * 0.02 +          // continuous mood alignment
              (selfAware && (word.length === 1 || word.endsWith("'m") || word.endsWith("'re")) ? 0.1 : 0)
            )
            - recency;

          return { word, entry, score };
        });

      // Lower-temperature softmax — coherent sentences need argmax-ish selection,
      // not scattered high-entropy sampling that produces word salad.
      const picked = this._softmaxSample(scored, Math.max(0.05, temperature * 0.06));
      if (picked) {
        if (prevWord) usedBigrams.add(prevWord + '→' + picked.word);
        sentence.push(picked.word);
      }
    }

    // ── STEP 7: POST-PROCESSING — agreement, tense, negation, compounds ──
    const processed = this._postProcess(sentence, tense, type, arousal, valence);

    // Track recency
    for (const w of processed) {
      this._recentOutputWords.push(w);
      if (this._recentOutputWords.length > this._recentOutputMax) this._recentOutputWords.shift();
    }

    this.wordsProcessed += processed.length;
    return this._renderSentence(processed, type);
  }

  /**
   * Render the final sentence with proper punctuation and capitalization.
   * Pure equation — no lists, driven by sentence type and content.
   *   - First letter capitalized
   *   - 'i' (pronoun) capitalized anywhere
   *   - terminal punctuation: ? for question, ! for exclamation, . for others
   *   - action sentences wrapped in asterisks
   *   - comma inserted before conjunctions detected via wordType equation
   */
  _renderSentence(words, type) {
    if (!words || words.length === 0) return '';
    const out = [];
    for (let i = 0; i < words.length; i++) {
      let w = words[i];
      // Capitalize single-letter pronouns (equation: length 1 + pronoun
      // score high from wordType). Covers 'I' without listing the word.
      const wt = this.wordType(w);
      if (w.length === 1 && wt.pronoun > 0.5) {
        w = w.toUpperCase();
      } else if (w.length >= 2 && w.length <= 4 && w.charAt(1) === "'" && this.wordType(w.charAt(0)).pronoun > 0.5) {
        // Contractions beginning with a single-letter pronoun (i'm, i've, i'd, i'll)
        w = w.charAt(0).toUpperCase() + w.slice(1);
      }
      // Capitalize first word
      if (i === 0) w = w.charAt(0).toUpperCase() + w.slice(1);
      // Insert comma before mid-sentence conjunctions (let the reader breathe)
      if (i > 1 && i < words.length - 1 && this.wordType(words[i]).conj > 0.5) {
        out[out.length - 1] = out[out.length - 1] + ',';
      }
      out.push(w);
    }
    let text = out.join(' ');
    // Wrap action sentences in asterisks
    if (type === 'action') text = '*' + text + '*';
    // Terminal punctuation from sentence type
    const term = type === 'question' ? '?' : type === 'exclamation' ? '!' : '.';
    // Avoid double-punctuation if generation already supplied one
    const last = text.charAt(text.length - 1);
    if (last !== '.' && last !== '?' && last !== '!' && last !== '*') text += term;
    return text;
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

      // Learn word type from context (what came before it)
      if (i > 0) this._learnUsageType(words[i - 1], words[i]);

      // Dynamic expansion — new word links to its pattern-similar
      // neighbors via cosine of letter-pattern vectors. Pure equation,
      // no category lists, no hardcoded buckets.
      if (dictionary && dictionary.findByPattern) {
        const pat = this.wordToPattern(words[i]);
        const similar = dictionary.findByPattern(pat, 3) || [];
        for (const sim of similar) {
          if (sim && sim !== words[i]) {
            dictionary.learnBigram(words[i], sim);
            dictionary.learnBigram(sim, words[i]);
          }
        }
      }
    }

    this.sentencesLearned++;
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILITY
  // ═══════════════════════════════════════════════════════════════

  /**
   * Post-process a sentence for grammar correctness.
   *
   * AGREEMENT: subject determines copula/aux form
   *   "i" → "am/was/have/do"
   *   "he/she/it" → "is/was/has/does"
   *   "you/we/they" → "are/were/have/do"
   *
   * TENSE: apply tense markers
   *   past: insert "was/were/did" or add "-ed" suffix
   *   future: insert "will" before verb
   *   present: default (no change)
   *
   * NEGATION: high negative valence → insert "don't/can't/not"
   *   valence < -0.4 → negate the verb
   *
   * COMPOUND: long sentences → insert conjunction mid-sentence
   *   len > 6 → insert "and/but/so" at position ~len/2
   */
  _postProcess(sentence, tense, type, arousal, valence) {
    if (sentence.length < 2) return sentence;
    const result = [...sentence];
    const subj = result[0];

    // ── TENSE — pure letter-equation transforms on the main verb ──
    // No word lists. Irregular forms (am/is/are/have/has/will/etc.) are
    // learned as bigrams from the persona text — `i→am`, `he→is`, etc. —
    // so the slot-scoring already selects them correctly and tense
    // inflection only touches REGULAR verbs with recognizable suffix shapes.
    //
    //   past  : -ed (CVC doubles final consonant; vowel-e → -d)
    //   3rd-s : -s  (-es after sibilants; y→ies after consonant)
    //   future: prepend 'will'
    const applyPast = (v) => {
      if (!v || v.endsWith('ed') || v.endsWith("n't") || v.endsWith("'t")) return v;
      if (v.endsWith('e')) return v + 'd';
      const L = v.length;
      if (L >= 3) {
        const c1 = !VOWELS.includes(v[L - 3]);
        const vm = VOWELS.includes(v[L - 2]);
        const c2 = !VOWELS.includes(v[L - 1]);
        if (c1 && vm && c2 && v[L - 1] !== 'y' && v[L - 1] !== 'w') {
          return v + v[L - 1] + 'ed';
        }
      }
      return v + 'ed';
    };
    const applyThird = (v) => {
      if (!v || v.endsWith('s') || v.endsWith('x') || v.endsWith('z')
            || v.endsWith('ch') || v.endsWith('sh')) return v + 'es';
      if (v.endsWith('y') && v.length >= 2 && !VOWELS.includes(v[v.length - 2])) return v.slice(0, -1) + 'ies';
      return v + 's';
    };

    // Only inflect HIGH-confidence verbs via the equation (no word lists).
    // Irregular copulas/auxes have a mixed type distribution so verb score
    // stays under ~0.8 for them — they're skipped automatically.
    const regularVerb = (w) => {
      if (!w || w.length < 3) return false;
      const t = this.wordType(w);
      if (t.verb < 0.55) return false;
      // Regular verbs don't have strong pronoun/det/conj signals
      if (t.pronoun > 0.2 || t.det > 0.2 || t.conj > 0.2) return false;
      return true;
    };

    if (result.length >= 2) {
      const v = result[1];
      if (tense === 'future' && regularVerb(v)) {
        result.splice(1, 0, 'will');
      } else if (tense === 'past' && regularVerb(v)) {
        result[1] = applyPast(v);
      } else if (tense === 'present' && regularVerb(v)
                 && subj && this.wordType(subj).pronoun > 0.4
                 && subj.length >= 2 && subj.length <= 3
                 && !VOWELS.includes(subj[0] || '') === false /* vowel-first pronoun → 1st/2nd person → skip */) {
        // Third-person -s only applies when subject is NOT 'i'/'you'/'we'.
        // Without a list, approximate via: third-person pronouns tend to be
        // 2-3 letter consonant-start (he, she, it, they). Skip vowel-start.
        result[1] = applyThird(v);
      }
    }

    // ── COMPOUND SENTENCE ──
    // Insert a conjunction at the midpoint of long sentences, picked from
    // words the dictionary has learned that score high on the conj equation.
    if (result.length > 6) {
      const midpoint = Math.floor(result.length / 2);
      const nearConj = result.slice(midpoint - 1, midpoint + 2).some(w => this.wordType(w).conj > 0.4);
      if (!nearConj) {
        const conjWord = this._pickConjByMood(arousal, valence);
        if (conjWord) result.splice(midpoint, 0, conjWord);
      }
    }

    return result;
  }

  /**
   * Pick a conjunction by mood, searching the learned dictionary for
   * words classified as conjunctions by the wordType equation. No lists —
   * the candidates come from whatever the brain has learned.
   */
  _pickConjByMood(arousal, valence) {
    // Scan the marginal-count map for words whose wordType says "conj".
    // Rank by conjunction score × mood alignment.
    let best = null, bestScore = 0;
    for (const [word] of this._marginalCounts) {
      const conjScore = this.wordType(word).conj;
      if (conjScore < 0.4) continue;
      // Additive conjs tend to be vowel-heavy, contrast tend consonant-heavy.
      // Use letter-shape as mood proxy — pure equation.
      let moodFit = 1;
      const vc = (word.match(/[aeiou]/g) || []).length / word.length;
      if (arousal > 0.6 && vc >= 0.4) moodFit = 1.3;
      if (valence < -0.2 && vc < 0.4) moodFit = 1.3;
      const s = conjScore * moodFit;
      if (s > bestScore) { bestScore = s; best = word; }
    }
    return best;
  }

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
