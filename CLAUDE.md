# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agent Billy is a stateless AI development teammate that operates as a GitHub App webhook server. Billy responds to GitHub issues in real-time, conducts multi-round clarification conversations, and executes configurable implementation workflows including full VM-based development environments.

**Philosophy**: Billy is not a script—he's a teammate. A stateless, webhook-driven entity who senses GitHub events, thinks through LLM analysis, acts via GitHub APIs, and orchestrates development workflows.

## 🚀 AUTOMATION PROGRESS REPORT (2025-07-15)

### ✅ **MAJOR BREAKTHROUGHS ACHIEVED**
- **VM Infrastructure**: Complete DigitalOcean API integration with VMOrchestrator
- **Desktop Environment**: Automated GUI setup (Xvfb + fluxbox + x11vnc + Firefox)
- **Repository Cloning**: GitHub token authentication for private repository access
- **SSH Access**: Cloud-config key embedding (bypassed unreliable DigitalOcean SSH API)
- **Railway Deployment**: Build pipeline working with proper TypeScript compilation

### 🔧 **FINAL AUTHENTICATION FIX APPLIED**
**Issue**: GitHubSensor created without authentication, causing config file reading to fail
**Solution**: Explicit GitHub App authentication in StatelessWebhookServer constructor
**Result**: Billy can now read `.github/billy-config.yml` and use `vm_development` workflow

### 🎯 **CURRENT STATUS: 99% AUTOMATION COMPLETE**
All technical components proven working:
- ✅ VM creation and configuration  
- ✅ Desktop environment automation
- ✅ Repository cloning with authentication
- ✅ VNC access for GUI verification
- ✅ Firefox browser installation and testing
- 🔧 GitHub App authentication for config reading (just deployed)

## Current Architecture (Stateless Webhook)

Billy's brain is now a lean webhook server:

- **🎣 Webhook Server** (`/server`) - Real-time GitHub event processing
- **👀 Perception** (`/perception`) - GitHub API reading and event processing
- **🤔 Cognition** (`/cognition`) - LLM analysis and prompt processing
- **🔧 Actions** (`/actions`) - GitHub API operations (comments, PRs, labels)
- **🔐 Authentication** (`/auth`) - GitHub App JWT token management

## Commands

### Current Operations
- `npm install` - Install dependencies
- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Start the stateless webhook server

### Deployment
- Railway deployment via GitHub App webhook integration
- Environment variables: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_INSTALLATION_ID`
- Webhook secret: `GITHUB_WEBHOOK_SECRET` (optional but recommended)

## Key Files and Patterns

### Current Webhook Architecture
```
/server/
├── statelessWebhook.ts    # Main webhook server and event router

/perception/
├── githubSensor.ts        # GitHub API reading and issue processing

/cognition/
├── llmWrapper.ts          # LLM abstraction layer (Claude/GPT/Ollama)
└── promptLoader.ts        # Prompt template system

/actions/
├── githubActions.ts       # GitHub API operations (comments, labels, PRs)

/auth/
├── githubApp.ts           # GitHub App JWT authentication

/prompts/
├── clarificationCheckGiveGrove.md  # Multi-round clarification logic
└── issueAnalysis.md       # Issue analysis prompts
```

### Webhook Event Flow
Billy operates on GitHub webhook events:
1. **Webhook Reception**: GitHub sends issue events when "for-billy" label is added
2. **Authentication**: Generate GitHub App JWT tokens for API access
3. **Perception**: Read issue details and all previous comments via GitHub API
4. **Cognition**: Analyze through LLM - determine if clarification needed or ready to implement
5. **Action**: Post clarification questions OR trigger implementation workflow
6. **Implementation**: Execute repository-configured workflow (VM/GitHub Actions/Custom)

### Critical Integration Points
- **GitHub App Authentication**: Uses private key + app ID for JWT token generation
- **Webhook Security**: HMAC signature verification with `GITHUB_WEBHOOK_SECRET`
- **LLM Integration**: Model-agnostic interface supporting multiple providers
- **Repository Configuration**: Target repos specify workflow via `.github/billy-config.yml`
- **VM Orchestration**: DigitalOcean API + Ansible for development environments

## Environment Setup

### 🚨 **CRITICAL SSH KEY SOLUTION - MUST READ** 

**SSH Key Environment Variable Format Issue - SOLVED 2025-07-15**

⚠️ **PERSISTENT BLOCKING ISSUE**: SSH private keys in Railway environment variables MUST use base64 encoding.

**✅ SOLUTION:**
1. **Store in Railway**: Convert SSH key to base64: `cat ~/.ssh/key | base64 | tr -d '\n'`
2. **Use in code**: Decode with `Buffer.from(process.env.SSH_PRIVATE_KEY, 'base64').toString('ascii')`

**❌ DO NOT:** Store raw SSH keys with newlines in environment variables - causes persistent failures

**📁 Full documentation**: See `SSH_KEY_DEBUGGING.md` for complete analysis and testing results

This solution was tested with 16 different format combinations. Base64 is the only reliable method.

### GitHub App Configuration (Required)
```env
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
GITHUB_APP_INSTALLATION_ID=12345678
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here
```

### Optional Configuration
```env
ANTHROPIC_API_KEY=your_anthropic_key_here  # For Claude LLM
DIGITALOCEAN_TOKEN=your_do_token_here      # For VM orchestration
```

## SSH Key Configuration for VM Development Workflow

### **CRITICAL: SSH Key Setup - HARD-LEARNED LESSONS**

⚠️ **DO NOT use DigitalOcean's SSH key management API** - it's unreliable and causes authentication failures.

✅ **ALWAYS embed SSH keys directly in cloud-config userData**

**The Problem We Solved:**
- DigitalOcean SSH key fingerprints (MD5/SHA256) don't work reliably in API calls
- Template variables with quotes break YAML parsing in cloud-config
- VMs get created successfully but SSH access fails silently

**Working Solution:**
```typescript
// In generateVMSetupScript() method
const userData = `#cloud-config
users:
  - name: ubuntu
    ssh_authorized_keys:
      - ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICOWn4+jHkJv1qZnX++HA26lDCeKzHAP1UFJkMIxjHAl joshuamullet@Joshuas-MacBook-Air.local
    sudo: ALL=(ALL) NOPASSWD:ALL

packages:
  - python3

runcmd:
  - echo "Billy VM setup started at $(date)" > /var/log/billy-status.log
  - echo "SSH key installed via cloud-config" >> /var/log/billy-status.log
  - cd /var/log && python3 -m http.server 8080 &
  - echo "Setup completed at $(date)" >> /var/log/billy-status.log`;

// VM creation - leave sshKeys empty
const vm = await vmOrchestrator.createVM({
  name: vmName,
  region: 'nyc3',
  size: vmSize,
  image: 'ubuntu-22-04-x64',
  sshKeys: [], // CRITICAL: Leave empty - SSH key handled via cloud-config
  userData: userData
});
```

**SSH Key Testing Process:**
```bash
# Test SSH access
ssh -i ~/.ssh/id_ed25519_digital_ocean ubuntu@VM_IP "whoami"

# Debug SSH connection
ssh -v -i ~/.ssh/id_ed25519_digital_ocean ubuntu@VM_IP

# Check cloud-init execution
ssh -i ~/.ssh/id_ed25519_digital_ocean ubuntu@VM_IP "sudo tail -20 /var/log/cloud-init.log"

# Verify setup via web server
curl http://VM_IP:8080/billy-status.log
```

**Common SSH Failures & Solutions:**
1. **Permission denied (publickey)**: SSH key not in cloud-config users section
2. **Cloud-init parsing error**: Template variables with quotes break YAML
3. **VM created but no services**: runcmd section failed due to syntax errors
4. **Connection refused**: Web server not started due to cloud-init failures

**Template Variable Escaping Rules:**
- ❌ Bad: `echo "Issue: ${issue.title}"` (quotes in title break YAML)
- ❌ Bad: `echo "User: ${user.name}"` (special chars break parsing)
- ✅ Good: `echo "Issue ${issue.number} processed"` (no problematic quotes)
- ✅ Good: `echo "Repository ${owner}/${repo}"` (safe variable content)

**Debugging Cloud-init Failures:**
```bash
# Check cloud-init logs for parsing errors
sudo grep -A 10 -B 10 'runcmd' /var/log/cloud-init.log

# Look for YAML parsing failures
sudo grep -i 'error\|fail' /var/log/cloud-init.log

# Check if specific commands failed
sudo grep -A 5 -B 5 'shellify' /var/log/cloud-init.log
```

## Current Workflow Types

Billy supports configurable implementation workflows:

### 1. `vm_development` (Primary)
- Provision DigitalOcean VM
- Execute target repository's Ansible playbook
- Install Claude Code CLI + Playwright MCP
- Billy works autonomously in VM environment
- Create pull request with results
- Teardown VM and cleanup

### 2. `github_actions` 
- Trigger repository's GitHub Actions workflow
- Pass issue context via repository dispatch event

### 3. `simple_comment`
- Post implementation comment only
- No actual code generation or workflow execution

### 4. `custom`
- Call repository-specified webhook endpoint
- Full control over implementation process

## Agent Behavior Patterns

### Multi-Round Clarification Flow
1. **Initial Analysis**: Billy reads issue + all previous comments
2. **Clarification Decision**: LLM determines if details are sufficient
3. **Question Generation**: If unclear, generate specific numbered questions
4. **Stakeholder Response**: User answers questions in new comment
5. **Re-Analysis**: Billy processes answers and decides next step
6. **Implementation**: When clear, execute configured workflow

### Issue Response Structure
Billy's comments include:
1. Friendly acknowledgment of the issue author
2. Technical analysis of requirements and scope  
3. Specific numbered clarifying questions (if needed)
4. Implementation readiness statement
5. Next steps and timeline

## Repository Integration

Target repositories need minimal configuration:

```yaml
# .github/billy-config.yml
billy:
  workflow_type: "vm_development"
  vm_development:
    vm_size: "c-4"
    ansible_playbook: "ansible/claude-code-environment.yml"
```

## Development Notes

- TypeScript with strict mode, webhook-based architecture
- Stateless design - no persistent memory or state files
- GitHub App authentication for enterprise-scale access
- Label-based triggering ("for-billy" label) eliminates duplicate processing
- Real-time processing - Billy responds within seconds of label application

## Working Cadence for Development

When helping build Agent Billy, follow this structure for each task:

### 1. **What We're Doing** 
High-level overview of the current task or goal we're working toward. This sets the context and explains the bigger picture of what we're trying to achieve.

### 2. **Why**
The purpose and expected outcome - why this task matters, what problem it solves, and how it fits into Billy's overall evolution. This helps ensure we're aligned on the value and priority.

### 3. **Your Part** 
Explicit step-by-step instructions for what you need to do, broken down in extreme detail. No assumptions about technical knowledge - every command, click, and configuration spelled out clearly so you can follow along successfully.

### 4. **What I'll Do**
Clear description of what Claude will handle - which files I'll modify, what code I'll write, what analysis I'll perform. This gives you visibility into my work and lets you understand the complete scope.

This structure ensures you have full context and clarity about our progress, responsibilities, and next steps at all times.

## TODO List Management

**CRITICAL:** Maintain the living TODO list as our source of truth for development progress.

### Required Practices:
1. **Update TODO.md regularly** - Move completed items to "Completed" section immediately after finishing
2. **Keep Current Focus updated** - Always reflect what we're actively working on
3. **Document discoveries** - Add important learnings to "Notes & Discoveries" section
4. **Update SETUP.md when needed** - If implementation changes affect deployment, update the setup guide
5. **Use TODO.md for planning** - Refer to the list when deciding next priorities and tasks

### Integration with Working Cadence:
- **"What We're Doing"** should reference current item from TODO.md
- **"Why"** should connect to broader goals outlined in TODO.md
- When completing tasks, update both TODO.md and any affected documentation

This ensures continuity across sessions and helps other coding agents understand our progress and direction.

## Engineering Standards & Philosophy

### No Shortcuts or Work-Arounds
**CRITICAL PRINCIPLE:** We are building a production-quality system that must work end-to-end reliably. This means:

#### Always Diagnose Root Causes
- **Never accept surface-level fixes** - If something appears to work but we don't understand why, keep digging
- **Never work around problems** - If authentication fails, fix authentication. Don't bypass it with test requests
- **Never assume things are working** - Verify every step of the flow actually works as designed

#### End-to-End Testing Requirements
When testing Billy's functionality:
1. **Real webhook delivery** - GitHub must actually send webhooks to Railway
2. **Real authentication** - Billy must authenticate with GitHub APIs using proper GitHub App credentials  
3. **Real issue processing** - Billy must read actual issue content and comments from GitHub
4. **Real LLM analysis** - Billy must make actual decisions about clarification vs. implementation
5. **Real workflow execution** - Billy must trigger actual GitHub Actions or VM workflows
6. **Real results** - The complete flow must produce actual comments, PRs, or implementations

#### When Systems Are Down or Broken
- **Diagnose the actual problem** - Don't guess, investigate logs, API responses, and error messages
- **Fix the underlying issue** - Update credentials, fix configurations, restart services as needed
- **Verify the fix works** - Test the complete flow after every fix
- **Document what was broken** - Update SETUP.md or add troubleshooting notes

#### Forbidden Practices
- ❌ Simulating webhooks with curl when real webhooks should work
- ❌ Using test requests to bypass authentication problems  
- ❌ Assuming deployment worked without checking logs
- ❌ Working around timeouts instead of fixing connection issues
- ❌ Partial testing that skips steps in the real flow

### Debugging Standards
When something isn't working:
1. **Check Railway logs for actual errors** - If logs are timing out, that's a problem to fix
2. **Verify GitHub App permissions and installation** - Ensure Billy has access to target repositories
3. **Test authentication independently** - Verify JWT token generation and API access work
4. **Trace the complete request flow** - Follow webhooks from GitHub → Railway → Billy → back to GitHub
5. **Fix problems completely** - Don't move forward until each step actually works

### Success Criteria
Billy is only "working" when:
- Real GitHub webhooks trigger real processing in Railway
- Billy successfully authenticates and reads from GitHub APIs
- Billy makes intelligent clarification vs. implementation decisions
- Billy successfully triggers and completes configured workflows
- The entire flow produces real, useful results for users

This philosophy ensures we build something genuinely reliable rather than something that appears to work under ideal conditions.

## MANDATORY Session Management System

### CRITICAL REQUIREMENT: Every substantive response MUST include session management

**Reading Requirement:** Always start by reading SESSION.md if it exists to understand current momentum and context.

**Update Requirement:** Always end substantive responses by updating SESSION.md with current progress.

**Working Cadence:** Every response must follow this structure:
1. **What We Just Did** - Specific recent accomplishments/discoveries
2. **What We're Doing Next** - Current exact task 
3. **Your Part** - What the user needs to do/decide/provide
4. **My Part** - What I'm handling in the next steps

### SESSION.md Template (MANDATORY):
```markdown
# Session [DATE] Context

## Just Completed (Last 1-3 actions)
- [Specific thing we just proved/fixed/built with concrete results]
- [Recent discovery or breakthrough]
- [System state change or deployment]

## Current Task 
[Exact thing we're working on right now - be specific]

## Next 3 Actions
1. [Immediate next step with clear success criteria]
2. [Following step that depends on #1]
3. [Step after that to maintain momentum]

## Your Role
[What the user needs to do, decide, provide, or approve]

## My Role  
[What I'm actively handling in the next steps]

## System State
[Current deployment status, what's working, what's broken, key URLs/credentials]

## Context Preservation
[Critical momentum items that must not be lost in handoffs]
```

### Enforcement Rules:
- **Never skip SESSION.md updates** - This is how we maintain continuity across context compactions
- **Be specific** - "Fixed authentication" is bad, "Updated GitHub App installation ID to 75797595, now Billy can read config files" is good  
- **Include concrete next steps** - Vague plans break momentum
- **Update after every major step** - Don't batch updates
- **Template compliance required** - Fill out every section or you're not following protocols

This system ensures continuous momentum and context preservation across all agent handoffs and context compactions.

## ⚠️ **DANGER MODE: SKIP PERMISSIONS ENABLED** ⚠️

**CRITICAL SAFETY RULES WHEN PERMISSIONS ARE BYPASSED:**
- ✅ **ALLOWED**: Make any changes to agent-billy repository
- ❌ **FORBIDDEN**: Delete any files or directories 
- ❌ **FORBIDDEN**: Make pushes/merges to GiveGrove repo without explicit consent
- ❌ **FORBIDDEN**: Make unsolicited/undiscussed changes to GiveGrove

This mode is ONLY for debugging critical issues and should be used with extreme caution.

## 🎉 **MAJOR WIN: ROBUST CLOUD-INIT DETECTION SYSTEM**

**Date**: 2025-07-16

**Problem Solved:** Billy was consistently getting stuck in cloud-init wait loops, preventing Ansible execution

**Root Cause:** Fragile web server detection method that depended on:
- Web server running on port 8080
- Specific string in log file
- 4-minute timeout that was too long for Railway containers

**Solution Implemented:**
- **Official Method**: Uses SSH + `cloud-init status --wait` (from cloud-init documentation)
- **Exponential Backoff**: 5s, 10s, 15s, 20s, 25s, 30s (max 2 minutes total)
- **Removed Dependencies**: Eliminated web server from cloud-config (simpler setup)
- **Better Error Handling**: Proper SSH timeout and connection management
- **Railway Resilient**: Handles container restarts more gracefully

**Key Files Modified:**
- `server/statelessWebhook.ts` - `waitForCloudInitCompletion()` method completely rewritten
- Cloud-config userData simplified (removed web server)

**Research Sources:**
- cloud-init official documentation: https://cloudinit.readthedocs.io/en/latest/reference/cli.html#status
- DigitalOcean SSH best practices documentation

**Result:** This should eliminate the "stuck in cloud-init wait loop" issue that was the primary blocker for end-to-end automation.