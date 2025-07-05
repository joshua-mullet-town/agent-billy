#!/usr/bin/env ts-node

import { Command } from 'commander';
import { EnhancedAgentBilly, EnhancedAgentConfig } from '../core/enhancedAgentBilly';
import { config } from 'dotenv';

// Load environment variables
config();

const program = new Command();

program
  .name('enhanced-billy')
  .description('Enhanced Agent Billy with VM orchestration and Claude Code integration')
  .version('0.2.0');

// Enhanced watch command with VM provisioning
program
  .command('watch-enhanced')
  .description('Watch for assigned issues and handle them with full VM workflow')
  .option('-o, --owner <owner>', 'GitHub repository owner')
  .option('-r, --repo <repo>', 'GitHub repository name')
  .option('-i, --interval <seconds>', 'Polling interval in seconds', '120')
  .option('--dry-run', 'Dry run mode (no actual changes)')
  .option('--disable-vm', 'Disable VM provisioning')
  .option('--disable-playwright', 'Disable Playwright testing')
  .option('--keep-vms', 'Keep VMs running after completion (for debugging)')
  .action(async (options) => {
    const config: EnhancedAgentConfig = {
      githubToken: process.env.GITHUB_TOKEN,
      digitalOceanToken: process.env.DIGITALOCEAN_TOKEN,
      claudeApiKey: process.env.CLAUDE_API_KEY,
      defaultOwner: options.owner || process.env.DEFAULT_GITHUB_OWNER,
      defaultRepo: options.repo || process.env.DEFAULT_GITHUB_REPO,
      assigneeUsername: process.env.AGENT_USERNAME || 'agent-billy',
      dryRun: options.dryRun || false,
      vmProvisioningEnabled: !options.disableVm,
      playwrightTestingEnabled: !options.disablePlaywright,
      vmAutoTeardown: !options.keepVms
    };

    if (!config.defaultOwner || !config.defaultRepo) {
      console.error('❌ Repository owner and name are required');
      process.exit(1);
    }

    if (!config.digitalOceanToken && config.vmProvisioningEnabled) {
      console.error('❌ DigitalOcean token is required for VM provisioning');
      process.exit(1);
    }

    if (!config.claudeApiKey) {
      console.error('❌ Claude API key is required for development tasks');
      process.exit(1);
    }

    const billy = new EnhancedAgentBilly(config);
    const interval = parseInt(options.interval) * 1000;

    console.log(`🤖 Enhanced Agent Billy starting autonomous watch mode...`);
    console.log(`📍 Repository: ${config.defaultOwner}/${config.defaultRepo}`);
    console.log(`⏱️  Interval: ${options.interval}s`);
    console.log(`🚀 VM Provisioning: ${config.vmProvisioningEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`🎭 Playwright Testing: ${config.playwrightTestingEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`🔄 Auto Teardown: ${config.vmAutoTeardown ? 'ENABLED' : 'DISABLED'}`);
    console.log(`🔄 Dry Run: ${config.dryRun ? 'ENABLED' : 'DISABLED'}`);

    // Setup graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Received SIGINT, shutting down gracefully...');
      await billy.emergencyCleanup();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
      await billy.emergencyCleanup();
      process.exit(0);
    });

    // Main loop
    while (true) {
      try {
        const startTime = Date.now();
        
        console.log(`\n🔄 Enhanced Billy checking for work... (${new Date().toISOString()})`);
        await billy.checkAndHandleAssignedIssuesWithVM();
        
        const elapsed = Date.now() - startTime;
        console.log(`⏱️  Cycle completed in ${elapsed}ms`);

        // Show status
        const status = await billy.getEnhancedStatus();
        console.log(`📊 Active Tasks: ${status.activeTasks.length}, Active VMs: ${status.activeVMs.length}`);

        console.log(`😴 Sleeping for ${options.interval}s...`);
        await new Promise(resolve => setTimeout(resolve, interval));

      } catch (error) {
        console.error('❌ Enhanced Billy encountered an error in main loop:', error);
        console.log('⏳ Continuing after error...');
        await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30s after error
      }
    }
  });

// Handle specific issue with VM workflow
program
  .command('handle-issue-vm')
  .description('Handle a specific issue with full VM workflow')
  .option('-o, --owner <owner>', 'GitHub repository owner')
  .option('-r, --repo <repo>', 'GitHub repository name')
  .option('-i, --issue <number>', 'Issue number')
  .option('--dry-run', 'Dry run mode (no actual changes)')
  .option('--keep-vm', 'Keep VM running after completion')
  .action(async (options) => {
    if (!options.owner || !options.repo || !options.issue) {
      console.error('❌ Owner, repo, and issue number are required');
      process.exit(1);
    }

    const config: EnhancedAgentConfig = {
      githubToken: process.env.GITHUB_TOKEN,
      digitalOceanToken: process.env.DIGITALOCEAN_TOKEN,
      claudeApiKey: process.env.CLAUDE_API_KEY,
      assigneeUsername: process.env.AGENT_USERNAME || 'agent-billy',
      dryRun: options.dryRun || false,
      vmProvisioningEnabled: true,
      playwrightTestingEnabled: true,
      vmAutoTeardown: !options.keepVm
    };

    if (!config.digitalOceanToken) {
      console.error('❌ DigitalOcean token is required');
      process.exit(1);
    }

    if (!config.claudeApiKey) {
      console.error('❌ Claude API key is required');
      process.exit(1);
    }

    const billy = new EnhancedAgentBilly(config);

    try {
      await billy.handleSpecificIssueWithVM(options.owner, options.repo, parseInt(options.issue));
      console.log('✅ Issue handling completed');
    } catch (error) {
      console.error('❌ Failed to handle issue:', error);
      await billy.emergencyCleanup();
      process.exit(1);
    }
  });

// Get enhanced status
program
  .command('status-enhanced')
  .description('Get enhanced agent status including VM information')
  .action(async () => {
    const config: EnhancedAgentConfig = {
      githubToken: process.env.GITHUB_TOKEN,
      digitalOceanToken: process.env.DIGITALOCEAN_TOKEN,
      claudeApiKey: process.env.CLAUDE_API_KEY,
      assigneeUsername: process.env.AGENT_USERNAME || 'agent-billy'
    };

    const billy = new EnhancedAgentBilly(config);

    try {
      const status = await billy.getEnhancedStatus();
      
      console.log('🤖 Enhanced Agent Billy Status');
      console.log('================================');
      
      console.log('\n📊 Base Agent Status:');
      console.log(`- Current Tasks: ${status.baseStatus.currentTasks.length}`);
      console.log(`- Can Take Work: ${status.baseStatus.canTakeWork}`);
      console.log(`- Last Active: ${status.baseStatus.lastActive}`);
      console.log(`- Total Issues Processed: ${status.baseStatus.stats.totalIssuesProcessed}`);
      
      console.log('\n💻 Development Tasks:');
      if (status.activeTasks.length === 0) {
        console.log('- No active development tasks');
      } else {
        status.activeTasks.forEach(task => {
          console.log(`- Issue #${task.issue.number}: ${task.status} (${task.startedAt.toISOString()})`);
          if (task.vm) {
            console.log(`  VM: ${task.vm.id} (${task.vm.ip})`);
          }
        });
      }

      console.log('\n🖥️  Active VMs:');
      if (status.activeVMs.length === 0) {
        console.log('- No active VMs');
      } else {
        status.activeVMs.forEach(vm => {
          console.log(`- VM ${vm.id}: ${vm.ip} (${vm.status}) - Ticket: ${vm.ticketId}`);
        });
      }

      // Also check for ALL droplets (including orphaned ones)
      const allDroplets = await billy.vmOrchestrator.listAllDroplets();
      if (allDroplets.orphanedVMs.length > 0) {
        console.log('\n⚠️  WARNING: Orphaned VMs detected (not managed by Billy):');
        allDroplets.orphanedVMs.forEach(vm => {
          console.log(`- ${vm.name} (ID: ${vm.id})`);
          console.log(`  IP: ${vm.ip}, Size: ${vm.size}`);
          console.log(`  Cost: $${vm.costPerHour}/hour`);
          console.log(`  Created: ${vm.created}`);
          console.log(`  Tags: ${vm.tags.join(', ') || 'none'}`);
        });
        console.log(`\n💸 Total hourly cost: $${allDroplets.totalCostPerHour.toFixed(3)}/hour`);
        console.log('💡 Run "npm run billy:cleanup" to destroy Billy VMs');
        console.log('💡 Run "./scripts/emergency-cleanup-all.sh" to destroy ALL VMs');
      }

      console.log('\n🔧 Capabilities:');
      console.log(`- VM Provisioning: ${status.capabilities.vmProvisioning ? '✅ ENABLED' : '❌ DISABLED'}`);
      console.log(`- Claude Code: ${status.capabilities.claudeCode ? '✅ ENABLED' : '❌ DISABLED'}`);
      console.log(`- Playwright Testing: ${status.capabilities.playwrightTesting ? '✅ ENABLED' : '❌ DISABLED'}`);

    } catch (error) {
      console.error('❌ Failed to get status:', error);
      process.exit(1);
    }
  });

// Emergency cleanup command
program
  .command('cleanup')
  .description('Emergency cleanup of all VMs')
  .action(async () => {
    const config: EnhancedAgentConfig = {
      digitalOceanToken: process.env.DIGITALOCEAN_TOKEN
    };

    if (!config.digitalOceanToken) {
      console.error('❌ DigitalOcean token is required for cleanup');
      process.exit(1);
    }

    const billy = new EnhancedAgentBilly(config);

    try {
      await billy.emergencyCleanup();
      console.log('✅ Emergency cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      process.exit(1);
    }
  });

// Test VM provisioning
program
  .command('test-vm')
  .description('Test VM provisioning and Claude Code setup')
  .option('--keep', 'Keep VM running after test')
  .action(async (options) => {
    const config: EnhancedAgentConfig = {
      digitalOceanToken: process.env.DIGITALOCEAN_TOKEN,
      claudeApiKey: process.env.CLAUDE_API_KEY
    };

    if (!config.digitalOceanToken) {
      console.error('❌ DigitalOcean token is required');
      process.exit(1);
    }

    const billy = new EnhancedAgentBilly(config);

    try {
      console.log('🧪 Testing VM provisioning and Claude Code setup...');
      
      // Create a mock issue for testing
      const mockIssue = {
        id: 999999,
        number: 999999,
        title: 'Test VM provisioning',
        body: 'This is a test issue to verify VM provisioning works correctly.',
        labels: [],
        assignees: [],
        state: 'open' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        html_url: 'https://github.com/test/test/issues/999999',
        user: { login: 'test-user' }
      };

      await billy.handleIssueWithVM(mockIssue);
      
      if (!options.keep) {
        console.log('🧹 Cleaning up test VM...');
        await billy.emergencyCleanup();
      }
      
      console.log('✅ VM test completed');

    } catch (error) {
      console.error('❌ VM test failed:', error);
      await billy.emergencyCleanup();
      process.exit(1);
    }
  });

program.parse();

export { EnhancedAgentBilly };