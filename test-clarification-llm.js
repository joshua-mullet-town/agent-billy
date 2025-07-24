#!/usr/bin/env node

// Test actual LLM clarification parsing with Issue #1193
const { callLLM } = require('./dist/cognition/llmWrapper.js');
const { PromptLoader } = require('./dist/cognition/promptLoader.js');

async function testClarificationParsing() {
  console.log('🧪 TESTING ACTUAL LLM CLARIFICATION - Issue #1193');
  console.log('===============================================\n');

  // Exact Issue #1193 data
  const issueData = {
    title: "Update about page to mention that we are now using AI Agents to help develop software",
    body: `**Current**
On the /about page, there is a blurb that says: "The best tech in the world won't get you very far if no one knows how to use it just like the best fundraiser in the world won't make you very much money if no one participates in the event. Sure, we think GiveGrove is a pretty cool piece of technology (and is continuing to grow into an even better piece of technology all the time), but we want you to be able to use it and be comfortable with it. And you know what? If you aren't comfortable using it, we'll help you. We're here for you every step of the way."

**Desired**
The /about page keeps its content but the paragraph that starts with "The best tech in the world..." is updated to include that AI Agents are now being used to create bugfixes and features for the site.

**Testing**
Use Playwright MCP to visit the page and make sure things look visually correct and to confirm that the copy was updated.`,
    labels: ["for-billy"],
    author: "joshua-mullet-town",
    number: 1193
  };

  try {
    // Load the same prompt that Billy uses
    const prompt = await PromptLoader.loadPrompt('clarificationCheckGiveGrove', {
      issueTitle: issueData.title,
      issueBody: issueData.body,
      issueNumber: issueData.number.toString(),
      labels: issueData.labels.join(', '),
      author: issueData.author,
      comments: 'No comments yet'
    });

    console.log('📝 LOADED PROMPT:');
    console.log('================');
    console.log(prompt.substring(0, 300) + '...\n');

    // Call the actual LLM with same settings Billy uses
    console.log('🤖 CALLING LLM...');
    const response = await callLLM({
      prompt,
      options: { temperature: 0.3, maxTokens: 400 }
    });

    const content = response.content.trim();
    console.log('🎯 RAW LLM RESPONSE:');
    console.log('===================');
    console.log(content);
    console.log('');

    // Test Billy's parsing logic
    console.log('🔍 TESTING BILLY\'S PARSING LOGIC:');
    console.log('=================================');

    try {
      // Extract JSON from markdown code blocks if present
      let jsonString = content;
      const jsonMatch = content.match(/```json\s*(.*?)\s*```/s);
      if (jsonMatch) {
        console.log('✅ Found JSON in markdown code blocks');
        jsonString = jsonMatch[1].trim();
      } else {
        console.log('ℹ️ No markdown code blocks, using raw content');
      }
      
      console.log(`📄 JSON String to parse: "${jsonString}"`);
      
      // Parse JSON response from LLM
      const analysis = JSON.parse(jsonString);
      console.log('✅ Successfully parsed JSON:', JSON.stringify(analysis, null, 2));
      
      // Test Billy's decision logic
      switch (analysis.status) {
        case 'ready':
          console.log('🚀 RESULT: Billy should proceed to implementation (no clarification needed)');
          break;
          
        case 'needs_clarification':
          console.log('❓ RESULT: Billy should ask clarification questions');
          console.log('Questions:', analysis.questions);
          break;
          
        case 'reconsider':
          console.log('🛑 RESULT: Billy thinks this issue needs reconsideration');
          break;
          
        default:
          console.log(`⚠️ RESULT: Unknown status "${analysis.status}", defaulting to no clarification`);
      }
      
    } catch (parseError) {
      console.error(`❌ JSON PARSING FAILED: ${parseError.message}`);
      console.log('🔧 FALLBACK LOGIC:');
      
      if (content.toLowerCase().includes('ready') || content.toLowerCase().includes('proceed')) {
        console.log('✅ Fallback: Found "ready" or "proceed" - no clarification needed');
      } else {
        console.log('❓ Fallback: Defaulting to clarification needed');
      }
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testClarificationParsing();