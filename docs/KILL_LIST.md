# KILL_LIST — Hardcoded / Scripted / AI-Bypass Paths

> **Audit date:** 2026-04-13 (R1.1 of brain-refactor-full-control)
> **Scope:** Every place Unity's behavior is NOT driven by brain state equations. The refactor replaces, removes, or moves each item below.

**Classification legend:**
- **DELETE** — straight removal, no replacement needed
- **DELETE-AI** — text-AI backend call, kill per R4
- **REPLACE-SEMANTIC** — letter/keyword shortcut that should become semantic embedding lookup (R2)
- **REPLACE-EQUATIONAL** — hardcoded value that should come from brain state equation
- **MOVE-CORPUS** — inlined data that should be parsed from `docs/` corpus files at boot
- **KEEP-SAFETY** — hard-reject / destructive operation guard, not a behavior shortcut

---

## 1. Text-AI Backend Calls (DELETE-AI, R4)

### 1.1 — `js/ai/pollinations.js`
| Line | Code | Action |
|------|------|--------|
| 5 | `Text:  https://gen.pollinations.ai/v1/chat/completions` | Remove header comment |
| 51-60 | `async chat(messages, options = {})` | Delete entire method |
| 58-90 | Full OpenAI-compatible chat fetch path | Delete |
| — | Any `options.model = 'openai'` default | Delete |

Keep: `generateImage`, vision describer (used by `visual-cortex.js`), TTS (`speak`).

### 1.2 — `js/brain/peripherals/ai-providers.js` (129 lines)
| Line | Code | Action |
|------|------|--------|
| 11 | `export class AIProviders` | Rename `SensoryAIProviders` |
| 119 | `errText.includes('credit')` — retry on payment failure | Delete (part of chat path) |
| — | `async chat(messages, opts)` | Delete entire method |
| — | Anthropic / OpenAI / OpenRouter / Mistral / DeepSeek / Groq / claude-proxy provider entries | Delete — keep only Pollinations (image + vision + TTS) |

### 1.3 — `js/brain/language.js` BrocasArea (333 lines)
| Line | Code | Action |
|------|------|--------|
| 18 | `export class BrocasArea` | Shrink to ~50 lines or delete |
| 70 | `const isBuildMode = motor === 'build_ui' \|\| (userInput && userInput.includes('[MOTOR OUTPUT:`...)'`| DELETE — hardcoded string-match for motor output flag |
| 91 | `!userInput.startsWith('[SYSTEM')` | DELETE — prompt-flag string match |
| — | `_buildPrompt(state)` method (~80 lines) | DELETE — AI prompt builder |
| — | `_buildBuildPrompt(state, userInput)` method (~75 lines) | DELETE — build-mode AI prompt |
| — | `_getSelfImageDesc()` | DELETE — prompt header helper |
| — | `_clusterSummary(clusters)` | DELETE — unused after prompt builders go |
| — | `generate(brainState, userInput)` | Either delete entirely OR rename `generateImageQuip` if selfie quips stay AI |
| — | `_providers.chat(messages, opts)` inside `generate` | DELETE — the actual text-AI call |
| — | `_getHistory(count)` | KEEP if hippocampus storage needs it (verify via grep) |

### 1.4 — `server/brain-server.js` (1559 lines)
| Line | Code | Action |
|------|------|--------|
| ~867-904 | `fetch('https://gen.pollinations.ai/v1/chat/completions', ...)` in `_generateBrainResponse` | DELETE — replaced by equational generation (R3.5) |
| 906 | `// TODO: implement server-side dictionary` → `return { text: '...', action: 'respond_text' }` stub | REPLACE-EQUATIONAL — call server `languageCortex.generate` |

### 1.5 — `claude-proxy.js` (top-level file)
| Line | Code | Action |
|------|------|--------|
| 6 | `Proxies /v1/chat/completions to `claude -p`` | DELETE entire file — was a dev convenience for Claude CLI text routing, obsolete after R4 |
| 56 | `req.url === '/v1/chat/completions'` route handler | Delete with file |
| 90-93 | `object: 'chat.completion'` OpenAI-compat response shape | Delete with file |

### 1.6 — `js/app.js` — BrocasArea consumers
| Line | Code | Action |
|------|------|--------|
| 11 | `import { BrocasArea } from './brain/language.js'` | DELETE (or trim to `generateImageQuip` import) |
| 35 | `let brain, pollinations, providers, brocasArea, voice, storage, sandbox` | Remove `brocasArea` from decls |
| 922 | `brocasArea = new BrocasArea({ providers, storage, persona: UNITY_PERSONA })` | DELETE |
| 1013 | `brain.connectLanguage(brocasArea)` | DELETE |
| 1072 | `const prompt = brocasArea._buildPrompt(state)` — used by `/think` command | REPLACE: `/think` should show brain state dump, not AI prompt |
| 1273 | `chat: (text) => { brain.receiveSensoryInput('text', text); return brocasArea.generate(brain.getState(), text) }` (sandbox unity API) | REPLACE-EQUATIONAL: route through `brain.processAndRespond` instead |
| 1352 | `if (brocasArea) { ... }` gate | DELETE once brocasArea removed |
| 1373 | `const text = await brocasArea.generate(state, prompt)` — greeting path | REPLACE: route through `brain.processAndRespond` with greeting flag |

### 1.7 — `js/brain/engine.js` — BrocasArea consumers
| Line | Code | Action |
|------|------|--------|
| 614 | `connectLanguage(brocasArea)` method | DELETE or shrink to a no-op stub |
| 615 | `this._brocasArea = brocasArea` | DELETE |
| 641 | `if (this._brocasArea) this._brocasArea.abort()` | DELETE |
| 712 | `if (effectiveAction === 'build_ui' && this._brocasArea && this._sandbox)` | REPLACE: use component synthesis (R6.2) |
| 887 | `let raw = await this._brocasArea.generate(this.getState(), buildInput)` — build-mode AI call | REPLACE-EQUATIONAL: call `componentSynth.generate(userRequest, brainState)` (R6.5) |

---

## 2. Hardcoded Word / Bigram Seeds (REPLACE-SEMANTIC or DELETE)

### 2.1 — `js/brain/dictionary.js:52-140` — `_seed()` method
**Status: orphan dead code** — the constructor at line 49 comments `// No seed — brain learns every word from conversation, same as a human` and grep confirms `_seed` is never called anywhere. It's a giant hardcoded word list + bigram network that survived from pre-equational refactor era.

```js
// Lines 54-87 — hardcoded word seed list
const seeds = [
  ['yeah', 0.9, 0.6], ['fuck', 0.95, 0.1], ['hell', 0.8, -0.1], ['damn', 0.85, -0.2],
  ['shit', 0.8, -0.3], ['babe', 0.7, 0.7], ['love', 0.6, 0.8], ...
];

// Lines 93-135 — hardcoded bigram network
const flows = [
  ['hey', 'what'], ['hey', 'you'], ['what', 'the'], ...
  ['i\'m', 'here'], ['i\'m', 'high'], ['i\'m', 'thinking'], ...
  ['gonna', 'feel'], ['gonna', 'make'], ['gonna', 'build'], ...
];
```

**Action: DELETE the entire `_seed()` method.** Move its contents to `docs/Ultimate Unity.txt` as natural prose sentences if any of them aren't already covered, so the corpus loader picks them up equationally. Zero hardcoded word lists in source after this.

---

## 3. Hardcoded String Matches in Engine / Language Flow

### 3.1 — `js/brain/engine.js:826` — code detection via keyword check
```js
} else if (code.includes('document.') || code.includes('function ') || code.includes('const ') || code.includes('<div')) {
```
Detects "is this raw code" by checking for specific JS/HTML tokens.

**Action: REPLACE-EQUATIONAL** — use coding-corpus-trained type classification. The coding-knowledge.txt corpus already has vocabulary for these — any token with high `VERB_BARE` + technical-suffix type signature should classify as code without a literal substring check.

Alternative: MOVE-CORPUS — store the set of "code signal tokens" in `docs/coding-knowledge.txt` under a CODE_MARKERS section parsed at boot.

### 3.2 — `js/brain/engine.js` image-request detection
Around the `_handleImage` routing, there's a check for explicit image-request words ("show me", "picture", "selfie", "image", "photo", "draw"). From `docs/FINALIZED.md:538`:
> Image intercept gate — `engine.js` no longer routes to `_handleImage()` just because BG motor picked `generate_image`. Requires explicit image-request words in the input (show me/picture/selfie/image/photo/draw). `includesSelf` detected from text, not hardcoded.

**Action: REPLACE-SEMANTIC** — instead of checking for those literal words, compute semantic similarity between user input embedding and a learned "image-request" semantic centroid (derived from persona sentences about showing/drawing/taking pictures). Any input whose embedding is close to that centroid routes to `generate_image` regardless of exact word choice.

---

## 4. Hardcoded Fallback Strings (REPLACE-EQUATIONAL)

### 4.1 — `js/brain/engine.js:797`
```js
if (!response || response.length < 2) response = '...';
```
When equational generation produces an empty string, falls back to `'...'`.

**Action: REPLACE-EQUATIONAL** — if the language cortex returns empty, trigger a retry at higher temperature + broader candidate pool. If still empty, emit nothing (motor output becomes `idle` instead of `respond_text` with a placeholder). Never emit a canned `'...'` as if it were a response.

### 4.2 — `server/brain-server.js:908` `_generateBrainResponse` fallback
```js
return { text: '...', action: 'respond_text' };
```
Same pattern server-side. Same fix — covered by R3.5.

### 4.3 — Build path fallback quips in `engine.js:824` / `engine.js:843`
```js
const quip = response.replace(/```[\s\S]*```/g, '').trim() || `Built "${id}".`;
// ...
const quip = response.replace(/```[\s\S]*```/g, '').trim() || `Built it.`;
```
Hardcoded fallback text when the brain's quip extraction returns empty.

**Action: REPLACE-EQUATIONAL** — build-mode should ALSO generate a quip via language cortex with a short target length, not fall back to literal `'Built it.'`. Could be a 3-5 word emo-goth-chick reaction sampled from the slot scorer with recall bias toward "build completion" context.

---

## 5. Prompt-Flag String Matches (DELETE with R4)

### 5.1 — `js/brain/language.js:70`
```js
const isBuildMode = motor === 'build_ui' || (userInput && userInput.includes('[MOTOR OUTPUT: basal ganglia selected BUILD_UI'));
```
String-matches an internal motor-output marker. This was a debug hack that leaked into production logic.

**Action: DELETE** — `motor.selectedAction === 'build_ui'` is sufficient. The `userInput.includes('[MOTOR OUTPUT:')` check is a code smell. Dies with BrocasArea rewrite (R4.1).

### 5.2 — `js/brain/language.js:91`
```js
if (userInput && !userInput.startsWith('[SYSTEM')) {
  this._storage.saveMessage('user', userInput);
}
```
String-matches `[SYSTEM` prefix to avoid storing system prompts as user messages.

**Action: DELETE** — with R4 the system-prompt path doesn't exist. No prompts flow through Unity; every input is a real user message.

---

## 6. Hardcoded Magic Numbers That Should Come From Equations

### 6.1 — `js/brain/cluster.js` — fixed cluster sizes in client
```js
// engine.js:53-61
const CLUSTER_SIZES = {
  cortex: 300, hippocampus: 200, amygdala: 150,
  basalGanglia: 150, cerebellum: 100, hypothalamus: 50, mystery: 50,
};
```
Client fallback brain sizes are hardcoded. Server auto-scales, client doesn't.

**Action: REPLACE-EQUATIONAL (low priority)** — client brain should scale to available memory / CPU budget too. For the refactor: keep as defaults but read from a detected-resources function similar to server.

### 6.2 — `js/brain/motor.js:24-26` — BG channel layout
```js
const BG_SIZE = 150;
const CHANNELS = 6;
const NEURONS_PER_CHANNEL = 25;
```
Hardcoded channel topology. Fine for now, but if the client brain rescales (R6.1), these need to scale too.

**Action: REPLACE-EQUATIONAL (low priority)** — compute from `brain.clusters.basalGanglia.size / CHANNELS`. Keep CHANNELS fixed (it's the number of actions = 6).

### 6.3 — `js/brain/motor.js:38` — confidence threshold (RECENTLY TUNED)
```js
const CONFIDENCE_THRESHOLD = 0.05;  // was 0.15 before commit 6bf1b4e
```
**Action: KEEP as-is** — this is a tuned equation output, not a semantic shortcut. Documented in `6bf1b4e` commit rationale.

### 6.4 — `js/brain/motor.js:41` — action cooldown
```js
const ACTION_COOLDOWN = 50;
```
**Action: REPLACE-EQUATIONAL (low priority)** — should derive from hypothalamus social_need / arousal state. High arousal + high social need → short cooldown (rapid-fire). Low → long cooldown (relaxed). For the refactor: leave as default, add equation in a follow-up.

### 6.5 — `js/brain/engine.js:49` — Kuramoto coupling base (RECENTLY TUNED)
```js
const COUPLING_BASE = 2.5;  // was 0.5 before commit 6bf1b4e
```
**Action: KEEP as-is** — tuned for ~30-40% resting coherence.

---

## 7. Safety / Structural Guards (KEEP-SAFETY)

These are NOT behavior shortcuts — they're destructive-action guards and input sanitization that exist for code safety, not cognition.

- `js/ui/sandbox.js` — `MAX_ACTIVE_COMPONENTS = 10` LRU soft cap. KEEP.
- `js/ui/sandbox.js` — tracked `setInterval`/`setTimeout`/`addListener` for cleanup on `remove(id)`. KEEP.
- `js/ui/sandbox.js` — auto-remove on JS error via `setTimeout(() => remove(id), 0)`. KEEP.
- `js/brain/dictionary.js:154` — `clean = word.toLowerCase().replace(/[^a-z0-9'-]/g, '')`. Input sanitization, KEEP.
- `js/brain/language-cortex.js` corpus loaders — comma-density filter (rejects word-list "sentences"). Shape-based filter, not content-based. KEEP.
- `js/brain/language-cortex.js` corpus loaders — `doInflections=false` (kills synthetic morphology pollution). KEEP.
- `js/brain/remote-brain.js:298-307` — hostname gate (only probe localhost for server brain on local origins, not from GitHub Pages). KEEP, security.

---

## 8. Summary Counts

| Classification | Count | Lines to touch |
|----------------|-------|----------------|
| DELETE-AI (text-AI backends) | 15+ call sites | ~600 lines across 7 files |
| DELETE (orphan / dead) | 3 (dictionary `_seed`, BrocasArea prompt builders, claude-proxy.js) | ~300 lines |
| REPLACE-SEMANTIC (keyword checks → embedding similarity) | 2 (image request detection, code detection) | ~10 lines |
| REPLACE-EQUATIONAL (canned fallback → brain-driven) | 4 (`'...'` stubs, build quip fallbacks) | ~8 lines |
| MOVE-CORPUS (inlined data → parsed from docs/) | 1 (dictionary._seed) | ~90 lines |
| KEEP-SAFETY | 7 items | — |

**Total estimated diff:** ~900 lines to delete, ~100 lines to replace.

---

*Unity AI Lab — no scripts, no word lists, no bullshit. Every response a real equation.*
