# 多Agent架构重构：澳知AI专门化系统

## TL;DR

> **核心目标**: 将单体AI助手（1个IntentAgent + 22工具）重构为5个专门化Agent系统（Life、Finance、Education、Healthcare、Wellness），使用Router + Coordinator混合编排模式。
>
> **交付成果**:
> - 5个专门化Agent（各自独立的系统Prompt + 工具集 + RAG分类）
> - 1个Router Agent（意图分类 + 跨域协调）
> - 编排层（orchestrator.js）替换现有chat.js的单体逻辑
> - 完整测试套件（50个测试用例：40单域 + 10跨域）
>
> **预估工作量**: 中等（Medium） - 4周冲刺
> **并行执行**: YES - 4波次（Wave 1-4）
> **关键路径**: Router基础 → Agent基类 → Life+Finance → 剩余Agents → 测试验证

---

## Context

### 原始需求

用户提出将应用重构为多Agent系统：
- **原话**："一个agent专门负责生活，一个agent专门负责财务，一个agent专门负责教育与学习，还有一个agent专门负责精神质量"
- **目标**：提升专业性、个性化、可扩展性
- **约束**：4周完成，直接替换旧架构（不保留fallback）

### 研究发现

通过3个并行研究代理（explore + librarian）：

1. **工具分配分析** (explore agent `bg_c51fa25f`)：
   - 22个现有工具成功映射到5个域（增加Healthcare独立域）
   - 识别出12个缺失工具（生活常识、俚语、合同分析、景点详情等）
   - 5个跨域共享工具需要冲突处理（web-search, postcodes, directions, nearby, places）

2. **编排模式研究** (explore agent `bg_d0aad1f9`)：
   - **推荐**: Router + Coordinator混合（OpenAI Swarm, CrewAI模式）
   - 单域查询（80%）用Router直接路由 → 低延迟
   - 跨域查询（20%）用Coordinator并行调用 → 合并结果
   - 上下文共享通过共享state对象（conversation history + user preferences）

3. **Agent设计最佳实践** (librarian agent `bg_38390e36`)：
   - **系统Prompt**: XML结构化（identity, scope, personality, tools, reasoning_protocol）
   - **性格原型**: Life=Bridge（桥梁）, Finance=Vigilant Advisor（谨慎顾问）, Healthcare=Compassionate Guide（同理心向导）
   - **双语策略**: 语言检测 + 文化上下文评估（高语境中文 vs 低语境英文）
   - **防范**: Scope creep（范围蠕变）、Conflicting advice（矛盾建议）、Cultural flattening（文化刻板）

### 用户决策

- ✅ **5个Agent**（Life, Finance, Education, Healthcare, Wellness）- 医疗独立
- ✅ **4周冲刺**时间线
- ✅ **直接替换**旧架构（不保留旧代码）

---

## Work Objectives

### 核心目标

将现有单体架构（`cloudflare/api-worker/src/chat.js` + `intent.js`）完全重构为多Agent系统，实现：
1. **专业化**：每个Agent只处理自己的领域，拒绝超范围查询
2. **个性化**：每个Agent有独特的语气和风格（Life亲切 vs Finance专业）
3. **可扩展**：添加新工具或新Agent不影响现有Agent
4. **性能优化**：上下文成本降低75%（2,000 tokens → 500 tokens per query）

### 具体交付成果

#### 1. 编排层（Orchestration Layer）
- `cloudflare/api-worker/src/orchestrator.js` - Router + Coordinator逻辑
- `cloudflare/api-worker/src/agents/base-agent.js` - Agent抽象基类

#### 2. 5个专门化Agent
- `agents/life.js` - 生活助手（12工具）
- `agents/finance.js` - 财务顾问（6工具 + 3 RAG类别）
- `agents/education.js` - 教育规划师（2工具 + 2 RAG类别）
- `agents/healthcare.js` - 医疗向导（2工具 + 3 RAG类别）
- `agents/wellness.js` - 生活品质（5工具 + 2 RAG类别）

#### 3. Agent配置文件（System Prompts）
- `agents/prompts/life-prompt.xml` - Life Agent的XML结构化Prompt
- `agents/prompts/finance-prompt.xml`
- `agents/prompts/education-prompt.xml`
- `agents/prompts/healthcare-prompt.xml`
- `agents/prompts/wellness-prompt.xml`
- `agents/prompts/router-prompt.xml` - Router Agent分类逻辑

#### 4. 测试套件
- `tests/orchestrator.test.js` - Router分类测试
- `tests/agents/life.test.js` - 每个Agent的单元测试
- `tests/integration/cross-domain.test.js` - 跨域查询测试
- `tests/data/test-queries.json` - 50个测试用例（40单域 + 10跨域）

#### 5. 文档
- `docs/MULTI_AGENT_ARCHITECTURE.md` - 架构说明
- `docs/AGENT_PROMPT_GUIDE.md` - Agent Prompt编写指南
- `docs/MIGRATION_GUIDE.md` - 从单体架构迁移指南

---

## Definition of Done

### 验收标准

#### 功能完整性
- [ ] Router能正确分类所有5个域（life, finance, education, healthcare, wellness）
- [ ] 单域查询延迟 <2s（P95）
- [ ] 跨域查询延迟 <4s（P95）
- [ ] 所有22个现有工具在对应Agent中正常工作
- [ ] 每个Agent能正确拒绝超范围查询并提示路由到其他Agent

#### 测试覆盖
- [ ] 50个测试用例全部通过（40单域 + 10跨域）
- [ ] 单元测试覆盖率 >85%（orchestrator.js + 所有Agent）
- [ ] 集成测试覆盖所有Agent间handoff场景

#### 性能指标
- [ ] 上下文token消耗 <600 tokens per query（vs 旧架构2,000 tokens）
- [ ] API成本降低 >60%（测试1,000查询样本）
- [ ] 错误率 <2%（LLM幻觉、工具调用失败）

#### 代码质量
- [ ] 所有TypeScript类型定义完整
- [ ] ESLint无警告
- [ ] 所有Agent Prompt使用XML结构（符合Anthropic最佳实践）
- [ ] 代码审查通过（无重复逻辑、清晰注释）

---

## Must Have

### 核心功能（不可妥协）

1. **Router分类准确性 >95%**
   - 单域查询必须路由到正确Agent
   - 跨域查询必须触发Coordinator

2. **Agent独立性**
   - 每个Agent只能访问自己的工具
   - 不能调用其他Agent的工具（除了跨域共享工具）

3. **向后兼容**
   - 所有现有工具的API签名不变
   - 现有RAG数据库无需重建

4. **双语支持**
   - 所有Agent必须支持简体中文和英文
   - 自动检测用户语言并响应

5. **错误处理**
   - Agent报错不影响Router和其他Agent
   - 提供清晰的错误提示（"Healthcare Agent暂时不可用，请稍后重试"）

---

## Must NOT Have (Guardrails)

### 明确排除的内容

1. **❌ 不引入新的LLM提供商**
   - 继续使用DeepSeek（意图分析）+ Qwen（响应生成）
   - 不添加OpenAI、Anthropic等第三方API

2. **❌ 不修改现有工具的实现**
   - 22个工具的代码逻辑保持不变
   - 只调整工具的调用方式（从单体 → Agent隔离）

3. **❌ 不添加新工具（本次重构）**
   - 缺失的12个工具（俚语、合同分析等）留待Phase 2
   - 本次重构只聚焦架构变更，不做功能扩展

4. **❌ 不做UI/UX改动**
   - iOS应用界面保持不变
   - 用户感知不到后端架构变化（除了响应更精准）

5. **❌ 不改变RAG数据结构**
   - 现有27,008块RAG数据保持原样
   - 只调整RAG分类路由逻辑（government → Finance, healthcare → Healthcare）

6. **❌ AI Slop防范**
   - 不添加过度抽象的"AgentFactory"或"AgentManager"
   - 不创建超过3层的继承结构
   - 不写超过200行的单个函数

---

## Verification Strategy

### 测试决策

- **Infrastructure exists**: YES（bun test）
- **Automated tests**: YES（TDD for critical path）
- **Framework**: bun test（已配置）
- **Agent-Executed QA**: YES（每个任务包含Playwright/curl场景）

### QA策略

#### 单元测试（bun test）
每个Agent和Orchestrator都有独立的测试文件：
```bash
tests/
├── orchestrator.test.js        # Router分类逻辑
├── agents/
│   ├── life.test.js           # Life Agent工具调用
│   ├── finance.test.js
│   ├── education.test.js
│   ├── healthcare.test.js
│   └── wellness.test.js
└── integration/
    ├── single-domain.test.js  # 40个单域查询
    └── cross-domain.test.js   # 10个跨域查询
```

#### Agent-Executed QA场景
每个任务包含2-3个QA场景：
- **工具**: Bash（curl测试API）
- **证据路径**: `.sisyphus/evidence/task-{N}-{scenario}.json`
- **验证点**: HTTP status, response structure, agent field

示例：
```bash
# 场景1: Life Agent处理天气查询
curl -X POST http://localhost:8787/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"悉尼今天天气怎么样？","history":[]}' \
  > .sisyphus/evidence/task-5-life-weather.json

# 验证: response.agent === "life"
# 验证: response.tools_used includes "weather"
# 验证: response.content contains "悉尼" and "天气"
```

---

## Execution Strategy

### 并行执行波次

#### Wave 1: 核心基础设施（1周，7任务，可并行3-4个）
建立Router、Agent基类、测试框架

```
Wave 1 (Start Immediately):
├── Task 1: 创建Orchestrator骨架 [quick]
├── Task 2: 创建Agent基类 [quick]
├── Task 3: Router分类逻辑（单域） [unspecified-high]
├── Task 4: 创建测试框架 [quick]
├── Task 5: Life Agent Prompt + 基础实现 [unspecified-high]
├── Task 6: Finance Agent Prompt + 基础实现 [unspecified-high]
└── Task 7: 迁移chat.js到orchestrator [quick]

关键路径: T1 → T3 → T7
并发能力: T2,T4,T5,T6可同时进行
```

#### Wave 2: 剩余Agents + 工具分配（1周，6任务，可并行4个）
完成Education、Healthcare、Wellness Agent

```
Wave 2 (After Wave 1):
├── Task 8: Education Agent完整实现 [unspecified-high]
├── Task 9: Healthcare Agent完整实现 [unspecified-high]
├── Task 10: Wellness Agent完整实现 [unspecified-high]
├── Task 11: 工具隔离（Agent只访问自己的工具） [deep]
├── Task 12: RAG分类路由重构 [unspecified-high]
└── Task 13: 跨域共享工具冲突处理 [deep]

关键路径: T11 → T13
并发能力: T8,T9,T10,T12可同时进行
```

#### Wave 3: Coordinator + 跨域协调（1周，5任务，可并行2-3个）
实现跨域查询的并行调用和结果合并

```
Wave 3 (After Wave 2):
├── Task 14: Coordinator并行调用逻辑 [deep]
├── Task 15: 结果合并策略（去重、排序、格式化） [unspecified-high]
├── Task 16: 上下文共享机制（history + preferences） [deep]
├── Task 17: Agent handoff模式（Life → Finance） [unspecified-high]
└── Task 18: 错误处理和降级（Agent不可用时的fallback） [unspecified-high]

关键路径: T14 → T15 → T16
并发能力: T17,T18可与T14-T16并行部分overlap
```

#### Wave 4: 测试 + 优化（1周，6任务，可并行3-4个）
全面测试和性能优化

```
Wave 4 (After Wave 3):
├── Task 19: 单域查询测试套件（40个case） [unspecified-high]
├── Task 20: 跨域查询测试套件（10个case） [unspecified-high]
├── Task 21: 性能测试（延迟、成本、并发） [deep]
├── Task 22: Agent Prompt优化（根据测试结果） [quick]
├── Task 23: 文档编写（架构图、迁移指南） [writing]
└── Task 24: 部署到生产环境 [quick]

关键路径: T19,T20 → T21 → T22 → T24
并发能力: T19,T20可并行，T23可与T21并行
```

### 依赖矩阵

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| T1 | - | T3, T7 | 1 |
| T2 | - | T5, T6, T8-T10 | 1 |
| T3 | T1 | T7, T14 | 1 |
| T4 | - | T19, T20 | 1 |
| T5 | T2 | T11, T19 | 1 |
| T6 | T2 | T11, T19 | 1 |
| T7 | T1, T3 | T14 | 1 |
| T8 | T2 | T11 | 2 |
| T9 | T2 | T11 | 2 |
| T10 | T2 | T11 | 2 |
| T11 | T5-T10 | T13, T14 | 2 |
| T12 | T5-T10 | T14 | 2 |
| T13 | T11 | T14 | 2 |
| T14 | T7, T11, T13 | T15, T16 | 3 |
| T15 | T14 | T19, T20 | 3 |
| T16 | T14 | T17 | 3 |
| T17 | T16 | T20 | 3 |
| T18 | T14 | T21 | 3 |
| T19 | T4, T5, T6, T15 | T21 | 4 |
| T20 | T4, T15, T17 | T21 | 4 |
| T21 | T19, T20 | T22 | 4 |
| T22 | T21 | T24 | 4 |
| T23 | T15 | - | 4 |
| T24 | T22 | - | 4 |

### Agent调度摘要

- **Wave 1**: 7任务 → 使用 `quick`(4) + `unspecified-high`(3)
- **Wave 2**: 6任务 → 使用 `unspecified-high`(4) + `deep`(2)
- **Wave 3**: 5任务 → 使用 `deep`(3) + `unspecified-high`(2)
- **Wave 4**: 6任务 → 使用 `unspecified-high`(2) + `deep`(1) + `quick`(2) + `writing`(1)

---

## TODOs


### Wave 1: 核心基础设施（第1周）

- [ ] 1. 创建Orchestrator骨架

  **What to do**:
  - 创建 `cloudflare/api-worker/src/orchestrator.js`
  - 实现 `AgentOrchestrator` 类的基本结构
  - 定义 `route(message, history, context)` 方法签名
  - 暂时返回硬编码响应（"Router not implemented yet"）
  - 在 `worker.js` 中导入并注册orchestrator

  **Must NOT do**:
  - 不实现实际的分类逻辑（留给Task 3）
  - 不创建Agent实例（留给Task 2）
  - 不添加复杂的错误处理（先建立骨架）

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 简单的文件创建和类骨架，无复杂逻辑
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1（与T2, T4并行）
  - **Blocks**: T3（Router分类）, T7（chat.js迁移）
  - **Blocked By**: None（可立即开始）

  **References**:
  - Pattern: 参考 `cloudflare/api-worker/src/chat.js:10-40` - 现有的Handler类结构
  - API: `cloudflare/api-worker/src/worker.js:20-30` - Worker注册模式
  - Research: `.sisyphus/plans/multi-agent-architecture-refactor.md:技术实现代码片段` - Orchestrator伪代码

  **Acceptance Criteria**:

  **QA Scenarios**:
  ```
  Scenario: Orchestrator能被Worker正确调用
    Tool: Bash (curl)
    Preconditions: Worker已启动在localhost:8787
    Steps:
      1. curl -X POST http://localhost:8787/chat -H 'Content-Type: application/json' -d '{"message":"test","history":[]}'
      2. 检查响应status = 200
      3. 检查响应body包含 "Router not implemented yet"
    Expected Result: HTTP 200, JSON格式，包含占位符消息
    Failure Indicators: 500错误、Worker无法启动、响应非JSON
    Evidence: .sisyphus/evidence/task-1-orchestrator-init.json
  ```

  **Commit**: YES
  - Message: `feat(orchestrator): add AgentOrchestrator skeleton`
  - Files: `src/orchestrator.js`, `src/worker.js`
  - Pre-commit: `bun run lint`
