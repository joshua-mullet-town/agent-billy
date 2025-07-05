import { AgentBilly, AgentConfig } from './agentBilly';
import { VMOrchestrator, VMInstance, Task, TaskResult } from './vmOrchestrator';
import { ClaudeCodeClient } from './claudeCodeClient';
import { GitHubIssue } from '../perception/githubSensor';
import { AgentMemory } from '../memory/agentMemory';

export interface EnhancedAgentConfig extends AgentConfig {
  digitalOceanToken?: string;
  claudeApiKey?: string;
  vmProvisioningEnabled?: boolean;
  playwrightTestingEnabled?: boolean;
  vmAutoTeardown?: boolean;
}

export interface DevelopmentTask {
  issue: GitHubIssue;
  clarificationContext?: any;
  vm?: VMInstance;
  status: 'pending' | 'provisioning' | 'developing' | 'testing' | 'completing' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  result?: TaskResult;
}

export class EnhancedAgentBilly extends AgentBilly {
  public vmOrchestrator: VMOrchestrator;
  private claudeCodeClient: ClaudeCodeClient;
  private enhancedConfig: EnhancedAgentConfig;
  private activeTasks: Map<string, DevelopmentTask> = new Map();

  constructor(config: EnhancedAgentConfig = {}) {
    super(config);
    
    this.enhancedConfig = {
      vmProvisioningEnabled: true,
      playwrightTestingEnabled: true,
      vmAutoTeardown: true,
      ...config
    };

    this.vmOrchestrator = new VMOrchestrator({
      digitalOceanToken: config.digitalOceanToken,
      ansibleVaultPassword: process.env.ANSIBLE_VAULT_PASSWORD
    });

    this.claudeCodeClient = new ClaudeCodeClient({
      apiKey: config.claudeApiKey,
      playwrightEnabled: config.playwrightTestingEnabled
    });
  }

  // Enhanced main cognitive process with VM orchestration
  async checkAndHandleAssignedIssuesWithVM(): Promise<void> {
    if (!this.enhancedConfig.defaultOwner || !this.enhancedConfig.defaultRepo) {
      console.log('⚠️  No default repo configured. Enhanced Billy needs to know where to look for work.');
      return;
    }

    const repoFullName = `${this.enhancedConfig.defaultOwner}/${this.enhancedConfig.defaultRepo}`;
    
    try {
      // First run standard clarification cycle
      await this.checkAndHandleAssignedIssues();

      // Then check for issues ready for development
      const readyIssues = await this.getIssuesReadyForDevelopment();

      if (readyIssues.length === 0) {
        console.log('😌 No issues ready for development. Enhanced Billy is monitoring...');
        return;
      }

      console.log(`🚀 Enhanced Billy found ${readyIssues.length} issue(s) ready for development`);

      // Process each ready issue with full VM workflow
      for (const issue of readyIssues) {
        await this.handleIssueWithVM(issue);
      }

    } catch (error) {
      console.error('❌ Enhanced Billy encountered an error:', error);
    }
  }

  // Get issues that have completed clarification and are ready for development
  private async getIssuesReadyForDevelopment(): Promise<GitHubIssue[]> {
    const repoFullName = `${this.enhancedConfig.defaultOwner}/${this.enhancedConfig.defaultRepo}`;
    
    // Get issues that received clarification
    const state = await this.getMemory().getState();
    const clarifiedIssues = state.processedIssues.filter((p: any) => 
      p.repoFullName === repoFullName && p.status === 'clarification_received'
    );
    
    const readyIssues: GitHubIssue[] = [];
    
    for (const processedIssue of clarifiedIssues) {
      // Check if issue is still assigned to Billy and open
      const issue = await this.getSensor().getIssue(
        this.enhancedConfig.defaultOwner!,
        this.enhancedConfig.defaultRepo!,
        processedIssue.issueNumber
      );

      if (issue && 
          issue.state === 'open' && 
          issue.assignees.some((a: any) => a.login === this.enhancedConfig.assigneeUsername)) {
        readyIssues.push(issue);
      }
    }

    return readyIssues;
  }

  // Handle a complete issue development workflow with VM
  async handleIssueWithVM(issue: GitHubIssue): Promise<void> {
    const taskId = `issue-${issue.number}-${Date.now()}`;
    
    console.log(`🎯 Enhanced Billy starting VM development for issue #${issue.number}: ${issue.title}`);

    // Create development task
    const developmentTask: DevelopmentTask = {
      issue,
      status: 'pending',
      startedAt: new Date()
    };

    this.activeTasks.set(taskId, developmentTask);

    try {
      // Phase 1: VM Provisioning
      if (this.enhancedConfig.vmProvisioningEnabled) {
        console.log(`🚀 Phase 1: Provisioning VM for issue #${issue.number}...`);
        developmentTask.status = 'provisioning';
        
        const vm = await this.vmOrchestrator.provisionVM(issue.number.toString());
        developmentTask.vm = vm;

        // Setup Claude Code environment
        await this.vmOrchestrator.setupClaudeCode(vm);
        
        console.log(`✅ VM ${vm.id} ready at ${vm.ip}`);
      } else {
        console.log('⚠️  VM provisioning disabled, skipping...');
        return;
      }

      // Phase 2: Development Execution
      console.log(`💻 Phase 2: Executing development task for issue #${issue.number}...`);
      developmentTask.status = 'developing';

      // Get clarification context
      const clarificationContext = await this.getClarificationContext(issue.number);
      
      // Create task for Claude Code
      const task: Task = {
        issueNumber: issue.number,
        issueTitle: issue.title,
        issueBody: issue.body,
        clarificationContext,
        testingRequired: true,
        playwrightEnabled: this.enhancedConfig.playwrightTestingEnabled || false
      };

      // Execute task with Claude Code
      const result = await this.claudeCodeClient.executeWithPlaywright(developmentTask.vm!, task);
      developmentTask.result = result;

      // Phase 3: Results and Communication
      console.log(`📊 Phase 3: Processing results for issue #${issue.number}...`);
      developmentTask.status = 'completing';

      if (result.success) {
        // Post success comment
        await this.getActions().commentOnIssue(
          this.enhancedConfig.defaultOwner!,
          this.enhancedConfig.defaultRepo!,
          issue.number,
          this.buildSuccessComment(result)
        );

        // Update memory
        await this.getMemory().markIssueProcessed(
          issue.number,
          `${this.enhancedConfig.defaultOwner}/${this.enhancedConfig.defaultRepo}`,
          'development_completed',
          undefined,
          result.pullRequestUrl
        );

        developmentTask.status = 'completed';
        console.log(`🎉 Enhanced Billy completed issue #${issue.number} successfully!`);

      } else {
        // Post failure comment
        await this.getActions().commentOnIssue(
          this.enhancedConfig.defaultOwner!,
          this.enhancedConfig.defaultRepo!,
          issue.number,
          this.buildFailureComment(result)
        );

        developmentTask.status = 'failed';
        console.log(`❌ Enhanced Billy failed to complete issue #${issue.number}`);
      }

      developmentTask.completedAt = new Date();

    } catch (error) {
      console.error(`❌ VM workflow failed for issue #${issue.number}:`, error);
      developmentTask.status = 'failed';
      developmentTask.completedAt = new Date();

      // Post error comment
      await this.getActions().commentOnIssue(
        this.enhancedConfig.defaultOwner!,
        this.enhancedConfig.defaultRepo!,
        issue.number,
        this.buildErrorComment(error)
      );

    } finally {
      // Phase 4: Cleanup
      if (developmentTask.vm && this.enhancedConfig.vmAutoTeardown) {
        console.log(`🗑️  Phase 4: Cleaning up VM ${developmentTask.vm.id}...`);
        try {
          await this.vmOrchestrator.teardownVM(developmentTask.vm);
          console.log(`✅ VM ${developmentTask.vm.id} cleaned up successfully`);
        } catch (cleanupError) {
          console.error(`⚠️  Failed to cleanup VM ${developmentTask.vm.id}:`, cleanupError);
        }
      }

      // Remove from active tasks
      this.activeTasks.delete(taskId);
    }
  }

  // Get clarification context for an issue
  private async getClarificationContext(issueNumber: number): Promise<any> {
    const repoFullName = `${this.enhancedConfig.defaultOwner}/${this.enhancedConfig.defaultRepo}`;
    const processedIssue = await this.getMemory().getProcessedIssue(issueNumber, repoFullName);
    
    return processedIssue?.clarificationRequest || null;
  }

  // Build success comment for completed development
  private buildSuccessComment(result: TaskResult): string {
    return `🎉 **Development Task Completed Successfully!**

## Summary
${result.summary}

## Changes Made
A pull request has been created with the implementation: ${result.pullRequestUrl}

## Testing Results
${result.testResults}

## Next Steps
Please review the pull request and let me know if any adjustments are needed.

---
🤖 **Enhanced Agent Billy** - Autonomous Development Workflow
*Powered by Claude Code + Playwright MCP*`;
  }

  // Build failure comment for failed development
  private buildFailureComment(result: TaskResult): string {
    return `❌ **Development Task Failed**

## Issue Encountered
${result.error || 'Unknown error occurred during development'}

## Summary
${result.summary || 'Task could not be completed'}

## Logs
\`\`\`
${result.logs?.slice(-5).join('\n') || 'No logs available'}
\`\`\`

## Next Steps
I may need additional clarification or manual intervention to resolve this issue. Please provide guidance on how to proceed.

---
🤖 **Enhanced Agent Billy** - Autonomous Development Workflow`;
  }

  // Build error comment for workflow errors
  private buildErrorComment(error: any): string {
    return `⚠️ **Development Workflow Error**

An unexpected error occurred during the autonomous development workflow:

\`\`\`
${error instanceof Error ? error.message : String(error)}
\`\`\`

The development environment encountered an issue. This may require manual investigation.

---
🤖 **Enhanced Agent Billy** - Autonomous Development Workflow`;
  }

  // Get enhanced status including VM information
  async getEnhancedStatus(): Promise<{
    baseStatus: any;
    activeTasks: DevelopmentTask[];
    activeVMs: VMInstance[];
    capabilities: {
      vmProvisioning: boolean;
      claudeCode: boolean;
      playwrightTesting: boolean;
    };
  }> {
    const baseStatus = await this.getStatus();
    const activeVMs = await this.vmOrchestrator.listActiveVMs();

    return {
      baseStatus,
      activeTasks: Array.from(this.activeTasks.values()),
      activeVMs,
      capabilities: {
        vmProvisioning: this.enhancedConfig.vmProvisioningEnabled || false,
        claudeCode: !!this.enhancedConfig.claudeApiKey,
        playwrightTesting: this.enhancedConfig.playwrightTestingEnabled || false
      }
    };
  }

  // Handle a specific issue with VM workflow (for manual invocation)
  async handleSpecificIssueWithVM(owner: string, repo: string, issueNumber: number): Promise<void> {
    console.log(`🎯 Enhanced Billy handling specific issue #${issueNumber} in ${owner}/${repo} with VM workflow`);

    const issue = await this.getSensor().getIssue(owner, repo, issueNumber);
    if (!issue) {
      console.log(`❓ Enhanced Billy couldn't find issue #${issueNumber}`);
      return;
    }

    // Temporarily override config for this specific task
    const originalConfig = { ...this.enhancedConfig };
    this.enhancedConfig.defaultOwner = owner;
    this.enhancedConfig.defaultRepo = repo;

    await this.handleIssueWithVM(issue);

    // Restore original config
    this.enhancedConfig = originalConfig;
  }

  // Emergency cleanup of all VMs
  async emergencyCleanup(): Promise<void> {
    console.log('🚨 Enhanced Billy performing emergency cleanup of all VMs...');
    
    try {
      const activeVMs = await this.vmOrchestrator.listActiveVMs();
      
      for (const vm of activeVMs) {
        try {
          await this.vmOrchestrator.teardownVM(vm);
          console.log(`✅ Emergency cleanup of VM ${vm.id} completed`);
        } catch (error) {
          console.error(`❌ Failed to cleanup VM ${vm.id}:`, error);
        }
      }

      // Clear active tasks
      this.activeTasks.clear();
      
      console.log(`🧹 Emergency cleanup completed. Cleaned up ${activeVMs.length} VMs.`);

    } catch (error) {
      console.error('❌ Emergency cleanup failed:', error);
    }
  }
}