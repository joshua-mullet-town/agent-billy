#!/usr/bin/env node

// Fast test for Railway file copy permissions - no end-to-end needed
const fs = require('fs-extra');
const path = require('path');

async function testFileCopyOperations() {
  console.log('🧪 Testing Railway file copy operations...');
  console.log(`📁 Current working directory: ${process.cwd()}`);
  console.log(`👤 Process user: ${process.env.USER || 'unknown'}`);
  
  // Test source file - should exist locally
  const sourceFile = path.join(process.cwd(), 'secrets.yml');
  
  try {
    const stats = fs.statSync(sourceFile);
    console.log(`✅ Source file exists: ${sourceFile} (${stats.size} bytes, mode: ${stats.mode.toString(8)})`);
  } catch (error) {
    console.log(`❌ Source file missing: ${sourceFile}`, error.message);
    return;
  }

  const testDirs = [
    '/tmp/test-copy',
    '/app/test-copy', 
    '/app/temp/test-copy',
    `${process.cwd()}/temp-test-copy`
  ];

  const results = [];

  for (const testDir of testDirs) {
    console.log(`\n🔍 Testing directory: ${testDir}`);
    
    try {
      // Try to create directory
      fs.mkdirSync(testDir, { recursive: true });
      console.log(`✅ Directory created: ${testDir}`);
      
      // Test different copy methods
      const testFile = path.join(testDir, 'secrets-test.yml');
      
      // Method 1: fs.copyFileSync
      try {
        fs.copyFileSync(sourceFile, testFile);
        console.log(`✅ fs.copyFileSync worked: ${testFile}`);
        fs.unlinkSync(testFile); // cleanup
        results.push({ dir: testDir, method: 'fs.copyFileSync', success: true });
      } catch (copyError) {
        console.log(`❌ fs.copyFileSync failed: ${copyError.message}`);
        results.push({ dir: testDir, method: 'fs.copyFileSync', success: false, error: copyError.message });
      }
      
      // Method 2: fs-extra copySync
      try {
        const fsExtra = require('fs-extra');
        fsExtra.copySync(sourceFile, testFile);
        console.log(`✅ fs-extra.copySync worked: ${testFile}`);
        fs.unlinkSync(testFile); // cleanup
        results.push({ dir: testDir, method: 'fs-extra.copySync', success: true });
      } catch (copyError) {
        console.log(`❌ fs-extra.copySync failed: ${copyError.message}`);
        results.push({ dir: testDir, method: 'fs-extra.copySync', success: false, error: copyError.message });
      }
      
      // Method 3: Read + write approach  
      try {
        const content = fs.readFileSync(sourceFile);
        fs.writeFileSync(testFile, content);
        console.log(`✅ read+write approach worked: ${testFile}`);
        fs.unlinkSync(testFile); // cleanup
        results.push({ dir: testDir, method: 'read+write', success: true });
      } catch (copyError) {
        console.log(`❌ read+write approach failed: ${copyError.message}`);
        results.push({ dir: testDir, method: 'read+write', success: false, error: copyError.message });
      }

      // Check directory permissions
      try {
        const dirStats = fs.statSync(testDir);
        console.log(`📊 Directory permissions: ${dirStats.mode.toString(8)}`);
      } catch (statError) {
        console.log(`❌ Can't stat directory: ${statError.message}`);
      }
      
      // Cleanup
      fs.rmSync(testDir, { recursive: true, force: true });
      
    } catch (error) {
      console.log(`❌ Directory test failed: ${error.message}`);
      results.push({ dir: testDir, method: 'directory_creation', success: false, error: error.message });
    }
  }

  console.log('\n📊 SUMMARY:');
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const errorMsg = result.error ? ` (${result.error})` : '';
    console.log(`${status} ${result.dir} - ${result.method}${errorMsg}`);
  });

  return results;
}

if (require.main === module) {
  testFileCopyOperations().catch(console.error);
}

module.exports = { testFileCopyOperations };