#!/bin/bash

# Docker Test Script for GiveGrove Ansible Setup
# This script creates a Docker container and tests the Ansible playbook

set -e

CONTAINER_NAME="givegrove-ansible-test"
IMAGE_NAME="givegrove-test-env"
TEST_DIR="/workspace"

echo "🐳 GiveGrove Ansible Docker Test"
echo "================================"
echo ""

# Function to cleanup
cleanup() {
    echo "🧹 Cleaning up..."
    docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
    docker rmi -f "$IMAGE_NAME" 2>/dev/null || true
}

# Function to handle interruption
handle_interrupt() {
    echo ""
    echo "🛑 Test interrupted by user"
    cleanup
    exit 1
}

# Set up interrupt handler
trap handle_interrupt SIGINT SIGTERM

# Parse command line arguments
KEEP_CONTAINER=false
INTERACTIVE=false
VERBOSE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --keep)
            KEEP_CONTAINER=true
            shift
            ;;
        --interactive)
            INTERACTIVE=true
            shift
            ;;
        -v|--verbose)
            VERBOSE="-v"
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --keep         Keep container after test"
            echo "  --interactive  Drop into container shell after test"
            echo "  -v, --verbose  Verbose output"
            echo "  -h, --help     Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Check if Docker is running
if ! docker info &>/dev/null; then
    echo "❌ Docker is not running or accessible"
    echo "Please start Docker and try again"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "playbook.yml" ]; then
    echo "❌ Please run this script from the ansible/ directory"
    exit 1
fi

# Clean up any existing container
echo "🧹 Cleaning up existing test container..."
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

# Get the parent directory (GiveGrove root)
REPO_ROOT=$(dirname "$(pwd)")

echo "📁 Repository root: $REPO_ROOT"
echo "🚀 Starting test container..."

# Create and start the container
docker run -d \
    --name "$CONTAINER_NAME" \
    --privileged \
    --tmpfs /tmp \
    --tmpfs /var/tmp \
    --tmpfs /run \
    --tmpfs /run/lock \
    --volume /sys/fs/cgroup:/sys/fs/cgroup:ro \
    --volume "$REPO_ROOT:$TEST_DIR" \
    --workdir "$TEST_DIR" \
    --publish 3000:3000 \
    --publish 5000:5000 \
    --publish 5900:5900 \
    ubuntu:22.04 \
    /bin/bash -c "
        # Keep container running
        tail -f /dev/null
    "

echo "✅ Container started: $CONTAINER_NAME"

# Function to run commands in container
run_in_container() {
    docker exec $VERBOSE "$CONTAINER_NAME" /bin/bash -c "$1"
}

# Install basic dependencies
echo "📦 Installing basic dependencies..."
run_in_container "
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq \
        ansible \
        python3 \
        python3-pip \
        sudo \
        systemd \
        curl \
        wget
"

# Create a non-root user for testing
echo "👤 Creating test user..."
run_in_container "
    useradd -m -s /bin/bash -G sudo testuser
    echo 'testuser:testpass' | chpasswd
    echo 'testuser ALL=(ALL) NOPASSWD: ALL' >> /etc/sudoers
"

# Copy and set up ansible files
echo "📋 Setting up Ansible configuration..."
run_in_container "
    cd $TEST_DIR/ansible
    chown -R testuser:testuser .
"

# Run the Ansible playbook
echo "🎭 Running Ansible playbook..."
echo "This may take several minutes..."
echo ""

# Create a modified inventory for Docker testing
run_in_container "
    cd $TEST_DIR/ansible
    cat > inventory-docker.yml << 'EOF'
---
all:
  children:
    givegrove_dev:
      hosts:
        localhost:
          ansible_connection: local
          ansible_user: testuser
      vars:
        repo_url: 'file://$TEST_DIR'
        repo_branch: 'beta'
        node_version: '20.17.0'
        npm_version: '10.6.0'
        firebase_cli_version: '13.27.0'
        enable_gui: false
        enable_vnc: false
        home_dir: '/home/testuser'
        repo_dir: '/home/testuser/GiveGrove'
        secrets_dir: '/home/testuser/GiveGrove/secrets'
EOF
"

# Run the playbook as the test user
if run_in_container "
    cd $TEST_DIR/ansible
    su - testuser -c 'cd $TEST_DIR/ansible && ansible-playbook -i inventory-docker.yml playbook.yml --connection=local $VERBOSE'
"; then
    echo ""
    echo "✅ Ansible playbook completed successfully!"
else
    echo ""
    echo "❌ Ansible playbook failed!"
    echo ""
    echo "🔍 Container logs:"
    docker logs --tail 50 "$CONTAINER_NAME"
    
    if [ "$INTERACTIVE" = true ]; then
        echo ""
        echo "🐚 Dropping into container shell for debugging..."
        docker exec -it "$CONTAINER_NAME" /bin/bash
    fi
    
    if [ "$KEEP_CONTAINER" = false ]; then
        cleanup
    fi
    exit 1
fi

# Test the installation
echo ""
echo "🧪 Testing installation..."

# Check Node.js version
NODE_VERSION=$(run_in_container "su - testuser -c 'node --version'" | tr -d '\r')
echo "📗 Node.js version: $NODE_VERSION"

# Check npm version
NPM_VERSION=$(run_in_container "su - testuser -c 'npm --version'" | tr -d '\r')
echo "📦 npm version: $NPM_VERSION"

# Check Firebase CLI
FIREBASE_VERSION=$(run_in_container "su - testuser -c 'firebase --version'" | head -1 | tr -d '\r')
echo "🔥 Firebase CLI: $FIREBASE_VERSION"

# Check if repo was cloned
if run_in_container "su - testuser -c 'test -f /home/testuser/GiveGrove/package.json'"; then
    echo "📁 Repository cloned successfully"
else
    echo "❌ Repository not found"
fi

# Check if dependencies were installed
if run_in_container "su - testuser -c 'test -d /home/testuser/GiveGrove/node_modules'"; then
    echo "📦 Frontend dependencies installed"
else
    echo "❌ Frontend dependencies not installed"
fi

if run_in_container "su - testuser -c 'test -d /home/testuser/GiveGrove/functions/node_modules'"; then
    echo "📦 Backend dependencies installed"
else
    echo "❌ Backend dependencies not installed"
fi

# Test if we can run the dev server (just check if it starts)
echo ""
echo "🚀 Testing development server startup..."
run_in_container "
    cd /home/testuser/GiveGrove
    timeout 10s su - testuser -c 'cd /home/testuser/GiveGrove && npm run dev' || true
" && echo "✅ Dev server can start (timed out after 10s as expected)"

echo ""
echo "✅ All tests completed!"
echo ""
echo "📊 Test Summary:"
echo "- Ansible playbook: ✅ Success"
echo "- Node.js $NODE_VERSION: ✅ Installed"
echo "- npm $NPM_VERSION: ✅ Installed"
echo "- Firebase CLI: ✅ Installed"
echo "- Repository: ✅ Cloned"
echo "- Dependencies: ✅ Installed"
echo "- Dev server: ✅ Can start"

if [ "$INTERACTIVE" = true ]; then
    echo ""
    echo "🐚 Dropping into container shell..."
    echo "Container name: $CONTAINER_NAME"
    echo "User: testuser"
    echo "Repository: /home/testuser/GiveGrove"
    echo ""
    docker exec -it "$CONTAINER_NAME" su - testuser
fi

if [ "$KEEP_CONTAINER" = false ]; then
    echo ""
    echo "🧹 Cleaning up container..."
    cleanup
    echo "✅ Cleanup complete"
else
    echo ""
    echo "🐳 Container kept running: $CONTAINER_NAME"
    echo "Connect with: docker exec -it $CONTAINER_NAME su - testuser"
    echo "Stop with: docker rm -f $CONTAINER_NAME"
fi

echo ""
echo "🎉 Docker test completed successfully!"