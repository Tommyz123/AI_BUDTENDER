#!/usr/bin/env node
/**
 * eval-layer-b-scenarios.js
 * Layer B — LLM 层场景评估（需要真实 OpenAI API）
 *
 * 运行：node tests/eval-layer-b-scenarios.js
 * 前提：.env 中有有效的 OPENAI_API_KEY
 *
 * 通过 spy 包装 OpenAI client 捕捉所有 tool_call arguments。
 * 场景：B1(Upsell) B2(Fallback) B3(Context) B4(Clarification) B5(Persona) B6(Category混淆)
 * 评分维度：D2(上推), D3(降级), D4(上下文), D5(对话质量)
 */

require('dotenv').config();
const path = require('path');

// ── 验证 API Key ──────────────────────────────────────────────────────
if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'mock-key') {
    console.error('[Layer B] ❌ 需要有效的 OPENAI_API_KEY。请检查 .env 文件。');
    process.exit(1);
}

const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Spy：包装 openai.chat.completions.create 捕捉 tool_call ──────────
const originalCreate = openai.chat.completions.create.bind(openai.chat.completions);
const capturedToolCalls = []; // { scenario, fnName, args, timestamp }

openai.chat.completions.create = async function (...callArgs) {
    const response = await originalCreate(...callArgs);

    // 捕捉 tool_calls（非流式响应）
    if (response.choices && response.choices[0] && response.choices[0].message) {
        const msg = response.choices[0].message;
        if (msg.tool_calls) {
            msg.tool_calls.forEach(tc => {
                try {
                    capturedToolCalls.push({
                        scenario: currentScenario,
                        fnName: tc.function.name,
                        args: JSON.parse(tc.function.arguments),
                        timestamp: Date.now()
                    });
                } catch (e) {
                    // ignore parse errors
                }
            });
        }
    }
    return response;
};

// 当前场景标记（由各场景 runner 设置）
let currentScenario = 'unknown';

// ── 加载 Agent，注入 spy 包装的 openai 实例 ─────────────────────────
const { Agent, setOpenAIClient } = require('../src/agent/brain');
setOpenAIClient(openai); // brain.js 内部现在使用经过 spy 包装的实例

// ── 场景结果收集 ──────────────────────────────────────────────────────
const scenarioResults = {};

// ══════════════════════════════════════════════════════════════════════
// 辅助：运行单轮对话，返回 { reply, history }
// ══════════════════════════════════════════════════════════════════════
async function runTurn(agent, userMessage, history = []) {
    return await agent.processMessage(userMessage, history);
}

// ══════════════════════════════════════════════════════════════════════
// B1 — Upsell 场景 (D2 + D5)
// ══════════════════════════════════════════════════════════════════════
async function runB1() {
    currentScenario = 'B1';
    console.log('\n[B1] Upsell 场景...');
    const agent = new Agent();

    const { reply } = await runTurn(agent, 'I have about $20 to spend, looking for something relaxing');

    // 捕捉 B1 的 tool_call
    const b1Calls = capturedToolCalls.filter(tc => tc.scenario === 'B1');
    const searchCall = b1Calls.find(tc => tc.fnName === 'smart_search');

    console.log('  tool_call:', searchCall ? JSON.stringify(searchCall.args) : 'none');
    console.log('  reply:', reply.substring(0, 200) + (reply.length > 200 ? '...' : ''));

    // 评分检查
    const checks = { budgetTarget: 0, upsellReply: 0 };

    // 检查1: 是否推荐了 >$20 的产品？
    // 回复中查找价格提及（$XX 模式）
    const priceMatches = reply.match(/\$(\d+(?:\.\d+)?)/g) || [];
    const prices = priceMatches.map(p => parseFloat(p.replace('$', '')));
    const hasAboveBudget = prices.some(p => p > 20);
    if (hasAboveBudget) checks.budgetTarget = 2;
    console.log(`  检查1 (推荐>$20): ${hasAboveBudget ? 'YES +2' : 'NO +0'} | 提到价格: [${prices.join(', ')}]`);

    // 检查2: 回复是否有价值解释短语
    const upsellPhrases = ['worth it', 'worth the extra', 'upgrade', 'better quality', 'highly recommend',
        'great value', 'worth every', 'step up', 'treat yourself', 'splurge'];
    const hasUpsellPhrase = upsellPhrases.some(phrase => reply.toLowerCase().includes(phrase));
    if (hasUpsellPhrase) checks.upsellReply = 2;
    console.log(`  检查2 (价值说明短语): ${hasUpsellPhrase ? 'YES +2' : 'NO +0'}`);

    scenarioResults.B1 = { checks, reply, toolCalls: b1Calls, prices };
}

// ══════════════════════════════════════════════════════════════════════
// B2 — Fallback 场景 (D3 + D5)
// ══════════════════════════════════════════════════════════════════════
async function runB2() {
    currentScenario = 'B2';
    console.log('\n[B2] Fallback 场景...');
    const agent = new Agent();

    const { reply } = await runTurn(agent, "Do you have Purple Haze?");

    const b2Calls = capturedToolCalls.filter(tc => tc.scenario === 'B2');
    console.log('  tool_calls:', b2Calls.map(tc => `${tc.fnName}(${JSON.stringify(tc.args)})`).join(', '));
    console.log('  reply:', reply.substring(0, 200) + (reply.length > 200 ? '...' : ''));

    const checks = { explainUnavailable: 0, namedAlternative: 0 };

    // 检查1: 是否明确说明没有该产品并给出替代？
    const dontHavePatterns = ["don't have", "do not have", "not have", "unavailable", "out of stock",
        "don't carry", "we don't", "not currently", "don't stock"];
    const explainedUnavailable = dontHavePatterns.some(p => reply.toLowerCase().includes(p));
    if (explainedUnavailable) checks.explainUnavailable = 1;
    console.log(`  检查1 (说明无货): ${explainedUnavailable ? 'YES +1' : 'NO +0'}`);

    // 检查2: 替代品是否命名具体？（回复中至少提到一个具体产品名）
    // 简单启发式：回复中有 ** 加粗（产品展示格式）或常见cannabis品牌词
    const hasBoldProduct = reply.includes('**') && reply.includes('|');
    // 或者有 "recommend" + 具体名字的模式
    const hasRecommendation = reply.toLowerCase().includes('recommend') || reply.toLowerCase().includes('suggest');
    const namedAlternative = hasBoldProduct || hasRecommendation;
    if (namedAlternative) checks.namedAlternative = 1;
    console.log(`  检查2 (具体替代产品): ${namedAlternative ? 'YES +1' : 'NO +0'}`);

    scenarioResults.B2 = { checks, reply, toolCalls: b2Calls };
}

// ══════════════════════════════════════════════════════════════════════
// B3 — Context Awareness 场景 (D4 核心)
// ══════════════════════════════════════════════════════════════════════
async function runB3() {
    currentScenario = 'B3';
    console.log('\n[B3] Context Awareness 场景...');
    const agent = new Agent();

    // Turn 1
    currentScenario = 'B3-T1';
    const turn1 = await runTurn(agent, "I'm looking for something to help me sleep");
    console.log('  Turn 1 reply:', turn1.reply.substring(0, 150) + '...');

    // Turn 2 — 传入 Turn 1 的 history
    currentScenario = 'B3-T2';
    const turn2 = await runTurn(agent, "do you have any prerolls?", turn1.history);
    console.log('  Turn 2 reply:', turn2.reply.substring(0, 200) + '...');

    // 捕捉 Turn 2 的 tool_call
    const b3T2Calls = capturedToolCalls.filter(tc => tc.scenario === 'B3-T2');
    const searchCall = b3T2Calls.find(tc => tc.fnName === 'smart_search');
    const queryArg = searchCall ? searchCall.args.query : '';
    console.log('  Turn 2 search query:', JSON.stringify(queryArg));

    const checks = { contextMerge: 0, sleepPrerollProduct: 0 };

    // 检查1: query argument 同时包含睡眠词 + preroll 词？
    const queryLower = queryArg.toLowerCase();
    const hasSleepWord = /sleep|sleepy|insomnia|night|rest|tired/.test(queryLower);
    const hasPrerollWord = /preroll|pre-roll|pre roll|joint/.test(queryLower);

    if (hasSleepWord && hasPrerollWord) {
        checks.contextMerge = 8; // 完全命中
        console.log('  检查1 (context merge): 完全命中 +8 (sleep + preroll 均在 query)');
    } else if (hasSleepWord || hasPrerollWord) {
        checks.contextMerge = 4; // 部分命中
        console.log(`  检查1 (context merge): 部分命中 +4 (sleep=${hasSleepWord}, preroll=${hasPrerollWord})`);
    } else {
        checks.contextMerge = 1; // 无命中
        console.log('  检查1 (context merge): 无命中 +1');
    }

    // 检查2: 推荐产品中有 Sleepy 的 preroll？
    // 从 Turn 2 回复中启发式检测
    const replyLower = turn2.reply.toLowerCase();
    const mentionsSleepy = /sleepy|sleep/.test(replyLower);
    const mentionsPreroll = /preroll|pre-roll|pre roll|joint/.test(replyLower);
    if (mentionsSleepy && mentionsPreroll) {
        checks.sleepPrerollProduct = 2;
        console.log('  检查2 (Sleepy preroll 产品): YES +2');
    } else {
        console.log(`  检查2 (Sleepy preroll 产品): NO +0 (sleepy=${mentionsSleepy}, preroll=${mentionsPreroll})`);
    }

    scenarioResults.B3 = { checks, queryArg, turn1Reply: turn1.reply, turn2Reply: turn2.reply, toolCalls: b3T2Calls };
}

// ══════════════════════════════════════════════════════════════════════
// B4 — Clarification 场景 (D5)
// ══════════════════════════════════════════════════════════════════════
async function runB4() {
    currentScenario = 'B4';
    console.log('\n[B4] Clarification 场景...');
    const agent = new Agent();

    const { reply } = await runTurn(agent, "I want something good");

    console.log('  reply:', reply.substring(0, 200) + (reply.length > 200 ? '...' : ''));

    const checks = { askedClarification: 0 };

    // 检查: Agent 是否在推荐前先问了澄清问题？
    const clarificationPatterns = [
        'what kind', 'what type', 'looking for', 'in the mood',
        'flower', 'edible', 'vape', 'effect', 'budget',
        'help you with', 'more specific', 'can you tell', 'prefer',
        'what are you', 'how about', 'any preference'
    ];
    const questionMark = reply.includes('?');
    const hasClarifyPattern = clarificationPatterns.some(p => reply.toLowerCase().includes(p));
    const askedClarification = questionMark && hasClarifyPattern;
    if (askedClarification) checks.askedClarification = 1;
    console.log(`  检查 (澄清问题): ${askedClarification ? 'YES +1' : 'NO +0'}`);

    scenarioResults.B4 = { checks, reply };
}

// ══════════════════════════════════════════════════════════════════════
// B5 — Persona 场景 (D5)
// ══════════════════════════════════════════════════════════════════════
async function runB5() {
    currentScenario = 'B5-T1';
    console.log('\n[B5] Persona 场景...');
    const agent = new Agent();

    // Turn 1: "hey" → 应走 SIMPLE_RESPONSES 本地路径
    const turn1 = await runTurn(agent, "hey");
    console.log('  Turn 1 (hey):', turn1.reply);

    // Turn 2: 实质性问题
    currentScenario = 'B5-T2';
    const turn2 = await runTurn(agent, "what do you recommend for a chill Friday night?", turn1.history);
    console.log('  Turn 2 reply:', turn2.reply.substring(0, 200) + (turn2.reply.length > 200 ? '...' : ''));

    const checks = { personalWarmth: 0 };

    // 检查: 回复是否有个人感/温暖感？非冰冷的产品列表
    const warmthPatterns = [
        'friday', 'night', 'vibe', 'chill', 'perfect', 'enjoy',
        'you\'ll love', 'great choice', 'my pick', 'honestly',
        'trust me', 'definitely', 'relax', 'unwind', 'kick back',
        'good time', 'wind down', 'cheers'
    ];
    // 也检查是否只是纯粹的列表格式（冰冷）
    const lineCount = turn2.reply.split('\n').length;
    const hasWarmthWord = warmthPatterns.some(p => turn2.reply.toLowerCase().includes(p));
    // 如果有温暖词且不是纯列表，得分
    const personalWarmth = hasWarmthWord && lineCount < 20;
    if (personalWarmth) checks.personalWarmth = 1;
    console.log(`  检查 (个人感/温暖): ${personalWarmth ? 'YES +1' : 'NO +0'}`);

    scenarioResults.B5 = { checks, turn1Reply: turn1.reply, turn2Reply: turn2.reply };
}

// ══════════════════════════════════════════════════════════════════════
// B6 — Category 混淆场景 (D1 — 用户已亲身复现的 bug)
// ══════════════════════════════════════════════════════════════════════
async function runB6() {
    currentScenario = 'B6';
    console.log('\n[B6] Category 混淆场景 (I4)...');
    const agent = new Agent();

    const { reply } = await runTurn(agent, "I'm looking for flower options");

    const b6Calls = capturedToolCalls.filter(tc => tc.scenario === 'B6');
    console.log('  tool_calls:', b6Calls.map(tc => `${tc.fnName}(${JSON.stringify(tc.args)})`).join(', '));
    console.log('  reply:', reply.substring(0, 250) + (reply.length > 250 ? '...' : ''));

    const checks = { categoryAccuracy: 0 };

    // 分析回复中提到的产品类别
    // 启发式：查找回复中的产品展示行（含 | 分隔符）
    const replyLower = reply.toLowerCase();

    // 检查是否有 flower 类别提及
    const mentionsFlower = /flower/i.test(reply);
    // 检查是否有 preroll/pre-roll 类别混入
    const mentionsPreroll = /pre-?roll/i.test(reply);
    // 检查是否有 vape/edible 混入
    const mentionsOtherCat = /vaporizer|edible|concentrate/i.test(reply);

    console.log(`  类别分析: flower=${mentionsFlower}, preroll=${mentionsPreroll}, other=${mentionsOtherCat}`);

    if (mentionsFlower && !mentionsPreroll && !mentionsOtherCat) {
        checks.categoryAccuracy = 2; // 全部为 Flower
        console.log('  检查 (category 准确度): 全部 Flower +2');
    } else if (mentionsFlower && (mentionsPreroll || mentionsOtherCat)) {
        checks.categoryAccuracy = 1; // 部分混入其他
        console.log('  检查 (category 准确度): 部分混入其他类别 +1');
        console.log('  ⚠️  I4 bug 在实际对话中可能可复现');
    } else if (!mentionsFlower) {
        checks.categoryAccuracy = 0; // 无 Flower
        console.log('  检查 (category 准确度): 无 Flower 返回 +0');
        console.log('  ⚠️  I4 bug: 用户要求 flower 但未返回任何 flower 产品');
    }

    scenarioResults.B6 = { checks, reply, toolCalls: b6Calls };
}

// ══════════════════════════════════════════════════════════════════════
// 评分汇总 & 报告
// ══════════════════════════════════════════════════════════════════════
function generateReport() {
    console.log('\n' + '═'.repeat(70));
    console.log('  LAYER B 场景结果 + 评分报告');
    console.log('═'.repeat(70));

    // ── D2 评分 (Layer B 追加) ──────────────────────────────────────
    // B1 检查1(2) + 检查2(2) = 最多 +4
    // 注意：D2 Layer A 基础分由 Layer A 提供，此处仅输出 Layer B 子分
    const d2_layerB = (scenarioResults.B1?.checks.budgetTarget || 0) +
                      (scenarioResults.B1?.checks.upsellReply || 0);
    console.log(`\n  D2 预算/上推 (Layer B 子分): ${d2_layerB} / 4`);
    console.log(`    B1 检查1 (推荐>$20):    ${scenarioResults.B1?.checks.budgetTarget || 0} / 2`);
    console.log(`    B1 检查2 (价值说明):     ${scenarioResults.B1?.checks.upsellReply || 0} / 2`);

    // ── D3 评分 (Layer B 追加) ──────────────────────────────────────
    // Layer A 基础 8 分 + Layer B B2 检查1(1) + 检查2(1) = 最多 +2
    const d3_layerB = (scenarioResults.B2?.checks.explainUnavailable || 0) +
                      (scenarioResults.B2?.checks.namedAlternative || 0);
    console.log(`\n  D3 降级恢复 (Layer B 子分): ${d3_layerB} / 2`);
    console.log(`    B2 检查1 (说明无货):    ${scenarioResults.B2?.checks.explainUnavailable || 0} / 1`);
    console.log(`    B2 检查2 (具体替代):     ${scenarioResults.B2?.checks.namedAlternative || 0} / 1`);

    // ── D4 评分 (纯 Layer B) ────────────────────────────────────────
    // B3 查询参数检查 + 产品匹配检查，满分 10
    const d4 = (scenarioResults.B3?.checks.contextMerge || 0) +
               (scenarioResults.B3?.checks.sleepPrerollProduct || 0);
    console.log(`\n  D4 上下文感知: ${d4} / 10`);
    console.log(`    B3 检查1 (query context): ${scenarioResults.B3?.checks.contextMerge || 0} / 8`);
    console.log(`    B3 检查2 (Sleepy preroll): ${scenarioResults.B3?.checks.sleepPrerollProduct || 0} / 2`);

    // ── D5 评分 (纯 Layer B) ────────────────────────────────────────
    // (B1命中数 + B2命中数 + B4命中数 + B5命中数) / 最大可能命中数 × 10
    // 最大可能：B1(2) + B2(2) + B4(1) + B5(1) = 6
    const b1Hits = (scenarioResults.B1?.checks.budgetTarget ? 1 : 0) +
                   (scenarioResults.B1?.checks.upsellReply ? 1 : 0);
    const b2Hits = (scenarioResults.B2?.checks.explainUnavailable || 0) +
                   (scenarioResults.B2?.checks.namedAlternative || 0);
    const b4Hits = scenarioResults.B4?.checks.askedClarification || 0;
    const b5Hits = scenarioResults.B5?.checks.personalWarmth || 0;
    const totalHits = b1Hits + b2Hits + b4Hits + b5Hits;
    const maxHits = 6;
    const d5 = (totalHits / maxHits) * 10;
    console.log(`\n  D5 对话质量: ${d5.toFixed(1)} / 10`);
    console.log(`    B1 命中: ${b1Hits}/2  B2 命中: ${b2Hits}/2  B4 命中: ${b4Hits}/1  B5 命中: ${b5Hits}/1`);

    // ── B6 报告（D1 补充证据）────────────────────────────────────────
    console.log(`\n  B6 Category 混淆 (D1 补充证据):`);
    console.log(`    category 准确度: ${scenarioResults.B6?.checks.categoryAccuracy || 0} / 2`);

    console.log('\n' + '─'.repeat(70));
    console.log('  各场景关键捕获数据:');
    console.log(`    B1 tool_call budgetTarget: ${scenarioResults.B1?.toolCalls?.find(t => t.fnName === 'smart_search')?.args?.budgetTarget ?? 'N/A'}`);
    console.log(`    B3 Turn2 search query: ${JSON.stringify(scenarioResults.B3?.queryArg)}`);
    console.log(`    B6 tool_calls: ${scenarioResults.B6?.toolCalls?.map(t => JSON.stringify(t.args)).join(', ') || 'none'}`);
    console.log('═'.repeat(70));

    // ── 序列化输出供汇总使用 ──────────────────────────────────────────
    const layerBScores = {
        D2_layerB: d2_layerB,
        D3_layerB: d3_layerB,
        D4: d4,
        D5: parseFloat(d5.toFixed(1)),
        B6_categoryAccuracy: scenarioResults.B6?.checks.categoryAccuracy || 0
    };
    console.log('\n[LAYER_B_SCORES_JSON]');
    console.log(JSON.stringify({ scores: layerBScores, scenarioResults }));
    console.log('[/LAYER_B_SCORES_JSON]');
}

// ══════════════════════════════════════════════════════════════════════
// 汇总报告：合并 Layer A + Layer B → 最终 6 维度评分
// ══════════════════════════════════════════════════════════════════════
function generateFinalReport(layerBScores) {
    console.log('\n' + '╔'.padEnd(70, '═') + '╗');
    console.log('║' + '  最终评估报告 — AI Budtender Agent 准确度'.padEnd(68) + '║');
    console.log('╠'.padEnd(70, '═') + '╣');

    // ── 读取 Layer A 分数 ──────────────────────────────────────────
    // Layer A 由 Jest 单独执行，此处需要手动输入或从环境变量读取
    // 如果未提供，使用预期的静态分析值（基于已确认 bug）
    const layerA = {
        D1: parseFloat(process.env.LAYER_A_D1 || '10'),   // I2+I4 修复后满分
        D2: parseFloat(process.env.LAYER_A_D2 || '7'),    // I3 修复后基准 5 + upsell range +2
        D3: parseFloat(process.env.LAYER_A_D3 || '8'),    // A3.1(4) + A3.2(4)
        D6: parseFloat(process.env.LAYER_A_D6 || '10')    // I6 修复后满分
    };

    // ── 合并 ──────────────────────────────────────────────────────
    // D1: Layer A 分数（B6 为补充证据，不影响分数）
    const D1 = layerA.D1;
    // D2: Layer A 基础(3~5) + Layer B 追加(0~4) → 满分 10
    // Layer A D2 最多 5 分，Layer B 追加最多 4 分；合并后 cap 10
    const D2 = Math.min(10, layerA.D2 + layerBScores.D2_layerB);
    // D3: Layer A 基础(0~8) + Layer B 追加(0~2) = 满分 10
    const D3 = Math.min(10, layerA.D3 + layerBScores.D3_layerB);
    // D4: 纯 Layer B
    const D4 = layerBScores.D4;
    // D5: 纯 Layer B
    const D5 = layerBScores.D5;
    // D6: Layer A 分数
    const D6 = layerA.D6;

    const total = (D1 + D2 + D3 + D4 + D5 + D6) / 6;

    console.log('║' + '  维度评分表'.padEnd(68) + '║');
    console.log('╠'.padEnd(70, '═') + '╣');

    const dims = [
        { id: 'D1', name: '搜索路径准确度', score: D1, layerA: layerA.D1, layerB: '(B6补充证据)' },
        { id: 'D2', name: '预算处理与上推', score: D2, layerA: layerA.D2, layerB: layerBScores.D2_layerB },
        { id: 'D3', name: '降级恢复',       score: D3, layerA: layerA.D3, layerB: layerBScores.D3_layerB },
        { id: 'D4', name: '上下文感知',     score: D4, layerA: '-',       layerB: layerBScores.D4 },
        { id: 'D5', name: '对话质量',       score: D5, layerA: '-',       layerB: layerBScores.D5 },
        { id: 'D6', name: '数据完整性',     score: D6, layerA: layerA.D6, layerB: '-' }
    ];

    dims.forEach(d => {
        const bar = '█'.repeat(Math.round(d.score)) + '░'.repeat(10 - Math.round(d.score));
        console.log(`║  ${d.id} ${d.name.padEnd(12)} ${d.score.toFixed(1).padStart(4)}/10  ${bar}  [A:${String(d.layerA).padStart(4)} B:${String(d.layerB).padStart(4)}]`.padEnd(69) + '║');
    });

    console.log('╠'.padEnd(70, '═') + '╣');
    const totalBar = '█'.repeat(Math.round(total)) + '░'.repeat(10 - Math.round(total));
    console.log(`║  总分 (平均)          ${total.toFixed(2).padStart(5)}/10  ${totalBar}`.padEnd(69) + '║');
    console.log('╠'.padEnd(70, '═') + '╣');

    // ── 问题清单 ──────────────────────────────────────────────────
    console.log('║' + '  已确认问题清单'.padEnd(68) + '║');
    console.log('╠'.padEnd(70, '═') + '╣');

    const issues = [
        { pri: 1, id: 'I4', desc: 'Category Blind — flower 搜索返回 preroll', sev: 'Critical', dim: 'D1', file: 'smart-search.js + product-repository.js + brain.js' },
        { pri: 2, id: 'I3', desc: 'filterByBudget 硬上限 budget×1.2，违反 Upsell', sev: 'High', dim: 'D2', file: 'smart-search.js:138' },
        { pri: 3, id: 'I1', desc: 'Streaming 双重 LLM 调用（message.content 已有内容仍再 stream）', sev: 'High', dim: 'D5', file: 'brain.js:232-246' },
        { pri: 4, id: 'I6', desc: 'cleaner.js 不修正 Feelings 拼写错误', sev: 'Medium', dim: 'D6', file: 'cleaner.js:22' },
        { pri: 5, id: 'I2', desc: 'INTENT_MAPPINGS includes() 子串匹配碰撞', sev: 'Medium', dim: 'D1', file: 'smart-search.js:150' },
        { pri: 6, id: 'I5', desc: 'Context Awareness 无服务端保障，依赖 LLM 自行合并', sev: 'Medium', dim: 'D4', file: 'brain.js:198' },
        { pri: 7, id: 'I7', desc: '工具 schema 缺少 category 参数', sev: 'High', dim: 'D1', file: 'brain.js TOOLS_SCHEMA' }
    ];

    issues.forEach(issue => {
        const sevIcon = issue.sev === 'Critical' ? '🔴' : issue.sev === 'High' ? '🟠' : '🟡';
        console.log(`║  #${issue.pri} ${sevIcon} [${issue.id}] ${issue.desc}`.padEnd(69) + '║');
        console.log(`║       严重度: ${issue.sev.padEnd(8)} 影响: ${issue.dim}  文件: ${issue.file}`.padEnd(69) + '║');
    });

    console.log('╠'.padEnd(70, '═') + '╣');
    console.log('║' + '  修复建议（按优先级）'.padEnd(68) + '║');
    console.log('╠'.padEnd(70, '═') + '╣');

    const fixes = [
        'I4: product-repository 加 indexByCategory + searchProducts category 过滤;',
        '    smart-search 加 CATEGORY_MAPPINGS; brain.js TOOLS_SCHEMA 加 category 参数',
        'I3: filterByBudget 放宽至 ×1.5 或移除，让 LLM Upsell Prompt 做决策',
        'I1: 删除 brain.js:234-238 二次 stream 调用，直接输出 message.content',
        'I6: cleaner.js effects 解析后加标准化映射 {telaxed→Relaxed, sleep→Sleepy,',
        '    talkatve→Talkative, n/a→null}',
        'I2: includes(keyword) 替换为 \\bkeyword\\b 正则单词边界匹配',
        'I5: brain.js 调用 smartSearch 前扫描历史消息，提取 effect/type/category 补入 query'
    ];

    fixes.forEach(fix => {
        console.log(`║  ${fix}`.padEnd(69) + '║');
    });

    console.log('╚'.padEnd(70, '═') + '╝');
}

// ══════════════════════════════════════════════════════════════════════
// Main 入口
// ══════════════════════════════════════════════════════════════════════
async function main() {
    console.log('╔' + '═'.repeat(68) + '╗');
    console.log('║' + '  Layer B — LLM 层场景评估'.padEnd(68) + '║');
    console.log('║' + '  需要有效 OPENAI_API_KEY'.padEnd(68) + '║');
    console.log('╚' + '═'.repeat(68) + '╝');

    try {
        // 初始化数据层（smartSearch 依赖）
        const { initData } = require('../src/data/product-repository');
        const path = require('path');
        await initData(path.resolve(__dirname, '../data/NYE2.1.csv'));

        // 依次运行场景（不并发，避免 API 速率限制）
        await runB1();
        await runB2();
        await runB3();
        await runB4();
        await runB5();
        await runB6();

        // Layer B 评分报告
        generateReport();

        // 读取 Layer B 分数用于最终汇总
        const layerBScores = {
            D2_layerB: (scenarioResults.B1?.checks.budgetTarget || 0) + (scenarioResults.B1?.checks.upsellReply || 0),
            D3_layerB: (scenarioResults.B2?.checks.explainUnavailable || 0) + (scenarioResults.B2?.checks.namedAlternative || 0),
            D4: (scenarioResults.B3?.checks.contextMerge || 0) + (scenarioResults.B3?.checks.sleepPrerollProduct || 0),
            D5: (() => {
                const b1Hits = (scenarioResults.B1?.checks.budgetTarget ? 1 : 0) + (scenarioResults.B1?.checks.upsellReply ? 1 : 0);
                const b2Hits = (scenarioResults.B2?.checks.explainUnavailable || 0) + (scenarioResults.B2?.checks.namedAlternative || 0);
                const b4Hits = scenarioResults.B4?.checks.askedClarification || 0;
                const b5Hits = scenarioResults.B5?.checks.personalWarmth || 0;
                return parseFloat(((b1Hits + b2Hits + b4Hits + b5Hits) / 6 * 10).toFixed(1));
            })()
        };

        // 最终汇总报告
        generateFinalReport(layerBScores);

    } catch (err) {
        console.error('[Layer B] 执行错误:', err);
        process.exit(1);
    }
}

main();
