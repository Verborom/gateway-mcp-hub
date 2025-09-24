#!/usr/bin/env node
/**
 * Auto-Init Context Loader
 * Runs at the start of every new Claude session
 * Loads 50k tokens from cache, then syncs with Pinecone
 */

import { initContext } from '../../gateway/dist/tools/pinecone/pinecone-rag.js';

async function autoLoadContext() {
  console.log('🚀 Auto-loading context for new session...');
  
  try {
    // Silent load from cache (instant)
    const context = await initContext();
    const parsed = JSON.parse(context);
    
    console.log(`✅ Loaded ${parsed.message_count} messages (${parsed.token_count} tokens) from ${parsed.source}`);
    
    // Store in environment for session access
    process.env.SESSION_CONTEXT = context;
    
    return context;
  } catch (error) {
    console.error('❌ Context load failed:', error);
    // Continue anyway - don't block the session
  }
}

// Run immediately
autoLoadContext();
