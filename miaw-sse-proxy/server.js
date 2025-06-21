const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all domains (for demo)
app.use(cors());

app.get('/sse-proxy', (req, res) => {
    const bearerToken = 'PASTE_YOUR_BEARER_TOKEN_HERE';
    const orgId = '00DKd00000BfI1X';

    const options = {
        hostname: 'bikramkuma-250205-795-demo.my.salesforce-scrt.com',
        path: '/eventrouter/v1/sse',
        headers: {
            'Authorization': `Bearer ${bearerToken}`,
            'X-Org-Id': orgId,
            'Accept': '*/*'
        }
    };

    https.get(options, (sseRes) => {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });

        sseRes.on('data', (chunk) => {
            res.write(chunk);
        });

        sseRes.on('end', () => {
            res.end();
        });

        sseRes.on('error', (err) => {
            console.error('SSE stream error:', err);
            res.end();
        });
    }).on('error', (err) => {
        console.error('Proxy error:', err);
        res.status(500).send('Proxy server error');
    });
});

app.listen(PORT, () => {
    console.log(`Proxy running at http://localhost:${PORT}/sse-proxy`);
});
