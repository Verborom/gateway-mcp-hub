#!/usr/bin/env node
/**
 * Test RAG Auto-Context Loading
 * Simulates a new session starting
 */

import { handlePineconeTool } from './dist/tools/pinecone/pinecone-rag.js';

async function testAutoContext() {
  console.log('📚 Testing RAG Auto-Context System...\n');
  
  // Step 1: Store some test conversation
  console.log('1️⃣ Storing test conversation history...');
  const messages = [
    { content: 'Project: Gateway MCP Hub - Central router for tool integrations', role: 'desktop' },
    { content: 'Added Pinecone RAG for 50k token context and 5 month history', role: 'code' },
    { content: 'Docker container running on port 3456 with HTTP server', role: 'desktop' },
    { content: 'Need to solve continuity and context limit issues', role: 'user' }
  ];
  
  for (const msg of messages) {
    await handlePineconeTool('store_context', {
      ...msg,
      session_id: 'test_session_001'
    });
  }
  console.log('   ✓ Stored 4 messages\n');
  
  // Step 2: Mark required reading
  console.log('2️⃣ Marking project docs as required reading...');
  await handlePineconeTool('mark_required_reading', {
    content: 'GROUND RULES: DO NOT modify files unless instructed. DO NOT fix without permission. DO NOT install packages unless requested. ONLY do exactly what is asked. Report errors, do not fix.',
    title: 'Code Collaboration Rules',
    category: 'rules'
  });
  console.log('   ✓ Marked as required reading\n');
  
  // Step 3: Simulate new session loading context
  console.log('3️⃣ Simulating new session auto-load...');
  const context = await handlePineconeTool('load_full_context', {
    token_limit: 50000
  });
  
  const parsed = JSON.parse(context);
  console.log(`   ✓ Loaded ${parsed.message_count} messages (${parsed.token_count} tokens)\n`);
  console.log('   Preview:', parsed.content.substring(0, 200) + '...\n');
  
  // Step 4: Test search
  console.log('4️⃣ Testing topic search for "Docker"...');
  const searchResult = await handlePineconeTool('search_history', {
    query: 'Docker container port',
    top_k: 3
  });
  
  const searchParsed = JSON.parse(searchResult);
  console.log(`   ✓ Found ${searchParsed.count} relevant results\n`);
  
  console.log('✅ RAG System Test Complete!');
}

testAutoContext().catch(console.error);
