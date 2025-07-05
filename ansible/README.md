# GiveGrove Development Environment Ansible Setup

This Ansible configuration creates a complete development environment for the GiveGrove fundraising platform, designed to support automated development workflows and GUI-based testing with Playwright MCP.

## Quick Start

### Prerequisites
- Ubuntu 22.04 target machine (VM or container)
- Ansible installed on control machine
- SSH access to target machine (if remote)

### Local Development Setup
```bash
# Run on local machine
cd ansible/
ansible-playbook -i inventory.yml playbook.yml

# Or for remote VM
ansible-playbook -i inventory.yml playbook.yml -l vm_instance
```

## What Gets Installed

### System Dependencies
- **Node.js 20.17.0** (exact version required by GiveGrove)
- **npm 10.6.0+** 
- **Firebase CLI 13.27.0**
- **Docker & Docker Compose**
- **Git, build tools, Python**

### GUI Environment
- **VS Code** with GiveGrove repo auto-opened
- **Virtual X11 display** (`:99`) with Xvfb
- **VNC server** for remote GUI access (port 5900)
- **Fluxbox** window manager
- **Firefox & Chromium** for Playwright testing

### Development Setup
- **GiveGrove repository** cloned and configured
- **Frontend dependencies** installed (`npm install`)
- **Backend dependencies** installed (`functions/npm install`)
- **Claude Code CLI** installed globally for AI-powered development
- **Playwright MCP** setup for natural language browser automation
- **Helper scripts** for common development tasks

## Post-Installation Steps

### 1. Configure Secrets
The playbook creates `SECRETS_SETUP.md` with detailed instructions for:
- Firebase service account keys
- Environment variables (.env files)
- External API keys (Stripe, SendGrid, Twilio, etc.)

### 2. Start Development
```bash
# Frontend development server
cd ~/GiveGrove && npm run dev

# Backend Firebase functions
cd ~/GiveGrove/functions && npm run serve

# Full stack with Docker
cd ~/GiveGrove && docker-compose up

# Open in VS Code
code ~/GiveGrove
```

### 3. GUI Access
- **Local**: `DISPLAY=:99 code ~/GiveGrove`
- **Remote VNC**: Connect to `machine_ip:5900`
- **SSH X11**: `ssh -X user@machine` then `code ~/GiveGrove`

### 4. Setup Claude Code + Playwright MCP
```bash
cd ~/GiveGrove
./setup-claude.sh     # Shows setup instructions
claude                # Authenticate Claude Code (follow OAuth prompts)
claude mcp add playwright npx @playwright/mcp@latest  # Add Playwright MCP
```

### 5. Test Natural Language Browser Control
In Claude Code terminal:
```
"Use Playwright MCP to navigate to localhost:3000 and take a screenshot"
"Click the login button and fill in test credentials"  
"Test the checkout flow and verify it works"
```

## Configuration

### Inventory Customization
Edit `inventory.yml` to target different machines:

```yaml
vm_instance:
  ansible_host: your.vm.ip.address
  ansible_user: ubuntu
  ansible_ssh_private_key_file: ~/.ssh/your_key
```

### Variables Override
Common variables you might want to override:

```yaml
# In inventory.yml or as extra vars
repo_url: "https://github.com/your-fork/GiveGrove.git"
repo_branch: "your-feature-branch"
enable_vnc: false  # Disable VNC server
virtual_display: ":1"  # Use different display
```

## Architecture

This setup is designed to support **Agent Billy** - an automated development pipeline that can:

1. **Code Autonomously**: Full IDE environment with VS Code
2. **Test with Real Browsers**: Playwright MCP with headed browser support
3. **Isolated Development**: Complete VM environment that can be torn down/rebuilt
4. **Full Stack Development**: Both frontend (Vite) and backend (Firebase) environments

## Troubleshooting

### Node.js Version Issues
The playbook enforces Node.js 20.17.0+ as required by GiveGrove. If you see version errors:
```bash
node --version  # Should show v20.17.0+
npm --version   # Should show 10.6.0+
```

### GUI/Display Issues
```bash
# Check virtual display
ps aux | grep Xvfb
export DISPLAY=:99
xdpyinfo  # Should show display info

# Test VNC connection
ss -tlnp | grep 5900  # Should show VNC listening
```

### Firebase Authentication
```bash
# Login to Firebase CLI
firebase login --no-localhost
firebase projects:list
```

### Playwright Issues
```bash
# Reinstall Playwright browsers
npx playwright install
npx playwright install-deps

# Test browser launch
DISPLAY=:99 npx playwright test --headed --project=chromium
```

## Security Notes

- Secrets are NOT included in this setup - they must be manually configured
- The setup creates a `secrets/` directory for local secret management
- VNC server runs without authentication (localhost only) - secure appropriately for production use
- Docker daemon access is granted to the development user

## Agent Billy Integration

This environment is designed as the foundation for **automated development workflows** using Claude Code + Playwright MCP:

- **Natural Language Development**: Use Claude Code to implement features with conversational prompts
- **Visual Browser Testing**: Playwright MCP enables real browser automation via natural language  
- **Reproducible Environment**: Complete VM recreation from scratch for consistent development
- **Isolated Execution**: VM-based separation ensures clean, disposable development environments
- **Full-Stack Capabilities**: Frontend, backend, database, and browser testing all integrated

### Example Agent Billy Workflow:
1. **Feed Claude Code a GitHub issue**: "Implement user registration feature"
2. **Claude codes the feature** using VS Code and development tools
3. **Test with natural language**: "Use Playwright MCP to test the registration flow"
4. **Iterate until complete**: Claude fixes issues and re-tests automatically
5. **Create PR**: Agent creates pull request when tests pass

The setup provides everything needed for an AI agent to autonomously develop, test, and ship code changes.