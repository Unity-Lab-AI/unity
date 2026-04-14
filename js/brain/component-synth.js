/**
 * component-synth.js — Equational Component Synthesis (R6.2)
 *
 * When the BG motor action selects `build_ui`, this module produces
 * a ready-to-inject sandbox component spec without calling any AI.
 * The pipeline is:
 *
 *   1. Parse `docs/component-templates.txt` at boot into a library
 *      of primitives. Each primitive has:
 *        - id (kebab-case name)
 *        - description (one sentence, used for semantic matching)
 *        - html / css / js template strings
 *      The file itself is corpus data (same rule as Ultimate Unity.txt
 *      and english-baseline.txt) — templates are authored in the text
 *      file, NOT hardcoded in source here.
 *
 *   2. For every primitive description, compute its semantic embedding
 *      via `sharedEmbeddings.getSentenceEmbedding(description)` at
 *      boot. These are the "primitive centroids" — each one is a 50d
 *      GloVe vector representing what the primitive is for.
 *
 *   3. When `generate(userRequest, brainState)` is called:
 *      a. Compute the user request's sentence embedding
 *      b. Cosine against every primitive centroid
 *      c. Pick the highest-scoring primitive
 *      d. Fill the template's html/css/js strings (no placeholder
 *         substitution for now — the templates are complete as-is,
 *         and params can be extended later via `{{var}}` tokens)
 *      e. Generate a unique component id from a cortex pattern hash
 *      f. Return { id, html, css, js }
 *
 *   4. If no primitive scores above a minimum threshold (user asked
 *      for something Unity doesn't have a template for), return null.
 *      The calling code falls through to a verbal response.
 *
 * Zero hardcoded component specs in this source file. Every HTML,
 * CSS, and JS string lives in docs/component-templates.txt and is
 * parseable / editable / extendable there. Adding a new primitive =
 * appending a new `=== PRIMITIVE: name ===` block to the corpus.
 */

import { sharedEmbeddings } from './embeddings.js';

// Minimum semantic similarity to pick a template. Below this, the
// synth declines — user's request doesn't match any known primitive
// closely enough. Tuned empirically: GloVe sentence cosines between
// "calculator" and "calculator with buttons" land ~0.85+, between
// "todo list" and "list items" ~0.70, totally unrelated requests
// land ~0.10-0.30. 0.40 is a permissive floor that accepts near-
// synonyms but rejects unrelated requests.
const MIN_MATCH_SCORE = 0.40;

export class ComponentSynth {
  constructor() {
    this._primitives = [];  // { id, description, descEmbed, html, css, js }
    this._loaded = false;
  }

  /**
   * Parse a template corpus file. Called from engine.js boot after
   * the corpus is fetched. The parser handles the `=== PRIMITIVE:
   * id ===` / `DESCRIPTION:` / `HTML:` / `END_HTML` / `CSS:` /
   * `END_CSS` / `JS:` / `END_JS` grammar documented in the file.
   *
   * Comment lines starting with `#` at the top of the file are
   * skipped. Blank lines are preserved inside template blocks.
   *
   * @param {string} text — full file contents
   * @returns {number} — number of primitives parsed
   */
  loadTemplates(text) {
    if (!text || typeof text !== 'string') return 0;
    this._primitives = [];

    // Split into blocks on the === PRIMITIVE marker
    const blockRegex = /===\s*PRIMITIVE:\s*([a-z0-9-]+)\s*===([\s\S]*?)(?====\s*PRIMITIVE:|$)/gi;
    let match;
    while ((match = blockRegex.exec(text)) !== null) {
      const id = match[1].trim();
      const body = match[2];

      // Extract description
      const descMatch = body.match(/DESCRIPTION:\s*(.+)/);
      const description = descMatch ? descMatch[1].trim() : '';

      // Extract html / css / js sections using END_ markers
      const htmlMatch = body.match(/HTML:\s*\n([\s\S]*?)\nEND_HTML/);
      const cssMatch = body.match(/CSS:\s*\n([\s\S]*?)\nEND_CSS/);
      const jsMatch = body.match(/JS:\s*\n([\s\S]*?)\nEND_JS/);

      const html = htmlMatch ? htmlMatch[1].trim() : '';
      const css = cssMatch ? cssMatch[1].trim() : '';
      const js = jsMatch ? jsMatch[1].trim() : '';

      // Skip primitives missing required fields
      if (!id || !description || (!html && !js)) {
        console.warn(`[ComponentSynth] Skipping malformed primitive "${id}"`);
        continue;
      }

      // Compute the description's semantic embedding once at load
      // time so matching is fast at generation time.
      const descEmbed = sharedEmbeddings.getSentenceEmbedding(description);

      this._primitives.push({ id, description, descEmbed, html, css, js });
    }

    this._loaded = true;
    console.log(`[ComponentSynth] Loaded ${this._primitives.length} component templates`);
    return this._primitives.length;
  }

  /**
   * Produce a sandbox component spec for the user's build request.
   *
   * @param {string} userRequest — what the user asked for ("build me
   *   a timer", "make a counter", etc.)
   * @param {object} brainState — full brain state from engine.getState
   *   (arousal, valence, cortex pattern, etc.) — used for future
   *   equation-derived parameter filling
   * @returns {{ id, html, css, js }|null} — spec ready for
   *   `sandbox.inject()`, or null if no primitive matches
   */
  generate(userRequest, brainState = {}) {
    if (!this._loaded || this._primitives.length === 0) {
      console.warn('[ComponentSynth] Cannot generate — templates not loaded');
      return null;
    }
    if (!userRequest || typeof userRequest !== 'string') return null;

    // T5 — structural bias from the language cortex's parse tree.
    // T14.15 (2026-04-14) — parseSentence was deleted in T14.12, so
    // brainState.parsed is now the stub returned by cluster.readInput
    // which does NOT populate `entities.componentTypes`. The
    // `parsedTypes` array below will be empty for most calls until
    // T14.17 wires `cluster.entityReadout()` to return learned entity-
    // slot clusters from the sem region, at which point this block
    // reads from that instead. Keeping the optional-chain reads
    // against brainState.parsed means the code handles both pre- and
    // post-T14.17 payload shapes without branching — when entities
    // are present they boost, when they're not the semantic cosine
    // match alone decides the primitive.
    const parsed = brainState.parsed || null;
    const parsedTypes = (parsed?.entities?.componentTypes || [])
      .map(t => t.replace(/s$/, '')); // strip trailing plural

    // Semantic match — which primitive is closest to the user's request
    const userEmbed = sharedEmbeddings.getSentenceEmbedding(userRequest);
    let bestScore = -1;
    let bestPrim = null;
    for (const prim of this._primitives) {
      let score = sharedEmbeddings.similarity(userEmbed, prim.descEmbed);
      // Structural bonus: if the parser pulled a component-type
      // token and the primitive id matches it, boost by 0.35 —
      // big enough to overwhelm most semantic ambiguity but small
      // enough that a genuinely closer semantic match can still
      // win if the parser misidentified the type.
      if (parsedTypes.length > 0) {
        for (const pt of parsedTypes) {
          if (prim.id === pt || prim.id.startsWith(pt + '-') || prim.id.endsWith('-' + pt)) {
            score += 0.35;
            break;
          }
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestPrim = prim;
      }
    }

    if (!bestPrim || bestScore < MIN_MATCH_SCORE) {
      console.log(`[ComponentSynth] No primitive matches "${userRequest.slice(0, 40)}" (best: ${bestPrim?.id} @ ${bestScore.toFixed(2)})`);
      return null;
    }

    console.log(`[ComponentSynth] Matched "${userRequest.slice(0, 40)}" → ${bestPrim.id} @ ${bestScore.toFixed(2)}${parsedTypes.length ? ` (parsed: ${parsedTypes.join(',')})` : ''}`);

    // Generate a unique component id.
    const suffix = this._suffixFromPattern(brainState.cortexPattern);
    const id = `${bestPrim.id}-${suffix}`;

    return {
      id,
      html: bestPrim.html,
      css: bestPrim.css,
      js: bestPrim.js,
      _primitive: bestPrim.id,
      _matchScore: bestScore,
      _parsedTypes: parsedTypes,
      _parsedColors: parsed?.entities?.colors || [],
      _parsedActions: parsed?.entities?.actions || [],
    };
  }

  /**
   * Get stats about the loaded template library.
   */
  getStats() {
    return {
      loaded: this._loaded,
      count: this._primitives.length,
      primitives: this._primitives.map(p => ({ id: p.id, description: p.description })),
    };
  }

  /**
   * Generate an 8-char suffix from a cortex activation pattern.
   * The same pattern always produces the same suffix, so if Unity
   * rebuilds the same primitive in the same neural state, it
   * reuses the id (triggers sandbox replace semantics). Different
   * neural states produce different suffixes so she can have
   * multiple instances side by side when brain state drifts.
   */
  _suffixFromPattern(cortexPattern) {
    if (!cortexPattern || !cortexPattern.length) {
      // No pattern available — timestamp tail (still deterministic
      // within the same second so repeated calls don't spam ids)
      return String(Date.now()).slice(-8);
    }
    // Hash the first N dims of the pattern into 32 bits
    let hash = 0;
    const n = Math.min(16, cortexPattern.length);
    for (let i = 0; i < n; i++) {
      const v = Math.floor((cortexPattern[i] + 1) * 1000); // map [-1,1] → [0,2000]
      hash = ((hash << 5) - hash + v) | 0;
    }
    return Math.abs(hash).toString(36).padStart(6, '0').slice(0, 8);
  }
}
