import axios from 'axios';
import { GitHubAppAuth, GitHubAppConfig } from '../auth/githubApp';

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  labels: Array<{ name: string }>;
  assignees: Array<{ login: string }>;
  assignee?: { login: string };
  state: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  html_url: string;
  user: { login: string };
}

export interface GitHubComment {
  id: number;
  body: string;
  user: { login: string };
  created_at: string;
  html_url: string;
}

export class GitHubSensor {
  private token?: string;
  private githubApp?: GitHubAppAuth;
  private baseURL = 'https://api.github.com';

  constructor(token?: string, githubAppConfig?: GitHubAppConfig) {
    this.token = token || process.env.GITHUB_TOKEN;
    
    // Initialize GitHub App if config provided
    if (githubAppConfig) {
      this.githubApp = new GitHubAppAuth(githubAppConfig);
    } else if (process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY) {
      this.githubApp = new GitHubAppAuth({
        appId: process.env.GITHUB_APP_ID,
        privateKey: process.env.GITHUB_APP_PRIVATE_KEY,
        installationId: process.env.GITHUB_APP_INSTALLATION_ID
      });
    }

    if (!this.token && !this.githubApp) {
      console.warn('⚠️  No GitHub authentication provided. Some operations may fail.');
    }
  }

  private async getHeaders(owner?: string, repo?: string): Promise<Record<string, string>> {
    // Prefer GitHub App authentication if available
    if (this.githubApp && owner && repo) {
      return await this.githubApp.getAuthHeaders(owner, repo);
    }
    
    // Fallback to personal token
    if (this.token) {
      return {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Agent-Billy/1.0'
      };
    }

    throw new Error('No GitHub authentication available');
  }

  // Billy's new primary sense: what issues are labeled for him?
  async getLabeledIssues(owner: string, repo: string, label: string = 'for-billy'): Promise<GitHubIssue[]> {
    try {
      const response = await axios.get(
        `${this.baseURL}/repos/${owner}/${repo}/issues`,
        {
          headers: await this.getHeaders(owner, repo),
          params: {
            labels: label,
            state: 'open',
            sort: 'updated',
            direction: 'desc',
            per_page: 100
          }
        }
      );
      
      // Filter out pull requests (GitHub API returns both issues and PRs)
      const issues = response.data.filter((item: any) => !item.pull_request);
      
      console.log(`👀 Found ${issues.length} issue(s) labeled '${label}' in ${owner}/${repo}`);
      return issues;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          console.error(`❌ Repository ${owner}/${repo} not found or not accessible`);
        } else if (error.response?.status === 403) {
          console.error(`❌ GitHub API rate limit exceeded or insufficient permissions`);
        } else {
          console.error(`❌ GitHub API error (${error.response?.status}):`, error.response?.data?.message || error.message);
        }
      } else {
        console.error('❌ Failed to fetch labeled issues:', error instanceof Error ? error.message : String(error));
      }
      return [];
    }
  }

  // Billy's legacy sense: what issues are assigned to him? (kept for backward compatibility)
  async getAssignedIssues(owner: string, repo: string, assignee: string = 'agent-billy'): Promise<GitHubIssue[]> {
    try {
      const response = await axios.get(
        `${this.baseURL}/repos/${owner}/${repo}/issues`,
        {
          headers: await this.getHeaders(owner, repo),
          params: {
            assignee,
            state: 'open',
            sort: 'updated',
            direction: 'desc',
            per_page: 100 // Get more issues per request
          }
        }
      );
      
      // Filter out pull requests (GitHub API returns both issues and PRs)
      const issues = response.data.filter((item: any) => !item.pull_request);
      
      console.log(`👀 Found ${issues.length} assigned issue(s) in ${owner}/${repo}`);
      return issues;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          console.error(`❌ Repository ${owner}/${repo} not found or not accessible`);
        } else if (error.response?.status === 403) {
          console.error(`❌ GitHub API rate limit exceeded or insufficient permissions`);
        } else {
          console.error(`❌ GitHub API error (${error.response?.status}):`, error.response?.data?.message || error.message);
        }
      } else {
        console.error('❌ Failed to fetch assigned issues:', error instanceof Error ? error.message : String(error));
      }
      return [];
    }
  }

  // Billy checks what's been said about an issue
  async getIssueComments(owner: string, repo: string, issueNumber: number): Promise<GitHubComment[]> {
    try {
      const response = await axios.get(
        `${this.baseURL}/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
        {
          headers: await this.getHeaders(owner, repo),
          params: {
            per_page: 100,
            sort: 'created',
            direction: 'asc'
          }
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`❌ Failed to fetch comments for issue #${issueNumber} (${error.response?.status}):`, 
          error.response?.data?.message || error.message);
      } else {
        console.error(`❌ Failed to fetch comments for issue #${issueNumber}:`, error instanceof Error ? error.message : String(error));
      }
      return [];
    }
  }

  // Billy checks if he has already commented on an issue
  async hasAlreadyCommented(owner: string, repo: string, issueNumber: number, agentUsername: string = 'agent-billy'): Promise<boolean> {
    const comments = await this.getIssueComments(owner, repo, issueNumber);
    return comments.some(comment => comment.user.login === agentUsername);
  }

  // Billy reads a specific issue
  async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue | null> {
    try {
      const response = await axios.get(
        `${this.baseURL}/repos/${owner}/${repo}/issues/${issueNumber}`,
        {
          headers: await this.getHeaders(owner, repo)
        }
      );
      
      // Make sure it's actually an issue, not a PR
      if (response.data.pull_request) {
        console.log(`⚠️  Issue #${issueNumber} is actually a pull request, skipping`);
        return null;
      }
      
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`❌ Failed to fetch issue #${issueNumber} (${error.response?.status}):`, 
          error.response?.data?.message || error.message);
      } else {
        console.error(`❌ Failed to fetch issue #${issueNumber}:`, error instanceof Error ? error.message : String(error));
      }
      return null;
    }
  }

  // Billy checks what repos he has access to
  async getAccessibleRepos(): Promise<Array<{ full_name: string; owner: { login: string }; name: string }>> {
    try {
      const response = await axios.get(
        `${this.baseURL}/user/repos`,
        {
          headers: await this.getHeaders(),
          params: {
            sort: 'updated',
            per_page: 100
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to fetch accessible repos:', error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  // Billy reads file content from a repository
  async getFileContent(owner: string, repo: string, path: string): Promise<string | null> {
    try {
      const response = await axios.get(
        `${this.baseURL}/repos/${owner}/${repo}/contents/${path}`,
        {
          headers: await this.getHeaders(owner, repo)
        }
      );

      // GitHub API returns base64 encoded content
      if (response.data.content && response.data.encoding === 'base64') {
        return Buffer.from(response.data.content, 'base64').toString('utf-8');
      }

      return response.data.content || null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          console.log(`📄 File ${path} not found in ${owner}/${repo}`);
        } else {
          console.error(`❌ Failed to fetch file ${path} from ${owner}/${repo} (${error.response?.status}):`, 
            error.response?.data?.message || error.message);
        }
      } else {
        console.error(`❌ Failed to fetch file ${path}:`, error instanceof Error ? error.message : String(error));
      }
      return null;
    }
  }
}