import { FileIOUtils } from '../utils/fileIO';
import * as path from 'path';

export interface TaskMemory {
  id: string;
  type: 'issue_comment' | 'code_generation' | 'pr_review';
  issueNumber?: number;
  repoFullName?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  context: Record<string, any>;
  actions: Array<{
    type: string;
    timestamp: string;
    details: Record<string, any>;
  }>;
}

export interface ProcessedIssue {
  issueNumber: number;
  repoFullName: string;
  processedAt: string;
  status: 'responded' | 'acknowledged' | 'skipped' | 'awaiting_clarification' | 'clarification_received' | 'development_completed';
  commentId?: number;
  commentUrl?: string;
  clarificationRequest?: {
    requestedAt: string;
    questions: string;
    originalAssignee?: string;
    lastCheckedForResponse?: string;
  };
}

export interface AgentState {
  lastActiveAt: string;
  processedIssues: ProcessedIssue[];
  currentTasks: TaskMemory[];
  completedTasks: TaskMemory[];
  stats: {
    totalIssuesProcessed: number;
    totalCommentsPosted: number;
    totalCyclesRun: number;
    lastCycleAt?: string;
  };
  config: {
    defaultRepo?: string;
    assigneeUsername: string;
    maxConcurrentTasks: number;
  };
}

export class AgentMemory {
  private memoryDir: string;
  private statePath: string;

  constructor() {
    this.memoryDir = path.join(process.cwd(), 'memory');
    this.statePath = path.join(this.memoryDir, 'agent-state.json');
  }

  // Billy remembers his current state
  async getState(): Promise<AgentState> {
    try {
      await FileIOUtils.ensureDir(this.memoryDir);
      
      if (await FileIOUtils.fileExists(this.statePath)) {
        const stateData = await FileIOUtils.readFile(this.statePath);
        const parsedState = JSON.parse(stateData);
        
        // Validate and migrate state if necessary
        if (parsedState && typeof parsedState === 'object') {
          // Ensure all required fields exist
          return {
            lastActiveAt: parsedState.lastActiveAt || new Date().toISOString(),
            processedIssues: parsedState.processedIssues || [],
            currentTasks: parsedState.currentTasks || [],
            completedTasks: parsedState.completedTasks || [],
            stats: parsedState.stats || {
              totalIssuesProcessed: 0,
              totalCommentsPosted: 0,
              totalCyclesRun: 0
            },
            config: parsedState.config || {
              assigneeUsername: 'agent-billy',
              maxConcurrentTasks: 3
            }
          };
        }
      }
      
      // Initialize fresh state
      const defaultState: AgentState = {
        lastActiveAt: new Date().toISOString(),
        processedIssues: [],
        currentTasks: [],
        completedTasks: [],
        stats: {
          totalIssuesProcessed: 0,
          totalCommentsPosted: 0,
          totalCyclesRun: 0
        },
        config: {
          assigneeUsername: 'agent-billy',
          maxConcurrentTasks: 3
        }
      };
      
      await this.saveState(defaultState);
      return defaultState;
    } catch (error) {
      console.error('Failed to load agent state:', error instanceof Error ? error.message : String(error));
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  // Billy updates his state
  async saveState(state: AgentState): Promise<void> {
    try {
      state.lastActiveAt = new Date().toISOString();
      await FileIOUtils.writeFile(this.statePath, JSON.stringify(state, null, 2));
    } catch (error) {
      console.error('Failed to save agent state:', error instanceof Error ? error.message : String(error));
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  // Billy remembers if he's already processed an issue
  async hasProcessedIssue(issueNumber: number, repoFullName?: string): Promise<boolean> {
    const state = await this.getState();
    return state.processedIssues.some(processed => 
      processed.issueNumber === issueNumber && 
      (!repoFullName || processed.repoFullName === repoFullName)
    );
  }

  // Billy marks an issue as processed with detailed tracking
  async markIssueProcessed(
    issueNumber: number, 
    repoFullName: string, 
    status: 'responded' | 'acknowledged' | 'skipped' | 'awaiting_clarification' | 'clarification_received' | 'development_completed',
    commentId?: number,
    commentUrl?: string,
    clarificationRequest?: {
      questions: string;
      originalAssignee?: string;
    }
  ): Promise<void> {
    const state = await this.getState();
    
    // Find existing entry for this issue
    const existingIndex = state.processedIssues.findIndex(
      p => p.issueNumber === issueNumber && p.repoFullName === repoFullName
    );
    
    const processedIssue: ProcessedIssue = {
      issueNumber,
      repoFullName,
      processedAt: new Date().toISOString(),
      status,
      commentId,
      commentUrl
    };

    // Handle clarification request data
    if (status === 'awaiting_clarification' && clarificationRequest) {
      processedIssue.clarificationRequest = {
        requestedAt: new Date().toISOString(),
        questions: clarificationRequest.questions,
        originalAssignee: clarificationRequest.originalAssignee
      };
    } else if (existingIndex >= 0 && state.processedIssues[existingIndex].clarificationRequest) {
      // Preserve existing clarification request data
      processedIssue.clarificationRequest = {
        ...state.processedIssues[existingIndex].clarificationRequest,
        lastCheckedForResponse: new Date().toISOString()
      };
    }
    
    // Update or add the processed issue record
    if (existingIndex >= 0) {
      state.processedIssues[existingIndex] = processedIssue;
    } else {
      state.processedIssues.push(processedIssue);
    }

    // Update stats
    if (existingIndex < 0) {
      state.stats.totalIssuesProcessed++;
    }
    if (status === 'responded' && commentId) {
      state.stats.totalCommentsPosted++;
    }

    await this.saveState(state);
  }

  // Billy records a processing cycle
  async recordCycle(): Promise<void> {
    const state = await this.getState();
    state.stats.totalCyclesRun++;
    state.stats.lastCycleAt = new Date().toISOString();
    await this.saveState(state);
  }

  // Billy gets his processing history for a repo
  async getProcessedIssuesForRepo(repoFullName: string): Promise<ProcessedIssue[]> {
    const state = await this.getState();
    return state.processedIssues.filter(p => p.repoFullName === repoFullName);
  }

  // Billy gets issues awaiting clarification
  async getIssuesAwaitingClarification(repoFullName?: string): Promise<ProcessedIssue[]> {
    const state = await this.getState();
    return state.processedIssues.filter(p => 
      p.status === 'awaiting_clarification' &&
      (!repoFullName || p.repoFullName === repoFullName)
    );
  }

  // Billy gets a specific processed issue
  async getProcessedIssue(issueNumber: number, repoFullName: string): Promise<ProcessedIssue | null> {
    const state = await this.getState();
    return state.processedIssues.find(p => 
      p.issueNumber === issueNumber && p.repoFullName === repoFullName
    ) || null;
  }

  // Billy starts a new task
  async startTask(task: Omit<TaskMemory, 'id' | 'startedAt' | 'actions'>): Promise<string> {
    const state = await this.getState();
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newTask: TaskMemory = {
      ...task,
      id: taskId,
      startedAt: new Date().toISOString(),
      actions: []
    };
    
    state.currentTasks.push(newTask);
    await this.saveState(state);
    
    console.log(`🧠 Billy started task: ${taskId}`);
    return taskId;
  }

  // Billy completes a task
  async completeTask(taskId: string, status: 'completed' | 'failed'): Promise<void> {
    const state = await this.getState();
    const taskIndex = state.currentTasks.findIndex(t => t.id === taskId);
    
    if (taskIndex !== -1) {
      const task = state.currentTasks[taskIndex];
      task.status = status;
      task.completedAt = new Date().toISOString();
      
      // Move to completed tasks
      state.completedTasks.push(task);
      state.currentTasks.splice(taskIndex, 1);
      
      await this.saveState(state);
      console.log(`🧠 Billy ${status} task: ${taskId}`);
    }
  }

  // Billy logs an action for a task
  async logTaskAction(taskId: string, actionType: string, details: Record<string, any>): Promise<void> {
    const state = await this.getState();
    const task = state.currentTasks.find(t => t.id === taskId);
    
    if (task) {
      task.actions.push({
        type: actionType,
        timestamp: new Date().toISOString(),
        details
      });
      await this.saveState(state);
    }
  }

  // Billy gets his current workload
  async getCurrentTasks(): Promise<TaskMemory[]> {
    const state = await this.getState();
    return state.currentTasks;
  }

  // Billy checks if he can take on more work
  async canTakeNewTask(): Promise<boolean> {
    const state = await this.getState();
    return state.currentTasks.length < state.config.maxConcurrentTasks;
  }
}