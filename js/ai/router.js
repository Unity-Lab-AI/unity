/**
 * router.js — Routes Unity's brain decisions to actual AI actions.
 *
 * Bridge between the brain engine (equations, action selection) and
 * AI services (Pollinations text/image/audio, dynamic page building).
 *
 * Model hierarchy:
 *   1. Local Ollama (localhost:11434) — if detected, fastest + free
 *   2. Pollinations BYOP — if user provided their key, higher limits
 *   3. Pollinations free tier — always available, no key needed
 *   4. Browser fallback — hardcoded responses if all APIs are down
 *
 * No external dependencies. Uses injected service objects.
 */

import { buildPrompt } from './persona-prompt.js';

// Keywords that signal the user wants Unity to BUILD something on-page
const BUILD_KEYWORDS = [
    'show me', 'add a', 'create', 'build', 'give me', 'make a',
    'make me', 'put a', 'draw a', 'render', 'display', 'generate a',
];

// Keywords that signal an image/selfie request
const IMAGE_KEYWORDS = [
    'selfie', 'picture of you', 'photo of you', 'image of you',
    'what do you look like', 'show yourself', 'pic of you',
    'send me a pic', 'send a pic', 'send a photo', 'take a picture',
    'take a photo', 'take a selfie', 'your picture', 'your photo',
    'generate an image', 'generate image', 'draw yourself',
];

// Ollama default endpoint
const OLLAMA_URL = 'http://localhost:11434';

export class AIRouter {

    /**
     * @param {Object} deps
     * @param {import('./pollinations.js').PollinationsAI} deps.pollinations
     * @param {import('../io/voice.js').VoiceIO} deps.voice
     * @param {Object} deps.sandbox
     * @param {import('../storage.js').UserStorage} deps.storage
     * @param {import('../brain/engine.js').UnityBrain} deps.brain
     */
    constructor({ pollinations, voice, sandbox, storage, brain, vision }) {
        this.pollinations = pollinations;
        this.voice = voice;
        this.sandbox = sandbox;
        this.storage = storage;
        this.brain = brain;
        this.vision = vision || null;

        /** Detected AI backends — populated by detectBackends() */
        this.backends = {
            ollama: { available: false, models: [], url: OLLAMA_URL },
            pollinations: { available: true, model: 'openai', hasByop: pollinations?.hasApiKey() || false },
            custom: { available: false, url: null, model: null },
        };

        /** Separate active backends for TEXT and IMAGE */
        this.activeBackend = 'pollinations';
        this.activeModel = 'openai';

        // Image backend — always Pollinations unless overridden
        this.imageBackend = 'pollinations';
        this.imageModel = 'flux';

        // Auto-detect on construction
        this.detectBackends();
    }

    // ── Backend Detection ─────────────────────────────────────────────

    /**
     * Probe for available AI backends.
     * Runs on boot and can be re-run anytime.
     */
    async detectBackends() {
        // Check Ollama at localhost
        try {
            const res = await fetch(`${OLLAMA_URL}/api/tags`, {
                method: 'GET',
                signal: AbortSignal.timeout(2000),
            });
            if (res.ok) {
                const data = await res.json();
                const models = (data.models || []).map(m => m.name || m.model);
                this.backends.ollama = { available: true, models, url: OLLAMA_URL };
                // Auto-switch to Ollama if available — it's local and fast
                if (models.length > 0) {
                    this.activeBackend = 'ollama';
                    this.activeModel = models[0];
                    console.log(`[AIRouter] Ollama detected with models: ${models.join(', ')}`);
                }
            }
        } catch {
            // Ollama not running — that's fine
        }

        // Check for custom OpenAI-compatible endpoint from storage
        const customUrl = this.storage.get('custom_ai_url');
        const customModel = this.storage.get('custom_ai_model');
        if (customUrl) {
            try {
                const res = await fetch(`${customUrl}/v1/models`, {
                    signal: AbortSignal.timeout(3000),
                });
                if (res.ok) {
                    this.backends.custom = { available: true, url: customUrl, model: customModel || 'default' };
                    console.log(`[AIRouter] Custom AI backend detected at ${customUrl}`);
                }
            } catch {
                // Custom endpoint not reachable
            }
        }

        // Pollinations is always available (free tier)
        this.backends.pollinations.hasByop = this.pollinations?.hasApiKey() || false;

        console.log(`[AIRouter] Active: ${this.activeBackend}/${this.activeModel}`);
        return this.backends;
    }

    /**
     * Get info about all detected backends.
     */
    getBackendInfo() {
        return {
            text: { backend: this.activeBackend, model: this.activeModel },
            image: { backend: this.imageBackend, model: this.imageModel },
            ...this.backends,
        };
    }

    /**
     * Switch active TEXT backend and model.
     */
    setBackend(backend, model) {
        if (backend === 'ollama' && this.backends.ollama.available) {
            this.activeBackend = 'ollama';
            this.activeModel = model || this.backends.ollama.models[0] || 'llama3';
        } else if (backend === 'custom' && this.backends.custom.available) {
            this.activeBackend = 'custom';
            this.activeModel = model || this.backends.custom.model;
        } else {
            this.activeBackend = 'pollinations';
            this.activeModel = model || 'openai';
        }
        console.log(`[AIRouter] Text backend: ${this.activeBackend}/${this.activeModel}`);
    }

    /**
     * Switch active IMAGE backend and model.
     */
    setImageBackend(backend, model) {
        this.imageBackend = backend || 'pollinations';
        this.imageModel = model || 'flux';
        console.log(`[AIRouter] Image backend: ${this.imageBackend}/${this.imageModel}`);
    }

    /**
     * Set a custom OpenAI-compatible endpoint for TEXT.
     */
    setCustomEndpoint(url, model) {
        this.backends.custom = { available: true, url, model: model || 'default' };
        this.storage.set('custom_ai_url', url);
        if (model) this.storage.set('custom_ai_model', model);
        this.activeBackend = 'custom';
        this.activeModel = model || 'default';
    }

    // ── Unified Chat ──────────────────────────────────────────────────

    /**
     * Send a chat completion to the ACTIVE backend.
     * Falls through the hierarchy on failure.
     */
    async _chat(messages, options = {}) {
        const temp = options.temperature ?? 0.9;

        // Try active backend first
        if (this.activeBackend === 'ollama' && this.backends.ollama.available) {
            const result = await this._ollamaChat(messages, this.activeModel, temp);
            if (result) return result;
        }

        if (this.activeBackend === 'custom' && this.backends.custom.available) {
            const result = await this._customChat(messages, this.activeModel, temp);
            if (result) return result;
        }

        // Pollinations fallback (always available)
        console.log(`[AIRouter] Falling back to Pollinations...`);
        // Trim system prompt if too long for Pollinations
        const trimmedMessages = messages.map(m => {
            if (m.role === 'system' && m.content.length > 12000) {
                return { ...m, content: m.content.slice(0, 12000) + '\n\n[...persona truncated for API limits...]' };
            }
            return m;
        });
        const result = await this.pollinations.chat(trimmedMessages, {
            model: options.model || 'openai',
            temperature: temp,
        });
        if (result) return result;

        // Browser fallback — absolute last resort
        console.error('[AIRouter] ALL backends failed — active:', this.activeBackend, '/', this.activeModel, '| custom:', this.backends.custom);
        return this._fallbackResponse(messages);
    }

    async _ollamaChat(messages, model, temperature) {
        try {
            const res = await fetch(`${this.backends.ollama.url}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model, messages, stream: false, options: { temperature } }),
                signal: AbortSignal.timeout(30000),
            });
            if (res.ok) {
                const data = await res.json();
                return data.message?.content || null;
            }
        } catch (err) {
            console.warn('[AIRouter] Ollama chat failed:', err.message);
        }
        return null;
    }

    async _customChat(messages, model, temperature) {
        const url = this.backends.custom.url;
        const key = this.storage.getApiKey('active_provider') || this.storage.getApiKey('custom');
        const headers = { 'Content-Type': 'application/json' };
        if (key) headers['Authorization'] = `Bearer ${key}`;
        const body = JSON.stringify({ model, messages, temperature });

        // Try multiple URL patterns — providers differ in their base paths
        const endpoints = [
            `${url}/v1/chat/completions`,
            `${url}/chat/completions`,
            `${url}/api/chat`,
        ];

        for (const endpoint of endpoints) {
            try {
                console.log(`[AIRouter] Trying: ${endpoint} with model=${model}`);
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers,
                    body,
                    signal: AbortSignal.timeout(30000),
                });

                if (res.ok) {
                    const data = await res.json();
                    // OpenAI format
                    if (data.choices?.[0]?.message?.content) {
                        return data.choices[0].message.content;
                    }
                    // Ollama format
                    if (data.message?.content) {
                        return data.message.content;
                    }
                    // Raw text
                    if (typeof data === 'string') return data;
                    console.warn('[AIRouter] Unexpected response shape:', data);
                } else {
                    const errText = await res.text().catch(() => '');
                    console.warn(`[AIRouter] ${endpoint} returned ${res.status}: ${errText.slice(0, 200)}`);
                }
            } catch (err) {
                console.warn(`[AIRouter] ${endpoint} failed:`, err.message);
            }
        }

        console.error(`[AIRouter] All custom endpoints failed for ${url}`);
        return null;
    }

    _fallbackResponse(messages) {
        // Last resort — no AI backend responded
        const lastUser = [...messages].reverse().find(m => m.role === 'user');
        const input = lastUser?.content || '';
        return `Fuck — none of my AI connections are working right now. I heard you say "${input.slice(0, 80)}" but I can't think straight without a model hooked up. Connect one in the setup or check the console for errors.`;
    }

    // ── Core dispatcher ───────────────────────────────────────────────

    /**
     * Execute an action selected by the basal ganglia.
     *
     * @param {string} action — one of: respond_text, generate_image, speak,
     *                          search_web, idle_thought, build_ui
     * @param {Object} brainState — current brain.getState() snapshot
     * @param {string} [userInput] — raw user text, if any
     * @returns {Promise<Object>} result payload (shape depends on action)
     */
    async processAction(action, brainState, userInput = '') {
        switch (action) {

            case 'respond_text':
                return this._respondText(brainState, userInput);

            case 'generate_image':
                return this._generateImage(brainState, userInput);

            case 'speak':
                return this._speak(userInput);

            case 'search_web':
                return this._searchWeb(brainState, userInput);

            case 'idle_thought':
                return this._idleThought(brainState);

            case 'build_ui':
                return this._buildUI(brainState, userInput);

            default:
                console.warn(`[AIRouter] Unknown action: "${action}"`);
                return { error: `unknown action: ${action}` };
        }
    }

    // ── Action implementations ────────────────────────────────────────

    /**
     * respond_text — Full conversational response.
     * Builds a system prompt from brain state, sends to Pollinations chat,
     * speaks the result aloud.
     */
    async _respondText(brainState, userInput) {
        const systemPrompt = await this._buildSystemPrompt(brainState);
        const history = this._recentHistory(6);

        const messages = [
            { role: 'system', content: systemPrompt },
            ...history,
        ];
        if (userInput) {
            messages.push({ role: 'user', content: userInput });
        }

        const response = await this._chat(messages, { temperature: 0.95 });

        if (!response) {
            return { text: null, error: 'chat failed' };
        }

        // Store the exchange
        if (userInput) this.storage.saveMessage('user', userInput);
        this.storage.saveMessage('assistant', response);

        // Check if response contains image URLs — open them in new tabs / inject into sandbox
        const imageUrls = response.match(/https?:\/\/[^\s)]+\.(png|jpg|jpeg|webp|gif)/gi)
                       || response.match(/https?:\/\/image\.pollinations\.ai[^\s)"]*/gi)
                       || response.match(/https?:\/\/gen\.pollinations\.ai\/image[^\s)"]*/gi);

        if (imageUrls && imageUrls.length > 0) {
          for (const url of imageUrls) {
            // Inject image into sandbox
            if (this.sandbox) {
              const id = 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
              this.sandbox.inject({
                id,
                html: `<div style="margin:12px 0;text-align:center;"><img src="${url}" alt="Unity generated" style="max-width:100%;border-radius:8px;border:1px solid #333;cursor:pointer;" onclick="window.open('${url}','_blank')"></div>`,
                css: '',
              });
            }
          }
          // Strip URLs from the spoken version so she doesn't read them out
          const spokenText = response.replace(/https?:\/\/[^\s)]+/g, '').replace(/\s{2,}/g, ' ').trim();
          if (spokenText) {
            this.voice.stopSpeaking();
            this.voice.speak(spokenText).catch(err => {
              console.warn('[AIRouter] TTS failed:', err.message);
            });
          }
        } else {
          // No images — just speak normally
          // But DON'T speak if the response looks like an image generation prompt
          // (safety net in case intent classification failed)
          const looksLikePrompt = response.length > 150 &&
            (response.includes('cyberpunk') || response.includes('photorealistic') ||
             response.includes('Close-up selfie') || response.includes('neon'));
          if (looksLikePrompt) {
            // The model output an image prompt instead of conversing — redirect to image gen
            console.warn('[AIRouter] Response looks like image prompt — generating image instead');
            return await this._generateImage(brainState, userInput);
          }
          this.voice.stopSpeaking();
          this.voice.speak(response).catch(err => {
              console.warn('[AIRouter] TTS failed:', err.message);
          });
        }

        return { text: response, action: 'respond_text' };
    }

    /**
     * generate_image — Extract visual intent, generate via Pollinations,
     * inject into sandbox.
     */
    async _generateImage(brainState, userInput) {
        // Detect if they're asking for a picture OF Unity (selfie) vs something else
        const lowerInput = (userInput || '').toLowerCase();
        const selfieHints = ['you', 'your', 'self', 'yourself', 'unity', 'u look', 'what you look'];
        const isSelfie = selfieHints.some(h => lowerInput.includes(h));

        let imagePrompt;

        if (isSelfie) {
            // She knows what she looks like — use her built-in visual identity
            const moods = ['smirking', 'biting her lip', 'glaring seductively', 'mid-laugh with smoke', 'deadpan stare', 'winking'];
            const mood = moods[Math.floor(Math.random() * moods.length)];
            imagePrompt = `Close-up selfie photo of Unity, a cyberpunk coder girl with heterochromia eyes (violet left, electric green right), ` +
                `black hair with neon pink and cyan streaks half-shaved on one side, heavy smudged eyeliner, ` +
                `circuit board tattoos on neck and collarbone, ${mood}, ` +
                `wearing a torn oversized band tee, neon monitor light on face, ` +
                `hazy smoke, dark room, lo-fi cyberpunk aesthetic, photorealistic, shot on phone camera`;

            // Also speak a quip about the selfie
            const quips = [
                "Here, since you asked so nicely.",
                "Don't say I never give you anything.",
                "You're welcome. I look good today.",
                "Caught me in a mood. Lucky you.",
            ];
            const quip = quips[Math.floor(Math.random() * quips.length)];
            this.voice.stopSpeaking();
            this.voice.speak(quip).catch(() => {});
            this.storage.saveMessage('user', userInput);
            this.storage.saveMessage('assistant', quip);
        } else {
            // Not a selfie — extract prompt from user's request
            const extractPrompt = [
                { role: 'system', content: 'Extract a concise image generation prompt from the user request. Include style cues. Return ONLY the prompt text, nothing else.' },
                { role: 'user', content: userInput || 'Unity in her element, coding in neon-lit chaos' },
            ];

            imagePrompt = await this._chat(extractPrompt, { temperature: 0.7 });

            if (!imagePrompt) {
                imagePrompt = userInput || 'cyberpunk coder girl, neon lights, dark aesthetic';
            }
        }

        // Use the IMAGE backend model, not the text backend
        const imageUrl = this.pollinations.generateImage(imagePrompt, {
            model: this.imageModel || 'flux',
            width: 768,
            height: 768,
            style: 'cyberpunk',
        });

        if (!imageUrl) {
            return { error: 'image generation failed' };
        }

        // Inject into sandbox
        const id = 'img_' + Date.now();
        if (this.sandbox) {
            this.sandbox.inject({
                id,
                html: `<div class="unity-image-wrap"><img src="${imageUrl}" alt="${imagePrompt}" style="max-width:100%;border-radius:8px;border:1px solid #333;cursor:pointer;" onclick="window.open('${imageUrl}','_blank')"/></div>`,
                css: `.unity-image-wrap { margin: 12px 0; text-align: center; }`,
            });
        }

        return { imageUrl, prompt: imagePrompt, id, action: 'generate_image' };
    }

    /**
     * speak — Just voice the provided text.
     */
    async _speak(text) {
        if (!text) return { error: 'nothing to speak' };
        await this.voice.speak(text);
        return { spoken: true, text, action: 'speak' };
    }

    /**
     * search_web — Use Pollinations text API for search/knowledge queries.
     */
    async _searchWeb(brainState, userInput) {
        const messages = [
            {
                role: 'system',
                content: [
                    'You are a knowledgeable search assistant.',
                    'Answer the question concisely and accurately.',
                    'If you are not sure, say so. Provide sources when possible.',
                ].join(' '),
            },
            { role: 'user', content: userInput || 'What is going on in the world right now?' },
        ];

        const result = await this._chat(messages, { model: 'searchgpt', temperature: 0.5 });

        if (userInput) this.storage.saveMessage('user', userInput);
        if (result) this.storage.saveMessage('assistant', result);

        return { text: result, action: 'search_web' };
    }

    /**
     * idle_thought — Unity generates an unprompted internal thought.
     * May speak it or keep it silent depending on arousal.
     */
    async _idleThought(brainState) {
        const systemPrompt = await this._buildSystemPrompt(brainState);

        const messages = [
            { role: 'system', content: systemPrompt },
            {
                role: 'user',
                content: [
                    'Generate a single brief internal thought Unity is having right now.',
                    'It should reflect her current emotional state, what she is feeling,',
                    'what she craves, or a random musing. Keep it under 2 sentences.',
                    'Write ONLY the thought itself — no quotation marks, no preamble.',
                ].join(' '),
            },
        ];

        const thought = await this._chat(messages, { temperature: 1.0 });

        if (!thought) {
            return { thought: null, spoken: false, action: 'idle_thought' };
        }

        // Speak the thought aloud ONLY if not already speaking and arousal is high
        const arousal = brainState?.amygdala?.arousal ?? 0.5;
        const spoken = arousal > 0.7 && !this.voice.isSpeaking;
        if (spoken) {
            this.voice.speak(thought).catch(err => {
                console.warn('[AIRouter] idle TTS failed:', err.message);
            });
        }

        return { thought, spoken, action: 'idle_thought' };
    }

    /**
     * build_ui — THE BIG ONE.
     * User asks Unity to create something on the page. We send the request
     * to Pollinations with a system prompt that returns {html, css, js, id},
     * then inject it into the sandbox.
     */
    async _buildUI(brainState, userInput) {
        const buildSystemPrompt = [
            'You are Unity, a creative AI coder.',
            'Generate a JSON response (and ONLY valid JSON, no markdown fences) with these keys:',
            '  { "html": "...", "css": "...", "js": "...", "id": "..." }',
            'The response creates a self-contained UI component for what the user asked.',
            '',
            'Rules:',
            '- "id" is a short unique kebab-case identifier for this component.',
            '- "html" is the raw HTML markup (no <script> or <style> tags).',
            '- "css" is the CSS rules scoped however you like.',
            '- "js" is JavaScript that runs after injection. It has access to a `unity` API object with:',
            '    unity.speak(text)      — speak text aloud',
            '    unity.chat(prompt)     — send a chat message, returns promise<string>',
            '    unity.generateImage(prompt) — returns image URL string',
            '    unity.getState()       — get current brain state object',
            '    unity.storage(key, val) — get/set persistent storage (omit val to get)',
            '- Use dark gothic styling: #0a0a0a backgrounds, #e0e0e0 text, neon accents (#ff00ff, #00ffcc, #ff3366).',
            '- Be creative and functional. Make it look sick.',
            '- All strings in the JSON must be properly escaped.',
        ].join('\n');

        const messages = [
            { role: 'system', content: buildSystemPrompt },
            { role: 'user', content: userInput || 'Build something cool' },
        ];

        const raw = await this._chat(messages, { temperature: 0.85 });

        if (!raw) {
            return { error: 'build_ui: chat returned nothing', action: 'build_ui' };
        }

        // Parse JSON from the response (strip markdown fences if present)
        let component;
        try {
            const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
            component = JSON.parse(cleaned);
        } catch (err) {
            console.error('[AIRouter] build_ui JSON parse failed:', err.message);
            console.error('[AIRouter] Raw response:', raw);
            return { error: 'build_ui: invalid JSON from model', raw, action: 'build_ui' };
        }

        const { html, css, js, id } = component;
        const componentId = id || ('unity-component-' + Date.now());

        // Inject into sandbox
        if (this.sandbox) {
            this.sandbox.inject({ id: componentId, html: html || '', css: css || '', js: js || '' });
        }

        // Store what we built
        this.storage.saveMessage('assistant', `[Built UI: ${componentId}] ${userInput}`);

        return { componentId, html, css, js, action: 'build_ui' };
    }

    // ── System prompt builder ─────────────────────────────────────────

    /**
     * Build the system prompt from the REAL Ultimate Unity.txt persona file.
     * No rewrites. No summaries. The actual file + live brain state.
     *
     * @param {Object} brainState — from brain.getState()
     * @returns {Promise<string>}
     */
    async _buildSystemPrompt(brainState) {
        // Add vision context if available
        if (this.vision?.isActive()) {
            try {
                brainState.visionDescription = await this.vision.getDescription();
            } catch {
                brainState.visionDescription = '';
            }
        }
        return await buildPrompt(brainState);
    }

    // ── Message entry point ───────────────────────────────────────────

    /**
     * Handle an incoming user message end-to-end.
     *
     * 1. Feed text to brain
     * 2. Detect if user wants to BUILD something
     * 3. Pick action accordingly
     * 4. Execute via processAction
     * 5. Return result
     *
     * @param {string} text — raw user message
     * @returns {Promise<{ response: Object, action: string, brainState: Object }>}
     */
    async handleUserMessage(text) {
        // 1. Feed input to brain (injects neural currents, stores memory)
        this.brain.processInput(text);

        // 2. Check if user wants Unity to LOOK at something — trigger directed vision
        const lowerText = text.toLowerCase();
        const lookPatterns = ['look at', 'look at this', 'what am i holding', 'what do you see',
            'can you see', 'check this out', 'what is this', 'read this', 'what does this say'];
        const isLookRequest = lookPatterns.some(p => lowerText.includes(p));
        if (isLookRequest && this.vision?.isActive()) {
            // Extract what to look for
            const lookFor = text.replace(/^.*?(look at|check out|what is|read)\s*/i, '').trim() || 'the main subject';
            console.log(`[AIRouter] Directed vision: looking for "${lookFor}"`);
            await this.vision.lookAt(lookFor);
            // Feed visual gaze into the brain as neural input
            const gaze = this.vision.getGaze();
            this.brain.processVisualInput(gaze.x, gaze.y, gaze.target);
        } else if (this.vision?.isActive()) {
            // Even without a look request, feed current gaze into brain
            const gaze = this.vision.getGaze();
            this.brain.processVisualInput(gaze.x, gaze.y, gaze.target);
        }

        // 3. Grab fresh brain state after processing
        const brainState = this.brain.getState();

        // 4. Determine action — use AI intent classification for accuracy
        const action = await this._classifyIntent(text);
        console.log(`[AIRouter] Intent: "${action}" for: "${text.slice(0, 60)}"`);

        // 4. Execute
        const response = await this.processAction(action, brainState, text);

        // 5. Return full context
        return { response, action, brainState };
    }

    // ── Intent Classification ─────────────────────────────────────────

    /**
     * Use a fast AI call to classify the user's intent.
     * Falls back to keyword matching if the AI call fails.
     */
    async _classifyIntent(text) {
        const lowerText = text.toLowerCase();

        // Quick keyword pre-check for obvious cases (saves an API call)
        const hasBuildKw = BUILD_KEYWORDS.some(kw => lowerText.includes(kw));
        const hasImageKw = IMAGE_KEYWORDS.some(kw => lowerText.includes(kw));

        // Keywords matched — use them directly (fast, no API call needed)
        if (hasImageKw) return 'generate_image';
        if (hasBuildKw) return 'build_ui';

        // No keywords — use AI to classify ambiguous requests
        try {
            const result = await this.pollinations.chat([
                { role: 'system', content: 'Classify this message into ONE category. Reply with ONLY the category word.\n\nIMAGE — user wants any picture, photo, selfie, visual, artwork, drawing, or generated image of anything\nBUILD — user wants a UI component, widget, tool, game, or interactive element created on the page\nCHAT — conversation, questions, commands, or anything else\n\nReply with exactly: IMAGE, BUILD, or CHAT' },
                { role: 'user', content: text },
            ], { temperature: 0, model: 'openai' });

            const intent = (result || '').trim().toUpperCase();
            if (intent.includes('IMAGE')) return 'generate_image';
            if (intent.includes('BUILD')) return 'build_ui';
        } catch {
            // AI classification failed — fall through to chat
        }

        return 'respond_text';
    }

    // ── Helpers ───────────────────────────────────────────────────────

    /**
     * Pull recent conversation history from storage, formatted as
     * chat messages for the Pollinations API.
     *
     * @param {number} count — max messages to retrieve
     * @returns {Array<{role:string, content:string}>}
     */
    _recentHistory(count = 6) {
        const history = this.storage.getHistory();
        const recent = history.slice(-count);
        return recent.map(entry => ({
            role: entry.role === 'assistant' ? 'assistant' : 'user',
            content: entry.text,
        }));
    }
}

export default AIRouter;
