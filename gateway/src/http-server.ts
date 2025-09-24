#!/usr/bin/env node
/**
 * HTTP-based MCP Server
 * Supports multiple simultaneous client connections
 * Uses Server-Sent Events for real-time updates
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express from 'express';
import cors from 'cors';

const PORT = process.env.PORT || 3456; // Using 3456 to avoid conflicts

// In-memory state and command queue
const stateStore = new Map<string, any>();
const commandQueue = new Map<string, any>();

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    queue_size: commandQueue.size,
    state_keys: stateStore.size,
    timestamp: new Date().toISOString()
  });
});

// Create MCP server instance
const mcpServer = new Server(
  {
    name: "gateway-hub-http",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools
const tools = [
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
  {
    name: "queue_command",
    description: "Add a command to the queue for Claude Code to execute",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description: "Type of command",
          enum: ["shell", "file_write", "file_read", "check"],
        },
        command: {
          type: "string",
          description: "Command or path",
        },
        args: {
          type: "object",
          description: "Additional arguments",
        },
      },
      required: ["type", "command"],
    },
  },
  {
    name: "get_next_command",
    description: "Get the next pending command (for Claude Code to poll)",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "submit_result",
    description: "Submit command execution result (Claude Code reports back)",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Command ID",
        },
        status: {
          type: "string",
          description: "Execution status",
          enum: ["completed", "error"],
        },
        result: {
          type: "string",
          description: "Command output",
        },
        error: {
          type: "string",
          description: "Error message if failed",
        },
      },
      required: ["id", "status"],
    },
  },
  {
    name: "check_result",
    description: "Check if a command has completed and get its result",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Command ID to check",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "list_queue",
    description: "List all commands in the queue with their status",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// Handle tool listing
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool execution
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    throw new Error(`No arguments provided for tool: ${name}`);
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

    case "queue_command": {
      const id = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const command = {
        id,
        type: args.type,
        command: args.command,
        args: args.args || {},
        status: 'pending',
        timestamp: Date.now(),
      };
      commandQueue.set(id, command);
      return {
        content: [
          {
            type: "text",
            text: `Queued command ${id}: ${args.type} - ${args.command}`,
          },
        ],
      };
    }

    case "get_next_command": {
      const pending = Array.from(commandQueue.values()).find(c => c.status === 'pending');
      if (pending) {
        pending.status = 'running';
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(pending),
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ message: "No pending commands" }),
          },
        ],
      };
    }

    case "submit_result": {
      const command = commandQueue.get(args.id as string);
      if (!command) {
        throw new Error(`Command ${args.id} not found`);
      }
      command.status = args.status;
      command.result = args.result || '';
      command.error = args.error || '';
      command.completedAt = Date.now();
      return {
        content: [
          {
            type: "text",
            text: `Updated command ${args.id} to ${args.status}`,
          },
        ],
      };
    }

    case "check_result": {
      const command = commandQueue.get(args.id as string);
      if (!command) {
        throw new Error(`Command ${args.id} not found`);
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(command),
          },
        ],
      };
    }

    case "list_queue": {
      const commands = Array.from(commandQueue.values());
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ commands, count: commands.length }),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// SSE endpoint for MCP
app.get('/sse', async (req, res) => {
  console.log('New SSE client connected');
  const transport = new SSEServerTransport('/sse', res);
  await mcpServer.connect(transport);
});

// Start the server
async function main() {
  app.listen(PORT, () => {
    console.log(`🚀 HTTP MCP Gateway running on http://localhost:${PORT}`);
    console.log(`📡 SSE endpoint: http://localhost:${PORT}/sse`);
    console.log(`❤️  Health check: http://localhost:${PORT}/health`);
  });
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
