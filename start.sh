#!/bin/bash
echo ""
echo "  =============================="
echo "    Unity Brain Server"
echo "  =============================="
echo ""

# Kill anything on port 7525
lsof -ti:7525 2>/dev/null | xargs kill -9 2>/dev/null

DIR="$(cd "$(dirname "$0")" && pwd)"

# Install server deps if missing
cd "$DIR/server"
if [ ! -d "node_modules" ]; then
    echo "  Installing dependencies..."
    npm install
    echo ""
fi

# Make sure esbuild is present even on existing checkouts that pre-date
# the bundle-build step. Matches start.bat parity (Gee 2026-04-18 — was
# previously only in start.bat, so Linux/Mac users could silently fail
# the bundle build if esbuild was ever removed).
if [ ! -d "node_modules/esbuild" ]; then
    echo "  Installing esbuild for bundle build..."
    npm install esbuild --save-dev
    echo ""
fi

# Make sure GloVe 6B.300d is present for Unity's semantic substrate.
# Without it, language cortex falls back to fastText-style subword hash
# embeddings which don't cluster rhyming/semantic neighbors - production
# probes at K+ grades struggle. Download is idempotent: skipped if the
# file already exists; soft-fails to subword fallback if network/tools
# missing so the brain still boots.
if [ ! -f "$DIR/corpora/glove.6B.300d.txt" ]; then
    echo "  GloVe 6B.300d not found - downloading (~823 MB zip, one-time, 5-15 min)..."
    echo "  Source: https://nlp.stanford.edu/data/glove.6B.zip"
    mkdir -p "$DIR/corpora"
    cd "$DIR/corpora"
    # Match start.bat curl flags for cross-platform uniformity per Gee's
    # 114.16 binding. --progress-bar gives a simple [========] line
    # instead of the default animated progress table that uses \r (which
    # on CMD corrupts subsequent line parses; on bash it's just uglier
    # in non-TTY contexts like CI logs). -o explicit output filename for
    # parity with start.bat's -o glove.6B.zip.
    if curl -L --fail --show-error --progress-bar --max-time 1800 -o glove.6B.zip https://nlp.stanford.edu/data/glove.6B.zip; then
        # Extract just glove.6B.300d.txt from the zip (skips 50d/100d/200d
        # variants that would waste ~1 GB of disk). Try unzip first (common
        # on Linux + macOS), fall back to tar (ships with modern macOS +
        # Windows Git Bash). Both strip the zip's internal path and drop
        # the file directly in corpora/.
        if unzip -o glove.6B.zip glove.6B.300d.txt 2>/dev/null || \
           tar -xf glove.6B.zip glove.6B.300d.txt 2>/dev/null; then
            rm glove.6B.zip
            echo "  GloVe 6B.300d installed at corpora/glove.6B.300d.txt."
        else
            echo ""
            echo "  WARNING: GloVe extract failed (no unzip or tar). Install one and retry."
            echo "    macOS: tar + unzip ship by default"
            echo "    Debian/Ubuntu: apt install unzip"
            echo "    Alpine: apk add unzip"
            echo "  Continuing with subword fallback for now."
            echo ""
        fi
    else
        echo ""
        echo "  WARNING: GloVe download failed (network / curl missing / Stanford"
        echo "  NLP unreachable). Continuing with built-in fastText-style subword"
        echo "  embeddings fallback. Re-run start.sh when internet is available"
        echo "  to retry - the download is idempotent."
        echo ""
    fi
    cd "$DIR"
fi

# Build the JS bundle. The browser loads js/app.bundle.js, NOT live source.
# Bundle is gitignored so every code change requires a rebuild.
# Using `npm run build` for parity with start.bat (Gee 2026-04-18) —
# previously Linux/Mac used inline `npx esbuild ... 2>/dev/null` which
# swallowed errors and could silently run stale code.
cd "$DIR/server"
echo "  Building js/app.bundle.js..."
if npm run build; then
    echo "  Bundle built - browser will load fresh code."
else
    echo ""
    echo "  ============================================================"
    echo "  ERROR: esbuild bundle build failed."
    echo "  The browser will run STALE code from the previous bundle."
    echo "  See the esbuild output above for the cause."
    echo "  ============================================================"
    echo ""
fi
echo ""

# Start server in background.
# --max-old-space-size=65536 = 64 GB V8 heap ceiling. Matches start.bat
# (Gee 2026-04-18) — previously Linux/Mac defaulted to ~2 GB V8 heap,
# which capped the language cortex auto-scaler to a tiny fraction of
# what Windows would produce on identical hardware. Now both platforms
# give the language cortex the full heap room it needs.
echo "  Starting brain server (GPU EXCLUSIVE - no CPU workers)..."
node --max-old-space-size=65536 brain-server.js &
SERVER_PID=$!
sleep 2

# Open browser + GPU compute page (REQUIRED - brain runs on GPU exclusively)
echo "  Opening browser..."
if command -v open &>/dev/null; then
    open http://localhost:7525
    open http://localhost:7525/compute.html
elif command -v xdg-open &>/dev/null; then
    xdg-open http://localhost:7525
    xdg-open http://localhost:7525/compute.html
fi

echo "  Open: http://localhost:7525"
echo "  GPU compute: http://localhost:7525/compute.html (REQUIRED - brain pauses without it)"
echo "  Press Ctrl+C to stop."
echo ""

# Wait for server
wait $SERVER_PID
