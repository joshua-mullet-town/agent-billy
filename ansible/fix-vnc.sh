#!/bin/bash

# Fix VNC connection issues on the VM

echo "🔧 Fixing VNC Connection Issues"
echo "==============================="

VM_IP="174.138.71.207"
SSH_KEY="~/.ssh/id_ed25519_digital_ocean"

echo "📡 Connecting to VM and restarting VNC services..."

ssh -i $SSH_KEY root@$VM_IP << 'EOF'
echo "=== Stopping all GUI processes ==="
pkill -f x11vnc || true
pkill -f fluxbox || true  
pkill -f vite || true
pkill -f node || true

echo "=== Cleaning up ==="
sleep 2

echo "=== Starting GUI services ==="
export DISPLAY=:99

# Start window manager
DISPLAY=:99 fluxbox &
sleep 3

# Start VNC server without password for easier connection
DISPLAY=:99 x11vnc -display :99 -forever -shared -bg -nopw -xkb

echo "=== Service Status ==="
ps aux | grep -E "(vnc|fluxbox|Xvfb)" | grep -v grep

echo "=== VNC Connection Info ==="
echo "VNC Server should be running on:"
echo "- Direct VNC: $VM_IP:5900"  
echo "- Web VNC: http://$VM_IP:6080/vnc.html"

echo "✅ VNC services restarted!"
EOF

echo ""
echo "🎯 Try connecting to VNC now:"
echo "   VNC Viewer: $VM_IP:5900"
echo "   Web Browser: http://$VM_IP:6080/vnc.html"