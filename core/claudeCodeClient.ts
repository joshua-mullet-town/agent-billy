import { exec } from 'child_process';
import { promisify } from 'util';
import { VMInstance, Task, TaskResult } from './vmOrchestrator';

const execAsync = promisify(exec);

export interface ClaudeCodeConfig {
  apiKey?: string;
  defaultTimeout?: number;
  playwrightEnabled?: boolean;
}

export interface PlaywrightTestResult {
  success: boolean;
  screenshots: string[];
  testReport: string;
  error?: string;
}

export interface CodeChanges {
  files: Array<{
    path: string;
    action: 'create' | 'modify' | 'delete';
    content?: string;
    diff?: string;
  }>;
  summary: string;
  testResults?: PlaywrightTestResult;
}

export class ClaudeCodeClient {
  private config: ClaudeCodeConfig;

  constructor(config: ClaudeCodeConfig = {}) {
    this.config = {
      defaultTimeout: 1800000, // 30 minutes
      playwrightEnabled: true,
      ...config
    };
  }

  // Execute a headless Claude Code command on a VM
  async runHeadlessCommand(vm: VMInstance, command: string, options: {
    timeout?: number;
    allowedTools?: string[];
    outputFormat?: 'text' | 'stream-json';
  } = {}): Promise<string> {
    const {
      timeout = this.config.defaultTimeout,
      allowedTools = ['Edit', 'Bash', 'PlaywrightMCP'],
      outputFormat = 'stream-json'
    } = options;

    try {
      console.log(`🤖 Executing Claude Code command on VM ${vm.id}...`);

      // Escape the command for SSH execution
      const escapedCommand = command.replace(/'/g, "\\'").replace(/"/g, '\\"');
      
      // Build the Claude Code command
      const claudeCmd = [
        'claude',
        '-p', `"${escapedCommand}"`,
        '--allowedTools', allowedTools.join(','),
        '--output-format', outputFormat
      ].join(' ');

      // Execute via SSH
      const sshCommand = `ssh -i ${vm.sshKey} -o StrictHostKeyChecking=no root@${vm.ip} "cd /root/GiveGrove && ${claudeCmd}"`;

      console.log(`📡 SSH Command: ${sshCommand.substring(0, 100)}...`);

      const { stdout, stderr } = await execAsync(sshCommand, {
        timeout,
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });

      if (stderr && !stderr.includes('Warning') && !stderr.includes('DEPRECATION')) {
        console.warn('⚠️  Claude Code stderr:', stderr);
      }

      return stdout;

    } catch (error) {
      console.error('❌ Claude Code execution failed:', error);
      throw new Error(`Claude Code command failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Execute a specific task using Claude Code and Playwright
  async executeWithPlaywright(vm: VMInstance, task: Task): Promise<TaskResult> {
    console.log(`🧪 Executing task with Playwright testing for issue #${task.issueNumber}...`);

    try {
      // Phase 1: Code Analysis and Planning
      const analysisPrompt = `Analyze the GiveGrove codebase for issue #${task.issueNumber}: "${task.issueTitle}"

Description: ${task.issueBody}

Tasks:
1. Understand the current codebase structure
2. Identify the files that need to be modified
3. Plan the implementation approach
4. List any potential concerns or edge cases

Respond with a detailed analysis and implementation plan.`;

      console.log('🔍 Phase 1: Code analysis...');
      const analysisResult = await this.runHeadlessCommand(vm, analysisPrompt, {
        allowedTools: ['Bash', 'Edit', 'Read'],
        timeout: 300000 // 5 minutes
      });

      // Phase 2: Implementation
      const implementationPrompt = `Based on your analysis, implement the solution for issue #${task.issueNumber}: "${task.issueTitle}"

Requirements:
- Make the necessary code changes
- Follow existing code patterns and style
- Add appropriate error handling
- Ensure compatibility with existing features
- Add JSDoc comments for new functions

Implementation plan: ${analysisResult}

Implement the solution now.`;

      console.log('⚡ Phase 2: Implementation...');
      const implementationResult = await this.runHeadlessCommand(vm, implementationPrompt, {
        allowedTools: ['Edit', 'Bash'],
        timeout: 900000 // 15 minutes
      });

      // Phase 3: Playwright Testing (if enabled)
      let testResult: PlaywrightTestResult | undefined;
      if (task.playwrightEnabled) {
        testResult = await this.runPlaywrightTests(vm, task);
      }

      // Phase 4: Validation and Cleanup
      const validationPrompt = `Validate your implementation for issue #${task.issueNumber}:

1. Run any existing unit tests to ensure nothing is broken
2. Check for TypeScript compilation errors
3. Verify the implementation meets the requirements
4. Create a summary of changes made

If everything looks good, respond with "VALIDATION_SUCCESS: [summary]"
If there are issues, respond with "VALIDATION_FAILED: [issues]"`;

      console.log('✅ Phase 3: Validation...');
      const validationResult = await this.runHeadlessCommand(vm, validationPrompt, {
        allowedTools: ['Bash'],
        timeout: 300000 // 5 minutes
      });

      // Parse results
      const success = validationResult.includes('VALIDATION_SUCCESS');
      const summary = this.extractSummary(validationResult);

      return {
        success,
        summary,
        testResults: testResult ? this.formatTestResults(testResult) : 'No browser tests run',
        logs: [analysisResult, implementationResult, validationResult]
      };

    } catch (error) {
      console.error('❌ Task execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        logs: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  // Run Playwright tests with headed browser
  async runPlaywrightTests(vm: VMInstance, task: Task): Promise<PlaywrightTestResult> {
    console.log(`🎭 Running Playwright tests for issue #${task.issueNumber}...`);

    try {
      const testPrompt = `Test the implementation for issue #${task.issueNumber} using Playwright MCP:

TESTING REQUIREMENTS:
- Use headed browser testing (visible browser window)
- Navigate to the GiveGrove frontend at http://localhost:3000
- Test the new functionality you just implemented
- Verify existing functionality still works
- Take screenshots of successful test scenarios
- Document any issues found

TEST SCENARIOS:
- Basic navigation and page loading
- User interface interactions
- Form submissions (if applicable)
- Data persistence (if applicable)
- Error handling (if applicable)

Provide a detailed test report with results.`;

      const testOutput = await this.runHeadlessCommand(vm, testPrompt, {
        allowedTools: ['PlaywrightMCP'],
        timeout: 600000 // 10 minutes
      });

      // Parse test results
      const success = testOutput.includes('✅') && !testOutput.includes('❌ FAILED');
      const screenshots = this.extractScreenshots(testOutput);
      
      return {
        success,
        screenshots,
        testReport: testOutput,
        error: success ? undefined : 'Test failures detected'
      };

    } catch (error) {
      console.error('❌ Playwright testing failed:', error);
      return {
        success: false,
        screenshots: [],
        testReport: `Test execution failed: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // Create a pull request with comprehensive documentation
  async createPullRequest(vm: VMInstance, changes: CodeChanges): Promise<{ url: string; prNumber?: number }> {
    console.log(`📋 Creating pull request with changes...`);

    try {
      const prPrompt = `Create a pull request for the changes you've made:

CHANGES SUMMARY:
${changes.summary}

FILES MODIFIED:
${changes.files.map(f => `- ${f.action}: ${f.path}`).join('\n')}

TESTING RESULTS:
${changes.testResults ? changes.testResults.testReport : 'No browser tests available'}

TASKS:
1. Create a descriptive branch name
2. Commit all changes with a detailed commit message
3. Push the branch to origin
4. Create a pull request with:
   - Clear title and description
   - Link to the original issue
   - Summary of changes made
   - Testing evidence (screenshots if available)
   - Any known limitations or future improvements

Execute these git operations now.`;

      const prResult = await this.runHeadlessCommand(vm, prPrompt, {
        allowedTools: ['Bash'],
        timeout: 300000 // 5 minutes
      });

      // Extract PR URL from the output
      const prUrl = this.extractPRUrl(prResult);
      
      return {
        url: prUrl || 'Pull request creation in progress',
        prNumber: this.extractPRNumber(prResult)
      };

    } catch (error) {
      console.error('❌ Pull request creation failed:', error);
      return {
        url: 'PR creation failed',
        prNumber: undefined
      };
    }
  }

  // Test Claude Code connectivity on a VM
  async testConnectivity(vm: VMInstance): Promise<boolean> {
    console.log(`🔌 Testing Claude Code connectivity on VM ${vm.id}...`);

    try {
      const testOutput = await this.runHeadlessCommand(vm, 'Test connectivity. Respond with "CONNECTIVITY_OK" if everything is working.', {
        allowedTools: ['Bash'],
        timeout: 60000 // 1 minute
      });

      return testOutput.includes('CONNECTIVITY_OK');

    } catch (error) {
      console.error('❌ Connectivity test failed:', error);
      return false;
    }
  }

  // Get Claude Code status and capabilities on a VM
  async getCapabilities(vm: VMInstance): Promise<{
    claudeCodeVersion: string;
    availableTools: string[];
    playwrightMCP: boolean;
  }> {
    console.log(`📊 Checking Claude Code capabilities on VM ${vm.id}...`);

    try {
      const capabilitiesOutput = await this.runHeadlessCommand(vm, 'List your available tools and capabilities. Show Claude Code version if possible.', {
        allowedTools: ['Bash'],
        timeout: 60000
      });

      return {
        claudeCodeVersion: this.extractVersion(capabilitiesOutput),
        availableTools: this.extractTools(capabilitiesOutput),
        playwrightMCP: capabilitiesOutput.includes('PlaywrightMCP') || capabilitiesOutput.includes('playwright')
      };

    } catch (error) {
      console.error('❌ Failed to get capabilities:', error);
      return {
        claudeCodeVersion: 'unknown',
        availableTools: [],
        playwrightMCP: false
      };
    }
  }

  // Utility methods
  private extractSummary(output: string): string {
    const match = output.match(/VALIDATION_SUCCESS:\s*(.+)/i) || output.match(/TASK_COMPLETED:\s*(.+)/i);
    return match ? match[1].trim() : 'Task completed';
  }

  private extractScreenshots(output: string): string[] {
    const screenshotRegex = /screenshot[s]?\s*(?:saved|taken|captured)[:\s]+([^\n]+)/gi;
    const matches = [];
    let match;
    
    while ((match = screenshotRegex.exec(output)) !== null) {
      matches.push(match[1].trim());
    }
    
    return matches;
  }

  private formatTestResults(testResult: PlaywrightTestResult): string {
    return `
Browser Testing Results:
- Status: ${testResult.success ? '✅ PASSED' : '❌ FAILED'}
- Screenshots: ${testResult.screenshots.length} captured
- Details: ${testResult.testReport.substring(0, 500)}...
${testResult.error ? `- Error: ${testResult.error}` : ''}
    `.trim();
  }

  private extractPRUrl(output: string): string | null {
    const urlMatch = output.match(/https:\/\/github\.com\/[^\s]+\/pull\/\d+/);
    return urlMatch ? urlMatch[0] : null;
  }

  private extractPRNumber(output: string): number | undefined {
    const numberMatch = output.match(/pull\/(\d+)/);
    return numberMatch ? parseInt(numberMatch[1]) : undefined;
  }

  private extractVersion(output: string): string {
    const versionMatch = output.match(/claude[- ]code[- ]?v?(\d+\.\d+\.\d+)/i);
    return versionMatch ? versionMatch[1] : 'unknown';
  }

  private extractTools(output: string): string[] {
    const tools = [];
    const toolKeywords = ['Edit', 'Bash', 'PlaywrightMCP', 'Read', 'Write', 'Grep', 'Glob'];
    
    for (const tool of toolKeywords) {
      if (output.toLowerCase().includes(tool.toLowerCase())) {
        tools.push(tool);
      }
    }
    
    return tools;
  }
}