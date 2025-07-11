#!/usr/bin/env ts-node

import { config } from 'dotenv';
import { callLLM } from '../cognition/llmWrapper';
import { PromptLoader } from '../cognition/promptLoader';

// Load environment variables
config();

async function testClarificationAnalysis() {
  try {
    console.log('🧪 Testing clarification analysis with the actual user response...');
    
    const originalQuestions = `1. What are the specific goals or user needs that this dark mode feature is trying to address? For example, is it to improve visibility and reduce eye strain for donors during evening auctions, or is there a broader need for a consistent dark theme across the platform?
2. How will the dark mode feature be triggered or controlled by users? Will there be a dedicated toggle, or will it automatically switch based on time of day or device settings?
3. What are the key user journeys or flows that should be considered when implementing dark mode? For example, how will it affect the bidding experience, the donation flow, or the event management tools used by organizers?

**Context:** I'm asking these questions because the impact of a dark mode feature can vary significantly depending on the specific user needs and the areas of the platform it affects. Implementing dark mode incorrectly could potentially disrupt the donor experience or negatively impact fundraising efforts.

To ensure the dark mode feature is well-designed and integrated seamlessly, I need a clearer understanding of the user goals, the scope of the feature, and the key user journeys it should support. These details will help me build something that improves the donor experience and supports the overall fundraising success of the GiveGrove platform.`;

    const userResponse = `We want dark mode mainly for evening auction events when donors are browsing on their phones in dimly lit spaces. It should be a personal preference that gets remembered. All user types should have access to it - donors, organizers, and admins.`;

    const prompt = await PromptLoader.loadPrompt('clarificationAnalysisGiveGrove', {
      issueNumber: '1096',
      issueTitle: 'Issue Analysis',
      previousQuestions: originalQuestions,
      recentComments: `**joshua-mullet-town** (2025-07-10T12:14:18Z):\n${userResponse}`
    });

    console.log('📝 Generated prompt:');
    console.log('─'.repeat(80));
    console.log(prompt);
    console.log('─'.repeat(80));

    const response = await callLLM({
      prompt,
      options: {
        temperature: 0.3,
        maxTokens: 300
      }
    });

    console.log('\n🤖 LLM Response:');
    console.log('─'.repeat(80));
    console.log(response.content);
    console.log('─'.repeat(80));

    // Parse the response
    const content = response.content.trim();
    
    if (content.includes('✅ Clarification complete.')) {
      console.log('\n✅ LLM detected clarification is complete!');
      const summaryMatch = content.match(/Summary of requirements:(.*?)(?:Ready to proceed|$)/s);
      if (summaryMatch) {
        console.log('📋 Summary:', summaryMatch[1].trim());
      }
    } else if (content.includes('❓ Need follow-up clarification on:')) {
      console.log('\n❓ LLM detected need for follow-up clarification');
      const followUpMatch = content.match(/❓ Need follow-up clarification on:(.*?)(?:Context:|$)/s);
      if (followUpMatch) {
        console.log('📋 Follow-up needed:', followUpMatch[1].trim());
      }
    } else if (content.includes('🔄 Please clarify your previous response:')) {
      console.log('\n🔄 LLM detected need for clarification of previous response');
      const clarifyMatch = content.match(/🔄 Please clarify your previous response:(.*?)(?:Context:|$)/s);
      if (clarifyMatch) {
        console.log('📋 Clarification needed:', clarifyMatch[1].trim());
      }
    } else {
      console.log('\n❌ LLM response format not recognized');
    }

  } catch (error) {
    console.error('❌ Error testing clarification analysis:', error);
  }
}

testClarificationAnalysis();