#!/bin/bash

# Setup complete backend with mock configuration for development

echo "🔧 Setting Up Complete Backend Environment"
echo "=========================================="

VM_IP="174.138.71.207"
SSH_KEY="~/.ssh/id_ed25519_digital_ocean"

ssh -i $SSH_KEY root@$VM_IP << 'EOF'
cd GiveGrove/functions

echo "=== Creating comprehensive dev config ==="
cat > .runtimeconfig.json << 'CONFIG'
{
  "env": {
    "service_account": "{\"type\":\"service_account\",\"project_id\":\"local-dev\"}"
  },
  "slack": {
    "webhook": "https://hooks.slack.com/dev-mock",
    "bot_token": "xoxb-dev-mock-token"
  },
  "twilio": {
    "account_sid": "ACdev-mock-account-sid",
    "auth_token": "dev-mock-auth-token",
    "phone_number": "+15555551234"
  },
  "send_grid": {
    "api_key": "SG.dev-mock-api-key",
    "from_email": "dev@givegrove.local"
  },
  "stripe": {
    "secret_key": "sk_test_dev_mock_key",
    "publishable_key": "pk_test_dev_mock_key",
    "webhook_secret": "whsec_dev_mock_secret"
  }
}
CONFIG

echo "=== Starting frontend ==="
cd ..
# Kill any existing processes
pkill -f vite || true
pkill -f firebase || true
pkill -f node || true
sleep 3

# Start frontend
nohup npm run dev -- --host 0.0.0.0 --port 3000 > /tmp/frontend.log 2>&1 &
sleep 5

echo "=== Starting backend with full config ==="
cd functions
nohup firebase emulators:start --only functions > /tmp/backend.log 2>&1 &
sleep 15

echo "=== Testing full stack ==="
echo "1. Frontend test:"
if curl -s http://localhost:3000/ | grep -q "GiveGrove"; then
    echo "✅ Frontend: GiveGrove app is serving"
else
    echo "❌ Frontend: Failed to load"
fi

echo "2. Backend emulator test:"
if curl -s http://localhost:4000/ | grep -q "emulator"; then
    echo "✅ Backend: Emulator UI is accessible"
else
    echo "❌ Backend: Emulator UI failed"
fi

echo "3. Functions test:"
if curl -s -I http://localhost:5001/ | grep -q "200\|404"; then
    echo "✅ Backend: Functions endpoint is responding"
else
    echo "❌ Backend: Functions endpoint not accessible"
fi

echo "4. Functions list test:"
FUNCTIONS_LIST=$(curl -s http://localhost:4000/functions 2>/dev/null)
if echo "$FUNCTIONS_LIST" | grep -q "function\|endpoint"; then
    echo "✅ Backend: Functions are loaded"
else
    echo "📝 Backend: No functions detected (may still be loading)"
fi

echo ""
echo "=== Final Status ==="
echo "Processes:"
ps aux | grep -E "(vite|firebase)" | grep -v grep | head -3

echo "Ports:"
ss -tlnp | grep -E ":3000|:4000|:5001" || echo "No expected ports found"

echo "Recent backend log:"
tail -5 /tmp/backend.log 2>/dev/null || echo "No backend log"

EOF

echo ""
echo "🎯 Complete Backend Setup Done!"
echo ""
echo "Access URLs:"
echo "  Frontend: http://$VM_IP:3000"
echo "  Backend UI: http://$VM_IP:4000" 
echo "  Functions: http://$VM_IP:5001"