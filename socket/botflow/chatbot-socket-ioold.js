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
        this.visitor_id = null;
        // Thêm script socket.io sau khi render xong

        setTimeout(async () => {
            await this.addScript("https://static.alfinac.com:5002/chatbot/socket.io.min.js")
            await this.addScript("https://cdn.jsdelivr.net/npm/@fingerprintjs/fingerprintjs@3/dist/fp.min.js")
            const fp = await FingerprintJS.load()
            const result = await fp.get()
            const visitor_id = btoa(result.visitorId + "_" + this.getDataStr());
            console.log("visitorId:", visitor_id)
            sessionStorage.setItem("visitor_id", visitor_id);
            this.visitor_id = visitor_id
            this.render();
        }, 1)
    }

    getDataStr() {
        const now = new Date()
        const yyyy = now.getFullYear()
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const dd = String(now.getDate()).padStart(2, '0')
        return `${yyyy}_${mm}_${dd}`
    }

    setStore(key, data, hours = 6) {
        const now = Date.now();
        const expiresAt = now + hours * 60 * 60 * 1000;

        localStorage.setItem(key, JSON.stringify([
            data,
            expiresAt
        ]));
    }

    getStore(key) {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        try {
            const data = JSON.parse(raw);
            if (Date.now() > data[1]) {
                localStorage.removeItem(key);
                return null;
            }
            return data[0];
        } catch (e) {
            console.warn("Invalid visitor_info format");
            return null;
        }
    }

    addScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.type = 'text/javascript';
            script.onload = () => {
                console.info(`Loading script ${url} successfully!`)
                resolve()
            };
            script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
            document.head.appendChild(script);
        });
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
                    this.showWaitingCountdown(300);
                }

                this.connect(callbackConnect.bind(this), this.visitor_id)
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
                    history: this.chatHistory
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
                while (true) {
                    const {value, done} = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, {stream: true});
                    buffer += chunk;


                    if (botMessageDiv) {
                        if (!isServerResponse) {
                            botMessageDiv.innerHTML = "";
                        }
                        isServerResponse = true;
                        await animateTyping(botMessageDiv, chunk);
                    }
                }

                if (!isServerResponse) {
                    this.removeTypingIndicator();
                    this.appendMessage('Bot', 'Không nhận được phản hồi từ server.');
                } else {
                    this.chatHistory.push({role: 'assistant', content: botMessageDiv.innerText});
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

    appendMessage(sender, text, isStreaming = false, timestamp = null) {
        const messagesDiv = this.shadowRoot.querySelector('#messages');
        const messageElem = document.createElement('div');
        messageElem.className = `message message-${sender.toLowerCase()}`;

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.innerHTML = text.replace(/\n/g, "<br>");
        messageElem.appendChild(bubble);

        // Thêm phần hiển thị thời gian
        const timeElem = document.createElement('div');
        timeElem.style.fontSize = '11px';
        timeElem.style.color = '#999';
        timeElem.style.marginTop = '4px';
        timeElem.style.textAlign = sender.toLowerCase() === 'you' ? 'right' : 'left';

        const now = timestamp ? new Date(timestamp) : new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        timeElem.textContent = `${hh}:${mm}`;

        messageElem.appendChild(timeElem);

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
            this.socket.emit("client_leave", {
                reason: "user_closed_tab",
                sid: this.socket.id
            }, (response) => {
                console.log("✅ Server responded:", response);
                // Sau khi server phản hồi, mới disconnect
                this.socket.disconnect();
                this.socket = null
                console.log("🔌 Socket disconnected");
            });


        } else {
            console.warn("⚠️ No active socket connection to disconnect.");
        }

        this.currentRoom = null;
    }

    connect(callBackConnect, visitor_id) {
        callBackConnect()
        const auth = {};
        if (visitor_id) {
            auth.anonymous_token = visitor_id;
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
            if (data?.type == 'reconnect') {
                this.appendMessage('Noti', data.message);
            } else {
                this.appendMessage('Noti', `Nhân viên đã kết nối với bạn ở phòng: ${dom_currentRoom || ""}`);
            }
            if (this.socket != null) {
                console.log("start get get_conversation")
                this.socket.emit("get_conversation", {})
            }

        });
        socket.on("client_conversation", (data) => {
            console.log("client_conversation")
            let message = this.shadowRoot.querySelector('#messages');  // hoặc #messages nếu cần
            message.innerHTML = ""
            let his = data?.history_list || []
            for (let i = 0; i < his.length; i++) {
                let item = JSON.parse(his[i])
                console.log(item)
                if (item?.role == 'client') {
                    this.appendMessage('You', `${item.message || ""}`, false, item.timestamp);
                } else {
                    this.appendMessage('Bot', `${item.message || ""}`, false, item.timestamp);
                }
            }

        })
        socket.on("new_message", (data) => {
            console.log("New message:", data);
            console.log(`New message: ${data?.message || ""}`);

            let from = data.from
            if (data.sender_role == 'client' && this.visitor_id == data.anonymous_token) {
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

customElements.define('chat-bot-client', ChatBot);
