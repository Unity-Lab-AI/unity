/**
 * claude-proxy.js — Combined static server + Claude Code CLI proxy
 *
 * ONE port, ONE window:
 *   - Serves Unity's static files (HTML/JS/CSS)
 *   - Proxies /v1/chat/completions to `claude -p` (your logged-in x20 account)
 *   - /v1/models returns available Claude models
 *   - /health for auto-detect
 *
 * Usage: node claude-proxy.js
 * Then open http://localhost:8088
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const PORT = 8088;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // --- API routes ---

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, provider: 'claude-code-cli', model: 'claude-opus-4-6' }));
    return;
  }

  if (req.method === 'GET' && req.url === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      data: [
        { id: 'claude-opus-4-6', name: 'Claude Opus 4.6 (CLI)' },
        { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6 (CLI)' },
      ]
    }));
    return;
  }

  if (req.method === 'POST' && req.url === '/v1/chat/completions') {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 500000) req.destroy(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const messages = data.messages || [];
        let systemPrompt = '', userPrompt = '';
        for (const msg of messages) {
          if (msg.role === 'system') systemPrompt = msg.content;
          if (msg.role === 'user') userPrompt = msg.content;
        }
        const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt;
        if (!fullPrompt.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'empty prompt' }));
          return;
        }

        console.log(`[claude] Calling CLI (${fullPrompt.length} chars)...`);
        execFile('claude', ['-p', fullPrompt, '--output-format', 'text'], {
          timeout: 60000, maxBuffer: 1024 * 1024,
        }, (err, stdout) => {
          if (err) {
            console.error(`[claude] Error: ${err.message}`);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
          const response = stdout.trim();
          console.log(`[claude] Response: ${response.slice(0, 80)}...`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            id: 'cli-' + Date.now(),
            object: 'chat.completion',
            model: data.model || 'claude-opus-4-6',
            choices: [{ index: 0, message: { role: 'assistant', content: response }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          }));
        });
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // --- Static file server ---

  let filePath = path.join(ROOT, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`[unity] http://localhost:${PORT}`);
  console.log(`[unity] Static files + Claude Code CLI proxy (x20 account)`);
  console.log(`[unity] Select "Local AI" in Unity to auto-detect Claude`);
});
