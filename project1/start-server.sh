#!/bin/bash

# 🚀 澳洲 AI 助手 — 启动脚本

echo "🇦🇺 Australian AI Assistant v2.0"
echo "=================================="
echo ""

# 检查依赖
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install: https://nodejs.org/"
    exit 1
fi

if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js 16+."
    exit 1
fi

echo "✅ Node.js: $(node --version)"
echo ""

# 选择运行模式
echo "Select mode:"
echo "  1) 🌐 Cloudflare Workers (production — recommended)"
echo "  2) 🖥️  Local development (legacy api-server)"
echo ""
read -p "Enter choice [1/2]: " choice

case $choice in
  1)
    echo ""
    echo "🌐 Starting Cloudflare Workers dev server..."
    echo "   This runs the production backend locally with wrangler."
    echo ""
    echo "   Deploy to production: npm run deploy"
    echo "   View logs:            npm run logs"
    echo ""
    cd cloudflare/api-worker && npx wrangler dev
    ;;
  2)
    echo ""
    echo "⚠️  Starting LEGACY local server (api-server/server.js)"
    echo "   This uses MCP protocol via child processes."
    echo "   For production, use option 1 instead."
    echo ""
    echo "📍 Server will run on http://localhost:3000"
    echo ""

    # 检查 npm 包
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing npm dependencies..."
        npm install
    fi

    node api-server/server.js
    ;;
  *)
    echo "Invalid choice. Usage: ./start-server.sh"
    exit 1
    ;;
esac
