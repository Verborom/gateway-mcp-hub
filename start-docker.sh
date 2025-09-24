#!/bin/bash

# Quick Docker wrapper for MCP Gateway
# Uses the existing built code with Docker for isolation

echo "🚀 Starting MCP Gateway in Docker container..."

# Stop any existing container
docker stop mcp-gateway 2>/dev/null
docker rm mcp-gateway 2>/dev/null

# Run gateway in Node container with full access
docker run -d \
  --name mcp-gateway \
  --restart unless-stopped \
  -v /Users/eatatjoes/Desktop/Dev/MCP/gateway:/app \
  -v /Users/eatatjoes/Desktop/Dev:/workspace \
  -w /app \
  -p 3456:3456 \
  -p 8080:8080 \
  --privileged \
  node:20-slim \
  sh -c "apt-get update && apt-get install -y python3 python3-pip git curl && node dist/index.js"

echo "✅ Container started as 'mcp-gateway'"
echo "📊 Check status with: docker logs mcp-gateway"
echo "🛑 Stop with: docker stop mcp-gateway"
