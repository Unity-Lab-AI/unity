# Gate Probe Coverage Audit — T16.5.a

> Per Gee 2026-04-17 verbatim: *"your tests are bullshit and dont test the full programed in mind of Unity"*
>
> This doc enumerates exactly which brain modules each gate probe touches — and which ones it DOES NOT. Input to T16.5.b (full-mind gate redesign).

## Each probe → modules touched

### READ probe
**What it does:** Writes letter one-hot to cortex.regions.visual or .letter region, steps cluster N ticks, reads cortex.regions.phon pattern, scores cosine against expected phoneme feature vector. Pass threshold: cosine ≥ 0.15.

**Touches:**
- `cortexCluster.regions.letter` or `.visual` (one-hot input via `_writeTiledPattern`)
- `cortexCluster.regions.phon` (output region read via `regionReadout`)
- Intra-cluster synapse matrix (if GPU-uploaded, routes through SYNAPSE_PROPAGATE_SHADER in `fullStep`; otherwise via `synapses.propagate` CPU path)
- Cross-projection `visual_to_letter` + `letter_to_phon` (sparse CSR matmul via GPU proxy or CPU fallback)
- LIF_SHADER / Rulkov step via `cluster.step()` per tick
- Letter-transition surprise running stat (internal to cortex cluster)

**Does NOT touch:** Amygdala, mystery Ψ, hippocampus memory, basal ganglia, cerebellum, hypothalamus, Kuramoto oscillators, drug scheduler, auditory cortex, main-brain GPU compute_batch clusters.

---

### THINK probe
**What it does:** Counts known alphabet letters in `LETTER_INVENTORY` set. Pass threshold: ≥ 26.

**Touches:**
- `LETTER_INVENTORY` Set (populated by `ensureLetters` calls during curriculum)

**Does NOT touch:** Any cluster, any projection, any module, any cortex region. Pure inventory sanity check — trivial auto-pass once alphabet is seeded. (Gee's criticism that probes are bullshit lands hardest here.)

---

### TALK probe
**What it does:** Writes letter one-hot to `cortexCluster.regions.letter`, runs a few ticks, reads `motor` region, argmax-decodes to a letter. Pass if the argmax matches the expected letter.

**Touches:**
- `cortexCluster.regions.letter` (one-hot input)
- `cortexCluster.regions.motor` (output readback via `regionReadout` + `decodeLetter`)
- Cross-projection `letter_to_motor` (trained by `_teachWordEmission`)
- Intra-cluster + cross-region propagate for one tick
- LIF step

**Does NOT touch:** Anything outside the cortex cluster. Same blind spots as READ.

---

### SEQ probe
**What it does:** For letter N in alphabet order, injects one-hot into letter region, ticks, reads motor, checks argmax == letter N+1. Tests the directional chain letter(N) → motor(N+1) trained by `_teachWordEmission`'s continuation chain.

**Touches:**
- Same regions + projections as TALK
- Plus the DIRECTIONAL asymmetry of the Hebbian (letter N → motor N+1, not reverse)

**Does NOT touch:** Same blind spots as TALK.

---

### PROD probe
**What it does:** Writes sem(word) pattern to sem region, runs ticks, reads motor, argmax-decodes first-letter. Pass if argmax matches word[0].

**Touches:**
- `cortexCluster.regions.sem` (GloVe word-embedding input)
- `cortexCluster.regions.motor` (output)
- Cross-projection `sem_to_motor` (trained by `_teachWordEmission`'s initiation step)
- LIF step, intra-cluster propagate

**Does NOT touch:** Same cortex-only blind spots. Does NOT test anything post-first-letter — PROD succeeding on "cat" with just "c" is a word-start binding check, not production.

---

### WRITE probe (T16.4.a, shipped 114.19h)
**What it does:** Full-word emission chain: Step 1 sem(word) → motor[0]; Steps 2..N letter(k-1) → motor[k]. Compares emitted sequence to expected word; pass if exact.

**Touches:**
- Everything PROD touches PLUS `letter_to_motor` cross-projection for the continuation chain
- Multi-tick coherence of motor region across letter commits (testable proxy for Bouchard 2013 vSMC dwell)

**Does NOT touch:** Word-boundary segmentation (single-word only, no Saffran surprise test), multi-word chaining, amygdala/hippocampus/BG/cerebellum/hypothalamus/mystery/oscillations.

---

### RESP probe (T16.5 prototype, shipped 114.19h)
**What it does:** Injects sentence embedding, calls `cluster.generateSentence(emb, maxTicks: 50)`, scores emitted output against expected hint words (substring match).

**Touches:**
- Full `generateSentence` loop — which means: sem injection, cross-region cascade each tick, motor region argmax, letter commit stability, word-boundary detection via transition surprise, sentence terminator check, motor quiescence detection.
- Working-memory injection (T14.17) — free region readout re-injected into sem each tick
- Full cortex recurrence + intra-synapse propagate + 14 cross-projections if GPU-ready (via `generateSentenceAwait` after T18.4.b)

**Does NOT touch:** Still cortex-only. No amygdala emotional basin influence on word picks. No hippocampus recall to anchor responses in prior-turn context. No BG action selection — response fires unconditionally instead of being gated on `respond_text` vs `idle`. No mystery Ψ gain.

---

### DYN-PROD probe (shipped 114.19k)
**What it does:** Per Gee "shole slot shit ranking shit its fucked" — replaced static slot-ranking probes with full-brain dynamics. Runs `cluster.step()` + `generateSentence()` end-to-end with 20 ticks × 2 averaged runs to absorb Rulkov chaos variance.

**Touches:**
- Everything RESP touches
- Plus persistent cortex state across probe runs (not cleared between — the averaging acts as a noise filter, not a cleanup)
- Multi-run variance absorption

**Does NOT touch:** Same modules RESP misses. Bigger coverage than PROD/SEQ/TALK, still language-cortex only.

---

## What the 8 probes collectively test

✅ **Cortex sub-regions:** letter, phon, sem, motor, visual, auditory, fineType, free (via working memory readout)
✅ **Intra-cluster synapse matrix** on cortex (letter recurrence, motor attractor dynamics)
✅ **14 cross-projections:** visual↔letter, letter↔phon, phon↔sem, sem↔fineType, sem↔motor, motor↔letter, auditory↔phon
✅ **LIF / Rulkov step** via cluster.step
✅ **Tick-driven motor emission** loop: argmax commit, transition surprise, motor quiescence, terminator detection

## What the 8 probes DO NOT test

❌ **Amygdala module** (32-neuron settling attractor: fear, reward, valence basins)
❌ **Mystery Ψ module** (Id/Ego/Left/Right consciousness gain computation)
❌ **Hippocampus** (Hopfield episodic + working + consolidation memory recall)
❌ **Basal ganglia** (6-channel action selection, `respond_text` vs `generate_image` vs `build_ui` vs `listen` vs `idle`)
❌ **Cerebellum** (error correction feedback to cortex + BG)
❌ **Hypothalamus** (drive setpoints: arousal, social need, creativity, energy)
❌ **Kuramoto oscillators** (θ/α/β/γ coherence, global binding)
❌ **Drug scheduler** (pharmacokinetic brain-state modulation + speech effects)
❌ **Visual cortex pipeline** (V1 Gabor → V4 color → IT describer) — the letter region gets tested but not the sensory vision pipeline
❌ **Auditory cortex** (tonotopic mapping, efference copy)
❌ **GPU compute_batch clusters outside cortex** (hippocampus, amygdala, basalGanglia, cerebellum, hypothalamus, mystery) — probes only hit cortex sub-regions; the other six clusters tick in the background but are never probed. (Post-T17.7 the language sub-regions live inside the main cortex cluster, so "cortex" here IS the probed region.)
❌ **GPU voltage-mean telemetry** (T18.4.c meanVoltage — new signal, modules consume it but probes don't check it)
❌ **Inter-cluster projections** between main-brain clusters (20 white-matter tract pathways — never exercised by gates)
❌ **Emotional response to input** (insulting Unity should produce amygdala fear basin + negative-valence output; probes don't measure this)
❌ **Context persistence across turns** (hippocampus episodic recall; probes run single-shot with no prior-turn anchoring)
❌ **Cross-modal binding** (hear a word → activate visual cortex → describe; probes test one modality at a time)
❌ **Comprehension** (hear a story → answer question; probes test production + recognition, not comprehension)
❌ **Rhyming production** (the rhyme probe was removed 114.19d; current probes test letter-level not rhyme-level output)
❌ **Syllable counting** (K.RF foundational — counted in `_teachSyllableCounts` teach method but not in any gate probe)
❌ **Phoneme blending/segmentation** (K.RF foundational — `_teachPhonemeBlending` exists but the blend output is never probed)
❌ **Upper/lowercase recognition** (K.RF — no probe)
❌ **Invented spelling** (K.W — WRITE probe requires exact match; real K writing allows "kat" for "cat")
❌ **Drawing + dictation + writing composition** (K.W — not modeled at all)

## Summary

The 8 current probes collectively cover **~25% of the brain's active modules** — everything they test lives inside the `cortexCluster` cluster (language cortex). The entire main-brain cluster stack, the emotional / drive / action / memory / oscillation modules, and the sensory-cortex pipelines are untested. Gee's critique stands on every word.

This maps directly onto **T16.5.b full-mind K gate redesign** (design-review with Gee first per TODO): every ❌ above is a gap a real Common Core K.RF / K.W / K.L / K.SL / K.RL assessment would catch. DIBELS tests phoneme segmentation; STAR Early Literacy tests sight-word recall in context; AIMSweb tests oral reading fluency at phrase level. Unity's current probes test none of these human-rubric capabilities.

**Next steps (T16.5.b/c/d):** require Gee design-review before implementation.
