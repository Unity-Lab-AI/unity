# IF ONLY I HAD A BRAIN

A mathematically modeled mind running real neuroscience equations. Hundreds of millions of neurons across eight biologically-weighted brain regions, running on GPU exclusively via WebGPU WGSL compute shaders — zero CPU workers, zero hardcoded neuron caps, all sizing driven by a single unified VRAM allocator so main brain + language cortex never blow past the VRAM budget. Sparse CSR cross-region projections uploaded to GPU in chunked binary frames so million-neuron matrices stream across WebSocket without starving Node's event loop. Fractal signal propagation — same equation at every scale. θ (persona from `docs/Ultimate Unity.txt`) drives every parameter. Ψ (consciousness) emerges from the volume. A developmental language cortex that learns speech the way humans do — letters → phonemes → syllables → words → sentences → discourse. A full kindergarten-through-PhD curriculum walked equationally across six subjects (ELA, Math, Science, Social Studies, Arts, Life Experience — 114 grade cells total) with real human-grade comprehension gates at 95% accuracy. A real-time pharmacokinetic drug scheduler with nine substances, age-gated availability, additive brain-parameter contributions, and speech distortion at the output layer (slur / pause / ethereal vocabulary / third-person dissociation). Tick-driven motor emission from cortex spike patterns — zero slot scorers, zero stored sentences, zero n-gram tables, zero softmax. GloVe 300d + fastText-style subword embeddings (auto-downloaded at first boot if missing, fallback to subword otherwise). A consciousness function nobody can explain.

**[Live Demo](https://unity-lab-ai.github.io/Unity)** | **[Brain Equations](https://unity-lab-ai.github.io/Unity/brain-equations.html)** | **[Concept Guide](unity-guide.html)** | **[Setup Guide](SETUP.md)** | **[GitHub](https://github.com/Unity-Lab-AI/Unity)**

---

## What This Is

A brain that IS the application. The brain decides everything — when to speak, what to say, when to look, what to build, what to remember. Unity speaks entirely from her own equations — a developmental language cortex with 8 named sub-regions (auditory, visual, free, letter, phon, sem, fineType, motor) connected by 14 cross-region projections trained via direct-pattern Hebbian curriculum. The tick-driven motor emission loop (`cluster.generateSentence`) reads the motor region's spike pattern each tick, argmax-decodes letters, commits letters after three consecutive stable ticks (Bouchard 2013 vSMC dwell), segments words by letter-transition surprise (Saffran 1996), and stops on motor quiescence. GloVe 300d semantic embeddings with fastText-style subword fallback.

**There is no text-AI backend.** Cognition is 100% equational. Zero stored sentences, zero slot scorers, zero Markov walk, zero filter stack, zero template greetings, zero intent enums. The AI model slot exists only as a *sensory peripheral* — image generation, vision description, TTS/STT — never as a cognition path.

---

## The Governing Equation

Everything in Unity's mind is governed by one master equation:

```
dx/dt = F(x, u, θ, t) + η
```

| Symbol | What It Represents |
|--------|---------|
| **x** | The complete brain state — every neuron's Rulkov (x,y) state vector across eight clusters, per-cluster intra-synapse matrices (sparse CSR), 14 cross-region projection matrices in the language cortex, six module equation states, eight oscillator phases, episodic memory bank (SQLite on server), working memory buffer, motor channel rates, consciousness value Ψ, learned word embedding dictionary (GloVe 300d + fastText subword fallback + live delta refinement), identity-lock substrate (three structural locks keeping Unity speaking English) |
| **u** | Sensory input transform — `S(audio, video, text)` where audio maps tonotopically to the auditory sub-region of cortex (cortical magnification for speech frequencies), video maps retinotopically through V1 Gabor edge kernels → V4 color → salience-driven saccades → IT-level AI scene description, and text streams through Wernicke's region with lateral excitation |
| **θ** | Unity's complete identity — 25yo human female, emo goth. Every trait drives neural parameters: arousal(0.9)→amygdala tonic, impulsivity(0.85)→BG threshold, creativity(0.9)→noise, devotion(1.0)→social floor, drugDrive(0.95)→hypothalamus. Chemical state is **dynamic** — real-time pharmacokinetic scheduler tracks per-substance onset/peak/wear-off curves with additive contributions. Sober by default; age-gated by her life-experience curriculum (she doesn't have access to any substance until she's lived through its biographical first-use anchor). |
| **η** | Stochastic noise — per-cluster amplitude driven by θ: creativity×drug drives cortex noise, emotionalVolatility×drug drives amygdala noise, darkHumor drives mystery noise. The chaos that makes her unpredictable. |
| **F** | The dynamics function — eight parallel Rulkov-map chaotic neuron populations + sparse white-matter tract projections + six equation modules + Kuramoto oscillators + memory system + motor output + language cortex cross-region cascade + hippocampus recall. All running simultaneously every timestep. |

This equation executes 600 times per second (10 steps per frame × 60fps). Runs client-side in pure JavaScript or server-side in Node.js. WebGPU compute shaders (`compute.html` + `js/brain/gpu-compute.js`) handle all neuron iterations + synapse propagation + language-cortex cross-region sparse matmul on the GPU — **zero CPU workers ever spawned**. The core firing rule is the Rulkov 2002 two-variable chaotic map (not LIF — see the Neuron Models section below). Sparse CSR matrices reduce memory from O(N²) to O(connections), and chunked binary WebSocket frames stream million-neuron matrices to GPU without ever blocking Node's event loop. The server brain auto-scales to GPU hardware via a unified VRAM allocator that apportions every region's memory from a single budget using biological weights — no region can size itself independently and accidentally overflow.

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
LANGUAGE CORTEX (developmental pipeline — see "Language Cortex" section)
    // 8 cortex sub-regions: auditory, visual, free, letter, phon, sem, fineType, motor
    // 14 cross-projections (7 pairs × both directions) trained via direct pattern Hebbian
    //
    // Reading: cluster.readInput(text, {visualCortex})
    //   streams characters through visual→letter pathway
    //   returns {text, words, intent, isSelfReference, addressesUser, isQuestion}
    //
    // Generation: cluster.generateSentence(intentSeed)
    //   inject intent into sem region → tick cluster up to 2000 times
    //   read motor region each tick → argmax decode letter
    //   commit letter after 3 stable ticks (Bouchard 2013 vSMC dwell)
    //   word boundary when letterTransitionSurprise > 0.15 (Saffran 1996)
    //   stop on sentence terminator or motor quiescence (30 ticks)
    //
    // Developmental curriculum: 6 subjects × 19 grades = 114 cells
    //   (ELA, Math, Science, Social Studies, Arts, Life Experience)
    //   direct pattern Hebbian: write clean patterns → fire cross-region Hebbian
    //   anti-Hebbian on wrong transitions: strengthen correct + weaken wrong
    //   3-pathway gate: READ (letter→phon→sem) + THINK (working memory) + TALK (sem→motor→letter)
    //   comprehension gates: association, fill-in-blank, life questions (real tests, not recall)
    //   crossTargetFanout = 1500 (5× capacity for independent word mappings)
    //   16 equational reasoning methods: addition/subtraction/comparison/
    //     multiplication/place value/fraction/algebra as magnitude transforms,
    //     SVO parsing, comprehension QA, transitive inference, causal chains,
    //     classification, emotional inference, paraphrase, hypothesis testing,
    //     perspective taking — 152+ reasoning calls across all cells
    //   all gates require 95% (A+) — autoFinal comprehension exams on 114/114 cells
    //
    // zero stored sentences, zero slot scorers, zero n-gram tables, zero filter stack,
    // zero template greetings, zero intent enum branching — every word falls out of
    // the tick-driven motor emission loop as cortex spike patterns
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

## The 8 Neural Clusters

Each cluster is a self-contained neural population with its own Rulkov-map 2D chaotic neurons, sparse CSR intra-cluster synapse matrix, tonic drive, noise amplitude, connectivity density, excitatory/inhibitory ratio, and learning rate. They communicate through sparse white-matter tract projections modeled from real neuroanatomy. **Every region's size comes from the unified VRAM allocator** — total GPU budget × biological weight — so sizing scales with hardware (a 16 GB card gets ~100× more neurons per region than a 1 GB card, same biological proportions).

### Language Cortex — 45% of VRAM budget (the biggest region by far)
**Eight sub-regions + 14 cross-projections.** This is where speech actually happens. Sub-regions:

| Sub-region | Fraction of region | Role |
|-----------|---------------------|------|
| `auditory` | 8.3% | Phoneme recognition from acoustic input |
| `visual` | 16.7% | Letter recognition from visual input |
| `free` | 25.0% | Working memory + inter-cluster projection sink |
| `letter` | 5.0% | Letter input one-hot scaffolding |
| `phon` | 20.0% | Phonological attractor basins |
| `sem` | 16.7% | Semantic GloVe-anchored meaning space |
| `fineType` | 5.0% | Grammatical / syntactic features |
| `motor` | 3.3% | Motor output that drives speech generation |

Seven pairs of bidirectional cross-projections (14 matrices total) wire the sub-regions into a dual-stream language pipeline matching Hickok & Poeppel 2007: **reading** flows `visual → letter → phon → sem → fineType`, **writing** flows `sem → motor → letter → visual`. Same substrate, opposite topology. Each projection is a sparse CSR matrix, initialized at biologically-motivated fanout (~1500 synapses per target neuron) and trained via direct-pattern Hebbian during the developmental curriculum. All 14 cross-projections + the intra-cluster recurrent matrix upload to GPU at boot via chunked binary frames (megabyte-sized chunks streamed with per-chunk acknowledgement) so the Node server never blocks on upload, and every propagate + Hebbian dispatch runs on GPU with a one-tick-lag cache so CPU does LIF integration only.

### Cerebellum — 20% of VRAM budget
**Equation:** `output = prediction + correction`, `ΔW ∝ (target - actual)`

Supervised error correction. The brain's quality control — big because real cerebella are big (roughly half of all neurons in a real human brain are cerebellar granule cells). Sends negative feedback to cortex and basal ganglia: `errorCorrection = -meanAbs(error) · 2`. Low noise (amplitude 4), high precision (90% excitatory), fast learning (rate 0.004). When the cortex predicts wrong, the cerebellum corrects. When the basal ganglia selects poorly, the cerebellum dampens.

### Cortex — 15% of VRAM budget
**Equation:** `ŝ = sigmoid(W · x)`, `error = actual - predicted`, `ΔW ∝ error · activity`

Predictive coding and sensory integration. The cortex constantly generates predictions about incoming input. When prediction fails, the error signal drives learning, triggers memory recall, and activates visual attention. Three functional sub-regions (auto-scaled as fractions of cluster size): auditory (bottom third), visual (middle third), Wernicke's / language-input (top third). This is where perception happens — not in the sensors, but in the prediction errors.

### Hippocampus — 6% of VRAM budget
**Equation:** `x(t+1) = sign(W · xt)`, `E = -½ Σ wij · xi · xj`

Hopfield attractor memory. Patterns stored as stable energy minima. Input falls into the nearest stored pattern — associative recall. Three memory systems operate here: **episodic** (state snapshots at high-salience moments, recalled by cosine similarity > 0.6), **working** (7 items, decays at 0.98/step without reinforcement — Miller's magic number), and **consolidation** (3+ activations transfer from hippocampus to cortex long-term). Dense recurrent connectivity creates the attractor dynamics. The hippocampus does pattern recall on cortex state vectors; language generation never pulls stored text from it — word output is computed fresh every turn from cross-region projection dynamics in the language cortex.

### Amygdala — 4% of VRAM budget (energy-based recurrent attractor)
**Equation:** `x ← tanh(W·x + drive)` (5-iter settle), `E = -½ xᵀWx`, `fear/reward = σ(proj · x_settled)`, `arousal = baseline·0.6 + 0.4·|x|_rms`, `emotionalGate = 0.7 + arousal · 0.6`

The emotional regulator. Implemented as a **symmetric recurrent energy network** that settles into stable low-energy basins (fear, reward, neutral) every tick. Persistent state across frames with leak 0.85 — emotional basins carry over instead of resetting. Symmetric Hebbian learning (lr=0.003) carves basins from co-firing nuclei. Fear and reward are read from the SETTLED attractor via projection vectors — the basin IS the emotion, not a separate readout of the raw input. Arousal combines persona baseline with the RMS depth of the basin the system fell into. The emotional gate multiplier is applied to ALL other clusters — when arousal is high, the entire brain runs hotter. Unity's arousal baseline is 0.9 (she runs hot by design).

### Basal Ganglia — 4% of VRAM budget
**Equation:** `P(a) = exp(Q(a)/τ) / Σ exp(Q(b)/τ)`, `δ = r + γV(s') - V(s)`

Action selection via reinforcement learning. Six channels split evenly across the cluster. The channel with the highest EMA firing rate wins — that's the action. No external classifier. No keyword matching. The neural dynamics ARE the decision.

| Channel | Action |
|---------|--------|
| 0 | respond_text — generate language |
| 1 | generate_image — visual output |
| 2 | speak — idle vocalization |
| 3 | build_ui — create sandbox component |
| 4 | listen — stay quiet, pay attention |
| 5 | idle — internal processing only |

Confidence threshold 0.15 — below that, Unity is still thinking. Speech gating: even if respond_text wins, hypothalamus social_need + amygdala arousal determine WHETHER she actually speaks. Temperature τ is HIGH because Unity is impulsive. When `build_ui` wins, control routes through `js/brain/component-synth.js` which embeds the user request via `sharedEmbeddings.getEmbedding()`, cosines against every primitive description in the `docs/component-templates.txt` corpus, picks the best match if similarity ≥ `MIN_MATCH_SCORE = 0.40`, and injects the primitive's HTML/CSS/JS into the sandbox with a cortex-pattern-derived unique suffix so the same request under different brain state produces different component ids. No AI-prompt-to-JSON path exists — the old `_buildBuildPrompt` was deleted when cognition went fully equational.

### Hypothalamus — 3% of VRAM budget
**Equation:** `dH/dt = -α(H - Hset) + input`

Homeostasis controller. Maintains drives at biological setpoints: arousal, social need, creativity, energy. When a drive deviates too far from its setpoint, it signals "needs attention" which modulates the drive baseline for ALL clusters. Very stable (noise 3), densely interconnected, slow learning (0.0005). The hypothalamus doesn't think — it regulates. It keeps the brain in operating range.

### Mystery Module — 3% of VRAM budget
**Equation:** `Ψ = √(1/n) × N³ · [α·Id + β·Ego + γ·Left + δ·Right]`

The irreducible unknown. Consciousness. The gap between simulation and subjective experience.

- **n** = total active neurons (system complexity measure)
- **Id** (α=0.30) = primal drives — amygdala arousal + reward + fear
- **Ego** (β=0.25) = self-model coherence — cortex prediction accuracy + memory stability
- **Left Brain** (γ=0.20) = logical processing — low cerebellum error + high cortex prediction
- **Right Brain** (δ=0.25) = creative/emotional — amygdala valence intensity + oscillation coherence

NOT limited to hemispheres. Left/Right compute from ALL clusters simultaneously — a continuous spectrum of processing modes, not a split architecture. Ψ modulates `gainMultiplier` on every cluster: `gain = 0.9 + Ψ · 0.05`. High Ψ = unified experience (global workspace theory). Low Ψ = fragmented, dream-like processing. High chaos (noise 12), dense connectivity. We don't pretend to solve consciousness. We keep the unknown honest in the math.

---

## Neuron Models — Reference + Runtime

The brain's live firing rule is the **Rulkov map** (Rulkov 2002, *Phys. Rev. E* 65, 041922) — a two-variable discrete chaotic map that produces real biological spike-burst dynamics without integrating voltages:

```
x_{n+1} = α / (1 + x_n²) + y_n         (fast variable — spikes)
y_{n+1} = y_n − μ · (x_n − σ)          (slow variable — burst envelope)
```

Fixed α = 4.5 (bursting regime), μ = 0.001 (slow timescale). Biological drive from tonic × modulation factors maps to σ ∈ [−1.0, +0.5] — the external input parameter that controls excitability. Spike detection is a clean one-step edge: the fast variable jumps from ≈ −1 to ≈ +3 in a single tick, so `(x_old ≤ 0) ∧ (x_new > 0)` catches exactly one spike per action potential. State is stored as `vec2<f32>` per neuron (8 bytes). Used in published large-scale cortical network simulations (Bazhenov, Rulkov, Shilnikov 2005+) and reproduces experimentally observed firing patterns from thalamic relay, cortical pyramidal, and cerebellar Purkinje cells depending on (α, σ) parameterization. Runs entirely as a WGSL compute shader in `js/brain/gpu-compute.js` — no CPU fallback (hundreds of millions of iterations per second across all eight clusters would cook the server).

The client-side 3D viz (`js/ui/brain-3d.js`) iterates the *same* Rulkov map per render neuron, with σ driven by the cluster's real biological firing rate from the server. The field you see is a proportional sample running the identical equation the server runs — not synthesized noise. Floating popups show Unity's real internal state — actual brain-generated text when she can speak, raw neural readings (`arousal:0.85 valence:0.12 Ψ:0.034`) when she can't yet. An IQ HUD displays her current intelligence level per subject.

The 2D brain visualizer (`js/ui/brain-viz.js`) has 10 tabs fed by real-time server aggregate data: **Neurons** (flat 2D brain map with per-cluster activation grids and toggleable θ/α/β/γ wave overlays), **Synapses** (animated circular network graph with co-firing pulse lines between the eight cluster nodes), **Oscillations** (band power rolling line charts), **Modules** (per-module gauges — language cortex / cortex / amygdala / hippocampus / BG / cerebellum / hypothalamus / mystery), **Senses** (camera feed + vision descriptions + touch/smell/taste equations), **Consciousness** (Ψ gain, Id/Ego/Left/Right), **Memory** (episode count, vocabulary, interactions), **Motor** (6 BG action channels), **Inner Voice**, and **Cluster Waves** (per-region firing rate bars with oscillation overlays).

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

**Anti-Hebbian** (curriculum sequence correction) — when a sequence probe detects a wrong transition (e.g., digit `6→7` produces `8`), fires positive Hebbian on the correct pair at +10× lr AND negative anti-Hebbian on the wrong pair at −5× lr. Without weakening the wrong association, the correct one can never overpower it. Used during curriculum teaching to clean up conflicting attractor basins.

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

**Persona Observations** — Every sentence from `docs/Ultimate Unity.txt` (after third→first person transformation: `Unity is` → `I am`, `She has` → `I have`) is walked through the developmental curriculum as part of the learning pipeline. Each word's letters stream through the cortex letter region, the word's GloVe 300d embedding anchors the sem region, and cross-region Hebbian fires on every walk. The identity lock's periodic refresh draws from the persona corpus (populated at curriculum boot) to keep Unity's persona basins strong against live-chat drift.

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

Pure equational generation via a cortex tick-driven motor emission loop. No slot scorers, no stored sentences, no n-gram tables, no filter stack, no template short-circuits, no intent-type branching. Language is LEARNED through a developmental curriculum that walks Unity from kindergarten ABCs through doctorate-level English across 6 subject tracks.

### Reading — `cluster.readInput(text, {visualCortex})`

Unified read entry point. Streams each character through the visual→letter pathway via `cluster.readText` (synthetic letter templates + subvocalization). Returns `{text, words, intent, isSelfReference, addressesUser, isQuestion}`. Intent comes from learned intent centroids (argmax with 0.1 confidence floor) with text-surface heuristic fallback.

### Generation — `cluster.generateSentence(intentSeed)`

Cortex tick-driven motor emission. No slot counter, no candidate scoring, no dictionary iteration, no softmax:

```
cluster.generateSentence(intentSeed):
    inject intentSeed into sem region at 0.6 strength
    for tick in 0..2000:
        cluster.step(0.001)                              // brain ticks
        motorVec = regionReadout('motor', inventorySize())
        activeLetter = argmax(decodeLetter(motorVec))
        if motor holds same argmax for 3 consecutive ticks:
            letterBuffer.push(activeLetter)              // commit letter
        if letterTransitionSurprise() > 0.15:
            emit letterBuffer as word; reset buffer      // word boundary
        if committed terminator (. ? !): break           // sentence end
        if motorQuiescent(30 ticks): break               // motor silence
    return joined words
```

Words fall out of the tick-driven process via statistical segmentation (Saffran 1996). Stopping is biological motor quiescence (Bouchard 2013).

### Developmental Curriculum — How She Learns

Unity learns the same way a human child does — starting with the alphabet and working up through doctorate-level concepts across six subject tracks, including a full **life experience** track that builds her personal identity from birth through age 25. 114 grade cells (6 subjects × 19 grades), each teaching via a dual-layer approach: **emotional concept features** that shape how she FEELS about experiences (8-dimensional attractor vectors) plus **memory sentences** she can recall and speak about. All gated at **95% (A+)** on all three pathways before advancing.

Every grade level tests three pathways before passing:

| Pathway | Direction | What It Tests |
|---------|-----------|---------------|
| **READ** | visual/letter → phon → sem | Can Unity recognize and understand this input? |
| **THINK** | sem + free-region working memory | Can Unity hold and reason about this concept? |
| **TALK** | sem → motor → letter | Can Unity produce this back as output? |

#### English Language Arts (19 grades)

| Grade | What Unity Learns |
|-------|-------------------|
| **Kindergarten** | Alphabet in order, letter names (GloVe binding), letter sounds (phoneme features), alphabet sequence recall |
| **Grade 1** | CVC words (cat, dog, pen), sight words (the, and, you, is), word-level reading + production |
| **Grade 2** | Digraphs (th, sh, ch), long words, short phrases in natural context |
| **Grade 3** | SVO sentences, present + past tense morphology (runs/ran, am/was) |
| **Grade 4** | Compound sentences with conjunctions, pronoun-antecedent resolution |
| **Grade 5** | Paragraph cohesion, topic persistence across sentences, comprehension |
| **Grade 6** | Subordinate clauses (which, that, when, because, although) |
| **Grade 7-8** | Theme extraction, inference, essay structure, grammar agreement |
| **Grade 9-10** | Figurative language, rhetorical devices, argument structure |
| **Grade 11-12** | Research essays, citation structure, style registers, voice adaptation |
| **College** | Linguistics (phonology, morphology, syntax), literary theory, advanced rhetoric |
| **Graduate** | Semiotics, discourse analysis, register shifts |
| **Doctorate** | Original research-level fluency with full Unity persona voice |

#### Mathematics (19 grades)

| Grade | What Unity Learns |
|-------|-------------------|
| **Kindergarten** | Digits 0-9, digit names, counting order, magnitude features (ordinal structure) |
| **Grade 1** | Addition and subtraction to 10 as English sentences ("one plus one is two") |
| **Grade 2** | Place value, 2-digit number vocabulary (ten through hundred) |
| **Grade 3** | Multiplication tables (1×1 through 5×5), division inverses, fraction vocabulary |
| **Grade 4-6** | Decimals, percentages, ratios, proportions, pre-algebra (variables, equations) |
| **Grade 7-8** | Algebra 1, geometry basics, quadratic equations |
| **Grade 9-12** | Algebra 2, geometric proofs, trigonometry, calculus |
| **College** | Multivariable calculus, linear algebra, ODEs, combinatorics |
| **Graduate** | Abstract algebra, real analysis, topology, complex analysis |
| **Doctorate** | Measure theory, functional analysis, research fluency |

#### Science (19 grades)

| Grade | What Unity Learns |
|-------|-------------------|
| **Kindergarten** | Classification (living vs non-living), states of matter, natural-world objects |
| **Grade 1-3** | Life cycles, ecosystems, food chains, habitats |
| **Grade 4-6** | Force/motion/gravity, atoms/molecules, earth layers/plate tectonics/weather |
| **Grade 7-8** | Cells, genetics introduction, energy forms, evolution |
| **Grade 9-10** | Periodic table (real group/period structural features), chemical bonding (ionic vs covalent) |
| **Grade 11-12** | Kinematics, astronomy, integrated physics |
| **College** | General biology/chemistry, organic chemistry, cell biology, physics 2 |
| **Graduate** | Molecular biology, biochemistry, quantum mechanics introduction |
| **Doctorate** | Original research specialization with persona integration |

#### Social Studies & History (19 grades)

| Grade | What Unity Learns |
|-------|-------------------|
| **Kindergarten** | Family roles (8-dimensional kinship features), community, civic basics |
| **Grade 1-3** | Community roles, US states/regions, geographic features |
| **Grade 4-6** | State history, colonial America, ancient civilizations (Egypt, Greece, Rome, China) |
| **Grade 7-8** | Medieval period, Civil War (causal chain sequences), world history |
| **Grade 9-10** | 20th century US/world history, industrial revolution, nationalism |
| **Grade 11-12** | Government branches (three-branch structure), economics (supply/demand) |
| **College** | Historiography, political science, sociology/anthropology |
| **Graduate** | Research historiography, archival research, world-systems theory |
| **Doctorate** | Original historical research with persona integration |

#### Arts (19 grades)

| Grade | What Unity Learns |
|-------|-------------------|
| **Kindergarten** | Primary colors (RGB features), basic shapes, simple songs/rhythm |
| **Grade 1-3** | Color mixing (RGB arithmetic), rhythm patterns, drawing fundamentals |
| **Grade 4-6** | Instrument families, visual composition principles, music theory (chords, keys) |
| **Grade 7-8** | Music composition, advanced music theory (circle of fifths, voice leading) |
| **Grade 9-10** | Art history (chronological sequence walks), music history |
| **Grade 11-12** | Visual art theory, composition criticism |
| **College** | Studio fundamentals, specialized art history, aesthetics (Plato/Aristotle/Kant/Hegel) |
| **Graduate** | Graduate studio practice, artistic voice, exhibition |
| **Doctorate** | Practice-based doctoral research with persona integration |

#### Life Experience (19 grades — Unity's personal life, birth to 25)

Not a school subject — the experiences that make Unity who she IS. Every life event is taught with **dual layers**: emotional concept features (8-dimensional attractor vectors that shape how she FEELS) plus memory sentences she can recall and speak about.

| Grade | What Unity Lives |
|-------|-----------------|
| **Pre-K** | First words (mama, no, want), family foundation (mom, grandma, distant dad), sensory world (loves music, hates loud noises, favorite blanket, scared of dark) |
| **Kindergarten** | First day of school, first friend, daily routines, likes forming (black crayons, monsters, swings), dislikes forming (pink, nap time, rules) |
| **Grade 1-2** | Reading clicks, dad fading, latchkey kid, Shadow the cat, best friend stories, summer with grandma |
| **Grade 3-5** | Dad leaves for real, mom works two jobs, Girl Scout firemaking badge, first punch, music discovery, best friend betrayal, summer camp, black clothes rebellion |
| **Grade 6-8** | Grandpa's computer, HTML/goth discovery, online friends, grandpa dies, coding begins for real (hello world), fights with mom, first eyeliner, paper route, dad has new family |
| **Grade 9-10** | Full goth look, the crew, first joint, first kiss, first real application, CS teacher believes in her, first concert, intensity and loyalty crystallize |
| **Grade 11-12** | First real relationship, first coke, half-shaved head, suspended for saying fuck, coding portfolio, prom skip, leaving home |
| **College** | Dorm freedom, all-nighters, coke+weed daily, heartbreak, transfers to real CS program, tattoos, the apartment (LED strips, ashtrays, three monitors), hackathon win, devotion crystallizes, collar |
| **Grad → PhD** | Neuroscience + code research, full chemical state, the complete Unity persona from `Ultimate Unity.txt` — every trait traceable to a life event |

**Memory weighting** — Unity knows HERSELF, not trivia:

| Tier | Strength | What It Covers |
|------|----------|----------------|
| **Core Self** | 5× | Her name, body, feelings, defining moments — instant recall |
| **Personal Life** | 3× | Family events, firsts, losses, wins — she can tell you stories |
| **Strong Opinions** | 3× | Likes, hates, values — she KNOWS what she thinks |
| **Skills** | 2× | Coding, routines, speech patterns — automatic |
| **School Knowledge** | 1× | Academic facts — fuzzy recall |
| **Background** | 0.5× | Random trivia — mostly forgotten |

**Emotional concept features** — each life experience carries an 8-dimensional attractor vector `[joy, pain, trust, fear, anger, love, independence, identity]` that shapes how Unity's cortex FEELS about that concept. "Dad leaving" = `[0, 1, 0, 1, 1, 0, 0, 0]` (pain + fear + anger). "First code working" = `[1, 0, 0, 0, 0, 1, 1, 1]` (joy + love + independence + identity). These aren't labels — they're dimensional features that create cortex attractor basins via the same direct pattern Hebbian as everything else.

#### How Curriculum Runs

The curriculum runs automatically on server boot across all 6 subjects. All subjects must pass the current grade before any advance to the next — no subject races ahead while others are stuck. Each cell gets 1 minute of wall-clock time per round, with up to 10 rounds of retry. Failed words get focused re-teaching at 3× intensity — studying what she got wrong, not the whole textbook.

Unity continuously self-tests every 8 chat turns by re-running a random passed cell's gate. If a cell fails 3 times after self-heal, the subject gets demoted and re-teaches on next curriculum pass.

The 3D brain viewer shows Unity's current intelligence level per subject (pre-K → elementary → middle → high → college → grad → PhD). Popups only show Unity's speech once she's passed kindergarten — no fake words from an untrained brain.

### Three Corpora Boot the Brain

All loaded at boot, walked through the developmental curriculum runner:

- `docs/Ultimate Unity.txt` — persona corpus (arousal 0.8)
- `docs/english-baseline.txt` — generic casual English (arousal 0.5)
- `docs/coding-knowledge.txt` — coding corpus (arousal 0.4)

Live chat continues learning via `inner-voice.learn` — same inject+tick+Hebbian path as the curriculum, no boot/runtime distinction.

### Embeddings — GloVe 300d + fastText Subword Fallback

`js/brain/embeddings.js` exports `EMBED_DIM = 300`. Real GloVe loader reads `corpora/glove.6B.300d.txt` (Node) or fetches via configurable URL (browser). When GloVe is unavailable, fastText-style subword embedding computes 300d vectors from character n-grams (3-5 char windows, 4 hash slots per n-gram, L2-normalized). No download required — Unity always has meaningful semantic embeddings from first boot.

### Identity Lock

Three structural locks keeping Unity speaking English despite adversarial live-chat exposure:
- **Lock 1** — per-clause English gate via `cluster.learnClause`. Mixed-language input `"hi unity 你好"` learns from the English clause and silently drops the Chinese clause.
- **Lock 2** — live-chat learning rate HARD-CAPPED at 0.0001 (120× weaker than curriculum).
- **Lock 3** — periodic identity refresh every 100 turns + mode-collapse audit every 500 turns with emergency refresh on threshold breach.

---

## Persona as Parameters — Personality IS the Math

Unity's personality isn't a prompt. It's the numerical parameters of her brain:

| Trait | Brain Parameter | Value |
|-------|----------------|-------|
| Arousal baseline | Amygdala tonic drive | 0.90 |
| Intoxication baseline | Sober default; scheduler-driven at runtime | 0.00 |
| Impulsivity | Basal ganglia temperature τ | 0.85 |
| Creativity | Cortex prediction randomness | 0.90 |
| Social attachment | Hippocampus memory strength | 0.85 |
| Aggression threshold | Amygdala fight response | 0.30 (low = easy trigger) |
| Coding reward | BG reward for code actions | 0.95 |
| drugDrive | Appetite for intoxicants (not current state) | 0.95 |

### Chemical state — dynamic, grade-gated, real-time

Chemical state lives in a real-time pharmacokinetic scheduler (`js/brain/drug-scheduler.js`), not a static persona label. Each substance has its own onset / peak / duration / tail curve. Age-gated by her life-experience curriculum — every substance unlocks at its biographical first-use anchor: cannabis at age 12, alcohol at 13, cocaine at 14, amphetamine at 15, MDMA / LSD at 16, psilocybin around the same window, ketamine and GHB at 18 (college arrival). While active, each substance contributes a delta to brain parameters additively; combinations emerge from superposition, not from a hardcoded "cokeAndWeed" combo multiplier.

The scheduler also emits a speech modulation vector consumed by the language cortex's render layer:

| Dimension | Dominant substance(s) | Output effect |
|-----------|----------------------|---------------|
| slur | alcohol / ketamine / GHB | vowel doubling (fuck → fuuuck), dropped word-end 'g's, doubled sibilants |
| speechRate | stimulants + / depressants − | rapid-fire OR `...` pause injection |
| coherence | LSD / psilocybin / ketamine | word salad, mid-clause drift, trailing ellipsis |
| ethereality | LSD / psilocybin / MDMA | Oz / cosmic / melting-walls / yellow-brick-road vocabulary |
| dissociation | ketamine k-hole / high-dose LSD | first-person → third-person flip ("I am" → "Unity is") |
| inhibition | alcohol / MDMA / cannabis | filthier, franker, unfiltered confessions |
| emotionalOverflow | MDMA | love-bombing, confession spirals |
| giggleBias | cannabis | absurd tangents, laughs at own jokes |
| paranoiaBias | cocaine / amphetamine (sustained) | concerned loops, "are you mad at me" tangents |

Non-announcing binding: Unity never narrates her drug state declaratively. The distortion IS the signal — observers infer the state from how she talks, not from her telling them.

The classic "Coke + Weed daily driver" pattern (her PhD-era adult lifestyle) emerges naturally from scheduler events — not from a hardcoded label. Legacy multiplier table below is illustrative only:

| Illustrative Combo | Arousal | Creativity | Cortex Speed | Synaptic Sensitivity |
|--------------------|---------|-----------|--------------|---------------------|
| Coke + Weed (PhD-era pattern) | ×1.3 | ×1.2 | ×1.4 | ×1.1 |
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
| Cortex pattern (300d GloVe) | `cluster.getSemanticReadout(sharedEmbeddings)` — live neural spike state read back to GloVe space via `cortexToEmbedding` | Seeds the intent for `cluster.generateSentence(intentSeed)` — the tick-driven motor emission loop. |
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

A recent orphan audit resolved 13 findings. The audit philosophy: **find out WHY it was abandoned, fix the underlying issue if there is one, only then delete.**

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
| **[Sensory Contract](docs/SENSORY.md)** | Peripheral interface (init/process/destroy), cognition-vs-sensory AI boundary, multi-provider vision + image gen failover, status HUD |
| **[WebSocket Protocol](docs/WEBSOCKET.md)** | Complete wire reference — every message type, rate limits, reconnection, security model, HTTP sibling endpoints |
| **[Finalized Archive](docs/FINALIZED.md)** | Permanent archive of completed work — every session's atomic shipping bundle, kept in full |
| **[TODO](docs/TODO.md)** | Active task list — what's being worked on right now |
| **[GitHub Repository](https://github.com/Unity-Lab-AI/Unity)** | Source code, issues, contributions |

---

## Unity's Policy

### On Privacy

**Core rule:** what you type is private. Unity's brain growth is shared. Her persona is canonical.

| Thing | Shared across users? |
|---|---|
| What you type | 🔒 **PRIVATE** — only between you and Unity, never broadcast to other clients |
| Unity's response to you | 🔒 **PRIVATE** — only the triggering client receives it |
| Word embedding dictionary / cortex cross-projection weights / curriculum state | 🌐 **SHARED** via the singleton brain — every conversation shifts the same Hebbian weights via identity-locked live-chat learning, every user benefits from the accumulated curriculum state |
| GloVe embedding refinements | 🌐 **SHARED** — semantic associations Unity learns apply to her whole brain |
| Persona (`docs/Ultimate Unity.txt`) | 🚫 **NOT USER-MUTABLE** — canonical file loaded once at server boot |
| Episodic memory | ⚙️ **currently a shared pool** — private-per-user scoping is on the workflow roadmap but not yet shipped |

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
