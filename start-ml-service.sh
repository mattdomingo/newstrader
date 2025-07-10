#!/bin/bash
# Start ML service with environment variables
source .env
cd ml_service
source venv/bin/activate
python service.py
