#!/usr/bin/env node

// Test minimal cloud-config + Ansible approach (Billy's proven pattern)
const axios = require('axios');

const DIGITALOCEAN_TOKEN = process.env.DIGITALOCEAN_TOKEN;

// Minimal cloud-config that only does basic setup, then hands off to Ansible
const minimalCloudConfig = `#cloud-config
users:
  - name: ubuntu
    ssh_authorized_keys:
      - ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICOWn4+jHkJv1qZnX++HA26lDCeKzHAP1UFJkMIxjHAl joshuamullet@Joshuas-MacBook-Air.local
    sudo: ALL=(ALL) NOPASSWD:ALL

packages:
  - curl
  - wget
  - git
  - python3
  - python3-pip

runcmd:
  - echo "Billy VM created at $(date)" > /home/ubuntu/billy-status.log
  - echo "SSH access ready" >> /home/ubuntu/billy-status.log
  - echo "Cloud-init complete - ready for Ansible" >> /home/ubuntu/billy-status.log`;

async function testMinimalAnsibleApproach() {
  try {
    console.log('🧪 Testing MINIMAL cloud-config + Ansible approach...');
    console.log('✅ Based on test-complete-environment.yml pattern');
    console.log('✅ Minimal cloud-config: users, packages, basic runcmd only');
    console.log('✅ Complex automation: Handled by Ansible playbook (not cloud-init)');
    
    const response = await axios.post('https://api.digitalocean.com/v2/droplets', {
      name: `minimal-ansible-${Date.now()}`,
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
    console.log(`✅ Minimal Ansible VM created: ${droplet.id}`);
    
    // Wait for active
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      const statusResponse = await axios.get(`https://api.digitalocean.com/v2/droplets/${droplet.id}`, {
        headers: { 'Authorization': `Bearer ${DIGITALOCEAN_TOKEN}` }
      });
      
      const vm = statusResponse.data.droplet;
      const publicIp = vm.networks?.v4?.find(n => n.type === 'public')?.ip_address;
      
      if (vm.status === 'active' && publicIp) {
        console.log(`🎉 Minimal Ansible VM ready at ${publicIp}`);
        console.log(`🔑 SSH TEST: ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519_digital_ocean ubuntu@${publicIp} "whoami"`);
        console.log(`📋 EXPECTED: SSH should work (minimal cloud-config)`);
        console.log(`📋 NEXT: If SSH works, this proves Ansible approach is viable`);
        console.log(`📋 THEN: Update Billy's generateVMSetupScript() to use this pattern`);
        return { id: droplet.id, ip: publicIp };
      }
    }
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testMinimalAnsibleApproach();