/**
 * Context Manager - Ensures context is loaded for EVERY session
 * No restart required - works with new conversations
 */

import { handlePineconeTool } from './tools/pinecone/pinecone-rag.js';

let contextLoaded = false;
let lastLoadTime = 0;
const CONTEXT_TTL = 3600000; // 1 hour

export async function ensureContextLoaded(): Promise<void> {
  // Check if we need to load/reload context
  const now = Date.now();
  const needsLoad = !contextLoaded || (now - lastLoadTime > CONTEXT_TTL);
  
  if (!needsLoad) return;
  
  try {
    // Load 50k tokens from cache/cloud
    const context = await handlePineconeTool('load_full_context', {
      token_limit: 50000
    });
    
    const parsed = JSON.parse(context);
    
    // Store in global for access
    global.ragContext = parsed;
    contextLoaded = true;
    lastLoadTime = now;
    
    // Silent load (no console spam)
    if (process.env.CONTEXT_SILENT_LOAD !== 'true') {
      console.error(`[Context] Loaded ${parsed.message_count} messages (${parsed.token_count} tokens)`);
    }
  } catch (err) {
    console.error('[Context] Failed to auto-load:', err.message);
  }
}

// Wrapper for all MCP tools to ensure context
export function withContext<T extends Function>(toolHandler: T): T {
  return (async (...args: any[]) => {
    await ensureContextLoaded();
    return toolHandler(...args);
  }) as unknown as T;
}
