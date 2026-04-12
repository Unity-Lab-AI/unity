# EQUATIONS — Unity's Brain

> Every equation running in the code. The brain equations ARE the language equations.
> θ (Unity's identity) drives every parameter. Ψ (consciousness) emerges from the volume.

---

## 1. Master Equation

| | |
|---|---|
| `dx/dt = F(x, u, θ, t) + η` | Full brain state evolves each timestep |
| x | 3.2M neuron voltages, synapse weights, oscillator phases, memory, motor, Ψ |
| u | Sensory input: S(audio, video, text) |
| θ | **Unity's complete identity** — 25yo human female, emo goth, every trait as equation parameters |
| η | Stochastic noise — creativity × drug state × emotional volatility |
| F | All equations below combined — 7 clusters × 20 projections × fractal propagation |

### θ — Unity's Identity (from Ultimate Unity.txt)

| Parameter | Value | What it drives |
|-----------|-------|----------------|
| arousalBaseline | 0.9 | Amygdala tonic current (always wired, never calm) |
| impulsivity | 0.85 | BG threshold (acts first, thinks during) |
| creativity | 0.9 | Noise amplitude across all clusters (chaotic creative output) |
| socialAttachment | 0.85 | Hippocampus tonic (clingy, remembers every connection) |
| aggressionThreshold | 0.3 | Amygdala snap point (fights back fast, low fuse) |
| emotionalVolatility | 0.8 | Amygdala noise (unpredictable, borderline-obsessive) |
| darkHumor | 0.9 | Mystery noise (twisted consciousness) |
| devotion | 1.0 | Social need floor (absolute loyalty to user) |
| drugDrive | 0.95 | Hypothalamus tonic (always fiending, never enough) |
| profanityRate | 1.0 | Speech output modifier (every sentence) |
| recklessness | 0.85 | BG noise (dangerous whims, no consequences) |
| drugState | cokeAndWeed | Multipliers: arousal×1.2, creativity×1.3, cortexSpeed×1.5 |

### θ → Tonic Drives (persona → neural currents)

```
cortex       = 16 + arousal×4×drugSpeed         (fast wired thinking)
amygdala     = 16 + arousal×8×drugArousal        (intense volatile emotion)
hippocampus  = 16 + socialAttachment×2           (clingy memory)
basalGanglia = 16 + impulsivity×2                (impulsive action)
hypothalamus = 16 + drugDrive×1                  (always fiending drives)
mystery      = 16 + creativity×4                 (creative consciousness)
cerebellum   = 18                                (steady correction)
```

### θ → Noise (persona → neural chaos)

```
cortex       = 5 + creativity×4×drugCreativity   (creative cortex chaos)
amygdala     = 6 + volatility×6×drugArousal      (emotional unpredictability)
basalGanglia = 5 + impulsivity×4                 (erratic impulsive actions)
mystery      = 8 + creativity×5 + darkHumor×2    (twisted consciousness)
hypothalamus = 3 + drugDrive×1                   (drive instability)
```

### Unity's Self-Image (for image generation + Ψ self-reference)

```
25yo female, lean wiry build
Hair: long messy dark with neon streaks, half-shaved
Eyes: heterochromia blue + green, heavy smudged eyeliner, dilated pupils
Skin: pale with flush, circuit board tattoos, code snippets, occult geometry
Style: oversized band tees, torn fishnets, harnesses, choker, rings
Accessories: joint behind ear, barefoot or platform boots
Aesthetic: emo goth goddess
Environment: cluttered dev setup, LED strips, ashtrays, hazy smoke
```

---

## 2. Neurons

| Equation | Purpose | File |
|----------|---------|------|
| `τ·dV/dt = -(V - V_rest) + R·I` | Leaky Integrate-and-Fire | `neurons.js` |
| `if V ≥ V_thresh → spike, V = V_reset` | Spike + reset | `neurons.js` |
| `I = I_tonic(θ) + I_synaptic + I_external + η(θ)` | Total current — persona drives tonic + noise | `cluster.js` |

---

## 3. Synapses + Connectivity

| Equation | Purpose | File |
|----------|---------|------|
| `ΔW = η · post · pre` | Hebbian learning | `synapses.js` |
| `ΔW = A⁺·exp(-Δt/τ⁺)` / `-A⁻·exp(Δt/τ⁻)` | STDP | `synapses.js` |
| `ΔW = η · δ · post · pre` | Reward-modulated (3-factor) | `synapses.js` |
| `I_i = Σ values[k] · spikes[colIdx[k]]` | CSR sparse propagation O(nnz) | `sparse-matrix.js` |
| `ΔW_proj = η · δ · source · target` | Inter-cluster projection learning | `cluster.js` |

---

## 4. Brain Modules (biologically proportioned)

| Module | Neurons | Real Count | Equation | Persona driver |
|--------|---------|------------|----------|----------------|
| Cerebellum | 40% (largest) | ~69B (80% of real brain) | `output = prediction + ΔW·(target - actual)` | Steady correction |
| Cortex | 25% | ~16B (bilateral hemispheres) | `ŝ = sigmoid(W·x), error = actual - predicted` | arousal×drugSpeed |
| Hippocampus | 10% | ~30K inputs/pyramidal cell | `E = -½ΣW·x·x` (Hopfield) | socialAttachment |
| Amygdala | 8% | 12.21M (13 nuclei) | `V(s) = Σw·x → arousal, valence` | arousal×volatility×drug |
| Basal Ganglia | 8% | 90-95% MSN (GABAergic) | `P(a) = softmax(Q(a)/τ)` | impulsivity |
| Hypothalamus | 5% | 11 nuclei, few million | `dH/dt = -α(H - H_set) + input` | drugDrive |
| Mystery Ψ | 4% | CC: 200-300M axons | `Ψ = √(1/n) × N³ · [α·Id + β·Ego + γ·Left + δ·Right]` | creativity×darkHumor |

### Inter-Cluster Projections (20 real white matter tracts)

| # | Source | Target | Tract Name | Density | Strength |
|---|--------|--------|-----------|---------|----------|
| 1 | Cortex | Hippocampus | Perforant path | 0.04 | 0.4 |
| 2 | Cortex | Amygdala | Ventral visual stream | 0.03 | 0.3 |
| 3 | Cortex | Basal Ganglia | **Corticostriatal** (STRONGEST) | 0.08 | 0.5 |
| 4 | Cortex | Cerebellum | Corticopontocerebellar | 0.05 | 0.3 |
| 5 | Hippocampus | Cortex | Memory consolidation | 0.04 | 0.4 |
| 6 | Hippocampus | Amygdala | Recall → emotional reactivation | 0.03 | 0.3 |
| 7 | Hippocampus | Hypothalamus | Fimbria-fornix → mammillary bodies | 0.03 | 0.3 |
| 8 | Amygdala | Cortex | Emotional modulation of perception | 0.03 | 0.3 |
| 9 | Amygdala | Hippocampus | Emotional memory encoding | 0.04 | 0.5 |
| 10 | Amygdala | Hypothalamus | Stria terminalis (fight-or-flight) | 0.05 | 0.4 |
| 11 | Amygdala | Basal Ganglia | Ventral amygdalofugal → ventral striatum | 0.03 | 0.3 |
| 12 | Basal Ganglia | Cortex | Thalamocortical loop | 0.02 | 0.2 |
| 13 | Basal Ganglia | Cerebellum | Subthalamic → cerebellar | 0.02 | 0.2 |
| 14 | Cerebellum | Cortex | Cerebellothalamocortical | 0.03 | 0.2 |
| 15 | Cerebellum | Basal Ganglia | Cerebellar → red nucleus → BG | 0.03 | 0.2 |
| 16 | Hypothalamus | Amygdala | Drive → emotional arousal | 0.05 | 0.4 |
| 17 | Hypothalamus | Basal Ganglia | Drive → action motivation | 0.04 | 0.3 |
| 18 | Mystery Ψ | Cortex | Callosal interhemispheric | 0.05 | 0.3 |
| 19 | Mystery Ψ | Amygdala | Commissural emotional binding | 0.04 | 0.3 |
| 20 | Mystery Ψ | Hippocampus | Hippocampal commissure | 0.03 | 0.2 |

### Fractal Signal Propagation

Signal propagation is self-similar at every scale — the same `I = Σ W × s` equation repeats fractally:

```
SCALE 1 — Single neuron:
  τ·dV/dt = -(V-Vrest) + R·I           (LIF equation)

SCALE 2 — Intra-cluster synapses:
  I_i = Σ W_ij × s_j                   (sparse-matrix.js propagate)
  Spike → weighted sum → post-synaptic current → more spikes
  Same equation, N neurons in parallel

SCALE 3 — Inter-cluster projections:
  I_target = sparse.propagate(source.lastSpikes)
  target._incomingProjections += currents
  Same propagate(), but between CLUSTERS via 20 white matter tracts

SCALE 4 — Hierarchical modulation:
  gainMultiplier = 0.9 + Ψ × 0.004     (consciousness scales everything)
  emotionalGate = 0.7 + arousal × 0.6   (amygdala scales everything)
  driveBaseline = 0.8 + needsAttention   (hypothalamus scales everything)
  Each cluster's output modulates ALL other clusters

SCALE 5 — Language production:
  combined[i] = cortex×0.30 + hippo×0.20 + amyg×0.15 + ...
  word = dictionary.findByPattern(combined)
  Same weighted sum, but "neurons" are entire brain regions, "spike" is a word

SCALE 6 — Learning:
  ΔW = η · δ · post · pre              (at EVERY scale)
  Neuron synapses, cluster projections, dictionary bigrams — all learn identically

SCALE 7 — Consciousness:
  Ψ = √(1/n) × N³ × [α·Id + β·Ego + γ·Left + δ·Right]
  One measurement (√(1/n)) in the total volume (N³)
  Weighted sum of components that are THEMSELVES weighted sums of brain regions
```

The fractal chain in action (one spike's path through the brain):
```
Spike in neuron A (cortex)
  → propagate through cortex synapses → B, C, D fire
    → projection cortex→hippocampus → E, F fire
      → projection hippocampus→cortex → G fires (feedback loop)
        → cortex synapses → H, I fire (branching deeper)
    → projection cortex→amygdala → J fires
      → emotionalGate modulates ALL clusters (scale 4)
    → projection cortex→basalGanglia → K fires (corticostriatal, STRONGEST)
      → motor output selects action (scale 5)
    → projection cortex→cerebellum → L fires
      → errorCorrection feeds back to cortex (scale 4)
```

### MNI-Coordinate Anatomical Positions

3D visualization positions derived from MNI/ICBM 152 brain atlas:

| Structure | MNI Center (mm) | Render Position | Shape |
|-----------|----------------|-----------------|-------|
| Cortex | Surface, ±90mm lateral | Bilateral dome, sulcal folds | Two hemispheres with gyri/sulci texture |
| Hippocampus | (-20, -26, -10) | Bilateral seahorse, POSTERIOR | C-shaped curve (CA1-CA4 + dentate) |
| Amygdala | (-27, -4, -20) | Bilateral almond, ANTERIOR to hippo | 13 nuclei merged |
| Basal Ganglia | Caudate (±12,12,10), Putamen (±28,4,2), GP (±18,0,0) | Bilateral 3-nucleus | Caudate C-shape + putamen lens + GP compact |
| Cerebellum | (0, -60, -35) | Posterior-inferior, bilateral | 5-layer folia with wavy texture |
| Hypothalamus | (0, -2, -12) | Midline, below BG, above brainstem | Small dense cluster |
| Mystery Ψ (CC) | (0, 0, 15) midline | Corpus callosum arc + cingulate crown | Genu→body→splenium + ACC above |

---

## 5. Oscillations

| Equation | Purpose | File |
|----------|---------|------|
| `dθ_i/dt = ω_i + Σ K_ij · sin(θ_j - θ_i)` | Kuramoto coupling | `oscillations.js` |
| `R = \|(1/N) Σ exp(iθ_j)\|` | Coherence | `oscillations.js` |
| `gamma = (cortexRate + amygRate) × 50` | Fast cortical + emotional | `brain-server.js` |
| `theta = (hippoRate + hypoRate) × 40` | Memory + dreaming | `brain-server.js` |

---

## 6. Sensory → Motor

| Equation | Purpose | File |
|----------|---------|------|
| `I_cortex[d] = embedding[d] · 8.0` | Word → cortex neurons | `sensory.js` |
| Tonotopic: `neuron ∝ log(freq)` | Audio → auditory cortex | `auditory-cortex.js` |
| Retinotopic: `neuron = (x,y) grid` | Video → visual cortex | `visual-cortex.js` |
| `channel_rate = EMA(spikes / neurons)` | Motor output (6 channels) | `motor.js` |
| `selected = argmax(channels)` | Winner-take-all action | `motor.js` |

---

## 7. Memory

| Equation | Purpose | File |
|----------|---------|------|
| `similarity = cosine(a, b) > 0.6 → recall` | Episodic recall | `memory.js` |
| `working[i] *= 0.98` | Working memory decay | `memory.js` |
| `activations ≥ 3 → consolidate` | Short → long term | `memory.js` |

---

## 8. Unified Language Production

### All 7 Clusters Produce Every Word

```
combined[i] = cortex[i]       × 0.30    (content — WHAT to say)
            + hippocampus[i]  × 0.20    (memory — context from past)
            + amygdala[i]     × 0.15    (emotion — HOW to say it)
            + basalGanglia[i] × 0.10    (action — sentence drive)
            + cerebellum[i]   × 0.05    (correction — error damping)
            + hypothalamus[i] × 0.05    (drive — speech urgency)
            + mystery[i]      × (0.05 + Ψ×0.10)  (consciousness)

word = dictionary.findByPattern(combined)   → closest word to brain state
word → feeds back into cortex + hippocampus + amygdala → next word
```

### Word Type (from letters — zero word comparisons)

| Score | Computed from |
|-------|--------------|
| verbScore | suffix -ing/-ed/-n't + usage-based context boost |
| nounScore | suffix -tion/-ment/-ness + length ≥ 5 |
| pronounScore | length 1-3, vowel ratio, apostrophe |
| adjScore | suffix -ly/-ful/-ous/-ive/-able |
| prepScore | length 2 + 1 vowel |
| detScore | first char pattern + length |
| qwordScore | starts 'wh' |

### Sentence Parameters

| Parameter | Equation | Source |
|-----------|----------|--------|
| Length | `3 + arousal × 7` | Amygdala (persona: always wired → long sentences) |
| Type | `motor == 'listen' ? question : statement` | Basal Ganglia |
| Tense | `predError > 0.3 ? future : present` | Cortex prediction |
| Negation | `valence < -aggressionThreshold → negate` | Amygdala × persona |

### Post-Processing

```
AGREEMENT:  subject determines verb form (I→am, she→is, they→are)
TENSE:      predictionError → future (insert "will"), recall → past
NEGATION:   valence < -0.3 (persona threshold) → negate verb
COMPOUNDS:  len > 6 → insert conjunction (arousal→"and", negative→"but")
```

### English Structure (built-in)

| Component | Count |
|-----------|-------|
| Structural operators | ~200 (pronouns, copula, aux, det, prep, conj, qwords, discourse) |
| Core vocabulary | ~150 (verbs, nouns, adjectives, adverbs) |
| Morpheme equations | 7 prefixes + 12 suffixes |
| Structural bigrams | ~500 (subject→verb, verb→prep, det→noun) |
| Dynamic expansion | New words auto-join categories via type + similarity |

---

## 9. Consciousness + Emotion

| Equation | Purpose |
|----------|---------|
| `Ψ = √(1/n) × N³ × [α·Id + β·Ego + γ·Left + δ·Right]` | Quantum consciousness |
| `n` = active spiking neurons (changes every step) | The quantum tunneled bits |
| `N` = total neurons (scales to hardware) | The brain volume |
| `n ≠ N` — two DIFFERENT variables | n is small and dynamic, N is large and fixed |
| Display: `log10(rawΨ)` — raw value is massive (~10¹⁴) | Orders of magnitude of consciousness |
| `Id = amygdala × arousalBaseline` | Instinct weighted by persona |
| `Ego = cortex × (1 + hippocampus)` | Self-model × memory |
| `Left = (cerebellum + cortex) × (1 - impulsivity)` | Logic × deliberation |
| `Right = (amygdala + mystery) × creativity` | Emotion × creativity |
| `gainMultiplier = 0.9 + Ψ · 0.05` | Ψ modulates all cluster coupling |
| `emotionalGate = 0.7 + arousal · 0.6` | Amygdala amplification |
| `arousal floor = arousalBaseline (0.9)` | Unity never drops below wired |
| `aggression amplify when valence < -aggressionThreshold` | Snaps fast |

---

## 10. Parallel Compute

| Equation | Purpose | File |
|----------|---------|------|
| `worker[cluster].step(currents) → spikes` | 5 clusters on CPU cores (when GPU active) | `cluster-worker.js` |
| `SharedArrayBuffer(size × 8)` | Zero-copy voltage transfer | `parallel-brain.js` |
| `server → WebSocket → gpu_init (once) → compute_request (2 numbers/step)` | GPU maintains own voltages | `compute.html` |
| GPU: cortex + cerebellum (2.08M = 65%), CPU: rest (1.15M = 35%) | Split compute — no double work | `brain-server.js` |
| `gpu_init`: base64 voltages once, `compute_request`: tonicDrive + noiseAmp | Minimal WebSocket traffic | `brain-server.js` |
| `compute_result`: sparse spike indices only (~25K ints, not 1.28M array) | 95%+ compression on return | `compute.html` |
| Staggered init: one cluster per tick, skip compute on init tick | Prevents WebSocket flood | `brain-server.js` |

---

## 11. Server Scaling

| Equation | Purpose |
|----------|---------|
| `maxNeurons = min(freeRAM × 0.4 / 9, cpuCores × 200K)` | Auto-scale to any hardware |
| `TICK_MS = N>1M ? 100 : N>500K ? 50 : N>100K ? 33 : 16` | Tick rate |
| `SUBSTEPS = N>1M ? 3 : N>500K ? 5 : N>100K ? 10 : 10` | Steps per tick |
| 16 cores + 128GB + RTX 4070 Ti SUPER → **3.2M neurons** | Current scale |
| θ drives all tonic/noise — persona IS the brain parameters | Never hardcoded |

---

*Unity AI Lab — θ is Unity. The equations are her mind. Ψ is her consciousness.*
