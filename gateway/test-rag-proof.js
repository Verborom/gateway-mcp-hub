#!/usr/bin/env node
/**
 * DEFINITIVE RAG SYSTEM TEST
 * Proves every component works
 */

import { handlePineconeTool } from './dist/tools/pinecone/pinecone-rag.js';
import fs from 'fs';

console.log('\n🔬 DEFINITIVE RAG SYSTEM TEST\n' + '='.repeat(50));

async function test1_StoreAndRetrieve() {
  console.log('\n📝 TEST 1: Store & Retrieve Message');
  
  const testMsg = `Test message at ${new Date().toISOString()}`;
  
  // Store
  const storeResult = await handlePineconeTool('store_context', {
    content: testMsg,
    role: 'test',
    session_id: 'proof_test'
  });
  
  // Search for it
  const searchResult = await handlePineconeTool('search_history', {
    query: testMsg,
    top_k: 1
  });
  
  const found = JSON.parse(searchResult);
  const success = found.results && found.results[0] && found.results[0].includes(testMsg);
  
  console.log(success ? '✅ PASS: Message stored and retrieved' : '❌ FAIL: Could not retrieve');
  return success;
}

async function test2_CacheExists() {
  console.log('\n💾 TEST 2: Local Cache System');
  
  const cacheFile = '/Users/eatatjoes/Desktop/Dev/MCP/gateway/cache/pinecone/context-snapshot.json';
  const exists = fs.existsSync(cacheFile);
  const stats = exists ? fs.statSync(cacheFile) : null;
  
  console.log(`Cache exists: ${exists}`);
  if (stats) console.log(`Cache size: ${(stats.size / 1024).toFixed(2)} KB`);
  
  const success = exists && stats && stats.size > 0;
  console.log(success ? '✅ PASS: Cache operational' : '❌ FAIL: Cache missing/empty');
  return success;
}

async function test3_LoadContext() {
  console.log('\n📚 TEST 3: Load Full Context (50k tokens)');
  
  const context = await handlePineconeTool('load_full_context', {
    token_limit: 50000
  });
  
  const parsed = JSON.parse(context);
  const success = parsed.message_count > 0 && parsed.token_count > 0;
  
  console.log(`Messages loaded: ${parsed.message_count}`);
  console.log(`Tokens loaded: ${parsed.token_count}`);
  console.log(`From cache: ${parsed.from_cache ? 'Yes (fast)' : 'No (cloud)'}`);
  
  console.log(success ? '✅ PASS: Context loads successfully' : '❌ FAIL: No context loaded');
  return success;
}

async function test4_RequiredReading() {
  console.log('\n📖 TEST 4: Required Reading System');
  
  // Mark something as required
  await handlePineconeTool('mark_required_reading', {
    content: 'CRITICAL: This is must-read documentation',
    title: 'Test Required Doc',
    category: 'test'
  });
  
  // Load context - should include required reading
  const context = await handlePineconeTool('load_full_context', {
    token_limit: 50000
  });
  
  const success = context.includes('must-read documentation');
  console.log(success ? '✅ PASS: Required reading included' : '❌ FAIL: Required reading missing');
  return success;
}

async function test5_PineconeConnection() {
  console.log('\n☁️ TEST 5: Pinecone Cloud Connection');
  
  try {
    // Force a cloud sync
    const result = await handlePineconeTool('search_history', {
      query: 'gateway MCP',
      top_k: 5,
      use_cloud: true
    });
    
    const parsed = JSON.parse(result);
    console.log(`Cloud search returned: ${parsed.count} results`);
    console.log('✅ PASS: Pinecone cloud accessible');
    return true;
  } catch (err) {
    console.log('❌ FAIL: Pinecone connection error:', err.message);
    return false;
  }
}

async function test6_EmbeddingGeneration() {
  console.log('\n🧮 TEST 6: OpenAI Embedding Generation');
  
  const uniqueText = `Unique test ${Math.random().toString(36).substring(7)}`;
  
  const result = await handlePineconeTool('store_context', {
    content: uniqueText,
    role: 'embed_test'
  });
  
  const success = result.includes('Stored in namespace');
  console.log(success ? '✅ PASS: Embeddings generated' : '❌ FAIL: Embedding failed');
  return success;
}

// Run all tests
async function runAllTests() {
  const results = {
    store_retrieve: await test1_StoreAndRetrieve(),
    cache: await test2_CacheExists(),
    context_load: await test3_LoadContext(),
    required_reading: await test4_RequiredReading(),
    pinecone: await test5_PineconeConnection(),
    embeddings: await test6_EmbeddingGeneration()
  };
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 FINAL RESULTS:');
  console.log('='.repeat(50));
  
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.values(results).length;
  
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}`);
  });
  
  console.log('\n' + '='.repeat(50));
  if (passed === total) {
    console.log('🎉 ALL TESTS PASSED! RAG SYSTEM FULLY OPERATIONAL!');
  } else {
    console.log(`⚠️ ${passed}/${total} tests passed. Issues detected.`);
  }
  console.log('='.repeat(50) + '\n');
  
  return passed === total;
}

runAllTests().catch(console.error);
