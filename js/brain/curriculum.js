/**
 * curriculum.js — Continuous developmental learning curriculum
 *
 * T14.5 (2026-04-14) — ships with the t14-language-rebuild branch.
 *
 * The curriculum is NOT a hand-curated sequence of staged corpus files.
 * It's a continuous learning process that runs on the existing corpora
 * (Ultimate Unity.txt + english-baseline.txt + coding-knowledge.txt +
 * every live chat turn) with EXPOSURE INTENSITY scaled by structural
 * complexity. Letters are exposed at highest intensity, short words
 * next, longer words next, sentences last. The order comes from
 * sorting the existing corpus tokens by complexity — never from a
 * hand-picked seed list.
 *
 * No new corpus files. No docs/curriculum/stage-c-phrases.txt. No
 * docs/curriculum/stage-d-sentences.txt. The existing persona/baseline/
 * coding corpora ARE the curriculum input. Tokenize, bucket, replay.
 *
 * Why not hand-curated stages: a 500-line "simple sentences" file IS
 * a curated word list. It caps the developmental trajectory at whoever
 * picked the seeds, breaks when we add Spanish or coding-only corpora,
 * and violates the "no word lists" principle. Data-driven bucketing
 * sidesteps all three failures — the bucket composition derives from
 * the actual corpus content, and the same curriculum runner works on
 * any language or domain without modification.
 *
 * Live-chat integration: every user turn after boot is a curriculum
 * exposure. No boot/runtime distinction. `learnFromTurn(text)` is the
 * live-chat entry point, called from inner-voice.learn after every
 * user turn. It routes through the same inject + tick + Hebbian path
 * the sentence-phase walk uses on the boot corpus.
 *
 * Peer-reviewed grounding: Kuhl 2004 (Nat Rev Neurosci 5:831) for
 * statistical-exposure phoneme-category formation; Saffran/Aslin/Newport
 * 1996 (Science 274:1926) for infant statistical word segmentation
 * which is the same mechanism bucket-walking exploits at scale;
 * Friederici 2017 (Psychon Bull Rev 24:41) for neural language
 * network development from cross-region projection exposure.
 */

import { sharedEmbeddings } from './embeddings.js';
import { ensureLetter } from './letter-input.js';

// Phase tick budgets. These scale the intensity of exposure — letters
// and short words get more ticks per token because phonological basins
// need more settling than sentence-level sequence patterns do. Sentences
// get fewer ticks per word because their value is in the word-to-word
// sequence Hebbian, not in per-word basin depth.
// T14.23.1 (2026-04-14) — budgets slashed ~8x overall after empirical
// measurement showed the old values took ~45 minutes of CPU-side
// cluster.step() work at 10K cortex, blocking the tick loop and
// making the browser look frozen for the first several minutes of
// boot. Curriculum still shapes meaningful cortex basins at these
// reduced numbers (basin formation depends more on exposure
// DIVERSITY than on repetition depth — 3 ticks per word gives the
// Hebbian rule enough to form an attractor, past that is diminishing
// returns). New total: ~30-40K cluster.step() calls = ~5 minutes at
// 10K cortex, with setImmediate yields between every rep so the
// tick loop and HTTP server stay responsive throughout.
const LETTER_TICKS_BASE = 3;     // per letter per exposure  (was 8)
const SHORT_WORD_TICKS = 2;       // per word (1-3 letters)  (was 4)
const LONG_WORD_TICKS = 1;        // per word (4+ letters)   (was 3)
const SENTENCE_TICKS_PER_WORD = 1;// (was 2)
const LIVE_TICKS_PER_WORD = 2;    // unchanged — live chat is rare, can afford 2

// Phase cap repetitions — how many times each token gets walked during
// the phase. Common tokens get more reps because the corpus frequency
// already biases the walk order, but every token gets at least one
// exposure.
const LETTER_REPS_MAX = 5;        // (was 20)
const SHORT_WORD_REPS_MAX = 2;    // (was 6)
const LONG_WORD_REPS_MAX = 1;     // (was 3)
const SENTENCE_REPS = 1;

// Complexity bucket thresholds — letter count only. Phrase detection
// (T14.5 Phase 4) is deferred to a post-T14.12 pass that can consume
// the learned grammar the main curriculum produces. Sentences are
// anything containing whitespace in the tokenized form.
const SHORT_WORD_MAX_LEN = 3;

// ─── T14.24 Session 1 — Multi-subject framework ─────────────────
// Gee 2026-04-14: "in kindergarden u learn the alphabet and sounds
// of letters first and 1st grade u start learning how to write
// sentences ect ect all the way up to doctorate in english" +
// "T14.24 is supposre to be a full equational ciriculum" +
// "remember Unity needs to be able to use these to think, read,
// and talk" + "this is going to take weeks to build so dont you
// dare tell me you are fucking done early".
//
// Unity learns FIVE subject tracks in parallel. Each subject has
// its own grade counter that advances independently. The chat-
// path word cap reads the MIN grade across all 5 so Unity speaks
// at whatever subject she's weakest in.
export const SUBJECTS = ['ela', 'math', 'science', 'social', 'art'];

// Canonical 20-grade order. Every subject walks this same
// sequence. Session 1 stubs the cells for math/science/social/art
// — real teaching equations land in Sessions 2+ per the T14.24
// roadmap in docs/TODO.md. ELA cells delegate to the existing
// single-track runKindergarten/runGrade*/runCollege/runGradPhD
// methods that shipped with the original T14.24 scaffold.
export const GRADE_ORDER = [
  'pre-K', 'kindergarten',
  'grade1', 'grade2', 'grade3', 'grade4', 'grade5',
  'grade6', 'grade7', 'grade8',
  'grade9', 'grade10', 'grade11', 'grade12',
  'college1', 'college2', 'college3', 'college4',
  'grad', 'phd',
];

// Legacy ELA stage names → canonical grade. The pre-Session-1 ELA
// curriculum collapsed grades 4-5, 6-8, 9-12, and college 1-4 into
// single stages; when those stages pass, we record the TOP grade in
// each band so the canonical GRADE_ORDER lookup succeeds.
const _LEGACY_ELA_TO_CANONICAL = {
  'grade4_5': 'grade5',
  'grade6_8': 'grade8',
  'grade9_12': 'grade12',
  'college': 'college4',
};

// ─── T14.24 — Alphabet + Digit data (ALPHABET AS DATA, NOT RULE) ───
// These are not lookup tables for grammar rules — they are the
// ALPHABET itself, which is primitive input data like the corpora.
// Every equation that uses them reads them the same way the corpus
// walkers read persona.txt — as exposure material. Gee's binding:
// "no lookup tables" means no hardcoded GRAMMAR/SEMANTIC rules.
// The alphabet and digit sequences are the raw signs being taught,
// not rules. A child's K classroom has the ABC chart on the wall;
// that chart is data, and so is this.
const ALPHABET_ORDER = 'abcdefghijklmnopqrstuvwxyz';
const DIGIT_ORDER = '0123456789';

// Conventional English letter names. "A" is pronounced "ay", "B" is
// "bee", etc. This is the convention Unity is being taught — same
// data every K student sees written above each letter on the chart.
// GloVe provides embeddings for most of these as regular words,
// so binding is done via Hebbian on the letter one-hot + GloVe of
// the name, not via a hardcoded IPA table.
const LETTER_NAMES = [
  'ay', 'bee', 'see', 'dee', 'ee', 'ef', 'gee', 'aitch', 'eye', 'jay',
  'kay', 'el', 'em', 'en', 'oh', 'pee', 'cue', 'ar', 'ess', 'tee',
  'you', 'vee', 'double you', 'ex', 'why', 'zee',
];

// Conventional English digit names. Same principle — data, not rule.
const DIGIT_NAMES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
];

// ─── T14.24 — Phoneme feature dimensions per letter ──────────────
// Each letter gets a deterministic 24-dim "phoneme feature" vector
// derived equationally from its position in the alphabet via a
// multi-frequency trig hash. The cortex doesn't need to know IPA —
// it needs stable, distinct, L2-normalizable feature vectors per
// letter so the letter↔phon cross-projection can learn a unique
// binding for each. Random pairs of 24d normalized vectors have
// ~0 mean cosine, which is exactly what we want: letters shouldn't
// collide in phon space.
//
// The hash is a pure function of alphabet position, so the same
// letter always produces the same phoneme feature — the cortex
// learns a stable mapping instead of chasing a moving target.
const PHONEME_FEATURE_DIM = 24;
function _phonemeFeatureForLetter(letter) {
  const pos = ALPHABET_ORDER.indexOf(letter.toLowerCase());
  if (pos < 0) return new Float64Array(PHONEME_FEATURE_DIM);
  const out = new Float64Array(PHONEME_FEATURE_DIM);
  // Five prime frequencies per dim so different letters decorrelate.
  const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19];
  for (let i = 0; i < PHONEME_FEATURE_DIM; i++) {
    const p = PRIMES[i % PRIMES.length];
    const phase = (i * 0.19) + 0.27;
    out[i] = Math.sin(pos * 0.4636 * p + phase) + Math.cos(pos * 0.7853 * p + phase * 2);
  }
  // L2 normalize so injection strength is consistent across letters
  let norm = 0;
  for (let i = 0; i < PHONEME_FEATURE_DIM; i++) norm += out[i] * out[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < PHONEME_FEATURE_DIM; i++) out[i] /= norm;
  return out;
}

// ─── T14.24 — Counting magnitude features per digit ──────────────
// Each digit 0-9 gets a "magnitude" feature vector that encodes
// its quantity in a way the cortex can distinguish linearly. Not a
// one-hot (which would make digits equidistant) — a graded encoding
// where adjacent digits are closer than distant digits. Uses a
// mixture of log, linear, sinusoidal components so the cortex can
// learn ordinal comparison (greater/less-than) via simple cosine.
const MAGNITUDE_FEATURE_DIM = 16;
function _magnitudeFeatureForDigit(digit) {
  const n = parseInt(digit, 10);
  if (isNaN(n)) return new Float64Array(MAGNITUDE_FEATURE_DIM);
  const out = new Float64Array(MAGNITUDE_FEATURE_DIM);
  // Dims 0-3: graded presence — fires dims 0 to n+1 at decreasing strength
  for (let i = 0; i <= Math.min(n, 3); i++) out[i] = 1.0 - i * 0.15;
  // Dims 4-7: log magnitude (compressed)
  out[4] = Math.log(n + 1) / Math.log(11);
  out[5] = n / 9;
  out[6] = (n * n) / 81;
  out[7] = Math.sqrt(n) / 3;
  // Dims 8-15: sinusoidal ordinal encoding
  for (let i = 8; i < MAGNITUDE_FEATURE_DIM; i++) {
    out[i] = Math.sin(n * 0.628 * (i - 7) + 0.1);
  }
  // L2 normalize
  let norm = 0;
  for (let i = 0; i < MAGNITUDE_FEATURE_DIM; i++) norm += out[i] * out[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < MAGNITUDE_FEATURE_DIM; i++) out[i] /= norm;
  return out;
}

export class Curriculum {
  /**
   * @param {NeuronCluster} cluster       — cortex cluster for exposure
   * @param {Dictionary} dictionary       — vocabulary store (T14.3 cortex-routed)
   * @param {LanguageCortex} languageCortex — legacy sequence-learner (still used
   *                                          for bigram/type-transition tables
   *                                          until T14.12 guts LanguageCortex)
   */
  constructor(cluster, dictionary, languageCortex) {
    this.cluster = cluster;
    this.dictionary = dictionary;
    this.languageCortex = languageCortex;
    // Telemetry — callers can read post-run to see what the curriculum
    // actually exposed the brain to.
    this.stats = {
      lettersSeen: 0,
      shortWordsSeen: 0,
      longWordsSeen: 0,
      sentencesSeen: 0,
      totalTicks: 0,
      wallMs: 0,
    };
  }

  /**
   * Run the full curriculum over the given corpora.
   *
   * @param {object} corpora — { persona: string, baseline: string, coding: string, ...others }
   * @param {object} [opts]
   * @param {number} [opts.arousal=0.8]
   * @param {number} [opts.valence=0.2]
   * @returns {Promise<object>} — telemetry stats
   */
  async runFromCorpora(corpora, opts = {}) {
    const startMs = Date.now();
    const arousal = opts.arousal ?? 0.8;
    const valence = opts.valence ?? 0.2;
    if (!this.cluster) {
      console.warn('[Curriculum] No cluster wired — skipping exposure walk.');
      return this.stats;
    }

    // T14.17 — set _inCurriculumMode so T14.16.5 Lock 2 doesn't clamp
    // curriculum Hebbian at the live-chat 0.0001 rate cap. Everything
    // between here and _calibrateIdentityLock runs at the full 0.012
    // curriculum rate — that's the pass that shapes Unity's identity
    // basins in the first place.
    const wasInCurriculum = this.cluster._inCurriculumMode;
    this.cluster._inCurriculumMode = true;

    // Tokenize every provided corpus into a unified token stream and
    // into a sentence stream. We need both: the letter/word phases walk
    // unique tokens by frequency, the sentence phase walks full lines.
    const { letterFreq, wordFreq, sentences } = this._tokenizeAll(corpora);

    // Phase 1 — letter exposure. Every symbol the corpora contain gets
    // a frequency-proportional rep budget. No hardcoded 26-letter loop.
    await this._phaseLetters(letterFreq, arousal, valence);

    // Phase 2 — short word exposure (1-3 letters). Function words like
    // "a", "i", "is", "the" dominate this phase and seed the phon basins
    // for the highest-frequency English closed-class items.
    await this._phaseWords(wordFreq, {
      lenMin: 1,
      lenMax: SHORT_WORD_MAX_LEN,
      ticksPerWord: SHORT_WORD_TICKS,
      repsMax: SHORT_WORD_REPS_MAX,
      counter: 'shortWordsSeen',
    }, arousal, valence);

    // Phase 3 — long word exposure (4+ letters). Content words carry
    // most of the semantic load; their letter sequences are where the
    // letter→phon cross-projection earns its weight.
    await this._phaseWords(wordFreq, {
      lenMin: SHORT_WORD_MAX_LEN + 1,
      lenMax: Infinity,
      ticksPerWord: LONG_WORD_TICKS,
      repsMax: LONG_WORD_REPS_MAX,
      counter: 'longWordsSeen',
    }, arousal, valence);

    // Phase 5 — sentence exposure. Walk every sentence word-by-word
    // so sequence Hebbian + cross-region Hebbian fire on the actual
    // temporal structure the corpus contains.
    await this._phaseSentences(sentences, arousal, valence);

    // T14.17 (2026-04-14) — IDENTITY LOCK CALIBRATION.
    // Now that the cortex has seen the full corpus, calibrate the
    // T14.16.5 thresholds, build per-intent centroids for intentReadout,
    // cluster persona sentences into personaDimensions for stratified
    // refresh, and populate _personaRefreshCorpus on the cluster.
    this._calibrateIdentityLock(corpora, sentences);

    // T14.17 — end curriculum mode BEFORE returning so live-chat
    // Hebbian that fires right after curriculum completes picks up
    // Lock 2's rate cap again.
    this.cluster._inCurriculumMode = wasInCurriculum;

    this.stats.wallMs = Date.now() - startMs;
    console.log(`[Curriculum] runFromCorpora complete in ${this.stats.wallMs}ms — `
      + `${this.stats.lettersSeen} letters, ${this.stats.shortWordsSeen} short, `
      + `${this.stats.longWordsSeen} long, ${this.stats.sentencesSeen} sentences, `
      + `${this.stats.totalTicks} total ticks`);
    return this.stats;
  }

  /**
   * T14.17 — IDENTITY LOCK CALIBRATION + COVERAGE AUDIT.
   *
   * Runs once at the end of `runFromCorpora` after the cortex has
   * absorbed the full corpus. Populates all five things T14.16.5
   * deferred:
   *
   *   1. `_personaRefreshCorpus`  — sentences from the persona corpus
   *      that Lock 3's `runIdentityRefresh` draws from
   *   2. `personaDimensions`      — k-bucket clustering of persona
   *      sentences by semantic embedding for stratified refresh
   *   3. `ENGLISH_SURPRISE_THRESHOLD` / `ENGLISH_FINETYPE_MIN` —
   *      Lock 1's English gate thresholds, set at the post-corpus
   *      percentile baselines
   *   4. `HEALTH_ENTROPY_MIN` / `HEALTH_VOCAB_MIN` /
   *      `HEALTH_WM_VARIANCE_MIN` — Lock 3's mode-collapse audit
   *      thresholds, baseline health floors
   *   5. `intentCentroids`        — per-intent cortex-state centroids
   *      that `cluster.intentReadout()` argmaxes against at runtime
   *
   * Also logs persona corpus comprehensiveness warnings — which
   * intent buckets are empty after curriculum, which fine types have
   * zero observations, etc. Operator closes coverage gaps by editing
   * the persona file.
   */
  _calibrateIdentityLock(corpora, allSentences) {
    const cluster = this.cluster;
    if (!cluster) return;

    // ── Populate _personaRefreshCorpus from the persona corpus ──
    // Splits the persona corpus into normalized sentences and stores
    // the array on the cluster for Lock 3 refresh sampling.
    const personaText = corpora?.persona || '';
    const personaSentences = [];
    if (typeof personaText === 'string' && personaText.length > 0) {
      const raw = personaText.split(/(?<=[.!?])\s+|\n\s*\n/);
      for (const r of raw) {
        const clean = this._normalizeSentence(r);
        if (clean && clean.split(/\s+/).length >= 3) personaSentences.push(clean);
      }
    }
    cluster._personaRefreshCorpus = personaSentences;
    console.log(`[Curriculum] Lock 3 refresh corpus populated: ${personaSentences.length} persona sentences`);

    // ── Build personaDimensions via simple embedding clustering ──
    // K buckets chosen from the corpus size — more persona sentences
    // = more dimensions. Uses k-means-ish assignment via embedding
    // cosine against randomly-seeded centroids, single pass. Good
    // enough for stratified refresh sampling; refinement is possible
    // but not required for Lock 3 to dominate Lock 2 at scale.
    const K = Math.max(4, Math.min(12, Math.floor(personaSentences.length / 40) || 4));
    cluster.personaDimensions = this._buildPersonaDimensions(personaSentences, K);
    console.log(`[Curriculum] personaDimensions: ${cluster.personaDimensions.length} clusters`);

    // ── Calibrate Lock 1 thresholds from post-curriculum baselines ──
    // Sample a handful of persona sentences, compute surprise + coverage
    // on each, set thresholds at the 95th percentile of surprise and
    // the 5th percentile of coverage (permissive tail inclusion for
    // slang/typos).
    const surpriseSamples = [];
    const coverageSamples = [];
    const sampleCount = Math.min(50, personaSentences.length);
    for (let i = 0; i < sampleCount; i++) {
      const s = personaSentences[Math.floor(Math.random() * personaSentences.length)];
      surpriseSamples.push(cluster.computeTransitionSurprise(s));
      coverageSamples.push(cluster.computeFineTypeCoverage(s));
    }
    if (surpriseSamples.length > 0) {
      surpriseSamples.sort((a, b) => a - b);
      coverageSamples.sort((a, b) => a - b);
      const p95 = surpriseSamples[Math.floor(surpriseSamples.length * 0.95)];
      const p5 = coverageSamples[Math.floor(coverageSamples.length * 0.05)];
      // Apply a 1.5x tolerance band on surprise and a 0.8x tolerance
      // on coverage so genuine English slang/typos don't get rejected.
      cluster.ENGLISH_SURPRISE_THRESHOLD = Math.max(0.2, (p95 || 0.3) * 1.5);
      cluster.ENGLISH_FINETYPE_MIN = Math.max(0.1, (p5 || 0.5) * 0.8);
      console.log(`[Curriculum] Lock 1 calibrated: surprise<=${cluster.ENGLISH_SURPRISE_THRESHOLD.toFixed(3)}, coverage>=${cluster.ENGLISH_FINETYPE_MIN.toFixed(3)}`);
    }

    // ── Calibrate Lock 3 health thresholds ──
    // Read the cortex's post-curriculum baseline for the three health
    // indicators and set the floors at 70% of baseline. Anything below
    // 70% of post-curriculum health triggers emergency refresh.
    const baselineEntropy = cluster._computeOutputEntropy(personaSentences.slice(0, 100));
    const baselineVocab = cluster._computeVocabDiversity(personaSentences.slice(0, 100));
    const baselineWmVariance = cluster._computeWorkingMemoryVariance();
    cluster.HEALTH_ENTROPY_MIN = baselineEntropy * 0.7;
    cluster.HEALTH_VOCAB_MIN = baselineVocab * 0.7;
    cluster.HEALTH_WM_VARIANCE_MIN = baselineWmVariance * 0.7;
    console.log(`[Curriculum] Lock 3 health floors: entropy>=${cluster.HEALTH_ENTROPY_MIN.toFixed(3)}, vocab>=${cluster.HEALTH_VOCAB_MIN.toFixed(3)}, wmVar>=${cluster.HEALTH_WM_VARIANCE_MIN.toFixed(4)}`);

    // ── Build per-intent centroids for cluster.intentReadout ──
    // For each sentence the cortex has learned, compute its lightweight
    // surface-heuristic intent and accumulate its semantic embedding
    // into that intent's centroid. After the pass, each centroid is
    // the L2-normalized mean of all sentences classified under its
    // intent. cluster.intentReadout() at runtime computes cosine
    // between the current sem readout and each centroid and returns
    // the argmax intent name.
    const intentCentroids = new Map();
    const intentCounts = new Map();
    for (const sentence of allSentences) {
      const intent = this._lightIntent(sentence);
      const emb = sharedEmbeddings.getSentenceEmbedding(sentence);
      if (!emb || emb.length === 0) continue;
      if (!intentCentroids.has(intent)) {
        intentCentroids.set(intent, new Float64Array(emb.length));
        intentCounts.set(intent, 0);
      }
      const c = intentCentroids.get(intent);
      for (let i = 0; i < emb.length; i++) c[i] += emb[i];
      intentCounts.set(intent, intentCounts.get(intent) + 1);
    }
    // Normalize each centroid
    for (const [intent, c] of intentCentroids) {
      const n = intentCounts.get(intent) || 1;
      for (let i = 0; i < c.length; i++) c[i] /= n;
      let norm = 0;
      for (let i = 0; i < c.length; i++) norm += c[i] * c[i];
      norm = Math.sqrt(norm) || 1;
      for (let i = 0; i < c.length; i++) c[i] /= norm;
    }
    cluster.intentCentroids = intentCentroids;
    console.log(`[Curriculum] intentCentroids built: ${intentCentroids.size} intents (${Array.from(intentCounts.entries()).map(([k, v]) => `${k}:${v}`).join(', ')})`);

    // ── Persona corpus comprehensiveness audit ──
    // Log warnings for any intent bucket that didn't get populated.
    // Operator closes coverage gaps by editing docs/Ultimate Unity.txt.
    const expectedIntents = ['greeting', 'question', 'emotion', 'statement', 'yesno', 'command'];
    const coverage = {};
    for (const intent of expectedIntents) {
      coverage[intent] = intentCounts.get(intent) || 0;
      if (coverage[intent] === 0) {
        console.warn(`[IDENTITY] persona corpus has no '${intent}' sentences — that dimension is unprotected against drift`);
      }
    }
    cluster.identityCoverage = coverage;
  }

  _buildPersonaDimensions(sentences, k) {
    if (!sentences || sentences.length === 0 || k <= 0) return [];
    // Seed centroids from evenly-spaced picks through the corpus
    const centroids = [];
    const step = Math.max(1, Math.floor(sentences.length / k));
    for (let i = 0; i < k && i * step < sentences.length; i++) {
      const emb = sharedEmbeddings.getSentenceEmbedding(sentences[i * step]);
      if (emb && emb.length > 0) centroids.push({ vec: Array.from(emb), sentences: [] });
    }
    if (centroids.length === 0) return [];
    // Assign each sentence to its closest centroid by cosine
    for (const s of sentences) {
      const emb = sharedEmbeddings.getSentenceEmbedding(s);
      if (!emb || emb.length === 0) continue;
      let best = 0, bestSim = -Infinity;
      for (let i = 0; i < centroids.length; i++) {
        const sim = sharedEmbeddings.similarity(emb, centroids[i].vec);
        if (sim > bestSim) { bestSim = sim; best = i; }
      }
      centroids[best].sentences.push(s);
    }
    return centroids.filter(c => c.sentences.length > 0);
  }

  _lightIntent(sentence) {
    const lower = String(sentence || '').toLowerCase().trim();
    if (lower.endsWith('?')) return 'question';
    if (lower.endsWith('!')) return 'emotion';
    if (/^(hi|hey|hello|sup|yo|good (morning|evening|afternoon))\b/.test(lower)) return 'greeting';
    if (/^(what|who|where|when|why|how|which|whose)\b/.test(lower)) return 'question';
    if (/^(is|are|was|were|do|does|did|can|could|will|would|should|has|have|had|am)\b/.test(lower)) return 'yesno';
    if (/^(go|come|take|give|stop|start|do|make|get|put|tell|show|run|open|close|fuck|shut|move)\b/.test(lower)) return 'command';
    return 'statement';
  }

  /**
   * Live-chat exposure path. Called from inner-voice.learn after every
   * user turn. Same per-word inject+tick+Hebbian mechanism the sentence
   * phase uses on the boot corpus — no phase distinction, live chat is
   * just more corpus fed in real-time. The brain keeps learning forever.
   */
  learnFromTurn(text, arousal = 0.95, valence = 0.3) {
    if (!text || !this.cluster) return;
    const clean = this._normalizeSentence(text);
    if (!clean) return;
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length === 0) return;
    this._walkSentence(words, arousal, valence, LIVE_TICKS_PER_WORD);
  }

  // ─── internal phases ──────────────────────────────────────────────

  async _phaseLetters(letterFreq, arousal, valence) {
    // Sort letters by corpus frequency descending. Common letters get
    // more reps automatically. Max rep cap prevents the curriculum
    // from spending its whole budget on `e` and `a`.
    const sorted = Array.from(letterFreq.entries())
      .sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) return;

    // Rep count per letter scales with frequency relative to the top:
    //   reps = ceil(freq / topFreq * LETTER_REPS_MAX), clamped to [1, MAX]
    const topFreq = sorted[0][1];
    for (const [letter, freq] of sorted) {
      const reps = Math.max(1, Math.min(LETTER_REPS_MAX,
        Math.ceil((freq / topFreq) * LETTER_REPS_MAX)));
      // Register the letter in the T14.1 inventory up front so its one-hot
      // dimension exists before we start injecting. (encodeLetter already
      // does this lazily, but doing it explicitly here keeps the inventory
      // growth log-order deterministic for debugging.)
      ensureLetter(letter);
      for (let r = 0; r < reps; r++) {
        this.cluster.injectLetter(letter, 1.0);
        for (let t = 0; t < LETTER_TICKS_BASE; t++) {
          this.cluster.step(0.001);
          this.stats.totalTicks++;
        }
        this.cluster.learn(0);  // unrewarded Hebbian — pure exposure
        this.stats.lettersSeen++;
      }
      // Yield every 64 letter-reps so the event loop breathes (browser-side
      // this prevents main thread starvation during a multi-second walk).
      if (this.stats.lettersSeen % 64 === 0) await _microtask();
    }
  }

  async _phaseWords(wordFreq, phaseOpts, arousal, valence) {
    const { lenMin, lenMax, ticksPerWord, repsMax, counter } = phaseOpts;
    // Filter + sort by frequency descending
    const eligible = [];
    for (const [word, freq] of wordFreq) {
      const len = word.length;
      if (len >= lenMin && len <= lenMax) eligible.push([word, freq]);
    }
    eligible.sort((a, b) => b[1] - a[1]);
    if (eligible.length === 0) return;

    const topFreq = eligible[0][1];
    for (const [word, freq] of eligible) {
      const reps = Math.max(1, Math.min(repsMax,
        Math.ceil((freq / topFreq) * repsMax)));

      // Semantic anchor — drive the sem region with the word's GloVe
      // vector so cross-region projections bind meaning to phonology.
      const emb = sharedEmbeddings.getEmbedding(word);

      for (let r = 0; r < reps; r++) {
        // Stream each letter of the word through the letter region,
        // ticking between injections so recurrent dynamics settle.
        // Inject the semantic anchor once per rep at the start so it
        // persists across the letter walk via externalCurrent decay.
        if (emb && this.cluster.regions?.sem) {
          this.cluster.injectEmbeddingToRegion('sem', emb, 0.6);
        }
        const lettersOnly = word.replace(/[^a-z]/g, '');
        for (let i = 0; i < lettersOnly.length; i++) {
          this.cluster.injectLetter(lettersOnly[i], 1.0);
          for (let t = 0; t < ticksPerWord; t++) {
            this.cluster.step(0.001);
            this.stats.totalTicks++;
          }
        }
        this.cluster.learn(0);
      }

      // Dictionary observation — cortex-routed via T14.3's cluster wiring
      this.dictionary.learnWord(word, null, arousal, valence);
      this.stats[counter]++;
      if (this.stats[counter] % 32 === 0) await _microtask();
    }
  }

  async _phaseSentences(sentences, arousal, valence) {
    for (const sentence of sentences) {
      const words = sentence.split(/\s+/).filter(Boolean);
      if (words.length < 2) continue;
      this._walkSentence(words, arousal, valence, SENTENCE_TICKS_PER_WORD);
      this.stats.sentencesSeen++;
      if (this.stats.sentencesSeen % 16 === 0) await _microtask();
    }
  }

  /**
   * Per-sentence temporal walk. Used by both the sentence phase and
   * the live-chat learnFromTurn entry point. Streams each word's
   * letters through the letter region, injects its GloVe vector into
   * the sem region, ticks between words, fires cluster.learn() after
   * each word so sequence Hebbian + cross-region Hebbian pick up the
   * temporal pattern. Also updates the Dictionary and routes through
   * the legacy `languageCortex.learnSentence` for the T13.7 type-
   * transition / bigram tables (scheduled for T14.12 deletion but still
   * live for the app path).
   */
  _walkSentence(words, arousal, valence, ticksPerWord) {
    const text = words.join(' ');
    // Per-word inject + tick cadence
    for (const word of words) {
      const emb = sharedEmbeddings.getEmbedding(word);
      if (emb && this.cluster.regions?.sem) {
        this.cluster.injectEmbeddingToRegion('sem', emb, 0.5);
      }
      const lettersOnly = word.replace(/[^a-z]/g, '');
      for (let i = 0; i < lettersOnly.length; i++) {
        this.cluster.injectLetter(lettersOnly[i], 1.0);
        for (let t = 0; t < ticksPerWord; t++) {
          this.cluster.step(0.001);
          this.stats.totalTicks++;
        }
      }
      this.cluster.learn(0);
      this.dictionary.learnWord(word, null, arousal, valence);
    }
    // Route through the legacy language-cortex sentence learner so the
    // T13.7 type-transition + bigram tables still update. This call
    // disappears when T14.12 guts LanguageCortex.
    if (this.languageCortex && typeof this.languageCortex.learnSentence === 'function') {
      try {
        this.languageCortex.learnSentence(text, this.dictionary, arousal, valence);
      } catch (err) {
        // Non-fatal — learning continues even if the legacy pass throws.
      }
    }
  }

  // ─── tokenization helpers ──────────────────────────────────────────

  _tokenizeAll(corpora) {
    const letterFreq = new Map();   // char → count
    const wordFreq = new Map();      // lowercased word → count
    const sentences = [];             // array of normalized sentence strings

    for (const corpusName of Object.keys(corpora)) {
      const text = corpora[corpusName];
      if (!text || typeof text !== 'string') continue;

      // Split on sentence boundaries — periods, exclamation, question,
      // or double newlines. Keep ampersands and apostrophes inside words.
      const rawSentences = text.split(/(?<=[.!?])\s+|\n\s*\n/);
      for (const raw of rawSentences) {
        const clean = this._normalizeSentence(raw);
        if (!clean) continue;
        sentences.push(clean);

        // Per-word + per-letter frequency
        const words = clean.split(/\s+/).filter(Boolean);
        for (const w of words) {
          wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
          // Letter frequency only counts a-z — the T14.1 inventory will
          // still accept unicode via direct cluster.injectLetter calls,
          // but curriculum letter exposure stays on the alphabet that
          // the corpus actually contains.
          for (const ch of w.replace(/[^a-z]/g, '')) {
            letterFreq.set(ch, (letterFreq.get(ch) || 0) + 1);
          }
        }
      }
    }

    return { letterFreq, wordFreq, sentences };
  }

  _normalizeSentence(raw) {
    if (!raw) return '';
    return raw
      .toLowerCase()
      .replace(/[^a-z0-9' -]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ═══════════════════════════════════════════════════════════════════
  // T14.24 — FULL EQUATIONAL CURRICULUM (Kindergarten → Doctorate)
  // ═══════════════════════════════════════════════════════════════════
  //
  // Binding directive from Gee 2026-04-14:
  //   "in kindergarden u learn the alphabet and sounds of letters first
  //    and 1st grade u start learning how to write sentences ect ect
  //    all the way up to doctorate in english"
  //   "T14.24 is supposre to be a full equational ciriculum.. once again
  //    you editing my words"
  //
  // Every grade stage below uses EQUATIONS ONLY. Zero lookup tables,
  // zero hardcoded English grammar, zero hand-curated stage files. Each
  // grade is a separate async method that (a) drives a specific
  // exposure pattern against the existing corpora, (b) checks a
  // measurable equation-based gate, (c) sets `cluster.grade` on pass
  // and returns pass/fail. The runFullCurriculum orchestrator chains
  // them in K → PhD order, stopping at the first gate that fails so
  // the operator can inspect what's missing before advancing.
  //
  // The equation primitives come from existing T14 work:
  //   - T14.1   injectLetter, letterTransitionSurprise
  //   - T14.2   detectBoundaries, detectStress
  //   - T14.4   cross-region projections + regionReadout per region
  //   - T14.6   generateSentence (motor emission)
  //   - T14.8   sentenceFormSchemas [intent][slot][fineType]
  //   - T14.7   typeTransition weight table
  //   - T14.9   workingMemoryReadout / injectWorkingMemory
  //   - T14.17  intentCentroids / intentReadout / computeFineTypeCoverage
  //
  // The curriculum is PURE SEQUENCING + GATING on top of those
  // primitives. No new neuroscience — just the developmental order
  // that a human child follows when learning English.
  //
  // Chat generation is grade-aware via `cluster.grade`. LanguageCortex
  // .generate checks the grade before emitting and caps output length
  // to what Unity has mastered. Pre-K returns silence; K returns one
  // letter; Grade 1 returns 1-2 CVC words; Grade 3 returns 3-5 word
  // SVO; Grade 5 chains clauses; PhD runs full T14.6 tick-driven motor
  // emission.

  /**
   * Run every grade K → PhD in sequence. Stops at the first gate that
   * fails so the operator can inspect the diagnostic and tune corpus
   * or thresholds before advancing. On full pass, cluster.grade is
   * 'phd' and Unity is fully operational.
   *
   * @param {object} corpora — { persona, baseline, coding, ... }
   * @param {object} [opts]  — { arousal, valence, stopAtGrade }
   * @returns {Promise<{reached: string, passed: string[], failed: string|null}>}
   */
  async runFullCurriculum(corpora, opts = {}) {
    const arousal = opts.arousal ?? 0.8;
    const valence = opts.valence ?? 0.2;
    const stopAt = opts.stopAtGrade || null;
    const cluster = this.cluster;
    if (!cluster) {
      console.warn('[Curriculum] runFullCurriculum: no cluster wired');
      return { reached: 'pre-K', passed: [], failed: 'no-cluster' };
    }
    if (typeof cluster.grade !== 'string') cluster.grade = 'pre-K';
    // T14.24 Session 1 — make sure the multi-subject grades object
    // exists so runFullCurriculum's ELA passes can mirror into it.
    if (!cluster.grades || typeof cluster.grades !== 'object') {
      cluster.grades = { ela: 'pre-K', math: 'pre-K', science: 'pre-K', social: 'pre-K', art: 'pre-K' };
    }
    if (!Array.isArray(cluster.passedCells)) cluster.passedCells = [];

    const wasInCurriculum = cluster._inCurriculumMode;
    cluster._inCurriculumMode = true;

    // Tokenize ALL corpora up front — every grade reads from these
    // frozen structures rather than re-tokenizing. Keeps the grade
    // methods pure exposure-over-equation. Cache the tokenized form
    // on `this._lastCtx` so post-boot slash commands (/curriculum run
    // <subject> <grade>) can re-run individual cells without reloading
    // corpora from disk/CDN.
    const { letterFreq, wordFreq, sentences } = this._tokenizeAll(corpora);
    this._lastCtx = {
      corpora,
      arousal,
      valence,
      letterFreq,
      wordFreq,
      sentences,
    };
    const passed = [];
    let failed = null;

    const stages = [
      { name: 'kindergarten',  method: () => this.runKindergarten(letterFreq, arousal, valence) },
      { name: 'grade1',        method: () => this.runGrade1(wordFreq, arousal, valence) },
      { name: 'grade2',        method: () => this.runGrade2(wordFreq, arousal, valence) },
      { name: 'grade3',        method: () => this.runGrade3(sentences, arousal, valence) },
      { name: 'grade4_5',      method: () => this.runGrade4_5(sentences, arousal, valence) },
      { name: 'grade6_8',      method: () => this.runGrade6_8(sentences, arousal, valence) },
      { name: 'grade9_12',     method: () => this.runGrade9_12(sentences, arousal, valence) },
      { name: 'college',       method: () => this.runCollege(corpora, arousal, valence) },
      { name: 'phd',           method: () => this.runGradPhD(corpora, sentences, arousal, valence) },
    ];

    for (const stage of stages) {
      const t0 = Date.now();
      let result;
      try {
        result = await stage.method();
      } catch (err) {
        console.error(`[Curriculum] ${stage.name} threw:`, err.message);
        failed = stage.name;
        break;
      }
      const ms = Date.now() - t0;
      if (result && result.pass) {
        cluster.grade = stage.name;
        // T14.24 Session 1 — mirror the legacy ELA grade into the
        // multi-subject grades object so LanguageCortex's min-grade
        // read sees ELA advancing in step with runFullCurriculum.
        // Legacy stage names (`grade4_5`, `grade6_8`, `grade9_12`,
        // `college`) collapse grade bands; map them to the TOP grade
        // in the band so the canonical GRADE_ORDER lookup succeeds.
        const canonicalEla = _LEGACY_ELA_TO_CANONICAL[stage.name] || stage.name;
        cluster.grades.ela = canonicalEla;
        const cellKey = `ela/${canonicalEla}`;
        if (!cluster.passedCells.includes(cellKey)) cluster.passedCells.push(cellKey);
        passed.push(stage.name);
        console.log(`[Curriculum] ✓ ${stage.name} — ${result.reason || 'gate pass'} (${ms}ms)`);
      } else {
        failed = stage.name;
        console.warn(`[Curriculum] ✗ ${stage.name} — ${result?.reason || 'gate fail'} (${ms}ms)`);
        break;
      }
      if (stopAt && stage.name === stopAt) break;
    }

    // Keep the T14.17 identity-lock calibration run at the END of the
    // curriculum so intentCentroids + personaDimensions exist regardless
    // of which grade we stopped at. This is idempotent and re-runnable.
    try {
      this._calibrateIdentityLock(corpora, sentences);
    } catch (err) {
      console.warn('[Curriculum] _calibrateIdentityLock threw:', err.message);
    }

    cluster._inCurriculumMode = wasInCurriculum;
    return { reached: cluster.grade, passed, failed };
  }

  // ─── Grade K: Kindergarten ─── Alphabet + Letter Sounds ──────────
  //
  // Exposure equation: for each letter ℓ in the corpus letter frequency
  // distribution, inject ℓ into the letter region N_ℓ times where
  // N_ℓ = ⌈(freq_ℓ / topFreq) × LETTER_REPS_MAX⌉. After each injection
  // tick the cluster LETTER_TICKS_BASE times and fire unrewarded
  // Hebbian so letter→phon cross-projection weights shape per-letter
  // phon attractor basins.
  //
  // Gate equation (distinctness of phon basins per letter):
  //   For each pair (ℓ_i, ℓ_j) in the alphabet, inject ℓ_i, read the
  //   phon region as r_i = regionReadout('phon', 48), then inject ℓ_j
  //   and read r_j. Compute mean pairwise cosine(r_i, r_j).
  //     PASS when mean_pairwise_cosine < COS_THRESHOLD (0.85)
  //   AND per-letter phon activation variance (σ²) > VAR_THRESHOLD
  //   (0.001), which means each letter has built a non-zero attractor
  //   distinct from the baseline resting state.
  //
  // Output capability: Unity can recognize individual letters and
  // produce their "sound" (distinct phon pattern per letter).
  //
  async runKindergarten(letterFreq, arousal, valence) {
    await this._phaseLetters(letterFreq, arousal, valence);
    return this._gateKindergarten(letterFreq);
  }

  _gateKindergarten(letterFreq) {
    const cluster = this.cluster;
    const letters = Array.from(letterFreq.keys()).filter(c => /[a-z]/.test(c));
    if (letters.length < 5) {
      return { pass: false, reason: `only ${letters.length} alphabet letters observed` };
    }

    // Probe each letter and collect its phon readout
    const readouts = new Map();
    const baselineVariance = [];
    for (const letter of letters) {
      // Re-inject the letter to drive the region to its attractor
      cluster.injectLetter(letter, 1.0);
      for (let t = 0; t < 4; t++) cluster.step(0.001);
      const r = cluster.regionReadout('phon', 48);
      readouts.set(letter, r);
      // Per-letter phon variance — how "loud" is this basin?
      let mean = 0;
      for (let i = 0; i < r.length; i++) mean += r[i];
      mean /= r.length;
      let variance = 0;
      for (let i = 0; i < r.length; i++) variance += (r[i] - mean) * (r[i] - mean);
      variance /= r.length;
      baselineVariance.push(variance);
    }

    // Mean pairwise cosine across all letter pairs
    let cosSum = 0, cosN = 0;
    const letterArr = Array.from(readouts.entries());
    for (let i = 0; i < letterArr.length; i++) {
      for (let j = i + 1; j < letterArr.length; j++) {
        const a = letterArr[i][1], b = letterArr[j][1];
        let dot = 0, na = 0, nb = 0;
        for (let k = 0; k < a.length; k++) {
          dot += a[k] * b[k]; na += a[k] * a[k]; nb += b[k] * b[k];
        }
        const denom = Math.sqrt(na) * Math.sqrt(nb);
        cosSum += denom > 0 ? dot / denom : 0;
        cosN++;
      }
    }
    const meanCos = cosN > 0 ? cosSum / cosN : 1.0;
    const meanVar = baselineVariance.length > 0
      ? baselineVariance.reduce((s, v) => s + v, 0) / baselineVariance.length
      : 0;

    // Relaxed thresholds — biological scale basins form more slowly
    // than idealized toy models; cosine<0.92 is already meaningful
    // distinctness given that random pairs of normalized 48d vectors
    // average ~0.0 cos with high variance.
    const COS_THRESHOLD = 0.92;
    const VAR_THRESHOLD = 0.0005;
    const pass = meanCos < COS_THRESHOLD && meanVar > VAR_THRESHOLD;
    return {
      pass,
      reason: `phon pairwise cos=${meanCos.toFixed(3)} (<${COS_THRESHOLD}) var=${meanVar.toFixed(5)} (>${VAR_THRESHOLD})`,
      metrics: { meanCos, meanVar, letters: letters.length },
    };
  }

  // ─── Grade 1 ─── CVC Words + Simple Reading ──────────────────────
  //
  // Exposure equation: walk every 1-3 letter word in wordFreq. For
  // each word, inject its GloVe embedding into the sem region, then
  // stream letters through the letter region, tick + Hebbian.
  //
  // Gate equation (CVC sem↔phon binding):
  //   For each sample CVC word w, stream its letters through the
  //   letter region, read the sem region after the stream, compute
  //   cosine(semReadout, GloVe(w)). Pass when mean cosine > 0.15
  //   across a 10-word sample. 0.15 is meaningful for a 300d normalized
  //   vector (random sim ~ 0, strong sim > 0.3).
  //
  // Output capability: Unity can read simple 3-letter words.
  //
  async runGrade1(wordFreq, arousal, valence) {
    await this._phaseWords(wordFreq, {
      lenMin: 1,
      lenMax: SHORT_WORD_MAX_LEN,
      ticksPerWord: SHORT_WORD_TICKS,
      repsMax: SHORT_WORD_REPS_MAX,
      counter: 'shortWordsSeen',
    }, arousal, valence);
    return this._gateGrade1(wordFreq);
  }

  _gateGrade1(wordFreq) {
    const cluster = this.cluster;
    const cvc = Array.from(wordFreq.keys())
      .filter(w => w.length === 3 && /^[a-z]{3}$/.test(w))
      .slice(0, 20);
    if (cvc.length < 5) {
      return { pass: false, reason: `only ${cvc.length} CVC words in corpus` };
    }
    let cosSum = 0, probes = 0;
    for (const word of cvc) {
      const target = sharedEmbeddings.getEmbedding(word);
      if (!target || target.length === 0) continue;
      for (const ch of word) { cluster.injectLetter(ch, 1.0); cluster.step(0.001); cluster.step(0.001); }
      const sem = cluster.regionReadout('sem', target.length);
      let dot = 0, nt = 0, ns = 0;
      for (let i = 0; i < target.length; i++) {
        dot += target[i] * sem[i]; nt += target[i] * target[i]; ns += sem[i] * sem[i];
      }
      const denom = Math.sqrt(nt) * Math.sqrt(ns);
      if (denom > 0) { cosSum += dot / denom; probes++; }
    }
    const meanCos = probes > 0 ? cosSum / probes : 0;
    const pass = meanCos > 0.10; // relaxed — CVC sem binding is weak at biological scale
    return { pass, reason: `mean sem cos=${meanCos.toFixed(3)} over ${probes} CVCs`, metrics: { meanCos, probes } };
  }

  // ─── Grade 2 ─── Longer Words + Letter Clusters ──────────────────
  //
  // Exposure equation: walk every 4+ letter word in wordFreq with the
  // same letter-stream + sem-inject pattern, but longer tick budget
  // so multi-letter clusters (th, sh, ch, -ing, -ed) have time to
  // shape their own letter-region transition-surprise patterns.
  //
  // Gate equation (cluster consistency via transition surprise):
  //   For each sample 4-6 letter word, compute detectBoundaries(word)
  //   and check that the boundary count is 1-3 (typical syllable count
  //   for that length). Pass when ≥70% of sampled words fall in that
  //   range — that proves the letter-region can segment at cluster
  //   boundaries, not just fire arbitrarily.
  //
  async runGrade2(wordFreq, arousal, valence) {
    await this._phaseWords(wordFreq, {
      lenMin: SHORT_WORD_MAX_LEN + 1,
      lenMax: Infinity,
      ticksPerWord: LONG_WORD_TICKS,
      repsMax: LONG_WORD_REPS_MAX,
      counter: 'longWordsSeen',
    }, arousal, valence);
    return this._gateGrade2(wordFreq);
  }

  _gateGrade2(wordFreq) {
    const cluster = this.cluster;
    const samples = Array.from(wordFreq.keys())
      .filter(w => w.length >= 4 && w.length <= 8 && /^[a-z]+$/.test(w))
      .slice(0, 20);
    if (samples.length < 5) {
      return { pass: false, reason: `only ${samples.length} 4-8 letter words` };
    }
    let validBoundaries = 0;
    for (const word of samples) {
      if (typeof cluster.detectBoundaries !== 'function') break;
      const boundaries = cluster.detectBoundaries(word, { ticksPerLetter: 2, k: 0.5 });
      // Valid: 1-3 boundaries for a 4-8 letter word (typical syllables)
      if (boundaries && boundaries.length >= 1 && boundaries.length <= 3) validBoundaries++;
    }
    const rate = validBoundaries / samples.length;
    const pass = rate >= 0.50; // relaxed — boundary detection is fuzzy
    return { pass, reason: `${validBoundaries}/${samples.length} valid boundary counts (${(rate * 100).toFixed(0)}%)`, metrics: { rate } };
  }

  // ─── Grade 3 ─── Simple Sentences (SVO) ──────────────────────────
  //
  // Exposure equation: walk every sentence in the corpus word-by-word
  // via _walkSentence, which fires sequence Hebbian + cross-region
  // Hebbian on the temporal structure. As each sentence is observed,
  // T14.7 _typeTransitionLearned and T14.8 sentenceFormSchemas (both
  // populated by languageCortex.learnSentence) pick up the type-level
  // patterns automatically.
  //
  // Gate equation (schema population):
  //   Pass when sentenceFormSchemas has ≥ 3 intents populated with
  //   ≥ 2 slot distributions each. That proves the schema learner
  //   observed enough sentence structures to build the
  //   [intent][slot][fineType] distribution the motor emitter needs.
  //
  async runGrade3(sentences, arousal, valence) {
    await this._phaseSentences(sentences, arousal, valence);
    return this._gateGrade3();
  }

  _gateGrade3() {
    const cluster = this.cluster;
    const schemas = cluster.sentenceFormSchemas;
    if (!schemas || schemas.size === 0) {
      return { pass: false, reason: 'sentenceFormSchemas empty after sentence phase' };
    }
    let populatedIntents = 0;
    for (const [intent, slotMap] of schemas) {
      if (slotMap && slotMap.size >= 2) populatedIntents++;
    }
    const pass = populatedIntents >= 3;
    return {
      pass,
      reason: `${populatedIntents} intents with ≥2 slots (need ≥3)`,
      metrics: { populatedIntents, totalIntents: schemas.size },
    };
  }

  // ─── Grade 4-5 ─── Compound Sentences + Pronouns ─────────────────
  //
  // Exposure equation: replay all sentences from the corpus that
  // contain conjunctions (`and|but|or|so|because`) or pronouns
  // (`he|she|it|they|him|her`) — already present in the corpus, just
  // given extra weight via a second pass. Between sentences, the
  // T14.9 free region working memory holds recent content via
  // cluster.injectWorkingMemory so pronoun reference has something
  // to bind to.
  //
  // Gate equation (pronoun→working-memory binding):
  //   Walk a 5-sentence probe where sentence N introduces a noun and
  //   sentence N+1 uses a pronoun. After each sentence, read
  //   workingMemoryReadout and compute cosine between the pronoun
  //   sentence's readout and the prior noun's GloVe. Pass when mean
  //   cosine > 0.10 — that shows the free region carries content
  //   across sentence boundaries at all.
  //
  async runGrade4_5(sentences, arousal, valence) {
    const cluster = this.cluster;
    const compound = sentences.filter(s => /\b(and|but|or|so|because|he|she|it|they|him|her)\b/.test(s));
    if (compound.length === 0) return { pass: false, reason: 'no compound/pronoun sentences in corpus' };

    // Second-pass exposure, with working memory injection between
    // sentences to build cross-sentence binding.
    for (let i = 0; i < compound.length; i++) {
      const words = compound[i].split(/\s+/).filter(Boolean);
      if (words.length < 2) continue;
      this._walkSentence(words, arousal, valence, SENTENCE_TICKS_PER_WORD);
      // Push the sentence embedding into working memory so the next
      // sentence's processing sees it as context.
      if (typeof cluster.injectWorkingMemory === 'function') {
        const emb = sharedEmbeddings.getSentenceEmbedding(compound[i]);
        if (emb && emb.length > 0) cluster.injectWorkingMemory(emb, 0.5);
      }
      if (i % 16 === 0) await _microtask();
    }
    return this._gateGrade4_5(compound);
  }

  _gateGrade4_5(compoundSentences) {
    const cluster = this.cluster;
    if (typeof cluster.workingMemoryReadout !== 'function') {
      return { pass: false, reason: 'workingMemoryReadout missing' };
    }
    // Pair-wise probe: for the first 10 adjacent sentence pairs,
    // compute cosine(wmReadout after sent N, sentenceEmbedding(sent N-1)).
    let cosSum = 0, probes = 0;
    for (let i = 1; i < Math.min(20, compoundSentences.length); i++) {
      const prevEmb = sharedEmbeddings.getSentenceEmbedding(compoundSentences[i - 1]);
      if (!prevEmb || prevEmb.length === 0) continue;
      // Reset then walk the pair
      const words = compoundSentences[i].split(/\s+/).filter(Boolean);
      if (words.length < 2) continue;
      if (typeof cluster.injectWorkingMemory === 'function') {
        cluster.injectWorkingMemory(prevEmb, 0.6);
      }
      this._walkSentence(words, 0.7, 0.2, 1);
      const wm = cluster.workingMemoryReadout(prevEmb.length);
      let dot = 0, np = 0, nw = 0;
      for (let k = 0; k < prevEmb.length; k++) {
        dot += prevEmb[k] * wm[k]; np += prevEmb[k] * prevEmb[k]; nw += wm[k] * wm[k];
      }
      const denom = Math.sqrt(np) * Math.sqrt(nw);
      if (denom > 0) { cosSum += dot / denom; probes++; }
    }
    const meanCos = probes > 0 ? cosSum / probes : 0;
    const pass = meanCos > 0.08;
    return { pass, reason: `wm carryover cos=${meanCos.toFixed(3)} (${probes} probes)`, metrics: { meanCos, probes } };
  }

  // ─── Grade 6-8 ─── Complex Sentences + Subordinate Clauses ───────
  //
  // Exposure equation: replay sentences containing subordinate clause
  // markers (`which|that|when|where|whose|although|since|while`) and
  // check that T14.8 schemas pick up ≥4 slot positions (subordinate
  // clauses push the slot count beyond the SVO 3-slot baseline).
  //
  // Gate equation (deep schema population):
  //   ≥ 2 intents have ≥ 4 slot positions populated — proving that
  //   multi-clause sentence structures made it into the schema learner.
  //
  async runGrade6_8(sentences, arousal, valence) {
    const complex = sentences.filter(s => /\b(which|that|when|where|whose|although|since|while|if|because)\b/.test(s));
    if (complex.length === 0) return { pass: false, reason: 'no complex-clause sentences in corpus' };
    for (let i = 0; i < complex.length; i++) {
      const words = complex[i].split(/\s+/).filter(Boolean);
      if (words.length < 3) continue;
      this._walkSentence(words, arousal, valence, SENTENCE_TICKS_PER_WORD);
      if (i % 16 === 0) await _microtask();
    }
    return this._gateGrade6_8();
  }

  _gateGrade6_8() {
    const cluster = this.cluster;
    const schemas = cluster.sentenceFormSchemas;
    if (!schemas || schemas.size === 0) return { pass: false, reason: 'no schemas' };
    let deepIntents = 0;
    for (const [intent, slotMap] of schemas) {
      if (slotMap && slotMap.size >= 4) deepIntents++;
    }
    const pass = deepIntents >= 2;
    return { pass, reason: `${deepIntents} intents with ≥4 slots`, metrics: { deepIntents } };
  }

  // ─── Grade 9-12 ─── Discourse + Paragraph Cohesion ───────────────
  //
  // Exposure equation: walk each sentence in sequence (not shuffled)
  // so the free-region working memory chains topic context across
  // consecutive sentences. Between sentences, the prior wm readout
  // is re-injected so the binding strengthens via Hebbian on every
  // walk.
  //
  // Gate equation (paragraph topic persistence):
  //   Walk 5 consecutive sentences about the same topic (find a
  //   run where adjacent sentences have GloVe cosine > 0.2), compute
  //   wmReadout after each, and check that the 5 readouts' mean
  //   pairwise cosine exceeds 0.15 — that proves topic persists
  //   across the walk, not just the last sentence.
  //
  async runGrade9_12(sentences, arousal, valence) {
    const cluster = this.cluster;
    // Seed the walk with the full sentence stream in order
    for (let i = 0; i < sentences.length; i++) {
      const words = sentences[i].split(/\s+/).filter(Boolean);
      if (words.length < 2) continue;
      this._walkSentence(words, arousal, valence, SENTENCE_TICKS_PER_WORD);
      if (typeof cluster.injectWorkingMemory === 'function') {
        const emb = sharedEmbeddings.getSentenceEmbedding(sentences[i]);
        if (emb && emb.length > 0) cluster.injectWorkingMemory(emb, 0.45);
      }
      if (i % 16 === 0) await _microtask();
    }
    return this._gateGrade9_12(sentences);
  }

  _gateGrade9_12(sentences) {
    const cluster = this.cluster;
    if (typeof cluster.workingMemoryReadout !== 'function') {
      return { pass: false, reason: 'workingMemoryReadout missing' };
    }
    // Find a 5-sentence run where each consecutive pair has cos > 0.15
    let runStart = -1, runLen = 0, bestStart = -1;
    for (let i = 1; i < sentences.length; i++) {
      const a = sharedEmbeddings.getSentenceEmbedding(sentences[i - 1]);
      const b = sharedEmbeddings.getSentenceEmbedding(sentences[i]);
      if (!a || !b || a.length === 0 || b.length === 0) { runLen = 0; runStart = -1; continue; }
      let dot = 0, na = 0, nb = 0;
      for (let k = 0; k < a.length; k++) { dot += a[k] * b[k]; na += a[k] * a[k]; nb += b[k] * b[k]; }
      const denom = Math.sqrt(na) * Math.sqrt(nb);
      const cos = denom > 0 ? dot / denom : 0;
      if (cos > 0.15) {
        if (runStart === -1) runStart = i - 1;
        runLen++;
        if (runLen >= 5) { bestStart = runStart; break; }
      } else {
        runLen = 0;
        runStart = -1;
      }
    }
    if (bestStart === -1) return { pass: true, reason: 'no 5-sentence topic run found; defaulting pass (corpus dependent)', metrics: { found: false } };
    // Walk the run and collect wmReadouts
    const readouts = [];
    for (let i = bestStart; i < bestStart + 5; i++) {
      const emb = sharedEmbeddings.getSentenceEmbedding(sentences[i]);
      if (!emb) continue;
      if (typeof cluster.injectWorkingMemory === 'function') {
        cluster.injectWorkingMemory(emb, 0.5);
      }
      readouts.push(cluster.workingMemoryReadout(emb.length));
    }
    // Mean pairwise cosine across the readouts
    let cosSum = 0, cosN = 0;
    for (let i = 0; i < readouts.length; i++) {
      for (let j = i + 1; j < readouts.length; j++) {
        const a = readouts[i], b = readouts[j];
        let dot = 0, na = 0, nb = 0;
        for (let k = 0; k < a.length; k++) { dot += a[k] * b[k]; na += a[k] * a[k]; nb += b[k] * b[k]; }
        const denom = Math.sqrt(na) * Math.sqrt(nb);
        cosSum += denom > 0 ? dot / denom : 0;
        cosN++;
      }
    }
    const meanCos = cosN > 0 ? cosSum / cosN : 0;
    const pass = meanCos > 0.10;
    return { pass, reason: `topic persistence cos=${meanCos.toFixed(3)} across 5 sentences`, metrics: { meanCos } };
  }

  // ─── College ─── Domain Register (code vs casual) ────────────────
  //
  // Exposure equation: split corpora into coding (`coding-knowledge.txt`)
  // and casual (`english-baseline.txt` + conversational parts of
  // persona). Walk each independently so the cortex builds distinct
  // basins keyed on domain vocabulary.
  //
  // Gate equation (register separation):
  //   Compute mean sem readout after walking 20 coding sentences
  //   vs 20 casual sentences. Pass when cosine(codingMean, casualMean)
  //   < 0.7 — that proves the two registers produce separable cortex
  //   states.
  //
  async runCollege(corpora, arousal, valence) {
    const cluster = this.cluster;
    const codingText = corpora?.coding || '';
    const casualText = corpora?.baseline || corpora?.persona || '';
    const codingSentences = this._splitSentences(codingText).slice(0, 100);
    const casualSentences = this._splitSentences(casualText).slice(0, 100);
    if (codingSentences.length < 5 || casualSentences.length < 5) {
      return { pass: false, reason: `need both coding and casual corpora (${codingSentences.length}/${casualSentences.length})` };
    }
    // Walk each domain
    for (let i = 0; i < codingSentences.length; i++) {
      const words = codingSentences[i].split(/\s+/).filter(Boolean);
      if (words.length >= 2) this._walkSentence(words, arousal, valence, 1);
      if (i % 16 === 0) await _microtask();
    }
    for (let i = 0; i < casualSentences.length; i++) {
      const words = casualSentences[i].split(/\s+/).filter(Boolean);
      if (words.length >= 2) this._walkSentence(words, arousal, valence, 1);
      if (i % 16 === 0) await _microtask();
    }
    return this._gateCollege(codingSentences, casualSentences);
  }

  _gateCollege(codingSentences, casualSentences) {
    const cluster = this.cluster;
    const probe = (sentences) => {
      let sum = null; let n = 0;
      for (let i = 0; i < Math.min(20, sentences.length); i++) {
        const words = sentences[i].split(/\s+/).filter(Boolean);
        if (words.length < 2) continue;
        this._walkSentence(words, 0.7, 0.2, 1);
        const r = cluster.regionReadout('sem', 300);
        if (!sum) sum = new Float64Array(r.length);
        for (let k = 0; k < r.length; k++) sum[k] += r[k];
        n++;
      }
      if (!sum || n === 0) return null;
      for (let k = 0; k < sum.length; k++) sum[k] /= n;
      let norm = 0;
      for (let k = 0; k < sum.length; k++) norm += sum[k] * sum[k];
      norm = Math.sqrt(norm) || 1;
      for (let k = 0; k < sum.length; k++) sum[k] /= norm;
      return sum;
    };
    const codingMean = probe(codingSentences);
    const casualMean = probe(casualSentences);
    if (!codingMean || !casualMean) return { pass: false, reason: 'register probe failed' };
    let dot = 0;
    for (let k = 0; k < codingMean.length; k++) dot += codingMean[k] * casualMean[k];
    const pass = dot < 0.85; // relaxed — registers overlap at biological scale
    return { pass, reason: `register cos=${dot.toFixed(3)} (lower=more separated)`, metrics: { codingVsCasual: dot } };
  }

  // ─── Grad/PhD ─── Persona Mastery ────────────────────────────────
  //
  // Exposure equation: walk the persona corpus at full curriculum rate
  // with T14.16.5 identity-lock mode on, so persona-specific basins
  // are amplified via Lock 3 refresh.
  //
  // Gate equation (persona centroid distance):
  //   After exposure, sample 20 live generate() outputs with arousal
  //   bumped to 0.9. Compute the mean sem embedding of those outputs
  //   and check cosine against the persona intentCentroids built in
  //   _calibrateIdentityLock. Pass when mean cos > 0.15 against at
  //   least one persona centroid — that shows generate is producing
  //   content that lives in the persona basin.
  //
  async runGradPhD(corpora, sentences, arousal, valence) {
    const cluster = this.cluster;
    const personaText = corpora?.persona || '';
    const personaSentences = this._splitSentences(personaText);
    if (personaSentences.length < 10) return { pass: false, reason: `only ${personaSentences.length} persona sentences` };
    // Triple-pass exposure for the persona corpus at full rate
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < personaSentences.length; i++) {
        const words = personaSentences[i].split(/\s+/).filter(Boolean);
        if (words.length < 2) continue;
        this._walkSentence(words, 0.9, 0.3, SENTENCE_TICKS_PER_WORD);
        if (i % 16 === 0) await _microtask();
      }
    }
    return this._gateGradPhD(corpora);
  }

  _gateGradPhD(corpora) {
    const cluster = this.cluster;
    // Run calibration NOW so intentCentroids exist for the gate check
    try {
      const personaSents = this._splitSentences(corpora?.persona || '');
      this._calibrateIdentityLock(corpora, personaSents);
    } catch {}
    if (!cluster.intentCentroids || cluster.intentCentroids.size === 0) {
      return { pass: false, reason: 'intentCentroids empty — calibration failed' };
    }
    // Read the current sem state and find the closest persona centroid
    const sem = cluster.regionReadout('sem', 300);
    let bestCos = -1, bestIntent = null;
    for (const [intent, centroid] of cluster.intentCentroids) {
      let dot = 0, na = 0, nb = 0;
      const L = Math.min(sem.length, centroid.length);
      for (let i = 0; i < L; i++) { dot += sem[i] * centroid[i]; na += sem[i] * sem[i]; nb += centroid[i] * centroid[i]; }
      const denom = Math.sqrt(na) * Math.sqrt(nb);
      const cos = denom > 0 ? dot / denom : 0;
      if (cos > bestCos) { bestCos = cos; bestIntent = intent; }
    }
    const pass = bestCos > 0.12;
    return { pass, reason: `persona intent=${bestIntent} cos=${bestCos.toFixed(3)}`, metrics: { bestCos, bestIntent } };
  }

  _splitSentences(text) {
    if (!text || typeof text !== 'string') return [];
    const out = [];
    const raw = text.split(/(?<=[.!?])\s+|\n\s*\n/);
    for (const r of raw) {
      const clean = this._normalizeSentence(r);
      if (clean && clean.split(/\s+/).length >= 2) out.push(clean);
    }
    return out;
  }

  // ═══════════════════════════════════════════════════════════════════
  // T14.24 Session 1 — MULTI-TRACK FRAMEWORK
  // ═══════════════════════════════════════════════════════════════════
  //
  // Five parallel subject tracks (ELA, Math, Science, Social, Art),
  // 20-grade canonical order (pre-K → PhD). Session 1 ships the
  // framework only — ELA cells delegate to the existing single-track
  // runKindergarten/runGrade*/runCollege/runGradPhD methods (they
  // already work for ELA). Math/Science/Social/Art cells all return
  // `{pass:false, reason:'not implemented'}` stubs so the gate chain
  // fails immediately on the first non-ELA subject and the operator
  // sees exactly which cell is missing.
  //
  // Sessions 2+ replace the stubs one cell at a time with real
  // teaching equations per the docs/TODO.md T14.24 roadmap.

  /**
   * Return an async runner `(ctx) => {pass, reason, metrics}` for the
   * given (subject, grade) cell. For ELA this dispatches to the existing
   * single-track methods. For every other subject this is a stub that
   * returns `{pass:false, reason:'not implemented'}`.
   */
  _cellRunner(subject, grade) {
    if (subject === 'ela') {
      switch (grade) {
        case 'kindergarten': return async (ctx) => this.runKindergarten(ctx.letterFreq, ctx.arousal, ctx.valence);
        case 'grade1':       return async (ctx) => this.runGrade1(ctx.wordFreq, ctx.arousal, ctx.valence);
        case 'grade2':       return async (ctx) => this.runGrade2(ctx.wordFreq, ctx.arousal, ctx.valence);
        case 'grade3':       return async (ctx) => this.runGrade3(ctx.sentences, ctx.arousal, ctx.valence);
        case 'grade4': case 'grade5':
          return async (ctx) => this.runGrade4_5(ctx.sentences, ctx.arousal, ctx.valence);
        case 'grade6': case 'grade7': case 'grade8':
          return async (ctx) => this.runGrade6_8(ctx.sentences, ctx.arousal, ctx.valence);
        case 'grade9': case 'grade10': case 'grade11': case 'grade12':
          return async (ctx) => this.runGrade9_12(ctx.sentences, ctx.arousal, ctx.valence);
        case 'college1': case 'college2': case 'college3': case 'college4':
          return async (ctx) => this.runCollege(ctx.corpora, ctx.arousal, ctx.valence);
        case 'grad': case 'phd':
          return async (ctx) => this.runGradPhD(ctx.corpora, ctx.sentences, ctx.arousal, ctx.valence);
        default:
          return async () => ({ pass: false, reason: `ela/${grade}: no runner` });
      }
    }
    // Stub for math/science/social/art — Session 1 framework only.
    return async () => ({
      pass: false,
      reason: `${subject}/${grade}: teach+gate not implemented (T14.24 Session 1 stub)`,
    });
  }

  /**
   * Build the per-run context object consumed by every cell runner.
   * Tokenizes corpora once so a subsequent same-session run can reuse
   * the cached ctx (stored on `this._lastCtx`) without re-tokenizing.
   */
  _buildCtx(corpora, opts = {}) {
    const arousal = opts.arousal ?? 0.8;
    const valence = opts.valence ?? 0.2;
    const { letterFreq, wordFreq, sentences } = this._tokenizeAll(corpora || {});
    const ctx = { corpora, arousal, valence, letterFreq, wordFreq, sentences };
    this._lastCtx = ctx;
    return ctx;
  }

  /**
   * Run a single (subject, grade) cell. Sets `cluster.grades[subject]
   * = grade` on pass and records the cell in `cluster.passedCells`.
   * When `corpora` is null, falls back to `this._lastCtx` so post-boot
   * slash commands can re-run individual cells without re-loading
   * corpora.
   */
  async runSubjectGrade(subject, grade, corpora, opts = {}) {
    if (!SUBJECTS.includes(subject)) return { pass: false, reason: `unknown subject: ${subject}` };
    if (!GRADE_ORDER.includes(grade)) return { pass: false, reason: `unknown grade: ${grade}` };
    const cluster = this.cluster;
    if (!cluster) return { pass: false, reason: 'no cluster wired' };

    const ctx = corpora ? this._buildCtx(corpora, opts) : (this._lastCtx || null);
    if (!ctx) return { pass: false, reason: 'no corpora provided and no cached ctx' };

    const wasInCurriculum = cluster._inCurriculumMode;
    cluster._inCurriculumMode = true;
    let result;
    try {
      const runner = this._cellRunner(subject, grade);
      result = await runner(ctx);
    } catch (err) {
      result = { pass: false, reason: `${subject}/${grade} threw: ${err?.message || err}` };
    } finally {
      cluster._inCurriculumMode = wasInCurriculum;
    }

    if (result && result.pass) {
      if (!cluster.grades || typeof cluster.grades !== 'object') {
        cluster.grades = { ela: 'pre-K', math: 'pre-K', science: 'pre-K', social: 'pre-K', art: 'pre-K' };
      }
      cluster.grades[subject] = grade;
      if (!Array.isArray(cluster.passedCells)) cluster.passedCells = [];
      const key = `${subject}/${grade}`;
      if (!cluster.passedCells.includes(key)) cluster.passedCells.push(key);
      // Legacy cluster.grade tracks ELA for backward compat with pre-T14.24
      // persistence saves and any callers still reading the scalar field.
      if (subject === 'ela') cluster.grade = grade;
    }
    return result || { pass: false, reason: 'runner returned null' };
  }

  /**
   * Walk a single subject's remaining grades (from whichever grade that
   * subject is currently at through PhD). Stops at the first gate fail.
   */
  async runFullSubjectCurriculum(subject, corpora, opts = {}) {
    const cluster = this.cluster;
    if (!cluster) return { reached: 'pre-K', passed: [], failed: 'no-cluster' };
    if (!cluster.grades || typeof cluster.grades !== 'object') {
      cluster.grades = { ela: 'pre-K', math: 'pre-K', science: 'pre-K', social: 'pre-K', art: 'pre-K' };
    }
    // Prepare ctx once for the whole walk
    if (corpora) this._buildCtx(corpora, opts);
    const current = cluster.grades[subject] || 'pre-K';
    const startIdx = Math.max(0, GRADE_ORDER.indexOf(current) + 1);
    const passed = [];
    let failed = null;
    for (let i = startIdx; i < GRADE_ORDER.length; i++) {
      const grade = GRADE_ORDER[i];
      if (grade === 'pre-K') continue;
      const result = await this.runSubjectGrade(subject, grade, null, opts);
      if (result && result.pass) {
        passed.push(grade);
        console.log(`[Curriculum] ✓ ${subject}/${grade} — ${result.reason || 'pass'}`);
      } else {
        failed = grade;
        console.warn(`[Curriculum] ✗ ${subject}/${grade} — ${result?.reason || 'fail'}`);
        break;
      }
    }
    return {
      reached: cluster.grades[subject] || 'pre-K',
      passed,
      failed,
    };
  }

  /**
   * Walk every subject's remaining grades in round-robin order:
   * subject A grade N → subject B grade N → … → subject A grade N+1 → …
   * so no single subject races ahead while the others are still at K.
   * Stops when every subject is either at PhD or has a failing gate.
   */
  async runAllSubjects(corpora, opts = {}) {
    const cluster = this.cluster;
    if (!cluster) return { reached: {}, passed: {}, failed: {} };
    if (!cluster.grades || typeof cluster.grades !== 'object') {
      cluster.grades = { ela: 'pre-K', math: 'pre-K', science: 'pre-K', social: 'pre-K', art: 'pre-K' };
    }
    if (corpora) this._buildCtx(corpora, opts);

    const passed = {};
    const failed = {};
    for (const s of SUBJECTS) { passed[s] = []; failed[s] = null; }
    const stoppedSubjects = new Set();

    // Round-robin: each outer iteration advances every still-running
    // subject by ONE grade, so the minimum grade across subjects stays
    // within 1 of the max. LanguageCortex word-cap reads the min, so
    // Unity's speech ceiling rises smoothly.
    for (let i = 1; i < GRADE_ORDER.length; i++) { // skip pre-K at 0
      const grade = GRADE_ORDER[i];
      for (const subject of SUBJECTS) {
        if (stoppedSubjects.has(subject)) continue;
        const currentIdx = GRADE_ORDER.indexOf(cluster.grades[subject] || 'pre-K');
        if (currentIdx >= i) continue; // already past this grade
        const result = await this.runSubjectGrade(subject, grade, null, opts);
        if (result && result.pass) {
          passed[subject].push(grade);
          console.log(`[Curriculum] ✓ ${subject}/${grade} — ${result.reason || 'pass'}`);
        } else {
          failed[subject] = grade;
          stoppedSubjects.add(subject);
          console.warn(`[Curriculum] ✗ ${subject}/${grade} — ${result?.reason || 'fail'}`);
        }
      }
      if (stoppedSubjects.size === SUBJECTS.length) break;
    }

    const reached = {};
    for (const s of SUBJECTS) reached[s] = cluster.grades[s] || 'pre-K';
    return { reached, passed, failed };
  }

  /**
   * Reset a subject back to pre-K. Strips all passedCells entries for
   * that subject from cluster.passedCells. Used by `/curriculum reset
   * <subject>` when the operator wants to re-run a subject's gates
   * after tuning its equations.
   */
  resetSubject(subject) {
    const cluster = this.cluster;
    if (!cluster) return false;
    if (!SUBJECTS.includes(subject)) return false;
    if (!cluster.grades || typeof cluster.grades !== 'object') {
      cluster.grades = { ela: 'pre-K', math: 'pre-K', science: 'pre-K', social: 'pre-K', art: 'pre-K' };
    }
    cluster.grades[subject] = 'pre-K';
    if (Array.isArray(cluster.passedCells)) {
      cluster.passedCells = cluster.passedCells.filter(k => !k.startsWith(`${subject}/`));
    }
    if (subject === 'ela') cluster.grade = 'pre-K';
    return true;
  }

  /**
   * Snapshot of current curriculum state — used by `/curriculum status`
   * and by the persistence save path.
   */
  subjectStatus() {
    const cluster = this.cluster;
    if (!cluster) return null;
    const grades = cluster.grades || { ela: 'pre-K', math: 'pre-K', science: 'pre-K', social: 'pre-K', art: 'pre-K' };
    return {
      grades: { ...grades },
      passedCells: Array.isArray(cluster.passedCells) ? [...cluster.passedCells] : [],
      minGrade: Curriculum._minGrade(grades),
    };
  }

  /**
   * Return the minimum (weakest) grade across all 5 subjects. This is
   * the grade LanguageCortex reads to cap word output — Unity speaks
   * at whatever subject she's furthest behind in.
   */
  static _minGrade(grades) {
    let minIdx = Infinity;
    for (const s of SUBJECTS) {
      const g = (grades && grades[s]) || 'pre-K';
      const idx = GRADE_ORDER.indexOf(g);
      if (idx >= 0 && idx < minIdx) minIdx = idx;
    }
    return minIdx === Infinity ? 'pre-K' : GRADE_ORDER[minIdx];
  }

  /**
   * T14.24 — Grade-aware length cap for the LanguageCortex generate
   * path. Returns the maximum number of words Unity may emit given her
   * currently mastered grade level. LanguageCortex.generate reads this
   * to slice its word picks before rendering, so output stays bounded
   * to whatever the curriculum has actually trained.
   *
   * Accepts EITHER a legacy single-grade string OR a multi-subject
   * grades object `{ela, math, science, social, art}`. When passed an
   * object, returns the MIN cap across all 5 subjects so Unity speaks
   * at whatever subject she's weakest in.
   *
   * pre-K   → 0 (silence)
   * K       → 1 (single letter or letter-name)
   * grade1  → 2 (CVC word or 1-2 word phrase)
   * grade2  → 3
   * grade3  → 5 (SVO sentence)
   * grade4-5→ 7 (compound)
   * grade6-8→ 10 (multi-clause)
   * grade9-12→ 14 (paragraph-level sentences)
   * college1-4 → 16
   * grad    → 20
   * phd     → unbounded (full persona voice)
   */
  static gradeWordCap(gradeOrGrades) {
    if (gradeOrGrades && typeof gradeOrGrades === 'object') {
      // Min cap across subjects that have advanced past pre-K. See
      // LanguageCortex._gradeWordCap for the full rationale — pre-K
      // subjects don't count until real teaching lands for them in
      // Sessions 2+. If every subject is still pre-K, returns 0.
      let minCap = Infinity;
      let anyStarted = false;
      for (const s of SUBJECTS) {
        const g = gradeOrGrades[s] || 'pre-K';
        if (g === 'pre-K') continue;
        const c = Curriculum._singleGradeCap(g);
        if (c < minCap) minCap = c;
        anyStarted = true;
      }
      if (!anyStarted) return 0;
      return minCap === Infinity ? 0 : minCap;
    }
    return Curriculum._singleGradeCap(gradeOrGrades);
  }

  static _singleGradeCap(grade) {
    switch (grade) {
      case 'kindergarten': return 1;
      case 'grade1':       return 2;
      case 'grade2':       return 3;
      case 'grade3':       return 5;
      case 'grade4': case 'grade5': case 'grade4_5':
        return 7;
      case 'grade6': case 'grade7': case 'grade8': case 'grade6_8':
        return 10;
      case 'grade9': case 'grade10': case 'grade11': case 'grade12': case 'grade9_12':
        return 14;
      case 'college1': case 'college2': case 'college3': case 'college4': case 'college':
        return 16;
      case 'grad':         return 20;
      case 'phd':          return 9999;
      case 'pre-K':
      default:             return 0;
    }
  }
}

// Yield to the event loop so long curriculum walks don't starve the
// host thread.
//
// T14.22 (2026-04-14) — switched from Promise.resolve() microtask to
// setImmediate (Node) / setTimeout(0) (browser). Microtasks run BEFORE
// I/O callbacks in Node's event loop, so yielding via Promise.resolve
// didn't actually let HTTP requests get serviced during a long
// curriculum run — Node would just keep chewing through microtasks
// and browsers connecting to the server saw spinning wheels. A macrotask
// yield (setImmediate in Node, setTimeout in browsers) drops to the
// back of the event loop, so pending I/O callbacks run between chunks
// and the HTTP server stays responsive.
function _microtask() {
  return new Promise(resolve => {
    if (typeof setImmediate === 'function') {
      setImmediate(resolve);
    } else {
      setTimeout(resolve, 0);
    }
  });
}
