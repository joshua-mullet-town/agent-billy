import axios from 'axios';

export interface CommentPayload {
  body: string;
}

export interface CommentResponse {
  id: number;
  html_url: string;
  created_at: string;
}

export class GitHubActions {
  private token: string;
  private baseURL = 'https://api.github.com';

  constructor(token?: string) {
    this.token = token || process.env.GITHUB_TOKEN || '';
    if (!this.token || this.token === 'placeholder') {
      console.warn('⚠️  No valid GitHub token provided. Actions will be disabled.');
    }
  }

  private get headers() {
    return {
      'Authorization': `token ${this.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Agent-Billy/1.0',
      'Content-Type': 'application/json'
    };
  }

  // Billy's primary action: comment on issues
  async commentOnIssue(
    owner: string, 
    repo: string, 
    issueNumber: number, 
    comment: string
  ): Promise<CommentResponse | null> {
    try {
      const response = await axios.post(
        `${this.baseURL}/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
        { body: comment },
        { headers: this.headers }
      );
      
      console.log(`✅ Billy commented on issue #${issueNumber}`);
      return {
        id: response.data.id,
        html_url: response.data.html_url,
        created_at: response.data.created_at
      };
    } catch (error) {
      console.error(`❌ Failed to comment on issue #${issueNumber}:`, error);
      return null;
    }
  }

  // Billy can update issue labels
  async updateIssueLabels(
    owner: string,
    repo: string,
    issueNumber: number,
    labels: string[]
  ): Promise<boolean> {
    try {
      await axios.put(
        `${this.baseURL}/repos/${owner}/${repo}/issues/${issueNumber}/labels`,
        { labels },
        { headers: this.headers }
      );
      
      console.log(`✅ Billy updated labels on issue #${issueNumber}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to update labels on issue #${issueNumber}:`, error);
      return false;
    }
  }

  // Billy can assign/unassign issues
  async assignIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    assignees: string[]
  ): Promise<boolean> {
    try {
      await axios.post(
        `${this.baseURL}/repos/${owner}/${repo}/issues/${issueNumber}/assignees`,
        { assignees },
        { headers: this.headers }
      );
      
      console.log(`✅ Billy assigned issue #${issueNumber} to: ${assignees.join(', ')}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to assign issue #${issueNumber}:`, error);
      return false;
    }
  }

  // Billy can reassign issues to a specific user
  async reassignIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    fromUser: string,
    toUser: string
  ): Promise<boolean> {
    try {
      // First remove current assignee
      await axios.delete(
        `${this.baseURL}/repos/${owner}/${repo}/issues/${issueNumber}/assignees`,
        { 
          headers: this.headers,
          data: { assignees: [fromUser] }
        }
      );

      // Then assign to new user
      return await this.assignIssue(owner, repo, issueNumber, [toUser]);
    } catch (error) {
      console.error(`❌ Failed to reassign issue #${issueNumber} from ${fromUser} to ${toUser}:`, error);
      return false;
    }
  }

  // Billy can add labels to issues
  async addLabel(
    owner: string,
    repo: string,
    issueNumber: number,
    label: string
  ): Promise<boolean> {
    try {
      await axios.post(
        `${this.baseURL}/repos/${owner}/${repo}/issues/${issueNumber}/labels`,
        { labels: [label] },
        { headers: this.headers }
      );
      
      console.log(`✅ Billy added label "${label}" to issue #${issueNumber}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to add label "${label}" to issue #${issueNumber}:`, error);
      return false;
    }
  }

  // Billy can remove labels from issues
  async removeLabel(
    owner: string,
    repo: string,
    issueNumber: number,
    label: string
  ): Promise<boolean> {
    try {
      await axios.delete(
        `${this.baseURL}/repos/${owner}/${repo}/issues/${issueNumber}/labels/${encodeURIComponent(label)}`,
        { headers: this.headers }
      );
      
      console.log(`✅ Billy removed label "${label}" from issue #${issueNumber}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to remove label "${label}" from issue #${issueNumber}:`, error);
      return false;
    }
  }

  // Billy can create issues (for follow-up tasks)
  async createIssue(
    owner: string,
    repo: string,
    title: string,
    body: string,
    labels?: string[],
    assignees?: string[]
  ): Promise<{ number: number; html_url: string } | null> {
    try {
      const response = await axios.post(
        `${this.baseURL}/repos/${owner}/${repo}/issues`,
        {
          title,
          body,
          labels: labels || [],
          assignees: assignees || []
        },
        { headers: this.headers }
      );
      
      console.log(`✅ Billy created issue #${response.data.number}`);
      return {
        number: response.data.number,
        html_url: response.data.html_url
      };
    } catch (error) {
      console.error('❌ Failed to create issue:', error);
      return null;
    }
  }
}