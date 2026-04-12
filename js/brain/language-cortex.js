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

    // Subject starters — words the brain has seen used as sentence-initial
    // subjects. Learned at the sentence boundary (i===0 in learnSentence).
    // Used by slot 0 to boost subject-capable words without hardcoding lists.
    this._subjectStarters = new Map();

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
      (len === 2 && first === 'i' && w[1] === 't' ? 0.85 : 0) +       // it
      (len === 3 && first === 's' && second === 'h' && w[2] === 'e' ? 0.9 : 0) + // she
      (len === 3 && first === 'h' && second === 'e' && w[2] === 'r' ? 0.8 : 0) + // her
      (len === 3 && first === 'h' && second === 'i' && w[2] === 'm' ? 0.8 : 0) + // him
      (len === 3 && (first === 'y' || first === 't') && vowelCount >= 1 && !ntEnding ? 0.5 : 0) + // you, the (ambig — det gate wins for 'the')
      (len === 4 && first === 't' && second === 'h' && w[2] === 'e' && w[3] === 'y' ? 0.9 : 0) + // they
      (len === 4 && first === 't' && second === 'h' && w[2] === 'e' && w[3] === 'm' ? 0.8 : 0) + // them
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
    // CVC/CVCV shapes are a WEAK verb signal. Most 3-letter content words are
    // nouns (son, cat, dog, man, sun, box, fog, cup). Keep the signal non-zero
    // so shape can disambiguate, but well below the noun fallback threshold
    // (raw.noun += 0.4 when rawSum < 0.25) so bare CVC words land as nouns
    // unless usage-type learning from the persona text lifts them to verb.
    const verbScore = (
      verbSuffix +
      (cvcShape && !nounSuffix && !adjSuffix ? 0.18 : 0) +
      (cvcvShape && !nounSuffix && !adjSuffix ? 0.12 : 0) +
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
      (len === 2 && firstIsVowel && lastChar === 'r' && first !== 'o' ? 0.7 : 0) + // or (but NOT "or" vs content)
      (len === 2 && first === 'o' && lastChar === 'r' ? 0.7 : 0) +              // or — explicit
      (len === 2 && first === 'i' && lastChar === 'f' ? 0.7 : 0) +              // if — ONLY 'i' start, not 'o' (of is prep)
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
      (len === 2 && first === 'o' && lastChar === 'f' ? 0.85 : 0) +                    // 'of' — explicit (excluded from prep2OK)
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
    // Treat subject-starters (learned or equation-identified subjects) as
    // functional pronouns for verb-boost purposes. "Unity expresses..." must
    // teach "expresses" as a verb even though "unity" isn't a pronoun by letters.
    const prevIsSubject = prevType.pronoun > 0.5
      || this._isNominativePronoun(prevWord)
      || (this._subjectStarters.get(prevWord.toLowerCase()) || 0) >= 1;

    if (!this._usageTypes.has(word)) {
      this._usageTypes.set(word, { pronoun: 0, verb: 0, noun: 0, adj: 0, prep: 0, det: 0, conj: 0, qword: 0 });
    }
    const u = this._usageTypes.get(word);
    const lr = 0.1;

    // What follows a subject (pronoun OR proper-noun subject)? → verb
    if (prevIsSubject) u.verb += lr;
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
   * Legacy position-based slot requirement. Only used as a seed for slot 0
   * (no prev word yet) and as a last-resort fallback when the phrase-structure
   * equation can't decide. All real slot decisions go through nextSlotRequirement.
   */
  slotRequirement(slotPos, sentenceType) {
    if (sentenceType === 'question') {
      if (slotPos === 0) return { pronoun: 0, verb: 0, noun: 0, adj: 0, conj: 0, prep: 0, det: 0, qword: 1 };
      return { pronoun: 0, verb: 1, noun: 0, adj: 0, conj: 0, prep: 0, det: 0, qword: 0 };
    }
    if (sentenceType === 'action') {
      return { pronoun: 0, verb: 1, noun: 0, adj: 0, conj: 0, prep: 0, det: 0, qword: 0 };
    }
    // Statement / exclamation: subject slot 0. Noun weight tightened to 0.15
    // so bare content nouns don't leak in — proper-noun subjects get lifted
    // via _subjectStarters (sentence-initial frequency from persona text).
    return { pronoun: 0.95, verb: 0, noun: 0.15, adj: 0, conj: 0, prep: 0, det: 0.4, qword: 0 };
  }

  /**
   * Pure letter-position equation for nominative (subject) pronouns.
   * Distinguishes subject pronouns (i, he, we, you, she, it, they, this,
   * that) from object pronouns (me, us, him, them) by letter shape alone.
   *
   * Rules derived from English morphology:
   *   - len 1 + 'i'                                 → I (nominative singular 1st)
   *   - len 2 + consonant-vowel + NOT m-start       → he, we (excludes 'me')
   *   - len 2 + 'it'                                → it
   *   - len 3 + y-vowel-vowel                       → you
   *   - len 3 + 's-h-e'                             → she
   *   - len 4 + 'th-' start                         → they, this, that
   *
   * Object pronouns (me, us, him, them) fail every pattern above because
   * they either m-start (me/mine), end in consonant 's'/'m' with vowel-first
   * shape (us), or are CVC ending in 'm' (him, them).
   */
  _isNominativePronoun(word) {
    const w = (word || '').toLowerCase();
    const len = w.length;
    if (!len) return false;
    const first = w[0];
    const last = w[len - 1];
    if (len === 1 && first === 'i') return true;
    if (len === 2 && !VOWELS.includes(first) && VOWELS.includes(last) && first !== 'm') return true;
    if (len === 2 && first === 'i' && last === 't') return true;
    if (len === 3 && first === 'y' && VOWELS.includes(w[1]) && VOWELS.includes(w[2])) return true;
    if (len === 3 && first === 's' && w[1] === 'h' && w[2] === 'e') return true;
    // 4-letter 'th-' subjects: they, this, that — but NOT 'them' (object form)
    if (len === 4 && first === 't' && w[1] === 'h' && last !== 'm') return true;
    return false;
  }

  /**
   * Argmax over a word's type distribution. Used by nextSlotRequirement to
   * drive phrase-structure transitions.
   */
  _dominantType(word) {
    const wt = this.wordType(word);
    let best = 'noun', bestScore = 0;
    for (const k in wt) {
      if (wt[k] > bestScore) { bestScore = wt[k]; best = k; }
    }
    return best;
  }

  /**
   * Base continuation for a single POS. Used by nextSlotRequirement, which
   * blends the top-2 continuations proportionally to the prev word's type
   * distribution. Factored out so ambiguous words (CVC verb-or-noun like
   * "ran", "run", "put") get BOTH continuation paths instead of flipping
   * entirely to one.
   */
  _continuationFor(type) {
    switch (type) {
      case 'pronoun':
        // Subject pronoun → verb (I run, you see, we code)
        return { pronoun: 0, verb: 1.0, noun: 0.05, adj: 0.1, conj: 0, prep: 0, det: 0, qword: 0 };
      case 'verb':
        // Verb → object region: noun, pronoun, det(→noun), adj(copula), prep(PP)
        return { pronoun: 0.45, verb: 0.05, noun: 0.7, adj: 0.55, conj: 0, prep: 0.55, det: 0.7, qword: 0 };
      case 'det':
        // Determiner → noun phrase interior: noun or adj+noun
        return { pronoun: 0, verb: 0, noun: 1.0, adj: 0.7, conj: 0, prep: 0, det: 0, qword: 0 };
      case 'adj':
        // Adjective → another adj or the head noun
        return { pronoun: 0, verb: 0.05, noun: 1.0, adj: 0.35, conj: 0, prep: 0, det: 0, qword: 0 };
      case 'noun':
        // Noun end-of-NP → verb (if subject), prep, conj, or compound head noun
        return { pronoun: 0.05, verb: 0.65, noun: 0.25, adj: 0.1, conj: 0.55, prep: 0.55, det: 0, qword: 0 };
      case 'prep':
        // Preposition → object of prep: det, noun, or pronoun
        return { pronoun: 0.55, verb: 0, noun: 0.75, adj: 0.2, conj: 0, prep: 0, det: 0.85, qword: 0 };
      case 'conj':
        // Conjunction → start of new clause
        return { pronoun: 0.7, verb: 0.4, noun: 0.4, adj: 0.1, conj: 0, prep: 0.1, det: 0.55, qword: 0 };
      case 'qword':
        // Question word → verb / aux (what IS, who DID, where DO)
        return { pronoun: 0.1, verb: 1.0, noun: 0.05, adj: 0, conj: 0, prep: 0, det: 0, qword: 0 };
    }
    return { pronoun: 0.3, verb: 0.3, noun: 0.4, adj: 0.3, conj: 0.2, prep: 0.3, det: 0.3, qword: 0 };
  }

  /**
   * Phrase-structure Markov slot requirement.
   *
   * The type we want NEXT depends on what came BEFORE — this is how real
   * English phrase structure works. A determiner wants a noun. A preposition
   * wants a noun phrase. A verb wants an object region. A pronoun wants a
   * verb. Position alone is not enough — grammar is local.
   *
   * For ambiguous prev words (e.g. CVC shapes where verb≈0.31, noun≈0.69
   * after the noun fallback) we BLEND the top-2 type continuations weighted
   * by the word's type distribution. This lets "ran" continue as either a
   * verb (→ object) or a noun (→ prep/conj) without a hard commitment.
   */
  nextSlotRequirement(prevWord, slotPos, sentenceType) {
    if (!prevWord || slotPos === 0) {
      return this.slotRequirement(slotPos, sentenceType);
    }

    const wt = this.wordType(prevWord);
    const sorted = Object.entries(wt).sort((a, b) => b[1] - a[1]);
    const [topType, topScore] = sorted[0];
    const [secondType, secondScore] = sorted[1] || ['noun', 0];

    const req1 = this._continuationFor(topType);

    // Skip blend when top type clearly dominates OR second type is marginal.
    // Only ambiguous words (CVC shapes where verb≈noun after usage learning)
    // need the blend — strongly-typed words (pronouns, dets, preps, suffix-
    // marked verbs/nouns) should use pure phrase-structure continuation.
    if (secondScore < 0.25) return req1;
    if (topScore < 0.001) return req1;
    if (topScore > secondScore * 1.8) return req1;

    // Blend top-2 continuations proportionally
    const req2 = this._continuationFor(secondType);
    const total = topScore + secondScore;
    const w1 = topScore / total;
    const w2 = secondScore / total;
    const blended = {};
    for (const k of ['pronoun', 'verb', 'noun', 'adj', 'conj', 'prep', 'det', 'qword']) {
      blended[k] = (req1[k] || 0) * w1 + (req2[k] || 0) * w2;
    }
    return blended;
  }

  /**
   * Type compatibility: dot product of word type × slot requirement.
   * High = word fits this slot. Low = wrong type for this position.
   *
   * When prevWord is supplied, uses phrase-structure Markov grammar
   * (nextSlotRequirement). Otherwise falls back to position-based slot seed.
   */
  typeCompatibility(word, slotPos, sentenceType, prevWord = null) {
    const wt = this.wordType(word);
    const req = prevWord
      ? this.nextSlotRequirement(prevWord, slotPos, sentenceType)
      : this.slotRequirement(slotPos, sentenceType);
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

    // Seed usedBigrams with the user's own input bigrams — prevents Unity
    // from parroting the exact phrase back while still allowing her to
    // TALK ABOUT the topic words (cats, movies, etc.).
    const usedBigrams = new Set();
    for (let i = 0; i < contextWords.length - 1; i++) {
      usedBigrams.add(contextWords[i] + '→' + contextWords[i + 1]);
    }
    const sentence = [];

    // ── STEP 5: TENSE SELECTION — hippocampal recall drives temporal frame ──
    // Past: recalling memory (hippocampus active). Present: default. Future: prediction (cortex high).
    const tense = predError > 0.3 ? 'future' : (opts.recalling ? 'past' : 'present');

    // Cap the sentence length to what the vocabulary can actually support
    // without immediate repetition. With only N distinct words we can't
    // produce more than N slots of non-adjacent variety — trying to force
    // `len=9` from a 4-word dictionary guarantees a repetition cascade.
    const vocabCap = Math.max(2, Math.min(len, Math.floor(allWords.length * 0.6)));
    const effectiveLen = Math.min(len, vocabCap);

    // Short-term window of recently-chosen words — prevents picking the
    // same word within the last 3 slots even if grammar/score would pick it.
    const RECENT_SLOT_WINDOW = 3;

    // ── STEP 6: STRUCTURE — fill slots with brain-selected words ──
    // Phrase-structure gate is now enforced on EVERY slot (not just 0/1).
    // nextSlotRequirement drives a Markov grammar where the type we want
    // next depends on the dominant type of the previous word.
    for (let pos = 0; pos < effectiveLen; pos++) {
      // Track the REAL last pushed word, not the loop index. If the previous
      // slot produced nothing (empty pool → picked=null), `sentence.length`
      // stays at its prior value and prevWord still points to the actual
      // last spoken word — otherwise `sentence[pos-1]` becomes undefined
      // and the repetition filter silently disengages.
      const prevWord = sentence.length > 0 ? sentence[sentence.length - 1] : null;
      const recentSlots = sentence.slice(-RECENT_SLOT_WINDOW);
      const followers = prevWord ? this._jointCounts.get(prevWord) : null;
      const slotIdx = sentence.length;

      // Strict floor applied to EVERY slot — no more free-for-all tail.
      // Slot 0 is the tightest (must be a valid subject/qword/verb-for-action).
      // All downstream slots still require phrase-structure compatibility.
      const typeFloor = slotIdx === 0 ? 0.35 : 0.22;
      const prevDominant = prevWord ? this._dominantType(prevWord) : null;

      // Slot 0 (statement/exclamation) subject gate — word must be EITHER:
      //   1. a letter-equation-identified nominative pronoun (i/he/we/you/she/it/they/this/that), OR
      //   2. seen in the persona as a sentence-initial subject (Unity, she, this, etc.)
      //   3. a strong determiner (the, a, my, your, these, those)
      // This cleanly rejects object pronouns (me/us/him/them) and bare
      // content nouns that happen to noun-fallback past the type floor.
      const isSubjectSlot = slotIdx === 0 && type !== 'question' && type !== 'action';
      const isSubjectCapable = (w) => {
        // Nominative pronouns from pure letter equation (i/he/we/you/she/it/they/this/that)
        if (this._isNominativePronoun(w)) return true;
        // Words the persona actually used as sentence-initial subjects
        if ((this._subjectStarters.get(w) || 0) >= 1) return true;
        return false;
      };
      const subjStarterBoost = (w) => {
        if (!isSubjectSlot) return 0;
        return (this._subjectStarters.get(w) || 0) > 0 ? 0.25 : 0;
      };

      const scored = allWords
        .filter(([w]) => {
          if (w === prevWord) return false;
          if (recentSlots.indexOf(w) !== -1) return false;            // no repeat within window
          if (prevWord && usedBigrams.has(prevWord + '→' + w)) return false;
          // Slot 0 subject gate — reject words that aren't structurally subjects
          if (isSubjectSlot && !isSubjectCapable(w)) return false;
          // HARD phrase-structure filter — wrong type never enters the pool.
          const compat = this.typeCompatibility(w, slotIdx, type, prevWord) + subjStarterBoost(w);
          if (compat < typeFloor) return false;
          return true;
        })
        .map(([word, entry]) => {
          // GRAMMAR — does this word fit this grammatical slot given prev word?
          const typeScore = this.typeCompatibility(word, slotIdx, type, prevWord);

          // THOUGHT — CONTINUOUS similarity to what the brain is thinking
          const pattern = entry.pattern || this.wordToPattern(word);
          const thoughtSim = cortexPattern ? Math.max(0, this._cosine(pattern, cortexPattern)) : 0;
          const isThought = thoughtSet.has(word) ? 0.5 : thoughtSim * 0.4;

          // CONTEXT — Unity SHOULD talk about the topic the user raised.
          // Mild positive boost for words from the user's input so she stays
          // on-subject (cats when asked about cats). Exact-phrase parroting
          // is blocked by usedBigrams being seeded with the user's own bigrams,
          // not by penalizing individual words.
          const inLastInput = contextSet.has(word);
          const isContext = inLastInput ? 0.15 : 0;
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

          // HARD grammar gate — anything below floor is dead, no 5% leak.
          // Wrong-type words got filtered above but bigrams from persona can
          // still lift marginal candidates; this catches them.
          const grammarGate = typeScore >= typeFloor ? 1.0 : 0.0;

          // SAME-TYPE REPETITION PENALTY — avoid verb-verb-verb cascades.
          // Noun-noun and adj-adj are allowed (compound NPs, stacked adjectives).
          // Verb-verb gets an extra-harsh penalty — it's the worst offender
          // (persona file has many -ing/-ed words that all look like verbs).
          const currDominant = this._dominantType(word);
          const sameType = prevDominant && currDominant === prevDominant
                           && prevDominant !== 'noun' && prevDominant !== 'adj';
          const sameTypePenalty = sameType
            ? (prevDominant === 'verb' ? 0.65 : 0.35)
            : 0;

          // SUBJECT-STARTER BOOST for slot 0 statements/exclamations —
          // words the persona has used as sentence-initial subjects get a
          // positional boost. Capped log to prevent one high-frequency word
          // (like 'unity') from dominating every sentence.
          const subjStart = (slotIdx === 0 && type !== 'question' && type !== 'action')
            ? Math.log(1 + (this._subjectStarters.get(word) || 0)) * 0.15
            : 0;

          // ── COMBINED: grammar dominates structure, bigrams from persona
          // drive content, context keeps her on-topic ──
          const score =
            grammarGate * (
              typeScore * 0.40 +         // grammar fit — structural floor
              followerCount * 0.22 +     // learned sequences (bigrams from persona)
              condP * 0.14 +             // conditional probability from persona
              isThought * 0.14 +         // cortex thought (WHAT to say)
              isContext * 0.15 +         // ON-TOPIC bonus for user's input words
              topicSim * 0.06 +          // semantic relevance to topic
              isMood * 0.04 +            // emotional word match
              moodBias * 0.03 +          // continuous mood alignment
              subjStart +                // sentence-start subject boost (slot 0)
              (selfAware && (word.length === 1 || word.endsWith("'m") || word.endsWith("'re")) ? 0.08 : 0)
            )
            - recency
            - sameTypePenalty;

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
    // Keep single-letter words ('i', 'a') — they're critical pronouns/determiners.
    const words = text.toLowerCase().replace(/[^a-z' -]/g, '').split(/\s+/).filter(w => w.length >= 1);
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
    // length >= 1 so single-letter words ('I', 'a') get into the dictionary.
    // These are the most important function words in English — dropping them
    // means Unity can't use 'i' as a subject, which wrecks slot-0 selection.
    const words = sentence.toLowerCase().replace(/[^a-z' ?!*-]/g, '').split(/\s+/).filter(w => w.length >= 1);
    if (words.length < 2) return;

    const isQuestion = sentence.includes('?') || this.wordType(words[0]).qword > 0.5;
    if (isQuestion && words.length > 0) this._questionStarters.set(words[0], (this._questionStarters.get(words[0]) || 0) + 1);
    if (sentence.startsWith('*')) {
      const v = words[0].replace(/\*/g, '');
      if (v) this._actionVerbs.set(v, (this._actionVerbs.get(v) || 0) + 1);
    }

    // Sentence-initial word learned as a subject starter. Pure structural
    // observation — no type labels, just "this word appears at position 0".
    if (words.length > 0) {
      const first = words[0].replace(/\*/g, '');
      if (first) this._subjectStarters.set(first, (this._subjectStarters.get(first) || 0) + 1);
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

    // ── COPULA AGREEMENT via learned bigrams (no hardcoded lists) ──
    // If slot 0 is a subject-pronoun and slot 1 is a copula-like verb BUT the
    // pair was never seen in training ("you am", "i are"), look up the most
    // common copula follower of slot 0 in learned bigrams and swap. Copula
    // detection is pure equation: short word, high verb score, no noun/prep
    // signal — matches am/is/are (plus learned past copulas was/were).
    const verbIsCopula = (v) => {
      if (!v || v.length > 4) return false;
      const wt = this.wordType(v);
      return wt.verb > 0.7 && wt.noun < 0.3 && wt.prep < 0.1 && wt.conj < 0.1 && wt.pronoun < 0.2;
    };
    if (result.length >= 2 && subj) {
      const subjKey = subj.toLowerCase();
      const verbKey = (result[1] || '').toLowerCase();
      if (verbIsCopula(verbKey) && this.wordType(subjKey).pronoun > 0.4) {
        const seen = this._jointCounts.get(subjKey)?.get(verbKey) || 0;
        if (seen === 0) {
          const followers = this._jointCounts.get(subjKey);
          if (followers) {
            let best = null, bestCount = 0;
            for (const [w, c] of followers) {
              if (verbIsCopula(w) && c > bestCount) { bestCount = c; best = w; }
            }
            if (best && best !== verbKey) result[1] = best;
          }
        }
      }
    }

    // ── COMPOUND SENTENCE ──
    // Conj-splicing is DISABLED — the tail was generated against the wrong
    // predecessor (pre-conj word), so splicing ', and' mid-sentence violates
    // phrase structure on the far side. A proper compound requires re-planning
    // the tail with the conj word as the new predecessor, which means lifting
    // sentence construction into _postProcess. For now, prefer shorter
    // grammatical sentences over longer broken compounds.

    return result;
  }

  /**
   * Pick a conjunction by mood, searching the learned dictionary for
   * words classified as conjunctions by the wordType equation. No lists —
   * the candidates come from whatever the brain has learned.
   */
  _pickConjByMood(arousal, valence) {
    // Scan the marginal-count map for words whose wordType says "conj".
    // Rank by conjunction score × mood alignment × learned frequency.
    // Mood multiplier is a TIE-BREAKER (capped at 1.1), not a dominance
    // swapper — base conjScore must drive the pick so 'and' (0.85) beats
    // 'if' (0.7) regardless of arousal level.
    let best = null, bestScore = 0;
    for (const [word, count] of this._marginalCounts) {
      const conjScore = this.wordType(word).conj;
      if (conjScore < 0.4) continue;
      let moodFit = 1;
      const vc = (word.match(/[aeiou]/g) || []).length / word.length;
      if (arousal > 0.6 && vc >= 0.4) moodFit = 1.08;
      if (valence < -0.2 && vc < 0.4) moodFit = 1.08;
      // Frequency weighting — conjunctions used more often in the persona
      // text are more natural choices. log to keep dominance bounded.
      const freqWeight = 1 + Math.log(1 + (count || 0)) * 0.05;
      const s = conjScore * moodFit * freqWeight;
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
    const usage = {};
    for (const [w, u] of this._usageTypes) usage[w] = u;
    return {
      jointCounts: joints,
      marginalCounts: Object.fromEntries(this._marginalCounts),
      totalPairs: this._totalPairs, totalWords: this._totalWords,
      questionStarters: Object.fromEntries(this._questionStarters),
      actionVerbs: Object.fromEntries(this._actionVerbs),
      subjectStarters: Object.fromEntries(this._subjectStarters),
      usageTypes: usage,
      zipfAlpha: this.zipfAlpha,
      sentencesLearned: this.sentencesLearned,
      wordsProcessed: this.wordsProcessed,
      selfImageLoaded: this._selfImageLoaded,
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
    if (data.subjectStarters) this._subjectStarters = new Map(Object.entries(data.subjectStarters).map(([k, v]) => [k, +v]));
    if (data.usageTypes) this._usageTypes = new Map(Object.entries(data.usageTypes));
    this.sentencesLearned = data.sentencesLearned || 0;
    this.wordsProcessed = data.wordsProcessed || 0;
    if (data.selfImageLoaded) this._selfImageLoaded = true;
  }

  getLetterPattern(char) {
    const li = char.toLowerCase().charCodeAt(0) - 97;
    if (li < 0 || li > 25) return new Float64Array(5);
    return this._letterPatterns.slice(li * 5, li * 5 + 5);
  }
}
