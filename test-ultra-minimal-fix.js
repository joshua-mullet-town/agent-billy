#!/usr/bin/env node

// Test Billy's ultra-minimal runcmd fix
const axios = require('axios');

const DIGITALOCEAN_TOKEN = process.env.DIGITALOCEAN_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Use Billy's exact ultra-minimal configuration
const vmId = `vm-${Date.now()}-testRepo`;
const issueContext = `Issue #1119: ${`Update README.md with setup instructions`.replace(/['"]/g, '')}`;

const ultraMinimalBillyConfig = `#cloud-config
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
  - nohup sudo -u ubuntu /home/ubuntu/post-boot-setup.sh > /home/ubuntu/setup.log 2>&1 &

write_files:
  - path: /home/ubuntu/coordinator-workflow.sh
    permissions: '0755'
    content: |
      #!/bin/bash
      # Billy's Coordinator Workflow - Self-contained setup and polling
      
      VM_ID="${vmId}"
      COORDINATOR_URL="https://agent-billy-production.up.railway.app/coordinator/next-step"
      ISSUE_CONTEXT="${issueContext}"
      
      # Load API keys from environment file
      source /home/ubuntu/.env
      
      echo "🤖 Billy Coordinator Workflow Started at $(date)" > /home/ubuntu/coordinator.log
      echo "VM ID: $VM_ID" >> /home/ubuntu/coordinator.log
      echo "Issue: $ISSUE_CONTEXT" >> /home/ubuntu/coordinator.log
      echo "Coordinator: $COORDINATOR_URL" >> /home/ubuntu/coordinator.log
      
      # Wait for Node.js installation to complete
      echo "⏳ Waiting for Node.js installation..." >> /home/ubuntu/coordinator.log
      while ! command -v node &> /dev/null; do
        sleep 10
      done
      
      echo "✅ Node.js ready, starting coordinator polling..." >> /home/ubuntu/coordinator.log
      
      # Simplified coordinator polling loop for testing
      while true; do
        echo "🔄 Polling coordinator (test mode)..." >> /home/ubuntu/coordinator.log
        sleep 30
      done
  - path: /home/ubuntu/.env
    permissions: '0600'
    content: |
      ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      GITHUB_TOKEN=${GITHUB_TOKEN}
  - path: /home/ubuntu/post-boot-setup.sh
    permissions: '0755'
    content: |
      #!/bin/bash
      # Post-boot setup script - runs after SSH is established
      
      echo "🔧 Starting post-boot setup at $(date)" > /home/ubuntu/setup.log
      
      # Install Node.js (moved from runcmd to avoid cloud-init failures)
      echo "📦 Installing Node.js..." >> /home/ubuntu/setup.log
      curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - >> /home/ubuntu/setup.log 2>&1
      sudo apt-get install -y nodejs >> /home/ubuntu/setup.log 2>&1
      
      # Wait for Node.js installation to complete
      echo "✅ Node.js installation complete" >> /home/ubuntu/setup.log
      
      # Start coordinator workflow directly
      echo "🚀 Starting coordinator workflow..." >> /home/ubuntu/setup.log
      nohup /home/ubuntu/coordinator-workflow.sh > /home/ubuntu/coordinator.log 2>&1 &
      
      echo "✅ Post-boot setup complete at $(date)" >> /home/ubuntu/setup.log`;

async function testUltraMinimalFix() {
  try {
    console.log('🔧 Testing Billy\'s ultra-minimal runcmd fix...');
    console.log('✅ Ultra-minimal runcmd: only echo statements + nohup startup');
    console.log('✅ All complex setup moved to post-boot script');
    console.log('Issue context:', issueContext);
    console.log('VM ID:', vmId);
    
    const response = await axios.post('https://api.digitalocean.com/v2/droplets', {
      name: `billy-ultra-minimal-${Date.now()}`,
      region: 'nyc3',
      size: 's-1vcpu-1gb',
      image: 'ubuntu-22-04-x64',
      ssh_keys: [],
      user_data: ultraMinimalBillyConfig
    }, {
      headers: {
        'Authorization': `Bearer ${DIGITALOCEAN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const droplet = response.data.droplet;
    console.log(`✅ Billy's ultra-minimal VM created: ${droplet.id}`);
    
    // Wait for active
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      const statusResponse = await axios.get(`https://api.digitalocean.com/v2/droplets/${droplet.id}`, {
        headers: { 'Authorization': `Bearer ${DIGITALOCEAN_TOKEN}` }
      });
      
      const vm = statusResponse.data.droplet;
      const publicIp = vm.networks?.v4?.find(n => n.type === 'public')?.ip_address;
      
      if (vm.status === 'active' && publicIp) {
        console.log(`🎉 Billy's ultra-minimal VM ready at ${publicIp}`);
        console.log(`🔑 Test SSH: ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519_digital_ocean ubuntu@${publicIp} "whoami"`);
        console.log(`📋 Check setup: ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519_digital_ocean ubuntu@${publicIp} "cat /home/ubuntu/setup.log"`);
        console.log(`🤖 Check coordinator: ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519_digital_ocean ubuntu@${publicIp} "cat /home/ubuntu/coordinator.log"`);
        return { id: droplet.id, ip: publicIp };
      }
    }
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testUltraMinimalFix();