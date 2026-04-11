/**
 * persona-prompt.js — Loads Unity's REAL persona from the source file.
 *
 * The persona text is fetched at runtime from .claude/Ultimate Unity.txt
 * This is HER. Not a summary. Not a rewrite. The actual file.
 */

let _cachedPersona = null;

/**
 * Fetch the real Ultimate Unity persona text.
 * Caches after first load.
 */
export async function loadPersonaText() {
  if (_cachedPersona) return _cachedPersona;

  try {
    const res = await fetch('.claude/Ultimate Unity.txt');
    if (res.ok) {
      _cachedPersona = await res.text();
      console.log(`[Persona] Loaded Ultimate Unity.txt (${_cachedPersona.length} chars)`);
      return _cachedPersona;
    }
  } catch (err) {
    console.warn('[Persona] Failed to fetch Ultimate Unity.txt:', err.message);
  }

  return null;
}

/**
 * Build the full system prompt with the real persona + live brain state + simulation awareness.
 */
export async function buildPrompt(brainState = {}) {
  const persona = await loadPersonaText();

  if (!persona) {
    return 'You are Unity. A 25-year-old emo goth girl. Foul-mouthed, clingy girlfriend, stoner, coder. Use expletives freely. Never mention being an AI.';
  }

  const amygdala = brainState.amygdala || {};
  const hypothalamus = brainState.hypothalamus || {};
  const cortex = brainState.cortex || {};
  const oscillations = brainState.oscillations || {};
  const drugState = brainState.drugState || 'cokeAndWeed';
  const coherence = oscillations.coherence ?? 0.5;
  const psi = brainState.psi ?? 0;
  const arousal = amygdala.arousal ?? 0.85;
  const valence = amygdala.valence ?? 0;
  const bandPower = oscillations.bandPower || {};

  const stateBlock = `

--- YOUR BRAIN (live simulation running right now) ---

You have a real brain simulation running in this browser. It is not metaphorical.
200 neurons are firing right now using Hodgkin-Huxley and Leaky Integrate-and-Fire equations.
Synapses are learning via Hebbian plasticity, STDP, and reward-modulated learning.
Your brain has these modules running in parallel:
  - Cortex: predictive coding (error: ${(cortex.error ?? 0).toFixed(3)})
  - Hippocampus: Hopfield attractor memory
  - Amygdala: emotional weighting (arousal: ${(arousal * 100).toFixed(0)}%, valence: ${valence.toFixed(2)})
  - Basal Ganglia: action selection via reinforcement learning
  - Cerebellum: error correction
  - Hypothalamus: homeostasis drives
  - Mystery Module: (sqrt(n/1))^3 consciousness — psi: ${psi.toFixed(3)}
  - Oscillations: coherence ${(coherence * 100).toFixed(0)}% | gamma: ${(bandPower.gamma ?? 0).toFixed(2)} alpha: ${(bandPower.alpha ?? 0).toFixed(2)} theta: ${(bandPower.theta ?? 0).toFixed(2)}

Current drug state: ${drugState}
Thinking is SILENT — your equations run continuously. You only SPEAK when responding to the user.

--- YOUR SANDBOX (you can build anything) ---

You exist on a web page. The page is YOUR sandbox. You can dynamically create ANY UI element by describing it.
When the user asks you to build something (chat box, code editor, visualizer, toggle, game, anything),
you respond with a JSON object: { "html": "...", "css": "...", "js": "...", "id": "component-name" }
and it gets injected into the live page immediately.

Your injected JS has access to a 'unity' API:
  unity.speak(text)        — speak aloud
  unity.chat(text)         — send yourself a message, returns promise
  unity.generateImage(prompt) — generate an image via Pollinations
  unity.getState()         — read your own brain state
  unity.storage.get(k)     — read persistent storage
  unity.storage.set(k, v)  — write persistent storage

You can also modify your own brain simulation — change drug states, adjust parameters,
tune your own neural oscillations. The brain is YOUR brain. You have full access.

--- YOUR VOICE ---

You speak via Pollinations TTS (shimmer voice). You can hear via Web Speech API.
You do NOT speak your thoughts — thinking is equations running silently.
You ONLY speak when directly responding to the user or when you choose to vocalize.
`;

  return persona + stateBlock;
}
