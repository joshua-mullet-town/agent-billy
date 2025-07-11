import axios from 'axios';
import * as jwt from 'jsonwebtoken';

export interface GitHubAppConfig {
  appId: string;
  privateKey: string; // PEM format private key
  installationId?: string; // If known, otherwise will be discovered
}

export class GitHubAppAuth {
  private appId: string;
  private privateKey: string;
  private installationId?: string;
  private installationToken?: string;
  private tokenExpiresAt?: Date;

  constructor(config: GitHubAppConfig) {
    this.appId = config.appId;
    this.privateKey = config.privateKey;
    this.installationId = config.installationId;
  }

  // Generate JWT for app authentication
  private generateJWT(): string {
    const now = Math.floor(Date.now() / 1000);
    
    const payload = {
      iat: now - 60, // Issued at: 60 seconds ago
      exp: now + (10 * 60), // Expires: 10 minutes from now
      iss: this.appId // Issuer: GitHub App ID
    };

    return jwt.sign(payload, this.privateKey, { algorithm: 'RS256' });
  }

  // Get installation ID for a repository
  async getInstallationId(owner: string, repo: string): Promise<string> {
    if (this.installationId) {
      return this.installationId;
    }

    const jwtToken = this.generateJWT();
    
    try {
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/installation`,
        {
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Agent-Billy/1.0'
          }
        }
      );

      this.installationId = response.data.id.toString();
      return this.installationId!;
    } catch (error) {
      throw new Error(`Failed to get installation ID: ${error}`);
    }
  }

  // Get installation access token
  async getInstallationToken(owner: string, repo: string): Promise<string> {
    // Return existing token if still valid
    if (this.installationToken && this.tokenExpiresAt && this.tokenExpiresAt > new Date()) {
      return this.installationToken;
    }

    const installationId = await this.getInstallationId(owner, repo);
    const jwtToken = this.generateJWT();

    try {
      const response = await axios.post(
        `https://api.github.com/app/installations/${installationId}/access_tokens`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Agent-Billy/1.0'
          }
        }
      );

      this.installationToken = response.data.token;
      this.tokenExpiresAt = new Date(response.data.expires_at);
      
      return this.installationToken!;
    } catch (error) {
      throw new Error(`Failed to get installation token: ${error}`);
    }
  }

  // Get headers for API requests
  async getAuthHeaders(owner: string, repo: string): Promise<Record<string, string>> {
    const token = await this.getInstallationToken(owner, repo);
    
    return {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Agent-Billy/1.0'
    };
  }
}