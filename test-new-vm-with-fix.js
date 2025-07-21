#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');

const DIGITALOCEAN_TOKEN = process.env.DIGITALOCEAN_TOKEN || 'dop_v1_e809d4939e0992d218da5727dc3f5515aa8';

async function testFixedVM() {
  try {
    console.log('1. Destroying problematic VM 508714109...');
    try {
      await axios.delete('https://api.digitalocean.com/v2/droplets/508714109', {
        headers: {
          'Authorization': `Bearer ${DIGITALOCEAN_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ Old VM destroyed');
    } catch (error) {
      console.log('⚠️ Old VM destroy failed (maybe already gone):', error.response?.status);
    }
    
    console.log('2. Reading fixed cloud-config...');
    const cloudConfig = fs.readFileSync('/Users/joshuamullet/code/agent-billy/test-fixed-cloud-config.yml', 'utf8');
    
    console.log('3. Creating new VM with fixed cloud-config...');
    const response = await axios.post('https://api.digitalocean.com/v2/droplets', {
      name: `billy-fixed-test-${Date.now()}`,
      region: 'nyc3',
      size: 's-1vcpu-1gb',
      image: 'ubuntu-22-04-x64',
      ssh_keys: [],
      user_data: cloudConfig
    }, {
      headers: {
        'Authorization': `Bearer ${DIGITALOCEAN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const droplet = response.data.droplet;
    console.log(`✅ Fixed VM created: ${droplet.id}`);
    console.log(`⏳ Waiting for VM to become active...`);
    
    // Wait for VM to become active
    for (let i = 0; i < 30; i++) {
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
        console.log(`🎉 VM ready!`);
        console.log(`📋 SSH test command:`);
        console.log(`ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519_digital_ocean ubuntu@${publicIp} "whoami && cloud-init status"`);
        console.log(`📋 Cloud-init debug command:`);
        console.log(`ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519_digital_ocean ubuntu@${publicIp} "sudo cat /var/lib/cloud/instances/${droplet.id}/cloud-config.txt"`);
        console.log(`📋 Coordinator log command:`);
        console.log(`ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519_digital_ocean ubuntu@${publicIp} "tail -f /home/ubuntu/coordinator.log"`);
        return { id: droplet.id, ip: publicIp };
      }
    }
    
    console.log('❌ VM did not become active within 5 minutes');
    return null;
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    return null;
  }
}

testFixedVM();