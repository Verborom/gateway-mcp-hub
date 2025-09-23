#!/bin/bash

# Auto-commit script for Gateway MCP Hub
# This script watches for file changes and automatically commits them to git

PROJECT_DIR="/Users/eatatjoes/Desktop/Dev/MCP"
LOG_FILE="/tmp/auto-commit.log"
COMMIT_DELAY=60  # Wait 60 seconds after last change before committing

# Ensure we're in the project directory
cd "$PROJECT_DIR" || exit 1

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Initialize
log "Auto-commit script started for $PROJECT_DIR"

# Function to perform git operations
perform_git_commit() {
    # Check if there are changes
    if git diff --quiet && git diff --cached --quiet; then
        return 0  # No changes
    fi
    
    # Add all changes
    git add -A
    
    # Get list of changed files
    CHANGED_FILES=$(git status --porcelain | wc -l | tr -d ' ')
    
    # Create commit message
    if [ "$CHANGED_FILES" -eq 1 ]; then
        FILE_NAME=$(git status --porcelain | head -1 | cut -c4-)
        COMMIT_MSG="Auto-commit: Updated $FILE_NAME"
    else
        COMMIT_MSG="Auto-commit: Updated $CHANGED_FILES files"
    fi
    
    # Commit
    git commit -m "$COMMIT_MSG" >> "$LOG_FILE" 2>&1
    
    # Push to remote
    git push origin main >> "$LOG_FILE" 2>&1
    
    log "Committed and pushed: $COMMIT_MSG"
}

# Track last modification time
last_mod_time=0

# Watch for changes
fswatch -r \
    --exclude "\.git" \
    --exclude "node_modules" \
    --exclude "dist" \
    --exclude "\.DS_Store" \
    --exclude ".*\.log" \
    --exclude ".*\.pid" \
    --exclude ".*\.swp" \
    "$PROJECT_DIR" | while read event; do
    
    current_time=$(date +%s)
    last_mod_time=$current_time
    
    # Schedule a commit check
    (
        sleep "$COMMIT_DELAY"
        check_time=$(date +%s)
        time_diff=$((check_time - last_mod_time))
        
        # Only commit if no changes in the last COMMIT_DELAY seconds
        if [ $time_diff -ge $COMMIT_DELAY ]; then
            perform_git_commit
        fi
    ) &
done