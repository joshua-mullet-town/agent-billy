#!/usr/bin/env node

// Quick script to get VM 508714109 IP address
const axios = require('axios');

const DIGITALOCEAN_TOKEN = process.env.DIGITALOCEAN_TOKEN || 'dop_v1_e809d4939e0992d218da5727dc3f5515aa8';
const VM_ID = '508714109';

async function getVMInfo() {
  try {
    const response = await axios.get(`https://api.digitalocean.com/v2/droplets/${VM_ID}`, {
      headers: {
        'Authorization': `Bearer ${DIGITALOCEAN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const droplet = response.data.droplet;
    const publicIp = droplet.networks?.v4?.find(n => n.type === 'public')?.ip_address;
    
    console.log(`VM ${VM_ID} Status: ${droplet.status}`);
    console.log(`VM ${VM_ID} Public IP: ${publicIp}`);
    console.log(`VM ${VM_ID} Name: ${droplet.name}`);
    console.log(`VM ${VM_ID} Created: ${droplet.created_at}`);
    
    // Check if we can access the cloud-config that was sent
    if (publicIp) {
      console.log(`\nTo debug cloud-config, run:`);
      console.log(`ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -i ~/.ssh/id_ed25519_digital_ocean ubuntu@${publicIp} "sudo cat /var/lib/cloud/instances/${VM_ID}/cloud-config.txt || echo 'No cloud-config found'"`);
      console.log(`ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -i ~/.ssh/id_ed25519_digital_ocean ubuntu@${publicIp} "cloud-init status --long || echo 'Cloud-init status check failed'"`);
    }
    
    return publicIp;
  } catch (error) {
    console.error('Error getting VM info:', error.response?.data || error.message);
    return null;
  }
}

getVMInfo();