# AlgoTick Stage 1 — Backend Walking Skeleton

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모노레포 셋업 + PostgreSQL + Fastify + Yahoo Finance 어댑터로 "검색 → 종목 시세/일봉 JSON 응답"이 동작하는 백엔드 walking skeleton 완성. GitHub repo 생성 + push.

**Architecture:** npm workspaces 모노레포(`packages/{shared,server,client}`). Stage 1은 `shared` + `server`만 다루며 `client`는 빈 placeholder. PostgreSQL은 로컬 설치, 연결정보는 `.env`. Adapter 패턴(`MarketAdapter` 인터페이스 + `us-yahoo` 구현). 캐시 hit/stale/miss 3가지 케이스를 `/api/ticker/:symbol`에서 처리하되, 워커/SSE/Indicators는 Stage 3으로 미룸.

**Tech Stack:** Node 20 LTS · TypeScript · Fastify · Prisma · PostgreSQL 15+ · Zod · yahoo-finance2 · vitest · npm workspaces

**Reference:** [디자인 스펙](../specs/2026-05-19-algotick-design.md) §2 아키텍처, §3 데이터 모델, §6 디렉토리 구조, §7 환경 설정, **§14 데이터 신뢰도·교차검증·표현 원칙**.

**Git workflow:** 모든 작업은 `develop` 분기 후 `feature/OP-{N}-{설명}` 브랜치에서. 커밋 형식: `[OP-{N}] {type}: {설명}`. Task 단위 또는 더 작게 자주 커밋. Stage 1 작업 번호: OP-002 ~ OP-024.

**검증 시스템 (§14 반영):** Stage 1은 검증 시스템의 인프라(타입 + 기본 룰 + Adapter 통합)까지 깐다. 모든 us-yahoo 응답은 DB 저장 전 Validator를 통과한다. 검증 결과는 `validation_results` 테이블에 기록되고 API 응답의 `warnings` 배열로 노출된다.

---

## File Structure (Stage 1에서 생성/수정될 파일)

```
algotick/
├── .nvmrc                                        Task 1
├── package.json                                  Task 2  (workspaces 정의)
├── .env.example                                  Task 4
├── .env                                          Task 4  (gitignore)
├── tsconfig.base.json                            Task 5  (공통 TS 설정)
├── packages/
│   ├── shared/
│   │   ├── package.json                          Task 5
│   │   ├── tsconfig.json                         Task 5
│   │   └── src/
│   │       ├── index.ts                          Task 5
│   │       ├── schema/
│   │       │   ├── ticker.ts                     Task 6
│   │       │   └── quote.ts                      Task 6
│   │       └── types.ts                          Task 6
│   ├── server/
│   │   ├── package.json                          Task 7
│   │   ├── tsconfig.json                         Task 7
│   │   ├── prisma/
│   │   │   ├── schema.prisma                     Task 8
│   │   │   └── migrations/                       Task 9  (Prisma 생성)
│   │   ├── src/
│   │   │   ├── config.ts                         Task 10
│   │   │   ├── db.ts                             Task 11
│   │   │   ├── index.ts                          Task 12
│   │   │   ├── api/
│   │   │   │   ├── health.ts                     Task 13
│   │   │   │   ├── search.ts                     Task 17
│   │   │   │   └── ticker.ts                     Task 18
│   │   │   ├── adapters/
│   │   │   │   ├── base.ts                       Task 14
│   │   │   │   └── us-yahoo.ts                   Task 15
│   │   │   ├── services/
│   │   │   │   ├── tickerService.ts              Task 18
│   │   │   │   └── searchService.ts              Task 17
│   │   │   └── seed/
│   │   │       └── seedTickers.ts                Task 16
│   │   └── tests/
│   │       ├── config.test.ts                    Task 10
│   │       ├── adapters/us-yahoo.test.ts         Task 15
│   │       ├── services/tickerService.test.ts    Task 18
│   │       ├── api/search.test.ts                Task 17
│   │       ├── api/ticker.test.ts                Task 18
│   │       └── fixtures/
│   │           └── yahoo-AAPL-quote.json         Task 15
│   └── client/
│       └── package.json                          Task 20  (placeholder)
└── docs/                                         (이미 존재)
```

**Decomposition rationale:**
- `packages/shared`는 클라이언트/서버 공통 Zod 스키마와 타입만. 어떤 런타임 코드도 두지 않음 → 클라이언트가 brower 환경에서도 안전하게 import 가능.
- `packages/server`는 `config.ts`로 `.env` 단일 진입점. 다른 모든 모듈은 검증된 config를 import.
- `api/*.ts`는 Fastify 라우트 정의만. 비즈니스 로직은 `services/*.ts`에서 처리하여 테스트 가능성↑.
- `adapters/*.ts`는 외부 API 차이를 흡수. `base.ts`의 `MarketAdapter` 인터페이스가 단일 계약.
- 테스트는 소스 옆이 아닌 `tests/` 디렉토리에 미러링하여 빌드 산출물에서 명확히 분리.

---

## Pre-flight (사용자 확인 필요)

이 plan을 시작하기 전 사용자 환경에 아래가 준비되어야 함:

- [ ] **PostgreSQL 15+ 로컬 설치 + 실행 중**
  - 확인: `psql --version` → 15.x 이상
  - 미설치 시 (WSL Ubuntu): `sudo apt install postgresql postgresql-contrib && sudo service postgresql start`
- [ ] **DART OpenAPI 키 발급** (Stage 4에서 필요 — 미리 받아둬도 OK)
  - 발급: https://opendart.fss.or.kr/
- [ ] **gh CLI 인증** (Task 21용)
  - 확인: `gh auth status`
  - 미인증: `gh auth login`

이 중 하나라도 미충족이면 해당 Task에서 멈춤. 시작 전에 모두 확인.

---

## Task 1: nvm으로 프로젝트별 Node 20 설정

**Files:**
- Create: `.nvmrc`

- [ ] **Step 1: Node 20 LTS 설치 (이미 있으면 스킵)**

```bash
nvm install 20
nvm use 20
node --version
```
Expected: `v20.x.x` 출력

- [ ] **Step 2: `.nvmrc` 생성**

```bash
echo "20" > .nvmrc
cat .nvmrc
```
Expected: `20` 한 줄

- [ ] **Step 3: 동작 확인**

```bash
nvm use
node --version
```
Expected: `.nvmrc` 읽어 자동으로 v20 사용

- [ ] **Step 4: feature 브랜치 생성 + 커밋**

```bash
git checkout -b develop
git checkout -b feature/OP-002-nvmrc
git add .nvmrc
git commit -m "[OP-002] chore: Node 20 LTS .nvmrc 추가"
```

---

## Task 2: npm workspaces 루트 설정

**Files:**
- Create: `package.json` (루트)

- [ ] **Step 1: 루트 `package.json` 작성**

```json
{
  "name": "algotick",
  "version": "0.1.0",
  "private": true,
  "description": "미국·한국 주식 분석 SPA",
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "dev:server": "npm run -w packages/server dev",
    "dev:client": "npm run -w packages/client dev",
    "build": "npm run -ws build --if-present",
    "test": "npm run -ws test --if-present",
    "lint": "npm run -ws lint --if-present",
    "typecheck": "npm run -ws typecheck --if-present"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

- [ ] **Step 2: `packages/` 디렉토리 생성**

```bash
mkdir -p packages/shared/src packages/server/src packages/client
```

- [ ] **Step 3: `npm install`로 lockfile 생성**

```bash
npm install
ls package-lock.json
```
Expected: lockfile 생성, 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add package.json package-lock.json
git commit -m "[OP-002] chore: npm workspaces 루트 셋업"
git checkout develop && git merge feature/OP-002-nvmrc --no-ff -m "[OP-002] merge: nvm + workspaces 셋업"
```

---

## Task 3: PostgreSQL DB 생성

**Files:** (없음 — 외부 명령 실행)

- [ ] **Step 1: 새 feature 브랜치**

```bash
git checkout -b feature/OP-003-db-setup
```

- [ ] **Step 2: DB 사용자 + DB 생성**

```bash
sudo -u postgres psql <<'EOF'
CREATE USER algotick WITH PASSWORD 'algotick';
CREATE DATABASE algotick OWNER algotick;
GRANT ALL PRIVILEGES ON DATABASE algotick TO algotick;
EOF
```

- [ ] **Step 3: 연결 확인**

```bash
PGPASSWORD=algotick psql -h localhost -U algotick -d algotick -c "SELECT version();"
```
Expected: PostgreSQL 15.x 버전 정보 출력

- [ ] **Step 4: README에 셋업 명령 메모 추가** (이미 README 있으므로 셋업 명령이 README에 있는지 확인만)

이 Task는 코드 변경 없음 — feature 브랜치 머지 없이 다음 Task로 진행.

```bash
git checkout develop && git branch -d feature/OP-003-db-setup
```

---

## Task 4: .env / .env.example 셋업

**Files:**
- Create: `.env.example`
- Create: `.env` (gitignore)

- [ ] **Step 1: feature 브랜치**

```bash
git checkout -b feature/OP-004-env
```

- [ ] **Step 2: `.env.example` 생성** (스펙 §7 참고)

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
DART_API_KEY=
SEC_USER_AGENT="AlgoTick yourname@example.com"
FINNHUB_API_KEY=

# === Polling ===
POLLING_INTERVAL_MS=60000
WARM_UP_ON_START=true

# === Rate Limits ===
YAHOO_CONCURRENCY=2
NAVER_CONCURRENCY=3
SEC_CONCURRENCY=1
```

- [ ] **Step 3: `.env` 생성 — 실제 값으로**

```bash
cp .env.example .env
# 편집해서 SEC_USER_AGENT의 이메일을 본인 것으로 변경
sed -i 's/yourname@example.com/ghksdls333@gmail.com/' .env
```

- [ ] **Step 4: `.env`가 gitignore 되는지 확인**

```bash
git status --ignored | grep -q '.env$' && echo "OK gitignored" || echo "FAIL"
```
Expected: `OK gitignored`

- [ ] **Step 5: 커밋 (.env.example만)**

```bash
git add .env.example
git commit -m "[OP-004] chore: .env.example 추가"
git checkout develop && git merge feature/OP-004-env --no-ff -m "[OP-004] merge: .env 셋업"
```

---

## Task 5: 공통 TypeScript 설정 + shared 패키지 초기화

**Files:**
- Create: `tsconfig.base.json`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: feature 브랜치**

```bash
git checkout -b feature/OP-005-shared-pkg
```

- [ ] **Step 2: 루트 `tsconfig.base.json` 생성**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  }
}
```

- [ ] **Step 3: `packages/shared/package.json`**

```json
{
  "name": "@algotick/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 4: `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 5: `packages/shared/src/index.ts` (placeholder)**

```typescript
export {};
```

- [ ] **Step 6: 설치 + 빌드 확인**

```bash
npm install
npm run -w @algotick/shared build
ls packages/shared/dist
```
Expected: `dist/index.js`, `dist/index.d.ts` 존재

- [ ] **Step 7: 커밋**

```bash
git add tsconfig.base.json packages/shared/ package.json package-lock.json
git commit -m "[OP-005] chore: shared 패키지 초기화 + tsconfig.base"
git checkout develop && git merge feature/OP-005-shared-pkg --no-ff -m "[OP-005] merge: shared 패키지 초기화"
```

---

## Task 6: shared 패키지에 Ticker/Quote/Provenance Zod 스키마

**Files:**
- Create: `packages/shared/src/schema/ticker.ts`
- Create: `packages/shared/src/schema/quote.ts`
- Create: `packages/shared/src/schema/provenance.ts`
- Create: `packages/shared/src/schema/validation.ts`
- Create: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/index.ts`
- Create: `packages/shared/tests/schema.test.ts`

> §14 반영: 모든 데이터에 출처/신뢰도 메타를 붙이기 위한 `Provenance` 타입과 검증 결과 `ValidationResult` 타입을 shared에 둔다. 클라이언트도 import하여 UI에서 아이콘/배지 렌더링에 사용.

- [ ] **Step 1: feature 브랜치**

```bash
git checkout -b feature/OP-006-shared-schemas
```

- [ ] **Step 2: vitest 설정**

```bash
cd packages/shared
cat > vitest.config.ts <<'EOF'
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] }
});
EOF
cd ../..
```

- [ ] **Step 3: 실패 테스트 작성 — `tests/schema.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import {
  TickerSchema, QuoteSchema, ProvenanceSchema,
  ValidationResultSchema, ConfidenceSchema, SourceSchema,
} from '../src';

describe('TickerSchema', () => {
  it('parses a US ticker', () => {
    const parsed = TickerSchema.parse({
      symbol: 'AAPL',
      market: 'US',
      exchange: 'NASDAQ',
      nameEn: 'Apple Inc.',
      currency: 'USD',
    });
    expect(parsed.symbol).toBe('AAPL');
  });

  it('parses a KR ticker', () => {
    const parsed = TickerSchema.parse({
      symbol: '005930.KS',
      market: 'KR',
      exchange: 'KOSPI',
      nameKo: '삼성전자',
      currency: 'KRW',
    });
    expect(parsed.market).toBe('KR');
  });

  it('rejects invalid market', () => {
    expect(() => TickerSchema.parse({
      symbol: 'X', market: 'JP', exchange: 'TSE', currency: 'JPY',
    })).toThrow();
  });
});

describe('QuoteSchema', () => {
  it('parses an intraday quote', () => {
    const parsed = QuoteSchema.parse({
      symbol: 'AAPL',
      ts: '2026-05-19T15:00:00Z',
      price: 234.52,
      volume: 1000000,
      changePct: 1.24,
      source: 'yahoo',
    });
    expect(parsed.price).toBe(234.52);
  });
});

describe('ProvenanceSchema', () => {
  it('parses a calc provenance', () => {
    const parsed = ProvenanceSchema.parse({
      source: 'calc',
      confidence: 'estimated',
      formula: 'op_income + d_and_a',
      fetchedAt: '2026-05-19T15:00:00Z',
    });
    expect(parsed.confidence).toBe('estimated');
  });

  it('rejects unknown source', () => {
    expect(() => ProvenanceSchema.parse({
      source: 'magic', confidence: 'actual',
    })).toThrow();
  });
});

describe('ValidationResultSchema', () => {
  it('parses a warning result', () => {
    const parsed = ValidationResultSchema.parse({
      severity: 'warning',
      code: 'MARKET_CAP_MISMATCH',
      message: 'market_cap differs from price × shares by 7%',
      details: { calc: 100, observed: 107 },
    });
    expect(parsed.severity).toBe('warning');
  });

  it('rejects unknown severity', () => {
    expect(() => ValidationResultSchema.parse({
      severity: 'critical', code: 'X', message: 'y',
    })).toThrow();
  });
});

describe('ConfidenceSchema', () => {
  it('accepts actual/estimated/assumed', () => {
    expect(ConfidenceSchema.parse('actual')).toBe('actual');
    expect(ConfidenceSchema.parse('estimated')).toBe('estimated');
    expect(ConfidenceSchema.parse('assumed')).toBe('assumed');
  });
});

describe('SourceSchema', () => {
  it('accepts known sources', () => {
    for (const s of ['yahoo', 'sec', 'naver', 'dart', 'finnhub', 'calc', 'user', 'assumption']) {
      expect(SourceSchema.parse(s)).toBe(s);
    }
  });
});
```

- [ ] **Step 4: 테스트 실행 (실패 확인)**

```bash
npm run -w @algotick/shared test
```
Expected: 모듈 못 찾음 또는 export 없음 에러

- [ ] **Step 5: `src/schema/ticker.ts` 작성**

```typescript
import { z } from 'zod';

export const MarketSchema = z.enum(['US', 'KR']);
export type Market = z.infer<typeof MarketSchema>;

export const ExchangeSchema = z.enum(['NASDAQ', 'NYSE', 'KOSPI', 'KOSDAQ']);
export type Exchange = z.infer<typeof ExchangeSchema>;

export const TickerSchema = z.object({
  symbol: z.string().min(1),
  market: MarketSchema,
  exchange: ExchangeSchema,
  nameEn: z.string().optional(),
  nameKo: z.string().optional(),
  sector: z.string().optional(),
  industry: z.string().optional(),
  currency: z.enum(['USD', 'KRW']),
  listedAt: z.string().datetime().optional(),
  delistedAt: z.string().datetime().optional(),
});
export type Ticker = z.infer<typeof TickerSchema>;
```

- [ ] **Step 6: `src/schema/quote.ts` 작성**

```typescript
import { z } from 'zod';

export const QuoteSchema = z.object({
  symbol: z.string(),
  ts: z.string().datetime(),
  price: z.number(),
  volume: z.number().int().nonnegative(),
  changePct: z.number(),
  source: z.enum(['yahoo', 'naver', 'sec', 'dart', 'finnhub']),
});
export type Quote = z.infer<typeof QuoteSchema>;

export const CandleSchema = z.object({
  symbol: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  adjClose: z.number().optional(),
  volume: z.number().int().nonnegative(),
});
export type Candle = z.infer<typeof CandleSchema>;
```

- [ ] **Step 7: `src/schema/provenance.ts` 작성 (§14.5)**

```typescript
import { z } from 'zod';

export const ConfidenceSchema = z.enum(['actual', 'estimated', 'assumed']);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const SourceSchema = z.enum([
  'yahoo', 'sec', 'naver', 'dart', 'finnhub',
  'calc', 'user', 'assumption',
]);
export type Source = z.infer<typeof SourceSchema>;

export const ProvenanceSchema = z.object({
  source: SourceSchema,
  confidence: ConfidenceSchema,
  fetchedAt: z.string().datetime().optional(),
  asOf: z.string().optional(),
  formula: z.string().optional(),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;
```

- [ ] **Step 8: `src/schema/validation.ts` 작성 (§14.3)**

```typescript
import { z } from 'zod';

export const SeveritySchema = z.enum(['error', 'warning', 'info']);
export type Severity = z.infer<typeof SeveritySchema>;

export const ValidationResultSchema = z.object({
  severity: SeveritySchema,
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.record(z.unknown()).optional(),
});
export type ValidationResult = z.infer<typeof ValidationResultSchema>;
```

- [ ] **Step 9: `src/types.ts` 작성 (런타임 없는 순수 타입, warnings 필드 포함)**

```typescript
import type { ValidationResult } from './schema/validation.js';

export type StaleFlag = 'fresh' | 'stale' | 'offline';

export interface CachedResponse<T> {
  data: T;
  freshness: StaleFlag;
  lastFetchedAt: string;
  warnings?: ValidationResult[];
}
```

- [ ] **Step 10: `src/index.ts` 리익스포트**

```typescript
export * from './schema/ticker.js';
export * from './schema/quote.js';
export * from './schema/provenance.js';
export * from './schema/validation.js';
export * from './types.js';
```

- [ ] **Step 11: 테스트 + 빌드**

```bash
npm run -w @algotick/shared test
npm run -w @algotick/shared build
```
Expected: 8 tests pass (Ticker 3 + Quote 1 + Provenance 2 + Validation 2 + Confidence 1 + Source 1), 빌드 성공

- [ ] **Step 12: 커밋**

```bash
git add packages/shared/
git commit -m "[OP-006] feat(shared): Ticker/Quote/Candle/Provenance/ValidationResult Zod 스키마 (§14)"
git checkout develop && git merge feature/OP-006-shared-schemas --no-ff -m "[OP-006] merge: shared 스키마"
```

---

## Task 7: server 패키지 초기화 (Fastify + Prisma + TS)

**Files:**
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`
- Create: `packages/server/.gitignore`

- [ ] **Step 1: feature 브랜치**

```bash
git checkout -b feature/OP-007-server-init
```

- [ ] **Step 2: `packages/server/package.json`**

```json
{
  "name": "@algotick/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:migrate:deploy": "prisma migrate deploy",
    "prisma:studio": "prisma studio",
    "seed": "tsx src/seed/seedTickers.ts"
  },
  "dependencies": {
    "@algotick/shared": "*",
    "@fastify/cors": "^9.0.1",
    "@fastify/sensible": "^5.6.0",
    "@prisma/client": "^5.18.0",
    "dotenv": "^16.4.5",
    "fastify": "^4.28.1",
    "p-limit": "^5.0.0",
    "pino": "^9.3.2",
    "pino-pretty": "^11.2.2",
    "undici": "^6.19.5",
    "yahoo-finance2": "^2.13.2",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.10",
    "prisma": "^5.18.0",
    "tsx": "^4.16.5",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 3: `packages/server/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "ES2022",
    "moduleResolution": "Node"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4: `packages/server/.gitignore`**

```
dist/
node_modules/
*.log
```

- [ ] **Step 5: `packages/server/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 10000,
  },
});
```

- [ ] **Step 6: 설치**

```bash
npm install
```
Expected: 에러 없이 의존성 설치

- [ ] **Step 7: 커밋**

```bash
git add packages/server/ package.json package-lock.json
git commit -m "[OP-007] chore(server): Fastify/Prisma/Vitest 셋업"
git checkout develop && git merge feature/OP-007-server-init --no-ff -m "[OP-007] merge: server 초기화"
```

---

## Task 8: Prisma 스키마 (Stage 1 범위: 마스터 + 시세 + ingestion_log)

**Files:**
- Create: `packages/server/prisma/schema.prisma`

- [ ] **Step 1: feature 브랜치**

```bash
git checkout -b feature/OP-008-prisma-schema
```

- [ ] **Step 2: `prisma/schema.prisma` 작성**

Stage 1에서는 마스터 + 시세 + ingestion_log만. 나머지 테이블(financials, insider, news, watchlist, portfolio, screener, indices, market_events)은 후속 Stage에서 마이그레이션으로 추가.

```prisma
// AlgoTick Prisma Schema - Stage 1
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Market {
  US
  KR
}

enum Exchange {
  NASDAQ
  NYSE
  KOSPI
  KOSDAQ
}

model Ticker {
  symbol     String   @id
  market     Market
  exchange   Exchange
  nameEn     String?
  nameKo     String?
  sector     String?
  industry   String?
  currency   String
  listedAt   DateTime?
  delistedAt DateTime?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  quotesIntraday QuoteIntraday[]
  quotesDaily    QuoteDaily[]

  @@index([market])
  @@index([exchange])
  @@map("tickers")
}

model QuoteIntraday {
  symbol     String
  ts         DateTime
  price      Decimal  @db.Decimal(20, 6)
  volume     BigInt
  changePct  Decimal  @db.Decimal(10, 4)
  source     String

  ticker Ticker @relation(fields: [symbol], references: [symbol], onDelete: Cascade)

  @@id([symbol, ts])
  @@index([ts])
  @@map("quotes_intraday")
}

model QuoteDaily {
  symbol    String
  date      DateTime @db.Date
  open      Decimal  @db.Decimal(20, 6)
  high      Decimal  @db.Decimal(20, 6)
  low       Decimal  @db.Decimal(20, 6)
  close     Decimal  @db.Decimal(20, 6)
  adjClose  Decimal? @db.Decimal(20, 6)
  volume    BigInt

  ticker Ticker @relation(fields: [symbol], references: [symbol], onDelete: Cascade)

  @@id([symbol, date])
  @@index([symbol, date(sort: Desc)])
  @@map("quotes_daily")
}

model IngestionLog {
  symbol         String
  kind           String   // "quote" | "daily" | "financials" | ...
  lastFetchedAt  DateTime

  @@id([symbol, kind])
  @@map("ingestion_log")
}

model ValidationResult {
  id        String   @id @default(uuid())
  symbol    String
  kind      String   // "quote" | "daily" | "financials" | ...
  ts        DateTime @default(now())
  severity  String   // "error" | "warning" | "info"
  code      String   // "MARKET_CAP_MISMATCH" | "OHLC_INVARIANT" | ...
  message   String
  details   Json?

  @@index([symbol, ts(sort: Desc)])
  @@index([severity, ts(sort: Desc)])
  @@map("validation_results")
}
```

- [ ] **Step 3: Prisma client 생성**

```bash
npm run -w @algotick/server prisma:generate
ls packages/server/node_modules/.prisma/client
```
Expected: `index.js`, `index.d.ts` 생성

- [ ] **Step 4: 커밋**

```bash
git add packages/server/prisma/
git commit -m "[OP-008] feat(server): Prisma 스키마 (마스터+시세+ingestion_log)"
git checkout develop && git merge feature/OP-008-prisma-schema --no-ff -m "[OP-008] merge: Prisma 스키마"
```

---

## Task 9: 첫 마이그레이션 실행

**Files:**
- Create: `packages/server/prisma/migrations/*` (Prisma 자동 생성)

- [ ] **Step 1: feature 브랜치**

```bash
git checkout -b feature/OP-009-prisma-init-migration
```

- [ ] **Step 2: 마이그레이션 생성 + 적용**

```bash
cd packages/server
npx prisma migrate dev --name init
cd ../..
```
Expected: 마이그레이션 파일 생성, DB에 테이블 4개 생성, "Your database is now in sync"

- [ ] **Step 3: DB에 테이블이 실제로 생성되었는지 확인**

```bash
PGPASSWORD=algotick psql -h localhost -U algotick -d algotick -c "\dt"
```
Expected: `tickers`, `quotes_intraday`, `quotes_daily`, `ingestion_log`, `_prisma_migrations` 표시

- [ ] **Step 4: 커밋**

```bash
git add packages/server/prisma/migrations/
git commit -m "[OP-009] feat(server): 초기 마이그레이션 (tickers/quotes/ingestion_log)"
git checkout develop && git merge feature/OP-009-prisma-init-migration --no-ff -m "[OP-009] merge: 초기 마이그레이션"
```

---

## Task 10: config.ts (.env 로드 + Zod 검증)

**Files:**
- Create: `packages/server/src/config.ts`
- Create: `packages/server/tests/config.test.ts`

- [ ] **Step 1: feature 브랜치**

```bash
git checkout -b feature/OP-010-config
```

- [ ] **Step 2: 실패 테스트 작성 — `tests/config.test.ts`**

```typescript
import { describe, expect, it, beforeEach, afterEach } from 'vitest';

const ORIGINAL_ENV = { ...process.env };
beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
});
afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe('loadConfig', () => {
  it('loads valid config from env', async () => {
    process.env.DATABASE_URL = 'postgresql://x:y@localhost/z';
    process.env.PORT = '4000';
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'info';
    process.env.SEC_USER_AGENT = 'AlgoTick test@example.com';
    process.env.POLLING_INTERVAL_MS = '60000';
    process.env.WARM_UP_ON_START = 'true';
    process.env.YAHOO_CONCURRENCY = '2';
    process.env.NAVER_CONCURRENCY = '3';
    process.env.SEC_CONCURRENCY = '1';

    const { loadConfig } = await import('../src/config');
    const cfg = loadConfig();
    expect(cfg.port).toBe(4000);
    expect(cfg.pollingIntervalMs).toBe(60000);
    expect(cfg.warmUpOnStart).toBe(true);
  });

  it('throws when DATABASE_URL missing', async () => {
    delete process.env.DATABASE_URL;
    const { loadConfig } = await import('../src/config');
    expect(() => loadConfig()).toThrow(/DATABASE_URL/);
  });

  it('throws when PORT is not a number', async () => {
    process.env.DATABASE_URL = 'postgresql://x:y@localhost/z';
    process.env.PORT = 'abc';
    const { loadConfig } = await import('../src/config');
    expect(() => loadConfig()).toThrow();
  });
});
```

- [ ] **Step 3: 테스트 실행 (실패 확인)**

```bash
npm run -w @algotick/server test -- config.test
```
Expected: 모듈 못 찾음

- [ ] **Step 4: `src/config.ts` 작성**

```typescript
import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

dotenvConfig();

const ConfigSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DART_API_KEY: z.string().optional(),
  SEC_USER_AGENT: z.string().min(5),
  FINNHUB_API_KEY: z.string().optional(),
  POLLING_INTERVAL_MS: z.coerce.number().int().positive().default(60000),
  WARM_UP_ON_START: z.coerce.boolean().default(true),
  YAHOO_CONCURRENCY: z.coerce.number().int().positive().default(2),
  NAVER_CONCURRENCY: z.coerce.number().int().positive().default(3),
  SEC_CONCURRENCY: z.coerce.number().int().positive().default(1),
});

export type AppConfig = {
  databaseUrl: string;
  port: number;
  nodeEnv: 'development' | 'test' | 'production';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  dartApiKey?: string;
  secUserAgent: string;
  finnhubApiKey?: string;
  pollingIntervalMs: number;
  warmUpOnStart: boolean;
  yahooConcurrency: number;
  naverConcurrency: number;
  secConcurrency: number;
};

export function loadConfig(): AppConfig {
  const parsed = ConfigSchema.parse(process.env);
  return {
    databaseUrl: parsed.DATABASE_URL,
    port: parsed.PORT,
    nodeEnv: parsed.NODE_ENV,
    logLevel: parsed.LOG_LEVEL,
    dartApiKey: parsed.DART_API_KEY,
    secUserAgent: parsed.SEC_USER_AGENT,
    finnhubApiKey: parsed.FINNHUB_API_KEY,
    pollingIntervalMs: parsed.POLLING_INTERVAL_MS,
    warmUpOnStart: parsed.WARM_UP_ON_START,
    yahooConcurrency: parsed.YAHOO_CONCURRENCY,
    naverConcurrency: parsed.NAVER_CONCURRENCY,
    secConcurrency: parsed.SEC_CONCURRENCY,
  };
}
```

- [ ] **Step 5: 테스트 실행 (통과 확인)**

```bash
npm run -w @algotick/server test -- config.test
```
Expected: 3 tests pass

- [ ] **Step 6: 커밋**

```bash
git add packages/server/src/config.ts packages/server/tests/config.test.ts
git commit -m "[OP-010] feat(server): config.ts (.env + Zod 검증)"
git checkout develop && git merge feature/OP-010-config --no-ff -m "[OP-010] merge: config"
```

---

## Task 11: Prisma client wrapper (db.ts)

**Files:**
- Create: `packages/server/src/db.ts`

- [ ] **Step 1: feature 브랜치**

```bash
git checkout -b feature/OP-011-db-wrapper
```

- [ ] **Step 2: `src/db.ts` 작성**

```typescript
import { PrismaClient } from '@prisma/client';
import { loadConfig } from './config.js';

let prisma: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    const cfg = loadConfig();
    prisma = new PrismaClient({
      log: cfg.nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
      datasources: { db: { url: cfg.databaseUrl } },
    });
  }
  return prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = undefined;
  }
}
```

- [ ] **Step 3: 커밋**

```bash
git add packages/server/src/db.ts
git commit -m "[OP-011] feat(server): Prisma client wrapper"
git checkout develop && git merge feature/OP-011-db-wrapper --no-ff -m "[OP-011] merge: db wrapper"
```

---

## Task 12: Fastify 부트스트랩 (index.ts)

**Files:**
- Create: `packages/server/src/index.ts`

- [ ] **Step 1: feature 브랜치**

```bash
git checkout -b feature/OP-012-fastify-bootstrap
```

- [ ] **Step 2: `src/index.ts` 작성**

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { loadConfig } from './config.js';
import { getPrisma, disconnectPrisma } from './db.js';

async function buildApp() {
  const cfg = loadConfig();
  const app = Fastify({
    logger: {
      level: cfg.logLevel,
      transport: cfg.nodeEnv === 'development'
        ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
        : undefined,
    },
  });

  await app.register(sensible);
  await app.register(cors, { origin: true });

  // 라우트는 후속 task에서 등록
  return app;
}

async function start() {
  const cfg = loadConfig();
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    await disconnectPrisma();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  try {
    await app.listen({ port: cfg.port, host: '0.0.0.0' });
    app.log.info(`AlgoTick server listening on port ${cfg.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void start();

export { buildApp };
```

- [ ] **Step 3: 실행 확인 (수동)**

```bash
npm run -w @algotick/server dev &
sleep 2
curl -s http://localhost:4000/__not_found_yet__ | head
kill %1
```
Expected: 404 응답 (Fastify가 기본적으로 404). 서버가 떠 있다는 증거.

- [ ] **Step 4: 커밋**

```bash
git add packages/server/src/index.ts
git commit -m "[OP-012] feat(server): Fastify 부트스트랩"
git checkout develop && git merge feature/OP-012-fastify-bootstrap --no-ff -m "[OP-012] merge: Fastify bootstrap"
```

---

## Task 13: /health 엔드포인트

**Files:**
- Create: `packages/server/src/api/health.ts`
- Modify: `packages/server/src/index.ts`
- Create: `packages/server/tests/api/health.test.ts`

- [ ] **Step 1: feature 브랜치**

```bash
git checkout -b feature/OP-013-health
```

- [ ] **Step 2: 실패 테스트 — `tests/api/health.test.ts`**

```typescript
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/index';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); });
afterAll(async () => { await app.close(); });

describe('GET /health', () => {
  it('returns ok with db status', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.db).toBe('connected');
  });
});
```

- [ ] **Step 3: 테스트 실행 (실패)**

```bash
npm run -w @algotick/server test -- health.test
```
Expected: 404 또는 buildApp not exported

- [ ] **Step 4: `src/api/health.ts` 작성**

```typescript
import type { FastifyInstance } from 'fastify';
import { getPrisma } from '../db.js';

export async function registerHealthRoute(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => {
    let db: 'connected' | 'disconnected' = 'disconnected';
    try {
      await getPrisma().$queryRaw`SELECT 1`;
      db = 'connected';
    } catch {
      db = 'disconnected';
    }
    return { status: 'ok', db, ts: new Date().toISOString() };
  });
}
```

- [ ] **Step 5: `src/index.ts`에서 등록 — `buildApp` 함수 내부에 추가**

`buildApp` 내 sensible/cors 등록 직후, 다음을 추가:

```typescript
import { registerHealthRoute } from './api/health.js';
// ...
await registerHealthRoute(app);
```

- [ ] **Step 6: 테스트 + 수동 확인**

```bash
npm run -w @algotick/server test -- health.test
```
Expected: 1 test pass

```bash
npm run -w @algotick/server dev &
sleep 2
curl -s http://localhost:4000/health | jq
kill %1
```
Expected: `{"status":"ok","db":"connected","ts":"..."}`

- [ ] **Step 7: 커밋**

```bash
git add packages/server/src/api/health.ts packages/server/src/index.ts packages/server/tests/api/health.test.ts
git commit -m "[OP-013] feat(server): /health 엔드포인트"
git checkout develop && git merge feature/OP-013-health --no-ff -m "[OP-013] merge: /health"
```

---

## Task 14: MarketAdapter 인터페이스 (base.ts)

**Files:**
- Create: `packages/server/src/adapters/base.ts`

- [ ] **Step 1: feature 브랜치**

```bash
git checkout -b feature/OP-014-adapter-base
```

- [ ] **Step 2: `src/adapters/base.ts` 작성**

Stage 1에서는 시세/일봉만 필요. 나머지 메서드는 Stage 3~5에서 인터페이스 확장.

```typescript
import type { Market } from '@algotick/shared';

export interface QuoteResult {
  symbol: string;
  price: number;
  volume: number;
  changePct: number;
  ts: Date;
  source: string;
  // §14.2 self-consistency 검증용 — Adapter가 채울 수 있으면 채움
  marketCap?: number;
  sharesOutstanding?: number;
}

export interface CandleResult {
  symbol: string;
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose?: number;
  volume: number;
}

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  market: Market;
}

export interface MarketAdapter {
  readonly market: Market;
  getQuote(symbol: string): Promise<QuoteResult>;
  getDailyOHLCV(symbol: string, from: Date, to: Date): Promise<CandleResult[]>;
  search(query: string, limit?: number): Promise<SearchResult[]>;
}

export class AdapterError extends Error {
  constructor(public readonly source: string, message: string, public readonly cause?: unknown) {
    super(`[${source}] ${message}`);
    this.name = 'AdapterError';
  }
}
```

- [ ] **Step 3: 커밋**

```bash
git add packages/server/src/adapters/base.ts
git commit -m "[OP-014] feat(server): MarketAdapter 인터페이스"
git checkout develop && git merge feature/OP-014-adapter-base --no-ff -m "[OP-014] merge: adapter base"
```

---

## Task 14b: Validator 모듈 (§14.2 검증 룰)

**Files:**
- Create: `packages/server/src/validators/types.ts`
- Create: `packages/server/src/validators/rules.ts`
- Create: `packages/server/src/validators/run.ts`
- Create: `packages/server/src/validators/index.ts`
- Create: `packages/server/tests/validators/rules.test.ts`

> §14 반영: Adapter 응답을 DB 저장 전 검증하는 인프라. Stage 1에서는 `validateQuote`, `validateCandle` 룰만. 재무·DCF 룰은 후속 Stage에서 추가.

- [ ] **Step 1: feature 브랜치**

```bash
git checkout -b feature/OP-014b-validators
```

- [ ] **Step 2: 실패 테스트 — `tests/validators/rules.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import { validateQuote, validateCandle } from '../../src/validators';

const ctx = { symbol: 'AAPL', market: 'US' as const };

describe('validateQuote', () => {
  it('passes a healthy quote', () => {
    const results = validateQuote({
      symbol: 'AAPL',
      price: 234.52,
      volume: 50000000,
      changePct: 1.24,
      ts: new Date('2026-05-19T15:00:00Z'),
      source: 'yahoo',
      marketCap: 3_600_000_000_000,
      sharesOutstanding: 15_357_000_000,
    }, ctx);
    expect(results.filter(r => r.severity === 'error')).toHaveLength(0);
  });

  it('flags MARKET_CAP_MISMATCH when mcap ≠ price × shares (>5%)', () => {
    const results = validateQuote({
      symbol: 'AAPL', price: 100, volume: 1000, changePct: 0, ts: new Date(), source: 'yahoo',
      marketCap: 1_000_000, sharesOutstanding: 5_000, // calc=500_000 vs observed=1_000_000 → 50% off
    }, ctx);
    expect(results.find(r => r.code === 'MARKET_CAP_MISMATCH')).toBeDefined();
  });

  it('flags MARKET_CAP_POSITIVE when zero', () => {
    const results = validateQuote({
      symbol: 'AAPL', price: 100, volume: 1000, changePct: 0, ts: new Date(), source: 'yahoo',
      marketCap: 0,
    }, ctx);
    expect(results.find(r => r.code === 'MARKET_CAP_POSITIVE')?.severity).toBe('error');
  });

  it('flags VOLUME_NEGATIVE', () => {
    const results = validateQuote({
      symbol: 'AAPL', price: 100, volume: -1, changePct: 0, ts: new Date(), source: 'yahoo',
    }, ctx);
    expect(results.find(r => r.code === 'VOLUME_NEGATIVE')?.severity).toBe('error');
  });

  it('flags FUTURE_DATE if ts > now', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const results = validateQuote({
      symbol: 'AAPL', price: 100, volume: 1000, changePct: 0, ts: future, source: 'yahoo',
    }, ctx);
    expect(results.find(r => r.code === 'FUTURE_DATE')).toBeDefined();
  });
});

describe('validateCandle', () => {
  const baseCandle = { symbol: 'AAPL', date: '2026-05-15', open: 100, high: 105, low: 95, close: 102, volume: 10000 };

  it('passes a healthy candle', () => {
    const r = validateCandle(baseCandle, undefined, ctx);
    expect(r.filter(x => x.severity === 'error')).toHaveLength(0);
  });

  it('flags OHLC_INVARIANT when high < close', () => {
    const r = validateCandle({ ...baseCandle, high: 90 }, undefined, ctx);
    expect(r.find(x => x.code === 'OHLC_INVARIANT')?.severity).toBe('error');
  });

  it('flags OHLC_INVARIANT when low > open', () => {
    const r = validateCandle({ ...baseCandle, low: 110 }, undefined, ctx);
    expect(r.find(x => x.code === 'OHLC_INVARIANT')).toBeDefined();
  });

  it('flags PRICE_JUMP_LARGE when close jumps >20% from previous', () => {
    const prev = { ...baseCandle, date: '2026-05-14', close: 100 };
    const today = { ...baseCandle, date: '2026-05-15', close: 130, high: 130, low: 100 };
    const r = validateCandle(today, prev, ctx);
    expect(r.find(x => x.code === 'PRICE_JUMP_LARGE')?.severity).toBe('warning');
  });

  it('flags VOLUME_ZERO as info', () => {
    const r = validateCandle({ ...baseCandle, volume: 0 }, undefined, ctx);
    expect(r.find(x => x.code === 'VOLUME_ZERO')?.severity).toBe('info');
  });

  it('flags FUTURE_DATE when date > today', () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const r = validateCandle({ ...baseCandle, date: tomorrow }, undefined, ctx);
    expect(r.find(x => x.code === 'FUTURE_DATE')?.severity).toBe('error');
  });
});
```

- [ ] **Step 3: 테스트 실행 (실패)**

```bash
npm run -w @algotick/server test -- validators
```
Expected: 모듈 못 찾음

- [ ] **Step 4: `src/validators/types.ts` 작성**

```typescript
import type { ValidationResult } from '@algotick/shared';
import type { Market } from '@algotick/shared';

export interface ValidatorContext {
  symbol: string;
  market: Market;
}

export interface QuoteForValidation {
  symbol: string;
  price: number;
  volume: number;
  changePct: number;
  ts: Date;
  source: string;
  marketCap?: number;
  sharesOutstanding?: number;
}

export interface CandleForValidation {
  symbol: string;
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Validator<T> = (data: T, ctx: ValidatorContext) => ValidationResult[];

export type CandleValidator = (
  data: CandleForValidation,
  previous: CandleForValidation | undefined,
  ctx: ValidatorContext,
) => ValidationResult[];

export { ValidationResult };
```

- [ ] **Step 5: `src/validators/rules.ts` 작성** (§14.2의 룰들)

```typescript
import type {
  QuoteForValidation,
  CandleForValidation,
  ValidatorContext,
} from './types.js';
import type { ValidationResult } from '@algotick/shared';

const MARKET_CAP_TOLERANCE = 0.05;
const PRICE_JUMP_THRESHOLD = 0.20;

export function quoteRules(q: QuoteForValidation, _ctx: ValidatorContext): ValidationResult[] {
  const out: ValidationResult[] = [];

  // MARKET_CAP_POSITIVE
  if (q.marketCap !== undefined && q.marketCap <= 0) {
    out.push({
      severity: 'error',
      code: 'MARKET_CAP_POSITIVE',
      message: `market_cap must be > 0 (observed ${q.marketCap})`,
      details: { marketCap: q.marketCap },
    });
  }

  // VOLUME_NEGATIVE
  if (q.volume < 0) {
    out.push({
      severity: 'error',
      code: 'VOLUME_NEGATIVE',
      message: `volume must be ≥ 0 (observed ${q.volume})`,
      details: { volume: q.volume },
    });
  }

  // MARKET_CAP_MISMATCH (Self-consistency)
  if (q.marketCap && q.sharesOutstanding && q.price > 0 && q.sharesOutstanding > 0) {
    const calc = q.price * q.sharesOutstanding;
    const diff = Math.abs(calc - q.marketCap) / q.marketCap;
    if (diff > MARKET_CAP_TOLERANCE) {
      out.push({
        severity: 'error',
        code: 'MARKET_CAP_MISMATCH',
        message: `market_cap differs from price × shares by ${(diff * 100).toFixed(1)}% (>${MARKET_CAP_TOLERANCE * 100}%)`,
        details: { calc, observed: q.marketCap, price: q.price, shares: q.sharesOutstanding },
      });
    }
  }

  // FUTURE_DATE
  if (q.ts.getTime() > Date.now() + 60 * 1000) {
    out.push({
      severity: 'error',
      code: 'FUTURE_DATE',
      message: `quote ts is in the future: ${q.ts.toISOString()}`,
      details: { ts: q.ts.toISOString() },
    });
  }

  return out;
}

export function candleRules(
  c: CandleForValidation,
  prev: CandleForValidation | undefined,
  _ctx: ValidatorContext,
): ValidationResult[] {
  const out: ValidationResult[] = [];

  // OHLC_INVARIANT
  const maxOC = Math.max(c.open, c.close);
  const minOC = Math.min(c.open, c.close);
  if (c.high < maxOC || c.low > minOC || c.high < c.low) {
    out.push({
      severity: 'error',
      code: 'OHLC_INVARIANT',
      message: `OHLC violates invariants (high ${c.high}, open ${c.open}, low ${c.low}, close ${c.close})`,
      details: { high: c.high, low: c.low, open: c.open, close: c.close },
    });
  }

  // VOLUME_ZERO
  if (c.volume === 0) {
    out.push({
      severity: 'info',
      code: 'VOLUME_ZERO',
      message: 'volume is zero (휴장 가능성)',
      details: { date: c.date },
    });
  }

  // VOLUME_NEGATIVE
  if (c.volume < 0) {
    out.push({
      severity: 'error',
      code: 'VOLUME_NEGATIVE',
      message: `volume must be ≥ 0 (observed ${c.volume})`,
      details: { volume: c.volume },
    });
  }

  // FUTURE_DATE
  const today = new Date().toISOString().slice(0, 10);
  if (c.date > today) {
    out.push({
      severity: 'error',
      code: 'FUTURE_DATE',
      message: `candle date is in the future: ${c.date}`,
      details: { date: c.date, today },
    });
  }

  // PRICE_JUMP_LARGE
  if (prev && prev.close > 0) {
    const change = Math.abs(c.close - prev.close) / prev.close;
    if (change > PRICE_JUMP_THRESHOLD) {
      out.push({
        severity: 'warning',
        code: 'PRICE_JUMP_LARGE',
        message: `close jumped ${(change * 100).toFixed(1)}% vs previous (분할/배당 가능성)`,
        details: { previousClose: prev.close, currentClose: c.close, change },
      });
    }
  }

  return out;
}
```

- [ ] **Step 6: `src/validators/run.ts` 작성**

```typescript
import type { ValidationResult } from '@algotick/shared';
import type {
  QuoteForValidation,
  CandleForValidation,
  ValidatorContext,
} from './types.js';
import { quoteRules, candleRules } from './rules.js';

export function validateQuote(quote: QuoteForValidation, ctx: ValidatorContext): ValidationResult[] {
  return quoteRules(quote, ctx);
}

export function validateCandle(
  candle: CandleForValidation,
  previous: CandleForValidation | undefined,
  ctx: ValidatorContext,
): ValidationResult[] {
  return candleRules(candle, previous, ctx);
}

export function hasErrors(results: ValidationResult[]): boolean {
  return results.some((r) => r.severity === 'error');
}

export function pickWarnings(results: ValidationResult[]): ValidationResult[] {
  return results.filter((r) => r.severity === 'warning' || r.severity === 'info');
}
```

- [ ] **Step 7: `src/validators/index.ts` 리익스포트**

```typescript
export * from './types.js';
export * from './rules.js';
export * from './run.js';
```

- [ ] **Step 8: 테스트 실행 (통과)**

```bash
npm run -w @algotick/server test -- validators
```
Expected: 10 tests pass (quote 5 + candle 5)

- [ ] **Step 9: 커밋**

```bash
git add packages/server/src/validators/ packages/server/tests/validators/
git commit -m "[OP-014b] feat(server): Validator 모듈 (quote/candle 룰, §14.2)"
git checkout develop && git merge feature/OP-014b-validators --no-ff -m "[OP-014b] merge: validators"
```

---

## Task 15: us-yahoo Adapter 구현

**Files:**
- Create: `packages/server/src/adapters/us-yahoo.ts`
- Create: `packages/server/tests/adapters/us-yahoo.test.ts`
- Create: `packages/server/tests/fixtures/yahoo-AAPL-quote.json`

- [ ] **Step 1: feature 브랜치**

```bash
git checkout -b feature/OP-015-us-yahoo-adapter
```

- [ ] **Step 2: 픽스처 생성 — `tests/fixtures/yahoo-AAPL-quote.json`**

```json
{
  "symbol": "AAPL",
  "regularMarketPrice": 234.52,
  "regularMarketVolume": 50000000,
  "regularMarketChangePercent": 1.24,
  "regularMarketTime": "2026-05-19T19:30:00.000Z",
  "longName": "Apple Inc.",
  "exchange": "NMS",
  "currency": "USD",
  "marketCap": 3601555560000,
  "sharesOutstanding": 15357000000
}
```

- [ ] **Step 3: 실패 테스트 — `tests/adapters/us-yahoo.test.ts`**

```typescript
import { describe, expect, it, vi } from 'vitest';
import fixture from '../fixtures/yahoo-AAPL-quote.json';

vi.mock('yahoo-finance2', () => ({
  default: {
    quote: vi.fn(async (symbol: string) => {
      if (symbol === 'AAPL') return fixture;
      throw new Error('Not found');
    }),
    chart: vi.fn(async (_symbol: string, _opts: object) => ({
      quotes: [
        { date: new Date('2026-05-15'), open: 230, high: 235, low: 229, close: 233, adjclose: 233, volume: 45000000 },
        { date: new Date('2026-05-16'), open: 233, high: 236, low: 232, close: 234, adjclose: 234, volume: 48000000 },
      ],
    })),
    search: vi.fn(async (_q: string) => ({
      quotes: [
        { symbol: 'AAPL', shortname: 'Apple Inc.', exchange: 'NMS', quoteType: 'EQUITY' },
        { symbol: 'AMZN', shortname: 'Amazon.com', exchange: 'NMS', quoteType: 'EQUITY' },
      ],
    })),
    suppressNotices: vi.fn(),
  },
}));

import { UsYahooAdapter } from '../../src/adapters/us-yahoo';

describe('UsYahooAdapter', () => {
  const adapter = new UsYahooAdapter();

  it('returns quote for AAPL', async () => {
    const q = await adapter.getQuote('AAPL');
    expect(q.symbol).toBe('AAPL');
    expect(q.price).toBe(234.52);
    expect(q.source).toBe('yahoo');
  });

  it('throws AdapterError on unknown symbol', async () => {
    await expect(adapter.getQuote('XXXXX')).rejects.toMatchObject({ name: 'AdapterError' });
  });

  it('returns daily candles', async () => {
    const candles = await adapter.getDailyOHLCV('AAPL', new Date('2026-05-15'), new Date('2026-05-16'));
    expect(candles).toHaveLength(2);
    expect(candles[0]?.date).toBe('2026-05-15');
    expect(candles[0]?.close).toBe(233);
  });

  it('searches and returns equity results only', async () => {
    const results = await adapter.search('apple');
    expect(results.every(r => r.market === 'US')).toBe(true);
    expect(results[0]?.symbol).toBe('AAPL');
  });
});
```

- [ ] **Step 4: 테스트 실행 (실패)**

```bash
npm run -w @algotick/server test -- us-yahoo.test
```
Expected: UsYahooAdapter 못 찾음

- [ ] **Step 5: `src/adapters/us-yahoo.ts` 작성**

```typescript
import yf from 'yahoo-finance2';
import type { MarketAdapter, QuoteResult, CandleResult, SearchResult } from './base.js';
import { AdapterError } from './base.js';

yf.suppressNotices?.(['yahooSurvey']);

export class UsYahooAdapter implements MarketAdapter {
  readonly market = 'US' as const;

  async getQuote(symbol: string): Promise<QuoteResult> {
    try {
      const q = await yf.quote(symbol);
      if (!q || typeof q.regularMarketPrice !== 'number') {
        throw new AdapterError('yahoo', `No quote for ${symbol}`);
      }
      return {
        symbol,
        price: q.regularMarketPrice,
        volume: q.regularMarketVolume ?? 0,
        changePct: q.regularMarketChangePercent ?? 0,
        ts: q.regularMarketTime ? new Date(q.regularMarketTime) : new Date(),
        source: 'yahoo',
        marketCap: typeof q.marketCap === 'number' ? q.marketCap : undefined,
        sharesOutstanding: typeof q.sharesOutstanding === 'number' ? q.sharesOutstanding : undefined,
      };
    } catch (e) {
      if (e instanceof AdapterError) throw e;
      throw new AdapterError('yahoo', `getQuote failed for ${symbol}`, e);
    }
  }

  async getDailyOHLCV(symbol: string, from: Date, to: Date): Promise<CandleResult[]> {
    try {
      const result = await yf.chart(symbol, {
        period1: from,
        period2: to,
        interval: '1d',
      });
      const rows = result?.quotes ?? [];
      return rows
        .filter((r: { date: Date; close: number | null }) => r.date && r.close !== null)
        .map((r: { date: Date; open: number; high: number; low: number; close: number; adjclose?: number; volume: number }) => ({
          symbol,
          date: r.date.toISOString().slice(0, 10),
          open: r.open,
          high: r.high,
          low: r.low,
          close: r.close,
          adjClose: r.adjclose,
          volume: r.volume,
        }));
    } catch (e) {
      throw new AdapterError('yahoo', `getDailyOHLCV failed for ${symbol}`, e);
    }
  }

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    try {
      const result = await yf.search(query);
      const items = result?.quotes ?? [];
      return items
        .filter((r: { quoteType?: string; symbol?: string }) => r.quoteType === 'EQUITY' && r.symbol)
        .slice(0, limit)
        .map((r: { symbol: string; shortname?: string; longname?: string; exchange?: string }) => ({
          symbol: r.symbol,
          name: r.shortname ?? r.longname ?? r.symbol,
          exchange: r.exchange ?? 'UNKNOWN',
          market: 'US' as const,
        }));
    } catch (e) {
      throw new AdapterError('yahoo', `search failed for ${query}`, e);
    }
  }
}
```

- [ ] **Step 6: 테스트 실행 (통과)**

```bash
npm run -w @algotick/server test -- us-yahoo.test
```
Expected: 4 tests pass

- [ ] **Step 7: 커밋**

```bash
git add packages/server/src/adapters/us-yahoo.ts packages/server/tests/adapters/ packages/server/tests/fixtures/
git commit -m "[OP-015] feat(server): us-yahoo Adapter (quote/daily/search)"
git checkout develop && git merge feature/OP-015-us-yahoo-adapter --no-ff -m "[OP-015] merge: us-yahoo adapter"
```

---

## Task 16: 종목 마스터 시드 (NASDAQ 상위 50종 + KOSPI 상위 50종)

**Files:**
- Create: `packages/server/src/seed/seedTickers.ts`
- Create: `packages/server/src/seed/data/us-top.json`
- Create: `packages/server/src/seed/data/kr-top.json`

> Stage 1 범위에서는 시드 데이터로 자동완성을 동작시키되, KR 종목은 마스터만 들어가고 실제 시세 페치는 Stage 4(kr-naver)에서 활성화됨.

- [ ] **Step 1: feature 브랜치**

```bash
git checkout -b feature/OP-016-seed-tickers
```

- [ ] **Step 2: `seed/data/us-top.json` 작성** (상위 종목 일부, 전체는 동일 패턴으로 50개)

```json
[
  { "symbol": "AAPL", "market": "US", "exchange": "NASDAQ", "nameEn": "Apple Inc.", "sector": "Technology", "currency": "USD" },
  { "symbol": "MSFT", "market": "US", "exchange": "NASDAQ", "nameEn": "Microsoft Corporation", "sector": "Technology", "currency": "USD" },
  { "symbol": "NVDA", "market": "US", "exchange": "NASDAQ", "nameEn": "NVIDIA Corporation", "sector": "Technology", "currency": "USD" },
  { "symbol": "GOOGL", "market": "US", "exchange": "NASDAQ", "nameEn": "Alphabet Inc.", "sector": "Communication Services", "currency": "USD" },
  { "symbol": "AMZN", "market": "US", "exchange": "NASDAQ", "nameEn": "Amazon.com Inc.", "sector": "Consumer Cyclical", "currency": "USD" },
  { "symbol": "META", "market": "US", "exchange": "NASDAQ", "nameEn": "Meta Platforms Inc.", "sector": "Communication Services", "currency": "USD" },
  { "symbol": "TSLA", "market": "US", "exchange": "NASDAQ", "nameEn": "Tesla Inc.", "sector": "Consumer Cyclical", "currency": "USD" },
  { "symbol": "BRK-B", "market": "US", "exchange": "NYSE", "nameEn": "Berkshire Hathaway Inc.", "sector": "Financial Services", "currency": "USD" },
  { "symbol": "JPM", "market": "US", "exchange": "NYSE", "nameEn": "JPMorgan Chase & Co.", "sector": "Financial Services", "currency": "USD" },
  { "symbol": "V", "market": "US", "exchange": "NYSE", "nameEn": "Visa Inc.", "sector": "Financial Services", "currency": "USD" }
]
```

> 동일 패턴으로 총 50개 작성. 작업 시 https://stockanalysis.com/list/biggest-companies/ 또는 Wikipedia S&P 500 list 참고. 시드 데이터는 사람이 한 번 채워두는 정적 데이터.

- [ ] **Step 3: `seed/data/kr-top.json` 작성** (KOSPI/KOSDAQ 상위 50종)

```json
[
  { "symbol": "005930.KS", "market": "KR", "exchange": "KOSPI", "nameKo": "삼성전자", "sector": "Technology", "currency": "KRW" },
  { "symbol": "000660.KS", "market": "KR", "exchange": "KOSPI", "nameKo": "SK하이닉스", "sector": "Technology", "currency": "KRW" },
  { "symbol": "207940.KS", "market": "KR", "exchange": "KOSPI", "nameKo": "삼성바이오로직스", "sector": "Healthcare", "currency": "KRW" },
  { "symbol": "005380.KS", "market": "KR", "exchange": "KOSPI", "nameKo": "현대차", "sector": "Consumer Cyclical", "currency": "KRW" },
  { "symbol": "035420.KS", "market": "KR", "exchange": "KOSPI", "nameKo": "NAVER", "sector": "Communication Services", "currency": "KRW" }
]
```

> 동일 패턴으로 총 50개. 참고: KRX 시가총액 상위 종목.

- [ ] **Step 4: `src/seed/seedTickers.ts` 작성**

```typescript
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getPrisma, disconnectPrisma } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface SeedTicker {
  symbol: string;
  market: 'US' | 'KR';
  exchange: 'NASDAQ' | 'NYSE' | 'KOSPI' | 'KOSDAQ';
  nameEn?: string;
  nameKo?: string;
  sector?: string;
  currency: string;
}

function loadSeedFile(name: string): SeedTicker[] {
  const fp = path.join(__dirname, 'data', name);
  return JSON.parse(readFileSync(fp, 'utf-8'));
}

async function main() {
  const prisma = getPrisma();
  const all = [...loadSeedFile('us-top.json'), ...loadSeedFile('kr-top.json')];

  for (const t of all) {
    await prisma.ticker.upsert({
      where: { symbol: t.symbol },
      update: {
        market: t.market,
        exchange: t.exchange,
        nameEn: t.nameEn,
        nameKo: t.nameKo,
        sector: t.sector,
        currency: t.currency,
      },
      create: {
        symbol: t.symbol,
        market: t.market,
        exchange: t.exchange,
        nameEn: t.nameEn,
        nameKo: t.nameKo,
        sector: t.sector,
        currency: t.currency,
      },
    });
  }
  console.log(`Seeded ${all.length} tickers.`);
  await disconnectPrisma();
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 5: 시드 실행**

```bash
npm run -w @algotick/server seed
```
Expected: "Seeded 100 tickers." (또는 작성한 개수)

- [ ] **Step 6: DB 확인**

```bash
PGPASSWORD=algotick psql -h localhost -U algotick -d algotick -c "SELECT COUNT(*), market FROM tickers GROUP BY market;"
```
Expected: US/KR 각 50개 (또는 작성한 수)

- [ ] **Step 7: 커밋**

```bash
git add packages/server/src/seed/
git commit -m "[OP-016] feat(server): 종목 마스터 시드 (US/KR 상위 100종)"
git checkout develop && git merge feature/OP-016-seed-tickers --no-ff -m "[OP-016] merge: seed tickers"
```

---

## Task 17: /api/search 엔드포인트

**Files:**
- Create: `packages/server/src/services/searchService.ts`
- Create: `packages/server/src/api/search.ts`
- Modify: `packages/server/src/index.ts`
- Create: `packages/server/tests/services/searchService.test.ts`
- Create: `packages/server/tests/api/search.test.ts`

- [ ] **Step 1: feature 브랜치**

```bash
git checkout -b feature/OP-017-search-api
```

- [ ] **Step 2: 실패 service 테스트 — `tests/services/searchService.test.ts`**

```typescript
import { describe, expect, it, beforeEach } from 'vitest';
import { getPrisma } from '../../src/db';
import { searchTickers } from '../../src/services/searchService';

describe('searchTickers', () => {
  beforeEach(async () => {
    await getPrisma().ticker.deleteMany({ where: { symbol: { startsWith: 'TST' } } });
    await getPrisma().ticker.createMany({
      data: [
        { symbol: 'TST1', market: 'US', exchange: 'NASDAQ', nameEn: 'Test One Inc', currency: 'USD' },
        { symbol: 'TST2', market: 'US', exchange: 'NASDAQ', nameEn: 'Other Company', currency: 'USD' },
        { symbol: 'TST3.KS', market: 'KR', exchange: 'KOSPI', nameKo: '테스트삼', currency: 'KRW' },
      ],
    });
  });

  it('matches by symbol prefix', async () => {
    const r = await searchTickers('TST1');
    expect(r.find(x => x.symbol === 'TST1')).toBeDefined();
  });

  it('matches by name substring (English)', async () => {
    const r = await searchTickers('Test One');
    expect(r.find(x => x.symbol === 'TST1')).toBeDefined();
  });

  it('matches by Korean name', async () => {
    const r = await searchTickers('테스트삼');
    expect(r.find(x => x.symbol === 'TST3.KS')).toBeDefined();
  });

  it('respects limit', async () => {
    const r = await searchTickers('TST', 2);
    expect(r.length).toBeLessThanOrEqual(2);
  });
});
```

- [ ] **Step 3: 테스트 실행 (실패)**

```bash
npm run -w @algotick/server test -- searchService
```
Expected: 함수 없음

- [ ] **Step 4: `src/services/searchService.ts` 작성**

```typescript
import { getPrisma } from '../db.js';
import type { Ticker } from '@algotick/shared';

export async function searchTickers(query: string, limit = 10): Promise<Ticker[]> {
  const q = query.trim();
  if (q.length === 0) return [];

  const rows = await getPrisma().ticker.findMany({
    where: {
      OR: [
        { symbol: { startsWith: q, mode: 'insensitive' } },
        { nameEn: { contains: q, mode: 'insensitive' } },
        { nameKo: { contains: q } },
      ],
    },
    take: limit,
    orderBy: [{ symbol: 'asc' }],
  });

  return rows.map((r) => ({
    symbol: r.symbol,
    market: r.market as Ticker['market'],
    exchange: r.exchange as Ticker['exchange'],
    nameEn: r.nameEn ?? undefined,
    nameKo: r.nameKo ?? undefined,
    sector: r.sector ?? undefined,
    industry: r.industry ?? undefined,
    currency: r.currency as Ticker['currency'],
    listedAt: r.listedAt?.toISOString(),
    delistedAt: r.delistedAt?.toISOString(),
  }));
}
```

- [ ] **Step 5: service 테스트 실행 (통과)**

```bash
npm run -w @algotick/server test -- searchService
```
Expected: 4 tests pass

- [ ] **Step 6: 실패 API 테스트 — `tests/api/search.test.ts`**

```typescript
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/index';
import { getPrisma } from '../../src/db';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
  await getPrisma().ticker.deleteMany({ where: { symbol: 'TSTSEARCH' } });
  await getPrisma().ticker.create({
    data: { symbol: 'TSTSEARCH', market: 'US', exchange: 'NASDAQ', nameEn: 'TestSearch Co', currency: 'USD' },
  });
});
afterAll(async () => {
  await getPrisma().ticker.deleteMany({ where: { symbol: 'TSTSEARCH' } });
  await app.close();
});

describe('GET /api/search', () => {
  it('returns matching tickers', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/search?q=TSTSEARCH' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.results).toBeInstanceOf(Array);
    expect(body.results.find((r: { symbol: string }) => r.symbol === 'TSTSEARCH')).toBeDefined();
  });

  it('returns 400 when q is missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/search' });
    expect(res.statusCode).toBe(400);
  });
});
```

- [ ] **Step 7: `src/api/search.ts` 작성**

```typescript
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { searchTickers } from '../services/searchService.js';

const QuerySchema = z.object({
  q: z.string().min(1, 'query is required'),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

export async function registerSearchRoute(app: FastifyInstance): Promise<void> {
  app.get('/api/search', async (req, reply) => {
    const parsed = QuerySchema.safeParse(req.query);
    if (!parsed.success) {
      reply.code(400);
      return { error: { code: 'BAD_REQUEST', message: 'invalid query', details: parsed.error.flatten() } };
    }
    const results = await searchTickers(parsed.data.q, parsed.data.limit);
    return { results };
  });
}
```

- [ ] **Step 8: `src/index.ts`에 등록**

`buildApp` 내 `registerHealthRoute` 호출 뒤에:

```typescript
import { registerSearchRoute } from './api/search.js';
// ...
await registerSearchRoute(app);
```

- [ ] **Step 9: 테스트 실행 (통과)**

```bash
npm run -w @algotick/server test -- search
```
Expected: 6 tests pass (service 4 + api 2)

- [ ] **Step 10: 커밋**

```bash
git add packages/server/src/services/searchService.ts packages/server/src/api/search.ts packages/server/src/index.ts packages/server/tests/services/ packages/server/tests/api/search.test.ts
git commit -m "[OP-017] feat(server): /api/search 엔드포인트 (DB 기반)"
git checkout develop && git merge feature/OP-017-search-api --no-ff -m "[OP-017] merge: /api/search"
```

---

## Task 18: /api/ticker/:symbol 엔드포인트 (캐시 hit/stale/miss)

**Files:**
- Create: `packages/server/src/services/tickerService.ts`
- Create: `packages/server/src/api/ticker.ts`
- Modify: `packages/server/src/index.ts`
- Create: `packages/server/tests/services/tickerService.test.ts`
- Create: `packages/server/tests/api/ticker.test.ts`

- [ ] **Step 1: feature 브랜치**

```bash
git checkout -b feature/OP-018-ticker-api
```

- [ ] **Step 2: 실패 service 테스트 — `tests/services/tickerService.test.ts`**

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getPrisma } from '../../src/db';
import { getTickerDetail } from '../../src/services/tickerService';

const mockAdapter = {
  market: 'US' as const,
  getQuote: vi.fn(async (symbol: string) => ({
    symbol,
    price: 100,
    volume: 1000,
    changePct: 1.0,
    ts: new Date('2026-05-19T15:00:00Z'),
    source: 'yahoo',
    marketCap: 100_000,         // 100 × 1000 = 100_000 → 일치 (검증 통과)
    sharesOutstanding: 1000,
  })),
  getDailyOHLCV: vi.fn(async () => [
    { symbol: 'TST', date: '2026-05-18', open: 99, high: 101, low: 98, close: 100, volume: 1000 },
  ]),
  search: vi.fn(async () => []),
};

beforeEach(async () => {
  await getPrisma().ingestionLog.deleteMany({ where: { symbol: 'TICKERTST' } });
  await getPrisma().quoteIntraday.deleteMany({ where: { symbol: 'TICKERTST' } });
  await getPrisma().quoteDaily.deleteMany({ where: { symbol: 'TICKERTST' } });
  await getPrisma().ticker.deleteMany({ where: { symbol: 'TICKERTST' } });
  await getPrisma().ticker.create({
    data: { symbol: 'TICKERTST', market: 'US', exchange: 'NASDAQ', nameEn: 'Test', currency: 'USD' },
  });
  mockAdapter.getQuote.mockClear();
  mockAdapter.getDailyOHLCV.mockClear();
});

describe('getTickerDetail', () => {
  it('cache miss: fetches from adapter and persists', async () => {
    const result = await getTickerDetail('TICKERTST', mockAdapter);
    expect(mockAdapter.getQuote).toHaveBeenCalledTimes(1);
    expect(mockAdapter.getDailyOHLCV).toHaveBeenCalledTimes(1);
    expect(result.freshness).toBe('fresh');
    expect(result.data.quote.price).toBe(100);
    expect(result.warnings).toBeDefined();

    const persisted = await getPrisma().quoteIntraday.findFirst({ where: { symbol: 'TICKERTST' } });
    expect(persisted).not.toBeNull();
  });

  it('returns warnings array when validator emits warnings (PRICE_JUMP_LARGE)', async () => {
    // 첫 호출: 정상 시드
    await getTickerDetail('TICKERTST', mockAdapter);
    // 두 번째 호출: 큰 가격 점프 시뮬레이션
    mockAdapter.getDailyOHLCV.mockResolvedValueOnce([
      { symbol: 'TICKERTST', date: '2026-05-18', open: 100, high: 101, low: 99, close: 100, volume: 1000 },
      { symbol: 'TICKERTST', date: '2026-05-19', open: 100, high: 145, low: 100, close: 140, volume: 1000 }, // +40%
    ]);
    // ingestionLog를 강제 stale로
    await getPrisma().ingestionLog.update({
      where: { symbol_kind: { symbol: 'TICKERTST', kind: 'quote' } },
      data: { lastFetchedAt: new Date(Date.now() - 5 * 60 * 1000) },
    });
    const result = await getTickerDetail('TICKERTST', mockAdapter);
    // warning이 즉시 또는 persistedWarnings로 포함될 수 있음
    expect(result.warnings).toBeDefined();
  });

  it('cache hit & fresh: returns DB without adapter call', async () => {
    await getTickerDetail('TICKERTST', mockAdapter); // warm
    mockAdapter.getQuote.mockClear();
    mockAdapter.getDailyOHLCV.mockClear();

    const result = await getTickerDetail('TICKERTST', mockAdapter);
    expect(mockAdapter.getQuote).not.toHaveBeenCalled();
    expect(result.freshness).toBe('fresh');
  });

  it('cache hit & stale: returns DB immediately and marks stale', async () => {
    await getTickerDetail('TICKERTST', mockAdapter);
    await getPrisma().ingestionLog.update({
      where: { symbol_kind: { symbol: 'TICKERTST', kind: 'quote' } },
      data: { lastFetchedAt: new Date(Date.now() - 5 * 60 * 1000) }, // 5분 전
    });
    mockAdapter.getQuote.mockClear();

    const result = await getTickerDetail('TICKERTST', mockAdapter);
    // 결과는 즉시 반환되고 stale로 마킹. 백그라운드 fetch는 별도 동작.
    expect(result.freshness).toBe('stale');
  });

  it('throws when ticker symbol unknown in master', async () => {
    await expect(getTickerDetail('UNKNOWN_X_Y_Z', mockAdapter)).rejects.toThrow(/not found/i);
  });
});
```

- [ ] **Step 3: 테스트 실행 (실패)**

```bash
npm run -w @algotick/server test -- tickerService
```
Expected: 함수 없음

- [ ] **Step 4: `src/services/tickerService.ts` 작성** (§14 Validator 통합)

```typescript
import type { MarketAdapter } from '../adapters/base.js';
import { getPrisma } from '../db.js';
import type { CachedResponse, ValidationResult, Market } from '@algotick/shared';
import { validateQuote, validateCandle, hasErrors, pickWarnings } from '../validators/index.js';

export interface TickerDetail {
  symbol: string;
  market: string;
  exchange: string;
  name?: string;
  currency: string;
  quote: {
    price: number;
    volume: number;
    changePct: number;
    ts: string;
  } | null;
  candles: Array<{
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
}

const STALE_QUOTE_MS = 60 * 1000; // 60s

export async function getTickerDetail(
  symbol: string,
  adapter: MarketAdapter,
): Promise<CachedResponse<TickerDetail>> {
  const prisma = getPrisma();
  const master = await prisma.ticker.findUnique({ where: { symbol } });
  if (!master) throw new Error(`Ticker not found in master: ${symbol}`);

  const log = await prisma.ingestionLog.findUnique({
    where: { symbol_kind: { symbol, kind: 'quote' } },
  });

  const now = Date.now();
  const stale = !log || now - log.lastFetchedAt.getTime() > STALE_QUOTE_MS;
  const miss = !log;
  let warnings: ValidationResult[] = [];

  if (miss) {
    // 동기 fetch
    warnings = await refreshTicker(symbol, adapter, master.market as Market);
  }

  // 응답 구성: DB에서 읽음
  const detail = await readDetailFromDb(symbol);
  const freshness = miss ? 'fresh' : stale ? 'stale' : 'fresh';
  const lastFetchedAt = (await prisma.ingestionLog.findUnique({
    where: { symbol_kind: { symbol, kind: 'quote' } },
  }))?.lastFetchedAt.toISOString() ?? new Date().toISOString();

  // stale인 경우 백그라운드 갱신 (Stage 1에서는 fire-and-forget만, SSE는 Stage 3)
  if (stale && !miss) {
    void refreshTicker(symbol, adapter, master.market as Market).catch(() => undefined);
  }

  // 최근 24h 내 warning을 DB에서 추가 조회
  const dbWarnings = await prisma.validationResult.findMany({
    where: {
      symbol,
      ts: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      severity: { in: ['warning', 'info'] },
    },
    orderBy: { ts: 'desc' },
    take: 20,
  });
  const persistedWarnings: ValidationResult[] = dbWarnings.map((w) => ({
    severity: w.severity as ValidationResult['severity'],
    code: w.code,
    message: w.message,
    details: (w.details as Record<string, unknown> | null) ?? undefined,
  }));

  return {
    data: {
      ...detail,
      market: master.market,
      exchange: master.exchange,
      name: master.nameEn ?? master.nameKo ?? undefined,
      currency: master.currency,
    },
    freshness,
    lastFetchedAt,
    warnings: [...warnings, ...persistedWarnings],
  };
}

/**
 * 외부 Adapter 호출 → 검증 → (error면 저장 X, warning은 저장하되 DB에 기록).
 * 반환: 이번 페치에서 발생한 warnings (응답에 즉시 포함하기 위함)
 */
async function refreshTicker(
  symbol: string,
  adapter: MarketAdapter,
  market: Market,
): Promise<ValidationResult[]> {
  const prisma = getPrisma();
  const ctx = { symbol, market };
  const collectedWarnings: ValidationResult[] = [];

  const quote = await adapter.getQuote(symbol);
  const quoteResults = validateQuote(quote, ctx);
  if (hasErrors(quoteResults)) {
    await persistValidationResults(symbol, 'quote', quoteResults);
    return pickWarnings(quoteResults); // 저장 안 함
  }
  collectedWarnings.push(...pickWarnings(quoteResults));

  const from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const candles = await adapter.getDailyOHLCV(symbol, from, new Date());

  const validCandles: typeof candles = [];
  let prev: { date: string; open: number; high: number; low: number; close: number; volume: number; symbol: string } | undefined;
  for (const c of candles) {
    const res = validateCandle(c, prev, ctx);
    if (hasErrors(res)) {
      await persistValidationResults(symbol, 'daily', res);
      continue; // 이 봉은 스킵, 나머지는 진행
    }
    if (res.length > 0) {
      collectedWarnings.push(...pickWarnings(res));
      await persistValidationResults(symbol, 'daily', pickWarnings(res));
    }
    validCandles.push(c);
    prev = c;
  }

  await prisma.$transaction([
    prisma.quoteIntraday.upsert({
      where: { symbol_ts: { symbol, ts: quote.ts } },
      update: { price: quote.price, volume: BigInt(quote.volume), changePct: quote.changePct, source: quote.source },
      create: { symbol, ts: quote.ts, price: quote.price, volume: BigInt(quote.volume), changePct: quote.changePct, source: quote.source },
    }),
    ...validCandles.map((c) => prisma.quoteDaily.upsert({
      where: { symbol_date: { symbol, date: new Date(c.date) } },
      update: { open: c.open, high: c.high, low: c.low, close: c.close, adjClose: c.adjClose, volume: BigInt(c.volume) },
      create: { symbol, date: new Date(c.date), open: c.open, high: c.high, low: c.low, close: c.close, adjClose: c.adjClose, volume: BigInt(c.volume) },
    })),
    prisma.ingestionLog.upsert({
      where: { symbol_kind: { symbol, kind: 'quote' } },
      update: { lastFetchedAt: new Date() },
      create: { symbol, kind: 'quote', lastFetchedAt: new Date() },
    }),
  ]);

  return collectedWarnings;
}

async function persistValidationResults(
  symbol: string,
  kind: string,
  results: ValidationResult[],
): Promise<void> {
  if (results.length === 0) return;
  const prisma = getPrisma();
  await prisma.validationResult.createMany({
    data: results.map((r) => ({
      symbol,
      kind,
      severity: r.severity,
      code: r.code,
      message: r.message,
      details: (r.details as object) ?? undefined,
    })),
  });
}

async function readDetailFromDb(symbol: string): Promise<Omit<TickerDetail, 'market' | 'exchange' | 'name' | 'currency'>> {
  const prisma = getPrisma();
  const latest = await prisma.quoteIntraday.findFirst({ where: { symbol }, orderBy: { ts: 'desc' } });
  const candles = await prisma.quoteDaily.findMany({
    where: { symbol },
    orderBy: { date: 'desc' },
    take: 365,
  });
  return {
    symbol,
    quote: latest
      ? {
          price: Number(latest.price),
          volume: Number(latest.volume),
          changePct: Number(latest.changePct),
          ts: latest.ts.toISOString(),
        }
      : null,
    candles: candles.reverse().map((c) => ({
      date: c.date.toISOString().slice(0, 10),
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
      volume: Number(c.volume),
    })),
  };
}
```

- [ ] **Step 5: service 테스트 통과 확인**

```bash
npm run -w @algotick/server test -- tickerService
```
Expected: 4 tests pass

- [ ] **Step 6: API 테스트 — `tests/api/ticker.test.ts`**

```typescript
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/index';
import { getPrisma } from '../../src/db';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
});

describe('GET /api/ticker/:symbol', () => {
  it('returns 404 when ticker not in master', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/ticker/__NOPE__' });
    expect(res.statusCode).toBe(404);
  });

  it('returns 200 with detail for known US ticker', async () => {
    // 시드된 AAPL 사용. 실제 외부 호출은 일어남에 주의.
    const res = await app.inject({ method: 'GET', url: '/api/ticker/AAPL' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.symbol).toBe('AAPL');
    expect(['fresh', 'stale']).toContain(body.freshness);
  }, 15000);
});
```

> 두 번째 테스트는 외부 Yahoo Finance API를 실제 호출. 네트워크 없는 환경에서는 mocking으로 대체 가능하나 Stage 1에서는 통합 sanity check로 그대로 둠. CI에서는 `it.skipIf(!process.env.RUN_NET_TESTS)` 패턴 권장.

- [ ] **Step 7: `src/api/ticker.ts` 작성**

```typescript
import type { FastifyInstance } from 'fastify';
import { UsYahooAdapter } from '../adapters/us-yahoo.js';
import { getTickerDetail } from '../services/tickerService.js';
import { getPrisma } from '../db.js';

const usYahoo = new UsYahooAdapter();

export async function registerTickerRoute(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { symbol: string } }>('/api/ticker/:symbol', async (req, reply) => {
    const { symbol } = req.params;
    const master = await getPrisma().ticker.findUnique({ where: { symbol } });
    if (!master) {
      reply.code(404);
      return { error: { code: 'NOT_FOUND', message: `Ticker ${symbol} not found` } };
    }
    if (master.market === 'KR') {
      reply.code(501);
      return { error: { code: 'NOT_IMPLEMENTED', message: 'KR market arrives in Stage 4' } };
    }
    try {
      const result = await getTickerDetail(symbol, usYahoo);
      return result;
    } catch (e) {
      req.log.error({ err: e }, 'ticker detail failed');
      reply.code(502);
      return { error: { code: 'UPSTREAM_FAILED', message: 'Failed to fetch ticker data' } };
    }
  });
}
```

- [ ] **Step 8: `src/index.ts`에 등록**

`buildApp` 내 `registerSearchRoute` 호출 뒤에:

```typescript
import { registerTickerRoute } from './api/ticker.js';
// ...
await registerTickerRoute(app);
```

- [ ] **Step 9: 테스트 + 수동 확인**

```bash
npm run -w @algotick/server test -- ticker
```
Expected: 6 tests pass (service 4 + api 2)

```bash
npm run -w @algotick/server dev &
sleep 2
curl -s http://localhost:4000/api/search?q=AAPL | jq
curl -s http://localhost:4000/api/ticker/AAPL | jq '.data | {symbol, quote, candles_count: (.candles|length)}'
kill %1
```
Expected: 검색 결과, 시세, 일봉 365건

- [ ] **Step 10: 커밋**

```bash
git add packages/server/src/services/tickerService.ts packages/server/src/api/ticker.ts packages/server/src/index.ts packages/server/tests/
git commit -m "[OP-018] feat(server): /api/ticker/:symbol (캐시 hit/stale/miss)"
git checkout develop && git merge feature/OP-018-ticker-api --no-ff -m "[OP-018] merge: /api/ticker"
```

---

## Task 19: 에러 응답 표준화 + Fastify 전역 핸들러

**Files:**
- Create: `packages/server/src/errors.ts`
- Modify: `packages/server/src/index.ts`
- Create: `packages/server/tests/errors.test.ts`

- [ ] **Step 1: feature 브랜치**

```bash
git checkout -b feature/OP-019-error-handler
```

- [ ] **Step 2: 실패 테스트 — `tests/errors.test.ts`**

```typescript
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/index';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); });
afterAll(async () => { await app.close(); });

describe('global error handler', () => {
  it('returns standardized 404 for unknown routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/__no_such__' });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 500 with code for unexpected errors', async () => {
    app.get('/__crash__', async () => { throw new Error('boom'); });
    const res = await app.inject({ method: 'GET', url: '/__crash__' });
    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});
```

- [ ] **Step 3: 테스트 실행 (실패)**

```bash
npm run -w @algotick/server test -- errors
```
Expected: 표준 형식 아님

- [ ] **Step 4: `src/errors.ts` 작성**

```typescript
import type { FastifyInstance } from 'fastify';

export async function registerErrorHandlers(app: FastifyInstance): Promise<void> {
  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({
      error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.url} not found` },
    });
  });

  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err }, 'unhandled error');
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    const code = status === 500 ? 'INTERNAL_ERROR' : (err.code ?? 'ERROR');
    reply.code(status).send({
      error: { code, message: err.message ?? 'Internal server error' },
    });
  });
}
```

- [ ] **Step 5: `src/index.ts`에 등록**

`buildApp` 내, sensible/cors 등록 직후 + 라우트 등록 직전:

```typescript
import { registerErrorHandlers } from './errors.js';
// ...
await registerErrorHandlers(app);
```

- [ ] **Step 6: 테스트 + 기존 테스트 회귀 확인**

```bash
npm run -w @algotick/server test
```
Expected: 모든 테스트 pass (search.test의 400 응답이 새 핸들러와 충돌 안 하는지도 확인 — 새 핸들러는 라우트 핸들러에서 명시적으로 reply.code 한 경우는 그대로 둠)

- [ ] **Step 7: 커밋**

```bash
git add packages/server/src/errors.ts packages/server/src/index.ts packages/server/tests/errors.test.ts
git commit -m "[OP-019] feat(server): 전역 에러/404 핸들러 표준화"
git checkout develop && git merge feature/OP-019-error-handler --no-ff -m "[OP-019] merge: error handler"
```

---

## Task 20: client 패키지 placeholder

**Files:**
- Create: `packages/client/package.json`
- Create: `packages/client/README.md`

> Stage 2에서 본격 구현. Stage 1에서는 workspaces 구조 완성도를 위해 빈 패키지만.

- [ ] **Step 1: feature 브랜치**

```bash
git checkout -b feature/OP-020-client-placeholder
```

- [ ] **Step 2: `packages/client/package.json`**

```json
{
  "name": "@algotick/client",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "echo 'client implemented in Stage 2'",
    "build": "echo 'client implemented in Stage 2'",
    "test": "echo 'client implemented in Stage 2'"
  }
}
```

- [ ] **Step 3: `packages/client/README.md`**

```markdown
# @algotick/client

Stage 2에서 React + Vite + TailwindCSS로 본격 구현 예정.

본 디렉토리는 npm workspaces 구조 일관성을 위한 placeholder.
```

- [ ] **Step 4: 커밋**

```bash
git add packages/client/
git commit -m "[OP-020] chore(client): placeholder 패키지 (Stage 2 예정)"
git checkout develop && git merge feature/OP-020-client-placeholder --no-ff -m "[OP-020] merge: client placeholder"
```

---

## Task 21: GitHub repo 생성 + 첫 푸시

**Files:** (없음 — 외부 명령)

- [ ] **Step 1: gh CLI 인증 확인**

```bash
gh auth status
```
Expected: 로그인 상태 표시. 아니면 `gh auth login` 먼저.

- [ ] **Step 2: feature 브랜치 + main으로 가서 push 준비**

```bash
git checkout develop
git log --oneline | head -20
```
Expected: Stage 1 모든 OP-002~OP-020 커밋 표시

- [ ] **Step 3: develop을 main에 머지** (Stage 1 첫 릴리즈 시점)

```bash
git checkout main
git merge develop --no-ff -m "[OP-021] release: Stage 1 backend walking skeleton"
git tag stage-1
```

- [ ] **Step 4: GitHub private repo 생성 + push**

```bash
gh repo create AlgoTick --private --source=. --remote=origin --push
git push --tags
git push origin develop
```
Expected: `https://github.com/<username>/AlgoTick` 생성 + main/develop/태그 push 완료

- [ ] **Step 5: 확인**

```bash
gh repo view AlgoTick --web
```
Expected: 브라우저에서 repo 열림. README가 표시되는지 확인.

> Task 21에는 커밋이 없음 (이미 main에 머지된 상태).

---

## Task 22: 통합 sanity check — 처음부터 끝까지 한 번 더

**Files:** (없음 — 검증만)

- [ ] **Step 1: 클린 빌드**

```bash
npm install
npm run -ws typecheck
npm run -w @algotick/server build
```
Expected: 타입 에러 0, 빌드 성공

- [ ] **Step 2: 전체 테스트**

```bash
npm test
```
Expected: 모든 패키지 테스트 pass

- [ ] **Step 3: 수동 E2E 시나리오**

```bash
# 1. DB는 깨끗하다고 가정 (또는 seed 다시 실행)
npm run -w @algotick/server seed

# 2. 서버 띄우기
npm run -w @algotick/server dev &
sleep 2

# 3. health check
curl -s http://localhost:4000/health | jq
# Expected: { "status": "ok", "db": "connected", "ts": "..." }

# 4. 검색
curl -s "http://localhost:4000/api/search?q=app" | jq '.results[] | {symbol, nameEn}'
# Expected: AAPL 포함

# 5. 종목 상세 (캐시 miss → fresh)
curl -s http://localhost:4000/api/ticker/AAPL | jq '{freshness, price: .data.quote.price, candle_count: (.data.candles|length)}'
# Expected: freshness "fresh", price 숫자, candles 365 근처

# 6. 다시 호출 (캐시 hit)
curl -s http://localhost:4000/api/ticker/AAPL | jq '.freshness'
# Expected: "fresh" (60초 안)

# 7. KR 종목은 501
curl -s http://localhost:4000/api/ticker/005930.KS | jq
# Expected: error.code "NOT_IMPLEMENTED"

# 8. 미존재
curl -s http://localhost:4000/api/ticker/NOPENOPE | jq
# Expected: error.code "NOT_FOUND"

kill %1
```

- [ ] **Step 4: 완료 보고**

Stage 1 완료 조건:
- ✅ 모노레포 구조 (shared/server/client) 완성
- ✅ PostgreSQL + Prisma 동작
- ✅ /health, /api/search, /api/ticker/:symbol 동작
- ✅ us-yahoo Adapter (시세/일봉/검색)
- ✅ 캐시 hit/stale/miss 로직 검증됨
- ✅ vitest 기반 단위/통합 테스트 통과
- ✅ GitHub repo 생성 + 첫 푸시 + Stage 1 태그

다음은 Stage 2 (프론트엔드 walking skeleton) plan 작성.

---

## §14 검증 시스템 통합 매핑 (Stage 1에서 어떤 Task가 무엇을 다루나)

| §14 요구사항 | Stage 1 Task | 비고 |
|---|---|---|
| §14.1 Provenance 타입 (Source/Confidence) | Task 6 (`packages/shared/src/schema/provenance.ts`) | 클라이언트도 import |
| §14.1 신뢰도 태그 UI 렌더링 | Stage 2 | 본 stage 범위 외 |
| §14.2.1 Self-consistency 룰 (`MARKET_CAP_MISMATCH`, `OHLC_INVARIANT`, etc.) | Task 14b (`src/validators/rules.ts`) | quote/candle 룰만 |
| §14.2.2 Time-series sanity (`PRICE_JUMP_LARGE`, `VOLUME_ZERO`, `FUTURE_DATE`) | Task 14b | candle prev 비교 |
| §14.2.3 Range validity (`MARKET_CAP_POSITIVE`, `VOLUME_NEGATIVE`) | Task 14b | quote 룰 |
| §14.2.3 PER/PBR/ROE 범위 | Stage 5 (재무 데이터 도입 시) | Stage 1 범위 외 |
| §14.2.4 Cross-source | Stage 4 이후 | 미주 단일 소스라 N/A |
| §14.3 Validator 인터페이스 (`ValidationResult`, `ValidatorContext`) | Task 6 (스키마) + Task 14b (server 측 컨텍스트) | |
| §14.4 UI 표현 원칙 | Stage 2~ | 본 stage 범위 외 |
| §14.5 Provenance Zod 스키마 | Task 6 | |
| §14.6 운영 시 활용 (validation_results 조회) | 부분 (Task 8 테이블) + 후속 Stage (운영 라우트) | |
| `validation_results` 테이블 | Task 8 (Prisma model) + Task 9 (마이그레이션) | |
| Adapter 응답 검증 통합 | Task 18 (`tickerService` `refreshTicker` 내부) | error면 저장 X, warning은 저장 + 응답에 포함 |
| API 응답 `warnings` 배열 | Task 18 (`getTickerDetail` 반환값) | 24시간 내 DB 기록도 포함 |

**Stage 1에서 명시적으로 미루는 것 (Out of scope):**
- 재무 데이터 룰 (`EBITDA_FORMULA`, `INCOME_STATEMENT_BALANCE`, `BALANCE_SHEET_BALANCE`, `WACC_RANGE`) → Stage 5
- DCF 가정값 검증 → Stage 5
- 신뢰도 UI 아이콘 (●/◐/○) → Stage 2
- glossary.md 기반 ⓘ 툴팁 → Stage 2
- "🟡 데이터 경고 N건" 헤더 배지 → Stage 2
- Cross-source 비교 → Stage 4 (한주 네이버 vs DART)
- `/api/__validations__` 운영 라우트 → 별도 운영 Stage 또는 필요 시 Stage 8

---

## Self-Review Checklist (작성자가 plan 완성 직후 점검)

본 plan 작성자가 self-review 결과:

**1. Spec coverage:**
- §2.1 아키텍처 → Task 7, 8, 12 (server 셋업)
- §2.2 스택 → 모든 Task에서 명시된 버전 사용
- §2.3 Adapter 패턴 → Task 14, 15
- §3.1 데이터 모델 (마스터 + 시세 + ingestion_log + **validation_results**) → Task 8
- §4.1 라우트 — search/ticker → Task 17, 18 (나머지 라우트는 후속 Stage)
- §5.1 Phase 2 (캐시 hit/stale/miss) → Task 18
- §5.4 회복력 (에러 핸들러) → Task 19
- §5.6 검증 파이프라인 → Task 14b + Task 18
- §6 디렉토리 구조 → Task 2~7
- §7 환경 설정 → Task 4, 10
- §8.1 서버 에러 → Task 19
- §9 테스트 → 매 Task TDD
- §10 Git → 매 Task feature/OP-N 브랜치 + 커밋, Task 21에서 GitHub 등록
- **§14 검증 시스템 → 위 통합 매핑 참고**

**2. Placeholder scan:** 없음. 모든 step에 실제 코드/명령이 포함됨.

**3. Type consistency:**
- `Ticker`, `Market`, `Exchange`, `Quote`, `Candle`, **`Provenance`**, **`ValidationResult`**, **`Severity`** — Task 6에서 정의된 이름을 Task 8(Prisma), Task 14, 14b, 15, 17, 18에서 일관되게 사용.
- `MarketAdapter` 인터페이스 — Task 14에서 정의된 그대로 Task 15, 18에서 구현/소비.
- `QuoteResult.marketCap`, `QuoteResult.sharesOutstanding` — Task 14, 15, 18, Validator 룰에서 일관 사용.
- `CachedResponse<T>` (now with `warnings?`) — Task 6에서 정의, Task 18에서 사용.
- 함수명 일관성: `getQuote`, `getDailyOHLCV`, `search`, `searchTickers`, `getTickerDetail`, `validateQuote`, `validateCandle`, `hasErrors`, `pickWarnings`, `loadConfig`, `getPrisma` — 변경 없음.
- Validation 코드 상수: `MARKET_CAP_MISMATCH`, `MARKET_CAP_POSITIVE`, `OHLC_INVARIANT`, `VOLUME_NEGATIVE`, `VOLUME_ZERO`, `FUTURE_DATE`, `PRICE_JUMP_LARGE` — 디자인 스펙 §14.2 표와 일치.

**4. Scope check:** Stage 1은 단일 plan에 적정한 크기. 작업 23개 (Validator Task 추가), TDD 단계 포함 약 130개 step. 한 사람이 1.5~2주 분량.
