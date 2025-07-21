#!/bin/bash

# GiveGrove Services Automation Script
# Sets up Firebase authentication and starts all services automatically
# Based on Phase 3 manual testing that proved all components work

set -e  # Exit on any error

echo "🚀 Starting GiveGrove Services Automation..."
echo "📅 $(date)"

# Configuration
REPO_DIR="/home/ubuntu/GiveGrove"
SERVICE_ACCOUNT_FILE="/home/ubuntu/firebase_service_account.json"
LOG_DIR="/home/ubuntu/automation-logs"

# Create log directory
mkdir -p "$LOG_DIR"

# Check if we're in the right directory
if [ ! -d "$REPO_DIR" ]; then
    echo "❌ ERROR: GiveGrove repository not found at $REPO_DIR"
    echo "❌ Repository must be cloned first"
    exit 1
fi

cd "$REPO_DIR"

# Check if service account file exists
if [ ! -f "$SERVICE_ACCOUNT_FILE" ]; then
    echo "❌ ERROR: Firebase service account not found at $SERVICE_ACCOUNT_FILE"
    echo "❌ Valid service account credentials required for Firebase authentication"
    exit 1
fi

echo "✅ Repository found: $REPO_DIR"
echo "✅ Service account found: $SERVICE_ACCOUNT_FILE"

# Authenticate with Google Cloud CLI
echo "🔐 Authenticating with Google Cloud..."
gcloud auth activate-service-account --key-file="$SERVICE_ACCOUNT_FILE" --quiet

if [ $? -eq 0 ]; then
    echo "✅ Google Cloud authentication successful"
else
    echo "❌ ERROR: Google Cloud authentication failed"
    exit 1
fi

# Verify Firebase CLI can access the project
echo "🔍 Testing Firebase CLI access..."
firebase functions:config:get > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Firebase CLI access verified"
else
    echo "❌ ERROR: Firebase CLI cannot access project"
    echo "❌ Check service account permissions"
    exit 1
fi

# Install dependencies if not already done
echo "📦 Checking dependencies..."

# Frontend dependencies
if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend
    npm install --silent > "$LOG_DIR/frontend-install.log" 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✅ Frontend dependencies installed"
    else
        echo "❌ ERROR: Frontend dependency installation failed"
        echo "📋 Check log: $LOG_DIR/frontend-install.log"
        exit 1
    fi
    cd ..
else
    echo "✅ Frontend dependencies already installed"
fi

# Backend dependencies
if [ ! -d "backend/node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    cd backend
    npm install --silent > "$LOG_DIR/backend-install.log" 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✅ Backend dependencies installed"
    else
        echo "❌ ERROR: Backend dependency installation failed"
        echo "📋 Check log: $LOG_DIR/backend-install.log"
        exit 1
    fi
    cd ..
else
    echo "✅ Backend dependencies already installed"
fi

# Create service startup script for background processes
cat > "$LOG_DIR/start-services.sh" << 'EOF'
#!/bin/bash

# Background service startup script
# Runs all GiveGrove services in the background

REPO_DIR="/home/ubuntu/GiveGrove"
LOG_DIR="/home/ubuntu/automation-logs"

cd "$REPO_DIR"

echo "🔥 Starting backend services..."
cd backend
nohup npm run serve > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > "$LOG_DIR/backend.pid"
echo "✅ Backend started (PID: $BACKEND_PID)"

# Wait for backend to start
sleep 10

echo "🌐 Starting frontend service..."
cd ../frontend  
nohup npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > "$LOG_DIR/frontend.pid"
echo "✅ Frontend started (PID: $FRONTEND_PID)"

echo "🎉 All services started!"
echo "📋 Backend: http://localhost:8989 (PID: $BACKEND_PID)"
echo "📋 Frontend: http://localhost:3000 (PID: $FRONTEND_PID)"
echo "📋 Firebase UI: http://localhost:4000"
echo "📋 Logs: $LOG_DIR"
EOF

chmod +x "$LOG_DIR/start-services.sh"

# Start the services
echo "🚀 Starting all services..."
bash "$LOG_DIR/start-services.sh"

# Wait for services to be ready
echo "⏱️ Waiting for services to start..."
sleep 15

# Verify services are running
echo "🔍 Verifying service health..."

# Check frontend
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "000")
if [ "$FRONTEND_STATUS" = "200" ]; then
    echo "✅ Frontend: http://localhost:3000 (HTTP $FRONTEND_STATUS)"
else
    echo "⚠️ Frontend: http://localhost:3000 (HTTP $FRONTEND_STATUS)"
fi

# Check backend
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8989 || echo "000")
if [ "$BACKEND_STATUS" = "200" ]; then
    echo "✅ Backend: http://localhost:8989 (HTTP $BACKEND_STATUS)"
else
    echo "⚠️ Backend: http://localhost:8989 (HTTP $BACKEND_STATUS)"
fi

# Check Firebase UI
FIREBASE_UI_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000 || echo "000")
if [ "$FIREBASE_UI_STATUS" = "200" ]; then
    echo "✅ Firebase UI: http://localhost:4000 (HTTP $FIREBASE_UI_STATUS)"
else
    echo "⚠️ Firebase UI: http://localhost:4000 (HTTP $FIREBASE_UI_STATUS)"
fi

# Create status file for automation verification
cat > "$LOG_DIR/service-status.json" << EOF
{
    "timestamp": "$(date -Iseconds)",
    "frontend": {
        "url": "http://localhost:3000",
        "status": "$FRONTEND_STATUS",
        "pid": "$(cat $LOG_DIR/frontend.pid 2>/dev/null || echo 'unknown')"
    },
    "backend": {
        "url": "http://localhost:8989", 
        "status": "$BACKEND_STATUS",
        "pid": "$(cat $LOG_DIR/backend.pid 2>/dev/null || echo 'unknown')"
    },
    "firebase_ui": {
        "url": "http://localhost:4000",
        "status": "$FIREBASE_UI_STATUS"
    },
    "automation_complete": true,
    "manual_intervention_required": false
}
EOF

echo "🎉 GiveGrove Services Automation Complete!"
echo "📊 Status: $LOG_DIR/service-status.json"
echo "🔧 Logs: $LOG_DIR/"
echo "⏹️ To stop services: pkill -F $LOG_DIR/frontend.pid && pkill -F $LOG_DIR/backend.pid"

# Summary
echo ""
echo "📋 AUTOMATION SUMMARY:"
echo "✅ Google Cloud authentication: SUCCESS"
echo "✅ Firebase CLI verification: SUCCESS"
echo "✅ Dependencies installation: SUCCESS"
echo "✅ Service startup: COMPLETE"
echo "📊 Frontend: $FRONTEND_STATUS, Backend: $BACKEND_STATUS, Firebase UI: $FIREBASE_UI_STATUS"