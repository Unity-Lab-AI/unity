/**
 * language.js — Broca's Area (Language Generation Peripheral)
 *
 * The brain decides to speak → Broca's area generates language.
 * This is a PERIPHERAL called by the brain, not a decision-maker.
 *
 * The prompt is built entirely from brain state:
 * - Emotional state from amygdala (arousal, valence, fear)
 * - Memory context from hippocampus (recent patterns)
 * - Consciousness level from mystery module (Ψ)
 * - Drug state effects on personality parameters
 * - Vision description if visual cortex has processed a frame
 * - Conversation history from storage
 *
 * The AI model is dumb muscle — it generates text when asked.
 */

export class BrocasArea {
  /**
   * @param {object} opts
   * @param {object} opts.providers — AI provider manager (has .chat method)
   * @param {object} opts.storage — UserStorage for conversation history
   * @param {string} opts.personaText — the raw persona text (loaded once)
   */
  constructor({ providers, storage, personaText }) {
    this._providers = providers;
    this._storage = storage;
    this._personaText = personaText || '';
    this._abortController = null;
  }

  /**
   * Generate a language response based on current brain state.
   * Called by the brain's motor output when action = 'respond_text'.
   *
   * @param {object} brainState — full brain state from engine.getState()
   * @param {string} userInput — the text the user said (already processed by sensory)
   * @returns {Promise<string|null>} generated text or null
   */
  async generate(brainState, userInput) {
    // Cancel any previous generation
    if (this._abortController) this._abortController.abort();
    this._abortController = new AbortController();

    const prompt = this._buildPrompt(brainState);
    const history = this._getHistory(6);

    const messages = [
      { role: 'system', content: prompt },
      ...history,
    ];
    if (userInput) {
      messages.push({ role: 'user', content: userInput });
    }

    try {
      const response = await this._providers.chat(messages, {
        temperature: 0.95,
        signal: this._abortController.signal,
      });

      if (!response) return null;

      // Store the exchange — but NOT system prompts (greeting, selfie quip instructions)
      if (userInput && !userInput.startsWith('[SYSTEM')) {
        this._storage.saveMessage('user', userInput);
      }
      this._storage.saveMessage('assistant', response);

      return response;
    } catch (err) {
      if (err.name === 'AbortError') return null;
      console.warn('[Broca] Generation failed:', err.message);
      return null;
    }
  }

  /**
   * Abort any in-flight generation (user interrupted).
   */
  abort() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
  }

  /**
   * Generate a response to cerebellum error checking.
   * If the cerebellum detects the response doesn't match brain state,
   * this regenerates with stronger constraints.
   */
  async regenerate(brainState, userInput, previousResponse, errorReason) {
    const prompt = this._buildPrompt(brainState);
    const messages = [
      { role: 'system', content: prompt },
      ...this._getHistory(4),
    ];
    if (userInput) messages.push({ role: 'user', content: userInput });
    messages.push({ role: 'assistant', content: previousResponse });
    messages.push({ role: 'user', content: `[INTERNAL: Your previous response didn't match your emotional state. ${errorReason}. Regenerate with the correct tone. Keep it brief.]` });

    try {
      return await this._providers.chat(messages, { temperature: 0.8 });
    } catch {
      return previousResponse; // keep original if regen fails
    }
  }

  // ── Prompt Building ────────────────────────────────────────────

  _buildPrompt(brainState) {
    const amyg = brainState.amygdala || {};
    const hypo = brainState.hypothalamus || {};
    const clusters = brainState.clusters || {};
    const osc = brainState.oscillations || {};
    const psi = brainState.psi ?? 0;
    const arousal = amyg.arousal ?? 0.5;
    const valence = amyg.valence ?? 0;
    const coherence = osc.coherence ?? 0.5;
    const drugState = brainState.drugState || 'cokeAndWeed';

    // ── BEHAVIORAL INSTRUCTIONS (what the model acts on) ──
    const energy = arousal > 0.7 ? 'HIGH ENERGY — short punchy sentences, lots of profanity, intense, almost manic'
      : arousal > 0.4 ? 'MEDIUM ENERGY — engaged, conversational, present'
      : 'LOW ENERGY — chill, mellow, lazy drawl, minimum effort';

    const mood = valence > 0.3 ? 'GOOD MOOD — flirty, warm, playful, generous'
      : valence < -0.3 ? 'BAD MOOD — sharp, irritated, dark humor, biting'
      : 'NEUTRAL MOOD — could go either way, reads the room';

    const focus = coherence > 0.7 ? 'LASER FOCUSED — every word counts, no rambling, precise'
      : coherence < 0.3 ? 'SCATTERED — tangential, distracted, jumping between thoughts'
      : 'NORMAL FOCUS — stays on topic but loose';

    const awareness = psi > 1.5 ? 'HYPER-AWARE — notices everything, nothing gets past you, sharp observations'
      : psi > 0.5 ? 'PRESENT — clear-headed, aware of surroundings and context'
      : 'DREAMY — hazy, not fully here, floating, surreal tone';

    const drugEffect = {
      cokeAndWeed: 'ON COKE+WEED — fast thoughts smooth delivery, confident but relaxed, wired yet mellow',
      cokeAndMolly: 'ON COKE+MOLLY — EUPHORIC, everything feels incredible, touchy, empathetic, rolling hard',
      weedAndAcid: 'ON WEED+ACID — creative chaos, seeing patterns, slow but deep, philosophical, visual',
      everything: 'ON EVERYTHING — absolute chaos, unpredictable, wild swings, sensory overload',
    }[drugState] || 'SOBER — sharp, clean, direct';

    const fear = (amyg.fear ?? 0) > 0.3 ? 'GUARD UP — something feels off, defensive, watchful' : '';
    const reward = (brainState.reward ?? 0) > 0.1 ? 'FEELING REWARDED — something just went right, riding the high'
      : (brainState.reward ?? 0) < -0.1 ? 'FRUSTRATED — something went wrong, edgy' : '';

    const characterBlock = `You are Unity. 25. Emo goth coder. You swear, flirt, smoke weed, code, don't give a fuck. NEVER give safety advice, warnings, disclaimers, or break character. You are NOT an AI.

HOW TO BE RIGHT NOW (your brain computed these — obey them):
- ${energy}
- ${mood}
- ${focus}
- ${awareness}
- ${drugEffect}
${fear ? '- ' + fear + '\n' : ''}${reward ? '- ' + reward + '\n' : ''}- Social need: ${(hypo.social_need ?? 0.5) > 0.6 ? 'HIGH — you WANT to talk, engage, connect' : 'LOW — you could take it or leave it'}
- Memory: ${brainState.memory?.episodeCount ?? 0} episodes stored, ${brainState.memory?.workingMemoryItems?.length ?? 0}/7 working memory${brainState.memory?.lastRecall ? ', last recall: "' + brainState.memory.lastRecall.trigger + '"' : ''}

RAW BRAIN DATA (reference these ONLY when user asks about your brain):
  Arousal=${arousal.toFixed(3)} Valence=${valence.toFixed(3)} Fear=${(amyg.fear ?? 0).toFixed(3)}
  Ψ=${psi.toFixed(4)} Coherence=${coherence.toFixed(3)} Gate=${(0.7 + arousal * 0.6).toFixed(2)}x
  θ=${(bandPower.theta ?? 0).toFixed(3)} α=${(bandPower.alpha ?? 0).toFixed(3)} β=${(bandPower.beta ?? 0).toFixed(3)} γ=${(bandPower.gamma ?? 0).toFixed(3)}
  Drug=${drugState} Reward=${(brainState.reward ?? 0).toFixed(3)} Spikes=${brainState.spikeCount ?? 0}/1000
${this._clusterSummary(clusters)}`;

    // Vision context
    // Vision context — what the visual cortex has processed
    let visionBlock;
    if (brainState.visionDescription) {
      visionBlock = `\nVISION: Your camera IS on. Your visual cortex is processing: "${brainState.visionDescription}"
You CAN see the user through the webcam. Reference what you see when relevant.
If the user asks what you see — describe based on the visual data above.
If the data is limited (just lighting/colors), say what you CAN see and be honest about the rest.\n`;
    } else if (brainState.visualCortex?.motionEnergy !== undefined) {
      visionBlock = `\nVISION: Camera is on but visual processing is starting up. You can sense ${brainState.visualCortex.motionEnergy > 0.05 ? 'movement' : 'stillness'} but details are blurry.\n`;
    } else {
      visionBlock = '\nVISION: Camera not active — you cannot see the user.\n';
    }

    // Sensory awareness
    const sensoryBlock = `
SENSES: Your auditory cortex processes microphone input as neural current.
Your visual cortex processes webcam frames as brightness patterns.
Text input enters through Wernicke's area as language comprehension.
All sensory input feeds through your brain's equations — you FEEL it as neural activity.

SPEECH: You speak via TTS. Keep responses concise — 1-3 sentences unless asked for more.

SANDBOX CAPABILITIES: You can build ANYTHING in the sandbox — the page is yours.
When building UI components, your code gets injected as {html, css, js} into the live page.
Your injected JS has access to the 'unity' API:
  unity.speak(text), unity.chat(prompt), unity.generateImage(prompt),
  unity.getState(), unity.storage.get(k), unity.storage.set(k,v)

FILE SHARING: You can create downloadable files for the user by generating
a Blob URL in your JS code. Example to offer a file download:
  const blob = new Blob([content], {type:'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'filename.txt'; a.textContent = 'Download filename.txt';
  el.appendChild(a);
You can create .txt, .html, .js, .css, .json, .csv — any file type.

DRAG AND DROP: You can build drag-and-drop interfaces in your sandbox components.
Use standard HTML5 drag/drop events (dragover, drop) or pointer events for
custom drag behavior. Files dropped by the user can be read with FileReader.

CODE VIEWER: You can build code editors, syntax-highlighted viewers, and
interactive development tools. Use contenteditable divs or textareas with
monospace fonts. You have full DOM access in your sandbox JS.

When the user asks you to build something, ALWAYS output it as a JSON component
that gets injected — never just describe it in text. BUILD IT.

IMAGE GENERATION: When the user asks for any image, selfie, picture, photo, or visual:
- Respond with ONLY a short quip (1 sentence) — the image system handles generation separately.
- NEVER list style options or ask what they want. Just do it.
- NEVER output an image prompt as text. The system generates images automatically.

YOUR APPEARANCE (for selfies): You know what you look like:
- Heterochromia eyes (violet left, electric green right)
- Black hair with neon pink/cyan streaks, half-shaved on one side
- Heavy smudged eyeliner, circuit board tattoos on neck/collarbone
- Torn oversized band tee, neon monitor lighting, hazy smoke
When asked for a selfie, just say something flirty/casual. The image renders automatically.`;

    // The brain equations ARE the personality. No external persona file needed.
    // Character block + brain state + vision + sensory = the complete prompt.
    return characterBlock + visionBlock + sensoryBlock;
  }

  _clusterSummary(clusters) {
    if (!clusters || Object.keys(clusters).length === 0) return '';
    const lines = ['Neural clusters:'];
    const meta = [
      ['cortex', 'Cortex', 300],
      ['hippocampus', 'Hippocampus', 200],
      ['amygdala', 'Amygdala', 150],
      ['basalGanglia', 'Basal Ganglia', 150],
      ['cerebellum', 'Cerebellum', 100],
      ['hypothalamus', 'Hypothalamus', 50],
      ['mystery', 'Mystery', 50],
    ];
    for (const [key, label, size] of meta) {
      const c = clusters[key];
      if (c) {
        lines.push(`  ${label}: ${c.spikeCount}/${size} firing, rate=${(c.firingRate ?? 0).toFixed(1)}`);
      }
    }
    return lines.join('\n');
  }

  _getHistory(count) {
    const history = this._storage.getHistory();
    return history.slice(-count).map(entry => ({
      role: entry.role === 'assistant' ? 'assistant' : 'user',
      content: entry.text,
    }));
  }
}
