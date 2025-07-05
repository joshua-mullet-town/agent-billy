#!/bin/bash

# Minimal test focusing just on the npm install issues

set -e

CONTAINER_NAME="givegrove-minimal-test"

echo "🧪 Minimal Node.js/npm Test"
echo "==========================="

cleanup() {
    docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
}
trap cleanup EXIT

# Check Docker
if ! docker info &>/dev/null; then
    echo "❌ Docker not running"
    exit 1
fi

REPO_ROOT=$(dirname "$(pwd)")

echo "🚀 Testing Node.js setup and npm install fixes..."

docker run --rm \
    --name "$CONTAINER_NAME" \
    --volume "$REPO_ROOT:/workspace" \
    ubuntu:22.04 \
    bash -c "
        set -e
        export DEBIAN_FRONTEND=noninteractive
        
        echo '📦 Installing basic deps...'
        apt-get update -qq
        apt-get install -y -qq curl wget gnupg lsb-release build-essential python3
        
        echo '📗 Adding NodeSource repository...'
        curl -fsSL https://deb.nodesource.com/gpgkey/nodesource.gpg.key | apt-key add -
        echo 'deb https://deb.nodesource.com/node_20.x jammy main' > /etc/apt/sources.list.d/nodesource.list
        
        echo '⬇️ Installing Node.js...'
        apt-get update -qq
        apt-get install -y nodejs
        
        echo '📊 Versions:'
        echo \"Node.js: \$(node --version)\"
        echo \"npm: \$(npm --version)\"
        
        echo '📁 Setting up test directory...'
        cp -r /workspace /test-workspace
        cd /test-workspace
        
        echo '🗑️ Cleaning old modules...'
        rm -rf node_modules functions/node_modules
        
        echo '📦 Testing npm install with fixes...'
        export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
        export PHANTOMJS_SKIP_DOWNLOAD=true
        
        # Try the problematic frontend install
        if npm install --legacy-peer-deps --no-optional; then
            echo '✅ Frontend install succeeded!'
        else
            echo '❌ Frontend install failed'
            exit 1
        fi
        
        echo '📦 Testing backend install...'
        cd functions
        if npm install; then
            echo '✅ Backend install succeeded!'
        else
            echo '❌ Backend install failed'
            exit 1
        fi
        
        echo ''
        echo '🎉 All npm installs completed successfully!'
    "

echo "✅ Minimal test completed!"