#!/usr/bin/env node

// Debug SSH key formatting from Railway environment
const fs = require('fs');
const { spawn } = require('child_process');

console.log('🔍 SSH Key Format Debugging');
console.log('============================');

// Get the SSH key from environment (same as Billy does)
const sshKey = process.env.SSH_PRIVATE_KEY || '';

if (!sshKey) {
  console.log('❌ SSH_PRIVATE_KEY not found in environment');
  process.exit(1);
}

console.log(`📊 Raw key length: ${sshKey.length} characters`);
console.log(`🔤 Contains \\n literals: ${sshKey.includes('\\n')}`);
console.log(`🔤 Contains actual newlines: ${sshKey.includes('\n')}`);
console.log(`🔤 First 100 chars: "${sshKey.substring(0, 100)}"`);

// Test different formatting approaches
const formats = [
  {
    name: 'Raw (no changes)',
    key: sshKey
  },
  {
    name: 'Replace \\n with newlines',
    key: sshKey.replace(/\\n/g, '\n')
  },
  {
    name: 'Add newlines around headers',
    key: sshKey
      .replace(/-----BEGIN/, '\n-----BEGIN')
      .replace(/-----END/, '\n-----END')
      .replace(/KEY-----/, 'KEY-----\n')
  },
  {
    name: 'Both replacements',
    key: sshKey
      .replace(/\\n/g, '\n')
      .replace(/-----BEGIN/, '\n-----BEGIN')
      .replace(/-----END/, '\n-----END')
      .replace(/KEY-----/, 'KEY-----\n')
  }
];

const vmIP = process.argv[2] || '104.236.8.27';

async function testSSHFormat(format, index) {
  const keyPath = `/tmp/test_ssh_key_${index}`;
  
  try {
    // Ensure key ends with newline
    let testKey = format.key;
    if (!testKey.endsWith('\n')) {
      testKey += '\n';
    }
    
    fs.writeFileSync(keyPath, testKey, { mode: 0o600 });
    
    console.log(`\n🧪 Testing: ${format.name}`);
    console.log(`📝 Key length after formatting: ${testKey.length} characters`);
    console.log(`🔤 First 50 chars: "${testKey.substring(0, 50)}"`);
    
    // Test SSH connection
    const result = await new Promise((resolve) => {
      const sshProcess = spawn('ssh', [
        '-i', keyPath,
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'ConnectTimeout=5',
        `-o`, 'PasswordAuthentication=no',
        `ubuntu@${vmIP}`,
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
      console.log(`✅ SUCCESS: SSH connection worked!`);
      console.log(`📤 Output: "${result.output}"`);
    } else {
      console.log(`❌ FAILED: SSH connection failed (code: ${result.code})`);
      console.log(`📤 Output: "${result.output}"`);
      console.log(`📤 Error: "${result.error}"`);
    }
    
    // Cleanup
    fs.unlinkSync(keyPath);
    
    return result.success;
    
  } catch (error) {
    console.log(`💥 Exception: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log(`\n🎯 Testing SSH connection to ${vmIP}`);
  
  for (let i = 0; i < formats.length; i++) {
    const success = await testSSHFormat(formats[i], i);
    if (success) {
      console.log(`\n🎉 WINNER: "${formats[i].name}" format works!`);
      break;
    }
  }
}

runTests().catch(console.error);