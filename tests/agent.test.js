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

    test('should return local response for simple greetings (skip API)', async () => {
        const result = await agent.processMessage("Hi");

        // Should use local response, not call API
        expect(result.reply).toMatch(/Hey|Hi|Hello/);
        expect(result.history).toHaveLength(2); // user + assistant
        expect(mockCreate).not.toHaveBeenCalled();
    });

    test('should process complex message with API call', async () => {
        mockCreate.mockResolvedValue({
            choices: [{
                message: {
                    content: "I can help you find products!",
                    tool_calls: null
                }
            }]
        });

        const result = await agent.processMessage("What products do you have?");

        expect(result.reply).toBe("I can help you find products!");
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

    // Streaming tests
    describe('processMessageStream', () => {
        test('should yield content events for simple greetings (skip API)', async () => {
            const events = [];
            for await (const event of agent.processMessageStream("Hi")) {
                events.push(event);
            }

            // Should have content and done events
            expect(events.length).toBe(2);
            expect(events[0].type).toBe('content');
            expect(events[0].content).toMatch(/Hey|Hi|Hello/);
            expect(events[1].type).toBe('done');
            expect(events[1].history).toHaveLength(2);
            expect(mockCreate).not.toHaveBeenCalled();
        });

        test('should yield status and content events for tool calls', async () => {
            // Mock async iterator for streaming response
            const mockStreamIterator = {
                async *[Symbol.asyncIterator]() {
                    yield { choices: [{ delta: { content: 'Found ' } }] };
                    yield { choices: [{ delta: { content: 'products!' } }] };
                }
            };

            // 1. First call returns tool call request
            mockCreate.mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: null,
                        tool_calls: [{
                            id: 'call_123',
                            function: {
                                name: 'smart_search',
                                arguments: '{"query": "sleep"}'
                            }
                        }]
                    }
                }]
            });

            smartSearch.mockResolvedValue({ products: [{ name: 'Sleep Aid', price: 20 }] });

            // 2. Second call returns non-tool response
            mockCreate.mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: 'Here are some products...',
                        tool_calls: null
                    }
                }]
            });

            // 3. Third call (streaming) for final response
            mockCreate.mockResolvedValueOnce(mockStreamIterator);

            const events = [];
            for await (const event of agent.processMessageStream("something for sleep")) {
                events.push(event);
            }

            // Should have status, content, content, done events
            const statusEvents = events.filter(e => e.type === 'status');
            const contentEvents = events.filter(e => e.type === 'content');
            const doneEvents = events.filter(e => e.type === 'done');

            expect(statusEvents.length).toBe(1);
            expect(statusEvents[0].content).toBe('正在搜索产品...');
            expect(contentEvents.length).toBeGreaterThan(0);
            expect(doneEvents.length).toBe(1);
            expect(doneEvents[0].history).toBeDefined();
        });

        test('should stream content for non-tool responses', async () => {
            const mockStreamIterator = {
                async *[Symbol.asyncIterator]() {
                    yield { choices: [{ delta: { content: 'Hello, ' } }] };
                    yield { choices: [{ delta: { content: 'how can ' } }] };
                    yield { choices: [{ delta: { content: 'I help?' } }] };
                }
            };

            // First call - no tool needed
            mockCreate.mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: 'Hello, how can I help?',
                        tool_calls: null
                    }
                }]
            });

            // Second call - streaming
            mockCreate.mockResolvedValueOnce(mockStreamIterator);

            const events = [];
            for await (const event of agent.processMessageStream("Tell me about this store")) {
                events.push(event);
            }

            const contentEvents = events.filter(e => e.type === 'content');
            const doneEvents = events.filter(e => e.type === 'done');

            expect(contentEvents.length).toBe(3);
            expect(contentEvents.map(e => e.content).join('')).toBe('Hello, how can I help?');
            expect(doneEvents.length).toBe(1);
        });
    });
});
