import { GitHubSensor } from '../perception/githubSensor';

export interface BillyConfig {
  billy: {
    workflow_type: 'github_actions' | 'vm_development' | 'simple_comment' | 'custom';
    github_actions?: {
      workflow_file: string;
    };
    vm_development?: {
      vm_size: string;
      ansible_playbook: string;
    };
    project?: {
      name: string;
      description: string;
      tech_stack: string[];
      key_directories: string[];
    };
  };
}

export class ConfigReader {
  private sensor: GitHubSensor;

  constructor() {
    this.sensor = new GitHubSensor();
  }

  /**
   * Read Billy configuration from target repository
   */
  async readRepositoryConfig(owner: string, repo: string): Promise<BillyConfig | null> {
    try {
      console.log(`📋 Reading Billy configuration from ${owner}/${repo}`);
      
      const configContent = await this.sensor.getFileContent(owner, repo, '.github/billy-config.yml');
      
      if (!configContent) {
        console.log(`⚠️  No .github/billy-config.yml found in ${owner}/${repo} - using defaults`);
        return this.getDefaultConfig();
      }

      // Parse YAML content (simple parsing for now)
      const config = this.parseYamlConfig(configContent);
      console.log(`✅ Billy configuration loaded for ${owner}/${repo}:`, config);
      
      return config;
    } catch (error) {
      console.error(`❌ Error reading Billy configuration from ${owner}/${repo}:`, error);
      return this.getDefaultConfig();
    }
  }

  /**
   * Get default configuration when no config file exists
   */
  private getDefaultConfig(): BillyConfig {
    return {
      billy: {
        workflow_type: 'simple_comment',
        project: {
          name: 'Unknown Project',
          description: 'No configuration found',
          tech_stack: [],
          key_directories: []
        }
      }
    };
  }

  /**
   * Simple YAML parser for Billy configuration
   * Note: This is a basic implementation - would use proper YAML library in production
   */
  private parseYamlConfig(yamlContent: string): BillyConfig {
    // For now, implement basic parsing
    // In production, would use js-yaml or similar library
    
    const config: BillyConfig = {
      billy: {
        workflow_type: 'simple_comment'
      }
    };

    const lines = yamlContent.split('\n');
    let currentSection = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || !trimmed) continue;

      if (trimmed.includes('workflow_type:')) {
        const value = trimmed.split(':')[1]?.trim().replace(/['"]/g, '');
        if (value === 'github_actions' || value === 'vm_development' || value === 'simple_comment' || value === 'custom') {
          config.billy.workflow_type = value;
        }
      }

      if (trimmed.includes('workflow_file:')) {
        const value = trimmed.split(':')[1]?.trim().replace(/['"]/g, '');
        if (value) {
          config.billy.github_actions = { workflow_file: value };
        }
      }

      if (trimmed.includes('vm_size:')) {
        const value = trimmed.split(':')[1]?.trim().replace(/['"]/g, '');
        if (value) {
          if (!config.billy.vm_development) config.billy.vm_development = { vm_size: '', ansible_playbook: '' };
          config.billy.vm_development.vm_size = value;
        }
      }

      if (trimmed.includes('ansible_playbook:')) {
        const value = trimmed.split(':')[1]?.trim().replace(/['"]/g, '');
        if (value) {
          if (!config.billy.vm_development) config.billy.vm_development = { vm_size: '', ansible_playbook: '' };
          config.billy.vm_development.ansible_playbook = value;
        }
      }
    }

    return config;
  }
}