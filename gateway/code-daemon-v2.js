#!/usr/bin/env node
/**
 * Claude Code Polling Daemon - With Progress Reporting
 * Shows one-liner status updates for visibility
 */

import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const QUEUE_FILE = '/Users/eatatjoes/Desktop/Dev/MCP/gateway/command-queue.json';
const POLL_INTERVAL = 2000;

// Colors for visibility
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function status(message) {
  console.log(`${colors.cyan}[CODE]${colors.reset} ${message}`);
}

async function executeCommand(command) {
  status(`Executing: ${command.command.substring(0, 60)}...`);
  
  try {
    const { stdout, stderr } = await execAsync(command.command, {
      timeout: 30000,
      maxBuffer: 1024 * 1024 * 10
    });
    
    const result = stdout || stderr || 'Command completed with no output';
    status(`✓ Completed: ${command.id.split('_').pop()}`);
    return { success: true, result };
  } catch (error) {
    status(`✗ Error in ${command.id.split('_').pop()}: ${error.message.substring(0, 50)}`);
    return { success: false, error: error.message };
  }
}

async function processPendingCommands() {
  try {
    const data = await fs.promises.readFile(QUEUE_FILE, 'utf-8');
    const queue = JSON.parse(data);
    
    for (const command of queue.commands) {
      if (command.status === 'pending') {
        status(`Found job: ${command.type} task`);
        
        // Update to running
        command.status = 'running';
        await fs.promises.writeFile(QUEUE_FILE, JSON.stringify(queue, null, 2));
        
        // Execute
        const { success, result, error } = await executeCommand(command);
        
        // Update with results
        command.status = success ? 'completed' : 'error';
        command.result = result || '';
        command.error = error || '';
        command.completedAt = Date.now();
        
        await fs.promises.writeFile(QUEUE_FILE, JSON.stringify(queue, null, 2));
        return true;
      }
    }
  } catch (error) {
    // Silent error (file might be locked)
  }
  return false;
}

async function startDaemon() {
  status('🚀 Code daemon online - Ready to collaborate on RAG system');
  
  process.on('SIGINT', () => {
    status('👋 Daemon stopped');
    process.exit(0);
  });
  
  while (true) {
    const hadWork = await processPendingCommands();
    if (!hadWork) {
      process.stdout.write('.');
    }
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }
}

startDaemon();
