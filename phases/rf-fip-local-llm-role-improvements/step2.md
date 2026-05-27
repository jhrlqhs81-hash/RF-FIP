# Step 2: llm-summary-next-steps

## 읽어야 할 파일

- `docs/README.md`
- `docs/API_CONTRACTS.md`
- `client/src/components/ChatSummaryPanel.tsx`
- `server/rfFipLlmAdapter.ts`

## 작업

요약과 다음 분석 단계를 evidence-grounded LLM output으로 갱신한다.

## Acceptance Criteria

- next step 항목은 `text`, `rationale`, `evidence`, `messageId`를 포함한다.
- 요약 source metadata가 UI에 표시된다.
- LLM 실패 시 기존 summary를 보존한다.

## 검증 절차

- summary schema smoke
- `tsc --noEmit`
- `node scripts/harness-policy-check.mjs`

## 금지사항

- evidence/rationale 없는 next step을 생성하지 않는다.
- live API 검증은 별도 요청 없이는 실행하지 않는다.

## Verdict

- Status: completed
- Verdict: PASS
- Evidence: `tsc --noEmit`, `rf-fip-hybrid-summary-smoke.mjs`, `harness-policy-check.mjs`, Vite build
- Notes: Local deterministic summary now produces structured next steps with text, rationale, evidence, and messageId. Live LLM calls remain opt-in.
