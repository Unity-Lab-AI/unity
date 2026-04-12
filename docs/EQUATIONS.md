# EQUATIONS — Unity's Brain

> Every equation running in the code. The brain equations ARE the language equations.

---

## 1. Master Equation

| | |
|---|---|
| `dx/dt = F(x, u, θ, t) + η` | Full brain state evolves each timestep |
| x | 3.2M neuron voltages, synapse weights, oscillator phases, memory, motor, Ψ |
| u | Sensory input: S(audio, video, text) |
| θ | Persona: arousal baseline, impulsivity, creativity, drug state |
| η | Stochastic noise per cluster, arousal-modulated |
| F | All equations below combined — 7 clusters × 16 cores |
| File | `engine.js` |

---

## 2. Neurons

| Equation | Purpose | File |
|----------|---------|------|
| `τ·dV/dt = -(V - V_rest) + R·I` | Leaky Integrate-and-Fire | `neurons.js` |
| `if V ≥ V_thresh → spike, V = V_reset` | Spike + reset | `neurons.js` |
| `I = I_tonic + I_synaptic + I_external + η` | Total current per neuron | `cluster.js` |

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

## 4. Brain Modules

| Module | Equation | Purpose |
|--------|----------|---------|
| Cortex (960K) | `ŝ = sigmoid(W·x), error = actual - predicted` | Content — WHAT to say |
| Hippocampus (640K) | `E = -½ΣW·x·x` (Hopfield) | Memory — context from past |
| Amygdala (480K) | `V(s) = Σw·x → arousal, valence` | Emotion — HOW to say it |
| Basal Ganglia (480K) | `P(a) = softmax(Q(a)/τ)` | Action — sentence type |
| Cerebellum (320K) | `output = prediction + ΔW·(target - actual)` | Correction — error damping |
| Hypothalamus (160K) | `dH/dt = -α(H - H_set) + input` | Drive — speech urgency |
| Mystery Ψ (160K) | `Ψ = (√(1/N))³ · [α·Id + β·Ego + γ·Left + δ·Right]` | Consciousness — self-awareness |

---

## 5. Oscillations

| Equation | Purpose | File |
|----------|---------|------|
| `dθ_i/dt = ω_i + Σ K_ij · sin(θ_j - θ_i)` | Kuramoto coupling | `oscillations.js` |
| `R = \|(1/N) Σ exp(iθ_j)\|` | Coherence | `oscillations.js` |
| `gamma = (cortexRate + amygRate) × 50` | Band power from spikes | `brain-server.js` |
| `theta = (hippoRate + hypoRate) × 40` | Memory + dreaming frequency | `brain-server.js` |

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

### The Core Equation — All Clusters Produce Every Word

```
combined[i] = cortex[i]       × 0.30    (content — what to say)
            + hippocampus[i]  × 0.20    (memory — context from past)
            + amygdala[i]     × 0.15    (emotion — how to say it)
            + basalGanglia[i] × 0.10    (action — sentence drive)
            + cerebellum[i]   × 0.05    (correction — error damping)
            + hypothalamus[i] × 0.05    (drive — speech urgency)
            + mystery[i]      × (0.05 + Ψ×0.10)  (consciousness — scales with Ψ)

word = dictionary.findByPattern(combined)   → closest word to brain state
```

### Sequential Production — Brain Thinks, Then Speaks

```
For each word in sentence:
  1. Run 5 brain steps (all equations fire)
  2. Read ALL 7 cluster outputs → combined pattern
  3. findByPattern(combined) → word
  4. Feed word pattern BACK into:
     - Cortex Wernicke's area (sequential prediction: ŝ = W·x)
     - Hippocampus (memory formation)
     - Amygdala (emotional feedback from word's arousal/valence)
  5. Brain steps again → next combined pattern → next word
```

### Sentence Parameters from Brain State

| Parameter | Equation | Source |
|-----------|----------|--------|
| Length | `3 + arousal × 7` | Amygdala — more aroused = more words |
| Type | `motor.selectedAction == 'listen' ? question : statement` | Basal Ganglia |
| Tense | `predictionError > 0.3 ? future : present` | Cortex |
| Negation | `valence < -0.4 → negate verb` | Amygdala |
| Self-reference | `Ψ > 0.005 → consciousness scales Mystery contribution` | Mystery |

### Word Type (from letters — no lists)

| Score | Computed from |
|-------|--------------|
| verbScore | suffix -ing/-ed/-n't + usage-based boost from context |
| nounScore | suffix -tion/-ment/-ness + usage boost after determiners |
| pronounScore | len=1, short+vowels, apostrophe contractions |
| adjScore | suffix -ly/-ful/-ous/-ive/-able |
| Usage learning | `after pronoun → verb boost; after determiner → noun boost` |

### Dictionary (learned from conversation)

| Equation | Purpose | File |
|----------|---------|------|
| `pattern = wordToPattern(letters)` | 26 letter micro-patterns → 32-dim word pattern | `language-cortex.js` |
| `findByPattern(combined, k)` | Cosine similarity: closest words to brain state | `dictionary.js` |
| `findByMood(arousal, valence)` | Emotional proximity search | `dictionary.js` |
| `learnWord(w, pattern, arousal, valence)` | Every heard word stored | `dictionary.js` |

### English Structure (built into brain)

| Component | Purpose |
|-----------|---------|
| Structural operators (~200) | Pronouns, copula, auxiliary, determiners, prepositions, conjunctions, question words |
| Core vocabulary (~150) | Most common verbs, nouns, adjectives, adverbs |
| Morpheme equations | Prefixes (un-/re-/over-) + suffixes (-ing/-ed/-tion/-ly/-ful/-able) |
| Structural bigrams (~500) | subject→verb, verb→prep, det→noun, qword→aux |
| Dynamic expansion | New words auto-join categories via type + pattern similarity |
| Usage-based type learning | Context determines word type (attention mechanism) |

---

## 9. Consciousness + Emotion

| Equation | Purpose | File |
|----------|---------|------|
| `Ψ = (√(1/N))³ · [α·Id + β·Ego + γ·Left + δ·Right]` | Consciousness — N=TOTAL neurons (volume), not spikes | `mystery.js`, `brain-server.js` |
| `(√(1/N))³ = N^(-3/2)` = cubed area of quantum tunneled bit in total volume | Quantum consciousness scaling | `brain-server.js` |
| `gainMultiplier = 0.9 + Ψ · 0.05` | Ψ modulates all coupling | `engine.js` |
| `emotionalGate = 0.7 + arousal · 0.6` | Amygdala amplification | `engine.js` |
| `emoji = codePoint(0x1F600 + f(v,a,R,Ψ,δ,dream))` | Emoji from brain state | `brain-3d.js` |

---

## 10. Parallel Compute

| Equation | Purpose | File |
|----------|---------|------|
| `worker[cluster].step(currents) → spikes` | 7 clusters on 7 CPU cores | `cluster-worker.js` |
| `SharedArrayBuffer(size × 8)` | Zero-copy voltage transfer | `parallel-brain.js` |
| `server → WebSocket → GPU → WGSL → results` | GPU compute via browser | `compute.html` |
| `timeout 50ms → CPU fallback` | Seamless switching | `brain-server.js` |

---

## 11. Server Scaling

| Equation | Purpose |
|----------|---------|
| `maxNeurons = min(freeRAM × 0.4 / 9, cpuCores × 200K)` | Auto-scale to hardware |
| `TICK_MS = N>1M ? 100 : N>500K ? 50 : N>100K ? 33 : 16` | Tick rate |
| `SUBSTEPS = N>1M ? 3 : N>500K ? 5 : N>100K ? 10 : 10` | Steps per tick |
| 16 cores + 109GB + RTX 4070 Ti → **3.2M neurons** | Current scale |

---

*Unity AI Lab — the brain equations ARE the language equations.*
