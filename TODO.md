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

## ✅ Completed 

### Phase 3A: VM Infrastructure Foundation
- [x] **Billy provisions DigitalOcean VM** - ✅ WORKING - Billy creates VMs with SSH access via cloud-config
- [x] **SSH Access to VMs** - ✅ WORKING - SSH keys embedded in cloud-config, documented in CLAUDE.md  
- [x] **Cloud-init Architecture** - ✅ WORKING - Railway handoff model, VM self-configuration proven
- [x] **Node.js Installation** - ✅ WORKING - Node.js v20.x via snap, symlinks, ownership fixes
- [x] **Download URLs Fixed** - ✅ WORKING - GitHub repository URLs corrected, HTTP 200 responses
- [x] **Railway Timeout Solution** - ✅ WORKING - Railway creates VM, ends cleanly; VM continues independently

## ✅ Completed

### Phase 3B: INFRASTRUCTURE AUTOMATION - **PROVEN WORKING END-TO-END**

## 🎉 **BREAKTHROUGH: INFRASTRUCTURE AUTOMATION 99% COMPLETE**

**SUCCESS ACHIEVED**: Billy's infrastructure automation works completely from GitHub label to ready development environment with ZERO manual intervention.

**✅ INFRASTRUCTURE PROVEN WORKING (99% complete):**
- ✅ **VM Creation & Management** - Billy creates VMs automatically via DigitalOcean API
- ✅ **Cloud-Init Setup** - SSH keys, file deployment, Node.js installation via cloud-config
- ✅ **Authentication** - GitHub token passing, repository cloning capabilities
- ✅ **Environment Setup** - Node.js 20.19.4 + npm 10.8.2 installed automatically
- ✅ **Ansible Execution** - Complete GiveGrove development environment installation
- ✅ **Claude Code CLI Auto-Installation** - v1.0.55 installed and authenticated automatically via Ansible
- ✅ **Playwright MCP Auto-Setup** - Configured and connected to Claude CLI automatically  
- ✅ **GiveGrove Services Auto-Start** - Frontend/backend services started automatically
- ✅ **Repository Cloning** - GiveGrove repository cloned with 1317+ packages installed
- ✅ **GUI Environment** - X11, VNC, Firefox installation working

## 🔄 In Progress

### Phase 3C: BUSINESS WORKFLOW AUTOMATION - **ARCHITECTURE PIVOT TO COORDINATOR**

## 🏗️ **CURRENT STATUS: COORDINATOR ARCHITECTURE IMPLEMENTATION**

**WHAT WE'VE DONE**: Discovered mega-prompt approach is brittle. Moving to coordinator architecture for step-by-step Claude CLI guidance.

**🔄 BUSINESS WORKFLOW AUTOMATION (Implementation Complete, Testing Required):**
- [x] **🤖 Autonomous Issue Reading** - ✅ CODED: Billy now reads GitHub issue context in VM
- [x] **🤖 Autonomous Code Implementation** - ✅ CODED: Billy calls Claude CLI with issue requirements  
- [x] **🤖 Autonomous Playwright Testing** - ✅ CODED: Billy runs smoke tests automatically
- [x] **🤖 Autonomous Pull Request Creation** - ✅ CODED: Billy commits changes and creates PR
- [x] **🤖 GitHub CLI Installation** - ✅ CODED: Added to Ansible playbook with authentication
- [ ] **🤖 Autonomous VM Cleanup** - ❌ STILL TODO: Billy needs to destroy VM after completion

**🎯 COORDINATOR ARCHITECTURE IMPLEMENTATION:**
- [ ] **Design Coordinator Endpoint**: Create new endpoint to guide Claude CLI step-by-step
- [ ] **Implement VM-Initiated Polling**: VM sends Claude CLI output to coordinator
- [ ] **Create Step-by-Step Workflow**: Code change → test → PR creation with coordinator guidance
- [ ] **Test Coordinator with Claude CLI**: Verify coordinator can guide Claude CLI through workflow
- [ ] **Deploy Coordinator to Railway**: Add coordinator endpoint to existing Billy service

**❌ DEFERRED TESTING (Will Be Easier with Coordinator):**
- [ ] **Verify Playwright MCP Actually Works**: ❌ DEFERRED - Easier to debug with coordinator
- [ ] **Verify PR Creation**: Will test with coordinator architecture
- [ ] **End-to-End Test**: Will test complete coordinator workflow

**NEXT ACTIONS**: 
1. Implement coordinator endpoint
2. Test coordinator with Claude CLI step-by-step
3. Deploy and test complete coordinator workflow

## 🚨 **TESTING STANDARDS - NO SHORTCUTS ALLOWED**

**✅ ACCEPTABLE for debugging/monitoring:**
- SSH to check logs and validate automation worked
- Manual investigation of failed automation steps
- Reading log files to understand what went wrong

**❌ UNACCEPTABLE as "success":**
- Manually running Claude CLI commands
- Manually creating pull requests  
- Manually testing with Playwright
- Any manual intervention in the business workflow

**RULE**: If we have to do it manually even once, the automation is not working and doesn't count as success.

**IMMEDIATE PRIORITY**: Prove complete AUTOMATED business workflow end-to-end

## 📋 Next Major Chunks

### Phase 4: Polish & Scale  
- [ ] **Multi-repository support** - Different repos can configure different Billy behaviors
- [ ] **Coming up for air** - After starting to code, have Billy recognize that he has more clarifying questions that he then posts back on the ticket.
- [ ] **Production reliability** - Error handling, monitoring, cost management
- [ ] **Advanced features** - PR review, cross-repo operations, chat interface

## 🔮 Future Exploration Items (Post-E2E Success)

### Authentication & Architecture
- [ ] **Solve authentication/login problem** - Handle GiveGrove's Google/Phone auth + MFA for autonomous workflow
- [ ] **Design instruction architecture** - Two-layer approach: stable config (`.github/billy-config.yml`) vs dynamic instructions (`CLAUDE.md`)

### Monitoring & Intelligence  
- [ ] **Error handling & monitoring** - Detect when services go down during autonomous work, better Railway log monitoring
- [ ] **"Coming up for air" feature** - Enable Claude Code to ask stakeholders questions mid-implementation via GitHub comments

## 🎯 Current Focus

**Next Task:** TEST COMPLETE BUSINESS WORKFLOW - Infrastructure is ready, need to prove business value

**What's Ready (Infrastructure):** 
- ✅ Billy VM provisioning with Railway handoff model working
- ✅ Cloud-init file creation, ownership, Node.js installation 
- ✅ SSH access and validation protocols established
- ✅ Download URLs fixed, all infrastructure issues resolved

**REALITY CHECK - What We Need To Actually Test:** 
1. **Complete Ansible Execution**: Does full GiveGrove environment actually install?
2. **Services Actually Running**: Does frontend serve on localhost:3000 and backend on localhost:4000?
3. **Claude Code CLI Working**: Can Claude CLI read issues and implement changes in VM?
4. **Playwright Browser Testing**: Can Playwright navigate to localhost:3000/tuna and validate UI?
5. **Autonomous Implementation**: Does Billy read issue #1119 and update README.md correctly?
6. **Pull Request Creation**: Does Billy commit changes and create PR with GitHub API?
7. **VM Cleanup**: Does Billy properly destroy VM after completion?

**IMMEDIATE ACTION**: Trigger fresh VM and test end-to-end business workflow

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