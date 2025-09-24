#!/usr/bin/env node
/**
 * Standalone HTTP Bridge Server
 * Runs separately from MCP server to avoid stdio conflicts
 * Communicates via shared JSON file
 */

import express, { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Shared queue file path
const QUEUE_FILE = path.join(__dirname, '..', 'command-queue.json');

interface Command {
  id: string;
  type: 'shell' | 'file_write' | 'file_read' | 'check';
  command: string;
  args?: any;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: string;
  error?: string;
  timestamp: number;
}

interface QueueData {
  commands: Command[];
  lastModified: number;
}

// Initialize queue file if it doesn't exist
async function initQueueFile() {
  try {
    await fs.access(QUEUE_FILE);
  } catch {
    const initialData: QueueData = {
      commands: [],
      lastModified: Date.now()
    };
    await fs.writeFile(QUEUE_FILE, JSON.stringify(initialData, null, 2));
    console.log('Initialized queue file');
  }
}

// Read queue with file locking consideration
async function readQueue(): Promise<QueueData> {
  try {
    const data = await fs.readFile(QUEUE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading queue:', error);
    return { commands: [], lastModified: Date.now() };
  }
}

// Write queue with atomic operation
async function writeQueue(data: QueueData) {
  const tempFile = `${QUEUE_FILE}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(data, null, 2));
  await fs.rename(tempFile, QUEUE_FILE);
}

// Start HTTP server
function startServer(port: number = 3000) {
  const app = express();
  app.use(express.json());

  // GET /next-command - Python client polls this
  app.get('/next-command', async (req: Request, res: Response) => {
    const queue = await readQueue();
    const pending = queue.commands.find(cmd => cmd.status === 'pending');
    
    if (pending) {
      pending.status = 'running';
      queue.lastModified = Date.now();
      await writeQueue(queue);
      res.json(pending);
    } else {
      res.json({ message: "No pending commands" });
    }
  });

  // POST /submit-result - Python client returns results
  app.post('/submit-result', async (req: Request, res: Response) => {
    const { id, status, result, error } = req.body;
    const queue = await readQueue();
    const command = queue.commands.find(cmd => cmd.id === id);
    
    if (command) {
      command.status = status;
      command.result = result;
      command.error = error;
      queue.lastModified = Date.now();
      await writeQueue(queue);
      res.json({ success: true, message: `Result submitted for ${id}` });
    } else {
      res.status(404).json({ success: false, message: `Command ${id} not found` });
    }
  });

  // GET /queue - View current queue status
  app.get('/queue', async (req: Request, res: Response) => {
    const queue = await readQueue();
    res.json(queue.commands);
  });

  // POST /queue-command - Add command (for testing without MCP)
  app.post('/queue-command', async (req: Request, res: Response) => {
    const { type, command, args } = req.body;
    const queue = await readQueue();
    
    const newCommand: Command = {
      id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      command,
      args,
      status: 'pending',
      timestamp: Date.now()
    };
    
    queue.commands.push(newCommand);
    queue.lastModified = Date.now();
    await writeQueue(queue);
    
    res.json({ success: true, id: newCommand.id });
  });

  app.listen(port, () => {
    console.log(`HTTP Bridge running on port ${port}`);
    console.log(`Queue file: ${QUEUE_FILE}`);
  });
}

// Main
async function main() {
  await initQueueFile();
  startServer(3000);
  
  // Cleanup old completed commands every 5 minutes
  setInterval(async () => {
    const queue = await readQueue();
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    queue.commands = queue.commands.filter(cmd => 
      cmd.status === 'pending' || 
      cmd.status === 'running' || 
      (now - cmd.timestamp) < fiveMinutes
    );
    
    await writeQueue(queue);
  }, 5 * 60 * 1000);
}

main().catch(console.error);
