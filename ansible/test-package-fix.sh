#!/bin/bash

# Test package.json modification approach

set -e

CONTAINER_NAME="givegrove-package-test"

echo "🧪 Testing package.json modification approach"
echo "============================================="

cleanup() {
    docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
}
trap cleanup EXIT

if ! docker info &>/dev/null; then
    echo "❌ Docker not running"
    exit 1
fi

REPO_ROOT=$(dirname "$(pwd)")

echo "🚀 Testing package.json modification..."

docker run --rm \
    --name "$CONTAINER_NAME" \
    --volume "$REPO_ROOT:/workspace" \
    ubuntu:22.04 \
    bash -c "
        set -e
        export DEBIAN_FRONTEND=noninteractive
        
        echo '📦 Installing dependencies...'
        apt-get update -qq
        apt-get install -y -qq curl wget gnupg lsb-release build-essential python3 jq
        
        echo '📗 Installing Node.js...'
        curl -fsSL https://deb.nodesource.com/gpgkey/nodesource.gpg.key | apt-key add -
        echo 'deb https://deb.nodesource.com/node_20.x jammy main' > /etc/apt/sources.list.d/nodesource.list
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
        
        echo '🔧 Modifying package.json for compatibility...'
        # Remove problematic dependencies
        jq 'del(.devDependencies.\"phantomjs-prebuilt\")' package.json > package.json.tmp && mv package.json.tmp package.json
        jq 'del(.devDependencies.chromedriver)' package.json > package.json.tmp && mv package.json.tmp package.json
        jq 'del(.devDependencies.nightwatch)' package.json > package.json.tmp && mv package.json.tmp package.json
        
        # Relax Node.js version requirement
        jq '.engines.node = \">= 20.0.0\"' package.json > package.json.tmp && mv package.json.tmp package.json
        
        echo '📋 Modified package.json engines:'
        jq '.engines' package.json
        
        echo '📦 Testing npm install with modifications...'
        export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
        export PHANTOMJS_SKIP_DOWNLOAD=true
        
        if npm install --legacy-peer-deps --ignore-engines; then
            echo '✅ Frontend install succeeded!'
            
            echo '📦 Testing backend install...'
            cd functions
            if npm install; then
                echo '✅ Backend install succeeded!'
            else
                echo '❌ Backend install failed'
                exit 1
            fi
        else
            echo '❌ Frontend install failed'
            exit 1
        fi
        
        echo ''
        echo '🎉 All installs completed successfully!'
        
        echo ''
        echo '📊 Final package counts:'
        echo \"Frontend packages: \$(ls node_modules 2>/dev/null | wc -l)\"
        echo \"Backend packages: \$(ls functions/node_modules 2>/dev/null | wc -l)\"
    "

echo "✅ Package modification test completed!"