# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agent Billy is an AI development teammate built with an agent-centric architecture. Billy can monitor GitHub issues, respond with thoughtful AI-generated comments, and is designed to evolve toward full conversational agent workflows.

**Philosophy**: Billy is not a script—he's a teammate. A persistent, stateful, memory-driven entity who happens to write code, open PRs, check tests, and ask questions.

## Agent Architecture

Billy's brain follows biological patterns:

- **👀 Perception** (`/perception`) - How Billy senses the world (GitHub sensors)
- **🤔 Cognition** (`/cognition`) - How Billy thinks (LLM processing, prompts)
- **🔧 Actions** (`/actions`) - How Billy acts in the world (GitHub operations)
- **🧠 Memory** (`/memory`) - How Billy remembers (state, task tracking)
- **💻 Core** (`/core`) - Billy's coordination system (main agent brain)

## Commands

### Setup and Development
- `npm install` - Install dependencies
- `npm run build` - Compile TypeScript to JavaScript
- `npm run billy:init` - Initialize Billy's environment and memory system

### Core Agent Operations
- `npm run billy:check -- -o owner -r repo` - Billy monitors and responds to assigned issues (one-time)
- `npm run billy:watch -- -o owner -r repo` - Billy continuously monitors for assigned issues (autonomous mode)
- `npm run agent -- handle-issue -o owner -r repo -i 123` - Process a specific issue
- `npm run billy:status` - View Billy's current workload, memory state, and statistics

### Code Generation (Legacy)
- `npm run run-codegen -- --task "description"` - Generate code from task description
- `npm run run-codegen -- --issue issue-001` - Generate code from mock issue file

### Testing and Debugging
- Add `--dry-run` flag to any Billy command to test without making actual GitHub changes
- Billy's memory state is stored in `memory/agent-state.json` for debugging

## Key Files and Patterns

### Agent Brain Structure
```
/perception/
├── githubSensor.ts        # Billy's GitHub senses (read issues, comments)

/cognition/
├── llmWrapper.ts          # LLM abstraction layer
└── promptLoader.ts        # Prompt template system

/actions/
├── githubActions.ts       # Billy's GitHub actions (comment, label, create)

/memory/
├── agentMemory.ts         # Billy's memory and state management

/core/
├── agentBilly.ts          # Main agent coordination system
```

### Agent Mental Model
Billy operates in perception→cognition→action cycles:
1. **Perception**: Check for assigned issues via GitHub API
2. **Memory**: Verify not already processed (avoids duplicate work)
3. **Cognition**: Analyze issue through LLM with structured prompts
4. **Action**: Post thoughtful GitHub comment with analysis/questions
5. **Memory**: Record completion and context for future reference

### Critical Integration Points
- **LLM Wrapper** (`cognition/llmWrapper.ts`): Model-agnostic interface supporting Claude/GPT/Ollama
- **GitHub Authentication**: Requires `GITHUB_TOKEN` with `repo`, `issues`, `pull_requests` scopes
- **Prompt System**: Templates in `/prompts` use `{variable}` substitution
- **Memory Persistence**: State stored in `memory/agent-state.json` (gitignored)

## Environment Setup

Required environment variables:
```env
GITHUB_TOKEN=your_github_token_here
```

Optional configuration:
```env
DEFAULT_GITHUB_OWNER=your-org
DEFAULT_GITHUB_REPO=your-repo
AGENT_USERNAME=agent-billy
```

## Development Notes

- TypeScript with strict mode, uses Commander.js for CLI argument parsing
- All agent operations include comprehensive error handling and logging
- Structured interfaces ensure consistent data flow between agent components
- Dry-run mode (`--dry-run` flag) available for safe testing

## Agent Behavior Patterns

### Issue Response Flow
Billy analyzes GitHub issues assigned to him and posts structured comments containing:
1. Friendly acknowledgment of the issue author
2. Technical analysis of requirements and scope
3. Specific clarifying questions when details are unclear
4. Suggested implementation approach
5. Concrete offer to help with next steps

The goal is proactive technical partnership, not just acknowledgment.

## Extension Points

To add new agent capabilities:
1. **Perception**: Add new sensors in `/perception` for different input sources
2. **Cognition**: Create new prompt templates in `/prompts`
3. **Actions**: Add new action handlers in `/actions`
4. **Memory**: Extend memory schema for new task types
5. **Core**: Update main agent loop in `/core/agentBilly.ts`

## Future Evolution

The architecture is designed to evolve from:
- CLI-based GitHub integration → Long-running service
- Issue responder → Full task executor
- GitHub-only → Multi-platform agent
- Script-like → Conversational interface

The mental model remains consistent: Billy is a teammate who senses, thinks, acts, and remembers.