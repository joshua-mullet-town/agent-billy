#!/usr/bin/env node

const axios = require('axios');
const DIGITALOCEAN_TOKEN = process.env.DIGITALOCEAN_TOKEN;

(async () => {
  try {
    const response = await axios.get('https://api.digitalocean.com/v2/droplets', {
      headers: { 'Authorization': `Bearer ${DIGITALOCEAN_TOKEN}` }
    });
    
    const testVMs = response.data.droplets.filter(d => 
      d.name.includes('test') || 
      d.name.includes('ssh') || 
      d.name.includes('billy') ||
      d.name.includes('minimal') ||
      d.name.includes('ultra')
    );
    
    // Keep only the known working minimal config VM
    const toDelete = testVMs.filter(d => d.id !== 508727139);
    
    console.log(`Deleting ${toDelete.length} test VMs...`);
    
    for (const vm of toDelete) {
      await axios.delete(`https://api.digitalocean.com/v2/droplets/${vm.id}`, {
        headers: { 'Authorization': `Bearer ${DIGITALOCEAN_TOKEN}` }
      });
      console.log(`✅ Deleted ${vm.id}: ${vm.name}`);
    }
    
    console.log('🧹 VM cleanup complete');
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
})();