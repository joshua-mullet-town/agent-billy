#!/usr/bin/env ts-node

import { config } from 'dotenv';
import { Command } from 'commander';
import { AgentBilly } from '../core/agentBilly';

// Load environment variables from .env file
config();

const program = new Command();

program
  .name('agent-billy')
  .description('Agent Billy - Your AI Development Teammate')
  .version('0.1.0');

// Main command: Billy checks for assigned issues and handles them
program
  .command('check-issues')
  .description('Billy checks for assigned issues and responds to them')
  .option('-o, --owner <owner>', 'GitHub repository owner/organization')
  .option('-r, --repo <repo>', 'GitHub repository name')
  .option('-a, --assignee <assignee>', 'GitHub username to check assignments for', 'agent-billy')
  .option('-t, --token <token>', 'GitHub personal access token')
  .option('--dry-run', 'Run without making actual changes', false)
  .action(async (options) => {
    try {
      console.log('🤖 Agent Billy is starting up...');
      
      const billy = new AgentBilly({
        githubToken: options.token || process.env.GITHUB_TOKEN,
        defaultOwner: options.owner,
        defaultRepo: options.repo,
        assigneeUsername: options.assignee,
        dryRun: options.dryRun
      });

      await billy.checkAndHandleAssignedIssues();
      
      console.log('✅ Agent Billy finished checking issues');
    } catch (error) {
      console.error('❌ Agent Billy encountered an error:', error);
      process.exit(1);
    }
  });

// Command: Billy handles a specific issue
program
  .command('handle-issue')
  .description('Billy handles a specific issue')
  .requiredOption('-o, --owner <owner>', 'GitHub repository owner/organization')
  .requiredOption('-r, --repo <repo>', 'GitHub repository name')
  .requiredOption('-i, --issue <number>', 'Issue number to handle')
  .option('-t, --token <token>', 'GitHub personal access token')
  .option('--dry-run', 'Run without making actual changes', false)
  .action(async (options) => {
    try {
      console.log(`🎯 Agent Billy is handling issue #${options.issue}...`);
      
      const billy = new AgentBilly({
        githubToken: options.token || process.env.GITHUB_TOKEN,
        dryRun: options.dryRun
      });

      await billy.handleSpecificIssue(options.owner, options.repo, parseInt(options.issue));
      
      console.log('✅ Agent Billy finished handling the issue');
    } catch (error) {
      console.error('❌ Agent Billy encountered an error:', error);
      process.exit(1);
    }
  });

// Command: Check Billy's status
program
  .command('status')
  .description('Check Agent Billy\'s current status and workload')
  .action(async () => {
    try {
      const billy = new AgentBilly();
      const status = await billy.getStatus();
      
      console.log('🤖 Agent Billy Status Report:');
      console.log(`📅 Last Active: ${status.lastActive}`);
      console.log(`📋 Current Tasks: ${status.currentTasks.length}`);
      console.log(`✅ Can Take New Work: ${status.canTakeWork ? 'Yes' : 'No'}`);
      
      console.log('\n📊 Statistics:');
      console.log(`  🎯 Total Issues Processed: ${status.stats.totalIssuesProcessed}`);
      console.log(`  💬 Total Comments Posted: ${status.stats.totalCommentsPosted}`);
      console.log(`  🔄 Total Cycles Run: ${status.stats.totalCyclesRun}`);
      if (status.stats.lastCycleAt) {
        console.log(`  ⏰ Last Cycle: ${status.stats.lastCycleAt}`);
      }
      
      if (status.currentTasks.length > 0) {
        console.log('\n📋 Current Tasks:');
        status.currentTasks.forEach(task => {
          console.log(`  - ${task.type} #${task.issueNumber || 'Unknown'} (${task.status})`);
        });
      }
      
    } catch (error) {
      console.error('❌ Failed to get Agent Billy status:', error);
      process.exit(1);
    }
  });

// Command: Initialize Billy's environment
program
  .command('init')
  .description('Initialize Agent Billy\'s environment and configuration')
  .action(async () => {
    console.log('🚀 Initializing Agent Billy...');
    
    // Check for required environment variables
    if (!process.env.GITHUB_TOKEN) {
      console.log('⚠️  GITHUB_TOKEN environment variable not set');
      console.log('💡 Create a GitHub Personal Access Token and set it as GITHUB_TOKEN');
      console.log('   Example: export GITHUB_TOKEN=your_token_here');
    } else {
      console.log('✅ GitHub token found');
    }
    
    // Initialize memory system
    try {
      const billy = new AgentBilly({
        githubToken: process.env.GITHUB_TOKEN || 'placeholder'
      });
      await billy.getStatus(); // This will initialize the memory system
      console.log('✅ Agent Billy memory system initialized');
    } catch (error) {
      console.log('⚠️  Memory system will be initialized when you run Billy with a valid token');
    }
    
    console.log('\n🎉 Agent Billy is ready to work!');
    console.log('   Run: npm run agent -- check-issues -o owner -r repo');
  });

program.parse();