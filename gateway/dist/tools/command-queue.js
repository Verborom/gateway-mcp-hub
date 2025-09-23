import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Shared queue file path - same as http bridge uses
const QUEUE_FILE = path.join(__dirname, '..', '..', 'command-queue.json');
// Read queue from shared file
async function readQueue() {
    try {
        const data = await fs.readFile(QUEUE_FILE, 'utf-8');
        return JSON.parse(data);
    }
    catch (error) {
        // If file doesn't exist, return empty queue
        return { commands: [], lastModified: Date.now() };
    }
}
// Write queue to shared file with atomic operation
async function writeQueue(data) {
    const tempFile = `${QUEUE_FILE}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(data, null, 2));
    await fs.rename(tempFile, QUEUE_FILE);
}
// Initialize queue file if it doesn't exist
async function initQueueFile() {
    try {
        await fs.access(QUEUE_FILE);
    }
    catch {
        const initialData = {
            commands: [],
            lastModified: Date.now()
        };
        await fs.writeFile(QUEUE_FILE, JSON.stringify(initialData, null, 2));
    }
}
// Initialize on import
initQueueFile().catch(console.error);
export const commandQueueTools = [
    {
        name: "queue_command",
        description: "Add a command to the queue for Claude Code to execute",
        inputSchema: {
            type: "object",
            properties: {
                type: {
                    type: "string",
                    enum: ["shell", "file_write", "file_read", "check"],
                    description: "Type of command"
                },
                command: {
                    type: "string",
                    description: "Command or path"
                },
                args: {
                    type: "object",
                    description: "Additional arguments"
                }
            },
            required: ["type", "command"]
        }
    },
    {
        name: "get_next_command",
        description: "Get the next pending command (for Claude Code to poll)",
        inputSchema: {
            type: "object",
            properties: {}
        }
    },
    {
        name: "submit_result",
        description: "Submit command execution result (Claude Code reports back)",
        inputSchema: {
            type: "object",
            properties: {
                id: {
                    type: "string",
                    description: "Command ID"
                },
                status: {
                    type: "string",
                    enum: ["completed", "error"],
                    description: "Execution status"
                },
                result: {
                    type: "string",
                    description: "Command output"
                },
                error: {
                    type: "string",
                    description: "Error message if failed"
                }
            },
            required: ["id", "status"]
        }
    },
    {
        name: "check_result",
        description: "Check if a command has completed and get its result",
        inputSchema: {
            type: "object",
            properties: {
                id: {
                    type: "string",
                    description: "Command ID to check"
                }
            },
            required: ["id"]
        }
    },
    {
        name: "list_queue",
        description: "List all commands in the queue with their status",
        inputSchema: {
            type: "object",
            properties: {}
        }
    }
];
export async function handleCommandQueueTool(name, args) {
    switch (name) {
        case "queue_command": {
            const queue = await readQueue();
            const id = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const command = {
                id,
                type: args.type,
                command: args.command,
                args: args.args,
                status: 'pending',
                timestamp: Date.now()
            };
            queue.commands.push(command);
            queue.lastModified = Date.now();
            await writeQueue(queue);
            return `Queued command ${id}: ${args.type} - ${args.command}`;
        }
        case "get_next_command": {
            const queue = await readQueue();
            const pending = queue.commands.find(cmd => cmd.status === 'pending');
            if (pending) {
                pending.status = 'running';
                queue.lastModified = Date.now();
                await writeQueue(queue);
                return JSON.stringify(pending);
            }
            return JSON.stringify({ message: "No pending commands" });
        }
        case "submit_result": {
            const queue = await readQueue();
            const command = queue.commands.find(cmd => cmd.id === args.id);
            if (command) {
                command.status = args.status;
                command.result = args.result;
                command.error = args.error;
                queue.lastModified = Date.now();
                await writeQueue(queue);
                return `Result submitted for ${args.id}`;
            }
            return `Command ${args.id} not found`;
        }
        case "check_result": {
            const queue = await readQueue();
            const command = queue.commands.find(cmd => cmd.id === args.id);
            if (command) {
                return JSON.stringify({
                    id: command.id,
                    status: command.status,
                    result: command.result,
                    error: command.error
                });
            }
            return `Command ${args.id} not found`;
        }
        case "list_queue": {
            const queue = await readQueue();
            const summary = queue.commands.map(cmd => ({
                id: cmd.id,
                type: cmd.type,
                command: cmd.command.substring(0, 50) + (cmd.command.length > 50 ? '...' : ''),
                status: cmd.status,
                timestamp: cmd.timestamp
            }));
            return JSON.stringify(summary, null, 2);
        }
        default:
            throw new Error(`Unknown command queue tool: ${name}`);
    }
}
//# sourceMappingURL=command-queue.js.map