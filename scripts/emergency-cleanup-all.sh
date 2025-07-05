#!/bin/bash

# Emergency cleanup script - destroys ALL droplets (use with caution!)

echo "🚨 EMERGENCY CLEANUP - This will destroy ALL droplets in your DigitalOcean account!"
echo "⚠️  This is useful for stopping runaway costs but will destroy everything."
echo ""
read -p "Are you sure? Type 'yes' to continue: " confirmation

if [ "$confirmation" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

# Load environment variables
source .env

if [ -z "$DIGITALOCEAN_TOKEN" ]; then
    echo "❌ Error: DIGITALOCEAN_TOKEN not found in environment"
    exit 1
fi

echo "🔍 Finding all droplets..."

# Get all droplet IDs
DROPLET_IDS=$(curl -s -X GET "https://api.digitalocean.com/v2/droplets" \
    -H "Authorization: Bearer $DIGITALOCEAN_TOKEN" | \
    jq -r '.droplets[].id')

if [ -z "$DROPLET_IDS" ]; then
    echo "✅ No droplets found. Nothing to clean up."
    exit 0
fi

echo "Found droplets: $DROPLET_IDS"
echo ""

# Destroy each droplet
for id in $DROPLET_IDS; do
    echo "🗑️  Destroying droplet $id..."
    curl -s -X DELETE "https://api.digitalocean.com/v2/droplets/$id" \
        -H "Authorization: Bearer $DIGITALOCEAN_TOKEN"
    echo "✅ Droplet $id destruction initiated"
done

echo ""
echo "🧹 All droplets have been scheduled for destruction."
echo "💰 Your DigitalOcean costs should stop within a few minutes."