import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import generateAccessToken from '@salesforce/apex/MIAWChatController.generateAccessToken';
import createConversation from '@salesforce/apex/MIAWChatController.createConversation';
import sendMessage from '@salesforce/apex/MIAWChatController.sendMessage';
import endConversation from '@salesforce/apex/MIAWChatController.endConversation';
import getChatSessionData from '@salesforce/apex/MIAWChatController.getChatSessionData';
import getSessionInfo from '@salesforce/apex/MIAWChatController.getSessionInfo';
import pollMessages from '@salesforce/apex/MIAWChatController.pollMessages';

export default class MiawChat extends LightningElement {
    @track isMinimized = true;
    @track isLoading = false;
    @track messages = [];
    @track currentMessage = '';
    @track chatStatus = 'disconnected'; // disconnected, connecting, connected, ended
    @track showTypingIndicator = false;
    @track sessionDebugInfo = '';

    userInfo = {
        firstName: 'Guest',
        lastName: 'User',
        email: 'guest@example.com'
    };

    sessionId = null;
    conversationId = null;
    pollingInterval = null;
    messageCounter = 0;

    connectedCallback() {
        this.initializeChat();
    }

    disconnectedCallback() {
        this.stopPollingMessages();
    }

    initializeChat() {
        this.clearMessages();
        this.addSystemMessage('Welcome! Click "Start Conversation" to begin chatting.');
        this.updateSessionDebugInfo();
    }

    toggleChat() {
        this.isMinimized = !this.isMinimized;
    }

    async updateSessionDebugInfo() {
        try {
            const sessionInfo = await getSessionInfo();
            this.sessionDebugInfo = `Active Sessions: ${sessionInfo.activeSessionCount}`;
        } catch (error) {
            console.error('Session info error:', error);
        }
    }

    get isDisconnected() {
        return this.chatStatus === 'disconnected';
    }

    get isConnecting() {
        return this.chatStatus === 'connecting';
    }

    get isConnected() {
        return this.chatStatus === 'connected';
    }

    get isEnded() {
        return this.chatStatus === 'ended';
    }

    get sendButtonDisabled() {
        return !this.isConnected || this.isLoading || !this.currentMessage.trim();
    }

    get chatHeaderTitle() {
        switch (this.chatStatus) {
            case 'connecting': return 'Connecting...';
            case 'connected': return 'Support Chat';
            case 'ended': return 'Chat Ended';
            default: return 'Support Chat';
        }
    }

    get hasMessages() {
        return this.messages.length > 0;
    }

    get showDebugInfo() {
        return this.sessionDebugInfo && this.sessionDebugInfo.length > 0;
    }

    handleMessageInput(event) {
        this.currentMessage = event.target.value;
    }

    handleKeyPress(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendUserMessage();
        }
    }

    async startConversation() {
        this.isLoading = true;
        this.chatStatus = 'connecting';
        this.clearMessages();

        try {
            const tokenResult = await generateAccessToken(this.userInfo);
            if (!tokenResult.success) throw new Error(tokenResult.message);

            this.sessionId = tokenResult.data.sessionId;

            const convResult = await createConversation({ sessionId: this.sessionId });
            if (!convResult.success) throw new Error(convResult.message);

            this.conversationId = convResult.data.conversationId;
            this.chatStatus = 'connected';

            this.startPollingMessages();
            this.addSystemMessage('You are now connected to support.');
        } catch (err) {
            this.showError('Start failed: ' + err.message);
            this.chatStatus = 'disconnected';
            this.addSystemMessage('Connection failed. Please try again.');
        } finally {
            this.isLoading = false;
            this.updateSessionDebugInfo();
        }
    }

    async sendUserMessage() {
        if (!this.currentMessage.trim() || !this.sessionId) return;

        const messageText = this.currentMessage.trim();
        this.currentMessage = '';
        this.addUserMessage(messageText);
        this.showTypingIndicator = true;

        try {
            const result = await sendMessage({ sessionId: this.sessionId, messageText });
            if (!result.success) throw new Error(result.message);
        } catch (err) {
            this.addSystemMessage('Message failed to send.');
            this.showError(err.message);
        } finally {
            this.showTypingIndicator = false;
        }
    }

    async endChat() {
        this.isLoading = true;

        try {
            await endConversation({ sessionId: this.sessionId });
            this.addSystemMessage('Conversation ended.');
        } catch (err) {
            this.showError('Failed to end: ' + err.message);
        } finally {
            this.stopPollingMessages();
            this.chatStatus = 'ended';
            this.clearSessionData();
            this.isLoading = false;
        }
    }

    async checkSessionStatus() {
        if (this.sessionId) {
            try {
                const data = await getChatSessionData({ sessionId: this.sessionId });
                if (data) {
                    this.addSystemMessage(`Session ID: ${data.sessionId}`);
                } else {
                    this.chatStatus = 'disconnected';
                    this.addSystemMessage('Session not found.');
                }
            } catch (err) {
                this.showError('Session check failed: ' + err.message);
            }
        }
    }

    startPollingMessages() {
        if (this.pollingInterval) clearInterval(this.pollingInterval);

        this.pollingInterval = setInterval(async () => {
            if (this.sessionId && this.isConnected) {
                try {
                    const messages = await pollMessages({ sessionId: this.sessionId });
                    messages.forEach(m => this.addAgentMessage(m));
                } catch (error) {
                    console.error('Polling error:', error);
                }
            }
        }, 5000);
    }

    stopPollingMessages() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    addUserMessage(text) {
        this.messages.push({
            id: this.generateId(),
            text,
            timestamp: new Date().toLocaleTimeString(),
            cssClass: 'message-row user'
        });
        this.scrollToBottom();
    }

    addAgentMessage(text) {
        this.messages.push({
            id: this.generateId(),
            text,
            timestamp: new Date().toLocaleTimeString(),
            cssClass: 'message-row agent'
        });
        this.scrollToBottom();
    }

    addSystemMessage(text) {
        this.messages.push({
            id: this.generateId(),
            text,
            timestamp: new Date().toLocaleTimeString(),
            cssClass: 'message-row system'
        });
        this.scrollToBottom();
    }

    clearMessages() {
        this.messages = [];
    }

    clearSessionData() {
        this.sessionId = null;
        this.conversationId = null;
    }

    scrollToBottom() {
        setTimeout(() => {
            const chatBody = this.template.querySelector('.chat-body');
            if (chatBody) chatBody.scrollTop = chatBody.scrollHeight;
        }, 100);
    }

    generateId() {
        return `msg_${Date.now()}_${++this.messageCounter}`;
    }

    showError(msg) {
        this.dispatchEvent(new ShowToastEvent({
            title: 'Error',
            message: msg,
            variant: 'error',
            mode: 'sticky'
        }));
    }

    showSuccess(msg) {
        this.dispatchEvent(new ShowToastEvent({
            title: 'Success',
            message: msg,
            variant: 'success'
        }));
    }
}
