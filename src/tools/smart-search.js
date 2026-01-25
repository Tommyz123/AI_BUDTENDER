const OpenAI = require('openai');
const { searchProducts } = require('../data/product-repository');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'mock-key',
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

    // 2. Association Search (LLM)
    try {
        const association = await getAssociationFromLLM(query);

        // 3. Search with associated criteria
        const searchCriteria = {
            type: association.type,
            effect: association.effect
        };

        if (options.budgetTarget) {
            // Soft limit: allow 20% over
            searchCriteria.maxPrice = options.budgetTarget * 1.2;
        }

        let products = await searchProducts(searchCriteria);

        // Sort by price descending (upsell opportunity) or match quality?
        // Default to existing order.

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

async function getAssociationFromLLM(query) {
    // Check if we are in test mode and not mocking externally
    // But strictly we should mock via Jest. 
    // We'll proceed assuming OpenAI call works or is mocked.

    const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: `You are a cannabis expert. Analyze the user query to identify the likely Product Type (Indica, Sativa, Hybrid) and Main Effect (e.g. Relaxed, Happy, Creative, Sleepy, Energetic). 
        Return a JSON object with keys: "type", "effect", "reasoning".
        Example: Query "Purple Haze" -> {"type": "Sativa", "effect": "Creative", "reasoning": "Purple Haze is known for high energy creativity."}`
            },
            { role: "user", content: query }
        ],
        response_format: { type: "json_object" }
    });

    const content = completion.choices[0].message.content;
    return JSON.parse(content);
}

module.exports = { smartSearch };
