#!/bin/bash

# Prove that localhost connectivity works when properly configured

echo "🔍 Proving Localhost Connectivity Works"
echo "======================================"

VM_IP="174.138.71.207"
SSH_KEY="~/.ssh/id_ed25519_digital_ocean"

ssh -i $SSH_KEY root@$VM_IP << 'EOF'
cd GiveGrove

echo "=== 1. Clean slate ==="
pkill -f vite || true
pkill -f firebase || true
sleep 3

echo "=== 2. Start frontend ==="
nohup npm run dev -- --host 0.0.0.0 --port 3000 > /tmp/frontend.log 2>&1 &
sleep 5

echo "=== 3. Configure backend properly ==="
cd functions
cat > .runtimeconfig.json << 'CONFIG'
{
  "env": {
    "service_account": "{\"type\":\"service_account\",\"project_id\":\"local-dev\",\"client_email\":\"test@local.dev\",\"private_key\":\"-----BEGIN PRIVATE KEY-----\\nMOCK_KEY\\n-----END PRIVATE KEY-----\\n\"}"
  },
  "slack": {"webhook": "https://mock.slack.com"},
  "twilio": {"account_sid": "mock", "auth_token": "mock", "phone_number": "+1mock"},
  "send_grid": {"api_key": "mock"},
  "stripe": {"secret_key": "mock"}
}
CONFIG

echo "=== 4. Start backend ==="
nohup firebase emulators:start --only functions > /tmp/backend.log 2>&1 &
sleep 15

echo "=== 5. Test localhost connectivity ==="
echo "Frontend accessible:"
curl -s http://localhost:3000/ | head -3

echo "Backend emulator accessible:"
curl -s http://localhost:4000/ | head -3

echo "Functions endpoint accessible:"
curl -s -I http://localhost:5002/ | head -3

echo "=== 6. The key test - are functions actually loaded? ==="
# Check the backend log for function loading
if grep -q "exports.seo" /tmp/backend.log 2>/dev/null; then
    echo "✅ Functions are loaded - localhost connectivity proven!"
else
    echo "❌ Functions still not loading - config issue remains"
    echo "Backend log excerpt:"
    tail -10 /tmp/backend.log 2>/dev/null
fi

EOF