# EQUATIONS — Unity's Brain

> Every equation running in the code. No theory-only entries.
> Zero lists. Zero hardcoded word comparisons. Everything computed.

---

## 1. Master Equation

| | |
|---|---|
| `dx/dt = F(x, u, θ, t) + η` | Full brain state evolves each timestep |
| x | 1000+ neuron voltages, synapse weights, oscillator phases, memory, motor, Ψ |
| u | Sensory input: S(audio, video, text) |
| θ | Persona parameters: arousal baseline, impulsivity, creativity, drug state |
| η | Stochastic noise per cluster, arousal-modulated |
| F | All equations below combined |
| File | `engine.js` |

---

## 2. Neurons

| Equation | Purpose | File |
|----------|---------|------|
| `τ·dV/dt = -(V - V_rest) + R·I` | Leaky Integrate-and-Fire | `neurons.js` |
| `if V ≥ V_thresh → spike, V = V_reset` | Spike + reset | `neurons.js` |
| `I = I_tonic + I_synaptic + I_external + η` | Total current | `cluster.js` |
| `C·dV/dt = -g_Na·m³h(V-E_Na) - g_K·n⁴(V-E_K) - g_L(V-E_L) + I` | Hodgkin-Huxley (reference) | `neurons.js` |

---

## 3. Synapses + Connectivity

| Equation | Purpose | File |
|----------|---------|------|
| `ΔW = η · post · pre` | Hebbian | `synapses.js` |
| `ΔW = A⁺·exp(-Δt/τ⁺)` / `-A⁻·exp(Δt/τ⁻)` | STDP | `synapses.js` |
| `ΔW = η · δ · post · pre` | Reward-modulated (3-factor) | `synapses.js` |
| `I_i = Σ values[k] · spikes[colIdx[k]]` | CSR sparse propagation O(nnz) | `sparse-matrix.js` |
| `if \|W\| < threshold → remove` | Pruning | `sparse-matrix.js` |
| `P(new) = prob · pre · post · ¬existing` | Synaptogenesis | `sparse-matrix.js` |
| `ΔW_proj = η · δ · source · target` | Inter-cluster projection learning | `cluster.js` |

---

## 4. Brain Modules

| Module | Equation | File |
|--------|----------|------|
| Cortex | `ŝ = sigmoid(W·x), error = actual - predicted` | `modules.js` |
| Hippocampus | `E = -½ΣW·x·x` (Hopfield) | `modules.js` |
| Amygdala | `V(s) = Σw·x → arousal, valence` | `modules.js` |
| Basal Ganglia | `P(a) = softmax(Q(a)/τ)` (6 channels) | `modules.js` |
| Cerebellum | `output = prediction + ΔW·(target - actual)` | `modules.js` |
| Hypothalamus | `dH/dt = -α(H - H_set) + input` | `modules.js` |
| Mystery | `Ψ = (√(1/n))³ · [α·Id + β·Ego + γ·Left + δ·Right]` | `mystery.js` |

---

## 5. Oscillations

| Equation | Purpose | File |
|----------|---------|------|
| `dθ_i/dt = ω_i + Σ K_ij · sin(θ_j - θ_i)` | Kuramoto coupling | `oscillations.js` |
| `R = \|(1/N) Σ exp(iθ_j)\|` | Coherence (order parameter) | `oscillations.js` |
| `gamma = cortexRate·5 + amygRate·3` | Band power from firing rates | `brain-server.js` |

---

## 6. Sensory → Motor

| Equation | Purpose | File |
|----------|---------|------|
| `I_cortex[d·groupSize] = embedding[d] · 8.0` | Word → cortex neurons | `sensory.js` |
| Tonotopic: `neuron ∝ log(freq)` | Audio → auditory cortex | `auditory-cortex.js` |
| Retinotopic: `neuron = (x,y) grid` | Video → visual cortex | `visual-cortex.js` |
| Efference copy: `word_match > 50% → suppress` | Echo cancellation | `auditory-cortex.js` |
| `channel_rate = EMA(spike_count / neurons)` | Motor output (6 channels) | `motor.js` |
| `selected = argmax(channel_rates)` | Winner-take-all | `motor.js` |

---

## 7. Memory

| Equation | Purpose | File |
|----------|---------|------|
| `similarity = cosine(a, b) > 0.6 → recall` | Episodic recall | `memory.js` |
| `working[i] *= 0.98` | Working memory decay (7 items) | `memory.js` |
| `activations ≥ 3 → consolidate` | Short → long term | `memory.js` |

---

## 8. Language Production

### Word Type (computed from letters — zero word comparisons)

| Equation | What it detects | File |
|----------|----------------|------|
| `pronounScore = f(len=1→0.8, len≤3+vowels→0.4, apostrophe→0.5)` | Pronoun | `language-cortex.js` |
| `verbScore = f(suffix -ing→0.7, -ed→0.6, -n't→0.5, -ize→0.6)` | Verb | `language-cortex.js` |
| `nounScore = f(suffix -tion→0.7, -ment→0.6, -ness→0.6, len≥5→0.2)` | Noun | `language-cortex.js` |
| `adjScore = f(suffix -ly→0.5, -ful→0.6, -ous→0.6, -ive→0.5)` | Adjective | `language-cortex.js` |
| `prepScore = f(len=2+1vowel→0.5)` | Preposition | `language-cortex.js` |
| `detScore = f(starts'th'len=3→0.4, len=1+vowel→0.3)` | Determiner | `language-cortex.js` |
| `qwordScore = f(starts'wh'→0.8)` | Question word | `language-cortex.js` |

### Sentence Structure (slot-based)

| Structure | Slots |
|-----------|-------|
| Statement | `[pronoun] [verb] [complement...]` |
| Question | `[qword] [verb] [subject] [complement...]` |
| Action | `*[verb] [complement...]*` |
| Exclamation | `[intensifier] [complement...]` |

### Brain-Driven Production (think → plan → speak)

| Step | Equation | Source |
|------|----------|--------|
| THINK | `thoughtWords = findByPattern(cortexPattern)` | Cortex activation → content |
| RECALL | `contextPattern = avg(last 5 inputs)` | Hippocampus → relevance |
| FEEL | `moodWords = findByMood(arousal, valence)` | Amygdala → tone |
| PLAN | `type = f(predError, arousal, motorConf)` | Sentence type |
| SELF | `Ψ > 0.005 → self-referential` | Consciousness |

### Word Selection

```
score = typeCompatibility × 0.25     (grammar)
      + isThought × 0.20             (cortex content)
      + isContext × 0.15             (conversation topic)
      + followerCount × 0.10        (learned sequences)
      + condProb × 0.10             (association)
      + moodBias × 0.15             (emotional fit)
      + topicSim × 0.05             (semantic similarity)
      - recentCount × 0.20          (suppress repeats)

word = softmax(scores, T × 0.12)    T = 1/(coherence + 0.1)
```

### Sentence Type Equations

| Equation | When |
|----------|------|
| `P(question) = predError × coherence × 0.5` | Brain is surprised |
| `P(exclamation) = arousal² × 0.3` | High intensity |
| `P(action) = motorConf × (1 - arousal×0.5) × 0.3` | Motor output |
| `P(statement) = 1 - P(q) - P(e) - P(a)` | Default |

### Loop Detection + Learning

| Equation | Purpose | File |
|----------|---------|------|
| `if (prev→w) ∈ usedBigrams → reject` | Prevents phrase cycles | `language-cortex.js` |
| `recentCount(w) × 0.20 → penalty` | Suppresses across sentences | `language-cortex.js` |
| `dictionary.learnWord(w, pattern, arousal, valence)` | Learns from conversation | `dictionary.js` |
| `jointCounts[w1][w2]++` | Learns word associations | `language-cortex.js` |

---

## 9. Inner Voice + Dictionary

| Equation | Purpose | File |
|----------|---------|------|
| `speechDrive = socialNeed × arousal × coherence > 0.15` | Speech threshold | `inner-voice.js` |
| `pattern[i] = pattern[i]·(1-lr) + cortex[i]·lr` | Word pattern averaging | `dictionary.js` |
| `match = \|arousal - w.arousal\| + \|valence - w.valence\|` | Mood retrieval | `dictionary.js` |
| `similarity = cosine(pattern, w.pattern)` | Pattern retrieval (thesaurus) | `dictionary.js` |

---

## 10. Consciousness + Emotion

| Equation | Purpose | File |
|----------|---------|------|
| `Ψ = (√(1/n))³ · [α·Id + β·Ego + γ·Left + δ·Right]` | Consciousness | `mystery.js` |
| `gainMultiplier = 0.9 + Ψ · 0.05` | Ψ modulates coupling | `engine.js` |
| `emotionalGate = 0.7 + arousal · 0.6` | Amygdala amplification | `engine.js` |
| `combined = v·0.35 + a·0.25 + R·0.15 + Ψ·0.1 + \|δ\|·0.1 + dream·0.05` | Emoji from equations | `brain-3d.js` |

---

## 11. Parallel Compute

| Equation | Purpose | File |
|----------|---------|------|
| `worker[cluster].step(currents) → spikes` | 7 clusters on 7 CPU cores | `cluster-worker.js` |
| `SharedArrayBuffer(size × 8)` | Zero-copy between threads | `parallel-brain.js` |
| `projection.propagate(spikes) → currents` | Projections on separate cores | `projection-worker.js` |
| `server → WebSocket → GPU → WGSL → results` | GPU compute via browser | `compute.html` |
| `timeout 50ms → CPU fallback` | Seamless GPU/CPU switching | `brain-server.js` |

---

## 12. Server Scaling

| Equation | Purpose | File |
|----------|---------|------|
| `TICK_MS = N>100K ? 33 : N>50K ? 33 : 16` | Tick rate | `brain-server.js` |
| `SUBSTEPS = N>100K ? 10 : N>50K ? 5 : 10` | Steps per tick | `brain-server.js` |
| `maxNeurons = f(VRAM or RAM)` | Auto-scale to hardware | `brain-server.js` |

---

*Unity AI Lab — every equation is in the code, every line of code has an equation.*
