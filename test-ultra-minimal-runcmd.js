#!/usr/bin/env node

// Test with ultra-minimal runcmd section like the working config
const axios = require('axios');

const DIGITALOCEAN_TOKEN = process.env.DIGITALOCEAN_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const vmId = `vm-${Date.now()}-testRepo`;
const issueContext = `Issue #1119: Update README.md with setup instructions`;

const ultraMinimalConfig = `#cloud-config
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

write_files:
  - path: /home/ubuntu/coordinator-workflow.sh
    permissions: '0755'
    content: |
      #!/bin/bash
      VM_ID="${vmId}"
      COORDINATOR_URL="https://agent-billy-production.up.railway.app/coordinator/next-step"
      ISSUE_CONTEXT="${issueContext}"
      source /home/ubuntu/.env
      
      echo "🤖 Billy Coordinator Workflow Started at $(date)" > /home/ubuntu/coordinator.log
      
      while true; do
        echo "Polling coordinator (test mode)..." >> /home/ubuntu/coordinator.log
        sleep 30
      done
  - path: /home/ubuntu/.env
    permissions: '0600'
    content: |
      ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      GITHUB_TOKEN=${GITHUB_TOKEN}`;

async function testUltraMinimalRuncmd() {
  try {
    console.log('🔧 Testing ultra-minimal runcmd section...');
    console.log('✅ Only echo statements in runcmd (like working config)');
    console.log('✅ No chown/chmod/nohup commands');
    
    const response = await axios.post('https://api.digitalocean.com/v2/droplets', {
      name: `ultra-minimal-${Date.now()}`,
      region: 'nyc3',
      size: 's-1vcpu-1gb',
      image: 'ubuntu-22-04-x64',
      ssh_keys: [],
      user_data: ultraMinimalConfig
    }, {
      headers: {
        'Authorization': `Bearer ${DIGITALOCEAN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const droplet = response.data.droplet;
    console.log(`✅ Ultra-minimal VM created: ${droplet.id}`);
    
    // Wait for active
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      const statusResponse = await axios.get(`https://api.digitalocean.com/v2/droplets/${droplet.id}`, {
        headers: { 'Authorization': `Bearer ${DIGITALOCEAN_TOKEN}` }
      });
      
      const vm = statusResponse.data.droplet;
      const publicIp = vm.networks?.v4?.find(n => n.type === 'public')?.ip_address;
      
      if (vm.status === 'active' && publicIp) {
        console.log(`🎉 Ultra-minimal VM ready at ${publicIp}`);
        console.log(`🔑 Test SSH: ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519_digital_ocean ubuntu@${publicIp} "whoami"`);
        return { id: droplet.id, ip: publicIp };
      }
    }
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testUltraMinimalRuncmd();