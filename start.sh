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

# Make sure GloVe 6B.300d is present for Unity's semantic substrate.
# Without it, language cortex falls back to fastText-style subword hash
# embeddings which don't cluster rhyming/semantic neighbors — production
# probes at K+ grades struggle. Download is idempotent: skipped if the
# file already exists; soft-fails to subword fallback if network/tools
# missing so the brain still boots.
if [ ! -f "$DIR/corpora/glove.6B.300d.txt" ]; then
    echo "  GloVe 6B.300d not found — downloading (~823 MB zip, one-time, 5-15 min)..."
    echo "  Source: https://nlp.stanford.edu/data/glove.6B.zip"
    mkdir -p "$DIR/corpora"
    cd "$DIR/corpora"
    if curl -LO --fail --show-error --max-time 1800 https://nlp.stanford.edu/data/glove.6B.zip; then
        if unzip -p glove.6B.zip glove.6B.300d.txt > glove.6B.300d.txt 2>/dev/null || \
           tar -xf glove.6B.zip glove.6B.300d.txt 2>/dev/null; then
            rm glove.6B.zip
            echo "  GloVe 6B.300d installed at corpora/glove.6B.300d.txt."
        else
            echo ""
            echo "  WARNING: GloVe extract failed. Install unzip or tar and retry."
            echo "  Continuing with subword fallback for now."
            echo ""
        fi
    else
        echo ""
        echo "  WARNING: GloVe download failed (network / curl missing / Stanford"
        echo "  NLP unreachable). Continuing with built-in fastText-style subword"
        echo "  embeddings fallback. Re-run start.sh when internet is available"
        echo "  to retry — the download is idempotent."
        echo ""
    fi
    cd "$DIR"
fi

# Build bundle if npx available
cd "$DIR"
if command -v npx &>/dev/null; then
    echo "  Building bundle..."
    npx esbuild js/app.js --bundle --format=esm --outfile=js/app.bundle.js --platform=browser --target=esnext 2>/dev/null && echo "  Bundle built." || echo "  Using pre-built bundle."
else
    echo "  Using pre-built bundle."
fi
echo ""

# Start server in background
cd "$DIR/server"
echo "  Starting brain server..."
node brain-server.js &
SERVER_PID=$!
sleep 2

# Open browser + GPU compute page (REQUIRED — brain runs on GPU exclusively)
echo "  Opening browser..."
if command -v open &>/dev/null; then
    open http://localhost:7525
    open http://localhost:7525/compute.html
elif command -v xdg-open &>/dev/null; then
    xdg-open http://localhost:7525
    xdg-open http://localhost:7525/compute.html
fi

echo "  Open: http://localhost:7525"
echo "  GPU compute: http://localhost:7525/compute.html (REQUIRED — brain pauses without it)"
echo "  Press Ctrl+C to stop."
echo ""

# Wait for server
wait $SERVER_PID
