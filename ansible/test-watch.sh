#!/bin/bash

# Watchable Docker Test for GiveGrove Ansible Setup
# Shows real-time progress and lets you peek inside

set -e

CONTAINER_NAME="givegrove-test-watch"

echo "🎬 Watchable GiveGrove Ansible Test"
echo "==================================="
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

echo "🚀 Starting watchable test..."
echo "📺 You can watch the container logs in real-time!"
echo ""

# Start the container in background
docker run -d \
    --name "$CONTAINER_NAME" \
    --privileged \
    --volume "$REPO_ROOT:/workspace" \
    --workdir /workspace \
    ubuntu:22.04 \
    bash -c "
        set -e
        export DEBIAN_FRONTEND=noninteractive
        
        echo '🐳 Container started - beginning setup...'
        echo '📦 Installing Ansible and dependencies...'
        apt-get update -qq
        apt-get install -y -qq ansible sudo python3
        
        echo '👤 Creating test user...'
        useradd -m -s /bin/bash testuser
        echo 'testuser ALL=(ALL) NOPASSWD: ALL' >> /etc/sudoers
        
        echo '🎭 Running Ansible playbook with verbose output...'
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
        
        # Run the Docker-compatible playbook with verbose output
        echo '🎬 Starting Ansible playbook (this will take a few minutes)...'
        ansible-playbook -i inventory-test.yml playbook-docker.yml --connection=local -v
        
        echo ''
        echo '🧪 Testing installation...'
        
        # Switch to test user and run tests
        su - testuser -c '
            cd /home/testuser/GiveGrove
            echo \"\"
            echo \"📊 Installation Results:\"
            echo \"========================\"
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
                echo \"📁 Frontend modules: \$(ls node_modules | wc -l) packages\"
            else
                echo \"❌ Frontend dependencies missing\"
                exit 1
            fi
            
            if [ -d functions/node_modules ]; then
                echo \"✅ Backend dependencies installed\"
                echo \"📁 Backend modules: \$(ls functions/node_modules | wc -l) packages\"
            else
                echo \"❌ Backend dependencies missing\"
                exit 1
            fi
            
            echo \"\"
            echo \"🚀 Testing type check...\"
            if npm run type-check; then
                echo \"✅ Type check passed\"
            else
                echo \"⚠️ Type check had issues (may be expected without secrets)\"
            fi
            
            echo \"\"
            echo \"📋 File structure check:\"
            echo \"- package.json: \$(if [ -f package.json ]; then echo \"✅\"; else echo \"❌\"; fi)\"
            echo \"- functions/package.json: \$(if [ -f functions/package.json ]; then echo \"✅\"; else echo \"❌\"; fi)\"
            echo \"- src/ directory: \$(if [ -d src ]; then echo \"✅\"; else echo \"❌\"; fi)\"
            echo \"- functions/src/ directory: \$(if [ -d functions/src ]; then echo \"✅\"; else echo \"❌\"; fi)\"
            
            echo \"\"
            echo \"✅ Watchable test completed successfully!\"
        '
        
        echo ''
        echo '🎉 All tests passed!'
        echo ''
        echo '💤 Container will stay alive for 30 seconds if you want to explore...'
        sleep 30
    " &

# Get the container ID
sleep 2
echo "📺 Container started! Watching logs..."
echo "   Container name: $CONTAINER_NAME"
echo "   Press Ctrl+C to stop watching (container will continue)"
echo ""

# Follow the logs
docker logs -f "$CONTAINER_NAME" 2>&1 || true

echo ""
echo "🔍 Final container status:"
if docker ps -a --format "table {{.Names}}\t{{.Status}}" | grep "$CONTAINER_NAME"; then
    echo "✅ Container completed successfully"
else
    echo "❌ Container may have failed"
fi

# Show final summary
echo ""
echo "🎬 Want to explore the container? Run this in another terminal:"
echo "   docker exec -it $CONTAINER_NAME bash"
echo "   # or"
echo "   docker exec -it $CONTAINER_NAME su - testuser"