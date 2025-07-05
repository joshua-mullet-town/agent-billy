import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface VMInstance {
  id: string;
  ip: string;
  status: 'provisioning' | 'ready' | 'setup' | 'running' | 'failed' | 'destroying';
  createdAt: Date;
  ticketId: string;
  sshKey?: string;
}

export interface TaskResult {
  success: boolean;
  pullRequestUrl?: string;
  summary?: string;
  testResults?: string;
  logs?: string[];
  error?: string;
}

export interface Task {
  issueNumber: number;
  issueTitle: string;
  issueBody: string;
  clarificationContext?: any;
  testingRequired: boolean;
  playwrightEnabled: boolean;
}

export class VMOrchestrator {
  private digitalOceanToken: string;
  private ansibleVaultPassword: string;
  private baseURL = 'https://api.digitalocean.com/v2';

  constructor(config: {
    digitalOceanToken?: string;
    ansibleVaultPassword?: string;
  } = {}) {
    this.digitalOceanToken = config.digitalOceanToken || process.env.DIGITALOCEAN_TOKEN || '';
    this.ansibleVaultPassword = config.ansibleVaultPassword || process.env.ANSIBLE_VAULT_PASSWORD || 'ansible-vault-password-2024';
    
    if (!this.digitalOceanToken) {
      console.warn('⚠️  No DigitalOcean token provided. VM operations will fail.');
    }
  }

  private get headers() {
    return {
      'Authorization': `Bearer ${this.digitalOceanToken}`,
      'Content-Type': 'application/json'
    };
  }

  // Provision a new VM for a specific ticket
  async provisionVM(ticketId: string): Promise<VMInstance> {
    console.log(`🚀 Provisioning VM for ticket ${ticketId}...`);

    try {
      // Create DigitalOcean droplet
      const dropletResponse = await axios.post(
        `${this.baseURL}/droplets`,
        {
          name: `agent-billy-${ticketId}-${Date.now()}`,
          region: 'nyc1',
          size: 'c-4', // 4 vCPUs, 8GB RAM - good balance of performance and cost
          image: 'ubuntu-20-04-x64',
          ssh_keys: ['49038775'], // Agent Billy: GiveGrove SSH key
          tags: [`agent-billy`, `ticket-${ticketId}`],
          user_data: `#!/bin/bash
apt-get update
apt-get install -y python3 python3-pip
pip3 install ansible
`
        },
        { headers: this.headers }
      );

      const droplet = dropletResponse.data.droplet;
      console.log(`✅ Droplet created: ${droplet.id}`);

      // Wait for droplet to be ready and get IP
      const vmInstance: VMInstance = {
        id: droplet.id.toString(),
        ip: await this.waitForDropletReady(droplet.id),
        status: 'provisioning',
        createdAt: new Date(),
        ticketId,
        sshKey: '~/.ssh/id_ed25519_digital_ocean'
      };

      console.log(`🌐 VM ready at IP: ${vmInstance.ip}`);
      return vmInstance;

    } catch (error) {
      console.error('❌ Failed to provision VM:', error);
      throw new Error(`VM provisioning failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Wait for droplet to be ready and return IP
  private async waitForDropletReady(dropletId: number): Promise<string> {
    const maxWaitTime = 300000; // 5 minutes
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const response = await axios.get(
          `${this.baseURL}/droplets/${dropletId}`,
          { headers: this.headers }
        );

        const droplet = response.data.droplet;
        
        if (droplet.status === 'active' && droplet.networks.v4.length > 0) {
          const publicIP = droplet.networks.v4.find((network: any) => network.type === 'public')?.ip_address;
          if (publicIP) {
            // Wait a bit more for SSH to be ready
            await new Promise(resolve => setTimeout(resolve, 30000));
            return publicIP;
          }
        }

        console.log(`⏳ Waiting for droplet ${dropletId} to be ready... Status: ${droplet.status}`);
        await new Promise(resolve => setTimeout(resolve, 10000));

      } catch (error) {
        console.error('Error checking droplet status:', error);
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }

    throw new Error('Timeout waiting for droplet to be ready');
  }

  // Setup Claude Code environment on the VM
  async setupClaudeCode(vm: VMInstance): Promise<void> {
    console.log(`🔧 Setting up Claude Code environment on VM ${vm.id}...`);

    try {
      vm.status = 'setup';

      // Create enhanced inventory for this VM
      const inventoryContent = `
vm_instance:
  ansible_host: ${vm.ip}
  ansible_user: root
  ansible_ssh_private_key_file: ~/.ssh/id_ed25519_digital_ocean
  ansible_ssh_common_args: '-o StrictHostKeyChecking=no'
`;

      await this.writeFile(`/tmp/inventory-${vm.ticketId}.yml`, inventoryContent);

      // Run the enhanced Ansible playbook
      const ansibleCommand = `cd /Users/joshuamullet/code/GiveGrove/ansible && ansible-playbook -i /tmp/inventory-${vm.ticketId}.yml claude-code-environment.yml --vault-password-file vault-password.txt`;

      console.log(`🔄 Running Ansible setup: ${ansibleCommand}`);
      const { stdout, stderr } = await execAsync(ansibleCommand);

      if (stderr && !stderr.includes('DEPRECATION WARNING')) {
        console.error('⚠️  Ansible setup warnings:', stderr);
      }

      console.log(`✅ Claude Code environment setup complete for VM ${vm.id}`);
      vm.status = 'ready';

    } catch (error) {
      console.error('❌ Failed to setup Claude Code environment:', error);
      vm.status = 'failed';
      throw new Error(`Claude Code setup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Execute a development task using Claude Code
  async executeTask(vm: VMInstance, task: Task): Promise<TaskResult> {
    console.log(`💻 Executing task for issue #${task.issueNumber} on VM ${vm.id}...`);

    try {
      vm.status = 'running';

      // Create the task prompt for Claude Code
      const taskPrompt = this.buildTaskPrompt(task);

      // Execute Claude Code via SSH
      const claudeCommand = `ssh -i ${vm.sshKey} -o StrictHostKeyChecking=no root@${vm.ip} "cd /root/GiveGrove && claude -p '${taskPrompt}' --allowedTools Edit,Bash,PlaywrightMCP --output-format stream-json"`;

      console.log(`🤖 Executing Claude Code task...`);
      const { stdout, stderr } = await execAsync(claudeCommand, { 
        timeout: 1800000, // 30 minute timeout
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });

      // Parse Claude Code output
      const result = this.parseClaudeOutput(stdout);

      // If successful, create pull request
      if (result.success) {
        const prResult = await this.createPullRequest(vm, task, result);
        result.pullRequestUrl = prResult.url;
      }

      return result;

    } catch (error) {
      console.error('❌ Failed to execute task:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        logs: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  // Build the task prompt for Claude Code
  private buildTaskPrompt(task: Task): string {
    const playwrightInstructions = task.playwrightEnabled ? `

TESTING REQUIREMENTS:
- Use Playwright MCP to test your changes in the browser
- Run headed browser testing (visible browser window)
- Test the frontend at http://localhost:3000
- Test any backend functionality at http://localhost:4000
- Take screenshots of successful tests
- Document any issues found during testing` : '';

    return `You are an autonomous development agent working on the GiveGrove fundraising platform.

ISSUE DETAILS:
- Issue #${task.issueNumber}: ${task.issueTitle}
- Description: ${task.issueBody}
${task.clarificationContext ? `- Clarification: ${JSON.stringify(task.clarificationContext)}` : ''}

ENVIRONMENT:
- You are in a fully configured GiveGrove development environment
- Frontend is running on http://localhost:3000
- Backend is running on http://localhost:4000
- All dependencies are installed and services are running

TASK:
Implement the requested feature or fix based on the issue description. Follow these steps:

1. Analyze the codebase to understand the current implementation
2. Plan your changes based on the requirements
3. Implement the necessary code changes
4. Test your changes${playwrightInstructions}
5. Ensure all existing tests still pass
6. Document your changes

CONSTRAINTS:
- Follow the existing code style and patterns
- Make minimal, focused changes
- Ensure your changes don't break existing functionality
- Add appropriate error handling
- Include JSDoc comments for new functions

When you complete the task successfully, respond with: "TASK_COMPLETED: [brief summary of changes made]"
If you encounter issues, respond with: "TASK_FAILED: [description of the problem]"`.replace(/'/g, "\\'");
  }

  // Parse Claude Code output to extract results
  private parseClaudeOutput(output: string): TaskResult {
    const lines = output.split('\n');
    const logs: string[] = [];
    let success = false;
    let summary = '';
    let testResults = '';

    for (const line of lines) {
      logs.push(line);

      if (line.includes('TASK_COMPLETED:')) {
        success = true;
        summary = line.replace('TASK_COMPLETED:', '').trim();
      } else if (line.includes('TASK_FAILED:')) {
        success = false;
        summary = line.replace('TASK_FAILED:', '').trim();
      } else if (line.includes('✅') && line.includes('test')) {
        testResults += line + '\n';
      }
    }

    return {
      success,
      summary: summary || 'Task execution completed',
      testResults: testResults || 'No test results captured',
      logs
    };
  }

  // Create a pull request with the changes
  private async createPullRequest(vm: VMInstance, task: Task, result: TaskResult): Promise<{ url: string }> {
    console.log(`📋 Creating pull request for issue #${task.issueNumber}...`);

    try {
      // Create and push branch via SSH
      const branchName = `agent-billy/issue-${task.issueNumber}`;
      const gitCommands = `
cd /root/GiveGrove &&
git checkout -b ${branchName} &&
git add . &&
git commit -m "Fix #${task.issueNumber}: ${task.issueTitle}

${result.summary}

🤖 Generated with Agent Billy

Co-Authored-By: Agent Billy <agent-billy@mullettown.dev>" &&
git push origin ${branchName}
      `;

      await execAsync(`ssh -i ${vm.sshKey} -o StrictHostKeyChecking=no root@${vm.ip} "${gitCommands}"`);

      // Create PR via GitHub API (simplified - you'd use the GitHub Actions from agent-billy)
      const prUrl = `https://github.com/south-bend-code-works/GiveGrove/compare/${branchName}`;
      
      console.log(`✅ Pull request branch created: ${branchName}`);
      return { url: prUrl };

    } catch (error) {
      console.error('❌ Failed to create pull request:', error);
      return { url: 'PR creation failed' };
    }
  }

  // Teardown VM when task is complete
  async teardownVM(vm: VMInstance): Promise<void> {
    console.log(`🗑️  Tearing down VM ${vm.id}...`);

    try {
      vm.status = 'destroying';

      // Delete the DigitalOcean droplet
      await axios.delete(
        `${this.baseURL}/droplets/${vm.id}`,
        { headers: this.headers }
      );

      // Clean up local files
      await execAsync(`rm -f /tmp/inventory-${vm.ticketId}.yml`).catch(() => {});

      console.log(`✅ VM ${vm.id} destroyed successfully`);

    } catch (error) {
      console.error('❌ Failed to teardown VM:', error);
      throw new Error(`VM teardown failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Utility: Write file
  private async writeFile(path: string, content: string): Promise<void> {
    await execAsync(`echo '${content}' > ${path}`);
  }

  // Get VM status
  async getVMStatus(vmId: string): Promise<VMInstance | null> {
    try {
      const response = await axios.get(
        `${this.baseURL}/droplets/${vmId}`,
        { headers: this.headers }
      );

      const droplet = response.data.droplet;
      return {
        id: droplet.id.toString(),
        ip: droplet.networks.v4.find((n: any) => n.type === 'public')?.ip_address || '',
        status: droplet.status === 'active' ? 'ready' : 'provisioning',
        createdAt: new Date(droplet.created_at),
        ticketId: droplet.tags.find((tag: string) => tag.startsWith('ticket-'))?.replace('ticket-', '') || ''
      };
    } catch (error) {
      console.error('Failed to get VM status:', error);
      return null;
    }
  }

  // List all active VMs for this agent
  async listActiveVMs(): Promise<VMInstance[]> {
    try {
      const response = await axios.get(
        `${this.baseURL}/droplets?tag_name=agent-billy`,
        { headers: this.headers }
      );

      return response.data.droplets.map((droplet: any) => ({
        id: droplet.id.toString(),
        ip: droplet.networks.v4.find((n: any) => n.type === 'public')?.ip_address || '',
        status: droplet.status === 'active' ? 'ready' : 'provisioning',
        createdAt: new Date(droplet.created_at),
        ticketId: droplet.tags.find((tag: string) => tag.startsWith('ticket-'))?.replace('ticket-', '') || ''
      }));
    } catch (error) {
      console.error('Failed to list VMs:', error);
      return [];
    }
  }

  // List ALL droplets in the account (including untagged ones)
  async listAllDroplets(): Promise<{
    billyVMs: VMInstance[];
    orphanedVMs: any[];
    totalCostPerHour: number;
  }> {
    try {
      const response = await axios.get(
        `${this.baseURL}/droplets`,
        { headers: this.headers }
      );

      const allDroplets = response.data.droplets || [];
      const billyVMs: VMInstance[] = [];
      const orphanedVMs: any[] = [];
      let totalCostPerHour = 0;

      for (const droplet of allDroplets) {
        const costPerHour = droplet.size?.price_hourly || 0;
        totalCostPerHour += costPerHour;

        if (droplet.tags && droplet.tags.includes('agent-billy')) {
          billyVMs.push({
            id: droplet.id.toString(),
            ip: droplet.networks.v4.find((n: any) => n.type === 'public')?.ip_address || '',
            status: droplet.status === 'active' ? 'ready' : 'provisioning',
            createdAt: new Date(droplet.created_at),
            ticketId: droplet.tags.find((tag: string) => tag.startsWith('ticket-'))?.replace('ticket-', '') || ''
          });
        } else {
          orphanedVMs.push({
            id: droplet.id,
            name: droplet.name,
            created: new Date(droplet.created_at).toISOString(),
            costPerHour,
            size: droplet.size_slug,
            ip: droplet.networks.v4.find((n: any) => n.type === 'public')?.ip_address || '',
            tags: droplet.tags || []
          });
        }
      }

      return {
        billyVMs,
        orphanedVMs,
        totalCostPerHour
      };
    } catch (error) {
      console.error('Failed to list all droplets:', error);
      return {
        billyVMs: [],
        orphanedVMs: [],
        totalCostPerHour: 0
      };
    }
  }
}