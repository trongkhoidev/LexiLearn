#!/bin/bash

# LexiLearn Stop Script
# This script stops all running services

echo "🛑 Stopping LexiLearn Development Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to kill process by PID file
kill_by_pid() {
    local pid_file=$1
    local service_name=$2
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            echo -e "${GREEN}✅ Stopped $service_name (PID: $pid)${NC}"
        else
            echo -e "${YELLOW}⚠️  $service_name was not running${NC}"
        fi
        rm "$pid_file"
    else
        echo -e "${YELLOW}⚠️  No PID file found for $service_name${NC}"
    fi
}

# Stop services
kill_by_pid ".frontend.pid" "Frontend"
kill_by_pid ".backend.pid" "Backend" 
kill_by_pid ".supabase.pid" "Supabase"

# Also try to stop Supabase using CLI
if command_exists supabase; then
    echo -e "${BLUE}🗄️  Stopping Supabase...${NC}"
    supabase stop 2>/dev/null || echo -e "${YELLOW}⚠️  Supabase was not running or already stopped${NC}"
fi

# Kill any remaining processes on common ports
echo -e "${BLUE}🧹 Cleaning up remaining processes...${NC}"
lsof -ti:5173 | xargs kill -9 2>/dev/null && echo -e "${GREEN}✅ Killed processes on port 5173${NC}" || true
lsof -ti:5000 | xargs kill -9 2>/dev/null && echo -e "${GREEN}✅ Killed processes on port 5000${NC}" || true

echo -e "${GREEN}🎉 All services stopped!${NC}"