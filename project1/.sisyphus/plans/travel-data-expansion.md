# 澳洲小助手 - 旅行数据扩展计划

## TL;DR

> **Quick Summary**: 为澳洲小助手添加全面的旅行推荐数据，通过静态RAG数据、API集成和社交媒体数据三个层次构建旅行知识库
> 
> **Deliverables**: 
> - 澳洲8州旅行攻略RAG数据（景点、美食、活动）
> - Yelp API集成（餐厅、咖啡店、夜生活）
> - Google Places增强（景点评论摘要）
> - Reddit旅行帖子数据采集
> 
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: 静态RAG数据 → API集成 → 数据融合 → 测试验证

---

## Context

### Original Request
用户希望增强旅行推荐功能，获取社交媒体数据（Reddit、Instagram、Facebook等）来提供真实的本地人推荐。

### Interview Summary
**Key Discussions**:
- Instagram/Facebook API已关闭公开访问，不可行
- Reddit API有免费额度(100次/分钟)，需申请开发者账号
- TripAdvisor审核周期长，Yelp免费tier更实用
- 静态RAG数据可快速见效

**选定方案**:
1. 静态RAG数据（官方旅游局、Lonely Planet等）
2. 增强Google Places（已有API key）
3. Yelp API集成（5000次/天免费）
4. Reddit API申请和集成

---

## Work Objectives

### Core Objective
构建全面的澳洲旅行推荐知识库，支持景点、美食、活动、本地人推荐等查询

### Concrete Deliverables
- `data/rag-sources/travel/` 目录下各州旅行攻略文件
- `mcp-servers/yelp-mcp/` Yelp API MCP服务
- `mcp-servers/reddit-mcp/` Reddit API MCP服务（可选）
- 增强的 Google Places MCP 查询类型
- 更新的RAG embeddings

### Definition of Done
- [ ] `curl http://localhost:3000/mcp/yelp/search?location=sydney&term=restaurant` 返回餐厅数据
- [ ] RAG查询"悉尼有什么好玩的"返回结构化景点信息
- [ ] 旅行类意图被正确路由到travel数据源

### Must Have
- 澳洲8州主要城市旅行攻略
- 餐厅/咖啡店搜索API
- 景点评分和评论摘要
- 中英文双语支持

### Must NOT Have (Guardrails)
- 不使用付费API tier（除非用户明确同意）
- 不违反平台ToS爬取数据
- 不存储用户个人数据
- 不实现实时社交feed功能

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (bun test)
- **Automated tests**: Tests-after
- **Framework**: bun test

### QA Policy
- **API endpoints**: Use Bash (curl) - 验证响应格式和数据质量
- **RAG data**: Use Bash - 验证文件生成和chunk数量
- **MCP服务**: Use Bash - 验证服务启动和工具调用

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — 静态数据收集):
├── Task 1: NSW旅行攻略数据 [quick]
├── Task 2: VIC旅行攻略数据 [quick]
├── Task 3: QLD旅行攻略数据 [quick]
├── Task 4: WA旅行攻略数据 [quick]
├── Task 5: SA/TAS/NT/ACT攻略数据 [quick]
└── Task 6: Yelp API研究和账号申请 [quick]

Wave 2 (After Wave 1 — API集成):
├── Task 7: Yelp MCP服务开发 (depends: 6) [unspecified-high]
├── Task 8: Google Places增强 [unspecified-high]
├── Task 9: 美食专题数据 (depends: 1-5) [quick]
└── Task 10: Reddit API申请 [quick]

Wave 3 (After Wave 2 — 数据处理):
├── Task 11: RAG数据重新生成 (depends: 1-5, 9) [quick]
├── Task 12: Embedding重新生成 (depends: 11) [unspecified-high]
├── Task 13: Reddit MCP服务开发 (depends: 10) [unspecified-high]
└── Task 14: Intent routing更新 [quick]

Wave 4 (After Wave 3 — 验证):
├── Task 15: API集成测试 [deep]
├── Task 16: RAG质量测试 [deep]
├── Task 17: Cloudflare上传 (depends: 12) [quick]
└── Task 18: E2E测试 [deep]

Critical Path: Task 1-5 → Task 11 → Task 12 → Task 17
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 6 (Wave 1)
```

---

## TODOs

- [ ] 1. NSW旅行攻略数据收集

  **What to do**:
  - 收集悉尼（Sydney）旅行攻略：景点(Opera House, Harbour Bridge, Bondi Beach等)、美食区(Chinatown, Newtown)、活动(Vivid Sydney)
  - 收集蓝山(Blue Mountains)、猎人谷(Hunter Valley)、Byron Bay等周边
  - 整理交通、最佳季节、预算建议
  - 创建 `data/rag-sources/travel/nsw/` 目录结构

  **Must NOT do**:
  - 不复制版权内容，用自己的话总结
  - 不包含过时信息（疫情前数据需更新）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`playwright`]
    - `playwright`: 需要浏览官方旅游网站获取信息

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4, 5, 6)
  - **Blocks**: Task 9, 11
  - **Blocked By**: None

  **References**:
  - **Pattern References**: `data/rag-sources/rental-laws/nsw/` - 现有RAG数据格式
  - **External References**: 
    - https://www.sydney.com/ - 悉尼官方旅游网站
    - https://www.visitnsw.com/ - NSW旅游局
    - https://www.lonelyplanet.com/australia/new-south-wales - Lonely Planet

  **Acceptance Criteria**:
  - [ ] `ls data/rag-sources/travel/nsw/*.md | wc -l` >= 5 files
  - [ ] 每个文件包含: title, category, subcategory YAML front matter

  **QA Scenarios**:
  ```
  Scenario: Sydney travel guide exists
    Tool: Bash
    Steps:
      1. cat data/rag-sources/travel/nsw/sydney_guide.md | head -20
      2. Assert: Contains "Sydney" in title
      3. Assert: Contains at least 3 major attractions
    Expected Result: File with structured content
    Evidence: .sisyphus/evidence/task-1-sydney-guide.txt

  Scenario: File format validation
    Tool: Bash
    Steps:
      1. head -10 data/rag-sources/travel/nsw/sydney_guide.md
      2. Assert: Starts with "---" (YAML front matter)
      3. Assert: Contains "category: travel"
    Expected Result: Valid YAML front matter
    Evidence: .sisyphus/evidence/task-1-format-check.txt
  ```

  **Commit**: YES (groups with 2-5)
  - Message: `feat(travel): add NSW travel guide data`
  - Files: `data/rag-sources/travel/nsw/*.md`

---

- [ ] 2. VIC旅行攻略数据收集

  **What to do**:
  - Melbourne旅行攻略：CBD laneways、Federation Square、St Kilda Beach、Great Ocean Road
  - Yarra Valley、Phillip Island、Mornington Peninsula
  - 文化活动：Melbourne Cup、Australian Open、艺术节

  **Must NOT do**:
  - 不复制版权内容

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`playwright`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 9, 11
  - **Blocked By**: None

  **References**:
  - **External References**: 
    - https://www.visitmelbourne.com/
    - https://www.visitvictoria.com/

  **Acceptance Criteria**:
  - [ ] `ls data/rag-sources/travel/vic/*.md | wc -l` >= 5 files

  **QA Scenarios**:
  ```
  Scenario: Melbourne guide exists
    Tool: Bash
    Steps:
      1. cat data/rag-sources/travel/vic/melbourne_guide.md | grep -i "great ocean road"
    Expected Result: Contains Great Ocean Road mention
    Evidence: .sisyphus/evidence/task-2-melbourne.txt
  ```

  **Commit**: YES (groups with 1, 3-5)

---

- [ ] 3. QLD旅行攻略数据收集

  **What to do**:
  - Brisbane、Gold Coast、Cairns攻略
  - Great Barrier Reef、Daintree Rainforest
  - Whitsundays、Noosa、Sunshine Coast

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`playwright`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 9, 11
  - **Blocked By**: None

  **References**:
  - **External References**: 
    - https://www.queensland.com/
    - https://www.australia.com/en/places/cairns-and-surrounds.html

  **Acceptance Criteria**:
  - [ ] `ls data/rag-sources/travel/qld/*.md | wc -l` >= 5 files

  **QA Scenarios**:
  ```
  Scenario: Great Barrier Reef content
    Tool: Bash
    Steps:
      1. grep -r "Great Barrier Reef" data/rag-sources/travel/qld/
    Expected Result: At least 1 match
    Evidence: .sisyphus/evidence/task-3-gbr.txt
  ```

  **Commit**: YES (groups with 1-2, 4-5)

---

- [ ] 4. WA旅行攻略数据收集

  **What to do**:
  - Perth、Fremantle攻略
  - Margaret River、Rottnest Island
  - Ningaloo Reef、Pinnacles Desert、Broome

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`playwright`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 9, 11
  - **Blocked By**: None

  **References**:
  - **External References**: 
    - https://www.westernaustralia.com/

  **Acceptance Criteria**:
  - [ ] `ls data/rag-sources/travel/wa/*.md | wc -l` >= 4 files

  **Commit**: YES (groups with 1-3, 5)

---

- [ ] 5. SA/TAS/NT/ACT旅行攻略数据

  **What to do**:
  - South Australia: Adelaide, Barossa Valley, Kangaroo Island
  - Tasmania: Hobart, MONA, Cradle Mountain, Port Arthur
  - Northern Territory: Darwin, Uluru, Kakadu
  - ACT: Canberra, Parliament House, National Gallery

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`playwright`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 9, 11
  - **Blocked By**: None

  **Acceptance Criteria**:
  - [ ] `ls data/rag-sources/travel/sa/*.md` >= 3 files
  - [ ] `ls data/rag-sources/travel/tas/*.md` >= 3 files
  - [ ] `ls data/rag-sources/travel/nt/*.md` >= 3 files
  - [ ] `ls data/rag-sources/travel/act/*.md` >= 2 files

  **Commit**: YES (groups with 1-4)

---

- [ ] 6. Yelp API研究和账号申请

  **What to do**:
  - 访问 https://www.yelp.com/developers 创建开发者账号
  - 获取API Key（Client ID和API Key）
  - 研究Yelp Fusion API文档：Business Search, Business Details, Reviews
  - 记录免费tier限制(5000次/天)和数据字段

  **Must NOT do**:
  - 不使用付费tier
  - 不存储个人API key到git仓库

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`playwright`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 7
  - **Blocked By**: None

  **References**:
  - **External References**: 
    - https://docs.developer.yelp.com/docs/fusion-intro
    - https://docs.developer.yelp.com/reference/v3_business_search

  **Acceptance Criteria**:
  - [ ] Yelp API Key获取成功（记录到.env.template）
  - [ ] API文档摘要记录到 `docs/yelp-api-notes.md`

  **QA Scenarios**:
  ```
  Scenario: Yelp API test call
    Tool: Bash (curl)
    Steps:
      1. curl -H "Authorization: Bearer $YELP_API_KEY" "https://api.yelp.com/v3/businesses/search?location=sydney&term=restaurant&limit=1"
    Expected Result: JSON response with businesses array
    Evidence: .sisyphus/evidence/task-6-yelp-test.json
  ```

  **Commit**: NO (API key不commit)

---

- [ ] 7. Yelp MCP服务开发

  **What to do**:
  - 创建 `mcp-servers/yelp-mcp/` 目录
  - 实现MCP工具：search_businesses, get_business, get_reviews
  - 支持参数：location, term, categories, price, open_now
  - 添加到统一API server的路由

  **Must NOT do**:
  - 不超过5000次/天限制
  - 不存储完整评论内容（只存储摘要）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
    - 标准Node.js/Python开发，无需特殊skill

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 8, 9, 10)
  - **Blocks**: Task 15
  - **Blocked By**: Task 6

  **References**:
  - **Pattern References**: 
    - `mcp-servers/google-places-mcp/` - 现有MCP结构参考
    - `api-server/server.js` - 路由注册模式
  - **External References**: 
    - https://docs.developer.yelp.com/reference/v3_business_search

  **Acceptance Criteria**:
  - [ ] `npm test` in yelp-mcp directory passes
  - [ ] curl测试返回餐厅数据

  **QA Scenarios**:
  ```
  Scenario: Business search works
    Tool: Bash (curl)
    Steps:
      1. curl "http://localhost:3000/mcp/yelp/search?location=melbourne&term=coffee&limit=5"
      2. Assert: Response contains "businesses" array
      3. Assert: Each business has name, rating, location
    Expected Result: 5 coffee shops in Melbourne
    Evidence: .sisyphus/evidence/task-7-yelp-search.json

  Scenario: Error handling
    Tool: Bash (curl)
    Steps:
      1. curl "http://localhost:3000/mcp/yelp/search?location=invalid_location_xyz"
      2. Assert: Response contains error message, not 500
    Expected Result: Graceful error response
    Evidence: .sisyphus/evidence/task-7-yelp-error.json
  ```

  **Commit**: YES
  - Message: `feat(mcp): add Yelp API integration for restaurant search`
  - Files: `mcp-servers/yelp-mcp/*`, `api-server/server.js`

---

- [ ] 8. Google Places增强

  **What to do**:
  - 添加新的place types: tourist_attraction, museum, park, amusement_park
  - 实现评论摘要功能：提取top 3评论关键词
  - 添加photo URL获取（用于UI展示）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 15
  - **Blocked By**: None

  **References**:
  - **Pattern References**: 
    - `mcp-servers/google-places-mcp/src/index.ts` - 现有实现

  **Acceptance Criteria**:
  - [ ] `curl "http://localhost:3000/mcp/places/nearby?lat=-33.8688&lng=151.2093&type=tourist_attraction"` 返回景点

  **QA Scenarios**:
  ```
  Scenario: Tourist attractions search
    Tool: Bash (curl)
    Steps:
      1. curl "http://localhost:3000/mcp/places/nearby?lat=-33.8568&lng=151.2153&type=tourist_attraction&radius=1000"
      2. Assert: Response contains Sydney Opera House or similar
    Expected Result: Tourist attractions near Sydney Opera House
    Evidence: .sisyphus/evidence/task-8-places-attractions.json
  ```

  **Commit**: YES
  - Message: `feat(places): add tourist attractions and review summaries`

---

- [ ] 9. 美食专题数据收集

  **What to do**:
  - 各城市特色美食：Sydney的海鲜、Melbourne的咖啡文化、Brisbane的Moreton Bay Bugs
  - 美食街区推荐：Chinatown locations、Lygon St、Fortitude Valley
  - 本地人推荐的hidden gems
  - 素食/清真/过敏友好选项

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`playwright`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 11
  - **Blocked By**: Tasks 1-5

  **Acceptance Criteria**:
  - [ ] `ls data/rag-sources/travel/food/*.md | wc -l` >= 8 files

  **Commit**: YES
  - Message: `feat(travel): add food and dining guides`

---

- [ ] 10. Reddit API申请

  **What to do**:
  - 访问 https://www.reddit.com/prefs/apps 创建应用
  - 获取client_id和client_secret
  - 研究PRAW (Python Reddit API Wrapper)或直接API
  - 记录rate limits (100请求/分钟 OAuth)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`playwright`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 13
  - **Blocked By**: None

  **References**:
  - **External References**: 
    - https://www.reddit.com/dev/api
    - https://praw.readthedocs.io/

  **Acceptance Criteria**:
  - [ ] Reddit client_id获取成功
  - [ ] 测试API调用成功

  **Commit**: NO (credentials不commit)

---

- [ ] 11. RAG数据处理

  **What to do**:
  - 运行 `python3 scripts/prepare_rag_data.py`
  - 验证travel数据被正确解析和分块
  - 检查chunk数量和质量

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential)
  - **Blocks**: Task 12
  - **Blocked By**: Tasks 1-5, 9

  **Acceptance Criteria**:
  - [ ] `wc -l data/processed/rag_chunks.jsonl` > 22000 (比之前增加)
  - [ ] `grep -c "travel" data/processed/rag_chunks.jsonl` > 100

  **QA Scenarios**:
  ```
  Scenario: Travel chunks generated
    Tool: Bash
    Steps:
      1. grep '"category":"travel"' data/processed/rag_chunks.jsonl | wc -l
      2. Assert: Count > 100
    Expected Result: At least 100 travel chunks
    Evidence: .sisyphus/evidence/task-11-travel-chunks.txt
  ```

  **Commit**: NO (processed data不commit)

---

- [ ] 12. Embedding重新生成

  **What to do**:
  - 运行 `python3 scripts/generate_embeddings.py`
  - 验证新embedding数量匹配chunk数量

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (CPU/GPU intensive)
  - **Parallel Group**: Wave 3 (sequential after 11)
  - **Blocks**: Task 17
  - **Blocked By**: Task 11

  **Acceptance Criteria**:
  - [ ] `sqlite3 data/processed/rag_database.db "SELECT COUNT(*) FROM embeddings"` matches chunk count

  **Commit**: NO

---

- [ ] 13. Reddit MCP服务开发 (Optional)

  **What to do**:
  - 创建 `mcp-servers/reddit-mcp/`
  - 实现工具：search_posts, get_subreddit_top
  - 目标subreddits: r/australia, r/sydney, r/melbourne, r/brisbane, r/perth
  - 过滤travel相关帖子

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with 11, 12, 14)
  - **Blocks**: Task 15
  - **Blocked By**: Task 10

  **Acceptance Criteria**:
  - [ ] 可以获取r/australia的热门帖子

  **Commit**: YES
  - Message: `feat(mcp): add Reddit API for local recommendations`

---

- [ ] 14. Intent Routing更新

  **What to do**:
  - 更新 `cloudflare/api-worker/src/intent-classifier.ts`
  - 添加travel intent识别
  - 配置routing到travel RAG + Yelp/Places APIs

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 18
  - **Blocked By**: None

  **References**:
  - **Pattern References**: 
    - `cloudflare/api-worker/src/intent-classifier.ts` - 现有intent routing

  **Acceptance Criteria**:
  - [ ] "悉尼有什么好玩的" 被路由到travel intent

  **Commit**: YES
  - Message: `feat(intent): add travel intent routing`

---

- [ ] 15. API集成测试

  **What to do**:
  - 测试Yelp API各端点
  - 测试Google Places新功能
  - 测试Reddit API (如已实现)
  - 验证错误处理和rate limiting

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with 16, 17, 18)
  - **Blocks**: None
  - **Blocked By**: Tasks 7, 8, 13

  **Acceptance Criteria**:
  - [ ] 所有API端点返回有效数据
  - [ ] Rate limit处理正确

  **Commit**: NO

---

- [ ] 16. RAG质量测试

  **What to do**:
  - 测试travel相关查询的RAG返回质量
  - 验证embedding相似度正确
  - 测试中英文查询

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: None
  - **Blocked By**: Task 12

  **QA Scenarios**:
  ```
  Scenario: Sydney travel query
    Tool: Bash (curl)
    Steps:
      1. curl -X POST "http://localhost:3000/api/rag/query" -d '{"query": "悉尼有什么好玩的"}'
      2. Assert: Response contains Sydney Opera House or similar
    Expected Result: Relevant Sydney attractions
    Evidence: .sisyphus/evidence/task-16-rag-sydney.json

  Scenario: Food query
    Tool: Bash (curl)
    Steps:
      1. curl -X POST "http://localhost:3000/api/rag/query" -d '{"query": "Melbourne best coffee"}'
      2. Assert: Response mentions Melbourne coffee culture
    Expected Result: Coffee recommendations
    Evidence: .sisyphus/evidence/task-16-rag-coffee.json
  ```

  **Commit**: NO

---

- [ ] 17. Cloudflare上传

  **What to do**:
  - 运行 `python3 scripts/upload_to_cloudflare.py`
  - 验证Vectorize index更新
  - 验证D1数据库更新

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: Task 18
  - **Blocked By**: Task 12

  **Acceptance Criteria**:
  - [ ] Cloudflare Vectorize index包含travel数据
  - [ ] `wrangler d1 execute` 查询返回travel chunks

  **Commit**: NO

---

- [ ] 18. E2E测试

  **What to do**:
  - 通过iOS app或API测试完整流程
  - 测试旅行查询从intent到response
  - 验证Yelp/Places数据正确返回

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`playwright`]

  **Parallelization**:
  - **Can Run In Parallel**: NO (final verification)
  - **Parallel Group**: Wave 4 (after 17)
  - **Blocks**: None
  - **Blocked By**: Tasks 14, 17

  **QA Scenarios**:
  ```
  Scenario: Full travel query flow
    Tool: Bash (curl)
    Steps:
      1. curl -X POST "https://australian-api.your-domain.workers.dev/api/chat" -d '{"message": "悉尼有什么好玩的地方推荐？"}'
      2. Assert: Response contains attractions
      3. Assert: Response includes ratings or reviews
    Expected Result: Comprehensive travel recommendation
    Evidence: .sisyphus/evidence/task-18-e2e-travel.json
  ```

  **Commit**: NO

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Verify all travel data files exist, all APIs respond, intent routing works

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run linters, check for API key leaks, verify error handling

- [ ] F3. **Real Manual QA** — `unspecified-high` + `playwright`
  Test actual travel queries through the app

- [ ] F4. **Scope Fidelity Check** — `deep`
  Verify no scope creep, all planned features implemented

---

## Commit Strategy

| Task Group | Commit Message | Files |
|------------|----------------|-------|
| 1-5 | `feat(travel): add state travel guide data` | `data/rag-sources/travel/**/*.md` |
| 7 | `feat(mcp): add Yelp API integration` | `mcp-servers/yelp-mcp/*` |
| 8 | `feat(places): enhance with attractions` | `mcp-servers/google-places-mcp/*` |
| 9 | `feat(travel): add food and dining guides` | `data/rag-sources/travel/food/*` |
| 13 | `feat(mcp): add Reddit API (optional)` | `mcp-servers/reddit-mcp/*` |
| 14 | `feat(intent): add travel routing` | `cloudflare/api-worker/src/*` |

---

## Success Criteria

### Verification Commands
```bash
# Travel RAG data exists
ls data/rag-sources/travel/*/*.md | wc -l  # Expected: >= 30

# Yelp API works
curl "http://localhost:3000/mcp/yelp/search?location=sydney&term=restaurant&limit=1" | jq .  # Expected: JSON with businesses

# Travel intent routing
curl -X POST "http://localhost:3000/api/intent" -d '{"query": "悉尼有什么好玩的"}' | jq .intent  # Expected: "travel"

# RAG query quality
curl -X POST "http://localhost:3000/api/rag/query" -d '{"query": "Great Barrier Reef"}' | jq .results[0].content  # Expected: Contains reef info
```

### Final Checklist
- [ ] 所有8州旅行数据存在
- [ ] Yelp API可用
- [ ] Google Places增强完成
- [ ] Intent routing正确
- [ ] Cloudflare已更新
- [ ] E2E测试通过
