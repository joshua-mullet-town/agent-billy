#!/bin/bash

# Test that the frontend actually works on the VM

echo "🌐 Testing GiveGrove Frontend on VM"
echo "==================================="

VM_IP="174.138.71.207"
SSH_KEY="~/.ssh/id_ed25519_digital_ocean"

echo "📡 Connecting to VM..."

ssh -i $SSH_KEY root@$VM_IP << 'EOF'
cd GiveGrove

echo "=== Killing any existing processes ==="
pkill -f vite || true
pkill -f node || true
sleep 2

echo "=== Starting frontend server ==="
npm run dev -- --host 0.0.0.0 &
VITE_PID=$!

echo "=== Waiting for server to start ==="
sleep 8

echo "=== Testing server response ==="
if curl -s http://localhost:3000/ > /tmp/frontend_test.html; then
    echo "✅ Server is responding!"
    echo "=== Page Content Preview ==="
    head -15 /tmp/frontend_test.html
    echo ""
    echo "=== Key Elements Found ==="
    grep -c "GiveGrove" /tmp/frontend_test.html && echo "✅ GiveGrove branding found"
    grep -c "Vue" /tmp/frontend_test.html && echo "✅ Vue.js found" || echo "📝 Vue references may be in modules"
    grep -c "vite" /tmp/frontend_test.html && echo "✅ Vite dev server found"
    grep -c "title" /tmp/frontend_test.html && echo "✅ HTML structure found"
else
    echo "❌ Server not responding"
fi

echo "=== Process Status ==="
ps aux | grep -E "(vite|node)" | grep -v grep || echo "No processes found"

echo "=== Network Ports ==="
ss -tlnp | grep :3000 || echo "Port 3000 not listening"

# Keep server running for a moment
sleep 5
EOF

echo ""
echo "🎯 If successful, the frontend is proven to work!"
echo "   You can access it at: http://$VM_IP:3000"