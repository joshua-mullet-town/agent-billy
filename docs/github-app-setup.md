# Agent Billy GitHub App Setup

This guide shows how to create and configure Agent Billy as a GitHub App for professional, multi-repository operation.

## Why GitHub App vs Personal Token?

✅ **GitHub App Advantages:**
- **Multi-repo support** - Install on any organization/repository
- **Professional identity** - Shows as an app, not a fake user
- **Better permissions** - Granular access control
- **Webhook support** - Real-time notifications vs polling
- **Scalable** - Designed for automation and bots

## Step 1: Create GitHub App

1. Go to **GitHub Settings → Developer settings → GitHub Apps**
   - Personal account: https://github.com/settings/apps
   - Organization: https://github.com/organizations/YOUR_ORG/settings/apps

2. Click **"New GitHub App"**

3. **Basic Information:**
   ```
   GitHub App name: Agent Billy
   Description: AI development teammate for autonomous issue handling and code generation
   Homepage URL: https://github.com/your-username/agent-billy
   User authorization callback URL: (leave blank)
   Setup URL: (leave blank)
   Webhook URL: (leave blank for now - will add after Railway deployment)
   Webhook secret: (leave blank for now)
   ```

4. **Repository Permissions:**
   ```
   Issues: Read & Write
   Pull requests: Read & Write
   Contents: Read & Write
   Metadata: Read
   ```

5. **Subscribe to Events:**
   ```
   ☑️ Issues
   ☑️ Issue comments
   ☑️ Pull requests
   ```

6. **Where can this GitHub App be installed?**
   - Choose "Any account" for maximum flexibility

7. Click **"Create GitHub App"**

## Step 2: Generate Private Key

1. In your new GitHub App settings, scroll to **"Private keys"**
2. Click **"Generate a private key"**
3. Download the `.pem` file - this is your app's private key
4. **Keep this secure!** - It's like a password for your app

## Step 3: Install App on Repository

1. In your GitHub App settings, click **"Install App"**
2. Choose the organization/account where your repositories are
3. Select repositories:
   - **All repositories** (if Billy will work on multiple projects)
   - **Selected repositories** (choose specific repos like GiveGrove)
4. Click **"Install"**

## Step 4: Get Installation ID

After installation, the URL will look like:
```
https://github.com/settings/installations/12345678
```

The number `12345678` is your **Installation ID** - save this!

## Step 5: Configure Agent Billy

### Environment Variables

Add these to your `.env` file or Railway environment:

```bash
# GitHub App Configuration (preferred)
GITHUB_APP_ID=123456                    # From app settings page
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE..."  # Content of .pem file
GITHUB_APP_INSTALLATION_ID=12345678     # From installation URL

# Repository Configuration
DEFAULT_GITHUB_OWNER=south-bend-code-works
DEFAULT_GITHUB_REPO=GiveGrove
AGENT_USERNAME=agent-billy              # App will appear as this user

# Remove or comment out personal token if using GitHub App
# GITHUB_TOKEN=ghp_xxxxx
```

### Private Key Format

The private key must be in environment variable format:
```bash
# Convert .pem file to single line with \n separators:
cat agent-billy.pem | sed 's/$/\\n/' | tr -d '\n'
```

Or use this format in Railway:
```
-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----
```

## Step 6: Test Configuration

Run Billy locally to test GitHub App authentication:

```bash
# Install new dependencies
npm install

# Test with dry run
npm run billy:check -- -o south-bend-code-works -r GiveGrove --dry-run

# Should see: "✅ GitHub App authentication successful"
```

## Step 7: Deploy to Railway

```bash
# Deploy first to get your Railway URL
railway login
railway init
railway up

# Note your Railway URL (something like):
# https://agent-billy-production-1234.up.railway.app

# Set environment variables in Railway
railway variables set GITHUB_APP_ID=123456
railway variables set GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE..."
railway variables set GITHUB_APP_INSTALLATION_ID=12345678
railway variables set DEFAULT_GITHUB_OWNER=south-bend-code-works
railway variables set DEFAULT_GITHUB_REPO=GiveGrove
railway variables set AGENT_USERNAME=agent-billy

# Optional: Set webhook secret for security
railway variables set GITHUB_WEBHOOK_SECRET=your_random_secret_here

# Redeploy with environment variables
railway up
```

## Step 7.5: Add Webhook URL (Optional)

After Railway deployment:

1. **Go back to your GitHub App settings**
2. **Edit the app**
3. **Add Webhook URL:** `https://your-railway-url.railway.app/webhooks/github`
4. **Add Webhook Secret:** (same as `GITHUB_WEBHOOK_SECRET` env var)
5. **Save changes**

**Note:** Billy works with **polling mode** even without webhooks, so this step is optional for testing.

## Step 8: Verify Issues Assignment

GitHub Apps can't be directly assigned to issues. Instead:

1. **Create issues and assign to yourself**
2. **Add comment:** `@agent-billy please handle this`
3. **Billy will detect mention and take over**

Or configure Billy to monitor specific labels:
1. Add label `agent-billy` to issues
2. Billy monitors for this label instead of assignment

## Troubleshooting

### "Installation not found" Error
- Verify Installation ID is correct
- Check that app is installed on the target repository

### "Bad credentials" Error  
- Verify App ID is correct
- Check private key format (must include `\n` line breaks)
- Ensure private key is from the correct app

### "Resource not accessible" Error
- Verify app has correct repository permissions
- Check that repository owner/name is correct

### Billy Not Responding
- Check Railway logs: `railway logs --follow`
- Verify webhook URL is accessible
- Test with polling mode first before webhooks

## Security Notes

- **Never commit private keys** to version control
- **Use Railway's encrypted variables** for sensitive data
- **Rotate private keys** periodically (generate new key, update env vars)
- **Monitor app permissions** - review what repositories have access

## Next Steps

Once configured:
1. **Test clarification workflow** with real issues
2. **Enable VM provisioning** for development tasks
3. **Set up monitoring** and alerts
4. **Scale to multiple repositories** as needed

Agent Billy is now ready to operate as a professional GitHub App! 🤖✨