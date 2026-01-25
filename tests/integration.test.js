const path = require('path');

// 1. Define mock BEFORE mocking
const mockCreate = jest.fn();

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

// 3. Require Modules
// Note: We are testing the integration, so we use REAL Agent, SmartSearch, and Repo.
// But we need to ensure they pick up the MOCKED OpenAI.
const { Agent } = require('../src/agent/brain');
const { initData } = require('../src/data/product-repository');

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
        // Since Agent mocks are cleared, we don't need to re-instantiate if it's stateless, but it's safer.
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

    test('Scenario: Fallback with Association', async () => {
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

        // Mock 2: SmartSearch internal call -> OpenAI Association
        // Be careful: SmartSearch creates its OWN OpenAI instance. 
        // Because we mocked 'openai' module at the top, that instance also uses 'mockCreate'!
        // So the NEXT call to mockCreate will be from INSIDE SmartSearch.
        mockCreate.mockResolvedValueOnce({
            choices: [{
                message: {
                    role: 'assistant',
                    content: JSON.stringify({
                        type: 'Sativa',
                        effect: 'Energetic',
                        reasoning: 'Purple Haze is energetic.'
                    })
                }
            }]
        });

        // Mock 3: Agent calls OpenAI with tool result (from SmartSearch fallback) -> Final Reply
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
        expect(mockCreate).toHaveBeenCalledTimes(3);

        // Verify middle call was for association
        const associationCall = mockCreate.mock.calls[1][0];
        // The user message in association call is the query 'Purple Haze'
        expect(associationCall.messages[1].content).toBe('Purple Haze');
    });
});
