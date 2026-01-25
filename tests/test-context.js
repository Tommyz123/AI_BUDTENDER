require('dotenv').config();
const { Agent } = require('../src/agent/brain');

async function testContext() {
    console.log("🧪 Starting Context Awareness Test...");
    const agent = new Agent();
    let history = [];

    // Step 1: Broad request
    console.log("\n👤 User: 'something for sleep'");
    const res1 = await agent.processMessage("something for sleep", history);
    console.log("🤖 Agent:", res1.reply);
    history = res1.history;

    // Check if agent asked a clarifying question or provided a mix
    // (Manual verification or heuristic check)

    // Step 2: Refined request (Context Switch/Add)
    console.log("\n👤 User: 'do you have preroll?'");
    // KEY: We expect the agent to search for "sleep preroll", not just "preroll"
    // We can't see the internal tool call here directly without mocking, 
    // but we can judge by the response text or if we mock the tool.
    // For this e2e test, we'll see if the recommended products are indeed pre-rolls AND related to sleep.

    const res2 = await agent.processMessage("do you have preroll?", history);
    console.log("🤖 Agent:", res2.reply);

    // Simplistic check: does the reply mention "sleep" or "relax" and "pre-roll" or product names associated with sleep?
    if (res2.reply.toLowerCase().includes("sleep") || res2.reply.toLowerCase().includes("relax")) {
        console.log("\n✅ PASS: Context 'sleep' seems to be retained.");
    } else {
        console.log("\n❌ FAIL: Agent might have forgotten 'sleep' context.");
    }
}

testContext();
