#!/bin/bash
echo "[CODE] 📊 DAEMON MONITOR - Press Ctrl+C to exit"
echo "[CODE] ========================================="
while true; do
  # Check daemon status
  if ps -p 2816 > /dev/null; then
    echo -n "[CODE] ✓ Daemon ACTIVE | "
  else
    echo -n "[CODE] ✗ Daemon DOWN | "
  fi
  
  # Check queue
  if [ -f command-queue.json ]; then
    PENDING=$(grep -c '"status": "pending"' command-queue.json 2>/dev/null || echo 0)
    COMPLETED=$(grep -c '"status": "completed"' command-queue.json 2>/dev/null || echo 0)
    echo -n "Queue: ${PENDING} pending, ${COMPLETED} done | "
  fi
  
  # Show last log entry
  if [ -f daemon.log ]; then
    LAST_LOG=$(tail -1 daemon.log | head -c 40)
    echo "Log: ${LAST_LOG}..."
  else
    echo "No logs yet"
  fi
  
  sleep 2
done