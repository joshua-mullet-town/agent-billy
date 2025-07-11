#!/usr/bin/env ts-node

import { config } from 'dotenv';
import { AgentBilly } from '../core/agentBilly';
import { GitHubSensor } from '../perception/githubSensor';
import { GitHubActions } from '../actions/githubActions';
import { AgentMemory } from '../memory/agentMemory';
import { callLLM } from '../cognition/llmWrapper';
import { PromptLoader } from '../cognition/promptLoader';

// Load environment variables
config();

async function forceClarificationCheck() {
  try {
    console.log('🚀 Force checking clarification responses for issue #1096...');
    
    // Initialize components
    const sensor = new GitHubSensor(process.env.GITHUB_TOKEN);
    const actions = new GitHubActions(process.env.GITHUB_TOKEN);
    const memory = new AgentMemory();
    
    const repoFullName = 'south-bend-code-works/GiveGrove';
    const issueNumber = 1096;
    
    // Get the processed issue from memory
    const processedIssue = await memory.getProcessedIssue(issueNumber, repoFullName);
    
    if (!processedIssue) {
      console.log('❌ Issue #1096 not found in Billy\'s memory');
      return;
    }
    
    if (processedIssue.status !== 'awaiting_clarification') {
      console.log(`❌ Issue #1096 status is ${processedIssue.status}, not awaiting_clarification`);
      return;
    }
    
    console.log('✅ Found issue #1096 in awaiting_clarification state');
    
    // Get the latest comments
    const comments = await sensor.getIssueComments('south-bend-code-works', 'GiveGrove', issueNumber);
    
    const clarificationRequestTime = new Date(processedIssue.clarificationRequest?.requestedAt || processedIssue.processedAt);
    const newComments = comments.filter(comment =>
      new Date(comment.created_at) > clarificationRequestTime &&
      comment.user.login !== 'agent-billy'
    );
    
    console.log(`📝 Found ${newComments.length} new comments since clarification request`);
    
    if (newComments.length === 0) {
      console.log('❌ No new comments to analyze');
      return;
    }
    
    // Display the new comments
    console.log('\n💬 New comments:');
    newComments.forEach(comment => {
      console.log(`  - ${comment.user.login} (${comment.created_at}): ${comment.body}`);
    });
    
    // Analyze the clarification response
    const prompt = await PromptLoader.loadPrompt('clarificationAnalysisGiveGrove', {
      issueNumber: issueNumber.toString(),
      issueTitle: 'Issue Analysis',
      previousQuestions: processedIssue.clarificationRequest?.questions || 'No questions recorded',
      recentComments: newComments.map(c =>
        `**${c.user.login}** (${c.created_at}):\n${c.body}`
      ).join('\n\n---\n\n')
    });

    console.log('\n🤔 Analyzing clarification response...');
    const response = await callLLM({
      prompt,
      options: {
        temperature: 0.3,
        maxTokens: 300
      }
    });

    const content = response.content.trim();
    console.log('\n📋 Analysis result:');
    console.log('─'.repeat(50));
    console.log(content);
    console.log('─'.repeat(50));

    // Process the analysis result
    if (content.includes('✅ Clarification complete.')) {
      console.log('\n🎉 Questions have been fully answered!');
      
      const summaryMatch = content.match(/Summary of requirements:(.*?)(?:Ready to proceed|$)/s);
      const summary = summaryMatch ? summaryMatch[1].trim() : 'Questions have been answered.';
      
      const acknowledgmentComment = `Thanks for the clarification! 🙏

${summary}

I'll proceed with the implementation now.

Agent Billy 🤖`;

      console.log('\n📝 Billy would post this acknowledgment comment:');
      console.log('─'.repeat(50));
      console.log(acknowledgmentComment);
      console.log('─'.repeat(50));
      
      // Post the acknowledgment comment
      const comment = await actions.commentOnIssue(
        'south-bend-code-works',
        'GiveGrove',
        issueNumber,
        acknowledgmentComment
      );
      
      if (comment) {
        console.log('✅ Posted acknowledgment comment:', comment.html_url);
        
        // Remove needs-human label if it exists
        try {
          await actions.removeLabel('south-bend-code-works', 'GiveGrove', issueNumber, 'needs-human');
          console.log('✅ Removed needs-human label');
        } catch (error) {
          console.log('⚠️ Could not remove needs-human label (might not exist)');
        }
        
        // Update memory status
        await memory.markIssueProcessed(
          issueNumber,
          repoFullName,
          'clarification_received',
          comment.id,
          comment.html_url
        );
        
        console.log('✅ Updated Billy\'s memory with clarification_received status');
      } else {
        console.log('❌ Failed to post acknowledgment comment');
      }
      
    } else if (content.includes('❓ Need follow-up clarification on:')) {
      console.log('\n❓ Need follow-up clarification');
      
      const followUpMatch = content.match(/❓ Need follow-up clarification on:(.*?)(?:Context:|$)/s);
      const followUpQuestions = followUpMatch ? followUpMatch[1].trim() : 'Additional clarification needed.';
      
      const followUpComment = `Thanks for the response! I have a few follow-up questions to ensure I implement this perfectly:

${followUpQuestions}

These details will help me provide the best implementation for your GiveGrove fundraising platform.

Agent Billy 🤖`;

      console.log('\n📝 Billy would post this follow-up comment:');
      console.log('─'.repeat(50));
      console.log(followUpComment);
      console.log('─'.repeat(50));
      
      // Post follow-up questions
      const comment = await actions.commentOnIssue(
        'south-bend-code-works',
        'GiveGrove',
        issueNumber,
        followUpComment
      );
      
      if (comment) {
        console.log('✅ Posted follow-up comment:', comment.html_url);
        console.log('💬 Billy continues to await clarification');
      } else {
        console.log('❌ Failed to post follow-up comment');
      }
      
    } else if (content.includes('🔄 Please clarify your previous response:')) {
      console.log('\n🔄 Need clarification of previous response');
      
      const clarifyMatch = content.match(/🔄 Please clarify your previous response:(.*?)(?:Context:|$)/s);
      const clarificationRequest = clarifyMatch ? clarifyMatch[1].trim() : 'Please clarify your previous response.';
      
      const clarifyComment = `I want to make sure I understand your requirements correctly:

${clarificationRequest}

Please help me clarify so I can implement exactly what you need for your fundraising platform.

Agent Billy 🤖`;

      console.log('\n📝 Billy would post this clarification request:');
      console.log('─'.repeat(50));
      console.log(clarifyComment);
      console.log('─'.repeat(50));
      
      // Post clarification request
      const comment = await actions.commentOnIssue(
        'south-bend-code-works',
        'GiveGrove',
        issueNumber,
        clarifyComment
      );
      
      if (comment) {
        console.log('✅ Posted clarification request:', comment.html_url);
        console.log('❓ Billy continues to await clarification');
      } else {
        console.log('❌ Failed to post clarification request');
      }
      
    } else {
      console.log('\n❌ Unrecognized response format - keeping status as awaiting_clarification');
    }
    
  } catch (error) {
    console.error('❌ Error force checking clarification:', error);
  }
}

forceClarificationCheck();