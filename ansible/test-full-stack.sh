#!/bin/bash

# Test that both frontend and backend work on the VM

echo "🚀 Testing Full Stack GiveGrove on VM"
echo "====================================="

VM_IP="174.138.71.207"
SSH_KEY="~/.ssh/id_ed25519_digital_ocean"

echo "📡 Connecting to VM for full stack test..."

ssh -i $SSH_KEY root@$VM_IP << 'EOF'
cd GiveGrove

echo "=== Killing any existing processes ==="
pkill -f vite || true
pkill -f node || true
pkill -f firebase || true
sleep 3

echo "=== 1. Testing Frontend Server ==="
echo "Starting frontend in background..."
nohup npm run dev -- --host 0.0.0.0 --port 3000 > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!

echo "Waiting for frontend to start..."
sleep 8

if curl -s http://localhost:3000/ | grep -q "GiveGrove"; then
    echo "✅ Frontend is running and serving GiveGrove app"
    ps aux | grep vite | grep -v grep | head -1
else
    echo "❌ Frontend failed to start"
    cat /tmp/frontend.log | tail -5
fi

echo ""
echo "=== 2. Testing Backend (Firebase Functions) ==="
cd functions

echo "Installing backend dependencies..."
npm install > /dev/null 2>&1

echo "Starting Firebase emulator in background..."
nohup npm run serve > /tmp/backend.log 2>&1 &
BACKEND_PID=$!

echo "Waiting for backend to start..."
sleep 15

# Check if Firebase emulator is running
if netstat -tlnp | grep -q ":5001\|:4000"; then
    echo "✅ Firebase emulator is running"
    netstat -tlnp | grep ":5001\|:4000" | head -2
    
    # Test if functions endpoint responds
    if curl -s http://localhost:5001/ > /dev/null 2>&1; then
        echo "✅ Functions emulator responding on port 5001"
    else
        echo "📝 Functions emulator may be starting up"
    fi
else
    echo "❌ Firebase emulator not detected on expected ports"
    echo "Backend log:"
    tail -10 /tmp/backend.log
fi

echo ""
echo "=== 3. Process Summary ==="
echo "Frontend processes:"
ps aux | grep -E "(vite|node.*dev)" | grep -v grep || echo "No frontend processes"

echo "Backend processes:"
ps aux | grep -E "(firebase|emulator)" | grep -v grep || echo "No backend processes"

echo ""
echo "=== 4. Network Ports ==="
echo "Active ports:"
ss -tlnp | grep -E ":3000|:5001|:4000" || echo "No expected ports listening"

echo ""
echo "=== 5. Log Summary ==="
echo "Frontend log (last 5 lines):"
tail -5 /tmp/frontend.log 2>/dev/null || echo "No frontend log"

echo "Backend log (last 5 lines):"
tail -5 /tmp/backend.log 2>/dev/null || echo "No backend log"

cd ..
EOF

echo ""
echo "🎯 Full Stack Test Complete!"
echo "   Frontend: http://$VM_IP:3000"
echo "   Backend: http://$VM_IP:5001"