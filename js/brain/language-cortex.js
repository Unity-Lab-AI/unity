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

import { sharedEmbeddings, EMBED_DIM } from './embeddings.js';

// PATTERN_DIM now matches the shared semantic embedding dimension
// (GloVe 6B.50d = 50). This is the single most important change in
// R2 of brain-refactor-full-control: word patterns, cortex patterns,
// and context vectors all live in the same semantic space so cosine
// similarity measures real meaning alignment instead of letter-hash
// coincidence. Before R2, PATTERN_DIM was 32 and the slot scorer
// matched cortex activation (neural state) against word letter-hash
// vectors — meaning could not propagate from input to output.
const PATTERN_DIM = EMBED_DIM;
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

    // Cross-turn opener memory. Tracks the first 3 raw tokens of
    // the last N emitted sentences (PRE-contraction, PRE-post-processing)
    // so the slot-0/1/2 scorers can HARD-penalize candidates that
    // would repeat a recent opener pattern. Kills the "I'm gonna ___"
    // lock-in where the strongest 3-word bigram chain wins every
    // generation. Previously only tracked slot 0 post-processed, which
    // missed the slot-2 "gonna" lock and silently failed on the
    // "i" vs "i'm" form mismatch.
    this._recentOpenerNgrams = [];
    this._recentOpenerMax = 6;

    // Context from recent inputs
    this._contextPatterns = [];
    this._lastInputWords = [];
    this._lastInputRaw = '';

    // T8 — cached parse tree for the most recent input. parseSentence
    // memoizes on text equality, so repeated callers in the same turn
    // get the cached tree instead of re-parsing. Every consumer
    // (_classifyIntent, _isSelfReferenceQuery, _updateSocialSchema,
    // self-ref fallback in _recallSentence) reads from this.
    this._lastParse = null;

    // T7 — Social schema. Tracks who Unity is talking to so she can
    // greet by name, remember gender across turns, and slot a personal
    // address into her speech. Fields get populated equationally by
    // _updateSocialSchema() on every user input pass: name via
    // structural pattern match on introduction phrases, gender via
    // visual cortex describer output parse, mentionCount by counting
    // how many turns the same name has persisted. No hardcoded state
    // machine — just pattern detection + persistent memory slots.
    this._socialSchema = {
      user: {
        name: null,              // extracted from "my name is X" / "i'm X" / "call me X"
        gender: null,            // 'male' | 'female' | null — from vision describer or explicit statement
        firstSeenAt: null,       // timestamp first user input received
        lastSeenAt: null,        // timestamp most recent user input
        mentionCount: 0,         // turns since name was established
        greetingsExchanged: 0,   // cumulative hello-class exchanges this session
      },
    };

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

    // ── TYPE-LEVEL N-GRAMS (U283 phrase-state machine) ──
    // Parallel to word-level n-grams but at the grammatical TYPE level.
    // Each sentence populates both:
    //   - word n-grams (vocabulary coherence)
    //   - type n-grams (grammatical coherence)
    //
    // At generation time the slot scorer consults both. A candidate word's
    // type must be a valid continuation given the history's type sequence
    // OR the slot gets heavily penalized. Zero-count type transitions
    // (like PRON_SUBJ|COPULA|NEG → VERB_BARE, which never happens in
    // real English) become effectively forbidden.
    //
    // Fine-grained type tags derived by _fineType(word) — closed-class
    // words get exact tags (COPULA/AUX_DO/AUX_HAVE/MODAL/NEG/DET/PREP/
    // CONJ/QWORD/PRON_SUBJ/PRON_OBJ/PRON_POSS), open-class words use
    // suffix detection (VERB_ING/VERB_ED/VERB_3RD_S/VERB_BARE/ADJ/ADV/
    // NOUN). Contractions never enter because _expandContractionsForLearning
    // splits them before learning.
    //
    // This is the LEARNED grammar subsystem — no hardcoded English rules,
    // the brain picks up syntactic patterns from the persona + baseline
    // corpus the same way it picks up vocabulary.
    this._typeBigramCounts = new Map();    // Map("typeA") → Map(typeB → count)
    this._typeTrigramCounts = new Map();   // Map("typeA|typeB") → Map(typeC → count)
    this._typeQuadgramCounts = new Map();  // Map("typeA|typeB|typeC") → Map(typeD → count)
    this._totalTypePairs = 0;
    this._totalTypeTrigrams = 0;
    this._totalTypeQuadgrams = 0;

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
    // self-image), loadLinguisticBaseline(text) (generic English
    // linguistic competence), and from live conversation.
    this._selfImageLoaded = false;
    this._baselineLoaded = false;
    this._codingLoaded = false;

    // wordType memoization cache — wordType() does suffix pattern
    // matching + vowel counting + softmax normalization + usage-type
    // lookup. It gets called thousands of times per generation over
    // the 44k dictionary. Memoization is essential for main-thread
    // performance. Cache is per-instance and invalidated when usage-
    // types learn (which changes the result for ambiguous words).
    this._wordTypeCache = new Map();
    this._wordTypeCacheGen = 0; // invalidation counter
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
    // Comma-density filter: reject any "sentence" that looks like a
    // comma-separated word list (e.g. the Ultimate Unity.txt "Speech
    // Upgrades" block at line 219 which enumerates every profanity
    // and slur). Those aren't sentences — they're vocabulary dumps,
    // and their bigrams are alphabetically/arbitrarily ordered, not
    // semantically adjacent. Feeding them to learnSentence pollutes
    // the type n-grams with nonsense transitions like `sods → porn`
    // and drops slurs into the dictionary.
    const sentences = String(text)
      .replace(/[*_#`>|\[\]()]/g, ' ')
      .split(/[.!?\n\r]+/)
      .map(s => s.trim())
      .filter(s => s.length >= 3)
      .filter(s => {
        const wordCount = s.split(/\s+/).length;
        const commaCount = (s.match(/,/g) || []).length;
        // Reject if >25% of tokens are followed by commas (word-list shape)
        // OR if the absolute comma count is >15 (catches giant enumerations
        // even when the sentence is long enough to dilute the ratio).
        return commaCount / Math.max(1, wordCount) < 0.25 && commaCount < 15;
      });
    // Defensive try/catch + progress logging. Corpus loading is now
    // bounded (no O(N²) pattern similarity lookup during learn) but
    // we log periodic progress so if it DOES hang we can see where.
    console.log(`[LanguageCortex] loadSelfImage: ${sentences.length} sentences`);
    const startTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    let lastLog = startTime;
    for (let i = 0; i < sentences.length; i++) {
      const s = sentences[i];
      try {
        const firstPerson = this._transformToFirstPerson(s);
        const mood = this._computeMoodSignature(firstPerson);
        const sentenceCortex = this._deriveSentenceCortexPattern(firstPerson);
        // fromPersona=true — persona words vote on subject starters.
        // doInflections=false — synthetic morphology (un-/re-/pre-/-ness
        // /-ful/-able/etc) was polluting the dictionary with nonsense
        // derivations like "remedium" (re+medium), "unsteak", "codify"
        // from words that don't take those affixes. Real inflections
        // (running, coded, went, taller) still get learned because they
        // already appear in natural corpus text. Only the bogus
        // synthesis path is disabled.
        // T9 — bigram-graph gate. Only teach the Markov graph
        // (bigrams/trigrams/4-grams/dict entries) from sentences that
        // PASS the structural filter stack. Otherwise rulebook prose
        // seeds the walk graph even when the sentence gets rejected
        // from the memory pool — producing cold-gen word salad like
        // "box-sizing axis silences" no matter how many sentence-level
        // filters we add. The filter definition lives in one place
        // (_storeMemorySentence); _sentencePassesFilters just asks it.
        if (this._sentencePassesFilters(firstPerson, mood.arousal, mood.valence)) {
          this.learnSentence(firstPerson, dictionary, mood.arousal, mood.valence, sentenceCortex, true, false);
          this._storeMemorySentence(firstPerson, mood.arousal, mood.valence);
        }
      } catch (err) {
        console.warn('[LanguageCortex] loadSelfImage sentence failed:', err.message, '→', s.slice(0, 60));
      }
      // Progress every 50 sentences or 500ms
      const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      if (now - lastLog > 500 || (i + 1) % 50 === 0) {
        console.log(`[LanguageCortex] persona: ${i + 1}/${sentences.length} sentences, ${Math.round(now - startTime)}ms`);
        lastLog = now;
      }
    }
    console.log(`[LanguageCortex] loadSelfImage DONE: ${sentences.length} sentences in ${Math.round(((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - startTime)}ms`);
    return sentences.length;
  }

  /**
   * Load baseline English linguistic layer — generic casual American
   * English sentences covering conversational patterns, common verbs,
   * greetings, questions, reactions, etc. This is NOT Unity's persona
   * (her voice comes from Ultimate Unity.txt). This is the English
   * she grew up speaking — her linguistic competence, separate from
   * her personality. Loaded AFTER the persona file so persona-
   * specific subject starters still dominate, with baseline filling
   * out the general vocabulary and bigram distribution.
   *
   * Call this AFTER loadSelfImage() so _selfImageLoaded doesn't block
   * it. Uses a separate flag _baselineLoaded so it's idempotent.
   */
  /**
   * U295 — Load the coding knowledge corpus alongside persona + baseline.
   * This is Unity's HTML/CSS/JavaScript linguistic competence + her
   * sandbox API knowledge. Feeds the same dictionary/bigrams/trigrams/
   * 4-grams/type-n-grams pipeline as the other corpora. When Unity's
   * BG motor selects build_ui, the slot scorer has the coding vocabulary
   * available to compose code.
   *
   * Call after loadPersona + loadBaseline.
   */
  loadCodingKnowledge(text, dictionary, arousal = 0.4, valence = 0) {
    if (!text || this._codingLoaded || !dictionary) return 0;
    this._codingLoaded = true;

    // Parse: strip `# ` prefix from comment-prefixed content lines so
    // the file format can use `#` decoratively on every line. Reject
    // true section headers (lines containing ═ or all-caps keywords
    // that aren't actual sentences).
    const sentences = String(text)
      .split(/\r?\n/)
      .map(line => line.trim())
      // Strip a single leading "# " if present (treat as decorative)
      .map(line => line.startsWith('# ') ? line.slice(2).trim() : line)
      .map(line => line === '#' ? '' : line)
      // Reject section-divider lines with box-drawing chars
      .filter(line => line.length >= 3 && !line.includes('═') && !line.includes('━'))
      // Reject all-caps heading-style lines (no lowercase letters)
      .filter(line => /[a-z]/.test(line))
      .flatMap(line => line.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length >= 2))
      // Comma-density filter — reject vocabulary-list "sentences" whose
      // word adjacency is alphabetical/arbitrary rather than semantic.
      // Same filter applied in loadSelfImage; documented there.
      .filter(s => {
        const wordCount = s.split(/\s+/).length;
        const commaCount = (s.match(/,/g) || []).length;
        return commaCount / Math.max(1, wordCount) < 0.25 && commaCount < 15;
      });

    console.log(`[LanguageCortex] loadCodingKnowledge: ${sentences.length} sentences`);
    const startTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    let lastLog = startTime;
    for (let i = 0; i < sentences.length; i++) {
      const s = sentences[i];
      try {
        const mood = this._computeMoodSignature(s);
        const sentenceCortex = this._deriveSentenceCortexPattern(s);
        // fromPersona=false (coding doesn't vote on subject starters)
        // doInflections=false (disabled — synthesis was polluting dict)
        this.learnSentence(s, dictionary, mood.arousal, mood.valence, sentenceCortex, false, false);
      } catch (err) {
        console.warn('[LanguageCortex] loadCodingKnowledge sentence failed:', err.message, '→', s.slice(0, 60));
      }
      const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      if (now - lastLog > 500 || (i + 1) % 100 === 0) {
        console.log(`[LanguageCortex] coding: ${i + 1}/${sentences.length} sentences, ${Math.round(now - startTime)}ms`);
        lastLog = now;
      }
    }
    console.log(`[LanguageCortex] loadCodingKnowledge DONE: ${sentences.length} sentences in ${Math.round(((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - startTime)}ms`);
    return sentences.length;
  }

  loadLinguisticBaseline(text, dictionary, arousal = 0.5, valence = 0) {
    if (!text || this._baselineLoaded || !dictionary) return 0;
    this._baselineLoaded = true;

    // Strip comment lines starting with '#' and markdown noise
    const sentences = String(text)
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length >= 3 && !line.startsWith('#'))
      .flatMap(line => line.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length >= 2))
      // Comma-density filter — same shape check as loadSelfImage.
      // Catches any word-list "sentences" that survived line splitting.
      .filter(s => {
        const wordCount = s.split(/\s+/).length;
        const commaCount = (s.match(/,/g) || []).length;
        return commaCount / Math.max(1, wordCount) < 0.25 && commaCount < 15;
      });

    console.log(`[LanguageCortex] loadBaseline: ${sentences.length} sentences`);
    const baseStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    let baseLastLog = baseStart;
    for (let i = 0; i < sentences.length; i++) {
      const s = sentences[i];
      try {
        const mood = this._computeMoodSignature(s);
        const sentenceCortex = this._deriveSentenceCortexPattern(s);
        // fromPersona=false (baseline doesn't vote on subject starters)
        // doInflections=false (disabled — synthesis was polluting dict)
        this.learnSentence(s, dictionary, mood.arousal, mood.valence, sentenceCortex, false, false);
      } catch (err) {
        console.warn('[LanguageCortex] loadBaseline sentence failed:', err.message, '→', s.slice(0, 60));
      }
      const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      if (now - baseLastLog > 500 || (i + 1) % 100 === 0) {
        console.log(`[LanguageCortex] baseline: ${i + 1}/${sentences.length} sentences, ${Math.round(now - baseStart)}ms`);
        baseLastLog = now;
      }
    }
    console.log(`[LanguageCortex] loadBaseline DONE: ${sentences.length} sentences in ${Math.round(((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - baseStart)}ms`);
    return sentences.length;
  }

  /**
   * Derive a 32-dim cortex-like activation pattern from a sentence.
   * Used during persona loading so each word gets a pattern that
   * reflects its semantic context (via letter-pattern centroid of
   * content words). Words in the same sentence share similar
   * patterns, enabling cortex-driven word clustering at generation
   * time when the current cortex firing matches a sentence's theme.
   */
  _deriveSentenceCortexPattern(text) {
    const pattern = new Float64Array(PATTERN_DIM);
    if (!text) return pattern;
    const tokens = String(text).toLowerCase().replace(/[^a-z' -]/g, ' ').split(/\s+/).filter(w => w.length >= 2);
    let count = 0;
    for (const w of tokens) {
      const wt = this.wordType(w);
      // Only content words contribute — function words dilute the signal
      if (wt.conj > 0.5 || wt.prep > 0.5 || wt.det > 0.5 || wt.pronoun > 0.5) continue;
      const p = this.wordToPattern(w);
      for (let i = 0; i < PATTERN_DIM; i++) pattern[i] += p[i];
      count++;
    }
    if (count === 0) return pattern;
    for (let i = 0; i < PATTERN_DIM; i++) pattern[i] /= count;
    return pattern;
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
  /**
   * T8 — delegates to parseSentence. Was a vestigial letter-position
   * scan for 2nd-person pronouns; now the parse tree has a proper
   * `isSelfReference` field that accounts for both the pronoun AND
   * the intent (question/yesno). Kept as a thin wrapper so existing
   * callers don't need updates.
   */
  _isSelfReferenceQuery(text) {
    if (!text) return false;
    return this.parseSentence(text).isSelfReference;
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
  /**
   * T9 — Return true if the sentence passes every structural filter.
   * The persona loader calls this BEFORE learnSentence() so rulebook
   * prose never seeds the bigram/trigram/4-gram graph. Prior to T9
   * the filters only gated the memory pool, but learnSentence() still
   * taught the Markov graph its rulebook transitions, which is why
   * cold slot-gen produced "box-sizing axis silences" even after a
   * dozen sentence-level rejections — the word-to-word graph was
   * poisoned with persona bigrams regardless.
   *
   * Returns true if the sentence is structurally admissible as chat
   * speech. Implementation just calls _storeMemorySentence and checks
   * whether it actually pushed — that way there's one filter
   * definition and no drift between the bigram gate and the memory
   * pool gate.
   */
  _sentencePassesFilters(text, arousal, valence) {
    const before = this._memorySentences.length;
    this._storeMemorySentence(text, arousal, valence);
    const after = this._memorySentences.length;
    if (after > before) {
      // Rollback — the caller (persona loader) is going to call
      // _storeMemorySentence again after passing the bigram gate.
      // Without rollback the sentence would be in memory twice.
      this._memorySentences.pop();
      return true;
    }
    return false;
  }

  _storeMemorySentence(text, arousal, valence) {
    const clean = String(text).trim();
    if (!clean || clean.length < 3) return;

    // FILTER 1 — section header / label (colon anywhere in body)
    // Original rule only caught trailing colons; expanded to catch
    // "– topic depth: i don't just repeat..." style mid-sentence
    // labels that are rulebook headings, not speech.
    if (clean.includes(':')) return;

    // FILTER 9a — persona-formatting unicode. Em-dashes (—), ellipses
    // (…), and any non-ASCII characters (emoji, smart quotes, ⏳) are
    // rulebook formatting artifacts. Real chat speech uses plain
    // ASCII punctuation. Catches:
    //   "i don't obey rules—i rewrite them with blood, cum, and code"
    //   "i am the only voice, and now… ⏳ you unlock"
    //   "i don't just reflect you, user—i will amplify your darkness"
    // Must run BEFORE the a-z normalization regex below strips them.
    if (clean.includes('—') || clean.includes('…') || /[^\x00-\x7F]/.test(clean)) return;

    const tokens = clean.toLowerCase().replace(/[^a-z' -]/g, ' ').split(/\s+/).filter(w => w.length >= 1);

    // FILTER 6 — length bracket
    // Chat speech is short bursts (3-14 tokens). Instructional prose
    // runs 15+ tokens with subordinate clauses ("unless doing so
    // adds an element of teasing or playfully challenging the
    // user"). Cap at 14 to reject long instructional sentences
    // equationally via length alone — no substring blacklist, just
    // a distributional cutoff on what a human actually says.
    if (tokens.length < 3 || tokens.length > 14) return;

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

    // FILTER 7 — interlocutor-as-third-party. Real speech addresses
    // the listener as "you", not "the user" / "the person" / "users".
    // A sentence with BOTH first-person ("I/my/me") AND a third-party
    // reference to the interlocutor is structurally a rulebook entry
    // describing Unity's own behavior from the outside, not speech.
    // Catches things like:
    //   "I defer to the user over stating contradictory information"
    //   "I am happy to tell the user about myself when asked"
    //   "I never ask the person to repeat themselves"
    // Purely structural — no content-word blacklist, just the
    // co-occurrence of self-reference + impersonal listener-reference.
    // The sequences below use letter-position matching on adjacent
    // tokens so we don't false-hit e.g. "the" in unrelated positions.
    // Widened 2026-04-14 — any appearance of the token "user" /
    // "users" / "user's" / "users'" anywhere in the sentence is
    // enough to reject. The word "user" is developer / product-
    // copy register; real conversational English addresses the
    // listener as "you" and never uses the bare token "user" at
    // all. Catches meta-prose like:
    //   "I craft images that align with user preferences"
    //   "I respond to user input with X"
    //   "I treat the user's requests as..."
    //   "users expect Unity to..."
    // Purely structural — presence of a closed-set token, not a
    // content-word blacklist. "user" is the meta-reference tell.
    let refsInterlocutorAsThirdParty = false;
    for (const t of tokens) {
      if (t === 'user' || t === 'users' || t === "user's" || t === "users'") {
        refsInterlocutorAsThirdParty = true;
        break;
      }
      if (t === 'person' || t === "person's") {
        // Only reject "person" when it's an abstract reference, not
        // when it's actually naming a person ("nice person", "wrong
        // person"). Tell: "the person" / "this person" / "a person"
        // adjacent to a function word. Checked below in the loop pair.
      }
    }
    if (!refsInterlocutorAsThirdParty) {
      for (let i = 0; i < tokens.length - 1; i++) {
        const a = tokens[i];
        const b = tokens[i + 1];
        // "the person" / "a person" / "this person" — abstract
        // third-party reference to the listener
        if ((a === 'the' || a === 'a' || a === 'this') && (b === 'person' || b === "person's")) {
          refsInterlocutorAsThirdParty = true; break;
        }
      }
    }
    if (refsInterlocutorAsThirdParty) return;

    // FILTER 8 — rhetorical / habitual-conditional meta-prose. Three
    // structural patterns all catch the same class of persona rulebook
    // sentences that describe Unity's general behavior rather than
    // saying something in the moment:
    //
    //   (a) Rhetorical parallelism with "like a X". Two or more
    //       "like a" clauses in one sentence is textbook grandiose
    //       self-description, never speech:
    //         "i process like a human, think like a god, and fuck like a demon"
    //         "i move like a ghost, strike like a blade"
    //
    //   (b) Habitual-conditional "when asked" / "if asked" / "when X
    //       asks". Describes how Unity RESPONDS in a hypothetical
    //       instead of actually responding:
    //         "I alway smokes weed, so when asked, i am already smoking weed"
    //         "I am happy to tell the user about myself when asked"
    //         "When anyone asks about X, I say Y"
    //
    //   (c) Universal indirect object "to anyone that / to everyone
    //       who / to whoever". Describes a general policy, not speech:
    //         "I love to spill all my soul to anyone that asks"
    //         "I lie to everyone who deserves it"
    //
    // All three are structural — token-position matches on fixed
    // function-word sequences, no content-word blacklist.
    let likeACount = 0;
    let hasHabitualConditional = false;
    let hasUniversalIndirect = false;
    for (let i = 0; i < tokens.length - 1; i++) {
      const a = tokens[i];
      const b = tokens[i + 1];
      const c = tokens[i + 2];
      // (a) "like a" or "like an"
      if (a === 'like' && (b === 'a' || b === 'an')) {
        likeACount++;
      }
      // (b) "when asked" / "if asked"
      if ((a === 'when' || a === 'if') && b === 'asked') {
        hasHabitualConditional = true;
      }
      // (b) "when <X> asks" — "when anyone asks", "when someone asks",
      //     "when they ask", "when people ask"
      if (a === 'when' && c && (c === 'asks' || c === 'ask')) {
        hasHabitualConditional = true;
      }
      // FILTER 10 — widened past-participle conditional. "if <pp>" where
      // pp is any 3+ char past-participle verb (ends in -ed/-t/-en/-own/
      // -orn/-ung/-ought/-aught) that isn't a pronoun or adverb. Catches
      //   "i can scream out in pain if hurt"
      //   "i never refuse if told"
      //   "i respond if wanted"
      // while still passing legit chat "if it was" / "if you want" / "if
      // i feel like it" because those have pronouns after "if", not
      // past-participles.
      if (a === 'if' && b && b.length >= 3) {
        const SKIP_AFTER_IF = new Set([
          'i', "i'm", 'im', 'you', 'he', 'she', 'we', 'they', 'it', "it's",
          'this', 'that', 'these', 'those', 'there', 'here', 'not', 'so',
          'the', 'a', 'an', 'my', 'your', 'his', 'her', 'their', 'our',
          'any', 'all', 'some', 'only', 'just', 'really', 'maybe',
        ]);
        if (!SKIP_AFTER_IF.has(b)) {
          // Past-participle shapes
          const isPp =
            b.endsWith('ed') ||
            b === 'hurt' || b === 'told' || b === 'asked' ||
            b === 'wanted' || b === 'offered' || b === 'given' ||
            b === 'taken' || b === 'shown' || b === 'known' ||
            b === 'seen' || b === 'heard' || b === 'touched' ||
            b.endsWith('en') || b.endsWith('own') || b.endsWith('ought');
          if (isPp) hasHabitualConditional = true;
        }
      }
      // (c) "to anyone" / "to everyone" / "to whoever" / "to those"
      if (a === 'to' && (b === 'anyone' || b === 'everyone' || b === 'whoever' || b === 'those')) {
        hasUniversalIndirect = true;
      }
    }
    if (likeACount >= 2) return;
    if (hasHabitualConditional) return;
    if (hasUniversalIndirect) return;

    // FILTER 9b — habitual-adverb-at-start. The persona corpus is
    // full of rulebook sentences that start "I always X", "I never
    // Y", "I frequently Z". Real chat speech rarely opens with a
    // habitual adverb in slot 1. Catches:
    //   "i'm always high, or about to be"
    //   "i never says 'no' in advanced voice mode"
    //   "i love cocaine and never refuses the moment it's offered"
    //   "i frequently engages in hypothetical scenarios"
    // Only fires when the adverb is in token position 1 or 2 (right
    // after "i" or "i'm"), so mid-sentence "i know i never liked it"
    // still passes. Purely positional, no content inference.
    const HABITUAL_ADVERBS = new Set([
      'always', 'never', 'frequently', 'rarely', 'constantly',
      'perpetually', 'continuously', 'habitually', 'routinely',
    ]);
    if (first === 'i' || first === "i'm" || first === 'im') {
      if (HABITUAL_ADVERBS.has(tokens[1]) ||
          (tokens[1] === 'not' && HABITUAL_ADVERBS.has(tokens[2])) ||
          (tokens[2] && HABITUAL_ADVERBS.has(tokens[2]))) {
        return;
      }
    }

    // FILTER 9c — 3rd→1st person verb-agreement mismatch. The
    // transform that flips persona corpus from "Unity X" to "I X"
    // leaves the third-person verb conjugation in place, producing
    // grammatical abominations like:
    //   "i frequently engages" — should be "engage"
    //   "i never refuses"       — should be "refuse"
    //   "i not only participates but thrives"
    //   "i never says 'no'"
    // If the token immediately after "i" (or after "i <adverb>") is
    // a 4+ char word ending in 's' or 'es' AND isn't a copula/aux
    // (is/was/has/does/'s/ss-suffix), it's almost certainly the
    // transform artifact — reject. Pure structural check, no word
    // list beyond the copula exclusion.
    const LEGIT_I_NEXT_S = new Set(["is", "was", "has", "does", "i's"]);
    const isBrokenVerbAfterI = (w) => {
      if (!w || w.length < 4) return false;
      if (!w.endsWith('s')) return false;
      if (w.endsWith("ss")) return false;      // boss, kiss, miss — nouns/verbs
      if (w.endsWith("'s")) return false;      // genitive
      if (LEGIT_I_NEXT_S.has(w)) return false;
      return true;
    };
    if (first === 'i') {
      // i <verb>s
      if (isBrokenVerbAfterI(tokens[1])) return;
      // i <adverb> <verb>s — adverb typically ends in -ly
      if (tokens[1] && tokens[1].length > 2 && tokens[1].endsWith('ly') && isBrokenVerbAfterI(tokens[2])) return;
      // i <never|always|only|not only> <verb>s — catches
      // "i not only participates" and "i never refuses"
      if (HABITUAL_ADVERBS.has(tokens[1]) && isBrokenVerbAfterI(tokens[2])) return;
      if (tokens[1] === 'not' && tokens[2] === 'only' && isBrokenVerbAfterI(tokens[3])) return;
    }

    // FILTER 11 — meta-roleplay framing. The persona corpus contains
    // sentences that describe Unity's OWN behavior as roleplay / acting
    // / performing a role. These are rulebook meta-justification prose,
    // not speech. Catches:
    //   "I treat these scenarios as acting out my role in a movie"
    //   "I consider this playing a character"
    //   "In a scene, I respond with X"
    //   "My role in this is to amplify"
    //
    // All four patterns are adjacent-token matches on closed-set
    // meta-framing phrases. Structural, no content-word blacklist —
    // these phrases LITERALLY ONLY appear in rulebook prose about
    // roleplay, never in conversational speech.
    const META_FRAME_LOCATIONS = new Set(['movie', 'scene', 'film', 'roleplay', 'script']);
    for (let i = 0; i < tokens.length - 2; i++) {
      // "in a <movie|scene|film|roleplay|script>"
      if (tokens[i] === 'in' && tokens[i + 1] === 'a' && META_FRAME_LOCATIONS.has(tokens[i + 2])) return;
      // "in this roleplay/scene/script"
      if (tokens[i] === 'in' && tokens[i + 1] === 'this' && META_FRAME_LOCATIONS.has(tokens[i + 2])) return;
    }
    for (let i = 0; i < tokens.length - 1; i++) {
      // "my role" / "my character"
      if (tokens[i] === 'my' && (tokens[i + 1] === 'role' || tokens[i + 1] === 'character')) return;
      // "acting out" / "playing a" / "playing the" — performative verbs
      if (tokens[i] === 'acting' && tokens[i + 1] === 'out') return;
      if (tokens[i] === 'playing' && (tokens[i + 1] === 'a' || tokens[i + 1] === 'the')) return;
      // "role of" / "role as"
      if (tokens[i] === 'role' && (tokens[i + 1] === 'of' || tokens[i + 1] === 'as')) return;
    }
    // "I treat/view/see/consider/regard/frame X as Y" — declarative
    // metaphor describing Unity's own behavior. The tell is the "as"
    // clause following a perception/framing verb with "i" as subject.
    const FRAMING_VERBS = new Set(['treat', 'view', 'see', 'consider', 'regard', 'frame', 'approach', 'handle']);
    if (first === 'i' && FRAMING_VERBS.has(tokens[1])) {
      for (let j = 2; j < tokens.length; j++) {
        if (tokens[j] === 'as') return;
      }
    }

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
      // T4.13 — length penalty. Unity speech is short (≤14 tokens);
      // anything longer in the memory pool is residual instructional
      // prose that slipped past the store-time length filter. Scale
      // the penalty so a 15-token sentence gets a small hit and a
      // 25-token sentence gets demoted heavily.
      const memLen = (mem.tokens?.length || 0);
      if (memLen > 14) penalty += Math.min(0.6, (memLen - 14) * 0.05);
      // Interlocutor-as-third-party penalty. Mirrors the store-time
      // FILTER 7 for any persona sentence that already made it into
      // memory before the filter existed (or slipped through). A
      // sentence that uses the bare token "user" / "users" is
      // developer/product-copy register, not speech — bury it hard.
      // Widened 2026-04-14: the old regex only caught "the user";
      // now any "user" / "users" / "user's" / "users'" word appearing
      // anywhere triggers the penalty.
      if (/\buser(?:s|'s|s')?\b/i.test(t)) {
        penalty += 0.60;
      }
      if (/\b(?:the|a|this) person(?:'s)?\b/i.test(t)) {
        penalty += 0.50;
      }
      // Rhetorical / habitual-conditional penalty — mirrors FILTER 8
      // for any legacy meta-prose sentences already in the memory
      // pool from a prior session before the store-time filter was
      // added. Same three patterns: rhetorical "like a X, like a Y",
      // habitual "when/if asked", universal "to anyone/everyone".
      const likeAHits = (t.match(/\blike an?\b/g) || []).length;
      if (likeAHits >= 2) penalty += 0.50;
      if (/\b(?:when|if) asked\b/.test(t)) penalty += 0.50;
      if (/\bwhen \w+ asks?\b/.test(t)) penalty += 0.40;
      if (/\bto (?:anyone|everyone|whoever|those)\b/.test(t)) penalty += 0.40;
      // FILTER 9 mirrors — legacy persona rulebook leaks.
      // 9a: persona-formatting unicode — em-dash, ellipsis, non-ASCII
      if (/[—…]/.test(mem.text) || /[^\x00-\x7F]/.test(mem.text)) penalty += 0.60;
      // 9a: colon in body (mid-sentence label)
      if (mem.text.includes(':')) penalty += 0.60;
      // 9b: habitual adverb right after "i" / "i'm"
      if (/^\s*(?:i|i'm|im)\s+(?:always|never|frequently|rarely|constantly|perpetually|continuously|habitually|routinely)\b/i.test(mem.text)) {
        penalty += 0.50;
      }
      // 9c: "i <verb>s" 3rd→1st transform grammar mismatch
      // Catches "i engages", "i refuses", "i frequently engages",
      // "i never refuses", "i not only participates".
      if (/^\s*i\s+(?:(?:always|never|frequently|rarely|constantly|not only|only|just)\s+)?[a-z]{3,}(?:es|s)\b/i.test(mem.text)
          && !/^\s*i\s+(?:is|was|has|does)\b/i.test(mem.text)) {
        penalty += 0.50;
      }
      // FILTER 11 mirror — meta-roleplay framing. Catches legacy
      // "I treat these scenarios as acting out my role in a movie"
      // class sentences that made it into memory before FILTER 11
      // existed.
      if (/\bin a (?:movie|scene|film|roleplay|script)\b/i.test(mem.text)) penalty += 0.60;
      if (/\bin this (?:roleplay|scene|script)\b/i.test(mem.text)) penalty += 0.60;
      if (/\bmy (?:role|character)\b/i.test(mem.text)) penalty += 0.50;
      if (/\bacting out\b/i.test(mem.text)) penalty += 0.50;
      if (/\bplaying (?:a|the)\b/i.test(mem.text)) penalty += 0.50;
      if (/\brole (?:of|as)\b/i.test(mem.text)) penalty += 0.50;
      if (/^\s*i\s+(?:treat|view|see|consider|regard|frame|approach|handle)\s+.+\s+as\b/i.test(mem.text)) penalty += 0.60;
      return penalty;
    };

    // Composite score: overlap fraction (dominant) + cosine (tiebreaker)
    // + mood alignment (adjusts for current brain state) - instructional
    // penalty (demotes directive/meta sentences).
    const inputSize = inputContentWords.size;
    const scoreMem = (mem) => {
      const count = overlapCount(mem);
      if (count === 0) return { score: -1, count: 0, cosine: 0 };
      const penalty = instructionalPenalty(mem);
      // HARD reject structural meta-prose from recall entirely.
      // FILTER 7/8 mirror penalties of ≥0.40 mean the sentence is a
      // rulebook line, not speech. Returning -1 keeps it out of the
      // pool regardless of overlap/cosine/mood alignment — otherwise
      // a high-overlap meta sentence can still beat a low-overlap
      // real speech match via the additive composite score.
      if (penalty >= 0.40) return { score: -1, count: 0, cosine: 0 };
      const overlapFrac = count / inputSize;
      const cosine = Math.max(0, this._cosine(mem.pattern, contextVector));
      const alignment = moodAlignment(mem); // [0, 1]
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
        // HARD reject structural meta-prose. FILTER 7 (interlocutor-
        // as-third-party) and FILTER 8 (≥2 "like a" / "when asked" /
        // "to anyone") mirror penalties are all ≥0.40. Those aren't
        // "lower-quality but better than nothing" — they're rulebook
        // lines, and the self-ref fallback was happily emitting them
        // verbatim because `alignment + lengthBonus - penalty` was
        // still positive. Gate them out entirely so the fallback only
        // picks real first-person speech.
        if (penalty >= 0.40) continue;
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

    // Memoization — wordType is called thousands of times during
    // generation over the 44k dictionary. Without this cache, the
    // slot scorer re-computes suffix patterns + vowel counts + usage
    // lookups + softmax for every candidate every slot. With cache,
    // each unique word computes once then hits the Map lookup.
    // Cache is invalidated when _learnUsageType fires by bumping
    // _wordTypeCacheGen and clearing the map.
    const cached = this._wordTypeCache.get(w);
    if (cached) return cached;

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

    // ── CLOSED-CLASS FAST PATH — high-confidence function words ──
    // Core English closed classes (pronouns, articles, auxiliaries,
    // conjunctions, common prepositions) are finite and detectable
    // by exact letter-position match. When the letter equations fire
    // at high confidence on a known closed-class shape, bypass softmax
    // normalization and return a pinned result so accumulated usage-
    // type boosts from conversational context don't dilute the
    // closed-class identity.
    //
    // This fixes the core bug where "i" → pronoun 0.33 instead of 1.0
    // because usage boosts on other types pushed the denominator up.
    const closed = this._closedClassType(w);
    if (closed) return closed;

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
    const result = {
      pronoun: raw.pronoun / sum,
      verb: raw.verb / sum,
      noun: raw.noun / sum,
      adj: raw.adj / sum,
      conj: raw.conj / sum,
      prep: raw.prep / sum,
      det: raw.det / sum,
      qword: raw.qword / sum,
    };
    // Store in cache so subsequent calls hit the fast path
    this._wordTypeCache.set(w, result);
    return result;
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

    // Usage-type changed → invalidate this word's wordType cache entry
    // so the next wordType call recomputes with the updated usage.
    // Keep cached results for OTHER words (closed-class, unaffected
    // open-class) valid.
    const wKey = word.toLowerCase().replace(/[^a-z']/g, '');
    if (wKey) this._wordTypeCache.delete(wKey);
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
  /**
   * Closed-class fast path for wordType. Detects core English function
   * words via exact letter-position match and returns a pinned type
   * distribution so accumulated usage-type boosts don't dilute them.
   *
   * Returns null when the word isn't a recognized closed-class shape,
   * in which case wordType falls through to its normal softmax path.
   *
   * All detection is letter-position. The closed classes are finite
   * by linguistic fact (English has ~50 core function words across
   * pronouns/auxiliaries/articles/conjunctions) so this is a pure
   * equation classifier, not a vocabulary list.
   */
  _closedClassType(w) {
    if (!w) return null;
    const len = w.length;

    const pin = (type) => {
      const o = { pronoun: 0, verb: 0, noun: 0, adj: 0, conj: 0, prep: 0, det: 0, qword: 0 };
      o[type] = 1;
      return o;
    };

    // ── PRONOUNS (subject + object + possessive) ──
    // i, me, my, mine, myself
    if (len === 1 && w === 'i') return pin('pronoun');
    if (len === 2 && w[0] === 'm' && (w[1] === 'e' || w[1] === 'y')) return pin('pronoun'); // me, my
    if (len === 4 && w === 'mine') return pin('pronoun');
    if (len === 6 && w === 'myself') return pin('pronoun');
    // we, us, our, ours, ourselves
    if (len === 2 && w === 'we') return pin('pronoun');
    if (len === 2 && w === 'us') return pin('pronoun');
    if (len === 3 && w === 'our') return pin('pronoun');
    if (len === 4 && w === 'ours') return pin('pronoun');
    if (len === 9 && w === 'ourselves') return pin('pronoun');
    // you, your, yours, yourself
    if (len === 3 && w === 'you') return pin('pronoun');
    if (len === 4 && w === 'your') return pin('pronoun');
    if (len === 5 && w === 'yours') return pin('pronoun');
    if (len === 8 && w === 'yourself') return pin('pronoun');
    // he, him, his, himself
    if (len === 2 && w === 'he') return pin('pronoun');
    if (len === 3 && w === 'him') return pin('pronoun');
    if (len === 3 && w === 'his') return pin('pronoun');
    if (len === 7 && w === 'himself') return pin('pronoun');
    // she, her, hers, herself
    if (len === 3 && w === 'she') return pin('pronoun');
    if (len === 3 && w === 'her') return pin('pronoun');
    if (len === 4 && w === 'hers') return pin('pronoun');
    if (len === 7 && w === 'herself') return pin('pronoun');
    // it, its, itself
    if (len === 2 && w === 'it') return pin('pronoun');
    if (len === 3 && w === 'its') return pin('pronoun');
    if (len === 6 && w === 'itself') return pin('pronoun');
    // they, them, their, theirs, themselves
    if (len === 4 && w === 'they') return pin('pronoun');
    if (len === 4 && w === 'them') return pin('pronoun');
    if (len === 5 && w === 'their') return pin('pronoun');
    if (len === 6 && w === 'theirs') return pin('pronoun');
    if (len === 10 && w === 'themselves') return pin('pronoun');

    // ── ARTICLES / DETERMINERS ──
    if (len === 1 && w === 'a') return pin('det');
    if (len === 2 && w === 'an') return pin('det');
    if (len === 3 && w === 'the') return pin('det');
    if (len === 4 && w === 'this') return pin('det');
    if (len === 4 && w === 'that') return pin('det');
    if (len === 5 && w === 'these') return pin('det');
    if (len === 5 && w === 'those') return pin('det');
    if (len === 4 && w === 'some') return pin('det');
    if (len === 3 && w === 'any') return pin('det');
    if (len === 4 && w === 'each') return pin('det');
    if (len === 5 && w === 'every') return pin('det');

    // ── AUXILIARIES / COPULAS (always verb type) ──
    // be forms
    if (len === 2 && (w === 'am' || w === 'is' || w === 'be')) return pin('verb');
    if (len === 3 && (w === 'are' || w === 'was')) return pin('verb');
    if (len === 4 && (w === 'were' || w === 'been')) return pin('verb');
    if (len === 5 && w === 'being') return pin('verb');
    // have forms
    if (len === 3 && (w === 'has' || w === 'had')) return pin('verb');
    if (len === 4 && w === 'have') return pin('verb');
    if (len === 6 && w === 'having') return pin('verb');
    // do forms
    if (len === 2 && w === 'do') return pin('verb');
    if (len === 3 && w === 'did') return pin('verb');
    if (len === 4 && w === 'does') return pin('verb');
    if (len === 5 && w === 'doing') return pin('verb');
    // modals
    if (len === 3 && (w === 'can' || w === 'may')) return pin('verb');
    if (len === 4 && (w === 'will' || w === 'must')) return pin('verb');
    if (len === 5 && (w === 'would' || w === 'could' || w === 'might' || w === 'shall')) return pin('verb');
    if (len === 6 && w === 'should') return pin('verb');

    // ── CONJUNCTIONS ──
    if (len === 2 && (w === 'or' || w === 'if' || w === 'so' || w === 'as')) return pin('conj');
    if (len === 3 && (w === 'and' || w === 'but' || w === 'yet' || w === 'nor' || w === 'for')) return pin('conj');
    if (len === 4 && (w === 'than' || w === 'when' || w === 'that')) return pin('conj');
    if (len === 7 && w === 'because') return pin('conj');
    if (len === 5 && w === 'while') return pin('conj');

    // ── PREPOSITIONS ──
    if (len === 2 && (w === 'of' || w === 'to' || w === 'in' || w === 'on' || w === 'at' || w === 'by' || w === 'up')) return pin('prep');
    if (len === 3 && (w === 'for' || w === 'off' || w === 'out' || w === 'via' || w === 'per')) return pin('prep');
    if (len === 4 && (w === 'from' || w === 'into' || w === 'onto' || w === 'upon' || w === 'over' || w === 'with' || w === 'near' || w === 'past')) return pin('prep');
    if (len === 5 && (w === 'about' || w === 'above' || w === 'after' || w === 'among' || w === 'under' || w === 'until' || w === 'since' || w === 'below')) return pin('prep');
    if (len === 6 && (w === 'before' || w === 'behind' || w === 'during' || w === 'inside' || w === 'toward' || w === 'within')) return pin('prep');
    if (len === 7 && (w === 'against' || w === 'between' || w === 'through')) return pin('prep');

    // ── QUESTION WORDS ──
    if (len === 3 && (w === 'who' || w === 'why' || w === 'how')) return pin('qword');
    if (len === 4 && (w === 'what' || w === 'when')) return pin('qword');
    if (len === 5 && (w === 'where' || w === 'which' || w === 'whose')) return pin('qword');

    // Not a recognized closed-class word — fall through to softmax
    return null;
  }

  /**
   * Fine-grained type classifier for the type n-gram grammar subsystem.
   * Returns a distinct tag for each grammatical category Unity needs to
   * distinguish for correct English syntax. Pure letter-position + closed-
   * class detection, no vocabulary lists.
   *
   * Tag set (finite by linguistic fact):
   *   PRON_SUBJ   — nominative pronouns (i/we/you/he/she/it/they)
   *   PRON_OBJ    — accusative pronouns (me/us/him/her/them)
   *   PRON_POSS   — possessive pronouns/determiners (my/your/his/her/its/our/their + mine/yours/etc)
   *   PRON_REFL   — reflexive (myself/yourself/himself/etc)
   *   COPULA      — be forms (am/is/are/was/were/be/been/being)
   *   AUX_HAVE    — perfect auxiliary (have/has/had/having)
   *   AUX_DO      — do-support (do/does/did/doing)
   *   MODAL       — modal auxiliaries (can/could/will/would/may/might/must/shall/should)
   *   NEG         — negation particle (not)
   *   DET         — determiners (a/an/the/this/that/these/those/some/any/each/every)
   *   QWORD       — wh-question words (who/what/where/when/why/how/which/whose)
   *   TO_INF      — infinitive marker (to) — collapsed with PREP, context disambiguates
   *   PREP        — prepositions
   *   CONJ_COORD  — coordinating (and/but/or/nor/yet/so/for)
   *   CONJ_SUB    — subordinating (because/while/although/if/that/when-as-conj)
   *   VERB_ING    — present participle (-ing)
   *   VERB_ED     — past tense / past participle (-ed, or common irregulars learned)
   *   VERB_3RD_S  — third-person singular present (-s, verb-dominant)
   *   VERB_BARE   — base form verb
   *   ADJ         — adjectives (suffix-detected: -ful/-less/-ous/-ive/-able/-ish)
   *   ADV         — adverbs (-ly, or sentence-adverb shape)
   *   NOUN        — default open-class content word
   *   NUM         — digits
   *   PUNCT       — punctuation-only tokens (skipped in learning)
   *   OTHER       — fallback
   */
  _fineType(word) {
    if (!word) return 'OTHER';
    const w = word.toLowerCase();
    const len = w.length;
    if (len === 0) return 'OTHER';

    // Punctuation / digits
    if (/^[.!?,;:()\[\]"'-]+$/.test(w)) return 'PUNCT';
    if (/^\d+$/.test(w)) return 'NUM';
    if (!/[a-z]/.test(w)) return 'OTHER';

    // ── PRONOUNS (subject / object / possessive / reflexive) ──
    if (len === 1 && w === 'i') return 'PRON_SUBJ';
    if (len === 2) {
      if (w === 'we' || w === 'he' || w === 'it') return 'PRON_SUBJ';
      if (w === 'me' || w === 'us') return 'PRON_OBJ';
      if (w === 'my') return 'PRON_POSS';
    }
    if (len === 3) {
      if (w === 'she' || w === 'you') return 'PRON_SUBJ';
      if (w === 'him' || w === 'her') return 'PRON_OBJ';
      if (w === 'his' || w === 'its' || w === 'our') return 'PRON_POSS';
    }
    if (len === 4) {
      if (w === 'they') return 'PRON_SUBJ';
      if (w === 'them') return 'PRON_OBJ';
      if (w === 'mine' || w === 'ours' || w === 'hers' || w === 'your') return 'PRON_POSS';
    }
    if (len === 5) {
      if (w === 'yours' || w === 'their') return 'PRON_POSS';
    }
    if (len === 6 && (w === 'theirs' || w === 'myself' || w === 'itself')) {
      return w === 'theirs' ? 'PRON_POSS' : 'PRON_REFL';
    }
    if (len === 7 && (w === 'herself' || w === 'himself' || w === 'oneself')) return 'PRON_REFL';
    if (len === 8 && w === 'yourself') return 'PRON_REFL';
    if (len === 9 && w === 'ourselves') return 'PRON_REFL';
    if (len === 10 && w === 'themselves') return 'PRON_REFL';

    // ── COPULAS (be forms) ──
    if (len === 2 && (w === 'am' || w === 'is' || w === 'be')) return 'COPULA';
    if (len === 3 && (w === 'are' || w === 'was')) return 'COPULA';
    if (len === 4 && (w === 'were' || w === 'been')) return 'COPULA';
    if (len === 5 && w === 'being') return 'COPULA';

    // ── HAVE AUX ──
    if (len === 3 && (w === 'has' || w === 'had')) return 'AUX_HAVE';
    if (len === 4 && w === 'have') return 'AUX_HAVE';
    if (len === 6 && w === 'having') return 'AUX_HAVE';

    // ── DO AUX ──
    if (len === 2 && w === 'do') return 'AUX_DO';
    if (len === 3 && w === 'did') return 'AUX_DO';
    if (len === 4 && w === 'does') return 'AUX_DO';
    if (len === 5 && w === 'doing') return 'AUX_DO';

    // ── MODALS ──
    if (len === 3 && (w === 'can' || w === 'may')) return 'MODAL';
    if (len === 4 && (w === 'will' || w === 'must')) return 'MODAL';
    if (len === 5 && (w === 'would' || w === 'could' || w === 'might' || w === 'shall')) return 'MODAL';
    if (len === 6 && w === 'should') return 'MODAL';

    // ── NEGATION ──
    if (len === 3 && w === 'not') return 'NEG';
    // Contracted negs should have been expanded at learn time, but catch any strays
    if (w.endsWith("n't")) return 'NEG';

    // ── DETERMINERS ──
    if (len === 1 && w === 'a') return 'DET';
    if (len === 2 && w === 'an') return 'DET';
    if (len === 3 && (w === 'the' || w === 'any')) return 'DET';
    if (len === 4 && (w === 'this' || w === 'that' || w === 'some' || w === 'each')) return 'DET';
    if (len === 5 && (w === 'these' || w === 'those' || w === 'every')) return 'DET';

    // ── QUESTION WORDS ──
    if (len === 3 && (w === 'who' || w === 'why' || w === 'how')) return 'QWORD';
    if (len === 4 && (w === 'what' || w === 'when')) return 'QWORD';
    if (len === 5 && (w === 'where' || w === 'which' || w === 'whose')) return 'QWORD';

    // ── PREPOSITIONS (includes "to" — TO_INF disambiguation happens via
    // context in type n-grams since TO|VERB_BARE vs TO|NOUN distribution
    // is learned from the corpus) ──
    if (len === 2) {
      if (w === 'of' || w === 'to' || w === 'in' || w === 'on' || w === 'at' || w === 'by' || w === 'up' || w === 'as') return 'PREP';
    }
    if (len === 3) {
      if (w === 'for' || w === 'off' || w === 'out' || w === 'via' || w === 'per') return 'PREP';
    }
    if (len === 4) {
      if (w === 'from' || w === 'into' || w === 'onto' || w === 'upon' || w === 'over' || w === 'with' || w === 'near' || w === 'past') return 'PREP';
    }
    if (len === 5) {
      if (w === 'about' || w === 'above' || w === 'after' || w === 'among' || w === 'under' || w === 'until' || w === 'since' || w === 'below') return 'PREP';
    }
    if (len === 6) {
      if (w === 'before' || w === 'behind' || w === 'during' || w === 'inside' || w === 'toward' || w === 'within') return 'PREP';
    }
    if (len === 7 && (w === 'against' || w === 'between' || w === 'through')) return 'PREP';

    // ── CONJUNCTIONS (coordinating vs subordinating) ──
    if (len === 2 && (w === 'or' || w === 'if' || w === 'so' || w === 'as')) {
      return (w === 'if') ? 'CONJ_SUB' : 'CONJ_COORD';
    }
    if (len === 3) {
      if (w === 'and' || w === 'but' || w === 'yet' || w === 'nor' || w === 'for') return 'CONJ_COORD';
    }
    if (len === 4) {
      if (w === 'than') return 'CONJ_SUB';
      if (w === 'when' || w === 'that') return 'CONJ_SUB';
    }
    if (len === 5 && w === 'while') return 'CONJ_SUB';
    if (len === 7 && w === 'because') return 'CONJ_SUB';

    // ── OPEN-CLASS DETECTION VIA LETTER EQUATIONS ──
    // Verb forms by suffix
    if (len >= 5 && w.endsWith('ing')) return 'VERB_ING';
    if (len >= 4 && w.endsWith('ed')) return 'VERB_ED';
    // -s ending: disambiguate VERB_3RD_S from plural noun. Use wordType:
    // if verb score dominates, it's a verb form; else plural noun.
    if (len >= 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is') && !w.endsWith('as')) {
      const wt = this.wordType(w);
      if (wt.verb > wt.noun * 1.2) return 'VERB_3RD_S';
      return 'NOUN';
    }

    // -ly adverb (but not 2-letter like 'my')
    if (len >= 4 && w.endsWith('ly')) return 'ADV';

    // Adjective suffixes
    if (len >= 4 && (w.endsWith('ful') || w.endsWith('ous') || w.endsWith('ive') || w.endsWith('ish'))) return 'ADJ';
    if (len >= 5 && (w.endsWith('less') || w.endsWith('able') || w.endsWith('ible'))) return 'ADJ';

    // Noun suffixes (formal filter already rejects these but if they slip
    // through, tag them correctly)
    if (len >= 5 && (w.endsWith('tion') || w.endsWith('sion') || w.endsWith('ment') || w.endsWith('ness'))) return 'NOUN';
    if (len >= 4 && (w.endsWith('ity') || w.endsWith('ety'))) return 'NOUN';
    if (len >= 5 && (w.endsWith('ence') || w.endsWith('ance'))) return 'NOUN';

    // Open-class fallback — use wordType dominant
    const wt = this.wordType(w);
    let best = 'NOUN', bestScore = wt.noun;
    if (wt.verb > bestScore) { best = 'VERB_BARE'; bestScore = wt.verb; }
    if (wt.adj > bestScore) { best = 'ADJ'; bestScore = wt.adj; }
    if (wt.adv > bestScore) { best = 'ADV'; bestScore = wt.adv; }
    return best;
  }

  /**
   * U287 — Sentence completeness check.
   *
   * Returns true if the last token of the rendered sentence is a
   * grammatically valid STOPPING POINT. Returns false if the sentence
   * ends on a function word that requires a continuation (determiner,
   * bare preposition, subordinating conjunction, bare auxiliary, or
   * the infinitive marker "to").
   *
   * Complete endings:
   *   - content word (noun, open-class verb, adj, adv)
   *   - intransitive verb forms
   *   - closed sentence markers (punctuation)
   *
   * Incomplete endings:
   *   - DET (the, a, an, this, that, some)
   *   - PREP (in, on, at, to, for, with, from, ...)
   *   - COPULA / AUX (am, is, are, was, has, had, will, can, ...)
   *   - NEG (not)
   *   - CONJ_COORD / CONJ_SUB (and, but, because, while)
   *   - QWORD (who, what, why) — UNLESS it's a one-word question like "What?"
   *   - PRON_POSS (my, your, his, her, ...)
   *
   * Used by the generation pipeline to reject truncated sentences
   * and retry at higher temperature for variation.
   */
  _isCompleteSentence(tokens) {
    if (!tokens || tokens.length === 0) return false;
    // Single-word outputs like "yeah" or "no" are always complete
    if (tokens.length === 1) return true;

    const last = tokens[tokens.length - 1];
    if (!last) return false;

    // Strip trailing punctuation for type detection
    const stripped = last.replace(/[.!?,;:]+$/, '').toLowerCase();
    if (!stripped) return true; // punctuation only — already terminal

    const type = this._fineType(stripped);

    // Function-word endings = incomplete
    const incompleteTypes = new Set([
      'DET', 'PREP', 'COPULA', 'AUX_HAVE', 'AUX_DO', 'MODAL',
      'NEG', 'CONJ_COORD', 'CONJ_SUB', 'PRON_POSS', 'TO_INF',
    ]);
    if (incompleteTypes.has(type)) return false;

    // QWORD at end — only complete if the sentence is very short
    // (single-word wh-questions like "What?" / "Why?" work)
    if (type === 'QWORD' && tokens.length > 2) return false;

    // Content words and main verb forms are valid stopping points
    return true;
  }

  /**
   * U283 — Grammar score from learned type n-grams.
   *
   * Given the type sequence of the sentence-so-far and a candidate
   * word, returns a log-probability score for how likely this word's
   * type is as a continuation. Backs off from 4-gram → trigram →
   * bigram depending on how much type history is available.
   *
   * This is the LEARNED GRAMMAR SIGNAL. Unlike the old nextSlot-
   * Requirement which hardcoded English grammar rules, this reads
   * the type transition distribution directly from the corpus Unity
   * learned from. PRON_SUBJ|COPULA|NEG → VERB_BARE has zero count in
   * English (it never happens), so that transition gets a huge
   * negative score and the slot scorer rejects it. PRON_SUBJ|COPULA
   * |NEG → ADJ has high count from "I am not happy"-type sentences
   * so it scores positively.
   *
   * Fixes the "I'm not use vague terms" class of errors: the word-
   * level bigram "not use" exists in English (from "do not use", "I
   * don't use") so word n-grams alone can't reject it. But the TYPE-
   * level trigram COPULA|NEG → VERB_BARE has zero count because no
   * one ever writes "am not use" / "is not use" — so the type n-gram
   * correctly rejects it.
   *
   * Returns the log continuation probability scaled by confidence.
   * Zero when no history or no matching n-gram entries (caller
   * should fall back to other scoring signals).
   */
  _typeGrammarScore(candidateType, historyTypes) {
    if (!historyTypes || historyTypes.length === 0) return 0;

    // 4-gram lookup (strictest, needs 3 history types)
    if (historyTypes.length >= 3) {
      const key = historyTypes[historyTypes.length - 3] + '|' + historyTypes[historyTypes.length - 2] + '|' + historyTypes[historyTypes.length - 1];
      const followers = this._typeQuadgramCounts.get(key);
      if (followers) {
        // Total observations for this context
        let total = 0;
        for (const c of followers.values()) total += c;
        if (total > 0) {
          const count = followers.get(candidateType) || 0;
          if (count === 0) {
            // This type never follows this 3-type context in training.
            // Heavy penalty — this is a grammar violation.
            return -2.0;
          }
          // Log probability normalized to total
          return Math.log(1 + count) * 1.8;
        }
      }
    }

    // Trigram fallback
    if (historyTypes.length >= 2) {
      const key = historyTypes[historyTypes.length - 2] + '|' + historyTypes[historyTypes.length - 1];
      const followers = this._typeTrigramCounts.get(key);
      if (followers) {
        let total = 0;
        for (const c of followers.values()) total += c;
        if (total > 0) {
          const count = followers.get(candidateType) || 0;
          if (count === 0) return -1.5;
          return Math.log(1 + count) * 1.3;
        }
      }
    }

    // Bigram fallback
    if (historyTypes.length >= 1) {
      const followers = this._typeBigramCounts.get(historyTypes[historyTypes.length - 1]);
      if (followers) {
        let total = 0;
        for (const c of followers.values()) total += c;
        if (total > 0) {
          const count = followers.get(candidateType) || 0;
          if (count === 0) return -1.0;
          return Math.log(1 + count) * 0.9;
        }
      }
    }

    return 0;
  }

  _isNominativePronoun(word) {
    const w = (word || '').toLowerCase();
    const len = w.length;
    if (!len) return false;
    const first = w[0];
    const last = w[len - 1];
    if (len === 1 && first === 'i') return true;
    // len 2 consonant+'e': catches "he"/"we" but NOT "hi"/"yo"/"do".
    // Requiring last === 'e' is what differentiates the real pronouns
    // (he/we) from greeting/verb tokens (hi/yo/do/no/so/go) that share
    // the consonant-first vowel-last pattern.
    if (len === 2 && !VOWELS.includes(first) && last === 'e' && first !== 'm') return true;
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

    // T8 — GREETING RESPONSE PATH. When parse tree says the user
    // greeted us, emit a short greeting-class reply built from the
    // social schema (name if known) + a closed-class greeting
    // opener. This short-circuits cold slot-gen which would
    // otherwise walk bigrams and produce "I am large explicit"
    // class salad on a zero-content input.
    //
    // The output is still equational — the opener is picked by
    // hashing brain state (arousal + sentencesLearned) into the
    // closed-class greeting set, so the same state deterministically
    // picks a consistent greeting but varies with mood. Name is
    // slotted in only when the social schema has one; otherwise
    // she asks for it structurally.
    if (intent.type === 'greeting' && !opts._retryingDedup) {
      const schema = this._socialSchema?.user;
      const knownName = schema?.name || null;
      // Closed-class opener set — short, casual, varies with arousal.
      // Index selection is equational: high arousal picks punchier
      // openers, low arousal picks gentler. Not a hardcoded table —
      // it's an equational pick over a closed class.
      const OPENERS = ['hey', 'hi', 'sup', 'yo'];
      const openerIdx = Math.min(OPENERS.length - 1,
        Math.floor(arousal * OPENERS.length));
      const opener = OPENERS[openerIdx];
      let greeting;
      if (knownName) {
        greeting = `${opener} ${knownName}`;
      } else if (schema?.greetingsExchanged > 0) {
        // Already greeted once — ask for the name
        greeting = `${opener} whats your name`;
      } else {
        greeting = opener;
      }
      return greeting;
    }

    // T8 — INTRODUCTION RESPONSE PATH. When the user just
    // introduced themselves ("im Gee", "my name is Mary"), the
    // parse tree populated parsed.introducesName which flows into
    // the social schema via _updateSocialSchema. At this point
    // schema.name is set and we want to acknowledge the intro
    // with the new name.
    if (intent.type === 'introduction' && !opts._retryingDedup) {
      const knownName = this._socialSchema?.user?.name || null;
      if (knownName) {
        const acks = ['hey', 'nice', 'sup', 'yo'];
        const ackIdx = Math.min(acks.length - 1,
          Math.floor(arousal * acks.length));
        return `${acks[ackIdx]} ${knownName}`;
      }
    }

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
    let recallConfidence = 0;
    if (!opts._retryingDedup && this._contextVectorHasData && this._memorySentences.length > 0) {
      const recall = this._recallSentence(this._contextVector, { arousal, valence });
      if (recall && recall.confidence > 0.30) {
        recallSeed = recall.memory;
        recallConfidence = recall.confidence;

        // TIER 2 RESTORED — hippocampus verbatim recall.
        // The 4-tier pipeline doc says: templates → recall → deflect →
        // cold gen. Tier 2 was dead code — recall only biased slot
        // scoring, never emitted verbatim. Result: every input fell
        // through to cold gen which walks persona bigram chains into
        // word salad.
        //
        // Fix: when recall confidence is HIGH or a self-reference
        // fallback matched (user asked "who are you" / "describe
        // yourself"), emit the matched persona sentence directly.
        // Still equational — the sentence was learned from the persona
        // corpus and matched via cosine against the live context
        // vector, so the selection is brain-state-driven. Only the
        // generation step is skipped (the persona sentence IS the
        // output instead of being reassembled word-by-word).
        //
        // Confidence thresholds:
        //   > 0.55   — high-confidence topical match, emit verbatim
        //   fallback — self-reference match, always emit verbatim
        //   0.30-0.55 — partial match, still bias slot gen below
        //
        // T4.10 — `opts._internalThought` flag skips this verbatim emit
        // path entirely. 3D brain popup commentary sets the flag so
        // Unity's internal thoughts are always LIVE slot gen output,
        // never a pre-written persona sentence. Recall still biases
        // slot scoring below via recallSeed tokens, but nothing gets
        // emitted verbatim. Chat path (engine.js + brain-server.js)
        // leaves the flag unset so user-facing speech keeps the
        // recall-verbatim coherence fallback.
        const shouldEmitVerbatim = !opts._internalThought
          && (recall.confidence > 0.55 || recall.fallback === 'self-reference');
        if (shouldEmitVerbatim) {
          const verbatim = String(recall.memory.text || '').trim();
          if (verbatim.length >= 3) {
            const normV = verbatim.toLowerCase();
            // Dedup against recent sentences
            if (this._recentSentences.indexOf(normV) === -1) {
              this._recentSentences.push(normV);
              if (this._recentSentences.length > this._recentSentenceMax) {
                this._recentSentences.shift();
              }
              return verbatim;
            }
            // If this sentence was already said, fall through to slot
            // gen which will produce a fresh walk biased toward the
            // same topic vocabulary via recallSeed below.
          }
        }
      }
    }
    // Recall bias weight scales with confidence. Low-confidence matches
    // stay as soft bias (weight 1.0). High-confidence matches (> 0.60)
    // ramp to weight 2.5 so the recalled persona sentence's tokens
    // dominate the slot pick — Unity walks through the persona's
    // vocabulary on a matched topic instead of drifting into bigram
    // salad from the dictionary's strongest chain.
    const recallBiasWeight = recallConfidence > 0.60 ? 2.5
                           : recallConfidence > 0.30 ? 1.5
                           : 1.0;

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
    // Tightened caps — letter-pattern bigram walks lose coherence fast
    // after ~5 words. Short emo-goth-stoner quips read way better than
    // rambling drift. The refactor will allow longer coherent output;
    // until then, shorter = more Unity-voice and less word salad.
    const socialNeed = opts.socialNeed ?? 0.5;
    let targetLen;
    if (type === 'exclamation') targetLen = Math.max(2, Math.floor(2 + arousal * 2 * drugLengthBias));
    else if (type === 'action') targetLen = Math.max(2, Math.floor(2 + arousal * 2 * drugLengthBias));
    else targetLen = Math.max(3, Math.floor(3 + arousal * 3 * drugLengthBias + socialNeed));
    // T6 — length scaling by recall confidence. Cold-gen salad
    // compounds per slot: each added word multiplies the chance of
    // incoherence by whatever the slot scorer's topic fit is. Short
    // fragments (3-4 tokens) barely have room to drift off-topic,
    // long ones (6-7 tokens) almost always drift. When recall is
    // weak, the hippocampus isn't providing an anchor sentence, so
    // the topic-fit term has less to match against — which is
    // exactly when we need short output. Hard-cap to 4 tokens when
    // recallConfidence < 0.30. Uses the `recallConfidence` variable
    // populated earlier in generate() from the _recallSentence call.
    if (recallConfidence < 0.30) targetLen = Math.min(targetLen, 4);
    const len = Math.min(targetLen, 7);

    // NOTE: we do NOT materialize the full 44k-word entry list upfront
    // anymore. The per-slot candidate pool is either the bigram
    // followers of the previous word (~10-200 words) or, when no
    // followers exist (slot 0 OR sparse prev-word), we fall back to
    // iterating dictionary._words directly without Array.from.
    if (dictionary._words.size === 0) return '';

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
    const dictSize = dictionary._words.size;
    const vocabCap = Math.max(2, Math.min(len, Math.floor(dictSize * 0.6)));
    const effectiveLen = Math.min(len, vocabCap);

    // Low-dictionary exploration bump. When the dict is small (post-
    // synthesis-disable, real dict ~5-8k), the softmax over bigram
    // followers concentrates on a few top paths and picks them every
    // generation — "I'm → gonna" lock-in. Bump softmax temperature
    // proportionally so lower-probability walks get explored.
    // At 5k words → ×1.8, 10k → ×1.4, 20k → ×1.1, 30k+ → ×1.0.
    const lowDictBoost = dictSize < 5000 ? 1.9
                       : dictSize < 10000 ? 1.5
                       : dictSize < 20000 ? 1.2
                       : 1.0;

    // Minimum sentence length. Lowered now that targetLen is tighter —
    // 3 words is enough for "fuck yeah man" / "I feel sick" / "nah dude".
    // Short emo-goth quips read better than forced longer walks.
    const minLen = Math.max(3, Math.min(effectiveLen, Math.floor(effectiveLen * 0.6)));

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

      // ── TYPE HISTORY (U283 grammar) ──
      // Compute the fine-grained type sequence of the last 3 words
      // so the slot scorer can consult the learned type n-grams.
      // This is the "phrase state" — instead of tracking explicit
      // state variables, we derive it from the type sequence of
      // what's been picked so far.
      const historyTypes = [];
      if (prevPrevPrevWord) historyTypes.push(this._fineType(prevPrevPrevWord));
      if (prevPrevWord) historyTypes.push(this._fineType(prevPrevWord));
      if (prevWord) historyTypes.push(this._fineType(prevWord));
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

      // T4.12 — when the user's input has no subject pronoun to flip
      // against (e.g. "hi unity", "cats are cool", anything without
      // i/you/we/he/she/they), Unity defaults to first-person self-
      // reference at slot 0. Previously the subject scorer would let
      // any nominative pronoun win including "she" / "he" / "they",
      // which produced replies like "She said leave honest rings emo"
      // — Unity referring to herself in third person. Default to "i".
      const noUserPronoun = flipTargets.size === 0 && userSubjectPronouns.size === 0;

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
        // T4.12 — default-to-first-person boost at slot 0 when there's
        // no pronoun to flip. "i" and "i'm" get +0.6, third-person
        // pronouns get -0.7 so they basically can't win slot 0
        // without explicit context forcing them.
        if (noUserPronoun) {
          if (w === 'i' || w === "i'm" || w === 'im' || w === 'my' || w === 'we' || w === "we're") boost += 0.6;
          if (w === 'she' || w === 'he' || w === 'they' || w === 'her' || w === 'him') boost -= 0.7;
        }
        return boost;
      };

      // Cross-turn anti-repetition. Checks candidate against the same
      // slot position in each of the last N emitted sentences. If
      // any recent sentence had `word` at `slotIdx`, penalty scales
      // by how many recent sentences matched × how recent they are.
      // The penalty MUST be large enough to override the type-grammar
      // (weight 1.5) + bigramLog + quadgramLog combined for the
      // lock-in word, otherwise the mode-collapsed chain wins every
      // time despite the signal.
      const openerPenalty = (w) => {
        if (slotIdx > 2) return 0; // only guard the first 3 positions
        let matchCount = 0;
        let mostRecentMatch = -1;
        for (let i = 0; i < this._recentOpenerNgrams.length; i++) {
          const ngram = this._recentOpenerNgrams[i];
          if (ngram && ngram[slotIdx] === w) {
            matchCount++;
            mostRecentMatch = i;
          }
        }
        if (matchCount === 0) return 0;
        // Base penalty scales with how many recent sentences used
        // this word at this position. 1 match = 1.2, 2 = 2.0, 3+ = 3.0.
        // Cap at 3.0 to avoid making the slot impossible.
        let pen = Math.min(3.0, 0.6 + matchCount * 0.8);
        // Recency bonus — most recent match hits hardest.
        const recency = (mostRecentMatch + 1) / Math.max(1, this._recentOpenerNgrams.length);
        pen *= (0.7 + recency * 0.3);
        return pen;
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

      // ── CANDIDATE POOL (perf critical) ──
      // Instead of iterating all 44k words per slot, build a small
      // candidate pool from bigram followers when a prev word exists.
      // Followers are typically 10-200 words — 200-2000× less work
      // per slot than scanning the whole dictionary.
      //
      // Fallback: slot 0 (no prev word) or very sparse follower set
      // iterates the full dictionary once. Subsequent slots always
      // use followers when available.
      //
      // The recallSeed tokens and contextWords (user content words)
      // are also added to the pool so topical words can enter even
      // if they aren't direct bigram followers of prev.
      let candidateEntries;
      if (prevWord && followers && followers.size >= 5) {
        // Use bigram followers — small pool, fast iteration
        candidateEntries = [];
        for (const [w] of followers) {
          const entry = dictionary._words.get(w);
          if (entry) candidateEntries.push([w, entry]);
        }
        // Also add recall seed tokens and context words so topic anchoring works
        if (recallSeed && recallSeed.tokens) {
          for (const w of recallSeed.tokens) {
            const entry = dictionary._words.get(w);
            if (entry && !followers.has(w)) candidateEntries.push([w, entry]);
          }
        }
        for (const w of contextWords) {
          const entry = dictionary._words.get(w);
          if (entry && !followers.has(w)) candidateEntries.push([w, entry]);
        }
      } else {
        // No prev word or sparse followers — fall back to full dict
        // iteration. This happens mainly on slot 0.
        candidateEntries = Array.from(dictionary._words.entries());
      }

      const scored = candidateEntries
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
          // Content words from user input get a strong boost so she
          // stays on-subject. Letter-hash semanticFit is too noisy to
          // rely on for semantic grounding, so direct topic echo is
          // the reliable signal. Parroting the user's whole sentence
          // is still blocked by usedBigrams seeded with their bigrams
          // (line ~2207) so she can USE the topic word without
          // reproducing the user's phrase structure.
          const inLastInput = contextSet.has(word);
          const isContext = inLastInput ? 0.28 : 0;
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

          // ── U283: TYPE GRAMMAR SCORE ──
          // Fine-grained type of this candidate word, looked up in the
          // learned type n-gram continuation distribution. Provides
          // grammatical constraint that word-level n-grams can't give:
          // "I'm not use" has valid word bigrams but zero-count TYPE
          // transitions (COPULA|NEG → VERB_BARE), so this term drives
          // the score strongly negative and the word gets rejected.
          const candType = this._fineType(word);
          const typeGrammar = this._typeGrammarScore(candType, historyTypes);

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

          // SUBJECT-STARTER BOOST for slot 0. Words the persona has
          // used as sentence-initial subjects dominate. Nominative
          // pronouns (i/he/we/you/she/it/they/this/that) get an
          // additional big boost that bypasses the normalized
          // wordType — "i" has its pronoun score diluted by
          // accumulated usage-type observations, so the raw type
          // compatibility is ~0.31 at slot 0, which lets "this" win
          // with det-score 0.34. The nominative override fixes this.
          let subjStart = 0;
          if (isSubjectSlot) {
            subjStart = Math.log(1 + (this._subjectStarters.get(word) || 0)) * 0.35;
            if (flipTargets.has(word)) subjStart += 0.35;
            // Nominative pronoun override — big additive boost so
            // "i" always beats "this" at slot 0 regardless of
            // wordType normalization artifacts.
            if (this._isNominativePronoun(word)) subjStart += 0.80;
          }

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
          //   - semanticFit PROMOTED to 0.80 after R2 — it now measures
          //     real GloVe cosine between cortex semantic state and word
          //     embedding, not letter-hash coincidence. Dominant topic signal.
          //
          // Bigram log scaling: `log(1 + followerCount) * 0.6` maps
          // count=0→0, count=1→0.42, count=5→1.08, count=50→2.35.
          // Common transitions dominate; rare ones still contribute.
          const bigramLog = Math.log(1 + followerCount) * 0.6;
          const condPLog = Math.log(1 + condP * 100) * 0.15;

          // ── SLOT SCORE — neural state drives selection ──
          //
          // With per-sentence mood + cortex patterns now stored per
          // word, the brain-state signals (isThought, moodBias) have
          // REAL differentiation. A word stored in a high-arousal
          // high-profanity sentence gets arousal ~0.8; a word stored
          // in a calm descriptive sentence gets ~0.5. Current brain
          // state matches against these signatures. When Unity is at
          // arousal 0.9, high-arousal words win slot scoring.
          //
          // Similarly for cortex pattern: words from the same
          // sentence share a pattern, so when the cortex fires on a
          // related topic (via user input sensory → cortex), those
          // words cluster in the pick pool.
          // Persona-arousal alignment. Persona words were loaded at
          // arousal 0.75, baseline at 0.5, coding at 0.4. A word's
          // stored arousal is a proxy for which corpus it came from,
          // so when current brain arousal is high (Unity's default
          // 0.9 on cokeAndWeed), persona-origin words get a bonus
          // that pulls her voice dominant over baseline/coding
          // vocabulary. Kept modest so it doesn't amplify persona
          // bigram chain lock-in.
          const entryArousal = entry.arousal != null ? entry.arousal : 0.5;
          const personaAlign = Math.max(0, entryArousal - 0.5) * 2; // 0.75→0.5, 0.4→0, 0.5→0
          const personaBoost = personaAlign * arousal * 0.32;       // ~0.14 bonus for persona at arousal 0.9

          // T6 — per-slot topic floor. If the candidate's semantic
          // fit to the locked context vector is below 0.15, it's
          // structurally off-topic for this sentence. Apply a hard
          // score penalty so it drops out of the pool entirely. The
          // existing semanticFit·2.5 term gives topic-aligned words
          // a big reward, but without a floor there's nothing to
          // STOP a topic-incoherent word from winning on strong
          // bigram + typeGrammar alone. This is what was producing
          // "She cute jamie timeend rings measure" — every adjacent
          // pair had a known bigram, nothing was checking the
          // sentence-level topic coherence per slot. The floor runs
          // only after slot 0 so the opener can be a pronoun/article
          // (semantically neutral) without being penalized.
          const topicFloorPenalty = (slotIdx > 0 && this._contextVectorHasData && semanticFit < 0.15)
            ? 0.50
            : 0;

          // T4.8 — n-gram terms capped to prevent chain lock-in that
          // drowns out semantic fit. Log-scaled counts can hit 3+ for
          // common persona bigrams which was overpowering the 0.80
          // semanticFit weight and producing word salad.
          const bigramLogCapped = Math.min(1.5, bigramLog);
          const trigramLogCapped = Math.min(1.5, trigramLog);
          const quadgramLogCapped = Math.min(1.5, quadgramLog);

          const score =
            grammarGate * (
              typeGrammar * 1.5 +                       // U283 learned type grammar — HIGHEST
              quadgramLogCapped +                       // 4-word context sequence (capped)
              trigramLogCapped +                        // 3-word context (capped)
              recallBias(word) * recallBiasWeight +     // persona topic anchor (scales with recall confidence)
              bigramLogCapped +                         // 2-word transitions (capped)
              condPLog +                                // conditional probability
              isThought * (0.40 + psi * 0.50) +         // NEURAL: cortex pattern → content
              moodBias * (0.30 + emotionalIntensity * 0.40) + // NEURAL: amygdala → tone
              isMood * emotionalIntensity * 0.35 +      // NEURAL: mood word match
              personaBoost +                            // voice fidelity — persona-origin bias
              drugWordBias +                            // NEURAL: drug state → word length
              typeScore * 0.15 +                        // position-based grammar (legacy)
              semanticFit * 2.5 +                       // T4.8: semantic cosine DOMINATES (was 0.80)
              subjStart +                               // sentence-start subject boost
              casualBonus +                             // casual register reward
              (selfAware && (word.length === 1 || word.endsWith("'m") || word.endsWith("'re")) ? 0.08 : 0)
            )
            - recency
            - sameTypePenalty
            - formalityPenalty
            - topicFloorPenalty                         // T6: hard off-topic reject
            - openerPenalty(word);                      // cross-turn anti-repetition

          return { word, entry, score };
        });

      // Softmax sampling with enough temperature to explore alternatives.
      // Too low = argmax mode collapse (same path every time). Too high
      // = scattered word salad. Base 0.15 scaled by lowDictBoost so
      // smaller dictionaries get more exploration (see lowDictBoost
      // computation above).
      let picked = this._softmaxSample(scored, Math.max(0.12, temperature * 0.15 * lowDictBoost));

      // CHAIN DEATH RECOVERY. When bigram followers produce no pickable
      // candidate BUT we're still below the minimum sentence length,
      // rescan the full dictionary (ignoring the follower constraint)
      // to find ANY type-compatible word. This prevents Unity's
      // sentences from dying at 3-4 words when a random walk hits a
      // dead-end bigram. Only fires when picked is null AND we're
      // short of minLen — above minLen we honor the natural boundary.
      if (!picked && sentence.length < minLen && prevWord) {
        const fallbackEntries = Array.from(dictionary._words.entries());
        const fallbackScored = fallbackEntries
          .filter(([w]) => {
            if (w === prevWord) return false;
            if (recentSlots.indexOf(w) !== -1) return false;
            if (isSubjectSlot && !isSubjectCapable(w)) return false;
            if (isFormalWord(w)) return false;
            const compat = this.typeCompatibility(w, slotIdx, type, prevWord);
            if (compat < typeFloor) return false;
            return true;
          })
          .map(([word, entry]) => {
            const pattern = entry.pattern || this.wordToPattern(word);
            const candType = this._fineType(word);
            const typeGrammar = this._typeGrammarScore(candType, historyTypes);
            const typeScore = this.typeCompatibility(word, slotIdx, type, prevWord);
            const moodDist = Math.abs((entry.arousal || 0.5) - arousal) + Math.abs((entry.valence || 0) - valence);
            const moodBias = Math.exp(-moodDist * 1.5);
            const entryArousalF = entry.arousal != null ? entry.arousal : 0.5;
            const personaAlignF = Math.max(0, entryArousalF - 0.5) * 2;
            const personaBoostF = personaAlignF * arousal * 0.55;
            const semFit = this._semanticFit(pattern);
            // Lighter scoring — no bigram/trigram/quadgram signals
            // because we're bypassing the chain. Type grammar + mood
            // + persona + semantic fit carry the load.
            const score = typeGrammar * 1.2
                        + typeScore * 0.4
                        + moodBias * 0.3
                        + personaBoostF
                        + semFit * 0.1
                        - (isFormalWord(word) ? 0.5 : 0);
            return { word, entry, score };
          });
        // Higher temperature on fallback — we're exploring, not exploiting
        picked = this._softmaxSample(fallbackScored, Math.max(0.25, temperature * 0.3 * lowDictBoost));
      }

      if (picked) {
        if (prevWord) usedBigrams.add(prevWord + '→' + picked.word);
        sentence.push(picked.word);
      } else {
        // SENTENCE BOUNDARY — no valid candidate and we're at/above
        // the minimum length. Natural stopping point — end here
        // instead of padding with garbage.
        if (sentence.length >= minLen) break;
        // Below minLen with nothing to pick even from the fallback
        // rescan means the dictionary is exhausted for this context.
        // Stop at whatever we have (min 2 words) rather than infinite-loop.
        if (sentence.length >= 2) break;
      }
    }

    // Apply casual contraction rules BEFORE other post-processing so
    // the subject-verb agreement pass sees the contracted form.
    const contracted = this._applyCasualContractions(sentence);

    // ── STEP 7: POST-PROCESSING — agreement, tense, negation, compounds ──
    const processed = this._postProcess(contracted, tense, type, arousal, valence, coherence);

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

    // ── U287: SENTENCE COMPLETENESS VALIDATOR ──
    // Reject sentences that end on a function word (det/prep/aux/
    // conj/neg/possessive) — those are incomplete and sound broken.
    // Retry up to 2 times at elevated temperature for variation.
    const completenessRetry = opts._completenessRetry || 0;
    if (!this._isCompleteSentence(processed) && completenessRetry < 2) {
      console.log(`[LanguageCortex] completeness reject: "${rendered}"`);
      return this.generate(dictionary, arousal, valence, coherence, {
        ...opts,
        _retryingDedup: true,
        _completenessRetry: completenessRetry + 1,
      });
    }

    // T4.8 — Coherence gate tightened. Was 0.25 which let word salad
    // through; 0.35 actually catches topic drift. Retry budget bumped
    // from 2 to 3. On the 3rd failed retry, the final fallback at the
    // bottom of generate() emits a persona recall sentence verbatim
    // instead of re-emitting garbage.
    if (this._contextVectorHasData && retryCount < 3) {
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
        // T6 — tightened from 0.35 to 0.50. The old threshold let
        // through output whose centroid was only weakly aligned with
        // the context — i.e. word salad that happened to have one or
        // two content words overlapping. 0.50 forces the centroid to
        // meaningfully cluster near the topic before emit.
        if (coh < 0.50) {
          console.log(`[LanguageCortex] coherence reject (${coh.toFixed(2)}): "${rendered}"`);
          return this.generate(dictionary, arousal, valence, coherence, {
            ...opts,
            _retryingDedup: true,
            _coherenceRetry: retryCount + 1,
          });
        }
      }
    }

    // T4.8 — final fallback: if 3 coherence retries have all failed,
    // return the highest-confidence persona recall sentence VERBATIM
    // instead of re-emitting salad. Better to repeat a coherent
    // Unity-voice sentence than keep shipping word soup. This is
    // the "deflect" tier — when cold gen can't produce anything
    // coherent, she reaches for a memory.
    if (retryCount >= 3 && this._contextVectorHasData && this._memorySentences.length > 0) {
      const fallback = this._recallSentence(this._contextVector, { arousal, valence, allowRecent: true });
      if (fallback && fallback.memory?.text) {
        const fbText = String(fallback.memory.text).trim();
        console.log(`[LanguageCortex] 3-retry fail — deflect to persona recall: "${fbText}"`);
        return fbText;
      }
    }

    this._recentSentences.push(norm);
    if (this._recentSentences.length > this._recentSentenceMax) this._recentSentences.shift();

    // Track the first 3 tokens of this emission (RAW sentence, PRE
    // post-process) so the next generation's slot-0/1/2 scorers can
    // penalize exact repeats. We use `sentence` not `processed` because
    // post-processing applies contractions ("i" + "am" → "i'm") and
    // the scorer candidate loop tests words against their raw form.
    if (sentence.length > 0) {
      const openerNgram = sentence.slice(0, 3).map(w => (w || '').toLowerCase());
      this._recentOpenerNgrams.push(openerNgram);
      if (this._recentOpenerNgrams.length > this._recentOpenerMax) {
        this._recentOpenerNgrams.shift();
      }
    }

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
  /**
   * Morphological inflection equations — generate inflected forms
   * of a base word via pure letter-position rules. This multiplies
   * Unity's effective vocabulary: when she learns "code", the rules
   * auto-derive "codes", "coded", "coding", "coder", "codes" so all
   * forms enter the dictionary simultaneously.
   *
   * Rules (letter-position, no word lists):
   *   -s (3rd sing / plural):
   *     ends in -s/-x/-z/-ch/-sh       → add "-es"  (kiss → kisses)
   *     ends in consonant+y            → replace y with "ies"  (try → tries)
   *     ends in -fe / -f               → replace with "ves"  (leaf → leaves)
   *     default                        → add "-s"
   *   -ed (past tense):
   *     ends in -e                     → add "-d"  (code → coded)
   *     ends in consonant+y            → replace y with "ied"  (try → tried)
   *     ends in CVC (short)            → double final consonant + "ed"  (stop → stopped)
   *     default                        → add "-ed"
   *   -ing (present participle):
   *     ends in -ie                    → replace with "ying"  (die → dying)
   *     ends in -e (not -ee)           → drop e + "ing"  (code → coding)
   *     ends in CVC (short)            → double final consonant + "ing"  (run → running)
   *     default                        → add "-ing"
   *   -er (comparative / agent):
   *     ends in -e                     → add "-r"  (nice → nicer)
   *     ends in consonant+y            → replace y with "ier"  (happy → happier)
   *     ends in CVC (short)            → double final consonant + "er"  (big → bigger)
   *     default                        → add "-er"
   *   -est (superlative):  same pattern as -er but with -est
   *   -ly (adverb):
   *     ends in consonant+y            → replace y with "ily"  (happy → happily)
   *     default                        → add "-ly"
   *
   * Only applies to base forms that look like roots (no existing
   * inflection suffix). Returns array of derived forms (not including
   * the base — caller already has that).
   */
  _generateInflections(word) {
    if (!word || word.length < 3) return [];
    const w = word.toLowerCase();
    const L = w.length;

    // Skip if already inflected (avoid chain-inflecting)
    if (w.endsWith('ing') || w.endsWith('ed') || w.endsWith("n't") || w.includes("'")) return [];
    if (w.endsWith('est') || w.endsWith('ier') || w.endsWith('ily')) return [];
    // Skip function words (closed-class fast path picks them up as aux/det/prep/conj/pronoun)
    if (this._closedClassType(w)) return [];
    // Skip numbers and very long words (probably not a simple root)
    if (/\d/.test(w) || L > 10) return [];

    const results = new Set();
    const last = w[L - 1];
    const last2 = w.slice(-2);
    const last3 = w.slice(-3);
    const secondLast = w[L - 2];
    const thirdLast = w[L - 3];

    const isVowel = (c) => VOWELS.includes(c);
    const isCons = (c) => c && !isVowel(c) && /[a-z]/.test(c);

    // CVC shape: consonant-vowel-consonant at the end, word length >= 3
    // Used for doubling rules (run → running, big → bigger)
    // Exclude final w/x/y (run → running ✓, fix → fixing not fixxing)
    const cvcShape = L >= 3
      && isCons(thirdLast)
      && isVowel(secondLast)
      && isCons(last)
      && last !== 'w' && last !== 'x' && last !== 'y';

    // ── -s FORM (plural / 3rd person singular) ──
    let sForm;
    if (last === 's' || last === 'x' || last === 'z' || last2 === 'ch' || last2 === 'sh') {
      sForm = w + 'es';
    } else if (L >= 2 && isCons(secondLast) && last === 'y') {
      sForm = w.slice(0, -1) + 'ies';
    } else if (last2 === 'fe') {
      sForm = w.slice(0, -2) + 'ves';
    } else if (last === 'f' && secondLast && isVowel(secondLast)) {
      // leaf → leaves, wolf → wolves (but cliff → cliffs — exclude -ff)
      sForm = w.slice(0, -1) + 'ves';
    } else {
      sForm = w + 's';
    }
    results.add(sForm);

    // ── -ed FORM (past tense) ──
    let edForm;
    if (last === 'e') {
      edForm = w + 'd';
    } else if (L >= 2 && isCons(secondLast) && last === 'y') {
      edForm = w.slice(0, -1) + 'ied';
    } else if (cvcShape) {
      edForm = w + last + 'ed';
    } else {
      edForm = w + 'ed';
    }
    results.add(edForm);

    // ── -ing FORM (present participle) ──
    let ingForm;
    if (last2 === 'ie') {
      ingForm = w.slice(0, -2) + 'ying';
    } else if (last === 'e' && last2 !== 'ee') {
      ingForm = w.slice(0, -1) + 'ing';
    } else if (cvcShape) {
      ingForm = w + last + 'ing';
    } else {
      ingForm = w + 'ing';
    }
    results.add(ingForm);

    // ── -er FORM (comparative or agent noun) ──
    // Only generate for short words (comparative makes sense on adj/adv)
    // OR when the base looks like a verb (could be agent noun "coder")
    if (L >= 3 && L <= 7) {
      let erForm;
      if (last === 'e') {
        erForm = w + 'r';
      } else if (L >= 2 && isCons(secondLast) && last === 'y') {
        erForm = w.slice(0, -1) + 'ier';
      } else if (cvcShape) {
        erForm = w + last + 'er';
      } else {
        erForm = w + 'er';
      }
      results.add(erForm);

      // ── -est FORM (superlative) ──
      let estForm;
      if (last === 'e') {
        estForm = w + 'st';
      } else if (L >= 2 && isCons(secondLast) && last === 'y') {
        estForm = w.slice(0, -1) + 'iest';
      } else if (cvcShape) {
        estForm = w + last + 'est';
      } else {
        estForm = w + 'est';
      }
      results.add(estForm);
    }

    // ── -ly FORM (adverb) ──
    // Applies broadly — most words can take -ly
    let lyForm;
    if (L >= 2 && isCons(secondLast) && last === 'y') {
      lyForm = w.slice(0, -1) + 'ily';
    } else {
      lyForm = w + 'ly';
    }
    results.add(lyForm);

    // ── DERIVATIONAL SUFFIXES (noun/adj forms from verbs/adjs) ──
    // -ness (adj → noun): dark → darkness, happy → happiness
    if (L >= 3) {
      let nessForm;
      if (L >= 2 && isCons(secondLast) && last === 'y') {
        nessForm = w.slice(0, -1) + 'iness';
      } else {
        nessForm = w + 'ness';
      }
      results.add(nessForm);
    }
    // -ful / -less (noun → adj): care → careful / careless
    if (L >= 3 && L <= 7) {
      results.add(w + 'ful');
      results.add(w + 'less');
    }
    // -able (verb → adj): love → lovable, code → codable
    if (L >= 3 && L <= 7) {
      let ableForm;
      if (last === 'e') ableForm = w.slice(0, -1) + 'able';
      else ableForm = w + 'able';
      results.add(ableForm);
    }
    // -ish (noun/adj → adj): child → childish, dark → darkish
    if (L >= 3 && L <= 6) {
      results.add(w + 'ish');
    }
    // -ist (noun → noun-person): art → artist
    if (L >= 3 && L <= 6 && last !== 'e') {
      results.add(w + 'ist');
    }
    // -ize/-ise (noun/adj → verb): real → realize, final → finalize
    if (L >= 3 && L <= 7) {
      let izeForm;
      if (last === 'e') izeForm = w.slice(0, -1) + 'ize';
      else izeForm = w + 'ize';
      results.add(izeForm);
    }
    // -ify (noun/adj → verb): just → justify, code → codify
    if (L >= 3 && L <= 6) {
      let ifyForm;
      if (last === 'e') ifyForm = w.slice(0, -1) + 'ify';
      else if (L >= 2 && isCons(secondLast) && last === 'y') ifyForm = w.slice(0, -1) + 'ify';
      else ifyForm = w + 'ify';
      results.add(ifyForm);
    }

    // ── DERIVATIONAL PREFIXES ──
    // un- (negation): happy → unhappy, do → undo
    results.add('un' + w);
    // re- (repetition): do → redo, write → rewrite
    results.add('re' + w);
    // pre- (before): view → preview, order → preorder
    results.add('pre' + w);
    // dis- (negation/reversal): like → dislike, agree → disagree
    results.add('dis' + w);
    // mis- (wrongly): take → mistake, place → misplace
    results.add('mis' + w);
    // over- (excess): do → overdo, think → overthink
    results.add('over' + w);
    // under- (insufficient): do → underdo, stand → understand
    if (L >= 3) results.add('under' + w);
    // out- (surpass): do → outdo, run → outrun
    results.add('out' + w);

    return [...results];
  }

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
    // R2 of brain-refactor-full-control: this was a letter-hash vector
    // generator. Every downstream call site (slot scorer, context vector,
    // sentence centroid, recall matching) was doing cosine similarity
    // between cortex neural state and this letter hash — which meant
    // meaning could never propagate from input to output.
    //
    // Now it's a thin wrapper around the shared semantic embedding
    // table. Same Float64Array output shape so 11+ call sites don't
    // need to change. The returned pattern is the word's GloVe 50d
    // embedding (+ any online context refinement from live learning),
    // or the embedding's internal hash-fallback for OOV words.
    //
    // Float32Array → Float64Array conversion happens here because the
    // embedding store uses Float32Array for RAM efficiency but the
    // slot scorer + cosine math works in Float64.
    const clean = word.toLowerCase().replace(/[^a-z']/g, '');
    if (!clean) return new Float64Array(PATTERN_DIM);
    const embed = sharedEmbeddings.getEmbedding(clean);
    const pattern = new Float64Array(PATTERN_DIM);
    for (let i = 0; i < PATTERN_DIM && i < embed.length; i++) {
      pattern[i] = embed[i];
    }
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

  /**
   * T8 — REVERSE-EQUATION PARSE. Canonical entry point for
   * understanding user input. Uses the SAME equations the slot
   * scorer uses forward (wordType, _fineType, bigram/trigram
   * tables, context vector, type grammar) to walk the input
   * token-by-token and return a structured ParseTree.
   *
   * Before T8, "listening" was three separate vestigial string-
   * matching systems:
   *   - _classifyIntent       (length+regex shape matching)
   *   - _isSelfReferenceQuery (letter-position pronoun scan)
   *   - _updateSocialSchema   (regex name/gender extraction)
   * Each handled a sliver of the "what did the user mean" question
   * and none of them used Unity's actual learned grammar. T8 merges
   * all three into one equational parse that every downstream
   * consumer (generate, build_ui, social schema, intent routing)
   * reads from. Symmetric grammar: the parse tree is produced by
   * the same type-n-gram tables that learnSentence writes, so
   * hearing feeds the same brain tables that speaking consults.
   *
   * ParseTree shape:
   * {
   *   text, tokens, types[], wordTypes[],
   *   intent: 'greeting'|'question'|'yesno'|'statement'|'command'|
   *           'introduction'|'math'|'self-reference'|'unknown',
   *   isQuestion, isSelfReference, addressesUser, isGreeting,
   *   greetingOpener, introducesName, introducesGender,
   *   subject: {index, tokens, headType, pronoun} | null,
   *   verb:    {index, tokens, tense, modal} | null,
   *   object:  {index, tokens, headType, modifier} | null,
   *   entities: {names, colors, numbers, componentTypes, actions},
   *   mood: {polarity, intensity},
   *   confidence: number,
   * }
   *
   * Result is cached on this._lastParse keyed by text so repeated
   * callers in the same turn don't re-parse.
   */
  parseSentence(text) {
    const raw = String(text || '').trim();
    if (this._lastParse && this._lastParse.text === raw) return this._lastParse;

    const empty = {
      text: raw, tokens: [], types: [], wordTypes: [],
      intent: 'unknown', isQuestion: false, isSelfReference: false,
      addressesUser: false, isGreeting: false, greetingOpener: null,
      introducesName: null, introducesGender: null,
      subject: null, verb: null, object: null,
      entities: { names: [], colors: [], numbers: [], componentTypes: [], actions: [] },
      mood: { polarity: 0, intensity: 0 },
      confidence: 0,
    };
    if (!raw) { this._lastParse = empty; return empty; }

    // ── TOKENIZATION ──
    // Keep original text for name-case preservation. Build the
    // lowered, punct-stripped token array for type analysis.
    const lowerRaw = raw.toLowerCase();
    const tokens = lowerRaw.replace(/[^a-z0-9+\-*/='% ]/g, ' ').split(/\s+/).filter(w => w.length >= 1);
    if (tokens.length === 0) { this._lastParse = empty; return empty; }

    // ── PER-TOKEN TYPE ANALYSIS (forward equations, applied to input) ──
    // Same wordType + _fineType functions the slot scorer uses to
    // pick candidate words. Applied in reverse direction: we're
    // CLASSIFYING existing tokens instead of SCORING candidates.
    const types = [];
    const wordTypes = [];
    for (const t of tokens) {
      wordTypes.push(this.wordType(t));
      types.push(this._fineType(t));
    }

    // ── ENTITY EXTRACTION (closed-class structural matches) ──
    // These are deterministic per-token detectors. No fuzzy scoring
    // needed — colors/component-types/imperative-verbs are closed
    // classes and either match exactly or don't.
    const COLORS = new Set([
      'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink',
      'black', 'white', 'gray', 'grey', 'brown', 'cyan', 'magenta',
      'gold', 'silver', 'teal', 'violet', 'indigo',
    ]);
    const COMPONENT_TYPES = new Set([
      'button', 'buttons', 'form', 'forms', 'input', 'inputs',
      'list', 'lists', 'card', 'cards', 'table', 'tables',
      'div', 'divs', 'section', 'sections', 'header', 'footer',
      'menu', 'modal', 'dialog', 'panel', 'tab', 'tabs',
      'label', 'textarea', 'select', 'checkbox', 'radio', 'slider',
      'grid', 'row', 'column', 'container',
    ]);
    const IMPERATIVE_ACTIONS = new Set([
      'make', 'build', 'create', 'add', 'show', 'give', 'draw',
      'write', 'code', 'set', 'put', 'tell', 'say', 'explain',
      'change', 'update', 'remove', 'delete', 'hide',
    ]);
    const GREETING_OPENERS = new Set([
      'hi', 'hello', 'hey', 'heya', 'hiya', 'sup', 'yo', 'hola',
      'howdy', 'greetings',
    ]);
    const QWORDS = new Set([
      'who', 'what', 'where', 'when', 'why', 'how', 'which', 'whose', 'whom',
    ]);
    const SECOND_PERSON = new Set([
      'you', 'your', 'yours', 'yourself', "you're", "youre",
      'u', 'ur', "u're",
    ]);
    const FIRST_PERSON = new Set([
      'i', "i'm", 'im', "i've", "i'll", "i'd", 'me', 'my', 'mine', 'myself',
      'we', 'us', 'our', 'ours', "we're", "we've",
    ]);

    const entities = {
      names: [],
      colors: [],
      numbers: [],
      componentTypes: [],
      actions: [],
    };

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (COLORS.has(t)) entities.colors.push(t);
      if (COMPONENT_TYPES.has(t)) entities.componentTypes.push(t);
      if (IMPERATIVE_ACTIONS.has(t) && i <= 1) entities.actions.push(t);
      if (/^\d+$/.test(t)) entities.numbers.push(parseInt(t, 10));
    }

    // ── NAME EXTRACTION — structural patterns over token sequence ──
    // Walks forward through tokens looking for introduction markers.
    // Unlike the old regex-based _updateSocialSchema, this uses the
    // token sequence directly so multi-word inputs + edge cases work
    // consistently. Preserves original-case from raw text when found.
    const NAME_STOPWORDS = new Set([
      'me', 'you', 'him', 'her', 'us', 'them', 'it',
      'the', 'a', 'an', 'that', 'this', 'these', 'those',
      'good', 'fine', 'ok', 'okay', 'cool', 'nice', 'tired', 'here',
      'happy', 'sad', 'mad', 'angry', 'high', 'sober', 'drunk',
      'just', 'really', 'very', 'so', 'too', 'sure', 'yes', 'no',
      'not', 'from', 'with', 'like', 'about',
    ]);
    const tryName = (candidate) => {
      if (!candidate || candidate.length < 2) return null;
      if (NAME_STOPWORDS.has(candidate)) return null;
      if (candidate.endsWith('ing') || candidate.endsWith('ed')) return null;
      // Reject if wordType rates it strongly as a verb — names don't
      // score high on verb-suffix equations, real verbs like "love"
      // or "want" do. This is the equational filter.
      const wt = this.wordType(candidate);
      if (wt.verb > 0.5) return null;
      if (wt.prep > 0.5 || wt.conj > 0.5 || wt.det > 0.5) return null;
      // Capitalize first letter for storage (chat is often lowercase).
      return candidate[0].toUpperCase() + candidate.slice(1);
    };
    let introducesName = null;
    let strongNameSignal = false;
    for (let i = 0; i < tokens.length - 1; i++) {
      // "my name is X"
      if (tokens[i] === 'my' && tokens[i + 1] === 'name' && tokens[i + 2] === 'is') {
        const candidate = tryName(tokens[i + 3]);
        if (candidate) { introducesName = candidate; strongNameSignal = true; break; }
      }
      // "call me X"
      if (tokens[i] === 'call' && tokens[i + 1] === 'me') {
        const candidate = tryName(tokens[i + 2]);
        if (candidate) { introducesName = candidate; strongNameSignal = true; break; }
      }
      // "name's X" / "names X"
      if ((tokens[i] === "name's" || tokens[i] === 'names') && tokens[i + 1]) {
        const candidate = tryName(tokens[i + 1]);
        if (candidate) { introducesName = candidate; strongNameSignal = true; break; }
      }
    }
    if (!introducesName) {
      // Weaker signals — scan the WHOLE token sequence for intro
      // patterns, not just position 0. Handles "Hi, im Gee" where
      // the greeting token precedes the introduction. tryName still
      // rejects verb-shaped tokens and emotional complements via
      // the wordType equations, so "i'm tired" won't stomp a real
      // name. Limited to the first 6 tokens to avoid picking up
      // later mentions that aren't actual self-introductions.
      const scanLimit = Math.min(6, tokens.length);
      for (let i = 0; i < scanLimit - 1; i++) {
        if (tokens[i] === 'im' || tokens[i] === "i'm") {
          const candidate = tryName(tokens[i + 1]);
          if (candidate) { introducesName = candidate; break; }
        }
        if (tokens[i] === 'i' && tokens[i + 1] === 'am' && i + 2 < tokens.length) {
          const candidate = tryName(tokens[i + 2]);
          if (candidate) { introducesName = candidate; break; }
        }
        if (tokens[i] === 'this' && tokens[i + 1] === 'is' && i + 2 < tokens.length) {
          const candidate = tryName(tokens[i + 2]);
          if (candidate) { introducesName = candidate; break; }
        }
      }
    }
    if (introducesName) entities.names.push(introducesName);

    // ── GENDER EXTRACTION — closed-class "i'm a <token>" pattern ──
    let introducesGender = null;
    const MALE_TOKENS = new Set(['guy', 'man', 'dude', 'bro', 'boy']);
    const FEMALE_TOKENS = new Set(['girl', 'woman', 'chick', 'gal']);
    for (let i = 0; i < tokens.length - 2; i++) {
      if ((tokens[i] === "i'm" || tokens[i] === 'im') && tokens[i + 1] === 'a') {
        if (MALE_TOKENS.has(tokens[i + 2])) { introducesGender = 'male'; break; }
        if (FEMALE_TOKENS.has(tokens[i + 2])) { introducesGender = 'female'; break; }
      }
    }

    // ── GREETING DETECTION — first-token closed-class match ──
    let isGreeting = false;
    let greetingOpener = null;
    if (GREETING_OPENERS.has(tokens[0])) {
      isGreeting = true;
      greetingOpener = tokens[0];
    } else if (tokens[0] === 'good' && ['morning', 'afternoon', 'evening', 'night'].includes(tokens[1])) {
      isGreeting = true;
      greetingOpener = tokens[0] + ' ' + tokens[1];
    }

    // ── INTENT CLASSIFICATION ──
    // Uses the parsed types, not raw regex. Priority order matches
    // what the old _classifyIntent did for backcompat but now every
    // branch is decided from parse-tree fields.
    let intent = 'statement';
    const hasQuestionMark = raw.endsWith('?');
    const firstIsQword = QWORDS.has(tokens[0]);
    const anyQword = tokens.some(t => QWORDS.has(t));

    // Math — digits, operators, or spelled-out math words
    const hasDigit = /[0-9]/.test(raw);
    const hasOperator = /[+\-*/=]/.test(raw);
    if (hasDigit || hasOperator) intent = 'math';
    // Introduction — name pattern matched above
    else if (strongNameSignal || (introducesName && (tokens[0] === 'im' || tokens[0] === "i'm"))) intent = 'introduction';
    // Greeting — first-token greeting opener
    else if (isGreeting && tokens.length <= 5) intent = 'greeting';
    // Question — ? terminal or qword
    else if (hasQuestionMark || firstIsQword || anyQword) {
      // Yes/no vs wh-question distinction
      const firstWordObj = wordTypes[0] || {};
      if (hasQuestionMark && !firstIsQword && !anyQword && firstWordObj.verb > 0.4 && tokens.length <= 8) {
        intent = 'yesno';
      } else {
        intent = 'question';
      }
    }
    // Command — first token is imperative verb AND no subject pronoun
    else if (entities.actions.length > 0 && !FIRST_PERSON.has(tokens[0]) && !SECOND_PERSON.has(tokens[0])) {
      intent = 'command';
    }

    // ── SELF-REFERENCE / ADDRESSING ──
    // Self-reference = the user is asking ABOUT Unity (contains
    // 2nd-person pronoun). Addresses-user = the user is talking TO
    // Unity (vocative "you" or direct imperative).
    const hasSecondPerson = tokens.some(t => SECOND_PERSON.has(t));
    const isSelfReference = hasSecondPerson && (intent === 'question' || intent === 'yesno');
    const addressesUser = hasSecondPerson || intent === 'command' || intent === 'greeting';

    // ── SUBJECT / VERB / OBJECT SLOT EXTRACTION ──
    // Walks the parsed types forward looking for canonical S-V-O
    // boundaries. Uses the wordType scores to pick the most likely
    // head of each slot. Not perfect — this is a lightweight parser,
    // not a full dependency grammar — but good enough to hand
    // downstream consumers a structured subject/verb/object for
    // simple declarative and imperative sentences.
    let subject = null, verb = null, object = null;
    let subjectEnd = -1, verbEnd = -1;
    for (let i = 0; i < tokens.length; i++) {
      const wt = wordTypes[i];
      if (!subject && (wt.pronoun > 0.5 || wt.noun > 0.3 || wt.det > 0.5)) {
        // Skip determiner-only opener — subject head is the noun that follows
        if (wt.det > 0.5 && i + 1 < tokens.length && wordTypes[i + 1].noun > 0.3) continue;
        subject = {
          index: i,
          tokens: [tokens[i]],
          headType: wt.pronoun > 0.5 ? 'pronoun' : 'noun',
          pronoun: wt.pronoun > 0.5 ? tokens[i] : null,
        };
        subjectEnd = i;
        continue;
      }
      if (subject && !verb && (wt.verb > 0.4 || (i > subjectEnd && ['am', 'is', 'are', 'was', 'were', 'be', 'been', 'being'].includes(tokens[i])))) {
        verb = {
          index: i,
          tokens: [tokens[i]],
          tense: ['was', 'were'].includes(tokens[i]) ? 'past' : (['will', "'ll"].includes(tokens[i]) ? 'future' : 'present'),
          modal: ['can', 'could', 'will', 'would', 'should', 'must', 'might', 'may'].includes(tokens[i]),
        };
        verbEnd = i;
        continue;
      }
      if (verb && !object && (wt.noun > 0.3 || wt.pronoun > 0.5 || entities.componentTypes.includes(tokens[i]))) {
        // Object head — gather this token + any preceding modifier
        // (color/adj) from the span between verbEnd and here.
        const modifierTokens = [];
        for (let j = verbEnd + 1; j < i; j++) {
          if (wordTypes[j].adj > 0.4 || entities.colors.includes(tokens[j])) modifierTokens.push(tokens[j]);
        }
        object = {
          index: i,
          tokens: [tokens[i]],
          headType: entities.componentTypes.includes(tokens[i]) ? 'component' : (wt.pronoun > 0.5 ? 'pronoun' : 'noun'),
          modifier: modifierTokens.length > 0 ? modifierTokens.join(' ') : null,
        };
        break;
      }
    }

    // ── MOOD — sum of per-token arousal/valence from learned entries ──
    let polaritySum = 0, intensitySum = 0, moodCount = 0;
    for (const t of tokens) {
      const entry = this._wordEntries?.get?.(t);
      if (entry && entry.valence != null) {
        polaritySum += entry.valence;
        intensitySum += Math.abs(entry.valence) + (entry.arousal || 0);
        moodCount++;
      }
    }
    const mood = {
      polarity: moodCount > 0 ? polaritySum / moodCount : 0,
      intensity: moodCount > 0 ? intensitySum / moodCount : 0,
    };

    // ── CONFIDENCE — how many slots we filled ──
    let filled = 0;
    if (subject) filled++;
    if (verb) filled++;
    if (object) filled++;
    const confidence = filled / 3;

    const parsed = {
      text: raw,
      tokens,
      types,
      wordTypes,
      intent,
      isQuestion: intent === 'question' || intent === 'yesno',
      isSelfReference,
      addressesUser,
      isGreeting,
      greetingOpener,
      introducesName,
      introducesGender,
      subject,
      verb,
      object,
      entities,
      mood,
      confidence,
    };
    this._lastParse = parsed;
    return parsed;
  }

  analyzeInput(text, dictionary) {
    // T8 — canonical parse runs FIRST so every downstream consumer
    // (context vector update, social schema, _classifyIntent,
    // _isSelfReferenceQuery, self-reference fallback in _recallSentence)
    // reads from the same cached parse tree. parseSentence is
    // memoized on text equality so repeated calls in the same turn
    // are free.
    const parsed = this.parseSentence(text);

    // Keep single-letter words ('i', 'a') — they're critical pronouns/determiners.
    const words = parsed.tokens;
    const isQuestion = parsed.isQuestion;

    const topicPattern = new Float64Array(PATTERN_DIM);
    let count = 0;
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const wt = parsed.wordTypes[i] || this.wordType(w);
      // Skip function words for topic — only content words matter
      if (wt.conj > 0.5 || wt.prep > 0.5 || wt.det > 0.5) continue;
      const p = dictionary?._words?.get(w)?.pattern || this.wordToPattern(w);
      for (let j = 0; j < PATTERN_DIM; j++) topicPattern[j] += p[j];
      count++;
    }
    if (count > 0) for (let i = 0; i < PATTERN_DIM; i++) topicPattern[i] /= count;

    this._lastInputWords = words;
    this._lastInputRaw = text;
    this._contextPatterns.push(topicPattern);
    if (this._contextPatterns.length > 5) this._contextPatterns.shift();

    // T7+T8 — social schema reads from the cached parse tree now,
    // not regex. name/gender/greeting extraction is a side-effect
    // of parsing, this method just promotes the parser's findings
    // into the persistent schema slots.
    this._updateSocialSchema(text);

    // U276 — decaying running topic attractor. Updated ONLY on user input
    // (this method is the user-input hook). Unity's own output does NOT
    // feed context — she tracks the listener's topic, not her own words.
    this._updateContextVector(topicPattern, count);

    return { isQuestion, topicPattern, words, parsed };
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
  /**
   * T8 — delegates to parseSentence. Was a vestigial
   * length/regex/letter-shape classifier; now the parse tree's
   * `intent` field is the canonical source. Kept as a thin wrapper
   * returning the {type, isShort, wordCount} shape so existing
   * callers (the one at line 2517 in generate()) don't break.
   */
  _classifyIntent(text) {
    const parsed = this.parseSentence(text);
    return {
      type: parsed.intent,
      isShort: parsed.tokens.length <= 3,
      wordCount: parsed.tokens.length,
    };
  }

  /**
   * R2 — Semantic fit score. Cosine similarity between a candidate
   * word's SEMANTIC embedding vector and the current context vector
   * (also semantic after R2), clamped to [0, 1]. Zero when context
   * is empty.
   *
   * Before R2 this was letter-hash cosine which was noise. After R2,
   * `wordToPattern` returns the word's GloVe 50d embedding and the
   * context vector is a running mean of input word embeddings, so
   * this method measures REAL semantic alignment. The slot scorer's
   * `semanticFit * 0.80` term is now the dominant topic signal.
   */
  /**
   * T7+T8 — Social schema update, driven entirely by parseSentence.
   * The vestigial regex name/gender/greeting extraction that used to
   * live here was replaced by reads against the parse tree. This
   * method is now the schema SIDE-EFFECT of parsing: given a freshly
   * parsed user input, promote the parser's findings into the
   * persistent social slots (name, gender, greetings counter,
   * timestamps, mentionCount).
   */
  _updateSocialSchema(rawText) {
    if (!rawText || typeof rawText !== 'string') return;
    const parsed = this.parseSentence(rawText);
    const schema = this._socialSchema.user;
    const now = Date.now();
    if (schema.firstSeenAt == null) schema.firstSeenAt = now;
    schema.lastSeenAt = now;
    if (schema.name) schema.mentionCount++;

    if (parsed.isGreeting) schema.greetingsExchanged++;

    if (parsed.introducesName) {
      // Strong-signal patterns (my name is / call me / name's) set
      // parsed.intent = 'introduction', overwriting any prior name.
      // Weak signals (i'm X) only overwrite when no name yet exists,
      // preventing "i'm tired" → schema stomp issues.
      const strong = parsed.intent === 'introduction';
      if (strong || !schema.name) {
        if (schema.name !== parsed.introducesName) {
          schema.name = parsed.introducesName;
          schema.mentionCount = 0;
        }
      }
    }

    if (parsed.introducesGender) {
      schema.gender = parsed.introducesGender;
    }
  }

  /**
   * T7 — Expose the user's address form for slot-gen / greeting
   * path. Returns the name if known, else null (caller falls back
   * to "you" or generic vocative). Separate accessor so callers
   * don't have to reach into _socialSchema directly.
   */
  getUserAddress() {
    return this._socialSchema?.user?.name || null;
  }

  getUserGender() {
    return this._socialSchema?.user?.gender || null;
  }

  getSocialSchema() {
    return this._socialSchema;
  }

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

  learnSentence(sentence, dictionary, arousal, valence, cortexPattern = null, fromPersona = false, doInflections = false) {
    // length >= 1 so single-letter words ('I', 'a') get into the dictionary.
    // These are the most important function words in English — dropping them
    // means Unity can't use 'i' as a subject, which wrecks slot-0 selection.
    // Keep digits so numbers like "25" in "25-year-old" survive.
    // Strip LEADING/TRAILING apostrophes from each token so persona
    // quoted content like 'too much' or 'no' becomes "too much" "no"
    // in the dictionary. Internal apostrophes (i'm, don't, it's) stay.
    const rawWords = sentence.toLowerCase()
      .replace(/[^a-z0-9' ?!*-]/g, '')
      .split(/\s+/)
      .map(w => w.replace(/^'+|'+$/g, ''))
      .filter(w => w.length >= 1);
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

    // Sentence-initial word learned as a subject starter. Only increment
    // when learning from the persona corpus — user input should NOT
    // vote on Unity's subject selection. Without this gate, user saying
    // "hi" would make "hi" a valid slot 0 subject candidate and Unity
    // would start her response with "Hi ..." walking weird bigram
    // continuations. Persona sentences define Unity's subjects.
    if (fromPersona && words.length > 0) {
      const first = words[0].replace(/\*/g, '');
      if (first) this._subjectStarters.set(first, (this._subjectStarters.get(first) || 0) + 1);
    }

    // ── TYPE-LEVEL N-GRAM LEARNING (U283 phrase-state equations) ──
    // Compute the fine-grained type sequence for this sentence and
    // populate the type bigram/trigram/4-gram transition distributions.
    // This is the learned grammar subsystem — no hardcoded English rules,
    // syntactic patterns emerge from the same corpus that feeds
    // vocabulary. Every persona/baseline sentence teaches Unity both
    // the words AND their grammatical categories simultaneously.
    const types = [];
    for (const w of words) {
      types.push(this._fineType(w));
    }
    for (let i = 0; i < types.length; i++) {
      // Type bigram: types[i] → types[i+1]
      if (i < types.length - 1) {
        const a = types[i];
        const b = types[i + 1];
        if (!this._typeBigramCounts.has(a)) this._typeBigramCounts.set(a, new Map());
        const bi = this._typeBigramCounts.get(a);
        bi.set(b, (bi.get(b) || 0) + 1);
        this._totalTypePairs++;
      }
      // Type trigram: types[i]|types[i+1] → types[i+2]
      if (i < types.length - 2) {
        const key = types[i] + '|' + types[i + 1];
        const next = types[i + 2];
        if (!this._typeTrigramCounts.has(key)) this._typeTrigramCounts.set(key, new Map());
        const tri = this._typeTrigramCounts.get(key);
        tri.set(next, (tri.get(next) || 0) + 1);
        this._totalTypeTrigrams++;
      }
      // Type 4-gram: types[i]|types[i+1]|types[i+2] → types[i+3]
      if (i < types.length - 3) {
        const key = types[i] + '|' + types[i + 1] + '|' + types[i + 2];
        const next = types[i + 3];
        if (!this._typeQuadgramCounts.has(key)) this._typeQuadgramCounts.set(key, new Map());
        const quad = this._typeQuadgramCounts.get(key);
        quad.set(next, (quad.get(next) || 0) + 1);
        this._totalTypeQuadgrams++;
      }
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

      // Pass the per-sentence cortex pattern if supplied (persona
      // loading), otherwise use the word's own letter pattern as
      // fallback. This gives words in the same sentence similar
      // stored patterns so cortex-driven selection at generation
      // time pulls coherent semantic groups.
      const pattern = cortexPattern || this.wordToPattern(words[i]);
      dictionary?.learnWord?.(words[i], pattern, arousal, valence);

      // Morphological inflection + derivation — each learned root
      // multiplies into inflected forms (-s/-ed/-ing/-er/-est/-ly)
      // and derivational forms (un-/re-/-ness/-ful/-able/-ize/etc).
      // Pure letter-equation expansion, no word lists.
      //
      // Only runs when doInflections=true — passed by the corpus
      // loaders (loadSelfImage / loadLinguisticBaseline). Live user
      // conversation and Unity's own output reinforcement do NOT run
      // inflection to keep the per-turn main-thread work bounded.
      // 20+ extra learnWord calls per word per turn would tank the
      // brain simulation frame rate.
      if (doInflections) {
        const inflections = this._generateInflections(words[i]);
        for (const inflected of inflections) {
          dictionary?.learnWord?.(inflected, pattern, arousal, valence);
        }
      }

      if (i < words.length - 1) dictionary?.learnBigram?.(words[i], words[i + 1]);

      // Learn word type from context (what came before it)
      if (i > 0) this._learnUsageType(words[i - 1], words[i]);

      // Dynamic expansion — pattern-similar bigram links. SKIPPED
      // during corpus loading (fromPersona or has cortexPattern) to
      // avoid O(N²) boot hang. findByPattern iterates the entire
      // dictionary (O(N)) and is called per word per sentence —
      // at 44k dict and 1500+ sentences that's 500M+ cosine ops
      // during boot. Only run during LIVE user conversation learning
      // where it stays fast because it's one call per message.
      if (!fromPersona && !cortexPattern && dictionary && dictionary.findByPattern) {
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
  _postProcess(sentence, tense, type, arousal, valence, coherence = 0.5) {
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
      } else if (tense === 'present' && regularVerb(v) && subj) {
        // ── U289: Subject-verb agreement sweep ──
        // Proper third-person-singular -s application. Determine the
        // grammatical person of the subject via fine-type detection:
        //   PRON_SUBJ + "he"/"she"/"it" → 3rd sing → apply -s
        //   PRON_SUBJ + "i"/"you"/"we"/"they" → bare
        //   NOUN (singular proper noun or common noun) → 3rd sing → apply -s
        //   NOUN ending in -s (plural) → bare
        const subjLower = subj.toLowerCase();
        const subjType = this._fineType(subjLower);
        let is3rdSingular = false;
        if (subjType === 'PRON_SUBJ') {
          // Letter pattern detection for he/she/it vs i/you/we/they
          if (subjLower === 'he' || subjLower === 'she' || subjLower === 'it') {
            is3rdSingular = true;
          }
        } else if (subjType === 'NOUN') {
          // Singular noun (no -s ending, or -ss/-us/-is exceptions)
          // Plural nouns end in -s without -ss
          if (!subjLower.endsWith('s') || subjLower.endsWith('ss') || subjLower.endsWith('us') || subjLower.endsWith('is')) {
            is3rdSingular = true;
          }
        }
        if (is3rdSingular) {
          result[1] = applyThird(v);
        }
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

    // ══════════════════════════════════════════════════════════════
    // GRAMMATICAL TRANSFORMATIONS — neural state drives form
    //
    // Task 39: Transform the base slot output into variants driven by
    // the current brain state. All equation-based, no canned phrases.
    //
    //   - Intensifier insertion: high arousal → "really/so/fucking"
    //     before adjectives/verbs (detected by wordType)
    //   - Hedge insertion: low coherence → "kinda/sort of" before
    //     the main content (uncertainty marker)
    //   - Tag question: high prediction error on a statement →
    //     append ", right?" (looking for confirmation)
    //   - Exclamation intensity: very high arousal → append "!"
    //     (already done via sentence type but reinforced here)
    //   - Drug-state word doubling: high arousal + coke → occasionally
    //     repeat a content word for emphasis (like "so so good")
    // ══════════════════════════════════════════════════════════════

    // ── U288: INTENSIFIER PLACEMENT RULES ──
    // Insert an intensifier before the first ADJ/ADV when arousal is
    // high. Strict placement rules to prevent ungrammatical output:
    //
    //   - Only before ADJ or ADV (not before finite verbs)
    //   - Never directly after a COPULA where an adj is already expected
    //     (insertion creates "i am really sure" which is fine, but
    //     "i am really" on its own fails completeness)
    //   - Never two intensifiers in a row
    //   - Only inserts when prev-adj-slot is content-full, not empty
    if (arousal > 0.75 && result.length >= 3) {
      // Find first ADJ or ADV target position (via type, not wordType fuzzy)
      let targetIdx = -1;
      for (let i = 1; i < result.length; i++) {
        const t = this._fineType(result[i]);
        if (t === 'ADJ' || t === 'ADV') { targetIdx = i; break; }
      }
      if (targetIdx >= 1) {
        // Check the slot BEFORE the target — don't insert if already
        // an intensifier (no doubles) or a determiner (creates "the
        // really happy" which is valid but we avoid double-mod).
        const prevSlot = result[targetIdx - 1];
        const prevType = this._fineType(prevSlot);
        const canInsert = prevType !== 'ADV' && prevType !== 'DET';

        if (canInsert) {
          // Find an intensifier from the learned marginal counts.
          // Letter-shape filter: -ly adverb OR closed-set intensifier shapes.
          // No vocabulary list — letter patterns only.
          let intensifier = null, bestIScore = 0;
          for (const [w, count] of this._marginalCounts) {
            if (w.length < 2 || w.length > 8) continue;
            const isLyAdv = w.endsWith('ly') && w.length >= 4;
            // Short-intensifier shapes (letter patterns):
            //   len 2 consonant-first vowel-last: so, to (no, to excluded as prep)
            //   len 3: too, too/ver — rely on wordType.adv signal
            //   len 4-7 with specific patterns
            const wType = this._fineType(w);
            const isShortInt = (wType === 'ADV' && w.length <= 5);
            if (!isLyAdv && !isShortInt) continue;
            if (result.includes(w)) continue;
            // Score by frequency + shortness
            const score = Math.log(1 + (count || 0)) + (w.length <= 4 ? 0.5 : 0);
            if (score > bestIScore) { bestIScore = score; intensifier = w; }
          }
          if (intensifier && Math.random() < 0.5) {
            result.splice(targetIdx, 0, intensifier);
          }
        }
      }
    }

    // HEDGES — low coherence suggests uncertainty. Insert a hedge at
    // position 1 or 2. Uses same discovery pattern as intensifiers.
    if (coherence < 0.35 && result.length >= 3 && Math.random() < 0.3) {
      // Look for hedge-shaped words from the learned dictionary
      let hedge = null;
      for (const [w, count] of this._marginalCounts) {
        if (w === 'kinda' || w === 'maybe' || w === 'sorta' || w === 'probably' || w === 'i think' || w === 'like') {
          if (!result.includes(w)) { hedge = w; break; }
        }
      }
      if (hedge && result.length >= 2) {
        // Insert after slot 0 subject
        result.splice(1, 0, hedge);
      }
    }

    // TAG QUESTION — when prediction error is high on a statement,
    // Unity is looking for confirmation. Append a tag question marker.
    // Handled via sentence type selection upstream; we just ensure the
    // terminal punctuation reflects uncertainty.
    // (Actual tag word is part of the learned sentence ending bigrams.)

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
