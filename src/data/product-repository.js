const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const { cleanData } = require('./cleaner');

let products = [];
let isInitialized = false;

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
            console.log(`[DataLayer] Loaded and cleaned ${products.length} products.`);
            resolve();
        });
    });
}

/**
 * Search products by criteria.
 * @param {Object} criteria - { name, type, minPrice, maxPrice, effect }
 * @returns {Array} Filtered products
 */
async function searchProducts(criteria = {}) {
    if (!isInitialized) await initData();

    return products.filter(p => {
        let match = true;

        if (criteria.name) {
            match = match && p.name.toLowerCase().includes(criteria.name.toLowerCase());
        }

        if (criteria.type) {
            match = match && p.type.toLowerCase() === criteria.type.toLowerCase();
        }

        if (criteria.minPrice !== undefined) {
            match = match && p.price >= criteria.minPrice;
        }

        if (criteria.maxPrice !== undefined) {
            match = match && p.price <= criteria.maxPrice;
        }

        // Exact effect match (case insensitive)
        if (criteria.effect) {
            const effectLower = criteria.effect.toLowerCase();
            const hasEffect = p.effects.some(e => e.toLowerCase() === effectLower);
            match = match && hasEffect;
        }

        return match;
    });
}

/**
 * Get a product by ID.
 * @param {string} id 
 * @returns {Object|null}
 */
async function getProductById(id) {
    if (!isInitialized) await initData();
    return products.find(p => p.id === id) || null;
}

/**
 * Get all products (for testing/debug)
 */
async function getAllProducts() {
    if (!isInitialized) await initData();
    return products;
}

module.exports = {
    initData,
    searchProducts,
    getProductById,
    getAllProducts
};
