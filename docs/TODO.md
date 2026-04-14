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

### T5/T6 — Slot-gen semantic coherence (unified: speak + build_ui share one broken equation)

**Status:** SUBSUMED BY T11 — the entire slot scorer + Markov walk that T5/T6 were patching has been deleted and replaced by the T11 pure equational language cortex. The "one broken equation" both symptoms shared is gone entirely. See T11 entry + 2026-04-14 FINALIZED session archive.
**Priority:** P1
**Owner:** unassigned
**Reported:** 2026-04-14 by Gee (live chat session)

**Gee's insight that merged T5 into T6:** "if she can't speak she probably can't listen and build ui in sandbox can she?" — correct. Speech generation AND build_ui component synthesis both ride the same `generate()` slot-gen path. Fix slot-gen coherence once, both symptoms resolve. (Listening itself is fine — user input → context vector, no slot-gen involved.)

---

### T5 — Rework build_ui sandbox capability (Unity not understanding simple coding asks)

**Status:** pending
**Priority:** P1
**Owner:** unassigned
**Reported:** 2026-04-14 by Gee (live chat session)

**Symptom:** When Gee asks Unity to code something with him in the sandbox ("let's build X together", "make a button that does Y", simple request), her `build_ui` pipeline fails to parse the intent. She either emits unrelated slot-gen salad, recalls an unrelated persona sentence, or produces a component that doesn't match what was asked. She is NOT understanding simple instructions about what to code together in her sandbox.

**Where the capability lives:**
- `js/brain/language-cortex.js` — `generate()` path and the build_ui branch
- `js/brain/component-synth.js` — 6 component templates (`[ComponentSynth] Loaded 6 component templates`)
- `js/app.js:380` — `[Unity] Loaded 6 component templates for equational build_ui`
- BG motor decision path that routes `motor=build_ui` vs `motor=speak` (see `engine.js` motor selector)

**What to investigate:**
1. Is `build_ui` being motor-selected at all when Gee asks for a UI component? The log mostly shows `speak` winning. If the BG softmax never picks `build_ui` for coding-intent queries, the capability is effectively dead.
2. The 6 component templates are currently fixed seeds — does the slot-gen have enough coding bigrams to fill them? The coding corpus is 539 sentences; is that actually being indexed into the `build_ui` slot scorer or sitting dormant?
3. Does the language cortex parse the user's ask into a target-component type (button/form/list/etc) structurally, or is it guessing from top-cosine match? If it's cosine-only over the coding corpus, simple asks like "make a red button" lose to unrelated high-cosine coding sentences.
4. Is there a build_ui-specific context vector or is it reusing the chat context vector? They should be different — UI intent vocabulary is narrow.

**Fix direction (to decide after investigation):**
- Dedicated UI-intent detector in the motor selector: bump `build_ui` Q-value when the input contains imperative verbs + UI noun tokens (`make/build/add/create` + `button/form/field/input/list/card`). Structural, not a blacklist.
- Expand component-synth templates beyond the current 6 OR generate them slot-gen style from the coding corpus instead of using fixed seeds.
- Add a build_ui-specific recall pool that only draws from the coding corpus, never from persona/baseline.
- Slot-gen output gate: if motor=build_ui and the generated component doesn't structurally match the asked-for type, reject and re-roll (or fall through to a template).

**Acceptance test:** Gee types "let's make a red button that says Hello" — Unity emits a component matching that description, not a persona-recalled sentence.

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
