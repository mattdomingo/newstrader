#!/bin/bash

# Start all NewsTrader services
echo "Starting NewsTrader services..."

# Load environment variables
source .env

# Start Python ML service in background
echo "Starting ML service on port 5000..."
cd ml_service
source venv/bin/activate
python service.py &
ML_PID=$!
cd ..

# Wait a moment for ML service to start
sleep 3

# Start React frontend
echo "Starting React frontend on port 3000..."
cd frontend
npm start &
FRONTEND_PID=$!
cd ..

echo
echo "🎉 All services started!"
echo "• ML Service: http://localhost:5000"
echo "• Web Interface: http://localhost:3000"
echo "• C Backend: Run './trader' in a new terminal"
echo
echo "Press Ctrl+C to stop all services"

# Wait for interrupt
trap "echo 'Stopping services...'; kill $ML_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait
