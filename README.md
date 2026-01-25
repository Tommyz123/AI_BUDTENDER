# 🌿 AI Budtender - "Fried Rice"

AI Budtender 是一个基于 LLM 的智能导购系统，旨在模拟一位幽默、知识渊博的大麻产品专家 "Fried Rice" (炒饭哥)。他能够根据用户的模糊需求（如“想要放松”、“找点有创意的”）推荐合适的产品，并能巧妙地进行 Upsell（消费升级推荐）或在缺货时提供替代方案。

## ✨ 主要功能

-   **个性化 Agent Persona**: "Fried Rice" 拥有独特的个性，风趣幽默，像你的老朋友一样推荐产品。
-   **智能联想搜索 (Smart Search)**:
    -   结合 OpenAI `gpt-4o-mini` 模型，理解用户意图（如从 "Creative" 联想到 "Sativa"）。
    -   支持复杂的语义搜索，而不仅仅是关键词匹配。
    -   **软预算限制**: 能够识别用户预算，但在遇到优质产品时，会尝试推荐稍微超预算的高性价比选项 (Upsell)。
-   **CSV 数据驱动**: 直接解析 CSV 库存文件，无需复杂的外部数据库。
-   **Web 聊天界面**: 提供现代化的暗色系 Web 界面，支持实时对话。

## 🛠️ 技术栈

-   **Runtime**: Node.js
-   **Framework**: Express.js
-   **AI Model**: OpenAI `gpt-4o-mini` (via Function Calling)
-   **Data Processing**: `csv-parse`
-   **Testing**: Jest (Unit & Integration Tests)
-   **Frontend**: Vanilla HTML/CSS/JS

## 📂 目录结构

```text
├── src/
│   ├── agent/          # Agent 核心逻辑 (Persona, Prompt, OpenAI Client)
│   ├── data/           # 数据处理层 (CSV Parser, Repository)
│   ├── tools/          # 智能工具 (Smart Search, Product Details)
│   └── server.js       # Express 服务器入口
├── public/             # 前端静态资源 (HTML, CSS, JS)
├── data/               # 数据文件存放 (NYE2.1.csv)
├── tests/              # 测试文件 (Unit & Integration)
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

本项目通过了严格的单元测试和集成测试，覆盖了核心业务逻辑、Agent 意图识别以及 API 接口。

运行所有测试：

```bash
npm test
```

## 📝 许可证

ISC
