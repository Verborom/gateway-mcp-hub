# Gateway MCP Hub - Setup & Requirements

## System Requirements

### Required Software
- **macOS** (tested on MacBook Pro M4 Pro, early 2025)
- **Node.js** v18.20.6 or higher
- **npm** 10.8.2 or higher
- **Python** 3.13.7 or higher
- **Claude Desktop** (latest version with MCP support)
- **TypeScript** (installed via npm)

### Optional (for future integrations)
- **Java** 17+ (for PyCharm plugin development)
- **PyCharm** 2025.2+ with MCP support enabled

## Installation Guide

### Step 1: Create Project Directory
```bash
mkdir -p ~/Desktop/Dev/MCP/gateway
cd ~/Desktop/Dev/MCP/gateway
```

### Step 2: Initialize Node.js Project
```bash
npm init -y
```

### Step 3: Install Dependencies
```bash
npm install @modelcontextprotocol/sdk typescript @types/node
```

### Step 4: Configure TypeScript
Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",  // CRITICAL: Must be ES2022, not commonjs
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Step 5: Update package.json
Add to `package.json`:
```json
{
  "type": "module",  // CRITICAL: Required for ES modules
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsc && node dist/index.js"
  }
}
```

### Step 6: Create Source Structure
```bash
mkdir -p src/tools
```

### Step 7: Build the Server
```bash
npm run build
```

### Step 8: Configure Claude Desktop
Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "gateway": {
      "command": "node",
      "args": ["/Users/YOUR_USERNAME/Desktop/Dev/MCP/gateway/dist/index.js"],
      "env": {}
    }
  }
}
```

### Step 9: Restart Claude Desktop
- Completely quit Claude Desktop (Cmd+Q)
- Reopen Claude Desktop
- Look for the hammer/tool icon in the text input area

## Common Problems & Solutions

### Problem 1: Module Format Mismatch
**Error:** `exports is not defined in ES module scope`

**Cause:** TypeScript is compiling to CommonJS but package.json specifies ES modules.

**Solution:**
1. Ensure `tsconfig.json` has `"module": "ES2022"`
2. Ensure `package.json` has `"type": "module"`
3. Rebuild with `npm run build`

### Problem 2: Server Disconnected in Claude Desktop
**Error:** "MCP gateway: Server disconnected"

**Symptoms:**
- Red warning banner in Claude Desktop
- Tools not appearing

**Solutions:**
1. Check logs: `cat ~/Library/Logs/Claude/mcp.log`
2. Test server manually: `node dist/index.js < /dev/null`
3. Verify path in config is absolute, not relative
4. Ensure no syntax errors in built JavaScript

### Problem 3: Tools Not Appearing After Restart
**Cause:** Claude Desktop not fully restarted

**Solution:**
1. Fully quit Claude Desktop (Cmd+Q, not just close window)
2. Wait 5 seconds
3. Reopen Claude Desktop
4. Check for hammer icon

### Problem 4: Cannot Access Claude Config
**Error:** "Access denied - path outside allowed directories"

**Cause:** Claude Desktop's file access is restricted to specific directories

**Solution:**
Use Claude Code with explicit file system permissions to edit config

### Problem 5: Python Client Not Polling
**Issue:** Command queue not working between Claude Desktop and Python client

**Cause:** Python client trying to spawn new MCP server instances instead of connecting to existing one

**Status:** UNSOLVED - Needs HTTP bridge implementation

## Directory Structure

```
~/Desktop/Dev/MCP/
├── gateway/                    # Main hub server
│   ├── src/
│   │   ├── index.ts           # Main server entry
│   │   └── tools/             # Tool modules
│   │       └── command-queue.ts
│   ├── dist/                  # Compiled JavaScript
│   ├── package.json
│   ├── tsconfig.json
│   ├── node_modules/
│   └── code-client.py         # Python command executor
├── HANDOFF.md                 # Project state document
├── SETUP.md                   # This file
└── README.md                  # User documentation
```

## Verification Steps

1. **Verify Node Installation:**
   ```bash
   node --version  # Should be 18.20.6+
   npm --version   # Should be 10.8.2+
   ```

2. **Verify Build:**
   ```bash
   cd ~/Desktop/Dev/MCP/gateway
   npm run build
   # Should complete without errors
   ```

3. **Verify Server Runs:**
   ```bash
   node dist/index.js < /dev/null
   # Should output: "Gateway MCP server running on stdio"
   ```

4. **Verify Claude Desktop Integration:**
   - Restart Claude Desktop
   - Look for hammer icon
   - Click it - should show gateway tools

## Troubleshooting Commands

### Check Claude Logs
```bash
# Main MCP log
cat ~/Library/Logs/Claude/mcp.log | tail -50

# Gateway-specific log
cat ~/Library/Logs/Claude/mcp-server-gateway.log | tail -50
```

### Test Server Manually
```bash
cd ~/Desktop/Dev/MCP/gateway
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | node dist/index.js
```

### Rebuild Everything
```bash
cd ~/Desktop/Dev/MCP/gateway
rm -rf dist/ node_modules/
npm install
npm run build
```

## Development Workflow

1. **Make Code Changes** in `src/` directory
2. **Build:** `npm run build`
3. **Restart Claude Desktop** to load changes
4. **Test** new tools in Claude Desktop
5. **Check logs** if issues occur

## Next Developer Notes

- The project uses ES modules throughout - don't change to CommonJS
- Claude Desktop only reads config on startup - always restart after changes
- The MCP server runs via stdio, not HTTP (except for planned bridge)
- State is in-memory - restarting server loses all state
- File access from Claude is restricted to Desktop/Dev and Desktop/ClaudeSpace

## Resources

- [MCP Documentation](https://modelcontextprotocol.io/)
- [MCP SDK GitHub](https://github.com/modelcontextprotocol/sdk)
- Claude Desktop Logs: `~/Library/Logs/Claude/`
- Claude Desktop Config: `~/Library/Application Support/Claude/`
