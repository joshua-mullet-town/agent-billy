# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agent Billy is a stateless AI development teammate that operates as a GitHub App webhook server. Billy responds to GitHub issues in real-time, conducts multi-round clarification conversations, and executes configurable implementation workflows including full VM-based development environments.

**Philosophy**: Billy is not a script—he's a teammate. A stateless, webhook-driven entity who senses GitHub events, thinks through LLM analysis, acts via GitHub APIs, and orchestrates development workflows.

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