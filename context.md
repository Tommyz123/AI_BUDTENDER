# 🗺️ AI Budtender Project Context

> **目标读者**: AI 助手 (Claude/GPT) & 核心维护者
> **用途**: 快速建立上下文，减少 Token 消耗，精准定位修改点。

## 1. 核心逻辑地图 (Core Logic Map)

### 🧠 Agent & 核心交互
- **`src/agent/brain.js`**: **[中枢]** 负责 LLM 会话管理、工具调度 (Function Calling)、历史上下文维护。
- **`src/agent/prompts.js`**: **[人设]** 定义 "Fried Rice" 的 System Prompt、Tone of Voice 及 Few-Shot 示例。
- **`src/server.js`**: **[入口]** Express 服务器，处理 `/api/chat` 请求，连接 Frontend 与 Brain。

### 🔍 数据 & 搜索 (RAG)
- **`src/data/product-repository.js`**: **[数据层]** 解析 `data/NYE2.1.csv`，提供基础 CRUD 和内存过滤。
- **`src/utils/vector-store.js`**: **[向量引擎]** 封装 OpenAI Embeddings API，处理向量生成、余弦相似度计算及缓存。
- **`src/tools/smart-search.js`**: **[搜索策略]** 混合搜索逻辑，决定何时用模糊查询，何时用向量搜索。
- **`src/utils/cache.js`**: **[性能]** 通用 LRU 缓存实现，用于减少重复的 LLM 或搜索计算。

### 🎨 前端交互
- **`public/js/chat.js`**: **[客户端]** 处理 UI 渲染、Markdown 解析、与后端 API 通信。

---

## 2. 依赖关系链 (Dependency Chain)

修改某一模块时，**必须**同步检查的文件：

| 修改场景 | 主要修改文件 | ⚠️ 级联影响 (必须检查) |
| :--- | :--- | :--- |
| **调整 Agent 人设/语气** | `src/agent/prompts.js` | `src/agent/brain.js` (Prompt 注入逻辑)<br>`tests/agent.test.js` (预期回答测试) |
| **修改 CSV 数据结构** | `data/NYE2.1.csv` | `src/data/product-repository.js` (解析逻辑)<br>`src/utils/vector-store.js` (Embedding 生成字段)<br>`src/tools/product-details.js` (详情展示) |
| **优化搜索算法** | `src/tools/smart-search.js` | `src/utils/vector-store.js` (接口兼容性)<br>`tests/smart-search.test.js` |
| **修改 UI/样式** | `public/css/style.css` | `public/js/chat.js` (动态类名)<br>`src/server.js` (静态资源路径) |
| **新增 LLM 工具** | `src/tools/` (新建文件) | `src/agent/brain.js` (注册工具)<br>`src/agent/prompts.js` (工具描述/System Prompt) |

---

## 3. 性能与重构热点 (Refactoring Hotspots)

以下代码区域逻辑最密集，是优化的首选目标：

1.  **`src/agent/brain.js` (主循环逻辑)**
    *   **现状**: `processMessage` 函数承担了太多职责（历史记录修剪、工具调用循环、错误重试）。
    *   **优化**: 建议将“上下文管理”和“工具执行器”拆分为独立的 Class，避免文件膨胀。

2.  **`src/data/product-repository.js` (内存占用)**
    *   **现状**: 启动时一次性加载整个 CSV 到内存。
    *   **风险**: 数据量若超过 10k 条，启动变慢且内存飙升。
    *   **优化**: 引入 SQLite 或 Stream 流式读取（如果保持无数据库架构）。

3.  **`src/utils/vector-store.js` (Embedding 生成)**
    *   **现状**: 依赖 `data/embeddings.json` 文件缓存。
    *   **风险**: 并发写入时可能导致 JSON 文件损坏；缓存未命中时 API 延迟较高。
    *   **优化**: 考虑迁移到向量数据库 (如 Chroma/Pinecone) 或增加文件锁机制。

4.  **`public/js/chat.js` (渲染逻辑)**
    *   **现状**: 使用原生 JS 拼接 HTML 字符串。
    *   **风险**: 难以维护复杂的交互（如产品卡片点击、多轮对话状态）。
    *   **优化**: 考虑引入轻量级框架 (Vue/React) 或 Web Components。

---

## 4. 快速启动上下文 (For AI Context Injection)

*复制以下块给 Claude，即可让其跳过读取全量代码：*

```markdown
Project: AI Budtender (Node.js/Express)
Architecture:
- Frontend: Vanilla JS/HTML/CSS (public/)
- Backend: Express (src/server.js)
- AI Core: OpenAI GPT-4o-mini + Function Calling (src/agent/)
- Data: CSV file -> In-memory Repository (src/data/) -> Vector Search (src/utils/)

Key Files:
- src/agent/brain.js: Main agent loop & tool execution.
- src/agent/prompts.js: System prompt & persona definitions.
- src/utils/vector-store.js: Semantic search implementation.

Current Focus: Optimization & Refactoring.
```
