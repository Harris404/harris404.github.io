#!/bin/bash

# Qwen MLX iOS Demo - 真机测试自动化脚本
# 用途: 自动检测连接的 iPhone 设备，构建并部署 App

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目配置
PROJECT_DIR="/Users/paris404/Documents/项目/harris404.github.io/project1/ios-app/QwenMLXiOSDemo"
PROJECT_NAME="QwenMLXiOSDemo"
SCHEME="QwenMLXiOSDemo"
BUNDLE_ID="com.australianassistant.qwendemo"

echo -e "${BLUE}🚀 Qwen MLX iOS Demo - 真机测试脚本${NC}"
echo "=================================================="
echo ""

# 步骤 1: 检查 Xcode 是否安装
echo -e "${YELLOW}📋 检查环境...${NC}"
if ! command -v xcodebuild &> /dev/null; then
    echo -e "${RED}❌ 错误: 未找到 Xcode 命令行工具${NC}"
    echo "请运行: xcode-select --install"
    exit 1
fi

XCODE_VERSION=$(xcodebuild -version | head -n 1)
echo -e "${GREEN}✅ Xcode: $XCODE_VERSION${NC}"
echo ""

# 步骤 2: 列出可用的 iOS 设备
echo -e "${YELLOW}📱 检测连接的设备...${NC}"
DEVICES=$(xcrun xctrace list devices 2>&1 | awk '/== Devices ==/,/== Simulators ==/' | grep -v "Simulator" | grep -v "==" | grep -v "^$" | grep -v "MacBook" | grep -v "Mac mini" | grep -v "Mac Pro" | grep -v "iMac" | grep "(" | head -10)

if [ -z "$DEVICES" ]; then
    echo -e "${RED}❌ 未检测到任何 iPhone/iPad 设备${NC}"
    echo ""
    echo "请确保:"
    echo "  1. iPhone 已通过数据线连接到 Mac"
    echo "  2. iPhone 上已信任此电脑"
    echo "  3. iPhone 已开启开发者模式（设置 → 隐私与安全性 → 开发者模式）"
    echo ""
    echo "可用的模拟器:"
    xcrun xctrace list devices 2>&1 | grep "Simulator" | head -5
    exit 1
fi

echo -e "${GREEN}✅ 检测到以下设备:${NC}"
echo "$DEVICES"
echo ""

# 选择第一个设备（或让用户选择）
DEVICE_NAME=$(echo "$DEVICES" | head -n 1 | sed 's/([^)]*)//g' | xargs)
DEVICE_ID=$(echo "$DEVICES" | head -n 1 | sed -n 's/.*(\([^)]*\)).*/\1/p')

echo -e "${BLUE}🎯 目标设备: $DEVICE_NAME${NC}"
echo -e "${BLUE}   设备 ID: $DEVICE_ID${NC}"
echo ""

# 步骤 3: 清理之前的构建
echo -e "${YELLOW}🧹 清理之前的构建...${NC}"
cd "$PROJECT_DIR"
xcodebuild clean -project "$PROJECT_NAME.xcodeproj" -scheme "$SCHEME" &> /dev/null || true
echo -e "${GREEN}✅ 清理完成${NC}"
echo ""

# 步骤 4: 构建项目
echo -e "${YELLOW}🔨 构建项目...${NC}"
echo "这可能需要几分钟..."

BUILD_LOG="/tmp/qwen_ios_build.log"
xcodebuild build \
    -project "$PROJECT_NAME.xcodeproj" \
    -scheme "$SCHEME" \
    -destination "platform=iOS,id=$DEVICE_ID" \
    -configuration Debug \
    CODE_SIGN_STYLE=Automatic \
    DEVELOPMENT_TEAM="" \
    > "$BUILD_LOG" 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 构建成功${NC}"
else
    echo -e "${RED}❌ 构建失败${NC}"
    echo "详细日志: $BUILD_LOG"
    echo ""
    echo "常见问题:"
    echo "  1. 签名错误 → 在 Xcode 中配置 Apple ID (Xcode → Settings → Accounts)"
    echo "  2. Bundle ID 冲突 → 修改 project.pbxproj 中的 PRODUCT_BUNDLE_IDENTIFIER"
    echo "  3. 设备不支持 → 确保 iPhone 运行 iOS 16+"
    tail -20 "$BUILD_LOG"
    exit 1
fi
echo ""

# 步骤 5: 安装到设备
echo -e "${YELLOW}📲 安装到设备...${NC}"

# 查找生成的 .app 包
APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData -name "$PROJECT_NAME.app" -path "*/Build/Products/Debug-iphoneos/*" | head -n 1)

if [ -z "$APP_PATH" ]; then
    echo -e "${RED}❌ 未找到构建的 App${NC}"
    exit 1
fi

echo "App 路径: $APP_PATH"

# 使用 xcrun 安装
xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH" 2>&1 | tee /tmp/qwen_ios_install.log

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 安装成功${NC}"
else
    echo -e "${YELLOW}⚠️  安装可能遇到问题，请检查 iPhone 屏幕${NC}"
    echo "如果看到 '未受信任的开发者' 提示:"
    echo "  → iPhone: 设置 → 通用 → VPN 与设备管理 → 信任"
fi
echo ""

# 步骤 6: 启动 App
echo -e "${YELLOW}🚀 启动 App...${NC}"
xcrun devicectl device process launch --device "$DEVICE_ID" "$BUNDLE_ID" 2>&1 | tee /tmp/qwen_ios_launch.log

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ App 已启动${NC}"
else
    echo -e "${YELLOW}⚠️  自动启动失败，请手动在 iPhone 上打开 App${NC}"
fi
echo ""

# 步骤 7: 显示测试指南
echo -e "${BLUE}📊 测试指南${NC}"
echo "=================================================="
echo ""
echo "1. 在 iPhone 上查看 App 界面"
echo "2. 点击 '▶️ Start Test' 按钮"
echo "3. 观察以下指标:"
echo "   - Device: 应显示你的 iPhone 型号"
echo "   - MLX Available: 应为 ✅ Yes"
echo "   - Metal GPU: 应为 ✅ Available"
echo "   - Speed: 应 ≥ 10.0 tok/s"
echo "   - Memory: 应 ≤ 3000 MB"
echo ""
echo "4. 记录测试结果到 README.md 底部的 '测试记录模板'"
echo ""

# 步骤 8: 实时日志（可选）
echo -e "${YELLOW}📜 查看实时日志? (y/n)${NC}"
read -t 5 -n 1 VIEW_LOG || VIEW_LOG="n"
echo ""

if [ "$VIEW_LOG" = "y" ]; then
    echo -e "${BLUE}实时日志 (Ctrl+C 停止):${NC}"
    xcrun devicectl device info logs --device "$DEVICE_ID" --style json 2>&1 | grep -i "qwen\|mlx"
fi

echo ""
echo -e "${GREEN}✅ 部署完成！${NC}"
echo ""
echo "下一步:"
echo "  1. 在 iPhone 上测试 App"
echo "  2. 截图保存测试结果"
echo "  3. 记录性能数据"
echo ""
echo "如需重新部署，再次运行此脚本:"
echo "  bash $0"
echo ""
