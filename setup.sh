#!/bin/bash

# NewsTrader Setup Script
# This script helps set up the complete NewsTrader platform

set -e  # Exit on any error

echo "🚀 NewsTrader Setup Script"
echo "=========================="
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check if we're in the right directory
if [[ ! -f "Makefile" ]] || [[ ! -d "src" ]] || [[ ! -d "ml_service" ]] || [[ ! -d "frontend" ]]; then
    print_error "Please run this script from the newsTrader project root directory"
    exit 1
fi

print_info "Setting up NewsTrader multi-service platform..."
echo

# 1. Check system dependencies
echo "1. Checking system dependencies..."

# Check for required tools
command -v make >/dev/null 2>&1 || { print_error "make is required but not installed"; exit 1; }
command -v gcc >/dev/null 2>&1 || command -v clang >/dev/null 2>&1 || { print_error "gcc or clang is required but not installed"; exit 1; }
command -v python3 >/dev/null 2>&1 || { print_error "python3 is required but not installed"; exit 1; }
command -v node >/dev/null 2>&1 || { print_error "node.js is required but not installed"; exit 1; }
command -v npm >/dev/null 2>&1 || { print_error "npm is required but not installed"; exit 1; }

# Check for libcurl
if ! pkg-config --exists libcurl 2>/dev/null; then
    print_warning "libcurl not found. Please install it:"
    echo "  macOS: brew install curl"
    echo "  Ubuntu/Debian: sudo apt-get install libcurl4-openssl-dev"
    echo "  Then run this script again."
    exit 1
fi

print_status "All system dependencies are installed"
echo

# 2. Environment variables setup
echo "2. Setting up environment variables..."

if [[ ! -f ".env" ]]; then
    print_info "Creating .env file template..."
    cat > .env << 'EOF'
# NewsAPI key - Get from https://newsapi.org/
export NEWSAPI_KEY=your_newsapi_key_here

# Alpha Vantage API key - Get from https://www.alphavantage.co/
export REACT_APP_ALPHA_VANTAGE_KEY=your_alpha_vantage_key_here
EOF
    print_warning "Created .env file. Please edit it with your actual API keys before continuing."
    print_info "You can get free API keys from:"
    echo "  • NewsAPI: https://newsapi.org/"
    echo "  • Alpha Vantage: https://www.alphavantage.co/"
    echo
    print_info "After adding your API keys, run this script again."
    exit 0
else
    print_status ".env file exists"
fi

# Load environment variables
source .env

# Check if API keys are set
if [[ "$NEWSAPI_KEY" == "your_newsapi_key_here" ]] || [[ -z "$NEWSAPI_KEY" ]]; then
    print_error "Please set your NEWSAPI_KEY in the .env file"
    exit 1
fi

if [[ "$REACT_APP_ALPHA_VANTAGE_KEY" == "your_alpha_vantage_key_here" ]] || [[ -z "$REACT_APP_ALPHA_VANTAGE_KEY" ]]; then
    print_error "Please set your REACT_APP_ALPHA_VANTAGE_KEY in the .env file"
    exit 1
fi

print_status "Environment variables are configured"
echo

# 3. Build C backend
echo "3. Building C backend..."
make clean >/dev/null 2>&1 || true
if make; then
    print_status "C backend built successfully"
else
    print_error "Failed to build C backend"
    exit 1
fi
echo

# 4. Setup Python ML service
echo "4. Setting up Python ML service..."
cd ml_service

if [[ ! -d "venv" ]]; then
    print_info "Creating Python virtual environment..."
    python3 -m venv venv
fi

print_info "Installing Python dependencies..."
source venv/bin/activate
pip install --upgrade pip >/dev/null 2>&1
if pip install -r requirements.txt; then
    print_status "Python ML service setup complete"
else
    print_error "Failed to install Python dependencies"
    exit 1
fi
deactivate

cd ..
echo

# 5. Setup React frontend
echo "5. Setting up React frontend..."
cd frontend

print_info "Installing Node.js dependencies..."
if npm install; then
    print_status "React frontend setup complete"
else
    print_error "Failed to install Node.js dependencies"
    exit 1
fi

# Check for security vulnerabilities
print_info "Checking for security vulnerabilities..."
npm audit --audit-level=moderate >/dev/null 2>&1 || print_warning "Some security vulnerabilities found. Run 'npm audit fix' in frontend directory."

cd ..
echo

# 6. Test basic functionality
echo "6. Testing basic functionality..."

print_info "Testing C backend..."
if ./trader --help >/dev/null 2>&1 || timeout 5 ./trader >/dev/null 2>&1; then
    print_status "C backend is working"
else
    print_warning "C backend test inconclusive (this is normal if NewsAPI is unreachable)"
fi

print_info "Testing Python service imports..."
cd ml_service
source venv/bin/activate
if python -c "import flask, transformers, torch, shap; print('All imports successful')" >/dev/null 2>&1; then
    print_status "Python ML service dependencies are working"
else
    print_warning "Python ML service dependencies may have issues"
fi
deactivate
cd ..

echo

# 7. Create run scripts
echo "7. Creating convenience scripts..."

# Create start-all script
cat > start-all.sh << 'EOF'
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
EOF

chmod +x start-all.sh

# Create individual service scripts
cat > start-ml-service.sh << 'EOF'
#!/bin/bash
source .env
cd ml_service
source venv/bin/activate
python service.py
EOF

cat > start-frontend.sh << 'EOF'
#!/bin/bash
source .env
cd frontend
npm start
EOF

chmod +x start-ml-service.sh start-frontend.sh

print_status "Created convenience scripts:"
echo "  • ./start-all.sh - Start all services"
echo "  • ./start-ml-service.sh - Start only ML service"
echo "  • ./start-frontend.sh - Start only frontend"
echo "  • ./trader - Run C backend"

echo
echo "🎉 Setup completed successfully!"
echo "================================"
echo
print_info "Quick start options:"
echo "  1. Run all services: ./start-all.sh"
echo "  2. Run individual services with the scripts above"
echo "  3. Manual setup: See README.md for detailed instructions"
echo
print_info "Next steps:"
echo "  • Run './start-all.sh' to start all services"
echo "  • Open http://localhost:3000 for the web interface"
echo "  • Run './trader' for command-line analysis"
echo
echo "Happy trading! 📈" 