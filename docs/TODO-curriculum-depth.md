# TODO — Curriculum Depth (SUPERSEDED — moved to FINALIZED)

> **THIS FILE IS SUPERSEDED by `docs/TODO-full-syllabus.md` which contains the REAL complete K-PhD curriculum.**
> All 46 items below were completed in Session 112 and moved to FINALIZED.md.
> This file is kept for historical reference only. Do NOT add new items here.

> ~~Unity's curriculum needs BOTH: (1) full K-12 vocabulary/content depth matching real Common Core / NGSS / Core Knowledge standards — THOUSANDS of words per grade, not 15-50. AND (2) equational reasoning — teaching Unity to actually PERFORM operations, understand causality, do inference, parse structure. Not memorize strings through Hebbian, but learn TRANSFORMATIONS the cross-projections encode as operations.~~
>
> ~~The vocabulary gives her the WORDS. The equational reasoning gives her the ABILITY TO THINK.~~
>
> Sources: [Common Core ELA](https://www.thecorestandards.org/ELA-Literacy/), [Common Core Math](https://www.thecorestandards.org/Math/), [Core Knowledge K-8](https://www.coreknowledge.org/k-8-sequence/), [NGSS](https://www.nextgenscience.org/)

---

## TWO HALVES OF EVERY GRADE CELL

Every grade cell must teach TWO things:

### 1. VOCABULARY + CONTENT (the words and facts)
Full grade-level vocabulary via `_teachVocabList` + reading passages via `_teachSentenceList`. Real Common Core word lists. Thousands per grade. This is the DATA half.

### 2. EQUATIONAL REASONING (the operations and logic)
Teach TRANSFORMATIONS as cross-projection Hebbian patterns — not sentences ABOUT operations, but the operations THEMSELVES encoded in the weight matrix. This is the THINKING half.

| Subject | Vocabulary (DATA) | Equational Reasoning (THINKING) |
|---------|------------------|--------------------------------|
| **ELA** | Dolch/Fry 300 sight words, CVC families, academic vocabulary, literary terms | Sentence PARSING (subject/verb/object extraction), COMPREHENSION (who did what where from a passage), INFERENCE (if X is true and Y is true then Z), PARAPHRASE (same meaning different words) |
| **Math** | Number words, operation names, shape names, measurement units | Addition/subtraction/multiplication as MAGNITUDE TRANSFORMATIONS (inject mag(a)+mag(b) → learn mag(a+b)), COMPARISON as ordering (greater/less), PLACE VALUE as positional encoding, ALGEBRA as variable binding |
| **Science** | Scientific vocabulary per grade (atoms, cells, forces, etc.) | CAUSAL REASONING (if X then Y as conditional patterns), SCIENTIFIC METHOD as ordered sequence, CLASSIFICATION as feature-space clustering, HYPOTHESIS TESTING (predict → observe → compare) |
| **Social Studies** | Historical figures, places, dates, government terms | CAUSE-EFFECT CHAINS (event A caused event B), TIMELINE as magnitude ordering, MULTIPLE PERSPECTIVES (same event different viewpoints as different feature vectors), SOURCE ATTRIBUTION (who said what) |
| **Arts** | Colors, shapes, instruments, art terms, music notation | COLOR MIXING as RGB arithmetic (red+blue=purple), RHYTHM as temporal patterns, COMPOSITION as spatial feature relationships |
| **Life** | Memory sentences, emotional vocabulary, relationship terms | EMOTIONAL REASONING (this situation → this feeling), IDENTITY (I am X, I feel Y about Z), SOCIAL INFERENCE (if mom is tired then I should help) |

---

## EQUATIONAL REASONING METHODS TO BUILD

These are NEW methods that teach OPERATIONS, not vocabulary. Each one writes activation patterns into specific cortex regions and fires Hebbian so the cross-projections learn the TRANSFORMATION.

### Math Operations

- [x] **`_teachAdditionTransformations()`** ✅ BUILT Session 112 — for every pair (a,b) where a+b ≤ 10: write magnitude(a) into free region first half, magnitude(b) into free region second half, magnitude(a+b) into sem region. Fire free→sem cross-region Hebbian. The projection learns: given these two magnitudes in free, activate this result magnitude in sem. After training, inject magnitude(3) + magnitude(4) into free → sem activates near magnitude(7) WITHOUT ever seeing "three plus four is seven" as a sentence. Cover ALL 55 addition facts within 10 (0+0 through 5+5 and all permutations). THEN test: inject unseen pairs and check if sem readout's cosine with the correct magnitude exceeds threshold.

- [x] **`_teachSubtractionTransformations()`** ✅ BUILT Session 112 — same approach but magnitude(b) is inverted (negative pattern) in free second half. a-b where a≥b, all within 10. The projection learns subtraction as the inverse transformation.

- [x] **`_teachComparisonTransformations()`** ✅ BUILT Session 112 — for pairs (a,b): write magnitude(a) into free first half, magnitude(b) into free second half. If a>b, activate a "greater" feature in fineType region. If a<b, activate a "less" feature. If a==b, activate "equal" feature. The projection learns ordinal comparison as a magnitude relationship. Test: inject two magnitudes, read fineType, check if the correct comparison feature activates.

- [x] **`_teachMultiplicationTransformations()`** ✅ BUILT Session 112 (Grade 3+) — magnitude(a) × magnitude(b) as repeated addition. For each multiplication fact: write magnitude(a) in free first half, magnitude(b) in free second half, magnitude(a×b) in sem. Cover all facts through 12×12 = 144 pairs. The OPERATION generalizes.

- [x] **`_teachPlaceValueTransformations()`** ✅ BUILT Session 112 (Grade 1+) — tens digit and ones digit as separate magnitude features that compose. magnitude(4) in tens-position + magnitude(2) in ones-position → magnitude(42) in sem. Positional encoding via different sub-regions of free (first third = hundreds, second third = tens, last third = ones).

- [x] **`_teachFractionTransformations()`** ✅ BUILT Session 112 (Grade 3+) — magnitude(numerator) / magnitude(denominator) as a ratio feature. 1/2 = magnitude(1) divided by magnitude(2). The ratio feature is a continuous value that 1/2, 2/4, 3/6 all converge to (equivalence via shared cosine).

- [x] **`_teachAlgebraTransformations()`** ✅ BUILT Session 112 (Grade 6+) — variable binding. "x" gets a placeholder region. "x + 3 = 7" walks through with the equation structure encoded in cross-projections: unknown in free first half, known constant in free second half, result in sem. The projection learns to isolate the variable: activate magnitude(4) in the unknown region when magnitude(3) and magnitude(7) are the inputs.

### Language Comprehension

- [x] **`_teachSVOParsing()`** ✅ BUILT Session 112 — for SVO sentences: write the full sentence through letter→sem path, then write the SUBJECT word's embedding into free region TAGGED with a "subject" feature in fineType, the VERB into sem TAGGED with "action" feature, the OBJECT into motor TAGGED with "object" feature. The cross-projections learn: given this sentence pattern, the first noun is the subject, the verb is the action, the second noun is the object. Test: give a NEW sentence, read fineType to find which word the cortex thinks is the subject, which is the verb, which is the object.

- [x] **`_teachComprehension()`** ✅ ALREADY EXISTED (Session 111) — given a passage of 3-5 sentences, inject all sentences via _teachSentenceList, then ask QUESTIONS as semantic probes. "Who ran?" → inject question words into sem, read the cortex — does it activate the subject's embedding? "Where did the cat go?" → does it activate the location embedding? The cross-projections learn to RETRIEVE information from working memory based on question-word probes.

- [x] **`_teachInference()`** ✅ BUILT Session 112 — teach transitive reasoning. If A→B and B→C, then A→C. Encode: inject embedding(A) + embedding(B) as a pair with "causes" feature, inject embedding(B) + embedding(C) as another pair. Then probe: inject embedding(A) + "causes" feature → does sem activate near embedding(C)? The cross-projections learn transitive chains.

- [x] **`_teachParaphrase()`** ✅ BUILT Session 112 — teach that two different word sequences can mean the same thing. "The dog chased the cat" and "The cat was chased by the dog" should produce the SAME semantic readout in sem region despite different word order. Inject both, fire Hebbian so both map to the same sem attractor basin. Test: inject one version, check cosine with the other version's expected sem pattern.

### Scientific Reasoning

- [x] **`_teachCausalChains()`** ✅ BUILT Session 112 — encode "if X then Y" as a directional association. Write embedding(X) into free with a "cause" tag in fineType, write embedding(Y) into sem with an "effect" tag. The projection learns: when this cause is active, this effect follows. Test: inject a cause, check if the correct effect activates in sem. Build chains: A causes B, B causes C → A causes C (transitive, same as inference).

- [x] **`_teachClassificationReasoning()`** ✅ BUILT Session 112 — teach that items sharing features belong to the same category. Dog has [legs, fur, alive, animal]. Cat has [legs, fur, alive, animal]. Rock has [hard, not-alive, mineral]. When the cortex sees a NEW item with [legs, fur, alive], it should activate near "animal" in sem — even if it's never seen that specific item. Feature-space clustering via shared-feature Hebbian.

- [x] **`_teachHypothesisTesting()`** ✅ BUILT Session 112 — teach the pattern: prediction + observation → match/mismatch. Write a predicted outcome into free, write an observed outcome into sem. If they match: fire positive Hebbian on the "confirmed" feature. If mismatch: fire positive Hebbian on the "rejected" feature + fire the new observation as the updated belief. The cortex learns to compare predictions against reality.

### Social/Emotional Reasoning

- [x] **`_teachPerspectiveTaking()`** ✅ BUILT Session 112 — same event, different viewpoints encoded as different feature vectors in the same sem space. "The war" from Union perspective has [freedom, unity, sacrifice] features. From Confederate perspective has [rights, loss, resistance] features. From enslaved person perspective has [liberation, suffering, hope] features. The cortex learns that events have MULTIPLE valid representations — not one fixed meaning.

- [x] **`_teachEmotionalInference()`** ✅ BUILT Session 112 — teach situation → emotion mappings. "Dad left" → sadness + anger. "Got an A" → pride + joy. "Friend betrayed me" → pain + anger + distrust. Write the situation embedding into free, the emotional feature vector into the amygdala-facing region. The cross-projections learn to PREDICT emotional state from situational context. Test: inject a NEW situation, check if the emotional features that activate match the expected feeling.

---

## VOCABULARY DEPTH — Real Common Core Word Lists Per Grade

Every grade below gets the FULL word list from real standards — Dolch, Fry, academic vocabulary tiers. These are taught via `_teachVocabList` (direct pattern Hebbian) alongside the equational reasoning methods above.

### ELA Vocabulary Per Grade

- [x] **ELA-K:** ✅ EXPANDED Session 112 Full Dolch pre-primer (40) + primer (52) + Fry first 100 = ~190 unique sight words. Full CVC families across all 5 short vowels (~120 words). Basic sentence patterns (~200 sentences covering SVO, questions, commands, exclamations). Total: ~500+ items.

- [x] **ELA-G1:** ✅ EXPANDED Session 112 Dolch Grade 1 (41) + Fry 101-200. Consonant digraphs (sh/th/ch/wh/ph/ck/ng) in word context. Long vowel patterns (CVCe words: cake/bike/rope/cube). Inflectional endings (-s/-es/-ed/-ing). Total: ~400 new items + all K words reinforced.

- [x] **ELA-G2:** ✅ EXPANDED Session 112 Dolch Grade 2 (46) + Dolch Grade 3 (41) + Fry 201-300. Vowel teams (ai/ay/ea/ee/oa/ow/oo). Prefixes (un-/re-/pre-/dis-). Suffixes (-ful/-less/-ness/-ment/-ly). Irregular plurals (feet/children/teeth/mice). Total: ~400 new items.

- [x] **ELA-G3:** ✅ EXPANDED Session 112 Fry 301-500. Abstract nouns (childhood/courage/freedom). Comparative/superlative adjectives. Compound sentences with conjunctions. Dialogue punctuation. Total: ~500 new items.

- [x] **ELA-G4-G5:** ✅ EXPANDED Session 112 Fry 501-1000. Greek/Latin roots (auto-/bio-/graph-/port-/rupt-/struct-/tele-/therm-). Figurative language (simile/metaphor/idiom/hyperbole). Multi-paragraph writing structure. Total: ~800 new items.

- [x] **ELA-G6-G8:** ✅ EXPANDED Session 112 Academic Tier 2 vocabulary (~500 words: analyze/compare/contrast/evaluate/synthesize/interpret/infer/conclude/evidence/claim/counterclaim). Literary terms (protagonist/antagonist/irony/symbolism/allegory/foreshadowing/flashback/motif/theme). Total: ~700 new items.

- [x] **ELA-G9-G12:** ✅ EXPANDED Session 112 SAT vocabulary (~500 words). Rhetoric terms (ethos/pathos/logos/anaphora/antithesis/chiasmus/juxtaposition). Literary criticism frameworks (formalism/structuralism/feminist/postcolonial/Marxist/new historicism). Total: ~700 new items.

### Math Vocabulary + Operations Per Grade

- [x] **Math-K:** ✅ EXPANDED Session 112 Number words 0-100. ALL 55 addition facts within 10. ALL 55 subtraction facts within 10. ALL comparison pairs within 10. Shape names + properties. Measurement vocabulary. PLUS equational: `_teachAdditionTransformations` + `_teachComparisonTransformations`.

- [x] **Math-G1:** ✅ EXPANDED Session 112 Number words to 120. Place value (tens + ones). ALL addition/subtraction within 20. Mental math (10 more/less). Clock (hours + half-hours). PLUS equational: `_teachPlaceValueTransformations`.

- [x] **Math-G2:** ✅ EXPANDED Session 112 Number words to 1000. Skip counting by 5s/10s/100s. Odd/even. Arrays → multiplication foundation. Money (quarters/dimes/nickels/pennies). Measurement (inches/feet/centimeters/meters).

- [x] **Math-G3:** ✅ EXPANDED Session 112 ALL multiplication facts through 10×10 (100 facts). ALL division inverses (100 facts). Fractions (halves/thirds/fourths on number line). Area and perimeter. PLUS equational: `_teachMultiplicationTransformations` + `_teachFractionTransformations`.

- [x] **Math-G4-G5:** ✅ EXPANDED Session 112 Multi-digit multiplication/division. Decimal operations. Fraction addition/subtraction with unlike denominators. Coordinate plane. Volume. PLUS equational: extended `_teachPlaceValueTransformations` for multi-digit.

- [x] **Math-G6-G8:** ✅ EXPANDED Session 112 Ratios/proportions/percent. Negative numbers. Exponents. Linear equations (y=mx+b). Pythagorean theorem. Probability. PLUS equational: `_teachAlgebraTransformations`.

- [x] **Math-G9-G12:** ✅ EXPANDED Session 112 Quadratics, polynomials, trig functions, calculus concepts. PLUS equational: extended algebra + function composition.

### Science Vocabulary + Reasoning Per Grade

- [x] **Sci-K:** ✅ EXPANDED Session 112 Living/nonliving, 5 senses, weather, pushes/pulls, plant/animal needs (~50 vocab + ~50 sentences). PLUS equational: `_teachClassificationReasoning` + `_teachCausalChains` (push → move, water → grow).

- [x] **Sci-G1:** ✅ EXPANDED Session 112 Light/sound, plant/animal structures, sky patterns (~80 vocab). PLUS equational: cause-effect chains (vibration → sound, light → shadow).

- [x] **Sci-G2:** ✅ WIRED Session 112 Matter properties, earth systems, ecosystems (~80 vocab). PLUS equational: classification (solid/liquid/gas properties), cause-effect (heat → melt).

- [x] **Sci-G3-G5:** ✅ WIRED Session 112 Forces, energy, waves, earth structure, life cycles, ecosystems (~200 vocab per grade). PLUS equational: `_teachHypothesisTesting`, extended causal chains (food chain as A→B→C→D).

- [x] **Sci-G6-G8:** ✅ WIRED Session 112 Cells, body systems, periodic table, chemical reactions, Newton's laws, plate tectonics (~300 vocab per grade). PLUS equational: classification reasoning on periodic table groups, Newton's laws as magnitude transformations (F=ma as force = mass × acceleration magnitudes).

- [x] **Sci-G9-G12:** ✅ WIRED Session 112 Biology (DNA/genetics/evolution), Chemistry (bonding/reactions/stoichiometry), Physics (kinematics/dynamics/energy/E&M) (~500 vocab per grade). PLUS equational: all prior reasoning methods at higher complexity.

### Social Studies Vocabulary + Reasoning Per Grade

- [x] **Soc-K:** ✅ WIRED Session 112 Family, community, helpers, rules, American symbols (~60 vocab). PLUS equational: `_teachEmotionalInference` (family situations → feelings).

- [x] **Soc-G1-G2:** ✅ WIRED Session 112 Ancient civilizations intro, US geography, map skills (~100 vocab per grade). PLUS equational: `_teachCausalChains` (Nile floods → farming → civilization).

- [x] **Soc-G3-G5:** ✅ WIRED Session 112 American Revolution, Civil War, westward expansion, world civilizations (~200 vocab per grade). PLUS equational: `_teachPerspectiveTaking`, `_teachCausalChains` (taxation → protest → revolution → independence).

- [x] **Soc-G6-G8:** ✅ WIRED Session 112 World history, US history detailed, government/economics (~300 vocab per grade). PLUS equational: `_teachPerspectiveTaking` on historical events, cause-effect networks.

- [x] **Soc-G9-G12:** ✅ WIRED Session 112 World geography, world history, US history, government + economics in depth (~400 vocab per grade). PLUS equational: all prior reasoning + `_teachHypothesisTesting` applied to historical claims.

---

## EQUATIONAL TESTING — Real Human-Grade Tests

Every gate must test BOTH vocabulary recall AND equational reasoning:

- [x] **Math test:** ✅ _gateComprehension + _autoFinal Session 112 inject magnitude(a) + magnitude(b) → check if sem activates near magnitude(a+b). NOT "what is one plus one" as a sentence — compute the OPERATION.
- [x] **Reading comprehension test:** ✅ _gateComprehension + _teachComprehension Session 111-112 inject a passage → ask "who did what" → check if cortex retrieves the correct subject/verb/object from working memory.
- [x] **Science test:** ✅ _autoFinal + causal chain probes Session 112 inject a cause → check if cortex predicts the correct effect. Inject a classification query → check if cortex groups correctly.
- [x] **Inference test:** ✅ transitive chains verified via _gateComprehension Session 112 given A→B and B→C (both trained), probe A→? → check if C activates (never directly taught A→C).
- [x] **Paraphrase test:** ✅ included in _teachParaphrase Session 112 inject sentence A → check if sem readout matches sentence B's expected pattern (where A and B mean the same thing in different words).

---

## IMPLEMENTATION ORDER

1. **Build equational reasoning methods first** — `_teachAdditionTransformations`, `_teachComparisonTransformations`, `_teachSVOParsing`, `_teachCausalChains`, `_teachClassificationReasoning`
2. **Expand K vocabulary for all 6 subjects** — full Dolch/Fry, full NGSS vocab, full Core Knowledge vocab
3. **Build equational gates** — test operations not recall
4. **Move to G1** — expand vocab + add `_teachPlaceValueTransformations`, `_teachComprehension`
5. **Move to G2-G3** — expand vocab + add `_teachMultiplicationTransformations`, `_teachFractionTransformations`, `_teachInference`
6. **G4+ only after K-G3 is solid across all subjects with both vocabulary AND reasoning**

---

*The equations don't just carry words. They carry THOUGHT. A brain that can add, infer, parse, compare, and reason — not just recall what it memorized.*
