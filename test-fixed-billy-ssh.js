#!/usr/bin/env node

// Test Billy's FIXED generateVMSetupScript with minimal cloud-config
const axios = require('axios');

const DIGITALOCEAN_TOKEN = process.env.DIGITALOCEAN_TOKEN;

// Simulate Billy's fixed generateVMSetupScript output
const owner = 'south-bend-code-works';
const repo = 'GiveGrove'; 
const issue = { number: 1119, title: 'Update README.md with setup instructions' };
const playbookPath = 'ansible/test-complete-environment.yml';

const fixedBillyConfig = `#cloud-config
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
  - echo "SSH access ready - Ansible will handle the rest" >> /home/ubuntu/billy-status.log
  - echo "Issue: Update README.md with setup instructions" >> /home/ubuntu/billy-status.log
  - echo "Repository: ${owner}/${repo}" >> /home/ubuntu/billy-status.log
  - echo "Playbook: ${playbookPath}" >> /home/ubuntu/billy-status.log`;

async function testFixedBillySSH() {
  try {
    console.log('🧪 Testing Billy\'s FIXED generateVMSetupScript...');
    console.log('✅ Using minimal cloud-config (no complex write_files)');
    console.log('✅ Should work like VM 508733501 (Ansible approach)');
    console.log('✅ SSH should NOT break with this configuration');
    
    const response = await axios.post('https://api.digitalocean.com/v2/droplets', {
      name: `fixed-billy-${Date.now()}`,
      region: 'nyc3',
      size: 's-1vcpu-1gb',
      image: 'ubuntu-22-04-x64',
      ssh_keys: [],
      user_data: fixedBillyConfig
    }, {
      headers: {
        'Authorization': `Bearer ${DIGITALOCEAN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const droplet = response.data.droplet;
    console.log(`✅ Fixed Billy VM created: ${droplet.id}`);
    
    // Wait for active
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      const statusResponse = await axios.get(`https://api.digitalocean.com/v2/droplets/${droplet.id}`, {
        headers: { 'Authorization': `Bearer ${DIGITALOCEAN_TOKEN}` }
      });
      
      const vm = statusResponse.data.droplet;
      const publicIp = vm.networks?.v4?.find(n => n.type === 'public')?.ip_address;
      
      if (vm.status === 'active' && publicIp) {
        console.log(`🎉 Fixed Billy VM ready at ${publicIp}`);
        console.log(`🔑 SSH TEST: ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519_digital_ocean ubuntu@${publicIp} "whoami"`);
        console.log(`📋 SUCCESS CRITERIA: SSH should return 'ubuntu' (no connection refused)`);
        console.log(`📋 NEXT: If SSH works, Billy's SSH issue is FIXED!`);
        console.log(`📋 THEN: Can move to Phase 2 (Ansible automation)`);
        return { id: droplet.id, ip: publicIp };
      }
    }
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testFixedBillySSH();