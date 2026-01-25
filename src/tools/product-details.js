const { getProductById } = require('../data/product-repository');

/**
 * Get product details by ID.
 * @param {string} productId - The ID of the product to retrieve.
 * @returns {Promise<Object|null>} The product object or null if not found.
 */
async function getProductDetails(productId) {
    try {
        const product = await getProductById(productId);
        return product;
    } catch (error) {
        console.error(`Error fetching product details for ID ${productId}:`, error);
        return null;
    }
}

module.exports = { getProductDetails };
