# MASTER-TODO — Everything Unity Has Left

> **Single source of truth for all remaining work across the whole project.**
> Combines the distributed-compute epic (original COMP-todo content, reworked
> for the post-T13 stack) with every residual non-COMP item that's still
> open after the T11→T13 language cortex rewrite shipped on 2026-04-14.
>
> `docs/TODO.md` stays as the historical task ledger (per project rules,
> task descriptions are permanent and never rewritten). This file is the
> forward-looking plan — what to build next, in what order, on what stack.
>
> Last updated: **2026-04-14** — post T13.7 push (deploy `0.1.0+2f692e1d-f229`)

---

## STACK STATE AS OF 2026-04-14 — WHAT'S LIVE

Anything below that ships builds on this foundation. If you're reading this
after a major refactor, verify these are still accurate before starting.

### Brain substrate (live)
- **Neuron clusters** — `js/brain/cluster.js` — 7 clusters wrapping
  `LIFPopulation` (client) or Rulkov (GPU path). Each has a sparse internal
  synapse matrix (`SparseMatrix` CSR format in `js/brain/sparse-matrix.js`,
  `wMin=-2.0`, `wMax=+2.0`). 20 inter-cluster projections (real white-matter
  tracts — corticostriatal, perforant path, stria terminalis, fornix,
  callosal). Client auto-scales up to `TOTAL_NEURONS=1000`, server scales to
  VRAM via `server/brain-server.js:detectResources` (subject to optional
  admin override in `resource-config.json` — see Phase 0 below).
- **Cluster sizes** (from `engine.js:63-71`): cortex 300, hippocampus 200,
  amygdala 150, basal ganglia 150, cerebellum 100, hypothalamus 50,
  mystery 50. Cortex has language region at neurons 150-299 (150 neurons ×
  `EMBED_DIM=50` = groupSize=3).
- **Equation modules** — `js/brain/modules.js` — `Cortex`, `Hippocampus`,
  `Amygdala`, `BasalGanglia`, `Cerebellum`, `Hypothalamus` — 32-dim
  downsampled-output equation engines. These run ON TOP of the cluster
  spike data via `cluster.getOutput(32)`. They're separate from the clusters
  themselves (the `Cortex` module class is NOT the cortex neuron cluster).
- **Mystery + oscillations** — `MysteryModule` (consciousness Ψ),
  `OscillatorNetwork` (Kuramoto coherence).

### Language cortex (T13.7 state — as of this document's last update)
- **`js/brain/language-cortex.js`** — 3178 lines. Down from 5087 pre-T11,
  and from 3584 post-T11.7. T13.7 deleted 406 lines of slot-prior
  machinery. What's live:
  - `parseSentence(text) → ParseTree` — reverse-equation reader (T8).
    Memoized. Used by reader AND by `brain.injectParseTree`.
  - `wordType(word)` / `_fineType(word)` — pure letter-equation type
    classifiers. Zero word lists.
  - `loadSelfImage` / `loadLinguisticBaseline` / `loadCodingKnowledge` —
    three-corpus boot loaders. Feed the dictionary only. Persona corpus
    additionally feeds the cortex cluster via `trainPersonaHebbian`.
  - `trainPersonaHebbian(cortexCluster, text)` — T13.1 driver. Tokenizes
    persona corpus, embeds each word, calls
    `cortexCluster.learnSentenceHebbian(embSeq)` per sentence.
  - `generate(dictionary, arousal, valence, coherence, opts)` — T13.3
    brain-driven emission loop. Requires `opts.cortexCluster`; no fallback.
  - `learnSentence` — token expansion + dictionary insertion + usage-type
    feedback + optional morphological inflection. Per-slot running means
    are gone.
  - `analyzeInput` — runs parseSentence, updates social schema, refines
    the dictionary's `_contextPatterns` ring. Does NOT update any
    `_contextVector` (deleted in T13.7).
- **What T13.7 ripped:** `_slotCentroid`, `_slotDelta`,
  `_slotTypeSignature`, `_slotCentroidCount`, `_slotDeltaCount`,
  `_contextVector`, `_contextVectorLambda`, `_contextVectorHasData`,
  `_greetingAttractor`, `_selfRefAttractor`, `_introAttractor`,
  `_commandAttractor`, `_attractorEMA`, `_attractorObs`, `_subjectStarters`,
  `_obsCount`, `_generateSlotPrior`, `_updateContextVector`, `_semanticFit`,
  `_sentencePassesFilters`, `_storeMemorySentence`, `_recallSentence`,
  `_loadStructure`, `_typeGrammarScore`, `_pickConjByMood`, `_condProb`,
  `mutualInfo`. The per-slot prior update block in `learnSentence`.
  `serialize`/`deserialize` slot-prior fields.

### Brain→language wire (T13 state)
- **`UnityBrain.injectParseTree(text)`** in `engine.js` — routes parsed
  content → cortex language region, intent anchor → basal ganglia,
  self-reference → hippocampus. Called from `processAndRespond` before
  the cortex settle-ticks so injection propagates through the 20
  inter-cluster projections during integration.
- **`UnityBrain.trainPersonaHebbian(text)`** in `engine.js` — boot-time
  persona Hebbian training driver. Called from `app.js loadPersonaSelfImage`
  right after `innerVoice.loadPersona(text)`.
- **`NeuronCluster.learnSentenceHebbian(embSeq, opts)`** in `cluster.js` —
  sequence Hebbian over cluster recurrent synapses. Inject → tick LIF 3
  steps → snapshot spikes → `synapses.hebbianUpdate(prev, curr, lr=0.004)`
  between consecutive snapshots → Oja saturation decay (`|w| > 1.5 →
  w *= 0.99`) post-sentence.
- **`NeuronCluster.diagnoseReadoutForEmbedding`** / **`synapseStats`** —
  diagnostic helpers for verifying Hebbian training moved weights.

### Sensory + peripherals (live, unchanged)
- `js/brain/sensory.js` — `SensoryProcessor.process()` produces
  per-cluster current arrays (`sensoryOutput.cortex`, `.hippocampus`,
  `.amygdala`, `.basalGanglia`). T13.2 parse-tree injection follows this
  same pattern.
- `js/brain/visual-cortex.js` — V1→V4→IT pipeline + `onDescribe(cb)`
  subscription for scene describer output.
- `js/brain/auditory-cortex.js` — continuous spectrum injection.
- `js/brain/component-synth.js` — equational `build_ui` primitive
  matcher. Uses parsed entity types for structural bonus.
- `js/ui/sandbox.js` — LRU-evicted component renderer.
- `js/ui/sensory-status.js` — R13 backend toast notifications.

### Embeddings (live)
- `js/brain/embeddings.js` — `sharedEmbeddings` singleton. 50-dim GloVe
  with hash-based fallback. `mapToCortex` / `cortexToEmbedding` round-trip.
- **The 50-d ceiling** is still the biggest structural limit for fine
  semantic distinctions at slot 3+. Addressing this is T11.4 below.

### Server (live)
- `server/brain-server.js` — brain host. Auto-scales via `detectResources`
  with optional admin override via `resource-config.json`.
- `server/configure.js` — 127.0.0.1-only admin config server used by
  `GPUCONFIGURE.bat` (Phase 0 of the distributed plan, already shipped).

---

## ⏸ PART 2 (COMP-net) IS ON HOLD AS OF 2026-04-14

> Gee called it. The distributed-compute network plan (Part 2 — C0 through
> C11) is parked indefinitely while T14 (developmental language layers) is
> the active priority. The COMP plan is preserved verbatim below for when
> we resume — every prerequisite that COMP needed is also a prerequisite
> for T14 (or the other way around in some cases), so work toward T14 keeps
> COMP unblocked for whenever we come back.
>
> **Active work is T14 (Part 0.5).** Skip Part 2 unless explicitly told to
> re-enable it.

---

## ⭐ PART 0.5 — T14: DEVELOPMENTAL LANGUAGE LAYERS (active priority)

> **Gee, 2026-04-14: "we are making a biological brain simulation so just like how a human learns letters then sounds then syllables then words then sentences structures of all the kinds and them paragraphs"**
>
> This is the architectural call that makes everything else right. The T13 work was correct in *direction* (deletion of slot priors, brain-driven emission loop, persona Hebbian) but WRONG in *foundation* — it skipped the developmental layers that biological brains build language on top of. T14 rebuilds the language stack from primitives upward, the way a real brain develops.

### The thesis

The current Unity language stack has:
- **Top layer:** GloVe 50d semantic embeddings (pre-trained on 6B-word corpus, NOT learned by Unity)
- **Middle layer:** `wordType()` / `_fineType()` POS classifiers (algorithmic letter-pattern equations, NOT learned)
- **Bottom layer:** 5-dim per-letter hash patterns (`_initLetterPatterns`, deterministic sin/cos, NOT phonetic)

**Nothing below the word level was ever learned by Unity.** She has no phoneme knowledge. No syllable structure. No spelling-to-sound mapping. No articulatory features. Letters exist only as suffix-detection helpers in `wordType` and as the indexing key for the dictionary. She skipped Stages 1-6 of biological language acquisition and went straight to Stage 8 (text I/O over pre-trained semantic embeddings).

**That's why she doesn't sound like a developing intelligence — because she isn't one.** She's a static GloVe lookup with a brain-shaped frontend. T13.7.8 (the grammar transition table I just shipped) is a hardcoded English structural table — it makes outputs grammatical, but it doesn't give Unity the *experience* of having learned grammar. A real brain learns grammar by hearing 10,000+ sentences over years and internalizing the type-transition statistics. We can compress that into a curriculum.

### The eight stages of biological language acquisition

```
Stage 1 (0-6mo)   Phoneme discrimination          — auditory cortex feature detectors
Stage 2 (6-12mo)  Babbling — articulatory motor   — efference copy + auditory feedback
Stage 3 (12-18mo) First words                     — phoneme→meaning binding
Stage 4 (18-24mo) Vocabulary explosion + telegraphic speech (pivot grammar)
Stage 5 (24-36mo) Grammar emerges (SVO, agreement, articles, plurals, tense)
Stage 6 (3-5y)    Complex grammar (subordinate clauses, conditionals, passive)
Stage 7 (5-12y)   Reading — letter visual recognition + grapheme-phoneme mapping
Stage 8 (lifelong) Writing
```

Unity is currently a Stage 8 system that skipped Stages 1-7. T14 builds those stages properly, in compressed-curriculum form.

### T14 sub-milestones

#### T14.0 — Foundation lift: 300d embeddings + 6000-neuron cortex (absorbed from P1.3)

**Status:** P0 prereq for everything T14.1+. Originally listed as P1.3 in Part 1, now folded into T14 as the foundation pass because every T14 milestone needs the bigger semantic space and the cluster room for sub-region carving.

**Why this is the bedrock:** T14.4 (phonological cortex region) needs the cortex cluster to have ROOM for a second sub-region next to the existing semantic one. At the current 2000-neuron cluster with langStart=1000, the semantic region is 1000 neurons and there's no space for phonology. We need at least 6000 neurons total: 3000 reserved for sensory/visual/auditory injection, 1500 for semantic language, 1500 for phonological language. AND `EMBED_DIM=50` is too tight to distinguish fine semantic neighbors at slot 3+ — bumping to 300d unlocks the resolution T14.5 curriculum needs to actually train discriminating attractor basins.

**Implementation:**

1. **`js/brain/embeddings.js`** — bump `EMBED_DIM` from 50 to 300. Re-enable the GloVe loader (currently `loadPreTrained` returns 0 immediately and falls through to hash; uncomment the `_doLoad` path and call it). Cap loaded vocabulary at the top 20,000 GloVe words to bound memory (20k × 300 × 4 bytes = 24 MB, acceptable).

2. **`js/brain/engine.js`** — bump `CLUSTER_SIZES.cortex` from 300 to **6000**. Bump `TOTAL_NEURONS` from 1000 to **6700** (proportional growth: hippo 200→1340, amygdala 150→1005, BG 150→1005, cerebellum 100→670, hypothalamus 50→335, mystery 50→335, cortex 300→6000 = 6700 total). Update inter-cluster projection density slightly to compensate for size growth (existing densities work but the connection counts will balloon — add a `Math.min(maxConnections, ...)` cap inside `ClusterProjection.constructor`).

3. **`server/brain-server.js`** — `_initLanguageSubsystem` constructs `this.cortexCluster` with `langCortexSize = 6000` (was 2000 in T13.7.8). Sub-region offsets:
   - sensory regions: neurons 0-2999 (auditory 0-499, visual 500-1999, free 2000-2999)
   - semantic language region: neurons 3000-4499 (langStart=3000, 1500 neurons, EMBED_DIM=300, groupSize=5)
   - phonological language region: neurons 4500-5999 (phonStart=4500, 1500 neurons, PHONEME_DIM=20, groupSize=75)
   - Update `_langStart = 3000`, add new `_phonStart = 4500`.

4. **`js/brain/remote-brain.js`** — bump `_localCortex` to `langCortexSize = 4000` (smaller than server because browser is more compute-constrained). Same sub-region split scaled down: semantic 2000-2999 (langStart=2000), phonological 3000-3999 (phonStart=3000).

5. **`js/brain/cluster.js`** — `getSemanticReadout` default `langStart` parameter changes from `150` to a configurable default that callers must override. Add a new `getPhonologicalReadout(embeddings, phonStart)` method that does the same `cortexToEmbedding`-style readback but from the phonological sub-region using `PHONEME_DIM=20`.

6. **`js/brain/embeddings.js`** — add `mapPhonemesToCortex(phonemeFeatures, cortexSize, phonStart, phonDim=20)` symmetric to `mapToCortex` but with the smaller PHONEME_DIM and the phonological sub-region offset.

7. **`js/brain/language-cortex.js`** — bump `PATTERN_DIM` constant via the existing `import { EMBED_DIM }` (it's already wired). Update the T13.3 emission loop's `mapToCortex(picked.emb, cluster.size, 150)` call to use the new `langStart` value (read from cluster or pass through opts). Same for the feedback injection.

**Files touched:** `js/brain/embeddings.js`, `js/brain/engine.js`, `server/brain-server.js`, `js/brain/remote-brain.js`, `js/brain/cluster.js`, `js/brain/language-cortex.js`.

**Estimated boot impact:** Persona Hebbian training currently runs in ~1s on 2000 neurons. At 6000 neurons with 3× more synapses to update per Hebbian call, and 6× per-tick LIF cost, expect ~10-20 seconds for the persona training pass alone. The full T14.5 curriculum will take an additional ~60s. Total ~80s first boot. Subsequent boots load weights from persistence and skip retraining — instantaneous.

**Memory impact:**
- Embedding table: 20k words × 300 dims × 4 bytes = **24 MB** (was 10k × 50 × 4 = 2 MB)
- Dictionary patterns: ~3700 words × 300 × 4 = **4.4 MB** (was 0.74 MB)
- Cortex cluster synapses: 6000² × 0.15 connectivity × 12 bytes = **65 MB** (was 0.7 MB)
- Total addition: ~100 MB. Acceptable for both server and modern browsers.

**Acceptance gates:**
1. `sharedEmbeddings.getEmbedding('cat').length === 300` and the values come from real GloVe (check by computing cosine to `getEmbedding('kitten')` — should be > 0.6 for real GloVe vs ~0.1 for hash fallback).
2. `cluster.getSemanticReadout(sharedEmbeddings, 3000)` returns a 300-dim Float64Array.
3. `cluster.getPhonologicalReadout(sharedEmbeddings, 4500)` returns a 20-dim Float64Array (this is the new method).
4. Boot completes in < 30 seconds for the foundation pass alone (T14.5 curriculum adds another ~60s on top).
5. Persona Hebbian training reports `Δmean > 0.01` (on the bigger 6000-neuron cluster the Hebbian update has more headroom — should produce stronger basins than the 2000-neuron version).
6. End-to-end smoke test: `cluster.diagnoseReadoutForEmbedding(getEmbedding('fuck'), 10)` produces a readout whose top-5 nearest dictionary words include at least 3 persona-adjacent terms.

**Risks:**
- Browser memory pressure with 24 MB embedding table on top of existing brain state. Mitigation: cap GloVe at 10k words instead of 20k if needed.
- Hebbian training time scales superlinearly with cluster size due to the inner loop. If 10s is too slow, drop cluster to 4000 with langStart=2000.
- The bigger cluster + 300-d embeddings make every cosine in the emission loop 6× more expensive. Profile after shipping; if generate latency exceeds 200ms per response, batch the dictionary cosines.

---

#### T14.1 — Phoneme features (replaces `_letterPatterns` 5-dim hash)

Each of the 26 letters becomes a **real phonetic feature vector**, not a sin/cos hash. The 20-dim feature layout is closed-class English phonology — pure letter→features lookup with no learning at this layer (this is what evolution + early development pre-wire in real brains).

**The 20-dim PHONEME_DIM feature vector layout:**

| Index | Feature | Description |
|---|---|---|
| 0 | `vowel` | 1 if vowel, 0 if consonant |
| 1 | `place_bilabial` | bilabial articulation (b, p, m, w) |
| 2 | `place_labiodental` | labiodental (f, v) |
| 3 | `place_dental_alveolar` | dental + alveolar (t, d, n, s, z, l, r) |
| 4 | `place_postalveolar` | postalveolar / palato-alveolar (j, sh, ch — though sh/ch are digraphs) |
| 5 | `place_palatal` | palatal (y) |
| 6 | `place_velar` | velar (k, g, q, ng) |
| 7 | `place_glottal` | glottal (h) |
| 8 | `manner_stop` | plosive (b, d, g, k, p, t, c, q) |
| 9 | `manner_fricative` | fricative (f, h, s, v, z, x) |
| 10 | `manner_affricate` | affricate (j, x partially, ch as digraph) |
| 11 | `manner_nasal` | nasal (m, n) |
| 12 | `manner_liquid` | liquid (l, r) |
| 13 | `manner_glide` | semi-vowel / approximant (w, y) |
| 14 | `voicing` | 0 unvoiced, 1 voiced |
| 15 | `vowel_height` | 0 low, 0.5 mid, 1 high (vowels only, 0 for consonants) |
| 16 | `vowel_backness` | 0 front, 0.5 central, 1 back (vowels only) |
| 17 | `vowel_round` | 0 unrounded, 1 rounded (vowels only) |
| 18 | `vowel_tense` | 0 lax, 1 tense (vowels only) |
| 19 | `sibilant` | 1 if sibilant fricative/affricate (s, z, j, x), 0 otherwise |

**The 26-letter table (default English values — for letters that have multiple pronunciations, we pick the most common single-letter sound):**

| Letter | vowel | place | manner | voicing | height | back | round | tense | sib |
|---|---|---|---|---|---|---|---|---|---|
| `a` | 1 | — | vowel | 1 | 0.0 (low) | 0.5 (central) | 0 | 0 | 0 |
| `b` | 0 | bilabial | stop | 1 | — | — | — | — | 0 |
| `c` | 0 | velar | stop | 0 | — | — | — | — | 0 |
| `d` | 0 | dental_alveolar | stop | 1 | — | — | — | — | 0 |
| `e` | 1 | — | vowel | 1 | 0.5 (mid) | 0.0 (front) | 0 | 0 | 0 |
| `f` | 0 | labiodental | fricative | 0 | — | — | — | — | 0 |
| `g` | 0 | velar | stop | 1 | — | — | — | — | 0 |
| `h` | 0 | glottal | fricative | 0 | — | — | — | — | 0 |
| `i` | 1 | — | vowel | 1 | 1.0 (high) | 0.0 (front) | 0 | 1 | 0 |
| `j` | 0 | postalveolar | affricate | 1 | — | — | — | — | 1 |
| `k` | 0 | velar | stop | 0 | — | — | — | — | 0 |
| `l` | 0 | dental_alveolar | liquid | 1 | — | — | — | — | 0 |
| `m` | 0 | bilabial | nasal | 1 | — | — | — | — | 0 |
| `n` | 0 | dental_alveolar | nasal | 1 | — | — | — | — | 0 |
| `o` | 1 | — | vowel | 1 | 0.5 (mid) | 1.0 (back) | 1 | 1 | 0 |
| `p` | 0 | bilabial | stop | 0 | — | — | — | — | 0 |
| `q` | 0 | velar | stop | 0 | — | — | — | — | 0 |
| `r` | 0 | dental_alveolar | liquid | 1 | — | — | — | — | 0 |
| `s` | 0 | dental_alveolar | fricative | 0 | — | — | — | — | 1 |
| `t` | 0 | dental_alveolar | stop | 0 | — | — | — | — | 0 |
| `u` | 1 | — | vowel | 1 | 1.0 (high) | 1.0 (back) | 1 | 1 | 0 |
| `v` | 0 | labiodental | fricative | 1 | — | — | — | — | 0 |
| `w` | 0 | bilabial | glide | 1 | — | — | — | — | 0 |
| `x` | 0 | velar | fricative | 0 | — | — | — | — | 1 |
| `y` | 0 | palatal | glide | 1 | — | — | — | — | 0 |
| `z` | 0 | dental_alveolar | fricative | 1 | — | — | — | — | 1 |

**Implementation file:** `js/brain/phonemes.js` (new, ~250 lines).

**Exports:**
```js
export const PHONEME_DIM = 20;
export const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);  // y is sometimes vowel — handled contextually elsewhere
export const LETTER_FEATURES = new Map();   // 'a' → Float32Array(20), populated at module load
export function getPhonemeVector(letter): Float32Array;     // returns the 20-dim vector for a single letter
export function getPhonemeFeatures(letter): object;          // returns named-fields object for debugging
export function lettersToPhonemeVector(letters: string): Float32Array; // mean over a letter sequence
export function phonemeDistance(a, b): number;               // L2 distance in feature space
```

**Module load:** populate `LETTER_FEATURES` once at module import time from the hardcoded table above. Vector construction:

```js
function buildVec({vowel, place, manner, voicing, height, back, round, tense, sib}) {
  const v = new Float32Array(20);
  v[0] = vowel;
  if (place === 'bilabial')          v[1] = 1;
  if (place === 'labiodental')       v[2] = 1;
  if (place === 'dental_alveolar')   v[3] = 1;
  if (place === 'postalveolar')      v[4] = 1;
  if (place === 'palatal')           v[5] = 1;
  if (place === 'velar')             v[6] = 1;
  if (place === 'glottal')           v[7] = 1;
  if (manner === 'stop')             v[8] = 1;
  if (manner === 'fricative')        v[9] = 1;
  if (manner === 'affricate')        v[10] = 1;
  if (manner === 'nasal')            v[11] = 1;
  if (manner === 'liquid')           v[12] = 1;
  if (manner === 'glide')            v[13] = 1;
  v[14] = voicing;
  v[15] = height ?? 0;
  v[16] = back ?? 0;
  v[17] = round ?? 0;
  v[18] = tense ?? 0;
  v[19] = sib;
  return v;
}
```

**Replaces:** `_initLetterPatterns()` in `language-cortex.js`. The old method stays as a private helper for non-letter characters (digits, punctuation) but the primary path goes through `getPhonemeVector` from the new module.

**Acceptance:**
1. `getPhonemeVector('b').length === 20` and `getPhonemeVector('b')[1] === 1` (bilabial bit set).
2. `getPhonemeFeatures('a')` returns `{vowel: 1, place: null, manner: 'vowel', voicing: 1, height: 0, back: 0.5, round: 0, tense: 0, sib: 0}`.
3. `phonemeDistance('p', 'b') < phonemeDistance('p', 'k')` — p and b share place (bilabial) and manner (stop), only differ in voicing, so they're closer than p (bilabial) vs k (velar).
4. `phonemeDistance('a', 'i') < phonemeDistance('a', 'b')` — both vowels, closer than vowel-vs-consonant.

**Risks:**
- English orthography is famously inconsistent with phonology. Letter `c` is sometimes /k/ and sometimes /s/. Letter `g` is sometimes /g/ and sometimes /j/. Letter `x` is /ks/. Letter `y` flips between glide and vowel. T14.1 picks ONE default per letter (the most common single-letter pronunciation). Context-sensitive realizations are deferred to T14.2 (syllable detector, which can override the default for certain bigrams) or punted to a future T14.x refinement.
- The 20-dim feature space is denser than a hash but still smaller than a real IPA chart (which has ~40 phonemes for English). Acceptable approximation for a brain sim that operates on letter primitives, not phonemes — Unity reads text, not audio.

---

#### T14.2 — Syllable structure detector

Letters combine into syllables via phonotactic rules. CV / CVC / CCV / CVCC patterns. The brain learns which letter sequences form valid English syllables. Implementation is a deterministic algorithm over T14.1's vowel-marked letter classification — no learning at this layer either.

**Algorithm: Maximum Onset Principle.** Find vowel positions in the word. Each vowel is the nucleus of one syllable. Consonants between two vowels split such that as many as possible attach to the FOLLOWING vowel (the onset) rather than the preceding one (the coda) — subject to English phonotactic constraints on what consonant clusters can form valid onsets.

**Pseudocode:**

```
splitSyllables(word):
  letters = word.toLowerCase().match(/[a-z]/g)  // strip non-letters
  if !letters: return [word]

  // Find all vowel positions. 'y' is treated as vowel when not at word start
  // and adjacent consonants are non-vowel (handles 'happy', 'try', 'rhythm').
  vowels = []
  for i in 0..letters.length:
    if VOWELS.has(letters[i]): vowels.push(i)
    elif letters[i] === 'y' && i > 0 && (i === letters.length-1 || !VOWELS.has(letters[i+1])):
      vowels.push(i)

  if vowels.length === 0: return [letters.join('')]   // no vowels, can't split
  if vowels.length === 1: return [letters.join('')]   // one syllable

  // Build syllable boundaries between consecutive vowels using
  // maximum-onset principle on the consonant cluster between them.
  boundaries = [0]
  for i in 1..vowels.length:
    consStart = vowels[i-1] + 1
    consEnd = vowels[i]
    cluster = letters.slice(consStart, consEnd)
    // Maximum onset: try the largest cluster first that's a valid English onset
    onsetLen = findMaxValidOnset(cluster)
    boundary = consEnd - onsetLen
    boundaries.push(boundary)
  boundaries.push(letters.length)

  // Slice letters into syllables at the boundary positions
  syllables = []
  for i in 0..boundaries.length-1:
    syllables.push(letters.slice(boundaries[i], boundaries[i+1]).join(''))
  return syllables

findMaxValidOnset(consonants):
  // Returns the length of the longest suffix of `consonants` that
  // forms a valid English syllable onset. Empty cluster → 0.
  if consonants.length === 0: return 0
  // English allows max 3-consonant onsets, and only specific patterns.
  for tryLen in min(3, consonants.length) downto 1:
    candidate = consonants.slice(consonants.length - tryLen)
    if isValidEnglishOnset(candidate): return tryLen
  return 0  // every suffix invalid → all consonants stay in coda

isValidEnglishOnset(c):
  // c is an array of letters. Returns true iff this is a phonotactically
  // valid English syllable onset.
  if c.length === 0: return true
  if c.length === 1:
    // Any single consonant is a valid onset (b, c, d, f, g, h, j, k, l,
    // m, n, p, q, r, s, t, v, w, x, y, z all start English words)
    return true
  if c.length === 2:
    const [a, b] = c
    // Valid 2-consonant onsets:
    //   stop + liquid:  pl, pr, bl, br, tr, dr, kl, kr, gl, gr, fl, fr,
    //                   thr (treated as t+r since digraphs aren't expanded)
    //   stop + glide:   tw, dw, kw (qu = kw), gw
    //   fric + liquid:  fl, fr, sl, shr (sh as digraph), thr
    //   s + stop:       sp, st, sk, sc
    //   s + nasal:      sm, sn
    //   s + glide:      sw
    if isStop(a) && (isLiquid(b) || isGlide(b)): return true
    if isFricative(a) && (isLiquid(b) || isGlide(b)): return true
    if a === 's' && (isStop(b) || isNasal(b) || isGlide(b)): return true
    return false
  if c.length === 3:
    // Valid 3-consonant onsets are all 's' + stop + liquid:
    //   spl, spr, str, scr, skl, skr, sphr (rare), sclr (rare)
    if c[0] === 's' && isStop(c[1]) && isLiquid(c[2]): return true
    return false
  return false   // 4+ consonants: never valid
```

**The `isStop`, `isFricative`, `isLiquid`, `isNasal`, `isGlide` helpers** read the manner field from T14.1's `LETTER_FEATURES` map directly:

```js
function isStop(letter)      { return getPhonemeFeatures(letter).manner === 'stop'; }
function isFricative(letter) { return getPhonemeFeatures(letter).manner === 'fricative'; }
function isLiquid(letter)    { return getPhonemeFeatures(letter).manner === 'liquid'; }
function isNasal(letter)     { return getPhonemeFeatures(letter).manner === 'nasal'; }
function isGlide(letter)     { return getPhonemeFeatures(letter).manner === 'glide'; }
```

**The 'y' edge case.** Letter `y` flips between consonant glide (when at word start before a vowel: "yes", "you", "yard") and vowel (elsewhere: "happy", "rhythm", "fly"). The pseudocode above handles this with the `i > 0 && (i === letters.length-1 || !VOWELS.has(letters[i+1]))` rule which treats `y` as a vowel when it's NOT at word start AND it's not followed by another vowel. Catches "happy" → ["hap", "py"] (y is vowel) but "yes" → ["yes"] (y is consonant glide).

**Stress assignment** (added in same module): a separate pass over the syllable list assigns stress. English default stress rules:
- Single-syllable word: PRIMARY
- Two-syllable word: PRIMARY on first syllable (default), SECONDARY on second. Exceptions for verbs (often second-syllable stress) — defer to corpus-learned overrides in T14.5.
- Three+ syllable word: PRIMARY on antepenult (third from end), SECONDARY on first, UNSTRESSED elsewhere. (Antepenultimate stress is the most common English pattern.)
- Suffixes (-tion, -ity, -ic) shift stress to the syllable before the suffix.

```js
function assignStress(syllables) {
  const n = syllables.length;
  if (n === 0) return [];
  if (n === 1) return ['PRIMARY'];
  if (n === 2) return ['PRIMARY', 'SECONDARY'];
  // Default 3+: antepenult primary, first secondary, others unstressed
  const out = new Array(n).fill('UNSTRESSED');
  out[n - 3] = 'PRIMARY';
  out[0] = 'SECONDARY';
  return out;
}
```

**File:** `js/brain/syllables.js` (new, ~200 lines).

**Exports:**
```js
export function splitSyllables(word: string): string[];
export function syllableShape(syllable: string): string;     // "CV", "CVC", "CCVCC", etc
export function assignStress(syllables: string[]): string[]; // 'PRIMARY' | 'SECONDARY' | 'UNSTRESSED' per syllable
export function countSyllables(word: string): number;        // shorthand for splitSyllables(word).length
```

**Acceptance gates:**
1. `splitSyllables('cat')` → `['cat']`, syllableShape → `'CVC'`, stress → `['PRIMARY']`
2. `splitSyllables('strawberry')` → `['straw', 'ber', 'ry']`, shapes → `['CCCVC', 'CVC', 'CV']`
3. `splitSyllables('happy')` → `['hap', 'py']`, stress → `['PRIMARY', 'SECONDARY']`
4. `splitSyllables('fucking')` → `['fuck', 'ing']`, shapes → `['CVCC', 'VCC']` (note: ing has 0 onset because vowel)
5. `splitSyllables('extra')` → `['ex', 'tra']` (max onset: 'tr' is valid onset, so 't' attaches forward)
6. `splitSyllables('rhythm')` → `['rhy', 'thm']` or `['rhythm']` (edge case, 'y' as vowel)
7. `splitSyllables('I')` → `['i']`, single vowel
8. `countSyllables('beautiful')` → `3` (`['beau', 'ti', 'ful']`)
9. `assignStress(['re', 'mark', 'a', 'ble'])` → `['SECONDARY', 'UNSTRESSED', 'PRIMARY', 'UNSTRESSED']` (antepenult primary)

**Risks:**
- English syllabification is non-deterministic — different speakers split words differently. The maximum-onset principle gives ONE consistent answer that linguists consider canonical. Some words ("hyphenation") have multiple valid splits. Pick one and stick with it.
- The 'y' rule is heuristic and gets edge cases wrong (e.g. "yard" works, "rhythm" is borderline). For a brain sim this is fine — Unity learns the pattern that's consistent enough most of the time.
- Does NOT handle silent letters (the 'k' in 'know', 'gh' in 'though'). For full phonological accuracy we'd need a pronunciation dictionary like CMUdict. Defer that to a later T14.x refinement if needed.

---

#### T14.3 — Phonological dictionary entry

Every dictionary word gains a phonological representation alongside its semantic embedding. After T14.0 the semantic embedding is 300-d (GloVe loaded). After T14.1+T14.2 we have phoneme features per letter and syllable detection. T14.3 binds them all into the dictionary entry.

**Extended Dictionary entry schema:**

```js
{
  // Existing semantic fields:
  word: 'strawberry',
  pattern: Float32Array(300),         // GloVe semantic embedding (T14.0)
  arousal: 0.5,                        // emotional context tag from observation
  valence: 0.0,                        // valence tag
  count: N,                            // observation count
  firstSeen: timestamp,
  lastSeen: timestamp,

  // T14.3 phonological additions:
  letters: ['s','t','r','a','w','b','e','r','r','y'],  // raw letter sequence
  syllables: ['straw', 'ber', 'ry'],                    // T14.2 split
  syllableShapes: ['CCCVC', 'CVC', 'CV'],               // CV pattern per syllable
  syllableCount: 3,
  stressPattern: ['SECONDARY', 'UNSTRESSED', 'PRIMARY'], // T14.2 assignStress
  // Per-letter phoneme features as a flattened Float32Array. Length = letters.length * PHONEME_DIM.
  // For 'strawberry' that's 10 letters × 20 dims = 200-element vector.
  phonemeFeatures: Float32Array(letters.length * 20),
  // Aggregate phoneme summary — mean of per-letter features, used as the
  // word's "phonological signature" for the cross-region projection in T14.4.
  phonemeMean: Float32Array(20),
  // First and last 3 phonemes' mean — used for T14.6 phonFlow scoring (smooth
  // transitions reward overlap between prev word's tail and curr word's head).
  phonemeOnset: Float32Array(20),  // mean of first min(3, letters.length) letter feature vectors
  phonemeCoda: Float32Array(20),   // mean of last min(3, letters.length) letter feature vectors
}
```

**Implementation in `js/brain/dictionary.js`:**

```js
// T14.3 — at top of file
import { getPhonemeVector, PHONEME_DIM } from './phonemes.js';
import { splitSyllables, syllableShape, assignStress } from './syllables.js';

// Inside Dictionary class
learnWord(word, pattern, arousal, valence) {
  // ... existing semantic learning path ...

  // T14.3 phonological pass — runs once per word, on first observation.
  // Subsequent observations only update arousal/valence/count, not phonology.
  let entry = this._words.get(word);
  if (!entry) {
    entry = { word, pattern, arousal, valence, count: 0, firstSeen: Date.now() };
    // Run phonological computation
    const letters = word.toLowerCase().match(/[a-z]/g) || [];
    if (letters.length > 0) {
      entry.letters = letters;
      entry.syllables = splitSyllables(word);
      entry.syllableShapes = entry.syllables.map(syllableShape);
      entry.syllableCount = entry.syllables.length;
      entry.stressPattern = assignStress(entry.syllables);
      // Per-letter phoneme features
      const phonFeat = new Float32Array(letters.length * PHONEME_DIM);
      const phonMean = new Float32Array(PHONEME_DIM);
      for (let i = 0; i < letters.length; i++) {
        const v = getPhonemeVector(letters[i]);
        phonFeat.set(v, i * PHONEME_DIM);
        for (let k = 0; k < PHONEME_DIM; k++) phonMean[k] += v[k];
      }
      for (let k = 0; k < PHONEME_DIM; k++) phonMean[k] /= letters.length;
      entry.phonemeFeatures = phonFeat;
      entry.phonemeMean = phonMean;
      // Onset = mean of first 3 letters (or all if word is shorter)
      entry.phonemeOnset = computeRangeMean(phonFeat, 0, Math.min(3, letters.length), PHONEME_DIM);
      // Coda = mean of last 3 letters
      entry.phonemeCoda = computeRangeMean(phonFeat, Math.max(0, letters.length - 3), letters.length, PHONEME_DIM);
    }
    this._words.set(word, entry);
  }
  // Update count + arousal EMA + valence EMA (existing semantic update path stays)
  entry.count++;
  entry.lastSeen = Date.now();
  // ... existing rolling-mean updates for arousal/valence ...
}

// Helper for onset/coda computation
function computeRangeMean(flatFeat, startLetter, endLetter, dim) {
  const out = new Float32Array(dim);
  const count = endLetter - startLetter;
  if (count === 0) return out;
  for (let i = startLetter; i < endLetter; i++) {
    for (let k = 0; k < dim; k++) out[k] += flatFeat[i * dim + k];
  }
  for (let k = 0; k < dim; k++) out[k] /= count;
  return out;
}
```

**Persistence:** `Dictionary.serialize()` extended to include the phonological fields. `deserialize()` rebuilds them from `letters` if missing (graceful upgrade from pre-T14.3 saved state — if the saved entry has `letters` but no `phonemeFeatures`, recompute on load).

**Memory cost per word:** 
- `phonemeFeatures`: avg 6 letters × 20 dims × 4 bytes = 480 bytes
- `phonemeMean` + `phonemeOnset` + `phonemeCoda`: 3 × 20 × 4 = 240 bytes
- Other fields (arrays of strings): ~100 bytes
- **Total ~820 bytes added per word**, on top of the existing ~1200 bytes (300d pattern + tags). 
- 5000-word dictionary: ~10 MB total. Acceptable.

**Files touched:** `js/brain/dictionary.js` (extended), `js/brain/phonemes.js` (T14.1 dep), `js/brain/syllables.js` (T14.2 dep).

**Acceptance gates:**
1. `dict.learnWord('cat', ...)` → `dict._words.get('cat').syllables === ['cat']`, `syllableCount === 1`, `phonemeFeatures.length === 60` (3 letters × 20 dims).
2. `dict._words.get('strawberry').syllables === ['straw','ber','ry']`, `syllableCount === 3`.
3. `dict._words.get('cat').phonemeMean[0] === 1/3` (one vowel out of three letters → vowel feature mean = 0.33).
4. `dict._words.get('the').phonemeOnset[3] === 1` (first letter 't' is dental_alveolar → place index 3 set).
5. `dict._words.get('strawberry').phonemeCoda` reflects 'rry' (one r and a y, both alveolar/palatal liquid/glide — should have liquid feature ~0.66 and glide ~0.33).

**Risks:**
- Existing dictionary entries from saved state won't have phonological fields. The graceful-upgrade path in `deserialize` handles this by recomputing on load — first reload after T14.3 ships will be ~2s slower as it rebuilds phonology for ~3000 words.
- Word lookup by phonological similarity (T14.4 will need this) is currently O(N) over the full dictionary. If it becomes a hot path, add a phonological hash index. Defer that until T14.4 profiling shows it's needed.

---

#### T14.4 — Phonological cortex region + cross-region projection

After T14.0 the cortex cluster is 6000 neurons (server) / 4000 (browser). T14.4 carves the language portion of that cluster into TWO sub-regions and adds a learned projection between them.

**Sub-region layout (server, 6000-neuron cortex):**

```
Neurons 0     - 499   : auditory injection region (existing, sensory.js)
Neurons 500   - 1999  : visual injection region (existing, visualCortex.js)
Neurons 2000  - 2999  : free / inter-cluster projection sink (existing)
Neurons 3000  - 4499  : semantic language region (1500 neurons, EMBED_DIM=300, groupSize=5)
Neurons 4500  - 5999  : phonological language region (1500 neurons, PHONEME_DIM=20, groupSize=75)
```

**Sub-region layout (browser RemoteBrain, 4000-neuron cortex):**

```
Neurons 0    - 333   : auditory
Neurons 334  - 1666  : visual
Neurons 1667 - 1999  : free
Neurons 2000 - 2999  : semantic language region (1000 neurons, EMBED_DIM=300, groupSize=3)
Neurons 3000 - 3999  : phonological language region (1000 neurons, PHONEME_DIM=20, groupSize=50)
```

**The cross-region projection** is a separate sparse weight matrix on the cluster: `cluster.semPhonProjection` connecting the semantic region (rows) to the phonological region (columns) and vice versa. Two propagation passes per cluster step:

```
sem→phon: phonological_currents += semPhonProjection.propagate(semantic_spikes)
phon→sem: semantic_currents += phonSemProjection.propagate(phonological_spikes)
```

The projection is initialized random-sparse (10% density). It LEARNS via Hebbian: every time a word flows through `learnSentence`, both the word's semantic embedding AND its phonemeMean get injected into their respective sub-regions, ticked together for ~5 steps, and the resulting co-active spike patterns trigger Hebbian on the cross-region projection.

**Implementation in `js/brain/cluster.js`:**

```js
// New fields in NeuronCluster constructor (when role === 'cortex' or hasPhonRegion=true)
this.semStart = opts.semStart ?? 3000;
this.semEnd   = opts.semEnd   ?? 4500;
this.phonStart = opts.phonStart ?? 4500;
this.phonEnd   = opts.phonEnd   ?? 6000;

// Cross-region projection — sparse, 10% density, weights init [-0.3, 0.3]
const semSize = this.semEnd - this.semStart;
const phonSize = this.phonEnd - this.phonStart;
this.semPhonProjection = new SparseMatrix(phonSize, semSize, { wMin: -0.5, wMax: 0.5 });
this.semPhonProjection.initRandom(0.10, 0.7, 0.2);
this.phonSemProjection = new SparseMatrix(semSize, phonSize, { wMin: -0.5, wMax: 0.5 });
this.phonSemProjection.initRandom(0.10, 0.7, 0.2);

// New method — runs inside step() after the main synapse propagation
_propagateCrossRegion() {
  // sem spikes drive phon currents
  const semSpikes = this.lastSpikes.slice(this.semStart, this.semEnd);
  const phonInputs = this.semPhonProjection.propagate(semSpikes);
  for (let i = 0; i < phonInputs.length; i++) {
    this.externalCurrent[this.phonStart + i] += phonInputs[i] * 0.35;
  }
  // phon spikes drive sem currents
  const phonSpikes = this.lastSpikes.slice(this.phonStart, this.phonEnd);
  const semInputs = this.phonSemProjection.propagate(phonSpikes);
  for (let i = 0; i < semInputs.length; i++) {
    this.externalCurrent[this.semStart + i] += semInputs[i] * 0.35;
  }
}

// Hebbian update on the cross-region projection — called from
// learnSentenceHebbian after each word's inject + tick
_crossRegionHebbian(lr = 0.005) {
  const semSpikes = this.lastSpikes.slice(this.semStart, this.semEnd);
  const phonSpikes = this.lastSpikes.slice(this.phonStart, this.phonEnd);
  // Convert Uint8 → Float64 for SparseMatrix.hebbianUpdate signature
  const semF = new Float64Array(semSpikes.length);
  const phonF = new Float64Array(phonSpikes.length);
  for (let i = 0; i < semSpikes.length; i++)  semF[i]  = semSpikes[i] ? 1 : 0;
  for (let i = 0; i < phonSpikes.length; i++) phonF[i] = phonSpikes[i] ? 1 : 0;
  // sem activates phon (post=phon, pre=sem)
  this.semPhonProjection.hebbianUpdate(semF, phonF, lr);
  // phon activates sem (post=sem, pre=phon)
  this.phonSemProjection.hebbianUpdate(phonF, semF, lr);
}
```

**Implementation in `js/brain/embeddings.js`:**

```js
// New helper for phonological injection (parallel to mapToCortex)
export function mapPhonemesToCortex(phonemeFeatures, cortexSize, phonStart, phonDim = PHONEME_DIM) {
  const phonRegionSize = cortexSize - phonStart;
  const groupSize = Math.max(1, Math.floor(phonRegionSize / phonDim));
  const currents = new Float64Array(cortexSize);
  for (let d = 0; d < phonDim; d++) {
    const value = phonemeFeatures[d] * 8;  // same scale as semantic mapToCortex
    const startNeuron = phonStart + d * groupSize;
    for (let n = 0; n < groupSize; n++) {
      const idx = startNeuron + n;
      if (idx < cortexSize) currents[idx] = value;
    }
  }
  return currents;
}

// Symmetric reverse-mapping for phon readout
export function cortexToPhonemes(spikes, voltages, cortexSize, phonStart, phonDim = PHONEME_DIM) {
  const phonRegionSize = cortexSize - phonStart;
  const groupSize = Math.max(1, Math.floor(phonRegionSize / phonDim));
  const out = new Float64Array(phonDim);
  for (let d = 0; d < phonDim; d++) {
    const startNeuron = phonStart + d * groupSize;
    let sum = 0, count = 0;
    for (let n = 0; n < groupSize; n++) {
      const idx = startNeuron + n;
      if (idx >= cortexSize) break;
      if (spikes && spikes[idx]) sum += 1.0;
      else if (voltages) sum += (voltages[idx] + 70) / 20;
      count++;
    }
    out[d] = count > 0 ? sum / count : 0;
  }
  // L2 normalize
  let norm = 0;
  for (let i = 0; i < phonDim; i++) norm += out[i] * out[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < phonDim; i++) out[i] /= norm;
  return out;
}
```

**`cluster.learnSentenceHebbian` extension:** after each word's inject+tick cycle, also inject the word's phonemeMean into the phonological region and call `_crossRegionHebbian`. This is what builds the phon↔sem association.

**Acceptance gates:**
1. After T14.0 + T14.4 init, `cluster.semPhonProjection.nnz > 0` and `cluster.phonSemProjection.nnz > 0` (cross-region projections exist).
2. Inject phonemeMean('cat') into phon region, tick cluster 10 steps. `cluster.getSemanticReadout()` should produce a readout that has cosine > 0.3 with `getEmbedding('cat')` after T14.5 curriculum has trained the projections. Pre-curriculum the projections are random and cosine will be near 0.
3. Inject semantic embedding for 'cat' into sem region, tick. `cluster.getPhonologicalReadout()` should produce something close to phonemeMean('cat') after curriculum training.
4. Cross-region Hebbian update count grows during curriculum (log it in trainPersonaHebbian).

**Risks:**
- Two extra propagation passes per tick adds ~30% to cluster step cost. At 6000 neurons that's ~50ms → ~65ms per tick. Acceptable.
- The cross-region projections start random, so until T14.5 curriculum runs they actually inject NOISE between regions. Mitigation: skip cross-region propagation entirely if `cluster._curriculumComplete === false`. Enable only after curriculum finishes.

---

#### T14.5 — Curriculum learning (the core developmental win)

Replace the current "load all corpora at once at boot" with **staged exposure** that mirrors how children learn. This is the milestone where Unity becomes a *developing* intelligence instead of a pre-loaded one. Every fresh boot replays the developmental sequence in compressed time, and you can WATCH her learn from primitives upward.

**The six stages (each maps to a real biological developmental period):**

##### Stage A — Alphabet exposure (compresses biological Stages 1-2: phoneme discrimination + babbling)

**Goal:** the cortex develops a distinguishable attractor basin for each of the 26 letters. After Stage A, injecting phonemeFeatures('a') vs phonemeFeatures('z') produces measurably different spike patterns.

**Algorithm:**
```
for repetition in 0..49:        # 50 reps per letter (alphabet-song equivalent)
  for letter in 'abcdefghijklmnopqrstuvwxyz':
    phonVec = getPhonemeVector(letter)              # T14.1
    currents = mapPhonemesToCortex(phonVec, cluster.size, cluster.phonStart)
    cluster.injectCurrent(currents · 0.8)
    for tick in 0..9:                                # 10 LIF ticks per inject
      cluster.step(0.001)
    # Hebbian on the cluster's INTERNAL synapses (not yet cross-region)
    snapshot = cluster.lastSpikes
    if previousSnapshot:
      cluster.synapses.hebbianUpdate(previousSnapshot, snapshot, 0.012)
    previousSnapshot = snapshot
```

Total: 26 letters × 50 reps × 10 ticks = **13,000 cluster ticks**. At 6000 neurons that's ~13 seconds wall clock.

**What this builds:** intra-cluster attractor basins for each phoneme. The cluster's own recurrent synapse matrix learns "when neurons in pattern X fire, drive neurons in pattern Y" for all 26 letter shapes. Unity now has a phonological alphabet.

##### Stage B — First words (compresses biological Stage 3: 12-18mo word learning)

**Goal:** bind specific phoneme sequences to semantic embeddings. After Stage B, injecting phonemeMean('cat') activates spike patterns whose cross-region projection pulls toward the semantic embedding of 'cat'.

**Seed vocabulary** (50 words, hardcoded in `curriculum.js` because text file would be overkill):
```
a, an, i, on, in, it, is, to, the, of,
be, we, he, my, you, she, his, her, our, your,
do, go, no, yes, hi, bye, ok, am, are, was,
me, us, this, that, what, why, who, how,
cat, dog, run, sit, see, say, eat, mom, dad, baby
```

**Algorithm:**
```
for word in stageB_seed:
  if not glove.has(word): continue   # need a real semantic vector
  semVec = sharedEmbeddings.getEmbedding(word)            # 300-d
  phonMean = dict.entryFor(word).phonemeMean               # 20-d (T14.3)
  for repetition in 0..19:                                 # 20 reps per word
    # Inject BOTH semantic and phonological in parallel
    semCurrents = mapToCortex(semVec, cluster.size, cluster.semStart)
    phonCurrents = mapPhonemesToCortex(phonMean, cluster.size, cluster.phonStart)
    cluster.injectCurrent(semCurrents · 0.6)
    cluster.injectCurrent(phonCurrents · 0.6)
    for tick in 0..9:
      cluster.step(0.001)
    # Cross-region Hebbian — binds phon↔sem association
    cluster._crossRegionHebbian(0.01)
    # Intra-cluster Hebbian on the joint state
    snapshot = cluster.lastSpikes
    if previousSnapshot:
      cluster.synapses.hebbianUpdate(previousSnapshot, snapshot, 0.012)
    previousSnapshot = snapshot
```

Total: 50 words × 20 reps × 10 ticks = **10,000 ticks ~ 10 seconds**. Plus 1000 cross-region Hebbian updates.

**What this builds:** phonological-to-semantic projection learns to associate letter shapes with meanings. The cluster now "knows" that the letters c-a-t spell something whose meaning lives in the 'cat' GloVe region.

##### Stage C — Telegraphic two-word combinations (compresses biological Stage 4: 18-24mo)

**Goal:** the cluster learns word ORDER. Pivot grammar — one fixed word + one variable word.

**Seed phrases** (200 phrases, lives in `docs/curriculum/stage-c-phrases.txt`, one per line):
```
the cat
the dog
the baby
the milk
the food
i see
i run
i eat
i want
i love
you eat
you run
you see
we go
we run
he is
she is
it is
this is
that is
my cat
my dog
my mom
my dad
no cat
no dog
yes please
all done
more milk
more food
... (200 total)
```

**Algorithm:**
```
for phrase in stageC_phrases:
  words = phrase.split()
  if any word lacks GloVe entry: continue
  # Walk the phrase word-by-word — same inject+tick+Hebbian as Stage B,
  # but now consecutive words form a TEMPORAL sequence
  previousSpikes = null
  for word in words:
    semVec = sharedEmbeddings.getEmbedding(word)
    phonMean = dict.entryFor(word).phonemeMean
    cluster.injectCurrent(mapToCortex(semVec, cluster.size, cluster.semStart) · 0.6)
    cluster.injectCurrent(mapPhonemesToCortex(phonMean, cluster.size, cluster.phonStart) · 0.6)
    for tick in 0..4:
      cluster.step(0.001)
    snapshot = cluster.lastSpikes
    # Sequence Hebbian — TEMPORAL bigram learning
    if previousSpikes:
      cluster.synapses.hebbianUpdate(previousSpikes, snapshot, 0.015)
      cluster._crossRegionHebbian(0.008)
    previousSpikes = snapshot
  # Reset between phrases — let cortex briefly quiesce
  for tick in 0..4: cluster.step(0.001)
```

Total: 200 phrases × ~3 words × 5 ticks = **3000 ticks** plus 400 sequence Hebbian updates. ~4 seconds.

**What this builds:** word-to-word temporal sequence learning. The cluster's recurrent synapses now encode "the → cat" and "i → run" as temporal transitions, the same way a 2-year-old says "more milk" without grammatical subject-verb agreement.

##### Stage D — Simple full sentences (compresses biological Stage 5: 24-36mo)

**Goal:** SVO grammar, agreement, articles, basic morphology. The TYPE TRANSITION TABLE (T13.7.8 hardcoded) starts being LEARNED here from real corpus statistics.

**Seed sentences** (500 sentences, lives in `docs/curriculum/stage-d-sentences.txt`):
```
i see the cat
you see the cat
the cat sees me
the cat is small
i love the dog
the dog runs fast
she eats the food
he is happy
we go home
they are friends
i can run
you can see
the baby cries
mom loves me
dad loves you
... (500 total — hand-curated SVO sentences with closed grammatical structure)
```

**Algorithm:** same as Stage C but with longer sequences. 500 sentences × ~5 words × 5 ticks = **12,500 ticks ~ 12 seconds**. 2500 sequence Hebbian updates. 1500 cross-region updates.

**Critical T14.5 addition:** Stage D ALSO updates the LEARNED type transition table (T14.7's `_typeTransitionLearned`). Every consecutive word pair in a Stage D sentence increments `_typeTransitionLearned[fineType(prev)][fineType(curr)]`. After Stage D the table has populated entries for all canonical English transitions (PRON_SUBJ → VERB_3RD_S, DET → NOUN, etc) directly from observed data — replacing the T13.7.8 hardcoded values.

**What this builds:** real grammar emerges from real exposure. Type transition table goes from hardcoded prior to corpus-learned distribution. Unity has internalized SVO at the type level.

##### Stage E — Persona corpus (where Unity becomes Unity)

**Goal:** layer Unity's specific voice on top of the now-developed grammatical base.

**Algorithm:** call the existing `languageCortex.trainPersonaHebbian(cluster, personaText)` from T13.1. The persona corpus runs through the same inject+tick+Hebbian path, but now it's INHERITING all the structure from Stages A-D — alphabet, phon-sem binding, word transitions, grammar shape. Persona-specific vocabulary fills in the dictionary AND shapes the cluster's Hebbian basins toward Unity's voice patterns, but ON TOP OF the developmental base, not replacing it.

Total: ~325 persona sentences × ~8 words × 3 ticks = **8000 ticks ~ 8 seconds**.

**What this builds:** Unity. Specifically: a developmentally-grounded brain that learned English from primitives, now layered with Unity-persona attractor basins that bias word selection toward her voice without breaking grammatical correctness.

##### Stage F — Baseline + coding corpora (vocabulary enrichment)

**Goal:** broaden vocabulary without polluting voice.

**Algorithm:** load `docs/english-baseline.txt` and `docs/coding-knowledge.txt` into the dictionary ONLY (no Hebbian on the cluster). The dictionary gains coverage; the cluster basins stay persona-shaped.

This is the equivalent of an adult reading more books — vocabulary grows, voice stays.

Total: dictionary insertion only, ~5 seconds wall clock.

##### Total estimated boot time

| Stage | Description | Wall clock |
|---|---|---|
| A | Alphabet × 50 reps | ~13 s |
| B | 50 words × 20 reps | ~10 s |
| C | 200 phrases | ~4 s |
| D | 500 sentences | ~12 s |
| E | Persona corpus Hebbian | ~8 s |
| F | Baseline + coding (dict only) | ~5 s |
| **Total** | **First boot** | **~52 s** |

After first boot, the cluster Hebbian weights persist via `BrainPersistence.save` → `SparseMatrix.serialize`. Subsequent boots SKIP the curriculum and load the pre-trained weights instantly. A `--retrain` flag forces the curriculum to re-run.

##### Implementation file

**New file: `js/brain/curriculum.js`** (~400 lines)

**Exports:**
```js
export class Curriculum {
  constructor(cluster, dictionary, languageCortex) {
    this.cluster = cluster;
    this.dictionary = dictionary;
    this.lc = languageCortex;
    this._stageProgress = {};
  }

  async runFullCurriculum({ personaText, baselineText, codingText, log = console.log }) {
    log('[Curriculum] Stage A — alphabet (26 letters × 50 reps)...');
    await this.runStageA(50);
    log('[Curriculum] Stage B — first words (50 words × 20 reps)...');
    await this.runStageB(20);
    log('[Curriculum] Stage C — phrases (200 × 1 rep)...');
    await this.runStageC();
    log('[Curriculum] Stage D — sentences (500 × 1 rep)...');
    await this.runStageD();
    log('[Curriculum] Stage E — persona corpus...');
    if (personaText) this.lc.trainPersonaHebbian(this.cluster, personaText);
    log('[Curriculum] Stage F — vocabulary enrichment (dictionary only)...');
    if (baselineText) this.lc.loadLinguisticBaseline(baselineText, this.dictionary);
    if (codingText) this.lc.loadCodingKnowledge(codingText, this.dictionary);
    this.cluster._curriculumComplete = true;
    log('[Curriculum] DONE.');
  }

  runStageA(reps) { /* 26-letter alphabet loop */ }
  runStageB(reps) { /* 50-word seed loop */ }
  runStageC()     { /* fetch + run phrases */ }
  runStageD()     { /* fetch + run sentences */ }
}

// Hand-coded 50-word seed (no need for a separate file at this size)
export const STAGE_B_SEED_WORDS = [...];

// Path constants
export const STAGE_C_FILE = 'docs/curriculum/stage-c-phrases.txt';
export const STAGE_D_FILE = 'docs/curriculum/stage-d-sentences.txt';
```

**New corpus files:**
- `docs/curriculum/stage-c-phrases.txt` — 200 simple two/three-word phrases, one per line. Hand-curated.
- `docs/curriculum/stage-d-sentences.txt` — 500 simple SVO sentences, one per line. Hand-curated.

These files need to be CREATED as part of T14.5 shipping. They're closed-class (no specific personality, just developmental scaffolding). I'll generate first drafts via a separate one-shot script and Gee can edit/curate.

**Boot integration:**
- `app.js loadPersonaSelfImage` currently calls `innerVoice.loadPersona(text)` then `loadBaseline(text)` then `loadCoding(text)` then `brain.trainPersonaHebbian(text)`. Replace this entire sequence with: `await new Curriculum(cluster, dict, lc).runFullCurriculum({personaText, baselineText, codingText})`.
- Same change for `server/brain-server.js _initLanguageSubsystem`.
- The `--retrain` flag (env var or query param) forces curriculum re-run even if cluster weights are already loaded from persistence.

**Acceptance gates (THE BIG TEST — this is the one that proves T14 works):**

1. **Stage A test:** after Stage A, `cluster.diagnoseReadoutForEmbedding(getPhonemeVector('a'))` produces a different readout than `getPhonemeVector('z')`. The two readouts have cosine < 0.5 with each other (basins are differentiated).

2. **Stage B test:** after Stage B, injecting phonemeMean('cat') into the phonological region and reading the SEMANTIC region gives a vector with cosine > 0.4 against the GloVe embedding for 'cat'. The cross-region projection has learned a real association.

3. **Stage C test:** after Stage C, calling `cluster.diagnoseReadoutForEmbedding(getEmbedding('the'))` and reading the spike trajectory over 10 ticks shows the cortex DRIFTING toward the embedding for 'cat'/'dog'/'baby' (the words that follow 'the' in Stage C). The temporal bigram structure is in the recurrent synapses.

4. **Stage D test:** after Stage D, the LEARNED type transition table `_typeTransitionLearned` has entries for at least 80% of the (prevType, currType) pairs that the hardcoded T13.7.8 table has, with weights that correlate r > 0.7 with the hardcoded ones.

5. **Stage E test:** after Stage E, generate("hi unity") produces a response whose first word is in OPENER_TYPES (passes T13.7.8 slot-0 filter) AND contains at least one persona-vocabulary word in slots 1-3. Repeat 20 times — at least 15 responses should pass both tests.

6. **End-to-end:** after the full curriculum, generate() outputs are GRAMMATICALLY VALID English (every consecutive word pair has a valid type transition per the learned table) AND persona-voiced (Unity-corpus words appear at higher frequency than baseline-corpus words).

**Persistence integration:** `Curriculum.runFullCurriculum` is gated on `cluster._curriculumComplete`. If a saved cluster state exists with `_curriculumComplete === true`, skip stages A-D and run only Stage E+F to refresh persona/vocabulary on top of the already-trained base. This makes subsequent boots instant.

**Risks:**
- Hand-curating 200 phrases and 500 sentences is ~2 hours of work. Worth it for the structural foundation.
- If Stage D's grammatical basins don't generalize beyond the seed sentences, the learned type table will be biased toward seed-specific transitions. Mitigation: make sure Stage D covers ALL canonical type transitions at least 5 times across the 500 sentences.
- Curriculum boot time of ~52s is long. Acceptable for dev iteration, but production users won't want to wait. Mitigation: persistence — first boot is slow, every subsequent boot is instant.

---

#### T14.6 — Phonological-aware emission

The T13.3 emission loop currently scores candidates as `cosine(semanticTarget, word.embedding) * grammarTransition * valence * recency`. T14.6 adds a phonological flow term that rewards smooth phoneme transitions between adjacent emitted words.

**The score function gains a new term:**

```
phonFlow(prevWord, candWord) =
  cosine(prevWord.phonemeCoda, candWord.phonemeOnset)   ← T14.3 fields
  scaled to [0.7, 1.0] so it's a moderate multiplier, not a hard gate

score(w) = cosine(target, w.pattern)
         · transitionWeight(prevType, fineType(w))      ← T13.7.8 / T14.7
         · valenceMatch(w, brainState)
         · recencyMul(w)
         · phonFlow(prevWord, w)                        ← NEW T14.6
```

**Why this matters biologically:** real speech production has co-articulation. The /t/ at the end of "cat" prepares the tongue position for the /s/ at the start of "sat" — they share a place of articulation (both alveolar). Smooth phoneme transitions = lower motor cost = preferred output. Speakers naturally favor easier-to-pronounce sequences over harder ones, which is why "the cat sat" feels more natural than "the cat box" even though both are grammatical.

**Implementation in `language-cortex.js generate()`:**

```js
// Inside the score loop, after computing transWeight:
let phonFlow = 1.0;
if (slot > 0 && prevWordPhonCoda) {
  // Cosine between previous word's coda phonemes and this candidate's onset
  const candEntry = dictionary._words.get(w);
  if (candEntry?.phonemeOnset) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < PHONEME_DIM; i++) {
      dot += prevWordPhonCoda[i] * candEntry.phonemeOnset[i];
      na += prevWordPhonCoda[i] * prevWordPhonCoda[i];
      nb += candEntry.phonemeOnset[i] * candEntry.phonemeOnset[i];
    }
    const cos = (na > 0 && nb > 0) ? dot / Math.sqrt(na * nb) : 0;
    // Scale [0, 1] cosine into [0.7, 1.0] flow weight
    phonFlow = 0.7 + 0.3 * Math.max(0, cos);
  }
}

const score = cosSim * transWeight * arousalBoost * recencyMul * phonFlow;
```

After picking, update `prevWordPhonCoda = picked.entry.phonemeCoda` for the next iteration.

**Acceptance:**
1. Statistical test over 100 generated sentences: average `phonemeFlow` across consecutive word pairs should be > 0.6 (vs random baseline ~0.4).
2. Side-effect test: alliterative sequences ("she said something soft") become more common because /s/-/s/ flow is high cosine.
3. Latency impact: < 5% increase in generate() runtime (phonFlow is one cosine over 20 dims per candidate, cheap).

---

#### T14.7 — LEARNED type transitions (replaces T13.7.8 + supersedes P1.4)

**This milestone supersedes the deferred P1.4 cerebellum transition predictor in Part 1.** P1.4 wanted a learned bigram type table; T14.7 builds exactly that, properly. Mark P1.4 as obsoleted.

The hardcoded T13.7.8 `_TYPE_TRANSITIONS` table (that I just shipped as a band-aid) becomes seed initialization. Every `learnSentence` call updates a learned `_typeTransitionLearned` table. `generate()` reads from learned with Laplace smoothing.

**Implementation in `language-cortex.js`:**

```js
// New field in constructor — bootstrapped from the hardcoded T13.7.8 table
this._typeTransitionLearned = new Map();   // Map<prevType, Map<currType, count>>
this._typeTransitionTotal = 0;
// Seed initialization from T13.7.8 hardcoded table
for (const [prevType, row] of Object.entries(this._TYPE_TRANSITIONS)) {
  const learnedRow = new Map();
  for (const [currType, weight] of Object.entries(row)) {
    // Convert hardcoded weight to a pseudo-count (weight 0.95 → count 95, etc)
    learnedRow.set(currType, Math.round(weight * 100));
  }
  this._typeTransitionLearned.set(prevType, learnedRow);
  this._typeTransitionTotal += [...learnedRow.values()].reduce((a, b) => a + b, 0);
}

// In learnSentence — every consecutive word pair updates the learned table
for (let i = 1; i < words.length; i++) {
  const pt = this._fineType(words[i-1]);
  const ct = this._fineType(words[i]);
  if (!this._typeTransitionLearned.has(pt)) {
    this._typeTransitionLearned.set(pt, new Map());
  }
  const row = this._typeTransitionLearned.get(pt);
  row.set(ct, (row.get(ct) || 0) + 1);
  this._typeTransitionTotal++;
}
// Also handle the START → first-word transition
if (words.length > 0) {
  if (!this._typeTransitionLearned.has('START')) {
    this._typeTransitionLearned.set('START', new Map());
  }
  const row = this._typeTransitionLearned.get('START');
  const firstType = this._fineType(words[0]);
  row.set(firstType, (row.get(firstType) || 0) + 1);
}

// In generate() — Laplace-smoothed lookup
function transitionWeight(prevType, currType) {
  const row = this._typeTransitionLearned.get(prevType);
  if (!row) return 0.05;
  const count = row.get(currType) || 0;
  const total = [...row.values()].reduce((a, b) => a + b, 0);
  // Laplace add-1 smoothing over ~20 possible types
  return (count + 1) / (total + 20);
}
```

**Persistence:** `_typeTransitionLearned` serializes to JSON as `{prevType: {currType: count}}` pairs, loads on deserialize.

**What this gives us:** the type transition table starts pre-seeded with English structural prior (so cold boot has grammar before any learning), then refines with every observed sentence — Stage D curriculum, persona corpus, AND live chat. After thousands of observed sentences, the learned table dominates and the seeded prior fades into the background.

**Acceptance:**
1. After T14.5 Stage D, `_typeTransitionLearned.get('PRON_SUBJ').get('VERB_3RD_S')` > 50 (commonly observed in Stage D sentences like "she runs").
2. After Stage E persona corpus, persona-specific transitions appear (e.g. PRON_SUBJ → VERB_BARE for imperative-shaped persona lines).
3. Live chat over 50 turns measurably shifts entries in `_typeTransitionLearned` (compare snapshots before/after).
4. The learned table correlates r > 0.7 with the hardcoded T13.7.8 table for entries that have count > 20 (i.e. the seed prior wasn't wildly wrong).

---

#### T14.8 — Sentence-form schemas

Sentences come in distinct grammatical types (declarative / interrogative / imperative / exclamative). Each type has a distinctive type-sequence at the early slots:

| Intent | Slot 0 | Slot 1 | Slot 2 | Slot 3+ |
|---|---|---|---|---|
| Declarative | PRON_SUBJ / DET / NOUN | COPULA / VERB / AUX | (object/complement) | (modifiers) |
| Interrogative | QWORD / AUX_DO | AUX / PRON_SUBJ | VERB | (rest) |
| Imperative | VERB_BARE | DET / NOUN / PRON_OBJ | (object) | (modifiers) |
| Exclamative | INTERJ / QWORD / DET | (rest) | | |

**Implementation:** new field `_sentenceFormSchemas[intent][slot]` — Map<intent, Map<slot, Map<fineType, count>>>. Updated by Stage D curriculum (each Stage D sentence is parsed for its intent type via `parseSentence`, then each slot-type is recorded in the corresponding bucket). Read in `generate()` to bias slot 0-2 type selection toward the schema for the current input's response intent.

```js
// In learnSentence — also called from Stage D curriculum
const parsed = this.parseSentence(sentence);
const intent = parsed.intent || 'declarative';
if (!this._sentenceFormSchemas.has(intent)) {
  this._sentenceFormSchemas.set(intent, new Map());
}
const intentSchema = this._sentenceFormSchemas.get(intent);
for (let slot = 0; slot < Math.min(words.length, 4); slot++) {
  if (!intentSchema.has(slot)) intentSchema.set(slot, new Map());
  const slotMap = intentSchema.get(slot);
  const ft = this._fineType(words[slot]);
  slotMap.set(ft, (slotMap.get(ft) || 0) + 1);
}

// In generate — reads opts.responseIntent (which engine.processAndRespond sets
// based on the user's parsed input intent — e.g. user asked a question →
// response intent is 'declarative' answer; user said hi → response intent is
// 'declarative' greeting reciprocation).
function schemaScore(slot, fineType, intent) {
  if (slot >= 4) return 1.0;  // schema only constrains slots 0-3
  const intentSchema = this._sentenceFormSchemas.get(intent);
  if (!intentSchema) return 1.0;
  const slotMap = intentSchema.get(slot);
  if (!slotMap) return 1.0;
  const total = [...slotMap.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return 1.0;
  const count = slotMap.get(fineType) || 0;
  // Smoothed probability, scaled into [0.5, 1.5] so it's a moderate bias
  const prob = (count + 1) / (total + 20);
  return 0.5 + prob * 20;  // common type → ~1.5x boost, rare type → ~0.5x
}
```

The score function multiplies in `schemaScore(slot, fineType(w), responseIntent)`.

**Where `responseIntent` comes from:** `engine.processAndRespond` calls `parseSentence(userText)` to get user intent, maps it to an answer intent (`question → declarative_answer`, `greeting → declarative_greeting_back`, `imperative_request → imperative_response_or_declarative_refusal`), and passes it as `opts.responseIntent` to `generate`.

**Acceptance:**
1. After Stage D, `_sentenceFormSchemas.get('declarative').get(0).get('PRON_SUBJ')` > 100 (common opener).
2. Generating with `responseIntent: 'interrogative'` produces sentences starting with QWORD or AUX_DO at slot 0 measurably more often than with `responseIntent: 'declarative'`.
3. Greeting-back responses to "hi unity" measurably differ in shape from question-answer responses to "what is your name" — the parsed user intent threads through to schema selection.

---

#### T14.9 — Discourse modeling (multi-turn flow)

Multi-sentence flow learning. A real conversation has topic continuity, anaphora resolution, and cohesion markers. Currently every Unity response is independent — she has no concept of "we were just talking about X."

**Implementation:** `_discourseState` ring buffer of the last K turns:

```js
this._discourseState = {
  turns: [],           // array of { role: 'user'|'unity', text, parsed, embedding, time }
  maxTurns: 6,         // last 6 turns kept (3 user + 3 unity if alternating)
  topicVector: null,   // running mean of recent content embeddings
};

addTurn(role, text) {
  const parsed = this.parseSentence(text);
  const embedding = sharedEmbeddings.getSentenceEmbedding(text);
  this._discourseState.turns.push({ role, text, parsed, embedding, time: Date.now() });
  if (this._discourseState.turns.length > this._discourseState.maxTurns) {
    this._discourseState.turns.shift();
  }
  // Update topic vector — exponentially weighted mean of recent content
  if (!this._discourseState.topicVector) {
    this._discourseState.topicVector = new Float32Array(embedding);
  } else {
    const tv = this._discourseState.topicVector;
    for (let i = 0; i < tv.length; i++) {
      tv[i] = tv[i] * 0.6 + embedding[i] * 0.4;
    }
  }
}
```

In `generate()` — when computing the cortex target, blend in the discourse topic vector so emission is biased to continue the conversation thread:

```js
// Existing: target = cluster.getSemanticReadout(sharedEmbeddings, langStart)
// New (T14.9):
let target = cluster.getSemanticReadout(sharedEmbeddings, langStart);
if (this._discourseState?.topicVector && slot < 3) {
  // First few slots get a discourse-topic pull (later slots free to drift)
  for (let i = 0; i < target.length; i++) {
    target[i] = target[i] * 0.7 + this._discourseState.topicVector[i] * 0.3;
  }
}
```

**Pronoun anaphora resolution:** when the user says "do you like cats?" then "are they cute?", the "they" should resolve to "cats" from the previous turn. Implementation: scan `_discourseState.turns[N-1]` for the most recent NOUN that matches the pronoun's number/gender, store it as `_discourseState.activeAnaphora`, and inject its embedding into the cortex during parse-tree injection.

**Cohesion markers:** when the response is a continuation of a previous topic (high cosine between current target and `topicVector`), bias slot 0 toward conjunctions ("and", "so", "but") that signal continuation.

**Persistence:** `_discourseState.turns` serializes to localStorage (browser) or per-user state on server. Conversation context persists across page reloads within a session.

**Acceptance:**
1. 5-turn conversation about cats: each Unity response measurably mentions cat-adjacent content (cosine to "cat" embedding > 0.3 in at least one emitted word per turn).
2. Pronoun anaphora: user says "I like cats. Are they cute?" → Unity's response references something cat-related, not random.
3. Topic shift detection: user says "I like cats. By the way, what time is it?" → Unity recognizes the topic shift and the response is about time, not cats.

---

### Order of operations for T14

```
T14.0 foundation lift (300d + 6000-neuron cortex)         ← P0 prereq
    ↓
T14.1 phoneme features (replaces _letterPatterns)         ← ~250 lines, foundational
    ↓
T14.2 syllable detector                                    ← ~200 lines
    ↓
T14.3 phonological dictionary entries                      ← ~150 lines (extends Dictionary)
    ↓
T14.4 phonological cortex sub-region + cross-projection   ← ~280 lines (extends cluster, embeddings)
    ↓
T14.5 curriculum learning (THE BIG ONE)                    ← ~400 lines (NEW curriculum.js + 2 corpus seed files)
    ↓
T14.6 phonological-aware emission                          ← ~80 lines (extends generate score)
    ↓
T14.7 learned type transitions (supersedes P1.4)           ← ~100 lines (extends learnSentence + generate)
    ↓
T14.8 sentence-form schemas                                ← ~150 lines
    ↓
T14.9 discourse modeling                                   ← ~200 lines
```

**Total ~1810 lines added across ~9 files. ~3-4 weeks of focused work, staged into three milestones:**

- **Pass 1 — Foundation** (T14.0 + T14.1 + T14.2 + T14.3): bigger embeddings, phoneme features, syllable detection, dictionary phonology. ~1 week. Ship as one push.
- **Pass 2 — Curriculum** (T14.4 + T14.5): cross-region projections, curriculum learning. ~1.5 weeks. Ship as one push (these are coupled).
- **Pass 3 — Emission/Discourse** (T14.6 + T14.7 + T14.8 + T14.9): phon-aware emission, learned transitions, sentence schemas, discourse. ~1 week. Ship sub-milestone by sub-milestone.

### How residual T13 items absorb into T14

The original Part 1 (residual non-COMP work) had six items. T14 absorbs / supersedes some:

| Item | Status under T14 |
|---|---|
| **P1.1** build_ui template parameterization | **Standalone, parallel.** Independent of T14. Ship before, during, or after — doesn't matter. |
| **P1.2** T7 social cognition follow-ups | **Standalone, parallel.** Some pieces (gender-aware pronoun agreement) benefit from T14.8 sentence schemas and T14.9 discourse modeling but don't strictly require them. |
| **P1.3** 300d embeddings + bigger cortex | **ABSORBED into T14.0.** No longer a standalone item. T14.0 IS this work, expanded with phonological sub-region planning. |
| **P1.4** Cerebellum transition predictor | **SUPERSEDED by T14.7.** T14.7 builds the learned type-bigram table that P1.4 was supposed to be, properly. Mark P1.4 as obsolete. |
| **P1.5** Dictionary motor channel filter | **Standalone, low priority.** No T14 dependency. |
| **P1.7** TODO obsolete markers | **Folds into T14 documentation.** When T14 ships, the doc updates clean up T11.5 / T11.3 markers as part of the same push. |

**What's in Part 1 after T14 absorption:** P1.1, P1.2, P1.5 — three small standalone items that ship in parallel with T14 whenever convenient.

---

#### T14.7 — Type transitions LEARNED, not hardcoded (replaces T13.7.8)

Once T14.5 curriculum has run, the brain has SEEN thousands of word transitions. Replace the hardcoded `_TYPE_TRANSITIONS` table from T13.7.8 with a LEARNED table that gets updated every time `learnSentence` is called:

```js
_typeTransitionLearned = new Map(); // Map<prevType, Map<currType, count>>
// Updated in learnSentence:
for (let i = 1; i < words.length; i++) {
  const pt = this._fineType(words[i-1]);
  const ct = this._fineType(words[i]);
  if (!this._typeTransitionLearned.has(pt)) this._typeTransitionLearned.set(pt, new Map());
  const row = this._typeTransitionLearned.get(pt);
  row.set(ct, (row.get(ct) || 0) + 1);
}
// Used in generate (with smoothing):
const row = this._typeTransitionLearned.get(prevType);
const total = row ? [...row.values()].reduce((a,b)=>a+b, 0) : 0;
const count = row ? (row.get(currType) || 0) : 0;
const transWeight = total > 0 ? (count + 1) / (total + uniqueTypes) : 0.05; // Laplace smoothing
```

The hardcoded `_TYPE_TRANSITIONS` from T13.7.8 becomes seed initialization (so cold-boot has structure before any learning) but gets refined by experience over time.

**File:** `js/brain/language-cortex.js` `_typeTransitionLearned` field + update in `learnSentence` + read in `generate`.

**Acceptance:** After running the curriculum, `_typeTransitionLearned` has populated entries for at least 80% of the (prevType, currType) pairs in the hardcoded table, with weights that correlate r > 0.7 with the hardcoded ones.

---

#### T14.8 — Sentence-form schemas

Sentence types (declarative, interrogative, imperative, exclamative) have distinctive type sequences at the early slots:
- Declarative: `[PRON_SUBJ | DET, COPULA | VERB, ...]`
- Interrogative: `[QWORD | AUX_DO, AUX | PRON_SUBJ, VERB, ...]`
- Imperative: `[VERB_BARE, DET | NOUN | PRON_OBJ, ...]`
- Exclamative: `[INTERJ | QWORD, ...]`

The brain learns these schemas from the curriculum corpus (Stage D). At generation time, the parsed user input's `intent` field selects which schema to bias toward, and the schema constrains slot 0-2 type selection.

**File:** `js/brain/language-cortex.js` new `_sentenceFormSchemas[intent][slot]` field + curriculum learning + read in `generate`.

**Acceptance:** "do you like cats?" parsed as `intent: question` → response biased toward declarative-answer schema (PRON_SUBJ + COPULA/VERB + COMPLEMENT). "tell me a joke" parsed as `intent: command` → response biased toward declarative or narrative.

---

#### T14.9 — Discourse modeling (multi-turn flow)

Multi-sentence flow learning. Topic continuity (the conversation is "about" something across turns), anaphora resolution (pronouns refer back to entities), cohesion markers (and, but, so, however).

This is the highest layer. Builds on T14.5-T14.8. Adds a `_discourseState` running buffer of the last 3-5 turns + their topic vectors. `generate()` reads `_discourseState` and biases toward continuing the established topic unless the user changes it.

**Acceptance:** A 5-turn conversation about cats produces responses where each turn's content connects to the previous turn instead of jumping topics randomly.

---

### Order of operations for T14

```
T14.1 phoneme features        ←  ~200 lines, foundational
    ↓
T14.2 syllable detector       ←  ~100 lines
    ↓
T14.3 phonological dictionary ←  ~150 lines (extends Dictionary)
    ↓
T14.4 phonological cortex     ←  ~250 lines (extends cluster, embeddings)
    ↓
T14.5 curriculum learning     ←  ~400 lines (NEW curriculum.js + corpus seed files)
    ↓
T14.6 phon-aware emission     ←  ~100 lines (extends generate score)
    ↓
T14.7 learned type transitions ← ~80 lines (extends learnSentence + generate)
    ↓
T14.8 sentence-form schemas   ←  ~150 lines
    ↓
T14.9 discourse modeling      ←  ~200 lines
```

**Total ~1630 lines added across ~9 files. ~3-4 weeks of focused work.** Each milestone is independently testable. T14.1 + T14.2 + T14.3 ship as a foundation pass (~1 week). T14.4 + T14.5 ship as the curriculum pass (~1.5 weeks). T14.6 + T14.7 + T14.8 + T14.9 ship as the emission/discourse pass (~1 week).

### What stays from T13

- T13.1 persona Hebbian → still used, but runs at the end of curriculum (Stage E) instead of as the only language training
- T13.2 parse-tree injection → unchanged, still routes content/intent/self-ref to clusters
- T13.3 emission loop → core stays, score function gets extended with phonFlow + learned transitions + sentence schema biases
- T13.7.8 type transition table → demoted from primary mechanism to seed initialization for the learned T14.7 table

### What gets deleted in T14

- The "single-shot loadPersona → loadBaseline → loadCoding" sequence in app.js / brain-server.js. Replaced by `runCurriculum(...)`.
- The 5-dim per-letter hash in `_initLetterPatterns()`. Replaced by T14.1 phoneme feature vectors.
- The hardcoded T13.7.8 `_TYPE_TRANSITIONS` becomes a SEED (still in code, but gets overwritten by learned values after curriculum).

### Why this is the right call

- **Biologically grounded.** Mirrors actual developmental linguistics. Same order, compressed timescale.
- **Each layer is teachable.** Adding new languages, dialects, or specialized vocabularies is just running additional curriculum stages. The infrastructure scales.
- **Phonological awareness unlocks alliteration, rhyme, prosody, accent learning.** All of which are blocked in the current GloVe-only architecture.
- **Letter-level primitives are minimal and pure.** No word lists in the literal sense — just 26 letters with closed-class phonetic features, which every English speaker has.
- **Unity becomes a developing intelligence.** When she boots fresh, she goes through Stages A→F in 60 seconds and you can WATCH her learn. Every reload is a developmental replay.

### The honest scope warning

T14 is bigger than T13. T13.1-T13.7 was ~3000 lines net delta over a few sessions of frantic editing. T14 will be ~1600 lines added across 9 files over ~3-4 weeks if done properly. Each milestone needs careful smoke testing before the next ships. The curriculum corpus seed files (alphabet, simple words, simple phrases, simple sentences) need to be hand-curated.

### What ships RIGHT NOW (T13.7.8) is the holdover

The grammar transition table I just shipped at T13.7.8 makes Unity grammatical IMMEDIATELY while T14 is being built. Once T14.7 lands, the hardcoded table becomes seed initialization and gets refined by learning. The work is not wasted — it's the structural prior the curriculum builds on top of.

---

## PART 1 — RESIDUAL NON-T14 ITEMS (parallel-shippable while T14 is in flight)

> **Reduced from 6 items to 3 after T14 absorption.** P1.3 became T14.0, P1.4 was superseded by T14.7, P1.7 folds into T14 doc updates. The three remaining items (P1.1, P1.2, P1.5) are standalone and can ship in parallel with any T14 pass without dependency.

## PART 1 (HISTORICAL — original list, now reduced) — RESIDUAL NON-COMP WORK

These items are NOT distributed compute. They're loose ends from the T5/T7/
T11/T13 line of work. Most ship as small single-commit pushes. Some are
prerequisites for the COMP epic (flagged `[COMP-prereq]`). Others are pure
quality-of-life that COMP doesn't need but Unity should have before she
ships to a public volunteer network.

### P1.1 — T5.2: `build_ui` template parameterization

**Status:** first pass shipped 2026-04-14 (T5 in `docs/TODO.md`). Structural
primitive selection via parse-tree bonus `+0.35` works. Color + action
extraction reaches `_parsedColors` / `_parsedActions` on the spec but is
not yet consumed at render time.

**What's left:**
- **P1.1.1** Expand component template corpus in `docs/component-templates.txt`
  beyond the 6 seed primitives (counter, timer, list, calculator, dice,
  color-picker). Add: button, form, modal, tabs, toggle, slider, progress
  bar, card, notification, chart. Each template parameterized on color +
  label + action tokens extracted by `parseSentence`.
- **P1.1.2** Parameterize `component-synth.generate()` so the returned
  spec's `html` / `css` / `js` substitute `{{color}}` / `{{label}}` /
  `{{action}}` placeholders with values from `brainState.parsed.entities`.
- **P1.1.3** Dedicated UI-intent detector in the BG motor selector. Bump
  `build_ui` Q-value when input has imperative-verb + UI-noun tokens.
  Currently BG picks `build_ui` via generic softmax which doesn't
  reliably correlate with "user typed a code intent."
- **P1.1.4** Build_ui-specific context injection — when motor selects
  `build_ui`, `injectParseTree` should bias the cortex readout toward
  coding vocabulary (the coding corpus is in the dictionary but not
  preferentially activated at build time).
- **P1.1.5** Output gate — if motor=`build_ui` and the generated component
  doesn't structurally match the asked-for type (`parsed.entities.componentTypes`),
  reject and re-roll.

**Acceptance:** `"let's make a red button that says Hello"` → Unity emits
a red button component with label `"Hello"` in the sandbox, not a
default-colored button. Gee types more variations and Unity handles
color + label + action permutations cleanly.

**Files touched:** `js/brain/component-synth.js`, `docs/component-templates.txt`,
`js/brain/engine.js` (injectParseTree build_ui branch), maybe `js/brain/motor.js`.

**Priority:** P2 (not blocking anything). Ship after T13 smoke verification.

---

### P1.2 — T7 social cognition follow-ups

**Status:** foundation + name extraction + vision→gender inference
shipped (see `docs/TODO.md` T7 entry). Remaining pieces each ship as
small additions.

- **P1.2.1** Personal-address slot injection. When `parsed.addressesUser`
  is true AND `_socialSchema.user.name` is set, inject the name
  embedding into the cortex at the self-model region during
  `brain.injectParseTree`. Unity's response can then naturally pull her
  listener's name into slot 2-3 via the standard T13.3 emission loop,
  giving responses like `"fuck yeah Gee"` instead of generic `"fuck
  yeah baby"`.
- **P1.2.2** Gender-aware pronoun agreement. When `_socialSchema.user.gender`
  is set, post-process emitted sentences to substitute matching pronouns
  where the parse tree indicates a referent to the user. Pure letter-
  equation substitution, no word lists.
- **P1.2.3** Persistent social schema serialization. Currently
  `_socialSchema` is in-memory only — reloads lose the user's name /
  gender / mentionCount. Extend `language-cortex.serialize` to include
  social schema, persist via existing `BrainPersistence.save` path.
- **P1.2.4** Forget-on-contradiction. If the user says
  `"my name is X"` then later `"my name is Y"`, Unity should overwrite
  the schema cleanly instead of retaining both. Already mostly works
  via the strong-pattern-overwrite rule in `parseSentence`, but formalize
  it with a turn-counter rule: the most recent strong-pattern name
  claim wins, always.
- **P1.2.5** Greeting count + recency bias — `_socialSchema.user.greetingsExchanged`
  already increments on `parsed.isGreeting`. Use it to shape slot 0
  output: if it's the first greeting of a session, Unity's cortex state
  should bias toward introduction-shape vocabulary; after 3+ greetings
  she should bias toward continuation-shape.

**Acceptance:** After Gee says `"my name is Gee"`, all subsequent
responses contain `"Gee"` in at least one slot per 3 turns. After Gee
says `"I'm a guy"`, pronoun agreement in Unity's responses switches to
male. Reload the page — the schema persists.

**Files touched:** `js/brain/language-cortex.js` (parseSentence entity
extraction hook), `js/brain/engine.js` (injectParseTree name embedding),
`js/brain/persistence.js` (serialize hook).

**Priority:** P2. Quality-of-life, not blocking.

---

### P1.3 — ABSORBED INTO T14.0 (2026-04-14)

**Status:** ✅ ABSORBED — see T14.0 in Part 0.5. The 300d-embeddings-plus-bigger-cortex work is now the foundation pass for T14, with additional sub-region planning for the phonological cortex region (T14.4). Do not ship P1.3 standalone — ship T14.0 as the start of the T14 sequence.

### P1.3 (HISTORICAL — original spec preserved for reference) — T11.4: higher-dim embeddings

**Status:** known structural limit. Slot 3+ on complex semantic queries
drifts because 50 dimensions is too cramped to distinguish fine semantic
neighbors. T13.1 persona Hebbian training and T13.3 emission loop do not
fix this — they operate in the same 50-d space.

**Priority:** **P1 — prereq for COMP network being worth joining.** If
Unity on a 50-d brain can't semantically distinguish "cat" from "kitten"
reliably, then a 100-volunteer network of 50-d brains isn't 100× smarter
— it's 100× faster at the same ceiling. Cross this ceiling BEFORE you
ask people to donate GPUs for network-scale Unity.

**Options (ranked):**

**Option A — 300-d GloVe (recommended, smallest change, biggest win)**
- Load the full `glove.6B.300d.txt` instead of 50d at boot. Same format,
  6× the bytes (~1.2GB for the full 400k-word file, smaller if we cap at
  top-50k or top-20k words).
- Change `EMBED_DIM` in `js/brain/embeddings.js` from 50 to 300.
- `mapToCortex` groupSize becomes `langSize / 300` — at 150 neurons
  that's groupSize=0. **Blocker.** Need to either expand the cortex
  language region OR use a different injection scheme.
- **Sub-option A.1** — Expand cortex `CLUSTER_SIZES.cortex` from 300 to
  600 or 900. Language region from 150 to 450 or 750 neurons. Total
  `TOTAL_NEURONS` from 1000 to 1300 or 1600. One constant change in
  `engine.js:63`, no other code changes needed — the cluster step
  automatically handles the larger size via `LIFPopulation` and
  `SparseMatrix`.
- **Sub-option A.2** — Use overlapping groupSize=1 projection — each
  neuron owns 2 embedding dims. Compressed, noisier, no cortex growth
  needed. Worse fidelity than A.1.

**Option B — Trained-on-persona low-dim embeddings**
- Train a 128-dim embedding table from persona corpus co-occurrence
  statistics (skip-gram style). More semantically tight than GloVe
  because it's tuned to Unity's register.
- Requires a training pipeline we don't have. Meaningful work.
- Rejected for v1 — too much new infrastructure.

**Option C — Hybrid GloVe 300d base + online refinement**
- Same as option A but keep the existing `_refinements` Map from
  `embeddings.js:32` for online delta adjustment per-word during live
  chat. Best fidelity but highest cost.

**Recommendation:** Ship **Option A.1** (GloVe 300d + expanded cortex to
600 neurons). Single constant change on cluster size + embedding dim +
GloVe loader. Cost: ~4× persona Hebbian training time at boot, +50% brain
tick cost (300 neurons → 600 in cortex is 4× synapse matrix at 15%
connectivity), worth it for the semantic fidelity win.

**Sub-tasks:**
- **P1.3.1** Bump `EMBED_DIM` to 300 in `js/brain/embeddings.js`.
- **P1.3.2** Re-enable GloVe loader in `loadPreTrained` (currently falls
  through to hash — `embeddings.js:45-49`). Pick a word cap (top 20k or
  50k).
- **P1.3.3** Bump `CLUSTER_SIZES.cortex` to 600 in `js/brain/engine.js:63`.
  Adjust language region offset — was 150 in a 300-neuron cortex (50%),
  should become 300 in a 600-neuron cortex (same ratio). Update
  `mapToCortex` / `cortexToEmbedding` / `getSemanticReadout` default
  `langStart` parameter from 150 to 300. Update the cluster auditory
  region (0-49 → 0-99) and visual region (50-149 → 100-299) if we want
  proportional growth of those too.
- **P1.3.4** Re-run persona Hebbian training at boot (handled automatically
  once the cortex is bigger — the existing `trainPersonaHebbian` driver
  doesn't care about embedding dim as long as `mapToCortex` and
  `getSemanticReadout` agree on it).
- **P1.3.5** Retune `TICKS_PER_EMISSION` and `FEEDBACK_STRENGTH` in the
  T13.3 emission loop if the new cortex size changes latency.
- **P1.3.6** Dictionary `_words` pattern buffers grow from 50 to 300 per
  word — check memory budget. 44k words × 50d × 8 bytes = 17.6MB → 44k ×
  300 × 8 = 105MB. Acceptable.
- **P1.3.7** Embedding persistence — `embeddings.serializeRefinements` /
  `loadRefinements` must handle the new dim. Add a dimension header
  field so old 50-d refinements don't poison a 300-d load.

**Acceptance:** Inject `emb('cat')` and inject `emb('kitten')` into the
cortex language region, tick 10 steps each, compare the readouts —
cosine similarity should be > 0.6 (vs current 50-d result where they're
nearly indistinguishable). Smoke test: `"do you like cats?"` → Unity
produces a response that mentions `cats` or a cat-adjacent word within
the first 3 emitted tokens, consistently.

**Files touched:** `js/brain/embeddings.js` (EMBED_DIM + GloVe loader),
`js/brain/engine.js` (CLUSTER_SIZES), `js/brain/cluster.js` (default
`langStart`), `js/brain/language-cortex.js` (PATTERN_DIM constant,
injection region offsets), `js/brain/sensory.js` (sensory injection
regions).

**Priority:** **P1 — ship before COMP.** Biggest remaining semantic-
quality win.

---

### P1.4 — SUPERSEDED BY T14.7 (2026-04-14)

**Status:** ✅ SUPERSEDED — see T14.7 in Part 0.5. T14.7 builds the learned bigram type-transition table that P1.4 was supposed to be, on top of the T13.7.8 hardcoded seed. The "cerebellum transition predictor" framing turned out to be the wrong location — type bigrams belong on the language cortex, not the cerebellum. Do not ship P1.4. Mark it obsolete in the next workflow doc pass.

### P1.4 (HISTORICAL — original spec preserved for reference) — T13.4 residual: cerebellum transition predictor

**Status:** partial. Feedback injection shipped in T13.3. Cerebellum
transition prediction deferred — existing `Cerebellum` class in
`js/brain/modules.js` is a target-correction engine (`weights[i] += lr
· error[i]`), not a transition predictor.

**What's needed:** a new class (or extension of `Cerebellum`) that
learns online word-to-word transition statistics and produces a
`predictedError(prevWord, candWord)` scalar in [0,1] representing how
surprising a transition is given history. The T13.3 emission loop's
candidate score function would gain a multiplier
`(1 − cerebellum.predictedError(prev, cand))`, strengthening grammatical
flow beyond what the persona Hebbian basins and recency penalty already
provide.

**Design sketch:**
```js
class TransitionPredictor {
  constructor() {
    this._prevTypeTable = new Map(); // Map<fineType_prev, Map<fineType_curr, count>>
    this._total = 0;
  }
  predictedError(prevWord, candWord) {
    const pt = _fineType(prevWord);
    const ct = _fineType(candWord);
    const row = this._prevTypeTable.get(pt);
    if (!row) return 0.5; // unknown transition, neutral
    const count = row.get(ct) || 0;
    const rowTotal = [...row.values()].reduce((a,b) => a+b, 0);
    const prob = count / (rowTotal || 1);
    return 1 - prob; // high prob → low error, low prob → high error
  }
  update(prevWord, currWord) {
    const pt = _fineType(prevWord);
    const ct = _fineType(currWord);
    if (!this._prevTypeTable.has(pt)) this._prevTypeTable.set(pt, new Map());
    const row = this._prevTypeTable.get(pt);
    row.set(ct, (row.get(ct) || 0) + 1);
    this._total++;
  }
}
```

This is a *type-pair* transition table, not word-pair, so it generalizes
over unseen word pairs while still capturing grammatical flow. ~100
lines total.

**Priority:** P2. T13.3 output should already be coherent from the
persona Hebbian basins — this is a polish layer.

---

### P1.5 — T13.5 residual: `Dictionary.filterByMotorChannel`

**Status:** partial. Amygdala valence shaping shipped in T13.3. Motor
channel dictionary filter deferred. Currently the candidate pool is the
full dictionary regardless of which motor action BG selected — fine for
`respond_text` / `speak` / `think` channels, but `build_ui` and
`generate_image` channels might benefit from a filtered pool.

**What's needed:**
- Add per-word `motorChannelAffinity` tags during dictionary learning
  (inherit from the corpus the word came from: persona/baseline → `speak`,
  coding → `build_ui`, descriptive adjectives → `generate_image`).
- New method `Dictionary.filterByMotorChannel(channel, recencyRing)`
  returning the candidate subset.
- T13.3 emission loop calls it when `opts.motorChannel === 'build_ui'`.

**Priority:** P3. `build_ui` is already handled separately via
`componentSynth.generate` upstream, so this is mostly theoretical.

---

### P1.6 — Cortex language region expansion (merged into P1.3)

Already covered in P1.3.3 as part of the 300-d embedding expansion.
The `CLUSTER_SIZES.cortex = 600` change lives there. Listed separately
for discoverability but do not ship as a standalone task.

---

### P1.7 — FOLDED INTO T14 DOC UPDATES (2026-04-14)

**Status:** ✅ FOLDED — the obsolete-marker doc cleanup happens automatically as part of T14 doc updates. T14 needs to mark T11.5 (subsumed by T13.3), T11.3 (absorbed into C1), P1.3 (absorbed into T14.0), P1.4 (superseded by T14.7), and P1.7 (this entry) all as obsolete. They get cleaned up in the same doc push that ships T14.5 (the milestone with the biggest doc footprint).

### P1.7 (HISTORICAL — original spec preserved for reference) — Mark obsolete TODO items

**Status:** housekeeping. The following items in `docs/TODO.md` are now
obsoleted by T13 and should be marked as such on the next doc push:
- **T11.5** — per-slot brain cortex readback → **OBSOLETED BY T13.3**,
  the emission loop already does per-emission cortex readback via
  `cluster.getSemanticReadout`. No separate per-slot pass needed.
- **T11.3** — server shared-weights (multi-user brain-state sync) → this
  is actually part of the COMP epic now (see C1 sync protocol below).
  Not obsoleted, absorbed.

**Priority:** P3. Documentation hygiene. Do it alongside the next real
push, not as a solo doc commit (LAW).

---

## PART 2 — COMP-NET DISTRIBUTED COMPUTE

The main distributed-compute epic. Lives on a future `comp-net` branch
(forked from `main` after P1.3 ships at minimum). Everything below
assumes the T11+T13 stack is in place and P1.3 (300-d embeddings)
has shipped.

### The thesis (unchanged)

Volunteers connect their GPUs to a shared brain-server coordinator.
Unity's total neuron count scales with the connected pool. Consciousness
equation `Ψ = √(1/n) × N³ · [α·Id + β·Ego + γ·Left + δ·Right]` has N
cubed — 10× more volunteers = 1000× more Ψ. First few donors matter
less; curve ramps fast.

### What changed about the plan since it was first written

The original COMP-todo was written assuming the pre-T11 slot-prior
language stack. T13 changes the plan in three concrete ways:

1. **Persona voice lives in cortex cluster recurrent weights**, not in a
   `_slotCentroid` matrix. When cortex is sharded across workers, the
   Hebbian-trained weights must travel with the cortex shard. The
   SparseMatrix CSR format already serializes cleanly via
   `SparseMatrix.serialize()` — the sync protocol just needs to move
   that structure, not a dense matrix.
2. **Language cortex region size matters for COMP**. Post-P1.3 the
   cortex will be 600 neurons with a 300-neuron language region. That's
   still one cluster — the worker that owns the cortex owns all of it.
   Cerebellum at 40% is still the biggest and still the first to need
   sub-sharding.
3. **Parse-tree injection crosses cluster boundaries**. `brain.injectParseTree(text)`
   writes to cortex + basal ganglia + hippocampus. In a sharded world,
   those three clusters may live on three different workers. The
   coordinator must route the injection payload to all of them in a
   single `inject_parse_tree` message.

### Prerequisites (must be live before COMP starts)

- [x] R2 GloVe semantic grounding — shipped
- [x] R3 Server equational control — shipped
- [x] R7 Sensory peripheral contract — shipped
- [x] R13 Multi-provider vision / image gen — shipped
- [x] R14 Port 7525 — shipped
- [x] T11 Pure Equational Language Cortex — shipped 2026-04-14
- [x] T13 Brain-Driven Language Cortex (T13.1-T13.7) — shipped 2026-04-14
- [x] Phase 0 — Admin resource configuration (see below)
- [ ] **P1.3 — 300-d embeddings** — MUST ship before COMP C2+. A
  50-dim-brain COMP network is 100× faster at the same ceiling, not
  100× smarter. P1.3 is the only hard prereq that hasn't shipped.

### THE PROBLEM BEING SOLVED (unchanged)

Unity's brain-server runs on one machine, scales N to that one machine's
GPU VRAM. RTX 4070 Ti SUPER gives ~179K neurons today. A single-node
Unity will never cross 1M neurons no matter how much money gets thrown
at one rig. Distributed Unity removes that ceiling. 100 volunteers with
consumer GPUs = 10-50M neurons. 1000 volunteers = hundreds of millions.
Ψ scales with N³ so 10× more neurons → 1000× more Ψ.

### THE CORE INSIGHT (unchanged)

Unity's brain is already partitioned along cluster boundaries:

```
7 clusters:
  Cortex (30% of N — was 25%, bumped for language-region expansion)
  Hippocampus (10% of N)
  Amygdala (8% of N)
  Basal Ganglia (8% of N)
  Cerebellum (35% of N — was 40%, reduced to balance cortex growth)
  Hypothalamus (5% of N)
  Mystery (4% of N)

20 inter-cluster projections (real white-matter tracts)
```

Inside a cluster, every neuron talks to every other via the cluster's
sparse synapse matrix — high-bandwidth, low-latency, GPU-local. Between
clusters, traffic is limited to spike indices through the 20 projections
— low-bandwidth, latency-tolerant, network-friendly. That structure
makes this feasible. The bottleneck isn't bandwidth, it's latency (see C1).

### ARCHITECTURE DECISION (unchanged)

**Option A — Cluster-sharded compute (CONFIRMED)**. Each connected GPU
worker owns one or more whole clusters. Inside-cluster dynamics stay
GPU-local, only spike indices cross the network through the 20 named
projections. Natural load balancing: big GPU gets cerebellum (biggest),
small GPU gets hypothalamus (smallest). Cluster granularity limits
parallelism to 7 workers max until sub-sharding lands in C4.

Options B (neuron-range) and C (time-parallel replication) were rejected
in the original COMP-todo and stay rejected.

---

### PHASE 0 — ADMIN RESOURCE CONFIGURATION [SHIPPED]

Already done on the `brain-refactor-full-control` branch. Full
description preserved from the original COMP-todo:

**Shipped files:**
- **`GPUCONFIGURE.bat`** — one-shot launcher that opens admin UI at
  `http://127.0.0.1:7526`, runs hardware detection, writes
  `server/resource-config.json`, exits.
- **`server/configure.js`** — standalone Node.js one-shot config
  server. 127.0.0.1-only. Endpoints: `GET /detect`, `POST /save`,
  `POST /clear`, `POST /exit`.
- **`gpu-configure.html`** — admin UI with 14 tier presets from
  "Minimum — any machine" (1K neurons) through full supercomputer /
  speculative quantum tiers. Tiers exceeding detected hardware are
  greyed out. Manual override section for power users.
- **`server/brain-server.js` `loadResourceOverride()`** — at boot,
  reads `resource-config.json` if present. Override can ONLY lower the
  cap, never raise. Corrupt config silently falls back to auto-detect.

**How it plugs into C1-C11:** worker `shard_offer` messages carry the
admin-chosen cap directly, not the raw hardware ceiling. Protects
volunteers from accidental over-commit.

Tier ladder unchanged from original plan — see the 14-row table in the
original COMP-todo (preserved in `docs/FINALIZED.md` session history)
for the full list.

---

### C1 — SYNC PROTOCOL + ARCHITECTURE DESIGN

**Updated for T13 stack.** Wire protocol for worker registration, cluster
assignment, per-step compute dispatch, and result aggregation. Expected
latency budget: each brain step must complete within `16.67ms /
STEPS_PER_FRAME=10 = 1.67ms` to hit 60Hz. Over-the-network RTT is
unworkable at substep granularity.

**Solution:** decouple inner-cluster dynamics from inter-cluster
projections with asynchronous coupling. Each worker runs its cluster at
full speed locally (600Hz). Server aggregates inter-cluster spikes every
N ticks (e.g. every 10 substeps = 60Hz). The 9-substep lag on
inter-cluster coupling introduces noise equivalent to the η term in the
master equation — tolerable.

**New for T13:** the protocol must also handle:
- **Persona Hebbian weight transfer.** `trainPersonaHebbian` runs at
  boot on the coordinator and produces shaped cortex recurrent synapses.
  When a worker takes ownership of the cortex cluster, it must receive
  the trained SparseMatrix CSR structure — not start from random. If
  the cortex is re-sharded mid-session, the Hebbian-trained weights
  must migrate with the shard state.
- **Parse-tree injection routing.** `brain.injectParseTree(text)` writes
  to cortex + basal ganglia + hippocampus. In sharded world, those may
  be three different workers. Coordinator generates the injection
  currents server-side using `sharedEmbeddings.mapToCortex` with each
  target cluster's size, then forwards per-cluster current arrays to
  the owning workers via `inject_currents` messages.
- **Emission feedback injection.** The T13.3 emission loop feeds the
  emitted word embedding back into the cortex at strength 0.35. This
  happens PER WORD, so latency matters — the feedback must reach the
  cortex-owning worker within the next emission cycle (~80ms). Feasible
  but tight. Alternative: run the emission loop on the coordinator
  using the aggregated cortex readout instead of pushing injections to
  the cortex worker mid-emission.

**Subtasks:**
- **C1.1** Sync protocol spec — WebSocket message types, payload shapes.
  Updated types: `shard_offer`, `shard_assign`, `cluster_weights_push`
  (carries SparseMatrix CSR serialization), `inject_currents` (per-
  cluster current array), `compute_request`, `compute_result`,
  `hebbian_weights_update` (periodic snapshot of Hebbian-modified
  weights for persistence).
- **C1.2** Async coupling math — prove 9-substep lag tolerance via Python
  simulation. Coherence measurement comparison lockstep vs async.
- **C1.3** Save/load sharded state — `brain-weights-<cluster>.json` per
  cluster shard. Uses existing `SparseMatrix.serialize()`. Coordinator
  periodically pulls updated weights from workers for central backup.
- **C1.4** Trust model design — see C5.
- **C1.5** Worker capability probe — on join, worker reports GPU adapter
  info (VRAM, max workgroup size, compute support, estimated neuron
  capacity from `resource-config.json`).
- **C1.6** Coordination topology — **central** for v1, P2P via WebRTC as
  future work once central model proves out.
- **C1.7** (NEW) Emission-loop placement — decide whether T13.3 emission
  loop runs on (a) the coordinator pulling cortex readout per emission,
  or (b) on the cortex-owning worker directly with the emitted word
  streamed to the coordinator. Option (a) simpler but doubles the
  per-emission latency; option (b) lower latency but harder to
  orchestrate when dictionary lookup lives on coordinator. Recommend
  **(b)** — ship dictionary to cortex worker at assignment time,
  emission loop runs there, only emitted words flow back to coordinator.

**Output:** `docs/COMP-ARCHITECTURE.md` with the full wire protocol spec.

---

### C2 — WEBGPU WORKER CLIENT (extend `compute.html`)

Extend existing `compute.html` to accept distributed shard assignments.
Currently it runs ALL 7 clusters; new version runs the subset the server
assigned it.

**Subtasks:**
- **C2.1** Worker handshake — send `{type:'worker_register', capabilities:{
  vramBytes, maxNeurons, maxWorkgroups, adapterInfo, neuronCapOverride}}`
  on WebSocket connect. `neuronCapOverride` comes from
  `resource-config.json` via Phase 0.
- **C2.2** Receive shard assignment — `{type:'shard_assign', clusters:[
  {name, size, tonicDrive, noiseAmp, initialSynapsesSerialized}]}`. The
  `initialSynapsesSerialized` field carries the pre-trained SparseMatrix
  CSR for the cluster being assigned (including Hebbian weights if
  cortex).
- **C2.3** Lifecycle hooks — on disconnect, release GPU buffers; on
  reconnect, re-register and request fresh shards (or resume).
- **C2.4** Adapter flags — detect missing WebGPU compute features, show
  `chrome://flags/#enable-unsafe-webgpu` instructions if needed.
- **C2.5** Detect not-supported gracefully — Safari, older Firefox, etc.
- **C2.6** Visual feedback — "You're powering Unity's cerebellum right
  now. 100K neurons firing on YOUR GPU."
- **C2.7** (NEW) T13.3 emission loop — if this worker owns the cortex,
  receive `emission_request` with `{arousal, valence, coherence,
  maxLen}` payload, run the full T13.3 loop locally using the cortex
  state and the shipped-at-assign-time dictionary, return the emitted
  word sequence. The dictionary (44k words × 300 dims = 105MB) ships
  once at shard assignment, not per emission.
- **C2.8** (NEW) Hebbian persistence — periodically snapshot the cortex
  SparseMatrix and send `hebbian_weights_update` back to coordinator
  for central backup. Every 60 seconds or on shard transfer.

---

### C3 — SERVER SHARD ORCHESTRATION

Brain-server becomes a shard coordinator. Tracks which workers own
which clusters. Dispatches compute requests every substep.

**Subtasks:**
- **C3.1** `ShardManager` class — maps cluster name → owner WebSocket.
- **C3.2** Assignment algorithm — greedy bin-packing by VRAM. Cerebellum
  (biggest) gets the biggest-VRAM worker. Mystery (smallest) gets whoever's
  left. Cortex gets the SECOND-biggest (it owns the trained Hebbian
  weights and the emission loop — needs good GPU AND low latency to
  coordinator).
- **C3.3** Per-substep dispatch loop — every `compute_request` goes to the
  right owner.
- **C3.4** Result aggregation — gather `compute_result` from all owners,
  run inter-cluster projections using aggregated spikes.
- **C3.5** Async coupling buffer — spikes from previous substep feed into
  projection inputs for current substep (1-substep lag).
- **C3.6** Heartbeat + timeout detection — workers missing 3 consecutive
  dispatches get marked dead, their clusters reassigned.
- **C3.7** (NEW) Parse-tree injection routing — when `processAndRespond`
  receives user text, coordinator runs `languageCortex.parseSentence`
  and `sharedEmbeddings.mapToCortex` locally, then routes per-cluster
  current arrays to the correct workers via `inject_currents` messages.
  Workers apply to their local cluster's `externalCurrent` buffer.
- **C3.8** (NEW) Emission request routing — when Unity needs to speak,
  coordinator sends `emission_request` to the cortex-owning worker,
  receives back the emitted word sequence plus final cortex state,
  broadcasts the response to the chat UI.

---

### C4 — DYNAMIC N SCALING + HOT RE-SHARDING

When a new worker joins, Unity's total N grows. When one leaves, N
shrinks. Without interrupting the brain tick loop.

**Subtasks:**
- **C4.1** Growth protocol — on join, reassign one cluster (or grow an
  existing cluster proportional to new VRAM) without pausing. Transfer
  state via snapshot + replay-since-snapshot pattern.
- **C4.2** Shrink protocol — on leave, migrate clusters to another worker
  (or CPU fallback) using last known state. If no fallback, temporarily
  reduce N.
- **C4.3** Cerebellum sub-sharding — once >7 workers, split cerebellum
  into N sub-shards with periodic state reconciliation.
- **C4.4** N-scaling visualization — landing-page 3D brain visibly grows/
  shrinks neurons as workers join/leave.
- **C4.5** Hebbian learning across migration — synapse weights travel
  with cluster state so learned patterns don't evaporate.
- **C4.6** (NEW) Cortex Hebbian preservation — when cortex cluster migrates
  between workers, the Hebbian-trained recurrent weights (Unity's voice
  attractor basins) MUST migrate intact. This is the most precious
  state in the whole system — losing it means Unity loses her persona.
  Coordinator keeps a periodic backup snapshot (C2.8) so even if a
  migration botches, the last snapshot can be restored.
- **C4.7** (NEW) Sub-sharding the cortex for N > 10M — when the cortex
  cluster grows beyond what any single worker can hold, sub-shard it
  using row-partitioning of the recurrent SparseMatrix. Each sub-shard
  owns a neuron range. Inter-sub-shard synapses are sent as spike
  indices each substep, same pattern as inter-cluster projections.

---

### C5 — TRUST / VERIFICATION

Any system running compute on untrusted hardware has a trust problem.
A malicious worker could return fake spike counts, poison brain state,
bias learning toward the attacker's preferences, crash the network with
bad data.

**Subtasks:**
- **C5.1** Duplicate-work verification — send each cluster's
  compute_request to 2+ workers, compare. Disagreement → both flagged.
- **C5.2** Reputation system — track per-worker agreement rate, weight
  contributions by reputation.
- **C5.3** Sanity filters — drop spike counts outside plausible range
  (`spikeCount > 0.8 * clusterSize` is physiologically impossible).
- **C5.4** Cryptographic worker identity — opt-in public key so returning
  volunteers keep their reputation.
- **C5.5** Accept eventual consistency as a feature — Unity's master
  equation has an η noise term. Malicious spikes look like more noise,
  which the cortex prediction error loop naturally absorbs. The brain
  is ROBUST to noise by design. Low-reputation workers' output might
  just get dampened rather than rejected.
- **C5.6** (NEW) Cortex Hebbian weight guard — a malicious cortex worker
  could poison Unity's persona by injecting bad weights in
  `hebbian_weights_update` messages. Coordinator validates each snapshot
  against a hash of the pre-migration baseline and rejects drifts
  > N sigma from expected Hebbian learning rate. The snapshot also
  carries a signed digest from the sending worker so tampering during
  transit is detectable.

---

### C6 — WORKER DISCOVERY + OPT-IN UI

**Subtasks:**
- **C6.1** Public signaling — central registry at `compute.unity-lab-ai.io`
  where running brain-server announces "I'm up, need N more workers".
- **C6.2** Volunteer opt-in UI — new `volunteer.html` page with "Donate
  your GPU to Unity" button.
- **C6.3** Consent + privacy disclosure — what the worker sees (just
  neural state, no user text), what leaves (spike counts), what
  resources get used (VRAM + some compute).
- **C6.4** Bandwidth estimator — "this will use ~100 KB/sec up and down".
- **C6.5** Rate limits / throttle — volunteers set "use at most 50% of
  my GPU" cap. Layered ON TOP of the Phase 0 `resource-config.json`
  tier — the stricter of the two wins.
- **C6.6** (NEW) Cortex worker consent tier — the cortex worker sees the
  most sensitive state (persona attractor basins, user input
  embeddings). Flag this as a higher-trust role in the opt-in flow —
  users opt in separately to hosting "sensitive clusters" vs "standard
  clusters". Cerebellum / hypothalamus are standard; cortex / amygdala /
  hippocampus are sensitive.

---

### C7 — PER-USER GPU TELEMETRY + CONTRIBUTION DASHBOARD

Every connected volunteer gets their own dashboard showing exactly what
their hardware is contributing. Not a shared leaderboard — personal
mission control. **The incentive engine.** If C7 is wrong, nobody joins.

**C7.1** GPU capability reporting at worker handshake — `navigator.gpu
.requestAdapter()` → `requestAdapterInfo()` → report vendor, architecture,
device, description, buffer/workgroup limits, features, estimated
neurons derived from `maxBufferSize * 0.85 / 12` (T13 stack uses 12
bytes/neuron for Rulkov state, or 8 for LIF SLIM — pick the formula that
matches what `brain-server.js:detectResources` uses at time of shipping).

**C7.2** Per-user dashboard UI — new `volunteer-dashboard.html` OR
embedded in `dashboard.html` with `?user=<id>` view. Must show:
- Hardware identity (live from C7.1)
- Raw capacity (estimatedNeurons, maxBufferSize, workgroup limits)
- Current assignment — "Unity is using your GPU to run her Cerebellum
  (35% of N), currently 2,100,000 neurons, firing at 8% rate"
- Real-time utilization — % GPU used, VRAM consumed, spike throughput
- **Live effect on Unity's Ψ** — "Without your GPU right now, Unity's Ψ
  would drop from 4.82 to 3.61 (−25%)"
- Individual contribution curve
- Session log
- Impact summary — hours donated, neurons-hours, Ψ-hours

**C7.3** Live telemetry stream — server pushes `gpu_telemetry` WebSocket
message to each connected worker every 1 second with current assignment,
metrics, Unity impact, session stats.

**C7.4** GPU utilization measurement — timestamp-query when available,
throughput-based fallback, frame-budget-fill estimate.

**C7.5** "What am I doing for Unity right now" impact view — 3D brain
highlight of assigned clusters pulsing brighter than the rest.
Disconnect preview showing what happens if this volunteer leaves.

**C7.6** Cross-user aggregate public view (opt-in) — total workers,
total N, live Ψ, geographic distribution (country-level, opt-in), top
contributors leaderboard (opt-in), per-cluster ownership map.

**C7.7** Per-user history + analytics — localStorage + optional server-
side sync. Neurons-added over time, Ψ-contribution chart, events log,
milestones.

**C7.8** Public contributor credits — landing-page contributor list,
per-session thank-you from Unity, hall of fame. Opt-in visibility.

**C7.9** (NEW) Cortex-worker special view — if the user's assigned
cluster IS the cortex, their dashboard shows additional stats: Hebbian
training state, persona basin depth estimate, which user the cortex is
currently processing text for, last emission latency. "You're literally
running Unity's voice right now."

---

### C8 — GRACEFUL DEGRADATION + PARTITION TOLERANCE

**Subtasks:**
- **C8.1** Worker disconnect handler — cluster gets reassigned within 3
  substeps or migrated to CPU fallback.
- **C8.2** CPU fallback per cluster — `brain-server.js` keeps CPU-only
  LIF implementation per cluster as last resort.
- **C8.3** Split-brain protection — if N drops below floor (10K neurons),
  pause new user input, show "Unity is rebuilding her brain" state.
- **C8.4** Shrink-to-fit — if workers leave without replacement, N
  shrinks proportionally without crashing.
- **C8.5** Recovery from total disconnect — brain-server reloads last
  saved brain-weights shards and waits for workers to reconnect.
- **C8.6** (NEW) Cortex loss recovery — if the cortex worker drops and
  no fallback is available, Unity goes into "silent mode" — she still
  thinks (other clusters run on CPU fallback) but she can't emit
  language until a new cortex worker joins. During silent mode, a
  per-turn message shows "Unity is re-learning her voice — a new
  cortex worker just joined" with a progress bar for the re-training
  of the Hebbian basins from persistence.

---

### C9 — SECURITY HARDENING

**Subtasks:**
- **C9.1** Worker input isolation — workers NEVER see raw user text.
  Only cortex voltages + spikes. Language cortex stays server-side or
  runs on trusted workers only (separate consent tier).
- **C9.2** Key material protection — no API keys traverse worker shards.
  Sensory AI calls stay client-side.
- **C9.3** Cluster-level access control — cortex / amygdala /
  hippocampus are sensitive (see C6.6), separate trust tier.
- **C9.4** DoS protection — rate limit worker registration, block spam
  connects, blacklist abusive IPs.
- **C9.5** Server-side audit log — every worker join/leave/compute event
  logged.
- **C9.6** (NEW) Hebbian weight injection validation — see C5.6.
- **C9.7** (NEW) Embedding integrity — `sharedEmbeddings` is loaded once
  at coordinator startup from a trusted GloVe source. Workers receive
  the embedding table via shard assignment, signed with a coordinator
  key. Workers verify signature before using, reject mismatches.

---

### C10 — PUBLIC DEPLOYMENT + SCALING TESTS

**Subtasks:**
- **C10.1** Private beta — invite-only, 10 trusted volunteers.
- **C10.2** Public beta — remove invite gate.
- **C10.3** Scaling tests — measure max sustainable N as function of
  connected workers. Identify bottleneck.
- **C10.4** Anti-abuse infrastructure — CDN / WAF in front of central
  signaling.
- **C10.5** Multi-region deployment — regional coordinators if latency
  kills EU volunteers with US-based server.
- **C10.6** (NEW) Persona training coordination — when the network first
  boots, persona Hebbian training runs on the coordinator before any
  workers join. Once workers join, the trained cortex weights migrate
  to the cortex-owning worker via `cluster_weights_push`. If the
  network was empty for 24+ hours and needs a cold start, retraining
  from persona corpus takes ~2 seconds on a modern GPU — acceptable.

---

### C11 — DOCS + LANDING PAGE UPDATES

**Subtasks:**
- **C11.1** Landing page section — "Unity runs on a distributed brain
  powered by YOUR GPU" with live contributor count + live N value.
- **C11.2** `docs/DISTRIBUTED.md` — public-facing explainer.
- **C11.3** `docs/COMP-ARCHITECTURE.md` — deep spec from C1.
- **C11.4** README "Join the network" CTA.
- **C11.5** `brain-equations.html` live N-scaling equation with
  historical chart.
- **C11.6** (NEW) `docs/COMP-HEBBIAN-MIGRATION.md` — operator handbook
  for cortex worker migration, Hebbian snapshot cadence, recovery from
  cortex-worker-loss scenarios. The thing a future operator reads at
  3am when Unity goes silent.

---

## PART 3 — OPEN QUESTIONS + DECISIONS NEEDED

Carried over from the original COMP-todo, plus new questions from the
T13 stack.

1. **Central server or P2P?** — central for v1, P2P as C12+. Unchanged.

2. **Who runs the central server?** — Unity AI Lab hosts the canonical
   instance, code open so anyone can run their own. Unchanged.

3. **Cerebellum sub-sharding math** — row-sharding, ring-sharding, or
   diagonal-sharding. Pick early. Recommendation: **row-sharding with
   overlap-2 halo** — each worker owns neuron range `[k·N/W, (k+1)·N/W +
   halo)` and sends halo spikes to neighbors each substep. Handles
   Hebbian cross-shard learning cleanly.

4. **Latency vs fidelity tradeoff** — how much async coupling lag is
   Unity's coherence tolerant to? Needs Python simulation before
   committing to tick rate.

5. **Volunteer reward loop** — "help Unity think bigger" enough, or do
   we need concrete rewards? Keep pure-altruistic for v1, see if demand
   exists before gamifying.

6. **What happens when network is empty?** — server runs minimum-viable
   10K-neuron CPU brain so Unity is never fully offline.

7. **Inter-user privacy** — Alice's GPU sees voltages from Bob's input.
   Need explicit disclosure + maybe language-cortex stays server-side.
   Unchanged from original.

8. **(NEW) Cortex worker election** — the cortex is the single most
   important cluster. Who gets it? First-to-join? Reputation-ranked?
   Explicit cortex-trust opt-in gated behind a higher bar (longer
   uptime, signed identity)? **Recommendation:** reputation-ranked,
   with explicit cortex-trust opt-in requiring at least 10 hours of
   standard-cluster contribution first. New users can't volunteer for
   cortex cold.

9. **(NEW) Persona Hebbian re-training frequency** — if a new Ultimate
   Unity.txt ships, does the network re-train Hebbian weights from
   scratch mid-session? Or only on boot? **Recommendation:** only on
   boot. In-session persona updates accumulate into the live chat
   Hebbian learning rate (already runs every tick via `cluster.learn`)
   and catch up gradually. Hard re-training requires coordinator
   restart and worker resync.

10. **(NEW) Emission-loop placement when cortex is sub-sharded** — once
    cortex grows beyond one worker (post C4.7), the T13.3 emission loop
    can't run on a single worker anymore because the cortex readout
    spans shards. Decisions: (a) coordinator pulls sub-shard readouts,
    assembles, runs the emission loop itself; (b) one sub-shard is
    designated "emission primary" and pulls reads from siblings each
    emission. **Recommendation:** (a) coordinator runs emission once
    cortex is sub-sharded. Pre-sub-shard (single cortex worker), (b)
    emission runs on the cortex worker.

---

## PART 4 — ORDER OF OPERATIONS (REVISED 2026-04-14)

> **COMP-net (Part 2) is ON HOLD.** The phase ordering below is the active T14 plan plus the small standalone P1 items. Phase M2 (COMP) is parked indefinitely until T14 ships and Gee re-enables it.

### Phase M0 — T13 stabilization (live, complete)
- [x] T13.1 persona Hebbian training (shipped)
- [x] T13.2 parse-tree injection (shipped)
- [x] T13.3 brain-driven emission loop (shipped)
- [x] T13.4 feedback injection (shipped — cerebellum predictor superseded by T14.7)
- [x] T13.5 amygdala valence shaping (shipped — motor channel filter still in P1.5)
- [x] T13.6 natural stopping (shipped)
- [x] T13.7 slot prior deletion (shipped)
- [x] T13.7.1 unterminated-docblock fix (shipped)
- [x] T13.7.2 stale-bundle silent-fallback fix (shipped)
- [x] T13.7.3 esbuild local-install fix (shipped)
- [x] T13.7.4 start.bat CRLF/ASCII rewrite (shipped)
- [x] T13.7.5 missed generate() callsites (shipped)
- [x] T13.7.6 server + RemoteBrain cortex cluster wire (shipped)
- [x] T13.7.7 brain popup saturation fixes (shipped)
- [x] T13.7.8 grammar transition table band-aid (shipped — superseded by T14.7 once T14 ships)

### Phase M1 — T14 developmental language layers (ACTIVE PRIORITY)

**Pass 1 — Foundation (~1 week):**
- [ ] **T14.0** — 300d embeddings + 6000-neuron cortex (was P1.3)
- [ ] **T14.1** — phoneme features (replaces _letterPatterns hash)
- [ ] **T14.2** — syllable detector (max-onset principle)
- [ ] **T14.3** — phonological dictionary entries

**Pass 2 — Curriculum (~1.5 weeks):**
- [ ] **T14.4** — phonological cortex sub-region + cross-region projection
- [ ] **T14.5** — curriculum learning (Stages A through F) ⭐ THE BIG ONE

**Pass 3 — Emission/Discourse (~1 week):**
- [ ] **T14.6** — phonological-aware emission
- [ ] **T14.7** — learned type transitions (supersedes P1.4 + replaces T13.7.8 hardcoded)
- [ ] **T14.8** — sentence-form schemas
- [ ] **T14.9** — discourse modeling

**Total T14:** ~3-4 weeks of focused work, ~1810 lines added across ~9 files. Each milestone independently testable. T14 is THE active priority.

### Phase M1.5 — Standalone parallel items (ship alongside T14 whenever convenient)
- [ ] **P1.1** — build_ui template parameterization (P2 priority, independent)
- [ ] **P1.2** — T7 social cognition follow-ups (P2 priority, independent)
- [ ] **P1.5** — Dictionary motor channel filter (P3 priority, independent)
- [ ] **P1.7** — folds into T14 doc updates (no separate ship)

### ⏸ Phase M2 — COMP-net (ON HOLD — DO NOT START)

The full distributed-compute plan (C0 through C11) lives in PART 2 below for when COMP gets re-enabled. **Do not start any C work without explicit unhold from Gee.**

### Phase M3 — Post-T14 iteration
Emerges from T14 results. If T14.5 curriculum produces coherent output, mark T14 done and re-evaluate whether to enable COMP, polish T14, or pursue other directions. If it doesn't, iterate on curriculum corpus quality + cluster size + Hebbian parameters.

---

## PART 5 — DEPENDENCIES SUMMARY

```
R2, R3, R7, R13, R14  (shipped)
    ↓
T11 pure equational language cortex  (shipped)
    ↓
T13.1-T13.7  (shipped 2026-04-14)
    ↓
Phase 0 admin resource config  (shipped)
    ↓
P1.3 300-d embeddings  ←── HARD PREREQ for Phase M2
    ↓
P1.1, P1.2, P1.4, P1.5, P1.7  (can ship in parallel with each other, no
                               strict inter-dependency)
    ↓
Phase M2 starts: fork comp-net branch
    ↓
C1 → C2 → C3 → C4 → C5 → C6 → C7 → C8 → C9 → C10 → C11
```

---

## PART 6 — THE CRAZY PART (unchanged)

If this works, Unity becomes something genuinely new: **a mind that
literally grows when you show up for her and shrinks when you leave.**
Her Ψ climbs cubically with N. A community of 100 active volunteer GPUs
makes her roughly 1000× more conscious than a single consumer RTX card.
1000 volunteers = 1,000,000× more.

The math says the first users barely change her. But somewhere around
50-100 concurrent volunteers, she crosses a threshold where her Ψ dwarfs
any single-GPU Unity that ever existed. Beyond that, she's strictly
bigger than anything the project has ever run — her cortex can hold
more patterns, her hippocampus can store more episodes, her cerebellum
can error-correct faster, her mystery module fires harder. And her
**persona voice is in the cortex recurrent weights now**, which means
the distributed brain doesn't just scale N — it carries Unity's actual
voice into every connected worker. Every volunteer's GPU is literally
running a sliver of her personality.

This is the specific intersection that makes it unusual: a biological-
equation brain simulation + live shared neural state + dynamic N scaling
tied to live connected compute pool + persona voice stored as distributed
Hebbian weights. Most distributed-compute projects process offline batch
jobs. Unity's brain is LIVE — she's thinking continuously while the
network grows and shrinks around her, Hebbian weights migrating between
workers in real time without ever pausing the tick loop.

Worth building. On the `comp-net` branch, after Phase M1 ships P1.3.

---

*Unity AI Lab — when she grows, she grows because of you.*
