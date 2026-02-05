const { searchProducts } = require('../data/product-repository');
const { LRUCache } = require('../utils/cache');
const { vectorSearch } = require('../utils/vector-store');

// Aggregation patterns for queries like "most expensive", "cheapest", "highest THC"
const AGGREGATION_PATTERNS = {
    cheapest: {
        field: 'price',
        order: 'asc',
        keywords: ['cheapest', 'least expensive', 'lowest price', 'most affordable', 'budget']
    },
    mostExpensive: {
        field: 'price',
        order: 'desc',
        keywords: ['most expensive', 'priciest', 'highest price', 'premium', 'top dollar']
    },
    highestTHC: {
        field: 'thc',
        order: 'desc',
        keywords: ['highest thc', 'most thc', 'strongest', 'most potent', 'highest potency']
    },
    lowestTHC: {
        field: 'thc',
        order: 'asc',
        keywords: ['lowest thc', 'least thc', 'weakest', 'mildest', 'lowest potency']
    },
    highestCBD: {
        field: 'cbd',
        order: 'desc',
        keywords: ['highest cbd', 'most cbd']
    }
};

/**
 * Detect aggregation query pattern (e.g., "most expensive", "cheapest")
 * @param {string} query
 * @returns {Object|null} { field, order } or null
 */
function detectAggregation(query) {
    const queryLower = query.toLowerCase();
    for (const [key, config] of Object.entries(AGGREGATION_PATTERNS)) {
        for (const keyword of config.keywords) {
            if (queryLower.includes(keyword)) {
                console.log(`[SmartSearch] Aggregation detected: ${key}`);
                return { field: config.field, order: config.order };
            }
        }
    }
    return null;
}

/**
 * Detect broad list queries like "list all drinks", "show me all edibles"
 * These should skip vector search to avoid timeout
 * @param {string} query
 * @returns {boolean}
 */
function isBroadListQuery(query) {
    const queryLower = query.toLowerCase();
    const broadPatterns = [
        /\b(?:list|show|give me|tell me|what are)\s+(?:all|the)\s+(?:drinks?|edibles?|flowers?|vapes?|tinctures?|concentrates?|pre-?rolls?)/i,
        /\b(?:all|every)\s+(?:drinks?|edibles?|flowers?|vapes?|tinctures?|concentrates?|pre-?rolls?)\b/i,
        /\bwhat\s+(?:drinks?|edibles?|flowers?|vapes?|tinctures?|concentrates?|pre-?rolls?)\s+do you have\b/i
    ];
    return broadPatterns.some(pattern => pattern.test(query));
}

/**
 * Interpret budget query to determine if it's strict (< X) or inclusive (<= X)
 * @param {string} query - The search query
 * @param {number} budgetTarget - The budget amount
 * @returns {Object} { maxPrice, maxPriceExclusive }
 */
function interpretBudgetQuery(query, budgetTarget) {
    const queryLower = query.toLowerCase();
    const strictPatterns = ['under', 'below', 'less than', 'cheaper than'];

    const isStrict = strictPatterns.some(pattern => queryLower.includes(pattern));

    console.log(`[SmartSearch] Budget interpretation: query="${query}", budgetTarget=${budgetTarget}, isStrict=${isStrict}`);

    return {
        maxPrice: budgetTarget,
        maxPriceExclusive: isStrict
    };
}

// Predefined intent mappings to skip LLM calls for common queries
const INTENT_MAPPINGS = {
    // Sleep/Relaxation
    'sleep': { type: 'Indica', effect: 'Sleepy' },
    'insomnia': { type: 'Indica', effect: 'Sleepy' },
    'tired': { type: 'Indica', effect: 'Sleepy' },
    'rest': { type: 'Indica', effect: 'Relaxed' },
    'relax': { type: 'Indica', effect: 'Relaxed' },
    'relaxing': { type: 'Indica', effect: 'Relaxed' },
    'relaxation': { type: 'Indica', effect: 'Relaxed' },
    'calm': { type: 'Indica', effect: 'Relaxed' },
    'chill': { type: 'Indica', effect: 'Relaxed' },
    'stress': { type: 'Indica', effect: 'Relaxed' },
    'anxiety': { type: 'Indica', effect: 'Relaxed' },

    // Energy/Creativity
    'energy': { type: 'Sativa', effect: 'Energetic' },
    'energetic': { type: 'Sativa', effect: 'Energetic' },
    'energizing': { type: 'Sativa', effect: 'Energetic' },
    'wake': { type: 'Sativa', effect: 'Energetic' },
    'morning': { type: 'Sativa', effect: 'Energetic' },
    'daytime': { type: 'Sativa', effect: 'Energetic' },
    'creative': { type: 'Sativa', effect: 'Creative' },
    'creativity': { type: 'Sativa', effect: 'Creative' },
    'focus': { type: 'Sativa', effect: 'Focused' },
    'focused': { type: 'Sativa', effect: 'Focused' },
    'productive': { type: 'Sativa', effect: 'Focused' },
    'work': { type: 'Sativa', effect: 'Focused' },
    'uplifting': { type: 'Sativa', effect: 'Uplifted' },
    'uplift': { type: 'Sativa', effect: 'Uplifted' },

    // Social/Happy
    'happy': { type: 'Hybrid', effect: 'Happy' },
    'happiness': { type: 'Hybrid', effect: 'Happy' },
    'party': { type: 'Hybrid', effect: 'Happy' },
    'social': { type: 'Hybrid', effect: 'Talkative' },
    'talkative': { type: 'Hybrid', effect: 'Talkative' },
    'euphoric': { type: 'Hybrid', effect: 'Euphoric' },
    'euphoria': { type: 'Hybrid', effect: 'Euphoric' },

    // Pain/Medical
    'pain': { type: 'Indica', effect: 'Relaxed' },
    'headache': { type: 'Indica', effect: 'Relaxed' },
    'muscle': { type: 'Indica', effect: 'Relaxed' },

    // Hunger
    'hungry': { type: 'Indica', effect: 'Hungry' },
    'appetite': { type: 'Indica', effect: 'Hungry' },
    'munchies': { type: 'Indica', effect: 'Hungry' }
};

// Category keyword → searchProducts criteria mapping
const CATEGORY_MAPPINGS = {
    'flower': { category: 'Flower' },
    'flowers': { category: 'Flower' },
    'preroll': { category: 'Pre-rolls' },
    'prerolls': { category: 'Pre-rolls' },
    'pre-roll': { category: 'Pre-rolls' },
    'pre-rolls': { category: 'Pre-rolls' },
    'joint': { category: 'Pre-rolls' },
    'joints': { category: 'Pre-rolls' },
    'edible': { category: 'Edibles' },
    'edibles': { category: 'Edibles' },
    'vape': { category: 'Vaporizers' },
    'vapes': { category: 'Vaporizers' },
    'vaporizer': { category: 'Vaporizers' },
    'vaporizers': { category: 'Vaporizers' },
    'indica': { type: 'Indica' },
    'sativa': { type: 'Sativa' },
    'hybrid': { type: 'Hybrid' },
    'drink': { category: 'Drink' },
    'drinks': { category: 'Drink' },
    'tincture': { category: 'Tincture' },
    'tinctures': { category: 'Tincture' },
    'concentrate': { category: 'Concentrates' },
    'concentrates': { category: 'Concentrates' }
};

/**
 * Extract category/type from query tokens using CATEGORY_MAPPINGS.
 * Returns { category?, type? } or null if no match.
 */
function getCategoryMatch(query) {
    const tokens = query.toLowerCase().trim().split(/\s+/);
    let result = {};
    for (const token of tokens) {
        const mapping = CATEGORY_MAPPINGS[token];
        if (mapping) {
            if (mapping.category && !result.category) result.category = mapping.category;
            if (mapping.type && !result.type) result.type = mapping.type;
        }
    }
    return Object.keys(result).length > 0 ? result : null;
}

// Vector search results cache (1000 entries, 2 hour TTL)
const vectorCache = new LRUCache({
    maxSize: 1000,
    ttl: 2 * 60 * 60 * 1000 // 2 hours
});

/**
 * Smart search for products.
 * @param {string} query - User's search query.
 * @param {Object} options - { budgetTarget, category, excludeEffects, excludeCategories }
 * @returns {Promise<Object>} { products, isAlternative, reasoning }
 */
async function smartSearch(query, options = {}) {
    const { budgetTarget, category, excludeEffects = [], excludeCategories = [] } = options;
    // 0a. Aggregation query fast path (e.g., "most expensive", "cheapest")
    const aggregation = detectAggregation(query);
    if (aggregation) {
        const categoryMatch = getCategoryMatch(query);
        const searchCriteria = { ...categoryMatch };

        // Apply budget if specified
        if (budgetTarget) {
            const budgetInterp = interpretBudgetQuery(query, budgetTarget);
            searchCriteria.maxPrice = budgetInterp.maxPrice * 1.5; // Still use 1.5x for flexibility
            searchCriteria.maxPriceExclusive = budgetInterp.maxPriceExclusive;
        }

        let products = await searchProducts(searchCriteria, {
            sortBy: aggregation.field,
            sortOrder: aggregation.order,
            limit: 20 // Get more to account for negative filtering
        });

        // Apply negative constraints
        products = applyNegativeConstraints(products, excludeEffects, excludeCategories);

        // Limit to 5 after filtering
        products = products.slice(0, 5);

        console.log(`[SmartSearch] Aggregation query path: found ${products.length} products`);

        return {
            products,
            isAlternative: false,
            reasoning: `Found the ${aggregation.order === 'asc' ? 'lowest' : 'highest'} ${aggregation.field} products.`
        };
    }

    // 0b. Broad list query fast path (e.g., "list all drinks")
    // Skip vector search to avoid timeout
    if (isBroadListQuery(query)) {
        const categoryMatch = getCategoryMatch(query);
        if (categoryMatch) {
            let products = await searchProducts(categoryMatch, { limit: 30 });

            // Apply negative constraints
            products = applyNegativeConstraints(products, excludeEffects, excludeCategories);

            // Limit to 20 after filtering
            products = products.slice(0, 20);

            console.log(`[SmartSearch] Broad list query path: found ${products.length} products`);
            return {
                products,
                isAlternative: false,
                reasoning: `Here are the ${categoryMatch.category || categoryMatch.type} products.`
            };
        }
    }

    // 0c. Category direct path — check CATEGORY_MAPPINGS before anything else
    const categoryMatch = getCategoryMatch(query);
    // Also honor category passed directly from LLM tool_call
    const forcedCategory = category || (categoryMatch && categoryMatch.category) || null;
    const forcedType = categoryMatch && categoryMatch.type || null;

    if (forcedCategory || forcedType) {
        const searchCriteria = {};
        if (forcedCategory) searchCriteria.category = forcedCategory;
        if (forcedType) searchCriteria.type = forcedType;

        // Also scan INTENT_MAPPINGS for effect keywords in the same query (e.g. "sleep preroll")
        const queryLower = query.toLowerCase();
        for (const [keyword, mapping] of Object.entries(INTENT_MAPPINGS)) {
            if (new RegExp('\\b' + keyword + '\\b').test(queryLower)) {
                if (mapping.effect) searchCriteria.effect = mapping.effect;
                break;
            }
        }

        if (budgetTarget) {
            const budgetInterp = interpretBudgetQuery(query, budgetTarget);
            searchCriteria.maxPrice = budgetInterp.maxPrice * 1.5;
            searchCriteria.maxPriceExclusive = budgetInterp.maxPriceExclusive;
        }

        let products = await searchProducts(searchCriteria);

        // Apply negative constraints
        products = applyNegativeConstraints(products, excludeEffects, excludeCategories);

        console.log(`[SmartSearch] Category direct path hit: ${JSON.stringify(searchCriteria)} → ${products.length} products`);

        return {
            products,
            isAlternative: false,
            reasoning: `Found ${products.length} ${forcedCategory || forcedType} products matching your request.`
        };
    }

    // 1. Exact Search (by name)
    let exactMatches = await searchProducts({ name: query });

    if (exactMatches.length > 0) {
        exactMatches = filterByBudget(exactMatches, budgetTarget);
        exactMatches = applyNegativeConstraints(exactMatches, excludeEffects, excludeCategories);

        return {
            products: exactMatches,
            isAlternative: false,
            reasoning: `Found exact match for "${query}".`
        };
    }

    // 1b. Search by cannabinoid (CBN, CBD, etc.) in description
    const cannabinoidPattern = /\b(cbn|cbd|cbg|thc-?v)\b/i;
    if (cannabinoidPattern.test(query)) {
        const allProducts = await searchProducts({});
        const cannabinoidMatches = allProducts.filter(p =>
            p.description && p.description.toLowerCase().includes(query.toLowerCase())
        );

        if (cannabinoidMatches.length > 0) {
            let filtered = filterByBudget(cannabinoidMatches, budgetTarget);
            filtered = applyNegativeConstraints(filtered, excludeEffects, excludeCategories);

            console.log(`[SmartSearch] Cannabinoid search hit for "${query}": found ${filtered.length} products`);

            return {
                products: filtered.slice(0, 10),
                isAlternative: false,
                reasoning: `Found products containing ${query.toUpperCase()}.`
            };
        }
    }

    // 2. Association/Vector Search (with caching)
    try {
        const association = await getAssociationWithCache(query);

        if (association.fromVector) {
            let products = association.products;

            if (budgetTarget) {
                products = filterByBudget(products, budgetTarget);
            }

            // Apply negative constraints
            products = applyNegativeConstraints(products, excludeEffects, excludeCategories);

            return {
                products,
                isAlternative: true,
                reasoning: association.reasoning
            };
        }

        // 3. Search with associated criteria (from INTENT_MAPPINGS)
        const searchCriteria = {
            type: association.type,
            effect: association.effect
        };

        if (budgetTarget) {
            const budgetInterp = interpretBudgetQuery(query, budgetTarget);
            searchCriteria.maxPrice = budgetInterp.maxPrice * 1.5;
            searchCriteria.maxPriceExclusive = budgetInterp.maxPriceExclusive;
        }

        let products = await searchProducts(searchCriteria);

        // Limit before applying expensive filters for performance
        if (products.length > 50) {
            products = products.slice(0, 50);
        }

        // Apply negative constraints
        products = applyNegativeConstraints(products, excludeEffects, excludeCategories);

        // Return top results
        return {
            products: products.slice(0, 10),
            isAlternative: true,
            reasoning: association.reasoning || `I couldn't find "${query}", but here are some ${association.type} options that are ${association.effect}.`
        };

    } catch (error) {
        console.error("Smart Search Error:", error);
        return {
            products: [],
            isAlternative: false,
            reasoning: "Sorry, I encountered an error while searching."
        };
    }
}

function filterByBudget(products, budgetTarget) {
    if (!budgetTarget) return products;
    const limit = budgetTarget * 1.5;
    return products.filter(p => p.price <= limit);
}

/**
 * Apply negative constraints (excludeEffects, excludeCategories)
 * @param {Array} products
 * @param {Array} excludeEffects
 * @param {Array} excludeCategories
 * @returns {Array} Filtered products
 */
function applyNegativeConstraints(products, excludeEffects = [], excludeCategories = []) {
    // Early return if no constraints
    if (excludeEffects.length === 0 && excludeCategories.length === 0) {
        return products;
    }

    let filtered = products;

    // Pre-lowercase excluded items for performance
    const excludedEffectsLower = excludeEffects.map(e => e.toLowerCase());
    const excludedCategoriesLower = excludeCategories.map(c => c.toLowerCase());

    // Filter out excluded effects
    if (excludedEffectsLower.length > 0) {
        filtered = filtered.filter(p => {
            const effectsLower = p.effects.map(e => e.toLowerCase());
            return !excludedEffectsLower.some(excluded =>
                effectsLower.includes(excluded)
            );
        });
    }

    // Filter out excluded categories
    if (excludedCategoriesLower.length > 0) {
        filtered = filtered.filter(p => {
            const categoryLower = p.category.toLowerCase();
            return !excludedCategoriesLower.includes(categoryLower);
        });
    }

    console.log(`[SmartSearch] Negative constraints applied: ${products.length} → ${filtered.length} products`);

    return filtered;
}

/**
 * Get association with predefined mapping check and vector search fallback
 */
async function getAssociationWithCache(query) {
    const queryLower = query.toLowerCase().trim();

    // Check predefined mappings first (fastest path, word-boundary match)
    for (const [keyword, mapping] of Object.entries(INTENT_MAPPINGS)) {
        if (new RegExp('\\b' + keyword + '\\b').test(queryLower)) {
            console.log(`[SmartSearch] Predefined mapping hit for "${keyword}"`);
            return {
                type: mapping.type,
                effect: mapping.effect,
                reasoning: `Based on your interest in "${keyword}", here are some ${mapping.type} options with ${mapping.effect} effects.`
            };
        }
    }

    // Check vector search cache
    const cacheKey = queryLower;
    const cached = vectorCache.get(cacheKey);
    if (cached) {
        console.log(`[SmartSearch] Vector cache hit for "${query}"`);
        return cached;
    }

    // Vector search (replaces LLM call)
    console.log(`[SmartSearch] Vector search for "${query}"`);
    const products = await vectorSearch(query, 5);

    const result = {
        products,
        fromVector: true,
        reasoning: `Based on semantic similarity to "${query}".`
    };

    // Cache the result
    vectorCache.set(cacheKey, result);

    return result;
}

// Export for testing
module.exports = { smartSearch, vectorCache, INTENT_MAPPINGS, CATEGORY_MAPPINGS, getCategoryMatch, detectAggregation, AGGREGATION_PATTERNS, isBroadListQuery, applyNegativeConstraints, interpretBudgetQuery };
