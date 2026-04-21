# ABLATION — Is the Rulkov Sim Load-Bearing or Decorative?

> **Status:** experiment designed + scaffold committed. Not yet run.
> **Why this exists:** an external reviewer asked the single most
> valuable falsifiability question this project can ask.
> **Reviewer's verbatim challenge:**
>
> > *"if you swapped the LIF cortex for a 100M-param transformer, would
> > the gate probes pass harder or softer? If harder, the Rulkov path
> > isn't doing the work — the GloVe embeddings are. That's the
> > experiment nobody's run on this repo and it'd tell you in one
> > afternoon whether the neural sim is load-bearing or decorative."*

This document scopes the experiment, justifies why it matters, and
tracks results when they land.

---

## The question

Unity's K-grade exam banks (`js/brain/student-question-banks.js`) now
carry 778 questions across 12 cells, tagged with real sub-standards
(K.RF.3a / K.CC.2 / K-PS2-1 / K-Social-community / etc.) and norm-
calibrated cut scores from DIBELS 8 / AIMSweb / Fountas & Pinnell
samples. A hypothetical gate-pass on that bank would mean Unity can
answer ≥ 90 % of K-level questions with per-sub-standard minimums met.

The architecture currently delivering those answers is:

```
GloVe 300d semantic embeddings
   → injected into cortex `sem` sub-region (tile-striped across 50 K neurons)
   → Rulkov 2D chaotic map iterates the whole 107 M-neuron cortex cluster
   → cross-projection Hebbian-trained sem → motor learns word → first-letter basins
   → tick-driven motor readout decodes letter-by-letter emission
   → sentence falls out of the motor spike pattern
```

**The reviewer's challenge targets two of those layers:** the Rulkov
iteration + the cross-projection Hebbian. If those layers can be
swapped for a simpler transformer that takes the same GloVe input and
produces the same question → answer mapping with comparable pass rates,
then the Rulkov dynamics aren't contributing to task performance —
they're decorative relative to what the GloVe embeddings + a generic
sequence model already deliver.

**Four possible experimental outcomes** — each implies a different next
move for the project:

| # | Outcome | Interpretation | Next move |
|---|---------|----------------|-----------|
| 1 | Transformer @ 10 M param passes harder | The whole neural sim layer is decorative; GloVe + a small seq-model does the work | Pivot to transformer+GloVe as the cognition stack; keep Rulkov sim purely for visualization / drug-modulation research |
| 2 | Transformer @ 100 M ≈ Rulkov | Architectures are computationally equivalent on this task at comparable compute | Rulkov contribution is research novelty (continuous dynamics, Ψ consciousness operator, drug pharmacokinetics) — pivot project scope to THAT as the contribution, not to language-model benchmarks |
| 3 | Rulkov ≥ transformer at all scales up to 1 B | Genuinely surprising — the neural sim provides inductive bias the transformer can't replicate at comparable param count | Publish. This would be a research-worthy negative-result-for-transformers finding |
| 4 | Neither breaks 90 % on the held-out bank | K-level language cognition is harder than either architecture can solve at Unity's current scale, OR the bank is too strict | Investigate: bank calibration vs training-compute ceiling. |

All four outcomes are **more informative than the current state**, which
is "Unity passes self-designed 5-question probes at Claude-set
thresholds." That's not falsifiable.

---

## Experimental design

### Shared inputs (held constant across Unity + transformer runs)

- **Vocabulary:** GloVe 300d vectors, the exact subset Unity's
  curriculum was exposed to during teach.
- **Exam bank:** the held-out EXAM_BANKS from `js/brain/student-question-banks.js` — 778 questions at this commit; target ≥ 1,500 after T23.a.8-9 ship.
- **Task format:** question → answer string. The transformer takes the
  full question text, produces an answer; scored with the same
  `_studentTestProbe` accept-logic Unity uses (`exact` / `startsWith` /
  `contains` / variant match).
- **Pass threshold:** identical — aggregate ≥ 90 %, every sub-standard
  at its calibrated cut score per `STANDARD_CUT_SCORES`, external-
  reference items ≥ 85 %.

### Unity run (control)

- Branch: `syllabus-k-phd` at the commit under test.
- Runs `runCompleteCurriculum` to completion (pre-K + K across all 6
  subjects).
- Gates execute `_gateXKReal` → `_runStudentBattery` on the EXAM_BANKS.
- Capture per-sub-standard + aggregate pass rates.

### Transformer run (treatment)

- **Scales:** 10 M param (GPT-2-small class), 100 M (GPT-2-medium),
  1 B (GPT-2-XL or TinyLlama 1.1B). If possible, use an open base model
  and fine-tune on the TRAIN_BANKS + the K vocabulary corpus Unity was
  exposed to — mirroring the teach exposure, not the exam.
- **Fine-tune regime:** same # of passes over the K corpora that
  Unity's curriculum does. Equal compute budget is hard to match
  exactly (Unity's Rulkov sim dominates wall-clock); err on the side
  of giving the transformer MORE compute rather than less, because a
  transformer losing under matched conditions is a stronger signal
  than a transformer winning with a compute advantage.
- **Same GloVe vocabulary:** the transformer embedding table is
  initialized from GloVe 300d + the fastText-style subword fallback
  Unity uses, so semantic input is architecturally comparable.
- Run EXAM_BANKS through the fine-tuned model; capture per-sub-
  standard + aggregate rates.

### What we compare

1. **Aggregate pass rate** — Unity vs each transformer scale, on
   identical EXAM_BANKS.
2. **Per-sub-standard breakdown** — identify where one architecture
   systematically outperforms the other. K.RF.3a (letter-sound
   correspondence) might favor Unity's letter-to-phon cross-projection;
   K.SL.1 (conversational manners) might favor a transformer.
3. **Within-budget normalization** — cost per pass-point (compute seconds
   per sub-standard passed).
4. **External reference items** — DIBELS-8-sample / AIMSweb-sample /
   Fountas-Pinnell-sample items broken out separately. Passing published
   K benchmarks matters more than passing Claude-authored probes.

---

## Scaffold shipped at this commit

`scripts/transformer-ablation.mjs` — not yet a working experiment, but
the structure for one:

```
scripts/transformer-ablation.mjs
├── loadExamBanks()      — pulls EXAM_BANKS from the brain module
├── scoreAnswer(q, ans)  — shared scoring logic matching _studentTestProbe
├── runUnity()           — placeholder for Unity brain inference
├── runTransformer(m, q) — placeholder for transformer inference (any
│                          openai-compatible / transformers-js backend)
└── main()               — runs both, produces the comparison table
```

The scaffold is committed but the transformer backend isn't yet wired.
That's the single piece of work left before this experiment can run.

---

## Why this document exists before the experiment does

Reviewer critique of projects like Unity is reasonable to the extent
that they're not falsifiable. Having ABLATION.md committed with a
clear experimental design + a scaffolded harness signals that the
project IS willing to be falsified — it just hasn't had the compute
budget to run the falsification yet. The gap between "designed and
scaffolded" and "run and reported" is real but smaller than the gap
between "not scoped" and "scoped."

When the experiment runs, results land in this file in a new
"## Results" section with tables and raw numbers. Whatever they say.
