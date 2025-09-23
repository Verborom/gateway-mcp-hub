# Gateway MCP Hub

A lightweight, modular Model Context Protocol (MCP) server that acts as a central router for tool integrations, enabling seamless communication between AI assistants and various development tools.

## Overview

The Gateway MCP Hub is designed to be a central orchestration point that allows any connected tool to communicate with any other tool through a unified interface. It connects to Claude Desktop as an MCP server and provides a extensible framework for adding new tool integrations.

## Features

- 🔌 **Modular Architecture** - Add new tools without modifying core code
- 💬 **Bidirectional Communication** - Tools can both send and receive data
- 🔄 **State Management** - Persistent state store for data sharing
- 📦 **Command Queue System** - Asynchronous command execution
- 🚀 **Easy Integration** - Simple tool registration system

## Quick Start

### Prerequisites

- macOS (tested on M4 Pro)
- Node.js 18.20.6+
- npm 10.8.2+
- Python 3.13.7+
- Claude Desktop (latest version)

### Installation

1. Clone or create the project:
```bash
mkdir -p ~/Desktop/Dev/MCP/gateway
cd ~/Desktop/Dev/MCP/gateway
```

2. Install dependencies:
```bash
npm init -y
npm install @modelcontextprotocol/sdk typescript @types/node
```

3. Build the server:
```bash
npm run build
```

4. Configure Claude Desktop - Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "gateway": {
      "command": "node",
      "args": ["/path/to/gateway/dist/index.js"],
      "env": {}
    }
  }
}
```

5. Restart Claude Desktop

## Available Tools

### Core Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `echo` | Echo back a message | `message`: string |
| `get_state` | Retrieve a value from state store | `key`: string |
| `set_state` | Store a value in state store | `key`: string, `value`: string |

### Command Queue Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `queue_command` | Add command to execution queue | `type`: string, `command`: string, `args`: object |
| `get_next_command` | Get next pending command | none |
| `submit_result` | Submit command execution result | `id`: string, `status`: string, `result`: string |
| `check_result` | Check command execution status | `id`: string |
| `list_queue` | List all queued commands | none |

## Usage Examples

### Basic State Management
```typescript
// Store a value
await callTool("set_state", { 
  key: "user_preference", 
  value: "dark_mode" 
});

// Retrieve a value
const pref = await callTool("get_state", { 
  key: "user_preference" 
});
```

### Command Queue System
```typescript
// Queue a command for external execution
await callTool("queue_command", {
  type: "shell",
  command: "ls -la",
  args: { cwd: "/Users/username/Desktop" }
});

// Check execution status
const result = await callTool("check_result", {
  id: "cmd_12345"
});
```

## Architecture

```
┌─────────────────┐     MCP/stdio    ┌──────────────┐
│ Claude Desktop  │◄─────────────────►│ Gateway Hub  │
└─────────────────┘                   └──────┬───────┘
                                             │
                          ┌──────────────────┼──────────────────┐
                          │                  │                  │
                    ┌─────▼─────┐     ┌─────▼─────┐     ┌─────▼─────┐
                    │  PyCharm  │     │  Pinecone │     │   Other   │
                    │  Plugin   │     │    RAG    │     │   Tools   │
                    └───────────┘     └───────────┘     └───────────┘
```

## Adding New Tools

Create a new file in `src/tools/` directory:

```typescript
// src/tools/my-tool.ts
export const myToolDefinition = {
  name: "my_tool",
  description: "Does something useful",
  inputSchema: {
    type: "object",
    properties: {
      param1: { type: "string" }
    },
    required: ["param1"]
  }
};

export function handleMyTool(args: any) {
  // Tool implementation
  return `Result: ${args.param1}`;
}
```

Register in `src/index.ts`:
```typescript
import { myToolDefinition, handleMyTool } from "./tools/my-tool.js";

// Add to tools list
tools: [...existingTools, myToolDefinition]

// Add to handler
case "my_tool":
  return handleMyTool(args);
```

## Project Structure

```
gateway/
├── src/                    # TypeScript source
│   ├── index.ts           # Main server
│   └── tools/             # Tool modules
│       └── command-queue.ts
├── dist/                  # Compiled JavaScript
├── package.json          # Node config
├── tsconfig.json         # TypeScript config
└── code-client.py        # Python client (WIP)
```

## Roadmap

### Phase 1: Core Infrastructure ✅
- [x] Basic MCP server
- [x] State management
- [x] Command queue system
- [ ] HTTP bridge for external clients

### Phase 2: PyCharm Integration 🚧
- [ ] PyCharm plugin development
- [ ] Real-time error streaming
- [ ] Code patch application
- [ ] IDE state monitoring

### Phase 3: Pinecone RAG 📋
- [ ] Vector storage integration
- [ ] Conversation history
- [ ] Context retrieval
- [ ] Memory persistence

### Phase 4: Extended Integrations 📋
- [ ] Google Workspace APIs
- [ ] File system operations
- [ ] Git operations
- [ ] Database connections

## Troubleshooting

### Server Won't Connect
1. Check Claude Desktop logs: `~/Library/Logs/Claude/mcp.log`
2. Verify server builds: `npm run build`
3. Test manually: `node dist/index.js < /dev/null`

### Module Errors
Ensure `package.json` has `"type": "module"` and `tsconfig.json` has `"module": "ES2022"`

### Tools Not Appearing
Fully quit and restart Claude Desktop (Cmd+Q, not just close window)

## Contributing

1. Keep tools modular and independent
2. All tools must have clear input/output schemas
3. Handle errors gracefully
4. Add documentation for new tools
5. Test thoroughly before integration

## Support

For issues and questions:
- Check [SETUP.md](./SETUP.md) for detailed setup instructions
- Review [HANDOFF.md](./HANDOFF.md) for current project status
- Examine logs in `~/Library/Logs/Claude/`

## License

This project is provided as-is for educational and development purposes.

## Acknowledgments

Built using:
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [MCP SDK](https://github.com/modelcontextprotocol/sdk)
- Claude Desktop by Anthropic
