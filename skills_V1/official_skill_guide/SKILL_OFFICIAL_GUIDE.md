# Claude Code Skill 官方制作指南

> 基于 Claude Code 官方文档整理
> 整理时间: 2026-01-22

---

## 一、Skill 基本概念

### 1.1 什么是 Skill

- Skills 是扩展 Claude 能力的一种方式
- 通过创建 `SKILL.md` 文件，Claude 就能在工具包中添加新的能力
- Skills 遵循 [Agent Skills](https://agentskills.io) 开放标准，可跨多个 AI 工具使用
- Claude Code 在标准基础上扩展了额外功能：调用控制、子代理执行、动态上下文注入等

### 1.2 Skill 文件位置和作用域

| 位置 | 路径 | 作用域 | 优先级 |
|-----|------|-------|--------|
| 企业级 | 托管设置 | 整个组织所有用户 | 最高 |
| 个人 | `~/.claude/skills/<skill-name>/SKILL.md` | 所有项目 | 中 |
| 项目 | `.claude/skills/<skill-name>/SKILL.md` | 当前项目 | 中-低 |
| 插件 | `<plugin>/skills/<skill-name>/SKILL.md` | 启用的插件 | 低 |

**自动发现**：Claude Code 会自动从嵌套的 `.claude/skills/` 目录发现 Skill（对 monorepo 项目友好）

---

## 二、Skill 基本格式

### 2.1 完整格式模板

```yaml
---
name: skill-name                    # 必填：作为 /slash-command 的名称
description: What this skill does   # 推荐：Claude 用来决定何时加载
argument-hint: [optional-args]      # 可选：自动补全提示
disable-model-invocation: false     # 可选：是否禁止 Claude 自动调用
user-invocable: true                # 可选：是否在 / 菜单中显示
allowed-tools: Read, Grep, Glob     # 可选：限制可用工具
model: opus                         # 可选：指定模型
context: fork                       # 可选：在子代理中运行
agent: Explore                      # 可选：指定子代理类型
hooks: {}                           # 可选：生命周期钩子
---

# 你的 Skill 说明和指令内容

When doing X, always:
1. First do Y
2. Then do Z
```

### 2.2 Frontmatter 字段说明

| 字段 | 必需 | 说明 |
|------|------|------|
| `name` | 否 | 省略时使用目录名。只能包含小写字母、数字和连字符（最多 64 字符） |
| `description` | **推荐** | **非常重要**！控制 Claude 何时自动加载此 Skill。如省略，使用 Markdown 第一段 |
| `argument-hint` | 否 | 在 `/` 菜单中显示的参数提示，例如 `[issue-number]` 或 `[file] [format]` |
| `disable-model-invocation` | 否 | 设为 `true` 时，只有用户能通过 `/name` 调用，Claude 无法自动调用 |
| `user-invocable` | 否 | 设为 `false` 时，从 `/` 菜单隐藏，但 Claude 仍可调用。用于"背景知识" |
| `allowed-tools` | 否 | 此 Skill 中 Claude 可用的工具清单。示例：`Read, Grep, Glob, Bash(git:*)` |
| `model` | 否 | 此 Skill 使用的模型。例如 `opus` 或 `sonnet` |
| `context` | 否 | 设为 `fork` 时在子代理中运行，不能访问会话历史 |
| `agent` | 否 | 与 `context: fork` 配合使用。可选值：`Explore`, `Plan`, `general-purpose` |
| `hooks` | 否 | 针对此 Skill 的钩子，与全局钩子相同格式 |

---

## 三、调用控制

### 3.1 三种调用模式

**模式1：默认（用户和 Claude 都可调用）**
```yaml
---
name: my-skill
---
```
效果：你和 Claude 都可调用；Claude 自动加载（当相关时）

**模式2：仅用户调用（disable-model-invocation: true）**
```yaml
---
name: deploy
disable-model-invocation: true
---
Deploy to production: $ARGUMENTS
```
效果：只有用户能用 `/deploy` 调用。Claude 看不见此 Skill。
用途：**有副作用的工作流**（部署、发送消息）

**模式3：仅 Claude 调用（user-invocable: false）**
```yaml
---
name: legacy-system-context
user-invocable: false
---
Our legacy system works like this...
```
效果：只 Claude 能调用（自动加载）。用户看不到 `/legacy-system-context` 命令。
用途：**背景知识**

### 3.2 调用模式对照表

| 配置 | 用户能调用 | Claude 能调用 | 何时加载 |
|------|--------|------------|--------|
| 默认 | ✅ | ✅ | 当相关时 |
| `disable-model-invocation: true` | ✅ | ❌ | 仅用户调用时 |
| `user-invocable: false` | ❌ | ✅ | 当相关时 |

---

## 四、动态上下文

### 4.1 字符串替换

Skill 支持运行时替换：

```yaml
---
name: session-logger
description: Log session activity
---

Log the following to logs/${CLAUDE_SESSION_ID}.log:

$ARGUMENTS
```

**可用变量**：
- `$ARGUMENTS` — 调用 Skill 时传入的所有参数
- `${CLAUDE_SESSION_ID}` — 当前会话 ID

**注意**：如果 `$ARGUMENTS` 未出现在内容中，Claude Code 会自动在末尾追加 `ARGUMENTS: <value>`

### 4.2 动态命令执行

使用 `!`command`` 语法在发送给 Claude 前执行命令：

```yaml
---
name: pr-summary
description: Summarize pull request changes
---

## Pull request context
- PR diff: !`gh pr diff`
- PR comments: !`gh pr view --comments`

## Your task
Summarize this pull request...
```

命令输出会替换占位符，Claude 只看最终结果。

---

## 五、子代理执行（context: fork）

用于隔离执行的高阶特性：

```yaml
---
name: deep-research
description: Research a topic thoroughly
context: fork
agent: Explore
---

Research $ARGUMENTS thoroughly:

1. Find relevant files using Glob and Grep
2. Read and analyze code
3. Summarize findings with file references
```

**工作流**：
1. 创建隔离的子代理上下文
2. 子代理收到 Skill 内容作为其提示
3. `agent` 字段确定执行环境（模型、工具、权限）
4. 结果汇总回主会话

**注意**：子代理无法访问会话历史！需要在 Skill 中明确描述任务。

**可用 agent 类型**：
- `Explore` — 快速探索代码库
- `Plan` — 设计实现计划
- `general-purpose` — 通用代理

---

## 六、文件结构最佳实践

### 6.1 推荐目录结构

```
my-skill/
├── SKILL.md              # 主文件（必需，< 500 行）
├── reference.md          # 参考文档（可选，通过链接引用）
├── templates/
│   └── output-template.md
└── examples/
    └── sample-output.md
```

### 6.2 核心原则

1. **主文件 SKILL.md 保持简短** — < 500 行，推荐 < 200 行
2. **详细内容放支持文件** — 通过 Markdown 链接引用
3. **只在需要时加载** — Claude 按需读取支持文件

### 6.3 链接引用示例

```markdown
# My Skill

## 执行步骤
1. 分析需求
2. 生成输出（模板见 [output-template.md](./templates/output-template.md)）

## 详细规则
见 [reference.md](./reference.md)
```

---

## 七、写法风格指南

### 7.1 命令式 vs 说明式

**❌ 错误（说明式）**：
```markdown
### 明确性原则
**技术选型必须明确，只推荐一个**，禁止"A / B"模糊表述。
- ❌ 错误：数据库: PostgreSQL / MongoDB
- ✅ 正确：数据库: PostgreSQL（备注：如需NoSQL可考虑MongoDB）

这样做的原因是为了避免歧义，让开发人员能够明确知道应该使用什么技术...
```

**✅ 正确（命令式）**：
```markdown
## 强制规则

1. 技术选型只写一个，禁止"A / B"写法
2. 替代方案放在备注列
```

### 7.2 简洁步骤列表

**❌ 错误**：
```markdown
## 必需任务

生成项目计划书时，必须完成以下任务：

1. **读取需求文档**
   - 优先级：requirements.md > README.md > *.txt
   - 提取：项目愿景、目标用户、核心功能、约束条件、关键词

2. **分析代码库**
   - 检测项目类型（新建/升级）
   - 识别技术栈（读取依赖文件）
   - 分析项目结构和现有模块
...
```

**✅ 正确**：
```markdown
## 执行步骤

1. 读取需求文档（requirements.md > README.md > *.txt）
2. 分析代码库，判断项目类型
3. 根据阶段生成维度
4. 输出 PROJECT_PLAN_vN.md
```

### 7.3 添加输出自检清单

```markdown
## 输出前检查（必须全部通过）

- [ ] 维度数量正确？
- [ ] 必需章节都存在？
- [ ] 无"A / B"模糊写法？

任何一项未通过 → 修正后再输出
```

---

## 八、官方示例

### 8.1 简单命令 Skill

```yaml
---
name: fix-issue
description: Fix a GitHub issue
disable-model-invocation: true
---

Fix GitHub issue $ARGUMENTS following our coding standards.

1. Read the issue description
2. Implement the fix
3. Write tests
4. Create a commit
```

### 8.2 研究型 Skill（子代理）

```yaml
---
name: deep-research
description: Research a topic thoroughly
context: fork
agent: Explore
---

Research $ARGUMENTS thoroughly:

1. Find relevant files using Glob and Grep
2. Read and analyze code
3. Summarize findings with file references
```

### 8.3 动态内容 Skill

```yaml
---
name: pr-summary
description: Summarize pull request changes
---

## Context
- PR diff: !`gh pr diff`
- PR comments: !`gh pr view --comments`

## Task
Summarize this pull request focusing on:
1. What changed
2. Why it changed
3. Potential risks
```

### 8.4 背景知识 Skill

```yaml
---
name: coding-standards
description: Our team's coding standards and conventions
user-invocable: false
---

## Coding Standards

- Use TypeScript for all new code
- Follow ESLint rules
- Write tests for all new features
- Use conventional commits
```

---

## 九、创建 Skill 检查清单

创建新 Skill 时：

```
☐ 创建 SKILL.md 文件
☐ 编写清晰的 description（关键！）
☐ 指定 name（小写 + 连字符，≤64字符）
☐ 主文件 < 500 行（推荐 < 200 行）
☐ 详细内容放支持文件，用链接引用
☐ 使用命令式语气，不是说明式
☐ 添加输出自检清单
☐ 设置 allowed-tools（如需限制）
☐ 若有副作用，设置 disable-model-invocation: true
☐ 若仅作背景知识，设置 user-invocable: false
☐ 添加 argument-hint（如支持参数）
```

---

## 十、常见问题

### Q1: AI 不严格遵循 Skill 怎么办？

**原因**：Skill 写得像"参考文档"而不是"执行指令"

**解决**：
1. 使用命令式语气
2. 添加"强制规则"和"输出自检清单"
3. 保持主文件简短，详细内容放支持文件

### Q2: Skill 太长怎么办？

**解决**：
1. 拆分到支持文件（reference.md, templates/, examples/）
2. 主文件只保留执行步骤和强制规则
3. 用 Markdown 链接引用详细内容

### Q3: 如何让 AI 必须执行某些规则？

**解决**：
1. 使用"强制规则"或"⚠️ 必须"标记
2. 添加输出自检清单
3. 明确禁止项（"禁止..."）

---

## 十一、官方资源链接

- Skill 官方文档：https://docs.anthropic.com/en/docs/claude-code/skills
- 常见工作流：https://docs.anthropic.com/en/docs/claude-code/common-workflows
- 最佳实践：https://docs.anthropic.com/en/docs/claude-code/best-practices
- Agent Skills 开放标准：https://agentskills.io
