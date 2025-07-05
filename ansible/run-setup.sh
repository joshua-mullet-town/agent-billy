#!/bin/bash

# GiveGrove Development Environment Setup Script
# This script runs the Ansible playbook to set up a complete dev environment

set -e

echo "🍋 GiveGrove Development Environment Setup"
echo "========================================"
echo ""

# Check if ansible is installed
if ! command -v ansible-playbook &> /dev/null; then
    echo "❌ Ansible is not installed. Please install it first:"
    echo "   Ubuntu/Debian: sudo apt install ansible"
    echo "   macOS: brew install ansible"
    echo "   pip: pip install ansible"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "playbook.yml" ]; then
    echo "❌ Please run this script from the ansible/ directory"
    echo "   cd ansible/ && ./run-setup.sh"
    exit 1
fi

# Default values
TARGET="localhost"
INVENTORY="inventory.yml"
VERBOSE=""
DRY_RUN=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--target)
            TARGET="$2"
            shift 2
            ;;
        -i|--inventory)
            INVENTORY="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE="-vv"
            shift
            ;;
        --dry-run)
            DRY_RUN="--check"
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -t, --target HOST     Target host (default: localhost)"
            echo "  -i, --inventory FILE  Inventory file (default: inventory.yml)"
            echo "  -v, --verbose         Verbose output"
            echo "  --dry-run            Check mode (don't make changes)"
            echo "  -h, --help           Show this help"
            echo ""
            echo "Examples:"
            echo "  $0                           # Run on localhost"
            echo "  $0 -t vm_instance           # Run on remote VM"
            echo "  $0 --dry-run                # Check what would be done"
            echo "  $0 -t vm_instance -v        # Verbose remote setup"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

echo "🎯 Target: $TARGET"
echo "📋 Inventory: $INVENTORY"
if [ -n "$DRY_RUN" ]; then
    echo "🔍 Mode: Dry run (no changes will be made)"
fi
echo ""

# Verify inventory file exists
if [ ! -f "$INVENTORY" ]; then
    echo "❌ Inventory file not found: $INVENTORY"
    exit 1
fi

# Run the playbook
echo "🚀 Starting Ansible playbook..."
echo ""

if [ "$TARGET" = "localhost" ]; then
    # Local installation
    ansible-playbook \
        -i "$INVENTORY" \
        playbook.yml \
        -l localhost \
        --connection=local \
        $VERBOSE \
        $DRY_RUN
else
    # Remote installation
    ansible-playbook \
        -i "$INVENTORY" \
        playbook.yml \
        -l "$TARGET" \
        $VERBOSE \
        $DRY_RUN
fi

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ GiveGrove development environment setup complete!"
    echo ""
    echo "Next steps:"
    echo "1. 📝 Configure secrets (see SECRETS_SETUP.md in the repo)"
    echo "2. 🚀 Start development:"
    echo "   - Frontend: cd ~/GiveGrove && npm run dev"
    echo "   - Backend: cd ~/GiveGrove/functions && npm run serve"
    echo "   - Full stack: cd ~/GiveGrove && docker-compose up"
    echo "3. 💻 Open VS Code: code ~/GiveGrove"
    echo "4. 🧪 Run tests: ~/GiveGrove/test-playwright.sh"
    echo ""
    if [ "$TARGET" != "localhost" ]; then
        echo "🖥️  GUI Access:"
        echo "   - VNC: Connect to $TARGET:5900"
        echo "   - SSH X11: ssh -X user@$TARGET"
    fi
else
    echo ""
    echo "❌ Setup failed. Check the output above for errors."
    echo "Common issues:"
    echo "- SSH key/access problems for remote hosts"
    echo "- Missing sudo privileges"
    echo "- Network connectivity issues"
    exit 1
fi