# Agent Billy - Production Deployment Guide

## Railway Deployment (Fastest Iteration)

### 1. Setup Railway Account
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login
```

### 2. Environment Variables
Set these in Railway dashboard or via CLI:

```bash
railway variables set GITHUB_TOKEN=your_github_token_here
railway variables set DEFAULT_GITHUB_OWNER=your-username
railway variables set DEFAULT_GITHUB_REPO=your-repo-name
railway variables set AGENT_USERNAME=agent-billy
railway variables set NODE_ENV=production
```

### 3. Deploy
```bash
# Initialize Railway project
railway init

# Deploy directly from this repo
railway up
```

### 4. Monitor
- Health endpoint: `https://your-app.railway.app/health`
- Logs: `railway logs --follow`
- Status: `railway status`

## Quick Start Commands

```bash
# Deploy to Railway
git push && railway up

# Check Billy's health
curl https://your-app.railway.app/health

# View live logs
railway logs --follow
```

## Environment Setup

Copy `.env.example` to `.env` and configure:
```
GITHUB_TOKEN=your_token_here
DEFAULT_GITHUB_OWNER=your-username
DEFAULT_GITHUB_REPO=your-repo
AGENT_USERNAME=agent-billy
```

Billy will automatically start monitoring your repository for assigned issues once deployed.