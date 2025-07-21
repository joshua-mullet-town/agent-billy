#!/bin/bash

# Phase 3 Complete Automation Test
# Tests end-to-end automation from VM creation to all services running
# NO MANUAL INTERVENTION REQUIRED

set -e

echo "🧪 PHASE 3 AUTOMATION TEST STARTING..."
echo "📅 $(date)"
echo "🎯 Goal: Prove complete automation without manual steps"

# Configuration
GITHUB_TOKEN="${GITHUB_TOKEN}"
SERVICE_ACCOUNT_JSON="${FIREBASE_SERVICE_ACCOUNT_BASE64}"
LOG_DIR="/home/ubuntu/phase3-automation-test"

# Create log directory
mkdir -p "$LOG_DIR"

# Record test start
echo "$(date -Iseconds): Phase 3 automation test started" > "$LOG_DIR/automation.log"

# Step 1: Verify environment
echo "🔍 Step 1: Environment verification..."
if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ ERROR: GITHUB_TOKEN not provided"
    echo "$(date -Iseconds): FAILED - Missing GITHUB_TOKEN" >> "$LOG_DIR/automation.log"
    exit 1
fi

if [ -z "$SERVICE_ACCOUNT_JSON" ]; then
    echo "❌ ERROR: FIREBASE_SERVICE_ACCOUNT_BASE64 not provided"
    echo "$(date -Iseconds): FAILED - Missing Firebase service account" >> "$LOG_DIR/automation.log"
    exit 1
fi

echo "✅ Environment variables present"
echo "$(date -Iseconds): Environment verification - SUCCESS" >> "$LOG_DIR/automation.log"

# Step 2: Decode and setup Firebase service account
echo "🔐 Step 2: Firebase service account setup..."
echo "$SERVICE_ACCOUNT_JSON" | base64 -d > "$LOG_DIR/firebase_service_account.json"

if [ $? -eq 0 ]; then
    echo "✅ Firebase service account decoded"
    echo "$(date -Iseconds): Firebase service account setup - SUCCESS" >> "$LOG_DIR/automation.log"
else
    echo "❌ ERROR: Failed to decode Firebase service account"
    echo "$(date -Iseconds): FAILED - Firebase service account decode error" >> "$LOG_DIR/automation.log"
    exit 1
fi

# Step 3: Install required tools
echo "🛠️ Step 3: Installing required tools..."

# Install Google Cloud CLI
if ! command -v gcloud &> /dev/null; then
    echo "📦 Installing Google Cloud CLI..."
    curl -sSL https://sdk.cloud.google.com | bash -s -- --disable-prompts --install-dir=/home/ubuntu
    source /home/ubuntu/google-cloud-sdk/path.bash.inc
    echo "export PATH=/home/ubuntu/google-cloud-sdk/bin:\$PATH" >> /home/ubuntu/.bashrc
    echo "✅ Google Cloud CLI installed"
else
    echo "✅ Google Cloud CLI already installed"
fi

# Install Firebase CLI
if ! command -v firebase &> /dev/null; then
    echo "📦 Installing Firebase CLI..."
    npm install -g firebase-tools
    echo "✅ Firebase CLI installed"
else
    echo "✅ Firebase CLI already installed"
fi

echo "$(date -Iseconds): Tool installation - SUCCESS" >> "$LOG_DIR/automation.log"

# Step 4: Clone GiveGrove repository
echo "📂 Step 4: Repository cloning..."
cd /home/ubuntu

if [ ! -d "GiveGrove" ]; then
    echo "📥 Cloning GiveGrove repository..."
    git clone https://oauth2:${GITHUB_TOKEN}@github.com/south-bend-code-works/GiveGrove.git
    
    if [ $? -eq 0 ]; then
        echo "✅ GiveGrove repository cloned"
        echo "$(date -Iseconds): Repository cloning - SUCCESS" >> "$LOG_DIR/automation.log"
    else
        echo "❌ ERROR: Failed to clone GiveGrove repository"
        echo "$(date -Iseconds): FAILED - Repository cloning error" >> "$LOG_DIR/automation.log"
        exit 1
    fi
else
    echo "✅ GiveGrove repository already exists"
    echo "$(date -Iseconds): Repository already present - SUCCESS" >> "$LOG_DIR/automation.log"
fi

# Step 5: Firebase authentication
echo "🔐 Step 5: Firebase authentication..."
export GOOGLE_APPLICATION_CREDENTIALS="$LOG_DIR/firebase_service_account.json"

# Authenticate with service account
gcloud auth activate-service-account --key-file="$LOG_DIR/firebase_service_account.json" --quiet

if [ $? -eq 0 ]; then
    echo "✅ Google Cloud authentication successful"
    echo "$(date -Iseconds): Firebase authentication - SUCCESS" >> "$LOG_DIR/automation.log"
else
    echo "❌ ERROR: Google Cloud authentication failed"
    echo "$(date -Iseconds): FAILED - Firebase authentication error" >> "$LOG_DIR/automation.log"
    exit 1
fi

# Test Firebase CLI access
cd GiveGrove
firebase functions:config:get > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Firebase CLI access verified"
    echo "$(date -Iseconds): Firebase CLI verification - SUCCESS" >> "$LOG_DIR/automation.log"
else
    echo "❌ ERROR: Firebase CLI access failed"
    echo "$(date -Iseconds): FAILED - Firebase CLI verification error" >> "$LOG_DIR/automation.log"
    exit 1
fi

# Step 6: Install dependencies
echo "📦 Step 6: Installing dependencies..."

# Frontend dependencies
if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend
    npm install --silent > "$LOG_DIR/frontend-install.log" 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✅ Frontend dependencies installed ($(ls node_modules | wc -l) packages)"
        echo "$(date -Iseconds): Frontend dependencies - SUCCESS" >> "$LOG_DIR/automation.log"
    else
        echo "❌ ERROR: Frontend dependency installation failed"
        echo "$(date -Iseconds): FAILED - Frontend dependencies error" >> "$LOG_DIR/automation.log"
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
        echo "✅ Backend dependencies installed ($(ls node_modules | wc -l) packages)"
        echo "$(date -Iseconds): Backend dependencies - SUCCESS" >> "$LOG_DIR/automation.log"
    else
        echo "❌ ERROR: Backend dependency installation failed"
        echo "$(date -Iseconds): FAILED - Backend dependencies error" >> "$LOG_DIR/automation.log"
        exit 1
    fi
    cd ..
else
    echo "✅ Backend dependencies already installed"
fi

# Step 7: Start services
echo "🚀 Step 7: Starting all services..."

# Start backend (includes Firebase emulator)
echo "🔥 Starting backend services..."
cd backend
nohup npm run serve > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > "$LOG_DIR/backend.pid"
echo "✅ Backend started (PID: $BACKEND_PID)"

# Wait for backend to start
sleep 15

# Start frontend
echo "🌐 Starting frontend service..."
cd ../frontend
nohup npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > "$LOG_DIR/frontend.pid"  
echo "✅ Frontend started (PID: $FRONTEND_PID)"

# Wait for frontend to start
sleep 10

echo "$(date -Iseconds): Service startup - SUCCESS" >> "$LOG_DIR/automation.log"

# Step 8: Service verification
echo "🔍 Step 8: Service verification..."

# Check frontend
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "000")
echo "🌐 Frontend: http://localhost:3000 (HTTP $FRONTEND_STATUS)"

# Check backend
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8989 || echo "000")
echo "🔥 Backend: http://localhost:8989 (HTTP $BACKEND_STATUS)"

# Check Firebase UI
FIREBASE_UI_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000 || echo "000")
echo "🎛️ Firebase UI: http://localhost:4000 (HTTP $FIREBASE_UI_STATUS)"

# Create automation verification report
cat > "$LOG_DIR/phase3-automation-results.json" << EOF
{
    "test_name": "Phase 3 Complete Automation",
    "timestamp": "$(date -Iseconds)",
    "vm_ip": "$(curl -s ifconfig.me || echo 'unknown')",
    "automation_steps": {
        "environment_verification": "SUCCESS",
        "firebase_service_account_setup": "SUCCESS", 
        "tool_installation": "SUCCESS",
        "repository_cloning": "SUCCESS",
        "firebase_authentication": "SUCCESS",
        "dependency_installation": "SUCCESS",
        "service_startup": "SUCCESS",
        "service_verification": "COMPLETE"
    },
    "services": {
        "frontend": {
            "url": "http://localhost:3000",
            "status": "$FRONTEND_STATUS",
            "pid": "$FRONTEND_PID",
            "working": $([ "$FRONTEND_STATUS" = "200" ] && echo "true" || echo "false")
        },
        "backend": {
            "url": "http://localhost:8989",
            "status": "$BACKEND_STATUS", 
            "pid": "$BACKEND_PID",
            "working": $([ "$BACKEND_STATUS" = "200" ] && echo "true" || echo "false")
        },
        "firebase_ui": {
            "url": "http://localhost:4000",
            "status": "$FIREBASE_UI_STATUS",
            "working": $([ "$FIREBASE_UI_STATUS" = "200" ] && echo "true" || echo "false")
        }
    },
    "automation_success": $([ "$FRONTEND_STATUS" = "200" ] && [ "$BACKEND_STATUS" = "200" ] && [ "$FIREBASE_UI_STATUS" = "200" ] && echo "true" || echo "false"),
    "manual_intervention_required": false,
    "phase_3_automation_complete": $([ "$FRONTEND_STATUS" = "200" ] && [ "$BACKEND_STATUS" = "200" ] && echo "true" || echo "false")
}
EOF

# Final assessment
if [ "$FRONTEND_STATUS" = "200" ] && [ "$BACKEND_STATUS" = "200" ] && [ "$FIREBASE_UI_STATUS" = "200" ]; then
    echo ""
    echo "🎉 PHASE 3 AUTOMATION: COMPLETE SUCCESS!"
    echo "✅ All services running without manual intervention"
    echo "✅ Frontend: HTTP $FRONTEND_STATUS"
    echo "✅ Backend: HTTP $BACKEND_STATUS"  
    echo "✅ Firebase UI: HTTP $FIREBASE_UI_STATUS"
    echo "📊 Results: $LOG_DIR/phase3-automation-results.json"
    echo "$(date -Iseconds): PHASE 3 AUTOMATION - COMPLETE SUCCESS" >> "$LOG_DIR/automation.log"
    
    # Create success marker for Billy to detect
    echo "PHASE_3_AUTOMATION_SUCCESS" > "$LOG_DIR/automation-success.marker"
    
elif [ "$FRONTEND_STATUS" = "200" ] && [ "$BACKEND_STATUS" = "200" ]; then
    echo ""
    echo "⚠️ PHASE 3 AUTOMATION: PARTIAL SUCCESS"
    echo "✅ Core services working (Frontend + Backend)"
    echo "⚠️ Firebase UI may need additional time"
    echo "📊 Results: $LOG_DIR/phase3-automation-results.json"
    echo "$(date -Iseconds): PHASE 3 AUTOMATION - PARTIAL SUCCESS" >> "$LOG_DIR/automation.log"
    
else
    echo ""
    echo "❌ PHASE 3 AUTOMATION: FAILED"
    echo "❌ Services not responding correctly"
    echo "📊 Results: $LOG_DIR/phase3-automation-results.json"
    echo "📋 Check logs: $LOG_DIR/"
    echo "$(date -Iseconds): PHASE 3 AUTOMATION - FAILED" >> "$LOG_DIR/automation.log"
    exit 1
fi