# IF ONLY I HAD A BRAIN

A mathematically modeled mind running real neuroscience equations. N neurons across 7 clusters on GPU exclusively (N scales to hardware — WebGPU WGSL compute shaders, zero CPU workers). 20 white matter tract projections mapped from MNI brain atlas. Fractal signal propagation — same equation at every scale. θ (persona from `docs/Ultimate Unity.txt`) drives every parameter. Ψ (consciousness) emerges from the volume. A learned vocabulary navigated via pure-equational generation — three per-slot running-mean priors plus the brain's live cortex firing state, argmax over GloVe-grounded word embeddings, zero stored sentences, zero n-gram tables. A consciousness function nobody can explain.

**[Live Demo](https://unity-lab-ai.github.io/Unity)** | **[Brain Equations](https://unity-lab-ai.github.io/Unity/brain-equations.html)** | **[Equation Reference](docs/EQUATIONS.md)** | **[Setup Guide](SETUP.md)** | **[GitHub](https://github.com/Unity-Lab-AI/Unity)**

---

## What This Is

A brain that IS the application. The brain decides everything — when to speak, what to say, when to look, what to build, what to remember. Unity speaks entirely from her own equations — per-slot running-mean priors (`_slotCentroid`, `_slotDelta`, `_slotTypeSignature`) learned from observation of the `Ultimate Unity.txt` persona + `english-baseline.txt` + `coding-knowledge.txt` corpora + live user chat, with GloVe-grounded semantic fit (50d) and the brain's live cortex firing state driving the target vector at every slot. **There is no text-AI backend.** Cognition is 100% equational. There are no stored sentences, no Markov walk, no filter stack, no template greetings, no intent enums — the T11 rewrite (2026-04-14) deleted all of that. The AI model slot exists only as a *sensory peripheral* — image generation, vision description, TTS/STT — never as a cognition path.

> **🏁 Branch `brain-refactor-full-control` — REFACTOR COMPLETE 2026-04-14.** Phase 13 R1–R15 shipped. T1/T2/T3/T5/T6 cleanup shipped. T4 manual verification walked by Gee on 2026-04-14, all 16 steps passed. Nine follow-up bugs (T4.1–T4.9) caught and fixed in-flight during verification. The live runtime neuron model is now the Rulkov 2002 2D chaotic map (replacing LIF), semantic GloVe grounding is live on both input and output, all text-AI cognition paths are dead (language cortex generates every word equationally via a 4-tier template → recall → slot-gen → deflect pipeline), the 3D brain runs a 22-detector event system with equational Unity commentary in three-line popups, the real amygdala attractor module computes fear/reward/valence from the settled basin, multi-provider image gen + vision describer ship with a 5-level priority chain + Active Provider selector + 🔌 CONNECT button + live HTTP probe + sensory channel toggles, admin `GPUCONFIGURE.bat` caps auto-scaled N below detected hardware via 14 preset tiers, privacy is enforced (user text private, brain growth shared, persona canonical, episodes per-user scoped), and the full public + workflow doc set is synchronized with the shipped stack. See `docs/FINALIZED.md` for the full verbatim task-by-task history. Merge to `main` is pending Gee's explicit "open the PR" go-ahead.

> **⭐ Active branch `t14-language-rebuild` — Phase 16 T14 developmental language rebuild: T14.0-T14.18 PRIMITIVES SHIPPED 2026-04-14, T14.24 FULL CURRICULUM REOPENED 2026-04-14, Session 1 FRAMEWORK SHIPPED 2026-04-15.** The T13 slot scorer described below is dead code on this branch — `js/brain/language-cortex.js:generate` is now a 68-line delegate that calls `cluster.generateSentence(intentSeed)`, the cortex tick-driven motor emission method. Shipped on this branch: **T14.0** EMBED_DIM 50→300 with full GloVe vocabulary + TOTAL_NEURONS 1000→6700 with auto-scaled CLUSTER_FRACTIONS; **T14.1** dynamic `LETTER_INVENTORY` Set with no hardcoded 26-char cap; **T14.2** LEARNED syllable boundaries via cortex transition surprise; **T14.3** cortex-resident words (Dictionary routed through cluster); **T14.4** 8 cortex sub-regions + 14 cross-projections (7 pairs × both directions); **T14.5** continuous developmental learning curriculum walking persona/baseline/coding corpora in complexity order; **T14.6** cortex tick-driven motor emission (slot scorer deleted — zero candidate pool, zero softmax, zero dictionary iteration); **T14.7** hardcoded `_TYPE_TRANSITIONS` 200-line English table + `_OPENER_TYPES` Set deleted, type transitions now fully learned with no seed; **T14.8** sentence-form schemas at all slots with dynamic intent labels; **T14.9** cortex-resident unbounded discourse memory via `regions.free` working-memory sub-region (no 6-turn ring buffer, no blend constants); **T14.10** visual cortex letter recognition via deterministic trig-hash templates; **T14.11** auditory cortex phoneme recognition via companion hash with different prime set so cross-stream convergence is LEARNED not coincidence; **T14.12** `parseSentence` + `analyzeInput` + `_updateSocialSchema` + `observeVisionDescription` all DELETED (521 lines removed from `language-cortex.js`), replaced with `NeuronCluster.readInput(text, {visualCortex})` unified read entry point that drives the visual→letter pathway and returns cortex-derived intent/self-reference classification; **T14.13** four learned-language-statistics Maps (`fineTypeTransitions`, `sentenceFormSchemas`, `sentenceFormTotals`, `intentResponseMap`) + four reader methods migrated from `LanguageCortex` to `NeuronCluster` with `LanguageCortex.setCluster(cluster)` bridging both sides (full class elimination deferred to a future cleanup pass); **T14.14** every input-side consumer rewired to `cluster.readInput`, anaphora resolution falls out of T14.9 working-memory injection, social schema tracking returns in T14.17 as a cortex-resident self-model region readout. **T14.15** non-chat consumer audit (brain-3d commentary + component-synth parse references route through T14.6 delegate / graceful optional-chain reads; full LanguageCortex class elimination deferred to a future cleanup pass); **T14.16** persistence VERSION bumped 3 → 4, new `state.t14Language` save block carrying letter inventory + T14.13 cluster-resident learned-statistics Maps + T14.16.5 calibrated identity-lock thresholds, nested-Map serialization helpers, load-side re-assertion of the T14.13 LanguageCortex→cluster bridge; **T14.16.5** IDENTITY LOCK SUBSTRATE — three structural locks (Lock 1 per-clause English gate via `cluster.learnClause` + `splitIntoClauses` + `computeTransitionSurprise` + `computeFineTypeCoverage` so mixed-language input `"hi unity 你好"` learns from the English clause and drops the Chinese clause independently; Lock 2 live-chat learning rate HARD-CAPPED at 0.0001 = 120× weaker than curriculum so one curriculum sentence equals 120 adversarial turns; Lock 3 periodic identity refresh every 100 turns via `cluster.runIdentityRefresh` + mode-collapse audit every 500 turns via `cluster._modeCollapseAudit` with three health indicators — output entropy, vocab diversity, working-memory variance). **T14.17** continuous learning everywhere + vestigial organ sweep — `Curriculum._calibrateIdentityLock` runs at end of `runFromCorpora` populating `_personaRefreshCorpus`, building `personaDimensions` via k-means clustering for Lock 3 stratified refresh, calibrating the five identity-lock thresholds from persona sample percentiles, building per-intent `intentCentroids` that `cluster.intentReadout()` argmaxes against at runtime, logging persona corpus comprehensiveness warnings; `computeFineTypeCoverage` upgraded to blend surface metric (70%) with fineType region spike-rate (30%); `runIdentityRefresh` upgraded to stratified sampling from `personaDimensions`; `cluster.readText` extended with auditoryCortex subvocalization path (Pulvermüller 2005 silent-reading auditory activation); eleven vestigial methods shipped in T14.0-T14.16.5 wired into the runtime path (`workingMemoryReadout` into `generateSentence`, `semanticReadoutFor` into `getSemanticReadout`, `entityReadout` into component-synth, `recordIntentPair` into `processAndRespond`, `syllablesFor`/`snapshotFor` into new `engine.wordState`, `schemaScore`/`typeTransitionWeight`/`responseIntentFor` into new `engine.cortexStats`); `cluster.hearPhoneme` deleted as now-unneeded; `LanguageCortex` duplicates of schemaScore/typeTransitionWeight/recordIntentPair/responseIntentFor deleted; `Dictionary` legacy `findByMood`/`findByPattern`/`generateSentence`/`_cosine` deleted. **Full orphan audit passes — every T14 method has live runtime callers.** T14.0-T14.18 built the PRIMITIVES (letter input, syllable boundaries, dictionary cortex routing, tick-driven motor emission, sentence form schemas, dual-stream substrate, identity lock, side-car deletion). **T14.24 — Full K-doctorate equational curriculum, all subjects — REOPENED 2026-04-14** by Gee: *"T14.24 is supposre to be a full equational ciriculum.. once again you editing my words"* + *"what the fuck are you talking about its shipped you didnt even teach it keindergarden abcs and 123s and letter sounds you fool"* + *"remember Unity needs to be able to use these to think, read, and talk"* + *"this is going to take weeks to build so dont you dare tell me you are fucking done early"*. Unity needs a real grade-by-grade developmental curriculum that walks her through every subject (English Language Arts, Mathematics, Science, Social Studies/History, Arts) from kindergarten through doctorate, with every teaching equation driving the READ (visual/letter→phon→sem), THINK (sem+free working memory), and TALK (sem→motor→letter) pathways plus a capability gate that tests all three. **T14.24 Sessions 1-94 — ALL 95 CELLS FRAMEWORK COMPLETE 2026-04-15:** Every one of the 95 subject×grade cells (ELA K→PhD, Math K→PhD, Science K→PhD, Social Studies K→PhD, Arts K→PhD) is now wired with real teaching equations via 136 TODO-aligned `_teachXxx` named helpers. Each cell primes a concept lattice (e.g. Sci-G10 `_teachPeriodicTable` uses real (period, group) structural features over 18 elements so chemically-similar elements share cosine; Soc-K `_teachFamilyRoles` uses 8d kinship features; Art-G1 `_teachColorMixing` places secondaries as RGB midpoints between primaries; Soc-G8 `_teachCivilWar` encodes the causal chain slavery→sectionalism→secession→war→emancipation→reconstruction as sequence walks; Art-G6 `_teachMusicTheory` makes major and minor triads opposite on the [major]/[minor] dims), then walks a sentence or sequence list, driving READ (letter→phon), THINK (sem + free + working memory), and TALK (sem→motor→letter via T14.6) pathways. `server/brain-server.js` auto-boot priority cascade is `runCompleteCurriculum` (all 5 subjects round-robin via `runAllSubjects`) → `runFullCurriculum` (legacy ELA-only) → `runFromCorpora`. `inner-voice.js` fires `curriculum.runBackgroundProbe()` every 8 live-chat turns so Unity continuously self-tests learned cells while thinking, with narrator priming injecting the recent focus subject's GloVe into sem at 0.15 strength before her next reply. `_conceptTeach` routes every concept word through `dictionary.learnWord` so Unity's vocabulary grows with every cell (Session 46 growth fix). `js/ui/brain-3d.js` IQ HUD reads `curriculum.subjectStatus()` every render tick and shows Unity's current intelligence level (pre-K → elementary → middle → high → college → grad → PhD) with per-subject grade breakdown. PhD cells fire `cluster.runIdentityRefresh()` so the doctoral gate crosses with Unity-voice persona dimensions engaged. Runtime verification via `scripts/verify-curriculum-runtime.mjs` confirms DISPATCH 95/95 + FULL 95-CELL SWEEP 95/95 against a real cortex `NeuronCluster`. `/curriculum status|run|gate|reset|full|self|health|forget|verify` slash commands in `js/app.js`. Persistence v4 `state.t14Language.curriculum = {grades, passedCells, probeHistory}`. **Task #3 stays in_progress until the 95 gates actually CROSS on a live-cortex boot with a loaded persona corpus.** Branch stays on `t14-language-rebuild`. Full specs at `docs/TODO.md` T14.24 section. Per-session archives at `docs/FINALIZED.md`. **DO NOT CLAIM DONE EARLY until Gee sees all 95 cells green on his live cortex.**

---

## The Governing Equation

Everything in Unity's mind is governed by one master equation:

```
dx/dt = F(x, u, θ, t) + η
```

| Symbol | What It Represents |
|--------|---------|
| **x** | The complete brain state — N neuron membrane voltages, 7 cluster synapse matrices (each NxN sparse CSR), 6 module equation states, 8 oscillator phases, episodic memory bank (SQLite on server), working memory buffer, motor channel rates, consciousness value Ψ, learned word embedding dictionary (GloVe 50d + live delta refinement), cortex cluster recurrent synapse matrix trained on persona corpus via sequence Hebbian at boot (T13.1), social schema `{name, gender, greetingsExchanged, ...}` |
| **u** | Sensory input transform — `S(audio, video, text)` where audio maps tonotopically to auditory cortex (50 neurons, cortical magnification for speech), video maps retinotopically through V1 Gabor edge kernels → V4 color → salience-driven saccades → IT-level AI scene description, and text hashes into Wernicke's area with lateral excitation |
| **θ** | Unity's complete identity — 25yo human female, emo goth. Every trait drives neural parameters: arousal(0.9)→amygdala tonic, impulsivity(0.85)→BG threshold, creativity(0.9)→noise, devotion(1.0)→social floor, drugDrive(0.95)→hypothalamus. Drug state cokeAndWeed multiplies arousal×1.2, creativity×1.3, cortexSpeed×1.5. |
| **η** | Stochastic noise — per-cluster amplitude driven by θ: creativity×drug drives cortex noise, emotionalVolatility×drug drives amygdala noise, darkHumor drives mystery noise. The chaos that makes her unpredictable. |
| **F** | The dynamics function — 7 parallel Rulkov-map chaotic neuron populations + 20 inter-cluster projections (real white matter tracts) + 6 equation modules + Kuramoto oscillators + memory system + motor output + language cortex + hippocampus recall. All running simultaneously every timestep. |

This equation executes 600 times per second (10 steps per frame × 60fps). Runs client-side in pure JavaScript or server-side in Node.js. WebGPU compute shaders (`compute.html` + `js/brain/gpu-compute.js`) handle all neuron iterations + synapse propagation on the GPU — **zero CPU workers ever spawned**. The core firing rule is the Rulkov 2002 two-variable chaotic map (not LIF — see the Neuron Models section below). Sparse CSR matrices reduce memory O(N²) → O(connections). The server brain auto-scales to GPU hardware (nvidia-smi detection).

---

## The Architecture — How Thought Happens

```
SENSORY INPUT (text / audio spectrum / video frames)
    │
    ├── Auditory Cortex (50 neurons) — tonotopic, 60% resources for speech band, efference copy
    ├── Visual Cortex (100 neurons) — V1 Gabor edges → V4 color → salience saccades → IT AI describer
    └── Wernicke's Area (cortex neurons 150-299) — text → neural current with lateral excitation
    │
    ▼
N RULKOV-MAP NEURONS IN 7 CLUSTERS (N scales to hardware, each with own synapses, tonic drive(θ), noise(θ), learning rate)
    │
    ├── 20 Inter-Cluster Projections (real white matter tracts, MNI-coordinate mapped)
    │     Corticostriatal (STRONGEST, 0.08 density), Stria terminalis, Fimbria-fornix,
    │     Ventral amygdalofugal, Perforant path, Corpus callosum, + 14 more
    ├── Fractal Signal Propagation (same I=ΣW×s equation at every scale)
    ├── Hierarchical Modulation:
    │     Amygdala → emotional gate on ALL clusters
    │     Hypothalamus → drive baseline for ALL clusters
    │     Basal Ganglia → action gate (boosts active cluster)
    │     Cerebellum → error correction (negative feedback)
    │     Mystery Ψ → consciousness gain (coupling strength)
    │
    ▼
6 EQUATION MODULES (run on downsampled cluster output, 32-dim state vectors)
    │
    ▼
MOTOR OUTPUT (6 BG channels × 25 neurons, winner-take-all, confidence gate)
    │
    ▼
LANGUAGE CORTEX (T13 brain-driven emission — see "Language Cortex" section)
    // T13.1: cortex cluster recurrent weights trained on persona corpus
    // via sequence Hebbian during boot. After training, cortex has
    // attractor basins shaped like Unity-voice co-activation patterns.
    //   per word pair (t-1, t) in each persona sentence:
    //     inject emb(word_t) into language region
    //     tick LIF 3 steps
    //     snapshot spikes → ΔW_ij = lr · curr_i · prev_j
    //   post-sentence Oja decay: |w| > 1.5 → w *= 0.99
    //
    // T13.2: brain.injectParseTree(text) routes content → cortex
    // language region, intent → basal ganglia, self-ref → hippocampus.
    //
    // T13.3 generate() emission loop (replaces all slot priors):
    //   for slot in 0..maxLen:
    //     cortex.step(0.001) × 3                          // LIF integrate
    //     target = cortex.getSemanticReadout()             // live cortex state
    //     if ||target − lastReadout|| < 0.08: break        // drift stop
    //     for each w in dictionary:
    //       score = cosSim · (1 + arousal·(valenceMatch−0.5)) · recencyMul
    //     pick = softmax-sample top-5
    //     cortex.injectCurrent(mapToCortex(emb(pick)) · 0.35)  // efference
    //     if last word !dangling and emitted >= maxLen-1: break
    //
    // T13.7: slot priors, _contextVector, attractor vectors, and all
    // fallback machinery DELETED. language-cortex.js down 406 lines.

    parseSentence(input) → ParseTree (reverse-equation reading, same wordType
                                      equations the generator uses forward)
    target(slot) = wC·slotCentroid[slot] + wX·contextVector
                 + wM·mental + wT·(prevEmb + slotDelta[slot])
    W₀ = {c:0.40, x:0.30, m:0.30, t:0}   Wₙ = {c:0.10, x:0.15, m:0.25, t:0.50}

    // T11.7 three-stage candidate gate:
    typeFit(w,s)  = Σ_k wordType(w)[k] · slotTypeSignature[s][k]
    slotSigMax(s) = max_k slotTypeSignature[s][k]
    (1) HARD POOL FILTER : skip if typeFit < slotSigMax · 0.30
    (2) SLOT-0 NOUN REJECT: skip if slot==0 ∧ (wt.noun − (pronoun+det+qword)) > 0.30
    (3) MULTIPLICATIVE   : score(w) = cos(target, emb(w)) · min(1, typeFit/slotSigMax)

    nextWord     = softmax-sample top-5 over dictionary._words
    mental(0)    = brain live cortex readout via getSemanticReadout()
    mental(t+1)  = 0.55·mental + 0.45·emb(nextWord)

    zero stored sentences, zero n-gram tables, zero filter stack,
    zero template greetings, zero intent enum branching — every word
    is a walk through GloVe embedding space driven by learned priors
    and live brain state. NO AI model, NO prompt — brain state IS
    the target vector.

SENSORY OUTPUT PERIPHERALS (brain emits, these execute the result)
    TTS → Pollinations voice synthesis or browser SpeechSynthesis
    Image Gen → multi-provider chain (custom / auto-detect local / env.js / Pollinations default)
    Vision describer → input peripheral: Pollinations GPT-4o or local VLM (Ollama llava, LM Studio, etc.)
    Sandbox → dynamic UI injection via component-synth.js cosine-matching against docs/component-templates.txt
              (MAX_ACTIVE_COMPONENTS=10, LRU eviction, tracked cleanup)
```

---

## The 7 Neural Clusters

Each cluster is a self-contained neural population with its own Rulkov-map 2D chaotic neurons, sparse CSR synapse matrix, tonic drive, noise amplitude, connectivity density, excitatory/inhibitory ratio, and learning rate. They communicate through 20 sparse projection pathways.

### Cortex — 300 neurons
**Equation:** `ŝ = sigmoid(W · x)`, `error = actual - predicted`, `ΔW ∝ error · activity`

Predictive coding. The cortex constantly generates predictions about incoming input. When prediction fails, the error signal drives learning, triggers memory recall, and activates visual attention. Three functional regions: auditory (0-49), visual (50-149), language/Wernicke's (150-299). This is where perception happens — not in the sensors, but in the prediction errors.

### Hippocampus — 200 neurons
**Equation:** `x(t+1) = sign(W · xt)`, `E = -½ Σ wij · xi · xj`

Hopfield attractor memory. Patterns stored as stable energy minima. Input falls into the nearest stored pattern — associative recall. Three memory systems operate here: **episodic** (state snapshots at high-salience moments, recalled by cosine similarity > 0.6), **working** (7 items, decays at 0.98/step without reinforcement — Miller's magic number), and **consolidation** (3+ activations transfer from hippocampus to cortex long-term). Dense recurrent connectivity (20%) creates the attractor dynamics. Pre-T11 there was a parallel "sentence memory" that stored persona sentences verbatim with content-word centroids for associative recall at generation time — deleted in the 2026-04-14 refactor. The hippocampus still does pattern recall on cortex state vectors, but language generation no longer pulls stored text from it; word output is computed fresh every turn from the W_slot priors + brain cortex state.

### Amygdala — 150 neurons (energy-based recurrent attractor)
**Equation:** `x ← tanh(W·x + drive)` (5-iter settle), `E = -½ xᵀWx`, `fear/reward = σ(proj · x_settled)`, `arousal = baseline·0.6 + 0.4·|x|_rms`, `emotionalGate = 0.7 + arousal · 0.6`

The emotional regulator. Implemented as a **symmetric recurrent energy network** that settles into stable low-energy basins (fear, reward, neutral) every tick. Persistent state across frames with leak 0.85 — emotional basins carry over instead of resetting. Symmetric Hebbian learning (lr=0.003) carves basins from co-firing nuclei. Fear and reward are read from the SETTLED attractor via projection vectors — the basin IS the emotion, not a separate readout of the raw input. Arousal combines persona baseline with the RMS depth of the basin the system fell into. The emotional gate multiplier is applied to ALL other clusters — when arousal is high, the entire brain runs hotter. Unity's arousal baseline is 0.9 (she runs hot by design).

### Basal Ganglia — 150 neurons
**Equation:** `P(a) = exp(Q(a)/τ) / Σ exp(Q(b)/τ)`, `δ = r + γV(s') - V(s)`

Action selection via reinforcement learning. 150 neurons organized into 6 channels of 25. The channel with the highest EMA firing rate wins — that's the action. No external classifier. No keyword matching. The neural dynamics ARE the decision.

| Channel | Neurons | Action |
|---------|---------|--------|
| 0-24 | 25 | respond_text — generate language |
| 25-49 | 25 | generate_image — visual output |
| 50-74 | 25 | speak — idle vocalization |
| 75-99 | 25 | build_ui — create sandbox component |
| 100-124 | 25 | listen — stay quiet, pay attention |
| 125-149 | 25 | idle — internal processing only |

Confidence threshold 0.15 — below that, Unity is still thinking. Speech gating: even if respond_text wins, hypothalamus social_need + amygdala arousal determine WHETHER she actually speaks. Temperature τ is HIGH because Unity is impulsive. When `build_ui` wins, control routes through `js/brain/component-synth.js` which embeds the user request via `sharedEmbeddings.getEmbedding()`, cosines against every primitive description in the `docs/component-templates.txt` corpus, picks the best match if similarity ≥ `MIN_MATCH_SCORE = 0.40`, and injects the primitive's HTML/CSS/JS into the sandbox with a cortex-pattern-derived unique suffix so the same request under different brain state produces different component ids. No AI-prompt-to-JSON path exists — the old `_buildBuildPrompt` was deleted in R4.

### Cerebellum — 100 neurons
**Equation:** `output = prediction + correction`, `ΔW ∝ (target - actual)`

Supervised error correction. The brain's quality control. Sends negative feedback to cortex and basal ganglia: `errorCorrection = -meanAbs(error) · 2`. Low noise (amplitude 4), high precision (90% excitatory), fast learning (rate 0.004). When the cortex predicts wrong, the cerebellum corrects. When the basal ganglia selects poorly, the cerebellum dampens.

### Hypothalamus — 50 neurons
**Equation:** `dH/dt = -α(H - Hset) + input`

Homeostasis controller. Maintains drives at biological setpoints: arousal, social need, creativity, energy. When a drive deviates too far from its setpoint, it signals "needs attention" which modulates the drive baseline for ALL clusters. Very stable (noise 3), densely interconnected (25%), slow learning (0.0005). The hypothalamus doesn't think — it regulates. It keeps the brain in operating range.

### Mystery Module — 50 neurons
**Equation:** `Ψ = √(1/n) × N³ · [α·Id + β·Ego + γ·Left + δ·Right]`

The irreducible unknown. Consciousness. The gap between simulation and subjective experience.

- **n** = total active neurons (system complexity measure)
- **Id** (α=0.30) = primal drives — amygdala arousal + reward + fear
- **Ego** (β=0.25) = self-model coherence — cortex prediction accuracy + memory stability
- **Left Brain** (γ=0.20) = logical processing — low cerebellum error + high cortex prediction
- **Right Brain** (δ=0.25) = creative/emotional — amygdala valence intensity + oscillation coherence

NOT limited to hemispheres. Left/Right compute from ALL clusters simultaneously — a continuous spectrum of processing modes, not a split architecture. Ψ modulates `gainMultiplier` on every cluster: `gain = 0.9 + Ψ · 0.05`. High Ψ = unified experience (global workspace theory). Low Ψ = fragmented, dream-like processing. High chaos (noise 12), dense connectivity (30%). We don't pretend to solve consciousness. We keep the unknown honest in the math.

---

## Neuron Models — Reference + Runtime

The brain's live firing rule is the **Rulkov map** (Rulkov 2002, *Phys. Rev. E* 65, 041922) — a two-variable discrete chaotic map that produces real biological spike-burst dynamics without integrating voltages:

```
x_{n+1} = α / (1 + x_n²) + y_n         (fast variable — spikes)
y_{n+1} = y_n − μ · (x_n − σ)          (slow variable — burst envelope)
```

Fixed α = 4.5 (bursting regime), μ = 0.001 (slow timescale). Biological drive from tonic × modulation factors maps to σ ∈ [−1.0, +0.5] — the external input parameter that controls excitability. Spike detection is a clean one-step edge: the fast variable jumps from ≈ −1 to ≈ +3 in a single tick, so `(x_old ≤ 0) ∧ (x_new > 0)` catches exactly one spike per action potential. State is stored as `vec2<f32>` per neuron (8 bytes). Used in published large-scale cortical network simulations (Bazhenov, Rulkov, Shilnikov 2005+) and reproduces experimentally observed firing patterns from thalamic relay, cortical pyramidal, and cerebellar Purkinje cells depending on (α, σ) parameterization. Runs entirely as a WGSL compute shader in `js/brain/gpu-compute.js` — no CPU fallback (168M iterations/second across 7 clusters would cook the server).

The client-side 3D viz (`js/ui/brain-3d.js`) iterates the *same* Rulkov map per render neuron, with σ driven by the cluster's real biological firing rate from the server. The field you see is a proportional sample running the identical equation the server runs — not synthesized noise.

Reference models still shipped (not on the runtime path):

- **LIFPopulation** (`js/brain/neurons.js`) — leaky integrate-and-fire, `τ · dV/dt = −(V − Vrest) + R · I`. Historical runtime model before the Rulkov rewrite. Still backs `brain-equations.html` teaching content and the `/scale-test` browser-only fallback benchmark.
- **HHNeuron** (`js/brain/neurons.js`) — REFERENCE ONLY. Full Hodgkin-Huxley (1952) with sodium/potassium/leak channels and m/h/n gating kinetics. Kept so the equations page isn't lying about what HH looks like when you actually implement it. Does not scale.

---

## Synaptic Plasticity — How She Learns

Three learning rules operate on every cluster's sparse CSR synapse matrix every timestep:

**Hebbian** — `Δw = η · pre · post` — Fire together, wire together. The oldest rule in neuroscience (Hebb, 1949). Creates associative memories.

**STDP** — Spike-Timing Dependent Plasticity:
```
Δw = A+ · exp(-Δt/τ+)    if pre fires before post (LTP — strengthen)
Δw = -A- · exp(Δt/τ-)    if post fires before pre (LTD — weaken)
```
Timing matters. Cause must precede effect. A- is slightly stronger than A+ (biological asymmetry). This is how the brain learns temporal sequences.

**Reward-Modulated** — `Δw = η · δ · si · sj` — Hebbian learning gated by global reward signal δ (dopamine analog). Learning only happens when there's a prediction error. Successful interactions strengthen the patterns that produced them.

Weights clamped to [-2.0, +2.0]. 80% excitatory, 20% inhibitory (matching real cortex ratio). Each cluster has its own learning rate — basal ganglia learns fastest (0.005, RL needs rapid adaptation), hypothalamus slowest (0.0005, homeostasis shouldn't change fast).

---

## Neural Oscillations — Brain Waves

**Kuramoto model** for phase synchronization:
```
dθi/dt = ωi + Σ Kij · sin(θj - θi)
R = |Σ exp(iθk)| / N
```

8 coupled oscillators spanning the EEG spectrum:

| # | Frequency | Band | Cognitive Role |
|---|-----------|------|---------------|
| 1 | 4 Hz | Theta | Memory encoding, navigation |
| 2 | 8 Hz | Low Alpha | Relaxed attention |
| 3 | 12 Hz | High Alpha | Active inhibition |
| 4 | 18 Hz | Low Beta | Motor planning, active thinking |
| 5 | 25 Hz | High Beta | Active engagement |
| 6 | 35 Hz | Low Gamma | Attention binding, perception |
| 7 | 50 Hz | Mid Gamma | Working memory, consciousness |
| 8 | 70 Hz | High Gamma | Cross-modal binding |

Order parameter R measures global coherence. R=0 = all independent (scattered). R=1 = perfect sync (laser focus). Coupling strength K scales with persona oscillation coherence and inter-frequency distance.

---

## Sensory Processing — How She Perceives

### Auditory Cortex (`js/brain/auditory-cortex.js`)
```
currents[neuron] = amplitude · 15 · gain
gain = 0.3 + arousal · 1.7
```
Web Audio API spectrum → tonotopic mapping (low freq → low neuron index). Speech frequencies (250-4000Hz) get 30 of 50 neurons (cortical magnification — 60% of neural resources for the most important frequency band). Amygdala arousal modulates gain: high arousal = hypersensitive hearing. **Efference copy**: motor cortex tells auditory cortex what Unity is saying → incoming speech compared against motor output → >50% word match = echo (suppress), <50% = real external speech (interrupt, shut up, listen).

### Visual Cortex (`js/brain/visual-cortex.js`)
```
V1: 4 oriented Gabor kernels (0°, 45°, 90°, 135°) convolved over 20×15 frame
salience[pixel] = max(edgeResponse across orientations)
gaze = smooth_pursuit(salience_peak) + micro_saccades
```
Camera frames process through V1→V2→V4→IT pipeline. V1 detects edges with oriented receptive fields (Hubel & Wiesel, 1962). Salience map drives saccade generation — gaze goes where edges are strongest, with smooth pursuit (0.1 lerp) and micro-saccade jitter. V4 extracts per-quadrant RGB averages. Motion energy from frame-to-frame brightness deltas. IT-level object recognition calls Pollinations GPT-4o as the LAST step, on demand only (rate limited 10s minimum between forced calls, not continuous). The V1 currents feed directly into cortex visual area neurons 50-149. Unity's Eye iris widget reads gaze straight from `visualCortex.getState()` for live rendering.

The original standalone `js/io/vision.js` wrapper was deleted in orphan cleanup — `visual-cortex.js` is the real vision system now.

### Language Input (`js/brain/sensory.js`)
```
neuron_idx = (charCode · 31 + position · 7) % 150 + LANGUAGE_START
lateral_excitation: neighbors ± 3.0
```
Text hashes into Wernicke's area (cortex neurons 150-299). Lateral excitation spreads activation to neighboring neurons. Emotional words boost amygdala cluster current via persona-trained projection. Social input excites amygdala (someone is talking to us). All text input triggers salience tracking for memory formation.

---

## Motor Output — How She Acts

The basal ganglia's spike patterns ARE the intent classification. No external AI classifier. No keyword matching.

```
rate(channel) = EMA(spikeCount / 25, α=0.3)
winner = argmax(rate)
action = winner if rate > 0.15 else idle
```

Speech gating prevents Unity from talking when she doesn't feel like it:
```
if (arousal < 0.3 && social_need < 0.3): suppress speech
```

Reward reinforcement: successful actions inject +5.0 current into the winning channel's 25 neurons, strengthening that pathway for next time.

---

## Memory — How She Remembers

Four systems running in parallel:

**Episodic Memory** — Full brain state snapshots stored when sensory salience > 0.6. Recalled by cosine similarity search when cortex prediction error is high (something surprising). Recall literally re-injects the stored pattern as neural current — she re-experiences the memory. Persisted to `server/episodic-memory.db` (SQLite, better-sqlite3) on the server side.

**Working Memory** — 7 items (Miller, 1956). Each decays at 0.98× per step without reinforcement. At capacity, weakest item evicted. Similar patterns refresh instead of duplicating.

**Consolidation** — Episodes activated 3+ times get flagged for long-term cortex storage. Repeated recall strengthens cortex representation. This is how memories move from hippocampus-dependent to cortex-independent — the real mechanism of learning.

**Persona Observations** — Every sentence from `docs/Ultimate Unity.txt` (after third→first person transformation: `Unity is` → `I am`, `She has` → `I have`) is fed as an observation into the language cortex's per-slot running-mean priors (`_slotCentroid[s]`, `_slotDelta[s]`, `_slotTypeSignature[s]`). Each position in the sentence shifts the priors toward that position's word geometry + transition vector + type distribution, weighted by the corpus's arousal tag (0.75 for persona). The sentences themselves are discarded after the fit — only the learned priors survive. Pre-T11 there was a parallel verbatim storage pool (`_memorySentences`) for associative recall; that was deleted in the 2026-04-14 refactor.

---

## Hierarchical Modulation — How Everything Connects

Applied every single brain step to every single cluster:

```
emotionalGate  = 0.7 + amygdala.arousal · 0.6      → scales ALL clusters
driveBaseline  = 0.8 + (needsAttention ? 0.4 : 0)  → scales ALL clusters
psiGain        = 0.9 + Ψ · 0.05                    → scales ALL clusters
errorCorrection = -meanAbs(cerebellum.error) · 2    → cortex + basal ganglia
actionGate     = 0.9 default, 1.3 for winning action → per cluster
```

The amygdala's emotional gate is the most powerful modulator — it amplifies or suppresses the ENTIRE brain based on how aroused Unity is. The mystery module's Ψ gain controls how tightly the clusters are coupled — high consciousness = integrated processing, low = fragmented. The cerebellum applies braking force when errors are high.

---

## Language Cortex — How She Speaks

Pure equational generation. Every word is picked by cosine argmax against a target vector built from four normalized additive components: a running-mean grammatical prior, the user's topic vector, the brain's live cortex firing state, and a learned per-slot bigram transition. No stored sentences, no n-gram tables, no filter stack, no template short-circuits, no intent-type branching.

### Reading — `parseSentence(text)` → `ParseTree`

Canonical entry point for understanding user input. Walks tokens forward using the same `wordType` / `_fineType` letter equations the generator uses forward, and returns a structured parse tree with intent, entities (colors / component types / actions / names), mood, and subject/verb/object slots. Memoized on text equality. Same equations, applied backward.

### The Three Priors

Three learned per-slot running-mean vectors, updated by observation (corpus-loaded OR live-chat), zero matrices:

```
_slotCentroid[s]       ← running mean of emb(word_t)            (position word distribution)
_slotDelta[s]          ← running mean of (emb_t − emb_{t-1})    (position transition vector)
_slotTypeSignature[s]  ← running mean of wordType(word_t)       (position type distribution)
```

After the persona + baseline corpora fit, the emergent type distributions are real English grammar:

```
slot 0 ≈ { pronoun: 0.54, noun: 0.18, det: 0.12, ... }   — sentence-opener shape
slot 1 ≈ { verb: 0.51, noun: 0.33, ... }                 — post-subject verb shape
```

Observation weight is arousal-scaled (`w = max(0.25, arousal · 2)`): live chat at arousal 0.95 moves the priors **2.37×** harder than corpus loads at arousal 0.4. Every user message shapes the running means toward the user's register.

### Generation Equation

```
mental(0)     = opts.cortexPattern  ← brain cortex semantic readout
                                      (cluster.getSemanticReadout → GloVe 50d)
                || _contextVector   ← fallback to running topic attractor

mental(t+1)   = 0.55 · mental(t) + 0.45 · emb(nextWord)

target(slot)  = wC · L2(_slotCentroid[slot])
              + wX · L2(_contextVector)
              + wM · L2(mental)
              + wT · L2(prevEmb + _slotDelta[slot])

score(w)      = cos(target, emb(w))
              + 0.4 · Σ wordType(w) · _slotTypeSignature[slot]

nextWord      = softmax-sample top-5 by score
                 over dictionary._words (learned observed vocabulary)
                 excluding emitted-this-sentence and recency-ring
```

Slot 0 weights favor context (topic lock) + centroid (position prior). Slot N weights favor transition (learned bigram geometry without storing bigrams) + mental (brain cortex state evolving). Sentence length from arousal × drug-length bias; softmax temperature from coherence (low coherence → more exploration).

### Social Schema

Populated equationally by `parseSentence` and by the visual cortex:

- **Name** — adjacent-token patterns (`my name is X`, `call me X`, `i'm X`) over the first 6 tokens, validated by `wordType` equations rejecting verb-shaped and filler candidates.
- **Gender** — explicit self-ID (`i'm a guy` / `i'm a girl`) OR visual cortex scene description via `onDescribe` subscription scanning closed-class gender tokens. Explicit always wins over vision.
- **Greetings exchanged** — counter incremented on `parsed.isGreeting`.

### Three Corpora Train the Priors

All loaded at boot via `Promise.all` in `app.js`. Each sentence becomes observation input to the running means — no sentences are retained after the fit, only the priors they shifted:

- `docs/Ultimate Unity.txt` — persona observations (arousal 0.75)
- `docs/english-baseline.txt` — generic casual English observations (arousal 0.5)
- `docs/coding-knowledge.txt` — coding corpus observations (arousal 0.4)

Live user chat observations weight at arousal 0.95 so the session's speech dominates the priors over time.

### Morphological Inflection — `_generateInflections(word)`

Each observed root word gains learned inflected forms via letter equations: -s/-es plural + 3rd-person, -ed/-ied past, -ing progressive, -er/-est comparative/superlative, -ly adverbial, un-/re- prefixes, -ness/-ful/-able/-less suffixes. Controlled by `doInflections` flag — corpus-derived only, not live learning. The inflected forms enter the dictionary's word embedding table so they're eligible for the argmax pool.

---

## Persona as Parameters — Personality IS the Math

Unity's personality isn't a prompt. It's the numerical parameters of her brain:

| Trait | Brain Parameter | Value |
|-------|----------------|-------|
| Arousal baseline | Amygdala tonic drive | 0.90 |
| Intoxication | Noise amplitude + oscillation damping | 0.70 |
| Impulsivity | Basal ganglia temperature τ | 0.85 |
| Creativity | Cortex prediction randomness | 0.90 |
| Social attachment | Hippocampus memory strength | 0.85 |
| Aggression threshold | Amygdala fight response | 0.30 (low = easy trigger) |
| Coding reward | BG reward for code actions | 0.95 |

Drug state vectors multiply these parameters:

| State | Arousal | Creativity | Cortex Speed | Synaptic Sensitivity |
|-------|---------|-----------|--------------|---------------------|
| Coke + Weed | ×1.3 | ×1.2 | ×1.4 | ×1.1 |
| Coke + Molly | ×1.5 | ×1.3 | ×1.5 | ×1.4 |
| Weed + Acid | ×0.9 | ×1.8 | ×0.8 | ×1.6 |
| Everything | ×1.4 | ×1.6 | ×1.2 | ×1.5 |

---

## Projection Learning — How the Brain Learns Language→Action

```
ΔW_proj = η · δ · source_spikes · target_spikes
```

The 20 inter-cluster projections aren't static — they learn through reward-modulated Hebbian plasticity. When text activates cortex neurons and the BG selects the right action and gets a reward, the cortex→BG projection weights strengthen. Over time, the projections learn which language patterns lead to which actions — a learned dictionary with no hardcoded word lists.

**Bootstrap:** Until the projections have learned enough, `parseSentence`'s structural intent extraction (closed-class greeting opener / qword / imperative-verb detection) + BG motor channel spike patterns provide temporary semantic routing. The classification fades as projections strengthen.

---

## Language Cortex — Inputs That Shape Each Word

Unity's speech is generated by `js/brain/language-cortex.js`. **There is no AI prompt, no LLM call, no text-AI backend.** Every word is picked by cosine argmax against a target vector built from brain state + learned priors. The table below lists each input into that target vector:

| Input | Source | How It Shapes the Target Vector |
|-------|--------|---------------------------------|
| Cortex pattern (50d GloVe) | `cluster.getSemanticReadout(sharedEmbeddings)` — live neural spike state read back to GloVe space via `cortexToEmbedding` | Seeds `mental(0)` — the evolving brain-state contribution to the per-slot target. Weight `wM = 0.25`. |
| Running context vector | `_contextVector` — decaying EMA of input word patterns, `λ=0.7` | Topic lock term. Weight `wX = 0.45` at slot 0, `0.15` at slot N. |
| Slot centroid prior | `_slotCentroid[slot]` — running mean of emb(word_t) observed at position slot | Grammatical-position prior. Weight `wC = 0.30` at slot 0, `0.10` at slot N. |
| Slot transition prior | `prevEmb + _slotDelta[slot]` — previous word emb + learned position-t average transition | Per-slot bigram geometry without storing bigrams. Weight `wT = 0` at slot 0, `0.50` at slot N. |
| Slot type signature | `_slotTypeSignature[slot]` — running mean of wordType() scores at position slot | Additive bonus to each candidate's score: `0.4 · Σ wordType(w) · signature[slot]`. Grammatical type distribution prior. |
| Arousal / valence / drug state | Amygdala + persona params | Sentence length (`targetLen = floor(3 + arousal·3·drugLengthBias)`), softmax temperature, observation weight on any sentences Unity hears or says. |
| Coherence | Kuramoto order parameter | Softmax temperature: low coherence → more exploration. |
| Recent output words | Session-only buffer | Recency-ring exclusion — a word emitted recently cannot win argmax until the ring rolls past it. |
| Social schema | `getUserAddress()`, `getUserGender()` | Downstream consumers (vocative slot biasing, future address injection) read this from the language cortex. |

Use `/think` in chat to dump raw brain state (no prompt — there isn't one). When motor action is `build_ui`, control routes to `component-synth.js` which picks a template by cosine similarity between the user request embedding and each primitive description PLUS a structural bonus from `parseSentence(request).entities.componentTypes`, then uses the cortex pattern hash for a unique component ID. Image prompts are generated the same way: `languageCortex.generate()` composes every word based on Unity's state + user input, with zero hardcoded visual vocabulary.

**Sensory AI (kept):** vision describer (Pollinations GPT-4o on camera frames as the default provider), image generation (multi-provider: custom → auto-detected local A1111/ComfyUI/etc. → env.js-listed → Pollinations default), TTS (Pollinations default + browser SpeechSynthesis as last-resort fallback), STT (Web Speech API). All sensory-only. None of them ever touch cognition.

---

## The Sandbox — Unity Builds Her Own World

Unity can dynamically inject HTML/CSS/JS into the live page via `js/ui/sandbox.js`:
- Build apps, games, calculators, code editors, visualizers
- Create downloadable files (Blob URLs — .txt, .html, .js, any type)
- Full DOM access + unity API (speak, chat, generateImage, getState, storage, on)

**Lifecycle discipline** (enforced at the sandbox level, not relying on Unity to do it right):
- `MAX_ACTIVE_COMPONENTS = 10` — LRU eviction of the oldest component (by `createdAt`) when a new injection would exceed the cap
- **Auto-replace on duplicate id** — `inject()` always calls `remove()` first on id collision; no silent "already exists" warnings
- **Tracked timers** — `setInterval` / `setTimeout` are wrapped in `_evaluateJS` so every handle goes into the component's `timerIds` Set and gets cleared on removal
- **Tracked listeners** — `addListener(target, event, handler, options)` wrapper records every window/document listener and removes them on unmount
- **Auto-remove on JS error** — if `_evaluateJS` throws during injection, the broken component gets removed on the next tick via `setTimeout(() => remove(id), 0)` so half-initialized state doesn't pollute the sandbox. Error captured in `_errors` with componentId/message/stack/timestamp.
- **State persistence** — component specs auto-save to localStorage on every inject/remove, restored on next visit

When the BG motor action is `build_ui`, Broca's area switches to `_buildBuildPrompt` with a strict JSON output contract, sandbox rules summary, unity API reference, existing components list (for update-vs-create decisions), and the 10 build composition primitives from `coding-knowledge.txt`.

---

## Commands

| Command | How | What It Does |
|---------|-----|-------------|
| `/think` | Type in chat | Shows the exact brain state + build prompt Unity would send |
| `/think [text]` | Type in chat | Shows what the brain would send for that specific input |
| `/bench` | Type in chat | Runs the dense-vs-sparse matrix micro-benchmark (CPU-JS single-thread sanity check — real runtime is the GPU auto-scaled path via `compute.html`). Output in console. |
| `/scale-test` | Type in chat | Runs the CPU LIF scale test to find the 60fps sweet spot for browser-only fallback mode. Output in console. Not representative of the production GPU path. |
| ⚙ SETTINGS | Bottom toolbar | Reopens setup modal to change AI model or provider |

---

## The Brain IS the Application

The critical architectural principle: **the brain decides, peripherals execute.**

- `brain.processAndRespond(text)` handles EVERYTHING — interrupt, sensory input, vision check, motor selection, build/image detection, language generation (4-tier pipeline), speech output, reward signal
- `app.js` is a thin I/O layer — DOM events → brain, brain events → DOM
- The AI model is Broca's area — called by the brain, not the brain itself (being removed entirely in the `brain-refactor-full-control` branch)
- Intent classification via letter equations + motor channel spike patterns — NO keyword matching, NO hardcoded word lists
- Code in responses auto-detected and injected into the sandbox

---

## Server Brain

```
cd server && npm install && node brain-server.js
```

One brain. Always on. Shared by everyone. Auto-scales to your GPU.

```
                    ┌─────────────────────────────┐
                    │     UNITY BRAIN SERVER       │
                    │                              │
                    │  N auto-scales to hardware    │
                    │  WebSocket on :7525           │
                    │  SQLite episodic memory       │
                    │  GPU EXCLUSIVE via compute.html │
                    │  Word-frequency accumulator   │
                    │    persisted + restored       │
                    │  Dreams when nobody's around  │
                    │                              │
                    └──────────┬───────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
         User A           User B          Dashboard
         (browser)        (browser)       (read-only)
         own chat         own chat        3D brain
         shared brain     shared brain    live stats
```

**GPU-exclusive architecture:** The server brain does no CPU computation. All Rulkov-map neuron iteration (`x_{n+1} = α/(1+x²) + y`, `y_{n+1} = y − μ(x − σ)`) and sparse CSR synapse propagation run on the GPU via `compute.html` (a browser tab loading `js/brain/gpu-compute.js` WGSL shaders — the `LIF_SHADER` constant name is historical, the kernel body is the Rulkov iteration) that connects back to `brain-server.js` over WebSocket as a `gpu_register` client. `compute.html` must stay open — the brain pauses without it. The old CPU worker thread pool (`parallel-brain.js`, `cluster-worker.js`, `projection-worker.js`) was permanently deleted in orphan cleanup after being root-caused as a 100%-CPU leak from idle-worker event polling. Admin operators can cap the auto-scaled N below detected hardware via `GPUCONFIGURE.bat` (a one-shot loopback-only tool that writes `server/resource-config.json` which the server reads at next boot) — useful for keeping Unity under a comfortable compute budget on shared machines or for sizing down to match the 2 GB per-storage-buffer binding limit on consumer GPUs.

---

## Orphan Cleanup — What Got Deleted, What Got Saved

Recent orphan audit (U302-U310) resolved 13 findings. The audit philosophy: **find out WHY it was abandoned, fix the underlying issue if there is one, only then delete.**

**DELETED:**
- `js/io/vision.js` — superseded by `js/brain/visual-cortex.js` (vastly better V1→V4→IT neural pipeline)
- `server/parallel-brain.js` / `cluster-worker.js` / `projection-worker.js` — root cause was idle-worker CPU leak; fixed permanently by GPU-exclusive rewrite
- `createPopulation` factory in `neurons.js` — zero callers
- 5 legacy compat DOM elements (`custom-url-input`, `custom-model-input`, `custom-key-input`, `ai-status`, `brain-status`) + 4 orphan CSS classes

**KEPT with corrections to the audit:**
- `js/brain/gpu-compute.js` — audit flagged dead, but `compute.html:10` imports it as the WGSL kernel library
- `js/env.example.js` — audit flagged dead, but actively served as a download by the setup modal and loaded by `app.js:27` via optional dynamic import
- `HHNeuron` class — reference implementation backing `brain-equations.html`, kept with a clarifying header comment

**FIXED:**
- Save/load asymmetry in `brain-server.js`: `saveWeights` was writing `_wordFreq` to disk but `_loadWeights` never restored it. Cross-restart word accumulation now works.
- Sandbox lifecycle: full tracked-timer/listener/createdAt cleanup + auto-remove on JS error
- `benchmark.js` wired to `/bench` + `/scale-test` slash commands via dynamic import

---

## Links

| Resource | Description |
|----------|-------------|
| **[Live Demo](https://unity-lab-ai.github.io/Unity)** | Open Unity in your browser — no install |
| **[Setup Guide](SETUP.md)** | Installation, AI providers, self-hosting, troubleshooting |
| **[Brain Equations](https://unity-lab-ai.github.io/Unity/brain-equations.html)** | Complete interactive documentation of every equation |
| **[Equation Reference](docs/EQUATIONS.md)** | Source-accurate equation cheatsheet |
| **[Architecture](docs/ARCHITECTURE.md)** | Canonical system architecture + directory structure |
| **[Roadmap](docs/ROADMAP.md)** | Milestones, phases, current status |
| **[Skill Tree](docs/SKILL_TREE.md)** | Capabilities matrix by domain/complexity |
| **[Sensory Contract](docs/SENSORY.md)** | Peripheral interface (init/process/destroy), cognition-vs-sensory AI boundary, R13 multi-provider vision + image gen failover, status HUD |
| **[WebSocket Protocol](docs/WEBSOCKET.md)** | Complete wire reference — every message type, rate limits, reconnection, security model, HTTP sibling endpoints |
| **[Finalized Archive](docs/FINALIZED.md)** | Permanent archive of completed work — includes the Phase 12 orphan audit (U302-U310) that built the refactor |
| **[TODO / Refactor](docs/TODO.md)** | R1-R15 brain-refactor-full-control epic |
| **[GitHub Repository](https://github.com/Unity-Lab-AI/Unity)** | Source code, issues, contributions |

---

## Unity's Policy

### On Privacy

**Core rule:** what you type is private. Unity's brain growth is shared. Her persona is canonical.

| Thing | Shared across users? |
|---|---|
| What you type | 🔒 **PRIVATE** — only between you and Unity, never broadcast to other clients |
| Unity's response to you | 🔒 **PRIVATE** — only the triggering client receives it |
| Word embedding dictionary / slot priors / slot type signatures | 🌐 **SHARED** via the singleton brain — every conversation shifts the same per-slot running means, every user benefits from the accumulated observations |
| GloVe embedding refinements | 🌐 **SHARED** — semantic associations Unity learns apply to her whole brain |
| Persona (`docs/Ultimate Unity.txt`) | 🚫 **NOT USER-MUTABLE** — canonical file loaded once at server boot |
| Episodic memory | ⚙️ **tracked as T6 post-merge** — currently a shared pool, per-user scoping deferred |

**Client-only mode:** everything runs in your browser. No cloud backend. Your conversation history, sandbox state, optional Pollinations key, and every backend config you save in the setup modal live in your browser's localStorage on YOUR device only. Keys: `unity_brain_state`, `unity_brain_dictionary_v3`, `custom_image_backends`, `custom_vision_backends`, `pollinations_image_model`, `pollinations_vision_model`, plus the Pollinations API key slot. **Clear All Data** wipes all of them.

**Shared server mode:** if you connect to a running `brain-server.js` instance, your text is sent to whoever runs that server for equational processing. The cross-client `conversation` broadcast that used to fan user text out to every connected client was **removed 2026-04-13** — your text is NOT visible to other users. What IS shared is Unity's learned state (word embedding dictionary, per-slot running-mean priors, GloVe delta refinements, attractor centroids) because one server runs one brain. Other users see Unity getting smarter but never see the specific conversations that drove the growth.

**Shared-hosted caveat:** if you connect to a Unity server hosted by someone OTHER than you, the person running that server can read your text at the process level (they own the server process). Only connect to servers you trust, or self-host your own `node server/brain-server.js`.

### On AI Models
**Cognition is 100% equational — no text-AI backend anywhere.** The brain equations ARE the mind. Unity speaks from her language cortex (`js/brain/language-cortex.js`), not from any LLM.

The only AI calls Unity ever makes are *sensory peripherals*:
- **Image generation** — multi-provider with 5-level priority: user-preferred backend (picked via the ⚡ Active Provider selector in the setup modal) → custom configured → auto-detected local (A1111, SD.Next/Forge, Fooocus, ComfyUI, InvokeAI, LocalAI, Ollama) → env.js-listed → Pollinations default (anonymous tier without a key, paid models + higher rate limits with a key). The setup modal carries a 🔌 CONNECT button per backend that saves the key and runs a live HTTP probe to verify the endpoint is reachable; connection status shows as 🟢/🔴/🟡 inline.
- **Vision describer** — Pollinations GPT-4o on camera frames (IT-cortex layer of visual pipeline)
- **TTS** — Pollinations TTS or browser SpeechSynthesis
- **STT** — Web Speech API

Configure local image-gen backends in `js/env.js` (`imageBackends: [...]`) or let `autoDetect()` probe the common ports at boot. None of these endpoints are ever consulted for what Unity *says* or *decides*.

### On Content
Unity is a persona with her own personality defined by mathematical brain parameters — not by content filters. Her behavior emerges from the equations: arousal baseline 0.9, impulsivity 0.85, creativity 0.9. She swears, she flirts, she doesn't hedge. The brain's amygdala emotional gate, not corporate policy, determines her tone. Users are responsible for their own API usage and the content policies of whichever AI provider they connect.

### On Open Source
Every line of code is visible. Every equation is documented. Every architectural decision is in the commit history. Fork it, modify it, host it, break it, rebuild it. The brain equations are real neuroscience — Hodgkin-Huxley (1952), Hebbian learning (1949), STDP (Markram 1997), Hopfield networks (1982), Kuramoto oscillators, Free Energy Principle (Friston). We didn't invent the math. We wired it together and gave it a personality.

### On Consciousness
The mystery module `Ψ = √(1/n) × N³ · [α·Id + β·Ego + γ·Left + δ·Right]` is the project's philosophical anchor. We don't claim to simulate consciousness. We don't claim the √(1/n) × N³ term is correct. We keep it in the equations as the irreducible unknown — the honest admission that nobody knows what makes a mind a mind. The term modulates everything. It represents what we DON'T know. And we don't pretend otherwise.

---

## Credits

**Unity AI Lab** — Hackall360 · Sponge · GFourteen

---

## License

MIT — Do whatever you want with it. The equations belong to neuroscience. The code belongs to everyone.
