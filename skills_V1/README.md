# 项目规划工作流 Skill 组合

> 一套 Claude Code 自定义 Skill，用于自动化项目计划书和开发任务清单的生成、审核、修复流程。

## 快速了解

这是一个包含 **7 个 Skill** 的工作流组合：

```
需求文档 → [生成] → PROJECT_PLAN → [审核] → [修复] → TODOLIST → [审核] → [修复] → 开发
```

### 一键执行（推荐）

| Skill | 命令 | 功能 |
|-------|------|------|
| **project-workflow** | `/project-workflow` | **一键执行完整流程**（自动生成、审核、修复直到通过） |

### 分步执行

| Skill | 命令 | 功能 |
|-------|------|------|
| project-plan-generator | `/project-plan-generator` | 生成项目计划书 |
| project-plan-reviewer | `/project-plan-reviewer` | 审核项目计划书 |
| project-plan-fixer | `/project-plan-fixer` | 修复项目计划书 |
| todolist-generator | `/todolist-generator` | 生成开发任务清单 |
| todolist-reviewer | `/todolist-reviewer` | 审核任务清单 |
| todolist-fixer | `/todolist-fixer` | 修复任务清单 |

## 目录结构

```
skills_v1/
├── README.md                      # 本文件
├── SPEC.md                        # 共享规则定义（所有 Skill 引用）
├── official_skill_guide/          # 官方指南参考
│   ├── SKILL_OFFICIAL_GUIDE.md    # Claude Code Skill 官方制作指南
│   ├── SKILL_TEMPLATE_EXAMPLE.md  # 模板示例
│   └── SKILL_COMPARISON_ANALYSIS.md
├── project-workflow/              # 一键执行完整流程
│   └── SKILL.md
├── project-plan-generator/        # 生成项目计划书
│   ├── SKILL.md
│   └── templates/output-template.md
├── project-plan-reviewer/         # 审核项目计划书
│   ├── SKILL.md
│   └── templates/review-report.md
├── project-plan-fixer/            # 修复项目计划书
│   ├── SKILL.md
│   └── templates/fix-record.md
├── todolist-generator/            # 生成任务清单
│   ├── SKILL.md
│   └── templates/output-template.md
├── todolist-reviewer/             # 审核任务清单
│   ├── SKILL.md
│   └── templates/review-report.md
└── todolist-fixer/                # 修复任务清单
    ├── SKILL.md
    └── templates/fix-record.md
```

## 使用流程

### 一键执行（推荐）

```bash
# 1. 准备需求文档（requirements.md 或 README.md）

# 2. 执行完整流程
/project-workflow

# 自动完成：生成→审核→修复→生成→审核→修复
# 直到 PROJECT_PLAN 和 TODOLIST 都通过（≥90分）
```

### 分步执行

```
1. /project-plan-generator    → 生成 PROJECT_PLAN_v1.md
2. /project-plan-reviewer     → 审核，输出评分和问题
3. 如果 < 90 分:
   /project-plan-fixer        → 修复，生成 PROJECT_PLAN_v2.md
   重复步骤 2-3 直到 ≥ 90 分
4. /todolist-generator        → 生成 TODOLIST.md
5. /todolist-reviewer         → 审核，输出评分和问题
6. 如果 < 90 分:
   /todolist-fixer            → 修复，生成 TODOLIST_v2.md
   重复步骤 5-6 直到 ≥ 90 分
7. 开始开发（按 TODOLIST 顺序执行）
```

### 手动分步使用

```bash
# 1. 准备需求文档（requirements.md 或 README.md）

# 2. 生成项目计划
/project-plan-generator

# 3. 审核（≥90分才能继续）
/project-plan-reviewer

# 4. 生成任务清单
/todolist-generator

# 5. 审核（≥90分才能开发）
/todolist-reviewer
```

## 核心规则摘要

详见 [SPEC.md](./SPEC.md)

### PROJECT_PLAN 规则

| 规则 | 说明 |
|------|------|
| 维度数量 | MVP期=9, 扩展期=11, 成熟期=13 |
| 维度9 | 必须是"测试与验证策略"（不是部署） |
| 技术选型 | 只写一个，禁止"A / B"写法 |
| 必需章节 | "初步可行性评估"、"生成信息" |

### TODOLIST 规则

| 规则 | 说明 |
|------|------|
| 必需章节 | 进度追踪、依赖关系、任务详情、首次执行指令、工具说明、注意事项 |
| Task 6部分 | 功能要求、实现位置、代码审核、测试验证、验收标准、完成后必须执行 |
| 初始状态 | 进度=0%，状态=未开始，checkbox未勾选 |

### 评分标准

| 评分 | 结果 | 下一步 |
|------|------|--------|
| ≥ 90 | ✅ 通过 | 进入下一阶段 |
| 80-89 | ⚠️ 接近 | 修复 P0 后重审 |
| < 80 | ❌ 未通过 | 使用 fixer 或重新生成 |

## 设计特点

1. **规则集中管理** — 所有规则定义在 SPEC.md，Skill 通过引用保持一致
2. **结构检查优先** — 审核时先检查结构，结构不完整直接 P0
3. **证据引用** — 审核必须引用原文，禁止无证据打 ✅
4. **自检机制** — 生成/修复后必须自检，未通过不输出
5. **版本管理** — 自动递增版本号（v1, v2, ...）

## 安装

将整个 `skills_v1` 目录复制到以下任一位置：

```bash
# 个人级（所有项目可用）
~/.claude/skills/

# 项目级（仅当前项目可用）
.claude/skills/
```

## 相关文档

- [SPEC.md](./SPEC.md) — 完整规则定义
- [官方 Skill 指南](./official_skill_guide/SKILL_OFFICIAL_GUIDE.md) — Claude Code Skill 制作规范
