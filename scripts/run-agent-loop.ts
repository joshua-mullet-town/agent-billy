#!/usr/bin/env ts-node

import { config } from 'dotenv';
import { Command } from 'commander';
import { AgentBilly } from '../core/agentBilly';

// Load environment variables from .env file (local development)
// In production (Railway/Docker), env vars are provided directly
try {
  config();
} catch (e) {
  // .env file not found - this is normal in production
}

const program = new Command();

program
  .name('agent-billy-loop')
  .description('Agent Billy - Autonomous Issue Processing Loop')
  .version('0.1.0');

// Watch command: Billy continuously monitors for assigned issues
program
  .command('watch')
  .description('Billy watches for assigned issues and responds autonomously')
  .option('-o, --owner <owner>', 'GitHub repository owner/organization', process.env.DEFAULT_GITHUB_OWNER)
  .option('-r, --repo <repo>', 'GitHub repository name', process.env.DEFAULT_GITHUB_REPO)
  .option('-a, --assignee <assignee>', 'GitHub username to monitor assignments for', process.env.AGENT_USERNAME || 'agent-billy')
  .option('-i, --interval <seconds>', 'Polling interval in seconds', '60')
  .option('-t, --token <token>', 'GitHub personal access token')
  .option('--dry-run', 'Run without making actual changes', false)
  .option('--once', 'Run once and exit (no continuous polling)', false)
  .action(async (options) => {
    // Debug environment variables
    console.log('🔍 Environment check:');
    console.log('  DEFAULT_GITHUB_OWNER:', process.env.DEFAULT_GITHUB_OWNER);
    console.log('  DEFAULT_GITHUB_REPO:', process.env.DEFAULT_GITHUB_REPO);
    console.log('  AGENT_USERNAME:', process.env.AGENT_USERNAME);
    console.log('  Options received:', { owner: options.owner, repo: options.repo, assignee: options.assignee });
    
    // Validate required options
    if (!options.owner || !options.repo) {
      console.error('❌ Missing required repository information:');
      if (!options.owner) console.error('  - Owner/organization not specified (use -o or set DEFAULT_GITHUB_OWNER in .env)');
      if (!options.repo) console.error('  - Repository name not specified (use -r or set DEFAULT_GITHUB_REPO in .env)');
      console.error('\nFor production deployment, make sure these environment variables are set:');
      console.error('  DEFAULT_GITHUB_OWNER=your-username');
      console.error('  DEFAULT_GITHUB_REPO=your-repo-name');
      process.exit(1);
    }

    const interval = parseInt(options.interval) * 1000; // Convert to milliseconds
    let isRunning = true;

    // Graceful shutdown handling
    const shutdown = () => {
      console.log('\\n🛑 Agent Billy is shutting down gracefully...');
      isRunning = false;
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    console.log('🤖 Agent Billy is starting autonomous operation...');
    console.log(`📍 Monitoring: ${options.owner}/${options.repo}`);
    console.log(`👤 Assignee: ${options.assignee}`);
    console.log(`⏰ Interval: ${options.interval}s`);
    console.log(`🔄 Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log('\\n' + '='.repeat(50));

    const billy = new AgentBilly({
      githubToken: options.token || process.env.GITHUB_TOKEN,
      defaultOwner: options.owner,
      defaultRepo: options.repo,
      assigneeUsername: options.assignee,
      dryRun: options.dryRun
    });

    const runCycle = async (): Promise<void> => {
      try {
        console.log(`\\n⏰ ${new Date().toISOString()} - Billy is checking for work...`);
        await billy.checkAndHandleAssignedIssues();
        
        // Show current status after each cycle
        const status = await billy.getStatus();
        console.log(`📊 Status: ${status.currentTasks.length} active tasks, can take work: ${status.canTakeWork}`);
        
      } catch (error) {
        console.error('❌ Billy encountered an error during this cycle:', error);
        // Continue running despite errors
      }
    };

    // Run initial cycle
    await runCycle();

    if (options.once) {
      console.log('✅ Single cycle complete. Billy is signing off.');
      return;
    }

    // Start continuous polling
    console.log(`\\n🔄 Billy is now watching continuously. Press Ctrl+C to stop.`);
    
    while (isRunning) {
      await new Promise(resolve => setTimeout(resolve, interval));
      
      if (isRunning) {
        await runCycle();
      }
    }

    console.log('👋 Agent Billy has stopped watching. Goodbye!');
  });

// Serve command: Billy runs as a lightweight service
program
  .command('serve')
  .description('Billy runs as a persistent service monitoring multiple repos')
  .option('-c, --config <file>', 'Configuration file path', '.env')
  .option('-t, --token <token>', 'GitHub personal access token')
  .option('--dry-run', 'Run without making actual changes', false)
  .action(async (options) => {
    console.log('🚧 Service mode is not yet implemented');
    console.log('📋 Planned features:');
    console.log('   - Monitor multiple repositories from config file');
    console.log('   - Health check endpoints');
    console.log('   - Structured logging to files');
    console.log('   - Graceful restart capabilities');
    console.log('\\n💡 For now, use: npm run billy:watch -- -o owner -r repo');
    
    process.exit(0);
  });

program.parse();