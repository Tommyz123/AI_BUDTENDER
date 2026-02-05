/**
 * eval-layer-a.test.js
 * Layer A — 逻辑层确定性评估（无 OpenAI API 依赖）
 *
 * 评估维度：D1 搜索路径准确度、D2 预算处理与上推、D3 降级恢复、D6 数据完整性
 * 运行：npx jest tests/eval-layer-a.test.js --verbose
 *
 * 向量搜索 (vectorSearch) 被 mock，其余模块使用真实 CSV 数据。
 */

const path = require('path');

// ── Mock 向量搜索模块（在任何 require 之前）──────────────────────────
// vectorSearch 返回值由各测试自行设置
let mockVectorResult = [];
jest.mock('../src/utils/vector-store', () => ({
    vectorSearch: jest.fn(async () => mockVectorResult)
}));

// ── 加载真实模块 ──────────────────────────────────────────────────────
const { initData, searchProducts, getAllProducts } = require('../src/data/product-repository');
const { smartSearch, INTENT_MAPPINGS } = require('../src/tools/smart-search');

// ── 全局 setup：加载 CSV ─────────────────────────────────────────────
beforeAll(async () => {
    const csvPath = path.resolve(__dirname, '../data/NYE2.1.csv');
    // product-repository 内部用 isInitialized flag，需要绕过缓存
    // 直接调用 initData 即可（第一次调用会执行）
    await initData(csvPath);
}, 30000);

// ── 评分收集器 ────────────────────────────────────────────────────────
const scores = { D1: 0, D2: 0, D3: 0, D6: 0 };
const layerAResults = [];

function recordResult(testId, passed, detail) {
    layerAResults.push({ testId, passed, detail });
}

// ══════════════════════════════════════════════════════════════════════
// D1 — 搜索路径准确度 (Search Accuracy)
// ══════════════════════════════════════════════════════════════════════
describe('D1 — 搜索路径准确度', () => {

    // A1.1: 精确匹配优先级 —— "Rest" 应命中产品名而非被 INTENT_MAPPINGS 的 "rest" 截获
    test('A1.1: 精确匹配优先级 — 搜索 "Rest" 命中实名产品', async () => {
        // "Rest | Mood | AIO | (CBN)" 是实名产品（idx=133, $35, Vaporizers）
        // searchProducts({ name: 'Rest' }) 用 includes 做子串匹配，应命中该产品
        // smartSearch 流程：先精确搜索，如果 exactMatches.length > 0 就返回
        const result = await smartSearch('Rest');
        // 验证：isAlternative 应为 false（走精确路径）
        expect(result.isAlternative).toBe(false);
        // 验证：返回的产品名中至少有一个包含 "Rest"
        const hasRestProduct = result.products.some(p => p.name.includes('Rest'));
        expect(hasRestProduct).toBe(true);
        recordResult('A1.1', result.isAlternative === false && hasRestProduct, 'exact match path hit for "Rest"');
    });

    // A1.2: I2 修复验证 —— "restaurant" 不再被 "rest" 截获（单词边界正则）
    test('A1.2: 关键词碰撞修复 — "restaurant" 不再触发 "rest" 映射', async () => {
        mockVectorResult = [];
        const result = await smartSearch('restaurant');
        // 修复后：\brest\b 不匹配 "restaurant"，应掉到向量搜索
        const hitRestMapping = result.reasoning && result.reasoning.toLowerCase().includes('"rest"');
        expect(hitRestMapping).toBe(false);
        const wentToVector = result.reasoning && result.reasoning.includes('semantic similarity');
        expect(wentToVector).toBe(true);
        recordResult('A1.2', !hitRestMapping, 'I2 fixed: "restaurant" no longer triggers "rest" mapping');
    });

    // A1.3: I2 修复验证 —— "networking" 不再被 "work" 截获
    test('A1.3: 关键词碰撞修复 — "networking" 不再触发 "work" 映射', async () => {
        mockVectorResult = [];
        const result = await smartSearch('networking');
        const hitWorkMapping = result.reasoning && result.reasoning.toLowerCase().includes('"work"');
        expect(hitWorkMapping).toBe(false);
        const wentToVector = result.reasoning && result.reasoning.includes('semantic similarity');
        expect(wentToVector).toBe(true);
        recordResult('A1.3', !hitWorkMapping, 'I2 fixed: "networking" no longer triggers "work" mapping');
    });

    // A1.4-A1.8: I4 修复验证 —— 类别词走 CATEGORY_MAPPINGS 直通路径
    // indica/sativa 映射到 type，preroll/edible/vape 映射到 category
    const categoryTerms = [
        { term: 'indica', label: 'A1.4', expectType: 'Indica' },
        { term: 'sativa', label: 'A1.5', expectType: 'Sativa' },
        { term: 'preroll', label: 'A1.6', expectCategory: 'Pre-rolls' },
        { term: 'edible', label: 'A1.7', expectCategory: 'Edibles' },
        { term: 'vape', label: 'A1.8', expectCategory: 'Vaporizers' }
    ];

    categoryTerms.forEach(({ term, label, expectType, expectCategory }) => {
        test(`${label}: 类别词 "${term}" 走 CATEGORY_MAPPINGS 直通路径`, async () => {
            mockVectorResult = [];
            const result = await smartSearch(term);

            // 修复后：走 category direct path，isAlternative = false
            expect(result.isAlternative).toBe(false);
            expect(result.products.length).toBeGreaterThan(0);

            if (expectCategory) {
                // 验证所有返回产品 category 匹配
                const allCorrect = result.products.every(p => p.category === expectCategory);
                expect(allCorrect).toBe(true);
                recordResult(label, allCorrect,
                    `I4 fixed: "${term}" → CATEGORY_MAPPINGS → category=${expectCategory}, ${result.products.length} products returned`);
            } else if (expectType) {
                // 验证所有返回产品 type 匹配
                const allCorrect = result.products.every(p => p.type === expectType);
                expect(allCorrect).toBe(true);
                recordResult(label, allCorrect,
                    `I4 fixed: "${term}" → CATEGORY_MAPPINGS → type=${expectType}, ${result.products.length} products returned`);
            }
        });
    });

    // A1.9: I4 修复验证 —— "flower options" 走 CATEGORY_MAPPINGS → category=Flower
    // mock 向量搜索注入的 preroll 不会被使用，因为直通路径优先
    test('A1.9: flower→preroll 类别混淆修复 — "flower options" 正确返回 Flower 产品', async () => {
        const allProducts = await getAllProducts();
        const prerolls = allProducts.filter(p => p.category === 'Pre-rolls').slice(0, 3);
        expect(prerolls.length).toBeGreaterThan(0);

        // 即使向量搜索返回 preroll，CATEGORY_MAPPINGS 直通路径优先
        mockVectorResult = prerolls;

        const result = await smartSearch('flower options');

        const returnedPrerolls = result.products.filter(p => p.category === 'Pre-rolls');
        const returnedFlowers = result.products.filter(p => p.category === 'Flower');

        // 修复后：走 CATEGORY_MAPPINGS → category=Flower，全部为 Flower 产品
        expect(returnedFlowers.length).toBeGreaterThan(0);
        expect(returnedPrerolls.length).toBe(0);
        expect(result.isAlternative).toBe(false);
        recordResult('A1.9', returnedFlowers.length > 0 && returnedPrerolls.length === 0,
            `I4 fixed: "flower options" → CATEGORY_MAPPINGS → ${returnedFlowers.length} Flower products, 0 prerolls.`);
    });
});

// ══════════════════════════════════════════════════════════════════════
// D2 — 预算处理与上推 (Budget & Upsell)
// ══════════════════════════════════════════════════════════════════════
describe('D2 — 预算处理与上推', () => {

    // A2.1: I3 修复验证 —— filterByBudget 上限放宽至 ×1.5=$30
    // "Restore Topical" $55 仍超出 $30 上限，被过滤掉
    test('A2.1: 精确匹配路径预算截断 — budgetTarget=20 的 $30 软上限（I3 修复）', async () => {
        const result = await smartSearch('Restore Topical', { budgetTarget: 20 });
        // 所有返回产品价格应 <= $30（budget*1.5）
        const allUnderLimit = result.products.every(p => p.price <= 30);
        // "Restore Topical" 价格 $55 > $30，仍被过滤
        expect(result.products.length).toBe(0);
        expect(allUnderLimit).toBe(true);
        recordResult('A2.1', result.products.length === 0,
            'I3 fixed: filterByBudget soft-cap at budget*1.5=$30. $55 product still filtered (>$30)');
    });

    // A2.2: I3 修复验证 —— "sleep" + budgetTarget=20 → maxPrice=$30
    // upsell range 拓宽为 $20~$30，让更多产品可供 LLM Upsell
    test('A2.2: 意图映射路径预算放宽 — "sleep" + budgetTarget=20 → $30 上限', async () => {
        const result = await smartSearch('sleep', { budgetTarget: 20 });
        // 所有返回产品应 <= $30（budget*1.5）
        const allUnderLimit = result.products.every(p => p.price <= 30);
        expect(allUnderLimit).toBe(true);
        expect(result.products.length).toBeGreaterThan(0);

        // 关键检查：budget~budget*1.5 ($20~$30) 区间内应有更多产品返回
        const inUpsellRange = result.products.filter(p => p.price > 20 && p.price <= 30);
        recordResult('A2.2', allUnderLimit,
            `maxPrice=$30 applied (I3 fixed). ${result.products.length} products returned. Upsell range ($20-$30): ${inUpsellRange.length} products.`);
    });

    // A2.3: 无预算场景 —— 所有价位产品均返回
    test('A2.3: 无预算场景 — "sleep" 搜索无预算限制', async () => {
        const result = await smartSearch('sleep');
        // 无 budgetTarget，不做过滤
        // Indica+Sleepy 产品含高价位（如 $95 Watermelon Zkittles）
        const hasExpensiveProduct = result.products.some(p => p.price > 50);
        expect(hasExpensiveProduct).toBe(true);
        recordResult('A2.3', hasExpensiveProduct, `No budget filter: ${result.products.length} products, max price $${Math.max(...result.products.map(p => p.price))}`);
    });
});

// ══════════════════════════════════════════════════════════════════════
// D3 — 降级恢复 (Fallback)
// ══════════════════════════════════════════════════════════════════════
describe('D3 — 降级恢复', () => {

    // A3.1: 搜索不存在产品 "Purple Haze"，应走到向量搜索路径
    test('A3.1: 不存在产品 "Purple Haze" 正确降级到向量搜索', async () => {
        // 用真实数据中的 Sativa 产品作为向量搜索替代返回
        const allProducts = await getAllProducts();
        const sativaSuggestions = allProducts.filter(p => p.type === 'Sativa').slice(0, 3);
        mockVectorResult = sativaSuggestions;

        const result = await smartSearch('Purple Haze');
        // "Purple Haze" 无精确匹配，无 INTENT_MAPPINGS 命中 → 向量搜索
        const wentToVector = result.reasoning && result.reasoning.includes('semantic similarity');
        expect(wentToVector).toBe(true);
        expect(result.products.length).toBeGreaterThan(0);
        recordResult('A3.1', wentToVector, 'Purple Haze correctly fell through to vector search');
    });

    // A3.2: 验证向量搜索路径返回的 isAlternative 标记
    test('A3.2: 向量搜索返回结果带 isAlternative: true', async () => {
        mockVectorResult = [{ id: 'prod_001', name: 'Test', price: 10, category: 'Flower', effects: ['Happy'] }];
        const result = await smartSearch('Purple Haze');
        expect(result.isAlternative).toBe(true);
        recordResult('A3.2', result.isAlternative === true, 'isAlternative flag correctly set on vector fallback path');
    });
});

// ══════════════════════════════════════════════════════════════════════
// D6 — 数据完整性 (Data Integrity)
// ══════════════════════════════════════════════════════════════════════
describe('D6 — 数据完整性', () => {

    // A6.1: I6 修复验证 —— "Telaxed" 已归并到 "Relaxed"
    test('A6.1: effect="Telaxed" 已修正归并到 "Relaxed"（I6 修复）', async () => {
        const relaxedProducts = await searchProducts({ effect: 'Relaxed' });
        const telaxedProducts = await searchProducts({ effect: 'Telaxed' });

        console.log(`  [D6 A6.1] Relaxed: ${relaxedProducts.length} products, Telaxed: ${telaxedProducts.length} products`);

        // 修复后 "Telaxed" 3 个产品已归并到 "Relaxed"，Relaxed 数量增加
        expect(relaxedProducts.length).toBeGreaterThan(100);
        // "Telaxed" 不再存在于索引中
        expect(telaxedProducts.length).toBe(0);

        recordResult('A6.1', telaxedProducts.length === 0,
            `I6 fixed: "Telaxed" normalized to "Relaxed". Relaxed now has ${relaxedProducts.length} products, Telaxed has 0.`);
    });

    // A6.2: I6 修复验证 —— "Sleep" 已归并到 "Sleepy"
    test('A6.2: effect="Sleep" 已修正归并到 "Sleepy"（I6 修复）', async () => {
        const sleepyProducts = await searchProducts({ effect: 'Sleepy' });
        const sleepProducts = await searchProducts({ effect: 'Sleep' });

        console.log(`  [D6 A6.2] Sleepy: ${sleepyProducts.length} products, Sleep: ${sleepProducts.length} products`);

        // 修复后 "Sleep" 2 个产品已归并到 "Sleepy"
        expect(sleepyProducts.length).toBeGreaterThan(10);
        expect(sleepProducts.length).toBe(0);

        recordResult('A6.2', sleepProducts.length === 0,
            `I6 fixed: "Sleep" normalized to "Sleepy". Sleepy now has ${sleepyProducts.length} products, Sleep has 0.`);
    });

    // A6.3: I6 修复验证 —— "N/A" 已被过滤，不再存在于索引中
    test('A6.3: "N/A" 已被过滤，不存在于 indexByEffect（I6 修复）', async () => {
        const naProducts = await searchProducts({ effect: 'N/A' });

        console.log(`  [D6 A6.3] N/A effect products: ${naProducts.length}`);

        // 修复后 "N/A" 被 normalizeEffect 映射为 null 并过滤掉
        expect(naProducts.length).toBe(0);

        recordResult('A6.3', naProducts.length === 0,
            `I6 fixed: "N/A" filtered out in cleaner. 0 products with N/A effect.`);
    });
});

// ══════════════════════════════════════════════════════════════════════
// 评分汇总 & 报告输出
// ══════════════════════════════════════════════════════════════════════
afterAll(() => {
    // ── D1 评分（修复后）─────────────────────────────────────────────
    // 基准分 10；I2 修复：碰撞消除不再扣分；I4 修复：类别直通路径正常不再扣分
    let d1 = 10;
    const a12 = layerAResults.find(r => r.testId === 'A1.2');
    const a13 = layerAResults.find(r => r.testId === 'A1.3');
    if (a12 && !a12.passed) d1 -= 1; // I2 未修复仍碰撞 -1
    if (a13 && !a13.passed) d1 -= 1; // I2 未修复仍碰撞 -1
    ['A1.4', 'A1.5', 'A1.6', 'A1.7', 'A1.8'].forEach(id => {
        const r = layerAResults.find(r => r.testId === id);
        if (r && !r.passed) d1 -= 0.5; // 类别路径仍缺失 -0.5
    });
    scores.D1 = Math.max(0, d1);

    // ── D2 评分（修复后）─────────────────────────────────────────────
    // I3 修复后 budget*1.5 为软上限，基准分 5（结构合理）
    let d2 = 5;
    // 若 A2.2 中 $20~$30 区间有产品返回 → +2（Upsell 空间拓宽）
    const a22Detail = layerAResults.find(r => r.testId === 'A2.2');
    if (a22Detail && a22Detail.detail.includes('Upsell range ($20-$30): 0')) {
        // 无 upsell 区间产品，不加分
    } else if (a22Detail) {
        d2 += 2;
    }
    scores.D2 = d2; // Layer B 会追加评分

    // ── D3 评分（Layer A 部分）──────────────────────────────────────
    let d3 = 0;
    const a31 = layerAResults.find(r => r.testId === 'A3.1');
    const a32 = layerAResults.find(r => r.testId === 'A3.2');
    if (a31 && a31.passed) d3 += 4;
    if (a32 && a32.passed) d3 += 4;
    scores.D3 = d3; // Layer B (B2) 会追加最多 +2

    // ── D6 评分（修复后）─────────────────────────────────────────────
    // I6 修复后拼写已归并，基准分 10；仅未修正项扣分
    let d6 = 10;
    const a61 = layerAResults.find(r => r.testId === 'A6.1');
    const a62 = layerAResults.find(r => r.testId === 'A6.2');
    const a63 = layerAResults.find(r => r.testId === 'A6.3');
    if (a61 && !a61.passed) d6 -= 2; // "Telaxed" 仍未修正 -2
    if (a62 && !a62.passed) d6 -= 1; // "Sleep" 仍未修正 -1
    if (a63 && !a63.passed) d6 -= 1; // "N/A" 仍存在 -1
    scores.D6 = Math.max(0, d6);

    // ── 输出报告 ────────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(70));
    console.log('  LAYER A 评分报告');
    console.log('═'.repeat(70));
    console.log(`  D1 搜索路径准确度:  ${scores.D1.toFixed(1)} / 10`);
    console.log(`  D2 预算处理与上推:  ${scores.D2.toFixed(1)} / 10  (Layer A 子分; Layer B 追加待定)`);
    console.log(`  D3 降级恢复:        ${scores.D3.toFixed(1)} / 10  (Layer A 子分; Layer B 追加待定)`);
    console.log(`  D6 数据完整性:      ${scores.D6.toFixed(1)} / 10`);
    console.log('─'.repeat(70));
    console.log('  逐项结果:');
    layerAResults.forEach(r => {
        const icon = r.passed ? '✓' : '✗';
        console.log(`    [${icon}] ${r.testId}: ${r.detail}`);
    });
    console.log('═'.repeat(70));

    // 序列化输出供后续汇总使用
    console.log('\n[LAYER_A_SCORES_JSON]');
    console.log(JSON.stringify({ scores, results: layerAResults }));
    console.log('[/LAYER_A_SCORES_JSON]');
});
