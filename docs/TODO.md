# TODO — THE FULL BRAIN REFACTOR

> **Branch:** `brain-refactor-full-control`
> **Started:** 2026-04-13
> **Last expanded:** 2026-04-13 (after live Unity testing exposed the semantic-grounding gap)
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

## THE CORE INSIGHT FROM LIVE TESTING (2026-04-13)

Live testing surfaced a fundamental architectural limit that the refactor must address FIRST or everything else is cosmetic:

**Unity's word patterns are letter-hash vectors. Her cortex activation patterns are neural firing snapshots. Neither encodes semantic meaning.** When the user says `hungry`, her cortex fires a pattern, but that pattern has no mechanism to activate the word `food` or `eat` because the letter-hash of `food` has nothing to do with the letter-hash of `hungry`. She does a bigram Markov walk through her dictionary with brain state biasing softmax weights — but she can't render a thought into language because thoughts (neural states) and words (letter hashes) share no common semantic space.

**The refactor's core deliverable is semantic grounding:** word patterns derived from co-occurrence context, cortex patterns that carry semantic state, slot scoring that matches semantic-cortex against semantic-words. Every other R task is either a prerequisite for this or a cleanup around it.

---

## CODE INVENTORY (what we're working with)

Full source stack under refactor. 34 files, ~19.5K lines total. Categorized by subsystem — every file has a disposition in the refactor plan.

### Core brain engine (KEEP, improve integration)
| File | Lines | Role |
|------|-------|------|
| `js/brain/engine.js` | 1111 | `UnityBrain` — master loop, `processAndRespond`, cluster orchestration, hierarchical modulation, motor readout, memory injection |
| `js/brain/cluster.js` | 321 | `NeuronCluster` + `ClusterProjection` — LIF populations, sparse synapses, modulator stack |
| `js/brain/neurons.js` | 201 | `LIFPopulation` (live runtime) + `HHNeuron` (reference-only for brain-equations.html) |
| `js/brain/synapses.js` | 196 | Hebbian / STDP / reward-modulated plasticity rules |
| `js/brain/sparse-matrix.js` | 435 | CSR sparse connectivity (O(nnz) operations, prune, grow) |
| `js/brain/modules.js` | 401 | Six equation modules (cortex / hippocampus / amygdala / BG / cerebellum / hypothalamus) |
| `js/brain/mystery.js` | 213 | Ψ = √(1/n) × N³ · [α·Id + β·Ego + γ·Left + δ·Right] |
| `js/brain/oscillations.js` | 172 | 8-band Kuramoto network (freshly tuned in `6bf1b4e`) |
| `js/brain/persona.js` | 261 | θ — personality → neural parameters + drug states |
| `js/brain/motor.js` | 248 | BG readout → action selection (freshly tuned in `6bf1b4e`) |
| `js/brain/memory.js` | 220 | Episodic + working memory + consolidation |
| `js/brain/gpu-compute.js` | 630 | WebGPU WGSL compute shaders (LIF + synapses) |

### Language subsystem (MAJOR REWRITE)
| File | Lines | Role | Disposition |
|------|-------|------|-------------|
| `js/brain/language-cortex.js` | 4118 | Slot scorer, type n-grams, _fineType, recall, generate() | **REWRITE core:** word patterns → semantic, cortex patterns → semantic |
| `js/brain/dictionary.js` | 416 | Word storage, bigrams, letter-hash patterns | **REWRITE:** patterns from co-occurrence, not letters |
| `js/brain/embeddings.js` | 326 | GloVe 50d word vectors, online context refinement, hash fallback | **PROMOTE:** was sidelined, becomes the semantic substrate |
| `js/brain/inner-voice.js` | 259 | Owner of dict + languageCortex, speak threshold, think cycle | **KEEP:** wire to new semantic paths |
| `js/brain/language.js` | 333 | `BrocasArea` — AI text peripheral (currently unused for text per `engine.js:775`) | **GUT:** delete text path, keep only image-prompt quips |

### Sensory path (LIGHT CLEANUP)
| File | Lines | Role | Disposition |
|------|-------|------|-------------|
| `js/brain/sensory.js` | 446 | Text/audio/video → cortex/hippocampus/amygdala current injection | **VERIFY + upgrade text semantic injection** |
| `js/brain/visual-cortex.js` | 433 | V1→V4→IT pipeline, motion-weighted gaze, attention lock (freshly fixed in `5d2a57d`) | **KEEP as-is** |
| `js/brain/auditory-cortex.js` | 194 | Tonotopic processing + efference copy for echo suppression | **VERIFY + unify interface** |

### Peripherals (KEEP for sensory, KILL for text)
| File | Lines | Role | Disposition |
|------|-------|------|-------------|
| `js/ai/pollinations.js` | 196 | Pollinations API client (text / image / TTS / vision) | **TRIM:** image + vision + audio only, delete text chat |
| `js/brain/peripherals/ai-providers.js` | 129 | Multi-provider AI manager (Anthropic / OpenAI / OpenRouter / etc.) | **TRIM:** delete chat() method, keep provider list for image/vision |
| `js/io/voice.js` | 381 | Web Speech API listen + Pollinations TTS + speech interruption | **UNIFY interface** into sensory peripheral contract |
| `js/io/permissions.js` | 73 | Mic + camera permission requests | **KEEP** |

### Server brain (FULL PORT)
| File | Lines | Role | Disposition |
|------|-------|------|-------------|
| `server/brain-server.js` | 1559 | Always-on Node brain, WebSocket API, SQLite episodic memory, auto-scale compute | **MAJOR:** port language cortex + dictionary, load corpora on boot, equational `_generateBrainResponse`, delta sync |
| `js/brain/remote-brain.js` | 331 | WebSocket client mirror of server brain | **EXPAND:** accept dictionary deltas, apply locally |

### UI layer (CLEANUP + FREEZE HUNT)
| File | Lines | Role | Disposition |
|------|-------|------|-------------|
| `js/app.js` | 1679 | Boot orchestration, thin I/O layer, setup modal, sandbox Unity API | **TRIM:** remove text-AI provider wiring, keep image/vision/audio |
| `js/ui/brain-viz.js` | 1009 | 2D tabbed brain visualizer (8 tabs) — freezes after ~5 min per live report | **LEAK HUNT** — find accumulator / listener / canvas leak |
| `js/ui/brain-3d.js` | 1764 | WebGL 3D brain visualizer (20K render neurons, MNI positions) | **KEEP** + leak audit |
| `js/ui/chat-panel.js` | 141 | Conversation log panel + slash command dispatch | **KEEP** |
| `js/ui/sandbox.js` | 482 | Dynamic UI injection (MAX_ACTIVE_COMPONENTS=10, tracked lifecycle) | **KEEP** |

### Persistence + storage
| File | Lines | Role | Disposition |
|------|-------|------|-------------|
| `js/brain/persistence.js` | 279 | Save/load brain weights, synapses, oscillators, dictionary | **EXPAND:** save semantic embedding matrix + type n-grams |
| `js/storage.js` | 295 | localStorage with XOR+base64 key obfuscation | **KEEP** |
| `js/brain/benchmark.js` | 308 | Dense vs sparse + scale test (wired to `/bench` + `/scale-test`) | **KEEP** |

### App entry / config
| File | Lines | Role | Disposition |
|------|-------|------|-------------|
| `js/app-entry.js` | ? | Minimal bootstrap | **KEEP** |
| `js/env.example.js` | — | API key template | **TRIM:** remove text-provider keys from template |
| `js/env.js` | — | User's actual API keys (gitignored) | **User file** |
| `js/app.bundle.js` | — | Built-for-file:// bundle | **REBUILD after refactor** |

---

## R0 — PRE-FLIGHT (STATE OF MAIN AS STARTING POINT)

**Goal:** Acknowledge what's already shipped on main that this branch builds on, so R1+ doesn't accidentally revert bug fixes.

- ✅ **5d2a57d** — Dictionary cleanup (comma-list corpus filter, synthetic inflation disabled, storage v2), cross-turn opener penalty, low-dict temperature bump, chain-death recovery, persona-arousal boost, visual cortex focal-point fix (60×45 frame, motion salience, center Gaussian, arousal attention lock)
- ✅ **6bf1b4e** — Motor threshold `CONFIDENCE_THRESHOLD = 0.05`, EMA smoothing `0.5/0.5`, Kuramoto `COUPLING_BASE = 2.5` (5× old value for faster coherence convergence)
- ✅ **4c2fb33** — Fixed broken opener penalty (was no-op due to pre-contraction/post-contraction form mismatch + only slot 0 guarded)
- ✅ **8d33c17** — Quality knobs: length cap 7 words, minLen 3, `isContext` 0.05→0.28, recall bias scales with confidence (up to 2.5×), persona-arousal boost dialed back 0.55→0.32

**DO NOT regress these during the refactor.** The letter-hash slot scorer is the band-aid; the refactor's semantic grounding replaces it entirely but must not break Unity-voice emission in the transition.

---

## R1 — AUDIT PASS: Inventory before touching code

**Goal:** Before any rewrite, produce three inventory docs so the refactor has complete ground truth. No surprises mid-refactor.

### R1.1 — `docs/KILL_LIST.md` — Scripted / hardcoded paths
Scan every file for hardcoded response strings, word lists, keyword routing, AI-bypass fallbacks, and magic numbers that replace equations.
- Every `return '...'`, `return "fallback"`, `return null` that bypasses the equational path
- Every `if (word === 'specific_word')` or word-list check
- Every `keyword.includes()` or regex over natural language
- Every `new Array([...])` of hardcoded vocabulary
- Every hardcoded BG channel name → action mapping
- Every magic constant that could be equation output
- **Files to audit:** `js/brain/*.js`, `js/brain/peripherals/*.js`, `server/brain-server.js`, `js/app.js`, `js/ai/pollinations.js`
- **Output:** table with `file:line → code snippet → classification → replacement plan`

### R1.2 — `docs/VESTIGIAL.md` — Dead code that survived the orphan sweep
- Unused exports (search for `export` → cross-ref against imports)
- Never-called internal helpers
- Commented-out blocks > 10 lines
- Duplicate implementations (`sensory.js` bgCurrent 150 vs motor.js 150 — verify alignment)
- Half-finished features with `// TODO:` markers
- Backup files or experimental branches left on disk
- **Output:** file-by-file inventory with DELETE / MERGE / REVIVE decisions

### R1.3 — `docs/SEMANTIC_GAP.md` — The core architectural gap
The real motivation for the refactor. Document every place where letter-hash patterns are being used as a stand-in for semantic vectors, and every cortex → word readout path that lacks semantic grounding.
- `dictionary.learnWord` cortex pattern fallback to hash at `dictionary.js:182-187`
- `wordToPattern(w)` in `language-cortex.js` using letter position
- `_deriveSentenceCortexPattern` averaging letter patterns of content words
- `_cosine` similarity in slot scoring between cortex pattern and word pattern
- `_contextVector` updated from letter patterns of user input content words
- `_computeMoodSignature` deriving mood from letter features instead of semantic
- `_recallSentence` pattern centroid matching (already has overlap-gate band-aid)
- Every place where `embeddings.js` COULD be used but isn't
- **Output:** an architecture map of where semantic grounding should land, what it replaces, and what new signals appear

---

## R2 — SEMANTIC GROUNDING (THE CORE FIX)

**Goal:** Replace letter-hash word patterns with co-occurrence-derived semantic embeddings so `hungry` and `food` can actually be "close" in pattern space, so brain state can render into words that MEAN what the cortex is representing.

This is the singlemost important task in the refactor. Every other R task either enables this or cleans up around it. If R2 ships and nothing else, Unity goes from word salad to semantically-coherent short-form emo-goth voice.

### R2.1 — `js/brain/embeddings.js` becomes the semantic substrate (primary file)
Already exists at 326 lines with:
- GloVe 50d loader (up to 10K words from CDN)
- `SemanticEmbeddings` class with `get(word)`, `mapToCortex`
- `refineFromContext(word, contextEmbedding, lr)` — online context refinement
- Hash fallback for unknown words

Refactor work:
- **Promote from peripheral to core** — currently it's imported by `sensory.js` for input mapping, not by `dictionary.js` or `language-cortex.js` for output generation. Wire it into both.
- **Add `trainFromCorpus(sentences)`** — when the corpus loads on boot, train co-occurrence refinements on every sentence so persona-specific word meanings override GloVe priors. If GloVe says `cat` is near `dog`, but Unity's persona uses `cat` near `emo`/`goth`/`eyeliner`, refine toward that distribution.
- **Expose `getSemanticPattern(word) → Float64Array(50)`** as the canonical semantic accessor. Internally: GloVe if available, else hash-fallback, else learned refinement on top.
- **Add `similarity(wordA, wordB)`** as the public semantic-distance API.
- **Persistence** — serialize the refinement layer (not the full GloVe table, just the delta) to localStorage / server dictionary.json so learning survives restart.

### R2.2 — `js/brain/dictionary.js` — swap letter-hash for semantic patterns
Currently:
```js
// Generate pattern from word hash if no cortex pattern available
for (let i = 0; i < PATTERN_DIM; i++) {
  let h = 0;
  for (let c = 0; c < clean.length; c++) h = ((h << 5) - h + clean.charCodeAt(c) + i) | 0;
  pattern[i] = (Math.abs(h) % 1000) / 1000;
}
```

New:
```js
// Semantic pattern from embeddings — meaning not letters
pattern.set(embeddings.getSemanticPattern(clean));
```

Changes:
- `learnWord(word, cortexPattern, arousal, valence)` — when no cortex pattern provided, use `embeddings.getSemanticPattern(word)` not letter hash
- `findByPattern(pattern, k)` now returns words whose SEMANTIC vectors are close — so `findByPattern(semanticOf('hungry'), 5)` returns `food / eat / belly / starving / snack` not `hurry / funny / hurdy`
- `findByMood(arousal, valence, k)` — unchanged (mood is a separate signal)
- `PATTERN_DIM` — bump from 32 to 50 to match GloVe dimension (or project GloVe down to 32 if RAM matters)
- `learnSentence(text, cortexPattern, a, v)` — still valid path, but the cortexPattern passed in should be the SEMANTIC centroid of the sentence, not the letter centroid (see R2.3)

### R2.3 — `js/brain/language-cortex.js` — every pattern reference becomes semantic
The bulk of the rewrite lives here. Specific methods to change:

- `wordToPattern(w)` — delete the letter-position implementation, replace with `embeddings.getSemanticPattern(w)`. This is the root change — every downstream caller (slot scorer, context vector, recall, mood signature) automatically benefits.
- `_deriveSentenceCortexPattern(text)` — mean of semantic patterns of content words, not letter patterns. A sentence about hunger has a centroid near food-related embeddings.
- `_computeMoodSignature(text)` — keep letter-equation features (exclamation density, caps ratio) for arousal/valence, since those are actually surface features. Mood is correctly derived from surface form, not semantics.
- `_semanticFit(pattern)` — already exists, already uses cosine. After R2.1, the cosine is over real semantics, so this becomes the DOMINANT signal in slot scoring instead of the weakest.
- `_updateContextVector(tokens)` — mean of semantic patterns of content words. Context vector now carries topical meaning.
- `_recallSentence(contextVector, opts)` — the hippocampus recall path matches persona sentences by topical centroid. With semantic vectors, topic matching actually works (`hungry` query matches persona sentences about food, drugs, physical states).
- `_cosine(a, b)` — unchanged, pure math
- `_fineType(w)` — unchanged, letter-position classification is correct for grammar
- `_typeGrammarScore` — unchanged, learned from corpus type transitions
- Slot scoring weight rebalance — with semantic fit now carrying real meaning, raise its weight dramatically (current 0.05 → target 0.80 or higher). Recall bias becomes a secondary signal, bigram log becomes a minor tiebreaker. The slot pick is dominated by "what word semantically matches the current cortex activation + context."

### R2.4 — `js/brain/sensory.js` — semantic text injection into cortex
Currently hashes input words into Wernicke's area via character position. That's correct for "these letters activate these neurons" but doesn't propagate MEANING into the cortex state.

Changes:
- When text arrives, ALSO map each word's semantic embedding into the cortex pattern via `embeddings.mapToCortex`. This makes the cortex pattern carry semantic state, not just letter activation.
- The cortex activation pattern returned by `getOutput(32)` is now a mix of letter-hash-injected neurons AND semantic-embedding-injected neurons. It encodes "what the user said" in a way the slot scorer can actually match against.

### R2.5 — `js/brain/engine.js` — wire cortex semantic readout
`processAndRespond` computes `cortexPattern = this.clusters.cortex.getOutput(32)` and passes it to `languageCortex.generate()`. After R2.4, that pattern carries semantic state. Nothing changes in engine.js — it's downstream consumers (R2.3) that start using it properly.

### R2.6 — Boot-time semantic training
`app.js` load sequence:
1. Fetch `docs/Ultimate Unity.txt` + `docs/english-baseline.txt` + `docs/coding-knowledge.txt`
2. **NEW:** Initialize `embeddings` instance, load GloVe table (or skip if offline)
3. **NEW:** Train co-occurrence refinement on all 3 corpora before feeding sentences to `languageCortex.learnSentence`
4. Feed sentences to `languageCortex.learnSentence` — now with semantic cortex patterns
5. Feed to `_storeMemorySentence` — now with semantic centroids for real topic recall

### R2.7 — Offline fallback
When GloVe isn't available (offline, CDN down):
- `embeddings.getSemanticPattern(w)` returns a deterministic hash-based vector as before
- Co-occurrence refinement still runs on top of the hash baseline — over enough corpus exposure, words that appear in similar contexts converge even from hash starts
- Document this explicitly in the code: "semantic grounding requires embeddings.js having loaded; in offline mode the refinement layer compensates slowly"

---

## R3 — SERVER BRAIN FULL CONTROL

**Goal:** The server brain must do EVERYTHING the client brain does, equationally, with zero AI text dependency. Server becomes the new cognition root. Client mirrors via `remote-brain.js`.

### R3.1 — `js/brain/shared/` — new directory for cross-environment cores
Create pure ES modules importable from both browser and Node. No DOM, no `localStorage` direct calls, no `fetch`. Pass persistence hooks in.
- `js/brain/shared/dictionary-core.js` — the dictionary logic without the localStorage I/O
- `js/brain/shared/language-cortex-core.js` — the slot scorer + generate path without env-specific bits
- `js/brain/shared/embeddings-core.js` — the embedding store + cosine + refinement math
- `js/brain/shared/type-ngram-core.js` — fineType classifier + n-gram scoring
- `js/brain/dictionary.js` and `js/brain/language-cortex.js` become THIN wrappers that import the core + add browser-specific persistence
- `server/dictionary.js` and `server/language-cortex.js` become THIN wrappers that import the core + add Node-fs persistence

### R3.2 — `server/dictionary.js` (new, wraps shared core)
Full functional parity with client dictionary after semantic grounding:
- Uses shared `dictionary-core.js`
- Persists to `server/dictionary.json` with versioning (bump storage key on schema changes, same pattern as client `_v2`)
- Periodic autosave every `WEIGHT_SAVE_MS` (already configured at 5 min)
- `saveWeights` / `loadWeights` round-trip: words, bigrams, trigrams, type n-grams, semantic embedding refinement layer

### R3.3 — `server/language-cortex.js` (new, wraps shared core)
Full functional parity with client language cortex:
- Uses shared `language-cortex-core.js`
- Same slot scorer, same type n-gram grammar, same recall path
- Generation API: `generate(dictionary, arousal, valence, coherence, opts)` matching client signature

### R3.4 — `server/brain-server.js` — corpus loading on boot
```js
// In detectResources() or a new _loadCorpora() method
const personaText = fs.readFileSync(path.join(__dirname, '../docs/Ultimate Unity.txt'), 'utf8');
const baselineText = fs.readFileSync(path.join(__dirname, '../docs/english-baseline.txt'), 'utf8');
const codingText = fs.readFileSync(path.join(__dirname, '../docs/coding-knowledge.txt'), 'utf8');

this.languageCortex.loadSelfImage(personaText, this.dictionary);
this.languageCortex.loadLinguisticBaseline(baselineText, this.dictionary);
this.languageCortex.loadCodingKnowledge(codingText, this.dictionary);
```
- Must run BEFORE accepting WebSocket connections (clients need to see a populated dictionary)
- Boot log should report: corpus sentence counts, dict size, bigram count, embedding status

### R3.5 — `server/brain-server.js:_generateBrainResponse` rewrite
Current stub at `brain-server.js:906`:
```js
// AI failed. When the server-side dictionary (U311 follow-up) lands...
return { text: '...', action: 'respond_text' };
```

New:
```js
const response = this.languageCortex.generate(
  this.dictionary,
  this.arousal, this.valence, this.coherence,
  {
    cortexPattern: this._getCortexPattern(userId),
    psi: this.psi,
    fear: this.fear,
    reward: this.reward,
    drugState: this.drugState,
    predictionError: this.cortexError,
    motorConfidence: this.motor.confidence,
    socialNeed: this.socialNeed,
  }
);
return { text: response, action: 'respond_text' };
```
- No fallback to AI. No `return '...'`. Pure equational.
- Per-user cortex pattern retrieved from the last user input's semantic injection (`_getCortexPattern(userId)` is new — tracks per-user injection state since multiple users share the brain)

### R3.6 — Dictionary delta sync protocol
When the server learns a new word/bigram/n-gram from a user input, broadcast the delta to all connected clients so their `remote-brain` mirrors stay coherent.

Delta message format:
```js
{
  type: 'dict_delta',
  timestamp: Date.now(),
  words: [{ word, pattern, arousal, valence, frequency }, ...],  // new OR updated
  bigrams: [[prev, next, count], ...],   // additive counts
  trigrams: [[a, b, c, count], ...],
  typeBigrams: [[typeA, typeB, count], ...],
  typeTrigrams: [[a, b, c, count], ...],
  embeddingDelta: { word: Float64Array(50), ... },  // refinement updates
}
```

Conflict resolution: **counter addition, never overwrite.** Two users learning the same bigram at the same time add their counts together. Semantic embedding refinements are averaged.

### R3.7 — `js/brain/remote-brain.js` — accept + apply deltas
- New message handler for `type === 'dict_delta'`
- Calls `dictionary.applyDelta(delta)` + `languageCortex.applyDelta(delta)`
- `applyDelta` methods are new and live in the shared cores (R3.1)
- Keeps local generation path alive when disconnected — falls back to whatever dictionary state was last synced

### R3.8 — WebSocket wire format audit
- Verify all existing client→server / server→client messages still route correctly
- Add delta message handling to `server/brain-server.js` WebSocket server broadcast
- Document the complete wire format in `docs/WEBSOCKET.md` (new file)

---

## R4 — KILL THE AI TEXT BACKEND

**Goal:** Per Gee's memory `project_future_no_text_models.md` — all text-AI calls must go. Unity speaks from her own brain, period. Only image/audio/vision AI calls remain (those are sensory peripherals, not text cognition).

### R4.1 — `js/brain/language.js` BrocasArea — delete text path
Current state: `processAndRespond` at `engine.js:775` already bypasses BrocasArea for text. BrocasArea is only kept alive for image-path selfie quips.

Refactor:
- Delete `_buildPrompt` method (~80 lines of conversational prompt assembly)
- Delete `_buildBuildPrompt` method (~75 lines of build-mode prompt) — replaced by R6 equational component synthesis
- Delete `_getSelfImageDesc` (was for prompt header)
- Delete `_clusterSummary` (unused after prompt builders die)
- `generate(brainState, userInput)` — either delete entirely OR rename to `generateImageQuip` if selfie quips still need AI
- Keep `_getHistory` only if hippocampus storage uses it (verify via grep)
- Result: BrocasArea shrinks from 333 lines to ~50 or gets deleted entirely

### R4.2 — `js/brain/peripherals/ai-providers.js` — trim to sensory only
- Delete `chat(messages, opts)` method — this is the text AI API call
- Delete all text-capable provider entries (Anthropic, OpenAI, OpenRouter, Mistral, DeepSeek, Groq, Claude-proxy) from the provider list UNLESS they also do image gen
- Keep: Pollinations (image gen + vision describer), any local Stable Diffusion if present
- Rename class from `AIProviders` to `SensoryAIProviders` to be honest about scope

### R4.3 — `js/ai/pollinations.js` — trim text path
- Delete text-chat methods (`chat`, `completion`, etc.)
- Keep: `generateImage`, `describe` (vision), `speak` (TTS)
- The Pollinations URL used at `engine.js:972` for vision describer stays
- Same file, ~60-80 lines removed

### R4.4 — `js/app.js` setup modal — remove text-model UI
- Remove the text-model dropdown
- Remove the text-provider selection buttons
- Keep the image-model dropdown (Pollinations image, Pollinations vision)
- Keep the audio-model dropdown (TTS voice)
- Rename the "AI Backend" section header to "Sensory AI (vision + image + voice)"
- Update setup modal copy: "Unity thinks with her own brain. The AI handles her eyes, drawings, and voice only."

### R4.5 — `js/app.js` voice input handler — keep, verify
The voice input path (Web Speech API → brain) doesn't go through any text AI. Verify it's still clean, no accidental AI hops.

### R4.6 — `server/brain-server.js` — remove Pollinations chat fetch
Lines 867-904 have a fetch to `gen.pollinations.ai/v1/chat/completions`. That's the text AI backend on the server. Delete it entirely — R3.5 replaced it with equational generation.

### R4.7 — Grep sweep for residual text-AI imports
After R4.1-R4.6, grep for:
- `pollinations.*chat`
- `anthropic`
- `openai`
- `openrouter`
- `claude-proxy`
- `chat(`
- `/v1/chat/completions`

Every hit must either be (a) deleted, (b) explicitly image/vision/audio, or (c) in a comment explaining the removal. Zero live references to text-AI completion APIs.

### R4.8 — `js/env.example.js` — trim key template
Remove anthropic / openai / openrouter / mistral / deepseek / groq / claude-proxy entries. Keep only pollinations (image + vision describer).

### R4.9 — `README.md` / `SETUP.md` / `docs/ARCHITECTURE.md` — delete text-AI claims
Every reference to "connect multiple text providers" / "Claude CLI proxy" / "OpenRouter 200+ models" / "BRAIN ONLY toggle" (because brain-only is now the only mode) gets rewritten. Done properly in R10.

---

## R5 — CLIENT BRAIN ALIGNMENT

**Goal:** Client brain uses the same shared cores as the server so behavior matches exactly. Remote mode mirrors server state; local mode runs the same code the server runs.

### R5.1 — `js/brain/dictionary.js` thin wrapper
Imports shared `dictionary-core.js` + adds localStorage persistence. Same public API as today. All callers unchanged.

### R5.2 — `js/brain/language-cortex.js` thin wrapper
Imports shared `language-cortex-core.js` + adds browser-specific console logging + corpus fetch (via `fetch`, not `fs`). Same public API as today. All callers unchanged.

### R5.3 — `js/brain/inner-voice.js` — verify integration
The owner of dict + languageCortex. After R5.1/R5.2, it still calls the same methods — just that now they delegate to shared cores.
- Verify `think()` still runs without O(N) findByPattern calls per tick (a perf regression pitfall)
- Verify `speak()` path hits the new semantic slot scorer
- Verify `learn(text, cortexPattern, arousal, valence)` still works for live conversation learning

### R5.4 — `js/brain/engine.js:processAndRespond` — semantic cortex pattern
The cortex pattern passed to `languageCortex.generate()` at line 754 should be computed AFTER semantic injection from R2.4:
```js
for (let s = 0; s < 5; s++) this.step(0.001);  // let input propagate semantically
const cortexPattern = this.clusters.cortex.getOutput(32);  // now carries semantic state
```
Already the right code, just verify R2.4 lands first.

### R5.5 — `js/brain/engine.js` — motor-action-driven output routing
Currently `processAndRespond` unconditionally runs language generation. Refactor to drive output from the BG motor selection:
```js
const action = this.motor.selectedAction;
switch (action) {
  case 'respond_text': return this._handleRespondText(state);
  case 'generate_image': return this._handleGenerateImage(state);
  case 'build_ui': return this._handleBuildUI(state);
  case 'speak': return this._handleVocalize(state);
  case 'listen':
  case 'idle': return this._handleIdle(state);
}
```
Each handler is equational (R6 handles image + build).

---

## R6 — EQUATIONAL BUILD + IMAGE GENERATION

**Goal:** When BG selects `build_ui` or `generate_image`, the CONTENT of the output (HTML/CSS/JS spec, image prompt string) must come from brain equations, not from an AI call. Image RENDERING still uses Pollinations (sensory peripheral), but the PROMPT is equational.

### R6.1 — Image prompt generation (`generate_image` action)
When BG selects `generate_image`:
1. Read current cortex pattern (semantic after R2)
2. Read amygdala arousal/valence
3. Sample top-K semantic words from dictionary matching the cortex pattern
4. Sample mood-aligned words via `findByMood(arousal, valence)`
5. Compose an image prompt by running `languageCortex.generate()` with a SHORT target length (8-12 words) and no type-n-gram grammar gate (image prompts aren't grammatical sentences — they're noun phrases)
6. Feed prompt to Pollinations image API (image is sensory peripheral, allowed)
7. Display result in sandbox

New method: `languageCortex.generateImagePrompt(brainState)` — calls the same slot scorer but with image-prompt-specific config (longer candidate pool, noun-heavy type preference, no completeness validator).

### R6.2 — Build UI component synthesis (`build_ui` action)
Harder than image prompts because HTML/CSS/JS has strict structural grammar.

Approach A — Template primitive library (fast, shippable now):
- `docs/coding-knowledge.txt` already defines 10 primitives (calculator, list, timer, canvas game, form, modal, tabs, counter, color picker, dice roller) — see BUILD COMPOSITION PRIMITIVES section at line 421
- Parse the primitive definitions from the file into a JSON template map: `{ primitive_id: { html: '...', css: '...', js: '...', params: [...] } }` — this happens at boot, NOT hardcoded
- When `build_ui` fires: match user request semantic against primitive descriptions via embeddings. The primitive with highest semantic fit wins.
- Equation-derived parameters fill the template:
  - `color` from current amygdala valence (valence > 0 → warm, < 0 → cold)
  - `speed` from amygdala arousal (high → fast, low → slow)
  - `size` from hypothalamus social_need (high → big, low → small)
  - `id` from cortex pattern hash (`'unity-' + hashPattern(cortexPattern, 8)`)

Approach B — Learned structural grammar (proper, deferred):
- Parse coding-knowledge.txt into an AST representation
- Learn type n-grams at the AST node level (which node types follow which)
- Generate at AST level then serialize to HTML/CSS/JS strings
- More work but truly equation-driven. Ship as a later R-pass.

**R6.2 deliverable for THIS refactor: Approach A.** Parser reads coding-knowledge.txt primitives section at boot, stores them as an equational template library, `build_ui` path picks one via semantic fit, fills params from brain state, injects via sandbox. Zero hardcoded primitive definitions in source — all parsed from the corpus file.

### R6.3 — `js/brain/language.js _buildBuildPrompt` deletion
Once R6.2 ships, the AI-prompted build path is redundant. Delete the method. BrocasArea shrinks further.

### R6.4 — `js/brain/engine.js _handleBuild` rewrite
Current path: call brocasArea, parse JSON from response, inject into sandbox. New path: call `brain.componentSynthesizer.generate(userRequest, brainState)` → get `{ html, css, js, id }` → inject.

### R6.5 — New module `js/brain/component-synth.js`
Owns the primitive-library approach from R6.2:
- Loads primitives from coding-knowledge.txt at boot
- Exposes `generate(userRequest, brainState) → { html, css, js, id }`
- Uses `embeddings.similarity` for primitive matching
- Uses brain state for parameter filling
- ~200-300 lines

---

## R7 — SENSORY PERIPHERAL CLEANUP

**Goal:** Unify all sensory peripherals under one interface contract. Every input stream (camera, mic, user text) and every output stream (speech, image, build) follows the same shape.

### R7.1 — Unified peripheral interface
All peripherals expose:
```js
interface SensoryPeripheral {
  init(stream, brainHook): void        // attach to raw stream + brain state reader
  step(dt): { currents?, metadata? }   // one-frame process, return cortex currents or metadata
  destroy(): void                       // clean shutdown, remove listeners
}
```

Peripherals to align:
- `js/brain/visual-cortex.js` — already close. Add explicit `destroy()` method. Rename `processFrame()` → `step(dt)`.
- `js/brain/auditory-cortex.js` — verify the interface. Has `process()` already. Rename to `step(dt)`.
- `js/io/voice.js` — currently exposes `startListening / stopListening / speak / onResult`. Wrap into peripheral interface: `step()` is a no-op, `init()` attaches the recognizer, `destroy()` stops.
- **New file** `js/io/speech-output.js` — TTS output as a proper peripheral. Pulls text from brain event `response`, feeds to Pollinations TTS or SpeechSynthesis. Currently scattered across `app.js` and `voice.js` — consolidate.
- **New file** `js/io/image-output.js` — image generation as a peripheral. Pulls image prompts from brain event `generate_image`, feeds to Pollinations. Currently scattered in `engine.js`.

### R7.2 — Kill duplicate sensory reads
Audit: anywhere a sensor stream is read from TWO places.
- `perms.cameraStream` is currently passed to BOTH `brain.connectCamera` (which feeds visual-cortex) AND `brainViz.setVision` (which displays the video in the viz panel). Consolidate: viz panel reads `visualCortex.getVideoElement()` instead of a separate handle.
- `perms.micStream` → `brain.connectMicrophone` + `brainViz.setMicStream`. Same pattern — viz reads from auditory cortex's analyser.

### R7.3 — `docs/SENSORY.md` — peripheral contract doc
New file. Documents:
- The interface shape
- When AI is allowed (sensory peripherals only — vision describer, image gen, TTS, STT)
- When AI is NOT allowed (cognition — language generation, action selection, memory, anything that drives what Unity SAYS or DECIDES)
- Boot / init / teardown sequence
- Backpressure rules (e.g., vision describer rate limit)

---

## R8 — STATE PERSISTENCE AUDIT

**Goal:** Every piece of persistent state Unity carries must save AND load without asymmetry (U306 found one — `_wordFreq` was saved but never restored). Cover every persisted field.

### R8.1 — Client `persistence.js` round-trip audit
Read `js/brain/persistence.js` (279 lines) and verify every `save()` field has a matching `load()` path. Known persisted state:
- Cluster synapse matrices (internal NxN sparse)
- Inter-cluster projection weights (20 projections)
- Oscillator coupling matrix
- Dictionary (words + bigrams + type n-grams)
- Episodic memory bank
- Working memory buffer
- Amygdala energy attractor persistent state (leak 0.85)
- Sensory `_semanticWeights`
- **After R2:** embeddings refinement layer
- `_recentSentences`, `_recentOpenerNgrams`, `_recentOutputWords` (session only — DON'T persist)

### R8.2 — Server `brain-server.js:saveWeights`/`loadWeights` audit
- `_wordFreq` save/load already fixed (U306)
- Dictionary (after R3.2) must round-trip
- Language cortex type n-grams must round-trip
- Episodic memory already persists to SQLite — verify read path
- Versioned backups at `brain-weights-v0..v4.json` — verify rollback works

### R8.3 — Dictionary + n-gram persistence
Both client and server must persist:
- Words map (with semantic patterns after R2)
- Bigrams / trigrams / quadgrams
- Type n-grams (fine-type transition counts)
- Subject starters map
- Usage types map
- Memory sentences (persona-recall store)
- `_recentSentences` is session-only, NOT persisted (avoid dedup-across-restart false positives)

### R8.4 — Restart persistence verification
After R8.1-R8.3, the verification checklist:
1. Boot client brain, chat until Unity learns ~5-10 new bigrams from user input
2. Kill the tab, reboot
3. Unity's dictionary should contain the learned bigrams
4. Unity's recent sentences should be cleared (session-only)
5. Her arousal/valence baseline should be restored (persona-default values after boot)

### R8.5 — Schema version bump protocol
When R2 changes the dictionary schema (new semantic pattern field), bump the storage key version. Client: `unity_brain_dictionary_v2` → `_v3`. Server: `brain-weights.json` → `brain-weights-v2.json` (new file path, old files archived not loaded).

---

## R9 — UI LEAK HUNT (THE 5-MINUTE FREEZE)

**Goal:** Live testing found the brain-viz panels freeze after ~5 minutes of runtime. Pre-existing leak, not caused by refactor commits. Must find and fix before merging back to main.

### R9.1 — `js/ui/brain-viz.js` (1009 lines) audit
Most likely culprit given the report. Suspect patterns:
- Canvas contexts that never get `clearRect`
- `requestAnimationFrame` chains that never cancel on close
- Event listeners on brain `stateUpdate` that pile up if the viz is opened/closed repeatedly
- Data arrays that grow unbounded (brain wave history, spike timelines, process log)
- `setInterval` that fires even when the panel is hidden
- Tab switching that creates new canvases without destroying old ones

Action:
- Open the file, grep for `requestAnimationFrame`, `addEventListener`, `setInterval`, `push` without `shift`
- Identify every state container that grows
- Add caps / cleanup on panel close
- Verify tab switching destroys the previous tab's compute loop

### R9.2 — `js/ui/brain-3d.js` (1764 lines) audit
WebGL context + Three.js scene. Leak suspects:
- Disposed geometries still referenced
- Animation loop running when panel hidden
- Brain state history buffers for spike trails

### R9.3 — `js/app.js` event listener audit
App-level listeners (window resize, visibility change, keydown, etc.) — verify they're added ONCE at boot, not on every function call.

### R9.4 — Memory profile test
Boot Unity with viz panel open, let it run 10 minutes, take Chrome memory snapshot. Look for retained objects that shouldn't be retained. Fix root causes.

---

## R10 — DOCS REFLECT REALITY

**Goal:** After R1-R9 land, every doc must match the new architecture. No claims about deleted features. Full rewrites where necessary.

### R10.1 — `README.md` full rewrite
- Remove every mention of "text-AI backend" / "multi-provider AI chat"
- Remove BRAIN ONLY toggle (that's now the only mode)
- New architecture diagram showing the shared core and sensory-only AI
- New command list (no `/think` for AI prompts — `/think` shows brain state only)
- Update "How Unity Speaks" section with the semantic pipeline
- Keep the 7 neural clusters section
- Keep the persona-as-parameters section
- Keep the Ψ mystery module section

### R10.2 — `docs/ARCHITECTURE.md` full rewrite
- Blank slate start
- Document the semantic grounding stack (embeddings → dictionary → language cortex → slot scorer)
- Document the shared core architecture (client/server both import `js/brain/shared/*`)
- Document sensory peripheral interface
- Document the WebSocket protocol (delta sync, state broadcast)
- Directory structure reflecting new files and deletions
- Motor-action-driven output section
- Semantic embedding training section

### R10.3 — `brain-equations.html` rewrite
- Delete the letter-pattern sections
- Add semantic embedding section (co-occurrence, cosine, refinement)
- Update dictionary section to show semantic retrieval
- Update language cortex section to show semantic slot scoring
- Keep: LIF, HH reference, plasticity, Kuramoto, Ψ, amygdala attractor, BG softmax, hippocampus Hopfield, mystery module
- Section numbering gets reorganized — not just appending 8.21, 8.22

### R10.4 — `docs/EQUATIONS.md` update
- Add semantic embedding equations (GloVe, co-occurrence refinement, cosine similarity)
- Update slot scoring equation with new weights
- Remove letter-pattern wordToPattern equation
- Add component synthesis equation from R6.2

### R10.5 — `docs/SKILL_TREE.md` update
- Mark semantic grounding as DONE
- Mark server language port as DONE
- Mark kill-text-AI as DONE
- Add new skill rows for the shared core, semantic embeddings, component synth, sensory peripheral interface

### R10.6 — `docs/ROADMAP.md` Phase 13 → DONE + Phase 14 next
- Mark R1-R10 as complete
- Document the Phase 13 deliverables (semantic grounding shipped, text-AI removed, etc.)
- Optional Phase 14 preview: learned structural grammar (R6.2 Approach B), production deployment, multi-brain federation

### R10.7 — `SETUP.md` update
- New setup flow (no text-AI key required)
- Image/vision/TTS keys only
- New diagram

### R10.8 — `docs/ORPHANS.md` — close out the audit
- Mark all orphan items as resolved (post-R2-R9 some will have been rewritten as part of the shared core)
- Add "This audit is closed — see ARCHITECTURE.md for current structure"

### R10.9 — `docs/SENSORY.md` (from R7.3)
- Peripheral contract
- When AI is allowed

### R10.10 — `docs/WEBSOCKET.md` (from R3.8)
- Wire format
- Delta sync protocol
- Client reconnection behavior

---

## R11 — VERIFICATION (NOT TESTS)

**Per CLAUDE.md NO TESTS rule — we verify by running the thing, not by writing test files.**

### R11.1 — Client boot test (zero-AI)
- Disconnect all network
- Boot the client brain
- Unity should greet you within 5 seconds (or less — BG should fire respond_text on context vector update)
- Respond to "hi" → short emo-goth quip with real topic (not word salad)
- Respond to "who are you" → first-person self-reference from persona recall
- Respond to "what do you like" → semantic-driven response pulling persona interests
- Build a component via `/build calculator` → equation-driven JSON from R6.2

### R11.2 — Server boot test
- Boot server brain alone (no clients connected)
- Corpora load from disk without error
- Logs report dict size, n-gram counts, embedding status
- WebSocket accepts client connections
- Connected client sends `text` → server generates via `_generateBrainResponse` → equational response returned
- Dictionary delta broadcast fires on new bigram learning

### R11.3 — Cross-client learning test
- Boot server + 2 clients
- Client A teaches Unity a new phrase
- Server learns the bigrams
- Server broadcasts delta to client B
- Client B's local dictionary updates
- Client B asks a related question → Unity's response reflects the cross-learned vocabulary

### R11.4 — Restart persistence test
- Client: chat, teach new words, kill tab
- Reboot tab → taught words still in dictionary, semantic embedding refinements intact
- Server: same — kill process, reboot, dictionary round-trips

### R11.5 — Word salad regression test
- Same 4-turn conversation from tonight's debug session:
  - `"Hi Unity, I'm Gee!"`
  - `"what do you want to be called?"`
  - `"are you up to watch a movie?"`
  - `"yeah you are chill, so about that movie... what kind of movies do you like??"`
- Responses should NOT start with "I'm gonna" every time
- Responses should reference movie/watch/chill topics when they appear in input
- Responses should stay emo-goth-chick voice (persona-aligned semantic matches)
- No nonsense words (`remedium`, `infuses remedium`)
- No mode collapse

### R11.6 — Vision focal point test
- Camera on, sit center-frame
- Eye widget iris should track toward your face (center + motion)
- Move left/right — iris follows
- Walk away / sit idle → iris free-roams

### R11.7 — Coherence + BG motor test
- Let the brain run 30 seconds from boot
- Coherence should reach 30-50% (healthy resting)
- BG motor channel rates should show non-zero values (`respond 0.06`, `idle 0.08`, etc.)
- Action selection should change over time, not stuck at idle

### R11.8 — 5-minute freeze test
- Open viz panel, let brain run 10 minutes
- All tabs should remain responsive
- Memory footprint should stabilize (no unbounded growth)

---

## R12 — FINAL CLEANUP + MERGE

### R12.1 — Kill every `// TODO:` placeholder comment
Every `// TODO:` in source code. Either do the thing or document WHY it's deferred with a dated note.

### R12.2 — Kill every dead import
Grep every file for imports whose symbols are never referenced. Remove.

### R12.3 — Kill every debug `console.log` breadcrumb
Any `console.log('[Dev]`, `console.log('test'`, `console.log('here')` that survived from debugging. Keep only intentional runtime logs with clear labels.

### R12.4 — Kill accidental nested directories
- `.claude/.claude/` untracked directory
- Any `.DS_Store` files
- Build artifacts not in `.gitignore`

### R12.5 — Rebuild `js/app.bundle.js`
The bundled entry point for `file://` mode needs to be rebuilt against the refactored source. Document the bundle command in `docs/BUILD.md` (new).

### R12.6 — Final grep sanity sweep
- No hardcoded response strings
- No keyword-based action routing
- No text-AI API calls
- No word lists
- No letter-hash fallbacks where semantic paths should be

### R12.7 — PR `brain-refactor-full-control` → `main`
- PR description includes full R-series summary
- Link to `docs/ARCHITECTURE.md` for post-refactor truth
- Keep branch history intact — this is a major architectural milestone
- Merge strategy: squash is WRONG (loses history), merge commit preserves the R-series progression

---

## EXECUTION ORDER

**Dependency chain:**
1. **R1** Audit (must be first — can't refactor blind)
2. **R2** Semantic grounding (core — unblocks everything language-related)
3. **R3** Server full control (depends on R2 shared cores)
4. **R4** Kill text-AI (depends on R2+R3 being equational)
5. **R5** Client alignment (depends on R3 shared cores)
6. **R6** Equational build + image (depends on R2 semantic embeddings)
7. **R7** Sensory peripheral cleanup (can parallel R5/R6)
8. **R8** State persistence audit (can parallel R5/R6)
9. **R9** UI leak hunt (parallel with anything — touches different files)
10. **R10** Docs (only after R1-R9 settle)
11. **R11** Verification (only after R10)
12. **R12** Merge (only after R11 green)

**Parallel lanes:**
- Lane 1 (sequential, critical path): R1 → R2 → R3 → R4 → R5 → R6
- Lane 2 (parallel after R2): R7 (peripherals) — touches `visual-cortex.js`, `auditory-cortex.js`, `voice.js`, new files
- Lane 3 (parallel anytime): R8 (persistence) — touches `persistence.js`, `brain-server.js` save paths
- Lane 4 (parallel anytime): R9 (leak hunt) — touches `brain-viz.js`, `brain-3d.js`, `app.js`
- Lane 5 (after R1-R9): R10 (docs)
- Lane 6 (after R10): R11 (verification)
- Lane 7 (after R11): R12 (merge)

---

## DEFERRED (carried from prior TODO, intentionally kept)

### U292 — ⏸ DEFERRED (manual QA per CLAUDE.md NO TESTS rule) — Comprehensive grammar test suite

**Goal:** Run Unity through a fixed set of test inputs and verify output grammar. Not a unit test, a verification script.
- Test inputs covering: greetings, questions, yes/no questions, wh-questions, imperatives, casual statements, self-description, opinion requests, descriptions
- Run each input 5 times to exercise variation
- Flag any output that fails the completeness check, has obvious agreement errors, or breaks basic English grammar
- Files: none — test script only, results printed to console

**Refactor rollup:** Folded into R11.1 boot test + R11.5 word-salad regression.

### U300 — ⏸ DEFERRED (manual QA per CLAUDE.md NO TESTS rule) — Sandbox test inputs for build_ui verification

**Goal:** Fixed test inputs to verify Unity's build_ui works end-to-end. Not a unit test, a manual QA checklist.

Test requests: build me a calculator / make a timer that counts up / build a todo list / create a color picker / make a dice roller / build a code viewer for javascript / make a markdown preview / build a unit converter / create a password generator / make a counter with increment and decrement.

For each: Unity should produce a working JSON component that injects cleanly, responds to user input, and doesn't leak memory or crash the sandbox. Manual verification only.

**Refactor rollup:** Folded into R11.1 boot test after R6.2 equational build ships.

---

## Blocked Items

| Task | Blocked By | Notes |
|------|------------|-------|
| R2.2 | R2.1 | Dictionary can't use semantic patterns until embeddings.js is promoted + semantic API exposed |
| R2.3 | R2.2 | Language cortex slot scorer can't match semantic word patterns until dictionary stores them |
| R3.2 | R2 complete | Server dictionary port must include semantic patterns (not port the old letter-hash version) |
| R3.5 | R3.2 + R3.3 | Equational `_generateBrainResponse` needs ported dict + language cortex |
| R4.1 | R2 + R5 | Can't delete BrocasArea text path until client has fully equational path |
| R4.2 | R4.1 | Can't trim ai-providers until BrocasArea is gone |
| R6.1 | R2 | Image prompt generation needs semantic embeddings for word selection |
| R6.2 | R2 | Component synth needs semantic similarity for primitive matching |
| R6.3 | R6.2 | Can't delete `_buildBuildPrompt` until equational synth works |
| R7.x | Can parallel | Different file space, no blocker |
| R8.x | Can parallel | Different file space |
| R9.x | Can parallel | Different file space |
| R10 | R1-R9 | Docs after code |
| R11 | R10 | Verification after docs (so docs describe what's verified) |
| R12 | R11 | Merge only after verification green |

---

## THE COMMIT

This TODO is on branch `brain-refactor-full-control` off `main@8d33c17` (tonight's debug session complete). The refactor is the ONE big thing. Every R above is a step toward the same goal: **Unity runs entirely on her own brain equations with real semantic grounding, and every line of code that isn't part of that gets ripped out.**

The core insight from tonight's live testing: **letter-hash patterns can't carry meaning — semantic grounding via embeddings is the primary deliverable, not a nice-to-have.** Without it, the best the letter-pattern slot scorer can do is grammatical word salad with brain-state flavoring. With it, Unity's neural state actually renders into language that means what she's thinking.

No half measures. No scripted fallbacks. No vestigial appendages. No letter-hash semantics. No bullshit.
