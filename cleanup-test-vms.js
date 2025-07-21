#!/usr/bin/env node

const axios = require('axios');

const DIGITALOCEAN_TOKEN = process.env.DIGITALOCEAN_TOKEN || 'dop_v1_e809d4939e0992d218da5727dc3f5515aa8';

async function cleanup() {
  const vmsToClean = ['508719324', '508718765']; // The test VMs I created
  
  for (const vmId of vmsToClean) {
    try {
      await axios.delete(`https://api.digitalocean.com/v2/droplets/${vmId}`, {
        headers: {
          'Authorization': `Bearer ${DIGITALOCEAN_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      console.log(`✅ Cleaned up VM ${vmId}`);
    } catch (error) {
      console.log(`⚠️ VM ${vmId} cleanup failed:`, error.response?.status || error.message);
    }
  }
}

cleanup();