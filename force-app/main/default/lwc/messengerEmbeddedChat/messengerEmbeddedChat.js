import { LightningElement, track } from 'lwc';

export default class MessengerEmbeddedChat extends LightningElement {
    @track showChatBubble = true;
    @track showChatWindow = false;
    selectedPrompt = '';

    connectedCallback() {
        if (window.location.hostname.includes('.site.com')) {
            this.loadEmbeddedMessagingScript();
        }
    }

    loadEmbeddedMessagingScript() {
        if (window.embeddedservice_bootstrap) return;

        const script = document.createElement('script');
        script.src = 'https://bikramkuma-250205-795-demo.my.site.com/ESWRoutetoAIAgent1747899639098/assets/js/bootstrap.min.js';
        script.onload = () => this.initEmbeddedMessaging();
        document.body.appendChild(script);
    }

    initEmbeddedMessaging() {
        try {
            window.embeddedservice_bootstrap.settings.language = 'en_US';
            window.embeddedservice_bootstrap.settings.displayHelpButton = false;
            window.embeddedservice_bootstrap.init(
                '00DKd00000BfI1X',
                'Route_to_AI_Agent',
                'https://bikramkuma-250205-795-demo.my.site.com/ESWRoutetoAIAgent1747899639098',
                {
                    scrt2URL: 'https://bikramkuma-250205-795-demo.my.salesforce-scrt.com'
                }
            );
        } catch (err) {
            console.error('Error initializing Embedded Messaging:', err);
        }
    }

    expandChatWindow() {
        this.showChatBubble = false;
        this.showChatWindow = true;
    }

    collapseChatWindow() {
        this.showChatBubble = true;
        this.showChatWindow = false;
    }

    launchChat() {
        if (window.embeddedservice_bootstrap?.prechatAPI?.startChat) {
            window.embeddedservice_bootstrap.prechatAPI.startChat();
        } else {
            console.warn('Chat not ready');
        }
    }

    handlePromptClick(event) {
        this.selectedPrompt = event.target.dataset.prompt;
        this.launchChat();
        // Optionally: Send prompt into chat if chat API supports it
        console.log('Selected prompt:', this.selectedPrompt);
    }
}
