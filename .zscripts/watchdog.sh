#!/bin/bash
# 10X RPC dev server watchdog — restarts next dev if it dies
cd /home/z/my-project
while true; do
  if ! curl -s --connect-timeout 2 --max-time 4 http://localhost:3000/ >/dev/null 2>&1; then
    pkill -9 -f "next dev" 2>/dev/null
    pkill -9 -f "next-server" 2>/dev/null
    sleep 1
    nohup node_modules/.bin/next dev -p 3000 > dev.log 2>&1 < /dev/null &
    echo "[$(date '+%H:%M:%S')] restarted next dev (pid $!)" >> .zscripts/watchdog.log
    sleep 8
  fi
  sleep 5
done
