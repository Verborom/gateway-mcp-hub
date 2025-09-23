import express from 'express';
import { commandQueue, commandResults } from './tools/command-queue.js';
export function startHttpBridge(port = 3000) {
    const app = express();
    app.use(express.json());
    // GET /next-command - Python client polls this
    app.get('/next-command', (req, res) => {
        const pending = commandQueue.find(cmd => cmd.status === 'pending');
        if (pending) {
            pending.status = 'running';
            res.json(pending);
        }
        else {
            res.json({ message: "No pending commands" });
        }
    });
    // POST /submit-result - Python client returns results
    app.post('/submit-result', (req, res) => {
        const { id, status, result, error } = req.body;
        const command = commandQueue.find(cmd => cmd.id === id);
        if (command) {
            command.status = status;
            command.result = result;
            command.error = error;
            commandResults.set(id, { result, error, status });
            res.json({ success: true, message: `Result submitted for ${id}` });
        }
        else {
            res.status(404).json({ success: false, message: `Command ${id} not found` });
        }
    });
    // GET /queue - View current queue status
    app.get('/queue', (req, res) => {
        res.json(commandQueue);
    });
    app.listen(port, () => {
        // Silent startup - MCP stdio servers should minimize stderr output
        // console.error(`HTTP bridge listening on port ${port}`);
    });
}
//# sourceMappingURL=http-bridge.js.map