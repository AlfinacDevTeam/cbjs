class ChatBot extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.attachShadow({ mode: 'open' });
        this.apiKey = this.getAttribute('api-key');
        this.serverUrl = this.getAttribute('server-url') || 'http://localhost:8022/lepus-gpt/llm/api/v1/ask';
        this.isChatVisible = false;
        this.isSending = false;
        this.primaryColor = this.getAttribute('primary-color') || '#FF6F00';
        this.chatWidth = this.getAttribute('chat-width') || '320px';
        this.chatHeight = this.getAttribute('chat-height') || '450px';
        this.positionBottom = this.getAttribute('position-bottom') || '80px';
        this.positionRight = this.getAttribute('position-right') || '20px';
        this.render();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    --primary-color: ${this.primaryColor};
                    --chat-width: ${this.chatWidth};
                    --chat-height: ${this.chatHeight};
                    --position-bottom: ${this.positionBottom};
                    --position-right: ${this.positionRight};
                    --pmr-color: orange;
                }

                .action-button {
                    position: fixed;
                    bottom: 20px;
                    right: var(--position-right);
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    background: var(--primary-color);
                    color: white;
                    border: none;
                    font-size: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                    transition: transform 0.2s;
                    z-index: 1000;
                }
                .action-button:hover {
                    transform: scale(1.1);
                }

                .chat-container {
                    position: fixed;
                    bottom: var(--position-bottom);
                    right: var(--position-right);
                    width: var(--chat-width);
                    max-width: 90vw;
                    height: var(--chat-height);
                    max-height: 80vh;
                    border-radius: 12px;
                    background: white;
                    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
                    display: flex;
                    flex-direction: column;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    overflow: hidden;
                    z-index: 999;
                    opacity: ${this.isChatVisible ? '1' : '0'};
                    transform: ${this.isChatVisible ? 'scale(1)' : 'scale(0.8)'};
                    visibility: ${this.isChatVisible ? 'visible' : 'hidden'};
                    transition: opacity 0.3s ease, transform 0.3s ease, visibility 0.3s ease;
                }

                .chat-header {
                    padding: 12px;
                    background: var(--primary-color);
                    border-bottom: 1px solid #e0e0e0;
                    text-align: center;
                    font-weight: 600;
                    font-size: 16px;
                    color: #ffffff;
                    flex-shrink: 0;
                    position: relative;
                }

                .close-button {
                    position: absolute;
                    right: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    background: none;
                    border: none;
                    color: #333;
                    font-size: 16px;
                    cursor: pointer;
                    padding: 4px;
                    transition: color 0.2s;
                }
                .close-button:hover {
                    color: #000;
                }

                .chat-messages {
                    flex: 1;
                    padding: 12px;
                    overflow-y: auto;
                    background: #ffffff;
                    scroll-behavior: smooth;
                }

                .message {
                    margin-bottom: 12px;
                    display: flex;
                    flex-direction: column;
                }

                .message-you {
                    align-items: flex-start;
                }

                .message-bot, .message-typing {
                    align-items: flex-end;
                }

                .message-bubble {
                    max-width: 70%;
                    padding: 8px 12px;
                    border-radius: 12px;
                    font-size: 14px;
                    line-height: 1.4;
                    word-wrap: break-word;
                }

                .message-you .message-bubble {
                    background: #e9ecef;
                    color: #333;
                    border-bottom-left-radius: 4px;
                }

                .message-bot .message-bubble {
                    background: var(--primary-color);
                    color: white;
                    border-bottom-right-radius: 4px;
                }

                .message-typing .message-bubble {
                    background: var(--primary-color);
                    color: white;
                    border-bottom-right-radius: 4px;
                    display: flex;
                    align-items: center;
                    padding: 8px;
                }

                .message-error .message-bubble {
                    background: #ff4d4f;
                    color: white;
                    align-self: center;
                }

                .typing-dot {
                    width: 6px;
                    height: 6px;
                    background: white;
                    border-radius: 50%;
                    margin: 0 2px;
                    animation: typing 0.8s infinite;
                }

                .typing-dot:nth-child(2) {
                    animation-delay: 0.2s;
                }

                .typing-dot:nth-child(3) {
                    animation-delay: 0.4s;
                }

                @keyframes typing {
                    0%, 100% {
                        transform: translateY(0);
                    }
                    50% {
                        transform: translateY(-4px);
                    }
                }

                .chat-input {
                    display: flex;
                    border-top: 1px solid #e0e0e0;
                    background: white;
                    flex-shrink: 0;
                }

                .chat-input input {
                    flex: 1;
                    padding: 12px;
                    border: none;
                    outline: none;
                    font-size: 14px;
                    background: #ffffff;
                    color: #1a1a1a;
                }

                .chat-input input:disabled {
                    background: #e0e0e0;
                    cursor: not-allowed;
                }

                .chat-input button {
                    padding: 12px 16px;
                    border: none;
                    background: var(--primary-color);
                    color: white;
                    cursor: pointer;
                    font-size: 14px;
                    transition: background 0.2s;
                }

                .chat-input button:disabled {
                    background: #cccccc;
                    cursor: not-allowed;
                }

                .chat-input button:hover:not(:disabled) {
                    background: color-mix(in srgb, var(--primary-color) 90%, black);
                }

                @media (max-width: 480px) {
                    .chat-container {
                        width: 100%;
                        max-width: none;
                        height: 70vh;
                        bottom: 0;
                        right: 0;
                        border-radius: 0;
                    }
                    .action-button {
                        bottom: 16px;
                        right: 16px;
                    }
                }
            </style>

            <button class="action-button" style="z-index: 9999999999" id="toggleChatBtn">💬</button>
            <div class="chat-container" style="z-index: 9999999999;" id="chatContainer">
                <div class="chat-header">
                    BeeGPT Assistant
                    <button class="close-button" style="color: #ff0063" id="closeBtn">✕</button>
                </div>
                <div class="chat-messages" id="messages">
                <div class="message message-bot">
                    <div class="message-bubble">Chào bạn, mình là BeeGPT bạn cần tôi giúp gì?</div>
                </div>
                </div>
                <div class="chat-input">
                    <input id="messageInput" placeholder="Nhập tin nhắn..." />
                    <button id="sendBtn">Gửi</button>
                </div>
            </div>
        `;

        this.shadowRoot.querySelector('#toggleChatBtn').addEventListener('click', () => this.toggleChat());
        this.shadowRoot.querySelector('#closeBtn').addEventListener('click', () => this.toggleChat());
        this.shadowRoot.querySelector('#sendBtn').addEventListener('click', () => this.sendMessage());
        this.shadowRoot.querySelector('#messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
    }

    toggleChat() {
        this.isChatVisible = !this.isChatVisible;
        const chatContainer = this.shadowRoot.querySelector('#chatContainer');
        chatContainer.style.opacity = this.isChatVisible ? '1' : '0';
        chatContainer.style.transform = this.isChatVisible ? 'scale(1)' : 'scale(0.8)';
        chatContainer.style.visibility = this.isChatVisible ? 'visible' : 'hidden';
    }

    async sendMessage() {
        if (this.isSending) return;

        const input = this.shadowRoot.querySelector('#messageInput');
        const sendBtn = this.shadowRoot.querySelector('#sendBtn');
        const message = input.value.trim();
        if (!message) return;

        // Vô hiệu hóa input và button
        this.isSending = true;
        input.disabled = true;
        sendBtn.disabled = true;

        // Hiển thị tin nhắn người dùng
        this.appendMessage('You', message);
        input.value = '';

        // Hiển thị 3 chấm nhảy nhảy
        this.showTypingIndicator();

        try {
            const response = await fetch(this.serverUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey
                },
                body: JSON.stringify({ message })
            });

            const data = await response.json();
            this.removeTypingIndicator();
            this.appendMessage('Bot', data.message || '(Không có phản hồi)');
        } catch (error) {
            this.removeTypingIndicator();
            this.appendMessage('Error', 'Không thể gửi tin nhắn.');
        } finally {
            // Kích hoạt lại input và button
            this.isSending = false;
            input.disabled = false;
            sendBtn.disabled = false;
            input.focus()
        }
    }

    appendMessage(sender, text) {
        // const messagesDiv = this.shadowRoot.querySelector('#messages');
        // const messageElem = document.createElement('div');
        // messageElem.className = `message message-${sender.toLowerCase()}`;
        // messageElem.innerHTML = `<div class="message-bubble">${text}</div>`;
        // messagesDiv.appendChild(messageElem);
        // messagesDiv.scrollTop = messagesDiv.scrollHeight;

        const messagesDiv = this.shadowRoot.querySelector("#messages");
        const messageElem = document.createElement("div");
        messageElem.className = `message message-${sender.toLowerCase()}`;

        // Xử lý chuỗi Markdown
        let formattedText = text
            .replace(/\*\*(.*?)\*\*/g, "$1") // Loại bỏ **...** (in đậm)
            .replace(/\*(.*?)\*/g, "$1") // Loại bỏ *...* (danh sách hoặc in nghiêng)
            .replace(/^\s*\*\s*/gm, ""); // Loại bỏ * ở đầu dòng

        // Tách chuỗi thành các dòng
        const lines = formattedText.split(" * ").map((line) => line.trim());

        // Tạo HTML cho từng dòng
        const bubbleContent = lines
            .map((line) => `<div>${line}</div>`)
            .join("");

        messageElem.innerHTML = `<div class="message-bubble">${bubbleContent}</div>`;
        messagesDiv.appendChild(messageElem);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    showTypingIndicator() {
        const messagesDiv = this.shadowRoot.querySelector('#messages');
        const typingElem = document.createElement('div');
        typingElem.className = 'message message-typing';
        typingElem.id = 'typing-indicator';
        typingElem.innerHTML = `
            <div class="message-bubble">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
            </div>
        `;
        messagesDiv.appendChild(typingElem);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    removeTypingIndicator() {
        const typingElem = this.shadowRoot.querySelector('#typing-indicator');
        if (typingElem) {
            typingElem.remove();
        }
    }
}

customElements.define('chat-bot', ChatBot);
