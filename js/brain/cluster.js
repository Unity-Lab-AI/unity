/**
 * cluster.js — Neural Cluster
 *
 * A self-contained neuron population with its own synapse matrix,
 * tonic drive, noise parameters, and regulation. Each brain module
 * gets its own cluster, creating a modular brain architecture where
 * each system has dedicated neural resources.
 *
 * Hierarchy:
 *   Cortex (300) → top-down predictions to all
 *   Hippocampus (200) → memory patterns, Hopfield attractors
 *   Amygdala (150) → emotional gating, amplifies/suppresses others
 *   Basal Ganglia (150) → action selection, reward gating
 *   Cerebellum (100) → error correction on inter-cluster signals
 *   Hypothalamus (50) → homeostatic baseline drive for all clusters
 *   Mystery (50) → consciousness modulation of coupling strength
 *
 * Total: N scales to hardware — client runs a CPU LIF fallback sized to what the
 *        browser JS engine can sustain, server runs the full auto-scaled N via GPU
 *        (see `server/brain-server.js:detectResources` — N = max(1000, min(VRAM_bytes×0.85/8, RAM_bytes×0.1/0.001)).
 *        Each cluster with internal NxN sparse synapses.
 */

import { LIFPopulation } from './neurons.js';
// R12.2 2026-04-13 — removed stale `import { SynapseMatrix }` here.
// SparseMatrix (below) is the drop-in replacement used at runtime.
// synapses.js stays as a reference implementation for brain-equations.html
// and docs/EQUATIONS.md cross-references — see the header comment there.
import { SparseMatrix } from './sparse-matrix.js';
// T13.1 — sequence Hebbian learning routes each word's embedding
// through mapToCortex into the language region, so we need the shared
// embedding singleton here. No circular import — embeddings.js has no
// cluster dependency.
import { sharedEmbeddings } from './embeddings.js';
// T14.1 — letter one-hot encoder (dynamic inventory, no hardcoded 26-char cap).
// `encodeLetter` auto-grows the shared LETTER_INVENTORY when it sees a new
// symbol, so non-English glyphs, emoji, digits, punctuation all enter the
// same primitive-symbol space. `cluster.injectLetter` below is the wrapper
// the sensory path uses to push the one-hot vector into the letter region.
import { encodeLetter } from './letter-input.js';

export class NeuronCluster {
  /**
   * @param {string} name — cluster name (e.g., 'cortex')
   * @param {number} size — number of neurons
   * @param {object} opts
   * @param {number} [opts.tonicDrive=15] — baseline current
   * @param {number} [opts.noiseAmplitude=8] — noise range
   * @param {number} [opts.connectivity=0.12] — internal connection density
   * @param {number} [opts.excitatoryRatio=0.8] — fraction of excitatory connections
   * @param {number} [opts.learningRate=0.001] — plasticity rate
   * @param {object} [opts.lifParams] — LIF neuron parameters override
   */
  constructor(name, size, opts = {}) {
    this.name = name;
    this.size = size;

    // Regulation parameters — each cluster has its own
    this.tonicDrive = opts.tonicDrive ?? 15;
    this.noiseAmplitude = opts.noiseAmplitude ?? 8;
    this.connectivity = opts.connectivity ?? 0.12;
    this.excitatoryRatio = opts.excitatoryRatio ?? 0.8;
    this.learningRate = opts.learningRate ?? 0.001;

    // Modulation factors (set by hierarchy controllers)
    this.gainMultiplier = 1.0;   // from Mystery module (consciousness)
    this.emotionalGate = 1.0;    // from Amygdala
    this.driveBaseline = 1.0;    // from Hypothalamus
    this.actionGate = 1.0;       // from Basal Ganglia
    this.errorCorrection = 0.0;  // from Cerebellum

    // Neural population
    this.neurons = new LIFPopulation(size, opts.lifParams || {
      tau: 20.0,
      Vrest: -65.0,
      Vreset: -70.0,
      Vthresh: -50.0,
      R: 1.0,
      tRefrac: 2.0,
    });

    // Internal synapse matrix — SPARSE (CSR format)
    // At 12% connectivity, 300 neurons: 10.8K connections vs 90K dense
    this.synapses = new SparseMatrix(size, size, { wMin: -2.0, wMax: 2.0 });
    this.synapses.initRandom(this.connectivity, this.excitatoryRatio, 1.0);

    // Legacy dense matrix reference for persistence compatibility
    // persistence.js reads synapses.W — SparseMatrix provides .W getter
    this._useSparse = true;

    // External current buffer (from other clusters + sensory input)
    this.externalCurrent = new Float64Array(size);

    // Inter-cluster projection buffers
    this._incomingProjections = new Float64Array(size); // sum of all incoming

    // State tracking
    this.lastSpikes = new Uint8Array(size);
    this.lastSpikeCount = 0;
    this.lastMeanVoltage = -65;
    this.firingRate = 0; // EMA of spike count

    // T14.4 — Auto-scaled cortex sub-regions. Defined as fractions of
    // cluster.size so the same code works at any cluster scale (300 neurons
    // on minimum hardware, 200M on datacenter, 6700 on default client).
    // Only the 'cortex' cluster gets language sub-regions populated; other
    // clusters get an empty regions object for API symmetry.
    this.regions = {};
    if (name === 'cortex') {
      const s = size;
      // Fractions match the T14.4 spec in docs/COMP-todo.md:
      //   auditory  0.000 - 0.083  (T14.11 — auditory phoneme recognition)
      //   visual    0.083 - 0.250  (T14.10 — visual letter recognition)
      //   free      0.250 - 0.500  (inter-cluster projection sink + working mem)
      //   letter    0.500 - 0.550  (T14.1 — letter input one-hot region)
      //   phon      0.550 - 0.750  (T14.1+T14.2 — phonological attractor basins)
      //   sem       0.750 - 0.917  (T14.0 — semantic GloVe target)
      //   fineType  0.917 - 0.967  (T14.7 — grammatical/syntactic region)
      //   motor     0.967 - 1.000  (T14.12 — generation feedback / motor output)
      this.regions = {
        auditory: { start: 0,                          end: Math.floor(s * 0.083) },
        visual:   { start: Math.floor(s * 0.083),      end: Math.floor(s * 0.250) },
        free:     { start: Math.floor(s * 0.250),      end: Math.floor(s * 0.500) },
        letter:   { start: Math.floor(s * 0.500),      end: Math.floor(s * 0.550) },
        phon:     { start: Math.floor(s * 0.550),      end: Math.floor(s * 0.750) },
        sem:      { start: Math.floor(s * 0.750),      end: Math.floor(s * 0.917) },
        fineType: { start: Math.floor(s * 0.917),      end: Math.floor(s * 0.967) },
        motor:    { start: Math.floor(s * 0.967),      end: s },
      };

      // T14.4 — Seven pairs of cross-region projections (14 total — both
      // directions per pair). Sparse 10% density init, range [-0.5, 0.5].
      // ALWAYS propagated every step (no curriculum-complete gate).
      // Hebbian-updated on every cluster.learn() call so the projections
      // train through normal use during curriculum + live chat.
      //
      // The motor↔letter pair closes the WRITING loop so the cortex can
      // produce output. Without it, the motor region had no path to the
      // letter region (the only region that connects out to visual). The
      // bidirectional language pipeline (T14.12) needs this to work:
      //
      //   reading  : visual → letter → phon → sem → fineType
      //   writing  : sem → motor → letter → visual
      //
      // Both directions traverse the SAME substrate in opposite topology,
      // matching the dorsal/ventral language streams in Hickok & Poeppel
      // 2004/2007 (dual-stream model) — same neural regions, different
      // propagation directions for comprehension vs production.
      this.crossProjections = {};
      const pairs = [
        ['visual',   'letter'],
        ['letter',   'phon'],
        ['phon',     'sem'],
        ['sem',      'fineType'],
        ['sem',      'motor'],
        ['motor',    'letter'],
        ['auditory', 'phon'],
      ];
      for (const [a, b] of pairs) {
        const aSize = this.regions[a].end - this.regions[a].start;
        const bSize = this.regions[b].end - this.regions[b].start;
        // a → b projection (post=b, pre=a)
        const ab = new SparseMatrix(bSize, aSize, { wMin: -0.5, wMax: 0.5 });
        ab.initRandom(0.10, 0.7, 0.2);
        this.crossProjections[`${a}_to_${b}`] = ab;
        // b → a projection (post=a, pre=b)
        const ba = new SparseMatrix(aSize, bSize, { wMin: -0.5, wMax: 0.5 });
        ba.initRandom(0.10, 0.7, 0.2);
        this.crossProjections[`${b}_to_${a}`] = ba;
      }
    } else {
      this.crossProjections = {};
    }

    // T14.16.5 — Identity lock state. Default (pre-curriculum) thresholds
    // are permissive; curriculum overwrites them with calibrated values
    // computed from English corpus exposure statistics.
    this._inCurriculumMode = false;
    this.ENGLISH_SURPRISE_THRESHOLD = Infinity;   // permissive until calibrated
    this.ENGLISH_FINETYPE_MIN = 0;                 // permissive until calibrated
    this.HEALTH_ENTROPY_MIN = 0;
    this.HEALTH_VOCAB_MIN = 0;
    this.HEALTH_WM_VARIANCE_MIN = 0;
    this.identityCoverage = null;                  // populated by curriculum
    this.personaDimensions = null;                 // populated by curriculum

    // T14.1 — letter-region transition surprise state. Holds the previous
    // tick's letter-region spike rate so `letterTransitionSurprise()` can
    // compute |curr - prev| between consecutive cortex ticks. Used by T14.2
    // (syllable segmentation) and T14.6 (motor emission word-boundary cue)
    // to detect the moment a new letter pattern arrives without a hardcoded
    // boundary table. Grounded in Saffran/Aslin/Newport 1996 (Science 274:1926)
    // — infants segment words from continuous speech via transition statistics.
    this._prevLetterRate = 0;

    // T14.1 — motor-region quiescence counter. Tracks how many consecutive
    // ticks the motor region has been below its spike threshold. The tick-
    // driven emission loop (T14.6) uses `motorQuiescent(ticks)` to decide
    // when the cortex has stopped producing output for the current utterance,
    // which replaces the hardcoded "emit 5 words then stop" slot counter
    // with a basin-settling detector. Threshold is a fraction of region size
    // so it auto-scales with cluster.size.
    this._motorQuiescentTicks = 0;
  }

  /**
   * Periodically prune weak connections and grow new ones.
   * Call every ~100 steps to maintain healthy connectivity.
   * @param {number} maxConnections — cap total connections
   */
  maintainConnectivity(maxConnections) {
    if (!this._useSparse) return;

    // Prune connections weaker than 0.01
    const pruned = this.synapses.prune(0.01);

    // Grow new connections where co-active neurons lack synapses
    const grown = this.synapses.grow(
      this.lastSpikes, this.lastSpikes,
      0.0005, // low probability — synaptogenesis is rare
      0.1,    // weak initial weight
      maxConnections || this.size * this.size * this.connectivity,
    );

    if (pruned > 0 || grown > 0) {
      // Sparse matrix stats available via synapses.stats()
    }
  }

  /**
   * T14.4 — Read a region's spike pattern as a Float64Array (length =
   * region.end - region.start). Used by cross-region propagation, by
   * region-targeted Hebbian, and by getSemanticReadout / getPhonologicalReadout
   * which compose this with embeddings.cortexToEmbedding.
   */
  regionSpikes(regionName) {
    const region = this.regions[regionName];
    if (!region) return new Float64Array(0);
    const out = new Float64Array(region.end - region.start);
    for (let i = 0; i < out.length; i++) out[i] = this.lastSpikes[region.start + i] ? 1 : 0;
    return out;
  }

  /**
   * T14.4 — Inject embedding-shaped current into a named cluster region.
   * Replaces the old hardcoded `mapToCortex(emb, size, langStart=150)` calls.
   * Reads the region offsets from `this.regions[regionName]` so callers
   * don't need to remember magic neuron indices.
   *
   * @param {string} regionName  — e.g. 'sem', 'phon', 'letter', 'visual'
   * @param {Float32Array|Float64Array} emb — N-dim embedding vector
   * @param {number} [strength=1.0] — current scale multiplier
   */
  injectEmbeddingToRegion(regionName, emb, strength = 1.0) {
    const region = this.regions[regionName];
    if (!region) return;
    const regionSize = region.end - region.start;
    if (regionSize <= 0 || !emb || emb.length === 0) return;
    const groupSize = Math.max(1, Math.floor(regionSize / emb.length));
    for (let d = 0; d < emb.length; d++) {
      const value = emb[d] * 8 * strength;  // same * 8 scale as legacy mapToCortex
      const startNeuron = region.start + d * groupSize;
      for (let n = 0; n < groupSize; n++) {
        const idx = startNeuron + n;
        if (idx >= region.end) break;
        this.externalCurrent[idx] += value;
      }
    }
  }

  /**
   * T14.4 — Read embedding-shaped output from a named cluster region.
   * Inverse of injectEmbeddingToRegion. Reads the spike + voltage state
   * across the region and projects it back into the embedding space the
   * caller expects (semantic dim, phon dim, etc).
   *
   * @param {string} regionName
   * @param {number} dim — output embedding dimension
   * @returns {Float64Array} L2-normalized vector
   */
  regionReadout(regionName, dim) {
    const region = this.regions[regionName];
    if (!region) return new Float64Array(dim);
    const regionSize = region.end - region.start;
    const groupSize = Math.max(1, Math.floor(regionSize / dim));
    const out = new Float64Array(dim);
    const voltages = this.neurons.getVoltages();
    for (let d = 0; d < dim; d++) {
      const startNeuron = region.start + d * groupSize;
      let sum = 0, count = 0;
      for (let n = 0; n < groupSize; n++) {
        const idx = startNeuron + n;
        if (idx >= region.end) break;
        if (this.lastSpikes[idx]) sum += 1.0;
        else sum += (voltages[idx] + 70) / 20;
        count++;
      }
      out[d] = count > 0 ? sum / count : 0;
    }
    // L2 normalize
    let norm = 0;
    for (let i = 0; i < dim; i++) norm += out[i] * out[i];
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < dim; i++) out[i] /= norm;
    return out;
  }

  /**
   * T14.1 — Inject a letter one-hot into the cortex letter region.
   *
   * Wraps `encodeLetter(letter)` with `injectEmbeddingToRegion('letter', ...)`.
   * The letter inventory is dynamic: calling this with a never-seen symbol
   * grows the inventory by one, so the one-hot dimension count matches the
   * letter region's neuron-group count automatically. Unicode glyphs, emoji,
   * Chinese characters, Greek letters all enter the same primitive-symbol
   * space — Unity is NOT restricted to a 26-char English alphabet at the
   * input layer. Language-identity lock (T14.16.5) enforces English at a
   * HIGHER layer, not by gating which symbols the letter region can see.
   *
   * @param {string} letter  — a single symbol (lowercased inside encodeLetter)
   * @param {number} [strength=1.0]  — current scale multiplier
   */
  injectLetter(letter, strength = 1.0) {
    if (!this.regions || !this.regions.letter) return;
    const vec = encodeLetter(letter);
    if (vec.length === 0) return;
    this.injectEmbeddingToRegion('letter', vec, strength);
  }

  /**
   * T14.1 — Letter-region transition surprise between consecutive ticks.
   *
   * Returns |curr_rate - prev_rate| where rate is the mean spike count in
   * the letter region. A large value means the letter region just shifted
   * to a different activation pattern (new letter arrived, or attractor
   * basin flipped), which is the cue T14.2 uses for syllable boundaries
   * and T14.6 uses for word-boundary detection in the motor emission loop.
   *
   * Grounded in Saffran/Aslin/Newport 1996 (Science 274:1926) — infants
   * segment continuous speech by tracking transition probabilities, not
   * by reading a dictionary. The cortex learns the same way: statistical
   * surprise between adjacent ticks is a learnable boundary signal.
   *
   * Side effect: updates `_prevLetterRate` so the next call sees this
   * tick as its "prev". Call once per cortex tick.
   */
  letterTransitionSurprise() {
    if (!this.regions || !this.regions.letter) return 0;
    const { start, end } = this.regions.letter;
    const span = end - start;
    if (span <= 0) return 0;
    let sum = 0;
    for (let i = start; i < end; i++) if (this.lastSpikes[i]) sum++;
    const rate = sum / span;
    const surprise = Math.abs(rate - this._prevLetterRate);
    this._prevLetterRate = rate;
    return surprise;
  }

  /**
   * T14.1 — Check whether the motor region has been quiescent for N ticks.
   *
   * "Quiescent" means the motor region's current-tick spike rate is below
   * `threshold` (default 5% of region size — tiny, but non-zero because
   * background cortex noise produces low baseline spiking). The internal
   * counter `_motorQuiescentTicks` increments every tick the motor region
   * is below threshold and resets to 0 as soon as it spikes above it.
   *
   * The tick-driven emission loop (T14.6) uses this to decide when the
   * cortex has stopped producing output for the current utterance. No
   * hardcoded "emit 5 words then stop" slot counter — the brain stops
   * when its motor basin settles, which is what biological vSMC does
   * at end-of-utterance (Bouchard 2013 Nature 495:327).
   *
   * @param {number} ticksRequired  — how many consecutive quiet ticks count as "done"
   * @param {number} [threshold=0.05]  — spike-rate cutoff as fraction of region size
   * @returns {boolean} — true if motor has been quiet long enough to stop emission
   */
  motorQuiescent(ticksRequired, threshold = 0.05) {
    if (!this.regions || !this.regions.motor) return false;
    return this._motorQuiescentTicks >= ticksRequired;
  }

  /**
   * T14.2 — LEARNED syllable boundary detection via cortex transition surprise.
   *
   * Streams a letter sequence through the cortex one letter at a time, ticking
   * the cluster between each injection so recurrent dynamics settle, and
   * records the letter-region transition surprise (|currRate − prevRate|) at
   * each step. Boundaries are local maxima of the surprise series that exceed
   * the adaptive threshold `mean(δ) + k·std(δ)` computed over the series
   * itself. Matches how infants find word/syllable boundaries in continuous
   * speech — Saffran/Aslin/Newport 1996 (Science 274:1926) statistical
   * segmentation.
   *
   * NO hardcoded maximum-onset principle. NO English-specific CV/CVC/CCV
   * patterns. Syllables emerge from whatever letter-transition basins the
   * cortex developed during curriculum exposure. Train on Spanish corpus →
   * learns Spanish syllabification. Train on Mandarin pinyin → learns
   * Mandarin. Same code, different basins.
   *
   * Side effect: this method ticks the cortex and injects currents, so it
   * perturbs live cluster state. Callers that care (e.g. `dictionary.learnWord`)
   * are expected to accept this — learning the word IS perturbing the cortex.
   *
   * @param {string|string[]} letterSequence  — word string or array of letters
   * @param {object} [opts]
   * @param {number} [opts.ticksPerLetter=2]  — cortex ticks between injections
   * @param {number} [opts.k=0.5]  — std-multiplier for adaptive threshold
   * @returns {number[]}  — boundary indices (positions in letterSequence where a new syllable starts; always includes 0)
   */
  detectBoundaries(letterSequence, opts = {}) {
    if (!this.regions || !this.regions.letter) return [];
    const { ticksPerLetter = 2, k = 0.5 } = opts;
    const letters = typeof letterSequence === 'string'
      ? Array.from(letterSequence)
      : letterSequence;
    if (!letters || letters.length === 0) return [];

    // Reset the transition-surprise baseline so the first letter of THIS
    // sequence doesn't inherit a stale prevRate from whatever the cortex
    // was doing before the call.
    this._prevLetterRate = 0;

    const surprise = new Float64Array(letters.length);
    for (let i = 0; i < letters.length; i++) {
      this.injectLetter(letters[i], 1.0);
      for (let t = 0; t < ticksPerLetter; t++) this.step(0.001);
      surprise[i] = this.letterTransitionSurprise();
    }

    // Adaptive threshold from this sequence's own statistics
    let sum = 0, sumSq = 0;
    for (let i = 0; i < surprise.length; i++) { sum += surprise[i]; sumSq += surprise[i] * surprise[i]; }
    const mean = sum / surprise.length;
    const varV = Math.max(0, sumSq / surprise.length - mean * mean);
    const std = Math.sqrt(varV);
    const threshold = mean + k * std;

    // Local maxima above threshold = syllable starts. Index 0 is ALWAYS
    // a boundary (start of the word). Subsequent boundaries are any i>0
    // where surprise[i] is a strict local max AND surprise[i] > threshold.
    const boundaries = [0];
    for (let i = 1; i < surprise.length; i++) {
      const prev = surprise[i - 1];
      const next = i + 1 < surprise.length ? surprise[i + 1] : -Infinity;
      const isLocalMax = surprise[i] >= prev && surprise[i] >= next;
      if (isLocalMax && surprise[i] > threshold && i - boundaries[boundaries.length - 1] >= 1) {
        boundaries.push(i);
      }
    }
    return boundaries;
  }

  /**
   * T14.2 — LEARNED stress detection via per-syllable activation peaks.
   *
   * Runs `detectBoundaries` first to segment the letter sequence, then
   * streams the letters again measuring the motor+phon region activation
   * level during each syllable. The syllable with the highest mean
   * activation is PRIMARY stress, next-highest is SECONDARY, rest are
   * unstressed. No hardcoded "single-syllable is PRIMARY, two-syllable
   * is PRIMARY-SECONDARY" rule — stress is whichever syllable the cortex
   * activates hardest, which reflects the exposure statistics it learned
   * from (stressed syllables carry more semantic load → higher cortex
   * response → higher activation basin).
   *
   * @param {string|string[]} letterSequence
   * @param {object} [opts]
   * @param {number} [opts.ticksPerLetter=2]
   * @returns {{ boundaries: number[], stress: number[], primary: number, secondary: number }}
   *   boundaries: indices where each syllable starts (from detectBoundaries)
   *   stress: per-syllable mean activation (same length as boundaries)
   *   primary: index (in boundaries) of the primary-stress syllable
   *   secondary: index of secondary-stress syllable, or -1 if < 2 syllables
   */
  detectStress(letterSequence, opts = {}) {
    if (!this.regions || !this.regions.phon) {
      return { boundaries: [], stress: [], primary: -1, secondary: -1 };
    }
    const { ticksPerLetter = 2 } = opts;
    const letters = typeof letterSequence === 'string'
      ? Array.from(letterSequence)
      : letterSequence;
    if (!letters || letters.length === 0) {
      return { boundaries: [], stress: [], primary: -1, secondary: -1 };
    }

    const boundaries = this.detectBoundaries(letters, { ticksPerLetter });
    if (boundaries.length === 0) {
      return { boundaries: [], stress: [], primary: -1, secondary: -1 };
    }

    // Second pass — stream again and record phon-region spike fraction at
    // each letter position. The first pass already left the cortex in a
    // primed state for this word; the second pass just samples activation.
    this._prevLetterRate = 0;
    const phonRegion = this.regions.phon;
    const phonSpan = phonRegion.end - phonRegion.start;
    const activation = new Float64Array(letters.length);
    for (let i = 0; i < letters.length; i++) {
      this.injectLetter(letters[i], 1.0);
      for (let t = 0; t < ticksPerLetter; t++) this.step(0.001);
      let phonSum = 0;
      for (let n = phonRegion.start; n < phonRegion.end; n++) if (this.lastSpikes[n]) phonSum++;
      activation[i] = phonSpan > 0 ? phonSum / phonSpan : 0;
    }

    // Mean activation per syllable (boundaries[s] .. boundaries[s+1]-1)
    const stress = new Array(boundaries.length).fill(0);
    for (let s = 0; s < boundaries.length; s++) {
      const start = boundaries[s];
      const end = s + 1 < boundaries.length ? boundaries[s + 1] : letters.length;
      let sum = 0, count = 0;
      for (let i = start; i < end; i++) { sum += activation[i]; count++; }
      stress[s] = count > 0 ? sum / count : 0;
    }

    // Primary = argmax, secondary = second-highest (only if 2+ syllables)
    let primary = 0, secondary = -1;
    let primaryVal = -Infinity, secondaryVal = -Infinity;
    for (let s = 0; s < stress.length; s++) {
      if (stress[s] > primaryVal) {
        secondaryVal = primaryVal; secondary = primary;
        primaryVal = stress[s];   primary = s;
      } else if (stress[s] > secondaryVal) {
        secondaryVal = stress[s]; secondary = s;
      }
    }
    if (stress.length < 2) secondary = -1;

    return { boundaries, stress, primary, secondary };
  }

  /**
   * T14.4 — Propagate every cross-region projection. Runs on every
   * cluster step after the main internal synapse propagation, before
   * LIF integration. ALWAYS propagated — no curriculum-complete gate.
   * Random-init projections inject low-magnitude noise until learning
   * sharpens them, which is biologically correct (newborn cortex has
   * weak random cross-region connections that strengthen via experience).
   */
  _propagateCrossRegions() {
    if (!this.crossProjections) return;
    for (const [name, proj] of Object.entries(this.crossProjections)) {
      const idx = name.indexOf('_to_');
      if (idx < 0) continue;
      const src = name.slice(0, idx);
      const dst = name.slice(idx + 4);
      const srcRegion = this.regions[src];
      const dstRegion = this.regions[dst];
      if (!srcRegion || !dstRegion) continue;
      const srcSpikes = this.regionSpikes(src);
      const inputs = proj.propagate(srcSpikes);
      for (let i = 0; i < inputs.length; i++) {
        this.externalCurrent[dstRegion.start + i] += inputs[i] * 0.35;
      }
    }
  }

  /**
   * T14.4 — Hebbian update on every cross-region projection. Uses the
   * current spike snapshot of both src and dst regions to strengthen
   * the projection where they co-fire. Runs from cluster.learn() and
   * also from cluster.learnSentenceHebbian after each word's tick.
   */
  _crossRegionHebbian(lr) {
    if (!this.crossProjections) return;
    for (const [name, proj] of Object.entries(this.crossProjections)) {
      const idx = name.indexOf('_to_');
      if (idx < 0) continue;
      const src = name.slice(0, idx);
      const dst = name.slice(idx + 4);
      if (!this.regions[src] || !this.regions[dst]) continue;
      const preF = this.regionSpikes(src);
      const postF = this.regionSpikes(dst);
      proj.hebbianUpdate(preF, postF, lr);
    }
  }

  /**
   * One simulation step for this cluster.
   * @param {number} dt — timestep in seconds
   * @returns {{ spikes: Uint8Array, spikeCount: number, voltages: Float64Array }}
   */
  step(dt) {
    const { size, neurons, synapses } = this;

    // T14.4 — Cross-region projection propagation. Runs FIRST, before
    // current accumulation, so cross-region inputs are folded into
    // externalCurrent and pick up by the standard current loop below.
    // Only the cortex cluster has crossProjections populated; other
    // clusters skip this with zero overhead.
    this._propagateCrossRegions();

    // Build input currents
    const currents = new Float64Array(size);
    const synapticCurrents = synapses.propagate(neurons.getSpikes());

    // Effective tonic drive with all modulation applied
    const effectiveDrive = this.tonicDrive
      * this.driveBaseline      // hypothalamus homeostasis
      * this.emotionalGate      // amygdala emotional amplification
      * this.actionGate          // basal ganglia action gating
      * this.gainMultiplier;     // mystery consciousness modulation

    for (let i = 0; i < size; i++) {
      currents[i] = synapticCurrents[i]
        + this.externalCurrent[i]
        + this._incomingProjections[i]
        + effectiveDrive
        + (Math.random() - 0.5) * this.noiseAmplitude
        + this.errorCorrection;  // cerebellum correction signal
    }

    // Step neurons
    const spikes = neurons.step(dt * 1000, currents);
    const voltages = neurons.getVoltages();

    // Count spikes
    let spikeCount = 0;
    for (let i = 0; i < size; i++) if (spikes[i]) spikeCount++;

    // Update state
    this.lastSpikes = Uint8Array.from(spikes);
    this.lastSpikeCount = spikeCount;
    this.firingRate = this.firingRate * 0.95 + spikeCount * 0.05;

    // T14.1 — Motor-region quiescence counter. Measured on every tick so
    // `motorQuiescent(ticksRequired)` can answer in O(1). Only runs on the
    // cortex cluster (only cortex has a motor sub-region).
    if (this.regions && this.regions.motor) {
      const { start, end } = this.regions.motor;
      const span = end - start;
      let motorSum = 0;
      for (let i = start; i < end; i++) if (this.lastSpikes[i]) motorSum++;
      const motorRate = span > 0 ? motorSum / span : 0;
      if (motorRate < 0.05) this._motorQuiescentTicks++;
      else this._motorQuiescentTicks = 0;
    }

    // Mean voltage for monitoring
    let vSum = 0;
    for (let i = 0; i < size; i++) vSum += voltages[i];
    this.lastMeanVoltage = vSum / size;

    // Decay external currents
    for (let i = 0; i < size; i++) {
      this.externalCurrent[i] *= 0.9;
      this._incomingProjections[i] = 0; // reset for next step
    }

    return { spikes: this.lastSpikes, spikeCount, voltages };
  }

  /**
   * Apply plasticity rules on this cluster's internal synapses
   * AND on the cross-region projections (T14.4).
   */
  learn(rewardSignal) {
    const pre = new Float64Array(this.lastSpikes);
    const post = new Float64Array(this.lastSpikes);
    this.synapses.rewardModulatedUpdate(pre, post, rewardSignal, this.learningRate);
    // T14.4 — cross-region Hebbian. Always fires when the cluster learns,
    // shaping the projections through normal use during curriculum + live chat.
    this._crossRegionHebbian(this.learningRate);
  }

  /**
   * T13.1 — Persona Hebbian sentence training.
   *
   * Walks a sequence of word embeddings, injects each into the language
   * region, ticks the LIF integrator `ticksPerWord` steps so cortex state
   * reflects the injection plus recurrent dynamics, then applies plain
   * Hebbian on the internal synapse matrix between consecutive spike
   * snapshots (ΔW_ij = η · curr_i · prev_j). Result: the cluster develops
   * attractor basins shaped like persona-word co-activation patterns,
   * so runtime readouts naturally drift along those basins instead of
   * producing diffuse semantic noise.
   *
   * Oja-style saturation decay runs after each sentence on any weight
   * whose magnitude exceeds `ojaThreshold` — prevents runaway when the
   * corpus is large. Bounded growth, unbounded learning time.
   *
   * @param {Float32Array[]|Float64Array[]} embSequence — per-word 50d embeddings
   * @param {object} [opts]
   * @param {number} [opts.ticksPerWord=3]
   * @param {number} [opts.lr=0.004]
   * @param {number} [opts.injectStrength=0.6]
   * @param {number} [opts.ojaThreshold=1.5]
   * @param {number} [opts.ojaDecay=0.01]
   * @param {number} [opts.langStart=150]
   * @returns {number} — Hebbian update count (one per consecutive word pair)
   */
  learnSentenceHebbian(embSequence, opts = {}) {
    const {
      ticksPerWord = 3,
      lr = 0.004,
      injectStrength = 0.6,
      ojaThreshold = 1.5,
      ojaDecay = 0.01,
      langStart = 150,
    } = opts;

    if (!embSequence || embSequence.length < 2) return 0;

    const prevSnap = new Float64Array(this.size);
    const currSnap = new Float64Array(this.size);
    let haveSnap = false;
    let updates = 0;

    for (const emb of embSequence) {
      if (!emb) continue;

      // Inject word embedding into language region via the standard
      // current-injection path so cortex dynamics see it identically
      // to how sensory words arrive during normal operation.
      const currents = sharedEmbeddings.mapToCortex(emb, this.size, langStart);
      if (injectStrength !== 1) {
        for (let i = 0; i < this.size; i++) currents[i] *= injectStrength;
      }
      this.injectCurrent(currents);

      // Let cortex integrate the injection plus recurrent spikes.
      for (let t = 0; t < ticksPerWord; t++) this.step(0.001);

      // Sequence Hebbian: pre = earlier word's spikes, post = this word's
      // spikes. Strengthens synapses that contributed to the observed
      // word-to-word transition during persona corpus playback.
      if (haveSnap) {
        for (let i = 0; i < this.size; i++) currSnap[i] = this.lastSpikes[i] ? 1 : 0;
        this.synapses.hebbianUpdate(prevSnap, currSnap, lr);
        updates++;
      }

      // Snapshot this word's spikes as the next iteration's pre vector.
      for (let i = 0; i < this.size; i++) prevSnap[i] = this.lastSpikes[i] ? 1 : 0;
      haveSnap = true;
    }

    // Oja-style saturation decay — prevents weight runaway across
    // long corpora. Only touches weights that have already grown past
    // `ojaThreshold`, so small weights learn freely.
    if (updates > 0 && ojaDecay > 0) {
      const values = this.synapses.values;
      const nnz = this.synapses.nnz;
      const keepFraction = 1 - ojaDecay;
      for (let k = 0; k < nnz; k++) {
        if (Math.abs(values[k]) > ojaThreshold) values[k] *= keepFraction;
      }
    }

    return updates;
  }

  /**
   * T13.1 diagnostic — inject one embedding, tick N steps, return the
   * semantic readout. Used for convergence verification (e.g. after
   * persona Hebbian training, check that `emb('fuck')` produces a
   * readout cosine-adjacent to other persona-cluster words).
   *
   * Disturbs live brain state, so only call from console diagnostics
   * or boot-time verification — not inside the think loop.
   */
  diagnoseReadoutForEmbedding(emb, ticks = 10, langStart = 150) {
    const currents = sharedEmbeddings.mapToCortex(emb, this.size, langStart);
    this.injectCurrent(currents);
    for (let t = 0; t < ticks; t++) this.step(0.001);
    return this.getSemanticReadout(sharedEmbeddings, langStart);
  }

  /**
   * Cluster synapse weight stats — used for T13.1 before/after training
   * verification. Returns mean, RMS, max magnitude over active (non-zero)
   * weights, plus the non-zero count.
   */
  synapseStats() {
    const { values, nnz } = this.synapses;
    let sum = 0, sumSq = 0, maxAbs = 0;
    for (let k = 0; k < nnz; k++) {
      const a = Math.abs(values[k]);
      sum += a;
      sumSq += values[k] * values[k];
      if (a > maxAbs) maxAbs = a;
    }
    const count = nnz || 1;
    return {
      mean: sum / count,
      rms: Math.sqrt(sumSq / count),
      maxAbs,
      nnz,
    };
  }

  /**
   * Receive projected spikes from another cluster.
   * @param {Uint8Array} sourceSpikes — spike array from source cluster
   * @param {Float64Array} projectionWeights — weight vector (source.size → this.size mapping)
   */
  receiveProjection(sourceSpikes, projectionWeights) {
    const srcSize = sourceSpikes.length;
    const tgtSize = this.size;
    for (let i = 0; i < tgtSize; i++) {
      let sum = 0;
      for (let j = 0; j < srcSize; j++) {
        if (sourceSpikes[j]) {
          sum += projectionWeights[i * srcSize + j] || 0;
        }
      }
      this._incomingProjections[i] += sum;
    }
  }

  /**
   * Inject external input current into specific neurons.
   */
  injectCurrent(currents) {
    const len = Math.min(currents.length, this.size);
    for (let i = 0; i < len; i++) {
      this.externalCurrent[i] += currents[i];
    }
  }

  /**
   * Get a summary output vector (downsampled for module processing).
   * Returns a Float64Array of length `outputSize` by averaging neuron groups.
   */
  getOutput(outputSize = 32) {
    const voltages = this.neurons.getVoltages();
    const output = new Float64Array(outputSize);
    const groupSize = Math.floor(this.size / outputSize);
    for (let i = 0; i < outputSize; i++) {
      let sum = 0;
      for (let j = 0; j < groupSize; j++) {
        const idx = i * groupSize + j;
        if (idx < this.size) {
          sum += this.lastSpikes[idx] ? 1.0 : (voltages[idx] + 70) / 20; // normalize
        }
      }
      output[i] = sum / groupSize;
    }
    return output;
  }

  /**
   * Read a specific neuron range as semantic embedding-space vector.
   *
   * R2 of brain-refactor-full-control — this is the read-side of the
   * semantic loop. `sensory.js` writes word embeddings into specific
   * cortex neuron ranges via `embeddings.mapToCortex`, the cortex
   * integrates those currents through LIF dynamics + hierarchical
   * modulation (amygdala gate, Ψ, drive baseline, etc), and this
   * method reads the activation state back as a semantic vector by
   * calling the inverse mapping.
   *
   * Only meaningful on the cortex cluster (which has Wernicke's area
   * at neurons 150-299). Calling it on amygdala/BG/etc will return
   * the language-region readout which those clusters don't have —
   * just don't.
   *
   * @param {object} embeddings — the shared SemanticEmbeddings instance
   *   with `cortexToEmbedding(spikes, voltages, cortexSize, langStart)`
   * @param {number} langStart — first neuron of the language region
   *   (default 150 matches sensory.js mapToCortex)
   * @returns {Float64Array} — 50d L2-normalized semantic pattern
   */
  getSemanticReadout(embeddings, langStart = 150) {
    const voltages = this.neurons.getVoltages();
    return embeddings.cortexToEmbedding(
      this.lastSpikes,
      voltages,
      this.size,
      langStart
    );
  }

  getState() {
    return {
      name: this.name,
      size: this.size,
      spikeCount: this.lastSpikeCount,
      firingRate: this.firingRate,
      meanVoltage: this.lastMeanVoltage,
      spikes: this.lastSpikes,
      voltages: this.neurons.getVoltages(),
      drive: this.tonicDrive * this.driveBaseline * this.emotionalGate * this.actionGate * this.gainMultiplier,
      modulation: {
        gain: this.gainMultiplier,
        emotional: this.emotionalGate,
        drive: this.driveBaseline,
        action: this.actionGate,
        error: this.errorCorrection,
      },
    };
  }
}

/**
 * Inter-cluster projection — sparse weight matrix connecting two clusters.
 */
export class ClusterProjection {
  /**
   * @param {NeuronCluster} source
   * @param {NeuronCluster} target
   * @param {number} density — connection probability (0-1)
   * @param {number} strength — initial weight magnitude
   */
  constructor(source, target, density = 0.03, strength = 0.3) {
    this.source = source;
    this.target = target;

    // Sparse projection matrix (CSR) — target.size rows × source.size cols
    this._sparse = new SparseMatrix(target.size, source.size, { wMin: -0.5, wMax: 1.0 });
    this._sparse.initRandom(density, 0.7, strength);

    // Legacy dense weights accessor for persistence compatibility
    // persistence.js reads projection.weights — getter provides dense view
  }

  /**
   * Dense weights accessor for backward compatibility.
   * Persistence.js and other code reads this.weights.
   */
  get weights() {
    return this._sparse.toDense();
  }

  set weights(arr) {
    // Convert dense array to sparse
    this._sparse = SparseMatrix.fromDense(
      arr, this.target.size, this.source.size, 0.001,
      { wMin: -0.5, wMax: 1.0 }
    );
  }

  /**
   * Propagate spikes from source to target — O(connections) not O(N²).
   */
  propagate() {
    const currents = this._sparse.propagate(this.source.lastSpikes);
    const proj = this.target._incomingProjections;
    for (let i = 0; i < currents.length; i++) {
      proj[i] += currents[i];
    }
  }

  /**
   * Reward-modulated Hebbian learning on projection weights.
   * ΔW_proj = η · δ · source_spikes · target_spikes
   * Only updates existing connections — O(connections).
   *
   * @param {number} reward — positive = strengthen, negative = weaken
   * @param {number} lr — learning rate
   */
  learn(reward, lr = 0.001) {
    if (Math.abs(reward) < 0.01) return;
    this._sparse.rewardModulatedUpdate(
      this.source.lastSpikes,
      this.target.lastSpikes,
      reward, lr
    );
  }

  /**
   * Get sparse matrix stats.
   */
  stats() {
    return this._sparse.stats();
  }
}
