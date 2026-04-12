#!/bin/bash
echo ""
echo "  =============================="
echo "    Unity Brain Server"
echo "  =============================="
echo ""

# Kill anything on port 8080
lsof -ti:8080 2>/dev/null | xargs kill -9 2>/dev/null

# Install server deps if missing
cd "$(dirname "$0")/server"
if [ ! -d "node_modules" ]; then
    echo "  Installing dependencies..."
    npm install
    echo ""
fi

# Build bundle if npx available
cd "$(dirname "$0")"
if command -v npx &>/dev/null; then
    echo "  Building bundle..."
    npx esbuild js/app.js --bundle --format=esm --outfile=js/app.bundle.js --platform=browser --target=esnext 2>/dev/null && echo "  Bundle built." || echo "  Using pre-built bundle."
else
    echo "  Using pre-built bundle."
fi
echo ""

# Open browser
echo "  Starting brain server..."
echo "  Open: http://localhost:8080"
echo ""

# Try to open browser (works on Mac + Linux)
if command -v open &>/dev/null; then
    open http://localhost:8080
elif command -v xdg-open &>/dev/null; then
    xdg-open http://localhost:8080
fi

# Start server
cd "$(dirname "$0")/server"
node brain-server.js
