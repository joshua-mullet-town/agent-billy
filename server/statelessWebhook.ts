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
      
      // Generate unique VM name
      const vmName = `billy-${repo}-${issue.number}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      
      // Get VM config from repository config or use defaults
      const vmSize = config?.billy.vm_development?.vm_size || 's-2vcpu-2gb';
      const playbookPath = config?.billy.vm_development?.ansible_playbook || 'ansible/claude-code-environment.yml';
      
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
        `🎉 **VM Ready for Development!**
        
**VM Status:**
- ✅ VM is running
- ✅ Public IP: ${readyVM.publicIp}
- ✅ Environment setup in progress

**Next Phase:**
- Ansible playbook execution
- Claude Code CLI installation
- Autonomous development begins

*VM development environment is now active*`);

      await this.actions.addLabel(owner, repo, issue.number, 'billy-vm-active');
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

  // Generate VM setup with SSH key directly in cloud-config
  // CRITICAL: This approach was learned through painful debugging - see CLAUDE.md for details
  private generateVMSetupScript(owner: string, repo: string, playbookPath: string, issue: any): string {
    return `#cloud-config
users:
  - name: ubuntu
    ssh_authorized_keys:
      - ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICOWn4+jHkJv1qZnX++HA26lDCeKzHAP1UFJkMIxjHAl joshuamullet@Joshuas-MacBook-Air.local
    sudo: ALL=(ALL) NOPASSWD:ALL

packages:
  - python3

runcmd:
  - echo "Billy VM cloud-init started at $(date)" > /var/log/billy-status.log
  - echo "SSH key installed via cloud-config" >> /var/log/billy-status.log
  - echo "Issue ${issue.number} processed" >> /var/log/billy-status.log
  - echo "Repository ${owner}/${repo}" >> /var/log/billy-status.log
  - echo "Starting web server..." >> /var/log/billy-status.log
  - cd /var/log && python3 -m http.server 8080 &
  - echo "Web server started - cloud-init working!" >> /var/log/billy-status.log
  - echo "Billy VM setup completed at $(date)" >> /var/log/billy-status.log
`;
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