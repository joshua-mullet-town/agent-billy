#!/bin/bash
# Local test of Billy Coordinator Workflow
# Simulates the VM-coordinator interaction without creating actual VMs

VM_ID="test-vm-local-$(date +%s)"
COORDINATOR_URL="http://localhost:3000/coordinator/next-step"
ISSUE_CONTEXT="Issue #1119: Update README.md to include setup instructions for local development"

echo "🧪 BILLY COORDINATOR LOCAL TEST"
echo "======================================"
echo "VM ID: $VM_ID"
echo "Coordinator URL: $COORDINATOR_URL"
echo "Issue: $ISSUE_CONTEXT"
echo ""

# Function to call coordinator and get next prompt
get_next_prompt() {
  local recent_output="$1"
  local current_step="$2"
  
  echo "🤖 Calling coordinator for next step..."
  echo "   Current step: $current_step"
  echo "   Recent output: ${recent_output:0:50}..."
  
  response=$(curl -s -X POST "$COORDINATOR_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"vm_id\": \"$VM_ID\",
      \"issue_context\": \"$ISSUE_CONTEXT\",
      \"recent_output\": \"$recent_output\",
      \"current_step\": \"$current_step\"
    }")
    
  if [ $? -eq 0 ]; then
    echo "   Response: $response"
    echo "$response" | jq -r '.next_prompt' 2>/dev/null || echo "$response"
  else
    echo "   ❌ Error calling coordinator endpoint"
    echo "COORDINATOR_ERROR"
  fi
}

# Function to simulate Claude CLI interaction
simulate_claude_cli() {
  local prompt="$1"
  echo ""
  echo "💬 Claude CLI Prompt:"
  echo "   $prompt"
  echo ""
  echo "🤖 Claude CLI Execution (simulated):"
  
  # Simulate different responses based on prompt content
  if [[ "$prompt" == *"implement"* ]] || [[ "$prompt" == *"code"* ]] || [[ "$prompt" == *"README"* ]]; then
    echo "   📝 Reading issue requirements..."
    echo "   📝 Updating README.md with setup instructions..."
    echo "   ✅ Successfully updated README.md with local development setup"
    echo "   ✅ Changes written to file: README.md"
    echo "Successfully updated README.md with setup instructions"
  elif [[ "$prompt" == *"test"* ]] || [[ "$prompt" == *"playwright"* ]]; then
    echo "   🧪 Starting Playwright MCP..."
    echo "   🧪 Running smoke tests on localhost:3000..."
    echo "   ✅ All tests passed successfully"
    echo "   ✅ Frontend is responsive and functional"
    echo "All tests passed successfully"
  elif [[ "$prompt" == *"pull request"* ]] || [[ "$prompt" == *"PR"* ]]; then
    echo "   🔀 Committing changes..."
    echo "   🔀 Creating pull request via GitHub CLI..."
    echo "   ✅ Pull request #42 created successfully"
    echo "   ✅ PR title: 'Update README.md with local development setup'"
    echo "Pull request #42 created successfully"
  else
    echo "   ℹ️  Processing request..."
    echo "   ✅ Request processed"
    echo "Request processed: $prompt"
  fi
}

# Check if local server is running
echo "🔍 Checking if local coordinator server is running..."
if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
  echo "❌ Local server not running on port 3000"
  echo "   Start server with: npm run start"
  exit 1
fi
echo "✅ Local server is running"
echo ""

# Main workflow loop
echo "🚀 Starting Coordinator Workflow Test"
echo ""

step_count=0
max_steps=5
current_step="initial"
recent_output="Starting Claude CLI session... Ready for input"

while [ $step_count -lt $max_steps ]; do
  step_count=$((step_count + 1))
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔄 STEP $step_count: Coordinator Decision Point"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  # Get next prompt from coordinator
  next_prompt=$(get_next_prompt "$recent_output" "$current_step")
  
  # Check if workflow is complete
  if [[ "$next_prompt" == *"WORKFLOW_COMPLETE"* ]]; then
    echo ""
    echo "🎉 WORKFLOW COMPLETED SUCCESSFULLY!"
    echo "   The coordinator determined all tasks are finished."
    break
  fi
  
  # Check for coordinator errors
  if [[ "$next_prompt" == *"error"* ]] || [[ "$next_prompt" == *"Error"* ]] || [[ "$next_prompt" == "COORDINATOR_ERROR" ]]; then
    echo ""
    echo "❌ COORDINATOR ERROR: $next_prompt"
    echo "   This could be due to:"
    echo "   - Local server not running properly"
    echo "   - LLM API key issues"
    echo "   - Network connectivity problems"
    break
  fi
  
  # Simulate Claude CLI execution
  recent_output=$(simulate_claude_cli "$next_prompt")
  
  # Update current step based on output
  if [[ "$recent_output" == *"updated README"* ]]; then
    current_step="coding_complete"
  elif [[ "$recent_output" == *"tests passed"* ]]; then
    current_step="testing_complete"
  elif [[ "$recent_output" == *"pull request"* ]]; then
    current_step="pr_complete"
  fi
  
  echo ""
  echo "📊 Step $step_count Summary:"
  echo "   ✅ Coordinator provided guidance"
  echo "   ✅ Claude CLI executed task"
  echo "   ✅ Current step: $current_step"
  
  # Brief pause between steps for readability
  sleep 2
done

echo ""
echo "📋 FINAL WORKFLOW SUMMARY"
echo "=========================="
echo "Steps completed: $step_count"
echo "Final step: $current_step"
echo "Final output: $recent_output"
echo ""

if [ $step_count -eq $max_steps ]; then
  echo "⚠️  Workflow reached maximum step limit"
  echo "   This might indicate an issue with coordinator logic"
else
  echo "✅ Workflow completed within expected steps"
fi

echo ""
echo "🔍 Next steps to test on actual VM:"
echo "   1. Deploy coordinator to Railway (once cache issues resolved)"
echo "   2. Update VM cloud-init script with coordinator logic"
echo "   3. Test full end-to-end workflow with real Claude CLI"
echo ""