# Agent Billy Development TODO

**Source of Truth for Billy's Development Progress**

This tracks the big milestones from current webhook server to fully functional implementation agent. Focus on major chunks that require user involvement, not technical implementation details.

## ✅ Completed

### Phase 1: Basic Billy
- [x] **Billy responds to issues** - Add "for-billy" label → Billy comments with clarification
- [x] **Multi-round conversations** - Billy asks questions until requirements are clear
- [x] **Clean foundation** - Lean codebase with proper documentation
- [x] **Railway deployment** - Billy runs 24/7 as GitHub App webhook server

## 🔄 In Progress

*Nothing actively in progress*

## 📋 Next Major Chunks

### Phase 2: Prove Out Implementation Flow
- [ ] **Billy declares "ready to implement"** - Get Billy to say he's ready instead of just asking questions
- [ ] **Create GitHub Action in target repo** - YOU: Set up basic GitHub Action that Billy can trigger  
- [ ] **Billy triggers GitHub Action** - Prove Billy can actually invoke the action when ready
- [ ] **End-to-end test** - Full flow: issue → clarification → ready → action triggered

### Phase 3: VM Development Workflow
- [ ] **Billy provisions DigitalOcean VM** - Prove Billy can actually create a VM via API
- [ ] **Billy runs target repo's Ansible** - VM gets set up using the repository's playbook  
- [ ] **Claude Code CLI installed** - Verify Claude Code is working on the VM
- [ ] **Playwright MCP integration** - Prove Playwright MCP is connected and functional
- [ ] **Billy codes/tests autonomously** - Watch Billy actually implement/test the feature using Claude Code + Playwright MCP
- [ ] **Billy creates working PR** - PR gets created back to target repo with working code
- [ ] **VM cleanup** - Billy destroys the VM and cleans up resources

### Phase 4: Polish & Scale  
- [ ] **Multi-repository support** - Different repos can configure different Billy behaviors
- [ ] **Coming up for air** - After starting to code, have Billy recognize that he has more clarifying questions that he then posts back on the ticket.
- [ ] **Production reliability** - Error handling, monitoring, cost management
- [ ] **Advanced features** - PR review, cross-repo operations, chat interface

## 🎯 Current Focus

**Next Big Chunk:** Phase 2 - Prove Out Implementation Flow

**Why:** We've never actually seen Billy declare he's ready to implement or trigger any action. We need to prove the full flow works before building complex features.

**What This Means:** 
- Billy needs to stop just asking questions and sometimes say "I'm ready"
- We need a real GitHub Action in a target repo for Billy to trigger
- We need to see the complete flow working end-to-end

## 📝 Notes & Discoveries

- **Repository Cleanup:** Went from 80+ files to 17 core files - much easier to understand
- **Documentation System:** Working cadence + living TODO prevents confusion across sessions
- **Stateless Architecture:** Label-based triggering eliminates duplicate processing complexity
- **User Focus:** TODO should track big chunks user cares about, not technical implementation details

---

**Update Instructions:**
1. Move completed items to "Completed" when big chunks are proven working
2. Focus on what the user needs to do vs. technical details  
3. Update SETUP.md when user-facing deployment steps change
4. Keep "Current Focus" updated with active major chunk