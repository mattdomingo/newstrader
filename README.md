# SimpleNewsTrader

## Overview
A C program that fetches the latest 10 technology industry news headlines from NewsAPI, analyzes each headline for simple trading recommendations (BUY, SELL, HOLD), and prints the results to the command line.

## Prerequisites
- macOS or Linux
- `clang` or `gcc`
- `libcurl` installed

### Install libcurl (macOS)
```bash
brew install curl
```

## Setup
1. Clone the repo:
   ```bash
   git clone <repo_url>
   cd SimpleNewsTrader
   ```
2. Open `src/newsapi.h` and replace `YOUR_API_KEY_HERE` with your NewsAPI key.

## Build
```bash
make
```

## Run
```bash
./trader
```

## Clean
```bash
make clean
```

## Notes
- The program retries once on network failure.
- Timeout for requests is set to 15 seconds.
- Outputs in English only.