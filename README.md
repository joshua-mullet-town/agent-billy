# Agent Billy 🤖

**Your AI Development Teammate**

Agent Billy is a dev agent for Mullet Town. Right now, he can monitor assigned issues and respond with helpful AI-generated comments. This is the scaffolding for future full-agent workflows.

---

## 🧠 Philosophy: "One Interface Theory"

The endgame is simple: **A conversational-first, agent-centered developer experience.**

Agent Billy is not a script. He is a **teammate** - a persistent, stateful, memory-driven entity who happens to write code, open PRs, check tests, and ask questions.

**Future UX looks like this:**
> "Hey Billy, check PR #42."
> 
> → Billy reviews it, spots issues, asks clarifying questions, runs checks, and suggests changes—all inside a conversation-first workspace.

**But Today:** The world still runs on GitHub issues, pull requests, CI/CD pipelines, and local scripts. This project is about building scaffolding for that world—a bridge to the conversational agent world.

---

## 🏗️ Agent Architecture

Billy's brain is organized like a real teammate:

```
🧠 Agent Billy's Brain
├── 👀 Perception     # How Billy senses the world
│   └── githubSensor.ts - Reads issues, PRs, comments
├── 🤔 Cognition      # How Billy thinks
│   ├── llmWrapper.ts - LLM abstraction layer
│   └── promptLoader.ts - Prompt management
├── 🔧 Actions        # How Billy acts in the world
│   └── githubActions.ts - Comments, labels, PRs
├── 🧠 Memory         # How Billy remembers
│   └── agentMemory.ts - Task tracking, state
└── 💻 Core           # Billy's coordination system
    └── agentBilly.ts - Main agent brain
```

### Current Capabilities

✅ **Issue Monitoring** - Billy checks for assigned issues  
✅ **Intelligent Responses** - AI-generated comments and analysis  
✅ **Memory System** - Tracks what he's done and current workload  
✅ **GitHub Integration** - Native GitHub API operations  
✅ **LLM Agnostic** - Works with Claude, GPT, or Ollama  

---

## 🚀 Getting Started

### 1. Setup

```bash
npm install
cp .env.example .env
# Edit .env with your GitHub token
npm run billy:init
```

### 2. Give Billy a GitHub Token

Create a GitHub Personal Access Token at https://github.com/settings/tokens

Required scopes: `repo`, `issues`, `pull_requests`

```env
GITHUB_TOKEN=your_token_here
```

### 3. Let Billy Check for Work

```bash
# Billy checks for assigned issues in a specific repo
npm run billy:check -- -o owner -r repo-name

# Billy handles a specific issue
npm run agent -- handle-issue -o owner -r repo -i 42

# Check Billy's current status
npm run billy:status
```

---

## 💬 How Billy Works

### Current Workflow: "Billy as Issue Responder"

1. **👀 Perception**: Billy checks for issues assigned to him
2. **🧠 Memory**: "Have I seen this issue before?"
3. **🤔 Cognition**: Billy analyzes the issue with LLM
4. **💬 Action**: Billy posts a thoughtful comment asking clarifying questions
5. **📝 Memory**: Billy remembers he processed this issue

### Example Billy Response

When assigned to an issue titled "Add dark mode toggle", Billy might respond:

> Hi @user! 👋
> 
> Thanks for opening this issue. I understand you're looking to add a dark mode toggle feature.
> 
> ## My Analysis
> This will require:
> - A toggle component in the UI
> - Theme state management (React Context or similar)
> - CSS variable updates for dark/light themes
> - Persistence in localStorage
> 
> ## Questions for Clarification
> - Should this be a global toggle in the header, or per-page?
> - Do you have existing design tokens/CSS variables for theming?
> - Any specific color palette preferences for dark mode?
> 
> ## Next Steps
> I can help with:
> - Creating the toggle component
> - Setting up the theme context
> - Writing the CSS for dark mode styles
> 
> Let me know your thoughts on this approach, and I'll get started on the implementation!
> 
> Best,  
> Agent Billy 🤖

---

## 🛠️ Commands

### Core Agent Commands

```bash
# Initialize Billy's environment
npm run billy:init

# Billy checks for assigned issues (one-time)
npm run billy:check -- -o owner -r repo

# Billy watches continuously for assigned issues (AUTONOMOUS MODE)
npm run billy:watch -- -o owner -r repo

# Billy handles a specific issue
npm run agent -- handle-issue -o owner -r repo -i 123

# Check Billy's status and workload
npm run billy:status

# Dry run (no actual changes) - works with any command
npm run billy:watch -- -o owner -r repo --dry-run
```

### 🔄 **NEW: Autonomous Operation**

Billy can now run continuously, monitoring for assigned issues:

```bash
# Start Billy's autonomous watch loop
npm run billy:watch -- -o myorg -r myrepo

# Custom polling interval (default 60s)
npm run billy:watch -- -o myorg -r myrepo --interval 30

# Run once and exit (no continuous polling)
npm run billy:watch -- -o myorg -r myrepo --once
```

### Legacy Development Commands

```bash
# Legacy code generation (still works)
npm run run-codegen -- --task "Create a Button component"
npm run run-codegen -- --issue issue-001
```

---

## 🔧 Configuration

### Environment Variables

```env
# Required
GITHUB_TOKEN=your_token_here

# Optional
DEFAULT_GITHUB_OWNER=your-org
DEFAULT_GITHUB_REPO=your-repo
AGENT_USERNAME=agent-billy
```

### LLM Backend

Billy works with multiple LLM providers:

- **Anthropic Claude** (default)
- **OpenAI GPT**
- **Ollama** (local models)

Configure in `cognition/llmWrapper.ts` or via environment variables.

---

## 📋 Roadmap

### Current Milestone: Autonomous Issue Responder ✅
- ✅ Monitor assigned GitHub issues
- ✅ Generate thoughtful AI responses
- ✅ Memory and state management
- ✅ GitHub API integration
- ✅ **Autonomous polling loop with configurable intervals**
- ✅ **Comprehensive logging and error handling**
- ✅ **Duplicate detection and prevention**

### Next Milestones

**🔄 Task Executor**
- Code generation from issue descriptions
- Automatic PR creation
- Test generation and validation

**🤖 Full Agent Workflows**
- Multi-step task execution
- Cross-repo operations
- CI/CD integration

**💬 Conversational Interface**
- Chat-based agent interaction
- Natural language task assignment
- Real-time collaboration

---

## 🏗️ Repository Structure

```
/agent-billy
├── 👀 /perception          # Billy's senses
│   └── githubSensor.ts     # Reads GitHub state
├── 🤔 /cognition           # Billy's thinking
│   ├── llmWrapper.ts       # LLM abstraction
│   └── promptLoader.ts     # Prompt management
├── 🔧 /actions             # Billy's actions
│   └── githubActions.ts    # GitHub operations
├── 🧠 /memory              # Billy's memory
│   └── agentMemory.ts      # State management
├── 💻 /core                # Billy's brain
│   └── agentBilly.ts       # Main coordinator
├── 📜 /prompts             # Billy's instructions
│   ├── issueAnalysis.md    # Issue analysis prompt
│   └── codeWriterPrompt.md # Code generation prompt
├── 🎮 /scripts             # Entry points
│   └── run-agent.ts        # Main agent runner
└── 📁 /legacy              # Original structure
    ├── /agents             # Legacy agent patterns
    ├── /utils              # Shared utilities
    └── /output             # Generated artifacts
```

---

## 🎯 Design Principles

### 1. Agent Mental Models Over Dumb Scripts
> Billy checks his tasks, updates his status, responds, asks questions.
> Even if under the hood it's polling the GitHub API, the mental frame is: "The agent checks the repo." Not "The repo pushes events."

### 2. Task-Oriented, Not Script-Oriented
> Instead of `run-codegen.ts`, think `agentHandleTask.ts` with tasks like `analyzeIssue()`, `writeComment()`, `generateCode()`

### 3. Forward-Expandable Where Trivial
> Bias toward designs that could become persistent-agent systems, but do not overbuild.

### 4. GitHub is the Interface for Now
> Today, Billy lives inside GitHub. Long-term, GitHub is just one of Billy's senses.

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/billy-enhancement`)
3. Commit your changes (`git commit -m 'Add amazing Billy feature'`)
4. Push to the branch (`git push origin feature/billy-enhancement`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Remember:** You are not building a script. You are scaffolding a dev teammate. 🤖✨