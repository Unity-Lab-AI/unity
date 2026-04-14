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
