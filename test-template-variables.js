#!/usr/bin/env node

// Test if template variables with problematic content break SSH
const axios = require('axios');

const DIGITALOCEAN_TOKEN = process.env.DIGITALOCEAN_TOKEN;

// Simulate Billy's problematic template variables
const vmId = `vm-${Date.now()}-testRepo`;
const issueContext = `Issue #1119: Fix: Add "quotes" and special chars that break YAML`;
const anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';
const githubToken = process.env.GITHUB_TOKEN || '';

const configWithTemplateVars = `#cloud-config
users:
  - name: ubuntu
    ssh_authorized_keys:
      - ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICOWn4+jHkJv1qZnX++HA26lDCeKzHAP1UFJkMIxjHAl joshuamullet@Joshuas-MacBook-Air.local
    sudo: ALL=(ALL) NOPASSWD:ALL

packages:
  - curl
  - wget
  - git
  - jq
  - nodejs
  - npm

runcmd:
  - echo "Billy VM created at $(date)" > /home/ubuntu/billy-status.log
  - echo "SSH access ready" >> /home/ubuntu/billy-status.log
  - echo "Installing Node.js and tools..." >> /home/ubuntu/billy-status.log
  - curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  - sudo apt-get install -y nodejs
  - echo "Setting up coordinator workflow..." >> /home/ubuntu/billy-status.log
  - chown ubuntu:ubuntu /home/ubuntu/coordinator-workflow.sh
  - chmod +x /home/ubuntu/coordinator-workflow.sh
  - echo "Starting coordinator workflow..." >> /home/ubuntu/billy-status.log
  - sudo -u ubuntu nohup /home/ubuntu/coordinator-workflow.sh > /home/ubuntu/coordinator.log 2>&1 &
  - echo "Coordinator workflow started" >> /home/ubuntu/billy-status.log

write_files:
  - path: /home/ubuntu/coordinator-workflow.sh
    permissions: '0755'
    content: |
      #!/bin/bash
      # Billy's Coordinator Workflow - Polls coordinator for step-by-step guidance
      
      VM_ID="${vmId}"
      COORDINATOR_URL="https://agent-billy-production.up.railway.app/coordinator/next-step"
      ISSUE_CONTEXT="${issueContext}"
      ANTHROPIC_API_KEY="${anthropicApiKey}"
      GITHUB_TOKEN="${githubToken}"
      
      echo "Coordinator workflow started at $(date)" >> /home/ubuntu/coordinator.log
      
      while true; do
        echo "Polling coordinator..." >> /home/ubuntu/coordinator.log
        sleep 30
      done`;

async function testTemplateVariables() {
  try {
    console.log('Testing if template variables break SSH...');
    console.log('Issue context:', issueContext);
    console.log('VM ID:', vmId);
    console.log('API Key length:', anthropicApiKey.length);
    console.log('GitHub Token length:', githubToken.length);
    
    const response = await axios.post('https://api.digitalocean.com/v2/droplets', {
      name: `ssh-template-test-${Date.now()}`,
      region: 'nyc3',
      size: 's-1vcpu-1gb',
      image: 'ubuntu-22-04-x64',
      ssh_keys: [],
      user_data: configWithTemplateVars
    }, {
      headers: {
        'Authorization': `Bearer ${DIGITALOCEAN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const droplet = response.data.droplet;
    console.log(`✅ VM with template variables created: ${droplet.id}`);
    
    // Wait for active
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      const statusResponse = await axios.get(`https://api.digitalocean.com/v2/droplets/${droplet.id}`, {
        headers: { 'Authorization': `Bearer ${DIGITALOCEAN_TOKEN}` }
      });
      
      const vm = statusResponse.data.droplet;
      const publicIp = vm.networks?.v4?.find(n => n.type === 'public')?.ip_address;
      
      if (vm.status === 'active' && publicIp) {
        console.log(`🎉 VM ready at ${publicIp}`);
        console.log(`Test SSH: ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519_digital_ocean ubuntu@${publicIp} "whoami"`);
        return { id: droplet.id, ip: publicIp };
      }
    }
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testTemplateVariables();