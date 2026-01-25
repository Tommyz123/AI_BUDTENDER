const { getProductDetails } = require('../src/tools/product-details');
const { initData } = require('../src/data/product-repository');
const path = require('path');

// Ensure data is loaded
const TEST_CSV_PATH = path.resolve(__dirname, '../data/NYE2.1.csv');

describe('Product Details Tool', () => {
    beforeAll(async () => {
        await initData(TEST_CSV_PATH);
    });

    test('should return product details for existing ID', async () => {
        // prod_001 corresponds to line 2 in CSV (Bubble Hash)
        const product = await getProductDetails('prod_001');
        expect(product).not.toBeNull();
        expect(product.id).toBe('prod_001');
        expect(product.name).toBe('Bubble Hash');
        expect(product.price).toBe(18.00);
    });

    test('should return null for non-existent ID', async () => {
        const product = await getProductDetails('fake_id_99999');
        expect(product).toBeNull();
    });
});
