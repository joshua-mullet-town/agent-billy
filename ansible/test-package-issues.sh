#!/bin/bash

# Test script to replicate the exact package resolution errors we're seeing on VM

set -e

CONTAINER_NAME="givegrove-package-test"

echo "🐳 Testing GiveGrove Package Resolution Issues"
echo "=============================================="
echo ""

# Cleanup function
cleanup() {
    echo "🧹 Cleaning up..."
    docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
}

# Set up cleanup
trap cleanup EXIT

# Check if we're in the right directory
if [ ! -f "../package.json" ]; then
    echo "❌ Please run this script from the ansible/ directory"
    exit 1
fi

REPO_ROOT=$(dirname "$(pwd)")

echo "📁 Repository root: $REPO_ROOT"
echo "🚀 Starting package test container..."

# Run container with exact same setup as VM
docker run --rm \
    --name "$CONTAINER_NAME" \
    --volume "$REPO_ROOT:/workspace" \
    --workdir /workspace \
    ubuntu:22.04 \
    bash -c "
        set -e
        export DEBIAN_FRONTEND=noninteractive
        
        echo '🔧 Installing Node.js 20.5.1 (same as VM)...'
        apt-get update -qq
        apt-get install -y -qq curl
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y -qq nodejs
        
        echo '📊 Versions:'
        echo 'Node.js:' \$(node --version)
        echo 'npm:' \$(npm --version)
        echo ''
        
        echo '📦 Installing dependencies...'
        npm install --legacy-peer-deps
        
        echo ''
        echo '🔍 Testing problematic packages specifically:'
        echo 'algoliasearch:' \$(npm list algoliasearch --depth=0 2>/dev/null | grep algoliasearch || echo 'NOT FOUND')
        echo 'qrcode.vue:' \$(npm list qrcode.vue --depth=0 2>/dev/null | grep qrcode.vue || echo 'NOT FOUND')  
        echo 'vue-croppie:' \$(npm list vue-croppie --depth=0 2>/dev/null | grep vue-croppie || echo 'NOT FOUND')
        echo 'vuex:' \$(npm list vuex --depth=0 2>/dev/null | grep vuex || echo 'NOT FOUND')
        
        echo ''
        echo '🚀 CRITICAL TEST: Running npm run dev...'
        echo 'This should reproduce the exact same Vite errors we saw on VM:'
        echo ''
        
        # Try to start dev server - should show same errors
        timeout 30s npm run dev || echo 'Command completed/failed (expected)'
"