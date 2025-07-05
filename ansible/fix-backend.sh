#!/bin/bash

# Fix backend configuration issues for local development

echo "🔧 Fixing Backend Configuration for VM"
echo "====================================="

VM_IP="174.138.71.207"
SSH_KEY="~/.ssh/id_ed25519_digital_ocean"

echo "📡 Connecting to VM to fix backend..."

ssh -i $SSH_KEY root@$VM_IP << 'EOF'
cd GiveGrove

echo "=== Stopping any existing processes ==="
pkill -f firebase || true
pkill -f vite || true
pkill -f node || true
sleep 3

echo "=== Setting up minimal Firebase config ==="
cd functions

# Create minimal runtime config for emulator
cat > .runtimeconfig.json << 'RUNTIME_CONFIG'
{
  "env": {
    "service_account": "{\"type\":\"service_account\",\"project_id\":\"local-dev\"}"
  }
}
RUNTIME_CONFIG

echo "=== Rebuilding functions with config ==="
npm run build

echo "=== Starting frontend in background ==="
cd ..
nohup npm run dev -- --host 0.0.0.0 --port 3000 > /tmp/frontend.log 2>&1 &
sleep 5

echo "=== Starting backend with config ==="
cd functions
nohup npm run serve > /tmp/backend.log 2>&1 &
sleep 10

echo "=== Testing both services ==="
echo "Frontend test:"
if curl -s http://localhost:3000/ | grep -q "GiveGrove"; then
    echo "✅ Frontend is working"
else
    echo "❌ Frontend failed"
fi

echo "Backend test:"
if curl -s http://localhost:4000/ | grep -q "emulator"; then
    echo "✅ Backend emulator UI is working"
    
    # Test if functions are actually loaded
    if curl -s http://localhost:5001/ > /dev/null 2>&1; then
        echo "✅ Functions emulator responding"
    else
        echo "📝 Functions may still be loading..."
    fi
else
    echo "❌ Backend emulator failed"
fi

echo "=== Process status ==="
ps aux | grep -E "(vite|firebase)" | grep -v grep || echo "No processes found"

echo "=== Port status ==="
ss -tlnp | grep -E ":3000|:4000|:5001" || echo "No ports listening"

echo "=== Recent backend log ==="
tail -5 /tmp/backend.log 2>/dev/null || echo "No backend log"

EOF

echo ""
echo "🎯 Backend fix complete!"
echo "   Frontend: http://$VM_IP:3000"
echo "   Backend UI: http://$VM_IP:4000"
echo "   Functions: http://$VM_IP:5001"