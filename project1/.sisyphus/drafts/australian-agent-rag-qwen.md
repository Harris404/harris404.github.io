# 澳洲 Agent RAG + Qwen 集成 - 规划草稿

## 访谈记录

### 用户背景
- 已有 7 个 MCP 服务器运行（22 个端点）
- 目标：iOS App + 本地 Qwen 模型 + MCP 工具调用
- 覆盖：NSW + VIC 交通（58% 人口），天气、统计、邮编、教育

### 用户需求（本次）
1. **识别静态数据缺口** - 哪些领域需要 RAG 补充？
2. **评估 API 完整性** - 现有数据源是否足够？
3. **Qwen 模型选择** - iOS 部署用哪个版本？

---

## 分析结论

### 1. 静态数据缺口（RAG 必需）

#### 🔥 高优先级（MVP 必需）
1. **政府服务知识库**
   - Medicare 申请流程
   - 税务常见问题（ATO）
   - 签证类型和要求
   - 规模：~50MB

2. **医疗设施数据**
   - 医院/诊所位置
   - Bulk billing 诊所列表
   - 规模：~10MB

3. **租赁法律文档**
   - 各州租赁法规
   - 租客权利
   - 规模：~5MB

#### ⭐ 中优先级（V1.0）
4. **学校评分数据**（补充 CRICOS）
5. **房产价格参考**（补充 ABS）
6. **驾照和交规**

#### 💡 低优先级（V2.0）
7. 餐厅美食
8. 旅游景点
9. 银行产品对比

**总规模估计：** 第一批 ~100MB

---

### 2. API 覆盖评估

#### ✅ 完整覆盖
- 天气：BOM（全澳）
- 统计：ABS（全澳）
- 邮编：18,500+ 记录
- 教育：CRICOS 20,000+ 课程
- 交通 NSW：完整
- 交通 VIC：完整

#### ⚠️ 部分覆盖
- 交通：仅 NSW + VIC（58% 人口）
- 教育：缺少学校评分

#### ❌ 缺失领域
- 医疗服务（推荐：HealthDirect API）
- 房产价格（可用 ABS 免费数据）
- 交通 QLD + WA（推荐：TransLink + Transperth）

**改进建议：**
1. 添加 QLD + WA 交通 → 89% 人口覆盖
2. 添加 HealthDirect API（免费）
3. 用 RAG 补充学校评分

---

### 3. Qwen 模型推荐

#### 主推：Qwen2.5-1.5B-Instruct-Q8
- **设备兼容：** iPhone 14+ (6GB RAM)
- **文件大小：** 1.7GB
- **推理速度：** 10-15 tokens/s
- **质量：** 95%+ 原始精度
- **Context：** 128K（实际用 4-8K）

#### 备选：Qwen2.5-0.5B-Instruct-Q4
- **设备兼容：** iPhone 12/13 (4GB RAM)
- **文件大小：** 300MB
- **推理速度：** 20-25 tokens/s
- **质量：** 90% 原始精度

#### 部署技术栈
- **推荐：** MLX（Apple 优化）
- **备选：** llama.cpp
- **Embedding：** BGE-small-en-v1.5（50MB）
- **向量库：** SQLite-VSS

---

## 工作计划大纲

### Wave 1: 扩展 API 覆盖（1-2 周）
- 添加 TransLink QLD API
- 添加 Transperth WA API
- 添加 HealthDirect API
- 测试和文档

### Wave 2: RAG 数据准备（1-2 周）
- 收集政府文档（Medicare、ATO、签证）
- 数据清洗和结构化
- 转为向量格式（BGE-small）
- 导入 SQLite-VSS

### Wave 3: Qwen 模型集成（2-3 周）
- 转换 Qwen2.5-1.5B 为 MLX
- iOS Demo 项目
- Function calling 测试
- 性能基准测试

### Wave 4: iOS App 开发（4-5 周）
- SwiftUI 聊天界面
- MCP 客户端集成
- RAG 检索逻辑
- Agent 系统实现

### Wave 5: 优化和发布（2-3 周）
- 性能优化
- Beta 测试
- App Store 发布

**总时间：** 10-13 周

---

## 下一步行动
1. 生成详细工作计划到 `.sisyphus/plans/`
2. 包含具体任务、验收标准、并行策略
3. 用户运行 `/start-work` 开始执行
