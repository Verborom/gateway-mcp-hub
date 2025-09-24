#!/usr/bin/env node
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const QUEUE_FILE = '/Users/eatatjoes/Desktop/Dev/MCP/gateway/command-queue.json';

async function executeCommand(command) {
  console.log(`[CODE] Executing: ${command.command.substring(0, 60)}...`);
  try {
    const { stdout, stderr } = await execAsync(command.command, {
      timeout: 30000,
      maxBuffer: 1024 * 1024 * 10
    });
    console.log(`[CODE] ✓ Completed ${command.id}`);
    return { success: true, result: stdout || stderr || 'Done' };
  } catch (error) {
    console.log(`[CODE] ✗ Error: ${error.message.substring(0, 50)}`);
    return { success: false, error: error.message };
  }
}

async function pollQueue() {
  try {
    const data = await fs.promises.readFile(QUEUE_FILE, 'utf-8');
    const queue = JSON.parse(data);
    
    for (const cmd of queue.commands) {
      if (cmd.status === 'pending') {
        console.log(`[CODE] Found job: ${cmd.type}`);
        cmd.status = 'running';
        await fs.promises.writeFile(QUEUE_FILE, JSON.stringify(queue, null, 2));
        
        const { success, result, error } = await executeCommand(cmd);
        cmd.status = success ? 'completed' : 'error';
        cmd.result = result || '';
        cmd.error = error || '';
        await fs.promises.writeFile(QUEUE_FILE, JSON.stringify(queue, null, 2));
        return true;
      }
    }
  } catch (err) {
    // Silent
  }
  return false;
}

console.log('[CODE] 🚀 Daemon started - You will see progress here!');
setInterval(async () => {
  const hadWork = await pollQueue();
  if (!hadWork) process.stdout.write('.');
}, 2000);