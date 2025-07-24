#!/usr/bin/env node

// Debug script to test clarification parsing with Issue #1193 data
const fs = require('fs');
const path = require('path');

console.log('🔍 DEBUGGING CLARIFICATION PARSING - Issue #1193');
console.log('===========================================\n');

// Exact Issue #1193 data
const issueData = {
  number: 1193,
  title: "Update about page to mention that we are now using AI Agents to help develop software",
  body: `**Current**
On the /about page, there is a blurb that says: "The best tech in the world won't get you very far if no one knows how to use it just like the best fundraiser in the world won't make you very much money if no one participates in the event. Sure, we think GiveGrove is a pretty cool piece of technology (and is continuing to grow into an even better piece of technology all the time), but we want you to be able to use it and be comfortable with it. And you know what? If you aren't comfortable using it, we'll help you. We're here for you every step of the way."

**Desired**
The /about page keeps its content but the paragraph that starts with "The best tech in the world..." is updated to include that AI Agents are now being used to create bugfixes and features for the site.

**Testing**
Use Playwright MCP to visit the page and make sure things look visually correct and to confirm that the copy was updated.`,
  labels: ["for-billy"],
  author: "joshua-mullet-town",
  comments: []
};

// Load the clarification prompt template
const promptTemplate = fs.readFileSync(
  path.join(__dirname, 'prompts/clarificationCheckGiveGrove.md'), 
  'utf8'
);

// Substitute the actual issue data into the template
let clarificationPrompt = promptTemplate
  .replace('{issueNumber}', issueData.number)
  .replace('{issueTitle}', issueData.title)
  .replace('{issueBody}', issueData.body)
  .replace('{labels}', issueData.labels.join(', '))
  .replace('{author}', issueData.author)
  .replace('{comments}', issueData.comments.length ? issueData.comments.join('\n\n') : 'No previous comments');

console.log('📝 CLARIFICATION PROMPT GENERATED:');
console.log('=================================');
console.log(clarificationPrompt.substring(0, 500) + '...\n');

console.log('🧪 TESTING IMMEDIATE IMPLEMENTATION DETECTION:');
console.log('=============================================');

// Test immediate implementation detection
const hasImmediateImplementation = issueData.title.startsWith("IMMEDIATE IMPLEMENTATION");
console.log(`Title: "${issueData.title}"`);
console.log(`Starts with "IMMEDIATE IMPLEMENTATION": ${hasImmediateImplementation}`);

if (hasImmediateImplementation) {
  console.log('✅ Should return: {"status": "ready"}');
} else {
  console.log('❓ Should analyze for clarification needs');
}

console.log('\n🎯 ANALYSIS OF ISSUE #1193:');
console.log('==========================');
console.log('Issue Structure:');
console.log('- ✅ Has Current section');
console.log('- ✅ Has Desired section'); 
console.log('- ✅ Has Testing section');
console.log('- ✅ Clear requirements');
console.log('- ✅ Specific page (/about)');
console.log('- ✅ Specific content to modify');

console.log('\n🤔 CLARIFICATION ASSESSMENT:');
console.log('===========================');

// Simulate what the AI should determine
const hasEnoughInfo = true; // This issue has clear requirements
const needsClarification = false; // No ambiguity

if (hasEnoughInfo && !needsClarification) {
  console.log('✅ EXPECTED RESPONSE: {"status": "ready"}');
  console.log('   Reason: Issue has clear current/desired/testing structure');
} else {
  console.log('❓ EXPECTED RESPONSE: {"status": "needs_clarification"}');
}

console.log('\n🐛 POTENTIAL PARSING ISSUES:');
console.log('============================');

// Check for potential JSON parsing issues
const testResponses = [
  '{"status": "ready"}',
  '{"status": "needs_clarification", "questions": ["test"]}',
  '```json\n{"status": "ready"}\n```',
  'The issue looks clear.\n\n{"status": "ready"}',
];

testResponses.forEach((response, index) => {
  console.log(`\nTest Response ${index + 1}: ${response}`);
  
  try {
    // Try to extract JSON
    let jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log(`  ✅ Parsed: ${JSON.stringify(parsed)}`);
    } else {
      console.log(`  ❌ No JSON found`);
    }
  } catch (error) {
    console.log(`  ❌ Parse error: ${error.message}`);
  }
});

console.log('\n📋 RECOMMENDATIONS:');
console.log('==================');
console.log('1. Check if LLM is returning JSON wrapped in markdown code blocks');
console.log('2. Verify JSON parsing handles extra text before/after JSON');
console.log('3. Test with actual LLM to see exact response format');
console.log('4. Check if the issue is in prompt template variable substitution');