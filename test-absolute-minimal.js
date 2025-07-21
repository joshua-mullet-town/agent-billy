#!/usr/bin/env node

// Test the ABSOLUTE minimal config that matches working VM 508727139
const axios = require('axios');

const DIGITALOCEAN_TOKEN = process.env.DIGITALOCEAN_TOKEN;

const absoluteMinimalConfig = `#cloud-config
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
      echo "Simple test script"
      while true; do
        echo "Test loop" >> /home/ubuntu/test.log
        sleep 30
      done`;

async function testAbsoluteMinimal() {
  try {
    console.log('🧪 Testing ABSOLUTE minimal config matching working VM 508727139...');
    console.log('✅ Same packages, same runcmd, minimal write_files');
    console.log('✅ If this fails, issue is in Billy\'s specific write_files content');
    
    const response = await axios.post('https://api.digitalocean.com/v2/droplets', {
      name: `absolute-minimal-${Date.now()}`,
      region: 'nyc3',
      size: 's-1vcpu-1gb',
      image: 'ubuntu-22-04-x64',
      ssh_keys: [],
      user_data: absoluteMinimalConfig
    }, {
      headers: {
        'Authorization': `Bearer ${DIGITALOCEAN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const droplet = response.data.droplet;
    console.log(`✅ Absolute minimal VM created: ${droplet.id}`);
    
    // Wait for active
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      const statusResponse = await axios.get(`https://api.digitalocean.com/v2/droplets/${droplet.id}`, {
        headers: { 'Authorization': `Bearer ${DIGITALOCEAN_TOKEN}` }
      });
      
      const vm = statusResponse.data.droplet;
      const publicIp = vm.networks?.v4?.find(n => n.type === 'public')?.ip_address;
      
      if (vm.status === 'active' && publicIp) {
        console.log(`🎉 Absolute minimal VM ready at ${publicIp}`);
        console.log(`🔑 CRITICAL TEST: ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519_digital_ocean ubuntu@${publicIp} "whoami"`);
        console.log(`📋 If this works, issue is in Billy's write_files content`);
        console.log(`📋 If this fails, issue is deeper - possibly packages or other element`);
        return { id: droplet.id, ip: publicIp };
      }
    }
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testAbsoluteMinimal();