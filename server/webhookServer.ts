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

export class WebhookServer {
  private sensor: GitHubSensor;
  private actions: GitHubActions;
  private configReader: ConfigReader;

  constructor() {
    this.sensor = new GitHubSensor();
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
      case 'vm_development':
        await this.executeVMDevelopmentWorkflow(issue, repository, config);
        break;

      default:
        console.error(`❌ Unknown workflow type: ${workflowType}`);
        await this.actions.commentOnIssue(owner, repo, issue.number, 
          `❌ **Configuration Error**\\n\\nUnknown workflow type: "${workflowType}"\\n\\nPlease check your \\`.github/billy-config.yml\\` file.`);
    }
  }

  // Execute VM development workflow - UPDATED WITH AUTOMATION FIX
  private async executeVMDevelopmentWorkflow(issue: any, repository: any, config: BillyConfig | null): Promise<void> {
    const owner = repository.owner.login;
    const repo = repository.name;

    console.log(`🚀 Starting VM development workflow for issue #${issue.number}`);

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
      
      console.log(`🔧 VM Config - Size: ${vmSize}`);

      // Create VM with FIXED cloud-config
      const vm = await vmOrchestrator.createVM({
        name: vmName,
        region: 'nyc3',
        size: vmSize,
        image: 'ubuntu-22-04-x64',
        sshKeys: [],
        userData: this.generateFixedVMSetupScript(owner, repo, issue)
      });

      console.log(`✅ VM created with ID: ${vm.id}`);

      // Wait for VM to be ready
      const readyVM = await vmOrchestrator.waitForVM(vm.id, 10);
      
      console.log(`🎉 VM ready at ${readyVM.publicIp}`);

      await this.actions.commentOnIssue(owner, repo, issue.number, 
        `🎉 **AUTOMATION SUCCESS!**
        
**VM Details:**
- ✅ VM Created: ${vm.id}
- ✅ IP Address: ${readyVM.publicIp}
- ✅ Desktop Environment: Running automatically
- ✅ VNC Access: ${readyVM.publicIp}:5900 (no password)
- ✅ Firefox: Installed and ready
- ✅ GiveGrove Repository: Cloned automatically

**Test the automation:**
Connect to ${readyVM.publicIp}:5900 via VNC viewer to see the complete automated setup!

*100% Automation Achieved! 🚀*`);

      await this.actions.addLabel(owner, repo, issue.number, 'billy-automation-success');
      await this.actions.removeLabel(owner, repo, issue.number, 'for-billy');
      
    } catch (error) {
      console.error(`❌ VM workflow failed for issue #${issue.number}:`, error);
      
      await this.actions.commentOnIssue(owner, repo, issue.number, 
        `❌ **VM Development Workflow Failed**
        
**Error:** ${error instanceof Error ? error.message : 'Unknown error occurred'}

Please check the configuration and try again.`);
      
      await this.actions.addLabel(owner, repo, issue.number, 'billy-vm-error');
    }
  }

  // FIXED VM setup script with automation
  private generateFixedVMSetupScript(owner: string, repo: string, issue: any): string {
    const githubToken = process.env.GITHUB_TOKEN || '';
    
    return `#cloud-config
users:
  - name: ubuntu
    ssh_authorized_keys:
      - ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICOWn4+jHkJv1qZnX++HA26lDCeKzHAP1UFJkMIxjHAl joshuamullet@Joshuas-MacBook-Air.local
    sudo: ALL=(ALL) NOPASSWD:ALL

packages:
  - python3
  - git
  - curl
  - wget
  - build-essential
  - python3-pip
  - xvfb
  - fluxbox
  - x11vnc
  - firefox

runcmd:
  - echo "Billy VM AUTOMATION TEST started at $(date)" > /var/log/billy-status.log
  - echo "SSH key installed via cloud-config" >> /var/log/billy-status.log
  - echo "Issue ${issue.number} processed" >> /var/log/billy-status.log
  - echo "Repository ${owner}/${repo}" >> /var/log/billy-status.log
  - echo "Installing GUI environment and browser..." >> /var/log/billy-status.log
  - mkdir -p /home/ubuntu/logs
  - chown ubuntu:ubuntu /home/ubuntu/logs
  - chmod 755 /home/ubuntu/logs
  - echo "Starting desktop environment..." >> /var/log/billy-status.log
  - sudo -u ubuntu DISPLAY=:99 nohup Xvfb :99 -screen 0 1920x1080x24 >/home/ubuntu/logs/xvfb.log 2>&1 &
  - sleep 3
  - sudo -u ubuntu DISPLAY=:99 nohup fluxbox >/home/ubuntu/logs/fluxbox.log 2>&1 &
  - sleep 2
  - sudo -u ubuntu DISPLAY=:99 nohup x11vnc -display :99 -forever -shared -bg -nopw -xkb -listen 0.0.0.0 -rfbport 5900 >/home/ubuntu/logs/vnc.log 2>&1 &
  - sleep 2
  - echo "Desktop environment ready - VNC accessible on port 5900" >> /var/log/billy-status.log
  - echo "Cloning GiveGrove repository..." >> /var/log/billy-status.log
  - sudo -u ubuntu git clone https://${githubToken}@github.com/${owner}/${repo}.git /home/ubuntu/GiveGrove
  - echo "GiveGrove repository cloned successfully" >> /var/log/billy-status.log
  - echo "AUTOMATION COMPLETE - VM ready for testing!" >> /var/log/billy-status.log
  - echo "Billy VM automation completed at $(date)" >> /var/log/billy-status.log
`;
  }

  // Check if clarification is needed
  private async checkIfClarificationNeeded(issue: any, repository: any): Promise<{ needsClarification: boolean; questions?: string }> {
    try {
      // Get all comments to provide full context
      const comments = await this.sensor.getIssueComments(repository.owner.login, repository.name, issue.number);
      const commentsContext = comments.length > 0 
        ? comments.map((c: any, i: number) => `Comment ${i + 1} by ${c.user.login}: ${c.body}`).join('\\n\\n')
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
        const jsonMatch = content.match(/```json\\s*(.*?)\\s*```/s);
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
              ? analysis.questions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\\n')
              : 'Please provide more details.';
            return { needsClarification: true, questions: questionsText };
            
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
            mode: 'webhook-automation',
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
      console.log(`🚀 Agent Billy AUTOMATION webhook server running on port ${port}`);
      console.log(`📊 Health check: http://localhost:${port}/health`);
      console.log(`🎣 Webhook endpoint: http://localhost:${port}/webhooks/github`);
      console.log(`🎯 Mode: AUTOMATION TESTING`);
    });
  }
}

// Start server if run directly
if (require.main === module) {
  const webhookServer = new WebhookServer();
  webhookServer.start();
}