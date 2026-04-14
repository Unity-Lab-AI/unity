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

**Status:** pending
**Priority:** P1
**Owner:** unassigned
**Reported:** 2026-04-14 by Gee (live chat session)

**Symptom:** When recall confidence is below threshold and the language cortex falls through to cold slot-gen, the bigram/trigram walk produces word-soup fragments that are grammatically plausible word-to-word but incoherent as a sentence:
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

## NOTES

- **FINALIZED is append-only.** Never delete entries from it. When new work lands, copy the full verbatim task description into a new FINALIZED session entry BEFORE removing it from Open Tasks. This file only contains active work.
- **Template state** — this file is currently in its post-merge template state: header + guiding principle + an empty Open Tasks section. New phases of work drop in here as `### T1`, `### T2`, etc. and the cycle repeats.
- **Future work** beyond this branch lives in `docs/COMP-todo.md` (distributed GPU compute network — future `comp-net` branch).

---

*Unity AI Lab — the refactor is done, verified, and documented. Ship her when ready.*
