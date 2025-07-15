import axios from 'axios';

export interface VMConfig {
  name: string;
  region: string;
  size: string;
  image: string;
  sshKeys: string[];
  userData?: string;
}

export interface VM {
  id: number;
  name: string;
  status: string;
  publicIp?: string;
  privateIp?: string;
}

export class VMOrchestrator {
  private token: string;
  private baseURL: string;

  constructor() {
    this.baseURL = 'https://api.digitalocean.com/v2';
    this.token = process.env.DIGITALOCEAN_TOKEN || '';
    
    if (!this.token) {
      throw new Error('DIGITALOCEAN_TOKEN environment variable is required');
    }
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };
  }

  // Create a new VM
  async createVM(config: VMConfig): Promise<VM> {
    try {
      console.log(`🖥️ Creating VM: ${config.name}`);
      console.log(`🔧 Cloud-config userData:`, config.userData);
      
      const response = await axios.post(`${this.baseURL}/droplets`, {
        name: config.name,
        region: config.region,
        size: config.size,
        image: config.image,
        ssh_keys: config.sshKeys,
        user_data: config.userData,
        monitoring: true,
        tags: ['agent-billy', 'development']
      }, { headers: this.getHeaders() });

      const droplet = response.data.droplet;
      console.log(`✅ VM created with ID: ${droplet.id}`);
      
      return {
        id: droplet.id,
        name: droplet.name,
        status: droplet.status,
        publicIp: droplet.networks?.v4?.find((n: any) => n.type === 'public')?.ip_address,
        privateIp: droplet.networks?.v4?.find((n: any) => n.type === 'private')?.ip_address
      };
    } catch (error: any) {
      console.error('❌ Failed to create VM:', error);
      console.error('❌ DigitalOcean API Response:', error?.response?.data);
      console.error('❌ VM Config used:', config);
      throw new Error(`VM creation failed: ${error}`);
    }
  }

  // Wait for VM to be ready
  async waitForVM(vmId: number, timeoutMinutes: number = 5): Promise<VM> {
    const timeoutMs = timeoutMinutes * 60 * 1000;
    const startTime = Date.now();
    
    console.log(`⏳ Waiting for VM ${vmId} to be ready...`);
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await axios.get(`${this.baseURL}/droplets/${vmId}`, { headers: this.getHeaders() });
        const droplet = response.data.droplet;
        
        const vm: VM = {
          id: droplet.id,
          name: droplet.name,
          status: droplet.status,
          publicIp: droplet.networks?.v4?.find((n: any) => n.type === 'public')?.ip_address,
          privateIp: droplet.networks?.v4?.find((n: any) => n.type === 'private')?.ip_address
        };
        
        console.log(`📊 VM ${vmId} status: ${vm.status}, IP: ${vm.publicIp || 'pending'}`);
        
        if (vm.status === 'active' && vm.publicIp) {
          console.log(`✅ VM ${vmId} is ready at ${vm.publicIp}`);
          return vm;
        }
        
        await this.sleep(10000); // Wait 10 seconds
      } catch (error) {
        console.error(`❌ Error checking VM status: ${error}`);
        await this.sleep(5000);
      }
    }
    
    throw new Error(`VM ${vmId} did not become ready within ${timeoutMinutes} minutes`);
  }

  // List all VMs
  async listVMs(): Promise<VM[]> {
    try {
      const response = await axios.get(`${this.baseURL}/droplets`, { headers: this.getHeaders() });
      return response.data.droplets.map((droplet: any) => ({
        id: droplet.id,
        name: droplet.name,
        status: droplet.status,
        publicIp: droplet.networks?.v4?.find((n: any) => n.type === 'public')?.ip_address,
        privateIp: droplet.networks?.v4?.find((n: any) => n.type === 'private')?.ip_address
      }));
    } catch (error) {
      console.error('❌ Failed to list VMs:', error);
      return [];
    }
  }

  // Destroy VM
  async destroyVM(vmId: number): Promise<boolean> {
    try {
      console.log(`🗑️ Destroying VM ${vmId}`);
      await axios.delete(`${this.baseURL}/droplets/${vmId}`, { headers: this.getHeaders() });
      console.log(`✅ VM ${vmId} destroyed`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to destroy VM ${vmId}:`, error);
      return false;
    }
  }

  // Destroy old VMs by IP (keeping only the current working one)
  async destroyOldVMs(keepIP: string): Promise<void> {
    try {
      const vms = await this.listVMs();
      console.log(`📋 Found ${vms.length} VMs total`);
      
      const vmsToDestroy = vms.filter(vm => 
        vm.publicIp !== keepIP && 
        vm.name.includes('billy-') && 
        vm.status !== 'archive'
      );
      
      console.log(`🗑️ Destroying ${vmsToDestroy.length} old VMs (keeping ${keepIP})`);
      
      for (const vm of vmsToDestroy) {
        console.log(`🗑️ Destroying VM ${vm.id} (${vm.name}) - IP: ${vm.publicIp}`);
        await this.destroyVM(vm.id);
        await this.sleep(2000); // Wait 2 seconds between deletions
      }
      
      console.log(`✅ VM cleanup complete - kept ${keepIP}`);
    } catch (error) {
      console.error('❌ Failed to destroy old VMs:', error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}