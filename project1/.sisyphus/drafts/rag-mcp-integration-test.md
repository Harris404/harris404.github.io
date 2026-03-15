# Draft: RAG + MCP Integration Testing Plan

## Requirements (confirmed)

**User's Goal**: Test if RAG + MCP servers can work together with Qwen model

**Current Status**:
- ✅ iOS Demo app builds successfully
- ✅ Ollama API integration working (Qwen 2.5, 4.7GB)
- ✅ 10 MCP servers exist and working:
  - au-weather-mcp (天气)
  - abs-mcp-server (统计)
  - australian-postcodes-mcp (邮编)
  - education-mcp-server (教育)
  - transportnsw-mcp (NSW交通)
  - transport-vic-opendata (VIC交通)
  - transport-qld (QLD交通)
  - transport-wa (WA交通)
  - healthcare-au (医疗)
  - tga-artg-mcp (药品)
- ❌ RAG database does not exist yet
- ❌ iOS app does not connect to MCP servers yet
- ❌ Agent system not implemented yet

**User's Choice**: End-to-end integration testing (端到端集成测试)

## Technical Decisions

**Testing Scope**:
- Full workflow: User query → Qwen decides → Call RAG or MCP → Return response
- Components needed:
  1. RAG data preparation (Wave 2 of Sisyphus plan)
  2. MCP client in iOS (Task 16)
  3. Agent routing system (Task 18)
  4. Tool execution engine (Task 19)

**Implementation Approach**:
- Follow Sisyphus plan Waves 2-4
- Focus on integration testing, not production polish
- Use existing Ollama API (already working) instead of on-device MLX

## Scope Boundaries

**INCLUDE (from Sisyphus plan)**:
- Wave 2: RAG data preparation (Tasks 5-9)
- Wave 4 core tasks:
  - Task 16: MCP 客户端
  - Task 17: RAG 检索逻辑
  - Task 18: Agent 系统（查询路由）
  - Task 19: 工具调用执行器

**EXCLUDE (to speed up testing)**:
- Task 15: Full chat UI (use simple test interface instead)
- Task 20: Multi-turn conversation (single-turn first)
- Task 21: Map integration (not needed for basic testing)
- Wave 5: Optimization and App Store release

## Open Questions

1. **RAG data scope**: 
   - Sisyphus plan wants full data collection (Medicare, ATO, Visa, Housing)
   - For testing: Should we use a **small sample dataset** (10-20 docs) or **full collection** (~500 docs)?

2. **MCP server selection**:
   - You have 10 MCP servers available
   - For testing: Should we test **all 10** or **2-3 representative ones** (e.g., weather, postcode, transport)?

3. **Testing environment**:
   - Simulator testing only, or also **physical iPhone**?
   - Do you have a physical iPhone available for testing?

4. **Success criteria**:
   - What defines "正常运行" for you?
   - Example: "User asks '悉尼天气?' → Qwen decides to call weather API → Returns real BOM data"

## Research Findings

From Sisyphus plan:
- Task 13 (Function Calling) is the prerequisite for Tasks 16-19
- Task 9 (RAG database creation) is prerequisite for Task 17
- Wave 2 must complete before Wave 4 can start

## Next Actions

Awaiting clarification on open questions above before creating the work plan.
