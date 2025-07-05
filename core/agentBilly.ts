import { GitHubSensor, GitHubIssue } from '../perception/githubSensor';
import { GitHubActions } from '../actions/githubActions';
import { AgentMemory, TaskMemory, ProcessedIssue } from '../memory/agentMemory';
import { callLLM } from '../cognition/llmWrapper';
import { PromptLoader } from '../cognition/promptLoader';

export interface AgentConfig {
  githubToken?: string;
  defaultOwner?: string;
  defaultRepo?: string;
  assigneeUsername?: string;
  dryRun?: boolean;
}

export class AgentBilly {
  private sensor: GitHubSensor;
  private actions: GitHubActions;
  private memory: AgentMemory;
  private config: AgentConfig;

  constructor(config: AgentConfig = {}) {
    this.config = {
      assigneeUsername: 'agent-billy',
      dryRun: false,
      ...config
    };

    this.sensor = new GitHubSensor(config.githubToken);
    this.actions = new GitHubActions(config.githubToken);
    this.memory = new AgentMemory();
  }

  // Billy's main cognitive process: check for work and handle it
  async checkAndHandleAssignedIssues(): Promise<void> {
    if (!this.config.defaultOwner || !this.config.defaultRepo) {
      console.log('⚠️  No default repo configured. Billy needs to know where to look for work.');
      return;
    }

    const repoFullName = `${this.config.defaultOwner}/${this.config.defaultRepo}`;
    
    try {
      // Record that Billy is starting a cycle
      await this.memory.recordCycle();
      
      // Perception: What issues are assigned to me?
      const assignedIssues = await this.sensor.getAssignedIssues(
        this.config.defaultOwner,
        this.config.defaultRepo,
        this.config.assigneeUsername!
      );

      if (assignedIssues.length === 0) {
        console.log('😌 No assigned issues found. Billy is taking a well-deserved break.');
        return;
      }

      let processedCount = 0;
      let skippedCount = 0;

      for (const issue of assignedIssues) {
        const wasProcessed = await this.handleSingleIssue(issue);
        if (wasProcessed) {
          processedCount++;
        } else {
          skippedCount++;
        }
      }

      // Also check for issues awaiting clarification that might have responses
      const clarificationProcessed = await this.checkClarificationResponses();
      processedCount += clarificationProcessed;

      console.log(`📊 Cycle complete: ${processedCount} processed, ${skippedCount} skipped`);

    } catch (error) {
      console.error('❌ Billy encountered an error while checking issues:', error);
    }
  }

  // Billy's process for handling a single issue
  private async handleSingleIssue(issue: GitHubIssue): Promise<boolean> {
    const repoFullName = `${this.config.defaultOwner}/${this.config.defaultRepo}`;
    
    // Memory: Have I already processed this issue?
    if (await this.memory.hasProcessedIssue(issue.number, repoFullName)) {
      console.log(`🧠 Issue #${issue.number} already processed, skipping`);
      return false;
    }

    // Perception: Have I already commented on this issue?
    const alreadyCommented = await this.sensor.hasAlreadyCommented(
      this.config.defaultOwner!,
      this.config.defaultRepo!,
      issue.number,
      this.config.assigneeUsername
    );

    if (alreadyCommented) {
      console.log(`💬 Billy already commented on issue #${issue.number}, marking as processed`);
      await this.memory.markIssueProcessed(issue.number, repoFullName, 'acknowledged');
      return false;
    }

    // Memory: Can I take on more work?
    if (!(await this.memory.canTakeNewTask())) {
      console.log(`⏰ Billy is at capacity, will process issue #${issue.number} later`);
      return false;
    }

    console.log(`🎯 Billy is handling issue #${issue.number}: ${issue.title.substring(0, 50)}...`);

    // Start tracking this task
    const taskId = await this.memory.startTask({
      type: 'issue_comment',
      issueNumber: issue.number,
      repoFullName,
      status: 'in_progress',
      context: {
        issueTitle: issue.title,
        issueBody: issue.body,
        labels: issue.labels.map(l => l.name)
      }
    });

    try {
      // Cognition: Does Billy need clarification?
      const clarificationCheck = await this.checkIfClarificationNeeded(issue);

      if (clarificationCheck.needsClarification) {
        // Billy needs clarification - post questions and set up workflow
        console.log(`❓ Billy needs clarification for issue #${issue.number}`);
        
        const clarificationComment = `Hi @${issue.user.login}! 👋

I need some clarification before I can proceed with this issue.

${clarificationCheck.questions}

I've labeled this issue as \`needs-human\` and assigned it back to you. Once you provide the clarification, I'll be able to help with the implementation!

Thanks!
Agent Billy 🤖`;

        if (this.config.dryRun) {
          console.log(`🔄 [DRY RUN] Billy would request clarification on issue #${issue.number}:`);
          console.log('─'.repeat(50));
          console.log(clarificationComment);
          console.log('─'.repeat(50));
          console.log(`🔄 [DRY RUN] Billy would add label "needs-human"`);
          console.log(`🔄 [DRY RUN] Billy would reassign from ${this.config.assigneeUsername} to ${issue.user.login}`);
          
          await this.memory.markIssueProcessed(
            issue.number, 
            repoFullName, 
            'awaiting_clarification',
            undefined,
            undefined,
            {
              questions: clarificationCheck.questions || '',
              originalAssignee: issue.user.login
            }
          );
        } else {
          // Post clarification comment
          const comment = await this.actions.commentOnIssue(
            this.config.defaultOwner!,
            this.config.defaultRepo!,
            issue.number,
            clarificationComment
          );

          if (comment) {
            // Add needs-human label
            await this.actions.addLabel(
              this.config.defaultOwner!,
              this.config.defaultRepo!,
              issue.number,
              'needs-human'
            );

            // Reassign to original assignee
            await this.actions.reassignIssue(
              this.config.defaultOwner!,
              this.config.defaultRepo!,
              issue.number,
              this.config.assigneeUsername!,
              issue.user.login
            );

            // Track in memory
            await this.memory.markIssueProcessed(
              issue.number, 
              repoFullName, 
              'awaiting_clarification',
              comment.id,
              comment.html_url,
              {
                questions: clarificationCheck.questions || '',
                originalAssignee: issue.user.login
              }
            );

            await this.memory.logTaskAction(taskId, 'clarification_requested', {
              commentId: comment.id,
              commentUrl: comment.html_url,
              questions: clarificationCheck.questions || ''
            });

            console.log(`❓ Billy requested clarification on issue #${issue.number}: ${comment.html_url}`);
          } else {
            await this.memory.markIssueProcessed(issue.number, repoFullName, 'skipped');
          }
        }
      } else {
        // Billy has enough information - proceed with normal analysis
        const response = await this.processIssueWithLLM(issue);

        if (response) {
          // Action: Billy comments on the issue
          if (this.config.dryRun) {
            console.log(`🔄 [DRY RUN] Billy would comment on issue #${issue.number}:`);
            console.log('─'.repeat(50));
            console.log(response);
            console.log('─'.repeat(50));
            
            // Mark as processed in dry run mode too
            await this.memory.markIssueProcessed(issue.number, repoFullName, 'responded');
          } else {
            const comment = await this.actions.commentOnIssue(
              this.config.defaultOwner!,
              this.config.defaultRepo!,
              issue.number,
              response
            );

            if (comment) {
              await this.memory.logTaskAction(taskId, 'comment_posted', {
                commentId: comment.id,
                commentUrl: comment.html_url
              });
              
              // Mark as processed with comment details
              await this.memory.markIssueProcessed(
                issue.number, 
                repoFullName, 
                'responded',
                comment.id,
                comment.html_url
              );
              
              console.log(`✅ Billy commented on issue #${issue.number}: ${comment.html_url}`);
            } else {
              await this.memory.markIssueProcessed(issue.number, repoFullName, 'skipped');
            }
          }
        } else {
          console.log(`⚠️  Billy couldn't generate a response for issue #${issue.number}`);
          await this.memory.markIssueProcessed(issue.number, repoFullName, 'skipped');
        }
      }

      await this.memory.completeTask(taskId, 'completed');
      return true;

    } catch (error) {
      console.error(`❌ Billy failed to handle issue #${issue.number}:`, error);
      await this.memory.completeTask(taskId, 'failed');
      await this.memory.markIssueProcessed(issue.number, repoFullName, 'skipped');
      return false;
    }
  }

  // Billy's cognition: check if clarification is needed
  private async checkIfClarificationNeeded(issue: GitHubIssue): Promise<{
    needsClarification: boolean;
    questions?: string;
  }> {
    try {
      const prompt = await PromptLoader.loadPrompt('clarificationCheck', {
        issueTitle: issue.title,
        issueBody: issue.body || 'No description provided',
        issueNumber: issue.number.toString(),
        labels: issue.labels.map(l => l.name).join(', ') || 'No labels',
        author: issue.user.login
      });

      console.log('🤔 Billy is checking if clarification is needed...');
      const response = await callLLM({
        prompt,
        options: {
          temperature: 0.3,
          maxTokens: 400
        }
      });

      const content = response.content.trim();
      
      if (content.includes('✅ Ready to proceed.')) {
        return { needsClarification: false };
      } else if (content.includes('❓ Need clarification on:')) {
        const questions = content.replace('❓ Need clarification on:', '').trim();
        return { 
          needsClarification: true, 
          questions: questions
        };
      } else {
        // Default to needing clarification if response is unclear
        return { 
          needsClarification: true, 
          questions: content
        };
      }

    } catch (error) {
      console.error('❌ Billy failed to check clarification needs:', error);
      // Default to not needing clarification if there's an error
      return { needsClarification: false };
    }
  }

  // Billy's cognition: process an issue through LLM  
  private async processIssueWithLLM(issue: GitHubIssue): Promise<string | null> {
    try {
      // Load Billy's issue analysis prompt
      const prompt = await PromptLoader.loadPrompt('issueAnalysis', {
        issueTitle: issue.title,
        issueBody: issue.body || 'No description provided',
        issueNumber: issue.number.toString(),
        labels: issue.labels.map(l => l.name).join(', ') || 'No labels',
        author: issue.user.login
      });

      // Billy thinks about the issue
      console.log('🤔 Billy is analyzing the issue...');
      const response = await callLLM({
        prompt,
        options: {
          temperature: 0.7,
          maxTokens: 500
        }
      });

      return response.content;

    } catch (error) {
      console.error('❌ Billy failed to process issue with LLM:', error);
      return null;
    }
  }

  // Billy can check his current status
  async getStatus(): Promise<{
    currentTasks: TaskMemory[];
    canTakeWork: boolean;
    lastActive: string;
    stats: {
      totalIssuesProcessed: number;
      totalCommentsPosted: number;
      totalCyclesRun: number;
      lastCycleAt?: string;
    };
  }> {
    const state = await this.memory.getState();
    const currentTasks = await this.memory.getCurrentTasks();
    const canTakeWork = await this.memory.canTakeNewTask();

    return {
      currentTasks,
      canTakeWork,
      lastActive: state.lastActiveAt,
      stats: state.stats
    };
  }

  // Billy checks for responses to clarification requests
  private async checkClarificationResponses(): Promise<number> {
    if (!this.config.defaultOwner || !this.config.defaultRepo) {
      return 0;
    }

    const repoFullName = `${this.config.defaultOwner}/${this.config.defaultRepo}`;
    const awaitingClarification = await this.memory.getIssuesAwaitingClarification(repoFullName);
    
    if (awaitingClarification.length === 0) {
      return 0;
    }

    console.log(`🔍 Billy is checking ${awaitingClarification.length} issue(s) awaiting clarification...`);
    let processedCount = 0;

    for (const processedIssue of awaitingClarification) {
      try {
        // Get the latest issue data
        const issue = await this.sensor.getIssue(
          this.config.defaultOwner,
          this.config.defaultRepo,
          processedIssue.issueNumber
        );

        if (!issue) {
          console.log(`⚠️  Issue #${processedIssue.issueNumber} not found, marking as skipped`);
          await this.memory.markIssueProcessed(processedIssue.issueNumber, repoFullName, 'skipped');
          continue;
        }

        // Check if there are new comments since the clarification request
        const comments = await this.sensor.getIssueComments(
          this.config.defaultOwner,
          this.config.defaultRepo,
          processedIssue.issueNumber
        );

        const clarificationRequestTime = new Date(processedIssue.clarificationRequest?.requestedAt || processedIssue.processedAt);
        const newComments = comments.filter(comment => 
          new Date(comment.created_at) > clarificationRequestTime &&
          comment.user.login !== this.config.assigneeUsername // Ignore Billy's own comments
        );

        if (newComments.length === 0) {
          // No new comments yet, keep waiting
          continue;
        }

        console.log(`💬 Found ${newComments.length} new comment(s) on issue #${processedIssue.issueNumber}`);

        // Analyze if the comments answer the clarification questions
        const analysisResult = await this.analyzeClarificationResponse(
          processedIssue,
          newComments
        );

        if (analysisResult.questionsAnswered) {
          // Questions answered - remove label and reassign to Billy
          console.log(`✅ Clarification received for issue #${processedIssue.issueNumber}`);

          if (this.config.dryRun) {
            console.log(`🔄 [DRY RUN] Billy would remove "needs-human" label`);
            console.log(`🔄 [DRY RUN] Billy would reassign to ${this.config.assigneeUsername}`);
            console.log(`🔄 [DRY RUN] Billy would post acknowledgment comment`);
          } else {
            // Remove needs-human label
            await this.actions.removeLabel(
              this.config.defaultOwner,
              this.config.defaultRepo,
              processedIssue.issueNumber,
              'needs-human'
            );

            // Reassign to Billy
            await this.actions.reassignIssue(
              this.config.defaultOwner,
              this.config.defaultRepo,
              processedIssue.issueNumber,
              issue.assignee?.login || issue.user.login,
              this.config.assigneeUsername!
            );

            // Post acknowledgment comment
            const acknowledgmentComment = `Thanks for the clarification! 🙏

${analysisResult.summary}

I'll proceed with the implementation now.

Agent Billy 🤖`;

            const comment = await this.actions.commentOnIssue(
              this.config.defaultOwner,
              this.config.defaultRepo,
              processedIssue.issueNumber,
              acknowledgmentComment
            );

            // Update memory status
            await this.memory.markIssueProcessed(
              processedIssue.issueNumber,
              repoFullName,
              'clarification_received',
              comment?.id,
              comment?.html_url
            );

            console.log(`🔄 Issue #${processedIssue.issueNumber} clarification complete - reassigned to Billy`);
          }

          processedCount++;
        } else {
          // Questions not fully answered - keep waiting or ask follow-up
          console.log(`❓ Issue #${processedIssue.issueNumber} clarification incomplete, continuing to wait`);
          
          // Update last checked timestamp
          await this.memory.markIssueProcessed(
            processedIssue.issueNumber,
            repoFullName,
            'awaiting_clarification'
          );
        }

      } catch (error) {
        console.error(`❌ Error checking clarification for issue #${processedIssue.issueNumber}:`, error);
      }
    }

    return processedCount;
  }

  // Billy analyzes whether comments answer his clarification questions
  private async analyzeClarificationResponse(
    processedIssue: ProcessedIssue,
    newComments: any[]
  ): Promise<{
    questionsAnswered: boolean;
    summary?: string;
  }> {
    try {
      const prompt = await PromptLoader.loadPrompt('commentAnalysis', {
        issueNumber: processedIssue.issueNumber.toString(),
        issueTitle: 'Issue Analysis',
        previousQuestions: processedIssue.clarificationRequest?.questions || 'No questions recorded',
        recentComments: newComments.map(c => 
          `**${c.user.login}** (${c.created_at}):\n${c.body}`
        ).join('\n\n---\n\n')
      });

      const response = await callLLM({
        prompt,
        options: {
          temperature: 0.3,
          maxTokens: 300
        }
      });

      const content = response.content.trim();
      
      if (content.includes('✅ Clarification received.')) {
        const summaryMatch = content.match(/Summary of answers:(.*?)(?:Ready to proceed|$)/s);
        return {
          questionsAnswered: true,
          summary: summaryMatch ? summaryMatch[1].trim() : 'Questions have been answered.'
        };
      } else {
        return { questionsAnswered: false };
      }

    } catch (error) {
      console.error('❌ Billy failed to analyze clarification response:', error);
      // Default to questions not answered if there's an error
      return { questionsAnswered: false };
    }
  }

  // Billy can work on a specific issue (for manual invocation)
  async handleSpecificIssue(owner: string, repo: string, issueNumber: number): Promise<void> {
    console.log(`🎯 Billy is specifically handling issue #${issueNumber} in ${owner}/${repo}`);

    const issue = await this.sensor.getIssue(owner, repo, issueNumber);
    if (!issue) {
      console.log(`❓ Billy couldn't find issue #${issueNumber}`);
      return;
    }

    // Temporarily override config for this specific task
    const originalConfig = { ...this.config };
    this.config.defaultOwner = owner;
    this.config.defaultRepo = repo;

    await this.handleSingleIssue(issue);

    // Restore original config
    this.config = originalConfig;
  }

  // Protected accessor methods for subclasses
  protected getSensor(): GitHubSensor {
    return this.sensor;
  }

  protected getActions(): GitHubActions {
    return this.actions;
  }

  protected getMemory(): AgentMemory {
    return this.memory;
  }

  protected getConfig(): AgentConfig {
    return this.config;
  }
}