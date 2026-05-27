# Step 0: local-evidence-packet

## 읽어야 할 파일

- `docs/README.md`
- `docs/ARCHITECTURE.md`
- `docs/LLM_GAUSS_CONTRACT.md`
- `client/src/lib/localRfAnalyzer.ts`
- `client/src/pages/Home.tsx`
- `scripts/rf-fip-evidence-packet-smoke.mjs`

## 작업

Local Engine이 LLM 보강 전 사용할 구조화 근거 묶음을 만든다. Packet에는 signature, taxonomy classification, rationale, diagnostic tests, missing info, similar cases, evidence ids가 포함된다.

## Acceptance Criteria

- `buildLocalEvidencePacket()`이 deterministic packet을 반환한다.
- local chat reply가 `evidencePacket`을 포함한다.
- `/api/llm/chat-reply` context에 `localEvidencePacket`이 전달된다.
- visible chat behavior는 기존 local fallback과 호환된다.

## 검증 절차

- `node scripts/rf-fip-evidence-packet-smoke.mjs`
- `tsc --noEmit`
- `node scripts/harness-policy-check.mjs`

## 금지사항

- 이 step에서 live OpenAI/Gauss 호출을 하지 않는다.
- 이 step에서 LLM hypothesis 생성까지 구현하지 않는다.
- 새 NLP dependency를 추가하지 않는다.
