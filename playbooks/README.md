# Billy Playbooks Directory

## Overview

This directory contains Ansible playbooks for Billy's VM-based automation workflows. 

## Playbook Options

Billy supports two playbook hosting strategies:

### 1. **Billy-Hosted Playbooks** (Current)
- **Location**: `/playbooks/` directory in Billy's repository
- **Pros**: Centralized management, easy updates, proven working
- **Cons**: Deployment details visible in public repo
- **Use Case**: Internal projects, open-source projects, rapid prototyping

### 2. **Repository-Hosted Playbooks** (Backward Compatible) 
- **Location**: Target repository's `.github/` directory
- **Pros**: Complete privacy, client control over deployment details
- **Cons**: Requires per-repo maintenance
- **Use Case**: Commercial clients, proprietary applications

## Security Model

**All sensitive data is protected** regardless of hosting choice:
- Secrets encrypted via ansible-vault
- Tokens/credentials never in plaintext
- Authentication handled via encrypted variables

**Business intelligence considerations:**
- Technology stack and architecture details are visible in playbooks
- Some clients may prefer deployment methodology privacy
- Consider client comfort level with public deployment details

## Configuration

```yaml
# .github/billy-config.yml

# Option 1: Use Billy's hosted playbook
billy:
  workflow_type: "vm_development"
  playbook_source: "billy_internal"
  playbook_name: "givegrove-environment"

# Option 2: Use repository's own playbook (backward compatible)
billy:
  workflow_type: "vm_development"
  playbook_source: "repository"
  ansible_playbook: ".github/billy/environment.yml"
```

## Current Playbooks

- `givegrove-environment.yml`: Complete GiveGrove development environment
  - Node.js 20.x + npm
  - Firebase CLI + emulators
  - Claude CLI + Playwright MCP
  - GUI environment for browser testing