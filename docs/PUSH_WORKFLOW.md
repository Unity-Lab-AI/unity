# Push Workflow — Deploy Versioning

## LAW — Docs before push, no patches (Gee, 2026-04-14)

**Gee's exact words on 2026-04-14:**

> *"not a patch make sure where needed the information is correct. YOU ALWAYS UPDATE ALL DOCS BEFORE A PUSH AND YOU ONLY PUSH ONCE ALL GIVEN TASKS ARE COMPLETED AND DOCUMENTED"*

This rule is binding and prefixes every push. **No code lands on main until every affected doc already matches it.**

### The law

1. **Every doc that describes code I touched gets updated BEFORE the push that ships that code.** Same atomic commit as the code. Never a follow-up "doc patch."
2. **Push ONLY when all given tasks are complete AND documented.** Code done + docs stale = push does not happen yet.
3. **Fix drift in-place.** If I find a wrong number, a wrong method name, or an outdated claim, it gets fixed in the current working tree, not filed as a patch.
4. **Every push is atomic.** Code + every affected doc + stamp + commit + merge + push, as one operation.

### Pre-push checklist

Run this **every** push, before `node scripts/stamp-version.mjs`:

- [ ] Every numerical claim (line counts, dimensions, weights, thresholds) verified against code via `wc -l` / `grep` / re-reading
- [ ] Every method/field name in docs matches code verbatim (stubbed no-ops described as "stubbed" not "deleted")
- [ ] `docs/TODO.md` — new tasks logged, completed tasks moved, in-progress updated
- [ ] `docs/FINALIZED.md` — new session entry appended with verbatim task description
- [ ] `docs/EQUATIONS.md` — math + equations match code
- [ ] `docs/ARCHITECTURE.md` — structural/code-map matches code
- [ ] `docs/ROADMAP.md` — phases/milestones updated
- [ ] `docs/SKILL_TREE.md` — capability matrix updated
- [ ] `docs/SENSORY.md` / `docs/WEBSOCKET.md` — peripheral/protocol changes
- [ ] `README.md` / `SETUP.md` / `brain-equations.html` / `unity-guide.html` / `index.html` — public surface aligned
- [ ] All affected docs are part of the current working tree, not deferred
- [ ] Every task Gee gave this session is completed (and documented) or explicitly deferred

Only when **every** box is checked does the stamp + commit + push run.

### Corollaries

- **No solo doc-only commits** except after-the-fact corrections for drift found post-push (which is itself a failure of this law and should be caught in the checklist).
- **Never phrase fixes as "I'll patch this after"** — always "I'll roll this into the current commit before pushing."
- **Precision matters** — "deleted" / "stubbed no-op" / "replaced" are not interchangeable words. Docs use the word that matches what the code does.

---

## Deploy versioning

Unity's deployed bundle is identified by `VERSION+BUILD`:

- `VERSION` — semver in `js/version.js`, hand-bumped per release (`0.1.0` at time of writing)
- `BUILD` — `<gitShort8>-<rand4hex>` stamped by `scripts/stamp-version.mjs`

Two pushes from the same commit still get different BUILD ids thanks to the random nonce, so CDN caches always invalidate.

## Push sequence

```
1.  Make changes, commit normally.
2.  node scripts/stamp-version.mjs
        → rewrites js/version.js BUILD
        → rewrites index.html cache-buster
3.  git add js/version.js index.html
    git commit -m "chore: stamp build <id>"
4.  git push origin <branch>
```

The boot log in the browser will show `[Unity] app.js 0.1.0+<gitShort>-<rand> module loaded`. Verify on the deployed site that the build id matches what was stamped — if it doesn't, you're looking at a cached bundle.

## Bumping VERSION

**Only Gee bumps VERSION.** It stays at `0.1.0` until he explicitly says otherwise. The stamp script deliberately does not touch the `VERSION` line — it only rewrites `BUILD`. Do not auto-increment, do not "helpfully" bump on feature merges, do not touch it as part of any refactor. Wait for the direct call.

## What NOT to do

- Do not hand-edit `BUILD` in `js/version.js` — always run the stamp script
- Do not hand-edit the `?v=` query in `index.html` — the stamp script owns it
- Do not leave vestigial cache-buster comments (`// T4.xx`, `// vYYYYMMDD`) anywhere — single source of truth lives in `js/version.js`
