#!/bin/bash
# 澳洲助手 MCP Servers 安装脚本
# Australian Assistant MCP Servers Installation Script

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}🇦🇺 澳洲助手 MCP Servers 安装程序${NC}"
echo -e "${BLUE}   Australian Assistant MCP Servers Setup${NC}"
echo -e "${BLUE}============================================${NC}\n"

# Get project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MCP_DIR="$PROJECT_ROOT/mcp-servers"

echo -e "${YELLOW}📁 项目路径 / Project root: ${NC}$PROJECT_ROOT"
echo -e "${YELLOW}📦 MCP 安装目录 / MCP directory: ${NC}$MCP_DIR\n"

# Create MCP servers directory if not exists
mkdir -p "$MCP_DIR"
cd "$MCP_DIR"

# Function to print step header
print_step() {
    echo -e "\n${BLUE}==>${NC} ${GREEN}$1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}❌ 错误 / Error: $1${NC}"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Check prerequisites
print_step "检查依赖 / Checking prerequisites..."

if ! command -v git &> /dev/null; then
    print_error "Git 未安装 / Git is not installed"
    exit 1
fi
print_success "Git: 已安装 / Installed"

if ! command -v python3 &> /dev/null; then
    print_error "Python3 未安装 / Python3 is not installed"
    exit 1
fi
print_success "Python3: 已安装 / Installed ($(python3 --version))"

if ! command -v node &> /dev/null; then
    print_error "Node.js 未安装 / Node.js is not installed"
    exit 1
fi
print_success "Node.js: 已安装 / Installed ($(node --version))"

if ! command -v npm &> /dev/null; then
    print_error "npm 未安装 / npm is not installed"
    exit 1
fi
print_success "npm: 已安装 / Installed ($(npm --version))"

# Check for uv (optional but recommended for Python packages)
if ! command -v uv &> /dev/null; then
    echo -e "${YELLOW}⚠️  uv 未安装，将使用 pip / uv not found, will use pip instead${NC}"
    USE_UV=false
else
    print_success "uv: 已安装 / Installed ($(uv --version))"
    USE_UV=true
fi

# Install Python MCP Servers
print_step "1/5 🌤️  安装澳洲天气服务器 / Installing AU Weather MCP..."
if [ -d "au-weather-mcp" ]; then
    echo "已存在，跳过克隆 / Already exists, skipping clone"
    cd au-weather-mcp && git pull && cd ..
else
    git clone https://github.com/craigles75/au-weather-mcp
fi
cd au-weather-mcp
if [ "$USE_UV" = true ]; then
    uv venv && source .venv/bin/activate && uv pip install -e .
else
    pip3 install -e .
fi
cd ..
print_success "AU Weather MCP 安装完成 / AU Weather MCP installed"

print_step "2/5 📊 安装澳洲统计局服务器 (TypeScript) / Installing ABS MCP (TypeScript)..."
if [ -d "mcp-server-abs" ]; then
    echo "已存在，跳过克隆 / Already exists, skipping clone"
    cd mcp-server-abs && git pull && cd ..
else
    git clone https://github.com/seansoreilly/mcp-server-abs
fi
cd mcp-server-abs
npm install
npm run build
cd ..
print_success "ABS MCP (TypeScript) 安装完成 / ABS MCP installed"

print_step "3/5 📊 安装澳洲统计局服务器 (Python + AI) / Installing ABS MCP (Python + AI)..."
if [ -d "abs-mcp-server" ]; then
    echo "已存在，跳过克隆 / Already exists, skipping clone"
    cd abs-mcp-server && git pull && cd ..
else
    git clone https://github.com/sambit04126/abs-mcp-server
fi
cd abs-mcp-server
if [ "$USE_UV" = true ]; then
    uv venv && source .venv/bin/activate && uv pip install -e .
else
    pip3 install -e .
fi
cd ..
print_success "ABS MCP (Python + AI) 安装完成 / ABS MCP Python installed"

print_step "4/5 📮 安装澳洲邮编数据库 / Installing Australian Postcodes MCP..."
if [ -d "australian-postcodes-mcp" ]; then
    echo "已存在，跳过克隆 / Already exists, skipping clone"
    cd australian-postcodes-mcp && git pull && cd ..
else
    git clone https://github.com/jezweb/australian-postcodes-mcp
fi
cd australian-postcodes-mcp
if [ "$USE_UV" = true ]; then
    uv venv && source .venv/bin/activate && uv pip install -r requirements.txt
else
    pip3 install -r requirements.txt
fi
# Import postcode data
echo "导入邮编数据 / Importing postcode data..."
python3 src/utils/data_loader.py
cd ..
print_success "Australian Postcodes MCP 安装完成 / Postcodes MCP installed"

print_step "5/5 🚆 安装新州交通服务器 / Installing Transport NSW MCP..."
if [ -d "transportnsw-mcp" ]; then
    echo "已存在，跳过克隆 / Already exists, skipping clone"
    cd transportnsw-mcp && git pull && cd ..
else
    git clone https://github.com/danhussey/transportnsw-mcp
fi
cd transportnsw-mcp
if [ "$USE_UV" = true ]; then
    uv venv && uv sync
else
    pip3 install -r requirements.txt 2>/dev/null || echo "Using setup.py instead"
    pip3 install -e .
fi
cd ..
print_success "Transport NSW MCP 安装完成 / Transport NSW MCP installed"

# Install TfNSW Realtime Alerts (NPM package - no clone needed)
print_step "🚍 安装新州交通实时告警 (NPM) / Installing TfNSW Realtime Alerts..."
print_success "TfNSW Realtime Alerts 将通过 npx 运行 / Will run via npx (no installation needed)"

# Summary
cd "$PROJECT_ROOT"
echo -e "\n${GREEN}============================================${NC}"
echo -e "${GREEN}✅ 所有 MCP Servers 安装完成！${NC}"
echo -e "${GREEN}   All MCP Servers installed successfully!${NC}"
echo -e "${GREEN}============================================${NC}\n"

echo -e "${BLUE}已安装的服务器 / Installed servers:${NC}"
echo -e "  ✅ AU Weather MCP (BOM)"
echo -e "  ✅ ABS MCP (TypeScript)"
echo -e "  ✅ ABS MCP (Python + AI)"
echo -e "  ✅ Australian Postcodes MCP"
echo -e "  ✅ Transport NSW MCP"
echo -e "  ✅ TfNSW Realtime Alerts (via npx)\n"

echo -e "${YELLOW}下一步 / Next steps:${NC}"
echo -e "  1. 检查 .env 文件中的 API 密钥 / Check API keys in .env file"
echo -e "  2. 配置 Claude Desktop / Configure Claude Desktop"
echo -e "     配置文件位置 / Config location: ./claude-desktop-config.json"
echo -e "  3. 测试 MCP servers / Test MCP servers"
echo -e "     运行 / Run: npm run test:mcp\n"

echo -e "${YELLOW}⚠️  重要提示 / Important:${NC}"
echo -e "  Transport NSW API Key 已设置为: ${GREEN}Paris404${NC}"
echo -e "  Transport NSW API Key is set to: ${GREEN}Paris404${NC}"
echo -e "  如需修改，请编辑 .env 文件 / To change, edit .env file\n"
