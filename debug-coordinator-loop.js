#!/usr/bin/env node

// Debug script to replicate exact coordinator behavior from VM logs
// Based on logs from VM 45.55.49.188 showing successful implementation but coordinator loop

const fs = require('fs');
const path = require('path');

// Import coordinator logic from webhook server
const { StatelessWebhook } = require('./dist/server/statelessWebhook.js');

console.log('🔍 DEBUGGING COORDINATOR LOOP ISSUE');
console.log('=====================================');

// Exact data from VM logs
const vmLogs = {
  // First successful implementation response from Claude CLI
  claudeImplementationOutput: `## Summary

I've modernized the About page content in \`/home/ubuntu/GiveGrove/src/components/routed/Marketing/About.vue\` to reflect GiveGrove's current platform maturity while preserving the existing structure and friendly tone.

### Key Changes Made:

1. **Opening section**: Replaced overly casual language with more professional but still welcoming tone
2. **Team & Mission section**: Updated to reflect current expertise and established track record rather than tentative early-stage language
3. **Lemon section**: Modernized the story to sound less like early development and more like an established design philosophy
4. **What makes GiveGrove different**: Strengthened the positioning to reflect years of experience serving organizations and refined the value proposition

### What was preserved:
- All existing sections and page structure
- The friendly, approachable GiveGrove brand tone
- The lemon story and imagery
- The core messaging about people-first technology
- The call-to-action structure

The updated content now accurately represents GiveGrove as the mature, sophisticated fundraising platform it has become while maintaining the authentic voice that makes the brand distinctive.`,

  // Issue context from VM
  issueContext: {
    number: 1191,
    title: "Modernize About page content to reflect current platform maturity",
    body: `## Issue Description

Our About page content hasn't been updated in several years and no longer reflects how much GiveGrove has matured as a platform. The current language feels outdated compared to where we are today as a fundraising solution.

## Current Situation

The About page still uses language and positioning from our earlier days when we were less established. Since then, we've:
- Grown significantly in capabilities and reliability
- Refined our core value proposition  
- Developed a more sophisticated understanding of our market
- Built a track record of successful fundraising events

## Requested Changes

**Goal**: Update the About page content to reflect our current maturity while preserving the core message and tone.

**Requirements**:
- Keep all existing sections and overall page structure
- Modernize language to reflect our current platform sophistication
- Update any outdated claims or positioning
- Ensure the content accurately represents GiveGrove today
- Maintain the same friendly, approachable tone
- No major structural changes - just content modernization

## Context

This is important for stakeholder confidence and accurately representing our current capabilities to potential clients and users. The About page is often the first place people go to understand who we are.

## Acceptance Criteria

- [ ] Content feels current and reflects our platform maturity
- [ ] All existing sections remain but with refreshed language  
- [ ] No outdated claims or positioning remain
- [ ] Tone remains consistent with GiveGrove brand
- [ ] Changes are clear improvements over existing content`
  }
};

async function debugCoordinatorLogic() {
  console.log('\n📊 TESTING COORDINATOR DETECTION LOGIC');
  console.log('=====================================\n');

  // Test current detection patterns
  const recentOutput = vmLogs.claudeImplementationOutput;
  
  console.log('🔍 Input (Claude CLI Output):');
  console.log(recentOutput.substring(0, 200) + '...\n');

  // Test implementation completion detection
  const implementationComplete = recentOutput.includes('implemented successfully') ||
                                 recentOutput.includes('already been implemented') ||
                                 recentOutput.includes('successfully applied') ||
                                 recentOutput.includes('change was successful');

  console.log('🎯 Current Detection Logic:');
  console.log(`  implementationComplete: ${implementationComplete}`);
  
  console.log('\n🔍 Checking Individual Patterns:');
  console.log(`  "implemented successfully": ${recentOutput.includes('implemented successfully')}`);
  console.log(`  "already been implemented": ${recentOutput.includes('already been implemented')}`);
  console.log(`  "successfully applied": ${recentOutput.includes('successfully applied')}`);
  console.log(`  "change was successful": ${recentOutput.includes('change was successful')}`);

  console.log('\n❌ PROBLEM IDENTIFIED:');
  console.log('The Claude CLI output contains implementation details and summary,');
  console.log('but none of the exact phrases the coordinator is looking for!');

  console.log('\n🔧 ENHANCED DETECTION PATTERNS:');
  
  // Test enhanced patterns that would catch this output
  const enhancedPatterns = [
    'Summary',
    'Key Changes Made',
    'modernized the About page',
    'Changes Made:',
    'updated content',
    'What was preserved',
    'successfully represents'
  ];

  enhancedPatterns.forEach(pattern => {
    const matches = recentOutput.includes(pattern);
    console.log(`  "${pattern}": ${matches}`);
  });

  console.log('\n✅ SOLUTION:');
  console.log('Add more flexible implementation detection patterns that catch');
  console.log('summary-style outputs and content modification descriptions.');
}

async function testNewDetectionLogic() {
  console.log('\n🧪 TESTING ENHANCED DETECTION LOGIC');
  console.log('===================================\n');

  const recentOutput = vmLogs.claudeImplementationOutput;

  // Enhanced implementation detection
  const enhancedImplementationComplete = 
    recentOutput.includes('implemented successfully') ||
    recentOutput.includes('already been implemented') ||
    recentOutput.includes('successfully applied') ||
    recentOutput.includes('change was successful') ||
    // NEW PATTERNS for content changes
    recentOutput.includes('Summary') ||
    recentOutput.includes('Key Changes Made') ||
    recentOutput.includes('Changes Made:') ||
    recentOutput.includes('updated content') ||
    recentOutput.includes('modernized') ||
    recentOutput.includes('What was preserved') ||
    (recentOutput.includes('updated') && recentOutput.includes('content')) ||
    (recentOutput.includes('changed') && recentOutput.length > 200);

  console.log(`🎯 Enhanced Detection Result: ${enhancedImplementationComplete}`);
  
  if (enhancedImplementationComplete) {
    console.log('✅ SUCCESS: Enhanced logic would detect implementation completion!');
    console.log('   Next step would be: TEST_WITH_PLAYWRIGHT_MCP');
  } else {
    console.log('❌ FAILURE: Even enhanced logic fails to detect completion');
  }
}

// Run the debug analysis
debugCoordinatorLogic()
  .then(() => testNewDetectionLogic())
  .then(() => {
    console.log('\n📋 RECOMMENDATIONS:');
    console.log('===================');
    console.log('1. Update coordinator detection patterns to include summary-style outputs');
    console.log('2. Look for "Summary", "Changes Made", "modernized", etc.');
    console.log('3. Consider content length + key phrases as implementation indicators');
    console.log('4. Test the enhanced logic end-to-end');
  })
  .catch(console.error);