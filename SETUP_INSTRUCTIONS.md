# Quick Setup Guide

## 🚀 Get Started in 5 Minutes

### 1. Clone and Setup Environment
```bash
git clone https://github.com/mattdomingo/newstrader.git
cd newstrader
```

### 2. Get API Keys (Free)
- **NewsAPI**: [newsapi.org](https://newsapi.org/) - Free tier: 100 requests/day
- **Alpha Vantage**: [alphavantage.co](https://www.alphavantage.co/) - Free tier: 5 calls/minute

### 3. Configure Environment
```bash
# Create .env file
cat > .env << 'EOF'
export NEWSAPI_KEY=your_newsapi_key_here
export REACT_APP_ALPHA_VANTAGE_KEY=your_alpha_vantage_key_here
EOF

# Edit with your actual API keys
nano .env
```

### 4. Auto Setup (Recommended)
```bash
chmod +x setup.sh
./setup.sh
```

### 5. Run All Services
```bash
./start-all.sh
```

### 6. Access the App
- **Web Interface**: http://localhost:3000
- **ML API**: http://localhost:5000
- **CLI Tool**: `./trader`

## 🎯 Features You'll See
- ✅ **Real-time news streaming** with live progress
- ✅ **AI sentiment analysis** using FinBERT
- ✅ **Stock charts** for S&P 500 and Tech sector
- ✅ **Trading recommendations** based on sentiment
- ✅ **Error-resistant** with graceful fallbacks

## 🛠 Manual Setup (Alternative)
If auto-setup fails, see the detailed instructions in [README.md](README.md).

## 📊 System Requirements
- **Python** 3.8+ with 2GB+ RAM for ML models
- **Node.js** 16+ for React frontend
- **C compiler** (clang/gcc) for backend
- **curl library** for HTTP requests 