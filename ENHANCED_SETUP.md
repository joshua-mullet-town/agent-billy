# Enhanced Agent Billy Setup Guide

## 🚀 Complete Autonomous Development Workflow

This guide will help you set up Enhanced Agent Billy with VM orchestration, Claude Code, and Playwright MCP for complete autonomous development workflows.

## 📋 Prerequisites

### 1. API Keys and Tokens Required

```bash
# Required environment variables
GITHUB_TOKEN=your_github_personal_access_token
DIGITALOCEAN_TOKEN=your_digitalocean_api_token  
CLAUDE_API_KEY=your_claude_api_key
ANSIBLE_VAULT_PASSWORD=ansible-vault-password-2024

# Optional
DEFAULT_GITHUB_OWNER=your-github-org
DEFAULT_GITHUB_REPO=your-repo-name
AGENT_USERNAME=agent-billy
```

### 2. System Requirements

- **Local Machine**: macOS/Linux with Node.js 20+, Ansible, SSH access
- **Cloud**: DigitalOcean account with API access
- **Services**: GitHub repository access, Claude API access

### 3. SSH Key Setup

Ensure you have SSH keys configured for DigitalOcean:
```bash
# Your SSH key should be added to DigitalOcean
ls ~/.ssh/id_ed25519_digital_ocean
```

## 🔧 Installation

### 1. Install Dependencies

```bash
cd /path/to/agent-billy
npm install
```

### 2. Create Environment File

```bash
cp .env.example .env
# Edit .env with your API keys
```

### 3. Verify Ansible Setup

```bash
# Make sure Ansible is installed and working
ansible --version

# Verify vault password file exists
ls ../GiveGrove/ansible/vault-password.txt
```

## 🧪 Testing the Complete Setup

### Step 1: Test VM Provisioning

```bash
# Test basic VM provisioning without keeping the VM
npm run billy:test-vm

# Test and keep VM for inspection
npm run billy:test-vm -- --keep
```

**Expected Output:**
```
🧪 Testing VM provisioning and Claude Code setup...
🚀 Provisioning VM for ticket 999999...
✅ Droplet created: 123456789
🌐 VM ready at IP: 174.138.XX.XXX
🔧 Setting up Claude Code environment on VM 123456789...
✅ Claude Code environment setup complete for VM 123456789
💻 Executing task for issue #999999 on VM 123456789...
```

### Step 2: Test Enhanced Status

```bash
npm run billy:status-enhanced
```

**Expected Output:**
```
🤖 Enhanced Agent Billy Status
================================

📊 Base Agent Status:
- Current Tasks: 0
- Can Take Work: true
- Last Active: 2024-XX-XX
- Total Issues Processed: 0

💻 Development Tasks:
- No active development tasks

🖥️  Active VMs:
- No active VMs

🔧 Capabilities:
- VM Provisioning: ✅ ENABLED
- Claude Code: ✅ ENABLED
- Playwright Testing: ✅ ENABLED
```

### Step 3: Test Enhanced Watch Mode (Dry Run)

```bash
npm run billy:watch-enhanced -- -o your-org -r your-repo --dry-run
```

This will monitor for assigned issues without making changes.

## 🎯 Production Usage

### 1. Autonomous Issue Handling

**Start Enhanced Billy in watch mode:**
```bash
npm run billy:watch-enhanced -- -o south-bend-code-works -r GiveGrove
```

**With custom options:**
```bash
# Custom polling interval and options
npm run billy:watch-enhanced -- \
  -o south-bend-code-works \
  -r GiveGrove \
  --interval 180 \
  --keep-vms
```

### 2. Handle Specific Issue

```bash
# Handle a specific issue with full VM workflow
npm run billy:handle-vm -- -o south-bend-code-works -r GiveGrove -i 42
```

### 3. Emergency Cleanup

```bash
# Clean up all VMs if something goes wrong
npm run billy:cleanup
```

## 🔄 Complete Workflow Example

### Issue Assignment → Autonomous Development

1. **Issue Assignment**: Assign an issue to `agent-billy` on GitHub
2. **Clarification**: Billy asks clarifying questions (existing functionality)
3. **Development Trigger**: Once clarified, Enhanced Billy takes over:

```
🤖 Enhanced Billy starting VM development for issue #123: Add dark mode toggle
🚀 Phase 1: Provisioning VM for issue #123...
✅ VM 987654321 ready at 174.138.XX.XXX
🔧 Setting up Claude Code environment...
✅ Claude Code + Playwright MCP environment ready
💻 Phase 2: Executing development task...
🤖 Claude Code analyzing issue and planning implementation...
⚡ Claude Code implementing dark mode toggle...
🧪 Phase 3: Running Playwright tests with headed browser...
🎭 Testing dark mode functionality in visible browser...
📊 Phase 4: Creating pull request...
✅ Pull request created: https://github.com/org/repo/pull/456
💬 Commenting on issue with results...
🗑️  Phase 5: Cleaning up VM 987654321...
🎉 Enhanced Billy completed issue #123 successfully!
```

## 🎛️ Configuration Options

### Command Line Options

```bash
# Watch mode options
--interval <seconds>     # Polling interval (default: 120)
--dry-run               # No actual changes
--disable-vm            # Disable VM provisioning
--disable-playwright    # Disable browser testing
--keep-vms             # Don't auto-destroy VMs

# Individual issue handling
--keep-vm              # Keep VM after completion
```

### Environment Variables

```bash
# Core configuration
GITHUB_TOKEN=ghp_...
DIGITALOCEAN_TOKEN=dop_v1_...
CLAUDE_API_KEY=sk-ant-...
ANSIBLE_VAULT_PASSWORD=your-password

# Default repository (optional)
DEFAULT_GITHUB_OWNER=south-bend-code-works
DEFAULT_GITHUB_REPO=GiveGrove
AGENT_USERNAME=agent-billy

# VM configuration (optional)
VM_SIZE=c-4                    # DigitalOcean droplet size
VM_REGION=nyc1                 # DigitalOcean region
VM_IMAGE=ubuntu-20-04-x64      # Base image
```

## 🐛 Troubleshooting

### Common Issues

**1. VM Provisioning Fails**
```bash
# Check DigitalOcean token
curl -X GET -H "Authorization: Bearer $DIGITALOCEAN_TOKEN" "https://api.digitalocean.com/v2/account"

# Check SSH key is added to DigitalOcean
```

**2. Claude Code Setup Fails**
```bash
# Verify Claude API key
# Check ansible vault password
```

**3. Playwright Tests Fail**
```bash
# VNC into VM to see what's happening
# Connect to VM_IP:5900 with VNC viewer
```

### Debug Mode

```bash
# Run with maximum verbosity
DEBUG=* npm run billy:watch-enhanced -- -o org -r repo --dry-run
```

### Manual VM Inspection

```bash
# Keep VM after test for manual inspection
npm run billy:test-vm -- --keep

# SSH into the VM
ssh root@VM_IP

# Test Claude Code manually
cd /root/GiveGrove
claude -p "Test command" --allowedTools PlaywrightMCP
```

## 📊 Monitoring and Logs

### Real-time Status

```bash
# Check status while running
npm run billy:status-enhanced
```

### Log Files

Enhanced Billy logs all activities:
- VM provisioning and teardown
- Claude Code execution logs  
- Playwright test results
- GitHub API interactions

## 🚨 Safety Features

### Automatic Cleanup

- VMs are automatically destroyed after task completion
- Emergency cleanup command available
- Graceful shutdown on SIGINT/SIGTERM

### Cost Management

- Small VM instances (4 CPU, 8GB RAM ≈ $0.50/hour)
- Auto-teardown prevents runaway costs
- Typical task time: 15-30 minutes = $0.15-$0.25 per issue

### Error Handling

- Comprehensive error reporting to GitHub issues
- Failed VMs are cleaned up automatically  
- Retry logic for transient failures

## 🎉 Success Metrics

Enhanced Billy should be able to:

✅ **Detect Issues**: Monitor GitHub for assigned issues  
✅ **Clarify Requirements**: Ask questions until confident  
✅ **Provision Environment**: Create complete dev environment  
✅ **Develop Autonomously**: Write code based on requirements  
✅ **Test Comprehensively**: Run headed browser tests with Playwright  
✅ **Create Pull Requests**: Submit changes with documentation  
✅ **Report Results**: Comment on issues with detailed results  
✅ **Clean Up**: Destroy VMs and manage resources  

## 🔄 Next Steps

1. **Test the basic workflow** with a simple issue
2. **Monitor the first few runs** to ensure everything works
3. **Gradually increase complexity** of assigned issues
4. **Scale up** to handle multiple issues simultaneously
5. **Integrate with CI/CD** for advanced workflows

Enhanced Agent Billy is now ready to be your autonomous development teammate! 🤖✨