FROM node:20-alpine

# Install Python for any Python scripts
RUN apk add --no-cache python3 py3-pip git

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production
RUN npm install -g typescript

# Copy source code
COPY src/ ./src/
COPY *.js ./
COPY *.py ./

# Build TypeScript
RUN npm run build

# Create directories for persistence
RUN mkdir -p /data/state /data/queue /data/logs

# Expose ports
EXPOSE 3456 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3456/health', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})" || exit 1

# Start script that handles both stdio and HTTP
CMD ["node", "dist/index.js"]
