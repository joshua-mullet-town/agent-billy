import axios from 'axios';

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
  private token: string;
  private baseURL = 'https://api.github.com';

  constructor(token?: string) {
    this.token = token || process.env.GITHUB_TOKEN || '';
    if (!this.token) {
      console.warn('⚠️  No GitHub token provided. Some operations may fail.');
    }
  }

  private get headers() {
    return {
      'Authorization': `token ${this.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Agent-Billy/1.0'
    };
  }

  // Billy's primary sense: what issues are assigned to him?
  async getAssignedIssues(owner: string, repo: string, assignee: string = 'agent-billy'): Promise<GitHubIssue[]> {
    try {
      const response = await axios.get(
        `${this.baseURL}/repos/${owner}/${repo}/issues`,
        {
          headers: this.headers,
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
          headers: this.headers,
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
          headers: this.headers
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
          headers: this.headers,
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
}