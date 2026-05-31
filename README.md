# RF Failure Intelligence Platform UX

RF-FIP는 RF 감도 저하(RX sensitivity degradation, desense) 이슈를 분석하고, Local Engine, Signature 사전, Knowledge DB, RAG, LLM adapter를 함께 사용해 RCA 초안과 유사사례를 연결하는 분석 UI입니다.

현재 구현은 사외 개발 환경 기준입니다. Gauss 실제 API 연동은 사내 PC에서 endpoint, schema, key, timeout/error rule이 확정된 뒤 `server/rfFipLlmAdapter.ts`의 `gauss` provider 분기를 교체하는 방식으로 진행합니다.

## 주요 기능

- 이슈 생성, 채팅 기반 분석, 첨부/원문 Import 후보 검토
- Local Engine 기반 RF intent 분류, signature 추출, evidence packet 생성
- OpenAI API adapter 및 Gauss adapter contract
- Knowledge DB confirmed case 저장 및 유사사례 검색
- Public RF Wiki RAG 및 Knowledge DB confirmed case excerpt RAG
- Signature Dictionary, alias dictionary, signature weight rule 관리
- Signature 계층 매핑, 동의어 canonicalization, pending alias 승인 흐름
- 라이트/다크 테마 지원
- HARNESS phase, docs, rules, smoke 기반 회귀 관리

## 분석 파이프라인

1. 사용자가 이슈를 생성하거나 채팅/Import로 RF 현상을 입력합니다.
2. Local Engine이 RF intent를 판별하고 core signature와 alias 기반 signature를 추출합니다.
3. `SignatureTag[]`는 저장 구조를 유지하되, 소비 시점에 다음으로 분리합니다.
   - 분석 Signature: 원인 판단, 유사사례, missing checklist에 사용
   - 메타데이터: `RAT`, `Band`, `Degradation`, `Unit Scope`, `Tx Threshold`
   - RCA 속성: `Mechanism`, `Desense Category`, `PIM Risk`
4. Local Engine은 evidence packet, missing info, relation hint, 유사사례 후보를 생성합니다.
5. RAG는 task/provider/security 정책에 맞는 RF Wiki 또는 Knowledge case excerpt만 검색합니다.
6. LLM은 Local Evidence Packet과 RAG reference를 받아 설명, 요약, 다음 분석 단계, 후보 우선순위를 보강합니다.
7. confirmed 이슈만 Knowledge DB case로 저장되며, validated/new/hypothesis는 RAG excerpt source가 아닙니다.

## Signature 운영 원칙

- DB schema migration 없이 `Issue.signatures`와 `KnowledgeCase.signatures`는 legacy 호환을 유지합니다.
- 실제 판단에는 `splitSignatureTags()`를 통해 분석 Signature만 우선 사용합니다.
- Band/RAT는 원인 signature가 아니라 조건/필터 metadata입니다.
- Band가 다른 사례도 유사사례에서 제외하지 않습니다. 같은 Band는 boost, 다른 Band는 penalty와 `Band 다름` 배지로 표시합니다.
- 미매핑 경고는 분석 Signature에만 적용합니다. Metadata와 RCA 속성은 별도 label로 표시합니다.

## RAG 운영

RAG source는 reference-only입니다. 최종 판단의 source of truth는 Local Evidence Packet과 사용자가 제공한 측정 근거입니다.

- Public RF Wiki: `docs/rf-wiki`, `public-safe`, OpenAI/Gauss/local eligible
- Knowledge DB excerpt: persisted confirmed case에서 서버가 생성, 기본 `internal-only`, OpenAI 전송 금지
- Gauss internal Wiki: contract만 준비, 실제 사내 연동 전까지 blocked
- RAG 운영 점검: UI의 RAG 점검 실행 또는 `rag:ops-report`

## LLM Provider

- `LLM_PROVIDER=local`: deterministic local fallback
- `LLM_PROVIDER=openai`: `.env`의 `OPENAI_API_KEY` 사용
- `LLM_PROVIDER=gauss`: 사내 contract 전까지 501 blocked response 유지

LLM context는 다음을 분리해 전달합니다.

- `context.sharedAnalysisContext.signatures`: 분석 Signature
- `context.sharedAnalysisContext.metadataContext`: Band/RAT/시험 조건 metadata
- `context.sharedAnalysisContext.narrativeContext`: RCA narrative attribute
- `context.retrievedKnowledgeContext`: provider/security filtered RAG snippets

## 실행

```powershell
corepack pnpm install
corepack pnpm run dev
```

기본 개발 서버:

```text
http://127.0.0.1:5173/
```

## 검증

일반 검증:

```powershell
corepack pnpm run check
corepack pnpm run build
corepack pnpm run harness:check
```

주요 smoke:

```powershell
corepack pnpm run smoke:rf-fip
corepack pnpm run smoke:sqlite
corepack pnpm run smoke:llm
corepack pnpm run smoke:evidence
corepack pnpm run smoke:signature-hierarchy
corepack pnpm run smoke:signature-mapping-audit
corepack pnpm run smoke:classification-similarity-cleanup
corepack pnpm run smoke:rag-contract
corepack pnpm run smoke:rag-maintenance
corepack pnpm run smoke:knowledge-case-rag
corepack pnpm run smoke:llm-prompt-contract
```

Windows sandbox 환경에서는 `node_modules` 실행 또는 `esbuild` child process가 EPERM으로 막힐 수 있습니다. 이 경우 동일 명령을 승인된 shell 실행으로 재시도해야 합니다.

## 데이터 저장

- Runtime DB: `.rf-fip-db/rf-fip.sqlite`
- Legacy JSON migration: 빈 SQLite store에서 기존 `.rf-fip-db/rf-fip.json`이 있으면 migration
- `.rf-fip-db/`는 git에 포함하지 않습니다.
- `.env`의 API key는 client bundle, DB, log, response에 노출하지 않아야 합니다.

## 주요 디렉토리

```text
client/src/pages/        App orchestration and main UI
client/src/components/   Reusable UI panels and modals
client/src/lib/          Local Engine, parser, signature, similarity helpers
server/                  API, persistence, LLM adapter, RAG retrieval
shared/                  Client/server shared RF rule catalog
docs/                    Contracts, specs, ADR, RF wiki
phases/                  HARNESS phase records
scripts/                 Smoke and policy checks
```

## 문서

- `docs/ARCHITECTURE.md`
- `docs/API_CONTRACTS.md`
- `docs/DATA_MODEL.md`
- `docs/RAG_CONTRACT.md`
- `docs/AI_ROLE_CHECKLIST.md`
- `docs/RF_DOMAIN_SPEC.md`
- `docs/TEST_PLAN.md`
- `docs/GAUSS_CONTRACT.md`
- `docs/GAUSS_INTERNAL_HANDOFF.md`

## 현재 알려진 제약

- Gauss 실제 call은 사내 API contract 확보 전까지 구현하지 않습니다.
- Browser E2E는 일부 Codex/browser sandbox 환경에서 차단될 수 있습니다.
- `.xls` legacy Excel parsing은 dependency 정책 확정 후 별도 처리합니다.
- OpenAI에는 `internal-only` Knowledge DB excerpt를 기본 전송하지 않습니다.
