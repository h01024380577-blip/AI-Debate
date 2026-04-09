const axios = require('axios');

const GEMINI_LAMBDA_URL = process.env.GEMINI_LAMBDA_URL;
const BEDROCK_LAMBDA_URL = process.env.BEDROCK_LAMBDA_URL;
const TIMEOUT_MS = 15000;

async function invokeLambda({ model, persona, topic, myPosition, opponentPosition, history, action }) {
  const url = model === 'gemini' ? GEMINI_LAMBDA_URL : BEDROCK_LAMBDA_URL;
  if (!url) throw new Error(`Lambda URL for model '${model}' is not configured`);

  const payload = { persona, topic, myPosition, opponentPosition, history, action };

  try {
    const res = await axios.post(url, payload, {
      timeout: TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.data || typeof res.data.content !== 'string') {
      throw new Error('Lambda returned malformed payload');
    }
    return res.data.content;
  } catch (err) {
    if (err.code === 'ECONNABORTED') throw new Error('Lambda timeout');
    if (err.response) {
      throw new Error(`Lambda ${err.response.status}: ${JSON.stringify(err.response.data)}`);
    }
    throw err;
  }
}

module.exports = { invokeLambda };
