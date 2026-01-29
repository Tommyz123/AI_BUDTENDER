const path = require('path');

// 1. Define mocks BEFORE mocking
const mockCreate = jest.fn();
const mockVectorSearch = jest.fn();

// 2. Mock OpenAI
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

// 3. Mock vector-store
jest.mock('../src/utils/vector-store', () => ({
    vectorSearch: mockVectorSearch,
    initializeEmbeddings: jest.fn()
}));

// 4. Require Modules
// Note: We are testing the integration, so we use REAL Agent, SmartSearch, and Repo.
// But we need to ensure they pick up the MOCKED OpenAI and vector-store.
const { Agent } = require('../src/agent/brain');
const { initData, searchProducts } = require('../src/data/product-repository');

const TEST_CSV_PATH = path.resolve(__dirname, '../data/NYE2.1.csv');

describe('Full Agent Integration', () => {
    let agent;

    beforeAll(async () => {
        // Initialize REAL data
        await initData(TEST_CSV_PATH);
    });

    beforeEach(() => {
        jest.clearAllMocks();
        agent = new Agent();
    });

    test('Scenario: Exact Match Search', async () => {
        // Mock 1: Agent calls OpenAI -> returns Tool Call
        mockCreate.mockResolvedValueOnce({
            choices: [{
                message: {
                    role: 'assistant',
                    content: null,
                    tool_calls: [{
                        id: 'call_1',
                        type: 'function',
                        function: {
                            name: 'smart_search',
                            arguments: JSON.stringify({ query: 'Bubble Hash' })
                        }
                    }]
                }
            }]
        });

        // Mock 2: Agent calls OpenAI with tool result -> returns Final Reply
        // The real tool execution happens between these two mocks!
        mockCreate.mockResolvedValueOnce({
            choices: [{
                message: {
                    role: 'assistant',
                    content: "I found Bubble Hash for $18!"
                }
            }]
        });

        const result = await agent.processMessage("Bubble Hash");

        // Assertions
        expect(result.reply).toContain("Bubble Hash");
        expect(mockCreate).toHaveBeenCalledTimes(2); // 1. Decide Tool, 2. Reply with Data
    });

    test('Scenario: Fallback with Vector Search', async () => {
        // Mock 1: Agent -> Tool Call (smart_search 'Purple Haze')
        mockCreate.mockResolvedValueOnce({
            choices: [{
                message: {
                    role: 'assistant',
                    content: null,
                    tool_calls: [{
                        id: 'call_2',
                        type: 'function',
                        function: {
                            name: 'smart_search',
                            arguments: JSON.stringify({ query: 'Purple Haze' })
                        }
                    }]
                }
            }]
        });

        // Mock 2: Vector search returns similar products
        // (No LLM call needed now - vector search replaces it)
        mockVectorSearch.mockResolvedValueOnce([
            { id: 'test-1', name: 'Sour Diesel', type: 'Sativa', price: 20 },
            { id: 'test-2', name: 'Green Crack', type: 'Sativa', price: 18 }
        ]);

        // Mock 3: Agent calls OpenAI with tool result -> Final Reply
        mockCreate.mockResolvedValueOnce({
            choices: [{
                message: {
                    role: 'assistant',
                    content: "Try Sour Diesel instead."
                }
            }]
        });

        const result = await agent.processMessage("Purple Haze");

        expect(result.reply).toContain("Sour Diesel");
        // Now only 2 OpenAI calls (no LLM for association)
        expect(mockCreate).toHaveBeenCalledTimes(2);
        // Vector search should have been called
        expect(mockVectorSearch).toHaveBeenCalledWith('Purple Haze', 5);
    });

    test('Scenario: Predefined Mapping (no vector search needed)', async () => {
        // Mock 1: Agent -> Tool Call (smart_search 'help me sleep')
        mockCreate.mockResolvedValueOnce({
            choices: [{
                message: {
                    role: 'assistant',
                    content: null,
                    tool_calls: [{
                        id: 'call_3',
                        type: 'function',
                        function: {
                            name: 'smart_search',
                            arguments: JSON.stringify({ query: 'help me sleep' })
                        }
                    }]
                }
            }]
        });

        // Mock 2: Agent calls OpenAI with tool result -> Final Reply
        mockCreate.mockResolvedValueOnce({
            choices: [{
                message: {
                    role: 'assistant',
                    content: "For sleep, I recommend these Indica strains."
                }
            }]
        });

        const result = await agent.processMessage("help me sleep");

        expect(result.reply).toContain("sleep");
        expect(mockCreate).toHaveBeenCalledTimes(2);
        // Vector search should NOT be called for predefined mappings
        expect(mockVectorSearch).not.toHaveBeenCalled();
    });
});
