import * as http from 'http';
import * as crypto from 'crypto';
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

    console.log(`🤖 Billy processing issue #${issue.number} in ${owner}/${repo}`);

    // Step 1: Read repository configuration
    const config = await this.configReader.readRepositoryConfig(owner, repo);

    // Step 2: Check if clarification is needed (with full context)
    const clarificationCheck = await this.checkIfClarificationNeeded(issue, repository);

    if (clarificationCheck.needsClarification) {
      // Post clarification request
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
      }
    } else {
      // Step 3: Billy is ready to implement - execute configured workflow
      console.log(`🚀 Billy is ready to implement issue #${issue.number}`);
      await this.executeImplementationWorkflow(issue, repository, config);
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

    console.log(`🚀 Starting VM development workflow for issue #${issue.number}`);

    // Post initial status comment
    await this.actions.commentOnIssue(owner, repo, issue.number, 
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

    try {
      // Initialize VM orchestrator
      const vmOrchestrator = new VMOrchestrator();
      
      // Clean up old VMs first to avoid cost accumulation
      console.log(`🧹 Cleaning up old VMs before creating new one...`);
      await vmOrchestrator.destroyOldVMs('159.203.123.65'); // Keep current working VM
      
      // Generate unique VM name
      const vmName = `billy-${repo}-${issue.number}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      
      // Get VM config from repository config or use defaults  
      const vmSize = config?.billy.vm_development?.vm_size || 's-2vcpu-2gb';
      // TEMPORARY: Use local test playbook until proven working end-to-end
      const playbookPath = 'test-complete-environment.yml';
      
      console.log(`🔧 VM Config - Size: ${vmSize}, Playbook: ${playbookPath}`);

      // CRITICAL: Create VM with SSH key embedded in cloud-config (NOT via DigitalOcean API)
      // See CLAUDE.md "SSH Key Configuration" section for detailed explanation
      const vm = await vmOrchestrator.createVM({
        name: vmName,
        region: 'nyc3',
        size: vmSize,
        image: 'ubuntu-22-04-x64',
        sshKeys: [], // NEVER use DigitalOcean SSH key management - unreliable
        userData: this.generateVMSetupScript(owner, repo, playbookPath, issue)
      });

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
      
      // Update with ready status
      await this.actions.commentOnIssue(owner, repo, issue.number, 
        `🎉 **VM Ready - Testing Phase 1 Setup!**
        
**VM Status:**
- ✅ VM is running
- ✅ Public IP: ${readyVM.publicIp}
- ✅ Basic setup completed

**Phase 1 Testing:**
- 🔍 Testing SSH connectivity
- 🔍 Verifying cloud-config execution via SSH
- 🔍 Checking basic VM setup completion

*Testing minimal setup before Ansible execution...*`);

      // Create SSH key file with proper base64 decoding (SOLUTION TO PERSISTENT SSH ISSUE)
      const fs = require('fs');
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

      // PHASE 1: Wait for cloud-init completion instead of SSH test
      // Billy waits for cloud-init to complete Node.js installation before Ansible
      console.log(`⏳ Waiting for cloud-init to complete on VM ${readyVM.publicIp}`);
      console.log(`🔍 Checking for enhanced setup completion...`);
      
      const phase1Success = await this.waitForVMReadiness(readyVM.publicIp || '');
      
      if (!phase1Success) {
        await this.actions.commentOnIssue(owner, repo, issue.number, 
          `❌ **Phase 1 Failed - Basic VM Setup Issues**
          
**What Failed:**
- SSH connectivity test failed
- Basic cloud-config may not have executed properly
- Cannot proceed to Ansible setup

**Next Steps:**
- Check cloud-config syntax and execution
- Verify SSH key embedding in cloud-config
- Debug basic VM initialization

*VM available for manual debugging at ${readyVM.publicIp}*`);
        
        await this.actions.addLabel(owner, repo, issue.number, 'billy-phase1-failed');
        return;
      }

      // PHASE 1 SUCCESS - SSH KICKOFF AUTOMATION
      console.log(`🚀 SSH kickoff: Starting background automation on ${readyVM.publicIp}`);
      
      const automationStarted = await this.startBackgroundAutomation(readyVM.publicIp || '', owner, repo, issue);
      
      if (!automationStarted) {
        await this.actions.commentOnIssue(owner, repo, issue.number, 
          `❌ **SSH Kickoff Failed**
          
**What Failed:**
- Could not SSH into VM to start automation
- Background automation script not started
- VM is running but automation blocked

**Debug Steps:**
\`\`\`bash
ssh ubuntu@${readyVM.publicIp} "cat /home/ubuntu/billy-status.log"
ssh ubuntu@${readyVM.publicIp} "ps aux | grep -E '(ansible|automation)'"
\`\`\`

*VM available for manual debugging at ${readyVM.publicIp}*`);
        
        await this.actions.addLabel(owner, repo, issue.number, 'billy-kickoff-failed');
        return;
      }

      // SUCCESSFUL KICKOFF
      await this.actions.commentOnIssue(owner, repo, issue.number, 
        `🚀 **Automation Started Successfully!**
        
**Hybrid Architecture Working:**
- ✅ VM provisioned and SSH access confirmed
- ✅ Background automation script started via SSH
- ✅ Railway job completing (timeout immunity achieved)
- 🔄 VM continuing automation independently

**What's Running:**
- 📦 Installing Node.js, Firebase, Claude CLI
- 🖥️ Setting up desktop environment (VNC, Firefox)  
- 📁 Cloning GiveGrove and installing dependencies
- 🤖 Configuring autonomous Claude CLI implementation

**Monitor Progress:**
\`\`\`bash
ssh ubuntu@${readyVM.publicIp} "tail -f /home/ubuntu/automation.log"

**VM Self-Configuration Process:**
1. 📥 Download Ansible playbook and secrets from Railway
2. 🔧 Install Ansible and run playbook locally on VM
3. 📦 Setup complete GiveGrove development environment
4. 🎯 Ready for autonomous implementation

**SSH Monitoring Commands:**
\`\`\`bash
# Check configuration progress
ssh ubuntu@${readyVM.publicIp} "tail -f /var/log/billy-ansible.log"

# Verify completion status  
ssh ubuntu@${readyVM.publicIp} "cat /var/log/billy-completion-status.log"

# Check services
ssh ubuntu@${readyVM.publicIp} "ps aux | grep -E '(vite|firebase|claude)'"
\`\`\`

**Next Steps:**
- Railway job ending (timeout immunity achieved!)
- VM continuing configuration independently
- Use SSH commands above to monitor progress
- Expected completion time: 10-15 minutes

---
*Agent Billy VM Self-Configuration (Cloud-Init Architecture)*`);

      await this.actions.addLabel(owner, repo, issue.number, 'billy-vm-configuring');
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

  // Run Ansible playbook on the VM from Railway container
  private async runAnsiblePlaybook(vmIp: string, owner: string, repo: string, playbookPath: string): Promise<boolean> {
    try {
      console.log(`🔧 Running Ansible playbook on VM ${vmIp}`);
      
      const fs = require('fs');
      const path = require('path');
      const { spawn } = require('child_process');
      
      // Create temporary directory for ansible work
      const tempDir = `/tmp/ansible-${Date.now()}`;
      fs.mkdirSync(tempDir, { recursive: true });
      
      // TEMPORARY: Use Billy's local playbook instead of target repository's
      console.log(`📋 Using Billy's local test playbook: ${playbookPath}`);
      const repoPath = tempDir; // Use temp directory directly
      const ansiblePath = tempDir; // Ansible files are in Billy's working directory
      
      // Copy local test playbook and secrets to temp directory
      const localPlaybookPath = path.join(process.cwd(), playbookPath);
      const localSecretsPath = path.join(process.cwd(), 'secrets.yml');
      const localVaultPassPath = path.join(process.cwd(), '.vault_pass');
      
      fs.copyFileSync(localPlaybookPath, path.join(ansiblePath, playbookPath));
      fs.copyFileSync(localSecretsPath, path.join(ansiblePath, 'secrets.yml'));
      fs.copyFileSync(localVaultPassPath, path.join(ansiblePath, '.vault_pass'));
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
      
      // Run ansible-playbook
      const playbookFullPath = path.join(ansiblePath, playbookPath);
      
      return new Promise((resolve) => {
        const ansibleProcess = spawn('ansible-playbook', [
          playbookFullPath,
          '-i', inventoryPath,
          '-e', `vm_ip=${vmIp}`,
          '--vault-password-file', '.vault_pass',  // Use vault password for encrypted secrets
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
          console.log(`Ansible stdout: ${text}`);
        });
        
        ansibleProcess.stderr.on('data', (data: Buffer) => {
          const text = data.toString();
          errorOutput += text;
          console.log(`Ansible stderr: ${text}`);
        });
        
        ansibleProcess.on('close', (code: number) => {
          console.log(`Ansible process exited with code ${code}`);
          console.log(`Full output: ${output}`);
          
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
            console.error(`Error output: ${errorOutput}`);
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

  // CLOUD-INIT SELF-CONFIGURATION: VM downloads files from GitHub and runs Ansible locally (Railway timeout immune)
  private generateVMSetupScript(owner: string, repo: string, playbookPath: string, issue: any): string {
    // MINIMAL SSH-ONLY CLOUD-CONFIG 
    // No complex automation - Railway will SSH in to start background processes
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

runcmd:
  - echo "Billy VM created at $(date)" > /home/ubuntu/billy-status.log
  - echo "SSH access ready" >> /home/ubuntu/billy-status.log
  - echo "Waiting for Railway kickoff..." >> /home/ubuntu/billy-status.log`;
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
              webhook: '/webhooks/github'
            },
            timestamp: new Date().toISOString()
          }, null, 2));

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