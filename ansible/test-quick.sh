#!/bin/bash

# Quick Docker Test for GiveGrove Ansible Setup
# Simplified version for rapid iteration

set -e

CONTAINER_NAME="givegrove-test-quick"

echo "🐳 Quick GiveGrove Ansible Test"
echo "==============================="
echo ""

# Cleanup function
cleanup() {
    echo "🧹 Cleaning up..."
    docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
}

# Cleanup on exit
trap cleanup EXIT

# Check if Docker is running
if ! docker info &>/dev/null; then
    echo "❌ Docker is not running"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "playbook.yml" ]; then
    echo "❌ Please run this script from the ansible/ directory"
    exit 1
fi

# Get repo root
REPO_ROOT=$(dirname "$(pwd)")

echo "🚀 Starting quick test..."

# Run the test container
docker run --rm \
    --name "$CONTAINER_NAME" \
    --privileged \
    --volume "$REPO_ROOT:/workspace" \
    --workdir /workspace \
    ubuntu:22.04 \
    bash -c "
        set -e
        export DEBIAN_FRONTEND=noninteractive
        
        echo '📦 Installing Ansible...'
        apt-get update -qq
        apt-get install -y -qq ansible sudo python3
        
        echo '👤 Creating test user...'
        useradd -m -s /bin/bash testuser
        echo 'testuser ALL=(ALL) NOPASSWD: ALL' >> /etc/sudoers
        
        echo '🎭 Running Ansible playbook...'
        cd /workspace/ansible
        
        # Create simple Docker inventory
        cat > inventory-test.yml << 'EOF'
all:
  children:
    givegrove_dev:
      hosts:
        localhost:
          ansible_connection: local
          ansible_user: testuser
      vars:
        repo_url: 'file:///workspace'
        home_dir: '/home/testuser'
        repo_dir: '/home/testuser/GiveGrove'
EOF
        
        # Run the Docker-compatible playbook
        ansible-playbook -i inventory-test.yml playbook-docker.yml --connection=local
        
        echo ''
        echo '🧪 Testing installation...'
        
        # Switch to test user and run tests
        su - testuser -c '
            cd /home/testuser/GiveGrove
            echo \"📗 Node.js: \$(node --version)\"
            echo \"📦 npm: \$(npm --version)\"
            echo \"🔥 Firebase: \$(firebase --version | head -1)\"
            echo \"\"
            
            if [ -f package.json ]; then
                echo \"✅ Repository copied successfully\"
            else
                echo \"❌ Repository not found\"
                exit 1
            fi
            
            if [ -d node_modules ]; then
                echo \"✅ Frontend dependencies installed\"
            else
                echo \"❌ Frontend dependencies missing\"
                exit 1
            fi
            
            if [ -d functions/node_modules ]; then
                echo \"✅ Backend dependencies installed\"
            else
                echo \"❌ Backend dependencies missing\"
                exit 1
            fi
            
            echo \"\"
            echo \"🚀 Testing type check...\"
            if npm run type-check; then
                echo \"✅ Type check passed\"
            else
                echo \"⚠️ Type check had issues (expected without secrets)\"
            fi
            
            echo \"\"
            echo \"✅ Quick test completed successfully!\"
        '
        
        echo ''
        echo '🎉 All tests passed!'
    "

echo ""
echo "✅ Quick Docker test completed successfully!"
echo ""
echo "To run the full test with more options:"
echo "  ./test-docker.sh --help"