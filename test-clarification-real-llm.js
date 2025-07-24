#!/usr/bin/env node

// Test clarification parsing with REAL LLM to verify strict JSON compliance
const { callLLM } = require('./dist/cognition/llmWrapper.js');
const fs = require('fs');

console.log('🧪 TESTING CLARIFICATION WITH REAL LLM');
console.log('======================================\n');

// Load the updated clarification prompt
const promptTemplate = fs.readFileSync('./prompts/clarificationCheckGiveGrove.md', 'utf8');

// Test issue data - clear implementation without IMMEDIATE flag
const testIssue = {
  issueNumber: '1195',
  issueTitle: 'Update footer copyright year to 2025',
  issueBody: `**Current:** Footer shows "© 2024 GiveGrove"
**Desired:** Update to "© 2025 GiveGrove" 
**Testing:** Footer should display correct year`,
  labels: 'for-billy, enhancement',
  author: 'testuser',
  comments: 'No previous comments.'
};

// Fill in the prompt template
let prompt = promptTemplate
  .replace('{issueNumber}', testIssue.issueNumber)
  .replace('{issueTitle}', testIssue.issueTitle)
  .replace('{issueBody}', testIssue.issueBody)
  .replace('{labels}', testIssue.labels)
  .replace('{author}', testIssue.author)
  .replace('{comments}', testIssue.comments);

async function testRealLLM() {
  try {
    console.log('📤 SENDING REQUEST TO LLM...');
    console.log('=====================================');
    console.log('Issue:', testIssue.issueTitle);
    console.log('Expected: {"status": "ready"} OR {"status": "needs_clarification", "questions": [...]}');
    console.log('');

    const response = await callLLM({
      prompt: prompt,
      model: 'claude',
      options: {
        maxTokens: 1000,
        temperature: 0.1
      }
    });

    console.log('📥 LLM RESPONSE:');
    console.log('================');
    console.log(response.content);
    console.log('');

    console.log('🔍 TESTING STRICT JSON PARSING:');
    console.log('===============================');
    
    try {
      // This is our new strict parsing logic - NO fallbacks
      const analysis = JSON.parse(response.content.trim());
      console.log('✅ SUCCESS: LLM returned valid JSON!');
      console.log('Parsed result:', JSON.stringify(analysis, null, 2));
      
      // Validate the structure
      if (analysis.status === 'ready') {
        console.log('\n🚀 RESULT: Would proceed to implementation');
      } else if (analysis.status === 'needs_clarification' && Array.isArray(analysis.questions)) {
        console.log('\n❓ RESULT: Would ask clarification questions:');
        analysis.questions.forEach((q, i) => console.log(`  ${i + 1}. ${q}`));
      } else {
        console.log('\n⚠️ WARNING: Unexpected JSON structure');
      }

    } catch (error) {
      console.log('❌ CRITICAL FAILURE: LLM did not return valid JSON!');
      console.log(`Parse error: ${error.message}`);
      console.log('\n🚨 This would cause Billy to fail with our new strict parsing logic');
      console.log('   The prompt engineering needs improvement to enforce JSON-only responses');
    }

  } catch (error) {
    console.error('❌ LLM API Error:', error.message);
  }
}

// Run the test
testRealLLM();