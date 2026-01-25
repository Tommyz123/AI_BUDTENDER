# AI Budtender 在线部署指南 (使用 Render)

本指南将教你如何将 AI Budtender 免费部署到 Render 平台，让其他人通过公网访问。

## 第一步：将代码上传到 GitHub

Render 需要从 GitHub 拉取你的代码。如果你还没有 GitHub 账号，请先注册。

1.  **初始化 Git (如果尚未初始化)**:
    在你的项目根目录打开终端，运行：
    ```bash
    git init
    git add .
    git commit -m "准备部署"
    ```

2.  **创建 GitHub 仓库**:
    *   登录 [GitHub](https://github.com)。
    *   点击右上角的 "+" -> "New repository"。
    *   Repository name 填入 `ai-budtender` (或其他你喜欢的名字)。
    *   确保选择 **Public** (公开) 或 **Private** (私有) 皆可（Render 都支持）。
    *   点击 "Create repository"。

3.  **推送代码**:
    按照 GitHub 页面上的提示，在你的本地终端运行类似命令（替换为你的仓库地址）：
    ```bash
    git remote add origin https://github.com/你的用户名/ai-budtender.git
    git branch -M main
    git push -u origin main
    ```

## 第二步：在 Render 上创建服务

1.  **注册/登录 Render**:
    *   访问 [render.com](https://render.com)。
    *   建议直接使用 "Sign in with GitHub" 登录。

2.  **创建 Web Service**:
    *   点击控制台右上角的 "New +" 按钮。
    *   选择 **"Web Service"**。

3.  **连接仓库**:
    *   在列表中找到你刚才创建的 `ai-budtender` 仓库，点击 "Connect"。
    *   (如果没有看到，点击 "Configure account" 授权 Render 访问你的 GitHub 仓库)。

4.  **配置服务 (关键步骤)**:
    填写以下信息：
    *   **Name**: `ai-budtender` (这将决定你的网址，如 `ai-budtender.onrender.com`)
    *   **Region**: 选择离你或是用户近的节点（如 Singapore 或 Oregon）。
    *   **Branch**: `main`
    *   **Root Directory**: (留空，默认根目录)
    *   **Runtime**: **Node**
    *   **Build Command**: `npm install` (默认即可)
    *   **Start Command**: `npm start` (默认即可)
    *   **Instance Type**: 选择 **Free** (免费版)。
        *   *注意：免费版在 15 分钟无流量后会休眠，再次访问需要等待约 50 秒启动。*

5.  **设置环境变量 (Environment Variables)**:
    这一步至关重要，否则机器人无法工作。
    *   向下滚动找到 "Environment Variables" 部分。
    *   点击 "Add Environment Variable"。
    *   **Key**: `OPENAI_API_KEY`
    *   **Value**: 填入你的 `sk-...` 开头的 OpenAI 密钥。
    *   再次点击 "Add Environment Variable"。
    *   **Key**: `NODE_VERSION`
    *   **Value**: `20.11.0` (或者你本地使用的 Node 版本，推荐 20)

6.  **部署**:
    *   点击页面底部的 **"Create Web Service"** 按钮。

## 第三步：验证上线

1.  **等待构建**: Render 会自动运行 `npm install` 并启动服务。你可以在页面上看到日志流。
2.  **访问地址**: 当日志显示 `Server running at ...` 并且状态变为 **Live** (绿色) 时，点击页面左上角的链接（例如 `https://ai-budtender.onrender.com`）。
3.  **测试**: 发送消息测试机器人是否正常回复。

---

## 常见问题

*   **Q: 第一次打开网页很慢？**
    *   A: 这是 Render 免费版的特性。如果一段时间没人访问，服务会“睡着”。你需要等它醒来（约1分钟）。如果想避免这个问题，可以升级到付费版（Starter，$7/月）。

*   **Q: 部署失败，日志说 Node 版本不对？**
    *   A: 请确保在环境变量中设置了 `NODE_VERSION` 为 `20` 或更高。

*   **Q: 回复报错？**
    *   A: 检查 Render 控制台的 Logs。如果是 500 错误，通常是 `OPENAI_API_KEY` 没填对。
