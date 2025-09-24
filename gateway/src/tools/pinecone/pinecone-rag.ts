/**
 * Pinecone RAG Tools for MCP Gateway
 * Professional-grade vector storage with local caching
 * 50k token context loading + 5 month history
 */

import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// Configuration
const PINECONE_API_KEY = process.env.PINECONE_API_KEY || 'pcsk_3irkUS_7AzUP3mxtKCpWbLfX55t4wQjhYHU3SRfGpMpPPtnwfEchgCDgvGACxRh7jpnrRd';
const PINECONE_HOST = 'https://gateway-4k3euk3.svc.gcp-us-central1-4a9f.pinecone.io';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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';

// Initialize clients
const pinecone = new Pinecone({
  apiKey: PINECONE_API_KEY,
});

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

const index = pinecone.index('gateway', PINECONE_HOST);
const CACHE_DIR = path.join(process.cwd(), 'cache', 'pinecone');

// Ensure cache directory exists
async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

// Load or create cache
async function loadCache() {
  try {
    const data = await fs.readFile(path.join(CACHE_DIR, 'context-snapshot.json'), 'utf-8');
    return JSON.parse(data);
  } catch {
    return { 
      vectors: {}, 
      embeddings: {}, 
      conversations: [],
      lastSync: 0,
      totalTokens: 0 
    };
  }
}

// Save cache
async function saveCache(cache: any) {
  await ensureCacheDir();
  await fs.writeFile(
    path.join(CACHE_DIR, 'context-snapshot.json'),
    JSON.stringify(cache, null, 2)
  );
}

// Get embedding with caching
async function getEmbedding(text: string): Promise<number[]> {
  const cache = await loadCache();
  const hash = crypto.createHash('sha256').update(text).digest('hex');
  
  if (cache.embeddings[hash]) {
    console.error(`[Cache Hit] Embedding for hash ${hash.substring(0, 8)}...`);
    return cache.embeddings[hash];
  }
  
  console.error(`[Cache Miss] Generating embedding for hash ${hash.substring(0, 8)}...`);
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: text,
    dimensions: 3072,
  });
  
  const embedding = response.data[0].embedding;
  cache.embeddings[hash] = embedding;
  await saveCache(cache);
  
  return embedding;
}

// Count tokens (rough estimate)
function countTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// MCP Tools
export const pineconeTools = [
  {
    name: "store_context",
    description: "Store message/context in Pinecone with auto-embedding",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Content to store",
        },
        role: {
          type: "string",
          description: "Role: desktop/code/user",
          enum: ["desktop", "code", "user"],
        },
        session_id: {
          type: "string",
          description: "Session identifier",
        },
        namespace: {
          type: "string",
          description: "Namespace: conversations/must_read/project_state",
          default: "conversations",
        },
        metadata: {
          type: "object",
          description: "Additional metadata",
        },
      },
      required: ["content", "role"],
    },
  },
  {
    name: "load_full_context",
    description: "Load 50k tokens of context from cache then cloud",
    inputSchema: {
      type: "object",
      properties: {
        token_limit: {
          type: "number",
          description: "Max tokens to load (default 50000)",
          default: 50000,
        },
        force_refresh: {
          type: "boolean",
          description: "Force refresh from Pinecone",
          default: false,
        },
      },
    },
  },
  {
    name: "search_history",
    description: "Search conversation history by topic",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query",
        },
        top_k: {
          type: "number",
          description: "Number of results",
          default: 10,
        },
        namespace: {
          type: "string",
          description: "Namespace to search",
          default: "conversations",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "mark_required_reading",
    description: "Mark content as required reading for all new sessions",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Content to mark as required",
        },
        title: {
          type: "string",
          description: "Title for this required reading",
        },
        category: {
          type: "string",
          description: "Category: architecture/rules/context",
        },
      },
      required: ["content", "title"],
    },
  },
];

// Tool handlers
export async function handlePineconeTool(name: string, args: any): Promise<string> {
  await ensureCacheDir();
  
  switch (name) {
    case "store_context": {
      const id = `${args.role}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const embedding = await getEmbedding(args.content);
      const namespace = args.namespace || 'conversations';
      const session_id = args.session_id || 'default';
      
      // Store in Pinecone
      await index.namespace(namespace).upsert([{
        id,
        values: embedding,
        metadata: {
          content: args.content,
          role: args.role,
          session_id,
          timestamp: new Date().toISOString(),
          tokens: countTokens(args.content),
          ...args.metadata,
        },
      }]);
      
      // Update local cache
      const cache = await loadCache();
      cache.conversations.push({
        id,
        content: args.content,
        role: args.role,
        session_id,
        timestamp: new Date().toISOString(),
        tokens: countTokens(args.content),
      });
      
      // Keep only last 50k tokens in cache
      let totalTokens = 0;
      const recentConversations = [];
      for (let i = cache.conversations.length - 1; i >= 0; i--) {
        totalTokens += cache.conversations[i].tokens;
        if (totalTokens <= 50000) {
          recentConversations.unshift(cache.conversations[i]);
        } else {
          break;
        }
      }
      cache.conversations = recentConversations;
      cache.totalTokens = totalTokens;
      await saveCache(cache);
      
      return `Stored in namespace '${namespace}' with ID ${id}`;
    }
    
    case "load_full_context": {
      const tokenLimit = args.token_limit || 50000;
      const cache = await loadCache();
      
      // First, load from cache (instant)
      const cachedContext = cache.conversations
        .map((c: any) => `[${c.role}]: ${c.content}`)
        .join('\n\n');
      
      if (!args.force_refresh && cachedContext) {
        // Background sync with Pinecone (async, non-blocking)
        syncWithPinecone(tokenLimit).catch(console.error);
        
        return JSON.stringify({
          source: 'cache',
          token_count: cache.totalTokens,
          message_count: cache.conversations.length,
          content: cachedContext,
        }, null, 2);
      }
      
      // Force refresh from Pinecone
      const results = await syncWithPinecone(tokenLimit);
      return JSON.stringify({
        source: 'pinecone',
        token_count: results.totalTokens,
        message_count: results.messageCount,
        content: results.content,
      }, null, 2);
    }
    
    case "search_history": {
      const embedding = await getEmbedding(args.query);
      const namespace = args.namespace || 'conversations';
      const topK = args.top_k || 10;
      
      const results = await index.namespace(namespace).query({
        vector: embedding,
        topK,
        includeMetadata: true,
      });
      
      const matches = results.matches?.map((m: any) => ({
        score: m.score,
        content: m.metadata?.content,
        role: m.metadata?.role,
        timestamp: m.metadata?.timestamp,
      })) || [];
      
      return JSON.stringify({
        query: args.query,
        namespace,
        results: matches,
        count: matches.length,
      }, null, 2);
    }
    
    case "mark_required_reading": {
      const id = `required_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const embedding = await getEmbedding(args.content);
      
      await index.namespace('must_read').upsert([{
        id,
        values: embedding,
        metadata: {
          content: args.content,
          title: args.title,
          category: args.category || 'general',
          timestamp: new Date().toISOString(),
          tokens: countTokens(args.content),
        },
      }]);
      
      return `Marked as required reading with ID ${id}`;
    }
    
    default:
      throw new Error(`Unknown Pinecone tool: ${name}`);
  }
}

// Background sync with Pinecone
async function syncWithPinecone(tokenLimit: number) {
  console.error('[Background] Syncing with Pinecone...');
  
  // Get required reading first
  const requiredDocs = await index.namespace('must_read').query({
    vector: new Array(3072).fill(0),
    topK: 100,
    includeMetadata: true,
  });
  
  // Get recent conversations
  const recentConvos = await index.namespace('conversations').query({
    vector: new Array(3072).fill(0),
    topK: 1000,
    includeMetadata: true,
    // Pinecone filter expects Unix timestamp in milliseconds
    filter: {
      timestamp: { $gte: Date.now() - 30 * 24 * 60 * 60 * 1000 },
    },
  });
  
  // Combine and sort by timestamp
  const allContent = [
    ...(requiredDocs.matches || []),
    ...(recentConvos.matches || []),
  ].sort((a: any, b: any) => {
    const aTime = new Date(String(a.metadata?.timestamp || 0)).getTime();
    const bTime = new Date(String(b.metadata?.timestamp || 0)).getTime();
    return bTime - aTime;
  });
  
  // Build context up to token limit
  let totalTokens = 0;
  const conversations = [];
  const content = [];
  
  for (const match of allContent) {
    const tokensValue = match.metadata?.tokens as number || countTokens(String(match.metadata?.content || ''));
    if (totalTokens + tokensValue > tokenLimit) break;
    
    totalTokens += tokensValue;
    conversations.push({
      id: match.id,
      content: match.metadata?.content,
      role: match.metadata?.role || 'system',
      timestamp: match.metadata?.timestamp,
      tokens: tokensValue,
    });
    content.push(`[${match.metadata?.role || 'system'}]: ${match.metadata?.content}`);
  }
  
  // Update cache
  const cache = await loadCache();
  cache.conversations = conversations;
  cache.totalTokens = totalTokens;
  cache.lastSync = Date.now();
  await saveCache(cache);
  
  console.error(`[Background] Synced ${conversations.length} messages (${totalTokens} tokens)`);
  
  return {
    totalTokens,
    messageCount: conversations.length,
    content: content.join('\n\n'),
  };
}

// Auto-init for new sessions
export async function initContext() {
  console.error('[Auto-Init] Loading context silently...');
  const result = await handlePineconeTool('load_full_context', { token_limit: 50000 });
  console.error('[Auto-Init] Context loaded successfully');
  return result;
}
