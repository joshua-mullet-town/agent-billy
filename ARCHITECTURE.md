# Agent Billy Architecture

## 🎯 High-Level Flow

```
GitHub Issue → Billy Clarification → VM Provisioning → Environment Deployment → 
Implementation & Testing → Pull Request → VM Cleanup
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

### `vm_development` (Production Ready)
- Provision DigitalOcean VM with complete development environment
- Deploy Ansible playbook (Billy-hosted or repository-hosted)
- Execute Claude Code + Playwright MCP for implementation and testing
- Create pull request with results
- Automatic VM cleanup and resource management

### Other Workflow Types
*Note: These workflow types are architectural placeholders and not currently production-ready:*

- `github_actions` - Would trigger repository's GitHub Actions workflow
- `simple_comment` - Would post implementation comment only  
- `custom` - Would call repository-specified webhook

*Current focus is on perfecting the `vm_development` workflow for enterprise-grade reliability.*

## 📁 Repository Configuration

**Billy supports two playbook hosting strategies:**

### Option 1: Billy-Hosted Playbooks (Recommended)
```yaml
# .github/billy-config.yml
billy:
  workflow_type: "vm_development"
  playbook_source: "billy_internal"  # Default
  playbook_name: "givegrove-environment"  # Matches /playbooks/givegrove-environment.yml
  vm_development:
    vm_size: "c-4"
```

### Option 2: Repository-Hosted Playbooks (Privacy Option)
```yaml
# .github/billy-config.yml  
billy:
  workflow_type: "vm_development"
  playbook_source: "repository"
  ansible_playbook: ".github/billy/environment.yml"
  vm_development:
    vm_size: "c-4"
```

**Repository Ansible structure (if using repository-hosted):**
```
.github/billy/
├── environment.yml        # Environment setup playbook
└── secrets.yml           # Encrypted secrets via ansible-vault
```

## 🔄 VM Development Workflow

1. **GitHub → Billy**: Webhook triggers on "for-billy" label
2. **Billy → DigitalOcean**: Provision Ubuntu VM with SSH access
3. **Billy → VM**: Deploy Ansible playbook (Billy-hosted or repository-hosted)
4. **VM → Billy**: Coordinator polling begins for implementation guidance
5. **Billy → VM**: Send implementation prompts to Claude CLI
6. **VM**: Execute code changes, testing with Playwright MCP
7. **VM → GitHub**: Create pull request with implementation results
8. **VM → Billy**: Signal workflow completion
9. **Billy → DigitalOcean**: Automatic VM cleanup and resource deallocation

## 🎛️ Playbook Hosting Strategy

**Billy-Hosted Playbooks** (Default):
- **Pros**: Centralized management, proven working configurations, rapid deployment
- **Cons**: Deployment architecture visible in public Billy repository
- **Best for**: Internal projects, open-source projects, rapid prototyping

**Repository-Hosted Playbooks** (Privacy Option):
- **Pros**: Complete deployment privacy, client control over environment details
- **Cons**: Per-repository maintenance, configuration duplication
- **Best for**: Commercial clients, proprietary applications with sensitive architecture

**Security Model**: All sensitive data (tokens, credentials, secrets) are encrypted via ansible-vault regardless of hosting choice.

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

# LLM Provider (Required for Claude CLI in VM environments)
ANTHROPIC_API_KEY=your_anthropic_key_here

# VM Orchestration (Required for vm_development workflow)
DIGITALOCEAN_TOKEN=your_digitalocean_token_here

# VM SSH Access (Required - base64 encoded private key)
SSH_PRIVATE_KEY=base64_encoded_ssh_private_key

# Secrets Encryption (Required for ansible-vault)
ANSIBLE_VAULT_PASSWORD=your_vault_password_here
```

**Critical Notes:**
- `SSH_PRIVATE_KEY` must be base64 encoded for Railway deployment
- All sensitive playbook data encrypted via ansible-vault using `ANSIBLE_VAULT_PASSWORD`
- VM lifecycle includes automatic creation, deployment, execution, and cleanup

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