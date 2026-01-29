const path = require('path');

// 1. Mock vector-store BEFORE requiring the module under test
const mockVectorSearch = jest.fn();
jest.mock('../src/utils/vector-store', () => ({
    vectorSearch: mockVectorSearch,
    initializeEmbeddings: jest.fn()
}));

// 2. Mock product-repository
jest.mock('../src/data/product-repository', () => {
    return {
        searchProducts: jest.fn(),
        initData: jest.fn()
    };
});

// 3. Require the module under test AFTER mocks are defined
const { smartSearch, vectorCache } = require('../src/tools/smart-search');
const { searchProducts } = require('../src/data/product-repository');

describe('Smart Search Tool', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        vectorCache.clear();
    });

    test('should return exact match if found', async () => {
        // Mock repository to return a product
        searchProducts.mockResolvedValue([
            { id: '1', name: 'Bubble Hash', price: 18 }
        ]);

        const result = await smartSearch('Bubble Hash');

        expect(searchProducts).toHaveBeenCalledWith({ name: 'Bubble Hash' });
        expect(result.isAlternative).toBe(false);
        expect(result.products.length).toBe(1);
        expect(result.reasoning).toContain('exact match');

        // Vector search should NOT be called
        expect(mockVectorSearch).not.toHaveBeenCalled();
    });

    test('should use predefined mapping for known keywords', async () => {
        // 1. Exact search returns empty
        searchProducts
            .mockResolvedValueOnce([]) // First call (name match)
            .mockResolvedValueOnce([   // Second call (association criteria)
                { id: '2', name: 'Northern Lights', type: 'Indica', effects: ['Sleepy'] }
            ]);

        const result = await smartSearch('help me sleep');

        expect(result.isAlternative).toBe(true);
        expect(result.reasoning).toContain('sleep');

        // Check repository was called with Indica/Sleepy
        expect(searchProducts).toHaveBeenLastCalledWith(expect.objectContaining({
            type: 'Indica',
            effect: 'Sleepy'
        }));

        // Vector search should NOT be called for predefined mappings
        expect(mockVectorSearch).not.toHaveBeenCalled();
    });

    test('should fallback to vector search for unknown queries', async () => {
        // 1. Exact search returns empty
        searchProducts.mockResolvedValueOnce([]);

        // 2. Vector search returns products
        mockVectorSearch.mockResolvedValue([
            { id: '3', name: 'Blue Dream', type: 'Hybrid', price: 20 },
            { id: '4', name: 'Sunset Sherbet', type: 'Hybrid', price: 22 }
        ]);

        const result = await smartSearch('something mellow for evening');

        expect(result.isAlternative).toBe(true);
        expect(result.products.length).toBe(2);
        expect(result.reasoning).toContain('semantic similarity');

        // Vector search should be called
        expect(mockVectorSearch).toHaveBeenCalledWith('something mellow for evening', 5);
    });

    test('should apply budget soft limit', async () => {
        // Mock budget situation
        searchProducts.mockResolvedValue([
            { id: '1', name: 'Expensive', price: 25 },
            { id: '2', name: 'Cheap', price: 15 }
        ]);

        // Test on exact match path first
        const result = await smartSearch('Exact', { budgetTarget: 20 });

        // 20 * 1.2 = 24. Should filter out 25.
        expect(result.products.length).toBe(1);
        expect(result.products[0].name).toBe('Cheap');
    });

    test('should apply budget filter to vector search results', async () => {
        // 1. Exact search returns empty
        searchProducts.mockResolvedValueOnce([]);

        // 2. Vector search returns products with various prices
        mockVectorSearch.mockResolvedValue([
            { id: '1', name: 'Premium', price: 50 },
            { id: '2', name: 'Mid-range', price: 25 },
            { id: '3', name: 'Budget', price: 15 }
        ]);

        const result = await smartSearch('good vibes', { budgetTarget: 20 });

        // 20 * 1.2 = 24. Should filter out 50 and 25.
        expect(result.products.length).toBe(1);
        expect(result.products[0].name).toBe('Budget');
    });

    test('should cache vector search results', async () => {
        // 1. First call - exact search returns empty
        searchProducts.mockResolvedValue([]);

        // 2. Vector search returns products
        mockVectorSearch.mockResolvedValue([
            { id: '1', name: 'Test Product', price: 20 }
        ]);

        // First call
        await smartSearch('unique query');
        expect(mockVectorSearch).toHaveBeenCalledTimes(1);

        // Second call with same query - should use cache
        await smartSearch('unique query');
        expect(mockVectorSearch).toHaveBeenCalledTimes(1); // Still 1, not 2
    });
});
