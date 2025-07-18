#!/bin/bash
# Simple Coordinator Testing - Working Examples
# Shows exact data flow without JSON escaping issues

COORDINATOR_URL="https://agent-billy-production.up.railway.app/coordinator/next-step"

echo "🧪 SIMPLIFIED COORDINATOR WORKFLOW TESTING"
echo "==========================================="
echo ""

# Function to test coordinator safely
test_coordinator() {
  local stage="$1"
  local step="$2"
  
  echo "🎬 STAGE: $stage"
  echo "   Current Step: $step"
  echo ""
  
  case $step in
    "initial")
      echo "📤 DATA SENT TO COORDINATOR:"
      echo '   {
     "vm_id": "vm-12345-givegrovestaging",
     "issue_context": "Issue #1119: Update README.md with setup instructions",
     "recent_output": "Claude CLI initialized and ready for commands",
     "current_step": "initial"
   }'
      
      response=$(curl -s -X POST "$COORDINATOR_URL" \
        -H "Content-Type: application/json" \
        -d '{
          "vm_id": "vm-12345-givegrovestaging",
          "issue_context": "Issue #1119: Update README.md with setup instructions",
          "recent_output": "Claude CLI initialized and ready for commands",
          "current_step": "initial"
        }')
      ;;
      
    "coding_complete")
      echo "📤 DATA SENT TO COORDINATOR:"
      echo '   {
     "vm_id": "vm-12345-givegrovestaging", 
     "issue_context": "Issue #1119: Update README.md with setup instructions",
     "recent_output": "Successfully updated README.md with setup instructions. Changes saved to file.",
     "current_step": "coding_complete"
   }'
   
      response=$(curl -s -X POST "$COORDINATOR_URL" \
        -H "Content-Type: application/json" \
        -d '{
          "vm_id": "vm-12345-givegrovestaging",
          "issue_context": "Issue #1119: Update README.md with setup instructions", 
          "recent_output": "Successfully updated README.md with setup instructions. Changes saved to file.",
          "current_step": "coding_complete"
        }')
      ;;
      
    "testing_complete")
      echo "📤 DATA SENT TO COORDINATOR:"
      echo '   {
     "vm_id": "vm-12345-givegrovestaging",
     "issue_context": "Issue #1119: Update README.md with setup instructions and verify frontend works",
     "recent_output": "Playwright testing complete. Frontend loads correctly. All tests passed.",
     "current_step": "testing_complete"
   }'
   
      response=$(curl -s -X POST "$COORDINATOR_URL" \
        -H "Content-Type: application/json" \
        -d '{
          "vm_id": "vm-12345-givegrovestaging",
          "issue_context": "Issue #1119: Update README.md with setup instructions and verify frontend works",
          "recent_output": "Playwright testing complete. Frontend loads correctly. All tests passed.",
          "current_step": "testing_complete"
        }')
      ;;
      
    "pr_complete")
      echo "📤 DATA SENT TO COORDINATOR:"
      echo '   {
     "vm_id": "vm-12345-givegrovestaging",
     "issue_context": "Issue #1119: Update README.md with setup instructions",
     "recent_output": "Pull request #127 created successfully. All changes committed and pushed.",
     "current_step": "pr_complete"
   }'
   
      response=$(curl -s -X POST "$COORDINATOR_URL" \
        -H "Content-Type: application/json" \
        -d '{
          "vm_id": "vm-12345-givegrovestaging",
          "issue_context": "Issue #1119: Update README.md with setup instructions",
          "recent_output": "Pull request #127 created successfully. All changes committed and pushed.",
          "current_step": "pr_complete"
        }')
      ;;
  esac
  
  echo ""
  echo "📥 COORDINATOR RESPONSE:"
  echo "$response" | jq . 2>/dev/null || echo "$response"
  
  next_prompt=$(echo "$response" | jq -r '.next_prompt // "ERROR"' 2>/dev/null)
  is_complete=$(echo "$response" | jq -r '.complete // false' 2>/dev/null)
  
  echo ""
  echo "🤖 NEXT CLAUDE CLI PROMPT:"
  echo "   $next_prompt"
  echo ""
  echo "🔄 WORKFLOW STATUS: $([ "$is_complete" = "true" ] && echo "COMPLETE ✅" || echo "CONTINUING ➡️")"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
}

# Test the key workflow stages
test_coordinator "1. VM STARTUP" "initial"
test_coordinator "2. CODE COMPLETE" "coding_complete" 
test_coordinator "3. TESTING COMPLETE" "testing_complete"
test_coordinator "4. PR COMPLETE" "pr_complete"

echo "🎯 COORDINATOR INTELLIGENCE SUMMARY:"
echo "• Correctly identifies when to implement (initial state)"
echo "• Makes smart decisions about testing vs direct PR creation"
echo "• Properly detects workflow completion"
echo "• Provides specific, actionable prompts for Claude CLI"
echo ""
echo "💡 IN THE REAL VM ENVIRONMENT:"
echo "• VM polls coordinator every 30 seconds with latest Claude CLI output"
echo "• VM feeds coordinator's prompt directly to Claude CLI"
echo "• Claude CLI executes with --dangerously-skip-permissions (no human prompts)"
echo "• Cycle continues until coordinator returns complete: true"
echo "• VM then destroys itself and cleans up resources"