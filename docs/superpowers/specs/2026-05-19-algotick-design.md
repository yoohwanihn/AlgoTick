# AlgoTick — 디자인 스펙

- **작성일**: 2026-05-19
- **상태**: 합의 완료, 구현 계획 작성 대기
- **다음 단계**: `superpowers:writing-plans`로 구현 계획 작성

---

## 1. 개요

### 1.1 무엇을 만드나
**AlgoTick** — 미국·한국 주식을 검색하면 가치평가/기관·내부자 거래/기술 지표/뉴스 네 영역을 통합 분석해주는 SPA. 기준 모델은 [fintel.io](https://fintel.io/)와 [simplywall.st](https://simplywall.st/dashboard).

### 1.2 누가 쓰나
- 본인 1명 (개인용 투자 분석 도구)
- 인증/회원관리 없음, 공개 배포 없음
- 백엔드는 필요할 때만 로컬에서 가동

### 1.3 핵심 요구사항
| 항목 | 결정 |
|---|---|
| 대상 시장 | 미국(NASDAQ/NYSE) + 한국(KOSPI/KOSDAQ) |
| 데이터 소스 | 무료 API 조합 (Yahoo Finance, 네이버 금융, SEC EDGAR, DART OpenAPI) |
| 데이터 신선도 | 1분 주기 폴링 + 온디맨드 페치 |
| 분석 영역 (MVP) | ① 기업 가치평가 ② 기관/내부자 거래 ③ 기술 지표 + 차트 ④ 뉴스 리스트 |
| 부가 기능 | 관심종목, 포트폴리오 추적, 종목 비교(2~3개), 스크리닝, **시황 분석** |
| 차트 자동 분석 | 룰 기반 신호 감지 + 한 줄 해설 + 차트 마커 (LLM 미사용) |
| 테마 | 다크/라이트 토글 |
| 서버 운영 | 사용 시에만 가동 |

### 1.4 비범위(YAGNI)
- 사용자 인증/회원관리/멀티유저
- 모바일 앱
- 실시간 호가창(WebSocket 기반 틱 단위 데이터)
- 알림 푸시(이메일/SMS)
- AI/LLM 기반 자연어 요약 — 룰 기반 신호로 대체
- 자동 매매/주문 연동

---

## 2. 시스템 아키텍처

### 2.1 전체 구성
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
                          │ • Yahoo Finance (yahoo-finance2)     │
                          │ • SEC EDGAR (13F · Form4)            │
                          │ • 네이버 금융 (크롤링)               │
                          │ • DART OpenAPI (공시·지분)           │
                          │ • Finnhub (옵션)                     │
                          │ • RSS (뉴스)                         │
                          └──────────────────────────────────────┘
```

### 2.2 기술 스택

#### Frontend
- **React 18** + **Vite** + **TypeScript**
- **TailwindCSS** (다크/라이트 토글)
- **react-router** (SPA 라우팅)
- **@tanstack/react-query** (서버 상태)
- **zustand** (UI 상태 — 테마, 활성 탭)
- **lightweight-charts** (캔들/라인 + 이평선) — TradingView 제공
- **recharts** (지표 바/도넛 등 보조 차트)
- **EventSource** (SSE 수신, 표준 API)

#### Backend
- **Node 20 LTS** (`.nvmrc`로 프로젝트별 고정. 시스템 Node 16/18은 영향 X)
- **Fastify** + **TypeScript**
- **Prisma** (ORM, 마이그레이션)
- **node-cron** (백그라운드 워커 — 같은 프로세스 내 실행)
- **Zod** (런타임 스키마 검증)
- **dotenv** (환경 설정)
- **undici** + **p-limit** (HTTP + rate-limit)

#### Database
- **PostgreSQL 15+** (로컬 설치, Docker 미사용)
- 모든 연결정보는 `.env`의 `DATABASE_URL`

### 2.3 Adapter 패턴
시장별 데이터 소스 차이를 흡수하기 위한 어댑터.

```typescript
// packages/server/src/adapters/base.ts
interface MarketAdapter {
  market: 'US' | 'KR';
  getQuote(symbol: string): Promise<Quote>;
  getDailyOHLCV(symbol: string, from: Date, to: Date): Promise<Candle[]>;
  getFinancials(symbol: string): Promise<Financials>;
  getInsiderTrades(symbol: string): Promise<InsiderTrade[]>;
  getInstitutionalHoldings(symbol: string): Promise<InstitutionalHolding[]>;
  getNews(symbol: string): Promise<NewsItem[]>;
}
```

| 어댑터 | 시장 | 사용 소스 |
|---|---|---|
| `us-yahoo` | 미국 | Yahoo Finance (시세/재무) |
| `us-sec` | 미국 | SEC EDGAR (13F, Form 4) |
| `kr-naver` | 한국 | 네이버 금융 (시세/재무, 크롤링) |
| `kr-dart` | 한국 | DART OpenAPI (공시, 5% 지분, 임원 지분) |

> **주의:** 네이버 금융 크롤링은 약관상 회색지대. 개인 용도로만 사용. 차단 위험 있으니 적정 동시성 유지(.env로 조절).

---

## 3. 데이터 모델 (PostgreSQL)

### 3.1 테이블 그룹

#### 그룹 ① — 시장 마스터
**`tickers`** — 상장 종목 메타정보
| 컬럼 | 타입 | 비고 |
|---|---|---|
| symbol (PK) | text | "AAPL", "005930.KS" |
| market | text | "US" / "KR" |
| exchange | text | NASDAQ/NYSE/KOSPI/KOSDAQ |
| name_en, name_ko | text | 영문/한글명 |
| sector, industry | text | |
| currency | text | "USD" / "KRW" |
| listed_at, delisted_at | date | |

#### 그룹 ② — 시세 (시계열)
**`quotes_intraday`** — 분봉 시세 (30일 보존 후 정리)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| (symbol, ts) (PK) | text, timestamptz | BRIN 인덱스 |
| price | numeric | |
| volume | bigint | |
| change_pct | numeric | |
| source | text | "yahoo" / "naver" |

**`quotes_daily`** — 일봉 OHLCV (영구 보관)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| (symbol, date) (PK) | text, date | |
| open, high, low, close, adj_close | numeric | |
| volume | bigint | |

> 이평선(5/20/60/120)은 별도 저장하지 않고 `quotes_daily.close`에서 PostgreSQL 윈도우 함수로 즉석 계산. `packages/server/src/indicators/` 모듈이 처리.

#### 그룹 ③ — 분석 데이터
**`financials`** — 재무제표
| 컬럼 | 타입 | 비고 |
|---|---|---|
| (symbol, period) (PK) | text, text | period: "2025Q4" / "2025A" |
| period_type | text | "Q" / "A" |
| data | jsonb | 시장별 항목 차이 흡수 |

**`insider_trades`** — 내부자 매매
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id (PK) | uuid | |
| symbol, trade_date | text, date | |
| person_name, role | text | |
| side | text | "BUY" / "SELL" |
| shares, price | numeric | |

**`institutional_holdings`** — 기관 보유
| 컬럼 | 타입 | 비고 |
|---|---|---|
| (symbol, holder_name, period) (PK) | text, text, text | |
| shares, pct_of_float | numeric | |
| change_qoq | numeric | 분기 대비 변화 |

**`news_items`** — 뉴스 (30일 보존)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id (PK) | uuid | |
| symbol, published_at | text, timestamptz | symbol NULL 가능 (시장 전반 뉴스) |
| scope | text | "ticker" / "market" |
| market | text | NULL/"US"/"KR" |
| title, source, url | text | |

**`indices`** — 시장 지수 마스터 (S&P500, NASDAQ, KOSPI 등)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| code (PK) | text | "^GSPC", "^IXIC", "^KS11", "^KQ11", "^VIX" |
| name | text | "S&P 500", "KOSPI" |
| market | text | "US" / "KR" / "GLOBAL" |
| kind | text | "index" / "volatility" / "fx" |

**`index_quotes_intraday`** — 지수 분봉 (30일)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| (code, ts) (PK) | text, timestamptz | |
| value | numeric | |
| change_pct | numeric | |

**`index_quotes_daily`** — 지수 일봉 (영구)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| (code, date) (PK) | text, date | |
| open, high, low, close | numeric | |

**`market_events`** — 시장 캘린더 (실적/매크로)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id (PK) | uuid | |
| event_date | date | |
| market | text | "US" / "KR" / "GLOBAL" |
| kind | text | "earnings" / "fomc" / "cpi" / "pce" / "boe" / "옵션만기" 등 |
| symbol | text | NULL 가능 (실적인 경우 종목, 매크로는 NULL) |
| title | text | "Apple Q2 실적 발표" |
| meta | jsonb | 시장 컨센서스/실제치 등 |

> 등락률 상위/하위, 거래량 급증, 섹터 등락은 별도 테이블 없이 `quotes_daily` + `quotes_intraday` + `tickers.sector`로 SQL 쿼리에서 즉석 집계.

#### 그룹 ④ — 사용자 데이터
- **`watchlist`**: symbol(PK), added_at, memo
- **`portfolio_lots`**: id, symbol, side, qty, price, traded_at
- **`screener_rules`**: id, name, conditions(jsonb)
- **`settings`**: key(PK), value(jsonb)

#### 그룹 ⑤ — 메타
**`ingestion_log`** — 페치 추적 (stale 판정용)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| (symbol, kind) (PK) | text, text | kind: "quote" / "financials" / ... |
| last_fetched_at | timestamptz | |

### 3.2 인덱스
- `quotes_intraday`: BRIN on (ts) — 시계열 효율
- `quotes_daily`: BTREE on (symbol, date DESC)
- `financials`: BTREE on (symbol, period DESC)
- `insider_trades`: BTREE on (symbol, trade_date DESC)
- `news_items`: BTREE on (symbol, published_at DESC), BTREE on (scope, market, published_at DESC) — 시장 뉴스 조회용
- `index_quotes_intraday`: BRIN on (ts)
- `index_quotes_daily`: BTREE on (code, date DESC)
- `market_events`: BTREE on (event_date, market) — 캘린더 조회용

---

## 4. 페이지 구조

### 4.1 라우트
| 경로 | 설명 |
|---|---|
| `/` | 대시보드 — 관심종목 미니카드 그리드 |
| `/market` | **시황 분석** — 시장 전반 현황 (지수/섹터/등락상위/캘린더) |
| `/search?q=...` | 검색 결과 |
| `/ticker/:symbol` | 종목 상세 (5탭) |
| `/portfolio` | 포트폴리오 — 수익률/손익/배분 |
| `/screener` | 스크리너 — 조건 빌더 + 결과 |
| `/compare?s=AAPL,MSFT` | 종목 비교 (2~3개) |
| `/settings` | 설정 (UI 외관 설정) |

### 4.2 종목 상세 페이지 — 핵심 화면

#### 상단 시각화 요약
- **5축 스코어카드 (레이더)**: 가치 / 성장 / 건전성 / 배당 / 기관
- **핵심 재무 그리드**: PER / PBR / ROE / PSR / 시가총액 / 배당수익률
- **최근 신호 박스**: 골든크로스, RSI 상태, 기관 보유 변화, 내부자 매수 등 룰 기반 신호 요약

#### 하단 5탭
1. **📊 차트** — 캔들/라인, 이평선 5/20/60/120 토글, 보조지표(RSI/MACD/볼린저밴드), 신호 마커
2. **💎 가치평가** — 분기/연간 재무제표, PER/PBR/PSR 시계열, 동종업계 비교
3. **🏛️ 기관/내부자** — 상위 기관 보유율 변화(QoQ), 내부자 매매 타임라인. 미주=13F+Form4 / 한주=DART
4. **📰 뉴스** — 최신 헤드라인 + 출처 + 외부 링크
5. **📋 개요** — 회사 소개, 사업 구조, 경쟁사 링크, 공시/실적 일정

### 4.3 차트 자동 분석 (룰 기반)

LLM 없이 신호별 템플릿 문자열로 한 줄 해설 + 차트 시점 마커.

| 신호 종류 | 감지 룰 | 마커 |
|---|---|---|
| 골든크로스 | 5MA가 20MA를 상향 돌파 | ▲ |
| 데드크로스 | 5MA가 20MA를 하향 돌파 | ▼ |
| 정배열 | 5MA > 20MA > 60MA > 120MA | 라벨 |
| 역배열 | 5MA < 20MA < 60MA < 120MA | 라벨 |
| 볼린저 스퀴즈 | 밴드 폭이 60일 평균의 70% 이하 | ● |
| 볼린저 익스팬션 | 밴드 폭이 60일 평균의 130% 이상 | ● |
| RSI 과매수/과매도 | RSI > 70 / RSI < 30 | ● |
| MACD 교차 | MACD가 시그널선 상향/하향 돌파 | ▲/▼ |
| 거래량 급증 | 20일 평균 거래량의 2배 초과 | ● |

> 임계값(70/130/2배 등)은 `packages/server/src/indicators/signals.ts` 상수로 노출. 추후 사용자 설정에서 조정 가능하도록 확장 여지.

> 신호 룰은 `packages/server/src/indicators/signals.ts`에 단일 모듈로. 향후 확장 시 룰만 추가.

### 4.4 시황 분석 페이지 (`/market`)

종목 단위가 아닌 **시장 전체 현황**을 한 페이지에서. 미국·한국 시장 토글 가능.

#### 상단 헤더
- 시장 선택 토글: 🇺🇸 미국 / 🇰🇷 한국 / 글로벌(둘 다)
- 장 상태 배지: "🟢 정규장 진행중" / "🟡 시간외" / "🔴 휴장"
- 마지막 갱신 시각

#### 섹션 구성

1. **주요 지수 카드** — 한 줄에 4~6개
   - 미국: S&P 500, NASDAQ Composite, Dow Jones, Russell 2000, **VIX**(공포 지수)
   - 한국: KOSPI, KOSDAQ, **V-KOSPI**(변동성 지수), USD/KRW
   - 각 카드: 현재값, 등락률, 미니 스파크라인(당일 분봉)

2. **섹터 히트맵** — 11개 GICS 섹터 (또는 한국 업종)
   - 색상: 등락률 (-3% 빨강 ~ 0% 회색 ~ +3% 초록)
   - 면적: 시가총액 비중
   - 클릭 시 해당 섹터 종목 리스트로

3. **등락률 상위/하위 TOP 10** — 두 열로
   - 좌: 상승률 TOP 10 (오늘)
   - 우: 하락률 TOP 10
   - 각 행: 종목명/티커, 등락률, 거래량, 마지막 가격

4. **거래량 급증 종목** — TOP 10
   - 20일 평균 거래량 대비 배수 큰 순
   - 가격 급변동 종목 발견용

5. **시장 분위기 지표**
   - Fear & Greed (CNN 데이터 / 옵션)
   - 시장 폭(advance/decline)
   - 신고가/신저가 종목 수
   - 52주 신고가 대비 위치

6. **시장 캘린더** — 향후 7일
   - 실적 발표 일정 (관심종목 우선 표시)
   - 미국: FOMC, CPI, PCE, 고용지표 등 매크로
   - 한국: 금통위, 옵션만기일 등

7. **주요 시장 뉴스** — 종목 단위가 아닌 시장 전반 (RSS)

#### 데이터 갱신
- 지수/섹터: 1분 폴링 (워커 추가 잡)
- 시장 캘린더: 일 1회 갱신
- 시장 뉴스: 30분
- 페이지 진입 시 SSE 구독 → 지수/등락 상위 실시간 푸시

---

## 5. 데이터 흐름 (인제스천 & 실시간)

### 5.1 서버 라이프사이클

#### Phase 1: 서버 시작 (warm-up)
1. `config.ts`가 `.env` 로드 + Zod 검증
2. Prisma DB 연결
3. 워커가 관심종목 + 포트폴리오 종목 symbol 리스트 조회
4. 각 symbol에 대해 Adapter들을 병렬로 호출(rate-limit 적용) — 시세, 재무, 공시
5. **시장 지수**(S&P500/NASDAQ/Dow/VIX/KOSPI/KOSDAQ/V-KOSPI/USD-KRW) 시세 갱신
6. **시장 캘린더**(향후 7일치 실적/매크로 일정) — 마지막 갱신 1일 경과 시
7. 결과를 UPSERT, `ingestion_log` 업데이트
8. node-cron 시작 (1분 간격)
9. Fastify 리스닝 시작

#### Phase 2: 종목 상세 진입 (사용자 액션)
1. 프론트: `GET /api/ticker/AAPL`
2. 서버: DB에서 캐시 조회 + `ingestion_log.last_fetched_at` 확인
3. **캐시 hit & not stale** → 즉시 응답
4. **캐시 hit & stale** → 즉시 stale 데이터 응답 (stale 플래그) + 백그라운드 Adapter 호출 → 완료 시 SSE `data-updated` 푸시 → 프론트가 react-query invalidate
5. **캐시 miss (처음 본 종목)** → 동기 페치 (프론트는 스피너 표시) → DB 저장 + `ingestion_log` 갱신 → 응답

#### Phase 3: 1분 주기 폴링 (워커 tick)
1. 대상: 관심종목 + 포트폴리오 종목 + 현재 SSE 구독 중인 종목 + **주요 시장 지수** (항상)
2. 각 Adapter 병렬 호출
3. 변동 있는 항목만 SSE 푸시 (`quote-tick` / `index-tick` 이벤트)

#### Phase 4: 서버 종료
1. node-cron 정지
2. SSE 연결 정리
3. DB 연결 종료
4. 데이터는 PostgreSQL에 그대로 보존. 재시작 시 stale-while-revalidate.

### 5.2 SSE 구독 모델

```
프론트 mount       → EventSource('/sse') 연결
종목 상세 진입     → POST /sse/subscribe { symbols: ['AAPL'] }
다른 페이지로 이동 → POST /sse/unsubscribe { symbols: ['AAPL'] }
탭 백그라운드      → visibilitychange로 자동 unsubscribe
탭 복귀            → 자동 resubscribe
```

### 5.3 Stale 정책

| 데이터 | stale 임계 |
|---|---|
| 시세 (intraday) | 60초 |
| 일봉 OHLCV | 장 마감 후 1회 + 마지막 갱신 6시간 경과 (둘 중 빠른 쪽) |
| 재무제표 | 7일 |
| 내부자/기관 거래 | 1일 |
| 뉴스 RSS (종목) | 30분 |
| 뉴스 RSS (시장 전반) | 30분 |
| 상장 마스터 | 7일 |
| 지수 (intraday) | 60초 |
| 지수 (daily) | 장 마감 후 1회 + 6시간 |
| 시장 캘린더 (실적/매크로) | 1일 |

### 5.4 Rate Limit & 회복력
- 각 Adapter는 `p-limit`으로 동시 호출 수 제한 (.env로 조절)
- 지수 백오프 재시도 (3회, 1s → 3s → 9s, 최대 30s)
- Adapter 격리: A 어댑터 실패해도 B는 정상
- 실패 시 마지막 성공값 + stale 플래그로 표시

### 5.5 사용자 신호 (UI)
- "마지막 갱신 14초 전 · 1분 폴링 중" — 헤더
- "갱신 중..." — 온디맨드 fetch 진행
- "⚠️ 1시간 전 · 새로고침" — stale
- "📴 오프라인 데이터" — 외부 API 전체 실패

---

## 6. 디렉토리 구조

```
algotick/
├── .nvmrc                  # 20
├── .env.example
├── .env                    # gitignore
├── .gitignore
├── package.json            # npm workspaces 루트
├── README.md
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-05-19-algotick-design.md   # 본 문서
└── packages/
    ├── shared/             # 타입 + Zod 스키마
    │   ├── src/
    │   │   ├── schema/     # quote.ts, financial.ts, ticker.ts ...
    │   │   └── types.ts
    │   ├── package.json
    │   └── tsconfig.json
    ├── server/             # Fastify + Prisma + Worker
    │   ├── prisma/
    │   │   ├── schema.prisma
    │   │   └── migrations/
    │   ├── src/
    │   │   ├── index.ts            # 엔트리
    │   │   ├── config.ts           # .env 로드 + Zod
    │   │   ├── api/                # 라우트
    │   │   │   ├── search.ts
    │   │   │   ├── ticker.ts
    │   │   │   ├── market.ts       # 시황 (지수/섹터/캘린더)
    │   │   │   ├── watchlist.ts
    │   │   │   ├── portfolio.ts
    │   │   │   ├── screener.ts
    │   │   │   └── sse.ts
    │   │   ├── adapters/
    │   │   │   ├── base.ts
    │   │   │   ├── us-yahoo.ts
    │   │   │   ├── us-sec.ts
    │   │   │   ├── kr-naver.ts
    │   │   │   └── kr-dart.ts
    │   │   ├── indicators/         # 이평/RSI/MACD/볼린저 + 신호 룰
    │   │   ├── worker/             # node-cron 잡
    │   │   ├── sse/                # 구독/푸시 관리
    │   │   └── db/                 # Prisma client wrapper
    │   ├── tests/
    │   ├── package.json
    │   └── tsconfig.json
    └── client/             # React SPA
        ├── index.html
        ├── src/
        │   ├── main.tsx
        │   ├── App.tsx
        │   ├── routes/             # SPA 라우트별 페이지
        │   ├── components/         # 공통 UI
        │   ├── features/           # 도메인별
        │   │   ├── ticker/
        │   │   ├── market/         # 시황 분석 페이지
        │   │   ├── watchlist/
        │   │   ├── portfolio/
        │   │   ├── screener/
        │   │   └── compare/
        │   ├── api/                # react-query 훅
        │   ├── sse/                # EventSource 클라이언트
        │   └── lib/                # 포맷터/유틸
        ├── tests/
        ├── vite.config.ts
        ├── package.json
        └── tsconfig.json
```

---

## 7. 환경 설정 (.env.example)

```dotenv
# === Database (PostgreSQL 로컬) ===
DATABASE_URL="postgresql://algotick:algotick@localhost:5432/algotick"

# === Server ===
PORT=4000
NODE_ENV=development
LOG_LEVEL=info

# === Client (Vite) ===
VITE_API_BASE_URL="http://localhost:4000"
VITE_SSE_URL="http://localhost:4000/sse"

# === External Data Sources ===
DART_API_KEY=                                    # https://opendart.fss.or.kr (무료)
SEC_USER_AGENT="AlgoTick yourname@example.com"   # SEC EDGAR 정책상 필수
FINNHUB_API_KEY=                                 # 선택

# === Polling ===
POLLING_INTERVAL_MS=60000
WARM_UP_ON_START=true

# === Rate Limits ===
YAHOO_CONCURRENCY=2
NAVER_CONCURRENCY=3
SEC_CONCURRENCY=1
```

`config.ts`가 시작 시 Zod로 모든 env 검증. 누락/형식 오류 시 즉시 크래시.

---

## 8. 에러 처리 전략

### 8.1 Server (Fastify)
- 전역 `errorHandler` — 표준 JSON 응답 (`{error: {code, message, details}}`)
- Zod 검증 실패 → 400 + 어떤 필드가 틀렸는지
- 외부 API 실패 → Adapter에서 잡고 partial 응답 + `stale` 플래그
- DB 연결 끊김 → Prisma 자동 재연결 + `/health` 헬스체크
- 워커 잡 실패 → 다음 tick 자동 복구, 로그 남김

### 8.2 Client (React)
- 최상위 `ErrorBoundary` — 흰 화면 방지 + "다시 시도" 버튼
- `react-query.onError` → 토스트 + 자동 재시도 (3회 지수 백오프)
- SSE 끊김 시 자동 재연결 (3s → 6s → 12s)
- 빈 데이터 → `EmptyState` 컴포넌트 (가이드 문구)
- stale 데이터는 카드 모서리 🟡 + 새로고침 액션

---

## 9. 테스트 전략

| 레이어 | 도구 | 대상 |
|---|---|---|
| 서버 unit | vitest | indicators 모듈, Adapter 파싱, config 검증 |
| 서버 integration | vitest + testcontainers | API 라우트 → 실제 PostgreSQL → 응답 검증 |
| Adapter contract | vitest + fixture | 외부 API 응답 캡처로 회귀 테스트 (네트워크 없이) |
| 클라 unit | vitest + RTL | 컴포넌트 렌더 / 인터랙션 / 포맷터 |
| 클라 통합 | vitest + MSW | react-query 훅, SSE 핸들러 모의 |
| E2E (선택) | Playwright | "검색 → 상세 → 관심추가" 등 핵심 플로우 1~2개 |

개인용이라 100% 커버리지보다는 핵심 모듈(indicators, Adapter, API) 위주.

---

## 10. Git 워크플로우

사용자 표준 Git 브랜치 전략 따름 (`~/.claude/projects/-mnt-c-Users-USER/memory/git_branch_strategy.md` 참고).

```
main          (안정)
└── develop   (개발 통합)
    ├── feature/OP-001-init-monorepo
    ├── feature/OP-002-prisma-schema
    └── feature/OP-XXX-...
```

- 커밋 형식: `[OP-XXX] feat|fix|refactor|chore|test: 설명`
- OP 번호는 본 프로젝트 한정 OP-001부터 채번
- 모든 기능 추가 = feature 브랜치 → PR → develop 머지
- GitHub 등록: `gh repo create AlgoTick --private --source=.` (writing-plans 단계에서 OP-001 작업 중)

---

## 11. 데이터 소스 사용 시 주의사항

| 소스 | 약관/주의 |
|---|---|
| Yahoo Finance | 비공식 라이브러리(yahoo-finance2) 사용. 공식 API 아님. 변경 가능성 있음. |
| SEC EDGAR | `User-Agent`에 본인 이메일 명시 의무. 분당 10회 제한. |
| 네이버 금융 | 크롤링은 약관상 회색지대. 개인 용도로만, 동시성 낮게 유지. |
| DART OpenAPI | 무료. API 키 발급 필요. 일일 호출 한도 있음. |
| Finnhub | 무료 등급 분당 60회. 옵션. |

---

## 12. 향후 확장 (out of MVP)

다음은 의도적으로 MVP에서 제외, 추후 확장 가능:
- **레벨 3 종합 기술 분석 패널** (별도 탭): 신호 히스토리, 점수화, 백테스트 통계
- **알림**: 관심종목 가격/지표 변화 시 데스크탑 알림
- **AI/LLM 요약**: Claude/GPT 연동한 자연어 분석 (현재 룰 기반으로 충분)
- **모바일**: 반응형은 기본, PWA는 후순위
- **추가 시장**: 일본/홍콩/유럽 등 Adapter 추가만 하면 가능
- **자동 매매 연동**: 명시적으로 제외

---

## 13. 다음 단계

1. 본 스펙 사용자 리뷰 → 승인
2. `superpowers:writing-plans`로 구현 계획 작성 (작업 항목 단위로 분해)
3. `superpowers:executing-plans` 또는 직접 OP-001부터 구현 시작
