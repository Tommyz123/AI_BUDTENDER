const OpenAI = require('openai');
const { SYSTEM_PROMPT } = require('./prompts');
const { smartSearch } = require('../tools/smart-search');
const { getProductDetails } = require('../tools/product-details');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'mock-key',
});

// Maximum conversation history turns to keep (sliding window)
const MAX_HISTORY_TURNS = 10;

// Simple message patterns and their responses (skip API calls)
const SIMPLE_RESPONSES = {
    greetings: {
        patterns: [/^hi$/i, /^hello$/i, /^hey$/i, /^yo$/i, /^sup$/i, /^what'?s up$/i, /^howdy$/i],
        responses: [
            "Hey! What can I help you find today?",
            "Hi there! Looking for something specific?",
            "Hey! Ready to explore some great options. What are you in the mood for?"
        ]
    },
    thanks: {
        patterns: [/^thanks?$/i, /^thank you$/i, /^thx$/i, /^ty$/i, /^appreciate it$/i],
        responses: [
            "You're welcome! Let me know if you need anything else.",
            "Happy to help! Anything else?",
            "No problem! I'm here if you have more questions."
        ]
    },
    goodbye: {
        patterns: [/^bye$/i, /^goodbye$/i, /^see ya$/i, /^later$/i, /^cya$/i, /^gotta go$/i],
        responses: [
            "Take care! Come back anytime.",
            "See you later! Enjoy!",
            "Bye! Have a great one!"
        ]
    },
    affirmative: {
        patterns: [/^ok$/i, /^okay$/i, /^cool$/i, /^nice$/i, /^great$/i, /^awesome$/i, /^got it$/i, /^sounds good$/i],
        responses: [
            "Anything else you'd like to know?",
            "Great! What else can I help with?",
            "Glad to hear it! Any other questions?"
        ]
    }
};

/**
 * Check if message is a simple pattern and return appropriate response
 * @param {string} message
 * @returns {string|null} Response or null if not a simple message
 */
function getSimpleResponse(message) {
    const trimmed = message.trim();

    for (const category of Object.values(SIMPLE_RESPONSES)) {
        for (const pattern of category.patterns) {
            if (pattern.test(trimmed)) {
                // Return random response from category
                const responses = category.responses;
                return responses[Math.floor(Math.random() * responses.length)];
            }
        }
    }

    return null;
}

/**
 * Trim history to maintain sliding window
 * @param {Array} history
 * @returns {Array} Trimmed history
 */
function trimHistory(history) {
    // Each turn = 2 messages (user + assistant)
    const maxMessages = MAX_HISTORY_TURNS * 2;

    if (history.length <= maxMessages) {
        return history;
    }

    // Keep only the most recent messages
    console.log(`[Agent] Trimming history from ${history.length} to ${maxMessages} messages`);
    return history.slice(-maxMessages);
}

// Tool Definitions for OpenAI
const TOOLS_SCHEMA = [
    {
        type: "function",
        function: {
            name: "smart_search",
            description: "Search for cannabis products by name, tagline, effect, or general intent.",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "The search query (e.g., 'Blue Dream', 'something for sleep', 'budget indica')."
                    },
                    budgetTarget: {
                        type: "number",
                        description: "Optional target budget in USD."
                    }
                },
                required: ["query"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_product_details",
            description: "Get detailed information about a specific product by its ID.",
            parameters: {
                type: "object",
                properties: {
                    productId: {
                        type: "string",
                        description: "The unique ID of the product (e.g., 'prod_001')."
                    }
                },
                required: ["productId"]
            }
        }
    }
];

class Agent {
    constructor() {
        this.systemPrompt = SYSTEM_PROMPT;
    }

    /**
     * Process a user message and return the assistant's reply.
     * @param {string} userMessage - The user's input.
     * @param {Array} history - Conversational history [{role, content}].
     * @returns {Promise<Object>} { reply: string, history: Array }
     */
    async processMessage(userMessage, history = []) {
        // Check for simple message patterns first
        const simpleReply = getSimpleResponse(userMessage);
        if (simpleReply) {
            console.log(`[Agent] Simple message detected, returning local response`);
            const newHistory = [
                ...history,
                { role: "user", content: userMessage },
                { role: "assistant", content: simpleReply }
            ];
            return {
                reply: simpleReply,
                history: trimHistory(newHistory)
            };
        }

        // Trim history before processing
        const trimmedHistory = trimHistory(history);

        // Prepare messages: System + History + New User Message
        const messages = [
            { role: "system", content: this.systemPrompt },
            ...trimmedHistory,
            { role: "user", content: userMessage }
        ];

        // First call to LLM
        let response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: messages,
            tools: TOOLS_SCHEMA,
            tool_choice: "auto",
        });

        let message = response.choices[0].message;

        // Handle Tool Calls Loop
        while (message.tool_calls) {
            // Append assistant's intent to call tool to history (required by OpenAI API)
            messages.push(message);

            for (const toolCall of message.tool_calls) {
                const fnName = toolCall.function.name;
                const args = JSON.parse(toolCall.function.arguments);
                let result = null;

                console.log(`[Agent] Calling tool: ${fnName} with args:`, args);

                try {
                    if (fnName === 'smart_search') {
                        result = await smartSearch(args.query, { budgetTarget: args.budgetTarget });
                    } else if (fnName === 'get_product_details') {
                        result = await getProductDetails(args.productId);
                    } else {
                        result = { error: "Unknown tool" };
                    }
                } catch (err) {
                    console.error(`[Agent] Tool execution failed:`, err);
                    result = { error: "Tool execution failed" };
                }

                // Append tool result
                messages.push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    name: fnName,
                    content: JSON.stringify(result)
                });
            }

            // Call LLM again with tool results
            response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: messages,
                tools: TOOLS_SCHEMA
            });

            message = response.choices[0].message;
        }

        // Final reply
        const finalReply = message.content;

        // Update history for return (exclude system prompt, include all intermediate steps might be too much for client state?)
        // For simple state management, let's just return the USER message and the FINAL ASSISTANT Reply.
        // But to support multi-turn correctly on stateless server, we should probably return the updated history containing the interaction?
        // Actually, the REQUIREMENTS say "chat interface" usually keeps history.
        // Let's explicitly append the user msg and final reply to the *original* history passed in, ignoring the intermediate tool messages for CLIENT storage usually (unless we want to debug).
        // BUT, to keep context for *next* turn, the Client needs to send back the context.
        // If we strip tool calls, the next turn might be confusing if the LLM refers to "the products I just showed you".
        // HOWEVER, sending huge tool output back and forth is expensive.
        // COMPROMISE for MVP: Return simpler history: User + Assistant.
        // The LLM usually condenses the tool info into its reply.

        const newHistory = [
            ...trimmedHistory,
            { role: "user", content: userMessage },
            { role: "assistant", content: finalReply }
        ];

        return {
            reply: finalReply,
            history: trimHistory(newHistory)
        };
    }
}

// Export for testing
module.exports = { Agent, getSimpleResponse, trimHistory, MAX_HISTORY_TURNS, SIMPLE_RESPONSES };
