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

## 🏗️ Stateless Webhook Architecture

Billy is now a lean, stateless webhook server:

```
🎣 Agent Billy (Webhook Server)
├── 🎣 server/statelessWebhook.ts - Event processing & routing
├── 👀 perception/githubSensor.ts - GitHub API reading
├── 🤔 cognition/
│   ├── llmWrapper.ts - LLM abstraction layer
│   └── promptLoader.ts - Prompt management
├── 🔧 actions/githubActions.ts - GitHub API operations
├── 🔐 auth/githubApp.ts - GitHub App authentication
└── 📝 prompts/ - Clarification & analysis templates
```

### Current Capabilities

✅ **Real-time Webhooks** - Billy responds to "for-billy" labels instantly  
✅ **Multi-round Clarification** - Stakeholder conversations until requirements are clear  
✅ **Configurable Implementation** - VM development, GitHub Actions, simple responses, or custom workflows  
✅ **Full Development Pipeline** - VM provisioning → Claude Code + Playwright → Pull requests  
✅ **Multi-repository Support** - Each repo configures its own Billy workflow  
✅ **Stateless Design** - No memory persistence, scales horizontally  

---

## 🚀 Getting Started

### 1. Deploy Billy as GitHub App

Billy operates as a stateless webhook server deployed on Railway:

```bash
npm install
npm run build
npm run start  # Starts webhook server on port 3000
```

### 2. GitHub App Setup

Create a GitHub App with these permissions:
- Issues: Read & Write
- Pull requests: Read & Write  
- Repository contents: Read & Write

Configure webhook URL: `https://your-railway-app.railway.app/webhook`

### 3. Environment Configuration

```env
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
GITHUB_APP_INSTALLATION_ID=12345678
GITHUB_WEBHOOK_SECRET=your_webhook_secret
```

### 4. Using Billy

1. Add "for-billy" label to any GitHub issue
2. Billy responds within seconds with clarification or implementation

---

## 💬 How Billy Works

### Real-time Webhook Implementation Flow

1. **🎣 Label Trigger**: Add "for-billy" label to GitHub issue
2. **🤔 Analysis**: Billy analyzes issue + all previous comments via LLM
3. **❓ Clarification**: If unclear, Billy posts numbered questions for stakeholder
4. **🔄 Multi-round**: Stakeholder answers → Billy re-analyzes → more questions if needed
5. **🚀 Implementation**: When clear, Billy executes repository-configured workflow:
   - `vm_development`: Provision VM → Ansible setup → Claude Code + Playwright → PR
   - `github_actions`: Trigger repository's GitHub Actions workflow
   - `simple_comment`: Post implementation comment only
   - `custom`: Call repository's custom webhook endpoint
6. **📋 Results**: Billy creates pull requests and updates issue status

**See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed workflow configuration.**

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

## 🛠️ Usage

### 🎯 Current: Webhook-Based (Recommended)

Billy runs as a 24/7 webhook server, responding instantly to GitHub events:

```bash
# Deploy Billy as GitHub App webhook server
npm run start
```

**To use Billy:**
1. Add "for-billy" label to any GitHub issue
2. Billy responds within seconds with clarification or implementation

### 📁 Repository Configuration

Add to your repository:

```yaml
# .github/billy-config.yml
billy:
  workflow_type: "vm_development"  # or "github_actions", "simple_comment", "custom"
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for all workflow options.


---

## 🔧 Configuration

### GitHub App Environment Variables

```env
# Required for GitHub App authentication
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
GITHUB_APP_INSTALLATION_ID=12345678

# Optional but recommended
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# Optional for LLM and VM features  
ANTHROPIC_API_KEY=your_anthropic_key
DIGITALOCEAN_TOKEN=your_do_token
```

### LLM Backend

Billy supports multiple LLM providers:
- **Anthropic Claude** (default)
- **OpenAI GPT**
- **Ollama** (local models)

Configure in `cognition/llmWrapper.ts`.

---

## 📋 Status

### Current: Stateless Webhook Agent ✅
- ✅ Real-time webhook processing via GitHub App
- ✅ Multi-round clarification conversations  
- ✅ Configurable implementation workflows (4 types)
- ✅ Label-based triggering ("for-billy" label)
- ✅ Stateless design (no persistent memory)
- ✅ Railway deployment ready

### In Development
- 🔄 VM orchestration implementation (`vm_development` workflow)
- 🔄 Repository configuration system (`.github/billy-config.yml`)
- 🔄 Enhanced error handling and webhook reliability

### Future
- 💬 Direct chat interface integration
- 🔄 Cross-repository operations  
- 🎯 Advanced debugging and code review workflows

---

## 🏗️ Repository Structure

```
/agent-billy
├── 🎣 /server              # Webhook server
│   └── statelessWebhook.ts # Main webhook processing
├── 👀 /perception          # GitHub sensing
│   └── githubSensor.ts     # GitHub API operations
├── 🤔 /cognition           # LLM processing
│   ├── llmWrapper.ts       # LLM abstraction layer
│   └── promptLoader.ts     # Prompt management
├── 🔧 /actions             # GitHub actions
│   └── githubActions.ts    # GitHub API operations
├── 🔐 /auth                # Authentication
│   └── githubApp.ts        # GitHub App JWT tokens
├── 📜 /prompts             # LLM prompts
│   ├── issueAnalysis.md    # Issue analysis
│   └── clarificationCheckGiveGrove.md # Clarification logic
├── 🛠️ /utils               # Utilities
│   └── fileIO.ts           # File operations
├── 📋 package.json         # Dependencies & scripts
├── 🐳 Dockerfile           # Railway deployment
└── 📚 Documentation        # Setup & architecture guides
    ├── README.md           # This file
    ├── ARCHITECTURE.md     # Workflow details
    ├── CLAUDE.md           # Development guide
    ├── SETUP.md            # Complete deployment guide
    └── TODO.md             # Living development roadmap
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