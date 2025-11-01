#!/bin/bash

# Smart Email Manager Python Server Startup Script
# This script activates the virtual environment and starts the FastAPI server

echo "🚀 Starting Smart Email Manager Python Server..."

# Navigate to the python-server directory
cd "$(dirname "$0")"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found. Creating one..."
    python3 -m venv venv
    echo "📦 Installing dependencies..."
    source venv/bin/activate
    pip install -r requirements.txt
else
    echo "✅ Virtual environment found"
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Check if .env file exists
if [ ! -f ".env" ] && [ ! -f "../.env" ]; then
    echo "⚠️  Warning: No .env file found. Make sure to create one with your configuration."
    echo "   You can copy env-template.txt and fill in your values."
fi

# Start the server
echo "🌟 Starting FastAPI server on http://localhost:3100"
echo "📚 API documentation available at http://localhost:3100/docs"
echo "🛑 Press Ctrl+C to stop the server"
echo ""

python main.py
