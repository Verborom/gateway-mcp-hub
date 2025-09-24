#!/usr/bin/env node
/**
 * Background Pinecone Sync Daemon
 * Continuously syncs cache with cloud
 */

import { handlePineconeTool } from './dist/tools/pinecone/pinecone-rag.js';
import fs from 'fs';

const SYNC_INTERVAL = 30000; // 30 seconds

async function syncWithPinecone() {
  try {
    const cacheFile = '/Users/eatatjoes/Desktop/Dev/MCP/gateway/cache/pinecone/context-snapshot.json';
    
    if (fs.existsSync(cacheFile)) {
      // Trigger background sync
      await handlePineconeTool('load_full_context', { 
        token_limit: 50000,
        force_sync: true 
      });
      console.log(`[SYNC] Background sync completed at ${new Date().toISOString()}`);
    }
  } catch (err) {
    console.error('[SYNC] Sync error:', err.message);
  }
}

console.log('[SYNC] Pinecone sync daemon started');
setInterval(syncWithPinecone, SYNC_INTERVAL);

// Initial sync
syncWithPinecone();
