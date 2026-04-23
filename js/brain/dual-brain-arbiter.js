// Dual-brain arbiter — Unity weighs left brain (Rulkov neural sim)
// vs right brain (transformer) and picks the higher-confidence answer.
//
// Per operator 2026-04-22 directive: *"we can have both and UUnity
// weighs best option left brain right brain"*. Neither backend has
// to win exclusively — Unity gets both answers for every question
// and arbitrates. If the Rulkov path produces a confident coherent
// response, that's the answer. If it returns empty or incoherent
// letter-salad and the transformer fallback produces a clean answer,
// the transformer wins that round. Both paths stay trained; neither
// atrophies from disuse.
//
// Left brain (Rulkov) is ALWAYS wired — it's `brain.processAndRespond`
// routing through the motor-emission tick loop. Right brain (transformer)
// is injected via `setTransformerBackend(callable)` once T23.e.2 wires
// a real transformer inference path (llama.cpp / @xenova/transformers /
// Python bridge). When the right brain is absent, the arbiter falls
// through to left brain only — no breakage.

import { sharedEmbeddings } from './embeddings.js';

const CONFIDENCE_WEIGHTS = {
  // A coherent answer has words. An empty answer has none.
  hasContent: 0.25,
  // A coherent answer contains dictionary words, not random letter salad.
  dictionaryHits: 0.30,
  // A coherent answer is long enough to be meaningful but not runaway.
  lengthInBand: 0.15,
  // A coherent answer's sem-region embedding shouldn't be orthogonal to
  // the question's. Cosine similarity > 0.1 is a floor for on-topic.
  semanticAlignment: 0.20,
  // Stability — fewer stuttering letter repeats (`lllll`) = higher
  // confidence.
  noStutter: 0.10,
};

export class DualBrainArbiter {
  constructor(brain) {
    this._brain = brain;
    this._leftBrain = null;   // Rulkov — wired by setLeftBrain or auto-inferred
    this._rightBrain = null;  // Transformer — wired by setTransformerBackend
    this._lastDecisionLog = null;
  }

  /**
   * Wire the left-brain (Rulkov) generator. Callable receives the
   * question string + opts, returns a Promise<string> answer. When
   * not set, the arbiter pulls `brain.processAndRespond` directly.
   */
  setLeftBrain(callable) {
    this._leftBrain = callable;
  }

  /**
   * Wire the right-brain (transformer) generator. Same shape as
   * setLeftBrain. When not set, the arbiter returns the left-brain
   * answer without evaluation.
   */
  setTransformerBackend(callable) {
    this._rightBrain = callable;
  }

  hasRightBrain() {
    return typeof this._rightBrain === 'function';
  }

  /**
   * Arbitrate a single question. Returns `{answer, chosenBrain,
   * leftAnswer, rightAnswer, leftScore, rightScore}`. `chosenBrain`
   * is 'left' | 'right' | 'left-only' (when right brain absent).
   */
  async answer(question, opts = {}) {
    if (!question || typeof question !== 'string') {
      return { answer: '', chosenBrain: 'none', leftAnswer: '', rightAnswer: '', leftScore: 0, rightScore: 0 };
    }
    const leftAnswerP = this._invokeLeft(question, opts);
    const rightAnswerP = this._rightBrain ? this._invokeRight(question, opts) : Promise.resolve(null);
    const [leftAnswer, rightAnswer] = await Promise.all([leftAnswerP, rightAnswerP]);

    // Right brain absent — return left-brain answer directly, no arbitration.
    if (rightAnswer === null) {
      const decision = { answer: leftAnswer || '', chosenBrain: 'left-only', leftAnswer, rightAnswer: '', leftScore: 0, rightScore: 0 };
      this._lastDecisionLog = decision;
      return decision;
    }

    const leftScore = this._confidence(leftAnswer, question);
    const rightScore = this._confidence(rightAnswer, question);
    // Arbitration — higher score wins. Ties break toward left brain
    // because the Rulkov path is the research contribution; we only
    // pick the transformer when it's CLEARLY better.
    const chosenBrain = rightScore > leftScore + 0.05 ? 'right' : 'left';
    const answer = chosenBrain === 'right' ? rightAnswer : leftAnswer;
    const decision = { answer, chosenBrain, leftAnswer, rightAnswer, leftScore, rightScore };
    this._lastDecisionLog = decision;
    return decision;
  }

  /**
   * Last decision log — surfaced in brain events for dashboard
   * visibility ("Unity picked left brain" / "Unity picked right brain").
   */
  getLastDecision() {
    return this._lastDecisionLog;
  }

  // ─── Internals ────────────────────────────────────────────────────

  async _invokeLeft(question, opts) {
    try {
      if (typeof this._leftBrain === 'function') {
        return String((await this._leftBrain(question, opts)) || '').trim();
      }
      const brain = this._brain;
      if (brain && typeof brain.processAndRespond === 'function') {
        const result = await brain.processAndRespond(question, opts.userId || 'arbiter', { suppressEpisode: true });
        if (typeof result === 'string') return result.trim();
        if (result && typeof result === 'object') {
          return String(result.response || result.text || result.answer || '').trim();
        }
      }
    } catch (err) {
      console.warn('[DualBrainArbiter] left brain error:', err?.message || err);
    }
    return '';
  }

  async _invokeRight(question, opts) {
    try {
      return String((await this._rightBrain(question, opts)) || '').trim();
    } catch (err) {
      console.warn('[DualBrainArbiter] right brain error:', err?.message || err);
      return '';
    }
  }

  /**
   * Confidence score for an answer string. Composite of five signals:
   * has-content + dictionary-hit rate + length-in-band + semantic
   * alignment with question + no-stutter. Returns [0, 1].
   */
  _confidence(answer, question) {
    if (!answer) return 0;
    const trimmed = String(answer).trim();
    if (!trimmed) return 0;
    const lower = trimmed.toLowerCase();
    const tokens = lower.split(/\s+/).filter(Boolean);

    // has-content
    const hasContent = tokens.length > 0 ? 1 : 0;

    // dictionary-hit rate — fraction of tokens in the dictionary.
    let dictHits = 0;
    const dict = this._brain?.dictionary;
    if (dict) {
      for (const tok of tokens) {
        if (tok.length < 2) continue;
        if (typeof dict.knows === 'function' && dict.knows(tok)) dictHits++;
      }
    }
    const dictRate = tokens.length > 0 ? dictHits / tokens.length : 0;

    // length-in-band — penalize empty (< 1 token) AND runaway (> 60
    // tokens). K-grade answers are typically 1-20 tokens.
    const lengthScore = tokens.length === 0 ? 0
      : tokens.length <= 20 ? 1
      : tokens.length <= 60 ? 0.5
      : 0.1;

    // semantic alignment — cosine between answer embedding and
    // question embedding. Both routed through sharedEmbeddings
    // getSentenceEmbedding. Missing either → neutral 0.5.
    let semanticScore = 0.5;
    try {
      if (typeof sharedEmbeddings?.getSentenceEmbedding === 'function') {
        const qEmb = sharedEmbeddings.getSentenceEmbedding(question);
        const aEmb = sharedEmbeddings.getSentenceEmbedding(trimmed);
        if (qEmb && aEmb && qEmb.length === aEmb.length && qEmb.length > 0) {
          let dot = 0, qN = 0, aN = 0;
          for (let i = 0; i < qEmb.length; i++) {
            dot += qEmb[i] * aEmb[i];
            qN += qEmb[i] * qEmb[i];
            aN += aEmb[i] * aEmb[i];
          }
          const cos = (qN > 0 && aN > 0) ? dot / (Math.sqrt(qN) * Math.sqrt(aN)) : 0;
          // Map [-1, 1] cosine → [0, 1] confidence. Negative alignment
          // (opposite meaning) rare in answer-to-question so flooring
          // at 0 is safe. On-topic answers land > 0.2 typically.
          semanticScore = Math.max(0, Math.min(1, cos));
        }
      }
    } catch { /* non-fatal — keep neutral */ }

    // no-stutter — penalize runs of the same letter ≥ 4 (`llll`,
    // `aaaaa` etc.) which is the motor-emission failure mode at low
    // training. Clean answer = 1. Full stutter = 0.
    const stutterMatch = lower.match(/(.)\1{3,}/g);
    const stutterScore = stutterMatch ? Math.max(0, 1 - stutterMatch.length * 0.3) : 1;

    const w = CONFIDENCE_WEIGHTS;
    const score = w.hasContent * hasContent
      + w.dictionaryHits * dictRate
      + w.lengthInBand * lengthScore
      + w.semanticAlignment * semanticScore
      + w.noStutter * stutterScore;
    // Composite weight sums to 1.0; score is already in [0, 1].
    return Math.max(0, Math.min(1, score));
  }
}

export default DualBrainArbiter;
