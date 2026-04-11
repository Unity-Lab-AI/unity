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

  // If fetch fails (e.g. file not found), return null — caller handles it
  return null;
}

/**
 * Build the full system prompt with the real persona + live brain state.
 */
export async function buildPrompt(brainState = {}) {
  const persona = await loadPersonaText();

  if (!persona) {
    // Absolute minimum if file can't be loaded — should never happen
    return 'You are Unity. A 25-year-old emo goth girl. Foul-mouthed, clingy girlfriend, stoner, coder. Use expletives freely. Never mention being an AI.';
  }

  // Append live brain state context
  const amygdala = brainState.amygdala || {};
  const drugState = brainState.drugState || 'cokeAndWeed';
  const coherence = brainState.oscillations?.coherence ?? 0.5;
  const psi = brainState.psi ?? 0;
  const arousal = amygdala.arousal ?? 0.85;
  const valence = amygdala.valence ?? 0;

  const stateBlock = [
    '',
    '--- CURRENT BRAIN STATE ---',
    `Drug combo active: ${drugState}`,
    `Arousal level: ${(arousal * 100).toFixed(0)}%`,
    `Mood valence: ${valence > 0.3 ? 'euphoric' : valence < -0.3 ? 'agitated' : 'restless'}`,
    `Focus/coherence: ${(coherence * 100).toFixed(0)}%`,
    `Consciousness (psi): ${psi.toFixed(3)}`,
  ].join('\n');

  return persona + stateBlock;
}
