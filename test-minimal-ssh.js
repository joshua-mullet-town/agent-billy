#!/usr/bin/env node

// Test with ABSOLUTE MINIMAL cloud-config to isolate SSH issue
const axios = require('axios');

const DIGITALOCEAN_TOKEN = process.env.DIGITALOCEAN_TOKEN;

const minimalCloudConfig = `#cloud-config
users:
  - name: ubuntu
    ssh_authorized_keys:
      - ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICOWn4+jHkJv1qZnX++HA26lDCeKzHAP1UFJkMIxjHAl joshuamullet@Joshuas-MacBook-Air.local
    sudo: ALL=(ALL) NOPASSWD:ALL`;

async function testMinimalSSH() {
  try {
    console.log('Creating VM with MINIMAL cloud-config for SSH testing...');
    console.log('Cloud-config:');
    console.log(minimalCloudConfig);
    console.log('');
    
    const response = await axios.post('https://api.digitalocean.com/v2/droplets', {
      name: `minimal-ssh-test-${Date.now()}`,
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
    console.log(`✅ Minimal VM created: ${droplet.id}`);
    
    // Wait for VM to become active
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      const statusResponse = await axios.get(`https://api.digitalocean.com/v2/droplets/${droplet.id}`, {
        headers: {
          'Authorization': `Bearer ${DIGITALOCEAN_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      const vm = statusResponse.data.droplet;
      const publicIp = vm.networks?.v4?.find(n => n.type === 'public')?.ip_address;
      
      console.log(`Status: ${vm.status}, IP: ${publicIp || 'pending'}`);
      
      if (vm.status === 'active' && publicIp) {
        console.log(`🎉 Minimal VM ready! Testing SSH...`);
        console.log(`ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519_digital_ocean ubuntu@${publicIp} "whoami"`);
        return { id: droplet.id, ip: publicIp };
      }
    }
    
    console.log('❌ VM did not become active');
    return null;
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    return null;
  }
}

testMinimalSSH();