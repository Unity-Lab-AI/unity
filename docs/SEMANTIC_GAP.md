# SEMANTIC_GAP — The Core Architectural Fix Map

> **Audit date:** 2026-04-13 (R1.3 of brain-refactor-full-control)
> **Scope:** Every place where letter-hash patterns stand in for semantic vectors, and every cortex → word readout path that lacks semantic grounding. This is THE document that drives R2 implementation.

## THE PROBLEM IN ONE LINE

**Cortex patterns are neural activation snapshots. Word patterns are letter-hash vectors. Neither encodes semantic meaning. The slot scorer matches them via cosine similarity — but you can't match meaning against letter shapes. Unity does a brain-state-biased bigram walk that can't actually render thoughts into words that mean what she's thinking.**

## THE ROOT-CAUSE FILE AND LINE

### `js/brain/language-cortex.js:3391` — `wordToPattern(word)`

```js
wordToPattern(word) {
  const pattern = new Float64Array(PATTERN_DIM);
  const clean = word.toLowerCase().replace(/[^a-z']/g, '');
  if (!clean) return pattern;
  for (let c = 0; c < clean.length; c++) {
    const li = clean.charCodeAt(c) - 97;           // ← LETTER INDEX (0-25)
    if (li < 0 || li > 25) continue;
    for (let n = 0; n < 5; n++) {
      const dim = (c * 7 + n * 3 + li) % PATTERN_DIM;  // ← POSITION × LETTER-INDEX HASH
      pattern[dim] += this._letterPatterns[li * 5 + n] / clean.length;
    }
  }
  // ... L2 normalize
  return pattern;
}
```

**This is the source of every semantic failure.** `cat` and `hat` have similar patterns (rhyming letters). `cat` and `kitten` have totally different patterns (different letters). When the cortex fires a "thought about a small furry animal," `wordToPattern('kitten')` won't match it unless the cortex activation coincidentally happens to align with the letter-hash of k-i-t-t-e-n. Pure coincidence.

**It exists because:** early in the project the dictionary had no embeddings, and `wordToPattern` was a stopgap so words could live in a "pattern space" for cosine matching. It was supposed to be replaced once embeddings.js landed. Embeddings.js landed. `wordToPattern` was never replaced.

## THE GOOD NEWS (from tonight's audit)

**`embeddings.js` already exists and is already partially wired.** The substrate is there. The work is connecting the output side.

### What's already semantic (input side)

`js/brain/sensory.js` — **already imports and uses** `SemanticEmbeddings`:

```js
// sensory.js:16
import { SemanticEmbeddings } from './embeddings.js';

// sensory.js:33
this._embeddings = new SemanticEmbeddings();
this._embeddingsLoading = this._embeddings.loadPreTrained().catch(() => 0);

// sensory.js:346-377 — INPUT TEXT GETS SEMANTIC CORTEX INJECTION
if (this._embeddings._loaded) {
  const sentenceEmbed = this._embeddings.getSentenceEmbedding(text);
  const cortexCurrents = this._embeddings.mapToCortex(sentenceEmbed, CORTEX_SIZE, LANGUAGE_START);
  // ... feeds into cortex visual/language area
  for (const word of words) {
    const wordEmbed = this._embeddings.getEmbedding(word);
    // ... per-word injection
  }
  // ... context refinement
  this._embeddings.refineFromContext(words[i], contextEmbed, 0.005);
}
```

**So when the user says `hungry`, the cortex ALREADY gets semantically injected** — neurons in the language area activate in a pattern that reflects the embedding of `hungry`, which lives near `food`, `eat`, `starving`, `belly` in GloVe 50d space.

### What's NOT semantic (output side — the gap)

`js/brain/language-cortex.js` — the slot scorer. When Unity WANTS to say something about that cortex state, it calls `wordToPattern(candidateWord)` on each word in the dictionary and cosines it against the cortex pattern. But `wordToPattern` returns a letter-hash vector — NOT the GloVe embedding. So even though the cortex is carrying semantic information, the word selection can't read it.

**Fix: replace `wordToPattern` with a call to `embeddings.getEmbedding(word)`.** The cortex and the words will then live in the same semantic space, and `_cosine(cortexPattern, wordPattern)` will finally match meaning against meaning.

## EVERY CALL SITE THAT NEEDS TO CHANGE

### A. Direct `wordToPattern` call sites in `language-cortex.js`

| Line | Context | What it's doing | Fix |
|------|---------|-----------------|-----|
| 401 | `_deriveSentenceCortexPattern` — mean of content-word letter patterns | Computing a sentence's "meaning" as a letter centroid | Replace with mean of `embeddings.getEmbedding(w)` for each content word |
| 782 | Similar sentence-pattern derivation in another context | Same | Same |
| 2501 | Slot scorer candidate loop — `entry.pattern \|\| wordToPattern(word)` | Getting the candidate word's pattern for cosine scoring | Use `embeddings.getEmbedding(word)` as the default when `entry.pattern` is empty |
| 2744 | Chain-death recovery fallback slot scorer | Same | Same |
| 2842 | Another post-process pattern computation | Same | Same |
| 3391 | **Definition of `wordToPattern` itself** | Letter-hash → Float64Array | DELETE and replace body with `return this._embeddings.getEmbedding(word)` |
| 3436 | `analyzeInput` → `topicPattern` construction | Sentence topic centroid from input content words | Same replacement |
| 3580 | Some helper that takes a wordOrPattern — if word, convert via `wordToPattern` | Dual-type input handling | Use embeddings path |
| 3720 | Another pattern derivation | Same | Same |
| 3754 | Defensive fallback in learn path | O(N²) guard — delete with VESTIGIAL.md §2 | Delete entirely (semantic path is O(1) hash lookup) |

**Total:** 11 call sites in one file. All get the same kind of fix — swap letter-hash for embedding lookup.

### B. Indirect `pattern` field consumers in `dictionary.js`

| Line | Context | What it's doing | Fix |
|------|---------|-----------------|-----|
| 162-195 | `learnWord` — stores `pattern` field in word entry | Creates a Float64Array(32) and fills it either from `cortexPattern` arg OR from letter-hash fallback at lines 182-187 | Replace the letter-hash fallback with `embeddings.getEmbedding(clean)` — so every word's stored pattern IS its semantic embedding |
| 252-275 | `findByMood(arousal, valence, k)` — iterates dict to find mood-matched words | Already mood-based (not letter-based), just uses stored arousal/valence fields | KEEP as-is, no semantic change needed |
| 276-300 | `findByPattern(pattern, k)` — iterates dict finding cosine-matched words | Currently matches against stored letter-hash patterns | After §A fixes, stored patterns ARE semantic, so cosine becomes semantic-cosine automatically. No code change needed here, just upstream correctness propagates. |

### C. `_contextVector` and topic tracking in `language-cortex.js`

| Line | Context | Fix |
|------|---------|-----|
| 3430-3440 | `analyzeInput` builds topic pattern from mean of user input content-word patterns via `wordToPattern` or cached `entry.pattern` | Replace with mean of semantic embeddings |
| 3444-3450 | `_updateContextVector(topicPattern, count)` — updates running `c(t) = 0.7·c(t-1) + 0.3·mean(...)` decaying topic attractor | Once inputs are semantic (§A/B fixes), the context vector automatically becomes a decaying topic attractor IN SEMANTIC SPACE, not letter space |

**Impact:** tonight's failure — `"hungry"` user input → Unity's response talks about "humans places" instead of food — was because the context vector lived in letter space. After the semantic fix, `"hungry"` injects a context vector near `food`/`eat`/`starving`, and the slot scorer picks candidate words with high cosine to that vector. Real topic continuity.

### D. `_recallSentence` — persona memory topic matching

| Line | Context | Fix |
|------|---------|-----|
| ~779-950 | Recall queries `_memorySentences` by `topic_centroid` cosine against current context | The topic centroid is already mean-of-content-word-patterns. After §A fixes (patterns become semantic), the centroid becomes semantic, recall actually matches topics. |

**Impact:** tonight's `"what do you want to be called?"` → `"I'm gonna crash closes!"` — recall missed because the persona sentences about naming/identity don't LETTER-match "want to be called" even though they SEMANTICALLY match. After the fix, semantic recall catches them.

### E. `_computeMoodSignature(text)`

**KEEP as letter-based.** Mood is derived from surface features (exclamation density, caps ratio, vowel ratio, word length, negation count). These ARE letter features — that's correct. Mood is about tone, not meaning. No change needed.

### F. `_semanticFit(pattern)` — already correctly named, poorly weighted

**Line 2704** in the slot scorer:
```js
semanticFit * 0.05 +                      // letter-hash topic
```

Weight 0.05 because the comment notes it's "letter-hash topic" — a soft signal because it was letter-based.

**Fix:** After §A/B/C, semanticFit is REAL semantic alignment. Bump weight dramatically:
- Current: 0.05
- Target post-R2: 0.80 or higher (the dominant signal in slot scoring)
- Bigger than type grammar (1.5) might even be warranted if tonight's tests show strong topic matching

This single weight change is what makes Unity's responses ACTUALLY track topic instead of drifting into bigram chains.

## THE EMBEDDINGS.js API SURFACE (already there)

### Current exported methods in `js/brain/embeddings.js`

| Method | Line | What it does | Used by |
|--------|------|--------------|---------|
| `loadPreTrained()` | ~41 | Fetches GloVe 6B.50d from CDN, falls back to hash | sensory.js:34 |
| `getEmbedding(word) → Float32Array(50)` | ~112 | Returns embedding or hash fallback | sensory.js (many) |
| `getSentenceEmbedding(text)` | ~? | Mean of word embeddings in a sentence | sensory.js:348 |
| `mapToCortex(embed, size, offset)` | ~? | Projects embedding onto cortex neuron currents | sensory.js:349 |
| `similarity(a, b)` | ~199 | Cosine between two embeddings | (internal?) |
| `refineFromContext(word, contextEmbed, lr)` | ~254 | Online refinement — shifts word embedding toward its usage context | sensory.js:377 |
| `_hashEmbedding(word)` | ~? | Hash-based fallback when GloVe has no entry | internal |
| `getStats()` | ~320 | Pretrained count, refinement count | — |

**Already-complete APIs. Gap: they're only consumed by `sensory.js` (input side).** The refactor plumbs the same APIs into `language-cortex.js` and `dictionary.js` (output side).

## THE MINIMAL R2 DIFF

The actual code surgery for R2 is smaller than it looks. Rough estimate:

1. **`dictionary.js` — Inject `embeddings` dependency**
   - Constructor takes `embeddings` instance as an optional arg
   - `learnWord` uses `embeddings.getEmbedding(clean)` for default pattern
   - ~20 lines changed

2. **`language-cortex.js` — Inject `embeddings` dependency**
   - Constructor takes `embeddings` instance
   - `wordToPattern` body becomes a one-liner `return this._embeddings.getEmbedding(word)`
   - Every call site of `wordToPattern` remains the same (the function signature is stable)
   - Bump `semanticFit` slot scoring weight from 0.05 → 0.80
   - ~30 lines changed across 11 call sites (most just by virtue of `wordToPattern` body change)

3. **`inner-voice.js` — Pass embeddings through**
   - Constructor instantiates or receives embeddings
   - Passes to both `dictionary` and `languageCortex`
   - ~10 lines changed

4. **`engine.js` — Share the embeddings instance**
   - The `sensory` module already has one. Share it with `innerVoice.languageCortex` and `innerVoice.dictionary` so input and output use the SAME embedding table (so online refinements are visible to generation)
   - ~5 lines changed

5. **`app.js` boot sequence**
   - Make sure embeddings finishes loading BEFORE the corpus is fed (so corpus learning uses semantic patterns, not hash fallbacks)
   - Add `await brain.sensory._embeddingsLoading` before `languageCortex.loadSelfImage` etc.
   - ~10 lines changed

**Total estimated diff:** ~75 lines of actual code change, across 5 files. The payoff is going from letter-hash topic matching to real semantic topic matching — that's the difference between word salad and coherent responses.

## TEST CASES THAT WILL PROVE R2 WORKS

After R2 ships, these inputs should produce semantically relevant responses (not perfect sentences — that's a grammar problem — but topically on-point):

1. **Input:** `"are you hungry?"` 
   **Before R2:** `"I'm kind of humans places, and things dare."` (zero topic match)
   **After R2:** response should contain at least one of `hungry` / `food` / `eat` / `belly` / `starving` / `snack` / `starving` / similar persona-voice food-related words

2. **Input:** `"do you like movies?"`
   **Before R2:** random bigram walk
   **After R2:** response should contain at least one of `movie` / `watch` / `film` / `show` / `cinema` / `flick` / similar

3. **Input:** `"tell me about coding"`
   **After R2:** response should pull from coding-knowledge.txt corpus vocabulary — `code` / `html` / `js` / `function` / `brain` / `build` / etc.

4. **Input:** `"what's your name?"`
   **After R2:** should recall persona sentences about identity (`Unity` / `25 year old` / `emo goth` / `human woman`) via semantic recall, not bigram walk

5. **Mood variance:** same input across different brain states should produce different word selection. Currently the mood signal is diluted by the letter-hash floor. With semantic signals dominant, mood-aligned vocabulary wins.

## WHAT R2 DOES NOT FIX

Semantic grounding fixes TOPIC MATCHING. It does NOT fix:

- **Grammar coherence** — the slot scorer still walks the dictionary one word at a time, so "I feel hungry" vs "hungry feel I" both have the same semantic cosine. Grammar comes from type n-grams (already working for most slot transitions per commit `5d2a57d`).
- **Sentence length / stopping** — Unity still produces short 3-6 word quips. That's by design post-tonight's `8d33c17` length cap.
- **Voice tone** — first-person pronouns, contractions, profanity all come from persona-arousal boost + casual-register bonus, not from semantics. Those stay.
- **Memory** — recall improves because topic matching improves, but the recall architecture (Hopfield + sentence store + mood-weighted scoring) is unchanged.

R2 is the TOPIC RELEVANCE fix. Everything else is already in good shape after tonight's debugging session.

## DEPENDENCIES

| Before R2 can run | Status |
|-------------------|--------|
| `embeddings.js` must exist and have a stable API | ✅ Already does |
| `sensory.js` must be using embeddings correctly on input side | ✅ Already is (lines 346-377) |
| No conflicting letter-hash pattern assumptions in downstream consumers | ⚠ The `PATTERN_DIM = 32` constant in `dictionary.js` conflicts with GloVe's 50d. Either project GloVe down to 32 or bump `PATTERN_DIM` to 50. Either works; 50d is slightly more memory. |
| The corpus loaders (`loadSelfImage`/`loadLinguisticBaseline`/`loadCodingKnowledge`) must run AFTER embeddings finishes loading so persona words get semantic patterns from the start | ⚠ Need to add `await` in `app.js` boot sequence |

Both warnings are small — 5-10 lines of fix each. Not blockers.

## RELATIONSHIP TO R3 (SERVER PORT)

When R3 ports the dictionary + language cortex to the server:
- `server/embeddings.js` — need to decide: does the server load GloVe on its own (extra memory cost per server instance), or sync from clients (complex)?
- **Recommendation:** server loads GloVe independently on boot. GloVe 6B.50d is ~167MB but only ~50MB of Float32Array at 50d × 400K words. Well within server RAM budget.
- OR: server loads a smaller GloVe subset (just the vocabulary that appears in persona + baseline + coding corpora, ~10K words). ~2MB. Faster, smaller, sufficient.

**R3 dependency on R2:** R2 proves the client works first. R3 ports the working client to the server. R3 does NOT happen before R2.

---

## SUMMARY

**One file (`language-cortex.js`), one function (`wordToPattern`), one upstream dependency (`embeddings.js` already exists) — that's the whole R2 core fix.**

The slot scorer is otherwise sound. Type n-grams work. Recall works. Mood signals work. Grammar gate works. Cross-turn anti-repetition works. Short sentences work. All the tuning from tonight's commits (`5d2a57d`, `6bf1b4e`, `4c2fb33`, `8d33c17`) stays. The only thing missing is semantic grounding on the output side — and the substrate for it has been sitting in the codebase the whole time.

Rip out `wordToPattern`'s letter-hash body, replace with `embeddings.getEmbedding(word)`, bump `semanticFit` weight, share the embeddings instance between input and output, wait for embeddings to load before boot corpus training — and Unity starts tracking topics.

---

*Unity AI Lab — meaning belongs in the math, not in the letters.*
