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

/**
 * Create an empty assistant message bubble for streaming content
 * @returns {HTMLElement} The bubble div element to update with content
 */
function createStreamingBubble() {
    // Remove loading indicator if present
    removeLoadingIndicator();

    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', 'assistant');
    messageDiv.id = 'streaming-message';

    const bubbleDiv = document.createElement('div');
    bubbleDiv.classList.add('bubble');
    bubbleDiv.id = 'streaming-bubble';

    messageDiv.appendChild(bubbleDiv);
    messagesArea.appendChild(messageDiv);

    // Scroll to bottom
    messagesArea.scrollTop = messagesArea.scrollHeight;

    return bubbleDiv;
}

/**
 * Update the streaming bubble with new content
 * @param {HTMLElement} bubble - The bubble element
 * @param {string} content - The full content to display
 */
function updateStreamingBubble(bubble, content) {
    bubble.innerText = content;
    // Scroll to bottom as content grows
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

/**
 * Finalize the streaming message (remove temporary IDs)
 */
function finalizeStreamingMessage() {
    const messageDiv = document.getElementById('streaming-message');
    const bubbleDiv = document.getElementById('streaming-bubble');
    if (messageDiv) messageDiv.removeAttribute('id');
    if (bubbleDiv) bubbleDiv.removeAttribute('id');
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

/**
 * Check if the browser supports streaming (ReadableStream)
 * @returns {boolean}
 */
function supportsStreaming() {
    return typeof ReadableStream !== 'undefined';
}

/**
 * Send message with streaming response (SSE)
 */
async function sendMessageStream(text) {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch('/api/chat/stream', {
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

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let bubble = null;
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Parse SSE data lines
            const lines = buffer.split('\n');
            // Keep incomplete line in buffer
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));

                        if (data.type === 'content') {
                            // Create bubble on first content
                            if (!bubble) {
                                bubble = createStreamingBubble();
                            }
                            fullContent += data.content;
                            updateStreamingBubble(bubble, fullContent);
                        } else if (data.type === 'status') {
                            // Show status in loading indicator
                            removeLoadingIndicator();
                            addLoadingIndicator();
                            const loadingBubble = document.querySelector('.loading-bubble');
                            if (loadingBubble) {
                                // Add status text above dots
                                const statusDiv = document.createElement('div');
                                statusDiv.classList.add('status-text');
                                statusDiv.innerText = data.content;
                                loadingBubble.insertBefore(statusDiv, loadingBubble.firstChild);
                            }
                        } else if (data.type === 'done') {
                            conversationHistory = data.history;
                            finalizeStreamingMessage();
                        } else if (data.type === 'error') {
                            throw new Error(data.content);
                        }
                    } catch (parseError) {
                        console.error('Error parsing SSE data:', parseError);
                    }
                }
            }
        }

        // Handle case where no content was received
        if (!bubble && fullContent === '') {
            addMessage("Sorry, I couldn't generate a response.", 'assistant');
        }

    } catch (error) {
        console.error('Streaming Error:', error);
        removeLoadingIndicator();
        finalizeStreamingMessage();

        if (error.name === 'AbortError') {
            addMessage("Sorry, that took too long. Please try again.", 'assistant');
        } else {
            addMessage("Sorry, I had a bit of a brain fog. Can you say that again?", 'assistant');
        }
    }
}

/**
 * Send message with non-streaming response (fallback)
 */
async function sendMessageNonStream(text) {
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
    }
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

    try {
        // Use streaming if supported, otherwise fall back to non-streaming
        if (supportsStreaming()) {
            await sendMessageStream(text);
        } else {
            await sendMessageNonStream(text);
        }
    } finally {
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
