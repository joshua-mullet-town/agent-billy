#!/usr/bin/env node

// Test clarification parsing with mock LLM responses
console.log('🧪 TESTING CLARIFICATION PARSING WITH MOCK RESPONSES');
console.log('===================================================\n');

// Mock LLM responses that might cause parsing issues
const mockResponses = [
  // Normal JSON response
  {
    name: 'Clean JSON Response',
    content: '{"status": "ready"}',
    expectedResult: 'Should parse successfully and proceed to implementation'
  },
  
  // JSON in markdown code blocks
  {
    name: 'JSON in Markdown',
    content: '```json\n{"status": "needs_clarification", "questions": ["What color should the text be?"]}\n```',
    expectedResult: 'Should extract JSON from markdown and ask clarification'
  },
  
  // JSON with extra text
  {
    name: 'JSON with Extra Text',
    content: 'After analyzing the issue, I believe it\'s ready.\n\n{"status": "ready"}\n\nThis looks good to proceed.',
    expectedResult: 'Should find JSON in mixed content and proceed'
  },
  
  // Malformed JSON
  {
    name: 'Malformed JSON',
    content: '{"status": "ready",}', // trailing comma
    expectedResult: 'Should fail parsing and use fallback logic'
  },
  
  // No JSON at all
  {
    name: 'No JSON Response',
    content: 'This issue looks ready to implement. I can proceed with the changes.',
    expectedResult: 'Should use fallback and find "ready" keyword'
  },
  
  // Incomplete JSON
  {
    name: 'Incomplete JSON',
    content: '{"status": "needs_clarification", "questions":',
    expectedResult: 'Should fail parsing and use fallback'
  }
];

// Billy's actual parsing logic
function testBillyParsing(content) {
  console.log(`🔍 Testing: "${content.substring(0, 50)}..."`);
  
  try {
    // Extract JSON from markdown code blocks if present
    let jsonString = content;
    const jsonMatch = content.match(/```json\s*(.*?)\s*```/s);
    if (jsonMatch) {
      console.log('  ✅ Found JSON in markdown code blocks');
      jsonString = jsonMatch[1].trim();
    } else {
      console.log('  ℹ️ No markdown code blocks, using raw content');
    }
    
    // Parse JSON response from LLM
    const analysis = JSON.parse(jsonString);
    console.log('  ✅ Successfully parsed JSON:', JSON.stringify(analysis));
    
    switch (analysis.status) {
      case 'ready':
        console.log('  🚀 RESULT: Proceed to implementation');
        return { needsClarification: false };
        
      case 'needs_clarification':
        console.log('  ❓ RESULT: Ask clarification questions');
        console.log('  Questions:', analysis.questions);
        return { needsClarification: true, questions: analysis.questions };
        
      case 'reconsider':
        console.log('  🛑 RESULT: Issue needs reconsideration');
        return { needsClarification: true, questions: analysis.reasons };
        
      default:
        console.log(`  ⚠️ Unknown status: ${analysis.status}, defaulting to no clarification`);
        return { needsClarification: false };
    }
  } catch (error) {
    console.log(`  ❌ JSON parsing failed: ${error.message}`);
    console.log('  🔧 Using fallback logic...');
    
    // Fallback to old string parsing for robustness
    if (content.toLowerCase().includes('ready') || content.toLowerCase().includes('proceed')) {
      console.log('  ✅ Fallback: Found "ready" or "proceed" keywords');
      return { needsClarification: false };
    } else {
      console.log('  ❓ Fallback: Defaulting to clarification needed');
      return { needsClarification: true, questions: 'Please provide more details.' };
    }
  }
}

// Test each mock response
mockResponses.forEach((mockResponse, index) => {
  console.log(`\n${index + 1}. ${mockResponse.name}`);
  console.log('='.repeat(mockResponse.name.length + 3));
  console.log(`Expected: ${mockResponse.expectedResult}`);
  
  const result = testBillyParsing(mockResponse.content);
  console.log(`Actual Result: needsClarification = ${result.needsClarification}`);
  
  if (result.questions) {
    console.log(`Questions: ${JSON.stringify(result.questions)}`);
  }
});

console.log('\n🎯 ISSUE #1193 ANALYSIS:');
console.log('========================');
console.log('Based on the issue structure (Current/Desired/Testing), Billy should return:');
console.log('{"status": "ready"}');
console.log('');
console.log('This would result in needsClarification = false and proceed to implementation.');
console.log('');
console.log('If Billy went straight to implementation without clarification questions,');
console.log('it suggests the clarification logic worked correctly - the issue was clear enough.');

console.log('\n📋 DEBUGGING STEPS:');
console.log('==================');
console.log('1. Check Railway logs for the actual LLM response to Issue #1193');
console.log('2. Look for "Billy\'s LLM analysis FULL result:" in logs');
console.log('3. Verify the JSON parsing succeeded or failed');
console.log('4. Check if Billy posted clarification questions that were missed');