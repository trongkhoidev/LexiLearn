#!/bin/bash

# LexiLearn Startup Script
# This script starts Frontend (Vite), Backend (Flask), and Database (Supabase)

echo "🚀 Starting LexiLearn Development Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if port is in use
port_in_use() {
    lsof -i :$1 >/dev/null 2>&1
}

# Check dependencies
echo -e "${BLUE}📋 Checking dependencies...${NC}"

if ! command_exists node; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi

if ! command_exists python3; then
    echo -e "${RED}❌ Python 3 is not installed${NC}"
    exit 1
fi

if ! command_exists supabase; then
    echo -e "${RED}❌ Supabase CLI is not installed${NC}"
    echo "Please install it: npm install -g supabase"
    exit 1
fi

# Check if ports are available
if port_in_use 5173; then
    echo -e "${YELLOW}⚠️  Port 5173 (Frontend) is already in use${NC}"
fi

if port_in_use 5000; then
    echo -e "${YELLOW}⚠️  Port 5000 (Backend) is already in use${NC}"
fi

# Create logs directory
mkdir -p logs

# Start Supabase
echo -e "${BLUE}🗄️  Starting Supabase...${NC}"
if [ -d "supabase" ]; then
    supabase start > logs/supabase.log 2>&1 &
    SUPABASE_PID=$!
    echo -e "${GREEN}✅ Supabase starting (PID: $SUPABASE_PID)${NC}"
    
    # Wait a bit for Supabase to start
    sleep 5
    
    # Check if Supabase started successfully
    if supabase status > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Supabase is running${NC}"
    else
        echo -e "${RED}❌ Supabase failed to start. Check logs/supabase.log${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Supabase directory not found, skipping database start${NC}"
fi

# Start Backend (Flask)
echo -e "${BLUE}🔧 Starting Backend (Flask)...${NC}"
cd backend

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}⚠️  Creating virtual environment...${NC}"
    python3 -m venv venv
fi

# Activate virtual environment and install dependencies
source venv/bin/activate
pip install -r requirements.txt > ../logs/backend-install.log 2>&1

# Start Flask backend
python app.py > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

echo -e "${GREEN}✅ Backend starting (PID: $BACKEND_PID) on port 5000${NC}"

# Start Frontend (Vite)
echo -e "${BLUE}🎨 Starting Frontend (Vite)...${NC}"

# Install frontend dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  Installing frontend dependencies...${NC}"
    npm install > logs/frontend-install.log 2>&1
fi

# Start Vite frontend
npm run dev > logs/frontend.log 2>&1 &
FRONTEND_PID=$!

echo -e "${GREEN}✅ Frontend starting (PID: $FRONTEND_PID) on port 5173${NC}"

# Save PIDs to file for cleanup
echo "$SUPABASE_PID" > .supabase.pid
echo "$BACKEND_PID" > .backend.pid  
echo "$FRONTEND_PID" > .frontend.pid

# Wait a moment for services to start
sleep 3

echo -e "${GREEN}🎉 LexiLearn is now running!${NC}"
echo -e "${BLUE}📱 Frontend: http://localhost:5173${NC}"
echo -e "${BLUE}🔧 Backend: http://localhost:5000${NC}"
echo -e "${BLUE}🗄️  Database: Supabase (check 'supabase status' for details)${NC}"
echo ""
echo -e "${YELLOW}📋 Logs are available in the logs/ directory${NC}"
echo -e "${YELLOW}🛑 To stop all services, run: ./stop.sh${NC}"
echo ""
echo -e "${GREEN}Press Ctrl+C to stop monitoring (services will continue running)${NC}"

# Monitor the processes
trap 'echo -e "\n${YELLOW}⚠️  Services are still running. Use ./stop.sh to stop them.${NC}"' INT

# Show live logs
tail -f logs/frontend.log logs/backend.log &
TAIL_PID=$!

# Wait for user to stop
wait