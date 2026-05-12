export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    if (url.pathname !== '/api/chat' && url.pathname !== '/') {
      return Response.json(
        { error: 'Not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    if (request.method !== 'POST') {
      return Response.json(
        { error: 'Method not allowed' },
        { status: 405, headers: corsHeaders }
      );
    }

    try {
      const body = await request.json();

      const message = String(body?.message || '').trim();

      if (!message) {
        return Response.json(
          { error: 'Empty message' },
          { status: 400, headers: corsHeaders }
        );
      }

      const historyLimit = Number.isFinite(Number(body?.historyLimit))
        ? Math.max(0, Math.min(10, Number(body.historyLimit)))
        : 5;

      const history = Array.isArray(body?.history)
        ? body.history.slice(-historyLimit)
        : [];

      const gameContext = body?.gameContext || null;

      const apiKey = env.GEMINI_API_KEY;
      const model = String(env.GEMINI_MODEL || 'gemini-2.5-flash').trim();

      if (!apiKey) {
        return Response.json(
          { error: 'Missing GEMINI_API_KEY' },
          { status: 500, headers: corsHeaders }
        );
      }

      const contents = [];

      for (const item of history) {
        const role =
          item?.role === 'assistant' || item?.role === 'ai'
            ? 'model'
            : 'user';

        const text = String(item?.content || '').trim();

        if (!text) continue;

        contents.push({
          role,
          parts: [{ text }]
        });
      }

      const promptParts = [];

      if (gameContext?.name) {
        promptParts.push(`[Game: ${gameContext.name}]`);
      }

      if (gameContext?.state) {
        const stateText =
          typeof gameContext.state === 'string'
            ? gameContext.state
            : JSON.stringify(gameContext.state);

        promptParts.push(`[Game State]\n${stateText}`);
      }

      promptParts.push(message);

      contents.push({
        role: 'user',
        parts: [{ text: promptParts.join('\n\n') }]
      });

      const endpoint =
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const geminiResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: 'You are a helpful gaming assistant. Keep responses concise.'
              }
            ]
          },
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024
          }
        })
      });

      const rawText = await geminiResponse.text();

      if (!geminiResponse.ok) {
        return Response.json(
          {
            error: 'Gemini request failed',
            details: rawText
          },
          {
            status: geminiResponse.status,
            headers: corsHeaders
          }
        );
      }

      const data = JSON.parse(rawText);

      const responseText =
        data?.candidates?.[0]?.content?.parts
          ?.map(p => p?.text || '')
          .join('') || '';

      return Response.json(
        {
          response: responseText || 'No response',
          provider: 'gemini',
          model
        },
        { headers: corsHeaders }
      );

    } catch (error) {
      return Response.json(
        {
          error: error?.message || 'Unknown error'
        },
        {
          status: 500,
          headers: corsHeaders
        }
      );
    }
  }
};
