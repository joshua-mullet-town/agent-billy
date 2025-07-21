#!/usr/bin/env node

const axios = require('axios');

const DIGITALOCEAN_TOKEN = process.env.DIGITALOCEAN_TOKEN || 'dop_v1_e809d4939e0992d218da5727dc3f5515aa8';

async function cleanup() {
  try {
    await axios.delete('https://api.digitalocean.com/v2/droplets/508718765', {
      headers: {
        'Authorization': `Bearer ${DIGITALOCEAN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Test VM 508718765 cleaned up');
  } catch (error) {
    console.log('❌ Cleanup failed:', error.response?.data || error.message);
  }
}

cleanup();