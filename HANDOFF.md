# Gateway MCP Hub - Project Handoff Document

## Project Overview

**Goal:** Build a lightweight, modular MCP server that acts as a central router/hub connecting multiple tools and services. This hub enables bidirectional communication between any connected tools.

**Vision:** Any tool can interface with any other tool through this hub. Examples:
- PyCharm plugin sends code errors → Claude Desktop fixes them → File management extension updates local scripts → Errors disappear in PyCharm
- Claude Desktop ↔ Pinecone for complete RAG and conversation continuity
- Claude can call Google Workspace APIs through the hub
- Scale to 10s or 100s of tools through modular architecture

## Current Architecture

### Core Components

1. **Gateway Hub** (`/Users/eatatjoes/Desktop/Dev/MCP/gateway/`)
   - TypeScript MCP server using `@modelcontextprotocol/sdk`
   - Runs via stdio transport
   - Connected to Claude Desktop
   - Acts as central message broker

2. **State Management**
   - In-memory state store (Map)
   - Tools: `get_state`, `set_state`, `echo`

3. **Command Queue System** (NEW - IN PROGRESS)
   - Enables Claude Desktop ↔ Claude Code communication WITHOUT human copy/paste
   - Tools added:
     - `queue_command` - Claude queues commands
     - `get_next_command` - Clients poll for work
     - `submit_result` - Clients return results
     - `check_result` - Claude checks completion
     - `list_queue` - View all commands/status

## File Structure

```
/Users/eatatjoes/Desktop/Dev/MCP/gateway/
├── src/
│   ├── index.ts              # Main MCP server
│   └── tools/
│       └── command-queue.ts  # Command queue implementation
├── dist/                      # Compiled JavaScript
├── code-client.py            # Python client for command execution
├── package.json              # Node project config (type: "module")
├── tsconfig.json             # TypeScript config (module: "ES2022")
└── node_modules/             # Dependencies
```

## What's Working

1. ✅ **Gateway MCP server connects to Claude Desktop**
   - Shows in Claude Desktop after restart
   - Tools appear in UI (hammer icon)

2. ✅ **Basic tools functional**
   - `echo` - Works
   - `set_state` / `get_state` - Works
   - Command queue tools - Loaded but integration issue

3. ✅ **Module system fixed**
   - Had CommonJS/ES module mismatch
   - Fixed by setting `"module": "ES2022"` in tsconfig.json
   - Server runs without module errors

## Current Problem: Command Queue Communication

### The Issue
We're trying to create a bridge so Claude Desktop can send commands to Claude Code without human intervention.

**Architecture:**
1. Claude Desktop calls `queue_command` → Adds command to gateway's queue
2. Python client (`code-client.py`) polls `get_next_command` → Gets pending commands
3. Python executes command → Calls `submit_result` with output
4. Claude Desktop calls `check_result` → Gets execution result

**Current Status:**
- ✅ Commands queue successfully from Claude Desktop
- ❌ Python client is NOT picking up commands
- The Python client starts but doesn't poll (no dots appearing)

### Suspected Issue
The Python client (`code-client.py`) tries to communicate with the MCP server by running it as a subprocess and sending JSON-RPC messages via stdin. This approach might not work because:
1. The MCP server expects persistent connection
2. Each subprocess call creates new server instance (loses state)
3. The server is already running connected to Claude Desktop

### Potential Solutions

1. **HTTP/REST Bridge** (Recommended)
   - Add HTTP endpoint to gateway server
   - Python client makes HTTP requests instead of subprocess calls
   - Maintains single server instance with persistent state

2. **Shared State File**
   - Gateway writes commands to JSON file
   - Python client reads/updates file
   - Simple but requires file locking

3. **Direct MCP Client in Python**
   - Use MCP SDK to create proper Python client
   - Connect as second client to same server
   - More complex but "correct" approach

## Configuration

### Claude Desktop Config
Location: `~/Library/Application Support/Claude/claude_desktop_config.json`
```json
{
  "mcpServers": {
    "gateway": {
      "command": "node",
      "args": ["/Users/eatatjoes/Desktop/Dev/MCP/gateway/dist/index.js"],
      "env": {}
    }
  }
}
```

## Next Steps

### Immediate (Fix Command Queue)
1. **Add HTTP endpoint to gateway** for Python client communication
2. **Update Python client** to use HTTP instead of subprocess
3. **Test full loop**: Claude queues → Python executes → Claude sees results

### Phase 2: Dynamic Tool Loading
1. **Create tool loader system**
   - Each tool is separate `.ts` file in `tools/` directory
   - Auto-loaded on server start
   - Tools self-register with name, schema, handler

2. **Tool Interface Standard**
   ```typescript
   interface Tool {
     name: string;
     description: string;
     inputSchema: object;
     handler: (args: any) => Promise<any>;
   }
   ```

### Phase 3: PyCharm Integration
1. **PyCharm Plugin** (Python)
   - Monitors IDE state (errors, AST, coverage)
   - Pushes to gateway `/ide/state` endpoint
   - Heartbeat every second

2. **Gateway Tools**
   - `get_ide_context` - Current IDE state
   - `apply_patch` - Update code in IDE
   - `run_linter` - Trigger linting

### Phase 4: Pinecone RAG
- Add vector storage tools
- Store conversation history
- Enable context retrieval

## Critical Context for Next Session

1. **Working Directory**: `/Users/eatatjoes/Desktop/Dev/MCP/`
2. **User has no terminal skills** - All terminal operations through Claude Code
3. **File Access**: Claude Desktop can only access:
   - `/Users/eatatjoes/Desktop/Dev/`
   - `/Users/eatatjoes/Desktop/ClaudeSpace/`
4. **Testing**: After any gateway changes, must restart Claude Desktop
5. **The Python client issue needs solving first** - This blocks the entire "Claude talks to Claude Code" feature

## Commands for Testing

Start Python client:
```bash
cd /Users/eatatjoes/Desktop/Dev/MCP/gateway
python3 code-client.py
```

Rebuild gateway:
```bash
cd /Users/eatatjoes/Desktop/Dev/MCP/gateway
npm run build
```

## Key Decisions Made

1. **Chose TypeScript** over Python for gateway (better MCP SDK support)
2. **ES Modules** not CommonJS (required for MCP SDK)
3. **Modular design** - Hub doesn't know about specific tools
4. **Command queue pattern** for async Claude-to-Code communication
5. **State in memory** for now (will persist later if needed)

## Problem Summary for Next Session

**We're at a critical juncture:** The gateway works perfectly for Claude Desktop integration, but the command queue system (which would eliminate human copy/paste) is blocked because the Python client can't communicate with the already-running MCP server. The next session needs to implement one of the solutions (HTTP bridge recommended) to unblock this feature.

Once this works, we can rapidly add tools and achieve the vision of a true multi-tool orchestration hub.

## SESSION UPDATE - HTTP Bridge Implementation Attempt

### What We Tried
1. **Implemented HTTP Bridge** (src/http-bridge.ts)
   - Added Express server on port 3000
   - Created endpoints: GET /next-command, POST /submit-result, GET /queue
   - Integrated into main server startup

2. **Updated Python Client**
   - Switched from subprocess spawning to HTTP requests
   - Uses requests library to poll gateway
   - Successfully connects to port 3000 when gateway runs

3. **Fixed Multiple Build Issues**
   - TypeScript module format conflicts (ES2022 vs CommonJS)
   - Missing @types/express (moved to devDependencies)
   - Type annotations for Express Request/Response

### The New Problem: MCP Server Disconnects
**After adding HTTP bridge, Claude Desktop shows "Server disconnected"**

Symptoms:
- Gateway starts successfully (we can curl port 3000)
- Claude Desktop immediately shows disconnection error
- Server actually runs but Claude thinks it's disconnected
- Multiple restart attempts create port conflicts

### Debugging Attempts (Whack-a-Mole Phase)
1. **Killed stale processes** - Found old gateway instances on port 3000
2. **Changed ports** - Considered moving to 3456
3. **Removed console.error** - Silenced HTTP bridge startup message
4. **Checked logs extensively** - Server starts then Claude restarts it

### Key Lessons Learned
1. **MCP stdio servers must be extremely careful about output**
   - stdout: ONLY JSON-RPC messages
   - stderr: Logging (but might trigger restarts)
   
2. **Express.listen() might interfere with stdio communication**
   - Async operation could affect event loop
   - Might be changing process stdio streams

3. **The gateway worked perfectly BEFORE HTTP bridge**
   - Problem is definitely related to HTTP bridge addition
   - Not a configuration or path issue

## PATH FORWARD: SYSTEMATIC DEBUGGING

### Stop the Whack-a-Mole Approach
We've been treating symptoms, not the cause. Need systematic debugging.

### Three Proper Solutions (Recommended Order)

1. **Remove HTTP Bridge Temporarily** (RECOMMENDED FIRST)
   - Comment out `startHttpBridge(3000)` in index.ts
   - Rebuild and test
   - Confirms HTTP bridge is the root cause
   - Gets us back to working state

2. **Separate Process for HTTP Bridge** (RECOMMENDED IF #1 CONFIRMS)
   - Create standalone `http-bridge-server.ts`
   - Shares command queue via file or Redis
   - Run as separate process on port 3000
   - Gateway remains pure MCP stdio server
   - Clean separation of concerns

3. **Add Detailed Protocol Debugging** (IF NEEDED)
   - Log every JSON-RPC message to file
   - Track initialization handshake
   - Identify exactly where MCP connection breaks
   - More complex but finds root cause

### Why Separate Process is Likely Best
- MCP stdio servers should do ONE thing: MCP protocol
- Side services (HTTP, WebSocket, etc.) should run separately
- Many successful MCP servers use this pattern
- Avoids stdio/async conflicts

### Next Session Action Items
1. Start by removing HTTP bridge to confirm it's the issue
2. If confirmed, implement separate process solution
3. Use file-based IPC or Redis for queue sharing
4. Test full command queue flow
5. Set up Git auto-commits with launchd (persistent through reboots)

## SESSION RESOLUTION - SEPARATE PROCESS SOLUTION

### Root Cause Confirmed
1. **Disabled HTTP bridge in main server** - Gateway immediately worked perfectly
2. **Confirmed**: HTTP bridge in same process breaks stdio communication
3. **Claude Desktop error was real** - Not a false alarm, actual protocol break

### Implemented Solution: Separate Processes

#### Architecture Now
1. **MCP Server (index.ts)** 
   - Pure stdio server, no HTTP
   - Connects to Claude Desktop
   - Reads/writes command queue from shared JSON file
   - Works perfectly ✅

2. **HTTP Bridge Server (http-bridge-standalone.ts)**
   - Separate Node process on port 3000
   - Provides HTTP API for Python client
   - Reads/writes same JSON file as MCP server
   - Running independently ✅

3. **Shared Queue File (command-queue.json)**
   - Located at gateway root directory
   - Atomic writes prevent corruption
   - Both processes read/write this file
   - File-based IPC solution

#### Files Modified
- `src/index.ts` - Disabled HTTP bridge import and startup
- `src/tools/command-queue.ts` - Converted to use file-based queue
- `src/http-bridge-standalone.ts` - NEW standalone HTTP server
- `code-client.py` - Already updated to use HTTP

### Current Status
- ✅ MCP Gateway works in Claude Desktop (no errors)
- ✅ All tools accessible (echo, state, command queue)
- ✅ HTTP bridge running separately on port 3000
- ✅ Shared queue file initialized and working
- ⏳ Python client ready to test full loop

### Commands to Start Everything
```bash
# HTTP Bridge (run once, stays running)
cd /Users/eatatjoes/Desktop/Dev/MCP/gateway
node dist/http-bridge-standalone.js &

# Python Client (for testing)
python3 code-client.py
```

### Why This Solution Works
- MCP protocol requires exclusive stdio control
- Express/HTTP servers modify process event loop
- Separate processes = no interference
- File-based IPC is simple and reliable
- Pattern used by many production MCP servers

### CRITICAL ISSUE DISCOVERED - Command Queue Not Syncing

**Test Results:**
1. ✅ MCP Gateway tools work in Claude Desktop
2. ✅ HTTP bridge server runs independently
3. ✅ Python client connects and polls successfully
4. ❌ **Commands queued via MCP don't appear in shared file**

**The Problem:**
- When Claude Desktop calls `queue_command`, it gets confirmation
- But the command is NOT appearing in `command-queue.json`
- Python client polls correctly but sees empty queue
- HTTP bridge also shows empty queue

**Likely Cause:**
- The MCP server (running via Claude Desktop) might not have rebuilt with the file-based queue changes
- OR file permissions issue
- OR the async file operations aren't working correctly

**Next Steps to Debug:**
1. Check if gateway was rebuilt after command-queue.ts changes
2. Verify command-queue.json file permissions
3. Add logging to see if file writes are happening
4. Test queue_command directly via HTTP bridge to isolate issue

### TESTING COMPLETE FLOW - File Sync Issues

**Current Test Status:**
1. ✅ Queue cleared and fresh start
2. ✅ Python client running persistently in terminal (no timeouts)
3. ✅ Command queued via Claude Desktop (gets confirmation)
4. ❌ **Python client NOT picking up commands**

**The Problem:**
- Commands queued through MCP aren't reaching the Python client
- Python client is polling but only seeing dots (no commands)
- File-based queue sharing between processes not working

**Possible Causes:**
1. MCP server (Claude Desktop) might not be writing to the file
2. File path mismatch between MCP server and HTTP bridge
3. File permissions issue
4. Async file operations not flushing properly
5. MCP server might still be using old in-memory code despite rebuild

**Debugging in Progress:**
- Checking queue file contents directly
- Verifying HTTP bridge can see the file
- Testing HTTP endpoints manually

**Architecture Reminder:**
- MCP Server writes to `command-queue.json`
- HTTP Bridge reads from same file
- Both use path: `__dirname/../../command-queue.json`
- Should resolve to `/Users/eatatjoes/Desktop/Dev/MCP/gateway/command-queue.json`

### BREAKTHROUGH - System 90% Working!

**Major Success:**
1. ✅ **Command flow WORKS!** Claude Desktop → File → HTTP Bridge → Python Client
2. ✅ Python client picked up command when status changed to "pending"
3. ✅ Python client executed the shell command successfully
4. ❌ Result submission failed with HTTP 400 error

**What Happened:**
- Reset stuck command from "running" to "pending"
- Python client immediately grabbed it (within 2 seconds)
- Executed: `echo "SUCCESS: Claude Desktop to Python client working!"`
- Tried to submit result but got 400 error from HTTP bridge
- Command stuck in "running" again

**The Loop Problem:**
```
1. Command stuck in "running"
2. Python client detects as stuck (after 5 min)
3. We manually reset to "pending"
4. Python picks up and executes
5. Result submission fails (400 error)
6. Back to step 1 - stuck in "running"
```

**Why Result Submission Fails:**
- HTTP bridge `/submit-result` expects: id, status, result, error
- Python client is sending correct format
- Likely issue: Command not found OR data type mismatch
- Need to debug the HTTP 400 error response

**Key Learning:**
The architecture and file-based IPC works! Just need to fix the result submission endpoint or the Python client's request format.

### MISSION ACCOMPLISHED - But Wrong Mission! 🚨

**What We Successfully Built (4 hours):**
1. ✅ Separated HTTP bridge into standalone process
2. ✅ Fixed all module/dependency issues
3. ✅ Implemented file-based command queue
4. ✅ Python client that executes shell commands
5. ✅ Full loop: Claude Desktop → Queue → Python → Results

**The Problem: WE BUILT THE WRONG THING**
- This lets Claude Desktop execute shell commands remotely
- This is NOT Claude-to-Claude communication
- Claude Code is not involved AT ALL
- We built a command executor, not an MCP bridge

**How We Got Off Track:**
1. Started correctly: MCP server connected to Claude Desktop ✅
2. Goal: Remove human copy/paste between Claude Desktop and Claude Code
3. Hit issue: Python client couldn't talk to running MCP server
4. **MISTAKE: Built HTTP bridge and command executor instead of fixing MCP approach**
5. Spent 4 hours building sophisticated system that bypasses MCP entirely

**What We Should Have Built:**
```
Claude Desktop ←→ MCP Gateway ←→ Claude Code
                      ↕
                Other Tools
```

**What We Actually Built:**
```
Claude Desktop → MCP Gateway → HTTP Bridge → Python Script → Shell
                                        (Claude Code not involved)
```

**THE FUNDAMENTAL PROBLEM:**
Claude Code cannot connect to MCP servers directly. It has no MCP client capability.

**CORRECT APPROACH (for next session):**
1. Keep MCP Gateway as central hub
2. Use file-based task queue (Claude Code can read/write files)
3. MCP Gateway manages tasks in files
4. Claude Desktop queues tasks via MCP
5. Claude Code reads task files, does work, writes results
6. Claude Desktop checks results via MCP
7. NO Python executor, NO HTTP bridge needed

**LESSON LEARNED:**
Don't build workarounds when the architecture doesn't support something. Question the approach and find the right path using the tools' actual capabilities.

**ACTION ITEMS:**
1. Shut down Python client (wrong approach)
2. Remove HTTP bridge (unnecessary)
3. Keep MCP Gateway
4. Design file-based task system for Claude Code
5. Stay focused on MCP as THE central hub

### CRITICAL CORRECTION - Claude Code CAN Connect to MCP!

**We Were Wrong:** Claude Code CAN be an MCP client and connect to MCP servers!

Documentation confirms: "Claude Code can connect to hundreds of external tools and data sources through the Model Context Protocol (MCP)"

**THE ACTUAL CORRECT ARCHITECTURE:**
```
Claude Desktop ←→ MCP Gateway (our hub) ←→ Claude Code
                         ↕
                    Other Tools
```

**How It Should Actually Work:**
1. MCP Gateway runs as stdio server
2. Claude Desktop connects to it (already working ✅)
3. Claude Code ALSO connects to same gateway via: `claude mcp add gateway`
4. Both Claudes use same tools (queue_command, check_result, etc.)
5. Commands flow through shared MCP tools, not files or HTTP

**What We Need To Do:**
1. Shut down Python client (wrong approach)
2. Shut down HTTP bridge (unnecessary)
3. Keep MCP Gateway as-is (it's correct)
4. Configure Claude Code to connect to our gateway
5. Test bidirectional communication through MCP tools

**The Command Queue Tools Are Actually Perfect:**
- Claude Desktop queues tasks via `queue_command`
- Claude Code (as MCP client) calls `get_next_command`
- Claude Code does the work
- Claude Code calls `submit_result`
- Claude Desktop checks results

**Why This Is The Right Way:**
- Both Claudes speak MCP natively
- No translation layers needed
- No Python executors needed
- Pure MCP communication
- Exactly what the architecture intended

**LESSON REINFORCED:**
Always verify assumptions! We assumed Claude Code couldn't be an MCP client when it actually can. The elegant solution was there all along - we just didn't see it.

### FINAL SUCCESS - MCP Bidirectional Communication Working!

**Test Results:**
1. ✅ Claude Code successfully connected to gateway MCP server
2. ✅ Command queued from Claude Desktop
3. ✅ Claude Code retrieved command via `get_next_command` tool
4. ✅ Claude Code executed shell command
5. ✅ Claude Code submitted result via `submit_result` tool
6. ✅ Claude Desktop retrieved result via `check_result` tool

**The Complete Working Architecture:**
- Claude Desktop → MCP Gateway (command-queue.json) ← Claude Code
- Both instances share the same JSON file
- Commands flow: Desktop queues → Code executes → Desktop gets results
- NO HUMAN COPY/PASTE REQUIRED!

**What Actually Works:**
- Two gateway instances (one per Claude) sharing a JSON file
- File-based queue handles the coordination
- Each Claude has its specific role (Desktop: commands, Code: execution)
- The command queue tools work perfectly for this use case

**Remaining Considerations:**
- Two instances mean separate in-memory state (get_state/set_state won't share)
- Potential race conditions on file access (hasn't been a problem yet)
- Could add file locking for robustness
- But for the immediate goal of eliminating human middleman: SUCCESS!

## SESSION UPDATE - December 2024 - PID Lock Implementation & Version Control Requirements

### CRITICAL ISSUE: Split-Brain Server Problem

**The Problem:**
When either Claude Desktop or Claude Code restarts, it spawns a NEW gateway server instance instead of reconnecting to the existing one. This creates two separate servers that can't communicate with each other.

**Evidence:**
- Both Claudes successfully connect to the gateway
- Commands flow through shared `command-queue.json` file
- BUT each Claude has its own gateway process
- Result: They communicate via shared file, not true MCP connection

### PID Lock Solution Implemented

**What We Did:**
1. Added PID lock checking to `index.ts`
2. Lock file: `/tmp/gateway-hub.pid`
3. Logic:
   - First instance writes PID to lock file
   - Subsequent instances check if that PID is still running
   - If running: exit immediately (prevent duplicate)
   - If not running: remove stale lock, become new server

**Code Changes Made:**
```typescript
// Added to index.ts:
- checkExistingServer() function
- writeLockFile() function
- isProcessRunning() function
- Lock cleanup on exit (SIGINT, SIGTERM)
```

**Current Status:**
- ✅ PID lock code implemented and compiled
- ✅ Build successful (despite TypeScript warnings)
- ⏳ Needs testing with both Claudes restarted
- ⚠️ Problem: Can't test without restarting (lose session context)

### Attempted Workaround

Tried to manually start gateway with nohup but discovered:
- Gateway requires stdio connection from MCP client
- Exits immediately without proper client connection
- Cannot run standalone without modification

### URGENT REQUIREMENT: Version Control with Auto-Commits

**Requirements (User's explicit needs):**
1. **Automatic commits** - No manual commits ever
2. **Persistent through restarts** - Must survive computer reboots
3. **Always running** - Set and forget solution
4. **GitHub repository** - Full project backup

**Implementation Plan:**

#### Step 1: Initialize Git Repository
```bash
cd /Users/eatatjoes/Desktop/Dev/MCP
git init
git add .
git commit -m "Initial commit: Gateway MCP Hub with command queue"
```

#### Step 2: Create GitHub Repository
- Create new repo: `gateway-mcp-hub`
- Add remote: `git remote add origin [repo-url]`
- Push: `git push -u origin main`

#### Step 3: Auto-Commit Script
Create `/Users/eatatjoes/Desktop/Dev/MCP/auto-commit.sh`:
```bash
#!/bin/bash
cd /Users/eatatjoes/Desktop/Dev/MCP
git add -A
if ! git diff-index --quiet HEAD --; then
  git commit -m "Auto-commit: $(date '+%Y-%m-%d %H:%M:%S')"
  git push origin main
fi
```

#### Step 4: LaunchD for Persistent Auto-Commits (macOS)
Create `~/Library/LaunchAgents/com.user.gateway-autocommit.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.user.gateway-autocommit</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>/Users/eatatjoes/Desktop/Dev/MCP/auto-commit.sh</string>
    </array>
    <key>StartInterval</key>
    <integer>300</integer> <!-- Every 5 minutes -->
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
```

Load with: `launchctl load ~/Library/LaunchAgents/com.user.gateway-autocommit.plist`

### Next Steps After Version Control

1. **Test PID Lock with Fresh Restart**
   - Commit everything to GitHub first (safety net)
   - Restart Claude Desktop
   - Restart Claude Code
   - Verify only ONE gateway instance runs

2. **Force Gateway to Stay Alive (if needed)**
   Options identified:
   - Add standalone mode that doesn't require stdio
   - Use `tail -f /dev/null |` to keep stdin open
   - Add simple HTTP health endpoint

3. **Implement Polling Daemon**
   - Create `polling-daemon.js` for Claude Code
   - Auto-poll every 2 seconds
   - Execute commands automatically
   - Submit results back

4. **Implement State Machine (from SESSION_PLAN.md)**
   - Add approval gates
   - Prevent runaway execution
   - Desktop must approve before next job

### Critical Files and Locations

- **Main server**: `/Users/eatatjoes/Desktop/Dev/MCP/gateway/src/index.ts`
- **Command queue**: `/Users/eatatjoes/Desktop/Dev/MCP/gateway/src/tools/command-queue.ts`
- **Built JS**: `/Users/eatatjoes/Desktop/Dev/MCP/gateway/dist/index.js`
- **Lock file**: `/tmp/gateway-hub.pid`
- **Queue file**: `/Users/eatatjoes/Desktop/Dev/MCP/gateway/command-queue.json`
- **Claude Code config**: `~/.claude.json`
- **Claude Desktop config**: `~/Library/Application Support/Claude/claude_desktop_config.json`

### Key Learnings This Session

1. **MCP IS designed for multiple clients** - We were wrong thinking it's 1:1
2. **The stdio transport is the limitation** - Each client spawns its own server
3. **PID locks can prevent duplicates** - But client needs to handle spawn failure
4. **File-based sharing works** - Not elegant but functional
5. **Version control is CRITICAL** - Need backup before any more experiments

### For Next Session

**PRIORITY 1: Set up GitHub with auto-commits**
- This MUST be done before any other work
- User requires persistent auto-commits through reboots
- Use launchd on macOS for persistence

**PRIORITY 2: Test PID lock after restart**
- Both Claudes need to restart to pick up new code
- Verify split-brain prevention works

**PRIORITY 3: Implement polling daemon**
- Eliminate manual command checking
- Make Claude Code autonomous

**Remember:**
- User has no terminal skills - all operations through Claude Code
- Auto-commits must persist through reboots
- The goal is eliminating human copy/paste
- Keep solutions simple and robust
