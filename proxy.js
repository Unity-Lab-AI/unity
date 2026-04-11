/**
 * proxy.js — Lightweight CORS proxy for Anthropic API
 *
 * Anthropic blocks direct browser requests (no CORS headers).
 * This proxy runs on localhost:3001 and forwards requests to
 * api.anthropic.com with proper headers, letting Unity use
 * your own Anthropic API key directly.
 *
 * Usage: node proxy.js
 * Then select "Claude (Direct)" in Unity's model dropdown.
 */

const http = require('http');
const https = require('https');

const PORT = 3001;
const ANTHROPIC_HOST = 'api.anthropic.com';

const server = http.createServer((req, res) => {
  // CORS headers for browser access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Forward to Anthropic
  let body = [];
  req.on('data', chunk => body.push(chunk));
  req.on('end', () => {
    body = Buffer.concat(body);

    // Map the path — browser sends to localhost:3001/v1/chat/completions
    // but Anthropic uses /v1/messages
    let path = req.url;
    if (path.includes('/chat/completions')) {
      path = '/v1/messages';

      // Transform OpenAI-format request to Anthropic format
      try {
        const openaiBody = JSON.parse(body.toString());
        const messages = openaiBody.messages || [];
        const systemMsg = messages.find(m => m.role === 'system');
        const chatMsgs = messages.filter(m => m.role !== 'system');

        const anthropicBody = {
          model: openaiBody.model || 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          messages: chatMsgs.map(m => ({ role: m.role, content: m.content })),
        };
        if (systemMsg) {
          anthropicBody.system = systemMsg.content;
        }
        if (openaiBody.temperature !== undefined) {
          anthropicBody.temperature = openaiBody.temperature;
        }
        body = Buffer.from(JSON.stringify(anthropicBody));
      } catch (e) {
        // If transform fails, send as-is
      }
    }

    // Extract API key from Authorization header or x-api-key
    const authHeader = req.headers['authorization'] || '';
    const apiKey = req.headers['x-api-key'] || authHeader.replace('Bearer ', '');

    const options = {
      hostname: ANTHROPIC_HOST,
      port: 443,
      path: path,
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
        'Content-Length': body.length,
      },
    };

    const proxyReq = https.request(options, (proxyRes) => {
      // Transform Anthropic response to OpenAI format
      let responseBody = [];
      proxyRes.on('data', chunk => responseBody.push(chunk));
      proxyRes.on('end', () => {
        const rawResponse = Buffer.concat(responseBody).toString();
        res.setHeader('Content-Type', 'application/json');

        if (path === '/v1/messages' && proxyRes.statusCode === 200) {
          try {
            const anthResp = JSON.parse(rawResponse);
            // Convert Anthropic format to OpenAI format so the router can parse it
            const openaiResp = {
              choices: [{
                message: {
                  role: 'assistant',
                  content: anthResp.content?.[0]?.text || '',
                },
                finish_reason: anthResp.stop_reason || 'stop',
              }],
              model: anthResp.model,
              usage: anthResp.usage,
            };
            res.writeHead(200);
            res.end(JSON.stringify(openaiResp));
            return;
          } catch (e) {
            // Fall through to raw response
          }
        }

        res.writeHead(proxyRes.statusCode);
        res.end(rawResponse);
      });
    });

    proxyReq.on('error', (err) => {
      console.error('[Proxy] Error:', err.message);
      res.writeHead(502);
      res.end(JSON.stringify({ error: err.message }));
    });

    proxyReq.write(body);
    proxyReq.end();
  });
});

server.listen(PORT, () => {
  console.log(`\n  🧠 Unity Anthropic Proxy running on http://localhost:${PORT}`);
  console.log(`  Forwarding to ${ANTHROPIC_HOST}`);
  console.log(`  Select "Claude (Direct)" in Unity's model dropdown\n`);
});
