#!/usr/bin/env python3
"""
Unity Brain Bridge — Connects the browser to Claude (Anthropic API).

Exposes an OpenAI-compatible /v1/chat/completions endpoint on localhost
so the browser auto-detects it like Ollama. Uses your existing Claude
credentials — no manual key entry needed.

Usage:
    python bridge.py              # auto-finds credentials, runs on port 3456
    python bridge.py --port 3457  # custom port

The browser scans localhost ports and finds this automatically.
"""

import json
import sys
import os
import argparse
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.request import Request, urlopen
from urllib.error import HTTPError

# ── Find Claude credentials automatically ──

def find_api_credentials():
    """
    Search for Anthropic API credentials in order:
    1. ANTHROPIC_API_KEY env var (standard API key)
    2. ~/.claude/.credentials.json (Claude Code OAuth token)
    3. ~/.anthropic/config.json
    """
    # 1. Environment variable
    env_key = os.environ.get('ANTHROPIC_API_KEY')
    if env_key:
        print(f'[bridge] Using ANTHROPIC_API_KEY from environment')
        return env_key, 'api-key'

    # 2. Claude Code OAuth credentials
    cred_paths = [
        Path.home() / '.claude' / '.credentials.json',
        Path(os.environ.get('APPDATA', '')) / 'claude' / '.credentials.json',
    ]
    for cred_path in cred_paths:
        if cred_path.exists():
            try:
                data = json.loads(cred_path.read_text(encoding='utf-8'))
                oauth = data.get('claudeAiOauth', {})
                token = oauth.get('accessToken')
                if token:
                    print(f'[bridge] Using Claude Code OAuth token from {cred_path}')
                    return token, 'oauth'
            except Exception as e:
                print(f'[bridge] Could not read {cred_path}: {e}')

    # 3. Anthropic config file
    config_paths = [
        Path.home() / '.anthropic' / 'config.json',
        Path(os.environ.get('APPDATA', '')) / 'anthropic' / 'config.json',
    ]
    for config_path in config_paths:
        if config_path.exists():
            try:
                data = json.loads(config_path.read_text(encoding='utf-8'))
                key = data.get('api_key') or data.get('apiKey')
                if key:
                    print(f'[bridge] Using API key from {config_path}')
                    return key, 'api-key'
            except Exception as e:
                print(f'[bridge] Could not read {config_path}: {e}')

    return None, None


ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
DEFAULT_MODEL = 'claude-sonnet-4-20250514'

credential, cred_type = find_api_credentials()


# ── Bridge Server ──

class BridgeHandler(BaseHTTPRequestHandler):
    """
    Translates OpenAI-compatible requests to Anthropic API format.
    This lets the browser talk to Claude using the same interface as Ollama.
    """

    def do_OPTIONS(self):
        """CORS preflight."""
        self.send_response(200)
        self._cors_headers()
        self.end_headers()

    def do_GET(self):
        """Handle model listing and health checks."""
        if self.path == '/v1/models' or self.path == '/api/tags':
            self._cors_response(200, {
                'data': [
                    {'id': 'claude-sonnet-4-20250514', 'name': 'claude-sonnet-4-20250514'},
                    {'id': 'claude-haiku-4-5-20251001', 'name': 'claude-haiku-4-5-20251001'},
                    {'id': 'claude-opus-4-20250514', 'name': 'claude-opus-4-20250514'},
                ],
                # Ollama-style response too
                'models': [
                    {'name': 'claude-sonnet-4-20250514'},
                    {'name': 'claude-haiku-4-5-20251001'},
                    {'name': 'claude-opus-4-20250514'},
                ]
            })
        elif self.path == '/' or self.path == '/health':
            self._cors_response(200, {
                'status': 'ok',
                'service': 'Unity Brain Bridge',
                'backend': 'Anthropic Claude',
                'credential_type': cred_type or 'none',
                'has_credentials': credential is not None,
            })
        else:
            self._cors_response(404, {'error': 'not found'})

    def do_POST(self):
        """Handle chat completions — translate OpenAI format → Anthropic format."""
        if self.path not in ('/v1/chat/completions', '/api/chat'):
            self._cors_response(404, {'error': 'not found'})
            return

        if not credential:
            self._cors_response(500, {
                'error': 'No Anthropic credentials found. Set ANTHROPIC_API_KEY or log in with Claude Code.'
            })
            return

        # Read request body
        length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(length)) if length else {}

        messages = body.get('messages', [])
        model = body.get('model', DEFAULT_MODEL)
        temperature = body.get('temperature', 0.9)
        max_tokens = body.get('max_tokens', 4096)

        # Extract system message (Anthropic uses separate system param)
        system_msg = None
        chat_messages = []
        for msg in messages:
            if msg.get('role') == 'system':
                system_msg = msg.get('content', '')
            else:
                chat_messages.append({
                    'role': msg.get('role', 'user'),
                    'content': msg.get('content', '')
                })

        # Ensure messages alternate user/assistant (Anthropic requirement)
        if not chat_messages:
            chat_messages = [{'role': 'user', 'content': 'Hello'}]

        # Build Anthropic request
        anthropic_body = {
            'model': model,
            'max_tokens': max_tokens,
            'temperature': temperature,
            'messages': chat_messages,
        }
        if system_msg:
            anthropic_body['system'] = system_msg

        # Build headers
        headers = {
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
        }
        if cred_type == 'oauth':
            headers['Authorization'] = f'Bearer {credential}'
        else:
            headers['x-api-key'] = credential

        # Call Anthropic API
        try:
            req = Request(
                ANTHROPIC_API_URL,
                data=json.dumps(anthropic_body).encode('utf-8'),
                headers=headers,
                method='POST'
            )
            with urlopen(req, timeout=60) as resp:
                result = json.loads(resp.read())

            # Translate Anthropic response → OpenAI format
            content = ''
            for block in result.get('content', []):
                if block.get('type') == 'text':
                    content += block.get('text', '')

            openai_response = {
                'choices': [{
                    'message': {
                        'role': 'assistant',
                        'content': content,
                    },
                    'finish_reason': result.get('stop_reason', 'stop'),
                }],
                'model': result.get('model', model),
                'usage': result.get('usage', {}),
            }
            self._cors_response(200, openai_response)

        except HTTPError as e:
            error_body = e.read().decode('utf-8', errors='replace')
            print(f'[bridge] Anthropic API error {e.code}: {error_body[:300]}')
            self._cors_response(e.code, {
                'error': f'Anthropic API error: {error_body[:300]}'
            })
        except Exception as e:
            print(f'[bridge] Error: {e}')
            self._cors_response(500, {'error': str(e)})

    def _cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    def _cors_response(self, code, data):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self._cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def log_message(self, format, *args):
        msg = format % args
        if '404' not in msg:  # don't spam favicon misses
            print(f'[bridge] {msg}')


def main():
    parser = argparse.ArgumentParser(description='Unity Brain Bridge — Claude API proxy')
    parser.add_argument('--port', type=int, default=3456, help='Port to listen on (default: 3456)')
    args = parser.parse_args()

    if not credential:
        print('[bridge] WARNING: No Anthropic credentials found!')
        print('[bridge] Set ANTHROPIC_API_KEY env var or log in with Claude Code first.')
        print('[bridge] Starting anyway — will return errors until credentials are available.')

    server = HTTPServer(('127.0.0.1', args.port), BridgeHandler)
    cred_label = 'OAuth token' if cred_type == 'oauth' else 'API key' if cred_type else 'NONE'
    print(f"\n  Unity Brain Bridge")
    print(f"  Claude API -> OpenAI-compatible proxy")
    print(f"  ---")
    print(f"  Listening:  http://localhost:{args.port}")
    print(f"  Backend:    Anthropic Claude API")
    print(f"  Credential: {cred_label}")
    print(f"  Models:     sonnet, haiku, opus")
    print(f"  ---")
    print(f"  The browser will auto-detect this on port scan.")
    print(f"  Press Ctrl+C to stop.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n[bridge] Shutting down.')
        server.server_close()


if __name__ == '__main__':
    main()
