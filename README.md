# 🌿 AI Budtender - "Fried Rice"

AI Budtender 是一个基于 LLM 的智能导购系统，旨在模拟一位幽默、知识渊博的大麻产品专家 "Fried Rice" (炒饭哥)。他能够根据用户的模糊需求（如“想要放松”、“找点有创意的”）推荐合适的产品，并能巧妙地进行 Upsell（消费升级推荐）或在缺货时提供替代方案。

## ✨ 主要功能

-   **个性化 Agent Persona**: "Fried Rice" 拥有独特的个性，风趣幽默，像你的老朋友一样推荐产品。
-   **双重搜索引擎**:
    -   **语义向量搜索 (Vector Search)**: 使用 OpenAI `text-embedding-3-small` 模型进行深度语义匹配，能够理解复杂的感官描述和使用场景。
    -   **智能联想搜索 (Smart Search)**: 结合 LLM 推理，识别用户意图（如从 "Creative" 联想到 "Sativa"）。
-   **性能优化**:
    -   **LRU 缓存机制**: 内置支持 TTL 的 LRU 缓存，显著降低 API 调用频率并提升响应速度。
    -   **向量缓存**: 自动持久化产品 Embeddings，避免重复生成导致的成本和延迟。
-   **软预算限制**: 能够识别用户预算，但在遇到优质产品时，会尝试推荐稍微超预算的高性价比选项 (Upsell)。
-   **CSV 数据驱动**: 直接解析 CSV 库存文件，支持动态更新。
-   **Web 聊天界面**: 提供现代化的暗色系 Web 界面，支持实时对话。

## 🛠️ 技术栈

-   **Runtime**: Node.js
-   **Framework**: Express.js
-   **AI Model**: OpenAI `gpt-4o-mini` (Chat) & `text-embedding-3-small` (Embeddings)
-   **Data Processing**: `csv-parse`
-   **Testing**: Jest (Unit & Integration Tests)
-   **Frontend**: Vanilla HTML/CSS/JS

## 📂 目录结构

```text
├── src/
│   ├── agent/          # Agent 核心逻辑 (Persona, Prompt, OpenAI Client)
│   ├── data/           # 数据处理层 (CSV Parser, Repository)
│   ├── tools/          # 智能工具 (Smart Search, Product Details)
│   ├── utils/          # 通用工具 (Vector Store, LRU Cache)
│   └── server.js       # Express 服务器入口
├── public/             # 前端静态资源 (HTML, CSS, JS)
├── data/               # 数据文件存放 (NYE2.1.csv, embeddings.json)
├── tests/              # 测试文件 (Unit & Integration)
├── skills_V1/          # 项目管理与 AI Skill 定义文档
└── README.md
```

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

在项目根目录创建 `.env` 文件，并填入你的 OpenAI API Key：

```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx
PORT=3000
```

### 3. 运行项目

启动开发服务器：

```bash
npm start
```

打开浏览器访问 [http://localhost:3000](http://localhost:3000) 即可开始对话。

## 🧪 测试

本项目通过了严格的单元测试和集成测试，覆盖了核心业务逻辑、向量搜索、缓存机制以及 API 接口。

运行所有测试：

```bash
npm test
```

## 📝 许可证

ISC