# 🇦🇺 澳洲小助手 MCP Servers / Australian Assistant MCP Servers

完整的澳洲数据 MCP 服务器集合，提供天气、统计、交通、邮编等实时数据。

Complete collection of Australian data MCP servers providing weather, statistics, transport, and postcode data.

## 📱 iOS App Testing

**Current Status**: ✅ Ready for Device Testing

- **Backend Services**: All running and verified
- **iOS Integration**: 10/10 MCP services integrated
- **Intent Routing**: Enhanced with 9 detailed examples
- **RAG Quality**: Optimized with similarity filtering

### Quick Start Testing

```bash
# Run pre-flight check
./preflight-check.sh

# Follow testing guide
# See: DEVICE_TESTING_GUIDE.md
```

### Testing Documentation

| Document | Purpose |
|----------|---------|
| 📖 **DEVICE_TESTING_GUIDE.md** | Complete testing guide with 12 test cases |
| 📋 **TEST_RESULTS_TEMPLATE.md** | Template for recording test results |
| 🎯 **QUICK_REFERENCE.md** | Quick reference card for testing |
| 🚀 **preflight-check.sh** | Automated pre-flight verification script |

**Estimated Testing Time**: ~45 minutes

---

## 📦 已安装的 MCP Servers / Installed MCP Servers

| Server | Status | Data Source | API Key Required | Coverage |
|--------|--------|-------------|------------------|----------|
| ✅ **AU Weather** | Working | Bureau of Meteorology (BOM) | ❌ No | Nationwide |
| ✅ **ABS Statistics** | Working | Australian Bureau of Statistics | ❌ No | Nationwide |
| ✅ **Australian Postcodes** | Working | Community Database (18,500+ records) | ❌ No | Nationwide |
| ✅ **Education (CRICOS)** | Working | CRICOS Course Data (20,000+ courses) | ❌ No | Nationwide |
| ✅ **Transport NSW** | Working | Transport for NSW Open Data | ✅ Yes (Configured) | NSW (8.4M, 33%) |
| ✅ **Transport Victoria** | Working | Victoria Transport Open Data (GTFS-RT) | ✅ Yes (Configured) | VIC (6.5M, 26%) |
| ✅ **Transport Queensland** | Working | TransLink GTFS-RT | ❌ No | QLD (5.2M, 21%) |
| ⚠️ **Transport WA** | Stub (No official API) | Static GTFS only | ❌ No | WA (2.8M, 11%) |
| ⚠️ **HealthDirect** | Awaiting API Key | NHSD FHIR R4 | ✅ Yes (Registration pending) | Nationwide (26M, 100%) |
| ✅ **TGA ARTG** | Working | Therapeutic Goods Administration | ❌ No | Nationwide |
| ✅ **Google Places** | Working | Google Places API (New) | ✅ Yes (Setup required) | Worldwide |
| ⏳ **Transport Victoria - PTV** | Ready (Awaiting credentials) | PTV Timetable API | ✅ Yes (Applied) | VIC Enhancement |

**Population Coverage**: 89% (22.9M / 25.7M) - NSW + VIC + QLD + WA

---

## 🚀 快速开始 / Quick Start

### 1. 项目已安装完成 / Installation Complete

所有 MCP servers 已下载并配置完成：

```bash
mcp-servers/
├── au-weather-mcp/          # ✅ 天气数据
├── mcp-server-abs/          # ✅ 统计数据  
├── australian-postcodes-mcp/ # ✅ 邮编数据
├── education-mcp-server/    # ✅ 教育课程数据
├── transportnsw-mcp/        # ⚠️ 交通数据
└── [tfnsw-realtime-alerts]  # ✅ Via npx (无需下载)
```
mcp-servers/
├── au-weather-mcp/          # ✅ 天气数据
├── mcp-server-abs/          # ✅ 统计数据  
├── australian-postcodes-mcp/ # ✅ 邮编数据
├── transportnsw-mcp/        # ⚠️ 交通数据
└── [tfnsw-realtime-alerts]  # ✅ Via npx (无需下载)
```

### 2. API 密钥配置 / API Key Configuration

**Transport NSW API Key** 已设置为: `Paris404`

配置文件 / Config file: `.env`

```bash
NSW_TRANSPORT_API_KEY=Paris404
OPEN_TRANSPORT_API_KEY=Paris404
```

### 2.5 Google Places API 配置 (POI搜索必需) / Google Places API Setup

要启用附近餐厅/超市/咖啡厅搜索功能，需要配置 Google Places API:

**获取步骤 / Setup Steps:**

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 **Places API (New)** - 前往 APIs & Services > Enable APIs > Search "Places API (New)"
4. 创建 API 密钥 - APIs & Services > Credentials > Create Credentials > API Key
5. (可选) 限制 API 密钥只能用于 Places API

**配置密钥 / Configure Key:**

编辑 `.env` 文件:

```bash
# Google Places API (For POI/restaurant search)
GOOGLE_PLACES_API_KEY=your_api_key_here
```

**价格 / Pricing:**
- 免费额度: $200/月 (约 5000 次搜索)
- 超出后: $17-40/1000 次 (根据查询类型)

**验证配置 / Verify Setup:**

```bash
curl -s "http://localhost:3000/mcp/places/nearby?lat=-33.8688&lng=151.2093&query=restaurant&radius=500"
```

### 3. Claude Desktop 配置 / Claude Desktop Configuration

配置文件已生成: `claude-desktop-config.json`

**安装到 Claude Desktop:**

```bash
# macOS
cp claude-desktop-config.json ~/Library/Application\ Support/Claude/claude_desktop_config.json

# 或手动复制内容到Claude Desktop配置文件
```

**重启 Claude Desktop** 以加载 MCP servers。

---

## 🧪 测试结果 / Test Results

运行测试 / Run tests:

```bash
npm run test:mcp
```

**最新测试结果 / Latest Test Results:**

```
✅ AU Weather MCP          - PASS
✅ ABS Statistics          - PASS  
✅ Australian Postcodes    - PASS
⚠️ Transport NSW           - Configured (requires manual testing in Claude)
```

---

## 📚 功能说明 / Features

### 🌤️ AU Weather MCP

**提供 / Provides:**
- 任意澳洲城市/邮编的天气查询
- 每日天气预报
- 3小时详细预报
- 实时气象观测（温度、湿度、风速）

**示例查询 / Example queries:**
- "悉尼今天天气怎么样？"
- "What's the weather in Melbourne?"
- "Perth 7-day forecast"

### 📊 ABS Statistics MCP

**提供 / Provides:**
- Consumer Price Index (CPI) - 物价指数
- Rental prices - 房租数据
- Employment statistics - 就业数据
- Population data - 人口统计
- Economic indicators - 经济指标

**示例查询 / Example queries:**
- "澳洲当前通胀率是多少？"
- "What's the unemployment rate in NSW?"
- "Sydney rental prices trend"

### 📮 Australian Postcodes MCP

**提供 / Provides:**
- 邮编 ↔ 城市名称互查
- 18,500+ 邮编/城市数据
- 模糊匹配（支持拼写错误）
- 地理半径搜索
- LGA (地方政府区域) 查询

**示例查询 / Example queries:**
- "2000 邮编是哪里？"
- "What's the postcode for Bondi Beach?"
- "Find postcodes near Sydney CBD"
### 🎓 Education (CRICOS) MCP

**提供 / Provides:**
- 课程搜索（20,000+ 澳洲教育课程）
- 院校信息查询（1,200+ CRICOS 注册院校）
- 课程详细信息（学费、时长、专业领域）
- 按院校类型和州过滤（University, TAFE, Private）

**示例查询 / Example queries:**
- "想找悠尼的计算机科学本科课程"
- "Search for Master's programs in Melbourne"
- "What universities offer business courses in NSW?"


### 🚆 Transport NSW MCP

**提供 / Provides:**
- 按名称/GPS坐标查找站点
- 实时到站时间
- 服务告警和中断信息
- 支持火车、公交、渡轮

**API Key:** 已配置为 `Paris404`

**示例查询 / Example queries:**
- "Central Station 的实时到站信息"
- "Find bus stops near Circular Quay"
- "Are there any service disruptions?"

### 🚍 TfNSW Realtime Alerts

**提供 / Provides:**
- 实时服务中断告警
- 计划维护通知
- 按交通方式过滤（火车、公交、渡轮、轻轨）

**API Key:** 已配置为 `Paris404`

---

## 🛠️ 技术栈 / Tech Stack

| Component | Technology |
|-----------|-----------|
| **AU Weather** | Python + MCP SDK |
| **ABS Statistics** | TypeScript/Node.js + MCP SDK |
| **Postcodes** | Python + FastMCP + SQLite |
| **Education** | Python + FastMCP + Pandas |
| **Transport NSW** | Python + FastMCP |
| **TfNSW Alerts** | NPM Package (TypeScript) |
|-----------|-----------|
| **AU Weather** | Python + MCP SDK |
| **ABS Statistics** | TypeScript/Node.js + MCP SDK |
| **Postcodes** | Python + FastMCP + SQLite |
| **Transport NSW** | Python + FastMCP |
| **TfNSW Alerts** | NPM Package (TypeScript) |

---

## 📁 项目结构 / Project Structure

```
project1/
├── mcp-servers/                 # MCP服务器源码 / MCP server sources
│   ├── au-weather-mcp/
│   ├── mcp-server-abs/
│   ├── abs-mcp-server/         # (需要Python 3.11+)
│   ├── australian-postcodes-mcp/
│   ├── education-mcp-server/
│   └── transportnsw-mcp/
├── api-server/                  # REST API 服务器 / REST API server
│   └── server.js
├── xcode-app/                   # iOS/macOS 客户端 / iOS/macOS client
│   └── AustralianAssistant/
├── scripts/                     # 工具脚本 / Utility scripts
│   ├── install-mcp-servers.sh  # 安装脚本
│   └── test-mcp-servers.js     # 测试脚本
├── .env                         # API密钥配置
project1/
├── mcp-servers/                 # MCP服务器源码 / MCP server sources
│   ├── au-weather-mcp/
│   ├── mcp-server-abs/
│   ├── abs-mcp-server/         # (需要Python 3.11+)
│   ├── australian-postcodes-mcp/
│   └── transportnsw-mcp/
├── scripts/                     # 工具脚本 / Utility scripts
│   ├── install-mcp-servers.sh  # 安装脚本
│   └── test-mcp-servers.js     # 测试脚本
├── .env                         # API密钥配置
├── .env.template               # 配置模板
├── package.json                # Node.js配置
├── requirements.txt            # Python依赖
├── claude-desktop-config.json  # Claude配置
└── README.md                   # 本文档
```

---

## ⚙️ 系统要求 / System Requirements

- **Node.js:** v20.20.0 或更高 / or higher
- **Python:** 3.10.8 或更高 / or higher (Python 3.11+ for ABS Python version)
- **npm:** 10.8.2 或更高 / or higher
- **Git:** 已安装 / Installed

---

## 🔑 获取 Transport NSW API Key / Get Transport NSW API Key

如需创建新的 API Key:

1. 访问 / Visit: https://opendata.transport.nsw.gov.au/
2. 注册免费开发者账户 / Register free developer account
3. 进入 Profile → API Keys
4. 创建应用 → 复制API密钥 / Create Application → Copy API key
5. 更新 `.env` 文件 / Update `.env` file

**当前已配置的 API Key / Currently configured API Key:** `Paris404`

---

## 🚨 故障排除 / Troubleshooting

### MCP Server 无法启动 / Server won't start

检查依赖是否安装 / Check dependencies:

```bash
# Python servers
pip3 list | grep mcp
pip3 list | grep fastmcp

# Node.js servers
cd mcp-servers/mcp-server-abs && npm list
```

### Claude Desktop 看不到 MCP Servers

1. 确认配置文件位置正确 / Verify config file location
2. 重启 Claude Desktop / Restart Claude Desktop
3. 检查 Claude 日志 / Check Claude logs:
   - macOS: `~/Library/Logs/Claude/`

### Transport NSW API 返回错误

1. 确认 API Key 有效 / Verify API key is valid
2. 检查 `.env` 文件配置 / Check `.env` configuration
3. 访问 Transport NSW 开发者门户确认额度 / Check quota on developer portal

---

## 📊 可用数据类型 / Available Data Types

### Weather (BOM)
- Current observations
- Daily forecasts (7 days)
- 3-hourly detailed forecasts
- Temperature, humidity, wind, rainfall

### Statistics (ABS)
- CPI (Consumer Price Index)
- Housing & rental prices
- Employment & unemployment
- Population & demographics
- Economic indicators

### Education (CRICOS)
- 20,000+ courses from Australian institutions
- 1,200+ CRICOS-registered providers
- Course details (fees, duration, field of education)
- Institution types (University, TAFE, Private College)
- Filter by state, course level

### Transport (NSW)
- Real-time arrivals
- Service alerts & disruptions
- Planned maintenance
- Station/stop locations
- Trip planning (limited)

### Postcodes
- 18,500+ Australian postcodes
- Suburb/locality names
- State information
- LGA (Local Government Area)
- Geographic coordinates
- Current observations
- Daily forecasts (7 days)
- 3-hourly detailed forecasts
- Temperature, humidity, wind, rainfall

### Statistics (ABS)
- CPI (Consumer Price Index)
- Housing & rental prices
- Employment & unemployment
- Population & demographics
- Economic indicators

### Transport (NSW)
- Real-time arrivals
- Service alerts & disruptions
- Planned maintenance
- Station/stop locations
- Trip planning (limited)

### Postcodes
- 18,500+ Australian postcodes
- Suburb/locality names
- State information
- LGA (Local Government Area)
- Geographic coordinates

---

## 🌟 使用示例 / Usage Examples

在 Claude Desktop 中，你现在可以问：

In Claude Desktop, you can now ask:

### 天气查询 / Weather Queries
```
"悉尼今天会下雨吗？"
"What's the weather like in Brisbane this week?"
"Perth temperature forecast for next 3 days"
```

### 统计查询 / Statistics Queries
```
"澳洲当前的通胀率是多少？"
"Show me rental price trends in Melbourne"
"What's the population of Adelaide?"
```

### 交通查询 / Transport Queries
```
"Central Station有什么服务中断吗？"
"When is the next train from Town Hall?"
"Are there any bus delays in Sydney?"
```

### 邮编查询 / Postcode Queries
```
"2000是悠尼哪个区？"
"What's the postcode for Bondi Beach?"
"Find all suburbs in the 3000 postcode area"
```

### 教育查询 / Education Queries
```
"悠尼有哪些计算机科学本科课程？"
"Show me Master's programs in Business at Melbourne universities"
"What's the tuition fee for course code 012345G?"
"List all TAFEs in Queensland"
```
```
"2000是悠尼哪个区？"
"What's the postcode for Bondi Beach?"
"Find all suburbs in the 3000 postcode area"
```
"2000是悉尼哪个区？"
"What's the postcode for Bondi Beach?"
"Find all suburbs in the 3000 postcode area"
```

---

## 🔄 更新 MCP Servers / Update MCP Servers

定期更新以获取最新功能 / Update regularly for new features:

```bash
cd mcp-servers

# Update AU Weather
cd au-weather-mcp && git pull && pip3 install -e . && cd ..

# Update ABS (TypeScript)
cd mcp-server-abs && git pull && npm install && npm run build && cd ..

# Update Education
cd education-mcp-server && git pull && pip3 install -r requirements.txt && cd ..

# Update Postcodes
cd australian-postcodes-mcp && git pull && pip3 install -r requirements.txt && cd ..

# Update Transport NSW
cd transportnsw-mcp && git pull && pip3 install -e . && cd ..
```
cd mcp-servers

# Update AU Weather
cd au-weather-mcp && git pull && pip3 install -e . && cd ..

# Update ABS (TypeScript)
cd mcp-server-abs && git pull && npm install && npm run build && cd ..

# Update Postcodes
cd australian-postcodes-mcp && git pull && pip3 install -r requirements.txt && cd ..

# Update Transport NSW
cd transportnsw-mcp && git pull && pip3 install -e . && cd ..
```

---

## 📝 License

Each MCP server has its own license:
- AU Weather MCP: MIT
- ABS MCP Server: MIT
- Australian Postcodes MCP: MIT
- Education MCP Server: MIT
- Transport NSW MCP: MIT
- TfNSW Realtime Alerts: MIT
- AU Weather MCP: MIT
- ABS MCP Server: MIT
- Australian Postcodes MCP: MIT
- Education MCP Server: MIT
- Transport NSW MCP: MIT
- TfNSW Realtime Alerts: MIT
- AU Weather MCP: MIT
- ABS MCP Server: MIT
- Australian Postcodes MCP: MIT
- Transport NSW MCP: MIT
- TfNSW Realtime Alerts: MIT

---

## 🤝 贡献 / Contributing

本项目整合了以下开源项目 / This project integrates:
- [craigles75/au-weather-mcp](https://github.com/craigles75/au-weather-mcp)
- [seansoreilly/mcp-server-abs](https://github.com/seansoreilly/mcp-server-abs)
- [sambit04126/abs-mcp-server](https://github.com/sambit04126/abs-mcp-server)
- [jezweb/australian-postcodes-mcp](https://github.com/jezweb/australian-postcodes-mcp)
- [danhussey/transportnsw-mcp](https://github.com/danhussey/transportnsw-mcp)
- [piddlingtuna/tfnsw-realtime-alerts-mcp-server](https://github.com/piddlingtuna/tfnsw-realtime-alerts-mcp-server)

请向原项目贡献 / Please contribute to the original projects.

---

## 📞 Support

如有问题 / For issues:
1. 检查本 README 故障排除部分 / Check Troubleshooting section
2. 查看各 MCP server 的 GitHub Issues
3. 访问 Transport NSW 开发者支持 / Visit Transport NSW developer support

---

## ✨ 致谢 / Acknowledgments

感谢所有 MCP server 的原作者和维护者！

Thanks to all original authors and maintainers of the MCP servers!

**Data Sources:**
- Bureau of Meteorology (BOM)
- Australian Bureau of Statistics (ABS)
- Transport for NSW Open Data
- Community-maintained postcode database

---

**🎉 享受你的澳洲小助手！/ Enjoy your Australian Assistant!**
