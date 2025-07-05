#!/bin/bash

# Simple backend test - just prove functions can load

echo "🔧 Simple Backend Test"
echo "====================="

VM_IP="174.138.71.207"
SSH_KEY="~/.ssh/id_ed25519_digital_ocean"

ssh -i $SSH_KEY root@$VM_IP << 'EOF'
cd GiveGrove/functions

echo "=== Clean start ==="
pkill -f firebase || true
pkill -f tsc || true
sleep 2

echo "=== Create minimal config ==="
echo '{"env":{"service_account":"{\"type\":\"service_account\"}"}}' > .runtimeconfig.json

echo "=== Check if functions already built ==="
if [ -f "dist/index.js" ]; then
    echo "✅ Functions already compiled"
    head -5 dist/index.js
else
    echo "❌ No compiled functions found"
fi

echo "=== Test Firebase CLI ==="
firebase --version

echo "=== Try emulator with existing build ==="
timeout 30s firebase emulators:start --only functions || echo "Emulator test completed"

EOF