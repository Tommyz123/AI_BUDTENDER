const { searchProducts } = require('../data/product-repository');
const { LRUCache } = require('../utils/cache');
const { vectorSearch } = require('../utils/vector-store');

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

// Vector search results cache (200 entries, 1 hour TTL)
const vectorCache = new LRUCache({
    maxSize: 200,
    ttl: 60 * 60 * 1000 // 1 hour
});

/**
 * Smart search for products.
 * @param {string} query - User's search query.
 * @param {Object} options - { budgetTarget, intentKeywords }
 * @returns {Promise<Object>} { products, isAlternative, reasoning }
 */
async function smartSearch(query, options = {}) {
    // 1. Exact Search
    // If we can find something by name (partial match), we return it.
    const exactMatches = await searchProducts({ name: query });

    if (exactMatches.length > 0) {
        // Apply budget filter if matched, but exact name match usually takes precedence over budget?
        // Let's filter by budget if provided, but maybe be lenient?
        // Requirement says: "Budget as soft limit".
        // If exact name match, valid for user.
        return {
            products: filterByBudget(exactMatches, options.budgetTarget),
            isAlternative: false,
            reasoning: `Found exact match for "${query}".`
        };
    }

    // 2. Association/Vector Search (with caching)
    try {
        const association = await getAssociationWithCache(query);

        // Check if this came from vector search (directly returns products)
        if (association.fromVector) {
            let products = association.products;

            // Apply budget filter if provided
            if (options.budgetTarget) {
                products = filterByBudget(products, options.budgetTarget);
            }

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

        if (options.budgetTarget) {
            // Soft limit: allow 20% over
            searchCriteria.maxPrice = options.budgetTarget * 1.2;
        }

        let products = await searchProducts(searchCriteria);

        return {
            products,
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
    // Soft limit for exact match too? Or hard?
    // Let's apply simple 20% soft limit here as well for consistency
    const limit = budgetTarget * 1.2;
    return products.filter(p => p.price <= limit);
}

/**
 * Get association with predefined mapping check and vector search fallback
 */
async function getAssociationWithCache(query) {
    const queryLower = query.toLowerCase().trim();

    // Check predefined mappings first (fastest path)
    for (const [keyword, mapping] of Object.entries(INTENT_MAPPINGS)) {
        if (queryLower.includes(keyword)) {
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
module.exports = { smartSearch, vectorCache, INTENT_MAPPINGS };
