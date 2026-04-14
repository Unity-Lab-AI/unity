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
