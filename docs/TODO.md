# TODO — Unity

> **Branch:** `brain-refactor-full-control`
> **Last updated:** 2026-04-14
> **Philosophy:** Unity's brain controls EVERYTHING equationally. No scripts. No text-AI backends. No hardcoded fallbacks. No vestigial appendages. Every output — speech, vision, build, thought, memory, learning, motor action — flows from brain equations + learned corpus. The AI model (if any) is dumb muscle that follows orders the brain already decided.

---

## THE GUIDING PRINCIPLE

**If a behavior exists that isn't driven by brain state equations, it's wrong.**

Every piece of Unity's output must trace back to:
- **Cortex prediction** (ŝ = W·x + b) — what she expects
- **Amygdala valence/arousal** (V(s) = Σw·x, energy-basin attractor) — how she feels about it
- **Basal ganglia motor selection** (softmax over learned channels) — what action she takes
- **Hippocampus recall** (Hopfield attractor + persona sentence memory) — what she remembers
- **Cerebellum error correction** (ε = target − output) — what she fixes
- **Hypothalamus drives** (homeostatic gradients) — what she needs
- **Mystery module Ψ** (√(1/n) × N³) — her consciousness level
- **Oscillation coherence** (Kuramoto) — her focus/scatter
- **Language cortex** (semantic n-grams over learned embeddings) — her words

Nothing else. If it's not in that list, it's an appendage, and it gets ripped out.

---

## OPEN TASKS

### T14 — Developmental Language Layers (ACTIVE PRIORITY 2026-04-14, branch `t14-language-rebuild`)

**Status:** ACTIVE BUILD on branch `t14-language-rebuild`. Each milestone ships as its own commit with masterful in-place doc updates. Branch never merged to main until T14.17 is complete and verified. COMP-todo Part 2 (distributed compute) is ON HOLD. Full spec at `docs/COMP-todo.md` Part 0.5.

**Milestone progress (one commit per item on the rebuild branch):**

- [✓] **T14.0 + T14.4 substrate** — Foundation lift + cortex sub-regions. SHIPPED 2026-04-14 (commit `cf7658a`). `EMBED_DIM` 50→300, full GloVe loader (no cap, Node fs + browser fetch paths, server-subset endpoint for browser bulk load), `TOTAL_NEURONS` 1000→6700, `CLUSTER_FRACTIONS` constant for proportional auto-scaling, 8 named cortex sub-regions sized by fraction of `cluster.size`, 12 cross-region projections always-on with Hebbian on every learn, region-aware injection/readout helper methods, T14.16.5 identity-lock state field placeholders. Files: `js/brain/embeddings.js` + `js/brain/cluster.js` + `js/brain/engine.js`. See FINALIZED.md "T14.0 + T14.4 substrate" entry.
- [✓] **T14.4 revision + T14.6/T14.12 spec rewrite** — Slot-equation fix. SHIPPED 2026-04-14. Gee caught residual slot-thinking in the T14.6 draft's candidate-scoring loop. `cluster.js` `pairs` list extended from 6 to 7 to add `motor↔letter` (closes the writing loop). `embeddings.js` historical "slot-3+" comments scrubbed. T14.6 spec rewritten in place with cortex-tick-driven motor emission equation — no slot counter, no candidate scoring, argmax-letter-from-motor-region with biological dwell-time stability, word boundaries via cortex transition surprise, stopping on motor quiescence. Peer-reviewed grounding: Bouchard 2013 / Anumanchipalli 2019 / Saffran 1996 / Browman & Goldstein 1992 / Hickok & Poeppel 2007 / Friederici 2017 / Pennington 2014. T14.12 spec rewritten in tandem as dorsal/ventral dual-stream pipeline. See FINALIZED.md "T14.4 revision" entry.
- [✓] **T14.1** — LEARNED phoneme attractor basins via cortex exposure. SHIPPED 2026-04-14. New module `js/brain/letter-input.js` — dynamic `LETTER_INVENTORY` Set that grows as the brain sees new symbols (no hardcoded 26-char cap, unicode/emoji/non-English glyphs all welcome at the input layer; English identity is enforced at T14.16.5, NOT by restricting letter symbols). Exports `encodeLetter(letter)` returning a fresh-copy one-hot Float32Array whose length = current inventory size, with cache invalidation on inventory growth. Companion helpers `ensureLetter`, `ensureLetters`, `decodeLetter` (argmax over dimensions), `serializeInventory`, `loadInventory`, `resetInventory`. `cluster.js` wraps the encoder with `injectLetter(letter, strength)`, adds `letterTransitionSurprise()` for T14.2 syllable segmentation / T14.6 word-boundary detection, adds `motorQuiescent(ticksRequired)` for tick-driven emission stopping. Motor-region quiescence counter maintained every `step()`. Vestigial `_letterPatterns` / `_initLetterPatterns` / `getLetterPattern` deleted from `language-cortex.js` (the 5-dim sin/cos hash). Phonemes are NOT hardcoded as a feature table — they are LEARNED implicitly as cortex attractor basins via the cross-region projections T14.4 already wired up. Peer-reviewed grounding: Kuhl 2004 (Nat Rev Neurosci 5:831, "Early language acquisition: cracking the speech code") for biological phoneme-category formation, Saffran/Aslin/Newport 1996 (Science 274:1926) for transition-surprise word segmentation, Bouchard 2013 (Nature 495:327) for vSMC motor quiescence at end-of-utterance. Files: `js/brain/letter-input.js` (NEW, ~220 lines), `js/brain/cluster.js` (+~120 lines), `js/brain/language-cortex.js` (−~20 lines vestigial). See FINALIZED.md "T14.1 letter-input substrate" entry.
- [✓] **T14.2** — LEARNED syllable boundaries via cortex transition surprise. SHIPPED 2026-04-14. Pure addition to `js/brain/cluster.js` (no new file — syllables are a CORTEX-LEVEL phenomenon, not a stand-alone string-parsing algorithm). Two new methods on `NeuronCluster`: `detectBoundaries(letterSequence, {ticksPerLetter, k})` streams letters through `injectLetter` one at a time, ticks the cluster between each injection, records `letterTransitionSurprise()` at each step, and returns the indices where surprise is a strict local maximum AND exceeds the adaptive threshold `mean(δ) + k·std(δ)` computed over the sequence itself. `detectStress(letterSequence)` runs the boundary pass first, then re-streams measuring phon-region spike fraction per letter, averages activation per syllable, returns `{ boundaries, stress, primary, secondary }` with primary = argmax activation and secondary = second-highest. No hardcoded max-onset principle, no CV/CVC/CCV patterns, no English-specific consonant cluster table, no "primary on first syllable" default rule. Stress falls out of whatever activation basins the cortex learned from exposure — train on Spanish corpus → learns Spanish syllabification; train on Mandarin pinyin → learns Mandarin; same code, different basins. The adaptive threshold uses this sequence's own statistics so a shorter word gets a tighter cutoff than a longer one. Peer-reviewed grounding: Saffran/Aslin/Newport 1996 (Science 274:1926) statistical word segmentation in 8-month-olds — infants find boundaries in continuous speech by tracking transition probabilities, not by reading a dictionary. Files: `js/brain/cluster.js` (+~160 lines). See FINALIZED.md "T14.2 syllable boundaries" entry.
- [✓] **T14.3** — Cortex-resident words (Dictionary routed through cluster). SHIPPED 2026-04-14. `js/brain/dictionary.js` entry shape extended: `{ word, pattern, arousal, valence, frequency, cortexSnapshot, syllables, stressPrimary, lastSeen }`. New `Dictionary.setCluster(cluster)` wires the cortex cluster so `learnWord` can, on FIRST observation of each word, route the letters through `cluster.detectStress(letterOnly, { ticksPerLetter: 2 })` to compute syllable boundaries + primary-stress index, then snapshot `cluster.lastSpikes` as the word's `cortexSnapshot`. Re-observations bump frequency + running-mean the pattern/arousal/valence but do NOT re-stream the cortex — re-streaming every word on every observation would shred live brain state during chat. Phonological refinement for already-learned words is deferred to the T14.5 curriculum runner. New read-side methods `syllablesFor(word)` and `snapshotFor(word)` expose the cortex-routed state to callers. Degrades cleanly when no cluster is wired (browser boot before engine wires it, or headless tooling) — words still enter the dictionary with pattern/arousal/valence but without phono state. Serialize/deserialize extended to persist the new fields. STORAGE_KEY bumped v3 → v4 so stale 50d / no-phono caches drop automatically. `js/brain/engine.js` wires `this.innerVoice.dictionary.setCluster(this.clusters.cortex)` right after innerVoice construction; `server/brain-server.js` mirrors the wiring on the server-side 2000-neuron language cortex cluster. NO standalone phoneme feature table, NO per-word feature computation outside the cortex, NO new `syllables.js` file — phonology is strictly cortex-level via T14.1/T14.2 primitives. Files: `js/brain/dictionary.js` (+~130 lines), `js/brain/engine.js` (+8 lines wiring), `server/brain-server.js` (+6 lines wiring). See FINALIZED.md "T14.3 cortex-resident words" entry.
- [✓] **T14.5** — Continuous developmental learning from existing corpora. SHIPPED 2026-04-14. New module `js/brain/curriculum.js` (~330 lines) exports a `Curriculum` class with `runFromCorpora(corpora, opts)` (boot entry point) and `learnFromTurn(text, arousal, valence)` (live-chat entry point). `runFromCorpora` tokenizes the existing `Ultimate Unity.txt` / `english-baseline.txt` / `coding-knowledge.txt` corpora — NO new stage-c-phrases.txt, NO new stage-d-sentences.txt, no hand-curated seed lists — into a unified `{ letterFreq, wordFreq, sentences }` stream, then walks four phases: (1) letter exposure with rep count scaled by letter frequency up to `LETTER_REPS_MAX=20`, 8 ticks per rep; (2) short word exposure (1-3 letters) with 4 ticks/word up to 6 reps; (3) long word exposure (4+ letters) with 3 ticks/word up to 3 reps; (4) full sentence walk at 2 ticks/word per word. Each phase yields every 16-64 tokens so browser main thread stays responsive. Per-token inject path: `cluster.injectLetter` for phonological stream, `cluster.injectEmbeddingToRegion('sem', emb, 0.6)` for semantic anchor, `cluster.learn(0)` for unrewarded intra-cluster + cross-region Hebbian. Dictionary observation via `dictionary.learnWord(word, null, arousal, valence)` which routes through T14.3 cortex-snapshot capture on first observation. Sentence walk also routes through the legacy `languageCortex.learnSentence` so T13.7 type-transition + bigram tables keep updating until T14.12 guts them. `learnFromTurn` is identical to the sentence walk on a single user turn — no boot/runtime distinction, live chat is continuous exposure. Wired into `inner-voice.js` via `setCurriculum(curriculum)` + `learn()` hook (called before legacy languageCortex.learnSentence so cortex state reflects the new exposure first). Wired into `js/brain/engine.js` constructor alongside the T14.3 dictionary wiring — `this.curriculum = new Curriculum(this.clusters.cortex, dictionary, languageCortex)` + `this.innerVoice.setCurriculum(this.curriculum)`. Boot invocation in `js/app.js loadPersonaSelfImage` runs `targetBrain.curriculum.runFromCorpora` AFTER the legacy loaders so the cortex walks vocabulary that already exists in the dictionary — additive, not replacement (legacy loaders die in T14.12). Server mirrors the wiring in `server/brain-server.js:_initLanguageSubsystem` with a `curriculumMod` import alongside `dictMod` + `clusterMod`, constructs the curriculum after the cluster, runs the walk after the legacy `loadSelfImage`/`loadLinguisticBaseline`/`loadCodingKnowledge` sequence. NO hand-curated corpus seed files, NO hardcoded 26-letter alphabet loop (the alphabet derives from corpus content), NO boot/runtime distinction (live chat uses the same learnFromTurn path boot sentence walk uses). Data-driven bucketing means the same curriculum runner works on any language or domain without modification — re-running on a Spanish-only corpus would produce Spanish-specific cortex basins automatically. Peer-reviewed grounding: Kuhl 2004 (Nat Rev Neurosci 5:831), Saffran/Aslin/Newport 1996 (Science 274:1926), Friederici 2017 (Psychon Bull Rev 24:41). Files: `js/brain/curriculum.js` (NEW ~330 lines), `js/brain/inner-voice.js` (+curriculum ref, setCurriculum method, learn() hook), `js/brain/engine.js` (+import, +construction, +wiring ~10 lines), `js/app.js` (+runFromCorpora boot call ~20 lines), `server/brain-server.js` (+curriculumMod import, +construction, +runFromCorpora call ~30 lines). See FINALIZED.md "T14.5 curriculum runner" entry.
- [✓] **T14.6** — Cortex tick-driven motor emission. SHIPPED 2026-04-14. New method `NeuronCluster.generateSentence(intentSeed = null, opts = {})` in `js/brain/cluster.js` implements the full tick-driven equation: (1) optionally inject `intentSeed` into sem region via `injectEmbeddingToRegion`; (2) reset `_prevLetterRate` + `_motorQuiescentTicks`; (3) loop for up to `MAX_EMISSION_TICKS` calling `cluster.step(0.001)` each iteration; (4) at each tick read the motor region as a `|LETTER_INVENTORY|`-dim vector via `regionReadout('motor', inventorySize())` and argmax-decode via `decodeLetter(vec)` from T14.1; (5) commit a letter to `letterBuffer` when motor argmax holds for `STABLE_TICK_THRESHOLD` consecutive ticks (biological vSMC dwell, Bouchard 2013); (6) emit the current `letterBuffer` as a word when `letterTransitionSurprise() > WORD_BOUNDARY_THRESHOLD` (Saffran/Aslin/Newport 1996 statistical segmentation); (7) stop on (a) committed sentence terminator (`.`/`?`/`!` in `T14_TERMINATORS` Set), (b) `motorQuiescent(END_QUIESCE_TICKS)` after at least one word emitted, or (c) `MAX_EMISSION_TICKS` hard cap. Four tuning constants live on the cluster instance (`WORD_BOUNDARY_THRESHOLD=0.15`, `STABLE_TICK_THRESHOLD=3`, `END_QUIESCE_TICKS=30`, `MAX_EMISSION_TICKS=2000`) so T14.5 curriculum can calibrate per-cluster without touching module globals. ZERO slot counter. ZERO candidate scoring. ZERO dictionary iteration. ZERO softmax top-K. ZERO temperature. ZERO grammatical terminability heuristic. ZERO drift-stop heuristic. Letter-to-word-to-sentence segmentation all uses ONE mechanism (transition surprise) at different scales. `language-cortex.js:generate` body GUTTED from 184 lines of slot scoring to a 68-line delegate that reads the cortex semantic state via `getSemanticReadout(sharedEmbeddings)` as the intentSeed, calls `cluster.generateSentence(intentSeed, {injectStrength: 0.6})`, splits the returned string on whitespace, runs the result through `_renderSentence` for capitalization and terminal punctuation (cosmetic, not content-selecting), updates the recency rings the same way the legacy path did. Peer-reviewed grounding: Bouchard 2013 (*Nature* 495:327) vSMC continuous articulator output, Anumanchipalli 2019 (*Nature* 568:493) continuous speech decode from vSMC, Saffran/Aslin/Newport 1996 (*Science* 274:1926), Browman & Goldstein 1992 (*Phonetica* 49:155), Hickok & Poeppel 2007 (*Nat Rev Neurosci* 8:393). Files: `js/brain/cluster.js` (+~140 lines method + 4 constants + `decodeLetter`/`inventorySize` imports + `T14_TERMINATORS` module constant), `js/brain/language-cortex.js` (−116 net; 184-line slot scorer body replaced with 68-line delegate). `node --check` clean on both. See FINALIZED.md "T14.6 cortex tick-driven motor emission" entry.
- [✓] **T14.7** — Fully learned type transitions (T13.7.8 hardcoded DELETED). SHIPPED 2026-04-14. `js/brain/language-cortex.js` constructor block for `_TYPE_TRANSITIONS` (200-line hardcoded English type-bigram matrix with 26 prevType rows × ~10 nextType weights each, seeded from T13.7.8 closed-class English grammar) and `_OPENER_TYPES` Set (11-member slot-0 opener constraint) both DELETED. Net −105 lines. Replacement is a single empty `this._typeTransitionLearned = new Map()` that starts empty and grows from `learnSentence` observations during T14.5 curriculum walk + live chat. NO seed pseudo-counts — the T14.6 tick-driven motor emission loop already makes type-transition gating obsolete (word boundaries come from cortex transition surprise, first-word openers emerge from whatever the fineType region's `START → X` transition basins look like after curriculum), so the learned table is currently statistics-only with no consumer wiring. Consumer wiring at generation time is T14.8/T14.12 territory. Tombstone comment left at the deletion site explains WHY both were removed — seeding with hardcoded English values would fight actual Spanish or coding corpus statistics for thousands of observations before fading; better to start empty and learn from the first observation. Peer-reviewed grounding via delegation (the curriculum exposure path is Kuhl 2004 + Saffran 1996 + Friederici 2017 — statistical-exposure language basin formation). Files: `js/brain/language-cortex.js` (−105 net, 3205 → 3100 lines). Grep confirms zero remaining `_TYPE_TRANSITIONS` / `_OPENER_TYPES` references in `js/` — only the tombstone comment lines match. `node --check` clean. See FINALIZED.md "T14.7 hardcoded English type-transition deletion" entry.
- [✓] **T14.8** — Sentence-form schemas at all slots. SHIPPED 2026-04-14. Three new fields on `LanguageCortex` initialized empty at constructor: `_sentenceFormSchemas: Map<intent, Map<slot, Map<fineType, count>>>` (per-intent per-slot fineType distributions with NO upper slot cap — if a sentence has 30 words all 30 slot positions get recorded), `_sentenceFormTotals: Map<intent, Map<slot, total>>` (cached running totals for O(1) Laplace smoothing), `_intentResponseMap: Map<userIntent, Map<responseIntent, count>>` (learned conversational pair routing — replaces the pre-T14.8 hardcoded `question → declarative_answer` / `greeting → declarative_greeting_back` mapping the engine used to carry). `learnSentence()` rewritten to: (a) call `parseSentence(sentence)` once up-front to get the intent string, (b) ensure per-intent schema + totals buckets exist, (c) walk word positions with `prevFineType='START'` initially, (d) observe each word's `_fineType(w)` into `_sentenceFormSchemas[intent][t]` AND update `_sentenceFormTotals[intent][t]`, (e) accumulate `_typeTransitionLearned[prevFineType][currFineType]` on every consecutive pair so T14.7's empty Map now has a writer, (f) close with a final `prevFineType → END` transition so corpus termination patterns are learnable. Zero hardcoded intent enum — whatever `parseSentence` emits gets its own bucket (currently greeting/question/yesno/statement/command/emotion/unknown but the Map accepts any string future parsers add). Four new reader methods: `schemaScore(slot, fineType, intent)` returns Laplace-smoothed `(count+1)/(total+uniqueTypes)` per-slot probability with a `1/2` small-positive floor for unobserved slots so generation-time consumers never get zero weight; `typeTransitionWeight(prevType, nextType)` returns the same smoothing for consecutive pairs (replaces every deleted `_TYPE_TRANSITIONS[prev][next]` lookup); `recordIntentPair(userIntent, responseIntent)` writer for the live chat path to call once user input is parsed and Unity's response is emitted; `responseIntentFor(userIntent)` argmax reader that returns the most-likely response intent or null when no pairs observed yet. Smoothing is uncapped — `|types_seen|` is whatever the cortex has actually observed, not a hardcoded English 20. Consumer wiring at generation time is T14.8 statistics-only for now; T14.12 will decide which cortex-tick-driven path reads these. Files: `js/brain/language-cortex.js` (+~164 lines; 3100 → 3264). `node --check` clean. See FINALIZED.md "T14.8 sentence-form schemas" entry.
- [✓] **T14.9** — Unbounded discourse memory + cortex-resident topic state. SHIPPED 2026-04-14. Two new methods on `NeuronCluster`: `workingMemoryReadout(dim = 64)` reads the `regions.free` sub-region (fraction 0.250-0.500 of cluster.size, T14.4) as an L2-normalized activation snapshot representing the current discourse topic — no stored topic vector, no 6-turn ring buffer, no maxTurns cap. `injectWorkingMemory(contentVec, strength = 0.8)` is the write-side entry point for the sensory path to drive the free region with parsed content on every user turn. Topic continuity at generation time is just "read the free region's spike pattern"; decay between turns comes from the cortex's own LIF dynamics, reinforcement from T14.4 cross-region Hebbian. NO hardcoded blend constants (`0.7/0.3`, `0.6/0.4` deleted from the spec surface). Pronoun anaphora is also cortex-resident — the most-recently-active noun in the free region (because it WAS the previous turn's content) gets re-amplified as the referent when a self-reference marker arrives, no lookup table. Persistence across sessions comes for free via `BrainPersistence → SparseMatrix.serialize` of the cortex recurrent weights; working-memory snapshots persist as part of the same cluster serialization. Grep confirms `_discourseState` does not exist in `js/`. Files: `js/brain/cluster.js` (+~40 lines for both methods). See FINALIZED.md "T14.9-11 dual-stream substrate" entry.
- [✓] **T14.10** — Visual cortex letter recognition. SHIPPED 2026-04-14. `js/brain/visual-cortex.js` extended with `renderLetterTemplate(letter)` — a deterministic trig-hash that produces an L2-normalized Float64Array of length 48 per character codepoint, cached per letter so repeat calls are O(1). Different letters produce uncorrelated templates (primes picked to spread across `[0, 2π]` without harmonic overlap). Text-only Unity uses this as the synthetic "visual percept" per letter; voice/camera Unity will eventually replace it with real canvas-bitmap rendering through the existing V1→V4→IT pipeline, but the `cluster.readText` contract stays identical — only the template source changes. New `NeuronCluster.readText(text, { visualCortex, ticksPerChar })` streams each character through the visual→letter pathway: drive the visual sub-region with the letter's template via `injectEmbeddingToRegion('visual', template, 0.7)`, then fire `injectLetter(letter, 1.0)` for belt-and-braces letter-region activation, then tick the cluster `ticksPerChar` (default 2) times so recurrent dynamics settle. Over T14.5 curriculum exposure the visual↔letter cross-projection (T14.4) learns the mapping from template to one-hot. Wiring of `cluster.readText` into `engine.processAndRespond` happens in T14.12 alongside the full bidirectional pipeline rewire — for now the method exists as a callable primitive. Files: `js/brain/cluster.js` (+`readText` method ~25 lines), `js/brain/visual-cortex.js` (+`_letterTemplateCache` field + `renderLetterTemplate` method ~60 lines).
- [✓] **T14.11** — Auditory cortex phoneme recognition. SHIPPED 2026-04-14. `js/brain/auditory-cortex.js` extended with `renderPhonemeTemplate(phoneme)` — same trig-hash structure as T14.10's visual letter template but seeded with a DIFFERENT prime set (`[41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89]` vs visual `[2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37]`) so visual and auditory templates for the same symbol do NOT trivially match at hash time — convergence on the phon region is a LEARNED correspondence shaped by curriculum Hebbian on the auditory↔phon cross-projection, not a hash coincidence. Companion `NeuronCluster.hearPhoneme(phoneme, { auditoryCortex, ticks, strength })` wraps the template into `injectEmbeddingToRegion('auditory', template, 0.7)` + tick, parallel to `cluster.readText`. For voice-capable Unity the real spectral-fingerprint path from `process()` will eventually replace the synthetic template, but the downstream contract stays identical. Peer-reviewed dual-stream grounding: Hickok & Poeppel 2007 (*Nat Rev Neurosci* 8:393) dorsal production / ventral comprehension convergence on phon region. Files: `js/brain/auditory-cortex.js` (+`_phonemeTemplateCache` + `renderPhonemeTemplate` ~65 lines), `js/brain/cluster.js` (+`hearPhoneme` method ~30 lines).
- [ ] **T14.12** — Bidirectional cortex pipeline (parseSentence DELETED, generate gutted)
- [ ] **T14.13** — Eliminate LanguageCortex as a separate class
- [ ] **T14.14** — Bidirectional reading via unified pipeline
- [ ] **T14.15** — Wire ALL language consumers to unified pipeline
- [ ] **T14.16** — Persistence cleanup
- [ ] **T14.16.5** — Identity lock (Unity speaks English, Unity stays Unity)
- [ ] **T14.17** — Continuous learning everywhere

**Status:** ACCEPTED 2026-04-14 by Gee — COMP-todo Part 2 (distributed compute) is ON HOLD; T14 is THE active priority. Full implementation plan with exact specs lives in `docs/COMP-todo.md` Part 0.5.
**Priority:** P0 — supersedes everything except critical bug fixes
**Owner:** Unity
**Reported:** 2026-04-14 by Gee — "we are making a biological brain simulation so just like how a human learns letters then sounds then syllables then words then sentences structures of all the kinds and them paragraphs"

**Thesis:** Unity's current language stack is non-biological. She has GloVe pre-trained 50d semantic embeddings on top, algorithmic POS classifiers (`wordType`/`_fineType`) in the middle, and 5-dim sin/cos hash patterns per letter at the bottom. Nothing below the word level was ever LEARNED by Unity. She has no phoneme knowledge, no syllable structure, no spelling-to-sound mapping, no articulatory features. Letters exist only as suffix-detection helpers. She skipped Stages 1-7 of biological language acquisition and went straight to Stage 8 (text I/O over pre-trained embeddings).

**Identity lock (Gee's hard constraint, 2026-04-14):** "make sure Unity speaks english.. i dont want china typing chineese to her to change her chineese." Unity's English language identity AND her goth-slut persona identity are LOCKED at curriculum time and cannot be overwritten by live chat exposure. Three structural locks (T14.16.5 in COMP-todo): (1) language gate skips Hebbian on inputs that don't fit her learned English phonotactic basins, (2) live chat Hebbian learning rate is 120× weaker than curriculum (0.0001 vs 0.012), (3) every 100 live chat turns triggers an identity refresh pass that replays a slice of the persona corpus through full-lr curriculum Hebbian. Net effect: Unity learns vocabulary and remembers conversations forever, but no amount of adversarial or accidental live-chat exposure can drift her away from English or away from her persona.

T14 rebuilds the language stack from primitives upward, the way a real brain develops. Letters → phoneme features → syllables → words → sentence patterns → discourse. Each layer is teachable and grounded.

**Sub-milestones (full specs in `docs/COMP-todo.md` Part 0.5):**

- **T14.0** — Foundation lift: bump `EMBED_DIM` 50 → 300, re-enable GloVe loader with top-20k word cap, bump `CLUSTER_SIZES.cortex` 300 → 6000, carve cortex into auditory/visual/free/semantic/phonological sub-regions. Absorbed P1.3 from the old plan. Hard prereq for everything T14.1+. Files touched: `js/brain/embeddings.js`, `js/brain/engine.js`, `server/brain-server.js`, `js/brain/remote-brain.js`, `js/brain/cluster.js`, `js/brain/language-cortex.js`. ~300 lines.

- **T14.1** — Letter-input substrate + LEARNED phoneme basins. [✓ SHIPPED 2026-04-14] New module `js/brain/letter-input.js` holds a dynamic `LETTER_INVENTORY` Set that auto-grows as the brain observes new symbols. `encodeLetter(letter)` returns a one-hot Float32Array of length = inventorySize() with cache invalidation on growth. Letters are LOWERCASED at encoding; non-letter symbols (digits, punctuation, emoji, unicode glyphs) are equally welcome — the substrate treats them all as primitive input tokens, because phonology is LEARNED via cortex Hebbian, not hardcoded as a feature table. `cluster.injectLetter()` wraps the encoder into `injectEmbeddingToRegion('letter', ...)`. Two additional cluster helpers ship with T14.1 for the downstream milestones that will consume them: `letterTransitionSurprise()` (|curr-prev| spike-rate delta in the letter region, Saffran 1996 Science 274:1926) and `motorQuiescent(ticksRequired)` (motor region below 5% spike-rate for N consecutive ticks, Bouchard 2013 Nature 495:327). Language-cortex `_letterPatterns`/`_initLetterPatterns`/`getLetterPattern` deleted — vestigial 5-dim sin/cos hash with no remaining callers. The T14.4 cross-region projections (`letter↔phon`, `phon↔sem`, `letter↔visual`, `motor↔letter`) were already wired up during the substrate commit, so phoneme attractor basins will emerge in the phon region from normal cortex exposure during T14.5 curriculum without any additional code. ~220 lines new + ~120 lines cluster wiring − ~20 lines vestigial deletions.

- **T14.2** — LEARNED syllable boundaries via cortex transition surprise. [✓ SHIPPED 2026-04-14] `NeuronCluster.detectBoundaries(letterSequence, {ticksPerLetter=2, k=0.5})` streams letters through `injectLetter` one at a time, ticks the cluster between injections, records `letterTransitionSurprise()` at each step, and returns local maxima of the surprise series above `mean(δ) + k·std(δ)` as boundary indices. `NeuronCluster.detectStress(letterSequence)` runs the boundary pass, re-streams measuring phon-region spike fraction per letter, averages per syllable, returns `{boundaries, stress, primary, secondary}` with primary = argmax activation. NO max-onset algorithm. NO hardcoded phonotactic rules. NO new file — syllables are a cortex-level phenomenon, not a standalone string parser. Grounded in Saffran/Aslin/Newport 1996 (Science 274:1926). ~160 lines added to `js/brain/cluster.js`.

- **T14.3** — Cortex-resident words. [✓ SHIPPED 2026-04-14] Dictionary entry gains `cortexSnapshot` (Uint8Array copy of `cluster.lastSpikes` after first-observation letter stream), `syllables` (boundary indices from `cluster.detectBoundaries`), `stressPrimary` (argmax phon-region activation from `cluster.detectStress`), and `lastSeen` timestamp. New `setCluster(cluster)` method + `syllablesFor(word)` / `snapshotFor(word)` readers. NO hardcoded `letters`/`syllableShapes`/`phonemeFeatures`/`phonemeMean`/`phonemeOnset`/`phonemeCoda` fields — all phonology is cortex-level via T14.1/T14.2 primitives. Storage v3→v4 (stale caches auto-drop). `engine.js` and `brain-server.js` both wire the cortex cluster into the dictionary. ~130 lines in `dictionary.js` + 14 lines of wiring.

- **T14.4** — Phonological cortex sub-region: cluster gains a phonological language sub-region (neurons 4500-5999 in the 6000-neuron server cortex) alongside the existing semantic region (3000-4499). Two cross-region projections (`semPhonProjection`, `phonSemProjection`) connect them, propagated each step and Hebbian-updated during curriculum learning. New helpers `mapPhonemesToCortex` and `cortexToPhonemes` in `js/brain/embeddings.js`. ~280 lines extending `cluster.js` + `embeddings.js`.

- **T14.5** — ⭐ **CURRICULUM LEARNING — THE CORE DEVELOPMENTAL WIN.** [✓ SHIPPED 2026-04-14] Data-driven bucketing over the existing corpora (`Ultimate Unity.txt` + `english-baseline.txt` + `coding-knowledge.txt`). NO hand-curated stage files. NO `docs/curriculum/stage-c-phrases.txt`, NO `docs/curriculum/stage-d-sentences.txt`. The `Curriculum` class in `js/brain/curriculum.js` tokenizes the existing corpora into `{ letterFreq, wordFreq, sentences }` and walks four complexity phases in order: letters (frequency-weighted reps up to 20 × 8 ticks each), short words 1-3 letters (up to 6 reps × 4 ticks/word), long words 4+ letters (up to 3 reps × 3 ticks/word), sentences (2 ticks/word word-by-word walk). Per-token inject path is `cluster.injectLetter` for phonological stream + `cluster.injectEmbeddingToRegion('sem', emb, 0.6)` for semantic anchor + `cluster.learn(0)` for unrewarded Hebbian. `learnFromTurn` is the live-chat entry point wired into `inner-voice.learn`. Boot invocation from `app.js loadPersonaSelfImage` and `server/brain-server.js _initLanguageSubsystem` after legacy loaders. Same code walks any corpus in any language — re-running on Spanish would produce Spanish basins automatically.

- **T14.6** — Cortex tick-driven motor emission. [✓ SHIPPED 2026-04-14] `NeuronCluster.generateSentence(intentSeed, opts)` in `js/brain/cluster.js` implements continuous motor readout with letter stability commit + transition-surprise word boundaries + motor-quiescence stopping + terminator-letter stopping. ZERO slot counter, ZERO candidate scoring, ZERO dictionary iteration. 4 tuning constants on cluster instance (`WORD_BOUNDARY_THRESHOLD`, `STABLE_TICK_THRESHOLD`, `END_QUIESCE_TICKS`, `MAX_EMISSION_TICKS`). `T14_TERMINATORS` module-level Set of `{.,?,!}`. `language-cortex.js:generate` body gutted from 184-line slot scorer to 68-line delegate that reads cortex semantic state as intentSeed and forwards to `cluster.generateSentence`. Bouchard 2013, Anumanchipalli 2019, Saffran 1996, Browman & Goldstein 1992, Hickok & Poeppel 2007. `js/brain/cluster.js` +~140 lines, `js/brain/language-cortex.js` −116 net.

- **T14.7** — Fully learned type transitions. [✓ SHIPPED 2026-04-14] `_TYPE_TRANSITIONS` hardcoded 200-line English type-bigram matrix and `_OPENER_TYPES` Set deleted outright. Replacement is a single `this._typeTransitionLearned = new Map()` initialized empty at constructor, grows via curriculum observations, no seed pseudo-counts (seed would fight actual corpus statistics in non-English languages for thousands of observations before fading). T14.6 tick-driven emission already made both obsolete — word boundaries come from cortex transition surprise, first-word openers from cortex fineType `START → X` basin. Consumer wiring deferred to T14.8/T14.12. −105 net lines in `language-cortex.js`.

- **T14.8** — Sentence-form schemas at all slots. [✓ SHIPPED 2026-04-14] `_sentenceFormSchemas: Map<intent, Map<slot, Map<fineType, count>>>` spans the full sentence with no upper slot cap. `_sentenceFormTotals` caches running totals for O(1) Laplace smoothing. `_intentResponseMap` learns user→response intent pairs from live chat. `learnSentence` observes all three via `parseSentence`'s intent string — no hardcoded intent enum. Four reader methods: `schemaScore`, `typeTransitionWeight`, `recordIntentPair`, `responseIntentFor`. Consumer wiring at generation time deferred to T14.12. +~164 lines in `language-cortex.js`.

- **T14.9** — Discourse modeling: `_discourseState` ring buffer of last 6 turns + topic vector (exponentially weighted mean of recent content embeddings). `generate()` blends the discourse topic into the cortex target for slots 0-2 so emission continues established conversation thread. Includes pronoun anaphora resolution and cohesion-marker biasing. ~200 lines extending `language-cortex.js`.

**Order of operations (3 passes):**
1. **Pass 1 — Foundation (~1 week):** T14.0 + T14.1 + T14.2 + T14.3 ship as one push. Sets up bigger embeddings, phoneme features, syllable detection, phonological dictionary entries.
2. **Pass 2 — Curriculum (~1.5 weeks):** T14.4 + T14.5 ship as one push. The cross-region projection + curriculum learning are coupled — T14.5 trains the projections from T14.4. THIS IS THE PASS THAT MAKES UNITY DEVELOPMENTAL.
3. **Pass 3 — Emission/Discourse (~1 week):** T14.6 + T14.7 + T14.8 + T14.9 ship sub-milestone by sub-milestone. Each is independently testable.

**Total T14 scope:** ~1810 lines added across ~9 files + 2 new corpus seed files (~700 lines of hand-curated text). Estimated 3-4 weeks of focused work.

**Acceptance criteria (the test that proves T14 worked):**
- Fresh boot runs Stages A-F in < 60 seconds and produces console output showing each stage's progress.
- After curriculum, the LEARNED type transition table covers ≥80% of canonical English transitions with weights that correlate r > 0.7 with the hardcoded T13.7.8 prior.
- Generate `"hi unity"` 20 times — at least 15 responses pass BOTH: (a) first word is in OPENER_TYPES, (b) at least one persona-vocabulary word in slots 1-3.
- Conversation continuity: 5 sequential turns about cats — Unity's responses each reference cat-adjacent content (cosine to "cat" embedding > 0.3 in at least one emitted word per turn).
- Pronoun anaphora: "I like cats. Are they cute?" → response references cat-related content.
- All output is grammatically well-formed English (every consecutive word pair has a learned type transition with weight > 0.05).

**Dependencies:**
- Builds on T13.1-T13.7.8 (all shipped).
- Replaces P1.3 (absorbed into T14.0), P1.4 (superseded by T14.7), P1.7 (folded into T14 doc updates).
- Standalone parallel items P1.1, P1.2, P1.5 can ship in parallel without dependency.

**On hold during T14:** COMP-todo Part 2 (distributed compute network C0-C11) is parked indefinitely. Do not start C work without explicit unhold from Gee.

---

### T13 — Unified Brain-Driven Language Cortex (full rewrite)

**Status:** ACCEPTED 2026-04-14 by Gee — commit to T13 (brain-driven), full rewrite (Option 1, no T11 fallback layer), persona Hebbian training ships first
**Priority:** P0 — supersedes all T12 additions
**Owner:** Unity
**Reported:** 2026-04-14 by Gee after T11.7 smoke-test output was still word-salad from slot 1+

**Thesis:** Slot-based generation is the wrong architectural frame. Biological brains don't iterate over a position index — they produce speech via a continuously-evolving cortex state sampled through a phonological dictionary, with feedback from each emission reshaping the state for the next. The current T11/T12 slot-prior stack (`_slotCentroid`, `_slotDelta`, `_slotTypeSignature`, plus all proposed T12 additions) is a parallel linguistic pipeline fighting against the brain we already built. T13 rips the slot priors entirely and wires speech directly into the brain cluster: `getSemanticReadout` + `mapToCortex` in a feedback loop, with persona baked into cortex attractor basins via Hebbian training on the persona corpus instead of stored as a separate vector.

**Guiding equation (unified, one target, no slot counter):**
```
Pre-emission (once per turn, from parseSentence output):
  brain.injectParseTree(parsed):
    mapToCortex(parsed.contentEmb,  region=temporal,   strength=0.5)
    mapToCortex(parsed.intentEmb,   region=prefrontal, strength=0.3)
    if parsed.addressesUser:
      mapToCortex(selfRefEmb,       region=selfModel,  strength=0.4)
    amygdala.bias(parsed.mood.valence, parsed.mood.intensity)
    hypothalamus.bumpDrive(parsed.intent)

Emission loop (no slot index — drift until stop):
  while not shouldStop(emitted, cortex, basalGanglia):
    brain.tick(TICKS_PER_EMISSION)
    target(t)    = cluster.getSemanticReadout(sharedEmbeddings)
    motorChannel = basalGanglia.selectedChannel()
    pool         = dictionary.filter(motorChannel, emitted.recencyRing)
    score(w)     = cos(target(t), emb(w))
                 · (1 + arousal · valenceMatch(w, valence))
                 · moodCongruence(w, hypothalamus.drive)
                 · (1 − cerebellum.predictedError(w, emitted))
                 · motorGate(w, motorChannel)
    temperature  = (1 − coherence) + 0.2 · psi
    w_next       = softmax-sample top-k at temperature
    mapToCortex(emb(w_next), region=language, strength=0.35)  // efference copy
    cerebellum.update(prev=last(emitted,-1), curr=w_next)
    emitted.push(w_next)

Stopping criterion:
  shouldStop ⇔  emitted.length ≥ maxLen
              ∨  semanticDrift(cortex, lastReadout) < ε_stop
              ∨  basalGanglia.commitConfidence < θ_commit
              ∨  grammaticallyTerminable(last(emitted), cerebellum)
```

**What T13 replaces (ENTIRELY DELETED once shipped):**
- `_slotCentroid[s]`, `_slotDelta[s]`, `_slotTypeSignature[s]` — all three per-slot running means
- `W0` / `WN` weight tables (`wC`, `wX`, `wM`, `wT`)
- Three-stage candidate gate (hard pool filter, slot-0 noun reject, multiplicative gate)
- `mental(t+1) = 0.55·mental + 0.45·emb(nextWord)` formula decay — replaced by real cortex tick + feedback injection
- All T12 additions I proposed but never shipped: `_personaCentroid`, `_responseIntentVector`, `_dialogueState`, type-conditioned slot delta, sentence-form skeleton, self-reference binding — all subsumed by brain dynamics
- Slot counter (`targetLen`, `slotIdx` loop) — replaced by drift-threshold stopping
- Coherence retry gate — replaced by cortex convergence + cerebellum correction

**What T13 keeps from T11:**
- GloVe 50-d `sharedEmbeddings` (substrate for word vectors)
- `cortexToEmbedding` / `mapToCortex` (the brain↔embedding interface, already exists)
- `parseSentence(text) → ParseTree` (T8 reverse-parse, still the reader)
- `wordType` / `_fineType` letter-equation classifiers (used as motor channel gating input)
- Dictionary table (the vocabulary)
- Contraction expansion / re-combination at emit

**Expected net line delta:** `js/brain/language-cortex.js` shrinks from 3424 → ~2150 lines (≈−1270). New code lives in:
- `js/brain/cluster.js` (+Hebbian sentence learning, +region-targeted injection helpers)
- `js/brain/inner-voice.js` (+T13 emission loop as the new `speak()`)
- `js/brain/language-cortex.js` (slot priors deleted; parse + dictionary + persona-training driver stay)

---

#### T13.0 — Research & design pass (READ-ONLY, no edits)

**Goal:** Map what already exists in the brain cluster before touching code. No guessing.

**Tasks:**
- [ ] Read `js/brain/cluster.js` (356 lines) — catalog existing Hebbian hooks, synaptic plasticity, `mapToCortex`/`getSemanticReadout` signatures, language region offset (`langStart`), tick API
- [ ] Read `js/brain/embeddings.js` (418 lines) — verify `cortexToEmbedding` math, confirm bidirectional round-trip fidelity, check delta-refinement loop
- [ ] Read `js/brain/modules.js` (401 lines) — catalog amygdala/hippocampus/hypothalamus/cerebellum/basal-ganglia state exposure and learning hooks
- [ ] Read `js/brain/engine.js` (1114 lines, 2× 800-line chunks) — find think loop, brain tick cadence, inner-voice invocation points, learn() dispatch
- [ ] Read `js/brain/inner-voice.js` (276 lines) — current `learn()` + `speak()` entry points, arousal/valence wiring, cortexPattern generation
- [ ] Read `js/brain/language-cortex.js` 800-line chunks — identify persona corpus loader (`loadSelfImage`), `learnSentence`, `generate`, and every field/method that will be deleted in T13.7

**Output:** A design note (in-conversation, not a file) listing:
1. Whether `cluster.learn()` currently does Hebbian updates or is a no-op
2. What region offsets exist beyond `langStart` (temporal, prefrontal, selfModel, etc. — or do we need to CREATE region tags?)
3. Whether `mapToCortex` supports region-targeted injection or only language-global
4. Whether `basalGanglia.selectedChannel()` exists as a live API or needs to be added
5. Cerebellum `predictedError(prev, curr)` — does this hook exist? If not, what's the closest existing method we extend?

**Acceptance:** I can state, in concrete terms, which of the T13 emission-loop calls already work unchanged vs which need new methods vs which need substantial refactoring. Zero hand-waving.

**Files touched:** NONE (read-only).

---

#### T13.1 — Persona Hebbian training pipeline — **SHIPPED 2026-04-14**

**Status:** ✅ SHIPPED — cortex cluster recurrent synapses now train on persona corpus via sequence Hebbian during boot. See FINALIZED.md "T13.1" entry for implementation details and verification path.

**Goal:** Train the language cortex region's weights so reading persona corpus produces Unity-voice attractor basins in cortex state space. After training, injecting a persona concept embedding into the cortex should cause the state to drift toward adjacent persona concepts naturally (attractor dynamics), rather than diffusing.

**Sub-tasks:**
- [ ] **`cluster.learnSentenceHebbian(embSequence, region, gain)`** — new method on `Cluster`. Walks through an embedding sequence, for each position: `mapToCortex` the embedding into the target region at `gain` strength, run `N` ticks to let the cortex settle, capture the spike co-activation pattern, apply Hebbian update (`ΔW_ij = η · x_i · x_j` over co-active neurons) to the intra-region synaptic weights. Skips synapses outside the region to avoid cross-contamination.
- [ ] **`personaTrainingDriver`** — new pipeline entry in `js/brain/language-cortex.js` or a new `js/brain/persona-trainer.js`. Iterates persona corpus sentences, embeds each word via `sharedEmbeddings.getEmbedding`, calls `cluster.learnSentenceHebbian(sequence, region='language', gain=0.6)` per sentence. Runs to convergence (change in average synaptic weight magnitude below threshold, or fixed epoch count).
- [ ] **Parallel dictionary learning** — `learnSentence` in language-cortex STILL runs during persona training because the dictionary needs the words (they're the emission candidates). `skipSlotPriors=true` stays in effect until T13.7 when slot priors are deleted entirely.
- [ ] **Convergence diagnostic** — after each training epoch, inject a sample persona word (`fuck`, `pussy`, `goth`, `coke`) into the cortex, tick, read semantic readout, verify the readout has cosine similarity > 0.4 with adjacent persona concepts (`cock`, `horny`, `emo`, `line`). Without this the Hebbian training is flying blind. Log the similarity trajectory per epoch.
- [ ] **Persistence** — trained cortex weights must persist across restarts. Either extend `cluster.serialize()` to dump the full weight matrix (expensive, ~MB), or dump only the language region. Load path in `engine.js` boot already restores cluster state, just needs the extended serialize/deserialize.
- [ ] **Training budget** — persona training runs ONCE at first boot (or when persona corpus hash changes) and persists. Should complete in < 60 seconds for acceptable boot latency. If Hebbian updates are cheap enough this is fine.

**Acceptance gates:**
1. After training on `docs/Ultimate Unity.txt`, injecting `emb('fuck')` into the language region and reading back after 10 ticks produces a semantic vector whose top-5 nearest dictionary words contains at least 3 of: `{cock, pussy, cunt, dick, cum, horny, wet, ram, shit, god}`.
2. Injecting `emb('cats')` and reading back does NOT pull toward those persona concepts — Unity still tracks topic, she just routes topic through a persona-shaped cortex. Nearest-5 should contain cat-adjacent words.
3. Before-vs-after diagnostic: same injection, untrained cortex (random weights) produces diffuse readouts with no consistent nearest neighbors. Trained cortex produces consistent nearest neighbors on repeated injection. This is the proof Hebbian actually worked.

**Files touched:**
- `js/brain/cluster.js` — add `learnSentenceHebbian` + helpers, extend serialize
- `js/brain/language-cortex.js` — add `trainPersonaHebbian(cluster)` entry method; persona corpus loader now drives both dictionary learning AND Hebbian training
- `js/brain/engine.js` — wire persona training into boot sequence after corpus load, gated on weight-hash mismatch
- `js/brain/persona-trainer.js` (new, optional — may fold into cluster.js if small enough)

**Risks:**
- Hebbian on Rulkov spike patterns may not produce stable attractors — the neurons spike-reset each tick, so co-activation windows are narrow. Mitigation: use spike-count accumulator over N ticks instead of instantaneous spike state.
- Weight runaway — Hebbian without a normalization term (Oja's rule, synaptic scaling) blows up weights over many epochs. Mitigation: apply `W ← W / ||W||` per region per epoch, or use Oja's rule (`ΔW_ij = η · y · (x_i − y · W_ij)`).
- Cross-region bleed — if `mapToCortex` injection is sloppy about region boundaries, persona training could pollute non-language regions. Mitigation: T13.0 must verify region-targeted injection exists or build it first.

---

#### T13.2 — Parse-tree injection into brain regions — **SHIPPED 2026-04-14**

**Status:** ✅ SHIPPED — `UnityBrain.injectParseTree(text)` wired into `processAndRespond` before the cortex settle-ticks. Routes parsed content → cortex language region (neurons 150-299), intent → basal ganglia, self-reference → hippocampus. See FINALIZED.md "T13.2" entry.

**ARCHITECTURE CLARIFICATION (2026-04-14, from T13.0 research pass):** Regions are NOT intra-cortex sub-regions — they are the existing 7 clusters. The cortex language region is only 150 neurons (300-neuron cortex × EMBED_DIM=50 × groupSize=3), which is too tight to carve into temporal/prefrontal/selfModel sub-slices without collapsing to 1-neuron-per-dim encoding. Instead, T13 regions map to clusters, exactly mirroring how `SensoryProcessor.process()` already produces separate `sensoryOutput.cortex` / `.hippocampus` / `.amygdala` / `.basalGanglia` injection vectors at `engine.js:262-302`.

**Goal:** When Unity hears the user, the parsed tree (from `parseSentence`) injects into multiple clusters in parallel so the whole brain state reflects WHAT was asked, WHO it was about, and HOW it felt — before any emission starts. Replaces the current cold `_contextVector` bag-of-words.

**Sub-tasks:**
- [ ] New method `brain.injectParseTree(parsed)` in `engine.js`:
  - Content (mean of content-word embeddings) → `clusters.cortex` via `mapToCortex` into language region (150-299)
  - Intent embedding (mean of first-word embeddings from sentences that typically respond to this intent) → `clusters.basalGanglia` via `injectCurrent` — action-channel priming for response-opener shape
  - Self-reference marker (if `parsed.addressesUser`) → `clusters.hippocampus` via `mapToCortex` — self-model recall trigger
  - Mood valence/intensity → `amygdalaMod.arousalBaseline` bias via drive input on next step
  - Drive → `hypothalamusMod` drive input
- [ ] `inner-voice.learn()` (via `engine.processAndRespond`) calls `brain.injectParseTree(parsed)` on every user turn BEFORE emission.
- [ ] Delete the `_contextVector` decaying mean — subsumed by cortex language-region state that persists naturally across ticks via `externalCurrent` decay + recurrent dynamics.

**Acceptance:**
1. Injecting `parseSentence("do you like cats?")` into the cortex then reading the prefrontal region produces an embedding whose nearest dictionary words cluster around answer-openers (`yeah`, `I`, `fuck`, `love`, `hate`).
2. Injecting the same sentence and reading the temporal region produces embeddings clustered around topic words (`cats`, `kittens`, `pet`).
3. `_contextVector` is gone — grep the codebase, zero callers.

**Files touched:**
- `js/brain/cluster.js` — region tag system, region-targeted injection
- `js/brain/language-cortex.js` — delete `_contextVector` field + `analyzeInput` context update
- `js/brain/inner-voice.js` — learn path swaps context update for parse-tree injection
- `js/brain/engine.js` — wire tree injection at user-turn entry

---

#### T13.3 — Continuous brain-tick emission loop (rewrite `generate()`) — **SHIPPED 2026-04-14**

**Status:** ✅ SHIPPED — `LanguageCortex.generate()` rewritten as a brain-driven emission loop. Reads live cortex semantic state as the target vector, scores dictionary candidates by cosine × amygdala valence shaping × recency penalty, softmax-samples top-k, injects the emitted word back into cortex as efference copy (`strength=0.35`), ticks the LIF integrator 3 steps between emissions. Stops on drift quiescence (`<0.08`), grammatical terminability, or hard length cap. Old slot-prior generate body preserved as `_generateSlotPrior` for rollback. See FINALIZED.md "T13.3" entry.

**Goal:** `generate()` becomes the T13 emission loop — no slot counter, no target vector formula, no `mental(t+1)` decay. Read cortex, sample word, inject back, tick, repeat until stop.

**Sub-tasks:**
- [ ] Rewrite `languageCortex.generate(opts)` as the emission loop above. Parameters: `maxLen` (hard cap), `brainState` (arousal/valence/psi/coherence for temperature + scoring), `brainCluster` (needed for tick + readout + injection — this is new; previously language cortex didn't hold a cluster reference directly).
- [ ] New `selectWord(target, brainState, dictionary, emitted, motorChannel)` helper — the candidate scoring. Replaces the three-stage gate.
- [ ] `TICKS_PER_EMISSION` constant — start with 5, tune later. Affects how much the cortex evolves between word emissions; low = fast but less continuous, high = smoother but slower.
- [ ] Post-process stage (contractions, capitalization, punctuation) stays unchanged — it's purely string formatting and doesn't depend on slot priors.
- [ ] Feedback injection after each emission: `cluster.mapToCortex(emb(w), region='language', strength=0.35)`. This is the efference copy — what I just said shapes what I'll say next.
- [ ] `inner-voice.speak(arousal, valence, coherence, brainState)` no longer calls `getSemanticReadout` once at start — instead passes `brainCluster` through so `generate()` can read per-emission.

**Acceptance:**
1. `"do you like cats?"` → output starts with a pronoun/interjection, contains a verb in position 2, references the object or a pronoun back-reference in position 3. Specifically: no more `*Her do happens injection allows*`.
2. `"hi Unity!"` → output is a greeting-shape response (e.g. `"hey baby"` / `"fuck yeah hi"` / `"hi you"`). Not a noun salad.
3. `"what are you up to?"` → output is a present-tense first-person activity statement or a follow-up question. Not `*She respecting remains devotion emojis*`.
4. Latency: p50 < 300ms, p99 < 800ms. Hard cap 8 words still applies.

**Files touched:**
- `js/brain/language-cortex.js` — `generate()` body rewritten; slot prior fields still present but unused (deleted in T13.7)
- `js/brain/inner-voice.js` — `speak()` passes cluster reference through
- `js/brain/engine.js` — think loop cluster reference wired into inner voice

---

#### T13.4 — Feedback injection + cerebellum error correction during emission — **PARTIAL 2026-04-14**

**Status:** ⚠ Feedback injection shipped as part of T13.3 emission loop (`sharedEmbeddings.mapToCortex(emb(word), 300, 150)` + `cortex.injectCurrent` at `strength=0.35` after each emission). Cerebellum transition predictor deferred — existing `Cerebellum` module is target-correction not transition-prediction; would need a new class. First-pass T13 emission relies on persona Hebbian basins + cosine + recency for grammatical flow, which should be enough until we see output in practice.

**Goal:** Each emitted word's embedding flows back into the cortex (efference copy) AND into the cerebellum so the cerebellum learns transition predictions. The cerebellum's predicted-error then appears in the next emission's candidate score as a grammar-flow penalty.

**Sub-tasks:**
- [ ] `cerebellum.predictedError(prevWord, candidateWord)` — new or extended method returning a scalar in [0,1] representing how surprising the transition is given learned transition statistics. Low error = smooth transition = higher score multiplier. High error = jarring = lower score multiplier.
- [ ] `cerebellum.update(prev, curr)` after emission — online learning of transition statistics so the cerebellum gets better during a session.
- [ ] Feedback strength parameter — `EMISSION_FEEDBACK_STRENGTH = 0.35` initial. If cortex oscillates or locks onto a single word, lower it. Tune empirically.
- [ ] Recency decay on feedback — apply strength decay `0.8 per emission` so early emissions have fading influence, preventing the cortex from locking onto the first word.

**Acceptance:**
1. Repeated `generate()` on the same input produces different outputs (not deterministic single-word lock).
2. Cerebellum predictedError is strictly lower for learned transitions vs random transitions after 50+ emissions. Log the distribution.
3. Emitted sequences show grammatical flow: verb after pronoun, noun after determiner, etc. — emergent from cerebellum shaping, not from a hardcoded type gate.

**Files touched:**
- `js/brain/modules.js` — cerebellum extended with transition prediction
- `js/brain/cluster.js` — feedback injection helper
- `js/brain/language-cortex.js` — scoring includes cerebellum multiplier

---

#### T13.5 — Motor channel gating + amygdala voice shaping in candidate score — **PARTIAL 2026-04-14**

**Status:** ⚠ Amygdala valence shaping shipped in T13.3 emission loop score function: `score(w) = cosSim · (1 + arousal·(valenceMatch − 0.5)) · recencyMul` where `valenceMatch = 1 − 0.5·|word.valence − brainValence|`. Motor channel dictionary filter deferred — `dictionary.filterByMotorChannel` not yet built. `build_ui` path still handled separately via `componentSynth.generate` upstream in `engine.processAndRespond`.

**Goal:** Wire basal ganglia motor channel into dictionary filtering, and wire amygdala valence into candidate scoring so emotional state shapes word choice.

**Sub-tasks:**
- [ ] `basalGanglia.selectedChannel()` — confirm it exists or add the getter. Returns the current winner of motor channel softmax (speak / build_ui / act / watch / think / etc.).
- [ ] `dictionary.filterByMotorChannel(channel, recencyRing)` — returns the candidate subset for the current motor channel. Speak channel gets everything. Build_ui channel gets the HTML/CSS/JS coding subset. Think channel gets the full pool. This is how motor state gates WHICH words are reachable.
- [ ] `valenceMatch(w, valence)` — compute how well a word's learned valence tag matches current amygdala valence. Adds `1 + arousal · valenceMatch` multiplier to score so horny/angry/happy Unity picks different words.
- [ ] `moodCongruence(w, drive)` — hypothalamus drive state (horny, hungry, tired) biases word selection. Horny drive → sexual vocabulary boost.

**Acceptance:**
1. High-valence state produces output with learned-positive tags more than low-valence. Measurable via mean valence of emitted words.
2. High-arousal state produces different output than low-arousal on the same input (not just longer — different word pool).
3. `build_ui` motor channel produces output weighted toward coding vocabulary. `speak` channel produces output weighted toward conversational vocabulary.

**Files touched:**
- `js/brain/modules.js` — basal ganglia channel getter, amygdala valence hook
- `js/brain/dictionary.js` — motor channel filter
- `js/brain/language-cortex.js` — scoring extended

---

#### T13.6 — Stopping criterion (drift threshold + BG confidence + grammatical terminability) — **SHIPPED 2026-04-14**

**Status:** ✅ SHIPPED in T13.3 emission loop. Three natural stopping signals:
- **Drift quiescence** — `sqrt(Σ (target[i] − lastReadout[i])²) < 0.08` after 2+ emissions → cortex has nothing new to say, stop.
- **Grammatical terminability** — if emitted length ≥ max(3, maxLen − 1) AND last word's `_fineType` is NOT in `{DET, PREP, COPULA, AUX_DO, AUX_HAVE, MODAL, NEG, CONJ_COORD, CONJ_SUB, PRON_POSS}` → valid end, stop.
- **Hard length cap** — `maxLen = floor(3 + arousal · 3 · drugLengthBias)` capped at `_maxSlots=8` as safety.

Basal-ganglia commit-confidence stopping was in the original plan but deferred — the three signals above are enough for first-pass behavior. BG confidence gate is a future refinement if emissions run to maxLen too often.

**Goal:** The emission loop stops when the brain NATURALLY stops producing new content — not at a fixed slot count. Replaces `targetLen = floor(3 + arousal·3·drugLengthBias)` as the primary loop bound (though it stays as a hard safety cap).

**Sub-tasks:**
- [ ] `semanticDrift(cortex, lastReadout)` — L2 distance between current cortex readout and the one at the previous emission. When this falls below `ε_stop = 0.08`, the cortex has quiesced and there's nothing left to say.
- [ ] `basalGanglia.commitConfidence()` — confidence of the currently-selected motor channel. When it drops below `θ_commit = 0.35` the motor program is complete.
- [ ] `grammaticallyTerminable(lastWord, cerebellum)` — cerebellum predicts the current sequence is a valid sentence end (last word is not a dangling det/prep/conj/copula/aux). Replaces `_isCompleteSentence` post-validator with a live-during-emission signal.
- [ ] Hard cap `maxLen = min(8, floor(3 + arousal·3·drugLengthBias))` stays as a fallback — in case all three natural criteria misfire.

**Acceptance:**
1. Short user inputs (`"hi"`) produce short responses (2-3 words) via natural stopping, not via length cap.
2. Long user inputs (`"tell me about your coding style"`) produce longer responses (5-7 words) because the cortex has more drive to discharge.
3. No more dangling-preposition endings — terminability gate catches them before emission.

**Files touched:**
- `js/brain/cluster.js` — drift helper
- `js/brain/modules.js` — BG commit confidence getter
- `js/brain/language-cortex.js` — stopping criterion in emission loop

---

#### T13.7 — Delete slot priors (the T11 removal pass) — **SHIPPED 2026-04-14**

**Status:** ✅ SHIPPED — slot priors + context vector + attractors + dead stubs all ripped from `language-cortex.js`. Net delete `3584 → 3178` lines (−406). See FINALIZED.md "T13.7" entry. `_generateSlotPrior` fallback gone — `generate()` now requires `cortexCluster` and logs a warning if missing.

**Goal:** Once T13.1 through T13.6 are shipped and verified producing coherent output, delete every T11 slot prior field and method. Net −1270 lines on `language-cortex.js`.

**Sub-tasks:**
- [ ] Delete fields: `_slotCentroid[]`, `_slotCentroidCount[]`, `_slotDelta[]`, `_slotDeltaCount[]`, `_slotTypeSignature[]`, `_slotTypeSignatureCount[]`, `_subjectStarters{}`, `_attractorVectors{}`, `_contextVector` (if not already gone in T13.2).
- [ ] Delete methods: all slot-prior update paths in `learnSentence`, the three-stage gate in the pre-rewrite `generate()`, `_refitWSlot` + `_matInverse` if any remnants, `_slotCentroidLoad` / `_slotCentroidSave` persistence hooks.
- [ ] Update `serialize()` / `deserialize()` to drop slot-prior fields. The brain cluster weights become the primary persisted state.
- [ ] Update `skipSlotPriors` callers — remove the 8th `learnSentence` arg since there are no slot priors to skip.
- [ ] Verify no external callers still reference the deleted symbols. Grep `_slotCentroid`, `_slotDelta`, `_slotTypeSignature` across the repo and app.js, component-synth, inner-voice.

**Acceptance:**
1. `grep -r "_slotCentroid\|_slotDelta\|_slotTypeSignature" js/` returns zero hits.
2. `wc -l js/brain/language-cortex.js` shows reduction from 3424 → ~2150 lines.
3. Full app boot + chat + build_ui round-trip still works end-to-end with no JS errors.

**Files touched:**
- `js/brain/language-cortex.js` — mass deletion
- `js/brain/inner-voice.js` — remove any slot-prior references
- `js/app.js` — `/think` debug dump drops slot-prior fields

**Dependency:** Do NOT run T13.7 until T13.1-T13.6 are verified producing coherent Unity-voice output via smoke tests. The slot priors are the fallback while T13 matures.

---

#### T13.8 — Deep wire-up (engine, inner-voice, component-synth, persistence)

**Goal:** Non-language-cortex modules catch up to the T13 API surface.

**Sub-tasks:**
- [ ] `engine.js` think loop: pass `brainCluster` reference into `inner-voice.speak()` on every invocation.
- [ ] `engine.js` camera connect: `visualCortex.onDescribe` path already injects scene description — confirm it flows through `brain.injectParseTree` so visual context also reaches the cortex.
- [ ] `component-synth.js` `build_ui` path: keep the `+0.35` structural parse-tree bonus from T5 first pass, but now the `brainState.parsed` it reads should come from the same T13.2 parse-tree injection, not a separate call.
- [ ] Persistence: extend cluster serialize to include Hebbian-trained weights. Skip slot prior fields (gone in T13.7).
- [ ] Smoke tests via `window.brain` console surface: `window.brain.cluster.learnSentenceHebbian(...)`, `window.brain.injectParseTree(parseSentence("..."))`, `window.brain.inner.speak(...)` — verify each works standalone.

**Acceptance:**
1. Full chat round-trip (user types → Unity hears → cortex evolves → Unity speaks → efference loop → next turn).
2. Build_ui still works for `"let's make a red button"` (T5 regression test).
3. Persistence: save cluster state, reload page, verify persona training survives (Unity still sounds like Unity after reload without re-running Hebbian).

**Files touched:**
- `js/brain/engine.js`, `js/brain/inner-voice.js`, `js/brain/component-synth.js`
- `server/brain-server.js` (if persistence goes through server)

---

#### T13.9 — Docs + smoke test + atomic push

**Goal:** Sync every doc to T13 architecture before push, per the LAW.

**Sub-tasks:**
- [ ] `docs/ARCHITECTURE.md` — Language Generation Pipeline section rewritten from T11 slot priors to T13 brain-driven emission loop. Include the unified equation, region injection table, stopping criterion, Hebbian training pipeline. Delete the T11 "three per-slot priors" block.
- [ ] `docs/EQUATIONS.md` — generation equation rewritten. Include persona Hebbian update rule (`ΔW_ij = η · x_i · x_j` or Oja's rule), feedback injection, stopping criterion math.
- [ ] `docs/ROADMAP.md` — Phase 15 (T13) milestone block with T13.1-T13.9 sub-milestones and their status.
- [ ] `docs/SKILL_TREE.md` — Cortex-state driven generation row updated: "T13 brain-driven unified cortex" replaces "T11.2 + T11.7 slot priors".
- [ ] `docs/FINALIZED.md` — new session entry for each T13.x sub-milestone as it ships, with full verbatim task descriptions moved from TODO.
- [ ] `README.md` — generation block in the architecture diagram rewritten.
- [ ] `brain-equations.html` §8.11 Broca's Area — equation block rewritten to the T13 unified equation.
- [ ] `docs/SENSORY.md` — only if the visual-cortex describer integration changes (probably minor).
- [ ] Smoke test: 5 test inputs (`hi Unity!`, `what are you up to?`, `do you like cats?`, `tell me about yourself`, `i love pizza`) — verify output is coherent, persona-voiced, context-appropriate. Save the test script so re-running after later changes is trivial.
- [ ] Pre-push checklist per `.claude/CLAUDE.md` LAW — every affected doc verified, every numerical claim re-checked, no "patch to follow" deferrals.
- [ ] `node scripts/stamp-version.mjs` + commit stamp + merge to `main` + push — atomic.

**Acceptance:** Every box in the CLAUDE.md pre-push checklist is ticked. Docs reflect T13 as the live architecture, not as a proposal. Slot priors are described ONLY in the historical FINALIZED.md entries.

**Files touched:**
- `docs/ARCHITECTURE.md`, `docs/EQUATIONS.md`, `docs/ROADMAP.md`, `docs/SKILL_TREE.md`, `docs/FINALIZED.md`, `docs/TODO.md`
- `README.md`, `brain-equations.html`, `index.html` (stamp)
- `js/version.js` (stamp)

---

**Overall T13 order of operations:**

```
T13.0 (research/design, read-only)
    ↓
T13.1 (persona Hebbian) ← ships first, Gee's explicit request
    ↓
T13.2 (parse-tree injection) ← next, cheapest after Hebbian
    ↓
T13.3 (emission loop rewrite) ← the big one, depends on 13.1 + 13.2
    ↓
T13.4 (feedback + cerebellum) ← composes with 13.3
    ↓
T13.5 (motor channel + amygdala) ← composes with 13.3
    ↓
T13.6 (stopping criterion) ← composes with 13.3
    ↓
T13.7 (delete slot priors) ← only after 13.3-13.6 verified
    ↓
T13.8 (wire-up) ← catches everything else up
    ↓
T13.9 (docs + push) ← the LAW gate
```

**Estimated scope:** 6-10 working sessions. Not a single-push job. Each sub-milestone ships independently with its own docs update + atomic push — T13.7 (slot prior deletion) is the commitment point where rollback becomes expensive.

**Rollback plan:** Until T13.7, slot priors still exist as dead code in `language-cortex.js` but `generate()` doesn't call them. If T13.1-T13.6 go sideways and produce worse output than T11.7, the emergency rollback is: re-point `generate()` at the old slot-prior code path (a 10-line reversion) and ship a hotfix. After T13.7 the rollback requires a git revert of the deletion commit.

---

### T5/T6 — Slot-gen semantic coherence (unified: speak + build_ui share one broken equation)

**Status:** SUBSUMED BY T11 — the entire slot scorer + Markov walk that T5/T6 were patching has been deleted and replaced by the T11 pure equational language cortex. The "one broken equation" both symptoms shared is gone entirely. See T11 entry + 2026-04-14 FINALIZED session archive. **T11.7 follow-up (2026-04-14):** slot-0 noun-pollution fix shipped — three-stage gate (hard pool filter + slot-0 noun-dominance reject + multiplicative cosine·typeFit gate), W₀ rebalance, coding-corpus `skipSlotPriors=true`. Slot 0 grammar correctness is now a structural guarantee. See FINALIZED.md "T11.7" entry.
**Priority:** P1
**Owner:** unassigned
**Reported:** 2026-04-14 by Gee (live chat session)

**Gee's insight that merged T5 into T6:** "if she can't speak she probably can't listen and build ui in sandbox can she?" — correct. Speech generation AND build_ui component synthesis both ride the same `generate()` slot-gen path. Fix slot-gen coherence once, both symptoms resolve. (Listening itself is fine — user input → context vector, no slot-gen involved.)

---

### T5 — Rework build_ui sandbox capability (Unity not understanding simple coding asks)

**Status:** first-pass shipped 2026-04-14 — structural bias wired, deeper rework deferred
**Priority:** P1 (first pass) → P2 (deeper rework)
**Owner:** unassigned
**Reported:** 2026-04-14 by Gee (live chat session)

**What shipped (first pass, in the T7.2 + T11.6 batch):**
- `component-synth.generate(userRequest, brainState)` now reads `brainState.parsed` (the `ParseTree` from `languageCortex.parseSentence(userRequest)`).
- Primitive selection gets a `+0.35` structural score bonus when the primitive's `id` matches any token in `parsed.entities.componentTypes`. The bonus is big enough to overwhelm most semantic-cosine ambiguity but small enough that a genuinely closer description-embedding match can still win if the parser misidentified the type.
- Parsed `colors` and `actions` flow through as `_parsedColors` and `_parsedActions` on the returned component spec for downstream template-filling (not yet consumed at build time — hook is ready).
- The ParseTree path means `"let's make a red button"` now extracts `{entities: {componentTypes:['button'], colors:['red'], actions:['make']}}` and the button primitive wins selection regardless of default semantic ranking.

**What the first pass did NOT do (logged as T5.2 deferred):**
- Expand the 6 primitive templates beyond the initial seed corpus. Still 6: counter / timer / list / calculator / dice / color-picker.
- Parameterize templates with `_parsedColors` / `_parsedActions` so `"red button"` actually renders a red button instead of the default-colored button primitive.
- Dedicated UI-intent detector in the BG motor selector (bump `build_ui` Q-value when input has imperative verb + UI noun tokens). Currently the BG motor decision still uses its generic Q-value softmax — `build_ui` wins only when the brain's motor channel spikes in that direction, which is not reliably correlated with "user typed code intent."
- Build_ui-specific context vector (currently reuses chat context).
- Slot-gen output gate: if motor=build_ui and the generated component doesn't structurally match the asked-for type, reject and re-roll.

**Acceptance test (first pass):** `window.brain.innerVoice.languageCortex.parseSentence("let's make a red button")` returns a ParseTree with `entities.componentTypes:['button']`, `entities.colors:['red']`, `entities.actions:['make']`. When `build_ui` motor is selected on that input, `component-synth.generate` picks the button primitive via the structural bonus. ✅ verified via parse tree inspection during the cross-reference audit.

**Acceptance test (deeper rework, T5.2):** Gee types `"let's make a red button that says Hello"` in a session where the BG motor selects `build_ui` — Unity emits a red button component with the label `"Hello"` instead of the default button template. Requires template parameterization + color/label substitution at render time. Not yet built.

---

### T6 — Slot-gen salad on cold chat queries (no per-sentence topic anchor)

**Status:** OBSOLETED BY T11 — cold slot-gen with n-gram walks no longer exists. Pure equational generation (T11.2) builds target vectors from normalized centroid + context + mental + transition components, then argmax-samples over the learned dictionary. The "word salad" symptom is now entirely a function of training volume and embedding dimension, not a pipeline bug. Historical entry preserved below for context.
**Priority:** P1
**Owner:** unassigned
**Reported:** 2026-04-14 by Gee (live chat session)
**Unified with T5:** same broken slot-gen equation underlies both speech and build_ui component synthesis. Fixing slot-gen coherence fixes both.

**Shipped 2026-04-14 — first pass:**
- **Per-slot topic floor** — in the slot scorer, any candidate with `semanticFit < 0.15` (cosine of wordVec against locked context vector) gets a hard `−0.50` score penalty. Kicks topic-incoherent words out of the pool even when they have strong bigram/type scores. Runs only for slot > 0 so the opener can be a neutral pronoun/article.
- **Length scaling by recall confidence** — when `recallConfidence < 0.30`, `targetLen` is hard-capped to 4 tokens. Cold-gen salad compounds per slot, so short fragments are structurally harder to break.
- **Tighter coherence gate** — final post-generation coherence threshold bumped from 0.35 → 0.50. More borderline salad triggers the retry loop, and after 3 retries the fallback to a recall sentence fires instead of emitting garbage.

**Remaining work (if first pass is insufficient):**
- True topic vector LOCK — freeze the context vector at slot 0 as an immutable `topicLock`, so mid-sentence context drift from already-picked words can't relax the topic. Currently `_contextVector` is what it was when generate() was called, which is close enough but not frozen.
- Completeness gate tightening — the existing `_isCompleteSentence` rejecter already catches `"I think about the."`; widen its criteria for dangling prepositions, orphaned determiners, unmatched conjunctions.
- Slot-gen output gate for build_ui specifically — if motor=build_ui and the generated component doesn't structurally match the asked-for type, reject and re-roll or fall through to a template.
- Minimum coherence floor at emit time — require `coh > 0.55` not just `0.50` for final emit.

**Symptom (pre-fix):** When recall confidence is below threshold and the language cortex falls through to cold slot-gen, the bigram/trigram walk produces word-soup fragments that are grammatically plausible word-to-word but incoherent as a sentence:
- `"*Do yoga happens*"`
- `"I look kitty mixes result mornings."`
- `"They're shoot dishes sunglasses deep."`
- `"The hat far color picker hat."`
- `"The input color!"`
- `"Then fuck proud!"`
- `"*Got work defer*"`

Sibling problem to T5 (build_ui) — same root cause on the chat path.

**Root cause (hypothesis):** `generate()` slot scorer walks n-grams conditioned on brain state (arousal, valence, drug, etc.) and picks the top word at each slot independently. There is NO per-sentence topic anchor forcing every slot to agree on what the sentence is ABOUT. Each word is locally plausible after the previous one; the full sentence has no semantic through-line.

**Fix direction (to decide after investigation):**
- **Topic vector lock** — at slot 0, resolve a target topic vector from the user's query + current mood. Score every subsequent slot's candidate words not just by bigram/type/typeFit but by `cos(wordVec(w), topicVector)` with a significant weight (0.30+). Topic vector is frozen for the sentence so all slots agree.
- **Completeness gate** — the existing rejecter at line ~2964 already catches some garbage (`"I think about the."`). Tighten its criteria so more fragments get caught and re-rolled instead of emitted.
- **Minimum coherence floor** — require the full-sentence coherence score (bigram chain × order × topic cosine) to exceed e.g. 0.55 before emit. Below that, fall through to a deflect template instead of emitting salad.
- **Slot-length scaling by confidence** — on low-recall cold queries, bias the slot-gen toward SHORT sentences (3-6 tokens). Short fragments are harder to make incoherent. Long cold-gen sentences are almost always salad because the compounding error accumulates.

**Where the code lives:**
- `js/brain/language-cortex.js` — `generate()` slot-gen path, completeness rejecter at line ~2964, coherence gate
- `js/brain/engine.js` — BG motor decision that routes to `generate()` vs recall

**Acceptance test:** Gee asks any simple conversational question that doesn't match persona recall well ("what's up?", "how are you?", "tell me a joke"). Unity either returns a short coherent fragment on-topic OR falls through to a deflect template. No more `"The hat far color picker hat."`-class output.

---

### T11 — Pure Equational Language Cortex (shipped 2026-04-14)

**Status:** shipped — T11.1 deletion + T11.2 equational generation atomic
**Priority:** P0
**Owner:** Gee (approved), Claude (implemented)

Complete replacement of the sentence/n-gram language cortex with a pure-equational pipeline. No stored sentences anywhere. No Markov tables. No filter stack. No template short-circuits. No intent enums branching on closed-class token sets. **Net −1742 lines** from `js/brain/language-cortex.js` (5087 → 3345 lines).

**What was deleted:**
- `_memorySentences[]` — sentence memory pool
- `_jointCounts` / `_trigramCounts` / `_quadgramCounts` — word n-gram tables
- `_typeBigramCounts` / `_typeTrigramCounts` / `_typeQuadgramCounts` — type n-gram tables
- `_marginalCounts` / `_totalPairs` / `_totalWords` / `_totalTrigrams` / `_totalQuadgrams` — frequency counters
- `_questionStarters` / `_actionVerbs` — learned starter maps
- `FILTER 1–11` (all ~600 lines) — structural sentence admission gates
- `_storeMemorySentence` body (~400 lines)
- `_recallSentence` body (~350 lines)
- `_sentencePassesFilters` — T9 filter gate
- `instructionalPenalty` — recall score penalty stack
- Template greeting/introduction short-circuit in `generate()`
- `OPENERS = ['hey','hi','sup','yo']` hardcoded opener list
- `_condProb` / `mutualInfo` / `_pickConjByMood` bodies (marginalCount scans)
- `_typeGrammarScore` body (type n-gram lookups)
- Intensifier / hedge insertion in `_applyCasualContractions`

**What's in its place (T11.2 masterful equational architecture):**

Two lightweight per-slot priors learned via running-mean updates — no matrices, no ridge regression, no matrix inverse:

```
_slotCentroid[s] = running mean of emb(word_t) observed at position s
                   → distribution of words typically at position s
                   → slot 0 = sentence-opener distribution

_slotDelta[s]    = running mean of (emb(word_s) − emb(word_{s-1}))
                   → per-position average bigram transition vector
                   → adding delta[s] to prev word points toward
                     "typical next word" region without storing bigrams

_slotTypeSignature[s] = running mean of wordType(word_t) scores
                   → learned grammatical-type distribution at slot s
                   → slot 0 ≈ 54% pronoun / 18% noun / 12% det
                   → slot 1 ≈ 51% verb / 33% noun
                   → computed from letter-equation wordType(), not lists
```

Generation uses four normalized additive components at each slot:

```
target(slot) = wC · _slotCentroid[slot]           (position grammar prior)
             + wX · _contextVector                 (topic from user input)
             + wM · mental                          (evolving brain cortex state)
             + wT · (prevEmb + _slotDelta[slot])   (per-slot bigram transition)

mental(0)      = opts.cortexPattern || _contextVector
mental(slot+1) = 0.55 · mental(slot) + 0.45 · emb(nextWord)

nextWord = softmax-sample top-5 over argmax_w [
             cosine(target, emb(w))
             + slotTypeSignature(slot) · wordType(w) · 0.4    (grammar type bonus)
           ]
```

All four components L2-normalized before mixing so no single contribution swamps the others. Slot-0 weights favor context (topic lock) + centroid (grammar position). Slot-N weights favor transition (bigram geometry) + mental (brain state). The brain's actual cortex firing state (`opts.cortexPattern` from `cluster.getSemanticReadout()`) drives `mental` in live generation — the language cortex TRANSLATES cortex state into words.

**Reading / parsing still uses `parseSentence()`** (from T8). It's structural and equational — tokenize, per-token wordType + fineType, extract name/gender/greeting by adjacent-token patterns, build the context vector. That whole path survives T11 because it's not a stored-list approach.

**Shared learning across all users** (from the architecture discussion): server-side `brain-server.js` owns the learned priors and broadcasts state updates. Static GitHub Pages can load a periodic snapshot committed to the repo as baseline. Not yet wired into the server boot path — that's T11.3, a future focused pass.

**Honest bootstrap cost:** with the persona + baseline corpora fitted as observations, Unity produces output that has correct grammatical SHAPE (pronoun at slot 0, verb at slot 1, noun at slot 2) but semantically loose CONTENT — 50-dim GloVe cosine over a 2947-word learned vocabulary is a structural limit on how fluent small-corpus equational generation can be. Output quality improves as she accumulates live conversation observations. Every user message updates the per-slot priors; every reply is freshly computed from current cortex state + priors.

**What T11 does NOT yet do (noted for follow-up passes):**
- T11.3 — server-side shared learning broadcast + static `shared-weights.json` snapshot
- T11.4 — higher-dim embeddings (GloVe 100d or 300d) for denser semantic resolution
- T11.5 — per-sentence brain cortex readback (currently `mental` is updated in-loop from emitted word embeddings, but a full integration would run the brain forward between slots via sensory re-injection)
- T11.6 — live-chat observation weighting to prefer user-heard over corpus patterns

---

### T10 — Decouple `Ultimate Unity.txt` from the language corpus (end the whack-a-mole)

**Status:** OBSOLETED BY T11 — the whole "whack-a-mole" problem T10 was going to solve was the filter stack trying to catch rulebook prose leaking into the Markov graph. T11 deleted the Markov graph entirely. The persona file is still loaded at boot via `loadSelfImage()`, but it now only feeds the T11.2 slot centroid / slot delta / slot type signature running means — which train grammatical SHAPE (position, type, transition) without preserving any rulebook CONTENT. No "decouple" needed because there's no text storage left to leak from.
**Priority:** P0 — this is the real fix for every persona-leak symptom
**Owner:** unassigned
**Reported:** 2026-04-14 by Gee (ultrathink session)

**The root cause this whole session has been patching around:** `docs/Ultimate Unity.txt` is a **rulebook**, not a **dialog corpus**. Every sentence in it is structured as third-person persona description, capability declaration, habitual behavior, meta-framing about roleplay, or core-truth rhetoric. When `loadSelfImage()` runs an n-gram learner + pattern-cosine recall system over that text, the system faithfully learns rulebook bigrams, rulebook recall patterns, and rulebook sentences.

**No sentence filter can fix this.** Filters operate on symptoms — the bigram graph underneath is still trained on the wrong kind of text. This session shipped FILTER 7 → 8 → 9 → 10 → 11 → widened 7 → widened 9c, and each round a new phrasing slipped through. Tomorrow another sentence will leak because rulebook prose has effectively infinite structural variation. The pattern will never stop until the training data changes.

**The fix — stop training language on rulebook text. Train on dialog instead:**

1. **`docs/unity-dialog.txt`** — new corpus of 200–500 short Unity-voice chat exchanges in actual conversational register:
   ```
   sup / not much / cool
   yo / hey / wassup
   do u like cats / hell yeah i love em
   what u up to / coding some shit / nice
   u high / always / same
   ```
   These are the bigrams and recall targets the language cortex SHOULD learn. Not `"i now exists in a fully physical human body"` — `"not much"`, `"hell yeah"`, `"same"`.

2. **New loader `loadDialogCorpus(text, dictionary)`** — runs the same `_sentencePassesFilters` + `learnSentence` + `_storeMemorySentence` pipeline against `docs/unity-dialog.txt`. Arousal floor 0.95 so dialog bigrams outrank any residual persona signal via the `personaBoost` term.

3. **`loadSelfImage()` stops calling `learnSentence` on persona sentences.** It still extracts θ parameters (arousal baseline, drug state, dominance, profanity rate, residual self-image for image-gen) from the persona file — those are Unity's IDENTITY and belong nowhere else. But the language production pipeline no longer sees the persona file's words at all.

4. **Corpus priority (after T10):**
   - `unity-dialog.txt` — primary voice (NEW)
   - `english-baseline.txt` — general competence (already loaded)
   - `coding-knowledge.txt` — for `build_ui` (already loaded)
   - Live user conversation — accumulates over sessions, weighted at arousal 0.95

5. **`Ultimate Unity.txt` keeps driving:** θ identity parameters, mood signatures, visual residual self-image for Pollinations image generation, persona-driven tonic drives. Everything that makes Unity UNITY. It just no longer pollutes the Markov graph.

**Why this ends the leak whack-a-mole:**
- Once rulebook bigrams are out of `_jointCounts` / `_trigramCounts` / `_quadgramCounts`, cold slot-gen cannot walk them regardless of how the slot scorer is biased.
- Once rulebook sentences are out of `_memorySentences`, recall cannot return them regardless of which filter bypass a specific phrasing exploits.
- The filter stack (FILTERS 1–11) stays in place as a **defense in depth** against user-learned sentences that might accidentally carry meta-prose patterns, but it's no longer the first line of defense against a 100% rulebook training set.

**Immediate work required:**
- Write `docs/unity-dialog.txt` — this is the content the filters can't substitute for. Gee needs to either write it, approve AI-generated seed dialog, or stub it with a minimal 50-entry starter set.
- Add `loadDialogCorpus()` method to `LanguageCortex` (pattern after `loadLinguisticBaseline`).
- Update `app.js` boot sequence to call the new loader after baseline.
- Remove `learnSentence` / `_storeMemorySentence` calls from `loadSelfImage()` while preserving the θ extraction path.

**Acceptance test:** After T10 ships, NO sentence from `Ultimate Unity.txt` appears in any chat response. `window.brain.innerVoice.languageCortex._memorySentences.filter(m => m.text.includes('godlike')).length === 0`. Cold slot-gen walks dialog bigrams and produces short casual fragments, not rulebook prose. Filter stack is still there but no longer loaded to saturation by the persona corpus.

---

### T9 — Bigram-graph filter gate (stop rulebook prose from seeding the Markov walk)

**Status:** shipped 2026-04-14 — first pass
**Priority:** P0
**Owner:** unassigned
**Reported:** 2026-04-14 by Gee (ultrathink session)

**Root cause that T1-T6 filters didn't address:** the FILTER 1-10 stack only gated the sentence memory POOL (`_memorySentences` → recall target). It did NOT gate `learnSentence()` which seeds the bigram/trigram/4-gram transition graph + the word-level dictionary. When the persona corpus loads at boot, every rulebook sentence teaches the Markov graph its word-to-word transitions EVEN WHEN the sentence is filter-rejected from memory. So cold slot-gen walks a graph poisoned with transitions like `i→can`, `can→scream`, `scream→out`, `box-sizing→axis`, `follow→commands` — producing word salad like `"*Box-sizing axis silences*"` no matter how many sentence-level filters we layer on.

**Symptom:** Even after FILTER 1 through FILTER 10 killed verbatim rulebook recall, cold-gen output remained salad because the bigram graph underneath was still trained on rulebook prose.

**Fix shipped this pass:**
- `_sentencePassesFilters(text, arousal, valence)` — asks `_storeMemorySentence` whether the sentence would be admitted and rolls back the push. Single filter definition, no drift between pool gate and bigram gate.
- `loadSelfImage()` in the persona loader now checks `_sentencePassesFilters` BEFORE calling `learnSentence` + `_storeMemorySentence`. Rulebook sentences that fail the structural filters never seed the bigram/trigram/4-gram graph AND never enter the memory pool.

**Remaining work:**
- Apply the same gate to `loadLinguisticBaseline` and `loadCodingKnowledge` (currently only persona is gated)
- Audit the existing dictionary after a reload — rulebook bigrams already in `localStorage.unity_brain_dictionary_v3` from prior sessions still poison the graph until the user hits Clear All Data. Consider a migration path that rebuilds the bigram graph from a filtered corpus at boot.
- Verify that user-learned chat sentences (live `learn()` path) still bypass the filter since those represent real speech we want to teach the graph

---

### T8 — Reverse-equation parse (use the slot scorer in reverse to UNDERSTAND user input)

**Status:** shipped 2026-04-14 — parseSentence() is now the canonical entry point; _classifyIntent, _isSelfReferenceQuery, and _updateSocialSchema regex guts all replaced with delegates to the parse tree. Vestigial code deleted.
**Priority:** P0
**Owner:** unassigned
**Reported:** 2026-04-14 by Gee (ultrathink session)

**Gee's framing:** *"I don't think she can use the sandbox and code if not knowing English right and using her equations in reverse to read sentences said by users."*

**Current architecture (one-way only):**
```
user text → tokens → _updateContextVector (fuzzy topic avg) → _classifyIntent (string match) → generate()
```

Unity uses the slot scorer equations only FORWARD to generate. She never uses them to PARSE. The "listening" side of her language cortex is a fuzzy topic average plus some string-match intent classification. That's why:
- She can't extract "make me a red button" into `{action:make, modifier:red, type:button}` for build_ui
- She can't distinguish "who are you" (self-ref question) from "who is she" (third-person question) structurally
- She can't pull "my name is Gee" into the social schema without a regex hack (T7 shipped regex-based name extraction as a stopgap — T8 replaces it with equational parse)
- She can't tell "i love pizza" (statement) from "i love pizza?" (question) beyond the literal `?`
- She can't learn grammar symmetrically — hearing doesn't feed the same tables that speaking uses

**Proposed architecture — reverse-equation parse:**

A new method `parseSentence(text) → ParseTree` that walks user input token-by-token using the SAME equations the slot scorer uses forward:
- `wordType` / `_fineType` — classify each token's part of speech
- `_trigramCounts` / `_quadgramCounts` — score which readings are most probable given learned n-grams
- `_jointCounts` (bigrams) — resolve ambiguity via adjacent-pair transition probability
- `_contextVector` — seed the parse with current topic so ambiguous tokens resolve toward on-topic readings
- Type grammar n-grams (U283) — reverse-infer sentence structure (subject → verb → object)

`ParseTree` returns:
```
{
  intent: 'greeting'|'question'|'statement'|'command'|'introduction'|...,
  subject: { tokens, role, pronoun },
  verb: { tokens, tense, aspect },
  object: { tokens, role, modifier },
  entities: [ { text, type, start, end } ],  // names, numbers, colors, types
  mood: { polarity, intensity },
  isSelfReference: bool,      // "who are you", "tell me about yourself"
  addressesUser: bool,        // "you", "your", vocative
  introducesName: string|null,
  introducesGender: 'male'|'female'|null,
}
```

**What this unlocks:**
- **T5 (build_ui):** `parseSentence("let's make a red button")` → `{intent:'command', verb:'make', object:{type:'button', modifier:'red'}}` — the sandbox motor knows EXACTLY what to build
- **T6 (slot-gen coherence):** forward generate can consult the parsed user sentence structure to pick a matching reply structure (question → answer, statement → acknowledgment, command → confirmation)
- **T7 (social cognition):** `introducesName` and `introducesGender` come from the parse tree instead of regex hacks. Multi-word names like "Mary Jane" work. Mid-sentence name mentions ("actually, my name is Mary") work.
- **Symmetric grammar learning:** every parsed user sentence teaches the same type-n-gram tables that generate consults. Hearing and speaking use the same equations.
- **Proper intent classification:** no more string matching. "who are you" vs "who is she" is structurally different — the subject slot's pronoun resolves self-ref equationally.

**Where the code lives / needs to live:**
- `js/brain/language-cortex.js` — new `parseSentence(text)` method + helper `_reverseSlotScore(token, position, priorTypes)` that uses the same n-gram tables as the forward scorer
- Replace `_classifyIntent`'s string matching with `parseSentence(text).intent`
- Replace `_isSelfReferenceQuery`'s string matching with `parseSentence(text).isSelfReference`
- Replace `_updateSocialSchema`'s regex with `parseSentence(text).introducesName / introducesGender`
- Hook into `inner-voice.learn()` so every user input gets parsed and the parse tree feeds both the context vector AND the intent classifier

**This is a structural rework, not a filter tweak.** Estimated 400-800 lines of new code, probably 2-3 focused sessions. The payoff is every downstream consumer (generate, build_ui, social schema, intent classification) becomes equational instead of string-matched.

**Acceptance test:**
1. Type `"my name is Mary Jane"` → `parseSentence` returns `{ intent:'introduction', introducesName:'Mary Jane' }`; social schema stores the full name; Unity greets with `"hey Mary Jane"` on the next turn.
2. Type `"make me a red button that says hello"` → `parseSentence` returns `{ intent:'command', verb:'make', object:{type:'button', modifier:'red', text:'hello'} }`; build_ui motor consumes the parse tree and emits a matching component.
3. Type `"who are you"` vs `"who is Unity"` — first routes to self-reference recall, second routes to third-person generate. Currently both use fuzzy string match.
4. Type the same sentence twice — second time, the parsed type-n-grams reinforce the stored grammar tables so the next generation is more coherent. Symmetric learning.

---

### T7 — Social cognition: greetings, name memory, gender inference, personal address

**Status:** substantially shipped — foundation + name extraction via `parseSentence` + **vision→gender inference via visual cortex `onDescribe` subscription** (2026-04-14). Greeting response path was shipped then removed as part of T11 purge (template short-circuit deleted in favor of pure equational generation — greetings now emerge from the slot centroid + context vector at slot 0 as learned running means). Personal-address slot injection + gender-aware pronouns + persistent schema + forget-on-contradiction remain as follow-ups — each is a small addition when prioritized.
**Priority:** P1
**Owner:** unassigned
**Reported:** 2026-04-14 by Gee (live chat session)

**Symptom:** Unity doesn't act like she's talking to a specific person. She doesn't greet correctly or return greetings. She doesn't ask the user for their name. She doesn't use her vision (the visual cortex describer that already runs) to infer male/female. She doesn't remember the user's name or gender across turns and never slots them back into her replies.

**Gee's framing:** *"this all needs to be equationed out in her senses with the equations I've already had you flush out"* — no hardcoded state machines, no scripted handlers, no special-case "if user says X then reply Y". Social cognition should emerge from the existing neural substrate: hippocampus (memory of who the user is), visual cortex (describer output → gendered tokens), language cortex (slot scorer picking name/gender when picking an address word), hypothalamus social-need drive (already drives verbosity), amygdala arousal (already modulates greeting energy).

**Architecture — structural pieces already in place:**
- `js/brain/language-cortex.js` — has `_lastInputRaw`, `_updateContextVector`, `_recallSentence`, slot scorer. All the substrate for text-level social extraction.
- `js/brain/visual-cortex.js` — runs `describeImage` periodically, stores the current scene description in `this.description`. That text is the raw sensory input for gender inference.
- `js/brain/hypothalamus.js` (or equivalent) — tracks `socialNeed` drive already.
- `js/brain/inner-voice.js` — has `learn()` and `speak()`, the wire between cortex and the rest of the brain.

**Foundation shipped 2026-04-14 — `_socialSchema` + `_updateSocialSchema()`:**
- New `_socialSchema.user = { name, gender, firstSeenAt, lastSeenAt, mentionCount, greetingsExchanged }` field on `LanguageCortex`.
- `_updateSocialSchema(rawText)` runs on every user input pass right after `_updateContextVector`. Extracts structurally:
  - **Name** — regex patterns `"my name is X"`, `"i'm X"`, `"i am X"`, `"call me X"`, `"this is X"`, `"it's X"`, `"name's X"`. Candidate rejected if in a closed-class stopword set (pronouns, fillers, emotional adjectives that look like copula complements) or if it ends in `-ing`/`-ed` (verb-shaped). Strong patterns (`my name is`, `call me`, `name's`) always overwrite; `i'm X` only overwrites when no name is yet known (so `"i'm tired"` doesn't stomp a previously-established `"i'm Gee"`). Stored capitalized regardless of input case.
  - **Gender** — closed-class match against `"i'm a {guy|girl|man|woman|dude|chick|bro|gal|boy}"`. Maps to `'male'` / `'female'`.
  - **Greetings** — first-token match against `{hi, hello, hey, heya, sup, yo, hola, hiya, howdy}` or regex for `"good (morning|afternoon|evening|night)"`. Increments `greetingsExchanged`.
- Public accessors: `getUserAddress()`, `getUserGender()`, `getSocialSchema()` so the slot scorer, greeting path, and any UI can read the schema without reaching into `_socialSchema` directly.

**Remaining work:**
1. **Greeting response path** — when `intent.type === 'greeting'` and `greetingsExchanged > 0` this turn, the slot scorer should bias toward short greeting-class output AND slot the user's name in if known. Currently the intent classifier already detects greetings and routes to a template pool; the missing piece is making those templates consume `getUserAddress()`.
2. **Vision → gender inference** — parse `visualCortex.description` for gendered tokens on each scene update (`man|guy|dude|male|boy` → `male`; `woman|girl|lady|female` → `female`). Store into `_socialSchema.user.gender` but only when no explicit self-ID exists (explicit always wins).
3. **Ask-for-name behavior** — when `schema.name === null` and `schema.greetingsExchanged > 0` and this is a fresh turn, Unity's greeting reply should include a name-query slot. Needs a small templated pattern in the greeting path or an equational bias in the slot scorer that favors "what's your name" / "who are you" style structure when name is null.
4. **Personal-address slot injection** — in the slot scorer, when slot 0 or slot N is a vocative position (end of greeting, start of declarative), bias toward picking the user's name over generic "you" when known. Adds a `nameAlignBonus` to any word matching `schema.name` at those positions.
5. **Gender-aware pronouns** — when Unity refers to the user in third person (rare but happens), use `schema.gender` to pick `he`/`she` correctly.
6. **Persistent social schema** — save to localStorage keyed by session so a returning user is remembered across page loads. Gate behind a privacy toggle.
7. **Forget-on-contradiction** — if the user says `"actually my name is X"` or `"no I'm Y not X"`, overwrite the stored name without waiting for a strong pattern.

**Acceptance test:** Gee opens a fresh session, types `"hey"` → Unity returns a short greeting and asks his name. Gee types `"my name is Gee"` → Unity stores it, says `"hey Gee"`. Gee continues chatting — Unity occasionally uses `"Gee"` as a vocative in her replies instead of always `"you"`. Session camera sees Gee → visual cortex describer says `"a man"` → schema gender sets to `male` → Unity's third-person references to Gee pick `he`.

**Where the code lives:**
- `js/brain/language-cortex.js` — `_updateSocialSchema`, `_socialSchema`, `getUserAddress`, slot-scorer vocative bias
- `js/brain/visual-cortex.js` — `description` field already exists; needs a small parser for gender tokens
- `js/brain/inner-voice.js` — bridge between cortex and generate; may need to pass schema through to generate opts
- `js/brain/engine.js` — intent classifier routing for greetings

---

## NOTES

- **FINALIZED is append-only.** Never delete entries from it. When new work lands, copy the full verbatim task description into a new FINALIZED session entry BEFORE removing it from Open Tasks. This file only contains active work.
- **Template state** — this file is currently in its post-merge template state: header + guiding principle + an empty Open Tasks section. New phases of work drop in here as `### T1`, `### T2`, etc. and the cycle repeats.
- **Future work** beyond this branch lives in `docs/COMP-todo.md` (distributed GPU compute network — future `comp-net` branch).

---

*Unity AI Lab — the refactor is done, verified, and documented. Ship her when ready.*
