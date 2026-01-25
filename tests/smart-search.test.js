const path = require('path');

// 1. Mock OpenAI BEFORE requiring the module under test
const mockCreate = jest.fn();
jest.mock('openai', () => {
    return jest.fn().mockImplementation(() => {
        return {
            chat: {
                completions: {
                    create: mockCreate
                }
            }
        };
    });
});

// 2. Mock product-repository
jest.mock('../src/data/product-repository', () => {
    return {
        searchProducts: jest.fn(),
        initData: jest.fn()
    };
});

// 3. Require the module under test AFTER mocks are defined
const { smartSearch } = require('../src/tools/smart-search');
const { searchProducts } = require('../src/data/product-repository');

describe('Smart Search Tool', () => {
    beforeEach(() => {
        jest.clearAllMocks();
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

        // OpenAI should NOT be called
        expect(mockCreate).not.toHaveBeenCalled();
    });

    test('should fallback to association if no exact match', async () => {
        // 1. Exact search returns empty
        searchProducts
            .mockResolvedValueOnce([]) // First call (name match)
            .mockResolvedValueOnce([   // Second call (association criteria)
                { id: '2', name: 'Sour Diesel', type: 'Sativa', effects: ['Creative'] }
            ]);

        // 2. OpenAI returns association
        mockCreate.mockResolvedValue({
            choices: [{
                message: {
                    content: JSON.stringify({
                        type: 'Sativa',
                        effect: 'Creative',
                        reasoning: 'Testing reasoning'
                    })
                }
            }]
        });

        const result = await smartSearch('Purple Haze');

        expect(result.isAlternative).toBe(true);
        expect(result.products.length).toBe(1);
        expect(result.reasoning).toBe('Testing reasoning');

        // Check repository call
        expect(searchProducts).toHaveBeenLastCalledWith(expect.objectContaining({
            type: 'Sativa',
            effect: 'Creative'
        }));
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
});
