class ChatBot extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.attachShadow({mode: 'open'});
        this.serverUrl = this.getAttribute('server-url');
        this.access_token = this.getAttribute('access-token');
        this.user_bfs = this.getAttribute('user-bfs');
        this.model_type = this.getAttribute('model-type') || "bee";
        this.session_chatbot = ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
        this.isChatVisible = this.getAttribute('chat-visible') !== "N";
        this.isSending = false;
        this.primaryColor = this.getAttribute('primary-color') || '#FF6F00';
        this.chatWidth = this.getAttribute('chat-width') || '320px';
        this.margin = this.getAttribute('margin') || '0px';
        this.chatHeight = this.getAttribute('chat-height') || '450px';
        this.positionBottom = this.getAttribute('position-bottom') || '80px';
        this.positionRight = this.getAttribute('position-right') || '20px';
        this.chatHistory = [];
        this.socket_url = this.getAttribute('socket-url') || 'https://api.alfinac.com:5002';
        this.socket_path = this.getAttribute('socket-path') || '/lepus-socket-io/socket';
        this.chat_with_staff = false;
        this.socket = null;
        this.currentRoom = null;
        this.render();
        // Thêm script socket.io sau khi render xong
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/gh/AlfinacDevTeam/cbjs@socket-io/socket/socket.io.min.js';
        script.type = 'text/javascript';
        script.onload = () => {
            console.log('Socket.IO script loaded successfully');
        };
        document.head.appendChild(script); // ✅ dùng document.head

    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    --primary-color: ${this.primaryColor};
                    --chat-width: ${this.chatWidth};
                    --chat-height: ${this.chatHeight};
                    --margin: ${this.margin};
                    --position-bottom: ${this.positionBottom};
                    --position-right: ${this.positionRight};
                    --pmr-color: orange;
                }

                .action-button {
                    position: fixed;
                    bottom: 30px;
                    display:${this.isChatVisible ? 'none' : 'flex'} ;
                    right: var(--position-right);
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    background: var(--primary-color);
                    color: white;
                    border: none;
                    font-size: 24px;
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
                        width: 100%;
                        /*max-width: none;*/
                        /*height: 100%;*/
                        bottom: 0;
                        right: 0;
                        border-radius: 0;
                    margin: var(--margin);
                    position: fixed;
                    /*bottom: var(--position-bottom);*/
                    /*right: var(--position-right);*/
                    width: var(--chat-width);
                    /*max-width: 90vw;*/
                    height: var(--chat-height);
                    max-height: 100%;
                    /*border-radius: 12px;*/
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
                    align-items: flex-end;
                }

                .message-bot, .message-typing {
                    align-items: flex-start;
                }

                .message-bubble {
                    max-width: 70%;
                    padding: 8px 12px;
                    border-radius: 12px;
                    font-size: 14px;
                    line-height: 1.4;
                    word-wrap: break-word;
                    white-space: pre-wrap; 
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
                .message-bubble:empty {
                    padding: 0;
                    margin: 0;
                    background: transparent;
                    border: none;
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
                .menu-wrapper {
                    position: absolute;
                    right: 36px;
                    top: 50%;
                    transform: translateY(-50%);
                     width: max-content; /* hoặc bỏ width */
                }
                
                .menu-button {
                    background: transparent;
                    border: none;
                    font-size: 18px;
                    color: white;
                    cursor: pointer;
                }
                
                .menu-dropdown {
                    position: absolute;
                    top: 30px;
                    right: 0;
                    background: white;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    display: none;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                    z-index: 999;
                    min-width: 160px;
                    white-space: nowrap;
                }
                
                .menu-item {
                    padding: 10px 12px;
                    cursor: pointer;
                    font-size: 14px;
                    color: #333;
                }
                
                .menu-item:hover {
                    background-color: #f0f0f0;
                }
                
                .message-noti {
                    justify-content: center;
                    font-size: 13px;
                    color: #888;
                    text-align: center;
                }
                
                .message-noti .message-bubble {
                    background: none;
                    color: #888;
                    box-shadow: none;
                    padding: 0;
                }

            </style>

            <button class="action-button" style="z-index: 9999999999" id="toggleChatBtn">💬</button>
            <div class="chat-container" style="z-index: 9999999999;" id="chatContainer">
               <div class="chat-header">
                    Alfinac AI Assistant
                    <div class="menu-wrapper">
                        <button class="menu-button" id="menuBtn">⋮</button>
                        <div class="menu-dropdown" id="menuDropdown">
                            <div class="menu-item" id="chatWithStaff">💬 Chat với nhân viên</div>
                            <div class="menu-item" id="endChatWithStaff" style="display: none">❌ Kết thúc với nhân viên</div>
                        </div>
                    </div>
                    <button class="close-button" style="color: #ff0063" id="closeBtn">✕</button>
                </div>
                <div class="chat-messages" id="messages">
                <div class="message message-bot">
                    <div class="message-bubble">Chào bạn, mình là Alfinac AI Assistant bạn cần tôi giúp gì?</div>
                </div>
                </div>
                <div class="chat-input">
                    <input id="messageInput" maxlength="200" placeholder="Nhập tin nhắn (200 từ)..."/>
                    <button id="sendBtn">Gửi</button>
                </div>
                <input id="hidden_history" type="hidden" value="[]">
            </div>
        `;
        this.autoScroll()
        this.shadowRoot.querySelector('#toggleChatBtn').addEventListener('click', () => this.toggleChat());
        this.shadowRoot.querySelector('#closeBtn').addEventListener('click', () => this.toggleChat());
        this.shadowRoot.querySelector('#sendBtn').addEventListener('click', () => this.sendMessage());
        this.shadowRoot.querySelector('#messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        // Xử lý mở/tắt dropdown
        const menuBtn = this.shadowRoot.querySelector('#menuBtn');
        const menuDropdown = this.shadowRoot.querySelector('#menuDropdown');
        menuBtn.addEventListener('click', () => {
            menuDropdown.style.display = menuDropdown.style.display === 'block' ? 'none' : 'block';
        });
        const chatWithStaff = this.shadowRoot.querySelector('#chatWithStaff');
        const endChatWithStaff = this.shadowRoot.querySelector('#endChatWithStaff');
        let dom_chat_with_staff = this.chat_with_staff;


        endChatWithStaff.addEventListener('click', () => {
            this.disconnect()
        });


        chatWithStaff.addEventListener('click', () => {
            menuDropdown.style.display = 'none';
            dom_chat_with_staff = true
            if (dom_chat_with_staff) {
                function callbackConnect() {
                    this.disableSending(true)
                    endChatWithStaff.style.display = 'block';
                    chatWithStaff.style.display = 'none';
                    // this.showTypingIndicatorWithText("Đang kết nối với nhân viên");
                    this.showWaitingCountdown(300);
                }

                this.connect(callbackConnect.bind(this))
            } else {
                endChatWithStaff.style.display = 'none';
                chatWithStaff.style.display = 'block';
            }

            console.log('Đang chat với nhân viên:', dom_chat_with_staff);
        });


    }

    toggleChat() {
        this.isChatVisible = !this.isChatVisible;
        const chatContainer = this.shadowRoot.querySelector('#chatContainer');
        const toggleChatBtn = this.shadowRoot.querySelector('#toggleChatBtn');
        toggleChatBtn.style.display = this.isChatVisible ? 'none' : 'flex';
        chatContainer.style.opacity = this.isChatVisible ? '1' : '0';
        chatContainer.style.transform = this.isChatVisible ? 'scale(1)' : 'scale(0.8)';
        chatContainer.style.visibility = this.isChatVisible ? 'visible' : 'hidden';
    }

// Trong class ChatBot
    async sendMessage() {
        const input = this.shadowRoot.querySelector('#messageInput');

        const message = input.value.trim();
        if (this.socket != null) {
            this.socket.emit("send_message", {
                message: message
            })
            input.value = '';
            return
        }
        if (this.isSending) return;

        const sendBtn = this.shadowRoot.querySelector('#sendBtn');
        if (!message) return;

        // Vô hiệu hóa input và button
        this.disableSending(true);

        // Hiển thị tin nhắn người dùng
        this.appendMessage('You', message);
        input.value = '';

        // Hiển thị 3 chấm nhảy
        this.showTypingIndicator();

        try {
            if (!this.access_token) {
                throw new Error('Token not provided');
            }

            let server_url = this.serverUrl
            if (!server_url)
                return alert("server_url not provide")
            const endpoint = `${server_url}/llm/api/v2/ask-bee`;
            const responseRM = fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + this.access_token,
                },
                body: JSON.stringify({
                    question: message,
                    model_type: this?.model_type || "alfinac",
                    user_bfs: this?.user_bfs || null,
                    chat_session_id: this.session_chatbot,
                    history: this.chatHistory,
                    files: ['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PFkHZH8fgiM++t5Bqk9Wyn0Sfw7y5V3vu3b/FLco2t1ehyC4nOp0Z7UtU6e06PQGtcNc6gtPy3N87v+S7nh/emHQoXAZDHpTscvr81SalKIu4DIbDDgZzS4Z/R28ofD82AfiHePfxd8LhZk3JOLGwypJi7fv38Teh/6dzGGEosTrRgRuWDnpJRfxjoKa6imRmupIsnpKfiUAL1CCWfFO+c1xPD7AXxlllsA3jL+C2BOqGXifnMUWvUI9Ru/YB8hL3z6nsWGSsZ6WKD5LS5weP6soUHmRRp/2q0jBaRp7BvW8OSm28Az16XimpPihoggz8cvsLorxlD6jRh2ka5kgXcsE6Yo4KB/gBOmyJoiHc8fz2dM5d8ppg+WdJZg9naOCnsTQDPIZDRUsAk/nzJa6m/LzpfKctqBaSmvLpM/odHMk9horNij1T9P1cepNHLosLmXL4poXz8KqUWt+3U3xSeV1tIIjcbkG6q6xgmJV0NO/HGZ1+aldGA8VKuisWup04OEnTsfpnwykIvBqQMXkM5uQdHcgUpQx99a5S3aHw8GsqSUhl8vdWlK/u5lq/9SQTW0LeD1+qwrHNi0eM9aA9EFeWfnVA2KWxWy20Kd4WUH5MR4NnpDskVnVNV7sQVUoGL+q3Utb8jraAnJLVqC11Bjr12HBMk5a5Hj6dwQ0Hr2B/lEbfgR4PkFWKmIiZCb9aYw09sfXrdi27v8AO7rIKAplbmRzdHJlYW0KZW5kb2JqCjEzIDAgb2JqCjw8IC9Qcm9kdWNlciAobWFjT1MgVmVyc2lvbiAxNS40IFwoQnVpbGQgMjRFMjQ4XCkgUXVhcnR6IFBERkNvbnRleHQpIC9DcmVhdGlvbkRhdGUKKEQ6MjAyNTA3MTAwNDQ4MTNaMDAnMDAnKSAvTW9kRGF0ZSAoRDoyMDI1MDcxMDA0NDgxM1owMCcwMCcpID4+CmVuZG9iagp4cmVmCjAgMTQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwOTA4IDAwMDAwIG4gCjAwMDAwMDM4NTYgMDAwMDAgbiAKMDAwMDAwMDAyMiAwMDAwMCBuIAowMDAwMDAxMDEyIDAwMDAwIG4gCjAwMDAwMDM4MjEgMDAwMDAgbiAKMDAwMDAwMDAwMCAwMDAwMCBuIAowMDAwMDAzOTg4IDAwMDAwIG4gCjAwMDAwMDExMDkgMDAwMDAgbiAKMDAwMDAwMzkzOSAwMDAwMCBuIAowMDAwMDA0ODk3IDAwMDAwIG4gCjAwMDAwMDQzMjYgMDAwMDAgbiAKMDAwMDAwNTEzMyAwMDAwMCBuIAowMDAwMDIxMjYyIDAwMDAwIG4gCnRyYWlsZXIKPDwgL1NpemUgMTQgL1Jvb3QgOSAwIFIgL0luZm8gMTMgMCBSIC9JRCBbIDw0YjdlMWMyYjZmNmZhNDRmMGEwYzcwZGMyM2I4YTgwNz4KPDRiN2UxYzJiNmY2ZmE0NGYwYTBjNzBkYzIzYjhhODA3PiBdID4+CnN0YXJ0eHJlZgoyMTQyNQolJUVPRgo=']
                }),
            });
            this.chatHistory.push({role: 'user', content: message});

            let textQueue = [];
            let typing = false;

            const animateTyping = async (target, text) => {
                textQueue.push(text);
                if (typing) return; // Đã có animate đang chạy

                typing = true;
                while (textQueue.length > 0) {
                    const nextText = textQueue.shift();
                    for (let i = 0; i < nextText.length; i++) {
                        target.textContent += nextText[i];
                        await new Promise(resolve => setTimeout(resolve, 10));
                    }
                }
                typing = false;
            };

            let botMessageDiv = null;
            let process_image =0
            botMessageDiv = this.appendMessage('Bot', '', true); // tạo thẻ rỗng
            responseRM.then(async response => {
                if (response.status === 401) {
                    this.removeTypingIndicator();
                    this.appendMessage('System', 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
                    return;
                }

                if (!response.body) {
                    throw new Error('No response body');
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder('utf-8');
                let buffer = '';

                let isServerResponse = false;
                let image_base64 = "";
                while (true) {
                    const {value, done} = await reader.read();
                    if (done) break;

                    let chunk = decoder.decode(value, {stream: true});
                    if (chunk === "[IMAGE_CHART_PROCESS]") {
                        chunk = ""
                        process_image = 1
                    } else if( process_image >0){
                        console.log(chunk)
                        image_base64 +=chunk
                        chunk = ""
                    }
                    else {
                        buffer += chunk;
                    }
                    if (botMessageDiv) {
                        if (!isServerResponse) {
                            botMessageDiv.innerHTML = "";
                        }
                        isServerResponse = true;
                        if (chunk !== "")
                            await animateTyping(botMessageDiv, chunk);
                    }
                }

                if (!isServerResponse) {
                    this.removeTypingIndicator();
                    this.appendMessage('Bot', 'Không nhận được phản hồi từ server.');
                } else {
                    this.chatHistory.push({role: 'assistant', content: botMessageDiv.innerText});
                    botMessageDiv.innerHTML = `<img style="width: 100%" src='${image_base64}' alt="Red dot" />`;
                    this.disableSending(false)
                }
            })
            await new Promise(resolve => setTimeout(resolve, 3000));
            this.removeTypingIndicator();
            if (botMessageDiv) {
                await animateTyping(botMessageDiv, `Mình đang tra cứu dữ liệu để trả lời câu hỏi *${message}*\n. `);
            }

        } catch (error) {
            console.error('Stream error:', error);
            this.removeTypingIndicator();
            this.appendMessage('Error', 'Không thể gửi tin nhắn: ' + error.message);
            this.disableSending(false)
        }

    }

    disableSending(state) {
        const input = this.shadowRoot.querySelector('#messageInput');
        const sendBtn = this.shadowRoot.querySelector('#sendBtn');
        this.isSending = state;
        input.disabled = state;
        sendBtn.disabled = state;
        input.focus();
    }

    appendMessage(sender, text, isStreaming = false) {
        const messagesDiv = this.shadowRoot.querySelector('#messages');
        const messageElem = document.createElement('div');
        messageElem.className = `message message-${sender.toLowerCase()}`;
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        // bubble.textContent = text;
        bubble.innerHTML = text.replace(/\n/g, "<br>");
        // bubble.innerHTML = bubble.innerHTML.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        messageElem.appendChild(bubble);
        messagesDiv.appendChild(messageElem);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        return isStreaming ? bubble : messageElem;
    }

    updateMessage(bubbleDiv, text) {
        bubbleDiv.textContent += text;
        const messagesDiv = this.shadowRoot.querySelector('#messages');
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    showTypingIndicator() {
        const messagesDiv = this.shadowRoot.querySelector('#messages');

        // Tạo thẻ gốc
        const typingElem = document.createElement('div');
        typingElem.className = 'message message-typing';
        typingElem.id = 'typing-indicator';

        // Tạo bubble chứa nội dung và dot nhảy
        typingElem.innerHTML = `
        <div class="message-bubble">
<!--            Alfinac trả lời-->
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
        </div>
    `;

        messagesDiv.appendChild(typingElem);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    showTypingIndicatorWithText(text) {
        const messagesDiv = this.shadowRoot.querySelector('#messages')
        this.removeTypingIndicator();
        const typingElem = document.createElement('div');
        typingElem.className = 'message message-typing';
        typingElem.id = 'typing-indicator';

        // Bubble chứa nội dung và dot nhảy
        typingElem.innerHTML = `
        <div class="message-bubble" style="white-space:normal !important;">
            ${text ? `<span>${text}</span><br>` : ''}
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
        </div>
    `;

        messagesDiv.appendChild(typingElem);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    showWaitingCountdown(durationSeconds) {
        const messagesDiv = this.shadowRoot.querySelector('#messages');
        this.removeTypingIndicator();

        const typingElem = document.createElement('div');
        typingElem.className = 'message message-typing';
        typingElem.id = 'typing-indicator';

        // Tạo phần tử hiển thị countdown
        let remaining = durationSeconds;
        const countdownSpan = document.createElement('span');
        countdownSpan.textContent = `(${Math.floor(remaining / 60)}:${(remaining % 60).toString().padStart(2, '0')})`;

        // Hiển thị đoạn văn bản ban đầu
        const messageBubble = document.createElement('div');
        messageBubble.className = 'message-bubble';
        messageBubble.style.whiteSpace = "normal";
        messageBubble.innerHTML = `Đang kết nối với nhân viên... <br>`;
        messageBubble.appendChild(countdownSpan);

        typingElem.appendChild(messageBubble);
        messagesDiv.appendChild(typingElem);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;

        // Đếm ngược
        const intervalId = setInterval(() => {
            remaining--;
            countdownSpan.textContent = `(${Math.floor(remaining / 60)}:${(remaining % 60).toString().padStart(2, '0')})`;
        }, 1000);
        // Ghi lại intervalId để xóa nếu cần
        typingElem.setAttribute('data-interval-id', intervalId);
    }


    removeTypingIndicator() {
        const typingElem = this.shadowRoot.querySelector('#typing-indicator');
        if (typingElem) {
            const intervalId = typingElem.getAttribute('data-interval-id');
            if (intervalId) clearInterval(Number(intervalId));
            typingElem.remove();
        }
    }

    showTypingState(callback) {
        this.showTypingIndicatorWithText("", true);
        setTimeout(() => {
            this.removeTypingIndicator()
            callback()
        }, 1000);
    }

    disconnect(is_not_add) {
        const chatWithStaff = this.shadowRoot.querySelector('#chatWithStaff');
        const endChatWithStaff = this.shadowRoot.querySelector('#endChatWithStaff');
        const menuDropdown = this.shadowRoot.querySelector('#menuDropdown');
        menuDropdown.style.display = 'none';
        this.chat_with_staff = false;
        endChatWithStaff.style.display = 'none';
        chatWithStaff.style.display = 'block';
        this.removeTypingIndicator()

        if (!is_not_add) {
            this.appendMessage("Noti", "❌ Đã kết thúc với nhân viên")
        }
        this.disableSending(true)
        setTimeout(() => {
            this.disableSending(false)
        }, 1000);
        console.log('Kết thúc chat với nhân viên.');
        if (this.socket && this.socket.connected) {
            this.socket.disconnect();
            this.socket = null
            console.log("🔌 Socket disconnected");

        } else {
            console.warn("⚠️ No active socket connection to disconnect.");
        }

        this.currentRoom = null;
    }

    connect(callBackConnect, token) {
        const auth = {};
        if (token) {
            auth.token = token;
        }

        this.socket = io(this.socket_url, {
            path: this.socket_path,
            auth: auth,
            transports: ['websocket'],
            cors: {
                origin: "*", // hoặc whitelist domain
                methods: ["GET", "POST"]
            }
        });

        let socket = this.socket
        let dom_session_client_id
        socket.on("connect", () => {
            console.log(`✅ Connected with id ${socket.id}`);
            dom_session_client_id = socket.id;
            callBackConnect()
        });

        socket.on("receive_message", (data) => {
            console.log(`📩 Message from ${data.from}: ${data.message}`);
        });

        socket.on("error", (data) => {
            console.log(`❌ Error: ${data.message}`);
        });
        socket.on("connect_error", (err) => {
            console.log(`❌ Connect error: ${err.message}`);
        });
        let dom_currentRoom = this.currentRoom
        socket.on("chat_accepted", (data) => {
            dom_currentRoom = data.room;
            this.disableSending(false)
            console.log(`Chat accepted. Joined room: ${dom_currentRoom}`);
            this.removeTypingIndicator();
            this.appendMessage('Noti', `Nhân viên đã kết nối với bạn ở phòng: ${dom_currentRoom || ""}`);
        });
        socket.on("new_message", (data) => {
            console.log("New message:", data);
            console.log(`New message: ${data?.message || ""}`);

            let from = data.from
            if (from == dom_session_client_id) {
                this.appendMessage('You', `${data.message || ""}`);
            } else {
                function callback() {
                    this.appendMessage('Bot', `${data.message || ""}`);
                }

                this.showTypingState(callback.bind(this))
            }
        });
        socket.on("admin_disconnected", (data) => {
            log(`Admin disconnected from room ${data.room}.`);
            if (currentRoom === data.room) {
                dom_currentRoom = null;
                dom_session_client_id = null
            }
        });
        socket.on("user_disconnected", (data) => {
            log(`User disconnected from room ${data.room}.`);
        });
        socket.on("timeout_waiting", (data) => {
            this.disconnect(true)
            this.appendMessage('Noti', data.message || "⏰ Không có nhân viên đang trực tuyến.");
            console.log(data.message)
        });
    }

    autoScroll() {
        setTimeout(() => {
            const messagesDiv = this.shadowRoot.querySelector('#messages');
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }, 0);
    }

}

customElements.define('chat-bot', ChatBot);
