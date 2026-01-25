# AI Budtender 部署指南

本指南将帮助你从零开始部署 AI Budtender 项目。

## 1. 环境准备 (Prerequisites)

确保你的部署环境已安装以下软件：

*   **Node.js**: 版本 v20 或更高 (推荐 v20 LTS)。
    *   检查命令: `node -v`
*   **OpenAI API Key**: 一个有效的 OpenAI API 密钥，用于驱动智能对话。

## 2. 安装依赖 (Installation)

在项目根目录下打开终端，运行以下命令安装所需依赖库：

```bash
npm install
```

## 3. 环境变量配置 (Configuration)

在项目根目录下创建一个名为 `.env` 的文件（可以复制 `.env.example`，如果有的话），并填入以下内容：

```env
# 必须配置
OPENAI_API_KEY=sk-your-openai-api-key-here

# 可选配置
PORT=3000
```

> **注意**: 请将 `sk-your-openai-api-key-here` 替换为你实际的 API 密钥。

## 4. 启动项目 (Running)

### 本地开发模式
如果你正在开发或测试，可以使用 `dev` 命令，它会在文件修改时自动重启服务器：

```bash
npm run dev
```

### 生产环境启动
正式运行时，请使用标准启动命令：

```bash
npm start
```

服务器启动后，通常会显示：
`Server running at http://localhost:3000`

## 5. 验证部署 (Verification)

1.  打开浏览器访问 `http://localhost:3000`。
2.  你应该能看到聊天界面。
3.  尝试发送一条消息（例如："推荐点帮助睡眠的产品"）。
4.  如果机器人回复正常且有幽默感，说明部署成功！

## 6. 常见问题 (FAQ)

*   **Q: 启动报错 "Error: Data file not found..."**
    *   A: 请确保 `data/NYE2.1.csv` 文件存在。项目依赖此文件作为产品数据库。

*   **Q: 机器人回复 "Tool execution failed"**
    *   A: 请检查你的 OpenAI API Key 是否有效，或者网络是否能连接到 OpenAI API。

*   **Q: 如何修改模型？**
    *   A: 目前模型在 `src/agent/brain.js` 中硬编码为 `gpt-4o-mini`。如需修改，请编辑该文件。
