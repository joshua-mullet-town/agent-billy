#!/bin/bash

# Test with cleaned dependencies to verify architecture fix

set -e

echo "🔧 Clean Dependencies Architecture Test"
echo "======================================"
echo ""

# Check if we're in the right directory
if [ ! -f "../package.json" ]; then
    echo "❌ Please run this script from the ansible/ directory"
    exit 1
fi

REPO_ROOT=$(dirname "$(pwd)")

# Create a temporary test directory
TEST_DIR=$(mktemp -d)
echo "📁 Test directory: $TEST_DIR"

# Copy package.json and clean it
cp "$REPO_ROOT/package.json" "$TEST_DIR/package.json"

# Clean the package.json by removing problematic dependencies
cat > "$TEST_DIR/clean_package.js" << 'EOF'
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Remove problematic dependencies
delete pkg.dependencies.node;
delete pkg.dependencies.npm;
delete pkg.optionalDependencies['@rollup/rollup-darwin-x64'];

// Only keep essential dependencies for testing vite
const essentialDeps = [
  'vite', 
  'vue', 
  '@vitejs/plugin-vue',
  '@vue/compiler-sfc',
  'typescript',
  'vue-tsc'
];

const cleanDeps = {};
essentialDeps.forEach(dep => {
  if (pkg.dependencies[dep]) cleanDeps[dep] = pkg.dependencies[dep];
  if (pkg.devDependencies[dep]) cleanDeps[dep] = pkg.devDependencies[dep];
});

pkg.dependencies = {};
pkg.devDependencies = cleanDeps;

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
console.log('✅ Cleaned package.json');
EOF

echo "🚀 Testing with clean dependencies..."

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
        
        echo '🧹 Cleaning package.json...'
        node clean_package.js
        
        echo '📦 Installing clean dependencies...'
        npm install --silent --no-audit --no-fund || {
            echo 'Install had issues, checking what succeeded...'
        }
        
        echo ''
        echo '🔍 Testing if binaries work:'
        if [ -f node_modules/.bin/vite ]; then
            echo '✅ vite found - testing:'
            ./node_modules/.bin/vite --version
        else
            echo '❌ vite not found'
        fi
        
        if [ -f node_modules/.bin/vue-tsc ]; then
            echo '✅ vue-tsc found - testing:'
            ./node_modules/.bin/vue-tsc --version
        else
            echo '❌ vue-tsc not found'
        fi
        
        echo ''
        echo '✅ Test completed!'
"

# Cleanup
rm -rf "$TEST_DIR"
echo "🧹 Cleaned up test directory"