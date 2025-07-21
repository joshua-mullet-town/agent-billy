#!/usr/bin/env node

// Test that exactly mimics runAnsiblePlaybook vault upload behavior
const fs = require('fs');
const { spawn } = require('child_process');

async function testExactVaultUpload() {
  console.log('🔍 Testing EXACT runAnsiblePlaybook vault upload behavior...');
  
  const vmIp = '174.138.84.209';
  const sshKeyPath = '/tmp/ssh_key';  // EXACT same path as runAnsiblePlaybook
  const vaultPasswordPath = '/tmp/test_vault_exact.pass';
  
  try {
    // Step 1: Setup SSH key exactly like runAnsiblePlaybook does
    console.log('📋 Step 1: Setting up SSH key like runAnsiblePlaybook...');
    const sshKeyBase64 = process.env.SSH_PRIVATE_KEY || '';
    if (!sshKeyBase64) {
      console.error('❌ SSH_PRIVATE_KEY environment variable not found');
      return false;
    }
    
    const privateKey = Buffer.from(sshKeyBase64, 'base64').toString('ascii');
    if (!privateKey.endsWith('\n')) {
      privateKey += '\n';
    }
    fs.writeFileSync(sshKeyPath, privateKey, { mode: 0o600 });
    console.log(`✅ SSH key written to ${sshKeyPath} (same as runAnsiblePlaybook)`);

    // Step 2: Create vault password file exactly like runAnsiblePlaybook
    console.log('📋 Step 2: Creating vault password file like runAnsiblePlaybook...');
    const vaultPassword = 'ansible-vault-password-2024';  // Same as Railway env var
    fs.writeFileSync(vaultPasswordPath, vaultPassword);
    console.log(`✅ Vault password file created: ${vaultPasswordPath}`);

    // Step 3: SCP upload with EXACT same parameters as runAnsiblePlaybook
    console.log('📋 Step 3: SCP upload with exact runAnsiblePlaybook parameters...');
    const uploadResult = await new Promise((resolve) => {
      const uploadProcess = spawn('scp', [
        '-i', sshKeyPath,              // Same SSH key path
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'ConnectTimeout=15',     // Same timeout
        vaultPasswordPath,             // Local vault file
        `ubuntu@${vmIp}:/home/ubuntu/.vault_pass`  // Same target path
      ], { stdio: 'pipe' });

      let uploadOutput = '';
      let uploadError = '';
      
      uploadProcess.stdout.on('data', (data) => uploadOutput += data.toString());
      uploadProcess.stderr.on('data', (data) => uploadError += data.toString());
      
      uploadProcess.on('close', (code) => {
        console.log(`SCP exit code: ${code}`);
        if (uploadOutput.trim()) console.log(`SCP stdout: ${uploadOutput.trim()}`);
        if (uploadError.trim()) console.log(`SCP stderr: ${uploadError.trim()}`);
        resolve(code === 0);
      });
    });

    if (!uploadResult) {
      console.error('❌ EXACT vault upload FAILED - this explains Issue #1144!');
      return false;
    }

    // Step 4: Verify upload exactly like we expect
    console.log('📋 Step 4: Verifying vault file exists...');
    const verifyResult = await new Promise((resolve) => {
      const verifyProcess = spawn('ssh', [
        '-i', sshKeyPath,
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'ConnectTimeout=10',
        `ubuntu@${vmIp}`,
        'ls -la /home/ubuntu/.vault_pass && cat /home/ubuntu/.vault_pass'
      ], { stdio: 'pipe' });

      let verifyOutput = '';
      
      verifyProcess.stdout.on('data', (data) => verifyOutput += data.toString());
      verifyProcess.stderr.on('data', (data) => verifyOutput += data.toString());
      
      verifyProcess.on('close', (code) => {
        console.log(`Verify exit code: ${code}`);
        console.log(`Verify output: ${verifyOutput.trim()}`);
        resolve(code === 0);
      });
    });

    if (verifyResult) {
      console.log('✅ EXACT vault upload test SUCCESSFUL!');
      return true;
    } else {
      console.log('❌ Vault file verification failed');
      return false;
    }

  } catch (error) {
    console.error('💥 Exact vault upload test crashed:', error);
    return false;
  }
}

if (require.main === module) {
  testExactVaultUpload()
    .then(result => {
      console.log(`\n🎯 Final Result: ${result ? 'SUCCESS - vault upload works exactly like runAnsiblePlaybook' : 'FAILURE - found the difference!'}`);
      process.exit(result ? 0 : 1);
    })
    .catch(error => {
      console.error(`💥 Test crashed: ${error}`);
      process.exit(1);
    });
}

module.exports = { testExactVaultUpload };