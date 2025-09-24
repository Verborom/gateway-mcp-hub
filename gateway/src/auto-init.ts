/**
 * Auto-initialization for new sessions
 * Loads 50k tokens of context from cache/Pinecone
 */

import { handlePineconeTool } from './tools/pinecone/pinecone-rag.js';

export async function autoInitContext(): Promise<void> {
  if (process.env.AUTO_LOAD_CONTEXT !== 'true') {
    return;
  }

  try {
    console.error('[Auto-Init] Loading context...');
    
    // Load 50k tokens from cache/cloud
    const context = await handlePineconeTool('load_full_context', {
      token_limit: 50000
    });
    
    const parsed = JSON.parse(context);
    console.error(`[Auto-Init] Loaded ${parsed.message_count} messages (${parsed.token_count} tokens)`);
    
    // Store in global for access
    global.contextLoaded = true;
    global.initialContext = parsed;
    
  } catch (err) {
    console.error('[Auto-Init] Failed to load context:', err);
  }
}
