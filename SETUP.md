# Agent Billy Setup Guide

Complete guide to deploying and configuring Agent Billy as a GitHub App webhook server.

## 🎯 Overview

This guide will help you:
1. Create a GitHub App for Billy
2. Deploy Billy to Railway
3. Configure target repositories
4. Test the complete workflow

## 🔧 Prerequisites

- GitHub account with organization or repository access
- Railway account (for hosting Billy)
- DigitalOcean account (for VM development workflow)
- Anthropic API key (for Claude LLM)

## 📋 Step 1: Create GitHub App

### 1.1 Navigate to GitHub App Creation
1. Go to `https://github.com/settings/apps`
2. Click "New GitHub App"

### 1.2 Configure App Settings
**App Name:** `agent-billy-your-org` (must be globally unique)
**Homepage URL:** `https://github.com/your-org/agent-billy`
**Webhook URL:** `https://your-app-name.railway.app/webhook` (get from Railway later)

### 1.3 Set Permissions
**Repository permissions:**
- Issues: Read & Write
- Pull requests: Read & Write
- Repository contents: Read & Write
- Repository metadata: Read

**Subscribe to events:**
- Issues

### 1.4 Generate Private Key
1. Scroll to "Private keys" section
2. Click "Generate a private key"
3. Download the `.pem` file (keep this secure!)

### 1.5 Get App Information
After creation, note these values:
- **App ID** (visible on app settings page)
- **Installation ID** (install app on repositories, then get from URL)

## 🚀 Step 2: Deploy to Railway

### 2.1 Fork Repository
1. Fork `https://github.com/your-username/agent-billy`
2. Clone your fork locally

### 2.2 Connect to Railway
1. Go to `https://railway.app`
2. Create new project from GitHub repo
3. Select your agent-billy fork

### 2.3 Configure Environment Variables

In Railway dashboard, add these environment variables:

```env
# GitHub App Configuration (Required)
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA...
...your private key content...
-----END RSA PRIVATE KEY-----"
GITHUB_APP_INSTALLATION_ID=12345678

# Webhook Security (Recommended)
GITHUB_WEBHOOK_SECRET=your_random_secret_here

# LLM Provider (Required)
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key

# VM Orchestration (Required for vm_development)
DIGITALOCEAN_TOKEN=dop_v1_your_digitalocean_token
```

**Important:** For `GITHUB_APP_PRIVATE_KEY`, copy the entire content of your `.pem` file including the header and footer lines.

### 2.4 Deploy
Railway automatically deploys when you push to main branch. Monitor logs to ensure successful deployment.

### 2.5 Get Railway URL
1. In Railway dashboard, find your deployment URL
2. Copy URL (format: `https://agent-billy-production-abc123.railway.app`)

## 🔗 Step 3: Complete GitHub App Configuration

### 3.1 Update Webhook URL
1. Return to GitHub App settings
2. Update "Webhook URL" with your Railway URL + `/webhook`
3. Example: `https://agent-billy-production-abc123.railway.app/webhook`

### 3.2 Install App on Repositories
1. Go to your GitHub App settings
2. Click "Install App" in sidebar
3. Select organization/repositories where Billy should operate
4. Note the installation ID from the URL after installation

### 3.3 Update Installation ID
Update `GITHUB_APP_INSTALLATION_ID` in Railway with the installation ID from step 3.2.

## 📁 Step 4: Configure Target Repository

### 4.1 Create Billy Configuration
In your target repository, create `.github/billy-config.yml`:

```yaml
# .github/billy-config.yml
billy:
  workflow_type: "vm_development"
  vm_development:
    vm_size: "c-4"  # DigitalOcean VM size
    ansible_playbook: "ansible/claude-code-environment.yml"
```

### 4.2 Create Ansible Setup (for vm_development)
If using `vm_development` workflow, create `ansible/` directory with:

```yaml
# ansible/claude-code-environment.yml
---
- name: Setup Development Environment
  hosts: vm_instance
  become: yes
  tasks:
    - name: Install dependencies
      package:
        name: "{{ item }}"
        state: present
      loop:
        - git
        - nodejs
        - npm

    - name: Clone repository
      git:
        repo: "https://github.com/{{ repository_owner }}/{{ repository_name }}.git"
        dest: "/workspace"

    - name: Install project dependencies
      npm:
        path: "/workspace"
        state: present
```

## 🧪 Step 5: Test the Workflow

### 5.1 Create Test Issue
1. Create new issue in your target repository
2. Add clear description of a small feature or bug fix
3. Add the `for-billy` label

### 5.2 Verify Billy Response
Billy should respond within 30 seconds with either:
- Clarification questions (if issue needs more detail)
- Implementation plan (if issue is clear enough)

### 5.3 Multi-Round Clarification Test
1. If Billy asks questions, answer them in a new comment
2. Billy should re-analyze and either ask more questions or proceed
3. Continue until Billy indicates readiness to implement

### 5.4 Check Logs
Monitor Railway logs to see Billy's processing:
```
🎣 Received GitHub webhook: issues
🏷️ Issue #123 labeled for Billy - processing
🤔 Analyzing issue for clarification needs...
✅ Posted clarification comment to issue #123
```

## 🔧 Troubleshooting

### Common Issues

**Billy not responding to labels:**
- Check Railway logs for webhook delivery
- Verify webhook URL in GitHub App settings
- Ensure `GITHUB_WEBHOOK_SECRET` matches (or remove if not using)

**Authentication errors:**
- Verify `GITHUB_APP_PRIVATE_KEY` format (include header/footer)
- Check `GITHUB_APP_ID` and `GITHUB_APP_INSTALLATION_ID` are correct
- Ensure app is installed on target repository

**LLM errors:**
- Verify `ANTHROPIC_API_KEY` is valid
- Check API key has sufficient credits

**VM workflow issues:**
- Verify `DIGITALOCEAN_TOKEN` has VM creation permissions
- Check Ansible playbook syntax
- Ensure target repository has required Ansible files

### Debug Commands

Test GitHub App authentication:
```bash
# In Railway logs, look for:
✅ GitHub App authenticated successfully
🔑 Generated installation token for repository
```

Test webhook delivery:
```bash
# Check GitHub App settings > Advanced > Recent Deliveries
# Should show successful 200 responses
```

## 🎉 Success!

When everything is working:
1. Billy responds to `for-billy` labels within seconds
2. Multi-round clarification works smoothly
3. Implementation workflows execute based on repository configuration
4. Pull requests are created automatically (for `vm_development` workflow)

Billy is now ready to be your AI development teammate! 🤖

## 🔄 Next Steps

- Configure additional repositories with different workflow types
- Customize prompts in `/prompts` directory for your organization
- Set up monitoring and alerting for Billy's health
- Explore advanced features like custom webhooks and cross-repository operations

---

**Need help?** Check the [ARCHITECTURE.md](ARCHITECTURE.md) for detailed technical information or [CLAUDE.md](CLAUDE.md) for development guidance.