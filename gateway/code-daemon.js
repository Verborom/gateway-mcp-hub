#!/usr/bin/env node
/**
 * Claude Code Polling Daemon
 * Auto-executes commands from the queue without manual intervention
 */

import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const QUEUE_FILE = '/Users/eatatjoes/Desktop/Dev/MCP/gateway/command-queue.json';
const POLL_INTERVAL = 2000; // Poll every 2 seconds
const MAX_EXECUTION_TIME = 30000; // 30 second timeout for commands

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}[${new Date().toISOString()}] ${message}${colors.reset}`);
}

async function readQueue() {
  try {
    const data = await fs.promises.readFile(QUEUE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    log(`Error reading queue: ${error.message}`, colors.red);
    return { commands: [] };
  }
}

async function writeQueue(queue) {
  try {
    await fs.promises.writeFile(QUEUE_FILE, JSON.stringify(queue, null, 2));
  } catch (error) {
    log(`Error writing queue: ${error.message}`, colors.red);
  }
}

async function executeCommand(command) {
  log(`Executing: ${command.command}`, colors.cyan);
  
  try {
    // Set timeout for command execution
    const { stdout, stderr } = await execAsync(command.command, {
      timeout: MAX_EXECUTION_TIME,
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    });
    
    const result = stdout || stderr || 'Command completed with no output';
    log(`✓ Success: ${command.id}`, colors.green);
    return { success: true, result };
  } catch (error) {
    log(`✗ Error: ${error.message}`, colors.red);
    return { success: false, error: error.message };
  }
}

async function processPendingCommands() {
  const queue = await readQueue();
  let hasChanges = false;
  
  for (const command of queue.commands) {
    if (command.status === 'pending') {
      log(`Found pending command: ${command.id}`, colors.yellow);
      
      // Update status to running
      command.status = 'running';
      hasChanges = true;
      await writeQueue(queue);
      
      // Execute the command
      const { success, result, error } = await executeCommand(command);
      
      // Update with results
      command.status = success ? 'completed' : 'error';
      command.result = result || '';
      command.error = error || '';
      command.completedAt = Date.now();
      
      await writeQueue(queue);
      log(`Updated ${command.id} to ${command.status}`, colors.blue);
    }
  }
  
  return hasChanges;
}

async function startDaemon() {
  log('🚀 Claude Code Daemon Started', colors.bright + colors.green);
  log(`Polling ${QUEUE_FILE} every ${POLL_INTERVAL}ms`, colors.cyan);
  log('Press Ctrl+C to stop\n', colors.yellow);
  
  // Set up graceful shutdown
  process.on('SIGINT', () => {
    log('\n👋 Daemon stopped gracefully', colors.yellow);
    process.exit(0);
  });
  
  // Main polling loop
  while (true) {
    try {
      const hadWork = await processPendingCommands();
      if (!hadWork) {
        process.stdout.write('.'); // Show we're alive
      }
    } catch (error) {
      log(`Daemon error: ${error.message}`, colors.red);
    }
    
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }
}

// Start the daemon
startDaemon().catch(error => {
  log(`Failed to start daemon: ${error.message}`, colors.red);
  process.exit(1);
});
