import * as http from 'http';
import * as crypto from 'crypto';
import { GitHubSensor } from '../perception/githubSensor';
import { GitHubActions } from '../actions/githubActions';
import { callLLM } from '../cognition/llmWrapper';
import { PromptLoader } from '../cognition/promptLoader';

const port = process.env.PORT || 3000;
const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET || '';

export class StatelessWebhookServer {
  private sensor: GitHubSensor;
  private actions: GitHubActions;

  constructor() {
    this.sensor = new GitHubSensor();
    this.actions = new GitHubActions();
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

        default:
          console.log(`📝 Ignoring webhook event: ${event}`);
      }
    } catch (error) {
      console.error(`❌ Error handling webhook ${event}:`, error);
    }
  }

  // Handle issue events (opened, labeled, etc.)
  private async handleIssueEvent(payload: any): Promise<void> {
    const { action, issue } = payload;
    
    console.log(`📋 Issue #${issue.number} ${action}`);

    // Only process when 'for-billy' label is added
    if (action === 'labeled' && payload.label?.name === 'for-billy') {
      console.log(`🏷️  Issue #${issue.number} labeled for Billy - processing`);
      await this.processIssue(issue);
    }
  }

  // Handle issue comment events
  private async handleIssueCommentEvent(payload: any): Promise<void> {
    const { action, issue, comment } = payload;
    
    if (action !== 'created') return;

    console.log(`💬 New comment on issue #${issue.number} by ${comment.user.login}`);

    // Check if issue has 'needs-human' label and Billy previously commented
    if (issue.labels.some((l: any) => l.name === 'needs-human')) {
      // Check if Billy has commented before
      const billyComment = await this.findBillyComment(issue);
      if (billyComment && comment.user.login !== 'agent-billy' && comment.user.login !== 'agent-billy[bot]') {
        console.log(`🔄 Potential clarification response on issue #${issue.number}`);
        await this.processClarificationResponse(issue, billyComment, comment);
      }
    }
  }

  // Process an issue labeled for Billy
  private async processIssue(issue: any): Promise<void> {
    const owner = issue.repository.owner.login;
    const repo = issue.repository.name;

    // Check if Billy already commented
    const existingComment = await this.findBillyComment(issue);
    if (existingComment) {
      console.log(`✅ Billy already processed issue #${issue.number}`);
      return;
    }

    // Check if clarification is needed
    const clarificationCheck = await this.checkIfClarificationNeeded(issue);

    if (clarificationCheck.needsClarification) {
      // Post clarification request
      const comment = await this.actions.commentOnIssue(
        owner,
        repo,
        issue.number,
        `Hi @${issue.user.login}! 👋

I need some clarification before I can proceed with this issue.

${clarificationCheck.questions}

I've labeled this issue as \`needs-human\`. Once you provide the clarification, I'll be able to help with the implementation!

Thanks!
Agent Billy 🤖`
      );

      if (comment) {
        await this.actions.removeLabel(owner, repo, issue.number, 'for-billy');
        await this.actions.addLabel(owner, repo, issue.number, 'needs-human');
        console.log(`❓ Billy requested clarification on issue #${issue.number}`);
      }
    } else {
      // Process normally
      const response = await this.processIssueWithLLM(issue);
      if (response) {
        const comment = await this.actions.commentOnIssue(owner, repo, issue.number, response);
        if (comment) {
          await this.actions.removeLabel(owner, repo, issue.number, 'for-billy');
          console.log(`✅ Billy responded to issue #${issue.number}`);
        }
      }
    }
  }

  // Find Billy's comment on an issue
  private async findBillyComment(issue: any): Promise<any> {
    const owner = issue.repository.owner.login;
    const repo = issue.repository.name;
    
    const comments = await this.sensor.getIssueComments(owner, repo, issue.number);
    return comments.find(c => 
      c.user.login === 'agent-billy' || 
      c.user.login === 'agent-billy[bot]' ||
      c.user.login === process.env.AGENT_USERNAME
    );
  }

  // Check if clarification is needed
  private async checkIfClarificationNeeded(issue: any): Promise<{ needsClarification: boolean; questions?: string }> {
    try {
      const prompt = await PromptLoader.loadPrompt('clarificationCheckGiveGrove', {
        issueTitle: issue.title,
        issueBody: issue.body || 'No description provided',
        issueNumber: issue.number.toString(),
        labels: issue.labels.map((l: any) => l.name).join(', ') || 'No labels',
        author: issue.user.login
      });

      const response = await callLLM({
        prompt,
        options: { temperature: 0.3, maxTokens: 400 }
      });

      const content = response.content.trim();

      if (content.includes('✅ Ready to proceed.')) {
        return { needsClarification: false };
      } else if (content.includes('❓ Need clarification on:')) {
        let questions = content.replace('❓ Need clarification on:', '').trim();
        
        // Extract only numbered questions
        const lines = questions.split('\n');
        const questionLines: string[] = [];
        for (const line of lines) {
          if (line.match(/^\d+\./) || (questionLines.length > 0 && line.startsWith('   '))) {
            questionLines.push(line);
          } else if (line.trim() === '') {
            if (questionLines.length > 0) questionLines.push(line);
          } else {
            break;
          }
        }
        
        questions = questionLines.join('\n').trim();
        return { needsClarification: true, questions };
      }

      return { needsClarification: false };
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

  // Process clarification response
  private async processClarificationResponse(issue: any, billyComment: any, userComment: any): Promise<void> {
    // For now, just acknowledge the response
    const owner = issue.repository.owner.login;
    const repo = issue.repository.name;

    // Simple check: if user responded, assume clarification provided
    await this.actions.removeLabel(owner, repo, issue.number, 'needs-human');
    await this.actions.addLabel(owner, repo, issue.number, 'for-billy');
    
    console.log(`✅ Clarification received for issue #${issue.number}, re-labeled for processing`);
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
    });
  }
}

// Start server if run directly
if (require.main === module) {
  const webhookServer = new StatelessWebhookServer();
  webhookServer.start();
}