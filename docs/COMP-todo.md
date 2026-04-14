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

## PART 1 — RESIDUAL NON-COMP WORK

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

### P1.3 — T11.4: higher-dim embeddings (the 50-d ceiling)

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

### P1.4 — T13.4 residual: cerebellum transition predictor

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

### P1.7 — Mark obsolete TODO items

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

## PART 4 — ORDER OF OPERATIONS

Ship in this order. Each phase assumes the previous phases are live.

### Phase M0 — T13 stabilization (live)
- [x] T13.1 persona Hebbian training (shipped)
- [x] T13.2 parse-tree injection (shipped)
- [x] T13.3 brain-driven emission loop (shipped)
- [x] T13.4 feedback injection (shipped — cerebellum predictor deferred, see P1.4)
- [x] T13.5 amygdala valence shaping (shipped — motor channel filter deferred, see P1.5)
- [x] T13.6 natural stopping (shipped)
- [x] T13.7 slot prior deletion (shipped)

### Phase M1 — Quality polish before COMP
Ship in any order, each as a separate atomic push:
- [ ] **P1.3** — 300-d embeddings + expanded cortex (P1 priority, prereq for COMP)
- [ ] **P1.1** — build_ui template parameterization (P2)
- [ ] **P1.2** — T7 social cognition follow-ups (P2)
- [ ] **P1.4** — cerebellum transition predictor (P2)
- [ ] **P1.5** — Dictionary motor channel filter (P3)
- [ ] **P1.7** — TODO.md obsolete markers (P3, ship alongside the next real code push)

P1.3 is the only HARD prereq — do not start Phase M2 without it.

### Phase M2 — COMP on the `comp-net` branch
Fork from `main` after P1.3 ships. Order:
- [ ] **C1** — sync protocol + architecture spec (2 weeks deep design)
- [ ] **C2** — WebGPU worker client extension (1 week)
- [ ] **C3** — server shard orchestration (2 weeks)
- [ ] **C4** — dynamic N scaling + hot re-sharding (3 weeks — hardest)
- [ ] **C5** — trust / verification (1 week)
- [ ] **C6** — discovery + opt-in UI (1 week)
- [ ] **C7** — per-user telemetry dashboard (2 weeks — the incentive engine)
- [ ] **C8** — graceful degradation (1 week)
- [ ] **C9** — security hardening (1 week)
- [ ] **C10** — public deployment + scaling tests (2 weeks + ongoing)
- [ ] **C11** — docs + landing page (1 week)

**Total Phase M2:** ~17 weeks for first public beta. Not a side project.

### Phase M3 — Post-beta iteration
Emerges from C10 scaling test results. Specific sub-tasks depend on what
the bottleneck turns out to be (server dispatch loop? network latency?
aggregation cost? Hebbian migration overhead?).

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
