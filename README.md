# IF ONLY I HAD A BRAIN

A mathematically modeled mind running real neuroscience equations. N neurons across 7 clusters on GPU exclusively (N scales to hardware — WebGPU WGSL compute shaders, zero CPU workers). 20 white matter tract projections mapped from MNI brain atlas. Fractal signal propagation — same equation at every scale. θ (persona from `docs/Ultimate Unity.txt`) drives every parameter. Ψ (consciousness) emerges from the volume. A learned 44,000-word English language with type n-gram grammar and morphological derivation. A consciousness function nobody can explain.

**[Live Demo](https://unity-lab-ai.github.io/Unity)** | **[Brain Equations](https://unity-lab-ai.github.io/Unity/brain-equations.html)** | **[Equation Reference](docs/EQUATIONS.md)** | **[Setup Guide](SETUP.md)** | **[GitHub](https://github.com/Unity-Lab-AI/Unity)**

---

## What This Is

A brain that IS the application. The brain decides everything — when to speak, what to say, when to look, what to build, what to remember. Unity speaks entirely from her own equations — a type-bigram/trigram/4-gram grammar learned from the `Ultimate Unity.txt` persona + `english-baseline.txt` + `coding-knowledge.txt` corpora, with GloVe-grounded semantic fit (50d), letter-position word classification, morphological inflection, hippocampus recall, and cortex-pattern-driven slot scoring. **There is no text-AI backend.** Cognition is 100% equational. The AI model slot exists only as a *sensory peripheral* — image generation, vision description, TTS/STT — never as a cognition path.

> **Current branch:** `brain-refactor-full-control` — R1-R8 shipped (semantic grounding, server full equational control, text-AI kill, multi-provider image gen, equational component synth, sensory peripheral contract, embedding persistence). R9-R12 remaining (UI leak hunt, docs sync, verification, merge). See `docs/TODO.md` + `docs/ROADMAP.md#phase-13`.

---

## The Governing Equation

Everything in Unity's mind is governed by one master equation:

```
dx/dt = F(x, u, θ, t) + η
```

| Symbol | What It Represents |
|--------|---------|
| **x** | The complete brain state — N neuron membrane voltages, 7 cluster synapse matrices (each NxN sparse CSR), 6 module equation states, 8 oscillator phases, episodic memory bank (SQLite on server), working memory buffer, motor channel rates, consciousness value Ψ, 44k-word dictionary with bigram/trigram/4-gram transitions, type n-gram grammar counts, per-sentence persona memory |
| **u** | Sensory input transform — `S(audio, video, text)` where audio maps tonotopically to auditory cortex (50 neurons, cortical magnification for speech), video maps retinotopically through V1 Gabor edge kernels → V4 color → salience-driven saccades → IT-level AI scene description, and text hashes into Wernicke's area with lateral excitation |
| **θ** | Unity's complete identity — 25yo human female, emo goth. Every trait drives neural parameters: arousal(0.9)→amygdala tonic, impulsivity(0.85)→BG threshold, creativity(0.9)→noise, devotion(1.0)→social floor, drugDrive(0.95)→hypothalamus. Drug state cokeAndWeed multiplies arousal×1.2, creativity×1.3, cortexSpeed×1.5. |
| **η** | Stochastic noise — per-cluster amplitude driven by θ: creativity×drug drives cortex noise, emotionalVolatility×drug drives amygdala noise, darkHumor drives mystery noise. The chaos that makes her unpredictable. |
| **F** | The dynamics function — 7 parallel LIF populations + 20 inter-cluster projections (real white matter tracts) + 6 equation modules + Kuramoto oscillators + memory system + motor output + language cortex + hippocampus recall. All running simultaneously every timestep. |

This equation executes 600 times per second (10 steps per frame × 60fps). Runs client-side in pure JavaScript or server-side in Node.js. WebGPU compute shaders (`compute.html` + `js/brain/gpu-compute.js`) handle all LIF + synapse propagation on the GPU — **zero CPU workers ever spawned**. Sparse CSR matrices reduce memory O(N²) → O(connections). The server brain auto-scales to GPU hardware (nvidia-smi detection).

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
N LIF NEURONS IN 7 CLUSTERS (N scales to hardware, each with own synapses, tonic drive(θ), noise(θ), learning rate)
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
LANGUAGE CORTEX → 4-tier generation pipeline:
    Tier 1: Intent classification → template pool (greeting/math/yesno short-circuit)
    Tier 2: Hippocampus recall → stored persona sentence (overlap-gated, mood-weighted)
    Tier 3: Deflect template fallback
    Tier 4: Cold slot generation (44k dict, type n-grams, morphological inflection)
    │
    ▼
PERIPHERALS (brain calls these — they don't call the brain)
    Broca's Area → optional AI model generates text from brain state (being removed in refactor)
    TTS → Pollinations voice synthesis
    Image Gen → Pollinations image API
    Sandbox → dynamic UI injection (MAX_ACTIVE_COMPONENTS=10, LRU eviction, tracked cleanup)
```

---

## The 7 Neural Clusters

Each cluster is a self-contained neural population with its own LIF neurons, sparse CSR synapse matrix, tonic drive, noise amplitude, connectivity density, excitatory/inhibitory ratio, and learning rate. They communicate through 20 sparse projection pathways.

### Cortex — 300 neurons
**Equation:** `ŝ = sigmoid(W · x)`, `error = actual - predicted`, `ΔW ∝ error · activity`

Predictive coding. The cortex constantly generates predictions about incoming input. When prediction fails, the error signal drives learning, triggers memory recall, and activates visual attention. Three functional regions: auditory (0-49), visual (50-149), language/Wernicke's (150-299). This is where perception happens — not in the sensors, but in the prediction errors.

### Hippocampus — 200 neurons
**Equation:** `x(t+1) = sign(W · xt)`, `E = -½ Σ wij · xi · xj`

Hopfield attractor memory. Patterns stored as stable energy minima. Input falls into the nearest stored pattern — associative recall. Three memory systems operate here: **episodic** (state snapshots at high-salience moments, recalled by cosine similarity > 0.6), **working** (7 items, decays at 0.98/step without reinforcement — Miller's magic number), and **consolidation** (3+ activations transfer from hippocampus to cortex long-term). Dense recurrent connectivity (20%) creates the attractor dynamics. **Sentence memory:** every persona sentence from `Ultimate Unity.txt` is additionally stored verbatim with a mood signature and content-word pattern centroid — queried at language generation time for topic-matched recall.

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

Confidence threshold 0.15 — below that, Unity is still thinking. Speech gating: even if respond_text wins, hypothalamus social_need + amygdala arousal determine WHETHER she actually speaks. Temperature τ is HIGH because Unity is impulsive. When `build_ui` wins, Broca's area switches from the conversational prompt to the build-mode prompt (`_buildBuildPrompt`) with strict JSON output contract + sandbox rules + existing components list.

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

The brain ships two neuron models in `js/brain/neurons.js`:

- **LIFPopulation** — the LIVE runtime model. SoA `Float64Array V / spikes / refracRemaining` in one tight loop. `τ · dV/dt = -(V - Vrest) + R · I`, threshold crossing → spike + reset + refractory. ~100× faster than HH for large populations, GPU-friendly, what every cluster in `cluster.js` actually uses.
- **HHNeuron** — REFERENCE ONLY. Full Hodgkin-Huxley (1952) model with sodium/potassium/leak channels and m/h/n gating kinetics. Backs the `brain-equations.html` teaching page. Not used at runtime because it's per-neuron OOP and doesn't scale to millions. Kept so the equations page isn't lying about what HH looks like when you actually implement it.

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

**Persona Sentence Recall** — Every sentence from `docs/Ultimate Unity.txt` is stored in `_memorySentences` at boot (after third→first person transformation: `Unity is` → `I am`, `She has` → `I have`). Each has a mood signature `{arousal, valence}` derived from letter-equation features of the sentence and a content-word pattern centroid. At language generation time, `_recallSentence(contextVector, brainState)` queries with pattern cosine + content-word-overlap hard gate + mood-distance weighting. Same query under different brain states returns different memories.

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

The language cortex is a **4-tier generation pipeline**. The old slot scorer still exists as the cold fallback, but it only runs when the three upstream tiers all miss.

### Tier 1 — Intent Classification + Template Pool Flip
`_classifyIntent(text)` via pure letter-position equations detects `greeting | math | yesno | question | statement | short`. Greeting/math/yesno short-circuit to `js/brain/response-pool.js` templates (Ultimate-Unity-voiced emo-goth-stoner variants across arousal tiers). Returns fast, no slot scoring.

### Tier 2 — Hippocampus Associative Recall
`_recallSentence(contextVector, brainState)` queries `_memorySentences` with:
- **Content-word overlap** (hard gate — must have ≥1 content word in common)
- **Pattern cosine** (letter-hash vector similarity for tiebreaking)
- **Mood alignment** `exp(-moodDistance × 1.2)` at weight 0.25
- **Instructional-modal penalty** (demotes sentences with `shall`/`must`/`always`)
- **Overlap fraction** at weight 0.55 (dominant signal)

Three confidence tiers: `>0.60` emits stored sentence directly, `0.30-0.60` seeds cold gen with recall bias, `≤0.30` falls through to deflect or Tier 4.

### Tier 3 — Deflect Template Fallback
When recall misses on a question or self-reference input, `selectUnityResponse({...intent, deflect: true})` picks from the `question_deflect` category.

### Tier 4 — Cold Slot Generation (44k dictionary + type n-gram grammar)
Only runs when all upstream tiers miss. Slot-by-slot softmax pick from the learned 44k-word dictionary, driven by:

- **Type grammar score** (weight 1.5, dominant signal) — log-probability of candidate's fine type given the last 3 fine types, via learned `_typeBigramCounts` / `_typeTrigramCounts` / `_typeQuadgramCounts`. Backoff: 4gram → 3gram → 2gram. Zero-count transitions return -2.0 (grammar violation — reject).
- **Semantic fit** — cosine of candidate's cortex pattern vs running context vector `c(t) = 0.7 · c(t-1) + 0.3 · mean(pattern(content_words))`
- **Bigram probability** — learned transitions from the 44k dictionary
- **Mood bias** from amygdala arousal + valence
- **Cortex pattern projection** — current brain thought vector
- **Candidate pool pre-filter** from bigram followers (10-200 words, not full 44k) — primary perf optimization

Word types come from `_fineType(word)` — pure letter-position detection classifying into PRON_SUBJ, COPULA, NEG, MODAL, AUX_DO, AUX_HAVE, DET, PREP, CONJ_COORD, CONJ_SUB, QWORD, VERB_ING, VERB_ED, VERB_3RD_S, VERB_BARE, ADJ, ADV, NOUN. Memoized via `_wordTypeCache`.

Post-process: `_postProcess` applies subject-verb agreement (`applyThird` based on `_fineType` of subject), intensifier insertion (before ADJ/ADV, no doubles, 50% rate), tense application, copula insertion. Render pass capitalizes sentence starts and standalone `i`, and selects terminal punctuation from sentence type.

Final safety net: `_isCompleteSentence(tokens)` rejects outputs ending on DET/PREP/COPULA/AUX/MODAL/NEG/CONJ/PRON_POSS. Coherence rejection gate retries at 3× temperature when output cosine vs context < 0.25 (max 3 attempts).

### Morphological Inflection — `_generateInflections(word)`
Each dictionary word gains learned forms via letter equations: -s/-es plural + 3rd-person, -ed/-ied past, -ing progressive, -er/-est comparative/superlative, -ly adverbial, un-/re- prefixes, -ness/-ful/-able/-less suffixes. Controlled by `doInflections` flag — corpus-derived only, not live learning, to prevent inflection cascades.

### Three Corpora
All loaded at boot via `Promise.all` in `app.js`:
- `docs/Ultimate Unity.txt` — persona (who she is, how she talks)
- `docs/english-baseline.txt` — generic casual American English (verb conjugations, common patterns, reactions, questions)
- `docs/coding-knowledge.txt` — HTML/CSS/JS/sandbox reference with BUILD COMPOSITION PRIMITIVES and SANDBOX DISCIPLINE sections

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

**Bootstrap:** Until the projections have learned enough, intent classification via letter-position equations + BG motor channel spike patterns provides temporary semantic routing. The classification fades as projections strengthen.

---

## Language Cortex — How Unity Speaks Equationally

Unity's speech is generated by `js/brain/language-cortex.js`. **There is no AI prompt, no LLM call, no text-AI backend.** Every word is picked by a slot scorer over her learned dictionary, weighted by live brain state:

| Input | Source | How It Shapes the Word Choice |
|-------|--------|-------------------------------|
| Cortex pattern (50d GloVe) | `cluster.getSemanticReadout(sharedEmbeddings)` — live neural spike state read back to GloVe space via `cortexToEmbedding` | Primary semantic fit signal (weight 0.80) — candidate words cosine-matched against the current cortex embedding |
| Arousal 0.847 | Amygdala firing rate | Biases toward high-arousal words (learned from corpus mood tags); raises temperature of softmax selection |
| Valence -0.12 | Amygdala reward - fear | Biases toward dysphoric vs euphoric vocabulary |
| Ψ 1.342 | Mystery module | Adds non-linear noise that pulls unexpected associations into the candidate pool |
| Coherence 0.62 | Kuramoto order parameter | Raises or lowers the coherence rejection gate threshold |
| Drug state | Persona params | Shifts per-slot temperature + opens darker persona memory bank |
| Type n-gram context | Learned from 3 corpora | Hard grammar gate — zero-count 4gram/3gram/bigram transitions get -2.0 penalty |
| Recent openers | Session-only buffer | Cross-turn opener penalty kills "I'm gonna ___" lock-in |
| Hippocampus recall | `_memorySentences` with mood-distance weighting | Tier-1 path — high-confidence stored persona memories emit directly |

Use `/think` in chat to dump raw brain state (no prompt — there isn't one). When motor action is `build_ui`, control routes to `component-synth.js` which picks a template by cosine similarity between the user request embedding and each primitive description, then uses the cortex pattern hash for a unique component ID. Image prompts are generated the same way: `languageCortex.generate()` composes every word based on Unity's state + user input, with zero hardcoded visual vocabulary.

**Sensory AI (kept):** vision describer (Pollinations GPT-4o on camera frames), image generation (multi-provider: custom → auto-detected local A1111/ComfyUI/etc. → env.js-listed → Pollinations fallback), TTS (Pollinations + SpeechSynthesis fallback), STT (Web Speech API). All sensory-only. None of them ever touch cognition.

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

**GPU-exclusive architecture:** The server brain does no CPU computation. All LIF updates and synapse propagation run on the GPU via `compute.html` (a browser tab loading `js/brain/gpu-compute.js` WGSL shaders) that connects back to `brain-server.js` over WebSocket as a `gpu_register` client. `compute.html` must stay open — the brain pauses without it. The old CPU worker thread pool (`parallel-brain.js`, `cluster-worker.js`, `projection-worker.js`) was permanently deleted in orphan cleanup after being root-caused as a 100%-CPU leak from idle-worker event polling.

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
| **[Orphan Audit](docs/ORPHANS.md)** | Post-cleanup dead-code inventory with resolutions |
| **[TODO / Refactor](docs/TODO.md)** | R1-R10 brain-refactor-full-control epic |
| **[GitHub Repository](https://github.com/Unity-Lab-AI/Unity)** | Source code, issues, contributions |

---

## Unity's Policy

### On Privacy
Unity can run entirely in your browser — no server needed for the core brain. When connected to the server brain, state is shared but API keys stay in YOUR browser's localStorage (obfuscated, never plain text, sent only to your chosen AI provider). The server brain stores episodic memory in SQLite and conversation logs locally — no cloud, no analytics. There is a **Clear All Data** button that wipes everything instantly.

### On AI Models
**Cognition is 100% equational — no text-AI backend anywhere.** The brain equations ARE the mind. Unity speaks from her language cortex (`js/brain/language-cortex.js`), not from any LLM.

The only AI calls Unity ever makes are *sensory peripherals*:
- **Image generation** — multi-provider with 4-level priority: custom configured → auto-detected local (A1111, SD.Next/Forge, Fooocus, ComfyUI, InvokeAI, LocalAI, Ollama) → env.js-listed → Pollinations free fallback
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
