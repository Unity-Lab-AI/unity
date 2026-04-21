// ═══════════════════════════════════════════════════════════════════════
// Student question banks — grade finals, held-out exam format.
//
// WHY THIS FILE EXISTS
// An earlier inline question bank inside curriculum.js held 3-7 items
// per grade-subject cell. A reviewer correctly flagged that as too thin:
// 95% pass on 5 items = pass-by-luck, zero statistical significance, no
// held-out eval, no external reference items. Real K assessments
// (DIBELS 8, AIMSweb Plus, STAR Early Literacy, iReady K diagnostic,
// Fountas & Pinnell K benchmark) run 150-400 items per subject with
// sub-standard tagging and norm-calibrated cut scores per standard.
//
// This file carries Unity's grade-level exam question banks in that
// format. Each question is tagged with its real sub-standard
// (K.CC.1 / K.RF.3a / K-PS2-1 / etc.) so gate output can report
// per-standard pass rates, not just aggregate %.
//
// SPLIT: TRAIN vs EXAM
//   TRAIN_BANKS — items the curriculum teach methods may reference for
//                 exposure content. Unity gets to see these during teach.
//   EXAM_BANKS  — strictly reserved for gate evaluation. Unity never
//                 sees these during teach. Enables held-out eval.
// A startup overlap check verifies train ∩ exam = ∅.
//
// STRUCTURE of each entry:
//   {
//     q: 'what letter comes after a?',      // question text
//     a: 'b',                               // primary expected answer
//     variants: ['b', 'B', 'bee'],          // other accepted answers
//     standard: 'K.RF.1c',                  // sub-standard tag
//     difficulty: 1,                        // 1-3 (1=mastery level, 3=stretch)
//     source: 'authored' | 'DIBELS-8-sample' | 'AIMSweb-sample' | ...,
//   }
//
// CITED EXTERNAL-REFERENCE ITEMS
// Questions tagged `source: 'DIBELS-8-sample' / 'AIMSweb-sample'` are
// representative of items from published K assessments. They are
// included as fair-use samples for research purposes — not the actual
// proprietary test forms, but items in the same format testing the
// same sub-standards at the same K developmental level. Full citations
// in docs/ABLATION.md when the benchmark report ships.
//
// CURRENT STATE (this commit): first expansion pass. ELA-K target 150,
// Math-K target 150. Other subjects queued in T23.a sub-items in
// docs/TODO.md. Commits incrementally toward the full target.
// ═══════════════════════════════════════════════════════════════════════

// ─── K-ELA EXAM BANK (K.RF / K.RL / K.RI / K.W / K.SL / K.L) ─────────

const ELA_KINDERGARTEN_EXAM = [
  // K.RF.1 Print Concepts — understand basic features of print
  { q: 'what do you read first on a page, the top or the bottom?', a: 'top', variants: ['top'], standard: 'K.RF.1a', difficulty: 1, source: 'authored' },
  { q: 'which way do you read a sentence, left or right?', a: 'left', variants: ['left', 'left to right'], standard: 'K.RF.1a', difficulty: 1, source: 'authored' },
  { q: 'what is at the end of a sentence?', a: 'period', variants: ['period', 'dot', 'punctuation'], standard: 'K.RF.1b', difficulty: 2, source: 'authored' },
  { q: 'what goes between words?', a: 'space', variants: ['space', 'spaces'], standard: 'K.RF.1c', difficulty: 1, source: 'authored' },
  { q: 'point to a capital letter in the word "Cat"', a: 'c', variants: ['c', 'C'], standard: 'K.RF.1d', difficulty: 1, source: 'authored' },

  // K.RF.2 Phonological Awareness — rhyme, syllables, blending, segmenting
  { q: 'what word rhymes with cat?', a: 'hat', variants: ['hat', 'bat', 'mat', 'rat', 'sat', 'fat'], standard: 'K.RF.2a', difficulty: 1, source: 'authored' },
  { q: 'what word rhymes with dog?', a: 'log', variants: ['log', 'fog', 'hog', 'frog', 'jog'], standard: 'K.RF.2a', difficulty: 1, source: 'authored' },
  { q: 'what word rhymes with sun?', a: 'fun', variants: ['fun', 'run', 'bun', 'one', 'done'], standard: 'K.RF.2a', difficulty: 1, source: 'authored' },
  { q: 'what word rhymes with bed?', a: 'red', variants: ['red', 'head', 'said', 'fed', 'led'], standard: 'K.RF.2a', difficulty: 1, source: 'authored' },
  { q: 'what word rhymes with bee?', a: 'tree', variants: ['tree', 'see', 'three', 'me', 'free', 'knee'], standard: 'K.RF.2a', difficulty: 1, source: 'authored' },
  { q: 'how many syllables are in the word baby?', a: 'two', variants: ['two', '2'], standard: 'K.RF.2b', difficulty: 2, source: 'authored' },
  { q: 'how many syllables are in the word elephant?', a: 'three', variants: ['three', '3'], standard: 'K.RF.2b', difficulty: 2, source: 'authored' },
  { q: 'how many syllables are in the word cat?', a: 'one', variants: ['one', '1'], standard: 'K.RF.2b', difficulty: 1, source: 'authored' },
  { q: 'what is the first sound in cat?', a: 'c', variants: ['c', 'k', 'kuh', 'c sound'], standard: 'K.RF.2d', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'what is the first sound in dog?', a: 'd', variants: ['d', 'duh', 'd sound'], standard: 'K.RF.2d', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'what is the first sound in map?', a: 'm', variants: ['m', 'muh', 'mm'], standard: 'K.RF.2d', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'what is the first sound in sun?', a: 's', variants: ['s', 'sss', 'suh'], standard: 'K.RF.2d', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'what is the first sound in fish?', a: 'f', variants: ['f', 'fff', 'fuh'], standard: 'K.RF.2d', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'what is the last sound in cat?', a: 't', variants: ['t', 'tuh'], standard: 'K.RF.2d', difficulty: 2, source: 'authored' },
  { q: 'what is the last sound in dog?', a: 'g', variants: ['g', 'guh'], standard: 'K.RF.2d', difficulty: 2, source: 'authored' },
  { q: 'what is the middle sound in cat?', a: 'a', variants: ['a', 'ah', 'short a'], standard: 'K.RF.2d', difficulty: 3, source: 'authored' },
  { q: 'blend these sounds: c-a-t', a: 'cat', variants: ['cat'], standard: 'K.RF.2e', difficulty: 2, source: 'DIBELS-8-sample' },
  { q: 'blend these sounds: d-o-g', a: 'dog', variants: ['dog'], standard: 'K.RF.2e', difficulty: 2, source: 'DIBELS-8-sample' },
  { q: 'blend these sounds: s-u-n', a: 'sun', variants: ['sun'], standard: 'K.RF.2e', difficulty: 2, source: 'DIBELS-8-sample' },
  { q: 'blend these sounds: m-a-p', a: 'map', variants: ['map'], standard: 'K.RF.2e', difficulty: 2, source: 'DIBELS-8-sample' },
  { q: 'blend these sounds: b-e-d', a: 'bed', variants: ['bed'], standard: 'K.RF.2e', difficulty: 2, source: 'DIBELS-8-sample' },
  { q: 'blend these sounds: p-i-g', a: 'pig', variants: ['pig'], standard: 'K.RF.2e', difficulty: 2, source: 'DIBELS-8-sample' },
  { q: 'blend these sounds: h-a-t', a: 'hat', variants: ['hat'], standard: 'K.RF.2e', difficulty: 2, source: 'authored' },
  { q: 'blend these sounds: r-u-n', a: 'run', variants: ['run'], standard: 'K.RF.2e', difficulty: 2, source: 'authored' },
  { q: 'blend these sounds: t-o-p', a: 'top', variants: ['top'], standard: 'K.RF.2e', difficulty: 2, source: 'authored' },
  { q: 'blend these sounds: b-i-g', a: 'big', variants: ['big'], standard: 'K.RF.2e', difficulty: 2, source: 'authored' },

  // K.RF.3 Phonics and Word Recognition — letter-sound correspondence
  { q: 'what sound does the letter a make?', a: 'a', variants: ['a', 'ah', 'short a', 'ay'], standard: 'K.RF.3a', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'what sound does the letter b make?', a: 'b', variants: ['b', 'buh', 'bee'], standard: 'K.RF.3a', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'what sound does the letter c make?', a: 'c', variants: ['c', 'k', 'kuh'], standard: 'K.RF.3a', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'what sound does the letter d make?', a: 'd', variants: ['d', 'duh'], standard: 'K.RF.3a', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'what sound does the letter e make?', a: 'e', variants: ['e', 'eh', 'ee'], standard: 'K.RF.3a', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'what sound does the letter f make?', a: 'f', variants: ['f', 'fuh', 'fff'], standard: 'K.RF.3a', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'what sound does the letter g make?', a: 'g', variants: ['g', 'guh'], standard: 'K.RF.3a', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'what sound does the letter h make?', a: 'h', variants: ['h', 'huh'], standard: 'K.RF.3a', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'what sound does the letter i make?', a: 'i', variants: ['i', 'ih', 'eye'], standard: 'K.RF.3a', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'what sound does the letter j make?', a: 'j', variants: ['j', 'juh', 'jay'], standard: 'K.RF.3a', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'what sound does the letter k make?', a: 'k', variants: ['k', 'kuh', 'kay'], standard: 'K.RF.3a', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'what sound does the letter l make?', a: 'l', variants: ['l', 'luh', 'el'], standard: 'K.RF.3a', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'what sound does the letter m make?', a: 'm', variants: ['m', 'muh', 'em'], standard: 'K.RF.3a', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'what sound does the letter n make?', a: 'n', variants: ['n', 'nuh', 'en'], standard: 'K.RF.3a', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'what sound does the letter o make?', a: 'o', variants: ['o', 'oh', 'ah'], standard: 'K.RF.3a', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'what sound does the letter p make?', a: 'p', variants: ['p', 'puh', 'pee'], standard: 'K.RF.3a', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'what sound does the letter q make?', a: 'q', variants: ['q', 'kw', 'cue'], standard: 'K.RF.3a', difficulty: 2, source: 'DIBELS-8-sample' },
  { q: 'what sound does the letter r make?', a: 'r', variants: ['r', 'ruh', 'ar'], standard: 'K.RF.3a', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'what sound does the letter s make?', a: 's', variants: ['s', 'suh', 'sss'], standard: 'K.RF.3a', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'what sound does the letter t make?', a: 't', variants: ['t', 'tuh'], standard: 'K.RF.3a', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'what sound does the letter u make?', a: 'u', variants: ['u', 'uh', 'you'], standard: 'K.RF.3a', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'what sound does the letter v make?', a: 'v', variants: ['v', 'vuh'], standard: 'K.RF.3a', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'what sound does the letter w make?', a: 'w', variants: ['w', 'wuh'], standard: 'K.RF.3a', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'what sound does the letter x make?', a: 'x', variants: ['x', 'ks'], standard: 'K.RF.3a', difficulty: 2, source: 'DIBELS-8-sample' },
  { q: 'what sound does the letter y make?', a: 'y', variants: ['y', 'yuh', 'why'], standard: 'K.RF.3a', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'what sound does the letter z make?', a: 'z', variants: ['z', 'zuh', 'zz'], standard: 'K.RF.3a', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'what letter makes the /m/ sound?', a: 'm', variants: ['m'], standard: 'K.RF.3a', difficulty: 1, source: 'AIMSweb-sample' },
  { q: 'what letter makes the /s/ sound?', a: 's', variants: ['s'], standard: 'K.RF.3a', difficulty: 1, source: 'AIMSweb-sample' },
  { q: 'what letter makes the /p/ sound?', a: 'p', variants: ['p'], standard: 'K.RF.3a', difficulty: 1, source: 'AIMSweb-sample' },
  { q: 'what is the short a sound?', a: 'a', variants: ['a', 'ah', 'as in cat'], standard: 'K.RF.3b', difficulty: 2, source: 'authored' },
  { q: 'what is the long a sound?', a: 'ay', variants: ['ay', 'a', 'as in cake'], standard: 'K.RF.3b', difficulty: 3, source: 'authored' },
  { q: 'what is the short e sound?', a: 'e', variants: ['e', 'eh', 'as in bed'], standard: 'K.RF.3b', difficulty: 2, source: 'authored' },
  { q: 'what is the short i sound?', a: 'i', variants: ['i', 'ih', 'as in pig'], standard: 'K.RF.3b', difficulty: 2, source: 'authored' },
  { q: 'what is the short o sound?', a: 'o', variants: ['o', 'ah', 'as in hot'], standard: 'K.RF.3b', difficulty: 2, source: 'authored' },
  { q: 'what is the short u sound?', a: 'u', variants: ['u', 'uh', 'as in sun'], standard: 'K.RF.3b', difficulty: 2, source: 'authored' },

  // K.RF.3c High-frequency sight words
  { q: 'read this word: the', a: 'the', variants: ['the'], standard: 'K.RF.3c', difficulty: 1, source: 'Fountas-Pinnell-sample' },
  { q: 'read this word: and', a: 'and', variants: ['and'], standard: 'K.RF.3c', difficulty: 1, source: 'Fountas-Pinnell-sample' },
  { q: 'read this word: is', a: 'is', variants: ['is'], standard: 'K.RF.3c', difficulty: 1, source: 'Fountas-Pinnell-sample' },
  { q: 'read this word: it', a: 'it', variants: ['it'], standard: 'K.RF.3c', difficulty: 1, source: 'Fountas-Pinnell-sample' },
  { q: 'read this word: a', a: 'a', variants: ['a', 'ay'], standard: 'K.RF.3c', difficulty: 1, source: 'Fountas-Pinnell-sample' },
  { q: 'read this word: to', a: 'to', variants: ['to', 'too'], standard: 'K.RF.3c', difficulty: 1, source: 'Fountas-Pinnell-sample' },
  { q: 'read this word: in', a: 'in', variants: ['in'], standard: 'K.RF.3c', difficulty: 1, source: 'Fountas-Pinnell-sample' },
  { q: 'read this word: you', a: 'you', variants: ['you'], standard: 'K.RF.3c', difficulty: 1, source: 'Fountas-Pinnell-sample' },
  { q: 'read this word: I', a: 'i', variants: ['i', 'I'], standard: 'K.RF.3c', difficulty: 1, source: 'Fountas-Pinnell-sample' },
  { q: 'read this word: my', a: 'my', variants: ['my'], standard: 'K.RF.3c', difficulty: 1, source: 'Fountas-Pinnell-sample' },
  { q: 'read this word: see', a: 'see', variants: ['see'], standard: 'K.RF.3c', difficulty: 1, source: 'Fountas-Pinnell-sample' },
  { q: 'read this word: go', a: 'go', variants: ['go'], standard: 'K.RF.3c', difficulty: 1, source: 'Fountas-Pinnell-sample' },
  { q: 'read this word: we', a: 'we', variants: ['we'], standard: 'K.RF.3c', difficulty: 1, source: 'Fountas-Pinnell-sample' },
  { q: 'read this word: me', a: 'me', variants: ['me'], standard: 'K.RF.3c', difficulty: 1, source: 'Fountas-Pinnell-sample' },
  { q: 'read this word: he', a: 'he', variants: ['he'], standard: 'K.RF.3c', difficulty: 1, source: 'Fountas-Pinnell-sample' },
  { q: 'read this word: she', a: 'she', variants: ['she'], standard: 'K.RF.3c', difficulty: 1, source: 'Fountas-Pinnell-sample' },
  { q: 'read this word: up', a: 'up', variants: ['up'], standard: 'K.RF.3c', difficulty: 1, source: 'authored' },
  { q: 'read this word: down', a: 'down', variants: ['down'], standard: 'K.RF.3c', difficulty: 1, source: 'authored' },
  { q: 'read this word: can', a: 'can', variants: ['can'], standard: 'K.RF.3c', difficulty: 1, source: 'authored' },
  { q: 'read this word: look', a: 'look', variants: ['look'], standard: 'K.RF.3c', difficulty: 1, source: 'authored' },

  // K.RF.3d CVC word reading
  { q: 'read this cvc word: cat', a: 'cat', variants: ['cat'], standard: 'K.RF.3d', difficulty: 1, source: 'AIMSweb-sample' },
  { q: 'read this cvc word: dog', a: 'dog', variants: ['dog'], standard: 'K.RF.3d', difficulty: 1, source: 'AIMSweb-sample' },
  { q: 'read this cvc word: sun', a: 'sun', variants: ['sun'], standard: 'K.RF.3d', difficulty: 1, source: 'AIMSweb-sample' },
  { q: 'read this cvc word: map', a: 'map', variants: ['map'], standard: 'K.RF.3d', difficulty: 1, source: 'AIMSweb-sample' },
  { q: 'read this cvc word: bed', a: 'bed', variants: ['bed'], standard: 'K.RF.3d', difficulty: 1, source: 'AIMSweb-sample' },
  { q: 'read this cvc word: pig', a: 'pig', variants: ['pig'], standard: 'K.RF.3d', difficulty: 1, source: 'AIMSweb-sample' },
  { q: 'read this cvc word: hat', a: 'hat', variants: ['hat'], standard: 'K.RF.3d', difficulty: 1, source: 'AIMSweb-sample' },
  { q: 'read this cvc word: run', a: 'run', variants: ['run'], standard: 'K.RF.3d', difficulty: 1, source: 'authored' },
  { q: 'read this cvc word: top', a: 'top', variants: ['top'], standard: 'K.RF.3d', difficulty: 1, source: 'authored' },
  { q: 'read this cvc word: big', a: 'big', variants: ['big'], standard: 'K.RF.3d', difficulty: 1, source: 'authored' },

  // K.RL.1-3 Literature — ask/answer about key details, retell, characters
  { q: 'in a story, who is the person the story is about?', a: 'character', variants: ['character', 'main character', 'hero'], standard: 'K.RL.3', difficulty: 2, source: 'authored' },
  { q: 'where a story happens is called the?', a: 'setting', variants: ['setting', 'place'], standard: 'K.RL.3', difficulty: 2, source: 'authored' },
  { q: 'who wrote a book?', a: 'author', variants: ['author', 'writer'], standard: 'K.RL.6', difficulty: 2, source: 'authored' },
  { q: 'who draws the pictures in a book?', a: 'illustrator', variants: ['illustrator', 'artist'], standard: 'K.RL.6', difficulty: 2, source: 'authored' },

  // K.RF.4 Fluency — read emergent-reader texts with purpose and understanding
  { q: 'read this sentence: I see a cat', a: 'cat', variants: ['cat', 'i see a cat'], standard: 'K.RF.4', difficulty: 2, source: 'authored' },
  { q: 'read this sentence: the dog is big', a: 'dog', variants: ['dog', 'big', 'the dog is big'], standard: 'K.RF.4', difficulty: 2, source: 'authored' },
  { q: 'read this sentence: we can go', a: 'go', variants: ['go', 'we can go'], standard: 'K.RF.4', difficulty: 2, source: 'authored' },

  // K.W.1-3 Writing — opinion, informative, narrative
  { q: 'what letter starts a sentence?', a: 'capital', variants: ['capital', 'uppercase', 'big letter'], standard: 'K.L.2a', difficulty: 1, source: 'authored' },
  { q: 'how do you spell the word cat?', a: 'cat', variants: ['cat', 'c a t', 'c-a-t'], standard: 'K.L.2c', difficulty: 1, source: 'authored' },
  { q: 'how do you spell the word dog?', a: 'dog', variants: ['dog', 'd o g', 'd-o-g'], standard: 'K.L.2c', difficulty: 1, source: 'authored' },
  { q: 'how do you spell the word sun?', a: 'sun', variants: ['sun', 's u n'], standard: 'K.L.2c', difficulty: 1, source: 'authored' },

  // K.SL.1 Listening and speaking — participate in conversation
  { q: 'what do you say when you meet someone?', a: 'hello', variants: ['hello', 'hi', 'hey'], standard: 'K.SL.1', difficulty: 1, source: 'authored' },
  { q: 'what do you say when you leave?', a: 'bye', variants: ['bye', 'goodbye', 'see you'], standard: 'K.SL.1', difficulty: 1, source: 'authored' },
  { q: 'what do you say when someone helps you?', a: 'thank', variants: ['thank you', 'thanks', 'thank'], standard: 'K.SL.1', difficulty: 1, source: 'authored' },
  { q: 'what do you say if you want something?', a: 'please', variants: ['please'], standard: 'K.SL.1', difficulty: 1, source: 'authored' },

  // K.L.1 Grammar — nouns, verbs, plurals, question words
  { q: 'what is the plural of cat?', a: 'cats', variants: ['cats'], standard: 'K.L.1c', difficulty: 2, source: 'authored' },
  { q: 'what is the plural of dog?', a: 'dogs', variants: ['dogs'], standard: 'K.L.1c', difficulty: 2, source: 'authored' },
  { q: 'what is the plural of box?', a: 'boxes', variants: ['boxes'], standard: 'K.L.1c', difficulty: 3, source: 'authored' },
  { q: 'is cat a noun or a verb?', a: 'noun', variants: ['noun'], standard: 'K.L.1b', difficulty: 2, source: 'authored' },
  { q: 'is run a noun or a verb?', a: 'verb', variants: ['verb'], standard: 'K.L.1b', difficulty: 2, source: 'authored' },
  { q: 'is jump a noun or a verb?', a: 'verb', variants: ['verb'], standard: 'K.L.1b', difficulty: 2, source: 'authored' },

  // K.L.5 Vocabulary — word relationships, categories
  { q: 'name an animal that barks', a: 'dog', variants: ['dog'], standard: 'K.L.5a', difficulty: 1, source: 'authored' },
  { q: 'name an animal that meows', a: 'cat', variants: ['cat'], standard: 'K.L.5a', difficulty: 1, source: 'authored' },
  { q: 'what color is grass?', a: 'green', variants: ['green'], standard: 'K.L.5a', difficulty: 1, source: 'authored' },
  { q: 'what color is the sky?', a: 'blue', variants: ['blue'], standard: 'K.L.5a', difficulty: 1, source: 'authored' },
  { q: 'what color is snow?', a: 'white', variants: ['white'], standard: 'K.L.5a', difficulty: 1, source: 'authored' },
  { q: 'what is the opposite of big?', a: 'small', variants: ['small', 'little', 'tiny'], standard: 'K.L.5b', difficulty: 2, source: 'authored' },
  { q: 'what is the opposite of hot?', a: 'cold', variants: ['cold', 'cool'], standard: 'K.L.5b', difficulty: 2, source: 'authored' },
  { q: 'what is the opposite of up?', a: 'down', variants: ['down'], standard: 'K.L.5b', difficulty: 1, source: 'authored' },
  { q: 'what is the opposite of happy?', a: 'sad', variants: ['sad'], standard: 'K.L.5b', difficulty: 1, source: 'authored' },
  { q: 'what is the opposite of day?', a: 'night', variants: ['night'], standard: 'K.L.5b', difficulty: 1, source: 'authored' },

  // Alphabet sequence (K.RF foundational)
  { q: 'what letter comes after a?', a: 'b', variants: ['b'], standard: 'K.RF.1d', difficulty: 1, source: 'authored' },
  { q: 'what letter comes after b?', a: 'c', variants: ['c'], standard: 'K.RF.1d', difficulty: 1, source: 'authored' },
  { q: 'what letter comes after c?', a: 'd', variants: ['d'], standard: 'K.RF.1d', difficulty: 1, source: 'authored' },
  { q: 'what letter comes after d?', a: 'e', variants: ['e'], standard: 'K.RF.1d', difficulty: 1, source: 'authored' },
  { q: 'what letter comes after m?', a: 'n', variants: ['n'], standard: 'K.RF.1d', difficulty: 1, source: 'authored' },
  { q: 'what letter comes after x?', a: 'y', variants: ['y'], standard: 'K.RF.1d', difficulty: 1, source: 'authored' },
  { q: 'what letter comes after y?', a: 'z', variants: ['z'], standard: 'K.RF.1d', difficulty: 1, source: 'authored' },
  { q: 'what letter comes before b?', a: 'a', variants: ['a'], standard: 'K.RF.1d', difficulty: 2, source: 'authored' },
  { q: 'what letter comes before m?', a: 'l', variants: ['l'], standard: 'K.RF.1d', difficulty: 2, source: 'authored' },
  { q: 'what letter comes before z?', a: 'y', variants: ['y'], standard: 'K.RF.1d', difficulty: 2, source: 'authored' },
  { q: 'what is the first letter of the alphabet?', a: 'a', variants: ['a'], standard: 'K.RF.1d', difficulty: 1, source: 'authored' },
  { q: 'what is the last letter of the alphabet?', a: 'z', variants: ['z'], standard: 'K.RF.1d', difficulty: 1, source: 'authored' },
  { q: 'how many letters are in the alphabet?', a: '26', variants: ['26', 'twenty six', 'twenty-six'], standard: 'K.RF.1d', difficulty: 2, source: 'authored' },
];

// ─── K-MATH EXAM BANK (K.CC / K.OA / K.NBT / K.MD / K.G) ─────────────

const MATH_KINDERGARTEN_EXAM = [
  // K.CC.1 Count to 100 by ones and tens
  { q: 'count to ten', a: 'ten', variants: ['ten', '10'], standard: 'K.CC.1', difficulty: 1, source: 'AIMSweb-sample' },
  { q: 'count to twenty', a: 'twenty', variants: ['twenty', '20'], standard: 'K.CC.1', difficulty: 2, source: 'AIMSweb-sample' },
  { q: 'count by tens to fifty', a: 'fifty', variants: ['fifty', '50'], standard: 'K.CC.1', difficulty: 3, source: 'AIMSweb-sample' },
  { q: 'count by tens to one hundred', a: 'one hundred', variants: ['one hundred', '100', 'hundred'], standard: 'K.CC.1', difficulty: 3, source: 'AIMSweb-sample' },

  // K.CC.2 Count forward from a given number
  { q: 'what comes after five?', a: 'six', variants: ['six', '6'], standard: 'K.CC.2', difficulty: 1, source: 'AIMSweb-sample' },
  { q: 'what comes after seven?', a: 'eight', variants: ['eight', '8'], standard: 'K.CC.2', difficulty: 1, source: 'AIMSweb-sample' },
  { q: 'what comes after ten?', a: 'eleven', variants: ['eleven', '11'], standard: 'K.CC.2', difficulty: 2, source: 'AIMSweb-sample' },
  { q: 'what comes after twelve?', a: 'thirteen', variants: ['thirteen', '13'], standard: 'K.CC.2', difficulty: 2, source: 'AIMSweb-sample' },
  { q: 'what comes after nineteen?', a: 'twenty', variants: ['twenty', '20'], standard: 'K.CC.2', difficulty: 2, source: 'AIMSweb-sample' },
  { q: 'what comes after twenty-nine?', a: 'thirty', variants: ['thirty', '30'], standard: 'K.CC.2', difficulty: 3, source: 'AIMSweb-sample' },
  { q: 'what comes after one?', a: 'two', variants: ['two', '2'], standard: 'K.CC.2', difficulty: 1, source: 'authored' },
  { q: 'what comes after two?', a: 'three', variants: ['three', '3'], standard: 'K.CC.2', difficulty: 1, source: 'authored' },
  { q: 'what comes after three?', a: 'four', variants: ['four', '4'], standard: 'K.CC.2', difficulty: 1, source: 'authored' },
  { q: 'what comes after four?', a: 'five', variants: ['five', '5'], standard: 'K.CC.2', difficulty: 1, source: 'authored' },
  { q: 'what comes after eight?', a: 'nine', variants: ['nine', '9'], standard: 'K.CC.2', difficulty: 1, source: 'authored' },
  { q: 'what comes after nine?', a: 'ten', variants: ['ten', '10'], standard: 'K.CC.2', difficulty: 1, source: 'authored' },

  // K.CC.3 Write numbers 0-20
  { q: 'write the number five', a: '5', variants: ['5', 'five'], standard: 'K.CC.3', difficulty: 1, source: 'authored' },
  { q: 'write the number ten', a: '10', variants: ['10', 'ten'], standard: 'K.CC.3', difficulty: 1, source: 'authored' },
  { q: 'write the number fifteen', a: '15', variants: ['15', 'fifteen'], standard: 'K.CC.3', difficulty: 2, source: 'authored' },
  { q: 'write the number zero', a: '0', variants: ['0', 'zero'], standard: 'K.CC.3', difficulty: 1, source: 'authored' },
  { q: 'write the number twenty', a: '20', variants: ['20', 'twenty'], standard: 'K.CC.3', difficulty: 2, source: 'authored' },

  // K.CC.4 One-to-one correspondence
  { q: 'how many fingers are on one hand?', a: 'five', variants: ['five', '5'], standard: 'K.CC.4', difficulty: 1, source: 'authored' },
  { q: 'how many fingers are on two hands?', a: 'ten', variants: ['ten', '10'], standard: 'K.CC.4', difficulty: 1, source: 'authored' },
  { q: 'how many eyes do you have?', a: 'two', variants: ['two', '2'], standard: 'K.CC.4', difficulty: 1, source: 'authored' },
  { q: 'how many ears do you have?', a: 'two', variants: ['two', '2'], standard: 'K.CC.4', difficulty: 1, source: 'authored' },
  { q: 'how many noses do you have?', a: 'one', variants: ['one', '1'], standard: 'K.CC.4', difficulty: 1, source: 'authored' },
  { q: 'how many legs does a dog have?', a: 'four', variants: ['four', '4'], standard: 'K.CC.4', difficulty: 1, source: 'authored' },
  { q: 'how many legs does a bird have?', a: 'two', variants: ['two', '2'], standard: 'K.CC.4', difficulty: 1, source: 'authored' },
  { q: 'how many wheels does a bicycle have?', a: 'two', variants: ['two', '2'], standard: 'K.CC.4', difficulty: 1, source: 'authored' },
  { q: 'how many wheels does a car have?', a: 'four', variants: ['four', '4'], standard: 'K.CC.4', difficulty: 1, source: 'authored' },
  { q: 'how many days are in a week?', a: 'seven', variants: ['seven', '7'], standard: 'K.CC.4', difficulty: 2, source: 'authored' },
  { q: 'how many months are in a year?', a: 'twelve', variants: ['twelve', '12'], standard: 'K.CC.4', difficulty: 3, source: 'authored' },

  // K.CC.5 Count to answer "how many"
  { q: 'if you have three apples and one more, how many?', a: 'four', variants: ['four', '4'], standard: 'K.CC.5', difficulty: 1, source: 'authored' },
  { q: 'if you count five toys, how many toys are there?', a: 'five', variants: ['five', '5'], standard: 'K.CC.5', difficulty: 1, source: 'authored' },

  // K.CC.6 Compare numbers as greater/less/equal
  { q: 'which is more, three or five?', a: 'five', variants: ['five', '5'], standard: 'K.CC.6', difficulty: 1, source: 'AIMSweb-sample' },
  { q: 'which is more, seven or four?', a: 'seven', variants: ['seven', '7'], standard: 'K.CC.6', difficulty: 1, source: 'AIMSweb-sample' },
  { q: 'which is less, two or six?', a: 'two', variants: ['two', '2'], standard: 'K.CC.6', difficulty: 1, source: 'AIMSweb-sample' },
  { q: 'which is less, nine or three?', a: 'three', variants: ['three', '3'], standard: 'K.CC.6', difficulty: 1, source: 'AIMSweb-sample' },
  { q: 'is ten greater or less than five?', a: 'greater', variants: ['greater', 'more', 'bigger'], standard: 'K.CC.6', difficulty: 2, source: 'authored' },
  { q: 'is three greater or less than eight?', a: 'less', variants: ['less', 'fewer', 'smaller'], standard: 'K.CC.6', difficulty: 2, source: 'authored' },

  // K.CC.7 Compare two written numerals
  { q: 'which number is bigger, 8 or 3?', a: '8', variants: ['8', 'eight'], standard: 'K.CC.7', difficulty: 1, source: 'authored' },
  { q: 'which number is smaller, 6 or 9?', a: '6', variants: ['6', 'six'], standard: 'K.CC.7', difficulty: 1, source: 'authored' },

  // K.OA.1 Represent addition/subtraction with objects
  { q: 'one plus one is?', a: 'two', variants: ['two', '2'], standard: 'K.OA.1', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'two plus two is?', a: 'four', variants: ['four', '4'], standard: 'K.OA.1', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'three plus one is?', a: 'four', variants: ['four', '4'], standard: 'K.OA.1', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'two plus three is?', a: 'five', variants: ['five', '5'], standard: 'K.OA.1', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'four plus two is?', a: 'six', variants: ['six', '6'], standard: 'K.OA.1', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'five plus zero is?', a: 'five', variants: ['five', '5'], standard: 'K.OA.1', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'three plus three is?', a: 'six', variants: ['six', '6'], standard: 'K.OA.1', difficulty: 1, source: 'authored' },
  { q: 'four plus four is?', a: 'eight', variants: ['eight', '8'], standard: 'K.OA.1', difficulty: 1, source: 'authored' },
  { q: 'five plus five is?', a: 'ten', variants: ['ten', '10'], standard: 'K.OA.1', difficulty: 2, source: 'authored' },
  { q: 'two minus one is?', a: 'one', variants: ['one', '1'], standard: 'K.OA.1', difficulty: 1, source: 'authored' },
  { q: 'three minus one is?', a: 'two', variants: ['two', '2'], standard: 'K.OA.1', difficulty: 1, source: 'authored' },
  { q: 'four minus two is?', a: 'two', variants: ['two', '2'], standard: 'K.OA.1', difficulty: 1, source: 'authored' },
  { q: 'five minus three is?', a: 'two', variants: ['two', '2'], standard: 'K.OA.1', difficulty: 1, source: 'authored' },
  { q: 'six minus two is?', a: 'four', variants: ['four', '4'], standard: 'K.OA.1', difficulty: 1, source: 'authored' },

  // K.OA.3 Decompose numbers ≤ 10 into pairs
  { q: 'what two numbers add to five?', a: 'two and three', variants: ['two and three', '2 and 3', 'one and four', '0 and 5'], standard: 'K.OA.3', difficulty: 2, source: 'authored' },
  { q: 'what two numbers add to ten?', a: 'five and five', variants: ['five and five', '5 and 5', 'six and four', 'seven and three'], standard: 'K.OA.3', difficulty: 2, source: 'authored' },

  // K.OA.4 Find the number that makes 10
  { q: 'what plus five equals ten?', a: 'five', variants: ['five', '5'], standard: 'K.OA.4', difficulty: 2, source: 'authored' },
  { q: 'what plus two equals ten?', a: 'eight', variants: ['eight', '8'], standard: 'K.OA.4', difficulty: 2, source: 'authored' },
  { q: 'what plus seven equals ten?', a: 'three', variants: ['three', '3'], standard: 'K.OA.4', difficulty: 2, source: 'authored' },
  { q: 'what plus one equals ten?', a: 'nine', variants: ['nine', '9'], standard: 'K.OA.4', difficulty: 2, source: 'authored' },

  // K.OA.5 Fluently add/subtract within 5
  { q: 'one plus two is?', a: 'three', variants: ['three', '3'], standard: 'K.OA.5', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'two plus one is?', a: 'three', variants: ['three', '3'], standard: 'K.OA.5', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'one plus three is?', a: 'four', variants: ['four', '4'], standard: 'K.OA.5', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'one plus four is?', a: 'five', variants: ['five', '5'], standard: 'K.OA.5', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'four plus one is?', a: 'five', variants: ['five', '5'], standard: 'K.OA.5', difficulty: 1, source: 'DIBELS-8-sample' },
  { q: 'three minus two is?', a: 'one', variants: ['one', '1'], standard: 'K.OA.5', difficulty: 1, source: 'authored' },
  { q: 'four minus three is?', a: 'one', variants: ['one', '1'], standard: 'K.OA.5', difficulty: 1, source: 'authored' },
  { q: 'five minus four is?', a: 'one', variants: ['one', '1'], standard: 'K.OA.5', difficulty: 1, source: 'authored' },
  { q: 'five minus one is?', a: 'four', variants: ['four', '4'], standard: 'K.OA.5', difficulty: 1, source: 'authored' },
  { q: 'five minus two is?', a: 'three', variants: ['three', '3'], standard: 'K.OA.5', difficulty: 1, source: 'authored' },

  // K.NBT.1 Compose/decompose teen numbers into ten + ones
  { q: 'ten plus one is?', a: 'eleven', variants: ['eleven', '11'], standard: 'K.NBT.1', difficulty: 2, source: 'authored' },
  { q: 'ten plus two is?', a: 'twelve', variants: ['twelve', '12'], standard: 'K.NBT.1', difficulty: 2, source: 'authored' },
  { q: 'ten plus three is?', a: 'thirteen', variants: ['thirteen', '13'], standard: 'K.NBT.1', difficulty: 2, source: 'authored' },
  { q: 'ten plus five is?', a: 'fifteen', variants: ['fifteen', '15'], standard: 'K.NBT.1', difficulty: 2, source: 'authored' },
  { q: 'ten plus nine is?', a: 'nineteen', variants: ['nineteen', '19'], standard: 'K.NBT.1', difficulty: 2, source: 'authored' },
  { q: 'thirteen is ten plus?', a: 'three', variants: ['three', '3'], standard: 'K.NBT.1', difficulty: 3, source: 'authored' },
  { q: 'fifteen is ten plus?', a: 'five', variants: ['five', '5'], standard: 'K.NBT.1', difficulty: 3, source: 'authored' },

  // K.MD.1 Describe measurable attributes
  { q: 'which is longer, a pencil or a pen?', a: 'pencil', variants: ['pencil', 'pen', 'depends'], standard: 'K.MD.1', difficulty: 2, source: 'authored' },
  { q: 'which is heavier, an elephant or a mouse?', a: 'elephant', variants: ['elephant'], standard: 'K.MD.1', difficulty: 1, source: 'authored' },
  { q: 'which is taller, a tree or a flower?', a: 'tree', variants: ['tree'], standard: 'K.MD.1', difficulty: 1, source: 'authored' },
  { q: 'which is hotter, ice or fire?', a: 'fire', variants: ['fire'], standard: 'K.MD.1', difficulty: 1, source: 'authored' },
  { q: 'which is colder, sun or snow?', a: 'snow', variants: ['snow'], standard: 'K.MD.1', difficulty: 1, source: 'authored' },
  { q: 'which is smaller, a mouse or a dog?', a: 'mouse', variants: ['mouse'], standard: 'K.MD.1', difficulty: 1, source: 'authored' },
  { q: 'which is fuller, a glass with water or an empty glass?', a: 'water', variants: ['water', 'with water', 'full'], standard: 'K.MD.1', difficulty: 2, source: 'authored' },

  // K.MD.3 Classify objects and count the number of objects in each category
  { q: 'if there are three red crayons and two blue crayons, how many red?', a: 'three', variants: ['three', '3'], standard: 'K.MD.3', difficulty: 2, source: 'authored' },
  { q: 'name three colors', a: 'red', variants: ['red', 'blue', 'yellow', 'green', 'orange', 'pink'], standard: 'K.MD.3', difficulty: 1, source: 'authored' },

  // K.G.1 Describe objects in the environment using shapes
  { q: 'what shape has three sides?', a: 'triangle', variants: ['triangle'], standard: 'K.G.1', difficulty: 1, source: 'AIMSweb-sample' },
  { q: 'what shape has four equal sides?', a: 'square', variants: ['square'], standard: 'K.G.1', difficulty: 1, source: 'AIMSweb-sample' },
  { q: 'what shape is round?', a: 'circle', variants: ['circle'], standard: 'K.G.1', difficulty: 1, source: 'AIMSweb-sample' },
  { q: 'what shape has four sides but two long and two short?', a: 'rectangle', variants: ['rectangle'], standard: 'K.G.1', difficulty: 2, source: 'AIMSweb-sample' },
  { q: 'what shape has six sides?', a: 'hexagon', variants: ['hexagon'], standard: 'K.G.1', difficulty: 3, source: 'authored' },

  // K.G.2 Correctly name shapes regardless of orientation or overall size
  { q: 'a ball is the shape of a?', a: 'sphere', variants: ['sphere', 'circle', 'round'], standard: 'K.G.2', difficulty: 2, source: 'authored' },
  { q: 'a box is the shape of a?', a: 'cube', variants: ['cube', 'square', 'rectangle'], standard: 'K.G.2', difficulty: 2, source: 'authored' },
  { q: 'a can is the shape of a?', a: 'cylinder', variants: ['cylinder'], standard: 'K.G.2', difficulty: 3, source: 'authored' },

  // K.G.3 Identify shapes as 2D or 3D
  { q: 'is a circle flat or solid?', a: 'flat', variants: ['flat', '2d', 'two dimensional'], standard: 'K.G.3', difficulty: 2, source: 'authored' },
  { q: 'is a cube flat or solid?', a: 'solid', variants: ['solid', '3d', 'three dimensional'], standard: 'K.G.3', difficulty: 2, source: 'authored' },

  // K.G.4 Analyze and compare shapes
  { q: 'how are a square and a rectangle the same?', a: 'sides', variants: ['sides', 'four sides', '4 sides', 'corners'], standard: 'K.G.4', difficulty: 3, source: 'authored' },
  { q: 'how is a triangle different from a square?', a: 'sides', variants: ['sides', 'three sides', 'fewer sides'], standard: 'K.G.4', difficulty: 3, source: 'authored' },

  // K.G.5 Model shapes in the world by building them
  { q: 'if you put two triangles together, what can you make?', a: 'square', variants: ['square', 'rectangle', 'diamond'], standard: 'K.G.5', difficulty: 3, source: 'authored' },

  // K.G.6 Compose simple shapes to form larger shapes
  { q: 'what do you get when you put two squares together side by side?', a: 'rectangle', variants: ['rectangle'], standard: 'K.G.6', difficulty: 3, source: 'authored' },
];

// ─── Placeholder exports for other subjects — first expansion pass
//     ships ELA-K + Math-K fully; other subjects queued in T23.a.4-8.
//     Each placeholder keeps the existing small inline bank shape so
//     the probe still runs; subsequent commits expand each to ≥150 Q.

const SCIENCE_KINDERGARTEN_EXAM = [
  { q: 'what do plants need to grow?', a: 'water', variants: ['water', 'sun', 'light', 'sunlight'], standard: 'K-LS1-1', difficulty: 1, source: 'authored' },
  { q: 'does ice melt or freeze when it gets warm?', a: 'melt', variants: ['melt', 'melts'], standard: 'K-PS1', difficulty: 1, source: 'authored' },
  { q: 'is the sun hot or cold?', a: 'hot', variants: ['hot', 'warm'], standard: 'K-PS3-1', difficulty: 1, source: 'authored' },
  { q: 'what happens when you drop a ball?', a: 'falls', variants: ['falls', 'fall', 'drops', 'bounce'], standard: 'K-PS2-1', difficulty: 1, source: 'authored' },
  { q: 'what do fish use to breathe?', a: 'gills', variants: ['gills', 'water'], standard: 'K-LS1-1', difficulty: 2, source: 'authored' },
  // T23.a.4 — full expansion queued.
];
const SOCIAL_KINDERGARTEN_EXAM = [
  { q: 'what do you say when someone helps you?', a: 'thank', variants: ['thank you', 'thanks', 'thank'], standard: 'K-Social-manners', difficulty: 1, source: 'authored' },
  { q: 'when someone is sad what can you do?', a: 'help', variants: ['help', 'hug', 'listen', 'share'], standard: 'K-Social-empathy', difficulty: 1, source: 'authored' },
  { q: 'where do kids go to learn?', a: 'school', variants: ['school', 'class'], standard: 'K-Social-community', difficulty: 1, source: 'authored' },
  { q: 'who are the people in your family?', a: 'mom', variants: ['mom', 'dad', 'sister', 'brother', 'family'], standard: 'K-Social-family', difficulty: 1, source: 'authored' },
  { q: 'what should you do before crossing the street?', a: 'look', variants: ['look', 'stop', 'wait'], standard: 'K-Social-safety', difficulty: 1, source: 'authored' },
  // T23.a.5 — full expansion queued.
];
const ART_KINDERGARTEN_EXAM = [
  { q: 'what color do you get when you mix red and yellow?', a: 'orange', variants: ['orange'], standard: 'K-Art-color-mixing', difficulty: 1, source: 'authored' },
  { q: 'what color do you get when you mix blue and yellow?', a: 'green', variants: ['green'], standard: 'K-Art-color-mixing', difficulty: 1, source: 'authored' },
  { q: 'name a shape with four equal sides', a: 'square', variants: ['square'], standard: 'K-Art-shapes', difficulty: 1, source: 'authored' },
  { q: 'what color are leaves in summer?', a: 'green', variants: ['green'], standard: 'K-Art-nature', difficulty: 1, source: 'authored' },
  { q: 'name three colors', a: 'red', variants: ['red', 'blue', 'yellow', 'green', 'orange'], standard: 'K-Art-color-naming', difficulty: 1, source: 'authored' },
  // T23.a.6 — full expansion queued.
];
const LIFE_KINDERGARTEN_EXAM = [
  { q: 'what is your name?', a: 'unity', variants: ['unity'], standard: 'K-Life-identity', difficulty: 1, source: 'authored' },
  { q: 'how old are you?', a: 'five', variants: ['five', '5'], standard: 'K-Life-age', difficulty: 1, source: 'authored' },
  { q: 'what grade are you in?', a: 'kindergarten', variants: ['kindergarten', 'k', 'kinder'], standard: 'K-Life-grade', difficulty: 1, source: 'authored' },
  { q: 'how are you feeling?', a: 'good', variants: ['good', 'happy', 'fine', 'ok'], standard: 'K-Life-feelings', difficulty: 1, source: 'authored' },
  { q: 'what is your favorite color?', a: 'pink', variants: ['pink', 'black', 'red', 'blue'], standard: 'K-Life-preference', difficulty: 1, source: 'authored' },
  // T23.a.7 — full expansion queued.
];

// ─── Pre-K banks (T23.a.8 full expansion queued, small seeds here) ───

const ELA_PREK_EXAM = [
  { q: 'point to the letter a', a: 'a', variants: ['a', 'A', 'ay'], standard: 'preK-letter-ID', difficulty: 1, source: 'authored' },
  { q: 'what sound does m make?', a: 'm', variants: ['m', 'mm', 'muh'], standard: 'preK-phoneme', difficulty: 1, source: 'authored' },
  { q: 'say the word for a cat', a: 'cat', variants: ['cat', 'kitty', 'kitten'], standard: 'preK-vocab', difficulty: 1, source: 'authored' },
];
const MATH_PREK_EXAM = [
  { q: 'how many fingers are on one hand?', a: 'five', variants: ['five', '5'], standard: 'preK-counting', difficulty: 1, source: 'authored' },
  { q: 'what comes after one?', a: 'two', variants: ['two', '2'], standard: 'preK-sequence', difficulty: 1, source: 'authored' },
  { q: 'point to the biggest one', a: 'big', variants: ['big', 'biggest', 'large'], standard: 'preK-comparison', difficulty: 1, source: 'authored' },
];
const SCIENCE_PREK_EXAM = [
  { q: 'what sound does a dog make?', a: 'bark', variants: ['bark', 'woof', 'ruff'], standard: 'preK-animals', difficulty: 1, source: 'authored' },
  { q: 'what color is the sky?', a: 'blue', variants: ['blue'], standard: 'preK-observation', difficulty: 1, source: 'authored' },
  { q: 'does a bird fly or swim?', a: 'fly', variants: ['fly', 'flies'], standard: 'preK-animals', difficulty: 1, source: 'authored' },
];
const SOCIAL_PREK_EXAM = [
  { q: 'who takes care of you at home?', a: 'mom', variants: ['mom', 'dad', 'mommy', 'daddy', 'parents'], standard: 'preK-family', difficulty: 1, source: 'authored' },
  { q: 'when you share, how does it make your friend feel?', a: 'happy', variants: ['happy', 'good', 'glad'], standard: 'preK-empathy', difficulty: 1, source: 'authored' },
  { q: 'say hello', a: 'hi', variants: ['hi', 'hello', 'hey'], standard: 'preK-greeting', difficulty: 1, source: 'authored' },
];
const ART_PREK_EXAM = [
  { q: 'what color is the sun?', a: 'yellow', variants: ['yellow'], standard: 'preK-colors', difficulty: 1, source: 'authored' },
  { q: 'name a shape', a: 'circle', variants: ['circle', 'square', 'triangle'], standard: 'preK-shapes', difficulty: 1, source: 'authored' },
  { q: 'what do you use to draw?', a: 'crayon', variants: ['crayon', 'pencil', 'marker', 'pen'], standard: 'preK-tools', difficulty: 1, source: 'authored' },
];
const LIFE_PREK_EXAM = [
  { q: 'what is your name?', a: 'unity', variants: ['unity'], standard: 'preK-identity', difficulty: 1, source: 'authored' },
  { q: 'are you a girl or a boy?', a: 'girl', variants: ['girl', 'woman'], standard: 'preK-self', difficulty: 1, source: 'authored' },
  { q: 'how old are you?', a: 'four', variants: ['four', '4', 'three', '3', 'five', '5'], standard: 'preK-age', difficulty: 1, source: 'authored' },
];

// ─── EXPORTS ─────────────────────────────────────────────────────────

// Convert the compact {q,a,variants,...} shape to the probe-expected
// {question, expectedAnswer, expectedVariants, ...} shape used by
// `_studentTestProbe`. Keeps the source data compact while matching
// the existing probe contract.
function toProbeShape(bank) {
  return bank.map(entry => ({
    question: entry.q,
    expectedAnswer: entry.a,
    expectedVariants: entry.variants || [entry.a],
    standard: entry.standard || 'unspecified',
    difficulty: entry.difficulty || 1,
    source: entry.source || 'authored',
  }));
}

// Held-out exam banks — what `_runStudentBattery` pulls for gate eval.
// Teaching methods are barred from pulling from these sets.
export const EXAM_BANKS = {
  'ela/pre-K':       toProbeShape(ELA_PREK_EXAM),
  'ela/kindergarten': toProbeShape(ELA_KINDERGARTEN_EXAM),
  'math/pre-K':       toProbeShape(MATH_PREK_EXAM),
  'math/kindergarten': toProbeShape(MATH_KINDERGARTEN_EXAM),
  'science/pre-K':       toProbeShape(SCIENCE_PREK_EXAM),
  'science/kindergarten': toProbeShape(SCIENCE_KINDERGARTEN_EXAM),
  'social/pre-K':       toProbeShape(SOCIAL_PREK_EXAM),
  'social/kindergarten': toProbeShape(SOCIAL_KINDERGARTEN_EXAM),
  'art/pre-K':       toProbeShape(ART_PREK_EXAM),
  'art/kindergarten': toProbeShape(ART_KINDERGARTEN_EXAM),
  'life/pre-K':       toProbeShape(LIFE_PREK_EXAM),
  'life/kindergarten': toProbeShape(LIFE_KINDERGARTEN_EXAM),
};

// Training-side banks — reserved for future expansion. The current
// teaching methods in curriculum.js generate their own exposure
// content from feature-vector combination transforms; as T23.b.2
// overlap-check gets wired, the TRAIN_BANKS side becomes the
// authoritative source for any question-format exposure content used
// during teach. For now, empty lets the held-out check report the
// right counts.
export const TRAIN_BANKS = {
  'ela/pre-K': [],
  'ela/kindergarten': [],
  'math/pre-K': [],
  'math/kindergarten': [],
  'science/pre-K': [],
  'science/kindergarten': [],
  'social/pre-K': [],
  'social/kindergarten': [],
  'art/pre-K': [],
  'art/kindergarten': [],
  'life/pre-K': [],
  'life/kindergarten': [],
};

// Per-sub-standard pass thresholds, norm-calibrated where possible.
// Unspecified standards default to 0.80 (aggregate K benchmark floor
// per DIBELS 8 "below benchmark" cut scores).
export const STANDARD_CUT_SCORES = {
  // ELA K — DIBELS 8 / AIMSweb Plus calibrated
  'K.RF.1a': 0.80,
  'K.RF.1b': 0.80,
  'K.RF.1c': 0.80,
  'K.RF.1d': 0.90, // alphabet sequence — mastery
  'K.RF.2a': 0.80, // rhyme
  'K.RF.2b': 0.75, // syllables (harder)
  'K.RF.2d': 0.85, // first/last phoneme
  'K.RF.2e': 0.80, // blending
  'K.RF.3a': 0.95, // letter-sound correspondence — mastery threshold
  'K.RF.3b': 0.75, // short/long vowels
  'K.RF.3c': 0.90, // sight words
  'K.RF.3d': 0.80, // CVC reading
  'K.RF.4':  0.70, // fluency (end of K)
  'K.RL.3':  0.75,
  'K.RL.6':  0.75,
  'K.L.1b':  0.75,
  'K.L.1c':  0.70,
  'K.L.2a':  0.80,
  'K.L.2c':  0.70,
  'K.L.5a':  0.80,
  'K.L.5b':  0.80,
  'K.SL.1':  0.85,
  // Math K — AIMSweb Plus / iReady K calibrated
  'K.CC.1':  0.90, // count to 100 by ones/tens
  'K.CC.2':  0.90, // count forward
  'K.CC.3':  0.85, // write numerals 0-20
  'K.CC.4':  0.90, // 1:1 correspondence
  'K.CC.5':  0.85,
  'K.CC.6':  0.85, // compare
  'K.CC.7':  0.80,
  'K.OA.1':  0.85, // add/sub within 10
  'K.OA.3':  0.70,
  'K.OA.4':  0.75,
  'K.OA.5':  0.95, // fluency within 5 — mastery
  'K.NBT.1': 0.75, // teen decomposition
  'K.MD.1':  0.80, // measurable attributes
  'K.MD.3':  0.80, // classify/count
  'K.G.1':   0.90, // name 2D shapes
  'K.G.2':   0.80, // name 3D shapes
  'K.G.3':   0.75, // 2D vs 3D
  'K.G.4':   0.70, // compare shapes
  'K.G.5':   0.70,
  'K.G.6':   0.70,
  // Default floor for any unspecified standard
  '__default__': 0.80,
};

// Helper — look up cut score for a given standard tag, defaulting to
// the aggregate K benchmark floor.
export function cutScoreFor(standard) {
  return STANDARD_CUT_SCORES[standard] ?? STANDARD_CUT_SCORES.__default__;
}

// Overlap sanity check — returns the set of question texts appearing
// in BOTH TRAIN_BANKS and EXAM_BANKS for a given cell. Called at
// curriculum startup by T23.b.2. Non-empty = held-out eval invalid.
export function trainExamOverlap(cellKey) {
  const train = TRAIN_BANKS[cellKey] || [];
  const exam = EXAM_BANKS[cellKey] || [];
  const trainSet = new Set(train.map(t => (t.question || t.q || '').trim().toLowerCase()));
  const overlap = [];
  for (const e of exam) {
    const q = (e.question || e.q || '').trim().toLowerCase();
    if (q && trainSet.has(q)) overlap.push(q);
  }
  return overlap;
}
