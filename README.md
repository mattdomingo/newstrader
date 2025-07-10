# NewsTrader - Multi-Service Trading Analysis Platform

## Overview
A comprehensive trading analysis platform that combines multiple technologies:
- **C Backend**: Fetches latest technology news headlines from NewsAPI and provides basic trading analysis
- **Python ML Service**: Advanced sentiment analysis using FinBERT and SHAP explanations
- **React Frontend**: Modern web interface displaying news analysis with interactive charts

## Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend │    │  Python ML      │    │   C Backend     │
│   (Port 3000)   │◄──►│  Service        │◄──►│   (CLI Tool)    │
│                 │    │  (Port 5000)    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Alpha Vantage  │    │    FinBERT      │    │    NewsAPI      │
│   Stock API     │    │   Sentiment     │    │   Headlines     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Prerequisites
- **System**: macOS or Linux
- **C Compiler**: `clang` or `gcc`
- **Dependencies**: `libcurl` installed
- **Python**: 3.8+ with pip
- **Node.js**: 16+ with npm
- **API Keys**: NewsAPI and Alpha Vantage (see Environment Setup)

### Install System Dependencies

#### macOS
```bash
brew install curl
```

#### Ubuntu/Debian
```bash
sudo apt-get install libcurl4-openssl-dev
```

## Environment Setup

### Required API Keys
1. **NewsAPI**: Get free API key from [newsapi.org](https://newsapi.org/)
2. **Alpha Vantage**: Get free API key from [alphavantage.co](https://www.alphavantage.co/)

### Environment Variables
Create a `.env` file in the project root:
```bash
# Required for C backend and ML service
export NEWSAPI_KEY=your_newsapi_key_here

# Required for React frontend
export REACT_APP_ALPHA_VANTAGE_KEY=your_alpha_vantage_key_here
```

Load environment variables:
```bash
source .env
```

## Quick Start

### 1. Setup All Services
```bash
# Clone and setup
git clone https://github.com/mattdomingo/newstrader.git
cd newstrader

# Load environment variables
source .env

# Build C backend
make

# Setup Python ML service
cd ml_service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..

# Setup React frontend
cd frontend
npm install
cd ..
```

### 2. Run Services

#### Option A: Run All Services (Recommended)
```bash
# Terminal 1: Start ML service
cd ml_service
source venv/bin/activate
python service.py

# Terminal 2: Start React frontend
cd frontend
npm start

# Terminal 3: Run C backend (optional, for CLI analysis)
./trader
```

#### Option B: Run Individual Services

**C Backend Only:**
```bash
./trader
```

**ML Service Only:**
```bash
cd ml_service
source venv/bin/activate
python service.py
```

**Frontend Only:**
```bash
cd frontend
npm start
```

## Usage

### Web Interface
1. Start both ML service and frontend
2. Open http://localhost:3000
3. View real-time news analysis with sentiment scores and trading recommendations
4. Monitor S&P 500 and Technology sector charts

### Command Line
```bash
./trader
```
Outputs latest 10 tech headlines with sentiment analysis and trading recommendations.

## Project Structure
```
newsTrader/
├── src/                    # C source code
│   ├── main.c             # Main application entry
│   ├── newsapi.c/.h       # NewsAPI integration
│   ├── parser.c/.h        # JSON parsing
│   ├── logic.c/.h         # Trading logic
│   └── ml_wrapper.c/.h    # ML service integration
├── ml_service/            # Python ML service
│   ├── service.py         # Flask API server
│   └── requirements.txt   # Python dependencies
├── frontend/              # React web application
│   ├── src/
│   │   ├── App.js         # Main React component
│   │   └── StockChart.js  # Chart component
│   └── package.json       # Node dependencies
├── Makefile              # C build configuration
└── README.md            # This file
```

## Features

### C Backend
- Fetches latest technology news from NewsAPI
- Basic sentiment analysis and trading recommendations
- Robust error handling and memory management
- Network retry mechanism with timeout

### Python ML Service
- Advanced sentiment analysis using FinBERT model
- SHAP-based explanation of key sentiment drivers
- Full article scraping and analysis
- **Real-time streaming** of analysis results via Server-Sent Events (SSE)
- RESTful API for integration

### React Frontend
- Modern, responsive web interface
- **Real-time news feed** with live progress updates
- Streaming article analysis with progress bars
- Interactive stock charts (S&P 500, Technology sector)
- Error boundaries for graceful failure handling
- Source attribution with favicon display

## API Endpoints
- `GET http://localhost:5000/analyze` - Analyze single headline
- `GET http://localhost:5000/news_analysis` - Get full news analysis (60s timeout)
- `GET http://localhost:5000/news_analysis_stream` - **Real-time streaming** analysis results

## Real-time Features ⚡
The application now supports **live streaming** of news analysis:
- Articles appear one-by-one as they're processed (no waiting for all 10 to finish)
- Real-time progress bars show analysis completion
- Live article count updates: "Latest Tech News (3 articles - updating live...)"
- Automatic fallback to standard mode if streaming fails
- No more timeout issues during ML processing

## Security Notes
- API keys are loaded from environment variables (not hardcoded)
- All sensitive credentials should be kept in `.env` file
- `.env` file is gitignored to prevent accidental commits

## Requirements
- ML service requires ~2GB RAM for FinBERT model loading
- Free tier API limits: NewsAPI (100 requests/day), Alpha Vantage (5 calls/minute)

## Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test all three services
5. Submit a pull request

## License
MIT License - see LICENSE file for details
