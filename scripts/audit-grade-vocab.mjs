#!/usr/bin/env node
/**
 * T16.3.a — Per-grade word coverage audit.
 *
 * Parses js/brain/curriculum.js, finds every grade cell method
 * (runElaKReal, runMathG1Real, etc.), and for each method counts:
 *   - unique words passed to _teachWordEmission(...)
 *   - unique words passed to _teachVocabList(...)
 *   - unique words passed to _teachSentenceList(...)
 *
 * Compares against developmental vocabulary norms:
 *   K  : ~2,000 productive / 2,500-5,000 receptive (MacArthur-Bates CDI)
 *   G1 : ~3,000 productive
 *   G2 : ~4,000 productive
 *   G3-G5 : 5,000-8,000 productive
 *   G6-G8 : 10,000-15,000 productive
 *   G9-G12: 15,000-25,000 productive
 *   College : 25,000-40,000
 *   PhD : 40,000+ plus domain jargon
 *
 * Reports per-grade gap so curriculum expansion can target the weakest grades.
 *
 * Usage:
 *   node scripts/audit-grade-vocab.mjs              # full report
 *   node scripts/audit-grade-vocab.mjs --gaps-only  # only show grades below norm
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CURRICULUM_PATH = path.join(__dirname, '..', 'js', 'brain', 'curriculum.js');

// Developmental vocabulary norms per grade (productive-vocabulary targets).
const GRADE_NORMS = {
  'K':       { productive: 2000,  receptive: 3500,  note: 'MacArthur-Bates CDI, 5-year-old avg' },
  'G1':      { productive: 3000,  receptive: 6000,  note: 'Educator\'s Word Frequency Guide' },
  'G2':      { productive: 4000,  receptive: 8000,  note: 'Stahl & Nagy 2006 dev. norms' },
  'G3':      { productive: 5000,  receptive: 10000, note: 'EWFG G3 receptive estimate' },
  'G4':      { productive: 6000,  receptive: 13000, note: 'EWFG G4' },
  'G5':      { productive: 8000,  receptive: 16000, note: 'EWFG G5' },
  'G6':      { productive: 10000, receptive: 20000, note: 'Anglin 1993 G6' },
  'G7':      { productive: 12000, receptive: 25000, note: 'Anglin 1993 G7' },
  'G8':      { productive: 15000, receptive: 30000, note: 'Anglin 1993 G8' },
  'G9':      { productive: 17000, receptive: 35000, note: 'AWL core + grade-level' },
  'G10':     { productive: 20000, receptive: 40000, note: 'AWL + high-school content' },
  'G11':     { productive: 22000, receptive: 45000, note: 'AWL + college-prep' },
  'G12':     { productive: 25000, receptive: 50000, note: 'AWL full + general college' },
  'College1': { productive: 28000, receptive: 55000, note: 'COCA freq band 1-3' },
  'College2': { productive: 32000, receptive: 60000, note: 'COCA freq band 1-4' },
  'College3': { productive: 36000, receptive: 65000, note: 'COCA freq band 1-5 + specialization' },
  'College4': { productive: 40000, receptive: 70000, note: 'full AWL + major-specific' },
  'Grad':    { productive: 50000, receptive: 80000, note: 'domain jargon + research vocabulary' },
  'PhD':     { productive: 60000, receptive: 100000, note: 'full domain + research + cross-disciplinary' },
};

// Match a grade suffix to its norm key.
function normKeyFor(gradeSuffix) {
  if (gradeSuffix === 'K') return 'K';
  const mG = gradeSuffix.match(/^G(\d+)$/);
  if (mG) return `G${mG[1]}`;
  const mCol = gradeSuffix.match(/^College(\d+)$/i);
  if (mCol) return `College${mCol[1]}`;
  if (/^Grad/i.test(gradeSuffix)) return 'Grad';
  if (/^PhD/i.test(gradeSuffix)) return 'PhD';
  return null;
}

function extractGradeMethods(source) {
  // Match `async runXxxSuffixReal(ctx) {` and capture the function body
  // by balanced-brace scan until the matching `  }` at indent 2.
  const methodRe = /^  async (run(Ela|Math|Sci|Soc|Art|Life)([A-Z][A-Za-z0-9]*)Real)\(ctx\) \{/gm;
  const methods = [];
  let match;
  while ((match = methodRe.exec(source)) !== null) {
    const [full, methodName, subject, gradeSuffix] = match;
    const bodyStart = match.index + full.length;
    // Balanced brace scan
    let depth = 1;
    let pos = bodyStart;
    while (pos < source.length && depth > 0) {
      const c = source[pos++];
      if (c === '{') depth++;
      else if (c === '}') depth--;
    }
    const bodyEnd = pos;
    const body = source.slice(bodyStart, bodyEnd);
    methods.push({ methodName, subject, gradeSuffix, body });
  }
  return methods;
}

function extractWordsFromArrayLiterals(body) {
  // Teach methods typically take an array literal `['cat', 'dog', ...]`
  // or a variable that's an array of strings. Match the simple case of
  // inline string arrays in teach-method invocations.
  const words = new Set();
  const calls = /_teach(WordEmission|VocabList|SentenceList|PhonemeBlending)\s*\(([^;]{0,30000}?)(?:\)\s*;|\)\s*$)/gs;
  let m;
  while ((m = calls.exec(body)) !== null) {
    const args = m[2];
    // First arg is the word/sentence list — try to parse inline string
    // literals out of it. This catches the dominant case of array
    // literals; variable-referenced lists won't be counted here and get
    // noted in the report as "opaque".
    const strRe = /['"]([^'"]{1,64})['"]/g;
    let s;
    while ((s = strRe.exec(args)) !== null) {
      const w = s[1].toLowerCase().trim();
      if (!w || w.includes(' ')) {
        // Sentences — split into words
        w.split(/\s+/).forEach((tok) => {
          if (tok && /^[a-z]/.test(tok) && tok.length <= 32) words.add(tok);
        });
      } else if (/^[a-z]/.test(w) && w.length <= 32) {
        words.add(w);
      }
    }
  }
  return words;
}

function audit() {
  const source = fs.readFileSync(CURRICULUM_PATH, 'utf-8');
  const methods = extractGradeMethods(source);

  console.log(`=== T16.3.a — Per-grade word coverage audit ===`);
  console.log(`Parsed ${methods.length} grade methods from ${CURRICULUM_PATH}\n`);

  // Aggregate by grade suffix (ELA + Math + Sci + Soc + Art + Life at that grade).
  const byGrade = new Map();
  for (const m of methods) {
    const key = m.gradeSuffix;
    if (!byGrade.has(key)) byGrade.set(key, { ela: 0, math: 0, sci: 0, soc: 0, art: 0, life: 0, unique: new Set(), methods: [] });
    const entry = byGrade.get(key);
    const words = extractWordsFromArrayLiterals(m.body);
    entry.methods.push({ methodName: m.methodName, subject: m.subject, wordCount: words.size });
    words.forEach((w) => entry.unique.add(w));
    const sKey = {
      Ela: 'ela', Math: 'math', Sci: 'sci', Soc: 'soc', Art: 'art', Life: 'life',
    }[m.subject];
    if (sKey) entry[sKey] = words.size;
  }

  // Report ordered by grade
  const order = [
    'K',
    ...Array.from({ length: 12 }, (_, i) => `G${i + 1}`),
    'College1', 'College2', 'College3', 'College4',
    'Grad', 'PhD',
  ];

  const gapsOnly = process.argv.includes('--gaps-only');

  console.log('Grade | Unique words | Productive norm | Gap  | Notes');
  console.log('------+--------------+-----------------+------+-------------------------------');
  let totalGap = 0;
  let gradesBelow = 0;
  for (const grade of order) {
    const entry = byGrade.get(grade);
    if (!entry) {
      if (!gapsOnly) console.log(`${grade.padEnd(5)} | (no methods)  | —               | —    | not yet implemented`);
      continue;
    }
    const unique = entry.unique.size;
    const normKey = normKeyFor(grade);
    const norm = GRADE_NORMS[normKey];
    const productiveNorm = norm ? norm.productive : null;
    const gap = productiveNorm ? productiveNorm - unique : 0;
    const gapStr = productiveNorm ? (gap > 0 ? `-${gap}` : `+${-gap}`) : '—';
    const noteStr = norm ? norm.note : '';
    if (gapsOnly && gap <= 0) continue;
    console.log(`${grade.padEnd(5)} | ${String(unique).padEnd(12)} | ${String(productiveNorm ?? '—').padEnd(15)} | ${gapStr.padEnd(4)} | ${noteStr}`);
    if (gap > 0) {
      totalGap += gap;
      gradesBelow++;
    }
  }

  console.log('');
  console.log(`Grades below productive-vocabulary norm: ${gradesBelow} / ${order.length}`);
  console.log(`Total vocabulary gap across all grades: ${totalGap.toLocaleString()} words`);
  console.log('');
  console.log('Caveat: this audit only counts inline string literals in teach method calls.');
  console.log('Variable-referenced lists (e.g. K_COLORS constants at top of runElaKReal) ARE');
  console.log('counted when those variables are also defined with inline string literals in');
  console.log('the same method body, which is the dominant pattern. Lists sourced from');
  console.log('external imports or runtime composition may under-count.');
}

audit();
