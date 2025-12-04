#!/bin/bash
set -e

# Get port from environment or default to 5000
PORT=${PORT:-5000}

echo "🚀 Starting TikTok Video Washer v2"
echo "Port: $PORT"

# Create directories
mkdir -p uploads washed

# Start gunicorn
exec gunicorn \
    --bind "0.0.0.0:$PORT" \
    --workers 1 \
    --timeout 600 \
    --graceful-timeout 600 \
    app:app

