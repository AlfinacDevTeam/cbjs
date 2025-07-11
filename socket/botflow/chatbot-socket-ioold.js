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
             
                .file-input {
                    display: none;
                }
    
                .file-button {
                    background: none !important;
                    color: white !important;
                    border-radius: 50%;
                    cursor: pointer;
                }
                .file-button:hover {
                    background: rgba(0,0,0,0.11) !important;
                }
                .file-name-display {
                    bottom: 100%; /* nằm trên nút */
                    background: #fff;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 11px;
                    color: #333;
                    white-space: nowrap;
                    max-width: 120px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    text-align: center;
                    margin-bottom: 4px;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.1);
                }
                .file-remove-button {
                    bottom: 100%; /* nằm trên nút */
                    background: #fff;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 11px;
                    color: #333;
                    white-space: nowrap;
                    max-width: 120px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    text-align: center;
                    margin-bottom: 4px;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.1);
                }
                .file-input-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                    margin-right: 8px;
                }
                
                .file-name-container {
                    position: absolute;
                    bottom: 100%;
                    display: flex;
                    align-items: center;
                    background: #fff;
                    padding: 2px 6px;
                    border-radius: 4px;
                    margin-bottom: 4px;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.1);
                    max-width: 150px;
                    overflow: hidden;
                }
                .file-remove-button:hover {
                    color: red;
                }
            </style>

            <button class="action-button" style="z-index: 9999999999" id="toggleChatBtn">💬</button>
            <div class="chat-container" style="z-index: 9999999999;overflow: auto" id="chatContainer">
               <div class="chat-header">
                    Alfinac AI Assistant
                    <div class="menu-wrapper">
                        <button class="menu-button" id="menuBtn">⋮</button>
                        <div class="menu-dropdown" id="menuDropdown">
                            <div class="menu-item" id="chatWithAI">💬 Chat với AI</div>
                            <div class="menu-item" id="chatWithStaff">💬 Chat với nhân viên</div>
                            <div class="menu-item" id="endChatWithStaff" style="display: none">❌ Kết thúc với nhân viên</div>
                            <div class="menu-item" id="flowbot">Quy trình</div>
                        </div>
                    </div>
                    <button class="close-button" style="color: #ff0063" id="closeBtn">✕</button>
                </div>
                <div id="chatflow_container" style="display: none">
                    
                </div>
                <div class="chat-messages" id="messages">
                    <div class="message message-bot">
                        <div class="message-bubble">Chào bạn, mình là Alfinac AI Assistant bạn cần tôi giúp gì?</div>
                    </div>
                    <div id="botflow_container" class="message message-bot">
                                    
                    </div>
                </div>
                <div class="chat-input" id="chat_input_container">
                    <input id="messageInput" maxlength="200" placeholder="Nhập tin nhắn (200 từ)..."/>
                    <div class="file-input-wrapper" >
                        <div class="file-name-container" id="file-container" style="display: none">
                            <span class="file-remove-button" id="removeFileBtn" title="Xoá file">✕</span>
                                <span class="file-name-display" id="fileNameDisplay"></span>
                        </div>
<!--                        <input type="file" id="fileInput" class="file-input" multiple>-->
                        <input type="file" id="fileInput" class="file-input" >
                        <span class="file-button" id="fileBtn">📎</span>
                    </div>
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

        // Thêm sự kiện cho nút chọn file
        const fileInput = this.shadowRoot.querySelector('#fileInput');
        const fileBtn = this.shadowRoot.querySelector('#fileBtn');
        const removeFileBtn = this.shadowRoot.querySelector('#removeFileBtn');
        const chat_input_container = this.shadowRoot.querySelector('#chat_input_container');
        const messages = this.shadowRoot.querySelector('#messages');
        const chatflow_container = this.shadowRoot.querySelector('#chatflow_container');
        const fileContainer =this.shadowRoot.querySelector('#file-container')
        fileBtn.addEventListener('click', () => {
            fileInput.click(); // Mở hộp thoại chọn file khi nhấn nút
        });
        removeFileBtn.addEventListener('click', () => {
            fileContainer.style.display = 'none';
            fileInput.value = "";
        });
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        // Xử lý mở/tắt dropdown
        const menuBtn = this.shadowRoot.querySelector('#menuBtn');
        const menuDropdown = this.shadowRoot.querySelector('#menuDropdown');
        const chatWithAI = this.shadowRoot.querySelector('#chatWithAI');
        menuBtn.addEventListener('click', () => {
            menuDropdown.style.display = menuDropdown.style.display === 'block' ? 'none' : 'block';
        });
        const chatWithStaff = this.shadowRoot.querySelector('#chatWithStaff');
        const endChatWithStaff = this.shadowRoot.querySelector('#endChatWithStaff');
        const flowbot = this.shadowRoot.querySelector('#flowbot');
        let dom_chat_with_staff = this.chat_with_staff;



        flowbot.addEventListener('click', () => {
            this.disconnect()
            messages.style.display = 'none';
            chat_input_container.style.display = 'none';
            chatflow_container.style.display = '';
            chatWithAI.style.display = '';
            chatflow_container.innerHTML = `<iframe  src="http://botflow.alfinac.com:8081/main-flow-bee-vnrhn2s" style="border: none; width: 100%; height: 100vh"></iframe>`

        });
        endChatWithStaff.addEventListener('click', () => {
            chatflow_container.style.display = 'none';
            messages.style.display = '';
            chat_input_container.style.display = '';
            this.disconnect()
        });

        chatWithAI.addEventListener('click', () => {
            chatflow_container.style.display = 'none';
            messages.style.display = '';
            chat_input_container.style.display = '';
            this.disconnect()
        });


        chatWithStaff.addEventListener('click', () => {
            menuDropdown.style.display = 'none';
            messages.style.display = '';
            chat_input_container.style.display = '';
            chatflow_container.style.display = 'none';

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
    handleFileSelect(event) {
        const files = event.target.files;
        const fileNameDisplay = this.shadowRoot.querySelector('#fileNameDisplay');
        if (files.length > 0) {
            const invalidFiles = Array.from(files).filter(file => !file.name.toLowerCase().endsWith('.pdf'));

            if (invalidFiles.length > 0) {
                alert("❌ Chỉ cho phép tải lên file định dạng PDF.");
                // Reset lại input
                event.target.value = '';
                fileNameDisplay.textContent = '';
                fileContainer.style.display = 'none';
                return;
            }
            const fileList = Array.from(files).map(file => file.name).join(', ');
            fileNameDisplay.textContent = fileList
            this.shadowRoot.querySelector('#file-container').style.display = '';
            // Logic xử lý file (ví dụ: gửi file lên server)
            Array.from(files).forEach(file => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const fileContent = e.target.result;
                    console.log(`File ${file.name} loaded, size: ${file.size} bytes`);
                };
                reader.readAsDataURL(file);
            });
        } else {
            this.shadowRoot.querySelector('#file-container').style.display = 'none';
            fileNameDisplay.textContent = ''; // Xóa tên file nếu không có file được chọn
        }
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
            const listFile = await this.getListBase64File()
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
                    files:listFile
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
            let final_text = `Mình đang tra cứu dữ liệu để trả lời câu hỏi *${message}*. `
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
                let process_img_text = "";
                while (true) {
                    const {value, done} = await reader.read();
                    if (done) break;

                    let chunk = decoder.decode(value, {stream: true});
                    if (chunk === "[IMAGE_CHART_PROCESS]") {
                        chunk = ""
                        process_image = 1
                    } else if( process_image >0){
                        console.log(chunk)
                        if ((chunk||"").startsWith("[TEXT]")) {
                            process_img_text  = chunk.replace("[TEXT]", "").replace("[IMG]", "");
                        }else{
                            image_base64 +=chunk.replace("[IMG]", "");
                        }
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
                    if (process_image > 0) {
                        botMessageDiv.remove()
                        let botMessageDiv2 = this.appendMessage('Bot', '', true); // tạo thẻ rỗng

                        await animateTyping(botMessageDiv2, process_img_text.replace(final_text,""));
                        if (!!image_base64){

                            let imgDiv = this.appendMessage('Bot', '');
                            imgDiv.innerHTML = `<img style="width: 100%" src='${image_base64}' alt="Red dot" />`;
                        }
                        this.chatHistory.push({role: 'assistant', content: botMessageDiv2.innerText});

                    }else{
                        this.chatHistory.push({role: 'assistant', content: botMessageDiv.innerText});
                    }

                    this.disableSending(false)
                }
            })
            await new Promise(resolve => setTimeout(resolve, 3000));
            this.removeTypingIndicator();
            if (botMessageDiv) {
                await animateTyping(botMessageDiv, final_text);
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
    getListBase64File() {
        const fileInput = this.shadowRoot.querySelector("#fileInput");
        const files = fileInput.files;

        if (!files || files.length === 0) return Promise.resolve([]);

        function toBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = (error) => reject(error);
            });
        }

        const promises = Array.from(files).map(file => toBase64(file));
        return Promise.all(promises);
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
            if (this.socket) {
                this.appendMessage("Noti", "❌ Đã kết thúc với nhân viên")
            }
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
