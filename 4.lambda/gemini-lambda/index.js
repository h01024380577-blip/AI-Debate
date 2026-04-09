const { GoogleGenerativeAI } = require('@google/generative-ai');
const { buildPrompt } = require('./prompts');

const MODEL_ID = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('[gemini-lambda] GEMINI_API_KEY is not set');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

exports.handler = async (event) => {
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || event);
    const { system, user } = buildPrompt(body);

    if (!genAI) {
      return jsonResponse(500, { error: 'GEMINI_API_KEY not configured' });
    }

    const model = genAI.getGenerativeModel({
      model: MODEL_ID,
      systemInstruction: system,
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 2048,
        // Disable Gemini 2.5 Flash's internal thinking budget so the full
        // maxOutputTokens goes to the visible response. Without this, the
        // model silently spends most of the budget on hidden reasoning and
        // truncates mid-sentence (observed: '...빠른 조리 시간'과' cut-off).
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    const result = await model.generateContent(user);
    const candidate = result.response.candidates?.[0];
    const finishReason = candidate?.finishReason;
    const content = result.response.text().trim();
    if (!content || finishReason !== 'STOP') {
      console.warn('[gemini-lambda] suspicious response', {
        finishReason,
        length: content.length,
        preview: content.slice(0, 60)
      });
    }
    return jsonResponse(200, { content });
  } catch (err) {
    console.error('[gemini-lambda] error', err);
    return jsonResponse(500, { error: err.message || 'Lambda failure' });
  }
};

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  };
}
