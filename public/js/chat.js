const messagesArea = document.getElementById('messages-area');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

let conversationHistory = [];

// Request management
let isRequestPending = false;
let lastMessageText = '';
let lastMessageTime = 0;
const DEBOUNCE_MS = 500;
const REQUEST_TIMEOUT_MS = 30000;

function addMessage(text, role) {
    // Remove loading indicator if present
    removeLoadingIndicator();

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

function addLoadingIndicator() {
    const loadingDiv = document.createElement('div');
    loadingDiv.classList.add('message', 'assistant', 'loading-message');
    loadingDiv.id = 'loading-indicator';

    const bubbleDiv = document.createElement('div');
    bubbleDiv.classList.add('bubble', 'loading-bubble');

    const dotsDiv = document.createElement('div');
    dotsDiv.classList.add('loading-dots');
    dotsDiv.innerHTML = '<span></span><span></span><span></span>';

    bubbleDiv.appendChild(dotsDiv);
    loadingDiv.appendChild(bubbleDiv);
    messagesArea.appendChild(loadingDiv);

    // Scroll to bottom
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

function removeLoadingIndicator() {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.remove();
    }
}

function isDuplicateMessage(text) {
    const now = Date.now();
    if (text === lastMessageText && (now - lastMessageTime) < DEBOUNCE_MS) {
        return true;
    }
    lastMessageText = text;
    lastMessageTime = now;
    return false;
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    // Prevent duplicate/concurrent requests
    if (isRequestPending) {
        console.log('Request already pending, ignoring');
        return;
    }

    if (isDuplicateMessage(text)) {
        console.log('Duplicate message detected, ignoring');
        return;
    }

    // Set request lock
    isRequestPending = true;

    // Disable input
    userInput.disabled = true;
    sendBtn.disabled = true;

    // Add user message to UI
    addMessage(text, 'user');
    userInput.value = '';

    // Show loading indicator
    addLoadingIndicator();

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: text,
                history: conversationHistory
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

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

        if (error.name === 'AbortError') {
            addMessage("Sorry, that took too long. Please try again.", 'assistant');
        } else {
            addMessage("Sorry, I had a bit of a brain fog. Can you say that again?", 'assistant');
        }
    } finally {
        clearTimeout(timeoutId);
        isRequestPending = false;
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
