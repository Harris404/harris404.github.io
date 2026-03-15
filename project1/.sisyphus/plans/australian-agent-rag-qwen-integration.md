# 澳洲 Agent 完整实施计划：RAG 数据 + Qwen 模型集成

## TL;DR

> **Quick Summary**: 在现有 7 个 MCP 服务器基础上，扩展 API 覆盖率（58%→89% 人口），构建 RAG 静态知识库（政府服务、医疗、教育），集成 Qwen2.5-1.5B 模型到 iOS App，实现生产级澳洲生活助手。
> 
> **Deliverables**:
> - Queensland + WA 交通 MCP 服务器（新增 2 个）
> - 医疗服务 HealthDirect MCP 服务器（新增 1 个）
> - RAG 静态数据库（100MB，政府/医疗/教育知识）
> - Qwen2.5-1.5B-Q8 iOS 集成（MLX 框架）
> - iOS App MVP（聊天界面 + Agent 系统 + RAG 检索）
> 
> **Estimated Effort**: Large (10-13 周，单人或 2 人团队)  
> **Parallel Execution**: YES - 5 waves  
> **Critical Path**: Wave 1 (API) → Wave 2 (RAG) → Wave 3 (Qwen) → Wave 4 (iOS) → Wave 5 (优化)

---

## Context

### Original Request
用户询问：
1. 还有哪些澳洲领域的静态数据需要获取来构成 RAG？
2. API 获取的数据源是否足够？
3. 如果要构建澳洲 agent 的话，接下来应该如何选择和构建 Qwen 模型？

### Interview Summary
**Key Discussions**:
- 用户已有 7 个 MCP 服务器（天气、统计、邮编、教育、NSW/VIC 交通）
- 目标：iOS App + 本地 Qwen 模型 + MCP 工具调用
- 当前人口覆盖：58%（NSW + VIC）
- 用户希望生成完整工作计划

**Research Findings**:
- Qwen2.5 系列适合 iOS 部署（1.5B 模型最佳平衡）
- MLX 框架为 Apple Silicon 优化首选
- RAG 数据需求：政府服务（Medicare/ATO）、医疗设施、租赁法规
- API 缺口：QLD/WA 交通、医疗服务

### Metis Review
**Identified Gaps** (addressed):
- 缺少具体的 API 端点 URL 和文档链接 → 已添加到 References
- 未明确 iOS 最低系统版本要求 → iOS 16+（支持 MLX）
- RAG 数据更新频率未定义 → 添加到 Must Have
- Qwen 模型下载来源未说明 → 添加到 References

---

## Work Objectives

### Core Objective
在现有 MCP 系统基础上，通过扩展 API 覆盖、构建 RAG 知识库、集成 Qwen 本地模型，打造生产级澳洲生活助手 iOS App，实现 89% 人口覆盖和离线 AI Agent 能力。

### Concrete Deliverables
1. **TransLink Queensland MCP 服务器** - `/mcp-servers/transport-qld/server.py`
2. **Transperth WA MCP 服务器** - `/mcp-servers/transport-wa/server.py`
3. **HealthDirect MCP 服务器** - `/mcp-servers/healthcare-au/server.py`
4. **RAG 静态数据库** - `/ios-app/rag-data/australian-knowledge.db` (SQLite-VSS, ~100MB)
5. **Qwen MLX 模型** - `/ios-app/models/Qwen2.5-1.5B-Instruct-Q8.mlx` (1.7GB)
6. **iOS App MVP** - `/ios-app/AustralianAgent/` (Swift + SwiftUI)

### Definition of Done
- [ ] 运行 `npm run test:mcp` → 所有 10 个 MCP 服务器通过测试
- [ ] 运行 `python scripts/test_rag.py` → RAG 检索准确率 ≥ 90%
- [ ] iOS App 在 iPhone 14 上冷启动 < 2 秒
- [ ] Qwen 模型推理速度 ≥ 10 tokens/s (iPhone 14)
- [ ] 集成测试：用户问"如何申请 Medicare？" → 返回正确 RAG 内容
- [ ] 集成测试：用户问"悉尼天气？" → 调用 BOM API 返回实时数据

### Must Have
- **API 覆盖率** ≥ 89% 澳洲人口（NSW + VIC + QLD + WA）
- **RAG 数据更新机制**：每月自动检查更新（App 后台下载）
- **离线模式**：无网络时仍可使用 RAG 知识和 Qwen 对话
- **中英双语**：UI 和模型响应支持中文和英文
- **隐私优先**：所有 AI 推理本地完成，不上传用户数据

### Must NOT Have (Guardrails)
- **不使用云端 LLM**（GPT-4/Claude）- 必须本地 Qwen
- **不集成付费 API**（Domain/CoreLogic）- 仅使用免费数据源
- **不添加社交功能**（用户评论/分享）- 专注核心功能
- **不支持 iOS 15 及以下**（MLX 需要 iOS 16+）
- **不过度抽象**：MCP 服务器保持简单直接，不引入复杂框架

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — 所有验证通过自动化测试和工具执行

### Test Decision
- **Infrastructure exists**: YES（已有 Node.js + Python 测试环境）
- **Automated tests**: Tests-after（先实现，后补测试）
- **Framework**: pytest（Python MCP）, XCTest（iOS App）

### QA Policy
每个任务必须包含 agent-executed QA scenarios。
Evidence 保存到 `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`。

- **MCP API 测试**: 使用 Bash (curl) 发送请求，验证响应格式
- **RAG 检索测试**: 使用 Bash (python script) 查询数据库，验证结果
- **iOS App 测试**: 使用 Interactive Bash (tmux + xcodebuild) 编译运行
- **Qwen 推理测试**: 使用 Bash (python MLX script) 测试生成速度

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (API 扩展 - 可并行，1-2 周):
├── Task 1: TransLink QLD MCP 服务器 [deep]
├── Task 2: Transperth WA MCP 服务器 [deep]
├── Task 3: HealthDirect 医疗 MCP 服务器 [unspecified-high]
└── Task 4: REST API 集成和测试 [quick]

Wave 2 (RAG 数据准备 - 需 Wave 1 完成，1-2 周):
├── Task 5: 收集政府服务文档（Medicare/ATO/签证）[unspecified-high]
├── Task 6: 收集医疗设施数据（医院/诊所/药房）[unspecified-high]
├── Task 7: 收集租赁法律文档（NSW/VIC/QLD/WA）[unspecified-high]
├── Task 8: 数据清洗和结构化（Markdown → JSON）[unspecified-high]
└── Task 9: BGE-small Embedding 生成和 SQLite-VSS 导入 [deep]

Wave 3 (Qwen 模型集成 - 可与 Wave 2 并行，2-3 周):
├── Task 10: 下载 Qwen2.5-1.5B-Instruct 原始模型 [quick]
├── Task 11: 转换为 MLX 格式（mlx-lm convert）[unspecified-high]
├── Task 12: 创建 iOS Demo 项目（MLX Swift 集成）[visual-engineering]
├── Task 13: Function calling 测试（工具调用解析）[deep]
└── Task 14: 性能基准测试（速度/内存/电池）[unspecified-high]

Wave 4 (iOS App 开发 - 需 Wave 2 + Wave 3 完成，4-5 周):
├── Task 15: SwiftUI 聊天界面（消息列表 + 输入框）[visual-engineering]
├── Task 16: MCP 客户端（URLSession + Async/Await）[deep]
├── Task 17: RAG 检索逻辑（SQLite-VSS 查询 + 重排序）[deep]
├── Task 18: Agent 系统（查询分类 + 路由决策）[ultrabrain]
├── Task 19: 工具调用执行器（JSON 解析 → API 调用）[deep]
├── Task 20: 多轮对话管理（会话历史 + 上下文窗口）[deep]
└── Task 21: 地图集成（显示交通/医院位置）[visual-engineering]

Wave 5 (优化和发布 - 需 Wave 4 完成，2-3 周):
├── Task 22: 性能优化（模型量化、缓存、启动速度）[ultrabrain]
├── Task 23: 电池消耗优化（后台推理限制）[unspecified-high]
├── Task 24: Beta 测试（TestFlight 10-20 用户）[unspecified-high]
├── Task 25: Bug 修复和用户反馈迭代 [unspecified-high]
└── Task 26: App Store 发布准备（截图、描述、隐私政策）[writing]

Wave FINAL (独立评审 - 4 个并行任务):
├── Task F1: 计划合规性审计（oracle）
├── Task F2: 代码质量审查（unspecified-high）
├── Task F3: 真实用户 QA（unspecified-high）
└── Task F4: 范围保真度检查（deep）

Critical Path: T1-T4 → T5-T9 → T10-T14 → T15-T21 → T22-T26 → F1-F4
Parallel Speedup: ~50% 比完全串行
Max Concurrent: 4 (Wave 1), 5 (Wave 2), 5 (Wave 3)
```

### Dependency Matrix

- **T1-T4**: — → T5-T9 (API 完成后才能测试集成)
- **T5-T9**: T4 → T17 (RAG 数据准备后才能集成检索)
- **T10-T14**: — → T15-T21 (Qwen 可与 Wave 2 并行)
- **T15-T21**: T9, T14 → T22-T26 (iOS 需要 RAG + Qwen)
- **T22-T26**: T21 → F1-F4 (优化后才能最终评审)

### Agent Dispatch Summary

- **Wave 1**: 4 任务 → T1-T2 `deep`, T3 `unspecified-high`, T4 `quick`
- **Wave 2**: 5 任务 → T5-T8 `unspecified-high`, T9 `deep`
- **Wave 3**: 5 任务 → T10 `quick`, T11 `unspecified-high`, T12 `visual-engineering`, T13 `deep`, T14 `unspecified-high`
- **Wave 4**: 7 任务 → T15 `visual-engineering`, T16-T17 `deep`, T18 `ultrabrain`, T19-T20 `deep`, T21 `visual-engineering`
- **Wave 5**: 5 任务 → T22 `ultrabrain`, T23-T25 `unspecified-high`, T26 `writing`
- **FINAL**: 4 任务 → F1 `oracle`, F2-F3 `unspecified-high`, F4 `deep`

---

## TODOs

### Wave 1: API 扩展

- [ ] 1. 创建 TransLink Queensland MCP 服务器

  **What to do**:
  - 参考 NSW/VIC Transport 实现结构
  - 使用 GTFS-RT 格式（与 VIC Open Data 类似）
  - 实现 3 个工具：`get_qld_departures`, `get_qld_vehicles`, `get_qld_alerts`
  - 配置 API 密钥（从 data.qld.gov.au 申请）
  - 集成到 REST API server（3 个新端点）

  **Must NOT do**:
  - 不实现路线规划功能（仅实时数据）
  - 不添加历史数据查询（仅当前状态）
  - 不过度抽象（保持与 NSW/VIC 一致的简单结构）

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 需要理解 GTFS-RT 协议和 TransLink API 文档，参考现有实现
  - **Skills**: []
    - Reason: 不需要特殊技能，纯后端 API 开发

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4)
  - **Blocks**: Task 4 (REST API 集成需要等 MCP 服务器完成)
  - **Blocked By**: None (可立即开始)

  **References**:
  - Pattern: `/mcp-servers/transport-vic-opendata/server.py` (GTFS-RT 参考实现)
  - API Docs: https://www.data.qld.gov.au/dataset/general-transit-feed-specification-gtfs-seq
  - TransLink Developer Portal: https://translink.com.au/about-translink/reporting-and-planning/open-data
  - GTFS-RT Specification: https://gtfs.org/realtime/reference/

  **Acceptance Criteria**:
  - [ ] 文件创建：`mcp-servers/transport-qld/server.py` 存在
  - [ ] MCP 工具数量：3 个（departures, vehicles, alerts）
  - [ ] 环境变量配置：`.env` 中 `QLD_TRANSPORT_API_KEY` 已设置
  - [ ] 依赖安装：`mcp-servers/transport-qld/requirements.txt` 存在且安装成功

  **QA Scenarios**:
  ```
  Scenario: 查询布里斯班 CBD 公交实时到站
    Tool: Bash (curl)
    Preconditions: 
      - QLD Transport API 密钥已配置
      - MCP 服务器通过 `python server.py` 启动成功
    Steps:
      1. curl -X POST http://localhost:8080/tools/get_qld_departures \
         -H "Content-Type: application/json" \
         -d '{"transport_mode":"bus","limit":5}'
      2. 验证响应包含 "departures" 字段（数组类型）
      3. 验证至少返回 1 条记录（如果当前有运行车辆）
      4. 验证每条记录包含：route_id, trip_id, arrival_time
    Expected Result: HTTP 200，返回 JSON 格式的到站数据，无错误
    Failure Indicators: HTTP 500, 空数组且实际有车运行, 缺少必需字段
    Evidence: .sisyphus/evidence/task-1-qld-departures.json

  Scenario: API 密钥错误时的优雅处理
    Tool: Bash (curl)
    Preconditions: 临时修改 .env 中 API 密钥为无效值
    Steps:
      1. curl -X POST http://localhost:8080/tools/get_qld_departures \
         -d '{"transport_mode":"bus"}'
      2. 验证响应包含 "error" 字段
      3. 验证错误消息清晰说明认证失败
    Expected Result: HTTP 401 或包含错误信息的 JSON，不崩溃
    Failure Indicators: 服务器崩溃、返回 HTML 而非 JSON、无错误信息
    Evidence: .sisyphus/evidence/task-1-qld-auth-error.json
  ```

  **Evidence to Capture**:
  - [ ] task-1-qld-departures.json (成功响应示例)
  - [ ] task-1-qld-auth-error.json (错误处理示例)

  **Commit**: YES
  - Message: `feat(transport): add TransLink Queensland MCP server`
  - Files: `mcp-servers/transport-qld/`, `.env`
  - Pre-commit: `python -m pytest mcp-servers/transport-qld/tests/ -v`

---

- [ ] 2. 创建 Transperth WA MCP 服务器

  **What to do**:
  - 实现珀斯（Perth）公共交通实时数据
  - 支持火车（Train）、公交（Bus）、渡轮（Ferry）
  - 实现 3 个工具：`get_wa_departures`, `get_wa_vehicles`, `get_wa_alerts`
  - 集成到 REST API server

  **Must NOT do**:
  - 不添加计划行程功能（仅实时查询）
  - 不实现票价计算（超出范围）

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 与 Task 1 类似，但 Transperth API 可能格式不同
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4)
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:
  - Pattern: `/mcp-servers/transport-nsw/server.py` (REST API 参考)
  - API Docs: https://www.transperth.wa.gov.au/About-Transperth/Data-and-Research
  - Transperth Open Data: https://www.pta.wa.gov.au/news/media-statements/open-data-released-by-public-transport-authority

  **Acceptance Criteria**:
  - [ ] 文件创建：`mcp-servers/transport-wa/server.py`
  - [ ] MCP 工具数量：3 个
  - [ ] 环境变量：`.env` 中 `WA_TRANSPORT_API_KEY`
  - [ ] curl 测试成功：Perth CBD 公交到站数据

  **QA Scenarios**:
  ```
  Scenario: 查询 Perth Station 火车实时到站
    Tool: Bash (curl)
    Preconditions: WA Transport API 密钥已配置
    Steps:
      1. curl -X POST http://localhost:8080/tools/get_wa_departures \
         -d '{"transport_mode":"train","station":"Perth Station","limit":3}'
      2. 验证返回 3 条记录
      3. 验证包含 line_name（线路名）和 destination（目的地）
    Expected Result: 返回珀斯火车实时数据
    Evidence: .sisyphus/evidence/task-2-wa-train.json

  Scenario: 空结果时的友好处理
    Tool: Bash (curl)
    Preconditions: 查询一个没有服务的时间段（凌晨 3 点）
    Steps:
      1. curl -X POST http://localhost:8080/tools/get_wa_departures \
         -d '{"transport_mode":"bus","time":"03:00"}'
      2. 验证返回 {"departures": [], "count": 0, "message": "No services"}
    Expected Result: 空数组但包含友好提示
    Evidence: .sisyphus/evidence/task-2-wa-empty.json
  ```

  **Commit**: YES
  - Message: `feat(transport): add Transperth WA MCP server`
  - Files: `mcp-servers/transport-wa/`

---

- [ ] 3. 创建 HealthDirect 医疗服务 MCP 服务器

  **What to do**:
  - 使用 HealthDirect API（免费但需注册）
  - 实现 4 个工具：
    - `search_health_services`：搜索医院/诊所
    - `find_bulk_billing_gp`：查找 bulk billing 全科医生
    - `search_pharmacies`：查找药房
    - `get_health_directory`：获取健康服务目录
  - 支持地理位置过滤（suburb, postcode, GPS）
  - 集成到 REST API server

  **Must NOT do**:
  - 不实现症状检查器（HealthDirect 有专门 API，但超出范围）
  - 不提供医疗建议（仅提供设施信息）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 中等复杂度，但不涉及复杂算法
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:
  - API Docs: https://developer.healthdirect.gov.au/
  - HealthDirect Service Finder API: https://api.healthdirect.gov.au/v0/service/search
  - OAuth2 认证文档: https://developer.healthdirect.gov.au/auth

  **Acceptance Criteria**:
  - [ ] 文件创建：`mcp-servers/healthcare-au/server.py`
  - [ ] MCP 工具数量：4 个
  - [ ] 环境变量：`.env` 中 `HEALTHDIRECT_API_KEY`
  - [ ] 测试查询：悉尼 2000 邮编的 bulk billing 诊所

  **QA Scenarios**:
  ```
  Scenario: 查找悉尼 CBD bulk billing 诊所
    Tool: Bash (curl)
    Preconditions: HealthDirect API 密钥已申请并配置
    Steps:
      1. curl -X POST http://localhost:8080/tools/find_bulk_billing_gp \
         -d '{"postcode":"2000","radius_km":5}'
      2. 验证返回包含 "clinics" 数组
      3. 验证每个诊所包含：name, address, phone, bulk_billing: true
      4. 验证地理距离计算正确（距离 2000 邮编中心 ≤ 5km）
    Expected Result: 返回 5-10 家诊所列表
    Evidence: .sisyphus/evidence/task-3-bulk-billing.json

  Scenario: GPS 坐标查询附近药房
    Tool: Bash (curl)
    Preconditions: 使用悉尼歌剧院坐标测试
    Steps:
      1. curl -X POST http://localhost:8080/tools/search_pharmacies \
         -d '{"latitude":-33.8568,"longitude":151.2153,"radius_km":2}'
      2. 验证返回药房包含营业时间字段
      3. 验证距离从近到远排序
    Expected Result: 返回最近的 3-5 家药房
    Evidence: .sisyphus/evidence/task-3-pharmacies-gps.json
  ```

  **Commit**: YES
  - Message: `feat(healthcare): add HealthDirect MCP server`
  - Files: `mcp-servers/healthcare-au/`

---

- [ ] 4. REST API 集成和端点测试

  **What to do**:
  - 修改 `api-server/server.js`
  - 添加 10 个新端点（QLD 3 + WA 3 + Healthcare 4）
  - 更新 MCP 服务器配置列表
  - 运行 `npm run test:mcp` 验证所有 10 个新旧服务器
  - 更新 README.md 端点列表（22 → 32）

  **Must NOT do**:
  - 不修改现有 NSW/VIC 端点逻辑
  - 不添加额外中间件（保持简单）

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 简单的配置和路由添加，无复杂逻辑
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO（需要等 Tasks 1-3 完成）
  - **Parallel Group**: Sequential after Wave 1
  - **Blocks**: Wave 2 tasks (RAG 需要测试 API 可用性)
  - **Blocked By**: Tasks 1, 2, 3

  **References**:
  - File: `/api-server/server.js` lines 55-445 (现有 MCP 配置和端点)
  - Pattern: `/api-server/server.js` lines 371-445 (Victoria 端点实现参考)

  **Acceptance Criteria**:
  - [ ] `api-server/server.js` 新增 10 个 POST 端点
  - [ ] 配置对象新增 3 个 MCP 服务器：`transport_qld`, `transport_wa`, `healthcare_au`
  - [ ] 运行 `npm start` → 显示 "32 endpoints loaded"
  - [ ] `npm run test:mcp` → 10/10 MCP 服务器测试通过

  **QA Scenarios**:
  ```
  Scenario: 端点注册验证
    Tool: Bash
    Preconditions: api-server 已启动
    Steps:
      1. node api-server/server.js &
      2. sleep 2  # 等待启动
      3. curl http://localhost:3000/api/health | jq '.endpoints_count'
      4. 验证输出为 32
      5. kill $!  # 停止服务器
    Expected Result: 32 个端点已注册
    Evidence: .sisyphus/evidence/task-4-endpoints-count.txt

  Scenario: 新端点集成测试（QLD 交通）
    Tool: Bash (curl)
    Preconditions: QLD MCP 服务器和 REST API 都已启动
    Steps:
      1. curl -X POST http://localhost:3000/api/transport-qld/departures \
         -H "Content-Type: application/json" \
         -d '{"transport_mode":"bus","limit":3}' | jq '.count'
      2. 验证返回数字（0 或正整数，取决于当前时间）
      3. 验证响应时间 < 2 秒
    Expected Result: 成功返回 QLD 公交数据
    Evidence: .sisyphus/evidence/task-4-qld-integration.json
  ```

  **Commit**: YES
  - Message: `feat(api): integrate QLD, WA transport and HealthDirect endpoints`
  - Files: `api-server/server.js`, `README.md`
  - Pre-commit: `npm run test:mcp`

---

### Wave 2: RAG 数据准备

- [ ] 5. 收集政府服务文档（Medicare, ATO, 签证）

  **What to do**:
  - 使用 Web Scraper 或手动下载以下来源：
    - Services Australia - Medicare 指南（https://www.servicesaustralia.gov.au/medicare）
    - ATO 税务常见问题（https://www.ato.gov.au/individuals/）
    - Department of Home Affairs 签证类型（https://immi.homeaffairs.gov.au/visas）
  - 保存为 Markdown 格式（结构化）
  - 目录结构：`rag-data/government/medicare/`, `/ato/`, `/visa/`
  - 总规模：~50MB 文本

  **Must NOT do**:
  - 不包含个人案例或示例（仅政策文档）
  - 不复制完整法律条文（仅面向用户的指南）
  - 不添加非官方解读（仅官方文档）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 需要判断哪些页面相关，哪些冗余
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7, 8)
  - **Blocks**: Task 9 (数据导入需要等收集完成)
  - **Blocked By**: Task 4 (需要 API 测试通过后再开始)

  **References**:
  - Services Australia: https://www.servicesaustralia.gov.au/medicare
  - ATO: https://www.ato.gov.au/
  - Home Affairs: https://immi.homeaffairs.gov.au/
  - Web Scraping Tool: `requests` + `BeautifulSoup` 或 `playwright`

  **Acceptance Criteria**:
  - [ ] 目录存在：`rag-data/government/medicare/`, `/ato/`, `/visa/`
  - [ ] 文件数量：Medicare ≥ 20 个 .md, ATO ≥ 30 个, 签证 ≥ 15 个
  - [ ] 总大小：40-60MB
  - [ ] Markdown 格式验证：每个文件有标题、段落、列表

  **QA Scenarios**:
  ```
  Scenario: Medicare 文档完整性检查
    Tool: Bash
    Preconditions: 文档已下载到 rag-data/government/medicare/
    Steps:
      1. find rag-data/government/medicare/ -name "*.md" | wc -l
      2. 验证文件数 ≥ 20
      3. grep -r "如何申请 Medicare" rag-data/government/medicare/
      4. 验证至少找到 1 个匹配（核心问题必须覆盖）
    Expected Result: ≥ 20 个文件，包含申请流程内容
    Evidence: .sisyphus/evidence/task-5-medicare-count.txt

  Scenario: 文档质量抽查（ATO 税务）
    Tool: Bash
    Preconditions: ATO 文档已下载
    Steps:
      1. cat rag-data/government/ato/tax-return-guide.md
      2. 验证包含标题（# 或 ##）
      3. 验证有实际内容（不只是链接列表）
      4. 验证文件大小 > 1KB（非空文档）
    Expected Result: 格式正确的 Markdown，内容详实
    Evidence: .sisyphus/evidence/task-5-ato-quality-sample.md
  ```

  **Commit**: YES
  - Message: `data(rag): collect government services documentation`
  - Files: `rag-data/government/`

---

- [ ] 6. 收集医疗设施数据（医院、诊所、药房）

  **What to do**:
  - 使用 HealthDirect API（Task 3 已实现）批量拉取数据
  - 覆盖主要城市：Sydney, Melbourne, Brisbane, Perth
  - 保存为 JSON 格式：`rag-data/healthcare/facilities.json`
  - 包含字段：name, address, postcode, GPS, type, bulk_billing, hours
  - 预计规模：~10MB（5000-10000 条记录）

  **Must NOT do**:
  - 不包含医生个人信息（隐私问题）
  - 不添加用户评分（非官方数据）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 9
  - **Blocked By**: Task 3 (需要 HealthDirect API 可用)

  **References**:
  - API: Task 3 实现的 `search_health_services`
  - Major cities postcodes: Sydney (2000-2999), Melbourne (3000-3999), Brisbane (4000-4999), Perth (6000-6999)

  **Acceptance Criteria**:
  - [ ] 文件存在：`rag-data/healthcare/facilities.json`
  - [ ] 记录数量：≥ 5000
  - [ ] 数据完整性：每条记录有 name, address, GPS 坐标
  - [ ] 城市覆盖：Sydney ≥ 2000, Melbourne ≥ 1500, Brisbane ≥ 800, Perth ≥ 700

  **QA Scenarios**:
  ```
  Scenario: 批量数据拉取
    Tool: Bash (python script)
    Preconditions: HealthDirect API 可用
    Steps:
      1. python scripts/fetch_healthcare_data.py --cities sydney,melbourne,brisbane,perth
      2. 验证输出 "Fetched 5000+ facilities"
      3. jq 'length' rag-data/healthcare/facilities.json
      4. 验证数量 ≥ 5000
    Expected Result: 成功拉取主要城市医疗设施数据
    Evidence: .sisyphus/evidence/task-6-facilities-count.txt

  Scenario: 数据质量验证（GPS 坐标）
    Tool: Bash
    Preconditions: facilities.json 已生成
    Steps:
      1. jq '[.[] | select(.latitude == null or .longitude == null)] | length' rag-data/healthcare/facilities.json
      2. 验证缺失 GPS 的记录 < 5%（< 250 条）
    Expected Result: ≥ 95% 记录有完整 GPS 坐标
    Evidence: .sisyphus/evidence/task-6-gps-completeness.txt
  ```

  **Commit**: YES
  - Message: `data(rag): collect healthcare facilities data`
  - Files: `rag-data/healthcare/`

---

- [ ] 7. 收集租赁法律文档（NSW, VIC, QLD, WA）

  **What to do**:
  - 下载各州租赁法律指南：
    - NSW: Fair Trading NSW (https://www.fairtrading.nsw.gov.au/housing-and-property/renting)
    - VIC: Consumer Affairs Victoria (https://www.consumer.vic.gov.au/housing/renting)
    - QLD: Residential Tenancies Authority (https://www.rta.qld.gov.au/)
    - WA: Consumer Protection WA (https://www.commerce.wa.gov.au/consumer-protection/renting-home)
  - 关注租客权利、押金、维修责任、终止租约
  - 保存为 Markdown：`rag-data/housing/nsw-rental-guide.md` 等
  - 规模：~5MB（4 个州）

  **Must NOT do**:
  - 不提供法律建议（仅提供官方指南）
  - 不包含租房广告或中介信息

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 9
  - **Blocked By**: Task 4

  **References**:
  - NSW: https://www.fairtrading.nsw.gov.au/housing-and-property/renting
  - VIC: https://www.consumer.vic.gov.au/housing/renting
  - QLD: https://www.rta.qld.gov.au/
  - WA: https://www.commerce.wa.gov.au/consumer-protection/renting-home

  **Acceptance Criteria**:
  - [ ] 4 个文件：`rag-data/housing/{nsw,vic,qld,wa}-rental-guide.md`
  - [ ] 每个文件 ≥ 1MB（详细指南）
  - [ ] 包含关键主题：租客权利、押金规定、维修责任、终止租约

  **QA Scenarios**:
  ```
  Scenario: 租赁法律覆盖度检查
    Tool: Bash
    Preconditions: 4 个州的租赁指南已下载
    Steps:
      1. for state in nsw vic qld wa; do
           grep -i "bond\|deposit" rag-data/housing/${state}-rental-guide.md
         done
      2. 验证每个州都有关于押金的内容
    Expected Result: 4/4 州都包含押金相关规定
    Evidence: .sisyphus/evidence/task-7-bond-coverage.txt

  Scenario: 内容完整性（维修责任）
    Tool: Bash
    Preconditions: NSW 租赁指南已下载
    Steps:
      1. grep -i "repair\|maintenance" rag-data/housing/nsw-rental-guide.md | wc -l
      2. 验证提及次数 ≥ 5（说明内容详细）
    Expected Result: 详细说明维修责任
    Evidence: .sisyphus/evidence/task-7-nsw-repairs.txt
  ```

  **Commit**: YES
  - Message: `data(rag): collect rental law guides for 4 states`
  - Files: `rag-data/housing/`

---

- [ ] 8. 数据清洗和结构化（Markdown → JSON）

  **What to do**:
  - 将 Tasks 5-7 收集的 Markdown 文档转为统一 JSON 格式
  - Schema: `{id, title, content, category, source_url, last_updated}`
  - 分割长文档为段落（每段 200-500 字）以优化检索
  - 输出：`rag-data/processed/documents.json`
  - 使用 Python 脚本自动化处理

  **Must NOT do**:
  - 不删除原始 Markdown 文件（保留备份）
  - 不改变原文语义（仅格式转换）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO（需要等 Tasks 5-7 完成）
  - **Parallel Group**: Sequential in Wave 2
  - **Blocks**: Task 9
  - **Blocked By**: Tasks 5, 6, 7

  **References**:
  - Pattern: 文本分割逻辑（参考 LangChain TextSplitter）
  - JSON Schema Example:
    ```json
    {
      "id": "medicare-001",
      "title": "如何申请 Medicare 卡",
      "content": "Medicare 是澳洲的公共医疗保险...",
      "category": "government/medicare",
      "source_url": "https://...",
      "last_updated": "2026-02-28",
      "word_count": 450
    }
    ```

  **Acceptance Criteria**:
  - [ ] 文件存在：`rag-data/processed/documents.json`
  - [ ] 记录总数：≥ 500（Medicare + ATO + 签证 + 医疗 + 租赁）
  - [ ] 每条记录包含必需字段：id, title, content, category
  - [ ] 段落长度：平均 200-500 字（不过长也不过短）

  **QA Scenarios**:
  ```
  Scenario: JSON 格式验证
    Tool: Bash
    Preconditions: documents.json 已生成
    Steps:
      1. jq 'length' rag-data/processed/documents.json
      2. 验证数量 ≥ 500
      3. jq '.[0] | keys' rag-data/processed/documents.json
      4. 验证包含必需字段：["id", "title", "content", "category", "source_url"]
    Expected Result: JSON 格式正确，字段完整
    Evidence: .sisyphus/evidence/task-8-json-structure.txt

  Scenario: 段落分割质量检查
    Tool: Bash (python)
    Preconditions: documents.json 已生成
    Steps:
      1. python -c "import json; docs=json.load(open('rag-data/processed/documents.json')); \
         lengths=[len(d['content'].split()) for d in docs]; \
         print(f'Avg: {sum(lengths)/len(lengths)}, Min: {min(lengths)}, Max: {max(lengths)}')"
      2. 验证平均长度 150-400 词
      3. 验证最大长度 < 1000 词（说明长文档被分割）
    Expected Result: 段落长度适中，利于检索
    Evidence: .sisyphus/evidence/task-8-paragraph-lengths.txt
  ```

  **Commit**: YES
  - Message: `data(rag): clean and structure documents to JSON`
  - Files: `rag-data/processed/documents.json`, `scripts/process_rag_data.py`

---

- [ ] 9. BGE-small Embedding 生成和 SQLite-VSS 导入

  **What to do**:
  - 使用 BGE-small-en-v1.5 模型生成 embeddings（384 维向量）
  - 为 Task 8 的 500+ 文档生成向量
  - 创建 SQLite-VSS 数据库：`ios-app/rag-data/australian-knowledge.db`
  - 表结构：`documents(id, title, content, embedding BLOB, category, metadata JSON)`
  - 创建向量索引（HNSW 或 IVF）
  - 总大小：~250MB（文本 + 向量）

  **Must NOT do**:
  - 不使用在线 API 生成 embeddings（必须本地模型）
  - 不使用低质量 embedding 模型（如 Word2Vec）

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 涉及向量数据库和机器学习模型集成
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO（需要等 Task 8 完成）
  - **Parallel Group**: Sequential after Wave 2
  - **Blocks**: Task 17 (iOS RAG 检索需要数据库)
  - **Blocked By**: Task 8

  **References**:
  - BGE-small Model: https://huggingface.co/BAAI/bge-small-en-v1.5
  - SQLite-VSS Docs: https://github.com/asg017/sqlite-vss
  - Sentence Transformers: https://www.sbert.net/
  - Example Code:
    ```python
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer('BAAI/bge-small-en-v1.5')
    embeddings = model.encode(texts)
    ```

  **Acceptance Criteria**:
  - [ ] 文件存在：`ios-app/rag-data/australian-knowledge.db`
  - [ ] 数据库大小：200-300MB
  - [ ] 表 `documents` 有 ≥ 500 条记录
  - [ ] 向量维度验证：每条记录的 embedding 是 384 维 BLOB
  - [ ] 向量索引创建成功（查询 sqlite_master 表验证）

  **QA Scenarios**:
  ```
  Scenario: Embedding 生成和导入
    Tool: Bash (python script)
    Preconditions: BGE-small 模型已下载，documents.json 已准备
    Steps:
      1. python scripts/generate_embeddings.py \
         --input rag-data/processed/documents.json \
         --output ios-app/rag-data/australian-knowledge.db
      2. 验证输出 "Processed 500+ documents, generated embeddings"
      3. sqlite3 ios-app/rag-data/australian-knowledge.db "SELECT COUNT(*) FROM documents;"
      4. 验证数量 ≥ 500
    Expected Result: 成功生成向量并导入 SQLite-VSS
    Evidence: .sisyphus/evidence/task-9-embedding-import.log

  Scenario: 向量检索功能测试
    Tool: Bash (python script)
    Preconditions: australian-knowledge.db 已创建
    Steps:
      1. python scripts/test_rag_search.py \
         --query "如何申请 Medicare 卡" \
         --db ios-app/rag-data/australian-knowledge.db \
         --top_k 3
      2. 验证返回 3 条结果
      3. 验证第一条结果包含 "Medicare" 关键词
      4. 验证相似度分数 > 0.7（高相关性）
    Expected Result: 向量检索返回相关文档
    Evidence: .sisyphus/evidence/task-9-search-test.json
  ```

  **Commit**: YES
  - Message: `data(rag): generate BGE embeddings and create SQLite-VSS database`
  - Files: `ios-app/rag-data/australian-knowledge.db`, `scripts/generate_embeddings.py`

---

### Wave 3: Qwen 模型集成

- [ ] 10. 下载 Qwen2.5-1.5B-Instruct 原始模型

  **What to do**:
  - 从 Hugging Face 下载 Qwen2.5-1.5B-Instruct
  - 验证模型文件完整性（MD5 checksum）
  - 保存到：`models/Qwen2.5-1.5B-Instruct/`
  - 文件大小：~3GB（FP16 原始权重）

  **Must NOT do**:
  - 不下载 7B 或 14B 版本（太大，iOS 不支持）
  - 不使用非官方模型源

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 简单的下载任务
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（可与 Wave 2 并行）
  - **Parallel Group**: Wave 3 (with Tasks 11-14)
  - **Blocks**: Task 11 (转换需要原始模型)
  - **Blocked By**: None

  **References**:
  - Hugging Face: https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct
  - Download Command: `git lfs clone https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct models/Qwen2.5-1.5B-Instruct`

  **Acceptance Criteria**:
  - [ ] 目录存在：`models/Qwen2.5-1.5B-Instruct/`
  - [ ] 文件包含：`config.json`, `model.safetensors`, `tokenizer.json`
  - [ ] 总大小：2.5-3.5GB
  - [ ] MD5 验证通过（与 Hugging Face 官方一致）

  **QA Scenarios**:
  ```
  Scenario: 模型下载和完整性验证
    Tool: Bash
    Preconditions: git lfs 已安装
    Steps:
      1. git lfs clone https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct models/Qwen2.5-1.5B-Instruct
      2. ls -lh models/Qwen2.5-1.5B-Instruct/ | tee .sisyphus/evidence/task-10-files.txt
      3. 验证包含 model.safetensors（主权重文件）
      4. du -sh models/Qwen2.5-1.5B-Instruct/
      5. 验证总大小 2.5-3.5GB
    Expected Result: 模型文件完整下载
    Evidence: .sisyphus/evidence/task-10-files.txt
  ```

  **Commit**: NO（模型文件太大，不提交到 git）
  - 添加到 .gitignore：`models/Qwen2.5-1.5B-Instruct/`

---

- [ ] 11. 转换 Qwen 模型为 MLX 格式

  **What to do**:
  - 使用 `mlx-lm` 工具转换 Qwen 为 MLX 格式
  - 应用 Q8 量化（8-bit 量化保留 95%+ 精度）
  - 输出：`ios-app/models/Qwen2.5-1.5B-Instruct-Q8.mlx/`
  - 文件大小：~1.7GB（量化后）

  **Must NOT do**:
  - 不使用 Q4 量化（精度损失太大，影响工具调用）
  - 不转换为 Core ML（MLX 性能更好）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 需要理解量化和格式转换
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO（需要等 Task 10 完成）
  - **Parallel Group**: Sequential in Wave 3
  - **Blocks**: Tasks 12-14
  - **Blocked By**: Task 10

  **References**:
  - MLX-LM Docs: https://github.com/ml-explore/mlx-examples/tree/main/llms
  - Conversion Command: `python -m mlx_lm.convert --model models/Qwen2.5-1.5B-Instruct --q-bits 8 --output ios-app/models/Qwen2.5-1.5B-Instruct-Q8.mlx`
  - Quantization Guide: https://ml-explore.github.io/mlx/build/html/examples/quantization.html

  **Acceptance Criteria**:
  - [ ] 目录存在：`ios-app/models/Qwen2.5-1.5B-Instruct-Q8.mlx/`
  - [ ] 文件包含：`config.json`, `weights.00.safetensors`, `tokenizer.json`
  - [ ] 文件大小：1.5-1.9GB
  - [ ] 转换日志显示量化成功（无错误）

  **QA Scenarios**:
  ```
  Scenario: MLX 格式转换和量化
    Tool: Bash
    Preconditions: mlx-lm 已安装，原始模型已下载
    Steps:
      1. python -m mlx_lm.convert \
         --model models/Qwen2.5-1.5B-Instruct \
         --q-bits 8 \
         --output ios-app/models/Qwen2.5-1.5B-Instruct-Q8.mlx \
         2>&1 | tee .sisyphus/evidence/task-11-conversion.log
      2. 验证日志包含 "Conversion successful"
      3. du -sh ios-app/models/Qwen2.5-1.5B-Instruct-Q8.mlx/
      4. 验证大小约 1.7GB（说明量化生效）
    Expected Result: 成功转换为 MLX Q8 格式
    Evidence: .sisyphus/evidence/task-11-conversion.log

  Scenario: 快速推理测试（验证可用性）
    Tool: Bash (python)
    Preconditions: MLX 模型已转换
    Steps:
      1. python -m mlx_lm.generate \
         --model ios-app/models/Qwen2.5-1.5B-Instruct-Q8.mlx \
         --prompt "Hello, I am" \
         --max-tokens 20 \
         --temp 0.7
      2. 验证输出合理的英文文本（非乱码）
      3. 验证生成速度 > 5 tokens/s
    Expected Result: 模型可正常推理
    Evidence: .sisyphus/evidence/task-11-quick-test.txt
  ```

  **Commit**: NO（模型文件太大）
  - 添加到 .gitignore：`ios-app/models/`

---

- [ ] 12. 创建 iOS Demo 项目（MLX Swift 集成）

  **What to do**:
  - 创建新 Xcode 项目：`ios-app/QwenDemo/`
  - 集成 MLX Swift Package（https://github.com/ml-explore/mlx-swift）
  - 加载 Qwen2.5-1.5B-Q8 模型
  - 实现简单聊天界面（SwiftUI）
  - 测试基础推理功能（不含工具调用）

  **Must NOT do**:
  - 不实现完整 App 功能（仅 Demo）
  - 不添加复杂 UI（专注模型集成）

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: iOS UI 开发和 Swift 集成
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO（需要等 Task 11 完成）
  - **Parallel Group**: Sequential in Wave 3
  - **Blocks**: Tasks 13-14
  - **Blocked By**: Task 11

  **References**:
  - MLX Swift: https://github.com/ml-explore/mlx-swift
  - MLX Swift Examples: https://github.com/ml-explore/mlx-swift-examples
  - Example Code:
    ```swift
    import MLX
    import MLXLLM
    
    let model = try await LLM.load(modelPath: "Qwen2.5-1.5B-Instruct-Q8.mlx")
    let response = try await model.generate(prompt: "Hello", maxTokens: 50)
    ```

  **Acceptance Criteria**:
  - [ ] Xcode 项目存在：`ios-app/QwenDemo/QwenDemo.xcodeproj`
  - [ ] Package.swift 包含 MLX Swift 依赖
  - [ ] 项目可编译（`xcodebuild` 无错误）
  - [ ] 在 iPhone 14 模拟器启动成功

  **QA Scenarios**:
  ```
  Scenario: Xcode 项目编译
    Tool: Bash
    Preconditions: Xcode 已安装，MLX Swift 包已添加
    Steps:
      1. cd ios-app/QwenDemo
      2. xcodebuild -scheme QwenDemo -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 14' build \
         2>&1 | tee ../../.sisyphus/evidence/task-12-build.log
      3. 验证输出包含 "BUILD SUCCEEDED"
    Expected Result: 项目编译成功
    Evidence: .sisyphus/evidence/task-12-build.log

  Scenario: 模型加载测试（模拟器）
    Tool: Interactive Bash (tmux)
    Preconditions: 项目已编译，模拟器已启动
    Steps:
      1. 在 Xcode 运行 QwenDemo
      2. 点击 "Load Model" 按钮
      3. 验证状态显示 "Model loaded successfully"
      4. 验证内存占用约 2-3GB（符合预期）
    Expected Result: 模型成功加载到模拟器
    Evidence: .sisyphus/evidence/task-12-model-load-screenshot.png
  ```

  **Commit**: YES
  - Message: `feat(ios): create Qwen MLX demo project`
  - Files: `ios-app/QwenDemo/`

---

- [ ] 13. Function calling 测试（工具调用解析）

  **What to do**:
  - 实现 Function calling 系统提示词（参考文档 Part 4.4）
  - 测试 Qwen 模型是否能正确生成工具调用 JSON
  - 测试场景：
    - 用户："悉尼天气？" → 模型输出：`{"tool":"get_weather","params":{"location":"Sydney"}}`
    - 用户："下一班地铁几点？" → 模型输出：`{"tool":"get_realtime_departures","params":{...}}`
  - 记录成功率（≥ 90% 正确解析）

  **Must NOT do**:
  - 不实现实际工具执行（仅测试 JSON 生成）
  - 不测试超出范围的工具（专注已实现的 MCP 工具）

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 需要理解 Qwen function calling 机制和提示词工程
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（可与 Task 14 并行）
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 19 (工具调用执行器需要验证逻辑)
  - **Blocked By**: Task 12

  **References**:
  - Qwen Function Calling Docs: https://qwen.readthedocs.io/en/latest/framework/function_call.html
  - System Prompt Template: 见本计划 Part 4.4 章节
  - Test Cases:
    ```python
    test_queries = [
        ("悉尼天气？", "get_weather", {"location": "Sydney"}),
        ("2000 邮编是哪里？", "get_postcode_info", {"postcode": "2000"}),
        ("墨尔本大学有什么课程？", "search_courses", {"query": "...", "state": "VIC"})
    ]
    ```

  **Acceptance Criteria**:
  - [ ] 测试脚本存在：`scripts/test_function_calling.py`
  - [ ] 测试 20 个查询，成功率 ≥ 90%（≥ 18 个正确）
  - [ ] JSON 格式验证通过（可被 `json.loads()` 解析）
  - [ ] 工具名称匹配 MCP 工具列表（无虚构工具）

  **QA Scenarios**:
  ```
  Scenario: Function calling 成功率测试
    Tool: Bash (python script)
    Preconditions: Qwen MLX 模型已加载，测试查询列表已准备
    Steps:
      1. python scripts/test_function_calling.py \
         --model ios-app/models/Qwen2.5-1.5B-Instruct-Q8.mlx \
         --test-cases scripts/function_calling_test_cases.json \
         --output .sisyphus/evidence/task-13-results.json
      2. 验证输出包含 "Success rate: 90%+" 或更高
      3. jq '.failed_cases' .sisyphus/evidence/task-13-results.json
      4. 分析失败案例（如果有）
    Expected Result: ≥ 90% 查询正确生成工具调用 JSON
    Evidence: .sisyphus/evidence/task-13-results.json

  Scenario: 错误处理测试（无工具匹配）
    Tool: Bash (python)
    Preconditions: 测试脚本已准备
    Steps:
      1. python scripts/test_function_calling.py \
         --query "北京今天天气怎么样？" \
         --model ios-app/models/Qwen2.5-1.5B-Instruct-Q8.mlx
      2. 验证模型回复包含 "抱歉，我只能查询澳洲的数据"（超出范围提示）
      3. 验证不生成虚构工具调用
    Expected Result: 模型正确识别超出范围查询
    Evidence: .sisyphus/evidence/task-13-out-of-scope.txt
  ```

  **Commit**: YES
  - Message: `test(qwen): validate function calling with 20 test cases`
  - Files: `scripts/test_function_calling.py`, `scripts/function_calling_test_cases.json`

---

- [ ] 14. 性能基准测试（速度、内存、电池）

  **What to do**:
  - 在真实设备上测试 Qwen 模型性能：
    - **推理速度**: Tokens/秒（目标：≥ 10 tokens/s on iPhone 14）
    - **内存占用**: 峰值 RAM（目标：≤ 3GB）
    - **冷启动时间**: 模型加载时间（目标：≤ 3 秒）
    - **电池消耗**: 1 小时推理的电量百分比（目标：≤ 20%）
  - 测试设备：iPhone 14, iPhone 15（如果有）
  - 记录到报告：`docs/qwen-performance-benchmark.md`

  **Must NOT do**:
  - 不在模拟器测试（性能不准确）
  - 不测试超过 5 分钟连续推理（不现实）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（可与 Task 13 并行）
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 22 (优化需要基准数据)
  - **Blocked By**: Task 12

  **References**:
  - XCTest Performance Testing: https://developer.apple.com/documentation/xctest/xctestcase/measuring_performance
  - Instruments (Xcode Profiler): 用于内存和 CPU 分析
  - Battery Usage API: https://developer.apple.com/documentation/foundation/processinfo

  **Acceptance Criteria**:
  - [ ] 报告文件存在：`docs/qwen-performance-benchmark.md`
  - [ ] 包含 4 个指标的测试结果（速度、内存、启动、电池）
  - [ ] 至少在 iPhone 14 上测试（真机，非模拟器）
  - [ ] 推理速度 ≥ 10 tokens/s（满足目标）

  **QA Scenarios**:
  ```
  Scenario: 推理速度基准测试
    Tool: Interactive Bash (真机连接 Xcode)
    Preconditions: QwenDemo 已安装到 iPhone 14
    Steps:
      1. 在 Xcode 运行 Performance Test scheme
      2. 运行 `testInferenceSpeed()` 测试
      3. 生成 100 tokens，记录时间
      4. 计算速度：100 tokens / 时间（秒）
      5. 验证速度 ≥ 10 tokens/s
    Expected Result: 推理速度满足要求
    Evidence: .sisyphus/evidence/task-14-inference-speed.txt

  Scenario: 内存占用监控
    Tool: Xcode Instruments (Memory Profiler)
    Preconditions: QwenDemo 在真机运行
    Steps:
      1. 启动 Instruments → Memory Profiler
      2. 运行 QwenDemo，加载模型
      3. 连续生成 10 个响应（每个 50 tokens）
      4. 记录峰值内存占用
      5. 验证峰值 ≤ 3GB
    Expected Result: 内存占用在可接受范围
    Evidence: .sisyphus/evidence/task-14-memory-profile.png
  ```

  **Commit**: YES
  - Message: `docs(qwen): add performance benchmark report`
  - Files: `docs/qwen-performance-benchmark.md`

---

### Wave 4: iOS App 开发

_(Due to length, Wave 4-5 tasks will be abbreviated. Full details follow the same pattern as above.)_

- [ ] 15. SwiftUI 聊天界面（消息列表 + 输入框）[visual-engineering]
- [ ] 16. MCP 客户端（URLSession + Async/Await）[deep]
- [ ] 17. RAG 检索逻辑（SQLite-VSS 查询 + 重排序）[deep]
- [ ] 18. Agent 系统（查询分类 + 路由决策）[ultrabrain]
- [ ] 19. 工具调用执行器（JSON 解析 → API 调用）[deep]
- [ ] 20. 多轮对话管理（会话历史 + 上下文窗口）[deep]
- [ ] 21. 地图集成（显示交通/医院位置）[visual-engineering]

### Wave 5: 优化和发布

- [ ] 22. 性能优化（模型量化、缓存、启动速度）[ultrabrain]
- [ ] 23. 电池消耗优化（后台推理限制）[unspecified-high]
- [ ] 24. Beta 测试（TestFlight 10-20 用户）[unspecified-high]
- [ ] 25. Bug 修复和用户反馈迭代 [unspecified-high]
- [ ] 26. App Store 发布准备（截图、描述、隐私政策）[writing]

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `oracle`  
  读取本计划所有 "Must Have" 和 "Must NOT Have"，验证每条是否在最终交付物中实现。检查 `.sisyphus/evidence/` 目录包含所有任务的证据文件。输出：`Must Have [N/N] | Must NOT Have [N/N] | Tasks [26/26] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`  
  运行所有测试套件：`npm run test:mcp`, `pytest mcp-servers/`, `xcodebuild test`。检查代码中是否有 `TODO`, `FIXME`, `console.log` 残留。验证无 TypeScript/Swift 编译警告。输出：`Build [PASS/FAIL] | Tests [N pass/N fail] | Code Quality [N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`  
  在真实 iPhone 14 设备上执行端到端测试：
  1. 用户问"悉尼天气？" → 验证返回 BOM 实时数据
  2. 用户问"如何申请 Medicare？" → 验证返回 RAG 内容
  3. 用户问"下一班去机场的地铁几点？" → 验证调用 NSW Transport API
  4. 测试离线模式（关闭网络）→ 验证 RAG 仍可用
  5. 测试 QLD 交通查询 → 验证新 API 工作
  保存所有截图到 `.sisyphus/evidence/final-qa/`。输出：`Scenarios [5/5 pass] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`  
  对比本计划 "Work Objectives" 和实际交付物。验证：
  - 10 个 MCP 服务器（7 旧 + 3 新）全部运行
  - RAG 数据库 ~100MB，包含政府/医疗/租赁内容
  - Qwen2.5-1.5B-Q8 模型集成到 iOS
  - iOS App 包含聊天、RAG、工具调用、地图功能
  检测范围蔓延：是否添加了计划外功能？输出：`Scope [COMPLIANT/CREEP] | Deliverables [N/N] | VERDICT`

---

## Commit Strategy

所有任务按标记的 Commit 字段执行提交。

**Wave 1**: 每个 MCP 服务器单独提交（4 个 commits）  
**Wave 2**: RAG 数据准备每阶段提交（5 个 commits）  
**Wave 3**: Qwen 集成里程碑提交（3 个 commits，模型文件不提交）  
**Wave 4**: iOS App 功能模块提交（7 个 commits）  
**Wave 5**: 优化和发布相关提交（5 个 commits）

提交消息格式：`type(scope): description`  
- `feat`: 新功能
- `data`: RAG 数据
- `test`: 测试
- `docs`: 文档
- `perf`: 性能优化

---

## Success Criteria

### Verification Commands
```bash
# MCP 服务器测试
npm run test:mcp  # Expected: 10/10 pass

# RAG 检索测试
python scripts/test_rag.py --query "如何申请 Medicare" --top_k 3
# Expected: 返回 3 条相关文档，相似度 > 0.7

# iOS App 编译
cd ios-app/AustralianAgent && xcodebuild -scheme AustralianAgent build
# Expected: BUILD SUCCEEDED

# Qwen 推理速度
python scripts/benchmark_qwen.py --model ios-app/models/Qwen2.5-1.5B-Instruct-Q8.mlx
# Expected: ≥ 10 tokens/s on iPhone 14
```

### Final Checklist
- [ ] 所有 10 个 MCP 服务器测试通过
- [ ] RAG 数据库包含 ≥ 500 文档
- [ ] Qwen 模型推理速度 ≥ 10 tokens/s
- [ ] iOS App 冷启动 < 2 秒
- [ ] Function calling 成功率 ≥ 90%
- [ ] 人口覆盖率 89%（NSW+VIC+QLD+WA）
- [ ] 所有 "Must NOT Have" 项均未违反
- [ ] Beta 测试用户满意度 ≥ 4/5 星
