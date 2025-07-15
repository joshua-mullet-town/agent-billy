#!/usr/bin/env node

/**
 * SSH Key Format Testing - Replicating Railway Environment Variable Issues
 * 
 * This script tests different SSH private key formats to find the working solution
 * for Railway environment variables → SSH client usage.
 */

const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

console.log('🔬 SSH Key Format Testing Suite');
console.log('===============================');

// Read the working local SSH key for comparison
const os = require('os');
const localKeyPath = path.join(os.homedir(), '.ssh', 'id_ed25519_digital_ocean');
let workingKey = '';

try {
  workingKey = fs.readFileSync(localKeyPath, 'utf8');
  console.log('✅ Read working local SSH key');
  console.log(`📊 Working key length: ${workingKey.length} chars`);
  console.log(`🔤 Working key first 50 chars: "${workingKey.substring(0, 50)}"`);
} catch (error) {
  console.log('❌ Could not read local SSH key:', error.message);
  process.exit(1);
}

// Simulate different Railway environment variable formats
const railwayFormats = [
  {
    name: 'Railway Raw (actual newlines)',
    description: 'How Railway stores it with real newlines',
    key: workingKey
  },
  {
    name: 'Railway Literal \\n',
    description: 'How Railway might store it with literal backslash-n',
    key: workingKey.replace(/\n/g, '\\n')
  },
  {
    name: 'Railway Single Line',
    description: 'All on one line with spaces instead of newlines',
    key: workingKey.replace(/\n/g, ' ')
  },
  {
    name: 'Railway Base64',
    description: 'Base64 encoded (recommended solution)',
    key: Buffer.from(workingKey).toString('base64'),
    needsDecoding: true
  }
];

// Test different processing approaches
const processingMethods = [
  {
    name: 'No Processing',
    process: (key) => key
  },
  {
    name: 'Replace \\n with newlines',
    process: (key) => key.replace(/\\n/g, '\n')
  },
  {
    name: 'Base64 Decode',
    process: (key) => {
      try {
        return Buffer.from(key, 'base64').toString('ascii');
      } catch (e) {
        return key; // If not base64, return as-is
      }
    }
  },
  {
    name: 'Add proper headers',
    process: (key) => {
      let formatted = key.replace(/\\n/g, '\n');
      if (!formatted.includes('\n')) {
        formatted = formatted
          .replace(/-----BEGIN/, '\n-----BEGIN')
          .replace(/-----END/, '\n-----END')
          .replace(/KEY-----/, 'KEY-----\n');
      }
      return formatted.endsWith('\n') ? formatted : formatted + '\n';
    }
  }
];

const testVM = process.argv[2] || '45.55.32.42';

async function testSSHKeyFormat(railwayFormat, processingMethod, testIndex) {
  const testKeyPath = `/tmp/test_ssh_key_${testIndex}`;
  
  try {
    // Get the key in Railway format
    let testKey = railwayFormat.key;
    
    // Apply processing method
    const processedKey = processingMethod.process(testKey);
    
    // Ensure key ends with newline
    const finalKey = processedKey.endsWith('\n') ? processedKey : processedKey + '\n';
    
    // Write to test file
    fs.writeFileSync(testKeyPath, finalKey, { mode: 0o600 });
    
    console.log(`\n🧪 Test ${testIndex}: ${railwayFormat.name} + ${processingMethod.name}`);
    console.log(`📝 Railway format: ${railwayFormat.description}`);
    console.log(`⚙️  Processing: ${processingMethod.name}`);
    console.log(`📊 Final key length: ${finalKey.length} chars`);
    console.log(`🔤 Final key first 50 chars: "${finalKey.substring(0, 50)}"`);
    
    // Test SSH connection
    const result = await new Promise((resolve) => {
      const sshProcess = spawn('ssh', [
        '-i', testKeyPath,
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'ConnectTimeout=5',
        '-o', 'PasswordAuthentication=no',
        '-o', 'BatchMode=yes',
        `ubuntu@${testVM}`,
        'whoami'
      ], { stdio: 'pipe' });

      let output = '';
      let errorOutput = '';
      
      sshProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      sshProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      sshProcess.on('close', (code) => {
        resolve({
          success: code === 0 && output.trim() === 'ubuntu',
          code,
          output: output.trim(),
          error: errorOutput.trim()
        });
      });

      setTimeout(() => {
        sshProcess.kill();
        resolve({
          success: false,
          code: -1,
          output: '',
          error: 'Timeout'
        });
      }, 10000);
    });

    if (result.success) {
      console.log(`✅ SUCCESS! SSH connection worked!`);
      console.log(`📤 Output: "${result.output}"`);
      
      // Save the working configuration
      fs.writeFileSync('/tmp/working_ssh_config.json', JSON.stringify({
        railwayFormat: railwayFormat.name,
        processingMethod: processingMethod.name,
        description: `${railwayFormat.description} + ${processingMethod.name}`,
        keyLength: finalKey.length,
        testTime: new Date().toISOString()
      }, null, 2));
      
      return true;
    } else {
      console.log(`❌ FAILED: SSH connection failed (code: ${result.code})`);
      console.log(`📤 Output: "${result.output}"`);
      console.log(`📤 Error: "${result.error}"`);
    }
    
    // Cleanup
    fs.unlinkSync(testKeyPath);
    
    return false;
    
  } catch (error) {
    console.log(`💥 Exception: ${error.message}`);
    try {
      fs.unlinkSync(testKeyPath);
    } catch (e) {}
    return false;
  }
}

async function runComprehensiveTest() {
  console.log(`\n🎯 Testing SSH connection to ${testVM}`);
  console.log(`📋 Testing ${railwayFormats.length} Railway formats × ${processingMethods.length} processing methods = ${railwayFormats.length * processingMethods.length} combinations\n`);
  
  let testIndex = 0;
  let successFound = false;
  
  for (const railwayFormat of railwayFormats) {
    for (const processingMethod of processingMethods) {
      testIndex++;
      
      const success = await testSSHKeyFormat(railwayFormat, processingMethod, testIndex);
      
      if (success && !successFound) {
        console.log(`\n🎉 WORKING SOLUTION FOUND!`);
        console.log(`📋 Railway Format: ${railwayFormat.name}`);
        console.log(`⚙️  Processing Method: ${processingMethod.name}`);
        console.log(`📄 Full Description: ${railwayFormat.description} + ${processingMethod.name}`);
        successFound = true;
      }
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  if (!successFound) {
    console.log(`\n❌ No working configuration found!`);
    console.log(`🔍 Check VM accessibility and SSH key validity`);
  } else {
    console.log(`\n📁 Working configuration saved to /tmp/working_ssh_config.json`);
  }
}

// Verify VM is accessible first
async function verifyVMAccess() {
  console.log(`🔍 Verifying VM ${testVM} is accessible with local key...`);
  
  const result = await new Promise((resolve) => {
    const sshProcess = spawn('ssh', [
      '-i', localKeyPath,
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'ConnectTimeout=5',
      `ubuntu@${testVM}`,
      'whoami'
    ], { stdio: 'pipe' });

    let output = '';
    sshProcess.stdout.on('data', (data) => output += data.toString());
    sshProcess.on('close', (code) => resolve(code === 0 && output.trim() === 'ubuntu'));
  });
  
  if (result) {
    console.log(`✅ VM is accessible with local key`);
    return true;
  } else {
    console.log(`❌ VM is not accessible with local key - check VM IP and key`);
    return false;
  }
}

// Main execution
async function main() {
  if (await verifyVMAccess()) {
    await runComprehensiveTest();
  }
}

main().catch(console.error);