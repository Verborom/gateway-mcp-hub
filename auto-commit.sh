#\!/bin/bash
cd /Users/eatatjoes/Desktop/Dev/MCP

echo "[$(date)] Auto-commit watcher started" >> /tmp/gateway-autocommit.log

# Use fswatch with immediate execution on change
fswatch -o /Users/eatatjoes/Desktop/Dev/MCP \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.DS_Store' | while read num
do
  echo "[$(date)] Change detected, committing..." >> /tmp/gateway-autocommit.log
  git add -A
  if \! git diff --cached --quiet; then
    git commit -m "Auto-commit: $(date '+%Y-%m-%d %H:%M:%S')"
    git push origin main 2>&1 >> /tmp/gateway-autocommit.log
    echo "[$(date)] Committed and pushed" >> /tmp/gateway-autocommit.log
  fi
done
EOF < /dev/null