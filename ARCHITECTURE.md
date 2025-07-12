# Agent Billy Architecture

## 🎯 High-Level Flow

```
GitHub Issue → Billy Clarification → Implementation Workflow → Pull Request
```

## 🔧 Billy's Responsibilities

**Phase 1: Analysis**
- Webhook processing (real-time GitHub events)
- Clarification questions with stakeholders  
- "Ready to implement" decision

**Phase 2: Implementation** 
- Read repository configuration (`.github/billy-config.yml`)
- Execute configured workflow type
- Coordinate all orchestration logic

**Phase 3: Results**
- GitHub issue updates
- Pull request creation
- Cleanup and memory updates

## 🏗️ Workflow Types

Billy supports multiple implementation strategies per repository:

### `vm_development` (Default)
- Provision DigitalOcean VM
- Run Ansible setup from target repository  
- Execute Claude Code + Playwright MCP
- Create PR and teardown VM

### `github_actions`
- Trigger repository's GitHub Actions workflow
- Pass issue context via repository dispatch

### `simple_comment`
- Post implementation comment only
- No actual code generation

### `custom`
- Call repository-specified webhook
- Full control over implementation process

## 📁 Repository Configuration

**Target repositories only need:**

```yaml
# .github/billy-config.yml
billy:
  workflow_type: "vm_development"
  vm_development:
    vm_size: "c-4"
    ansible_playbook: "ansible/claude-code-environment.yml"
```

**Optional Ansible setup:**
```
/ansible/
├── playbook.yml           # Environment setup
└── secrets.yml            # App secrets template
```

## 🔄 Handoff Points

1. **Billy → Repository**: "Set up your environment per Ansible playbooks"
2. **Repository → Billy**: "Environment ready, here's the config"  
3. **Billy → Billy**: Execute development work with Claude Code
4. **Billy → GitHub**: Post results and cleanup

## 🎛️ Configuration

Billy owns all orchestration logic and tool configurations. Repositories only specify what's project-specific.

**Billy provides:** VM orchestration, Claude Code + MCP setup, GitHub integration  
**Repository provides:** Environment setup instructions, project-specific secrets

## 🎣 Webhook Event Processing

### Event Reception
1. GitHub sends POST to `/webhook` endpoint
2. HMAC signature verification (if `GITHUB_WEBHOOK_SECRET` configured)
3. Event routing based on webhook type (`issues`, `pull_request`, etc.)

### Issue Event Processing
- **Trigger**: `issues.labeled` event with label `for-billy`
- **Payload Processing**: Extract issue, repository, and user information
- **Context Loading**: Fetch all previous comments via GitHub API
- **LLM Analysis**: Determine if clarification needed or ready to implement

### Authentication Flow
1. Generate JWT token using GitHub App private key
2. Exchange JWT for installation access token
3. Use access token for all GitHub API calls
4. Tokens automatically refresh (1-hour expiration)

## 🚀 Deployment Guide

### Railway Setup
1. Fork agent-billy repository
2. Connect to Railway via GitHub integration
3. Configure environment variables (see below)
4. Deploy automatically on push to main branch

### Environment Variables
```env
# GitHub App Configuration (Required)
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
GITHUB_APP_INSTALLATION_ID=12345678

# Webhook Security (Optional but recommended)
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here

# LLM Provider (Optional - defaults to Claude)
ANTHROPIC_API_KEY=your_anthropic_key_here

# VM Orchestration (Required for vm_development workflow)
DIGITALOCEAN_TOKEN=your_digitalocean_token_here
```

### GitHub App Setup
1. Create GitHub App at `https://github.com/settings/apps`
2. Set webhook URL: `https://your-app.railway.app/webhook`
3. Configure permissions:
   - Issues: Read & Write
   - Pull requests: Read & Write
   - Repository contents: Read & Write
   - Repository metadata: Read
4. Subscribe to webhook events: `issues`
5. Install app on target repositories

## 🔄 Multi-Round Clarification

### Clarification Logic
Billy uses LLM analysis to determine implementation readiness:

```
Issue + Comments → LLM Analysis → Decision
```

**Decision Types:**
- `NEEDS_CLARIFICATION`: Post numbered questions
- `READY_TO_IMPLEMENT`: Execute configured workflow
- `ALREADY_CLARIFIED`: Skip (no duplicate processing)

### Question Format
Billy posts structured clarification with:
1. Friendly greeting to issue author
2. Summary of understood requirements
3. Numbered list of specific questions
4. Clear next steps for stakeholder

### Re-analysis Trigger
- New comment added to issue → Billy re-analyzes all context
- Continues until LLM determines requirements are clear
- Then executes implementation workflow