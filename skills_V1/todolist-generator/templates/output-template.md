# {PROJECT_NAME} - 开发任务清单

> 生成时间: {TIMESTAMP}
> 总任务数: {N}个
> 项目阶段: {STAGE}
> 依据: PROJECT_PLAN_v{X}.md (评分: {SCORE}/100)

---

## 进度追踪

**总体进度**: 0/{N} (0%)

- [ ] Task 1: {ModuleName}
- [ ] Task 2: {ModuleName}
- [ ] Task 3: {ModuleName}
...

**图示进度**:
░░░░░░░░░░░░░░░░░░░░ 0%

---

## 任务依赖关系

```
Task 1 ──┬──> Task 3 ──> Task 5
         │
Task 2 ──┘

Task 4 (独立)
```

---

## 任务详情

### [P0] Task 1: {ModuleName}

**优先级**: P0
**依赖关系**: 无
**状态**: 未开始

**功能要求**:
1. {具体功能点1}
2. {具体功能点2}
3. {具体功能点3}

**实现位置**:
- 文件: `src/{path}/{module}.py`
- 测试: `tests/test_{module}.py`

**代码审核**:
```bash
pylint {模块路径} --rcfile=.pylintrc
bandit -r {模块路径} -f txt
```

**测试验证**:
```bash
pytest {测试文件} -v --cov={模块路径}
```

测试用例:
- test_{功能1}
- test_{功能2}
- test_{边界情况}
- test_{异常情况}

**验收标准**:
- [ ] {标准1}
- [ ] {标准2}
- [ ] {标准3}

**完成后必须执行**:
1. 确认代码审核通过
2. 确认测试通过
3. 更新 TODOLIST 进度
4. 检查下一个 Task 的前置条件

---

### [P0] Task 2: {ModuleName}

**优先级**: P0
**依赖关系**: Task 1
**状态**: 未开始

{同上格式...}

---

## 首次执行指令

在开始 Task 1 之前，执行以下初始化：

```bash
# 1. 创建项目结构
mkdir -p src/{modules} tests docs

# 2. 创建配置文件
touch .pylintrc pytest.ini

# 3. 安装依赖
pip install -r requirements.txt
```

---

## 工具说明

| 工具 | 用途 | 命令 |
|------|------|------|
| pytest | 单元测试 | `pytest tests/ -v` |
| pylint | 代码质量 | `pylint src/` |
| bandit | 安全扫描 | `bandit -r src/` |

---

## 注意事项

1. **必须按顺序执行** - 遵守依赖关系
2. **完成标准** = 审核通过 + 测试通过 + 更新进度
3. **依赖检查** - 开始前确认前置 Task 已完成
4. **进度更新** - 完成后立即更新进度追踪章节
