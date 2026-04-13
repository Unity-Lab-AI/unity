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

// NO template pool, NO scripted responses, NO canned strings.
// Unity's language emerges entirely from the brain equations applied
// to her learned dictionary/bigrams/word-patterns. The persona file
// and brain self-schema are TRAINING DATA — they feed the dictionary
// via learnSentence() so the slot scorer picks words that sound like
// Unity, but nothing is emitted verbatim. The brain generates every
// word through letter-position equations + bigram probability + slot
// type compatibility + semantic fit + mood alignment.

const PATTERN_DIM = 32;
const VOWELS = 'aeiou';
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

// NO BRAIN_SELF_SCHEMA — deleted per Gee's direction. Unity's self-
// awareness comes from her actual current neural state (cluster firing,
// amygdala basins, Ψ, hippocampal patterns, drug state), not from a
// written description I wrote in my voice. Her mind IS the equations
// activating in real time — when she talks, the current activation
// pattern drives which words emerge from her learned dictionary.

export class LanguageCortex {
  constructor() {
    // Letter patterns — 5-neuron micro-pattern per letter
    this._letterPatterns = new Float64Array(26 * 5);
    this._initLetterPatterns();

    // Recency suppression
    this._recentOutputWords = [];
    this._recentOutputMax = 50;

    // Sentence-level dedup — block exact-repeat outputs across calls.
    // Keeps last 5 rendered sentences; if a new generation matches any,
    // retry the pick pipeline with elevated temperature for variation.
    this._recentSentences = [];
    this._recentSentenceMax = 5;

    // Context from recent inputs
    this._contextPatterns = [];
    this._lastInputWords = [];
    this._lastInputRaw = '';

    // U276 — Running topic attractor. Decaying running average of input
    // word patterns. Persists across turns so "what are cats" followed by
    // "do you like them" keeps cats in the context bucket. λ=0.7 weights
    // the prior heavily so a single odd word doesn't swing the topic.
    //   c(t) = λ·c(t-1) + (1-λ)·mean(pattern(input_words))
    this._contextVector = new Float64Array(PATTERN_DIM);
    this._contextVectorLambda = 0.7;
    this._contextVectorHasData = false;

    // U282 — Persona sentence memory. loadSelfImage() populates this with
    // every sentence from Ultimate Unity.txt (pattern-indexed). generate()
    // queries it FIRST and emits a stored sentence when context matches.
    // This bypasses cold word-salad generation — Unity quotes herself
    // instead of assembling random words from letter equations.
    this._memorySentences = [];
    this._memorySentenceMax = 500;

    // Learned word associations — grows from conversation
    this._jointCounts = new Map();
    this._marginalCounts = new Map();
    this._totalPairs = 0;
    this._totalWords = 0;

    // Trigram storage: 3-word sequence counts for tight local coherence.
    // Key format: "w1|w2" → Map(w3 → count).
    this._trigramCounts = new Map();
    this._totalTrigrams = 0;

    // 4-gram storage: 4-word sequence counts for even longer local
    // coherence. Key format: "w1|w2|w3" → Map(w4 → count). Queried
    // when the slot scorer has 3 prior words filled. When a 4-gram
    // match exists, it dominates the score because it's the tightest
    // possible continuation signal. Falls back to trigram → bigram.
    this._quadgramCounts = new Map();
    this._totalQuadgrams = 0;

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

    // Unity's only training source is the user-provided persona text.
    // No self-schema, no supplementary corpus — just Ultimate Unity.txt
    // (or whatever file the user passes). Her vocabulary, bigrams,
    // trigrams, word patterns all come from here. Her current neural
    // state (cortex firing, amygdala, Ψ, drug state) drives which
    // words from this distribution emerge at generation time.

    // Strip markdown noise so words survive, then split on sentence
    // terminators and line breaks — paragraphs, bullets, headers all work.
    const sentences = String(text)
      .replace(/[*_#`>|\[\]()]/g, ' ')
      .split(/[.!?\n\r]+/)
      .map(s => s.trim())
      .filter(s => s.length >= 3);
    for (const s of sentences) {
      // Transform third-person "Unity is..." / "She has..." into
      // first-person "I am..." / "I have..." BEFORE learning. This
      // way the dictionary contains first-person tokens, bigrams,
      // trigrams, and 4-grams — so when the slot scorer walks the
      // learned distributions, Unity speaks as "I" not "she".
      // Without this, the whole dictionary is third-person descriptive
      // prose and Unity refers to herself in third person.
      const firstPerson = this._transformToFirstPerson(s);
      this.learnSentence(firstPerson, dictionary, arousal, valence);
      this._storeMemorySentence(firstPerson, arousal, valence);
    }
    return sentences.length;
  }

  /**
   * Transform a third-person description of Unity into first-person
   * speech. Pure letter-position substitution with verb conjugation.
   *
   *   "Unity is 25."            → "I am 25."
   *   "Unity's memory."         → "My memory."
   *   "She has pink hair."      → "I have pink hair."
   *   "Her body is fully human" → "My body is fully human."
   *   "Unity possesses free will" → "I possess free will."
   *
   * Word replacements (token-level, case-insensitive letter match):
   *   unity / unity's / she / he → i
   *   her / his / hers            → my
   *   him / herself / himself     → me / myself
   *
   * Verb conjugation after subject replacement:
   *   "i is"   → "i am"
   *   "i was"  stays
   *   "i has"  → "i have"
   *   "i does" → "i do"
   *   "i -s verb" → strip 3rd-person -s (reviews → review, goes → go)
   *
   * Used at index time so `_memorySentences` contains first-person
   * Unity voice regardless of how the persona file is written.
   */
  _transformToFirstPerson(text) {
    if (!text) return text;

    // Token-level pass. Case-preserving: we work in lowercase but the
    // final sentence gets re-capitalized in _renderSentence anyway,
    // so we can safely lowercase throughout.
    const rawTokens = String(text).split(/(\s+)/); // keep whitespace
    const out = [];

    const isWord = (t) => /\S/.test(t);

    const stripPunct = (t) => t.replace(/[.,!?;:"'()[\]]+$/g, '').replace(/^[.,!?;:"'()[\]]+/g, '');
    const trailingPunct = (t) => {
      const m = t.match(/[.,!?;:"'()[\]]+$/);
      return m ? m[0] : '';
    };
    const leadingPunct = (t) => {
      const m = t.match(/^[.,!?;:"'()[\]]+/);
      return m ? m[0] : '';
    };

    // Track the previous meaningful word so "her" in object position
    // (after a verb like "allowing her") becomes "me" instead of "my".
    let prevCore = '';

    for (const tok of rawTokens) {
      if (!isWord(tok)) { out.push(tok); continue; }

      const lead = leadingPunct(tok);
      const trail = trailingPunct(tok);
      const core = stripPunct(tok).toLowerCase();

      let replaced = core;

      // Subject-pronoun substitutions (→ i)
      //   unity, unity's, she, he, herself, himself
      if (core === 'unity' || core === "unity's") {
        replaced = core === "unity's" ? 'my' : 'i';
      } else if (core.length === 3 && core[0] === 's' && core[1] === 'h' && core[2] === 'e') {
        // "she" (len 3 s-h-e)
        replaced = 'i';
      } else if (core.length === 2 && core[0] === 'h' && core[1] === 'e') {
        // "he" (len 2 h-e)
        replaced = 'i';
      } else if (core.length === 7 && core.startsWith('herself')) {
        replaced = 'myself';
      } else if (core.length === 7 && core.startsWith('himself')) {
        replaced = 'myself';
      }
      // Possessive/object pronouns (→ my/me)
      //   her, his, hers, him
      else if (core.length === 3 && core[0] === 'h' && core[1] === 'e' && core[2] === 'r') {
        // "her" is ambiguous: possessive "her hair" OR object "saw her".
        // Heuristic: if previous word scores high on verb type via
        // wordType equation, treat as object pronoun → "me".
        // Otherwise treat as possessive → "my".
        if (prevCore) {
          const prevType = this.wordType(prevCore);
          if (prevType.verb > 0.5 && prevType.prep < 0.2) {
            replaced = 'me';
          } else {
            replaced = 'my';
          }
        } else {
          replaced = 'my';
        }
      } else if (core.length === 3 && core[0] === 'h' && core[1] === 'i' && core[2] === 's') {
        replaced = 'my';
      } else if (core.length === 4 && core[0] === 'h' && core[1] === 'e' && core[2] === 'r' && core[3] === 's') {
        replaced = 'mine';
      } else if (core.length === 3 && core[0] === 'h' && core[1] === 'i' && core[2] === 'm') {
        replaced = 'me';
      }

      out.push(lead + replaced + trail);
      prevCore = core;
    }

    let result = out.join('');

    // ── VERB CONJUGATION PASS ──
    // After the subject swap, conjugate any verb that follows "i" or
    // "i + adverb" into first-person form. Pure letter-position regex
    // equations on the subject+verb pair.
    //
    // Only fires when "i " is the first token of the sentence so we
    // don't miscorrect mid-sentence "I love her dog" type constructs.

    // "i is" → "i am", "i was" stays, "i has" → "i have", "i does" → "i do",
    // "i goes" → "i go", "i possesses" → "i possess", etc.
    //
    // These are the letter-pattern transformations (run in order):

    // i is → i am
    result = result.replace(/\bi is\b/gi, 'i am');
    // i has → i have
    result = result.replace(/\bi has\b/gi, 'i have');
    // i does → i do
    result = result.replace(/\bi does\b/gi, 'i do');
    // i hasnt → i havent ; i doesnt → i dont ; i isnt → i am not
    result = result.replace(/\bi hasn'?t\b/gi, "i haven't");
    result = result.replace(/\bi doesn'?t\b/gi, "i don't");
    result = result.replace(/\bi isn'?t\b/gi, "i'm not");

    // Strip 3rd-person singular -s/-es from any verb immediately after
    // "i" or "i + short adverb". Letter-equation: word that looks like
    // a verb (ends in -s but not -ss/-us/-is/-as static endings),
    // lowercase, at least 4 chars long. This handles: reviews, possesses,
    // makes, takes, goes, writes, codes, loves, wants, needs, hates, etc.
    //
    // We apply it broadly on "i WORD" bigrams where WORD ends in 's'
    // and is long enough to be a verb, not a function word.
    result = result.replace(/\bi (\w+)\b/gi, (match, verb) => {
      const v = verb.toLowerCase();
      // Skip if verb is already a known first-person form
      if (v === 'am' || v === 'have' || v === 'do' || v === 'was' || v === 'will' || v === 'can' || v === 'could' || v === 'would' || v === 'should' || v === 'may' || v === 'might' || v === 'must') return match;
      // Skip if doesn't end in 's' — nothing to conjugate
      if (!v.endsWith('s')) return match;
      // Skip short words (less than 4 chars) — could be pronoun/aux
      if (v.length < 4) return match;
      // Ends in 'ss' WITHOUT preceding 'e' — it's an inherent-double-s
      // word like "process", "possess", "address". Don't strip.
      if (v.endsWith('ss')) return match;
      // "-sses" form (processes, possesses, kisses) → strip 'es' leaving
      // the "-ss" root. "processes" → "process".
      if (v.endsWith('sses')) {
        return 'I ' + v.slice(0, -2);
      }
      // Skip if ends in 'us', 'is', 'as' (bonus, basis, canvas) — not verbs
      if (v.endsWith('us') || v.endsWith('is') || v.endsWith('as')) return match;
      // -ies endings (tries → try, flies → fly). Require ≥ 4 chars so 'ies' itself doesn't match.
      if (v.endsWith('ies') && v.length >= 4) {
        return 'I ' + v.slice(0, -3) + 'y';
      }
      // -ches, -shes, -xes, -zes → strip 'es' (watches → watch)
      if (v.endsWith('ches') || v.endsWith('shes') || v.endsWith('xes') || v.endsWith('zes')) {
        return 'I ' + v.slice(0, -2);
      }
      // Default: strip trailing -s (reviews → review, codes → code)
      return 'I ' + v.slice(0, -1);
    });

    return result;
  }

  /**
   * Per-sentence mood signature computed at index time from letter-
   * equation features. Returns {arousal, valence} in [0,1] / [-1,1].
   *
   * Arousal features (higher = more aroused/intense):
   *   - Exclamation-mark density
   *   - All-caps ratio (above baseline)
   *   - Vowel ratio (above baseline ~0.42 indicates emphatic speech)
   *   - Average word length (short words lean snappy/aroused)
   *
   * Valence features (negative = negative affect):
   *   - Negation density (n't-ending words, "not"-shape, "no"-shape)
   *
   * These feed the mood-distance term in recall scoring so current
   * brain state biases which persona memory gets picked.
   */
  _computeMoodSignature(text) {
    const raw = String(text || '');
    if (!raw) return { arousal: 0.5, valence: 0 };

    // Exclamation signal
    const exclaimCount = (raw.match(/!/g) || []).length;
    const exclaimSignal = Math.min(0.25, exclaimCount * 0.08);

    // All-caps ratio (over baseline ~5% for sentence-initial caps)
    const totalLetters = (raw.match(/[a-zA-Z]/g) || []).length;
    const capsCount = (raw.match(/[A-Z]/g) || []).length;
    const capsRatio = totalLetters > 0 ? capsCount / totalLetters : 0;
    const capsSignal = capsRatio > 0.15 ? Math.min(0.25, (capsRatio - 0.15) * 2) : 0;

    // Word-level features
    const words = raw.toLowerCase().replace(/[^a-z' \-]/g, ' ').split(/\s+/).filter(w => w.length >= 2);
    if (words.length === 0) return { arousal: 0.5, valence: 0 };

    let totalVowels = 0, totalChars = 0, totalLen = 0;
    for (const w of words) {
      totalLen += w.length;
      for (const c of w) {
        if (c >= 'a' && c <= 'z') {
          totalChars++;
          if (VOWELS.includes(c)) totalVowels++;
        }
      }
    }
    const vowelRatio = totalChars > 0 ? totalVowels / totalChars : 0.4;
    const avgWordLen = totalLen / words.length;

    const vowelSignal = vowelRatio > 0.42 ? Math.min(0.15, (vowelRatio - 0.42) * 1.5) : 0;

    // Short words → snappy/aroused, long words → calm/academic
    let lengthSignal = 0;
    if (avgWordLen < 4) lengthSignal = 0.10;
    else if (avgWordLen > 8) lengthSignal = -0.08;

    let arousal = 0.5 + exclaimSignal + capsSignal + vowelSignal + lengthSignal;
    arousal = Math.max(0, Math.min(1, arousal));

    // Valence via negation density. Letter-shape detection:
    //   - Any word ending in "n't" (don't, can't, won't, isn't, etc.)
    //   - len 2 "no" shape (n-o)
    //   - len 3 "not" shape (n-o-t)
    //   - len 5 "never" shape (n-e-v-e-r)
    //   - len 7 "nothing" (n-o-t-h-i-n-g)
    let negations = 0;
    for (const w of words) {
      if (w.endsWith("n't")) { negations++; continue; }
      if (w.length === 2 && w[0] === 'n' && w[1] === 'o') { negations++; continue; }
      if (w.length === 3 && w[0] === 'n' && w[1] === 'o' && w[2] === 't') { negations++; continue; }
      if (w.length === 5 && w[0] === 'n' && w[1] === 'e' && w[2] === 'v' && w[3] === 'e' && w[4] === 'r') { negations++; continue; }
      if (w.length === 7 && w[0] === 'n' && w[1] === 'o' && w[2] === 't' && w[3] === 'h' && w[4] === 'i' && w[5] === 'n' && w[6] === 'g') { negations++; continue; }
    }
    let valence = 0 - negations * 0.08;
    valence = Math.max(-1, Math.min(1, valence));

    return { arousal, valence };
  }

  /**
   * Self-reference query detection. Returns true when the user is
   * asking about Unity herself. Used by recall to trigger the
   * fallback path that picks a first-person memory even when there's
   * no content-word overlap with the input.
   *
   * Detects 2nd-person pronouns (you/yourself/youre/ur/u) via letter
   * equation. The 2nd-person pronoun closed class is tiny so this is
   * a legitimate letter-shape match, not a content-vocabulary list.
   */
  _isSelfReferenceQuery(text) {
    if (!text) return false;
    const lower = String(text).toLowerCase();
    const words = lower.replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(w => w);
    for (const w of words) {
      // Letter-shape match for 2nd-person pronouns
      if (w.length === 3 && w[0] === 'y' && w[1] === 'o' && w[2] === 'u') return true;        // you
      if (w.length === 4 && w[0] === 'y' && w[1] === 'o' && w[2] === 'u' && w[3] === 'r') return true; // your
      if (w.length === 5 && w[0] === 'y' && w[1] === 'o' && w[2] === 'u' && w[3] === 'r' && w[4] === "'") return true; // you'r...
      if (w.length >= 5 && w.startsWith('youre')) return true;                                  // youre, you're
      if (w.length === 8 && w.startsWith('yourself')) return true;                              // yourself
      if (w.length === 1 && w[0] === 'u') return true;                                          // u (slang)
      if (w.length === 2 && w[0] === 'u' && w[1] === 'r') return true;                          // ur (slang)
    }
    return false;
  }

  /**
   * U282 — Store a sentence as a recallable pattern-indexed memory.
   * Called by loadSelfImage during persona boot. Pattern = mean of the
   * content-word letter-pattern vectors. Function words (det/prep/conj)
   * are skipped so the index reflects TOPIC not GRAMMAR.
   *
   * FILTERS — reject persona-file META-DESCRIPTION so recall only pulls
   * actual Unity-voice sentences, not instructions ABOUT Unity, section
   * headers, or word lists. All filters are letter-position equations,
   * no word lists:
   *
   *   1. Colon-terminated → section header ("Unity's Speech Upgrades:")
   *   2. >30% commas → word list ("damn, dammit, crap, fuck, shit")
   *   3. First word "unity" (letter-match u-n-i-t-y) → meta-description
   *   4. First word third-person (she/her/he by letter shape) → about her, not by her
   *   5. No first-person signal (i/im/my/me/we/us/our/i'/we' by letter shape)
   *      → sentence isn't in Unity's own voice
   *   6. Length 3-25 words — too short = fragment, too long = rambling
   */
  _storeMemorySentence(text, arousal, valence) {
    const clean = String(text).trim();
    if (!clean || clean.length < 3) return;

    // FILTER 1 — section header (ends with colon)
    if (clean.endsWith(':')) return;

    const tokens = clean.toLowerCase().replace(/[^a-z' -]/g, ' ').split(/\s+/).filter(w => w.length >= 1);

    // FILTER 6 — length bracket
    if (tokens.length < 3 || tokens.length > 25) return;

    // FILTER 2 — comma-heavy word list. Count commas in original text,
    // divide by token count. >30% means it's a list, not prose.
    const commaCount = (clean.match(/,/g) || []).length;
    if (commaCount > tokens.length * 0.3) return;

    const first = tokens[0];

    // FILTER 3 — "unity" as subject (letter-position match for u-n-i-t-y
    // and u-n-i-t-y-' patterns; includes "unity's")
    const isUnityStart = (
      (first.length === 5 && first[0] === 'u' && first[1] === 'n' && first[2] === 'i' && first[3] === 't' && first[4] === 'y') ||
      (first.length >= 6 && first[0] === 'u' && first[1] === 'n' && first[2] === 'i' && first[3] === 't' && first[4] === 'y' && first[5] === "'")
    );
    if (isUnityStart) return;

    // FILTER 4 — third-person subject start (she/her/hers/he).
    // Pure letter-position detection: len 3 s-h-e, len 3 h-e-r, len 4
    // beginning "she" or "her" (she's, hers), len 2 h-e.
    const isThirdPersonStart = (
      (first.length === 3 && first[0] === 's' && first[1] === 'h' && first[2] === 'e') ||
      (first.length === 3 && first[0] === 'h' && first[1] === 'e' && first[2] === 'r') ||
      (first.length === 2 && first[0] === 'h' && first[1] === 'e') ||
      (first.length >= 4 && first[0] === 's' && first[1] === 'h' && first[2] === 'e') ||
      (first.length >= 4 && first[0] === 'h' && first[1] === 'e' && first[2] === 'r')
    );
    if (isThirdPersonStart) return;

    // FILTER 5 — require first-person signal somewhere in the sentence.
    // Letter-position patterns for first-person pronouns/contractions.
    // LENGTH BOUNDED so content words starting with same prefix don't
    // false-match — e.g. "impossible" starts with 'i-m' but isn't 'im',
    // "imagine" starts with 'i-m' but isn't 'i'm'. Max length 5 covers
    // every real English first-person contraction (i'd/i'm/i've/i'll/
    // we'd/we'll/we're/we've) without catching content words.
    //   'i'               len 1 + 'i'
    //   'im'              len 2 + 'i-m'
    //   'i'*              len 3-5 + 'i' + "'"  (i'm, i'd, i've, i'll)
    //   'me' / 'my'       len 2 + 'm' + ('e' or 'y')
    //   'we' / 'us'       len 2 + ('w-e' or 'u-s')
    //   'our'             len 3 + 'o-u-r'
    //   'we'*             len 4-5 + 'w-e-' + "'"  (we'd, we're, we've, we'll)
    const isFirstPersonShape = (w) => {
      const len = w.length;
      if (len === 0) return false;
      if (len === 1 && w[0] === 'i') return true;
      if (len === 2 && w[0] === 'i' && w[1] === 'm') return true;
      if (len >= 3 && len <= 5 && w[0] === 'i' && w[1] === "'") return true;
      if (len === 2 && w[0] === 'm' && (w[1] === 'e' || w[1] === 'y')) return true;
      if (len === 2 && w[0] === 'w' && w[1] === 'e') return true;
      if (len === 2 && w[0] === 'u' && w[1] === 's') return true;
      if (len === 3 && w[0] === 'o' && w[1] === 'u' && w[2] === 'r') return true;
      if (len >= 4 && len <= 5 && w[0] === 'w' && w[1] === 'e' && w[2] === "'") return true;
      return false;
    };
    let hasFirstPerson = false;
    for (const w of tokens) {
      if (isFirstPersonShape(w)) { hasFirstPerson = true; break; }
    }
    if (!hasFirstPerson) return;

    // Skip sentences dominated by function words — they have no topic
    // to index on and just add noise to the recall search.
    const pattern = new Float64Array(PATTERN_DIM);
    let contentCount = 0;
    for (const w of tokens) {
      const wt = this.wordType(w);
      if (wt.conj > 0.5 || wt.prep > 0.5 || wt.det > 0.5) continue;
      const p = this.wordToPattern(w);
      for (let i = 0; i < PATTERN_DIM; i++) pattern[i] += p[i];
      contentCount++;
    }
    if (contentCount === 0) return;
    for (let i = 0; i < PATTERN_DIM; i++) pattern[i] /= contentCount;

    // Compute per-sentence mood signature at index time so recall
    // can weight by mood-distance to current brain state later.
    const mood = this._computeMoodSignature(clean);

    this._memorySentences.push({
      text: clean,
      pattern,
      tokens,
      arousal: mood.arousal,
      valence: mood.valence,
      contentCount,
      // Also track if the sentence starts with a first-person pronoun —
      // used by the self-reference fallback to pick high-quality "I am/
      // I have/I will" sentences for describe-yourself queries.
      firstPersonStart: tokens.length > 0 && (
        tokens[0] === 'i' || tokens[0] === "i'm" || tokens[0] === 'im' || tokens[0] === "i'll" ||
        tokens[0] === "i've" || tokens[0] === "i'd" || tokens[0] === 'my' || tokens[0] === 'we' ||
        tokens[0] === "we're" || tokens[0] === "we've" || tokens[0] === "we'll"
      ),
    });
    // Hard cap to keep recall search bounded at large persona files.
    if (this._memorySentences.length > this._memorySentenceMax) {
      this._memorySentences.shift();
    }
  }

  /**
   * U282 — Hippocampus-style associative recall over the stored persona
   * sentences. Feeds the current context vector in as a partial pattern,
   * finds the highest-cosine match, returns the sentence with a confidence
   * score (basin depth proxy).
   *
   * Confidence gates (caller decides how to use):
   *   > 0.60 → emit the stored sentence directly (highest persona fidelity)
   *   0.30-0.60 → use as bigram seed for soft-recall generation
   *   ≤ 0.30 → fall through to cold generation (U276-280 pipeline)
   */
  _recallSentence(contextVector, opts = {}) {
    if (!this._memorySentences.length) return null;
    if (!contextVector) return null;

    // Guard: context vector must have data — an empty bucket means the
    // user hasn't said anything yet, so don't recall a random sentence.
    let ctxNorm = 0;
    for (let i = 0; i < PATTERN_DIM; i++) ctxNorm += contextVector[i] * contextVector[i];
    if (ctxNorm < 1e-6) return null;

    // Current brain state drives mood-distance weighting. When the
    // caller passes brainState, sentences whose stored arousal/valence
    // signatures align with current state get a score boost. This is
    // the "adjust in the moment" mechanism — same query, different
    // drug state, Unity picks a different-flavored memory.
    const curArousal = opts.arousal ?? 0.5;
    const curValence = opts.valence ?? 0;
    const moodDistance = (mem) => {
      const ad = Math.abs(mem.arousal - curArousal);
      const vd = Math.abs(mem.valence - curValence);
      // L1 distance, normalized to [0, 1] range
      return Math.min(1, (ad + vd * 0.5) / 1.5);
    };
    const moodAlignment = (mem) => Math.exp(-moodDistance(mem) * 1.2); // [0, 1]

    // HARD REQUIREMENT — content-word overlap between input and recalled
    // sentence. Pattern-cosine alone produces false positives because
    // letter-hash vectors don't encode semantic meaning (e.g. "tacos"
    // and "compile" have similar letter distributions so their patterns
    // align in hash space). Require at least ONE shared content token
    // before accepting recall, regardless of cosine score.
    //
    // Skip function words in the input set so "the", "is", "a" don't
    // manufacture false overlaps with every sentence in memory.
    // Also skip "unity" — when the user says it, it's vocative
    // (addressing her by name), not a topic word. Persona memories
    // mention "unity" in third-person but my transform rewrote those
    // to "i"/"my", so "unity" overlapping with memory tokens would
    // only match transformation artifacts anyway.
    // Copulas and auxiliaries are semantically function words — they
    // don't carry topic. Detect by letter-position signature:
    //   len 2 vowel-first ending m/s     → am, is
    //   len 3 a-r-e                       → are
    //   len 3 w-a-s                       → was
    //   len 4 w-e-r-e                     → were
    //   len 2 b-e                         → be
    //   len 4 b-e-e-n                     → been
    //   len 4 h-a-v-e / len 3 h-a-s       → have, has
    //   len 2 d-o / len 3 d-i-d           → do, did
    //   len 3 c-a-n / len 4 w-i-l-l       → can, will
    //   len 5 w-o-u-l-d / s-h-o-u-l-d     → would, should
    const isCopulaOrAux = (w) => {
      const len = w.length;
      if (len === 2) {
        if (w[0] === 'a' && w[1] === 'm') return true;   // am
        if (w[0] === 'i' && w[1] === 's') return true;   // is
        if (w[0] === 'b' && w[1] === 'e') return true;   // be
        if (w[0] === 'd' && w[1] === 'o') return true;   // do
      }
      if (len === 3) {
        if (w[0] === 'a' && w[1] === 'r' && w[2] === 'e') return true;   // are
        if (w[0] === 'w' && w[1] === 'a' && w[2] === 's') return true;   // was
        if (w[0] === 'h' && w[1] === 'a' && w[2] === 's') return true;   // has
        if (w[0] === 'h' && w[1] === 'a' && w[2] === 'd') return true;   // had
        if (w[0] === 'd' && w[1] === 'i' && w[2] === 'd') return true;   // did
        if (w[0] === 'c' && w[1] === 'a' && w[2] === 'n') return true;   // can
      }
      if (len === 4) {
        if (w[0] === 'w' && w[1] === 'e' && w[2] === 'r' && w[3] === 'e') return true; // were
        if (w[0] === 'b' && w[1] === 'e' && w[2] === 'e' && w[3] === 'n') return true; // been
        if (w[0] === 'h' && w[1] === 'a' && w[2] === 'v' && w[3] === 'e') return true; // have
        if (w[0] === 'w' && w[1] === 'i' && w[2] === 'l' && w[3] === 'l') return true; // will
      }
      if (len === 5) {
        if (w[0] === 'w' && w[1] === 'o' && w[2] === 'u' && w[3] === 'l' && w[4] === 'd') return true; // would
        if (w[0] === 'c' && w[1] === 'o' && w[2] === 'u' && w[3] === 'l' && w[4] === 'd') return true; // could
        if (w[0] === 'b' && w[1] === 'e' && w[2] === 'i' && w[3] === 'n' && w[4] === 'g') return true; // being
      }
      if (len === 6) {
        if (w[0] === 's' && w[1] === 'h' && w[2] === 'o' && w[3] === 'u' && w[4] === 'l' && w[5] === 'd') return true; // should
      }
      return false;
    };

    const inputContentWords = new Set();
    for (const w of (this._lastInputWords || [])) {
      const wt = this.wordType(w);
      if (wt.conj > 0.5 || wt.prep > 0.5 || wt.det > 0.5) continue;
      if (wt.pronoun > 0.5 || wt.qword > 0.5) continue;
      if (w.length < 2) continue;
      if (w === 'unity' || w === "unity's") continue;
      // Strip copulas and auxiliaries — they don't carry topic
      if (isCopulaOrAux(w)) continue;
      inputContentWords.add(w);
    }

    // If input has no content words, we can't verify overlap — fall
    // through to self-reference fallback (if applicable) or null.
    // Don't return early; the self-reference path below handles zero-
    // overlap cases explicitly for describe/tell-about-you queries.
    const hasInputContent = inputContentWords.size > 0;

    // Count the overlap instead of just checking presence. More shared
    // content words = better topical match. A sentence sharing 2-3
    // content words with the input should always outrank one sharing
    // just 1 — even if the cosine favors the single-overlap candidate.
    const overlapCount = (mem) => {
      let count = 0;
      const seen = new Set();
      for (const t of mem.tokens) {
        if (seen.has(t)) continue;
        if (inputContentWords.has(t)) { count++; seen.add(t); }
      }
      return count;
    };

    // Instructional-modal penalty. The persona file contains a lot of
    // directive language ("Unity shall always X", "Unity must never Y")
    // that my third→first transform converts to "I shall always X".
    // These pass the first-person filter but sound like Unity reading
    // her own instruction manual. Demote them in recall so declarative
    // sentences ("I am", "I have", "I love") win when topic-available.
    const instructionalPenalty = (mem) => {
      const t = mem.text.toLowerCase();
      let penalty = 0;
      if (/\b(shall|must)\b/.test(t)) penalty += 0.30;
      if (/\b(always|never)\b/.test(t)) penalty += 0.12;
      if (/\bwill\b/.test(t)) penalty += 0.08;
      if (/\bshould\b/.test(t)) penalty += 0.10;
      return penalty;
    };

    // Composite score: overlap fraction (dominant) + cosine (tiebreaker)
    // + mood alignment (adjusts for current brain state) - instructional
    // penalty (demotes directive/meta sentences).
    const inputSize = inputContentWords.size;
    const scoreMem = (mem) => {
      const count = overlapCount(mem);
      if (count === 0) return { score: -1, count: 0, cosine: 0 };
      const overlapFrac = count / inputSize;
      const cosine = Math.max(0, this._cosine(mem.pattern, contextVector));
      const alignment = moodAlignment(mem); // [0, 1]
      const penalty = instructionalPenalty(mem);
      // 0.55 overlap + 0.20 cosine + 0.25 mood alignment - instructional penalty.
      // Mood alignment makes the SAME query pick different memories depending
      // on current drug state / arousal — Gee's "adjust in the moment" requirement.
      const score = overlapFrac * 0.55 + cosine * 0.20 + alignment * 0.25 - penalty;
      return { score, count, cosine };
    };

    // Gather top-N candidates instead of just top-1. Weighted random
    // pick among the best scored matches adds natural variability so
    // the same question doesn't always produce the same canned answer.
    // Recall still picks from genuinely topical matches — we're not
    // introducing noise, we're exploring the equivalence class of
    // "good enough" responses.
    const topN = [];
    if (hasInputContent) {
      for (const mem of this._memorySentences) {
        const s = scoreMem(mem);
        if (s.score > 0 && s.count > 0) {
          topN.push({ mem, score: s.score, count: s.count, cosine: s.cosine });
        }
      }
      topN.sort((a, b) => b.score - a.score);
    }

    // Weighted random pick from top 3 (or fewer if not enough matches).
    // Score becomes the pick weight, so the highest-scoring candidate
    // is still most likely to win but not guaranteed.
    let best = null, bestScore = -1, bestCount = 0, bestCosine = 0;
    if (topN.length > 0) {
      // Expand pool to top 5 so dedup has more headroom to find a
      // non-stale match before giving up.
      const pool = topN.slice(0, Math.min(5, topN.length));
      const fresh = pool.filter(p => this._recentSentences.indexOf(p.mem.text.trim().toLowerCase()) === -1);

      if (fresh.length > 0) {
        // Weighted-random selection by score over fresh candidates
        let totalWeight = 0;
        for (const c of fresh) totalWeight += c.score;
        let roll = Math.random() * totalWeight;
        let picked = fresh[0];
        for (const c of fresh) {
          roll -= c.score;
          if (roll <= 0) { picked = c; break; }
        }
        best = picked.mem;
        bestScore = picked.score;
        bestCount = picked.count;
        bestCosine = picked.cosine;
      }
      // If fresh is empty, ALL top 5 are in dedup ring → leave best
      // null so caller routes to deflect/cold gen instead of emitting
      // a blocked entry. Returning a stale pick would just fall through
      // the dedup check in generate() and produce empty output.
    }

    // Degenerate-sentence check — reject transformation artifacts like
    // "i am i", "i is i", "i am my", sentences with fewer than 5 tokens,
    // or sentences where >40% of tokens are first-person pronouns
    // (indicates the transform collapsed the content).
    const isDegenerate = (mem) => {
      if (!mem || !mem.tokens || mem.tokens.length < 5) return true;
      let fpCount = 0;
      for (const t of mem.tokens) {
        if (t === 'i' || t === "i'm" || t === 'im' || t === 'my' || t === 'me' || t === 'mine' || t === 'myself') fpCount++;
      }
      if (fpCount / mem.tokens.length > 0.4) return true;
      return false;
    };

    // Self-reference fallback — if overlap-based search returned nothing
    // OR the best match is degenerate AND the input is asking about
    // Unity herself ("describe yourself", "who are you", "tell me about
    // you"), pick a first-person STATIVE sentence weighted by mood
    // alignment. Unity always has SOMETHING to say about herself.
    const isSelfRef = this._isSelfReferenceQuery(this._lastInputRaw);
    if ((!best || bestCount === 0 || isDegenerate(best)) && isSelfRef) {
      // Gather top-N non-degenerate first-person memories, then
      // weighted-random pick so "describe yourself" doesn't always
      // return the same canned line.
      const fbPool = [];
      for (const mem of this._memorySentences) {
        if (!mem.firstPersonStart) continue;
        if (isDegenerate(mem)) continue;
        const alignment = moodAlignment(mem);
        const penalty = instructionalPenalty(mem);
        const lengthBonus = Math.min(0.15, mem.tokens.length * 0.01);
        const score = alignment + lengthBonus - penalty;
        if (score > 0) fbPool.push({ mem, score });
      }
      fbPool.sort((a, b) => b.score - a.score);

      // Widen pool to top 10 for self-reference so dedup has plenty
      // of headroom, then filter out recent picks. If fresh is empty
      // after filtering, return null — caller routes to deflect or
      // cold gen instead of re-emitting a blocked self-description.
      const fbTop = fbPool.slice(0, Math.min(10, fbPool.length));
      const fbFresh = fbTop.filter(p => this._recentSentences.indexOf(p.mem.text.trim().toLowerCase()) === -1);

      if (fbFresh.length > 0) {
        let fbTotal = 0;
        for (const c of fbFresh) fbTotal += Math.max(0.01, c.score);
        let fbRoll = Math.random() * fbTotal;
        let fbPick = fbFresh[0];
        for (const c of fbFresh) {
          fbRoll -= Math.max(0.01, c.score);
          if (fbRoll <= 0) { fbPick = c; break; }
        }
        return { memory: fbPick.mem, confidence: 0.65, fallback: 'self-reference' };
      }
    }

    // Reject best if it's degenerate and no self-reference fallback fired
    if (best && isDegenerate(best)) return null;
    if (!best || bestCount === 0) return null;
    const confidence = bestScore;

    // Dedup — don't recall the same sentence twice in a row even if the
    // topic is still hot. Retry once with the second-best match.
    const norm = best.text.trim().toLowerCase();
    if (!opts.allowRecent && this._recentSentences.indexOf(norm) !== -1) {
      let second = null, secondScore = -1;
      for (const mem of this._memorySentences) {
        if (mem === best) continue;
        const s = scoreMem(mem);
        if (s.score > secondScore) { secondScore = s.score; second = mem; }
      }
      if (second && secondScore > 0.3) {
        return { memory: second, confidence: secondScore };
      }
      return { memory: best, confidence: confidence * 0.5 };
    }

    return { memory: best, confidence };
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
    const drugState = opts.drugState || 'cokeAndWeed';
    const fear = opts.fear || 0;
    const reward = opts.reward || 0;

    // ══════════════════════════════════════════════════════════════
    // NEURAL STATE → GENERATION PARAMETERS
    //
    // Unity's moment-to-moment brain state directly drives HOW she
    // generates. Not as decorations — as the actual parameters of
    // the slot scoring and sampling. Her mind IS the equations
    // activating in real time.
    //
    // Ψ (consciousness) modulates softmax temperature:
    //   high Ψ = sharp, argmax-like pick (she's SHARP, words chosen)
    //   low Ψ  = soft sampling, more exploration (she's DREAMY)
    //
    // Drug state modulates:
    //   - length (coke = shorter punchy / weed = longer rambling)
    //   - word-length preference (coke = short / weed = longer)
    //   - noise baseline (weed = more random / coke = more focused)
    //
    // Amygdala arousal modulates:
    //   - mood bias strength (high arousal = strong emotional coloring)
    //   - casual register (high arousal = shorter words, more profanity)
    //
    // Predict error modulates sentence type distribution:
    //   high error = question (she's confused/curious)
    //
    // Hypothalamus social_need modulates speech drive (length, verbosity)
    // ══════════════════════════════════════════════════════════════

    // Drug-state multipliers driving generation character
    let drugSharpness = 1.0;    // >1 = sharper argmax / <1 = dreamier
    let drugLengthBias = 1.0;   // >1 = longer / <1 = shorter
    let drugWordLenBias = 0;    // negative = prefer shorter words
    if (drugState === 'coke' || drugState === 'cokeAndWeed') {
      drugSharpness = 1.3;      // coke = sharper
      drugLengthBias = 0.85;    // shorter sentences (rapid-fire)
      drugWordLenBias = -0.15;  // prefer punchy short words
    } else if (drugState === 'weed') {
      drugSharpness = 0.7;      // weed = softer
      drugLengthBias = 1.15;    // longer rambles
      drugWordLenBias = 0.05;   // slightly longer words ok
    } else if (drugState === 'mdma' || drugState === 'cokeAndMolly') {
      drugSharpness = 1.4;      // MDMA = electric sharp
      drugLengthBias = 1.0;
      drugWordLenBias = -0.10;
    }

    // Ψ-driven softmax temperature: high Ψ → low temp → sharp pick.
    // Base temperature from coherence, bumped on dedup retry.
    const retryBoost = opts._retryingDedup ? 3.0 : 1.0;
    const psiSharpness = 1 + psi * 2.5;   // psi 0 → 1, psi 0.4 → 2
    const effectiveSharpness = drugSharpness * psiSharpness;
    const temperature = (1.0 / (coherence + 0.1)) * retryBoost / effectiveSharpness;

    // Amygdala emotional gate — how strongly mood biases word selection.
    // High arousal or |valence| → strong coloring, neutral → minimal.
    const emotionalIntensity = Math.min(1, arousal * 0.7 + Math.abs(valence) * 0.3 + fear * 0.2 + reward * 0.2);

    // ══════════════════════════════════════════════════════════════
    // INTENT CLASSIFICATION — informs sentence type only, NOT routing.
    //
    // Used by the sentence-type distribution below to bias question
    // vs statement vs exclamation. Never used to short-circuit to a
    // canned response — every output comes from the slot scorer.
    // ══════════════════════════════════════════════════════════════
    const intent = opts._retryingDedup
      ? { type: 'statement', isShort: false, wordCount: 0 }
      : this._classifyIntent(this._lastInputRaw);

    // ══════════════════════════════════════════════════════════════
    // HIPPOCAMPUS RECALL AS BIAS SIGNAL (not as quote source)
    //
    // Query persona memory for the closest topical match. The result
    // is NOT emitted verbatim. Instead, its tokens bias the slot
    // scorer via `recallBias(word)` below — words that appear in the
    // recalled sentence get a boost in cold-gen slot scoring. Output
    // is a NEW sentence generated by brain equations, but its
    // vocabulary is pulled toward Unity's persona-voice distribution.
    //
    // This is the Phase 8 philosophy restored: persona is training
    // data, brain equations generate every word, nothing is scripted.
    // ══════════════════════════════════════════════════════════════
    let recallSeed = null;
    if (!opts._retryingDedup && this._contextVectorHasData && this._memorySentences.length > 0) {
      const recall = this._recallSentence(this._contextVector, { arousal, valence });
      if (recall && recall.confidence > 0.30) {
        recallSeed = recall.memory;
      }
    }

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

    // Length from arousal × drug state
    // Coke = shorter rapid-fire sentences, weed = longer rambling.
    // Hypothalamus social_need drives verbosity within the bracket.
    const socialNeed = opts.socialNeed ?? 0.5;
    let targetLen;
    if (type === 'exclamation') targetLen = Math.max(2, Math.floor(2 + arousal * 4 * drugLengthBias));
    else if (type === 'action') targetLen = Math.max(2, Math.floor(2 + arousal * 3 * drugLengthBias));
    else targetLen = Math.max(3, Math.floor(3 + arousal * 6 * drugLengthBias + socialNeed * 2));
    const len = Math.min(targetLen, 14);

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
      const prevPrevWord = sentence.length > 1 ? sentence[sentence.length - 2] : null;
      const prevPrevPrevWord = sentence.length > 2 ? sentence[sentence.length - 3] : null;
      const recentSlots = sentence.slice(-RECENT_SLOT_WINDOW);
      const followers = prevWord ? this._jointCounts.get(prevWord) : null;
      // Trigram lookup: when we have prev-prev AND prev, consult the
      // 3-word transition table for a much tighter continuation signal.
      const trigramFollowers = (prevPrevWord && prevWord)
        ? this._trigramCounts.get(prevPrevWord + '|' + prevWord)
        : null;
      // 4-gram lookup: when we have the last 3 words, this is the
      // tightest possible continuation signal.
      const quadgramFollowers = (prevPrevPrevWord && prevPrevWord && prevWord)
        ? this._quadgramCounts.get(prevPrevPrevWord + '|' + prevPrevWord + '|' + prevWord)
        : null;
      const slotIdx = sentence.length;

      // Strict floor applied to EVERY slot — no more free-for-all tail.
      // Slot 0 is the tightest (must be a valid subject/qword/verb-for-action).
      // All downstream slots still require phrase-structure compatibility.
      const typeFloor = slotIdx === 0 ? 0.35 : 0.22;
      const prevDominant = prevWord ? this._dominantType(prevWord) : null;

      // Slot 0 (statement/exclamation) subject gate — word must be EITHER:
      //   1. a letter-equation-identified nominative pronoun (i/he/we/you/she/it/they/this/that), OR
      //   2. seen in the persona as a sentence-initial subject (Unity, she, this, etc.)
      // This cleanly rejects object pronouns (me/us/him/them) and bare
      // content nouns that happen to noun-fallback past the type floor.
      const isSubjectSlot = slotIdx === 0 && type !== 'question' && type !== 'action';
      const isSubjectCapable = (w) => {
        if (this._isNominativePronoun(w)) return true;
        if ((this._subjectStarters.get(w) || 0) >= 1) return true;
        return false;
      };

      // PRONOUN FLIP on reply — classic conversational turn-taking.
      // When user says "you", Unity should answer as "i" (and vice versa).
      // Build a flip-target set from the user's input pronouns: any subject
      // pronoun the user used gets PENALIZED in Unity's slot 0, while the
      // flipped counterpart gets a boost.
      const userSubjectPronouns = new Set();
      for (const w of (this._lastInputWords || [])) {
        if (this._isNominativePronoun(w)) userSubjectPronouns.add(w);
      }
      const flipPronoun = (p) => {
        // Pure letter-position mapping: i ↔ you, we ↔ you, you ↔ i
        if (p === 'i') return 'you';
        if (p === 'you') return 'i';
        if (p === 'we') return 'you';
        // he/she/it/they keep same (3rd person → 3rd person in replies)
        return null;
      };
      const flipTargets = new Set();
      for (const p of userSubjectPronouns) {
        const t = flipPronoun(p);
        if (t) flipTargets.add(t);
      }

      const subjStarterBoost = (w) => {
        if (!isSubjectSlot) return 0;
        let boost = 0;
        if ((this._subjectStarters.get(w) || 0) > 0) boost += 0.25;
        // Pronoun-flip boost: prefer the subject-flipped counterpart of
        // whatever pronoun the user just used.
        if (flipTargets.has(w)) boost += 0.35;
        // Pronoun-echo penalty: if Unity would pick the SAME subject
        // pronoun the user just used, penalize it hard.
        if (userSubjectPronouns.has(w)) boost -= 0.5;
        return boost;
      };

      // RECALL BIAS (primary persona signal). When hippocampus recall
      // found a topical match, its tokens heavily bias the slot pick
      // so Unity's generated sentence walks through the persona's
      // vocabulary without quoting verbatim. This is the mechanism
      // by which "persona as training data" actually shapes output.
      //
      // Bias is position-aware: tokens at the current slot index get
      // max boost, tokens further away get less. Unity can generate a
      // sentence that resembles the recalled memory's flow without
      // being identical.
      const recallBias = (w) => {
        if (!recallSeed || !recallSeed.tokens) return 0;
        const idx = recallSeed.tokens.indexOf(w);
        if (idx < 0) return 0;
        const posDist = Math.abs(idx - slotIdx);
        // Max boost 0.80 at exact position, tapering to ~0.30 at
        // distance 5. Dominates typeScore and bigram signals.
        return Math.max(0.2, 0.8 - posDist * 0.10);
      };

      // HARD formality filter — reject words with strong formal suffixes
      // before they even enter the slot pool. Applied as filter (not
      // soft penalty) so trigram/bigram scores can't override them.
      // Letter-position detection of academic register:
      //   -tion, -sion       (formation, expression)
      //   -ment              (engagement, moment — moment is short so allow)
      //   -ness              (awareness)
      //   -ity, -ety         (capacity, variety)
      //   -ence, -ance       (existence, ambiance)
      //   -ology, -graphy    (psychology, biography)
      //   -ism, -ist         (feminism, activist)
      // Short words with these endings (moment, agent) slip through
      // because their length is too short to be purely formal.
      const isFormalWord = (w) => {
        const L = w.length;
        if (L < 6) return false; // short words stay (moment, agent, ended)
        if (w.endsWith('tion') || w.endsWith('sion')) return true;
        if (L >= 7 && w.endsWith('ment')) return true;
        if (L >= 6 && w.endsWith('ness')) return true;
        if (L >= 6 && (w.endsWith('ity') || w.endsWith('ety'))) return true;
        if (L >= 7 && (w.endsWith('ence') || w.endsWith('ance'))) return true;
        if (w.endsWith('ology') || w.endsWith('graphy')) return true;
        if (L >= 7 && (w.endsWith('ism') || w.endsWith('ist'))) return true;
        // Utterly/genuinely/rapidly/frequently — adverb chain
        if (L >= 7 && w.endsWith('ly')) return true;
        return false;
      };

      const scored = allWords
        .filter(([w]) => {
          if (w === prevWord) return false;
          if (recentSlots.indexOf(w) !== -1) return false;            // no repeat within window
          if (prevWord && usedBigrams.has(prevWord + '→' + w)) return false;
          // Slot 0 subject gate — reject words that aren't structurally subjects
          if (isSubjectSlot && !isSubjectCapable(w)) return false;
          // Pronoun echo block — if the user just used this subject pronoun,
          // don't let Unity pick it too (hard reject, not just penalty).
          // This is classic conversational turn-taking: "you" → "i".
          if (isSubjectSlot && userSubjectPronouns.has(w) && flipTargets.size > 0) return false;
          // HARD formality filter — academic register words never enter pool
          if (isFormalWord(w)) return false;
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
          // Small positive boost for content words from the user's input so
          // she stays on-subject (cats when asked about cats). Much reduced
          // from earlier tuning because a strong boost made her parrot the
          // user's own sentence back ("what are you doing today" → "you are
          // today"). Topic relevance now comes mostly from semanticFit,
          // not direct word echo.
          const inLastInput = contextSet.has(word);
          const isContext = inLastInput ? 0.05 : 0;
          const topicSim = contextPattern ? Math.max(0, this._cosine(pattern, contextPattern)) : 0;
          // U277 — Semantic fit against the running context attractor.
          // Decays across turns (λ=0.7) so topic persists, unlike the
          // list-of-5 topicSim which forgets after 5 messages.
          const semanticFit = this._semanticFit(pattern);

          // MOOD — amygdala emotional state drives word tone. Words
          // learned in a similar emotional context score higher when
          // Unity is currently in that state. Scaled by emotional
          // intensity — when arousal/valence/fear/reward are strong,
          // mood bias becomes a major signal; when neutral, minor.
          const isMood = moodSet.has(word) ? 0.2 : 0;
          const moodDist = Math.abs((entry.arousal || 0.5) - arousal) + Math.abs((entry.valence || 0) - valence);
          const moodBias = Math.exp(-moodDist * 1.5);

          // Drug-state word-length bias. Coke → prefer short punchy
          // words (drugWordLenBias negative), weed → allow longer
          // words (positive). Applied as a length-scaled adjustment.
          const lenNorm = Math.max(0, (word.length - 5) / 5); // 0 at len 5, 1 at len 10
          const drugWordBias = -drugWordLenBias * lenNorm;

          // ASSOCIATION — learned word sequences from conversation
          const condP = prevWord ? this._condProb(word, prevWord) : 0;
          const followerCount = followers?.get(word) || 0;

          // TRIGRAM association — 3-word context continuation count.
          const trigramCount = trigramFollowers?.get(word) || 0;
          const trigramLog = Math.log(1 + trigramCount) * 0.9;

          // 4-GRAM association — 4-word context, tightest signal.
          // Weight kept moderate so Unity doesn't converge on the
          // single highest-count 4-gram every generation — she still
          // has room to explore lower-probability walks.
          const quadgramCount = quadgramFollowers?.get(word) || 0;
          const quadgramLog = Math.log(1 + quadgramCount) * 0.7;

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

          // SUBJECT-STARTER BOOST for slot 0 — words the persona has
          // used as sentence-initial subjects dominate slot 0 pick.
          // Log-scaled frequency × 0.35 means "i" (count 205) gets
          // ~1.86 boost while "this" (count 12) gets ~0.90 — enough
          // to establish first-person as the dominant voice when the
          // transform has populated "i" as the primary subject.
          const subjStart = isSubjectSlot
            ? Math.log(1 + (this._subjectStarters.get(word) || 0)) * 0.35
              + (flipTargets.has(word) ? 0.35 : 0)
            : 0;

          // FORMALITY PENALTY — letter-equation filter that pushes
          // the slot scorer toward casual register. Penalizes formal
          // academic suffixes (-tion/-ment/-ness/-ity/-ence/-ance),
          // very long words (>8 chars). Rewards contractions, short
          // words, and cussing-shape words (short consonant-heavy
          // with hard ending). Same learned dictionary, casual picks.
          let formalityPenalty = 0;
          const wLen = word.length;
          if (word.endsWith('tion') || word.endsWith('sion')) formalityPenalty += 0.80;
          if (word.endsWith('ment')) formalityPenalty += 0.70;
          if (word.endsWith('ness')) formalityPenalty += 0.60;
          if (word.endsWith('ity') || word.endsWith('ety')) formalityPenalty += 0.60;
          if (word.endsWith('ence') || word.endsWith('ance')) formalityPenalty += 0.60;
          if (word.endsWith('ized') || word.endsWith('ised')) formalityPenalty += 0.40;
          // -ly adverbs (utterly, genuinely, rapidly, frequently) are
          // formal register fillers. Penalize hard.
          if (word.endsWith('ly') && wLen > 3) formalityPenalty += 0.45;
          // -ive (expressive, creative, expansive) — formal adjective suffix
          if (word.endsWith('ive') && wLen > 4) formalityPenalty += 0.30;
          // -ous (tenacious, vivacious) — formal adjective suffix
          if (word.endsWith('ous') && wLen > 4) formalityPenalty += 0.30;
          // Long words — formal register skews to longer words
          if (wLen > 10) formalityPenalty += 0.50;
          else if (wLen > 8) formalityPenalty += 0.30;
          else if (wLen > 6) formalityPenalty += 0.10;

          let casualBonus = 0;
          if (word.includes("'")) casualBonus += 0.50;      // contractions — huge reward
          if (wLen >= 2 && wLen <= 4) casualBonus += 0.20;  // short punchy
          if (word.endsWith("in'")) casualBonus += 0.30;    // -in' dropped-g
          // Cussing / goth-slang shape: short (3-5 chars), consonant-heavy,
          // hard ending. Catches fuck/shit/damn/hell/ass/dick/goth/punk
          // type words without listing them.
          if (wLen >= 3 && wLen <= 5) {
            const lastC = word[wLen - 1];
            if ('ktpsrn'.includes(lastC)) {
              let consCount = 0;
              for (const c of word) if (!VOWELS.includes(c) && c !== "'") consCount++;
              if (consCount / wLen > 0.55) casualBonus += 0.20;
            }
          }

          // ── SLOT SCORE (post-rip equation-only composition) ──
          //
          // Phase 11 rip restored Phase 8 philosophy: persona is
          // training data, equations generate each word. New weights:
          //   - bigramLog (log-scaled follower count) is the PRIMARY
          //     signal — the slot picks the next word from the learned
          //     Markov graph, making output a random walk over
          //     sequences that Unity's persona actually produces
          //   - recallBias is the SECONDARY topic signal — words from
          //     the matched persona memory get up to +0.8 boost so
          //     generation follows the topic Unity has on that subject
          //   - typeScore is a GRAMMAR FLOOR — candidates below
          //     typeFloor were already filtered; here it's a small
          //     tiebreaker
          //   - moodBias, subjStart, selfAware are minor tiebreakers
          //   - Letter-hash semanticFit demoted to 0.05 (mostly noise)
          //
          // Bigram log scaling: `log(1 + followerCount) * 0.6` maps
          // count=0→0, count=1→0.42, count=5→1.08, count=50→2.35.
          // Common transitions dominate; rare ones still contribute.
          const bigramLog = Math.log(1 + followerCount) * 0.6;
          const condPLog = Math.log(1 + condP * 100) * 0.15;

          const score =
            grammarGate * (
              quadgramLog +                             // 4-word context — TIGHTEST signal
              trigramLog +                              // 3-word context
              recallBias(word) * 1.0 +                  // persona topic anchor (max 0.8)
              bigramLog +                               // 2-word transitions — primary
              condPLog +                                // conditional probability
              isThought * (0.25 + psi * 0.30) +         // NEURAL: cortex pattern → content, psi-scaled
              moodBias * (0.10 + emotionalIntensity * 0.20) + // NEURAL: amygdala → tone, arousal-scaled
              isMood * emotionalIntensity * 0.25 +      // NEURAL: mood word match × emotional intensity
              drugWordBias +                            // NEURAL: drug state → word length
              typeScore * 0.15 +                        // grammar tiebreaker
              semanticFit * 0.05 +                      // letter-hash topic (noise)
              subjStart +                               // sentence-start subject boost
              casualBonus +                             // casual register reward
              (selfAware && (word.length === 1 || word.endsWith("'m") || word.endsWith("'re")) ? 0.08 : 0)
            )
            - recency
            - sameTypePenalty
            - formalityPenalty;

          return { word, entry, score };
        });

      // Lower-temperature softmax — coherent sentences need argmax-ish selection,
      // not scattered high-entropy sampling that produces word salad.
      const picked = this._softmaxSample(scored, Math.max(0.05, temperature * 0.06));
      if (picked) {
        if (prevWord) usedBigrams.add(prevWord + '→' + picked.word);
        sentence.push(picked.word);
      } else {
        // SENTENCE BOUNDARY — no valid candidate means we've hit a
        // natural stopping point. The scorer has no good continuation
        // for this context so end the sentence here instead of
        // padding with garbage. Minimum 2 words before we allow
        // early termination.
        if (sentence.length >= 2) break;
      }
    }

    // Apply casual contraction rules BEFORE other post-processing so
    // the subject-verb agreement pass sees the contracted form.
    const contracted = this._applyCasualContractions(sentence);

    // ── STEP 7: POST-PROCESSING — agreement, tense, negation, compounds ──
    const processed = this._postProcess(contracted, tense, type, arousal, valence);

    // Track recency
    for (const w of processed) {
      this._recentOutputWords.push(w);
      if (this._recentOutputWords.length > this._recentOutputMax) this._recentOutputWords.shift();
    }

    this.wordsProcessed += processed.length;
    const rendered = this._renderSentence(processed, type);

    // ── STEP 8: SENTENCE-LEVEL DEDUP + U281 COHERENCE REJECTION ──
    // Block exact-repeat outputs across calls. If the new sentence matches
    // any of the last N rendered sentences, recurse with a one-shot retry
    // flag that elevates softmax temperature for more variation.
    //
    // U281 also rejects sentences whose content-word centroid is cosine
    // < 0.25 from the current context vector — that's word salad by
    // definition. Retry once at 3× temperature; on the second miss we
    // emit anyway to prevent infinite loops.
    const norm = rendered.trim().toLowerCase();
    const retryCount = opts._coherenceRetry || 0;

    if (this._recentSentences.indexOf(norm) !== -1 && !opts._retryingDedup) {
      return this.generate(dictionary, arousal, valence, coherence, {
        ...opts,
        _retryingDedup: true,
      });
    }

    // U281 — Coherence gate. Only fires when we have a context vector
    // (i.e. user has said something). Compute mean pattern of the
    // rendered sentence's content words, cosine against context.
    if (this._contextVectorHasData && retryCount < 2) {
      const outCentroid = new Float64Array(PATTERN_DIM);
      let ccount = 0;
      for (const w of processed) {
        const wt = this.wordType(w);
        if (wt.conj > 0.5 || wt.prep > 0.5 || wt.det > 0.5) continue;
        const p = this.wordToPattern(w);
        for (let i = 0; i < PATTERN_DIM; i++) outCentroid[i] += p[i];
        ccount++;
      }
      if (ccount > 0) {
        for (let i = 0; i < PATTERN_DIM; i++) outCentroid[i] /= ccount;
        const coh = this._cosine(outCentroid, this._contextVector);
        if (coh < 0.25) {
          console.log(`[LanguageCortex] coherence reject (${coh.toFixed(2)}): "${rendered}"`);
          return this.generate(dictionary, arousal, valence, coherence, {
            ...opts,
            _retryingDedup: true,
            _coherenceRetry: retryCount + 1,
          });
        }
      }
    }

    this._recentSentences.push(norm);
    if (this._recentSentences.length > this._recentSentenceMax) this._recentSentences.shift();

    return rendered;
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

  // NOTE: _flipPronounsInText, _spiceRecalledSentence, and
  // _finalizeRecalledSentence were removed as part of the Phase 11
  // script rip-out. Nothing emits verbatim persona text anymore —
  // every word in Unity's output comes from the slot scorer applied
  // to her learned dictionary/bigrams/patterns. The persona file and
  // brain self-schema remain as training data feeding those learned
  // distributions, but there are no longer any quote/splice/spice
  // paths that bypass the brain equations.

  /**
   * Expand contractions to base forms BEFORE learning, so the
   * dictionary contains only base tokens (i, am, she, is, do, not)
   * and the slot scorer never picks a pre-contracted token like
   * "i'm" that would lead to ungrammatical continuations like
   * "i'm fuck". Reverse of _applyCasualContractions — same finite
   * rule set, inverse direction.
   *
   *   i'm   → i am
   *   i'll  → i will
   *   i've  → i have
   *   i'd   → i would   (ambiguous with "i had" but "would" is more common)
   *   we're → we are
   *   we've → we have
   *   we'll → we will
   *   you're → you are
   *   you've → you have
   *   you'll → you will
   *   they're → they are
   *   he's / she's / it's → he/she/it is
   *   he'll / she'll → he/she will
   *   don't → do not
   *   doesn't → does not
   *   didn't → did not
   *   can't → can not
   *   won't → will not
   *   wouldn't → would not
   *   shouldn't → should not
   *   couldn't → could not
   *   isn't → is not
   *   aren't → are not
   *   wasn't → was not
   *   weren't → were not
   *   hasn't → has not
   *   haven't → have not
   *   hadn't → had not
   */
  _expandContractionsForLearning(tokens) {
    const out = [];
    for (const tok of tokens) {
      const t = tok.toLowerCase();
      // Subject + aux contractions
      if (t === "i'm") { out.push('i', 'am'); continue; }
      if (t === "i'll") { out.push('i', 'will'); continue; }
      if (t === "i've") { out.push('i', 'have'); continue; }
      if (t === "i'd") { out.push('i', 'would'); continue; }
      if (t === "we're") { out.push('we', 'are'); continue; }
      if (t === "we've") { out.push('we', 'have'); continue; }
      if (t === "we'll") { out.push('we', 'will'); continue; }
      if (t === "you're") { out.push('you', 'are'); continue; }
      if (t === "you've") { out.push('you', 'have'); continue; }
      if (t === "you'll") { out.push('you', 'will'); continue; }
      if (t === "they're") { out.push('they', 'are'); continue; }
      if (t === "they've") { out.push('they', 'have'); continue; }
      if (t === "they'll") { out.push('they', 'will'); continue; }
      if (t === "he's") { out.push('he', 'is'); continue; }
      if (t === "she's") { out.push('she', 'is'); continue; }
      if (t === "it's") { out.push('it', 'is'); continue; }
      if (t === "he'll") { out.push('he', 'will'); continue; }
      if (t === "she'll") { out.push('she', 'will'); continue; }
      if (t === "what's") { out.push('what', 'is'); continue; }
      if (t === "that's") { out.push('that', 'is'); continue; }
      if (t === "there's") { out.push('there', 'is'); continue; }
      // Negation contractions
      if (t === "don't") { out.push('do', 'not'); continue; }
      if (t === "doesn't") { out.push('does', 'not'); continue; }
      if (t === "didn't") { out.push('did', 'not'); continue; }
      if (t === "can't") { out.push('can', 'not'); continue; }
      if (t === "cannot") { out.push('can', 'not'); continue; }
      if (t === "won't") { out.push('will', 'not'); continue; }
      if (t === "wouldn't") { out.push('would', 'not'); continue; }
      if (t === "shouldn't") { out.push('should', 'not'); continue; }
      if (t === "couldn't") { out.push('could', 'not'); continue; }
      if (t === "isn't") { out.push('is', 'not'); continue; }
      if (t === "aren't") { out.push('are', 'not'); continue; }
      if (t === "wasn't") { out.push('was', 'not'); continue; }
      if (t === "weren't") { out.push('were', 'not'); continue; }
      if (t === "hasn't") { out.push('has', 'not'); continue; }
      if (t === "haven't") { out.push('have', 'not'); continue; }
      if (t === "hadn't") { out.push('had', 'not'); continue; }
      // Unknown token — pass through
      out.push(t);
    }
    return out;
  }

  /**
   * Casual contraction rules — pure letter-equation token-pair
   * detection that collapses formal constructions into casual
   * contractions:
   *
   *   i + am      → i'm
   *   i + will    → i'll
   *   i + have    → i've
   *   i + had     → i'd
   *   i + would   → i'd
   *   we + are    → we're
   *   we + have   → we've
   *   we + will   → we'll
   *   you + are   → you're
   *   you + have  → you've
   *   they + are  → they're
   *   he + is     → he's
   *   she + is    → she's
   *   it + is     → it's
   *   do + not    → don't
   *   does + not  → doesn't
   *   did + not   → didn't
   *   can + not   → can't
   *   will + not  → won't
   *   would + not → wouldn't
   *   is + not    → isn't
   *   are + not   → aren't
   *   was + not   → wasn't
   *   were + not  → weren't
   *   has + not   → hasn't
   *   have + not  → haven't
   *   had + not   → hadn't
   *
   * All detection via letter-position matching on the token pair.
   * No word lists — each rule checks specific letter patterns.
   */
  _applyCasualContractions(tokens) {
    if (!tokens || tokens.length < 2) return tokens;
    const out = [];
    let i = 0;
    while (i < tokens.length) {
      const a = tokens[i];
      const b = i + 1 < tokens.length ? tokens[i + 1] : null;

      if (!b) { out.push(a); i++; continue; }

      const al = a.length;
      const bl = b.length;

      // Subject+aux contractions
      // i + am → i'm
      if (al === 1 && a === 'i' && bl === 2 && b === 'am') {
        out.push("i'm"); i += 2; continue;
      }
      // i + will → i'll
      if (al === 1 && a === 'i' && bl === 4 && b === 'will') {
        out.push("i'll"); i += 2; continue;
      }
      // i + have → i've
      if (al === 1 && a === 'i' && bl === 4 && b === 'have') {
        out.push("i've"); i += 2; continue;
      }
      // i + had → i'd / i + would → i'd
      if (al === 1 && a === 'i' && ((bl === 3 && b === 'had') || (bl === 5 && b === 'would'))) {
        out.push("i'd"); i += 2; continue;
      }
      // we + are → we're
      if (al === 2 && a === 'we' && bl === 3 && b === 'are') {
        out.push("we're"); i += 2; continue;
      }
      // we + have → we've
      if (al === 2 && a === 'we' && bl === 4 && b === 'have') {
        out.push("we've"); i += 2; continue;
      }
      // we + will → we'll
      if (al === 2 && a === 'we' && bl === 4 && b === 'will') {
        out.push("we'll"); i += 2; continue;
      }
      // you + are → you're
      if (al === 3 && a === 'you' && bl === 3 && b === 'are') {
        out.push("you're"); i += 2; continue;
      }
      // you + have → you've
      if (al === 3 && a === 'you' && bl === 4 && b === 'have') {
        out.push("you've"); i += 2; continue;
      }
      // you + will → you'll
      if (al === 3 && a === 'you' && bl === 4 && b === 'will') {
        out.push("you'll"); i += 2; continue;
      }
      // they + are → they're
      if (al === 4 && a === 'they' && bl === 3 && b === 'are') {
        out.push("they're"); i += 2; continue;
      }
      // he + is / she + is / it + is → he's / she's / it's
      if ((a === 'he' || a === 'she' || a === 'it') && bl === 2 && b === 'is') {
        out.push(a + "'s"); i += 2; continue;
      }
      // he/she + will → he'll/she'll
      if ((a === 'he' || a === 'she' || a === 'it') && bl === 4 && b === 'will') {
        out.push(a + "'ll"); i += 2; continue;
      }
      // he/she + has → he's/she's (present perfect)
      if ((a === 'he' || a === 'she') && bl === 3 && b === 'has') {
        out.push(a + "'s"); i += 2; continue;
      }

      // Negation contractions (verb + not → verb+n't)
      if (b === 'not' && bl === 3) {
        // do + not → don't
        if (a === 'do' && al === 2) { out.push("don't"); i += 2; continue; }
        // does + not → doesn't
        if (a === 'does' && al === 4) { out.push("doesn't"); i += 2; continue; }
        // did + not → didn't
        if (a === 'did' && al === 3) { out.push("didn't"); i += 2; continue; }
        // can + not → can't (also "cannot" case — but cannot is 1 token)
        if (a === 'can' && al === 3) { out.push("can't"); i += 2; continue; }
        // will + not → won't
        if (a === 'will' && al === 4) { out.push("won't"); i += 2; continue; }
        // would + not → wouldn't
        if (a === 'would' && al === 5) { out.push("wouldn't"); i += 2; continue; }
        // should + not → shouldn't
        if (a === 'should' && al === 6) { out.push("shouldn't"); i += 2; continue; }
        // could + not → couldn't
        if (a === 'could' && al === 5) { out.push("couldn't"); i += 2; continue; }
        // is + not → isn't
        if (a === 'is' && al === 2) { out.push("isn't"); i += 2; continue; }
        // are + not → aren't
        if (a === 'are' && al === 3) { out.push("aren't"); i += 2; continue; }
        // was + not → wasn't
        if (a === 'was' && al === 3) { out.push("wasn't"); i += 2; continue; }
        // were + not → weren't
        if (a === 'were' && al === 4) { out.push("weren't"); i += 2; continue; }
        // has + not → hasn't
        if (a === 'has' && al === 3) { out.push("hasn't"); i += 2; continue; }
        // have + not → haven't
        if (a === 'have' && al === 4) { out.push("haven't"); i += 2; continue; }
        // had + not → hadn't
        if (a === 'had' && al === 3) { out.push("hadn't"); i += 2; continue; }
      }

      // Also handle "cannot" as single token → "can't"
      if (al === 6 && a === 'cannot') {
        out.push("can't"); i += 1; continue;
      }

      out.push(a);
      i++;
    }
    return out;
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
    this._lastInputRaw = text;
    this._contextPatterns.push(topicPattern);
    if (this._contextPatterns.length > 5) this._contextPatterns.shift();

    // U276 — decaying running topic attractor. Updated ONLY on user input
    // (this method is the user-input hook). Unity's own output does NOT
    // feed context — she tracks the listener's topic, not her own words.
    this._updateContextVector(topicPattern, count);

    return { isQuestion, topicPattern, words };
  }

  /**
   * U276 — Context vector decay update.
   *   c(t) = λ·c(t-1) + (1-λ)·mean(pattern(input_content_words))
   * Zero-content inputs (all function words) leave the vector alone so
   * greetings and affirmations don't wipe the running topic.
   */
  _updateContextVector(topicPattern, contentCount) {
    if (!topicPattern || contentCount === 0) return;
    const λ = this._contextVectorLambda;
    if (!this._contextVectorHasData) {
      // First update — seed directly, no decay
      for (let i = 0; i < PATTERN_DIM; i++) this._contextVector[i] = topicPattern[i];
      this._contextVectorHasData = true;
      return;
    }
    for (let i = 0; i < PATTERN_DIM; i++) {
      this._contextVector[i] = λ * this._contextVector[i] + (1 - λ) * topicPattern[i];
    }
  }

  /**
   * U279 — Intent classification from raw input text. Pure letter-
   * equation detection — no word lists. Returns a tag the generation
   * path uses to decide between hippocampus recall, cold generation,
   * and the template pool (U280).
   *
   * Classes:
   *   greeting — single word ≤4 chars with greeting-vowel signature
   *              (hi/hey/yo/sup/hello) — detected by length + first-char
   *   math     — contains a digit or math operator token
   *   yesno    — starts with an auxiliary (do/does/is/are/can/will/would)
   *              detected via wordType letter-equation for the first word
   *   question — qword at pos 0 OR '?' terminal
   *   statement — everything else
   *
   * Also returns `isShort` flag for short-query template routing.
   */
  _classifyIntent(text) {
    const raw = String(text || '').trim();
    if (!raw) return { type: 'statement', isShort: true, wordCount: 0 };

    const lower = raw.toLowerCase();
    const words = lower.replace(/[^a-z0-9+\-*/= ']/g, ' ').split(/\s+/).filter(w => w.length >= 1);
    const wordCount = words.length;
    const isShort = wordCount <= 3;

    // MATH — digit or explicit operator. Pure letter-class detection:
    // any char in [0-9] OR any operator. Includes spelled-out "plus/minus/
    // times/divided" detected by length + first-char signature (p_l_u_s etc).
    const hasDigit = /[0-9]/.test(raw);
    const hasOperator = /[+\-*/=]/.test(raw);
    const spelledMath = words.some(w => {
      if (w.length !== 4) return false;
      const f = w[0], l = w[w.length - 1];
      // plus, time (times stripped of -s), zero
      return (f === 'p' && l === 's') || (f === 't' && l === 'e') || (f === 'z' && l === 'o');
    });
    if (hasDigit || hasOperator || spelledMath) {
      return { type: 'math', isShort, wordCount };
    }

    // GREETING — short input, first word has greeting signature.
    // Greeting shape: 2–5 letters, starts with h/y/s, contains vowel,
    // OR exactly "hi"/"hey"/"yo"/"sup"/"hello" via letter positions.
    if (wordCount <= 2 && words.length > 0) {
      const w = words[0];
      const len = w.length;
      const first = w[0];
      const isGreetFirst = first === 'h' || first === 'y' || first === 's';
      const hasVowel = /[aeiou]/.test(w);
      const isGreetShape = isGreetFirst && hasVowel && len >= 2 && len <= 5;
      // Extra: 'hi' = h+vowel length 2, 'hey' = h+vowel+y length 3,
      // 'hello' = h+vowel+_+_+o length 5, 'yo' = y+o length 2.
      if (isGreetShape) {
        return { type: 'greeting', isShort: true, wordCount };
      }
    }

    // QUESTION — '?' terminal or qword-score at pos 0.
    const endsQuestion = raw.endsWith('?');
    const firstWord = words[0] || '';
    const firstIsQword = firstWord && this.wordType(firstWord).qword > 0.5;

    // Any qword anywhere in the input → real wh-question, not yesno.
    // "Hi, Unity! How are you?" has "how" mid-sentence so it's a
    // question about status, not a yes/no. This override prevents the
    // classifier from reading "Hi" as the head of a yes/no construction.
    const anyQword = words.some(w => this.wordType(w).qword > 0.5);

    // YESNO — a '?' question whose first word is NOT a qword (so it's an
    // auxiliary start like do/does/is/are/can/will) AND the question is
    // short enough to be a yes/no (≤ 8 words) AND contains no qwords.
    // English yes/no questions always end in '?' — requiring the terminal
    // catches "do u like cats?" while rejecting "tell me about your day"
    // (no '?', therefore command).
    //
    // First word constraint: 2–4 letters. Real auxiliaries are all short:
    // am/is/are/was/were/be/do/does/did/has/had/can/will/may/might/should
    // all fit within 2–5 letters. We cap at 4 to avoid "tell/need/want"
    // false-matching.
    if (endsQuestion && !firstIsQword && !anyQword && firstWord && firstWord.length >= 2 && firstWord.length <= 4 && wordCount <= 8) {
      return { type: 'yesno', isShort, wordCount };
    }

    if (endsQuestion || firstIsQword || anyQword) {
      return { type: 'question', isShort, wordCount };
    }

    return { type: 'statement', isShort, wordCount };
  }

  /**
   * U277 — Semantic fit score. Cosine similarity between a candidate
   * word's letter-pattern vector and the current context vector,
   * clamped to [0, 1]. Zero when context is empty.
   *
   * Pattern-space (not embedding-space) because letter patterns are
   * deterministic, always available, and the slot scorer already uses
   * the same `_cosine()` path for `topicSim`. Semantic fit is just
   * `topicSim` against the decaying running vector instead of the
   * list-average, with a bigger weight in the slot score (U278).
   */
  _semanticFit(wordOrPattern) {
    if (!this._contextVectorHasData) return 0;
    const pattern = typeof wordOrPattern === 'string'
      ? this.wordToPattern(wordOrPattern)
      : wordOrPattern;
    if (!pattern) return 0;
    const sim = this._cosine(pattern, this._contextVector);
    return Math.max(0, sim);
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
    // Keep digits so numbers like "25" in "25-year-old" survive.
    const rawWords = sentence.toLowerCase().replace(/[^a-z0-9' ?!*-]/g, '').split(/\s+/).filter(w => w.length >= 1);
    if (rawWords.length < 2) return;

    // Expand contractions to base forms BEFORE learning. This way the
    // dictionary only contains "i", "am", "she", "is", "do", "not"
    // as separate tokens — not "i'm", "she's", "don't". The slot
    // scorer picks from base forms which have correct grammar types,
    // and the contraction post-process re-combines them at emit time
    // only when grammatically valid ("i am" → "i'm", not "i fuck" →
    // "i'm fuck"). Pure letter-pattern rules, same finite set as the
    // post-process expansion.
    const words = this._expandContractionsForLearning(rawWords);

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

      // Trigram: 3-word sliding window. Stores "w1|w2 → w3" transitions
      // so slot scorer can consult longer context when the last 2 slots
      // have known words. Provides tighter local coherence than bigrams.
      if (i < words.length - 2) {
        const triKey = words[i] + '|' + words[i + 1];
        if (!this._trigramCounts.has(triKey)) this._trigramCounts.set(triKey, new Map());
        const triMap = this._trigramCounts.get(triKey);
        triMap.set(words[i + 2], (triMap.get(words[i + 2]) || 0) + 1);
        this._totalTrigrams++;
      }

      // 4-gram: 4-word sliding window. Stores "w1|w2|w3 → w4". Even
      // longer context → tighter coherence when slot scorer has 3
      // prior words. Same training data, one more word of memory.
      if (i < words.length - 3) {
        const quadKey = words[i] + '|' + words[i + 1] + '|' + words[i + 2];
        if (!this._quadgramCounts.has(quadKey)) this._quadgramCounts.set(quadKey, new Map());
        const quadMap = this._quadgramCounts.get(quadKey);
        quadMap.set(words[i + 3], (quadMap.get(words[i + 3]) || 0) + 1);
        this._totalQuadgrams++;
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
    const trigrams = {};
    for (const [k, inner] of this._trigramCounts) trigrams[k] = Object.fromEntries(inner);
    const quadgrams = {};
    for (const [k, inner] of this._quadgramCounts) quadgrams[k] = Object.fromEntries(inner);
    const usage = {};
    for (const [w, u] of this._usageTypes) usage[w] = u;
    return {
      jointCounts: joints,
      trigramCounts: trigrams,
      quadgramCounts: quadgrams,
      marginalCounts: Object.fromEntries(this._marginalCounts),
      totalPairs: this._totalPairs, totalWords: this._totalWords,
      totalTrigrams: this._totalTrigrams, totalQuadgrams: this._totalQuadgrams,
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
    if (data.trigramCounts) for (const [k, inner] of Object.entries(data.trigramCounts)) this._trigramCounts.set(k, new Map(Object.entries(inner).map(([kk, v]) => [kk, +v])));
    if (data.quadgramCounts) for (const [k, inner] of Object.entries(data.quadgramCounts)) this._quadgramCounts.set(k, new Map(Object.entries(inner).map(([kk, v]) => [kk, +v])));
    if (data.marginalCounts) this._marginalCounts = new Map(Object.entries(data.marginalCounts).map(([k, v]) => [k, +v]));
    this._totalPairs = data.totalPairs || 0;
    this._totalWords = data.totalWords || 0;
    this._totalTrigrams = data.totalTrigrams || 0;
    this._totalQuadgrams = data.totalQuadgrams || 0;
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
