# Skill 模板示例

> 展示如何按官方风格编写 Skill

---

## 示例1：简单执行型 Skill

### 目录结构

```
my-skill/
└── SKILL.md
```

### SKILL.md

```yaml
---
name: generate-readme
description: Generate README.md for the current project
allowed-tools: Read, Grep, Glob, Write
---

# Generate README

## Steps

1. Scan project structure using Glob
2. Read package.json or pyproject.toml for project info
3. Identify main entry points and key modules
4. Generate README.md with: title, description, installation, usage, license

## Output

Write to `README.md` in project root.

## Checklist

- [ ] Has project title?
- [ ] Has installation section?
- [ ] Has usage section?
```

---

## 示例2：复杂工作流 Skill（拆分文件）

### 目录结构

```
project-plan/
├── SKILL.md                    # 主文件（简短指令）
├── dimensions.md               # 维度详细定义
├── templates/
│   └── output-template.md      # 输出模板
└── examples/
    └── sample-plan.md          # 示例输出
```

### SKILL.md（主文件，< 200 行）

```yaml
---
name: project-plan
description: 生成项目计划书。分析需求文档和代码库，输出9-13个维度的规划文档。
allowed-tools: Read, Grep, Glob, Bash
---

# 生成项目计划书

## 执行步骤

1. 读取需求文档（requirements.md > README.md > *.txt）
2. 分析代码库，判断项目阶段
3. 根据阶段生成对应维度
4. 输出 PROJECT_PLAN_vN.md
5. 输出初步可行性评估

## 项目阶段判断

| 阶段 | 条件 | 维度数 |
|------|------|-------|
| MVP期 | 代码<500行 或 模块≤2 | 9 |
| 扩展期 | 代码<2000行 | 11 |
| 成熟期 | 代码≥2000行 | 13 |

## 强制规则

1. MVP期必须输出维度1-9，维度9是"测试与验证策略"
2. 技术选型只写一个，禁止"A / B"写法
3. 必须输出"初步可行性评估"章节

## 维度定义

见 [dimensions.md](./dimensions.md)

## 输出模板

见 [templates/output-template.md](./templates/output-template.md)

## 输出前检查

- [ ] 维度数量是否正确？（MVP=9, 扩展=11, 成熟=13）
- [ ] 维度9是否是"测试与验证策略"？
- [ ] 是否有"初步可行性评估"章节？
- [ ] 技术选型是否只有一个？（无"A / B"）

任何一项未通过 → 修正后再输出
```

### dimensions.md（支持文件）

```markdown
# 维度详细定义

## 9个基础维度（MVP期必需）

### 维度1: 项目概述
- 产品愿景
- 目标用户
- 核心价值
- 项目类型（新建/升级）

### 维度2: 需求分析
- 功能需求（P0/P1）
- 非功能需求
- 业务规则
- 约束条件

### 维度3: 系统架构
- 架构模式
- 架构图（含数据流）
- 分层说明
- SOLID符合度标注

### 维度4: 技术栈选型
- 每项只推荐一个
- 备注列写替代方案
- 包含：语言、框架、数据库、测试工具

### 维度5: 核心模块设计
- 每模块包含：职责、位置、接口、实现思路
- SOLID合规性
- 扩展点标注

### 维度6: API接口文档
- 端点列表
- 请求/响应格式
- 认证方式

### 维度7: 数据模型设计
- 表/结构定义
- 字段说明
- 数据流动

### 维度8: 项目结构
- 目录树
- 目录说明

### 维度9: 测试与验证策略
- 测试框架
- 测试类型
- 核心功能验收标准
- 测试命令

## 扩展期增加（维度10-11）

### 维度10: 部署安装
### 维度11: 使用指南

## 成熟期增加（维度12-13）

### 维度12: 成本估算
### 维度13: 常见问题
```

### templates/output-template.md（输出模板）

```markdown
# {PROJECT_NAME} - 项目计划

> 本文档由 project-plan skill 自动生成
> 生成时间: {DATE}
> 版本: v{VERSION}
> 项目阶段: {STAGE}

## 目录

1. [项目概述](#1-项目概述)
2. [需求分析](#2-需求分析)
...

## 1. 项目概述

### 产品愿景
{content}

### 目标用户
{content}

...

## 附录

### 初步可行性评估

| 维度 | 评分 | 理由 |
|------|------|------|
| 需求完整度 | {score}/100 | {reason} |
| 技术可行性 | {score}/100 | {reason} |
| 资源充足度 | {score}/100 | {reason} |
| **综合评分** | {avg}/100 | - |
```

---

## 示例3：审核型 Skill

### SKILL.md

```yaml
---
name: project-plan-reviewer
description: 审核项目计划书质量，验证完整性和可执行性
allowed-tools: Read, Grep
---

# 审核项目计划书

## 执行步骤

1. 读取 PROJECT_PLAN.md
2. 读取需求文档（用于对齐验证）
3. 执行7维度审核
4. 输出审核报告

## 审核维度

| 维度 | 权重 | 检查项 |
|------|------|--------|
| 需求对齐度 | 15分 | P0功能是否全覆盖 |
| 架构设计质量 | 20分 | SOLID原则、数据流 |
| 技术方案完整性 | 15分 | 无模糊表述、占位符<5% |
| 命名一致性 | 10分 | 技术栈/模块命名前后一致 |
| 可执行性 | 20分 | 实现步骤具体 |
| 测试完备性 | 10分 | 测试策略存在且完整 |
| 文档质量 | 10分 | 维度完整、TODO<10 |

## 强制检查项

1. 维度9是否是"测试与验证策略"？
2. 是否有"初步可行性评估"？
3. 技术选型是否只有一个？

缺失以上任何一项 → 直接判定 P0 问题

## 评分标准

| 评分 | 结果 | 建议 |
|------|------|------|
| ≥90 | ✅通过 | 进入下一阶段 |
| 80-89 | ⚠️接近 | 修复P0后重审 |
| <80 | ❌未通过 | 重新生成 |

## 输出格式

见 [templates/review-template.md](./templates/review-template.md)
```

---

## 示例4：有副作用的 Skill

```yaml
---
name: deploy-production
description: Deploy to production environment
disable-model-invocation: true
allowed-tools: Bash
---

# Deploy to Production

⚠️ This skill has side effects. Only run when explicitly requested.

## Steps

1. Run tests: `npm test`
2. Build: `npm run build`
3. Deploy: `npm run deploy:prod`

## Pre-deploy Checklist

- [ ] All tests passing?
- [ ] Version bumped?
- [ ] Changelog updated?

## Arguments

$ARGUMENTS will be passed to deploy command.

Example: `/deploy-production --dry-run`
```

---

## 示例5：背景知识 Skill

```yaml
---
name: team-coding-standards
description: Team coding standards and conventions
user-invocable: false
---

# Coding Standards

## Language

- Use TypeScript for all new code
- Target ES2022

## Style

- Use ESLint with our config
- Use Prettier for formatting
- Max line length: 100

## Naming

- camelCase for variables and functions
- PascalCase for classes and types
- SCREAMING_SNAKE_CASE for constants

## Git

- Use conventional commits
- Branch naming: feature/xxx, fix/xxx, chore/xxx
```

---

## 关键对比

| 方面 | 错误写法 | 正确写法 |
|------|---------|---------|
| 长度 | 600行全在一个文件 | <200行主文件 + 支持文件 |
| 语气 | "应该做X，因为..." | "1. 做X 2. 做Y" |
| 详细内容 | 全部内嵌 | 链接引用支持文件 |
| 规则 | 说明性 | "强制规则" + "禁止" |
| 验证 | 无 | 输出前检查清单 |
