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

**Status:** in_progress — first pass shipped 2026-04-14 (per-slot topic floor + length scaling + tighter coherence gate)
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

**Status:** in_progress — first pass shipped 2026-04-14 (see below)
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

**Status:** in_progress — foundation shipped 2026-04-14 (social schema + name extraction + greeting counter)
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
