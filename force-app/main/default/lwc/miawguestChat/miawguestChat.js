import { LightningElement, track } from 'lwc';
import generateAccessToken from '@salesforce/apex/GuestChatController.generateAccessToken';
import createConversation from '@salesforce/apex/GuestChatController.createConversation';
import sendMessageToServer from '@salesforce/apex/GuestChatController.sendMessageToServer';
import endConversation from '@salesforce/apex/GuestChatController.endConversation';

export default class MiawguestChat extends LightningElement {
    @track messages = [];
    @track inputText = '';
    @track isThinking = false;

    accessToken;
    conversationId;
    eventSource;
    @track showPrompts = true;
    @track suggestedPrompts = [
        'Check product availability',
        'Track my order',
        'Get shipment details',
        'Talk to support'
    ];

    connectedCallback() {
        this.startChat();
    }

    async startChat() {
        try {
            this.accessToken = await generateAccessToken();

            this.conversationId = await createConversation({
                accessToken: this.accessToken,
                email: 'guest@example.com',
                firstName: 'Guest',
                lastName: 'User'
            });

            this.subscribeToSSE();
        } catch (err) {
            console.error('Start chat failed:', err);
        }
    }

    subscribeToSSE() {
    const token = encodeURIComponent(this.accessToken);
    const orgId = '00DKd00000BfI1X'; // Your Org ID
    const sseUrl = `https://newmiawapi-5729deab8e80.herokuapp.com/sse-proxy?accessToken=${token}&orgId=${orgId}`;

    this.eventSource = new EventSource(sseUrl);

    this.eventSource.onmessage = (event) => {
        try {
            const parsed = JSON.parse(event.data);

            // ✅ Filter conditions
            const conversationIdMatch = parsed?.conversationId === this.conversationId;
            const entry = parsed?.conversationEntry;
            const isMessage = entry?.entryType === 'Message';
            const isChatbot = entry?.sender?.role === 'Chatbot';

            if (conversationIdMatch && isMessage && isChatbot) {
                const payloadString = entry?.entryPayload;
                const payload = JSON.parse(payloadString);
                const text = payload?.abstractMessage?.staticContent?.text;

                if (text) {
    const isHtml = text.includes('<') && text.includes('</');

    const messageId = 'msg-' + Date.now();
    this.messages = [
        ...this.messages,
        {
            id: messageId,
            text,
            isUser: false,
            cssClass: 'agent-msg',
            isHtml
        }
    ];

    this.scrollToBottom();

    if (isHtml) {
        // Wait for DOM to render, then inject HTML
        setTimeout(() => {
            const container = this.template.querySelector(`[data-id="${messageId}"]`);
            if (container) {
                container.innerHTML = text;
            }
        }, 0);
    }
}
            }
        } catch (error) {
            console.error('❌ SSE message processing error:', error);
        }
    };

    this.eventSource.onerror = (error) => {
        console.error('❌ SSE connection error:', error);
    };
}

    handleInput(event) {
        this.inputText = event.target.value;
    }

    checkEnter(event) {
        if (event.key === 'Enter') {
            this.sendMessage();
        }
    }

    async sendMessage() {
        const text = this.inputText.trim();
        if (!text) return;

        const userMsg = {
            id: Date.now(),
            text,
            isUser: true,
            cssClass: 'user-msg'
        };
        this.messages = [...this.messages, userMsg];
        this.inputText = '';
        this.isThinking = true;
        this.scrollToBottom();

        try {
            await sendMessageToServer({
                accessToken: this.accessToken,
                conversationId: this.conversationId,
                messageText: text
            });
        } catch (err) {
            console.error('Send failed:', err);
        } finally {
            this.isThinking = false;
        }
    }

    async endChat() {
        try {
            await endConversation({
                accessToken: this.accessToken,
                conversationId: this.conversationId
            });

            if (this.eventSource) {
                this.eventSource.close();
            }

            this.accessToken = null;
            this.conversationId = null;
            this.messages = [];
        } catch (err) {
            console.error('End chat error:', err);
        }
    }

    scrollToBottom() {
        setTimeout(() => {
            const body = this.template.querySelector('.chat-body');
            if (body) {
                body.scrollTop = body.scrollHeight;
            }
        }, 50);
    }
    get promptToggleText() {
    return this.showPrompts ? 'Hide Suggestions' : 'View Default Prompts';
}

togglePrompts() {
    this.showPrompts = !this.showPrompts;
}

handlePromptClick(event) {
    const prompt = event.target.textContent;
    this.inputText = prompt;
    // Optional: Auto-send
    // this.sendMessage();
}
}
