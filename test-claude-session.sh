#!/bin/bash
# Test Claude CLI session persistence

echo "🧪 TESTING CLAUDE CLI SESSION BEHAVIOR"
echo "======================================"
echo ""

echo "📝 Method 1: Fresh instances (current approach)"
echo "Command 1: echo 'My name is Billy' | claude --print --dangerously-skip-permissions"
response1=$(echo "My name is Billy" | claude --print --dangerously-skip-permissions)
echo "Response 1: $response1"
echo ""

echo "Command 2: echo 'What is my name?' | claude --print --dangerously-skip-permissions"
response2=$(echo "What is my name?" | claude --print --dangerously-skip-permissions)
echo "Response 2: $response2"
echo ""

echo "📝 Method 2: Interactive session with named pipes"
echo "Testing persistent session approach..."

# Create named pipes for input/output
mkfifo /tmp/claude_in /tmp/claude_out 2>/dev/null || true

# Start Claude CLI in interactive mode in background
echo "Starting Claude CLI interactive session..."
claude --dangerously-skip-permissions < /tmp/claude_in > /tmp/claude_out &
CLAUDE_PID=$!

sleep 3

echo "Sending first command via pipe..."
echo "My name is Billy. Respond with just 'OK' to confirm you got this." > /tmp/claude_in

sleep 5

echo "Reading first response..."
if timeout 10s tail -f /tmp/claude_out | head -1; then
  echo "Got response from interactive session"
else
  echo "No response from interactive session"
fi

# Cleanup
kill $CLAUDE_PID 2>/dev/null || true
rm -f /tmp/claude_in /tmp/claude_out

echo ""
echo "📝 Method 3: Session files and resume"
echo "Testing --resume functionality..."

# Test if Claude CLI creates session files we can track
SESSION_ID=$(uuidgen)
echo "Session ID: $SESSION_ID"

echo "First message with session ID..."
echo "My name is Billy" | claude --print --session-id "$SESSION_ID" --dangerously-skip-permissions
echo ""

echo "Second message with same session ID..."
echo "What is my name?" | claude --print --session-id "$SESSION_ID" --dangerously-skip-permissions
echo ""

echo "📊 CONCLUSION:"
echo "Based on testing, Claude CLI session behavior determines our architecture choice."