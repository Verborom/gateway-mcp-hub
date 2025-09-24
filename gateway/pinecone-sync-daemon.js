#!/usr/bin/env node
/**
 * Background Pinecone Sync Daemon
 * Continuously syncs new cache lines with cloud
 */

import { handlePineconeTool } from './dist/tools/pinecone/pinecone-rag.js';
import fs from 'fs';

const SYNC_INTERVAL = 30000; // 30 seconds
const CACHE_FILE = '/Users/eatatjoes/Desktop/Dev/MCP/gateway/cache/pinecone/context-snapshot.json';

async function syncWithPinecone() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      // Trigger store for new content only
      await handlePineconeTool('store_context', { 
        token_limit: 5000,
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