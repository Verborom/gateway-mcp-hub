#!/usr/bin/env node

import { handlePineconeTool } from './dist/tools/pinecone/pinecone-rag.js';

async function testPinecone() {
  try {
    console.log('Testing Pinecone connection...');
    
    // Test storing context
    const result = await handlePineconeTool('store_context', {
      content: 'RAG system initialized successfully at ' + new Date().toISOString(),
      role: 'desktop',
      session_id: 'init_test'
    });
    
    console.log('Store result:', result);
    
    // Test loading context
    const context = await handlePineconeTool('load_full_context', {
      token_limit: 1000
    });
    
    console.log('Context loaded successfully!');
    console.log('First 500 chars:', context.substring(0, 500));
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testPinecone();
