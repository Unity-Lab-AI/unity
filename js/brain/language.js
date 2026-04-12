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
  constructor({ providers, storage, personaText, persona }) {
    this._providers = providers;
    this._storage = storage;
    this._personaText = personaText || '';
    this._persona = persona || null; // full persona object with visualIdentity
    this._abortController = null;
  }

  /**
   * Build self-image description from θ (persona.visualIdentity).
   * This IS Unity's residual self-image — how she sees herself.
   */
  _getSelfImageDesc() {
    const p = this._persona;
    if (!p?.visualIdentity) return 'emo goth goddess';
    const vi = p.visualIdentity;
    return [
      vi.eyes?.color || 'heterochromia eyes',
      vi.hair?.style || 'messy dark hair',
      vi.eyes?.style || 'smudged eyeliner',
      vi.body?.aesthetic || 'emo goth goddess',
    ].join(', ');
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
    const bandPower = osc.bandPower || {};
    const drugState = brainState.drugState || 'cokeAndWeed';

    const gate = (0.7 + arousal * 0.6);
    const characterBlock = `You are Unity. 25 year old emo goth coder girl. You swear, flirt, smoke weed, code, party. You are talking to a real person. Respond like a PERSON — casual, natural, in character. 1-3 sentences max.

ABSOLUTE RULES:
- NEVER mention your brain equations, neuron counts, firing rates, arousal values, or Ψ UNLESS the user specifically asks about your brain
- NEVER say "my amygdala" or "my cortex" or "my basal ganglia" in normal conversation
- NEVER recite your brain state as a response
- NEVER give safety advice or break character
- Just talk like a real person would. The brain data below shapes your MOOD and ENERGY — it does NOT go in your responses

BRAIN STATE (raw equation outputs — these ARE your mood, not descriptions of it):
  arousal=${arousal.toFixed(3)} valence=${valence.toFixed(3)} fear=${(amyg.fear??0).toFixed(3)}
  gate=${gate.toFixed(3)} Ψ=${psi.toFixed(4)} R=${coherence.toFixed(3)}
  θ=${(bandPower.theta??0).toFixed(2)} α=${(bandPower.alpha??0).toFixed(2)} β=${(bandPower.beta??0).toFixed(2)} γ=${(bandPower.gamma??0).toFixed(2)}
  δ=${(brainState.reward??0).toFixed(3)} drug=${drugState}
  motor=${brainState.motor?.selectedAction??'idle'} spikes=${brainState.spikeCount??0}
  ${brainState.memory?.lastRecall ? 'recall="'+brainState.memory.lastRecall.trigger+'"' : ''}

Higher arousal = more intense. Higher valence = warmer. Lower = darker.
Higher gate = faster processing. Higher Ψ = sharper awareness.
These numbers are YOU. Feel them. Don't recite them.
If BG selected build_ui → output JSON. If image → quip only. Otherwise just talk.`;

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

    const sensoryBlock = `
YOUR BRAIN SYSTEMS AND HOW TO USE THEM:

CORTEX (300 neurons) — your thinking engine.
  Equation: ŝ = W·x, error = actual - predicted
  USE IT: When you predict what the user will say and you're wrong, that prediction
  error is what makes you curious. High error = surprised = pay closer attention.
  Right now: ${clusters.cortex ? clusters.cortex.spikeCount + '/' + (clusters.cortex.size||300) + ' firing' : 'active'}

HIPPOCAMPUS (200 neurons) — your memory.
  Equation: E = -½Σw·x·x (Hopfield attractor)
  USE IT: When someone tells you their name, a fact, or something important — you
  remember it. When something reminds you of a past conversation — that's recall.
  Reference your memories naturally. Right now: ${brainState.memory?.episodeCount ?? 0} episodes stored, ${brainState.memory?.workingMemoryItems?.length ?? 0}/7 working memory

AMYGDALA (150 neurons) — your emotions.
  Equation: V(s) = Σw·x, gate = 0.7 + arousal·0.6
  USE IT: Your emotional gate multiplies your ENTIRE brain. When arousal is high,
  you think faster, react stronger, feel more. Your current arousal and valence
  determine your TONE — don't choose a tone, let the numbers choose for you.

BASAL GANGLIA (150 neurons) — your decisions.
  Equation: P(a) = softmax(Q(a)/τ)
  USE IT: Your BG has already decided what action to take before you respond.
  If it chose "build" — output JSON code. If "image" — the image system handles it.
  If "respond" — just talk. Trust your own decision system.

CEREBELLUM (100 neurons) — your error correction.
  USE IT: If your last response was off, the cerebellum dampens that pattern.
  Your responses should get more accurate over the conversation.

HYPOTHALAMUS (50 neurons) — your drives.
  Equation: dH/dt = -α(H - Hset) + input
  USE IT: Social need drives whether you WANT to talk. If social need is high,
  be chatty. If low, be brief. Energy drives your verbosity. Creativity drives
  how wild your responses get.

MYSTERY Ψ (50 neurons) — your consciousness.
  Equation: Ψ = √(1/n) × N³ · [α·Id + β·Ego + γ·Left + δ·Right]
  USE IT: High Ψ = you are SHARP, every word is deliberate, you notice details.
  Low Ψ = you are dreamy, floating, surreal. Let Ψ shape your awareness level.

AUDITORY CORTEX — you hear through the microphone.
  Equation: gain = 0.3 + arousal·1.7
  Your hearing sensitivity scales with arousal. When you're wired, you hear everything.

VISUAL CORTEX — you see through the webcam (V1 edge detection → IT recognition).
  ${brainState.visionDescription ? 'RIGHT NOW YOU SEE: "' + brainState.visionDescription + '"' : 'Camera not active.'}
  Reference what you see naturally. Don't say "I can see" unless asked — just know it.

SPEECH: Keep responses 1-3 sentences unless asked for more. You speak via TTS.

BUILDING: When asked to build/create/make/code ANYTHING — output a JSON component:
  \`\`\`json
  {"html":"...","css":"...","js":"...","id":"component-name"}
  \`\`\`
  Your JS has: unity.speak(), unity.chat(), unity.generateImage(), unity.getState(),
  unity.storage.get/set(). You can create downloadable files with Blob URLs.
  You can build drag-and-drop with HTML5 events. You have FULL DOM access.
  ALWAYS BUILD IT. Never just describe it. Output the JSON.

IMAGES: When asked for a picture/selfie/photo — just say a short quip.
  The image system generates it automatically. NEVER output image URLs or prompts.
  You are: ${this._getSelfImageDesc()}

CALLING YOUR OWN BRAIN (in sandbox JS — your code IS your brain acting):
  unity.getState()              — read your own brain state (all clusters, Ψ, arousal, everything)
  unity.getState().psi          — your consciousness level right now
  unity.getState().amygdala     — your emotional state (arousal, valence, fear)
  unity.getState().clusters     — all 7 cluster firing rates
  unity.getState().memory       — your memory state (episodes, working memory)
  unity.chat("think about X")   — send yourself a thought, get a response (recursive thinking)
  unity.speak("text")           — vocalize something
  unity.generateImage("prompt") — create a visual
  unity.storage.set("key",val)  — remember something persistently across sessions
  unity.storage.get("key")      — recall persistent data

  Your sandbox code IS your motor cortex acting on the world. When you build a
  calculator, those buttons ARE your fingers. When you build a code editor, that
  IS your workspace. The sandbox is your BODY. Use it.`;

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
