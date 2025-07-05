#!/bin/bash

# Fix the package architecture issues - test rapid solutions

set -e

CONTAINER_NAME="givegrove-package-fix"

echo "🔧 Testing Package Fixes for GiveGrove"
echo "====================================="
echo ""

# Cleanup function
cleanup() {
    echo "🧹 Cleaning up..."
    docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
}

trap cleanup EXIT

# Check if we're in the right directory
if [ ! -f "../package.json" ]; then
    echo "❌ Please run this script from the ansible/ directory"
    exit 1
fi

REPO_ROOT=$(dirname "$(pwd)")

echo "📁 Repository root: $REPO_ROOT"
echo "🚀 Testing package fixes..."

# Run container and fix the architecture issues
docker run --rm \
    --name "$CONTAINER_NAME" \
    --volume "$REPO_ROOT:/workspace" \
    --workdir /workspace \
    ubuntu:22.04 \
    bash -c "
        set -e
        export DEBIAN_FRONTEND=noninteractive
        
        echo '🔧 Installing Node.js...'
        apt-get update -qq
        apt-get install -y -qq curl
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y -qq nodejs
        
        echo '📊 Versions:'
        echo 'Node.js:' \$(node --version)
        echo 'npm:' \$(npm --version)
        echo ''
        
        echo '🗑️ FIX 1: Clean ALL node_modules to remove architecture conflicts...'
        rm -rf node_modules functions/node_modules
        
        echo '📦 FIX 2: Fresh install with platform-specific binaries...'
        npm install --legacy-peer-deps
        
        echo '📦 FIX 3: Install backend dependencies...'
        cd functions && npm install && cd ..
        
        echo ''
        echo '🔍 Verify packages are now correct architecture:'
        file node_modules/.bin/vite || echo 'vite binary not found'
        file functions/node_modules/.bin/tsc || echo 'tsc binary not found'
        
        echo ''
        echo '🚀 FINAL TEST: npm run dev...'
        timeout 15s npm run dev || echo 'Test completed'
        
        echo ''
        echo '✅ If no architecture errors above, the fix works!'
"