# Agent Billy + VM + Claude Code + Playwright MCP Integration

## 🎯 Vision: Complete Autonomous Development Workflow

**The Goal**: GitHub issue → AI agent codes/tests → Pull request, all automatically with visible browser testing.

## 🏗️ Complete Architecture

```
🤖 Agent Billy (GitHub Bot)           🖥️  Ephemeral VM Environment           🧠 Claude Code + Playwright MCP
├── 👀 GitHub Issue Detection        ├── 🔄 Auto-provisioned per ticket    ├── 💻 Headless Claude Code CLI
├── 💬 Clarification Questions       ├── 🔐 Authenticated (Git + Firebase) ├── 🖱️  Headed Playwright Browser
├── 🚀 VM Provisioning Trigger       ├── 📦 Complete GiveGrove Environment  ├── 🧪 Visual E2E Testing
└── 📋 Task Execution Coordination   └── ⚡ Auto-teardown on completion     └── 🔀 Pull Request Generation
```

## 🔄 End-to-End Workflow

### Phase 1: Issue Detection & Clarification
1. **Agent Billy** monitors GitHub for assigned issues
2. **Clarification Loop**: Billy asks questions until confident
3. **Task Planning**: Billy creates execution plan
4. **VM Provisioning**: Billy triggers VM creation

### Phase 2: Development Environment Setup  
1. **VM Creation**: DigitalOcean droplet provisioned via Ansible
2. **Authentication**: Git + Firebase service accounts configured
3. **Environment**: Complete GiveGrove frontend + backend running
4. **Claude Code Setup**: CLI installed with Playwright MCP

### Phase 3: Autonomous Development
1. **Task Execution**: Claude Code reads issue + clarification
2. **Code Generation**: AI writes code based on requirements  
3. **Browser Testing**: Playwright MCP runs headed tests
4. **Validation**: Both unit tests and E2E tests pass
5. **PR Creation**: Automated pull request with changes

### Phase 4: Cleanup & Reporting
1. **Results**: Billy comments on issue with PR link
2. **VM Teardown**: Ephemeral environment destroyed
3. **Memory Update**: Billy tracks completion

## 🔧 Technical Implementation

### Agent Billy Enhancements

**New Components Needed:**

```typescript
// /agent-billy/core/vmOrchestrator.ts
export class VMOrchestrator {
  async provisionVM(ticketId: string): Promise<VMInstance>
  async setupClaudeCode(vm: VMInstance): Promise<void>
  async executeTask(vm: VMInstance, task: Task): Promise<TaskResult>
  async teardownVM(vm: VMInstance): Promise<void>
}

// /agent-billy/core/claudeCodeClient.ts  
export class ClaudeCodeClient {
  async runHeadlessCommand(command: string): Promise<string>
  async executeWithPlaywright(testScript: string): Promise<TestResult>
  async createPullRequest(changes: CodeChanges): Promise<PRResult>
}
```

### VM Environment Configuration

**Enhanced Ansible Playbook:**

```yaml
# /ansible/claude-code-environment.yml
- name: Complete Claude Code + Playwright Environment
  tasks:
    # Base environment (already working)
    - include: complete-environment.yml
    
    # Claude Code CLI installation
    - name: Install Claude Code CLI
      shell: |
        curl -fsSL https://claude.ai/cli/install.sh | sh
        echo 'export PATH="$HOME/.claude/bin:$PATH"' >> ~/.bashrc
    
    # Playwright MCP setup
    - name: Configure Playwright MCP for headed testing
      shell: |
        cd {{ workspace_dir }}
        claude mcp add @playwright/mcp@latest
      environment:
        PLAYWRIGHT_HEADLESS: "false"
        DISPLAY: ":99"
    
    # Authentication for Claude Code
    - name: Setup Claude Code authentication
      copy:
        content: "{{ vault_claude_api_key }}"
        dest: "/root/.claude/auth"
        mode: '0600'
```

### Claude Code Integration

**Headless Commands for Automation:**

```bash
# Issue analysis and code generation
claude -p "Read issue #{{ issue_number }} and the clarification conversation. Generate the required code changes for the GiveGrove platform. Use Playwright MCP to test the changes in the browser. When complete, create a pull request." \
  --allowedTools Edit,Bash,PlaywrightMCP \
  --output-format stream-json

# E2E Testing with visible browser
claude -p "Test the new dark mode toggle feature using Playwright MCP. Open the GiveGrove frontend, navigate through the UI, verify the toggle works correctly, and document any issues found." \
  --allowedTools PlaywrightMCP,Edit
```

## 🧪 Playwright MCP Testing Capabilities

### Headed Browser Testing

**What Agent Billy + Claude Code Can Do:**

```typescript
// Example testing workflow with visible browser
const testWorkflow = {
  "Navigate to GiveGrove frontend": "http://VM_IP:3000",
  "Test user registration flow": "Fill forms, submit, verify success",
  "Test auction bidding": "Place bids, verify real-time updates", 
  "Test payment flow": "Mock payments, verify transaction handling",
  "Screenshot documentation": "Capture evidence of working features",
  "Generate test report": "Document all test results and findings"
};
```

**Key Advantages:**
- **Visual Feedback**: You can watch the browser automation happen
- **Authentication**: Easy to handle OAuth flows and login screens
- **Debugging**: See exactly where tests fail visually
- **Real Browser**: Tests against actual Chrome/Firefox, not just headless

## 📋 Enhanced Agent Billy Workflow

### Updated Core Loop

```typescript
// /agent-billy/core/agentBilly.ts - Enhanced workflow
async enhancedIssueHandling(issue: GitHubIssue): Promise<void> {
  // Phase 1: Clarification (existing)
  const clarification = await this.handleClarificationLoop(issue);
  
  // Phase 2: VM Provisioning (NEW)
  const vm = await this.vmOrchestrator.provisionVM(issue.number.toString());
  
  // Phase 3: Claude Code Execution (NEW)
  const taskResult = await this.claudeCodeClient.executeTask(vm, {
    issueNumber: issue.number,
    issueTitle: issue.title,
    issueBody: issue.body,
    clarificationContext: clarification,
    testingRequired: true,
    playwrightEnabled: true
  });
  
  // Phase 4: Results & Cleanup (NEW)
  if (taskResult.success) {
    await this.actions.commentOnIssue(
      this.config.defaultOwner!,
      this.config.defaultRepo!,
      issue.number,
      `🎉 Task completed! Pull request created: ${taskResult.pullRequestUrl}\n\n**Changes Made:**\n${taskResult.summary}\n\n**Tests Passed:**\n${taskResult.testResults}`
    );
  }
  
  await this.vmOrchestrator.teardownVM(vm);
}
```

## 🔐 Authentication Requirements

### What You Need to Provide

1. **Claude API Key**: For Claude Code CLI authentication
2. **DigitalOcean Token**: For VM provisioning (already have)
3. **GitHub Token**: For Agent Billy (already have)
4. **Firebase Service Account**: For backend testing (already have)

### Secrets Management

```yaml
# /ansible/secrets.yml (encrypted)
vault_claude_api_key: "your-claude-api-key"
vault_digitalocean_token: "your-do-token"  # existing
vault_github_token: "your-github-token"    # existing
vault_firebase_service_account_json: |     # existing
  {...}
```

## 🚀 Implementation Plan

### Phase 1: Proof of Concept (Next Steps)
1. **Extend Agent Billy** with VM orchestration capabilities
2. **Create Claude Code VM setup** with Playwright MCP
3. **Test simple workflow**: Issue → VM → Code → PR
4. **Validate headed browser testing** works in VM environment

### Phase 2: Full Integration
1. **Enhanced error handling** and retry logic
2. **Sophisticated testing workflows** with Playwright
3. **Advanced PR generation** with comprehensive documentation
4. **Cost optimization** for VM usage

### Phase 3: Production Ready
1. **Monitoring and alerting** for agent operations
2. **Multi-repository support** 
3. **Advanced task types** (debugging, refactoring, etc.)
4. **Integration with CI/CD** pipelines

## 💰 Cost Considerations

**Per Ticket Costs:**
- VM (6 CPU, 16GB): ~$0.50/hour
- Average ticket time: 30-60 minutes
- Cost per ticket: ~$0.25-$0.50
- Claude API usage: ~$0.10-$0.30 per complex task

**Very reasonable for autonomous development!**

## 🎯 Success Metrics

**Agent Billy should be able to:**
1. ✅ Detect and clarify GitHub issues
2. 🔄 Provision complete development environment  
3. 🤖 Execute complex coding tasks autonomously
4. 🧪 Run comprehensive browser tests with visual feedback
5. 📋 Create detailed pull requests with evidence
6. 🔄 Handle the complete development lifecycle

This architecture creates a truly autonomous development teammate that can handle the full software development lifecycle from issue to deployment!