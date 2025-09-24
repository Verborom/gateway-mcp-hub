#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { commandQueueTools, handleCommandQueueTool } from "./tools/command-queue.js";
import { pineconeTools, handlePineconeTool, initContext } from "./tools/pinecone/pinecone-rag.js";
import fs from 'fs';
import process from 'process';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '/Users/eatatjoes/Desktop/Dev/MCP/config/pinecone.env' });

// PID lock file
const LOCK_FILE = '/tmp/gateway-hub.pid';

// Check if a process is running
function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// Check for existing server
function checkExistingServer(): boolean {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const pidStr = fs.readFileSync(LOCK_FILE, 'utf-8').trim();
      const pid = parseInt(pidStr, 10);
      
      if (!isNaN(pid) && isProcessRunning(pid)) {
        console.error(`Gateway server already running with PID ${pid}`);
        console.error(`This instance (PID ${process.pid}) will exit to avoid duplicates`);
        return true;
      }
      
      console.error(`Removing stale lock file (PID ${pid} not running)`);
      fs.unlinkSync(LOCK_FILE);
    }
  } catch (err) {
    console.error('Error checking lock file:', err);
  }
  return false;
}

// Write lock file
function writeLockFile(): void {
  try {
    fs.writeFileSync(LOCK_FILE, process.pid.toString());
    console.error(`Created lock file with PID ${process.pid}`);
    
    const cleanup = () => {
      try {
        const currentPid = fs.readFileSync(LOCK_FILE, 'utf-8').trim();
        if (currentPid === process.pid.toString()) {
          fs.unlinkSync(LOCK_FILE);
          console.error('Removed lock file on exit');
        }
      } catch {}
    };
    
    process.on('exit', cleanup);
    process.on('SIGINT', () => { cleanup(); process.exit(0); });
    process.on('SIGTERM', () => { cleanup(); process.exit(0); });
  } catch (err) {
    console.error('Error writing lock file:', err);
  }
}

// State store for the hub
const stateStore = new Map<string, any>();

// Create server instance
const server = new Server(
  {
    name: "gateway-hub",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "echo",
        description: "Echo back the provided message",
        inputSchema: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "Message to echo back",
            },
          },
          required: ["message"],
        },
      },
      {
        name: "get_state",
        description: "Get a value from the state store",
        inputSchema: {
          type: "object",
          properties: {
            key: {
              type: "string",
              description: "Key to retrieve",
            },
          },
          required: ["key"],
        },
      },
      {
        name: "set_state", 
        description: "Set a value in the state store",
        inputSchema: {
          type: "object",
          properties: {
            key: {
              type: "string",
              description: "Key to set",
            },
            value: {
              type: "string",
              description: "Value to store",
            },
          },
          required: ["key", "value"],
        },
      },
      ...commandQueueTools,
      ...pineconeTools,
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    throw new Error(`No arguments provided for tool: ${name}`);
  }

  // Check if it's a Pinecone tool
  if (pineconeTools.some(tool => tool.name === name)) {
    const result = await handlePineconeTool(name, args);
    return {
      content: [
        {
          type: "text",
          text: result,
        },
      ],
    };
  }

  switch (name) {
    case "echo": {
      const message = args.message as string;
      return {
        content: [
          {
            type: "text",
            text: `Echo: ${message}`,
          },
        ],
      };
    }

    case "get_state": {
      const key = args.key as string;
      const value = stateStore.get(key);
      return {
        content: [
          {
            type: "text",
            text: value ? `Value for '${key}': ${value}` : `No value found for key '${key}'`,
          },
        ],
      };
    }

    case "set_state": {
      const key = args.key as string;
      const value = args.value as string;
      stateStore.set(key, value);
      return {
        content: [
          {
            type: "text",
            text: `Stored value '${value}' for key '${key}'`,
          },
        ],
      };
    }

    default:
      // Check if it's a command queue tool
      if (commandQueueTools.some(tool => tool.name === name)) {
        const result = await handleCommandQueueTool(name, args);
        return {
          content: [
            {
              type: "text",
              text: result,
            },
          ],
        };
      }
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Start the server
async function main() {
  // Check if server is already running
  if (checkExistingServer()) {
    process.exit(0);
  }
  
  writeLockFile();
  
  // Auto-load context for new sessions (silent)
  if (process.env.AUTO_LOAD_CONTEXT === 'true') {
    try {
      await initContext();
    } catch (err) {
      console.error('[Auto-Init] Failed to load context:', err);
    }
  }
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Gateway MCP server running on stdio (PID ${process.pid})`);
  console.error(`RAG System: Pinecone connected, 50k token cache enabled`);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
