# EQUATIONS — Every Equation Running in Unity's Brain

> IF ONLY I HAD A BRAIN — Complete Equation Reference
> All equations implemented in code. No theory-only entries.

---

## Master Equation

| Equation | `dx/dt = F(x, u, θ, t) + η` |
|----------|------------------------------|
| File | `js/brain/engine.js` |
| x | Full brain state: 1000+ neuron voltages, synapse weights, oscillator phases, memory, motor channels, Ψ |
| u | Sensory input: S(audio, video, text) |
| θ | Persona parameters: arousal baseline, impulsivity, creativity, drug state vectors |
| η | Stochastic noise: per-cluster amplitude, arousal-modulated |
| F | All equations below combined — 7 clusters + 16 projections + modules + oscillators |

---

## Neuron Dynamics

| Equation | Purpose | File |
|----------|---------|------|
| `τ·dV/dt = -(V - V_rest) + R·I` | Leaky Integrate-and-Fire neuron | `neurons.js` |
| `if V ≥ V_thresh → spike, V = V_reset` | Spike generation + reset | `neurons.js` |
| `I = I_tonic + I_synaptic + I_external + η` | Total input current per neuron | `cluster.js` |
| HH: `C·dV/dt = -g_Na·m³h(V-E_Na) - g_K·n⁴(V-E_K) - g_L(V-E_L) + I` | Hodgkin-Huxley (reference) | `neurons.js` |

---

## Synaptic Plasticity

| Equation | Purpose | File |
|----------|---------|------|
| `ΔW = η · post · pre` | Hebbian learning | `synapses.js` |
| `ΔW = A⁺·exp(-Δt/τ⁺)` if pre→post, `-A⁻·exp(Δt/τ⁻)` if post→pre | STDP | `synapses.js` |
| `ΔW = η · δ · post · pre` | Reward-modulated Hebbian (3-factor) | `synapses.js` |
| `if \|W\| < threshold → remove` | Connection pruning | `sparse-matrix.js` |
| `P(new) = prob · pre_spike · post_spike · ¬existing` | Synaptogenesis | `sparse-matrix.js` |

---

## Sparse Connectivity (CSR)

| Equation | Purpose | File |
|----------|---------|------|
| `I_i = Σ_{k=rowPtr[i]}^{rowPtr[i+1]-1} values[k] · spikes[colIdx[k]]` | Sparse propagation O(nnz) | `sparse-matrix.js` |

---

## Brain Modules

| Module | Equation | Purpose | File |
|--------|----------|---------|------|
| Cortex | `ŝ = sigmoid(W·x), error = actual - predicted` | Predictive coding | `modules.js` |
| Hippocampus | `E = -½ΣW·x·x` (Hopfield attractor) | Memory recall | `modules.js` |
| Amygdala | `V(s) = Σw·x → arousal, valence` | Emotional gating | `modules.js` |
| Basal Ganglia | `P(a) = softmax(Q(a)/τ)` | Action selection (6 channels) | `modules.js` |
| Cerebellum | `output = prediction + ΔW·(target - actual)` | Error correction | `modules.js` |
| Hypothalamus | `dH/dt = -α(H - H_set) + input` | Homeostatic drives | `modules.js` |
| Mystery | `Ψ = (√(1/n))³ · [α·Id + β·Ego + γ·Left + δ·Right]` | Consciousness | `mystery.js` |

---

## Oscillations

| Equation | Purpose | File |
|----------|---------|------|
| `dθ_i/dt = ω_i + Σ K_ij · sin(θ_j - θ_i)` | Kuramoto oscillator coupling | `oscillations.js` |
| `R = \|(1/N) Σ exp(iθ_j)\|` | Order parameter (coherence) | `oscillations.js` |
| Band power derived from cluster firing rates | γ, β, α, θ frequencies | `brain-server.js` |

---

## Sensory Pipeline

| Equation | Purpose | File |
|----------|---------|------|
| `I_cortex[d·groupSize] = embedding[d] · 8.0` | Embedding → Wernicke's area mapping | `sensory.js`, `embeddings.js` |
| `Δ_word += lr · (context - (base + Δ))` | Online embedding refinement | `embeddings.js` |
| `activation = Σ(embedding · channelWeights)` | Semantic BG routing (no AI call) | `sensory.js` |
| Tonotopic: `neuron_idx ∝ log(frequency)` | Audio → auditory cortex | `auditory-cortex.js` |
| Retinotopic: `neuron_idx = (x, y) grid` | Video → visual cortex | `visual-cortex.js` |
| Efference copy: word_match > 50% → suppress | Echo cancellation | `auditory-cortex.js` |

---

## Motor Output

| Equation | Purpose | File |
|----------|---------|------|
| `channel_rate = EMA(spike_count / neurons_per_channel)` | 6-channel BG firing rates | `motor.js` |
| `selected = argmax(channel_rates)` | Winner-take-all action | `motor.js` |
| `speech_gate = hypothalamus.social_need × amygdala.arousal` | Speech threshold | `motor.js` |

---

## Memory

| Equation | Purpose | File |
|----------|---------|------|
| `similarity = Σ(a·b) / (\|a\|·\|b\|)` (cosine) | Episodic recall trigger (>0.6) | `memory.js` |
| `working_memory[i] *= 0.98` (decay) | Working memory fading (7 items) | `memory.js` |
| `if activations ≥ 3 → consolidate` | Short → long term transfer | `memory.js` |

---

## Language Production

### Core Equations
| Equation | Purpose | File |
|----------|---------|------|
| `f(r) = C / r^α` | Zipf's Law — word frequency distribution | `language-cortex.js` |
| `I(w1;w2) = log₂(P(w1,w2) / P(w1)·P(w2))` | Mutual Information — word association | `language-cortex.js` |
| `S(w) = -log₂ P(w\|context)` | Surprisal — unexpectedness | `language-cortex.js` |
| `P(w) = softmax(scores / T), T = 1/(coherence + 0.1)` | Sampling with brain temperature | `language-cortex.js` |
| `α = -slope(log(freq) vs log(rank))` | Zipf alpha estimation (log-log regression) | `language-cortex.js` |
| `ΔW_pred = η · (actual_next - predicted) · current^T` | Prediction weight learning | `language-cortex.js` |

### Word Type Equations (computed from letters — no word comparisons)
| Equation | What it computes | File |
|----------|-----------------|------|
| `pronounScore = f(len=1→0.8, len≤3+vowelRatio≥0.33→0.4, apostrophe→0.5)` | Pronoun likelihood from length + vowels + contractions | `language-cortex.js` |
| `verbScore = f(suffix -ing→0.7, -ed→0.6, -n't→0.5, -ize→0.6, -ate→0.5)` | Verb likelihood from suffix letter patterns | `language-cortex.js` |
| `nounScore = f(suffix -tion→0.7, -ment→0.6, -ness→0.6, -ity→0.6, len≥5→0.2)` | Noun likelihood from suffix + length | `language-cortex.js` |
| `adjScore = f(suffix -ly→0.5, -ful→0.6, -ous→0.6, -ive→0.5, -able→0.5)` | Adjective likelihood from suffix patterns | `language-cortex.js` |
| `prepScore = f(len=2+1vowel→0.5, len=3+1vowel→0.3)` | Preposition from length + vowel count | `language-cortex.js` |
| `detScore = f(len=1+vowel→0.3, starts'a'len=2→0.3, starts'th'len=3→0.4)` | Determiner from first letters + length | `language-cortex.js` |
| `qwordScore = f(starts'wh'len3-6→0.8, 'how'pattern→0.8)` | Question word from first 2 letters | `language-cortex.js` |
| `conjScore = f(len=2+consonant-heavy→0.2, len=3+mixed→0.15)` | Conjunction from length + consonant ratio | `language-cortex.js` |

### Slot-Based Sentence Structure
| Structure | Slots | File |
|-----------|-------|------|
| Statement | `[SUBJECT] [VERB] [COMPLEMENT...]` | `language-cortex.js` |
| Question | `[Q-WORD] [VERB] [COMPLEMENT...]` | `language-cortex.js` |
| Action | `*[VERB] [COMPLEMENT...]*` | `language-cortex.js` |
| Exclamation | `[INTENSIFIER] [COMPLEMENT...]` | `language-cortex.js` |

### Brain-Driven Speech Production (think → plan → speak)
| Step | Equation | What it does | File |
|------|----------|-------------|------|
| 1. THINK | `thoughtWords = dictionary.findByPattern(cortexPattern, 15)` | Cortex activation → content words | `language-cortex.js` |
| 2. RECALL | `contextWords = lastInputWords; contextPattern = avg(last5Inputs)` | Hippocampus → conversation relevance | `language-cortex.js` |
| 3. FEEL | `moodWords = dictionary.findByMood(arousal, valence, 15)` | Amygdala → emotional tone | `language-cortex.js` |
| 4. PLAN | `type = f(predError, arousal, motorConf, coherence)` | Cortex prediction → sentence type | `language-cortex.js` |
| 5. SELF | `selfAware = Ψ > 0.005 → boost self-referential words` | Mystery module → introspection | `language-cortex.js` |

### Slot Filling Equation
| Equation | Purpose | File |
|----------|---------|------|
| `typeCompatibility = dot(wordType, slotRequirement)` | Grammar — does this word fit this slot? | `language-cortex.js` |
| `isThought = 0.4 if word ∈ thoughtWords` | Content — is this what the brain is thinking? | `language-cortex.js` |
| `isContext = 0.3 if word ∈ contextWords` | Relevance — was this word just said? | `language-cortex.js` |
| `isMood = 0.2 if word ∈ moodWords` | Tone — does this match the emotion? | `language-cortex.js` |
| `score = type×0.25 + thought×0.20 + context×0.15 + topic×0.05 + mood×0.10 + assoc×0.20 + self - recency` | Combined scoring | `language-cortex.js` |
| `word = softmax(scores, T×0.12)` | Sharp sampling | `language-cortex.js` |

### Loop Detection
| Equation | Purpose | File |
|----------|---------|------|
| `if (prev→w) ∈ usedBigrams → reject` | Bigram tracking prevents cycles | `language-cortex.js` |

### Learning (from conversation only — no pre-loaded data)
| Equation | Purpose | File |
|----------|---------|------|
| `jointCounts[w1][w2]++` on every heard word pair | Learns word associations from conversation | `language-cortex.js` |
| `marginalCounts[w]++` on every heard word | Learns word frequency from exposure | `language-cortex.js` |
| `dictionary.learnWord(w, pattern, arousal, valence)` | Stores word with cortex pattern + emotional state | `dictionary.js` |
| `dictionary.learnBigram(w1, w2)` | Stores word sequences | `dictionary.js` |
| `recentOutputWords[] -= 0.2 per use` | Suppresses repeated words across sentences | `language-cortex.js` |

### Sentence Type Equations
| Equation | Purpose | File |
|----------|---------|------|
| `P(question) = predictionError × coherence × 0.5` | Question production | `language-cortex.js` |
| `P(exclamation) = arousal² × 0.3` | Exclamation production | `language-cortex.js` |
| `P(action) = motorConfidence × (1 - arousal×0.5) × 0.3` | Action/emote production (`*text*`) | `language-cortex.js` |
| `P(statement) = 1 - P(q) - P(e) - P(a)` | Statement production (default) | `language-cortex.js` |

### Input Analysis
| Equation | Purpose | File |
|----------|---------|------|
| `topic_pattern = avg(content_word_patterns)` | Extract conversation topic | `language-cortex.js` |
| `topic_score = cosine(word_pattern, context_pattern)` | Topic continuity in responses | `language-cortex.js` |
| `context = running_avg(last_5_input_patterns)` | Conversation context window | `language-cortex.js` |

### Morphological Transforms
| Equation | Purpose | File |
|----------|---------|------|
| `tense_pattern = base_pattern + tense_vector` | Tense as pattern arithmetic | `language-cortex.js` |
| Past: `shift toward lower dims`, Future: `shift toward higher dims` | Temporal direction in pattern space | `language-cortex.js` |
| `plural_pattern = base_pattern + plural_vector` | Number transform | `language-cortex.js` |

---

## Letter / Syllable Awareness

| Equation | Purpose | File |
|----------|---------|------|
| `pattern[dim] += letterPattern[letter·5+n] / wordLength` | Letter → cortex micro-pattern | `language-cortex.js` |
| Vowel-consonant transition → rhythm marker | Syllable boundary detection | `language-cortex.js` |

---

## Inner Voice

| Equation | Purpose | File |
|----------|---------|------|
| `speechDrive = socialNeed × arousal × coherence` | Speech threshold | `inner-voice.js` |
| `speak when speechDrive > 0.15` | Thought-to-speech gate | `inner-voice.js` |
| Mood = `intensity/direction/clarity` (raw values, no strings) | Emotional state as numbers | `inner-voice.js` |

---

## Dictionary

| Equation | Purpose | File |
|----------|---------|------|
| `pattern[i] = pattern[i]·(1-lr) + cortex[i]·lr, lr = 1/frequency` | Word pattern averaging | `dictionary.js` |
| `match = \|arousal - word.arousal\| + \|valence - word.valence\|` | Mood-based word retrieval | `dictionary.js` |
| `similarity = cosine(pattern, word.pattern)` | Pattern-based word retrieval | `dictionary.js` |

---

## Consciousness

| Equation | Purpose | File |
|----------|---------|------|
| `Ψ = (√(1/n))³ · [α·Id + β·Ego + γ·Left + δ·Right]` | Consciousness refines with complexity | `mystery.js` |
| `gainMultiplier = 0.9 + Ψ · 0.05` | Ψ modulates all cluster coupling | `engine.js` |
| `emotionalGate = 0.7 + arousal · 0.6` | Amygdala amplification factor | `engine.js` |

---

## Projection Learning

| Equation | Purpose | File |
|----------|---------|------|
| `ΔW_proj = η · δ · source_spikes · target_spikes` | Inter-cluster weight update | `cluster.js` |
| 16 projections with learned sparse CSR weights | Cortex↔all clusters | `cluster.js` |

---

## WebGPU Compute (WGSL)

| Shader | Equation | File |
|--------|----------|------|
| LIF_SHADER | `dV = (-(V-Vrest) + R·I) / τ; V += dt·dV` | `gpu-compute.js` |
| SYNAPSE_PROPAGATE | CSR sparse matrix-vector multiply | `gpu-compute.js` |
| PLASTICITY_SHADER | `W += lr·reward·pre·post; clamp(wMin,wMax)` | `gpu-compute.js` |

---

## Visualization Equations

| Equation | Purpose | File |
|----------|---------|------|
| `combined = v·0.35 + a·0.25 + R·0.15 + Ψ·0.1 + \|δ\|·0.1 + dream·0.05` | Emoji from brain state | `brain-3d.js` |
| `touch = arousal × (0.5 + \|valence\| × 0.5)` | Sensory touch intensity | `brain-viz.js` |
| `smell = coherence × 0.6 + arousal × 0.3` | Sensory smell intensity | `brain-viz.js` |
| `taste = \|reward\| × 0.5 + arousal × 0.3` | Sensory taste intensity | `brain-viz.js` |
| `moodColor = hsl(valenceHue, arousalSat%, coherenceLight%)` | Color from equations | `brain-viz.js` |

---

## Server Brain

| Equation | Purpose | File |
|----------|---------|------|
| `BRAIN_TICK_MS = N>50K ? 100 : N>10K ? 50 : 16` | Tick rate scaling | `brain-server.js` |
| `SUBSTEPS = N>50K ? 2 : N>10K ? 5 : 10` | Substep scaling | `brain-server.js` |
| `gamma = cortexRate·5 + amygRate·3` | Band power from firing rates | `brain-server.js` |
| `beta = bgRate·4 + cortexRate·2` | Motor planning frequency | `brain-server.js` |
| `alpha = coherence·3 + (1-arousal)·2` | Relaxed coherence | `brain-server.js` |
| `theta = hippoRate·5 + (dreaming ? 3 : 0)` | Memory + dreaming | `brain-server.js` |

---

## Response Pool (EDNA Fallback)

| Equation | Purpose | File |
|----------|---------|------|
| `category = f(arousal, valence, coherence, predictionError, sentenceType)` | Brain state → response category | `response-pool.js` |
| `variant = arousal < 0.4 ? low : arousal < 0.7 ? mid : high` | Arousal selects intensity | `response-pool.js` |
| `output = blend(poolText, cortexText, 0.85)` | 85% pool + 15% cortex while learning | `response-pool.js`, `engine.js` |

---

*Unity AI Lab — every equation is in the code, every line of code has an equation.*
