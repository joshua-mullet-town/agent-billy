#!/usr/bin/env ts-node

import { config } from 'dotenv';
import { AgentBilly } from '../core/agentBilly';

// Load environment variables
config();

class ClarificationChecker extends AgentBilly {
  // Expose the protected method so we can call it manually
  public async checkClarificationResponsesManually(): Promise<void> {
    const memory = this.getMemory();
    const sensor = this.getSensor();
    const actions = this.getActions();
    
    // Set the repo we're checking
    const repoFullName = 'south-bend-code-works/GiveGrove';
    
    console.log('🔍 Manually checking clarification responses for', repoFullName);
    
    // Get all issues awaiting clarification in this repo
    const awaitingClarification = await memory.getIssuesAwaitingClarification(repoFullName);
    
    console.log(`Found ${awaitingClarification.length} issues awaiting clarification:`);
    awaitingClarification.forEach(issue => {
      console.log(`  - Issue #${issue.issueNumber}: ${issue.status} (processed at ${issue.processedAt})`);
    });
    
    // Find issue #1096 specifically
    const issue1096 = awaitingClarification.find(p => p.issueNumber === 1096);
    if (issue1096) {
      console.log('\n🎯 Found issue #1096 - checking for new comments...');
      
      // Get the latest issue comments
      const comments = await sensor.getIssueComments('south-bend-code-works', 'GiveGrove', 1096);
      
      const clarificationRequestTime = new Date(issue1096.clarificationRequest?.requestedAt || issue1096.processedAt);
      console.log(`Clarification requested at: ${clarificationRequestTime.toISOString()}`);
      
      const newComments = comments.filter(comment => {
        const commentTime = new Date(comment.created_at);
        const isAfterClarification = commentTime > clarificationRequestTime;
        const isNotFromBilly = comment.user.login !== 'agent-billy';
        
        console.log(`  Comment by ${comment.user.login} at ${comment.created_at}: after=${isAfterClarification}, notBilly=${isNotFromBilly}`);
        
        return isAfterClarification && isNotFromBilly;
      });
      
      console.log(`\nFound ${newComments.length} new comments since clarification request:`);
      newComments.forEach(comment => {
        console.log(`  - ${comment.user.login} (${comment.created_at}): ${comment.body.substring(0, 100)}...`);
      });
      
      if (newComments.length > 0) {
        console.log('\n✅ New comments found! Billy should process this issue now.');
        
        // Force Billy to check this specific issue
        // We need to reassign the issue to agent-billy temporarily so Billy checks it
        console.log('🔄 Temporarily reassigning issue #1096 to agent-billy...');
        
        // Get the current issue to see who it's assigned to
        const currentIssue = await sensor.getIssue('south-bend-code-works', 'GiveGrove', 1096);
        const currentAssignee = currentIssue?.assignee?.login || currentIssue?.user.login;
        
        console.log(`Current assignee: ${currentAssignee}`);
        
        // Reassign to agent-billy
        if (currentAssignee) {
          await actions.reassignIssue(
            'south-bend-code-works',
            'GiveGrove', 
            1096,
            currentAssignee,
            'agent-billy'
          );
        }
        
        console.log('✅ Issue reassigned to agent-billy');
        
        // Now Billy should check for assigned issues and process clarification responses
        console.log('🔄 Calling Billy to check assigned issues...');
        await this.checkAndHandleAssignedIssues();
        console.log('✅ Billy finished checking');
      } else {
        console.log('\n❌ No new comments found since clarification request');
      }
    } else {
      console.log('\n❌ Issue #1096 not found in awaiting clarification list');
    }
  }
}

async function main() {
  try {
    const checker = new ClarificationChecker({
      githubToken: process.env.GITHUB_TOKEN,
      defaultOwner: 'south-bend-code-works',
      defaultRepo: 'GiveGrove',
      assigneeUsername: 'agent-billy'
    });
    
    await checker.checkClarificationResponsesManually();
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();