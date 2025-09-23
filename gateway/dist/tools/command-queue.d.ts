export interface Command {
    id: string;
    type: 'shell' | 'file_write' | 'file_read' | 'check';
    command: string;
    args?: any;
    status: 'pending' | 'running' | 'completed' | 'error';
    result?: string;
    error?: string;
    timestamp: number;
}
export declare const commandQueueTools: ({
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            type: {
                type: string;
                enum: string[];
                description: string;
            };
            command: {
                type: string;
                description: string;
            };
            args: {
                type: string;
                description: string;
            };
            id?: undefined;
            status?: undefined;
            result?: undefined;
            error?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            type?: undefined;
            command?: undefined;
            args?: undefined;
            id?: undefined;
            status?: undefined;
            result?: undefined;
            error?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            id: {
                type: string;
                description: string;
            };
            status: {
                type: string;
                enum: string[];
                description: string;
            };
            result: {
                type: string;
                description: string;
            };
            error: {
                type: string;
                description: string;
            };
            type?: undefined;
            command?: undefined;
            args?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            id: {
                type: string;
                description: string;
            };
            type?: undefined;
            command?: undefined;
            args?: undefined;
            status?: undefined;
            result?: undefined;
            error?: undefined;
        };
        required: string[];
    };
})[];
export declare function handleCommandQueueTool(name: string, args: any): Promise<string>;
//# sourceMappingURL=command-queue.d.ts.map