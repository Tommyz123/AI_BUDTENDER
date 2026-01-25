const path = require('path');
const { initData, searchProducts, getProductById, getAllProducts } = require('../src/data/product-repository');

// Mock data path
const TEST_CSV_PATH = path.resolve(__dirname, '../data/NYE2.1.csv');

describe('Data Layer', () => {
    beforeAll(async () => {
        await initData(TEST_CSV_PATH);
    });

    test('should load and clean data correctly', async () => {
        const products = await getAllProducts();
        expect(products.length).toBeGreaterThan(0);

        // Check first item structure
        const p1 = products[0];
        expect(p1).toHaveProperty('id');
        expect(p1).toHaveProperty('name');
        expect(p1).toHaveProperty('price');
        expect(p1).toHaveProperty('effects');
        expect(Array.isArray(p1.effects)).toBe(true);
    });

    test('should search by name', async () => {
        // There is "Bubble Hash" in the mocked CSV view I saw earlier
        const results = await searchProducts({ name: 'Bubble' });
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].name).toContain('Bubble');
    });

    test('should search by type', async () => {
        const results = await searchProducts({ type: 'Hybrid' });
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].type).toBe('Hybrid');
    });

    test('should search by price range', async () => {
        const results = await searchProducts({ maxPrice: 20 });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(p => {
            expect(p.price).toBeLessThanOrEqual(20);
        });
    });

    test('should get product by ID', async () => {
        const all = await getAllProducts();
        const targetId = all[0].id;

        const product = await getProductById(targetId);
        expect(product).toBeDefined();
        expect(product.id).toBe(targetId);
    });

    test('should return null for non-existent ID', async () => {
        const product = await getProductById('non_existent_id_999');
        expect(product).toBeNull();
    });
});
