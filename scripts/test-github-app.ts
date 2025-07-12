#!/usr/bin/env ts-node

import { GitHubAppAuth } from '../auth/githubApp';

async function testGitHubApp() {
  console.log('🧪 Testing GitHub App authentication...');
  
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  
  if (!appId || !privateKey) {
    console.error('❌ Missing GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY');
    process.exit(1);
  }
  
  console.log(`📱 App ID: ${appId}`);
  console.log(`🔑 Private Key length: ${privateKey.length} chars`);
  console.log(`🔑 Has proper header: ${privateKey.includes('-----BEGIN')}`);
  console.log(`🔑 First 100 chars: ${privateKey.substring(0, 100)}...`);
  console.log(`🔑 Contains \\n: ${privateKey.includes('\\n')}`);
  console.log(`🔑 Contains actual newlines: ${privateKey.includes('\n')}`);
  
  try {
    const auth = new GitHubAppAuth({
      appId,
      privateKey,
      installationId: process.env.GITHUB_APP_INSTALLATION_ID
    });
    
    console.log('✅ GitHubAppAuth created successfully');
    
    // Test getting installation token
    const token = await auth.getInstallationToken('GiveGrove', 'givegroove-platform');
    console.log(`✅ Installation token received: ${token.substring(0, 10)}...`);
    
    // Test API call
    const headers = await auth.getAuthHeaders('GiveGrove', 'givegroove-platform');
    console.log('✅ Auth headers generated successfully');
    
  } catch (error) {
    console.error('❌ GitHub App test failed:', error);
    process.exit(1);
  }
  
  console.log('🎉 All tests passed!');
}

testGitHubApp().catch(console.error);