# AI Debate

> **한 줄 설명**: 두 AI 모델(Google Gemini · AWS Bedrock Nova)이 같은 주제로 토론하고 사용자가 승자를 고르면 누적 승률이 집계되는 3-Tier + Serverless 웹 애플리케이션.

## 🚀 배포된 서비스 (바로 사용)

| 항목 | 값 |
|---|---|
| **서비스 URL** | http://kmucloud-25-debate-s3.s3-website-us-east-1.amazonaws.com |
| **로그인** | ❌ 불필요 (별도 인증 없음, 바로 토론 시작 가능) |
| **테스트 계정** | N/A — 익명 사용. 세션은 서버 메모리에 저장되며 1시간 후 자동 만료 |
| **지원 브라우저** | Chrome / Safari / Firefox 최신 버전 (HTTP 접속 필수) |

> ⚠️ **반드시 HTTP로 접속**하세요. `https://...`로 들어가면 S3 REST 엔드포인트로 가서 동작하지 않습니다.

### 🧪 샘플 테스트 시나리오

접속 후 바로 사용할 수 있는 토론 주제 예시 — 주제와 두 입장을 그대로 복사해서 입력하면 됩니다.

| 주제 | 입장 A | 입장 B |
|---|---|---|
| 아침 식사로 | 빵 | 밥 |
| 여름 휴가지로 | 해외 | 국내 |
| 다른 사람에게 애완동물을 추천한다면? | 강아지 | 고양이 |
| 야식 메뉴 추천 | 치킨 | 피자 |
| 더 나쁜 사람은? | 잠수이별 | 환승이별 |

**동작 흐름**:
1. 주제 + 입장 A/B 입력 → **"토론 시작"**
2. **opening (A)** → **opening (B)** → 이후 `rebuttal` / `example` / `counter_rebuttal` 자유 선택 (번갈아 발언)
3. 양쪽 **closing** 후 **승자 선택(A 또는 B)**
4. 결과 화면에서 누적 승률과 함께 "어느 모델이 어느 쪽이었는지" 공개

> Gemini는 Google AI Studio 무료 등급을 사용 중입니다 — **하루 20회 제한**이 있어 데모용으로만 적합합니다.

---

## 🏗️ 사용한 AWS 리소스

```
[ 사용자 브라우저 ]
        │
        │ 1. 정적 파일 요청
        ▼
┌─────────────────────────┐
│   S3 (정적 웹 호스팅)    │  kmucloud-25-debate-s3
│   React SPA (빌드 결과)  │
└─────────────────────────┘
        │
        │ 2. fetch("http://<EC2-IP>:4000/api/debate/...")
        ▼
┌─────────────────────────┐
│   EC2 (t3.micro)         │  Amazon Linux 2023
│   Express + pm2          │  54.163.49.191:4000
└─────────────────────────┘
   │             │             │
   │             │             └──► RDS MySQL (공유 DB)
   │             │                  debate_results 테이블
   │             │
   │             └──► Lambda (Python 3.11)
   │                  bedrock-lambda ──► Bedrock Runtime
   │                                     (amazon.nova-lite-v1:0)
   │
   └──► Lambda (Node.js 20)
        gemini-lambda ──► Google Gemini API
                          (gemini-2.5-flash)
```

| AWS 리소스 | 역할 | 설정 요약 |
|---|---|---|
| **S3** (`kmucloud-25-debate-s3`) | 프론트엔드 호스팅 — React SPA 정적 파일 배포 | 정적 웹사이트 호스팅 활성화, 퍼블릭 읽기 허용, `index.html` + SPA fallback |
| **EC2** (`t3.micro`, us-east-1) | 애플리케이션 서버 — Express API, 상태머신, 세션 관리, Lambda 중개 | Amazon Linux 2023, Node.js 20, pm2로 상시 실행, 보안 그룹 22 + 4000 개방 |
| **RDS MySQL** (공유 수업 DB) | 영속 데이터 — 완료된 토론 결과 저장 및 승률 집계 | `debate_results` 테이블, EC2 → RDS 3306 허용 |
| **Lambda (Node.js)** — gemini-lambda | Google Gemini 호출 마이크로서비스 | Function URL 활성화, 환경변수 `GEMINI_API_KEY` / `GEMINI_MODEL` |
| **Lambda (Python)** — bedrock-lambda | AWS Bedrock Nova 호출 마이크로서비스 | Function URL 활성화, IAM에 `bedrock:InvokeModel` on Nova Lite, us-east-1 |
| **IAM** | Bedrock Lambda → Bedrock Runtime 접근 권한 | Lambda 실행 역할에 `AmazonBedrockLimitedAccess` 또는 인라인 정책 |

### 왜 이렇게 나누었나

- **S3 ≠ EC2 분리**: 정적 파일(HTML/JS/CSS)은 변경이 드물고 대역폭 비용이 저렴한 S3로, 동적 API는 EC2로. 정적 리소스를 매번 Express가 서빙하는 비효율 제거.
- **Lambda 2개 분리**: Gemini는 Node.js SDK, Bedrock은 Python boto3가 편해서 **언어별로 하나씩**. 또한 요금/쿼터/장애 격리 측면에서도 유리.
- **EC2가 DB를 독점**: Lambda는 DB를 몰라야 하는 순수 AI 추론기. 결과 저장은 `/conclude` 시점에 EC2가 한 번만 INSERT → 턴마다 DB 왕복 없음.

---

## ▶️ 실행 방법

### (A) 이미 배포된 서비스 사용 — 가장 빠름

아무 설정 없이 바로 접속:
```
http://kmucloud-25-debate-s3.s3-website-us-east-1.amazonaws.com
```

### (B) 로컬 개발 환경에서 실행

**선행 조건**: Node.js 18+, MySQL 접근 가능한 DB (RDS 또는 로컬 MySQL)

```bash
# 1. 저장소 clone
git clone https://github.com/h01024380577-blip/Nxt-Classic-Architecture-v2.git
cd Nxt-Classic-Architecture-v2

# 2. 서버 설치 + .env 작성
cd AI-Debate/server
cat > .env <<'EOF'
PORT=4000
GEMINI_LAMBDA_URL=https://<your-gemini-lambda>.lambda-url.us-east-1.on.aws/
BEDROCK_LAMBDA_URL=https://<your-bedrock-lambda>.lambda-url.us-east-1.on.aws/
DB_HOST=<rds-endpoint>
DB_PORT=3306
DB_USER=<user>
DB_PASSWORD=<password>
DB_NAME=<database>
EOF
npm install

# 3. DB 스키마 생성 (최초 1회)
node scripts/run-init-db.js
# → "✅ debate_results table exists." 확인

# 4. 서버 실행 (포어그라운드)
npm run dev                    # http://localhost:4000
curl http://localhost:4000/health   # {"ok":true}

# 5. 새 터미널에서 클라이언트 실행
cd ../client
npm install
npm start                      # http://localhost:3000
```

로컬에선 `client/package.json`의 `"proxy": "http://localhost:4000"` 덕분에 `/api/*` 호출이 자동으로 서버로 프록시됩니다.

### (C) AWS에 직접 배포

1. **RDS**: MySQL 인스턴스 생성, 보안 그룹에서 EC2 SG → 3306 허용
2. **Lambda (gemini-lambda)**:
   - Node.js 20 런타임
   - 환경변수: `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-2.5-flash`
   - Function URL 활성화 (CORS 허용)
3. **Lambda (bedrock-lambda)**:
   - Python 3.11 런타임
   - IAM 실행 역할에 `bedrock:InvokeModel` 권한 (Nova Lite 대상)
   - Bedrock 콘솔에서 Nova Lite 모델 접근 enable (최초 1회)
   - Function URL 활성화
4. **EC2**:
   ```bash
   # Amazon Linux 2023
   sudo dnf install -y git
   curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
   sudo dnf install -y nodejs
   git clone https://github.com/h01024380577-blip/Nxt-Classic-Architecture-v2.git
   cd Nxt-Classic-Architecture-v2/AI-Debate/server
   npm install --omit=dev
   # .env 업로드 (scp 또는 직접 작성)
   node scripts/run-init-db.js
   sudo npm i -g pm2
   pm2 start src/index.js --name debate-server
   pm2 save && pm2 startup    # 재부팅 자동 시작
   ```
   보안 그룹: `22/SSH (내 IP)` + `4000/TCP (0.0.0.0/0)`
5. **S3 (정적 호스팅)**:
   ```bash
   cd AI-Debate/client
   REACT_APP_API_BASE=http://<EC2-Public-IP>:4000 npm run build
   aws s3 cp build s3://<your-bucket> --recursive
   ```
   버킷 속성에서 "정적 웹사이트 호스팅" 활성화, 퍼블릭 읽기 허용 (버킷 정책).

---

## 🧪 테스트 (코드 레벨)

```bash
# 서버 단위 테스트 (상태머신, 세션, 라우트) — Lambda 호출 mock
cd AI-Debate/server && npm test

# Gemini Lambda 프롬프트 빌더 테스트
cd AI-Debate/gemini-lambda && npm test
```

**서버 테스트는 인터넷/AWS 크리덴셜 없이 실행됩니다** — Lambda 호출을 전부 mock 처리하기 때문입니다.

---

## 📂 리포지토리 구조

```
Nxt-Classic-Architecture-v2/
├── AI-Debate/
│   ├── client/           React (CRA) — 토론 UI
│   ├── server/           Express — API, 상태머신, DB
│   ├── gemini-lambda/    Node.js Lambda — Google Gemini
│   ├── bedrock-lambda/   Python Lambda — AWS Bedrock Nova
│   └── DropTable.md      DB 수동 리셋 스니펫
└── README.md             (이 파일)
```

각 하위 디렉터리에 자체 README가 있습니다. 전체 맥락을 보려면 **이 파일 → server → client → gemini-lambda → bedrock-lambda** 순서 권장.

---

## 🔑 환경 변수 요약

| 위치 | 변수 | 설명 |
|------|------|------|
| `AI-Debate/server/.env` | `PORT` | Express 포트 (기본 4000) |
| `AI-Debate/server/.env` | `GEMINI_LAMBDA_URL` | Gemini Lambda Function URL |
| `AI-Debate/server/.env` | `BEDROCK_LAMBDA_URL` | Bedrock Nova Lambda Function URL |
| `AI-Debate/server/.env` | `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | RDS 접속 정보 |
| `AI-Debate/client` (빌드 시) | `REACT_APP_API_BASE` | 빌드 시 박히는 절대 API 주소 (예: `http://54.163.49.191:4000`). 비우면 상대경로로 동작 (로컬 dev proxy용) |
| Lambda Console (gemini-lambda) | `GEMINI_API_KEY` | Google AI Studio API 키 |
| Lambda Console (gemini-lambda) | `GEMINI_MODEL` | 기본 `gemini-2.5-flash` |
| Lambda Console (bedrock-lambda) | `BEDROCK_MODEL_ID` | 기본 `amazon.nova-lite-v1:0` |

`.env`는 `.gitignore`에 의해 저장소에서 제외됩니다. **절대 커밋하지 마세요.**

---

## 🔄 토론 상태머신

```
idle
 └─ opening  → A_opened
              └─ opening → B_opened
                          ├─ rebuttal / example / counter_rebuttal → mid (번갈아 발언)
                          └─ closing → A_closed
                                       └─ closing → ready_to_conclude
                                                    └─ conclude → concluded
```

- `availableActions(state)`가 UI에 내려가서 잘못된 액션을 원천 차단
- `mid` 상태에선 `lastSpeaker`를 뒤집어 교대 발언 보장
- 자세한 내용: [`AI-Debate/server/README.md`](AI-Debate/server/README.md)

---

## ⚠️ 보안 / 운영 주의

- **CORS**: 서버는 `cors()` 전부 허용 (수업/데모 기본값). 운영 시 `cors({ origin: <client-url> })`로 좁힐 것
- **Lambda Function URL Auth**: 개발 편의상 `NONE`. 운영에선 IAM으로 전환 — URL만 알면 비용 유출 가능
- **세션 저장**: 인메모리 Map (단일 EC2 전제). 멀티 인스턴스면 Redis/ElastiCache로 교체 필요
- **Rate limiting 없음**: 운영 전에 `express-rate-limit`을 `/api/debate/start` · `/turn`에 추가 권장
- **SQL 인젝션**: 모든 쿼리는 `?` 파라미터화 (`db.js`, `run-init-db.js`). 문자열 연결 금지
- **Gemini 무료 쿼터**: 하루 20 req/model/project. 데모/시연 중 쿼터 초과 시 "AI 응답 생성 중 문제가 발생했습니다" 표시 → 새 Google Cloud 프로젝트 또는 유료 전환 필요

---

## 📸 데모

최종 배포 주소: http://kmucloud-25-debate-s3.s3-website-us-east-1.amazonaws.com

`curl`로 API 플로우만 빠르게 확인하려면:

```bash
# 1) 세션 생성
curl -X POST http://54.163.49.191:4000/api/debate/start \
  -H "Content-Type: application/json" \
  -d '{"topic":"아침 식사로 빵 vs 밥","positionA":"빵","positionB":"밥"}'

# 2) 응답에서 sessionId 복사 후 opening
curl -X POST http://54.163.49.191:4000/api/debate/<sessionId>/turn \
  -H "Content-Type: application/json" \
  -d '{"action":"opening"}'
```
