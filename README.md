# AlgoTick

미국·한국 주식을 검색하면 가치평가·기관/내부자 거래·기술 지표·뉴스를 한 페이지에서 분석해주는 개인용 SPA.

> **참고**: [fintel.io](https://fintel.io/) · [simplywall.st](https://simplywall.st/dashboard)
> **상세 설계**: [docs/superpowers/specs/2026-05-19-algotick-design.md](docs/superpowers/specs/2026-05-19-algotick-design.md)

---

## ✨ 핵심 기능

- 🔍 **검색** — 미국(NASDAQ/NYSE) + 한국(KOSPI/KOSDAQ) 통합
- 📊 **종목 상세 (5탭)** — 차트 · 가치평가 · 기관/내부자 · 뉴스 · 개요
- 🌐 **시황 분석** — 주요 지수(S&P500/NASDAQ/KOSPI/VIX 등) · 섹터 히트맵 · 등락 TOP 10 · 거래량 급증 · 시장 캘린더(실적/FOMC)
- 🧮 **차트 자동 분석** — 이평선(5/20/60/120), RSI, MACD, 볼린저밴드 + 룰 기반 신호(골든크로스/데드크로스/스퀴즈 등)
- ⭐ **관심종목** — 1분 주기로 백그라운드 갱신
- 💼 **포트폴리오 추적** — 매수/매도 기록 → 손익/수익률 자동 계산
- 🔬 **스크리너** — PER/PBR/ROE 등 조건 빌더
- ⚖️ **종목 비교** — 2~3개 동시
- 🌙 **다크/라이트 토글**

---

## 🏗️ 아키텍처

```
┌──────────────┐   REST + SSE   ┌────────────────────────┐   read/write   ┌────────────┐
│   Browser    │ ◄────────────► │   Node.js Backend      │ ◄────────────► │ PostgreSQL │
│  React SPA   │                │   ├ API Server         │                │   (local)  │
│  Vite + TS   │                │   └ Worker (node-cron) │                │            │
└──────────────┘                └───────────┬────────────┘                └────────────┘
                                            │ fetch (1분 + 온디맨드)
                                            ▼
                          ┌──────────────────────────────────────┐
                          │ External Data Sources (무료)         │
                          │ Yahoo · SEC EDGAR · 네이버 · DART     │
                          └──────────────────────────────────────┘
```

### 데이터 흐름
- 서버 시작 시 관심종목/포트폴리오 시세 **워밍업** (1회 일괄 fetch)
- 이후 1분마다 **백그라운드 폴링** → SSE로 프론트에 푸시
- 검색해서 새 종목 진입 시 **온디맨드 fetch** + DB 캐시
- 서버 끄면 정지, 재시작 시 **stale-while-revalidate** (이전 값 즉시 표시 후 갱신)

---

## 🧰 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend | React 18, Vite, TypeScript, TailwindCSS, react-router, @tanstack/react-query, zustand, lightweight-charts, recharts |
| Backend | Node 20 LTS, Fastify, TypeScript, Prisma, node-cron, Zod, undici, p-limit |
| Database | PostgreSQL 15+ (로컬 설치) |
| 데이터 소스 | yahoo-finance2, SEC EDGAR, 네이버 금융, DART OpenAPI, Finnhub(옵션) |
| 테스트 | vitest, React Testing Library, MSW, testcontainers, Playwright(선택) |
| 패키지 매니저 | npm workspaces (monorepo lite) |

---

## 🚀 시작하기

### 사전 요구사항
- **Node 20** (nvm 사용)
- **PostgreSQL 15+** 로컬 설치 및 실행 중
- **DART API 키** (https://opendart.fss.or.kr — 무료)

### 설치
```bash
# Node 버전 맞추기 (시스템 Node 16/18은 영향 X)
nvm install 20
nvm use

# 의존성 설치
npm install

# DB 생성 및 마이그레이션
createdb algotick
npm run -w packages/server prisma:migrate

# 환경 변수 설정
cp .env.example .env
# .env 열어서 DATABASE_URL, DART_API_KEY, SEC_USER_AGENT 설정
```

### 실행
```bash
# 백엔드 (Fastify + Worker)
npm run -w packages/server dev

# 프론트엔드 (별도 터미널)
npm run -w packages/client dev

# → http://localhost:5173
```

### 서버 종료
필요할 때만 가동하는 운영 모델. `Ctrl+C`로 종료하면 워커도 함께 정지. 데이터는 PostgreSQL에 보존되어 다음 실행 시 stale-while-revalidate로 즉시 표시.

---

## 📁 디렉토리 구조

```
algotick/
├── .nvmrc                  # Node 20 고정
├── .env.example            # 환경 변수 템플릿
├── package.json            # npm workspaces
├── docs/superpowers/specs/ # 디자인 스펙
└── packages/
    ├── shared/             # 타입 + Zod 스키마 (서버/클라 공유)
    ├── server/             # Fastify + Prisma + Worker
    │   ├── prisma/
    │   └── src/
    │       ├── api/        # REST 라우트
    │       ├── adapters/   # 시장별 데이터 소스 (us-yahoo, us-sec, kr-naver, kr-dart)
    │       ├── indicators/ # 이평/RSI/MACD/볼린저 + 신호 룰
    │       ├── worker/     # node-cron 잡
    │       ├── sse/        # 실시간 푸시
    │       └── db/
    └── client/             # React SPA
        └── src/
            ├── routes/     # SPA 라우트별 페이지
            ├── features/   # 도메인별 (ticker/watchlist/portfolio/screener/compare)
            ├── components/ # 공통 UI
            ├── api/        # react-query 훅
            └── sse/        # EventSource 클라이언트
```

---

## 🗄️ 데이터 모델 요약

| 테이블 | 용도 |
|---|---|
| `tickers` | 상장 종목 마스터 (symbol, market, name) |
| `quotes_intraday` | 분봉 시세 (30일 보존) |
| `quotes_daily` | 일봉 OHLCV (영구) |
| `financials` | 재무제표 (jsonb, 분기/연간) |
| `insider_trades` | 내부자 매매 |
| `institutional_holdings` | 기관 보유 변화 |
| `news_items` | 뉴스 헤드라인 (30일 보존) |
| `watchlist` | 관심종목 |
| `portfolio_lots` | 포트폴리오 매수/매도 기록 |
| `screener_rules` | 스크리너 조건 저장 |
| `ingestion_log` | 페치 시각 추적 (stale 판정) |
| `indices` / `index_quotes_intraday` / `index_quotes_daily` | 시장 지수 (S&P500, KOSPI, VIX 등) |
| `market_events` | 시장 캘린더 (실적 발표, FOMC, CPI 등) |

> 이평선은 별도 저장 없이 `quotes_daily.close`에서 윈도우 함수로 즉석 계산.
> 상세 스키마는 [디자인 스펙 §3](docs/superpowers/specs/2026-05-19-algotick-design.md#3-데이터-모델-postgresql) 참고.

---

## ⚙️ 환경 변수 (.env)

```dotenv
# Database
DATABASE_URL="postgresql://algotick:algotick@localhost:5432/algotick"

# Server
PORT=4000
NODE_ENV=development

# Client (Vite)
VITE_API_BASE_URL="http://localhost:4000"
VITE_SSE_URL="http://localhost:4000/sse"

# External Sources
DART_API_KEY=                                    # 발급 필요
SEC_USER_AGENT="AlgoTick yourname@example.com"   # 필수
FINNHUB_API_KEY=                                 # 선택

# Polling
POLLING_INTERVAL_MS=60000
WARM_UP_ON_START=true

# Rate Limits
YAHOO_CONCURRENCY=2
NAVER_CONCURRENCY=3
SEC_CONCURRENCY=1
```

`config.ts`가 시작 시 Zod로 검증. 누락/형식 오류 시 즉시 크래시.

---

## 🛡️ 데이터 소스 주의사항

| 소스 | 주의 |
|---|---|
| Yahoo Finance | 비공식 라이브러리. 변경 가능성 있음. |
| SEC EDGAR | User-Agent에 본인 이메일 명시 의무. 분당 10회. |
| 네이버 금융 | 크롤링은 약관 회색지대 — 개인용으로만, 동시성 낮게. |
| DART OpenAPI | 무료. 일일 호출 한도 있음. |
| Finnhub | 무료 분당 60회. |

---

## 🔀 개발 워크플로우

브랜치: `main` ← `develop` ← `feature/OP-XXX-설명`
커밋: `[OP-XXX] feat|fix|refactor|chore|test: 설명`
머지: PR → develop

---

## 🧪 테스트

```bash
npm test                                # 전체
npm run -w packages/server test         # 서버만
npm run -w packages/client test         # 클라이언트만
```

---

## 📋 비범위 (현재 MVP 대상 아님)

- 인증/회원관리/멀티유저
- 모바일 앱 (반응형은 기본)
- 호가창 단위 틱 실시간
- 알림 푸시 (이메일/SMS)
- AI/LLM 자연어 요약 — 룰 기반으로 대체
- 자동 매매/주문 연동

향후 확장 가능: AI 분석, 알림, 백테스트, 추가 시장.

---

## 📄 라이선스

개인 프로젝트 (비공개).
