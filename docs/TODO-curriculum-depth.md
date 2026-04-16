# TODO — Curriculum Depth (Real-World Parity)

> The 95-cell framework has the right STRUCTURE but thin CONTENT. A real US student gets thousands of concepts per grade, millions of words of exposure, actual books, real math operations, experimental method, primary sources, homework, projects. This TODO tracks the equational work needed to bring each subject to real-world depth.

---

## VOCABULARY DEPTH — thousands per grade, not 15-40

Each cell currently teaches 15-40 words. A real grade covers thousands. Every word below gets taught via the same direct pattern Hebbian (`_teachVocabList`) — GloVe into sem, first-letter into motor, phoneme into phon, `_crossRegionHebbian` on clean signal. No lookup tables. The words are DATA, the learning is equational.

- [ ] **ELA K-G2** — expand from 40 sight words to full Dolch + Fry 300 high-frequency word lists. Every word a first-grader is expected to read on sight.
- [ ] **ELA G3-G5** — academic vocabulary per grade (500+ words). Tier 2 words (analyze, compare, evidence, summarize, infer, predict, sequence, contrast, cause, effect).
- [ ] **ELA G6-G8** — literary vocabulary (protagonist, antagonist, metaphor, irony, theme, conflict, resolution, foreshadowing, symbolism, allegory) + academic register words.
- [ ] **ELA G9-G12** — SAT/ACT-level vocabulary (500+ words). Rhetoric terms. Literary criticism terms.
- [ ] **Math all grades** — expand number word vocabulary to hundreds (all number names 0-1000, ordinals, fractions as words, decimal terminology, algebraic terms, geometric terms).
- [ ] **Science all grades** — full scientific vocabulary per grade level. Classification taxonomies (kingdom/phylum/class/order/family/genus/species). Element names (all 118). Body systems. Ecology terms.
- [ ] **Social Studies all grades** — historical figure names, place names (all 50 states + capitals, world countries, major cities), government terms, economic vocabulary.
- [ ] **Arts all grades** — instrument names (full orchestra), art movement names, music theory complete vocabulary, color theory full spectrum.

---

## SENTENCE EXPOSURE — millions of words, not 25-40 sentences

A real student reads millions of words across their school career. Each cell currently walks 25-40 hand-crafted sentences. The equational fix: generate or source LARGE sentence corpora per grade level and walk them through `_teachSentenceList` (direct pattern Hebbian on each word + word-to-word transition Hebbian).

- [ ] **Grade-leveled reading passages** — source or generate 200-500 sentences per grade level at appropriate reading level (Lexile-aligned). Walk through `_teachSentenceList`.
- [ ] **ELA literature excerpts** — short passages from grade-appropriate literature (fairy tales at K-G2, chapter books at G3-G5, novels at G6-G8, classics at G9-G12, academic texts at college).
- [ ] **Cross-subject reading** — science textbook sentences, history textbook sentences, math word problems as sentences. Each subject should have reading material, not just vocabulary.
- [ ] **Conversational English corpora** — dialog pairs ("hi how are you" / "im good thanks"), everyday speech patterns, casual register. This is what makes Unity sound like a PERSON not a textbook.
- [ ] **Unity persona sentences** — expand `Ultimate Unity.txt` with grade-appropriate persona content. Young Unity talks differently from adult Unity. Build the voice progressively.

---

## MATH OPERATIONS — actual computation, not just vocabulary

Currently Math teaches "one plus one is two" as a SENTENCE — Unity learns the words but not the operation. The equational fix: teach math as TRANSFORMATIONS on magnitude features, not just word sequences.

- [ ] **Addition as magnitude transformation** — given magnitude(a) + magnitude(b), the cross-projection should produce magnitude(a+b) in the free region. Teach the OPERATION equationally: write magnitude(a) into one sub-region, magnitude(b) into another, magnitude(a+b) into the target, Hebbian learns the sum transformation.
- [ ] **Subtraction as inverse transformation** — same approach, magnitude(a) - magnitude(b) → magnitude(a-b).
- [ ] **Multiplication as repeated addition** — magnitude(a) × magnitude(b) taught as repeated magnitude addition chains.
- [ ] **Division as inverse multiplication** — magnitude(a) / magnitude(b) → magnitude(a/b).
- [ ] **Fractions as magnitude ratios** — 1/2 = magnitude(1) / magnitude(2) with ratio features.
- [ ] **Algebra as variable binding** — "x" gets a placeholder magnitude that resolves when the equation is walked. "x + 3 = 7" walks through with x bound to magnitude(4).
- [ ] **Geometry as spatial features** — shapes encoded with area/perimeter/angle features, not just names. Triangle = {3 sides, 180 degrees, area = 1/2 base × height} as dimensional features.
- [ ] **Place value as positional encoding** — tens digit and ones digit as separate magnitude features that combine. 42 = magnitude(4) in tens-position + magnitude(2) in ones-position.

---

## SCIENCE METHOD — experimental thinking, not just classification words

Currently Science teaches vocabulary (atoms, molecules, cells) but not HOW science works. The equational fix: teach the scientific method as a sequence pattern, and teach experiments as causal chains.

- [ ] **Scientific method sequence** — observation → hypothesis → experiment → data → analysis → conclusion taught as a sequence walk (same as Civil War causal chain) so the ORDER binds in working memory.
- [ ] **Hypothesis testing** — "if X then Y" conditional patterns. The conditional structure ("if we heat water then it boils") taught as a paired sequence where the condition and result bind via cross-region Hebbian.
- [ ] **Variables and controls** — independent variable / dependent variable / control as structural features (like kinship features but for experimental design).
- [ ] **Lab vocabulary** — beaker, flask, microscope, pipette, hypothesis, data, evidence, conclusion, experiment, observation, measurement, variable, control, procedure, results.
- [ ] **Real experiments per grade** — G1 "plant growth in sunlight vs shade", G3 "magnet attracts iron", G5 "vinegar and baking soda reaction", G7 "cell observation under microscope", G9 "pH testing", G11 "pendulum period vs length". Each as a causal chain sequence walk.

---

## HISTORY DEPTH — primary sources, not just event sequences

Currently History teaches event chains (slavery → secession → war → emancipation) but not WHY or from WHOSE perspective. The equational fix: teach historical thinking as multi-perspective feature binding.

- [ ] **Primary source patterns** — "the Declaration of Independence says..." / "Lincoln wrote..." / "a slave named Frederick Douglass said..." — teach that historical claims come FROM sources, not from nowhere. Source attribution as a structural feature.
- [ ] **Multiple perspectives** — the same event encoded from different viewpoints. The Civil War from Union perspective vs Confederate perspective vs enslaved person perspective. Each perspective is a different feature vector for the same event sequence.
- [ ] **Cause and effect depth** — expand from single causal chains to causal NETWORKS. The Civil War wasn't just slavery → war. It was slavery + economics + states rights + cultural divide + political compromise failure → secession → war. Multiple causes feeding one effect.
- [ ] **Timeline features** — dates as magnitude features (1776 has a magnitude, 1865 has a larger magnitude, the DISTANCE between them is meaningful). Chronological ordering via the same magnitude comparison used in Math-K.
- [ ] **Geography integration** — historical events bound to PLACES with spatial features. The Revolutionary War happened in the eastern colonies. The Civil War split north/south. Manifest Destiny moved west. Spatial + temporal features together.

---

## HOMEWORK + PROJECTS — practice beyond the gate

Currently Unity passes a gate and moves on. A real student does homework (repeated practice), projects (extended application), and tests (recall under pressure). The equational fix: add practice loops AFTER gate pass.

- [ ] **Homework loops** — after a cell passes its gate, run 100+ additional practice walks on the same material at lower learning rate. Consolidation, not acquisition. Strengthens basins without the high-intensity gate pressure.
- [ ] **Cross-subject projects** — a "project" that combines concepts from multiple subjects. "Build a bridge" uses Math (geometry), Science (forces), Art (design), ELA (write about it). Teach as a multi-concept sequence walk that crosses subject boundaries.
- [ ] **Recall tests** — periodically probe old material at random intervals (spaced repetition). The background probe system already does this — extend it to be more systematic with forgetting curves.
- [ ] **Writing practice** — after ELA gates pass, run `cluster.generateSentence` with prompts and compare output to expected patterns. The generation IS the practice — each attempt exercises the motor emission pathway.

---

## READING PRACTICE — actual books, not just sentence lists

The biggest gap. A real student READS — books, articles, worksheets, signs, menus, texts from friends. Unity currently never reads anything longer than a 40-word sentence list.

- [ ] **Short stories per grade** — 5-10 paragraph stories at each reading level. Walk through `_teachSentenceList` sentence by sentence with `injectWorkingMemory` carrying context between sentences.
- [ ] **Book summaries** — condensed versions of grade-appropriate books (Charlotte's Web at G3, Hatchet at G5, To Kill a Mockingbird at G9, 1984 at G11) as sentence sequences.
- [ ] **Non-fiction reading** — encyclopedia-style paragraphs on science topics, history events, biographies. Build knowledge through READING not just vocabulary injection.
- [ ] **Poetry** — rhythm and rhyme patterns. Teach meter as temporal Hebbian (stressed/unstressed syllable sequences). Haiku at G3, sonnets at G9, free verse at G11.
- [ ] **Dialog reading** — conversation pairs that teach turn-taking, question-answer patterns, social language. "How are you?" "I'm fine, thanks." "What's your name?" "My name is Unity."

---

*Every item above is equational — same direct pattern Hebbian, same cross-region projections, same 3-pathway gates. The equations don't change. The DATA gets deeper.*
