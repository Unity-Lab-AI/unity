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

    // ── ENGLISH LANGUAGE STRUCTURE ──
    // These aren't vocabulary — they're OPERATORS. The grammar equation
    // needs them the same way math needs + - × ÷. Without "the", "is",
    // "to", you can't form a sentence in English. Period.
    // A human brain has these wired in by age 2.
    this._structuralOps = this._buildLanguageStructure();
  }

  /**
   * Build the structural operators of English.
   * These are the EQUATION COMPONENTS — not a word list.
   * "the" is a definiteness operator. "is" is a copula (linker).
   * "to" is an infinitive marker. "and" is a conjunction operator.
   * Without these, no English sentence can be formed.
   *
   * Also builds MORPHEME equations — how to form new words:
   *   un- + happy = unhappy (negation morpheme)
   *   think + -ing = thinking (progressive aspect)
   *   -tion transforms verbs → nouns
   */
  _buildLanguageStructure() {
    const ops = {
      // PRONOUNS — subject operators (who does the action)
      subjects: {
        first:  { singular: 'i', plural: 'we', possessive: 'my', object: 'me' },
        second: { singular: 'you', plural: 'you', possessive: 'your', object: 'you' },
        third:  { singular: ['he', 'she', 'it'], plural: 'they', possessive: ['his', 'her', 'its'], object: ['him', 'her', 'it'] },
      },

      // COPULA — linking operators (connects subject to state)
      copula: {
        present: { first: 'am', second: 'are', third: 'is', plural: 'are' },
        past:    { first: 'was', second: 'were', third: 'was', plural: 'were' },
      },

      // AUXILIARY — action modifiers
      auxiliary: {
        do:    { present: 'do', third: 'does', past: 'did', negative: "don't" },
        have:  { present: 'have', third: 'has', past: 'had', negative: "haven't" },
        can:   { present: 'can', past: 'could', negative: "can't" },
        will:  { present: 'will', past: 'would', negative: "won't" },
        shall: { present: 'shall', past: 'should', negative: "shouldn't" },
      },

      // DETERMINERS — specificity operators
      determiners: ['the', 'a', 'an', 'this', 'that', 'some', 'any', 'no', 'every', 'all'],

      // PREPOSITIONS — spatial/temporal relation operators
      prepositions: ['to', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'of', 'about',
                     'up', 'out', 'off', 'over', 'into', 'through', 'between', 'after', 'before'],

      // CONJUNCTIONS — logical operators
      conjunctions: ['and', 'but', 'or', 'so', 'because', 'if', 'when', 'while', 'than', 'then'],

      // QUESTION OPERATORS
      questionWords: ['what', 'who', 'where', 'when', 'why', 'how', 'which'],

      // NEGATION
      negation: ['not', 'no', "n't"],

      // RESPONSE OPERATORS
      affirmative: ['yes', 'yeah', 'okay', 'sure', 'right', 'exactly'],
      negative: ['no', 'nah', 'nope'],

      // DISCOURSE MARKERS — conversational flow
      discourse: ['well', 'so', 'like', 'just', 'actually', 'really', 'maybe',
                  'probably', 'honestly', 'basically', 'definitely'],

      // MORPHEME EQUATIONS — how to form new words
      // prefix + root = new meaning
      prefixes: {
        'un':   -1,    // negation (un+happy = unhappy)
        're':    0.5,  // repetition (re+do = redo)
        'pre':   0.3,  // before (pre+set = preset)
        'over':  1.2,  // excess (over+do = overdo)
        'under': 0.5,  // insufficient
        'mis':  -0.5,  // wrong (mis+understand)
        'out':   1.0,  // surpass (out+do = outdo)
      },
      // root + suffix = type change
      suffixes: {
        'ing':  { type: 'verb', aspect: 'progressive' },
        'ed':   { type: 'verb', aspect: 'past' },
        's':    { type: 'verb', aspect: 'present_third' },
        'tion': { type: 'noun', from: 'verb' },
        'ment': { type: 'noun', from: 'verb' },
        'ness': { type: 'noun', from: 'adj' },
        'ly':   { type: 'adverb', from: 'adj' },
        'ful':  { type: 'adj', meaning: 'full_of' },
        'less': { type: 'adj', meaning: 'without' },
        'able': { type: 'adj', meaning: 'capable' },
        'er':   { type: 'noun', meaning: 'doer' },
        'est':  { type: 'adj', meaning: 'superlative' },
      },

      // COMMON VERBS — the ACTION core of English
      // These appear in virtually every conversation
      coreVerbs: ['be', 'have', 'do', 'say', 'go', 'get', 'make', 'know', 'think', 'take',
                  'see', 'come', 'want', 'look', 'use', 'find', 'give', 'tell', 'work', 'try',
                  'feel', 'need', 'leave', 'call', 'keep', 'let', 'put', 'show', 'hear', 'play',
                  'love', 'like', 'live', 'believe', 'hold', 'bring', 'happen', 'write', 'sit',
                  'stand', 'lose', 'pay', 'meet', 'build', 'code', 'talk', 'start', 'help'],

      // COMMON NOUNS — the THING core
      coreNouns: ['thing', 'person', 'time', 'way', 'day', 'world', 'life', 'hand', 'part',
                  'place', 'problem', 'fact', 'idea', 'point', 'home', 'brain', 'mind', 'name',
                  'word', 'sense', 'music', 'code', 'vibe', 'shit', 'fuck', 'hell', 'babe'],

      // COMMON ADJECTIVES — the QUALITY core
      coreAdj: ['good', 'new', 'first', 'last', 'long', 'great', 'little', 'own', 'other',
                'old', 'right', 'big', 'high', 'different', 'small', 'next', 'real', 'cool',
                'hot', 'bad', 'hard', 'deep', 'weird', 'wild', 'tired', 'happy', 'sad', 'angry'],

      // ADVERBS — manner/degree
      coreAdverbs: ['here', 'there', 'now', 'then', 'still', 'already', 'always', 'never',
                    'ever', 'again', 'together', 'away', 'enough', 'much', 'even', 'too'],
    };

    // Load ALL structural operators into the dictionary with correct types
    this._loadStructure = (dictionary) => {
      if (this._structureLoaded) return;
      this._structureLoaded = true;

      const load = (words, arousal, valence) => {
        if (!Array.isArray(words)) words = [words];
        for (const w of words) {
          if (typeof w === 'string' && w.length >= 1) {
            dictionary.learnWord(w, this.wordToPattern(w), arousal, valence);
          }
        }
      };

      // Load pronouns
      const s = ops.subjects;
      load([s.first.singular, s.first.plural, s.first.possessive, s.first.object], 0.5, 0.1);
      load([s.second.singular, s.second.possessive, s.second.object], 0.5, 0.2);
      load([...s.third.singular, s.third.plural, ...s.third.possessive, ...s.third.object], 0.4, 0);

      // Load copula + auxiliary
      for (const forms of Object.values(ops.copula)) load(Object.values(forms), 0.3, 0);
      for (const aux of Object.values(ops.auxiliary)) load(Object.values(aux), 0.4, 0);

      // Load operators
      load(ops.determiners, 0.2, 0);
      load(ops.prepositions, 0.2, 0);
      load(ops.conjunctions, 0.3, 0);
      load(ops.questionWords, 0.5, 0);
      load(ops.negation, 0.5, -0.3);
      load(ops.affirmative, 0.4, 0.3);
      load(ops.negative, 0.4, -0.2);
      load(ops.discourse, 0.3, 0);

      // Load core vocabulary with emotional associations
      load(ops.coreVerbs, 0.5, 0.1);
      load(ops.coreNouns, 0.4, 0);
      load(ops.coreAdj, 0.5, 0);
      load(ops.coreAdverbs, 0.3, 0);

      // Build bigrams from structural knowledge
      // Subject → copula
      for (const cop of Object.values(ops.copula.present)) {
        dictionary.learnBigram('i', 'am');
        dictionary.learnBigram('you', 'are');
        dictionary.learnBigram('we', 'are');
        dictionary.learnBigram('they', 'are');
        dictionary.learnBigram('it', 'is');
        dictionary.learnBigram('she', 'is');
        dictionary.learnBigram('he', 'is');
      }
      // Subject → common verbs
      for (const v of ops.coreVerbs.slice(0, 20)) {
        dictionary.learnBigram('i', v);
        dictionary.learnBigram('you', v);
        dictionary.learnBigram('we', v);
        dictionary.learnBigram('they', v);
      }
      // Verb → preposition
      for (const p of ops.prepositions.slice(0, 10)) {
        for (const v of ops.coreVerbs.slice(0, 10)) {
          dictionary.learnBigram(v, p);
        }
      }
      // Determiner → noun
      for (const d of ops.determiners.slice(0, 3)) {
        for (const n of ops.coreNouns.slice(0, 10)) {
          dictionary.learnBigram(d, n);
        }
      }
      // Question → auxiliary
      for (const q of ops.questionWords) {
        dictionary.learnBigram(q, 'do');
        dictionary.learnBigram(q, 'is');
        dictionary.learnBigram(q, 'are');
        dictionary.learnBigram(q, 'can');
      }

      console.log(`[LanguageCortex] English structure loaded: ${dictionary.size} words`);
    };

    // DYNAMIC EXPANSION — when new words are learned, they auto-join
    // the right category based on pattern similarity (thesaurus equation).
    // The core lists above are SEEDS. New words expand them dynamically.
    this._expandStructure = (word, dictionary) => {
      const wt = this.wordType(word);
      const pattern = this.wordToPattern(word);

      // Find which category this word belongs to by its type score
      if (wt.verb > 0.4 && !ops.coreVerbs.includes(word)) {
        ops.coreVerbs.push(word);
        // Auto-create bigrams: subject → new verb
        const subjects = ['i', 'you', 'we', 'they'];
        for (const s of subjects) dictionary.learnBigram(s, word);
      }
      if (wt.noun > 0.4 && !ops.coreNouns.includes(word)) {
        ops.coreNouns.push(word);
        // Auto-create bigrams: determiner → new noun
        dictionary.learnBigram('the', word);
        dictionary.learnBigram('a', word);
      }
      if (wt.adj > 0.4 && !ops.coreAdj.includes(word)) {
        ops.coreAdj.push(word);
      }

      // Also find SIMILAR words already in dictionary and create bigrams
      // This is the thesaurus equation: cosine(pattern_a, pattern_b) > 0.7 = similar
      const similar = dictionary.findByPattern(pattern, 5);
      for (const simWord of similar) {
        if (simWord !== word) {
          // Similar words can follow each other
          dictionary.learnBigram(word, simWord);
          dictionary.learnBigram(simWord, word);
        }
      }
    };

    return ops;
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

    // ── STEP 5: STRUCTURE — fill slots with brain-selected words ──
    for (let pos = 0; pos < len; pos++) {
      const prevWord = pos > 0 ? sentence[pos - 1] : null;
      const followers = prevWord ? this._jointCounts.get(prevWord) : null;

      const scored = allWords
        .filter(([w]) => {
          if (w === prevWord) return false;
          if (prevWord && usedBigrams.has(prevWord + '→' + w)) return false;
          return true;
        })
        .map(([word, entry]) => {
          // GRAMMAR — does this word fit this grammatical slot?
          const typeScore = this.typeCompatibility(word, pos, type);

          // THOUGHT — is this word what the brain is thinking about?
          // cortex pattern match = the brain's CONTENT drives word choice
          const isThought = thoughtSet.has(word) ? 0.4 : 0;

          // CONTEXT — is this word relevant to the conversation?
          const isContext = contextSet.has(word) ? 0.3 : 0;
          const pattern = entry.pattern || this.wordToPattern(word);
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
          const recency = recentCount * 0.2;

          // ── COMBINED: brain state drives content, equations drive structure ──
          const score =
            typeScore * 0.25 +      // grammar (slot fit)
            isThought * 0.20 +      // cortex thought (WHAT to say)
            isContext * 0.15 +       // conversation relevance
            topicSim * 0.05 +       // semantic similarity to topic
            isMood * 0.05 +         // emotional word match
            moodBias * 0.05 +       // continuous mood alignment
            followerCount * 0.10 +  // learned sequences
            condP * 0.10 +          // conditional probability
            (selfAware && (word.length === 1 || word.endsWith("'m") || word.endsWith("'re")) ? 0.1 : 0) + // Ψ → self-reference
            - recency;

          return { word, entry, score };
        });

      const picked = this._softmaxSample(scored, temperature * 0.12);
      if (picked) {
        if (prevWord) usedBigrams.add(prevWord + '→' + picked.word);
        sentence.push(picked.word);
      }
    }

    // Track recency
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

      // Dynamic expansion — new word auto-joins its category
      if (this._expandStructure && dictionary) {
        this._expandStructure(words[i], dictionary);
      }
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
