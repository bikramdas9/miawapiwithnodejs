import { LightningElement } from 'lwc';

export default class EmbeddedMessaging extends LightningElement {
    connectedCallback() {
        console.log('Embedded Messaging component connected');
        this.loadEmbeddedMessaging();
    }

    loadEmbeddedMessaging() {
        // Prevent duplicate load
        if (window.embeddedservice_bootstrap) {
            this.initEmbeddedMessaging();
            return;
        }

        // Load the bootstrap script dynamically
        const script = document.createElement('script');
        script.src = 'https://bikramkuma-250205-795-demo.my.site.com/ESWRoutetoAIAgent1747899639098/assets/js/bootstrap.min.js';
        script.onload = () => {
            this.initEmbeddedMessaging();
        };
        script.onerror = (e) => {
            console.error('Failed to load Embedded Messaging script:', e);
        };
        document.body.appendChild(script);
    }

    initEmbeddedMessaging() {
        try {
            window.embeddedservice_bootstrap.settings.language = 'en_US';

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
}
