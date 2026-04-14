# Push Workflow — Deploy Versioning

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
