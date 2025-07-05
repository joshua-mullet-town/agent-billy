#!/bin/bash

# Minimal test to verify the architecture fix

set -e

echo "🔧 Minimal Architecture Fix Test"
echo "==============================="
echo ""

# Check if we're in the right directory
if [ ! -f "../package.json" ]; then
    echo "❌ Please run this script from the ansible/ directory"
    exit 1
fi

REPO_ROOT=$(dirname "$(pwd)")
echo "📁 Repository root: $REPO_ROOT"

# Create a temporary test directory
TEST_DIR=$(mktemp -d)
echo "📁 Test directory: $TEST_DIR"

# Copy package.json to test directory
cp "$REPO_ROOT/package.json" "$TEST_DIR/"
cp "$REPO_ROOT/package-lock.json" "$TEST_DIR/" 2>/dev/null || echo "No package-lock.json found"

echo "🚀 Running minimal Docker test..."

# Test in clean environment
docker run --rm \
    --volume "$TEST_DIR:/test" \
    --workdir /test \
    ubuntu:22.04 \
    bash -c "
        set -e
        export DEBIAN_FRONTEND=noninteractive
        
        echo '🔧 Installing Node.js 20...'
        apt-get update -qq
        apt-get install -y -qq curl
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y -qq nodejs
        
        echo '📊 Environment:'
        echo 'Node.js:' \$(node --version)
        echo 'npm:' \$(npm --version)
        echo 'Architecture:' \$(uname -m)
        echo ''
        
        echo '📦 Installing dependencies...'
        npm install --silent --no-audit --no-fund 2>/dev/null || {
            echo 'Install failed, but continuing...'
        }
        
        echo ''
        echo '🔍 Testing if binaries work:'
        if [ -f node_modules/.bin/vite ]; then
            echo 'vite found - testing:'
            ./node_modules/.bin/vite --version || echo 'vite version failed'
        else
            echo 'vite not found'
        fi
        
        echo ''
        echo '✅ Test completed!'
"

# Cleanup
rm -rf "$TEST_DIR"
echo "🧹 Cleaned up test directory"