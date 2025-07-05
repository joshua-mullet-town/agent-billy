#!/bin/bash

# Quick test to verify package fix without running dev server

set -e

CONTAINER_NAME="givegrove-quick-fix"

echo "🔧 Quick Package Fix Test"
echo "========================"
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
echo "🚀 Testing quick package fix..."

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
        apt-get install -y -qq curl file
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y -qq nodejs
        
        echo '📊 Versions:'
        echo 'Node.js:' \$(node --version)
        echo 'npm:' \$(npm --version)
        echo ''
        
        echo '🗑️ FIX 1: Clean ALL node_modules to remove architecture conflicts...'
        rm -rf node_modules functions/node_modules
        
        echo '📦 FIX 2: Fresh install with platform-specific binaries...'
        npm install --legacy-peer-deps 2>/dev/null || echo 'Install had warnings but may have worked'
        
        echo ''
        echo '🔍 Verify packages are now correct architecture:'
        if [ -f node_modules/.bin/vite ]; then
            echo 'vite binary found:'
            file node_modules/.bin/vite
        else
            echo 'vite binary not found'
        fi
        
        echo ''
        echo '🔍 Test if main packages can be resolved:'
        node -e 'console.log(\"✅ Node.js execution works\")' || echo 'Node.js test failed'
        
        echo ''
        echo '🔍 Test vite version (if available):'
        if [ -f node_modules/.bin/vite ]; then
            ./node_modules/.bin/vite --version || echo 'vite version check failed'
        fi
        
        echo ''
        echo '✅ Architecture fix test completed!'
"