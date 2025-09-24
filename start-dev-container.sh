#!/bin/bash

# MCP Gateway Docker Development Environment
# Full permissions for Desktop and Code to experiment

echo "🚀 Starting MCP Development Container..."

# Stop any existing containers
docker stop mcp-dev 2>/dev/null
docker rm mcp-dev 2>/dev/null

# Run development container with FULL permissions
docker run -dit \
  --name mcp-dev \
  --hostname mcp-dev \
  --restart unless-stopped \
  --privileged \
  --cap-add=ALL \
  -v /Users/eatatjoes/Desktop/Dev:/workspace \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v $HOME/.ssh:/root/.ssh:ro \
  -w /workspace \
  -p 3000-3010:3000-3010 \
  -p 8080-8090:8080-8090 \
  -p 5000-5010:5000-5010 \
  -e "TERM=xterm-256color" \
  node:20 \
  bash -c "
    apt-get update && 
    apt-get install -y python3 python3-pip git curl wget vim nano sudo docker.io &&
    pip3 install requests flask fastapi uvicorn &&
    npm install -g nodemon ts-node typescript @modelcontextprotocol/sdk &&
    echo '🎮 Development container ready!' &&
    echo 'You can now run ANY command in this container!' &&
    tail -f /dev/null
  "

echo "✅ Development container 'mcp-dev' is starting..."
echo ""
echo "📝 COMMANDS:"
echo "  Enter container: docker exec -it mcp-dev bash"
echo "  Run command:     docker exec mcp-dev <command>"
echo "  Check logs:      docker logs mcp-dev"
echo "  Stop container:  docker stop mcp-dev"
echo ""
echo "🔥 This container has FULL permissions - go wild!"
