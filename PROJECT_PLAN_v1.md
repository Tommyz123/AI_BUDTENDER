# PROJECT_PLAN - AI Budtender 智能销售助手

---

## 生成信息

- **生成时间**: 2026-01-24
- **项目阶段**: MVP期
- **维度数量**: 9
- **需求文档**: 需求文档.md (智能大脑架构设计 V2)
- **约束来源**: SOLUTION_BLUEPRINT.md (Frozen)

---

## 1. 项目概述

### 1.1 产品愿景

打造一个具有"类人销售"体验的智能聊天 Agent，能够像专业销售一样理解用户需求，提供个性化的产品推荐，并通过幽默风趣的对话风格建立用户信任。

### 1.2 目标用户

- 大麻产品零售店的在线客户
- 希望获得专业购买建议的消费者
- 对产品效果、品种有特定需求的用户

### 1.3 核心价值

1. **智能推荐**: 基于用户需求精准匹配产品，即使库存中没有指定品种也能找到相似替代品
2. **灵活预算处理**: 不机械遵循预算限制，在物有所值时主动推荐更优产品
3. **人性化交互**: 幽默风趣的对话风格，像"懂行的老朋友"而非冷冰冰的机器人

### 1.4 项目类型

Web Chat Agent 应用 - 单体架构（前后端弱分离）

**约束声明**:
- 架构拓扑已冻结为 Monolith（来源: S-D3）
- 核心策略聚焦于验证"专业销售感"（来源: S-D1）

---

## 2. 需求分析

### 2.1 功能需求

#### P0 - 核心功能（必须实现）

| 编号 | 功能 | 描述 |
|------|------|------|
| F-01 | 智能对话 | 用户可通过 Web 界面与 Agent 进行自然语言对话 |
| F-02 | 精确搜索 | 在 NYE2.1 CSV 数据库中按名称/标签直接匹配产品 |
| F-03 | 联想推荐 | 当精确匹配失败时，通过 LLM 分析用户意图，转换为属性搜索条件 |
| F-04 | 预算处理 | 接受用户预算输入，但在质量优先时可推荐超预算产品并说明理由 |
| F-05 | 产品详情查询 | 提供单个产品的详细信息展示 |

#### P1 - 重要功能（应当实现）

| 编号 | 功能 | 描述 |
|------|------|------|
| F-06 | 替代品标记 | 推荐结果明确标注是否为"替代推荐" |
| F-07 | Persona 风格 | "Fried Rice" 人格 - 专业但幽默，像懂行的老朋友 |

### 2.2 非功能需求

| 类别 | 要求 | 验收标准 |
|------|------|---------|
| 响应时间 | 对话响应 < 5秒 | 95% 请求在5秒内返回 |
| 可用性 | 核心功能可用 | 主流程无阻断性错误 |
| 易用性 | 对话自然流畅 | 用户无需学习特定指令格式 |

### 2.3 业务规则

1. **搜索优先级**: 精确匹配 > 联想推荐
2. **预算规则**: 预算为参考而非硬限制，超预算推荐需附带理由
3. **缺货处理**: 禁止简单回复"没货"，必须提供替代方案
4. **对话风格**: 避免问卷式交互，保持判断连续性

---

## 3. 系统架构

### 3.1 架构模式

**单体架构 (Monolith)** - 前后端弱分离

此为冻结决策（来源: S-D3），不得修改。选择理由:
- 最大化反馈速度
- 最小化结构性干扰
- 便于快速迭代打磨

### 3.2 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        Web Browser                          │
│                      (Chat Interface)                       │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP/WebSocket
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     Node.js Server                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   Agent Brain                        │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │   │
│  │  │ GPT-4o Core  │  │ System Prompt│  │ Persona   │  │   │
│  │  │ (对话管理)   │  │ (销售圣经)   │  │ (Fried    │  │   │
│  │  │              │  │              │  │  Rice)    │  │   │
│  │  └──────┬───────┘  └──────────────┘  └───────────┘  │   │
│  │         │                                            │   │
│  │         ▼                                            │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │              Tool Dispatcher                  │   │   │
│  │  └─────────┬────────────────────┬───────────────┘   │   │
│  │            │                    │                    │   │
│  │            ▼                    ▼                    │   │
│  │  ┌─────────────────┐  ┌─────────────────────┐       │   │
│  │  │  smart_search   │  │ get_product_details │       │   │
│  │  │  ┌───────────┐  │  │                     │       │   │
│  │  │  │精确搜索   │  │  │ (产品详情查询)      │       │   │
│  │  │  └─────┬─────┘  │  │                     │       │   │
│  │  │        │无结果  │  └──────────┬──────────┘       │   │
│  │  │        ▼        │             │                   │   │
│  │  │  ┌───────────┐  │             │                   │   │
│  │  │  │联想推荐   │  │             │                   │   │
│  │  │  │(内部LLM)  │  │             │                   │   │
│  │  │  └───────────┘  │             │                   │   │
│  │  └────────┬────────┘             │                   │   │
│  │           │                      │                   │   │
│  └───────────┼──────────────────────┼───────────────────┘   │
│              │                      │                       │
│              ▼                      ▼                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 Data Layer                           │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │  NYE2.1 Database (CSV)                      │    │   │
│  │  │  + Data Cleaning Logic                      │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 数据流

```
用户消息 → Agent Brain → 意图识别 → 工具选择
                                         │
                    ┌────────────────────┴────────────────────┐
                    ▼                                         ▼
              smart_search                          get_product_details
                    │                                         │
          ┌────────┴────────┐                                │
          ▼                 ▼                                 │
      精确匹配           联想推荐                             │
          │                 │                                 │
          └────────┬────────┘                                 │
                   ▼                                          │
              NYE2.1 CSV ←────────────────────────────────────┘
                   │
                   ▼
            结果返回 Agent Brain
                   │
                   ▼
            生成回复(含幽默)
                   │
                   ▼
              用户看到响应
```

### 3.4 SOLID 符合度

| 原则 | 符合程度 | 说明 |
|------|---------|------|
| S - 单一职责 | 中等 | MVP 阶段允许适度耦合，后期需重构 |
| O - 开闭原则 | 低 | 单体架构限制，接受此代价 |
| L - 里氏替换 | 适用 | 工具接口可替换 |
| I - 接口隔离 | 中等 | 工具接口已隔离 |
| D - 依赖倒置 | 低 | MVP 阶段接受直接依赖 |

> 注: 根据 S-D4 取舍声明，当前阶段不追求工程完备度，Outcome 验证成功后必然需要整体重构。

---

## 4. 技术栈选型

| 类别 | 选型 | 备注（替代方案） |
|------|------|-----------------|
| 编程语言 | JavaScript | TypeScript (后期可迁移) |
| 运行时 | Node.js 20 LTS | Bun |
| Web 框架 | Express.js | Fastify, Koa |
| LLM 模型 | GPT-4o | GPT-4o-mini (成本优化时) |
| LLM SDK | OpenAI Node.js SDK | LangChain.js |
| 数据存储 | CSV 文件 (NYE2.1) | SQLite (后期可迁移) |
| 前端 | 原生 HTML/CSS/JS | React (后期可升级) |
| 部署平台 | 托管 PaaS | Railway, Render, Vercel |

**约束声明**:
- 语言已冻结为 JavaScript（来源: S-D2）
- 数据库为 CSV 格式，需包含数据清洗逻辑（来源: S-D2）

---

## 5. 核心模块设计

### 模块 1: Agent Brain (agent-brain)

**职责**:
- 对话管理与上下文维护
- 销售策略决策
- 幽默感生成与 Persona 维护
- 工具调用编排

**位置**: `src/agent/brain.js`

**接口**:
```javascript
// 处理用户消息，返回 Agent 回复
async function processMessage(userMessage, conversationHistory) -> { reply, toolCalls }

// 初始化 Agent（加载 System Prompt）
async function initAgent(config) -> Agent
```

**扩展点**:
- System Prompt 可配置化
- 多 Persona 支持

---

### 模块 2: Smart Search Tool (smart-search)

**职责**:
- 精确搜索产品（按名称/标签）
- 联想推荐（LLM 分析 → 属性搜索）
- 标记是否为替代推荐

**位置**: `src/tools/smart-search.js`

**接口**:
```javascript
// 智能搜索产品
async function smartSearch(query, options) -> {
  products: Product[],
  isAlternative: boolean,
  reasoning: string
}

// options: { budgetTarget?: number, intentKeywords?: string[] }
```

**扩展点**:
- 搜索算法可插拔
- 联想逻辑可配置

---

### 模块 3: Product Details Tool (product-details)

**职责**:
- 查询单个产品详情
- 回答产品相关的刁钻问题

**位置**: `src/tools/product-details.js`

**接口**:
```javascript
// 获取产品详情
async function getProductDetails(productId) -> Product | null
```

**扩展点**:
- 详情字段可扩展

---

### 模块 4: Data Layer (data-layer)

**职责**:
- CSV 文件读取与解析
- 数据清洗与标准化
- 产品查询接口

**位置**: `src/data/product-repository.js`

**接口**:
```javascript
// 按条件搜索产品
async function searchProducts(criteria) -> Product[]

// 按 ID 获取产品
async function getProductById(id) -> Product | null

// 初始化数据（加载 CSV，执行清洗）
async function initData(csvPath) -> void
```

**扩展点**:
- 数据源可替换（CSV → SQLite）
- 清洗规则可配置

---

### 模块 5: Web Interface (web-interface)

**职责**:
- 提供聊天界面
- 处理用户输入/输出
- 管理对话历史展示

**位置**:
- 后端: `src/server.js`
- 前端: `public/index.html`, `public/js/chat.js`

**接口**:
```javascript
// API 端点
POST /api/chat { message: string, history: Message[] } -> { reply: string }
GET /api/products/:id -> Product
```

**扩展点**:
- WebSocket 支持（实时流式输出）
- 多主题样式

---

## 6. API 接口文档

### 6.1 对话接口

**POST /api/chat**

发送用户消息并获取 Agent 回复。

**请求**:
```json
{
  "message": "我想要一个放松的产品，预算20刀",
  "history": [
    { "role": "user", "content": "你好" },
    { "role": "assistant", "content": "嘿！欢迎来到..." }
  ]
}
```

**响应**:
```json
{
  "reply": "放松？我懂你！来看看这款...",
  "products": [
    {
      "id": "prod_001",
      "name": "Northern Lights",
      "price": 18.00,
      "isAlternative": false
    }
  ]
}
```

---

### 6.2 产品详情接口

**GET /api/products/:id**

获取指定产品的详细信息。

**请求**:
```
GET /api/products/prod_001
```

**响应**:
```json
{
  "id": "prod_001",
  "name": "Northern Lights",
  "type": "Indica",
  "price": 18.00,
  "thc": "22%",
  "effects": ["Relaxing", "Sleepy", "Happy"],
  "description": "Classic indica strain..."
}
```

---

## 7. 数据模型设计

### 7.1 产品模型 (Product)

**来源**: NYE2.1 CSV 数据库

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | Y | 产品唯一标识 |
| name | string | Y | 产品名称 |
| type | string | Y | 类型 (Indica/Sativa/Hybrid) |
| price | number | Y | 价格 (USD) |
| thc | string | N | THC 含量 |
| cbd | string | N | CBD 含量 |
| effects | string[] | N | 效果标签 |
| flavors | string[] | N | 风味标签 |
| description | string | N | 产品描述 |

### 7.2 消息模型 (Message)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| role | string | Y | 角色 (user/assistant/system) |
| content | string | Y | 消息内容 |
| timestamp | number | N | 时间戳 |

### 7.3 数据流

```
NYE2.1.csv
    │
    ▼ (加载)
Data Cleaning
    │ - 移除无效记录
    │ - 标准化字段格式
    │ - 填充缺失值
    ▼
In-Memory Product Array
    │
    ├──→ smart_search (搜索)
    │
    └──→ get_product_details (详情)
```

---

## 8. 项目结构

### 8.1 目录树

```
ai-budtender/
├── public/                    # 前端静态资源
│   ├── index.html            # 聊天界面
│   ├── css/
│   │   └── style.css         # 样式
│   └── js/
│       └── chat.js           # 前端逻辑
├── src/                       # 后端源码
│   ├── server.js             # 入口 & Express 配置
│   ├── agent/
│   │   ├── brain.js          # Agent 核心逻辑
│   │   └── prompts.js        # System Prompt 定义
│   ├── tools/
│   │   ├── smart-search.js   # 智能搜索工具
│   │   └── product-details.js # 产品详情工具
│   └── data/
│       ├── product-repository.js  # 数据访问层
│       └── cleaner.js        # 数据清洗逻辑
├── data/
│   └── NYE2.1.csv            # 产品数据库
├── tests/                     # 测试文件
│   ├── agent.test.js
│   ├── smart-search.test.js
│   └── data.test.js
├── package.json
├── .env.example              # 环境变量模板
└── README.md
```

### 8.2 目录说明

| 目录 | 用途 |
|------|------|
| public/ | 前端资源，由 Express 静态服务 |
| src/agent/ | Agent 核心，包含 Brain 和 Prompts |
| src/tools/ | 工具实现，被 Agent 调用 |
| src/data/ | 数据层，处理 CSV 读取和清洗 |
| data/ | 原始数据文件 |
| tests/ | 单元测试和集成测试 |

---

## 9. 测试与验证策略

### 9.1 测试框架

| 类型 | 工具 |
|------|------|
| 单元测试 | Jest |
| 集成测试 | Jest + Supertest |
| E2E 测试 | 手动测试 (MVP 阶段) |

### 9.2 测试类型

#### 单元测试

| 模块 | 测试文件 | 测试点 |
|------|---------|--------|
| smart-search | smart-search.test.js | 精确匹配、联想推荐、空结果处理 |
| product-details | product-details.test.js | 正常查询、ID不存在 |
| data-layer | data.test.js | CSV解析、数据清洗、查询过滤 |

#### 集成测试

| 场景 | 测试文件 | 测试点 |
|------|---------|--------|
| Agent 完整流程 | agent.test.js | 消息处理、工具调用、回复生成 |
| API 接口 | api.test.js | /api/chat、/api/products/:id |

### 9.3 验收标准

根据需求文档定义的成功标准:

| 场景 | 描述 | 验证方法 |
|------|------|---------|
| Upsell | 用户要 $20，Agent 成功推荐 $25 并说服用户 | 手动测试对话 |
| Fallback | 用户要 "Blue Dream" (没货)，Agent 推荐类似 Sativa 混种 | 手动测试对话 |
| Chat | 用户会被 Agent 的俏皮话逗乐 | 用户主观评价 |

### 9.4 测试命令

```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 生成覆盖率报告
npm run test:coverage
```

---

## 附录: 初步可行性评估

| 评估维度 | 评分 | 说明 |
|----------|------|------|
| 技术可行性 | 9/10 | 技术栈成熟，GPT-4o 能力已验证 |
| 资源可行性 | 8/10 | 单人可完成，依赖 OpenAI API |
| 时间可行性 | 8/10 | MVP 范围合理，可快速验证 |
| 风险可控性 | 7/10 | 主要风险: API 成本、Prompt 调优耗时 |

---

## 附录: 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| LLM 响应慢 | 用户体验差 | 流式输出、加载动画 |
| API 成本过高 | 预算超支 | 使用 GPT-4o-mini 降级 |
| 数据质量差 | 推荐不准 | 数据清洗逻辑、人工校验 |
| Prompt 效果不佳 | 对话不自然 | 迭代调优、A/B 测试 |

---

*文档结束*
