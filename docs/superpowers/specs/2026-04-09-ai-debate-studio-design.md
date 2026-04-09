# AI Debate Studio — 설계 문서

> 작성일: 2026-04-09
> 과제: AWS 클라우드 컴퓨팅 — 나만의 앱 만들기
> 베이스: `4.lambda/` 폴더 (4번 폴더 기반 + 전면 재구성)

---

## 1. 한 줄 설명

두 개의 LLM(Google Gemini · AWS Bedrock Nova)이 가상 인물로 분장해 사용자가 던진 주제를 토론하고, 사용자가 중재자로서 토론 흐름을 진행시키며 결론을 내리면 그제서야 누가 어느 AI였는지 reveal되는 **블라인드 AI 토론장 웹앱**.

---

## 2. 컨셉

### 2.1 핵심 아이디어

- 사용자가 토론 주제와 양쪽 입장을 입력 (예: 주제 "점심 메뉴 논쟁", 입장 A "짜장면이 최고", 입장 B "짬뽕이 최고")
- 서버가 두 AI에 입장을 **랜덤 배정** (Gemini가 입장 A를, Nova가 입장 B를 옹호 — 또는 그 반대)
- 두 AI는 항상 같은 두 페르소나로 분장: **한지호 (전직 변호사)** · **이서연 (전직 기자)**
- 사용자는 6가지 블록(오프닝/반박/예시/재반박/마무리/결론)을 클릭해 토론을 진행시킴
- 진행 중에는 페르소나 이름만 보임 — **어느 쪽이 Gemini이고 어느 쪽이 Nova인지 모름**
- 사용자가 결론(승자 입장 선택)을 내리면 **Reveal 모먼트**: "한지호 = ⚡Gemini, 이서연 = Nova"

### 2.2 학습 가치

- **3-tier 아키텍처**: React → Express → MySQL/RDS
- **Lambda 마이크로서비스**: Gemini와 Bedrock 호출을 각각 독립 람다로 분리
- **IAM Role 기반 보안**: bedrock-lambda는 API 키 없이 IAM Role로 Bedrock 호출
- **두 AI 모델 비교**: 페르소나는 매번 랜덤 매칭, 모델별 누적 승률을 통계로 누적

### 2.3 사용자 경험 한 사이클

1. 시작 화면 → 토픽 + 입장 A·B 입력 → "토론 시작"
2. 메인 화면 → 한지호 / 이서연 매치업 + 첫 발언 영역 + 컨트롤 패널
3. 사용자가 [오프닝] 클릭 → 다음 차례 자동 결정 → 람다 호출 → 발언 표시
4. 반복 (반박/예시/재반박/마무리)
5. [결론] 클릭 → 두 입장 중 선택
6. 결과 화면 → Reveal + 누적 승률 + "새 토론" / "역대 결과"

---

## 3. 페르소나 (고정 2인)

### 3.1 한지호 (RED)
- **직업**: 전직 변호사 → 토론 챔피언
- **나이/성별**: 40대 후반 한국인 남성
- **성격/말투**: 자신감 있고 직설적, 논리 정연, 살짝 도발적
- **시각**: 다크 차콜 슈트 + 빨간 넥타이/포켓치프, 우후방 빨간 림 라이트
- **사진**: `4.lambda/client/public/personas/gemini.png` (저장 완료, 8.4MB)

### 3.2 이서연 (BLUE)
- **직업**: 전직 기자 → 토론 챔피언
- **나이/성별**: 30대 후반 한국인 여성
- **성격/말투**: 차분하고 분석적, 데이터 인용 좋아함, 존댓말, 침착
- **시각**: 네이비 블레이저 + 흰 블라우스 + 파란 실크 스카프, 후방 파란 림 라이트
- **사진**: `4.lambda/client/public/personas/nova.png` (저장 완료, 7.2MB)

> 두 사진은 동일한 카메라/조명/배경 톤(딥 차콜 그라데이션)으로 시리즈 룩이 보장됨.

### 3.3 페르소나 → AI 모델 매핑

- **이름은 페르소나에 고정**, AI 모델은 매 세션마다 랜덤 매칭
- 예: 세션 1에서는 한지호=Gemini, 세션 2에서는 한지호=Nova
- 페르소나 메타데이터(이름·직업·성격·사진 경로)는 백엔드 코드에 정적 정의

---

## 4. 토론 메커니즘

### 4.1 6가지 액션 블록

| 블록 | 의미 | 시스템 프롬프트 신호 |
|---|---|---|
| ▶️ 오프닝 진술 | 자기 입장을 처음 펼침 | `"opening"` — 상대 발언 미참조, 자기 입장의 핵심을 1~2단락으로 |
| 🔁 반박 | 상대의 직전 발언을 반박 | `"rebuttal"` — 상대 직전 발언을 컨텍스트로 받아 비판 |
| 💡 예시 | 자기 입장을 보강하는 사례 | `"example"` — 구체적 일화/데이터로 자기 주장 강화 |
| 🔥 재반박 | 상대 반박에 대한 재반박 | `"counter_rebuttal"` — 상대 직전 반박을 다시 비판 |
| 🎤 마무리 | 클로징 발언 | `"closing"` — 토론 전체를 정리하며 자기 입장의 정수를 한 단락으로 |
| 🏁 결론 | (사용자) 승자 선택 | 백엔드 호출 → DB 저장 + reveal |

### 4.2 상태 머신 (블록 활성/비활성)

| 현재 상태 | 활성 블록 | 다음 발언자 (자동) |
|---|---|---|
| `idle` (시작 직후) | 오프닝 | 입장 A 측 |
| `A_opened` | 오프닝 | 입장 B 측 |
| `B_opened` | 반박, 예시, 마무리 | 직전 발언자의 반대편 |
| `mid` (양쪽 오프닝 끝, 마무리 전) | 반박, 예시, 재반박, 마무리 | 직전의 반대편 |
| `A_closed` (한쪽 마무리) | 마무리 | 마무리 안 한 쪽 |
| `B_closed` (양쪽 마무리) | 결론 | — |
| `concluded` | (없음) | — |

> "다음 발언자"는 항상 직전 발언자의 반대편으로 자동 결정. 사용자는 "어떤 액션"만 선택.

### 4.3 발언 컨텍스트

- 람다 호출 시 `history` 배열로 직전 발언들을 모두 전달
- 람다 내부에서 시스템 프롬프트에 `이전 발언:\n[A] ...\n[B] ...` 형태로 결합
- 토론 6라운드 = 약 2-3K 입력 토큰, 부담 없음

---

## 5. 디자인

### 5.1 톤
- **TV 토론회 스튜디오** (격투/대결 X) — 차분하고 진지한 분위기
- 다크 차콜 배경 (`#0d0d12`)
- 액센트: 빨강 `#ef4444` (한지호) · 파랑 `#3b82f6` (이서연) · 노랑 `#fbbf24` (Verdict)
- 폰트: Georgia 세리프 (제목/주제) + system Sans (UI/메타)

### 5.2 레이아웃 원칙
- **720px 중앙 정렬** — 모든 화면 동일
- 한 화면에 모든 핵심 영역이 들어오도록 콤팩트
- 페르소나 사진은 풀스크린 발언자 카드에 110×140 사이즈로 부각

### 5.3 3개 화면

#### ① 시작 화면
- 브랜드 헤더 (`AI Debate Studio` + 부제)
- 페르소나 미리보기 (한지호 / 이서연, AI 모델명 X)
- 입력 폼: 토론 주제 (1줄) + 입장 A·B (2칸 grid)
- CTA: `▶ 토론 시작 (포지션 랜덤 배정)`
- 하단 링크: `역대 토론 결과 보기 →`

#### ② 메인 화면
- 헤더: `DEBATE · LIVE` + 토론 주제 + 진행 인디케이터
- 매치업 미니바: 한지호 / 이서연 (AI 모델명 = `???`)
- 메인 스테이지: 발언자 풀스크린 카드 (사진 110×140 + 발언 본문)
- 발언 히스토리 칩 (가로 스크롤)
- 중재자 컨트롤 패널: 6 블록 grid

#### ③ 결과 화면
- 헤더: `VERDICT · REVEAL`
- 승자 카드 (큼, 노란 액센트, AI 모델 배지 reveal)
- 패자 카드 (작고 탈색, AI 모델 배지)
- 매치업 요약: "한지호 = ⚡Gemini · 이서연 = Nova"
- 누적 승률 막대 (모델 기준)
- 액션: `새 토론` / `역대 결과 →`

---

## 6. 시스템 구성

### 6.1 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│  React Client    (4.lambda/client)                       │
│   · 시작 / 메인 / 결과 화면                               │
│   · 720px 중앙 정렬                                      │
└─────────────────────────────────────────────────────────┘
                          │ HTTP (JSON)
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Express Server  (4.lambda/server)                       │
│   · POST /api/debate/start                               │
│   · POST /api/debate/:id/turn                            │
│   · POST /api/debate/:id/conclude                        │
│   · GET  /api/results                                    │
│   · 세션 메모리 관리, 람다 호출 라우팅                    │
└─────────────────────────────────────────────────────────┘
              │                            │
              │ axios HTTPS                │ mysql2
              ▼                            ▼
   ┌────────────────────┐         ┌─────────────────┐
   │ gemini-lambda      │         │ AWS RDS         │
   │ (AWS Lambda URL)   │         │ MySQL 8         │
   │ → Google Gemini    │         │ debate_results  │
   │   2.5 Flash        │         └─────────────────┘
   └────────────────────┘
   ┌────────────────────┐
   │ bedrock-lambda     │
   │ (AWS Lambda URL)   │
   │ → Bedrock Nova     │
   │   Lite (IAM Role)  │
   └────────────────────┘
```

### 6.2 폴더 구조 (4.lambda 기반 재구성)

```
4.lambda/
├── client/
│   ├── public/
│   │   └── personas/
│   │       ├── gemini.png   ← 저장 완료
│   │       └── nova.png     ← 저장 완료
│   └── src/
│       ├── components/
│       │   ├── start/        # 시작 화면
│       │   ├── main/         # 메인 토론 화면
│       │   ├── result/       # 결과 화면
│       │   └── shared/       # PersonaCard, ActionBlock 등
│       ├── state/            # debate state machine
│       ├── api/              # axios 클라이언트
│       └── App.jsx
├── server/
│   ├── src/
│   │   ├── routes/
│   │   │   └── debate.js
│   │   ├── services/
│   │   │   ├── lambdaClient.js   # 람다 URL 호출
│   │   │   ├── personaConfig.js  # 페르소나 메타
│   │   │   └── stateMachine.js   # 서버측 상태 검증
│   │   ├── db/
│   │   │   └── results.js        # debate_results 쿼리
│   │   └── index.js
│   └── .env.example
├── gemini-lambda/
│   ├── index.js                  # Lambda handler
│   ├── prompts.js                # 페르소나 시스템 프롬프트
│   └── package.json
├── bedrock-lambda/
│   ├── index.js                  # Lambda handler (IAM Role 사용)
│   ├── prompts.js
│   └── package.json
└── README.md
```

---

## 7. API 설계

### 7.1 클라이언트 ↔ 서버

#### `POST /api/debate/start`
**Request**:
```json
{
  "topic": "점심 메뉴 논쟁",
  "positionA": "짜장면이 최고",
  "positionB": "짬뽕이 최고"
}
```
**Response**:
```json
{
  "sessionId": "uuid-...",
  "matchup": {
    "positionA": { "persona": "한지호", "personaId": "hanjiho" },
    "positionB": { "persona": "이서연", "personaId": "leeseoyeon" }
  },
  "state": "idle",
  "availableActions": ["opening"]
}
```
> 응답에 모델명(gemini/nova) 절대 포함 X.

#### `POST /api/debate/:sessionId/turn`
**Request**:
```json
{ "action": "opening" }
```
**Response**:
```json
{
  "speaker": { "persona": "한지호", "personaId": "hanjiho", "side": "A" },
  "action": "opening",
  "content": "짜장면이야말로 한국 중식의 정수입니다...",
  "state": "A_opened",
  "availableActions": ["opening"]
}
```
> 서버 내부에서 sessionId로 매핑된 모델/페르소나 룩업 후 해당 람다 호출.

#### `POST /api/debate/:sessionId/conclude`
**Request**:
```json
{ "chosenSide": "A" }
```
**Response** (Reveal 포함):
```json
{
  "chosen": { "persona": "한지호", "personaId": "hanjiho", "model": "gemini" },
  "passed": { "persona": "이서연", "personaId": "leeseoyeon", "model": "nova" },
  "stats": {
    "geminiWins": 16,
    "novaWins": 17,
    "totalDebates": 33,
    "geminiWinRate": 0.485,
    "novaWinRate": 0.515
  }
}
```

#### `GET /api/results`
역대 토론 리스트 + 누적 통계.

### 7.1.1 세션 / 발언 히스토리 관리

- **서버 세션은 in-memory** (단일 Express 인스턴스 가정, 학습 환경)
  - `Map<sessionId, SessionState>` 형태
  - `SessionState`: `{ topic, positionA, positionB, geminiSide, novaSide, history: TurnRecord[], state }`
  - `TurnRecord`: `{ side, persona, action, content, timestamp }`
- **발언 본문은 세션 메모리에만** — DB(`debate_results`)에는 결과만 영속화
- **클라이언트는 turn 응답을 누적 보관** — 메인 화면의 "발언 히스토리 칩"은 클라이언트 state로 표시
- **세션 유효 시간**: 1시간 (1시간 inactive 시 메모리에서 제거 — setInterval 정리)
- 서버 재시작 시 in-flight 세션은 사라짐 (학습 과제 수준 허용)

### 7.1.2 에러 처리

- **람다 호출 실패** (5xx, 타임아웃 10초)
  - 서버는 503 응답: `{ error: "AI 응답 생성 중 문제가 발생했습니다. 다시 시도해주세요." }`
  - 세션 상태는 변경 없음 (사용자가 같은 액션 재시도 가능)
- **상태 머신 위반** (현재 비활성 액션 호출)
  - 서버는 400 응답: `{ error: "현재 단계에서 사용할 수 없는 액션입니다.", availableActions: [...] }`
- **세션 미존재** (만료 후 호출)
  - 서버는 404 응답: `{ error: "세션이 만료되었습니다. 새 토론을 시작해주세요." }`
- **DB 호출 실패** (conclude 시)
  - reveal은 정상 응답 (사용자 경험 우선), 통계는 캐시된 값 또는 누락 표시
  - 서버 로그에 에러 기록

### 7.2 서버 ↔ 람다 (gemini-lambda / bedrock-lambda 동일 인터페이스)

**Request**:
```json
{
  "persona": {
    "name": "한지호",
    "role": "전직 변호사, 토론 챔피언",
    "voice": "자신감 있고 직설적, 논리 정연, 살짝 도발적"
  },
  "topic": "점심 메뉴 논쟁",
  "myPosition": "짜장면이 최고",
  "opponentPosition": "짬뽕이 최고",
  "history": [
    { "speaker": "opponent", "action": "opening", "content": "..." }
  ],
  "action": "rebuttal"
}
```

**Response**:
```json
{ "content": "그 주장은 핵심을 비껴갑니다. 자극적인 매운맛은..." }
```

> 두 람다는 인터페이스가 같아서 서버는 모델 차이를 신경 안 씀. 서버가 sessionId의 매핑을 보고 어느 람다 URL을 호출할지만 결정.

---

## 8. 데이터 모델

### MySQL `debate_results` 테이블

```sql
CREATE TABLE IF NOT EXISTS debate_results (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  topic           VARCHAR(255) NOT NULL,
  position_a      VARCHAR(255) NOT NULL,
  position_b      VARCHAR(255) NOT NULL,
  gemini_side     ENUM('a','b') NOT NULL,    -- Gemini가 어느 입장이었나
  nova_side       ENUM('a','b') NOT NULL,    -- Nova가 어느 입장이었나
  user_choice     ENUM('a','b') NOT NULL,    -- 사용자가 고른 입장
  winner_model    ENUM('gemini','nova') NOT NULL,  -- user_choice와 매핑된 모델
  turn_count      INT NOT NULL,              -- 총 발언 수
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

> 발언 본문은 저장 안 함 (스토리지/토큰 비용 절약). 결과만 누적해서 모델별 승률 통계.

### 통계 쿼리 예시

```sql
SELECT
  winner_model,
  COUNT(*) as wins,
  COUNT(*) * 100.0 / (SELECT COUNT(*) FROM debate_results) as win_rate
FROM debate_results
GROUP BY winner_model;
```

---

## 9. AI 모델

| 모델 | 호출 위치 | 인증 |
|---|---|---|
| **Google Gemini 2.5 Flash** | gemini-lambda | 환경 변수 `GEMINI_API_KEY` |
| **AWS Bedrock Nova Lite** | bedrock-lambda | IAM Role (Bedrock Invoke 권한) |

> 정확한 모델 ID는 구현 단계에서 최신 가용 버전 확인 후 사용.

### 모델 선정 이유
- **공정한 비교**: 두 모델이 같은 가성비 티어
- **한국어 자연스러움**: 둘 다 한국어 토론에 충분
- **비용**: 1회 토론 약 1센트 미만, 100회 해도 1달러 이내
- **응답 속도**: 둘 다 빠른 응답으로 사용자 대기 시간 최소

---

## 10. AWS 리소스 (학습 과제 핵심)

| 리소스 | 용도 |
|---|---|
| **AWS Lambda × 2** | gemini-lambda, bedrock-lambda — 실제 배포 |
| **Lambda Function URL × 2** | Express 서버가 호출할 HTTPS 엔드포인트 |
| **IAM Role** | bedrock-lambda에 `bedrock:InvokeModel` 권한 부여 |
| **AWS Bedrock** | Nova Lite 모델 호출 |
| **AWS RDS MySQL 8** | `debate_results` 테이블 영속화 |
| **(외부)** Google Gemini API | gemini-lambda의 환경 변수 사용 |

---

## 11. 보안 (감점 방지)

- `.env`, `.env.local`은 모두 `.gitignore`에 포함
- `.env.example`만 커밋 (DB_HOST 등 키 이름만, 실제 값은 빈 칸)
- **Bedrock 호출은 IAM Role 사용** — bedrock-lambda 환경 변수에 키 X
- Gemini API 키는 람다 환경 변수에만, GitHub에 절대 노출 X
- RDS 접속 정보는 server/.env에만, 람다는 모름
- README의 테스트 계정/샘플 데이터에는 실제 운영 키 사용 X
- 커밋 직전 `git status`로 .env 류 파일이 staged 안 됐는지 확인

---

## 12. 화면 흐름 요약

```
[시작 화면]
   주제 + 입장 A·B 입력
   ↓ "토론 시작"
   서버: 페르소나 ↔ 모델 랜덤 매칭 + 세션 생성
   ↓
[메인 화면 — 블라인드 모드]
   매치업 표시 (한지호 / 이서연, 모델 = ???)
   ↓ 사용자가 [오프닝] 클릭
   서버: 입장 A 측 람다 호출 → 응답
   ↓ 발언 카드 업데이트
   ↓ 사용자가 [오프닝] 한 번 더 → 입장 B 측 람다 호출
   ↓ ... (반박/예시/재반박 반복)
   ↓ 사용자가 [마무리] × 양쪽
   ↓ 사용자가 [결론] 클릭
[결과 화면 — Reveal 모드]
   승자 입장 선택
   ↓ 서버: DB 저장 + reveal 응답
   ↓ "한지호 = ⚡Gemini" 정체 공개
   ↓ 누적 승률 표시
   ↓ "새 토론" 또는 "역대 결과"
```

---

## 13. 변경되지 않는 것 (4.lambda 기반에서 유지)

- `4.lambda/` 폴더 사용
- React + Express + Lambda + MySQL 스택
- 두 람다 분리 구조 (gemini, bedrock)

## 14. 새로 만들거나 전면 재작성하는 것

- **client/src 전체** — 시작/메인/결과 3개 화면, 720px 중앙 정렬, 다크 토론 스튜디오 디자인
- **server/src 전체** — 새 API 엔드포인트, 세션 관리, 상태 머신 검증
- **gemini-lambda/index.js** — 페르소나 기반 시스템 프롬프트, 액션별 분기
- **bedrock-lambda/index.js** — 동일한 인터페이스, IAM Role 기반 Bedrock 호출
- **MySQL 스키마** — `debate_results` 테이블 새로 생성
- **README.md** — 과제 요구사항대로 한 줄 설명, AWS 리소스, 실행 방법

---

## 15. 비범위 (Out of Scope)

- 사용자 인증 / 로그인 (익명 사용)
- 실시간 스트리밍 (한 번에 발언 전체 응답)
- 모바일 반응형 (데스크톱 우선, 720px 컬럼이라 자연스럽게 적당히 작동)
- 다국어 지원 (한국어만)
- 발언 본문 영속화 (결과만 저장)
- 토론 다시보기 / 발언 편집
- 페르소나 추가/수정 UI
- 토론 시간 제한 / 라운드 수 강제

---

## 16. 성공 기준 (과제 채점)

| 항목 | 충족 방법 |
|---|---|
| 나만의 앱 | 4.lambda 기반이지만 주제·기능·디자인 전면 재기획 (블라인드 토론 + 페르소나) |
| 실제 동작 | 서버 에러 없이 실행, 시작→메인→결과 한 사이클 캡처 |
| 프론트엔드 전면 재작성 | 기존 4.lambda/client와 완전히 다른 디자인/구조 |
| README | 한 줄 설명 + AWS 리소스 (Lambda × 2, IAM, Bedrock, RDS) + 실행 방법 |
| 보안 | .env gitignore, IAM Role 사용, 키 노출 없음 |
| 도전 (Lambda 배포) | gemini-lambda + bedrock-lambda 모두 실제 AWS 배포 + 연동 |
