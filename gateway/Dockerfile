FROM node:20-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files first (for better caching)
COPY package*.json ./
COPY tsconfig.json ./

# Install Node dependencies
RUN npm ci

# Copy source code
COPY src/ ./src/

# Copy other files
COPY *.js ./
COPY *.py ./
COPY command-queue.json ./

# Build TypeScript
RUN npx tsc

# Create directories for persistence
RUN mkdir -p /data/state /data/queue /data/logs

# Create a startup script
RUN echo '#!/bin/sh\n\
echo "Starting MCP Gateway..."\n\
node dist/index.js\n\
' > /app/start.sh && chmod +x /app/start.sh

# Expose ports
EXPOSE 3456 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3456/health || exit 1

# Run the startup script
CMD ["/app/start.sh"]
