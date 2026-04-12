/**
 * PollinationsAI — Browser-side Pollinations API client.
 *
 * Endpoints (current — NOT the deprecated text.pollinations.ai):
 *   Text:  https://gen.pollinations.ai/v1/chat/completions
 *   Image: https://gen.pollinations.ai/image/{prompt}
 *   Audio: https://gen.pollinations.ai/v1/audio/speech
 *   Auth:  https://enter.pollinations.ai/authorize
 *
 * No external dependencies. Uses fetch() only.
 * Works without an API key (free tier); BYOP key unlocks higher limits.
 */

const GEN_URL = 'https://gen.pollinations.ai';
const IMAGE_URL = 'https://image.pollinations.ai';

export class PollinationsAI {

    constructor(apiKey = null) {
        this._apiKey = apiKey;
    }

    // ── Utility ────────────────────────────────────────────────────────

    setApiKey(key) {
        this._apiKey = key;
    }

    hasApiKey() {
        return Boolean(this._apiKey);
    }

    _headers() {
        const h = { 'Content-Type': 'application/json' };
        if (this._apiKey) {
            h['Authorization'] = `Bearer ${this._apiKey}`;
        }
        return h;
    }

    // ── Text Generation ────────────────────────────────────────────────

    /**
     * Chat with a text model.
     * @param {Array<{role:string, content:string}>} messages
     * @param {Object} [options]
     * @param {string} [options.model='openai']
     * @param {number} [options.temperature=0.9]
     * @returns {Promise<string|null>} response text or null on failure
     */
    async chat(messages, options = {}) {
        const model = options.model || 'openai';
        const temperature = options.temperature ?? 0.9;
        const body = JSON.stringify({ messages, model, temperature });
        const headers = this._headers();

        // Primary: gen.pollinations.ai/v1/chat/completions (OpenAI-compatible)
        try {
            console.log('[PollinationsAI] Sending chat request...');
            const res = await fetch(`${GEN_URL}/v1/chat/completions`, {
                method: 'POST',
                headers,
                body,
                signal: AbortSignal.timeout(30000),
            });
            if (res.ok) {
                const json = await res.json();
                if (json.choices?.[0]?.message?.content) {
                    console.log('[PollinationsAI] Response received:', json.choices[0].message.content.slice(0, 50) + '...');
                    return json.choices[0].message.content;
                }
            } else {
                console.warn('[PollinationsAI] v1/chat/completions returned', res.status);
            }
        } catch (err) {
            console.error('[PollinationsAI] v1/chat/completions failed:', err.message);
        }

        // Fallback: GET gen.pollinations.ai/{prompt} with model param
        try {
            const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
            if (lastUserMsg) {
                const prompt = encodeURIComponent(lastUserMsg.content);
                const url = `${GEN_URL}/${prompt}?model=${encodeURIComponent(model)}`;
                const res = await fetch(url);
                if (res.ok) {
                    return await res.text();
                }
            }
        } catch (err) {
            console.error('[PollinationsAI] GET fallback failed:', err.message);
        }

        console.error('[PollinationsAI] All chat endpoints failed.');
        return null;
    }

    // ── Image Generation ───────────────────────────────────────────────

    /** Style presets that get appended to the prompt. */
    static STYLE_PRESETS = {
        photorealistic: ', photorealistic, ultra detailed, 8k',
        anime: ', anime style, vibrant colors, detailed',
        'oil-painting': ', oil painting style, textured brush strokes',
        'pixel-art': ', pixel art style, retro 8-bit',
        watercolor: ', watercolor painting, soft washes, delicate',
        cinematic: ', cinematic lighting, dramatic composition, film grain',
        sketch: ', pencil sketch, hand-drawn, detailed linework',
        cyberpunk: ', cyberpunk aesthetic, neon lights, futuristic cityscape'
    };

    /**
     * Generate an image URL.
     * @param {string} prompt
     * @param {Object} [options]
     * @param {string} [options.model='flux']
     * @param {number} [options.width=512]
     * @param {number} [options.height=512]
     * @param {string} [options.style] - one of STYLE_PRESETS keys
     * @returns {string|null} image URL or null on failure
     */
    generateImage(prompt, options = {}) {
        try {
            const model = options.model || 'flux';
            const width = options.width || 512;
            const height = options.height || 512;

            let finalPrompt = prompt;
            if (options.style && PollinationsAI.STYLE_PRESETS[options.style]) {
                finalPrompt += PollinationsAI.STYLE_PRESETS[options.style];
            }

            const encoded = encodeURIComponent(finalPrompt);
            let url = `${IMAGE_URL}/prompt/${encoded}?model=${encodeURIComponent(model)}&width=${width}&height=${height}&nologo=true`;
            if (this._apiKey) {
                url += `&token=${encodeURIComponent(this._apiKey)}`;
            }
            return url;
        } catch (err) {
            console.error('[PollinationsAI] generateImage failed:', err.message);
            return null;
        }
    }

    // ── Text-to-Speech ─────────────────────────────────────────────────

    /**
     * Convert text to speech.
     * @param {string} text
     * @param {string} [voice='nova']
     * @returns {Promise<Blob|null>} audio Blob or null on failure
     */
    async speak(text, voice = 'nova') {
        try {
            const res = await fetch(`${GEN_URL}/v1/audio/speech`, {
                method: 'POST',
                headers: this._headers(),
                body: JSON.stringify({
                    model: 'openai-audio',
                    input: text,
                    voice
                })
            });
            if (!res.ok) {
                console.error('[PollinationsAI] speak failed:', res.status, res.statusText);
                return null;
            }
            return await res.blob();
        } catch (err) {
            console.error('[PollinationsAI] speak failed:', err.message);
            return null;
        }
    }

    // ── Models ─────────────────────────────────────────────────────────

    /**
     * List available text models.
     * @returns {Promise<Array|null>}
     */
    async listModels() {
        try {
            const res = await fetch(`${GEN_URL}/v1/models`);
            if (!res.ok) {
                console.error('[PollinationsAI] listModels failed:', res.status);
                return null;
            }
            return await res.json();
        } catch (err) {
            console.error('[PollinationsAI] listModels failed:', err.message);
            return null;
        }
    }
}
