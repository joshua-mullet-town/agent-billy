# Agent Billy Development TODO

**Source of Truth for Billy's Development Progress**

This tracks the big milestones from current webhook server to fully functional implementation agent. Focus on major chunks that require user involvement, not technical implementation details.

## ✅ Completed

### Phase 1: Basic Billy
- [x] **Billy responds to issues** - Add "for-billy" label → Billy comments with clarification
- [x] **Multi-round conversations** - Billy asks questions until requirements are clear
- [x] **Clean foundation** - Lean codebase with proper documentation
- [x] **Railway deployment** - Billy runs 24/7 as GitHub App webhook server

## ✅ Completed

### Phase 2: Prove Out Implementation Flow
- [x] **Billy declares "ready to implement"** - Billy now says he's ready and executes workflows
- [x] **Create GitHub Action in target repo** - GiveGrove has `.github/workflows/billy.yml`
- [x] **Billy triggers GitHub Action** - Billy can trigger `repository_dispatch` events  
- [x] **End-to-end test** - Full flow: issue → clarification → ready → action triggered
- [x] **SSH Access Problem SOLVED** - After extensive debugging, documented working SSH key approach

## 🔄 In Progress

### Phase 3: VM Development Workflow
- [x] **Billy provisions DigitalOcean VM** - ✅ WORKING - Billy creates VMs with SSH access via cloud-config
- [x] **SSH Access to VMs** - ✅ WORKING - SSH keys embedded in cloud-config, documented in CLAUDE.md
- [ ] **Billy runs target repo's Ansible** - VM gets set up using the repository's playbook  
- [ ] **Claude Code CLI installed** - Verify Claude Code is working on the VM
- [ ] **Playwright MCP integration** - Prove Playwright MCP is connected and functional
- [ ] **Billy codes/tests autonomously** - Watch Billy actually implement/test the feature using Claude Code + Playwright MCP
- [ ] **Billy creates working PR** - PR gets created back to target repo with working code
- [ ] **VM cleanup** - Billy destroys the VM and cleans up resources

## 📋 Next Major Chunks

### Phase 4: Polish & Scale  
- [ ] **Multi-repository support** - Different repos can configure different Billy behaviors
- [ ] **Coming up for air** - After starting to code, have Billy recognize that he has more clarifying questions that he then posts back on the ticket.
- [ ] **Production reliability** - Error handling, monitoring, cost management
- [ ] **Advanced features** - PR review, cross-repo operations, chat interface

## 🎯 Current Focus

**Next Task:** Complete Phase 3 VM Development Environment Setup

**What's Ready:** 
- ✅ Billy VM provisioning with SSH access (cloud-config approach)
- ✅ SSH troubleshooting documented in CLAUDE.md
- ✅ Working test VM: 159.203.123.65
- ✅ Basic cloud-init execution (web server, status logs)

**What We Need To Test:** 
1. **Full Development Environment**: Update cloud-config to install git, ansible, nodejs, npm
2. **Repository Cloning**: Billy clones target repository in VM
3. **Ansible Playbook**: Billy runs `ansible/claude-code-environment.yml` 
4. **Claude Code CLI**: Install and verify Claude Code CLI + Playwright MCP
5. **Autonomous Implementation**: Billy implements "Hello World" README change
6. **PR Creation**: Billy creates working pull request
7. **VM Cleanup**: Billy destroys VM after completion

## 📝 Notes & Discoveries

- **Repository Cleanup:** Went from 80+ files to 17 core files - much easier to understand
- **Documentation System:** Working cadence + living TODO prevents confusion across sessions
- **Stateless Architecture:** Label-based triggering eliminates duplicate processing complexity
- **User Focus:** TODO should track big chunks user cares about, not technical implementation details
- **Phase 2 Implementation:** Billy now reads repository configuration, declares implementation readiness, and triggers GitHub Actions workflows
- **Configuration System:** `.github/billy-config.yml` allows per-repository workflow customization
- **CRITICAL SSH LESSON:** DigitalOcean SSH key management API is unreliable - always embed SSH keys directly in cloud-config `users` section
- **YAML Template Variables:** Template variables with quotes (like issue titles) break YAML parsing - use safe variable content only
- **VM Testing Approach:** Test SSH first, then cloud-init, then full workflow - don't create new VMs unnecessarily
- **Cost Management:** Clean up old VMs after testing to avoid unnecessary DigitalOcean charges

---

**Update Instructions:**
1. Move completed items to "Completed" when big chunks are proven working
2. Focus on what the user needs to do vs. technical details  
3. Update SETUP.md when user-facing deployment steps change
4. Keep "Current Focus" updated with active major chunk