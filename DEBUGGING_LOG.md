# Billy VM Development Workflow - Debugging Log

## Key Discovery: Both Ansible Playbooks Were Incomplete

**Date:** 2025-07-15
**Issue:** Persistent Ansible execution failures in Billy's VM workflow

### The Problem We Solved

Both `claude-code-environment.yml` and `complete-environment.yml` assume Node.js/npm are already installed, but neither actually installs them!

**Evidence:**
```bash
# Both playbooks fail with identical error:
Failed to find required executable "npm" in paths: /usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin
```

**Root Cause:**
- `inventory.yml` specifies `node_version: "20.17.0"` and `npm_version: "10.6.0"`
- README.md promises "Node.js 20.17.0 (exact version required by GiveGrove)"
- **But no playbook actually installs Node.js as a prerequisite!**

### Solutions Implemented

1. **Immediate Fix:** Added Node.js installation to Billy's VM cloud-config
2. **Long-term Fix:** Creating consolidated `billy-development-environment.yml`

### For Future Agents

**DO NOT** assume either existing playbook works out-of-the-box:
- `claude-code-environment.yml` - Assumes existing dev environment + just adds Claude Code
- `complete-environment.yml` - Claims to be "complete" but missing Node.js installation

**DO** use the new consolidated `billy-development-environment.yml` which includes:
- Base system setup (Node.js, npm, build tools)
- Complete development environment
- GUI setup (X11, VNC, browsers)
- GiveGrove repository setup
- Claude Code CLI + Playwright MCP

### Lessons Learned

1. **Test assumptions:** Don't trust playbook names or documentation without verification
2. **Check inventory vs implementation:** Variables defined != features implemented  
3. **Start with minimal working setup:** Build up complexity incrementally
4. **Document real behavior:** What playbooks actually do vs what they claim to do

This debugging session prevented future agents from repeating 3+ hours of SSH key format rabbit holes and Ansible dependency confusion.