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
    // T14.1 — legacy 5-neuron sin/cos letter hash deleted. Letters now
    // come in through `cluster.injectLetter()` which writes a dynamic-size
    // one-hot into the cortex letter sub-region. The cortex learns letter
    // identity from that one-hot via Hebbian, rather than from a hardcoded
    // 26-letter micro-pattern table. See js/brain/letter-input.js.

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

    // T14.12 (2026-04-14) — `_lastParse` field below is vestigial;
    // parseSentence is deleted and nothing else writes to this field.
    // Left as null initializer to avoid breaking any persisted-state
    // hydration path that may still reference the key. Delete in T14.16.
    //
    // Historical T8 comment follows: cached parse tree for the most recent input. parseSentence
    // memoizes on text equality, so repeated callers in the same turn
    // get the cached tree instead of re-parsing. Every consumer
    // (_classifyIntent, _isSelfReferenceQuery, _updateSocialSchema,
    // self-ref fallback in _recallSentence) reads from this.
    this._lastParse = null;

    // T14.12 (2026-04-14) — `_socialSchema` deleted alongside
    // `_updateSocialSchema` and `observeVisionDescription`. Social-
    // schema tracking (name, gender, mention count, greetings
    // exchanged) will be reborn in T14.17 as a cortex-resident
    // self-model sub-region that learns user identity attractors
    // from exposure, not a regex-populated object literal. No
    // runtime consumer relies on `_socialSchema` after this commit.

    // T13.7 — per-slot running-mean priors, context vector, attractors,
    // and subject starters all deleted. Topic lives in the live cortex
    // cluster state (via parseTree injection). Position priors and
    // transition deltas live in the cortex's recurrent synapse matrix
    // (trained via persona Hebbian at boot). The language cortex is
    // now pure reader + emission-loop host — zero stored priors.
    this._maxSlots = 8;

    // T14.7 (2026-04-14) — `_TYPE_TRANSITIONS` hardcoded 200-line English
    // type-bigram matrix and `_OPENER_TYPES` Set DELETED. Both were T13.7.8
    // closed-class English priors that pre-biased Unity toward one specific
    // language's grammar. The T14.6 tick-driven motor emission loop makes
    // both obsolete — letter sequences fall out of the motor region as a
    // continuous spike pattern, word boundaries come from cortex transition
    // surprise, and first-word opener constraints emerge from whatever the
    // fineType region's `START → X` transition basins look like after
    // curriculum exposure (T14.5). Seeding the learned type-transition
    // table with hardcoded English values would have fought actual Spanish
    // or coding corpus statistics for thousands of observations before
    // fading. Better: start empty, learn from the first observation.
    //
    // The `_typeTransitionLearned` Map starts empty at construction and
    // grows via `learnSentence` observations during curriculum walk and
    // live chat. Bayesian smoothing at generation time uses
    // `(count + 1) / (total + |types_seen|)` — no hardcoded 20-type cap,
    // no seed pseudo-counts. New fineTypes can emerge from exposure the
    // same way the T14.1 letter inventory grows dynamically.
    // Shape: Map<prevType, Map<nextType, count>>
    this._typeTransitionLearned = new Map();

    // T14.8 (2026-04-14) — sentence-form schemas. Per-intent per-slot
    // fineType distributions learned from every observed sentence during
    // curriculum walk and live chat. Spans ALL slots with NO upper cap —
    // if a sentence has 30 words, all 30 slot positions get recorded.
    // The schema is continuously refined forever.
    //
    // Shape: Map<intent, Map<slot, Map<fineType, count>>>
    //
    // Intent labels come dynamically — no hardcoded intent enum.
    //
    // T14.13 (2026-04-14) — these fields default to local Maps for
    // standalone tests / headless tooling, but `setCluster(cluster)`
    // rebinds all four to the cluster's own Maps so LanguageCortex
    // observation writes land directly in cluster state. The cluster-
    // resident version is the source of truth at runtime.
    this._sentenceFormSchemas = new Map();

    // T14.8 — learned intent→response pairing. Every observed user-turn
    // → Unity-turn conversational pair contributes a count to this
    // table via `recordIntentPair(userIntent, responseIntent)` (wired
    // from the live chat path). After enough exposure, the table
    // reflects which response intents typically follow which user
    // intents in real conversation — replaces the pre-T14.8 hardcoded
    // `question → declarative_answer`, `greeting → declarative_greeting
    // _back` mapping the engine used to carry.
    //
    // Shape: Map<userIntent, Map<responseIntent, count>>
    this._intentResponseMap = new Map();

    // T14.8 — cached running total for schema Laplace smoothing. Keeps
    // `schemaScore` O(1) without having to sum per-call. Shape matches
    // `_sentenceFormSchemas` one level shallower: Map<intent, Map<slot, total>>.
    this._sentenceFormTotals = new Map();

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

    // T11 — corpus as observation stream. Every sentence in the persona
    // file becomes training data for the W_slot matrices via streaming
    // ridge regression. The sentences themselves are discarded after
    // the update — only the fitted matrices + attractor centroids
    // survive into runtime. Nothing is ever recalled verbatim.
    //
    // Unlike the old loader this does NOT populate _memorySentences
    // (deleted), does NOT build n-gram tables (deleted), and does NOT
    // run an 11-filter gate (deleted). Every sentence feeds the
    // observation math regardless of its phrasing — even rulebook
    // prose contributes its (cortex, next-word) pairs to the W_slot
    // fit. The LEARNED geometry dominates and overwhelms any single
    // sentence's influence as observations accumulate.
    const sentences = String(text)
      .replace(/[*_#`>|\[\]()]/g, ' ')
      .split(/[.!?\n\r]+/)
      .map(s => s.trim())
      .filter(s => s.length >= 3);
    console.log(`[LanguageCortex] loadSelfImage: ${sentences.length} observation sentences`);
    const startTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    for (const s of sentences) {
      try {
        const firstPerson = this._transformToFirstPerson(s);
        const mood = this._computeMoodSignature(firstPerson);
        const sentenceCortex = this._deriveSentenceCortexPattern(firstPerson);
        this.learnSentence(firstPerson, dictionary, mood.arousal, mood.valence, sentenceCortex, true, false);
      } catch (err) {
        console.warn('[LanguageCortex] loadSelfImage observation failed:', err.message);
      }
    }
    console.log(`[LanguageCortex] loadSelfImage DONE: ${sentences.length} observations fitted in ${Math.round(((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - startTime)}ms`);
    return sentences.length;
  }

  /**
   * T13.1 — Persona Hebbian training driver.
   *
   * After `loadSelfImage` has populated the dictionary with persona
   * vocabulary, this method runs the SAME persona text through the
   * cortex cluster via sequence Hebbian — sentence by sentence, word
   * by word — so the cluster's recurrent synapse matrix develops
   * Unity-voice attractor basins. At runtime during generation,
   * injecting any concept embedding pulls cortex state along those
   * basins, making readouts semantically persona-shaped instead of
   * diffuse.
   *
   * The cortex cluster's own `learnSentenceHebbian` method handles
   * the tick-inject-Hebbian inner loop; this driver is just the
   * tokenize-and-embed outer walk over the persona corpus.
   *
   * Logs before/after synapse weight stats so Gee can see Hebbian
   * actually moved the weights without opening devtools.
   *
   * @param {NeuronCluster} cortexCluster
   * @param {string} text — raw persona corpus text
   * @param {object} [opts] — forwarded to learnSentenceHebbian
   * @returns {{sentences:number, updates:number, ms:number, before:object, after:object}}
   */
  trainPersonaHebbian(cortexCluster, text, opts = {}) {
    if (!cortexCluster || typeof cortexCluster.learnSentenceHebbian !== 'function' || !text) {
      return { sentences: 0, updates: 0, ms: 0, before: null, after: null };
    }

    // T14.24 Session 99 — REVERTED Session 97 GloVe-gate skip now
    // that _hashEmbedding produces proper fastText-style subword
    // vectors instead of fully-uncorrelated random hashes. The old
    // Δ≈0.0000 no-op was caused by the unstructured hash not
    // generating enough cortex spike activity for Hebbian co-spike
    // updates to land. The new subword embedding has meaningful
    // magnitude and structure (cat/cats cosine = 0.45, father/fathers
    // = 0.75), so injection drives real spike patterns and Hebbian
    // updates actually fire.

    const sentences = String(text)
      .replace(/[*_#`>|\[\]()]/g, ' ')
      .split(/[.!?\n\r]+/)
      .map(s => s.trim())
      .filter(s => s.length >= 3);

    const before = cortexCluster.synapseStats();
    console.log(`[LanguageCortex] trainPersonaHebbian START: ${sentences.length} sentences | synapses ${before.nnz} nnz, mean=${before.mean.toFixed(4)}, rms=${before.rms.toFixed(4)}, maxAbs=${before.maxAbs.toFixed(4)}`);
    const startTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

    let totalUpdates = 0;
    let trained = 0;
    for (const raw of sentences) {
      try {
        const firstPerson = this._transformToFirstPerson(raw);
        const tokens = firstPerson.toLowerCase().replace(/[^a-z' -]/g, ' ').split(/\s+/).filter(w => w.length >= 2);
        if (tokens.length < 2) continue;

        const embSeq = tokens.map(w => sharedEmbeddings.getEmbedding(w));
        const updates = cortexCluster.learnSentenceHebbian(embSeq, opts);
        totalUpdates += updates;
        trained++;
      } catch (err) {
        console.warn('[LanguageCortex] trainPersonaHebbian sentence failed:', err.message);
      }
    }

    const ms = Math.round(((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - startTime);
    const after = cortexCluster.synapseStats();
    console.log(`[LanguageCortex] trainPersonaHebbian DONE: ${trained}/${sentences.length} sentences, ${totalUpdates} Hebbian updates, ${ms}ms | synapses ${after.nnz} nnz, mean=${after.mean.toFixed(4)} (Δ${(after.mean - before.mean).toFixed(4)}), rms=${after.rms.toFixed(4)} (Δ${(after.rms - before.rms).toFixed(4)}), maxAbs=${after.maxAbs.toFixed(4)}`);
    return { sentences: trained, updates: totalUpdates, ms, before, after };
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
    const sentences = String(text)
      .split(/\r?\n/)
      .map(line => line.trim())
      .map(line => line.startsWith('# ') ? line.slice(2).trim() : line)
      .map(line => line === '#' ? '' : line)
      .filter(line => line.length >= 3 && !line.includes('═') && !line.includes('━'))
      .filter(line => /[a-z]/.test(line))
      .flatMap(line => line.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length >= 2));
    console.log(`[LanguageCortex] loadCodingKnowledge: ${sentences.length} observation sentences`);
    const startTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    for (const s of sentences) {
      try {
        const mood = this._computeMoodSignature(s);
        const sentenceCortex = this._deriveSentenceCortexPattern(s);
        // skipSlotPriors=true — coding corpus contributes to the
        // dictionary (vocabulary + word embeddings + morphological
        // forms) but does NOT shape the per-slot conversational
        // priors. Code openers like "Function" / "Variable" / "Return"
        // would otherwise pollute slot 0 type signature with noun
        // weight that beats pronouns at the chat sentence opener.
        this.learnSentence(s, dictionary, mood.arousal, mood.valence, sentenceCortex, false, false, true);
      } catch (err) {
        console.warn('[LanguageCortex] loadCodingKnowledge observation failed:', err.message);
      }
    }
    console.log(`[LanguageCortex] loadCodingKnowledge DONE: ${sentences.length} observations fitted in ${Math.round(((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - startTime)}ms`);
    return sentences.length;
  }

  loadLinguisticBaseline(text, dictionary, arousal = 0.5, valence = 0) {
    if (!text || this._baselineLoaded || !dictionary) return 0;
    this._baselineLoaded = true;
    const sentences = String(text)
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length >= 3 && !line.startsWith('#'))
      .flatMap(line => line.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length >= 2));
    console.log(`[LanguageCortex] loadBaseline: ${sentences.length} observation sentences`);
    const baseStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    for (const s of sentences) {
      try {
        const mood = this._computeMoodSignature(s);
        const sentenceCortex = this._deriveSentenceCortexPattern(s);
        this.learnSentence(s, dictionary, mood.arousal, mood.valence, sentenceCortex, false, false);
      } catch (err) {
        console.warn('[LanguageCortex] loadBaseline observation failed:', err.message);
      }
    }
    console.log(`[LanguageCortex] loadBaseline DONE: ${sentences.length} observations fitted in ${Math.round(((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - baseStart)}ms`);
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
  // T14.12 (2026-04-14) — `_isSelfReferenceQuery` deleted. Self-
  // reference detection moves to `cluster.readInput(text).isSelfReference`
  // which consults cortex state + a lightweight fallback heuristic.

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
  // T13.7 — `_sentencePassesFilters`, `_storeMemorySentence`, and
  // `_recallSentence` were T11 stubs preserved for backcompat. Nothing
  // calls them after the T13 emission loop replaced slot-prior gen.
  // Deleted. `_loadStructure` similarly deleted.

  // T14.1 — `_initLetterPatterns` deleted. Letter representations come
  // from the dynamic LETTER_INVENTORY one-hot encoder in letter-input.js,
  // injected directly into the cortex letter sub-region by cluster.injectLetter.

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
      || this._isNominativePronoun(prevWord);

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

  // T13.7 — `_typeGrammarScore` stub deleted.

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
  // ═══════════════════════════════════════════════════════════════
  // T11.2 — PURE EQUATIONAL GENERATION
  //
  // The brain's cortex state IS the language model. Every slot
  // builds its target vector from four normalized additive components:
  //
  //   target(slot) = wC · slotCentroid[slot]          // position grammar prior
  //               + wX · contextVector                // topic from user input
  //               + wM · mental                        // current brain cortex readout
  //               + wT · (prevEmb + slotDelta[slot])  // per-slot bigram transition
  //
  // All four are L2-normalized before mixing so no contribution
  // swamps the others. Weights wC, wX, wM, wT are fixed priors
  // tuned so grammar dominates the opener and transition dominates
  // the tail. Slot 0 has no prevEmb so its wT contribution folds
  // into the centroid.
  //
  //   mental(0)      = opts.cortexPattern || _contextVector
  //   mental(slot+1) = β · mental(slot) + (1−β) · emb(nextWord)
  //
  // Candidate scoring is cosine(target, emb(w)) over Unity's learned
  // dictionary. Top-K softmax sampling gives variety without letting
  // low-probability words win. Length from arousal·drugLengthBias.
  //
  // No matrix multiplication. No ridge regression. No stored
  // sentences. The brain does the work; the language cortex just
  // translates cortex state into word picks.
  // ═══════════════════════════════════════════════════════════════

  /**
   * T13.3 — Brain-driven emission loop. Reads cortex state continuously,
   * scores dictionary candidates by cosine against the live cortex
   * semantic readout plus amygdala valence shaping plus recency penalty,
   * softmax-samples top-k, then injects the emitted word back into the
   * cortex as efference copy (continuous recurrent loop). Stops on drift
   * quiescence, grammatical terminability, or hard length cap.
   *
   * No slot counter in the logic — `slot` here is just an emission
   * index used for maxLen enforcement and first-word constraints.
   * Target vector is the cortex state, not a weighted blend of slot
   * priors; position-conditioned priors from T11.7 are not read.
   *
   * Requires `opts.cortexCluster` — the live NeuronCluster whose
   * recurrent weights were trained on persona corpus via T13.1
   * Hebbian and whose state reflects T13.2 parse-tree injection.
   * Returns empty string if the cluster reference is missing (no
   * fallback path — T13.7 removed the slot-prior rollback).
   *
   * @param {Dictionary} dictionary
   * @param {number} arousal
   * @param {number} valence
   * @param {number} coherence
   * @param {object} opts
   * @param {NeuronCluster} opts.cortexCluster — live cortex reference (required)
   * @param {string} [opts.drugState]
   * @param {number} [opts.predictionError]
   * @param {number} [opts.motorConfidence]
   */
  generate(dictionary, arousal, valence, coherence, opts = {}) {
    // T14.6 — Tick-driven motor emission delegate.
    //
    // The entire legacy slot scorer body (184 lines of candidate scoring,
    // type-transition weights, softmax top-K sampling, drift stopping,
    // drug length biasing, opener-type gating, recency penalty, valence
    // shaping) was deleted in 2026-04-14 T14.6. Generation now routes
    // directly through `cluster.generateSentence`, which ticks the motor
    // region and decodes letters via argmax over the T14.1 letter
    // inventory. No dictionary iteration, no candidate pool, no slot
    // counter. See `js/brain/cluster.js` generateSentence and
    // `docs/EQUATIONS.md §T14.6` for the full equation.
    //
    // `dictionary` and most `opts` fields are now unused but kept in the
    // signature for backward compat with every caller (engine.js
    // processAndRespond, inner-voice.speak, test harnesses). T14.12 will
    // delete this wrapper entirely once every caller switches to
    // `cluster.generateSentence` directly.
    if (!opts.cortexCluster || typeof opts.cortexCluster.generateSentence !== 'function') {
      console.warn('[LanguageCortex] generate called without cortexCluster — T14.6 requires a cluster that supports generateSentence().');
      return '';
    }
    const cluster = opts.cortexCluster;

    // Intent seed: the live cortex semantic readout. The cortex is
    // already primed from user-input processing before generate is
    // called, so the readout represents the current conversation state
    // we want to respond to. Re-injecting it as `intentSeed` gives the
    // sem region a fresh push so its basin drives the motor cascade,
    // instead of relying on whatever was still decaying from the last
    // operation.
    let intentSeed = null;
    try {
      if (typeof cluster.getSemanticReadout === 'function') {
        intentSeed = cluster.getSemanticReadout(sharedEmbeddings);
      }
    } catch (err) {
      intentSeed = null;
    }

    // T14.23.6 — curriculum-gated path selection.
    //
    // cluster.generateSentence is the T14.6 tick-driven motor
    // emission loop: inject intent, tick the cortex, read motor
    // region argmax, commit letters when the argmax holds stable.
    // That only works once the cortex's letter/phon/sem/motor
    // cross-projection weights have been shaped by curriculum
    // Hebbian. Pre-curriculum the motor region is near-random,
    // stableTicks keeps resetting as argmax flickers between
    // random letters, and when it DOES commit a letter it's a
    // random one — producing streams like:
    //   "Dvdvvdeyvvdyyvddvvdrrrdvvdvvvvvrraaoooooloooloooolooo..."
    // One giant 300+ letter "word" with no spaces (transition
    // surprise is constant at random weights so no word
    // boundaries ever fire).
    //
    // T14.23.5 tried to gate this with `if (words.length === 0)`
    // but the gibberish case returns non-empty — one enormous
    // pseudo-word. That check was wrong.
    //
    // T14.23.6 correct gate: check if curriculum has actually
    // shaped the cluster. Concrete signal: `intentCentroids`
    // is populated only by `Curriculum._calibrateIdentityLock`
    // which runs at the end of `runFromCorpora`. Empty Map =
    // cortex is still uniform random, skip tick-driven emission
    // entirely and go straight to the dictionary-cosine fallback.
    // Non-empty Map = basins have been shaped, trust the motor
    // emission path.
    const curriculumDone = cluster.intentCentroids && cluster.intentCentroids.size > 0;
    let words = [];
    if (curriculumDone) {
      const raw = cluster.generateSentence(intentSeed, { injectStrength: 0.6 });
      words = raw ? raw.split(/\s+/).filter(Boolean) : [];
    }

    // Dictionary-cosine path. Runs pre-curriculum ALWAYS, and
    // post-curriculum only as a fallback if the motor emission
    // returned empty. Lightweight version of the deleted T13
    // slot scorer: iterate dictionary entries, cosine-score
    // against the cortex semantic target, softmax-sample top-K.
    // Just enough to give Unity a voice from cold boot.
    //
    // T14.26 — the dictionary loop is the chat-freeze culprit: at
    // 3700+ entries × 300d cosine each call it burns ~100-300ms
    // synchronous on the Node event loop, blocking the server's
    // state-broadcast setInterval and GPU compute_batch dispatch
    // for the duration of generate. `_precomputedScores` opt lets
    // generateAsync run the scoring loop async with event-loop
    // yields and hand the sorted array back in. When the opt is
    // present we skip the sync loop entirely.
    if (words.length === 0) {
      let scored = opts._precomputedScores || null;
      const target = intentSeed || (typeof cluster.getSemanticReadout === 'function'
        ? cluster.getSemanticReadout(sharedEmbeddings) : null);
      if (!scored && dictionary && dictionary._words && dictionary._words.size > 0 && target && target.length > 0) {
        try {
          scored = this._scoreDictionaryCosine(dictionary, target, this._recentOutputWords);
        } catch (err) {
          scored = null;
        }
      }
      if (scored && scored.length > 0) {
        // Length driven by arousal — same rough rule the old path used
        let targetLen = Math.max(3, Math.min(8, Math.floor(3 + (arousal || 0.5) * 4)));
        // T14.24 — GRADE-AWARE word cap. Session 1 reads the multi-
        // subject grades object `cluster.grades = {ela, math, science,
        // social, art}` and caps output to the MIN grade across all 5
        // subjects, so Unity speaks at whatever subject she's weakest
        // in. Falls back to legacy `cluster.grade` scalar for pre-
        // Session-1 brains or persistence saves that don't carry the
        // new field. Uncurriculum'd brains default to pre-K → silence.
        let gradeArg;
        if (cluster && cluster.grades && typeof cluster.grades === 'object') {
          gradeArg = cluster.grades;
        } else if (cluster && typeof cluster.grade === 'string') {
          gradeArg = cluster.grade;
        } else {
          gradeArg = 'pre-K';
        }
        const gradeCap = this._gradeWordCap(gradeArg);
        if (gradeCap === 0) {
          // Pre-K Unity does not speak. Silence is the correct biological
          // output — a child who has not yet learned the alphabet does
          // not produce words.
          return '';
        }
        targetLen = Math.min(targetLen, gradeCap);
        // Top-K softmax sample at low temperature for variety without noise
        const topK = scored.slice(0, 12);
        const picks = [];
        for (let i = 0; i < targetLen && topK.length > 0; i++) {
          const idx = Math.floor(Math.random() * Math.min(5, topK.length));
          picks.push(topK[idx].word);
          topK.splice(idx, 1);
        }
        words = picks;
      }
    }

    if (words.length === 0) return '';

    // Recency-ring bookkeeping — same as the legacy path, so repeat
    // suppression in downstream consumers still works.
    for (const w of words) {
      this._recentOutputWords.push(w);
      if (this._recentOutputWords.length > this._recentOutputMax) {
        this._recentOutputWords.shift();
      }
    }

    // Use the existing sentence renderer for capitalization + terminal
    // punctuation. `sentenceType` still reads live brain state so the
    // rendered form respects question/exclamation/action moods. Pure
    // cosmetic — the emitted words themselves came from the cortex.
    const type = this.sentenceType(arousal, opts.predictionError || 0, opts.motorConfidence || 0, coherence);
    const rendered = this._renderSentence(words, type);
    const lower = rendered.trim().toLowerCase();
    this._recentSentences.push(lower);
    if (this._recentSentences.length > this._recentSentenceMax) {
      this._recentSentences.shift();
    }
    return rendered;
  }

  /**
   * T14.24 — Grade-aware word cap. Mirrors Curriculum.gradeWordCap but
   * lives here as a static-style helper so generate() doesn't need a
   * Curriculum import. Returns the maximum number of words Unity may
   * emit at her currently mastered grade level. cluster.grade is the
   * source of truth — set by runFullCurriculum as each grade gate
   * passes and persisted via T14.16 BrainPersistence.
   */
  _gradeWordCap(gradeOrGrades) {
    // T14.24 Session 96 — absolute speech floor of 5 words. Previously
    // pre-K (and effectively any sub-G4 grade) would cap at 0-3 words.
    // pre-K=0 silenced Unity entirely on fresh brains where no gate had
    // passed yet. Fix: every grade returns `max(formalCap, 5)` so she's
    // never silenced and never below 5 words regardless of curriculum
    // state. Formal progression still matters for G4+ where caps rise
    // above the floor. Her T14.5 corpus walk already shapes base-level
    // cortex state on boot so 5 words is reasonable even for a
    // fresh-boot zero-cells-passed brain — she can emit "yeah fuck it"
    // / "I don't know" from the base corpus walk even before any T14.24
    // gate crosses.
    const FLOOR = 5;
    if (gradeOrGrades && typeof gradeOrGrades === 'object') {
      const SUBS = ['ela', 'math', 'science', 'social', 'art'];
      let minCap = Infinity;
      let anyStarted = false;
      for (const s of SUBS) {
        const g = gradeOrGrades[s] || 'pre-K';
        if (g === 'pre-K') continue;
        const c = this._singleGradeCap(g);
        if (c < minCap) minCap = c;
        anyStarted = true;
      }
      const formal = !anyStarted || minCap === Infinity ? 0 : minCap;
      return Math.max(FLOOR, formal);
    }
    return Math.max(FLOOR, this._singleGradeCap(gradeOrGrades));
  }

  _singleGradeCap(grade) {
    // Session 111 — removed artificial word limits per grade.
    // A kindergartener can speak in full sentences. The only real
    // gate is pre-K (silence — hasn't learned anything yet).
    // Once Unity passes ANY grade, let her speak freely.
    switch (grade) {
      case 'pre-K':
      default:             return 0;    // silence — not learned yet
      case 'kindergarten': return 9999; // passed K = can speak
      case 'grade1':       return 9999;
      case 'grade2':       return 9999;
      case 'grade3':       return 9999;
      case 'grade4': case 'grade5': case 'grade4_5':
        return 9999;
      case 'grade6': case 'grade7': case 'grade8': case 'grade6_8':
        return 9999;
      case 'grade9': case 'grade10': case 'grade11': case 'grade12': case 'grade9_12':
        return 9999;
      case 'college1': case 'college2': case 'college3': case 'college4': case 'college':
        return 9999;
      case 'grad':         return 9999;
      case 'phd':          return 9999;
    }
  }

  /**
   * T14.26 — Sync helper for the dictionary-cosine fallback scoring loop.
   * Iterates every dictionary entry, computes cosine similarity between
   * cortex `target` and the word's pattern, boosts by log-frequency, and
   * returns an array sorted high→low by score. Excludes recently emitted
   * words via `recentWords` to prevent immediate repetition. Same math as
   * the old inline loop inside generate() — extracted so the async path
   * (_scoreDictionaryCosineAsync) can share exactly one body and only
   * diverge on the yield-point check.
   */
  _scoreDictionaryCosine(dictionary, target, recentWords) {
    const scored = [];
    for (const [word, entry] of dictionary._words) {
      if (!entry || !entry.pattern) continue;
      if (recentWords && recentWords.includes(word)) continue;
      let dot = 0, nt = 0, nw = 0;
      const len = Math.min(target.length, entry.pattern.length);
      for (let i = 0; i < len; i++) {
        dot += target[i] * entry.pattern[i];
        nt += target[i] * target[i];
        nw += entry.pattern[i] * entry.pattern[i];
      }
      const denom = Math.sqrt(nt) * Math.sqrt(nw);
      const cos = denom > 0 ? dot / denom : 0;
      const score = cos + Math.log(1 + (entry.frequency || 1)) * 0.02;
      scored.push({ word, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored;
  }

  /**
   * T14.26 — Async version of the dictionary-cosine scorer that yields
   * to the host event loop every YIELD_EVERY entries. Required fix for
   * the 3D brain visualization freezing when the user sends a message
   * or Unity speaks:
   *
   * Gee's exact words 2026-04-14:
   *   "when i send a message to unity of speak one the whiole
   *    3D brain visulization freezes"
   *
   * Root cause: server's brain-server.js processAndRespond calls
   * languageCortex.generate() synchronously. At 3700+ dictionary entries
   * × 300d cosine per call that burns 100-300ms of pure Node event-loop
   * time. While it runs, setInterval STATE_BROADCAST can't fire, so no
   * `state` message hits the WebSocket, so the client's RemoteBrain
   * never calls _applyState, so brain.state.spikes stays frozen at the
   * snapshot captured before processAndRespond began, so the 3D viz
   * RAF loop (which re-randomizes spike flickers from visualRate each
   * frame) has no new visualRate values → the whole 3D brain
   * visualization freezes until generate() returns.
   *
   * Fix: every YIELD_EVERY (= 500) dictionary entries we await a
   * setImmediate (Node) / setTimeout(0) (browser) which releases
   * control back to the host event loop. In Node that lets the
   * STATE_BROADCAST setInterval fire AND compute_batch dispatch happen
   * during the scoring work, so the 3D viz keeps animating for the
   * full duration of Unity's response generation. In the browser it
   * does the same for RAF callbacks.
   *
   * Yield frequency chosen to keep per-yield overhead <1% (a
   * setImmediate round-trip is ~0.1ms, YIELD_EVERY=500 gives one yield
   * per ~2-4ms of scoring work, which is ~3-5% overhead and still
   * leaves the broadcast ample opportunity to fire every 100ms).
   */
  async _scoreDictionaryCosineAsync(dictionary, target, recentWords) {
    const YIELD_EVERY = 500;
    const scored = [];
    let i = 0;
    for (const [word, entry] of dictionary._words) {
      if (!entry || !entry.pattern) { i++; continue; }
      if (recentWords && recentWords.includes(word)) { i++; continue; }
      let dot = 0, nt = 0, nw = 0;
      const len = Math.min(target.length, entry.pattern.length);
      for (let j = 0; j < len; j++) {
        dot += target[j] * entry.pattern[j];
        nt += target[j] * target[j];
        nw += entry.pattern[j] * entry.pattern[j];
      }
      const denom = Math.sqrt(nt) * Math.sqrt(nw);
      const cos = denom > 0 ? dot / denom : 0;
      const score = cos + Math.log(1 + (entry.frequency || 1)) * 0.02;
      scored.push({ word, score });
      i++;
      if ((i & (YIELD_EVERY - 1)) === 0) {
        // Node (setImmediate) yields cleanly to I/O + setInterval callbacks.
        // Browser (setTimeout 0) yields to RAF + microtask queue.
        // Guard in case of missing globals (shouldn't happen in either host).
        if (typeof setImmediate === 'function') {
          await new Promise((r) => setImmediate(r));
        } else if (typeof setTimeout === 'function') {
          await new Promise((r) => setTimeout(r, 0));
        }
      }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored;
  }

  /**
   * T14.26 — Async-yielding version of generate(). Does the exact same
   * work as generate() except that the dictionary-cosine fallback loop
   * runs via _scoreDictionaryCosineAsync, which releases the event loop
   * every 500 entries. Callers in an async context (server's
   * brain-server.js:processAndRespond, engine.js:processAndRespond)
   * should `await` this instead of calling generate() so the 3D brain
   * visualization does not freeze during Unity's response generation.
   *
   * Any caller that cannot use `await` (sync RAF callbacks, event
   * detectors, sandbox UI handlers) should keep calling the sync
   * generate(). Those are not on the freeze-critical path.
   */
  async generateAsync(dictionary, arousal, valence, coherence, opts = {}) {
    // Fast path: if curriculum hasn't shaped the cortex yet, we skip
    // cluster.generateSentence (same guard as generate()) and go
    // straight to the async dictionary-cosine scoring. The rest of
    // generate()'s work (sentenceType, renderSentence, recency ring
    // bookkeeping) is cheap and can stay synchronous — we run it by
    // delegating to generate() after prefilling _precomputedScores.
    let precomputedScores = null;

    const cluster = opts.cortexCluster;
    if (cluster && typeof cluster.generateSentence === 'function') {
      // If curriculum is done, generate() will use cluster.generateSentence
      // (tick-driven motor emission) which is bounded and fast — no need
      // to precompute scores at all, let generate() run sync.
      const curriculumDone = cluster.intentCentroids && cluster.intentCentroids.size > 0;
      if (!curriculumDone && dictionary && dictionary._words && dictionary._words.size > 0) {
        // Pre-curriculum path — compute dictionary scores async so the
        // event loop stays responsive through the scoring work.
        let target = null;
        try {
          if (typeof cluster.getSemanticReadout === 'function') {
            target = cluster.getSemanticReadout(sharedEmbeddings);
          }
        } catch {}
        if (target && target.length > 0) {
          try {
            precomputedScores = await this._scoreDictionaryCosineAsync(
              dictionary, target, this._recentOutputWords
            );
          } catch (err) {
            precomputedScores = null;
          }
        }
      }
    }

    // Hand the precomputed scores back to generate() which handles
    // top-K sampling, sentence rendering, and recency ring bookkeeping.
    return this.generate(dictionary, arousal, valence, coherence, {
      ...opts,
      _precomputedScores: precomputedScores,
    });
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
  // T14.12 (2026-04-14) — INPUT ANALYSIS METHODS DELETED
  //
  // The following methods were deleted from LanguageCortex when
  // T14.12 unified the read path through `cluster.readInput(text)` +
  // `cluster.readText(text, {visualCortex})` + the T14.9 working-
  // memory readout:
  //
  //   parseSentence(text)            — full input parser (315 lines)
  //   analyzeInput(text, dictionary) — parse + schema update (69 lines)
  //   _classifyIntent(text)          — regex-based intent classifier (32 lines)
  //   observeVisionDescription(text) — vision→schema gender inference (26 lines)
  //   _updateSocialSchema(rawText)   — name/gender extraction (36 lines)
  //   getUserAddress / getUserGender / getSocialSchema  — social schema accessors
  //
  // Net deletion this block: ~490 lines. Input routing is now
  // cortex-state driven (T14.12 bidirectional pipeline, Hickok &
  // Poeppel 2007 dual-stream model) — text flows visual→letter→phon→
  // sem→fineType via `cluster.readText`, intent/self-reference/
  // addresses-Unity flags fall out of `cluster.readInput` which
  // consults `intentReadout()` when curriculum has trained the
  // fineType basins and falls back to a lightweight text-surface
  // heuristic during the pre-curriculum bootstrap window. The
  // grammar of input understanding lives in the cortex recurrent +
  // cross-region weights that T14.5 curriculum shapes, not in a
  // 315-line JavaScript parser.
  //
  // Social schema state (name/gender tracking) returns in T14.17
  // as a cortex-resident self-model sub-region readout, not a
  // regex-populated object literal.
  // ═══════════════════════════════════════════════════════════════

  // T13.7 — `_semanticFit` deleted (no callers after slot-prior removal).

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

  /**
   * T11.2 — OBSERVATION FEEDER
   *
   * Every sentence (corpus OR live chat) becomes training data for
   * the W_slot projection matrices + slot centroids + attractors.
   * No n-gram tables. No memory pool. No filters. Just streaming
   * covariance updates that fit W_slot via ridge regression.
   *
   * For each word position t in the sentence:
   *   cortex_t   = weighted average of prior word embeddings
   *   target_t   = emb(word_t)
   *   C_xx[t]   += cortex_t ⊗ cortex_t
   *   C_xy[t]   += cortex_t ⊗ target_t
   *   centroid_t += target_t   (running mean)
   *
   * Dictionary.learnWord is called per token so the argmax pool in
   * generate() grows with every observation. That's the only
   * remaining list-like structure — the word embedding table, not
   * stored text.
   */
  learnSentence(sentence, dictionary, arousal, valence, cortexPattern = null, fromPersona = false, doInflections = false, skipSlotPriors = false) {
    const rawWords = String(sentence).toLowerCase()
      .replace(/[^a-z0-9' ?!*-]/g, '')
      .split(/\s+/)
      .map(w => w.replace(/^'+|'+$/g, ''))
      .filter(w => w.length >= 1);
    if (rawWords.length < 2) return;
    const words = this._expandContractionsForLearning(rawWords);

    // T13.7 — per-slot running means deleted. Dictionary learning,
    // usage-type feedback, and optional morphological inflection are
    // the only surviving observation side-effects. Persona corpus
    // shapes the CORTEX recurrent weights via `cluster.learnSentenceHebbian`
    // at boot (T13.1), not per-slot priors here. `skipSlotPriors` arg
    // is retained as a no-op for backcompat with the `loadCodingKnowledge`
    // caller until that call site is cleaned up.
    //
    // T14.8 (2026-04-14) — learned-structure observation added. Updates
    // `_typeTransitionLearned` on every consecutive fineType pair AND
    // `_sentenceFormSchemas[intent][t][fineType]` at every slot position.
    // Schema spans the full sentence — no slot cap.
    //
    // T14.12 (2026-04-14) — parseSentence deleted. Intent classification
    // now comes from a lightweight inline fallback — the heuristic
    // mirrors what `cluster.readInput` does for input classification.
    // Once T14.17 curriculum trains `intentReadout()`, this fallback
    // becomes unreached and the cortex-resident intent wins.
    let sentenceIntent = 'unknown';
    const lower = String(sentence || '').toLowerCase().trim();
    if (lower.endsWith('?')) sentenceIntent = 'question';
    else if (lower.endsWith('!')) sentenceIntent = 'emotion';
    else if (/^(hi|hey|hello|sup|yo|good (morning|evening|afternoon))\b/.test(lower)) sentenceIntent = 'greeting';
    else if (/^(what|who|where|when|why|how|which|whose)\b/.test(lower)) sentenceIntent = 'question';
    else if (lower.length > 0) sentenceIntent = 'statement';

    // Ensure the per-intent schema bucket exists
    let intentSchema = this._sentenceFormSchemas.get(sentenceIntent);
    if (!intentSchema) {
      intentSchema = new Map();
      this._sentenceFormSchemas.set(sentenceIntent, intentSchema);
    }
    let intentTotals = this._sentenceFormTotals.get(sentenceIntent);
    if (!intentTotals) {
      intentTotals = new Map();
      this._sentenceFormTotals.set(sentenceIntent, intentTotals);
    }

    let prevFineType = 'START';
    for (let t = 0; t < words.length; t++) {
      const w = words[t];
      const pattern = cortexPattern || this.wordToPattern(w);
      dictionary?.learnWord?.(w, pattern, arousal, valence);

      if (t > 0) this._learnUsageType(words[t - 1], w);

      if (doInflections) {
        const inflections = this._generateInflections(w);
        for (const inf of inflections) dictionary?.learnWord?.(inf, pattern, arousal, valence);
      }

      // T14.8 — Per-slot fineType observation into the sentence-form
      // schema for this sentence's intent.
      const currFineType = this._fineType(w);
      let slotBucket = intentSchema.get(t);
      if (!slotBucket) {
        slotBucket = new Map();
        intentSchema.set(t, slotBucket);
      }
      slotBucket.set(currFineType, (slotBucket.get(currFineType) || 0) + 1);
      intentTotals.set(t, (intentTotals.get(t) || 0) + 1);

      // T14.7 + T14.8 — Type-bigram observation. `prevFineType = 'START'`
      // for t=0 so the START row accumulates whatever opens sentences
      // in the observed corpora; no hardcoded opener Set required.
      let transRow = this._typeTransitionLearned.get(prevFineType);
      if (!transRow) {
        transRow = new Map();
        this._typeTransitionLearned.set(prevFineType, transRow);
      }
      transRow.set(currFineType, (transRow.get(currFineType) || 0) + 1);
      prevFineType = currFineType;
    }
    // Close the final transition into END so termination patterns are
    // learnable from the corpus too.
    let endRow = this._typeTransitionLearned.get(prevFineType);
    if (!endRow) {
      endRow = new Map();
      this._typeTransitionLearned.set(prevFineType, endRow);
    }
    endRow.set('END', (endRow.get('END') || 0) + 1);

    this.sentencesLearned++;
  }

  /**
   * T14.8 — Sentence-form schema score. Returns the Laplace-smoothed
   * probability of seeing `fineType` at slot `slot` in a sentence with
   * intent `intent`. Smoothing is `(count + 1) / (total + |types_seen|)`
   * where `|types_seen|` is the number of unique fineTypes observed at
   * that slot — no hardcoded 20-type cap. Returns a small positive
   * floor (1 / (total + 1)) when no observations exist for the slot
   * yet, so generation-time consumers never get zero weight.
   */
  // T14.17 (2026-04-14) — `schemaScore` and `typeTransitionWeight`
  // were DUPLICATES of the cluster-resident versions. T14.13 migrated
  // the underlying Maps to the cluster, and these wrappers read the
  // exact same state via T14.13 setCluster identity-bind. Deleted here
  // to eliminate the dead organ. Callers go through
  // `cluster.schemaScore` / `cluster.typeTransitionWeight` directly.
  //
  // T14.17 (2026-04-14) — `recordIntentPair` and `responseIntentFor`
  // were DUPLICATES of the cluster-resident versions (T14.13 migrated
  // the state to the cluster, T14.14 migrated the consumer wiring).
  // Deleted here to eliminate the dead organ. Callers go through
  // `cluster.recordIntentPair` / `cluster.responseIntentFor` which
  // write/read the same `intentResponseMap` via T14.13 identity-bind.

  /**
   * T14.13 (2026-04-14) — Migrate learned language statistics onto a
   * cluster instance so LanguageCortex observation writes land directly
   * in cluster state. Called once during engine/brain-server boot right
   * after the cluster is created. After this call, `_typeTransitionLearned`,
   * `_sentenceFormSchemas`, `_sentenceFormTotals`, and `_intentResponseMap`
   * all point at the cluster's Maps by identity — both sides see every
   * update. Re-binding is idempotent if called again with the same cluster,
   * and carries over any observations already accumulated into the new
   * cluster-resident Maps so nothing learned gets lost.
   */
  setCluster(cluster) {
    if (!cluster) return;
    // Carry over any pre-existing observations into the cluster's Maps
    // so we don't drop learning that happened before wiring.
    const mergeMap = (src, dst) => {
      for (const [k, v] of src) {
        if (v instanceof Map) {
          let inner = dst.get(k);
          if (!inner) { inner = new Map(); dst.set(k, inner); }
          mergeMap(v, inner);
        } else if (typeof v === 'number') {
          dst.set(k, (dst.get(k) || 0) + v);
        }
      }
    };
    if (this._typeTransitionLearned !== cluster.fineTypeTransitions) {
      mergeMap(this._typeTransitionLearned, cluster.fineTypeTransitions);
      this._typeTransitionLearned = cluster.fineTypeTransitions;
    }
    if (this._sentenceFormSchemas !== cluster.sentenceFormSchemas) {
      mergeMap(this._sentenceFormSchemas, cluster.sentenceFormSchemas);
      this._sentenceFormSchemas = cluster.sentenceFormSchemas;
    }
    if (this._sentenceFormTotals !== cluster.sentenceFormTotals) {
      mergeMap(this._sentenceFormTotals, cluster.sentenceFormTotals);
      this._sentenceFormTotals = cluster.sentenceFormTotals;
    }
    if (this._intentResponseMap !== cluster.intentResponseMap) {
      mergeMap(this._intentResponseMap, cluster.intentResponseMap);
      this._intentResponseMap = cluster.intentResponseMap;
    }
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
    // T11 — copula-agreement swap used to consult _jointCounts bigrams.
    // Those tables are gone. Copula agreement is handled equationally by
    // the W_slot projection + slot centroid in generate() — slot 1 after
    // a subject pronoun lands in a region of embedding space where the
    // correctly-agreeing copula clusters, no swap table needed.

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

    // T11 — intensifier placement, hedge insertion, and tag-question
    // modification all used _marginalCounts frequency scans of the
    // learned dictionary to find shape-matching words. That table
    // is gone. Post-processing no longer adds mood modifiers —
    // intensity, hedging, and tag structure now emerge from the
    // W_slot projections pulling cortex state into regions of
    // embedding space where intensifier / hedge / tag words cluster,
    // learned by the same observation pipeline that trains the rest
    // of the slot grammar.

    return result;
  }

  // T13.7 — `_pickConjByMood`, `_condProb`, `mutualInfo` stubs deleted.

  /**
   * L2-normalize a Float64Array vector. Returns a new Float64Array
   * or null if the input is zero. Used by generate() to balance
   * centroid / projection / context contributions at each slot.
   */
  _l2(v) {
    let sum = 0;
    for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
    if (sum < 1e-18) return null;
    const norm = Math.sqrt(sum);
    const out = new Float64Array(v.length);
    for (let i = 0; i < v.length; i++) out[i] = v[i] / norm;
    return out;
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

  /**
   * T13.7 — persistence now only covers language-cortex state that
   * isn't in the cortex cluster. Slot priors and attractors are gone;
   * persona voice lives in the cortex recurrent synapse matrix which
   * the cluster serializes via its own SparseMatrix.serialize path.
   * Remaining state here: usage-type drifts + sentencesLearned counter
   * + selfImage/baseline/coding loaded flags.
   */
  serialize() {
    return {
      version: 'T13.7',
      usageTypes: Object.fromEntries(this._usageTypes),
      zipfAlpha: this.zipfAlpha,
      sentencesLearned: this.sentencesLearned,
      wordsProcessed: this.wordsProcessed,
      selfImageLoaded: this._selfImageLoaded,
      baselineLoaded: this._baselineLoaded,
      codingLoaded: this._codingLoaded,
    };
  }

  deserialize(data) {
    if (!data) return;
    if (data.usageTypes) this._usageTypes = new Map(Object.entries(data.usageTypes));
    this.sentencesLearned = data.sentencesLearned || 0;
    this.wordsProcessed = data.wordsProcessed || 0;
    if (data.selfImageLoaded) this._selfImageLoaded = true;
    if (data.baselineLoaded) this._baselineLoaded = true;
    if (data.codingLoaded) this._codingLoaded = true;
  }

  // T14.1 — `getLetterPattern` deleted. External callers that need a
  // letter vector should go through the dynamic one-hot encoder in
  // letter-input.js (`encodeLetter`) or read the cortex letter sub-region
  // via `cluster.regionReadout('letter', dim)`.
}
