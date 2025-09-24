#!/bin/bash

# Gateway Services Launch Script
# This starts the HTTP bridge and Python polling client

echo "Starting Gateway Services..."

# Change to gateway directory
cd /Users/eatatjoes/Desktop/Dev/MCP/gateway

# Kill any existing HTTP bridge on port 3000 (after checking what it is)
echo "Checking port 3000..."
lsof -i :3000
if [ $? -eq 0 ]; then
    echo "WARNING: Something is already running on port 3000"
    echo "Please investigate before killing"
else
    echo "Port 3000 is free"
fi

# Start HTTP bridge server in background
echo "Starting HTTP bridge server..."
nohup node dist/http-bridge-standalone.js > http-bridge.log 2>&1 &
HTTP_PID=$!
echo "HTTP bridge started with PID: $HTTP_PID"

# Wait for server to start
sleep 2

# Check if HTTP bridge is running
if ps -p $HTTP_PID > /dev/null; then
    echo "✓ HTTP bridge is running"
else
    echo "✗ HTTP bridge failed to start"
    echo "Check http-bridge.log for errors"
    exit 1
fi

# Start Python polling client in background
echo "Starting Python polling client..."
nohup python3 code-client.py > code-client.log 2>&1 &
CLIENT_PID=$!
echo "Python client started with PID: $CLIENT_PID"

# Save PIDs for later management
echo "$HTTP_PID" > .http-bridge.pid
echo "$CLIENT_PID" > .code-client.pid

echo ""
echo "Gateway services started successfully!"
echo "HTTP Bridge PID: $HTTP_PID (saved to .http-bridge.pid)"
echo "Python Client PID: $CLIENT_PID (saved to .code-client.pid)"
echo ""
echo "To check logs:"
echo "  tail -f http-bridge.log"
echo "  tail -f code-client.log"
echo ""
echo "To stop services:"
echo "  kill $(cat .http-bridge.pid)"
echo "  kill $(cat .code-client.pid)"
