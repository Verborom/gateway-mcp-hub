# Gateway MCP Hub - Session Plan & Problem Solutions

## Document Purpose
This document captures critical problems identified in the current session and their planned solutions. It serves as a handoff document for future sessions to immediately understand what needs to be fixed without lengthy re-explanation.

## Current Date: December 2024
## Project State: MCP Gateway works but has critical multi-instance and automation issues

---

## PROBLEM 1: Split-Brain Server Issue (CRITICAL)

### The Problem
When Claude Desktop restarts, it spawns a NEW MCP server instance while Claude Code remains connected to the OLD instance. This creates two separate servers with different state/memory, making them deaf to each other. Each Claude instance thinks it owns its own isolated server.

### Root Cause
The current `index.js` always starts as a server. There's no mechanism to detect if another server is already running.

### The Solution: Singleton Server Pattern with PID Lock

#### Implementation Strategy
1. **PID Lock File**: `/tmp/gateway-hub.pid`
2. **First-to-start wins**: Whoever starts first becomes the server
3. **Others become clients**: Subsequent instances connect to existing server

#### Detailed Logic Flow
```
START index.js
  ↓
Check /tmp/gateway-hub.pid exists?
  ├─ NO → Create lock, write PID, START AS SERVER
  └─ YES → Read PID
           ↓
         Process alive?
           ├─ NO → Delete stale lock, create new, START AS SERVER
           └─ YES → CONNECT AS CLIENT to existing server
```

#### Key Code Changes Needed
- Modify `index.js` to check for lock file at startup
- Implement process checking (kill -0 PID)
- Branch into either Server mode or Client mode based on lock
- Both modes use the same MCP SDK, just different classes

---

## PROBLEM 2: Manual Command Polling

### The Problem
Claude Code only checks the command queue when explicitly told to "check now". This requires constant human intervention to move work forward.

### The Solution: Background Polling Daemon

#### Implementation: `polling-daemon.js`
```javascript
// Pseudo-code structure
while (true) {
  if (!currentlyExecutingJob) {
    const command = await mcp.callTool('get_next_command');
    if (command && command.status === 'ready') {
      currentlyExecutingJob = true;
      const result = await executeCommand(command);
      await mcp.callTool('submit_result', result);
      currentlyExecutingJob = false;
    }
  }
  await sleep(2000); // Poll every 2 seconds
}
```

#### Key Features
- Runs as background process: `node polling-daemon.js &`
- Started ONCE when Claude Code connects
- Polls every 2 seconds with small jitter (1.8-2.2s)
- Only pulls commands when idle
- Gracefully handles disconnections/reconnections
- Heartbeat mechanism for health monitoring

---

## PROBLEM 3: Uncontrolled Job Execution

### The Problem
If we enable auto-polling, Code could execute jobs non-stop without Desktop's oversight. Code often "completes" a job that's actually an error report needing intervention. Without approval gates, Code would barrel through the queue, potentially wrecking projects.

### The Solution: Kanban-Style State Machine with Approval Gates

#### State Flow
```
BACKLOG → READY → RUNNING → AWAITING_REVIEW → APPROVED → ARCHIVED
           ↑                      ↓
           └──────────────────────┘
         (Desktop must approve before next job)
```

#### State Definitions
- **backlog**: Queued but not ready to run
- **ready**: Next to execute (ONLY ONE at a time)
- **running**: Currently being executed by Code
- **awaiting_review**: Code thinks complete, needs Desktop approval
- **approved**: Desktop confirmed complete
- **failed**: Needs manual intervention
- **revision_requested**: Desktop wants changes (stays as active job)

#### Core Rules
1. **Single Active Job Rule**: Only ONE job can be in 'ready' or 'running' state
2. **Approval Gate**: No new job moves to 'ready' until current job is 'approved'
3. **Priority Override**: Desktop can inject high-priority fixes that jump queue
4. **Max Queue Size**: 5 jobs maximum (configurable)

#### Job Structure
```javascript
{
  id: "cmd_123",
  type: "shell",
  status: "awaiting_review",
  priority: 1,
  originalCommand: "Build React component",
  boilerplate: {
    workingDir: "/Users/eatatjoes/Desktop/Dev/MCP",
    rules: [
      "DO NOT modify files unless specifically instructed",
      "DO NOT fix issues without explicit permission",
      "DO NOT install packages unless specifically requested",
      "ONLY do exactly what is asked",
      "If errors occur, INVESTIGATE and REPORT, do not fix",
      "Report findings and wait for instructions"
    ]
  },
  revisions: [
    {
      timestamp: 1234567890,
      instruction: "Use TypeScript instead of JavaScript",
      addedBy: "Desktop"
    }
  ],
  attempts: [
    {
      attemptNum: 1,
      startTime: 1234567890,
      endTime: 1234567900,
      result: "Error: missing dependencies",
      status: "failed"
    }
  ],
  createdAt: 1234567880,
  lastModified: 1234567900
}
```

---

## PROBLEM 4: Desktop Awareness of Job Status

### The Problem
Desktop needs to know IMMEDIATELY when a job hits 'awaiting_review' so it can inspect results and decide next steps.

### The Solution: Active Notification System

#### Desktop Tools
- `get_pending_reviews()`: Returns all jobs in awaiting_review state
- `approve_job(id)`: Moves job from awaiting_review → approved
- `request_revision(id, instructions)`: Adds revision to current job
- `abort_job(id, cleanup_instructions)`: Stops job and queues cleanup
- `get_queue_status()`: Overview of all jobs and states

#### Desktop Polling
- Desktop checks `get_pending_reviews()` every 5 seconds when idle
- Visual/audio alert when job needs review
- Shows job result and asks for approval/revision/abort

---

## Additional Features & Safeguards

### Timeout Handling
- Jobs in 'running' state for >7 minutes auto-fail
- Moves to 'failed' state with timeout error
- Frees system for next job

### Abort & Cleanup
When Desktop aborts a job:
1. Job moves to 'aborted' state
2. System creates high-priority CLEANUP job
3. Cleanup job contains list of files modified
4. Code executes cleanup to revert changes

### Session Continuity
- Queue persists in `command-queue.json`
- Survives restarts of both Desktop and Code
- Lock file ensures single server instance

### Health Monitoring
```javascript
{
  daemon_status: {
    pid: 12345,
    last_heartbeat: 1234567890,
    jobs_completed: 42,
    current_job: "cmd_123",
    uptime_seconds: 3600,
    status: "idle" | "executing" | "error"
  }
}
```

---

## FUTURE FEATURES (Not for this session)

### 1. Dry Run Mode
**Purpose**: Preview what Code WOULD do without executing

**Option A - Command Analysis**:
- Desktop sets `dryRun: true` on command
- Code analyzes and reports planned actions
- Lists: commands, files affected, packages, risk level
- Nothing actually executes

**Option B - Simulation Sandbox**:
- Code creates `/tmp/simulation_xyz/` workspace
- Copies relevant files to sandbox
- Executes everything in isolation
- Reports results without affecting real files
- Shows: successes, failures, file diffs

**Benefits**:
- Prevent disasters before they happen
- Test complex operations safely
- Preview side effects
- Build confidence before real execution

### 2. Advanced Queue Management
- Dependency chains (job B waits for job A)
- Conditional execution (if A succeeds, run B, else run C)
- Scheduled jobs (run at specific time)
- Recurring jobs (run every hour)

### 3. Rollback System
- Automatic git commits before each job
- One-click rollback to pre-job state
- Diff viewer for changes made

---

## Implementation Order

### Phase 1: Core Fixes (This Session)
1. **Singleton Server** (PID lock mechanism)
   - Modify index.js
   - Add lock file handling
   - Implement client/server branching
   
2. **State Machine**
   - Update command-queue.ts
   - Add state transitions
   - Implement approval gates
   
3. **Polling Daemon**
   - Create polling-daemon.js
   - Add job template injection
   - Implement heartbeat

4. **Desktop Tools**
   - Add review/approval tools
   - Implement abort/revision
   - Add status monitoring

### Phase 2: Testing & Refinement
1. Test restart scenarios
2. Test job approval flow
3. Test revision handling
4. Test abort & cleanup

### Phase 3: Future Features
- Implement dry run mode
- Add advanced queue features
- Build rollback system

---

## Success Criteria

1. ✅ Desktop and Code share same server after restarts
2. ✅ Code polls automatically without human intervention
3. ✅ Jobs require Desktop approval before proceeding
4. ✅ Desktop can revise/abort jobs mid-flight
5. ✅ System prevents runaway execution
6. ✅ All jobs include boilerplate rules
7. ✅ Queue survives restarts

---

## Testing Checklist

- [ ] Start Desktop first, then Code - verify connection
- [ ] Start Code first, then Desktop - verify connection
- [ ] Restart Desktop while Code running - verify reconnection
- [ ] Restart Code while Desktop running - verify reconnection
- [ ] Queue job from Desktop, verify Code executes
- [ ] Verify Code waits for approval before next job
- [ ] Test revision flow
- [ ] Test abort and cleanup
- [ ] Test with 5 jobs queued
- [ ] Test 7-minute timeout

---

## Critical Context for Next Session

**Working Directory**: `/Users/eatatjoes/Desktop/Dev/MCP/`

**Key Files**:
- `/gateway/src/index.ts` - Main server (needs singleton logic)
- `/gateway/src/tools/command-queue.ts` - Queue implementation (needs states)
- `/gateway/polling-daemon.js` - TO BE CREATED
- `/tmp/gateway-hub.pid` - Lock file location

**Current Problem**: Multiple server instances when Desktop/Code restart

**Solution**: PID lock + state machine + polling daemon

**Remember**: 
- NO HTTP bridge
- NO Python client  
- ONLY stdio-based MCP
- Code and Desktop must share ONE server instance
- Jobs need approval gates

---

## Notes for Implementation

When implementing, remember:
1. The MCP SDK supports both Server and Client classes
2. Lock file must be checked atomically (race conditions)
3. Process checking via `kill(pid, 0)` in Node.js
4. State transitions must be atomic (no race conditions)
5. File-based queue must handle concurrent access
6. Polling daemon needs proper error handling
7. Desktop needs clear feedback on job status

This plan ensures safe, controlled execution with human oversight while eliminating manual intervention for routine operations.