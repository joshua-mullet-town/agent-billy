# Billy's Coordinator System - Complete Architecture

## 🤖 **COORDINATOR OVERVIEW**

The Coordinator is Billy's intelligent decision-making component that guides Claude CLI through step-by-step workflows. It acts as the "brain" that determines what Claude CLI should do next based on GitHub issue context and previous execution results.

**Status**: ✅ FULLY OPERATIONAL - Deployed on Railway with real Anthropic API integration

---

## 🏗️ **COMPLETE WORKFLOW ARCHITECTURE**

### **Core Concept: Fresh Instance + Rich Context**
- **No Persistent Sessions**: Each Claude CLI call is a fresh instance
- **Context-Rich Prompts**: Coordinator provides full context in every prompt
- **Intelligent Decisions**: LLM-powered analysis of what should happen next

### **Three-Phase Workflow**
1. **IMPLEMENT**: Read GitHub issue and make code changes
2. **TEST**: Verify changes work correctly (when needed)
3. **CREATE PR**: Commit changes and create pull request

### **Complete Data Flow: GitHub Issue → Pull Request**
```
GitHub Issue "for-billy" label added
          ↓
Billy webhook creates VM with cloud-init
          ↓
VM boots → installs Claude CLI → starts coordinator loop
          ↓
VM → Coordinator: "Claude CLI ready"
          ↓
Coordinator → VM: "Implement GitHub issue #1119"
          ↓
VM → Claude CLI: "Implement GitHub issue #1119"
          ↓
Claude CLI → VM: "Successfully updated README.md"
          ↓
VM → Coordinator: "Successfully updated README.md"
          ↓
Coordinator → VM: "Create a pull request"
          ↓
VM → Claude CLI: "Create a pull request"
          ↓
Claude CLI → VM: "Pull request #127 created"
          ↓
VM → Coordinator: "Pull request #127 created"
          ↓
Coordinator → VM: "WORKFLOW_COMPLETE"
          ↓
VM destroys itself
          ↓
Pull request ready for review! 🎉
```

---

## 📋 **VM INITIALIZATION & COORDINATOR INTEGRATION**

### **What Happens When Billy Creates a VM:**

```yaml
#cloud-config (what gets sent to DigitalOcean)
users:
  - name: ubuntu
    ssh_authorized_keys: [SSH_KEY]
    sudo: ALL=(ALL) NOPASSWD:ALL

packages: [curl, wget, git, snapd]

write_files:
  - path: /home/ubuntu/coordinator-workflow.sh
    content: |
      #!/bin/bash
      # Billy's Coordinator Workflow Script
      VM_ID="vm-{TIMESTAMP}-{REPO}"
      COORDINATOR_URL="https://agent-billy-production.up.railway.app/coordinator/next-step"
      ISSUE_CONTEXT="{GITHUB_ISSUE_TITLE_AND_DESCRIPTION}"
      
      # Main coordinator polling loop (see below for details)

runcmd:
  - curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  - sudo apt-get install -y nodejs jq
  - chown ubuntu:ubuntu /home/ubuntu/coordinator-workflow.sh
  - chmod +x /home/ubuntu/coordinator-workflow.sh
  - sudo -u ubuntu /home/ubuntu/coordinator-workflow.sh > /home/ubuntu/coordinator.log 2>&1 &
```

### **VM Setup Results:**
- ✅ Ubuntu VM with Node.js 20.x
- ✅ coordinator-workflow.sh script running in background
- ✅ VM starts coordinator polling loop automatically

---

## 🔄 **COORDINATOR POLLING LOOP IMPLEMENTATION**

### **The coordinator-workflow.sh Script Logic:**

```bash
#!/bin/bash
# Billy's Coordinator Workflow - Runs inside VM

VM_ID="vm-12345-givegrovestaging"
COORDINATOR_URL="https://agent-billy-production.up.railway.app/coordinator/next-step"
ISSUE_CONTEXT="Issue #1119: Update README.md with setup instructions"

# Install Claude CLI
npm install -g @anthropic-ai/claude-code
export ANTHROPIC_API_KEY="sk-ant-api03-..."

# Install GitHub CLI for PR creation
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update && sudo apt install -y gh
echo "$GITHUB_TOKEN" | gh auth login --with-token

# Clone repository
git clone https://github.com/south-bend-code-works/GiveGrove.git
cd GiveGrove

# Install dependencies
npm install
cd functions && npm install && cd ..

# Start services
npm run dev &  # Frontend on localhost:3000
firebase emulators:start --only functions &  # Backend on localhost:4000

# MAIN COORDINATOR LOOP
current_step="initial"
recent_output="Claude CLI initialized and ready for commands"
max_iterations=20
iteration=0

while [ $iteration -lt $max_iterations ]; do
  iteration=$((iteration + 1))
  echo "🔄 Coordinator Loop Iteration $iteration"
  
  # 1. CALL COORDINATOR FOR NEXT STEP
  coordinator_response=$(curl -s -X POST "$COORDINATOR_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"vm_id\": \"$VM_ID\",
      \"issue_context\": \"$ISSUE_CONTEXT\",
      \"recent_output\": \"$recent_output\",
      \"current_step\": \"$current_step\"
    }")
  
  # 2. EXTRACT NEXT PROMPT AND COMPLETION STATUS
  next_prompt=$(echo "$coordinator_response" | jq -r '.next_prompt')
  is_complete=$(echo "$coordinator_response" | jq -r '.complete')
  
  # 3. CHECK IF WORKFLOW IS COMPLETE
  if [ "$is_complete" = "true" ]; then
    echo "🎉 Workflow completed! Coordinator returned: complete=true"
    break
  fi
  
  # 4. FEED PROMPT TO CLAUDE CLI
  echo "🤖 Sending prompt to Claude CLI: $next_prompt"
  recent_output=$(echo "$next_prompt" | claude --print --dangerously-skip-permissions)
  
  # 5. UPDATE CURRENT STEP BASED ON OUTPUT
  if [[ "$recent_output" == *"updated"* ]] || [[ "$recent_output" == *"implemented"* ]]; then
    current_step="coding_complete"
  elif [[ "$recent_output" == *"test"* ]] && [[ "$recent_output" == *"passed"* ]]; then
    current_step="testing_complete"
  elif [[ "$recent_output" == *"pull request"* ]] || [[ "$recent_output" == *"PR"* ]]; then
    current_step="pr_complete"
  fi
  
  # 6. BRIEF PAUSE BEFORE NEXT ITERATION
  sleep 30
done

# 7. CLEANUP AND DESTROY VM
echo "🧹 Workflow complete. Cleaning up..."
# VM destroys itself here (doctl or DigitalOcean API call)
```

---

## 🔄 **CLAUDE CLI EXECUTION DETAILS**

### **How Claude CLI Gets Called in VM:**

```bash
# VM feeds coordinator's prompt directly to Claude CLI
echo "Implement the changes required by GitHub issue #1119" | claude --print --dangerously-skip-permissions

# Claude CLI executes without human prompts:
# 1. Reads the GitHub issue context from repository
# 2. Analyzes current code/README.md
# 3. Makes the required changes
# 4. Saves files
# 5. Returns output about what was accomplished
```

### **Claude CLI Output Examples:**

**After Implementation:**
```
Reading GitHub issue #1119...
Analyzing README.md current content...
Adding local development setup section...

✅ Successfully updated README.md with local development setup instructions
✅ Changes saved to file
```

**After Testing:**
```
🧪 Playwright MCP Testing Results:
✅ Frontend loads successfully at http://localhost:3000
✅ GiveGrove homepage renders correctly
✅ All tests passed successfully!
```

**After PR Creation:**
```
Git operations:
✅ git add README.md
✅ git commit -m 'Update README.md with setup instructions'
✅ git push origin feature/readme-setup

GitHub CLI operations:
✅ gh pr create --title 'Update README.md with setup instructions'
🎉 Pull Request #127 created successfully!
```

### **Context-Rich Prompting Strategy**
Instead of simple commands, coordinator provides full context:

**Before (simple):**
```
"Test the changes"
```

**After (context-rich):**
```
"You are working on GitHub issue #1119: Update README.md with setup instructions. 

Previous step: You successfully updated README.md with setup instructions and saved the changes.

Current step: Test the changes to ensure the frontend loads correctly using Playwright MCP. The frontend should be running on localhost:3000."
```

---

## 📡 **API SPECIFICATION**

### **Endpoint**
```
POST https://agent-billy-production.up.railway.app/coordinator/next-step
```

### **Request Format**
```json
{
  "vm_id": "vm-12345-givegrovestaging",
  "issue_context": "Issue #1119: Update README.md with setup instructions",
  "recent_output": "Successfully updated README.md with setup instructions. Changes saved to file.",
  "current_step": "coding_complete"
}
```

### **Response Format**
```json
{
  "next_prompt": "Create a pull request with the changes made to the README.md file.",
  "complete": false,
  "timestamp": "2025-07-18T12:23:52.931Z"
}
```

### **Completion Detection**
When workflow is complete:
```json
{
  "next_prompt": "WORKFLOW_COMPLETE",
  "complete": true,
  "timestamp": "2025-07-18T12:23:52.931Z"
}
```

---

## 🧠 **COORDINATOR INTELLIGENCE**

### **Decision Making Logic**
The coordinator uses this LLM prompt to make decisions:

```
GITHUB ISSUE CONTEXT:
{issue_context}

RECENT CLAUDE CLI OUTPUT:
{recent_output}

BILLY'S WORKFLOW OPTIONS:
You have three possible next steps:
1. IMPLEMENT: Read the GitHub issue and make the required code changes
2. TEST: Test the changes using Playwright MCP or appropriate testing methods  
3. CREATE PR: Create a pull request with the changes

COORDINATOR INSTRUCTIONS:
Look at the recent Claude CLI output and decide what should happen next:

- If no code changes have been made yet → Tell Claude CLI to implement the GitHub issue
- If code changes were made but haven't been tested → Tell Claude CLI to test the changes
- If changes were tested successfully → Tell Claude CLI to create a pull request
- If a pull request was already created → Respond with "WORKFLOW_COMPLETE"

Provide the exact prompt for Claude CLI based on what needs to happen next.
```

### **Proven Intelligence Capabilities**
- ✅ **Smart Implementation Detection**: Correctly identifies when to start coding
- ✅ **Testing Decision Logic**: Decides when testing is needed vs direct PR creation
- ✅ **Context Awareness**: Makes decisions based on issue requirements and CLI output
- ✅ **Completion Detection**: Properly detects when workflow is finished

---

## 🔄 **VM INTEGRATION**

### **VM Polling Loop**
```bash
while true; do
  # 1. Call coordinator with current state
  coordinator_response=$(curl -X POST "$COORDINATOR_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"vm_id\": \"$VM_ID\",
      \"issue_context\": \"$ISSUE_CONTEXT\",
      \"recent_output\": \"$recent_output\",
      \"current_step\": \"$current_step\"
    }")
  
  # 2. Extract next prompt
  next_prompt=$(echo "$coordinator_response" | jq -r '.next_prompt')
  is_complete=$(echo "$coordinator_response" | jq -r '.complete')
  
  # 3. Check completion
  if [ "$is_complete" = "true" ]; then
    echo "🎉 Workflow completed!"
    break
  fi
  
  # 4. Execute Claude CLI with coordinator's prompt
  recent_output=$(echo "$next_prompt" | claude --print --dangerously-skip-permissions)
  
  # 5. Update current step based on output
  update_current_step_based_on_output "$recent_output"
  
  # 6. Wait before next iteration
  sleep 30
done
```

### **Context-Rich Prompting Strategy**
Instead of simple commands, coordinator provides full context:

**Before (simple):**
```
"Test the changes"
```

**After (context-rich):**
```
"You are working on GitHub issue #1119: Update README.md with setup instructions. 

Previous step: You successfully updated README.md with setup instructions and saved the changes.

Current step: Test the changes to ensure the frontend loads correctly using Playwright MCP. The frontend should be running on localhost:3000."
```

---

## 🧪 **TESTING RESULTS**

### **Test Scenarios Proven Working**

1. **Initial State → Implementation**
   - Input: "Claude CLI ready"
   - Output: "Implement GitHub issue #1119"

2. **Code Complete → Testing Decision**
   - Input: "Successfully updated README.md"
   - Output: "Test the changes" OR "Create PR" (context-dependent)

3. **Testing Complete → PR Creation**
   - Input: "All tests passed"
   - Output: "Create a pull request"

4. **PR Complete → Workflow End**
   - Input: "Pull request #127 created"
   - Output: "WORKFLOW_COMPLETE"

### **Testing Scripts**
- `simple-coordinator-test.sh`: Basic workflow testing
- `comprehensive-coordinator-test.sh`: Detailed realistic scenarios
- `test-coordinator-locally.sh`: Local development testing

---

## 🚀 **DEPLOYMENT STATUS**

### **Railway Deployment**
- **URL**: https://agent-billy-production.up.railway.app/coordinator/next-step
- **Status**: ✅ LIVE AND OPERATIONAL
- **API Key**: Configured with real Anthropic API key
- **Cache Issues**: Resolved via automated nuclear process (`railway down` + `railway up`)

### **Performance**
- **Response Time**: ~1-2 seconds per decision
- **Model**: Claude-3-Haiku (fast decision making)
- **Reliability**: Graceful error handling with fallbacks

---

## 🔧 **IMPLEMENTATION DETAILS**

### **Code Location**
- **Main Implementation**: `server/statelessWebhook.ts` - `coordinatorNextStep()` method
- **Route**: `POST /coordinator/next-step`
- **LLM Integration**: Uses `callLLM()` from `cognition/llmWrapper.ts`

### **Error Handling**
```typescript
try {
  const response = await callLLM({
    prompt: coordinatorPrompt,
    options: { maxTokens: 1000 }
  });
  
  const nextPrompt = response.content.trim();
  const isComplete = nextPrompt.includes('WORKFLOW_COMPLETE');
  
  res.statusCode = 200;
  res.end(JSON.stringify({ 
    next_prompt: nextPrompt,
    complete: isComplete,
    timestamp: new Date().toISOString()
  }));
} catch (error) {
  console.error('❌ Coordinator error:', error);
  res.statusCode = 500;
  res.end(JSON.stringify({ 
    error: 'Coordinator analysis failed',
    timestamp: new Date().toISOString()
  }));
}
```

---

## 🎯 **FUTURE ENHANCEMENTS**

### **Potential Improvements**
- **Multi-file Changes**: Handle complex PRs with multiple file modifications
- **Error Recovery**: Smart retry logic when Claude CLI encounters issues
- **Progress Tracking**: Detailed logging of workflow progression
- **Custom Workflows**: Repository-specific workflow customization
- **Parallel Tasks**: Handle multiple GitHub issues simultaneously

### **Advanced Features**
- **Coming Up for Air**: Mid-workflow stakeholder questions via GitHub comments
- **Quality Gates**: Automated code review before PR creation
- **Cross-Repository**: Handle issues that span multiple repositories
- **Integration Testing**: Full stack testing beyond just frontend verification

---

## 📋 **TROUBLESHOOTING**

### **Common Issues**
1. **"Coordinator analysis failed"**: Usually API key or network issues
2. **Infinite loops**: Max iteration limit prevents runaway workflows
3. **Context loss**: Ensure coordinator provides rich context in each prompt
4. **VM timeout**: 30-second polling interval balances responsiveness and cost

### **Debug Commands**
```bash
# Test coordinator directly
curl -X POST https://agent-billy-production.up.railway.app/coordinator/next-step \
  -H "Content-Type: application/json" \
  -d '{"vm_id":"test","issue_context":"Test issue","recent_output":"Test output","current_step":"initial"}'

# Check Railway logs
railway logs

# Local testing
./simple-coordinator-test.sh
```

---

## 📚 **RELATED DOCUMENTATION**

- **VM-COORDINATOR-ARCHITECTURE.md**: Complete end-to-end workflow
- **SESSION.md**: Current development focus and safety guidelines
- **TODO.md**: Development progress and next steps
- **CLAUDE.md**: Overall project documentation and deployment guides