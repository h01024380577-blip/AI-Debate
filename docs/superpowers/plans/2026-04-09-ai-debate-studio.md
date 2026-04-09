# AI Debate Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a blind AI debate web app where Gemini 2.5 Flash and Bedrock Nova Lite role-play as fixed personas (전직 변호사 한지호 / 전직 기자 이서연), debate user-supplied topics, and reveal which model was which only after the user picks a winner.

**Architecture:** React frontend → Express server → two AWS Lambda microservices (one per LLM) → MySQL/RDS for results. The two lambdas share a JSON request/response interface so the server is model-agnostic. Personas are statically defined; AI model is randomly assigned to each persona per session, so users can't tell who's who until the result reveal.

**Tech Stack:**
- **Frontend**: React 18 (CRA), vanilla CSS (no UI library — handcrafted dark studio theme)
- **Backend**: Node.js + Express 4, mysql2, axios, uuid, jest+supertest for tests
- **Lambda 1 (gemini-lambda)**: Node.js + `@google/generative-ai`
- **Lambda 2 (bedrock-lambda)**: Python 3.11 + boto3 (existing layer infrastructure reused)
- **Storage**: AWS RDS MySQL 8 (1 table)
- **AWS**: Lambda × 2, Lambda Function URLs, IAM Role (bedrock), Bedrock (Nova Lite), RDS

**Spec:** `docs/superpowers/specs/2026-04-09-ai-debate-studio-design.md`

---

## File Structure

```
4.lambda/
├── README.md                                  # NEW: rewritten per assignment
├── client/
│   ├── public/
│   │   ├── index.html                         # MODIFY: title only
│   │   └── personas/
│   │       ├── gemini.png                     # EXISTS (한지호)
│   │       └── nova.png                       # EXISTS (이서연)
│   ├── src/
│   │   ├── api/
│   │   │   └── debate.js                      # NEW: fetch wrappers
│   │   ├── state/
│   │   │   └── debateMachine.js               # NEW: client state machine
│   │   ├── components/
│   │   │   ├── PersonaCard.jsx                # NEW: small persona chip
│   │   │   ├── SpeakerCard.jsx                # NEW: full-screen speaker card
│   │   │   ├── ActionBlocks.jsx               # NEW: 6 control blocks
│   │   │   ├── HistoryChips.jsx               # NEW: history scroll bar
│   │   │   ├── StartScreen.jsx                # NEW
│   │   │   ├── MainScreen.jsx                 # NEW
│   │   │   └── ResultScreen.jsx               # NEW
│   │   ├── styles.css                         # NEW: full theme (replaces App.css/index.css)
│   │   ├── App.jsx                            # NEW (replaces App.js)
│   │   └── index.js                           # MODIFY: import App.jsx + styles.css
│   └── package.json                           # MODIFY: remove mysql2, add uuid
├── server/
│   ├── src/
│   │   ├── personas.js                        # NEW: persona metadata
│   │   ├── stateMachine.js                    # NEW: turn FSM
│   │   ├── sessions.js                        # NEW: in-memory session store
│   │   ├── lambdaClient.js                    # NEW: axios calls to lambdas
│   │   ├── db.js                              # NEW: mysql2 pool + queries
│   │   ├── routes/
│   │   │   └── debate.js                      # NEW: 4 endpoints
│   │   └── index.js                           # NEW (replaces server.js)
│   ├── tests/
│   │   ├── stateMachine.test.js               # NEW (TDD)
│   │   ├── sessions.test.js                   # NEW (TDD)
│   │   └── debate.routes.test.js              # NEW (integration)
│   ├── scripts/
│   │   └── init-db.sql                        # NEW: schema
│   ├── .env.example                           # NEW
│   └── package.json                           # MODIFY: add jest, supertest, uuid; remove openai
├── gemini-lambda/
│   ├── index.js                               # REWRITE
│   ├── prompts.js                             # NEW: system prompt builder
│   ├── tests/
│   │   └── prompts.test.js                    # NEW (TDD)
│   ├── .env.example                           # NEW
│   └── package.json                           # MODIFY: add @google/generative-ai
└── bedrock-lambda/
    ├── lambda_function.py                     # REWRITE (Python)
    ├── prompts.py                             # NEW (Python)
    └── README.md                              # NEW: deploy notes
```

---

## Phase 0 — Cleanup

### Task 1: Wipe outdated 4.lambda code, scaffold new layout

**Files:**
- Delete: `4.lambda/server/server.js`, `4.lambda/client/src/App.js`, `4.lambda/client/src/App.css`, `4.lambda/client/src/index.css`, `4.lambda/bedrock-lambda/lambda_function.py`, `4.lambda/gemini-lambda/index.js`
- Create: empty new directories per File Structure above

- [ ] **Step 1: Delete obsolete files**

```bash
cd /Users/jiwon/Nxt-Classic-Architecture-v2
rm 4.lambda/server/server.js
rm 4.lambda/client/src/App.js 4.lambda/client/src/App.css 4.lambda/client/src/index.css
rm 4.lambda/bedrock-lambda/lambda_function.py
rm 4.lambda/gemini-lambda/index.js
```

- [ ] **Step 2: Create new server folders**

```bash
mkdir -p 4.lambda/server/src/routes 4.lambda/server/tests 4.lambda/server/scripts
mkdir -p 4.lambda/client/src/api 4.lambda/client/src/state 4.lambda/client/src/components
mkdir -p 4.lambda/gemini-lambda/tests
```

- [ ] **Step 3: Verify structure**

Run: `find 4.lambda -type d | sort`
Expected output includes: `4.lambda/server/src/routes`, `4.lambda/client/src/components`, `4.lambda/gemini-lambda/tests`.

- [ ] **Step 4: Commit**

```bash
git add -A 4.lambda/
git commit -m "chore(4.lambda): remove old prototype, scaffold new folder layout"
```

---

## Phase 1 — Lambda Functions (independent of server)

### Task 2: gemini-lambda — package.json + dependencies

**Files:**
- Modify: `4.lambda/gemini-lambda/package.json`

- [ ] **Step 1: Replace package.json**

```json
{
  "name": "gemini-lambda",
  "version": "1.0.0",
  "description": "AWS Lambda — Google Gemini debate handler",
  "main": "index.js",
  "scripts": {
    "test": "node --test tests/"
  },
  "dependencies": {
    "@google/generative-ai": "^0.21.0"
  }
}
```

- [ ] **Step 2: Install**

```bash
cd 4.lambda/gemini-lambda
rm -f package-lock.json
npm install
```
Expected: creates `node_modules/`, no errors.

- [ ] **Step 3: Commit**

```bash
git add 4.lambda/gemini-lambda/package.json 4.lambda/gemini-lambda/package-lock.json
git commit -m "feat(gemini-lambda): set up @google/generative-ai dependency"
```

---

### Task 3: gemini-lambda — prompts.js (TDD)

**Files:**
- Create: `4.lambda/gemini-lambda/prompts.js`
- Test: `4.lambda/gemini-lambda/tests/prompts.test.js`

The `prompts.js` module exports `buildPrompt({ persona, topic, myPosition, opponentPosition, history, action })` returning `{ system, user }`. It must:
1. Build a system prompt that locks the LLM into the persona (name, role, voice).
2. Tell the model which side it argues.
3. Append history as `[상대] ...` / `[나] ...` lines.
4. Append an action-specific instruction (오프닝, 반박, 예시, 재반박, 마무리).
5. Cap output at ~3 sentences in Korean.

- [ ] **Step 1: Write the failing test**

Create `4.lambda/gemini-lambda/tests/prompts.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert');
const { buildPrompt, ACTION_INSTRUCTIONS } = require('../prompts');

const persona = {
  name: '한지호',
  role: '전직 변호사, 토론 챔피언',
  voice: '자신감 있고 직설적, 논리 정연, 살짝 도발적'
};

test('buildPrompt — opening uses persona + position, no history reference', () => {
  const out = buildPrompt({
    persona,
    topic: '점심 메뉴 논쟁',
    myPosition: '짜장면이 최고',
    opponentPosition: '짬뽕이 최고',
    history: [],
    action: 'opening'
  });
  assert.match(out.system, /한지호/);
  assert.match(out.system, /전직 변호사/);
  assert.match(out.system, /자신감 있고 직설적/);
  assert.match(out.user, /짜장면이 최고/);
  assert.match(out.user, /짬뽕이 최고/);
  assert.match(out.user, /점심 메뉴 논쟁/);
  assert.match(out.user, new RegExp(ACTION_INSTRUCTIONS.opening));
});

test('buildPrompt — rebuttal includes history block with previous turns', () => {
  const out = buildPrompt({
    persona,
    topic: '점심 메뉴 논쟁',
    myPosition: '짜장면이 최고',
    opponentPosition: '짬뽕이 최고',
    history: [
      { speaker: 'opponent', action: 'opening', content: '짬뽕이 더 자극적이라 좋습니다.' },
      { speaker: 'self', action: 'opening', content: '짜장면은 절제의 미학입니다.' }
    ],
    action: 'rebuttal'
  });
  assert.match(out.user, /상대가 직전에 말한 내용/);
  assert.match(out.user, /짬뽕이 더 자극적/);
  assert.match(out.user, /짜장면은 절제/);
  assert.match(out.user, new RegExp(ACTION_INSTRUCTIONS.rebuttal));
});

test('buildPrompt — unknown action throws', () => {
  assert.throws(() => buildPrompt({
    persona, topic: 't', myPosition: 'a', opponentPosition: 'b', history: [], action: 'bogus'
  }), /Unknown action/);
});
```

- [ ] **Step 2: Run tests, expect failure**

```bash
cd 4.lambda/gemini-lambda
npm test
```
Expected: failure with `Cannot find module '../prompts'`.

- [ ] **Step 3: Implement prompts.js**

Create `4.lambda/gemini-lambda/prompts.js`:

```javascript
const ACTION_INSTRUCTIONS = {
  opening: '자기 입장의 핵심 근거를 2~3문장으로 간결하게 펼치세요. 상대 발언은 아직 참조하지 마세요.',
  rebuttal: '상대의 직전 발언을 짚어 한 가지 핵심 약점을 찌르고, 자기 입장이 왜 더 옳은지 2~3문장으로 반박하세요.',
  example: '자기 입장을 뒷받침하는 구체적인 일화 또는 사례를 1~2개, 2~3문장으로 제시하세요.',
  counter_rebuttal: '상대의 가장 최근 반박을 받아 다시 비판하고, 자기 논지를 더 강하게 굳히는 재반박을 2~3문장으로 펼치세요.',
  closing: '지금까지의 흐름을 정리하면서 자기 입장의 핵심을 인상 깊게 마무리하세요. 2~3문장.'
};

function buildPrompt({ persona, topic, myPosition, opponentPosition, history, action }) {
  if (!ACTION_INSTRUCTIONS[action]) {
    throw new Error(`Unknown action: ${action}`);
  }

  const system = [
    `당신은 가상 인물 "${persona.name}"입니다.`,
    `직업: ${persona.role}`,
    `말투/성격: ${persona.voice}`,
    '',
    '당신은 지금 TV 토론회에 출연 중이며, 주어진 입장을 진심으로 옹호하는 토론자 역할을 맡습니다.',
    '항상 한국어로, 자신의 페르소나와 어울리는 말투로 대답하세요.',
    '메타 코멘트(예: "AI로서…", "시뮬레이션이지만…")는 절대 하지 마세요.',
    '응답은 발언 본문만 주세요. 따옴표나 라벨은 붙이지 마세요.'
  ].join('\n');

  const lines = [];
  lines.push(`토론 주제: ${topic}`);
  lines.push(`내 입장: ${myPosition}`);
  lines.push(`상대 입장: ${opponentPosition}`);

  if (history.length > 0) {
    lines.push('');
    lines.push('상대가 직전에 말한 내용 + 지금까지 흐름:');
    for (const turn of history) {
      const tag = turn.speaker === 'self' ? '[나]' : '[상대]';
      lines.push(`${tag} (${turn.action}) ${turn.content}`);
    }
  }

  lines.push('');
  lines.push(`지금 해야 할 행동: ${ACTION_INSTRUCTIONS[action]}`);

  return { system, user: lines.join('\n') };
}

module.exports = { buildPrompt, ACTION_INSTRUCTIONS };
```

- [ ] **Step 4: Run tests, expect pass**

```bash
npm test
```
Expected: 3 passing, 0 failing.

- [ ] **Step 5: Commit**

```bash
git add 4.lambda/gemini-lambda/prompts.js 4.lambda/gemini-lambda/tests/prompts.test.js
git commit -m "feat(gemini-lambda): prompt builder with persona + action instructions"
```

---

### Task 4: gemini-lambda — handler (index.js)

**Files:**
- Create: `4.lambda/gemini-lambda/index.js`
- Create: `4.lambda/gemini-lambda/.env.example`

The handler accepts a Lambda Function URL invocation. The body is JSON matching the spec §7.2 contract. It calls Gemini and returns `{ content }`.

- [ ] **Step 1: Create .env.example**

```
GEMINI_API_KEY=your_google_ai_studio_key_here
GEMINI_MODEL=gemini-2.5-flash
```

- [ ] **Step 2: Write index.js**

```javascript
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
      generationConfig: { temperature: 0.85, maxOutputTokens: 400 }
    });

    const result = await model.generateContent(user);
    const content = result.response.text().trim();
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
```

- [ ] **Step 3: Smoke test locally with stub event (no network)**

Create one-off `node -e` invocation that exercises validation but skips the network. Run:

```bash
cd 4.lambda/gemini-lambda
node -e "
const h = require('./index').handler;
process.env.GEMINI_API_KEY = '';
h({ body: JSON.stringify({
  persona: { name: '한지호', role: '전직 변호사', voice: '직설적' },
  topic: 'a vs b',
  myPosition: 'a',
  opponentPosition: 'b',
  history: [],
  action: 'opening'
})}).then(r => console.log(r));
"
```
Expected: `{ statusCode: 500, body: '{\"error\":\"GEMINI_API_KEY not configured\"}' ... }`. (Real network test happens after AWS deploy in Phase 6.)

- [ ] **Step 4: Commit**

```bash
git add 4.lambda/gemini-lambda/index.js 4.lambda/gemini-lambda/.env.example
git commit -m "feat(gemini-lambda): add Lambda handler that calls Gemini via prompts builder"
```

---

### Task 5: bedrock-lambda — prompts.py + handler

**Files:**
- Create: `4.lambda/bedrock-lambda/prompts.py`
- Create: `4.lambda/bedrock-lambda/lambda_function.py`
- Create: `4.lambda/bedrock-lambda/README.md`

The Python lambda mirrors the Node lambda's interface. It uses `boto3` (Lambda runtime ships boto3, no layer needed for the SDK itself).

- [ ] **Step 1: Write prompts.py**

```python
ACTION_INSTRUCTIONS = {
    "opening": "자기 입장의 핵심 근거를 2~3문장으로 간결하게 펼치세요. 상대 발언은 아직 참조하지 마세요.",
    "rebuttal": "상대의 직전 발언을 짚어 한 가지 핵심 약점을 찌르고, 자기 입장이 왜 더 옳은지 2~3문장으로 반박하세요.",
    "example": "자기 입장을 뒷받침하는 구체적인 일화 또는 사례를 1~2개, 2~3문장으로 제시하세요.",
    "counter_rebuttal": "상대의 가장 최근 반박을 받아 다시 비판하고, 자기 논지를 더 강하게 굳히는 재반박을 2~3문장으로 펼치세요.",
    "closing": "지금까지의 흐름을 정리하면서 자기 입장의 핵심을 인상 깊게 마무리하세요. 2~3문장.",
}


def build_prompt(payload):
    action = payload["action"]
    if action not in ACTION_INSTRUCTIONS:
        raise ValueError(f"Unknown action: {action}")

    persona = payload["persona"]
    system = "\n".join([
        f'당신은 가상 인물 "{persona["name"]}"입니다.',
        f'직업: {persona["role"]}',
        f'말투/성격: {persona["voice"]}',
        "",
        "당신은 지금 TV 토론회에 출연 중이며, 주어진 입장을 진심으로 옹호하는 토론자 역할을 맡습니다.",
        "항상 한국어로, 자신의 페르소나와 어울리는 말투로 대답하세요.",
        '메타 코멘트(예: "AI로서…", "시뮬레이션이지만…")는 절대 하지 마세요.',
        "응답은 발언 본문만 주세요. 따옴표나 라벨은 붙이지 마세요.",
    ])

    lines = [
        f'토론 주제: {payload["topic"]}',
        f'내 입장: {payload["myPosition"]}',
        f'상대 입장: {payload["opponentPosition"]}',
    ]

    history = payload.get("history") or []
    if history:
        lines.append("")
        lines.append("상대가 직전에 말한 내용 + 지금까지 흐름:")
        for turn in history:
            tag = "[나]" if turn["speaker"] == "self" else "[상대]"
            lines.append(f'{tag} ({turn["action"]}) {turn["content"]}')

    lines.append("")
    lines.append(f"지금 해야 할 행동: {ACTION_INSTRUCTIONS[action]}")

    return system, "\n".join(lines)
```

- [ ] **Step 2: Write lambda_function.py**

```python
import json
import os
import boto3
from prompts import build_prompt

MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "amazon.nova-lite-v1:0")
REGION = os.environ.get("AWS_REGION", "us-east-1")

bedrock = boto3.client("bedrock-runtime", region_name=REGION)


def lambda_handler(event, context):
    try:
        body = event.get("body")
        payload = json.loads(body) if isinstance(body, str) else (body or event)

        system, user = build_prompt(payload)

        response = bedrock.converse(
            modelId=MODEL_ID,
            system=[{"text": system}],
            messages=[
                {"role": "user", "content": [{"text": user}]}
            ],
            inferenceConfig={
                "temperature": 0.85,
                "maxTokens": 400,
            },
        )

        content = response["output"]["message"]["content"][0]["text"].strip()

        return _json_response(200, {"content": content})
    except Exception as exc:
        print(f"[bedrock-lambda] error: {exc}")
        return _json_response(500, {"error": str(exc)})


def _json_response(status_code, payload):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(payload, ensure_ascii=False),
    }
```

- [ ] **Step 3: Quick syntax + import test**

```bash
cd 4.lambda/bedrock-lambda
python3 -c "from prompts import build_prompt; s,u = build_prompt({'persona':{'name':'한지호','role':'전직 변호사','voice':'직설적'},'topic':'t','myPosition':'a','opponentPosition':'b','history':[],'action':'opening'}); print(s[:30]); print('---'); print(u)"
```
Expected: prints the persona system prompt prefix and the user prompt block. (Don't import `lambda_function.py` locally — boto3 connects at module load.)

- [ ] **Step 4: Write deploy README**

Create `4.lambda/bedrock-lambda/README.md`:

```markdown
# bedrock-lambda

Python 3.11 Lambda that role-plays a debate persona using AWS Bedrock Nova Lite.

## Files
- `lambda_function.py` — handler
- `prompts.py` — prompt builder (mirrors gemini-lambda/prompts.js)

## Deploy

1. Zip the function:
   ```bash
   cd 4.lambda/bedrock-lambda
   zip -j function.zip lambda_function.py prompts.py
   ```
2. Create Lambda (Python 3.11) and upload `function.zip`.
3. Attach IAM role with policy `AmazonBedrockFullAccess` (or scoped `bedrock:InvokeModel` on `amazon.nova-lite-v1:0`).
4. Set env var `BEDROCK_MODEL_ID=amazon.nova-lite-v1:0` (region inherits Lambda region).
5. Enable Function URL (Auth: NONE for dev, IAM for prod).
6. In Bedrock console > Model access > enable "Amazon Nova Lite" in the same region as the Lambda.
```

- [ ] **Step 5: Commit**

```bash
git add 4.lambda/bedrock-lambda/
git commit -m "feat(bedrock-lambda): Python handler + prompt builder + deploy notes"
```

---

## Phase 2 — Server core logic (TDD)

### Task 6: server — package.json + dependencies

**Files:**
- Modify: `4.lambda/server/package.json`

- [ ] **Step 1: Replace package.json**

```json
{
  "name": "server",
  "version": "1.0.0",
  "description": "AI Debate Studio backend",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js",
    "test": "node --test tests/"
  },
  "dependencies": {
    "axios": "^1.6.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "mysql2": "^3.16.2",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "supertest": "^6.3.4"
  }
}
```

- [ ] **Step 2: Install**

```bash
cd 4.lambda/server
rm -f package-lock.json node_modules
npm install
```

- [ ] **Step 3: Commit**

```bash
git add 4.lambda/server/package.json 4.lambda/server/package-lock.json
git commit -m "chore(server): refresh dependencies (uuid, supertest, drop openai)"
```

---

### Task 7: server — personas.js

**Files:**
- Create: `4.lambda/server/src/personas.js`

- [ ] **Step 1: Write personas.js**

```javascript
// Static persona registry. Image paths point to client/public/personas/.
// AI model is randomly assigned to a persona at session start (see sessions.js).

const PERSONAS = {
  hanjiho: {
    id: 'hanjiho',
    name: '한지호',
    role: '전직 변호사, 토론 챔피언',
    voice: '자신감 있고 직설적, 논리 정연, 살짝 도발적, 40대 남성, 정중한 존댓말과 단호한 단언을 섞어 사용',
    color: 'red',
    image: '/personas/gemini.png'
  },
  leeseoyeon: {
    id: 'leeseoyeon',
    name: '이서연',
    role: '전직 기자, 토론 챔피언',
    voice: '차분하고 분석적, 데이터와 사례 인용 좋아함, 30대 여성, 침착한 존댓말, 감정에 휘둘리지 않음',
    color: 'blue',
    image: '/personas/nova.png'
  }
};

const PERSONA_IDS = Object.keys(PERSONAS);

function getPersona(id) {
  const p = PERSONAS[id];
  if (!p) throw new Error(`Unknown persona id: ${id}`);
  return p;
}

module.exports = { PERSONAS, PERSONA_IDS, getPersona };
```

- [ ] **Step 2: Commit**

```bash
git add 4.lambda/server/src/personas.js
git commit -m "feat(server): static persona registry"
```

---

### Task 8: server — stateMachine.js (TDD, core logic)

**Files:**
- Create: `4.lambda/server/src/stateMachine.js`
- Test: `4.lambda/server/tests/stateMachine.test.js`

State machine manages the debate flow. States and rules from spec §4.2.

States: `idle`, `A_opened`, `B_opened`, `mid`, `A_closed`, `B_closed`, `ready_to_conclude`, `concluded`.

Each state exposes `availableActions: ['opening' | 'rebuttal' | 'example' | 'counter_rebuttal' | 'closing' | 'conclude']` and a `nextSpeaker: 'A' | 'B' | null`.

- [ ] **Step 1: Write the failing test**

```javascript
const test = require('node:test');
const assert = require('node:assert');
const { initialState, applyAction, availableActions, nextSpeaker } = require('../src/stateMachine');

test('initialState — idle, only opening allowed, A speaks first', () => {
  const s = initialState();
  assert.strictEqual(s.state, 'idle');
  assert.deepStrictEqual(availableActions(s), ['opening']);
  assert.strictEqual(nextSpeaker(s), 'A');
});

test('opening x2 advances idle → A_opened → B_opened', () => {
  let s = initialState();
  s = applyAction(s, 'opening');           // A speaks
  assert.strictEqual(s.state, 'A_opened');
  assert.strictEqual(nextSpeaker(s), 'B');
  assert.deepStrictEqual(availableActions(s), ['opening']);

  s = applyAction(s, 'opening');           // B speaks
  assert.strictEqual(s.state, 'B_opened');
  assert.strictEqual(nextSpeaker(s), 'A');
  assert.deepStrictEqual(
    availableActions(s).sort(),
    ['closing', 'counter_rebuttal', 'example', 'rebuttal'].sort()
  );
});

test('mid stage allows reb/example/counter back-and-forth', () => {
  let s = initialState();
  s = applyAction(s, 'opening'); // A
  s = applyAction(s, 'opening'); // B
  s = applyAction(s, 'rebuttal'); // A
  assert.strictEqual(s.state, 'mid');
  assert.strictEqual(nextSpeaker(s), 'B');
  s = applyAction(s, 'example'); // B
  assert.strictEqual(nextSpeaker(s), 'A');
});

test('closing × 2 advances to ready_to_conclude', () => {
  let s = initialState();
  s = applyAction(s, 'opening');
  s = applyAction(s, 'opening');
  s = applyAction(s, 'closing'); // A closes
  assert.strictEqual(s.state, 'A_closed');
  assert.strictEqual(nextSpeaker(s), 'B');
  s = applyAction(s, 'closing'); // B closes
  assert.strictEqual(s.state, 'ready_to_conclude');
  assert.deepStrictEqual(availableActions(s), ['conclude']);
  assert.strictEqual(nextSpeaker(s), null);
});

test('conclude advances to concluded, no actions left', () => {
  let s = initialState();
  s = applyAction(s, 'opening');
  s = applyAction(s, 'opening');
  s = applyAction(s, 'closing');
  s = applyAction(s, 'closing');
  s = applyAction(s, 'conclude');
  assert.strictEqual(s.state, 'concluded');
  assert.deepStrictEqual(availableActions(s), []);
});

test('invalid action throws', () => {
  const s = initialState();
  assert.throws(() => applyAction(s, 'rebuttal'), /Action 'rebuttal' not allowed in state 'idle'/);
});
```

- [ ] **Step 2: Run tests, expect failure**

```bash
cd 4.lambda/server
npm test
```
Expected: failure with `Cannot find module '../src/stateMachine'`.

- [ ] **Step 3: Implement stateMachine.js**

```javascript
// Debate state machine. Pure functions; no I/O.
// State shape: { state, turnCount, lastSpeaker }

const STATES = {
  idle: { actions: ['opening'], next: 'A' },
  A_opened: { actions: ['opening'], next: 'B' },
  B_opened: { actions: ['rebuttal', 'example', 'counter_rebuttal', 'closing'], next: 'A' },
  mid: { actions: ['rebuttal', 'example', 'counter_rebuttal', 'closing'], next: null /* alternates */ },
  A_closed: { actions: ['closing'], next: 'B' },
  B_closed: { actions: ['closing'], next: 'A' },
  ready_to_conclude: { actions: ['conclude'], next: null },
  concluded: { actions: [], next: null }
};

function initialState() {
  return { state: 'idle', turnCount: 0, lastSpeaker: null };
}

function availableActions(s) {
  return [...STATES[s.state].actions];
}

function nextSpeaker(s) {
  if (s.state === 'mid') {
    return s.lastSpeaker === 'A' ? 'B' : 'A';
  }
  return STATES[s.state].next;
}

function applyAction(s, action) {
  const allowed = STATES[s.state].actions;
  if (!allowed.includes(action)) {
    throw new Error(`Action '${action}' not allowed in state '${s.state}'`);
  }
  const speaker = nextSpeaker(s);

  let nextStateName;
  if (s.state === 'idle' && action === 'opening') nextStateName = 'A_opened';
  else if (s.state === 'A_opened' && action === 'opening') nextStateName = 'B_opened';
  else if (s.state === 'B_opened') {
    if (action === 'closing') nextStateName = 'A_closed';
    else nextStateName = 'mid';
  } else if (s.state === 'mid') {
    if (action === 'closing') {
      nextStateName = speaker === 'A' ? 'A_closed' : 'B_closed';
    } else {
      nextStateName = 'mid';
    }
  } else if (s.state === 'A_closed' && action === 'closing') nextStateName = 'ready_to_conclude';
  else if (s.state === 'B_closed' && action === 'closing') nextStateName = 'ready_to_conclude';
  else if (s.state === 'ready_to_conclude' && action === 'conclude') nextStateName = 'concluded';
  else throw new Error(`Unhandled transition: ${s.state} + ${action}`);

  return {
    state: nextStateName,
    turnCount: s.turnCount + (action === 'conclude' ? 0 : 1),
    lastSpeaker: action === 'conclude' ? s.lastSpeaker : speaker
  };
}

module.exports = { initialState, applyAction, availableActions, nextSpeaker, STATES };
```

- [ ] **Step 4: Run tests, expect pass**

```bash
npm test
```
Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
git add 4.lambda/server/src/stateMachine.js 4.lambda/server/tests/stateMachine.test.js
git commit -m "feat(server): debate state machine with TDD coverage"
```

---

### Task 9: server — sessions.js (TDD)

**Files:**
- Create: `4.lambda/server/src/sessions.js`
- Test: `4.lambda/server/tests/sessions.test.js`

In-memory session store. Each session: `{ id, topic, positionA, positionB, sides, history, fsm, createdAt }`. `sides` maps `'A' | 'B'` to `{ persona, model }`.

- [ ] **Step 1: Write the failing test**

```javascript
const test = require('node:test');
const assert = require('node:assert');
const { createSession, getSession, addTurn, expireOlderThan, _reset } = require('../src/sessions');

test('createSession — assigns models randomly + builds matchup', () => {
  _reset();
  const seedRng = () => 0; // deterministic: gemini -> A
  const s = createSession({
    topic: 'a vs b',
    positionA: 'a',
    positionB: 'b'
  }, seedRng);

  assert.ok(s.id);
  assert.strictEqual(s.topic, 'a vs b');
  assert.deepStrictEqual(Object.keys(s.sides).sort(), ['A', 'B']);
  assert.strictEqual(s.sides.A.model, 'gemini');
  assert.strictEqual(s.sides.B.model, 'nova');
  assert.strictEqual(s.fsm.state, 'idle');
  assert.deepStrictEqual(s.history, []);
});

test('createSession — RNG >= 0.5 puts gemini on B', () => {
  _reset();
  const s = createSession({ topic: 't', positionA: 'a', positionB: 'b' }, () => 0.9);
  assert.strictEqual(s.sides.A.model, 'nova');
  assert.strictEqual(s.sides.B.model, 'gemini');
});

test('addTurn appends to history and advances FSM', () => {
  _reset();
  const s = createSession({ topic: 't', positionA: 'a', positionB: 'b' }, () => 0);
  addTurn(s.id, { side: 'A', action: 'opening', content: 'first' });
  const after = getSession(s.id);
  assert.strictEqual(after.history.length, 1);
  assert.strictEqual(after.history[0].content, 'first');
  assert.strictEqual(after.fsm.state, 'A_opened');
});

test('expireOlderThan removes stale sessions', () => {
  _reset();
  const s = createSession({ topic: 't', positionA: 'a', positionB: 'b' });
  s.createdAt = Date.now() - 99 * 60 * 1000; // 99 min ago
  expireOlderThan(60 * 60 * 1000); // 1 hour
  assert.throws(() => getSession(s.id), /Session not found/);
});

test('getSession throws on unknown id', () => {
  _reset();
  assert.throws(() => getSession('nope'), /Session not found/);
});
```

- [ ] **Step 2: Run tests, expect failure**

```bash
npm test
```
Expected: failure with `Cannot find module '../src/sessions'`.

- [ ] **Step 3: Implement sessions.js**

```javascript
const { v4: uuidv4 } = require('uuid');
const { initialState, applyAction } = require('./stateMachine');
const { PERSONAS } = require('./personas');

const sessions = new Map();

function _reset() {
  sessions.clear();
}

function createSession({ topic, positionA, positionB }, rng = Math.random) {
  // Random model assignment: gemini on A if rng < 0.5, otherwise gemini on B.
  const geminiOnA = rng() < 0.5;
  const sides = {
    A: {
      position: positionA,
      persona: geminiOnA ? PERSONAS.hanjiho : PERSONAS.leeseoyeon,
      model: geminiOnA ? 'gemini' : 'nova'
    },
    B: {
      position: positionB,
      persona: geminiOnA ? PERSONAS.leeseoyeon : PERSONAS.hanjiho,
      model: geminiOnA ? 'nova' : 'gemini'
    }
  };

  const session = {
    id: uuidv4(),
    topic,
    positionA,
    positionB,
    sides,
    history: [],
    fsm: initialState(),
    createdAt: Date.now()
  };
  sessions.set(session.id, session);
  return session;
}

function getSession(id) {
  const s = sessions.get(id);
  if (!s) throw new Error(`Session not found: ${id}`);
  return s;
}

function addTurn(id, { side, action, content }) {
  const s = getSession(id);
  s.fsm = applyAction(s.fsm, action);
  s.history.push({ side, action, content, timestamp: Date.now() });
  return s;
}

function deleteSession(id) {
  sessions.delete(id);
}

function expireOlderThan(ms) {
  const cutoff = Date.now() - ms;
  for (const [id, s] of sessions.entries()) {
    if (s.createdAt < cutoff) sessions.delete(id);
  }
}

module.exports = {
  createSession,
  getSession,
  addTurn,
  deleteSession,
  expireOlderThan,
  _reset
};
```

- [ ] **Step 4: Run tests, expect pass**

```bash
npm test
```
Expected: 5 passing (sessions) + 6 passing (stateMachine) = 11 total.

- [ ] **Step 5: Commit**

```bash
git add 4.lambda/server/src/sessions.js 4.lambda/server/tests/sessions.test.js
git commit -m "feat(server): in-memory session store with random model assignment"
```

---

### Task 10: server — lambdaClient.js

**Files:**
- Create: `4.lambda/server/src/lambdaClient.js`

- [ ] **Step 1: Write lambdaClient.js**

```javascript
const axios = require('axios');

const GEMINI_LAMBDA_URL = process.env.GEMINI_LAMBDA_URL;
const BEDROCK_LAMBDA_URL = process.env.BEDROCK_LAMBDA_URL;
const TIMEOUT_MS = 15000;

async function invokeLambda({ model, persona, topic, myPosition, opponentPosition, history, action }) {
  const url = model === 'gemini' ? GEMINI_LAMBDA_URL : BEDROCK_LAMBDA_URL;
  if (!url) throw new Error(`Lambda URL for model '${model}' is not configured`);

  // Convert server-side history (with side) to lambda-side history (with self/opponent
  // perspective). The caller already provides perspective-flipped history.

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
```

- [ ] **Step 2: Commit**

```bash
git add 4.lambda/server/src/lambdaClient.js
git commit -m "feat(server): lambda client with timeout + error handling"
```

---

### Task 11: server — db.js + init-db.sql

**Files:**
- Create: `4.lambda/server/scripts/init-db.sql`
- Create: `4.lambda/server/src/db.js`

- [ ] **Step 1: Write init-db.sql**

```sql
CREATE DATABASE IF NOT EXISTS debate_studio
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE debate_studio;

CREATE TABLE IF NOT EXISTS debate_results (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  topic           VARCHAR(255) NOT NULL,
  position_a      VARCHAR(255) NOT NULL,
  position_b      VARCHAR(255) NOT NULL,
  gemini_side     ENUM('a','b') NOT NULL,
  nova_side       ENUM('a','b') NOT NULL,
  user_choice     ENUM('a','b') NOT NULL,
  winner_model    ENUM('gemini','nova') NOT NULL,
  turn_count      INT NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_winner (winner_model),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- [ ] **Step 2: Write db.js**

```javascript
const mysql = require('mysql2/promise');

let pool = null;

function getPool() {
  if (pool) return pool;
  pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'debate_studio',
    waitForConnections: true,
    connectionLimit: 5
  });
  return pool;
}

async function insertResult({ topic, positionA, positionB, geminiSide, novaSide, userChoice, winnerModel, turnCount }) {
  const [r] = await getPool().execute(
    `INSERT INTO debate_results
     (topic, position_a, position_b, gemini_side, nova_side, user_choice, winner_model, turn_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [topic, positionA, positionB, geminiSide, novaSide, userChoice, winnerModel, turnCount]
  );
  return r.insertId;
}

async function getStats() {
  const [rows] = await getPool().execute(
    `SELECT winner_model, COUNT(*) AS wins FROM debate_results GROUP BY winner_model`
  );
  const stats = { gemini: 0, nova: 0 };
  for (const row of rows) stats[row.winner_model] = row.wins;
  const total = stats.gemini + stats.nova;
  return {
    geminiWins: stats.gemini,
    novaWins: stats.nova,
    totalDebates: total,
    geminiWinRate: total ? stats.gemini / total : 0,
    novaWinRate: total ? stats.nova / total : 0
  };
}

async function getRecentResults(limit = 20) {
  const [rows] = await getPool().execute(
    `SELECT id, topic, position_a, position_b, gemini_side, nova_side,
            user_choice, winner_model, turn_count, created_at
     FROM debate_results ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );
  return rows;
}

module.exports = { getPool, insertResult, getStats, getRecentResults };
```

- [ ] **Step 3: Commit**

```bash
git add 4.lambda/server/src/db.js 4.lambda/server/scripts/init-db.sql
git commit -m "feat(server): MySQL pool + result queries + init schema"
```

---

## Phase 3 — Server routes (integration tests)

### Task 12: server — Express app + routes

**Files:**
- Create: `4.lambda/server/src/routes/debate.js`
- Create: `4.lambda/server/src/index.js`
- Create: `4.lambda/server/.env.example`
- Test: `4.lambda/server/tests/debate.routes.test.js`

The routes module exports a function `createRouter({ invokeLambda, db })` so tests can inject mocks.

- [ ] **Step 1: Write the failing integration test**

Create `4.lambda/server/tests/debate.routes.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');
const { createRouter } = require('../src/routes/debate');
const { _reset } = require('../src/sessions');

function buildApp({ invokeLambda, db }) {
  const app = express();
  app.use(express.json());
  app.use('/api/debate', createRouter({ invokeLambda, db }));
  return app;
}

const fakeDb = {
  insertResult: async () => 42,
  getStats: async () => ({
    geminiWins: 5, novaWins: 3, totalDebates: 8,
    geminiWinRate: 5 / 8, novaWinRate: 3 / 8
  }),
  getRecentResults: async () => []
};

test('POST /start creates a session and returns matchup without model names', async () => {
  _reset();
  const app = buildApp({
    invokeLambda: async () => 'unused',
    db: fakeDb
  });
  const res = await request(app).post('/api/debate/start').send({
    topic: '점심', positionA: '짜장면', positionB: '짬뽕'
  });
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.sessionId);
  assert.strictEqual(res.body.state, 'idle');
  assert.deepStrictEqual(res.body.availableActions, ['opening']);
  // The response must NOT leak model names
  const json = JSON.stringify(res.body);
  assert.doesNotMatch(json, /"model"/);
  assert.doesNotMatch(json, /gemini/i);
  assert.doesNotMatch(json, /nova/i);
});

test('POST /:id/turn invokes the lambda and returns content', async () => {
  _reset();
  const calls = [];
  const app = buildApp({
    invokeLambda: async (args) => {
      calls.push(args);
      return '짜장면이야말로 정수입니다.';
    },
    db: fakeDb
  });
  const start = await request(app).post('/api/debate/start').send({
    topic: 't', positionA: 'a', positionB: 'b'
  });
  const sid = start.body.sessionId;

  const turn = await request(app).post(`/api/debate/${sid}/turn`).send({ action: 'opening' });
  assert.strictEqual(turn.status, 200);
  assert.strictEqual(turn.body.content, '짜장면이야말로 정수입니다.');
  assert.strictEqual(turn.body.speaker.side, 'A');
  assert.ok(turn.body.speaker.persona);
  assert.strictEqual(calls.length, 1);
  // Lambda call should never receive 'side' or 'model'
  assert.strictEqual(calls[0].history.length, 0);
  assert.strictEqual(calls[0].action, 'opening');
});

test('POST /:id/turn rejects invalid action with 400', async () => {
  _reset();
  const app = buildApp({ invokeLambda: async () => '', db: fakeDb });
  const start = await request(app).post('/api/debate/start').send({ topic: 't', positionA: 'a', positionB: 'b' });
  const res = await request(app).post(`/api/debate/${start.body.sessionId}/turn`).send({ action: 'rebuttal' });
  assert.strictEqual(res.status, 400);
  assert.match(res.body.error, /not allowed/);
});

test('POST /:id/conclude reveals models and persists result', async () => {
  _reset();
  const inserts = [];
  const app = buildApp({
    invokeLambda: async () => 'turn content',
    db: { ...fakeDb, insertResult: async (row) => { inserts.push(row); return 1; } }
  });
  const start = await request(app).post('/api/debate/start').send({ topic: 't', positionA: 'a', positionB: 'b' });
  const sid = start.body.sessionId;
  // Walk the FSM to ready_to_conclude
  await request(app).post(`/api/debate/${sid}/turn`).send({ action: 'opening' });
  await request(app).post(`/api/debate/${sid}/turn`).send({ action: 'opening' });
  await request(app).post(`/api/debate/${sid}/turn`).send({ action: 'closing' });
  await request(app).post(`/api/debate/${sid}/turn`).send({ action: 'closing' });

  const res = await request(app).post(`/api/debate/${sid}/conclude`).send({ chosenSide: 'A' });
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.chosen.model);
  assert.ok(res.body.passed.model);
  assert.notStrictEqual(res.body.chosen.model, res.body.passed.model);
  assert.strictEqual(res.body.stats.totalDebates, 8);
  assert.strictEqual(inserts.length, 1);
});

test('GET /results returns recent rows + stats', async () => {
  _reset();
  const app = buildApp({ invokeLambda: async () => '', db: fakeDb });
  const res = await request(app).get('/api/debate/results');
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(Object.keys(res.body).sort(), ['recent', 'stats']);
});
```

- [ ] **Step 2: Run tests, expect failure**

```bash
npm test
```
Expected: failure (`Cannot find module '../src/routes/debate'`).

- [ ] **Step 3: Implement routes/debate.js**

Create `4.lambda/server/src/routes/debate.js`:

```javascript
const express = require('express');
const { createSession, getSession, addTurn } = require('../sessions');
const { availableActions } = require('../stateMachine');

function publicSession(s) {
  return {
    sessionId: s.id,
    topic: s.topic,
    matchup: {
      A: { persona: publicPersona(s.sides.A.persona), position: s.sides.A.position },
      B: { persona: publicPersona(s.sides.B.persona), position: s.sides.B.position }
    },
    state: s.fsm.state,
    availableActions: availableActions(s.fsm),
    turnCount: s.fsm.turnCount
  };
}

function publicPersona(p) {
  // Strip color/voice/role internals from API. Reveal name + image only.
  return { id: p.id, name: p.name, image: p.image, color: p.color };
}

function buildHistoryFor(side, fullHistory) {
  // Convert global history to a self/opponent perspective.
  return fullHistory.map(t => ({
    speaker: t.side === side ? 'self' : 'opponent',
    action: t.action,
    content: t.content
  }));
}

function createRouter({ invokeLambda, db }) {
  const router = express.Router();

  router.post('/start', (req, res) => {
    const { topic, positionA, positionB } = req.body || {};
    if (!topic || !positionA || !positionB) {
      return res.status(400).json({ error: 'topic, positionA, positionB are required' });
    }
    const s = createSession({ topic, positionA, positionB });
    return res.json(publicSession(s));
  });

  router.post('/:id/turn', async (req, res) => {
    let s;
    try {
      s = getSession(req.params.id);
    } catch {
      return res.status(404).json({ error: '세션이 만료되었습니다. 새 토론을 시작해주세요.' });
    }
    const { action } = req.body || {};
    const allowed = availableActions(s.fsm);
    if (!allowed.includes(action)) {
      return res.status(400).json({
        error: `현재 단계에서 '${action}' 액션은 사용할 수 없습니다 (not allowed).`,
        availableActions: allowed
      });
    }

    // Determine which side speaks now (from FSM next-speaker rule).
    const { nextSpeaker } = require('../stateMachine');
    const speakerSide = nextSpeaker(s.fsm);
    const speakerInfo = s.sides[speakerSide];
    const opponent = speakerSide === 'A' ? s.sides.B : s.sides.A;

    let content;
    try {
      content = await invokeLambda({
        model: speakerInfo.model,
        persona: speakerInfo.persona,
        topic: s.topic,
        myPosition: speakerInfo.position,
        opponentPosition: opponent.position,
        history: buildHistoryFor(speakerSide, s.history),
        action
      });
    } catch (err) {
      console.error('[debate.turn] lambda error', err);
      return res.status(503).json({ error: 'AI 응답 생성 중 문제가 발생했습니다. 다시 시도해주세요.' });
    }

    addTurn(s.id, { side: speakerSide, action, content });

    return res.json({
      speaker: {
        side: speakerSide,
        persona: publicPersona(speakerInfo.persona)
      },
      action,
      content,
      state: s.fsm.state,
      availableActions: availableActions(s.fsm),
      turnCount: s.fsm.turnCount
    });
  });

  router.post('/:id/conclude', async (req, res) => {
    let s;
    try {
      s = getSession(req.params.id);
    } catch {
      return res.status(404).json({ error: 'Session not found' });
    }
    const { chosenSide } = req.body || {};
    if (chosenSide !== 'A' && chosenSide !== 'B') {
      return res.status(400).json({ error: 'chosenSide must be A or B' });
    }
    const allowed = availableActions(s.fsm);
    if (!allowed.includes('conclude')) {
      return res.status(400).json({ error: 'conclude not allowed yet', availableActions: allowed });
    }

    const passedSide = chosenSide === 'A' ? 'B' : 'A';
    const chosen = s.sides[chosenSide];
    const passed = s.sides[passedSide];

    // Apply FSM
    const { applyAction } = require('../stateMachine');
    s.fsm = applyAction(s.fsm, 'conclude');

    // Persist
    let stats = { geminiWins: 0, novaWins: 0, totalDebates: 0, geminiWinRate: 0, novaWinRate: 0 };
    try {
      await db.insertResult({
        topic: s.topic,
        positionA: s.positionA,
        positionB: s.positionB,
        geminiSide: s.sides.A.model === 'gemini' ? 'a' : 'b',
        novaSide: s.sides.A.model === 'nova' ? 'a' : 'b',
        userChoice: chosenSide.toLowerCase(),
        winnerModel: chosen.model,
        turnCount: s.fsm.turnCount
      });
      stats = await db.getStats();
    } catch (err) {
      console.error('[debate.conclude] db error', err);
    }

    return res.json({
      chosen: {
        side: chosenSide,
        persona: publicPersona(chosen.persona),
        position: chosen.position,
        model: chosen.model
      },
      passed: {
        side: passedSide,
        persona: publicPersona(passed.persona),
        position: passed.position,
        model: passed.model
      },
      stats
    });
  });

  router.get('/results', async (_req, res) => {
    try {
      const [stats, recent] = await Promise.all([db.getStats(), db.getRecentResults()]);
      res.json({ stats, recent });
    } catch (err) {
      console.error('[debate.results] db error', err);
      res.status(500).json({ error: 'failed to fetch results' });
    }
  });

  return router;
}

module.exports = { createRouter };
```

- [ ] **Step 4: Run tests, expect pass**

```bash
npm test
```
Expected: 5 route tests passing + previous tests still passing.

- [ ] **Step 5: Write src/index.js (production entry point)**

```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createRouter } = require('./routes/debate');
const { invokeLambda } = require('./lambdaClient');
const db = require('./db');
const { expireOlderThan } = require('./sessions');

const PORT = process.env.PORT || 4000;
const ONE_HOUR = 60 * 60 * 1000;

const app = express();
app.use(cors());
app.use(express.json({ limit: '64kb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/debate', createRouter({ invokeLambda, db }));

// Periodic session cleanup
setInterval(() => expireOlderThan(ONE_HOUR), 5 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
```

- [ ] **Step 6: Write .env.example**

```
PORT=4000
GEMINI_LAMBDA_URL=https://your-lambda-url.lambda-url.us-east-1.on.aws/
BEDROCK_LAMBDA_URL=https://your-other-lambda-url.lambda-url.us-east-1.on.aws/
DB_HOST=your-rds-endpoint.rds.amazonaws.com
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=
DB_NAME=debate_studio
```

- [ ] **Step 7: Commit**

```bash
git add 4.lambda/server/src/routes/debate.js 4.lambda/server/src/index.js \
        4.lambda/server/.env.example 4.lambda/server/tests/debate.routes.test.js
git commit -m "feat(server): debate routes (start/turn/conclude/results) + entry point"
```

---

## Phase 4 — React client

### Task 13: client — package.json + clean slate

**Files:**
- Modify: `4.lambda/client/package.json`
- Modify: `4.lambda/client/public/index.html`

- [ ] **Step 1: Replace package.json**

```json
{
  "name": "client",
  "version": "0.2.0",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1",
    "uuid": "^9.0.1"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test --watchAll=false",
    "eject": "react-scripts eject"
  },
  "proxy": "http://localhost:4000",
  "eslintConfig": {
    "extends": ["react-app"]
  },
  "browserslist": {
    "production": [">0.2%", "not dead", "not op_mini all"],
    "development": ["last 1 chrome version", "last 1 firefox version", "last 1 safari version"]
  }
}
```

- [ ] **Step 2: Update index.html title**

Open `4.lambda/client/public/index.html`, find the `<title>` line, replace with:

```html
<title>AI Debate Studio</title>
```

- [ ] **Step 3: Install**

```bash
cd 4.lambda/client
rm -rf node_modules package-lock.json
npm install
```

- [ ] **Step 4: Commit**

```bash
git add 4.lambda/client/package.json 4.lambda/client/package-lock.json 4.lambda/client/public/index.html
git commit -m "chore(client): clean dependencies, update title, set proxy to 4000"
```

---

### Task 14: client — global styles.css

**Files:**
- Create: `4.lambda/client/src/styles.css`

- [ ] **Step 1: Write styles.css**

```css
/* AI Debate Studio — global theme */
:root {
  --bg-0: #0d0d12;
  --bg-1: #16161e;
  --bg-2: #1a1a22;
  --bg-3: #0f0f16;
  --border-1: #2a2a35;
  --border-2: #1f1f28;
  --text-0: #ffffff;
  --text-1: #e5e5e5;
  --text-2: #aaaaaa;
  --text-3: #666666;
  --text-4: #555555;
  --red: #ef4444;
  --red-soft: #3a1414;
  --blue: #3b82f6;
  --blue-soft: #0a1a3a;
  --gold: #fbbf24;
  --max-width: 720px;
  --serif: Georgia, "Times New Roman", serif;
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
}

* { box-sizing: border-box; }

html, body, #root {
  margin: 0;
  padding: 0;
  background: var(--bg-0);
  color: var(--text-1);
  font-family: var(--sans);
  min-height: 100vh;
}

.app-shell {
  display: flex;
  justify-content: center;
  padding: 32px 16px;
}

.column {
  width: 100%;
  max-width: var(--max-width);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* HEADER */
.live-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  border-radius: 8px;
}
.live-bar .live-pulse { width: 6px; height: 6px; background: var(--red); border-radius: 50%; }
.live-bar .label { display: flex; align-items: center; gap: 8px; font-size: 10px; color: var(--text-2); letter-spacing: 2px; font-weight: 600; }
.live-bar .topic { font-size: 13px; color: var(--text-0); font-family: var(--serif); font-style: italic; font-weight: 600; }
.live-bar .meta { font-size: 10px; color: var(--text-3); }

/* MATCHUP MINI BAR */
.matchup { display: flex; justify-content: center; gap: 14px; align-items: center; padding: 6px 0; }
.matchup .side { display: flex; align-items: center; gap: 6px; }
.matchup .avatar { width: 24px; height: 24px; border-radius: 50%; background-size: cover; background-position: top center; }
.matchup .avatar.red { border: 1.5px solid var(--red); }
.matchup .avatar.blue { border: 1.5px solid var(--blue); }
.matchup .name { font-size: 11px; color: var(--text-0); font-weight: 700; }
.matchup .ai { font-size: 9px; color: var(--text-3); font-style: italic; }
.matchup .vs { font-size: 10px; color: var(--text-4); letter-spacing: 1px; }

/* SPEAKER CARD */
.speaker-card {
  background: linear-gradient(135deg, var(--bg-1) 0%, var(--bg-3) 100%);
  border: 1px solid var(--border-1);
  border-radius: 10px;
  padding: 18px;
  display: flex;
  gap: 16px;
  align-items: stretch;
  position: relative;
  overflow: hidden;
  min-height: 180px;
}
.speaker-card .glow {
  position: absolute; top: 0; right: -50px; bottom: 0; width: 200px;
  pointer-events: none;
}
.speaker-card.red .glow { background: radial-gradient(ellipse at right, rgba(239,68,68,0.10) 0%, transparent 70%); }
.speaker-card.blue .glow { background: radial-gradient(ellipse at right, rgba(59,130,246,0.10) 0%, transparent 70%); }
.speaker-card .photo {
  flex: 0 0 120px; height: 150px; border-radius: 6px;
  background-size: cover; background-position: top center;
  position: relative; z-index: 1;
}
.speaker-card.red .photo { border-top: 2px solid var(--red); }
.speaker-card.blue .photo { border-top: 2px solid var(--blue); }
.speaker-card .body { flex: 1; position: relative; z-index: 1; min-width: 0; }
.speaker-card .meta-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.speaker-card .speaker-name { font-size: 11px; font-weight: 700; letter-spacing: 1px; }
.speaker-card.red .speaker-name { color: var(--red); }
.speaker-card.blue .speaker-name { color: var(--blue); }
.speaker-card .action-tag { font-size: 10px; color: var(--text-2); text-transform: uppercase; letter-spacing: 1px; }
.speaker-card .speech { font-size: 13px; color: var(--text-1); line-height: 1.6; margin: 0; font-family: var(--serif); }
.speaker-card .empty { color: var(--text-4); font-style: italic; font-family: var(--sans); }
.speaker-card .loading { display: flex; align-items: center; gap: 6px; margin-top: 12px; font-size: 9px; color: var(--text-3); }
.speaker-card .dot { width: 4px; height: 4px; background: var(--text-3); border-radius: 50%; animation: pulse 1.4s infinite; }
.speaker-card .dot:nth-child(2) { animation-delay: 0.2s; }
.speaker-card .dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes pulse { 0%,80%,100% { opacity: 0.3; } 40% { opacity: 1; } }

/* HISTORY CHIPS */
.history { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
.history .chip {
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  border-radius: 3px;
  padding: 4px 8px;
  font-size: 9px;
  color: var(--text-2);
  cursor: default;
}
.history .chip.red { border-left: 2px solid var(--red); }
.history .chip.blue { border-left: 2px solid var(--blue); }
.history .chip.active { color: var(--text-0); border: 1px solid var(--gold); }
.history .chip .name { font-weight: 700; }
.history .chip.red .name { color: var(--red); }
.history .chip.blue .name { color: var(--blue); }

/* ACTION BLOCKS */
.action-panel {
  background: var(--bg-3);
  border: 1px solid var(--border-1);
  border-radius: 8px;
  padding: 12px 14px;
}
.action-panel .label-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.action-panel .label { font-size: 9px; color: var(--text-3); letter-spacing: 1.5px; text-transform: uppercase; }
.action-panel .next { font-size: 9px; color: var(--text-4); }
.action-panel .grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }
.action-panel .block {
  background: var(--bg-1);
  border: 1px solid var(--border-1);
  color: var(--text-4);
  font-size: 9px;
  padding: 10px 4px;
  border-radius: 5px;
  text-align: center;
  cursor: not-allowed;
  font-family: inherit;
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: center;
}
.action-panel .block .icon { font-size: 14px; }
.action-panel .block.active {
  background: linear-gradient(135deg, var(--blue-soft) 0%, #061230 100%);
  border-color: var(--blue);
  color: var(--text-0);
  cursor: pointer;
  box-shadow: 0 0 6px rgba(59,130,246,0.25);
}
.action-panel .block.active.conclude {
  background: linear-gradient(135deg, #3a2a08 0%, #1a1408 100%);
  border-color: var(--gold);
  color: var(--gold);
  box-shadow: 0 0 6px rgba(251,191,36,0.25);
}

/* START SCREEN */
.brand-header { text-align: center; padding: 20px 0 8px 0; }
.brand-header .super { font-size: 11px; color: var(--text-3); letter-spacing: 4px; text-transform: uppercase; }
.brand-header h1 { font-size: 28px; color: var(--text-0); margin: 6px 0 4px 0; font-family: var(--serif); font-weight: 600; letter-spacing: -0.5px; }
.brand-header p { font-size: 12px; color: var(--text-2); margin: 0; }

.persona-preview { display: flex; justify-content: center; gap: 14px; align-items: center; padding: 14px 0; border-top: 1px solid var(--border-2); border-bottom: 1px solid var(--border-2); }
.persona-preview .pp { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.persona-preview .pp .photo { width: 64px; height: 80px; border-radius: 4px; background-size: cover; background-position: top center; }
.persona-preview .pp.red .photo { border-top: 2px solid var(--red); }
.persona-preview .pp.blue .photo { border-top: 2px solid var(--blue); }
.persona-preview .pp .name { font-size: 11px; color: var(--text-0); font-weight: 700; }
.persona-preview .pp .role { font-size: 9px; color: var(--text-2); }
.persona-preview .vs { font-size: 12px; color: var(--text-4); font-family: var(--serif); font-style: italic; }

.form { display: flex; flex-direction: column; gap: 10px; }
.form .field { display: flex; flex-direction: column; gap: 4px; }
.form .field-label { font-size: 9px; color: var(--text-3); letter-spacing: 1.5px; text-transform: uppercase; }
.form .field.red .field-label { color: var(--red); }
.form .field.blue .field-label { color: var(--blue); }
.form input, .form textarea {
  background: var(--bg-1);
  border: 1px solid var(--border-1);
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 13px;
  color: var(--text-0);
  font-family: var(--serif);
  width: 100%;
}
.form .field.red input { border-left: 2px solid var(--red); }
.form .field.blue input { border-right: 2px solid var(--blue); }
.form .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

button.primary {
  background: linear-gradient(135deg, #ffffff 0%, #dddddd 100%);
  color: #000;
  border: none;
  border-radius: 6px;
  padding: 14px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 1px;
  cursor: pointer;
  text-transform: uppercase;
  font-family: inherit;
}
button.primary:disabled { opacity: 0.5; cursor: not-allowed; }
button.ghost {
  background: transparent;
  color: var(--text-2);
  border: 1px solid var(--border-1);
  border-radius: 6px;
  padding: 12px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
  cursor: pointer;
  text-transform: uppercase;
  font-family: inherit;
}

/* RESULT SCREEN */
.verdict-header { text-align: center; padding: 8px 0; }
.verdict-header .label { font-size: 10px; color: var(--gold); letter-spacing: 3px; text-transform: uppercase; }
.verdict-header h2 { font-size: 22px; color: var(--text-0); margin: 4px 0; font-family: var(--serif); font-weight: 600; }
.verdict-header .topic { font-size: 11px; color: var(--text-2); margin: 0; font-family: var(--serif); font-style: italic; }

.winner-card {
  background: linear-gradient(135deg, var(--bg-1) 0%, var(--bg-3) 100%);
  border: 1px solid var(--gold);
  border-radius: 10px;
  padding: 18px;
  display: flex;
  gap: 16px;
  align-items: center;
  position: relative;
  overflow: hidden;
  box-shadow: 0 0 24px rgba(251,191,36,0.15);
}
.winner-card .photo { flex: 0 0 90px; height: 115px; border-radius: 6px; background-size: cover; background-position: top center; }
.winner-card.red .photo { border-top: 2px solid var(--red); }
.winner-card.blue .photo { border-top: 2px solid var(--blue); }
.winner-card .body { flex: 1; }
.winner-card .badges { display: flex; align-items: center; gap: 6px; }
.winner-card .badge-chosen { font-size: 9px; color: var(--gold); letter-spacing: 2px; font-weight: 700; }
.winner-card .badge-revealed { background: rgba(251,191,36,0.15); border: 1px solid var(--gold); color: var(--gold); font-size: 8px; padding: 2px 6px; border-radius: 99px; letter-spacing: 1px; font-weight: 700; }
.winner-card .name { font-size: 18px; color: var(--text-0); font-weight: 700; font-family: var(--serif); margin-top: 4px; }
.winner-card .meta-row { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.winner-card .position { font-size: 11px; color: var(--text-2); }
.winner-card .model-badge { font-size: 10px; padding: 3px 8px; border-radius: 4px; font-weight: 800; letter-spacing: 1px; color: #fff; }
.winner-card .model-badge.gemini { background: var(--red); }
.winner-card .model-badge.nova { background: var(--blue); }

.loser-card {
  background: var(--bg-3);
  border: 1px solid var(--border-2);
  border-radius: 10px;
  padding: 14px;
  display: flex;
  gap: 14px;
  align-items: center;
  opacity: 0.65;
}
.loser-card .photo { flex: 0 0 60px; height: 75px; border-radius: 5px; background-size: cover; background-position: top center; }
.loser-card.red .photo { border-top: 1.5px solid var(--red); }
.loser-card.blue .photo { border-top: 1.5px solid var(--blue); }
.loser-card .body { flex: 1; }
.loser-card .name { font-size: 11px; color: var(--text-2); font-weight: 700; }
.loser-card .meta-row { display: flex; align-items: center; gap: 6px; margin-top: 3px; }
.loser-card .small-badge { font-size: 9px; padding: 2px 6px; border-radius: 4px; font-weight: 700; letter-spacing: 1px; }
.loser-card .small-badge.gemini { background: rgba(239,68,68,0.2); color: #fca5a5; }
.loser-card .small-badge.nova { background: rgba(59,130,246,0.2); color: #93c5fd; }
.loser-card .passed { font-size: 9px; color: var(--text-3); letter-spacing: 1px; }

.matchup-summary { background: var(--bg-3); border: 1px solid var(--border-1); border-radius: 8px; padding: 12px 14px; text-align: center; }
.matchup-summary .label { font-size: 9px; color: var(--text-3); letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 6px; }
.matchup-summary .line { font-size: 12px; color: var(--text-1); }
.matchup-summary .red { color: var(--red); font-weight: 700; }
.matchup-summary .blue { color: var(--blue); font-weight: 700; }

.stats { background: var(--bg-3); border: 1px solid var(--border-1); border-radius: 8px; padding: 14px; }
.stats .label { font-size: 9px; color: var(--text-3); letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 10px; }
.stats .row { display: flex; align-items: center; gap: 10px; }
.stats .label-cell { font-size: 11px; font-weight: 700; width: 70px; }
.stats .label-cell.gemini { color: var(--red); }
.stats .label-cell.nova { color: var(--blue); }
.stats .bar { flex: 1; background: var(--bg-2); border-radius: 99px; height: 8px; overflow: hidden; display: flex; }
.stats .bar .gemini { background: var(--red); }
.stats .bar .nova { background: var(--blue); }
.stats .nums { display: flex; justify-content: space-between; margin-top: 6px; font-size: 11px; }
.stats .nums .gemini { color: var(--red); font-weight: 700; }
.stats .nums .nova { color: var(--blue); font-weight: 700; }
.stats .nums .total { color: var(--text-3); font-size: 9px; }

.error-banner {
  background: rgba(239,68,68,0.1);
  border: 1px solid var(--red);
  color: #fca5a5;
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 12px;
}

.blind-hint {
  text-align: center;
  padding: 8px 14px;
  background: rgba(251,191,36,0.06);
  border: 1px dashed rgba(251,191,36,0.3);
  border-radius: 6px;
  font-size: 11px;
  color: var(--gold);
  font-style: italic;
}
```

- [ ] **Step 2: Commit**

```bash
git add 4.lambda/client/src/styles.css
git commit -m "feat(client): full theme stylesheet (TV debate studio dark)"
```

---

### Task 15: client — api/debate.js

**Files:**
- Create: `4.lambda/client/src/api/debate.js`

- [ ] **Step 1: Write the API client**

```javascript
const BASE = '/api/debate';

async function jsonPost(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

async function jsonGet(path) {
  const res = await fetch(BASE + path);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  start: ({ topic, positionA, positionB }) =>
    jsonPost('/start', { topic, positionA, positionB }),
  turn: (sessionId, action) =>
    jsonPost(`/${sessionId}/turn`, { action }),
  conclude: (sessionId, chosenSide) =>
    jsonPost(`/${sessionId}/conclude`, { chosenSide }),
  results: () => jsonGet('/results')
};
```

- [ ] **Step 2: Commit**

```bash
git add 4.lambda/client/src/api/debate.js
git commit -m "feat(client): API client for debate endpoints"
```

---

### Task 16: client — components (StartScreen, MainScreen, ResultScreen, App)

**Files:**
- Create: `4.lambda/client/src/components/StartScreen.jsx`
- Create: `4.lambda/client/src/components/MainScreen.jsx`
- Create: `4.lambda/client/src/components/ResultScreen.jsx`
- Create: `4.lambda/client/src/App.jsx`
- Modify: `4.lambda/client/src/index.js`

- [ ] **Step 1: Write StartScreen.jsx**

```jsx
import { useState } from 'react';

export function StartScreen({ onStart }) {
  const [topic, setTopic] = useState('');
  const [positionA, setPositionA] = useState('');
  const [positionB, setPositionB] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const canStart = topic.trim() && positionA.trim() && positionB.trim() && !busy;

  async function handleStart() {
    if (!canStart) return;
    setBusy(true);
    setError('');
    try {
      await onStart({ topic: topic.trim(), positionA: positionA.trim(), positionB: positionB.trim() });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="column">
      <header className="brand-header">
        <div className="super">AI Debate Studio</div>
        <h1>두 AI의 토론을 중재하세요</h1>
        <p>주제를 던지고, 두 캐릭터의 공방을 듣고, 당신만의 결론을 내리세요</p>
      </header>

      <div className="persona-preview">
        <div className="pp red">
          <div className="photo" style={{ backgroundImage: 'url(/personas/gemini.png)' }} />
          <div className="name">한지호</div>
          <div className="role">전직 변호사</div>
        </div>
        <div className="vs">vs</div>
        <div className="pp blue">
          <div className="photo" style={{ backgroundImage: 'url(/personas/nova.png)' }} />
          <div className="name">이서연</div>
          <div className="role">전직 기자</div>
        </div>
      </div>

      <div className="form">
        <div className="field">
          <div className="field-label">토론 주제</div>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="예: 점심 메뉴 논쟁" />
        </div>
        <div className="row">
          <div className="field red">
            <div className="field-label">입장 A</div>
            <input value={positionA} onChange={(e) => setPositionA(e.target.value)} placeholder="예: 짜장면이 최고" />
          </div>
          <div className="field blue">
            <div className="field-label">입장 B</div>
            <input value={positionB} onChange={(e) => setPositionB(e.target.value)} placeholder="예: 짬뽕이 최고" />
          </div>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <button className="primary" disabled={!canStart} onClick={handleStart}>
        {busy ? '세션 생성 중…' : '▶ 토론 시작 (포지션 랜덤 배정)'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Write MainScreen.jsx**

```jsx
import { useState } from 'react';

const ACTION_LABELS = {
  opening:          { icon: '▶️', label: '오프닝' },
  rebuttal:         { icon: '🔁', label: '반박' },
  example:          { icon: '💡', label: '예시' },
  counter_rebuttal: { icon: '🔥', label: '재반박' },
  closing:          { icon: '🎤', label: '마무리' },
  conclude:         { icon: '🏁', label: '결론' }
};
const ACTION_ORDER = ['opening', 'rebuttal', 'example', 'counter_rebuttal', 'closing', 'conclude'];

export function MainScreen({ session, currentTurn, onAction, onConclude, busy, error }) {
  const [chosenSide, setChosenSide] = useState(null);
  const available = new Set(session.availableActions);

  function handleClick(action) {
    if (busy) return;
    if (action === 'conclude') {
      // Show inline conclude picker (handled below)
      return;
    }
    if (!available.has(action)) return;
    onAction(action);
  }

  // Determine which side card to render. If a turn just happened, show it; otherwise show "waiting".
  const speakerCard = currentTurn ? renderSpeaker(currentTurn, session) : renderEmpty();

  return (
    <div className="column">
      <div className="live-bar">
        <div className="label">
          <div className="live-pulse" />
          <span>DEBATE · LIVE</span>
        </div>
        <div className="topic">"{session.topic}"</div>
        <div className="meta">{session.turnCount} turn</div>
      </div>

      <div className="matchup">
        <div className="side">
          <div className="avatar red" style={{ backgroundImage: `url(${session.matchup.A.persona.image})` }} />
          <div>
            <div className="name">{session.matchup.A.persona.name}</div>
            <div className="ai">??? AI</div>
          </div>
        </div>
        <div className="vs">vs</div>
        <div className="side">
          <div style={{ textAlign: 'right' }}>
            <div className="name">{session.matchup.B.persona.name}</div>
            <div className="ai">??? AI</div>
          </div>
          <div className="avatar blue" style={{ backgroundImage: `url(${session.matchup.B.persona.image})` }} />
        </div>
      </div>

      {speakerCard}

      <div className="blind-hint">🎭 어느 쪽이 Gemini이고 어느 쪽이 Nova인지는 토론이 끝나야 공개됩니다</div>

      {error && <div className="error-banner">{error}</div>}

      {available.has('conclude') ? (
        <div className="action-panel">
          <div className="label-row">
            <div className="label">중재자 결정</div>
          </div>
          <p style={{ fontSize: 12, color: '#aaa', margin: '0 0 10px 0' }}>두 사람의 발언을 모두 들었습니다. 어느 입장에 더 설득됐나요?</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button className="ghost" style={{ borderColor: '#ef4444', color: '#fca5a5' }} disabled={busy} onClick={() => onConclude('A')}>
              A · {session.matchup.A.position}
            </button>
            <button className="ghost" style={{ borderColor: '#3b82f6', color: '#93c5fd' }} disabled={busy} onClick={() => onConclude('B')}>
              B · {session.matchup.B.position}
            </button>
          </div>
        </div>
      ) : (
        <div className="action-panel">
          <div className="label-row">
            <div className="label">중재자 컨트롤</div>
            <div className="next">다음: {nextLabel(session)}</div>
          </div>
          <div className="grid">
            {ACTION_ORDER.map((action) => {
              const isActive = available.has(action);
              return (
                <button
                  key={action}
                  className={`block ${isActive ? 'active' : ''}`}
                  disabled={!isActive || busy}
                  onClick={() => handleClick(action)}
                >
                  <span className="icon">{ACTION_LABELS[action].icon}</span>
                  <span>{ACTION_LABELS[action].label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function nextLabel(session) {
  // Estimate next speaker side from FSM. Server is source of truth, so just hint.
  if (session.state === 'idle') return `${session.matchup.A.persona.name} 차례`;
  if (session.state === 'A_opened') return `${session.matchup.B.persona.name} 차례`;
  return '교차 진행 중';
}

function renderSpeaker(turn, session) {
  const side = turn.speaker.side;
  const persona = session.matchup[side].persona;
  const colorClass = side === 'A' ? 'red' : 'blue';
  return (
    <div className={`speaker-card ${colorClass}`}>
      <div className="glow" />
      <div className="photo" style={{ backgroundImage: `url(${persona.image})` }} />
      <div className="body">
        <div className="meta-row">
          <span className="speaker-name">{persona.name}</span>
          <span style={{ color: '#666' }}>·</span>
          <span className="action-tag">{turn.action}</span>
        </div>
        <p className="speech">{turn.content}</p>
      </div>
    </div>
  );
}

function renderEmpty() {
  return (
    <div className="speaker-card">
      <div className="body">
        <p className="speech empty">중재자 컨트롤에서 [오프닝]을 눌러 토론을 시작하세요.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write ResultScreen.jsx**

```jsx
export function ResultScreen({ session, result, onRestart }) {
  const chosen = result.chosen;
  const passed = result.passed;
  const stats = result.stats;
  const chosenColorClass = chosen.side === 'A' ? 'red' : 'blue';
  const passedColorClass = passed.side === 'A' ? 'red' : 'blue';
  const formatPct = (n) => `${Math.round(n * 100)}%`;

  return (
    <div className="column">
      <div className="verdict-header">
        <div className="label">VERDICT · REVEAL</div>
        <h2>중재자의 결정</h2>
        <p className="topic">"{session.topic}"</p>
      </div>

      <div className={`winner-card ${chosenColorClass}`}>
        <div className="photo" style={{ backgroundImage: `url(${chosen.persona.image})` }} />
        <div className="body">
          <div className="badges">
            <span className="badge-chosen">CHOSEN</span>
            <span className="badge-revealed">REVEALED</span>
          </div>
          <div className="name">{chosen.persona.name}</div>
          <div className="meta-row">
            <span className="position">{chosen.position}</span>
            <span style={{ width: 3, height: 3, background: '#555', borderRadius: '50%' }} />
            <span className={`model-badge ${chosen.model}`}>
              {chosen.model === 'gemini' ? '⚡ GEMINI' : 'NOVA'}
            </span>
          </div>
        </div>
      </div>

      <div className={`loser-card ${passedColorClass}`}>
        <div className="photo" style={{ backgroundImage: `url(${passed.persona.image})` }} />
        <div className="body">
          <div className="name">{passed.persona.name}</div>
          <div className="meta-row">
            <span style={{ fontSize: 9, color: '#666' }}>{passed.position}</span>
            <span style={{ width: 3, height: 3, background: '#444', borderRadius: '50%' }} />
            <span className={`small-badge ${passed.model}`}>
              {passed.model === 'gemini' ? '⚡ GEMINI' : 'NOVA'}
            </span>
          </div>
        </div>
        <span className="passed">PASSED</span>
      </div>

      <div className="matchup-summary">
        <div className="label">이번 토론 매치업</div>
        <div className="line">
          <span className={chosen.side === 'A' ? chosen.model : passed.model}>
            {session.matchup.A.persona.name} = {sideToModel(session, 'A', chosen, passed).toUpperCase()}
          </span>
          <span style={{ color: '#555', margin: '0 8px' }}>·</span>
          <span className={chosen.side === 'B' ? chosen.model : passed.model}>
            {session.matchup.B.persona.name} = {sideToModel(session, 'B', chosen, passed).toUpperCase()}
          </span>
        </div>
      </div>

      <div className="stats">
        <div className="label">역대 누적 승률 (모델 기준)</div>
        <div className="row">
          <div className="label-cell gemini">⚡ Gemini</div>
          <div className="bar">
            <div className="gemini" style={{ width: `${stats.geminiWinRate * 100}%` }} />
            <div className="nova" style={{ width: `${stats.novaWinRate * 100}%` }} />
          </div>
          <div className="label-cell nova" style={{ textAlign: 'right' }}>Nova</div>
        </div>
        <div className="nums">
          <div className="gemini">{formatPct(stats.geminiWinRate)} ({stats.geminiWins}승)</div>
          <div className="total">전체 {stats.totalDebates}회</div>
          <div className="nova">{formatPct(stats.novaWinRate)} ({stats.novaWins}승)</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button className="primary" onClick={onRestart}>새 토론 시작</button>
        <button className="ghost" onClick={onRestart}>처음으로</button>
      </div>
    </div>
  );
}

function sideToModel(session, side, chosen, passed) {
  if (chosen.side === side) return chosen.model;
  if (passed.side === side) return passed.model;
  return '???';
}
```

- [ ] **Step 4: Write App.jsx**

```jsx
import { useState } from 'react';
import { api } from './api/debate';
import { StartScreen } from './components/StartScreen';
import { MainScreen } from './components/MainScreen';
import { ResultScreen } from './components/ResultScreen';

export default function App() {
  const [phase, setPhase] = useState('start');   // 'start' | 'main' | 'result'
  const [session, setSession] = useState(null);
  const [currentTurn, setCurrentTurn] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function startSession({ topic, positionA, positionB }) {
    const s = await api.start({ topic, positionA, positionB });
    setSession({ ...s });
    setCurrentTurn(null);
    setPhase('main');
  }

  async function takeAction(action) {
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      const r = await api.turn(session.sessionId, action);
      setCurrentTurn({ speaker: r.speaker, action: r.action, content: r.content });
      setSession((prev) => ({
        ...prev,
        state: r.state,
        availableActions: r.availableActions,
        turnCount: r.turnCount
      }));
    } catch (err) {
      setError(err.message || 'turn failed');
    } finally {
      setBusy(false);
    }
  }

  async function concludeDebate(chosenSide) {
    setBusy(true);
    setError('');
    try {
      const r = await api.conclude(session.sessionId, chosenSide);
      setResult(r);
      setPhase('result');
    } catch (err) {
      setError(err.message || 'conclude failed');
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    setSession(null);
    setCurrentTurn(null);
    setResult(null);
    setError('');
    setPhase('start');
  }

  return (
    <div className="app-shell">
      {phase === 'start' && <StartScreen onStart={startSession} />}
      {phase === 'main' && session && (
        <MainScreen
          session={session}
          currentTurn={currentTurn}
          onAction={takeAction}
          onConclude={concludeDebate}
          busy={busy}
          error={error}
        />
      )}
      {phase === 'result' && session && result && (
        <ResultScreen session={session} result={result} onRestart={restart} />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Update src/index.js**

Replace contents of `4.lambda/client/src/index.js`:

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);
```

- [ ] **Step 6: Verify build**

```bash
cd 4.lambda/client
npm run build
```
Expected: build succeeds, output in `build/`. (Warnings OK, errors are not.)

- [ ] **Step 7: Commit**

```bash
git add 4.lambda/client/src/
git commit -m "feat(client): start/main/result screens + App entry"
```

---

## Phase 5 — Local integration check

### Task 17: Local end-to-end smoke test (with stub lambdas)

**Goal:** Run the server with stub lambda URLs, hit the API, and confirm the FSM walks all the way to conclude.

- [ ] **Step 1: Create a temporary stub lambda script**

Create `4.lambda/server/scripts/stub-lambda.js`:

```javascript
// Tiny HTTP stub that pretends to be both lambdas. Run on port 9999.
const http = require('http');

const responses = {
  opening:          (b) => `${b.persona.name}로서 ${b.myPosition}에 대한 첫 발언입니다. 핵심 근거는 단순합니다.`,
  rebuttal:         (b) => `${b.persona.name}의 반박: 상대 주장에는 핵심 약점이 있습니다.`,
  example:          (b) => `${b.persona.name}: 구체적인 사례를 하나 들어보겠습니다.`,
  counter_rebuttal: (b) => `${b.persona.name}의 재반박: 다시 한번 짚어드리죠.`,
  closing:          (b) => `${b.persona.name}의 마무리: 결국 ${b.myPosition}이 답입니다.`
};

http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const payload = JSON.parse(body || '{}');
    const fn = responses[payload.action] || ((b) => `(${payload.action})`);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ content: fn(payload) }));
  });
}).listen(9999, () => console.log('[stub] http://localhost:9999'));
```

- [ ] **Step 2: Run stub + server in two terminals**

Terminal 1 (stub):
```bash
cd 4.lambda/server
node scripts/stub-lambda.js
```

Terminal 2 (server, with stub URLs):
```bash
cd 4.lambda/server
GEMINI_LAMBDA_URL=http://localhost:9999 \
BEDROCK_LAMBDA_URL=http://localhost:9999 \
DB_HOST=skip DB_USER=skip DB_PASSWORD=skip \
node src/index.js
```
Expected: `[server] listening on http://localhost:4000`. (DB queries will fail; conclude will still respond, just stats will be zero.)

- [ ] **Step 3: Walk the FSM via curl**

```bash
SESSION=$(curl -s -X POST http://localhost:4000/api/debate/start \
  -H 'content-type: application/json' \
  -d '{"topic":"점심","positionA":"짜장면","positionB":"짬뽕"}' | python3 -c "import sys, json; print(json.load(sys.stdin)['sessionId'])")
echo $SESSION

for ACTION in opening opening closing closing; do
  curl -s -X POST http://localhost:4000/api/debate/$SESSION/turn \
    -H 'content-type: application/json' \
    -d "{\"action\":\"$ACTION\"}" | python3 -m json.tool
done

curl -s -X POST http://localhost:4000/api/debate/$SESSION/conclude \
  -H 'content-type: application/json' \
  -d '{"chosenSide":"A"}' | python3 -m json.tool
```
Expected: each turn returns `{ speaker, content, state, availableActions }`. Final conclude returns `{ chosen, passed, stats }` with both models present.

- [ ] **Step 4: Run the React app and click through manually**

In a third terminal:
```bash
cd 4.lambda/client
npm start
```
Expected: browser opens at `http://localhost:3000`. Fill the start form → click 토론 시작 → click 오프닝 twice → click 마무리 twice → click 결론 → pick A or B → see the reveal screen with stub content.

- [ ] **Step 5: Stop stub + commit**

```bash
git add 4.lambda/server/scripts/stub-lambda.js
git commit -m "chore(server): add stub lambda script for local e2e smoke test"
```

---

## Phase 6 — AWS deployment

> **Important:** Steps below are AWS-console heavy. Each step assumes the operator can read AWS messages and click through dialogs. For each substep, the plan describes what to do; verify visually as you go.

### Task 18: Enable Bedrock model access

- [ ] **Step 1: Enable Nova Lite**

Open AWS Console → Bedrock → Model access → Edit → enable **Amazon Nova Lite** in your chosen region (e.g., `us-east-1`). Submit. Wait for "Access granted" status.

- [ ] **Step 2: Verify access via CLI**

```bash
aws bedrock list-foundation-models --region us-east-1 \
  --query "modelSummaries[?contains(modelId, 'nova-lite')].modelId" --output text
```
Expected: prints `amazon.nova-lite-v1:0` (or similar versioned id).

---

### Task 19: Deploy bedrock-lambda

- [ ] **Step 1: Package the function**

```bash
cd 4.lambda/bedrock-lambda
zip -j function.zip lambda_function.py prompts.py
```

- [ ] **Step 2: Create the Lambda**

Console → Lambda → Create function → Author from scratch
- Name: `debate-bedrock`
- Runtime: Python 3.11
- Architecture: x86_64
- Permissions: Create new role with basic Lambda permissions

After create:
- Code source → Upload from .zip → upload `function.zip`
- Configuration → General → Timeout: **30 sec**, Memory: **256 MB**
- Configuration → Environment variables → add `BEDROCK_MODEL_ID=amazon.nova-lite-v1:0`
- Configuration → Permissions → click the role → add inline policy:
  ```json
  {
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": "bedrock:InvokeModel",
      "Resource": "arn:aws:bedrock:*::foundation-model/amazon.nova-lite-v1:0"
    }]
  }
  ```

- [ ] **Step 3: Enable Function URL**

Configuration → Function URL → Create function URL → Auth: NONE → Save. Copy the URL (looks like `https://abc123xyz.lambda-url.us-east-1.on.aws/`).

- [ ] **Step 4: Test from console**

In Lambda console, Test tab → create new event with:
```json
{
  "body": "{\"persona\":{\"name\":\"한지호\",\"role\":\"전직 변호사\",\"voice\":\"직설적\"},\"topic\":\"점심\",\"myPosition\":\"짜장면\",\"opponentPosition\":\"짬뽕\",\"history\":[],\"action\":\"opening\"}"
}
```
Run. Expected: `statusCode 200`, `body` contains `content` field with Korean text.

---

### Task 20: Deploy gemini-lambda

- [ ] **Step 1: Get a Gemini API key**

Visit https://aistudio.google.com → Get API key → Create new project → copy key. Save to a private note (NEVER commit).

- [ ] **Step 2: Package the function**

```bash
cd 4.lambda/gemini-lambda
npm install --omit=dev
zip -r function.zip index.js prompts.js node_modules package.json
```

- [ ] **Step 3: Create the Lambda**

Console → Lambda → Create function
- Name: `debate-gemini`
- Runtime: Node.js 20.x
- After create: Upload .zip
- Configuration → Timeout 30 sec, Memory 256 MB
- Environment variables: `GEMINI_API_KEY=<your key>`, `GEMINI_MODEL=gemini-2.5-flash`
- Function URL → Auth: NONE → copy URL

- [ ] **Step 4: Test from console**

Same test event as Task 19. Expected: 200 response with Korean content.

---

### Task 21: Provision RDS MySQL + run schema

- [ ] **Step 1: Create RDS instance**

Console → RDS → Create database → Standard → MySQL → Free tier template (or Dev/Test for db.t3.micro)
- DB instance identifier: `debate-studio-db`
- Master username: `admin`
- Master password: generate, save to a private note
- Public access: **Yes** (only for dev — ideally use a bastion or run server in same VPC for prod)
- VPC security group: create new, allow inbound MySQL/3306 from your IP

Wait until status = Available. Copy the endpoint hostname.

- [ ] **Step 2: Run the schema**

```bash
mysql -h <rds-endpoint> -u admin -p < 4.lambda/server/scripts/init-db.sql
```
Expected: no errors. Verify with:
```bash
mysql -h <rds-endpoint> -u admin -p -e "USE debate_studio; SHOW TABLES;"
```
Expected: shows `debate_results`.

---

### Task 22: Wire server to deployed AWS resources

- [ ] **Step 1: Create server/.env (NOT committed)**

```bash
cat > 4.lambda/server/.env <<EOF
PORT=4000
GEMINI_LAMBDA_URL=https://<gemini-fn-url>.lambda-url.us-east-1.on.aws/
BEDROCK_LAMBDA_URL=https://<bedrock-fn-url>.lambda-url.us-east-1.on.aws/
DB_HOST=<rds-endpoint>.rds.amazonaws.com
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=<rds-password>
DB_NAME=debate_studio
EOF
```

- [ ] **Step 2: Verify .env is gitignored**

```bash
git status
```
Expected: `.env` does NOT appear. If it does, add `4.lambda/server/.env` to root `.gitignore` and re-check.

- [ ] **Step 3: Run server end-to-end against real cloud**

```bash
cd 4.lambda/server
npm start
```
In another terminal:
```bash
cd 4.lambda/client
npm start
```
Click through start → opening × 2 → closing × 2 → conclude → result. Verify:
- Each turn shows real Korean text from Gemini/Nova
- Result page reveals models correctly
- Stats query returns real counts (initially 1 after the first conclude)

- [ ] **Step 4: Commit (no .env)**

If anything in source changed during testing:
```bash
git add 4.lambda/
git commit -m "chore: configure for cloud deployment (env in .env, not committed)"
```

---

## Phase 7 — Wrap-up

### Task 23: README

**Files:**
- Create: `4.lambda/README.md`

- [ ] **Step 1: Write README.md**

```markdown
# AI Debate Studio

> 두 LLM(Gemini · Bedrock Nova)이 가상 인물로 분장해 사용자가 던진 주제를 토론하고, 결론 후에야 어느 AI인지 reveal되는 블라인드 토론 웹앱.

## 📱 한 줄 설명
사용자가 토론 주제와 양쪽 입장을 입력하면, 두 AI(블라인드 상태)가 가상 인물 한지호(전직 변호사) · 이서연(전직 기자)으로 분장해 6단계 액션 블록을 따라 토론하고, 사용자가 승자를 정한 뒤에야 누가 어느 AI였는지 공개되는 React + Express + AWS Lambda + RDS 기반 웹앱.

## 🏗 사용한 AWS 리소스

| 리소스 | 용도 |
|---|---|
| **AWS Lambda × 2** | `debate-gemini`(Node.js, Google Gemini 2.5 Flash 호출) · `debate-bedrock`(Python, Bedrock Nova Lite 호출) |
| **Lambda Function URL × 2** | Express 서버가 호출하는 HTTPS 엔드포인트 |
| **IAM Role** | `debate-bedrock`에 `bedrock:InvokeModel` 권한 부여 — API 키 없이 IAM으로 인증 |
| **AWS Bedrock — Nova Lite** | 토론 발언 생성 (Python 람다) |
| **AWS RDS MySQL 8** | 토론 결과 영속화 (`debate_results` 테이블) |
| **(외부)** Google Gemini 2.5 Flash | 토론 발언 생성 (Node.js 람다) |

## 📁 폴더 구조

```
4.lambda/
├── client/              # React 18 (CRA), 다크 토론 스튜디오 디자인
├── server/              # Express 4, 세션 + 상태 머신 + DB
├── gemini-lambda/       # Node.js Lambda → Google Gemini 2.5 Flash
├── bedrock-lambda/      # Python Lambda → AWS Bedrock Nova Lite
└── README.md
```

## 🚀 실행 방법

### 1. AWS 사전 준비
1. **Bedrock 모델 액세스 활성화**: 콘솔 → Bedrock → Model access → Amazon Nova Lite 활성화
2. **bedrock-lambda 배포**: `bedrock-lambda/README.md` 참고. Function URL과 IAM 역할 설정.
3. **gemini-lambda 배포**: Node.js 20.x 런타임. 환경 변수 `GEMINI_API_KEY` 필요. Function URL 노출.
4. **RDS MySQL 인스턴스 생성** + `server/scripts/init-db.sql` 실행으로 스키마 만들기.

### 2. 서버 환경 변수
`server/.env.example`를 `server/.env`로 복사하고 실제 값 채우기:
```
GEMINI_LAMBDA_URL=https://...lambda-url.us-east-1.on.aws/
BEDROCK_LAMBDA_URL=https://...lambda-url.us-east-1.on.aws/
DB_HOST=...rds.amazonaws.com
DB_USER=admin
DB_PASSWORD=...
DB_NAME=debate_studio
```

### 3. 백엔드 실행
```bash
cd 4.lambda/server
npm install
npm start                    # http://localhost:4000
```

### 4. 프론트엔드 실행
```bash
cd 4.lambda/client
npm install
npm start                    # http://localhost:3000
```

### 5. 사용 흐름
1. 시작 화면 → 토론 주제 + 입장 A/B 입력 → "토론 시작"
2. 메인 화면 → 6 액션 블록(오프닝/반박/예시/재반박/마무리/결론)을 차례로 클릭하며 토론 진행
3. 결과 화면 → 두 AI의 정체가 공개되고 누적 승률 통계 표시

## 🎭 페르소나 + AI 모델

매 세션마다 두 AI는 두 가상 인물 중 한 명으로 분장합니다. 누가 어느 모델인지는 **세션 시작 시 서버가 랜덤 매칭**하므로 사용자는 토론이 끝날 때까지 알 수 없습니다.

| 페르소나 | 직업 | 시각 컬러 |
|---|---|---|
| **한지호** | 전직 변호사 — 자신감 있고 직설적 | 빨강 |
| **이서연** | 전직 기자 — 차분하고 분석적 | 파랑 |

## 🧪 테스트

```bash
# 백엔드 단위/통합 테스트
cd 4.lambda/server && npm test

# Lambda 프롬프트 빌더 테스트
cd 4.lambda/gemini-lambda && npm test
```

## 🔒 보안

- `.env` 파일은 절대 커밋하지 마세요. `.gitignore`에 포함되어 있습니다.
- `bedrock-lambda`는 IAM Role을 사용하므로 별도 키가 필요 없습니다.
- `gemini-lambda`의 Google API 키는 람다 환경 변수로만 설정합니다.
- RDS 보안 그룹은 인바운드 IP를 화이트리스트로 좁혀 사용하세요.

## 🧪 데모용 테스트 계정

이 앱은 익명 사용 — 별도 로그인 없음. 위 실행 흐름대로 실행하면 누구나 바로 사용 가능합니다.
```

- [ ] **Step 2: Commit**

```bash
git add 4.lambda/README.md
git commit -m "docs(4.lambda): comprehensive README for assignment submission"
```

---

### Task 24: Security audit + final git check

- [ ] **Step 1: Verify .gitignore covers all secret files**

Check that the project root `.gitignore` (or 4.lambda/.gitignore) contains at minimum:

```
.env
.env.local
.env.*.local
4.lambda/server/.env
4.lambda/gemini-lambda/.env
node_modules/
build/
*.zip
function.zip
```

If anything is missing, add it and commit:

```bash
git add .gitignore
git commit -m "chore: harden .gitignore (env, build, lambda zips)"
```

- [ ] **Step 2: Search for accidentally committed secrets**

```bash
git ls-files | xargs grep -l -E "GEMINI_API_KEY=[A-Za-z0-9]|password.*=.*[A-Za-z0-9]" 2>/dev/null || echo "no secret-like strings in tracked files"
```
Expected: prints `no secret-like strings in tracked files`.

- [ ] **Step 3: Confirm no .env files are tracked**

```bash
git ls-files | grep -E "\.env$" || echo "no .env files tracked"
```
Expected: `no .env files tracked`.

- [ ] **Step 4: Final git status**

```bash
git status
```
Should be clean except for the deployment artifacts (function.zip etc) you may want to ignore or delete locally.

---

### Task 25: Demo capture

- [ ] **Step 1: Run server + client + take screenshots**

Start the server and client, then walk through one complete debate. Capture screenshots of:
1. Start screen (filled in form)
2. Main screen mid-debate (showing speaker card with real LLM output)
3. Result screen with reveal + stats

Save to `4.lambda/docs/screenshots/` (or wherever the assignment expects).

- [ ] **Step 2: Final commit (if needed)**

```bash
git add 4.lambda/docs/screenshots/
git commit -m "docs: add demo screenshots for assignment submission"
```

---

## Self-Review Checklist

The plan above covers each spec section as follows:

| Spec section | Plan task |
|---|---|
| §1 한 줄 설명 | Task 23 README |
| §2 컨셉 (블라인드 + reveal) | Tasks 9, 12 (server randomization, response shape) |
| §3 페르소나 | Task 7 personas.js |
| §4 토론 메커니즘 (액션 + FSM) | Task 8 stateMachine.js |
| §5 디자인 (3 화면) | Tasks 14, 16 (styles + components) |
| §6 시스템 구성 (folder structure) | Task 1 + each subsequent task |
| §7 API 설계 + 세션 + 에러 | Tasks 9, 10, 12 |
| §8 데이터 모델 | Task 11 init-db.sql |
| §9 AI 모델 (Flash + Lite) | Tasks 4, 5 (handlers), Task 19/20 (deploy) |
| §10 AWS 리소스 | Tasks 18-21 (deploy phase) |
| §11 보안 | Task 24 audit |
| §12 화면 흐름 | Task 16 App routing |
| §13 변경되지 않는 것 | Task 1 keeps 4.lambda root structure |
| §14 새로 만드는 것 | Tasks 1-22 entire build |
| §15 비범위 | not implemented (correct) |
| §16 성공 기준 | Task 23 README + Task 25 demo |

**Type/name consistency check (manual sweep):**
- `chosenSide` consistent across server route + client `concludeDebate` + spec ✓
- `availableActions` array name consistent across stateMachine, sessions, routes, App ✓
- `currentTurn.speaker.side` and `session.matchup.A.persona.image` paths consistent in MainScreen + ResultScreen ✓
- `stats.geminiWinRate` key consistent between db.js and ResultScreen ✓
- Lambda payload shape (`persona`, `topic`, `myPosition`, `opponentPosition`, `history`, `action`) identical across `lambdaClient.js`, `gemini-lambda/index.js`, `bedrock-lambda/lambda_function.py` ✓
- `applyAction(s.fsm, 'conclude')` exists in route conclude path; FSM has `conclude` transition ✓

No placeholders, no TBDs, no "similar to Task N" references. Each task has concrete code or commands.
