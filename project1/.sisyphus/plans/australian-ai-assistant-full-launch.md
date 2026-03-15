# 澳洲AI助手（澳知AI）- 完整启动开发计划

## 概览

> **快速总结**：完成中澳AI助手iOS应用的开发，具备双重能力（咨询+事务执行），覆盖全部15个请求功能和澳洲全州交通集成，14-16周内在App Store + 小红书启动。
> 
> **交付成果**：
> - Qwen 3.5 API双模型架构（成本：¥0.56/1千次查询）
> - 4个新事务工具（签证提醒、文档生成器、合同分析器、邮件撰写器）
> - 完整交通覆盖（在现有NSW/QLD基础上增加VIC、WA、SA、ACT）
> - 增强的RAG知识库（海关、银行指南、邮件模板）
> - 带推送通知和PDF生成的iOS应用
> - 小红书营销活动（3篇帖子，目标第1周100个beta用户）
> 
> **预估工作量**：大型（14-16周内30-35个开发日）
> **并行执行**：是 - 6个波次，每波次4-8个任务
> **关键路径**：Qwen API → 签证提醒 → 文档生成器 → VIC交通 → 测试 → 启动

---

## 背景

### 原始需求
用户问"我们目前做了什么？"触发了全面的项目审计。通过战略性提问，揭示了核心关切：应用是否有足够的独特价值与Gemini/Doubao/ChatGPT竞争。在市场验证显示高风险领域有60-70%成功概率后，用户承诺全面启动，包含所有15个功能。

### 访谈总结
**关键讨论**：
- **平台决策**：用户选择独立iOS应用而非微信小程序，尽管研究显示100%学生使用微信。理由："很多华人不会用wechat"（目标ABC/PR持有者以及学生）。
- **功能优先级**：签证到期提醒被选为第1优先级（高用户价值，相对简单的3-4天实现）。
- **启动时间线**：选择完整功能完成（14-16周）而非快速启动（3周），以提供完整价值主张。
- **架构确认**：Cloudflare Workers + DeepSeek-v3（意图）+ Qwen 3.5 API（响应），不是本地设备推理。

**研究发现**：
- **竞争差距**：Gemini在通用查询上70-90%准确，但在澳洲法律细节上仅16-20%（2025年Allens基准测试）。垂直AI在高风险领域获胜。
- **财务可行性**：1,000用户时84%利润率（月利润¥41,000），第4个月盈亏平衡（约50用户），比ChatGPT Plus便宜73%。
- **功能覆盖**：7/15已实现（47%），4/15部分完成（27%），4/15缺失（27%）。咨询能力强，事务能力为零。
- **交通差距**：NSW+QLD = 42%人口覆盖。VIC（26%人口，墨尔本）完全缺失，尽管README声称"正常工作"。
- **Google护城河被高估**：REA与OpenAI合作（不是Google），交通数据公开（Open Data Hub），POLA 2024创造了有利于APAC托管解决方案的合规护城河。

### 战略背景
**市场机会**：833k留学生（2025年），295k新名额（2026年），140万华裔居民。经过验证的付费意愿（例如"Are You Dead?"应用登顶付费实用工具榜）。

**防御护城河**：
1. **API集成护城河**：4/21工具需要API密钥（NSW交通、Jina、DeepSeek、未来Qwen） - 竞争对手无法在没有相同注册的情况下复制
2. **RAG精选护城河**：27,008个手工精选块（197个签证文档，4个州的126个租房法律文档） - 花了数月构建
3. **成本优势**：¥49/月 vs ChatGPT ¥140/月（节省73%）通过模板路由优化
4. **POLA 2024合规**：数据保留在悉尼/新加坡（Cloudflare边缘），避免跨境隐私问题

---

## 工作目标

### 核心目标
交付生产就绪的iOS应用，具有15个功能（10个咨询 + 4个事务 + 1个实时数据），覆盖留学生/新移民从到达到定居的完整生命周期需求，在App Store启动，通过小红书驱动的用户获取，目标第1周100个beta用户。

### 具体交付成果
1. **后端**：集成Qwen 3.5 API的双模型架构（DeepSeek意图，Qwen响应）
2. **iOS推送通知**：签证到期提醒（90/60/30/7天），Centrelink截止日期，报税截止日期
3. **事务工具**：
   - 文档生成器（签证求职信、Centrelink申请、租房申请、税务摘要PDF）
   - 合同分析器（上传租房PDF → RAG法律审查 → 标记非法条款）
   - 邮件撰写器（带RAG引用的正式模板，用于房东纠纷、大学申请、签证咨询）
   - 优惠聚合器（OzBargain、UNiDAYS、学生折扣）
4. **交通完成**：VIC（PTV API）、WA（Transperth）、SA（Adelaide Metro）、ACT（Transport Canberra）
5. **RAG增强**：海关/入境流程、银行开户指南、工作政策（学生签证8105）、邮件模板库
6. **营销资产**：部署落地页，3篇小红书帖子配图片，beta注册流程
7. **App Store提交**：测试所有功能的iOS应用，提交审核

### 完成定义
- [ ] `bun test`通过所有新工具（事务功能100%测试覆盖）
- [ ] iOS应用在物理设备上运行，推送通知工作正常
- [ ] 通过代理执行的QA场景验证所有15个功能（`.sisyphus/evidence/`中的证据）
- [ ] 落地页上线于`https://aozhi.app`（或选择的域名）
- [ ] 3篇小红书帖子发布，每篇第1周2,000+浏览量
- [ ] App Store提交获批（beta TestFlight链接可用）
- [ ] 所有交通工具返回NSW/VIC/QLD的实时数据，WA/SA/ACT的静态数据
- [ ] 合同分析器检测至少5种非法条款模式（针对真实租房合同测试）

### 必须具备
1. **Qwen API成本优化**：必须达到≤¥0.60/1k查询（目标来自QWEN_API_INTEGRATION.md的¥0.56）
2. **推送通知可靠性**：必须在确切日期触发（签证到期D-90/60/30/7，Centrelink报告日期，10月31日税务截止日期）
3. **PDF生成质量**：文档必须符合ATO/DIBP/RTA提交标准（无需手动编辑）
4. **合同分析器准确性**：必须以≥90%召回率捕获非法条款（针对10份已知问题的真实合同测试）
5. **交通实时性**：NSW/VIC/QLD必须在5秒内返回实时出发时间
6. **POLA 2024合规**：所有API调用通过Cloudflare悉尼边缘路由（数据不离开APAC）
7. **小红书合规**：无夸大声明（"最好"、"第一"），引用.gov.au来源，使用置顶笔记放下载链接
8. **iOS App Store指南**：仅HTTPS，年龄验证（18+），隐私政策链接，无误导性截图

### 禁止具备（防护措施）
**AI废话模式**（来自竞争分析）：
- ❌ **文档生成器**：无通用问候语（"Dear Sir/Madam" → 使用实际收件人姓名），无过度正式（"I am writing to humbly request"），无填充段落（每个文档≤2页）
- ❌ **邮件撰写器**：无ChatGPT式过度礼貌（"I hope this email finds you well in these uncertain times"），直奔主题带上下文
- ❌ **合同分析器**：无模糊警告（"this clause may be problematic" → 引用具体RTA/VCAT条款编号）
- ❌ **代码质量**：生产环境无`console.log`，无`as any` / `@ts-ignore`（除非有注释），无空catch块
- ❌ **RAG数据**：无抓取的博客文章或Reddit评论（仅政府来源：.gov.au、.edu.au、官方API）

**范围边界**：
- ❌ **无微信集成**：用户明确拒绝了小程序策略，尽管有研究建议
- ❌ **无语音输入**：推迟到第2阶段（第17周+）基于beta反馈
- ❌ **无多语言UI**：仅中英文内容，UI保持中文优先（推迟日语/韩语到第3阶段）
- ❌ **无支付处理**：免费beta启动，第2个月根据用户反馈添加Apple Pay订阅
- ❌ **无达尔文(NT)交通**：人口太小（250k，1%），不值得API集成努力

**技术约束**：
- ❌ **无破坏现有工具的更改**：21个MCP工具必须保持向后兼容（jobs、property、weather等）
- ❌ **启动周无数据库迁移**：App Store提交前7天冻结D1架构
- ❌ **无Cloudflare Workers臃肿**：保持捆绑大小<1MB（当前：847KB），注意PDF生成库大小

---

## 验证策略（强制性）

> **零人工干预** — 所有验证都是代理执行。没有例外。
> 禁止要求"用户手动测试/确认"的验收标准。

### 测试决策
- **基础设施存在**：是（package.json中配置了bun test）
- **自动化测试**：新事务工具使用TDD，交通/RAG增强使用测试后
- **框架**：bun test（现有设置，快速执行）
- **TDD工作流**：每个事务工具（签证提醒、文档生成器、合同分析器、邮件撰写器）遵循RED（失败测试）→ GREEN（最小实现）→ REFACTOR

### QA政策
每个任务必须包含代理执行的QA场景（见下面的TODO模板）。
证据保存到`.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`。

**特定工具QA要求**：
- **后端API**（Qwen、工具）：使用Bash（curl） — 发送请求，断言状态+响应字段+延迟
- **iOS应用**：如果有Web预览，使用Playwright via dev browser，或使用interactive_bash（xcrun simctl）用于模拟器
- **推送通知**：使用Bash（apns-tool或curl到APNs） — 发送测试通知，通过设备日志验证交付
- **PDF生成**：使用Bash（curl下载PDF，pdfinfo验证元数据，pdftotext验证内容）
- **RAG查询**：使用Bash（curl到/chat端点带特定查询，断言响应包含预期知识块）

**证据要求**：
- API响应：`.sisyphus/evidence/task-{N}-api-response.json`中的JSON文件
- PDF输出：保存到`.sisyphus/evidence/task-{N}-sample-document.pdf`
- 截图：用于iOS UI验证的PNG文件
- 日志：推送通知交付、测试执行结果的终端输出

---

## 执行策略

### 并行执行波次

> 通过将独立任务分组到并行波次中来最大化吞吐量。
> 每个波次在下一个波次开始前完成。
> 目标：每波次5-8个任务。每波次少于3个任务（除最后一个）= 拆分不足。

```
波次1（基础 — 后端+基础设施，6个任务，4-5天）：
├── 任务1：Qwen API集成 [quick - 2天]
├── 任务2：iOS推送通知基础设施 [unspecified-high - 3天]
├── 任务3：PDF生成库设置 [quick - 1天]
├── 任务4：部署落地页 [quick - 1天]
├── 任务5：VIC交通实现 [unspecified-high - 3天]
└── 任务6：WA/SA/ACT交通存根 [quick - 2天]

波次2（事务工具 — 核心功能，4个任务，5-7天）：
├── 任务7：签证到期提醒系统（依赖：2）[unspecified-high - 4天]
├── 任务8：文档生成器工具（依赖：3）[unspecified-high - 4天]
├── 任务9：合同分析器工具（依赖：3）[deep - 5天]
└── 任务10：邮件撰写器工具 [unspecified-high - 3天]

波次3（RAG增强 — 知识库，4个任务，4-5天）：
├── 任务11：海关/入境流程RAG数据 [quick - 2天]
├── 任务12：银行指南RAG扩展 [quick - 2天]
├── 任务13：工作政策RAG增强 [quick - 2天]
└── 任务14：邮件模板RAG库 [quick - 2天]

波次4（次要功能，4个任务，3-4天）：
├── 任务15：优惠/折扣聚合器工具 [unspecified-high - 3天]
├── 任务16：iOS文档导出（依赖：8）[quick - 1天]
├── 任务17：iOS邮件分享集成（依赖：10）[quick - 1天]
└── 任务18：更正README交通状态 [quick - 0.5天]

波次5（集成测试，5个任务，4-5天）：
├── 任务19：后端集成测试（依赖：1,7,8,9,10,15）[deep - 3天]
├── 任务20：iOS应用端到端QA（依赖：2,16,17）[unspecified-high - 3天]
├── 任务21：交通全州验证（依赖：5,6）[quick - 1天]
├── 任务22：合同分析器真实合同测试（依赖：9）[unspecified-high - 2天]
└── 任务23：推送通知交付测试（依赖：7）[unspecified-high - 2天]

波次6（营销+预启动，4个任务，5-6天）：
├── 任务24：小红书内容创作（3篇帖子+图片）[writing - 3天]
├── 任务25：iOS App Store提交准备 [quick - 2天]
├── 任务26：分析和监控设置 [quick - 1天]
└── 任务27：Beta注册流程 + TestFlight [unspecified-high - 2天]

波次FINAL（独立启动验证，4个任务，2-3天）：
├── 任务F1：计划合规审计（oracle）[1天]
├── 任务F2：代码质量审查（unspecified-high）[1天]
├── 任务F3：真实手动QA - 所有15个功能（unspecified-high + playwright）[2天]
└── 任务F4：范围保真检查（deep）[1天]

关键路径：任务1 → 任务2 → 任务7 → 任务19 → 任务23 → 任务27 → F1-F4
并行加速：比顺序快约65%（6个波次中的27个任务 vs 27个顺序任务）
最大并发：6个任务（波次1）
总预估：28-35个日历日（14-16周兼职，每周2-3天）
```

### 依赖矩阵

**波次1**（基础）：
- **1**（Qwen API）：— → 19
- **2**（推送基础设施）：— → 7, 20, 23
- **3**（PDF库）：— → 8, 9, 16
- **4**（落地页）：— →（无阻塞者）
- **5**（VIC交通）：— → 21
- **6**（WA/SA/ACT交通）：— → 21

**波次2**（事务工具）：
- **7**（签证提醒）：2 → 19, 23
- **8**（文档生成器）：3 → 16, 19
- **9**（合同分析器）：3 → 19, 22
- **10**（邮件撰写器）：— → 17, 19

**波次3**（RAG增强）：
- **11-14**（RAG数据）：— → 19（间接，改善LLM响应）

**波次4**（次要功能）：
- **15**（优惠工具）：— → 19
- **16**（iOS PDF导出）：8 → 20
- **17**（iOS邮件分享）：10 → 20
- **18**（README修复）：— →（仅文档）

**波次5**（集成测试）：
- **19**（后端测试）：1,7,8,9,10,15 → F1-F4
- **20**（iOS E2E QA）：2,16,17 → F1-F4
- **21**（交通验证）：5,6 → F1-F4
- **22**（合同测试）：9 → F1-F4
- **23**（通知测试）：7 → F1-F4

**波次6**（营销+预启动）：
- **24**（小红书内容）：— →（启动日）
- **25**（App Store准备）：20 → 27
- **26**（分析）：— →（启动日）
- **27**（TestFlight）：25 →（启动日）

**波次FINAL**：
- **F1-F4**：19,20,21,22,23 →（启动批准）

### 代理调度摘要

- **波次1**：6个任务 — `quick`（T1,3,4,6），`unspecified-high`（T2,5）
- **波次2**：4个任务 — `deep`（T9），`unspecified-high`（T7,8,10）
- **波次3**：4个任务 — `quick`（T11,12,13,14）
- **波次4**：4个任务 — `quick`（T16,17,18），`unspecified-high`（T15）
- **波次5**：5个任务 — `deep`（T19），`unspecified-high`（T20,22,23），`quick`（T21）
- **波次6**：4个任务 — `quick`（T25,26），`unspecified-high`（T27），`writing`（T24）
- **FINAL**：4个任务 — `oracle`（F1），`deep`（F4），`unspecified-high`（F2,F3带playwright技能）

---

## 待办事项

> 实现+测试 = 一个任务。永远不要分开。
> 每个任务必须有：推荐的代理配置文件+并行化信息+QA场景。
> **没有QA场景的任务是不完整的。没有例外。**

- [ ] 1. Qwen API集成

  **要做的事**：
  - 从https://dashscope.aliyun.com/获取Qwen API密钥（阿里云通义千问）
  - 修改`cloudflare/api-worker/src/llm.js`：
    - 添加构造函数参数：`qwenUrl`、`qwenKey`、`qwenModel`（默认：qwen-plus）
    - 添加`analyzeIntent(messages, options)`方法 → 调用DeepSeek API进行意图检测（现有chatJSON逻辑）
    - 添加`generateResponse(messages, options)`方法 → 调用Qwen API生成响应（现有chat逻辑）
    - 添加`_callAPI(baseUrl, apiKey, model, messages, options)`通用方法用于两个API
  - 更新`cloudflare/api-worker/src/intent.js`第~86行：
    - 更改`await this.llm.chatJSON(...)` → `await this.llm.analyzeIntent(...)`
  - 更新`cloudflare/api-worker/src/chat.js`第~324行：
    - 更改`await llm.chat(...)` → `await llm.generateResponse(...)`
  - 更新`cloudflare/api-worker/wrangler.toml`：添加QWEN_API_KEY、QWEN_BASE_URL密钥
  - 部署：`cd cloudflare/api-worker && npx wrangler deploy`
  - 添加密钥：`npx wrangler secret put QWEN_API_KEY`、`npx wrangler secret put QWEN_BASE_URL`
  - 编写测试：`src/__tests__/llm-qwen.test.js`（测试双模型路由、成本计算）

  **禁止做**：
  - 不要对意图和响应使用单一模型（必须保持双模型架构）
  - 不要在源代码中硬编码API密钥（必须使用wrangler密钥）
  - 不要跳过成本跟踪（必须记录¥/查询用于监控）

  **推荐的代理配置文件**：
  - **类别**：`quick`
    - 理由：文档完善的集成（存在带代码示例的QWEN_API_INTEGRATION.md），直接的API交换
  - **技能**：[]
    - 不需要专业技能（标准REST API集成）
  - **已评估但省略的技能**：
    - `git-master`：不需要（简单的功能提交，无复杂的git操作）

  **并行化**：
  - **可以并行运行**：是
  - **并行组**：波次1（与任务2、3、4、5、6）
  - **阻塞**：任务19（后端集成测试）
  - **被阻塞**：无（可立即开始）

  **参考**：

  **模式参考**：
  - `QWEN_API_INTEGRATION.md:81-143` — 完整的Qwen API集成指南，带LLM类修改的代码示例
  - `cloudflare/api-worker/src/llm.js:1-142` — 当前LLM类结构（仅DeepSeek），显示在哪里添加Qwen方法

  **API/类型参考**：
  - `QWEN_API_INTEGRATION.md:29-48` — Qwen API端点格式
  - `QWEN_API_INTEGRATION.md:203-237` — 成本计算（qwen-plus：¥0.0004/1k输入，¥0.002/1k输出）

  **测试参考**：
  - `cloudflare/api-worker/src/__tests__/` — 测试文件位置（在此创建llm-qwen.test.js）

  **外部参考**：
  - 官方文档：https://help.aliyun.com/zh/dashscope/developer-reference/api-details — Qwen API认证和请求格式

  **为什么每个参考都重要**：
  - QWEN_API_INTEGRATION.md提供要复制的确切代码片段（analyzeIntent、generateResponse方法）
  - 当前llm.js显示Qwen要复制的现有DeepSeek模式（构造函数、fetch逻辑、错误处理）
  - 成本计算对"必须具备"要求至关重要（≤¥0.60/1k查询）

  **验收标准**：
  - [ ] 创建测试文件：`src/__tests__/llm-qwen.test.js`，带5+测试（analyzeIntent、generateResponse、成本计算、错误处理、回退到DeepSeek）
  - [ ] `bun test src/__tests__/llm-qwen.test.js` → 通过（所有5个测试，0个失败）
  - [ ] 配置密钥：`npx wrangler secret list`显示QWEN_API_KEY和QWEN_BASE_URL

  **QA场景（强制性）**：

  ```
  场景：双模型架构工作（DeepSeek意图，Qwen响应）
    工具：Bash（curl）
    先决条件：配置Qwen API密钥，部署worker
    步骤：
      1. curl -X POST https://api-worker.your-domain.workers.dev/chat \
           -H "Content-Type: application/json" \
           -d '{"message":"悉尼天气怎么样?","language":"zh"}' \
           -w "\nTime: %{time_total}s\n"
      2. 检查响应JSON有"answer"字段，带中文天气信息
      3. 检查Cloudflare Workers日志显示："[Intent] Using DeepSeek"然后"[Chat] Using Qwen"
    预期结果：<3s内响应，中文答案，日志确认双模型路由
    失败指标：错误500，"answer"字段为空，日志仅显示单一模型，响应时间>5s
    证据：.sisyphus/evidence/task-1-qwen-dual-model.json（保存curl响应）

  场景：成本在预算内（≤¥0.60/1k查询）
    工具：Bash（curl +计算）
    先决条件：部署启用成本日志记录的worker
    步骤：
      1. for i in {1..10}; do curl -X POST https://api-worker.your-domain.workers.dev/chat \
           -H "Content-Type: application/json" \
           -d '{"message":"Calculate tax for $50000","language":"en"}' \
           -s | jq -r '.cost' >> costs.txt; done
      2. 计算平均值：awk '{sum+=$1} END {print sum/NR}' costs.txt
      3. 乘以1000得到每1k查询成本
    预期结果：平均成本≤¥0.0006每查询（¥0.60/1k）
    失败指标：成本>¥0.0006，响应中无成本字段，计算错误
    证据：.sisyphus/evidence/task-1-cost-analysis.txt（保存costs.txt和平均值）
  ```

  **要捕获的证据**：
  - [ ] 每个证据文件命名：task-1-{scenario-slug}.{ext}
  - [ ] API调用的响应JSON，成本分析的costs.txt，双模型确认的日志

  **提交**：是
  - 消息：`feat(backend): integrate Qwen 3.5 API dual-model architecture`
  - 文件：`cloudflare/api-worker/src/llm.js`、`src/intent.js`、`src/chat.js`、`wrangler.toml`、`src/__tests__/llm-qwen.test.js`
  - 预提交：`bun test`

- [ ] 2. iOS推送通知基础设施
  **代理**：`unspecified-high` | **依赖**：无 | **并行**：是，波次1
  **要做的事**：添加推送通知授权到`ios-app/QwenMLXiOSDemo/QwenMLXiOSDemo.entitlements`。创建带UNUserNotificationCenter集成的`Services/NotificationManager.swift`。首次启动时实现通知权限请求。创建D1数据库表用于用户通知首选项（visa_expiry_date、notification_enabled）。后端：为计划通知实现Cloudflare Durable Objects或Cron Triggers。测试APNs集成（开发+生产证书）。
  **禁止做**：不要使用第三方推送服务（OneSignal、Firebase） - 保持数据POLA合规
  **提交**：`feat(ios): add push notification infrastructure with APNs`

- [ ] 3. PDF生成库设置
  **代理**：`quick` | **依赖**：无 | **并行**：是，波次1
  **要做的事**：在`cloudflare/api-worker`中安装jsPDF或PDFKit：`npm install jspdf`。创建带基础模板函数的实用工具`src/utils/pdf-generator.js`。测试捆绑大小影响：`npx wrangler deploy --dry-run`（必须保持<1MB）。在`src/__tests__/pdf-generator.test.js`中创建示例PDF生成测试。
  **禁止做**：不要使用大型PDF库（pdfmake 900KB） - 偏好轻量级jsPDF（~200KB）
  **提交**：`feat(backend): add PDF generation library setup (jsPDF)`

- [ ] 4. 部署落地页
  **代理**：`quick` | **依赖**：无 | **并行**：是，波次1
  **要做的事**：购买域名`aozhi.app`或替代（Cloudflare Registrar或Namecheap）。部署`landing-page/index.html`到Cloudflare Pages：`cd landing-page && npx wrangler pages deploy .`。添加Google Analytics跟踪代码。在iPhone/Android模拟器上测试移动响应性。添加DNS记录：A记录+www的CNAME。
  **提交**：`feat(docs): deploy landing page to Cloudflare Pages`

- [ ] 5. VIC交通实现
  **代理**：`unspecified-high` | **依赖**：无 | **并行**：是，波次1
  **要做的事**：研究PTV（Public Transport Victoria）API。申请PTV API密钥（可能需要ABN或使用案例说明）。按照transport.js模式创建`cloudflare/api-worker/src/tools/transport-vic.js`。实现墨尔本地铁、电车、公交的实时出发。在`tools/index.js`中注册工具为`transport_vic`。编写测试：`src/__tests__/transport-vic.test.js`。
  **禁止做**：不要抓取PTV网站 - 仅使用官方API。在验证实时数据前不要声称"正常工作"状态。
  **提交**：`feat(tools): add Victoria transport (PTV API integration)`

- [ ] 6. WA/SA/ACT交通存根
  **代理**：`quick` | **依赖**：无 | **并行**：是，波次1
  **要做的事**：创建`cloudflare/api-worker/src/tools/transport-wa.js`（Transperth GTFS静态数据）。创建`transport-sa.js`（Adelaide Metro）。创建`transport-act.js`（Transport Canberra）。从https://transitfeeds.com/下载GTFS源。解析GTFS提取站点名称+静态时刻表（无实时）。在`tools/index.js`中注册3个工具。更新README.md反映"仅静态时刻表"状态。
  **提交**：`feat(tools): add WA/SA/ACT transport stubs (static GTFS)`

- [ ] 7. 签证到期提醒系统
  **代理**：`unspecified-high` | **依赖**：T2 | **并行**：否，波次2
  **要做的事**：后端API `/reminders/subscribe`（POST签证到期日期）→ 保存到D1 → Durable Object在D-90/60/30/7天安排APNs。iOS：设置屏幕输入签证到期。测试：模拟日期触发30天提醒，验证APNs交付。
  **提交**：`feat(backend+ios): visa expiry reminder system with push notifications`

- [ ] 8. 文档生成器工具
  **代理**：`unspecified-high` | **依赖**：T3 | **并行**：否，波次2
  **要做的事**：创建`tools/document-generator.js`。模板：签证求职信（DIBP格式）、Centrelink申请（用用户数据预填）、租房申请（标准NSW/VIC表格）、税务摘要（ATO myTax风格）。使用RAG将相关签证/政策信息注入模板。返回PDF作为base64或R2 URL。
  **防护措施**：每个文档最多2页，无"Dear Sir/Madam"（使用实际收件人），无填充段落。
  **提交**：`feat(tools): add document generator (visa, Centrelink, rental, tax PDFs)`

- [ ] 9. 合同分析器工具
  **代理**：`deep` | **依赖**：T3 | **并行**：否，波次2
  **要做的事**：创建`tools/contract-analyzer.js`。接受PDF上传（multipart/form-data）→ 提取文本（pdf-parse）→ RAG搜索租房法律 → 检测非法条款（押金>4周，VIC无宠物条款，不公平提前终止）。返回带警告的注释JSON + RTA/VCAT条款引用。用10份真实租房合同测试（5 NSW，3 VIC，2 QLD）。
  **防护措施**：每个警告必须引用具体法律条款编号（例如，"NSW Residential Tenancies Act 2010 s65(1)"）。无模糊"may be problematic"。
  **提交**：`feat(tools): add contract analyzer with RAG legal review`

- [ ] 10. 邮件撰写器工具
  **代理**：`unspecified-high` | **依赖**：无 | **并行**：否，波次2
  **要做的事**：创建`tools/email-composer.js`。模板：房东纠纷（正式，引用租房法）、大学延期申请（礼貌，引用政策）、签证咨询（专业语气）、Centrelink上诉信（结构化格式）、求职求职信（简洁，澳洲风格）。使用RAG注入相关政策引用。语气调整选项：formal/polite/assertive。
  **防护措施**：无AI废话（"I hope this email finds you well in these uncertain times"）。直奔主题带上下文。
  **提交**：`feat(tools): add email composer with formal templates`

- [ ] 11. 海关/入境流程RAG数据
  **代理**：`quick` | **依赖**：无 | **并行**：是，波次3
  **要做的事**：抓取https://www.abf.gov.au/（澳大利亚边防局）获取：禁止物品、免税限额、生物安全规则、SmartGate流程、首次到达清单。保存到`data/rag-sources/government/customs/`。用`scripts/rag-processor.js`处理。验证添加100+块到RAG数据库。
  **提交**：`feat(rag): add customs and entry process knowledge base`

- [ ] 12. 银行指南RAG扩展
  **代理**：`quick` | **依赖**：无 | **并行**：是，波次3
  **要做的事**：抓取ANZ、CBA、Westpac、NAB网站获取"留学生开户"指南。保存到`data/rag-sources/government/banking/`。处理到RAG。验证覆盖：所需文件、100分ID检查、无费用学生账户、在线vs分行流程。
  **提交**：`feat(rag): expand banking guides for international students`

- [ ] 13. 工作政策RAG增强
  **代理**：`quick` | **依赖**：无 | **并行**：是，波次3
  **要做的事**：抓取https://immi.homeaffairs.gov.au/获取学生签证条款8105（工作时间限制）、TFN申请流程、Fair Work最低工资更新。保存到`data/rag-sources/government/work-policies/`。处理到RAG。验证覆盖：学期期间20小时/周，假期40小时/周，违规处罚。
  **提交**：`feat(rag): enhance work policies for student visa holders`

- [ ] 14. 邮件模板RAG库
  **代理**：`quick` | **依赖**：无 | **并行**：是，波次3
  **要做的事**：创建`data/rag-sources/templates/emails/`，带20+模板：房东纠纷、大学延期、签证咨询、Centrelink上诉、求职申请、实习申请、推荐信申请、投诉信。每个模板包括：主题行、开头、正文结构、结束语、语气说明。处理到RAG用于邮件撰写器工具（T10）。
  **提交**：`feat(rag): add email template library for composer tool`

- [ ] 15. 优惠/折扣聚合器工具
  **代理**：`unspecified-high` | **依赖**：无 | **并行**：是，波次4
  **要做的事**：创建`tools/deals.js`。数据源：OzBargain API（如果可用，否则抓取RSS）、UNiDAYS学生折扣（API集成）、Student Beans集成。类别：杂货（Coles/Woolworths每周特价）、手机套餐（Optus/Telstra学生折扣）、公用事业（电力/互联网优惠）。缓存结果24小时（Cloudflare KV）。
  **提交**：`feat(tools): add deals and discounts aggregator`

- [ ] 16. iOS文档导出
  **代理**：`quick` | **依赖**：T8 | **并行**：是，波次4
  **要做的事**：添加`Services/DocumentExporter.swift`。集成文档生成器工具（T8）→ 接收PDF base64 → 解码 → 显示iOS分享表（保存到文件、邮件、AirDrop）。测试：生成签证求职信 → 点击导出 → 保存到文件应用 → 验证PDF正确打开。
  **提交**：`feat(ios): add document export with share sheet`

- [ ] 17. iOS邮件分享集成
  **代理**：`quick` | **依赖**：T10 | **并行**：是，波次4
  **要做的事**：添加`Services/EmailShareManager.swift`。集成邮件撰写器工具（T10）→ 接收邮件文本 → 显示预填主题+正文的MFMailComposeViewController。测试：生成房东邮件 → 点击发送邮件 → 验证邮件应用打开并显示正确内容。
  **提交**：`feat(ios): add email share integration with Mail app`

- [ ] 18. 更正README交通状态
  **代理**：`quick` | **依赖**：无 | **并行**：是，波次4
  **要做的事**：更新`README.md:71-80`交通状态表。将VIC从"正常工作"更改为实际状态（如果T5完成则为"正常工作"，否则为"进行中"）。添加WA/SA/ACT行，状态为"仅静态GTFS"。更新人口覆盖百分比。
  **提交**：`docs(transport): correct status table with accurate implementation state`

- [ ] 19. 后端集成测试
  **代理**：`deep` | **依赖**：T1,T7,T8,T9,T10,T15 | **并行**：是，波次5
  **要做的事**：创建`src/__tests__/integration.test.js`。测试工作流：(1)聊天流程：意图检测 → 工具调用 → RAG搜索 → 响应生成。(2)签证提醒流程：订阅 → 验证D1存储 → 模拟日期触发 → 验证Durable Object计划。(3)文档生成：请求签证求职信 → 验证返回PDF字节 → pdftotext提取正确内容。(4)合同分析：上传测试PDF → 验证非法条款检测。运行`bun test` → 全部通过。
  **提交**：`test(backend): add integration tests for all major workflows`

- [ ] 20. iOS应用端到端QA
  **代理**：`unspecified-high`（如果需要+`playwright`技能）| **依赖**：T2,T16,T17 | **并行**：是，波次5
  **要做的事**：在物理设备或模拟器上测试：(1)新安装 → 权限请求（通知、文件访问）。(2)与后端聊天："悉尼天气" → 验证中文响应。(3)设置签证提醒 → 验证保存通知设置。(4)生成文档 → 导出到文件 → 验证保存PDF。(5)撰写邮件 → 分享到邮件 → 验证预填。保存截图到`.sisyphus/evidence/task-20-ios-qa/`。
  **提交**：`test(ios): end-to-end QA on device with all features`

- [ ] 21. 交通全州验证
  **代理**：`quick` | **依赖**：T5,T6 | **并行**：是，波次5
  **要做的事**：测试所有交通工具：NSW（实时）、VIC（如果T5完成则实时）、QLD（实时）、WA/SA/ACT（静态）。验证实时响应时间<5s，静态<2s。将实时数据与官方应用（TripView、PTV、TransLink）比较。记录覆盖：如果VIC完成则89%人口（NSW+VIC+QLD = 19.1M / 25.7M）。保存证据JSON。
  **提交**：`test(transport): verify all states with real-time and static data`

- [ ] 22. 合同分析器真实合同测试
  **代理**：`unspecified-high` | **依赖**：T9 | **并行**：是，波次5
  **要做的事**：收集10份真实租房合同（匿名个人数据）。5 NSW，3 VIC，2 QLD。手动识别已知非法条款（押金>4周，VIC无宠物，不公平终止）。上传每份到合同分析器。计算召回率：检测到的条款/总已知条款。必须达到≥90%召回率。保存结果到`.sisyphus/evidence/task-22-contract-testing/`。
  **提交**：`test(tools): validate contract analyzer with 10 real contracts`

- [ ] 23. 推送通知交付测试
  **代理**：`unspecified-high` | **依赖**：T7 | **并行**：是，波次5
  **要做的事**：模拟系统日期在D-90、D-60、D-30、D-7触发签证提醒。验证APNs有效载荷包括：标题、正文（中英文）、深层链接（打开应用到签证信息屏幕）。在物理设备上测试（不是模拟器，APNs在模拟器中不工作）。验证Cloudflare Durable Objects中的交付日志。保存截图+日志。
  **提交**：`test(ios): validate push notification delivery at all trigger intervals`

- [ ] 24. 小红书内容创作
  **代理**：`writing` | **依赖**：无 | **并行**：是，波次6
  **要做的事**：按照`XIAOHONGSHU_CONTENT_PLAN.md:81-180`创建3篇帖子。帖子1：Centrelink计算器指南（显示应用截图计算JobSeeker）。帖子2：租房法律审查工具演示（上传合同 → 突出显示非法条款）。帖子3：交通比较（悉尼vs墨尔本实时准确性）。在创客贴/Canva设计封面图片（3:4比例，多彩，带文字覆盖）。撰写标题（300-500字符，包括表情符号，标签：#澳洲留学 #澳洲生活 #留学生必备）。
  **提交**：`feat(marketing): create 3 小红书 posts with images and captions`

- [ ] 25. iOS App Store提交准备
  **代理**：`quick` | **依赖**：T20 | **并行**：是，波次6
  **要做的事**：准备App Store资产：应用图标（1024x1024）、截图（6.7" iPhone、12.9" iPad）、隐私政策（托管在落地页）、应用描述（中英文）。更新`Info.plist`，添加隐私使用字符串（NSUserNotificationsUsageDescription、NSPhotoLibraryUsageDescription）。增加构建编号。归档构建：`xcodebuild archive` → 导出IPA → 通过Transporter上传到App Store Connect。
  **提交**：`feat(ios): prepare App Store submission with assets and build`

- [ ] 26. 分析和监控设置
  **代理**：`quick` | **依赖**：无 | **并行**：是，波次6
  **要做的事**：添加Google Analytics到落地页（跟踪页面浏览、按钮点击、beta注册）。添加Cloudflare Workers Analytics（跟踪API端点使用、错误率、响应时间）。添加iOS Crashlytics（Firebase或Sentry）用于崩溃报告。创建仪表板监控：每日活跃用户、API成本、最常用工具、错误率。
  **提交**：`feat(monitoring): add analytics and crash reporting`

- [ ] 27. Beta注册流程 + TestFlight
  **代理**：`unspecified-high` | **依赖**：T25 | **并行**：是，波次6
  **要做的事**：在落地页创建beta注册表单（邮箱+微信ID可选）。保存到D1数据库`beta_users`表。发送带TestFlight链接的自动回复邮件。配置TestFlight用于外部测试（最多10,000个beta测试者）。创建入职邮件序列：第0天（欢迎+功能）、第3天（使用技巧）、第7天（反馈请求）。目标：从小红书第1周100个注册。
  **提交**：`feat(launch): add beta signup flow with TestFlight distribution`

---

## 最终验证波次（强制性 — 在所有实现任务后）

> 4个审查代理并行运行。所有必须批准。拒绝 → 修复 → 重新运行。

- [ ] F1. **计划合规审计** — `oracle`
  
  端到端阅读计划。对于每个"必须具备"：验证实现存在（读取文件、curl端点、运行命令）。对于每个"禁止具备"：搜索代码库查找禁止模式 — 如果发现则拒绝并标注文件:行。检查`.sisyphus/evidence/`中存在证据文件。将交付成果与计划比较。
  
  **具体检查**：
  - Qwen API成本：curl聊天端点100次，计算平均成本，验证≤¥0.60/1k查询
  - 推送通知：检查`.sisyphus/evidence/task-7-*`是否有交付确认日志（90/60/30/7天触发器）
  - PDF质量：打开4个示例PDF（签证、Centrelink、租房、税务），验证ATO/DIBP格式合规
  - 合同分析器：检查`.sisyphus/evidence/task-9-real-contracts/`是否有10份测试合同，≥90%召回率
  - 交通实时：curl NSW/VIC/QLD端点，验证响应时间<5s
  - 所有15个功能：映射到任务证据，验证每个都有通过的QA场景
  
  输出：`必须具备 [8/8] | 禁止具备 [0违规] | 功能 [15/15] | 证据 [27/27任务] | 判决：批准/拒绝`

- [ ] F2. **代码质量审查** — `unspecified-high`
  
  运行`bun test` + `tsc --noEmit` + linter。审查所有更改的文件查找：生产中的`console.log`（src/，不是scripts/）、`as any`/`@ts-ignore`（仅允许带注释）、空catch、未使用的导入。检查AI废话：通用名称（data/result/item）、过多注释、过度抽象。
  
  **具体检查**：
  - 文档生成器：搜索"Dear Sir/Madam"、"I hope this email"，统计总页数（必须≤2）
  - 邮件撰写器：搜索"I hope this email finds you well"、"in these uncertain times"
  - 合同分析器：搜索"may be problematic"，验证所有警告引用RTA/VCAT条款编号
  - 捆绑大小：检查`wrangler deploy`输出，验证<1MB（当前847KB，PDF库增加~100KB）
  
  输出：`构建 [通过/失败] | Lint [N问题] | 测试 [N/N通过] | AI废话 [N违规] | 捆绑 [XKB/1024KB] | 判决`

- [ ] F3. **真实手动QA - 所有15个功能** — `unspecified-high`（如果有Web预览+`playwright`技能）
  
  从干净状态开始（新iOS模拟器+空D1数据库）。从用户角度测试每个功能：
  
  **咨询功能**（7个）：
  1. Centrelink：询问"我是否有资格获得JobSeeker？我22岁，学生，每周赚$400" → 验证计算
  2. 签证信息：询问"我应该何时续签学生签证500？" → 验证3-6个月指导
  3. 银行：询问"作为留学生如何开ANZ账户？" → 验证RAG返回正确指南
  4. 税务：询问"计算$45,000收入的税" → 验证使用FY2024-25税率
  5. 工作权利：询问"我可以用学生签证每周工作30小时吗？" → 验证引用条款8105
  6. 工作：搜索"悉尼兼职工作 $25/小时" → 验证返回结果
  7. 交通：询问"从Central到Circular Quay的下一班火车" → 验证NSW实时数据
  
  **事务功能**（4个）：
  8. 签证提醒：将签证到期设置为从现在起90天 → 验证收到推送通知（检查设备日志）
  9. 文档生成器：请求"500延期的签证求职信" → 验证PDF下载，<2页，无"Dear Sir/Madam"
  10. 合同分析器：上传带非法条款的示例租房合同（押金>4周）→ 验证带RTA引用的警告
  11. 邮件撰写器：请求"给房东关于坏掉的加热器的邮件" → 验证正式语气，无过度礼貌
  
  **实时数据**（1个）：
  12. 交通VIC：询问"从Melbourne Central出发的电车" → 验证PTV实时数据
  
  **附加**（3个）：
  13. 优惠：询问"笔记本电脑的学生折扣" → 验证UNiDAYS/OzBargain结果
  14. 海关：询问"我可以带2公斤牛肉干到澳洲吗？" → 验证引用生物安全规则
  15. 所有州交通：测试NSW/VIC/QLD实时，WA/SA/ACT静态数据
  
  **集成测试**（跨功能）：
  - 生成签证求职信 → 附加到邮件撰写器 → 验证无缝流程
  - 设置签证提醒 → 收到通知 → 点击 → 打开应用到签证信息
  - 搜索租房 → 分析合同 → 给房东发邮件 → 验证工作流
  
  保存证据：每个功能的截图到`.sisyphus/evidence/final-qa/feature-{N}-{name}.png`，API调用的终端日志。
  
  输出：`功能 [15/15通过] | 集成 [N/N] | 发现的错误 [列表] | 判决`

- [ ] F4. **范围保真检查** — `deep`
  
  对于每个任务：阅读"要做的事"，阅读实际差异（修改文件的git log/diff，新文件的ls）。验证1:1 — 规范中的所有内容都已构建（无缺失），规范之外的内容未构建（无蔓延）。检查"禁止做"合规性。
  
  **具体检查**：
  - 任务1（Qwen API）：验证双模型架构（DeepSeek意图，Qwen响应），不是单一模型
  - 任务7（签证提醒）：验证90/60/30/7天触发器，不仅仅是30天
  - 任务9（合同分析器）：验证PDF上传+ RAG搜索+非法条款检测，不仅仅是文本分析
  - 任务5（VIC交通）：验证PTV API集成，不仅仅是OpenData抓取
  - 防护措施：验证无微信集成代码，无语音输入，无中英文之外的多语言UI
  
  检测跨任务污染：任务N接触任务M的文件（例如，任务8修改任务9的合同分析器）。标记未记录的更改（修改的文件未在任何任务规范中提及）。
  
  输出：`任务 [27/27合规] | 防护措施 [0违规] | 污染 [干净/N问题] | 未记录 [干净/N文件] | 判决`

---

## 提交策略

**提交频率**：每个任务完成后（27个实现任务=至少27个提交）。

**提交消息格式**：`type(scope): description`
- 类型：`feat`（新功能）、`fix`（错误）、`refactor`（代码改进）、`docs`（文档）、`test`（测试）、`chore`（配置/工具）
- 范围：`backend`、`ios`、`rag`、`docs`、`tools/{tool-name}`、`transport`

**示例**：
- 任务1：`feat(backend): integrate Qwen 3.5 API dual-model architecture`
- 任务7：`feat(ios): add visa expiry push notification system`
- 任务9：`feat(tools): add contract analyzer with RAG legal review`
- 任务18：`docs(transport): correct VIC status in README (missing, not working)`

**预提交检查**：每次提交前运行`bun test`（如果配置则由git hook强制执行）。

**分支策略**：
- 主开发：`main`分支（单人开发，不需要PR工作流）
- 测试期间的热修复：`fix/{issue-name}`分支，修复验证后立即合并

**最终启动提交**：所有F1-F4批准通过后：
```
feat(launch): Australian AI Assistant v1.0 - complete 15-feature implementation

- Backend: Qwen API, 4 transaction tools, 6 states transport
- iOS: Push notifications, PDF export, email share
- RAG: 30k+ chunks (visa, tax, rental, customs, banking)
- Marketing: Landing page, 小红书 content
- Testing: 100% feature coverage, all QA scenarios pass

Closes #1 (full launch milestone)
```

---

## 成功标准

### 验证命令

**后端健康检查**：
```bash
# 验证Qwen API集成
curl -X POST https://api-worker.your-domain.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is Centrelink?","language":"zh"}' \
  | jq '.answer,.cost'
# 预期：中文答案，成本≤0.00056（¥0.56/1k查询）

# 验证所有工具已注册
curl https://api-worker.your-domain.workers.dev/tools | jq '.tools | length'
# 预期：25（21个现有+4个新事务工具）

# 验证交通端点
curl "https://api-worker.your-domain.workers.dev/transport?state=VIC&stop=Melbourne%20Central"
# 预期：5秒内PTV实时出发
```

**iOS应用验证**：
```bash
# 在模拟器上运行
cd ios-app/QwenMLXiOSDemo
xcodebuild -scheme QwenMLXiOSDemo -destination 'platform=iOS Simulator,name=iPhone 15' test
# 预期：所有测试通过

# 验证推送通知授权
grep -A 5 "aps-environment" QwenMLXiOSDemo.entitlements
# 预期：<string>development</string>或<string>production</string>
```

**测试套件**：
```bash
cd cloudflare/api-worker
bun test
# 预期：所有测试通过，新工具覆盖率≥80%
```

**捆绑大小**：
```bash
cd cloudflare/api-worker
npx wrangler deploy --dry-run | grep "bundle size"
# 预期：<1MB（目标：带PDF库950KB）
```

### 最终检查清单

**必须具备**（全部8项已验证）：
- [ ] Qwen API成本≤¥0.60/1k查询（通过100个真实请求测量）
- [ ] 推送通知在确切日期触发（用模拟日期测试，验证日志显示90/60/30/7天触发器）
- [ ] PDF符合提交标准（审查4个样本：签证、Centrelink、租房、税务 — 全部<2页，正确格式）
- [ ] 合同分析器≥90%召回率（测试10份真实合同，标记9/10个已知非法条款）
- [ ] 交通实时<5s响应（NSW/VIC/QLD curl测试10次，平均2.3s）
- [ ] POLA 2024合规（所有API日志显示悉尼边缘来源，无跨境数据流）
- [ ] 小红书合规（审查3篇帖子：无"最好/第一"，所有数据引用自.gov.au，下载链接在置顶笔记）
- [ ] iOS App Store指南满足（HTTPS ✓，年龄验证✓，隐私政策✓，截图准确✓）

**禁止具备**（全部0违规）：
- [ ] 零AI废话违规（搜索代码库：无"Dear Sir/Madam"，无"I hope this email finds you well"，无模糊警告）
- [ ] 零范围蔓延（搜索代码库：无微信SDK，无语音输入，无中英文之外的多语言UI）
- [ ] 零技术债务（src/中无`console.log`，无不带注释的`@ts-ignore`，无空catch）
- [ ] 零捆绑臃肿（<1MB通过wrangler deploy --dry-run验证）

**交付成果**（全部存在）：
- [ ] 15个功能工作（7咨询，4事务，1实时数据，3附加）
- [ ] 6州交通（NSW/VIC/QLD实时，WA/SA/ACT静态）
- [ ] 落地页上线（https://aozhi.app或选择的域名）
- [ ] 3篇小红书帖子发布（每篇第1周2,000+浏览量）
- [ ] iOS应用在TestFlight（beta链接可用，邀请10个内部测试者）
- [ ] `.sisyphus/evidence/`中的27个证据文件（每个任务一个，所有QA场景记录）

**启动就绪**：
- [ ] App Store提交获批（beta或生产发布）
- [ ] 分析跟踪（落地页上的Cloudflare Analytics + Google Analytics）
- [ ] 监控（Cloudflare Workers错误日志，iOS Crashlytics）
- [ ] Beta注册流程（从小红书第1周目标100个注册）
- [ ] 支持渠道（beta用户反馈的邮箱或微信）
