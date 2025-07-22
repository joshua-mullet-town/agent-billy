# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agent Billy is a **production-ready** stateless AI development teammate that operates as a GitHub App webhook server. Billy responds to GitHub issues in real-time, conducts multi-round clarification conversations, and executes proven VM-based implementation workflows with complete automation.

**Philosophy**: Billy is not a script—he's a teammate. A stateless, webhook-driven entity who senses GitHub events, thinks through LLM analysis, acts via GitHub APIs, and orchestrates complete development workflows from issue to pull request.

**Current Status**: **MVP Complete** - Full end-to-end automation proven working. Now in **maintenance and improvement** phase.

## 🗺️ **CRITICAL DOCUMENTATION MAP - READ THESE FIRST**

### **📋 START HERE - MAINTENANCE & IMPROVEMENTS**
- **SESSION.md**: **MUST READ** - Current maintenance tasks, improvements, and operational issues
- **END-TO-END-TESTING.md**: **MUST READ** - **IRONCLAD** proven automation components - complete success documented

⚠️ **CRITICAL**: END-TO-END-TESTING.md contains **production-proven** automation. Updates require explicit user permission and proof of TOTAL AUTOMATION success.

### **🚨 SOLVED ISSUES - NEVER QUESTION THESE**
- **SSH_KEY_DEBUGGING.md**: **IF YOU HAVE ANY SSH ISSUES EVER, READ THIS** - 16 tested format combinations, base64 solution
- **"COMPLETELY FIGURED OUT" sections**: In END-TO-END-TESTING.md - VM infrastructure, Ansible automation, repository cloning ALL WORKING

### **🎯 SPECIALIZED PROBLEM AREAS**
- **COORDINATOR.md**: Coordinator polling system, Claude CLI step-by-step guidance workflow
- **ARCHITECTURE.md**: System design and component relationships  
- **SETUP.md**: Environment setup and Railway deployment
- **TODO.md**: Development progress tracking and milestones

### **🚨 CRITICAL TESTING RULES**
- **Railway Platform Limitations**: Container times out after ~2 minutes (expected behavior)
- **SSH Safety**: NEVER add complex write_files to cloud-config - breaks authentication
- **Success Verification**: ALWAYS verify actual system state via SSH - don't trust error messages

---

## Current Architecture (Production-Ready Stateless Webhook)

Billy's production architecture is a proven webhook server with complete automation:

- **🎣 Webhook Server** (`/server`) - Real-time GitHub event processing
- **👀 Perception** (`/perception`) - GitHub API reading and event processing
- **🤔 Cognition** (`/cognition`) - LLM analysis and prompt processing
- **🔧 Actions** (`/actions`) - GitHub API operations (comments, PRs, labels)
- **🔐 Authentication** (`/auth`) - GitHub App JWT token management

## Commands

### Production Operations
- `npm install` - Install dependencies
- `npm run build` - Compile TypeScript to JavaScript  
- `npm run start` - Start production webhook server

### Deployment (Production-Ready)
- **Railway**: `railway down -y && railway up` for all deployments (clears cache)
- **Environment**: All variables configured and tested in production
- **Monitoring**: Complete coordinator conversation logging in Railway logs
- **Automation**: Full GitHub issue → PR workflow with VM cleanup

### Maintenance & Monitoring
- Monitor Railway logs for coordinator conversations and errors
- Check END-TO-END-TESTING.md before modifying proven automation components
- VM cleanup is automatic - manual cleanup available if needed

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
ANSIBLE_VAULT_PASSWORD=password            # For encrypted secrets
SSH_PRIVATE_KEY=base64_encoded_key         # For VM SSH access (base64 encoded)
```

**SSH Key Critical Note**: SSH keys MUST be base64 encoded in Railway. See SSH_KEY_DEBUGGING.md for complete solution.

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

## Repository Integration & Playbook Configuration

Target repositories have flexible playbook hosting options:

### **Option 1: Billy-Hosted Playbooks (Recommended for MVP)**
```yaml
# .github/billy-config.yml
billy:
  workflow_type: "vm_development"
  playbook_source: "billy_internal"
  playbook_name: "givegrove-environment"
  vm_development:
    vm_size: "c-4"
```

### **Option 2: Repository-Hosted Playbooks (Privacy Option)**  
```yaml
# .github/billy-config.yml
billy:
  workflow_type: "vm_development"
  playbook_source: "repository"
  ansible_playbook: ".github/billy/environment.yml"
  vm_development:
    vm_size: "c-4"
```

### **Security Considerations:**
- **Secrets**: Always protected via ansible-vault encryption regardless of hosting
- **Business Intelligence**: Playbooks reveal technology stack and deployment methodology
- **Client Privacy**: Some organizations prefer deployment details remain private
- **Recommendation**: Discuss with clients whether deployment automation should be public

## Development Notes

- TypeScript with strict mode, webhook-based architecture
- Stateless design - no persistent memory or state files
- GitHub App authentication for enterprise-scale access
- Label-based triggering ("for-billy" label) eliminates duplicate processing
- Real-time processing - Billy responds within seconds of label application

## Engineering Standards & Philosophy

### No Shortcuts or Work-Arounds
**CRITICAL PRINCIPLE:** We are building a production-quality system that must work end-to-end reliably.

#### Always Diagnose Root Causes
- **Never accept surface-level fixes** - If something appears to work but we don't understand why, keep digging
- **Never work around problems** - If authentication fails, fix authentication. Don't bypass it
- **Never assume things are working** - Verify every step of the flow actually works as designed

#### End-to-End Testing Requirements
When testing Billy's functionality:
1. **Real webhook delivery** - GitHub must actually send webhooks to Railway
2. **Real authentication** - Billy must authenticate with GitHub APIs using proper credentials  
3. **Real issue processing** - Billy must read actual issue content from GitHub
4. **Real LLM analysis** - Billy must make actual decisions about clarification vs. implementation
5. **Real workflow execution** - Billy must trigger actual workflows and produce real results

#### Success Criteria
Billy is only "working" when the complete flow produces real, useful results for users.

### Debugging Standards
When something isn't working:
1. **Check Railway logs for actual errors** - If logs are timing out, that's a problem to fix
2. **Verify GitHub App permissions and installation** - Ensure Billy has access to target repositories
3. **Test authentication independently** - Verify JWT token generation and API access work
4. **Trace the complete request flow** - Follow webhooks from GitHub → Railway → Billy → back to GitHub
5. **Fix problems completely** - Don't move forward until each step actually works

**This philosophy ensures we build something genuinely reliable rather than something that appears to work under ideal conditions.**