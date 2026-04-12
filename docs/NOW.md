# NOW — Session Snapshot

> Saved: 2026-04-12 (end of session)
> Branch: `server-brain` (synced with `main` at `a57e764`)
> Next session: hard-refresh browser, run `start.bat`, test conversation path

---

## Where we are

Both `main` and `server-brain` sit at **`a57e764`**. Clean tree. Only untracked
noise is `.claude/.claude/`.

## This session landed 7 commits

| Hash | Area | Fix |
|------|------|-----|
| `5407960` | Pages / RemoteBrain | `detectRemoteBrain` hostname-gated — Pages no longer shows dev box's 1.8B-neuron count; stops every visitor from poking their own localhost |
| `66c7be3` | Language cortex | Grammar overhaul — phrase-structure Markov `nextSlotRequirement`, `_isNominativePronoun` equation, `_subjectStarters`, CVC verb signal weakened, strict typeFloor on every slot, verb-verb same-type penalty 0.65, copula agreement via learned bigrams. Killed the `Me son darkness ill commands' empathy!` word salad. |
| `0a891a7` | Language cortex | Pronoun flip on replies (`i↔you, we→you`) + sentence-level dedup (`_recentSentences` ring buffer, retry at 3× temperature). Killed `You are today.` parrot. |
| `9b112e9` | App boot | `loadPersonaSelfImage` no longer uses a global cached promise — new brain instances now get the persona text loaded (Memory tab was showing `✗ not loaded` with all zeros after clicking Talk to Unity). |
| `e5e5cde` | Chat UI | Filter `action: 'idle_thought'` out of chat display, replace broken `<img>` `onerror alt='Loading...'` with proper `display:none` + `(image generation failed)` text. |
| `c2fb02a` | Chat UI | Removed duplicate `_appendMessage` call in `chat-panel._send().then()` — brain's `'response'` event is now single source of truth for assistant rendering. |
| `a57e764` | App boot | `bootUnity` now stores `brain.__appResponseHandler` / `brain.__appImageHandler` and calls `brain.off()` before re-attaching on every re-run. Settings → Apply Changes used to add another listener to the same brain each click, producing 2x / 3x duplicates. |

## What to test next session

Hard-refresh browser (Ctrl+Shift+R), then walk through:

1. **Pages deploy check** — visit `https://*.github.io/...` URL. Landing stats should read `1,000 neurons`, NOT 1.8B.
2. **Persona loads on Talk to Unity click** — Memory tab should show:
   - `Persona Loaded ✓ Ultimate Unity.txt`
   - `Sentences Learned: 325`
   - `Words in Dictionary: 1,657`
   - `Total Bigrams: ~13,914`
3. **Conversation** — ask `what are you doing today?`. Expected:
   - Exactly ONE Unity response per user message (not 2+)
   - Subject is NOT `you` (pronoun flip → `i`/`she`/`they`/action form)
   - No exact-sentence repeats within the same 5-message window
   - No `Loading...` placeholder leaking into chat
   - Grammar: subject slot clean, subject-verb agreement via learned bigrams (`I am`, `She is`, `We are`)
4. **Tail drift (known residual)** — sentences past slot 2 still have semantic drift (`"You understanding of the moment as!"`). Grammar is structurally sound but semantic coherence is inherently limited by equation-only language without deeper layers. Not a blocker, iterate later.

## Known residuals (not blockers)

- **Tail semantic drift past slot 2.** Phrase structure is correct; word choice isn't. Gerunds (`-ing` words) are still verb-dominant by suffix equation even when they function as nouns (`understanding of the moment`). Deeper fix would require gerund disambiguation + clause-level semantic gating.
- **Persona file slurs** (`wop`, `yid`, `dago`, `injun`, `dothead`, etc.) are in `docs/Ultimate Unity.txt` and get learned as dictionary words. Grammar filter passes them because they're structurally nouns/adj. Cleanup is content-side (persona file edit), not code-side.
- **No server-side equation fallback** — `server/brain-server.js:907` has `// TODO: implement server-side dictionary`. When Pollinations fails, server returns `'...'`. Non-blocking; only affects graceful degradation.
- **`app.bundle.js` is gitignored** — `start.bat` rebuilds via esbuild on launch. File:// mode uses the bundle, http://localhost mode loads `js/app.js` ES modules directly. My fixes target the ES module path.

## Git state

```
main          a57e764
server-brain  a57e764
origin/main   a57e764
origin/server-brain  a57e764
```

All four refs in sync. Safe to shut down.

## Files touched this session

- `js/brain/remote-brain.js` — hostname gate on detectRemoteBrain
- `js/brain/language-cortex.js` — grammar overhaul + pronoun flip + dedup (~460 line changes)
- `js/app.js` — persona loader WeakSet + dual-handler dedup + idle_thought filter
- `js/ui/chat-panel.js` — removed duplicate `_appendMessage`
- `js/app.bundle.js` — mirror edit to match source for file:// dev path (gitignored)
- `docs/FINALIZED.md` — three archive entries appended (Pages fix, language overhaul, parroting fix)
- `docs/NOW.md` — this file

## Pick-up instructions for next session

1. `cd C:\Users\gfour\Desktop\Dream`
2. `git status` — should be clean on `server-brain` at `a57e764`
3. `git pull origin server-brain` if dev box is behind
4. `start.bat` to launch brain-server + compute page + browser
5. Hard-refresh the browser tab (Ctrl+Shift+R)
6. Walk through the test checklist above
