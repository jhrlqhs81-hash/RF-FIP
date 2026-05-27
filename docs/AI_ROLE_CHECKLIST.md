# AI Role Checklist

Last reviewed: 2026-05-27

이 문서는 RF-FIP에서 Local Engine, LLM provider(OpenAI/Gauss/local), Hybrid pipeline의 책임을 분리하고 회귀를 막기 위한 점검표입니다. AI 관련 기능을 수정할 때는 이 문서를 기준으로 “누가 판단하고, 누가 설명하며, 어떤 근거만 사용할 수 있는지”를 확인합니다.

## Role Contract

### Local Engine owns

- 입력 파싱, 첨부 메타데이터 파싱, RAW/Import 구조화
- RF signature 추출, alias/canonical key 정규화, 중복 제거 후보 생성
- taxonomy 후보, 유사 사례 후보, 누락 정보 후보 생성
- `LocalEvidencePacket` 생성과 evidence id 관리
- signature weight 적용
  - Analysis: 분류, RCA, 가설 우선순위
  - Retrieval: 유사 사례 검색, Knowledge DB 매칭
  - Workflow: 누락 체크리스트, LLM context 우선순위
- provider 실패 시 local fallback
- 기록 탭의 audit trail 생성
- DB/API persistence boundary

### LLM owns

- 일반 자연어 질문 응답
- RF 분석 결과의 설명 보강
- RCA narrative 초안
- 다음 분석 단계 문장화
- 누락 정보 질문 생성
- local 후보들의 우선순위화와 표현 개선
- Import 후보 reason 보강
- 첨부자료 요약. 단, 서버나 local parser가 제공한 근거 범위 안에서만 수행

### Hybrid owns

- 가설 생성
- RCA Summary
- Signature 정규화 보강
- 유사 사례 기반 판단
- Import 1차 필터링

Hybrid의 원칙은 Local Engine이 evidence packet과 후보를 만들고, LLM은 해당 packet 안에서만 판단과 설명을 보강하는 것입니다.

## Hard Rules

- Client는 OpenAI/Gauss endpoint를 직접 호출하지 않습니다.
- API key는 client bundle, DB, log, response에 노출하지 않습니다.
- LLM은 측정값, 시험 결과, root cause, evidence id를 만들어내면 안 됩니다.
- LLM은 기존 signature와 중복되는 신규 signature를 반환하면 안 됩니다.
- LLM 실패 시 UI는 local fallback 또는 unavailable 상태를 명시해야 합니다.
- 기록 탭은 판단 엔진이 아니라 audit trail입니다. LLM이 임의로 기록을 생성하지 않습니다.
- Gauss provider는 사내 schema가 확정되기 전까지 blocked 상태로 유지합니다.

## Current Checklist

| Area | Status | Check | Current evidence | Gap / Action |
| --- | --- | --- | --- | --- |
| Intent routing | PASS_WITH_RISK | 일반 질문과 RF 분석 질문이 분리되는가 | `isRfAnalysisIntent()`가 RF keyword, issue state, attachment 기준으로 분기 | intent routing 전용 smoke test 추가 필요 |
| General chat | PASS_WITH_RISK | “당신은 누구입니까” 같은 질문을 RF 분석으로 오인하지 않는가 | RF intent가 아니면 LLM chat 또는 app assistant 응답으로 처리 | OpenAI 429 시 fallback 문구가 더 짧고 명확해야 함 |
| Evidence packet | PASS | LLM 입력 전에 local evidence packet을 만드는가 | `buildLocalEvidencePacket()`과 `LocalEvidencePacket` 타입 존재 | 지속 유지 |
| Evidence id grounding | PASS | 가설과 요약이 실제 evidence id만 참조하는가 | `validateHybridHypothesisCandidate()`, grounded summary validation | 지속 유지 |
| Prompt guard | PASS | LLM prompt가 source of truth와 금지 규칙을 명시하는가 | `rfFipLlmAdapter.ts` system prompt에서 measured/local evidence 우선, invented evidence 금지 | prompt 변경 시 smoke 필수 |
| Signature dedupe | PASS | 기존 signature와 겹치는 추출 결과가 제거되는가 | `enforceSignatureDedupe()`가 provider 응답을 서버에서 필터링 | alias 확장 시 canonical map 회귀 점검 필요 |
| Signature weights | PASS | Analysis/Retrieval/Workflow weight가 분리되어 쓰이는가 | `signatureWeights.ts`, 관리자 UI, weighted context | weight 변경 이유와 운영 규칙을 함께 유지 |
| Missing checklist link | PASS_WITH_RISK | 누락 체크리스트와 signature가 같은 기준으로 관리되는가 | workflow weight와 missingInfo 후보가 연결됨 | `RequiredEvidenceGate` 같은 중앙 contract 도입 검토 |
| Similar case retrieval | PASS_WITH_RISK | 검색은 local score를 우선하고 LLM은 설명을 보강하는가 | Retrieval weight와 local similarity 후보 사용 | LLM이 ranking을 바꿀 때 근거 id 표시 강화 필요 |
| RCA Summary | PASS | 다음 분석 단계가 evidence/rationale/messageId를 포함하는가 | `hybridSummary.ts`가 grounded nextSteps를 검증 | 지속 유지 |
| Hypothesis generation | PASS | LLM 단독 판단이 아니라 hybrid 구조인가 | Local 후보와 LLM 후보를 evidence packet으로 검증 | confidence 산식 설명을 UI에 더 명확히 표시 가능 |
| Import filtering | PASS_WITH_RISK | 1차 필터링은 local 구조화와 hybrid reason으로 분리되는가 | import 후보, 원본보기, local facts 기반 흐름 존재 | LLM reason 보강 범위와 저장 schema를 더 명시해야 함 |
| Attachment analysis | PARTIAL | 첨부자료 원문이 분석 근거로 연결되는가 | 첨부 메타, 일부 row/table evidence는 연결 | 이미지 OCR, Excel deep parsing, 파일 직접 업로드는 미완 |
| Provider boundary | PASS | provider 호출이 server-only인가 | `/api/llm/*`, `rfFipLlmAdapter.ts` | 지속 유지 |
| OpenAI provider | PASS_WITH_RISK | OpenAI가 사용 가능할 때만 분석을 보강하는가 | server adapter 존재, 429 fallback 처리 | quota/rate-limit는 외부 운영 리스크 |
| Gauss provider | BLOCKED | 사내 Gauss schema 없이 real call을 하지 않는가 | `LLM_PROVIDER=gauss`는 blocked contract | 사내 PC에서 URL/key/schema/file/timeout/error rule 필요 |
| Secret safety | PASS | key가 응답이나 로그로 새지 않는가 | adapter contract와 blocked response 원칙 | 신규 provider 추가 시 leakage smoke 유지 |
| Audit trail | PASS_WITH_RISK | 메시지, provider, fallback reason이 추적되는가 | message/provider/fallbackReason 이벤트 구조 존재 | 모든 우측 탭 이벤트에 provider metadata 일관 표시 검토 |
| Persistence | PASS | LLM이 직접 DB를 쓰지 않는가 | persistence는 local API/state 경계에서 수행 | 지속 유지 |
| UI transparency | PASS_WITH_RISK | 사용자가 local/LLM/fallback 차이를 알 수 있는가 | fallback notice와 기록 이벤트 표시 | 분석 패널별 source label 일관성 점검 필요 |

## Verification Checklist

AI 역할 또는 prompt, evidence, signature, provider code를 수정한 경우 최소한 아래를 확인합니다.

```powershell
_analysis_rf_platform_ux\node_modules\.bin\tsc.cmd -p _analysis_rf_platform_ux\tsconfig.json --noEmit
_analysis_rf_platform_ux\node_modules\.bin\vite.cmd build --config _analysis_rf_platform_ux\vite.config.ts
_analysis_rf_platform_ux\node_modules\.bin\esbuild.cmd _analysis_rf_platform_ux\server\index.ts --platform=node --packages=external --bundle --format=esm --outdir=_analysis_rf_platform_ux\dist
node _analysis_rf_platform_ux\scripts\rf-fip-llm-prompt-contract-smoke.mjs
node _analysis_rf_platform_ux\scripts\rf-fip-evidence-packet-smoke.mjs
node _analysis_rf_platform_ux\scripts\rf-fip-hybrid-hypothesis-smoke.mjs
node _analysis_rf_platform_ux\scripts\rf-fip-hybrid-summary-smoke.mjs
node _analysis_rf_platform_ux\scripts\rf-fip-signature-weights-smoke.mjs
node _analysis_rf_platform_ux\scripts\harness-policy-check.mjs
```

문서만 바꾸는 경우에는 `harness-policy-check`와 `git diff --check`를 최소 검증으로 사용합니다.

## Current Verdict

Verdict: PASS_WITH_RISK

현재 구조는 “Local Engine이 근거와 후보를 만들고, LLM이 설명과 우선순위를 보강한다”는 목표에 대체로 맞습니다. 남은 리스크는 외부 provider 가용성(OpenAI 429), Gauss 사내 schema 미확정, 첨부자료 deep analysis 미완, missing checklist와 signature gate의 중앙 contract 부재입니다.

## Next Improvement Backlog

1. Intent routing smoke test 추가
2. `RequiredEvidenceGate` contract 도입으로 signature, missing checklist, next action 근거를 한곳에서 관리
3. 기록 탭과 우측 분석 탭의 provider/source metadata 표시 일관화
4. Import LLM reason 보강 범위와 저장 schema 명시
5. Excel deep parsing, OCR, URL evidence extraction을 첨부 분석 pipeline에 연결
6. 사내 Gauss schema 확보 후 `gauss` provider 분기만 real call로 교체
