# FOR NEW CLAUDE DESKTOP SESSIONS

When starting a NEW conversation in Claude Desktop (without restarting the app):

## Option 1: Manual Init (Current)
Start your message with: "Load context from RAG"
Claude will call the load_full_context tool

## Option 2: Auto-Init Prompt (Better)
Add this to your FIRST message in new conversations:

"First, silently load my full project context from the RAG system, then [your actual request]"

## Option 3: System Prompt (Best)
Add to Claude Desktop's system prompt (if customizable):
"Always call load_full_context tool at the start of new conversations"

## What Happens:
- Context loads from cache (<1 second)
- 50k tokens of history available
- No app restart needed
- Seamless continuation

## To Test:
1. Start new conversation
2. Say: "Load my context and tell me about my project"
3. Claude should know everything about Gateway MCP Hub

## The Tools Available:
- load_full_context - Gets 50k tokens
- search_history - Find specific topics
- store_context - Save new info
- mark_required_reading - Flag important docs
