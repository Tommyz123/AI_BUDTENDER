const OpenAI = require('openai');
const { SYSTEM_PROMPT } = require('./prompts');
const { smartSearch } = require('../tools/smart-search');
const { getProductDetails } = require('../tools/product-details');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'mock-key',
});

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
        // Prepare messages: System + History + New User Message
        const messages = [
            { role: "system", content: this.systemPrompt },
            ...history,
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
            ...history,
            { role: "user", content: userMessage },
            { role: "assistant", content: finalReply }
        ];

        return {
            reply: finalReply,
            history: newHistory
        };
    }
}

module.exports = { Agent };
