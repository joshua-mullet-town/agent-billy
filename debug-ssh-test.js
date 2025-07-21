#!/usr/bin/env node

// Test VM creation with minimal cloud-config to verify SSH works
const axios = require('axios');

const DIGITALOCEAN_TOKEN = process.env.DIGITALOCEAN_TOKEN || 'dop_v1_e809d4939e0992d218da5727dc3f5515aa8';

const minimalCloudConfig = `#cloud-config
users:
  - name: ubuntu
    ssh_authorized_keys:
      - ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICOWn4+jHkJv1qZnX++HA26lDCeKzHAP1UFJkMIxjHAl joshuamullet@Joshuas-MacBook-Air.local
    sudo: ALL=(ALL) NOPASSWD:ALL

packages:
  - git
  - curl

runcmd:
  - echo "MINIMAL TEST: SSH-only cloud-config at $(date)" > /home/ubuntu/test.log
  - echo "Cloud-init completed successfully" >> /home/ubuntu/test.log`;

async function createTestVM() {
  try {
    console.log('Creating minimal test VM to verify SSH access...');
    
    const response = await axios.post('https://api.digitalocean.com/v2/droplets', {
      name: `billy-ssh-test-${Date.now()}`,
      region: 'nyc3',
      size: 's-1vcpu-1gb',
      image: 'ubuntu-22-04-x64',
      ssh_keys: [],
      user_data: minimalCloudConfig
    }, {
      headers: {
        'Authorization': `Bearer ${DIGITALOCEAN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const droplet = response.data.droplet;
    console.log(`✅ Test VM created: ${droplet.id}`);
    console.log(`⏳ Waiting for VM to become active...`);
    
    // Wait for VM to become active
    let vm = null;
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      
      const statusResponse = await axios.get(`https://api.digitalocean.com/v2/droplets/${droplet.id}`, {
        headers: {
          'Authorization': `Bearer ${DIGITALOCEAN_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      vm = statusResponse.data.droplet;
      const publicIp = vm.networks?.v4?.find(n => n.type === 'public')?.ip_address;
      
      console.log(`Status: ${vm.status}, IP: ${publicIp || 'pending'}`);
      
      if (vm.status === 'active' && publicIp) {
        console.log(`🎉 VM ready! SSH test command:`);
        console.log(`ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519_digital_ocean ubuntu@${publicIp} "cat /home/ubuntu/test.log"`);
        return { id: vm.id, ip: publicIp };
      }
    }
    
    console.log('❌ VM did not become active within 5 minutes');
    return null;
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    return null;
  }
}

createTestVM();