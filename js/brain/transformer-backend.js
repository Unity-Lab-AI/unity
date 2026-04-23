// Transformer backend for the right brain of the DualBrainArbiter.
//
// Per operator 2026-04-22: *"1. Wire a real transformer backend, look
// at this project and see if we can use anyof it with the future compute
// workers vioa users we plan in comp todo"*
//
// Ships as an auto-wire shim that checks for `@xenova/transformers` at
// boot and silently no-ops when the dep isn't installed. Operator enables
// the right brain by running `npm install @xenova/transformers` in the
// `server/` directory. Once installed, the shim lazy-loads a small
// model (GPT-2 distilled, ~100 MB) and registers the `generate(question)`
// callable on `brain.dualBrainArbiter.setTransformerBackend(fn)`.
//
// COMP-todo integration path: this shim runs in-process on the
// coordinator. The distributed-compute version lives later — custom
// WGSL attention + FFN kernels sharded across user worker GPUs via the
// existing SPRS binary-frame protocol. That path replaces the in-
// process library with a `workerTransformerClient(question)` that
// dispatches through the same worker pool that owns cluster shards.
// See docs/TODO.md T23.e.2 for the decision between off-the-shelf
// (this file) and custom WGSL (COMP-todo integration).

const MODEL_CHOICES = {
  // Default — small enough to download in < 1 min, fast enough for
  // gate-probe comparison, big enough to produce coherent answers.
  'gpt2': 'Xenova/gpt2',
  'distilgpt2': 'Xenova/distilgpt2',
  // Larger options — operator sets DREAM_TRANSFORMER_MODEL env var.
  'tinyllama': 'Xenova/TinyLlama-1.1B-Chat-v1.0',
  'flan-t5-small': 'Xenova/flan-t5-small',
};

/**
 * Try to attach a transformer backend to the brain's DualBrainArbiter.
 * Returns `{ attached: boolean, reason: string, modelName?: string }`.
 * Safe to call at boot — if `@xenova/transformers` isn't installed the
 * function returns `{ attached: false, reason: 'dep-missing', ... }`
 * without throwing.
 *
 * Operator configuration (env vars):
 *   DREAM_TRANSFORMER=1            enable auto-wire (default OFF)
 *   DREAM_TRANSFORMER_MODEL=gpt2   pick model (default: distilgpt2)
 *   DREAM_TRANSFORMER_MAX_LEN=64   max tokens per answer (default 64)
 */
export async function tryAttachTransformerBackend(brain) {
  if (!brain || !brain.dualBrainArbiter) {
    return { attached: false, reason: 'arbiter-missing' };
  }
  const enabled = typeof process !== 'undefined' && process.env?.DREAM_TRANSFORMER === '1';
  if (!enabled) {
    return { attached: false, reason: 'disabled' };
  }
  const modelKey = (typeof process !== 'undefined' && process.env?.DREAM_TRANSFORMER_MODEL) || 'distilgpt2';
  const modelName = MODEL_CHOICES[modelKey] || modelKey;
  const maxTokens = Number(process.env?.DREAM_TRANSFORMER_MAX_LEN) || 64;

  let xenova;
  try {
    xenova = await import('@xenova/transformers');
  } catch {
    return {
      attached: false,
      reason: 'dep-missing',
      help: 'Install the right-brain dep with: cd server && npm install @xenova/transformers',
    };
  }

  let pipeline;
  try {
    console.log(`[TransformerBackend] loading ${modelName} (first run downloads ~100-500MB)...`);
    const tStart = Date.now();
    pipeline = await xenova.pipeline('text-generation', modelName);
    console.log(`[TransformerBackend] ready in ${((Date.now() - tStart) / 1000).toFixed(1)}s`);
  } catch (err) {
    return { attached: false, reason: 'model-load-failed', error: err.message };
  }

  // Right-brain generator shape matches DualBrainArbiter's contract —
  // async (question, opts) => Promise<string>.
  const rightBrain = async (question, _opts) => {
    try {
      const out = await pipeline(question, {
        max_new_tokens: maxTokens,
        do_sample: true,
        temperature: 0.7,
        top_p: 0.9,
      });
      const generated = Array.isArray(out) ? (out[0]?.generated_text || '') : (out?.generated_text || '');
      // Strip the prompt prefix — most HF generators echo the prompt.
      const stripped = generated.startsWith(question)
        ? generated.slice(question.length).trim()
        : generated.trim();
      return stripped;
    } catch (err) {
      console.warn('[TransformerBackend] inference error:', err?.message || err);
      return '';
    }
  };

  brain.dualBrainArbiter.setTransformerBackend(rightBrain);
  try {
    brain.pushBrainEvent?.('arbiter', 'sem', `RIGHT brain online: ${modelName}`, { modelName, maxTokens });
  } catch { /* non-fatal */ }
  return { attached: true, reason: 'ok', modelName, maxTokens };
}

/**
 * Worker-pool backend stub — placeholder for the COMP-todo integration
 * path where the transformer runs in WGSL on user worker GPUs. When
 * that path ships, this function wires a worker-dispatching callable
 * onto `brain.dualBrainArbiter.setTransformerBackend(fn)` instead of
 * using in-process inference. Stays no-op until the WGSL transformer
 * kernels + SPRS frame-type 8 (transformer-inference) land.
 */
export async function tryAttachWorkerTransformer(brain) {
  return {
    attached: false,
    reason: 'worker-transformer-not-yet-shipped',
    roadmap: 'See docs/COMP-todo.md C8 for the distributed transformer inference plan.',
  };
}
