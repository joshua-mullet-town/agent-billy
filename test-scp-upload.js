#!/usr/bin/env node

// Minimal test to debug SCP upload from Railway to VM
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function testSCPUpload() {
  console.log('🧪 Testing SCP upload from Railway container to VM...');
  
  const vmIp = '174.138.84.209';  // Issue #1144 VM
  const sshKeyPath = '/tmp/ssh_key_test';
  
  // Step 1: Check if SSH key exists and decode it properly
  console.log('📋 Step 1: Setting up SSH key...');
  const sshKeyBase64 = process.env.SSH_PRIVATE_KEY || '';
  if (!sshKeyBase64) {
    console.error('❌ SSH_PRIVATE_KEY environment variable not found');
    return false;
  }
  
  try {
    const privateKey = Buffer.from(sshKeyBase64, 'base64').toString('ascii');
    fs.writeFileSync(sshKeyPath, privateKey, { mode: 0o600 });
    console.log(`✅ SSH key written to ${sshKeyPath}`);
  } catch (error) {
    console.error(`❌ Failed to decode/write SSH key: ${error}`);
    return false;
  }
  
  // Step 2: Create test file to upload
  console.log('📋 Step 2: Creating test file...');
  const testFilePath = '/tmp/vault_test_upload.txt';
  const testContent = 'ansible-vault-password-2024\ntest-upload-from-railway';
  fs.writeFileSync(testFilePath, testContent);
  console.log(`✅ Test file created: ${testFilePath}`);
  
  // Step 3: Test basic SSH connectivity first
  console.log('📋 Step 3: Testing SSH connectivity...');
  const sshTestResult = await new Promise((resolve) => {
    const sshProcess = spawn('ssh', [
      '-i', sshKeyPath,
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'ConnectTimeout=10',
      '-o', 'BatchMode=yes',
      `ubuntu@${vmIp}`,
      'echo "SSH connectivity test successful"'
    ], { stdio: 'pipe' });

    let sshOutput = '';
    let sshError = '';
    
    sshProcess.stdout.on('data', (data) => sshOutput += data.toString());
    sshProcess.stderr.on('data', (data) => sshError += data.toString());
    
    sshProcess.on('close', (code) => {
      console.log(`SSH test exit code: ${code}`);
      if (sshOutput.trim()) console.log(`SSH stdout: ${sshOutput.trim()}`);
      if (sshError.trim()) console.log(`SSH stderr: ${sshError.trim()}`);
      resolve(code === 0);
    });
  });

  if (!sshTestResult) {
    console.error('❌ SSH connectivity test failed - cannot proceed with SCP');
    return false;
  }
  console.log('✅ SSH connectivity confirmed');

  // Step 4: Test SCP upload
  console.log('📋 Step 4: Testing SCP upload...');
  const scpResult = await new Promise((resolve) => {
    const scpProcess = spawn('scp', [
      '-i', sshKeyPath,
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'ConnectTimeout=15',
      '-v',  // Verbose output for debugging
      testFilePath,
      `ubuntu@${vmIp}:/home/ubuntu/vault_test_upload.txt`
    ], { stdio: 'pipe' });

    let scpOutput = '';
    let scpError = '';
    
    scpProcess.stdout.on('data', (data) => scpOutput += data.toString());
    scpProcess.stderr.on('data', (data) => scpError += data.toString());
    
    scpProcess.on('close', (code) => {
      console.log(`SCP exit code: ${code}`);
      if (scpOutput.trim()) console.log(`SCP stdout: ${scpOutput.trim()}`);
      if (scpError.trim()) console.log(`SCP stderr: ${scpError.trim()}`);
      resolve(code === 0);
    });
  });

  // Step 5: Verify upload worked
  if (scpResult) {
    console.log('📋 Step 5: Verifying upload...');
    const verifyResult = await new Promise((resolve) => {
      const verifyProcess = spawn('ssh', [
        '-i', sshKeyPath,
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'ConnectTimeout=10',
        `ubuntu@${vmIp}`,
        'ls -la /home/ubuntu/vault_test_upload.txt && cat /home/ubuntu/vault_test_upload.txt'
      ], { stdio: 'pipe' });

      let verifyOutput = '';
      let verifyError = '';
      
      verifyProcess.stdout.on('data', (data) => verifyOutput += data.toString());
      verifyProcess.stderr.on('data', (data) => verifyError += data.toString());
      
      verifyProcess.on('close', (code) => {
        console.log(`Verify exit code: ${code}`);
        if (verifyOutput.trim()) console.log(`Verify stdout: ${verifyOutput.trim()}`);
        if (verifyError.trim()) console.log(`Verify stderr: ${verifyError.trim()}`);
        resolve(code === 0);
      });
    });

    if (verifyResult) {
      console.log('✅ SCP upload test SUCCESSFUL!');
      return true;
    } else {
      console.log('❌ File upload failed verification');
      return false;
    }
  } else {
    console.error('❌ SCP upload FAILED');
    return false;
  }
}

if (require.main === module) {
  testSCPUpload()
    .then(result => {
      console.log(`\n🎯 Final Result: ${result ? 'SUCCESS' : 'FAILURE'}`);
      process.exit(result ? 0 : 1);
    })
    .catch(error => {
      console.error(`💥 Test crashed: ${error}`);
      process.exit(1);
    });
}

module.exports = { testSCPUpload };