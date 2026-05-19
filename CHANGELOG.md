# AlgoTick Changelog

## stage-8 — 운영 도구 + 마무리 (2026-05-20)
- `/api/__stats__` — DB row counts + 검증 경고 카운트 + 최근 인제스천 로그
- `/api/__validations__` — 최근 검증 결과 디버그 라우트
- README.md 통째 업데이트 (Stage 1~7 모든 기능 반영)
- CHANGELOG.md 작성

## stage-7 — 시황 분석 페이지 `/market` (2026-05-20)
- `MarketIndex`/`IndexQuoteIntraday`/`IndexQuoteDaily`/`MarketEvent` 4 테이블 추가
- 7개 지수 시드 (S&P500/NASDAQ/Dow/VIX/KOSPI/KOSDAQ/USDKRW)
- Yahoo chart endpoint로 지수 시세 갱신 (5분 주기 워커)
- Finnhub /news?category=general 시장 뉴스 30건
- Finnhub /calendar/earnings + /calendar/economic 캘린더 페치
- 섹터 히트맵 (latest intraday quote 기반 SQL 집계)
- 등락률 TOP10 (up/down) + 거래량 TOP10
- MarketPage: 시장 토글 + 지수 그리드 + 섹터 + 모버 + 캘린더 + 뉴스

## stage-6 — 사용자 데이터 (2026-05-20)
- 관심종목: watchlist 테이블 + CRUD API + DashboardPage 그리드 + WatchlistButton + 워커 통합
- 포트폴리오: portfolio_lots + 가중평균 cost 계산 + 평가손익 + /portfolio 페이지 + 워커 통합
- 스크리너: screener_rules + 조건 빌더(7 fields × 6 ops, AND) + 룰 저장/실행 + /screener
- 종목 비교: 2~3개 옆에 놓고 비교 + 180일 정규화 차트 오버레이(SVG)

## stage-5 — 재무 + 뉴스 + 내부자 + 개요 (2026-05-20)
- **5a**: `financials` 테이블 + 네이버 finance/annual 한주 재무 페치 + ValuationTab
- **5b**: Finnhub /stock/metric 미주 TTM 재무 통합
- **5c**: `news_items` 테이블(scope=ticker|market) + Finnhub /company-news + 네이버 뉴스 + NewsTab
- **5d**: `insider_trades` + Finnhub /insider-transactions + InstitutionalTab (매수/매도 분류)
- **5e**: tickers 프로필 컬럼 확장(description/weburl/logo/ipo/country) + Finnhub /stock/profile2 + OverviewTab

## stage-4 — 한국 시장 (2026-05-19)
- `kr-naver.ts` — 네이버 모바일 API 직접 HTTP (시세/일봉/검색)
- `adapters/router.ts` — market별 us-yahoo / kr-naver 자동 분기
- 한국어 단위 파싱 ("1,610조 6,498억" → 161064980000000)
- /api/ticker/005930.KS 정상 응답 (이전 501 NOT_IMPLEMENTED 제거)
- 워커가 한주도 폴링

## stage-3 — Worker + SSE + Indicators (2026-05-19)
- Indicators 모듈: SMA/RSI/MACD/볼린저 + 11종 신호 감지
- node-cron 워커: warm-up + 1분 폴링
- SSE Hub: /sse 연결 + /sse/subscribe/unsubscribe + 시세 변동 시 broadcast
- 차트 자동 분석: 신호별 한 줄 해설 + 차트 마커
- TickerHeader 실시간 가격 + LIVE 배지
- SignalPanel: 신호 리스트 (positive/negative/warning/info 색상)

## stage-2 — 프론트엔드 walking skeleton (2026-05-19)
- React 18 + Vite + TypeScript + TailwindCSS
- React Router (Dashboard/Search/Ticker/NotFound)
- @tanstack/react-query + EventSource 기초
- SearchBar (자동완성 + 키보드 네비) + /search 페이지
- TickerDetailPage: TickerHeader + TickerSummary + 5탭(ChartPanel)
- lightweight-charts 캔들 + 이평선 5/20/60/120
- UI: Metric (신뢰도 아이콘 + 호버 툴팁) + WarningBadge + GlossaryTooltip
- 다크/라이트 토글 (zustand persist + FOUC 방지)
- vitest + RTL + MSW: 12 tests

## stage-1 — 백엔드 walking skeleton (2026-05-19)
- 모노레포 (npm workspaces): shared / server / client
- PostgreSQL + Prisma: tickers/quotes/ingestion_log/validation_results 5 테이블
- Fastify + sensible + cors + 전역 에러 핸들러
- us-yahoo Adapter (yahoo-finance2 의존성 제거, undici 직접 HTTP)
- /api/search (DB 기반), /api/ticker/:symbol (캐시 hit/stale/miss + 검증 통합)
- Validator 모듈 (시가총액 정합성/OHLC 불변식/시계열 점프/범위 합리성)
- 100종 시드 (US 50 + KR 50)
- vitest + testcontainers: 34 tests
- GitHub repo 생성 + push

## Pre-stage (2026-05-19)
- 디자인 스펙 작성 — fintel.io + simplywall.st 참고, 미주+한주, 무료 API 조합
- 데이터 신뢰도·교차검증·표현 원칙 (stock-analysis 스킬 통합)
- Plan 분할: 8 Stage로 분할 진행
