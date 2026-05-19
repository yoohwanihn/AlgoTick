# AlgoTick

미국·한국 주식을 검색하면 가치평가·기관/내부자 거래·기술 지표·뉴스를 한 페이지에서 분석해주는 개인용 SPA.

> **참고**: [fintel.io](https://fintel.io/) · [simplywall.st](https://simplywall.st/dashboard)

---

## 핵심 기능

- **검색** — 미국(NASDAQ/NYSE) + 한국(KOSPI/KOSDAQ) 통합 (100+ 종목 시드)
- **종목 상세 (5탭)** — 차트 · 가치평가 · 기관/내부자 · 뉴스 · 개요
- **차트 자동 분석** — 이평선(5/20/60/120) + RSI + MACD + 볼린저 + 룰 기반 신호(골든크로스/스퀴즈/RSI 과매수 등 11종) + 차트 시점 마커
- **가치평가** — 미주 Finnhub TTM + 한주 네이버 연간 시계열 (PER/PBR/ROE/EPS/배당)
- **내부자 거래** — 미주 Finnhub /insider-transactions (SEC Form 4 기반)
- **뉴스** — 미주 Finnhub /company-news + 한주 네이버 모바일 뉴스
- **개요** — Finnhub 회사 프로필 (로고/IPO/웹사이트/산업)
- **시황 분석** — 주요 지수(S&P500/NASDAQ/Dow/VIX/KOSPI/KOSDAQ/USDKRW) · 섹터 히트맵 · 등락 TOP10 · 거래량 급증 · 시장 캘린더(실적/매크로) · 시장 뉴스
- **관심종목** — 1분 주기 백그라운드 폴링 + 대시보드 그리드
- **포트폴리오 추적** — BUY/SELL lot 입력 → 가중평균 cost + 평가금액 + 손익/수익률
- **스크리너** — 조건 빌더 (PER/PBR/ROE/시가총액/시장 등) + AND 결합 + 룰 저장
- **종목 비교** — 2~3개 옆에 놓고 지표 비교 + 180일 가격 정규화 오버레이 차트
- **다크/라이트 토글** (zustand persist)
- **데이터 신뢰도·교차검증** — Adapter 응답은 DB 저장 전 Validator 통과 필수 (시가총액 정합성 / OHLC 불변식 / 시계열 점프 / 범위 합리성). 모든 메트릭에 출처/신뢰도 태그(●실제 / ◐추정 / ○가정)
- **금융 용어 풀이** — UI ⓘ 호버 시 한국어 풀이 표시
- **실시간 푸시** — SSE로 관심종목 가격 1분마다 갱신, LIVE 배지

---

## 아키텍처

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
                          │ Yahoo · Finnhub · 네이버 금융         │
                          └──────────────────────────────────────┘
```

### 데이터 흐름
- 서버 시작 시 관심종목/포트폴리오 시세 **warm-up** (1회 일괄 fetch)
- 이후 1분마다 **백그라운드 폴링** → SSE로 프론트에 푸시
- 시황 지수는 5분마다 별도 갱신
- 검색해서 새 종목 진입 시 **온디맨드 fetch** + DB 캐시
- 서버 끄면 정지, 재시작 시 **stale-while-revalidate**

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend | React 18, Vite, TypeScript, TailwindCSS, react-router 6, @tanstack/react-query, zustand, lightweight-charts, recharts |
| Backend | Node 20 LTS, Fastify 4, TypeScript, Prisma 5, node-cron, Zod, undici, p-limit |
| Database | PostgreSQL 14+ (로컬 설치) |
| 데이터 소스 | undici 직접 HTTP — Yahoo Finance(미주 시세/일봉/지수), Finnhub(미주 재무/뉴스/내부자/프로필/캘린더), 네이버 금융(한주 시세/일봉/재무/뉴스) |
| 테스트 | vitest, React Testing Library, MSW |
| 패키지 매니저 | npm workspaces (monorepo lite) |

---

## 시작하기

### 사전 요구사항
- **Node 20** (nvm 사용 — `.nvmrc` 자동 적용)
- **PostgreSQL 14+** 로컬 설치 및 실행
- **Finnhub API 키** (https://finnhub.io — 무료 60req/min)
- **DART API 키** (옵션, https://opendart.fss.or.kr)

### 설치
```bash
nvm install 20 && nvm use
npm install

# DB 생성
createdb algotick

# 환경 변수
cp .env.example .env
# .env 열어서 DATABASE_URL, FINNHUB_API_KEY, SEC_USER_AGENT 설정

# 마이그레이션 + 시드
npm run -w packages/server prisma:migrate
npm run -w packages/server seed           # 100+ 종목
npm run -w packages/server seed:indices   # 7개 지수
```

### 실행
```bash
# 백엔드 (Fastify + Worker)
npm run -w packages/server dev

# 프론트엔드 (별도 터미널)
npm run -w packages/client dev

# → http://localhost:5173
```

### 운영 도구
- `GET /health` — DB 연결 상태
- `GET /api/__stats__` — DB row counts + 검증 경고 카운트 + 최근 인제스천 로그
- `GET /api/__validations__?severity=warning&limit=50` — 최근 검증 결과 디버그

---

## 디렉토리 구조

```
algotick/
├── .nvmrc                  # Node 20
├── .env.example
├── package.json            # npm workspaces
└── packages/
    ├── shared/             # 타입 + Zod 스키마 (서버/클라 공유)
    ├── server/             # Fastify + Prisma + Worker
    │   ├── prisma/
    │   └── src/
    │       ├── api/        # REST 라우트 (health/search/ticker/watchlist/portfolio/screener/compare/market/ops/sse)
    │       ├── adapters/   # us-yahoo, kr-naver, router, base
    │       ├── indicators/ # SMA/RSI/MACD/볼린저 + 신호 룰
    │       ├── validators/ # 시가총액/OHLC/시계열/범위 검증
    │       ├── worker/     # node-cron 잡 (1분 폴링 + 5분 지수)
    │       ├── sse/        # 실시간 푸시
    │       ├── services/   # ticker/portfolio/screener/compare/market 비즈 로직
    │       └── db/
    └── client/             # React SPA
        └── src/
            ├── routes/     # Dashboard / Search / Ticker / Portfolio / Screener / Compare / Market
            ├── features/   # (도메인 컴포넌트)
            ├── components/ # ticker/, ui/, layout/
            ├── api/        # raw fetch wrappers
            ├── hooks/      # react-query 훅들
            ├── sse/        # EventSource 연결
            └── store/      # zustand (테마, sse)
```

---

## 데이터 모델 (PostgreSQL)

| 테이블 | 용도 |
|---|---|
| `tickers` | 상장 종목 마스터 (symbol, market, sector, profile) |
| `quotes_intraday` | 분봉 시세 |
| `quotes_daily` | 일봉 OHLCV |
| `financials` | 재무 (jsonb, 분기/연간) |
| `insider_trades` | 내부자 매매 |
| `news_items` | 뉴스 (종목별 + 시장 전반) |
| `indices` / `index_quotes_*` | 시장 지수 |
| `market_events` | 시장 캘린더 (실적/매크로) |
| `watchlist` | 관심종목 |
| `portfolio_lots` | 포트폴리오 매매 기록 |
| `screener_rules` | 스크리너 조건 저장 |
| `ingestion_log` | 페치 시각 추적 (stale 판정) |
| `validation_results` | Adapter 응답 교차검증 결과 |

> 이평선은 별도 저장 없이 `quotes_daily.close`에서 윈도우 함수로 즉석 계산.

---

## 환경 변수 (.env)

```dotenv
DATABASE_URL="postgresql://algotick:algotick@localhost:5432/algotick"
PORT=4000
NODE_ENV=development

VITE_API_BASE_URL="http://localhost:4000"
VITE_SSE_URL="http://localhost:4000/sse"

FINNHUB_API_KEY=<your key>
SEC_USER_AGENT="AlgoTick yourname@example.com"
DART_API_KEY=                                  # 옵션

POLLING_INTERVAL_MS=60000
WARM_UP_ON_START=true

YAHOO_CONCURRENCY=2
NAVER_CONCURRENCY=3
SEC_CONCURRENCY=1
WATCHLIST_SYMBOLS=                              # 옵션 — DB watchlist + 이 env 둘 다 폴링
```

---

## 데이터 소스 주의사항

| 소스 | 주의 |
|---|---|
| Yahoo Finance | 비공식 endpoint. v7/quote는 차단됨, v8/chart만 사용. |
| Finnhub | 무료 60req/min. ownership endpoint는 유료. |
| 네이버 금융 | 모바일 API 사용. 약관 회색지대 — 개인용으로만, 동시성 낮게. |
| DART OpenAPI | 무료. API 키 발급 필요. 일일 한도 있음. |

---

## 개발 워크플로우

브랜치: `main` ← `develop` ← `feature/OP-XXX-설명`
커밋: `[OP-XXX] feat|fix|refactor|chore|test: 설명`
머지: PR → develop → main + stage-N 태그

---

## 테스트

```bash
npm test                                # 전체
npm run -w packages/server test         # 서버 (~113 tests)
npm run -w packages/client test         # 클라이언트 (12 tests)
```

---

## 변경 이력

[CHANGELOG.md](CHANGELOG.md) 참고.

---

## 라이선스

개인 프로젝트 (비공개).
