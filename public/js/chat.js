const messagesArea = document.getElementById('messages-area');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

let conversationHistory = [];

// Initialize history with existing messages if any (maybe later)

function addMessage(text, role) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', role);

    const bubbleDiv = document.createElement('div');
    bubbleDiv.classList.add('bubble');
    // Simple text handling; for rich MD would need a library like markdown-it
    bubbleDiv.innerText = text;

    messageDiv.appendChild(bubbleDiv);
    messagesArea.appendChild(messageDiv);

    // Scroll to bottom
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    // Disable input
    userInput.disabled = true;
    sendBtn.disabled = true;

    // Add user message to UI
    addMessage(text, 'user');
    userInput.value = '';

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: text,
                history: conversationHistory
            })
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();

        // Update history
        conversationHistory = data.history;

        // Add assistant reply
        addMessage(data.reply, 'assistant');
    } catch (error) {
        console.error('Error:', error);
        addMessage("Sorry, I had a bit of a brain fog. Can you say that again?", 'assistant');
    } finally {
        userInput.disabled = false;
        sendBtn.disabled = false;
        userInput.focus();
    }
}

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});
