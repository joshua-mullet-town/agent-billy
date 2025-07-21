#!/usr/bin/env node

// Test the fixed cloud-config generation locally
const fs = require('fs');

// Simulate the fixed generateVMSetupScript function
function generateVMSetupScript(owner, repo, playbookPath, issue) {
  const vmId = `vm-${Date.now()}-${repo.toLowerCase()}`;
  
  // Sanitize issue context - remove quotes, newlines, and special chars that break YAML
  const issueTitle = (issue.title || 'GitHub Issue')
    .replace(/['"\\]/g, '')  // Remove quotes and backslashes
    .replace(/[\r\n]/g, ' ') // Replace newlines with spaces
    .replace(/[^\w\s\-\.]/g, '') // Only allow word chars, spaces, hyphens, dots
    .trim();
  const issueContext = `Issue #${issue.number}: ${issueTitle}`;
  
  // Environment variables - these should be safe but let's be extra careful
  const anthropicApiKey = (process.env.ANTHROPIC_API_KEY || '').replace(/['"\\]/g, '');
  const githubToken = (process.env.GITHUB_TOKEN || '').replace(/['"\\]/g, '');
  
  // Repository info - sanitize owner and repo names
  const safeOwner = owner.replace(/[^a-zA-Z0-9\-]/g, '');
  const safeRepo = repo.replace(/[^a-zA-Z0-9\-\.]/g, '');

  return `#cloud-config
users:
  - name: ubuntu
    ssh_authorized_keys:
      - ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICOWn4+jHkJv1qZnX++HA26lDCeKzHAP1UFJkMIxjHAl joshuamullet@Joshuas-MacBook-Air.local
    sudo: ALL=(ALL) NOPASSWD:ALL

packages:
  - curl
  - wget
  - git
  - jq

runcmd:
  - echo "Billy VM created at $(date)" > /home/ubuntu/billy-status.log
  - echo "SSH access ready" >> /home/ubuntu/billy-status.log
  - echo "Installing Node.js and tools..." >> /home/ubuntu/billy-status.log
  - curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  - sudo apt-get install -y nodejs
  - echo "Setting up coordinator workflow..." >> /home/ubuntu/billy-status.log
  - chown ubuntu:ubuntu /home/ubuntu/coordinator-workflow.sh
  - chmod +x /home/ubuntu/coordinator-workflow.sh
  - echo "Starting coordinator workflow..." >> /home/ubuntu/billy-status.log
  - sudo -u ubuntu nohup /home/ubuntu/coordinator-workflow.sh > /home/ubuntu/coordinator.log 2>&1 &
  - echo "Coordinator workflow started" >> /home/ubuntu/billy-status.log

write_files:
  - path: /home/ubuntu/coordinator-workflow.sh
    permissions: '0755'
    content: |
      #!/bin/bash
      # Billy's Coordinator Workflow - Polls coordinator for step-by-step guidance
      
      VM_ID="${vmId}"
      COORDINATOR_URL="https://agent-billy-production.up.railway.app/coordinator/next-step"
      ISSUE_CONTEXT="${issueContext}"
      ANTHROPIC_API_KEY="${anthropicApiKey}"
      GITHUB_TOKEN="${githubToken}"
      
      echo "🤖 Billy Coordinator Workflow Started at $(date)" > /home/ubuntu/coordinator.log
      echo "VM ID: $VM_ID" >> /home/ubuntu/coordinator.log
      echo "Issue: $ISSUE_CONTEXT" >> /home/ubuntu/coordinator.log
      echo "Coordinator: $COORDINATOR_URL" >> /home/ubuntu/coordinator.log
      
      # Install Claude CLI
      echo "📦 Installing Claude CLI..." >> /home/ubuntu/coordinator.log
      npm install -g @anthropic-ai/claude-code
      
      # Install GitHub CLI for PR creation
      echo "📦 Installing GitHub CLI..." >> /home/ubuntu/coordinator.log
      curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
      echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
      sudo apt update && sudo apt install -y gh
      echo "$GITHUB_TOKEN" | gh auth login --with-token
      
      # Clone repository  
      echo "📁 Cloning repository..." >> /home/ubuntu/coordinator.log
      git clone https://github.com/${safeOwner}/${safeRepo}.git
      cd ${safeRepo}
      
      # Set up git identity
      git config user.name "Agent Billy"
      git config user.email "agent-billy@givegrove.com"
      
      # Install dependencies for simple projects
      echo "📦 Installing dependencies..." >> /home/ubuntu/coordinator.log
      if [ -f package.json ]; then
        npm install
      fi
      
      # MAIN COORDINATOR POLLING LOOP
      echo "🔄 Starting coordinator polling loop..." >> /home/ubuntu/coordinator.log
      current_step="initial"
      recent_output="Claude CLI initialized and ready for commands"
      max_iterations=20
      iteration=0
      
      while [ $iteration -lt $max_iterations ]; do
        iteration=$((iteration + 1))
        echo "🔄 Coordinator Loop Iteration $iteration" >> /home/ubuntu/coordinator.log
        
        # Call coordinator using jq for safe JSON generation
        coordinator_response=$(jq -n \\
          --arg vm_id "$VM_ID" \\
          --arg issue_context "$ISSUE_CONTEXT" \\
          --arg recent_output "$recent_output" \\
          --arg current_step "$current_step" \\
          '{vm_id: $vm_id, issue_context: $issue_context, recent_output: $recent_output, current_step: $current_step}' | \\
          curl -s -X POST "$COORDINATOR_URL" \\
            -H "Content-Type: application/json" \\
            -d @-)
        
        echo "📡 Coordinator response: $coordinator_response" >> /home/ubuntu/coordinator.log
        
        # Extract next prompt and completion status
        next_prompt=$(echo "$coordinator_response" | jq -r '.next_prompt')
        is_complete=$(echo "$coordinator_response" | jq -r '.complete')
        
        # Check if workflow is complete
        if [ "$is_complete" = "true" ]; then
          echo "🎉 Workflow completed!" >> /home/ubuntu/coordinator.log
          break
        fi
        
        # Feed prompt to Claude CLI
        echo "🤖 Sending prompt to Claude CLI: $next_prompt" >> /home/ubuntu/coordinator.log
        export ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"
        recent_output=$(echo "$next_prompt" | claude --print --dangerously-skip-permissions 2>&1)
        
        echo "🔄 Claude CLI output: $recent_output" >> /home/ubuntu/coordinator.log
        
        # Update current step based on output
        if [[ "$recent_output" == *"updated"* ]] || [[ "$recent_output" == *"implemented"* ]]; then
          current_step="coding_complete"
        elif [[ "$recent_output" == *"test"* ]] && [[ "$recent_output" == *"passed"* ]]; then
          current_step="testing_complete"
        elif [[ "$recent_output" == *"pull request"* ]] || [[ "$recent_output" == *"PR"* ]]; then
          current_step="pr_complete"
        fi
        
        # Wait before next iteration
        sleep 30
      done
      
      echo "🧹 Workflow complete. VM will self-destruct..." >> /home/ubuntu/coordinator.log`;
}

// Test with problematic issue title that was breaking YAML
const problemIssue = {
  number: 1119,
  title: 'Update "README.md" with setup instructions & troubleshooting'
};

console.log('Testing cloud-config generation with problematic issue title...');
console.log('Issue title:', problemIssue.title);
console.log('');

const cloudConfig = generateVMSetupScript('south-bend-code-works', 'GiveGrove', 'test.yml', problemIssue);

// Write to file for inspection
fs.writeFileSync('/Users/joshuamullet/code/agent-billy/test-fixed-cloud-config.yml', cloudConfig);

console.log('✅ Cloud-config generated successfully!');
console.log('📄 Saved to: test-fixed-cloud-config.yml');
console.log('');
console.log('Key improvements:');
console.log('- Issue title sanitized:', problemIssue.title.replace(/['"\\]/g, '').replace(/[\r\n]/g, ' ').replace(/[^\w\s\-\.]/g, '').trim());
console.log('- No quotes in template variables');
console.log('- Repository names sanitized');
console.log('');
console.log('Next: Test this cloud-config with a real VM');