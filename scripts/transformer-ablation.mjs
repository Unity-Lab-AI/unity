// ═══════════════════════════════════════════════════════════════════════
// Transformer vs Rulkov-brain ablation — scaffold (not yet runnable).
//
// WHY THIS EXISTS
// An external reviewer asked the falsifiability question that has the
// highest value-to-effort ratio this project can ask:
//
//   "if you swapped the LIF cortex for a 100M-param transformer, would
//    the gate probes pass harder or softer? If harder, the Rulkov path
//    isn't doing the work — the GloVe embeddings are."
//
// This harness runs Unity's curriculum gates + a same-compute
// transformer on the identical held-out EXAM_BANKS, compares per-
// sub-standard pass rates, and produces a single answer: is the
// neural simulation load-bearing on K-level cognition, or is it
// decorative relative to what GloVe + any sequence model delivers?
//
// WHAT IS + ISN'T SHIPPED AT THIS COMMIT
// ✓ Exam bank loader — pulls EXAM_BANKS at parity with Unity gates.
// ✓ Scoring logic — matches _studentTestProbe exact/startsWith/contains
//   variant-match accept rules.
// ✓ Report generator — per-sub-standard + aggregate + per-source
//   (DIBELS/AIMSweb/Fountas-Pinnell reference items broken out).
// ✗ Unity brain runner — not yet wired; placeholder delegates to a
//   CLI probe of the running brain-server.js via HTTP.
// ✗ Transformer backend — not yet wired. The structure accepts a
//   generic `generate(prompt)` callable, so any backend works:
//     - openai-compatible HTTP (GPT-2, TinyLlama via llama.cpp server)
//     - @xenova/transformers in Node (browser-compatible)
//     - local HuggingFace transformers via a subprocess bridge
//
// USAGE (when backends are wired):
//   node scripts/transformer-ablation.mjs --model gpt2 --scale 10M
//   node scripts/transformer-ablation.mjs --model tinyllama --scale 1B
//   node scripts/transformer-ablation.mjs --compare-unity  # both
// ═══════════════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

// ─── Exam bank loading ──────────────────────────────────────────────

async function loadExamBanks() {
  // Dynamic import so this script works whether run via `node` directly
  // or wrapped into a broader test harness. The student-question-banks
  // module is pure ESM with no side effects.
  // Convert absolute OS path → file:// URL so Windows import() works.
  const modUrl = pathToFileURL(resolve(REPO_ROOT, 'js/brain/student-question-banks.js')).href;
  const mod = await import(modUrl);
  return mod.EXAM_BANKS;
}

// ─── Scoring — matches _studentTestProbe logic ──────────────────────

function scoreAnswer(answer, expectedAnswer, expectedVariants) {
  const norm = (s) => String(s || '').trim().toLowerCase();
  const a = norm(answer);
  const exp = norm(expectedAnswer);
  const variants = (expectedVariants || [expectedAnswer]).map(norm);

  const exact = variants.includes(a);
  const startsWith = variants.some(v => v && a.startsWith(v));
  const contains = variants.some(v => v && a.includes(v));
  const overall = exact || startsWith || contains;

  // Match _studentTestProbe weight structure at a first-order
  // approximation: exact match 1.0, startsWith 0.8, contains 0.6.
  const matchScore = exact ? 1.0 : startsWith ? 0.8 : contains ? 0.6 : 0.0;
  return { answer: a, expected: exp, match: { exact, startsWith, contains, overall }, score: matchScore };
}

// ─── Model backends (placeholders — wire as needed) ─────────────────

// One-time health check caches whether brain-server is reachable so
// per-question fetches don't each time out.
let _unityReachable = null;

async function unityHealthCheck() {
  if (_unityReachable !== null) return _unityReachable;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    const resp = await fetch('http://localhost:7525/health', { signal: ctrl.signal });
    clearTimeout(timer);
    _unityReachable = resp.ok;
  } catch {
    _unityReachable = false;
  }
  if (!_unityReachable) {
    console.log('[ablation] Unity brain-server unreachable at localhost:7525 — Unity arm will return empty answers.');
  }
  return _unityReachable;
}

async function runUnity(question) {
  // Placeholder — delegates to the running brain-server.js by posting
  // the question over HTTP and reading the response. If the server
  // isn't running, returns an empty answer fast (no fetch) so the
  // harness completes in seconds instead of minutes.
  //
  // TO WIRE: run `start.bat` to bring brain-server up on port 7525,
  // then this hits POST /process-text {text, ...} and reads the
  // response.
  if (!(await unityHealthCheck())) return '';
  // Real question endpoint TBD — return empty for baseline zero.
  return '';
}

async function runTransformer(question, modelName, scale) {
  // Placeholder — accepts any callable `generate(prompt)`. When wired,
  // this calls the transformer backend (openai-compatible HTTP,
  // transformers-js, or subprocess bridge) and returns the raw
  // generated string. Scoring is identical to Unity's answer to keep
  // the comparison clean.
  //
  // TO WIRE: set env OPENAI_BASE_URL to a local llama.cpp server,
  // pick the model weights at the specified scale, and replace this
  // stub with a real fetch call.
  return '';
}

// ─── Run one arm (Unity OR transformer) across the full bank ────────

async function runArm(armName, generator, examBanks) {
  const perStandard = new Map();
  const perSource = new Map();
  const perCell = new Map();
  let totalPass = 0;
  let totalCount = 0;

  for (const [cellKey, bank] of Object.entries(examBanks)) {
    let cellPass = 0;
    for (const q of bank) {
      const answer = await generator(q.question);
      const r = scoreAnswer(answer, q.expectedAnswer, q.expectedVariants);
      const pass = r.match.overall ? 1 : 0;
      totalPass += pass;
      totalCount += 1;
      cellPass += pass;
      const std = q.standard || 'unspecified';
      const src = q.source || 'authored';
      {
        const b = perStandard.get(std) || { pass: 0, total: 0 };
        b.pass += pass; b.total += 1;
        perStandard.set(std, b);
      }
      {
        const b = perSource.get(src) || { pass: 0, total: 0 };
        b.pass += pass; b.total += 1;
        perSource.set(src, b);
      }
    }
    perCell.set(cellKey, { pass: cellPass, total: bank.length, rate: bank.length > 0 ? cellPass / bank.length : 0 });
  }

  return {
    armName,
    aggregate: { pass: totalPass, total: totalCount, rate: totalCount > 0 ? totalPass / totalCount : 0 },
    perCell: [...perCell.entries()].map(([k, v]) => ({ cellKey: k, ...v })),
    perStandard: [...perStandard.entries()].map(([k, v]) => ({ standard: k, pass: v.pass, total: v.total, rate: v.total > 0 ? v.pass / v.total : 0 })),
    perSource: [...perSource.entries()].map(([k, v]) => ({ source: k, pass: v.pass, total: v.total, rate: v.total > 0 ? v.pass / v.total : 0 })),
  };
}

// ─── Main — run both arms, print comparison ─────────────────────────

function printReport(unity, transformer) {
  const pad = (s, n) => String(s).padEnd(n);
  const pct = (r) => `${(r * 100).toFixed(1)}%`;

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('TRANSFORMER-vs-RULKOV ABLATION REPORT');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');
  console.log('AGGREGATE');
  console.log(`  Unity        ${unity.aggregate.pass}/${unity.aggregate.total} = ${pct(unity.aggregate.rate)}`);
  console.log(`  Transformer  ${transformer.aggregate.pass}/${transformer.aggregate.total} = ${pct(transformer.aggregate.rate)}`);
  const delta = unity.aggregate.rate - transformer.aggregate.rate;
  console.log(`  Δ (unity - transformer): ${(delta * 100).toFixed(1)} pp ${delta > 0 ? '(Unity wins)' : delta < 0 ? '(Transformer wins)' : '(tie)'}`);
  console.log('');
  console.log('PER CELL');
  for (const u of unity.perCell) {
    const t = transformer.perCell.find(t => t.cellKey === u.cellKey) || { rate: 0 };
    console.log(`  ${pad(u.cellKey, 24)} Unity ${pct(u.rate)}  Transformer ${pct(t.rate)}  Δ ${((u.rate - t.rate) * 100).toFixed(1)} pp`);
  }
  console.log('');
  console.log('PER SOURCE (external reference items broken out)');
  for (const u of unity.perSource) {
    const t = transformer.perSource.find(t => t.source === u.source) || { rate: 0 };
    console.log(`  ${pad(u.source, 24)} Unity ${pct(u.rate)}  Transformer ${pct(t.rate)}  n=${u.total}`);
  }
  console.log('');
  console.log('INTERPRETATION');
  if (Math.abs(delta) < 0.02) {
    console.log('  Within 2 pp — architectures computationally equivalent on this task.');
    console.log('  Rulkov contribution is research novelty (continuous dynamics, Ψ, drug pharmacokinetics) — not task performance.');
  } else if (delta < -0.05) {
    console.log('  Transformer beats Unity by > 5 pp. The neural sim layer is decorative on this task.');
    console.log('  The GloVe embeddings are doing the work — any sequence model on top would match.');
    console.log('  Suggested pivot: use transformer+GloVe as cognition stack, keep Rulkov sim for visualization / drug-modulation research.');
  } else if (delta > 0.05) {
    console.log('  Unity beats transformer by > 5 pp at matched compute. Research-worthy finding — the neural sim provides inductive bias the transformer cannot replicate at comparable param count.');
    console.log('  Consider writing this up as a research note.');
  } else {
    console.log('  Marginal difference. Not decisive either direction.');
  }
  console.log('');
}

async function main() {
  const args = process.argv.slice(2);
  const modelName = args.find(a => a.startsWith('--model='))?.split('=')[1] || 'gpt2';
  const scale = args.find(a => a.startsWith('--scale='))?.split('=')[1] || '10M';

  console.log(`[ablation] loading exam banks...`);
  const examBanks = await loadExamBanks();
  const totalQuestions = Object.values(examBanks).reduce((a, b) => a + b.length, 0);
  console.log(`[ablation] loaded ${Object.keys(examBanks).length} cells · ${totalQuestions} questions total`);
  console.log(`[ablation] transformer backend: ${modelName} @ ${scale}`);
  console.log('');
  console.log('⚠ STUB MODE — neither backend wired yet. This run produces baseline-zero scores.');
  console.log('  To make this real: wire runUnity() to the brain-server HTTP endpoint + runTransformer() to a llama.cpp or transformers-js backend.');
  console.log('');

  const unity = await runArm('Unity', runUnity, examBanks);
  const transformer = await runArm('Transformer', (q) => runTransformer(q, modelName, scale), examBanks);

  printReport(unity, transformer);
}

main().catch(err => {
  console.error('[ablation] fatal:', err);
  process.exit(1);
});
