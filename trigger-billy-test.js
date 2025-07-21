#!/usr/bin/env node

// Trigger Billy to create a VM so we can debug coordinator polling
const axios = require('axios');

async function triggerBilly() {
  try {
    // Simulate a GitHub webhook that would trigger Billy
    const webhook = {
      action: 'labeled',
      issue: {
        number: 1119,
        title: 'Debug coordinator polling test',
        body: 'Testing coordinator workflow debugging'
      },
      label: {
        name: 'for-billy'
      },
      repository: {
        name: 'GiveGrove',
        owner: {
          login: 'south-bend-code-works'
        }
      }
    };

    console.log('Triggering Billy webhook to create coordinator VM...');
    const response = await axios.post('https://agent-billy-production.up.railway.app/webhooks/github', webhook, {
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': 'issues'
      }
    });

    console.log('✅ Billy triggered, check Railway logs for VM creation');
    console.log('Response:', response.status);
    
  } catch (error) {
    console.error('Error triggering Billy:', error.response?.data || error.message);
  }
}

triggerBilly();