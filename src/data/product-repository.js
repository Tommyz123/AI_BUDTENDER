const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const { cleanData } = require('./cleaner');
const { LRUCache } = require('../utils/cache');

let products = [];
let isInitialized = false;

// Indexes for O(1) lookup
let indexById = new Map();
let indexByType = new Map(); // type -> Set of product indices
let indexByEffect = new Map(); // effect -> Set of product indices
let indexByCategory = new Map(); // category -> Set of product indices

// Search results cache (500 entries, 10 minute TTL)
const searchCache = new LRUCache({
    maxSize: 500,
    ttl: 10 * 60 * 1000 // 10 minutes
});

/**
 * Build indexes for fast lookup
 */
function buildIndexes() {
    indexById.clear();
    indexByType.clear();
    indexByEffect.clear();
    indexByCategory.clear();

    products.forEach((product, idx) => {
        // ID index
        indexById.set(product.id, product);

        // Type index
        const typeLower = product.type.toLowerCase();
        if (!indexByType.has(typeLower)) {
            indexByType.set(typeLower, new Set());
        }
        indexByType.get(typeLower).add(idx);

        // Effect index
        product.effects.forEach(effect => {
            const effectLower = effect.toLowerCase();
            if (!indexByEffect.has(effectLower)) {
                indexByEffect.set(effectLower, new Set());
            }
            indexByEffect.get(effectLower).add(idx);
        });

        // Category index
        if (product.category) {
            const catLower = product.category.toLowerCase();
            if (!indexByCategory.has(catLower)) {
                indexByCategory.set(catLower, new Set());
            }
            indexByCategory.get(catLower).add(idx);
        }
    });

    console.log(`[DataLayer] Indexes built: ${indexById.size} products, ${indexByType.size} types, ${indexByEffect.size} effects, ${indexByCategory.size} categories`);
}

/**
 * Initialize the data layer by loading and cleaning the CSV.
 * @param {string} csvPath - Optional override for CSV path
 */
async function initData(csvPath) {
    if (isInitialized) return;

    const NOT_SET_PATH = path.resolve(__dirname, '../../data/NYE2.1.csv');
    const targetPath = csvPath || NOT_SET_PATH;

    if (!fs.existsSync(targetPath)) {
        throw new Error(`Data file not found at: ${targetPath}`);
    }

    const fileContent = fs.readFileSync(targetPath, 'utf8');

    return new Promise((resolve, reject) => {
        parse(fileContent, {
            columns: true,
            skip_empty_lines: true
        }, (err, records) => {
            if (err) {
                return reject(err);
            }
            products = cleanData(records);
            isInitialized = true;
            buildIndexes();
            console.log(`[DataLayer] Loaded and cleaned ${products.length} products.`);
            resolve();
        });
    });
}

/**
 * Generate cache key from search criteria and options
 */
function getCacheKey(criteria, options = {}) {
    // Create a stable stringification by sorting keys recursively
    const sortedCriteria = Object.keys(criteria).sort().reduce((obj, key) => {
        obj[key] = criteria[key];
        return obj;
    }, {});
    const sortedOptions = Object.keys(options).sort().reduce((obj, key) => {
        obj[key] = options[key];
        return obj;
    }, {});
    return JSON.stringify({ criteria: sortedCriteria, options: sortedOptions });
}

/**
 * Search products by criteria.
 * @param {Object} criteria - { name, type, minPrice, maxPrice, effect }
 * @param {Object} options - { sortBy, sortOrder, limit }
 * @returns {Array} Filtered products
 */
async function searchProducts(criteria = {}, options = {}) {
    if (!isInitialized) await initData();

    // Check cache first
    const cacheKey = getCacheKey(criteria, options);
    const cached = searchCache.get(cacheKey);
    if (cached) {
        console.log(`[DataLayer] Search cache hit`);
        return cached;
    }

    let candidateIndices = null;

    // Use indexes to narrow down candidates
    if (criteria.type) {
        const typeIndices = indexByType.get(criteria.type.toLowerCase());
        if (typeIndices) {
            candidateIndices = new Set(typeIndices);
        } else {
            // No products of this type
            searchCache.set(cacheKey, []);
            return [];
        }
    }

    if (criteria.effect) {
        const effectIndices = indexByEffect.get(criteria.effect.toLowerCase());
        if (effectIndices) {
            if (candidateIndices) {
                // Intersection
                candidateIndices = new Set(
                    [...candidateIndices].filter(idx => effectIndices.has(idx))
                );
            } else {
                candidateIndices = new Set(effectIndices);
            }
        } else {
            // No products with this effect
            searchCache.set(cacheKey, []);
            return [];
        }
    }

    if (criteria.category) {
        const catIndices = indexByCategory.get(criteria.category.toLowerCase());
        if (catIndices) {
            if (candidateIndices) {
                candidateIndices = new Set(
                    [...candidateIndices].filter(idx => catIndices.has(idx))
                );
            } else {
                candidateIndices = new Set(catIndices);
            }
        } else {
            searchCache.set(cacheKey, []);
            return [];
        }
    }

    // Get candidate products
    let candidates;
    if (candidateIndices) {
        candidates = [...candidateIndices].map(idx => products[idx]);
    } else {
        candidates = products;
    }

    // Apply remaining filters
    let results = candidates.filter(p => {
        let match = true;

        if (criteria.name) {
            match = match && p.name.toLowerCase().includes(criteria.name.toLowerCase());
        }

        if (criteria.minPrice !== undefined) {
            match = match && p.price >= criteria.minPrice;
        }

        if (criteria.maxPrice !== undefined) {
            const isStrict = criteria.maxPriceExclusive === true;
            match = match && (isStrict ? p.price < criteria.maxPrice : p.price <= criteria.maxPrice);
        }

        return match;
    });

    // Apply sorting if requested
    if (options.sortBy) {
        results.sort((a, b) => {
            let aVal = a[options.sortBy];
            let bVal = b[options.sortBy];

            // Handle numeric fields
            if (options.sortBy === 'thc' || options.sortBy === 'cbd') {
                aVal = parseFloat(aVal) || 0;
                bVal = parseFloat(bVal) || 0;
            } else if (options.sortBy === 'price') {
                aVal = parseFloat(aVal) || 0;
                bVal = parseFloat(bVal) || 0;
            }

            const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return options.sortOrder === 'desc' ? -comparison : comparison;
        });
    }

    // Apply limit if requested
    if (options.limit) {
        results = results.slice(0, options.limit);
    }

    // Cache the results (use the same key generated at the start)
    searchCache.set(cacheKey, results);

    return results;
}

/**
 * Get a product by ID.
 * @param {string} id
 * @returns {Object|null}
 */
async function getProductById(id) {
    if (!isInitialized) await initData();
    // O(1) lookup using index
    return indexById.get(id) || null;
}

/**
 * Get all products (for testing/debug)
 */
async function getAllProducts() {
    if (!isInitialized) await initData();
    return products;
}

// Export cache for testing
module.exports = {
    initData,
    searchProducts,
    getProductById,
    getAllProducts,
    searchCache
};
