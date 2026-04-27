#!/bin/bash
# ACDE Quick-Start Script
# Usage: bash start.sh

set -e

echo ""
echo "▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓"
echo "  ACDE — Adaptive Counterfactual Debiasing Engine"
echo "  v2.0 Full-Stack Startup"
echo "▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓"
echo ""

# Install backend deps
echo "→ Installing Python dependencies..."
cd backend
pip install -r requirements.txt -q
echo "  Done."

# Start backend in background
echo "→ Starting FastAPI backend on http://localhost:8000 ..."
uvicorn api:app --reload --port 8000 &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"

# Wait for backend to be ready
sleep 2
echo "  Backend ready. Test: curl http://localhost:8000/health"

# Install and start frontend
echo ""
echo "→ Installing Node dependencies..."
cd ../frontend
npm install --silent
echo "  Done."

echo ""
echo "→ Starting React frontend on http://localhost:3000 ..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ACDE is running!"
echo "  Frontend: http://localhost:3000"
echo "  API:      http://localhost:8000"
echo "  Demo:     http://localhost:8000/demo"
echo "  Docs:     http://localhost:8000/docs"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

npm start

# Cleanup on exit
trap "kill $BACKEND_PID 2>/dev/null" EXIT
