import * as http from 'http';
import * as crypto from 'crypto';
import { AgentBilly } from '../core/agentBilly';
import { EnhancedAgentBilly } from '../core/enhancedAgentBilly';

const port = process.env.PORT || 3000;
const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET || '';

export class WebhookServer {
  private billy: EnhancedAgentBilly;

  constructor() {
    this.billy = new EnhancedAgentBilly({
      githubToken: process.env.GITHUB_TOKEN,
      digitalOceanToken: process.env.DIGITAL_OCEAN_TOKEN,
      claudeApiKey: process.env.CLAUDE_API_KEY,
      defaultOwner: process.env.DEFAULT_GITHUB_OWNER,
      defaultRepo: process.env.DEFAULT_GITHUB_REPO,
      assigneeUsername: process.env.AGENT_USERNAME || 'agent-billy'
    });
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

        case 'issue_comment':
          await this.handleIssueCommentEvent(payload);
          break;

        case 'pull_request':
          await this.handlePullRequestEvent(payload);
          break;

        default:
          console.log(`📝 Ignoring webhook event: ${event}`);
      }
    } catch (error) {
      console.error(`❌ Error handling webhook ${event}:`, error);
    }
  }

  // Handle issue events (assigned, labeled, etc.)
  private async handleIssueEvent(payload: any): Promise<void> {
    const { action, issue, assignee } = payload;
    
    console.log(`📋 Issue #${issue.number} ${action}`);

    // Trigger Billy when issues are assigned to him
    if (action === 'assigned' && assignee?.login === process.env.AGENT_USERNAME) {
      console.log(`🎯 Billy assigned to issue #${issue.number} - processing`);
      await this.billy.checkAndHandleAssignedIssuesWithVM();
    }

    // Check for label-based triggers
    if (action === 'labeled' && issue.labels.some((l: any) => l.name === 'agent-billy')) {
      console.log(`🏷️  Issue #${issue.number} labeled for Billy - processing`);
      await this.billy.checkAndHandleAssignedIssuesWithVM();
    }
  }

  // Handle issue comment events
  private async handleIssueCommentEvent(payload: any): Promise<void> {
    const { action, issue, comment } = payload;
    
    if (action !== 'created') return;

    console.log(`💬 New comment on issue #${issue.number} by ${comment.user.login}`);

    // Check if Billy was mentioned
    if (comment.body.includes('@agent-billy') || comment.body.includes('@' + process.env.AGENT_USERNAME)) {
      console.log(`🔔 Billy mentioned in issue #${issue.number} - processing`);
      await this.billy.checkAndHandleAssignedIssuesWithVM();
    }

    // Check for clarification responses (any comment from non-Billy users)
    if (comment.user.login !== process.env.AGENT_USERNAME) {
      console.log(`🔄 Potential clarification response on issue #${issue.number} - checking`);
      await this.billy.checkAndHandleAssignedIssuesWithVM();
    }
  }

  // Handle pull request events
  private async handlePullRequestEvent(payload: any): Promise<void> {
    const { action, pull_request } = payload;
    
    console.log(`🔀 Pull request #${pull_request.number} ${action}`);
    
    // Billy could handle PR reviews, merges, etc. in the future
  }

  // Start the webhook server
  start(): void {
    const server = http.createServer(async (req, res) => {
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json');

      try {
        if (req.method === 'GET' && req.url === '/health') {
          // Health check endpoint
          const status = await this.billy.getStatus();
          res.statusCode = 200;
          res.end(JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            agent: {
              canTakeWork: status.canTakeWork,
              currentTasks: status.currentTasks.length,
              stats: status.stats
            }
          }, null, 2));

        } else if (req.method === 'GET' && req.url === '/') {
          // Root endpoint
          res.statusCode = 200;
          res.end(JSON.stringify({
            message: 'Agent Billy Webhook Server',
            endpoints: {
              health: '/health',
              webhook: '/webhooks/github'
            },
            timestamp: new Date().toISOString()
          }, null, 2));

        } else if (req.method === 'POST' && req.url === '/webhooks/github') {
          // GitHub webhook endpoint
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
          // 404 for unknown endpoints
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
      console.log(`🚀 Agent Billy webhook server running on port ${port}`);
      console.log(`📊 Health check: http://localhost:${port}/health`);
      console.log(`🎣 Webhook endpoint: http://localhost:${port}/webhooks/github`);
    });
  }
}

// Start server if run directly
if (require.main === module) {
  const webhookServer = new WebhookServer();
  webhookServer.start();
}