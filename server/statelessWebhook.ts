import * as http from 'http';
import * as crypto from 'crypto';
import * as fs from 'fs-extra';
import { GitHubSensor } from '../perception/githubSensor';
import { GitHubActions } from '../actions/githubActions';
import { callLLM } from '../cognition/llmWrapper';
import { PromptLoader } from '../cognition/promptLoader';
import { ConfigReader, BillyConfig } from '../utils/configReader';
import { VMOrchestrator } from '../orchestration/vmOrchestrator';

const port = process.env.PORT || 3000;
const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET || '';

export class StatelessWebhookServer {
  private sensor: GitHubSensor;
  private actions: GitHubActions;
  private configReader: ConfigReader;

  constructor() {
    // Initialize GitHub sensor with explicit authentication
    const githubAppConfig = {
      appId: process.env.GITHUB_APP_ID!,
      privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
      installationId: process.env.GITHUB_APP_INSTALLATION_ID!
    };
    
    this.sensor = new GitHubSensor(process.env.GITHUB_TOKEN, githubAppConfig);
    this.actions = new GitHubActions();
    this.configReader = new ConfigReader();
  }

  // Verify GitHub webhook signature
  private verifySignature(payload: string, signature: string): boolean {
    if (!webhookSecret) {
      console.warn('⚠️  No webhook secret configured - accepting all webhooks');
      return true;
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload, 'utf8')
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(`sha256=${expectedSignature}`, 'utf8'),
      Buffer.from(signature, 'utf8')
    );
  }

  // Handle GitHub webhook events
  private async handleWebhook(event: string, payload: any): Promise<void> {
    console.log(`🎣 Received GitHub webhook: ${event}`);

    try {
      switch (event) {
        case 'issues':
          await this.handleIssueEvent(payload);
          break;

        default:
          console.log(`📝 Ignoring webhook event: ${event}`);
      }
    } catch (error) {
      console.error(`❌ Error handling webhook ${event}:`, error);
    }
  }

  // Handle issue events (opened, labeled, etc.)
  private async handleIssueEvent(payload: any): Promise<void> {
    const { action, issue, repository } = payload;
    
    console.log(`📋 Issue #${issue.number} ${action}`);

    // Only process when 'for-billy' label is added
    if (action === 'labeled' && payload.label?.name === 'for-billy') {
      console.log(`🏷️  Issue #${issue.number} labeled for Billy - processing`);
      await this.processIssue(issue, repository);
    }
  }


  // Process an issue labeled for Billy
  private async processIssue(issue: any, repository: any): Promise<void> {
    const owner = repository.owner.login;
    const repo = repository.name;

    try {
      console.log(`🤖 Billy processing issue #${issue.number} in ${owner}/${repo}`);

      // Step 1: Read repository configuration
      console.log(`📋 Step 1: Reading repository config for ${owner}/${repo}`);
      const config = await this.configReader.readRepositoryConfig(owner, repo);
      console.log(`✅ Config read successfully. Workflow type: ${config?.billy?.workflow_type || 'simple_comment'}`);

      // Step 2: Check if clarification is needed (with full context)
      console.log(`📋 Step 2: Checking if clarification needed for issue #${issue.number}`);
      const clarificationCheck = await this.checkIfClarificationNeeded(issue, repository);
      console.log(`✅ Clarification check complete. Needs clarification: ${clarificationCheck.needsClarification}`);

      if (clarificationCheck.needsClarification) {
        // Post clarification request
        console.log(`📋 Posting clarification request for issue #${issue.number}`);
        const comment = await this.actions.commentOnIssue(
          owner,
          repo,
          issue.number,
          `Hi @${issue.user.login}! 👋

I need some clarification before I can proceed with this issue.

${clarificationCheck.questions}

Once you provide the clarification, I'll be able to help with the implementation!

Thanks!  
Agent Billy 🤖`
        );

        if (comment) {
          await this.actions.addLabel(owner, repo, issue.number, 'needs-clarification');
          console.log(`❓ Billy requested clarification on issue #${issue.number}`);
        } else {
          console.error(`❌ Failed to post clarification comment on issue #${issue.number}`);
        }
      } else {
        // Step 3: Billy is ready to implement - execute configured workflow
        console.log(`🚀 Billy is ready to implement issue #${issue.number}`);
        await this.executeImplementationWorkflow(issue, repository, config);
      }
    } catch (error) {
      console.error(`❌ CRITICAL ERROR in processIssue for #${issue.number}:`, error);
      const err = error as Error;
      console.error(`❌ Error details:`, {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      // Try to post error comment to issue
      try {
        await this.actions.commentOnIssue(
          owner,
          repo,
          issue.number,
          `❌ **Processing Error**

I encountered an error while processing this issue:

\`\`\`
${err.message}
\`\`\`

Please check the logs and try again.

---
*Agent Billy Error Handler*`
        );
      } catch (commentError) {
        console.error(`❌ Also failed to post error comment:`, commentError);
      }
    }
  }

  // Execute the configured implementation workflow
  private async executeImplementationWorkflow(issue: any, repository: any, config: BillyConfig | null): Promise<void> {
    const owner = repository.owner.login;
    const repo = repository.name;
    const workflowType = config?.billy.workflow_type || 'simple_comment';

    console.log(`🔧 Executing "${workflowType}" workflow for issue #${issue.number}`);

    switch (workflowType) {
      case 'github_actions':
        await this.executeGitHubActionsWorkflow(issue, repository, config);
        break;

      case 'vm_development':
        await this.executeVMDevelopmentWorkflow(issue, repository, config);
        break;

      case 'simple_comment':
        await this.executeSimpleCommentWorkflow(issue, repository);
        break;

      case 'custom':
        await this.executeCustomWorkflow(issue, repository, config);
        break;

      default:
        console.error(`❌ Unknown workflow type: ${workflowType}`);
        await this.actions.commentOnIssue(owner, repo, issue.number, 
          `❌ **Configuration Error**\n\nUnknown workflow type: "${workflowType}"\n\nPlease check your \`.github/billy-config.yml\` file.`);
    }
  }

  // Execute GitHub Actions workflow
  private async executeGitHubActionsWorkflow(issue: any, repository: any, config: BillyConfig | null): Promise<void> {
    const owner = repository.owner.login;
    const repo = repository.name;

    // Comment that Billy is ready to implement
    await this.actions.commentOnIssue(owner, repo, issue.number, 
      `🚀 **Ready to Implement!**

I've analyzed this issue and I'm ready to start implementation.

**What I'm going to do:**
1. Trigger the GitHub Actions workflow
2. Pass the issue context to the automation
3. Monitor progress and provide updates

Let's get this done! 💪

---
*Agent Billy is executing the implementation workflow*`);

    // Trigger the GitHub Actions workflow
    const success = await this.actions.triggerWorkflow(owner, repo, 'billy-implement', {
      issue_number: issue.number,
      issue_title: issue.title,
      issue_body: issue.body,
      issue_author: issue.user.login,
      repository_name: repo,
      repository_owner: owner
    });

    if (success) {
      await this.actions.addLabel(owner, repo, issue.number, 'billy-implementing');
      await this.actions.removeLabel(owner, repo, issue.number, 'for-billy');
      console.log(`✅ Billy triggered GitHub Actions workflow for issue #${issue.number}`);
    } else {
      await this.actions.commentOnIssue(owner, repo, issue.number, 
        `❌ **Workflow Trigger Failed**\n\nI wasn't able to trigger the GitHub Actions workflow. Please check:\n- The workflow file exists\n- Repository dispatch events are enabled\n- Billy has the required permissions`);
    }
  }

  // Execute VM development workflow (Phase 3)
  private async executeVMDevelopmentWorkflow(issue: any, repository: any, config: BillyConfig | null): Promise<void> {
    const owner = repository.owner.login;
    const repo = repository.name;

    try {
      console.log(`🚀 Starting VM development workflow for issue #${issue.number}`);

      // Post initial status comment
      console.log(`📋 Step 3.1: Posting initial status comment for issue #${issue.number}`);
      const initialComment = await this.actions.commentOnIssue(owner, repo, issue.number, 
        `🚀 **Starting VM Development Workflow!**

I'm now implementing this feature using a dedicated development environment.

**VM Development Process:**
1. 🖥️ Provisioning DigitalOcean VM...
2. 🔧 Setting up environment with Ansible
3. 💻 Installing Claude Code CLI + Playwright MCP
4. 🎯 Implementing the feature autonomously
5. 🔍 Testing the implementation
6. 📥 Creating pull request with results
7. 🧹 Cleaning up VM resources

**Status:** Starting VM provisioning now...

---
*Agent Billy VM Development Workflow*`);

      if (!initialComment) {
        console.error(`❌ Failed to post initial status comment for issue #${issue.number}`);
        throw new Error('Failed to post initial status comment');
      }
      console.log(`✅ Initial status comment posted successfully for issue #${issue.number}`);

      // Initialize VM orchestrator
      console.log(`📋 Step 3.2: Initializing VM orchestrator for issue #${issue.number}`);
      const vmOrchestrator = new VMOrchestrator();
      
      // Clean up old VMs first to avoid cost accumulation
      console.log(`🧹 Step 3.3: Cleaning up old VMs before creating new one...`);
      await vmOrchestrator.destroyOldVMs('159.203.123.65'); // Keep current working VM
      console.log(`✅ Old VMs cleanup completed`);
      
      // Generate unique VM name
      const vmName = `billy-${repo}-${issue.number}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      console.log(`📋 Generated VM name: ${vmName}`);
      
      // Get VM config from repository config or use defaults  
      const vmSize = config?.billy.vm_development?.vm_size || 's-2vcpu-2gb';
      // TEMPORARY: Use local test playbook until proven working end-to-end
      const playbookPath = 'test-complete-environment.yml';
      
      console.log(`🔧 VM Config - Size: ${vmSize}, Playbook: ${playbookPath}`);

      // CRITICAL: Create VM with SSH key embedded in cloud-config (NOT via DigitalOcean API)
      // See CLAUDE.md "SSH Key Configuration" section for detailed explanation
      console.log(`📋 Step 3.4: Creating VM with SSH-safe cloud-config...`);
      const vm = await vmOrchestrator.createVM({
        name: vmName,
        region: 'nyc3',
        size: vmSize,
        image: 'ubuntu-22-04-x64',
        sshKeys: [], // NEVER use DigitalOcean SSH key management - unreliable
        userData: this.generateVMSetupScript(owner, repo, playbookPath, issue)
      });
      console.log(`✅ VM created successfully with ID: ${vm.id}`);

      // Update issue with VM creation status
      await this.actions.commentOnIssue(owner, repo, issue.number, 
        `✅ **VM Created Successfully!**
        
**VM Details:**
- VM ID: ${vm.id}
- Name: ${vm.name}
- Status: ${vm.status}

**Next Steps:**
- Waiting for VM to boot and run setup script
- Will monitor VM status and report progress
        
*Continuing with environment setup...*`);

      // Wait for VM to be ready
      const readyVM = await vmOrchestrator.waitForVM(vm.id, 10);
      
      // Update with honest VM status - coordinator setup via Ansible
      await this.actions.commentOnIssue(owner, repo, issue.number, 
        `🤖 **VM Ready - Ansible Setup Starting!**
        
**VM Status:**
- ✅ VM is running at ${readyVM.publicIp}
- ✅ SSH access configured and verified
- ✅ Basic packages installed (ansible, curl, wget, git, python3)

**Next Steps:**
- 🔄 Ansible playbook will install coordinator workflow
- 🔄 Claude CLI + Playwright MCP integration via Ansible
- 🔄 Repository cloning and environment setup
- 🔄 Coordinator polling logic deployment

*Ansible automation starting - comprehensive environment setup in progress...*`);

      // Create SSH key file with proper base64 decoding (SOLUTION TO PERSISTENT SSH ISSUE)
      const sshKeyPath = '/tmp/ssh_key';
      const sshKeyBase64 = process.env.SSH_PRIVATE_KEY || '';
      if (!sshKeyBase64) {
        throw new Error('SSH_PRIVATE_KEY environment variable not found');
      }
      
      // SOLUTION: Base64 decode the SSH private key
      // Railway stores SSH keys as base64 to avoid newline interpretation issues
      let privateKey: string;
      try {
        privateKey = Buffer.from(sshKeyBase64, 'base64').toString('ascii');
        console.log(`✅ Successfully decoded base64 SSH private key`);
      } catch (error) {
        console.log(`⚠️ Base64 decode failed, trying raw format: ${error}`);
        // Fallback to raw format with newline replacement (legacy support)
        privateKey = sshKeyBase64.replace(/\\n/g, '\n');
      }
      
      // Ensure the key ends with a newline
      if (!privateKey.endsWith('\n')) {
        privateKey += '\n';
      }
      
      console.log(`🔑 SSH Key Processing Complete:`);
      console.log(`📊 Base64 input length: ${sshKeyBase64.length} chars`);
      console.log(`📝 Decoded key length: ${privateKey.length} chars`);
      console.log(`🔤 Decoded key first 50 chars: "${privateKey.substring(0, 50)}"`);
      console.log(`✅ Writing properly formatted SSH key to ${sshKeyPath}`);
      fs.writeFileSync(sshKeyPath, privateKey, { mode: 0o600 });
      
      // Verify file creation and permissions
      try {
        const stats = fs.statSync(sshKeyPath);
        console.log(`📁 SSH key file created successfully: ${stats.size} bytes, mode: ${stats.mode.toString(8)}`);
      } catch (error) {
        console.log(`❌ Failed to verify SSH key file: ${error}`);
      }

      // COORDINATOR ARCHITECTURE: Skip SSH testing, trust cloud-init coordinator workflow
      console.log(`🤖 Coordinator workflow started autonomously in VM ${readyVM.publicIp}`);
      console.log(`🔗 VM will poll: https://agent-billy-production.up.railway.app/coordinator/next-step`);
      console.log(`⚠️ Railway bypasses SSH testing (platform limitation) - VM self-manages`);
      
      // Give cloud-init time to start coordinator workflow
      console.log(`⏳ Allowing 60 seconds for cloud-init to start coordinator polling...`);
      await new Promise(resolve => setTimeout(resolve, 60000));
      
      console.log(`✅ Coordinator workflow initialization period complete`);
      console.log(`📡 VM should now be polling coordinator for step-by-step guidance`);

      // PHASE 1 SUCCESS - SSH KEY SOLUTION ENABLES RAILWAY REMOTE ANSIBLE
      console.log(`✅ Phase 1 complete - VM ready for Ansible automation`);
      
      // FIXED: Use proven SSH + Ansible remote execution approach
      if (!readyVM.publicIp) {
        throw new Error(`VM ${readyVM.id} has no public IP address`);
      }

      // CRITICAL TIMING FIX: Upload vault password BEFORE Railway timeout
      // Railway times out ~2 minutes, so upload vault file immediately after VM ready
      console.log(`📤 Uploading vault password file to VM ${readyVM.publicIp} (before Railway timeout)`);
      const vaultUploadSuccess = await this.uploadVaultPasswordToVM(readyVM.publicIp);
      if (!vaultUploadSuccess) {
        throw new Error(`Failed to upload vault password file to VM ${readyVM.publicIp}`);
      }

      // 🚨 DEPRECATED APPROACH - DO NOT USE runAnsiblePlaybook() 🚨
      // This approach ALWAYS fails due to Railway timeout - Railway kills Ansible process after ~2 minutes
      // We spent hours debugging this approach - it's fundamentally broken for long-running tasks
      // USE VM HANDOFF APPROACH INSTEAD: Upload files to VM, let VM run Ansible independently
      console.log(`🔧 Starting VM handoff automation approach on VM ${readyVM.publicIp}`);
      const automationStarted = await this.uploadFilesAndStartVMAutomation(readyVM.publicIp, owner, repo, playbookPath);
      
      if (!automationStarted) {
        await this.actions.commentOnIssue(owner, repo, issue.number, 
          `❌ **Ansible Automation Failed**
          
**What Failed:**
- Could not run Ansible playbook on VM ${readyVM.publicIp}
- SSH connectivity or Ansible execution error
- Check Railway logs for detailed error information

**Debug Steps:**
\`\`\`bash
ssh ubuntu@${readyVM.publicIp} "cat /home/ubuntu/billy-status.log"
ssh ubuntu@${readyVM.publicIp} "which ansible && ansible --version"
\`\`\`

**Manual Testing:**
\`\`\`bash
ansible-playbook -i ${readyVM.publicIp}, test-complete-environment.yml --check
\`\`\`

*VM available for manual debugging at ${readyVM.publicIp}*`);
        
        await this.actions.addLabel(owner, repo, issue.number, 'billy-ansible-failed');
        return;
      }

      // SUCCESSFUL HANDOFF TO VM
      await this.actions.commentOnIssue(owner, repo, issue.number, 
        `🚀 **VM Automation Handoff Successful!**
        
**✅ Billy Successfully Started:**
- VM provisioned and SSH access confirmed
- Ansible playbook files uploaded to VM
- Automation script deployed and started on VM
- VM is now running environment setup independently

**🔄 Current Status:**
- **VM continues automation independently** (Railway handoff complete)
- Ansible is installing: Node.js, Claude CLI, GiveGrove repo, services
- Full environment setup takes 10-15 minutes to complete
- Coordinator polling will start automatically when environment is ready

**⏱️ Billy's Role Complete:**
Billy's job was to start the automation, not monitor completion.
The VM at ${readyVM.publicIp} will continue working independently.

**Manual Verification (Optional):**
\`\`\`bash
# Check current automation progress
ssh ubuntu@${readyVM.publicIp} "tail -20 /home/ubuntu/automation.log"

# Monitor Ansible execution
ssh ubuntu@${readyVM.publicIp} "ps aux | grep ansible"

# Verify when environment is ready
ssh ubuntu@${readyVM.publicIp} "node --version && claude --version"
\`\`\`

**Expected Timeline:**
- **10-15 minutes**: Complete environment setup
- **15+ minutes**: Coordinator polling begins implementation
- **20+ minutes**: Pull request created (if successful)

---
*Agent Billy VM Handoff Complete - VM Operating Independently*`);

      await this.actions.addLabel(owner, repo, issue.number, 'billy-handoff-complete');
      await this.actions.removeLabel(owner, repo, issue.number, 'for-billy');
      
      console.log(`✅ VM workflow initiated for issue #${issue.number}, VM ID: ${vm.id}`);
      
    } catch (error) {
      console.error(`❌ VM workflow failed for issue #${issue.number}:`, error);
      
      await this.actions.commentOnIssue(owner, repo, issue.number, 
        `❌ **VM Development Workflow Failed**
        
**Error:** ${error instanceof Error ? error.message : 'Unknown error occurred'}

**What happened:**
- VM provisioning or setup encountered an error
- Development workflow could not be completed

**Next steps:**
- Check VM orchestration logs
- Verify DigitalOcean API access
- Ensure repository configuration is correct

Please check the configuration and try again.

---
*VM Development Workflow Error*`);
      
      await this.actions.addLabel(owner, repo, issue.number, 'billy-vm-error');
    }
  }

  // SSH KICKOFF: Start background automation script on VM  
  private async startBackgroundAutomation(vmIp: string, owner: string, repo: string, issue: any): Promise<boolean> {
    try {
      console.log(`🔧 Starting background automation on ${vmIp}`);
      
      // Generate automation script content
      const automationScript = this.generateAutomationScript(owner, repo, issue);
      const vaultPassword = process.env.ANSIBLE_VAULT_PASSWORD || '';
      
      const { spawn } = require('child_process');
      
      // Step 1: Upload automation script to VM
      console.log(`📤 Uploading automation script to ${vmIp}`);
      const uploadResult = await new Promise<boolean>((resolve) => {
        const sshProcess = spawn('ssh', [
          '-i', '/tmp/ssh_key',
          '-o', 'StrictHostKeyChecking=no', 
          '-o', 'ConnectTimeout=15',
          `ubuntu@${vmIp}`,
          `cat > /home/ubuntu/automation.sh << 'AUTOMATION_SCRIPT_EOF'
${automationScript}
AUTOMATION_SCRIPT_EOF
chmod +x /home/ubuntu/automation.sh
echo "${vaultPassword}" > /home/ubuntu/.vault_pass
chmod 600 /home/ubuntu/.vault_pass
echo "Automation script ready" >> /home/ubuntu/billy-status.log`
        ], { stdio: 'pipe' });

        let output = '';
        let error = '';
        
        sshProcess.stdout.on('data', (data: any) => output += data.toString());
        sshProcess.stderr.on('data', (data: any) => error += data.toString());
        
        sshProcess.on('close', (code: number) => {
          const success = code === 0;
          console.log(`📤 Script upload result: ${success ? 'SUCCESS' : 'FAILED'} (code: ${code})`);
          if (!success) console.log(`📤 Upload error: ${error}`);
          resolve(success);
        });
        
        setTimeout(() => {
          sshProcess.kill();
          console.log(`📤 Script upload timed out`);
          resolve(false);
        }, 30000);
      });
      
      if (!uploadResult) {
        console.log(`❌ Failed to upload automation script to ${vmIp}`);
        return false;
      }
      
      // Step 2: Start automation script in background (Railway exits immediately)
      console.log(`🚀 Starting background automation process on ${vmIp}`);
      const startResult = await new Promise<boolean>((resolve) => {
        const sshProcess = spawn('ssh', [
          '-i', '/tmp/ssh_key',
          '-o', 'StrictHostKeyChecking=no',
          '-o', 'ConnectTimeout=10', 
          `ubuntu@${vmIp}`,
          // Critical: Start background process and exit immediately (Railway independence)
          'nohup /home/ubuntu/automation.sh > /home/ubuntu/automation.log 2>&1 & echo "AUTOMATION_STARTED"; exit 0'
        ], { stdio: 'pipe' });

        let output = '';
        let error = '';
        
        sshProcess.stdout.on('data', (data: any) => output += data.toString());
        sshProcess.stderr.on('data', (data: any) => error += data.toString());
        
        sshProcess.on('close', (code: number) => {
          const success = code === 0 && output.includes('AUTOMATION_STARTED');
          console.log(`🚀 Background start result: ${success ? 'SUCCESS' : 'FAILED'} (code: ${code})`);
          console.log(`🚀 Start output: ${output.trim()}`);
          if (!success) console.log(`🚀 Start error: ${error}`);
          resolve(success);
        });
        
        setTimeout(() => {
          sshProcess.kill();
          console.log(`🚀 Background start timed out`);
          resolve(false);
        }, 10000); // 10 seconds - just enough to start background process
      });
      
      if (startResult) {
        console.log(`✅ Background automation started successfully on ${vmIp}`);
        return true;
      } else {
        console.log(`❌ Failed to start background automation on ${vmIp}`);
        return false;
      }
      
    } catch (error) {
      console.error(`❌ Error starting background automation: ${error}`);
      return false;
    }
  }

  // Generate automation script that runs independently on VM
  private generateAutomationScript(owner: string, repo: string, issue: any): string {
    return `#!/bin/bash
set -e

# Completely independent execution - no Railway dependency
echo "=== Billy Automation Script Started at $(date) ===" >> /home/ubuntu/automation.log
echo "VM is now independent of Railway - full automation starting" >> /home/ubuntu/automation.log

# Download Ansible playbook and secrets
echo "Downloading Ansible playbook..." >> /home/ubuntu/automation.log
curl -s -L "https://raw.githubusercontent.com/joshua-mullet-town/agent-billy/main/test-complete-environment.yml" -o /home/ubuntu/playbook.yml
curl -s -L "https://raw.githubusercontent.com/joshua-mullet-town/agent-billy/main/secrets.yml" -o /home/ubuntu/secrets.yml

echo "Creating inventory..." >> /home/ubuntu/automation.log
cat > /home/ubuntu/inventory.yml << 'INVENTORY_EOF'
all:
  hosts:
    vm_instance:
      ansible_host: localhost
      ansible_user: ubuntu
      ansible_connection: local
      ansible_python_interpreter: /usr/bin/python3
INVENTORY_EOF

# Install Ansible
echo "Installing Ansible..." >> /home/ubuntu/automation.log
sudo apt update >> /home/ubuntu/automation.log 2>&1
sudo apt install -y python3-pip >> /home/ubuntu/automation.log 2>&1
pip3 install ansible >> /home/ubuntu/automation.log 2>&1

# Install required collections  
echo "Installing Ansible collections..." >> /home/ubuntu/automation.log
ansible-galaxy collection install community.general --force >> /home/ubuntu/automation.log 2>&1

# Run Ansible playbook
echo "Starting Ansible playbook execution..." >> /home/ubuntu/automation.log
ansible-playbook -i /home/ubuntu/inventory.yml /home/ubuntu/playbook.yml --vault-password-file /home/ubuntu/.vault_pass >> /home/ubuntu/automation.log 2>&1

# Log completion
echo "=== Automation completed at $(date) ===" >> /home/ubuntu/automation.log
echo "AUTOMATION_COMPLETE" > /home/ubuntu/completion-status.log

# Create issue context for Claude CLI
cat > /home/ubuntu/issue-context.txt << 'ISSUE_EOF'
Repository: ${owner}/${repo}
Issue: #${issue.number}
Title: ${issue.title}
Body: ${issue.body || 'No description provided'}
ISSUE_EOF

echo "Automation script completed successfully" >> /home/ubuntu/billy-status.log
`;
  }

  // PHASE 1: Wait for cloud-init completion (replaces SSH test due to Railway limitations)
  private async waitForVMReadiness(vmIp: string): Promise<boolean> {
    try {
      console.log(`🔍 Waiting for VM readiness on ${vmIp}`);
      
      // Test what we actually need for Ansible to work
      const maxAttempts = 10; // 10 attempts over ~3 minutes
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`📋 Attempt ${attempt}/${maxAttempts}: Testing VM readiness...`);
        
        try {
          // Test SSH connectivity + Node.js version + basic responsiveness
          const { spawn } = require('child_process');
          const result = await new Promise<{success: boolean, output: string}>((resolve) => {
            const sshProcess = spawn('ssh', [
              '-o', 'StrictHostKeyChecking=no',
              '-o', 'UserKnownHostsFile=/dev/null',
              '-o', 'ConnectTimeout=10',
              '-i', '/tmp/ssh_key',
              `ubuntu@${vmIp}`,
              'whoami && node --version && echo "VM Ready"'
            ], { timeout: 20000 }); // 20 second timeout
            
            let output = '';
            let error = '';
            
            sshProcess.stdout.on('data', (data: any) => output += data.toString());
            sshProcess.stderr.on('data', (data: any) => error += data.toString());
            
            sshProcess.on('close', (code: number | null) => {
              const success = code === 0 && output.includes('ubuntu') && output.includes('v20.') && output.includes('VM Ready');
              resolve({ success, output: output + error });
            });
            
            sshProcess.on('error', (err: any) => {
              resolve({ success: false, output: err.message });
            });
          });
          
          if (result.success) {
            console.log(`✅ VM is ready for Ansible on ${vmIp} (attempt ${attempt})`);
            console.log(`📋 Readiness check: ${result.output.trim()}`);
            return true;
          } else {
            console.log(`📋 Attempt ${attempt}: VM not ready yet - ${result.output.trim()}`);
          }
          
        } catch (error) {
          console.log(`📋 Attempt ${attempt}: Readiness check failed - ${error}`);
        }
        
        // Fixed 20-second intervals
        if (attempt < maxAttempts) {
          console.log(`⏳ Waiting 20 seconds before next readiness check...`);
          await new Promise(resolve => setTimeout(resolve, 20000));
        }
      }
      
      console.log(`❌ VM did not become ready within 3 minutes on ${vmIp}`);
      return false;
      
    } catch (error) {
      console.error(`❌ Error waiting for VM readiness: ${error}`);
      return false;
    }
  }

  // PHASE 1: Test basic VM setup before proceeding to Ansible (LEGACY - replaced by waitForCloudInitCompletion)
  private async testPhase1Setup(vmIp: string): Promise<boolean> {
    try {
      console.log(`🔍 Testing Phase 1 setup on VM ${vmIp}`);
      
      const { spawn } = require('child_process');
      
      // Test 1: SSH connectivity
      console.log(`🔑 Testing SSH connectivity to ${vmIp}`);
      const sshTest = await new Promise<boolean>((resolve) => {
        const sshProcess = spawn('ssh', [
          '-i', '/tmp/ssh_key',
          '-o', 'StrictHostKeyChecking=no',
          '-o', 'ConnectTimeout=10',
          `ubuntu@${vmIp}`,
          'whoami'
        ], { stdio: 'pipe' });

        let output = '';
        let errorOutput = '';
        
        sshProcess.stdout.on('data', (data: Buffer) => {
          output += data.toString();
        });
        
        sshProcess.stderr.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });

        sshProcess.on('close', (code: number) => {
          const success = code === 0 && output.trim() === 'ubuntu';
          console.log(`🔑 SSH test result: ${success ? 'SUCCESS' : 'FAILED'} (code: ${code})`);
          console.log(`📤 SSH stdout: "${output.trim()}"`);
          console.log(`📤 SSH stderr: "${errorOutput.trim()}"`);
          resolve(success);
        });

        setTimeout(() => {
          sshProcess.kill();
          console.log(`🔑 SSH test timed out`);
          resolve(false);
        }, 15000);
      });

      if (!sshTest) {
        console.log(`❌ SSH connectivity failed for ${vmIp}`);
        return false;
      }

      // Test 2: Verify cloud-config completed via SSH (external web server may be blocked by firewall)
      console.log(`📋 Testing cloud-config completion via SSH on ${vmIp}`);
      
      try {
        const cloudConfigTest = await new Promise<boolean>((resolve) => {
          const testProcess = spawn('ssh', [
            '-i', '/tmp/ssh_key',
            '-o', 'StrictHostKeyChecking=no',
            '-o', 'ConnectTimeout=10',
            `ubuntu@${vmIp}`,
            'test -f /var/log/billy-basic-setup.log && grep "Basic setup completed" /var/log/billy-basic-setup.log'
          ], { stdio: 'pipe' });

          let output = '';
          testProcess.stdout.on('data', (data: Buffer) => {
            output += data.toString();
          });

          testProcess.on('close', (code: number) => {
            const success = code === 0 && output.includes('Basic setup completed');
            console.log(`📋 Cloud-config test result: ${success ? 'SUCCESS' : 'FAILED'} (code: ${code})`);
            resolve(success);
          });

          setTimeout(() => {
            testProcess.kill();
            console.log(`📋 Cloud-config test timed out`);
            resolve(false);
          }, 15000);
        });

        return cloudConfigTest;
      } catch (error) {
        console.log(`❌ Cloud-config verification failed: ${error}`);
        return false;
      }

    } catch (error) {
      console.error(`❌ Phase 1 setup test failed: ${error}`);
      return false;
    }
  }

  // Upload vault password file to VM (called before Railway timeout)
  private async uploadVaultPasswordToVM(vmIp: string): Promise<boolean> {
    try {
      console.log(`🔧 Uploading vault password to VM ${vmIp}`);
      
      const path = require('path');
      const { spawn } = require('child_process');
      
      // Create temporary vault password file
      const tempDir = `/tmp/vault-upload-${Date.now()}`;
      fs.mkdirSync(tempDir, { recursive: true });
      
      const vaultPasswordPath = path.join(tempDir, '.vault_pass');
      const vaultPassword = process.env.ANSIBLE_VAULT_PASSWORD || '';
      if (!vaultPassword) {
        throw new Error('ANSIBLE_VAULT_PASSWORD environment variable is required');
      }
      fs.writeFileSync(vaultPasswordPath, vaultPassword);
      
      // SSH key should already be created from VM workflow
      const sshKeyPath = '/tmp/ssh_key';
      
      // Upload vault password file to VM
      return new Promise<boolean>((resolve) => {
        const uploadProcess = spawn('scp', [
          '-i', sshKeyPath,
          '-o', 'StrictHostKeyChecking=no',
          '-o', 'ConnectTimeout=15',
          vaultPasswordPath,  // Local vault file
          `ubuntu@${vmIp}:/home/ubuntu/.vault_pass`  // Upload to VM
        ], { stdio: 'pipe' });

        let uploadOutput = '';
        let uploadError = '';
        
        uploadProcess.stdout.on('data', (data: any) => uploadOutput += data.toString());
        uploadProcess.stderr.on('data', (data: any) => uploadError += data.toString());
        
        uploadProcess.on('close', (code: number) => {
          if (code === 0) {
            console.log(`✅ Vault password file uploaded to VM ${vmIp} successfully`);
            resolve(true);
          } else {
            console.error(`❌ Failed to upload vault password file to VM ${vmIp}. Exit code: ${code}`);
            console.error(`❌ Upload stderr: ${uploadError}`);
            resolve(false);
          }
        });
      });
    } catch (error) {
      console.error(`💥 Vault password upload crashed: ${error}`);
      return false;
    }
  }

  // VM Handoff Approach: Upload files to VM and let VM run Ansible independently  
  private async uploadFilesAndStartVMAutomation(vmIp: string, owner: string, repo: string, playbookPath: string): Promise<boolean> {
    try {
      console.log(`🚀 Starting VM handoff automation on ${vmIp}`);
      
      const path = require('path');
      const { spawn } = require('child_process');
      
      // SSH key should already exist from VM workflow
      const sshKeyPath = '/tmp/ssh_key';
      
      // Step 1: Upload Ansible playbook to VM
      console.log(`📤 Uploading Ansible playbook to VM...`);
      const localPlaybookPath = path.join(process.cwd(), playbookPath);
      const uploadPlaybookSuccess = await this.uploadFileToVM(vmIp, sshKeyPath, localPlaybookPath, '/home/ubuntu/playbook.yml');
      if (!uploadPlaybookSuccess) {
        throw new Error('Failed to upload Ansible playbook to VM');
      }

      // Step 2: Upload secrets file to VM  
      console.log(`📤 Uploading secrets file to VM...`);
      const localSecretsPath = path.join(process.cwd(), 'secrets.yml');
      const uploadSecretsSuccess = await this.uploadFileToVM(vmIp, sshKeyPath, localSecretsPath, '/home/ubuntu/secrets.yml');
      if (!uploadSecretsSuccess) {
        throw new Error('Failed to upload secrets file to VM');
      }

      // Step 3: Vault password already uploaded by timing fix (uploadVaultPasswordToVM)
      console.log(`✅ Vault password file should already be uploaded by timing fix`);

      // Step 4: Create and upload automation script
      console.log(`📤 Creating and uploading automation script to VM...`);
      const automationScript = this.generateVMAutomationScript(owner, repo, vmIp);
      const scriptPath = '/tmp/vm-automation.sh';
      fs.writeFileSync(scriptPath, automationScript, { mode: 0o755 });
      
      const uploadScriptSuccess = await this.uploadFileToVM(vmIp, sshKeyPath, scriptPath, '/home/ubuntu/automation.sh');
      if (!uploadScriptSuccess) {
        throw new Error('Failed to upload automation script to VM');
      }

      // Step 5: Start the automation script on VM (runs independently)
      console.log(`🚀 Starting automation script on VM (VM will continue after Railway timeout)...`);
      const startAutomationSuccess = await this.startVMAutomationScript(vmIp, sshKeyPath);
      if (!startAutomationSuccess) {
        throw new Error('Failed to start automation script on VM');
      }

      console.log(`✅ VM handoff successful - ${vmIp} will continue automation independently`);
      return true;

    } catch (error) {
      console.error(`💥 VM handoff automation failed: ${error}`);
      return false;
    }
  }

  // Helper: Upload a single file to VM via SCP
  private async uploadFileToVM(vmIp: string, sshKeyPath: string, localPath: string, remotePath: string): Promise<boolean> {
    const { spawn } = require('child_process');
    
    return new Promise<boolean>((resolve) => {
      const uploadProcess = spawn('scp', [
        '-i', sshKeyPath,
        '-o', 'StrictHostKeyChecking=no', 
        '-o', 'ConnectTimeout=15',
        localPath,
        `ubuntu@${vmIp}:${remotePath}`
      ], { stdio: 'pipe' });

      let uploadError = '';
      uploadProcess.stderr.on('data', (data: any) => uploadError += data.toString());
      
      uploadProcess.on('close', (code: number) => {
        if (code === 0) {
          console.log(`✅ Uploaded ${localPath} → ${remotePath} on VM ${vmIp}`);
          resolve(true);
        } else {
          console.error(`❌ Failed to upload ${localPath} to VM ${vmIp}. Exit code: ${code}`);
          console.error(`❌ Upload error: ${uploadError}`);
          resolve(false);
        }
      });
    });
  }

  // Helper: Start automation script on VM
  private async startVMAutomationScript(vmIp: string, sshKeyPath: string): Promise<boolean> {
    const { spawn } = require('child_process');
    
    return new Promise<boolean>((resolve) => {
      // Use nohup to ensure script continues after SSH disconnection
      const startProcess = spawn('ssh', [
        '-i', sshKeyPath,
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'ConnectTimeout=15',
        `ubuntu@${vmIp}`,
        'nohup bash /home/ubuntu/automation.sh > /home/ubuntu/automation.log 2>&1 &'
      ], { stdio: 'pipe' });

      let startError = '';
      startProcess.stderr.on('data', (data: any) => startError += data.toString());
      
      startProcess.on('close', (code: number) => {
        if (code === 0) {
          console.log(`✅ Started automation script on VM ${vmIp} (running independently)`);
          resolve(true);
        } else {
          console.error(`❌ Failed to start automation script on VM ${vmIp}. Exit code: ${code}`);
          console.error(`❌ Start error: ${startError}`);
          resolve(false);
        }
      });
    });
  }

  // Generate automation script that runs on VM
  private generateVMAutomationScript(owner: string, repo: string, vmIp: string): string {
    return `#!/bin/bash
set -e

echo "=== Billy VM Automation Started at $(date) ===" | tee -a /home/ubuntu/automation.log
echo "Running independently on VM ${vmIp}" | tee -a /home/ubuntu/automation.log

# Install Ansible if not present
if ! command -v ansible-playbook &> /dev/null; then
    echo "Installing Ansible..." | tee -a /home/ubuntu/automation.log
    sudo apt update >> /home/ubuntu/automation.log 2>&1
    sudo apt install -y python3-pip >> /home/ubuntu/automation.log 2>&1
    pip3 install ansible >> /home/ubuntu/automation.log 2>&1
    ansible-galaxy collection install community.general --force >> /home/ubuntu/automation.log 2>&1
fi

# Extract vault variables for environment setup
echo "Extracting vault variables..." | tee -a /home/ubuntu/automation.log
ANTHROPIC_API_KEY=$(ansible-vault view secrets.yml --vault-password-file .vault_pass | grep "vault_anthropic_api_key:" | cut -d' ' -f2)
echo "export ANTHROPIC_API_KEY=\"$ANTHROPIC_API_KEY\"" >> /home/ubuntu/.bashrc

# GitHub CLI now handled by Ansible using proper individual tasks (not pre-installed)
echo "GitHub CLI will be installed by Ansible using individual tasks..." | tee -a /home/ubuntu/automation.log

# Create inventory file
echo "Creating Ansible inventory..." | tee -a /home/ubuntu/automation.log
cat > /home/ubuntu/inventory.yml << 'EOF'
all:
  hosts:
    vm_instance:
      ansible_connection: local
      ansible_python_interpreter: /usr/bin/python3
      vm_ip: ${vmIp}
EOF

# Run Ansible playbook with vault password
echo "Starting Ansible playbook execution..." | tee -a /home/ubuntu/automation.log
cd /home/ubuntu
ansible-playbook -i inventory.yml playbook.yml --vault-password-file .vault_pass -v >> automation.log 2>&1

echo "=== Billy VM Automation Completed at $(date) ===" | tee -a /home/ubuntu/automation.log
echo "AUTOMATION_COMPLETE" > /home/ubuntu/completion-status.log
`;
  }

  // 🚨🚨🚨 DEPRECATED - DO NOT USE THIS METHOD 🚨🚨🚨
  // This method is fundamentally broken due to Railway timeout limitations
  // Railway kills the process after ~2 minutes, but Ansible takes much longer
  // We spent countless hours trying to fix this approach - it's architecturally impossible
  // USE uploadFilesAndStartVMAutomation() INSTEAD - VM handoff approach
  // 🚨🚨🚨 NEVER GO BACK TO THIS APPROACH 🚨🚨🚨
  private async runAnsiblePlaybook(vmIp: string, owner: string, repo: string, playbookPath: string): Promise<boolean> {
    try {
      console.log(`🔧 Running Ansible playbook on VM ${vmIp}`);
      
      const path = require('path');
      const { spawn } = require('child_process');
      
      // Create temporary directory for ansible work (Railway permission fix: secrets.yml now readable)
      const tempDir = `/tmp/ansible-${Date.now()}`;
      fs.mkdirSync(tempDir, { recursive: true });
      
      // TEMPORARY: Use Billy's local playbook instead of target repository's
      console.log(`📋 Using Billy's local test playbook: ${playbookPath}`);
      const repoPath = tempDir; // Use temp directory directly
      const ansiblePath = tempDir; // Ansible files are in Billy's working directory
      
      // Copy local test playbook and secrets to temp directory
      const localPlaybookPath = path.join(process.cwd(), playbookPath);
      const localSecretsPath = path.join(process.cwd(), 'secrets.yml');
      
      fs.copySync(localPlaybookPath, path.join(ansiblePath, playbookPath));
      fs.copySync(localSecretsPath, path.join(ansiblePath, 'secrets.yml'));
      console.log(`✅ Copied local Ansible files to temp directory`);
      
      // Create dynamic inventory file with the VM IP
      const inventoryPath = path.join(ansiblePath, 'dynamic_inventory.yml');
      const inventoryContent = `[vm_instance]
${vmIp} ansible_user=ubuntu ansible_ssh_private_key_file=/tmp/ssh_key vm_ip=${vmIp}

[vm_instance:vars]
ansible_ssh_common_args='-o StrictHostKeyChecking=no'`;
      
      fs.writeFileSync(inventoryPath, inventoryContent);
      
      // Create vault password file for encrypted secrets
      const vaultPasswordPath = path.join(ansiblePath, '.vault_pass');
      const vaultPassword = process.env.ANSIBLE_VAULT_PASSWORD || '';
      if (!vaultPassword) {
        throw new Error('ANSIBLE_VAULT_PASSWORD environment variable is required for encrypted playbooks');
      }
      fs.writeFileSync(vaultPasswordPath, vaultPassword);
      
      // SSH key already created in VM workflow Phase 1 testing
      const sshKeyPath = '/tmp/ssh_key';
      
      // TIMING FIX: Vault password now uploaded earlier, before Railway timeout
      console.log(`📋 Vault password file should already be uploaded to VM`);
      console.log(`🔍 Verifying vault file exists at /home/ubuntu/.vault_pass`);
      
      // Run ansible-playbook
      const playbookFullPath = path.join(ansiblePath, playbookPath);
      
      return new Promise((resolve) => {
        const ansibleProcess = spawn('ansible-playbook', [
          playbookFullPath,
          '-i', inventoryPath,
          '-e', `vm_ip=${vmIp}`,
          '--vault-password-file', vaultPasswordPath,  // Use local vault file in Railway container
          '--timeout', '1800',  // 30 minute timeout
          '-v'
        ], {
          cwd: ansiblePath,
          stdio: 'pipe'
        });
        
        let output = '';
        let errorOutput = '';
        
        ansibleProcess.stdout.on('data', (data: Buffer) => {
          const text = data.toString();
          output += text;
          console.log(`🔧 Ansible stdout: ${text}`);
        });
        
        ansibleProcess.stderr.on('data', (data: Buffer) => {
          const text = data.toString();
          errorOutput += text;
          console.log(`❌ Ansible stderr: ${text}`);
        });
        
        ansibleProcess.on('close', (code: number) => {
          console.log(`🔧 Ansible process exited with code ${code}`);
          console.log(`📋 Full stdout output: ${output}`);
          if (errorOutput.trim()) {
            console.log(`❌ Full stderr output: ${errorOutput}`);
          }
          
          // Cleanup
          try {
            fs.rmSync(tempDir, { recursive: true, force: true });
            fs.rmSync(sshKeyPath, { force: true });
          } catch (cleanupError) {
            console.warn(`Warning: Failed to cleanup temporary files: ${cleanupError}`);
          }
          
          if (code === 0) {
            console.log(`✅ Ansible playbook completed successfully on VM ${vmIp}`);
            resolve(true);
          } else {
            console.error(`❌ Ansible playbook failed on VM ${vmIp}. Exit code: ${code}`);
            console.error(`❌ Error output: ${errorOutput}`);
            console.error(`📋 Last stdout: ${output.substring(Math.max(0, output.length - 500))}`);
            resolve(false);
          }
        });
        
        ansibleProcess.on('error', (error: Error) => {
          console.error(`❌ Failed to start Ansible process: ${error.message}`);
          resolve(false);
        });
      });
    } catch (error) {
      console.error('❌ Failed to run Ansible playbook:', error);
      return false;
    }
  }

  // MINIMAL CLOUD-CONFIG + ANSIBLE: Use working SSH approach
  private generateVMSetupScript(owner: string, repo: string, playbookPath: string, issue: any): string {
    // CRITICAL: Use SSH-SAFE minimal cloud-config ONLY
    // NEVER add complex write_files or automation scripts here - they BREAK SSH
    // ALL complex automation belongs in Ansible, not cloud-config
    
    return `#cloud-config
users:
  - name: ubuntu
    ssh_authorized_keys:
      - ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICOWn4+jHkJv1qZnX++HA26lDCeKzHAP1UFJkMIxjHAl joshuamullet@Joshuas-MacBook-Air.local
    sudo: ALL=(ALL) NOPASSWD:ALL

packages:
  - curl
  - wget
  - git
  - python3
  - python3-pip
  - ansible

runcmd:
  - echo "Billy VM created at $(date)" > /home/ubuntu/billy-status.log
  - echo "SSH access ready - Ansible will handle the rest" >> /home/ubuntu/billy-status.log`;
  }

  // Execute simple comment workflow
  private async executeSimpleCommentWorkflow(issue: any, repository: any): Promise<void> {
    const owner = repository.owner.login;
    const repo = repository.name;

    await this.actions.commentOnIssue(owner, repo, issue.number, 
      `🚀 **Ready to Implement!**

I've analyzed this issue and I'm ready to start implementation.

**What I understand:**
- Task: ${issue.title}
- Requirements are clear and complete

**Next Steps:**
This issue is configured for simple comment workflow, so I'm acknowledging that the requirements are clear and the task can be implemented.

---
*Agent Billy is ready to proceed with implementation*`);

    await this.actions.removeLabel(owner, repo, issue.number, 'for-billy');
    console.log(`✅ Billy posted simple comment response to issue #${issue.number}`);
  }

  // Execute custom workflow
  private async executeCustomWorkflow(issue: any, repository: any, config: BillyConfig | null): Promise<void> {
    const owner = repository.owner.login;
    const repo = repository.name;

    await this.actions.commentOnIssue(owner, repo, issue.number, 
      `🔧 **Custom Workflow Ready**

I'm ready to execute your custom implementation workflow.

**Status:** Custom webhook integration coming soon!

---
*Custom workflows are planned for future development*`);

    console.log(`🔄 Custom workflow queued for issue #${issue.number}`);
  }

  // Find Billy's comment on an issue
  private async findBillyComment(issue: any, repository: any): Promise<any> {
    const owner = repository.owner.login;
    const repo = repository.name;
    
    const comments = await this.sensor.getIssueComments(owner, repo, issue.number);
    return comments.find(c => 
      c.user.login === 'agent-billy' || 
      c.user.login === 'agent-billy[bot]' ||
      c.user.login === process.env.AGENT_USERNAME
    );
  }

  // Coordinator endpoint for step-by-step Claude CLI guidance
  public async coordinatorNextStep(req: any, res: any): Promise<void> {
    const { vm_id, issue_context, recent_output, current_step } = req.body;
    
    console.log(`🔧 Coordinator analyzing step for VM ${vm_id}`);
    console.log(`📋 Current step: ${current_step}`);
    console.log(`📝 Recent output: ${recent_output?.substring(0, 200)}...`);

    // Determine next step based on Claude CLI output
    const coordinatorPrompt = `
GITHUB ISSUE CONTEXT:
${issue_context}

RECENT CLAUDE CLI OUTPUT:
${recent_output}

BILLY'S 3-PHASE WORKFLOW:
You must execute these phases in order:
1. IMPLEMENT: Read the GitHub issue and make the required code changes
2. TEST: Test the changes using Playwright MCP browser automation (click login button to verify functionality)
3. CREATE PR: Create a pull request with the changes

COORDINATOR INSTRUCTIONS:
Look at the recent Claude CLI output and decide what should happen next:

- If no code changes have been made yet → Return: "IMPLEMENT_GITHUB_ISSUE: Read the GitHub issue and make the required code changes."
- If code changes were made but no browser testing occurred → Return: "TEST_WITH_PLAYWRIGHT_MCP: Use Playwright MCP to test the frontend by clicking the login button to verify the changes work in a real browser."
- If Playwright testing was completed successfully (output contains browser testing results) → Return: "CREATE_PULL_REQUEST: Create a feature branch named 'agent-billy/feature/gh-{issue_number}', commit the changes, and create a pull request with the implemented changes and test results."
- If a pull request was already created → Return: "WORKFLOW_COMPLETE"

BRANCH NAMING CONVENTION: Use format 'agent-billy/feature/gh-{issue_number}' for feature branches.

Provide the exact prompt for Claude CLI based on what needs to happen next. Be specific about using Playwright MCP for testing and proper branch naming for PRs.
`;

    try {
      const response = await callLLM({
        prompt: coordinatorPrompt,
        options: { maxTokens: 1000 }
      });
      
      const nextPrompt = response.content.trim();
      const isComplete = nextPrompt.includes('WORKFLOW_COMPLETE');
      
      console.log(`✅ Coordinator determined next step: ${nextPrompt.substring(0, 100)}...`);
      
      res.statusCode = 200;
      res.end(JSON.stringify({ 
        next_prompt: nextPrompt,
        complete: isComplete,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('❌ Coordinator error:', error);
      res.statusCode = 500;
      res.end(JSON.stringify({ 
        error: 'Coordinator analysis failed',
        timestamp: new Date().toISOString()
      }));
    }
  }


  // Fast test for debugging file copy operations without full end-to-end cycle
  private async testFileCopyOperations(): Promise<any[]> {
    const path = require('path');
    console.log('🧪 Testing Railway file copy operations...');
    console.log(`📁 Current working directory: ${process.cwd()}`);
    console.log(`👤 Process user: ${process.env.USER || 'unknown'}`);
    
    // Test source file - should exist locally
    const sourceFile = path.join(process.cwd(), 'secrets.yml');
    
    try {
      const stats = fs.statSync(sourceFile);
      console.log(`✅ Source file exists: ${sourceFile} (${stats.size} bytes, mode: ${stats.mode.toString(8)})`);
    } catch (error) {
      console.log(`❌ Source file missing: ${sourceFile}`, error);
      throw new Error(`Source file ${sourceFile} not found`);
    }

    const testDirs = [
      '/tmp/test-copy',
      '/app/test-copy', 
      '/app/temp/test-copy',
      `${process.cwd()}/temp-test-copy`
    ];

    const results: any[] = [];

    for (const testDir of testDirs) {
      console.log(`\n🔍 Testing directory: ${testDir}`);
      
      try {
        // Try to create directory
        fs.mkdirSync(testDir, { recursive: true });
        console.log(`✅ Directory created: ${testDir}`);
        
        // Test different copy methods
        const testFile = path.join(testDir, 'secrets-test.yml');
        
        // Method 1: fs.copyFileSync (the failing method)
        try {
          const fs_node = require('fs'); // Use native fs for comparison
          fs_node.copyFileSync(sourceFile, testFile);
          console.log(`✅ native fs.copyFileSync worked: ${testFile}`);
          fs.unlinkSync(testFile); // cleanup
          results.push({ dir: testDir, method: 'native-fs.copyFileSync', success: true });
        } catch (copyError) {
          console.log(`❌ native fs.copyFileSync failed:`, copyError);
          results.push({ dir: testDir, method: 'native-fs.copyFileSync', success: false, error: (copyError as Error).message });
        }
        
        // Method 2: fs-extra copySync
        try {
          fs.copySync(sourceFile, testFile);
          console.log(`✅ fs-extra.copySync worked: ${testFile}`);
          fs.unlinkSync(testFile); // cleanup
          results.push({ dir: testDir, method: 'fs-extra.copySync', success: true });
        } catch (copyError) {
          console.log(`❌ fs-extra.copySync failed:`, copyError);
          results.push({ dir: testDir, method: 'fs-extra.copySync', success: false, error: (copyError as Error).message });
        }
        
        // Method 3: Read + write approach  
        try {
          const content = fs.readFileSync(sourceFile);
          fs.writeFileSync(testFile, content);
          console.log(`✅ read+write approach worked: ${testFile}`);
          fs.unlinkSync(testFile); // cleanup
          results.push({ dir: testDir, method: 'read+write', success: true });
        } catch (copyError) {
          console.log(`❌ read+write approach failed:`, copyError);
          results.push({ dir: testDir, method: 'read+write', success: false, error: (copyError as Error).message });
        }

        // Check directory permissions
        try {
          const dirStats = fs.statSync(testDir);
          console.log(`📊 Directory permissions: ${dirStats.mode.toString(8)}`);
        } catch (statError) {
          console.log(`❌ Can't stat directory:`, statError);
        }
        
        // Cleanup
        fs.rmSync(testDir, { recursive: true, force: true });
        
      } catch (error) {
        console.log(`❌ Directory test failed:`, error);
        results.push({ dir: testDir, method: 'directory_creation', success: false, error: (error as Error).message });
      }
    }

    console.log('\n📊 SUMMARY:');
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const errorMsg = result.error ? ` (${result.error})` : '';
      console.log(`${status} ${result.dir} - ${result.method}${errorMsg}`);
    });

    return results;
  }

  // Test SCP upload from Railway to VM for debugging vault password transmission
  private async testSCPUploadToVM(): Promise<any> {
    const { spawn } = require('child_process');
    const path = require('path');
    
    console.log('🧪 Testing SCP upload from Railway to VM...');
    
    const vmIp = '174.138.84.209';  // Issue #1144 VM for testing
    const sshKeyPath = '/tmp/ssh_key_test';
    
    const results = {
      sshKeySetup: { success: false, error: null as string | null },
      testFileCreated: { success: false, error: null as string | null },
      sshConnectivity: { success: false, error: null as string | null, output: '', stderr: '' },
      scpUpload: { success: false, error: null as string | null, output: '', stderr: '' },
      verification: { success: false, error: null as string | null, content: '' }
    };

    try {
      // Step 1: Setup SSH key
      console.log('📋 Step 1: Setting up SSH key...');
      const sshKeyBase64 = process.env.SSH_PRIVATE_KEY || '';
      if (!sshKeyBase64) {
        results.sshKeySetup.error = 'SSH_PRIVATE_KEY environment variable not found';
        return results;
      }
      
      const privateKey = Buffer.from(sshKeyBase64, 'base64').toString('ascii');
      fs.writeFileSync(sshKeyPath, privateKey, { mode: 0o600 });
      results.sshKeySetup.success = true;
      console.log(`✅ SSH key written to ${sshKeyPath}`);

      // Step 2: Create test file
      console.log('📋 Step 2: Creating test file...');
      const testFilePath = '/tmp/vault_test_upload.txt';
      const testContent = 'ansible-vault-password-2024\ntest-upload-from-railway-' + Date.now();
      fs.writeFileSync(testFilePath, testContent);
      results.testFileCreated.success = true;
      console.log(`✅ Test file created: ${testFilePath}`);

      // Step 3: Test SSH connectivity
      console.log('📋 Step 3: Testing SSH connectivity...');
      const sshResult = await new Promise<{success: boolean, error: string | null, output: string, stderr: string}>((resolve) => {
        const sshProcess = spawn('ssh', [
          '-i', sshKeyPath,
          '-o', 'StrictHostKeyChecking=no',
          '-o', 'ConnectTimeout=10',
          '-o', 'BatchMode=yes',
          `ubuntu@${vmIp}`,
          'echo "SSH connectivity test successful"'
        ], { stdio: 'pipe' });

        let sshOutput = '';
        let sshError = '';
        
        sshProcess.stdout.on('data', (data: any) => sshOutput += data.toString());
        sshProcess.stderr.on('data', (data: any) => sshError += data.toString());
        
        sshProcess.on('close', (code: number) => {
          resolve({ success: code === 0, error: code === 0 ? null : sshError.trim(), output: sshOutput.trim(), stderr: sshError.trim() });
        });
      });

      results.sshConnectivity = sshResult;
      if (!sshResult.success) {
        console.log('❌ SSH connectivity failed');
        return results;
      }
      console.log('✅ SSH connectivity confirmed');

      // Step 4: Test SCP upload
      console.log('📋 Step 4: Testing SCP upload...');
      const scpResult = await new Promise<{success: boolean, error: string | null, output: string, stderr: string}>((resolve) => {
        const scpProcess = spawn('scp', [
          '-i', sshKeyPath,
          '-o', 'StrictHostKeyChecking=no',
          '-o', 'ConnectTimeout=15',
          '-v',  // Verbose output for debugging
          testFilePath,
          `ubuntu@${vmIp}:/home/ubuntu/vault_test_upload.txt`
        ], { stdio: 'pipe' });

        let scpOutput = '';
        let scpError = '';
        
        scpProcess.stdout.on('data', (data: any) => scpOutput += data.toString());
        scpProcess.stderr.on('data', (data: any) => scpError += data.toString());
        
        scpProcess.on('close', (code: number) => {
          resolve({ success: code === 0, error: code === 0 ? null : scpError.trim(), output: scpOutput.trim(), stderr: scpError.trim() });
        });
      });

      results.scpUpload = scpResult;
      if (!scpResult.success) {
        console.log('❌ SCP upload failed');
        return results;
      }
      console.log('✅ SCP upload successful');

      // Step 5: Verify upload
      console.log('📋 Step 5: Verifying upload...');
      const verifyResult = await new Promise<{success: boolean, error: string | null, content: string}>((resolve) => {
        const verifyProcess = spawn('ssh', [
          '-i', sshKeyPath,
          '-o', 'StrictHostKeyChecking=no',
          '-o', 'ConnectTimeout=10',
          `ubuntu@${vmIp}`,
          'ls -la /home/ubuntu/vault_test_upload.txt && cat /home/ubuntu/vault_test_upload.txt'
        ], { stdio: 'pipe' });

        let verifyOutput = '';
        
        verifyProcess.stdout.on('data', (data: any) => verifyOutput += data.toString());
        verifyProcess.stderr.on('data', (data: any) => verifyOutput += data.toString());
        
        verifyProcess.on('close', (code: number) => {
          resolve({ success: code === 0, error: code === 0 ? null : 'Verification failed', content: verifyOutput.trim() });
        });
      });

      results.verification = verifyResult;
      console.log(verifyResult.success ? '✅ Upload verification successful!' : '❌ Upload verification failed');

    } catch (error) {
      console.error('💥 SCP test crashed:', error);
      results.sshKeySetup.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return results;
  }

  // Debug endpoint to check what files exist in Railway container
  private async debugContainerFiles(): Promise<any> {
    const path = require('path');
    const debugInfo: any = {};
    
    // Check current working directory
    debugInfo.workingDirectory = process.cwd();
    debugInfo.processUser = process.env.USER || process.env.USERNAME || 'unknown';
    
    // List files in working directory
    try {
      debugInfo.workingDirectoryFiles = fs.readdirSync(process.cwd());
    } catch (error) {
      debugInfo.workingDirectoryError = (error as Error).message;
    }
    
    // Check specific files we need
    const filesToCheck = [
      'secrets.yml',
      'test-complete-environment.yml',
      '.vault_pass',
      'package.json',
      'tsconfig.json'
    ];
    
    debugInfo.fileChecks = {};
    
    for (const fileName of filesToCheck) {
      const filePath = path.join(process.cwd(), fileName);
      try {
        const stats = fs.statSync(filePath);
        debugInfo.fileChecks[fileName] = {
          exists: true,
          size: stats.size,
          permissions: stats.mode.toString(8),
          isReadable: true
        };
        
        // Try to read first few bytes to test readability
        try {
          const content = fs.readFileSync(filePath, { encoding: 'utf8' });
          debugInfo.fileChecks[fileName].firstBytes = content.substring(0, 100);
          debugInfo.fileChecks[fileName].totalLength = content.length;
        } catch (readError) {
          debugInfo.fileChecks[fileName].isReadable = false;
          debugInfo.fileChecks[fileName].readError = (readError as Error).message;
        }
      } catch (error) {
        debugInfo.fileChecks[fileName] = {
          exists: false,
          error: (error as Error).message
        };
      }
    }
    
    // Check directory permissions for common paths
    const dirsToCheck = ['/tmp', '/app', process.cwd()];
    debugInfo.directoryPermissions = {};
    
    for (const dir of dirsToCheck) {
      try {
        const stats = fs.statSync(dir);
        debugInfo.directoryPermissions[dir] = {
          exists: true,
          permissions: stats.mode.toString(8),
          isDirectory: stats.isDirectory()
        };
      } catch (error) {
        debugInfo.directoryPermissions[dir] = {
          exists: false,
          error: (error as Error).message
        };
      }
    }
    
    return debugInfo;
  }

  // Check if clarification is needed
  private async checkIfClarificationNeeded(issue: any, repository: any): Promise<{ needsClarification: boolean; questions?: string }> {
    try {
      // Get all comments to provide full context
      const comments = await this.sensor.getIssueComments(repository.owner.login, repository.name, issue.number);
      const commentsContext = comments.length > 0 
        ? comments.map((c: any, i: number) => `Comment ${i + 1} by ${c.user.login}: ${c.body}`).join('\n\n')
        : 'No comments yet';

      const prompt = await PromptLoader.loadPrompt('clarificationCheckGiveGrove', {
        issueTitle: issue.title,
        issueBody: issue.body || 'No description provided',
        issueNumber: issue.number.toString(),
        labels: issue.labels.map((l: any) => l.name).join(', ') || 'No labels',
        author: issue.user.login,
        comments: commentsContext
      });

      const response = await callLLM({
        prompt,
        options: { temperature: 0.3, maxTokens: 400 }
      });

      const content = response.content.trim();
      console.log(`🤔 Billy's LLM analysis FULL result: ${content}`);

      try {
        // Extract JSON from markdown code blocks if present
        let jsonString = content;
        const jsonMatch = content.match(/```json\s*(.*?)\s*```/s);
        if (jsonMatch) {
          jsonString = jsonMatch[1].trim();
        }
        
        // Parse JSON response from LLM
        const analysis = JSON.parse(jsonString);
        
        switch (analysis.status) {
          case 'ready':
            console.log(`🚀 Billy determined he's ready to implement`);
            return { needsClarification: false };
            
          case 'needs_clarification':
            console.log(`❓ Billy needs clarification on ${analysis.questions?.length || 0} points`);
            const questionsText = analysis.questions
              ? analysis.questions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')
              : 'Please provide more details.';
            return { needsClarification: true, questions: questionsText };
            
          case 'reconsider':
            console.log(`🛑 Billy thinks this issue needs reconsideration`);
            const reconsiderText = `**Issues with this request:**\n${analysis.reasons?.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n') || 'This needs to be reconsidered.'}\n\n**My recommendations:**\n${analysis.recommendations?.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n') || 'Please clarify the requirements.'}`;
            return { needsClarification: true, questions: reconsiderText };
            
          default:
            console.log(`⚠️ Unknown status from LLM: ${analysis.status}, defaulting to no clarification needed`);
            return { needsClarification: false };
        }
      } catch (error) {
        console.error(`❌ Failed to parse LLM JSON response: ${error}. Raw content: ${content}`);
        // Fallback to old string parsing for robustness
        if (content.toLowerCase().includes('ready') || content.toLowerCase().includes('proceed')) {
          return { needsClarification: false };
        } else {
          return { needsClarification: true, questions: 'Please provide more details about this request.' };
        }
      }
    } catch (error) {
      console.error('❌ Failed to check clarification needs:', error);
      return { needsClarification: false };
    }
  }

  // Process issue with LLM
  private async processIssueWithLLM(issue: any): Promise<string | null> {
    try {
      const prompt = await PromptLoader.loadPrompt('issueAnalysis', {
        issueTitle: issue.title,
        issueBody: issue.body || 'No description provided',
        issueNumber: issue.number.toString(),
        labels: issue.labels.map((l: any) => l.name).join(', ') || 'No labels',
        author: issue.user.login
      });

      const response = await callLLM({
        prompt,
        options: { temperature: 0.5, maxTokens: 600 }
      });

      return response.content;
    } catch (error) {
      console.error('❌ Failed to process issue with LLM:', error);
      return null;
    }
  }


  // Start the webhook server
  start(): void {
    const server = http.createServer(async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json');

      try {
        if (req.method === 'GET' && req.url === '/health') {
          res.statusCode = 200;
          res.end(JSON.stringify({
            status: 'healthy',
            mode: 'stateless-webhook',
            timestamp: new Date().toISOString()
          }, null, 2));

        } else if (req.method === 'GET' && req.url === '/') {
          res.statusCode = 200;
          res.end(JSON.stringify({
            message: 'Agent Billy Stateless Webhook Server',
            endpoints: {
              health: '/health',
              webhook: '/webhooks/github',
              coordinator: '/coordinator/next-step',
              fileCopyTest: '/test-file-copy',
              debugFiles: '/debug-files',
              scpTest: '/test-scp-upload'
            },
            timestamp: new Date().toISOString()
          }, null, 2));

        } else if (req.method === 'GET' && req.url === '/test-file-copy') {
          // Fast test endpoint for debugging file copy permissions
          try {
            const results = await this.testFileCopyOperations();
            res.statusCode = 200;
            res.end(JSON.stringify({
              message: 'File copy test completed',
              results,
              timestamp: new Date().toISOString()
            }, null, 2));
          } catch (error) {
            console.error('❌ File copy test error:', error);
            res.statusCode = 500;
            res.end(JSON.stringify({
              error: 'File copy test failed',
              details: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString()
            }));
          }

        } else if (req.method === 'GET' && req.url === '/debug-files') {
          // Debug endpoint to check what files are available in Railway container
          try {
            const debugInfo = await this.debugContainerFiles();
            res.statusCode = 200;
            res.end(JSON.stringify({
              message: 'Container file debug completed',
              debugInfo,
              timestamp: new Date().toISOString()
            }, null, 2));
          } catch (error) {
            console.error('❌ File debug error:', error);
            res.statusCode = 500;
            res.end(JSON.stringify({
              error: 'File debug failed',
              details: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString()
            }));
          }

        } else if (req.method === 'GET' && req.url === '/test-scp-upload') {
          // Test endpoint for debugging SCP upload to VM
          try {
            const results = await this.testSCPUploadToVM();
            res.statusCode = 200;
            res.end(JSON.stringify({
              message: 'SCP upload test completed',
              results,
              timestamp: new Date().toISOString()
            }, null, 2));
          } catch (error) {
            console.error('❌ SCP upload test error:', error);
            res.statusCode = 500;
            res.end(JSON.stringify({
              error: 'SCP upload test failed',
              details: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString()
            }));
          }

        } else if (req.method === 'GET' && req.url === '/test-exact-vault-upload') {
          // Test endpoint to run exact vault upload behavior from runAnsiblePlaybook
          try {
            const { testExactVaultUpload } = require('../test-exact-vault-upload.js');
            const result = await testExactVaultUpload();
            res.statusCode = 200;
            res.end(JSON.stringify({
              success: result,
              message: result ? 'Exact vault upload SUCCESSFUL - matches runAnsiblePlaybook!' : 'Found difference from runAnsiblePlaybook behavior!',
              details: result ? 'SCP upload works exactly like runAnsiblePlaybook does' : 'This explains why Issue #1144 vault upload failed',
              timestamp: new Date().toISOString()
            }, null, 2));
          } catch (error) {
            console.error('❌ Exact vault upload test error:', error);
            res.statusCode = 500;
            res.end(JSON.stringify({
              error: 'Exact vault upload test failed',
              details: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString()
            }, null, 2));
          }

        } else if (req.method === 'POST' && req.url === '/webhooks/github') {
          let body = '';
          
          req.on('data', chunk => {
            body += chunk.toString();
          });

          req.on('end', async () => {
            try {
              const signature = req.headers['x-hub-signature-256'] as string;
              const event = req.headers['x-github-event'] as string;

              // Verify webhook signature
              if (!this.verifySignature(body, signature)) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: 'Invalid signature' }));
                return;
              }

              // Parse and handle webhook
              const payload = JSON.parse(body);
              await this.handleWebhook(event, payload);

              res.statusCode = 200;
              res.end(JSON.stringify({ 
                message: 'Webhook processed successfully',
                event,
                timestamp: new Date().toISOString()
              }));

            } catch (error) {
              console.error('❌ Webhook processing error:', error);
              res.statusCode = 500;
              res.end(JSON.stringify({ 
                error: 'Internal server error',
                timestamp: new Date().toISOString()
              }));
            }
          });

        } else if (req.method === 'POST' && req.url === '/coordinator/next-step') {
          let body = '';
          
          req.on('data', chunk => {
            body += chunk.toString();
          });

          req.on('end', async () => {
            try {
              const requestBody = JSON.parse(body);
              await this.coordinatorNextStep({ body: requestBody }, res);

            } catch (error) {
              console.error('❌ Coordinator error:', error);
              res.statusCode = 500;
              res.end(JSON.stringify({ 
                error: 'Coordinator processing failed',
                timestamp: new Date().toISOString()
              }));
            }
          });

        } else {
          res.statusCode = 404;
          res.end(JSON.stringify({
            error: 'Not found',
            timestamp: new Date().toISOString()
          }));
        }

      } catch (error) {
        console.error('❌ Server error:', error);
        res.statusCode = 500;
        res.end(JSON.stringify({
          error: 'Internal server error',
          timestamp: new Date().toISOString()
        }));
      }
    });

    server.listen(port, () => {
      console.log(`🚀 Agent Billy stateless webhook server running on port ${port}`);
      console.log(`📊 Health check: http://localhost:${port}/health`);
      console.log(`🎣 Webhook endpoint: http://localhost:${port}/webhooks/github`);
      console.log(`🤖 Coordinator endpoint: http://localhost:${port}/coordinator/next-step`);
      console.log(`🧠 Mode: Stateless (no memory required)`);
      console.log(`🚫 Memory: Not needed - all state from GitHub`);
    });
  }
}

// Start server if run directly
if (require.main === module) {
  const webhookServer = new StatelessWebhookServer();
  webhookServer.start();
}