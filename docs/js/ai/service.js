/**
 * ai/service.js - AI integration service
 * مركز إرسال طلبات الذكاء الاصطناعي عبر Worker أو مباشرةً عند الحاجة.
 */

export class AIService {
    constructor(options = {}) {
        this.mode = options.mode || 'worker';
        this.endpoint = options.endpoint || 'https://game-hub-backend.alghaybmhmd606.workers.dev/';
        this.apiProvider = options.apiProvider || 'gemini';
        this.customEndpoint = options.customEndpoint || null;
        this.systemPrompt = options.systemPrompt || 'You are a helpful gaming assistant.';
        this.requestTimeout = options.requestTimeout || 30000;
        this._apiKey = options.apiKey || null;

        this.endpoints = {
            gemini: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',
            openai: 'https://api.openai.com/v1/chat/completions',
            anthropic: 'https://api.anthropic.com/v1/messages',
            custom: this.customEndpoint
        };
    }

    setMode(mode) { this.mode = mode === 'direct' ? 'direct' : 'worker'; }
    setEndpoint(endpoint) { this.endpoint = endpoint || null; this.mode = 'worker'; }
    setProvider(provider) { this.apiProvider = provider || 'gemini'; }
    setApiKey(key) { this._apiKey = key || null; }
    hasApiKey() { return !!this._apiKey; }

    async sendMessage(input, extraParams = {}) {
        const payload = typeof input === 'string'
            ? { message: input, ...extraParams }
            : { ...(input || {}), ...extraParams };

        if (this.mode === 'worker' && this.endpoint) {
            return this._sendToWorker(payload);
        }
        return this._sendDirect(payload);
    }

    async _sendToWorker(payload) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.requestTimeout);

        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemPrompt: payload.systemPrompt || this.systemPrompt,
                    message: payload.message || payload.prompt || '',
                    history: Array.isArray(payload.history) ? payload.history : [],
                    gameContext: payload.gameContext || null,
                    profileId: payload.profileId || null,
                    historyLimit: payload.historyLimit || 5
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                const text = await response.text().catch(() => '');
                // استخرج رمز الخطأ بشكل نظيف بدل عرض الـ JSON الكامل
                let errorCode = `${response.status}`;
                let retryAfter = null;
                try {
                    const parsed = JSON.parse(text);
                    const details = typeof parsed.details === 'string' ? JSON.parse(parsed.details) : parsed.details;
                    const retryInfo = details?.error?.details?.find(d => d['@type']?.includes('RetryInfo'));
                    if (retryInfo?.retryDelay) {
                        retryAfter = parseInt(retryInfo.retryDelay);
                    }
                } catch (_) {}
                const err = new Error(`Worker error ${errorCode}`);
                err.status = response.status;
                err.retryAfter = retryAfter;
                throw err;
            }

            const data = await response.json();
            return data.response || data.text || data.message || 'No response';
        } finally {
            clearTimeout(timeout);
        }
    }

    async _sendDirect(payload) {
        if (!this._apiKey) {
            throw new Error('API key not set. Use worker mode or call setApiKey() first.');
        }

        const builder = this._getRequestBuilder(this.apiProvider);
        if (!builder) throw new Error(`Unknown provider: ${this.apiProvider}`);

        const prompt = payload.prompt || payload.message || '';
        const { url, options, responseExtractor } = builder(prompt, this._apiKey, payload);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.requestTimeout);

        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API error ${response.status}: ${errorText}`);
            }
            const data = await response.json();
            return responseExtractor(data);
        } finally {
            clearTimeout(timeout);
        }
    }

    _getRequestBuilder(provider) {
        const builders = {
            gemini: (prompt, key, payload = {}) => ({
                url: `${this.endpoints.gemini}?key=${encodeURIComponent(key)}`,
                options: {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        systemInstruction: { parts: [{ text: payload.systemPrompt || this.systemPrompt }] },
                        contents: this._toGeminiContents(payload.history, prompt, payload.gameContext),
                        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
                    })
                },
                responseExtractor: (data) => data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response'
            }),
            openai: (prompt, key, payload = {}) => ({
                url: this.endpoints.openai,
                options: {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${key}`
                    },
                    body: JSON.stringify({
                        model: payload.model || 'gpt-4o-mini',
                        messages: [
                            { role: 'system', content: payload.systemPrompt || this.systemPrompt },
                            ...this._toOpenAIHistory(payload.history),
                            { role: 'user', content: this._formatPrompt(prompt, payload.gameContext) }
                        ],
                        temperature: 0.7
                    })
                },
                responseExtractor: (data) => data.choices?.[0]?.message?.content || 'No response'
            }),
            anthropic: (prompt, key, payload = {}) => ({
                url: this.endpoints.anthropic,
                options: {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': key,
                        'anthropic-version': '2023-06-01'
                    },
                    body: JSON.stringify({
                        model: payload.model || 'claude-3-5-haiku-latest',
                        max_tokens: 1024,
                        system: payload.systemPrompt || this.systemPrompt,
                        messages: [
                            ...this._toAnthropicHistory(payload.history),
                            { role: 'user', content: this._formatPrompt(prompt, payload.gameContext) }
                        ]
                    })
                },
                responseExtractor: (data) => data.content?.[0]?.text || 'No response'
            }),
            custom: (prompt, key, payload = {}) => ({
                url: this.endpoints.custom,
                options: {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(key ? { 'Authorization': `Bearer ${key}` } : {})
                    },
                    body: JSON.stringify({
                        prompt: this._formatPrompt(prompt, payload.gameContext),
                        system: payload.systemPrompt || this.systemPrompt,
                        history: payload.history || []
                    })
                },
                responseExtractor: (data) => data.response || data.text || data.message || 'No response'
            })
        };

        return builders[provider];
    }

    _toOpenAIHistory(history = []) {
        return (Array.isArray(history) ? history : []).map(m => ({
            role: m.role === 'ai' ? 'assistant' : m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content || ''
        }));
    }

    _toAnthropicHistory(history = []) {
        return (Array.isArray(history) ? history : []).map(m => ({
            role: m.role === 'assistant' || m.role === 'ai' ? 'assistant' : 'user',
            content: m.content || ''
        }));
    }

    _toGeminiContents(history = [], prompt = '', gameContext = null) {
        const contents = [];
        for (const msg of (Array.isArray(history) ? history : [])) {
            if (!msg?.content) continue;
            contents.push({
                role: msg.role === 'ai' || msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            });
        }

        const finalPrompt = this._formatPrompt(prompt, gameContext);
        if (finalPrompt) {
            contents.push({ role: 'user', parts: [{ text: finalPrompt }] });
        }
        return contents;
    }

    _formatPrompt(prompt, gameContext) {
        const chunks = [];
        if (gameContext?.name) chunks.push(`[Game: ${gameContext.name}]`);
        if (gameContext?.state) {
            chunks.push(`[Game State]
${typeof gameContext.state === 'string' ? gameContext.state : JSON.stringify(gameContext.state, null, 2)}`);
        }
        chunks.push(prompt || '');
        return chunks.filter(Boolean).join('\n\n');
    }

    async loadKeyFromServer() {
        if (!this.endpoint) throw new Error('No endpoint configured.');
        const response = await fetch(this.endpoint, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
        if (!response.ok) throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        const data = await response.json();
        if (data?.key) { this._apiKey = data.key; return true; }
        throw new Error('Server did not return an API key');
    }

    async analyzeChessPosition(board, player = 'white') {
        const boardString = board.map(row => row.map(p => p || '.').join(' ')).join('\n');
        return this.sendMessage(`Analyze this chess position for ${player} and suggest the best move:

${boardString}`);
    }

    async getGameAdvice(gameName, gameState, question) {
        return this.sendMessage(`Game: ${gameName}
Current state: ${JSON.stringify(gameState)}

Question: ${question}

Provide a helpful, concise answer.`);
    }

    async streamMessage(prompt, onChunk) {
        console.log('Streaming not yet implemented. Use sendMessage() for now.');
        const response = await this.sendMessage(prompt);
        if (onChunk) onChunk(response);
        return response;
    }
}

export class ChessAI extends AIService {
    constructor(options = {}) {
        super({
            ...options,
            systemPrompt: options.systemPrompt || 'You are a chess grandmaster. Analyze positions and give advice. Always respond in the requested format.'
        });
    }

    async evaluatePosition(fen) {
        return this.sendMessage(`Evaluate this chess position (FEN: ${fen}). Give a score from -10 to +10 (positive is good for White) and explain why.`);
    }

    async getTopMoves(fen, count = 3) {
        return this.sendMessage(`For this chess position (FEN: ${fen}), list the top ${count} best moves in UCI format (e.g., e2e4). For each, give a one-line reason.`);
    }
}

export default AIService;
