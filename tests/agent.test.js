// 1. Mock OpenAI BEFORE requiring anything
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

// 2. Mock Tools modules
jest.mock('../src/tools/smart-search', () => ({
    smartSearch: jest.fn()
}));
jest.mock('../src/tools/product-details', () => ({
    getProductDetails: jest.fn()
}));

// 3. Require Module Under Test
const { Agent } = require('../src/agent/brain');
const { smartSearch } = require('../src/tools/smart-search'); // Require mock to spy on it

describe('Agent Brain', () => {
    let agent;

    beforeEach(() => {
        jest.clearAllMocks();
        agent = new Agent();
    });

    test('should process simple message without tool calls', async () => {
        mockCreate.mockResolvedValue({
            choices: [{
                message: {
                    content: "Hello! I am Fried Rice.",
                    tool_calls: null
                }
            }]
        });

        const result = await agent.processMessage("Hi");

        expect(result.reply).toBe("Hello! I am Fried Rice.");
        expect(result.history).toHaveLength(2); // user + assistant
        expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    test('should handle tool calls correctly', async () => {
        // 1. First call returns tool call request
        mockCreate.mockResolvedValueOnce({
            choices: [{
                message: {
                    content: null,
                    tool_calls: [{
                        id: 'call_123',
                        function: {
                            name: 'smart_search',
                            arguments: '{"query": "weed"}'
                        }
                    }]
                }
            }]
        });

        // 2. Second call returns final answer after tool execution
        // Mock the tool execution result first
        smartSearch.mockResolvedValue({ products: [{ name: 'Mock Weed', price: 10 }] });

        mockCreate.mockResolvedValueOnce({
            choices: [{
                message: {
                    content: "I found some Mock Weed for you.",
                    tool_calls: null
                }
            }]
        });

        const result = await agent.processMessage("I want weed");

        expect(smartSearch).toHaveBeenCalledWith('weed', expect.anything());
        expect(result.reply).toBe("I found some Mock Weed for you.");
        expect(mockCreate).toHaveBeenCalledTimes(2);
    });
});
